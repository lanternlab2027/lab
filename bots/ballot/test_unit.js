// Unit tests for docs/ballot (Awards-Night Ballot Pool): show files, codec round trips, scoring, tiebreaks,
// the lock-time "late" flag, awards, tampering and junk links. Run: node bots/ballot/test_unit.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const B = require('../../docs/ballot/ballot.js');
const C = require('../../docs/ballot/codec.js');
const DOCS = path.join(__dirname, '../../docs/ballot');

let fails = 0, n = 0;
const check = (c, m) => { n++; if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(DOCS, p), 'utf8'));

(async () => {
  console.log('show files');
  const index = readJson('shows/index.json');
  check(Array.isArray(index.shows) && index.shows.length >= 4, 'index lists the shows');
  const shows = {};
  for (const id of index.shows) {
    const raw = readJson('shows/' + id + '.json');
    const v = B.validateShow(raw);
    check(v.ok, id + ' validates' + (v.ok ? '' : ': ' + v.errors.join('; ')));
    check(raw.id === id, id + ' id matches its file name');
    shows[id] = v.show;
    const txt = JSON.stringify(raw);
    check(/^[\x20-\x7e\s]*$/.test(fs.readFileSync(path.join(DOCS, 'shows/' + id + '.json'), 'utf8')), id + ' file is ASCII');
    if (!raw.demo) {
      check(!/oscar|grammy|golden globe/i.test(raw.name + ' ' + raw.short), id + ' name has no awards trademarks');
      const empty = v.show.categories.every((c) => c.nominees.length === 0);
      check(empty ? !B.isOpen(v.show) : B.isOpen(v.show), id + (empty ? ' ships with empty nominee lists (not open)' : ' has nominees in every category (open)'));
      check(v.show.ceremony > Date.parse('2027-01-01') && /^https:/.test(v.show.resultsUrl) && v.show.nominationsLabel, id + ' has ceremony time, nominations date and results URL');
      const res = readJson('results/' + id + '.json');
      check(res.show === id && (empty || Object.keys(res.winners).length >= 0), id + ' results file is for this show');
    } else {
      check(B.isOpen(v.show) && /demo/i.test(raw.name), 'demo show is open and labelled Demo');
      check(v.show.categories.every((c) => /\(Demo\)/.test(c.name)), 'every demo category says (Demo)');
    }
    // every results file only names real nominees
    const rj = readJson('results/' + id + '.json');
    Object.keys(rj.winners).forEach((k) => {
      const c = v.show.categories.find((x) => x.id === k);
      check(c && [].concat(rj.winners[k]).every((w) => c.nominees.some((nm) => nm.name === w)), id + ' result ' + k + ' names a nominee');
    });
  }
  // verified 2027 dates
  check(new Date(shows['film-2027'].ceremony).toISOString() === '2027-0314T23:00:00.000Z'.replace('0314', '03-14'), 'film: Mar 14 2027, 7 pm EDT (DST starts that morning)');
  check(shows['film-2027'].nominations === '2027-01-21', 'film: nominations Jan 21 2027');
  check(new Date(shows['music-2027'].ceremony).toISOString() === '2027-02-08T00:00:00.000Z', 'music: Feb 7 2027, 7 pm EST (announced with the nominations)');
  check(B.isOpen(shows['music-2027']) && shows['music-2027'].categories.length === 20, 'music: nominees posted, 20 categories, ballot open');
  check(B.status(shows['music-2027'], Date.parse('2026-11-17')) === 'open', 'music is "open" after nominations');
  check(new Date(shows['globes-2027'].ceremony).toISOString() === '2027-01-11T00:30:00.000Z', 'film+TV: Jan 10 2027, 7:30 pm EST');
  check(shows['film-2027'].categories.length === 24, 'film has 24 categories');
  check(shows['globes-2027'].categories.length === 28, 'film+TV has 28 categories');

  console.log('show validation catches mistakes');
  const good = readJson('shows/demo.json');
  const bad = (mut, why) => { const j = JSON.parse(JSON.stringify(good)); mut(j); const v = B.validateShow(j); check(!v.ok, 'rejects ' + why + (v.ok ? '' : ' (' + v.errors[0] + ')')); };
  bad((j) => { j.id = 'Bad Id'; }, 'bad id');
  bad((j) => { delete j.rev; }, 'missing rev');
  bad((j) => { j.categories[1].id = j.categories[0].id; }, 'duplicate category id');
  bad((j) => { j.categories[0].nominees.push({ name: j.categories[0].nominees[0].name.toUpperCase() }); }, 'duplicate nominee (case-insensitive)');
  bad((j) => { j.categories[0].nominees = [{ name: 'Only one' }]; }, 'one nominee');
  bad((j) => { j.categories[0].nominees = []; }, 'mixed empty and filled categories');
  bad((j) => { j.categories[0].weight = 9; }, 'weight out of range');
  bad((j) => { j.ceremony = '2027-03-14 19:00'; }, 'ceremony without a time zone');
  bad((j) => { j.resultsUrl = 'http://example.com'; }, 'non-https results URL');
  bad((j) => { j.categories = []; }, 'no categories');
  bad((j) => { j.tiebreakers = [{ id: 'custom', q: 'x' }]; }, 'reserved tiebreaker id');
  bad((j) => { j.categories[2].name = ''; }, 'empty category name');
  check(!B.validateShow(null).ok && !B.validateShow([]).ok, 'rejects null and arrays');
  const ok2 = JSON.parse(JSON.stringify(good)); ok2.categories[0].nominees[0] = 'Plain string nominee';
  check(B.validateShow(ok2).ok, 'accepts plain-string nominees');

  console.log('status');
  const film = shows['film-2027'], demo = shows.demo;
  check(B.status(film, Date.parse('2026-12-01')) === 'soon', 'film is "soon" before Jan 21');
  check(B.status(film, Date.parse('2027-01-25')) === 'pending', 'film is "pending" after Jan 21 until nominees are added');
  check(B.status(demo, Date.now()) === 'open', 'demo is open');

  console.log('picks packing');
  const p0 = [0, 3, -1, 2, 1, 0, 2, 3];
  check(B.packPicks(p0) === '14032134' && JSON.stringify(B.unpackPicks('14032134')) === JSON.stringify(p0), 'pack/unpack round trip');
  check(B.validPicks(demo, p0) && !B.validPicks(demo, p0.slice(1)) && !B.validPicks(demo, [9, 0, 0, 0, 0, 0, 0, 0]), 'validPicks checks length and range');
  check(B.unpackPicks('AB') === null && B.unpackPicks('1~') === null, 'unpack rejects bad characters');

  console.log('codec round trips');
  const pool = C.makePool({ name: 'Smith Family Ballot', show: 'demo', rules: 'weighted', lock: Date.parse('2027-03-14T23:00:00Z'), tbKey: 'runtime' });
  const ph = await C.encodePool(pool);
  const pd = await C.decode('#' + ph);
  check(pd.type === 'pool' && JSON.stringify(pd.pool) === JSON.stringify(pool), 'pool round trip');
  const pool2 = C.makePool({ name: 'Office', show: 'film-2027', rules: 'flat', tbKey: 'custom', tbQ: 'Minutes until the first joke about parking?' });
  const pd2 = await C.decode(await C.encodePool(pool2, { noCompress: true }));
  check(pd2.pool.tbKey === 'custom' && pd2.pool.tbQ === pool2.tbQ && pd2.pool.lock === 0, 'custom tiebreak + plain (t) encoding round trip');
  check(C.makePool({ tbKey: 'custom', tbQ: '' }).tbKey === '', 'custom tiebreak without a question becomes none');
  const before = Date.parse('2027-03-14T20:00:00Z'), after = Date.parse('2027-03-15T01:00:00Z');
  const e1 = C.makeEntry(pool, { name: 'Ana', picks: p0, tb: '205', time: before, rev: 1 });
  const ed = await C.decode(await C.encodeEntry(pool, e1));
  check(ed.type === 'entry' && ed.entry.ok && ed.entry.name === 'Ana' && JSON.stringify(ed.entry.picks) === JSON.stringify(p0) && ed.entry.tb === 205 && ed.entry.rev === 1, 'entry round trip');
  check(!ed.entry.late, 'entry before the lock is not late');
  const e2 = C.makeEntry(pool, { name: 'Ben (late)', picks: [1, 0, 0, 0, 0, 0, 0, 0], tb: '', time: after, rev: 1 });
  const ed2 = await C.decode(await C.encodeEntry(pool, e2));
  check(ed2.entry.ok && ed2.entry.late && ed2.entry.tb === null, 'entry after the lock is flagged late; no tiebreak -> null');
  const noLock = C.makePool({ name: 'x', show: 'demo' });
  check(!C.isLate(noLock, { time: after }), 'no lock -> never late');
  const ents = [e1, e2];
  for (let i = 0; i < 60; i++) ents.push(C.makeEntry(pool, { name: 'P' + i, picks: demo.categories.map((c, k) => (i + k) % c.nominees.length), tb: 150 + i, time: before, rev: 1 }));
  const sh = await C.encodeStandings(pool, ents, 210);
  const sd = await C.decode(sh);
  check(sd.type === 'standings' && sd.entries.length === 62 && sd.entries.every((e) => e.ok) && sd.hostAnswer === 210, '62-entry standings round trip (' + sh.length + ' chars)');
  check(sh.length < 3000, 'standings link stays short');
  const sd0 = await C.decode(await C.encodeStandings(pool, [], null));
  check(sd0.type === 'standings' && sd0.entries.length === 0 && sd0.hostAnswer === null, 'empty standings round trip');
  check(C.findLinks('hi https://x/ballot/?ref=share#e=zAbc_-1 and #s=tQQ and #p=zXY.').join(',') === 'e=zAbc_-1,s=tQQ,p=zXY', 'findLinks pulls links out of chat text');

  console.log('tampering and junk');
  const plain = (s) => zlib.inflateRawSync(Buffer.from(s.slice(3), 'base64url')).toString();
  const repack = (t, kind) => kind + '=t' + Buffer.from(t).toString('base64url');
  const et = plain(await C.encodeEntry(pool, e1));
  const tam1 = await C.decode(repack(et.replace('\n14032134\n', '\n14032131\n'), 'e'));
  check(tam1.type === 'entry' && tam1.entry.ok === false, 'changed pick -> checksum mismatch');
  const tam2 = await C.decode(repack(et.replace('\nAna\n', '\nAnna\n'), 'e'));
  check(tam2.entry.ok === false, 'renamed -> checksum mismatch');
  const tam3 = await C.decode(repack(et.replace('\n' + before.toString(36) + '\n', '\n' + (before - 864e5).toString(36) + '\n'), 'e'));
  check(tam3.entry.ok === false, 'back-dated -> checksum mismatch');
  const tam4 = await C.decode(repack(et.replace('Smith Family Ballot', 'Other Pool'), 'e'));
  check(tam4.entry.ok === false, 'moved to another pool -> checksum mismatch');
  const full = await C.encodeEntry(pool, e1);
  let allBad = true;
  for (let k = 3; k < full.length; k++) { const r = await C.decode(full.slice(0, k)); if (!r.error && !(r.entry && r.entry.ok === false)) { allBad = false; console.log('    prefix', k, 'decoded'); } }
  check(allBad, 'every truncated entry link is rejected');
  for (const junk of ['', '#', '#x=1', '#p=', '#p=z', '#p=t!!', '#e=tAAAA', '#p=' + 'z' + 'A'.repeat(41000), '#s=' + repack('as1\n\n999\n', 's').slice(2)]) {
    const r = await C.decode(junk); check(!!r.error, 'junk rejected: ' + JSON.stringify(junk.slice(0, 20)) + ' -> ' + r.error);
  }
  const bomb = 'p=z' + zlib.deflateRawSync(Buffer.from('ab1\n' + 'a'.repeat(200000))).toString('base64url');
  check((await C.decode(bomb)).error === 'too-long', 'zip bomb capped');
  const inj = C.makePool({ name: 'Pool\n~\nab1<script>', show: 'demo' });
  const injd = await C.decode(await C.encodePool(inj));
  check(injd.type === 'pool' && !/[\n~]/.test(injd.pool.name), 'newlines and ~ cannot break the format');

  console.log('results and scoring');
  const R0 = B.noResults(demo);
  check(R0.decided === 0 && !R0.final, 'no results yet');
  const demoRes = readJson('results/demo.json');
  const R = B.readResults(demo, demoRes);
  check(R.decided === 8 && R.final && R.tb.runtime === 214, 'demo results: 8 of 8 decided, runtime 214');
  const winPicks = R.won.map((w) => w[0]);
  check(B.score(demo, 'flat', winPicks, R).points === 8, 'all right, flat = 8');
  check(B.score(demo, 'weighted', winPicks, R).points === B.maxPoints(demo, 'weighted') && B.maxPoints(demo, 'weighted') === 13, 'all right, weighted = 13 (3+2+2+2+1+1+1+1)');
  const half = { won: R.won.map((w, i) => (i < 4 ? w : null)), decided: 4, total: 8, tb: {}, final: false };
  const sp = winPicks.slice(); sp[1] = (sp[1] + 1) % demo.categories[1].nominees.length; sp[5] = -1;
  const s1 = B.score(demo, 'weighted', sp, half);
  check(s1.points === 3 + 2 + 2 && s1.correct === 3 && s1.possible === 7 + 1 + 1 + 1, 'partial results: points and still-possible max');
  const R2 = B.readResults(demo, { winners: { picture: ['moonlight laundromat', 'Captain Spreadsheet'], director: 'Nobody Real', song: '' } });
  check(JSON.stringify(R2.won[0]) === '[2,3]' && R2.won[1] === null && R2.won[5] === null && R2.decided === 1, 'ties (two winners), case-insensitive names, unknown names ignored');
  check(B.score(demo, 'flat', [3, -1, -1, -1, -1, -1, -1, -1], R2).points === 1, 'a pick matching either tied winner scores');

  console.log('tiebreak and ranking');
  const mk = (name, picks, tb, ok) => Object.assign(C.makeEntry(pool, { name, picks, tb, time: before, rev: 1 }), { ok: ok !== false });
  const allWrong = R.won.map((w, i) => (w[0] + 1) % demo.categories[i].nominees.length);
  const twoRight = allWrong.slice(); twoRight[0] = winPicks[0]; twoRight[4] = winPicks[4];
  const es = [mk('Cy', twoRight, 230), mk('Di', twoRight, 210), mk('Ed', twoRight, null), mk('Fa', winPicks, 100), mk('Gu', allWrong, 214)];
  const st = B.standings(demo, pool, es, R);
  check(st.answer === 214, 'preset tiebreak answer comes from the results file');
  check(st.rows.map((r) => r.entry.name).join(',') === 'Fa,Di,Cy,Ed,Gu', 'order: points, then closest guess, no guess last');
  check(st.rows.map((r) => r.rank).join(',') === '1,2,3,4,5', 'ranks');
  const stNo = B.standings(demo, Object.assign({}, pool, { tbKey: '' }), es, R);
  check(stNo.rows.map((r) => r.rank).join(',') === '1,2,2,2,5' && stNo.answer === null, 'no tiebreak -> shared ranks');
  const poolC = Object.assign({}, pool, { tbKey: 'custom', tbQ: 'Q?' });
  check(B.standings(demo, poolC, es, R, '').answer === null && B.standings(demo, poolC, es, R, 229).rows[1].entry.name === 'Cy', 'custom tiebreak uses the host answer');
  check(B.tbQuestion(pool, demo) === demo.tiebreakers[0].q && B.tbQuestion(poolC, demo) === 'Q?', 'tiebreak question text');
  const exact = B.standings(demo, pool, [mk('X', twoRight, 200), mk('Y', twoRight, 228)], R);
  check(exact.rows[0].rank === 1 && exact.rows[1].rank === 1, 'equally close guesses share a rank');

  console.log('awards');
  const aw = B.awards(demo, pool, st, R);
  const byId = Object.fromEntries(aw.map((a) => [a.id, a]));
  check(byId.oracle && byId.oracle.name === 'Fa' && /8 of 8/.test(byId.oracle.stat), 'Oracle = top of the pool');
  check(byId.upset && byId.upset.name === 'Fa', 'Upset caller = rarest correct pick (' + (byId.upset && byId.upset.stat) + ')');
  check(byId.contrarian && byId.contrarian.name === 'Fa', 'Contrarian found (' + (byId.contrarian && byId.contrarian.name) + ')');
  const stEdited = B.standings(demo, pool, [mk('Cheat', winPicks, 214, false), es[0], es[1]], R);
  check(B.awards(demo, pool, stEdited, R).every((a) => a.name !== 'Cheat'), 'edited links get no awards');
  check(stEdited.rows[2].entry.name === 'Cheat' && stEdited.rows[2].rank === null, 'edited links are listed last with no rank');
  check(B.awards(demo, pool, B.standings(demo, pool, [es[0]], R), R).length === 0, 'one player -> no awards');
  check(B.awards(demo, pool, B.standings(demo, pool, es, R0), R0).every((a) => a.id === 'contrarian'), 'before results only the Contrarian');

  console.log('\n' + (n - fails) + '/' + n + ' passed');
  process.exit(fails ? 1 : 0);
})();
