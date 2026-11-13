# FDNY CoF practice tests: build notes

Built 2026-11-13. The site is static (`index.html`, `quiz.html`, `quiz.js`, `style.css`, `questions/*.json`). It uses no external JS.
It must be served over HTTP, because `quiz.js` fetch()es the JSON and fetch fails from `file://`. Any static host works, as does `python3 -m http.server`.

## Exams chosen and why

| Code | Title | Why |
|---|---|---|
| F-03 | Indoor Place of Assembly Safety Personnel | Most-held premises CoF in NYC Open Data: 20,489 records |
| S-95 | Supervision of Fire Alarm Systems | 2nd most-held: 17,958 records. Required for any approved fire alarm system without voice comms where no FLSD/F-80 is required |
| F-01 | Fire Guard for Impairment (Citywide) | Required after 4 h of any sprinkler, standpipe or fire alarm impairment, 24 h/day, at least 1 guard per 50,000 sq ft. This drives large fire-guard staffing volume, especially at construction sites |
| F-60 | Fire Guard for Torch Operations | Required for every torch operation at construction sites, on rooftops and under citywide torch permits |

- **Demand evidence:** the counts come from NYC Open Data, "Bureau of Fire Prevention – Certificates of Fitness (Historical)" (dataset `pdiy-9ae5`, 128,293 rows, expirations 2017–2025). I aggregated by `cof_type` only and stored no names.
  - That dataset is premises-based and appears **not** to include citywide CoFs (F-01, F-60 and F-04 are absent).
  - So the F-01/F-60 demand is argued from the code requirements above, not counted.
- **F-04:** it uses the **same booklet** as F-03. The PDFs at `cof-f03-…` and `cof-f04-…` are byte-identical, and the F-04 test excludes only booklet section 2 (theaters).
  - The 7 theater questions in `F-03.json` are tagged `"theater_section": true`.
  - An F-04 bank is therefore `F-03` minus those 7 = 42 questions, at near-zero extra cost.
- **Code corrections to the brief:** per FDNY's CoF list, F-02 is *Fire Guard for Shelters* (not torch), torch fire guard is **F-60**, and F-89 is *Fire and Life Safety Director* (not shelters).

## Source PDFs (all downloaded 2026-11-13; page numbers = PDF page index, 1-based)

- F-01: https://www.nyc.gov/assets/fdny/downloads/pdf/business/cof-f01-noe-study-materials.pdf (revised Jan 2026, 37 pp.)
- F-03/F-04: https://www.nyc.gov/assets/fdny/downloads/pdf/business/cof-f03-noe-study-materials.pdf (revised Jan 2026, 59 pp.)
- F-60: https://www.nyc.gov/assets/fdny/downloads/pdf/business/cof-f60-noe-study-materials.pdf (revised Jan 2026, 35 pp.)
- S-95: https://www.nyc.gov/assets/fdny/downloads/pdf/business/cof-s95-noe-study-materials.pdf (revised **Oct 2026**, 52 pp.)
- General Notice of Exam: https://www.nyc.gov/assets/fdny/downloads/pdf/business/general-notice-of-exam-cof.pdf (rev. 07/2023)

The FDNY exam pages for F-01/F-03/F-04/F-60 link only to nyc.gov/nycbusiness "Learn more" pages, which were blocked from this sandbox. I found the PDF URLs by the standard `cof-<code>-noe-study-materials.pdf` pattern. Each booklet cites its own URL as the latest version.

Copies and extracted text are in `src/pdf/`, with page-tagged text in `src/pdf/*.pages.txt`.

## Question counts and verification

| Exam | Drafted | Pass-1 fails (fixed) | Pass-2 drops | Final |
|---|---|---|---|---|
| F-01 | 54 | 3 | 1 | **53** |
| F-03 | 49 | 2 | 0 | **49** |
| F-60 | 47 | 5 | 0 | **47** |
| S-95 | 52 | 0 | 1 | **51** |
| **Total** | 202 | 10 | **2** | **200** |

- **Pass 1 (automatic, `tools/build.py`):** checks that each item has 4 distinct options, a quote of 25 words or fewer, and a quote that appears verbatim (ignoring whitespace and punctuation) on the cited PDF page.
  - 10 items failed. 8 had a quote over 25 words and were trimmed; 2 cited the wrong page (off by one) and were corrected.
  - All 200 final items pass.
