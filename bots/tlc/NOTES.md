# NYC TLC Driver License Exam practice test: build notes

Built 2026-11-13 on the same engine as `docs/hic` and `docs/guide`. The site is static: `docs/tlc/` holds `index.html`, `quiz.html`, `quiz.js`, `style.css` and `questions/TLC.json`. Serve it over HTTP, because the JSON is loaded with fetch(). Nothing is committed or pushed. The hub page `docs/index.html` and `docs/sitemap.xml` were not edited; add a `tlc/` card and sitemap entry when you publish.

## Build tooling

Everything is in `bots/tlc/_build/`:
- `tools/bank_tlc.py` holds the question bank (tuples with source key, PDF page and quote).
- `tools/build.py` verifies the bank and writes the JSON.
- `tools/make_sites.py` assembles the site.
- `tools/test_site.js` runs the Playwright tests.
- `tools/fetch.py` downloads a source and extracts its text (copied from `bots/hic`).
- `tools/sources.json` maps each URL to its text file.
- `src/*.txt` holds the extracted source text. PDF pages are split by form feed. The `*.paged.txt` copies add `=====PAGE n=====` markers for reading.

**Rebuild:**
```
cd bots/tlc/_build
python3 -I tools/make_sites.py ../../../docs ../../../docs/hic/quiz.js   # writes docs/tlc
node tools/test_site.js ../../../docs <shots_dir>                       # needs playwright
```

- `make_sites.py` exits non-zero on any pass-1 failure.
- I rebuilt after deleting the raw PDF/HTML downloads; the JSON is byte-identical.

## Kit email unlock

- `quiz.js` is generated from the live `docs/hic/quiz.js`, so the POST body, `api_key` and flow are identical. The key was compared by hash and never printed.
- Only these change:
  - `CONFIG`
  - `KIT_URL`, now `https://api.convertkit.com/v3/tags/TAGID_TLC/subscribe`
  - the two comments that name the tag
- **While the `TAGID_TLC` placeholder is unchanged**, a failed Kit call still unlocks locally (honor system), as on the other sites.
- **Once you put a real tag id in**, unlocking needs a 2xx response from Kit.
- The body sends `fields.building_address = "TLC"`.

## Exam facts (all from nyc.gov, fetched 2026-11-13)

| Fact | Source |
|---|---|
| 80 multiple-choice questions; 70% to pass = 56 correct | Licensing Education page; Study Guide p. 5 (PDF index) |
| Up to 2 hours; no breaks; on a computer | Licensing Education page; PSI bulletin p. 5, 7 |
| Given by PSI at test centers in all five boroughs (addresses on the Education page) | Licensing Education page |
| $49 per attempt, paid to PSI; unlimited attempts until the 90-day application expires; 24 h wait after a fail | PSI bulletin p. 5–6; Get a TLC Drivers License page |
| Cancel or reschedule by 2 days before, or lose the $49; arrive 15 min early; state-issued driver license; TLC sign-in form | PSI bulletin p. 5–6; Education page |
| PSI supplies a Geographia five-borough atlas, a Manhattan Address Key, paper and pencil; no calculators; result on screen | PSI bulletin p. 7 |
| Languages: English, Arabic, Bengali, Simplified Chinese, Russian, Spanish, Urdu | PSI bulletin p. 3 |
| The exam covers the 3-day (24-hour) course and the WAV course. The study guide lists 10 areas, including NYC geography. | Education page; Study Guide p. 5 |
| You must finish the 3-day course before booking. The 90-day window covers the course, the WAV course, a 6-h DDC, the drug test ($34), fingerprints ($90.25), the medical form, a 10-min sex trafficking video and the exam. | Education page; Get a TLC Drivers License page |
| The license costs $252 for 3 years ($84/yr, Ch. 80 §80-07). The 3-day course is $245–$250; WAV is $50–$125. Fees are non-refundable. | Get a TLC Drivers License page; Ch. 80 p. 13 |
| **English proficiency:** current Ch. 80 §80-04 (updated June 6, 2025) and the application page list no separate English test, and the exam is offered in 7 languages. I could not find an official TLC page that explains the history. | Ch. 80 pp. 5–11; PSI bulletin p. 3 |

**Mock exam:** the format is published, so the mock is 80 questions in 120 minutes, with no feedback until the end. The index page says that the real exam also has map and photo geography questions, and that TLC publishes no topic weighting.

**Source URLs** (under `https://www.nyc.gov/assets/tlc/downloads/pdf/` unless a full URL is given):
- `rule_book_current_chapter_80.pdf` (updated June 6, 2025)
- `rule_book_current_chapter_53.pdf` (updated April 15, 2025)
- `rule_book_current_chapter_51.pdf` (updated Oct 17, 2025)
- `driver_education_study_guide.pdf` (revised **May 2019**)
- `tlc_psi_candidate_information_bulletin.pdf` (Sept 2023)
- `universal_license_guide.pdf`
- `tlc_accessibility_programs.pdf` (Feb 2023)
- `driver-ed/wav_decal_english.pdf`
- `driver-ed/wav-securement-howto-print-english.pdf`
- https://www.nyc.gov/site/tlc/drivers/get-a-tlc-drivers-license.page
- https://www.nyc.gov/site/tlc/drivers/driver-education.page
- https://www.nyc.gov/site/tlc/passengers/taxi-fare.page
- https://www.nyc.gov/site/tlc/passengers/yellow-taxi-passenger-bill-of-rights.page
- https://www.nyc.gov/site/tlc/passengers/green-taxi-passenger-bill-of-rights.page
- https://www.nyc.gov/site/tlc/passengers/passenger-frequently-asked-questions.page
- https://www.nyc.gov/site/tlc/passengers/seat-belt-law.page
- https://www.nyc.gov/site/tlc/drivers/drug-testing-requirements.page

