// Unit tests for docs/awards/awards.js, cards.js deck builders and sleeper.js.
// Run: node --test bots/awards/test_awards.js
// Fixture: bots/awards/fixtures/unit_league.json (synthetic, hand-computed expectations).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const DOCS = path.resolve(__dirname, '../../docs/awards');
const A = require(path.join(DOCS, 'awards.js'));
const C = require(path.join(DOCS, 'cards.js'));
const S = require(path.join(DOCS, 'sleeper.js'));
const D = require(path.join(DOCS, 'demo.js'));
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/unit_league.json'), 'utf8'));
const teams = A.buildTeams(FX.users, FX.rosters);
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('team names: team_name, then display_name, orphan roster gets "Team N"', () => {
  assert.equal(teams[1].name, 'Alpha'); assert.equal(teams[1].manager, 'alice');
  assert.equal(teams[2].name, 'bob'); assert.equal(teams[2].manager, '');
  assert.equal(teams[3].name, 'Cobras');
  assert.equal(teams[4].name, 'Team 4');
});

test('scoreRow: bench = players_points of non-starters; "0" empty slot ignored; custom_points wins', () => {
  const w1 = FX.matchups['1'];
  assert.equal(A.scoreRow(w1[0]).bench, 15);
  assert.equal(A.scoreRow(w1[1]).bench, 32.5);
  assert.equal(A.scoreRow(w1[2]).bench, null); // no players_points
  assert.equal(A.scoreRow(w1[3]).bench, 0);
  assert.equal(A.scoreRow(FX.matchups['2'][1]).points, 115);
});

test('week 1 awards', () => {
  const w = A.weeklyAwards(FX.matchups['1'], teams);
  assert.equal(w.teamCount, 4);
  assert.equal(w.high.team.rosterId, 4); assert.equal(w.high.points, 130); assert.equal(w.high.opp.rosterId, 3);
  assert.equal(w.low.team.rosterId, 3); assert.equal(w.low.points, 99);
  assert.equal(w.blowout.winner.rosterId, 4); assert.equal(w.blowout.loser.rosterId, 3); assert.equal(w.blowout.margin, 31);
  assert.equal(w.heartbreak.loser.rosterId, 2); assert.equal(w.heartbreak.winner.rosterId, 1); assert.equal(w.heartbreak.margin, 20.25);
  assert.equal(w.luckiest.team.rosterId, 1); assert.equal(w.luckiest.rank, 2); assert.equal(w.luckiest.wouldHaveLostTo, 1);
  assert.equal(w.luckiest.opp.rosterId, 2); assert.equal(w.luckiest.oppWasLowest, false);
  assert.equal(w.unluckiest.team.rosterId, 2); assert.equal(w.unluckiest.rank, 3); assert.equal(w.unluckiest.wouldHaveBeaten, 1);
  assert.equal(w.bench.team.rosterId, 2); assert.equal(w.bench.bench, 32.5); assert.equal(w.bench.lost, true);
});

test('week 2: tie game is not a blowout/heartbreak; custom_points used; shared rank on equal scores', () => {
  const w = A.weeklyAwards(FX.matchups['2'], teams);
  assert.equal(w.high.team.rosterId, 3); assert.equal(w.high.points, 115);
  assert.equal(w.blowout.winner.rosterId, 3); assert.equal(w.blowout.margin, 25);
  assert.equal(w.heartbreak.loser.rosterId, 1); assert.equal(w.heartbreak.margin, 25);
  assert.equal(w.luckiest.team.rosterId, 3); assert.equal(w.luckiest.wouldHaveLostTo, 0);
  assert.equal(w.unluckiest.team.rosterId, 1); assert.equal(w.unluckiest.rank, 4);
  const r = Object.fromEntries(w.ranked.map((x) => [x.team.rosterId, x.rank]));
  assert.equal(r[2], 2); assert.equal(r[4], 2);
  assert.equal(w.bench, undefined); // nobody has players_points this week
});

