/* Couples Chat Wrapped: page controller. Everything happens in this tab; the chat is never sent anywhere. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var S = window.CouplesStats, C = window.CouplesCards;

  var state = { parsed: null, people: null, stats: null, cards: [], canvases: [], period: 'all', mode: 'initials' };
  var pool = []; // canvases are reused across re-renders (iOS Safari caps total canvas memory)

  var fileInput = $('#file'), drop = $('#drop'), status = $('#status');
  var deckWrap = $('#results'), deck = $('#deck'), periodSel = $('#period'), groupBox = $('#group-msg');

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

  // ---------- share links: ?ref= passthrough (URL only, nothing stored), same scheme as ../wrapped/ ----------
  var APP_URL = 'https://lanternlab2027.github.io/lab/couples/';
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
  var SHARE_LINE = 'Our year in texts \u{1F48C} Make yours (free, your chat never leaves your phone):';
  function shareText() { return SHARE_LINE + ' ' + SHARE_URL; }
  // Keep the in-page links to the sibling app carrying the ref too.
  document.querySelectorAll('a[data-ref]').forEach(function (a) {
    try { var q = new URLSearchParams(location.search).get('ref'); if (q) a.href = a.getAttribute('href').split('?')[0] + '?ref=' + encodeURIComponent(q.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)); } catch (e) { /* keep plain link */ }
  });

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
    groupBox.hidden = true;
    say('Reading your chat on this device\u2026' + (file.size > 8e6 ? ' Big chat: this can take up to a minute on a phone. Keep this tab open.' : ''));
    try {
      var r = await readFile(file);
      await new Promise(function (res) { setTimeout(res, 20); });
      load(S.parseExport(r.text, r.filename));
    } catch (e) {
      say(e.message || 'Something went wrong reading that file.', true);
    }
  }

  function load(parsed, sampleNote) {
    var c = S.classify(parsed.messages, parsed);
    if (!c.ok) {
      deckWrap.hidden = true; deck.innerHTML = '';
      state.parsed = null;
      if (c.reason === 'group') {
        say('');
        $('#group-count').textContent = c.people.length;
        groupBox.hidden = false;
        groupBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        say('That chat only has messages from one person. Couples Chat Wrapped needs a 1:1 chat with both of you in it.', true);
      }
      return;
    }
    groupBox.hidden = true;
    state.parsed = parsed; state.people = c.people;
    var ps = S.periods(parsed.messages.filter(function (m) { return c.people.indexOf(m.sender) >= 0; }));
    periodSel.innerHTML = '';
    ps.forEach(function (p) { var o = document.createElement('option'); o.value = p.id; o.textContent = p.label; periodSel.appendChild(o); });
    state.period = ps[0].id;
    periodSel.value = state.period;
    $('#nick-a-label').textContent = 'Nickname for ' + initials(c.people)[c.people[0]];
    $('#nick-b-label').textContent = 'Nickname for ' + initials(c.people)[c.people[1]];
    say(sampleNote || ('Found ' + parsed.messages.length.toLocaleString('en-US') + ' messages between two people. Nothing was uploaded.'));
    render();
    deckWrap.hidden = false;
    deckWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- names ----------
  function hasLetters(n) { return /\p{L}/u.test(n); }
  function initials(names) {
    function ini(n, k) {
      if (!hasLetters(n)) return null;
      var toks = n.split(/\s+/).filter(hasLetters);
      if (k === 0) return toks.slice(0, 2).map(function (t) { return Array.from(t.replace(/[^\p{L}]/gu, ''))[0] || ''; }).join('.').toUpperCase() + '.';
      var first = Array.from(toks[0].replace(/[^\p{L}]/gu, ''));
      return first.slice(0, 2).join('').replace(/^./, function (c) { return c.toUpperCase(); }) + '.';
    }
    var a = ini(names[0], 0) || 'You', b = ini(names[1], 0) || 'Them';
    if (a === b) { a = ini(names[0], 1) || a; b = ini(names[1], 1) || b; }
    if (a === b) { a = a + ' 1'; b = b + ' 2'; }
    var o = {}; o[names[0]] = a; o[names[1]] = b; return o;
  }
  function firstNames(names) {
    var ini = initials(names);
    function fn(n) { return hasLetters(n) ? n.split(/\s+/).filter(Boolean)[0].replace(/^~/, '') : null; }
    var a = fn(names[0]) || ini[names[0]], b = fn(names[1]) || ini[names[1]];
    if (a === b) { a = names[0]; b = names[1]; }
    var o = {}; o[names[0]] = a; o[names[1]] = b; return o;
  }
  function nameMapper() {
    var names = state.people, map;
    if (state.mode === 'first') map = firstNames(names);
    else {
      map = initials(names);
      if (state.mode === 'nick') {
        var na = ($('#nick-a').value || '').trim().slice(0, 24), nb = ($('#nick-b').value || '').trim().slice(0, 24);
        if (na) map[names[0]] = na;
        if (nb) map[names[1]] = nb;
      }
    }
    return function (n) { return map[n] || n; };
  }

  // ---------- rendering ----------
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function render() {
    var st = S.compute(state.parsed.messages, state.people, { period: state.period });
    state.stats = st;
    var name = nameMapper();
    var f = st.first, l = st.last;
    var range = f ? (MONTHS[f.mo - 1] + ' ' + f.y + (f.y === l.y && f.mo === l.mo ? '' : ' \u2013 ' + MONTHS[l.mo - 1] + ' ' + l.y)) : '';
    var msgs = state.parsed.messages.filter(function (m) { return state.people.indexOf(m.sender) >= 0; });
    var fl = msgs[msgs.length - 1];
    var info = {
      pair: name(state.people[0]) + ' & ' + name(state.people[1]),
      name: name,
      year: /^\d{4}$/.test(state.period) ? +state.period : null,
      last12: state.period === 'last12',
      periodShort: state.period === 'last12' ? 'LAST 12 MONTHS' : state.period === 'all' ? 'ALL TIME' : state.period,
      periodLong: range + ' \u00b7 ' + st.spanDays.toLocaleString('en-US') + (st.spanDays === 1 ? ' day' : ' days'),
      fileFirst: st.fileFirst, fileLast: fl && { y: fl.y, mo: fl.mo, d: fl.d }
    };
    var cards = C.build(st, info);
    state.cards = cards; state.canvases = [];
    deck.innerHTML = '';
    cards.forEach(function (card, i) {
      var fig = document.createElement('figure');
      fig.className = 'card';
      var cv = pool[i] || (pool[i] = document.createElement('canvas'));
      cv.width = C.W; cv.height = C.H;
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', 'Card ' + (i + 1) + ': ' + card.label);
      C.render(cv, card, st, info, i + 1, cards.length);
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
  function fileName(i) { return 'our-year-in-texts-' + String(i + 1).padStart(2, '0') + '-' + slug(state.cards[i].label) + '.png'; }
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
      try { await navigator.share({ files: files, title: 'Couples Chat Wrapped', text: shareText() }); return true; }
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
      download(await zip.generateAsync({ type: 'blob' }), 'our-year-in-texts.zip');
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
    load(S.parseExport(window.CouplesDemo.whatsappText(14), 'WhatsApp Chat - Rowan Diaz.zip'), 'Showing a made-up sample couple. Upload your own export to make yours.');
  }
  $('#sample').addEventListener('click', showSample);
  $('#peek').addEventListener('click', showSample);

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
  ps.addEventListener('click', function () { navigator.share({ title: 'Couples Chat Wrapped', text: SHARE_LINE, url: SHARE_URL }).catch(function () {}); });

  periodSel.addEventListener('change', function () { state.period = periodSel.value; render(); });
  document.querySelectorAll('input[name="names"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      state.mode = r.value;
      $('#nicks').hidden = state.mode !== 'nick';
      if (state.parsed) render();
    });
  });
  var tt;
  ['#nick-a', '#nick-b'].forEach(function (s) { $(s).addEventListener('input', function () { clearTimeout(tt); tt = setTimeout(function () { if (state.parsed) render(); }, 250); }); });
  $('#zip-all').addEventListener('click', zipAll);
  var sa = $('#share-all');
  if (!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }))) sa.hidden = true;
  sa.addEventListener('click', shareAll);
  $('#reset').addEventListener('click', function () {
    state = { parsed: null, people: null, stats: null, cards: [], canvases: [], period: 'all', mode: state.mode };
    deck.innerHTML = ''; deckWrap.hidden = true; fileInput.value = ''; say('Cleared. Nothing was saved anywhere.');
    $('#top').scrollIntoView({ behavior: 'smooth' });
  });

  if (/Instagram|FBAN|FBAV|FB_IAB|musical_ly|TikTok|BytedanceWebview|Snapchat|LinkedInApp/i.test(navigator.userAgent || '') && !status.textContent) {
    say('Opened inside an app? If saving the cards doesn\u2019t work here, open this page in Safari or Chrome (\u22ef menu \u2192 Open in browser).');
  }

  Object.defineProperty(window, '__couplesState', { get: function () { return state; } });
})();
