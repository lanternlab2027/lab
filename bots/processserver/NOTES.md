# NYC Process Server Individual practice test: build notes

Built 2026-11-13 on the same engine as `docs/guide` and `docs/food`. The site is static: `docs/processserver/` holds `index.html`, `quiz.html`, `quiz.js`, `style.css` and `questions/PS.json`. Serve it over HTTP. Nothing is committed or pushed.

**Build tooling** is shared with the HIC site, in `bots/hic/_build/`; see `bots/hic/NOTES.md` for the commands. The bank is `tools/bank_ps.py` and its drops are under `"ps"` in `tools/drops.json`.

## Kit email unlock

- Generated from `docs/guide/quiz.js`, with the identical flow and `api_key`.
- `KIT_URL` is `https://api.convertkit.com/v3/tags/TAGID_PS/subscribe`.
- The body sends `fields.building_address = "PS"`.
- While the `TAGID_PS` placeholder is unchanged, a failed Kit call still unlocks locally. Once you put a real tag id in, unlocking needs a 2xx response from Kit.

## Exam facts (all from nyc.gov, fetched 2026-11-13)

| Fact | Source |
|---|---|
| 35 multiple-choice questions; at least 25 correct to pass (about 71%) | License checklist page; Exam FAQ PDF (11/21/2025) p5 |
| **Time limit is not published.** The mock uses 35 Q / 35 min (1 min per question), and the page says so. | (none) |
| Required of **new and renewing** applicants | FAQ p1; Admin Code §20-406(c) |
| $75 exam fee, nonrefundable and separate from the license fee. The 2nd attempt is free. After 2 failures, reapply for the license. | Checklist; 6 RCNY §2-232d (materials p10) |
| ExamBuilder; book 24 h after DCWP processes the application; 60 days to pass; test centers citywide 9–5, seven days a week; accommodations at 42 Broadway | Checklist; FAQ |
| Wait 24 h after a first fail. Reschedule by 5 pm the day before. A no-show is a fail. Bring a government photo ID with signature (a DCWP PS license counts). Results are given immediately. | FAQ p2–3 |
| License needed for 5+ services in a calendar year. NY attorneys and government employees acting in scope are exempt. | Checklist |
| 2-year license expiring Feb 28 of even years. License fee is $85–$425 by filing date ($340 for 24 months). 2% card fee. | Checklist; Admin Code §20-407 |

**Sources:**
- `https://www.nyc.gov/assets/dca/downloads/pdf/businesses/Process-Server-Educational-Materials.pdf`: 52 pp., "Updated 3/3/2025". It includes the Mar 1 2025 rule amendments (bound volume vs third-party electronic records, MM/DD/YYYY, military time and so on).
- The checklist page.
- `Licensing-FAQs-Exams.pdf`.
- `Process-Server-Individual-Recordkeeping.pdf` (10/2022).
- `Process-Server-Individual-Electronic-Device.pdf` (form rev. 10/2021, file modified 7/2025).

## Counts and verification

| | Drafted | Pass-1 fails (fixed) | Pass-2 drops | Final |
|---|---|---|---|---|
| PS | 144 | 3 (2 wrong page, 1 quote >25 words) | 3 | **141** |

**Pass-2 drops** (reasons are in `drops.json`):
1. **The $700–$1,000 penalty (Admin Code §20-409.1).** Local Law 183 of 2025 may have changed it, and its full text was unreadable.
2. **Change-of-address timing.** 6 RCNY §1-08 says *within* 10 days; Admin Code §20-112 says 10 days *before*.
3. **"Records retained in electronic form"** (§20-406.3(a)). It conflicts with the rule and GBL §89-cc, which allow bound paginated volumes.

**Avoided on purpose:**
- **Everything Local Law 183 of 2025 removed** (effective 9/8/2026, per DCWP's New Laws page):
  - the process server **surety bond** ($10,000; Admin Code §20-406.1; 6 RCNY §2-232a/b);
  - the **Process Server Trust Fund** ($1,000; §2-232c);
  - **fingerprinting** (§20-406(b));
  - the replacement-license fees (6 RCNY §1-10(c)).

  The 3/2025 materials still print all of these, so the landing page warns readers about them.
- Housing-court certification *frequency*: rule §2-240(d) says Feb 1 and Aug 1, but the checklist calls it an annual certification.
- Third-party record submission deadline: GBL §89-cc says "three days", while 6 RCNY §2-233 says "three business days".

**Answer-length tell:** after two rewrite passes on the distractors, the correct option is still strictly the longest in 83 of 141 items (59%), but only 1 item has a gap of more than 1.6×.

## Uncertain / to check

1. **Local Law 183 of 2025:** only DCWP's summary was readable (legistar, amlegal and rules.cityofnewyork.us are blocked from this sandbox).
   - Other Subchapter 23 provisions used here could also have been amended: §20-409 five-day posting, §20-409.2 civil action, §20-406.3(c) 20% audits, §20-410 GPS.
   - Read the law before charging money.
2. **The FAQ (11/2025) and checklist** still say a second failure means paying "fingerprinting fees, and being fingerprinted again". That is stale after LL183, and the site's wording leaves it out.
3. **DCWP may reissue the Educational Materials** after LL183. Re-fetch them and re-run `make_sites.py`; changed text shows up as quote-not-found failures.
4. **The real exam also draws on sources this bank does not use:** the NYC Marshals Handbook (Ch. IV §2-2 and §5), Siegel's *New York Practice* and McKinney's CPLR.
5. **Copyright:** questions are paraphrased, and quotes from public statutes and rules are 25 words or fewer.
6. **`docs/index.html` was not edited.** Add a card for `processserver/`.

## Testing

Covered by the same Playwright run as HIC (see `bots/hic/NOTES.md`): 390×844 and 1280×900, with the Kit stub returning 200 at 390 px and 401 at 1280 px.
- The full suite passes, including the Kit POST to the `TAGID_PS` URL.
- The mock exam has 35 Q with a 35:00 timer, and its review list has 35 entries.
- Timer expiry, finish-early, unlock persistence and the free sample all work.
- There is no overflow and there are no JS errors.
