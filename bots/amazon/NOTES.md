# Year in Orders (for your Amazon data): notes

Page: `docs/amazon/` (served at https://lanternlab2027.github.io/lab/amazon/). Built and tested Nov 15, 2026, for idea #3 in `bots/ideas/APPS_ROUND3.md`. Not committed or pushed. No tracked files were changed: `docs/index.html`, `docs/apps/`, the sitemaps and `.git/info/exclude` were left alone. Everything is new, in `docs/amazon/` and `bots/amazon/`.

## Files

- `docs/amazon/`
  - `index.html`: the page, CSP and SEO.
  - `parser.js`: CSV parsing, the header alias map, money and date parsing, file detection and dedup.
  - `stats.js`: the numbers.
  - `cards.js`: the 1080x1920 canvas cards. The engine is copied from `docs/netflix/cards.js`, with a new "receipt" look.
  - `demo.js`: the invented sample export, in both layouts.
  - `app.js`: the page controller, tax table and share code.
  - `kit.js`: the Kit signup.
  - `vendor/`: JSZip 3.10.1, copied from `docs/netflix/vendor`.
  - `og.png`: the OG image.
- `bots/amazon/`
  - `make_fixtures.js` and `fixtures/`: all synthetic.
  - `test_parser.js`: 15 `node:test` tests.
  - `test_page.js`: the Playwright test.
  - `make_og.js`: builds `og.png`.

Run:

```
TZ=America/New_York node bots/amazon/make_fixtures.js
TZ=America/New_York node --test bots/amazon/test_parser.js
NODE_PATH=/opt/npm-tools/node_modules node bots/amazon/test_page.js <shots dir>
NODE_PATH=/opt/npm-tools/node_modules node bots/amazon/make_og.js
```

The last screenshots are in the session scratchpad at `shots/amazon/`, not in `bots/`. They cover landing, sample, deck and tax at 390 and 1280, plus every card PNG with names hidden, with names shown, and from the classic layout.

## What it does

1. Upload one or more files: the export zip (several zips work too), or the loose CSVs. Drag-and-drop works, and there's a sample button. Inside a zip, `P.wantEntry` picks the order, refund and digital CSVs **by file name before decompressing**. Profile, address, payment, cart, browsing and returns-status files are never opened.
2. **Recap cards** (up to 9). A card is skipped when its data is missing.
   - **Total spent:**
     - net of refunds, plus orders, items and refunds;
     - the change from last year;
     - a line saying exactly what was counted;
     - "Since YYYY: $X" when the file has earlier years.
   - **An order every N days:** a 12-month calendar of order days, with active days, top weekday and items.
   - **Biggest order:** a receipt drawing whose lines are **redaction bars ("NAME HIDDEN")** unless the person opts in. Also shows the order's share of the year and the multiple of the average order.
   - **Busiest month:** month spend bars, the busiest single day (most orders) and the top weekday. For All time it shows bars by year.
   - **Top categories:** **only when the export has a Department or Category column filled on at least half the lines**, otherwise skipped. The page note says why. Nothing is guessed from product names.
   - **Most re-ordered:** the same ASIN (or product name) in the most separate orders. The name is redacted by default.
   - **Late-night orders:** orders placed 12:00 to 4:59 am in the **device's time zone**. Export timestamps are UTC. Shows a 24-hour radial histogram and the latest order time. Skipped when the file has dates only.
   - **Average order:** mean, median and size buckets.
   - **Your year, itemized:** a summary receipt with a barcode.
3. **Controls:**
   - **Year:** years in the file plus All time. Defaults to the current year, or falls back to the latest year with orders and says so.
   - **Currency:** shown only when the file has several. Marketplaces are never summed across currencies.
   - **Name on cards.**
   - **Count digital orders:** shown only when a digital file is present.
   - **Show item names on the cards:** off by default. It changes only the biggest-order, re-order, average and receipt cards, and the test asserts that.
4. **Tax filter tab.**
   - **Disclaimer:** "Not tax advice", "Keep the receipts" and a pointer to Amazon invoices.
   - **Filters:** date range (follows the year), item search, and All / Business only / Not tagged.
   - **Table:** a business checkbox per item. Totals show the shown items and the business sum, with a business total in the footer. 250 rows per page, with "Show more". At 390px the rows become cards.
   - **Bulk tagging:** "Tag all shown" and "Untag all shown".
   - **CSV export:** two buttons, business only and all shown. Columns are `Date, Order ID, Item, ASIN, Quantity, Total, Currency, Business, Refund on this order, Type`. The file ends with a TOTAL row and a not-tax-advice line.
   - **CSV safety:** a formula-injection guard prefixes `'` to cells starting with `= + - @`.
   - **"Remember my business tags":**
     - an opt-in checkbox, off by default;
     - stores only `orderId|ASIN` keys in localStorage, never names or prices;
     - unticking it clears them.
5. **Share code, copied from Streaming Wrapped:**
   - Share, Save PNG, Share all and a .zip of PNGs.
   - "Pass it on" text, and `?ref=` passthrough (`?ref=X` becomes `?ref=share-X`).
   - "Make yours: lanternlab2027.github.io/lab/amazon" on every card and in the footer, with links to `../` and `../apps/`.
   - A hint for in-app browsers.
6. **Privacy.**
   - **Parser:** only the columns in the alias map are read. Item objects have exactly `id, kind, orderId, ts, timed, name, asin, qty, total, currency, category, status, src`. A unit test asserts that address, payment, tracking and buyer-name values never appear in the parser output.
   - **Network and storage:** the strict CSP is the same as netflix (`connect-src` is Kit only). The Playwright test asserts zero network requests during upload and that CSP blocks a third-party fetch. Kit sends only `api_key` and `email`.
7. **Kit.** `kit.js` copies the eats/mileage pattern. The public api_key was copied programmatically from `docs/eats/kit.js`, not retyped. The tag is **`TAGID_AMAZON`**, and while it isn't numeric the signup box stays hidden. Tests inject a numeric tag with `window.AMAZON_KIT_TAG_TEST`.
8. **Naming.**
   - The page is named "Year in Orders, for your Amazon data", with "Not affiliated with Amazon..." in the footer and FAQ.
   - Palette: paper, ink, green, plum, navy and a soft yellow. No orange and no logos.
9. **SEO.**
   - Title: "How Much Have I Spent on Amazon? Free 2026 Order History Spending Recap".
   - The description contains "Amazon order history spending".
   - Also: OG and Twitter tags, `og.png` (1200x630) and WebApplication JSON-LD.

## Export format research (Nov 15, 2026). UNVERIFIED against a real export

There are two layouts in the wild. Both are handled, and the parser detects files by header first and by file name second.

**Newer layout (2025-2026), a zip like `Your Orders.zip`:**

- **Orders:** `Your Amazon Orders/Order History.csv`, one row per item line. The columns are in alphabetical order:
  - ASIN, Billing Address, Carrier Name & Tracking Number, Currency, Department (in some reports), Gift Message, Gift Recipient Contact, Gift Sender Name, Item Serial Number;
  - Order Date, Order ID, Order Status, Original Quantity, Payment Method Type, Product Condition, Product Name, Purchase Order Number;
  - Ship Date, Shipment Item Subtotal, Shipment Item Subtotal Tax, Shipment Status, Shipping Address, Shipping Charge, Shipping Option;
  - Total Amount, Total Discounts, Unit Price, Unit Price Tax, Website.
- **Refunds:** `Your Returns & Refunds/Refund Details.csv`, with columns Creation Date, Currency, Direct Debit Refund Amount, Disbursement Type, Order ID, Payment Status, Quantity, Refund Amount, Refund Date, Reversal fields and Website.
- **Digital:** `Your Amazon Orders/Digital Content Orders.csv`, with one row per price component. Component Type is "Price Amount" or "Tax", with Transaction Amount, Digital Order Item ID, Base Currency Code and so on. The rows are summed per Digital Order Item ID, and $0 items such as free e-books are skipped.
- **Sources:**
  - [redstreet/beancount_reds_importers amazon_orders.py](https://github.com/redstreet/beancount_reds_importers/blob/main/beancount_reds_importers/importers/amazon/amazon_orders.py) has the exact header line, including Department.
  - [nikhilakki/JungleAudit generate-demo-data.py](https://github.com/nikhilakki/JungleAudit/blob/main/scripts/generate-demo-data.py) has the order, refund and digital headers and folder names. It's synthetic too, and its order header lacks Department.
  - [tsu-nera/dailybuild amazon_export.py](https://github.com/tsu-nera/dailybuild/blob/main/src/lib/purchases/amazon_export.py) documents these quirks:
    - the ISO dates mix values with and without milliseconds;
    - amounts can contain commas or be quoted like `'-69'`;
    - `Total Amount` is tax-inclusive times quantity;
    - zero-width spaces appear in names.
  - [fbricon/amzn-orders](https://github.com/fbricon/amzn-orders) maps both layouts. Refund rows are counted only when `Payment Status` is Completed.
  - [PrettySailorSoldier/fluxnfile parser](https://github.com/PrettySailorSoldier/fluxnfile/blob/main/src/utils/amazon-data-export-parser.ts) treats `Cancelled` lines and quantity 0 as cancelled, and ignores addresses and payment columns.
  - [edonosotti/amzn-ecomm-orders-insights](https://github.com/edonosotti/amzn-ecomm-orders-insights) uses Department for categories.
  - [takeoutday.org Amazon guide](https://takeoutday.org/guides/how-to-download-amazon-data) (verified Sep 28, 2026) lists `Your Orders/Order History.csv`.

**Classic layout (about 2019-2024):**

- **Orders:** `Retail.OrderHistory.1/Retail.OrderHistory.1.csv`. Further marketplaces come as `.2` and `.3`. The columns are Website, Order ID, Order Date, Purchase Order Number, Currency, Unit Price, Unit Price Tax, Shipping Charge, Total Discounts, Total Owed, Shipment Item Subtotal(+Tax), ASIN, Product Condition, Quantity, Payment Instrument Type, Order Status, Shipment Status, Ship Date, Shipping Option, Shipping Address, Billing Address, Carrier Name & Tracking Number, Product Name, Gift fields and Item Serial Number. Sources:
  - [jprouty/monarchmoney-amazon-tagger amazon.py](https://github.com/jprouty/monarchmoney-amazon-tagger/blob/main/monarchmoneyamazontagger/amazon.py) has the zip path regex and the currency and date field names, plus a quirk where the header reads `Website"`.
  - [ajot/amazon-unboxed README](https://github.com/ajot/amazon-unboxed) gives the folders.
  - The column order is from secondary sources and memory, so it's the least certain part.
- **Refunds:** `Retail.OrdersReturned.Payments.1/...csv`, with OrderID, AmountRefunded, Status, RefundCompletionDate and Currency (fbricon).
- **Digital:** `Digital-Ordering.1/Digital Items.csv`, with OrderId, OrderDate, Title, OurPrice and OurPriceTax. These are aliased, but there's no fixture for this file.

**Retired "Order reports > Items" CSV** (removed in 2023; still on some people's disks): Order Date (M/D/YY), Order ID, Title, Category, ASIN/ISBN, Purchase Price Per Unit, Quantity, Item Total. It works through the aliases, and the dates are pinned to local noon.

**Alias map:** `ALIASES`, `REFUND_ALIASES` and `DIGITAL_ALIASES` in `parser.js`. Headers are normalized to lowercase letters and digits only, so case, spaces, underscores, quotes and `&` don't matter.

**Totals:** the line total comes from Total Owed or Total Amount. If neither is there, it falls back to (Unit Price + Unit Price Tax) x qty + Shipping Charge - |Total Discounts|.

**Money parsing:** handles dollar, euro and pound signs, `1,234.56`, `1.234,56`, `12,99`, `'-69'`, `(5.00)` and "Not Available".

**Dedup:** identical lines are counted per file, and the max across files is kept. Uploading the zip plus its CSV counts once, while genuine repeat lines inside one file are kept.

**Refunds:** a refund counts only when it matches an order in the selected period and currency, so the 2026 net means "2026 orders minus refunds on them". Refunds on older orders follow those orders.

**Kindle reading data** (asked about in the idea notes): the full export has `Kindle.ReadingInsights` and `Kindle.Annotations.json` (takeoutday). That's not in scope here and could be a Reading Wrapped importer later.

**Request steps:**
- Path: Account > Data and privacy > Request your data, or `amazon.com/hz/privacy-central/data-requests/preview.html`. Pick "Your Orders" (plus Returns & Refunds), submit, confirm the email, wait, then download the zip.
- Timing: "usually a few hours to a couple of days, up to 30 days for large requests".
- Sources: takeoutday (Sep 2026), Tiller 2026 ("days or even weeks... often within a few hours"), fbricon, ajot and SciTee/orderlens.
- **Amazon's help page itself could not be fetched from this container** (robots.txt blocked WebFetch and the proxy blocked curl). The page links Amazon's help page [Request your personal information](https://www.amazon.com/gp/help/customer/display.html?nodeId=TP1zlemejtTn6pwYKS) as the source, but nobody has read its text yet. **Check the steps against it in a browser before launch.**

## To do before launch (Matt)

1. **Check one real export.** Request "Your Orders" (plus Returns & Refunds) and drop the zip in. Things to check:
   - the column names, especially whether `Department` exists;
   - whether `Order Date` is UTC with a `Z`;
   - whether the refund `Payment Status` value is "Completed";
   - the digital file's name and columns.

   If the export reveals new column names, add them to `ALIASES`.
2. Read Amazon's help page (link above) in a browser and adjust the six steps in `#export` if the menu names differ.
3. Create a Kit tag (e.g. `amazon-year-in-orders`) and replace `TAGID_AMAZON` in `docs/amazon/kit.js`. Until then the signup box stays hidden.
4. When ready: commit `docs/amazon/` and `bots/amazon/`, and add the hub card, apps listing and sitemap entries. None were touched, as instructed.
5. Competitor note: [ajot/amazon-unboxed](https://unboxed.curiousmints.com) already makes Wrapped-style slides from the same export. The idea file said none was found. Our differences are shareable story PNGs, names hidden by default, refunds netted and the tax filter with CSV.

## Known limits

- Late-night times use the device's time zone, which is wrong for someone who moved during the year. The FAQ says this.
- The "busiest day" counts orders by local calendar day.
- Totals include tax and shipping as Amazon lists them per line. Gift card reloads, Prime fees and in-store purchases aren't in the order file. The FAQ explains both.
- If a file has no currency column, it's treated as USD.
