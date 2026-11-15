# Apps hub: notes

Page: `docs/apps/` (served at https://lanternlab2027.github.io/lab/apps/). Built and tested Nov 15, 2026. Not committed.

## What changed

New files:
- `docs/apps/index.html`: the hub. Hero ("Free apps. No sign-up. Nothing uploaded."), sticky section chips, then **Wrapped season** (Group Chat, Reading, Streaming, Year in Motion, Dating), **Games** (NYC Then, Fantasy League Awards), **Tools** (NYC Restaurant Report Card), **Holidays** (Secret Santa, 2027 Goal Bingo), **How we handle your data**, and the **new app drops** signup. Each card has a thumbnail, a tag line, one sentence and a "Try it" link; the whole card is clickable (stretched link). System fonts, no CDNs, dark mode, CSP (`connect-src https://api.convertkit.com` only).
- `docs/apps/app.js`: the Kit signup, same pattern and public form api_key as `docs/reading/app.js` (copied programmatically). Tag is the placeholder **`TAGID_APPS`**. It sends only `api_key` + `email`.
- `docs/apps/img/*.jpg`: 640x400 thumbnails made from each app's `preview.jpg` (wrapped, reading, netflix, sport, dating, awards) or `og.png` (santa, bingo, then, eats; padded to 16:10 with their edge pixels). Rebuild: `python3 bots/apps_hub/make_thumbs.py`.
- `docs/apps/og.png`: 1200x630 collage of the six `preview.jpg` images plus the headline. Rebuild: `NODE_PATH=/opt/npm-tools/node_modules node bots/apps_hub/make_og.js`.
- SEO: title "Free Wrapped Apps: Spotify Wrapped Alternatives for Your Other Apps"; description starts "Free wrapped apps for your group chat, books, Netflix, workouts and dating apps: Spotify Wrapped alternatives for your other apps."; canonical, OG/Twitter tags, CollectionPage + ItemList JSON-LD.

Edits to existing files (minimal):
- Each app footer (wrapped, reading, netflix, sport, dating, awards, santa, bingo, then, eats) gets ` · <a href="../apps/">More free apps →</a>` appended to its existing Lantern Lab link line. No app logic, CSP or Kit settings touched.
- `docs/index.html`: a gradient "Free apps: Wrapped season is here / See all apps →" banner at the top of `<main>`, and an "All free apps →" link in the Apps heading. The existing Apps list stays.
- `docs/sitemap.xml`: added `apps/` (lastmod 2026-11-15).

## Data section accuracy (checked against each page's CSP)
- Wrapped apps (wrapped, reading, netflix, sport, dating): `connect-src` is Kit only, so files are processed on-device.
- Awards: `api.sleeper.app` (public league data) + Kit. Eats: `data.cityofnewyork.us` + Kit.
- NYC Then also fetches its own `schedule.json`/photos from the same site (not a third party); Santa has no network calls; Bingo is Kit only. The hub's copy says "beyond that, the only network call is the optional email signup", which holds.

## Tests
`NODE_PATH=/opt/npm-tools/node_modules node bots/apps_hub/test_page.js <screenshot dir>` (local server on :8794, Kit routed to a stub). At 390px and 1280px: no console errors, no external requests on load, no horizontal scroll, all images load, 10 cards each with thumbnail/line/Try it, all sections present, canonical correct, clicking a card's image opens the app, signup sends only api_key + email. Also: home promo present, every app footer has the link, 37 internal links (hub, home, footers' `../apps/`, og.png, sitemap) return 200. All pass.

Bug caught by the test: a `filter` on the hovered "Try it" button made it the containing block for the stretched-link overlay, so clicking a card's image did nothing. Replaced with a box-shadow (comment in the CSS).

## To do before launch (Matt)
1. Create a Kit tag (e.g. `new-app-drops`) and replace `TAGID_APPS` in `docs/apps/app.js`. Until then, signups show "didn't go through".
2. Commit `docs/apps/`, `bots/apps_hub/` and the edited files.

## Heads-up
- `docs/then/index.html` also has uncommitted edits from another agent (Chicago Then cross-links, plus untracked `docs/chicago-then/`, `bots/chicago-then/`). My only change there is the footer link; review both together when committing. If Chicago Then ships, consider adding it to the hub's Games section.
