// Unit tests for docs/amazon/parser.js, stats.js and cards.js build().
// Run: TZ=America/New_York node --test bots/amazon/test_parser.js
// Fixtures are synthetic (bots/amazon/make_fixtures.js); every product and order is invented.
process.env.TZ = process.env.TZ || 'America/New_York';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('../../docs/amazon/parser.js');
const S = require('../../docs/amazon/stats.js');
const D = require('../../docs/amazon/demo.js');
const C = require('../../docs/amazon/cards.js');
const JSZip = require('../../docs/amazon/vendor/jszip-3.10.1.min.js');
const FX = path.join(__dirname, 'fixtures');
const read = (f) => fs.readFileSync(path.join(FX, f), 'utf8');
const one = (f) => P.parseFiles([{ name: f, text: read(f) }]);
const TODAY = new Date('2026-11-14T12:00:00').getTime();
async function unzip(f) {
  const z = await JSZip.loadAsync(fs.readFileSync(path.join(FX, f)));
  const out = [], skipped = [];
  const names = Object.keys(z.files).filter((n) => !z.files[n].dir);
  for (const n of names) { if (P.wantEntry(n)) out.push({ name: n, text: await z.files[n].async('string') }); else skipped.push(n); }
  return { files: out, skipped };
}

test('CSV: BOM, CRLF, quoted commas and doubled quotes', () => {
  assert.deepEqual(P.parseCSV('\ufeffOrder ID,Product Name\r\n1,"Desk fan, 12"""\r\n'), [['Order ID', 'Product Name'], ['1', 'Desk fan, 12"']]);
  assert.deepEqual(P.parseCSV('a;b\n1;2\n'), [['a', 'b'], ['1', '2']]);
});

test('money: symbols, thousands, quotes, decimal commas, negatives, Not Available', () => {
  const cases = [['12.99', 12.99], ['$1,234.56', 1234.56], ["'-69'", -69], ["'0'", 0], ['1.234,56', 1234.56], ['12,99', 12.99], ['1,000', 1000],
    ['(5.00)', -5], ['USD 7.50', 7.5], ['-3.20', -3.2], ['\u20ac 9,50', 9.5], ['\u00a31,299.00', 1299]];
  for (const [inp, out] of cases) assert.equal(P.parseMoney(inp), out, inp);
  for (const n of ['Not Available', 'Not Applicable', '', 'n/a', 'abc']) assert.equal(P.parseMoney(n), null, n);
});

test('dates: ISO UTC with and without millis, offsets, US slash dates, month names; bad dates rejected', () => {
  const t = Date.UTC(2026, 2, 14, 18, 22, 31);
  assert.deepEqual(P.parseWhen('2026-03-14T18:22:31Z'), { ts: t, timed: true });
  assert.deepEqual(P.parseWhen('2026-03-14T18:22:31.000Z'), { ts: t, timed: true });
  assert.deepEqual(P.parseWhen('2026-03-14 18:22:31 UTC'), { ts: t, timed: true });
  assert.deepEqual(P.parseWhen('2026-03-14T13:22:31-05:00'), { ts: t, timed: true });
  assert.deepEqual(P.parseWhen('2026-03-14T18:22:31Z and 2026-03-15T01:00:00Z'), { ts: t, timed: true });
  const noon = new Date(2026, 2, 14, 12).getTime();
  assert.deepEqual(P.parseWhen('03/14/2026'), { ts: noon, timed: false });
  assert.deepEqual(P.parseWhen('3/14/26'), { ts: noon, timed: false });
  assert.deepEqual(P.parseWhen('14/03/2026'), { ts: noon, timed: false });
  assert.deepEqual(P.parseWhen('Mar 14, 2026'), { ts: noon, timed: false });
  assert.deepEqual(P.parseWhen('14 March 2026'), { ts: noon, timed: false });
  assert.deepEqual(P.parseWhen('2026-03-14'), { ts: noon, timed: false });
  for (const bad of ['2026-02-30T00:00:00Z', 'Not Available', '', 'yesterday', '13/13/2026']) assert.equal(P.parseWhen(bad), null, bad);
});

