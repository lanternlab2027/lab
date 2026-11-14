/* Fantasy League Awards: pure award computations from Sleeper API responses.
   UMD: runs in the browser (window.Awards) and in Node tests (require). No DOM, no network. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Awards = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function round2(x) { return Math.round(x * 100) / 100; }
  function fmtPts(x) { return round2(x).toFixed(2); }
  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function initials(name) {
    var parts = String(name || '?').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  /* roster_id -> { rosterId, name, manager, initials } */
  function buildTeams(users, rosters) {
    var byUser = {};
    (users || []).forEach(function (u) { if (u && u.user_id) byUser[u.user_id] = u; });
    var teams = {};
    (rosters || []).forEach(function (r) {
      var u = r.owner_id ? byUser[r.owner_id] : null;
      var display = u && u.display_name ? String(u.display_name) : '';
      var teamName = u && u.metadata && u.metadata.team_name ? String(u.metadata.team_name).trim() : '';
      var name = teamName || display || ('Team ' + r.roster_id);
      teams[r.roster_id] = {
        rosterId: r.roster_id,
        name: name,
        manager: display && display !== name ? display : '',
        initials: initials(name)
      };
    });
    return teams;
  }

  function teamOf(teams, rid) {
    return teams[rid] || { rosterId: rid, name: 'Team ' + rid, manager: '', initials: 'T' + rid };
  }

  /* One team's line for a week. custom_points (commissioner override) wins over points. */
  function scoreRow(m) {
    var pts = m.custom_points !== null && m.custom_points !== undefined ? num(m.custom_points) : num(m.points);
    var bench = null;
    if (m.players_points && typeof m.players_points === 'object' && Array.isArray(m.players)) {
      var starters = {};
      (m.starters || []).forEach(function (p) { if (p && p !== '0') starters[p] = true; });
      bench = 0;
      m.players.forEach(function (p) { if (!starters[p]) bench += num(m.players_points[p]); });
      bench = round2(bench);
    }
    return { rosterId: m.roster_id, matchupId: m.matchup_id == null ? null : m.matchup_id, points: round2(pts), bench: bench };
  }

  function weekHasScores(matchups) {
    return Array.isArray(matchups) && matchups.some(function (m) { return scoreRow(m).points > 0; });
  }

  /* Rows plus head-to-head games (pairs sharing a matchup_id). */
  function weekGames(matchups) {
    var rows = (matchups || []).map(scoreRow);
    var groups = {};
    rows.forEach(function (r) {
      if (r.matchupId === null) return;
      (groups[r.matchupId] = groups[r.matchupId] || []).push(r);
    });
    var games = [];
    Object.keys(groups).sort(function (a, b) { return a - b; }).forEach(function (k) {
      var g = groups[k];
      if (g.length !== 2) return; // byes / odd data: no head-to-head result
      var a = g[0], b = g[1];
      if (b.points > a.points || (b.points === a.points && b.rosterId < a.rosterId)) { var t = a; a = b; b = t; }
      games.push({ matchupId: Number(k), winner: a, loser: b, margin: round2(a.points - b.points), tie: a.points === b.points });
    });
    var oppOf = {};
    games.forEach(function (g) { oppOf[g.winner.rosterId] = g.loser; oppOf[g.loser.rosterId] = g.winner; });
    return { rows: rows, games: games, oppOf: oppOf };
  }

  function byPointsDesc(a, b) { return b.points - a.points || a.rosterId - b.rosterId; }

  /* Weekly awards for one week's /matchups/<week> response. */
  function weeklyAwards(matchups, teams) {
    var wg = weekGames(matchups);
    var rows = wg.rows.filter(function (r) { return r.points > 0 || r.matchupId !== null; });
    if (!rows.length || !weekHasScores(matchups)) return null;
    var ranked = rows.slice().sort(byPointsDesc);
    var rankOf = {};
    ranked.forEach(function (r) { rankOf[r.rosterId] = 1 + ranked.filter(function (x) { return x.points > r.points; }).length; });
    var n = ranked.length;
    function t(rid) { return teamOf(teams, rid); }
    function opp(rid) { return wg.oppOf[rid] || null; }

    var out = { teamCount: n, ranked: ranked.map(function (r) { return { team: t(r.rosterId), points: r.points, rank: rankOf[r.rosterId] }; }) };

    var hi = ranked[0];
    out.high = { team: t(hi.rosterId), points: hi.points, opp: opp(hi.rosterId) ? t(opp(hi.rosterId).rosterId) : null, oppPoints: opp(hi.rosterId) ? opp(hi.rosterId).points : null };
    var lo = ranked[ranked.length - 1];
    out.low = { team: t(lo.rosterId), points: lo.points, opp: opp(lo.rosterId) ? t(opp(lo.rosterId).rosterId) : null, oppPoints: opp(lo.rosterId) ? opp(lo.rosterId).points : null };

    var decided = wg.games.filter(function (g) { return !g.tie; });
    if (decided.length) {
      var big = decided.slice().sort(function (a, b) { return b.margin - a.margin || a.matchupId - b.matchupId; })[0];
      out.blowout = { winner: t(big.winner.rosterId), loser: t(big.loser.rosterId), wPts: big.winner.points, lPts: big.loser.points, margin: big.margin };
      var close = decided.slice().sort(function (a, b) { return a.margin - b.margin || a.matchupId - b.matchupId; })[0];
      out.heartbreak = { loser: t(close.loser.rosterId), winner: t(close.winner.rosterId), lPts: close.loser.points, wPts: close.winner.points, margin: close.margin };

      // Luckiest win: the winner with the lowest score (would have lost to the most teams).
      var lucky = decided.slice().sort(function (a, b) { return a.winner.points - b.winner.points || a.matchupId - b.matchupId; })[0];
      var luckyLossesAllPlay = ranked.filter(function (r) { return r.points > lucky.winner.points; }).length;
      out.luckiest = {
        team: t(lucky.winner.rosterId), points: lucky.winner.points, rank: rankOf[lucky.winner.rosterId],
        opp: t(lucky.loser.rosterId), oppPoints: lucky.loser.points,
        oppWasLowest: lucky.loser.rosterId === lo.rosterId,
        wouldHaveLostTo: luckyLossesAllPlay
      };
      // Unluckiest: the loser with the highest score.
      var unlucky = decided.slice().sort(function (a, b) { return b.loser.points - a.loser.points || a.matchupId - b.matchupId; })[0];
      out.unluckiest = {
        team: t(unlucky.loser.rosterId), points: unlucky.loser.points, rank: rankOf[unlucky.loser.rosterId],
        opp: t(unlucky.winner.rosterId), oppPoints: unlucky.winner.points,
        wouldHaveBeaten: ranked.filter(function (r) { return r.points < unlucky.loser.points; }).length
      };
    }

    var withBench = rows.filter(function (r) { return r.bench !== null; });
    if (withBench.length) {
      var b = withBench.slice().sort(function (x, y) { return y.bench - x.bench || x.rosterId - y.rosterId; })[0];
      out.bench = { team: t(b.rosterId), bench: b.bench, points: b.points, lost: !!(opp(b.rosterId) && opp(b.rosterId).points > b.points) };
    }
    return out;
  }

  /* Weeks counted as regular season: before settings.playoff_week_start (if set). */
  function regularSeasonWeeks(league, weeks) {
    var start = league && league.settings ? num(league.settings.playoff_week_start) : 0;
    return weeks.filter(function (w) { return !start || w < start; });
  }

  /* Season awards. matchupsByWeek: { week: [...] }, weeks: weeks to include (completed, regular season).
     transactionsByWeek: { week: [...] } (all loaded weeks are counted). */
  function seasonAwards(matchupsByWeek, weeks, teams, transactionsByWeek) {
    var S = {};
    function st(rid) {
      if (!S[rid]) S[rid] = { team: teamOf(teams, rid), w: 0, l: 0, t: 0, pf: 0, pa: 0, apW: 0, apL: 0, apT: 0, games: 0, scores: [], bench: 0, benchKnown: false, weeklyHighs: 0 };
      return S[rid];
    }
    Object.keys(teams).forEach(function (rid) { st(Number(rid)); });
    var bestWeek = null;
    var used = [];
    weeks.slice().sort(function (a, b) { return a - b; }).forEach(function (w) {
      var mu = matchupsByWeek[w];
      if (!weekHasScores(mu)) return;
      used.push(w);
      var wg = weekGames(mu);
      var rows = wg.rows.filter(function (r) { return r.matchupId !== null; });
      rows.forEach(function (r) {
        var s = st(r.rosterId);
        s.scores.push(r.points);
        if (r.bench !== null) { s.bench += r.bench; s.benchKnown = true; }
        rows.forEach(function (o) {
          if (o.rosterId === r.rosterId) return;
          if (r.points > o.points) s.apW++; else if (r.points < o.points) s.apL++; else s.apT++;
        });
        if (!bestWeek || r.points > bestWeek.points) bestWeek = { rosterId: r.rosterId, points: r.points, week: w };
      });
      if (rows.length) {
        var top = rows.slice().sort(byPointsDesc)[0];
        st(top.rosterId).weeklyHighs++;
      }
      wg.games.forEach(function (g) {
        var a = st(g.winner.rosterId), b = st(g.loser.rosterId);
        a.games++; b.games++;
        a.pf += g.winner.points; a.pa += g.loser.points;
        b.pf += g.loser.points; b.pa += g.winner.points;
        if (g.tie) { a.t++; b.t++; } else { a.w++; b.l++; }
      });
    });

    var list = Object.keys(S).map(function (k) { return S[k]; }).filter(function (s) { return s.games > 0 || s.scores.length > 0; });
    if (!list.length) return null;

    list.forEach(function (s) {
      s.pf = round2(s.pf); s.pa = round2(s.pa); s.bench = round2(s.bench);
      var g = s.w + s.l + s.t;
      s.winPct = g ? (s.w + 0.5 * s.t) / g : 0;
      var ap = s.apW + s.apL + s.apT;
      s.apPct = ap ? (s.apW + 0.5 * s.apT) / ap : 0;
      s.luck = s.winPct - s.apPct;
      s.ppg = s.scores.length ? s.scores.reduce(function (a, b) { return a + b; }, 0) / s.scores.length : 0;
      var last = s.scores.slice(-3);
      s.recent = last.length ? last.reduce(function (a, b) { return a + b; }, 0) / last.length : 0;
    });

    var maxPpg = Math.max.apply(null, list.map(function (s) { return s.ppg; })) || 1;
    var maxRecent = Math.max.apply(null, list.map(function (s) { return s.recent; })) || 1;
    // Power score (0-100): 50% all-play win %, 30% points per game vs league best, 20% last-3-weeks average vs league best.
    list.forEach(function (s) {
      s.power = Math.round(1000 * (0.5 * s.apPct + 0.3 * (s.ppg / maxPpg) + 0.2 * (s.recent / maxRecent))) / 10;
    });

    var standings = list.slice().sort(function (a, b) { return b.winPct - a.winPct || b.pf - a.pf || a.team.rosterId - b.team.rosterId; });
    standings.forEach(function (s, i) { s.standing = i + 1; });
    var power = list.slice().sort(function (a, b) { return b.power - a.power || b.pf - a.pf || a.team.rosterId - b.team.rosterId; });
    power.forEach(function (s, i) { s.powerRank = i + 1; });
    var allPlay = list.slice().sort(function (a, b) { return b.apPct - a.apPct || b.pf - a.pf || a.team.rosterId - b.team.rosterId; });
    var byLuck = list.slice().sort(function (a, b) { return b.luck - a.luck || a.team.rosterId - b.team.rosterId; });

    var out = {
      weeks: used,
      standings: standings, power: power, allPlay: allPlay,
      luckiest: byLuck[0], unluckiest: byLuck[byLuck.length - 1],
      bestWeek: bestWeek ? { team: teamOf(teams, bestWeek.rosterId), points: bestWeek.points, week: bestWeek.week } : null,
      mostPf: list.slice().sort(function (a, b) { return b.pf - a.pf || a.team.rosterId - b.team.rosterId; })[0]
    };
    var benchers = list.filter(function (s) { return s.benchKnown; });
    if (benchers.length) out.bench = benchers.slice().sort(function (a, b) { return b.bench - a.bench || a.team.rosterId - b.team.rosterId; });

    out.moves = transactionCounts(transactionsByWeek || {}, teams);
    return out;
  }

  /* Completed transactions per roster. Trades count once for every roster involved;
     waiver claims and free-agent moves count once for the roster that made them. */
  function transactionCounts(transactionsByWeek, teams) {
    var C = {};
    function c(rid) { if (!C[rid]) C[rid] = { team: teamOf(teams, rid), trades: 0, waivers: 0, freeAgents: 0, total: 0 }; return C[rid]; }
    var seen = {};
    Object.keys(transactionsByWeek).forEach(function (w) {
      (transactionsByWeek[w] || []).forEach(function (tx) {
        if (!tx || tx.status !== 'complete') return;
        if (tx.transaction_id) { if (seen[tx.transaction_id]) return; seen[tx.transaction_id] = true; }
        var rids = Array.isArray(tx.roster_ids) ? tx.roster_ids : [];
        if (tx.type === 'trade') rids.forEach(function (r) { c(r).trades++; c(r).total++; });
        else if (tx.type === 'waiver' && rids.length) { c(rids[0]).waivers++; c(rids[0]).total++; }
        else if (tx.type === 'free_agent' && rids.length) { c(rids[0]).freeAgents++; c(rids[0]).total++; }
      });
    });
    var list = Object.keys(C).map(function (k) { return C[k]; });
    if (!list.length) return null;
    list.sort(function (a, b) { return b.total - a.total || b.trades - a.trades || a.team.rosterId - b.team.rosterId; });
    var tradeKing = list.slice().sort(function (a, b) { return b.trades - a.trades || b.total - a.total || a.team.rosterId - b.team.rosterId; })[0];
    return { ranked: list, king: list[0], tradeKing: tradeKing.trades > 0 ? tradeKing : null };
  }

  function record(s) { return s.w + '-' + s.l + (s.t ? '-' + s.t : ''); }
  function apRecord(s) { return s.apW + '-' + s.apL + (s.apT ? '-' + s.apT : ''); }

  /* Plain-text recap for the group chat. */
  function recapText(opts) {
    var L = [], wk = opts.weekly, se = opts.season;
    var head = opts.leagueName || 'Our league';
    if (wk) {
      L.push('\ud83c\udfc6 ' + head + ': Week ' + opts.week + ' awards' + (opts.live ? ' (week still in progress)' : ''));
      L.push('Highest scorer: ' + wk.high.team.name + ' (' + fmtPts(wk.high.points) + ')');
      if (wk.blowout) L.push('Biggest blowout: ' + wk.blowout.winner.name + ' beat ' + wk.blowout.loser.name + ' by ' + fmtPts(wk.blowout.margin));
      if (wk.heartbreak) L.push('Heartbreak: ' + wk.heartbreak.loser.name + ' lost to ' + wk.heartbreak.winner.name + ' by ' + fmtPts(wk.heartbreak.margin));
      if (wk.bench) L.push('Bench warmer: ' + wk.bench.team.name + ' left ' + fmtPts(wk.bench.bench) + ' on the bench');
      if (wk.luckiest) L.push('Luckiest win: ' + wk.luckiest.team.name + ' won with ' + fmtPts(wk.luckiest.points) + ' (' + ordinal(wk.luckiest.rank) + ' of ' + wk.teamCount + ')');
      if (wk.unluckiest) L.push('Unluckiest: ' + wk.unluckiest.team.name + ' scored ' + fmtPts(wk.unluckiest.points) + ' (' + ordinal(wk.unluckiest.rank) + ' of ' + wk.teamCount + ') and still lost');
      L.push('Lowest scorer: ' + wk.low.team.name + ' (' + fmtPts(wk.low.points) + ')');
    }
    if (se) {
      if (L.length) L.push('');
      L.push('\ud83d\udcca ' + head + ': season so far (' + se.weeks.length + ' week' + (se.weeks.length === 1 ? '' : 's') + ')');
      L.push('Power rankings: ' + se.power.slice(0, 5).map(function (s, i) { return (i + 1) + '. ' + s.team.name; }).join('  '));
      L.push('Luckiest manager: ' + se.luckiest.team.name + ' (' + record(se.luckiest) + ', all-play ' + apRecord(se.luckiest) + ')');
      L.push('Unluckiest manager: ' + se.unluckiest.team.name + ' (' + record(se.unluckiest) + ', all-play ' + apRecord(se.unluckiest) + ')');
      if (se.moves) L.push('Trade & waiver king: ' + se.moves.king.team.name + ' (' + se.moves.king.total + ' moves)');
      if (se.bench) L.push('Season bench boss: ' + se.bench[0].team.name + ' (' + fmtPts(se.bench[0].bench) + ' pts on the bench)');
    }
    L.push('');
    L.push(opts.link ? 'All the award cards + make your own league\'s: ' + opts.link : 'Made free at lanternlab2027.github.io/lab/awards');
    return L.join('\n');
  }

  return {
    buildTeams: buildTeams, scoreRow: scoreRow, weekGames: weekGames, weekHasScores: weekHasScores,
    weeklyAwards: weeklyAwards, seasonAwards: seasonAwards, transactionCounts: transactionCounts,
    regularSeasonWeeks: regularSeasonWeeks, recapText: recapText,
    fmtPts: fmtPts, ordinal: ordinal, record: record, apRecord: apRecord, initials: initials
  };
});
