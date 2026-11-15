/* Year in Review for Etsy sellers: an invented sample shop, written out as the same CSV files Etsy gives sellers.
 * Every product, buyer, address and order here is made up. Seeded, so it is the same on every run.
 * files({ year, endMonth, endDay }) -> [{ name, text }] : orders + order items for year-1 and year,
 * and one monthly statement per month of `year` up to endMonth/endDay. */
(function (root) {
  'use strict';

  var PRODUCTS = [
    ['Speckled stoneware mug', 34, 30], ['Little bud vase, matte white', 22, 22], ['Hand-thrown ramen bowl', 46, 14],
    ['Ceramic spoon rest', 18, 16], ['Stoneware planter with saucer', 52, 9], ['Glazed ring dish', 16, 18],
    ['Pour-over coffee dripper', 58, 7], ['Set of 4 espresso cups', 72, 5]
  ];
  var STATES = [['CA', 14], ['NY', 10], ['TX', 9], ['WA', 7], ['OR', 6], ['IL', 6], ['MA', 5], ['CO', 5], ['FL', 5], ['PA', 4], ['NC', 4], ['MN', 3], ['GA', 3], ['VA', 3], ['MI', 3], ['OH', 2], ['AZ', 2], ['WI', 2], ['NJ', 2], ['VT', 1]];
  var ABROAD = [['Canada', 4], ['United Kingdom', 3], ['Australia', 2], ['Germany', 1]];
  var MONTH_W = [4, 4, 5, 5, 6, 5, 5, 6, 7, 10, 15, 22];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var FIRST = ['Avery', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Quinn', 'Rowan', 'Sasha', 'Taylor', 'Emerson'];
  var LAST = ['Example', 'Sample', 'Placeholder', 'Testwood', 'Demoford'];

  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function weighted(r, list) { var t = 0, i; for (i = 0; i < list.length; i++) t += list[i][list[i].length - 1]; var x = r() * t; for (i = 0; i < list.length; i++) { x -= list[i][list[i].length - 1]; if (x <= 0) return list[i]; } return list[list.length - 1]; }
  function p2(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  function usd(n) { n = Math.round(n * 100) / 100; return (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function q(v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function line(a) { return a.map(q).join(','); }
  function mdy(y, m, d) { return String(m).padStart(2, '0') + '/' + String(d).padStart(2, '0') + '/' + String(y).slice(2); }
  function long(y, m, d) { return MONTHS_LONG[m - 1] + ' ' + d + ', ' + y; }
  var DIM = function (y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

  var ORDER_H = ['Sale Date', 'Order ID', 'Buyer User ID', 'Full Name', 'First Name', 'Last Name', 'Number of Items', 'Payment Method', 'Date Shipped', 'Street 1', 'Street 2', 'Ship City', 'Ship State', 'Ship Zipcode', 'Ship Country', 'Currency', 'Order Value', 'Coupon Code', 'Coupon Details', 'Discount Amount', 'Shipping Discount', 'Shipping', 'Sales Tax', 'Order Total', 'Status', 'Card Processing Fees', 'Order Net', 'Adjusted Order Total', 'Adjusted Card Processing Fees', 'Adjusted Net Order Amount', 'Buyer', 'Order Type', 'Payment Type', 'InPerson Discount', 'InPerson Location', 'SKU'];
  var ITEM_H = ['Sale Date', 'Item Name', 'Buyer', 'Quantity', 'Price', 'Coupon Code', 'Coupon Details', 'Discount Amount', 'Shipping Discount', 'Order Shipping', 'Order Sales Tax', 'Item Total', 'Currency', 'Transaction ID', 'Listing ID', 'Date Paid', 'Date Shipped', 'Ship Name', 'Ship Address1', 'Ship Address2', 'Ship City', 'Ship State', 'Ship Zipcode', 'Ship Country', 'Order ID', 'Variations', 'Order Type', 'Listings Type', 'Payment Type', 'InPerson Discount', 'InPerson Location', 'VAT Paid by Buyer', 'SKU'];
  var STMT_H = ['Date', 'Type', 'Title', 'Info', 'Currency', 'Amount', 'Fees & Taxes', 'Net', 'Tax Details'];

  function shop(year, endMonth, endDay, perYear, seed) {
    var r = rng(seed), orders = [], buyers = [];
    for (var b = 0; b < perYear * 3; b++) {
      var abroad = r() < 0.12, place = abroad ? weighted(r, ABROAD) : weighted(r, STATES);
      buyers.push({ id: String(100000000 + Math.floor(r() * 899999999)), first: FIRST[b % FIRST.length], last: LAST[(b * 7) % LAST.length], country: abroad ? place[0] : 'United States', state: abroad ? '' : place[0] });
    }
    var oid = 3100000000 + seed * 1000, tx = 4100000000 + seed * 10000;
    for (var m = 1; m <= endMonth; m++) {
      var n = Math.round(perYear * MONTH_W[m - 1] / 99 * (0.85 + r() * 0.3));
      var lastDay = m === endMonth ? endDay : DIM(year, m);
      if (m === endMonth) n = Math.round(n * lastDay / DIM(year, m));
      for (var i = 0; i < n; i++) {
        var d = 1 + Math.floor(r() * lastDay);
        if (m === 12 && r() < 0.3) d = Math.min(lastDay, 1 + Math.floor(r() * 10)); // early-December rush
        var buyer = r() < 0.09 && orders.length > 8 ? orders[Math.floor(r() * orders.length)].buyer : buyers[Math.floor(r() * buyers.length)];
        var lines = [], k = 1 + (r() < 0.25 ? 1 : 0) + (r() < 0.08 ? 1 : 0);
        for (var j = 0; j < k; j++) { var p = weighted(r, PRODUCTS); lines.push({ name: p[0], price: p[1], qty: r() < 0.15 ? 2 : 1, listing: 1500000000 + PRODUCTS.indexOf(p), tx: ++tx }); }
        var value = lines.reduce(function (a, x) { return a + x.price * x.qty; }, 0);
        var disc = r() < 0.18 ? Math.round(value * 0.15 * 100) / 100 : 0;
        var ship = buyer.country === 'United States' ? (value - disc >= 35 ? 0 : 6.5) : 18;
        var taxRate = buyer.country === 'United States' ? [0, 0.06, 0.0725, 0.0825, 0.08875][Math.floor(r() * 5)] : 0;
        var salesTax = Math.round((value - disc + ship) * taxRate * 100) / 100;
        var total = Math.round((value - disc + ship + salesTax) * 100) / 100;
        var o = { id: String(++oid), y: year, m: m, d: d, buyer: buyer, lines: lines, value: value, disc: disc, ship: ship, tax: salesTax, total: total, refund: 0, full: false, offsite: r() < 0.07 };
        var rr = r();
        if (rr < 0.012) { o.full = true; o.refund = total; } else if (rr < 0.035) o.refund = Math.round(value * 0.3 * 100) / 100;
        orders.push(o);
      }
    }
    orders.sort(function (a, b) { return a.m - b.m || a.d - b.d; });
    return orders;
  }

  function ordersCSV(orders) {
    var out = [line(ORDER_H)];
    orders.slice().reverse().forEach(function (o) {
      var qty = o.lines.reduce(function (a, x) { return a + x.qty; }, 0), proc = o.total * 0.03 + 0.25;
      var sd = Math.min(DIM(o.y, o.m), o.d + 2);
      out.push(line([mdy(o.y, o.m, o.d), o.id, o.buyer.id, o.buyer.first + ' ' + o.buyer.last, o.buyer.first, o.buyer.last, qty, 'Credit Card', o.full ? '' : mdy(o.y, o.m, sd),
        '123 Sample Street', 'Apt 4', 'Exampleville', o.buyer.state, o.buyer.country === 'United States' ? '00000' : 'X0X 0X0', o.buyer.country, 'USD', p2(o.value),
        o.disc ? 'THANKYOU15' : '', o.disc ? '15% off' : '', p2(o.disc), '0.00', p2(o.ship), p2(o.tax), p2(o.total), o.full ? 'Canceled' : '', p2(proc), p2(o.total - proc),
        o.refund && !o.full ? p2(o.total - o.refund) : '0.00', '0.00', o.refund && !o.full ? p2(o.total - o.refund - proc) : '0.00', o.buyer.first.toLowerCase() + o.buyer.id.slice(-4), 'online', 'online_cc', '', '', '']));
    });
    return out.join('\n') + '\n';
  }

  function itemsCSV(orders) {
    var out = [line(ITEM_H)];
    orders.slice().reverse().forEach(function (o) {
      o.lines.forEach(function (x) {
        out.push(line([mdy(o.y, o.m, o.d), x.name, o.buyer.first.toLowerCase() + o.buyer.id.slice(-4), x.qty, p2(x.price), o.disc ? 'THANKYOU15' : '', o.disc ? '15% off' : '', p2(o.disc), '0.00', p2(o.ship), p2(o.tax), p2(x.price * x.qty), 'USD', x.tx, x.listing,
          mdy(o.y, o.m, o.d).replace(/\/(\d\d)$/, '/20$1'), '', o.buyer.first + ' ' + o.buyer.last, '123 Sample Street', 'Apt 4', 'Exampleville', o.buyer.state, '00000', o.buyer.country, o.id, 'Glaze:Speckled', 'online', 'listing', 'online_cc', '', '', '0', '']));
      });
    });
    return out.join('\n') + '\n';
  }

  function statementCSV(orders, year, month, endDay, r) {
    var rows = [];
    function add(d, type, title, info, amount, fees, net) { rows.push({ d: d, a: [long(year, month, d), type, title, info, 'USD', amount, fees, net, '--'] }); }
    var balance = 0;
    orders.filter(function (o) { return o.y === year && o.m === month; }).forEach(function (o) {
      add(o.d, 'Sale', 'Payment for Order #' + o.id, '', usd(o.total), '--', usd(o.total)); balance += o.total;
      if (o.tax) { add(o.d, 'Tax', 'Sales tax paid by buyer', 'Order #' + o.id, '--', usd(-o.tax), usd(-o.tax)); balance -= o.tax; }
      o.lines.forEach(function (x) {
        var t = Math.round(x.price * x.qty * (1 - (o.disc ? 0.15 : 0)) * 0.065 * 100) / 100;
        add(o.d, 'Fee', 'Transaction fee: ' + x.name, 'Order #' + o.id, '--', usd(-t), usd(-t)); balance -= t;
        add(o.d, 'Fee', 'Listing fee ($0.20 USD)', 'Listing #' + x.listing, '--', '-$0.20', '-$0.20'); balance -= 0.2;
      });
      if (o.ship) { var ts = Math.round(o.ship * 0.065 * 100) / 100; add(o.d, 'Fee', 'Transaction fee: Shipping', 'Order #' + o.id, '--', usd(-ts), usd(-ts)); balance -= ts; }
      var pf = Math.round((o.total * 0.03 + 0.25) * 100) / 100;
      add(o.d, 'Fee', 'Processing fee', 'Order #' + o.id, '--', usd(-pf), usd(-pf)); balance -= pf;
      if (!o.full) { var lab = o.buyer.country === 'United States' ? 4.6 + Math.round(r() * 300) / 100 : 16.4; add(Math.min(endDay, o.d + 1), 'Shipping', 'USPS shipping label', 'Label #' + (9400000000 + +o.id.slice(-6)), '--', usd(-lab), usd(-lab)); balance -= lab; }
      if (o.offsite) { var of = Math.round(o.total * 0.15 * 100) / 100; add(Math.min(endDay, o.d + 2), 'Marketing', 'Fee for sale made through Offsite Ads', 'Order #' + o.id, '--', usd(-of), usd(-of)); balance -= of; }
      if (o.refund) {
        var rd = Math.min(endDay, o.d + 3), share = o.refund / o.total;
        add(rd, 'Refund', (o.full ? 'Refund for Order #' : 'Partial refund for Order #') + o.id, '', usd(-o.refund), '--', usd(-o.refund)); balance -= o.refund;
        if (o.tax) { var tr = Math.round(o.tax * share * 100) / 100; add(rd, 'Tax', 'Refund to buyer for sales tax', 'Order #' + o.id, '--', usd(tr), usd(tr)); balance += tr; }
        var cr = Math.round(pf * share * 100) / 100; add(rd, 'Fee', 'Credit for processing fee', 'Order #' + o.id, '--', usd(cr), usd(cr)); balance += cr;
        var ct = Math.round(o.lines[0].price * o.lines[0].qty * 0.065 * share * 100) / 100;
        add(rd, 'Fee', 'Credit for transaction fee on ' + o.lines[0].name, 'Order #' + o.id, '--', usd(ct), usd(ct)); balance += ct;
      }
    });
    for (var d = 3; d <= endDay; d += 7) {
      var ad = Math.round((month >= 10 ? 4 : 2) * (0.6 + r() * 0.8) * 7 * 100) / 100;
      add(d, 'Marketing', 'Etsy Ads', 'Bill for click-throughs to your shop on ' + MONTHS_LONG[month - 1].slice(0, 3) + ' ' + d + ', ' + year, '--', usd(-ad), usd(-ad)); balance -= ad;
      if (balance > 50) { var dep = Math.floor(balance * 0.9 * 100) / 100; add(Math.min(endDay, d + 2), 'Deposit', usd(dep) + ' sent to your bank account', '', '--', '--', '--'); balance -= dep; }
    }
    for (var l = 0; l < 3; l++) { var ld = 2 + l * 9; if (ld <= endDay) add(ld, 'Fee', 'Listing fee ($0.20 USD)', 'Listing #' + (1500000100 + month * 10 + l), '--', '-$0.20', '-$0.20'); }
    rows.sort(function (a, b) { return b.d - a.d; });
    return [line(STMT_H)].concat(rows.map(function (x) { return line(x.a); })).join('\n') + '\n';
  }

  function files(opts) {
    opts = opts || {};
    var Y = opts.year || new Date().getFullYear(), em = opts.endMonth || 12, ed = opts.endDay || 31;
    ed = Math.min(ed, DIM(Y, em));
    var prev = shop(Y - 1, 12, 31, 190, 7), cur = shop(Y, em, ed, 300, 11);
    var r = rng(99), out = [
      { name: 'EtsySoldOrders' + (Y - 1) + '.csv', text: ordersCSV(prev) },
      { name: 'EtsySoldOrderItems' + (Y - 1) + '.csv', text: itemsCSV(prev) },
      { name: 'EtsySoldOrders' + Y + '.csv', text: ordersCSV(cur) },
      { name: 'EtsySoldOrderItems' + Y + '.csv', text: itemsCSV(cur) }
    ];
    for (var m = 1; m <= em; m++) out.push({ name: 'etsy_statement_' + Y + '_' + m + '.csv', text: statementCSV(cur, Y, m, m === em ? ed : DIM(Y, m), r) });
    return out;
  }

  var api = { files: files, PRODUCTS: PRODUCTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EtsyDemo = api;
})(typeof self !== 'undefined' ? self : this);
