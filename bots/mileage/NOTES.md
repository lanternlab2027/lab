# Timeline Mileage Log (Google Maps Timeline mileage log): notes

Page: `docs/mileage/` (served at https://lanternlab2027.github.io/lab/mileage/). Built and tested Nov 15, 2026, for idea #9 in `bots/ideas/APPS_ROUND2.md`. Not committed.

Tracked file changed: `docs/sitemap.xml` (one `mileage/` entry). Everything else is new: `docs/mileage/` and `bots/mileage/`. No hub card was added to `docs/index.html` or `docs/apps/`.

## What it does

1. The visitor chooses or drops their export. Everything runs in the browser and nothing is uploaded. It accepts:
   - the Android `Timeline.json`;
   - the iPhone `location-history.json`;
   - Takeout Semantic Location History month files (several at once) or the whole Takeout `.zip`.

   There's also a "Try a sample" button that uses invented places.
2. **Trip types:** chips show each type found, with counts. The driving types (`IN_PASSENGER_VEHICLE`, `IN_VEHICLE`, `IN_ROAD_VEHICLE`, `IN_CAR`, `DRIVING`, `MOTORCYCLING`) are on by default. Taxi and bus are not.
3. **Period:** tax year, "everything in file" or custom dates.
   - The default is the current year.
   - From January to April it defaults to last year, if the file has it.
4. **Places:**
   - Trip endpoints are clustered greedily within 150 m (`stats.clusterPlaces`).
   - The top 10 places can be named, with "show all" for the rest. Names are prefilled from HOME/WORK labels and Takeout visit names.
   - Each place has a "Tag untagged trips to/from here as Business / Personal" button.
5. **Log:**
   - Columns: date and times, From -> To, miles, a purpose select and a note.
   - 100 rows per page.
   - Filters: All, Untagged, Business, Personal. "Mark shown as ..." applies a tag to every trip the filter shows.
   - Mobile shows rows as cards.
6. **Totals:** business, personal, untagged and total miles, plus an estimate at the IRS rate for each trip's date with a cited breakdown.
7. **CSV and print:**
   - CSV columns: Date, Start time, End time, From, To, Miles, Purpose, Business purpose / notes, Distance from, IRS rate, Estimated amount.
   - The CSV ends with totals rows and a disclaimer line.
   - Unnamed places get coordinates.
   - Spreadsheet formula injection is guarded.
   - It has a BOM and CRLF line endings.
   - Print CSS prints the whole log.
8. **Remember (opt-in, off by default):** stores only place names and tags in localStorage (`lanternlab.mileage.v1`). Unticking erases them.
9. **Distance fallbacks:**
   1. Google's distance (`distanceMeters` / `distance`).
   2. Otherwise, the path length from timelinePath points in the trip's time window (on-device) or from waypointPath / simplifiedRawPath (Takeout), labeled "path".
   3. Otherwise, the straight-line haversine between the endpoints, labeled "straight line (underestimate)".
10. **Shared conventions:** `?ref=X` becomes `?ref=share-X` in the footer's "Make yours" link and the Share button. The footer links to `../` and `../apps/` and carries the disclaimer.
11. **Kit:** `docs/mileage/kit.js` copies the `docs/eats/kit.js` pattern.
    - Its tag is the placeholder **`TAGID_MILEAGE`**, so the box stays hidden until the tag is numeric.
    - It sends only `api_key` and `email`.
    - The key was copied from eats programmatically and never printed.

## To do before launch (Matt)

1. Create a Kit tag (for example `mileage-reminder`) and replace `TAGID_MILEAGE` in `docs/mileage/kit.js`. The signup box appears automatically.
2. Commit `docs/mileage/`, `bots/mileage/` and `docs/sitemap.xml`. `bots/mileage/fixtures/` is about 3.5 MB and generated, so you could skip it and regenerate with `make_fixtures.js`.
3. Optional: add a hub card to `docs/index.html` and `docs/apps/`.
4. **Most important:** test with one real Android `Timeline.json` and one real iPhone `location-history.json`. The fixtures are synthetic, modeled on public parser fixtures (see below).
5. Yearly: add the 2027 rate to `RATES` in `docs/mileage/stats.js` once the IRS announces it (usually in December). Trips with no rate on file are shown as "not in the estimate".

## Verified facts (Nov 15, 2026)

- **IRS business standard mileage rates.** Source: [IRS: Standard mileage rates](https://www.irs.gov/tax-professionals/standard-mileage-rates), page last reviewed Jul 28, 2026. Topic 510 (reviewed Nov 9, 2026) confirms that 2026 has different rates for each half.

  | Period | Rate | Source |
  |---|---|---|
  | 2022, Jan 1 - Jun 30 | 58.5c | IR-2021-251 |
  | 2022, Jul 1 - Dec 31 | 62.5c | IR-2022-124 |
  | 2023 | 65.5c | IR-2022-234 |
  | 2024 | 67c | IR-2023-239 |
  | 2025 | 70c | IR-2024-312 |
  | 2026, Jan 1 - Jun 30 | 72.5c | IR-2025-128 / Notice 2026-10 |
  | 2026, Jul 1 - Dec 31 | **76c** | Announcement 2026-11, IRB 2026-29, p. 49 |

  The 2026 rate is verified on irs.gov, so no fallback to the 2025 rate is needed.
- **Pub 463, chapter 5** ("Timely kept records", "Sampling", Table 5-1: mileage for each business use, total miles, date, destination and business purpose). The page's warning paraphrases "at or near the time".
- **Pub 463, chapter 4, "Commuting expenses":** driving between home and your main or regular workplace is personal. This is cited in the places panel.
- **Google help [6258979](https://support.google.com/maps/answer/6258979), "Export your Timeline data":**
  - Android: Settings > Location > Location services > Timeline > Export Timeline data > Continue > choose a location > Save.
  - iOS: Maps > profile > Settings > Location & Privacy > Export Timeline data > Save to Files. The file is `location-history.json`.
  - Auto-delete options are 3, 18 or 36 months.
  - **Unverified:** the Android file name "Timeline.json". Google's page doesn't state it, so the page says "usually".
- **Formats:**
  - Matched to the fixtures in [Freika/dawarich](https://github.com/Freika/dawarich) `spec/fixtures/files/google/` (cloned to scratch, not into the repo).
  - Format details from [dawarich's blog](https://dawarich.app/blog/whats-inside-your-google-timeline-export/), timelinize's `ondevice.go` (iOS puts all timelinePath entries at the end of the array, uses "geo:" points and `durationMinutesOffsetFromStartTime`), and the epk gist viewer.
  - **Android:** `{semanticSegments, rawSignals, userLocationProfile}`, coordinates as "lat°, lng°", numbers as numbers, `activity.topCandidate.type` like `IN_PASSENGER_VEHICLE`, `distanceMeters`.
  - **iOS:** a top-level array, numbers as strings, `"geo:lat,lng"`, `placeID`, lower-case types ("in passenger vehicle"). The lower-case type spelling comes from memory of real files and is not in dawarich's fixture; the parser normalizes case and spaces either way.
  - **Takeout:** `timelineObjects[].activitySegment` with `startLocation.latitudeE7`, `duration.startTimestamp` (or older `startTimestampMs`), `distance`, `activityType`, `activities[]`, `waypointPath{waypoints[latE7,lngE7], distanceMeters, travelMode}`, `parkingEvent`, plus `placeVisit.location{name,address,...}`.
  - E7 values past the int32 range (an old export bug) are unwrapped.
  - `Records.json` and `Timeline Edits.json` get a clear "no trips in this file" error.
- **Local dates:**
  - On-device strings carry their UTC offset, so the date and time are read from the string and a trip is dated where it happened.
  - Takeout `Z` timestamps use the browser's time zone.

## Files

| File | What it is |
|---|---|
| `docs/mileage/index.html` | Page, CSS (light and dark), SEO/OG/JSON-LD, export guide, warnings, FAQ, Kit box, footer |
| `docs/mileage/parser.js` | Format detection, coordinates, times, haversine, all three parsers, merge and dedupe (UMD) |
| `docs/mileage/stats.js` | IRS rate table, 150 m clustering, filter, totals, CSV |
| `docs/mileage/demo.js` | Deterministic invented itinerary written as Android, iOS or Takeout JSON (sample and fixtures) |
| `docs/mileage/app.js` | UI, file and zip reading, tags, places, paging, CSV and print, opt-in memory, `?ref` |
| `docs/mileage/kit.js` | Kit signup (placeholder tag) |
| `docs/mileage/vendor/` | JSZip 3.10.1 plus its license, copied from `docs/netflix/vendor` |
| `docs/mileage/og.png` | 1200x630 image from `bots/mileage/make_og.js` |
| `bots/mileage/make_fixtures.js` | Full Android export (Nov 2025 - Nov 2026), iOS export (Jan - Mar 2026), Takeout month files and zip (Nov 2023 - Feb 2024, with a `timestampMs` month), tiny hand-checkable files, and error files |
| `bots/mileage/test_parser.js` | 11 unit tests |
| `bots/mileage/test_page.js` | Playwright at 390px and 1280px, plus Kit |

All JS is pure ASCII (`\u` escapes).

## Tests

```
node bots/mileage/make_fixtures.js
node --test bots/mileage/test_parser.js
NODE_PATH=/opt/npm-tools/node_modules node bots/mileage/test_page.js <screenshot dir>
NODE_PATH=/opt/npm-tools/node_modules node bots/mileage/make_og.js
```

**Unit tests** cover:

- coordinates: `geo:`, degree strings, E7 and the int32 wrap;
- haversine (equator degree, JFK-LAX);
- times and local dates;
- format detection and errors;
- each parser, including the path and straight-line fallbacks;
- month-file merge and dedupe;
- Android, iOS and Takeout giving the same driving miles for the same itinerary;
- clustering;
- the rate table, filter and totals;
- CSV escaping, the formula guard and totals.

**Playwright** runs at each width with the clock frozen at Nov 15, 2026 and the time zone set to New York. It checks:

- SEO, the CSP (a third-party fetch is blocked), the `../` and `../apps/` links, the citations and `?ref=share-tiktok`;
- the Android upload, tagging, tag-by-place, filters, and that the CSV totals and estimate equal the UI;
- the period and type switches;
- the iPhone file, the Takeout zip and loose month files, dedupe and the error files;
- zero network requests after upload;
- opt-in storage and restore;
- sample and print;
- no horizontal scroll and no page errors.

The Kit stub checks a single call carrying only `api_key` and `email`.

Status Nov 15, 2026: 11/11 unit tests pass, and the e2e run passes all 122 checks ("ALL PASSED").

## Visual review

Screenshots at 390px and 1280px, light and dark mode, plus the OG image, were inspected. Fixed during review:

- uneven purpose-select widths in the mobile cards (now purpose and note sit side by side);
- the "Trips · total miles" tile wrapping;
- the place tag buttons wrapping awkwardly on mobile;
- the OG header alignment.

## Known limits

- **Large files:** a very large Android export (100 MB+) is parsed with `JSON.parse` on the main thread and may be slow or fail in mobile Safari. A Web Worker could fix this if real files show the problem.
- **Clustering is greedy:** two places a little more than 150 m apart stay separate, and a short walking loop near the office makes an extra small "place".
- **Takeout dates:** Takeout dates use the visitor's current time zone, not the time zone where the trip happened.
- **Rate estimate:** it applies only the business rate (not medical or charitable), and only for 2022-2026.
