/* Goal Bingo: page logic. State lives in the URL hash (#c=...) and localStorage; there is no backend. */
(function () {
  'use strict';
  var C = window.BingoCodec, R = window.BingoRender, IDEAS = window.BingoIdeas;
  var SITE = 'https://lanternlab2027.github.io/lab/bingo/';
  var KEY_CUR = 'goalbingo:v1:current', KEY_PREV = 'goalbingo:v1:prev';
  var $ = function (id) { return document.getElementById(id); };

  var state = { card: C.blank({ size: 5 }), mode: 'edit', sel: 0, cat: IDEAS[0].id, extra: [] };

  // ---------- storage (always wrapped: private mode / blocked storage must not break the page) ----------
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  function hasContent(card) { return card.goals.some(function (g) { return !!g; }) || !!card.title || card.checked.some(function (c, i) { return c && i !== (card.free ? C.centre(card.size) : -1); }); }
  function cardUrl() { return location.origin + location.pathname + '#' + C.encode(state.card); }

  var saveTimer = null;
  function persist(now) {
    clearTimeout(saveTimer);
    var run = function () {
      var h = C.encode(state.card);
      try { history.replaceState(null, '', location.pathname + location.search + '#' + h); } catch (e) { /* file:// etc */ }
      lsSet(KEY_CUR, h);
      $('card-link').value = cardUrl();
      $('email-link').href = 'mailto:?subject=' + encodeURIComponent('My 2027 goal bingo card') + '&body=' + encodeURIComponent('My bingo card (open this link to check off goals):\n' + cardUrl());
      drawThumbs();
    };
    if (now) run(); else saveTimer = setTimeout(run, 250);
  }

  // ---------- loading ----------
  function notice(msg) { var n = $('notice'); n.textContent = msg; n.hidden = !msg; }

  function stashIfDifferent(newHash) {
    var cur = lsGet(KEY_CUR);
    if (!cur || cur === newHash) return;
    var d = C.decode(cur);
    if (d.kind === 'card' && hasContent(d.card)) lsSet(KEY_PREV, cur);
  }

  function loadFromHash(fromEvent) {
    var h = location.hash.replace(/^#/, '');
    var d = C.decode(h);
    notice('');
    if (d.kind === 'card') {
      if (!fromEvent) stashIfDifferent(h);
      setCard(d.card);
      var filled = d.card.goals.every(function (g, i) { return g || i === (d.card.free ? C.centre(d.card.size) : -1); });
      setMode(filled ? 'check' : 'edit');
      persist(true);
      return true;
    }
    if (d.kind === 'group') {
      stashIfDifferent('');
      setCard(d.card);
      var b = $('group-banner');
      b.textContent = '';
      b.appendChild(document.createTextNode("You're joining "));
      var s = document.createElement('b'); s.textContent = d.card.group ? d.card.group + "'s group bingo" : 'a group bingo'; b.appendChild(s);
      b.appendChild(document.createTextNode('. Same theme, your own goals. Fill in your card below.'));
      b.hidden = false;
      setMode('edit');
      persist(true);
      return true;
    }
    if (d.error && d.error !== 'empty') notice(d.error === 'too-long' ? 'That link is too long to be a bingo card.' : d.error === 'not-a-card' ? '' : "That bingo link looks cut off (part of it was probably lost when it was copied). Try copying the whole link again." + (lsGet(KEY_CUR) ? ' Showing the card saved on this device.' : ''));
    return false;
  }

  function loadInitial() {
    if (loadFromHash(false)) return;
    var saved = lsGet(KEY_CUR);
    var d = saved ? C.decode(saved) : null;
    if (d && d.kind === 'card') { setCard(d.card); persist(true); return; }
    setCard(C.blank({ size: 5 }));
    $('card-link').value = cardUrl();
    drawThumbs();
  }

  // ---------- board ----------
  function setCard(card) {
    state.card = C.normalize(card); state.sel = firstEditable(); state.extra = [];
    buildGrid(); syncSettings(); syncEditor(); updatePrev();
  }
  function centreIdx() { return state.card.free ? C.centre(state.card.size) : -1; }
  function firstEditable() { var m = state.card.free ? C.centre(state.card.size) : -1; for (var i = 0; i < state.card.goals.length; i++) if (i !== m && !state.card.goals[i]) return i; return 0; }

  function applyTheme() {
    var t = R.THEMES[state.card.theme], b = $('board');
    var g = t.bg.length > 2 ? 'linear-gradient(160deg,' + t.bg.join(',') + ')' : 'linear-gradient(160deg,' + t.bg[0] + ',' + t.bg[1] + ')';
    var set = function (k, v) { b.style.setProperty(k, v); };
    b.style.background = g;
    set('--t-ink', t.ink); set('--t-muted', t.muted); set('--t-cell', t.cell); set('--t-cellink', t.cellInk); set('--t-line', t.line);
    set('--t-accent', t.accent); set('--t-free', t.freeBg); set('--t-freeink', t.freeInk); set('--t-onaccent', t.onAccent || '#fff');
    set('--t-head', t.head); if (t.stamp) set('--t-stamp', t.stamp); else b.style.removeProperty('--t-stamp'); set('--t-italic', t.italic ? 'italic' : 'normal');
    $('b-title').style.color = t.ink;
    var L = state.card.size === 5 ? 'BINGO' : state.card.size === 4 ? '2027' : '';
    var lt = $('b-letters'); lt.textContent = ''; lt.hidden = !L;
    L.split('').forEach(function (ch, i) { var s = document.createElement('span'); s.textContent = ch; s.style.color = t.letters[i % t.letters.length]; lt.appendChild(s); });
  }

  function buildGrid() {
    var n = state.card.size, grid = $('grid');
    $('board').style.setProperty('--n', n);
    grid.textContent = '';
    for (var r = 0; r < n; r++) {
      var row = document.createElement('div'); row.setAttribute('role', 'row'); row.style.display = 'contents';
      for (var c = 0; c < n; c++) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'sq'; b.dataset.i = r * n + c;
        b.setAttribute('role', 'gridcell');
        var tx = document.createElement('span'); tx.className = 'tx'; b.appendChild(tx);
        row.appendChild(b);
      }
      grid.appendChild(row);
    }
    applyTheme(); refreshBoard();
  }

  function fontFor(text, n) {
    var len = Array.from(text || '').length, k = len <= 12 ? 0.15 : len <= 24 ? 0.13 : len <= 40 ? 0.112 : 0.098;
    var longest = Math.max.apply(null, String(text || '').split(' ').map(function (w) { return Array.from(w).length; }).concat([1]));
    k = Math.min(k, 1.32 / longest);
    if (n === 3) k *= 0.85;
    return 'max(9px, calc(' + (92 / n * k).toFixed(2) + 'cqi))';
  }

  function refreshBoard() {
    var card = state.card, m = centreIdx(), prog = C.progress(card), inBingo = {};
    prog.lines.forEach(function (ln) { ln.forEach(function (i) { inBingo[i] = true; }); });
    var sqs = document.querySelectorAll('#grid .sq');
    sqs.forEach(function (b) {
      var i = +b.dataset.i, g = card.goals[i], free = i === m;
      b.classList.toggle('free', free);
      b.classList.toggle('empty', !g && !free);
      b.classList.toggle('on', !free && card.checked[i]);
      b.classList.toggle('bingo', !!inBingo[i] && !free);
      b.classList.toggle('sel', state.mode === 'edit' && i === state.sel);
      b.querySelector('.tx').textContent = free ? '★ ' + (g || 'FREE') : (g || (state.mode === 'edit' ? '+' : ''));
      b.style.setProperty('--fs', fontFor(free ? (g || 'FREE') : g, card.size));
      var label = free ? 'Free space' + (g ? ': ' + g : '') : (g || 'Empty square ' + (i + 1));
      if (!free && card.checked[i]) label += ', done';
      b.setAttribute('aria-label', label);
      if (state.mode === 'check' && !free) b.setAttribute('aria-pressed', card.checked[i] ? 'true' : 'false'); else b.removeAttribute('aria-pressed');
    });
    $('b-title').textContent = card.title || 'My 2027 Goal Bingo';
    $('b-name').textContent = card.name;
    $('b-name').hidden = !card.name;
    $('b-label').textContent = card.group ? card.group + ' · 2027 bingo' : '2027 Goal Bingo';
    var p = $('progress');
    p.textContent = prog.done + ' of ' + prog.total + ' done';
    if (prog.bingos) { var s = document.createElement('span'); s.className = 'bingo'; s.textContent = prog.blackout ? ' · BLACKOUT!' : ' · ' + prog.bingos + ' bingo' + (prog.bingos > 1 ? 's' : '') + '!'; p.appendChild(s); }
    return prog;
  }

  function setMode(mode) {
    state.mode = mode;
    $('mode-edit').setAttribute('aria-pressed', mode === 'edit' ? 'true' : 'false');
    $('mode-check').setAttribute('aria-pressed', mode === 'check' ? 'true' : 'false');
    $('board').classList.toggle('checking', mode === 'check');
    $('editor').hidden = mode !== 'edit';
    $('mode-hint').innerHTML = mode === 'edit' ? 'Tap a square to write a goal. Switch to <b>Check off</b> when you’ve done one.' : 'Tap a square when you finish that goal. Tap again to undo.';
    refreshBoard();
  }

  var toastTimer;
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2200); }

  $('grid').addEventListener('click', function (e) {
    var b = e.target.closest('.sq'); if (!b) return;
    var i = +b.dataset.i;
    if (state.mode === 'check') {
      if (i === centreIdx()) { toast('The free space is always done.'); return; }
      var before = C.progress(state.card).bingos;
      state.card.checked[i] = !state.card.checked[i];
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      var after = refreshBoard();
      if (after.blackout && state.card.checked[i]) toast('BLACKOUT! Every goal done. Incredible.');
      else if (after.bingos > before) toast('BINGO! \u{1F389}');
      persist();
      return;
    }
    state.sel = i; syncEditor(); refreshBoard();
    var inp = $('goal-input');
    try { inp.focus({ preventScroll: true }); } catch (err) { inp.focus(); }
    if (window.innerWidth < 900) $('editor').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  $('mode-edit').addEventListener('click', function () { setMode('edit'); });
  $('mode-check').addEventListener('click', function () { setMode('check'); });

  // ---------- editor ----------
  function syncEditor() {
    var i = state.sel, m = centreIdx(), inp = $('goal-input');
    inp.value = state.card.goals[i] || '';
    $('goal-label').textContent = i === m ? 'Free space label (optional)' : 'Square ' + (i + 1) + ' of ' + state.card.goals.length;
    inp.placeholder = i === m ? 'FREE' : 'e.g. ' + IDEAS[i % IDEAS.length].ideas[i % 5];
    $('goal-count').textContent = Array.from(inp.value).length + '/' + C.LIMITS.goal;
    markUsed();
  }
  $('goal-input').addEventListener('input', function () {
    var v = this.value.replace(/\n/g, ' ');
    state.card.goals[state.sel] = C.clean(v, C.LIMITS.goal);
    $('goal-count').textContent = Array.from(v).length + '/' + C.LIMITS.goal;
    refreshBoard(); markUsed(); persist();
  });
  $('goal-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); step(1); } });
  $('goal-input').addEventListener('blur', function () { this.value = state.card.goals[state.sel] || ''; });
  function step(d) { var n = state.card.goals.length; state.sel = (state.sel + d + n) % n; syncEditor(); refreshBoard(); }
  $('prev').addEventListener('click', function () { step(-1); });
  $('next').addEventListener('click', function () { step(1); });
  $('clear-goal').addEventListener('click', function () { state.card.goals[state.sel] = ''; state.card.checked[state.sel] = state.sel === centreIdx(); syncEditor(); refreshBoard(); persist(); });

  // ideas
  function buildCats() {
    var cats = $('cats');
    IDEAS.forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.cat = c.id;
      b.textContent = c.emoji + ' ' + c.label; b.setAttribute('aria-pressed', c.id === state.cat ? 'true' : 'false');
      cats.appendChild(b);
    });
    cats.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      state.cat = b.dataset.cat;
      cats.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      buildIdeas();
    });
    buildIdeas();
  }
  function buildIdeas() {
    var box = $('ideas'); box.textContent = '';
    IDEAS.filter(function (c) { return c.id === state.cat; })[0].ideas.forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'idea'; b.textContent = t; box.appendChild(b);
    });
    markUsed();
  }
  function markUsed() {
    var used = {}; state.card.goals.forEach(function (g) { used[g.toLowerCase()] = true; });
    document.querySelectorAll('#ideas .idea').forEach(function (b) { b.classList.toggle('used', !!used[b.textContent.toLowerCase()]); });
  }
  $('ideas').addEventListener('click', function (e) {
    var b = e.target.closest('.idea'); if (!b) return;
    var m = centreIdx(), i = state.sel;
    // fill the selected square if it's empty, otherwise the next empty one
    if (i === m || state.card.goals[i]) {
      var n = state.card.goals.length, j;
      for (j = 1; j <= n; j++) { var k = (i + j) % n; if (k !== m && !state.card.goals[k]) { i = k; break; } }
      if (j > n) { if (state.sel === m) { toast('Every square is full. Select one to replace.'); return; } i = state.sel; }
    }
    state.card.goals[i] = C.clean(b.textContent, C.LIMITS.goal);
    state.sel = i; refreshBoard(); persist();
    // move selection to the next empty square for fast tapping
    var nx = nextEmpty(i); if (nx >= 0) state.sel = nx;
    syncEditor(); refreshBoard();
  });
  function nextEmpty(from) { var n = state.card.goals.length, m = centreIdx(); for (var j = 1; j <= n; j++) { var k = (from + j) % n; if (k !== m && !state.card.goals[k]) return k; } return -1; }

  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  $('fill-empty').addEventListener('click', function () {
    var used = {}; state.card.goals.forEach(function (g) { used[g.toLowerCase()] = 1; });
    var pool = [];
    // round-robin through categories so a filled card is balanced
    var lists = IDEAS.map(function (c) { return shuffle(c.ideas.filter(function (t) { return !used[t.toLowerCase()]; })); });
    for (var r = 0; r < 20; r++) lists.forEach(function (l) { if (l[r]) pool.push(l[r]); });
    var m = centreIdx(), added = 0;
    state.card.goals.forEach(function (g, i) { if (i !== m && !g && pool.length) { state.card.goals[i] = pool.shift(); added++; } });
    refreshBoard(); syncEditor(); persist();
    toast(added ? 'Added ' + added + ' ideas. Tap any square to change it.' : 'No empty squares to fill.');
  });
  $('shuffle').addEventListener('click', function () {
    var m = centreIdx(), idx = [];
    state.card.goals.forEach(function (g, i) { if (i !== m) idx.push(i); });
    var items = shuffle(idx.map(function (i) { return [state.card.goals[i], state.card.checked[i]]; }));
    idx.forEach(function (i, k) { state.card.goals[i] = items[k][0]; state.card.checked[i] = items[k][1]; });
    refreshBoard(); syncEditor(); persist();
  });

  // ---------- settings ----------
  function syncSettings() {
    var c = state.card;
    $('title-input').value = c.title; $('name-input').value = c.name; $('group-input').value = c.group;
    document.querySelectorAll('#size-seg button').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.size === c.size ? 'true' : 'false'); });
    $('free').checked = c.free; $('free-wrap').hidden = c.size % 2 === 0;
    document.querySelectorAll('#swatches .sw').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.theme === c.theme ? 'true' : 'false'); });
  }
  function buildSwatches() {
    var box = $('swatches');
    C.THEMES.forEach(function (id) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sw sw-' + id; b.dataset.theme = id;
      var p = document.createElement('span'); p.className = 'prev'; b.appendChild(p);
      var l = document.createElement('span'); l.textContent = R.THEMES[id].name.replace(/ \(.*\)/, ''); b.appendChild(l);
      b.setAttribute('aria-label', R.THEMES[id].name + ' theme');
      box.appendChild(b);
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.sw'); if (!b) return;
      state.card.theme = b.dataset.theme; syncSettings(); applyTheme(); refreshBoard(); persist();
    });
  }
  function textSetting(id, field, max) {
    $(id).addEventListener('input', function () { state.card[field] = C.clean(this.value, max); refreshBoard(); persist(); });
  }
  textSetting('title-input', 'title', C.LIMITS.title);
  textSetting('name-input', 'name', C.LIMITS.name);
  textSetting('group-input', 'group', C.LIMITS.group);

  // Resizing keeps goals (and their checks) in reading order; goals that don't fit are kept for this session.
  function resize(size, free) {
    var old = state.card, om = old.free ? C.centre(old.size) : -1, items = [];
    old.goals.forEach(function (g, i) { if (i !== om && g) items.push([g, old.checked[i]]); });
    var freeLabel = om >= 0 ? old.goals[om] : '';
    items = items.concat(state.extra);
    var nc = C.blank({ size: size, free: free, theme: old.theme, title: old.title, name: old.name, group: old.group });
    var nm = nc.free ? C.centre(size) : -1;
    if (nm >= 0) nc.goals[nm] = freeLabel;
    for (var i = 0; i < nc.goals.length && items.length; i++) { if (i === nm) continue; var it = items.shift(); nc.goals[i] = it[0]; nc.checked[i] = it[1]; }
    state.card = C.normalize(nc); state.extra = items;
    if (items.length) toast(items.length + ' goal' + (items.length > 1 ? 's' : '') + " didn't fit. Switch back to get " + (items.length > 1 ? 'them' : 'it') + ' back.');
    state.sel = Math.min(state.sel, nc.goals.length - 1);
    buildGrid(); syncSettings(); syncEditor(); persist();
  }
  $('size-seg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || +b.dataset.size === state.card.size) return;
    var s = +b.dataset.size; resize(s, s % 2 === 1 ? (state.card.size % 2 === 1 ? state.card.free : true) : false);
  });
  $('free').addEventListener('change', function () { resize(state.card.size, this.checked); });
  $('new-card').addEventListener('click', function () {
    if (hasContent(state.card) && !window.confirm('Start a new blank card? Your current card will be kept as "your previous card" on this device.')) return;
    lsSet(KEY_PREV, C.encode(state.card));
    setCard(C.blank({ size: 5, theme: state.card.theme })); setMode('edit'); persist(true);
  });

  function updatePrev() {
    var p = lsGet(KEY_PREV), d = p ? C.decode(p) : null;
    $('prev-card').hidden = !(d && d.kind === 'card');
  }
  $('prev-card').addEventListener('click', function () {
    var p = lsGet(KEY_PREV), d = p ? C.decode(p) : null; if (!d || d.kind !== 'card') return;
    lsSet(KEY_PREV, C.encode(state.card));
    setCard(d.card); $('group-banner').hidden = true; persist(true); toast('Switched to your previous card.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ---------- links ----------
  function copy(text, okMsg) {
    var done = function () { toast(okMsg); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed. Press and hold the link to copy it.'); }
      document.body.removeChild(ta);
    }
  }
  $('copy-link').addEventListener('click', function () { persist(true); copy(cardUrl(), 'Link copied. Bookmark it or save it somewhere safe.'); });
  $('card-link').addEventListener('focus', function () { this.select(); });

  function groupUrl() {
    var c = C.normalize(state.card); c.title = '';
    return location.origin + location.pathname + '#' + C.encodeGroup(c);
  }
  $('copy-group').addEventListener('click', function () { copy(groupUrl(), 'Group link copied. It contains no goals.'); });
  $('share-group').addEventListener('click', function () {
    var text = 'Let’s do 2027 goal bingo together' + (state.card.group ? ' (' + state.card.group + ')' : '') + '. Make your card here:';
    if (navigator.share) navigator.share({ title: '2027 Goal Bingo', text: text, url: groupUrl() }).catch(function () {});
    else copy(text + ' ' + groupUrl(), 'Group invite copied. Paste it in your group chat.');
  });

  // ---------- images ----------
  var thumbTimer;
  function drawThumbs() {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(function () {
      R.draw($('thumb-letter'), state.card, 'letter');
      R.draw($('thumb-wall'), state.card, 'wallpaper');
    }, 120);
  }
  function slug() { return 'goal-bingo-2027' + (state.card.name ? '-' + state.card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : ''); }
  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function toBlob(cv, type, q) { return new Promise(function (res) { cv.toBlob(res, type, q); }); }
  function busy(btn, fn) {
    return function () {
      var label = btn.textContent; btn.disabled = true; btn.textContent = 'Making…'; $('dl-msg').textContent = '';
      setTimeout(function () {
        Promise.resolve().then(fn).catch(function () { $('dl-msg').textContent = 'Sorry, that didn’t work in this browser. Try another size.'; })
          .then(function () { btn.disabled = false; btn.textContent = label; });
      }, 30);
    };
  }
  function png(kind) {
    return toBlob(R.render(state.card, kind), 'image/png').then(function (b) { saveBlob(b, slug() + '-' + kind + '.png'); });
  }
  $('dl-letter').addEventListener('click', busy($('dl-letter'), function () { return png('letter'); }));
  $('dl-wall').addEventListener('click', busy($('dl-wall'), function () { return png('wallpaper'); }));
  $('dl-story').addEventListener('click', busy($('dl-story'), function () { return png('story'); }));
  $('dl-pdf').addEventListener('click', busy($('dl-pdf'), function () {
    var cv = R.render(state.card, 'letter');
    return toBlob(cv, 'image/jpeg', 0.92).then(function (b) { return b.arrayBuffer(); }).then(function (buf) {
      var pdf = R.pdfFromJpeg(new Uint8Array(buf), cv.width, cv.height);
      saveBlob(new Blob([pdf], { type: 'application/pdf' }), slug() + '-letter.pdf');
    });
  }));
  $('share-img').addEventListener('click', busy($('share-img'), function () {
    return toBlob(R.render(state.card, 'story'), 'image/png').then(function (blob) {
      var file = new File([blob], slug() + '.png', { type: 'image/png' });
      var data = { files: [file], title: 'My 2027 goal bingo', text: 'My 2027 goal bingo card. Make yours: ' + SITE };
      if (navigator.canShare && navigator.canShare(data)) return navigator.share(data).catch(function () {});
      saveBlob(blob, file.name); $('dl-msg').textContent = 'Saved the image. Post it with: Make yours at lanternlab2027.github.io/lab/bingo';
    });
  }));

  // ---------- email signup (sends only the email address; never the card) ----------
  (function () {
    var KIT_KEY = '9OgTfHEbtX6FB0NWVjkgyg'; var TAG = '25913904';
    var f = $('signup-form'), msg = $('signup-msg');
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = $('signup-email').value.trim();
      var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing up...';
      try {
        var r = await fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: KIT_KEY, email: email })
        });
        if (!r.ok) throw new Error('status ' + r.status);
        f.textContent = '';
        var b = document.createElement('b'); b.textContent = "You're on the list."; f.appendChild(b);
        f.appendChild(document.createTextNode(' We’ll nudge you once a month. Keep your card link bookmarked so you can check things off.'));
        msg.textContent = '';
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Remind me';
        msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
      }
    });
  })();

  window.addEventListener('hashchange', function () { if (location.hash.replace(/^#/, '') !== C.encode(state.card)) loadFromHash(true); });

  buildSwatches(); buildCats();
  loadInitial();
  setMode(state.mode);

  Object.defineProperty(window, '__bingoState', { get: function () { return state; } });
})();
