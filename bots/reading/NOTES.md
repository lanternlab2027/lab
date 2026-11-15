# Reading Wrapped: notes

Page: `docs/reading/` (served at https://lanternlab2027.github.io/lab/reading/). Built and tested Nov 14, 2026. Not committed.

**Heads-up:** `docs/reading/` and `bots/reading/` are already listed in `.git/info/exclude` under "WIP agent output". Remove those two lines before committing, or git won't see the files. The only tracked file changed is `docs/sitemap.xml` (one `reading/` entry added).

## What it does

1. The visitor uploads a Goodreads `goodreads_library_export.csv` or a StoryGraph export `.csv` (a `.zip` with the CSV inside also works). Drag-and-drop works, and there's a "made-up sample library" button.
2. Everything is parsed, counted and drawn in the browser. Nothing is uploaded.
3. They get up to 10 cards at 1080x1920 (canvas), in this order. Cards without data are skipped.
   - **Books read:** big count, change vs the previous year, the year's books drawn as spines on a shelf (thickness = pages), and chips.
   - **Pages read:** total, pages a day, the year drawn as a stack of books. Goodreads only.
   - **The longest book:** with bars for your average and shortest. Goodreads only. When the deck is over 10 cards, this card is dropped and the longest book is highlighted on the pages card instead.
   - **Reading pace by month:** a 12-bar chart. Ties are worded properly. For "All time", it shows bars by year.
   - **Top-rated book:** stars (quarter stars supported), the Goodreads average, and "also near the top".
   - **Most-read author:** only when someone has 2+ books. Titles are listed as a "contents" page.
   - **Genre mix:** Goodreads shelves with status/format/challenge shelves filtered out. StoryGraph uses tags, or moods if there are no tags.
   - **Harsh critic / Easy grader / Fair judge:** your average vs the Goodreads average (needs 3+ books with both), a star histogram, and the biggest disagreement. StoryGraph has no community rating, so it gets "How you rate" (a histogram) instead.
   - **Re-reads:** Read Count >= 2, or several StoryGraph read periods.
   - **The one you abandoned:** DNF shelf (`dnf`, `did-not-finish`, `abandoned`, `gave-up`...), plus your finish rate.
   - **How you read:** print/ebook/audio split, plus StoryGraph pace. This is filler: it's the first card dropped when there are more than 10.
   - **Reader personality:** 13 archetypes scored from the stats (Marathoner, Devourer, Superfan, Genre Hopper, Tough Critic, Generous Heart, Comfort Re-reader, Binge Reader, Steady Page-Turner, Time Traveler, Early Adopter, Audio Adventurer, Quick Dipper). The best score of 1 or more wins, with up to 2 "streak of" traits. The fallback is "The Curious Reader".
4. **Controls:**
   - **Year:** years with finished books, plus "All time". It defaults to the current year. If the current year has no finished books yet (for example, in early January), it falls back to the latest year with books and says so.
   - **Your name on the cards:** optional; the footer reads "Sam's 2026 in books".
   - **Undated books checkbox:** only shown when some read books have no finish date. It counts those books by Date Added.
5. Share (Web Share API, falling back to download), Save PNG, Share all, and Download all (.zip with JSZip). This is the same code as the chat app.
6. **Kit signup** ("Get next year's Reading Wrapped"):
   - same pattern and public api_key as `docs/wrapped/app.js` (the key was copied programmatically, not retyped);
   - tag **`TAGID_READING`** is a placeholder;
   - sends only `api_key` + `email`.

## To do before launch (Matt)

1. Create a Kit tag (e.g. `reading-wrapped-2027`) and replace `TAGID_READING` in `docs/reading/app.js`. Until then, signups show "didn't go through".
2. Remove the two `reading` lines from `.git/info/exclude`, then commit.
3. Optional: add a card on `docs/index.html` (I didn't touch the hub).

## Export formats (verified Nov 14, 2026)

Neither site publishes a formal spec. I checked these against several independent, recent open-source importers and test fixtures found via GitHub code search, plus export how-tos (pickupreader.com 2026 guide, lectr support, literal.club).

- **Goodreads (24 columns):** `Book Id, Title, Author, Author l-f, Additional Authors, ISBN, ISBN13, My Rating, Average Rating, Publisher, Binding, Number of Pages, Year Published, Original Publication Year, Date Read, Date Added, Bookshelves, Bookshelves with positions, Exclusive Shelf, My Review, Spoiler, Private Notes, Read Count, Owned Copies`.
  - Older exports add `Recommended For/By`, `Original Purchase Date/Location`, `Condition`, `Condition Description` and `BCID`.
  - Dates are `YYYY/MM/DD`. ISBNs are `="0123..."`. `My Rating` 0 means unrated.
  - `Date Read` holds only the latest read, so re-reads come from `Read Count`.
- **StoryGraph (23 columns):** `Title, Authors, Contributors, ISBN/UID, Format, Read Status, Date Added, Last Date Read, Dates Read, Read Count, Moods, Pace, Character- or Plot-Driven?, Strong Character Development?, Loveable Characters?, Diverse Characters?, Flawed Characters?, Star Rating, Review, Content Warnings, Content Warning Description, Tags, Owned?`.
  - `Read Status` is one of `read`, `currently-reading`, `to-read` or `did-not-finish` (`paused` is also handled).
  - `Star Rating` uses quarter steps.
  - `Dates Read` holds periods like `2026/01/03-2026/01/19`, comma-separated for re-reads.
  - There are **no page counts, genres or community ratings**, which is why some cards are Goodreads-only.

## Robustness (parser.js)

- **Columns:** matched by name, ignoring case and spacing, never by position. Reordered, missing and extra columns all work.
- **Delimiter:** auto-detected (comma, semicolon or tab), so Excel/Numbers re-saves in EU locales still parse.
- **CSV:** RFC-4180 quoting, embedded newlines and quotes, BOM and CRLF are handled. Blank and truncated rows are tolerated.
- **Dates:**
  - accepted forms: `YYYY/MM/DD`, ISO with a time, `M/D/YYYY` and `D/M/YYYY` (a first number > 12 means day-first), `D.M.YYYY`, "Mar 14, 2026", and the partial dates `YYYY/MM` and `YYYY`;
  - partial dates count toward the year but not toward a month.
- **Numbers:** "1,104", "1.104" (thousands) and "4,21" (decimal comma) are all read correctly.
- **Titles and authors:** series are split from titles (`Title (Series, #2)`). A missing Author is rebuilt from `Author l-f`.
- **Shelf inference:** a missing exclusive shelf plus a Date Read is treated as `read`.
- **Errors:** a non-export CSV and an empty export each show a clear error.

## Privacy design

Same approach as Group Chat Wrapped:

- **CSP meta tag:** `default-src 'none'; script-src 'self'; connect-src https://api.convertkit.com; ...`.
- **No outside assets:** no CDN, analytics or web fonts (system serif and sans stacks). JSZip 3.10.1 is vendored in `docs/reading/vendor/` with its license.
- **Nothing is stored:** no localStorage or cookies.
- **Page copy:**
  - "Your library never leaves your device." badge;
  - "How we know" section;
  - airplane-mode tip;
  - FAQ and footer "Not affiliated with Goodreads or StoryGraph";
  - footer link to `../`.

## SEO

- Title: "Reading Wrapped 2026: Your Goodreads Wrapped & StoryGraph Year in Review" (unchanged; Libby is in the description, OG/Twitter text and JSON-LD alternateName "Libby Wrapped").
- The description targets "goodreads wrapped" / "reading wrapped 2026" / "storygraph year in review".
- OG and Twitter tags, plus JSON-LD WebApplication with alternateName Goodreads Wrapped / StoryGraph Year in Review.
- `og.png` (1200x630) is built from synthetic sample cards by `bots/reading/make_og.js`.
- Added to `docs/sitemap.xml`.
- **Yearly maintenance:** the title says 2026, so update it to 2027 next season.

## Files

| File | What |
|---|---|
| `docs/reading/index.html` | Page, CSS (warm paper / deep green / claret), SEO/OG/JSON-LD, export guide, privacy, FAQ |
| `docs/reading/parser.js` | CSV + Goodreads/StoryGraph normalizer (UMD, so it runs in Node tests too) |
| `docs/reading/stats.js` | Year stats, genre filter, critic, re-reads, DNF, personality |
| `docs/reading/cards.js` | Canvas card renderer (6 themes, shelf/stack/chart drawings) |
| `docs/reading/app.js` | UI wiring, year/name/undated controls, share/download/zip, Kit |
| `docs/reading/demo.js` | Deterministic, invented sample library (Goodreads- or StoryGraph-shaped CSV) |
| `bots/reading/make_fixtures.js` | Writes the synthetic fixtures (full libraries, odd/edge-case files, zip, tiny, empty, non-export) |
| `bots/reading/test_parser.js` | Unit tests (15) |
| `bots/reading/test_page.js` | Playwright e2e at 390px and 1280px, plus a January-2027 fallback case (41 checks) |
| `bots/reading/make_og.js` | Builds `og.png` |

All JS is pure ASCII (non-ASCII written as `\u` escapes, same rule as the chat app).

## Tests

```
node bots/reading/make_fixtures.js
node --test bots/reading/test_parser.js
NODE_PATH=/opt/npm-tools/node_modules node bots/reading/test_page.js <screenshot dir>
```

At each width, the e2e test:

1. freezes the browser clock to Nov 14, 2026;
2. intercepts every request and asserts **zero requests of any kind after upload** (stricter than the chat app's "no non-static requests");
3. checks that CSP blocks a third-party fetch;
4. checks that Kit (stubbed) gets one call to `TAGID_READING` with only `api_key` + `email`;
5. checks the year default and options, plus re-renders for year, all time and name;
6. checks the undated checkbox (hidden or shown correctly);
7. checks that Save PNG and the zip download;
8. checks for no horizontal scroll;
9. runs every fixture and checks the error messages;
10. checks for no page errors.

Status Nov 14, 2026: 15/15 unit tests pass and the e2e test reports ALL PASSED.

## Visual review

Every card was rendered and inspected for the full Goodreads year, StoryGraph, all-time with a very long name, the odd fixture and a 2-book library. Fixed during review:

- the bookmark ribbon overlapping the year pill;
- empty lower thirds on the top-rated, critic, re-read and DNF cards;
- the page-stack overflowing on all-time;
- the sparse shelf for tiny years (now one shelf of bigger books);
- month-tie wording;
- the "no page count" note colliding with the footer;
- the CSS `display:flex` overriding `[hidden]` on the undated checkbox.

Known trade-off: the PNGs are about 2 MB each, because the smooth gradients and paper grain don't compress well. The chat app's cards are similar.

Fixtures are all synthetic: invented titles and authors (Imogen Vale, Silas Wren, "The Cartographer's Winter", etc.). No real reading data is used anywhere.


## Libby importer (Nov 15, 2026, idea #8 in `bots/ideas/APPS_ROUND2.md`)

The app now also reads a **Libby timeline export**: the Spreadsheet `.csv` (usually `libbytimeline-activities.csv`), the older Data `.json`, either of those inside a `.zip`, or a single-title Reading Journey JSON. Not committed.

### What Libby's export is (verified Nov 15, 2026)

- **Official steps** ([Libby Help 6207](https://help.libbyapp.com/en-us/6207.htm), updated Sep 3, 2026): Shelf → Timeline → (optional filters, which are applied to the export) → Actions → Export Timeline → choose a format.
- **Official formats: only two, `Table` and `Spreadsheet`.**
  - Table is a web page you can bookmark or share.
  - Spreadsheet saves a file to the device.
  - Confirmed by [Carlsbad City Library's FAQ](https://carlsbadca.libanswers.com/faq/332573) (updated Sep 26, 2025), which adds that the spreadsheet can be imported into Goodreads.
  - The Reading Journey export ([Libby Help 6151](https://help.libbyapp.com/6151.htm)) offers the same two choices.
- **The brief's "CSV / JSON / HTML / shareable link" is only partly right.**
  - Today's official choices are Table (an HTML page with a shareable link) and Spreadsheet (a CSV).
  - A **`Data (json)`** choice is described only by older third-party tools:
    - [libby-to-notion](https://web.stanford.edu/~nanbhas/projects/libby-to-notion/) ("Export Timeline → Data (json)");
    - [booklife-mcp](https://andylbrummer.github.io/booklife-mcp/docs/tools/history-import-timeline) (`share.libbyapp.com/data/{uuid}/libbytimeline-all-loans.json`);
    - [libby-bracket](https://github.com/jwmccay/libby-bracket) (`.../libbytimeline-activities.json`).
  - It's **not in current official help**, so it may have been removed or renamed. We parse it anyway.
  - We **don't fetch share links**: the CSP and the privacy promise rule that out. The page asks for the Spreadsheet file.
- **Columns: OverDrive doesn't publish them**, so these come from open-source parsers (read through GitHub code search; the raw files were blocked here).
  - **CSV:** `Cover, Title, Author, Publisher, ISBN, Timestamp, Activity, Details, Library`. This comes from the [storywell](https://github.com/drmowinckels/storywell) `sources/libby.py` docstring and its fixture header. [LibbyGraph](https://github.com/clockworkcoding/LibbyGraph) reads lower-case `cover, title, … timestamp, activity, details`.
  - **Activity values:** `Borrowed`, `Returned`, `Placed on hold`. LibbyGraph treats "last activity borrowed" as currently reading and "returned" as read, dated by the return.
  - **JSON** (libby-bracket test artifacts):
    - top level: `{ version: 1, timeline: [ … ] }`;
    - each entry: `cover: {contentType, url, title, color, format: "ebook"}`, `title: {text, url, titleId}`, `author`, `publisher`, `isbn`, `timestamp` (epoch **ms**), `activity`, `details: " 21 days "`, `library: {text, url, key}`.
  - **Reading Journey JSON** ([kyurikotpq gist](https://gist.github.com/kyurikotpq/56c394193618070ac3ba9db489e054ec)): `readingJourney{cover,title,author}`, plus `circulation[{activity,timestamp,details}]` and `highlights`.
- **Still unverified** (a real export would settle these):
  1. The CSV **timestamp format**. One blog's script expects `%m/%d/%y %H:%M`, while storywell's fixture uses ISO. We accept ISO with or without a zone, epoch s/ms, `M/D/YY h:mm`, and "Month D, YYYY h:mm AM" with an optional weekday or "at".
  2. Whether the CSV has a **format column**. No source shows one.
  3. The exact JSON value for audiobooks. We match `/audio/`.
  4. The magazine representation.
  5. Whether a "finished" activity exists. No source shows one; we handle `/finish|complet|marked as read/` in case it does.
  6. Whether expired loans log a `Returned` row.

### How books are counted (explained on the page under Export → Libby)

- **Grouping:** events are grouped into a book by title + author (series is split off as usual).
- **Read:** a book is read if it has any `Returned` (or finished-marker) event. It's dated by the **latest** return, with one finish per book and no re-read inflation. Re-borrowing after a return keeps it read.
- **Currently reading:** a borrow with no return, still inside its loan period. The period is `Details` "N days" (default 21), or a renewal plus N days.
- **Undated read:** a borrow with no return whose loan has ended. Its `dateAdded` is set to the loan end, and it **counts only if the reader ticks the existing "undated" checkbox**. The label is reworded for Libby: "loans that ended without a Returned entry". This also covers exports that only contain borrows (LibbyGraph has the same opt-in).
- **To-read:** holds only. Cancelled holds are ignored.
- **Magazines:** counted as loans, never as books. JSON `format: magazine`, or in the CSV no ISBN plus author empty or equal to the publisher.
- **Audiobook vs ebook:**
  - JSON: the `cover.format` field.
  - CSV: there's no format column, so an **audio-imprint publisher** (`/audio|audible|recorded books|blackstone|brilliance|tantor|podium|…/`) means audiobook, and anything else is an ebook. The page says this is a guess.
- **Local dates:** timestamps with a zone are converted to the reader's local date.

### Cards for Libby

- Pages, longest, top-rated, critic, mix, DNF and re-reads drop out automatically, because the data isn't there.
- `formats` ("How you read") is skipped when the library card exists.
- The deck is: Books read (with a "library loans" chip), Reading rhythm, Most-read author (2+ books), **Library love**, Reader personality.
- **Library love** (`cards.js`, claret theme):
  - loans in the period (by borrow date) and the number of libraries;
  - a **due-date slip** with the favorite library and its 6 latest borrow dates "stamped";
  - an ebook / audiobook (/ magazine) split bar with a headline ("Mostly eyes: 82% ebooks");
  - chips: holds placed, plus the longest hold-to-borrow wait (≥ 7 days), the average wait, or the most re-borrowed title.
- **Fixed during review:**
  - The slip height now fits its rows.
  - The persona card showed "authors" twice for decks with no ratings, pages or mix. The 4th tile now falls back to library loans, or months with a finished book, or years. This affects Libby and sparse decks only; Goodreads and StoryGraph tiles are unchanged.

### Files touched

- **App code:**
  - `docs/reading/parser.js`: Libby CSV/JSON parsing, `libbyTime`, `libbyFormat`, `libbyKind`. `parseAny(text, filename, {now})` takes an optional `now`.
  - `stats.js`: `s.library`.
  - `cards.js`: the Library love card and the tile fix.
  - `app.js`: accepts `.json` and `.json` inside a zip, plus Libby status, label and share text.
  - `demo.js`: synthetic `libbyEvents` / `libbyCSV` / `libbyJSON`.
  - `index.html`: copy, a Libby export section, "How we count Libby books", FAQ, disclaimer, guide link. **The CSP is byte-identical**, and the e2e test now asserts the exact string.
- **Fixtures** (all synthetic; URLs are `*.example.invalid`): `libbytimeline-activities.csv/.json`, `libby_export.zip`, `libby_odd.csv`, `libby_empty.csv`, `not_libby.json`.
- **Tests:**
  - `test_parser.js`: 22 tests, 7 of them new. They are timezone-independent, checked under UTC, LA, Auckland, Pago Pago, Tokyo and Kiritimati.
  - `test_page.js`: Libby CSV, JSON, zip and odd uploads; card labels; the status message; the expired-loan checkbox; the errors; Libby card PNGs exported for review. It also clears `#file` before each upload, because re-selecting the same file fires no change event. Zero requests after upload still holds.

### To do

1. Do one real Libby Spreadsheet export and confirm the timestamp format and columns. Check whether audiobooks and magazines are distinguishable in the CSV. Then tighten the publisher heuristic if possible.
2. If the share-link JSON still exists, consider a "paste your Table link" flow. **Don't**, unless the CSP and privacy copy change; for now it's deliberately not supported.
