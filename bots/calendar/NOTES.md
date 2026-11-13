# 2027 Compliance Calendar (lead magnet): notes

Built Nov 13, 2026. Not committed.

## Files

| File | What it is |
|---|---|
| `bots/calendar/build_calendar.py` | Builds the PDF. All content (items, tags, standing rules, sources) is in this one file. It renders HTML, prints it with Playwright (Chromium) `page.pdf`, and refuses to write if any page's content runs into the footer (`--force` overrides, `--html-only` skips the PDF). |
| `docs/calendar/nyc-2027-owner-calendar.pdf` | Output: 17 letter pages, about 384 KB. Pages: cover; year at a glance; Jan (2 pages); Feb-Dec; standing rules; sources. |
| `docs/calendar/preview.png` | Cover and January preview used on the landing page and as the og:image. Regenerate by hand after content changes (pdftoppm -r 90 pages 1 and 3). |
| `docs/calendar/index.html` | Landing page in the docs/ll97 style. Email goes to Kit, then the download link appears. |
| `bots/calendar/test_page.js` | Playwright test at 390px. Kit is routed to a stub, and both success and failure paths are tested. Run `NODE_PATH=/opt/npm-tools/node_modules node bots/calendar/test_page.js <shot dir>`. Last run: ALL PASS. |

## Before publishing
1. Replace `TAGID_CAL2027` in `docs/calendar/index.html` with a real Kit tag id (create a tag such as `calendar-2027`). Until then, every Kit call fails. The visitor still gets the PDF and sees "Your email signup didn't go through, but the download is yours anyway", but no email is captured.
2. The Kit public api_key is copied from `docs/ll97/index.html` (same key as the other pages). It is not printed here.
3. Optional: link the page from `docs/buildingwatch/index.html`, `lookup.html` and `docs/index.html`, and add it to `sitemap.xml`. Not done.
4. The PDF footer links to the live lookup (returns 200). The sources page links to `lanternlab2027.github.io/lab/calendar/`, which 404s until this folder is pushed.
5. The page promises "occasional emails about NYC building deadlines". No reminder sequence is built.

## Honesty choices
- The landing page says up front that the PDF is free. If the Kit call fails, the download is still shown.
- The PDF file itself is public (no gate on the URL). That's intentional and fine for a free lead magnet.

## Corrections to the brief
- **Local Law 55 has no "annual notice".** HPD (allergen page and Dec 2025 bulletin) requires an **annual inspection** of units, plus a notice and fact sheet **with each lease**. The calendar says that, under standing rules.
- **Window guards have no annual "inspection" duty** on the official pages. The duties are the notice (Jan 1-15), the return (Feb 15), and installing and repairing guards. "Regularly check" is DOHMH tenant advice. The lead rules do require an annual *visual investigation*, and the calendar covers that.
- **Window-guard notice deadline:** DOHMH says Jan 1-15, but HPD's Dec 2025 bulletin says "by January 16". The calendar uses Jan 15 to satisfy both (same as lookup.html).
- **New for 2027, not in the brief:** natural gas detectors are required by **Jan 1, 2027** (LL157 of 2016 as amended by LL102 of 2025). DOB's Oct 13, 2026 release confirms the date. HPD's page and the Dec 2025 bulletin had said "at the earliest". Also added: FISP sub-cycle 10A closes Feb 21, 2027 (over 6 stories), and RPIE June 1 (11+ units or mixed-use).
- **Weekend dates in 2027:** Jan 1 is a holiday (DOF moves payments to the next business day). These fall on weekends: Jan 16 (Sat), Feb 21 (Sun), May 1 (Sat, LL84/LL97), Jul 31 (Sat, HCR), Oct 31 (Sun). The PDF states the date and doesn't assume a weekend extension. DOB hasn't posted its 2027 sustainability deadline notice.

## "Expected" items (not yet officially published for 2027)
| Item | Date shown | Basis |
|---|---|---|
| Notice of Property Value | about Jan 15 | Tax Commission page ("on or about January 15th"); DOF calendar (2026: Jan 15) |
| Tax Commission appeal, class 2/3/4 | Mon Mar 1, 2027 | Statutory Mar 1; 2026 actual was Mon Mar 2 (see bots/taxappeal/NOTES.md) |
| Tax Commission appeal, class 1 | Mon Mar 15, 2027 | Statutory Mar 15; 2026 actual was Mon Mar 16 |
| DOF Request for Review, class 4 | Apr 1, 2027 | 2026 date was Apr 1 |
| RPIE-2026 | Tue Jun 1, 2027 | RPIE-2025 was due Jun 1, 2026 |