- **Pass 2 (manual re-read):** I read every answer against the booklet text.
  - **Dropped (2):**
    - F-01 "inspection record kept how long". The source paragraph says both "at least 3 years" and "at least 48 hours after the fire watch has finished".
    - S-95 "Does FDNY respond to supervisory signals?" p16 says no, but p21 (CO) and p29 (gas detectors) describe FDNY involvement in supervisory signals.
  - **Fixed (2, S-95):**
    - The silence/reset question was narrowed to reset only (p19). The booklet contradicts itself on *silencing* (p19 vs p20).
    - The analog-detector cleaning question was re-cited to p41, which explicitly says "analog".
  - Drop reasons are in `tools/drops.json`. Rebuild with `python3 -I tools/build.py`; it exits non-zero on any pass-1 failure.

## Real-exam facts (shown on index.html, each with a citation link)

**Format**
- Computer-based, touch screen, multiple choice, timed. 70% is needed to pass. Source: General NOE PDF p.4.
- Each question has 4 choices and there is no penalty for guessing. Source: F-03 booklet p.7.
- "Most exams have 20-25 questions." Source: Understanding COFs page.

**Per-exam length** (from each booklet)

| Exam | Questions | Time | Booklet page |
|---|---|---|---|
| F-01 | 20 | 30 min | p.5 |
| F-03 | 25 | 38 min | p.5 |
| F-04 | 20 | 30 min | p.5 |
| F-60 | 25 | 38 min | pp.3–4 |
| S-95 | **35** | **53 min** | p.5 |

S-95 is longer than the "20–25" norm.

**Fee and payment**
- Most exams cost $25, with a 2% convenience fee on card payments. Sources: Understanding COFs; General NOE p.3.

**Where and when**
- FDNY HQ, 9 MetroTech Center, Brooklyn (Flatbush Ave entrance).
- Walk-in Monday to Friday, 8:00 AM to 2:30 PM, except holidays.
- Apply and pay online first, and bring a government photo ID.
- Sources: Certificates of Fitness page; General NOE pp.2, 4.

**On the day**
- English only. A paper dictionary is the only aid allowed.
- Results are given immediately and the card is issued the same day.
- Allow at least 2 hours. You can take up to 2 exams per day.
- Sources: Understanding COFs; General NOE pp.4–5.

**Renewal**
- Most CoFs renew every 3 years, and the renewal fee is $15. Source: General NOE p.6.

**Prep courses**
- FDNY "do[es] not approve any prep courses". Source: Understanding COFs. This is mentioned on the landing page.

## Uncertain / to check

1. **Cash:** the "Understanding COFs" page still lists cash, but the newer CoF list page, the General NOE and every booklet say cash is not accepted. The site says no cash.
2. **Answer-length tell:** in many items the correct option is the longest or most specific. Options are shuffled, but a copy-edit pass to balance option lengths would make the bank harder to game.
3. **Booklet errors:**
   - The F-01 Appendix A footnote calls the construction watchperson an "F-60" holder, while the F-60 booklet says watchpersons need S-60. I wrote no question on this.
   - The F-01 booklet says pull station handles must be "at least 4 feet from the floor". I skipped it as likely garbled.
4. **Questions are paraphrased.** Explanations restate the booklet, and only short verbatim quotes (25 words or fewer) are shown. The booklets carry "© FDNY – All rights reserved". This is short quotation with attribution, but worth a legal glance before charging money.
5. **Booklets get revised** (S-95 was revised Oct 2026). Re-run `tools/build.py` after re-downloading the PDFs; a revision will show up as quote-not-found failures.
6. **Email gate:** it POSTs exactly as specified, with the `TAGID` and `KIT_PUBLIC_KEY` placeholders left in.
   - While those placeholders are unchanged, the page unlocks even though the request fails, so it can be tested.
   - Once real values are filled in, unlock requires a 2xx response.
   - Unlock is saved per exam in localStorage (honor system).
7. **Kit API:** confirm that Kit's v3 tag-subscribe endpoint accepts a JSON `api_key` with a custom field named `building_address`. The field must exist in the Kit account, or it is silently ignored.

## Testing

Tested with Playwright (Chromium) at 390×844:
- Index page and all 4 quizzes: 10 free questions with feedback, then the score, then the gate.
- Signup sends the correct Kit POST body (verified by intercepting the request).
- After signup, the unlocked panel and the $14.99 `#buy` button appear.
- S-95 mock exam: 35 questions, 53:00 timer, review list.
- The full bank loads, the unlock persists after reload, and an invalid `?exam=` shows a friendly error.
- No horizontal overflow and no JS errors. The only console error was the intentionally mocked 401 from Kit.
