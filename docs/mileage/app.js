/* Timeline Mileage Log: page controller. Everything happens in this tab; the location history is never sent anywhere. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var P = window.MileageParser, S = window.MileageStats, D = window.MileageDemo;

  var PAGE = 100, STORE = 'lanternlab.mileage.v1';
  var state = { data: null, cl: null, names: {}, tags: {}, types: {}, from: '', to: '', show: 'all', page: 0, sample: false, periodLabel: '' };
  var status = $('#status'), results = $('#results');
  var NOW = new Date();

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt1(x) { return x.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function money(x) { return '$' + x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function niceDate(d) { var p = d.split('-'); return MON[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; }

  function say(msg, isError) {
    status.textContent = msg || '';
    status.className = 'status' + (isError ? ' err' : '');
    if (isError) {
      var a = document.createElement('a'); a.href = '#guide'; a.textContent = 'How to export your Timeline';
      status.appendChild(document.createTextNode(' ')); status.appendChild(a); status.appendChild(document.createTextNode('.'));
    }
  }

  // ---------- share link: ?ref= passthrough (URL only, nothing stored) ----------
  var APP_URL = 'https://lanternlab2027.github.io/lab/mileage/';
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
  $('#share-url').textContent = SHARE_URL.replace(/^https:\/\//, '');
  $('#share').addEventListener('click', async function () {
    var text = 'Free Google Maps Timeline mileage log. Runs on your device, nothing uploaded:';
    try { if (navigator.share) { await navigator.share({ title: 'Timeline Mileage Log', text: text, url: SHARE_URL }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text + ' ' + SHARE_URL); this.textContent = 'Link copied'; } catch (e) { window.prompt('Copy this link:', SHARE_URL); }
  });

  // ---------- optional memory (names + tags only, never the location history) ----------
  function loadStore() { try { var s = localStorage.getItem(STORE); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  var saveTimer = null;
  function save() {
    if (!$('#remember').checked || state.sample) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var names = [];
      Object.keys(state.names).forEach(function (id) { var p = state.cl.places[id]; if (state.names[id]) names.push({ lat: p.lat, lng: p.lng, name: state.names[id] }); });
      try { localStorage.setItem(STORE, JSON.stringify({ names: names, tags: state.tags })); } catch (e) { /* storage blocked: fine */ }
    }, 250);
  }
  $('#remember').addEventListener('change', function () {
    if (this.checked) save();
    else { try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ } }
  });

  // ---------- reading files ----------
  async function readOne(file) {
    var name = file.name || 'Timeline.json';
    if (/\.zip$/i.test(name) || /zip/.test(file.type || '')) {
      if (!window.JSZip) throw new Error('Zip support failed to load. Unzip the file and choose the .json files inside.');
      var zip = await window.JSZip.loadAsync(file), entries = [];
      zip.forEach(function (p, e) {
        if (e.dir || !/\.json$/i.test(p) || /(^|\/)(__MACOSX|\.)/.test(p)) return;
        if (/Semantic Location History\/|(^|\/)Timeline\.json$|(^|\/)location-history\.json$|\d{4}_[A-Z]+\.json$/i.test(p)) entries.push(e);
      });
      if (!entries.length) throw new Error('That zip has no Timeline trips inside. Look for the Semantic Location History folder, or export Timeline from your phone.');
      var out = [];
      for (var i = 0; i < entries.length; i++) out.push({ name: entries[i].name, text: await entries[i].async('string') });
      return out;
    }
    if (file.size > 400 * 1024 * 1024) throw new Error('That file is too big for this page (over 400 MB).');
    return [{ name: name, text: await file.text() }];
  }

  async function handleFiles(files) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    say('Reading your Timeline on this device\u2026');
    try {
      var texts = [];
      for (var i = 0; i < files.length; i++) texts = texts.concat(await readOne(files[i]));
      await new Promise(function (r) { setTimeout(r, 20); });
      var parsed = [], errors = [];
      texts.forEach(function (t) { try { parsed.push(P.parseText(t.text, t.name)); } catch (e) { errors.push(e.message); } });
      if (!parsed.length) throw new Error(errors[0] || 'No trips found.');
      var data = P.merge(parsed);
      if (!data.trips.length) throw new Error('No trips found in that file. Timeline may have been off, or the export only has visits.');
      load(data, false, errors.length ? errors.length + ' file(s) skipped.' : '');
    } catch (e) {
      say(e.message || 'Something went wrong reading that file.', true);
    }
  }

  // ---------- load ----------
  function load(data, sample, extra) {
    placesAll = false; state.data = data; state.sample = !!sample; state.tags = {}; state.names = {}; state.page = 0; state.show = 'all';
    $('#show').value = 'all';
    state.cl = S.clusterPlaces(data.trips, data.hints, 150);
    // rank places by visits for default labels
    var order = state.cl.places.slice().sort(function (a, b) { return b.n - a.n; });
    order.forEach(function (p, i) { p.rank = i + 1; });
    state.cl.places.forEach(function (p) { if (p.suggested) state.names[p.id] = p.suggested; });
    var stored = sample ? null : loadStore();
    if (stored) {
      $('#remember').checked = true;
      (stored.names || []).forEach(function (n) {
        var best = null, bd = 151;
        state.cl.places.forEach(function (p) { var d = P.haversine(p, n); if (d < bd) { bd = d; best = p; } });
        if (best) state.names[best.id] = n.name;
      });
      var ids = {}; data.trips.forEach(function (t) { ids[t.id] = 1; });
      Object.keys(stored.tags || {}).forEach(function (k) { if (ids[k]) state.tags[k] = stored.tags[k]; });
    } else if (sample) { $('#remember').checked = false; sampleTags(); }
    // trip types: driving ones on by default
    var counts = S.typeCounts(data.trips);
    state.types = {};
    Object.keys(counts).forEach(function (t) { state.types[t] = P.DRIVING.indexOf(t) >= 0; });
    if (!Object.keys(state.types).some(function (t) { return state.types[t]; })) Object.keys(state.types).forEach(function (t) { state.types[t] = true; });
    renderTypes(counts);
    renderPeriods();
    results.hidden = false;
    var fmts = data.formats.map(function (f) { return f === 'android' ? 'Android Timeline export' : f === 'ios' ? 'iPhone Timeline export' : 'Takeout Semantic Location History'; }).join(' + ');
    say(sample ? 'Showing a made-up sample (every place is invented). Choose your own file to build your log.'
      : 'Read ' + data.trips.length.toLocaleString('en-US') + ' trips from your ' + fmts + ', on this device.' + (extra ? ' ' + extra : ''));
    renderAll();
  }

  function sampleTags() {
    var named = {};
    Object.keys(D.PLACES).forEach(function (k) {
      var pl = D.PLACES[k], best = null, bd = 151;
      state.cl.places.forEach(function (p) { var d = P.haversine(p, pl); if (d < bd) { bd = d; best = p; } });
      if (best) { state.names[best.id] = pl.name; named[best.id] = k; }
    });
    state.data.trips.forEach(function (t, i) {
      var a = named[state.cl.startPlace[i]], b = named[state.cl.endPlace[i]];
      if (/client|supplier/.test(a) || /client|supplier/.test(b)) state.tags[t.id] = { p: 'business', n: 'Client visit' };
      else if ((a === 'home' && b === 'office') || (a === 'office' && b === 'home')) state.tags[t.id] = { p: 'personal', n: 'Commute' };
    });
  }

  // ---------- controls ----------
  function renderTypes(counts) {
    var box = $('#types'); box.innerHTML = '';
    Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).forEach(function (t) {
      var l = document.createElement('label'); l.className = 'chip';
      l.innerHTML = '<input type="checkbox" data-type="' + esc(t) + '"' + (state.types[t] ? ' checked' : '') + '> ' + esc(P.typeLabel(t)) + ' <small>' + counts[t].toLocaleString('en-US') + '</small>';
      box.appendChild(l);
    });
  }
  $('#types').addEventListener('change', function (e) {
    var t = e.target.getAttribute('data-type'); if (!t) return;
    state.types[t] = e.target.checked; state.page = 0; renderAll();
  });

  function renderPeriods() {
    var sel = $('#period'), ys = S.years(state.data.trips), trips = state.data.trips;
    sel.innerHTML = '';
    ys.forEach(function (y) {
      var o = document.createElement('option'); o.value = 'y' + y; o.textContent = 'Tax year ' + y; sel.appendChild(o);
    });
    [['all', 'Everything in the file (' + niceDate(trips[0].date) + ' \u2013 ' + niceDate(trips[trips.length - 1].date) + ')'], ['custom', 'Custom dates\u2026']].forEach(function (p) {
      var o = document.createElement('option'); o.value = p[0]; o.textContent = p[1]; sel.appendChild(o);
    });
    // Jan-Apr is tax season for last year: default to it when the file has it.
    var cy = String(NOW.getFullYear()), py = String(NOW.getFullYear() - 1), def = ys[0];
    if (NOW.getMonth() <= 3 && ys.indexOf(py) >= 0) def = py;
    else if (ys.indexOf(cy) >= 0) def = cy;
    sel.value = 'y' + def;
    $('#from').value = trips[0].date; $('#to').value = trips[trips.length - 1].date;
    applyPeriod();
  }
  function applyPeriod() {
    var v = $('#period').value;
    $('#custom-dates').hidden = v !== 'custom';
    if (v.charAt(0) === 'y') { state.from = v.slice(1) + '-01-01'; state.to = v.slice(1) + '-12-31'; state.periodLabel = 'Tax year ' + v.slice(1); }
    else if (v === 'all') { state.from = ''; state.to = ''; state.periodLabel = 'All dates in file'; }
    else { state.from = $('#from').value; state.to = $('#to').value; state.periodLabel = (state.from ? niceDate(state.from) : '') + ' \u2013 ' + (state.to ? niceDate(state.to) : ''); }
  }
  $('#period').addEventListener('change', function () { applyPeriod(); state.page = 0; renderAll(); });
  $('#from').addEventListener('change', function () { applyPeriod(); state.page = 0; renderAll(); });
  $('#to').addEventListener('change', function () { applyPeriod(); state.page = 0; renderAll(); });

  // ---------- derived ----------
  function idxOf() { // trip -> index in data.trips
    if (!state._idx || state._idxFor !== state.data) { state._idx = new Map(); state.data.trips.forEach(function (t, i) { state._idx.set(t, i); }); state._idxFor = state.data; }
    return state._idx;
  }
  function placeName(id, withCoords) {
    if (id == null) return 'Unknown';
    var p = state.cl.places[id];
    if (state.names[id]) return state.names[id];
    return 'Place ' + p.rank + (withCoords ? ' (' + p.lat.toFixed(4) + ', ' + p.lng.toFixed(4) + ')' : '');
  }
  function periodTrips() { return S.filter(state.data.trips, { from: state.from, to: state.to, types: state.types }); }
  function rowsFor(trips, withCoords) {
    var idx = idxOf();
    return trips.map(function (t) {
      var i = idx.get(t), tag = state.tags[t.id] || {};
      return { trip: t, purpose: tag.p || '', note: tag.n || '', from: placeName(state.cl.startPlace[i], withCoords), to: placeName(state.cl.endPlace[i], withCoords), i: i };
    });
  }

  // ---------- render ----------
  function renderAll() { renderTotals(); renderPlaces(); renderLog(); }

  function renderTotals() {
    var rows = rowsFor(periodTrips()), t = S.totals(rows);
    $('#odo').innerHTML =
      '<div class="t biz"><span>Business miles</span><b id="tot-business">' + fmt1(t.business) + '</b></div>' +
      '<div class="t"><span>Personal miles</span><b id="tot-personal">' + fmt1(t.personal) + '</b></div>' +
      '<div class="t"><span>Untagged miles</span><b id="tot-untagged">' + fmt1(t.untagged) + '</b></div>' +
      '<div class="t"><span>Total miles &middot; ' + t.trips.toLocaleString('en-US') + ' trip' + (t.trips === 1 ? '' : 's') + '</span><b id="tot-all">' + fmt1(t.all) + '</b></div>';
    var lines = Object.keys(t.byRate).sort().map(function (k) {
      var b = t.byRate[k], r = b.rate;
      return '<li>' + fmt1(b.miles) + ' mi &times; ' + r.cents + '&cent; (' + niceDate(r.from) + ' \u2013 ' + niceDate(r.to) + '; <a href="' + esc(r.url) + '" rel="noopener">' + esc(r.cite) + '</a>)</li>';
    }).join('');
    var html = '<div style="font-weight:700">Estimated amount at the IRS business standard mileage rate</div>' +
      '<div class="amt" id="estimate-amt">' + money(t.estimate) + '</div>';
    if (t.business > 0) html += '<ul>' + lines + '</ul>';
    else html += '<p>Tag trips as business to see an estimate.</p>';
    if (t.unratedMiles > 0) html += '<p><b>' + fmt1(t.unratedMiles) + ' business miles</b> are on dates with no rate in this tool (before 2022); they are not in the estimate.</p>';
    html += '<p>An estimate only, not tax advice. Rates from <a href="https://www.irs.gov/tax-professionals/standard-mileage-rates" rel="noopener">IRS: Standard mileage rates</a> (checked Nov 15, 2026). Whether you can use the standard rate, and how it is reported, depends on your situation (<a href="https://www.irs.gov/taxtopics/tc510" rel="noopener">IRS Topic 510</a>).</p>';
    $('#estimate').innerHTML = html;
    $('#print-period').textContent = state.periodLabel + ' \u00b7 ' + fmt1(t.business) + ' business miles of ' + fmt1(t.all) + ' total \u00b7 reconstructed from Google Maps Timeline; verify before use.';
  }

  var placesAll = false;
  function renderPlaces() {
    var trips = periodTrips(), idx = idxOf(), cnt = {};
    trips.forEach(function (t) { var i = idx.get(t); [state.cl.startPlace[i], state.cl.endPlace[i]].forEach(function (p) { if (p != null) cnt[p] = (cnt[p] || 0) + 1; }); });
    var list = Object.keys(cnt).map(Number).sort(function (a, b) { return cnt[b] - cnt[a] || a - b; });
    var frequent = list.filter(function (id) { return cnt[id] >= 2; });
    var shown = placesAll ? frequent : frequent.slice(0, 10);
    $('#more-places').hidden = placesAll || frequent.length <= 10;
    $('#more-places').textContent = 'Show all ' + frequent.length + ' places';
    $('#places').innerHTML = shown.length ? shown.map(function (id) {
      var p = state.cl.places[id];
      return '<div class="place" data-place="' + id + '"><label class="field"><span class="sr">Name for place ' + p.rank + '</span>' +
        '<input type="text" maxlength="60" data-name="' + id + '" value="' + esc(state.names[id] || '') + '" placeholder="Place ' + p.rank + ' (e.g. Office, Client name)"></label>' +
        '<div><div class="meta"><span>' + cnt[id] + ' trip ends</span><span>' + p.lat.toFixed(4) + ', ' + p.lng.toFixed(4) + '</span>' +
        '<a href="https://www.google.com/maps/search/?api=1&amp;query=' + p.lat.toFixed(5) + ',' + p.lng.toFixed(5) + '" target="_blank" rel="noopener noreferrer">see on map</a></div>' +
        '<div class="acts"><span>Tag untagged trips to/from here as:</span> <button type="button" class="btn ghost small" data-tagplace="' + id + '" data-p="business">Business</button>' +
        '<button type="button" class="btn ghost small" data-tagplace="' + id + '" data-p="personal">Personal</button></div></div></div>';
    }).join('') : '<p class="hint">No place shows up more than once in this period.</p>';
  }
  $('#more-places').addEventListener('click', function () { placesAll = true; renderPlaces(); });
  $('#places').addEventListener('input', function (e) {
    var id = e.target.getAttribute('data-name'); if (id == null) return;
    state.names[id] = e.target.value.trim(); save();
    clearTimeout(state._nameT); state._nameT = setTimeout(renderLog, 200);
  });
  $('#places').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tagplace]'); if (!b) return;
    var id = +b.getAttribute('data-tagplace'), p = b.getAttribute('data-p'), idx = idxOf(), n = 0;
    periodTrips().forEach(function (t) {
      var i = idx.get(t);
      if ((state.cl.startPlace[i] === id || state.cl.endPlace[i] === id) && !(state.tags[t.id] && state.tags[t.id].p)) {
        state.tags[t.id] = { p: p, n: (state.tags[t.id] && state.tags[t.id].n) || '' }; n++;
      }
    });
    save(); renderTotals(); renderLog();
    say('Tagged ' + n + ' untagged trip' + (n === 1 ? '' : 's') + ' to or from ' + placeName(id) + ' as ' + p + '.');
  });

  function visibleRows() {
    var rows = rowsFor(periodTrips());
    if (state.show !== 'all') rows = rows.filter(function (r) { return state.show === 'untagged' ? !r.purpose : r.purpose === state.show; });
    return rows;
  }
  function renderLog() {
    var rows = visibleRows(), pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (state.page >= pages) state.page = pages - 1;
    var slice = rows.slice(state.page * PAGE, state.page * PAGE + PAGE);
    $('#count').textContent = rows.length.toLocaleString('en-US') + ' trip' + (rows.length === 1 ? '' : 's');
    $('#rows').innerHTML = slice.length ? slice.map(function (r) {
      var t = r.trip, est = t.distSource === 'file' ? '' : ' <small title="estimated">' + (t.distSource === 'path' ? 'path' : 'straight line') + '</small>';
      return '<tr data-id="' + esc(t.id) + '"><td class="d">' + esc(t.date) + '<small>' + esc(t.startHM) + (t.endHM ? '\u2013' + esc(t.endHM) : '') + (state.types[t.type] && P.DRIVING.indexOf(t.type) < 0 ? ' \u00b7 ' + esc(P.typeLabel(t.type)) : '') + '</small></td>' +
        '<td class="rt">' + esc(r.from) + '<span class="arrow">&rarr;</span>' + esc(r.to) + '</td>' +
        '<td class="mi">' + S.round1(t.miles).toFixed(1) + est + '</td>' +
        '<td class="pu"><label class="sr" for="p-' + esc(t.id) + '">Purpose</label><select id="p-' + esc(t.id) + '" data-purpose class="' + r.purpose + '">' +
        '<option value=""' + (r.purpose ? '' : ' selected') + '>Untagged</option><option value="business"' + (r.purpose === 'business' ? ' selected' : '') + '>Business</option><option value="personal"' + (r.purpose === 'personal' ? ' selected' : '') + '>Personal</option></select></td>' +
        '<td class="no"><label class="sr" for="n-' + esc(t.id) + '">Business purpose or note</label><input type="text" id="n-' + esc(t.id) + '" data-note maxlength="120" value="' + esc(r.note) + '" placeholder="Business purpose"></td></tr>';
    }).join('') : '<tr><td colspan="5">No trips match. Try another period or turn on more trip types.</td></tr>';
    var pg = $('#pager');
    pg.innerHTML = pages > 1 ? '<button type="button" class="btn ghost small" data-pg="-1"' + (state.page ? '' : ' disabled') + '>&larr; Previous</button>' +
      '<span>Page ' + (state.page + 1) + ' of ' + pages + '</span><button type="button" class="btn ghost small" data-pg="1"' + (state.page < pages - 1 ? '' : ' disabled') + '>Next &rarr;</button>' : '';
  }
  $('#pager').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pg]'); if (!b) return;
    state.page += +b.getAttribute('data-pg'); renderLog();
    $('#log-panel').scrollIntoView({ block: 'start' });
  });
  $('#show').addEventListener('change', function () { state.show = this.value; state.page = 0; renderLog(); });
  $('#rows').addEventListener('change', function (e) {
    var tr = e.target.closest('tr'); if (!tr) return;
    var id = tr.getAttribute('data-id'), tag = state.tags[id] || { p: '', n: '' };
    if (e.target.hasAttribute('data-purpose')) { tag.p = e.target.value; e.target.className = tag.p; }
    else if (e.target.hasAttribute('data-note')) tag.n = e.target.value.trim();
    state.tags[id] = tag; save(); renderTotals();
  });
  function bulk(p) {
    var rows = visibleRows();
    rows.forEach(function (r) { var tag = state.tags[r.trip.id] || { n: '' }; tag.p = p; state.tags[r.trip.id] = tag; });
    save(); renderAll();
    say('Marked ' + rows.length + ' trip' + (rows.length === 1 ? '' : 's') + ' as ' + p + '.');
  }
  $('#bulk-business').addEventListener('click', function () { bulk('business'); });
  $('#bulk-personal').addEventListener('click', function () { bulk('personal'); });

  // ---------- CSV + print ----------
  $('#csv').addEventListener('click', function () {
    var csv = S.toCSV(rowsFor(periodTrips(), true), { period: state.periodLabel });
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var name = 'mileage-log-' + ($('#period').value.charAt(0) === 'y' ? $('#period').value.slice(1) : (state.from || 'start') + '-to-' + (state.to || 'end')) + '.csv';
    var a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  });
  $('#print').addEventListener('click', function () {
    var prev = state.show; state.show = 'all'; var pg = PAGE; PAGE = 1e9; renderLog();
    window.print();
    PAGE = pg; state.show = prev; renderLog();
  });

  // ---------- input wiring ----------
  var input = $('#file'), drop = $('#drop');
  input.addEventListener('change', function () { handleFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files); });
  $('#sample').addEventListener('click', function () {
    var y = NOW.getFullYear();
    var obj = D.android((y - 1) + '-11-01', y + '-' + String(NOW.getMonth() + 1).padStart(2, '0') + '-' + String(Math.min(NOW.getDate(), 28)).padStart(2, '0'), { dropDistanceEvery: 50 });
    var r = P.parseText(JSON.stringify(obj), 'sample.json');
    load(P.merge([r]), true);
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