**Around Jan 15, 2027:** confirm these, remove `expected=True`, rebuild the PDF and preview, and update the "Expected" notice on index.html.

## Every dated item and its sources (all fetched Nov 13, 2026, browser UA, HTTP 200)
| Date (2027) | Item | Applies to (tag) | Source ids |
|---|---|---|---|
| Jan 1 | Natural gas detectors required | Has gas piping | hpd-detect, dob-natgas, hpd-bulletin |
| Jan 1 (holiday) / grace Jan 15 | Property tax due | All owners | dof-due, dof-bills |
| Jan 1-15 | Window-guard annual notice | 3+ units | doh-wg, hpd-wg, hpd-bulletin |
| Jan 1-16 | Lead-paint annual notice | Built before 1960 (MDs and tenant-occupied units in 1-2 family; 1960-78 if lead known) | hpd-annual, hpd-lead |
| Jan 16 | Stove knob cover annual notice | 3+ units | hpd-stove, hpd-bulletin |
| Jan 1 / Jan 14 | Boiler cycle opens; late 2026 reports end | 6+ units or mixed-use with boiler | dob-boiler |
| Jan 1 | LL152 gas piping year (CD 11, 12, 14, 15, 17) | Not 1-2 family / R-3 | dob-gas |
| ~Jan 15 (expected) | NOPV | All | tc-nopv, dof-cal |
| Feb 15 | Notices due back | 3+ units / pre-1960 | doh-wg, hpd-annual |
| Feb 16-Mar 1 | Lead follow-up; notify DOHMH | Pre-1960 | hpd-annual |
| Feb 21 | FISP 10A closes; 10C opens | Over 6 stories | dob-facade, dob-fisp10 |
| Mar 1 (expected) | TC appeal class 2/3/4 | Tax class 2/3/4 | tc-nopv, tc-forms, tc600, dof-rfr |
| Mar 15 (expected) | TC appeal class 1 | Tax class 1 | tc-nopv, tc-forms, tc600, dof-challenge, dof-rfr |
| Apr 1 / grace Apr 15 | Property tax (quarterly) | AV <= $250k | dof-due |
| Apr 1 (expected) | DOF Request for Review, class 4 | Class 4 | dof-rfr |
| May 1 | LL84 benchmarking + LL97 report | Over 25,000 sq ft | dob-bench, dob-ll97, ll97-law, rcny-103-14 |
| May 21 | HPD registration opens | 3+ units (1-2 if not owner/family occupied) | hpd-reg |
| May 31 | Heat season ends | Has tenants | hpd-heat |
| Jun 1 (expected) | RPIE / claim of exclusion | 11+ units or mixed-use, AV > $40k | dof-rpie, dof-rpie-info |
| Jul 1 / grace Jul 15 | Property tax (new tax year); 0.5% early-pay discount | All | dof-due, dof-bills |
| Jul 31 | HCR rent registration | Rent-stabilized | hpd-reg, hpd-bulletin |
| Aug 1, Nov 1 | LL84 quarterly late penalty ($500, max $2,000/yr) | Over 25,000 sq ft, only if May 1 missed | dob-bench |
| Sep 1 | HPD registration deadline ($13) | 3+ units | hpd-reg, hpd-bulletin |
| Oct 1 | Heat season begins | Has tenants | hpd-heat |
| Oct 1 / grace Oct 15 | Property tax (quarterly) | AV <= $250k | dof-due |
| Oct 1-31 | Post energy grade label ($1,250 fine) | Over 25,000 sq ft | dob-bench |
| Oct 31 | Bedbug reporting year ends | 3+ units | hpd-bedbug |
| Dec 1-31 | Bedbug annual report | 3+ units | hpd-bedbug, hpd-bedbug-faq, hpd-bulletin |
| Dec 31 | LL152 2027 cycle ends | Not 1-2 family | dob-gas |
| Dec 31 | Boiler cycle ends (file in 14 days; late to Jan 14, 2028) | 6+ units / mixed-use | dob-boiler |

Standing rules page: heat/hot water (hpd-heat); smoke/CO detectors (hpd-detect); natural gas detectors (hpd-detect, dob-natgas); LL55 allergens (hpd-allergen, hpd-bulletin); stove knobs (hpd-stove); window guards (doh-wg, hpd-wg); lead-safe work (hpd-annual, hpd-lead); NYC Bins for 1-9 units since Jun 1, 2026, full enforcement Sept 8, 2026 (dsny-bins); rent-stabilized posting, LL86 of 2025, since Jan 26, 2026 (hpd-bulletin, hpd-signage); interruption of service notice (hpd-bulletin).

