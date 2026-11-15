// Unit tests for docs/names/stats.js. Run: node bots/names/test_stats.js
const assert = require('assert');
const fs = require('fs'), path = require('path');
const S = require('../../docs/names/stats.js');

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); } }

// synthetic world: 1880..2025, 1,000,000 births per sex every year, so counts == per-million share
const first = 1880, latest = 2025, N = latest - first + 1;
const flat = (v) => new Array(N).fill(v);
const meta = { first, latest, totals: { F: flat(1e6), M: flat(1e6) } };
const series = (fn) => Array.from({ length: N }, (_, i) => Math.max(0, Math.round(fn(first + i))));
const rec = (counts, extra = {}) => Object.assign({ counts, rank: 0, bestRank: 0, bestRankYear: 0, decadeRanks: {} }, extra);
const trendOf = (counts) => S.trend(counts.map((c) => c), first);

console.log('encode/decode');
t('encodeCounts -> decodeRec round-trips, including gaps and leading/trailing zeros', () => {
  const c = series((y) => (y < 1900 || y > 2020 ? 0 : y === 1950 ? 0 : y - 1890));
  const e = S.encodeCounts(c, first);
  assert.strictEqual(e[0], 1900);
  const d = S.decodeRec([e[0], e[1], 7, 3, 1999, '1,,a'], meta);
  assert.deepStrictEqual(d.counts, c);
  assert.strictEqual(d.rank, 7); assert.strictEqual(d.bestRank, 3); assert.strictEqual(d.bestRankYear, 1999);
  assert.deepStrictEqual(d.decadeRanks, { 1880: 1, 1900: 10 });
});
t('decodeRec handles a name only in the latest year', () => {
  const c = flat(0); c[N - 1] = 5;
  const e = S.encodeCounts(c, first);
  assert.deepStrictEqual(S.decodeRec([e[0], e[1], 30000, 30000, 2025], meta).counts, c);
});

console.log('trend');
t('rising: last 5 years 50% above the same span a decade earlier', () => {
  const tr = trendOf(series((y) => (y < 2011 ? 0 : y <= 2015 ? 200 : y <= 2020 ? 250 : 300)));
  assert.strictEqual(tr.key, 'rising'); assert.ok(/Up 50%/.test(tr.why), tr.why);
});
t('rising: brand-new name says when it first appeared', () => {
  const tr = trendOf(series((y) => (y >= 2019 ? 400 : 0)));
  assert.strictEqual(tr.key, 'rising'); assert.ok(/first recorded in 2019/.test(tr.why), tr.why);
});
t('falling: down 40%', () => {
  const tr = trendOf(series((y) => (y < 1990 ? 0 : y <= 2015 ? 500 : 300)));
  assert.strictEqual(tr.key, 'falling'); assert.ok(/Down 40%/.test(tr.why), tr.why);
});
t('vintage revival: big in the 1910s, near-gone in the 1970s, back now', () => {
  const tr = trendOf(series((y) => (y < 1940 ? 2000 : y < 2000 ? 20 : y < 2015 ? 200 : 900)));
  assert.strictEqual(tr.key, 'revival'); assert.strictEqual(tr.troughDecade >= 1950, true);
});
t('classic: every year, modest swing, still common', () => {
  const tr = trendOf(series((y) => 3000 + 1500 * Math.sin(y / 9)));
  assert.strictEqual(tr.key, 'classic');
});
t('classic needs every year since 1880 (one missing year -> not classic)', () => {
  const c = series((y) => 3000); c[50] = 0;
  assert.notStrictEqual(trendOf(c).key, 'classic');
});
t('long-term faller: level lately but <10% of its best decade', () => {
  const tr = trendOf(series((y) => (y < 1960 ? 20000 : 500)));
  assert.strictEqual(tr.key, 'falling'); assert.ok(/Long-term/.test(tr.why), tr.why);
});
t('steady: within +/-20% and not faded', () => {
  const tr = trendOf(series((y) => (y < 1990 ? 0 : 400)));
  assert.strictEqual(tr.key, 'steady');
});
t('trend uses share, not counts: doubling counts while births double is steady', () => {
  const m2 = { first, latest, totals: { F: series((y) => (y < 2016 ? 1e6 : 2e6)), M: flat(1e6) } };
  const c = series((y) => (y < 1990 ? 0 : y < 2016 ? 400 : 800));
  const r = S.report('Testa', { F: rec(c) }, m2);
  assert.strictEqual(r.trend.key, 'steady');
});

