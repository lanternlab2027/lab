# Should I Appeal? (NYC property-tax appeal checker): notes

Page: `docs/taxappeal/index.html` (one self-contained file, served at https://lanternlab2027.github.io/lab/taxappeal/).
Built and verified Nov 13, 2026. Not committed. Not linked from `docs/index.html` yet.

## Before publishing
1. Replace **`TAGID_TAXAPPEAL`** in `index.html` with the real Kit tag id. Until then, signups fail with "didn't go through". The page sends the same fields as Building Watch and LL97 (`bbl`, `building_address`), so you don't need any new Kit fields.
2. **The reminder and comparables emails aren't built.** The signup promises a reminder before the deadline for your class, and this property's comparables after the new roll is posted (around Jan 15). This needs a small Action that reads tagged subscribers through the Kit API (using a secret), reruns the comps for each `bbl` (same queries as the page; `check_comps.py` is a starting point), and sends the emails. Never commit subscriber data.
3. Optional: add a card to `docs/index.html`.
4. **Around Jan 15, 2027:** confirm the 2027 deadlines once the Tax Commission posts its 2027/28 forms. Then add them to `OFFICIAL` in the page (for example `2027: {c1: Dt(2027,3,15), c234: Dt(2027,3,1)}`) so the page stops saying "expected". Also check whether the new TC600 changes anything (filing method, fee threshold).

## Corrections to the brief
- **The deadlines are the other way round.** Class 2, 3 and 4 are due **March 1**, and Class 1 is due **March 15** (a weekend date moves to the next business day). In 2026 the dates were Mon Mar 2 (Class 2/3/4) and Mon Mar 16 (Class 1), 5:00 PM, "received by". In 2027 both dates fall on a Monday: **Mon Mar 1, 2027** and **Mon Mar 15, 2027**. These are the statutory dates, and the official 2027 dates aren't posted yet. The page labels them "expected".
- **There's no Tax Commission online application** for homeowners right now. The 2026/27 TC600 and TC108 say to file in person (1 Centre St Rm 2400, or a DOF Business Center) or by mail. Forms need an original signature, so fax and email aren't accepted, and the Tax Commission homepage says "you cannot file by email". A TC-AppNC file-naming sheet does exist for electronic submissions, apparently for practitioners. The page links the official forms page and instructions instead. The free online filing that does exist is **DOF's Request for Review**, linked through nyc.gov's own redirect (`/assets/finance/jump/property_rfr.html` → `a836-rfrapp.nyc.gov:9442/RFRExternalWeb`). The redirect page returns 200. The app host itself refused connections from this sandbox, so it couldn't be checked from here.
- **The Tax Commission can't change DOF's market value.** It changes the assessed value, tax class and exemptions (TC600 para. 4, TC108 Part 4). The page explains this.

## Data (verified with live queries Nov 13, 2026)
| What | Dataset | Fields used / notes |
|---|---|---|
| Values | `8y4t-faws` Property Valuation and Assessment Data, Tax Classes 1-4 (rows updated Sep 14, 2026) | `parid` (= BBL), `year` (text; tax year **ending**, e.g. 2027 = 2026/27), `period` (1 tentative, 2 change by notice, 3 final, 4 remission; from the attached data dictionary), `curmkttot`, `pymkttot`, `curacttot`, `curtrntot`, `curtxbtot`, `curtxbextot`, `pytxbtot`, `curtaxclass`, `bldg_class`, `gross_sqft`, `units`, `yrbuilt`, `zip_code`, `housenum_lo`, `street_name`. The latest data is year 2027, period 3 (2026/27 final). Years 2023-2027 are present. The 2027/28 tentative roll should appear as year 2028 period 1 after Jan 15, 2027, and the page then picks it up on its own (it takes the highest year, then the highest period). |
| Recent sales | `usep-8jbt` Citywide Rolling Calendar Sales (sales Oct 1, 2025-Sep 30, 2026; rows updated Oct 15, 2026) | `borough` text "1"-"5", `block` text without zero padding, `lot` number, `gross_square_feet` number, `building_class_at_time_of`, `zip_code`, `neighborhood`, `sale_price`, `sale_date` |
| Earlier sales | `w2pb-icbu` Citywide Annualized Calendar Sales (2016-2025) | Same names, but `gross_square_feet` and `lot` are **text**, so the page parses them on the client |

**Assessed value used:** `CURTXBTOT` ("Taxable Assessed Total", before exemptions). For Queens 2026/27 final it's never below min(actual, transitional) (0 rows). It's above the transitional value in 12,064 rows, which fits uncapped physical changes. For Class 1, `CURACTTOT` = 6% of market value exactly, and `CURTRNTOT` holds the capped value. Example: 4055340120 has AV 49,924 = 41,603 (2022/23) x 1.20, so the 5-year cap is binding.

## How the verdict works
1. Market value per sq ft = `curmkttot / gross_sqft`.
2. Comps: same `building_class_at_time_of`, sale >= $10,000, sale date in the last 24 months, same zip or DOF neighborhood. The neighborhood comes from the most recent sale on the same tax block. Both sales datasets are merged and de-duplicated on block/lot/date/price. The property's own sales are dropped from the comps but shown, and so are package sales (the same price on several lots on one day). Size tiers: (a) same zip **and** neighborhood, within 25% of the square footage, if there are at least 8; else (b) zip **or** neighborhood, within 25%, if at least 5; else (c) within 40%. Then sales under 0.5x or over 2x the group median $/sq ft are trimmed. At least 5 sales are needed for a verdict.
3. Label: ratio of the property's $/sq ft to the median comp. Above 1.10 is "Looks high", below 0.90 is "Looks low", otherwise "In line".
4. **Class 1 "worth it" test** (the TC108 test): comps-implied value = median $/sq ft x sq ft, compared with the **effective market value** = AV / 6%. It's flagged worth a look only if the implied value is below 90% of the effective market value. Shown savings = (AV - 6% x implied) x 19.843%, as a rough upper bound before exemptions.
5. Classes 2 and 4: "Looks high" means worth a look, with a warning that DOF values rental property by income.
6. Cap check: year over year (6%, or 8% for 2A/2B/2C) and against the value 4 years earlier (20%, or 30%), with 0.5% slack for rounding. If the cap is exceeded, the page says this usually means a physical change or an exemption ending, and otherwise that a cap claim is a valid ground.
7. Fully exempt lots (exemption >= AV) get "Fully exempt", because an appeal can't lower a zero bill. This was found in testing: 3901 Avenue P (nonprofit owner) and 2272 E 60 Pl (exemption = AV) looked like strong "Looks high" cases before the fix. Uncapped Class 1 homes (AV = 6% of MV) are often exempt lots.

## Verified figures and rules
| Fact | Source |
|---|---|
| TC deadlines Mar 1 (Class 2/3/4) and Mar 15 (Class 1), not extendable, must be *received*; 2026 actual: Mar 2 and Mar 16 by 5 PM | https://www.nyc.gov/site/taxcommission/about/challenging-notice-of-property-value.page ; https://www.nyc.gov/site/taxcommission/forms/forms.page ; https://www.nyc.gov/site/finance/property/challenge-your-assessment.page |
| In person or by mail; original signature; no fax or email; TC10 receipt is the only proof; current-year forms required; revised notice after Feb 1 gives 20 days; $175 fee only if AV >= $2M | TC600 2026/27 paras 9, 15, 18-20: https://www.nyc.gov/assets/taxcommission/downloads/pdf/tc600-2026.pdf ; TC108: https://www.nyc.gov/assets/taxcommission/downloads/pdf/tc108-2026.pdf |
| Ratios 6% (Class 1), 45% (Classes 2-4); caps 6%/yr and 20%/5 yr (Class 1), 8%/30% (2A/2B/2C); no caps on physical changes or ending exemptions; 5-year phase-in for other Class 2 and Class 4 | TC600 paras 6-8; DOF Class 1 guide (Jan 2026): https://www.nyc.gov/assets/finance/downloads/pdf/brochures/class_1_guide.pdf |
| Effective market value = AV / 6%; the tax falls only if you prove value below it | DOF Class 1 guide; DOF Challenge page |
| TC108 test: your value x 6% vs NOPV assessed value; "If line c is less than line b, DO NOT FILE" | TC108 Part 4 |
| Disagreeing with market value, or an increase from last year, isn't enough reason on its own to file | TC600 para 12 |
| Income/expense statement needed for rental property except residential buildings with 6 or fewer units and no commercial space | TC600 para 26 |
| DOF Request for Review deadlines 2026: Class 1 Mar 16, Class 2 Mar 2, Class 4 Apr 1; online filing; doesn't replace a TC application | https://www.nyc.gov/site/finance/property/property-forms-assessments-and-valuations.page |
| Tentative roll and NOPVs around Jan 15 | TC600 para 1; DOF calendar https://www.nyc.gov/site/finance/about/finance-calendar.page (2026: Jan 15) |
| Class 1 tax rate 19.843% (tax year 2026). DOF hasn't posted a 2026/27 rate on that page | https://www.nyc.gov/site/finance/property/property-tax-rates.page |
| Building class names | https://www.nyc.gov/assets/finance/jump/hlpbldgcode.html |

Every URL on the page returned HTTP 200 on Nov 13, 2026. ACRIS is linked through the nyc.gov page (`/site/finance/property/acris.page`) because the `a836-acris` host wasn't reachable from here.

## Tests
`bots/taxappeal/test_page.js` (Playwright, `require('playwright')`, `chromium.launch()`) serves `docs/` locally, runs at 390px and 1280px, and routes Kit to a stub. Run it with `NODE_PATH=/opt/npm-tools/node_modules node bots/taxappeal/test_page.js <screenshot dir>`. All checks pass: lookup completes, a verdict label shows, there's no horizontal scroll, Kit is called once with `TAGID_TAXAPPEAL` + `bbl`, and there are no page errors.

| Address | Class | MV / AV (2026/27 final) | YoY MV / AV | Comps | Median $/sf vs DOF | Verdict |
|---|---|---|---|---|---|---|
| 45-46 193 St, Queens (4055340120) | A5, 11358 | $1,017,000 / $49,924 | +20.4% / +3.3% | 48 (tier a) | $639 vs $636 | In line; EMV $832,067 < implied $1,022,334 |
| 3605 Avenue M, Brooklyn (3076540009) | B1, 11234 | $820,000 / $38,346 | -1.1% / +6.0% | 10 (tier a) | $544 vs $544 | In line; EMV $639,100 |
| 53-45 Metropolitan Ave, Queens (4026340035) | B2, 11385 | $1,061,000 / $36,116 | -8.7% / 0.0% | 104 (tier b; 12 trimmed) | $489 vs $465 | In line; EMV $601,933 |
| 2132 E 73 St, Brooklyn (3084320053), extra branch test | A5, 11234 | $888,000 / $50,225 | -5.8% / +6.0% | 7 (tier a, thin) | $535 vs $661 | Looks high, worth a look: implied $719,272 vs EMV $837,083, up to ~$1,403/yr |
| 3901 Avenue P, Brooklyn (3078580009), extra branch test | B1, 11234 | fully exempt | | | | Fully exempt |

`bots/taxappeal/check_comps.py <BBL>` is an independent Python version of the comps math (with the date hard-coded to 2026-11-13). Its median, quartiles, ratio, implied value and EMV match the page exactly for all of the above.

## Known limits (also stated on the page)
- Sales $/sq ft ignores condition, lot size, finished basements and renovations, and the DOF neighborhood/zip match is coarse.
- Sales data lags: rolling sales currently end Sep 30, 2026.
- Before Jan 15 the page shows the 2026/27 values, which can no longer be appealed, and says so. It labels the 2027/28 values as the next appealable roll.
- Savings ignore exemptions, abatements and rate changes.
- Condos (R classes) usually have no gross sq ft in sales data, so they get "Not enough sales" or "Can't compare".

## Paid-tier ideas
- An appeal packet ($29-$49): a pre-filled TC108 worksheet, the 3-5 closest comps with ACRIS document links and photos guidance, and a TC10 receipt reminder. No filing on the owner's behalf; the owner signs and files.
- Annual monitoring bundled with Building Watch: re-check each January 15 and alert only when "worth a look".
- A batch report for small landlords and brokers covering every lot they own.
