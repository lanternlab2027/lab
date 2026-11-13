# NYC Sightseeing Guide + Food Protection practice tests: build notes

Built 2026-11-13. These are two standalone static sites built on the CoF engine:
- `guide/`: DCWP Sightseeing Guide license exam.
- `food/`: DOHMH Food Protection Certificate.

Each site has `index.html`, `quiz.html`, `quiz.js`, `style.css` and `questions/<CODE>.json`. Serve them over HTTP (for example `python3 -m http.server`), because the JSON is loaded with fetch().

Build tooling is in `_build/`:
- `tools/build.py` verifies the banks and writes the JSON.
- `tools/make_sites.py` assembles both sites.
- `tools/test_sites.js` runs the Playwright tests.
- `tools/fetch.py` downloads sources and extracts their text.
- `tools/bank_*.py` holds the question banks.
- `src/*.txt` holds the extracted source text.

Rebuild with `python3 -I _build/tools/make_sites.py <out>`. It exits non-zero on any pass-1 failure.

## Counts

| Exam | Drafted | Pass-1 fails (fixed) | Pass-2 drops | Final |
|---|---|---|---|---|
| Sightseeing Guide (`GUIDE`) | 169 | 13 (11 wrong page, 2 quotes >25 words) | 2 | **167** |
| Food Protection (`FPC`) | 132 | 0 | 1 | **131** |

- **Pass 1** checks four things:
  - each item has 4 distinct options;
  - the quote is 25 words or fewer;
  - the quote appears verbatim, ignoring case, whitespace and punctuation, on the cited PDF page;
  - for HTML sources, the quote appears anywhere on the fetched page, and `page` is `null`.
- **Negative test:** a changed number and a wrong page number were both caught. I found and fixed a stale-`.pyc` bug: `build.py` now sets `dont_write_bytecode`.
- **Pass 2** was a manual re-read. The drops, also in `_build/tools/drops.json`:
  - GUIDE: "question formats". The Study Reference says "Multiple Choice or True/False", but the DCWP exam FAQ (11/21/2025) says "150 multiple choice questions".
  - GUIDE: "CIG has how many members". The DCLA page says 39 but lists 40 institutions.
  - FPC: "raw shell eggs at 45°F". Manual pp84–85 says 45°F, but Study Guide p2 says all cold food is at or below 41°F with smoked fish as the only exception.
- **Pass-2 fixes:**
  - The Tweed/Department of Education item was re-cited from the old Office of the Mayor page to the current DCAS page.
  - I removed an unsourced claim that the Art Commission is "now the Public Design Commission".
