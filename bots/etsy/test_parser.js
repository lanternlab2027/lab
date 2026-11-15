// Unit tests for docs/etsy/parser.js and stats.js (node:test). Fixtures are synthetic (make_fixtures.js).
// Run: TZ=America/New_York node --test bots/etsy/test_parser.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const P = require('../../docs/etsy/parser.js');
global.EtsyParser = P;
const S = require('../../docs/etsy/stats.js');
const FX = path.join(__dirname, 'fixtures');
const read = (...names) => names.map((n) => ({ name: n, text: fs.readFileSync(path.join(FX, n), 'utf8') }));
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.006, `${msg}: ${a} vs ${b}`);

test('money parsing: US, symbols, dashes, decimal commas, U+2212, parentheses', () => {
  near(P.parseMoney('$1,234.56'), 1234.56, 'us');
  near(P.parseMoney('-$0.20'), -0.2, 'neg dollar');
  assert.equal(P.parseMoney('--'), null);
  near(P.parseMoney('1.234,50 \u20ac'), 1234.5, 'eu');
  near(P.parseMoney('\u221280,24 \u20ac'), -80.24, 'unicode minus');
  near(P.parseMoney('12,50'), 12.5, 'decimal comma');
  near(P.parseMoney('(5.00)'), -5, 'parens');
  near(P.parseMoney('-\u20ab5,016'), -5016, 'VND thousands');
  near(P.parseMoney('CA$50.00'), 50, 'CA$');
});

test('dates: MM/DD/YY, Month D, YYYY, ISO, D Month YYYY, day-first column', () => {
  const d = (ts) => { const x = new Date(ts); return [x.getFullYear(), x.getMonth() + 1, x.getDate(), x.getHours()]; };
  assert.deepEqual(d(P.parseWhen('01/31/25')), [2025, 1, 31, 12]);
  assert.deepEqual(d(P.parseWhen('January 31, 2025')), [2025, 1, 31, 12]);
  assert.deepEqual(d(P.parseWhen('2026-04-02')), [2026, 4, 2, 12]);
  assert.deepEqual(d(P.parseWhen('5 April 2026')), [2026, 4, 5, 12]);
  assert.deepEqual(d(P.parseWhen('03/04/2020', 'dmy')), [2020, 4, 3, 12]);
  assert.equal(P.parseWhen('13/13/2020'), null);
});

test('file kinds are detected by header; deposits, payments and junk are skipped', () => {
  const p = P.parseFiles(read('EtsySoldOrders2026.csv', 'EtsySoldOrderItems2026.csv', 'etsy_statement_2026_3.csv', 'not_etsy.csv'));
  assert.deepEqual(p.files.map((f) => f.kind), ['orders', 'items', 'statement']);
  assert.deepEqual(p.ignored, ['not_etsy.csv']);
  const dep = P.parseFiles([{ name: 'EtsyDeposits2026-1.csv', text: 'Date,Amount,Currency,Status,Bank Account Ending Digits\n"January 5, 2026",100.00,USD,Executed,1234\n' },
    { name: 'EtsyDirectCheckoutPayments2026-1.csv', text: 'Payment ID,Buyer Username,Buyer Name,Order ID,Gross Amount,Fees,Net Amount,Currency,Order Date\n1,u,N,3,10,1,9,USD,01/01/2026\n' }]);
  assert.equal(dep.files.length, 0);
  assert.equal(dep.ignored.length, 2);
});

test('aliases: 2020 UK "Delivery" headers with day-first dates and GBP', () => {
  const p = P.parseFiles(read('EtsySoldOrders2020-uk.csv'));
  assert.equal(p.orders.length, 2);
  const [a, b] = p.orders;
  const da = new Date(a.ts), db = new Date(b.ts);
  assert.deepEqual([da.getFullYear(), da.getMonth() + 1, da.getDate()], [2020, 9, 25]);
  assert.deepEqual([db.getMonth() + 1, db.getDate()], [10, 13]);
  assert.equal(a.currency, 'GBP'); assert.equal(a.country, 'United Kingdom');
  near(a.shipping, 3.2, 'Delivery -> shipping');
  near(b.sales, 40.5, 'value minus discount');
});

test('aliases: reordered, lower-case, semicolon order items with decimal commas', () => {
  const p = P.parseFiles(read('items_aliases.csv'));
  assert.equal(p.files[0].kind, 'items');
  assert.equal(p.items.length, 3);
  near(p.items[0].total, 25, 'item total');
  assert.equal(p.items[0].currency, 'EUR');
  assert.equal(p.items[0].listingId, '111');
  const s = S.compute(p, { year: 2026 });
  assert.equal(s.orderCount, 2, 'orders rebuilt from items');
  assert.equal(s.itemCount, 4);
  assert.equal(s.best[0].name, 'Hand-thrown bowl'); assert.equal(s.best[0].qty, 3);
});

