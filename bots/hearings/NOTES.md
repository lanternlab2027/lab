# NYC Hearing Watch: build notes

Proof-of-concept status as of 2026-11-13. Every figure below was checked against the live API that day.

## Files

| File | What it is |
|---|---|
| `docs/hearings/index.html` | Lookup page. Calls SODA from the browser and needs no backend |
| `docs/hearings/penalties.json` | Pre-computed default vs in-violation penalty medians per agency and per violation code (about 138 KB) |
| `bots/hearings/build_penalties.py` | Rebuilds `penalties.json` with the stdlib only, in about 50 s. Uses aggregate queries only and never selects respondent fields |

Refresh the stats with `python3 bots/hearings/build_penalties.py`, weekly or so. It is not wired into an Action yet.

## Before publishing
1. **Replace `TAGID_HEARING`** in `index.html` with the real Kit tag id. Until then, signups fail with "didn't go through".
2. Create these Kit custom fields: `hearing_lookup` (for example `addr:1004810033`, `name:CVS ALBANY` or `ticket:0803987140`), `hearing_tickets` (comma-separated open summons numbers, up to 40) and `next_hearing` (YYYY-MM-DD).
3. **The reminder sender is not built.** The page promises an email about a week before and again 2 days before each hearing. Kit's free plan has no automations, so a daily Action needs to read subscribers from the Kit API using a secret, re-query `jz4z-kudi` for each `hearing_lookup`, and send the reminders. Never commit subscriber data to the repo. The .ics download, with alarms 7 days and 2 days before each hearing, works today.
4. Add a link from `docs/index.html`, if wanted. I did not edit it.

