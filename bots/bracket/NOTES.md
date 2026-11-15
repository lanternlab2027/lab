# 76-Team Bracket: notes

Status: built and tested Nov 15, 2026. Idea #5 in `bots/ideas/APPS_ROUND3.md`. Not committed or pushed.

## Verified format facts (checked on the web Nov 15, 2026)

- Both Division I tournaments go from 68 to 76 teams starting in 2027. 24 teams play 12 Opening Round games
  (the old First Four is replaced). The 12 lowest-seeded automatic qualifiers play 6 games, the 12 lowest-seeded
  at-large teams play the other 6. The committee seeds all 76 teams; pairs are the closest teams on the overall
  seed list, with exceptions for rematches and geography.
  Source: NCAA.org media center, "NCAA reveals new 76-team bracket" (May 7, 2026).
- Seed lines (published plan, men's): at-large games are two No. 11 games and four No. 12 games; AQ games are two
  No. 15 games and four No. 16 games. So every region's 12 and 16 come out of the Opening Round, plus two 11s and two 15s.
  Sources: FOX 32 Chicago (quoting the NCAA plan), NBC Sports "what a 76-team bracket would have looked like".
  Caveat: ESPN's Nov 2026 bracketology (On3 write-up) put one at-large game on the 10 line, because the "closest
  on the seed list" rule can shift the line. Which regions get the 11 and 15 games is decided on Selection Sunday.
- 2027 men's dates (NCAA.com, Aug 12, 2026): Selection Sunday Mar 14; Opening Round Tue-Wed Mar 16-17 (Dayton
  UD Arena and Wichita INTRUST Bank Arena); first round Mar 18-19; second round Mar 20-21; regional semis Mar 25-26;
  regional finals Mar 27-28; national semifinals Sat Apr 3 and title game Mon Apr 5, Ford Field, Detroit.
  Regions: South (San Antonio), West (Los Angeles), Midwest (Kansas City), East (New York).
- 2027 women's (NCAA.org): Opening Round Wed-Thu Mar 17-18 on campuses of 12 of the top-16 hosts; regionals in
  Philadelphia and Las Vegas; national semis Apr 2 and title Apr 4 in Columbus, Ohio.
- Not stated anywhere yet: which region plays which in the national semifinals (set on Selection Sunday).

## What it is

Page: `docs/bracket/` (https://lanternlab2027.github.io/lab/bracket/). Name: "76-Team Bracket" (descriptive; no NCAA marks
in the name, title, meta or h1; "March Madness" appears once, descriptively, in the FAQ). "Not affiliated with the NCAA"
in the footer, on the sheet and on every card. No money anywhere: "for bragging rights".

- **Printable (the SEO page).** Title "Printable 76-Team Bracket 2027 (Free PDF) + No-Account Bracket Pool". The sheet is
  an SVG (render.js, viewBox 1100x850 = Letter landscape): 12 Opening Round games on the outside edges, 64-team bracket,
  champion box, tiebreaker box, name line, dates in the column heads. `@media print` hides everything but the sheet;
  `@page { size: landscape }` and a 9.6 x 7.42 in sheet fit one page on Letter and A4 (tested by PDF page count).
  `print.html` is the PDF-friendly view (paper picker Letter/A4, Print or save as PDF; also takes `#e=`/`#p=` links).
- **Fill-in.** "Fill in my bracket" makes a solo pool link and opens the fill UI: region tabs + Finals, one card per game,
  tap a team; changing an early pick clears later picks that relied on the knocked-out team. Also click-to-pick on the
  sheet at desktop width. "Fill the rest with better seeds". Draft in localStorage per pool id.
  Placeholders ("East 1", "East 16a") until the field is posted.
