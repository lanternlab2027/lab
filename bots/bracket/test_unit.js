// Unit tests for docs/bracket (structure, advancement, scoring, awards, codec, tamper checks).
// Run: node bots/bracket/test_unit.js
const B = require('../../docs/bracket/bracket.js');
const C = require('../../docs/bracket/codec.js');
const fs = require('fs'), path = require('path');

let fails = 0, n = 0;
const check = (c, m) => { n++; if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

// Deterministic "results": the better seed wins unless rnd says upset.
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function simulate(S, seed, upTo) {
  const r = rng(seed), win = {}, picks = B.emptyPicks();
  let p = picks;
  for (let g = 0; g < B.GAMES && (upTo == null || g < upTo); g++) {
    const t = B.teamsIn(S, p, g), sa = B.seedOf(S, t[0]), sb = B.seedOf(S, t[1]);
    let side = sa <= sb ? 1 : 2; if (r() < 0.3) side = 3 - side;
    p = B.setPick(S, p, g, side);
    win[S.games[g].code] = S.slots[t[side - 1]].id;
  }
  return { json: { winners: win, championshipTotal: 141 }, picks: p };
}
function randomPicks(S, seed) {
  const r = rng(seed); let p = B.emptyPicks();
  for (let g = 0; g < B.GAMES; g++) p = B.setPick(S, p, g, r() < 0.5 ? 1 : 2);
  return p;
}

console.log('structure');
const S = B.build();
check(S.slots.length === 76, '76 team slots');
check(S.games.length === 75, '75 games (76 teams, one champion)');
check(S.games.filter((g) => g.round === 0).length === 12, '12 Opening Round games');
check([1, 2, 3, 4, 5, 6].map((r) => S.games.filter((g) => g.round === r).length).join() === '32,16,8,4,2,1', '32/16/8/4/2/1 games in rounds 1-6');
check(new Set(S.slots.map((s) => s.id)).size === 76, 'slot ids unique');
check(new Set(S.games.map((g) => g.code)).size === 75, 'game codes unique');
const orSeeds = S.games.filter((g) => g.round === 0).map((g) => B.seedOf(S, g.a.slot));
check(orSeeds.filter((s) => s === 16).length === 4 && orSeeds.filter((s) => s === 12).length === 4 && orSeeds.filter((s) => s === 11).length === 2 && orSeeds.filter((s) => s === 15).length === 2,
  'published plan: four 16-line, four 12-line, two 11-line, two 15-line Opening Round games');
// every slot feeds exactly one game; every game except the final feeds exactly one later game
const used = {}; S.games.forEach((g) => [g.a, g.b].forEach((s) => { if (s.slot != null) used[s.slot] = (used[s.slot] || 0) + 1; }));
check(Object.keys(used).length === 76 && Object.values(used).every((v) => v === 1), 'each team enters exactly one game');
check(S.games.filter((g) => g.next === -1).length === 1 && S.games[S.final].code === 'R6', 'only the title game has no next game');
check(S.games.every((g) => g.next === -1 || g.next > g.i), 'games are in playable order');
check(S.games.filter((g) => g.round === 1).every((g) => B.seedOf(S, g.a.slot != null ? g.a.slot : S.games[g.a.game].a.slot) + B.seedOf(S, g.b.slot != null ? g.b.slot : S.games[g.b.game].a.slot) === 17), 'first-round pairs add to 17 (1v16, 8v9, ...)');
check(S.games[S.gameIx['R1.E.1']].b.game === S.gameIx['OR.E.16'], 'East 16 Opening Round winner plays East 1');
check(S.games[S.gameIx['R1.W.2']].b.game === S.gameIx['OR.W.15'], 'West 15 Opening Round winner plays West 2');
check(S.games[S.gameIx['R5.EW']].a.game === S.gameIx['R4.E'], 'semifinal EW = East champ vs West champ');
check(B.placeholder(S, S.slotIx.E1) === 'East 1' && B.placeholder(S, S.slotIx.E16b) === 'East 16b', 'placeholders "East 1", "East 16b"');
check(/need exactly 12/.test(B.checkLayout([{ code: 'E', name: 'E', playIn: [16] }, { code: 'W', name: 'W', playIn: [16] }, { code: 'S', name: 'S', playIn: [16] }, { code: 'M', name: 'M', playIn: [16] }])), 'layout with 4 games rejected');
const alt = B.build([{ code: 'E', name: 'East', playIn: [10, 16, 12] }, { code: 'W', name: 'West', playIn: [11, 16, 12] }, { code: 'S', name: 'South', playIn: [11, 16, 15] }, { code: 'M', name: 'Midwest', playIn: [16, 15, 12] }]);
check(alt.slots.length === 76 && alt.games.length === 75 && alt.gameIx['OR.E.10'] != null, 'alternative layout (a 10-line game, as in ESPN bracketology) builds');
check(B.parseLayoutText(B.layoutText(alt.layout)) && B.layoutText(B.parseLayoutText(B.layoutText(alt.layout))) === alt.key, 'layout text round trip');

console.log('advancement');
let p = B.emptyPicks();
const gE16 = S.gameIx['OR.E.16'], gE1 = S.gameIx['R1.E.1'], gE2 = S.gameIx['R2.E.1'];
check(B.teamsIn(S, p, gE1)[1] === null, 'East 1 game has an empty slot before the Opening Round pick');
p = B.setPick(S, p, gE16, 2);
check(B.teamsIn(S, p, gE1)[1] === S.slotIx.E16b, 'picking East 16b moves it into the East 1 game');
p = B.setPick(S, p, gE1, 2);
p = B.pickTeam(S, p, gE2, S.slotIx.E16b);
check(B.winnerOf(S, p, gE2) === S.slotIx.E16b, 'pickTeam advances 16b a second round');
p = B.setPick(S, p, gE16, 1);
check(p[gE1] === 0 && p[gE2] === 0, 'changing the Opening Round winner clears later picks that relied on the old team');
p = B.setPick(S, p, gE1, 1); p = B.setPick(S, p, gE2, 1);
p = B.setPick(S, p, gE16, 2);
check(p[gE1] === 1 && p[gE2] === 1, '...but keeps later picks of the other team');
const full = randomPicks(S, 7);
check(B.countPicks(full) === 75 && B.validPicks(S, full) && B.winnerOf(S, full, S.final) != null, 'full random bracket is valid and has a champion');
check(B.unpackPicks(B.packPicks(full)).join() === full.join(), 'pick packing round trip (19 bytes)');
check(B.packPicks(full).length === 19 && C.picksStr(full).length === 26, 'picks are 26 base64url characters');
const bad = full.slice(); bad[gE1] = 3;
check(!B.validPicks(S, bad), 'invalid pick value rejected');
const orphan = B.emptyPicks(); orphan[gE1] = 2;
check(!B.validPicks(S, orphan), 'a pick of an empty slot is rejected');

console.log('scoring');
const sim = simulate(S, 99);
const R = B.readResults(S, sim.json);
check(R.played === 75 && R.bad.length === 0 && R.total === 141, 'results file with all 75 games reads cleanly');
const rules = { pts: [1, 1, 2, 4, 8, 16, 32], upset: false };
const perfect = B.score(S, rules, sim.picks, R);
check(perfect.points === 12 + 32 + 32 + 32 + 32 + 32 + 32 && perfect.correct === 75 && perfect.max === perfect.points, 'perfect bracket = 204 with doubling rules');
const empty = B.score(S, rules, B.emptyPicks(), R);
check(empty.points === 0 && empty.max === 0, 'empty bracket scores 0');
const ups = B.score(S, { pts: rules.pts, upset: true }, sim.picks, R);
let bonus = 0; S.games.forEach((g) => { const t = B.actualTeams(S, R.win, g.i), w = R.win[g.i], l = t[0] === w ? t[1] : t[0]; bonus += Math.max(0, B.seedOf(S, w) - B.seedOf(S, l)); });
check(ups.points === perfect.points + bonus && bonus > 0, 'upset bonus adds the seed difference of each correct upset');
const partial = B.readResults(S, simulate(S, 99, 44).json);
check(partial.played === 44, 'partial results (44 games) read');
const sp = B.score(S, rules, sim.picks, partial);
check(sp.points === 12 + 32 && sp.max === 204, 'partial: points so far and max possible');
const wrongR = B.readResults(S, { winners: { 'R1.E.1': 'W1', 'NOPE': 'E1' } });
check(wrongR.played === 0 && wrongR.bad.length === 2, 'results naming a team not in that game, or an unknown game, are ignored and reported');
const e1 = { name: 'A', picks: sim.picks, tb: 140 }, e2 = { name: 'B', picks: randomPicks(S, 3), tb: 120 }, e3 = { name: 'C', picks: sim.picks, tb: 150 };
const st = B.standings(S, rules, [e2, e3, e1], R);
check(st[0].entry.name === 'A' && st[1].entry.name === 'C' && st[2].entry.name === 'B', 'standings: points, then closest tiebreaker');
check(st[0].rank === 1 && st[1].rank === 2, 'tiebreaker separates ranks');

console.log('awards');
const entries = [1, 2, 3, 4, 5, 6].map((k) => ({ name: 'P' + k, picks: randomPicks(S, k * 11), tb: 130 + k }));
entries.push({ name: 'Chalky', picks: (() => { let q = B.emptyPicks(); for (let g = 0; g < 75; g++) { const t = B.teamsIn(S, q, g); q = B.setPick(S, q, g, B.seedOf(S, t[0]) <= B.seedOf(S, t[1]) ? 1 : 2); } return q; })(), tb: 140 });
const aw = B.awards(S, rules, entries, R, null);
const ids = aw.map((a) => a.id);
check(['best', 'upset', 'cinderella', 'busted', 'hotstart', 'chalk'].every((i) => ids.includes(i)), 'all six awards given: ' + ids.join(', '));
check(aw.find((a) => a.id === 'chalk').row.entry.name === 'Chalky', 'Chalk Eater goes to the all-favorites bracket');
check(aw.find((a) => a.id === 'best').title === 'Best Bracket', 'Best Bracket after the title game');
check(B.awards(S, rules, entries, B.readResults(S, {}), null).map((a) => a.id).join() === 'chalk', 'before any results only Chalk Eater can be given');
check(aw.every((a) => /^[\x20-\x7e]*$/.test(a.title + a.stat + a.blurb)), 'award text is ASCII');

console.log('fields');
const tmpl = B.fieldTemplate();
check(tmpl.split('\n').length === 76 && /^East 1: $/m.test(tmpl) && /^Midwest 15b: $/m.test(tmpl), 'template has 76 "Region seed:" lines');
const filled = tmpl.split('\n').map((l, i) => l + 'Team ' + (i + 1)).join('\n');
const f1 = B.parseField(filled);
check(!f1.error && f1.teams.E1 === 'Team 1' && Object.keys(f1.teams).length === 76, 'tagged field parses');
const plain = filled.split('\n').map((l) => l.split(': ')[1]).join('\n');
check(!B.parseField(plain).error && B.parseField(plain).teams.M16b === 'Team 76', '76 plain lines parse in template order');
check(/need 76/.test(B.parseField(plain.split('\n').slice(1).join('\n')).error), '75 lines rejected');
check(/twice/.test(B.parseField(plain.replace('Team 5', 'Team 4')).error), 'duplicate team rejected');
const altField = B.fieldTemplate(alt.layout).split('\n').map((l, i) => l + 'X' + i).join('\n');
const f2 = B.parseField(altField);
check(!f2.error && B.layoutText(f2.layout) === alt.key, 'pasted field with a different Opening Round layout infers that layout');
const ff = B.readFieldFile(JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/bracket/field-2027.json'), 'utf8')));
check(ff.isDefault && !ff.official && Object.keys(ff.teams).length === 0, 'docs/bracket/field-2027.json is empty and falls back to the default layout');
const rf = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/bracket/results-2027.json'), 'utf8'));
check(B.readResults(S, rf).played === 0, 'docs/bracket/results-2027.json is empty');

(async () => {
  console.log('codec');
  const pool = C.makePool({ name: 'Office Pool 2027', rules: { pts: [1, 1, 2, 4, 8, 16, 32], upset: true }, lock: Date.UTC(2027, 2, 18, 16), layout: null, teams: null });
  const pl = await C.encodePool(pool);
  const dp = await C.decode('#' + pl);
  check(dp.type === 'pool' && C.poolText(dp.pool) === C.poolText(pool), 'pool link round trip (' + pl.length + ' chars)');
  const cpool = C.makePool({ name: 'Family', layout: f2.layout, teams: f2.teams });
  const dcp = await C.decode(await C.encodePool(cpool));
  check(dcp.pool.teams && dcp.pool.teams.E10a === f2.teams.E10a && B.layoutText(dcp.pool.layout) === alt.key, 'pool with a pasted field and custom layout round trips');
  const ent = C.makeEntry(pool, { name: 'Sam <b>', picks: full, tb: 143, time: Date.UTC(2027, 2, 17) });
  const el = await C.encodeEntry(pool, ent);
  const de = await C.decode(el);
  check(de.type === 'entry' && de.entry.ok && !de.entry.late && de.entry.picks.join() === full.join() && de.entry.tb === 143 && de.entry.name === 'Sam <b>', 'picks link round trip (' + el.length + ' chars), checksum ok');
  check(de.poolId === C.poolId(pool), 'picks link carries the same pool id');
  const late = C.makeEntry(pool, { name: 'Late', picks: full, tb: 1, time: Date.UTC(2027, 2, 19) });
  check((await C.decode(await C.encodeEntry(pool, late))).entry.late, 'entry made after the lock is flagged late');
  // tampering: change one pick but keep the old checksum
  const forged = Object.assign({}, ent, { picks: B.setPick(S, full, S.final, 3 - full[S.final]) });
  const df = await C.decode(await C.encodeEntry(pool, forged));
  check(df.type === 'entry' && df.entry.ok === false, 'tampered picks (old checksum kept) detected');
  const renamed = Object.assign({}, ent, { name: 'Someone else' });
  check((await C.decode(await C.encodeEntry(pool, renamed))).entry.ok === false, 'renamed entry detected');
  const retimed = Object.assign({}, late, { time: Date.UTC(2027, 2, 17) });
  check((await C.decode(await C.encodeEntry(pool, retimed))).entry.ok === false, 'back-dated entry detected');
  const pool2 = C.makePool({ name: 'Other pool' });
  const moved = await C.decode(await C.encodeEntry(pool2, Object.assign({}, ent)));
  check(moved.entry.ok === false, 'an entry moved to a different pool fails the checksum');
  // truncation and junk
  let allBad = true;
  for (let k = 3; k < el.length; k += 7) { const r = await C.decode(el.slice(0, k)); if (!r.error) { allBad = false; console.log('    accepted prefix', k); } }
  check(allBad, 'every truncated picks link is rejected');
  const plainEl = await C.encodeEntry(pool, ent, { noCompress: true });
  check((await C.decode(plainEl)).entry.ok, 'uncompressed (t) links decode too');
  check((await C.decode('#x=abc')).error === 'not-a-link' && (await C.decode('#e=z!!')).error === 'corrupt' && (await C.decode('')).error === 'empty', 'junk hashes rejected');
  const bomb = 'e=z' + C.b64.enc(require('zlib').deflateRawSync(Buffer.alloc(5e6, 65)));
  check((await C.decode(bomb)).error === 'too-long', 'zip bomb stopped');
  // standings link
  const many = [];
  for (let k = 0; k < 60; k++) many.push(C.makeEntry(pool, { name: 'Player ' + k, picks: randomPicks(S, k + 1000), tb: 120 + k, time: Date.UTC(2027, 2, 16) + k }));
  const sl = await C.encodeStandings(pool, many);
  const ds = await C.decode(sl);
  check(ds.type === 'standings' && ds.entries.length === 60 && ds.entries.every((e) => e.ok) && ds.entries[59].picks.join() === many[59].picks.join(), 'standings link with 60 entries round trips (' + sl.length + ' chars)');
  check((await C.decode(await C.encodeStandings(pool, []))).entries.length === 0, 'empty standings link');
  const links = C.findLinks('hi https://x/bracket/#' + el + ' and\nhttps://x/bracket/#' + pl + ' junk #e=');
  check(links.length === 2 && links[0] === el, 'findLinks pulls links out of pasted chat text');
  const inj = C.makePool({ name: 'a\nb\u0000~\n', teams: Object.fromEntries(S.slots.map((s) => [s.id, 'T\n' + s.id])) });
  const di = await C.decode(await C.encodePool(inj));
  check(!di.error && di.pool.name === 'a b ~' && di.pool.teams.E1 === 'T E1', 'newlines and control characters cannot break the format');
  const sz = (await C.encodeEntry(cpool, C.makeEntry(cpool, { name: 'X', picks: full, tb: 1, time: 1 }))).length;
  check(sz < 2000, 'picks link with a pasted field stays under 2,000 chars (' + sz + ')');

  console.log(`\n${n - fails}/${n} passed`);
  process.exit(fails ? 1 : 0);
})();