## Dataset `jz4z-kudi` (OATH Hearings Division Case Status)
- Rows updated 2026-11-13 05:01 UTC. Field names were verified from `/api/views/jz4z-kudi.json`.
- **Correction to the brief: street names were not dropped in May 2026.** Rows with an Oct 2026 `violation_date` have `violation_location_street_name` in 90,214 of 96,784 cases. What actually happens is that the newest 2-3 days of summonses arrive with no agency, address, block/lot or amount (Nov 10-11 rows: 0% filled), and the fields are filled in later. The page tells users this and offers a search by summons number.
- **Lot padding is mixed.** Upcoming hearings use 4-digit lots (`0046`) for Sanitation, DEP, DOHMH and most DOB rows, but 5-digit lots (`00046`) for **all FDNY** rows and about a third of DOB rows. The page matches both. **Bug in Building Watch:** `docs/buildingwatch/lookup.html` and `watch.py` query only the 4-digit form, so they miss every FDNY hearing (52-11 102 St, Queens has 2 upcoming FDNY hearings that Building Watch won't show).
- Street spellings are mixed too ("5 AVENUE" / "5 AVE"; PLUTO has "BOOTH MEMORIAL AVE" next to "MULBERRY STREET"). The address search tries both spellings against PLUTO and OATH.
- Respondent: `respondent_last_name` holds the full business name for companies and only the last name for individuals. There is no first-name field.
- `hearing_result='DEFAULTED'` with a future `hearing_date` (30,471 rows) means `hearing_status='RESCHEDULED'`: a default was entered and a new date was set. The page labels these "NEW DATE AFTER DEFAULT".
- Upcoming rows with status `PAID IN FULL` (58,741) or `WRITTEN OFF` are shown, but they are not counted as open or included in reminders.

## Lookup modes (SoQL `$where`)
| Mode | Query | Speed |
|---|---|---|
| Address + borough | PLUTO `64uk-42ks` address → BBL (fallback HPD reg `tesw-yqqr`), then `(borough AND house AND street in variants) OR (borough AND block AND lot in (4-digit, 5-digit))` | ~3 s |
| Business name | `starts_with(respondent_last_name, 'NAME')`. This is ~0.3 s, against 2.5 s for `like`. It is prefix-only, and a list of matching names helps narrow a search | ~0.5 s |
| Summons # | `ticket_number in (t, '0'+t, t stripped of leading zeros)` | <1 s |
| BBL | block/lot as above | ~0.5 s |

Each lookup runs 3-4 queries in parallel: upcoming (limit 300), defaults over the past 3 years (limit 200), a totals aggregate (count, imposed, still owed), and the name list for name searches.

## Figures (re-verified 2026-11-13, hearing dates Jan 1-Nov 12 2026)
- 904,940 hearings. 575,906 have a result. 323,242 are defaults (313,384 `DEFAULTED` + 9,858 `Default/ No Appearance`), which is **56.1%**. Penalties imposed on those defaults: **$383.9M**. 304,536 cases have `hearing_date >= 2026-11-13`.
- **Correction to the research: the "$218 vs $55" Sanitation figure is out of date and needs careful wording.**
  - $217.75 is the year-to-date mean on `DEFAULTED`. $54.98 is the mean on `IN VIOLATION` only, meaning the respondent appeared and lost. Another 18,150 Sanitation cases were dismissed at $0.
  - The Sanitation default average fell over the year: about $262 Jan-Jun 2026, $161 in Sep, **$75 in Oct**. In the last 60 days the median is **$80 default vs $50 in violation**.
  - Driver: code AS26 (failure to clean 18 inches into street). Its default was $300 for most cases until Sep 2026, and $80 for 2,488 of 2,522 cases in Oct. I didn't find a published cause.
  - Some codes cost no more on default than the base fine. AS2P improper disposal is $75 either way.
  - So the page uses medians from the last 60 days per violation code, falling back to 12 months when there are fewer than 5 recent defaults. It also prints the YTD-vs-recent Sanitation shift dynamically.
- Last 60 days, median penalty on default vs in violation: FDNY $2,000 vs $475; DOB $2,530 vs $1,250; DEP $1,500 vs $440; DOT $780 vs $750; DOHMH pest control $330 vs $300.
- A $0 median in violation is real for some codes. DOB B202 has 247 in-violation results with a median of $0.

## OATH pages linked (all verified 2026-11-13)
nyc.gov returns 403 to curl from this sandbox, so I verified the pages with a browser fetch.
- hearings-and-defaults, hearings-frequently-asked-questions (missing a hearing means a default, "a higher penalty may be imposed"; phone 844-628-4692)
- payments-penalties (paying = "admitting to the charge" and waiving the hearing)
- online-hearing-submission (form due on or before the hearing date, up to 3 attachments, not every code is eligible)
- hearing-by-phone and request-phone-hearing-for-upcoming-hearing (request at least 3 business days and no more than 1 month ahead; call in within 3 hours of the hearing time)
- hearing-in-person (email livehearings@oath.nyc.gov at least 5 business days ahead), mail-hearing-submission (must arrive before the hearing date)
- reschedule-upcoming-hearing (must be received before the hearing)
- missed-hearings-default-frequently-asked-questions and reopen-a-missed-hearing-default-online (a new-hearing request received within 75 days is granted; one per summons)
- OATH's own text reminders: text "OATHreminder" to (917) 451-8829 (stated on the reopen page)
- Note: the hearings-and-defaults page says all hearings set for Fri Nov 13, 2026 are being rescheduled automatically because of an email outage. This is not shown on our page.

## Tests (Playwright, chromium, 390px and 1280px). All pass, with no console errors and no horizontal overflow
| Lookup | Result |
|---|---|
| Address `183 Mulberry St`, Manhattan | 85 upcoming, 18 defaults of 48 past cases, $5,180 imposed and still owed. Cross-checked against the raw API |
| Name `CVS ALBANY` | 44 open upcoming (+2 paid), 88 defaults of 363 past cases |
| BBL `4019330046` | 2 FDNY hearings on Dec 28 2026. These only match with the 5-digit lot |
| Summons `0803987140` | DOHMH hearing Dec 17 2026, after a default |

The test script and screenshots are in the session scratchpad (`hw/test.js`), not in the repo. Kit calls were stubbed during the tests.

## Open decisions for Matt
- **Privacy:** results show `respondent_last_name`. For individuals this is just a surname, but name search still lets anyone look up a business's (or a surname's) summonses. OATH publishes the same data, but consider limiting name search to business-like names (LLC, INC, CORP).
- Fake door: "$29/yr per address" from the spec is not on the page yet.