- **Avoided on purpose** (sources conflict, or the fact is likely outdated):
  - FPC: the number of thawing methods (Study Guide says 3, manual p88 says 4).
  - FPC: rat entry-hole size (Study Guide says the size of a quarter, manual p93 says under ½ inch).
  - FPC: allergen count (the 2015 manual lists 8; sesame became the 9th federal major allergen in 2023).
  - GUIDE: Carl Schurz Park renaming year (the same curriculum says 1909 on p11 and 1910 on p15).
  - GUIDE: WWII entry date (the curriculum has a typo, 1945).
  - GUIDE: when Eidlitz was hired for Tweed (DCAS says 1876, the Mayor's page says 1874).

## Sources (all fetched 2026-11-13 with a browser User-Agent; page numbers are 1-based PDF page indexes)

**Guide: exam facts**
- Study Reference PDF (modified 2026-03-27, 3 pp.): https://www.nyc.gov/assets/dca/downloads/pdf/businesses/Sightseeing-Guide-Study-Reference.pdf
- License checklist page: https://www.nyc.gov/site/dca/businesses/license-checklist-sightseeing-guide.page (its PDF version is dated 05/29/2025)
- Licensing FAQs: Exams PDF (11/21/2025): https://www.nyc.gov/assets/dca/downloads/pdf/businesses/Licensing-FAQs-Exams.pdf
- Sightseeing Bus inspection checklist PDF (10/2023): https://www.nyc.gov/assets/dca/downloads/pdf/businesses/SightseeingBus.pdf

**Guide: content**
DCWP's Study Reference is only a syllabus that points to commercial books, so the questions come from other www.nyc.gov pages:
- NYC DOT: charter and tour buses, truck routing, Staten Island Ferry (and its facts page), Bridges, Brooklyn/Manhattan/Queensboro/Williamsburg/Harlem River bridge pages.
- Office of the Mayor: Gracie Mansion student guide PDF, Gracie teacher/docent curriculum PDF, Tweed Courthouse history page.
- Gracie Mansion Conservancy brochure (hosted on nyc.gov).
- DCAS: City Hall, Tweed Courthouse and Surrogate's Courthouse pages.
- DCLA: agency history, the Cultural Institutions Group, and the history of the CIG.
- LPC: About LPC, Discover NYC Landmarks FAQ PDF, and 7 designation press releases (2019–2026).
- City Planning: The Newest New Yorkers (2013), chapter 1 PDF.

The full URLs are in `_build/tools/sources.json` and in every question's `source.url`.

**Food: exam facts**
- Online course page: https://www.nyc.gov/site/doh/business/health-academy/food-protection-online-free.page
- Classroom course page: https://www.nyc.gov/site/doh/business/health-academy/food-protection-classroom.page
- Online course FAQ PDF (modified 2025-01-15): https://www.nyc.gov/assets/doh/downloads/pdf/hany/food-protection-course-faq.pdf
- **50 questions / 1 hour / 70%:** from https://a816-healthpsi.nyc.gov/prjFPC/F2964_CourseDetail.aspx. That domain is **blocked for curl** here, so I read it through a web-fetch summarizer. The quotes I got back were "The final exam consists of 50 multiple choice questions and lasts one hour." and "You must answer 70% or more of the questions correctly…". Script-verifying them was not possible.

**Food: content**
- Study Guide PDF (2017, 8 pp.): https://www.nyc.gov/assets/doh/downloads/pdf/rii/study-guide.pdf
- Training Manual PDF (modified 2015, 94 pp.): https://www.nyc.gov/assets/doh/downloads/pdf/rii/fpc-manual.pdf

## Real-exam facts used on the landing pages

**Guide**
- 150 questions; at least 97 correct to pass (about 64.7%).
- $50 exam fee, nonrefundable and separate from the license fee.
- 2-year license expiring March 31 of even years; license fee $13–$63 depending on filing date; 2% fee on card payments.
- Run by ExamBuilder: book online or at (646) 974-8244.
- Test centers citywide, 9–5, seven days a week. Book 24 h after DCWP processes the application; 60-day window to pass.
- Two attempts: wait 24 h after a first fail; after a second fail, pay the $50 again. A no-show is a fail.
- Bring government photo ID with signature. Results are given immediately.
- New applicants only; applicants must be 18 or older.
- Accommodations are at 42 Broadway.

**Food**
- 50 multiple-choice questions, 1 hour, 70% to pass.
- The online course is free: 15 lessons, offered in English, Spanish and Chinese. The study guide and exam are offered in English and 36 other languages.
- Exam costs $24, plus $0.60 for card payment. Credit card only; the FAQ says debit cards are not accepted.
- Taken in person at the NYC Health Academy (Riverside Health Center, 160 W 100th St) or the College of Staten Island (which sets its own fees).
- Bring photo ID and the printed confirmation page.
- Classroom alternative: $114 for 15 h over 5 days, with the exam on day 5 and the certificate the same day.
- The certificate never expires and arrives 2–6 weeks after the online-route exam.
- Unlimited retakes, but you must redo the course and pay for the exam each time.

## Uncertain facts / things to check

1. **Guide time limit is not published** in the checklist, the FAQ or the Study Reference. The mock timers use a practice pace of 1 min/question (150 Q = 150 min; short mock 50 Q = 50 min), and the site says so. Ask ExamBuilder for the real limit.
2. **Guide question format:** the FAQ says multiple choice and the Study Reference says multiple choice or true/false. The landing page states both. The bank is all 4-option multiple choice.
3. **Guide retake wording:** the Study Reference p2 says you "may return to take another version of the examination within 10 days". The FAQ says to wait 24 h before booking the second attempt. The landing page uses the FAQ (the newer source).
4. **Guide coverage gap (important):** the bank covers only the topics that free nyc.gov pages cover:
   - covered: licensing, tour-bus rules, ferry, bridges, history, landmarks and architecture, museums, immigration;
   - **not covered:** the 9 authors, music/theatre/dance, ethnic foods, religion, public sculpture, parks and cemeteries, subway/bus map details, Arts for Transit, Midtown Thru Streets, travel-industry terms.

   The landing page says this plainly. NYC Parks (nycgovparks.org), MTA, LPC designation reports (s-media.nyc.gov) and NYC & Company were all blocked, and those are the obvious sources for the gaps.
5. **Time-sensitive guide items:**
   - two tour-bus questions come from DOT's *holiday-season* (Dec 2025–Jan 2026) rules: the Brooklyn Bridge is not a permitted crossing, and there are no Fifth Ave 32nd–59th pick-ups;
   - the LPC landmark counts (1,470 / 125 / 12) and ferry ridership will drift.

   Re-run `build.py` after re-fetching; changed pages show up as quote-not-found failures.
6. **Food Health Academy floor:** the web page says Third Floor and the FAQ says 2nd floor. The site says to check your confirmation.
7. **Food materials are old** (manual 2015, study guide 2017). The NYC Health Code has been amended since, so spot-check temperatures and rules against the current online course before charging money.
8. **The FPC "50 Q / 1 hr / 70%" facts** come from the blocked a816-healthpsi.nyc.gov page via a summarizer (see Sources). Confirm them in a browser.
9. **Kit:** `KIT_URL` uses the `TAGID` placeholder (`/v3/tags/TAGID/subscribe`), and `KIT_KEY` is kept from the CoF site. While `TAGID` is unchanged the page unlocks even if the request fails (for testing). Once a real tag is set, unlocking needs a 2xx response. The POST still sends `fields.building_address = <exam code>` (`GUIDE` / `FPC`), exactly like CoF. Rename the field if you want something clearer in Kit.
10. **Copyright:** questions are paraphrased, and quotes are 25 words or fewer with attribution. City publications are public, but the Gracie brochure is © Gracie Mansion Conservancy. Worth a legal glance before selling.

## Testing (Playwright Chromium, 390×844, served by `python3 -m http.server` on 127.0.0.1:8791)

`_build/tools/test_sites.js` covers both sites. All 60 checks pass:
- **Index page:** shows the question count, the disclaimer text and the citation links.
- **Free sample:** 10 free questions, with feedback that shows the source and quote. The score and the gate appear after the 10th.
- **Gate:**
  - an invalid email is rejected;
  - the Kit POST is intercepted and checked (URL with `TAGID`, body);
  - unlock works and persists after reload.
- **Full bank and mocks:**
  - the full bank loads (167 / 131);
  - guide mocks: 150 Q with a 2:30:00 timer, and 50 Q with a 50:00 timer;
  - food mock: 50 Q with a 1:00:00 timer;
  - no feedback is shown during a mock;
  - finishing early counts unanswered questions as wrong;
  - the review list has the right length;
  - the timer ends the exam when it runs out (clock fast-forwarded).
- **Error case:** an invalid `?exam=` shows an error message.
- **Every screen:** no horizontal overflow at 390 px, and no JS errors.

I also checked a dark-mode screenshot. Port 8765 was already taken by another process (a "Lab" server), which I left alone.
