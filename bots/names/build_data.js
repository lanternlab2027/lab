// Builds docs/names/data/ from the SSA national files (yobYYYY.txt, from names.zip).
// Run: node bots/names/build_data.js <dir containing yob*.txt>
// Output: data/meta.json, data/rising.json, data/top.json, data/s/<2 letters>.json
const fs = require('fs'), path = require('path');
const S = require('../../docs/names/stats.js');

const SRC = process.argv[2];
if (!SRC) { console.error('usage: node build_data.js <yob dir>'); process.exit(1); }
const OUT = path.resolve(__dirname, '../../docs/names/data');
const MIN_TOTAL = 200; // app includes names with 200+ births since 1880, plus every name given in the latest year

const years = fs.readdirSync(SRC).map((f) => /^yob(\d{4})\.txt$/.exec(f)).filter(Boolean).map((m) => +m[1]).sort((a, b) => a - b);
const first = years[0], latest = years[years.length - 1], N = latest - first + 1;
for (let y = first; y <= latest; y++) if (!years.includes(y)) throw new Error('missing year ' + y);

const recs = new Map(); // key name|sex -> { counts, ranks }
const totals = { F: new Array(N).fill(0), M: new Array(N).fill(0) };
const getRec = (k) => { let r = recs.get(k); if (!r) { r = { counts: new Array(N).fill(0), ranks: new Array(N).fill(0) }; recs.set(k, r); } return r; };

for (const y of years) {
  const rank = { F: 0, M: 0 }, i = y - first;
  for (const line of fs.readFileSync(path.join(SRC, `yob${y}.txt`), 'utf8').split(/\r?\n/)) {
    if (!line) continue;
    const [name, sex, c] = line.split(',');
    if (!/^[A-Z][a-z]+$/.test(name) || !(sex in totals)) throw new Error('bad line ' + y + ': ' + line);
    const r = getRec(name + '|' + sex);
    r.counts[i] = +c; r.ranks[i] = ++rank[sex]; // SSA readme: file order = rank (ties alphabetical)
    totals[sex][i] += +c;
  }
}
console.log('years', first, latest, 'name/sex pairs', recs.size);

// decade ranks: rank by total births within each decade (top 1000 only)
const decades = []; for (let d = first; d <= latest; d += 10) decades.push(d);
const decadeRank = new Map();
for (const sex of ['F', 'M']) {
  decades.forEach((d, di) => {
    const a = d - first, b = Math.min(d + 9, latest) - first;
    const list = [];
    for (const [k, r] of recs) if (k.endsWith('|' + sex)) { let s = 0; for (let i = a; i <= b; i++) s += r.counts[i]; if (s) list.push([k, s]); }
    list.sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
    list.slice(0, 1000).forEach(([k], idx) => { let arr = decadeRank.get(k); if (!arr) decadeRank.set(k, (arr = new Array(decades.length).fill(0))); arr[di] = idx + 1; });
  });
}

const L = N - 1;
const shards = {};
let kept = 0;
for (const [k, r] of recs) {
  const [name, sex] = k.split('|');
  const total = r.counts.reduce((a, b) => a + b, 0);
  if (total < MIN_TOTAL && !r.counts[L]) continue;
  kept++;
  let best = 0, bestY = 0;
  r.ranks.forEach((rk, i) => { if (rk && (!best || rk < best)) { best = rk; bestY = first + i; } });
  const enc = S.encodeCounts(r.counts, first);
  const dr = decadeRank.get(k);
  const drs = dr ? dr.map((v) => (v ? v.toString(36) : '')).join(',').replace(/,+$/, '') : '';
  const key = name.slice(0, 2).toLowerCase();
  (shards[key] = shards[key] || {});
  (shards[key][name] = shards[key][name] || {})[sex] = drs ? [enc[0], enc[1], r.ranks[L], best, bestY, drs] : [enc[0], enc[1], r.ranks[L], best, bestY];
}

fs.rmSync(path.join(OUT, 's'), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 's'), { recursive: true });
let bytes = 0;
for (const [key, obj] of Object.entries(shards)) {
  const s = JSON.stringify(obj); bytes += s.length;
  fs.writeFileSync(path.join(OUT, 's', key + '.json'), s);
}
console.log('kept', kept, 'shards', Object.keys(shards).length, 'bytes', bytes);

// rising: latest-year count >= 100 and share of births up 30%+ over five years (2-year averages: L,L-1 vs L-5,L-6)
const share = (r, sex, i) => (totals[sex][i] ? r.counts[i] / totals[sex][i] : 0);
const rising = [];
for (const [k, r] of recs) {
  const [name, sex] = k.split('|');
  if (r.counts[L] < 100) continue;
  const now = (share(r, sex, L) + share(r, sex, L - 1)) / 2, then = (share(r, sex, L - 5) + share(r, sex, L - 6)) / 2;
  const g = then > 0 ? now / then : 99;
  if (g >= 1.3) rising.push([name, sex, r.counts[L], Math.round(Math.min(g, 99) * 100) / 100]);
}
rising.sort((a, b) => b[3] - a[3]);
fs.writeFileSync(path.join(OUT, 'rising.json'), JSON.stringify(rising));
console.log('rising', rising.length);

// top 1000 per sex in the latest year (deduplicated list drives the static pages and the search suggestions)
const top = { F: [], M: [] };
for (const [k, r] of recs) { const [name, sex] = k.split('|'); if (r.ranks[L] && r.ranks[L] <= 1000) top[sex][r.ranks[L] - 1] = name; }
fs.writeFileSync(path.join(OUT, 'top.json'), JSON.stringify(top));

const meta = {
  first, latest, totals,
  source: 'U.S. Social Security Administration, "Beyond the Top 1000 Names" national data (names.zip), https://www.ssa.gov/oact/babynames/limits.html',
  caveat: 'SSA publishes a name only when at least 5 babies of one sex got it in a year, so rare names and spellings are missing. Counts come from Social Security card applications for U.S. births.',
  built: new Date().toISOString().slice(0, 10), minTotal: MIN_TOTAL,
  shards: Object.keys(shards).sort().join(' ')
};
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta));
console.log('done');