test('header alias map: both layouts, legacy report, reordered and renamed columns', () => {
  const n = P.columns(D.NEW_HEADER, P.ALIASES), c = P.columns(D.CLASSIC_HEADER, P.ALIASES);
  assert.equal(D.NEW_HEADER[n.total], 'Total Amount');
  assert.equal(D.NEW_HEADER[n.qty], 'Original Quantity');
  assert.equal(D.NEW_HEADER[n.category], 'Department');
  assert.equal(D.CLASSIC_HEADER[c.total], 'Total Owed');
  assert.equal(D.CLASSIC_HEADER[c.qty], 'Quantity');
  assert.equal(c.category, -1);
  const legacy = P.columns(['Order Date', 'Order ID', 'Title', 'Category', 'ASIN/ISBN', 'Purchase Price Per Unit', 'Quantity', 'Item Total'], P.ALIASES);
  assert.deepEqual([legacy.product, legacy.asin, legacy.unitPrice, legacy.total, legacy.category], [2, 4, 5, 7, 3]);
  // case, spacing and punctuation do not matter
  assert.equal(P.columns(['ORDER_ID', ' order date ', 'Product-Name', 'TOTAL OWED'], P.ALIASES).total, 3);
  // the mint-amazon-tagger quirk: a stray quote in the Website header
  assert.equal(P.columns(['Website"', 'Order ID'], P.ALIASES).site, 0);
  assert.equal(P.kindOf(D.NEW_HEADER, 'Order History.csv'), 'orders');
  assert.equal(P.kindOf(D.CLASSIC_HEADER, 'Retail.OrderHistory.1.csv'), 'orders');
  assert.equal(P.kindOf(['Order ID', 'Refund Amount', 'Refund Date', 'Payment Status'], 'Refund Details.csv'), 'refunds');
  assert.equal(P.kindOf(['OrderID', 'AmountRefunded', 'Status', 'RefundCompletionDate', 'Currency'], 'Retail.OrdersReturned.Payments.1.csv'), 'refunds');
  assert.equal(P.kindOf(['Title', 'Date'], 'NetflixViewingHistory.csv'), null);
});

test('reordered columns, quoted amounts, cancelled lines and the unit-price fallback', () => {
  const a = one('aliases_reordered.csv');
  assert.equal(a.cancelled, 1);
  assert.deepEqual(a.items.map((x) => [x.name, x.qty, x.total]), [['Desk fan, 12"', 2, 1049.98], ['Sticky notes', 1, 4.99], ['Lamp with no total', 2, 0]]);
  const u = one('unit_price_only.csv');
  // (10.00 + 0.80) x 2 + 4.99 shipping - 2.00 discount
  assert.equal(u.items[0].total, 24.59);
  assert.equal(u.items[0].qty, 2);
});

test('privacy: address, payment, gift and tracking columns are never copied out', () => {
  const p = P.parseFiles(D.files({ year: 2026, endMonth: 11, endDay: 13 }));
  const blob = JSON.stringify(p);
  assert.ok(!blob.includes('Sample Street') && !blob.includes('Visa') && !blob.includes('TBA000') && !blob.includes('Sam Example'), 'sensitive values leaked into parsed output');
  const keys = new Set(); p.items.forEach((x) => Object.keys(x).forEach((k) => keys.add(k)));
  assert.deepEqual([...keys].sort(), ['asin', 'category', 'currency', 'id', 'kind', 'name', 'orderId', 'qty', 'src', 'status', 'timed', 'total', 'ts'].sort());
  const r = one('aliases_reordered.csv');
  assert.ok(!JSON.stringify(r).includes('Secret Lane'));
});

test('newer layout zip: orders + refunds + digital; other files skipped unopened', async () => {
  const { files, skipped } = await unzip('Your Orders.zip');
  assert.deepEqual(files.map((f) => f.name).sort(), ['Your Amazon Orders/Digital Content Orders.csv', 'Your Amazon Orders/Order History.csv', 'Your Returns & Refunds/Refund Details.csv']);
  assert.ok(skipped.includes('Account/Profile/Addresses.csv') && skipped.includes('Retail.CustomerProfile/Payment Instruments.csv') && skipped.includes('Your Amazon Orders/Cart History.csv') && skipped.includes('Your Returns & Refunds/Returns Status.csv'));
  const p = P.parseFiles(files);
  assert.deepEqual(p.files.map((f) => f.kind).sort(), ['digital', 'orders', 'refunds']);
  assert.ok(p.timed && p.hasCategory);
  assert.equal(p.freeDigital, 1);
  const dig = p.items.filter((x) => x.kind === 'digital');
  assert.equal(dig.length, 4);
  // price component + tax component are summed per digital item
  assert.equal(dig.find((x) => /Tidewater/.test(x.name)).total, 5.34);
});