- **Field.** `docs/bracket/field-2027.json` is empty now. On Selection Sunday fill it as
  `{"regions":[{"code":"E","name":"East","playIn":[11,12,16]},...4 in national-semifinal order],"teams":{"E1":"Team",...76 slot ids}}`.
  Slot ids: region code + seed + a/b for Opening Round teams. If `regions` is empty the default layout is used
  (published plan: 16+12 in every region, 11 in East and South, 15 in West and Midwest, semis East-West and South-Midwest:
  a labelled placeholder). Commissioners can also paste their own 76 teams ("East 16a: Team" lines; the layout is inferred,
  so an at-large game on the 10 line or a women's field works too).
- **Pool.** Commissioner sets name, scoring (presets: doubling, tens, doubling + upset bonus, flat, or custom per round),
  lock time (default Tue Mar 16 2027 6pm ET) and field source -> pool link + standings link. Players get a "my picks"
  link (#e=, ~230 chars with the official field, <2,000 with a pasted field). Commissioner pastes links (any text; it finds
  all `#e=`/`#s=` links) into the standings page; the standings link (#s=) holds the pool + all entries (up to 250) and
  updates in place. Entries show "late" (time after lock, device clock) and "edited link" (checksum mismatch).
  An entry page also has "I run this pool: add to standings".
- **Results.** `docs/bracket/results-2027.json`: `{"winners": {"<game code>": "<winning slot id>"}, "championshipTotal": n, "updated": "Mar 18, 11:40pm ET"}`.
  Game codes: `OR.E.16`, `R1.E.1` (pod by top seed 1,8,5,4,6,3,7,2), `R2.E.1` (1,4,3,2), `R3.E.1` / `R3.E.2`, `R4.E`,
  `R5.EW` / `R5.SM` (from region order), `R6`. Bad codes or a winner not in that game are ignored. Ties: closest tiebreaker.
  "Preview with made-up results" shows demo standings/awards (labelled).
- **Awards** (1080x1350, cards.js): Best Bracket (Top of the Pool so far, before the final), Biggest Upset Called,
  Cinderella Believer, Busted First, Hottest Start, Chalk Eater. Edited entries get no awards. "My picks" card too.
- **Kit:** "Remind me on Selection Sunday", tag placeholder `TAGID_BRACKET` (box hidden until numeric), key copied from
  eats/kit.js by script (never printed), sends only email.
- **Conventions:** strict CSP (connect-src 'self' + Kit; print.html 'self' only), no-referrer, ?ref passthrough
  (share -> share2 ...) on every generated link, "Make yours" footer, ../ and ../apps/ links, cross-promo strip
  (data-from="bracket"; not added to more.js's APP list since docs/apps/ was off limits), OG image 1200x630 (make_og.js).

## Link format (codec.js)

Same as partybingo: text -> deflate-raw -> base64url in the hash (`z`), plain `t` fallback. Pool text
`bp1/name/rules/lock36/layout/o|c/[76 names]/~`; entry `be1/name/picks/tb/time36/check36/<pool text>`;
standings `bs1/count/<tab lines>/<pool text>`. Picks: 75 games x 2 bits = 19 bytes = 26 chars.
Checksum = FNV-1a of poolId|name|picks|tb|time. It catches truncation and hand edits (picks, name, back-dating, moving to
another pool); it is not security, which the page says plainly. Guards: 40k-char hash cap, 80 KB inflate cap (zip bomb),
every truncated prefix rejected.

## Tests

- `node bots/bracket/test_unit.js`: 68 checks (structure: 76 slots, 75 games, 12 OR games on the published lines, pairings,
  alt layouts; advancement and pick clearing; packing; results reading; scoring incl. upset bonus, max possible,
  tiebreak; awards; field parsing; codec round trips; tampering: changed pick, rename, back-date, other pool; truncation,
  junk, zip bomb; 60-entry standings link; injection).
- `NODE_PATH=/opt/npm-tools/node_modules node bots/bracket/test_page.js <dir>`: Playwright at 390 and 1280, 115 checks:
  SEO/CSP/marks/no gambling words, print hides all but the sheet, one-page PDF on Letter and A4 (index and print.html),
  solo fill + picks picture 1080x1350, pool create, two players in separate browsers (one tapping underdogs),
  a forged link flagged, standings vs. stubbed partial results (scores equal the model), full results -> 6 awards,
  award PNG 1080x1350, demo preview, Kit stub, no off-site requests, no console errors.
  Screenshots live outside the repo (scratchpad shots/bracket).
- `python3 bots/bracket/ascii.py`: re-escapes any non-ASCII in the JS (the Write tool turns \uXXXX into characters)
  and reports non-ASCII in HTML/JSON/MD. Everything is ASCII now.

## To do at launch

1. Mar 1: add `bracket` to docs/apps/more.js + hub + sitemap (not done: those files were off limits).
2. Create the Kit tag and replace TAGID_BRACKET.
3. Selection Sunday night: fill field-2027.json (regions in semifinal order + 76 teams). Pools created earlier with the
   official field and the default layout show a warning if the real Opening Round lines differ.
4. After each session: update results-2027.json (game code -> winning slot id; `updated`).
