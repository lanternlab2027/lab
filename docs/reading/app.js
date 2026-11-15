/* Reading Wrapped: page controller. Everything happens in this tab; the library is never sent anywhere. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var P = window.ReadingParser, S = window.ReadingStats, C = window.ReadingCards;

  var state = { parsed: null, stats: null, cards: [], canvases: [], year: null, undated: false };
  // Reused across re-renders: iOS Safari caps total canvas memory, so never allocate a fresh set per change.
  var pool = [];

  var fileInput = $('#file'), drop = $('#drop'), status = $('#status');
  var deckWrap = $('#results'), deck = $('#deck'), yearSel = $('#year'), empty = $('#empty');
  var CURRENT = new Date().getFullYear();

  function say(msg, isError) {
    status.textContent = msg || '';
    status.className = 'status' + (isError ? ' err' : '');
    if (isError) {
      var help = document.createElement('a'); help.href = '#export'; help.textContent = 'How to export your library';
      var demo = document.createElement('button'); demo.type = 'button'; demo.className = 'linkbtn'; demo.textContent = 'see a sample deck';
      demo.addEventListener('click', showSample);
      status.appendChild(document.createTextNode(' ')); status.appendChild(help);
      status.appendChild(document.createTextNode(' or ')); status.appendChild(demo); status.appendChild(document.createTextNode('.'));
    }
  }

  // ---------- share links: ?ref= passthrough (URL only, nothing stored) ----------
  // Opened with ?ref=X -> links this visitor shares carry ?ref=share-X (then share2-X, share3-X...),
  // so a later analytics pass can follow the chain. No ref -> ?ref=share.
  var APP_URL = 'https://lanternlab2027.github.io/lab/reading/';
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
  var SHARE_LEAD = 'My year in books, Wrapped. Make yours from your Goodreads, StoryGraph or Libby export (free, nothing uploaded):';
  function shareText() { return SHARE_LEAD + ' ' + SHARE_URL; }

  // ---------- reading files ----------
  async function readFile(file) {
    var name = file.name || 'library.csv';
    if (/\.zip$/i.test(name) || /zip/.test(file.type)) {
      if (!window.JSZip) throw new Error('Zip support failed to load. Unzip the file and upload the .csv inside.');
      var zip = await window.JSZip.loadAsync(file);
      var entries = [];
      zip.forEach(function (path, entry) { if (!entry.dir && /\.(csv|json)$/i.test(path) && !/(^|\/)(__MACOSX|\.)/.test(path)) entries.push(entry); });
      if (!entries.length) throw new Error('That zip has no .csv or .json file inside. Upload the file from your Goodreads, StoryGraph or Libby export.');
      var pref = /goodreads|storygraph|libbytimeline|library/i;
      entries.sort(function (a, b) { return (pref.test(b.name) ? 1 : 0) - (pref.test(a.name) ? 1 : 0); });
      return { text: await entries[0].async('string'), filename: entries[0].name };
    }
    if (file.size > 60 * 1024 * 1024) throw new Error('That file is too big to be a library export.');
    return { text: await file.text(), filename: name };
  }

  async function handleFile(file) {
    if (!file) return;
    say('Reading your library on this device\u2026');
    try {
      var r = await readFile(file);
      await new Promise(function (res) { setTimeout(res, 20); });
      load(P.parseAny(r.text, r.filename));
    } catch (e) {
      say(e.message || 'Something went wrong reading that file.', true);
    }
  }

  function yearOptions() {
    var ys = S.years(state.parsed.books, state.undated);
    var have = {}; ys.forEach(function (y) { have[y.year] = y.count; });
    if (!(CURRENT in have)) ys.push({ year: CURRENT, count: 0 });
    ys.sort(function (a, b) { return b.year - a.year; });
    yearSel.innerHTML = ys.map(function (y) { return '<option value="' + y.year + '">' + y.year + ' (' + y.count.toLocaleString('en-US') + (y.count === 1 ? ' book' : ' books') + ')</option>'; }).join('') + '<option value="all">All time</option>';
    return ys;
  }

  function load(parsed) {
    state.parsed = parsed; state.undated = false;
    $('#undated').checked = false;
    var undatedN = parsed.books.filter(function (b) { return b.shelf === 'read' && !b.reads.length; }).length;
    $('#undated-wrap').hidden = !undatedN;
    $('#undated-label').textContent = parsed.source === 'libby'
      ? 'Also count ' + undatedN + (undatedN === 1 ? ' loan' : ' loans') + ' that ended without a "Returned" entry (the loan ran out, or your export only lists borrows), dated by when ' + (undatedN === 1 ? 'it' : 'they') + ' ended'
      : 'Count ' + undatedN + (undatedN === 1 ? ' book' : ' books') + ' marked read without a finish date, using the date you added ' + (undatedN === 1 ? 'it' : 'them');
    var ys = yearOptions();
    var cur = ys.filter(function (y) { return y.year === CURRENT; })[0];
    var latest = ys.filter(function (y) { return y.count > 0; })[0];
    state.year = cur && cur.count ? CURRENT : latest ? latest.year : CURRENT;
    yearSel.value = String(state.year);
    var srcName = parsed.source === 'storygraph' ? 'StoryGraph' : parsed.source === 'libby' ? 'Libby' : 'Goodreads';
    var readN = parsed.books.filter(function (b) { return b.shelf === 'read' && (parsed.source !== 'libby' || b.reads.length); }).length;
    var msg = 'Found ' + parsed.books.length.toLocaleString('en-US') + ' books in your ' + srcName + ' library (' + readN.toLocaleString('en-US') + ' read). Nothing was uploaded.';
    if (parsed.source === 'libby') {
      var loanN = parsed.books.reduce(function (a, b) { return a + (b.loans ? b.loans.length : 0); }, 0);
      msg = 'Found ' + loanN.toLocaleString('en-US') + (loanN === 1 ? ' loan' : ' loans') + ' of ' + parsed.books.length.toLocaleString('en-US') + ' titles in your Libby timeline (' + readN.toLocaleString('en-US') + ' returned, so counted as read). Nothing was uploaded.';
    }
    if (state.year !== CURRENT) msg += ' No finished books in ' + CURRENT + ' yet, so we\u2019re showing ' + state.year + '.';
    say(msg);
    render();
    deckWrap.hidden = false;
    deckWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- rendering ----------
  function cardTitle(name) {
    name = (name || '').trim();
    var who = name ? name + (/s$/i.test(name) ? '\u2019' : '\u2019s') : 'My';
    return state.year == null ? who + ' reading life' : who + ' ' + state.year + ' in books';
  }

  function render() {
    var stats = S.compute(state.parsed.books, { year: state.year, undated: state.undated, source: state.parsed.source });
    state.stats = stats;
    var info = { title: cardTitle($('#name-input').value), year: state.year, periodShort: state.year == null ? 'All time' : String(state.year) };
    deck.innerHTML = ''; state.canvases = []; state.cards = [];
    if (!stats.count) {
      empty.hidden = false;
      empty.textContent = 'No finished books ' + (state.year == null ? 'in this export' : 'in ' + state.year) + ' yet. Pick another year above' + (state.parsed.books.some(function (b) { return b.shelf === 'read' && !b.reads.length; }) ? ', or tick the box to count read books without a finish date.' : '.');
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
  function fileName(i) { return 'reading-wrapped-' + (state.year || 'all-time') + '-' + String(i + 1).padStart(2, '0') + '-' + slug(state.cards[i].label) + '.png'; }
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
      try { await navigator.share({ files: files, title: 'Reading Wrapped', text: shareText() }); return true; }
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
      download(await zip.generateAsync({ type: 'blob' }), 'reading-wrapped-' + (state.year || 'all-time') + '.zip');
    } finally { btn.disabled = false; btn.textContent = t; }
  }

  async function shareAll() {
    var files = [];
    for (var i = 0; i < state.canvases.length; i++) files.push(new File([await blobOf(i)], fileName(i), { type: 'image/png' }));
    if (!(await shareFiles(files))) zipAll();
  }

  // ---------- wiring ----------
  fileInput.addEventListener('change', function () { handleFile(fileInput.files[0]); });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; handleFile(f); });
  function showSample() {
    load(P.parseAny(window.ReadingDemo.goodreadsCSV(), 'sample.csv'));
    say('Showing a made-up sample library. Upload your own export to make yours.');
  }
  $('#sample').addEventListener('click', showSample);
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
  ps.addEventListener('click', function () {
    navigator.share({ title: 'Reading Wrapped', text: SHARE_LEAD, url: SHARE_URL }).catch(function () {});
  });
  yearSel.addEventListener('change', function () { state.year = yearSel.value === 'all' ? null : +yearSel.value; render(); });
  $('#undated').addEventListener('change', function () {
    state.undated = $('#undated').checked;
    var keep = yearSel.value; yearOptions(); yearSel.value = keep; render();
  });
  var tt; $('#name-input').addEventListener('input', function () { clearTimeout(tt); tt = setTimeout(render, 250); });
  $('#zip-all').addEventListener('click', zipAll);
  var sa = $('#share-all');
  if (!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }))) sa.hidden = true;
  sa.addEventListener('click', shareAll);
  $('#reset').addEventListener('click', function () {
    state = { parsed: null, stats: null, cards: [], canvases: [], year: null, undated: false };
    deck.innerHTML = ''; empty.hidden = true; deckWrap.hidden = true; fileInput.value = ''; say('Cleared. Nothing was saved anywhere.');
    $('#top').scrollIntoView({ behavior: 'smooth' });
  });

  // ---------- email signup (sends only the email address; never library data) ----------
  (function () {
    var KIT_KEY = '9OgTfHEbtX6FB0NWVjkgyg'; var TAG = '25879339';
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
        f.innerHTML = "<b>You're on the list.</b> We'll email you when next year's Reading Wrapped is ready.";
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

  Object.defineProperty(window, '__readingState', { get: function () { return state; } });
})();
