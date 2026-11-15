# Streaming Wrapped (Netflix Wrapped): notes

Page: `docs/netflix/` (served at https://lanternlab2027.github.io/lab/netflix/). Built and tested Nov 14, 2026, for idea #3 in `bots/ideas/APPS_ROUND2.md`. Not committed.

Tracked files changed: `docs/sitemap.xml` (one `netflix/` entry) and `docs/index.html` (one hub card, after Reading Wrapped). Everything else is new: `docs/netflix/` and `bots/netflix/`.

## What it does

1. The visitor uploads `NetflixViewingHistory.csv` (Viewing activity > Download all). Drag-and-drop works. A full data-request zip (or its `ViewingActivity.csv`) also works. There's a sample-deck button that uses invented titles.
2. Everything is parsed, counted and drawn in the browser. Nothing is uploaded.
3. They get up to 10 cards at 1080x1920 (canvas). Cards without data are skipped.
   - **Titles watched:** count, change vs last year, a "wall of screens" with one tile per title colored by show, plus episodes, movies and estimated hours.
   - **Top show:** a marquee sign, episode count, seasons, first and latest dates, share of the year, episodes by month and the runner-up.
   - **The big binge:** the day with the most titles, its playlist and your average on a normal watch day.
   - **When you watch:** month bars and weekday bars, with ties worded properly and the weekend share. For All time it shows bars by year.
   - **Movies vs series:** the split and your latest movies.
   - **Comfort watch:** the title you returned to in the most months, with extra weight for earlier years and exact repeats. It shows a month-dot row (a year x month grid for All time). Needs 3+ months, or 2+ months plus an earlier year or a repeat. When it's close, it prefers a title other than the top show.
   - **Longest streak:** consecutive days, a 12-month calendar heatmap, days watched and % of days.
   - **First & latest:** two ticket stubs.
   - **Top 5 shows:** a leaderboard, plus how many shows you tried for one episode. Dropped first if the deck goes over 10.
   - **Viewer personality:** 8 archetypes scored from the stats (Binge Machine, Loyalist, Film Buff, Channel Hopper, Weekend Warrior, Comfort Rewatcher, Daily Ritualist, Seasonal Hibernator), up to 2 "streak of" traits, and "The Easygoing Viewer" as the fallback.
4. **Controls:**
   - **Year:** years in the file plus All time. Defaults to the current year, or falls back to the latest year with data and says so (tested with a January 2027 clock).
   - **Name on cards:** optional.
   - **Profile:** only shown for multi-profile archive files.
5. **Share code:** Share, Save PNG, Share all and the .zip download are copied from Reading Wrapped. The `?ref=` passthrough (`?ref=X` becomes `?ref=share-X`) and the "Make yours: lanternlab2027.github.io/lab/netflix" line on every card work the same way.
6. **Kit signup** ("Get next year's Streaming Wrapped"):
   - same pattern as reading and wrapped;
   - the public api_key was copied programmatically from `docs/reading/app.js`, not retyped or printed;
   - tag **`TAGID_NETFLIX`** is a placeholder;
   - sends only `api_key` + `email`.

## To do before launch (Matt)

1. Create a Kit tag (e.g. `netflix-wrapped-2027`) and replace `TAGID_NETFLIX` in `docs/netflix/app.js`. Until then, signups show "didn't go through".
2. Commit `docs/netflix/`, `bots/netflix/`, `docs/sitemap.xml` and `docs/index.html`. Nothing was added to `.git/info/exclude`.
3. Optional, for SEO: a `docs/guides/how-to-download-netflix-viewing-history.html` guide like the Goodreads ones.

## Export format (verified Nov 14, 2026)

- **Steps.** These are from Netflix's help center, [How to see viewing history and device activity](https://help.netflix.com/en/node/101917):
  1. From a web browser, go to your Account page.
  2. Select Profiles, then choose a profile.
  3. Open Viewing activity.
  4. "Download all" at the bottom of the page downloads a CSV.

  The steps are browser-only and per profile. The page copy follows them and cites that URL.
- **Columns.** Netflix's help center does **not** document the columns.
  - Secondary sources agree on two columns, `Title` and `Date`, in a file usually named `NetflixViewingHistory.csv`: [learnsql.com "Netflix Wrapped with SQL"](https://learnsql.com/blog/netflix-wrapped-with-sql/), [pfkimmerle Substack analysis](https://pfkimmerle.substack.com/p/pandas-python-and-popcorn-analyzing) and the [SAS community how-to](https://communities.sas.com/t5/SAS-Communities-Library/How-to-download-your-Netflix-history-and-import-to-SAS/ta-p/725291) ("one record per streamed title, with two fields", month/day/year).
  - Dates follow the account locale (US `M/D/YY`), so the parser doesn't assume one format.
- **Full data request.** [Netflix help node 100624](https://help.netflix.com/en/node/100624): netflix.com/account/getmyinfo, up to 30 days.
  - Its `CONTENT_INTERACTION/ViewingActivity.csv` columns (`Profile Name, Start Time, Duration, Attributes, Title, Supplemental Video Type, Device Type, Bookmark, Latest Bookmark, Country`) come from [takeoutday.org](https://takeoutday.org/guides/how-to-download-netflix-data) and common knowledge of the archive. They're unverified against a real file, so the parser finds columns by name and tolerates gaps.
- **Unverified:** whether the per-profile file lists a rewatched title once (at its latest date) or once per viewing. The comfort card works either way: it counts distinct months per show, and counts exact repeats if present. The FAQ says "may list a title you watched twice only once".
- **Before launch:** download one real `NetflixViewingHistory.csv` and drop it in. The fixtures are synthetic, as instructed.

## Parser robustness (parser.js)

- **CSV:**
  - RFC-4180 quoting with commas and quotes inside titles;
  - BOM, CRLF;
  - comma, semicolon or tab delimiter, auto-detected.
- **Columns:**
  - matched by name in several languages (`Title/Titel/Titre/Titulo...`, `Date/Datum/Fecha/Data/Start Time`);
  - if the header is unknown or missing, columns are picked by content (the most date-like column and the most text-like column);
  - a headerless file works.
- **Dates:**
  - accepted forms: `M/D/YY`, `D/M/YYYY`, `D.M.YY`, ISO, ISO with time, "Nov 14, 2026" and "14 Nov 2026".
  - M/D vs D/M is decided once for the whole file:
    1. values over 12 decide it;
    2. otherwise dotted dates mean D/M;
    3. otherwise the reading that keeps the file's newest-first order wins (tested on an all-ambiguous file).
  - Impossible dates (2/30) are rejected.
- **Titles (`Show: Season 1: Episode Title`):**
  - Segments are split on `": "`, so `10:30 Express` isn't split.
  - The first season-like segment marks a series. Everything before it is the show, so `Orbit Station: Nova Ring: Season 1: ...` works, and everything after it is the episode, so episode names with colons survive.
  - Strong markers count even without an episode name after them: Season/Series/Temporada/Saison/Staffel/Stagione/Seizoen/Sezon/... N, Limited Series, Miniseries, Specials, "2nd Season".
  - Weak markers (Part/Volume/Book/Chapter/Collection N) only count when an episode name follows, so the movie `Glass Ferry: Part 2` stays a movie.
  - `Show: Episode 3` (and Folge/Episodio/...) is an episode.
  - **Whole-file pass:**
    - an entry with no season marker joins a show already known from season markers;
    - otherwise, if 2+ different titles share a prefix (a docuseries like `Deep Blue Atlas: Kelp Cathedral`), they become one series;
    - otherwise the full title is a movie or special (`Mission: Improbable`).
  - Different capitalisations of a show are merged.
  - Known limit: two different movies sharing a prefix (`Glass Ferry: The Return` + `Glass Ferry: Origins`) would be grouped as one "series".
- **Archive:**
  - rows with a Supplemental Video Type (trailers, previews) are dropped;
  - sessions under 2 minutes are dropped;
  - repeat sessions of the same title on the same day count once;
  - the profile selector defaults to the biggest profile;
  - Sam's rows match the per-profile fixture exactly (unit test).
- **Errors:** a non-Netflix CSV or an empty file shows a clear error.

## Privacy design

Same approach as Reading Wrapped:

- **CSP meta tag:** `default-src 'none'; script-src 'self'; connect-src https://api.convertkit.com; ...`.
- **No outside assets:** no CDN, analytics or web fonts. JSZip 3.10.1 is vendored with its license.
- **Nothing is stored:** no localStorage or cookies.
- **Page copy:**
  - privacy badge;
  - "How we know" section;
  - airplane-mode tip;
  - footer "Not affiliated with Netflix" disclaimer;
  - footer link to `../`.

## Design

- **Palette and frame:** our own "late show" palette: near-black teal (#081316 page, #10262d cards), marquee amber (#ffb648), teal (#5ee0d0), coral (#ff9b73) and navy. There's no Netflix red, logo or wordmark anywhere. Cards carry film-strip sprocket edges, a projector beam, a marquee sign, ticket stubs and a clapperboard.
- **Name:** the product is called "Streaming Wrapped", and "Netflix" only appears descriptively.

## SEO

- **Title:** "Netflix Wrapped 2026: Free Netflix Year in Review From Your Viewing History".
- **Description and FAQ:** both target "netflix wrapped" and "netflix year in review".
- **Social tags:** OG and Twitter tags, plus JSON-LD WebApplication with alternateName Netflix Wrapped / Netflix Year in Review.
- **Images:** `og.png` (1200x630) and `preview.jpg` are built from the synthetic deck by `bots/netflix/make_og.js`.
- **Sitemap:** added to `docs/sitemap.xml`.
- **Yearly maintenance:** the title says 2026.

## Files

| File | What |
|---|---|
| `docs/netflix/index.html` | Page, CSS, SEO/OG/JSON-LD, cited export steps, privacy, FAQ, disclaimer |
| `docs/netflix/parser.js` | CSV, date-order detection, title parser, archive support (UMD, runs in Node tests) |
| `docs/netflix/stats.js` | Year stats, binge, streak, comfort, personality |
| `docs/netflix/cards.js` | Canvas renderer (6 themes) |
| `docs/netflix/app.js` | UI wiring, year/name/profile controls, share/download/zip, `?ref`, Kit |
| `docs/netflix/demo.js` | Deterministic invented history (20 fake shows, 40 fake movies) |
| `bots/netflix/make_fixtures.js` | Synthetic fixtures: US/UK/German formats, spreadsheet re-save, headerless, all-ambiguous dates, tricky titles, archive zip with 2 profiles + trailers, tiny, empty, non-Netflix |
| `bots/netflix/test_parser.js` | Unit tests (13) |
| `bots/netflix/test_page.js` | Playwright e2e at 390px and 1280px plus a January-2027 fallback (101 checks) |
| `bots/netflix/make_og.js` | Builds og.png + preview.jpg |

All JS is pure ASCII (`\u` escapes).

## Tests

```
node bots/netflix/make_fixtures.js
node --test bots/netflix/test_parser.js
NODE_PATH=/opt/npm-tools/node_modules node bots/netflix/test_page.js <screenshot dir>
```

At each width, the e2e test:

1. freezes the clock to Nov 14, 2026;
2. intercepts every request and asserts **zero requests of any kind after upload**, across 12 uploads;
3. checks that CSP blocks a third-party fetch;
4. checks that Kit (stubbed) gets one call to `TAGID_NETFLIX` with only `api_key` + `email`;
5. checks the SEO, OG, disclaimer, `../` link, the help-center citation and `?ref=share-tiktok`;
6. checks for all 9 required cards, each 1080x1920 and non-blank;
7. checks year default/options/re-render, all time, name, and the profile switch;
8. checks that UK/German files give the identical deck;
9. checks Save PNG and the zip;
10. checks for no horizontal scroll;
11. checks the error messages;
12. checks for no page errors.

Status Nov 14, 2026: 13/13 unit tests pass and the e2e test reports ALL PASSED.

## Visual review

Every card was rendered and inspected for:

- the 2026 sample;
- All time with a 29-character name;
- a 2-title file;
- the archive.

Fixed during review:

- **fitWrap could stop shrinking text too early.** It measured already-ellipsized lines, so text was truncated ("SALTMARSH INSPECTO...") instead of shrunk. Fixed in `docs/netflix/cards.js`. **The same bug exists in `docs/reading/cards.js` `fitWrap` and was not changed**; the fix is to measure the un-ellipsized lines.
- the streak legend overlapping the chips;
- ticket notches rendering as transparent holes (black in the PNG);
- ticket text not vertically centred;
- the first/last chips touching the footer;
- runner-up colliding with the month strip;
- empty lower thirds on the top show, movies and comfort cards (added a month strip, a quip and a "most recently" line);
- the all-time comfort card (year x month grid);
- tiny-data wording ("1 show", "nothing in between", the same-day case).

PNGs are about 1.3-1.7 MB each (grain and gradients), like the other apps.
