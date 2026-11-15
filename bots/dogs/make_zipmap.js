// Builds bots/dogs/zip_borough.json: NYC ZIP -> borough code (M, B=Bronx, K=Brooklyn, Q, S).
// Method: majority borough among 311 requests since 2025 for that ZIP (erm2-nwe9); ZIPs with fewer than
// 20 such requests fall back to the majority in DOHMH restaurant inspections (43nn-pn8j). Only ZIPs
// shaped like NYC's (100xx-104xx, 110xx-116xx) are kept. ZIPs that straddle a line (e.g. 11385, 10463)
// get their majority borough.
// Run: node bots/dogs/make_zipmap.js   (after fetch.sh)
const fs = require('fs'), path = require('path');
const C = path.join(__dirname, '.cache');
const CODE = { MANHATTAN: 'M', BRONX: 'B', BROOKLYN: 'K', QUEENS: 'Q', 'STATEN ISLAND': 'S', 1: 'M', 2: 'B', 3: 'K', 4: 'Q', 5: 'S' };
const ok = (z) => /^1(0[0-4]|1[0-6])\d{2}$/.test(z);
function tally(rows, zf, bf) {
  const t = {};
  for (const r of rows) {
    const z = String(r[zf] || '').slice(0, 5), b = CODE[String(r[bf] || '').toUpperCase()] || CODE[r[bf]];
    if (!ok(z) || !b) continue;
    (t[z] = t[z] || {})[b] = (t[z][b] || 0) + +r.n;
  }
  return t;
}
const a = tally(JSON.parse(fs.readFileSync(path.join(C, 'zip_311.json'))), 'incident_zip', 'borough');
const b = tally(JSON.parse(fs.readFileSync(path.join(C, 'zip_rest.json'))), 'zipcode', 'boro');
const out = {};
const top = (o) => Object.entries(o).sort((x, y) => y[1] - x[1])[0];
const tot = (o) => Object.values(o).reduce((s, v) => s + v, 0);
for (const z of new Set([...Object.keys(a), ...Object.keys(b)])) {
  if (a[z] && tot(a[z]) >= 20) out[z] = top(a[z])[0];
  else if (b[z]) out[z] = top(b[z])[0];
  else if (a[z]) out[z] = top(a[z])[0];
}
const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
fs.writeFileSync(path.join(__dirname, 'zip_borough.json'), JSON.stringify(sorted, null, 0) + '\n');
const per = {}; for (const v of Object.values(sorted)) per[v] = (per[v] || 0) + 1;
console.log('zips', Object.keys(sorted).length, per);
