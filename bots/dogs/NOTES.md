# NYC Dog Name Report Card: notes

Sequel S2 from `bots/ideas/APPS_ROUND3.md`. App at `docs/dogs/` (will be served at https://lanternlab2027.github.io/lab/dogs/), plus 1,584 static pages. Built and tested Nov 15, 2026. **Not committed or pushed.** It is a port of `docs/names/` (same look, share-card flow, `?ref=` passthrough, static-page builder and test layout) and reuses `bots/names/serve.js` for tests.

Tracked file changed: `docs/sitemap-index.xml` (one line appended for `sitemap-dogs.xml`; other lines untouched). New: `docs/sitemap-dogs.xml`, `docs/dogs/`, `bots/dogs/`. Not touched: `docs/index.html`, `docs/apps/`, `docs/sitemap.xml`, `docs/robots.txt`, `.git/info/exclude`.

## Data source

- NYC Dog Licensing Dataset, NYC Open Data id **`nu7n-tubp`** (verified live Nov 15, 2026; `Access-Control-Allow-Origin: *`). Data last updated 2026-07-15.
- Fields (Socrata API names): `animalname`, `animalgender`, `animalbirth` (birth **year** only), `breedname`, `zipcode`, `licenseissueddate`, `licenseexpireddate`, `extract_year`.
- 819,323 rows. Extract years 2016, 2017, 2018, 2022, 2023, 2024, 2026 (no 2019-2021 or 2025 extracts). License issue dates run Sep 2014 to Dec 31, 2025.
- ZIP -> borough: `zip_borough.json` (240 ZIPs), made by `make_zipmap.js` from the majority borough of 311 requests since 2025 per ZIP (`erm2-nwe9`), falling back to DOHMH restaurant inspections (`43nn-pn8j`). Straddling ZIPs (11385, 10463, ...) get their majority borough.

## Cleaning and dedupe (`clean.js`, tested in `test_clean.js`)

- **Name key** = slug: accents folded, upper/lowercase ignored, space / hyphen / period all separate words, apostrophes dropped, dotted initials collapsed. So "Jay-Jay" = "JAY JAY", "A.J." = "AJ", "Reese's" = "Reeses".
- **Junk names dropped** (40,848 rows): Unknown and misspellings (Unkown, Unknowed, Unk...), Name Not Provided, Name, Name?, Noname, None, NA, N/A, N.A., NaN, No, TBD, Null, a title alone (Mr., Dr., Ms. - the field looks cut off), names with under 2 letters (A, X, ".") except letter+digit like K9, and strings with 3+ digits (tag numbers). Kept on purpose: Baby, Dog, Puppy, Princess (real names people use).
- **Display** = the most common raw spelling for the key, title-cased ("MR.PICKLES" -> "Mr. Pickles", two-letter initials like AJ/TJ/KC stay upper).
- **Dedupe**: one dog = **name key + birth year (as typed) + breed (raw, case-folded) + ZIP**. This collapses the same license repeated across yearly extracts (41,300 exact duplicate rows) and renewals. Gender is not in the key (it flips between renewals for ~1% of dogs); majority wins. 819,323 rows -> **332,539 dogs** with real names, **34,420 distinct names**.
  - Known errors: two different dogs matching on all four fields count once; a dog that moved ZIP or had its breed typed differently on renewal counts twice.
- **Birth year** valid only 1995..first issue year (rejects 1014, "ERROR: #VALUE!", births after the license). Median shown as "typical birth year".
- **Breed families**: "X Crossbreed"/"X mix" counts toward X; spelling variants merged (Pit Bull variants, Poodle sizes, Dachshund coats, Corgi, Wheaten, Coton, Bassett...). "Unknown"/"Not Provided" left out. Generic "Terrier"/"Hound"/"Shepherd" shown as "... mix".

## Aggregates (`build_data.js` -> `docs/dogs/data/`, 1.3 MB)

- Per name (shards `s/a.json`..`s/z.json`): total dogs, competition rank (ties share), F/M, median birth year, dogs per license-issue year 2015-2025, top 5 breeds, borough counts + rank within each borough, top 5 ZIPs, ZIPs where it's the outright #1, page flag.
- **Trend uses share** (dogs per 10,000 licensed that year), because yearly coverage is uneven (2015 and 2022-2025 are thinner: extracts only capture licenses still active at extract time). 2014 is excluded from the trend (Sep-Dec only). Rising = last 3 years' share >= +25% vs first 3; Fading <= -20%; Newcomer = absent in first 3; else Steady.
- `top.json` (1,500 page names), `breeds.json` (50 families with 300+ dogs and 20+ names having 5+ dogs), `boroughs.json`.

**Privacy**: lookup needs 5+ dogs (6,397 names); every breed / borough / ZIP cell under 5 is hidden; static pages need 20+ dogs (the top 1,500 all have 33+). No owner data exists in the source anyway.

Sanity: Bella #1 (3,457), Luna #2 (3,039), Max, Charlie, Coco. Bella is #1 in four boroughs; Charlie is #1 in Manhattan. Top French Bulldog name: "French".

## Pages (`build_pages.js`)

- `docs/dogs/n/{key}.html` x1,500: headline ("There are 3,039 licensed dogs named Luna in NYC."), summary, stats, trend, #1-ZIP list, inline SVG chart, breed and borough bars (linked), top ZIPs, dogs-vs-babies note linking to `../../names/n/` when the name is in the SSA top 1,000, year table, rank neighbours. No JS (CSP has no script-src), BreadcrumbList JSON-LD, canonical, shared `og.png`.
- `n/index.html` (top 100 + ItemList JSON-LD, top female/male, fastest risers), `n/a.html`..`n/z.html`, `breed/index.html` + 50 breed pages (top names + "unusually Frenchie" names by lift), `borough/index.html` + 5 borough pages.
- `docs/sitemap-dogs.xml`: 1,585 URLs (includes `dogs/`). lastmod only changes when a page's HTML changes.
- 14.7 MB HTML, ~9 KB per page.

## App (`docs/dogs/`)

`index.html`, `app.js`, `card.js` (1080x1350 canvas card: "There are N licensed dogs named X in New York City", chart, rank / top breed / top borough, "#1 name in N ZIP codes"), `stats.js` (shared with the Node builder), `kit.js`, `dogs.css`, `og.png` (1200x630, `make_og.js`). No analytics, cookies or CDNs.

**Kit**: `kit.js` copies the pattern of `docs/eats/kit.js` (key copied programmatically). Tag is the placeholder **`TAGID_DOGS`**; while it isn't numeric the signup section stays hidden. Sends only `api_key` + `email`.

## Rebuild (yearly, after the city updates nu7n-tubp)

```
bots/dogs/fetch.sh                          # raw CSV + ZIP inputs into bots/dogs/.cache/ (gitignored, ~86 MB)
node bots/dogs/make_zipmap.js               # optional: refresh zip_borough.json
node bots/dogs/build_data.js
node bots/dogs/build_pages.js
node bots/dogs/test_clean.js                # 105 unit tests (cleaning, dedupe, stats, real-data checks: Bella #1, Luna #2)
node bots/dogs/test_pages.js                # static checks: unique titles/descriptions, canonicals, JSON-LD parses, links, sitemaps, ASCII sources
NODE_PATH=/opt/npm-tools/node_modules node bots/dogs/make_og.js
NODE_PATH=/opt/npm-tools/node_modules node bots/dogs/test_page.js [shots dir]   # Playwright 390 + 1280
```

## To do before launch

1. Create the Kit tag and replace `TAGID_DOGS` in `docs/dogs/kit.js`.
2. Commit `docs/dogs/`, `bots/dogs/`, `docs/sitemap-dogs.xml`, `docs/sitemap-index.xml`.
3. Optional: add `dogs/` to `docs/sitemap.xml`, a card in `docs/apps/` and the hub, and a link from `docs/names/` back to dogs.

## Ideas not done

- ZIP lookup ("top names in my ZIP") and a borough/ZIP map.
- Compare two names; per-name OG images.
