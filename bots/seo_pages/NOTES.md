# Building pages: programmatic SEO prototype (Nov 14, 2026)

Static pages, one per NYC building, at `docs/b/{bbl}.html`, built by `bots/seo_pages/build.py`. They target searches like "[address] violations", "[address] HPD" and "[address] landlord complaints". Each page links to the live Building Watch lookup (`buildingwatch/lookup.html?bbl=...`). Nothing has been committed or pushed.

## What was built

- **Pilot set: 500 buildings.** These are the tax lots with the highest combined count of open HPD violations plus distinct HPD complaints received in the last 12 months. To pick them, the generator took the top 1,000 lots on each measure, recounted both measures exactly for the union of the two lists, and ranked by the sum.
- **Pages:** 500 building pages, 65 neighborhood pages, 5 borough pages and `docs/b/index.html`, plus one shared `docs/b/style.css`. Total: 6.2 MB.
- **Sitemaps:** `docs/sitemap-buildings.xml` lists every new page. `docs/sitemap-index.xml` points to both it and the existing `sitemap.xml`. `docs/robots.txt` gained a second `Sitemap:` line. The existing `sitemap.xml` is unchanged. In Search Console, submit `sitemap-index.xml` (or `sitemap-buildings.xml` on its own).
- **Internal links:** `buildingwatch/index.html` (footer) and `buildingwatch/lookup.html` (bottom) now link to `b/`, so crawlers can reach the pages without the sitemap.
- **lookup.html** already supported `?bbl=` (it fills the box and auto-submits), so no change was needed there.

## What each building page shows

- **Header:** the primary address, borough and ZIP, BBL, and the "data as of" date.
- **Summary paragraph** written from the data. Each clause appears only when the data supports it: unit count, neighborhood, year built, open violations per apartment, the 12-month trend against the prior 12 months, the top cited condition types and the top complaint area.
- **Tiles:** open HPD violations, open Class C, HPD complaints in the last 12 months, and active DOB/ECB violations.
- **Open violations by class (A/B/C/I),** with HPD's time to correct, the top Class C condition types, the rent-impairing count, the year of the oldest open violation, and AEP status where it is active.
- **Violations issued in the last 12 months,** by class and by condition type (about 25 categories: mold, leaks, roaches, heat and hot water, and so on).
- **HPD complaints in the last 12 months:** complaints and problems by HPD's own categories, with the year-over-year change.
- **DOB/ECB:** active ECB violations by severity and type, active DOB violations by type, and ECB violations issued in the last 12 months.
- **Building facts:** BINs, units, floors, year built, the number of buildings on the lot, HPD registration status (current or expired, with the date), and every address on the lot.
- **"What Class A, B and C mean":** a short explainer citing HPD's [Clear Violations page](https://www.nyc.gov/site/hpd/services-and-information/clear-violations.page). It says A is non-hazardous (90 days to correct), B is hazardous (30 days), and C is immediately hazardous (24 hours; 21 days for lead paint, window guards, mold, mice, roaches and rats; 14 days for self-closing doors; heat and hot water right away). It also covers Class I orders. I checked these against HPD's page on Nov 14, 2026.
- **Two CTAs,** "See live details and get alerts", pointing to `lookup.html?bbl=`.
- **Links to up to 6 other listed buildings** in the same neighborhood.
- **Sources** (the datasets, HPD Online, the DOB BIS profile for the first BIN) and a disclaimer.
- **Head tags:** canonical, title (address plus open-violation count), meta description (counts plus date), Open Graph tags and BreadcrumbList JSON-LD. Index pages carry BreadcrumbList too.

## Privacy

- **Owner, agent and respondent names are never fetched.** No query selects HPD contact data (that is a separate dataset, not used), PLUTO `ownername` or ECB `respondent_*`.
- **HPD violation descriptions** are fetched only to sort each violation into a category in memory. The text is never cached or published, because it contains apartment numbers and sometimes a person's name (one example seen: "SMOKE DETECTOR MR ...").
- **Complaints:** only the category counts are used. Apartment, unit and space fields are never selected.
- **Published fields:** building addresses, BBL and BIN, and counts. The weekly workflow fails if a page ever contains an `APT`-style token. The test run checks this too (see below).

## Data sources (NYC Open Data, SODA, no key)

| Dataset | ID | Used for |
|---|---|---|
| HPD Housing Maintenance Code Violations | wvxf-dwi5 | open by class, 12-month by class and category, oldest open, rent-impairing, NTA, addresses |
| HPD Complaints and Problems | ygpa-z7cr | 12-month complaints (distinct `complaint_id`), problems by category, prior-year comparison |
| DOB ECB Violations | 6bgk-3dad | active by severity and type, 12-month issued (by BIN) |
| DOB Violations | 3h2n-5cm9 | active by type (by BIN) |
| HPD Registrations | tesw-yqqr | address ranges, BINs, registration end date |
| Building Footprints | 5zhs-2jue | BBL to BIN (base and billing BBL, same as lookup.html) |
| PLUTO | 64uk-42ks | units, floors, year built, buildings on lot |
| HPD AEP buildings | hcir-3275 | active Alternative Enforcement Program status |

The field conventions come from `docs/buildingwatch/lookup.html` and `bots/buildingwatch/watch.py`: `violationstatus='Open'`, ECB `ecb_violation_status='ACTIVE'`, DOB `violation_category LIKE '%ACTIVE%'`, and ECB `issue_date` handled as YYYYMMDD with the `< '29991231'` guard.

## Refresh plan

