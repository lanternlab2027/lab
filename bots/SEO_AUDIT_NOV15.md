# SEO audit: programmatic pages (Nov 15, 2026)

Scope: `docs/b/` (buildings), `docs/eats/r/` (restaurants), `docs/names/n/` (baby names), `docs/guides/` (export guides). `docs/mileage/` and `docs/art/` were not touched. Nothing committed or pushed.

**Audit script:** `bots/seo_audit/audit.py`. It is read-only and takes about 50 seconds. Run `python3 bots/seo_audit/audit.py` for a summary, and add `--verbose` for full lists or `--json out.json` for a file.

It checks every HTML page in the four sets for:
- unique titles and meta descriptions, and their lengths;
- a self-referencing canonical that exactly matches the sitemap `<loc>`;
- sitemap URLs that have no page, and sitemap lastmod (present, valid, not in the future);
- exactly one H1, JSON-LD that parses, and any noindex;
- broken internal links, with every `href`/`src` resolved against the file tree (root-relative, `/lab/` and absolute production URLs included);
- click depth, by BFS over the whole `docs/` link graph from the home page and from each set's hub;
- related links per detail page (links to other detail pages in the same set), and inbound links per detail page;
- thin pages (under 150 words);
- near-duplicates: MinHash/LSH on 5-word shingles, then exact Jaccard of at least 0.85, plus each page's share of non-boilerplate text;
- whether robots.txt references `sitemap-index.xml`.

## Results

| Check | Buildings (571) | Eats (1,042) | Names (1,945) | Guides (7) |
|---|---|---|---|---|
| Duplicate titles / descriptions | 0 / 0 | **1 / 1** → 0 / 0 | 0 / 0 | 0 / 0 |
| Titles over 65 chars | **36** → 17 | **866** → 52 | **44** → 0 | 0 |
| Titles under 50 chars | **63** → 1 | 0 | 0 | 0 |
| Canonical = own URL = sitemap loc | all | all | all | all |
| Sitemap URL with no page | 0 | 0 | 0 | 0 |
| Pages without exactly one H1 | 0 | 0 | 0 | 0 |
| Invalid JSON-LD | 0 | 0 | 0 (27 letter/index pages had none → now BreadcrumbList) | 0 |
| noindex | 0 | 0 | 0 | 0 |
| Broken internal links | 0 | 0 | 0 | 0 |
| Detail pages over 2 clicks from their hub | 0 | 0 | 0 | 0 |
| Detail pages with fewer than 3 related links | **108** → 0 | **151** → 0 | 0 | **6** → 0 |
| Detail pages with more than 6 related links | 0 | 0 | 1,081 (kept, see below) | 0 |
| Near-duplicates (J ≥ 0.85) / thin pages | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Median unique-text share | 0.46 | 0.33 (min 0.15) | 0.63 | 0.89 |
| Sitemap lastmod | present, sane | present, sane | present, but it was the build date (fixed) | present (bumped for regenerated pages) |

Bold marks a problem found, and the arrow shows the value after the fixes.

**robots.txt** listed the four sitemaps but not `sitemap-index.xml`; that line has been added. The robots.txt caveat in `SEO_NOTES.md` still applies: crawlers ignore it at `/lab/`.

**Bug fixed:** `bots/seo_pages/build.py` used to rewrite `docs/sitemap-index.xml` from scratch with only `sitemap.xml` and `sitemap-buildings.xml`. The first weekly buildings run would have silently dropped the eats and names sitemaps from the index. It now updates only its own entry, the same way the eats and names generators do.

## What changed

All page changes were made by regenerating, not by hand edits. No data was refetched: buildings and eats re-rendered from their `.cache/`, and names from `docs/names/data/`. I checked first that a re-render with the unchanged generators reproduced every page byte for byte, so every diff below comes from these fixes.

**Buildings (`bots/seo_pages/build.py`)**
- Title: the borough is dropped above 65 characters (the old cut-off was 68). The ZIP is added when the title is under 50 and still fits in 65. "1 Open HPD Violation" is now singular.
- Neighborhood page titles over 65 characters use shorter fallbacks.
- Related links:
  - Up to 6 in the same neighborhood, as before.
  - If there are fewer than 3, a "More listed buildings in {ZIP / borough}" list fills the gap to 3. It takes the same ZIP first, then the nearest ZIP number in the borough.
  - Every page now also links "See all listed {borough} buildings".
- Sitemap-index merge fix (above).
- Result: 535 of 571 files changed.

**Eats (`bots/eats_pages/build.py`)**
- `restaurant_title()` picks the longest of these forms that fits in 65 characters: "Name Health Grade and Inspections, address, borough", then "Name Health Grade, address, borough", then "Name Health Grade, address". The address is always kept, because it tells chain locations apart.
- Colliding titles get the cuisine appended, or the permit number if the cuisine is the same too. This added the cuisine to the description as well. It fixed the two Cibo Express counters at "0 Jfk Intl. Airport", whose title and description were identical.
- Same-ZIP related links now take the next 6 restaurants alphabetically, wrapping around, instead of always the alphabetically first 6.
  - Before, 346 pages had only 2 inbound links while a few had 33.
  - Now inbound links range from 2 to 10, mostly 8.
- Pages with fewer than 3 same-ZIP neighbors get a "More {cuisine} restaurants in {borough}" list, falling back to the borough, to reach 3.
- `bots/eats_pages/last_known.json.gz` was restored from backup. `render` rewrites it with identical JSON but a new gzip timestamp.
- Result: 974 of the 1,000 restaurant pages changed.

