# Awards-Night Ballot Pool: notes

Status: built and tested Nov 16, 2026. Idea #8 in `bots/ideas/APPS_ROUND3.md`. Not committed or pushed.
Page: `docs/ballot/` (https://lanternlab2027.github.io/lab/ballot/). Nothing outside docs/ballot/ and bots/ballot/ was changed.

## Verified 2027 dates (checked on the web Nov 15-16, 2026)

| Show (file) | Ceremony | Nominations | Sources |
|---|---|---|---|
| Film and TV awards, 84th (`globes-2027`) | Sun Jan 10, 2027, 7:30-10:30 pm ET live on CBS from the Beverly Hilton | Mon Dec 7, 2026 | CBS/Paramount press page for the 84th; AwardsWatch |
| Music awards, 69th (`music-2027`) | Sun Feb 7, 2027, Crypto.com Arena, LA, on ABC | Mon Nov 16, 2026 (today) | ABC press release; ABC News; recording academy rules page |
| Film academy awards, 99th (`film-2027`) | Sun Mar 14, 2027, 7 pm ET / 4 pm PT on ABC, Dolby Theatre | Thu Jan 21, 2027 | ABC press release (academy + ABC); TheWrap |

The source URLs are in each show file's `sources`.

- Music start time: 7 pm ET / 4 pm PT on ABC (announced with the nominations, Nov 16, 2026: academy press release + Billboard). `ceremony` is `2027-02-07T19:00:00-05:00`; the unit test checks it.
- Mar 14, 2027 is the day DST starts, so 7 pm ET is `-04:00`. The unit test checks this.
- Categories:
  - Film: the 24 categories for the 99th awards. The academy's rules release for the 99th added, removed and renamed nothing, and Casting stays.
  - Film+TV: last year's 28 categories, including Best Podcast and Cinematic and Box Office Achievement, with the "Female/Male Actor" wording.
  - Music: 20 of about 100 categories, the big four plus headline genre awards. They include the 2027 rename ("Best R&B Solo Performance") and the new "Best Asian Pop Music Performance" and "Best Latin Song". The country album award is split into Contemporary and Traditional, as it was in 2026.

## What it is

- **Naming.** "Awards-Night Ballot Pool". No awards trademarks anywhere on the page, in meta or JSON-LD, or on the cards (the test checks for oscar, academy award, grammy, golden globe, emmy, sag and statuette).
  - Shows are named "Movie awards night 2027", "Music awards night 2027" and "Film and TV awards night 2027". The about text says "the film academy's 99th awards ceremony" and "the recording academy's 69th awards".
  - The official sites appear only as "Official site" links (`resultsUrl`).
  - "Not affiliated with any awards organization" is in the footer, the FAQ, the printable sheet and every card. "For bragging rights", with no money language (tested).
  - SEO idea, not done: one nominative mention in the FAQ would match real searches, but the film academy is strict about its marks. That is Matt's call.
- **SEO.** Title "Printable Awards Ballot 2027 + Free Awards Night Ballot Pool". The description has both phrases. canonical, OG, Twitter and JSON-LD tags. OG image 1200x630 (`make_og.js`).
- **Shows.** `shows/index.json` lists the ids, with one file per show (schema at the top of `ballot.js`, checked by `Ballot.validateShow`).
  - The real shows ship with empty nominee lists. Each show card says "Nominations announced <date>; ballots open then."
  - After that date, until we add the nominees, it says "were announced... ballots open as soon as we post them".
  - Demo (`demo.json`): 8 categories with obviously fake nominees. Every category says "(Demo)", and the show and the cards say DEMO. `results/demo.json` holds made-up winners.
- **Pool flow.**
  - Host: picks a show, pool name and scoring. Scoring is one point per category, or weighted with each category's 1-3 weight from the show file.
  - Tiebreaker: none, a show preset whose answer goes in the results file (e.g. `runtime`), or the host's own question. The host enters that answer on the leaderboard, and it is saved in the link.
  - Lock time defaults to the ceremony start. The host gets a pool link and a leaderboard link.
  - Players: tap one nominee per category (skips allowed), add a name and the tiebreak guess, and get a picks link (#e=). Drafts are kept in localStorage per pool.
  - A pool link for a show without nominees says "ballots open then" and works once the nominees are added.
  - Host pastes any text into the leaderboard. Every #e= and #s= link is pulled out. Other pools and damaged links are skipped. There is one ballot per name, and a newer one replaces the old.
  - The leaderboard link (#s=) updates in place. Columns: rank, points, right/decided, max still possible, and tiebreak guess with "off by". Ties go to the closest guess.
  - Flags:
    - "late": made after the lock, by the device clock.
    - "edited link": checksum mismatch. Listed last, unranked, no awards.
    - "older list" / "wrong nominee list": the show's `rev` changed.
  - The entry page has "I'm the host: add to standings".
- **Live results.** The page fetches `results/<id>.json` with no-cache. "Refresh results" works at any time.
  - From 30 min before the start until 6 h after (and until `final`), it re-checks every 60 s while the tab is visible and shows a red live dot.
- **Cards** (1080x1350, cards.js; serif and gold, no statuette art):
  - "My ballot": up to 8 picks, the heaviest first. After results it adds checkmarks and "7 of 8 right - 11 pts".
  - The Oracle: top of the pool.
  - Upset Caller: the correct pick the fewest others made (under half the pool).
  - The Contrarian: lowest average agreement with the pool. Needs 3+ ballots.
  - Awards need 2+ unedited ballots. The Oracle and Upset Caller also need at least one winner in.
- **Print.** `@media print` hides everything but the `#paper` ballot: Letter portrait, 2 columns, with name, pool and score lines, checkboxes and the tiebreaker.
  - Before nominations it prints 5 write-in lines per category. An entry prints with its picks filled in.
  - On screen the preview is clipped, with a "Show the whole ballot" button.
  - Page counts: the demo is 1 page (Letter and A4). The blank film ballot is 2 pages.
- **Kit.** "Tell me when ballots open" (`kit.js`), tag placeholder `TAGID_BALLOT`. The box stays hidden until the tag is numeric. The key was copied from eats/kit.js by a script and never printed. The request sends only the email.
- **Conventions.**
  - Strict CSP (connect-src 'self' + Kit) and no-referrer.
  - ?ref passthrough on every generated link: none -> share, X -> share-X, share -> share2.
  - "Make yours" footer, ../ and ../apps/ links, and light/dark tokens.
  - Cross-promo strip with data-from="ballot". `ballot` is not in more.js's APP list, because docs/apps/ was off limits.

## Link format (codec.js)

Same approach as the bracket app: text -> deflate-raw -> base64url (`z`), or plain `t` when that is shorter.
- Pool text: `ab1/name/show id/f|w/lock36/tbKey/tbQ/~`.
- Entry: `ae1/name/picks/tb/time36/rev36/check36/<pool text>`.
- Standings: `as1/host tb answer/count/<tab lines>/<pool text>`.
- Picks: one base-36 char per category, `0` = none.
- Checksum: FNV-1a of poolId|name|picks|tb|time|rev. It is honest-play only, and the page says so.
- Guards: a 40k-char hash cap, an 80 KB inflate cap, and every truncated prefix is rejected. Up to 300 ballots per leaderboard link; 62 ballots come to about 2.3k chars.

## Tests

- `node bots/ballot/test_unit.js`: 109 checks.
  - Show files: every file validates, is ASCII, has no marks and ships with empty nominees. The verified dates and times, incl. DST.
  - Validation rejects 12 kinds of bad file.
  - Status and picks packing.
  - Codec round trips: pool, entry, 62-entry standings, custom tiebreak, plain encoding.
  - The late flag.
  - Tampering: pick, rename, back-date, other pool. Truncation, junk, zip bomb, injection.
  - Results: ties, case-insensitive names, unknown names ignored.
  - Scoring (flat and weighted), max possible, tiebreak order, shared ranks, the custom answer, and unranked edited links.
  - The three awards.
- `NODE_PATH=/opt/npm-tools/node_modules node bots/ballot/test_page.js <dir>`: Playwright at 390 and 1280, 133 checks.
  - Home: SEO, CSP, no marks or money language, footer, more strip, show statuses, Kit hidden.
  - Print CSS and PDF page counts (Letter and A4). ?ref passthrough (4 cases).
  - Host creates a pool. Three players in separate browsers, plus a forged link and an other-pool link.
  - Entry page vs. results, and entry print.
  - Leaderboard vs. stubbed partial results, then refreshed to final. Scores equal the model; tiebreak checked.
  - The 3 award PNGs and the ballot PNG are 1080x1350.
  - A late ballot plus a custom-tiebreak host answer. A film pool before nominations. A damaged link.
  - Kit stub: sends only the email, and the key matches. No off-site requests, no console errors.
  - Screenshots: `/tmp/claude-0/-home-claude/69ef2e03-4772-566e-a19b-2f78e096e5ba/scratchpad/shots/ballot/` (outside the repo).
- `python3 bots/ballot/ascii.py` re-escapes non-ASCII in the JS. Everything is ASCII.
- `node bots/ballot/make_og.js` rebuilds og.png.

## To do

1. Done Nov 16: `shows/music-2027.json` has the official nominees for all 20 categories (116 nominees; no category renamed or dropped). Checked against the academy's list and press release plus Billboard. Spellings follow the official list (e.g. "THIS MUSIC MAY CONTAIN HOPE.", "Tame Impala With JENNIE"). The music ballot is open; `rev` stays 1.
2. Dec 7: fill `globes-2027.json`. Jan 21: fill `film-2027.json` (up to 10 Best Picture nominees; the limit is 30 per category).
3. If a nominee list changes after ballots go out, bump `rev`; old ballots then show "older list". Never reorder nominees, because picks are stored as indexes.
4. During each show, edit `results/<id>.json`:
   - Add `"<category id>": "Exact nominee name"` for each winner, or an array for a tie. Unknown names are ignored, so copy names exactly.
   - Set `updated` (e.g. "8:42 pm ET") and the `tiebreak` values (e.g. `runtime`).
   - Set `final: true` at the end. Pages pick up changes within a minute.
5. Create the Kit tag and replace `TAGID_BALLOT`. The box then appears automatically.
6. At launch: add `ballot` to docs/apps/more.js, the hub and the sitemap. These files were off limits for this build.
7. Done: the music show starts at 7 pm ET.
