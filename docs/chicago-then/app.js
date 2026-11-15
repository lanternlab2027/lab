/* Chicago Then: UI. Loads schedule.json, picks today's photo by Chicago date. */
(function () {
  'use strict';
  var G = window.ThenGame;
  var $ = function (s) { return document.querySelector(s); };
  var STORE = 'chicagothen:v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null') || { days: {}, seenHelp: false }; }
    catch (e) { return { days: {}, seenHelp: false }; }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private mode: play still works */ }
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  var state = load();
  if (!state.days) state.days = {};
  var sched = null, todayN = 1, n = 1, photo = null, rec = null, year = 1920, lo = 1880, hi = 1970;

  function fmtDate(ymd, long) {
    var p = ymd.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
    return d.toLocaleDateString('en-US', long ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  function photoFor(num) { return sched.photos[G.photoIndex(num, sched.photos.length)]; }

  function start(num) {
    n = num; photo = photoFor(n);
    rec = state.days[n] || { guesses: [], area: null, done: false, won: false, live: false };
    state.days[n] = rec;
    var b = G.bounds(rec.guesses, photo.year, sched.minYear, sched.maxYear);
    lo = b.lo; hi = b.hi;
    year = rec.guesses.length ? clamp(Math.round((lo + hi) / 2)) : clamp(Math.round((sched.minYear + sched.maxYear) / 2));
    $('#num').textContent = '#' + n;
    $('#date').textContent = fmtDate(G.dateForPuzzle(n), true);
    $('#archive-note').hidden = n === todayN;
    var img = $('#photo');
    img.classList.remove('ready');
    img.onload = function () { img.classList.add('ready'); };
    img.width = photo.w; img.height = photo.h;
    img.style.maxWidth = Math.round(photo.w * 1.6) + 'px';
    img.src = 'img/' + photo.file;
    img.alt = 'Historical photograph of a Chicago scene. Guess the year it was taken.';
    if (img.complete && img.naturalWidth) img.classList.add('ready');
    render();
  }

  function clamp(y) { return Math.max(lo, Math.min(hi, y)); }

  function render() {
    var over = rec.done;
    // guess rows
    var rows = '';
    for (var i = 0; i < G.MAX_TRIES; i++) {
      var g = rec.guesses[i];
      if (g === undefined && over) continue;
      if (g === undefined) { rows += '<li class="row empty"><span class="yr">----</span><span class="ht"></span></li>'; continue; }
      var h = G.hint(g, photo.year);
      rows += '<li class="row ' + h.tier + '"><span class="yr">' + g + '</span><span class="ht">' + esc(h.text) + '</span></li>';
    }
    $('#rows').innerHTML = rows;
    $('#play').hidden = over;
    $('#result').hidden = !over;
    $('#tries').textContent = over ? '' : (G.MAX_TRIES - rec.guesses.length) + ' of ' + G.MAX_TRIES + ' guesses left';
    var r = $('#range');
    r.min = lo; r.max = hi; r.value = year;
    $('#year').textContent = year;
    $('#minus').disabled = year <= lo; $('#plus').disabled = year >= hi;
    $('#lo').textContent = lo; $('#hi').textContent = hi;
    // area chips (only for photos whose LOC record pins down the area)
    var hasArea = !!(photo.area_ok && photo.area_ok.length);
    $('#bonus').hidden = !hasArea;
    var bh = '';
    if (hasArea) G.AREAS.forEach(function (b) {
      var cls = 'chip';
      if (rec.area === b) cls += okB(b) ? ' right' : ' wrong';
      if (over && okB(b)) cls += ' answer';
      bh += '<button type="button" class="' + cls + '" data-b="' + esc(b) + '"' + (rec.area || over ? ' disabled' : '') + '>' + esc(b) + '</button>';
    });
    $('#areas').innerHTML = bh;
    $('#area-msg').textContent = rec.area ? (okB(rec.area) ? 'Right part of town!' : 'Not ' + rec.area + '.' + (over ? '' : ' Keep guessing the year.')) : 'One try, just for bragging rights.';
    if (over) renderResult();
  }

  function renderResult() {
    var won = rec.won;
    $('#verdict').textContent = won ? ['Spot on!', 'Brilliant!', 'Nice one!', 'Got it!', 'Phew!'][rec.guesses.length - 1] : 'Out of guesses';
    $('#answer-year').textContent = photo.year;
    $('#answer-title').textContent = photo.place;
    $('#answer-area').textContent = photo.area_ok && photo.area_ok.length ? photo.area_ok.join(' / ') : 'Chicago';
    $('#fact').textContent = photo.fact;
    $('#fact-wrap').hidden = !photo.fact;
    $('#caption').textContent = '\u201C' + photo.caption.replace(/\.$/, '') + '.\u201D';
    $('#loc-note').textContent = photo.loc_note || '';
    $('#loc-note').hidden = !photo.loc_note;
    $('#loc-date').textContent = photo.date_loc.replace(/\.?$/, '.');
    var a = $('#loc-link'); a.href = photo.url; a.textContent = photo.url.replace(/^https?:\/\//, '');
    $('#credit').textContent = photo.credit;
    $('#rights').textContent = photo.rights;
    $('#share-preview').textContent = shareText();
    $('#next-wrap').hidden = n !== todayN;
    $('#play-today').hidden = n === todayN;
    tick();
  }

  function okB(b) { return G.areaOk(b, photo.area_ok); }
  function shareText() { return G.shareText(n, rec.guesses, photo.year, rec.area, photo.area_ok); }

  function submit() {
    if (rec.done) return;
    var g = year;
    if (rec.guesses.indexOf(g) !== -1) return;
    rec.guesses.push(g);
    if (rec.guesses.length === 1) rec.live = n === G.puzzleNumberAt(new Date());
    var b = G.bounds(rec.guesses, photo.year, sched.minYear, sched.maxYear);
    lo = b.lo; hi = b.hi;
    if (G.isOver(rec.guesses, photo.year)) {
      rec.done = true; rec.won = rec.guesses.indexOf(photo.year) !== -1;
    } else {
      year = clamp(year);
      if (year === g) year = clamp(g + (g < photo.year ? 1 : -1));
    }
    save();
    render();
    var last = $('#rows').children[rec.guesses.length - 1];
    if (last) { last.classList.add('pop'); }
    if (rec.done) setTimeout(function () { $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250);
  }

  function setYear(y) { year = clamp(y); $('#range').value = year; $('#year').textContent = year; $('#minus').disabled = year <= lo; $('#plus').disabled = year >= hi; }

  // Share: Web Share, fall back to clipboard, then to a selectable box.
  function share() {
    var text = shareText();
    var done = function (msg) { var t = $('#share-msg'); t.textContent = msg; setTimeout(function () { t.textContent = ''; }, 2500); };
    if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      navigator.share({ text: text }).catch(function (e) { if (e && e.name !== 'AbortError') copy(text, done); });
      return;
    }
    copy(text, done);
  }
  function copy(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done('Copied! Paste it anywhere.'); }, function () { fallbackCopy(text, done); });
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    done(ok ? 'Copied! Paste it anywhere.' : 'Select the text above to copy it.');
  }

  function tick() {
    if ($('#next-wrap').hidden) return;
    var ms = G.msUntilNext(new Date());
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    $('#countdown').textContent = h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    if (ms < 1500) setTimeout(function () { location.reload(); }, 2000);
  }

  // ---- dialogs ----
  function open(id) { var d = $(id); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  function close(d) { if (d.close) d.close(); else d.removeAttribute('open'); }

  function renderStats() {
    var s = G.stats(state.days, todayN);
    $('#st-played').textContent = s.played; $('#st-win').textContent = s.winPct;
    $('#st-cur').textContent = s.current; $('#st-best').textContent = s.best;
    var max = Math.max.apply(null, s.dist.concat([1]));
    var cur = rec && rec.done && rec.won ? rec.guesses.length : 0;
    $('#dist').innerHTML = s.dist.map(function (v, i) {
      return '<div class="bar"><span>' + (i + 1) + '</span><b class="' + (cur === i + 1 ? 'me' : '') + '" style="width:' + Math.max(8, Math.round(100 * v / max)) + '%">' + v + '</b></div>';
    }).join('');
  }

  function renderArchive() {
    var h = '';
    for (var i = todayN; i >= 1; i--) {
      var r = state.days[i];
      var st = r && r.done ? (r.won ? r.guesses.length + '/5' : 'X/5') : (r && r.guesses.length ? 'in progress' : '');
      h += '<li><a href="?n=' + i + '" data-n="' + i + '"><b>#' + i + '</b><span>' + fmtDate(G.dateForPuzzle(i), true) + '</span><em>' + (i === todayN ? 'Today' : '') + (st ? (i === todayN ? ' \u00B7 ' : '') + st : '') + '</em></a></li>';
    }
    $('#archive-list').innerHTML = h;
  }

  function wire() {
    $('#range').addEventListener('input', function (e) { setYear(+e.target.value); });
    $('#minus').addEventListener('click', function () { setYear(year - 1); });
    $('#plus').addEventListener('click', function () { setYear(year + 1); });
    $('#minus10').addEventListener('click', function () { setYear(year - 10); });
    $('#plus10').addEventListener('click', function () { setYear(year + 10); });
    $('#guess').addEventListener('click', submit);
    document.addEventListener('keydown', function (e) {
      if (rec.done || document.querySelector('dialog[open]')) return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range') return;
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setYear(year + 1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setYear(year - 1); }
    });
    $('#areas').addEventListener('click', function (e) {
      var b = e.target.closest('[data-b]'); if (!b || rec.area || rec.done) return;
      rec.area = b.getAttribute('data-b'); save(); render();
    });
    $('#share').addEventListener('click', share);
    $('#photo-btn').addEventListener('click', function () { $('#zoom-img').src = $('#photo').src; open('#zoom'); });
    $('#zoom').addEventListener('click', function () { close($('#zoom')); });
    $('#btn-help').addEventListener('click', function () { open('#help'); });
    $('#btn-stats').addEventListener('click', function () { renderStats(); open('#stats'); });
    $('#btn-archive').addEventListener('click', function () { renderArchive(); open('#archive'); });
    $('#archive-list').addEventListener('click', function (e) {
      var a = e.target.closest('[data-n]'); if (!a) return; e.preventDefault();
      var num = +a.getAttribute('data-n');
      history.replaceState(null, '', num === todayN ? location.pathname : '?n=' + num);
      close($('#archive')); start(num); window.scrollTo(0, 0);
    });
    $('#play-today').addEventListener('click', function () { history.replaceState(null, '', location.pathname); start(todayN); window.scrollTo(0, 0); });
    $('#archive-today').addEventListener('click', function (e) { e.preventDefault(); history.replaceState(null, '', location.pathname); start(todayN); });
    document.querySelectorAll('dialog [data-close]').forEach(function (b) { b.addEventListener('click', function () { close(b.closest('dialog')); }); });
    document.querySelectorAll('dialog').forEach(function (d) {
      d.addEventListener('click', function (e) { if (e.target === d) close(d); });
    });
    setInterval(tick, 1000);
  }

  function init() {
    todayN = G.puzzleNumberAt(new Date());
    var q = +(new URLSearchParams(location.search).get('n') || 0);
    var num = q >= 1 && q <= todayN ? Math.floor(q) : todayN;
    fetch('schedule.json').then(function (r) { return r.json(); }).then(function (d) {
      sched = d;
      wire();
      start(num);
      document.body.classList.add('loaded');
      if (!state.seenHelp) { state.seenHelp = true; save(); open('#help'); }
    }).catch(function () {
      $('#rows').innerHTML = '<li class="row">Could not load today\u2019s photo. Please refresh.</li>';
    });
  }

  init();
})();
