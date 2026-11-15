/* Year in Review for Etsy sellers: parser for the CSVs a seller downloads from their own shop.
 * Pure functions; no network, no storage. Runs in the browser and in Node (tests).
 *
 * Files (see bots/etsy/NOTES.md for sources; column names come from real 2020-2026 exports found on GitHub,
 * but Etsy changes them, so everything goes through the alias maps below):
 *
 *  Orders       EtsySoldOrders2026.csv / EtsySoldOrders2026-3.csv (Shop Manager > Settings > Options > Download Data)
 *               Sale Date, Order ID, Buyer User ID, Full Name, First Name, Last Name, Number of Items, Payment Method,
 *               Date Shipped, Street 1, Street 2, Ship City, Ship State, Ship Zipcode, Ship Country, Currency,
 *               Order Value, Coupon Code, Coupon Details, Discount Amount, Shipping Discount, Shipping, Sales Tax,
 *               Order Total, Status, Card Processing Fees, Order Net, Adjusted Order Total, Adjusted Card Processing
 *               Fees, Adjusted Net Order Amount, Buyer, Order Type, Payment Type, InPerson Discount, InPerson Location, SKU
 *               (2020 UK-English files say Date Posted, Delivery City/State/Zipcode/Country, Delivery Discount,
 *               Delivery, Sales tax, Order total.)
 *  Order items  EtsySoldOrderItems2026.csv
 *               Sale Date, Item Name, Buyer, Quantity, Price, Coupon Code, Coupon Details, Discount Amount, Shipping
 *               Discount, Order Shipping, Order Sales Tax, Item Total, Currency, Transaction ID, Listing ID, Date Paid,
 *               Date Shipped, Ship Name, Ship Address1, Ship Address2, Ship City, Ship State, Ship Zipcode, Ship
 *               Country, Order ID, Variations, Order Type, Listings Type, Payment Type, InPerson Discount, InPerson
 *               Location, VAT Paid by Buyer, SKU
 *  Statement    etsy_statement_2026_3.csv (Shop Manager > Finances > Monthly statements > Download CSV)
 *               Date, Type, Title, Info, Currency, Amount, Fees & Taxes, Net, Tax Details
 *               Type: Sale, Fee, Marketing, VAT, Tax, Refund, Shipping/Shipping Label, Deposit, Payment ...
 *
 * PRIVACY: only the columns named in the alias maps are read. Buyer names, street addresses, cities, zip codes,
 * emails, payment methods, coupon codes and personalization (Variations) are never copied out of a row. The buyer's
 * user ID is turned into a salted hash on the spot (for the repeat-buyer share) and the raw value is dropped.
 * Ship state and country are kept only to count orders per region.
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

  var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  function decodeEntities(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (m, e) {
      if (e[0] === '#') { var cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : m; }
      return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m;
    });
  }
  function clean(s) { return decodeEntities(String(s == null ? '' : s)).replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim(); }
  function normKey(h) { return clean(h).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  var NA = /^(not available|not applicable|n\/a|na|none|null|-+)$/i;
  function val(s) { s = clean(s); return NA.test(s) ? '' : s; }

  // ---------- header aliases (normalized: lowercase, letters and digits only) ----------
  var ORDER_ALIASES = {
    orderId:   ['orderid', 'ordernumber', 'receiptid'],
    date:      ['saledate', 'orderdate', 'dateofsale', 'datepaid', 'date'],
    items:     ['numberofitems', 'items', 'itemcount', 'quantity'],
    value:     ['ordervalue', 'itemtotal', 'subtotal'],
    discount:  ['discountamount', 'discount', 'discounts'],
    shipDisc:  ['shippingdiscount', 'deliverydiscount', 'postagediscount'],
    shipping:  ['shipping', 'delivery', 'postage', 'ordershipping', 'shippingcharge'],
    salesTax:  ['salestax', 'ordersalestax', 'tax'],
    total:     ['ordertotal', 'total'],
    adjTotal:  ['adjustedordertotal'],
    status:    ['status', 'orderstatus'],
    currency:  ['currency', 'currencycode'],
    state:     ['shipstate', 'deliverystate', 'shippingstate', 'state'],
    country:   ['shipcountry', 'deliverycountry', 'shippingcountry', 'country'],
    buyerId:   ['buyeruserid', 'buyerid'],
    orderType: ['ordertype']
  };
  var ITEM_ALIASES = {
    orderId:   ['orderid', 'ordernumber', 'receiptid'],
    date:      ['saledate', 'orderdate', 'dateofsale', 'datepaid', 'date'],
    name:      ['itemname', 'title', 'itemtitle', 'listingtitle', 'productname'],
    listingId: ['listingid'],
    txId:      ['transactionid'],
    qty:       ['quantity', 'qty'],
    price:     ['price', 'itemprice', 'unitprice'],
    itemTotal: ['itemtotal', 'total'],
    currency:  ['currency', 'currencycode'],
    state:     ['shipstate', 'deliverystate', 'shippingstate', 'state'],
    country:   ['shipcountry', 'deliverycountry', 'shippingcountry', 'country'],
    buyer:     ['buyeruserid', 'buyer'],
    listType:  ['listingstype', 'listingtype']
  };
  var STATEMENT_ALIASES = {
    date:     ['date', 'transactiondate'],
    type:     ['type', 'transactiontype'],
    title:    ['title', 'description'],
    info:     ['info', 'details', 'reference'],
    currency: ['currency', 'currencycode'],
    amount:   ['amount', 'gross'],
    fees:     ['feestaxes', 'feesandtaxes', 'fees'],
    net:      ['net', 'netamount']
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
  // "12.99", "$1,234.56", "-$0.20", "--", "1.234,56 EUR", "12,99", "(5.00)", U+2212 minus -> number or null
  function parseMoney(s) {
    s = clean(s).replace(/[\u2012-\u2015\u2212\ufe63\uff0d]/g, '-').replace(/^['"]+|['"]+$/g, '');
    if (!s || NA.test(s)) return null;
    var neg = /^\(.*\)$/.test(s) || /^-|-$|^[^\d]*-/.test(s);
    s = s.replace(/[^\d.,]/g, '');
    if (!s || !/\d/.test(s)) return null;
    var lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc >= 0 && ld >= 0) {
      if (lc > ld) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (lc >= 0) {
      var parts = s.split(',');
      if (parts.length === 2 && parts[1].length !== 3) s = parts[0] + '.' + parts[1];
      else s = s.replace(/,/g, '');
    } else if (ld >= 0 && s.split('.').length > 2) {
      s = s.replace(/\./g, '');
    }
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }
  function money0(s) { var n = parseMoney(s); return n == null ? 0 : n; }
  function parseQty(s) { s = val(s); if (!s) return null; var n = parseFloat(s.replace(/,/g, '.')); return isFinite(n) ? n : null; }

  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  function okDate(y, mo, d) {
    if (!(y >= 2000 && y <= 2999 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return false;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCMonth() === mo - 1;
  }
  function noon(y, mo, d) { return new Date(y, mo - 1, d, 12).getTime(); }

  // Etsy dates are calendar days ("01/31/25", "01/31/2025", "January 31, 2025", "2025-01-31").
  // They are pinned to local noon so the day never shifts with the time zone.
  function parseWhen(s, order) {
    s = val(s);
    if (!s) return null;
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
    if (m) return okDate(+m[1], +m[2], +m[3]) ? noon(+m[1], +m[2], +m[3]) : null;
    m = s.match(/^(\d{1,2})([\/.\-])(\d{1,2})\2(\d{2}|\d{4})(?:[ T,].*)?$/);
    if (m) {
      var a = +m[1], b = +m[3], yy = +m[4]; if (yy < 100) yy += 2000;
      var dmy = order === 'dmy' || a > 12 || m[2] === '.';
      if (b > 12) dmy = false;
      var mo = dmy ? b : a, d = dmy ? a : b;
      return okDate(yy, mo, d) ? noon(yy, mo, d) : null;
    }
    m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
    if (m && MON[m[1].slice(0, 3).toLowerCase()]) { var mo3 = MON[m[1].slice(0, 3).toLowerCase()]; return okDate(+m[3], mo3, +m[2]) ? noon(+m[3], mo3, +m[2]) : null; }
    m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);
    if (m && MON[m[2].slice(0, 3).toLowerCase()]) { var mo4 = MON[m[2].slice(0, 3).toLowerCase()]; return okDate(+m[3], mo4, +m[1]) ? noon(+m[3], mo4, +m[1]) : null; }
    return null;
  }
  function detectOrder(values) {
    var mdy = 0, dmy = 0;
    values.forEach(function (v) {
      var m = clean(v).match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.]\d{2,4}/);
      if (!m) return;
      if (+m[1] > 12) dmy++;
      if (+m[2] > 12) mdy++;
    });
    return dmy > mdy ? 'dmy' : 'mdy';
  }
  function cur3(s) { return (val(s) || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3); }

  // Buyer IDs never leave this function as-is: FNV-1a over a per-page-load random salt + the ID.
  var SALT = (function () {
    try { var a = new Uint32Array(2); (root.crypto || require('crypto').webcrypto).getRandomValues(a); return a[0].toString(36) + a[1].toString(36); }
    catch (e) { return String(Math.random()).slice(2); }
  })();
  function hashId(s) {
    s = SALT + '|' + String(s).toLowerCase();
    var h1 = 2166136261, h2 = 5381;
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h1 ^= c; h1 = Math.imul(h1, 16777619); h2 = (Math.imul(h2, 33) + c) | 0; }
    return 'b' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
  }

  // US states: names and codes -> two-letter code. Anything else is kept as written (trimmed) for non-US regions.
  var US = { alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', districtofcolumbia: 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', newhampshire: 'NH', newjersey: 'NJ', newmexico: 'NM', newyork: 'NY', northcarolina: 'NC', northdakota: 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', rhodeisland: 'RI', southcarolina: 'SC', southdakota: 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', westvirginia: 'WV', wisconsin: 'WI', wyoming: 'WY', puertorico: 'PR' };
  var US_CODES = {}; Object.keys(US).forEach(function (k) { US_CODES[US[k]] = 1; });
  function region(state, country) {
    var c = clean(country), st = clean(state);
    var isUS = /^(united states( of america)?|usa|us)$/i.test(c);
    var code = st.toUpperCase();
    if (isUS || (!c && US_CODES[code])) {
      if (US_CODES[code]) return { country: 'United States', state: code };
      var k = st.toLowerCase().replace(/[^a-z]/g, '');
      return { country: 'United States', state: US[k] || '' };
    }
    return { country: c.slice(0, 60), state: '' };
  }

  function statusRefund(st) { return /refund|cancel/i.test(st || ''); }
  function fullRefund(st) { return /cancel|fully refunded|^refunded$/i.test(st || ''); }

  // ---------- readers ----------
  function headerOf(rows) {
    for (var i = 0; i < Math.min(rows.length, 5); i++) {
      var keys = rows[i].map(normKey);
      if (keys.indexOf('orderid') >= 0 || keys.indexOf('ordernumber') >= 0 || keys.indexOf('receiptid') >= 0) return i;
      if (keys.indexOf('type') >= 0 && keys.indexOf('date') >= 0 && (keys.indexOf('net') >= 0 || keys.indexOf('amount') >= 0)) return i;
    }
    return -1;
  }

  function kindOf(header, filename) {
    var name = String(filename || '').toLowerCase();
    var keys = header.map(normKey);
    var s = columns(header, STATEMENT_ALIASES), o = columns(header, ORDER_ALIASES), it = columns(header, ITEM_ALIASES);
    if (s.type >= 0 && s.date >= 0 && (s.net >= 0 || s.amount >= 0) && s.title >= 0) return 'statement';
    if (/deposit|directcheckoutpayments|payments\d|reviews|listings/.test(name) && !/solditems|soldorderitems|soldorders/.test(name)) return null;
    if (keys.indexOf('bankaccountendingdigits') >= 0 || keys.indexOf('paymentid') >= 0) return null;
    if (o.orderId < 0) return null;
    if (it.name >= 0 && (it.qty >= 0 || it.price >= 0) && it.listingId + it.txId > -2) return 'items';
    if (it.name >= 0 && /item/.test(name)) return 'items';
    if (o.date >= 0 && (o.value >= 0 || o.total >= 0)) return 'orders';
    return null;
  }

  function reader(rows, hi, aliases) {
    var c = columns(rows[hi], aliases);
    return { c: c, get: function (r, k) { return c[k] >= 0 && c[k] < r.length ? r[c[k]] : ''; } };
  }

  function readOrders(rows, hi, src) {
    var R = reader(rows, hi, ORDER_ALIASES), get = R.get, out = [], stats = { rows: 0, badDate: 0 };
    var order = detectOrder(rows.slice(hi + 1, hi + 400).map(function (r) { return get(r, 'date'); }));
    for (var i = hi + 1; i < rows.length; i++) {
      var r = rows[i];
      if (r.length < 3) continue;
      stats.rows++;
      var ts = parseWhen(get(r, 'date'), order);
      if (ts == null) { stats.badDate++; continue; }
      var status = val(get(r, 'status'));
      var value = money0(get(r, 'value')), discount = Math.abs(money0(get(r, 'discount')));
      var shipping = money0(get(r, 'shipping')), shipDisc = Math.abs(money0(get(r, 'shipDisc')));
      var total = parseMoney(get(r, 'total')), adj = parseMoney(get(r, 'adjTotal'));
      var sales = R.c.value >= 0 ? value - discount : (total || 0) - money0(get(r, 'salesTax'));
      // Refunds from the orders file: a fully refunded/cancelled status refunds everything; otherwise a non-zero
      // Adjusted Order Total below Order Total is a partial refund. (Etsy leaves Adjusted at 0.00 when untouched.)
      var refund = 0;
      if (fullRefund(status)) refund = total != null ? total : sales + shipping - shipDisc;
      else if (adj != null && adj > 0 && total != null && adj < total - 0.004) refund = total - adj;
      var reg = region(get(r, 'state'), get(r, 'country'));
      var bid = val(get(r, 'buyerId'));
      out.push({
        orderId: val(get(r, 'orderId')) || ('row' + i), ts: ts,
        items: Math.max(0, parseQty(get(r, 'items')) || 0),
        sales: r2(sales), shipping: r2(shipping - shipDisc), discount: r2(discount), salesTax: r2(money0(get(r, 'salesTax'))),
        total: total == null ? null : r2(total), refund: r2(Math.max(0, refund)), full: fullRefund(status), refunded: statusRefund(status) || refund > 0,
        currency: cur3(get(r, 'currency')), country: reg.country, state: reg.state,
        buyer: bid ? hashId(bid) : '', inPerson: /in.?person/i.test(val(get(r, 'orderType'))), src: src
      });
    }
    return { list: out, stats: stats };
  }

  function readItems(rows, hi, src) {
    var R = reader(rows, hi, ITEM_ALIASES), get = R.get, out = [], stats = { rows: 0, badDate: 0 };
    var order = detectOrder(rows.slice(hi + 1, hi + 400).map(function (r) { return get(r, 'date'); }));
    for (var i = hi + 1; i < rows.length; i++) {
      var r = rows[i];
      if (r.length < 3) continue;
      stats.rows++;
      var ts = parseWhen(get(r, 'date'), order);
      if (ts == null) { stats.badDate++; continue; }
      var qty = parseQty(get(r, 'qty')); if (qty == null || qty < 0) qty = 1;
      var price = money0(get(r, 'price'));
      var it = parseMoney(get(r, 'itemTotal'));
      var reg = region(get(r, 'state'), get(r, 'country'));
      var b = val(get(r, 'buyer'));
      out.push({
        orderId: val(get(r, 'orderId')) || ('row' + i), ts: ts,
        name: clean(get(r, 'name')).slice(0, 200) || 'Untitled listing', listingId: val(get(r, 'listingId')), txId: val(get(r, 'txId')),
        qty: qty, total: r2(it != null ? it : price * qty), currency: cur3(get(r, 'currency')),
        country: reg.country, state: reg.state, buyer: b ? hashId(b) : '', src: src
      });
    }
    return { list: out, stats: stats };
  }

  // ---------- statement categories ----------
  var CATS = [
    { key: 'transaction', name: 'Transaction fees' },
    { key: 'processing', name: 'Payment processing fees' },
    { key: 'listing', name: 'Listing fees' },
    { key: 'offsite', name: 'Offsite Ads fees' },
    { key: 'ads', name: 'Etsy Ads' },
    { key: 'labels', name: 'Shipping labels' },
    { key: 'subscription', name: 'Subscriptions (e.g. Etsy Plus)' },
    { key: 'regulatory', name: 'Regulatory operating fees' },
    { key: 'otherFees', name: 'Other Etsy fees' },
    { key: 'vat', name: 'VAT/GST on Etsy fees' }
  ];
  // Returns one of: sale, refund, tax, deposit, payment, adjust, or a CATS key.
  function classify(type, title) {
    var t = normKey(type), ti = clean(title).toLowerCase();
    if (t === 'deposit' || /sent to your bank|deposit to|bank account/.test(ti)) return 'deposit';
    if (t === 'payment' || /^charge for|payment from your card|card payment|balance payment/.test(ti)) return 'payment';
    if (t === 'vat' || t === 'gst' || /^(vat|gst)\b|^(vat|gst):/.test(ti)) return 'vat';
    if (t === 'tax' || /sales tax|tax paid by buyer|tax collected|for sales tax/.test(ti)) return 'tax';
    if (t === 'sale' || /^payment for order/.test(ti)) return 'sale';
    if (t === 'refund' || /^(partial )?refund (for|to buyer for) order/.test(ti)) return 'refund';
    if (/offsite ads/.test(ti)) return 'offsite';
    if (/subscription|etsy plus|pattern/.test(ti)) return 'subscription';
    if (/etsy ads|promoted listings|click-?throughs/.test(ti)) return 'ads';
    if (/transaction fee/.test(ti)) return 'transaction';
    if (/processing fee/.test(ti)) return 'processing';
    if (/listing fee|auto-?renew|renew sold|multi-quantity/.test(ti)) return 'listing';
    if (/regulatory operating/.test(ti)) return 'regulatory';
    if (/shipping ?label|postage|usps|fedex|ups |canada post|royal mail|label/.test(ti) || t === 'shipping' || t === 'shippinglabel' || t === 'postage') return 'labels';
    if (t === 'marketing') return 'ads';
    if (t === 'fee' || t === 'fees' || /fee|currency conversion/.test(ti)) return 'otherFees';
    return 'adjust';
  }
  function orderIdIn(s) { var m = String(s || '').match(/order\s*#?\s*(\d{5,})/i); return m ? m[1] : ''; }

  function readStatement(rows, hi, src) {
    var R = reader(rows, hi, STATEMENT_ALIASES), get = R.get, out = [], stats = { rows: 0, badDate: 0 };
    for (var i = hi + 1; i < rows.length; i++) {
      var r = rows[i];
      if (r.length < 4) continue;
      stats.rows++;
      var ts = parseWhen(get(r, 'date'));
      if (ts == null) { stats.badDate++; continue; }
      var amount = money0(get(r, 'amount')), fees = money0(get(r, 'fees'));
      var netRaw = parseMoney(get(r, 'net'));
      var net = netRaw == null ? amount + fees : netRaw;
      var type = val(get(r, 'type')), title = clean(get(r, 'title'));
      out.push({
        ts: ts, type: type.slice(0, 40), kind: classify(type, title),
        credit: /^credit for|\bcredit$|refund of|reversal/i.test(title),
        amount: r2(amount), fees: r2(fees), net: r2(net),
        currency: cur3(get(r, 'currency')),
        orderId: orderIdIn(title) || orderIdIn(get(r, 'info')), src: src
      });
    }
    return { list: out, stats: stats };
  }

  function r2(n) { return Math.round(n * 100) / 100; }

  // Identical records are counted per file and the max kept across files, so the same CSV twice counts once
  // while genuine repeats inside one file (one listing renewed three times on a day) are kept.
  function mergeDedup(lists, sig) {
    var best = {}, order = [];
    lists.forEach(function (list) {
      var local = {};
      list.forEach(function (x) { var k = sig(x); (local[k] = local[k] || []).push(x); });
      Object.keys(local).forEach(function (k) {
        if (!best[k]) { best[k] = local[k]; order.push(k); }
        else if (local[k].length > best[k].length) best[k] = local[k];
      });
    });
    var out = [];
    order.forEach(function (k) { out = out.concat(best[k]); });
    return out;
  }

  // files: [{ name, text }] -> { orders, items, statement, files, ignored }
  function parseFiles(files) {
    var L = { orders: [], items: [], statement: [] }, report = [], ignored = [];
    files.forEach(function (f) {
      var rows = parseCSV(f.text);
      var hi = headerOf(rows);
      var kind = hi >= 0 ? kindOf(rows[hi], f.name) : null;
      if (!kind) { ignored.push(f.name); return; }
      var res = kind === 'orders' ? readOrders(rows, hi, f.name) : kind === 'items' ? readItems(rows, hi, f.name) : readStatement(rows, hi, f.name);
      L[kind].push(res.list);
      report.push({ name: f.name, kind: kind, rows: res.stats.rows, used: res.list.length, badDate: res.stats.badDate });
    });
    // Signatures leave out the salted buyer hash so a file read twice still matches itself.
    var orders = mergeDedup(L.orders, function (x) { return [x.orderId, x.ts, x.sales, x.shipping, x.total, x.currency].join('|'); });
    // The same order can appear in two monthly orders files only if they overlap; keep one row per order ID.
    var seen = {}; orders = orders.filter(function (o) { if (seen[o.orderId]) return false; seen[o.orderId] = 1; return true; });
    var items = mergeDedup(L.items, function (x) { return [x.orderId, x.txId, x.ts, x.name, x.qty, x.total, x.currency].join('|'); });
    var statement = mergeDedup(L.statement, function (x) { return [x.ts, x.type, x.kind, x.amount, x.fees, x.net, x.currency, x.orderId, x.credit].join('|'); });
    // Missing currencies: borrow from the same order in the other file, else the most common one, else USD.
    var cc = {}, byOrder = {};
    orders.concat(items).forEach(function (x) { if (x.currency) { cc[x.currency] = (cc[x.currency] || 0) + 1; byOrder[x.orderId] = x.currency; } });
    var main = Object.keys(cc).sort(function (a, b) { return cc[b] - cc[a]; })[0] || 'USD';
    orders.concat(items).forEach(function (x) { if (!x.currency) x.currency = byOrder[x.orderId] || main; });
    var sc = {}; statement.forEach(function (x) { if (x.currency) sc[x.currency] = (sc[x.currency] || 0) + 1; });
    var smain = Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a]; })[0] || main;
    statement.forEach(function (x) { if (!x.currency) x.currency = smain; });
    var byTs = function (a, b) { return a.ts - b.ts || (a.orderId < b.orderId ? -1 : a.orderId > b.orderId ? 1 : 0); };
    orders.sort(byTs); items.sort(byTs); statement.sort(function (a, b) { return a.ts - b.ts; });
    return { orders: orders, items: items, statement: statement, files: report, ignored: ignored };
  }

  // Zip entries worth opening (if someone zips their CSVs together). Everything else is skipped unopened.
  function wantEntry(path) {
    var p = String(path).replace(/\\/g, '/');
    if (/(^|\/)(__MACOSX|\.)/.test(p) || !/\.csv$/i.test(p)) return false;
    var base = p.split('/').pop().toLowerCase();
    if (/deposit|directcheckout|review|address|profile|message|convo|favorites|cart/.test(base)) return false;
    return /sold|order|statement/.test(base);
  }

  var api = {
    parseCSV: parseCSV, parseMoney: parseMoney, parseWhen: parseWhen, normKey: normKey, columns: columns,
    kindOf: kindOf, headerOf: headerOf, classify: classify, region: region, parseFiles: parseFiles, wantEntry: wantEntry,
    ORDER_ALIASES: ORDER_ALIASES, ITEM_ALIASES: ITEM_ALIASES, STATEMENT_ALIASES: STATEMENT_ALIASES, CATS: CATS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EtsyParser = api;
})(typeof self !== 'undefined' ? self : this);
