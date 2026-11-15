# 2027 Goal Bingo: notes

Page: `docs/bingo/` (served at https://lanternlab2027.github.io/lab/bingo/). Built and tested Nov 15, 2026. Idea #4 in `bots/ideas/APPS_ROUND2.md`. Not committed.

**Heads-up:** `docs/bingo/` and `bots/bingo/` are already in `.git/info/exclude` under "WIP agent output". Remove those two lines before committing, or git won't see the files. The only tracked file changed is `docs/sitemap.xml` (one `bingo/` entry added).

## What it does

- **Make a card:** 5x5 (default, free center on), 4x4 ("2027" across the top) or 3x3 (free center optional). There's a title, an optional name, and 6 themes: Confetti, Midnight, Sage, Sunset, Mono (print-friendly) and Lantern.
- **Edit mode:** tap a square, then type in the editor (70 characters max). Enter moves to the next square.
  - **Ideas:** 7 categories I wrote myself (health, money, travel, learning, people, fun, home), about 120 ideas in total. Tapping one fills the selected square, or the next empty one, and then jumps ahead. Ideas already on the card are struck through.
  - **Shortcuts:** "Fill empty squares with ideas" works round-robin across categories, so a card isn't all one category. "Shuffle squares" moves each goal together with its check.
  - **Resizing:** goals keep their reading order. Goals that don't fit a smaller card are held for the session and come back when you size up again.
- **Check off mode:** tap to stamp a square, tap again to undo. The free center is always done.
  - Progress shows as "6 of 24 done · 1 bingo!" (rows, columns and diagonals), up to BLACKOUT.
  - A card that's fully filled opens straight into Check off mode.
- **Downloads:**
  - Letter PDF: 2550x3300 JPEG on a 612x792pt page, written by a small hand-rolled PDF writer in `render.js`, so no library is needed. `pdfinfo` validates it.
  - Letter PNG.
  - Phone wallpaper, 1170x2532, with the top 27% left clear for the lock-screen clock.
  - Story, 1080x1920.
  - "Share my card" uses the Web Share API with the story PNG, and falls back to a download.
  - Every image has a "Make yours: lanternlab2027.github.io/lab/bingo" footer, plus a progress pill once anything is checked. That pill is the reason to re-share in February and July.
- **Group bingo:** `#g=` links carry only the theme, size, free-center flag and group name, never goals. A friend gets a blank card with "BOOK CLUB · 2027 BINGO" on top.
- **Kit:** "Remind me monthly to update my bingo".
  - Same pattern and public key as `docs/reading/app.js`. The key was copied programmatically and never printed.
  - Tag **`TAGID_BINGO`** is a placeholder.
  - Sends only `api_key` + `email`.

## State and privacy

- **The card lives in the URL hash** as `#c=<base64url>`, and is mirrored to localStorage (`goalbingo:v1:current`). The hash is never sent to a server.
  - Every localStorage access is wrapped in try/catch. The tests run the page with `localStorage` throwing, and it still works.
  - Load order: hash, then localStorage, then a blank card.
  - When a different link is opened (a group invite, or someone else's card), the device's current card is stashed in `goalbingo:v1:prev`. "Open your previous card" swaps back, so a group link can't wipe your card.
- **Format** (`codec.js`):
  - The fields are newline-separated: version `b1`, size and flags, theme, a base36 bitmask of checks, title, name and group, then the goals, then an `~` end marker.
  - Control characters and newlines in text become spaces, so input can't break the format.
  - With the end marker, a link that got cut off while copying is rejected (every prefix is tested) instead of loading half a card. The page says so and keeps the saved card.
- **Limits:**
  - **Per field:** goal 70, title 48, name 30 and group 40 characters.
  - **Payload budget:** 3,000 UTF-8 bytes. If a card goes over, the longest goals are trimmed first, by whole code points. The longest plain-text card is about 2,550 characters of hash, and a typical full card is about 770.
  - **Decode limit:** anything over 6,000 characters is refused before decoding starts.
- **Security:** same CSP as the other apps (`connect-src https://api.convertkit.com` only), `referrer: no-referrer`, no CDN, no web fonts, no analytics. Nothing is vendored, because no library is needed.
- **Not fully private:** the link *is* the card, so anyone it's shared with sees the goals. The page says this next to the link.

## SEO

- **Title:** "2027 Goal Bingo Card Maker: Free New Year Resolution Bingo Card".
- **Description:** includes "goal bingo card" and "new year resolution bingo card".
- **Other:** canonical URL, OG/Twitter tags, WebApplication JSON-LD, a how-to section and an FAQ (what goal bingo is, privacy, groups, printing, ideas).
- **Images and links:** `og.png` is 1200x630 and is built from three sample cards by `make_og.js`. There's a sitemap entry, and the footer links to `../`.

## Tests

- `node bots/bingo/test_codec.js` runs 36 unit tests:
  - round trip for every size and theme;
  - unicode, ZWJ emoji and CJK text;
  - newline injection;
  - the limits on every field, the byte budget and emoji-safe trimming;
  - the too-long and truncated-prefix cases;
  - bad base64, bad UTF-8, unknown version, size or theme, and malformed bitmasks;
  - bingo, diagonal and blackout maths;
  - group links that contain no goals.
- `NODE_PATH=/opt/npm-tools/node_modules node bots/bingo/test_page.js <outdir>` runs Playwright at 390px and 1280px, all passing. It covers:
  - CSP, SEO tags and zero off-origin requests;
  - create (typing, ideas, fill), edit (theme, 5→3→5 and 4x4 sizes), and check off (progress, bingo toast, un-check, free center);
  - the link: address bar, Node decode equal to the page state, reload, a fresh browser with no storage, and a bare URL restored from localStorage;
  - downloads: PDF (`pdfinfo`: 1 page, Letter), Letter PNG, wallpaper and story PNG sizes;
  - the share fallback;
  - the group link: banner, same theme, blank goals, previous card restorable;
  - a truncated link;
  - Kit stubbed: the tag, a body of only api_key+email, and the key matching the reading app without printing it;
  - storage blocked;
  - CSP blocking `fetch` to another host.
- I looked at the renders: the page at both widths, the board, every export size, the PDF raster and the OG image.
  - Fixed after review: confetti overlapping the title (it now stays in the margins), the bingo strike line covering text (it's drawn under the text now), mid-word breaks (whole words are tried first) and muddy Midnight stamps.

## To do before launch (Matt)

1. Create a Kit tag (e.g. `goal-bingo-2027`) and replace `TAGID_BINGO` in `docs/bingo/app.js`. Until then, signups show "didn't go through".
2. The "monthly" promise needs a Kit automation or sequence on that tag. Suggested: 1st of each month, Feb to Dec 2027, along the lines of "open your bookmarked bingo link and check things off". Emails can't include the card link, because we never collect it.
3. Remove the two `bingo` lines from `.git/info/exclude`, then commit.
4. Optional: add a card to `docs/index.html` (I didn't touch the hub).

## Ideas for later

- The spec also mentions the TikTok "punch card" format (Jan 2026). It isn't built. It would fit as a 4th layout option.
- $2.99 premium themes or print packs (see spec).
- A "progress card" variant for February and July re-shares. The current images already show "X of 24 done".
