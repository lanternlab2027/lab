# Couples Chat Wrapped: notes

Page: `docs/couples/` (will be served at https://lanternlab2027.github.io/lab/couples/). Spec: `bots/ideas/APPS_ROUND3.md`, S1.
Built and tested Nov 15, 2026. Not committed or pushed.

## What it does

A Valentine's "our year in texts" deck from a 1:1 WhatsApp (.txt/.zip) or Telegram Desktop (result.json) export. Everything runs in the browser and nothing is uploaded. It makes up to 11 cards at 1080x1920:

1. Intro: pair names, period, totals.
2. The text count: messages each, plus who sends the first text of the morning. That is the first message at or after 5 AM each day.
3. Reply speed: the median reply time for each person. Only a change of sender counts as a reply, and gaps over 12h are ignored.
4. Goodnight: count of messages that match a multilingual list (en/es/fr/de/pt/it/nl), counted once per message. Skipped if 0.
5. Emojis: each person's top emoji, plus the shared emoji. The shared one is used by both people and has the highest lower count of the two.
6. Longest streak: calendar days in a row with any message, shown as start-end dates. Skipped if under 2 days.
7. Busiest day: the date, weekday and count only, plus a volume sparkline.
8. After dark: share of messages sent 11 PM-3:59 AM, with a 24h chart.
9. I love you: one shared total (en/es/fr/de/pt/it list), counted once per message. Skipped if 0. It is deliberately **not** split per person, so there's no "who loves who more".
10. Where it starts: date and time of the first message in the file (always the whole file, whatever the period), who sent it, and days since. A note says that exports can start partway through a chat.
11. Summary: an 8-tile grid.

Tone: fun facts only, with no scores or rankings. The FAQ says so explicitly.

## Privacy

- No message text reaches any card. The stats object holds only counts, dates, names and emojis, and a unit test checks that its JSON contains no demo phrases.
- Keywords are matched and counted, never shown.
- Names default to **initials**. The other options are first names, or nicknames typed into two fields. Nicknames live only in the tab.
- CSP is the same as Group Chat Wrapped: `script-src 'self'`, and `connect-src` allows only api.convertkit.com. There is no analytics, CDN or web font, and JSZip is vendored in `docs/couples/vendor/`.

## Group chats

A chat counts as a group if:
- a third sender has at least max(3, 2% of messages), or
- the Telegram chat type contains group or channel.

For a group, the page shows a notice ("That looks like a group chat… made for 1:1 chats") that links to `../wrapped/` and shows no deck. A tiny stray third sender, such as one "Deleted Account" line, is dropped instead. One-person exports get an error. For a Telegram full-account export, the busiest `personal_chat` is chosen (the shared parser alone would pick the busiest group).

## Reuse (and a dependency to know about)

- **Parser:** `docs/couples/index.html` loads `../wrapped/parser.js` and `../wrapped/stats.js`. stats.js supplies emojisIn, median and years. In Node, `docs/couples/stats.js` uses `require('../wrapped/...')`. This means future fixes to the wrapped parser, such as the iOS 1:1 and locale fixes, flow through automatically. `docs/wrapped/` was **not modified**. If wrapped is ever moved or renamed, couples breaks; the e2e test would catch it.
- **Card engine:** `docs/couples/cards.js` is adapted from `docs/wrapped/cards.js`. It keeps the same chrome, "Make yours: lanternlab2027.github.io/lab/couples" footer and on-device label, with a pink theme and hearts.
- **Page controller:** `app.js` follows wrapped's pattern:
  - Share (Web Share API with file, falling back to download), Save PNG, Share all, and Download all as a zip;
  - `?ref` passthrough (`?ref=X` becomes `share-X`). Links to Group Chat Wrapped marked `data-ref` also carry `?ref`.
- **Footer:** links to `../`, `../apps/`, `../wrapped/` and both guides in `docs/guides/`.

## Kit (to do before launch)

`docs/couples/kit.js` copies the `docs/eats/kit.js` pattern: the public key is copied from there, and the tag is the placeholder **`TAGID_COUPLES`**. While the tag isn't numeric, the "Get a reminder before Valentine's Day" box stays hidden. The signup sends only api_key and email. To launch, create a Kit tag and replace `TAGID_COUPLES` in `docs/couples/kit.js`. The test sets `window.COUPLES_KIT_TAG_TEST` through an init script.

## Other to-dos (Matt)

- `docs/index.html`, `docs/apps/` and the sitemaps were deliberately left untouched. Add `couples/` to them when publishing.
- Launch per the spec: Feb 1, pushed Feb 10-14. The paid pack and the "couple personality" card from the pitch are not built: there's no payment code, and a personality card risks grading.

## Files

| File | What |
|---|---|
| `docs/couples/index.html` | Page, CSS, SEO, OG, JSON-LD, export guide (WhatsApp iOS/Android, Telegram, plus an iMessage note), privacy, FAQ |
| `docs/couples/stats.js` | 1:1 detection, Telegram chat picking, all couple stats, keyword lists |
| `docs/couples/cards.js` | Canvas renderer |
| `docs/couples/app.js` | UI wiring: names and nicknames, period, share/save/zip, group notice |
| `docs/couples/demo.js` | Synthetic couple (Jamie Lin and Rowan Diaz, Jan-Nov 2026, busiest day Feb 14) |
| `docs/couples/kit.js` | Kit signup (TAGID_COUPLES) |
| `docs/couples/og.png`, `preview.jpg` | Built by `bots/couples/make_og.js` from the demo deck |
| `bots/couples/make_fixtures.js` | Synthetic fixtures (listed below) |
| `bots/couples/test_stats.js` | 12 unit tests (`node --test bots/couples/test_stats.js`) |
| `bots/couples/test_page.js` | Playwright at 390 and 1280px, 67 checks (`NODE_PATH=/opt/npm-tools/node_modules node bots/couples/test_page.js <shots dir>`) |

The fixtures written by `make_fixtures.js`:
- iOS en;
- Android es;
- iOS de (dotted dates);
- Android fr;
- iOS pt-BR;
- Android it;
- a Telegram personal chat;
- a Telegram group with 2 senders;
- a Telegram full export;
- the demo as an iOS zip.

The tests also reuse `bots/wrapped/fixtures` for groups and for the wrapped iOS 1:1 case.

Screenshots go to the session scratchpad, not to bots/. All source files are ASCII; non-ASCII characters are written as `\u` escapes.

## Known limits

- The keyword lists are small and will miss slang and typos. A few false positives are possible, e.g. "I'd love you to come" or "boa noite" used as a greeting. They are fun counts, not exact.
- "Late night" (11 PM-4 AM) and "morning" (from 5 AM) use the clock times in the export, so they're in the phone's local time.
