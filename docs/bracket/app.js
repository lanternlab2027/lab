/* 76-Team Bracket: page logic. No accounts, no tracking; everything is in the link (URL hash).
 * Modes: home (no hash), pool (#p= player fills picks), entry (#e= someone's picks), standings (#s=).
 * Fetches only same-origin files: field-2027.json and results-2027.json.
 */
(function () {
  'use strict';
  var B = window.Bracket, C = window.BracketCodec, Rn = window.BracketRender, Cards = window.BracketCards;
  var $ = function (id) { return document.getElementById(id); };
  var APP_URL = 'https://lanternlab2027.github.io/lab/bracket/';
  var ST = {
    mode: 'home', pool: null, poolId: '', S: B.build(), official: { layout: B.DEFAULT_LAYOUT, teams: {}, official: false, isDefault: true },
    resultsJson: null, demo: false, picks: B.emptyPicks(), tab: 0, entry: null, entries: [], awards: []
  };

  // ---------- small helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var toastT; function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2400); }
  function store(k, v) { try { if (v == null) localStorage.removeItem('bracket.v1.' + k); else localStorage.setItem('bracket.v1.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function load(k) { try { var v = localStorage.getItem('bracket.v1.' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function show(id, on) { var el = $(id); if (el) el.hidden = !on; }
  function fmtTime(ms) {
    try { return new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }); }
    catch (e) { return new Date(ms).toString(); }
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
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'bracket'; }

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

  // ---------- names / structure ----------
  function sameLayout(a, b) { return B.layoutText(a) === B.layoutText(b); }
  function names(slot) {
    var id = ST.S.slots[slot].id;
    if (ST.pool && ST.pool.teams) return ST.pool.teams[id];
    if (ST.official.official && sameLayout(ST.S.layout, ST.official.layout)) return ST.official.teams[id] || B.placeholder(ST.S, slot);
    return B.placeholder(ST.S, slot);
  }
  function hasRealNames() { return !!((ST.pool && ST.pool.teams) || (ST.official.official && sameLayout(ST.S.layout, ST.official.layout))); }
  // "3 Kansas" once real names are known; just "East 3" while seeds are placeholders
  function seedName(slot) { return slot == null ? '' : hasRealNames() ? B.seedOf(ST.S, slot) + ' ' + names(slot) : names(slot); }
  function results() {
    if (ST.demo) return demoResults();
    return B.readResults(ST.S, ST.resultsJson || {});
  }
  // Made-up results for the "preview" button: better seed usually wins, deterministic per pool.
  function demoResults() {
    var S = ST.S, seed = C.hash32(ST.poolId || 'demo'), win = {}, p = B.emptyPicks();
    for (var g = 0; g < B.GAMES; g++) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      var t = B.teamsIn(S, p, g), side = B.seedOf(S, t[0]) <= B.seedOf(S, t[1]) ? 1 : 2;
      if ((seed >>> 8) % 100 < 28) side = 3 - side;
      p = B.setPick(S, p, g, side); win[S.games[g].code] = S.slots[t[side - 1]].id;
    }
    return B.readResults(S, { winners: win, championshipTotal: 140 + (seed % 25) });
  }

  // ---------- the bracket sheet ----------
  function drawSheet() {
    var interactive = ST.mode === 'pool';
    var picks = ST.mode === 'pool' ? ST.picks : (ST.mode === 'entry' && ST.entry ? ST.entry.picks : null);
    var R = (ST.mode === 'entry' || ST.mode === 'pool') && ST.resultsJson ? results() : null;
    if (R && !R.played) R = null;
    var html = Rn.svg(ST.S, {
      picks: picks, names: names, showNames: hasRealNames() || ST.mode === 'pool' || ST.mode === 'entry', interactive: interactive, R: R,
      tb: ST.mode === 'entry' && ST.entry ? ST.entry.tb : (ST.mode === 'pool' && $('tb').value !== '' ? $('tb').value : null),
      name: ST.mode === 'entry' && ST.entry ? ST.entry.name : (ST.mode === 'pool' ? $('pname').value.trim() : ''),
      note: ST.pool && !ST.pool.solo ? 'Pool: ' + ST.pool.name : ''
    });
    $('sheet').innerHTML = html;
  }
  function sheetNote() {
    var n = [];
    if (ST.pool && ST.pool.teams) n.push('Teams entered by the pool\u2019s commissioner.');
    else if (ST.official.official) n.push('Official field and seeds as announced on Selection Sunday.');
    else n.push('Seeds only until Selection Sunday, March 14, 2027. The 12 Opening Round games use the published plan (every region\u2019s 16 and 12 lines, two 11 lines and two 15 lines); which regions get the 11 and 15 games, and which regions meet in the national semifinals, are set when the bracket is revealed.');
    $('sheet-note').textContent = n.join(' ');
  }

  // ---------- fill (player) ----------
  var TABS = function () { return ST.S.layout.map(function (r) { return r.name; }).concat(['Finals']); };
  function drawTabs() {
    $('tabs').innerHTML = TABS().map(function (t, i) {
      var games = ST.S.games.filter(function (g) { return i < 4 ? g.region === i : g.round >= 5; });
      var done = games.filter(function (g) { return ST.picks[g.i]; }).length;
      return '<button type="button" role="tab" class="tab' + (i === ST.tab ? ' on' : '') + '" aria-selected="' + (i === ST.tab) + '" data-tab="' + i + '">' + esc(t) + ' <small>' + done + '/' + games.length + '</small></button>';
    }).join('');
  }
  function gameLabel(g) {
    if (g.round === 0) return 'Opening Round \u00b7 ' + B.seedOf(ST.S, g.a.slot) + ' line';
    if (g.round === 5) return 'National semifinal \u00b7 ' + ST.S.layout[ST.S.games[g.a.game].region].name + ' vs ' + ST.S.layout[ST.S.games[g.b.game].region].name;
    return '';
  }
  function drawGames() {
    var html = '', last = -1, memo = {};
    ST.S.games.forEach(function (g) {
      if (ST.tab < 4 ? g.region !== ST.tab : g.round < 5) return;
      if (g.round !== last) { html += '<h3 class="rnd">' + esc(g.round === 0 ? 'Opening Round (Mar 16-17)' : g.round === 5 ? 'National semifinals (Apr 3)' : g.round === 6 ? 'Title game (Apr 5)' : B.ROUNDS[g.round]) + '</h3>'; last = g.round; }
      var t = B.teamsIn(ST.S, ST.picks, g.i, memo);
      var gl = gameLabel(g);
      html += '<div class="game" data-g="' + g.i + '">' + (gl ? '<div class="glabel">' + esc(gl) + '</div>' : '');
      for (var s = 0; s < 2; s++) {
        var on = ST.picks[g.i] === s + 1;
        if (t[s] == null) html += '<button type="button" class="tm empty" disabled>Pick the earlier game first</button>';
        else html += '<button type="button" class="tm' + (on ? ' on' : '') + '" data-g="' + g.i + '" data-s="' + (s + 1) + '" aria-pressed="' + on + '"><b>' + B.seedOf(ST.S, t[s]) + '</b> ' + esc(names(t[s])) + '</button>';
      }
      html += '</div>';
    });
    $('games').innerHTML = html;
  }
  function progress() {
    var n = B.countPicks(ST.picks);
    $('prog').textContent = n + ' of 75 games picked';
    $('progbar').style.width = (n / 75 * 100).toFixed(1) + '%';
    var champ = B.winnerOf(ST.S, ST.picks, ST.S.final);
    $('champ-pick').textContent = champ == null ? 'No champion yet' : 'Champion: ' + seedName(champ);
  }
  function saveDraft() { if (ST.poolId) store('draft.' + ST.poolId, { picks: ST.picks, name: $('pname').value, tb: $('tb').value }); }
  function refreshFill() { drawTabs(); drawGames(); progress(); drawSheet(); saveDraft(); show('mylink', false); }
  function pick(g, side) {
    ST.picks = B.setPick(ST.S, ST.picks, g, ST.picks[g] === side ? 0 : side);
    refreshFill();
  }
  function autofill() {
    var p = ST.picks;
    for (var g = 0; g < B.GAMES; g++) {
      if (p[g]) continue;
      var t = B.teamsIn(ST.S, p, g);
      p = B.setPick(ST.S, p, g, B.seedOf(ST.S, t[0]) <= B.seedOf(ST.S, t[1]) ? 1 : 2);
    }
    ST.picks = p; refreshFill(); toast('Filled the rest with the better seeds');
  }
  function lockState() {
    if (!ST.pool || !ST.pool.lock) return '';
    return Date.now() > ST.pool.lock ? 'locked' : 'open';
  }
  async function finish() {
    var name = $('pname').value.trim(), n = B.countPicks(ST.picks), msg = $('finish-msg');
    if (!name) { msg.textContent = 'Add your name first, so the commissioner knows whose picks these are.'; $('pname').focus(); return; }
    if (n < 75) { msg.textContent = 'You have ' + (75 - n) + ' games left to pick. Tip: "Fill the rest with better seeds" finishes it fast.'; return; }
    msg.textContent = '';
    var e = C.makeEntry(ST.pool, { name: name, picks: ST.picks, tb: $('tb').value, time: Date.now() });
    var url = linkFor(await C.encodeEntry(ST.pool, e));
    ST.entry = e;
    $('mylink-url').value = url;
    $('mylink-h').textContent = ST.pool.solo ? 'Your bracket link' : 'Your picks link: send it to the commissioner';
    $('mylink-what').textContent = ST.pool.solo
      ? 'This link holds your whole bracket. Open it any time to see how you\u2019re doing once games start.'
      : 'This link holds your name and all 75 picks for \u201c' + ST.pool.name + '\u201d. Send it to whoever runs the pool; they paste it into the standings page. Keep a copy: it\u2019s also how you check your bracket later.';
    show('mylink', true);
    $('mylink').scrollIntoView({ behavior: 'smooth', block: 'start' });
    var late = lockState() === 'locked';
    $('late-msg').hidden = !late;
    store('mine.' + ST.poolId, url);
  }
  function picksCardData(entry) {
    var S = ST.S, p = entry.picks, f = S.games[S.final], memo = {};
    var semis = [], up = null;
    [S.games[f.a.game], S.games[f.b.game]].forEach(function (sg) { B.teamsIn(S, p, sg.i, memo).forEach(function (t) { semis.push(t == null ? '?' : seedName(t)); }); });
    for (var g = 0; g < B.GAMES; g++) {
      var w = B.winnerOf(S, p, g, memo); if (w == null) continue;
      var t = B.teamsIn(S, p, g, memo), o = t[0] === w ? t[1] : t[0], d = B.seedOf(S, w) - B.seedOf(S, o);
      if (d > 0 && (!up || d > up.d || (d === up.d && S.games[g].round > up.r))) up = { d: d, r: S.games[g].round, w: w, o: o };
    }
    var fin = B.teamsIn(S, p, S.final, memo);
    return {
      name: entry.name, pool: ST.pool.solo ? '' : ST.pool.name,
      champ: seedName(B.winnerOf(S, p, S.final, memo)), finalists: fin.map(function (t) { return t == null ? '?' : seedName(t); }), semis: semis,
      upset: up ? (hasRealNames() ? 'No. ' + B.seedOf(S, up.w) + ' ' : '') + names(up.w) + ' over ' + (hasRealNames() ? 'No. ' + B.seedOf(S, up.o) + ' ' : '') + names(up.o) + ' (' + B.ROUNDS[up.r].toLowerCase() + ')' : ''
    };
  }
  function picksCard(entry) { return Cards.drawPicks(document.createElement('canvas'), picksCardData(entry)); }

  // ---------- entry view ----------
  function drawEntry() {
    var e = ST.entry, R = ST.resultsJson ? results() : null;
    $('entry-h').textContent = ST.pool.solo ? e.name + '\u2019s bracket' : e.name + '\u2019s picks for \u201c' + ST.pool.name + '\u201d';
    var bits = [];
    var champ = B.winnerOf(ST.S, e.picks, ST.S.final);
    bits.push('<li><b>Champion pick:</b> ' + esc(champ == null ? 'none' : seedName(champ)) + '</li>');
    if (e.tb != null) bits.push('<li><b>Title game total points:</b> ' + e.tb + '</li>');
    if (e.time) bits.push('<li><b>Made:</b> ' + esc(fmtTime(e.time)) + (e.late ? ' <span class="flag">after the lock</span>' : '') + '</li>');
    if (R && R.played) {
      var sc = B.score(ST.S, ST.pool.rules, e.picks, R);
      bits.push('<li><b>Score:</b> ' + sc.points + ' points, ' + sc.correct + ' of ' + R.played + ' games right (max possible ' + sc.max + ')' + (ST.demo ? ' <span class="flag">demo results</span>' : '') + '</li>');
    } else bits.push('<li><b>Score:</b> games haven\u2019t started yet. Open this link again during the tournament to see it.</li>');
    $('entry-facts').innerHTML = bits.join('');
    show('entry-bad', !e.ok);
    $('entry-url').value = location.href;
    show('entry-edit', !lockState() || lockState() === 'open');
  }

  // ---------- standings ----------
  function entryKey(e) { return e.name.toLowerCase(); }
  async function addLinks(text) {
    var links = C.findLinks(text), added = 0, bad = 0, other = 0, replaced = 0, msgs = [];
    for (var i = 0; i < links.length; i++) {
      var r = await C.decode(links[i]);
      if (r.error) { bad++; continue; }
      var list = r.type === 'entry' ? [r.entry] : r.type === 'standings' ? r.entries : [];
      if (r.type === 'pool') continue;
      if (r.poolId !== ST.poolId) { other++; continue; }
      list.forEach(function (e) {
        var k = ST.entries.findIndex(function (x) { return entryKey(x) === entryKey(e); });
        if (k >= 0) {
          if (C.picksStr(ST.entries[k].picks) === C.picksStr(e.picks) && ST.entries[k].tb === e.tb) return;
          if (e.time >= ST.entries[k].time) { ST.entries[k] = e; replaced++; }
          return;
        }
        if (ST.entries.length < C.LIMITS.entries) { ST.entries.push(e); added++; }
      });
    }
    if (added) msgs.push('Added ' + added + (added === 1 ? ' entry' : ' entries') + '.');
    if (replaced) msgs.push('Updated ' + replaced + ' (a newer link for the same name).');
    if (other) msgs.push(other + ' link' + (other === 1 ? ' is' : 's are') + ' for a different pool and ' + (other === 1 ? 'was' : 'were') + ' skipped.');
    if (bad) msgs.push(bad + ' link' + (bad === 1 ? '' : 's') + ' couldn\u2019t be read (cut off when copied?).');
    if (!links.length) msgs.push('No picks links found. They look like ' + base() + '#e=...');
    if (!msgs.length) msgs.push('Those entries are already in the standings.');
    $('paste-msg').textContent = msgs.join(' ');
    if (added || replaced) { await saveStandings(); drawStandings(); }
  }
  async function saveStandings() {
    var h = await C.encodeStandings(ST.pool, ST.entries);
    try { history.replaceState(null, '', location.pathname + location.search + '#' + h); } catch (e) { /* ignore */ }
    $('st-url').value = linkFor(h);
    store('st.' + ST.poolId, h);
  }
  function drawStandings() {
    var R = results(), S = ST.S;
    var status;
    if (ST.demo) status = 'Showing made-up demo results so you can preview standings and awards. Real results replace them once games are played.';
    else if (!R.played) status = 'No games played yet. Scores appear here once the tournament starts on March 16, 2027; we post results after each session of games.';
    else status = 'Results through ' + R.played + ' of 75 games' + (ST.resultsJson && ST.resultsJson.updated ? ' (updated ' + ST.resultsJson.updated + ')' : '') + '.';
    if (!ST.pool.teams && ST.official.official && !sameLayout(ST.official.layout, ST.S.layout)) status += ' Heads-up: this pool was made before the official bracket and its Opening Round lines don\u2019t match, so some games can\u2019t be scored. Make a new pool link.';
    $('st-status').textContent = status;
    $('demo').textContent = ST.demo ? 'Back to real results' : 'Preview with made-up results';
    var rows = B.standings(S, ST.pool.rules, ST.entries, R);
    $('st-count').textContent = ST.entries.length + (ST.entries.length === 1 ? ' entry' : ' entries');
    if (!rows.length) { $('st-table').innerHTML = '<p class="small">No entries yet. Paste picks links above.</p>'; }
    else {
      $('st-table').innerHTML = '<table><thead><tr><th>#</th><th>Name</th><th class="n">Pts</th><th class="n">Max</th><th>Champion pick</th></tr></thead><tbody>' + rows.map(function (r) {
        var flags = (!r.entry.ok ? ' <span class="flag bad">edited link</span>' : '') + (r.entry.late ? ' <span class="flag">late</span>' : '');
        return '<tr><td>' + r.rank + '</td><td><a href="#" class="viewe" data-ix="' + r.ix + '">' + esc(r.entry.name) + '</a>' + flags + '</td><td class="n">' + r.score.points + '</td><td class="n">' + r.score.max +
          '</td><td class="' + (r.champ != null && !r.champAlive ? 'out' : '') + '">' + esc(r.champ == null ? '-' : seedName(r.champ)) + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
    var flagged = ST.entries.filter(function (e) { return !e.ok; }).length;
    $('st-flags').textContent = flagged ? flagged + ' link' + (flagged === 1 ? ' was' : 's were') + ' changed after it was made (the checksum doesn\u2019t match). Ask for a fresh link if that wasn\u2019t expected.' : '';
    drawAwards(R);
  }
  function drawAwards(R) {
    var list = B.awards(ST.S, ST.pool.rules, ST.entries.filter(function (e) { return e.ok; }), R, { teams: hasRealNames() ? teamsMap() : null });
    ST.awards = list;
    var box = $('awards');
    if (!list.length) { box.innerHTML = '<p class="small">Awards appear once there are entries and games have been played: Best Bracket, Biggest Upset Called, Cinderella Believer, Busted First, Hottest Start and Chalk Eater.</p>'; return; }
    box.innerHTML = '';
    list.forEach(function (a, i) {
      var c = Cards.drawAward(document.createElement('canvas'), { id: a.id, title: a.title, stat: a.stat, blurb: a.blurb, name: a.row.entry.name }, ST.pool.name + (ST.demo ? ' (demo)' : ''));
      var fig = document.createElement('figure'); fig.className = 'award';
      c.setAttribute('role', 'img'); c.setAttribute('aria-label', a.title + ': ' + a.row.entry.name + '. ' + a.stat);
      fig.appendChild(c);
      var cap = document.createElement('figcaption');
      cap.innerHTML = '<b>' + esc(a.title) + '</b>: ' + esc(a.row.entry.name) + '<br><button type="button" class="btn sm" data-award="' + i + '">Share picture</button>';
      fig.appendChild(cap); box.appendChild(fig);
    });
  }
  function teamsMap() { var m = {}; ST.S.slots.forEach(function (s, i) { m[s.id] = names(i); }); return m; }

  // ---------- create a pool ----------
  function rulesFromForm() {
    var pts = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return Math.max(0, Math.min(999, Math.round(+$('pt' + i).value || 0))); });
    return { pts: pts, upset: $('upset').checked };
  }
  function setPreset(k) {
    var p = B.PRESETS[k]; if (!p) return;
    p.pts.forEach(function (v, i) { $('pt' + i).value = v; }); $('upset').checked = p.upset;
  }
  function defaultLock() {
    var d = new Date(Date.UTC(2027, 2, 16, 22, 0)); // Tue Mar 16, 2027, 6:00 pm EDT: before the first Opening Round tip
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  async function createPool(ev) {
    ev.preventDefault();
    var msg = $('create-msg'); msg.textContent = '';
    var teams = null, layout = ST.official.layout;
    if ($('field-own').checked) {
      var f = B.parseField($('field-text').value, layout);
      if (f.error) { msg.textContent = f.error; $('field-text').focus(); return; }
      teams = f.teams; layout = f.layout;
    }
    var lockV = $('lock').value, lock = lockV ? new Date(lockV).getTime() : 0;
    if (lockV && !(lock > 0)) { msg.textContent = 'That lock time doesn\u2019t look right.'; return; }
    var pool = C.makePool({ name: $('pool-name').value, rules: rulesFromForm(), lock: lock, layout: layout, teams: teams });
    var h = await C.encodePool(pool), sh = await C.encodeStandings(pool, []);
    $('pool-url').value = linkFor(h);
    $('pool-play').href = '#' + h;
    $('pool-st').href = '#' + sh;
    $('pool-st-url').value = linkFor(sh);
    show('pool-made', true);
    store('st.' + C.poolId(pool), sh);
    $('pool-made').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- modes ----------
  function setMode(m) {
    ST.mode = m;
    document.body.setAttribute('data-mode', m);
    show('fill', m === 'pool'); show('entry', m === 'entry'); show('standings', m === 'standings');
    show('poolhead', m !== 'home'); show('home-intro', m === 'home');
    show('create', m === 'home'); show('pool-made', false);
  }
  function poolHead() {
    var p = ST.pool, r = p.rules, bits = [];
    $('ph-name').textContent = p.solo ? 'Your 2027 bracket' : p.name;
    if (!p.solo) {
      bits.push('Scoring: ' + r.pts.slice(1).join(', ') + ' points per round' + (r.pts[0] ? ' (Opening Round ' + r.pts[0] + ')' : ' (Opening Round not scored)') + (r.upset ? ', plus an upset bonus equal to the seed difference' : '') + '.');
      bits.push(p.lock ? (Date.now() > p.lock ? 'Locked ' : 'Picks lock ') + fmtTime(p.lock) + '.' : 'No lock time set.');
    }
    bits.push(p.teams ? 'Teams entered by the commissioner.' : ST.official.official ? 'Official field.' : 'Seeds are placeholders (like \u201cEast 1\u201d) until the field is announced on Selection Sunday, March 14, 2027.');
    $('ph-meta').textContent = bits.join(' ');
    var warn = '';
    if (!p.teams && ST.official.official && !sameLayout(ST.official.layout, p.layout)) warn = 'This link was made before the official bracket was posted, and its Opening Round lines don\u2019t match. Ask for a new link.';
    else if (ST.mode === 'pool' && lockState() === 'locked') warn = 'This pool locked ' + fmtTime(p.lock) + '. You can still fill in a bracket, but the commissioner will see it marked late.';
    $('ph-warn').textContent = warn; show('ph-warn', !!warn);
  }
  async function route() {
    var h = location.hash.replace(/^#/, '');
    $('linkerr').hidden = true;
    ST.demo = false;
    if (!h || h === 'fill' || h === 'pool' || !/^[pes]=/.test(h)) {
      ST.pool = null; ST.poolId = ''; ST.S = B.build(ST.official.layout);
      setMode('home'); sheetNote(); drawSheet();
      if (h === 'fill') startSolo();
      return;
    }
    var r = await C.decode(h);
    if (r.error) {
      setMode('home'); ST.pool = null; ST.S = B.build(ST.official.layout); sheetNote(); drawSheet();
      var why = { truncated: 'It looks cut off; copy the whole link again.', 'too-long': 'It\u2019s too long.', 'no-decompress': 'Your browser is too old to open it; try an up-to-date browser.', version: 'It was made by a newer version of this page; reload.' }[r.error] || 'It may have been changed or cut off.';
      $('linkerr').textContent = 'That bracket link couldn\u2019t be opened. ' + why; $('linkerr').hidden = false;
      return;
    }
    ST.pool = r.pool; ST.poolId = r.poolId; ST.S = B.build(r.pool.layout);
    if (r.type === 'pool') {
      setMode('pool');
      var d = load('draft.' + ST.poolId);
      ST.picks = d && Array.isArray(d.picks) && B.validPicks(ST.S, d.picks) ? d.picks : B.emptyPicks();
      $('pname').value = d && d.name || ''; $('tb').value = d && d.tb || '';
      $('fill-h').textContent = ST.pool.solo ? 'Fill in your bracket' : 'Make your picks';
      ST.tab = 0; refreshFill();
    } else if (r.type === 'entry') {
      setMode('entry'); ST.entry = r.entry; drawEntry(); drawSheet();
    } else {
      setMode('standings'); ST.entries = r.entries; $('st-url').value = linkFor(h);
      store('st.' + ST.poolId, h); drawStandings(); drawSheet();
    }
    poolHead(); sheetNote();
    window.scrollTo(0, 0);
  }
  async function startSolo() {
    var pool = C.makePool({ name: 'My bracket', solo: true, layout: ST.official.layout });
    location.hash = await C.encodePool(pool);
  }

  // ---------- wire up ----------
  function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }
  on('tabs', 'click', function (e) { var b = e.target.closest('[data-tab]'); if (!b) return; ST.tab = +b.getAttribute('data-tab'); drawTabs(); drawGames(); });
  on('games', 'click', function (e) {
    var b = e.target.closest('button[data-g]'); if (!b) return;
    var g = +b.getAttribute('data-g'), s = +b.getAttribute('data-s'), wasPicked = ST.picks[g] === s;
    pick(g, s);
    if (!wasPicked) {
      // move along to the next region when this one is done
      var games = ST.S.games.filter(function (x) { return ST.tab < 4 ? x.region === ST.tab : x.round >= 5; });
      if (games.every(function (x) { return ST.picks[x.i]; }) && ST.tab < 4) { ST.tab++; drawTabs(); drawGames(); $('tabs').scrollIntoView({ behavior: 'smooth', block: 'start' }); toast('On to the ' + TABS()[ST.tab]); }
    }
  });
  on('sheet', 'click', function (e) {
    if (ST.mode !== 'pool') return;
    var gEl = e.target.closest('g[data-g]'); if (!gEl) return;
    var g = +gEl.getAttribute('data-g'), s = +gEl.getAttribute('data-s') + 1;
    if (B.teamsIn(ST.S, ST.picks, g)[s - 1] == null) return;
    pick(g, s);
  });
  on('autofill', 'click', autofill);
  on('clear', 'click', function () { if (!B.countPicks(ST.picks) || confirm('Clear all your picks?')) { ST.picks = B.emptyPicks(); refreshFill(); } });
  on('pname', 'input', function () { saveDraft(); show('mylink', false); });
  on('tb', 'input', function () { saveDraft(); show('mylink', false); });
  on('finish', 'click', finish);
  on('mylink-copy', 'click', function () { copyText($('mylink-url').value, 'Picks link copied'); });
  on('mylink-share', 'click', function () { shareLink($('mylink-url').value, 'My bracket picks', ST.pool.solo ? 'My 2027 bracket' : 'My picks for ' + ST.pool.name); });
  on('mylink-img', 'click', function () { shareImage(picksCard(ST.entry), 'my-bracket-' + slug(ST.entry.name) + '.png', 'My 2027 bracket. Make yours: ' + toolUrl()); });
  on('mylink-open', 'click', function () { location.href = $('mylink-url').value; });
  on('entry-copy', 'click', function () { copyText(location.href, 'Link copied'); });
  on('entry-img', 'click', function () { shareImage(picksCard(ST.entry), 'bracket-' + slug(ST.entry.name) + '.png', 'My 2027 bracket. Make yours: ' + toolUrl()); });
  on('entry-edit', 'click', async function () {
    store('draft.' + ST.poolId, { picks: ST.entry.picks, name: ST.entry.name, tb: ST.entry.tb == null ? '' : String(ST.entry.tb) });
    location.hash = await C.encodePool(ST.pool);
  });
  on('entry-join', 'click', async function () { location.hash = await C.encodePool(ST.pool); });
  on('entry-add', 'click', async function () {
    var prev = load('st.' + ST.poolId), entries = [];
    if (prev) { var r = await C.decode(prev); if (!r.error) entries = r.entries; }
    var k = entries.findIndex(function (x) { return entryKey(x) === entryKey(ST.entry); });
    if (k >= 0) entries[k] = ST.entry; else entries.push(ST.entry);
    location.hash = await C.encodeStandings(ST.pool, entries);
  });
  on('paste-add', 'click', function () { addLinks($('paste').value).then(function () { $('paste').value = ''; }); });
  on('st-copy', 'click', function () { copyText($('st-url').value, 'Standings link copied'); });
  on('st-share', 'click', function () { shareLink($('st-url').value, ST.pool.name + ' standings', ST.pool.name + ' standings (for bragging rights)'); });
  on('st-pool', 'click', async function () { copyText(linkFor(await C.encodePool(ST.pool)), 'Pool link copied: send it to new players'); });
  on('demo', 'click', function () { ST.demo = !ST.demo; drawStandings(); });
  on('st-table', 'click', async function (e) {
    var a = e.target.closest('a.viewe'); if (!a) return; e.preventDefault();
    var en = ST.entries[+a.getAttribute('data-ix')];
    window.open(linkFor(await C.encodeEntry(ST.pool, en)), '_blank', 'noopener');
  });
  on('awards', 'click', function (e) {
    var b = e.target.closest('button[data-award]'); if (!b) return;
    var a = ST.awards[+b.getAttribute('data-award')], c = b.closest('figure').querySelector('canvas');
    shareImage(c, slug(a.title) + '-' + slug(a.row.entry.name) + '.png', a.title + ': ' + a.row.entry.name + ' in ' + ST.pool.name + '. Make yours: ' + toolUrl());
  });
  on('create-form', 'submit', createPool);
  on('preset', 'change', function () { setPreset($('preset').value); });
  ['pt0', 'pt1', 'pt2', 'pt3', 'pt4', 'pt5', 'pt6', 'upset'].forEach(function (id) { on(id, 'input', function () { $('preset').value = 'custom'; }); });
  on('field-own', 'change', function () { show('field-box', $('field-own').checked); });
  on('field-off', 'change', function () { show('field-box', $('field-own').checked); });
  on('field-tmpl', 'click', function () { $('field-text').value = B.fieldTemplate(ST.official.layout); $('field-text').focus(); });
  on('pool-copy', 'click', function () { copyText($('pool-url').value, 'Pool link copied'); });
  on('pool-share', 'click', function () { shareLink($('pool-url').value, 'Join my bracket pool', 'Join my bracket pool (for bragging rights): '); });
  on('pool-st-copy', 'click', function () { copyText($('pool-st-url').value, 'Standings link copied: bookmark it'); });
  on('start-solo', 'click', startSolo);
  on('start-solo2', 'click', startSolo);
  on('print', 'click', function () { window.print(); });
  on('print2', 'click', function () { window.print(); });
  on('pdfview', 'click', function () { location.href = 'print.html' + (location.hash || ''); });
  on('share-tool', 'click', function () { shareLink(toolUrl(), 'Printable 76-team bracket', 'Free printable 76-team bracket for 2027, plus a no-account pool: '); });
  on('go-home', 'click', function (e) { e.preventDefault(); history.pushState(null, '', location.pathname + location.search); route(); });
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeprint', drawSheet);

  // ---------- start ----------
  setPreset('classic');
  $('lock').value = defaultLock();
  function getJson(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  Promise.all([
    getJson('field-2027.json').then(function (j) { ST.official = B.readFieldFile(j); }).catch(function () { /* keep defaults */ }),
    getJson('results-2027.json').then(function (j) { ST.resultsJson = j; }).catch(function () { ST.resultsJson = null; })
  ]).then(route).then(function () { document.documentElement.setAttribute('data-ready', '1'); });
  window.__bracket = ST;
})();
