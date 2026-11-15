/* Year in Review for Etsy sellers: the numbers behind the cards and the tax summary.
 * Pure functions over parser output. Dates are calendar days pinned to local noon by the parser. */
(function (root) {
  'use strict';

  var CATS = (root.EtsyParser || (typeof require !== 'undefined' ? require('./parser.js') : {})).CATS;

  function r2(n) { return Math.round(n * 100) / 100; }
  function local(ts) {
    var d = new Date(ts);
    return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), wd: (d.getDay() + 6) % 7, day: Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) };
  }

  // Orders from the orders file, or rebuilt from order items when that is all there is.
  function orderList(parsed) {
    if (parsed.orders.length) return parsed.orders;
    var m = {}, out = [];
    parsed.items.forEach(function (x) {
      var o = m[x.orderId];
      if (!o) { o = m[x.orderId] = { orderId: x.orderId, ts: x.ts, items: 0, sales: 0, shipping: 0, refund: 0, full: false, refunded: false, currency: x.currency, country: x.country, state: x.state, buyer: x.buyer, derived: true }; out.push(o); }
      o.items += x.qty; o.sales = r2(o.sales + x.total);
    });
    return out;
  }

  function years(parsed) {
    var m = {};
    orderList(parsed).forEach(function (o) { var y = local(o.ts).y; m[y] = (m[y] || 0) + 1; });
    parsed.statement.forEach(function (s) { var y = local(s.ts).y; if (!m[y]) m[y] = 0; });
    return Object.keys(m).map(function (y) { return { year: +y, orders: m[y] }; }).sort(function (a, b) { return b.year - a.year; });
  }

  function currencies(list, amount) {
    var m = {};
    list.forEach(function (x) { var c = m[x.currency] || (m[x.currency] = { currency: x.currency, total: 0, n: 0 }); c.total += amount(x); c.n++; });
    return Object.keys(m).map(function (k) { m[k].total = r2(m[k].total); return m[k]; }).sort(function (a, b) { return b.n - a.n || b.total - a.total; });
  }

  function itemKey(x) { return x.listingId ? 'l:' + x.listingId : 'n:' + x.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80); }
  function maxIdx(a) { var b = 0; for (var i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; }

  // opts: { year, currency }
  function compute(parsed, opts) {
    opts = opts || {};
    var Y = opts.year == null ? null : +opts.year;
    var all = orderList(parsed);
    var inYear = all.filter(function (o) { return Y == null || local(o.ts).y === Y; });
    var curs = currencies(inYear, function (o) { return o.sales; });
    var cur = opts.currency && curs.some(function (c) { return c.currency === opts.currency; }) ? opts.currency : (curs[0] ? curs[0].currency : 'USD');
    var mine = inYear.filter(function (o) { return o.currency === cur; });
    var live = mine.filter(function (o) { return !o.full; });
    var s = { year: Y, currency: cur, otherCurrencies: curs.filter(function (c) { return c.currency !== cur; }), fromItemsOnly: !parsed.orders.length };
    s.cancelled = mine.length - live.length;
    s.orderCount = live.length;
    var ids = {}; live.forEach(function (o) { ids[o.orderId] = 1; });
    var items = parsed.items.filter(function (x) { return ids[x.orderId] && x.currency === cur; });
    s.hasItems = items.length > 0;
    var qtyFromItems = items.reduce(function (a, x) { return a + x.qty; }, 0);
    var qtyFromOrders = live.reduce(function (a, o) { return a + (o.items || 0); }, 0);
    s.itemCount = Math.max(qtyFromOrders, qtyFromItems) || live.length;
    s.sales = r2(live.reduce(function (a, o) { return a + o.sales; }, 0));
    s.shipping = r2(live.reduce(function (a, o) { return a + (o.shipping || 0); }, 0));
    s.refunds = r2(mine.reduce(function (a, o) { return a + (o.refund || 0); }, 0));
    s.refundOrders = mine.filter(function (o) { return o.refunded; }).length;
    s.revenue = r2(s.sales + s.shipping - s.refunds);
    s.avgOrder = s.orderCount ? r2((s.sales + s.shipping) / s.orderCount) : 0;
    s.itemsPerOrder = s.orderCount ? s.itemCount / s.orderCount : 0;

    // best sellers (needs the order items file)
    var g = {}, gl = [];
    items.forEach(function (x) {
      var k = itemKey(x), e = g[k];
      if (!e) { e = g[k] = { name: x.name, qty: 0, total: 0, orders: {} }; gl.push(e); }
      e.qty += x.qty; e.total += x.total; e.orders[x.orderId] = 1;
    });
    gl.forEach(function (e) { e.total = r2(e.total); e.orderCount = Object.keys(e.orders).length; delete e.orders; });
    gl.sort(function (a, b) { return b.qty - a.qty || b.total - a.total; });
    s.best = gl.slice(0, 5);
    s.listingCount = gl.length;

    // when
    var mo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], moSales = mo.slice(), wd = [0, 0, 0, 0, 0, 0, 0], perDay = {};
    live.forEach(function (o) {
      var t = local(o.ts); mo[t.mo - 1]++; moSales[t.mo - 1] += o.sales + (o.shipping || 0); wd[t.wd]++;
      perDay[t.day] = (perDay[t.day] || 0) + 1;
    });
    s.monthOrders = mo; s.monthSales = moSales.map(r2); s.weekdays = wd; s.perDay = perDay;
    s.peakMonth = s.orderCount ? maxIdx(mo) : -1;
    s.peakWeekday = s.orderCount ? maxIdx(wd) : -1;
    var bd = null;
    Object.keys(perDay).forEach(function (d) { if (!bd || perDay[d] > bd.orders || (perDay[d] === bd.orders && +d < bd.day)) bd = { day: +d, orders: perDay[d] }; });
    s.busiestDay = bd;
    s.activeDays = Object.keys(perDay).length;
    s.lastDay = s.activeDays ? Math.max.apply(null, Object.keys(perDay).map(Number)) : 0;
    if (Y == null) {
      var by = {}; live.forEach(function (o) { var y = local(o.ts).y; by[y] = (by[y] || 0) + 1; }); s.byYear = by;
    }

    // where (aggregate counts only)
    var ctry = {}, st = {}, us = 0, located = 0;
    live.forEach(function (o) {
      if (o.country) { located++; ctry[o.country] = (ctry[o.country] || 0) + 1; }
      if (o.state) { us++; st[o.state] = (st[o.state] || 0) + 1; }
    });
    function top(m) { return Object.keys(m).map(function (k) { return { name: k, orders: m[k] }; }).sort(function (a, b) { return b.orders - a.orders || (a.name < b.name ? -1 : 1); }); }
    s.countries = top(ctry); s.states = top(st); s.located = located;
    s.home = s.countries[0] ? s.countries[0].name : '';
    s.intl = located ? located - (s.countries[0] ? s.countries[0].orders : 0) : 0;

    // repeat buyers: salted hashes only; nothing about a buyer is ever shown
    var bh = {}, withBuyer = 0;
    live.forEach(function (o) { if (o.buyer) { withBuyer++; bh[o.buyer] = (bh[o.buyer] || 0) + 1; } });
    var buyers = Object.keys(bh).length, rep = Object.keys(bh).filter(function (k) { return bh[k] > 1; }).length;
    s.repeat = withBuyer >= Math.max(5, live.length * 0.5) && buyers ? { buyers: buyers, repeatBuyers: rep, share: rep / buyers, ordersFromRepeat: Object.keys(bh).reduce(function (a, k) { return a + (bh[k] > 1 ? bh[k] : 0); }, 0) } : null;

    // year over year
    if (Y != null) {
      var prev = all.filter(function (o) { return !o.full && o.currency === cur && local(o.ts).y === Y - 1; });
      s.prevOrders = prev.length;
      s.prevSales = r2(prev.reduce(function (a, o) { return a + o.sales + (o.shipping || 0); }, 0));
    }
    var fy = all.length ? local(all[0].ts).y : null;
    s.firstYear = fy;
    return s;
  }

  // ---------- tax summary ----------
  function blank() { var c = {}; CATS.forEach(function (k) { c[k.key] = 0; }); return { sales: 0, taxCollected: 0, taxRefunded: 0, refunds: 0, adjust: 0, cats: c, rows: 0 }; }
  function finish(m) {
    m.fees = r2(CATS.reduce(function (a, k) { return a + m.cats[k.key]; }, 0));
    m.gross = r2(m.sales - m.taxCollected);
    m.refundsNet = r2(m.refunds - m.taxRefunded);
    m.net = r2(m.gross - m.refundsNet - m.fees + m.adjust);
    Object.keys(m.cats).forEach(function (k) { m.cats[k] = r2(m.cats[k]); });
    ['sales', 'taxCollected', 'taxRefunded', 'refunds', 'adjust'].forEach(function (k) { m[k] = r2(m[k]); });
    return m;
  }

  // opts: { year, currency }. Uses the monthly statement when present; otherwise the orders file (no fees).
  function tax(parsed, opts) {
    opts = opts || {};
    var Y = opts.year == null ? null : +opts.year;
    var rows = parsed.statement.filter(function (r) { return Y == null || local(r.ts).y === Y; });
    var out = { year: Y, source: rows.length ? 'statement' : 'orders' };
    if (rows.length) {
      var curs = currencies(rows, function (r) { return Math.abs(r.net); });
      var cur = opts.currency && curs.some(function (c) { return c.currency === opts.currency; }) ? opts.currency : curs[0].currency;
      out.currency = cur; out.otherCurrencies = curs.filter(function (c) { return c.currency !== cur; }).map(function (c) { return c.currency; });
      var months = [], T = blank(), deposits = 0, depositCount = 0, payments = 0, netSum = 0, months12 = {};
      for (var i = 0; i < 12; i++) months.push(blank());
      rows.filter(function (r) { return r.currency === cur; }).forEach(function (r) {
        var t = local(r.ts), M = Y == null ? (months12[t.y + '-' + t.mo] = months12[t.y + '-' + t.mo] || blank()) : months[t.mo - 1];
        [M, T].forEach(function (m) {
          m.rows++;
          if (r.kind === 'deposit') return;
          if (r.kind === 'payment') return;
          if (r.kind === 'sale') { m.sales += r.amount; if (r.fees) m.cats.processing += -r.fees; }
          else if (r.kind === 'refund') { m.refunds += -r.amount; if (r.fees) m.cats.processing += -r.fees; }
          else if (r.kind === 'tax') { if (r.net < 0) m.taxCollected += -r.net; else m.taxRefunded += r.net; }
          else if (r.kind === 'adjust') m.adjust += r.net;
          else m.cats[r.kind] += -r.net;
        });
        if (r.kind === 'deposit') depositCount++;
        else if (r.kind === 'payment') payments += r.net;
        else netSum += r.net;
      });
      out.total = finish(T);
      out.months = Y == null ? Object.keys(months12).sort(function (a, b) { var p = a.split('-'), q = b.split('-'); return p[0] - q[0] || p[1] - q[1]; }).map(function (k) { var m = finish(months12[k]); m.label = k; return m; })
        : months.map(function (m, i) { m = finish(m); m.label = Y + '-' + String(i + 1).padStart(2, '0'); return m; });
      out.statementNet = r2(netSum);
      out.check = Math.abs(out.statementNet - out.total.net) < 0.02;
      out.depositCount = depositCount; out.payments = r2(payments);
      var mset = {}; rows.forEach(function (r) { var t = local(r.ts); mset[t.y + '-' + t.mo] = 1; });
      out.monthsCovered = Object.keys(mset).length;
    }
    // From the orders file: sales, shipping charged, refunds by month (no fees in that file).
    var ol = orderList(parsed).filter(function (o) { return Y == null || local(o.ts).y === Y; });
    var oc = currencies(ol, function (o) { return o.sales; });
    var ocur = out.currency && oc.some(function (c) { return c.currency === out.currency; }) ? out.currency : opts.currency && oc.some(function (c) { return c.currency === opts.currency; }) ? opts.currency : (oc[0] ? oc[0].currency : 'USD');
    var om = [], OT = { sales: 0, shipping: 0, refunds: 0, salesTax: 0, orders: 0 };
    for (var j = 0; j < 12; j++) om.push({ sales: 0, shipping: 0, refunds: 0, orders: 0 });
    ol.filter(function (o) { return o.currency === ocur; }).forEach(function (o) {
      var t = local(o.ts), m = om[t.mo - 1];
      [m, OT].forEach(function (x) { x.sales += o.sales; x.shipping += o.shipping || 0; x.refunds += o.refund || 0; x.orders += o.full ? 0 : 1; });
      OT.salesTax += o.salesTax || 0;
    });
    om.forEach(function (m) { m.sales = r2(m.sales); m.shipping = r2(m.shipping); m.refunds = r2(m.refunds); m.gross = r2(m.sales + m.shipping); m.net = r2(m.gross - m.refunds); });
    Object.keys(OT).forEach(function (k) { OT[k] = r2(OT[k]); });
    OT.gross = r2(OT.sales + OT.shipping); OT.net = r2(OT.gross - OT.refunds);
    out.orders = { currency: ocur, months: om, total: OT, n: ol.length, otherCurrencies: oc.filter(function (c) { return c.currency !== ocur; }).map(function (c) { return c.currency; }) };
    if (!rows.length) out.currency = ocur;
    return out;
  }

  var api = { compute: compute, tax: tax, years: years, local: local, orderList: orderList, CATS: CATS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EtsyStats = api;
})(typeof self !== 'undefined' ? self : this);
