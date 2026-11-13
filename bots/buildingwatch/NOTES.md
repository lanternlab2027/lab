# NYC Small-Building Watch: build notes

Prototype status as of 2026-11-13. Everything below was checked against the live API that day.

## Files

| File | What it is |
|---|---|
| `watch.py` | Daily watcher (stdlib only). `--buildings`, `--state`, `--since`, `--no-save`, `--email`, `--resolve`, `--workers` |
| `buildings.txt` | Input list: BBL or `address, borough` per line, optional `| label` |
| `state.json` | Per-building `last_seen` date and seen-record keys (pruned after 180 days) |
| `sample_alerts.md` / `.json` | 30-day backfill for 5 real buildings (151 alerts) |
| `lookup.html` | Static "Look up your building" page; calls SODA from the browser |
| `index.html` | Sales page |
| `watch.yml` | Draft GitHub Actions workflow (goes in `.github/workflows/`) |

## Datasets (data.cityofnewyork.us, SODA `/resource/<id>.json`)

| Purpose | ID | Building key | "New" date column (format) | Record ID |
|---|---|---|---|---|
| PLUTO (address→BBL, units, class) | `64uk-42ks` | `bbl` (stored as `3010730066.00000000`, `bbl='3010730066'` matches), `address`, `borough` (MN/BX/BK/QN/SI) | n/a | n/a |
| Building Footprints (BBL→BINs) | `5zhs-2jue` | `base_bbl` / `mappluto_bbl` → `bin` | n/a | n/a |
| HPD Multiple Dwelling Registrations | `tesw-yqqr` | `boroid`,`block`,`lot` (unpadded), `bin` | `registrationenddate` | `registrationid` |
| HPD violations | `wvxf-dwi5` | `bbl` | `novissueddate` (ISO); fallback `inspectiondate` | `violationid` |
| HPD complaints & problems | `ygpa-z7cr` | `bbl` | `received_date` (ISO) | `problem_id` |
| DOB violations | `3h2n-5cm9` | `bin` | `issue_date` (TEXT `YYYYMMDD`, has junk like `Y9990120`) | `isn_dob_bis_viol` |
| DOB complaints received | `eabe-havv` | `bin` | `date_entered` (TEXT `MM/DD/YYYY`, so filtered client-side) | `complaint_number` |
| DOB ECB violations | `6bgk-3dad` | `bin` | `issue_date` (TEXT `YYYYMMDD`) | `ecb_violation_number` |
| OATH Hearings Division case status | `jz4z-kudi` | `violation_location_borough` (full name) + `violation_location_block_no` (5-digit, zero-padded) + `violation_location_lot_no` (4-digit) | `violation_date` (ISO); `hearing_date` | `ticket_number` |
| 311 service requests (2020+) | `erm2-nwe9` | `bbl` | `created_date` (ISO) | `unique_key` |

Owner/contact names: HPD registration *contacts* live in a separate dataset (`feu5-w2e2`), which this code never queries. PLUTO's owner-name column and OATH's respondent name/address columns are never selected or output. PLUTO uses an explicit `$select` for this reason.

## Query patterns

```
# DOB text dates: lexical range + an upper bound to drop junk values
$where=bin in ('3025035') AND issue_date >= '20261015' AND issue_date < '29991231'

# OATH by tax lot (street names are often blank since May 2026)
$where=violation_location_borough='BROOKLYN' AND violation_location_block_no='01073'
       AND violation_location_lot_no='0066' AND violation_date >= '2026-10-15'

# 311, without duplicating HPD/DOB complaints and skipping NYPD (mostly noise/parking about people)
$where=bbl='3010730066' AND created_date >= '2026-10-15' AND agency not in ('HPD','DOB','NYPD')
```

Each query takes roughly 0.4-12 s. About 10 per building, so the script runs 4 buildings in parallel (`--workers`). Five buildings take about 70 s. Set `SOCRATA_APP_TOKEN` before scaling up. Without a token, parallel browser requests sometimes got a 503, so `lookup.html` retries with backoff.

## Matching logic

