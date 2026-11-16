/* Weather Wrapped: page controller. No tracking. The place you type goes only to Open-Meteo (geocoding and
 * the historical weather archive); ZIP codes are looked up in static files on this site first. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var WS = window.WeatherStats, N = window.WeatherNet, C = window.WeatherCards;
  var APP_URL = 'https://lanternlab2027.github.io/lab/weather/';

  var NOW = new Date();
  var TODAY = WS.iso(NOW.getFullYear(), NOW.getMonth() + 1, NOW.getDate()); // the visitor's own calendar day
  var state = { loc: null, year: null, days: null, normals: null, stats: null, cards: [], canvases: [], units: null, unitsChosen: false, busy: false, token: 0 };
  var pool = []; // canvases are reused across re-renders (iOS caps total canvas memory)

  function say(msg, isErr) { var s = $('#status'); s.textContent = msg || ''; s.className = 'status' + (isErr ? ' err' : ''); }
  var toastT; function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2200); }
  function store(k, v) { try { if (v == null) localStorage.removeItem('weather.' + k); else localStorage.setItem('weather.' + k, v); } catch (e) { /* private mode */ } }
  function load(k) { try { return localStorage.getItem('weather.' + k); } catch (e) { return null; } }

  // ---------- ?ref= passthrough (URL only, nothing stored) ----------
  function nextRef() {
    var r = '';
    try { r = new URLSearchParams(location.search).get('ref') || ''; } catch (e) { r = ''; }
    r = r.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    if (!r) return 'share';
    var m = /^share(\d*)(?:-(.+))?$/.exec(r);
    if (m) return 'share' + ((m[1] ? +m[1] : 1) + 1) + (m[2] ? '-' + m[2] : '');
    return 'share-' + r;
  }
  var REF = nextRef();
  function shareUrl(toolOnly) {
    var u = APP_URL + '?';
    if (!toolOnly && state.loc) {
      if (state.loc.zip) u += 'zip=' + state.loc.zip + '&';
      else if (state.loc.typed) u += 'q=' + encodeURIComponent(state.loc.typed) + '&';
      if (state.year !== WS.defaultYear(TODAY)) u += 'y=' + state.year + '&';
    }
    return u + 'ref=' + encodeURIComponent(REF);
  }
  function shareText() {
    var S = state.stats;
    if (!S || !S.n) return 'Your city\u2019s year in weather, as shareable cards. Free: ' + shareUrl(true);
    return placeName() + '\u2019s ' + S.label + ' in weather: hottest ' + WS.fmt.temp(S.hottest.c, state.units) + ', ' + WS.fmt.precip(S.precipMM, state.units) + ' of rain and melted snow. Make yours: ' + shareUrl();
  }
  function placeName() { return (state.loc && state.loc.name) || 'Your town'; }

  // ---------- units ----------
  function setUnits(u, chosen) {
    state.units = { temp: u.temp, precip: u.precip };
    var t = document.querySelector('input[name=tu][value=' + u.temp + ']'), p = document.querySelector('input[name=pu][value=' + u.precip + ']');
    if (t) t.checked = true; if (p) p.checked = true;
    if (chosen) { state.unitsChosen = true; store('units', u.temp + ',' + u.precip); }
  }
  function readUnits() {
    var t = document.querySelector('input[name=tu]:checked'), p = document.querySelector('input[name=pu]:checked');
    return { temp: t ? t.value : 'F', precip: p ? p.value : 'in' };
  }

  // ---------- years ----------
  var DEF_YEAR = WS.defaultYear(TODAY);
  (function () {
    var sel = $('#year'), html = '';
    for (var y = DEF_YEAR; y >= DEF_YEAR - 5; y--) html += '<option value="' + y + '">' + y + (WS.range(y, TODAY) && !WS.isComplete(y, WS.range(y, TODAY).end) ? ' so far' : '') + '</option>';
    sel.innerHTML = html; sel.value = String(DEF_YEAR);
  })();

  // ---------- render ----------
  function info() {
    var S = state.stats;
    return { place: placeName(), label: S.label, complete: S.complete, through: S.through, units: state.units, year: state.year };
  }
  function render() {
    var S = state.stats, deck = $('#deck');
    deck.innerHTML = ''; state.canvases = []; state.cards = [];
    $('#results').hidden = false;
    $('#res-place').textContent = placeName();
    $('#res-label').textContent = S.n ? S.label + (S.complete ? '' : ' (Jan 1 \u2013 ' + S.through + ')') : '';
    var partial = S.n && !S.complete;
    $('#partial').hidden = !partial;
    if (partial) $('#partial-text').textContent = 'This is ' + S.label + ': Jan 1 through ' + S.through + ', the latest day with data. The full ' + state.year + ' is in on Jan 1.';
    if (!S.n) { $('#deck-count').textContent = '0 cards'; $('#empty').hidden = false; return; }
    $('#empty').hidden = true;
    var I = info(), cards = C.build(S, I);
    state.cards = cards;
    cards.forEach(function (card, i) {
      var fig = document.createElement('figure'); fig.className = 'card';
      var cv = pool[i] || (pool[i] = document.createElement('canvas'));
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Card ' + (i + 1) + ': ' + card.label);
      C.render(cv, card, S, I, i + 1, cards.length);
      var cap = document.createElement('figcaption');
      var lbl = document.createElement('span'); lbl.textContent = (i + 1) + '. ' + card.label;
      var share = document.createElement('button'); share.type = 'button'; share.className = 'btn small'; share.textContent = 'Share';
      var save = document.createElement('button'); save.type = 'button'; save.className = 'btn small ghost'; save.textContent = 'Save PNG';
      share.addEventListener('click', function () { shareOne(i); });
      save.addEventListener('click', function () { saveOne(i); });
      var btns = document.createElement('div'); btns.className = 'card-btns'; btns.appendChild(share); btns.appendChild(save);
      cap.appendChild(lbl); cap.appendChild(btns);
      fig.appendChild(cv); fig.appendChild(cap); deck.appendChild(fig);
      state.canvases.push(cv);
    });
    $('#deck-count').textContent = cards.length + ' cards';
    $('#grid-note').textContent = 'Grid point used: ' + Math.abs(state.grid.lat).toFixed(2) + '\u00b0' + (state.grid.lat >= 0 ? 'N' : 'S') + ', ' + Math.abs(state.grid.lon).toFixed(2) + '\u00b0' + (state.grid.lon >= 0 ? 'E' : 'W') + (state.grid.elevation != null ? ', ' + Math.round(state.units.temp === 'F' ? state.grid.elevation * 3.28084 : state.grid.elevation).toLocaleString('en-US') + (state.units.temp === 'F' ? ' ft' : ' m') + ' elevation' : '') + (state.grid.timezone ? ', days in ' + state.grid.timezone + ' time' : '') + '.';
  }
  function recompute() { state.stats = WS.compute(state.days, { year: state.year, normals: state.normals || null }); render(); }

  // ---------- flow ----------
  function setBusy(b) { state.busy = b; $('#go').disabled = b; }
  function lookup(q) {
    q = String(q || '').trim();
    if (/^\d{5}(-\d{4})?$/.test(q)) return N.zipToPoint(q.slice(0, 5));
    return N.cityToPoint(q);
  }
  function run(q, year) {
    if (state.busy) return;
    var token = ++state.token;
    setBusy(true); say('Finding ' + q + '\u2026');
    lookup(q).then(function (loc) {
      var rg = WS.range(year, TODAY);
      if (!rg) throw Object.assign(new Error('No ' + year + ' data yet. Try last year.'), { user: true });
      say('Loading ' + loc.name + '\u2019s ' + year + ' in weather\u2026');
      return N.archive(loc.lat, loc.lon, rg.start, rg.end, WS.VARS).then(function (json) {
        if (token !== state.token) return;
        var p = WS.parse(json);
        state.loc = loc; state.year = year; state.days = p.days; state.normals = null;
        state.grid = { lat: p.lat, lon: p.lon, elevation: p.elevation, timezone: p.timezone };
        if (!state.unitsChosen) setUnits(WS.unitsFor(loc.country));
        recompute();
        say(state.stats.n ? '' : 'Open-Meteo has no ' + year + ' data for that spot yet.', !state.stats.n);
        if (loc.zip) store('q', loc.zip); else if (loc.typed) store('q', loc.typed);
        try {
          var u = new URL(location.href); u.search = '';
          if (loc.zip) u.searchParams.set('zip', loc.zip); else if (loc.typed) u.searchParams.set('q', loc.typed);
          if (year !== DEF_YEAR) u.searchParams.set('y', String(year));
          var ref = new URLSearchParams(location.search).get('ref'); if (ref) u.searchParams.set('ref', ref);
          history.replaceState(null, '', u.toString());
        } catch (e) { /* ignore */ }
        $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
        loadNormals(loc, year, token);
      });
    }).catch(function (e) {
      say(e && e.user ? e.message : 'Couldn\u2019t reach Open-Meteo. Please try again in a minute.', true);
    }).then(function () { setBusy(false); });
  }
  // The "weirdest day" needs a normal for each date: the 10 years before, daily highs only (one variable keeps
  // the request light). If it fails, that card is simply skipped.
  function loadNormals(loc, year, token) {
    var nr = WS.normalsRange(year);
    $('#weird-note').hidden = false; $('#weird-note').textContent = 'Comparing with ' + nr.from + '\u2013' + nr.to + ' to find your weirdest day\u2026';
    N.archive(loc.lat, loc.lon, nr.start, nr.end, ['temperature_2m_max']).then(function (json) {
      if (token !== state.token) return;
      state.normals = WS.normals(json);
      recompute();
      $('#weird-note').hidden = true;
    }).catch(function () {
      if (token !== state.token) return;
      $('#weird-note').textContent = 'Couldn\u2019t load the 10-year comparison just now, so the weirdest-day card is skipped.';
    });
  }

  $('#find').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('#q').value.trim();
    if (!q) { say('Enter a ZIP code or a city.', true); $('#q').focus(); return; }
    run(q, +$('#year').value);
  });
  $('#year').addEventListener('change', function () { if (state.loc) run(state.loc.zip || state.loc.typed, +$('#year').value); });
  Array.prototype.forEach.call(document.querySelectorAll('input[name=tu], input[name=pu]'), function (r) {
    r.addEventListener('change', function () { setUnits(readUnits(), true); if (state.stats) render(); });
  });

  // ---------- share and save (same as Streaming Wrapped) ----------
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function fileName(i) { return 'weather-wrapped-' + slug(placeName()) + '-' + state.year + '-' + String(i + 1).padStart(2, '0') + '-' + slug(state.cards[i].label) + '.png'; }
  function blobOf(i) { return new Promise(function (res) { state.canvases[i].toBlob(res, 'image/png'); }); }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  async function saveOne(i) { download(await blobOf(i), fileName(i)); }
  async function shareFiles(files) {
    if (navigator.canShare && navigator.share && navigator.canShare({ files: files })) {
      try { await navigator.share({ files: files, title: 'Weather Wrapped', text: shareText() }); return true; }
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
      download(await zip.generateAsync({ type: 'blob' }), 'weather-wrapped-' + slug(placeName()) + '-' + state.year + '.zip');
    } finally { btn.disabled = false; btn.textContent = t; }
  }
  async function shareAll() {
    var files = [];
    for (var i = 0; i < state.canvases.length; i++) files.push(new File([await blobOf(i)], fileName(i), { type: 'image/png' }));
    if (!(await shareFiles(files))) zipAll();
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } ta.remove(); return ok;
    }
  }
  $('#zip-all').addEventListener('click', zipAll);
  var sa = $('#share-all');
  try { if (!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }))) sa.hidden = true; } catch (e) { sa.hidden = true; }
  sa.addEventListener('click', shareAll);
  $('#copy-link').addEventListener('click', async function () { toast((await copyText(shareText())) ? 'Link copied' : 'Couldn\u2019t copy'); });
  $('#share-tool').addEventListener('click', async function () {
    var t = 'Your city\u2019s year in weather, as shareable cards (free): ' + shareUrl(true);
    if (navigator.share) { try { await navigator.share({ text: t }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    toast((await copyText(t)) ? 'Link copied' : 'Couldn\u2019t copy');
  });

  // In-app browsers often block downloads and the share sheet.
  if (/Instagram|FBAN|FBAV|FB_IAB|musical_ly|TikTok|BytedanceWebview|Snapchat|LinkedInApp/i.test(navigator.userAgent || '')) {
    say('Opened inside an app? If saving the cards doesn\u2019t work here, open this page in Safari or Chrome.');
  }

  // ---------- start ----------
  var saved = (load('units') || '').split(',');
  if ((saved[0] === 'F' || saved[0] === 'C') && (saved[1] === 'in' || saved[1] === 'mm')) setUnits({ temp: saved[0], precip: saved[1] }, true);
  else setUnits({ temp: 'F', precip: 'in' });
  var params = new URLSearchParams(location.search);
  var y0 = +params.get('y'); if (!(y0 >= DEF_YEAR - 5 && y0 <= DEF_YEAR)) y0 = DEF_YEAR;
  $('#year').value = String(y0);
  var q0 = (params.get('zip') || params.get('q') || '').slice(0, 80);
  if (q0) { $('#q').value = q0; run(q0, y0); }
  else { var last = load('q'); if (last) $('#q').value = last; }

  Object.defineProperty(window, '__weatherState', { get: function () { return state; } });
})();
