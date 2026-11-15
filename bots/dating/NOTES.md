# Dating Wrapped (Tinder Wrapped / Hinge Wrapped): notes

Page: `docs/dating/`, served at https://lanternlab2027.github.io/lab/dating/. Built and tested Nov 15, 2026, for idea #2 in `bots/ideas/APPS_ROUND2.md`. **Not committed or pushed.**

Tracked files changed: `docs/sitemap.xml` (one `dating/` entry). Everything else is new: `docs/dating/` and `bots/dating/`. No hub card was added to `docs/index.html`; add one when launching.

## What it does

1. **Upload.** The visitor drops one or more files:
   - Tinder: the emailed zip, or `data.json`.
   - Hinge: the emailed zip, the legacy `matches.json`, or the newer CSV tables.

   A sample-deck button uses invented numbers. A second app's export can be added afterwards ("Add your Hinge export too"). Re-uploading the same app replaces it.
2. **Parsing.** All parsing happens in memory, in the page.
   - From a zip, only the activity files are read: `data.json`, `matches.json`, `match_likes/roses/skips/blocks.csv`, `chat_message.csv` and `chat_voice_note.csv`. Photos, `index.html`, `user.*`, `prompts.*` and `media.*` are never decompressed.
   - The parser turns each file into **numbers only** (day numbers, hours and counts). Message text, names, match ids, comments, prompts and profile fields never leave `parser.js`. Unit tests check this with CANARY strings.
3. **Cards.** Up to 9 cards at 1080x1920. A card without enough data is skipped.
   1. **The year in swipes:** right-swipe % plus a label (Very picky / Picky / Selective / Generous / Very generous / Swiped right on everyone) and a yes/no split bar. For legacy Hinge, which has no passes, the full mode shows "Likes sent" instead.
   2. **Match rate:** "N in 100" right swipes became a match, with a 100-heart pictogram.
      - Hinge JSON adds "% of matches liked you first".
      - Hidden for Hinge CSV, which has no match data.
   3. **Peak season:** month bars with the peak month and a dashed "cuffing season" bracket (Oct-Feb). All time shows bars by year instead.
   4. **Busiest day:** the date, "N swipes in one day" (or "9.2x your usual day" in safe mode), weekday bars and the weekend share.
   5. **The swipe clock:** a 24-hour radial clock, peak hour and late-night share.
      - Hinge uses like and skip times.
      - Tinder has no swipe times, so the clock uses message `sent_date`s and is titled "When you chat" ("The evening romantic", "The 2am texter"...).
   6. **Longest streak:** consecutive days on the app, a 12x31 year calendar, active days and % of the year.
   7. **The chat report:** messages sent per message received, a balance scale and a label. On Hinge CSV it adds "% of chats you opened". Only when received counts exist (Tinder, or Hinge CSV with `received` rows).
   8. **Ghost town:** % of matches that never got a message from you, shown as 20 envelope/ghost icons. It adds who-opened or the longest chat (a count only). When no match data exists, it falls back to "Longest talk" (full mode only).
   9. **Dating personality:** the strongest of 10 archetypes plus up to 2 traits, with a fallback of "The Easygoing Dater". The archetypes are Night Shift, Selective Romantic, Open Heart, Magnet, Conversationalist, Enthusiast, Daily Devotee, Marathon Swiper, Weekend Romantic, Cuffing-Season Strategist and Collector.
4. **Safe share** (spec item; **on by default**): cards show only rates, ratios, labels, dates, hours and day-streak lengths. Volume counts disappear (swipes, likes, passes, matches, messages and the busiest-day count). A unit test renders every safe card to a fake canvas and asserts that none of those totals is drawn.
5. **Controls:**
   - Safe share toggle;
   - Year: years in the file plus All time. Defaults to the current year, or falls back to the latest year with activity and says so;
   - App: both / Tinder / Hinge, shown only when both are loaded;
   - optional name.