1. **Address → BBL:** normalize the street (`W`→`WEST`, `Pl`→`PLACE`, `139th`→`139`), then match exactly on PLUTO `address` + `borough`. If that fails, use HPD registrations with the low/high house-number range. A borough name, common Queens neighborhood name or ZIP is required. A 10-digit BBL skips all of this.
2. **BBL → BINs:** Building Footprints (`base_bbl` or `mappluto_bbl`) plus the HPD registration BIN. Placeholder BINs (`x000000`) are dropped. A lot can have several BINs (514 Hudson has 3).
3. **"New":** `since = last_seen − 14 days overlap` (configurable), and items are deduped by `source|record id` in `state.json`. The overlap catches records that are posted late with older dates. The first run looks back 30 days. `--since` ignores state and re-reports everything. Use it with `--no-save` for tests.
4. **ECB vs OATH duplicates:** DOB summonses show up in both datasets. OATH ticket numbers carry a leading `0`, so the code compares `lstrip('0')` and reports the ECB version, which has the severity class.
5. **Generated alerts (not dataset rows):** OATH hearings in the next 14 days, OATH cases now `DEFAULTED` or `DOCKETED`, the bedbug filing window (3+ residential units, shown from Nov 1 through Dec 31), and HPD registration expired, expiring within 45 days, or missing.

## Accuracy guardrails in the copy

- Every output includes "Informational only, not legal advice" and a note that the data can lag.
- Complaints are labeled "not a violation".
- ECB penalty amounts are called the "amount listed", not final while the case is pending.
- Default consequences use OATH's own wording: the respondent is found in violation "and a higher fine may be imposed".
- OATH items say the respondent may be a tenant or business at the lot, not the owner. In the sample, two DEFAULTED cases at 514 Hudson are DOHMH summonses that probably belong to a ground-floor food business.
- HPD deadlines come from the record's own correct-by and certify-by dates, not hard-coded class rules. They are hidden once a violation is closed.
- Bedbug rule details (Dec 1-31 window, Nov 1-Oct 31 period, corporate owners file online, tenant distribution) were checked on HPD's bedbugs page on 2026-11-13.

## Known gaps / to do

- **Link URLs not verified from here.** The proxy blocked nyc.gov and a810-bisweb. HPD and OATH page URLs came from web search results. The BIS deep links (`PropertyProfileOverviewServlet?bin=`, `ECBQueryByNumberServlet?ecbin=`) use the known BIS patterns but were not loaded. Click-test them before launch. HPD alerts link to the HPD Online home page, not a per-building page.
- **DOB complaint category codes:** only about 25 common codes are mapped to plain English. Codes such as 37, 2F, 1X, 2S and 6V show as raw codes. Disposition codes are not translated yet.
- **DOB NOW:** newer DOB NOW-era violations and summonses may be missing from the BIS-based `3h2n-5cm9`. ECB/OATH should still catch summonses. Check whether DOB NOW safety-violation datasets should be added (e.g. facade/boiler/elevator compliance).
- **OATH rows without block/lot** (about 18% of 2026 rows) are not matched. A fallback on house number + street, where present, is not implemented.
- **Status changes** are tracked only for OATH defaults and dockets. Changes to HPD/DOB violation status (closed, certified) are not reported.
- **Address parsing** is basic: no GeoSearch/Geoclient. `geosearch.planninglabs.nyc` was blocked by the sandbox proxy, so it is untested. It would be a good primary geocoder for the browser page if its CORS allows it.
- **Condos:** billing BBLs (lots 75xx) work for PLUTO and footprints, but HPD and OATH may record unit lots. This is untested.
- **1-2 family homes:** PLUTO-based units are fine, but the registration and bedbug rules only fire at 3+ units by design.
- **Email:** `send_email()` is a stub that writes to `outbox/`. Wire up Postmark, Resend or SES with `EMAIL_API_KEY`. There is no per-subscriber routing yet; the prototype sends one digest per run.
- **Sales-page claims to verify before launch:** competitor prices (SiteCompli ~$250/mo minimum, PBS Alert ~$9/bldg) came from the brief and were not checked. "Agencies don't email owners about new violations" should also be checked against any current DOB/HPD notification features.
- **lookup.html:** the logic was tested in Node 22 against the live API for all 5 buildings and a bad address. Socrata returns `Access-Control-Allow-Origin: *`, and the requests are simple GETs with no preflight. It has not been viewed in a real browser.

## Daily run on GitHub Actions

`watch.yml` runs at 11:17 UTC daily (plus manual dispatch with an optional `since` backfill). The steps:

1. Check out the repo.
2. Set up Python 3.12 (no pip installs).
3. Run `python watch.py --state state.json --email "$ALERT_EMAIL"`.
4. Upload `alerts.md` and `alerts.json` as an artifact.
5. Commit `state.json` back. This needs `permissions: contents: write`.

Secrets: `EMAIL_API_KEY`, `ALERT_EMAIL`, and optionally `SOCRATA_APP_TOKEN`.

For real subscribers, move `buildings.txt` and `state.json` into a small database (or one file per subscriber) and loop over subscribers. Make the repo private, since state holds subscriber building lists.
