# NYC Then: notes

Page: `docs/then/` (served at https://lanternlab2027.github.io/lab/then/). Spec: `bots/ideas/APPS_ROUND1.md`, idea #6 (niche daily guessing game).
Built and tested Nov 14, 2026. Not committed.

**Heads-up:** `docs/then/` and `bots/then/` are listed in `.git/info/exclude` ("WIP agent output"). Remove those two lines before committing, or git won't see the files.

## What it does

- One historical NYC photo per day from the Library of Congress. Players guess the year in up to 5 tries, using a slider with -10/-1/+1/+10 buttons (arrow keys and Enter work on desktop).
- Each miss shows "Later" or "Earlier" and how close it was. The slider then narrows to the years still possible.
  - Green: exact year.
  - Yellow: within 3 years.
  - Orange: within 10 years.
  - Black: more than 10 years off.
- Bonus: guess the borough (one try). Bridge photos accept either borough they connect.
- Share text looks like `NYC Then #7 ⬛🟧🟨🟩 4/5 📍✅` with `lanternlab2027.github.io/lab/then` on the next line. It uses Web Share on phones and copies to the clipboard otherwise, with an execCommand fallback.
- The answer screen shows:
  - year, place and borough;
  - the LOC caption, quoted verbatim, plus the LOC summary when the record has one (18 photos do);
  - a one-line "Did you know?" about the place;
  - credit, the LOC catalog date, a link to the LOC item, and the rights statement.
- Stats live in localStorage under `nycthen:v1`, and every access is wrapped in try/catch, so the game still plays when storage is blocked.
  - Tracked: played, win %, current streak, best streak and the guess distribution.
  - Only days played on their own date count toward streaks. Archive plays count as played.
- Archive: lists every puzzle from #1 up to today, newest first. `?n=N` opens a past puzzle; future numbers fall back to today.
- Countdown to the next puzzle at New York midnight.
- "Daily reminder" email signup uses Kit, following the `docs/ll97/` pattern: same public api_key, tag placeholder **`TAGID_THEN`**, and the request body is only `api_key` + `email`.
- No tracking, no CDN, system fonts only.
  - CSP: `script-src 'self'` and `connect-src 'self' https://api.convertkit.com`.
  - `referrer: no-referrer`.

## Daily schedule

- Puzzle #1 is **2026-11-14**, the America/New_York calendar date (`EPOCH` in `docs/then/game.js`, mirrored in `schedule.json`).
- Puzzle number = NY calendar date − epoch + 1. It is computed with `Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York'})` and then whole-day UTC math, so DST has no effect.
- Day N shows `photos[(N-1) % 124]`.
  - The list is a fixed, seeded shuffle (seed 20261114), with the same place never on two days in a row.
  - Any 124 consecutive days show 124 different photos, so there are no repeats within 120 days. The tests check every window from #1 to #520.
- To change the launch date, edit `EPOCH` in `game.js` (and `epoch` in `build.py` for consistency). It is currently today, so #1 is live now.
- To add photos later: append them to the **end** of `photos` (re-running `build.py` reshuffles everything). Adding photos changes which photo old archive numbers map to after the first cycle, so it's better to append only.

## Data (124 photos, 1900–1963)

| Source | Count | Years | Rights statement on LOC record |
|---|---|---|---|
| Detroit Publishing Co. | 47 | 1900–1915 | "No known restrictions on publication." |
| Gottscho-Schleisner | 39 | 1916–1963 | "No known restrictions on publication. For information, see: Gottscho-Schleisner Collection..." |
| Bain News Service | 25 | 1907–1922 | "No known restrictions on publication." (some add a link to the Bain rights page) |
| FSA/OWI | 13 | 1941–1943 | "No known restrictions. For information, see U.S. Farm Security Administration/Office of War Information..." |

- **Rights:** `build.py` re-fetches every item's live LOC JSON record and stops if `rights_advisory` doesn't start with "No known restrictions".
  - The exact statement and check date (`rights_checked`) are saved per photo.
  - One pick (2018739343) had a broken LOC record (a redirect loop), so it was skipped rather than published unverified.
- **Dates:** only single-year catalog dates are used. The parser (`curate.parse_year`) rejects ranges, "ca.", "?" and decades.
  - Detroit dates are copyright years ("c1905."). They are almost always the year the photo was taken, but not guaranteed.
  - Bain and FSA dates are often the exact day.
- **Recognizable places:** picks were matched against a landmark list, then hand-reviewed on contact sheets.
  - Dropped: generic crowds and portraits, too-dark night shots, and an anarchist-bomb casualty photo.
  - Borough split: Manhattan 104, Brooklyn 13, Queens 4 (+ bridges), Bronx 3, Staten Island 0.
- **No spoilers in the image:** these negatives often have scratched captions, negative numbers, "COPYRIGHT 1901 DETROIT PHOTOGRAPHIC CO" seals, or "OWI-…" numbers, some of which include dates.
  - Each collection gets its own crop (`TRIM` in `build.py`), with per-photo overrides in `make_picks.py`.
  - Every photo's edges were checked by eye after cropping.
  - File names are hashes, so they don't leak the year.
- **Images:** max 900px wide (720 for portrait), JPEG under 118KB each, 9.8MB total.
  - Gottscho scans only exist at about 420px on LOC, so those 39 look softer. The page never upscales an image past 1.6x.
- **"Did you know?" lines** are mine, not from LOC (`bots/then/facts.py`, one per place). They are well-documented facts written conservatively. **Matt may want to skim them.** The LOC caption and summary are shown separately and verbatim.

## Pipeline (all in `bots/then/`)

1. `harvest.py`: queries the loc.gov collection JSON API. Raw output went to the scratchpad and is not in the repo.
2. `curate.py`: filters rights, NYC place, single year, and landmark.
3. `contact_sheet.py`: makes the visual review sheets.
4. `make_picks.py`: hand-chosen IDs plus place/borough/crop overrides, written to `picks.json`.
5. `build.py`: rights re-check, download, crop/resize, then writes `docs/then/schedule.json` and `docs/then/img/`.
6. `make_og.js`: renders `docs/then/og.png` (1200x630) with Playwright.

```
THEN_CANDIDATES=a.json,b.json python3 bots/then/make_picks.py   # needs the harvest files
python3 bots/then/build.py
NODE_PATH=/opt/npm-tools/node_modules node bots/then/make_og.js 2016794195
```

## Tests

```
node --test bots/then/test_game.js
NODE_PATH=/opt/npm-tools/node_modules node bots/then/test_page.js <screenshot dir>
```

- **Unit tests (12, all pass):**
  - epoch and numbering;
  - EST and EDT midnight boundaries (e.g. 04:59:59Z vs 05:00:00Z);
  - the spring-forward and fall-back days (no skipped or repeated puzzle);
  - 23h/25h countdowns;
  - no repeat within 120 days;
  - schedule completeness, rights, sizes, and no year in file names;
  - hint tiers and higher/lower;
  - slider bounds;
  - share text;
  - multi-borough check;
  - stats and streaks.
- **Playwright** at 390px (mobile UA, stubbed Web Share) and 1280px (clipboard), with the clock fixed at 2026-11-20 10am ET. **97 checks, ALL PASSED.** It covers:
  - a full game (cold, warm, close, borough, win) and the exact share text;
  - reload persistence and stats;
  - an archive game lost X/5 that doesn't count against the streak;
  - future `?n=` falling back to today;
  - no horizontal scroll;
  - **zero third-party requests during play**;
  - Kit (stubbed) getting one call to `TAGID_THEN` with only api_key + email;
  - a game played with localStorage blocked;
  - no console errors.
- I reviewed the screenshots at both widths, then fixed: the picker moved above the guess rows so it's visible without scrolling on a phone, `[hidden]` was being overridden by flex, the duplicate period in the date, and the dialog focus ring.

## To do before launch (Matt)

1. Create a Kit tag (e.g. `nyc-then-daily`) and replace `TAGID_THEN` in `docs/then/signup.js`. Until then, signups show "didn't go through". The daily email itself also needs a Kit sequence or automation; none exists yet.
2. Optional: change `EPOCH` in `docs/then/game.js` to the real launch day.
3. Remove the two `then` lines from `.git/info/exclude`, then commit.
4. Optional: add `then/` to `docs/sitemap.xml` and a card on `docs/index.html` (under Apps). Neither was touched.

## 2026-11-15: signup is launch news, not a daily email
- Nothing sends a daily photo email, so the signup no longer promises one. It now says: "Get an email when new photo packs or new city games launch (a few times a year)." Heading "Launch news", button "Keep me posted". Kit tag nyc-then 25880799 is unchanged (replaces the TAGID_THEN placeholder mentioned above).
- test_page.js checks this copy and that no daily-email wording comes back.
