/* Year in Orders: parser for the order files in Amazon's "Request Your Data" export.
 * Pure functions; no network, no storage. Runs in the browser and in Node (tests).
 *
 * Two export layouts are known (column names are UNVERIFIED against a real export; see bots/amazon/NOTES.md):
 *
 *  Newer (2025-2026), "Your Orders.zip":
 *    Your Amazon Orders/Order History.csv            one row per item line; Total Amount, Original Quantity,
 *                                                    sometimes Department; columns in alphabetical order
 *    Your Amazon Orders/Digital Content Orders.csv   one row per price component (Price Amount, Tax ...)
 *    Your Returns & Refunds/Refund Details.csv       Order ID, Refund Amount, Refund Date, Payment Status
 *
 *  Classic (2019-2024):
 *    Retail.OrderHistory.1/Retail.OrderHistory.1.csv (.2, .3 for other marketplaces): Order ID, Order Date,
 *      Currency, Unit Price, Unit Price Tax, Shipping Charge, Total Discounts, Total Owed, Quantity, ASIN,
 *      Order Status, Product Name ...
 *    Retail.OrdersReturned.Payments.1/Retail.OrdersReturned.Payments.1.csv: OrderID, AmountRefunded, Status,
 *      RefundCompletionDate, Currency
 *    Digital-Ordering.1/Digital Items.csv: OrderId, OrderDate, Title, OurPrice, OurPriceTax ...
 *
 *  Also the retired (2023) "Order reports > Items" CSV: Order Date, Order ID, Title, Category, ASIN/ISBN,
 *    Purchase Price Per Unit, Quantity, Item Total.
 *
 * Columns are found through a header alias map, so renamed or reordered columns still work.
 * PRIVACY: only the columns in ALIASES are ever read. Addresses, payment methods, gift messages, tracking
 * numbers and names of other people are never copied out of the CSV rows.
 */
