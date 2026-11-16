/* Awards-Night Ballot Pool: page logic. No accounts, no tracking; everything is in the link (URL hash).
 * Modes: home (no hash), pool (#p= a player fills a ballot), entry (#e= someone's picks), standings (#s= the leaderboard).
 * Fetches only same-origin files: shows/index.json, shows/<id>.json and results/<id>.json.
 */
(function () {
  'use strict';
  var B = window.Ballot, C = window.BallotCodec, Cards = window.BallotCards;
  var $ = function (id) { return document.getElementById(id); };
  var APP_URL = 'https://lanternlab2027.github.io/lab/ballot/';
  var ST = {
    mode: 'home', shows: {}, order: [], pool: null, poolId: '', show: null, R: null, picks: [], entry: null,
    entries: [], hostAnswer: null, timer: 0, poolHash: ''
  };

  // ---------- small helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var toastT; function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2400); }
  function store(k, v) { try { if (v == null) localStorage.removeItem('ballot.v1.' + k); else localStorage.setItem('ballot.v1.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function load(k) { try { var v = localStorage.getItem('ballot.v1.' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function show(id, on) { var el = $(id); if (el) el.hidden = !on; }
  function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }
  function fmtTime(ms) {
    try { return new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }); }
    catch (e) { return new Date(ms).toString(); }
  }
  function fmtDay(ms) {
    try { return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' }); }
    catch (e) { return new Date(ms).toDateString(); }
  }
  function localInput(ms) {
    if (!ms) return '';
    var d = new Date(ms), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg || 'Copied'); return true; }
    catch (e) {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove(); toast(ok ? (okMsg || 'Copied') : 'Press and hold the link to copy it'); return ok;
    }
  }
  async function shareLink(url, title, text) {
    if (navigator.share) { try { await navigator.share({ title: title, text: text, url: url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    copyText(url, 'Link copied');
  }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  async function shareImage(canvas, name, text) {
    var blob = await new Promise(function (res) { canvas.toBlob(res, 'image/png'); });
    var file = null;
    try { file = new File([blob], name, { type: 'image/png' }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    download(blob, name);
    toast('Picture saved');
  }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ballot'; }

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
  function base() { return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(location.href) ? location.origin + location.pathname.replace(/[^/]*$/, '') : APP_URL; }
  function linkFor(hash) { return base() + '?ref=' + encodeURIComponent(REF) + '#' + hash; }
  function toolUrl() { return APP_URL + '?ref=' + encodeURIComponent(REF); }

  // ---------- data ----------
  function getJson(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  async function loadShows() {
    var idx;
    try { idx = await getJson('shows/index.json'); } catch (e) { idx = { shows: [] }; }
    var ids = (idx.shows || []).filter(function (id) { return /^[a-z0-9-]{1,32}$/.test(id); });
    var got = await Promise.all(ids.map(function (id) {
      return getJson('shows/' + id + '.json').then(function (j) { var v = B.validateShow(j); return v.ok && v.show.id === id ? v.show : null; }).catch(function () { return null; });
    }));
    got.forEach(function (s) { if (s) { ST.shows[s.id] = s; ST.order.push(s.id); } });
  }
  async function loadResults(s) {
    try { return B.readResults(s, await getJson('results/' + s.id + '.json')); } catch (e) { return B.noResults(s); }
  }
  // Fit an entry's picks to the current show file; flags older/mismatched ballots.
  function fitEntry(e, s) {
    var picks = e.picks.slice(0, s.categories.length);
    while (picks.length < s.categories.length) picks.push(-1);
    picks = picks.map(function (p, i) { return p >= 0 && p < s.categories[i].nominees.length ? p : -1; });
    e.mismatch = e.picks.length !== s.categories.length || !B.validPicks(s, e.picks);
    e.older = !e.mismatch && e.rev !== s.rev;
    if (!e.orig) e.orig = e.picks;
    e.picks = picks;
    return e;
  }

  function statusText(s) {
    var st = B.status(s);
    if (s.demo) return 'Made-up nominees. Try it now.';
    if (st === 'soon') return 'Nominations announced ' + s.nominationsLabel + '; ballots open then.';
    if (st === 'pending') return 'Nominations were announced ' + s.nominationsLabel + '; ballots open as soon as we post the nominees here.';
    if (st === 'over') return 'This show is over. Leaderboards still work.';
    return 'Ballots are open.';
  }

  // ---------- home: show list, pills, create form, print ----------
  function renderHome() {
    $('pills').innerHTML = ST.order.filter(function (id) { return !ST.shows[id].demo && ST.shows[id].ceremony; }).map(function (id) {
      var s = ST.shows[id]; return '<li>' + esc(s.short.replace(/ 2027$/, '')) + ': ' + esc(fmtDay(s.ceremony)) + '</li>';
    }).join('');
    $('shows').innerHTML = ST.order.map(function (id) {
      var s = ST.shows[id];
      return '<div class="card show" data-show="' + esc(id) + '"><h3>' + esc(s.name) + (s.demo ? ' <span class="badge demo">Demo</span>' : '') + '</h3>' +
        '<div class="when">' + esc(s.ceremonyLabel) + '</div><p class="small" style="margin:0">' + esc(s.about) + '</p>' +
        '<div class="stat"><span class="badge">' + (B.isOpen(s) ? 'Open' : 'Coming') + '</span> ' + esc(statusText(s)) + '</div>' +
        '<div class="actions"><button type="button" class="btn sm' + (s.demo ? ' gold' : '') + '" data-act="pool">' + (s.demo ? 'Try the demo' : 'Start a pool') + '</button>' +
        '<button type="button" class="btn sm ghost" data-act="print">Printable ballot</button></div></div>';
    }).join('');
    var opts = ST.order.map(function (id) { var s = ST.shows[id]; return '<option value="' + esc(id) + '">' + esc(s.name + (s.demo ? ' (made-up nominees)' : ' - ' + fmtDay(s.ceremony))) + '</option>'; }).join('');
    $('c-show').innerHTML = opts; $('p-show').innerHTML = opts;
    var first = ST.order.filter(function (id) { return !ST.shows[id].demo && B.status(ST.shows[id]) !== 'over'; })[0] || ST.order[0];
    if (first) { $('c-show').value = first; $('p-show').value = first; }
    formShow();
    renderPaper();
    $('faq-shows').textContent = 'The 2027 film and TV awards voted by entertainment journalists (Jan 10), the recording academy\'s music awards (Feb 7) and the film academy awards (Mar 14), plus a demo show with made-up nominees. Each show is one data file, so more can be added.';
  }
  function formShow() {
    var s = ST.shows[$('c-show').value]; if (!s) return;
    $('c-show-note').textContent = statusText(s);
    var w = {}; s.categories.forEach(function (c) { (w[c.weight] = w[c.weight] || []).push(c.name); });
    $('weights-note').textContent = '(' + Object.keys(w).sort().reverse().map(function (k) { return k + ' pt: ' + (w[k].length > 2 ? w[k].length + ' categories' : w[k].join(', ')); }).join('; ') + ')';
    $('c-tb').innerHTML = '<option value="">No tiebreaker</option>' + s.tiebreakers.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.q) + '</option>'; }).join('') + '<option value="custom">My own question...</option>';
    if (s.tiebreakers.length) $('c-tb').value = s.tiebreakers[0].id;
    show('c-tbq-box', false);
    $('lock').value = localInput(s.ceremony);
    $('lock-note').textContent = s.ceremony ? 'Default: when the show starts, ' + s.ceremonyLabel + '.' : 'The demo has no start time; leave this empty for no lock.';
  }

  function renderPaper(entry) {
    var s = ST.mode === 'home' || !ST.show ? ST.shows[$('p-show').value] : ST.show;
    if (!s) { $('paper').innerHTML = ''; return; }
    var pool = ST.mode === 'home' ? null : ST.pool, picks = entry ? entry.picks : (ST.mode === 'pool' ? ST.picks : null);
    var weighted = pool && pool.rules === 'weighted', open = B.isOpen(s);
    var tbq = pool ? B.tbQuestion(pool, s) : (s.tiebreakers[0] ? s.tiebreakers[0].q : '');
    var h = '<div class="ph"><b>' + esc(s.name) + (s.demo ? ' (DEMO)' : '') + '</b><span>' + esc(s.ceremonyLabel) + '</span></div>';
    h += '<div class="lines"><span>Name: ' + esc(entry ? entry.name : '') + '</span><span>Pool: ' + esc(pool ? pool.name : '') + '</span><span style="flex:0 1 140px">Score: </span></div>';
    if (!open) h += '<p style="font-size:12px;margin:4px 0 8px">Nominees are announced ' + esc(s.nominationsLabel) + '. Write them in, or print again once they are posted at lanternlab2027.github.io/lab/ballot.</p>';
    h += '<div class="cols">' + s.categories.map(function (c, ci) {
      var body = c.nominees.length ? c.nominees.map(function (n, k) {
        return '<div class="pn"><span class="bx' + (picks && picks[ci] === k ? ' x' : '') + '"></span><span>' + esc(n.name) + (n.note ? ' <i>' + esc(n.note) + '</i>' : '') + '</span></div>';
      }).join('') : '<div class="blank"></div><div class="blank"></div><div class="blank"></div><div class="blank"></div><div class="blank"></div>';
      return '<div class="pc"><h4>' + esc(c.name) + (weighted ? '<small>' + c.weight + ' pt</small>' : '') + '</h4>' + body + '</div>';
    }).join('') + '</div>';
    if (tbq) h += '<div class="lines"><span>Tiebreaker: ' + esc(tbq) + ' ' + (entry && entry.tb != null ? esc(entry.tb) : '') + '</span></div>';
    h += '<div class="pf"><span>For bragging rights. Not affiliated with any awards organization.</span><span>Make yours: lanternlab2027.github.io/lab/ballot</span></div>';
    $('paper').innerHTML = h;
  }

  // ---------- modes ----------
  function setMode(m) {
    ST.mode = m; document.body.setAttribute('data-mode', m);
    show('home-intro', m === 'home'); show('poolhead', m !== 'home');
    show('fill', m === 'pool'); show('entry', m === 'entry'); show('standings', m === 'standings');
    show('shows-sec', m === 'home'); show('create', m === 'home'); show('p-show', m === 'home');
    if (ST.timer) { clearInterval(ST.timer); ST.timer = 0; }
  }
  function poolHead() {
    var s = ST.show, p = ST.pool;
    $('ph-name').textContent = p.name;
    var bits = [s.name + (s.demo ? ' (demo, made-up nominees)' : ''), p.rules === 'weighted' ? 'weighted scoring' : 'one point per category'];
    if (p.lock) bits.push('locks ' + fmtTime(p.lock));
    $('ph-meta').textContent = bits.join(' \u00b7 ');
    document.title = p.name + ' - Awards-Night Ballot Pool';
  }
  function linkError(code) {
    var m = {
      'truncated': 'This link looks cut off. Ask for it again, or copy the whole thing (it is long).',
      'too-long': 'This link is too long to be a ballot link.',
      'version': 'This link is from a different version of the page.',
      'no-decompress': 'This browser is too old to open this link. Try an up-to-date Chrome, Safari, Firefox or Edge.',
      'no-show': 'This pool is for a show this page does not list any more.'
    }[code] || 'This link is damaged, so it could not be opened. Ask for it again.';
    $('linkerr').textContent = m; show('linkerr', true);
  }

  async function route() {
    show('linkerr', false); show('ph-warn', false);
    var h = location.hash.replace(/^#/, '');
    if (!/^[pes]=/.test(h)) { setMode('home'); ST.show = null; ST.pool = null; document.title = 'Printable Awards Ballot 2027 + Free Awards Night Ballot Pool'; renderPaper(); return; }
    var d = await C.decode(h);
    if (d.error) { setMode('home'); renderPaper(); linkError(d.error); return; }
    var s = ST.shows[d.pool.show];
    if (!s) { setMode('home'); renderPaper(); linkError('no-show'); return; }
    ST.pool = d.pool; ST.poolId = d.poolId; ST.show = s; ST.poolHash = await C.encodePool(d.pool);
    poolHead();
    if (d.type === 'pool') return startFill();
    ST.R = await loadResults(s);
    if (d.type === 'entry') { ST.entry = fitEntry(d.entry, s); return renderEntry(); }
    ST.entries = d.entries.map(function (e) { return fitEntry(e, s); }); ST.hostAnswer = d.hostAnswer;
    store('st.' + ST.poolId, h);
    renderStandings();
  }

  // ---------- fill ----------
  function startFill() {
    setMode('pool');
    var s = ST.show, p = ST.pool, open = B.isOpen(s);
    show('fill-closed', !open); show('fill-open', open); show('mylink', false);
    $('finish-msg').textContent = '';
    if (!open) {
      show('fill-nudge', !$('remind').hidden);
      $('fill-closed-msg').innerHTML = '<b>' + esc(statusText(s)) + '</b> This pool is for ' + esc(s.name) + ' (' + esc(s.ceremonyLabel) + ').';
      renderPaper(); return;
    }
    var draft = load('draft.' + ST.poolId) || {};
    ST.picks = B.validPicks(s, draft.picks) ? draft.picks : B.emptyPicks(s);
    $('pname').value = draft.name || load('name') || '';
    $('tb').value = draft.tb == null ? '' : draft.tb;
    show('tb-box', !!p.tbKey);
    $('tb-lab').textContent = 'Tiebreaker: ' + B.tbQuestion(p, s);
    $('fill-sub').textContent = 'Tap who you think wins each category. Skip any you have no idea about.' + (p.rules === 'weighted' ? ' Bigger awards are worth more points.' : '');
    $('fill-h').textContent = s.demo ? 'Your ballot (demo)' : 'Your ballot';
    $('cats').innerHTML = s.categories.map(function (c, ci) {
      return '<fieldset class="cat" id="cat-' + ci + '"><legend>' + esc(c.name) + (p.rules === 'weighted' ? '<small>' + c.weight + ' pt' + (c.weight > 1 ? 's' : '') + '</small>' : '') + '</legend>' +
        c.nominees.map(function (n, k) {
          return '<label class="nom' + (ST.picks[ci] === k ? ' on' : '') + '"><input type="radio" name="c' + ci + '" value="' + k + '"' + (ST.picks[ci] === k ? ' checked' : '') + '><span>' + esc(n.name) + (n.note ? '<small>' + esc(n.note) + '</small>' : '') + '</span></label>';
        }).join('') + '</fieldset>';
    }).join('');
    progress(); renderPaper();
  }
  function progress() {
    var s = ST.show, n = B.countPicked(ST.picks), tot = s.categories.length;
    $('prog').textContent = n + ' of ' + tot + ' picked';
    $('progbar').style.width = Math.round(100 * n / tot) + '%';
    $('prog-pts').textContent = ST.pool.rules === 'weighted' ? 'Worth up to ' + B.maxPoints(s, 'weighted') + ' points' : '';
  }
  function saveDraft() { store('draft.' + ST.poolId, { picks: ST.picks, name: $('pname').value, tb: $('tb').value }); }
  on('cats', 'change', function (e) {
    var t = e.target; if (!t || t.type !== 'radio') return;
    var ci = +t.name.slice(1); ST.picks[ci] = +t.value;
    var fs = $('cat-' + ci); Array.prototype.forEach.call(fs.querySelectorAll('.nom'), function (l) { l.classList.toggle('on', l.querySelector('input').checked); });
    saveDraft(); progress(); show('mylink', false); renderPaper();
  });
  on('pname', 'input', saveDraft); on('tb', 'input', saveDraft);
  on('clear', 'click', function () { ST.picks = B.emptyPicks(ST.show); saveDraft(); startFill(); });
  on('finish', 'click', async function () {
    var s = ST.show, p = ST.pool, msg = $('finish-msg');
    var name = B.clean($('pname').value, C.LIMITS.player);
    if (!name) { msg.textContent = 'Add your name so the host knows whose ballot this is.'; $('pname').focus(); return; }
    var n = B.countPicked(ST.picks);
    if (!n) { msg.textContent = 'Pick at least one winner first.'; return; }
    var tb = $('tb').value.trim();
    if (p.tbKey && (tb === '' || !isFinite(+tb) || +tb < 0)) { msg.textContent = 'Add your tiebreaker guess (a number).'; $('tb').focus(); return; }
    msg.textContent = n < s.categories.length ? (s.categories.length - n) + ' categor' + (s.categories.length - n === 1 ? 'y' : 'ies') + ' skipped. That is fine; they just score zero.' : '';
    msg.style.color = 'var(--muted)';
    store('name', name);
    var e = C.makeEntry(p, { name: name, picks: ST.picks, tb: p.tbKey ? tb : '', time: Date.now(), rev: s.rev });
    ST.entry = e;
    var url = linkFor(await C.encodeEntry(p, e));
    $('mylink-url').value = url;
    show('late-msg', C.isLate(p, e));
    show('mylink', true);
    $('mylink').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ---------- cards ----------
  function ballotCard(e) {
    var s = ST.show, R = ST.R || B.noResults(s);
    var order = s.categories.map(function (c, i) { return i; }).filter(function (i) { return e.picks[i] >= 0; })
      .sort(function (a, b) { return s.categories[b].weight - s.categories[a].weight || a - b; });
    var rows = order.slice(0, 8).sort(function (a, b) { return a - b; }).map(function (i) {
      var won = R.won[i];
      return { cat: s.categories[i].name.replace(/ \(Demo\)$/, ''), pick: s.categories[i].nominees[e.picks[i]].name, mark: won ? (won.indexOf(e.picks[i]) >= 0 ? 'ok' : 'bad') : '' };
    });
    var sc = R.decided ? B.score(s, ST.pool.rules, e.picks, R) : null;
    return Cards.drawBallot(document.createElement('canvas'), {
      name: e.name, pool: ST.pool.name, show: s.name, demo: s.demo, picks: rows, picked: B.countPicked(e.picks), total: s.categories.length,
      score: sc ? sc.correct + ' of ' + R.decided + ' right' + (R.final ? '' : ' so far') + (ST.pool.rules === 'weighted' ? ' - ' + sc.points + ' pts' : '') : ''
    });
  }
  function saveBallot(e) { shareImage(ballotCard(e), 'my-ballot-' + slug(e.name) + '.png', 'My ballot for ' + ST.show.short + '. Make yours: ' + toolUrl()); }

  // ---------- entry ----------
  function renderEntry() {
    setMode('entry');
    var s = ST.show, e = ST.entry, R = ST.R, p = ST.pool;
    $('entry-h').textContent = e.name + "'s ballot";
    show('entry-bad', e.ok === false);
    var facts = ['Made ' + (e.time ? fmtTime(e.time) : 'at an unknown time'), B.countPicked(e.picks) + ' of ' + s.categories.length + ' categories picked'];
    if (p.tbKey) facts.push('Tiebreaker guess: ' + (e.tb == null ? 'none' : e.tb));
    if (e.late) facts.push('LATE: made after the lock time');
    if (e.older) facts.push('made with an older version of the nominee list');
    if (e.mismatch) facts.push('does not match the current nominee list');
    if (R.decided) { var sc = B.score(s, p.rules, e.picks, R); facts.push(sc.correct + ' of ' + R.decided + ' right' + (R.final ? '' : ' so far') + ', ' + sc.points + ' point' + (sc.points === 1 ? '' : 's')); }
    $('entry-facts').textContent = facts.join(' \u00b7 ');
    $('entry-picks').innerHTML = s.categories.map(function (c, ci) {
      var pk = e.picks[ci], won = R.won[ci], cls = won && pk >= 0 ? (won.indexOf(pk) >= 0 ? 'ok' : 'bad') : '';
      return '<li class="' + cls + '"><small>' + esc(c.name) + '</small><b>' + (pk >= 0 ? esc(c.nominees[pk].name) : '<span class="small">(no pick)</span>') + '</b>' +
        (won && cls === 'bad' ? '<span class="small"> Winner: ' + esc(won.map(function (k) { return c.nominees[k].name; }).join(' and ')) + '</span>' : '') + '</li>';
    }).join('');
    $('entry-url').value = location.href;
    renderPaper(e);
  }
  on('entry-copy', 'click', function () { copyText(location.href, 'Link copied'); });
  on('entry-img', 'click', function () { saveBallot(ST.entry); });
  on('entry-print', 'click', function () { renderPaper(ST.entry); window.print(); });
  on('entry-edit', 'click', function () {
    store('draft.' + ST.poolId, { picks: ST.entry.picks.slice(), name: ST.entry.name, tb: ST.entry.tb == null ? '' : ST.entry.tb });
    location.href = linkFor(ST.poolHash);
  });
  on('entry-join', 'click', function () { store('draft.' + ST.poolId, null); location.href = linkFor(ST.poolHash); });
  on('entry-add', 'click', async function () {
    var prev = load('st.' + ST.poolId), list = [], ans = null;
    if (prev) { var d = await C.decode(prev); if (d.type === 'standings' && d.poolId === ST.poolId) { list = d.entries; ans = d.hostAnswer; } }
    location.href = linkFor(await C.encodeStandings(ST.pool, rawEntries(merge(list, [ST.entry]).list), ans));
  });

  // ---------- standings ----------
  // Keep one ballot per player name (case-insensitive); a newer ballot replaces an older one.
  function merge(list, add) {
    var out = list.slice(), added = 0, replaced = 0, same = 0;
    add.forEach(function (e) {
      var k = out.findIndex(function (x) { return x.name.toLowerCase() === e.name.toLowerCase(); });
      if (k < 0) { out.push(e); added++; }
      else if (out[k].check === e.check) same++;
      else if (e.time >= out[k].time) { out[k] = e; replaced++; }
      else same++;
    });
    return { list: out.slice(0, C.LIMITS.entries), added: added, replaced: replaced, same: same };
  }
  function inShowWindow(s) { var now = Date.now(); return !!s.ceremony && now > s.ceremony - 30 * 60e3 && now < s.ceremony + 6 * 3600e3; }
  function renderStandings() {
    setMode('standings');
    var s = ST.show, p = ST.pool, R = ST.R;
    var live = inShowWindow(s) && !R.final;
    $('live-dot').classList.toggle('on', live);
    var stat;
    if (R.decided) stat = '<b>' + R.decided + ' of ' + R.total + ' winners announced' + (R.final ? ' (final)' : '') + '.</b>' + (R.updated ? ' Updated ' + esc(R.updated) + '.' : '');
    else stat = '<b>No winners yet.</b> ' + (s.ceremony ? 'The show starts ' + esc(s.ceremonyLabel) + '. ' : '') + 'Scores fill in as each award is announced.';
    if (live) stat += ' Live: this page checks for new winners every minute.';
    if (s.resultsUrl) stat += ' <a href="' + esc(s.resultsUrl) + '" rel="noopener noreferrer">Official site</a>';
    $('st-status').innerHTML = stat;
    var st = B.standings(s, p, ST.entries, R, ST.hostAnswer);
    var tbq = B.tbQuestion(p, s);
    var hasTb = !!p.tbKey;
    if (!ST.entries.length) $('st-table').innerHTML = '<p class="small">No ballots yet. Paste picks links below as they come in.</p>';
    else $('st-table').innerHTML = '<table><thead><tr><th class="n">#</th><th>Player</th><th class="n">Points</th><th class="n">Right</th><th class="n">Max</th>' + (hasTb ? '<th class="n" title="' + esc(tbq) + '">Tiebreak</th>' : '') + '</tr></thead><tbody>' +
      st.rows.map(function (r) {
        var e = r.entry, flags = (e.late ? '<span class="flag">late</span>' : '') + (e.ok === false ? '<span class="flag bad">edited link</span>' : '') + (e.mismatch ? '<span class="flag bad">wrong nominee list</span>' : '') + (e.older ? '<span class="flag">older list</span>' : '');
        return '<tr' + (R.decided && r.rank === 1 ? ' class="lead"' : '') + '><td class="n">' + (r.rank == null ? '-' : r.rank) + '</td><td>' + esc(e.name) + flags + '</td><td class="n">' + r.score.points + '</td><td class="n">' + r.score.correct + '/' + R.decided + '</td><td class="n">' + r.score.possible + '</td>' +
          (hasTb ? '<td class="n">' + (e.tb == null ? '-' : e.tb) + (r.off != null ? '<br><span class="small">' + (r.off ? 'off by ' + r.off : 'exact') + '</span>' : '') + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table>';
    var notes = [];
    if (hasTb) notes.push('Ties go to the closest tiebreak guess: ' + tbq + (st.answer != null ? ' Answer: ' + st.answer + '.' : ' (answer not in yet)'));
    if (ST.entries.some(function (e) { return e.late; })) notes.push('"late" = made after the lock time, by the player\'s device clock.');
    if (ST.entries.some(function (e) { return e.ok === false; })) notes.push('"edited link" = the link was changed by hand after it was made; it is listed last, unranked, and gets no awards.');
    $('st-flags').textContent = notes.join(' ');
    show('host-tb', p.tbKey === 'custom');
    $('host-tb-lab').textContent = 'Tiebreaker answer: ' + tbq;
    if (p.tbKey === 'custom' && document.activeElement !== $('host-tb-in')) $('host-tb-in').value = ST.hostAnswer == null ? '' : ST.hostAnswer;
    $('st-count').textContent = ST.entries.length + ' ballot' + (ST.entries.length === 1 ? '' : 's');
    $('st-url').value = linkFor(location.hash.replace(/^#/, ''));
    // awards
    var aw = B.awards(s, p, st, R);
    var box = $('awards'); box.innerHTML = '';
    if (!aw.length) box.innerHTML = '<p class="small">Awards appear once there are at least two ballots' + (R.decided ? '' : ' and the first winners are in (the Contrarian needs three ballots)') + '.</p>';
    aw.forEach(function (a) {
      var fig = document.createElement('figure'); fig.className = 'award';
      var cv = Cards.drawAward(document.createElement('canvas'), a, p.name, s.name, s.demo);
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', a.title + ': ' + a.name + '. ' + a.stat);
      fig.appendChild(cv);
      var cap = document.createElement('figcaption');
      cap.innerHTML = '<b>' + esc(a.title) + ':</b> ' + esc(a.name) + '<br><span class="small">' + esc(a.stat) + '</span><br>';
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn sm ghost'; btn.textContent = 'Save picture';
      btn.setAttribute('data-award', a.id);
      btn.addEventListener('click', function () { shareImage(cv, slug(a.title) + '-' + slug(a.name) + '.png', a.title + ': ' + a.name + ' in ' + p.name + '. Make yours: ' + toolUrl()); });
      cap.appendChild(btn); fig.appendChild(cap); box.appendChild(fig);
    });
    renderPaper();
    if (live && !ST.timer) ST.timer = setInterval(function () { if (!document.hidden) refresh(true); }, 60e3);
  }
  async function refresh(quiet) {
    var before = ST.R ? ST.R.decided : 0;
    ST.R = await loadResults(ST.show);
    renderStandings(); // setMode() clears the old timer; renderStandings() starts a new one while the show is live
    if (!quiet) toast(ST.R.decided > before ? (ST.R.decided - before) + ' new winner' + (ST.R.decided - before === 1 ? '' : 's') : 'Results are up to date');
  }
  // links keep each ballot's original picks (so its checksum still matches), not the copy fitted to the show file
  function rawEntries(list) { return list.map(function (e) { return Object.assign({}, e, { picks: e.orig || e.picks }); }); }
  async function saveStandings() {
    var h = await C.encodeStandings(ST.pool, rawEntries(ST.entries), ST.hostAnswer);
    history.replaceState(null, '', location.pathname + location.search + '#' + h);
    store('st.' + ST.poolId, h);
  }
  on('refresh', 'click', function () { refresh(false); });
  on('paste-add', 'click', async function () {
    var links = C.findLinks($('paste').value), msg = $('paste-msg');
    if (!links.length) { msg.textContent = 'No ballot links found in that text. They contain "#e=".'; return; }
    var got = [], other = 0, broken = 0, pools = 0;
    for (var i = 0; i < links.length; i++) {
      var d = await C.decode(links[i]);
      if (d.error) { broken++; continue; }
      if (d.type === 'pool') { pools++; continue; }
      if (d.poolId !== ST.poolId) { other++; continue; }
      (d.type === 'entry' ? [d.entry] : d.entries).forEach(function (e) { got.push(fitEntry(e, ST.show)); });
    }
    var m = merge(ST.entries, got);
    ST.entries = m.list;
    await saveStandings();
    var bits = [];
    if (m.added) bits.push(m.added + ' added'); if (m.replaced) bits.push(m.replaced + ' updated'); if (m.same) bits.push(m.same + ' already in');
    if (other) bits.push(other + ' from a different pool (skipped)'); if (broken) bits.push(broken + ' damaged (skipped)'); if (pools) bits.push(pools + ' pool link' + (pools === 1 ? '' : 's') + ' ignored');
    msg.textContent = bits.join(', ') + '.';
    $('paste').value = '';
    renderStandings();
  });
  on('host-tb-set', 'click', async function () {
    var v = $('host-tb-in').value.trim();
    ST.hostAnswer = v === '' || !isFinite(+v) ? null : Math.max(0, Math.round(+v));
    await saveStandings(); renderStandings(); toast('Tiebreaker answer saved in the link');
  });
  on('st-copy', 'click', function () { copyText($('st-url').value, 'Leaderboard link copied'); });
  on('st-share', 'click', function () { shareLink($('st-url').value, ST.pool.name + ' leaderboard', ST.pool.name + ' leaderboard (for bragging rights)'); });
  on('st-pool', 'click', function () { copyText(linkFor(ST.poolHash), 'Pool link copied'); });

  // ---------- create ----------
  on('c-show', 'change', formShow);
  on('c-tb', 'change', function () { show('c-tbq-box', $('c-tb').value === 'custom'); });
  on('create-form', 'submit', async function (ev) {
    ev.preventDefault();
    var s = ST.shows[$('c-show').value], msg = $('create-msg'); msg.textContent = '';
    if (!s) return;
    var tbKey = $('c-tb').value, tbQ = $('c-tbq').value;
    if (tbKey === 'custom' && !B.clean(tbQ, 120)) { msg.textContent = 'Type your tiebreaker question, or pick another option.'; return; }
    var lockV = $('lock').value, lock = lockV ? new Date(lockV).getTime() : 0;
    if (lockV && !isFinite(lock)) { msg.textContent = 'That lock time does not look right.'; return; }
    var pool = C.makePool({ name: $('pool-name').value || (s.demo ? 'Demo pool' : s.short + ' pool'), show: s.id, rules: $('r-weighted').checked ? 'weighted' : 'flat', lock: lock, tbKey: tbKey, tbQ: tbQ });
    var ph = await C.encodePool(pool), sh = await C.encodeStandings(pool, [], null);
    store('st.' + C.poolId(pool), sh);
    $('pool-url').value = linkFor(ph); $('pool-st-url').value = linkFor(sh);
    $('pool-play').href = linkFor(ph); $('pool-st').href = linkFor(sh);
    show('pool-made', true);
    $('pool-made').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  on('pool-copy', 'click', function () { copyText($('pool-url').value, 'Pool link copied'); });
  on('pool-share', 'click', function () { shareLink($('pool-url').value, 'Join my awards night ballot pool', 'Make your picks for our awards night ballot pool (for bragging rights): '); });
  on('pool-st-copy', 'click', function () { copyText($('pool-st-url').value, 'Leaderboard link copied'); });
  on('try-demo', 'click', async function () {
    var s = ST.shows.demo; if (!s) return;
    var pool = C.makePool({ name: 'Demo pool', show: 'demo', rules: 'weighted', tbKey: s.tiebreakers[0] ? s.tiebreakers[0].id : '' });
    location.href = linkFor(await C.encodePool(pool));
  });
  on('shows', 'click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var id = b.closest('[data-show]').getAttribute('data-show');
    if (b.getAttribute('data-act') === 'print') { $('p-show').value = id; renderPaper(); $('print-sec').scrollIntoView({ behavior: 'smooth' }); return; }
    if (id === 'demo') { $('try-demo').click(); return; }
    $('c-show').value = id; formShow(); $('create').scrollIntoView({ behavior: 'smooth' });
  });

  // ---------- misc ----------
  on('p-show', 'change', function () { renderPaper(); });
  on('paper-more', 'click', function () {
    var c = $('paper').classList.toggle('clip');
    $('paper-more').textContent = c ? 'Show the whole ballot' : 'Show less';
    $('paper-more').setAttribute('aria-expanded', c ? 'false' : 'true');
  });
  on('print', 'click', function () { renderPaper(ST.mode === 'entry' ? ST.entry : null); window.print(); });
  on('mylink-copy', 'click', function () { copyText($('mylink-url').value, 'Link copied'); });
  on('mylink-share', 'click', function () { shareLink($('mylink-url').value, 'My ballot picks', 'My picks for ' + ST.pool.name + ': '); });
  on('mylink-img', 'click', function () { saveBallot(ST.entry); });
  on('mylink-open', 'click', function () { location.href = $('mylink-url').value; });
  on('share-tool', 'click', function () { shareLink(toolUrl(), 'Awards-Night Ballot Pool', 'A free awards night ballot pool by link, no accounts: '); });
  window.addEventListener('hashchange', function () { route().then(function () { window.scrollTo(0, 0); }); });

  loadShows().then(function () { renderHome(); return route(); }).catch(function (e) { linkError('corrupt'); if (window.console) console.warn(e); })
    .then(function () { document.documentElement.setAttribute('data-ready', '1'); });
})();
