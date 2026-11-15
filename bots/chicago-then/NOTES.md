# Chicago Then: notes

Page: `docs/chicago-then/` (served at https://lanternlab2027.github.io/lab/chicago-then/). Spec: `bots/ideas/APPS_ROUND2.md`, idea #6 ("Then" franchise). Sister game to NYC Then (`docs/then/`, `bots/then/`); the code and pipeline are adapted from it.
Built and tested Nov 15, 2026. Not committed.

## What it does

- One historical Chicago photo per day from the Library of Congress. Guess the year in up to 5 tries. Rules, colors, slider and keyboard controls are the same as NYC Then.
- **Area bonus (optional):** Loop / Near North / North Side / West Side / South Side / Lakefront, one try.
  - It is shown only when the LOC title names a place whose part of town is unambiguous (e.g. "State Street", "Lincoln Park", "Black Belt", "47th Street", "Maxwell Street", "Jackson Park"). 83 of 121 photos have it. On the other 38 the bonus section is hidden and the share line has no pin.
  - Lakefront parks accept both their side and "Lakefront" (e.g. Grant Park = Loop or Lakefront). Union Station and the C&NW terminal accept Loop or West Side.
- Share text: `Chicago Then #7 ⬛🟧🟨🟩 4/5 📍✅` with `lanternlab2027.github.io/lab/chicago-then` on the next line. Web Share on phones, clipboard otherwise.
- Streaks and stats (localStorage key `chicagothen:v1`, all access in try/catch), archive (`?n=N`), countdown to the next Chicago midnight.
- "Did you know?" line per place (see Facts below), the LOC caption verbatim, the LOC summary when there is one, credit, catalog date, LOC link and the recorded rights statement.
- Kit email signup: same pattern as NYC Then (`signup.js`, sends only `api_key` + `email`). Tag placeholder **`TAGID_CHITHEN`**.
- SEO: title "Chicago Then: Chicago History Daily Game, Guess the Year of the Photo"; description starts "A free Chicago history daily game..."; canonical, OG/Twitter tags, JSON-LD, `og.png` (1200x630).
- Footer links to `../`. Cross-links: "Also play NYC Then" on the result screen and footer; the reverse link ("Also play Chicago Then") was added to `docs/then/index.html` in the same two places (plus a 2-line `.also` style). NYC Then's own tests still pass.
- Look: same layout as NYC Then, with Chicago-flag accents (red six-pointed star in the masthead, light-blue double stripe, flag red as the accent color).
- No tracking, no CDN, system fonts. CSP `script-src 'self'`, `connect-src 'self' https://api.convertkit.com`.

## Daily schedule

- Puzzle #1 is **2026-11-15** in **America/Chicago** (`EPOCH` in `game.js`, `epoch` in `schedule.json`; a unit test checks they match).
- Puzzle number = Chicago calendar date − epoch + 1, computed with `Intl.DateTimeFormat(..., {timeZone: 'America/Chicago'})` then whole-day UTC math. Chicago flips one hour after New York (06:00Z in winter, 05:00Z in summer).
- Day N shows `photos[(N-1) % 121]`. The list is a seeded shuffle (seed **20261272**, picked so the launch week is all recognizable places with a bonus, across three decades and all three collections; day 1 is opening day at the Clark and Addison ballpark, 1914). No place repeats on consecutive days. Any 121 consecutive days show 121 different photos, so no repeats within 120 days (tested for every window from #1 to #520).
- To add photos later, append to the end; re-running `build.py` with new picks reshuffles everything.

## Data (121 photos, 1893–1943)

| Source | Count | Years | Rights statement on the live LOC record |
|---|---|---|---|
| FSA/OWI (b/w + 2 color) | 61 | 1940–1943 | "No known restrictions. For information, see U.S. Farm Security Administration/Office of War Information..." (one says "No known restrictions on images made by the U.S. government; images copied from other sources may be restricted..."; it is an original John Vachon FSA negative, so the government clause applies) |
| Detroit Publishing Co. | 45 | 1898–1911 | "No known restrictions on publication." |
| Panoramic Photographs | 15 | 1893–1938 | "No known restrictions on publication." (one adds "No renewal found in Copyright Office.") |

- Decades: 1890s 2, 1900s 51, 1910s 6, 1930s 1, 1940s 61. LOC has very little single-year, unrestricted Chicago material from 1915–1939; the panoramics are the only good source for it.
- **Rights:** `build.py` re-reads every item's LOC JSON record (fetched live on 2026-11-15) and stops if `rights_advisory` doesn't start with "No known restrictions". The exact statement and `rights_checked` date are stored per photo. All 121 passed.
- **Dates:** single-year catalog dates only (`curate.parse_year` rejects ranges, "ca.", "?", decades, "or"). `build.py` re-parses the live record and stops on a mismatch. Detroit and panoramic dates are mostly copyright years ("c1905").
- **Not used:** Bain (Chicago hits are nearly all baseball portraits), Harris & Ewing / National Photo (mostly Washington portraits), HABS (no single-year item dates), the Chicago Daily News collection (not on loc.gov with item-level rights), and anything whose notes say it's from a painting/drawing (one 1927 "skyline" panoramic was a painting).
- **Hand review:** about 350 candidates on contact sheets. Dropped: ships (USS Chicago), places outside Chicago (Lockport, Calumet City, Proviso and other suburban yards), interiors, portraits of single people, disasters.
- **No spoilers in the image:** each collection has a default crop (`TRIM` in `build.py`). Every panoramic got a hand-set crop (`TRIM` in `make_picks.py`) to cut printed captions and copyright lines. Several of these carried dates, e.g. "Kansas City vs. Chicago, opening day... 1914" and "Army tournament... July 4, 1910". Three panoramics were dropped because handwriting with the date ran across the picture. All 121 crops were checked by eye. File names are hashes (`chithen:` + id).
- **Images:** max 900px wide (720 for portrait), JPEG ≤118KB each, 13MB total. Panoramics are shown uncropped in width (aspect up to ~5:1). LOC's only larger panoramic files are ~265MB TIFFs, so the 1024px service JPEG is used.

## Facts ("Did you know?")

`bots/chicago-then/facts.py`, one line per place, written for the game. Each was checked on 2026-11-15 against the source noted in a comment beside it (mostly Wikipedia, plus the LOC, the Encyclopedia of Chicago, MWRD, Census Bureau, Chicago Union Station, MLB, Britannica, WTTW, City of Chicago and an HMdb marker). Claims are kept to what the source says. Some claims were dropped or reworded because the source didn't support them: the Art Institute lions' date, "world's tallest" for the Masonic Temple, Dearborn Street being *named* for the fort (now "shares its name"), and the "forever open, clear and free" Grant Park wording. Places with no specific fact (38 generic FSA street scenes) get a line about the FSA/OWI project instead. **Matt may want to skim them.**

## Pipeline (all in `bots/chicago-then/`)

1. `harvest.py`: pages through every "chicago" hit in 9 LOC collections (5,547 records). It resumes after interruptions, and when a 100-item page 404s it falls back to 25-item pages.
2. `curate.py`: filters on rights, single year, Chicago place, landmark → area mapping, notes saying it's a painting, and aspect ratio.
3. `contact_sheet.py`: makes the review sheets.
4. `make_picks.py`: the hand-chosen IDs with place labels, areas and crops, written to `picks.json`.
5. `build.py`: rights/date re-check, download, crop/resize, then writes `docs/chicago-then/schedule.json` and `img/`.
6. `make_og.js`: renders `og.png`.

```
python3 bots/chicago-then/harvest.py
python3 bots/chicago-then/curate.py
python3 bots/chicago-then/make_picks.py
python3 bots/chicago-then/build.py        # uses data/cache/; LOC is slow (~20s/request), so a cold run takes a while
NODE_PATH=/opt/npm-tools/node_modules node bots/chicago-then/make_og.js 2017746802
```

`data/` (147MB: harvest, cache, sheets) is listed in `bots/chicago-then/.gitignore`. Don't commit it.

## Tests

```
node --test bots/chicago-then/test_game.js
NODE_PATH=/opt/npm-tools/node_modules node bots/chicago-then/test_page.js <screenshot dir>
```

- **Unit tests (13, all pass):**
  - epoch/numbering, and that game.js and schedule.json agree on the epoch;
  - CST and CDT midnight boundaries (05:59:59Z vs 06:00:00Z), including the moment NY has flipped and Chicago hasn't;
  - spring-forward and fall-back days;
  - 23h/25h countdowns;
  - no repeat in any 120-day window (#1–#520), and no place two days running;
  - schedule completeness, rights, rights date, sizes, no year in file names, no stray images;
  - hints, bounds and share text (with and without the pin);
  - the area check;
  - stats and streaks.
- **Playwright at 390px (mobile, Web Share) and 1280px (clipboard): 119 checks, ALL PASSED.**
  - SEO title, description and OG image, the footer `../` link, and the NYC cross-link (both directions);
  - a full game with the area bonus and the exact share text;
  - a day with no area (bonus hidden, share line without a pin);
  - persistence and stats, and archive play not counting toward streaks;
  - future `?n=` falling back to today;
  - no horizontal scroll;
  - zero third-party requests;
  - Kit (stubbed) called once on `TAGID_CHITHEN` with only api_key + email;
  - play with localStorage blocked;
  - no console errors.
- NYC Then's tests still pass after the reverse-link edit (12 unit, Playwright ALL PASSED).
- Screenshots reviewed at both widths: help, start, mid-game, result, stats and archive.

## To do before launch (Matt)

1. Create a Kit tag (e.g. `chicago-then-daily`) and replace `TAGID_CHITHEN` in `docs/chicago-then/signup.js`. Until then, signups show "didn't go through". The daily email also needs a Kit sequence or automation.
2. Optional: move `EPOCH` (game.js) and `EPOCH` (build.py) to the real launch day, then re-run `build.py`.
3. Optional: add `chicago-then/` to `docs/sitemap.xml` and a card on `docs/index.html` / `docs/apps/`. Neither was touched.
4. Commit (`docs/chicago-then/`, `bots/chicago-then/` minus `data/`, and the `docs/then/index.html` cross-link edit).

## 2026-11-15: signup is launch news, not a daily email
- Nothing sends a daily photo email, so the signup no longer promises one. It now says: "Get an email when new photo packs or new city games launch (a few times a year)." Heading "Launch news", button "Keep me posted". Kit tag chicago-then 25915601 is unchanged (replaces the TAGID_CHITHEN placeholder mentioned above).
- test_page.js checks this copy and that no daily-email wording comes back.
