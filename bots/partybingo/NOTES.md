# Watch-Party Bingo: notes

Page: `docs/partybingo/` (served at https://lanternlab2027.github.io/lab/partybingo/). Built and tested Nov 15, 2026. Idea #1 in `bots/ideas/APPS_ROUND3.md`. Not committed or pushed.

**Heads-up:** `docs/partybingo/` and `bots/partybingo/` are already listed in `.git/info/exclude` under "WIP agent output". Remove those two lines before committing, or git won't see the files. No tracked file was changed (no sitemap or hub edits).

## What it does

- **Host** (page with no hash):
  - Picks one of 6 presets or "Write my own", then edits freely in a one-square-per-line textarea. Needs 24 to 100 squares, each up to 60 characters. Bullets and numbering are stripped, and duplicates are dropped.
  - A live sample card shows what a guest will see. "Show another sample" reshuffles it.
  - "Create the game link" gives the link, Copy, Share (Web Share API, with copy as the fallback), "Open my own card", a QR code and a QR PNG download.
  - The draft list is kept in localStorage.
- **Guest** (`#g=...`):
  - The card is a seeded shuffle of the list: 24 squares plus a free centre.
  - The seed is random (`crypto.getRandomValues`) and is stored in localStorage under `partybingo:v1:g:<gameId>` along with the marks. A refresh, or a second tab, keeps the same card. The seed is deliberately **not** put in the URL, so a guest who forwards the link from their address bar still gives friends their own cards.
  - Tap to mark. Rows, columns and diagonals are checked.
  - The first bingo opens an overlay with confetti (skipped under reduced motion) and the line "BINGO at 9:42pm with 'Ref misses an obvious call'". The overlay shows a 1080x1350 picture with the card, the winning line and the square that completed it, plus an optional "Sam's card" name.
  - From the overlay: Share picture (Web Share with the file; otherwise it downloads the picture and copies the message), Download, and Copy "check my card" link.
  - Later bingos and blackout show a toast. Guests also have "Deal me a new card" (with a confirm), "Invite someone", and printing.
- **Check link** (`#g=...&v=seed.marks.time`): rebuilds the winner's exact card and marks, read only, with "BINGO at 2:17pm · 4 squares marked". It has a "Get my own card" button. Anyone can check that a claimed bingo is a real line on the real card. The marks themselves are self-reported, of course.
- **Print:** N cards (1 to 100) for the game, one per Letter page, black and white, numbered "Card 7 of 30", with a name line and a site footer.
  - Seeds come from the game id, so a reprint gives identical cards (you can reprint card 7). Duplicates are skipped.
  - Uses `window.print()` with `@media print` CSS (`body.printing`). It's available to the host and to guests.
- **Presets** (all text is original; generic names only):
  - Big Game Sunday (football), 62 squares: the game, the broadcast, commercials, the halftime show and the room;
  - Awards Night, 36;
  - Holiday Movie Night, 38;
  - Reality TV Finale, 36;
  - Family Holiday Dinner, 36;
  - New Year's Eve, 36.
  - A test enforces no trademarks in them. Page copy only says "works for any football watch party, including the big game on Sunday, February 14, 2027", plus a "not affiliated" line.

## Link format (`codec.js`)

- **Game text:** `pw1` / title / `@presetId` or empty / squares... / `~` end marker. Control characters and newlines become spaces.
- **Encoding:** the hash is `g=z<base64url(deflate-raw)>` using CompressionStream. When that isn't available, or plain text is shorter, it's `g=t<base64url(utf8)>`.
- **Unedited presets:** these send only the id, so the link is about 45 characters and the QR code is version 3-4. Any edit sends the full list.
- **Preset versioning:** never edit a published preset in place. Add `biggame2` instead, or old links would deal different cards.
- **Guards:**
  - hashes over 9,000 characters are refused;
  - inflate stops at 16 KB, so a crafted zip-bomb link is stopped;
  - every truncated prefix is rejected;
  - an unknown preset or version gets a friendly message on the host view.
- **Old browsers:** a browser without DecompressionStream can't open `z` links and is told to update. Supported from Safari 16.4, Chrome 80 and Firefox 113.

## QR code

`qr.js` is my own encoder, so there's nothing to vendor and no third-party license. It covers byte mode, ECC M (switching to L above version 15), versions 1-40, all 8 masks and the penalty rules. It is checked two ways:
- it matches Kazuhiko Arase's MIT reference encoder (the copy inside npm's bundled `qrcode-terminal`) module for module on all 80 version/level combinations;
- OpenCV scans the codes back, including the QR drawn on the live page in the Playwright test.