test('week 3 (playoffs): null matchup_id teams count for high/low, not head-to-head', () => {
  const w = A.weeklyAwards(FX.matchups['3'], teams);
  assert.equal(w.high.team.rosterId, 1); assert.equal(w.low.team.rosterId, 3); assert.equal(w.low.opp, null);
  assert.equal(w.blowout.margin, 60); assert.equal(w.teamCount, 4);
});

test('empty week -> null', () => {
  assert.equal(A.weeklyAwards(FX.matchups['4'], teams), null);
  assert.equal(A.weekHasScores([]), false);
});

test('season: regular season stops before playoff_week_start', () => {
  assert.deepEqual(A.regularSeasonWeeks(FX.league, [1, 2, 3]), [1, 2]);
  assert.deepEqual(A.regularSeasonWeeks({ settings: {} }, [1, 2, 3]), [1, 2, 3]);
});

test('season awards: records, all-play, luck, standings, power, bench, best week', () => {
  const s = A.seasonAwards(FX.matchups, [1, 2], teams, FX.transactions);
  const by = Object.fromEntries(s.standings.map((x) => [x.team.rosterId, x]));
  assert.equal(A.record(by[1]), '1-1'); assert.equal(A.record(by[2]), '0-1-1'); assert.equal(A.record(by[4]), '1-0-1');
  assert.equal(A.apRecord(by[1]), '2-4'); assert.equal(A.apRecord(by[2]), '2-3-1'); assert.equal(A.apRecord(by[3]), '3-3'); assert.equal(A.apRecord(by[4]), '4-1-1');
  assert.equal(by[1].pf, 210.5); assert.equal(by[1].pa, 215.25); assert.equal(by[4].pf, 235);
  close(by[1].luck, 0.5 - 2 / 6); close(by[2].luck, 0.25 - 2.5 / 6);
  assert.equal(s.luckiest.team.rosterId, 1); assert.equal(s.unluckiest.team.rosterId, 2);
  assert.deepEqual(s.standings.map((x) => x.team.rosterId), [4, 3, 1, 2]);
  assert.deepEqual(s.power.map((x) => x.team.rosterId), [4, 3, 2, 1]);
  assert.equal(by[4].power, 87.5); assert.equal(by[3].power, 70.5); assert.equal(by[2].power, 64.5); assert.equal(by[1].power, 61.5);
  assert.deepEqual(s.bench.map((x) => [x.team.rosterId, x.bench]), [[2, 32.5], [1, 15], [4, 0]]);
  assert.deepEqual([s.bestWeek.team.rosterId, s.bestWeek.points, s.bestWeek.week], [4, 130, 1]);
  assert.equal(s.mostPf.team.rosterId, 4);
  assert.deepEqual(s.weeks, [1, 2]);
});

test('transactions: complete only, trades count for both sides, de-duplicated, commissioner moves ignored', () => {
  const m = A.transactionCounts(FX.transactions, teams);
  const by = Object.fromEntries(m.ranked.map((x) => [x.team.rosterId, x]));
  assert.deepEqual([by[1].trades, by[1].waivers, by[1].freeAgents, by[1].total], [1, 0, 1, 2]);
  assert.deepEqual([by[2].trades, by[2].total], [1, 1]);
  assert.deepEqual([by[3].waivers, by[3].freeAgents, by[3].total], [1, 1, 2]);
  assert.equal(by[4], undefined);
  assert.equal(m.king.team.rosterId, 1); assert.equal(m.tradeKing.team.rosterId, 1);
  assert.equal(A.transactionCounts({}, teams), null);
});

test('recap text names the winners and ends with the site', () => {
  const wk = A.weeklyAwards(FX.matchups['1'], teams);
  const se = A.seasonAwards(FX.matchups, [1, 2], teams, FX.transactions);
  const t = A.recapText({ leagueName: 'Unit Test League', week: 1, weekly: wk, season: se });
  assert.match(t, /Week 1 awards/);
  assert.match(t, /Highest scorer: Team 4 \(130\.00\)/);
  assert.match(t, /Heartbreak: bob lost to Alpha by 20\.25/);
  assert.match(t, /Bench warmer: bob left 32\.50/);
  assert.match(t, /Luckiest win: Alpha won with 120\.50 \(2nd of 4\)/);
  assert.match(t, /Power rankings: 1\. Team 4  2\. Cobras/);
  assert.match(t, /Trade & waiver king: Alpha \(2 moves\)/);
  assert.match(t.trim().split('\n').pop(), /lanternlab2027\.github\.io\/lab\/awards$/);
});

