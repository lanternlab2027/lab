# NYC Home Improvement Contractor (HIC) practice test: build notes

Built 2026-11-13 on the same engine as `docs/guide` and `docs/food`. The site is static: `docs/hic/` holds `index.html`, `quiz.html`, `quiz.js`, `style.css` and `questions/HIC.json`. Serve it over HTTP, because the JSON is loaded with fetch(). Nothing is committed or pushed.

## Build tooling (shared with the Process Server site)

Everything is in `bots/hic/_build/`:
- `tools/bank_hic.py` and `tools/bank_ps.py` hold the question banks.
- `tools/build.py` verifies the banks and writes the JSON.
- `tools/make_sites.py` assembles both sites.
- `tools/test_sites.js` runs the Playwright tests.
- `tools/fetch.py` downloads sources and extracts their text.
- `tools/drops.json` lists pass-2 drops with reasons.
- `tools/sources.json` maps each URL to its text file.
- `src/*.txt` holds the extracted source text. Pages are split by form feed (`\f`), so `\f` count + 1 = PDF page index.

**Rebuild:**
```
cd bots/hic/_build
python3 -I tools/make_sites.py <out_dir> ../../../docs/guide/quiz.js   # writes <out>/hic and <out>/processserver
node tools/test_sites.js <out_dir> <shots_dir>                          # needs playwright
```

- `make_sites.py` exits non-zero on any pass-1 failure.
- I rebuilt from this copy and diffed the output against `docs/hic`; they are identical.

## Kit email unlock

- `quiz.js` is generated from the live `docs/guide/quiz.js`, so the POST body, `api_key` and flow are identical. Only these change:
  - `CONFIG`
  - `KIT_URL`, now `https://api.convertkit.com/v3/tags/TAGID_HIC/subscribe`
  - `notConfigured`, now true while the URL still contains `/TAGID_`
- **While the `TAGID_HIC` placeholder is unchanged**, a failed Kit call still unlocks locally (honor system), as in earlier builds.
- **Once you put a real tag id in**, unlocking needs a 2xx response from Kit.
- The body sends `fields.building_address = "HIC"`, the same field the other sites use.

## Exam facts (all from nyc.gov, fetched 2026-11-13)

| Fact | Source |
|---|---|
| 30 multiple-choice questions; at least 21 correct to pass (70%) | License checklist page; Exam FAQ PDF (11/21/2025) p4 |
| **Time limit is not published.** The mock uses 30 Q / 30 min (1 min per question), and the page says so. | (none) |
| New applicants only. One qualifying person passes: sole proprietor, general partner, officer, principal, director, member, or 10%+ shareholder. | FAQ p1 and p4; checklist |
| The application fee includes 2 attempts. After 2 failures, $50 buys 2 more. | Checklist; FAQ p2–3 |
| ExamBuilder administers the exam: dcaschedule.exambuilder.com or (646) 974-8244. Book 24 h after DCWP processes the application; then 60 days to pass. | Checklist; FAQ p1 |
| Test centers citywide, 9–5, seven days a week. Accommodations are at 42 Broadway. | Checklist; FAQ p2 |
| Wait 24 h after a first fail. Reschedule by 5 pm the day before. A no-show is a fail. | FAQ p2–3 |
| Bring one government photo ID with signature. Results are given immediately. | FAQ p3 |
| 2-year license expiring Feb 28 of odd years. License fee is $50–$250 by filing date ($200 for 24 months). 2% card fee. | Checklist |
| Trust Fund costs $200; otherwise a $20,000 surety bond. | Checklist; Trust Fund form (9/11/2026) |

**Source URLs** (all under `https://www.nyc.gov/assets/dca/downloads/pdf/businesses/` unless a full URL is given):
- `Home-Improvement-Business-Exam-Guide.pdf` (updated **06/24/2021**, 10 pp.)
- License checklist page: https://www.nyc.gov/site/dca/businesses/license-checklist-home-improvement-contractor.page (its printable PDF is dated 9/11/2026)
- `Licensing-FAQs-Exams.pdf` (11/21/2025)
- `DCAInspectionChecklist_HomeImprovement.pdf` (06/2026)
- `Home-Improvement-Contractor-Contractual-Compliance.pdf` (09/11/2026)
- `Home-Improvement-Model-Contract.pdf` (estimate, contract, notice of cancellation, permit disclosure and change order; modified 6/2026)
- `Home-Improvement-Contractor-Trust-Fund-Enrollment.pdf` (09/11/2026)
- `HICSelfAffirmation.pdf` (12/21/2021)
- DCWP New Laws and Rules page: https://www.nyc.gov/site/dca/about/new-laws-rules.page
- `Process-Server-Educational-Materials.pdf` pp. 22–39, used only for the general **License Enforcement** law and rules (Admin Code ch. 1 and 6 RCNY ch. 1) that apply to all DCWP licensees.

