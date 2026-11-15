/* Year in Review for Etsy sellers: page controller. Everything happens in this tab; shop files are never sent anywhere. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var P = window.EtsyParser, S = window.EtsyStats, C = window.EtsyCards;

  var state = { files: [], parsed: null, stats: null, tax: null, cards: [], canvases: [], year: null, currency: '', hidden: {}, sample: false };
  var pool = [];
  var fileInput = $('#file'), drop = $('#drop'), status = $('#status');
  var results = $('#results'), deck = $('#deck'), yearSel = $('#year'), curSel = $('#currency'), empty = $('#empty');
  var NOW = new Date(), CURRENT = NOW.getFullYear();
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function say(msg, isError) {
    status.textContent = msg || '';
    status.className = 'status' + (isError ? ' err' : '');
    if (isError) {
      var help = document.createElement('a'); help.href = '#download'; help.textContent = 'How to download your files';
      var demo = document.createElement('button'); demo.type = 'button'; demo.className = 'linkbtn'; demo.textContent = 'see a sample shop';
      demo.addEventListener('click', showSample);
      status.appendChild(document.createTextNode(' ')); status.appendChild(help);
      status.appendChild(document.createTextNode(' or ')); status.appendChild(demo); status.appendChild(document.createTextNode('.'));
    }
  }

  // ---------- share links: ?ref= passthrough (URL only, nothing stored) ----------
  var APP_URL = 'https://lanternlab2027.github.io/lab/etsy/';
  function nextRef() {
    var r = '';
    try { r = new URLSearchParams(location.search).get('ref') || ''; } catch (e) { r = ''; }
    r = r.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    if (!r) return 'share';
    var m = /^share(\d*)(?:-(.+))?$/.exec(r);
    if (m) return 'share' + ((m[1] ? +m[1] : 1) + 1) + (m[2] ? '-' + m[2] : '');
    return 'share-' + r;
  }
  var SHARE_URL = APP_URL + '?ref=' + encodeURIComponent(nextRef());
  var SHARE_LEAD = 'My shop\u2019s year in review. Make yours from your Etsy CSVs (free, nothing uploaded):';
  function shareText() { return SHARE_LEAD + ' ' + SHARE_URL; }

  // ---------- reading files ----------
  async function readFiles(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var file = list[i], name = file.name || 'file.csv';
      if (/\.zip$/i.test(name) || /zip/.test(file.type)) {
        if (!window.JSZip) throw new Error('Zip support failed to load. Unzip the file and upload the CSVs inside.');
        var zip = await window.JSZip.loadAsync(file), entries = [];
        zip.forEach(function (path, entry) { if (!entry.dir && P.wantEntry(path)) entries.push(entry); });
        for (var j = 0; j < entries.length; j++) out.push({ name: entries[j].name.split('/').pop(), text: await entries[j].async('string') });
      } else {
        if (file.size > 100 * 1024 * 1024) throw new Error(name + ' is too big to be a shop CSV.');
        out.push({ name: name, text: await file.text() });
      }
    }
    return out;
  }

  async function handleFiles(list) {
    if (!list || !list.length) return;
    say('Reading your files on this device\u2026');
    try {
      var got = await readFiles(list);
      await new Promise(function (res) { setTimeout(res, 20); });
      // Adding files keeps the ones already loaded (orders first, statements later works); exact repeats count once.
      var all = (state.sample ? [] : state.files).concat(got);
      var parsed = P.parseFiles(all);
      if (!parsed.orders.length && !parsed.items.length && !parsed.statement.length) {
        say(got.length && P.parseFiles(got).files.length ? 'Those files have no orders or statement rows we could read (the dates may be in a format we don\u2019t know).'
          : 'That doesn\u2019t look like an Etsy orders, order items or monthly statement CSV. Upload the files exactly as Etsy gave them.', true);
        return;
      }
      state.files = all; state.sample = false;
      load(parsed);
    } catch (e) {
      say(e.message || 'Something went wrong reading that file.', true);
    }
  }

  function load(parsed) {
    state.parsed = parsed; state.currency = '';
    var ys = S.years(parsed);
    if (!ys.some(function (y) { return y.year === CURRENT; })) ys.push({ year: CURRENT, orders: 0 });
    ys.sort(function (a, b) { return b.year - a.year; });
    yearSel.innerHTML = ys.map(function (y) { return '<option value="' + y.year + '">' + y.year + ' (' + y.orders.toLocaleString('en-US') + (y.orders === 1 ? ' order' : ' orders') + ')</option>'; }).join('') + '<option value="all">All years</option>';
    var cur = ys.filter(function (y) { return y.year === CURRENT; })[0];
    var hasStmt = function (y) { return parsed.statement.some(function (r) { return S.local(r.ts).y === y; }); };
    var latest = ys.filter(function (y) { return y.orders > 0 || hasStmt(y.year); })[0];
    state.year = cur && (cur.orders || hasStmt(CURRENT)) ? CURRENT : latest ? latest.year : CURRENT;
    yearSel.value = String(state.year);
    var kinds = { orders: 0, items: 0, statement: 0 };
    parsed.files.forEach(function (f) { kinds[f.kind]++; });
    var bits = [];
    if (kinds.orders) bits.push(kinds.orders + ' orders ' + (kinds.orders === 1 ? 'file' : 'files'));
    if (kinds.items) bits.push(kinds.items + ' order items ' + (kinds.items === 1 ? 'file' : 'files'));
    if (kinds.statement) bits.push(kinds.statement + ' monthly ' + (kinds.statement === 1 ? 'statement' : 'statements'));
    var msg = 'Read ' + bits.join(', ') + (parsed.ignored.length ? ' (skipped ' + parsed.ignored.length + ' other ' + (parsed.ignored.length === 1 ? 'file' : 'files') + ')' : '') + '. Nothing was uploaded.';
    if (state.year !== CURRENT) msg += ' Nothing from ' + CURRENT + ' yet, so we\u2019re showing ' + state.year + '.';
    if (!kinds.statement) msg += ' Add your monthly statements for the fees in the tax summary.';
    say(msg);
    setTab('recap');
    render();
    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- recap ----------
  function money(n, cur) { return C.money(n, cur || (state.stats && state.stats.currency), true); }
  function cardTitle(name) {
    name = (name || '').trim();
    var who = name ? name : 'My shop';
    return state.year == null ? who + ', all years' : who + '\u2019s ' + state.year;
  }

  function describe(s) {
    var period = state.year == null ? 'all years' : String(state.year), bits = [];
    bits.push('Counting ' + s.orderCount.toLocaleString('en-US') + ' orders from ' + period + ' in ' + s.currency + (s.fromItemsOnly ? ' (rebuilt from the order items file)' : ''));
    bits.push(money(s.sales) + ' in item sales after discounts' + (s.shipping ? ' + ' + money(s.shipping) + ' shipping charged' : '') + (s.refunds ? ' \u2212 ' + money(s.refunds) + ' refunded on ' + s.refundOrders + (s.refundOrders === 1 ? ' order' : ' orders') : '') + ' = ' + money(s.revenue) + ', before fees and without sales tax');
    var extra = [];
    if (s.cancelled) extra.push(s.cancelled + ' cancelled or fully refunded ' + (s.cancelled === 1 ? 'order' : 'orders') + ' left out of the counts');
    if (!s.hasItems) extra.push('no order items file, so no best-seller card');
    if (!s.repeat && s.orderCount) extra.push('no buyer IDs in these files, so no repeat-buyer card');
    s.otherCurrencies.forEach(function (c) { extra.push(c.n + ' ' + c.currency + ' ' + (c.n === 1 ? 'order' : 'orders') + ' not included (switch currency above)'); });
    return bits.join(': ') + '.' + (extra.length ? ' ' + extra.join('; ') + '.' : '');
  }

  function currencyOptions() {
    var Y = state.year, seen = {}, list = [];
    S.orderList(state.parsed).forEach(function (o) { if ((Y == null || S.local(o.ts).y === Y) && !seen[o.currency]) { seen[o.currency] = 1; list.push(o.currency); } });
    state.parsed.statement.forEach(function (r) { if ((Y == null || S.local(r.ts).y === Y) && !seen[r.currency]) { seen[r.currency] = 1; list.push(r.currency); } });
    return list;
  }

  function info() {
    var name = $('#name-input').value.trim();
    return { title: cardTitle(name), shopLine: name ? name.toUpperCase() : 'MY SHOP', year: state.year, periodShort: state.year == null ? 'All years' : String(state.year),
      showRevenue: $('#revenue').checked, showNames: $('#names').checked, handmade: $('#handmade').checked };
  }

  function render() {
    var stats = S.compute(state.parsed, { year: state.year, currency: state.currency || undefined });
    state.stats = stats;
    var curs = currencyOptions();
    $('#currency-wrap').hidden = curs.length < 2;
    curSel.innerHTML = curs.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
    if (curs.length) curSel.value = state.currency && curs.indexOf(state.currency) >= 0 ? state.currency : stats.orderCount ? stats.currency : curs[0];
    renderTax();
    deck.innerHTML = ''; state.canvases = []; state.cards = [];
    if (!stats.orderCount) {
      empty.hidden = false;
      empty.textContent = (state.parsed.orders.length || state.parsed.items.length ? 'No orders ' + (state.year == null ? 'in these files' : 'in ' + state.year) + '. Pick another year above.' : 'Only statements so far: the cards need your Orders CSV (and Order Items for the best seller). The tax summary works now.');
      $('#deck-count').textContent = '0 cards'; $('#included').textContent = ''; $('#included').hidden = true; $('#picker').innerHTML = '';
      return;
    }
    $('#included').hidden = false;
    $('#included').textContent = describe(stats);
    empty.hidden = true;
    var inf = info();
    var built = C.build(stats, inf);
    // picker
    var pk = $('#picker'); pk.innerHTML = '';
    built.forEach(function (card) {
      var l = document.createElement('label'), cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = !state.hidden[card.id]; cb.setAttribute('data-card', card.id);
      cb.addEventListener('change', function () { if (cb.checked) delete state.hidden[card.id]; else state.hidden[card.id] = 1; render(); });
      l.appendChild(cb); l.appendChild(document.createTextNode(card.label)); pk.appendChild(l);
    });
    var cards = built.filter(function (c) { return !state.hidden[c.id]; });
    state.cards = cards;
    cards.forEach(function (card, i) {
      var fig = document.createElement('figure'); fig.className = 'card';
      var cv = pool[i] || (pool[i] = document.createElement('canvas'));
      cv.width = C.W; cv.height = C.H;
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Card ' + (i + 1) + ': ' + card.label);
      C.render(cv, card, stats, inf, i + 1, cards.length);
      var cap = document.createElement('figcaption');
      var lbl = document.createElement('span'); lbl.textContent = (i + 1) + '. ' + card.label;
      var share = document.createElement('button'); share.type = 'button'; share.className = 'btn small'; share.textContent = 'Share';
      var save = document.createElement('button'); save.type = 'button'; save.className = 'btn small ghost'; save.textContent = 'Save PNG';
      share.addEventListener('click', function () { shareOne(i); });
      save.addEventListener('click', function () { saveOne(i); });
      var btns = document.createElement('div'); btns.className = 'card-btns'; btns.appendChild(share); btns.appendChild(save);
      cap.appendChild(lbl); cap.appendChild(btns); fig.appendChild(cv); fig.appendChild(cap);
      deck.appendChild(fig); state.canvases.push(cv);
    });
    $('#deck-count').textContent = cards.length + (cards.length === 1 ? ' card' : ' cards');
    if (!cards.length) { empty.hidden = false; empty.textContent = 'All cards are switched off. Tick some under \u201cCards\u201d below.'; }
  }

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function fileName(i) { return 'shop-year-in-review-' + (state.year || 'all-years') + '-' + String(i + 1).padStart(2, '0') + '-' + slug(state.cards[i].label) + '.png'; }
  function blobOf(i) { return new Promise(function (res) { state.canvases[i].toBlob(res, 'image/png'); }); }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  async function saveOne(i) { download(await blobOf(i), fileName(i)); }
  async function shareFiles(files) {
    if (navigator.canShare && navigator.share && navigator.canShare({ files: files })) {
      try { await navigator.share({ files: files, title: 'Seller Year in Review', text: shareText() }); return true; }
      catch (e) { if (e && e.name === 'AbortError') return true; }
    }
    return false;
  }
  async function shareOne(i) {
    var blob = await blobOf(i), file = new File([blob], fileName(i), { type: 'image/png' });
    if (!(await shareFiles([file]))) download(blob, fileName(i));
  }
  async function zipAll() {
    var btn = $('#zip-all'); btn.disabled = true; var t = btn.textContent; btn.textContent = 'Zipping\u2026';
    try {
      var zip = new window.JSZip();
      for (var i = 0; i < state.canvases.length; i++) zip.file(fileName(i), await blobOf(i));
      download(await zip.generateAsync({ type: 'blob' }), 'shop-year-in-review-' + (state.year || 'all-years') + '.zip');
    } finally { btn.disabled = false; btn.textContent = t; }
  }
  async function shareAll() {
    var files = [];
    for (var i = 0; i < state.canvases.length; i++) files.push(new File([await blobOf(i)], fileName(i), { type: 'image/png' }));
    if (!(await shareFiles(files))) zipAll();
  }

  // ---------- tax summary ----------
  function el(tag, text, cls) { var e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }
  function row(tbody, cells, cls) {
    var tr = el('tr', null, cls);
    cells.forEach(function (c, i) { var td = el('td', c == null ? '' : String(c)); if (i && /^\u2212/.test(String(c))) td.className = 'neg'; tr.appendChild(td); });
    tbody.appendChild(tr);
  }
  function head(table, cells) { var th = table.querySelector('thead'); th.innerHTML = ''; var tr = el('tr'); cells.forEach(function (c) { tr.appendChild(el('th', c)); }); th.appendChild(tr); }
  function m2(n, cur) { return money(n, cur); }
  function neg(n, cur) { return Math.abs(n) < 0.005 ? m2(0, cur) : '\u2212' + m2(Math.abs(n), cur); }
  function signed(n, cur) { return n < -0.004 ? neg(n, cur) : m2(n, cur); }
  function monthLabel(m) { var p = m.label.split('-'); return MONTHS[+p[1] - 1] + (state.year == null ? ' ' + p[0] : ''); }
  var FEES = ['transaction', 'processing', 'listing', 'regulatory', 'subscription', 'otherFees', 'vat'];
  function sumKeys(m, keys) { return keys.reduce(function (a, k) { return a + m.cats[k]; }, 0); }

  function renderTax() {
    if (!state.parsed) return;
    var t = S.tax(state.parsed, { year: state.year, currency: state.currency || (state.stats && state.stats.currency) || undefined });
    state.tax = t;
    var cur = t.currency, src = $('#tax-source'), tiles = $('#totals'), cats = $('#cats'), months = $('#months');
    tiles.innerHTML = ''; cats.querySelector('tbody').innerHTML = ''; months.querySelector('tbody').innerHTML = '';
    function tile(label, value, cls) { var d = el('div', null, cls); d.appendChild(el('span', label)); d.appendChild(el('b', value)); tiles.appendChild(d); }
    var period = state.year == null ? 'all years' : String(state.year);
    $('#cat-h').hidden = false;
    if (t.source === 'statement') {
      var T = t.total;
      var srcMsg = 'From ' + t.monthsCovered + (t.monthsCovered === 1 ? ' month' : ' months') + ' of monthly statements for ' + period + ', in ' + cur + '.';
      if (state.year != null && t.monthsCovered < 12) srcMsg += ' Months with no statement rows show as zero; add any missing statements for a full year.';
      if (t.otherCurrencies.length) srcMsg += ' Rows in ' + t.otherCurrencies.join(', ') + ' are not included; switch currency above.';
      if (t.orders.n && t.orders.currency !== cur) srcMsg += ' Your orders are in ' + t.orders.currency + ', so the orders cross-check below is in ' + t.orders.currency + '.';
      srcMsg += t.check ? ' The net below matches the sum of the Net column in your statements.' : ' Heads up: the net below differs from the sum of the Net column (' + m2(t.statementNet, cur) + ') because some rows could not be sorted; check them in the files.';
      src.textContent = srcMsg;
      var ads = T.cats.offsite + T.cats.ads, fees = sumKeys(T, FEES);
      tile('Gross sales', m2(T.gross, cur)); tile('Refunds', neg(T.refundsNet, cur)); tile('Etsy fees', neg(fees, cur));
      tile('Ads', neg(ads, cur)); tile('Shipping labels', neg(T.cats.labels, cur)); tile('Net', m2(T.net, cur), 'net');
      head(cats, ['Category', period]);
      var tb = cats.querySelector('tbody');
      row(tb, ['Sales (as paid by buyers)', m2(T.sales, cur)]);
      row(tb, ['Sales tax and VAT collected and paid by Etsy', neg(T.taxCollected, cur)], 'sub');
      row(tb, ['Gross sales', m2(T.gross, cur)], 'sum');
      row(tb, ['Refunds to buyers (less tax refunded)', neg(T.refundsNet, cur)]);
      S.CATS.forEach(function (c) { if (Math.abs(T.cats[c.key]) >= 0.005 || ['transaction', 'processing', 'listing', 'offsite', 'ads', 'labels'].indexOf(c.key) >= 0) row(tb, [c.name, neg(T.cats[c.key], cur)]); });
      row(tb, ['All fees, ads and labels', neg(T.fees, cur)], 'sum');
      if (Math.abs(T.adjust) >= 0.005) row(tb, ['Other credits and adjustments', signed(T.adjust, cur)]);
      row(tb, ['Net', m2(T.net, cur)], 'net');
      head(months, ['Month', 'Gross sales', 'Refunds', 'Etsy fees', 'Ads', 'Labels', 'Net']);
      var mb = months.querySelector('tbody');
      t.months.forEach(function (m) { row(mb, [monthLabel(m), m2(m.gross, cur), neg(m.refundsNet, cur), neg(sumKeys(m, FEES), cur), neg(m.cats.offsite + m.cats.ads, cur), neg(m.cats.labels, cur), m2(m.net + 0, cur)]); });
      row(mb, ['Total', m2(T.gross, cur), neg(T.refundsNet, cur), neg(fees, cur), neg(ads, cur), neg(T.cats.labels, cur), m2(T.net, cur)], 'sum');
      var O = t.orders.total;
      $('#tax-foot').textContent = 'Etsy fees = transaction, processing, listing, regulatory, subscription, other fees and VAT on fees. Credits Etsy gave back are already netted in. Statements count money when Etsy posts it, so a late-December order can land in January. ' + (t.orders.n ? 'Cross-check from your orders file (' + t.orders.currency + '): ' + m2(O.sales, t.orders.currency) + ' item sales + ' + m2(O.shipping, t.orders.currency) + ' shipping charged, ' + m2(O.refunds, t.orders.currency) + ' refunded. ' : '') + 'Deposits to your bank (' + t.depositCount + ') are transfers, not income, and are left out.' + (t.payments ? ' Card charges to cover a negative balance (' + m2(t.payments, cur) + ') are left out too.' : '');
    } else {
      var O2 = t.orders.total, oc = t.orders.currency;
      src.textContent = 'From your orders file for ' + period + ', in ' + oc + '. The orders file has no Etsy fees, ads or shipping labels: add your monthly statements (Finances \u2192 Monthly statements \u2192 Download CSV) for the full fees summary.';
      tile('Item sales', m2(O2.sales, oc)); tile('Shipping charged', m2(O2.shipping, oc)); tile('Refunds', neg(O2.refunds, oc)); tile('Before fees', m2(O2.net, oc), 'net');
      $('#cat-h').hidden = true; head(cats, []);
      head(months, ['Month', 'Orders', 'Item sales', 'Shipping', 'Refunds', 'Before fees']);
      var mb2 = months.querySelector('tbody');
      t.orders.months.forEach(function (m, i) { row(mb2, [MONTHS[i], m.orders, m2(m.sales, oc), m2(m.shipping, oc), neg(m.refunds, oc), m2(m.net, oc)]); });
      row(mb2, ['Total', O2.orders, m2(O2.sales, oc), m2(O2.shipping, oc), neg(O2.refunds, oc), m2(O2.net, oc)], 'sum');
      $('#tax-foot').textContent = 'Item sales are order value minus discounts. Sales tax Etsy collected (' + m2(O2.salesTax, oc) + ' where the file shows it) is left out. Refunds come from cancelled orders and the Adjusted Order Total column.';
      if (state.year == null) $('#tax-foot').textContent += ' With all years selected, months combine every year.';
    }
  }

  function csvCell(v) {
    v = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v)) v = "'" + v;
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function n2(n) { return (Math.abs(n) < 0.005 ? 0 : n).toFixed(2); }
  function exportCSV() {
    var t = state.tax; if (!t) return;
    var lines = [], period = state.year == null ? 'all-years' : String(state.year);
    if (t.source === 'statement') {
      var cols = t.months.map(function (m) { return { name: m.label, m: m }; }).concat([{ name: 'Total', m: t.total }]);
      lines.push(['Category (' + t.currency + ')'].concat(cols.map(function (c) { return c.name; })));
      var def = [
        ['Sales (as paid by buyers)', function (m) { return m.sales; }],
        ['Sales tax/VAT collected by Etsy', function (m) { return -m.taxCollected; }],
        ['Gross sales', function (m) { return m.gross; }],
        ['Refunds to buyers (less tax refunded)', function (m) { return -m.refundsNet; }]
      ].concat(S.CATS.map(function (c) { return [c.name, function (m) { return -m.cats[c.key]; }]; })).concat([
        ['All fees, ads and labels', function (m) { return -m.fees; }],
        ['Other credits and adjustments', function (m) { return m.adjust; }],
        ['Net', function (m) { return m.net; }]
      ]);
      def.forEach(function (d) { lines.push([d[0]].concat(cols.map(function (c) { return n2(d[1](c.m)); }))); });
    } else {
      var oc = t.orders.currency;
      lines.push(['Month', 'Orders', 'Item sales (' + oc + ')', 'Shipping charged', 'Refunds', 'Before fees']);
      t.orders.months.forEach(function (m, i) { lines.push([(state.year || 'All') + '-' + String(i + 1).padStart(2, '0'), m.orders, n2(m.sales), n2(m.shipping), n2(-m.refunds), n2(m.net)]); });
      var O = t.orders.total; lines.push(['Total', O.orders, n2(O.sales), n2(O.shipping), n2(-O.refunds), n2(O.net)]);
      lines.push(['No Etsy fees in the orders file. Add monthly statements for fees, ads and shipping labels.']);
    }
    lines.push([]);
    lines.push(['Not tax advice. Your accountant should confirm these figures. Made with Seller Year in Review (lanternlab2027.github.io/lab/etsy) from your own Etsy CSVs. Not affiliated with Etsy.']);
    var text = lines.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
    download(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }), 'etsy-sales-fees-summary-' + period + '.csv');
  }

  function setTab(which) {
    ['recap', 'tax'].forEach(function (t) {
      var on = t === which, tab = $('#tab-' + t);
      tab.setAttribute('aria-selected', on ? 'true' : 'false'); tab.tabIndex = on ? 0 : -1;
      $('#panel-' + t).hidden = !on;
    });
    if (which === 'tax') renderTax();
  }

  // ---------- wiring ----------
  fileInput.addEventListener('change', function () { var l = Array.prototype.slice.call(fileInput.files || []); fileInput.value = ''; handleFiles(l); });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { handleFiles(Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || [])); });
  function showSample() {
    var files = window.EtsyDemo.files({ year: CURRENT, endMonth: NOW.getMonth() + 1, endDay: Math.max(1, NOW.getDate() - 1) });
    state.sample = true; state.files = [];
    load(P.parseFiles(files));
    say('Showing a made-up sample shop (every product, buyer and order is invented). Upload your own files to make yours.');
  }
  $('#sample').addEventListener('click', showSample);
  $('#tab-recap').addEventListener('click', function () { setTab('recap'); });
  $('#tab-tax').addEventListener('click', function () { setTab('tax'); });
  $('.tabs').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var next = $('#tab-recap').getAttribute('aria-selected') === 'true' ? 'tax' : 'recap';
    setTab(next); $('#tab-' + next).focus();
  });
  yearSel.addEventListener('change', function () { state.year = yearSel.value === 'all' ? null : +yearSel.value; state.currency = ''; render(); });
  curSel.addEventListener('change', function () { state.currency = curSel.value; render(); });
  ['#revenue', '#names', '#handmade'].forEach(function (s) { $(s).addEventListener('change', render); });
  var tt; $('#name-input').addEventListener('input', function () { clearTimeout(tt); tt = setTimeout(render, 250); });
  $('#export-csv').addEventListener('click', exportCSV);
  $('#print').addEventListener('click', function () { window.print(); });
  $('#zip-all').addEventListener('click', zipAll);
  var sa = $('#share-all');
  if (!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }))) sa.hidden = true;
  sa.addEventListener('click', shareAll);
  $('#reset').addEventListener('click', function () {
    state = { files: [], parsed: null, stats: null, tax: null, cards: [], canvases: [], year: null, currency: '', hidden: {}, sample: false };
    deck.innerHTML = ''; empty.hidden = true; results.hidden = true; fileInput.value = '';
    say('Cleared. Nothing was saved anywhere.');
    $('#top').scrollIntoView({ behavior: 'smooth' });
  });

  // ---------- pass it on ----------
  $('#pass-text').textContent = shareText();
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } ta.remove(); return ok;
    }
  }
  $('#pass-copy').addEventListener('click', async function () {
    $('#pass-msg').textContent = (await copyText(shareText())) ? 'Copied. Paste it with your cards.' : 'Couldn\u2019t copy. Press and hold the text above to copy it.';
  });
  function shareLink() {
    if (navigator.share) navigator.share({ title: 'Seller Year in Review', text: SHARE_LEAD, url: SHARE_URL }).catch(function () {});
    else copyText(shareText()).then(function (ok) { $('#share-tool').textContent = ok ? 'Link copied' : 'Share this tool'; });
  }
  var ps = $('#pass-share');
  if (!navigator.share) ps.hidden = true;
  ps.addEventListener('click', shareLink);
  $('#share-tool').addEventListener('click', shareLink);

  if (/Instagram|FBAN|FBAV|FB_IAB|musical_ly|TikTok|BytedanceWebview|Snapchat|LinkedInApp|Pinterest/i.test(navigator.userAgent || '') && !status.textContent) {
    say('Opened inside an app? If saving the cards doesn\u2019t work here, open this page in Safari or Chrome (\u22ef menu \u2192 Open in browser).');
  }

  Object.defineProperty(window, '__etsyState', { get: function () { return state; } });
})();
