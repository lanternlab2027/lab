/* Fantasy League Awards: tiny client for Sleeper's public, read-only API (https://docs.sleeper.com).
   Called straight from the visitor's browser. No key, no auth, no backend.
   Docs ask callers to stay under 1000 calls/minute; a full season load is ~40 calls, 4 at a time. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sleeper = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BASE = 'https://api.sleeper.app/v1';
  var MAX_WEEKS = 18;

  function SleeperError(msg, code) { var e = new Error(msg); e.code = code; return e; }

  function client(fetchImpl) {
    var f = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(typeof self !== 'undefined' ? self : this) : null);
    var calls = 0;
    async function get(path) {
      calls++;
      var r;
      try { r = await f(BASE + path, { headers: { Accept: 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer' }); }
      catch (e) { throw SleeperError("Couldn't reach Sleeper. Check your connection and try again.", 'network'); }
      if (r.status === 404) return null;
      if (r.status === 429) throw SleeperError('Sleeper is rate-limiting requests right now. Wait a minute and try again.', 'rate');
      if (!r.ok) throw SleeperError('Sleeper returned an error (' + r.status + '). Try again in a moment.', 'http');
      var text = await r.text();
      if (!text || text === 'null') return null;
      try { return JSON.parse(text); } catch (e) { throw SleeperError('Sleeper sent back something unexpected.', 'parse'); }
    }

    async function pool(items, size, fn) {
      var out = new Array(items.length), i = 0;
      async function worker() { while (i < items.length) { var k = i++; out[k] = await fn(items[k], k); } }
      var ws = [];
      for (var n = 0; n < Math.min(size, items.length); n++) ws.push(worker());
      await Promise.all(ws);
      return out;
    }

    /* Username -> { user, season, leagues[] } (NFL leagues for the season; falls back one season if empty). */
    async function findLeagues(username, season) {
      var u = await get('/user/' + encodeURIComponent(username.trim()));
      if (!u || !u.user_id) throw SleeperError('No Sleeper user called "' + username.trim() + '". Check the spelling, or paste your league ID instead.', 'nouser');
      var state = await get('/state/nfl');
      var s = String(season || (state && (state.league_season || state.season)) || new Date().getFullYear());
      var leagues = await get('/user/' + u.user_id + '/leagues/nfl/' + s) || [];
      if (!leagues.length && !season) {
        s = String(Number(s) - 1);
        leagues = await get('/user/' + u.user_id + '/leagues/nfl/' + s) || [];
      }
      return { user: u, season: s, state: state, leagues: leagues };
    }

    /* Everything the awards need for one league. onProgress(done, total). */
    async function loadLeague(leagueId, onProgress) {
      var id = String(leagueId).trim();
      var base = await Promise.all([get('/league/' + id), get('/league/' + id + '/users'), get('/league/' + id + '/rosters'), get('/state/nfl')]);
      var league = base[0];
      if (!league || !league.league_id) throw SleeperError('No Sleeper league with ID ' + id + '. Copy it from the league settings or the league URL.', 'noleague');
      if (league.sport && league.sport !== 'nfl') throw SleeperError('That league is not an NFL fantasy football league.', 'sport');
      var state = base[3] || {};
      var current = String(league.season) === String(state.season) && (state.season_type === 'regular' || state.season_type === 'post');
      var last = current ? Math.min(MAX_WEEKS, Math.max(0, Number(state.week) || 0)) : MAX_WEEKS;
      var lastScored = league.settings && Number(league.settings.last_scored_leg);
      if (!current && lastScored > 0) last = Math.min(MAX_WEEKS, lastScored);
      var weeks = [];
      for (var w = 1; w <= last; w++) weeks.push(w);
      var total = weeks.length * 2, done = 0;
      if (onProgress) onProgress(0, total);
      var tick = function (x) { done++; if (onProgress) onProgress(done, total); return x; };
      var jobs = [];
      weeks.forEach(function (wk) { jobs.push(['m', wk]); jobs.push(['t', wk]); });
      var res = await pool(jobs, 4, function (j) {
        return get('/league/' + id + (j[0] === 'm' ? '/matchups/' : '/transactions/') + j[1]).then(tick);
      });
      var matchups = {}, transactions = {};
      jobs.forEach(function (j, k) { (j[0] === 'm' ? matchups : transactions)[j[1]] = res[k] || []; });
      return {
        league: league, users: base[1] || [], rosters: base[2] || [], state: state,
        matchups: matchups, transactions: transactions,
        liveWeek: current ? Number(state.week) || null : null
      };
    }

    return { get: get, findLeagues: findLeagues, loadLeague: loadLeague, calls: function () { return calls; } };
  }

  /* League IDs are long digit strings; anything else is treated as a username.
     Also accepts a pasted sleeper.com/leagues/<id> URL. */
  function parseInput(raw) {
    var s = String(raw || '').trim();
    var m = s.match(/leagues?\/(\d{6,})/);
    if (m) return { kind: 'league', value: m[1] };
    if (/^\d{6,}$/.test(s)) return { kind: 'league', value: s };
    s = s.replace(/^@/, '');
    if (/^[A-Za-z0-9_.\-]{1,40}$/.test(s)) return { kind: 'user', value: s };
    return { kind: 'bad', value: s };
  }

  return { client: client, parseInput: parseInput, BASE: BASE };
});