## Counts and verification

| | Drafted | Pass-1 fails | Pass-2 drops | Final |
|---|---|---|---|---|
| HIC | 147 | 0 | 3 | **144** |

**Pass 1** (`build.py`) checks four things:
- 4 distinct options;
- a quote of 25 words or fewer;
- the quote appears verbatim on the cited PDF page (ignoring case, whitespace and punctuation);
- for HTML sources, the quote appears anywhere on the page.

A negative test (a changed $ amount and a wrong page) was caught. All 144 final items pass.

**Pass 2** was a manual re-read. Drops are in `drops.json`; all three are source conflicts:
1. **How to apply.** The 2021 guide says in person at 42 Broadway or Jamaica, or online. The 2026 checklist says in-person appointments are for hardship cases only.
2. **Address or trade-name change notice.** The guide and Admin Code §20-112 say at least 10 days *before*. 6 RCNY §1-08 says *within* 10 days of the change. This topic is likely on the real exam (the guide states it plainly); re-add it if you are comfortable using the guide's version.
3. **Who obtains permits.** The 2021 guide says the prime contractor secures all permits and cannot shift responsibility. The 2026 forms (after Local Law 181 of 2025, rule effective 6/19/2026) say the "appropriate party" may be the HIC or another licensed professional.

**Avoided on purpose** (never written):
- the guide's "$500 per misrepresentation" and "6 months / $1,000" criminal figures (could not check them against the current Code);
- trust-fund payment "every two years" (the guide conflicts with the 2026 checklist's $2M rule);
- the exterior-painting scaffold item (the guide's heading says "more than one story" but its answer says "one story or more");
- the renewal package "mailed 3 months before";
- whether the consumer pays the DOB fine (the model estimate and model contract word it differently);
- who signs the permit disclosure (the inspection checklist and compliance checklist differ);
- the 6 RCNY 1-10 replacement-license fee (Local Law 183 of 2025 removed it).

**Answer-length tell:** after two rewrite passes on the distractors, the correct option is still strictly the longest in 78 of 144 items (54%), but only 1 item has a gap of more than 1.6×.

## Uncertain / to check

1. **The Examination Guide is from 2021.** DCWP still links it as the current guide. The newest rules (permit disclosure, Trust Fund amendments 2023 and 2025) are not in it, and the real exam may or may not reflect them.
2. **"Less than $200" job exemption** (guide p2). It is consistent with my knowledge, but I could not check it against the current Admin Code text.
3. **Blocked from this sandbox:** the NYC Admin Code and Rules (codelibrary.amlegal.com, rules.cityofnewyork.us) and Council legislation (legistar.council.nyc.gov). I could read only DCWP's summaries of the local laws.
4. **Copyright:** questions are paraphrased, and the quotes from City publications are 25 words or fewer. No prep-book text was used.
5. **The landing hub `docs/index.html` was not edited.** Add cards for `hic/` and `processserver/` when you publish.

## Testing

Run with Playwright Chromium, served by `python3 -m http.server` on 127.0.0.1:8792. `api.convertkit.com` is routed to a stub: 200 at 390 px, 401 at 1280 px (which tests the placeholder fallback).

132/132 checks pass across both sites at 390×844 and 1280×900:
- **Index page:** question count, disclaimer, "time limit not published" text, nyc.gov citation links.
- **Free sample:** 10 free questions with source and quote, then the score and the gate.
- **Gate:**
  - an invalid email is rejected with no Kit call;
  - the Kit POST goes to the `TAGID_HIC` URL with the right body (the `api_key` is checked as present but never printed);
  - unlock persists after reload;
  - the full bank loads.
- **Mock exam:**
  - 30 Q with a 30:00 timer and no feedback during the exam;
  - the review list has 30 entries;
  - finishing early scores 0;
  - the timer ends the exam when it runs out.
- **Error case:** an invalid `?exam=` shows an error message.
- **Every screen:** no horizontal overflow and no JS errors.

I also checked a dark-mode screenshot.