(function (root) {
  'use strict';

  // ---------- CSV ----------
  function sniffDelimiter(text) {
    var line = '', q = false;
    for (var i = 0; i < text.length && i < 20000; i++) {
      var c = text[i];
      if (c === '"') q = !q;
      if (!q && (c === '\n' || c === '\r')) break;
      if (!q) line += c;
    }
    var best = ',', bestN = 0;
    [',', ';', '\t'].forEach(function (d) { var n = line.split(d).length - 1; if (n > bestN) { bestN = n; best = d; } });
    return best;
  }

  function parseCSV(text, delim) {
    text = String(text || '').replace(/^\ufeff/, '');
    delim = delim || sniffDelimiter(text);
    var rows = [], row = [], field = '', i = 0, n = text.length, q = false;
    while (i < n) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && field.replace(/\s/g, '') === '') { q = true; field = ''; i++; continue; }
      if (c === delim) { row.push(field); field = ''; i++; continue; }
      if (c === '\r' || c === '\n') {
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
        i++; continue;
      }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
    return rows;
  }

  function clean(s) { return String(s == null ? '' : s).replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim(); }
  function normKey(h) { return clean(h).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  var NA = /^(not available|not applicable|n\/a|na|none|null|-|--)$/i;
  function val(s) { s = clean(s); return NA.test(s) ? '' : s; }

  // ---------- header aliases (normalized: lowercase, letters and digits only) ----------
  var ALIASES = {
    orderId:   ['orderid', 'ordernumber', 'amazonorderid', 'orderno'],
    date:      ['orderdate', 'orderdatetime', 'orderplaceddate', 'dateordered', 'purchasedate', 'date'],
    product:   ['productname', 'title', 'itemname', 'item', 'itemtitle', 'description', 'name'],
    asin:      ['asin', 'asinisbn', 'isbn', 'productid'],
    qty:       ['quantity', 'originalquantity', 'quantityordered', 'qty', 'itemquantity'],
    unitPrice: ['unitprice', 'purchasepriceperunit', 'priceperunit', 'itemprice', 'ourprice', 'price', 'listpriceperunit'],
    unitTax:   ['unitpricetax', 'ourpricetax', 'pricetax', 'itemtax', 'tax'],
    shipping:  ['shippingcharge', 'shipping'],
    discounts: ['totaldiscounts', 'discounts', 'discount'],
    total:     ['totalowed', 'totalamount', 'itemtotal', 'total', 'amount', 'itemsubtotal'],
    currency:  ['currency', 'currencycode', 'basecurrencycode', 'ourpricecurrencycode', 'pricecurrencycode', 'buyercurrency'],
    status:    ['orderstatus', 'status'],
    category:  ['department', 'category', 'productcategory', 'segment', 'unspsccode'],
    site:      ['website', 'marketplace']
  };
  var REFUND_ALIASES = {
    orderId:  ['orderid', 'ordernumber'],
    amount:   ['refundamount', 'amountrefunded', 'totalrefundamount', 'refundtotal'],
    date:     ['refunddate', 'refundcompletiondate', 'creationdate', 'refundcreationdate'],
    status:   ['paymentstatus', 'status', 'refundstatus'],
    currency: ['currency', 'currencycode', 'returnamountcurrency']
  };
  var DIGITAL_ALIASES = {
    orderId:   ['orderid'],
    itemId:    ['digitalorderitemid'],
    date:      ['orderdate', 'fulfilleddate', 'deliverydate'],
    product:   ['productname', 'title'],
    asin:      ['asin'],
    qty:       ['quantityordered', 'originalquantity'],
    component: ['componenttype'],
    amount:    ['transactionamount'],
    price:     ['ourprice', 'price', 'listpriceamount'],
    tax:       ['ourpricetax', 'pricetax', 'listpricetaxamount'],
    currency:  ['basecurrencycode', 'ourpricecurrencycode', 'pricecurrencycode', 'currency', 'currencycode'],
    status:    ['orderstatus', 'fullfilmentstatus', 'fulfillmentstatus']
  };

  function columns(header, aliases) {
    var keys = header.map(normKey), out = {};
    Object.keys(aliases).forEach(function (k) {
      var list = aliases[k];
      for (var i = 0; i < list.length; i++) {
        var at = keys.indexOf(list[i]);
        if (at >= 0) { out[k] = at; return; }
      }
      out[k] = -1;
    });
    return out;
  }

  // ---------- values ----------
  // "12.99", "$1,234.56", "'-69'", "1.234,56", "12,99", "(5.00)", "USD 7.50", "Not Available" -> number or null
  function parseMoney(s) {
    s = clean(s).replace(/^['"]+|['"]+$/g, '');
    if (!s || NA.test(s)) return null;
    var neg = /^\(.*\)$/.test(s) || /^-|-$|^[^\d]*-/.test(s);
    s = s.replace(/[^\d.,]/g, '');
    if (!s || !/\d/.test(s)) return null;
    var lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc >= 0 && ld >= 0) {
      if (lc > ld) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56
      else s = s.replace(/,/g, '');                             // 1,234.56
    } else if (lc >= 0) {
      var parts = s.split(',');
      if (parts.length === 2 && parts[1].length !== 3) s = parts[0] + '.' + parts[1]; // 12,99 / 12,5
      else s = s.replace(/,/g, '');                                                   // 1,234 / 1,234,567
    } else if (ld >= 0 && s.split('.').length > 2) {
      s = s.replace(/\./g, ''); // 1.234.567
    }
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }

  function parseQty(s) {
    s = val(s);
    if (!s) return null;
    var n = parseFloat(s.replace(/,/g, '.'));
    return isFinite(n) ? n : null;
  }

  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  function okDate(y, mo, d) {
    if (!(y >= 1995 && y <= 2999 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return false;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCMonth() === mo - 1;
  }

  // Returns { ts (ms since epoch), timed (true if the value carried a time of day) } or null.
  // ISO timestamps from the export are UTC ("2026-03-14T18:22:31Z", with or without .000);
  // a timestamp without a zone is also read as UTC. A date without a time is pinned to local noon.
  function parseWhen(s, order) {
    s = val(s);
    if (!s) return null;
    // Some exports join several dates with " and " or ","; the first is the order date.
    s = s.split(/\s+and\s+/i)[0];
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?\s*(Z|UTC|GMT|[+-]\d{2}:?\d{2})?)?$/i);
    if (m) {
      var y = +m[1], mo = +m[2], d = +m[3];
      if (!okDate(y, mo, d)) return null;
      if (m[4] == null) return { ts: new Date(y, mo - 1, d, 12).getTime(), timed: false };
      var h = +m[4], mi = +m[5], se = +(m[6] || 0);
      if (h > 23 || mi > 59 || se > 59) return null;
      var ts = Date.UTC(y, mo - 1, d, h, mi, se);
      var z = m[7];
      if (z && /^[+-]/.test(z)) { var zz = z.replace(':', ''); var off = (+zz.slice(1, 3) * 60 + +zz.slice(3, 5)) * (zz[0] === '-' ? -1 : 1); ts -= off * 60000; }
      return { ts: ts, timed: true };
    }
    // 03/14/2026, 3/14/26 (US order reports); 14/03/2026 or 14.03.2026 when order says dmy or the value forces it
    m = s.match(/^(\d{1,2})([\/.\-])(\d{1,2})\2(\d{2}|\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?)?$/i);
    if (m) {
      var a = +m[1], b = +m[3], yy = +m[4]; if (yy < 100) yy += 2000;
      var dmy = order === 'dmy' || a > 12 || m[2] === '.';
      if (b > 12) dmy = false;
      var mo2 = dmy ? b : a, d2 = dmy ? a : b;
      if (!okDate(yy, mo2, d2)) return null;
      if (m[5] == null) return { ts: new Date(yy, mo2 - 1, d2, 12).getTime(), timed: false };
      var hh = +m[5]; if (m[8]) { var pm = /p/i.test(m[8]); hh = hh % 12 + (pm ? 12 : 0); }
      return { ts: new Date(yy, mo2 - 1, d2, hh, +m[6], +(m[7] || 0)).getTime(), timed: true };
    }
    // Mar 14, 2026 / 14 Mar 2026 / March 14 2026
    m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
    if (m && MON[m[1].slice(0, 3).toLowerCase()]) { var mo3 = MON[m[1].slice(0, 3).toLowerCase()]; return okDate(+m[3], mo3, +m[2]) ? { ts: new Date(+m[3], mo3 - 1, +m[2], 12).getTime(), timed: false } : null; }
    m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
    if (m && MON[m[2].slice(0, 3).toLowerCase()]) { var mo4 = MON[m[2].slice(0, 3).toLowerCase()]; if (okDate(+m[3], mo4, +m[1])) return { ts: new Date(+m[3], mo4 - 1, +m[1], 12).getTime(), timed: false }; }
    return null;
  }

  // Decide M/D vs D/M for slash dates in a whole column (only matters for old order reports).
  function detectOrder(values) {
    var mdy = 0, dmy = 0;
    values.forEach(function (v) {
      var m = clean(v).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-]\d{2,4}/);
      if (!m) return;
      if (+m[1] > 12) dmy++;
      if (+m[2] > 12) mdy++;
    });
    return dmy > mdy ? 'dmy' : 'mdy';
  }

  function cleanName(s) { return clean(s); }

  // ---------- file kinds ----------
  function headerOf(rows) {
    // The header is the first row that has an order-id-like column (skips title lines some tools add).
    for (var i = 0; i < Math.min(rows.length, 5); i++) {
      var keys = rows[i].map(normKey);
      if (keys.some(function (k) { return ['orderid', 'ordernumber', 'amazonorderid'].indexOf(k) >= 0; })) return i;
    }
    return -1;
  }

  function kindOf(header, filename) {
    var c = columns(header, ALIASES), r = columns(header, REFUND_ALIASES), dg = columns(header, DIGITAL_ALIASES);
    var name = String(filename || '').toLowerCase();
    if (c.orderId < 0) return null;
    if (dg.itemId >= 0 || dg.component >= 0 || /digital/.test(name)) {
      if ((dg.amount >= 0 || dg.price >= 0)) return 'digital';
      return null; // e.g. "Digital Orders.csv" (dates only) or borrowed items: nothing to count
    }
    if (r.amount >= 0 && c.product < 0) return 'refunds';
    if (/refund|returned\.payments|ordersreturned/.test(name) && r.amount >= 0) return 'refunds';
    if (/return|cart|wishlist|subscribe|review/.test(name) && !/orderhistory|order history/.test(name)) return null;
    if (c.date >= 0 && c.product >= 0 && (c.total >= 0 || c.unitPrice >= 0)) return 'orders';
    return null;
  }

  // ---------- readers ----------
  function readOrders(rows, hi, src) {
    var header = rows[hi], c = columns(header, ALIASES), out = [], stats = { cancelled: 0, badDate: 0, rows: 0 };
    var order = detectOrder(rows.slice(hi + 1, hi + 400).map(function (r) { return r[c.date] || ''; }));
    function get(r, k) { return c[k] >= 0 ? r[c[k]] : ''; }
    for (var i = hi + 1; i < rows.length; i++) {
      var r = rows[i];
      if (r.length < 3) continue;
      stats.rows++;
      var status = val(get(r, 'status'));
      var qty = parseQty(get(r, 'qty'));
      if (/cancel/i.test(status) || qty === 0) { stats.cancelled++; continue; }
      if (qty == null || qty < 0) qty = 1;
      var when = parseWhen(get(r, 'date'), order);
      if (!when) { stats.badDate++; continue; }
      var total = parseMoney(get(r, 'total'));
      if (total == null) {
        var up = parseMoney(get(r, 'unitPrice')), ut = parseMoney(get(r, 'unitTax')) || 0;
        var sh = parseMoney(get(r, 'shipping')) || 0, di = Math.abs(parseMoney(get(r, 'discounts')) || 0);
        total = up == null ? 0 : (up + ut) * qty + sh - di;
      }
      var name = cleanName(get(r, 'product')) || 'Unnamed item';
      var cat = val(get(r, 'category'));
      if (/^\d+$/.test(cat)) cat = ''; // UNSPSC codes are not readable categories
      out.push({
        id: '', kind: 'physical', orderId: val(get(r, 'orderId')) || ('row' + i), ts: when.ts, timed: when.timed,
        name: name, asin: val(get(r, 'asin')).toUpperCase(), qty: qty, total: Math.round(total * 100) / 100,
        currency: (val(get(r, 'currency')) || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3),
        category: cat, status: status, src: src
      });
    }
    return { items: out, stats: stats };
  }

  function readDigital(rows, hi, src) {
    var c = columns(rows[hi], DIGITAL_ALIASES), groups = {}, keys = [], stats = { rows: 0, free: 0, cancelled: 0 };
    function get(r, k) { return c[k] >= 0 ? r[c[k]] : ''; }
    for (var i = hi + 1; i < rows.length; i++) {
      var r = rows[i];
      if (r.length < 3) continue;
      stats.rows++;
      var status = val(get(r, 'status'));
      if (/cancel|refund|fail/i.test(status)) { stats.cancelled++; continue; }
      var when = parseWhen(get(r, 'date'));
      if (!when) continue;
      var key = val(get(r, 'itemId')) || (val(get(r, 'orderId')) + '|' + val(get(r, 'asin')) + '|' + i);
      var amt;
      if (c.amount >= 0) {
        amt = parseMoney(get(r, 'amount')) || 0;
      } else {
        amt = (parseMoney(get(r, 'price')) || 0) + (parseMoney(get(r, 'tax')) || 0);
      }
      if (!groups[key]) {
        groups[key] = { id: '', kind: 'digital', orderId: val(get(r, 'orderId')) || key, ts: when.ts, timed: when.timed,
          name: cleanName(get(r, 'product')) || 'Digital item', asin: val(get(r, 'asin')).toUpperCase(), qty: parseQty(get(r, 'qty')) || 1,
          total: 0, currency: (val(get(r, 'currency')) || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3), category: 'Digital', status: status, src: src };
        keys.push(key);
      }
      groups[key].total = Math.round((groups[key].total + amt) * 100) / 100;
    }
    var out = [];
    keys.forEach(function (k) { if (groups[k].total > 0) out.push(groups[k]); else stats.free++; });
    return { items: out, stats: stats };
  }

  function readRefunds(rows, hi, src) {
    var c = columns(rows[hi], REFUND_ALIASES), out = [], stats = { rows: 0, pending: 0 };
    function get(r, k) { return c[k] >= 0 ? r[c[k]] : ''; }
    for (var i = hi + 1; i < rows.length; i++) {
      var r = rows[i];
      if (r.length < 2) continue;
      stats.rows++;
      var st = val(get(r, 'status'));
      if (st && !/complete|refunded|success|paid/i.test(st)) { stats.pending++; continue; }
      var amt = parseMoney(get(r, 'amount'));
      if (amt == null || amt === 0) continue;
      var when = parseWhen(get(r, 'date'));
      out.push({ orderId: val(get(r, 'orderId')), amount: Math.abs(amt), ts: when ? when.ts : null,
        currency: (val(get(r, 'currency')) || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3), src: src });
    }
    return { items: out, stats: stats };
  }

  // Counts identical records per file and keeps the max across files, so the same export uploaded twice
  // (or a zip plus the CSV inside it) is counted once, while genuine repeat lines inside one file are kept.
  function mergeDedup(lists, sig) {
    var best = {}, order = [];
    lists.forEach(function (list) {
      var local = {};
      list.forEach(function (x) {
        var k = sig(x);
        (local[k] = local[k] || []).push(x);
      });
      Object.keys(local).forEach(function (k) {
        if (!best[k]) { best[k] = local[k]; order.push(k); }
        else if (local[k].length > best[k].length) best[k] = local[k];
      });
    });
    var out = [];
    order.forEach(function (k) { out = out.concat(best[k]); });
    return out;
  }

  // files: [{ name, text }] -> { items, refunds, files: [{name, kind, rows}], ignored: [names], ... }
  function parseFiles(files) {
    var ordLists = [], refLists = [], digLists = [], report = [], ignored = [];
    var cancelled = 0, freeDigital = 0, pendingRefunds = 0;
    files.forEach(function (f) {
      var rows = parseCSV(f.text);
      var hi = headerOf(rows);
      var kind = hi >= 0 ? kindOf(rows[hi], f.name) : null;
      if (!kind) { ignored.push(f.name); return; }
      var res;
      if (kind === 'orders') { res = readOrders(rows, hi, f.name); ordLists.push(res.items); cancelled += res.stats.cancelled; }
      else if (kind === 'digital') { res = readDigital(rows, hi, f.name); digLists.push(res.items); freeDigital += res.stats.free; }
      else { res = readRefunds(rows, hi, f.name); refLists.push(res.items); pendingRefunds += res.stats.pending; }
      report.push({ name: f.name, kind: kind, rows: res.stats.rows, used: res.items.length });
    });
    var isig = function (x) { return [x.kind, x.orderId, x.ts, x.name, x.qty, x.total, x.currency].join('|'); };
    var items = mergeDedup(ordLists, isig).concat(mergeDedup(digLists, isig));
    var refunds = mergeDedup(refLists, function (x) { return [x.orderId, x.ts, x.amount, x.currency].join('|'); });
    // Fill a missing currency from the most common one in the file set (blank -> USD as a last resort).
    var cc = {};
    items.forEach(function (x) { if (x.currency) cc[x.currency] = (cc[x.currency] || 0) + 1; });
    var main = Object.keys(cc).sort(function (a, b) { return cc[b] - cc[a]; })[0] || 'USD';
    items.forEach(function (x) { if (!x.currency) x.currency = main; });
    var byOrder = {};
    items.forEach(function (x) { if (!byOrder[x.orderId]) byOrder[x.orderId] = x.currency; });
    refunds.forEach(function (r) { if (!r.currency) r.currency = byOrder[r.orderId] || main; });
    items.sort(function (a, b) { return a.ts - b.ts || (a.orderId < b.orderId ? -1 : a.orderId > b.orderId ? 1 : 0); });
    items.forEach(function (x, i) { x.id = 'i' + i; });
    return {
      items: items, refunds: refunds, files: report, ignored: ignored,
      cancelled: cancelled, freeDigital: freeDigital, pendingRefunds: pendingRefunds,
      timed: items.some(function (x) { return x.timed; }),
      hasCategory: items.filter(function (x) { return x.kind === 'physical' && x.category; }).length >= Math.max(1, items.filter(function (x) { return x.kind === 'physical'; }).length * 0.5)
    };
  }

  // Which zip entries to read. Everything else (addresses, payment data, browsing history...) is skipped
  // without being decompressed.
  function wantEntry(path) {
    var p = String(path).replace(/\\/g, '/');
    if (/(^|\/)(__MACOSX|\.)/.test(p) || !/\.csv$/i.test(p)) return false;
    var base = p.split('/').pop().toLowerCase();
    if (/^retail\.ordersreturned\.payments|refund details/.test(base)) return true;
    if (/address|payment|profile|billing|wallet|contact|browsing|search|alexa|prime ?video|audible|kindle\.|advertis|review|wishlist|cart/.test(base)) return false;
    return /orderhistory|order history|orders? history|refund|ordersreturned|digital items|digital content orders|digital orders monetary|^orders?\.csv$|items?\.csv$|purchase|order/.test(base);
  }

  var api = {
    parseCSV: parseCSV, parseMoney: parseMoney, parseWhen: parseWhen, detectOrder: detectOrder, normKey: normKey,
    columns: columns, kindOf: kindOf, headerOf: headerOf, parseFiles: parseFiles, wantEntry: wantEntry,
    ALIASES: ALIASES, REFUND_ALIASES: REFUND_ALIASES, DIGITAL_ALIASES: DIGITAL_ALIASES
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AmazonParser = api;
})(typeof self !== 'undefined' ? self : this);
