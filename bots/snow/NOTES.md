# Snow Day Odds: notes

Page: `docs/snow/` (will be served at https://lanternlab2027.github.io/lab/snow/). Built and tested Nov 15, 2026. Not committed. The hub (`docs/index.html`), `docs/apps/` and the sitemaps were **not** updated; add the Apps card and the sitemap URL when this ships.

## Files

| File | What |
|---|---|
| `docs/snow/index.html` | Markup, CSS (system fonts, light/dark), SEO ("snow day calculator", "snow day predictor 2026"), OG/Twitter/JSON-LD, "How we estimate" with the full formula, disclaimer (twice), NWS credit and the "not affiliated" note, "Make yours" footer, links to `../` and `../apps/`. |
| `docs/snow/model.js` | Pure logic (UMD): ISO 8601 durations and `validTime` intervals, WMO unit conversion, time-zone window, `extract()` (grid + alerts to inputs), `odds()` (the heuristic + plain reasons). |
| `docs/snow/nws.js` | ZIP lookup (static shards), city geocoding (Open-Meteo), NWS `/points` then `forecastGridData` + `/alerts/active?point=`; timeout, one retry on 5xx/429. |
| `docs/snow/card.js` | 1080x1350 share card and the 1200x630 OG image (canvas). |
| `docs/snow/app.js` | UI, URL state (`?zip=` or `?q=`, `&r=used|rare`), `?ref=` passthrough (same scheme as names: share -> share2 ...), share/save image, copy link, localStorage for last ZIP/town and region only. |
| `docs/snow/kit.js` | Optional Kit signup, placeholder tag. |
| `docs/snow/z/NN.json` | 99 ZIP shards (first two digits), 33,791 ZIPs, ~960 KB total; a lookup loads one ~10 KB shard. `z/index.json` has the source line. |
| `docs/snow/og.png` | Made by `bots/snow/make_og.js`. |
| `bots/snow/build_zips.js` | Builds the shards from a `{"ZIP":[lat,lon]}` JSON. |
| `bots/snow/fixtures.js` | Synthetic NWS responses (see below). |
| `bots/snow/test_model.js` | `node --test bots/snow/test_model.js` (12 pass). |
| `bots/snow/test_page.js` | `NODE_PATH=/opt/npm-tools/node_modules node bots/snow/test_page.js <shot dir> [--no-live]` (66 checks pass; live smoke skipped, see below). |

CSP `connect-src`: `'self'` (ZIP shards), `https://api.weather.gov`, `https://geocoding-api.open-meteo.com`, `https://api.convertkit.com`. No other hosts; the test asserts it. No third-party scripts. Source is ASCII-only.

## NWS API (checked Nov 15, 2026)

- **Not reachable from this container**: the proxy answers 403 to CONNECT for `api.weather.gov` (and `www.weather.gov`). So all browser tests use **hand-written fixtures in the documented GeoJSON shape** with Playwright route interception, not recorded responses. **Before launch, open the page in a real browser and check a few ZIPs** (and run `test_page.js` without `--no-live` from a machine that can reach NWS; the live smoke runs automatically there and checks the CORS header).
- NWS docs page (fetched via WebFetch): "A User Agent is required to identify your application"; no key "currently" ("will be replaced with an API key in the future"); rate limits exist but aren't public, retry after ~5 s; data is "open data, free to use for any purpose"; re-check `/points` periodically because grid mapping can change (we always call `/points`).
- Browser User-Agent: an NWS maintainer in weather-gov/api discussion #312 says browsers won't let pages set it and "Using the default UA in a client-side application is fine." A custom UA would trigger a preflight that fails, so we set **only `Accept: application/geo+json`** (CORS-safelisted, no preflight). Safari was reported intermittent in that thread; untested here.
- Format assumptions (from the API schema, tested in unit tests): grid layers are `{uom: "wmoUnit:mm" | "wmoUnit:degC" | "wmoUnit:percent", values: [{validTime: "2026-12-02T06:00:00+00:00/PT6H", value}]}`. We also accept cm/m/in/degF/K, `start/end` intervals, `P1DT6H`-style durations, and null values. Accumulations are pro-rated by overlap with the window.
- `/points` with more than 4 decimals redirects, so we round to 4. A 404 there means outside NWS coverage (friendly message).
- Town name for the result and card comes from `/points` `relativeLocation` (nearest city), so ZIP and geolocation results need no geocoder.

## ZIP centroids

- Source: U.S. Census Bureau **2026 Gazetteer Files, ZCTA national file** (INTPTLAT/INTPTLONG). Census data is public domain (U.S. government work).
- census.gov was blocked from this container, so the JSON was taken from a public GitHub mirror of that file (`johncollinsgit/TimberLine`, `resources/data/us-zcta-centroids-2026.json`, with a `.source.json` naming the Census zip URL, its sha256 and row count 33,791; our count matches). Cross-checked against an independent mirror of the **2023** Gazetteer (`FalconXYX/LeadMaker`, 6,309 Northeast ZIPs): all present, 16 moved more than 2 km (vintage changes), none wildly off. **Optional before launch:** rebuild from the Census file directly (`2026_Gaz_zcta_national.zip`, tab-separated, take GEOID/INTPTLAT/INTPTLONG) with `build_zips.js`.
- ZCTAs aren't exactly ZIPs: PO-box-only ZIPs aren't in the file, and the user gets "couldn't find ZIP, try a nearby one or your town".

## Town search

- Open-Meteo geocoding API (`geocoding-api.open-meteo.com/v1/search?countryCode=US`), no key, CORS-enabled. Docs credit "Location data based on GeoNames" (CC BY 4.0), which the page shows.
- **Terms caveat:** the free tier is for non-commercial use, and Open-Meteo's terms say sites "that have subscriptions or display advertisements" are commercial. Limits: under 10,000 calls/day, 5,000/hour, 600/minute. Fine today (no ads; only typed town names hit it, never ZIPs or geolocation). **If ads are added, switch** to a paid key, Photon (komoot; "reasonable" use, no key, OSM data needs attribution), or a static Census Places list like the ZIP shards.
- "Springfield" without a state picks Open-Meteo's top US hit; "Springfield, IL" filters by state (2-letter or full name).

## The model (all of it is on the page)

Window: 6pm the evening before to 8am on the school morning, in the location's time zone (from `/points`). Before 5am local, "tomorrow" means the coming morning. DST is handled.

- Snow points = `50 x inches / T`, cap 75. T = 6 in. (snow-used) or 1.5 in. (rarely sees snow).
- Ice points = `50 x inches / T`, cap 60. T = 0.25 in. or 0.1 in.
- Timing: if under 0.1 in. falls 5am-8am, overnight snow counts at 60%.
- Confidence: snow and ice points x `0.6 + 0.4 x min(1, maxPoP / 70)`.
- Cold (lowest wind chill, else low): snow-used -25F: 25, -15F: 10; rarely: 0F: 20, 10F: 10.
- Alerts (active for the point, not ended before tonight, not starting after noon): Blizzard/Ice Storm Warning 25, Winter Storm Warning 20, Extreme Cold/Wind Chill Warning 15, Winter Weather Advisory 8 or 15 (rarely), Winter Storm Watch 6, Cold Weather/Wind Chill Advisory 5; sum capped at 30. (Lake Effect Snow Warning 20 kept in case it shows up; NWS folded it into Winter Storm Warning in 2024.)
- Chance = sum, rounded, clamped to 1..99. Labels: <10 "Pack your bag", 10 "Long shot", 25 "Maybe a delay", 50 "Real chance", 75 "Pajamas inside out".
- Region default is a guess (latitude under 36.5 = rarely), shown with a note; the user's choice sticks (localStorage) and is in shared links (`r=`).
- Weekend mornings get a "not usually a school day" note.
- The thresholds are judgment calls, not fitted. Worth sanity-checking against a few real storms once live NWS data is reachable.

## Kit

- `kit.js` copies the public key from `docs/eats/kit.js` (same as the other apps). Tag is the placeholder `TAGID_SNOW`; while it isn't numeric the box stays hidden.
- Sends only `email` and `fields.snow_zip`. **Create the custom field `snow_zip` in Kit and replace `TAGID_SNOW` before launch.** No name, age or school is asked. Copy says "If you're under 13, ask a parent or guardian to sign up instead."
- The alert sender doesn't exist yet: a daily bot (evening, Dec-Mar) that runs `model.js` per subscribed ZIP and emails when the chance is, say, 50%+. Same one-value-per-subscriber limitation as eats.
- Tests set the tag with `window.SNOW_KIT_TAG_TEST`.

## Privacy

Geolocation runs only on "Use my location". Coordinates go only to NWS, never into the URL or share text (we share `?q=<nearest town>`). localStorage holds only the last ZIP/town typed and the region choice.

## Follow-ups

- **Town pages** ("snow day chance Buffalo"): ~300 pre-built pages for the snowiest metros (idea doc), each with a prefilled region and a link into `?zip=`. Skipped for now. Add them to a sitemap when built.
- Live verification against real NWS responses (see above), including Safari.
- Hub card, `docs/apps/` entry, sitemap URL, cross-promo strip (other agent).
- Screenshots from this build: `/tmp/claude-0/-home-claude/69ef2e03-4772-566e-a19b-2f78e096e5ba/scratchpad/shots/snow/` (not kept in the repo).
