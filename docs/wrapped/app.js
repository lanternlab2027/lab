/* Group Chat Wrapped: page controller. Everything happens in this tab; the chat is never sent anywhere. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var P = window.WrappedParser, S = window.WrappedStats, C = window.WrappedCards;

  var state = { parsed: null, stats: null, cards: [], canvases: [], year: null, mode: 'full', title: null };
  // Reused across re-renders: iOS Safari caps total canvas memory, so never allocate a fresh set per toggle.
  var pool = [];

  var fileInput = $('#file'), drop = $('#drop'), status = $('#status');
  var deckWrap = $('#results'), deck = $('#deck');
  var periodSel = $('#period');

  function say(msg, isError) {
    status.textContent = msg || '';
    status.className = 'status' + (isError ? ' err' : '');
    if (isError) {
      var help = document.createElement('a'); help.href = '#export'; help.textContent = 'How to export your chat';
      var demo = document.createElement('button'); demo.type = 'button'; demo.className = 'linkbtn'; demo.textContent = 'see a sample deck';
      demo.addEventListener('click', showSample);
      status.appendChild(document.createTextNode(' ')); status.appendChild(help);
      status.appendChild(document.createTextNode(' or ')); status.appendChild(demo); status.appendChild(document.createTextNode('.'));
    }
  }

  // ---------- share links: ?ref= passthrough (URL only, nothing stored) ----------
  // Opened with ?ref=X -> links this visitor shares carry ?ref=share-X (then share2-X, share3-X...),
  // so a later analytics pass can follow the chain. No ref -> ?ref=share.
  var APP_URL = 'https://lanternlab2027.github.io/lab/wrapped/';
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
  function shareText() { return 'Our group chat, Wrapped. Make one for your group (free, the chat never leaves your phone): ' + SHARE_URL; }

  // ---------- reading files ----------
  async function readFile(file) {
    var name = file.name || 'chat.txt';
    if (/\.zip$/i.test(name) || /zip/.test(file.type)) {
      if (!window.JSZip) throw new Error('Zip support failed to load. Unzip the file and upload the .txt inside.');
      var zip = await window.JSZip.loadAsync(file);
      var entries = [];
      zip.forEach(function (path, entry) { if (!entry.dir && /\.(txt|json)$/i.test(path) && !/(^|\/)(__MACOSX|\.)/.test(path)) entries.push(entry); });
      if (!entries.length) throw new Error('That zip has no chat .txt file inside. In WhatsApp choose Export chat \u2192 Without media.');
      entries.sort(function (a, b) {
        var sa = /(^|\/)_chat\.txt$|whatsapp chat/i.test(a.name) ? 1 : 0, sb = /(^|\/)_chat\.txt$|whatsapp chat/i.test(b.name) ? 1 : 0;
        return sb - sa || (b._data && a._data ? b._data.uncompressedSize - a._data.uncompressedSize : 0);
      });
      var text = await entries[0].async('string');
      var inner = entries[0].name.replace(/^.*\//, '');
      return { text: text, filename: /^_chat\.txt$/i.test(inner) ? name : inner };
    }
    return { text: await file.text(), filename: name };
  }

  async function handleFile(file) {
    if (!file) return;
    say('Reading your chat on this device\u2026' + (file.size > 8e6 ? ' Big chat: this can take up to a minute on a phone. Keep this tab open.' : ''));
    try {
      var r = await readFile(file);
      await new Promise(function (res) { setTimeout(res, 20); });
      load(P.parseAny(r.text, r.filename));
    } catch (e) {
      say(e.message || 'Something went wrong reading that file.', true);
    }
  }

  function load(parsed) {
    state.parsed = parsed;
    state.title = parsed.title || 'Our group chat';
    $('#title-input').value = state.title;
    var ys = S.years(parsed.messages);
    periodSel.innerHTML = '<option value="">All time</option>' + ys.map(function (y) { return '<option value="' + y.year + '">' + y.year + ' (' + y.count.toLocaleString('en-US') + ' messages)</option>'; }).join('');
    var latest = ys[ys.length - 1];
    state.year = ys.length > 1 && latest.count >= 100 ? latest.year : null;
    periodSel.value = state.year ? String(state.year) : '';
    var nPeople = new Set(parsed.messages.map(function (m) { return m.sender; })).size;
    say('Found ' + parsed.messages.length.toLocaleString('en-US') + (parsed.messages.length === 1 ? ' message' : ' messages') + ' from ' + nPeople + (nPeople === 1 ? ' person' : ' people') + '. Nothing was uploaded.');
    render();
    deckWrap.hidden = false;
    deckWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- names ----------
  function nameMapper(names, mode) {
    if (mode === 'full') return function (n) { return n; };
    var hasLetters = function (n) { return /\p{L}/u.test(n); };
    var base = {}, counts = {};
    names.forEach(function (n, i) {
      var b;
      var toks = n.split(/\s+/).filter(Boolean);
      if (!hasLetters(n)) {
        var digits = n.replace(/\D/g, '');
        b = mode === 'first' ? '\u2026' + digits.slice(-4) : 'Member ' + (i + 1);
      } else if (mode === 'first') {
        b = toks[0];
      } else {
        b = toks.filter(hasLetters).slice(0, 2).map(function (t) { return Array.from(t.replace(/[^\p{L}]/gu, ''))[0] || ''; }).join('.').toUpperCase() + '.';
      }
      base[n] = b; counts[b] = (counts[b] || 0) + 1;
    });
    var map = {}, seen = {};
    names.forEach(function (n) {
      var b = base[n];
      if (counts[b] > 1) {
        var toks = n.split(/\s+/);
        if (mode === 'first' && toks.length > 1) { var alt = toks[0] + ' ' + Array.from(toks[toks.length - 1])[0] + '.'; if (!seen[alt]) { seen[alt] = 1; map[n] = alt; return; } }
        seen[b] = (seen[b] || 0) + 1; map[n] = b + ' ' + seen[b];
      } else map[n] = b;
    });
    return function (n) { return map[n] || n; };
  }

  // ---------- rendering ----------
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function render() {
    var stats = S.compute(state.parsed.messages, { year: state.year });
    state.stats = stats;
    var names = stats.members.map(function (m) { return m.name; });
    var title = ($('#title-input').value || '').trim() || 'Our group chat';
    var f = stats.first, l = stats.last;
    var range = f ? (MONTHS[f.mo - 1] + ' ' + f.y + (f.y === l.y && f.mo === l.mo ? '' : ' \u2013 ' + MONTHS[l.mo - 1] + ' ' + l.y)) : '';
    var info = {
      title: title,
      year: state.year,
      periodShort: state.year ? String(state.year) : 'ALL TIME',
      periodLong: range + ' \u00b7 ' + stats.spanDays.toLocaleString('en-US') + (stats.spanDays === 1 ? ' day' : ' days'),
      name: nameMapper(names, state.mode)
    };
    var cards = C.build(stats, info);
    state.cards = cards; state.canvases = [];
    deck.innerHTML = '';
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
  function fileName(i) { return 'wrapped-' + String(i + 1).padStart(2, '0') + '-' + slug(state.cards[i].label) + '.png'; }
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
      try { await navigator.share({ files: files, title: 'Group Chat Wrapped', text: shareText() }); return true; }
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
      download(await zip.generateAsync({ type: 'blob' }), 'group-chat-wrapped.zip');
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
    var parsed = P.parseAny(window.WrappedDemo.whatsappText(7), 'WhatsApp Chat with Weekend Crew.txt');
    load(parsed);
    say('Showing a made-up sample chat. Upload your own export to make yours.');
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
    navigator.share({ title: 'Group Chat Wrapped', text: 'Our group chat, Wrapped. Make one for your group (free, the chat never leaves your phone):', url: SHARE_URL }).catch(function () {});
  });
  periodSel.addEventListener('change', function () { state.year = periodSel.value ? +periodSel.value : null; render(); });
  document.querySelectorAll('input[name="names"]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) { state.mode = r.value; render(); } });
  });
  var tt; $('#title-input').addEventListener('input', function () { clearTimeout(tt); tt = setTimeout(render, 250); });
  $('#zip-all').addEventListener('click', zipAll);
  var sa = $('#share-all');
  if (!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }))) sa.hidden = true;
  sa.addEventListener('click', shareAll);
  $('#reset').addEventListener('click', function () {
    state = { parsed: null, stats: null, cards: [], canvases: [], year: null, mode: state.mode, title: null };
    deck.innerHTML = ''; deckWrap.hidden = true; fileInput.value = ''; say('Cleared. Nothing was saved anywhere.');
    $('#top').scrollIntoView({ behavior: 'smooth' });
  });

  // ---------- email signup (sends only the email address; never chat data) ----------
  (function () {
    var KIT_KEY = '9OgTfHEbtX6FB0NWVjkgyg'; var TAG = '25875149';
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
        f.innerHTML = "<b>You're in.</b> We'll email you when new card packs drop.";
        msg.textContent = '';
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Notify me';
        msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
      }
    });
  })();

  // In-app browsers (Instagram, TikTok, Facebook, Snapchat...) often block downloads and the share sheet.
  if (/Instagram|FBAN|FBAV|FB_IAB|musical_ly|TikTok|BytedanceWebview|Snapchat|LinkedInApp/i.test(navigator.userAgent || '') && !status.textContent) {
    say('Opened inside an app? If saving the cards doesn\u2019t work here, open this page in Safari or Chrome (\u22ef menu \u2192 Open in browser).');
  }

  Object.defineProperty(window, '__wrappedState', { get: function () { return state; } });
})();
