// Unit tests for docs/partybingo/codec.js (+ presets.js and qr.js). Run: node bots/partybingo/test_codec.js
const C = require('../../docs/partybingo/codec.js');
const P = require('../../docs/partybingo/presets.js');
let fails = 0, n = 0;
const check = (c, m) => { n++; console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  // ---------- presets
  const ids = new Set(), all = new Map();
  for (const p of P) {
    ids.add(p.id);
    check(/^[a-z]+\d+$/.test(p.id) && p.squares.length >= 24, `preset ${p.id}: versioned id, ${p.squares.length} squares (min 24)`);
    check(new Set(p.squares.map((s) => s.toLowerCase())).size === p.squares.length && p.squares.every((s) => s.length <= C.LIMITS.square && s === C.clean(s, 60)), `preset ${p.id}: no duplicates, all clean and <= 60 chars`);
    check(!/super\s*bowl|nfl|oscar|academy award|emmy|grammy|golden globe|bachelor|survivor|hallmark|dick clark|times square|gatorade|auld lang/i.test(JSON.stringify(p)), `preset ${p.id}: no trademarked names`);
  }
  check(ids.size === P.length && P.length === 6, '6 presets with unique ids');
  check(P.find((p) => p.id === 'biggame1').squares.length >= 60, 'Big Game preset has 60+ squares');

  // ---------- encode / decode round trip
  for (const p of P) {
    const g = C.makeGame({ presetId: p.id });
    check(g.presetId === p.id, `${p.id}: unedited preset keeps its id`);
    const h = await C.encode(g);
    const d = await C.decode('#' + h);
    check(!d.error && eq(d.game, g) && d.id === C.gameId(g), `${p.id}: round trip (${h.length} chars)`);
  }
  const custom = C.makeGame({ title: 'Office Watch Party 🎉', text: Array.from({ length: 40 }, (_, i) => `Square number ${i + 1} — “quoted” & <b>tags</b> = #hash?`).join('\n') });
  check(custom.presetId === '' && custom.squares.length === 40, 'custom list parsed (40 squares)');
  const hz = await C.encode(custom), ht = await C.encode(custom, { noCompress: true });
  check(/^g=z/.test(hz) && /^g=t/.test(ht) && hz.length < ht.length, `compressed link is shorter (${hz.length} vs ${ht.length} chars)`);
  check(eq((await C.decode(hz)).game, custom) && eq((await C.decode(ht)).game, custom), 'custom game round trips compressed and uncompressed');
  const edited = C.makeGame({ presetId: 'awards1', text: P[1].squares.slice(1).join('\n') });
  check(edited.presetId === '' && edited.squares.length === P[1].squares.length - 1, 'an edited preset is sent as a custom list');
  check(eq((await C.decode(await C.encode(edited))).game, edited), 'edited preset round trips');
  const big = C.makeGame({ text: Array.from({ length: 100 }, (_, i) => `A fairly long square of text, number ${i + 1}, padded out to 60`).join('\n') });
  const hb = await C.encode(big);
  check(big.squares.length === 100 && C.validate(big) === '' && eq((await C.decode(hb)).game, big), `100 long squares round trip (${hb.length} chars)`);

  // ---------- parsing and limits
  check(eq(C.parseList(' a \n\nA\n- b\n2. c\n• d\n~\nline\twith\ttabs'), ['a', 'b', 'c', 'd', 'line with tabs']), 'parseList trims, strips bullets/numbers, drops blanks, dupes and the end marker');
  check(C.parseList('x'.repeat(200)).length === 1 && C.parseList('x'.repeat(200))[0].length === 60, 'square capped at 60 characters');
  check(C.parseList(Array.from({ length: 150 }, (_, i) => 'sq ' + i).join('\n')).length === 100, 'list capped at 100 squares');
  check(C.validate(C.makeGame({ text: Array.from({ length: 23 }, (_, i) => 'sq ' + i).join('\n') })) === 'too-few', 'fewer than 24 squares is refused');
  check(C.validate(C.makeGame({ text: Array.from({ length: 24 }, (_, i) => 'sq ' + i).join('\n') })) === '', '24 squares is enough');
  check(C.makeGame({ title: 'x\ny'.repeat(40), presetId: 'newyears1' }).title.length <= 48 && !/\n/.test(C.makeGame({ title: 'a\nb', presetId: 'newyears1' }).title), 'title cleaned and capped');
  const inj = C.makeGame({ title: 'T\n~', text: Array.from({ length: 24 }, (_, i) => 'sq ' + i + '\n~\npw1').join('\n') });
  check(eq((await C.decode(await C.encode(inj))).game, inj), 'newline / end-marker injection cannot break the format');

  // ---------- bad links
  const good = await C.encode(custom);
  let truncOk = true;
  for (let k = 3; k < good.length - 1; k += 7) { const d = await C.decode(good.slice(0, k)); if (!d.error) { truncOk = false; console.log('    accepted prefix', k); } }
  check(truncOk, 'every truncated prefix of a compressed link is rejected');
  const tgood = await C.encode(custom, { noCompress: true });
  truncOk = true;
  for (let k = 3; k < tgood.length - 1; k += 5) { const d = await C.decode(tgood.slice(0, k)); if (!d.error) truncOk = false; }
  check(truncOk, 'every truncated prefix of a plain link is rejected');
  check((await C.decode('')).error === 'empty' && (await C.decode('#foo')).error === 'not-a-game' && (await C.decode('#g=z!!!')).error === 'corrupt', 'empty / foreign / bad-character hashes');
  check((await C.decode('#g=t' + 'A'.repeat(9001))).error === 'too-long', 'overlong hash refused before decoding');
  const unk = 't' + Buffer.from('pw1\nX\n@nope9\n~').toString('base64url');
  check((await C.decode('g=' + unk)).error === 'unknown-preset', 'unknown preset id refused');
  const v2 = 't' + Buffer.from('pw9\nX\n\n' + 'a\n'.repeat(30) + '~').toString('base64url');
  check((await C.decode('g=' + v2)).error === 'version', 'unknown version refused');
  // zip bomb: a tiny link that inflates past the limit
  const bomb = await (async () => { const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(new TextEncoder().encode('pw1\nT\n\n' + 'x'.repeat(5_000_000))); w.close(); const b = new Uint8Array(await new Response(cs.readable).arrayBuffer()); return 'g=z' + Buffer.from(b).toString('base64url'); })();
  check(bomb.length < 9000 && (await C.decode(bomb)).error === 'too-long', `decompression bomb (${bomb.length}-char link, 5 MB inflated) is stopped`);
  check((await C.decode('g=z' + Buffer.from('not deflate data at all').toString('base64url'))).error, 'garbage deflate data refused');

  // ---------- seeded shuffle
  const sq = P[0].squares;
  const seeds = Array.from({ length: 50 }, (_, i) => C.hash32('seed' + i));
  const cards = seeds.map((s) => C.deal(sq, s));
  check(cards.every((c) => c.length === 25 && c[12] === null && new Set(c.filter(Boolean)).size === 24 && c.filter(Boolean).every((x) => sq.includes(x))), '50 seeds: each card has 24 distinct squares from the list + free centre');
  check(new Set(cards.map(C.cardKey)).size === 50, '50 seeds give 50 different cards');
  let minDiff = 25;
  for (let i = 0; i < 50; i++) for (let j = i + 1; j < 50; j++) { let d = 0; for (let k = 0; k < 25; k++) if (cards[i][k] !== cards[j][k]) d++; minDiff = Math.min(minDiff, d); }
  check(minDiff >= 15, `any two of the 50 cards differ in at least 15 of 24 cells (min ${minDiff})`);
  const exact24 = Array.from({ length: 24 }, (_, i) => 'sq' + i);
  const c24 = seeds.map((s) => C.deal(exact24, s));
  check(new Set(c24.map(C.cardKey)).size === 50, 'with exactly 24 squares, 50 seeds still give 50 different arrangements');
  check(eq(C.deal(sq, 12345), C.deal(sq, 12345)), 'same seed, same card (a refresh keeps the card)');
  // fairness: each square appears in roughly the same share of cards
  const counts = {}; for (let s = 1; s <= 4000; s++) C.deal(sq, C.hash32('f' + s)).forEach((x) => { if (x) counts[x] = (counts[x] || 0) + 1; });
  const exp = 4000 * 24 / sq.length, vals = Object.values(counts);
  check(vals.length === sq.length && Math.min(...vals) > exp * 0.85 && Math.max(...vals) < exp * 1.15, `every square shows up evenly over 4,000 cards (${Math.min(...vals)}..${Math.max(...vals)}, expected ~${Math.round(exp)})`);
  const ps = C.printSeeds(C.makeGame({ presetId: 'biggame1' }), 60);
  check(ps.length === 60 && new Set(ps.map((s) => C.cardKey(C.deal(sq, s)))).size === 60 && eq(ps, C.printSeeds(C.makeGame({ presetId: 'biggame1' }), 60)), 'printSeeds: 60 unique cards, same on reprint');
  check(C.randomSeed() !== C.randomSeed(), 'randomSeed is random');

  // ---------- bingo detection
  const none = Array(25).fill(false);
  check(C.progress(none).bingos === 0 && C.progress(none).done === 0, 'empty card: no bingo (free centre alone is not one)');
  const mk = (idx) => { const m = Array(25).fill(false); idx.forEach((i) => (m[i] = true)); return m; };
  check(C.progress(mk([0, 1, 2, 3, 4])).bingos === 1, 'top row');
  check(C.progress(mk([2, 7, 17, 22])).bingos === 1, 'middle column through the free centre (4 marks)');
  check(C.progress(mk([10, 11, 13, 14])).bingos === 1, 'middle row through the free centre (4 marks)');
  check(C.progress(mk([0, 6, 18, 24])).bingos === 1 && C.progress(mk([4, 8, 16, 20])).bingos === 1, 'both diagonals (4 marks each)');
  check(C.progress(mk([0, 1, 2, 3])).bingos === 0 && C.progress(mk([0, 5, 10, 15])).bingos === 0 && C.progress(mk([0, 6, 18])).bingos === 0, 'four in a row without the end is not a bingo');
  check(C.progress(mk([0, 1, 2, 3, 4, 5, 10, 15, 20])).bingos === 2, 'row + column = 2 bingos');
  const full = C.progress(Array(25).fill(true));
  check(full.blackout && full.bingos === 12 && full.done === 24, 'blackout: 12 lines, 24 done');
  check(C.LINES.length === 12, '12 possible lines');

  // ---------- verify link
  const marks = mk([0, 6, 18, 24, 3]);
  const vp = C.verifyParam(4000000000, marks, 1802000000000);
  const dv = await C.decode(good + '&v=' + vp);
  check(!dv.error && dv.verify.seed === 4000000000 && eq(dv.verify.marks, mk([0, 6, 12, 18, 24, 3])) && dv.verify.time === 1802000000000, `check link round trips seed, marks and time (&v=${vp})`);
  check((await C.decode(good + '&v=zzzzzzzz.1.1')).error === 'corrupt' && (await C.decode(good + '&v=1.zzzzzz.1')).error === 'corrupt', 'bad check params refused');

  // ---------- QR encoder (structure only; scanning is checked with OpenCV in test_qr.py)
  const Q = require('../../docs/partybingo/qr.js');
  const q1 = Q.encode('HELLO'), q2 = Q.encode('https://lanternlab2027.github.io/lab/partybingo/#' + hb);
  check(q1.size === 21 && q2.size >= 21 && q2.size === q2.version * 4 + 17, `QR sizes (v${q1.version}, v${q2.version})`);

  console.log(`\n${n - fails}/${n} passed`);
  process.exit(fails ? 1 : 0);
})();
