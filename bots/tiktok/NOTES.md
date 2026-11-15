# TikTok Wrapped ("Scroll Wrapped", Wrapped for your TikTok data): notes

Page: `docs/tiktok/` (served at https://lanternlab2027.github.io/lab/tiktok/). Built and tested Nov 15, 2026, for idea #2 in `bots/ideas/APPS_ROUND3.md`. Not committed.

Tracked files changed: `docs/index.html` (one hub card, after Streaming Wrapped) and `docs/sitemap.xml` (one `tiktok/` entry). Everything else is new: `docs/tiktok/` and `bots/tiktok/`. `docs/apps/index.html` was **not** updated (it needs an `img/tiktok.jpg`); add it there when launching.

## What it does

1. **Step 1 (top of the page): "Request your export now (it takes 1–4 days)".** A 7-step app guide, plus a one-line desktop path, a "Skip to step 2" link and a citation to TikTok's help page. Below it, a Kit signup: "Email me a reminder when Wrapped season opens".
2. **Step 2: upload.** Accepts the zip TikTok sends (JSON or TXT), `user_data_tiktok.json` / `user_data.json`, or `Watch History.txt`. Multiple files can be selected at once, and duplicates are dropped. There's a sample-deck button. Everything runs in the browser.
3. **Cards** (1080x1920, up to 10; a card is skipped when it has no data):
   - **Videos watched:** the count, the change vs last year, and a month x day heat grid.
   - **Time estimate:** "≈N minutes", with a boxed explanation: "N videos × 30 seconds … Your export has no watch times, so we assume 30 seconds a video". It also shows minutes per day, feature-film equivalents and the measured median gap between videos as a reality check.
   - **Busiest day:** the date, the count, and videos-by-hour bars for that day, plus the first and last video and the multiple of a typical day.
   - **Scroll clock:** a 24-hour radial chart, the night-owl share (local midnight to 4:59am), the peak hour, the latest night, and the time zone used.
   - **Peak month:** month bars plus weekday bars. In All time it shows bars by year.
   - **Doomscroll session:** the longest run where every gap is under 2 minutes, with a tick strip of one tick per video. It needs 5 or more videos.
   - **Longest streak:** consecutive local days, with a 12-month calendar.
   - **Likes:** the count, "one like for every N videos", a 100-square like-rate waffle, and counts of comments and shares.
   - **Top searches:** terms are **hidden by default** (counts and redacted bars only). A "Show my search terms" checkbox opts in.
   - **Year in the feed:** a persona (Night Owl, Marathon Scroller, Daily Regular, Generous Liker, Quiet Watcher, Weekend Scroller, or Casual) and 6 stat tiles.
4. **Controls:** year (defaults to the current year, falling back to the latest year with data), time zone (defaults to the device zone; the full IANA list plus UTC), name on cards, and the search-terms opt-in.
5. **Share code, copied from Streaming Wrapped:** Share, Save PNG, Share all, the .zip, and "Pass it on". The `?ref=X` passthrough becomes `?ref=share-X`. Every card carries "Make yours: lanternlab2027.github.io/lab/tiktok". Footer links go to `../` and `../apps/`.

## Privacy

- **Direct messages are skipped entirely.**
  - **Zip files:** paths matching direct message / chat history / messages are never decompressed (`pickEntries`).
  - **JSON files:** the messages keys are deleted right after `JSON.parse`, and the walker never descends into them. JSON.parse still has to read the whole file to find the watch history, and the notes on the page say so ("thrown away the moment the file is opened").
  - **Tests:** a canary string in every fixture's DMs is asserted absent from the parsed state, the page text and the cards.
- **Data never kept:** comment text, login IPs and devices, and video links. Links are only used for de-duplication and are then dropped.
- **Same safeguards as the other Wrapped apps:** the CSP (`connect-src` is Kit only), vendored JSZip, no storage, no analytics. All JS is pure ASCII.

## Export format (researched Nov 15, 2026)

**Primary sources are parsers in public GitHub repos.** Raw files were fetched from raw.githubusercontent.com:

- `tmk907/MyTikTokBackup` (UserData.cs)
- `william-spongberg/my-stats` (types/tiktok.ts)
- `zollo/tiktok-downloader` (data_structure.yml)
- `pwikstrom/foryou-research` (fyp/ingest/tiktok.py, which documents the layout rename and UTC dates)
- `arashbm/tiktok-sanitizer` (sanitizePolicy.ts)
- `nalediym/creator-dna` (parser.ts)
- `danfox127-dotcom/TikTokAnalyzer` (parsers/tiktok.py)
- `nadiadmello/SocialMediaAddiction` (txt_export_to_json.py, "confirmed against a real export")
- `trbKnl/dd-tiktok-harvard` (the d3i data-donation TXT parser)
- `germanorbegozo/ReadSentimentTikTok`
- `samirelanduk/tiktok-save`

**JSON layouts:**

- **2024+ layout** (`user_data_tiktok.json`):
  - `"Your Activity" > "Watch History" > "VideoList": [{Date, Link}]`
  - `"Your Activity" > "Searches" > "SearchList": [{Date, SearchTerm}]`
  - `"Your Activity" > "Share History" > "ShareHistoryList": [{Date, SharedContent, Link, Method}]`
  - `"Your Activity" > "Login History" > "LoginHistoryList": [{Date, IP, DeviceModel, DeviceSystem, NetworkType, Carrier}]`
  - `"Likes and Favorites" > "Like List" > "ItemFavoriteList": [{date, link}]` (lowercase keys)
  - `"Comment" > "Comments" > "CommentsList": [{date, comment, photo, url}]`
  - `"Direct Message" > "Direct Messages" > "ChatHistory"`
  - Empty lists are `null`.
- **Older layout** (`user_data.json`, up to about 2024):
  - `"Activity" > "Video Browsing History" > "VideoList"`
  - `"Activity" > "Like List"`
  - `"Activity" > "Search History" > "SearchList"`
  - `"Direct Messages" > "Chat History"`
  - `"Video" > "Videos" > "VideoList"` holds your own posts, **not** watch history.
- **How the parser finds lists:** by list key, case-insensitively, wherever they sit. `VideoList` only counts as watch history under a Watch/Browsing History parent.

**Dates:** UTC wall-clock `YYYY-MM-DD HH:MM:SS`. Newer comment dates and the TXT export add ` UTC`. Local time uses Intl, with the offset cached per half hour.

**TXT export:**

- A zip with `Your Activity/Watch History.txt`, `Your Activity/Searches.txt`, `Likes and Favourites/Like List.txt`, `Comment/Comments.txt` and similar files.
- Older exports use `Activity/Browsing History.txt`.
- Each file is blank-line-separated blocks of `Label: value` (`Date:`, `Link:`, `Search Term:`, `Comment:`, `Shared Content:`, `Method:`).
- **Known limit:** TXT file names are translated in non-English accounts (for example Dutch "Likelijst.txt"). Unknown names are only used if their content has `Search Term`; a Date+Link file is never guessed. The FAQ points those users to JSON.

**Request steps:**

- **Not checked against TikTok's own page.** support.tiktok.com and tiktok.com/support could not be fetched from here (blocked by robots.txt and the proxy). The steps were cross-checked against:
  - PIRG's guide
  - TechCrunch (Jan 2025)
  - Lilach Bullock (updated Nov 13, 2026)
  - Phyllo (Jul 2026)
  - theappguides (Jul 2026)
  - takeoutday.org (verified Sep 28, 2026)
- **What those sources agree on:**
  - the path Profile > Menu > Settings and privacy > Account > Download your data;
  - the choice of all data or custom, and of TXT or JSON;
  - Request data, then the Download data tab, then Download;
  - the file is "available for up to 4 days", and it "may take a few days".
- **Desktop path:** takeoutday says tiktok.com/settings/privacy. The page words this loosely.
- **Before launch:** open the cited support URL in a normal browser and confirm the wording.
- **Before launch:** test with one real export (JSON and TXT). All fixtures are synthetic.

## To do before launch (Matt)

1. **Kit tag.** Create a Kit tag (for example `tiktok-wrapped-reminder`) and replace `TAGID_TIKTOK` in `docs/tiktok/app.js`. Until then, signups show "didn't go through".
   - The public api_key was copied programmatically from `docs/eats/kit.js` and never printed.
   - The signup sends only `api_key` and `email`.
2. Check the request steps against TikTok's help page and run one real export (see above).
3. Add a card to `docs/apps/index.html`.
4. Commit `docs/tiktok/`, `bots/tiktok/`, `docs/index.html` and `docs/sitemap.xml`.
5. Launch the request-now page by Dec 1 (from the idea entry).

## SEO

- **Title:** "TikTok Wrapped 2026: Free Year in Review From Your TikTok Data Export".
- **Description:** targets "TikTok Wrapped 2026".
- **Tags:** OG and Twitter tags, plus JSON-LD WebApplication (alternateName TikTok Wrapped / TikTok Wrapped 2026).
- **Images:** `og.png` (1200x630) and `preview.jpg` are built from the synthetic deck by `bots/tiktok/make_og.js`.
- **Branding:** the visible brand is "Scroll Wrapped". "TikTok" only appears descriptively. The footer says "Not affiliated with TikTok or ByteDance". There are no logos, and the palette (forest, lime, amber, coral, indigo, cream) avoids TikTok's black/cyan/pink.

## Files

| File | What |
|---|---|
| `docs/tiktok/index.html` | Page, CSS, SEO/OG/JSON-LD, request guide, privacy and DM note, FAQ, disclaimer |
| `docs/tiktok/parser.js` | Dates, time zones, JSON walker, TXT blocks, zip entry picking, DM skipping (UMD, Node-testable) |
| `docs/tiktok/stats.js` | Year stats, estimate (`AVG_SECONDS = 30`), busiest day, clock, streak, sessions (`SESSION_GAP_MS = 2 min`), likes, searches |
| `docs/tiktok/cards.js` | Canvas renderer (6 themes, 10 cards, persona) |
| `docs/tiktok/app.js` | UI, year/tz/name/terms controls, share/save/zip, `?ref`, Kit |
| `docs/tiktok/demo.js` | Deterministic invented export (2024+ layout) for the sample and fixtures |
| `bots/tiktok/make_fixtures.js` | Fixtures: 2024+ JSON, legacy JSON, TXT zip, legacy TXT zip (CRLF, no UTC), JSON zip, lone Watch History.txt, empty sections, watch-only, tz probes, tiny, not-TikTok, empty. All contain a DM canary where DMs apply |
| `bots/tiktok/test_parser.js` | 13 unit tests: dates, time zones (NY EST/EDT, Tokyo, Kolkata +5:30, New Year's Eve year split), each layout, TXT = JSON equality, DM never opened, empty/missing sections, dedupe, stats, cards |
| `bots/tiktok/test_page.js` | Playwright at 390px and 1280px plus a Jan 2027 fallback (114 checks) |
| `bots/tiktok/make_og.js` | Builds og.png and preview.jpg |

## Tests

```
node bots/tiktok/make_fixtures.js
node --test bots/tiktok/test_parser.js
NODE_PATH=/opt/npm-tools/node_modules node bots/tiktok/test_page.js <screenshot dir>
NODE_PATH=/opt/npm-tools/node_modules node bots/tiktok/make_og.js
```

The e2e test, at each width:

- **Page basics:** zero off-origin requests on load; SEO, OG, disclaimer, `../` and `../apps/`, CSP; the request guide sits above the upload and cites TikTok support; the DM note; `?ref=share-tiktok`.
- **Decks:** the sample deck has 10 cards; the JSON upload gives all 10 labels at 1080x1920 and none are blank.
- **Privacy:** the DM canary is absent from state and text, and so are comment text and IPs.
- **Controls:** the search-terms toggle changes only the searches card; changing the time zone re-renders the clock; year and all time work; the name re-renders.
- **Downloads:** Save PNG and the zip both work.
- **Format equivalence:**
  - The TXT zip, JSON zip and legacy JSON each give pixel-identical decks.
  - The legacy TXT zip gives the same card list; only the likes and summary cards differ, because that fixture has no comments or shares.
  - The other fixtures render, and the error messages are clear.
- **Network:** zero requests after upload, and the CSP blocks a third-party fetch.
- **Kit (stubbed):** one call to `TAGID_TIKTOK`, with only `api_key` and `email`.
- **Errors:** no page errors.

Status Nov 15, 2026: 13/13 unit tests pass, and the e2e test reports ALL PASSED.

Screenshots and card PNGs are in the session scratchpad (`.../scratchpad/shots/tiktok/`), not in bots/.

## Visual review (fixed)

- The year pill was unreadable on the coral theme. Pill text now picks its contrast from the accent's luminance.
- Ellipsized text: "20,089 videos × 30 se…", "without putting it do…" and the median-gap line. Fixed with fitSize and wrap.
- Wording on tiny files: "About 0 hours", "≈0h" and "0 feature films" now fall back to minutes or days.
- Doomscroll cards for 2-video "sessions". The card now needs 5+ videos.
- The heat grid was squat, leaving empty space. Rows are taller now.
- Counts sat under the redacted search bars and are now on the bars.
- All JS was converted to ASCII escapes. The Write tool had stored literal ≈ × ’ characters.
