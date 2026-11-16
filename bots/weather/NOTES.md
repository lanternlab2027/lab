# Weather Wrapped: notes

Page: `docs/weather/` (will be served at https://lanternlab2027.github.io/lab/weather/). Built Nov 16, 2026 for idea #9 in `bots/ideas/APPS_ROUND3.md`. Aimed at a Jan 2 launch. Not committed, not pushed.

Only new files were added: `docs/weather/` and `bots/weather/`. Nothing else was changed: not other apps, not `docs/apps/`, not `docs/index.html`, not the sitemaps.

## What it does

1. The visitor types a ZIP code or a city, then picks a year and units (F/C, in./mm). Units default to F/in. for U.S. places and C/mm elsewhere. A choice they make is remembered in localStorage.
2. **Location.**
   - **ZIP:** the coordinates come from the Census ZCTA shards in `docs/snow/z/` (read-only, shared with Snow Day Odds; `net.js` loads `../snow/z/NN.json`). The name comes from Open-Meteo geocoding, which accepts postal codes ("Location name or postal code" per its docs). If that call fails, the place shows as "ZIP 14201".
   - **City:** Open-Meteo geocoding, with the same "City, ST" parsing as Snow Day Odds. It also works worldwide ("London", "Paris, France").
3. **Data.** The browser makes two requests to `archive-api.open-meteo.com/v1/archive`, both with `timezone=auto`:
   - **the year:** `daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,sunshine_duration,wind_speed_10m_max`, from Jan 1 through yesterday in the visitor's calendar (or Dec 31);
   - **normals:** `daily=temperature_2m_max` only, for the 10 previous years (2016-2025 for 2026). It loads after the deck is already showing.
4. **Cards.** Up to 7 story cards at 1080x1920, drawn on canvas. Each card shows the place, "2026" or "2026 so far - through Nov 15", "Make yours: lanternlab2027.github.io/lab/weather" and a data credit line.
   1. Hottest day and coldest night, with a low-to-high ribbon for every day.
   2. Rain plus melted snow, and snowfall: totals, wet days, snowiest and wettest day, and monthly bars where the snow share is white.
   3. Longest dry streak and longest wet streak, on a 12x31 dot calendar.
   4. Sunniest month (most hours per day; the month needs at least 20 days of data) and a bar chart by month.
   5. Days 90F or hotter and nights below 32F (labels change to C with the F value in brackets), on a calendar grid.
   6. The weirdest day: the biggest gap between the day's high and the normal high, shown on a chart of the normal curve.
   7. Summary: the stats above plus the windiest day, and "Highs ran X warmer/cooler than 2016-2025".
5. **Share code.** This is copied from Streaming Wrapped:
   - per-card Share and Save PNG, Share all, Download all (.zip) with JSZip 3.10.1 copied to `docs/weather/vendor/`, and Copy link;
   - `?ref=X` becomes `?ref=share-X`;
   - "Make yours" footer and Share this tool;
   - links to `../` and `../apps/`.
   - The cross-promo strip is included the same way `docs/snow/` does it, with `data-from="weather"`.
6. **URL.** The URL becomes `?zip=14201` or `?q=City`, plus `&y=2025` when the year isn't the default. `ref` is kept. Shared links load straight into the deck.
7. **Strict CSP.** `connect-src` allows only `'self'`, archive-api.open-meteo.com, geocoding-api.open-meteo.com and api.convertkit.com. No inline script.
8. **Kit signup** "Remind me Jan 1 when the full year is in" (`kit.js`):
   - same pattern as `docs/eats/kit.js`;
   - the public api_key was copied from eats/kit.js by script, never printed;
   - tag **`TAGID_WEATHER`** is a placeholder, and the box stays hidden until it is numeric;
   - it is also hidden in January;
   - it sends only `api_key` and `email`.
9. **SEO.**
   - title: "Weather Wrapped 2026: Your City's Weather Year in Review (Free)";
   - the meta description includes "2026 weather year in review for your city or ZIP";
   - OG and Twitter tags and WebApplication JSON-LD;
   - `og.png` (1200x630) is made by `bots/weather/make_og.js` from `cards.js`.

## Year logic ("2026 so far")
- **Default year:** in January it is the previous year (so on Jan 2, 2027 it shows the full 2026). Otherwise it is the current year. The menu offers the default year and the 5 before it.
- **End date:** min(Dec 31, yesterday). Trailing days where every value is null are dropped, because the newest reanalysis days can lag.
- **Label:** "2026" only when the data reach Dec 31; otherwise "2026 so far", and the cards and page give the last day included.

## Definitions (also on the page)
- **Wet day:** precipitation_sum >= 1.0 mm (0.04 in.). **Dry day:** < 1.0 mm. A missing value or a missing date breaks a streak. Ties go to the earlier streak.
- **Hot and freezing:** "90F or hotter" means the high is >= 90.0F. "Below 32F" means the low is < 32.0F. Both are compared in F, unrounded, so 32.2C (89.96F) does not count.
- **Normal for a date:** the mean daily high over the 10 previous years, across that date +/-7 days, wrapping around the new year. The day slots use a leap-year calendar, so Feb 29 has its own slot. A day needs at least 30 samples. If the normals request fails, the weirdest-day card is skipped and the page says so.
- **Snow share of monthly bars:** Open-Meteo documents snowfall as 7 cm of snow = 10 mm of water. This is from my reading of their variable docs; recheck it on the live docs page.
- **Wind:** wind_speed_10m_max (km/h) is shown in mph when "in." is chosen and in km/h when "mm" is chosen.

## Open-Meteo: terms, attribution, cost (checked Nov 16 via WebFetch; the shell's proxy blocks open-meteo.com)
- **Docs** (https://open-meteo.com/en/docs/historical-weather-api):
  - The endpoint is `archive-api.open-meteo.com/v1/archive`.
  - The daily variable is **`wind_speed_10m_max`**. The task said `windspeed_10m_max`, which is the old name; the parser accepts both.
  - Units: snowfall in cm, sunshine in seconds, and `timezone` is required for daily data.
  - ERA5/ERA5-Land have a 5-day delay. "Best match" also blends ECMWF IFS, which has no delay.
  - Resolution: ERA5 0.25 deg (~25 km), ERA5-Land 0.1 deg (~11 km), IFS 9 km.
- **Terms** (https://open-meteo.com/en/terms):
  - The free API is non-commercial only. "Websites or apps that have subscriptions or display advertisements" count as commercial.
  - Limits: fewer than 10,000 calls/day, 5,000/hour and 600/minute, per IP. Because the browser calls the API, each visitor uses their own IP.
  - **If Lantern Lab ever adds ads or paid unlocks to this page, it needs an Open-Meteo commercial plan (or a switch to NOAA data, as the idea doc suggested).**
- **Licence** (https://open-meteo.com/en/licence):
  - The data is CC BY 4.0: give credit, link the licence and say if changes were made. A link must sit next to where the data is shown, e.g. "Weather data by Open-Meteo.com".
  - The docs page asks for the Open-Meteo citation (Zippenfenig 2023, doi 10.5281/ZENODO.7970649), the ERA5 (Hersbach et al. 2023) and ERA5-Land (Munoz Sabater 2019) citations, and the C3S line "Generated using Copernicus Climate Change Service information <year>".
  - All of these are on the page: next to the deck, in "Data and credits" and in the footer. Each card also says "Data: Open-Meteo.com, ERA5 reanalysis (CC BY 4.0)."
- **Call cost** (https://open-meteo.com/en/pricing): more than 10 variables or more than 2 weeks of data counts as fractional or multiple calls, roughly (vars/10) x (weeks/2).
  - The year request is about 0.6 x 23 = 14 weighted calls in November and about 16 for a full year.
  - The normals request is 1 variable x 10 years = about 26 weighted calls.
  - That's about 40 weighted calls per lookup, from the visitor's own IP, far below the 600/min and 10,000/day limits. So the weirdest-day card was kept. It uses daily highs only to keep the cost down.
- **Honesty line on the page:** "These numbers come from a weather reanalysis, a computer model's best estimate for a grid square of roughly 10 to 25 km around your location, so they can differ from your airport weather station's official records." The results also show the grid point, elevation and time zone the API used.

## Tests
- `node --test bots/weather/test_stats.js` has 10 tests, all passing. They cover unit conversions and formatting, date slots and ranges, default year, partial-year labels, trimming the trailing null tail, streak logic (including gaps, ties and month boundaries), the 90/32 thresholds, a full Buffalo fixture checked against brute force, a full-year Phoenix run, a null tail, and normals and the weirdest day.
- `NODE_PATH=/opt/npm-tools/node_modules node bots/weather/test_page.js <shots dir>` runs 52 checks, all passing.
  - It uses Playwright at 390px and 1280px with frozen clocks (Nov 16, 2026 and Jan 2, 2027).
  - **The API is mocked:** the shell can't reach Open-Meteo, so `archive-api` and `geocoding-api` are answered by Playwright route interception. The answers come from `bots/weather/fixtures.js`: synthetic seeded weather for Buffalo, Phoenix and London in the documented response format (daily + daily_units, API default units). The weather values are invented. Kit is stubbed.
  - It checks:
    - the request URLs: variables, dates through yesterday, the normals range;
    - the card count and order, the labels and the partial note;
    - the ?ref passthrough, the PNG and zip downloads, and the unit toggles;
    - the cross-promo strip and the footer links;
    - that the Kit payload has only api_key and email;
    - no CSP violations, no console errors, only the expected hosts, and no horizontal scroll;
    - the Jan 2 full-year label, the normals-failure fallback and the error messages.
- Screenshots and card PNGs are in `/tmp/claude-0/-home-claude/69ef2e03-4772-566e-a19b-2f78e096e5ba/scratchpad/shots/weather/`.
- **Not tested against the live API.** Before launch, open the page once on a real network and compare one city's numbers with the Open-Meteo docs' URL builder.

## Before launch (Matt)
1. Create a Kit tag (e.g. `weather-wrapped-2026`) and replace `TAGID_WEATHER` in `docs/weather/kit.js`. Until then the reminder box stays hidden.
2. **Optional, outside this task's scope** (these files were left alone on purpose):
   - add `weather` to `docs/apps/more.js` (APPS, plus a thumbnail at `docs/apps/img/weather.jpg`) so other apps can promote it;
   - add a hub card in `docs/index.html` and `docs/apps/`;
   - add `weather/` to `docs/sitemap.xml`.
3. Do one live smoke test, because the fixtures follow the documented format but no live response was seen from here.
4. Commit `docs/weather/` and `bots/weather/`.
5. Cards are about 1.3-2 MB PNGs each because of the smooth gradients, so the zip of 7 cards is about 12 MB. Fine for sharing; could switch to JPEG later if needed.
