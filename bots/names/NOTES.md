# Baby Name Report Card: notes

Idea #5 from `bots/ideas/APPS_ROUND2.md`. App at `docs/names/` (served at https://lanternlab2027.github.io/lab/names/), plus 1,918 static name pages. Built and tested Nov 15, 2026. **Not committed or pushed.**

**Heads-up:** `docs/names/` and `bots/names/` are already in `.git/info/exclude` under "WIP agent output". Remove those two lines before committing. Tracked files changed: `docs/sitemap-index.xml` (adds `sitemap-names.xml`), `docs/sitemap.xml` (adds `names/`), `docs/robots.txt` (adds a Sitemap line). `docs/sitemap-names.xml` is new.

## Data source

- Official: SSA national baby names, `names.zip` from https://www.ssa.gov/oact/babynames/limits.html. The data.gov catalog entry is https://catalog.data.gov/dataset/baby-names-from-social-security-card-applications-national-data, and its download points at the same SSA zip. This is public-domain U.S. government data.
- **ssa.gov, catalog.data.gov and web.archive.org are all blocked from this container** (the proxy returns 403 on CONNECT, even with a browser User-Agent).
- Used instead: an unmodified copy of SSA's `names.zip` committed to the public GitHub repo `justincoh/baby_names` (commit "Add 2025 SSA data", Aug 2026). I read it with `git cat-file`.
  - The zip's member timestamps are 2026-04-10 and 2026-04-13.
  - Its `NationalReadMe.pdf` says "Tabulated based on Social Security records as of March 1, 2026".
  - sha256 `cd78e975ed7bb358e018dd62fbe14ced89295e9581c49172ca4eedcb011b3724`, 7,860,026 bytes, 147 files (yob1880.txt through yob2025.txt, plus the readme).
  - **Before launch:** download names.zip from ssa.gov in a browser and check that the sha256 matches. If it doesn't, rebuild from the official file.
- Latest year: **2025**, released spring 2026. The 2026 data should arrive around May 2027.
- Caveat (SSA readme): "To safeguard privacy, we restrict our list of names to those with at least 5 occurrences." Files are sorted by sex, then count descending, with ties alphabetical. File order is the rank, and that's how ranks are computed here. The app, the pages and the share card all say this.
- Sanity check (also in the unit tests): yob2025 has 31,227 rows. The published names total 1,607,267 F and 1,708,076 M. Olivia is #1 for girls (13,544) and Liam #1 for boys (20,818).

## Rebuild (e.g. each May)

```
unzip names.zip 'yob*.txt' -d /some/dir
node bots/names/build_data.js /some/dir        # docs/names/data/ (meta, rising, top, 371 shards)
node bots/names/build_pages.js                 # docs/names/n/*.html, sitemap-names.xml, updates sitemap-index.xml
node bots/names/test_stats.js                  # 33 unit tests (the real-data checks pin 2025 numbers; update them)
NODE_PATH=/opt/npm-tools/node_modules node bots/names/make_og.js     # docs/names/og.png
NODE_PATH=/opt/npm-tools/node_modules node bots/names/test_page.js [shots dir]
```

Hard-coded year references to update: the `2025` in `index.html` text, which is filled from the data at runtime but serves as the no-JS fallback. Also, the Gen Alpha end year in `stats.js` (`GENERATIONS`) is clamped to the latest year automatically.

## What's built

**Files**
- `docs/names/stats.js` is shared by the browser and the Node build. It holds the stats, the trend rules, the similar-names heuristic, the written summary and the SVG chart.
- `docs/names/app.js`, `card.js`, `index.html` and `names.css` (shared with the pages) make up the app. `og.png` is 1200x630.

**Data (`docs/names/data/`, 7.2 MB raw, roughly 2.5 MB gzipped)**
- It has 44,595 name/sex series: every name given in 2025, plus any name with 200+ babies since 1880.
- Series are sharded by the first two letters (371 files; the largest, `ma.json`, is about 300 KB raw and 120 KB gzipped). A lookup loads one shard.
- `meta.json` lists the shard keys, so a missing name doesn't trigger a 404.