## Kit

- "Get new preset packs" uses the `docs/eats/kit.js` pattern. The key was copied programmatically and never printed.
- The tag is the placeholder **`TAGID_PARTYBINGO`**. While it isn't numeric, the box stays **hidden**, as in eats.
- It sends only `api_key` + `email`.

## SEO / sharing

- **Title:** "Watch-Party Bingo: Free Printable and Phone Bingo Cards, a Unique Card for Every Guest".
- **Description:** includes "free printable and phone bingo cards for watch parties" and "unique card for every guest".
- **Other tags:** canonical, OG/Twitter and WebApplication JSON-LD.
- **On the page:** a how-it-works section and an FAQ.
- **Images and links:** `og.png` is 1200x630 and is built by `make_og.js`. The footer links to `../` and `../apps/`.
- **Security:** same CSP as the other apps (`connect-src` is Kit only), no-referrer, and no CDN, fonts or analytics.

## Tests

- `node bots/partybingo/test_codec.js`: 73 checks. They cover:
  - presets: count, duplicates, length and the trademark filter;
  - round trips for every preset, a custom list, an edited preset and 100 long squares;
  - injection, the size limits and truncated prefixes;
  - bad links: corrupt, unknown preset, unknown version, and a 5 MB zip bomb;
  - the seeded shuffle across 50 seeds: all different, any two differ in at least 21 of 24 cells, still unique with exactly 24 squares, deterministic, and even square frequency over 4,000 cards;
  - print seeds, bingo detection for each line type and blackout, and the check-link round trip.
- `node bots/partybingo/test_qr.js`: the OpenCV scans and the reference-encoder comparison (needs python3 with cv2).
- `NODE_PATH=/opt/npm-tools/node_modules node bots/partybingo/test_page.js <dir>`: Playwright at 390px and 1280px, all passing (109 checks). It covers:
  - CSP, SEO and OG;
  - the host custom list (23 squares blocked, 30 allowed);
  - the preset link, decoded in Node;
  - the page's QR, scanned with OpenCV;
  - two guests in separate browsers getting different cards;
  - refresh and a second tab keeping the card;
  - free-space tap, unmark and bingo, with the overlay text checked by regex and the picture size checked;
  - download, the share fallback and the check link;
  - a second bingo, and refresh keeping marks and time;
  - the check view (read only), then "get my own card";
  - a new card;
  - a custom game as a guest, and printing from the guest view;
  - print: 5 unique cards that match the codec, and a 5-page PDF (`pdfinfo`);
  - localStorage throwing, and a truncated link;
  - Kit, stubbed;
  - no off-origin requests and no page errors.
- Screenshots and renders are in the session scratchpad (`shots/partybingo/`), not in bots/. I looked at the host, share, guest, bingo overlay, result picture, check view, print page and OG renders.
  - Fixed after review: the winning line now sits under the square text in the picture; the printed grid now fills the page; the OG headline no longer runs under the phones.

## To do before launch (Matt)

1. Create a Kit tag (e.g. `party-bingo-packs`) and replace `TAGID_PARTYBINGO` in `docs/partybingo/kit.js`. The signup box appears once the tag is numeric.
2. Remove the two `partybingo` lines from `.git/info/exclude`, then commit.
3. Optional:
   - add `partybingo/` to `docs/sitemap.xml` and a card to `docs/index.html` / `docs/apps/`;
   - launch by Feb 1 for the Feb 14 game.

## Ideas for later

- One SEO landing page per event (the spec's day 2).
- A "couples" pack for Feb 14 (Valentine's Day clash), a tournament pack in March, and an awards-season refresh.
- Two cards per page as a print option, to save paper.
