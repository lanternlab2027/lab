// Unit tests for docs/santa/santa.js. Run: node bots/santa/test_core.js
const S = require('../../docs/santa/santa.js');
let fails = 0; const check = (c, m) => { console.log((c ? '  ok:   ' : '  FAIL: ') + m); if (!c) fails++; };
const TRIALS = 10000;

// All permutations of 0..n-1 (for exact enumeration of valid draws).
function perms(n) { const out = []; (function rec(p, used) { if (p.length === n) return out.push(p.slice());
  for (let i = 0; i < n; i++) if (!used[i]) { used[i] = 1; p.push(i); rec(p, used); p.pop(); used[i] = 0; } })([], []); return out; }
// Chi-square upper critical value at alpha=0.001 via Wilson-Hilferty.
function chiCrit(df) { const z = 3.0902; return df * Math.pow(1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df)), 3); }

function uniformity(label, n, excl) {
  const A = S.buildAllowed(n, excl);
  const valid = perms(n).filter(p => S.isValid(p, A)).map(p => p.join(','));
  const counts = Object.fromEntries(valid.map(k => [k, 0]));
  let bad = 0, unknown = 0;
  for (let t = 0; t < TRIALS; t++) {
    const p = S.draw(n, excl);
    for (let g = 0; g < n; g++) if (p[g] === g || !A[g][p[g]]) bad++;
    if (new Set(p).size !== n) bad++;
    const k = p.join(','); if (k in counts) counts[k]++; else unknown++;
  }
  check(bad === 0 && unknown === 0, `${label}: ${TRIALS} draws, none self/excluded/duplicate`);
  const exp = TRIALS / valid.length;
  const chi = valid.reduce((s, k) => s + (counts[k] - exp) ** 2 / exp, 0), crit = chiCrit(valid.length - 1);
  check(chi < crit, `${label}: uniform over all ${valid.length} valid draws (chi2=${chi.toFixed(1)} < ${crit.toFixed(1)} @ p=.001)`);
  return counts;
}

(async () => {
  console.log('[randInt]');
  const c = new Array(7).fill(0); for (let i = 0; i < 70000; i++) c[S.randInt(7)]++;
  check(c.every(x => Math.abs(x - 10000) < 500), 'randInt(7) roughly uniform: ' + c.join(' '));

  console.log('[draw]');
  uniformity('5 people, no exclusions', 5, []);
  uniformity('6 people, 2 couples', 6, [[0, 1], [2, 3]]);
  uniformity('7 people, 3 couples', 7, [[0, 1], [2, 3], [4, 5]]);
  // Marginal: in a plain 8-person group each giver gets each other person ~1/7 of the time.
  const m = Array.from({length: 8}, () => new Array(8).fill(0));
  for (let t = 0; t < TRIALS; t++) S.draw(8, []).forEach((r, g) => m[g][r]++);
  const exp = TRIALS / 7; let worst = 0;
  m.forEach((row, g) => row.forEach((x, r) => { if (g !== r) worst = Math.max(worst, Math.abs(x - exp) / exp); }));
  check(m.every((row, g) => row[g] === 0) && worst < 0.12, `8 people: per-giver marginals within ${(worst * 100).toFixed(1)}% of 1/7`);

  // Large group, random exclusions: all valid.
  let ok = true;
  for (let t = 0; t < 300; t++) {
    const n = 3 + S.randInt(40), ex = [];
    for (let k = 0; k < n / 3; k++) ex.push([S.randInt(n), S.randInt(n)]);
    let p; try { p = S.draw(n, ex); } catch (e) { if (S.maxMatching(S.buildAllowed(n, ex)) === n) ok = false; continue; }
    if (!S.isValid(p, S.buildAllowed(n, ex))) ok = false;
  }
  check(ok, '300 random groups (3-42 people, random exclusions): every draw valid, errors only when truly impossible');

  // Impossible cases.
  const throws = (n, ex) => { try { S.draw(n, ex); return false; } catch (e) { return e instanceof S.DrawError; } };
  check(throws(3, [[0, 1]]), '3 people with one couple is impossible -> DrawError');
  check(throws(4, [[0, 1], [0, 2], [0, 3]]), 'someone excluded from everyone -> DrawError');
  check(throws(2, []), 'fewer than 3 people -> DrawError');
  check(!throws(4, [[0, 1], [2, 3]]), '4 people, 2 couples is possible');
  // Fallback path (forced by maxTries: 1) still returns valid draws.
  let fb = true; for (let t = 0; t < 500; t++) { const ex = [[0, 1], [2, 3], [0, 4]]; if (!S.isValid(S.draw(6, ex, {maxTries: 1}), S.buildAllowed(6, ex))) fb = false; }
  check(fb, 'fallback assignment path: 500 draws all valid');

  console.log('[link crypto]');
  const obj = {k: 's', g: 'Smith Family 🎄 2026', n: 'Zoë', t: 'José "JJ" O\'Neil', b: '$30', d: '2026-12-19', m: 'Wrap it & keep it < $30!\nNo socks.'};
  const f1 = await S.seal(obj, 's1'), f2 = await S.seal(obj, 's1');
  const back = await S.open('#' + f1);
  check(JSON.stringify(back.data) === JSON.stringify(obj) && back.prefix === 's1', 'seal -> open round-trips unicode/quotes/newlines');
  check(f1 !== f2, 'same payload gives different links (fresh key + IV each time)');
  check(/^[A-Za-z0-9._-]+$/.test(f1) && !f1.includes('Zo') && !/Jos/.test(f1), 'fragment is URL-safe and names are not visible in it');
  const flip = f1.slice(0, -3) + (f1.slice(-3, -2) === 'A' ? 'B' : 'A') + f1.slice(-2);
  let tamper = false; try { await S.open(flip); } catch (e) { tamper = true; }
  check(tamper, 'tampered link is rejected');
  let cut = false; try { await S.open(f1.slice(0, 40)); } catch (e) { cut = true; }
  check(cut, 'truncated link is rejected');
  const [p, , body] = f1.split('.'); const otherKey = f2.split('.')[1];
  let wrong = false; try { await S.open([p, otherKey, body].join('.')); } catch (e) { wrong = true; }
  check(wrong, 'wrong key is rejected');
  const w = await S.open(await S.seal({k: 'w', n: 'Ann', w: 'books'}, 'w1'));
  check(w.prefix === 'w1' && w.data.w === 'books', 'wishlist link round-trips');

  console.log('[ics]');
  const ics = S.makeIcs({date: '2026-12-31', title: 'Secret Santa, Smith; gift', description: 'line1\nline2'});
  check(/DTSTART;VALUE=DATE:20261231/.test(ics) && /DTEND;VALUE=DATE:20270101/.test(ics), 'all-day event, end rolls over the year');
  check(/SUMMARY:Secret Santa\\, Smith\\; gift/.test(ics) && /line1\\nline2/.test(ics) && /TRIGGER:-P7D/.test(ics), 'escaping + 7-day alarm');

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
