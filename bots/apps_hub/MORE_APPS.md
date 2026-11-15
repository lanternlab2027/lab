# "More free apps from Lantern Lab" strip

Built Nov 15, 2026. Not committed.

A quiet strip of 3 links ("More free apps from Lantern Lab") between each app's main content and its footer.

## Changed paths

New:
- `docs/apps/more.js`: picks map + renderer (no network, no storage, no inline code)
- `docs/apps/more.css`: styles; reserves the strip's 226px height before the script runs
- `bots/apps_hub/test_more.js`: Playwright check for every app page
- `bots/apps_hub/MORE_APPS.md`: this file

Edited (the same 3 lines inserted just above the page's `<footer>`; nothing else changed):
- `docs/wrapped/index.html`
- `docs/reading/index.html`
- `docs/netflix/index.html`
- `docs/sport/index.html`
- `docs/dating/index.html`
- `docs/tiktok/index.html`
- `docs/couples/index.html`
- `docs/amazon/index.html`
- `docs/awards/index.html`
- `docs/santa/index.html`
- `docs/bingo/index.html`
- `docs/partybingo/index.html`
- `docs/then/index.html`
- `docs/chicago-then/index.html`
- `docs/eats/index.html` (placeholder has `class="wrap"` to match its footer width)
- `docs/chi-eats/index.html` (same)
- `docs/names/index.html`
- `docs/mileage/index.html`
- `docs/dogs/index.html` (added on request; `docs/dogs/n/` untouched)

The snippet:
```html
<link rel="stylesheet" href="../apps/more.css">
<div id="more-apps" data-from="<app>"></div>
<script src="../apps/more.js" defer></script>
```

No CSP changes were needed: every page already has `script-src 'self'`, `style-src 'self' ...` and `img-src 'self'` (Santa has no CSP meta).

Test files edited (one line each, plus a comment):
- `bots/reading/test_page.js`
- `bots/dating/test_page.js`
- `bots/tiktok/test_page.js`
- `bots/amazon/test_page.js`

Why: their "zero network requests after upload" privacy check failed because the strip's lazy thumbnails, and on Amazon's reload also more.js and more.css, load after the upload once the strip scrolls into view. Each check now ignores only same-origin GETs matching `/apps/more.(js|css)` and `/apps/img/<app>.jpg`. These are static files and carry no user data. Every other request, and any request to another origin, still fails the check. `bots/wrapped/test_page.js` already allowed same-origin static GETs. The netflix, sport and mileage tests have the same strict check and pass today, because their flows never scroll the strip into view. If that changes, they would need the same one-line filter.

## Picks (hard-coded in more.js)
- Wrapped apps (wrapped, reading, netflix, sport, dating, tiktok, couples, amazon): 3 other Wrapped apps each, hand-picked.
- NYC tools: eats -> then, dogs, chi-eats; then -> eats, dogs, chicago-then; dogs -> eats, then, names. Chicago editions -> their Chicago twin, then the two NYC twins.
- Everything else (awards, santa, bingo, partybingo, names, mileage): 2 seasonal picks + the hub (`../apps/`). Nov and Dec: Wrapped, Secret Santa. Jan: Goal Bingo, Year in Orders, Mileage. Feb: Couples, Watch-Party Bingo. Other months: NYC Then, Baby Names. Names always leads with the Dog Name Report Card. The current app is skipped and the gap filled from bingo, wrapped, then, names, eats. November isn't in the brief, so it uses the December set.
- Every link gets `?ref=more-<fromapp>`. Thumbnails are `../apps/img/<app>.jpg`, `loading="lazy"`; the hub link shows a CSS tile with no image.

## Design
The strip inherits the page's font and text color, and its borders and tints use `color-mix` on `currentColor`, so it follows each app's own light or dark theme. It is one column at every width (max 560px), each row 60px tall (tap target at least 44px), with one-line titles and subtitles (ellipsis). It is hidden in print. The region is labelled by its h2.

## Tests
- `NODE_PATH=/opt/npm-tools/node_modules node bots/apps_hub/test_more.js <shots dir>` (set `SHOT_ALL=1` to screenshot every page). At 390px, light and dark, for all 19 pages, it checks: heading, 3 links, none to the current app, `?ref=more-<app>`, at least 44px tall, lazy thumbnails from `../apps/img/` that load, no layout shift (placeholder height and footer offset the same with the script blocked), the strip sits directly above the footer, no horizontal scroll, no console errors, no local 404s, and no external requests. It also checks the January picks with a fixed clock. All 457 checks pass.
- Each app's existing tests in `bots/<app>/` (test_page.js and the unit tests, plus `bots/dogs/test_pages.js` and `test_clean.js`) pass before and after the change.