These were also read but are not cited by any question: the TLC Rules index, the License FAQ, Accessible Driver Requirements, WAV Resources, Defensive Driving, Driving While Distracted, Public Safety, Illegal Rides, Find an Accessible Ride, the Road to a TLC Driver License, the Fitness Rules Notice and Five Things You Should Know.

## Counts and verification

| Drafted | Trimmed (size/duplicates) | Pass-1 fails | Pass-2 drops | Final |
|---|---|---|---|---|
| 193 | 48 | 0 (5 fixed earlier) | 0 | **145** |

- **Trimmed:** the 48 trimmed items were weaker or duplicate questions, removed to stay under 150. None were cut for accuracy.
- **Fixed before the final run:** 2 wrong page numbers and 3 quotes over 25 words. All 3 long-quote items were among those trimmed.
- **Pass 1** (`build.py`) checks the same things as the HIC build:
  - 4 distinct options;
  - a quote of 25 words or fewer;
  - the quote appears verbatim on the cited PDF page (ignoring case, whitespace and punctuation);
  - for HTML sources, the quote appears anywhere on the page.
- **Negative test:** a changed Newark surcharge ($17.50) and a wrong page number were both caught.
- **Pass 2:** I re-read every question against its keyed answer. Conflicting or outdated material was avoided at drafting time (listed below), so there are no pass-2 drops and `drops.json` is not used.

**Topics:**

| Topic | Questions |
|---|---|
| The exam | 16 |
| Licensing | 18 |
| Rates and fares | 18 |
| Geography | 17 |
| Traffic laws and safety | 13 |
| Accessibility and WAV | 11 |
| Service refusal | 9 |
| Vehicle operation rules | 8 |
| Passenger solicitation | 8 |
| Proper conduct | 6 |
| Vehicle equipment | 6 |
| Passenger requests | 5 |
| Penalty programs | 5 |
| Lost property | 3 |
| Government and fines | 2 |

**Avoided on purpose** (conflicting or outdated):
- **All fare figures in the 2019 study guide.** It lists a $2.50 start, 50¢ units, a 30¢ improvement surcharge, a $52 JFK fare, a $17.50 Newark surcharge, a $4.50 JFK rush surcharge and a $3 group ride. Fare questions use the current Taxi Fare page only.
- **The study guide's Accessible Dispatch fee table** ($15–$35). Ch. 53 says the schedule is reset every six months on the website.
- **"How long before you may refuse a Westchester/Nassau/Newark trip."** Ch. 80 §80-20(b)(8) says 8 hours in any 24. The Passenger FAQ (citing old Rule 54) says 12 consecutive hours.
- **The phone-violation fine.** The Distracted Driving page says $200; Ch. 80 says $250/$350. Points (3/3/4) agree in both and are used.
- **Revocation on a third phone offense** (the Distracted Driving page says it; Ch. 80 does not).
- **The Public Safety page's "refresher course once a year"**, which conflicts with the 3-year renewal course.
- **The Fitness Rules Notice (2020)**, which uses the old Critical Driver Program wording. Questions cite Ch. 80 §80-08 and §80-27 instead.
- **Airport terminal and airline assignments, FDR exit numbers and the "Hugh M. Carey" spelling**, which are dated or wrong in the 2019 guide.
- **E-hail "meter not turned on"** (the fare page) versus Ch. 80 §80-17(j)(3) (meter used unless Flex Fare).

**Answer-length tell:** after one rewrite pass on the distractors, the correct option is strictly the longest in 70 of 145 items (48%). No item has a gap of more than 1.6×. Answer positions are A 42, B 32, C 33, D 38.

## Uncertain / to check

1. **The study guide is from May 2019** and is still linked by TLC as the free study guide. Its non-fare content (geography, Vision Zero tips) is used. The 25 mph default limit and the turn-statistic wording come from it.
2. **The study guide's own sample answer key** says the Empire State Building is at "34th and Broadway", but its text says Fifth Ave at 34th St. I did not use that item.
3. **The study guide's Staten Island page reprints the Bronx highway list** (a copy error). No question in the final bank cites that page.
4. **The PSI bulletin is dated 2023.** Its facts (80 Q, 2 h, $49) match the live Education page.
5. **Real-exam geography is map and photo based.** This bank only approximates it in text; the index page says so.
6. **The fare page is live** and includes the 75¢ congestion pricing toll. Recheck it if MTA tolls change.
7. **The "$14.99 prep pack" button** (`#buy`) is inherited from the shared template, as on HIC.

## Testing

Run with Playwright Chromium, served by `python3 -m http.server` on 127.0.0.1:8793 against the real `docs/` folder. `api.convertkit.com` is routed to a stub: 200 at 390 px, 401 at 1280 px (which tests the placeholder fallback).

68/68 checks pass at 390×844 and 1280×900:
- **Index page:** question count, disclaimer, SEO title and description (160 characters), the 80 Q / 2 h format text, 12 nyc.gov citation links.
- **Free sample:** 10 free questions with source and quote, then the score and the gate.
- **Gate:**
  - an invalid email is rejected with no Kit call;
  - the Kit POST goes to the `TAGID_TLC` URL with the right body (the `api_key` is checked as present but never printed);
  - unlock persists after reload;
  - the full bank of 145 loads.
- **Mock exam:**
  - 80 Q with a 2:00:00 timer and no feedback during the exam;
  - the review list has 80 entries;
  - finishing early scores 0;
  - the timer ends the exam when it runs out.
- **Error case:** an invalid `?exam=` shows an error message.
- **Every screen:** no horizontal overflow and no JS errors.

I also checked a dark-mode screenshot. The buy button gets dark text in dark mode via a small CSS override.
