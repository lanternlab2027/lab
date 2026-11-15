/* Dating Wrapped: page controller. Everything happens in this tab; the export is never sent anywhere.
 * Files are read into memory, reduced to anonymous counts by parser.js, and the raw text is dropped. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var P = window.DatingParser, S = window.DatingStats, C = window.DatingCards;

  var state = { sources: [], stats: null, cards: [], canvases: [], year: null, app: 'all', safe: true };
  var pool = []; // canvases reused across re-renders (iOS caps total canvas memory)

  var fileInput = $('#file'), drop = $('#drop'), status = $('#status');
  var deckWrap = $('#results'), deck = $('#deck'), yearSel = $('#year'), appSel = $('#app'), empty = $('#empty'), safeBox = $('#safe');
  var NOW = new Date();
  var CURRENT = NOW.getFullYear();
  var TODAY = Math.round(Date.UTC(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()) / 86400000);
  var APPNAME = { tinder: 'Tinder', hinge: 'Hinge' };

  function say(msg, isError) {
    status.textContent = msg || '';
    status.className = 'status' + (isError ? ' err' : '');
    if (isError) {
      var help = document.createElement('a'); help.href = '#export'; help.textContent = 'How to download your data';
      var demo = document.createElement('button'); demo.type = 'button'; demo.className = 'linkbtn'; demo.textContent = 'see a sample deck';
      demo.addEventListener('click', showSample);
      status.appendChild(document.createTextNode(' ')); status.appendChild(help);
      status.appendChild(document.createTextNode(' or ')); status.appendChild(demo); status.appendChild(document.createTextNode('.'));
    }
  }

  // ---------- share links: ?ref= passthrough (URL only, nothing stored) ----------
  var APP_URL = 'https://lanternlab2027.github.io/lab/dating/';
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
  var SHARE_LEAD = 'My dating year, Wrapped. Make yours from your Tinder or Hinge data (free, nothing uploaded):';
  function shareText() { return SHARE_LEAD + ' ' + SHARE_URL; }

  // ---------- reading files ----------
  var WANT = /(^|\/)(data(-[a-z0-9_-]+)?\.json|matches\.json|match_likes\.csv|match_roses\.csv|match_skips\.csv|match_blocks\.csv|chat_message\.csv|chat_voice_note\.csv)$/i;
  async function readOne(file) {
    var name = file.name || 'data.json';
    if (/\.zip$/i.test(name) || /zip/.test(file.type)) {
      if (!window.JSZip) throw new Error('Zip support failed to load. Unzip the file and upload data.json or matches.json instead.');
      if (file.size > 1500 * 1024 * 1024) throw new Error('That zip is very large. Unzip it and upload just data.json (Tinder) or matches.json (Hinge).');
      var zip = await window.JSZip.loadAsync(file);
      var out = [];
      var entries = [];
      zip.forEach(function (path, entry) { if (!entry.dir && WANT.test(path) && !/(^|\/)(__MACOSX|\._)/.test(path)) entries.push(entry); });
      for (var i = 0; i < entries.length; i++) out.push({ name: entries[i].name, text: await entries[i].async('string') });
      if (!out.length) throw new Error('That zip has no Tinder or Hinge activity file inside. Tinder\u2019s zip has data.json; Hinge\u2019s has matches.json or match_likes.csv.');
      return out;
    }
    if (file.size > 400 * 1024 * 1024) throw new Error('That file is too big to be a dating-app export.');
    return [{ name: name, text: await file.text() }];
  }

  async function handleFiles(list) {
    list = [].slice.call(list || []);
    if (!list.length) return;
    say('Reading your export on this device\u2026');
    try {
      var all = [];
      for (var i = 0; i < list.length; i++) all = all.concat(await readOne(list[i]));
      await new Promise(function (res) { setTimeout(res, 20); });
      var parsed = P.parseFiles(all);
      all = null; // drop the raw text; only counts are kept
      // A new export of the same app replaces the old one; a different app is added alongside.
      var apps = parsed.sources.map(function (s) { return s.app; });
      var kept = state.sources.filter(function (s) { return apps.indexOf(s.app) < 0 && !state.sample; });
      state.sample = false;
      load(kept.concat(parsed.sources), false);
    } catch (e) {
      say(e.message || 'Something went wrong reading that file.', true);
    }
  }

  function yearOptions() {
    var ys = P.years(state.sources.filter(function (s) { return state.app === 'all' || s.app === state.app; }));
    if (!ys.some(function (y) { return y.year === CURRENT; })) ys.push({ year: CURRENT, active: 0 });
    ys.sort(function (a, b) { return b.year - a.year; });
    yearSel.innerHTML = ys.map(function (y) { return '<option value="' + y.year + '">' + y.year + ' (' + y.active + (y.active === 1 ? ' day' : ' days') + ' active)</option>'; }).join('') + '<option value="all">All time</option>';
    return ys;
  }
  function pickYear() {
    var ys = yearOptions();
    var cur = ys.filter(function (y) { return y.year === CURRENT; })[0];
    var latest = ys.filter(function (y) { return y.active > 0; })[0];
    state.year = cur && cur.active ? CURRENT : latest ? latest.year : CURRENT;
    yearSel.value = String(state.year);
  }

  function load(sources, isSample) {
    state.sources = sources;
    state.sample = !!isSample;
    var apps = sources.map(function (s) { return s.app; }).filter(function (a, i, arr) { return arr.indexOf(a) === i; });
    $('#app-wrap').hidden = apps.length < 2;
    state.app = 'all';
    appSel.value = 'all';
    pickYear();
    if (!isSample) {
      var names = apps.map(function (a) { return APPNAME[a]; }).join(' and ');
      var msg = 'Read your ' + names + ' export on this device. Nothing was uploaded. When you\u2019re done, you can delete the export file.';
      if (state.year !== CURRENT) msg += ' No activity in ' + CURRENT + ' yet, so we\u2019re showing ' + state.year + '.';
      say(msg);
      $('#after').hidden = false;
      $('#other-app').textContent = apps.length < 2 ? 'Add your ' + (apps[0] === 'tinder' ? 'Hinge' : 'Tinder') + ' export too' : 'Replace an export';
    }
    render();
    deckWrap.hidden = false;
    deckWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- rendering ----------
  function cardTitle(name) {
    name = (name || '').trim();
    var who = name ? name + (/s$/i.test(name) ? '\u2019' : '\u2019s') : 'My';
    return state.year == null ? who + ' dating life, wrapped' : who + ' ' + state.year + ' in dating';
  }

  function render() {
    var stats = S.compute(state.sources, { year: state.year, app: state.app, today: TODAY });
    state.stats = stats;
    var info = { title: cardTitle($('#name-input').value), year: state.year, periodShort: state.year == null ? 'All time' : String(state.year), safe: state.safe };
    deck.innerHTML = ''; state.canvases = []; state.cards = [];
    if (!stats.anything) {
      empty.hidden = false;
      empty.textContent = 'No activity ' + (state.year == null ? 'in this export' : 'in ' + state.year) + ' yet. Pick another year above.';
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
    $('#deck-count').textContent = cards.length + ' cards' + (state.safe ? ' \u00b7 safe share on' : '');
  }

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function fileName(i) { return 'dating-wrapped-' + (state.year || 'all-time') + '-' + String(i + 1).padStart(2, '0') + '-' + slug(state.cards[i].label) + '.png'; }
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
      try { await navigator.share({ files: files, title: 'Dating Wrapped', text: shareText() }); return true; }
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
      download(await zip.generateAsync({ type: 'blob' }), 'dating-wrapped-' + (state.year || 'all-time') + '.zip');
    } finally { btn.disabled = false; btn.textContent = t; }
  }
  async function shareAll() {
    var files = [];
    for (var i = 0; i < state.canvases.length; i++) files.push(new File([await blobOf(i)], fileName(i), { type: 'image/png' }));
    if (!(await shareFiles(files))) zipAll();
  }

  // ---------- wiring ----------
  fileInput.addEventListener('change', function () { handleFiles(fileInput.files); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { handleFiles(e.dataTransfer && e.dataTransfer.files); });
  function showSample() {
    var json = window.DatingDemo.tinderJson({ year: CURRENT, endMonth: NOW.getMonth() + 1, endDay: Math.max(1, NOW.getDate() - 1) });
    var parsed = P.parseFiles([{ name: 'data.json', text: JSON.stringify(json) }]);
    load(parsed.sources, true);
    $('#after').hidden = true;
    say('Showing a made-up sample (every number is invented). Upload your own export to make yours.');
  }
  $('#sample').addEventListener('click', showSample);
  $('#peek').addEventListener('click', showSample);
  $('#other-app').addEventListener('click', function () { fileInput.click(); });

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
  ps.addEventListener('click', function () { navigator.share({ title: 'Dating Wrapped', text: SHARE_LEAD, url: SHARE_URL }).catch(function () {}); });

  yearSel.addEventListener('change', function () { state.year = yearSel.value === 'all' ? null : +yearSel.value; render(); });
  appSel.addEventListener('change', function () {
    state.app = appSel.value;
    var keep = yearSel.value; yearOptions();
    if ([].some.call(yearSel.options, function (o) { return o.value === keep; })) yearSel.value = keep; else pickYear();
    state.year = yearSel.value === 'all' ? null : +yearSel.value;
    render();
  });
  safeBox.checked = true;
  safeBox.addEventListener('change', function () { state.safe = safeBox.checked; render(); });
  var tt; $('#name-input').addEventListener('input', function () { clearTimeout(tt); tt = setTimeout(render, 250); });
  $('#zip-all').addEventListener('click', zipAll);
  var sa = $('#share-all');
  if (!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }))) sa.hidden = true;
  sa.addEventListener('click', shareAll);
  $('#reset').addEventListener('click', function () {
    state = { sources: [], stats: null, cards: [], canvases: [], year: null, app: 'all', safe: safeBox.checked };
    deck.innerHTML = ''; empty.hidden = true; deckWrap.hidden = true; $('#after').hidden = true; fileInput.value = '';
    say('Cleared. Nothing was saved anywhere.');
    $('#top').scrollIntoView({ behavior: 'smooth' });
  });

  // ---------- email signup (sends only the email address; never any dating data) ----------
  (function () {
    var KIT_KEY = '9OgTfHEbtX6FB0NWVjkgyg'; var TAG = '25914072';
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
        f.innerHTML = "<b>You're on the list.</b> We'll email you once, when it's time to make next year's.";
        msg.textContent = '';
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Remind me';
        msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
      }
    });
  })();

  Object.defineProperty(window, '__datingState', { get: function () { return state; } });
})();
