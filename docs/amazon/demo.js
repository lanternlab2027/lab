/* Year in Orders: a made-up order history for the sample deck and the test fixtures.
 * Every product, order number and address here is invented. Output mimics the export's CSV files. */
(function (root) {
  'use strict';

  // name, department, price, weight (how often it shows up), reorder (bought again and again)
  var CATALOG = [
    ['Medium roast whole bean coffee, 2 lb bag', 'Grocery & Gourmet Food', 21.49, 0, 1],
    ['Dry dog food, chicken and rice, 30 lb', 'Pet Supplies', 54.99, 0, 1],
    ['Paper towels, 12 double rolls', 'Health & Household', 28.79, 0, 1],
    ['Unscented dish soap, pack of 3', 'Health & Household', 11.97, 3, 0],
    ['USB-C charging cable, 6 ft, 2-pack', 'Electronics', 12.99, 4, 0],
    ['Paperback novel: The Lighthouse Ledger', 'Books', 15.3, 3, 0],
    ['Hardcover cookbook: Weeknight Skillets', 'Books', 24.5, 2, 0],
    ['Rope chew toys for dogs, set of 4', 'Pet Supplies', 13.99, 3, 0],
    ['Glass meal-prep containers, 10-pack', 'Home & Kitchen', 32.99, 2, 0],
    ['Linen throw pillow covers, set of 2', 'Home & Kitchen', 19.99, 2, 0],
    ['Wireless mouse, quiet click', 'Electronics', 18.99, 2, 0],
    ['Gel pens, assorted colors, 24 count', 'Office Products', 9.49, 3, 0],
    ['Printer paper, 500 sheets', 'Office Products', 8.99, 3, 0],
    ['Wool hiking socks, 3 pairs', 'Clothing, Shoes & Jewelry', 22.95, 2, 0],
    ['Rain jacket, packable', 'Clothing, Shoes & Jewelry', 64.0, 1, 0],
    ['1000-piece jigsaw puzzle, harbor at dusk', 'Toys & Games', 17.99, 2, 0],
    ['Card game for 2 to 6 players', 'Toys & Games', 14.99, 2, 0],
    ['AA batteries, 24 pack', 'Electronics', 16.49, 3, 0],
    ['Stainless steel water bottle, 32 oz', 'Sports & Outdoors', 26.95, 2, 0],
    ['Resistance bands, set of 5', 'Sports & Outdoors', 21.99, 1, 0],
    ['Vitamin D3 gummies, 120 count', 'Health & Household', 13.49, 2, 0],
    ['LED desk lamp with dimmer', 'Home & Kitchen', 36.99, 1, 0],
    ['Cast iron skillet, 12 inch', 'Home & Kitchen', 29.9, 1, 0],
    ['Phone case, clear', 'Electronics', 11.99, 2, 0],
    ['Houseplant potting mix, 8 qt', 'Patio, Lawn & Garden', 10.99, 2, 0],
    ['Kids art smock and paint set', 'Toys & Games', 23.99, 1, 0],
    ['Noise-cancelling headphones', 'Electronics', 179.99, 0, 0],
    ['Standing desk frame, dual motor', 'Office Products', 329.99, 0, 0],
    ['Monitor arm, single', 'Office Products', 45.99, 0, 0]
  ];
  var EBOOKS = [['Kindle edition: Tidewater Summer', 4.99], ['Kindle edition: A Field Guide to Small Birds', 9.99], ['Kindle edition: The Quiet Orchard', 2.99], ['Rented movie: The Harbor Run', 5.99]];
  var TAX = 0.07;

  function rng(seed) { var s = seed >>> 0 || 7; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function pad(n, w) { return String(n).padStart(w || 2, '0'); }
  function q(v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function csv(header, rows) { return '\ufeff' + [header].concat(rows).map(function (r) { return r.map(q).join(','); }).join('\r\n') + '\r\n'; }
  function money(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  function iso(d, ms) { var s = d.toISOString(); return ms ? s : s.replace(/\.\d{3}Z$/, 'Z'); }
  function asinOf(i) { return 'B0' + pad((i * 7919 + 12345) % 100000000, 8).replace(/^(\d{8})$/, '$1').slice(0, 8); }

  // Builds the orders for one year. Returns { orders: [{ id, date(Date), lines: [{ c, qty }] , status }], refunds }
  function makeYear(year, endMonth, endDay, seed, scale) {
    var R = rng(seed), orders = [], n = 0;
    var weights = [];
    CATALOG.forEach(function (c, i) { for (var k = 0; k < c[3]; k++) weights.push(i); });
    var monthBoost = [0.8, 0.7, 0.9, 0.9, 1.0, 0.9, 1.6, 0.9, 1.0, 1.1, 1.5, 1.9];
    function oid() { n++; return '1' + pad(Math.floor(R() * 99), 2) + '-' + pad(Math.floor(R() * 1e7), 7) + '-' + pad(Math.floor(R() * 1e7), 7); }
    function at(mo, d, h, mi) { return new Date(year, mo - 1, d, h, mi, Math.floor(R() * 60)); }
    function inRange(mo, d) { return mo < endMonth || (mo === endMonth && d <= endDay); }
    for (var mo = 1; mo <= 12; mo++) {
      var dim = new Date(year, mo, 0).getDate();
      var k = Math.round((6 + R() * 2) * monthBoost[mo - 1] * (scale || 1));
      for (var j = 0; j < k; j++) {
        var d = 1 + Math.floor(R() * dim);
        if (!inRange(mo, d)) continue;
        var hr = R() < 0.1 ? Math.floor(R() * 4) : 7 + Math.floor(R() * 16);
        var lines = [], nl = R() < 0.72 ? 1 : R() < 0.8 ? 2 : 3;
        for (var l = 0; l < nl; l++) {
          var ci = weights[Math.floor(R() * weights.length)];
          if (!lines.some(function (x) { return x.c === ci; })) lines.push({ c: ci, qty: R() < 0.12 ? 2 : 1 });
        }
        orders.push({ id: oid(), date: at(mo, d, hr, Math.floor(R() * 60)), lines: lines, status: R() < 0.03 ? 'Cancelled' : 'Closed' });
      }
      // the regulars: coffee about monthly, dog food every other month, paper towels quarterly
      if (inRange(mo, 9)) orders.push({ id: oid(), date: at(mo, 9, 8, 15), lines: [{ c: 0, qty: 1 }], status: 'Closed' });
      if (mo % 2 === 1 && inRange(mo, 20)) orders.push({ id: oid(), date: at(mo, 20, 19, 40), lines: [{ c: 1, qty: 1 }], status: 'Closed' });
      if (mo % 3 === 2 && inRange(mo, 14)) orders.push({ id: oid(), date: at(mo, 14, 21, 5), lines: [{ c: 2, qty: 1 }], status: 'Closed' });
    }
    // a big one, a 2am one, and a busy day
    if (inRange(11, 3)) orders.push({ id: oid(), date: at(11, 3, 22, 48), lines: [{ c: 27, qty: 1 }, { c: 28, qty: 1 }, { c: 21, qty: 1 }], status: 'Closed' });
    if (inRange(3, 12)) orders.push({ id: oid(), date: at(3, 12, 2, 7), lines: [{ c: 26, qty: 1 }], status: 'Closed' });
    if (inRange(7, 16)) { [9, 10, 13, 15].forEach(function (h, i) { orders.push({ id: oid(), date: at(7, 16, h, 5 + i * 11), lines: [{ c: weights[Math.floor(R() * weights.length)], qty: 1 }], status: 'Closed' }); }); }
    orders.sort(function (a, b) { return a.date - b.date; });
    // refunds: a few returned items
    var refunds = [];
    orders.forEach(function (o, i) {
      if (o.status !== 'Closed' || !(i % 17 === 5)) return;
      var ln = o.lines[0], c = CATALOG[ln.c];
      refunds.push({ id: o.id, amount: c[2] * ln.qty * (1 + TAX), date: new Date(o.date.getTime() + 9 * 86400000), qty: ln.qty });
    });
    return { orders: orders, refunds: refunds };
  }

  var NEW_HEADER = ['ASIN', 'Billing Address', 'Carrier Name & Tracking Number', 'Currency', 'Department', 'Gift Message', 'Gift Recipient Contact', 'Gift Sender Name', 'Item Serial Number', 'Order Date', 'Order ID', 'Order Status', 'Original Quantity', 'Payment Method Type', 'Product Condition', 'Product Name', 'Purchase Order Number', 'Ship Date', 'Shipment Item Subtotal', 'Shipment Item Subtotal Tax', 'Shipment Status', 'Shipping Address', 'Shipping Charge', 'Shipping Option', 'Total Amount', 'Total Discounts', 'Unit Price', 'Unit Price Tax', 'Website'];
  var CLASSIC_HEADER = ['Website', 'Order ID', 'Order Date', 'Purchase Order Number', 'Currency', 'Unit Price', 'Unit Price Tax', 'Shipping Charge', 'Total Discounts', 'Total Owed', 'Shipment Item Subtotal', 'Shipment Item Subtotal Tax', 'ASIN', 'Product Condition', 'Quantity', 'Payment Instrument Type', 'Order Status', 'Shipment Status', 'Ship Date', 'Shipping Option', 'Shipping Address', 'Billing Address', 'Carrier Name & Tracking Number', 'Product Name', 'Gift Message', 'Gift Sender Name', 'Gift Recipient Contact Details'];
  var ADDRESS = 'Sam Example 123 Sample Street APT 4 SPRINGFIELD ZZ 00000 United States';
  var PAYMENT = 'Visa - 0000';

  function lineValues(o, ln, cur) {
    var c = CATALOG[ln.c], up = c[2], tax = Math.round(up * TAX * 100) / 100, tot = (up + tax) * ln.qty;
    var cancelled = o.status === 'Cancelled';
    return {
      asin: asinOf(ln.c), name: c[0], dept: c[1], qty: cancelled ? 0 : ln.qty, up: money(up), tax: money(tax),
      total: money(cancelled ? 0 : tot), sub: money(up * ln.qty), subTax: money(tax * ln.qty), cur: cur || 'USD',
      ship: iso(new Date(o.date.getTime() + 30 * 3600000), true)
    };
  }

  // opts: { year, endMonth, endDay, layout: 'new' | 'classic', years: how many years back (default 2), currency }
  function files(opts) {
    opts = opts || {};
    var Y = opts.year || 2026, layout = opts.layout || 'new', back = opts.years == null ? 2 : opts.years;
    var all = { orders: [], refunds: [] };
    for (var y = Y - back + 1; y <= Y; y++) {
      var r = makeYear(y, y === Y ? (opts.endMonth || 12) : 12, y === Y ? (opts.endDay || 31) : 31, 1000 + y * 7 + (opts.seed || 0), y === Y ? 1 : 0.85);
      all.orders = all.orders.concat(r.orders); all.refunds = all.refunds.concat(r.refunds);
    }
    all.orders.sort(function (a, b) { return b.date - a.date; }); // newest first, like the export
    var cur = opts.currency || 'USD', out = [], rows = [];
    all.orders.forEach(function (o) {
      o.lines.forEach(function (ln) {
        var v = lineValues(o, ln, cur);
        if (layout === 'new') {
          rows.push([v.asin, ADDRESS, 'AMZN_US(TBA000000000000)', v.cur, v.dept, 'Not Available', 'Not Available', 'Not Available', 'Not Available', iso(o.date, false), o.id, o.status, v.qty, PAYMENT, 'New', v.name, 'Not Applicable', v.ship, v.sub, v.subTax, o.status === 'Cancelled' ? 'Not Available' : 'Shipped', ADDRESS, '0', 'std-us', v.total, "'0'", v.up, v.tax, 'Amazon.com']);
        } else {
          rows.push(['Amazon.com', o.id, iso(o.date, true), 'Not Applicable', v.cur, v.up, v.tax, '0', "'0'", v.total, v.sub, v.subTax, v.asin, 'New', v.qty, PAYMENT, o.status, o.status === 'Cancelled' ? 'Not Available' : 'Shipped', v.ship, 'std-us', ADDRESS, ADDRESS, 'AMZN_US(TBA000000000000)', v.name, 'Not Available', 'Not Available', 'Not Available']);
        }
      });
    });
    var refundRows;
    if (layout === 'new') {
      out.push({ name: 'Your Amazon Orders/Order History.csv', text: csv(NEW_HEADER, rows) });
      refundRows = all.refunds.map(function (r) { return [iso(r.date, true), cur, '0', 'Refund', r.id, 'Completed', r.qty, money(r.amount), iso(new Date(r.date.getTime() + 86400000), true), 'Not Applicable', 'Customer return', 'Not Applicable', 'Amazon.com']; });
      out.push({ name: 'Your Returns & Refunds/Refund Details.csv', text: csv(['Creation Date', 'Currency', 'Direct Debit Refund Amount', 'Disbursement Type', 'Order ID', 'Payment Status', 'Quantity', 'Refund Amount', 'Refund Date', 'Reversal Amount State', 'Reversal Reason', 'Reversal Status', 'Website'], refundRows) });
      var R = rng(99), drows = [];
      EBOOKS.forEach(function (e, i) {
        var d = new Date(Y, 1 + i * 2, 3 + i * 5, 21, 30), id = 'D01-' + pad(1000000 + i * 37, 7) + '-' + pad(2000000 + i * 91, 7), tax = Math.round(e[1] * TAX * 100) / 100;
        if (d.getMonth() + 1 > (opts.endMonth || 12)) return;
        [['Price Amount', e[1]], ['Tax', tax]].forEach(function (comp) {
          drows.push(['B0D' + pad(i, 7), comp[0], iso(d, true), 'D' + pad(i, 9), e[0], id, '1', money(comp[1]), cur, 'Not Applicable', 'SUCCESS', ADDRESS]);
        });
        R();
      });
      // a free e-book (zero amount) that must not count as an order
      drows.push(['B0DFREE0001', 'Price Amount', iso(new Date(Y, 0, 4, 10, 0), true), 'D999999999', 'Kindle edition: Free Classic Poems', 'D01-9999999-9999999', '1', '0.00', cur, 'Not Applicable', 'SUCCESS', ADDRESS]);
      out.push({ name: 'Your Amazon Orders/Digital Content Orders.csv', text: csv(['ASIN', 'Component Type', 'Order Date', 'Digital Order Item ID', 'Product Name', 'Order ID', 'Quantity Ordered', 'Transaction Amount', 'Base Currency Code', 'Payment Information', 'Order Status', 'Shipping Address'], drows) });
    } else {
      out.push({ name: 'Retail.OrderHistory.1/Retail.OrderHistory.1.csv', text: csv(CLASSIC_HEADER, rows) });
      refundRows = all.refunds.map(function (r) { return [r.id, 'Customer return', money(r.amount), cur, 'Completed', iso(new Date(r.date.getTime() + 86400000), true), 'Refund']; });
      out.push({ name: 'Retail.OrdersReturned.Payments.1/Retail.OrdersReturned.Payments.1.csv', text: csv(['OrderID', 'ReversalReason', 'AmountRefunded', 'Currency', 'Status', 'RefundCompletionDate', 'DisbursementType'], refundRows) });
    }
    return out;
  }

  var api = { files: files, CATALOG: CATALOG, NEW_HEADER: NEW_HEADER, CLASSIC_HEADER: CLASSIC_HEADER, ADDRESS: ADDRESS, PAYMENT: PAYMENT, csv: csv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AmazonDemo = api;
})(typeof self !== 'undefined' ? self : this);