6. **Share code:** Share, Save PNG, Share all, the zip download, `?ref=` passthrough (`?ref=X` becomes `share-X`, then `share2-X`...) and the "Make yours: lanternlab2027.github.io/lab/dating" footer on every card are all copied from `docs/netflix/`.
7. **After upload:** a panel says "Done? Delete the export" and explains why (the export holds other people's messages).
8. **Kit signup** ("Email me when to come back"):
   - same pattern as netflix and reading;
   - the public api_key was copied programmatically from `docs/netflix/app.js` and never printed;
   - tag **`TAGID_DATING`** is a placeholder;
   - sends only `api_key` + `email`.

## To do before launch (Matt)

1. Create a Kit tag (e.g. `dating-wrapped-2027`) and replace `TAGID_DATING` in `docs/dating/app.js`. Until then, signups show "didn't go through". The signup copy promises "one reminder, plus a note when next year's edition is ready", so set up that sequence or soften the line in `index.html`.
2. Commit `docs/dating/`, `bots/dating/` and `docs/sitemap.xml`. Optionally add a hub card in `docs/index.html`.
3. **Strongly recommended:** QA with one real Tinder and one real Hinge export (spec day 3), used locally and never committed. All fixtures are synthetic, and the field names come from third-party parsers (see below). Without that QA, consider an "early version" label.

## Export formats: sources and confidence

- **Official help pages.** Both were fetched Nov 15, 2026. They give the request steps but **list no file or field names**:
  - [Tinder: How do I request a copy of my personal data](https://www.help.tinder.com/hc/en-gb/articles/115005626726-How-do-I-request-a-copy-of-my-personal-data):
    - Manage My Account tool, then Download My Information, then enter your email, then Submit;
    - the link comes "within a few days" and expires after 24 hours;
    - the zip has an `index.html` plus "a machine-readable version ... in JSON format".
  - [Hinge: How do I request a copy of my personal data](https://help.hinge.co/hc/en-us/articles/360011235813-How-do-I-request-a-copy-of-my-personal-data):
    - photo icon, then Settings, then the download option, then country, then confirm, then verify email;
    - "Most exports are ready within 30 days" and the download lasts 48 hours;
    - exports exclude other members' personal information.

  The page's step-by-step copy follows these two pages and cites them.
- **Field names come from open-source parsers** (read for structure; no code copied):
  - **SwipeStats** ([github.com/Boe-Ventures/swipestats.io](https://github.com/Boe-Ventures/swipestats.io)). It has **no license file**, so it was only read.
    - Tinder (`src/lib/interfaces/TinderDataJSON.ts`): `data.json` has `Usage` with date-keyed (`YYYY-MM-DD`) maps `app_opens`, `swipes_likes`, `swipes_passes`, `superlikes`, `matches`, `messages_sent` and `messages_received`.
    - Tinder messages: `Messages[]` is `{match_id, messages:[{to, from:"You", message, sent_date, type}]}`. These are **only messages you sent**. `sent_date` looks like `"Tue, 30 Nov 2021 05:08:21 GMT"`, or ISO in newer exports.
    - Tinder zip: the zip holds one `data.json` (`src/lib/upload/tinder-zip.ts`); `data-<id>.json` is also accepted.
    - Hinge legacy JSON (`HingeDataJSON.ts`): `matches.json` is an array of threads with `like[]`, `match[]`, `chats[]` (**sent only**: `{body, timestamp}`), `block[]`, `we_met[]` and `voice_notes[]`. A match without a like means they liked you first.
    - Hinge timestamps: naive SQL-style, treated as UTC.
  - **Hinge CSV format.** SwipeStats `docs/ops/hinge-csv-exports.md` says an **October 2026** Hinge download contained nested CSV tables and no JSON:
    - `match_likes`, `match_roses`, `match_skips` and `match_blocks` (`timestamp, comment`);
    - `chat_message` (`message, action[sent|received], timestamp, match_id`);
    - `chat_voice_note`, `user` and `profile_prompt_*`.

    There is **no match table**, so match rate, ghost rate and incoming likes are unavailable for CSV. The example SwipeStats saw had only `sent` rows. In that case this app hides the chat ratio and opener stats, rather than reading the missing rows as "no replies".
  - **Cross-checks for the Hinge JSON shape:** [spottseng/hinge-data-analysis](https://github.com/spottseng/hinge-data-analysis) (MIT) and [Fenix-Okami/hinge-breakdown](https://github.com/Fenix-Okami/hinge-breakdown) (timestamps like `2021-03-15 14:23:11.000000+00:00`).
- **Defensive parsing:**
  - files are recognized by name **and** by content;
  - missing `Usage` series are treated as unknown, not zero;
  - a rate only pools apps that have both sides of it (adding Hinge JSON never skews the Tinder right-swipe rate);
  - bad dates are dropped (2/30, years outside 2000-2100);
  - timestamps in any of RFC 1123, ISO, naive, microseconds or `+0000` forms are accepted;
  - CSV handling covers RFC-4180 quoting, multiline fields, BOM and CRLF;
  - `__MACOSX` entries and `._` files are ignored;
  - clear errors for: not a dating export, truncated JSON, empty file, empty Tinder usage, and Hinge `user.csv` alone.
- **Time zones:**
  - Tinder `Usage` keys are calendar dates and are used as-is (it is unverified whether Tinder buckets them in UTC or local time).
  - Every timestamp is converted to the viewer's local time.
  - Unit tests pass under TZ=America/New_York and Asia/Tokyo.
- **Known approximations:**
  - Tinder ghost rate = (matches whose first message from you falls in the year) / (matches in the year), capped at 100%. This is year-boundary fuzzy, because Tinder lists matches without messages but gives them no date.
  - "Longest chat" counts only your messages, except on Hinge CSV with received rows.
  - Tinder super likes count as right swipes.

## Privacy design

- **No Worker.** The spec suggested parsing in a Worker, but fetching `worker.js` after upload would itself be a network request. Exports are a few MB, so the main thread with a yield is fine; the 390px e2e test runs smoothly. If needed later, create the Worker from a same-origin file at page load.
- **CSP:** `default-src 'none'; script-src 'self'; connect-src https://api.convertkit.com`. No CDN, analytics or web fonts. JSZip 3.10.1 is vendored with its license. No localStorage or cookies.
- **Raw text is dropped after parsing** (`all = null`). Only counts stay in memory.
- **Page copy:**
  - "Nothing uploads. We never show message text or anyone's name." badge;
  - "What the cards read, and what they never touch";
  - "How we know" (including the airplane-mode tip);
  - a delete-your-export panel;
  - FAQ "Will my matches see anything about them?".
- **Tone:** playful and kind ("A few stayed mysteries", "No matches this time. Plenty of year left."), nothing crude or sexual. "Ghost town" shows only your own aggregate.

## Design

- **Palette and motif:** our own "airmail stationery" look: indigo night (#120f26 / #211b45), apricot (#ffb38a), lilac (#c9b6ff), mint (#9fe3c8), plum and cream. Airmail-striped edges, a postage-stamp year badge, postmark lines, a wax seal, hearts, envelopes and little ghosts.
- **No brand marks:** no Tinder flame or pink-orange gradient, no Hinge wordmark, no logos. The e2e test checks the page for Tinder's brand hex values.
- **Name:** "Dating Wrapped". "Tinder" and "Hinge" appear only descriptively, plus a footer disclaimer: "Not affiliated with Tinder, Hinge or Match Group".

## SEO

- **Title:** "Tinder Wrapped & Hinge Wrapped 2026: Free Dating Year in Review (Nothing Uploaded)".
- **Description and FAQ:** both target "tinder wrapped" and "hinge wrapped".
- **Social tags:** OG and Twitter tags, plus JSON-LD WebApplication with alternateName Tinder Wrapped / Hinge Wrapped.
- **Images:** `og.png` (1200x630) and `preview.jpg` come from the sample deck via `make_og.js`.
- **Yearly maintenance:** the title says 2026.

## Files

| File | What |
|---|---|
| `docs/dating/index.html` | Page, CSS, SEO/OG/JSON-LD, cited export steps, privacy, FAQ, disclaimer, `../` link |
| `docs/dating/parser.js` | Tinder JSON, Hinge JSON, Hinge CSV -> numbers only (UMD, runs in Node) |
| `docs/dating/stats.js` | Rates, peak month, busiest day, hours, streak, chat ratio, ghost rate, personality |
| `docs/dating/cards.js` | Canvas renderer (6 themes), safe-share aware |
| `docs/dating/app.js` | Upload and zip, multi-app merge, controls, share/save/zip, `?ref`, Kit |
| `docs/dating/demo.js` | Deterministic invented Tinder-shaped sample (no text at all) |
| `bots/dating/make_fixtures.js` | Synthetic fixtures (with CANARY strings) |
| `bots/dating/test_parser.js` | 15 unit tests |
| `bots/dating/test_page.js` | Playwright e2e at 390px and 1280px plus a Jan-2027 run (118 checks) |
| `bots/dating/render_cards.js` | Dumps every card PNG for review |
| `bots/dating/make_og.js` | Builds og.png and preview.jpg |

**Fixtures:**
- Tinder: `data.json`, the zip, an ISO-dates variant without super likes, zero matches, 2024-only and empty usage;
- Hinge: legacy JSON zip and `matches.json`, the CSV zip and loose CSV files, a sent-only CSV zip;
- errors: non-dating JSON, broken JSON, an empty file and a txt file.

All JS is pure ASCII (`\u` escapes).

## Tests

```
node bots/dating/make_fixtures.js
TZ=America/New_York node --test bots/dating/test_parser.js
NODE_PATH=/opt/npm-tools/node_modules node bots/dating/test_page.js <screenshot dir>
```

**Unit tests:**
- exact totals vs the raw files for Tinder, Hinge JSON and Hinge CSV;
- CANARY no-leak checks on parser output and card strings;
- timestamp formats and local hours;
- CSV quoting;
- sent-only CSV;
- multi-app rate pooling;
- years, empty year and all time;
- zero matches without NaN;
- all error messages;
- ignored files;
- safe share draws no totals.

**E2E test, at each width:**
1. freezes the clock at Nov 14, 2026, New York time;
2. **asserts zero network requests of any kind after upload, across 14 uploads (10 decks + 4 error files)**;
3. checks that CSP blocks a third-party fetch;
4. checks that Kit (stubbed) gets one call to `TAGID_DATING` with only `api_key` + `email`;
5. checks the SEO/OG tags, disclaimer, `../` link, both help citations, `?ref=share-tiktok`, the preview image and the absence of brand colors;
6. checks for all 9 cards, each 1080x1920 and non-blank;
7. checks that no fixture text appears in the DOM;
8. checks the safe toggle, year, all time and name;
9. checks the Tinder + Hinge merge and the app switch;
10. checks every format, the 2024 fallback and the 4 error cases;
11. checks Save PNG and the zip;
12. checks for no horizontal scroll and no page errors.

**Status Nov 15, 2026:** 15/15 unit tests pass (New York and Tokyo time zones), and the e2e test reports ALL PASSED (118 checks).

## Visual review

Every card was rendered and inspected in safe and full mode for:
- Tinder;
- Hinge JSON;
- Hinge CSV;
- sent-only CSV;
- a 20-day zero-match file;
- the page at 390px and 1280px;
- og.png and preview.jpg.

Fixed during review:
- the match-rate chip overlapping the footer;
- "days in a r..." truncation;
- the chat-ratio scale colliding with the chips when the label wraps;
- the ratio showing "1" instead of "1.0";
- Hinge wording ("likes" vs "right swipes"; "likiest weekday");
- the clock caption mentioning passes Hinge JSON doesn't have;
- the zero-match quip;
- future days in the streak calendar drawn as "day off";
- the sample deck's random message hours (it now peaks in the evening).

## Not done (from the spec)

- Hinge "most-liked prompt" card: the exports don't link likes to prompts.
- Valentine's bonus card.
- $2.99 Roast pack.
- Galentine's group mode.
- Showing an "early version" label: launch decision for Matt.