**App features**
- Search returns a report card with:
  - the 2025 rank (within the name's main sex), the 2025 count (girls + boys) and the all-time count;
  - the peak year by share of births, shown as "1 in N";
  - a trend stamp with an explanation;
  - same-year twins ("N others born in 2025 share it");
  - an optional "born in" year with that year's count;
  - an SVG chart of babies per million births by sex since 1880;
  - a girls/boys split for the latest year and all years;
  - similar names on the rise (clicking one loads its card);
  - ranks by decade;
  - a link to the name's static page.
- Compare mode (`?n=Hazel&vs=Violet`) shows a two-line chart, a side-by-side table and both report cards.
- The 1080x1350 share card reads "Peaked in 1897 · now #21", with a chart, three stats, a "Make yours: lanternlab2027.github.io/lab/names" footer and the SSA note. There is a two-name variant in compare mode.
- Share (Web Share, falling back to download), Save PNG, and Copy link + text.
- `?ref=` passthrough works the same way as in reading and wrapped: `ref=X` becomes `share-X`, and no ref becomes `share`.
- URL state: `?n=`, `&vs=`, `&y=`.

**Trend rules** (all on share of births, first match wins; also explained on the page)
1. Vintage revival
2. Classic
3. Rising (up 25% or more, last 5 years vs the same 5 years a decade earlier)
4. Falling (down 20% or more)
5. Falling, long-term (level lately, but under 10% of its best decade)
6. Steady

Spot checks: Hazel, Theodore, Henry, Evelyn, Oliver and Charlotte are revivals. James, Elizabeth, William and John are classic. Mary, Jennifer, Ashley and Karen are falling. Liam, Mateo, Nova and Luca are rising. Olivia is steady.

**Similar names heuristic (spelling, not phonetics)**
- A candidate qualifies if it is:
  - 1 letter edit away; or
  - 2 edits away, with the same first letter and both names 5+ letters; or
  - sharing the same first-2 and last-2 letters.
- Candidates must also come from `rising.json`: 100+ babies in 2025 and share of births up 30% or more over 5 years (2-year averages). That list has 1,177 entries.
- Same-sex names come first, then the closest spelling, then the fastest growth.
- Weakness: it's spelling-only. "Joan" shows up for Jordan, and Olivia gets nothing.

**Kit signup**
- The prompt reads "get the new rankings when SSA releases them (usually May)". It sends only `api_key` + `email` (the test checks this).
- The key was copied programmatically from `docs/reading/app.js`.
- **The tag is the placeholder `25915951`.** Create a Kit tag and replace it. Until then, signups show "didn't go through".

**Privacy**
- CSP: `connect-src 'self' https://api.convertkit.com`.
- No analytics, no cookies, no CDNs, system fonts only.
- Footer links go to `../` and `../apps/`, with "Source: U.S. Social Security Administration. Not affiliated."

## SEO pages

**Name pages (`docs/names/n/{slug}.html`)**
- There are **1,918** of them: the 2025 top 1,000 girls plus the top 1,000 boys, minus 82 names on both lists.
- Each page covers both sexes and is server-rendered HTML. It contains:
  - a data-written summary and four stats;
  - the trend with its "why";
  - same-year twins;
  - an inline SVG chart with the peak dotted;
  - CTAs to the app ("Get the X share card", "Compare with [next-ranked name]");
  - the girls vs boys split, with a sentence about shifts or unisex use;
  - similar rising names, linked;
  - babies by generation (Greatest through Gen Alpha), a table no other section repeats;
  - rank, births and "1 in N" by decade;
  - the names ranked ±3 around it, linked.
- Pages have no JavaScript at all (CSP has no script-src). They include a BreadcrumbList JSON-LD and a canonical, and use the shared `og.png`.
- Titles run up to 67 characters and descriptions up to 167. There are no duplicate titles or descriptions.

**Indexes and sitemap**
- `n/index.html` lists letters plus the top 100 girls and boys.
- There are 26 letter pages, `n/a.html` through `n/z.html`, each with a data-written intro.
- `docs/sitemap-names.xml` has 1,945 URLs.

**Size**
- 1,945 HTML files, 21.1 MB raw, about 11 KB per page (about 4 KB gzipped).
- `docs/names/` totals about 31 MB on disk, counting the data.

## Tests (all passing)

**`test_stats.js`: 33 unit tests**
- encode/decode
- every trend branch, including share-vs-count
- primary-sex choice and its tie fallback
- split, peak and "1 in N"
- generations
- summary wording, ordinals and pctPair
- similarScore and similarRising ordering
- SVG bounds and escaping, niceMax
- real-data checks: 2025 totals, Olivia and Liam, known trend shapes, and all 2,000 top names round-tripping their ranks

**`test_page.js`: Playwright at 390px and 1280px**
- App:
  - search, stats, chart and birth-year line;
  - similar chips;
  - URL and ref passthrough;
  - 1080x1350 card drawn, and Save PNG downloads it;
  - the not-found message;
  - compare mode;
  - Kit stub body.
- Static pages: olivia, jordan and theodore, plus `n/` and `n/m.html`. Checked for h1, SVG, no scripts, title/description/canonical length, data note, footer links and no horizontal scroll.
- Zero console errors and zero off-origin requests.
- All 402 internal links from the visited pages return 200.
- A static check confirms that all 35,734 relative links in the 1,945 generated pages resolve, and that every sitemap URL exists.

## To do before launch (Matt)

1. Create the Kit tag and replace `25915951` in `docs/names/app.js`.
2. Verify the names.zip sha256 against ssa.gov (see above).
3. Remove the two `names` lines from `.git/info/exclude`, then commit.
4. Optional: add a card to `docs/apps/` and the hub (`docs/index.html`). I didn't touch either.
5. Optional: per-name OG images. All pages currently share one `og.png`.

## Ideas not done

- Spelling-variant grouping (Aiden/Aidan/Ayden): this would make "similar names" better.
- State-level data (`namesbystate.zip`).
- A tab for the "rising fastest" list.
