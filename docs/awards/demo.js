/* Fantasy League Awards: deterministic made-up league shaped like Sleeper's API responses.
   Used by the "Try a sample league" button and by the test fixtures. All names are invented. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AwardsDemo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MANAGERS = [
    ['dana_r', 'Dana R', 'Tuesday Waiver Gods'],
    ['benito88', 'Benito88', 'Bench Mob'],
    ['cleo.park', 'Cleo Park', ''],
    ['maya_c', 'Maya C', 'Fourth & Forever'],
    ['jt_ito', 'JT Ito', 'Hail Mary Poppins'],
    ['ruthless_ruiz', 'Ruthless Ruiz', 'The Commish Did It'],
    ['sam_v', 'Sam V', 'Kicker Is A Person Too'],
    ['priya_k', 'Priya K', 'Red Zone Regulars'],
    ['nolan_b', 'Nolan B', 'Garbage Time Legends'],
    ['oz_q', 'Oz Q', '']
  ];

  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* opts: { season, leagueId, weeks (completed), liveWeek (partial, optional), playoffStart, orphan (bool), seed } */
  function build(opts) {
    opts = opts || {};
    var season = String(opts.season || '2025');
    var leagueId = String(opts.leagueId || '1180000000000000001');
    var weeks = opts.weeks || 17;
    var playoffStart = opts.playoffStart || 15;
    var R = rng(opts.seed || 20251);
    var n = MANAGERS.length;

    var users = [], rosters = [];
    MANAGERS.forEach(function (m, i) {
      var uid = String(900000000000000000 + (i + 1) * 1111);
      var orphan = opts.orphan && i === n - 1;
      if (!orphan) users.push({ user_id: uid, username: m[0], display_name: m[1], avatar: null, metadata: m[2] ? { team_name: m[2] } : {}, is_owner: i === 0 });
      var players = [];
      for (var p = 0; p < 15; p++) players.push(String(1000 + i * 100 + p));
      rosters.push({ roster_id: i + 1, owner_id: orphan ? null : uid, league_id: leagueId, players: players, starters: players.slice(0, 9), settings: {} });
    });
    var skill = MANAGERS.map(function (_, i) { return 0.8 + 0.4 * ((i * 7) % n) / (n - 1); });

    // Round-robin schedule (circle method) for the regular season; seeded pairs in playoffs.
    function pairs(w) {
      var ids = []; for (var i = 1; i <= n; i++) ids.push(i);
      var fixed = ids[0], rest = ids.slice(1), k = (w - 1) % (n - 1);
      rest = rest.slice(k).concat(rest.slice(0, k));
      var order = [fixed].concat(rest), out = [];
      for (var j = 0; j < n / 2; j++) out.push([order[j], order[n - 1 - j]]);
      return out;
    }

    function teamWeek(rid, w, partial) {
      var r = rosters[rid - 1], pp = {}, starters = r.players.slice();
      // shuffle a few bench/starter swaps per week so starters vary
      for (var s = 0; s < 3; s++) { var a = Math.floor(R() * 9), b = 9 + Math.floor(R() * 6), t = starters[a]; starters[a] = starters[b]; starters[b] = t; }
      starters = starters.slice(0, 9);
      var total = 0, isStarter = {};
      starters.forEach(function (p) { isStarter[p] = true; });
      r.players.forEach(function (p) {
        var v = Math.max(0, (R() * 22 + R() * 8 - 3) * skill[rid - 1]);
        if (!isStarter[p]) v *= 0.4; // benches usually score less than starters
        if (partial && R() < 0.6) v = 0;
        v = Math.round(v * 100) / 100;
        pp[p] = v;
      });
      var starters_points = starters.map(function (p) { return pp[p]; });
      starters.forEach(function (p) { total += pp[p]; });
      return { players: r.players.slice(), starters: starters, starters_points: starters_points, players_points: pp, points: Math.round(total * 100) / 100, custom_points: null };
    }

    var matchups = {}, transactions = {};
    var totalWeeks = weeks + (opts.liveWeek ? 1 : 0);
    for (var w = 1; w <= totalWeeks; w++) {
      var partial = opts.liveWeek && w === totalWeeks;
      var list = [];
      if (w < playoffStart) {
        pairs(w).forEach(function (pr, mi) {
          pr.forEach(function (rid) { var tw = teamWeek(rid, w, partial); tw.roster_id = rid; tw.matchup_id = mi + 1; list.push(tw); });
        });
      } else {
        // playoffs: top 4 by roster id order play; everyone else has matchup_id null
        for (var rid = 1; rid <= n; rid++) {
          var tw = teamWeek(rid, w, partial); tw.roster_id = rid;
          tw.matchup_id = rid <= 4 ? (rid <= 2 ? 1 : 2) : null;
          list.push(tw);
        }
      }
      list.sort(function (a, b) { return a.roster_id - b.roster_id; });
      matchups[w] = list;

      var tx = [], k = Math.floor(R() * 5) + (w < 4 ? 3 : 0);
      for (var q = 0; q < k; q++) {
        var who = 1 + Math.floor(R() * n);
        // a couple of managers are much busier on the wire
        if (R() < 0.35) who = 2;
        var type = R() < 0.6 ? 'waiver' : 'free_agent', adds = {}, drops = {};
        adds[String(5000 + w * 50 + q)] = who; drops[rosters[who - 1].players[14]] = who;
        tx.push({ transaction_id: String(7000000 + w * 100 + q), type: type, status: R() < 0.85 ? 'complete' : 'failed', roster_ids: [who], creator: users[0].user_id, adds: adds, drops: drops, leg: w, week: w, consenter_ids: [who], waiver_budget: [], draft_picks: [], status_updated: 1700000000000 + w * 1000 + q, settings: type === 'waiver' ? { waiver_bid: Math.floor(R() * 20) } : null, metadata: null, created: 1700000000000 + w * 1000 + q });
      }
      if (w % 4 === 2) {
        var a = 1 + (w % n), b = 1 + ((w + 3) % n), ad = {}, dr = {};
        ad[rosters[a - 1].players[10]] = b; ad[rosters[b - 1].players[11]] = a;
        dr[rosters[a - 1].players[10]] = a; dr[rosters[b - 1].players[11]] = b;
        tx.push({ transaction_id: String(7000000 + w * 100 + 99), type: 'trade', status: 'complete', roster_ids: [a, b], consenter_ids: [a, b], creator: users[0].user_id, adds: ad, drops: dr, leg: w, waiver_budget: [], draft_picks: [], settings: null, metadata: null, created: 1700000000000 + w * 1000 + 99, status_updated: 1700000000000 + w * 1000 + 99 });
      }
      transactions[w] = tx;
    }
    for (var e = totalWeeks + 1; e <= 18; e++) { matchups[e] = []; transactions[e] = []; }

    // Records on rosters (Sleeper keeps these too); not used by the awards math.
    var league = {
      league_id: leagueId, name: opts.name || 'Sunday Scaries League', season: season, sport: 'nfl', season_type: 'regular',
      status: opts.liveWeek ? 'in_season' : 'complete', total_rosters: n, previous_league_id: null, draft_id: '1180000000000000099', avatar: null,
      settings: { playoff_week_start: playoffStart, num_teams: n, last_scored_leg: opts.liveWeek ? weeks : totalWeeks },
      scoring_settings: {}, roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN']
    };
    var state = opts.liveWeek
      ? { week: totalWeeks, leg: totalWeeks, season: season, season_type: 'regular', league_season: season, previous_season: String(Number(season) - 1), season_start_date: season + '-09-04', display_week: totalWeeks, league_create_season: season }
      : { week: 10, leg: 10, season: String(Number(season) + 1), season_type: 'regular', league_season: String(Number(season) + 1), previous_season: season, display_week: 10, league_create_season: String(Number(season) + 1) };
    return { league: league, users: users, rosters: rosters, state: state, matchups: matchups, transactions: transactions, liveWeek: opts.liveWeek ? totalWeeks : null };
  }

  /* Map of API path -> JSON body, for routing fetches in tests. */
  function routes(bundle, username) {
    var id = bundle.league.league_id, out = {};
    out['/league/' + id] = bundle.league;
    out['/league/' + id + '/users'] = bundle.users;
    out['/league/' + id + '/rosters'] = bundle.rosters;
    out['/state/nfl'] = bundle.state;
    Object.keys(bundle.matchups).forEach(function (w) { out['/league/' + id + '/matchups/' + w] = bundle.matchups[w]; });
    Object.keys(bundle.transactions).forEach(function (w) { out['/league/' + id + '/transactions/' + w] = bundle.transactions[w]; });
    if (username) {
      var u = bundle.users.filter(function (x) { return x.username === username; })[0];
      if (u) out['/user/' + username] = { user_id: u.user_id, username: u.username, display_name: u.display_name, avatar: null };
    }
    return out;
  }

  return { build: build, routes: routes, MANAGERS: MANAGERS };
});
