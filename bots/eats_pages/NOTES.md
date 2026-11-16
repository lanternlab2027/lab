# Restaurant pages: programmatic-SEO pilot (Nov 14, 2026)

These are static pages, one per NYC restaurant, at `docs/eats/r/{camis}.html`. They are built by `bots/eats_pages/build.py` and feed the live NYC Restaurant Report Card (`docs/eats/`). They target searches like "[restaurant] health grade" and "[restaurant] inspection". Each page answers the question on its own, then links to the app at `../?camis=…` for the full history, the score chart and the share card. Nothing has been committed or pushed.

## What was built

| Item | Detail |
|---|---|
| Restaurant pages | 1,000 at `docs/eats/r/{camis}.html` |
| Index pages | `r/index.html`, 5 borough pages at `r/borough/*.html` and 36 cuisine pages at `r/cuisine/*.html` (cuisines with 5 or more restaurants; the rest are listed under "Other cuisines" on `r/index.html`) |
| Shared CSS | `r/r.css` (4 KB). No images, no JS, no external requests. |
| Size | **11.1 MB total** (about 3.5 MB gzipped, as GitHub Pages serves it). Restaurant pages: median 10.5 KB, range 6.6 to 19.4 KB. |
| Sitemaps | `docs/sitemap-eats.xml` lists all 1,042 URLs. `docs/sitemap-index.xml` gained a third entry (it still lists `sitemap.xml` and `sitemap-buildings.xml`). `docs/robots.txt` gained a `Sitemap:` line, matching the building pages; see the robots.txt caveat in that file. |
| Entry link | One footer link in `docs/eats/index.html` ("Browse restaurant pages by borough and cuisine" → `r/`), so crawlers can reach the pages without the sitemap. This is the only change to the live app. The app's tests still pass (`test_grades.js`: 18/18; `test_page.js --no-live`: all pass). |

Files in `bots/eats_pages/`:

| File | What |
|---|---|
| `build.py` | `select`, `fetch`, `render` and `all` stages (Python standard library, plus `node`) |
| `compute.js` | Loads the app's own `docs/eats/grades.js` and `violations.js` and computes each page's data with them. The static page and the app's `?camis=` view therefore use one grade algorithm: the DOHMH "most recent card grade A/B/C/P/Z" rule, the score bands and the Z/P/N labels, plus the same notes (re-inspection pending, later ungraded inspection, score/grade mismatch, closure). |
| `pilot.json` | The selected set, with the reason each restaurant was picked. Commit it, because it is the stable list that refreshes rebuild. |
| `last_known.json.gz` | The last computed data for every listed restaurant (290 KB). Commit it, because it lets a page survive the restaurant leaving the data. |
| `test_pages.js` | Tests; see below. |
| `eats_pages.yml` | Draft weekly workflow. **Not installed.** |
| `.cache/` | Raw rows (gitignored) |

## How the 1,000 were picked

The source is NYC Open Data `43nn-pn8j`, with data as of Nov 13, 2026 (max `record_date`). There is no search-volume data, so the selection uses proxies for "likely to be searched".

1. **Pool.** Restaurants in the five boroughs inspected within the 18 months before the data date: 25,484 of 27,443 inspected establishments.
2. **Named picks (257).** These come from a hand-written list in `build.py` (`NAMED`):
   - **Chains (about 55 names).** Examples: Shake Shack, Joe's Pizza, Starbucks, McDonald's, Junior's, Xi'an Famous Foods, Halal Guys. Each chain gets one location per borough. The flagship proxy is the location with the longest record in the data (earliest inspection), because the data has no "flagship" field.
   - **Landmarks (about 80 names).** Examples: Katz's, Peter Luger, Russ & Daughters, Di Fara, Lombardi's, Le Bernardin, Tavern on the Green, L&B Spumoni Gardens, Denino's, Sylvia's. Each landmark gets up to 3 active locations matching the name. Some generic names (Mike's Deli, Tom's Restaurant) also matched other places with the same name. Those are still real, active restaurants.
