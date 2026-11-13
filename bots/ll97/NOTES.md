# Energy Grade & LL97 Check: notes

Page: `docs/ll97/index.html` (single self-contained file, served at https://lanternlab2027.github.io/lab/ll97/).
Built and verified Nov 13, 2026. Not committed.

## What the page does

1. Resolves the input to a BBL and BIN:
   - a 10-digit BBL or a dashed BBL (`1-00835-0041`);
   - a 7-digit BIN, via Building Footprints `5zhs-2jue`;
   - an address, via Building Watch's resolver (PLUTO `64uk-42ks` exact match, then HPD registrations `tesw-yqqr`), with a new fallback to AddressPoint `uf93-f8nk` (house number + street to BIN, then BIN to BBL).
2. Pulls every LL84 row for that BBL (plain and dashed forms) or any of its BINs, then shows the latest reporting year per Portfolio Manager property.
3. Shows the ENERGY STAR score, the energy grade, site EUI (with the national median) and Portfolio Manager GHG, plus earlier years.
4. Shows a rough LL97 comparison for 2024-2029 and 2030-2034, with the math laid out.
5. Lists upcoming deadlines (LL97, LL84, LL33 label, LL87 by tax-block digit, and the 2030 start).
6. Ends with a Kit signup: tag `TAGID_LL97` (placeholder), fields `bbl` and `building_address`. Same fields as Building Watch, so no new Kit fields are needed.

## Data sources

| What | Source | Notes |
|---|---|---|
| Benchmarking (LL84) | `5zyy-y8am` "NYC Building Energy and Water Data Disclosure for LL84 2023 to Present" https://data.cityofnewyork.us/d/5zyy-y8am | Years 2022, 2023, 2024 (39,090 rows for 2024). Rows last updated Nov 25, 2025. BBL field is inconsistent: `1008350041`, `1-00835-0041`, or `;`-separated lists. The page queries with LIKE on both forms and then filters exact matches. |
| Older LL84 years | `usc3-8zwd`, `7x5e-2fxh`, etc. | Not used. |
| LL33 grades (open data) | `355w-xvp2` "DOB Sustainability Compliance Map: Local Law 33" | **Stale.** Last updated Mar 2022. Its values match the 2020 disclosure (CY2019 data); checked on BBLs 1008350041 and 1000047501. Not used. |
| LL33 grades (official) | DOB 2025 LL33 Data Disclosure for CY2024 (PDF, 761 pages) https://www.nyc.gov/assets/buildings/pdf/ll33_Data_Disclosure_2024-CBL.pdf | Parsed into 22,062 BBL rows (A 5,551 / B 4,270 / C 3,426 / D 7,336 / F 1,479). Every row's score is consistent with the LL95 thresholds. Embedded in the page (about 131 KB raw, about 59 KB gzipped). Grade N buildings are not listed by DOB. |
| Address fallback | AddressPoint `uf93-f8nk`, Building Footprints `5zhs-2jue`, PLUTO `64uk-42ks`, HPD `tesw-yqqr` | |

Cross-check: for single-BBL properties, the grade implied by the current LL84 CY2024 score matches the official 2025 grade in 16,400 of 16,807 cases (97.6%). Mismatches come from filings edited after grading (e.g. Empire State Building: label score 79, data now shows 78). The page shows the official grade and notes any difference. If a BBL isn't on DOB's list, the page shows the implied grade and labels it as our calculation.

**Annual refresh (about April each year, when DOB posts the new disclosure):**
`python3 bots/ll97/build_grades.py --url <new PDF URL> --label "2026 label (CY2025 data)"`.
The script refuses to write if the row count or grade consistency check fails. Also update the "checked" date in the page's Sources list.

## Verified figures (all checked Nov 13, 2026)

| Figure | Value | Source |
|---|---|---|
| Grade thresholds | A >= 85, B 70-84, C 55-69, D < 55, F = didn't submit, N = exempt or not eligible | https://www.nyc.gov/site/buildings/codes/ll33-energy-grading.page and https://www.nyc.gov/site/buildings/codes/benchmarking.page (LL95 of 2019) |
| LL97 coverage | Over 25,000 gross sq ft; or 2+ buildings on a lot, or 2+ condo buildings with one board, together over 50,000 | https://www.nyc.gov/site/buildings/codes/ll97-greenhouse-gas-emissions-reductions.page |
| 2024-2029 coefficients | electricity 0.000288962 tCO2e/kWh; natural gas 0.00005311; #2 oil 0.00007421; #4 oil 0.00007529; district steam 0.00004493 (tCO2e/kBtu) | LL97 of 2019, Admin. Code 28-320.3.1.1: https://www.nyc.gov/assets/buildings/local_laws/ll97of2019.pdf |
| Other fuels, 2024-2034 | diesel 0.00007421; propane 0.00006425; kerosene 0.00007769; distillate #1 0.00007350 | 1 RCNY 103-14(d)(3)(i): https://www.nyc.gov/assets/buildings/rules/1_RCNY_103-14.pdf (PDF dated Jan 7, 2025) |
| 2030-2034 coefficients | electricity 0.000145/kWh; natural gas 0.00005311; district steam 0.0000432; #2 oil 0.00007421; #4 oil 0.00007529 | 1 RCNY 103-14(d)(3)(i)(b) and (ii) |
| Emissions limits | Per ESPM property type, 60 types each for 2024-2029 and 2030-2034 (e.g. Multifamily 0.00675 / 0.00334664; Office 0.00758 / 0.002690852 tCO2e/sf). Parsed programmatically from the rule text and spot-checked. Limit = sum of area x factor (Equation 103-14.1). | 1 RCNY 103-14(c)(3)(i) and (iii); DOB says limits are by ESPM type: https://www.nyc.gov/site/buildings/codes/ll97-buildings-emissions-limits.page |
| Penalty | $268 x (emissions - limit) per year ("not more than" in the law; "equal to" in the rule) | Admin. Code 28-320.6 (LL97 PDF); 1 RCNY 103-14(h) |
| Annual report | Due May 1 each year from 2025, certified by a registered design professional | Admin. Code 28-320.3.7; DOB LL97 page |
| Late-filing penalty | $0.50 x gross sq ft per month, if not filed within 60 days of the deadline or by an approved extension | 1 RCNY 103-14(g)(1) |
| Extension window | Apply from 30 days before to 60 days after May 1. In 2026, DOB allowed extensions to Aug 29, 2026. | 1 RCNY 103-14(g)(2); https://www.nyc.gov/assets/buildings/pdf/sustain_dead-sn.pdf |
| Offsets cap | 10% of the building's emissions limit | DOB LL97 page |
| LL84 deadline and penalties | May 1; $500, then $500 per missed quarterly deadline (Aug 1, Nov 1, Feb 1), up to $2,000 a year | https://www.nyc.gov/site/buildings/codes/benchmarking.page |
| LL33 label | Issued in DOB NOW on Oct 1; post near each public entrance by Oct 31; $1,250 fine | Benchmarking page; 2026 service notice |
| LL87 EER | Buildings over 50,000 sq ft; due Dec 31 of the year whose last digit matches the last digit of the tax block | https://www.nyc.gov/site/buildings/codes/ll87-energy-audits-retro-commissioning.page |
| Property-type substitutions | DOB's "Suggested Property Type" column (e.g. Fast Food and Bar/Nightclub to Restaurant; Fire and Police Station to Hotel; Prison to Enclosed Mall) | DOB Article 320 Info Guide v1.4 (06/30/2025), ESPM table: https://www.nyc.gov/assets/buildings/pdf/article_320_guide.pdf |
| Renames | Senior Living Community = Senior Care Community; Vehicle Dealership = Automobile Dealership | DOB guide bracket notation, plus ENERGY STAR glossary IDs at https://www.energystar.gov/buildings/benchmark/understand-metrics/property-types |
| **Our assumptions (not confirmed)** | "Community Center and Social Meeting Hall" -> Social/Meeting Hall; "Vehicle Repair Services" -> Repair Services | These names appear in the 2024 LL84 data but not on ENERGY STAR's list page or in DOB's guide. The page labels them "closest listed type, our assumption". |

The test buildings were recomputed independently in Python and match the page exactly:

| Building | 2024-29: emissions vs limit | 2030-34: emissions vs limit |
|---|---|---|
| 36-06 30th St, Queens | 456.9 vs 411.8 t (~$12,100/yr) | 391.3 vs 204.1 t (~$50,100/yr) |
| 130 8th Ave, Brooklyn | 312.2 vs 506.3 t (under) | 278.8 vs 251.0 t (~$7,400/yr) |
| Empire State Building | 12,096.8 vs 22,296.7 t (under) | 7,544.2 vs 7,981.2 t (under) |

## Known limits of the estimate (also stated on the page)

- Uses benchmarking floor areas and use types, not DOF GFA or the design professional's classification.
- Assumes the building follows Article 320 from 2024. The page can't see compliance pathways: Article 321, 2026 or 2035 starts, rent-regulated buildings over 35%, HDFC co-ops, houses of worship. That data is in DOB's Covered Buildings List (Excel on nyc.gov, which a browser can't fetch directly because of CORS).
- No deductions, adjustments or mitigation.
- No coefficient is applied to #5/#6 oil, district hot water or chilled water. When present, they're flagged as uncounted.
- "Other" and unlisted uses are left out of the limit and flagged.
- Penalties are rounded to the nearest $100.

## Bug found in Building Watch (not fixed there)

`docs/buildingwatch/lookup.html` `resolveBBL`: the HPD fallback compares `lowhousenumber`/`highhousenumber` as text on Socrata, so "350 5th Ave" matched a "35..37" range and returned 35 5th Ave (Rubin Hall). The LL97 page re-checks ranges numerically (`hnCmp`). The same fix should go into lookup.html.

## Paid tier ideas

- **Owner's LL97 report ($49-$149 per building):** a PDF covering year-by-year exposure through 2034, the 2035-2039 limits (already in 1 RCNY 103-14(c)(3)(iv)), and what-if scenarios (oil to gas, heat-pump share, solar, LED). Each scenario shows the change in tCO2e and dollars.
- **Pathway check:** match the BBL against DOB's Covered Buildings List (downloaded server-side by a bot) to show the real pathway (0-3) and whether it's on the LL84, LL87 and LL97 lists.
- **Monitoring ($6-$10 per building per month, bundled with Building Watch):** alerts for new LL84 filings, grade changes, DOB benchmarking or EGRADE violations, LL97 violations, and deadline service notices. A cron bot diffs the datasets weekly.
- **Portfolio view for managers:** CSV upload of BBLs, ranked by 2030 exposure, with exports.
- **Lead generation (revenue share):** introductions to registered design professionals, LL87 auditors, and financing (NYC Accelerator, NYCEEC, PACE). This needs care: disclose referral fees and keep it separate from the free estimate.
- **Board-ready one-pager for co-ops and condos** explaining the grade, the exposure and the timeline in plain English.