test('classic layout zip: same physical orders as the newer layout, no categories', async () => {
  const pc = P.parseFiles((await unzip('classic-export.zip')).files);
  const pn = P.parseFiles((await unzip('Your Orders.zip')).files);
  assert.equal(pc.hasCategory, false);
  const sc = S.compute(pc, { year: 2026, today: TODAY }), sn = S.compute(pn, { year: 2026, today: TODAY, digital: false });
  assert.equal(sc.orderCount, sn.orderCount);
  assert.equal(sc.gross, sn.gross);
  assert.equal(sc.refundTotal, sn.refundTotal);
  assert.equal(sc.categories, null);
  assert.ok(sn.categories && sn.categories.length >= 5);
});

test('refunds: matched to orders in the period, net = gross - refunds; pending refunds ignored', () => {
  const orders = 'Order ID,Order Date,Product Name,Quantity,Total Owed,Currency\nA,2026-02-01T15:00:00Z,Kettle,1,40.00,USD\nB,2026-03-01T15:00:00Z,Mug,1,10.00,USD\nOLD,2025-12-30T15:00:00Z,Old thing,1,99.00,USD\n';
  const refunds = 'Order ID,Refund Amount,Refund Date,Payment Status,Currency\nA,40.00,2026-02-10T00:00:00Z,Completed,USD\nB,10.00,2026-03-10T00:00:00Z,Pending,USD\nOLD,99.00,2026-01-05T00:00:00Z,Completed,USD\n';
  const p = P.parseFiles([{ name: 'Order History.csv', text: orders }, { name: 'Refund Details.csv', text: refunds }]);
  assert.equal(p.pendingRefunds, 1);
  const s = S.compute(p, { year: 2026, today: TODAY });
  assert.deepEqual([s.gross, s.refundTotal, s.net, s.refundOrders], [50, 40, 10, 1]);
  const s25 = S.compute(p, { year: 2025, today: TODAY });
  assert.deepEqual([s25.gross, s25.refundTotal, s25.net], [99, 99, 0]);
  const noRefundFile = S.compute(P.parseFiles([{ name: 'Order History.csv', text: orders }]), { year: 2026, today: TODAY });
  assert.equal(noRefundFile.hasRefundFile, false);
  assert.equal(noRefundFile.net, 50);
});

test('currency: two marketplaces stay separate; the bigger one is the default; decimal-comma files', async () => {
  const p = P.parseFiles((await unzip('two-marketplaces.zip')).files);
  const s = S.compute(p, { year: 2026, today: TODAY });
  assert.equal(s.currency, 'USD');
  assert.equal(s.otherCurrencies.length, 1);
  assert.equal(s.otherCurrencies[0].currency, 'CAD');
  assert.ok(s.items.every((x) => x.currency === 'USD'));
  const cad = S.compute(p, { year: 2026, currency: 'CAD', today: TODAY });
  assert.equal(cad.currency, 'CAD');
  assert.ok(cad.orderCount > 0 && cad.orderCount < s.orderCount);
  const eu = S.compute(one('eu_amounts.csv'), { year: 2026, today: TODAY });
  assert.deepEqual([eu.currency, eu.gross], ['EUR', 1247.49]);
  assert.equal(C.money(1234.5, 'EUR', true), '\u20ac1,234.50');
});

test('multiple years: year list, per-year stats, all time, previous-year comparison', () => {
  const p = P.parseFiles(D.files({ year: 2026, endMonth: 11, endDay: 13, years: 3 }));
  const ys = S.years(p.items).map((y) => y.year);
  assert.deepEqual(ys, [2026, 2025, 2024]);
  const s26 = S.compute(p, { year: 2026, today: TODAY }), s25 = S.compute(p, { year: 2025, today: TODAY }), all = S.compute(p, { year: null, today: TODAY });
  assert.ok(s26.items.every((x) => new Date(x.ts).getFullYear() === 2026));
  assert.equal(s26.prevGross, s25.gross);
  assert.equal(s26.firstYear, 2024);
  assert.ok(Math.abs(all.gross - (s26.gross + s25.gross + S.compute(p, { year: 2024, today: TODAY }).gross)) < 0.02);
  assert.deepEqual(Object.keys(all.byYear).map(Number), [2024, 2025, 2026]);
  const old = S.years(one('old_order_report.csv').items).map((y) => y.year);
  assert.deepEqual(old, [2025, 2023, 2022]);
});