console.log('report');
const fC = series((y) => (y === 1990 ? 5000 : y === 2025 ? 300 : 100));
const mC = series((y) => (y === 2025 ? 100 : 50));
const rep = S.report('Avery', { F: rec(fC, { rank: 400, bestRank: 50, bestRankYear: 1990 }), M: rec(mC, { rank: 900, bestRank: 800, bestRankYear: 2025 }) }, meta);
t('primary sex = more babies in the latest year', () => { assert.strictEqual(rep.primary, 'F'); assert.strictEqual(rep.rank, 400); });
t('latestCount sums both sexes; sameYear = latestCount - 1', () => { assert.strictEqual(rep.latestCount, 400); assert.strictEqual(rep.sameYear, 399); });
t('split: latest-year and all-time share of girls', () => {
  assert.strictEqual(rep.split.latestF, 0.75);
  const tf = fC.reduce((a, b) => a + b), tm = mC.reduce((a, b) => a + b);
  assert.ok(Math.abs(rep.split.allF - tf / (tf + tm)) < 1e-12);
});
t('peak year and "1 in N"', () => { assert.strictEqual(rep.peak.year, 1990); assert.strictEqual(rep.peak.count, 5000); assert.strictEqual(rep.peak.oneIn, 200); });
t('peak is by share of births, not raw count', () => {
  const m2 = { first, latest, totals: { F: series((y) => (y < 1950 ? 1e5 : 2e6)), M: flat(1e6) } };
  const r = S.report('Pk', { F: rec(series((y) => (y === 1900 ? 100 : y === 2000 ? 1000 : 10))) }, m2);
  assert.strictEqual(r.peak.year, 1900); // 1000 per million in 1900 vs 500 per million in 2000
  assert.strictEqual(r.sexes.F.peakCount.year, 2000);
});
t('primary sex tie in latest year falls back to all-time total', () => {
  const r = S.report('Tie', { F: rec(series((y) => (y === 2025 ? 10 : 1))), M: rec(series((y) => (y === 2025 ? 10 : 2))) }, meta);
  assert.strictEqual(r.primary, 'M');
});
t('report of nothing is null', () => { assert.strictEqual(S.report('X', {}, meta), null); });
t('countIn and generations', () => {
  assert.strictEqual(S.countIn(rep, 1990), 5050);
  assert.strictEqual(S.countIn(rep, 1870), null);
  const g = S.generations(rep), millennials = g.find((x) => x.label === 'Millennials');
  assert.strictEqual(millennials.count, 16 * 150 + 4900); // 1981-1996 at 100+50, plus the 1990 spike
  assert.strictEqual(g[g.length - 1].to, 2025);
});
t('summary: rank 1 reads "the most popular", others get an ordinal', () => {
  const r1 = S.report('Uno', { F: rec(series(() => 900), { rank: 1, bestRank: 1, bestRankYear: 2025 }) }, meta);
  assert.ok(/was the most popular name for girls/.test(S.summary(r1)), S.summary(r1));
  assert.ok(/was the 400th most popular name for girls/.test(S.summary(rep)), S.summary(rep));
  assert.ok(/peaked in 1990, when about 1 in 200 girls/.test(S.summary(rep)));
  assert.ok(/of babies named Avery have been boys/.test(S.summary(rep)));
});
t('ordinalWord suffixes', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111, 1002].map(S.ordinalWord), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th', '1,002nd']);
});
t('pctPair never shows 0%/100% for a sex that has babies', () => {
  assert.deepStrictEqual(S.pctPair(0.9993), ['>99%', '<1%']);
  assert.deepStrictEqual(S.pctPair(1), ['100%', '0%']);
  assert.deepStrictEqual(S.pctPair(0.25), ['25%', '75%']);
});
t('seriesFor drops the other sex under 1% and draws primary last', () => {
  const r = S.report('Lop', { F: rec(series(() => 1000)), M: rec(series(() => 1)) }, meta);
  const s = S.seriesFor(r, { F: '#f', M: '#m' });
  assert.strictEqual(s.length, 1); assert.strictEqual(s[0].color, '#f');
  const s2 = S.seriesFor(rep, { F: '#f', M: '#m' });
  assert.deepStrictEqual(s2.map((x) => x.color), ['#m', '#f']);
});

