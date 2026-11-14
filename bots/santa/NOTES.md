# Secret Santa (no backend), idea #3 from bots/ideas/APPS_ROUND1.md

Live path once pushed: https://lanternlab2027.github.io/lab/santa/

## What it is

A fully static app. The spec assumed a Cloudflare Worker and D1; this MVP has no server at all.

- `docs/santa/index.html` + `app.js`: the organizer page. The organizer enters a group name, names, can't-draw pairs, budget, date and note, then clicks Draw. The page never shows the matches. Each person gets a link with Share (only where Web Share exists), Copy, Text (`sms:`) and Email (`mailto:`) buttons, plus a per-row "sent" status. "I'm in the draw too" gives the organizer an "Open my link" button for their own link only. "Copy all links" copies names and links, never matches. The sealed links are saved to localStorage, so a reload on the same device keeps them.
- `docs/santa/go.html` + `go.js`: the reveal page. It shows a "This link is for Sam / Not Sam? No peeking" gate, then a gift-unwrap animation with confetti (skipped under reduced motion), the match, the budget, the date with a countdown and the note. "Add to calendar" downloads an `.ics` file: an all-day event with a 7-day alarm. The page is `noindex` and sets `no-referrer`.
- **Wishlist:** on the reveal page a person writes a wishlist and gets a `#w1.` link to drop in the group chat or send to the organizer. It contains only their name, the group and the wishes. URLs in it are made clickable, and it never includes their match.
- `docs/santa/santa.js`: the shared core, with no dependencies (nothing needed vendoring). It contains:
  - the draw;
  - AES-GCM sealing;
  - base64url;
  - ICS generation.

  It also loads in Node for the tests.
- `docs/santa/og.png` (1200x630) is rendered from `bots/santa/og.html`.
- **Viral footer** on every reveal and wishlist page: "Made with Lantern Lab Secret Santa: start your own group", linking to `./` (which is /santa/). The page footer links to `../`, "A Lantern Lab project".
- There is no tracking and no third-party requests. The only off-site call is the optional Kit reminder.

## Draw

- Randomness comes from `crypto.getRandomValues`, with unbiased `randInt` (rejection sampling) and Fisher-Yates.
- Shuffles are retried until valid: nobody draws themselves and no pair draws each other, in either direction. This is **exactly uniform** over all valid assignments.
- Impossibility is detected first with a bipartite perfect-matching check (Kuhn), so the page gives a clear error instead of looping. Example: 3 people with 1 couple. Someone paired with everyone gets a named error.
- If 200k shuffles all fail (only in absurdly constrained groups), a fallback guided by the matching check assigns a valid draw. That draw is valid but not guaranteed uniform.
- 2-person swaps (A gets B, B gets A) are allowed.
- Limits: 3 to 200 people, and names must be unique (case-insensitive).

## Link format and the honesty caveat

The format is `go.html#s1.<16-byte key>.<12-byte IV + AES-GCM ciphertext>`, all base64url. Each link gets a fresh random key and IV. The payload is `{k,g,n,t,b,d,m}`: kind, group, giver, target, budget, date and note. Links run about 300 characters.

The fragment is never sent to the server. **The key sits in the same fragment**, so the encryption only hides the match from anyone who merely *sees* the link: chat previews, the organizer's screen, or a glance. It also makes the link tamper-evident. It does **not** stop someone who *opens* the link. The page says this plainly ("whoever opens a link sees what's in it. That includes you."), and the FAQ says it too. Making a draw that is truly peek-proof needs the server-side draw from the original spec.

A redraw does not invalidate old links. The "Start over" confirm tells the organizer to resend every link.

## Kit reminder

- The Kit api_key is copied from the ll97 page into `index.html`.
- **The tag is the placeholder `TAGID_SANTA`.** While it is not numeric, the reminder box stays hidden, so nothing breaks in production.
- **To turn it on:**
  1. Create a Kit tag and replace `TAGID_SANTA` with its numeric ID.
  2. Create a custom field `santa_exchange_date`.
  3. Build a Kit automation that emails 7 days before that date. Check in Kit that the date-based trigger works with a text custom field in YYYY-MM-DD format.
- The payload is only `api_key`, `email` and `fields.santa_exchange_date`. The test asserts that no names are sent.
- The box only appears after a draw that has a date.

## Tests

```bash
node bots/santa/test_core.js
NODE_PATH=/opt/npm-tools/node_modules node bots/santa/test_e2e.js <screenshot dir>
```

- **`test_core.js`** runs 10,000-trial runs for each of 5 people with no pairs, 6 people with 2 couples, and 7 people with 3 couples. It checks:
  - nobody draws themselves or an excluded person, and nobody is drawn twice;
  - a chi-square test against an exact enumeration of every valid draw (44, 116 and 672 draws) passes at p=.001;
  - for 8 people, each giver's chance of drawing each other person is within about 7% of 1/7;
  - 300 random groups with random pairs all get valid draws;
  - impossible cases raise an error;
  - the fallback path gives valid draws.

  Crypto tests:
  - links round-trip unicode, quotes and newlines;
  - every link is unique;
  - no names are readable in a link;
  - tampered, truncated and wrong-key links are rejected;
  - the wishlist round-trips.

  It also tests ICS escaping and the year rollover.
- **`test_e2e.js`** runs Playwright at 390px and at 1280px. Steps:
  1. An impossible-pairs error and a duplicate-name error are shown.
  2. Pasting a list splits it into one row per name.
  3. A 6-person group with "me too" and 2 couples is drawn.
  4. All 6 links open. Each greets the right person and reveals exactly the match the draw produced.
  5. Couples are respected, and every person gives and receives once.

  It also checks:
  - the text and email hrefs, the copy-to-clipboard button, the .ics download and the wishlist round trip;
  - the broken-link error and the viral footer;
  - there is no horizontal scroll;
  - there are no page errors;
  - **no request goes anywhere except same-origin static files**;
  - with Kit stubbed, the reminder sends only the email and the date;
  - a reload restores the links;
  - the placeholder tag keeps the reminder hidden.

  Screenshots were reviewed at 390px, 1280px and in dark mode.

## Not done / next

- The site home page (`docs/index.html`) does not link to it yet, because that page is NYC-focused. Add a card if wanted. `docs/sitemap.xml` has the entry.
- Possible later additions:
  - an "avoid 2-person swaps" option;
  - affiliate gift ideas on the reveal page (needs Amazon Associates sign-up);
  - cross-links to #1 and #2;
  - the server-side, organizer-can't-peek version once the #2 Worker exists.
- Nothing has been committed or pushed.
