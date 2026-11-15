# How-to guides (Nov 14, 2026)

Five static guides plus an index in `docs/guides/`. They're written to rank for "how to export" searches and lead into Group Chat Wrapped, Reading Wrapped and Fantasy League Awards. Nothing committed or pushed.

| Page | Target query | Leads to |
|---|---|---|
| `guides/how-to-export-whatsapp-chat.html` | how to export a WhatsApp chat (iPhone, Android, Web/Desktop) | `/lab/wrapped/` |
| `guides/how-to-export-telegram-chat-history.html` | how to export Telegram chat history (JSON) | `/lab/wrapped/` |
| `guides/how-to-export-goodreads-library.html` | how to export Goodreads library | `/lab/reading/` |
| `guides/how-to-export-storygraph-data.html` | how to export StoryGraph data | `/lab/reading/` |
| `guides/how-to-find-sleeper-league-id.html` | how to find Sleeper league ID | `/lab/awards/` |
| `guides/index.html` | hub page | all of the above |

## How it's built

- `bots/guides/build.py` generates all six pages. The visible numbered steps and the HowTo JSON-LD come from the same Python lists, so they can't drift apart. To change wording, edit `build.py` and rerun `python3 bots/guides/build.py`. Don't hand-edit the HTML, or the next build will overwrite it.
- `docs/guides/guides.css` is shared. The `<body>` class (`t-wrapped`, `t-reading`, `t-awards`) applies each app's colors. The pages use system fonts only and are mobile-first.
- Each page has a strict CSP with no scripts, `img-src 'self' data:` and no outside connections. The JSON-LD is a data block, so CSP doesn't block it.
- Each page has:
  - a unique title and description (52 to 64 and 146 to 160 characters);
  - a canonical URL, plus OG and Twitter tags (`og:image` is the app's `og.png`);
  - HowTo JSON-LD built only from the real steps (WhatsApp and Sleeper use one HowToSection per platform). The index uses CollectionPage.
- Each page also has:
  - "Last checked: Nov 2026";
  - a Troubleshooting section, a "Privacy: what's in a … export file" panel, one CTA to the app, and a Sources list;
  - a footer "Not affiliated with …" disclaimer (WhatsApp/Meta, Telegram, Goodreads/Amazon, The StoryGraph, Sleeper). The index lists all of them.
- There are no screenshots of the real apps. All text is original.

**Other edits (small):**
- `docs/sitemap.xml`: 6 URLs added, lastmod 2026-11-14.
- One footer line in each of `docs/wrapped/index.html`, `docs/reading/index.html` and `docs/awards/index.html`, linking to the matching guides.
- No app JS, CSP or Kit settings were touched.

## Sources, and what was and wasn't verifiable

The shell's network proxy blocks these sites, so I read them with the WebFetch tool on Nov 14, 2026. Several official help centers render with JavaScript and couldn't be read. **Each page says so where that applies**, rather than guessing.

### WhatsApp
- **Official FAQ** "How to export your chat history": https://faq.whatsapp.com/1180414079177245 (blocked from fetching: robots). The same article is at https://whatsapp.com/faq/en/android/23756533, which I did read.
  - Steps: "Open the chat. Tap More options > More > Export chat. Tap Without media or Include media. Choose your desired method (ex. Message, Mail, Add to Notes)".
  - Notes: "If you choose Include media, the most recent media sent will be added as attachments", and "Your chat history can't be re-imported because it's a text file and not a backup file."
  - The page has Android and iOS tabs. **Only the Android text was readable, so the iPhone steps (chat name → Export chat) were not checked word for word against the official iOS tab.** The page says this in a note under the iPhone steps.
  - **No Web/Desktop instructions exist on the official page.** The guide says so and tells people to export on the phone instead.
- **Message limits:** the current official page gives **no number**. The old "10,000 with media / 40,000 without (email size limits)" figures are widely quoted from earlier FAQ versions, but I couldn't confirm them. The archive.org copy wasn't fetchable. The guide labels them as unconfirmed.
- **Advanced Chat Privacy** blocks exports: https://blog.whatsapp.com/introducing-advanced-chat-privacy (Apr 23, 2025). It says "you can block others from exporting chats", and to turn it on you tap the chat name, then Advanced Chat Privacy.
- **Germany:** reports that export isn't offered there come only from 2019 press, via intermind.com. The guide says this isn't officially documented.

### Telegram
- **Blog:** https://telegram.org/blog/export-and-more (Aug 27, 2018). It covers Telegram Desktop, JSON or HTML, and "…" menu → "Export chat history".
- **Data Export Schema:** https://core.telegram.org/import-export. It covers:
  - Settings > Advanced > Export Telegram data;
  - the contents of `result.json`;
  - public groups/channels containing only the exporter's messages;
  - media over the size threshold being replaced with a warning.
- **Mobile apps have no export:** https://bugs.telegram.org/c/86 is an open suggestion, "Chat Export in mobile apps", whose workaround is Telegram Desktop.
- **Download page:** https://desktop.telegram.org/
- Not official:
  - The "Machine-readable JSON" label is from our existing app copy and redact.dev. Official docs only say "JSON".
  - The security wait before exporting is mentioned only by redact.dev, and the guide says so.
  - Whether the separate "Telegram for macOS" app can export isn't documented. The guide says to use Telegram Desktop.

### Goodreads
- **Official:** "Import or export your books", https://help.goodreads.com/s/article/000001100. **It's a Salesforce page that only loaded "Loading / CSS Error" for the fetcher, so its text was not verified.** https://www.goodreads.com/review/import couldn't be fetched either.
- **Steps cross-checked against:**
  - https://pickupreader.com/blog/how-to-export-goodreads-library-2026 (dated Aug 16, 2026): My Books → Tools → Import and export → Export Library → dated link → `goodreads_library_export.csv`. It also says export isn't in the mobile app.
  - Our existing reading app instructions.
- The page has a visible "About our check" panel saying the official text couldn't be read. **Matt: open the official article once in a browser and confirm the labels.**
- The CSV columns come from `bots/reading/NOTES.md`.

### StoryGraph
- **No export article exists in the help center** (https://thestorygraph.freshdesk.com FAQ folder, page 1 checked).
- **Official route:** a StoryGraph team reply (Nadia, Jul 7, 2022) on https://roadmap.thestorygraph.com/requests-ideas/posts/export-csv, marked Shipped: "export your data on the User Export page (https://app.thestorygraph.com/user-export), which can be accessed from the Manage Account one".
- **Getting Started article:** https://thestorygraph.freshdesk.com/support/solutions/articles/79000142013-getting-started-with-storygraph says "head to Manage Account in the top right corner menu" (for the Goodreads import).
- **Known issues:**
  - The ISBN column breaks in Excel: an open bug, https://roadmap.thestorygraph.com/bugs/posts/export-errors-on-isbn-column-data.
  - Genres aren't exported: https://roadmap.thestorygraph.com/requests-ideas/posts/add-genres-to-tsg-library-export.
- **Not documented officially:** the exact button label, email vs on-page download (literal.club says email), and whether the mobile app has the page. The guide says so explicitly.

### Sleeper
- **Support article:** https://support.sleeper.com/en/articles/4121798-how-to-find-your-league-id (dated Sep 14, 2026).
  - Web: the "18-digit number" at the end of the league URL.
  - App: League Settings → General League Settings → scroll to the bottom → copy League ID.
- **API docs:** https://docs.sleeper.com/ say "No API Token is necessary" and the API is read-only. League objects include a `previous_league_id`. The guide's "new season, new ID" point is phrased as an inference from that field, not as Sleeper's stated rule.
- Our app's placeholder ID has 19 digits, so the guide says "copy all of the digits" instead of promising 18.

## Tests

Run `NODE_PATH=/opt/npm-tools/node_modules node bots/guides/test_pages.js <shot dir>`. It serves `docs/` under `/lab/` on a local http server, blocks all outside requests, and uses a 390x844 viewport.

**Checks on all 6 guide pages and the 3 app pages (all pass):**
- HTTP 200;
- 0 console or page errors;
- no horizontal overflow.

**Extra checks on the guide pages:**
- canonical URL correct;
- unique titles and descriptions;
- "Last checked: Nov 2026" and the disclaimer present;
- buttons and summaries at least 44px tall;
- JSON-LD parses;
- the HowTo step count equals the visible step count;
- privacy, troubleshooting and sources sections present;
- CTA links to the app;
- each app page links to a guide.

**Link sweep:** all 39 internal link targets and sitemap URLs return 200.

I reviewed the WhatsApp page full-length at 390px and the top of the Goodreads page.

## To do after deploy
1. Submit the sitemap again in Search Console, and request indexing for the 6 guide URLs.
2. Spot-check the iPhone WhatsApp labels, Goodreads labels and the StoryGraph button label on real accounts. Update `build.py` if anything differs, and drop the "About our check" notes once confirmed.
3. Re-check every source each autumn (Wrapped season), then update the `CHECKED` constant in `build.py`.


## Libby guide (added Nov 15, 2026)

- **New page:** `guides/how-to-export-libby-timeline.html` (target: "how to export libby timeline / reading history").
  - It's generated by `build.py` (the `LIBBY` dict).
  - The title is 57 characters and the description 157.
  - It's listed under Reading on the index. The index description and disclaimer now mention Libby/OverDrive.
  - The sitemap gets one URL (lastmod 2026-11-15). The `reading/` and `guides/` lastmods were bumped.
- **Official source:**
  - [Libby Help 6207](https://help.libbyapp.com/en-us/6207.htm) (updated Sep 3, 2026): Shelf → Timeline → filters apply → Actions → Export Timeline → **Table** or **Spreadsheet**.
  - Also cited: Libby Help 6151 (Reading Journey) and the Carlsbad library FAQ.
- **Not official:**
  - the columns (from the storywell, LibbyGraph and libby-bracket open-source parsers);
  - the `libbytimeline-activities.csv` filename;
  - the older "Data (json)" option.
  - A visible "About our check" panel says this.
  - The troubleshooting answer about missing older loans says Libby doesn't document history length or device moves, rather than guessing.
- **Tests:** `test_pages.js` now covers 7 guide pages, takes a full-page 390px screenshot of the Libby guide, and checks a 47-link sweep. **ALL PASSED.**
