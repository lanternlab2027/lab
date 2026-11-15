# Year in Motion (free "Year in Sport"): notes

Page: `docs/sport/`, served at https://lanternlab2027.github.io/lab/sport/. Built and tested Nov 14, 2026. **Not committed.**

This is the #1 pick from `bots/ideas/APPS_ROUND2.md`. The brand name is "Year in Motion", following the spec's rule to keep "Strava" and "Garmin" out of the name and logo. They appear only as descriptive use ("works with your Strava export").

## What it does

1. **Input.** The visitor drops one of these:
   - a Strava bulk export `.zip`;
   - Strava `activities.csv` on its own;
   - a Garmin Connect `Activities.csv`;
   - a Garmin "Export Your Data" `.zip`;
   - one or more `.gpx` / `.tcx` / `.fit` files, or their `.gz` versions.
   Drag-and-drop works, and there's a one-tap sample deck from a synthetic athlete.
2. **Processing.** Everything is parsed and drawn in the tab. A Strava zip is read **lazily**: a small zip reader (`zip.js`) uses `Blob.slice` and the native `DecompressionStream('deflate-raw')` and handles Zip64. Only the central directory, `activities.csv` and the route files for the year on screen are read. A multi-GB archive full of photos never has to fit in memory. JSZip is the fallback for browsers without `DecompressionStream`, and it also builds the "Download all" zip.
3. **Cards.** The deck has up to 10 cards at 1080x1920. A card is skipped when there's no data for it.
   - **Intro:** activities, hours, distance and climb, plus a heat-strip of every day of the year.
   - **Distance:** a great-circle city-pair comparison (e.g. "About New York to Los Angeles") or laps of the Earth, plus distance by sport.
   - **Climb:** elevation as "3.5 times up Everest", drawn as mountains. When the deck would have 11 cards, this card is folded into the distance card as a "PLUS 3.5× UP EVEREST" line.
   - **Sport mix:** a donut by time.
   - **Busiest month:** 12 bars. The quietest month only counts finished months.
   - **Longest effort:** duration, a 24 h day bar, and stats, plus the furthest activity or the runners-up.
   - **Streaks:** day streak, or week streak when that's more impressive, with a 53-week grid.
   - **Time of day:** a 24 h radial chart named Dawn Patrol / Morning Mover / Lunch-Break Legend / Afternoon Grinder / After-Work Warrior / Night Owl.
   - **Fastest efforts:** see the rules below.
   - **Route art:** small multiples of every route, each normalized in its own cell, with no map, tiles or coordinates. Capped at the 120 longest.
   - **Sport personality:** 12 archetypes scored from the stats, plus up to 2 "streak of" traits.
4. **Fastest efforts rules.** This card only appears when the data supports it:
   - runs within 4.9-5.6 / 9.8-11 / 21-22.3 / 42-43.8 km;
   - pace between 2:30 and 15:00 per km;
   - treadmill and virtual runs excluded;
   - rides only when there are 3 or more outdoor rides of 20 km+ at 8-55 km/h.
   The card says the figures are whole-activity averages, not splits.
5. **Every card** shows "Make yours: lanternlab2027.github.io/lab/sport" and "free · no upload". The e2e test checks this by recording `fillText` calls.
6. **Controls:**
   - year;
   - units toggle (km/m vs mi/ft; defaults to mi for en-US, otherwise km);
   - name;
   - **"Hide 500 m around every start and finish" (ON by default);**
   - **"Hide routes completely"**;
   - "Distances in your Garmin file are in…", shown only for Garmin CSVs and auto-guessed.
7. **Share loop:**
   - Share / Save PNG / Share all / Download all (.zip);
   - "Pass it on" text with link and the same `?ref` passthrough as the other apps (`?ref=X` becomes `share-X`, then `share2-X`...);
   - the disabled **"Printable poster (coming soon)"** button, with no payment code.
8. **Kit signup** ("Waiting on your export?"):
   - follows the same pattern as `docs/reading/app.js`;
   - the public api_key was copied programmatically from that file and never printed;
   - tag **`TAGID_SPORT`** is a placeholder;
   - sends only `api_key` + `email`.

## Export formats (checked Nov 14, 2026)

