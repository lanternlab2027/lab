/* Year in Orders: numbers behind the cards. Pure functions over parser output; local time zone of the device. */
(function (root) {
  'use strict';

  function r2(n) { return Math.round(n * 100) / 100; }
  function local(ts) {
    var d = new Date(ts);
    return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), wd: (d.getDay() + 6) % 7, h: d.getHours(), mi: d.getMinutes(), day: Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) };
  }

  // Years with orders, newest first: [{ year, orders }]
  function years(items) {
    var m = {};
    items.forEach(function (x) { var y = local(x.ts).y; (m[y] = m[y] || {})[x.orderId] = 1; });
    return Object.keys(m).map(function (y) { return { year: +y, orders: Object.keys(m[y]).length }; }).sort(function (a, b) { return b.year - a.year; });
  }

  // Spend per currency for a set of items: [{ currency, total, items }] biggest first.
  function currencies(items) {
    var m = {};
    items.forEach(function (x) { var c = m[x.currency] || (m[x.currency] = { currency: x.currency, total: 0, items: 0 }); c.total += x.total; c.items++; });
    return Object.keys(m).map(function (k) { m[k].total = r2(m[k].total); return m[k]; }).sort(function (a, b) { return b.total - a.total || b.items - a.items; });
  }

  function itemKey(x) { return x.asin && x.asin.length >= 8 ? 'a:' + x.asin : 'n:' + x.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80); }

  // opts: { year (number or null for all time), currency, digital (bool, default true), today (ms) }
  function compute(parsed, opts) {
    opts = opts || {};
    var Y = opts.year == null ? null : +opts.year;
    var today = opts.today || Date.now();
    var all = parsed.items.filter(function (x) { return opts.digital !== false || x.kind !== 'digital'; });
    var inYear = all.filter(function (x) { return Y == null || local(x.ts).y === Y; });
    var curs = currencies(inYear);
    var cur = opts.currency && curs.some(function (c) { return c.currency === opts.currency; }) ? opts.currency : (curs[0] ? curs[0].currency : 'USD');
    var items = inYear.filter(function (x) { return x.currency === cur; });
    var s = { year: Y, currency: cur, otherCurrencies: curs.filter(function (c) { return c.currency !== cur; }), items: items };

    // orders
    var orders = {}, olist = [];
    items.forEach(function (x) {
      var o = orders[x.orderId];
      if (!o) { o = orders[x.orderId] = { id: x.orderId, ts: x.ts, timed: x.timed, total: 0, qty: 0, lines: [], kind: x.kind }; olist.push(o); }
      o.total += x.total; o.qty += x.qty; o.lines.push(x);
      if (x.ts < o.ts) o.ts = x.ts;
    });
    olist.forEach(function (o) { o.total = r2(o.total); o.at = local(o.ts); });
    olist.sort(function (a, b) { return a.ts - b.ts; });
    s.orders = olist;
    s.orderCount = olist.length;
    // Lines from the old orders summary report have no item names or counts (x.noItems).
    s.noItems = items.length > 0 && items.every(function (x) { return x.noItems; });
    s.itemCount = s.noItems ? null : items.reduce(function (a, x) { return a + (x.noItems ? 0 : x.qty); }, 0);
    s.lineCount = items.length;
    s.digitalCount = items.filter(function (x) { return x.kind === 'digital'; }).length;
    s.physicalOrders = olist.filter(function (o) { return o.kind === 'physical'; }).length;
    s.gross = r2(items.reduce(function (a, x) { return a + x.total; }, 0));

    // refunds: only those tied to an order in this period and currency
    var refunds = (parsed.refunds || []).filter(function (r) { return orders[r.orderId] && r.currency === cur; });
    s.refundTotal = r2(refunds.reduce(function (a, r) { return a + r.amount; }, 0));
    s.refundCount = refunds.length;
    s.refundOrders = Object.keys(refunds.reduce(function (m, r) { m[r.orderId] = 1; return m; }, {})).length;
    s.hasRefundFile = (parsed.files || []).some(function (f) { return f.kind === 'refunds'; });
    s.net = r2(s.gross - s.refundTotal);
    s.avgOrder = s.orderCount ? r2(s.gross / s.orderCount) : 0;
    s.medianOrder = 0;
    if (olist.length) { var srt = olist.map(function (o) { return o.total; }).sort(function (a, b) { return a - b; }); s.medianOrder = srt[Math.floor((srt.length - 1) / 2)]; }
    var buckets = [0, 0, 0, 0]; // <25, 25-100, 100-250, 250+
    olist.forEach(function (o) { buckets[o.total < 25 ? 0 : o.total < 100 ? 1 : o.total < 250 ? 2 : 3]++; });
    s.buckets = buckets;

    // period length and cadence
    if (olist.length) {
      var first = olist[0].at.day, last = olist[olist.length - 1].at.day, t = local(today).day;
      var start = Y == null ? first : Math.round(Date.UTC(Y, 0, 1) / 86400000);
      var end = Y == null ? Math.max(last, Math.min(t, last + 30)) : Math.min(Math.round(Date.UTC(Y, 11, 31) / 86400000), Math.max(t, last));
      s.spanDays = Math.max(1, end - start + 1);
      s.everyDays = s.spanDays / olist.length;
      s.firstDay = first; s.lastDay = last;
    }

    // biggest order
    s.biggest = olist.slice().sort(function (a, b) { return b.total - a.total || a.ts - b.ts; })[0] || null;

    // months, weekdays, days
    s.monthSpend = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    s.monthOrders = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    s.weekdays = [0, 0, 0, 0, 0, 0, 0];
    var perDay = {};
    olist.forEach(function (o) {
      s.monthSpend[o.at.mo - 1] += o.total; s.monthOrders[o.at.mo - 1]++; s.weekdays[o.at.wd]++;
      var d = perDay[o.at.day] || (perDay[o.at.day] = { day: o.at.day, orders: 0, total: 0 });
      d.orders++; d.total += o.total;
    });
    s.monthSpend = s.monthSpend.map(r2);
    s.perDay = perDay;
    s.activeDays = Object.keys(perDay).length;
    var pm = 0; s.monthSpend.forEach(function (v, i) { if (v > s.monthSpend[pm]) pm = i; });
    s.peakMonth = s.gross > 0 ? pm : -1;
    var pw = 0; s.weekdays.forEach(function (v, i) { if (v > s.weekdays[pw]) pw = i; });
    s.peakWeekday = pw;
    s.busiestDay = Object.keys(perDay).map(function (k) { return perDay[k]; }).sort(function (a, b) { return b.orders - a.orders || b.total - a.total || a.day - b.day; })[0] || null;
    if (s.busiestDay) s.busiestDay.total = r2(s.busiestDay.total);
    if (Y == null) {
      s.byYear = {};
      olist.forEach(function (o) { s.byYear[o.at.y] = r2((s.byYear[o.at.y] || 0) + o.total); });
    }

    // categories: only when the export has them
    s.categories = null;
    if (parsed.hasCategory) {
      var cm = {};
      items.forEach(function (x) { if (x.kind === 'physical' && x.category) { var c = cm[x.category] || (cm[x.category] = { name: x.category, total: 0, items: 0 }); c.total += x.total; c.items += x.qty; } });
      var cl = Object.keys(cm).map(function (k) { cm[k].total = r2(cm[k].total); return cm[k]; }).sort(function (a, b) { return b.total - a.total; });
      if (cl.length >= 2) s.categories = cl;
    }

    // most re-ordered: the same product (ASIN, else name) in the most separate orders
    var rm = {};
    items.forEach(function (x) {
      if (x.noItems) return;
      var k = itemKey(x), e = rm[k] || (rm[k] = { key: k, name: x.name, orders: {}, qty: 0, total: 0, last: 0 });
      e.orders[x.orderId] = 1; e.qty += x.qty; e.total += x.total; if (x.ts > e.last) { e.last = x.ts; e.name = x.name; }
    });
    var rl = Object.keys(rm).map(function (k) { var e = rm[k]; e.times = Object.keys(e.orders).length; e.total = r2(e.total); delete e.orders; return e; })
      .filter(function (e) { return e.times >= 2; }).sort(function (a, b) { return b.times - a.times || b.total - a.total; });
    s.reorder = rl[0] || null;
    s.reorderCount = rl.length;

    // late night: orders placed between midnight and 4:59 (device time). Needs real timestamps.
    s.timed = olist.some(function (o) { return o.timed; });
    if (s.timed) {
      var late = olist.filter(function (o) { return o.timed && o.at.h < 5; });
      s.late = { count: late.length, total: r2(late.reduce(function (a, o) { return a + o.total; }, 0)), share: late.length / olist.length, latest: null };
      late.forEach(function (o) { var m = o.at.h * 60 + o.at.mi; if (!s.late.latest || m > s.late.latest.min) s.late.latest = { min: m, ts: o.ts, total: o.total }; });
      s.hours = new Array(24).fill(0);
      olist.forEach(function (o) { if (o.timed) s.hours[o.at.h]++; });
    } else s.late = null;

    // the top item (most money on a single product line), used only if the person opts in
    var ti = {};
    items.forEach(function (x) { if (x.noItems) return; var k = itemKey(x), e = ti[k] || (ti[k] = { name: x.name, total: 0, qty: 0 }); e.total += x.total; e.qty += x.qty; });
    s.topItem = Object.keys(ti).map(function (k) { return ti[k]; }).sort(function (a, b) { return b.total - a.total; })[0] || null;

    // all time, for the "since" line
    var allCur = all.filter(function (x) { return x.currency === cur; });
    s.allTime = r2(allCur.reduce(function (a, x) { return a + x.total; }, 0));
    s.firstYear = allCur.length ? local(allCur[0].ts).y : null;
    if (Y != null) {
      var prev = all.filter(function (x) { return x.currency === cur && local(x.ts).y === Y - 1; });
      s.prevGross = prev.length ? r2(prev.reduce(function (a, x) { return a + x.total; }, 0)) : null;
    }
    return s;
  }

  var api = { compute: compute, years: years, currencies: currencies, local: local, itemKey: itemKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AmazonStats = api;
})(typeof self !== 'undefined' ? self : this);
