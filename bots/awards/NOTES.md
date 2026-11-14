# Fantasy League Awards: notes

Page: `docs/awards/` (served at https://lanternlab2027.github.io/lab/awards/). Spec: `bots/ideas/APPS_ROUND1.md`, idea #5.
Built and tested Nov 14, 2026. Not committed.

**Heads-up:** `docs/awards/` and `bots/awards/` are listed in `.git/info/exclude`. Remove those two lines before committing, or git won't see the files.

## What it does

1. The visitor enters a Sleeper username, a league ID, or a pasted `sleeper.com/leagues/<id>` link.
   - A username lists that user's NFL leagues for the current season (falls back one season if empty), with a season picker. One league loads straight away.
2. The browser calls Sleeper's public API directly. There's no backend. A league load is 4 base calls plus 2 per week (matchups + transactions), run 4 at a time. A 10-week season is 26 calls.
3. **Week tab** (8 cards, 1080x1350): week summary, highest scorer (with top 3), biggest blowout, heartbreak (narrowest loss), bench warmer, luckiest win, unluckiest loss, participation trophy (lowest score).
4. **Season tab** (7 cards): power rankings, record vs all-play, luckiest manager, unluckiest manager, trade & waiver king, season bench boss, week of the year.
5. Each card has Share (Web Share API with the PNG, falls back to download) and Save. There's also "Share all", "Download all (.zip)" and "Copy league recap text" (plain text for the group chat).
6. Every card footer reads `lanternlab2027.github.io/lab/awards`.
7. The URL becomes `?league=<id>&week=<n>`, so a bookmark or a link dropped in the group chat opens straight to that league.
8. "Try a made-up sample league" runs entirely offline from `demo.js`.

## Definitions (also shown on the page)

- **Points:** `custom_points` (a commissioner override) if set, else `points`.
- **Bench points:** the sum of `players_points` for rostered players not in `starters`. Empty slots (`"0"`) are ignored. If `players_points` is missing, the bench card is skipped. This doesn't check lineup eligibility.
- **Luckiest win:** the winner with the lowest score, so the win that would have lost to the most teams. The card also says whether they beat the week's lowest scorer. The spec's "(beat the team with the lowest score)" wording was ambiguous, so I went with the standard definition.
- **Unluckiest:** the loser with the highest score. The card shows its rank (usually 2nd) and how many teams it would have beaten.
- **Season stats:** only completed regular-season weeks (before `settings.playoff_week_start`). A week still in progress (the current `state.week` in the current season) is excluded. It can be viewed on the Week tab, labelled "(in progress)", with a warning note.
- **All-play:** each week, every team against every other team.
  - Luck = actual win % minus all-play win %.
  - Luckiest and unluckiest manager are the extremes of luck.
- **Power score (0-100):** 50% all-play win %, 30% points per game vs the league best, and 20% last-3-weeks average vs the league best.
- **Transactions:** only `status: complete`, de-duplicated by `transaction_id`.
  - A trade counts once for each roster involved.
  - Waiver and free-agent moves count for `roster_ids[0]`.
  - Commissioner moves are ignored.
- **Team name:** `metadata.team_name`, then `display_name`, then "Team N" for orphan rosters. No avatars are used (they'd need sleepercdn.com in CSP and would taint the canvas).
- **Playoff weeks:** teams with `matchup_id: null` count for high and low score but not for head-to-head awards.

## Sleeper API check (docs.sleeper.com, read Nov 14, 2026 via WebFetch)

- **Endpoints used:** all GET on `https://api.sleeper.app/v1`. They are `/user/<username>`, `/user/<user_id>/leagues/nfl/<season>`, `/league/<id>`, `/league/<id>/users`, `/league/<id>/rosters`, `/league/<id>/matchups/<week>`, `/league/<id>/transactions/<round>` and `/state/nfl`.
- **Not used:** brackets, drafts, traded picks, and the 5MB `/players/nfl` map. The docs ask that the players map be called at most once a day and stored server-side, so it's left out of a client-only app.
- **Rate limit:** "stay under 1000 API calls per minute, otherwise, you risk being IP-blocked." Each visitor's own IP makes about 26-40 calls per league load, so this is fine.
- **Auth:** "No API Token is necessary." The API is read-only.
- **Terms:** the API is "free to use for non-commercial purposes", and commercial use needs a licence from Sleeper. This app is free, has no ads and no payments. **Matt: before adding ads, affiliate links or a paid tier, contact Sleeper about licensing.** Trending-player data needs attribution, but we don't use it.
- **CORS:** the docs don't mention it. **The shell here could not reach `api.sleeper.app` or `docs.sleeper.com` (the egress proxy refused them), so CORS was not verified live. In production the visitor's browser makes the calls.** Other client-side Sleeper tools (e.g. the open-source fantasy-football-wrapped project cited in the spec) call it from the browser, which suggests `Access-Control-Allow-Origin` is permissive. **Check on first deploy:** open the live page, enter a real league ID, and confirm the cards load. If CORS ever blocks, the error shows as "Couldn't reach Sleeper".
- **Field note:** the docs' matchup example shows `starters`, `players`, `points`, `custom_points`, `matchup_id` and `roster_id`, but not `players_points` or `starters_points`. Real responses include them. The code treats `players_points` as optional, so if it's missing the bench awards are simply skipped.

## Email (optional)

- "Get weekly awards emailed" (shown under the cards) is a Kit form that uses the public api_key copied from `docs/ll97/index.html`, with tag placeholder **`TAGID_AWARDS`**.
- It sends exactly `api_key`, `email` and `fields.league_id`, and nothing else. The sample league sends an empty `league_id`.
- Copy says "we're still testing it". No sending pipeline exists yet.

## To do before launch (Matt)

1. Create a Kit tag (e.g. `league-awards-weekly`) and replace `TAGID_AWARDS` in `docs/awards/app.js`. Until then, signups show "didn't go through".
2. In Kit, create a custom field named `league_id`, so the league ID is stored.
3. Remove the two `awards` lines from `.git/info/exclude`, then commit.
4. After deploy, test one real Sleeper league in a browser (see CORS above).
5. Optional: link from `docs/index.html`. I didn't add one; I only added `awards/` to `docs/sitemap.xml`.

## Privacy and hosting

- **CSP meta tag:** `connect-src https://api.sleeper.app https://api.convertkit.com`, `script-src 'self'`, no inline scripts. The e2e test confirms a third-party fetch is blocked.
- **No dependencies outside the folder:** no CDN, analytics, cookies, localStorage or web fonts (system font stack only).
  - JSZip 3.10.1 is vendored at `docs/awards/vendor/` with its license.
- **Page copy:** "Not affiliated with Sleeper" disclaimer in the footer, plus a footer link to `../`. There are no NFL or team logos, and no betting links.
- **Files:** all JS is pure ASCII (non-ASCII is written as `\u` escapes).

## Files

| File | What |
|---|---|
| `docs/awards/index.html` | Page, CSS, SEO title/description ("Sleeper League Awards", "fantasy football weekly awards"), OG/Twitter/JSON-LD, FAQ |
| `docs/awards/awards.js` | Pure award math (UMD, also runs in Node) |
| `docs/awards/sleeper.js` | API client: input parsing, bounded concurrency, friendly errors (unknown user/league, 429, network) |
| `docs/awards/cards.js` | Canvas renderer (1080x1350, drawn icons, 12 themes) and deck builders |
| `docs/awards/demo.js` | Deterministic made-up league shaped like Sleeper responses (sample button + e2e fixtures) |
| `docs/awards/app.js` | UI wiring, share/save/zip, recap copy, deep links, Kit |
| `docs/awards/og.png` | 1200x630 OG image from sample cards |
| `bots/awards/fixtures/unit_league.json` | Hand-built 4-team fixture (ties, `custom_points`, empty slot `"0"`, missing `players_points`, playoff week with null `matchup_id`, failed/duplicate/commissioner transactions, orphan roster) |
| `bots/awards/make_fixtures.js` | Writes `fixtures/sleeper_routes.json` (85 API paths) from `demo.js` |
| `bots/awards/test_awards.js` | Unit tests (14), with expected values worked out by hand |
| `bots/awards/test_page.js` | Playwright e2e at 390px and 1280px (32 checks per width) |

## Tests

```
node --test bots/awards/test_awards.js
node bots/awards/make_fixtures.js
NODE_PATH=/opt/npm-tools/node_modules node bots/awards/test_page.js <screenshot dir>
```

**Status Nov 14, 2026:** 14/14 unit tests pass, and the e2e test reports ALL PASSED at both widths.

The e2e test routes every `api.sleeper.app` request to the fixtures, stubs Kit, and aborts anything else. At each width it checks:

- SEO/OG tags, the disclaimer and the `../` link;
- no API calls before input;
- unknown-user and no-leagues errors;
- username, then picker, then league;
- call count (≤ 4 + 2/week);
- card size and non-blank output, with footer ink on every card;
- default week = last final week, with the live week labelled and its warning note shown;
- URL deep link;
- clipboard recap;
- the season tab (7 cards, live week excluded);
- Save PNG at 1080x1350, and the zip contents;
- no horizontal scroll;
- the exact Kit payload;
- CSP;
- `?league=&week=5` deep link, pasted league URL, and the sample with zero API calls;
- no page errors.

I looked at the rendered cards and both page widths. Text fits, footers show, and the colours are distinct per award.

## Ideas (not built)

- A per-manager "season superlatives" card.
- Worst trade (needs the players map plus points after the trade, which needs a server or a cache).
- Optimal-lineup "coach rating" (needs positions from the players map).
- Playoff path from `winners_bracket`.
- Actual weekly email sends (a GitHub Actions job could compute awards for subscribed league IDs).
