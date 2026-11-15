# Chicago Restaurant Report Card: notes

Page: `docs/chi-eats/` (served at https://lanternlab2027.github.io/lab/chi-eats/). Built Nov 15, 2026. Not committed.

STATUS: done. Unit tests (17) and Playwright fixture tests at 390px and 1280px pass. **The live smoke could not run here: data.cityofchicago.org is blocked from this session.** See "Before launch".

## Research (Nov 15, 2026)

- data.cityofchicago.org is BLOCKED from this session (shell curl: proxy 403 on CONNECT; Playwright: ERR_TUNNEL_CONNECTION_FAILED; WebFetch: not on allowlist). So the API, CORS and field names could NOT be checked live from here.
- Dataset id 4ijn-s7e5 confirmed via catalog.data.gov ("Food Inspections"; identifier https://data.cityofchicago.org/api/views/4ijn-s7e5; landing https://data.cityofchicago.org/d/4ijn-s7e5; modified 2026-11-11). Covers Jan 1, 2010 to present; procedure change 7/1/2018; may contain duplicates; findings reflect the time of inspection.
- Columns (from third-party analysis, not live): Inspection ID, DBA Name, AKA Name, License #, Facility Type, Risk, Address, City, State, Zip, Inspection Date, Inspection Type, Results, Violations, Latitude, Longitude, Location. Violations packed as `NN. TITLE - Comments: ...` joined by ` | `.
- Result values seen: Pass, Pass w/ Conditions, Fail, Out of Business, No Entry, Not Ready, Business Not Located. Risk values: Risk 1 (High), Risk 2 (Medium), Risk 3 (Low), All.

### Official definitions found
- CDPH "Food Protection Program Frequently Asked Questions" (Inspection_FAQ_2019.pdf, chicago.gov): Pass = no priority or priority foundation violations; Pass with Conditions = priority/PF violations found but corrected onsite; Fail = priority/PF violation(s) that could not be corrected during the inspection. Summary report must be posted. Results usually posted within 2-3 weeks.
- CDPH "Food Protection Services and Health Code Enforcement" (FoodProtServices-HlthCodeEnforcement-Oct2021.pdf): same 3 results; risk tiers from FDA model by type of food and how it is prepared; risk assessment at every full (annual) inspection; inspection types canvass/complaint/re-inspection/license; priority (critical) / priority foundation (serious) / core (minor) with correction windows.
- CDPH "Understand Health Code Requirements for Food Establishments" page: risk 1/2/3; risk 1 inspected twice per year, risk 2 once per year, risk 3 every other year.
- CDPH "Restaurant and Food Service Inspection Reports" page: annual inspections, complaint inspections, results posted online and updated weekly, reflect findings at time of inspection; violations are allegations that can be disputed at the Department of Administrative Hearings.
- NOT found: an official definition of Out of Business / No Entry / Not Ready / Business Not Located (the dataset's data dictionary PDF on data.cityofchicago.org was unreachable). The page says so and describes them only by their plain labels.

## Before launch (must do: never verified live)

1. Run `NODE_PATH=/opt/npm-tools/node_modules node bots/chi-eats/test_page.js <dir>` from a network that can reach data.cityofchicago.org. The live smoke searches "Lou Mitchell", checks `Access-Control-Allow-Origin: *`, opens the detail view and saves `card-live.png`. Here it prints `BLOCKED` and doesn't count as a failure.
2. Things the live run confirms, all assumed from third-party sources:
   - The SODA field names `inspection_id, dba_name, aka_name, license_, facility_type, risk, address, zip, inspection_date, inspection_type, results, violations`.
   - Whether `license_` is text or a number. `soda.js` compares it as text, and on an HTTP 400 for a `license_` query it switches once to numeric literals (`ChiSoda.run`), so both work.
   - The `" | "` separator and `NN. TITLE - Comments:` format in `violations`.
   - The post-2018 violation titles that `violations.js` matches. These were written from memory and checked against my list of the 63 titles, not live data.
   - CORS. Socrata documents it; the NYC sister app saw `*` live on the same platform.
3. Create the Kit tag and custom field `restaurant_license`, then replace `TAGID_CHIEATS` in `docs/chi-eats/kit.js`. The signup box stays hidden until then. No sender bot exists yet.
4. `docs/chi-eats/` and `bots/chi-eats/` are already listed in `.git/info/exclude`. Remove those lines before committing, or git won't see the files. Add an Apps card on the hub page and a sitemap entry.

## Files

| File | What |
|---|---|
| `docs/chi-eats/index.html` | Markup and CSS (system fonts, light/dark), SEO/OG/JSON-LD. The "How Chicago restaurant inspections work" section has 5 citations. Footer has the disclaimer and links to `../`, `../apps/` and `../eats/`. The CSP allows only `data.cityofchicago.org` and `api.convertkit.com`. |
| `docs/chi-eats/results.js` | Pure logic (UMD): result normalisation and definitions, risk parsing and explainer, violation splitting, severity taken from the inspector's comment, grouping and dedupe, summary and notes, the factual sentence. |
| `docs/chi-eats/soda.js` | SoQL builders: name (DBA or AKA), address, full-text fallback, chips, detail by license or by DBA+address, newest date. Also fetch, the 429 message and the license-literal flip. |
| `docs/chi-eats/violations.js` | Our plain-English paraphrases, matched on title wording so they cover pre- and post-2018 numbering. An unknown title shows only the official text. |
| `docs/chi-eats/card.js` | The 1080x1350 "Before you go" canvas card. |
| `docs/chi-eats/app.js` | UI: search, results with latest-result chips, detail, a results-over-time strip, history, share/save/copy, `?ref=` passthrough (same scheme as names), URL state (`?q=`, `?license=`, `?dba=&addr=`). |
| `docs/chi-eats/kit.js` | Optional Kit signup. The key is copied from docs/eats/kit.js; the tag placeholder is `TAGID_CHIEATS`. |
| `docs/chi-eats/og.png` | 1200x630, made by `bots/chi-eats/make_og.js`. |
| `bots/chi-eats/fixtures.js` | Synthetic rows: Pass, Pass w/ Conditions (AKA differs from DBA), Fail, Out of Business, No Entry, pre-2018, a long name, no license, and a duplicate inspection. |
| `bots/chi-eats/test_results.js` | `node --test bots/chi-eats/test_results.js` (17 pass) |
| `bots/chi-eats/test_page.js` | Playwright at 390 and 1280 against fixtures, plus a placeholder-tag test, a 429 test and the live smoke. |

## Logic choices

- **No letter grade.** The headline is the newest record as a fact: "Passed its last inspection on Oct 2, 2026." A test asserts there is no "Grade A/B/C" on the page.
- **Non-results.** When the newest record is Out of Business, No Entry, Not Ready or Business Not Located, the sentence quotes the label ("had its last city visit on … recorded as “No Entry”"). A note gives the last completed inspection, and the card shows it too.
- **Risk** is always shown with "reflects the kind of food served and how it is prepared, not how the place performed" and the CDPH inspection frequency.
- **Severity tags** (Priority / Priority foundation / Core) appear only when the inspector's comment names them. Earlier "previous priority violation" mentions are ignored.
- **Notes.**
  - A Fail as the latest record gets a re-inspection note citing CDPH: re-inspection after time to correct, and results usually posted within 2-3 weeks.
  - A last completed inspection before July 1, 2018 gets an old-rules note.
  - A last completed inspection more than 2 years old gets a stale note.
- **Identity.** One listing per license (a new owner means a new license, so a separate listing). The display name is the AKA when it differs from the DBA, with "Licensed as <DBA>" shown.
- **Fairness.** No rankings or lists. A snapshot caveat appears on the page and the card. The footer disclaimer says "nothing here is a ranking".
- **ZIP filter dropped.** The zip field's type was unverifiable, so search uses name or address only.
- **"Data through"** comes from `max(inspection_date)` over the dataset, because Chicago has no record_date.

## Live check (Nov 15, 2026)
Verified from the published page in a real browser: CORS works from lanternlab2027.github.io, field names match (license_ is text), violations use `NN. TITLE - Comments: …` joined by ` | `. Search "lou mitchell" and the detail for license 30743 render correctly; the dataset reports inspections through Nov 13, 2026. Kit tag chi-eats = 25916705, custom field restaurant_license created.