test('dedup: the same export uploaded twice (zip + csv) counts once', async () => {
  const { files } = await unzip('Your Orders.zip');
  const once = P.parseFiles(files), twice = P.parseFiles(files.concat([{ name: 'Order History.csv', text: read('Order History.csv') }, { name: 'Refund Details.csv', text: read('Refund Details.csv') }]));
  assert.equal(twice.items.length, once.items.length);
  assert.equal(twice.refunds.length, once.refunds.length);
});

test('stats: biggest order, busiest month/day, re-order, late night, average, cadence', () => {
  const p = P.parseFiles(D.files({ year: 2026, endMonth: 11, endDay: 13 }));
  const s = S.compute(p, { year: 2026, today: TODAY });
  assert.equal(s.biggest.lines.length, 3);
  assert.ok(s.biggest.lines.some((l) => /Standing desk/.test(l.name)));
  assert.equal(s.peakMonth, s.monthSpend.indexOf(Math.max(...s.monthSpend)));
  assert.equal(s.busiestDay.orders, Math.max(...Object.values(s.perDay).map((d) => d.orders)));
  assert.match(s.reorder.name, /coffee/i);
  assert.ok(s.reorder.times >= 10);
  assert.ok(s.late.count >= 1 && s.late.latest.min < 300);
  assert.equal(s.avgOrder, Math.round(s.gross / s.orderCount * 100) / 100);
  assert.ok(s.everyDays > 1 && s.everyDays < 7);
  // date-only files have no times, so no late-night stats
  const old = S.compute(one('old_order_report.csv'), { year: 2025, today: TODAY });
  assert.equal(old.late, null);
});