## Source list (ids used above; same numbering as the PDF's sources page)
1. hpd-bedbug: https://www.nyc.gov/site/hpd/services-and-information/bedbugs.page
2. hpd-bedbug-faq: https://www.nyc.gov/assets/hpd/downloads/pdfs/services/bedbugs-annual-report-faq.pdf
3. hpd-reg: https://www.nyc.gov/site/hpd/services-and-information/register-your-property.page
4. hpd-annual: https://www.nyc.gov/site/hpd/services-and-information/annual-notice-and-investigations.page
5. hpd-lead: https://www.nyc.gov/site/hpd/services-and-information/lead-based-paint.page
6. doh-wg: https://www.nyc.gov/site/doh/health/health-topics/window-guards.page
7. hpd-wg: https://www.nyc.gov/site/hpd/services-and-information/window-guards.page
8. hpd-stove: https://www.nyc.gov/site/hpd/services-and-information/stove-knob-covers.page
9. hpd-detect: https://www.nyc.gov/site/hpd/services-and-information/detectors.page
10. dob-natgas: https://www.nyc.gov/site/buildings/dob/pr-nyc_natgas.page
11. hpd-allergen: https://www.nyc.gov/site/hpd/services-and-information/indoor-allergen-hazards-mold-and-pests.page
12. hpd-bulletin: https://www.nyc.gov/site/hpd/services-and-information/property-owner-bulletins/december-2025.page
13. hpd-heat: https://www.nyc.gov/site/hpd/services-and-information/heat-and-hot-water-information.page
14. dob-boiler: https://www.nyc.gov/site/buildings/safety/boiler-compliance.page
15. dob-gas: https://www.nyc.gov/site/buildings/property-or-business-owner/gas-piping-inspections.page
16. dob-facade: https://www.nyc.gov/site/buildings/safety/facade-compliance.page
17. dob-fisp10: https://www.nyc.gov/assets/buildings/pdf/cycle10-diagram.pdf
18. dob-bench: https://www.nyc.gov/site/buildings/codes/benchmarking.page
19. dob-ll97: https://www.nyc.gov/site/buildings/codes/ll97-greenhouse-gas-emissions-reductions.page
20. ll97-law: https://www.nyc.gov/assets/buildings/local_laws/ll97of2019.pdf
21. rcny-103-14: https://www.nyc.gov/assets/buildings/rules/1_RCNY_103-14.pdf
22. dof-due: https://www.nyc.gov/site/finance/property/property-due-dates.page
23. dof-bills: https://www.nyc.gov/site/finance/property/property-bills-and-payments.page
24. tc-nopv: https://www.nyc.gov/site/taxcommission/about/challenging-notice-of-property-value.page
25. tc-forms: https://www.nyc.gov/site/taxcommission/forms/forms.page
26. tc600: https://www.nyc.gov/assets/taxcommission/downloads/pdf/tc600-2026.pdf
27. dof-challenge: https://www.nyc.gov/site/finance/property/challenge-your-assessment.page
28. dof-rfr: https://www.nyc.gov/site/finance/property/property-forms-assessments-and-valuations.page
29. dof-cal: https://www.nyc.gov/site/finance/about/finance-calendar.page
30. dof-rpie: https://www.nyc.gov/site/finance/property/property-rpie.page
31. dof-rpie-info: https://www.nyc.gov/assets/finance/downloads/pdf/rpie/rpiefilinginfo.pdf
32. dsny-bins: https://www.nyc.gov/site/dsny/collection/containerization/residential-containerization.page
33. hpd-signage: https://www.nyc.gov/site/hpd/services-and-information/required-signage.page

Reused from the repo (already verified Nov 13, 2026): `bots/buildingwatch/CALENDAR_NOTES.md` (bedbug, registration, HCR, lead, window guards, heat, boiler, LL152, bins), `docs/buildingwatch/lookup.html` (`complianceSection`, `GAS_CYCLE`, `GAS_EXEMPT`), `bots/ll97/NOTES.md` (LL84/LL97/LL33 dates, $1,250 label fine, extension window), `bots/taxappeal/NOTES.md` (Mar 1 / Mar 15, RFR, NOPV). Key phrases on those pages were re-checked against the live pages today.

## Rendering notes
- Chromium embeds Inter as Type 3 fonts. poppler prints "Bad bounding box in Type 3 glyph" warnings, but rendering and text extraction are fine. If a printer has trouble, switch the CSS font to "DejaVu Sans".
- Every page was rendered to PNG and checked by eye. January needs two pages (8 items). All other months fit on one page with ruled notes lines.
