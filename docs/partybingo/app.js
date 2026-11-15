/* Watch-Party Bingo: page logic. No backend.
 *  - Host: pick/edit a square list -> the game is packed into the URL hash -> share link + QR, or print N unique cards.
 *  - Guest: opening the link deals a card from a random seed kept in localStorage, so a refresh keeps the card.
 */
(function () {
  'use strict';
  var C = window.PartyCodec, Q = window.PartyQR, R = window.PartyRender, PRESETS = window.PartyPresets;
  var KEY_DRAFT = 'partybingo:v1:draft', KEY_NAME = 'partybingo:v1:name', KEY_GAME = 'partybingo:v1:g:';
  var $ = function (id) { return document.getElementById(id); };
  var COLORS = ['#ff4f6d', '#ffb020', '#22b07d', '#3a86ff', '#9b5de5', '#2b1d3d'];

  var state = {
    view: 'host', preset: 'biggame1', previewSeed: 1,
    game: null, hash: '', id: '', seed: 0, cells: [], marks: [], time: 0, win: -1, readonly: false
  };
  window.__party = state; // for tests

  // ---------- storage (always wrapped: private mode / blocked storage must not break the page) ----------
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function lsJSON(k) { try { var v = JSON.parse(lsGet(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }

  var toastTimer;
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600); }
  function baseUrl() { return location.origin + location.pathname; }
  // ?ref= passthrough (URL only, nothing stored): opened with ?ref=X, links this visitor shares carry
  // ?ref=share-X (then share2-X, share3-X...); no ref -> ?ref=share. The ref sits in the query string,
  // before the #, so the game payload in the hash is untouched.
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
  // Links handed to other people (copy, Share, QR, check link).
  function gameUrl() { return baseUrl() + '?ref=' + encodeURIComponent(REF) + '#' + state.hash; }
  function checkUrl() { return gameUrl() + '&v=' + C.verifyParam(state.seed, state.marks, state.time); }
  // Links this visitor follows on this page: keep their own query so it is a hash change, not a reload.
  function selfUrl() { return baseUrl() + location.search + '#' + state.hash; }

  async function copyText(text, input) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      try { var el = input || document.createElement('textarea'); if (!input) { el.value = text; el.style.position = 'fixed'; el.style.opacity = '0'; document.body.appendChild(el); } el.select(); var ok = document.execCommand('copy'); if (!input) el.remove(); return ok; }
      catch (e2) { return false; }
    }
  }
  function download(blobOrUrl, name) {
    var a = document.createElement('a'), url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    if (typeof blobOrUrl !== 'string') setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'bingo'; }

  // ---------- board squares (sizing logic from 2027 Goal Bingo) ----------
  function fontFor(text, on) {
    var len = Array.from(text || '').length, k = len <= 12 ? 0.15 : len <= 24 ? 0.13 : len <= 40 ? 0.112 : 0.098;
    var longest = Math.max.apply(null, String(text || '').split(' ').map(function (w) { return Array.from(w).length; }).concat([1]));
    k = Math.min(k, 1.32 / longest);
    if (on) k *= 0.82;
    return 'max(9px, calc(' + (92 / 5 * k).toFixed(2) + 'cqi))';
  }
  function fitSquares(grid) {
    grid.querySelectorAll('.sq').forEach(function (b) {
      var tx = b.querySelector('.tx');
      b.style.setProperty('--fs', b.dataset.fs || '12px');
      if (!tx.textContent || !b.clientHeight) return;
      var cs = getComputedStyle(b), size = parseFloat(cs.fontSize), minS = 7;
      var availH = b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      tx.style.overflowWrap = 'normal';
      var fits = function () { return tx.scrollHeight <= Math.min(tx.clientHeight, availH) + 1 && tx.scrollWidth <= tx.clientWidth; };
      while (!fits() && size > minS) { size = Math.max(minS, size - 0.5); b.style.setProperty('--fs', size + 'px'); }
      tx.style.overflowWrap = '';
    });
  }
  function buildGrid(grid, cells, interactive) {
    grid.textContent = '';
    for (var r = 0; r < 5; r++) {
      var row = document.createElement('div'); row.setAttribute('role', 'row'); row.style.display = 'contents';
      for (var c = 0; c < 5; c++) {
        var i = r * 5 + c, b = document.createElement(interactive ? 'button' : 'div');
        if (interactive) b.type = 'button';
        b.className = 'sq'; b.dataset.i = i; b.setAttribute('role', 'gridcell');
        var tx = document.createElement('span'); tx.className = 'tx'; b.appendChild(tx);
        var free = cells[i] == null;
        b.classList.toggle('free', free);
        tx.textContent = free ? '★ FREE' : cells[i];
        b.dataset.fs = fontFor(free ? 'FREE' : cells[i], false);
        row.appendChild(b);
      }
      grid.appendChild(row);
    }
    fitSquares(grid);
  }
  if (window.ResizeObserver) {
    ['grid', 'pv-grid'].forEach(function (id) {
      var lastW = 0;
      new ResizeObserver(function (es) { var w = Math.round(es[0].contentRect.width); if (w !== lastW) { lastW = w; fitSquares($(id)); } }).observe($(id));
    });
  }

  // =====================================================================
  // HOST
  // =====================================================================
  function currentList() { return C.parseList($('squares').value); }
  function presetFor(id) { return C.presetById(id); }

  function renderPresets() {
    var box = $('presets'); box.textContent = '';
    PRESETS.concat([{ id: 'custom', name: 'Write my own', blurb: 'Your own squares: inside jokes welcome.' }]).forEach(function (p, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'preset'; b.dataset.preset = p.id;
      var dot = document.createElement('i'); dot.className = 'dot'; dot.style.background = COLORS[i % COLORS.length];
      var nm = document.createElement('b'); nm.textContent = p.name;
      var bl = document.createElement('span'); bl.textContent = p.blurb + (p.squares ? ' ' + p.squares.length + ' squares.' : '');
      b.append(dot, nm, bl);
      b.addEventListener('click', function () { choosePreset(p.id, true); });
      box.appendChild(b);
    });
  }
  function choosePreset(id, fill) {
    state.preset = id;
    document.querySelectorAll('#presets .preset').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.preset === id ? 'true' : 'false'); });
    var p = presetFor(id);
    if (fill) {
      if (p) { $('squares').value = p.squares.join('\n'); $('game-title').value = p.title; }
      else { $('squares').value = ''; $('game-title').value = ''; $('squares').placeholder = 'One square per line, for example:\nSomeone says "I called it"\nThe dog barks at the TV\n...'; $('squares').focus(); }
    }
    $('reset-list').hidden = !p;
    onListChange();
  }
  function onListChange() {
    var list = currentList(), n = list.length, el = $('sq-count');
    el.textContent = n + ' square' + (n === 1 ? '' : 's') + (n < 24 ? ' · add ' + (24 - n) + ' more (need 24)' : n >= 100 ? ' · that’s the maximum' : ' · ready');
    el.className = 'count ' + (n < 24 ? 'bad' : 'ok');
    $('pv-title').textContent = C.clean($('game-title').value, 48) || 'Watch-Party Bingo';
    var cells = n >= 24 ? C.deal(list, state.previewSeed) : C.deal(list.concat(Array.from({ length: 24 - n }, function (_, k) { return '…'; })).map(function (s) { return s; }), state.previewSeed);
    buildGrid($('pv-grid'), cells, false);
    $('create').disabled = n < 24;
    lsSet(KEY_DRAFT, JSON.stringify({ p: state.preset, t: $('game-title').value, s: $('squares').value }));
    // anything changed after creating means the old link is stale
    if (!$('share').hidden && state.createdFrom !== draftKey()) { $('create').textContent = 'Update the game link'; }
  }
  function draftKey() { return $('game-title').value + '\u0001' + $('squares').value; }

  async function createGame() {
    var game = C.makeGame({ title: $('game-title').value, text: $('squares').value, presetId: state.preset });
    var err = C.validate(game);
    if (err) { $('create-msg').textContent = err === 'too-few' ? 'Add at least 24 squares first.' : 'That list is too long for a link. Shorten some squares.'; return; }
    $('create-msg').textContent = '';
    state.game = game; state.hash = await C.encode(game); state.id = C.gameId(game); state.createdFrom = draftKey();
    var url = gameUrl();
    $('game-link').value = url;
    $('open-card').href = selfUrl();
    $('share-title').textContent = game.title;
    drawQR(url);
    $('share').hidden = false; $('printsec').hidden = false;
    $('create').textContent = 'Update the game link';
    $('share').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function drawQR(url) {
    try {
      var qr = Q.encode(url);
      Q.draw($('qr'), qr, Math.max(3, Math.floor(528 / (qr.size + 8))), '#2b1d3d', '#ffffff');
      $('qr').dataset.version = qr.version;
      $('qr-msg').textContent = qr.version > 15 ? 'Long custom list, so the code is dense: show it big, or share the link.' : '';
    } catch (e) { $('qr-msg').textContent = 'This list is too long for a QR code. Share the link instead.'; }
  }

  function initHost() {
    renderPresets();
    var d = lsJSON(KEY_DRAFT);
    if (d && typeof d.s === 'string' && (presetFor(d.p) || d.p === 'custom')) {
      $('squares').value = d.s; $('game-title').value = d.t || ''; choosePreset(d.p, false);
    } else choosePreset('biggame1', true);
    var t; $('squares').addEventListener('input', function () { clearTimeout(t); t = setTimeout(onListChange, 150); });
    $('game-title').addEventListener('input', onListChange);
    $('reset-list').addEventListener('click', function () { choosePreset(state.preset, true); });
    $('reshuffle').addEventListener('click', function () { state.previewSeed = C.randomSeed(); onListChange(); });
    $('create').addEventListener('click', createGame);
    $('copy-link').addEventListener('click', async function () { toast(await copyText($('game-link').value, $('game-link')) ? 'Link copied. Paste it in the group chat.' : 'Select the link and copy it.'); });
    $('share-link').addEventListener('click', function () { shareGame(); });
    $('edit-again').addEventListener('click', function () { $('squares').focus(); $('squares').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    $('dl-qr').addEventListener('click', function () { $('qr').toBlob(function (b) { if (b) download(b, slug(state.game.title) + '-qr.png'); }); });
    $('print-btn').addEventListener('click', function () { if (state.game) printCards(state.game, +$('print-n').value); });
  }

  async function shareGame() {
    var url = gameUrl(), text = 'Bingo for tonight: open this and you get your own card.';
    if (navigator.share) { try { await navigator.share({ title: state.game.title, text: text, url: url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    toast(await copyText(url) ? 'Link copied. Paste it in the group chat.' : 'Copy the link from the address bar.');
  }

  // =====================================================================
  // PRINT: N unique cards, one per page
  // =====================================================================
  function printCards(game, n) {
    n = Math.max(1, Math.min(100, Math.floor(n) || 1));
    var seeds = C.printSeeds(game, n), box = $('print');
    box.textContent = '';
    seeds.forEach(function (seed, k) {
      var cells = C.deal(game.squares, seed);
      var card = document.createElement('div'); card.className = 'pcard';
      var head = document.createElement('div'); head.className = 'ph';
      var l = document.createElement('div'); l.className = 'plbl'; l.textContent = 'Watch-Party Bingo';
      var t = document.createElement('div'); t.className = 'pttl'; t.textContent = game.title;
      var nm = document.createElement('div'); nm.className = 'pname'; nm.append('Name: '); nm.appendChild(document.createElement('span'));
      head.append(l, t, nm);
      var letters = document.createElement('div'); letters.className = 'pletters';
      'BINGO'.split('').forEach(function (ch) { var s = document.createElement('span'); s.textContent = ch; letters.appendChild(s); });
      var grid = document.createElement('div'); grid.className = 'pgrid';
      cells.forEach(function (c) {
        var d = document.createElement('div'); d.className = 'pc' + (c == null ? ' pfree' : c.length > 44 ? ' xlong' : c.length > 30 ? ' long' : '');
        if (c == null) { var st = document.createElement('div'); st.textContent = '★'; st.style.fontSize = '22pt'; d.append(st, 'FREE'); } else d.textContent = c;
        grid.appendChild(d);
      });
      var foot = document.createElement('div'); foot.className = 'pfoot';
      var a = document.createElement('span'); a.textContent = 'Card ' + (k + 1) + ' of ' + n;
      var b = document.createElement('span'); b.textContent = 'Free cards for every guest: lanternlab2027.github.io/lab/partybingo';
      foot.append(a, b);
      card.append(head, letters, grid, foot);
      box.appendChild(card);
    });
    document.body.classList.add('printing');
    state.printed = n;
    window.print();
  }
  window.addEventListener('afterprint', function () { document.body.classList.remove('printing'); });

  // =====================================================================
  // GUEST
  // =====================================================================
  function saveGuest() {
    if (state.readonly) return;
    var mask = []; state.marks.forEach(function (m, i) { if (m && i !== C.CENTRE) mask.push(i); });
    lsSet(KEY_GAME + state.id, JSON.stringify({ s: state.seed, m: mask, t: state.time || 0, w: state.win, at: Date.now() }));
  }
  function freshMarks() { var m = []; for (var i = 0; i < 25; i++) m.push(i === C.CENTRE); return m; }
  function dealFor(seed) { state.seed = seed >>> 0; state.cells = C.deal(state.game.squares, state.seed); }

  // the line that includes the winning square goes first (it's the one drawn on the picture)
  function orderedLines(prog) {
    return prog.lines.slice().sort(function (a, b) { return (b.indexOf(state.win) >= 0) - (a.indexOf(state.win) >= 0); });
  }

  function refreshBoard() {
    var prog = C.progress(state.marks), lines = orderedLines(prog), inBingo = {}, first = {};
    lines.forEach(function (ln, k) { ln.forEach(function (i) { inBingo[i] = 1; if (k === 0) first[i] = 1; }); });
    document.querySelectorAll('#grid .sq').forEach(function (b) {
      var i = +b.dataset.i, free = i === C.CENTRE, on = !free && state.marks[i];
      b.classList.toggle('on', on);
      b.classList.toggle('bingo', !!inBingo[i] && !free);
      b.classList.toggle('win', on && !!first[i]);
      b.dataset.fs = fontFor(free ? 'FREE' : state.cells[i], on);
      b.setAttribute('aria-label', free ? 'Free space' : state.cells[i] + (on ? ', marked' : ''));
      if (!free && !state.readonly) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    fitSquares($('grid'));
    var p = $('progress');
    p.textContent = prog.done + ' of 24 marked';
    if (prog.bingos) { var s = document.createElement('span'); s.className = 'bingo'; s.textContent = prog.blackout ? ' · BLACKOUT!' : ' · ' + prog.bingos + ' bingo' + (prog.bingos > 1 ? 's' : '') + '!'; p.appendChild(s); }
    var wl = $('winline');
    if (prog.bingos && state.time && state.win >= 0) {
      wl.textContent = '';
      var bb = document.createElement('b'); bb.textContent = 'BINGO';
      wl.append(bb, ' at ' + R.clock(state.time) + ' with ‘' + state.cells[state.win] + '’');
      wl.hidden = false;
    } else wl.hidden = true;
    $('share-bingo').hidden = !(prog.bingos && state.time && state.win >= 0) || state.readonly;
    return prog;
  }

  function onTap(e) {
    var b = e.target.closest('.sq'); if (!b || state.readonly) return;
    var i = +b.dataset.i;
    if (i === C.CENTRE) { toast('The free space is always marked.'); return; }
    var before = C.progress(state.marks);
    state.marks[i] = !state.marks[i];
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    var after = C.progress(state.marks);
    if (after.bingos === 0) { state.time = 0; state.win = -1; }
    else if (before.bingos === 0 && state.marks[i]) { state.time = Date.now(); state.win = i; }
    else if (state.win >= 0 && !state.marks[state.win]) { state.win = after.lines[0].filter(function (k) { return k !== C.CENTRE; }).pop(); }
    saveGuest();
    refreshBoard();
    if (state.marks[i] && after.bingos > before.bingos) {
      if (before.bingos === 0) celebrate();
      else toast(after.blackout ? 'BLACKOUT! Every square marked.' : 'Another bingo! That’s ' + after.bingos + '.');
    }
  }

  // ---------- celebration + result picture ----------
  function resultCanvas() {
    var prog = C.progress(state.marks);
    return R.draw(document.createElement('canvas'), {
      title: state.game.title, name: C.clean($('my-name').value, 30), cells: state.cells, marks: state.marks,
      lines: orderedLines(prog), winIdx: state.win, time: state.time, square: state.cells[state.win]
    });
  }
  var lastFocus = null;
  function celebrate() {
    var cv = resultCanvas();
    state.resultCanvas = cv;
    $('cel-text').textContent = R.sentence({ time: state.time, square: state.cells[state.win] });
    $('cel-img').src = cv.toDataURL('image/png');
    $('cel-msg').textContent = '';
    lastFocus = document.activeElement;
    $('celebrate').hidden = false;
    $('cel-box').focus();
    confettiBurst();
  }
  function closeCelebrate() { $('celebrate').hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function confettiBurst() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cv = $('confetti'), x = cv.getContext('2d'), W = cv.width = innerWidth, H = cv.height = innerHeight, ps = [], t0 = performance.now();
    for (var i = 0; i < 140; i++) ps.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 16 - 4, r: Math.random() * 6.3, s: 5 + Math.random() * 7, c: COLORS[i % 5] });
    cv.hidden = false;
    (function frame(now) {
      var t = now - t0; x.clearRect(0, 0, W, H);
      ps.forEach(function (p) { p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += 0.1; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s, -p.s / 3, p.s * 2, p.s / 1.5); x.restore(); });
      if (t < 2600) requestAnimationFrame(frame); else { x.clearRect(0, 0, W, H); cv.hidden = true; }
    })(t0);
  }
  function resultBlob() { return new Promise(function (res) { (state.resultCanvas || resultCanvas()).toBlob(res, 'image/png'); }); }
  function shareText() { return R.sentence({ time: state.time, square: state.cells[state.win] }) + ' (' + state.game.title + '). Check my card: ' + checkUrl(); }
  async function shareResult() {
    state.resultCanvas = resultCanvas();
    var blob = await resultBlob(), name = 'bingo-' + slug(state.game.title) + '.png';
    var file = typeof File !== 'undefined' ? new File([blob], name, { type: 'image/png' }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: shareText() }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    download(blob, name);
    var copied = await copyText(shareText());
    $('cel-msg').textContent = 'Picture downloaded.' + (copied ? ' The message and check link are copied too: paste them in the chat.' : '');
    toast('Picture downloaded');
  }

  function routeGuest(r) {
    state.view = 'guest';
    state.game = r.game; state.id = r.id;
    state.hash = location.hash.replace(/^#/, '').replace(/&v=.*$/, '');
    $('host-view').hidden = true; $('seo').hidden = true; $('guest-view').hidden = false;
    document.title = r.game.title + ' · Watch-Party Bingo';
    $('g-title').textContent = r.game.title;
    $('b-title').textContent = r.game.title;
    state.readonly = !!r.verify;
    if (r.verify) {
      dealFor(r.verify.seed); state.marks = r.verify.marks; state.time = r.verify.time; state.win = -1;
      var prog = C.progress(state.marks);
      var b = $('check-banner'); b.textContent = '';
      b.append('You’re looking at someone’s shared card: ');
      var s = document.createElement('b');
      s.textContent = prog.bingos ? 'BINGO' + (state.time ? ' at ' + R.clock(state.time) : '') + ' · ' + prog.done + ' squares marked' : prog.done + ' squares marked, no bingo yet';
      b.append(s, '. It’s rebuilt from the link, so the squares and their order are exactly what they saw.');
      b.hidden = false;
      $('me-panel').hidden = true; $('check-panel').hidden = false; $('own-card').href = selfUrl();
      $('board').classList.add('readonly'); $('b-label').textContent = 'Shared card'; $('b-foot').textContent = 'Checked from a shared link';
      $('g-hint').textContent = 'Read only.';
    } else {
      $('check-banner').hidden = true; $('me-panel').hidden = false; $('check-panel').hidden = true;
      $('board').classList.remove('readonly'); $('b-label').textContent = 'Watch-Party Bingo'; $('b-foot').textContent = 'Your card is different from everyone else’s';
      $('g-hint').textContent = 'Tap a square when it happens.';
      var saved = lsJSON(KEY_GAME + state.id);
      if (saved && typeof saved.s === 'number' && saved.s > 0) {
        dealFor(saved.s);
        state.marks = freshMarks();
        (Array.isArray(saved.m) ? saved.m : []).forEach(function (i) { if (i >= 0 && i < 25) state.marks[i] = true; });
        state.time = +saved.t || 0; state.win = typeof saved.w === 'number' ? saved.w : -1;
        if (!C.progress(state.marks).bingos || !state.marks[state.win]) { state.time = 0; state.win = -1; }
      } else {
        dealFor(C.randomSeed()); state.marks = freshMarks(); state.time = 0; state.win = -1; saveGuest();
      }
    }
    var nm = lsGet(KEY_NAME) || ''; $('my-name').value = nm; setName(nm);
    buildGrid($('grid'), state.cells, !state.readonly);
    refreshBoard();
  }
  function setName(v) { var n = C.clean(v, 30); $('b-name').textContent = n ? n + '’s card' : ''; $('b-name').hidden = !n || state.readonly; }

  function initGuest() {
    $('grid').addEventListener('click', onTap);
    $('my-name').addEventListener('input', function () { lsSet(KEY_NAME, C.clean(this.value, 30)); setName(this.value); });
    $('share-bingo').addEventListener('click', celebrate);
    $('share-game').addEventListener('click', shareGame);
    $('new-card').addEventListener('click', function () {
      var any = state.marks.some(function (m, i) { return m && i !== C.CENTRE; });
      if (any && !window.confirm('Deal a new card? Your marks on this one will be cleared.')) return;
      dealFor(C.randomSeed()); state.marks = freshMarks(); state.time = 0; state.win = -1; saveGuest();
      buildGrid($('grid'), state.cells, true); refreshBoard(); toast('New card dealt.');
    });
    $('g-print-btn').addEventListener('click', function () { printCards(state.game, +$('g-print-n').value); });
    $('cel-close').addEventListener('click', closeCelebrate);
    $('cel-share').addEventListener('click', shareResult);
    $('cel-dl').addEventListener('click', async function () { download(await resultBlob(), 'bingo-' + slug(state.game.title) + '.png'); });
    $('cel-copy').addEventListener('click', async function () { $('cel-msg').textContent = await copyText(checkUrl()) ? 'Check link copied. Anyone who opens it sees your exact card and marks.' : checkUrl(); });
    $('celebrate').addEventListener('click', function (e) { if (e.target === this) closeCelebrate(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('celebrate').hidden) closeCelebrate(); });
  }

  // =====================================================================
  // ROUTING
  // =====================================================================
  function showHost(msg) {
    state.view = 'host';
    $('guest-view').hidden = true; $('host-view').hidden = false; $('seo').hidden = false;
    var n = $('notice'); n.textContent = msg || ''; n.hidden = !msg;
  }
  var ERRORS = {
    truncated: 'That game link looks cut off (part of it was probably lost when it was copied). Ask the host to send it again, or make your own game below.',
    corrupt: 'That game link is damaged. Ask the host to send it again, or make your own game below.',
    'too-long': 'That link is too long to be a bingo game.',
    'unknown-preset': 'That link uses a square list this page doesn’t know. Ask the host for a fresh link.',
    'too-few': 'That game has fewer than 24 squares, so it can’t make a card.',
    version: 'That link was made by a newer version of this page. Try reloading.',
    'no-decompress': 'This browser is too old to open compressed game links. Try an up-to-date Chrome, Safari or Firefox.'
  };
  async function route() {
    var h = location.hash.replace(/^#/, '');
    if (!h) { showHost(''); return; }
    var r = await C.decode(h);
    if (r.error) { showHost(ERRORS[r.error] || ''); return; }
    routeGuest(r);
    window.scrollTo(0, 0);
  }

  initHost();
  initGuest();
  $('host-own').href = './' + location.search; // "Host your own game" keeps the incoming ref
  window.addEventListener('hashchange', route);
  route().then(function () { document.documentElement.dataset.ready = '1'; });
})();
