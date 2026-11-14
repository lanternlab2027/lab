# NYC Restaurant Report Card: notes

Page: `docs/eats/` (served at https://lanternlab2027.github.io/lab/eats/). Built and tested Nov 14, 2026. Not committed.

**Heads-up:** `docs/eats/` and `bots/eats/` are already listed in `.git/info/exclude`. Remove those two lines before committing, or git won't see the files. The hub page (`docs/index.html`) and `docs/sitemap.xml` were **not** updated; add an Apps card and a sitemap URL when this ships.

## Files

| File | What |
|---|---|
| `docs/eats/index.html` | Markup, CSS (system fonts, light/dark), SEO/OG/JSON-LD, "How grades work" with citations, disclaimer, footer link to `../`. CSP allows only `data.cityofnewyork.us` and `api.convertkit.com`. |
| `docs/eats/grades.js` | Pure logic (UMD): score bands, inspection grouping, current grade, notes, timeline, headline. |
| `docs/eats/soda.js` | SoQL query builders + fetch with timeout and 429 handling. |
| `docs/eats/violations.js` | Our plain-English summaries per violation code (+ family fallback for 15/16/19/20/22/28). |
| `docs/eats/card.js` | 1080x1350 canvas share card. |
| `docs/eats/app.js` | UI: search, results, detail, SVG score timeline, share/copy, URL state (`?q=&boro=&zip=` and `?camis=`). |
| `docs/eats/kit.js` | Optional Kit signup. |
| `docs/eats/og.png` | 1200x630, made by `bots/eats/make_og.js` (made-up restaurant). |
| `bots/eats/fixtures.js` | 7 synthetic restaurants covering A, Z, P, N, not-yet-inspected, newer ungraded initial, score/grade mismatch, closure. |
| `bots/eats/test_grades.js` | Unit tests: `node --test bots/eats/test_grades.js` (18 pass). |
| `bots/eats/test_page.js` | Playwright: `NODE_PATH=/opt/npm-tools/node_modules node bots/eats/test_page.js <shot dir> [--no-live]`. 390px and 1280px with Socrata routed to fixtures, Kit stubbed, plus one live smoke query. All pass. |

No third-party libraries are used, so nothing is vendored. No analytics or other external requests (the test asserts no other hosts are contacted).

## Data: NYC Open Data `43nn-pn8j`

"DOHMH New York City Restaurant Inspection Results", https://data.cityofnewyork.us/d/43nn-pn8j. Checked live Nov 14, 2026: 294,857 rows, 31,502 CAMIS, rows updated Nov 13, 2026 (max `record_date` 2026-11-13).

Fields verified live: `camis, dba, boro, building, street, zipcode, phone, cuisine_description, inspection_date, action, violation_code, violation_description, critical_flag, score, grade, grade_date, record_date, inspection_type, latitude, longitude, community_board, council_district, census_tract, bin, bbl, nta, location`.

Live values: grade A/B/C/N/P/Z (or null); critical_flag Critical / Not Critical / Not Applicable; boro includes `"0"` for missing; 4,059 rows with inspection_date 1900-01-01 (not yet inspected); `grade_date` always equals `inspection_date` when a grade is present.

**CORS:** `curl -I -H "Origin: https://lanternlab2027.github.io"` returns `Access-Control-Allow-Origin: *`. The Playwright live smoke also fetched from `http://127.0.0.1` origin and saw `*` on every response.

**Queries (anonymous, no app token):**
- Search, by name: `$select=camis,dba,boro,building,street,zipcode,cuisine_description,max(inspection_date) as last`, `$group` on the same, `$where` of `upper(dba) like '%TOKEN%'` per word (apostrophes become `%`, so `joes` matches `JOE'S`), optional `boro=`/`zipcode=`, `$order=last DESC`, `$limit=40`.
- By address (input starts with a house number): `building='205' AND upper(street) like '%HOUSTON%'` (direction/suffix words dropped, ordinals matched by digits). Falls back to name search, then to `$q` full text.
- Result grade chips: one query `camis in(...) AND grade in('A','B','C','P','Z')`, grouped.
- Detail: `camis='X'`, `$order=inspection_date DESC`, `$limit=2000`.
- Typical latency 0.1 to 1.5 s.

## Grading rules (verified on nyc.gov, Nov 14, 2026)

| Rule | Source |
|---|---|
| A = 0-13, B = 14-27, C = 28+ points; lower is better | "How We Score and Grade" PDF https://www.nyc.gov/assets/doh/downloads/pdf/rii/restaurant-grading-faq.pdf (linked as "How We Score and Grade" from https://www.nyc.gov/site/doh/business/food-operators/letter-grading-for-restaurants.page, which also states the bands). PDF says 3/2012, modified Mar 2022. |
| Two chances per cycle: initial graded only if A; otherwise unannounced re-inspection, typically within a month, graded A/B/C | same PDF |
| B or C on re-inspection gets a grade card and a Grade Pending card; post either until OATH hearing | same PDF; also DOHMH "About" doc |
| Not graded: initial scoring 14+, monitoring, new restaurants not yet open, reopening after closure, some complaint inspections, pre-July 27 2010 | same PDF |
| Until graded: "Not Yet Graded" | same PDF |
| Public health hazard min 7 pts, critical min 5, general min 2; condition levels 1-5 | same PDF |
| Codes: N = Not Yet Graded, Z = Grade Pending, P = Grade Pending issued on re-opening following an initial inspection that resulted in a closure | dataset column description for GRADE |
| Critical = "most likely to contribute to food-borne illness" | dataset column description for CRITICAL FLAG |
| Current grade = most recent inspection with GRADE in A, B, C, P, Z; re-inspection at least 7 days after initial; codes 15-22 don't count toward score; compliance inspections not graded; scores updated after adjudication, dismissed violations removed; score/grade can disagree; 1900-01-01 = not yet inspected | "About Restaurant Inspection Data on NYC Open Data" (dataset attachment `About_NYC_Restaurant_Inspection_Data_on_NYC_OpenData_050222.docx`) |
| "Unannounced inspections at least once a year" | https://www.nyc.gov/site/doh/services/restaurant-grades.page |

ABCEats (`a816-health.nyc.gov`) was blocked by this session's proxy (403), so it was not checked directly. The page links to the nyc.gov landing page for it instead.

## Logic choices

- **Current grade** follows the DOHMH algorithm above. No card grade on record means N ("Not Yet Graded").
- **Notes on the detail view:**
  - When a newer gradable initial inspection scored 14+ (re-inspection pending), a note explains that the grade shown is from the last graded inspection. A real example is Katz's: an A on 2025-02-25, then a 20-point initial on 2026-07-13.
  - Other notes cover a later ungraded inspection, a score/grade mismatch and a closure that is the latest record.
- **Share card:** the score shown is the score of the *graded* inspection, not the latest inspection. The latest inspection can be a 0-point task-force visit, which would mislead.
- **Fairness:** there are no rankings, lists or "worst" framing.
  - Each restaurant has neutral copy, the caveat "one inspection on one day" (also on the card), and a link to the official record.
  - Plain-English summaries are labeled as our paraphrase, and the official text is always shown.

## Kit

- `kit.js` copies the public `api_key` from `docs/ll97/index.html`.
- Tag is the placeholder `TAGID_EATS`. While it isn't numeric, the signup box stays hidden (same as santa).
- Sends `fields: {restaurant_camis}` only. **Create the custom field `restaurant_camis` in Kit and replace `TAGID_EATS` before launch.**
- Limitation: Kit custom fields hold one value per subscriber, so signing up for a second restaurant overwrites the first CAMIS. A sender bot that checks for grade changes (diff the current grade per CAMIS) still needs to be built.
- Tests set the tag with `window.EATS_KIT_TAG_TEST`.

## Refresh

None needed. The browser queries live data, and "data as of" comes from `record_date`. If DOHMH adds violation codes, unknown codes show only the official text (family fallback where possible). Add a summary to `violations.js` for those.