3. **Fill each borough's quota.** The quotas are Manhattan 390, Brooklyn 250, Queens 220, Bronx 90 and Staten Island 50. They are roughly proportional to each borough's restaurant count, with the Bronx and Staten Island rounded up. The fill draws from restaurants with records in at least 3 calendar years, alternating between two lists:
   - (a) the most distinct inspection dates (the "most inspection records over several years" proxy);
   - (b) the longest record in the data (earliest inspection).
4. **Grade caps.** List (a) alone is heavily skewed, because restaurants that score badly get re-inspected more often: only 59% of its picks had an A. A pilot built that way would read like a list of low grades, which is the "worst list" problem by another route. So within each borough, no grade may exceed its share among that borough's active restaurants, plus one slot. Named picks are exempt but count toward the caps.

| Current grade mix | A | B | Grade Pending | C | Not yet graded |
|---|---|---|---|---|---|
| Pilot (at selection) | 82.0% | 8.2% | 5.1% | 2.4% | 2.3% |
| All active restaurants with a card grade | 85.9% | 6.5% | 5.7% | 1.9% | n/a |

**Better signal later:** after a few weeks live, use Search Console impressions for `eats/` and `eats/r/` queries (and the app's `?camis=` traffic, if logging is ever added) to replace the proxies. `build.py select --reselect` adds restaurants without dropping any.

## What each restaurant page shows

- **Name, address, borough, ZIP and cuisine.** These come from the restaurant's newest row, normalized by `grades.js` (`identity`, `tidyName`).
- **The current grade, with a badge and its label.** Z, P and N show their code. The page also gives the date the grade was issued, the score on that inspection, DOHMH's meaning of the grade (`gradeExplainer`), and any notes `grades.js` raises. For example, Katz's on Houston St shows an A from Feb 25, 2025, then a note that a 20-point initial inspection on Jul 13, 2026 is ungraded and awaiting re-inspection.
- **"Data as of" date,** plus the number of inspections on record and the most recent inspection date.
- **One CTA, "Full history and share card",** linking to `../?camis={camis}`.
- **The last 3 inspections.** Each one shows:
  - the date, the score with its band ("27 points (B range)"), the inspection type and the grade issued (or "Not graded");
  - the violation and critical counts, and the action recorded;
  - each violation's official code, its critical flag, our plain-English summary from `violations.js`, and the official DOHMH text, labeled.
- **"How NYC restaurant grades work".** This covers unannounced inspections at least once a year, the 0-13/14-27/28+ bands, the "initial graded only if A, then re-inspection" rule, Z/P/N and OATH hearings. It also gives the snapshot caveat: "One inspection is a snapshot of one visit on one day … not a rating of the food or service". It cites DOHMH's *How We Score and Grade* PDF, the Letter Grading page and the dataset documentation. These were the same sources the app verified on Nov 14, 2026.
- **Browse links** to the borough page and the cuisine page, and up to 6 other listed restaurants in the same ZIP (alphabetical).
- **Footer** with the data source, "not affiliated with DOHMH", and the ABCEats link.
- **Head tags:** canonical (production URL), title ("{Name} Health Grade and Inspections, {address}, {borough}"; the address disambiguates chain locations), meta description (grade, issue date and data date), Open Graph title, description and URL, and **BreadcrumbList JSON-LD only**. There is no Restaurant, LocalBusiness, Review, Rating or AggregateRating markup, because a health grade is not a review rating and must not appear as stars.

Index pages list restaurants **alphabetically** (cuisine pages group them by borough first), with the current grade label as plain text. There is no sorting by grade or score, no counts by grade, and no "worst" or "best". Each index says it is a selection and links to search for everything else.

## Neutrality and privacy

- **Wording.** The pages use DOHMH's terms and our neutral paraphrases. A test fails the build on ranking or sensational words (worst, best, dirtiest, avoid, ranked, top N and similar) anywhere on the pages, excluding the official DOHMH text.
- **No personal names.** The generator selects only establishment fields: CAMIS, DBA, address, cuisine, and inspection, violation and grade fields. It never requests phone numbers or coordinates. The dataset holds no inspector or owner names.
  - The DBA is the registered business name. Some include a person's name (for example a chocolatier named after its founder). That is the business's public trading name, and it is the subject of the page.
  - The violation text is DOHMH's standard code wording, not free text.

## Google's guidance, and how these pages stay on the right side

Google's spam policies (https://developers.google.com/search/docs/essentials/spam-policies) name two risks for a project like this:

- **Doorway abuse.** These are pages made to rank for many similar queries that funnel users to an intermediate or other destination, without being useful themselves. Examples include many near-identical pages that differ only by city or name.
- **Scaled content abuse.** This is many pages generated mainly to manipulate rankings rather than help people, however they are made (templates, AI, scraping). Little-value pages built from public data are a named example.

Google's "helpful, reliable, people-first content" guidance asks whether a page would satisfy someone who arrived directly, without further clicks.

How the pilot addresses each point:

1. **Each page answers the query by itself.**
   - Someone searching "Junior's health grade" gets the current grade, its date and score, what the grade means, and the last three inspections with every violation explained.
   - The CTA adds depth (full history, chart, share card). It is not required to get the answer. That is the opposite of a doorway, which withholds the answer to force a click.
2. **The data is unique per page.** The grade, dates, scores, violations and notes are different for every restaurant. Even two locations of one chain differ in substance. The template text (the grading note and the footer) is a small part of each page.
3. **The pages add something beyond the raw data:**
   - DOHMH's current-grade rule applied correctly (the open data has no "current grade" column);
   - explanations of pending re-inspections and score/grade mismatches;
   - plain-English violations;
   - grade-code meanings.
4. **The set is limited and selective.** It holds 1,000 restaurants, not all 31,500. They were chosen as likely to be searched, with a grade mix close to the city's, and there are no thin pages: every page has at least one real inspection.
5. **Pages are refreshed and honest about their age.** Each shows "data as of", and a weekly rebuild keeps the grade current. A stale health grade would be actively unhelpful.
6. **No rating markup and no manipulative structure.** The markup is BreadcrumbList only. Cuisine pages exist only where at least 5 restaurants share the cuisine (no one-item lists). Internal links are human navigation (borough, cuisine, same ZIP).
7. **Watch for signs of trouble.** In Search Console, check indexed vs. "Crawled, currently not indexed" for `eats/r/`.
   - If most pages stay unindexed after 6 to 8 weeks, Google sees them as low value. Improve them (for example a mini score history, or the neighborhood name from `nta`) before scaling past 1,000.
   - Do not scale up until the pilot pages index and earn clicks.

## Refresh plan

The draft workflow is `bots/eats_pages/eats_pages.yml` (copy it to `.github/workflows/` to enable it).

- **When:** weekly, Tuesday 10:17 UTC.
- **Steps:** `build.py all` refetches every pilot restaurant's rows, recomputes with the app's current `grades.js` and `violations.js`, and re-renders all pages, indexes and sitemaps. It then commits `docs/eats/r`, the sitemaps, `pilot.json` and `last_known.json.gz`.
- **Stable set:** `pilot.json` is not reselected on a schedule. Run `build.py all --reselect` by hand to add restaurants. Reselection merges and never drops.
- **Pages are never deleted.** A restaurant is marked **"Closed or no recent inspection"** when either:
  - it is gone from the open data, in which case its page renders from `last_known.json.gz`; or
  - its latest inspection is more than 18 months before the data date (DOHMH inspects open restaurants at least once a year).

  The page then shows a status box ("may have closed, moved or changed its permit; the information below is the last on record"), the heading "Last grade on record" and a status-specific meta description. The index lists show the same status. If the restaurant has left the data, the CTA becomes "Search current restaurants" (`../`), because `?camis=` would come back empty. If it later reappears with new inspections, the page returns to normal automatically. A test run that removed Katz's rows from the cache produced exactly this.
- **Closures by DOHMH** (a temporary closure order) are not treated as "closed". The existing `grades.js` closure note explains them.
- **Guards in the workflow:**
  - at least 1,000 restaurant pages;
  - no more than a quarter of them marked closed, since a mass "closed" result means a bad fetch;
  - the sitemap root URL present.

  If the API fails, `build.py` raises and nothing is committed.
- **New violation codes:** add summaries to `docs/eats/violations.js`. Both the app and the pages pick them up on the next build.

## Tests

Run: `NODE_PATH=/opt/npm-tools/node_modules node bots/eats_pages/test_pages.js <shot dir> [--no-live]`. All pass, both with and without `--no-live`.

- **Link check.** Every `href` and `src` on all 1,042 generated pages, plus every sitemap URL, was requested from a local server: 2,045 unique internal URLs, all 200, including every `../?camis=` CTA. The sitemap covers every generated file, and `sitemap-index.xml` lists all three sitemaps.
- **Site-wide guards:** no ranking or sensational words, no Restaurant, Review or Rating JSON-LD, no images.
- **Playwright at 390x844, five pages:**
  - Katz's (A, with a pending re-inspection note)
  - Junior's (Z)
  - Bedstuy Mike's Pizza (C)
  - Scorpion Bar (N)
  - Shake Shack, Staten Island (A)

  Each page passed these checks:
  - HTTP 200 and no horizontal scroll;
  - name, badge and label shown;
  - title, description and canonical present;
  - exactly one valid BreadcrumbList;
  - the CTA text and `../?camis=` href, at full width;
  - 1 to 3 inspections, with a code on every violation;
  - "data as of", plus the grading note with its nyc.gov citation and the snapshot caveat;
  - no external requests and no JS errors.

  Three index pages were also checked at 390px.
- **Live smoke test:** clicking the CTA on Katz's page opened the app, which loaded "Katz's Delicatessen" from NYC Open Data.
- **Visual review** of the Junior's page at 390px: the layout, badge, CTA and violation cards read cleanly. One issue was found and fixed: the breadcrumb had lost its 16px gutter.

## Before launch

- [ ] Commit `bots/eats_pages/` (except `.cache/`), `docs/eats/r/`, `docs/sitemap-eats.xml`, `docs/sitemap-index.xml`, `docs/robots.txt` and the one-line footer change in `docs/eats/index.html`.
- [ ] Submit `sitemap-index.xml` (or `sitemap-eats.xml`) in Search Console.
- [ ] Install `eats_pages.yml` if the pages should stay current. Without it, grades go stale within weeks.
- [ ] Optionally add a link to `eats/r/` from `docs/index.html` or `docs/sitemap.xml`.

## Expansion to 6,000 (Nov 16, 2026)

Grown from 1,000 to **6,000 restaurant pages**, plus hub pages. Data as of Nov 13, 2026 (unchanged; DOHMH had not published newer rows). Nothing committed or pushed.

**Caveat from the pilot plan above:** the pilot said not to scale until the 1,000 pages index and earn clicks. This expansion was requested before that signal exists. Watch "Crawled, currently not indexed" for `eats/r/` in Search Console; if most new pages stay unindexed after 6 to 8 weeks, stop growing and improve the pages.

### How the 5,000 new restaurants were picked (`build.py select --target 6000`, `select_expand`)

Every input is a count in the open data. No popularity number was invented.

1. **Pool:** in the five boroughs, inspected within 18 months of the data date, a valid 5-digit ZIP, and a current letter grade A, B or C (latest card grade, the `grades.js` rule). 22,018 restaurants.
2. **Neighborhood density:** each ZIP gets slots in proportion to (pool restaurants in the ZIP)^1.2, so denser restaurant areas get a larger share. ZIPs with 8 or more pool restaurants get at least 5 slots, so each can have a useful ZIP page. The 1,000 pilot restaurants stay and count toward their ZIP's slots.
3. **Brand recognition, within each ZIP:** slots alternate between
   - (a) names in the `NAMED` chain/landmark list, then multi-location names (the same normalized trading name on 3 or more active permits, larger first). One location per name per ZIP, at most 40 per named chain and 25 per other name. Generic names (Cafe, Deli, Pizza and similar) and stadium stands don't count as brands. Some shared names are common names, not chains (for example "Great Wall"). They are still real, active, graded restaurants.
   - (b) single-location restaurants with the longest record in the data (earliest inspection).
4. Selection is filled round-robin across ZIPs, densest first. `pilot.json` records each pick's reason and ZIP.

Result for the 5,000 new picks: 2,550 single-location by longest record, 1,689 multi-location names, 760 named chains and 1 landmark. By borough: Manhattan 2,113, Brooklyn 1,290, Queens 1,084, Bronx 381 and Staten Island 132. By grade: A 4,638, B 306 and C 56. The pool is A 90.2%, B 7.6%, C 2.2%, so the picks lean slightly toward A, because the longest-record proxy favors established places.

### What changed on the pages

- **Restaurant pages:**
  - a prominent "Data as of" line under the address;
  - an "Earlier inspections" list (date, score and grade for up to 10 inspections before the 3 shown in full);
  - Browse links to the ZIP page and the cuisine-by-borough page;
  - the "Also in ZIP" heading links to the ZIP page.
- **Titles and descriptions now follow the audit limits.**
  - Titles: when the long forms don't fit in 65 characters, the address uses USPS abbreviations (W 56 St). A title under 50 gets the ZIP. 99 titles are still over 65, all because the restaurant name itself is long.
  - Descriptions: a shorter form is used past 160 characters.
- **New hubs:**
  - `docs/eats/z/{zip}.html`: 184 ZIP pages for ZIPs with 3 or more listed restaurants. Each lists restaurants alphabetically with their grade, the cuisines in the ZIP, and nearby ZIPs in the same borough.
  - `r/cuisine/{cuisine}/{borough}.html`: 111 pages for cuisine-borough pairs with 10 or more restaurants.
- **Restructured index pages:**
  - Borough pages now link ZIPs and cuisines and list only restaurants in ZIPs too small for their own page. Listing all 2,400+ Manhattan restaurants would have made one page about 800 KB.
  - Cuisine pages link their borough pages and list small groups inline.
  - `r/index.html` links every ZIP page.
  - Every restaurant page is within 2 clicks of `r/`.
- **Sitemaps:** `docs/sitemap-eats.xml` has 6,363 URLs. Past 45,000 URLs the builder writes `sitemap-eats-2.xml` and onward, and adds or updates only those entries in `sitemap-index.xml`.
- `bots/seo_audit/audit.py` gained an `eats_zip` set for `docs/eats/z/`.
- In `test_pages.js`:
  - the test now checks `eats/z/`, all eats sitemaps, and a ZIP page and a cuisine-by-borough page at 390px;
  - the wording guard now skips restaurant trading names such as "Best Deli".

### Weekly rebuild

Unchanged: `python bots/eats_pages/build.py all`. A fetch of 6,000 restaurants takes about 3 minutes and resumes the same day if interrupted (`.cache/parts/`).

In `eats_pages.yml`:
- the page guard is now at least 6,000;
- `docs/eats/z/` must hold at least 150 pages;
- the commit step adds `docs/eats/z/` and `docs/sitemap-eats*.xml`;
- the timeout is 45 minutes.

### Size

- `docs/eats/r/` holds 63 MB of HTML (11.1 MB before). Restaurant pages have a median of 10.6 KB.
- `docs/eats/z/` is 1.6 MB.
- `last_known.json.gz` is 1.7 MB.
- `sitemap-eats.xml` is 0.7 MB.
- That is about 56 MB more in the working tree. Compressed (as git stores it, and as Pages serves it) it is about 5.5 MB.