test('deck builders produce the expected cards', () => {
  const wk = A.weeklyAwards(FX.matchups['1'], teams);
  const d = C.weeklyDeck(wk, { leagueName: 'X', week: 1, season: '2026' });
  assert.deepEqual(d.map((c) => c.id), ['w-cover', 'w-high', 'w-blowout', 'w-heartbreak', 'w-bench', 'w-luckiest', 'w-unluckiest', 'w-low']);
  const d2 = C.weeklyDeck(A.weeklyAwards(FX.matchups['2'], teams), { leagueName: 'X', week: 2, season: '2026' });
  assert.ok(!d2.some((c) => c.id === 'w-bench'));
  const se = A.seasonAwards(FX.matchups, [1, 2], teams, FX.transactions);
  const s = C.seasonDeck(se, { leagueName: 'X', season: '2026' });
  assert.deepEqual(s.map((c) => c.id), ['s-power', 's-allplay', 's-luckiest', 's-unluckiest', 's-moves', 's-bench', 's-best']);
  assert.equal(C.SITE, 'lanternlab2027.github.io/lab/awards');
  assert.equal(C.W, 1080); assert.equal(C.H, 1350);
});

test('parseInput: league IDs, league URLs, usernames', () => {
  assert.deepEqual(S.parseInput(' 1180000000000000001 '), { kind: 'league', value: '1180000000000000001' });
  assert.deepEqual(S.parseInput('https://sleeper.com/leagues/1180000000000000001/matchup'), { kind: 'league', value: '1180000000000000001' });
  assert.deepEqual(S.parseInput('@dana_r'), { kind: 'user', value: 'dana_r' });
  assert.equal(S.parseInput('two words').kind, 'bad');
});

test('sleeper client: loads a league via injected fetch, 4 at a time, and maps null/404 to errors', async () => {
  const b = D.build({ season: '2026', weeks: 3, liveWeek: true, playoffStart: 15, leagueId: '1234567890' });
  const routes = D.routes(b, 'dana_r');
  let inflight = 0, peak = 0;
  const fakeFetch = async (url) => {
    inflight++; peak = Math.max(peak, inflight);
    await new Promise((r) => setTimeout(r, 2));
    inflight--;
    const p = url.replace(S.BASE, '');
    const body = p in routes ? JSON.stringify(routes[p]) : 'null';
    return { ok: true, status: 200, text: async () => body };
  };
  const cl = S.client(fakeFetch);
  const got = await cl.loadLeague('1234567890');
  assert.equal(got.liveWeek, 4);
  assert.deepEqual(Object.keys(got.matchups).map(Number), [1, 2, 3, 4]);
  assert.ok(peak <= 4 + 4, 'bounded concurrency');
  const found = await cl.findLeagues('dana_r');
  assert.equal(found.user.username, 'dana_r');
  await assert.rejects(cl.findLeagues('nobody_here'), /No Sleeper user/);
  await assert.rejects(cl.loadLeague('999999999'), /No Sleeper league/);
  const rl = S.client(async () => ({ ok: false, status: 429, text: async () => '' }));
  await assert.rejects(rl.get('/state/nfl'), /rate-limiting/);
});

test('demo league: every week computes, season awards exist, totals match starters', () => {
  const b = D.build();
  const t = A.buildTeams(b.users, b.rosters);
  for (let w = 1; w <= 17; w++) assert.ok(A.weeklyAwards(b.matchups[w], t), 'week ' + w);
  const m = b.matchups[1][0];
  close(m.points, m.starters.reduce((s, p) => s + m.players_points[p], 0), 0.02);
  const se = A.seasonAwards(b.matchups, A.regularSeasonWeeks(b.league, [...Array(17)].map((_, i) => i + 1)), t, b.transactions);
  assert.equal(se.weeks.length, 14); assert.equal(se.power.length, 10); assert.ok(se.moves.king.total > 0);
});
