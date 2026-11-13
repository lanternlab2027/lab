# Compliance calendar: sources and verification

All pages fetched 2026-11-13 from www.nyc.gov (browser User-Agent). Rules in `lookup.html` (`complianceSection`) follow these pages only.

| Deadline / rule | Window or date | Applies to (as coded) | Official source | Verified |
|---|---|---|---|---|
| HPD Bedbug Annual Report | Dec 1-31, covering prior Nov 1-Oct 31 | Multiple dwellings (3+ units). FAQ PDF: owners of multiple dwellings | https://www.nyc.gov/site/hpd/services-and-information/bedbugs.page ; https://www.nyc.gov/assets/hpd/downloads/pdfs/services/bedbugs-annual-report-faq.pdf | 2026-11-13 |
| HPD Property Registration | Annually May 21 - Sept 1 (deadline Sept 1); $13 fee billed by DOF | 3+ units: required. 1-2 units: only if neither owner nor owner's immediate family lives there (shown "If applicable") | https://www.nyc.gov/site/hpd/services-and-information/register-your-property.page | 2026-11-13 |
| NY State (HCR) rent registration | By July 31 | Only rent-regulated apartments; shown "If applicable" for 3+ unit buildings. Stated on HPD's registration page | https://www.nyc.gov/site/hpd/services-and-information/register-your-property.page | 2026-11-13 |
| Lead-paint annual notice (LL1 of 2004) | Deliver Jan 1-16; collect by Feb 15; Feb 16-Mar 1 access attempts, then notify DOHMH in writing | Built before 1960: multiple dwellings, and tenant-occupied units in 1-2 unit buildings. 1960-1978 only if owner knows of lead paint | https://www.nyc.gov/site/hpd/services-and-information/annual-notice-and-investigations.page ; https://www.nyc.gov/site/hpd/services-and-information/lead-based-paint.page | 2026-11-13 |
| Window-guard annual notice (LL57) | Deliver Jan 1-15 (DOHMH); return by Feb 15 | Multiple dwellings (3+ apartments); combined form for pre-1978 buildings | https://www.nyc.gov/site/doh/health/health-topics/window-guards.page ; https://www.nyc.gov/site/hpd/services-and-information/window-guards.page | 2026-11-13 |
| Heat season | Oct 1 - May 31 (68F day when <55F outside; 62F night; hot water 120F year-round) | Any building with tenants (1-2 units shown "If applicable") | https://www.nyc.gov/site/hpd/services-and-information/heat-and-hot-water-information.page | 2026-11-13 |
| DOB boiler annual inspection | Cycle Jan 1 - Dec 31; report in DOB NOW within 14 days; late until Jan 14 | Residential 6+ families; commercial and mixed-use (commercial + 1-5 residential). Exempt: residential 5 families or fewer; single-apartment boilers. Shown "If applicable" (boiler presence unknown) | https://www.nyc.gov/site/buildings/safety/boiler-compliance.page | 2026-11-13 |
| LL152 gas piping inspection | Every 4 years by community district: CD 1,3,10 = 2024/2028; 2,5,7,13,18 = 2025/2029; 4,6,8,9,16 = 2026/2030; 11,12,14,15,17 = 2027/2031 (Jan 1-Dec 31). Certification to DOB within 60 days of inspection | All buildings except DOF classes A0-A9, B1, B2, B3, B9, CM, N2, S0, S1, S2, V; M3/M4 conditional ("If applicable") | https://www.nyc.gov/site/buildings/property-or-business-owner/gas-piping-inspections.page | 2026-11-13 |
| DSNY official NYC Bins | Required since June 1, 2026; full enforcement since Sept 8, 2026 (standing rule, not in .ics) | 1-9 residential units | https://www.nyc.gov/site/dsny/collection/containerization/residential-containerization.page ; https://www.nyc.gov/site/dsny/collection/containerization/nyc-bin-faq.page | 2026-11-13 |

## Discrepancies noted
- Annual notice delivery: HPD says Jan 1-16 (lead); DOHMH says Jan 1-15 (window guards). 3+ unit buildings get Jan 1-15 (satisfies both); 1-2 unit pre-1960 buildings get Jan 1-16 (lead only).
- DOB's older low-pressure page (https://www.nyc.gov/site/buildings/safety/low-pressure-boiler-requirements.page) says reports are due within 45 days; the boiler-compliance page says 14 days. Code uses 14 days.

## Data (NYC Open Data, checked 2026-11-13)
- Bedbug Reporting `wz6d-d3jb`: fields used `bin, bbl, of_dwelling_units, filing_date, filing_period_start_date, filling_period_end_date` (note the dataset's "filling" typo). Latest period end in data: 2025-10-31; latest filing_date 2026-10-14 (late filings appear).
- Registrations `tesw-yqqr`: fields used `bin, registrationid, lastregistrationdate, registrationenddate`. This dataset has no contact names; owner/agent names live in a separate contacts dataset that is not queried.
- PLUTO `64uk-42ks`: added `yearbuilt, cd` to the existing select.

## Not included (couldn't verify on an official page today, or not a dated small-building deadline)
- DSNY set-out times; smoke/CO detector duties; FISP facades (6+ stories); LL97/LL84/LL87 (large buildings); rent-stabilization thresholds.