console.log('similar names');
t('lev distance', () => { assert.strictEqual(S.lev('kitten', 'sitting'), 3); assert.strictEqual(S.lev('liam', 'lian'), 1); assert.strictEqual(S.lev('', 'abc'), 3); });
t('similarScore rules', () => {
  assert.strictEqual(S.similarScore('Liam', 'Lian'), 1);       // one edit
  assert.strictEqual(S.similarScore('Mary', 'Navy'), -1);      // two edits, short names: no
  assert.strictEqual(S.similarScore('Jordan', 'Jaidan'), 2);  // two edits, same first letter, 5+ letters
  assert.strictEqual(S.similarScore('Karen', 'Wren'), -1);     // two edits, different first letter
  assert.strictEqual(S.similarScore('Madison', 'Madelyn'), -1);
  assert.strictEqual(S.similarScore('Madison', 'Mason'), 2);   // two edits, same first letter
  assert.strictEqual(S.similarScore('Mackenzie', 'Maxie'), 2.5);  // first two + last two letters
  assert.strictEqual(S.similarScore('Emma', 'Emma'), -1);
});
t('similarRising: same sex first, then closest, then fastest growth', () => {
  const rising = [['Lian', 'M', 300, 2.4], ['Lyam', 'M', 200, 1.3], ['Lia', 'F', 900, 5], ['Leam', 'M', 150, 3], ['Bob', 'M', 500, 9]];
  assert.deepStrictEqual(S.similarRising('Liam', 'M', rising).map((o) => o.name), ['Leam', 'Lian', 'Lyam', 'Lia']);
  assert.strictEqual(S.similarRising('Liam', 'M', rising, 2).length, 2);
});

console.log('chart');
t('svgChart: one polyline per series, integer coordinates inside the viewBox, escaped label', () => {
  const svg = S.svgChart([{ label: 'A<b>', values: series((y) => y - 1880), color: '#000' }, { label: 'B', values: flat(10), color: '#111' }], first, { label: 'x"y', mark: 2000 });
  assert.strictEqual((svg.match(/<polyline/g) || []).length, 2);
  assert.ok(svg.includes('aria-label="x&quot;y"') && svg.includes('A&lt;b&gt;'));
  const pts = svg.match(/points="([^"]+)"/)[1].split(' ').map((p) => p.split(',').map(Number));
  assert.strictEqual(pts.length, N);
  pts.forEach(([x, y]) => assert.ok(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x <= 640 && y >= 0 && y <= 250));
  assert.ok(/<circle cx="\d+" cy="\d+" r="5" fill="#111"/.test(svg), 'mark sits on the last series');
});
t('niceMax rounds up to 1/2/2.5/5/10', () => { assert.deepStrictEqual([0, 7, 13, 23, 41, 900].map(S.niceMax), [1, 10, 20, 25, 50, 1000]); });

// ---------- real data spot checks (if built) ----------
const D = path.resolve(__dirname, '../../docs/names/data');
if (fs.existsSync(path.join(D, 'meta.json'))) {
  console.log('real data (SSA ' + JSON.parse(fs.readFileSync(path.join(D, 'meta.json'))).latest + ')');
  const M = JSON.parse(fs.readFileSync(path.join(D, 'meta.json')));
  const get = (n) => { const r = JSON.parse(fs.readFileSync(path.join(D, 's', n.slice(0, 2).toLowerCase() + '.json')))[n]; const recs = {}; for (const s in r) recs[s] = S.decodeRec(r[s], M); return S.report(n, recs, M); };
  t('years 1880-2025, 2025 totals match the yob2025 file', () => {
    assert.strictEqual(M.first, 1880); assert.strictEqual(M.latest, 2025);
    assert.strictEqual(M.totals.F[M.totals.F.length - 1], 1607267); assert.strictEqual(M.totals.M[M.totals.M.length - 1], 1708076);
  });
  t('Olivia #1 girls 2025 with 13,544; Liam #1 boys with 20,818', () => {
    const o = get('Olivia'), l = get('Liam');
    assert.strictEqual(o.sexes.F.rank, 1); assert.strictEqual(o.sexes.F.latestCount, 13544);
    assert.strictEqual(l.sexes.M.rank, 1); assert.strictEqual(l.sexes.M.latestCount, 20818);
  });
  t('known shapes: Hazel/Theodore revival, Mary/Jennifer falling, James/Elizabeth classic, Mateo/Nova rising', () => {
    const k = (n) => get(n).trend.key;
    assert.deepStrictEqual(['Hazel', 'Theodore', 'Mary', 'Jennifer', 'James', 'Elizabeth', 'Mateo', 'Nova'].map(k),
      ['revival', 'revival', 'falling', 'falling', 'classic', 'classic', 'rising', 'rising']);
  });
  t('Jennifer peaked in the 1970s; Ashley in the 1980s', () => {
    assert.ok(get('Jennifer').peak.year >= 1970 && get('Jennifer').peak.year < 1980);
    assert.ok(get('Ashley').peak.year >= 1980 && get('Ashley').peak.year < 1990);
  });
  t('every top-1000 name has a record (top.json vs shards)', () => {
    const top = JSON.parse(fs.readFileSync(path.join(D, 'top.json')));
    ['F', 'M'].forEach((s) => { assert.strictEqual(top[s].filter(Boolean).length, 1000); top[s].forEach((n, i) => { const r = get(n); assert.strictEqual(r.sexes[s].rank, i + 1, n); }); });
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
