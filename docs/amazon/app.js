/* Year in Orders: page controller. Everything happens in this tab; the order history is never sent anywhere. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var P = window.AmazonParser, S = window.AmazonStats, C = window.AmazonCards;

  var state = { parsed: null, stats: null, cards: [], canvases: [], year: null, currency: '', tags: {}, page: 1, sample: false };
  var pool = []; // canvases reused across re-renders (iOS caps canvas memory)
  var PAGE = 250;

  var fileInput = $('#file'), drop = $('#drop'), status = $('#status');
  var results = $('#results'), deck = $('#deck'), yearSel = $('#year'), curSel = $('#currency'), empty = $('#empty');
  var NOW = new Date();
  var CURRENT = NOW.getFullYear();

  function say(msg, isError) {
    status.textContent = msg || '';
    status.className = 'status' + (isError ? ' err' : '');
    if (isError) {
      var help = document.createElement('a'); help.href = '#export'; help.textContent = 'How to get your order history';
      var demo = document.createElement('button'); demo.type = 'button'; demo.className = 'linkbtn'; demo.textContent = 'see a sample';
      demo.addEventListener('click', showSample);
      status.appendChild(document.createTextNode(' ')); status.appendChild(help);
      status.appendChild(document.createTextNode(' or ')); status.appendChild(demo); status.appendChild(document.createTextNode('.'));
    }
  }

  // ---------- share links: ?ref= passthrough (URL only, nothing stored) ----------
  var APP_URL = 'https://lanternlab2027.github.io/lab/amazon/';
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
  var SHARE_LEAD = 'My year in orders. See how much you spent on Amazon (free, nothing uploaded):';
  function shareText() { return SHARE_LEAD + ' ' + SHARE_URL; }

  // ---------- reading files ----------
  async function readFiles(list) {
    var out = [], zips = 0;
    for (var i = 0; i < list.length; i++) {
      var file = list[i], name = file.name || 'orders.csv';
      if (/\.zip$/i.test(name) || /zip/.test(file.type)) {
        if (!window.JSZip) throw new Error('Zip support failed to load. Unzip the file and upload the CSVs inside.');
        zips++;
        var zip = await window.JSZip.loadAsync(file);
        var entries = [];
        zip.forEach(function (path, entry) { if (!entry.dir && P.wantEntry(path)) entries.push(entry); });
        for (var j = 0; j < entries.length; j++) out.push({ name: entries[j].name, text: await entries[j].async('string') });
      } else {
        if (file.size > 150 * 1024 * 1024) throw new Error(name + ' is too big to be an order history.');
        out.push({ name: name, text: await file.text() });
      }
    }
    return { files: out, zips: zips };
  }

  async function handleFiles(list) {
    if (!list || !list.length) return;
    say('Reading your orders on this device\u2026');
    try {
      var r = await readFiles(list);
      await new Promise(function (res) { setTimeout(res, 20); });
      var parsed = P.parseFiles(r.files);
      if (!parsed.items.length) {
        var why = parsed.files.some(function (f) { return f.kind === 'orders'; }) ? 'The order file has no orders we could read (all cancelled, or the dates are in a format we don\u2019t know).'
          : r.zips && !r.files.length ? 'That zip has no order files inside. Make sure you requested \u201cYour Orders\u201d.'
          : 'That doesn\u2019t look like an Amazon order history. Upload the zip from Amazon, or Order History.csv / Retail.OrderHistory.1.csv from inside it.';
        say(why, true);
        return;
      }
      state.sample = false;
      load(parsed);
    } catch (e) {
      say(e.message || 'Something went wrong reading that file.', true);
    }
  }

  function yearOptions() {
    var ys = S.years(itemsForControls());
    if (!ys.some(function (y) { return y.year === CURRENT; })) ys.push({ year: CURRENT, orders: 0 });
    ys.sort(function (a, b) { return b.year - a.year; });
    yearSel.innerHTML = ys.map(function (y) { return '<option value="' + y.year + '">' + y.year + ' (' + y.orders.toLocaleString('en-US') + (y.orders === 1 ? ' order' : ' orders') + ')</option>'; }).join('') + '<option value="all">All time</option>';
    return ys;
  }
  function itemsForControls() { return state.parsed.items.filter(function (x) { return $('#digital').checked || x.kind !== 'digital'; }); }

  function load(parsed) {
    state.parsed = parsed; state.tags = loadTags(); state.currency = '';
    var hasDigital = parsed.items.some(function (x) { return x.kind === 'digital'; });
    $('#digital-wrap').hidden = !hasDigital;
    var ys = yearOptions();
    var cur = ys.filter(function (y) { return y.year === CURRENT; })[0];
    var latest = ys.filter(function (y) { return y.orders > 0; })[0];
    state.year = cur && cur.orders ? CURRENT : latest ? latest.year : CURRENT;
    yearSel.value = String(state.year);
    var orders = {}; parsed.items.forEach(function (x) { orders[x.orderId] = 1; });
    var msg = 'Found ' + Object.keys(orders).length.toLocaleString('en-US') + ' orders (' + parsed.items.length.toLocaleString('en-US') + ' item lines) in ' + parsed.files.length + (parsed.files.length === 1 ? ' file' : ' files') + '. Nothing was uploaded.';
    if (state.year !== CURRENT) msg += ' No orders in ' + CURRENT + ' yet, so we\u2019re showing ' + state.year + '.';
    say(msg);
    setTab('recap');
    resetRange();
    render();
    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- recap ----------
  function cardTitle(name) {
    name = (name || '').trim();
    var who = name ? name + (/s$/i.test(name) ? '\u2019' : '\u2019s') : 'My';
    return state.year == null ? who + ' orders, all time' : who + ' ' + state.year + ' in orders';
  }

  function money(n, cur) { return C.money(n, cur || (state.stats && state.stats.currency), true); }

  function describe(s) {
    var p = state.parsed, bits = [];
    var period = state.year == null ? 'all time' : String(state.year);
    bits.push('Counting ' + s.orderCount.toLocaleString('en-US') + ' orders from ' + period + ' in ' + s.currency + ': ' + money(s.gross) + ' in item totals (tax and shipping included)');
    if (s.refundTotal) bits.push('minus ' + money(s.refundTotal) + ' refunded on ' + s.refundOrders + (s.refundOrders === 1 ? ' order' : ' orders') + ' = ' + money(s.net));
    else if (!s.hasRefundFile) bits.push('no refund file was included, so refunds aren\u2019t taken off');
    var extra = [];
    if (s.digitalCount) extra.push(s.digitalCount + ' digital ' + (s.digitalCount === 1 ? 'purchase' : 'purchases') + ' included');
    if (p.cancelled) extra.push(p.cancelled + ' cancelled ' + (p.cancelled === 1 ? 'line' : 'lines') + ' left out');
    if (p.freeDigital) extra.push(p.freeDigital + ' free digital ' + (p.freeDigital === 1 ? 'item' : 'items') + ' skipped');
    s.otherCurrencies.forEach(function (c) { extra.push(money(c.total, c.currency) + ' in ' + c.currency + ' not included (switch currency above)'); });
    if (!s.categories && state.parsed.items.length) extra.push(p.hasCategory ? '' : 'no department column in this export, so no categories card');
    return bits.join(', ') + '.' + (extra.filter(Boolean).length ? ' ' + extra.filter(Boolean).join('; ') + '.' : '');
  }

  function render() {
    var stats = S.compute(state.parsed, { year: state.year, currency: state.currency || undefined, digital: $('#digital').checked, today: NOW.getTime() });
    state.stats = stats;
    // currency select (only when the file has more than one)
    var curs = S.currencies(itemsForControls().filter(function (x) { return state.year == null || S.local(x.ts).y === state.year; }));
    $('#currency-wrap').hidden = curs.length < 2;
    curSel.innerHTML = curs.map(function (c) { return '<option value="' + c.currency + '">' + c.currency + '</option>'; }).join('');
    if (curs.length) curSel.value = stats.currency;
    var info = { title: cardTitle($('#name-input').value), year: state.year, periodShort: state.year == null ? 'All time' : String(state.year), showNames: $('#names').checked };
    deck.innerHTML = ''; state.canvases = []; state.cards = [];
    renderTax();
    if (!stats.orderCount) {
      empty.hidden = false;
      empty.textContent = 'No orders ' + (state.year == null ? 'in this file' : 'in ' + state.year) + ' yet. Pick another year above.';
      $('#deck-count').textContent = '0 cards';
      $('#included').textContent = '';
      return;
    }
    $('#included').textContent = describe(stats);
    empty.hidden = true;
    var cards = C.build(stats, info);
    state.cards = cards;
    cards.forEach(function (card, i) {
      var fig = document.createElement('figure');
      fig.className = 'card';
      var cv = pool[i] || (pool[i] = document.createElement('canvas'));
      cv.width = C.W; cv.height = C.H;
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', 'Card ' + (i + 1) + ': ' + card.label);
      C.render(cv, card, stats, info, i + 1, cards.length);
      var cap = document.createElement('figcaption');
      var lbl = document.createElement('span'); lbl.textContent = (i + 1) + '. ' + card.label;
      var share = document.createElement('button'); share.type = 'button'; share.className = 'btn small'; share.textContent = 'Share';
      var save = document.createElement('button'); save.type = 'button'; save.className = 'btn small ghost'; save.textContent = 'Save PNG';
      share.addEventListener('click', function () { shareOne(i); });
      save.addEventListener('click', function () { saveOne(i); });
      var btns = document.createElement('div'); btns.className = 'card-btns'; btns.appendChild(share); btns.appendChild(save);
      cap.appendChild(lbl); cap.appendChild(btns);
      fig.appendChild(cv); fig.appendChild(cap);
      deck.appendChild(fig);
      state.canvases.push(cv);
    });
    $('#deck-count').textContent = cards.length + ' cards';
  }

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function fileName(i) { return 'year-in-orders-' + (state.year || 'all-time') + '-' + String(i + 1).padStart(2, '0') + '-' + slug(state.cards[i].label) + '.png'; }
  function blobOf(i) { return new Promise(function (res) { state.canvases[i].toBlob(res, 'image/png'); }); }
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  async function saveOne(i) { download(await blobOf(i), fileName(i)); }
  async function shareFiles(files) {
    if (navigator.canShare && navigator.share && navigator.canShare({ files: files })) {
      try { await navigator.share({ files: files, title: 'Year in Orders', text: shareText() }); return true; }
      catch (e) { if (e && e.name === 'AbortError') return true; }
    }
    return false;
  }
  async function shareOne(i) {
    var blob = await blobOf(i);
    var file = new File([blob], fileName(i), { type: 'image/png' });
    if (!(await shareFiles([file]))) download(blob, fileName(i));
  }
  async function zipAll() {
    var btn = $('#zip-all'); btn.disabled = true; var t = btn.textContent; btn.textContent = 'Zipping\u2026';
    try {
      var zip = new window.JSZip();
      for (var i = 0; i < state.canvases.length; i++) zip.file(fileName(i), await blobOf(i));
      download(await zip.generateAsync({ type: 'blob' }), 'year-in-orders-' + (state.year || 'all-time') + '.zip');
    } finally { btn.disabled = false; btn.textContent = t; }
  }
  async function shareAll() {
    var files = [];
    for (var i = 0; i < state.canvases.length; i++) files.push(new File([await blobOf(i)], fileName(i), { type: 'image/png' }));
    if (!(await shareFiles(files))) zipAll();
  }

  // ---------- tax filter ----------
  function nameHash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return 'n' + (h >>> 0).toString(36); }
  function tagKey(x) { return x.orderId.replace(/\|/g, '') + '|' + (x.asin || nameHash(x.name)) + '|' + x.total; }
  function remembering() { return $('#remember').checked; }
  function loadTags() {
    var t = {};
    try {
      var raw = localStorage.getItem('yio-tags');
      if (raw) { JSON.parse(raw).forEach(function (k) { t[k] = 1; }); $('#remember').checked = true; }
    } catch (e) { /* storage blocked: tags just won't persist */ }
    return t;
  }
  function saveTags() {
    try {
      if (remembering() && !state.sample) {
        // only order numbers and product IDs, never names or prices
        localStorage.setItem('yio-tags', JSON.stringify(Object.keys(state.tags).map(function (k) { var p = k.split('|'); return p[0] + '|' + p[1]; })));
      } else localStorage.removeItem('yio-tags');
    } catch (e) { /* ignore */ }
  }
  function isTagged(x) { var p = tagKey(x).split('|'); return !!(state.tags[tagKey(x)] || state.tags[p[0] + '|' + p[1]]); }
  function setTag(x, on) { var k = tagKey(x), p = k.split('|'); if (on) state.tags[k] = 1; else { delete state.tags[k]; delete state.tags[p[0] + '|' + p[1]]; } }

  function iso(ts) { var d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function resetRange() {
    var y = state.year == null ? null : state.year;
    var items = state.parsed.items;
    $('#from').value = y ? y + '-01-01' : (items.length ? iso(items[0].ts) : '');
    $('#to').value = y ? y + '-12-31' : (items.length ? iso(items[items.length - 1].ts) : '');
    state.page = 1;
  }

  function shownItems() {
    var from = $('#from').value, to = $('#to').value, q = $('#q').value.trim().toLowerCase(), show = $('#show').value;
    var cur = state.stats ? state.stats.currency : null;
    var refunded = {};
    (state.parsed.refunds || []).forEach(function (r) { refunded[r.orderId] = 1; });
    return itemsForControls().filter(function (x) {
      var d = iso(x.ts);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (cur && x.currency !== cur) return false;
      if (q && x.name.toLowerCase().indexOf(q) < 0 && x.orderId.toLowerCase().indexOf(q) < 0) return false;
      var t = isTagged(x);
      if (show === 'biz' && !t) return false;
      if (show === 'personal' && t) return false;
      return true;
    }).map(function (x) { return { x: x, refund: !!refunded[x.orderId] }; });
  }

  function renderTax() {
    if (!state.parsed) return;
    var rows = shownItems(), body = $('#items tbody'), foot = $('#items tfoot');
    var cur = state.stats ? state.stats.currency : 'USD';
    var bizN = 0, bizT = 0, allT = 0, allBiz = 0, allBizT = 0;
    rows.forEach(function (r) { allT += r.x.total; if (isTagged(r.x)) { bizN++; bizT += r.x.total; } });
    itemsForControls().forEach(function (x) { if (isTagged(x) && x.currency === cur) { allBiz++; allBizT += x.total; } });
    var nCur = S.currencies(itemsForControls()).length;
    $('#tax-cur').hidden = nCur < 2;
    $('#tax-cur').textContent = 'Showing ' + cur + ' items only. Your file has more than one currency; switch it next to the year at the top.';
    $('#totals').innerHTML = '';
    [['Shown items', rows.length.toLocaleString('en-US'), ''], ['Shown total', money(allT, cur), ''], ['Business (shown)', money(bizT, cur), 'biz'], ['Business items (shown)', bizN.toLocaleString('en-US'), 'biz']].forEach(function (t) {
      var d = document.createElement('div'); if (t[2]) d.className = t[2];
      var sp = document.createElement('span'); sp.textContent = t[0]; var b = document.createElement('b'); b.textContent = t[1];
      d.appendChild(sp); d.appendChild(b); $('#totals').appendChild(d);
    });
    body.innerHTML = '';
    var frag = document.createDocumentFragment();
    rows.slice(0, state.page * PAGE).forEach(function (r) {
      var x = r.x, tr = document.createElement('tr');
      var on = isTagged(x); if (on) tr.className = 'on';
      var td0 = document.createElement('td'); td0.className = 'bz';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = on; cb.setAttribute('aria-label', 'Business expense: ' + x.name);
      cb.addEventListener('change', function () { setTag(x, cb.checked); tr.className = cb.checked ? 'on' : ''; saveTags(); renderTotalsOnly(); });
      td0.appendChild(cb);
      var td1 = document.createElement('td'); td1.className = 'd'; td1.textContent = iso(x.ts);
      var td2 = document.createElement('td'); td2.className = 'nm'; td2.textContent = x.name;
      var sm = document.createElement('small'); sm.textContent = 'Order ' + x.orderId + (x.qty !== 1 ? ' \u00b7 qty ' + x.qty : '') + (x.kind === 'digital' ? ' \u00b7 digital' : '') + (r.refund ? ' \u00b7 refund on this order' : ''); td2.appendChild(sm);
      var td3 = document.createElement('td'); td3.className = 'num q'; td3.textContent = String(x.qty);
      var td4 = document.createElement('td'); td4.className = 'num t'; td4.textContent = money(x.total, x.currency);
      [td0, td1, td2, td3, td4].forEach(function (td) { tr.appendChild(td); });
      frag.appendChild(tr);
    });
    body.appendChild(frag);
    foot.innerHTML = '';
    var ft = document.createElement('tr'), c1 = document.createElement('td'); c1.colSpan = 4; c1.textContent = 'Business total (all tagged, ' + allBiz + (allBiz === 1 ? ' item' : ' items') + ', ' + cur + ')';
    var c2 = document.createElement('td'); c2.className = 'num'; c2.textContent = money(allBizT, cur); ft.appendChild(c1); ft.appendChild(c2); foot.appendChild(ft);
    $('#more-wrap').hidden = rows.length <= state.page * PAGE;
    $('#more').textContent = 'Show more (' + (rows.length - state.page * PAGE).toLocaleString('en-US') + ' left)';
  }
  var renderTotalsOnly = function () { var y = window.scrollY; renderTax(); window.scrollTo(0, y); };

  function csvCell(v) {
    v = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; // spreadsheet formula injection guard
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function exportCSV(onlyBiz) {
    var rows = shownItems().filter(function (r) { return !onlyBiz || isTagged(r.x); });
    if (onlyBiz && !rows.length) { alert('Tick the Business box on at least one shown item first.'); return; }
    var lines = [['Date', 'Order ID', 'Item', 'ASIN', 'Quantity', 'Total', 'Currency', 'Business', 'Refund on this order', 'Type'].join(',')];
    var tot = 0;
    rows.forEach(function (r) {
      var x = r.x; tot += x.total;
      lines.push([iso(x.ts), x.orderId, x.name, x.asin, x.qty, x.total.toFixed(2), x.currency, isTagged(x) ? 'yes' : 'no', r.refund ? 'yes' : 'no', x.kind].map(csvCell).join(','));
    });
    lines.push(['', '', 'TOTAL', '', '', (Math.round(tot * 100) / 100).toFixed(2), rows[0] ? rows[0].x.currency : '', '', '', ''].map(csvCell).join(','));
    lines.push(csvCell('Not tax advice. Made with Year in Orders (lanternlab2027.github.io/lab/amazon) from your Amazon order history. Keep your receipts and invoices.'));
    var span = ($('#from').value || 'start') + '-to-' + ($('#to').value || 'end');
    download(new Blob(['\ufeff' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }), (onlyBiz ? 'amazon-business-purchases-' : 'amazon-purchases-') + span + '.csv');
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
  fileInput.addEventListener('change', function () { handleFiles(fileInput.files); });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { handleFiles(e.dataTransfer && e.dataTransfer.files); });
  function showSample() {
    var files = window.AmazonDemo.files({ year: CURRENT, endMonth: NOW.getMonth() + 1, endDay: Math.max(1, NOW.getDate() - 1) });
    state.sample = true;
    load(P.parseFiles(files));
    say('Showing a made-up sample (every product and order is invented). Upload your own files to make yours.');
  }
  $('#sample').addEventListener('click', showSample);

  $('#tab-recap').addEventListener('click', function () { setTab('recap'); });
  $('#tab-tax').addEventListener('click', function () { setTab('tax'); });
  $('.tabs').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var next = $('#tab-recap').getAttribute('aria-selected') === 'true' ? 'tax' : 'recap';
    setTab(next); $('#tab-' + next).focus();
  });
  yearSel.addEventListener('change', function () { state.year = yearSel.value === 'all' ? null : +yearSel.value; state.currency = ''; resetRange(); render(); });
  curSel.addEventListener('change', function () { state.currency = curSel.value; render(); });
  $('#digital').addEventListener('change', function () { var keep = yearSel.value; yearOptions(); yearSel.value = keep; render(); });
  $('#names').addEventListener('change', render);
  var tt; $('#name-input').addEventListener('input', function () { clearTimeout(tt); tt = setTimeout(render, 250); });
  ['#from', '#to', '#show'].forEach(function (s) { $(s).addEventListener('change', function () { state.page = 1; renderTax(); }); });
  var qt; $('#q').addEventListener('input', function () { clearTimeout(qt); qt = setTimeout(function () { state.page = 1; renderTax(); }, 150); });
  $('#more').addEventListener('click', function () { state.page++; renderTotalsOnly(); });
  $('#tag-shown').addEventListener('click', function () { shownItems().forEach(function (r) { setTag(r.x, true); }); saveTags(); renderTotalsOnly(); });
  $('#untag-shown').addEventListener('click', function () { shownItems().forEach(function (r) { setTag(r.x, false); }); saveTags(); renderTotalsOnly(); });
  $('#remember').addEventListener('change', saveTags);
  $('#export-biz').addEventListener('click', function () { exportCSV(true); });
  $('#export-all').addEventListener('click', function () { exportCSV(false); });
  $('#zip-all').addEventListener('click', zipAll);
  var sa = $('#share-all');
  if (!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }))) sa.hidden = true;
  sa.addEventListener('click', shareAll);
  $('#reset').addEventListener('click', function () {
    state = { parsed: null, stats: null, cards: [], canvases: [], year: null, currency: '', tags: {}, page: 1, sample: false };
    deck.innerHTML = ''; $('#items tbody').innerHTML = ''; empty.hidden = true; results.hidden = true; fileInput.value = '';
    say('Cleared. Nothing was saved anywhere' + (remembering() ? ' except your business tags (order numbers only), which you chose to remember.' : '.'));
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
    if (navigator.share) navigator.share({ title: 'Year in Orders', text: SHARE_LEAD, url: SHARE_URL }).catch(function () {});
    else copyText(shareText()).then(function (ok) { $('#share-tool').textContent = ok ? 'Link copied' : 'Share this tool'; });
  }
  var ps = $('#pass-share');
  if (!navigator.share) ps.hidden = true;
  ps.addEventListener('click', shareLink);
  $('#share-tool').addEventListener('click', shareLink);

  if (/Instagram|FBAN|FBAV|FB_IAB|musical_ly|TikTok|BytedanceWebview|Snapchat|LinkedInApp/i.test(navigator.userAgent || '') && !status.textContent) {
    say('Opened inside an app? If saving the cards doesn\u2019t work here, open this page in Safari or Chrome (\u22ef menu \u2192 Open in browser).');
  }

  Object.defineProperty(window, '__amazonState', { get: function () { return state; } });
})();