test('cards: deck by layout; categories only when the export has them; names only on opt-in', () => {
  const pn = P.parseFiles(D.files({ year: 2026, endMonth: 11, endDay: 13 }));
  const pc = P.parseFiles(D.files({ year: 2026, endMonth: 11, endDay: 13, layout: 'classic' }));
  const ids = (p) => C.build(S.compute(p, { year: 2026, today: TODAY }), { year: 2026, periodShort: '2026', title: 'x' }).map((c) => c.id);
  assert.deepEqual(ids(pn), ['total', 'cadence', 'biggest', 'when', 'categories', 'reorder', 'late', 'average', 'receipt']);
  assert.deepEqual(ids(pc), ['total', 'cadence', 'biggest', 'when', 'reorder', 'late', 'average', 'receipt']);
  const tiny = P.parseFiles([{ name: 'o.csv', text: 'Order ID,Order Date,Product Name,Quantity,Total Owed\n1,2026-05-01,Thing,1,5.00\n' }]);
  assert.deepEqual(C.build(S.compute(tiny, { year: 2026, today: TODAY }), { year: 2026, periodShort: '2026', title: 'x' }).map((c) => c.id), ['total', 'biggest', 'when', 'receipt']);
  // card source never reads names unless showNames is set (checked by drawing with a recording context)
  const s = S.compute(pn, { year: 2026, today: TODAY });
  const drawn = (showNames) => {
    const texts = [];
    const PROPS = new Set(['font', 'fillStyle', 'strokeStyle', 'globalAlpha', 'textAlign', 'textBaseline', 'lineWidth', 'letterSpacing', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY']);
    const ctx = new Proxy({}, {
      get: (t, k) => PROPS.has(k) ? t[k] : k === 'fillText' ? (str) => texts.push(String(str)) : k === 'measureText' ? (str) => ({ width: String(str).length * 20 })
        : /Gradient$/.test(String(k)) ? () => ({ addColorStop() {} }) : () => {},
      set: (t, k, v) => { t[k] = v; return true; }
    });
    const info = { year: 2026, periodShort: '2026', title: 'x', showNames };
    C.build(s, info).forEach((c) => c.draw(ctx, C.THEMES[c.theme]));
    return texts.join(' | ');
  };
  const hidden = drawn(false), shown = drawn(true);
  assert.ok(!/coffee|Standing desk/i.test(hidden), 'item names drawn without opt-in');
  assert.ok(/NAME HIDDEN/.test(hidden));
  assert.ok(/coffee/i.test(shown) && /Standing desk/.test(shown));
});

test('not an order file / empty export', () => {
  const n = one('not_amazon.csv');
  assert.equal(n.items.length, 0);
  assert.deepEqual(n.ignored, ['not_amazon.csv']);
  const e = one('empty_orders.csv');
  assert.equal(e.items.length, 0);
  assert.equal(e.files[0].kind, 'orders');
});

test('old "Orders and shipments" summary report: order totals only, never address/payment columns', () => {
  const header = read('old_orders_summary.csv').split('\n')[0].split(',');
  assert.equal(P.kindOf(header, '01-Jan-2022_to_31-Dec-2023.csv'), 'summary');
  const p = one('old_orders_summary.csv');
  assert.deepEqual(p.files.map((f) => f.kind), ['summary']);
  assert.equal(p.summaryOnly, true);
  assert.equal(p.cancelled, 1);
  assert.equal(p.hasCategory, false);
  assert.ok(p.items.every((x) => x.noItems && x.currency === 'USD' && x.asin === '' && x.category === ''));
  // two shipments of one order are one order; a blank Total Charged falls back to subtotal + shipping + tax - promotions
  const s22 = S.compute(p, { year: 2022, today: TODAY });
  assert.deepEqual([s22.orderCount, s22.gross, s22.itemCount, s22.noItems], [2, 144.45, null, true]);
  assert.equal(s22.biggest.total, 128.4);
  assert.equal(s22.biggest.lines.length, 2);
  assert.equal(s22.reorder, null);
  assert.equal(s22.topItem, null);
  assert.equal(s22.late, null);
  assert.deepEqual(S.years(p.items).map((y) => [y.year, y.orders]), [[2023, 2], [2022, 2]]);
  // privacy: nothing from the payment, email, address, tracking or buyer columns
  const blob = JSON.stringify(p);
  for (const bad of ['Visa', 'MasterCard', 'Gift Certificate', 'example.invalid', 'Secret Lane', 'HIDDEN TOWN', '07999-1234', 'TBA000', '1Z000', 'Sam Example']) assert.ok(!blob.includes(bad), bad + ' leaked');
  // cards: no item counts or re-order card, and the receipt lines say "Shipment" without a name toggle
  const ids = C.build(s22, { year: 2022, periodShort: '2022', title: 'x' }).map((c) => c.id);
  assert.ok(!ids.includes('reorder') && !ids.includes('categories') && ids.includes('total') && ids.includes('biggest'));
  const texts = [];
  const PROPS = new Set(['font', 'fillStyle', 'strokeStyle', 'globalAlpha', 'textAlign', 'textBaseline', 'lineWidth', 'letterSpacing', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY']);
  const ctx = new Proxy({}, {
    get: (t, k) => PROPS.has(k) ? t[k] : k === 'fillText' ? (str) => texts.push(String(str)) : k === 'measureText' ? (str) => ({ width: String(str).length * 20 })
      : /Gradient$/.test(String(k)) ? () => ({ addColorStop() {} }) : () => {},
    set: (t, k, v) => { t[k] = v; return true; }
  });
  C.build(s22, { year: 2022, periodShort: '2022', title: 'x' }).forEach((c) => c.draw(ctx, C.THEMES[c.theme]));
  const all = texts.join(' | ');
  assert.ok(/Shipment 1/.test(all) && !/null|undefined|NaN/.test(all), 'card text: ' + all.slice(0, 200));
  assert.ok(!/NAME HIDDEN/.test(all));
});

test('old summary report next to the old Items report: item lines win, summary only fills uncovered orders', () => {
  const p = P.parseFiles([{ name: 'items.csv', text: read('old_order_report.csv') }, { name: 'orders.csv', text: read('old_orders_summary.csv') }]);
  assert.equal(p.summaryOnly, false);
  // 113-0000000-0000002 is in both files: counted once, from the Items report
  const both = p.items.filter((x) => x.orderId === '113-0000000-0000002');
  assert.equal(both.length, 1);
  assert.equal(both[0].name, 'Old toaster');
  const s23 = S.compute(p, { year: 2023, today: TODAY });
  assert.deepEqual([s23.orderCount, s23.gross, s23.itemCount], [2, 42.77, 1]);
});