The draft workflow is `bots/seo_pages/seo_pages.yml`. It is **not installed**; to enable it, copy it to `.github/workflows/`.
- It runs on Mondays at 09:43 UTC, executes `build.py all`, and commits `docs/b` and the sitemaps.
- It refuses to commit if there are fewer than 400 building pages (for example, during an API outage) or if any page contains an apartment token.
- Buildings that drop out of the set have their pages deleted. **Decide before enabling:** once pages are indexed, it is kinder to keep a dropped building's page, regenerated with a "no longer in the top set" note, than to return a 404. For now, `render()` deletes them.
- An optional `SOCRATA_APP_TOKEN` secret raises rate limits.

## Google's guidance on scaled content, and how this stays on the right side

Google's [spam policies](https://developers.google.com/search/docs/essentials/spam-policies) define **scaled content abuse** as "when many pages are generated for the primary purpose of manipulating search rankings and not helping users", "typically focused on creating large amounts of unoriginal content that provides little to no value to users, no matter how it's created." The examples include scraping feeds to generate pages "where little value is provided", stitching content together without adding value, and pages that make little sense to a reader but contain keywords.

The same page defines **doorway abuse**: pages "created to rank for specific, similar search queries" that "lead users to intermediate pages that aren't as useful as the final destination". One listed example is **"Generating pages to funnel visitors into the actual usable or relevant portion of a site."**

**Be honest about the risk:** "funnel into the lookup" is exactly the doorway pattern Google names. These pages are only defensible if each one fully answers the query by itself, with the CTA as an extra rather than the point. The design follows from that:

1. **Each page answers the search on its own.** Someone searching "[address] violations" gets the counts by class, what was cited, what tenants reported, the trend, DOB/ECB status and registration status, without clicking through. The lookup adds line-by-line detail, hearings and alerts, which is genuinely more, not the same thing behind a click.
2. **Unique data, not spun text.** Every number, list and sentence comes from that building's records. The only shared text is the short Class A/B/C explainer, the method note and the disclaimer. Clauses are dropped when there is no data, rather than filled with padding. No synonym swapping and no AI-written filler.
3. **Value added beyond the raw feed:** condition categories (HPD's raw output is a long list of templated sentences), year-over-year trends, violations per apartment, a plain-English explanation of the classes, and neighborhood context.
4. **A real, browsable hierarchy** (index, then borough, then neighborhood, then building) instead of a flat pile of near-identical pages. Neighborhood pages exist only where there are at least 3 buildings, so there are no thin one-row index pages. Smaller neighborhoods appear as sections of the borough page.
5. **Limited, demand-led scale.** A pilot of 500 buildings chosen because people are likely to search for them (many violations and complaints), not every one of NYC's roughly 860,000 lots. **Don't expand to all buildings.** Pages for buildings with nothing on record would be thin by definition. Grow the set only if Search Console shows these pages earning impressions and clicks.
6. **Freshness and accuracy:** the "data as of" date is on every page, there is a weekly rebuild, and sources link to the official records. The pages say plainly that an open violation may already be fixed but not yet cleared.
7. **One site and one canonical URL per building.** No parallel domains and no query-string variants.

**Things to watch after launch:**
- **Search Console:** look for "Crawled – currently not indexed" in volume. That is Google calling the pages low value, and the answer is to cut or merge, not add more.
- **Manual actions:** check the Manual Actions report.
- **Engagement:** see whether visitors to the pages actually use the lookup, or bounce.

## Known gaps and decisions for Matt

- **No building names.** None of these datasets has a reliable building or complex name ("Co-op City", "Parkchester"), so "[building name] violations" queries are covered only through the address. A small, hand-checked alias list for the largest complexes would be the safe way to add names. Don't scrape them.
- **Large complexes are one page per tax lot** (for example, a 10,000-unit lot), matching how HPD keys BBL. The page lists all the addresses on the lot.
- **The neighborhood is the NTA name** HPD attaches to records. Some NTA names are compound (for example, "East New York-City Line").
- **The "data as of" date is the fetch date.** The page also shows the latest HPD issue date in the dataset.
- **robots.txt caveat** (from `bots/SEO_NOTES.md`): it is ignored at `/lab/` until the site moves to a root domain. Submit the sitemap in Search Console directly.

## Tests (Nov 14, 2026)

The test script ran against a local `http.server` that serves `docs/` under `/lab/`:

- **Size:** 571 pages in `docs/b` (500 buildings, 65 neighborhoods, 5 boroughs, 1 index) plus `style.css`, 6.2 MB in total. Building pages average 11.3 KB; the largest is 12.3 KB. Each has one shared CSS file and no JavaScript or images.
- **Internal links:** all 1,074 internal link targets on every page in `docs/b` return 200, as do all 571 URLs in `sitemap-buildings.xml`.
- **Playwright at 390px** on 5 building pages (the top-ranked one plus 4 chosen at random): status 200, no horizontal overflow, 0 console or page errors, BreadcrumbList JSON-LD parses, the canonical URL is correct, and the CTA points to `lookup.html?bbl=`.
- **Click-through:** `lookup.html?bbl=1004290047` auto-runs and renders the building.
- **Privacy scan:** no `APT 3B`-style, `APARTMENT 4`-style or `MR./MRS. NAME`-style tokens on any page.
- **Uniqueness:** 0 duplicate titles and 0 duplicate meta descriptions across the 500 building pages. Titles run 44–66 characters and descriptions 146–173.
- **Manual review:** pages for 351 W 125th St, 128 Clarke Pl E and Co-op City read sensibly. Two fixes came out of the review:
  - HPD complaint "minor categories" turned out to be locations (floor, wall), so they were dropped.
  - Unsourced examples were removed from the Class A and B explainer.
- **Categorizer:** on a sample of 5,000 recent violations, about 2% fell into "Other repairs".
