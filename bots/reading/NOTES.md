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

- Title: "Reading Wrapped 2026: Your Goodreads Wrapped & StoryGraph Year in Review".
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
