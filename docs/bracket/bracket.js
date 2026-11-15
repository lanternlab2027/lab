/* 76-Team Bracket: bracket structure, picks, advancement, scoring and awards.
 * No dependencies; works in browsers (window.Bracket) and Node (module.exports) for tests.
 *
 * Layout = 4 regions in national-semifinal order (region 0 plays region 1, 2 plays 3), each with a code
 * letter, a name and the seed lines that are decided by an Opening Round game.
 * Published 2027 plan: every region's 16 and 12 lines, plus two 11 lines and two 15 lines = 12 games.
 * Which regions get the 11 and 15 games (and the semifinal pairings) are only known on Selection Sunday,
 * so DEFAULT_LAYOUT is a labelled placeholder that field-2027.json (or a pasted field) overrides.
 *
 * Team slot ids: region code + seed + a/b for Opening Round teams, e.g. "E1", "E16a", "E16b".
 * Game codes (used by results-2027.json):
 *   OR.E.16   Opening Round game for East's 16 line
 *   R1.E.1    first round, East pod headed by the 1 seed (pods: 1,8,5,4,6,3,7,2)
 *   R2.E.1    second round, East quarter headed by the 1 (quarters: 1,4,3,2)
 *   R3.E.1    regional semifinal, top half of East (halves: 1,2)
 *   R4.E      regional final, East
 *   R5.EW     national semifinal between regions E and W
 *   R6        championship
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Bracket = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var POD = [[1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]];
  var ROUNDS = ['Opening Round', 'First round', 'Second round', 'Regional semifinals', 'Regional finals', 'National semifinals', 'Championship'];
  var ROUND_SHORT = ['Opening', 'Round of 64', 'Round of 32', 'Last 16', 'Last 8', 'Semifinals', 'Final'];
  var DEFAULT_LAYOUT = [
    { code: 'E', name: 'East', playIn: [11, 12, 16] },
    { code: 'W', name: 'West', playIn: [12, 15, 16] },
    { code: 'S', name: 'South', playIn: [11, 12, 16] },
    { code: 'M', name: 'Midwest', playIn: [12, 15, 16] }
  ];
  var TEAMS = 76, GAMES = 75, OR_GAMES = 12;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- layout ----------
  // Returns '' if the layout is a valid 76-team layout, else a short reason.
  function checkLayout(L) {
    if (!Array.isArray(L) || L.length !== 4) return 'need 4 regions';
    var codes = {}, total = 0;
    for (var i = 0; i < 4; i++) {
      var r = L[i];
      if (!r || !/^[A-Z]$/.test(r.code || '') || codes[r.code]) return 'region codes must be 4 different capital letters';
      codes[r.code] = 1;
      if (!r.name || String(r.name).length > 24) return 'bad region name';
      if (!Array.isArray(r.playIn)) return 'bad playIn';
      var seen = {};
      for (var k = 0; k < r.playIn.length; k++) {
        var s = r.playIn[k];
        if (!(s >= 1 && s <= 16 && s === Math.floor(s)) || seen[s]) return 'bad playIn seed';
        seen[s] = 1;
      }
      total += r.playIn.length;
    }
    return total === OR_GAMES ? '' : 'need exactly 12 Opening Round games (got ' + total + ')';
  }
  function normLayout(L) {
    return L.map(function (r) { return { code: r.code, name: String(r.name), playIn: r.playIn.slice().sort(function (a, b) { return a - b; }) }; });
  }
  // Compact text form used inside links: "E=East:11.12.16,W=West:12.15.16,..."
  function layoutText(L) {
    return normLayout(L).map(function (r) { return r.code + '=' + r.name.replace(/[,:=]/g, ' ') + ':' + r.playIn.join('.'); }).join(',');
  }
  function parseLayoutText(t) {
    var parts = String(t || '').split(',');
    if (parts.length !== 4) return null;
    var L = [];
    for (var i = 0; i < 4; i++) {
      var m = /^([A-Z])=([^:]{1,24}):([0-9.]*)$/.exec(parts[i]);
      if (!m) return null;
      L.push({ code: m[1], name: m[2], playIn: m[3] ? m[3].split('.').map(Number) : [] });
    }
    return checkLayout(L) ? null : normLayout(L);
  }

  // ---------- structure ----------
  var cache = {};
  function build(layout) {
    var L = normLayout(layout || DEFAULT_LAYOUT);
    var key = layoutText(L);
    if (cache[key]) return cache[key];
    var err = checkLayout(L);
    if (err) throw new Error('layout: ' + err);
    var slots = [], slotIx = {}, games = [], gameIx = {};
    function addSlot(r, seed, sub) {
      var id = L[r].code + seed + sub;
      slotIx[id] = slots.length;
      slots.push({ id: id, region: r, seed: seed, sub: sub });
      return slotIx[id];
    }
    // slots in "template order": region by region, seeds 1..16, a before b
    L.forEach(function (reg, r) {
      for (var s = 1; s <= 16; s++) {
        if (reg.playIn.indexOf(s) >= 0) { addSlot(r, s, 'a'); addSlot(r, s, 'b'); } else addSlot(r, s, '');
      }
    });
    function addGame(code, round, region, a, b) {
      gameIx[code] = games.length;
      games.push({ i: games.length, code: code, round: round, region: region, a: a, b: b, next: -1, nextSide: 0 });
      return gameIx[code];
    }
    // round 0: Opening Round
    L.forEach(function (reg, r) {
      reg.playIn.forEach(function (s) {
        addGame('OR.' + reg.code + '.' + s, 0, r, { slot: slotIx[reg.code + s + 'a'] }, { slot: slotIx[reg.code + s + 'b'] });
      });
    });
    function seedSrc(r, s) {
      var reg = L[r];
      return reg.playIn.indexOf(s) >= 0 ? { game: gameIx['OR.' + reg.code + '.' + s] } : { slot: slotIx[reg.code + s] };
    }
    var r1 = [], r2 = [], r3 = [], r4 = [];
    L.forEach(function (reg, r) {
      r1[r] = POD.map(function (p) { return addGame('R1.' + reg.code + '.' + p[0], 1, r, seedSrc(r, p[0]), seedSrc(r, p[1])); });
    });
    var QHEAD = [1, 4, 3, 2], HHEAD = [1, 2];
    L.forEach(function (reg, r) {
      r2[r] = [0, 1, 2, 3].map(function (q) { return addGame('R2.' + reg.code + '.' + QHEAD[q], 2, r, { game: r1[r][2 * q] }, { game: r1[r][2 * q + 1] }); });
    });
    L.forEach(function (reg, r) {
      r3[r] = [0, 1].map(function (h) { return addGame('R3.' + reg.code + '.' + HHEAD[h], 3, r, { game: r2[r][2 * h] }, { game: r2[r][2 * h + 1] }); });
    });
    L.forEach(function (reg, r) { r4[r] = addGame('R4.' + reg.code, 4, r, { game: r3[r][0] }, { game: r3[r][1] }); });
    var s1 = addGame('R5.' + L[0].code + L[1].code, 5, -1, { game: r4[0] }, { game: r4[1] });
    var s2 = addGame('R5.' + L[2].code + L[3].code, 5, -1, { game: r4[2] }, { game: r4[3] });
    addGame('R6', 6, -1, { game: s1 }, { game: s2 });
    games.forEach(function (g) {
      [g.a, g.b].forEach(function (src, side) { if (src.game != null) { games[src.game].next = g.i; games[src.game].nextSide = side; } });
    });
    var S = { layout: L, key: key, slots: slots, slotIx: slotIx, games: games, gameIx: gameIx, final: games.length - 1 };
    cache[key] = S;
    return S;
  }

  function seedOf(S, slot) { return slot == null ? null : S.slots[slot].seed; }
  function placeholder(S, slot) {
    var t = S.slots[slot];
    return S.layout[t.region].name + ' ' + t.seed + t.sub;
  }
  // field: { teams: { slotId: name } } or null -> display name for a slot
  function teamName(S, field, slot) {
    if (slot == null) return '';
    var id = S.slots[slot].id;
    var n = field && field.teams && field.teams[id];
    return n ? String(n) : placeholder(S, slot);
  }

  // ---------- picks: array of 75 values, 0 = no pick, 1 = top (a) side, 2 = bottom (b) side ----------
  function emptyPicks() { var p = []; for (var i = 0; i < GAMES; i++) p.push(0); return p; }
  function srcTeam(S, picks, src, memo) { return src.slot != null ? src.slot : winnerOf(S, picks, src.game, memo); }
  function winnerOf(S, picks, g, memo) {
    if (memo && memo[g] !== undefined) return memo[g];
    var p = picks[g], gm = S.games[g], w = null;
    if (p === 1) w = srcTeam(S, picks, gm.a, memo);
    else if (p === 2) w = srcTeam(S, picks, gm.b, memo);
    if (memo) memo[g] = w;
    return w;
  }
  // [teamA, teamB] for game g given picks (null where the feeder game isn't picked)
  function teamsIn(S, picks, g, memo) {
    var gm = S.games[g];
    return [srcTeam(S, picks, gm.a, memo), srcTeam(S, picks, gm.b, memo)];
  }
  function allWinners(S, picks) {
    var memo = {}, out = [];
    for (var g = 0; g < GAMES; g++) out.push(winnerOf(S, picks, g, memo));
    return out;
  }
  // Set a pick and clear any later pick that was relying on the team that just got knocked out.
  function setPick(S, picks, g, side) {
    var before = allWinners(S, picks), next = picks.slice();
    next[g] = side;
    var memo = {};
    for (var d = 0; d < GAMES; d++) {
      if (d === g) continue;
      if (next[d] && before[d] != null) {
        var t = teamsIn(S, next, d, memo)[next[d] - 1];
        if (t !== before[d]) { next[d] = 0; memo = {}; }
      }
    }
    return next;
  }
  // Pick a team (slot) to win game g, if it's one of the two teams there.
  function pickTeam(S, picks, g, slot) {
    var t = teamsIn(S, picks, g);
    if (t[0] === slot) return setPick(S, picks, g, 1);
    if (t[1] === slot) return setPick(S, picks, g, 2);
    return picks;
  }
  function countPicks(picks) { var n = 0; for (var i = 0; i < picks.length; i++) if (picks[i]) n++; return n; }
  function validPicks(S, picks) {
    if (!Array.isArray(picks) || picks.length !== GAMES) return false;
    for (var g = 0; g < GAMES; g++) {
      if (picks[g] !== 0 && picks[g] !== 1 && picks[g] !== 2) return false;
      if (picks[g]) { var t = teamsIn(S, picks, g); if (t[picks[g] - 1] == null) return false; }
    }
    return true;
  }

  // 2 bits per game -> 19 bytes
  function packPicks(picks) {
    var bytes = new Uint8Array(Math.ceil(GAMES / 4));
    for (var g = 0; g < GAMES; g++) bytes[g >> 2] |= (picks[g] & 3) << ((g & 3) * 2);
    return bytes;
  }
  function unpackPicks(bytes) {
    if (!bytes || bytes.length !== Math.ceil(GAMES / 4)) return null;
    var p = [];
    for (var g = 0; g < GAMES; g++) { var v = (bytes[g >> 2] >> ((g & 3) * 2)) & 3; if (v === 3) return null; p.push(v); }
    for (var k = GAMES; k < bytes.length * 4; k++) if ((bytes[k >> 2] >> ((k & 3) * 2)) & 3) return null;
    return p;
  }

  // ---------- results ----------
  // results JSON: { winners: { gameCode: slotId }, championshipTotal: n|null }
  // -> { win: [slot|null per game], total: n|null, played: count, bad: [codes that didn't apply] }
  function readResults(S, json) {
    var win = [], bad = [], played = 0;
    for (var g = 0; g < GAMES; g++) win.push(null);
    var w = (json && json.winners) || {};
    // resolve in game order so feeders are known before later rounds
    for (g = 0; g < GAMES; g++) {
      var code = S.games[g].code;
      if (!Object.prototype.hasOwnProperty.call(w, code)) continue;
      var slot = S.slotIx[w[code]];
      var t = actualTeams(S, win, g);
      if (slot != null && (t[0] === slot || t[1] === slot)) { win[g] = slot; played++; }
      else bad.push(code);
    }
    Object.keys(w).forEach(function (c) { if (S.gameIx[c] == null) bad.push(c); });
    var tot = json && json.championshipTotal;
    return { win: win, total: (typeof tot === 'number' && tot > 0 && tot < 1000) ? tot : null, played: played, bad: bad };
  }
  function actualTeams(S, win, g) {
    var gm = S.games[g];
    var f = function (src) { return src.slot != null ? src.slot : win[src.game]; };
    return [f(gm.a), f(gm.b)];
  }
  function eliminated(S, R) {
    var out = {};
    for (var g = 0; g < GAMES; g++) if (R.win[g] != null) { var t = actualTeams(S, R.win, g); out[t[0] === R.win[g] ? t[1] : t[0]] = g; }
    return out; // slot -> game index where it lost
  }

  // ---------- scoring ----------
  // rules: { pts: [7 numbers, one per round], upset: true|false }
  var PRESETS = {
    classic: { label: 'Doubling: 1, 2, 4, 8, 16, 32 (Opening Round 1)', pts: [1, 1, 2, 4, 8, 16, 32], upset: false },
    tens: { label: 'Tens: 10, 20, 40, 80, 160, 320 (Opening Round 5)', pts: [5, 10, 20, 40, 80, 160, 320], upset: false },
    upset: { label: 'Doubling plus upset bonus (seed difference)', pts: [1, 1, 2, 4, 8, 16, 32], upset: true },
    flat: { label: 'One point per correct pick', pts: [1, 1, 1, 1, 1, 1, 1], upset: false }
  };
  function checkRules(r) {
    if (!r || !Array.isArray(r.pts) || r.pts.length !== 7) return false;
    for (var i = 0; i < 7; i++) if (!(r.pts[i] >= 0 && r.pts[i] <= 999 && r.pts[i] === Math.floor(r.pts[i]))) return false;
    return true;
  }
  function score(S, rules, picks, R, elim) {
    elim = elim || eliminated(S, R);
    var memo = {}, pts = 0, correct = 0, wrong = 0, possible = 0, byRound = [0, 0, 0, 0, 0, 0, 0], upsetPts = 0;
    for (var g = 0; g < GAMES; g++) {
      var mine = winnerOf(S, picks, g, memo), gm = S.games[g];
      if (R.win[g] != null) {
        if (mine === R.win[g]) {
          var t = actualTeams(S, R.win, g), loser = t[0] === R.win[g] ? t[1] : t[0];
          var bonus = rules.upset ? Math.max(0, seedOf(S, R.win[g]) - seedOf(S, loser)) : 0;
          pts += rules.pts[gm.round] + bonus; upsetPts += bonus; correct++; byRound[gm.round]++;
        } else if (mine != null) wrong++;
      } else if (mine != null && elim[mine] == null) {
        possible += rules.pts[gm.round];
      }
    }
    return { points: pts, correct: correct, wrong: wrong, max: pts + possible, byRound: byRound, upsetPts: upsetPts };
  }
  // entries: [{ name, picks, tb, time, ... }] -> sorted rows with rank (ties share a rank)
  function standings(S, rules, entries, R) {
    var elim = eliminated(S, R);
    var rows = entries.map(function (e, ix) {
      var sc = score(S, rules, e.picks, R, elim);
      var champ = winnerOf(S, e.picks, S.final);
      return { entry: e, ix: ix, score: sc, champ: champ, champAlive: champ != null && elim[champ] == null, tbDiff: (R.total != null && e.tb != null) ? Math.abs(e.tb - R.total) : null };
    });
    rows.sort(function (a, b) {
      if (b.score.points !== a.score.points) return b.score.points - a.score.points;
      var ta = a.tbDiff == null ? 1e9 : a.tbDiff, tb = b.tbDiff == null ? 1e9 : b.tbDiff;
      if (ta !== tb) return ta - tb;
      if (b.score.max !== a.score.max) return b.score.max - a.score.max;
      return String(a.entry.name).localeCompare(String(b.entry.name));
    });
    rows.forEach(function (r, i) {
      var p = rows[i - 1];
      r.rank = (p && p.score.points === r.score.points && p.tbDiff === r.tbDiff) ? p.rank : i + 1;
    });
    return rows;
  }

  // ---------- awards ----------
  // Returns [{ id, title, blurb, row, stat }] for awards that have a winner. Needs results to say much.
  function awards(S, rules, entries, R, field) {
    var out = [];
    if (!entries.length) return out;
    var rows = standings(S, rules, entries, R), elim = eliminated(S, R);
    var nm = function (slot) { return teamName(S, field, slot); };
    var real = !!(field && field.teams && Object.keys(field.teams).length);
    var seedTxt = function (slot) { return real ? 'No. ' + seedOf(S, slot) + ' ' + nm(slot) : nm(slot); };
    var done = R.win[S.final] != null;
    function best(list, keyFn) { // highest key; ties go to the better standings row
      var top = null, k = null;
      list.forEach(function (r) { var v = keyFn(r); if (v == null) return; if (top == null || cmp(v, k) > 0) { top = r; k = v; } });
      return top ? { row: top, key: k } : null;
    }
    function cmp(a, b) { a = [].concat(a); b = [].concat(b); for (var i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1; } return 0; }

    if (R.played > 0) {
      var lead = rows[0];
      out.push({ id: 'best', title: done ? 'Best Bracket' : 'Top of the Pool (so far)', row: lead,
        stat: lead.score.points + ' points, ' + lead.score.correct + ' of ' + R.played + ' games right',
        blurb: done ? 'Finished first in the pool.' : 'Leading the pool right now.' });

      var up = best(rows, function (r) {
        var memo = {}, bestK = null, bestG = -1;
        for (var g = 0; g < GAMES; g++) {
          if (R.win[g] == null || winnerOf(S, r.entry.picks, g, memo) !== R.win[g]) continue;
          var t = actualTeams(S, R.win, g), loser = t[0] === R.win[g] ? t[1] : t[0], d = seedOf(S, R.win[g]) - seedOf(S, loser);
          if (d > 0 && (bestK == null || cmp([d, S.games[g].round], bestK) > 0)) { bestK = [d, S.games[g].round]; bestG = g; }
        }
        if (bestK) r._up = bestG;
        return bestK;
      });
      if (up) {
        var g = up.row._up, t = actualTeams(S, R.win, g), loser = t[0] === R.win[g] ? t[1] : t[0];
        out.push({ id: 'upset', title: 'Biggest Upset Called', row: up.row,
          stat: seedTxt(R.win[g]) + ' over ' + seedTxt(loser),
          blurb: ROUNDS[S.games[g].round] + '. Called it before tip-off.' });
      }

      var cin = best(rows, function (r) {
        var memo = {}, k = null, gg = -1;
        for (var g = 0; g < GAMES; g++) {
          if (S.games[g].round < 1 || R.win[g] == null || winnerOf(S, r.entry.picks, g, memo) !== R.win[g]) continue;
          var s = seedOf(S, R.win[g]);
          if (s >= 10 && (k == null || cmp([S.games[g].round, s], k) > 0)) { k = [S.games[g].round, s]; gg = g; }
        }
        if (k) r._cin = gg;
        return k;
      });
      if (cin) {
        var cg = cin.row._cin, nextRound = S.games[cg].round + 1;
        out.push({ id: 'cinderella', title: 'Cinderella Believer', row: cin.row,
          stat: 'Rode ' + seedTxt(R.win[cg]) + ' into the ' + (ROUNDS[nextRound] || 'title').toLowerCase(),
          blurb: 'Trusted a double-digit seed and was right.' });
      }

      var bust = best(rows, function (r) {
        var g = r.champ == null ? null : elim[r.champ];
        return g == null ? null : [-S.games[g].round, -g, r.score.wrong];
      });
      if (bust) {
        var bg = elim[bust.row.champ];
        out.push({ id: 'busted', title: 'Busted First', row: bust.row,
          stat: 'Champion pick ' + nm(bust.row.champ) + ' went out in the ' + ROUNDS[S.games[bg].round].toLowerCase(),
          blurb: 'First bracket in the pool to lose its champion.' });
      }

      var hot = best(rows, function (r) { var b = r.score.byRound; return b[0] + b[1] + b[2] > 0 ? [b[0] + b[1] + b[2], r.score.points] : null; });
      if (hot) {
        var playedEarly = 0;
        for (var h = 0; h < GAMES; h++) if (S.games[h].round <= 2 && R.win[h] != null) playedEarly++;
        var hb = hot.row.score.byRound;
        out.push({ id: 'hotstart', title: 'Hottest Start', row: hot.row,
          stat: (hb[0] + hb[1] + hb[2]) + ' of ' + playedEarly + ' right in the first weekend',
          blurb: 'Best record through the opening rounds.' });
      }
    }

    var chalk = best(rows, function (r) {
      var memo = {}, fav = 0, n = 0;
      for (var g = 0; g < GAMES; g++) {
        var w = winnerOf(S, r.entry.picks, g, memo); if (w == null) continue;
        var t = teamsIn(S, r.entry.picks, g, memo), o = t[0] === w ? t[1] : t[0];
        if (seedOf(S, w) === seedOf(S, o)) continue;
        n++; if (seedOf(S, w) < seedOf(S, o)) fav++;
      }
      r._chalk = [fav, n];
      return n >= 20 ? [fav / n, fav] : null;
    });
    if (chalk && rows.length > 1) {
      out.push({ id: 'chalk', title: 'Chalk Eater', row: chalk.row,
        stat: 'Picked the better seed in ' + chalk.row._chalk[0] + ' of ' + chalk.row._chalk[1] + ' games',
        blurb: 'Favorites all the way down.' });
    }
    return out;
  }

  // ---------- fields ----------
  // Parse pasted teams. Accepts either
  //   "East 1: Team Name" / "E1 Team" / "East 16a - Team" lines (layout is inferred from the a/b lines), or
  //   exactly 76 plain lines in template order for the given layout.
  // Returns { layout, teams: {slotId: name} } or { error }.
  function parseField(text, layoutHint) {
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return clean(l, 80); }).filter(Boolean);
    if (!lines.length) return { error: 'Paste or type the teams first.' };
    var re = /^([A-Za-z][A-Za-z .'&-]{0,23}?)\s*(\d{1,2})([abAB]?)\s*[:.)\-\u2013\u2014]?\s+(.+)$/;
    var tagged = lines.filter(function (l) { return re.test(l); });
    if (tagged.length >= lines.length * 0.9) {
      var regions = [], byKey = {}, seen = {};
      for (var i = 0; i < lines.length; i++) {
        var m = re.exec(lines[i]); if (!m) return { error: 'Couldn\u2019t read line: "' + lines[i] + '"' };
        var rn = m[1].trim(), key = rn.toLowerCase(), seed = +m[2], sub = m[3].toLowerCase(), name = clean(m[4], 40);
        if (!byKey[key]) {
          if (regions.length === 4) return { error: 'More than 4 regions found ("' + rn + '").' };
          byKey[key] = { name: rn, teams: {}, playIn: {} }; regions.push(byKey[key]);
        }
        var R = byKey[key];
        if (seed < 1 || seed > 16) return { error: 'Seed must be 1 to 16: "' + lines[i] + '"' };
        var k2 = seed + sub;
        if (R.teams[k2]) return { error: 'Two teams for ' + rn + ' ' + k2 + '.' };
        if (seen[name.toLowerCase()]) return { error: name + ' is listed twice.' };
        seen[name.toLowerCase()] = 1;
        R.teams[k2] = name; if (sub) R.playIn[seed] = 1;
      }
      if (regions.length !== 4) return { error: 'Found ' + regions.length + ' regions; a 76-team bracket has 4.' };
      var codes = {}, layout = regions.map(function (R, ix) {
        var c = R.name.charAt(0).toUpperCase();
        if (!/[A-Z]/.test(c) || codes[c]) c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(function (x) { return !codes[x]; })[0];
        codes[c] = 1;
        return { code: c, name: R.name.replace(/\b[a-z]/g, function (x) { return x.toUpperCase(); }), playIn: Object.keys(R.playIn).map(Number) };
      });
      var err = checkLayout(layout);
      if (err) return { error: 'Opening Round lines: ' + err + '. Mark the two teams in each Opening Round game as 16a and 16b, 12a and 12b, and so on.' };
      var S = build(layout), teams = {};
      for (var s = 0; s < S.slots.length; s++) {
        var sl = S.slots[s], R2 = regions[sl.region], nm = R2.teams[sl.seed + sl.sub];
        if (!nm) return { error: 'Missing ' + R2.name + ' ' + sl.seed + sl.sub + '.' };
        teams[sl.id] = nm;
      }
      if (lines.length !== TEAMS) return { error: 'Found ' + lines.length + ' teams; need 76.' };
      return { layout: normLayout(layout), teams: teams };
    }
    var S2 = build(layoutHint || DEFAULT_LAYOUT);
    if (lines.length !== TEAMS) return { error: 'Found ' + lines.length + ' lines; need 76 teams (one per line, in the template order), or lines like "East 1: Team".' };
    var t2 = {}, dup = {};
    for (var j = 0; j < TEAMS; j++) {
      var nm2 = clean(lines[j].replace(/^\s*\d+[.)]\s+/, ''), 40);
      if (dup[nm2.toLowerCase()]) return { error: nm2 + ' is listed twice.' };
      dup[nm2.toLowerCase()] = 1; t2[S2.slots[j].id] = nm2;
    }
    return { layout: S2.layout, teams: t2 };
  }
  function fieldTemplate(layout) {
    var S = build(layout || DEFAULT_LAYOUT);
    return S.slots.map(function (sl) { return placeholder(S, S.slotIx[sl.id]) + ': '; }).join('\n');
  }
  function fieldText(S, field) {
    return S.slots.map(function (sl, i) { return placeholder(S, i) + ': ' + teamName(S, field, i); }).join('\n');
  }
  // Official field file -> { layout, teams } (layout falls back to DEFAULT_LAYOUT when the file is empty)
  function readFieldFile(json) {
    var layout = DEFAULT_LAYOUT, teams = {};
    if (json && Array.isArray(json.regions) && json.regions.length === 4 && !checkLayout(json.regions)) layout = normLayout(json.regions);
    var S = build(layout);
    if (json && json.teams && typeof json.teams === 'object') {
      Object.keys(json.teams).forEach(function (id) { if (S.slotIx[id] != null && json.teams[id]) teams[id] = clean(json.teams[id], 40); });
    }
    return { layout: normLayout(layout), teams: teams, official: Object.keys(teams).length === TEAMS, isDefault: layout === DEFAULT_LAYOUT };
  }
  function clean(s, max) {
    var t = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
    var c = Array.from(t);
    return c.length > max ? c.slice(0, max).join('').trim() : t;
  }

  return {
    POD: POD, ROUNDS: ROUNDS, ROUND_SHORT: ROUND_SHORT, DEFAULT_LAYOUT: DEFAULT_LAYOUT, TEAMS: TEAMS, GAMES: GAMES, OR_GAMES: OR_GAMES, PRESETS: PRESETS,
    checkLayout: checkLayout, normLayout: normLayout, layoutText: layoutText, parseLayoutText: parseLayoutText, build: build,
    seedOf: seedOf, placeholder: placeholder, teamName: teamName,
    emptyPicks: emptyPicks, winnerOf: winnerOf, teamsIn: teamsIn, allWinners: allWinners, setPick: setPick, pickTeam: pickTeam,
    countPicks: countPicks, validPicks: validPicks, packPicks: packPicks, unpackPicks: unpackPicks,
    readResults: readResults, actualTeams: actualTeams, eliminated: eliminated, checkRules: checkRules, score: score, standings: standings, awards: awards,
    parseField: parseField, fieldTemplate: fieldTemplate, fieldText: fieldText, readFieldFile: readFieldFile, clean: clean, clone: clone
  };
});