- **Strava**
  - *Official:* [Strava Support: Exporting your Data and GDPR](https://support.strava.com/hc/en-us/articles/216918437-Exporting-your-Data-and-GDPR) and [article 15401919](https://support.strava.com/en-us/articles/15401919-how-do-i-export-my-strava-data). The steps are: strava.com → hover your name → Settings → My Account → "Download your account" → Get Started → Request download. The link is emailed and "may take a few hours". The original activity files are usually FIT.
  - *Not covered officially:* Strava's help pages don't document the archive contents or the CSV columns.
  - *Archive layout:* `activities.csv` plus an `activities/` folder of originals (`.fit.gz`, `.gpx`, `.gpx.gz`, `.tcx.gz`). This is from [TakeoutDay](https://takeoutday.org/guides/how-to-export-strava-data) and [Redback notes](https://redback-operations.github.io/redback-documentation/docs/project-3/research/strava-bulk-export-data-description).
  - *Header:* verified on a public sample export (`watsonbox/obsidian-strava-sync/assets/activities.csv`, found with GitHub code search). Column names repeat: the first `Distance` is display km and the second is **meters**. Times are seconds and elevation is meters.
  - *Dates:* `Activity Date` looks like `"Aug 24, 2024, 10:47:26 AM"` and is **UTC**.
  - *Older exports:* these have only the first 11 columns.
- **Garmin**
  - *Blocked pages:* the official support.garmin.com and garmin.com account pages are **blocked by this environment's proxy**, so I couldn't read them live. The URLs, as cited by the secondary guides, are support FAQ `W1TvTPW8JZ6LfJSfK512Q8` and https://www.garmin.com/en-US/account/datamanagement/ ("Export Your Data" → "Request Data Export").
  - *Activities CSV:* Connect web → Activities → scroll to load → "Export CSV". Only loaded rows are exported, per this [Garmin forum thread](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/426756/exporting-activities-to-csv) and the [gneta guide](https://www.gneta.app/blog/export-garmin-data-guide).
  - *Header:* verified on several public `Activities.csv` files from GitHub code search (`tbidne/pacer`, `dennissmith0/Running_Performance`, `pmcintyr/garmin2sheets`). Columns vary by account.
  - *Values:* in the **account's units, with no unit in the header**. They are quoted, use `--` for missing values and `1,207`-style thousands. `Date` is local `2025-02-06 17:06:03`.
  - *Full archive:* "Export Your Data" has no CSV. We read `DI_CONNECT/DI-Connect-Fitness/*_summarizedActivities.json`, best effort: units are assumed cm/ms and sanity-checked against plausible speeds.
- **No real data in the repo.** I read the public samples for their headers only. Every fixture is generated.

## Robustness

- **Columns:** found by name. For localized Strava headers, the parser falls back to positions, since Strava's column order is stable.
- **CSV:** delimiter auto-detected; BOM and CRLF handled; decimal-comma files detected per file.
- **Dates:**
  - English, ISO with zones, numeric D/M and M/D forms;
  - month names in en/de/fr/es/it/nl/pt.
- **Strava time zone:** UTC is converted with the browser zone, unless the default activity names ("Morning Run", "Evening Ride"…) are clearly better explained by a fixed offset. In that case the parser takes the middle of the best-fitting plateau.
- **Garmin units:** guessed from temperatures (median ≥45 → °F → imperial) and max elevation, falling back to locale. The user can override.
- **Garmin swims:** values ≥50 are read as m/yd.
- **GPX/TCX:** parsed with regex, so it runs in Node and with namespace prefixes.
- **FIT:** an own minimal reader for record (20), session (18) and sport (12) messages. It handles compressed timestamps, developer fields, big-endian definitions and chained files. Session totals beat point-derived totals.
- **Track elevation:** gain uses a 4 m hysteresis.
- **Polylines:** thinned to points at least 8 m apart, max 1,200 points.
- **Bad input:** non-export CSVs, empty exports, corrupt zips and broken FIT files each give a clear message. Tracks without timestamps are skipped and counted in the status line.

## Privacy

- **CSP:** the same as the other apps: `default-src 'none'; script-src 'self'; connect-src https://api.convertkit.com`.
- **No outside assets:** no CDN, web fonts, analytics, map tiles or storage.
- **Route privacy:**
  - the trim is a privacy zone: it drops **every** point within 500 m in a straight line of the start or finish, anywhere on the route, not just the first and last 500 m of path;
  - a loop that stays near home disappears entirely;
  - each route is scaled into its own cell, so no absolute position or scale is shown;
  - the e2e test checks that no coordinate-like strings are drawn.
- **Activity names, descriptions and private notes are never drawn.** Cards use the sport and date only.
- **Zero network requests after load:** the e2e test intercepts every request and asserts none after page load, through every upload, re-render, download and the sample deck, at both widths. It also checks that the CSP blocks a third-party fetch.

## Files

| File | What |
|---|---|
| `docs/sport/index.html` | Page, CSS (navy / electric orange / volt lime, condensed italic display type), SEO/OG/JSON-LD, export tabs, privacy, Kit, FAQ, disclaimer |
| `docs/sport/zip.js` | Lazy zip reader (Zip64), gunzip, JSZip fallback |
| `docs/sport/parser.js` | CSV, Strava/Garmin/Garmin-JSON normalizers, GPX/TCX/FIT, time zones |
| `docs/sport/stats.js` | Year stats, streaks, time of day, PR-ish efforts, personality, privacy trim |
| `docs/sport/cards.js` | Canvas renderer (5 themes, heat strip, donut, radial clock, mountains, route grid) |
| `docs/sport/app.js` | UI wiring, lazy per-year track loading with progress bar, share/zip, `?ref`, Kit |
| `docs/sport/demo.js` | Synthetic athlete and procedural routes (placed in the mid-Atlantic), shaped like a Strava export |
| `docs/sport/og.png`, `preview.jpg` | Built from the sample deck by `bots/sport/make_og.js` |
| `docs/sport/vendor/` | JSZip 3.10.1 plus license (copied from `docs/reading/vendor/`) |
| `bots/sport/make_fixtures.js` | Writes all fixtures, including a small FIT encoder and a Strava-shaped zip with a `media/` folder |
| `bots/sport/test_parser.js` | 16 unit tests, including a hand-built Zip64 archive |
| `bots/sport/test_page.js` | Playwright e2e at 390px and 1280px, plus a January-2027 fallback case |
| `bots/sport/dump_cards.js` | Dev helper: writes every card of a deck to PNGs for review |

`docs/sitemap.xml` has one added `sport/` entry. `docs/index.html` (the hub) was not touched. All JS is pure ASCII.

## Tests

```
node bots/sport/make_fixtures.js
node --test bots/sport/test_parser.js
NODE_PATH=/opt/npm-tools/node_modules node bots/sport/test_page.js <screenshot dir>
```

Status Nov 14, 2026: **16/16 unit tests pass, and the e2e test reports ALL PASSED (96 checks).** The e2e test covers:

- the Strava zip, CSV-only, older and localized Strava CSVs;
- Garmin metric and imperial CSVs, plus the unit override;
- the Garmin data-export zip;
- 12 mixed GPX/GPX.gz/TCX/FIT/FIT.gz files;
- units, trim, hide-routes, year and name re-renders;
- Save PNG and the zip download;
- error cases, CSP and Kit (stubbed);
- `?ref` passthrough, tabs, the poster button, SEO tags and no horizontal scroll.

## Visual review

I inspected every card for the sample (mi and km, with a very long name), the Strava zip, the Garmin CSV, the 12-file GPX deck and the localized 80-activity deck. Fixed during review:

- the heat-strip running into the footer;
- decorative speed stripes overlapping tiles (moved to the header band);
- display headings overflowing (they were uppercased after measuring);
- tile labels overflowing;
- the radial clock colliding with its tiles;
- the empty lower half of the longest-effort card (now lists the runners-up);
- the "quietest month" picking the unfinished current month;
- the "PLUS … EVEREST" line colliding with the sport bars;
- the GPX `.gz` files being misread as a zip (`application/gzip` matched `/zip/`);
- "Best of 1 run".

Known trade-offs:

- Cards are about 1 MB as PNGs.
- With few activities, the fastest-efforts and persona cards have some empty space.
- Parsing runs on the main thread with yields and a progress bar, not in a Web Worker as the spec suggested. I haven't QA'd it with a real 1 GB+ archive on an iPhone.

## To do before launch (Matt)

1. Create a Kit tag (e.g. `year-in-motion-2026`) and replace `TAGID_SPORT` in `docs/sport/app.js`. Until then, signups show "didn't go through". This is the same behavior as the other apps' placeholders.
2. Commit `docs/sport/`, `bots/sport/` and the sitemap change.
3. Optional:
   - add a card to `docs/index.html`;
   - QA with one real Strava or Garmin export (used locally, never committed);
   - read [Strava's brand guidelines](https://developers.strava.com/guidelines/) before any marketing that shows their name.
4. **Yearly:** the title says 2026, so update it to 2027 next season.
