/* TikTok Wrapped: page controller. Everything happens in this tab; the export is never sent anywhere. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var P = window.TikTokParser, S = window.TikTokStats, C = window.TikTokCards;

  var state = { parsed: null, stats: null, cards: [], canvases: [], year: null, tz: 'UTC', showTerms: false };
  var pool = []; // canvases reused across re-renders (iOS caps total canvas memory)

  var fileInput = $('#file'), drop = $('#drop'), status = $('#status');
  var deckWrap = $('#results'), deck = $('#deck'), yearSel = $('#year'), tzSel = $('#tz'), empty = $('#empty');
  var NOW = new Date();
  var CURRENT = NOW.getFullYear();
  var TODAY = Math.round(Date.UTC(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()) / 86400000);

  function say(msg, isError) {
    status.textContent = msg || '';
    status.className = 'status' + (isError ? ' err' : '');
    if (isError) {
      var help = document.createElement('a'); help.href = '#request'; help.textContent = 'How to request your export';
      var demo = document.createElement('button'); demo.type = 'button'; demo.className = 'linkbtn'; demo.textContent = 'see a sample deck';
      demo.addEventListener('click', showSample);
      status.appendChild(document.createTextNode(' ')); status.appendChild(help);
      status.appendChild(document.createTextNode(' or ')); status.appendChild(demo); status.appendChild(document.createTextNode('.'));
    }
  }

  // ---------- share links: ?ref= passthrough (URL only, nothing stored) ----------
  var APP_URL = 'https://lanternlab2027.github.io/lab/tiktok/';
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
  var SHARE_LEAD = 'My year of scrolling, Wrapped. Make yours from your TikTok data export (free, nothing uploaded):';
  function shareText() { return SHARE_LEAD + ' ' + SHARE_URL; }

  // ---------- time zones ----------
  function browserZone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } }
  function fillZones() {
    var here = browserZone(), zones = [];
    try { zones = Intl.supportedValuesOf('timeZone'); } catch (e) { zones = ['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney']; }
    if (zones.indexOf(here) < 0 && here !== 'UTC') zones.unshift(here);
    var opts = ['<option value="' + here + '">' + here.replace(/_/g, ' ') + ' (this device)</option>', '<option value="UTC">UTC (as stored in the export)</option>'];
    zones.forEach(function (z) { if (z !== here && z !== 'UTC') opts.push('<option value="' + z + '">' + z.replace(/_/g, ' ') + '</option>'); });
    tzSel.innerHTML = opts.join('');
    state.tz = P.validZone(here) ? here : 'UTC';
    tzSel.value = state.tz;
  }

  // ---------- reading files ----------
  async function readUploads(files) {
    var out = [], dm = 0;
    for (var i = 0; i < files.length; i++) {
      var file = files[i], name = file.name || 'upload';
      if (/\.zip$/i.test(name) || /zip/.test(file.type)) {
        if (!window.JSZip) throw new Error('Zip support failed to load. Unzip the file and upload user_data_tiktok.json (or the .txt files) instead.');
        var zip = await window.JSZip.loadAsync(file), paths = [];
        zip.forEach(function (path, entry) { if (!entry.dir) paths.push(path); });
        var pick = P.pickEntries(paths);
        dm += pick.skipped.dm; // message files are never decompressed
        if (!pick.read.length) throw new Error('That zip has no TikTok data inside. Upload the zip from Download your data (it has user_data_tiktok.json, or a \u201cYour Activity\u201d folder of .txt files).');
        for (var j = 0; j < pick.read.length; j++) out.push({ name: pick.read[j].path, text: await zip.file(pick.read[j].path).async('string') });
      } else {
        if (P.classifyPath(name) === 'dm') { dm++; continue; }
        if (file.size > 400 * 1024 * 1024) throw new Error('That file is too big to read in a browser tab.');
        out.push({ name: name, text: await file.text() });
      }
    }
    return { files: out, dm: dm };
  }

  async function handleFiles(files) {
    if (!files || !files.length) return;
    say('Reading your export on this device\u2026');
    try {
      var r = await readUploads(files);
      await new Promise(function (res) { setTimeout(res, 20); });
      var parsed = P.parseFiles(r.files, { skippedDm: r.dm });
      r = null;
      load(parsed);
    } catch (e) {
      say(e.message || 'Something went wrong reading that file.', true);
    }
  }

  function yearOptions() {
    var ys = S.years(state.parsed.watch, state.tz);
    if (!ys.some(function (y) { return y.year === CURRENT; })) ys.push({ year: CURRENT, count: 0 });
    ys.sort(function (a, b) { return b.year - a.year; });
    yearSel.innerHTML = ys.map(function (y) { return '<option value="' + y.year + '">' + y.year + ' (' + y.count.toLocaleString('en-US') + (y.count === 1 ? ' video' : ' videos') + ')</option>'; }).join('') + '<option value="all">All time</option>';
    return ys;
  }

  function pickYear() {
    var ys = yearOptions();
    var cur = ys.filter(function (y) { return y.year === CURRENT; })[0];
    var latest = ys.filter(function (y) { return y.count > 0; })[0];
    state.year = cur && cur.count ? CURRENT : latest ? latest.year : CURRENT;
    yearSel.value = String(state.year);
  }

  function load(parsed) {
    state.parsed = parsed;
    pickYear();
    var msg = 'Found ' + parsed.watch.length.toLocaleString('en-US') + ' videos in your watch history';
    var extra = [];
    if (parsed.found.likes) extra.push(parsed.likes.length.toLocaleString('en-US') + ' likes');
    if (parsed.found.searches) extra.push(parsed.searches.length.toLocaleString('en-US') + ' searches');
    if (extra.length) msg += ', plus ' + extra.join(' and ');
    msg += '. Direct messages were skipped. Nothing was uploaded.';
    if (state.year !== CURRENT) msg += ' Nothing watched in ' + CURRENT + ' yet, so we\u2019re showing ' + state.year + '.';
    say(msg);
    render();
    deckWrap.hidden = false;
    deckWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- rendering ----------
  function cardTitle(name) {
    name = (name || '').trim();
    var who = name ? name + (/s$/i.test(name) ? '\u2019' : '\u2019s') : 'My';
    return state.year == null ? who + ' scroll, all time' : who + ' ' + state.year + ' scroll';
  }

  function render() {
    var stats = S.compute(state.parsed, { year: state.year, tz: state.tz, today: TODAY });
    state.stats = stats;
    var info = { title: cardTitle($('#name-input').value), year: state.year, periodShort: state.year == null ? 'All time' : String(state.year), showTerms: state.showTerms, tzLabel: state.tz.replace(/_/g, ' ') };
    deck.innerHTML = ''; state.canvases = []; state.cards = [];
    if (!stats.count) {
      empty.hidden = false;
      empty.textContent = 'No videos watched ' + (state.year == null ? 'in this file' : 'in ' + state.year) + ' yet. Pick another year above.';
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

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function fileName(i) { return 'scroll-wrapped-' + (state.year || 'all-time') + '-' + String(i + 1).padStart(2, '0') + '-' + slug(state.cards[i].label) + '.png'; }
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
      try { await navigator.share({ files: files, title: 'Scroll Wrapped', text: shareText() }); return true; }
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
      download(await zip.generateAsync({ type: 'blob' }), 'scroll-wrapped-' + (state.year || 'all-time') + '.zip');
    } finally { btn.disabled = false; btn.textContent = t; }
  }

  async function shareAll() {
    var files = [];
    for (var i = 0; i < state.canvases.length; i++) files.push(new File([await blobOf(i)], fileName(i), { type: 'image/png' }));
    if (!(await shareFiles(files))) zipAll();
  }

  // ---------- wiring ----------
  fillZones();
  fileInput.addEventListener('change', function () { handleFiles(fileInput.files); });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { handleFiles(e.dataTransfer && e.dataTransfer.files); });
  function showSample() {
    var data = window.TikTokDemo.build({ year: CURRENT, endMonth: NOW.getMonth() + 1, endDay: Math.max(1, NOW.getDate() - 1), seed: 20261115 });
    load(P.parseFiles([{ name: 'sample.json', text: JSON.stringify(data) }]));
    say('Showing a made-up sample (every video, search and number is invented). Request your own export to make yours.');
  }
  $('#sample').addEventListener('click', showSample);
  var st = document.getElementById('sample-top'); if (st) st.addEventListener('click', function (e) { e.preventDefault(); showSample(); });
  $('#peek').addEventListener('click', showSample);

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
  ps.addEventListener('click', function () { navigator.share({ title: 'Scroll Wrapped', text: SHARE_LEAD, url: SHARE_URL }).catch(function () {}); });

  yearSel.addEventListener('change', function () { state.year = yearSel.value === 'all' ? null : +yearSel.value; render(); });
  tzSel.addEventListener('change', function () {
    state.tz = tzSel.value;
    var keep = yearSel.value; yearOptions();
    if ([].some.call(yearSel.options, function (o) { return o.value === keep; })) yearSel.value = keep; else pickYear();
    state.year = yearSel.value === 'all' ? null : +yearSel.value;
    render();
  });
  $('#show-terms').addEventListener('change', function (e) { state.showTerms = e.target.checked; render(); });
  var tt; $('#name-input').addEventListener('input', function () { clearTimeout(tt); tt = setTimeout(render, 250); });
  $('#zip-all').addEventListener('click', zipAll);
  var sa = $('#share-all');
  if (!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }))) sa.hidden = true;
  sa.addEventListener('click', shareAll);
  $('#reset').addEventListener('click', function () {
    state.parsed = null; state.stats = null; state.cards = []; state.canvases = [];
    deck.innerHTML = ''; empty.hidden = true; deckWrap.hidden = true; fileInput.value = ''; say('Cleared. Nothing was saved anywhere.');
    $('#top').scrollIntoView({ behavior: 'smooth' });
  });

  // ---------- email reminder (sends only the email address; never export data) ----------
  (function () {
    var KIT_KEY = '9OgTfHEbtX6FB0NWVjkgyg'; var TAG = '25919883';
    var f = document.getElementById('signup-form');
    var msg = document.getElementById('signup-msg');
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = document.getElementById('signup-email').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Please enter a valid email.'; return; }
      var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing up...';
      try {
        var r = await fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: KIT_KEY, email: email })
        });
        if (!r.ok) throw new Error('status ' + r.status);
        f.innerHTML = "<b>You're on the list.</b> We'll email you once when Wrapped season opens, as a nudge to request your export.";
        msg.textContent = '';
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Remind me';
        msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
      }
    });
  })();

  // In-app browsers often block downloads and the share sheet.
  if (/Instagram|FBAN|FBAV|FB_IAB|musical_ly|TikTok|BytedanceWebview|Snapchat|LinkedInApp/i.test(navigator.userAgent || '') && !status.textContent) {
    say('Opened inside an app? Saving cards may not work here. Open this page in Safari or Chrome (\u22ef menu \u2192 Open in browser).');
  }

  Object.defineProperty(window, '__tiktokState', { get: function () { return state; } });
})();
