/* Fantasy League Awards: UI wiring. No storage, no analytics. Network: Sleeper's public API, and Kit only if the visitor signs up. */
(function () {
  'use strict';
  var A = window.Awards, C = window.AwardCards, S = window.Sleeper;
  var $ = function (s) { return document.querySelector(s); };
  var api = S.client();

  var state = { bundle: null, teams: null, played: [], completed: [], live: null, mode: 'week', week: null, leagueId: null, demo: false, username: null, specs: [], canvases: [], recap: '' };

  function say(msg, err) {
    var s = $('#status'); s.textContent = msg || ''; s.className = 'status' + (err ? ' err' : '');
    if (err) {
      var demo = document.createElement('button'); demo.type = 'button'; demo.className = 'linkbtn'; demo.textContent = 'See a sample league instead';
      demo.addEventListener('click', showSample);
      s.appendChild(document.createTextNode(' ')); s.appendChild(demo);
    }
  }

  // ---------- share links: ?ref= passthrough (URL only, nothing stored) ----------
  // Opened with ?ref=X -> links this visitor shares carry ?ref=share-X (then share2-X, share3-X...),
  // so a later analytics pass can follow the chain. No ref -> ?ref=share.
  var APP_URL = 'https://lanternlab2027.github.io/lab/awards/';
  function inRef() {
    var r = '';
    try { r = new URLSearchParams(location.search).get('ref') || ''; } catch (e) { r = ''; }
    return r.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  }
  function nextRef() {
    var r = inRef();
    if (!r) return 'share';
    var m = /^share(\d*)(?:-(.+))?$/.exec(r);
    if (m) return 'share' + ((m[1] ? +m[1] : 1) + 1) + (m[2] ? '-' + m[2] : '');
    return 'share-' + r;
  }
  // The visitor's own address bar keeps the ref they arrived with.
  function ownQuery() {
    var r = inRef();
    return '?league=' + encodeURIComponent(state.leagueId) + '&week=' + state.week + (r ? '&ref=' + encodeURIComponent(r) : '');
  }
  // What they send to the league: a deep link to this league and week (or the app, for the sample).
  function shareLink() {
    var q = state.demo || !state.leagueId ? '?' : '?league=' + encodeURIComponent(state.leagueId) + '&week=' + state.week + '&';
    return APP_URL + q + 'ref=' + encodeURIComponent(nextRef());
  }
  function progress(done, total) {
    var p = $('#progress'); p.hidden = !total;
    if (total) p.firstElementChild.style.width = Math.round(100 * done / total) + '%';
  }
  function busy(on) { $('#go').disabled = on; $('#sample').disabled = on; $('#peek').disabled = on; }

  // ---------- lookup ----------
  async function lookup(raw) {
    var inp = S.parseInput(raw);
    if (inp.kind === 'bad' || !inp.value) { say('Enter a Sleeper username or a league ID (the long number).', true); return; }
    $('#pick').hidden = true;
    if (inp.kind === 'league') return loadLeague(inp.value);
    busy(true); say('Finding ' + inp.value + '\u2019s leagues\u2026');
    try {
      var res = await api.findLeagues(inp.value);
      state.username = inp.value;
      showLeagues(res);
    } catch (e) { say(e.message, true); }
    finally { busy(false); }
  }

  function showLeagues(res) {
    var sel = $('#season'), cur = Number((res.state && (res.state.league_season || res.state.season)) || res.season);
    sel.innerHTML = '';
    for (var y = cur; y >= cur - 3; y--) { var o = document.createElement('option'); o.value = y; o.textContent = y; sel.appendChild(o); }
    sel.value = res.season;
    var box = $('#leagues'); box.innerHTML = '';
    if (!res.leagues.length) {
      say('No NFL leagues for ' + (res.user.display_name || res.user.username) + ' in ' + res.season + '. Try another season.', true);
    } else {
      say(res.leagues.length === 1 ? '' : 'Pick a league.');
    }
    res.leagues.forEach(function (lg) {
      var b = document.createElement('button'); b.type = 'button';
      var n = document.createElement('span'); n.textContent = lg.name || 'Unnamed league';
      var m = document.createElement('small'); m.textContent = (lg.total_rosters || '?') + ' teams \u00b7 ' + lg.season;
      b.appendChild(n); b.appendChild(m);
      b.addEventListener('click', function () { loadLeague(lg.league_id); });
      box.appendChild(b);
    });
    $('#pick').hidden = false;
    if (res.leagues.length === 1) loadLeague(res.leagues[0].league_id);
  }

  async function changeSeason() {
    if (!state.username) return;
    busy(true); say('Loading ' + $('#season').value + ' leagues\u2026');
    try { showLeagues(await api.findLeagues(state.username, $('#season').value)); }
    catch (e) { say(e.message, true); }
    finally { busy(false); }
  }

  async function loadLeague(id) {
    busy(true); say('Loading league\u2026'); progress(0, 1);
    try {
      var b = await api.loadLeague(id, function (d, t) { progress(d, t); say('Loading matchups and transactions\u2026 ' + d + ' of ' + t); });
      useBundle(b, false);
    } catch (e) { say(e.message, true); }
    finally { busy(false); progress(0, 0); }
  }

  // ---------- data -> view ----------
  function useBundle(b, demo) {
    state.bundle = b; state.demo = demo; state.leagueId = b.league.league_id;
    state.teams = A.buildTeams(b.users, b.rosters);
    state.played = Object.keys(b.matchups).map(Number).filter(function (w) { return A.weekHasScores(b.matchups[w]); }).sort(function (x, y) { return x - y; });
    state.live = b.liveWeek && state.played.indexOf(b.liveWeek) >= 0 ? b.liveWeek : null;
    state.completed = state.played.filter(function (w) { return w !== state.live; });
    if (!state.played.length) {
      say('No scores yet for ' + (b.league.name || 'this league') + ' (' + b.league.season + '). Awards show up after week 1 is played.', true);
      $('#results').hidden = true; return;
    }
    var qs = new URLSearchParams(location.search), want = Number(qs.get('week'));
    state.week = !demo && want && state.played.indexOf(want) >= 0 ? want : (state.completed.length ? state.completed[state.completed.length - 1] : state.played[state.played.length - 1]);
    var ws = $('#week'); ws.innerHTML = '';
    var po = Number(b.league.settings && b.league.settings.playoff_week_start) || 0;
    state.played.forEach(function (w) {
      var o = document.createElement('option'); o.value = w;
      o.textContent = 'Week ' + w + (w === state.live ? ' (in progress)' : po && w >= po ? ' (playoffs)' : '');
      ws.appendChild(o);
    });
    ws.value = state.week;
    $('#lg-name').textContent = b.league.name || 'Your league';
    $('#lg-meta').textContent = b.league.season + ' \u00b7 ' + Object.keys(state.teams).length + ' teams' + (demo ? ' \u00b7 made-up sample league' : ' \u00b7 league ' + b.league.league_id);
    $('#results').hidden = false; $('#pick').hidden = true;
    say(demo ? 'Showing a made-up sample league. Enter your own username or league ID to make yours.' : '');
    if (!demo) {
      try { history.replaceState(null, '', ownQuery()); } catch (e) { /* file:// etc. */ }
    }
    render();
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function seasonData() {
    var weeks = A.regularSeasonWeeks(state.bundle.league, state.completed);
    return A.seasonAwards(state.bundle.matchups, weeks, state.teams, state.bundle.transactions);
  }

  function render() {
    var b = state.bundle, meta = { leagueName: b.league.name || 'Our league', week: state.week, live: state.week === state.live, season: b.league.season };
    var wk = A.weeklyAwards(b.matchups[state.week], state.teams);
    var se = seasonData();
    var weekMode = state.mode === 'week';
    $('#tab-week').setAttribute('aria-selected', String(weekMode));
    $('#tab-season').setAttribute('aria-selected', String(!weekMode));
    $('#week-wrap').hidden = !weekMode;
    $('#live-note').hidden = !(weekMode && meta.live);
    state.specs = weekMode ? C.weeklyDeck(wk, meta) : C.seasonDeck(se, meta);
    state.recap = A.recapText({ leagueName: meta.leagueName, week: state.week, live: meta.live, weekly: weekMode ? wk : null, season: weekMode ? null : se, link: shareLink() });
    if (!weekMode && !se) state.recap = 'No completed regular-season weeks yet.\n\nWeekly award cards for your league: ' + shareLink();
    $('#recap').value = state.recap;
    var deck = $('#deck'); deck.innerHTML = ''; state.canvases = [];
    if (!state.specs.length) {
      var p = document.createElement('p'); p.className = 'hint';
      p.textContent = weekMode ? 'No awards for this week.' : 'Season awards appear once a regular-season week is complete.';
      deck.appendChild(p);
    }
    state.specs.forEach(function (spec, i) {
      var fig = document.createElement('figure'); fig.className = 'card';
      var cv = document.createElement('canvas');
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', spec.title + (spec.team ? ': ' + spec.team : ''));
      C.render(cv, spec);
      var cap = document.createElement('figcaption');
      var lbl = document.createElement('span'); lbl.textContent = spec.title;
      var share = document.createElement('button'); share.type = 'button'; share.className = 'btn small'; share.textContent = 'Share';
      var save = document.createElement('button'); save.type = 'button'; save.className = 'btn small ghost'; save.textContent = 'Save';
      share.addEventListener('click', function () { shareOne(i); });
      save.addEventListener('click', function () { saveOne(i); });
      var btns = document.createElement('div'); btns.className = 'card-btns'; btns.appendChild(share); btns.appendChild(save);
      cap.appendChild(lbl); cap.appendChild(btns); fig.appendChild(cv); fig.appendChild(cap); deck.appendChild(fig);
      state.canvases.push(cv);
    });
    $('#zip-all').disabled = !state.specs.length;
  }

  // ---------- share / save ----------
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function fileName(i) {
    var tag = state.mode === 'week' ? 'week-' + state.week : 'season-' + state.bundle.league.season;
    return 'awards-' + tag + '-' + String(i + 1).padStart(2, '0') + '-' + slug(state.specs[i].title) + '.png';
  }
  function blobOf(i) { return new Promise(function (res) { state.canvases[i].toBlob(res, 'image/png'); }); }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  async function saveOne(i) { download(await blobOf(i), fileName(i)); }
  async function shareFiles(files) {
    if (navigator.canShare && navigator.share && navigator.canShare({ files: files })) {
      try { await navigator.share({ files: files, title: 'Fantasy League Awards', text: (state.bundle && state.bundle.league.name ? state.bundle.league.name + ' awards. ' : '') + 'All the cards + make your own league\'s: ' + shareLink() }); return true; }
      catch (e) { if (e && e.name === 'AbortError') return true; }
    }
    return false;
  }
  async function shareOne(i) {
    var blob = await blobOf(i), file = new File([blob], fileName(i), { type: 'image/png' });
    if (!(await shareFiles([file]))) download(blob, fileName(i));
  }
  async function zipAll() {
    var btn = $('#zip-all'), t = btn.textContent; btn.disabled = true; btn.textContent = 'Zipping\u2026';
    try {
      var zip = new window.JSZip();
      for (var i = 0; i < state.canvases.length; i++) zip.file(fileName(i), await blobOf(i));
      download(await zip.generateAsync({ type: 'blob' }), 'league-awards-' + (state.mode === 'week' ? 'week-' + state.week : 'season') + '.zip');
    } finally { btn.disabled = false; btn.textContent = t; }
  }
  async function shareAll() {
    var files = [];
    for (var i = 0; i < state.canvases.length; i++) files.push(new File([await blobOf(i)], fileName(i), { type: 'image/png' }));
    if (!(await shareFiles(files))) zipAll();
  }
  async function copyRecap() {
    var ok = false;
    try { await navigator.clipboard.writeText(state.recap); ok = true; } catch (e) {
      var ta = $('#recap'); ta.select();
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    }
    $('#copy-status').textContent = ok ? 'Recap copied. Paste it in the group chat.' : 'Couldn\u2019t copy automatically. Here it is:\n' + state.recap;
  }

  // ---------- wiring ----------
  $('#lookup').addEventListener('submit', function (e) { e.preventDefault(); lookup($('#q').value); });
  function showSample() { state.username = null; useBundle(window.AwardsDemo.build(), true); }
  $('#sample').addEventListener('click', showSample);
  $('#peek').addEventListener('click', showSample);
  $('#season').addEventListener('change', changeSeason);
  $('#week').addEventListener('change', function () {
    state.week = Number($('#week').value);
    if (!state.demo) { try { history.replaceState(null, '', ownQuery()); } catch (e) { /* ignore */ } }
    render();
  });
  $('#tab-week').addEventListener('click', function () { state.mode = 'week'; render(); });
  $('#tab-season').addEventListener('click', function () { state.mode = 'season'; render(); });
  $('#copy').addEventListener('click', copyRecap);
  $('#zip-all').addEventListener('click', zipAll);
  var sa = $('#share-all');
  try { sa.hidden = !(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })); } catch (e) { sa.hidden = true; }
  sa.addEventListener('click', shareAll);
  $('#reset').addEventListener('click', function () {
    state.bundle = null; $('#results').hidden = true; $('#deck').innerHTML = ''; $('#q').value = ''; say('');
    try { history.replaceState(null, '', location.pathname + (inRef() ? '?ref=' + encodeURIComponent(inRef()) : '')); } catch (e) { /* ignore */ }
    $('#top').scrollIntoView({ behavior: 'smooth' }); $('#q').focus();
  });

  // ---------- optional email signup: sends only the email and the league ID ----------
  (function () {
    var KIT_KEY = '9OgTfHEbtX6FB0NWVjkgyg'; var TAG = '25878869';
    var f = $('#signup-form'), msg = $('#signup-msg');
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = $('#signup-email').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Enter a valid email address.'; return; }
      var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing up\u2026';
      try {
        var r = await fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
          body: JSON.stringify({ api_key: KIT_KEY, email: email, fields: { league_id: state.demo ? '' : String(state.leagueId || '') } })
        });
        if (!r.ok) throw new Error('status ' + r.status);
        f.innerHTML = '<b>You\u2019re in.</b> Watch your inbox for this league\u2019s awards.';
        msg.textContent = '';
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Email me the awards';
        msg.textContent = 'Sorry, that didn\u2019t go through. Please try again in a moment.';
      }
    });
  })();

  // deep link: ?league=<id>&week=<n>
  var pre = new URLSearchParams(location.search).get('league');
  if (pre && /^\d{6,}$/.test(pre)) { $('#q').value = pre; loadLeague(pre); }

  Object.defineProperty(window, '__awardsState', { get: function () { return state; } });
})();
