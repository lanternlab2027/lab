# Group Chat Wrapped: notes

Page: `docs/wrapped/` (served at https://lanternlab2027.github.io/lab/wrapped/). Spec: `bots/ideas/APPS_ROUND1.md`, idea #1.
Built and tested Nov 13, 2026. Not committed.

**Heads-up:** `docs/wrapped/` and `bots/wrapped/` are listed in `.git/info/exclude` ("WIP agent output; remove these lines when publishing"). Remove those two lines before committing, or git won't see the files.

## What it does

1. The visitor picks a WhatsApp export (`.txt`, or the `.zip` WhatsApp makes) or a Telegram Desktop `result.json`. Drag-and-drop works too, and there's a "made-up sample chat" button.
2. Everything is parsed, counted and drawn in the browser. Nothing is uploaded.
3. They get 8-12 cards at 1080x1920 (canvas), in this order:
   - intro (group name, period, totals);
   - top yapper (with a top-5 leaderboard);
   - around the clock (24h chart, night owl, early bird);
   - emoji royalty;
   - fastest replier;
   - essay writer (longest message);
   - laugh track;
   - busiest day ever (with a volume sparkline);
   - top words and emojis;
   - conversation starter;
   - the ghost (3+ members only);
   - group vibe.

   Cards without enough data are skipped. The tiny Telegram fixture still gets 11.
4. Before sharing, they can choose:
   - **Names:** as in chat, first names only (collisions get a last initial), or initials. Phone-number senders become "…1234" or "Member N".
   - **Group name:** editable.
   - **Period:** all time or a single year. It defaults to the latest year when the chat spans more than one year and that year has 100+ messages.
5. Each card has two buttons. Share uses the Web Share API with a PNG file and falls back to download. Save PNG downloads it. "Share all" (only shown where file sharing works) shares every PNG. "Download all (.zip)" uses JSZip.
6. Paid stub: "Unlock bonus cards ($2.99) · Coming soon", disabled. There is no payment code. **Matt must approve payments before any are added.**
7. Kit signup ("Get notified about new card packs"): it uses the public api_key copied from `docs/ll97/index.html`, with tag **`TAGID_WRAPPED`** as a placeholder, and sends only `api_key` + `email`.

## To do before launch (Matt)

1. Create a Kit tag (e.g. `wrapped-card-packs`) and replace `TAGID_WRAPPED` in `docs/wrapped/app.js`. Until then, signups show "didn't go through".
2. Remove the two `wrapped` lines from `.git/info/exclude`, then commit.
3. Optional: add a link on `docs/index.html`. I didn't add one because that hub is NYC-focused. I did add `wrapped/` to `docs/sitemap.xml`.

## Privacy design

- **CSP meta tag:** `default-src 'none'; script-src 'self'; connect-src https://api.convertkit.com; ...`. The browser itself refuses any other outbound connection, and no inline scripts run. The e2e test confirms that a `fetch` to a third-party origin is blocked.
- **No dependencies outside the folder:**
  - no CDN, analytics or web fonts (system font stack only);
  - JSZip 3.10.1 is vendored at `docs/wrapped/vendor/jszip-3.10.1.min.js`, with its license (MIT/GPLv3 dual) in `vendor/JSZIP_LICENSE.md`.
- **Nothing is stored:** no localStorage or cookies. "Start over" drops the parsed data.
- **Member names never appear as "top words".** This stops names leaking when "hide names" is on. The group name is still shown, but it can be edited.
- **Page copy:**
  - "Your chat never leaves your device." badge at the top;
  - "How we know" section linking to https://github.com/lanternlab2027/lab/tree/main/docs/wrapped;
  - an airplane-mode tip;
  - FAQ line: not affiliated with WhatsApp/Meta/Telegram. Per the spec risk note, "WhatsApp" appears only as "works with".

## Files

| File | What |
|---|---|
| `docs/wrapped/index.html` | Page, CSS, SEO/OG/JSON-LD, export guide, privacy section, FAQ |
| `docs/wrapped/parser.js` | WhatsApp + Telegram parser (UMD, so it runs in Node tests too) |
| `docs/wrapped/stats.js` | Stats, awards, vibe rules |
| `docs/wrapped/cards.js` | Canvas card renderer (themes, layout) |
| `docs/wrapped/app.js` | UI wiring, names modes, share/download/zip, Kit |
| `docs/wrapped/demo.js` | Deterministic synthetic "Weekend Crew" chat (sample button + fixtures) |
| `docs/wrapped/og.png` | 1200x630 OG image built from sample cards |
| `bots/wrapped/make_fixtures.py` | Writes all synthetic fixtures to `bots/wrapped/fixtures/` |
| `bots/wrapped/test_parser.js` | Unit tests (13) |
| `bots/wrapped/test_page.js` | Playwright e2e at 390px and 1280px (48 checks) |

All JS files are pure ASCII. Non-ASCII characters are written as `\u` escapes, because a literal U+2028 inside a regex literal is a syntax error.

## Parser coverage

- **iOS:** `[M/D/YY, H:MM:SS AM] Name: msg`. Handles the narrow no-break space before AM/PM, LRM marks, `~ Name` for non-contacts, and system lines posted under the group name with an LRM (these are dropped, and the group name is taken from them).
- **Android:** `M/D/YY, H:MM AM - Name: msg`, plus `DD/MM/YYYY, HH:MM - ` 24h.
- **Other locales:** German dotted `[15.01.24, 21:05:12]` and Spanish `p. m.` / `a. m.`. A year-first format is also accepted.
- **Date order:** a first part > 12 means DMY; a second part > 12 means MDY. If neither, the parser picks whichever reading gives fewer backwards jumps in time. If that ties too, 12h clocks default to MDY and 24h or dotted dates to DMY.
- **Message bodies:**
  - Multiline messages are kept together.
  - "deleted" messages are counted but have no words.
  - `<This message was edited>` is stripped.
- **System lines:** Android system lines (no `Name: `, or a quoted colon inside "changed the subject") are dropped.
- **Media placeholders:** `<Media omitted>`, `image/video/... omitted`, `<attached: ...>`, `(file attached)`, `null`, and German/Spanish/French/Portuguese/Italian/Dutch variants.
- **Telegram:**
  - `result.json` with string or rich-text-array `text`;
  - service messages are skipped;
  - photo/sticker/file count as media;
  - `from: null` becomes "Deleted Account";
  - full-account exports (`chats.list`) use the busiest group chat.
- **Reply times (fastest replier):** a reply is a message from a different person within 3h. Ranking uses the median, with the mean as the tie-break. Android exports only have minute resolution, so a median under 60s shows as "<1 minute".
- **Conversation starter:** the first message after 4h of silence.

## Tests

```
python3 bots/wrapped/make_fixtures.py
node --test bots/wrapped/test_parser.js
NODE_PATH=/opt/npm-tools/node_modules node bots/wrapped/test_page.js <screenshot dir>
```

The e2e test serves `docs/` locally and intercepts every request at the context level, aborting anything off-origin. At each width it:

1. uploads the synthetic WhatsApp .txt, the .zip, Telegram `result.json`, a tiny Telegram export and a non-chat file;
2. checks that the cards are 1080x1920 and not blank;
3. checks that the names toggles re-render the cards;
4. checks for no horizontal scroll;
5. checks that Save PNG and the zip (12 PNGs) download;
6. checks that zero non-static requests happen after upload;
7. checks that CSP blocks a third-party fetch;
8. checks that Kit (stubbed) gets one call to `TAGID_WRAPPED` with exactly `api_key` + `email` and no chat text;
9. checks for no page errors.

Status Nov 13, 2026: 13/13 unit tests pass and the e2e test reports ALL PASSED.

Fixtures are all synthetic: the made-up names Ana Ruiz, Ben Ito, Cleo Park, Maya Chen, etc. No real chat data is used anywhere.

## Ideas for the bonus pack (not built)

- One award card per member.
- Longest streak.
- Double-texter.
- Most left-on-read.
- Best-friend pairs (who replies to whom).
- Roast mode.
- A "story" carousel video export.
