# Seller Year in Review (Year in Review for Etsy sellers): notes

Page: `docs/etsy/` (served at https://lanternlab2027.github.io/lab/etsy/). Built and tested Nov 15, 2026, for idea #6 in `bots/ideas/APPS_ROUND3.md`. Not committed or pushed. Only new files in `docs/etsy/` and `bots/etsy/`; `docs/index.html`, `docs/apps/`, the sitemaps, `docs/bracket` and other apps were not touched.

## Files

- `docs/etsy/`
  - `index.html`: the page, strict CSP (same as amazon: scripts self-only, `connect-src` Kit only), SEO, how-to-download guide, 1099-K note, FAQ, cross-promo strip (`../apps/more.css` + `#more-apps data-from="etsy"` + `../apps/more.js`, just above the footer).
  - `parser.js`: CSV parsing, alias maps, money/date parsing, file-kind detection, fee classification, dedup. Exposes `EtsyParser`.
  - `stats.js`: recap numbers (`compute`) and the tax summary (`tax`). Exposes `EtsyStats`.
  - `cards.js`: 1080x1920 canvas cards. Engine copied from `docs/amazon/cards.js`, new "sewn label" look (linen, indigo, sage, clay, forest, plum; teal/plum/mustard accents; no orange, no logos).
  - `demo.js`: an invented ceramics shop ("Little Kiln" in tests), written out as real-format Orders, Order Items and monthly statement CSVs.
  - `app.js`: page controller, tax tab, CSV export, share/save/zip, `?ref` passthrough.
  - `kit.js`: Kit signup, tag `TAGID_ETSY` (box hidden until numeric). The api_key was copied programmatically from `docs/eats/kit.js`.
  - `vendor/`: JSZip 3.10.1 (copied from docs/amazon; used for "Download all (.zip)" and zipped uploads).
  - `og.png`: 1200x630, made by `bots/etsy/make_og.js` from the synthetic shop.
- `bots/etsy/`: `make_fixtures.js` + `fixtures/` (all synthetic), `test_parser.js` (13 node:test tests), `test_page.js` (Playwright, 163 checks), `make_og.js`.

Run:

```
TZ=America/New_York node bots/etsy/make_fixtures.js
TZ=America/New_York node --test bots/etsy/test_parser.js
NODE_PATH=/opt/npm-tools/node_modules node bots/etsy/test_page.js <shots dir>
NODE_PATH=/opt/npm-tools/node_modules node bots/etsy/make_og.js
```

Screenshots from the last run are in the session scratchpad (`shots/etsy/`), not in `bots/`: landing, sample, deck and tax at 390 and 1280, signup, and every card with revenue and names shown (`card-full-*`) and hidden (`card-private-*`).

## What it does

1. **Upload** any mix of Orders, Order Items and monthly statement CSVs (or a zip of them), several at once or one after another (later uploads add to earlier ones; exact repeats count once). File kind is detected by header, not name. Deposits, Direct Checkout payments, reviews and listings files are skipped.
2. **Recap cards** (up to 9, each can be switched off in the "Cards" picker):
   orders this year (+ YoY, items sold, sales, days with a sale, orders-by-month strip); best seller + next three (needs Order Items); busiest month (bars); busiest day + weekday bars; where orders went (top state or country, counts only, needs 5+ located orders); repeat-buyer share (needs buyer IDs on half the orders); average order (or items per order when money is hidden); "made by hand" (or "packed and shipped"); a summary hang-tag.
   Toggles: shop name, **Show sales in dollars** (default on; off removes every money figure), **Show listing names** (default on; the idea file said opt-in, but these are the seller's own product titles and the point of the post; flip the default in `index.html` if Matt prefers), **I make what I sell**.
3. **Tax summary tab.** With statements: tiles (gross sales, refunds, Etsy fees, ads, shipping labels, net), a category table, a month table (12 months + total; scrolls inside its box on phones), CSV export (categories x months + Total, not-tax-advice line, formula-injection guard), print/PDF. It reconciles: computed net is checked against the sum of the statement Net column (excluding deposits and card charges) and the page says whether they match. With only orders: monthly item sales, shipping, refunds, "before fees", and a prompt to add statements.
4. **Disclaimers:** "Not tax advice", "Your accountant or tax preparer should confirm", 1099-K box with sources, "Not affiliated with Etsy" in footer/FAQ/CSV.
5. **Privacy:** only aliased columns are read. Buyer names, street/city/zip, ship name, usernames (hashed only), payment method, coupon codes and Variations (personalization) never leave the row. Buyer User ID (or Buyer column) becomes a salted FNV hash (random salt per page load) used only to count repeat buyers. Unit test checks sentinel PII values never appear in parser output and pins the exact object keys; Playwright checks the page and CSV never contain them, zero network requests after load, and CSP blocks a third-party fetch.
6. **Share:** Share / Save PNG / Share all / zip; "Make yours: lanternlab2027.github.io/lab/etsy" on every card and the footer; "Pass it on" text; `?ref=X` becomes `?ref=share-X` (and `share-X` -> `share2-X`); footer links to `../` and `../apps/`.

## Data research (Nov 15, 2026)

**Download paths (checked against Etsy Help):**
- Orders / Order Items: Shop Manager > Settings > Options > Download Data > Orders: CSV Type, Month, Year (leave Month empty for a full year) > Download CSV. [Etsy Help 360000343328](https://help.etsy.com/hc/articles/360000343328). CSV types listed there: order items, orders, Etsy Payments sales, Etsy Payments deposits.
- Monthly statements: Finances > Payment account > Monthly statements. [Etsy Help 115015747228](https://help.etsy.com/hc/articles/115015747228) describes the statements but not the "Download CSV" button; that step comes from seller guides ([Craftybase](https://craftybase.com/blog/how-to-download-your-tax-totals-from-etsy), [IgnasA/statement-xray](https://github.com/IgnasA/statement-xray)). **UNVERIFIED in a live shop.**

**Column names (VERIFIED from real exports on GitHub, 2020-2025):**
- `EtsySoldOrders2025-1.csv` (ddooxhuy09/Etsy-data-warehouse, MoulikArora21/FiDAViSta-Converter, pqueuex/store.extantra; same header in ButterMyGit/MakerMetrics 2026 demo data): the 36 columns listed at the top of `parser.js`.
- 2020 UK-English variant (yasir-naseer-tetralogicx/Webinopoly `EtsySoldOrders2020-9.csv`): Date Posted, Delivery City/State/Zipcode/Country, Delivery Discount, Delivery, Sales tax, Order total. Aliased and covered by a fixture.
- `EtsySoldOrderItems2025-1.csv` and `etsy_statement_2025_1.csv` (ddooxhuy09): headers as in `parser.js`. Statement header: `Date,Type,Title,Info,Currency,Amount,Fees & Taxes,Net,Tax Details`.
- [Coupler.io](https://blog.coupler.io/etsy-to-csv/) lists the same Orders and Order Items headers.

**Formats seen in those real files:** Orders/Items `Sale Date` = `MM/DD/YY`; Items `Date Paid` = `MM/DD/YYYY`; amounts plain (`54.98`); `Adjusted Order Total` = `0.00` when untouched; `Status` blank. Statements: dates `January 31, 2025`; amounts with currency symbol (`-$0.20`, `-(dong sign)5,016`); `--` for empty; HTML entities in titles (`&#39;`).

**Statement rows seen (2025, non-US seller):** Sale "Payment for Order #N"; Tax "Sales tax paid by buyer" (negative) and "Refund to buyer for sales tax" (positive); Fee "Transaction fee: <item>", "Transaction fee: Shipping", "Processing fee", "Listing fee ($0.20 USD)", "Regulatory Operating fee", "Credit for ..." versions of each; VAT "VAT: Processing Fee", "VAT: transaction", "VAT: auto-renew sold", etc.; Marketing "Etsy Ads" (Info "Bill for click-throughs ..."), "Fee for sale made through Offsite Ads", "Etsy Plus subscription fee"; Refund "Refund for Order #N" / "Partial refund for Order #N"; Payment "Charge for refund N"; Deposit "... sent to your bank account".

**Checked against real data:** the statement "Payment for Order" amount includes the buyer's sales tax and the Tax row removes it (order total 29.66 USD = sale 725,276 VND at 24,453; tax row 41,081 VND = 1.68 USD = order total minus value-discount+shipping). So gross sales = Sale amounts minus Tax collected. Also: in the Orders CSV, `Sales Tax` was 0 while `Order Total` included tax; the recap therefore uses Order Value - Discount + Shipping - Shipping Discount, never Order Total. And `Card Processing Fees` / `Order Net` in the Orders CSV are in the **payment account currency**, not the listing currency, so they are ignored; fees come only from statements.

**UNVERIFIED (no real file found):**
- US shipping label rows. Assumed Type `Shipping` or `Shipping Label`, Title like "USPS shipping label" (Craftybase says filter Type for "Shipping Label"). The classifier matches type shipping/shippinglabel/postage or titles with label/postage/USPS/FedEx/UPS/Canada Post/Royal Mail, plus credits.
- Status values for cancelled / fully refunded orders (real files had blank Status). Treated as full refund when Status matches cancel/fully refunded/refunded; partial refunds come from a non-zero Adjusted Order Total below Order Total.
- Older statements where processing fees sit in the Sale row's "Fees & Taxes" column are handled (counted as processing) but no real file was seen.
- Share & Save credits and other new row types fall to "Other Etsy fees" (if type Fee) or "Other credits and adjustments"; the reconciliation check would still pass because they are in the net.

## IRS 1099-K (verified on irs.gov, Nov 15, 2026)

- [IR-2025-107, Oct 23, 2025](https://www.irs.gov/newsroom/irs-issues-faqs-on-form-1099-k-threshold-under-the-one-big-beautiful-bill-dollar-limit-reverts-to-20000): OBBB retroactively reinstated the pre-ARPA threshold: no 1099-K unless gross payments exceed $20,000 **and** more than 200 transactions.
- [IR-2026-03, Jan 8, 2026](https://www.irs.gov/node/154056): repeats the $20,000 / 200 threshold and says thresholds "do not affect whether income is taxable".
- Neither page names tax year 2026 explicitly; the page says "rules can change; your accountant should confirm". Some states have lower thresholds (not listed on the page on purpose).

## To do before launch (Matt)

1. Download one real year of Orders, Order Items and 12 statements from a US shop and drop them in. Check: shipping-label row Type/Title, cancelled/refunded Status values, whether the reconciliation line says "matches". Add any new names to the alias maps or `classify()`.
2. Create a Kit tag (e.g. `etsy-year-in-review`) and replace `TAGID_ETSY` in `docs/etsy/kit.js`.
3. Add `etsy: ['Seller Year in Review', 'Your Etsy shop's year + tax summary']` (and RELATED picks) to `docs/apps/more.js`; until then the strip still renders generic picks. Add hub card, apps listing and sitemap entries.
4. Decide the listing-names default (currently on).
5. Launch Jan 5 per the idea file.

## Known limits

- Statements count money when Etsy posts it; cards count by sale date. The FAQ explains the mismatch.
- Months without a statement show zeros; the page says how many months were covered.
- "All years" in the tax tab lists each year-month; the orders-only fallback combines months across years (noted under the table).
- Repeat buyers need Buyer User ID (Orders) or Buyer (Items); salt is per page load, so nothing is comparable across visits.
- Year select counts include cancelled orders; the cards exclude them (the note says how many).