**Names (`bots/names/build_pages.js`)**
- ", Peak YYYY" is dropped when the title would exceed 65 characters (44 pages).
- BreadcrumbList JSON-LD was added to `n/index.html` and the 26 letter pages.
- Sitemap lastmod is now the date a page's HTML last changed, not the build date for all 1,945 URLs. I confirmed that a rebuild with `BUILD_DATE=2026-11-20` leaves the sitemap unchanged. I built with `BUILD_DATE=2026-11-15`.
- Result: 71 files changed.

**Guides (`bots/guides/build.py`)**
- A "More guides" list on each guide page shows the other 5 guides, with guides for the same app first. It reuses the existing `.guide-list` style.
- Result: all 6 guides changed. The index is unchanged.

**Hand-edited**
These files have no generator, or the change sits outside one:
- `docs/robots.txt`: added `Sitemap: …/sitemap-index.xml`, and kept the existing lines.
- `docs/sitemap-index.xml`: added a lastmod to the `sitemap.xml` entry.
- `docs/sitemap.xml`: lastmod 2026-11-15 on the 5 guide URLs that still said 2026-11-14.

## Not changed: decisions for you

1. **Names have 6 to 12 related links per page**, above the 3–6 target. They come from two separate modules: "Similar names on the rise" (up to 6) and "Ranked next to" (rank ±3, up to 6). Both are useful navigation, and 12 links carries no SEO cost, so I left them. To get to 6 or fewer, change the `r - 3`/`r + 3` window in `neighbors()` in `build_pages.js` to ±1. A "same peak decade" module doesn't exist yet. It would need a new feature, not a fix.
2. **Click depth from the site home is 4** for buildings and eats detail pages and **5 for names**. From each set's own hub it is 2, which meets the "within 3 clicks of a hub" rule. Linking `b/`, `eats/r/` and `names/n/` directly from `docs/index.html` would bring every page to depth 3 from home. I didn't edit the home page because other agents are working on the site.
3. **Meta descriptions over 160 characters:** 115 building pages, 1,005 eats pages and 128 names pages. The grade, counts and date come first, so truncation only cuts the tail (the eats "DOHMH data as of …"). I left them to avoid churn. Shortening the eats template's "Last 3 inspections with scores and violations in plain English." would recover about 20 characters.
4. **Remaining long titles:** 17 buildings and 52 eats pages. They are long because the address or the restaurant name alone is long. Truncating names or addresses would hurt accuracy.
5. **Sitemap lastmod for buildings (11-14) and eats (11-13)** is the data date. These pages changed today only in navigation and titles, so the lastmod was not bumped. The next scheduled build will set it.
6. **Outside the audited sets:** 8 URLs in `docs/sitemap.xml` have no lastmod: `calendar/`, `hic/`, `processserver/`, `tlc/`, `then/`, `eats/`, `chi-eats/` and `chicago-then/`. Nothing was invented for them.
7. **Low unique-text share on some eats pages** (minimum 0.15): pages with one short inspection are mostly the grading explainer. They are not near-duplicates of each other, because no pair reaches 0.85. If Search Console shows "Crawled – currently not indexed" for these, the eats NOTES already suggest adding a mini score history.

## Tests

- `bots/eats_pages/test_pages.js --no-live`: all passed. This includes the full internal-link sweep and the sitemap check. I did not run the live smoke test, because it needs NYC Open Data.
- `bots/guides/test_pages.js`: ALL PASSED.
- `bots/names/test_stats.js`: 33 passed, 0 failed.
- `bots/names/test_page.js`: all passed, with 35,734 relative links across 1,945 pages resolving.
- `bots/seo_pages` has no test file. The Playwright spot check and the audit cover it.
- **Playwright spot check at 390×844:** 5 random pages per set (20 in all), with outside requests blocked.
  - Every page passed: HTTP 200, no horizontal overflow, one H1, canonical equal to the production URL, JSON-LD parses, no noindex, no console or page errors, and every same-origin link returns 200.
  - I also looked at screenshots of the new link sections on a building, an eats and a guide page. They render cleanly and use the existing styles.
- Final audit: all the "after" values in the table above.

## Exact paths changed

Generators and tools:
- `bots/seo_pages/build.py`
- `bots/eats_pages/build.py`
- `bots/names/build_pages.js`
- `bots/guides/build.py`
- `bots/seo_audit/audit.py` (new)
- `bots/SEO_AUDIT_NOV15.md` (new, this file)

Regenerated output:
- `docs/b/`: 535 of 571 files differ: 500 building pages and 35 neighborhood pages (titles over 65 characters). The borough pages, `index.html`, `style.css` and `docs/sitemap-buildings.xml` are unchanged.
- `docs/eats/r/`: 974 of the 1,000 restaurant pages differ. The borough, cuisine and index pages and `docs/sitemap-eats.xml` are unchanged.
- `docs/names/n/`: 44 name pages, the 26 letter pages and `index.html` (71 files). `docs/sitemap-names.xml` is byte-identical, because no lastmod changed.
- `docs/guides/`: the 6 `how-to-*.html` pages.

Hand-edited:
- `docs/robots.txt`
- `docs/sitemap-index.xml`
- `docs/sitemap.xml`

Unchanged in content:
- `bots/eats_pages/last_known.json.gz` (restored byte-identical)
- `bots/eats_pages/.cache/computed.json` (rewritten by render; gitignored)

`.gitignore` shows as modified in `git status`, but I did not change it.
