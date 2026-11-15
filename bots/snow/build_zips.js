// Builds docs/snow/z/NN.json (ZIP -> [lat, lon]) shards from a national ZCTA centroid JSON.
// Source data: U.S. Census Bureau 2026 Gazetteer ZCTA national file (INTPTLAT/INTPTLONG), public domain.
// Run: node bots/snow/build_zips.js <path to {"ZIP":[lat,lon],...} json>
// The JSON we used is a mirror of that Census file (see NOTES.md for provenance and cross-checks).
'use strict';
const fs = require('fs'), path = require('path');
const src = process.argv[2];
if (!src) { console.error('usage: node build_zips.js <zcta.json>'); process.exit(1); }
const all = JSON.parse(fs.readFileSync(src, 'utf8'));
const OUT = path.resolve(__dirname, '../../docs/snow/z');
fs.mkdirSync(OUT, { recursive: true });
const shards = {};
let n = 0;
for (const zip of Object.keys(all).sort()) {
  if (!/^\d{5}$/.test(zip)) throw new Error('bad zip ' + zip);
  const [lat, lon] = all[zip];
  if (!(lat > -20 && lat < 75 && lon > -180 && lon < 180)) throw new Error('bad coords ' + zip);
  const k = zip.slice(0, 2);
  (shards[k] = shards[k] || {})[zip.slice(2)] = [Math.round(lat * 1000) / 1000, Math.round(lon * 1000) / 1000];
  n++;
}
for (const k of Object.keys(shards)) fs.writeFileSync(path.join(OUT, k + '.json'), JSON.stringify(shards[k]));
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ source: 'U.S. Census Bureau, 2026 Gazetteer Files, ZCTA national (internal points)', zips: n, shards: Object.keys(shards).sort() }));
console.log('wrote', Object.keys(shards).length, 'shards,', n, 'ZIPs');