test('refunds from the orders file: partial via Adjusted Order Total, cancelled orders, buyer region', () => {
  const p = P.parseFiles(read('orders_refunds.csv'));
  const [o1, o2, o3] = p.orders;
  near(o1.refund, 20, 'partial refund = total - adjusted');
  assert.equal(o1.full, false);
  assert.equal(o2.full, true); near(o2.refund, 27.22, 'cancelled refunds all');
  near(o3.refund, 0, 'Adjusted 0.00 means untouched');
  assert.equal(o1.state, 'CA', 'state name normalized to code');
  const s = S.compute(p, { year: 2026 });
  assert.equal(s.orderCount, 2); assert.equal(s.cancelled, 1);
  near(s.sales, 84, 'sales ex tax'); near(s.shipping, 10, 'shipping');
  near(s.refunds, 47.22, 'refunds'); near(s.revenue, 84 + 10 - 47.22, 'revenue');
});

test('privacy: names, addresses, coupons, usernames and raw buyer IDs never reach parser output', () => {
  const p = P.parseFiles(read('orders_refunds.csv', 'EtsySoldOrders2020-uk.csv', 'items_aliases.csv', 'EtsySoldOrders2026.csv', 'EtsySoldOrderItems2026.csv'));
  const dump = JSON.stringify(p);
  ['Sentinelname', 'Zelda', 'Secretaddress', 'Hiddencity', '94999', 'SECRETCOUPON', 'zelda_user', 'Hidden Mews', 'SW0 0AA', 'Geheimstrasse', 'Gerda', 'Sample Street', 'Exampleville', 'Avery', 'Glaze:Speckled', 'Credit Card'].forEach((s) => assert.ok(!dump.includes(s), 'leaked ' + s));
  assert.ok(!/"77001"|"501"/.test(dump), 'raw buyer IDs leaked');
  assert.deepEqual(Object.keys(p.orders[0]).sort(), ['buyer', 'country', 'currency', 'discount', 'full', 'inPerson', 'items', 'orderId', 'refund', 'refunded', 'sales', 'salesTax', 'shipping', 'src', 'state', 'total', 'ts'].sort());
  assert.deepEqual(Object.keys(p.items[0]).sort(), ['buyer', 'country', 'currency', 'listingId', 'name', 'orderId', 'qty', 'src', 'state', 'total', 'ts', 'txId'].sort());
  // the same buyer hashes the same within a run, different buyers differ
  const r = p.orders.filter((o) => o.src === 'orders_refunds.csv');
  assert.equal(r[0].buyer, r[2].buyer); assert.notEqual(r[0].buyer, r[1].buyer);
});

test('fees categorization on a real-shaped statement (VAT, credits, regulatory, Etsy Plus, labels)', () => {
  const cases = [
    ['Fee', 'Transaction fee: Mug', 'transaction'], ['Fee', 'Transaction fee: Shipping', 'transaction'], ['Fee', 'Credit for transaction fee on shipping', 'transaction'],
    ['Fee', 'Processing fee', 'processing'], ['Fee', 'Listing fee ($0.20 USD)', 'listing'], ['Fee', 'Regulatory Operating fee', 'regulatory'],
    ['VAT', 'VAT: Processing Fee', 'vat'], ['Marketing', 'Fee for sale made through Offsite Ads', 'offsite'], ['Marketing', 'Credit for Offsite Ads fee', 'offsite'],
    ['Marketing', 'Etsy Ads', 'ads'], ['Fee', 'Credit for Etsy Ads fee', 'ads'], ['Marketing', 'Etsy Plus subscription fee ($10.00 USD)', 'subscription'],
    ['Shipping', 'USPS shipping label', 'labels'], ['Shipping Label', 'Shipping label', 'labels'], ['Sale', 'Payment for Order #123456', 'sale'],
    ['Refund', 'Refund for Order #123456', 'refund'], ['Tax', 'Sales tax paid by buyer', 'tax'], ['Tax', 'Refund to buyer for sales tax', 'tax'],
    ['Deposit', '$10.00 sent to your bank account', 'deposit'], ['Payment', 'Charge for refund 1', 'payment'], ['Fee', 'Currency conversion fee', 'otherFees'],
    ['Adjustment', 'Something new', 'adjust']
  ];
  cases.forEach(([t, ti, want]) => assert.equal(P.classify(t, ti), want, `${t} / ${ti}`));
  const p = P.parseFiles(read('statement_vat.csv'));
  const t = S.tax(p, { year: 2025 });
  assert.equal(t.source, 'statement'); assert.equal(t.currency, 'EUR');
  const T = t.total;
  near(T.sales, 40, 'sales'); near(T.taxCollected, 3, 'tax collected'); near(T.gross, 37, 'gross ex tax');
  near(T.refunds, 10, 'refunds'); near(T.taxRefunded, 0.75, 'tax refunded'); near(T.refundsNet, 9.25, 'refunds net');
  near(T.cats.transaction, 2.7 - 0.6, 'transaction incl. credit');
  near(T.cats.processing, 1.6 - 0.4, 'processing incl. credit');
  near(T.cats.listing, 0.19 - 0.19, 'listing incl. Etsy Plus credit');
  near(T.cats.regulatory, 0.45, 'regulatory'); near(T.cats.vat, 0.32 + 0.48 + 0.04 + 1.2, 'vat');
  near(T.cats.offsite, 6, 'offsite'); near(T.cats.ads, 5, 'ads'); near(T.cats.subscription, 9.5, 'subscription');
  near(T.cats.labels, 4.1 - 1.1, 'labels incl. credit');
  assert.ok(t.check, 'net equals the sum of the Net column (deposits and card charges excluded)');
  assert.equal(t.depositCount, 1); near(t.payments, 5, 'card charge kept out of net');
  const tx = p.statement.find((r) => r.kind === 'transaction' && r.orderId === '3500000001');
  assert.ok(tx, 'order id found in Info');
});

