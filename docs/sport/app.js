/* Year in Motion: page controller. Everything happens in this tab; activities are never sent anywhere. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var P = window.SportParser, S = window.SportStats, C = window.SportCards, Z = window.SportZip, D = window.SportDemo;

  var CURRENT = new Date().getFullYear();
  var lang = (navigator.language || 'en-US').toLowerCase();
  var DEFAULT_UNITS = /^en-(us|lr)|^my\b/.test(lang) ? 'imperial' : 'metric';

  function fresh() {
    return { acts: [], source: null, csvText: null, zip: null, trackIndex: null, trackCache: {}, looseTracks: [], year: null, units: DEFAULT_UNITS, zone: null, cards: [], canvases: [], stats: null, sample: false };
  }
  var state = fresh();
  var pool = []; // canvases are reused: iOS Safari caps total canvas memory
  var fileInput = $('#file'), drop = $('#drop'), status = $('#status');
  var deckWrap = $('#results'), deck = $('#deck'), yearSel = $('#year'), empty = $('#empty');

  function say(msg, isError) {
    status.textContent = msg || '';
    status.className = 'status' + (isError ? ' err' : '');
    if (isError) {
      var help = document.createElement('a'); help.href = '#export'; help.textContent = 'How to export';
      var demo = document.createElement('button'); demo.type = 'button'; demo.className = 'linkbtn'; demo.textContent = 'see a sample deck';
      demo.addEventListener('click', showSample);
      status.appendChild(document.createTextNode(' ')); status.appendChild(help);
      status.appendChild(document.createTextNode(' or ')); status.appendChild(demo); status.appendChild(document.createTextNode('.'));
    }
  }
  function progress(done, total, label) {
    var p = $('#prog');
    if (total == null) { p.hidden = true; return; }
    p.hidden = false; $('#prog-bar').max = total || 1; $('#prog-bar').value = done; $('#prog-label').textContent = label || '';
  }
  function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }

  // ---------- share links: ?ref= passthrough (URL only, nothing stored) ----------
  var APP_URL = 'https://lanternlab2027.github.io/lab/sport/';
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
  var SHARE_LEAD = 'My year in sport, on cards. Make yours free from your Strava or Garmin export (nothing uploaded):';
  function shareText() { return SHARE_LEAD + ' ' + SHARE_URL; }

  // ---------- reading files ----------
  var TRACK_RE = /\.(gpx|tcx|fit)(\.gz)?$/i;
  function base(name) { return String(name).split('/').pop().toLowerCase(); }
  async function bytesToTrack(name, bytes) {
    if (/\.gz$/i.test(name)) bytes = await Z.gunzip(bytes);
    return P.parseTrackFile(name, bytes);
  }
  function decode(bytes) { return new TextDecoder('utf-8').decode(bytes); }

  async function handleFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    if (!files.length) return;
    say('Reading your activities on this device\u2026');
    var keepUnits = state.units;
    state = fresh(); state.units = keepUnits;
    try {
      var zip = files.filter(function (f) { return /\.zip$/i.test(f.name) || /^application\/(x-)?zip(-compressed)?$/.test(f.type); })[0];
      if (zip) await loadZip(zip);
      else {
        var csv = files.filter(function (f) { return /\.(csv|txt)$/i.test(f.name); })[0];
        var json = files.filter(function (f) { return /\.json$/i.test(f.name); })[0];
        var trackFiles = files.filter(function (f) { return TRACK_RE.test(f.name); });
        if (csv) {
          if (csv.size > 200 * 1024 * 1024) throw new Error('That CSV is too big to be an activities export.');
          loadCSV(await csv.text());
        } else if (json) {
          var gj = P.parseGarminJSON(await json.text());
          if (!gj || !gj.acts.length) throw new Error('That JSON file doesn\u2019t look like a Garmin activities export.');
          state.source = gj.source; state.acts = gj.acts;
        }
        if (trackFiles.length) await loadLooseTracks(trackFiles.map(function (f) { return { name: f.name, get: function () { return f.arrayBuffer().then(function (b) { return new Uint8Array(b); }); } }; }), !state.source);
        if (!state.source && !state.acts.length) throw new Error('Add a Strava export .zip, an activities .csv, or .gpx/.fit/.tcx files.');
      }
      finishLoad();
    } catch (e) {
      progress(null);
      say(e.message || 'Something went wrong reading that file.', true);
    }
  }

  function loadCSV(text) {
    var r = P.parseActivitiesCSV(text, { defaultUnits: DEFAULT_UNITS });
    state.source = r.source; state.acts = r.acts; state.csvText = r.source === 'garmin' ? text : null;
    if (r.source === 'garmin') {
      var g = r.unitsGuess || DEFAULT_UNITS;
      $('#garmin-units').value = g;
      state.acts = P.parseActivitiesCSV(text, { garminUnits: g }).acts;
      state.units = g;
    }
  }

  async function loadZip(file) {
    progress(0, 1, 'Opening the zip\u2026');
    var z = await Z.open(file);
    var entries = z.entries.filter(function (e) { return !/(^|\/)(__MACOSX|\.)/.test(e.name); });
    var csv = entries.filter(function (e) { return /(^|\/)activities\.csv$/i.test(e.name); })[0];
    var json = entries.filter(function (e) { return /summarizedActivities\.json$/i.test(e.name); })[0];
    var tracks = entries.filter(function (e) { return TRACK_RE.test(e.name); });
    if (csv) {
      loadCSV(decode(await z.read(csv)));
      state.zip = z;
      state.trackIndex = {};
      tracks.forEach(function (e) { state.trackIndex[base(e.name)] = e; });
      return;
    }
    if (json) {
      var gj = P.parseGarminJSON(decode(await z.read(json)));
      if (gj && gj.acts.length) { state.source = gj.source; state.acts = gj.acts; return; }
    }
    var other = entries.filter(function (e) { return /\.csv$/i.test(e.name); })[0];
    if (other) { loadCSV(decode(await z.read(other))); return; }
    if (tracks.length) { await loadLooseTracks(tracks.map(function (e) { return { name: e.name, get: function () { return z.read(e); } }; }), true); return; }
    throw new Error('That zip has no activities.csv or route files. Upload the .zip Strava emailed you, or a Garmin Activities.csv.');
  }

  // GPX/FIT/TCX files given directly (or zipped on their own). asActivities: also count them as activities.
  async function loadLooseTracks(items, asActivities) {
    var ok = 0, bad = 0, cap = Math.min(items.length, 2000);
    for (var i = 0; i < cap; i++) {
      if (i % 10 === 0) { progress(i, cap, 'Reading route ' + (i + 1) + ' of ' + cap + '\u2026'); await tick(); }
      try {
        var tr = await bytesToTrack(items[i].name, await items[i].get());
        if (!tr.act) { bad++; continue; }
        state.looseTracks.push({ utc: tr.utc, line: tr.line, start: tr.line ? tr.line[0] : null, sport: tr.act.sport, dist: tr.act.dist, act: tr.act });
        if (asActivities) state.acts.push(tr.act);
        ok++;
      } catch (e) { bad++; }
    }
    progress(null);
    if (asActivities) state.source = 'tracks';
    state.trackNote = bad ? bad + ' ' + (bad === 1 ? 'file' : 'files') + ' couldn\u2019t be read and ' + (bad === 1 ? 'was' : 'were') + ' skipped.' : '';
    if (!ok && asActivities) throw new Error('None of those files had a readable GPS track.');
  }

  function finishLoad() {
    if (!state.acts.length) throw new Error('No activities found in that file.');
    state.zone = state.source === 'strava' ? P.inferZone(state.acts) : { kind: 'browser' };
    P.applyZone(state.acts, state.zone);
    state.looseTracks.forEach(function (t) { t.t = t.act.t; });
    setUnitsUI();
    $('#garmin-units-wrap').hidden = state.source !== 'garmin';
    var ys = yearOptions();
    var cur = ys.filter(function (y) { return y.year === CURRENT && y.count; })[0];
    var latest = ys.filter(function (y) { return y.count > 0; })[0];
    state.year = cur ? CURRENT : latest ? latest.year : CURRENT;
    yearSel.value = String(state.year);
    var names = { strava: 'Strava export', garmin: 'Garmin Connect CSV', 'garmin-archive': 'Garmin data export', tracks: 'route files' };
    var msg = 'Found ' + state.acts.length.toLocaleString('en-US') + ' activities in your ' + (names[state.source] || 'file') + '. Nothing was uploaded.';
    if (state.year !== CURRENT) msg += ' No activities in ' + CURRENT + ' yet, so we\u2019re showing ' + state.year + '.';
    if (state.trackNote) msg += ' ' + state.trackNote;
    say(msg);
    deckWrap.hidden = false;
    refresh().then(function () { deckWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }

  function yearOptions() {
    var ys = S.years(state.acts);
    if (!ys.some(function (y) { return y.year === CURRENT; })) ys.push({ year: CURRENT, count: 0 });
    ys.sort(function (a, b) { return b.year - a.year; });
    yearSel.innerHTML = ys.map(function (y) { return '<option value="' + y.year + '">' + y.year + ' (' + y.count.toLocaleString('en-US') + (y.count === 1 ? ' activity' : ' activities') + ')</option>'; }).join('');
    return ys;
  }

  // Route files from a Strava zip are read lazily, only for the year on screen.
  async function tracksForYear(year) {
    if (!state.zip || !state.trackIndex) return state.looseTracks;
    var want = state.acts.filter(function (a) { return a.t != null && new Date(a.t).getUTCFullYear() === year && a.file && !(a.file in state.trackCache); });
    var todo = want.filter(function (a) { return state.trackIndex[base(a.file)]; });
    want.forEach(function (a) { if (!state.trackIndex[base(a.file)]) state.trackCache[a.file] = null; });
    var cap = Math.min(todo.length, 1500);
    for (var i = 0; i < cap; i++) {
      var a = todo[i];
      if (i % 8 === 0) { progress(i, cap, 'Drawing route ' + (i + 1) + ' of ' + cap + '\u2026'); await tick(); }
      try {
        var tr = await bytesToTrack(a.file, await state.zip.read(state.trackIndex[base(a.file)]));
        state.trackCache[a.file] = tr.line ? { t: a.t, line: tr.line, start: tr.line[0], sport: a.sport, dist: a.dist || tr.act && tr.act.dist } : null;
      } catch (e) { state.trackCache[a.file] = null; }
    }
    progress(null);
    var out = [];
    Object.keys(state.trackCache).forEach(function (k) { if (state.trackCache[k]) out.push(state.trackCache[k]); });
    return out;
  }

  // ---------- rendering ----------
  function cardTitle(name) {
    name = (name || '').trim();
    var who = name ? name + (/s$/i.test(name) ? '\u2019' : '\u2019s') : 'My';
    return who + ' ' + state.year + ' in motion';
  }

  var renderSeq = 0;
  async function refresh() {
    var seq = ++renderSeq;
    var tracks = $('#hide-routes').checked ? [] : await tracksForYear(state.year);
    if (seq !== renderSeq) return;
    render(tracks);
  }

  function render(tracks) {
    window.__sportRenders = (window.__sportRenders || 0) + 1; // lets tests wait for a re-render
    var stats = S.compute(state.acts, { year: state.year, tracks: tracks || [], now: Date.now() });
    state.stats = stats;
    var info = { title: cardTitle($('#name-input').value), periodShort: String(state.year), units: state.units, trim: $('#trim').checked ? 500 : 0, hideRoutes: $('#hide-routes').checked };
    deck.innerHTML = ''; state.canvases = []; state.cards = [];
    routesNote(stats);
    if (!stats.count) {
      empty.hidden = false;
      empty.textContent = 'No activities in ' + state.year + ' yet. Pick another year above.';
      $('#deck-count').textContent = '0 cards';
      return;
    }
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

  function routesNote(stats) {
    var n = $('#routes-note');
    if ($('#hide-routes').checked) n.textContent = 'Routes are hidden. No route card in the deck.';
    else if (stats.tracks && stats.tracks.length) n.textContent = stats.tracks.length + ' routes drawn for ' + state.year + '. Only line shapes are drawn: no map, no place names, no coordinates.';
    else n.textContent = state.source === 'strava' && !state.zip ? 'Route art needs the full Strava .zip (activities.csv alone has no GPS).' : state.source === 'garmin' || state.source === 'garmin-archive' ? 'Route art needs GPX/FIT files. Add them together with your CSV.' : 'No GPS routes for ' + state.year + '.';
  }

  function setUnitsUI() {
    $('#u-metric').setAttribute('aria-pressed', String(state.units === 'metric'));
    $('#u-imperial').setAttribute('aria-pressed', String(state.units === 'imperial'));
  }

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function fileName(i) { return 'year-in-motion-' + state.year + '-' + String(i + 1).padStart(2, '0') + '-' + slug(state.cards[i].label) + '.png'; }
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
      try { await navigator.share({ files: files, title: 'Year in Motion', text: shareText() }); return true; }
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
      download(await zip.generateAsync({ type: 'blob' }), 'year-in-motion-' + state.year + '.zip');
    } finally { btn.disabled = false; btn.textContent = t; }
  }
  async function shareAll() {
    var files = [];
    for (var i = 0; i < state.canvases.length; i++) files.push(new File([await blobOf(i)], fileName(i), { type: 'image/png' }));
    if (!(await shareFiles(files))) zipAll();
  }

  // ---------- sample deck (a made-up athlete; routes are synthetic shapes) ----------
  function showSample() {
    var keepUnits = state.units;
    state = fresh(); state.units = keepUnits; state.sample = true;
    var raw = D.build({ to: Math.min(Date.now(), Date.UTC(CURRENT, 11, 31)) });
    var r = P.parseActivitiesCSV(D.stravaCSV(raw));
    state.source = 'strava'; state.acts = r.acts;
    P.applyZone(state.acts, { kind: 'fixed', offset: D.OFFSET });
    var byFile = {};
    state.acts.forEach(function (a) { if (a.file) byFile[a.file] = a; });
    raw.forEach(function (a) {
      if (!a.file) return;
      var tr = P.summarizeTrack({ pts: D.trackFor(a), type: a.type });
      var act = byFile[a.file];
      if (tr.line && act) state.looseTracks.push({ t: act.t, line: tr.line, start: tr.line[0], sport: act.sport, dist: act.dist, act: act });
    });
    $('#garmin-units-wrap').hidden = true;
    setUnitsUI();
    var ys = yearOptions();
    var latest = ys.filter(function (y) { return y.count > 0; })[0];
    state.year = latest ? latest.year : CURRENT;
    yearSel.value = String(state.year);
    say('Showing a made-up sample athlete (routes are computer-generated shapes). Add your own export to make yours.');
    deckWrap.hidden = false;
    refresh().then(function () { deckWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }

  // ---------- wiring ----------
  fileInput.addEventListener('change', function () { handleFiles(fileInput.files); });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { handleFiles(e.dataTransfer && e.dataTransfer.files); });
  $('#sample').addEventListener('click', showSample);
  $('#peek').addEventListener('click', showSample);
  yearSel.addEventListener('change', function () { state.year = +yearSel.value; refresh(); });
  $('#u-metric').addEventListener('click', function () { state.units = 'metric'; setUnitsUI(); refresh(); });
  $('#u-imperial').addEventListener('click', function () { state.units = 'imperial'; setUnitsUI(); refresh(); });
  $('#garmin-units').addEventListener('change', function () {
    if (!state.csvText) return;
    var g = $('#garmin-units').value;
    state.acts = P.parseActivitiesCSV(state.csvText, { garminUnits: g }).acts;
    P.applyZone(state.acts, state.zone);
    state.units = g; setUnitsUI(); refresh();
  });
  $('#trim').addEventListener('change', refresh);
  $('#hide-routes').addEventListener('change', refresh);
  var tt; $('#name-input').addEventListener('input', function () { clearTimeout(tt); tt = setTimeout(refresh, 250); });
  $('#zip-all').addEventListener('click', zipAll);
  var sa = $('#share-all');
  if (!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }))) sa.hidden = true;
  sa.addEventListener('click', shareAll);
  $('#reset').addEventListener('click', function () {
    var keepUnits = state.units;
    state = fresh(); state.units = keepUnits;
    deck.innerHTML = ''; empty.hidden = true; deckWrap.hidden = true; fileInput.value = ''; say('Cleared. Nothing was saved anywhere.');
    $('#top').scrollIntoView({ behavior: 'smooth' });
  });
  setUnitsUI();

  // export-help tabs
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role=tab]'));
  function selectTab(t) {
    tabs.forEach(function (x) { var on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute('aria-controls')).hidden = !on; });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; selectTab(n); n.focus();
    });
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
  var ps = $('#pass-share');
  if (!navigator.share) ps.hidden = true;
  ps.addEventListener('click', function () { navigator.share({ title: 'Year in Motion', text: SHARE_LEAD, url: SHARE_URL }).catch(function () {}); });

  // ---------- email signup (sends only the email address; never activity data) ----------
  (function () {
    var KIT_KEY = '9OgTfHEbtX6FB0NWVjkgyg'; var TAG = '25912977';
    var f = document.getElementById('signup-form');
    var msg = document.getElementById('signup-msg');
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = document.getElementById('signup-email').value.trim();
      var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing up...';
      try {
        var r = await fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: KIT_KEY, email: email })
        });
        if (!r.ok) throw new Error('status ' + r.status);
        f.innerHTML = "<b>You're on the list.</b> We'll send one reminder to come back and make your cards.";
        msg.textContent = '';
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Remind me';
        msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
      }
    });
  })();

  // In-app browsers (Instagram, TikTok, Facebook, Snapchat...) often block downloads and the share sheet.
  if (/Instagram|FBAN|FBAV|FB_IAB|musical_ly|TikTok|BytedanceWebview|Snapchat|LinkedInApp/i.test(navigator.userAgent || '') && !status.textContent) {
    say('Opened inside an app? If saving the cards doesn\u2019t work here, open this page in Safari or Chrome (\u22ef menu \u2192 Open in browser).');
  }

  Object.defineProperty(window, '__sportState', { get: function () { return state; } });
})();