test('multi-currency: statements and orders are never summed across currencies', () => {
  const p = P.parseFiles(read('statement_two_currencies.csv'));
  const t = S.tax(p, { year: 2026 });
  assert.equal(t.currency, 'USD'); assert.deepEqual(t.otherCurrencies, ['CAD']);
  near(t.total.gross, 50, 'USD only'); near(t.total.cats.processing, 0.85, 'USD fees only');
  const c = S.tax(p, { year: 2026, currency: 'CAD' });
  near(c.total.gross, 50, 'CAD gross'); near(c.total.net, 48.25, 'CAD net');
  const q = P.parseFiles(read('EtsySoldOrders2020-uk.csv', 'orders_refunds.csv'));
  const s = S.compute(q, { year: null });
  assert.equal(s.currency, 'USD'); assert.equal(s.otherCurrencies[0].currency, 'GBP');
  const g = S.compute(q, { year: null, currency: 'GBP' });
  assert.equal(g.orderCount, 2); near(g.sales, 18.5 + 40.5, 'GBP sales');
});

test('semicolon statement with decimal commas and Unicode minus', () => {
  const t = S.tax(P.parseFiles(read('statement_semicolon.csv')), { year: 2026 });
  near(t.total.gross, 1234.5, 'gross'); near(t.total.cats.transaction, 80.24, 'tx'); near(t.total.net, 1234.5 - 80.24 - 41.29, 'net'); assert.ok(t.check);
});

test('dedup: the same files twice count once; HTML entities in titles are decoded', () => {
  const once = P.parseFiles(read('EtsySoldOrders2026.csv', 'etsy_statement_2026_3.csv'));
  const twice = P.parseFiles(read('EtsySoldOrders2026.csv', 'etsy_statement_2026_3.csv', 'EtsySoldOrders2026.csv', 'etsy_statement_2026_3.csv'));
  assert.equal(twice.orders.length, once.orders.length); assert.equal(twice.statement.length, once.statement.length);
  const it = P.parseFiles([{ name: 'EtsySoldOrderItems2026.csv', text: 'Sale Date,Item Name,Quantity,Price,Item Total,Currency,Listing ID,Order ID\n01/02/26,Baby&#39;s first mug &amp; spoon,1,10,10,USD,1,3800000001\n' }]);
  assert.equal(it.items[0].name, "Baby's first mug & spoon");
});

test('full sample shop: stats and statement net agree with the Net column; months add up', () => {
  const names = fs.readdirSync(FX).filter((n) => /^(EtsySold.*202[56]\.csv|etsy_statement_2026_\d+\.csv)$/.test(n));
  const p = P.parseFiles(read(...names));
  const s = S.compute(p, { year: 2026 });
  assert.ok(s.orderCount > 150 && s.itemCount > s.orderCount, `${s.orderCount} orders, ${s.itemCount} items`);
  assert.equal(s.best[0].name, 'Speckled stoneware mug');
  assert.ok(s.peakMonth >= 9, 'holiday peak');
  assert.ok(s.repeat && s.repeat.share > 0.05 && s.repeat.share < 0.5, 'repeat share plausible');
  assert.equal(s.home, 'United States'); assert.ok(s.states.length > 10);
  assert.ok(s.prevOrders > 100, 'year over year');
  const t = S.tax(p, { year: 2026 });
  assert.ok(t.check, 'net matches Net column');
  assert.equal(t.monthsCovered, 11);
  const sum = t.months.reduce((a, m) => a + m.net, 0);
  near(sum, t.total.net, 'months sum to total');
  assert.ok(t.total.cats.labels > 0 && t.total.cats.offsite > 0 && t.total.cats.ads > 0 && t.total.cats.listing > 0);
  near(t.total.gross, t.orders.total.gross, 'statement gross (ex tax) equals orders file sales + shipping');
});

test('zip: only order and statement CSVs are opened', () => {
  assert.equal(P.wantEntry('etsy-2026/EtsySoldOrders2026.csv'), true);
  assert.equal(P.wantEntry('etsy-2026/etsy_statement_2026_1.csv'), true);
  assert.equal(P.wantEntry('etsy-2026/EtsyDeposits2026-1.csv'), false);
  assert.equal(P.wantEntry('__MACOSX/etsy-2026/._EtsySoldOrders2026.csv'), false);
  assert.equal(P.wantEntry('reviews.json'), false);
});
