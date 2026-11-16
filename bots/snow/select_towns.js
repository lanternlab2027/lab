// Picks the places that get a Snow Day Odds town page and writes bots/snow/towns.json (checked in, so
// build_towns.js never needs the raw downloads). Deterministic: same inputs -> same file.
//
// Run: node bots/snow/select_towns.js <data dir>
//   <data dir>/gaz/NN.txt  Census 2025 Gazetteer place file per state (FIPS NN), pipe-delimited:
//                          USPS|GEOID|GEOIDFQ|ANSICODE|NAME|LSAD|FUNCSTAT|ALAND|AWATER|ALAND_SQMI|AWATER_SQMI|INTPTLAT|INTPTLONG
//   <data dir>/pop/N.csv   Census Vintage 2024 sub-county population estimates (sub-est2024_N.csv), N = FIPS
//                          without a leading zero. Columns include SUMLEV,STATE,COUNTY,PLACE,NAME,POPESTIMATE2024.
// Both are U.S. Census Bureau files (public domain). census.gov was blocked from the build container, so they
// came from GitHub mirrors; see NOTES.md ("Town pages") for the URLs and the cross-checks.
//
// Selection (documented in NOTES.md too):
//  1. Incorporated places only (sub-est2024 has no CDP estimates): SUMLEV 162 rows joined to the Gazetteer on GEOID.
//  2. Per state, the N largest by POPESTIMATE2024 (N in QUOTA below). Snow-belt and Mountain West states get most
//     of the slots; a set of southern states that rarely see snow get a few (their largest cities), skipping
//     places south of 29.4 N (South Texas, where a snow day is not a real topic).
//  3. Representative ZIP: the ZCTA (from docs/snow/z/, the app's own Census 2026 ZCTA centroids) whose internal
//     point is nearest the place's Gazetteer internal point, limited to ZIP3 prefixes that USPS assigns to that state.
//  4. Region default = the app's own rule (latitude under 36.5 = "rarely sees snow"), so a town page starts with the
//     same default the main app would guess. Visitors can switch it on the page.
'use strict';
const fs = require('fs'), path = require('path');

const DATA = process.argv[2];
if (!DATA) { console.error('usage: node select_towns.js <data dir>'); process.exit(1); }
const ZDIR = path.resolve(__dirname, '../../docs/snow/z');
const OUT = path.resolve(__dirname, 'towns.json');

// State quotas (largest N incorporated places). Total ~400.
const QUOTA = {
  // Snow belt, Northeast, Great Lakes, Upper Midwest
  NY: 35, PA: 30, OH: 30, MI: 30, IL: 25, WI: 20, MN: 20, MA: 20, NJ: 20, CT: 12, IN: 12, IA: 10,
  NH: 6, ME: 5, VT: 4, RI: 4, NE: 5, ND: 4, SD: 4,
  // Mountain West
  CO: 15, UT: 12, ID: 5, MT: 5, WY: 3,
  // Mid-Atlantic and border states where snow days are a yearly topic
  MD: 6, DC: 1, VA: 6, MO: 6, KS: 4, KY: 3, WV: 3,
  // Rarely sees snow: an inch or a glaze of ice can close schools
  TX: 10, NC: 8, TN: 6, GA: 6, SC: 4, AL: 4, OK: 3, AR: 3, LA: 3, MS: 2,
};
const FIPS = { AL: 1, AR: 5, CO: 8, CT: 9, DC: 11, GA: 13, ID: 16, IL: 17, IN: 18, IA: 19, KS: 20, KY: 21, LA: 22, ME: 23, MD: 24, MA: 25, MI: 26, MN: 27, MS: 28, MO: 29, MT: 30, NE: 31, NH: 33, NJ: 34, NY: 36, NC: 37, ND: 38, OH: 39, OK: 40, PA: 42, RI: 44, SC: 45, SD: 46, TN: 47, TX: 48, UT: 49, VT: 50, VA: 51, WV: 54, WI: 55, WY: 56 };
const MIN_LAT = 29.4;
// USPS ZIP3 prefix ranges per state (inclusive), used only to keep a border city's ZIP in its own state.
const ZIP3 = {
  AL: [[350, 369]], AR: [[716, 729]], CO: [[800, 816]], CT: [[60, 69]], DC: [[200, 200], [202, 205]], GA: [[300, 319], [398, 399]],
  ID: [[832, 838]], IL: [[600, 629]], IN: [[460, 479]], IA: [[500, 528]], KS: [[660, 679]], KY: [[400, 427]], LA: [[700, 714]],
  ME: [[39, 49]], MD: [[206, 219]], MA: [[10, 27], [55, 55]], MI: [[480, 499]], MN: [[550, 567]], MS: [[386, 397]],
  MO: [[630, 658]], MT: [[590, 599]], NE: [[680, 693]], NH: [[30, 38]], NJ: [[70, 89]], NY: [[5, 5], [100, 149]],
  NC: [[270, 289]], ND: [[580, 588]], OH: [[430, 459]], OK: [[730, 749]], PA: [[150, 196]], RI: [[28, 29]], SC: [[290, 299]],
  SD: [[570, 577]], TN: [[370, 385]], TX: [[733, 733], [750, 799], [885, 885]], UT: [[840, 847]], VT: [[50, 54], [56, 59]],
  VA: [[201, 201], [220, 246]], WV: [[247, 268]], WI: [[530, 549]], WY: [[820, 831]],
};
const STATE_NAMES = { AL: 'Alabama', AR: 'Arkansas', CO: 'Colorado', CT: 'Connecticut', DC: 'District of Columbia', GA: 'Georgia', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NH: 'New Hampshire', NJ: 'New Jersey', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };

// Census legal names -> everyday names. Consolidated governments keep only the city part.
const NAME_FIX = {
  'Nashville-Davidson metropolitan government (balance)': 'Nashville',
  'Louisville/Jefferson County metro government (balance)': 'Louisville',
  'Lexington-Fayette urban county': 'Lexington',
  'Augusta-Richmond County consolidated government (balance)': 'Augusta',
  'Athens-Clarke County unified government (balance)': 'Athens',
  'Columbus city (balance)': 'Columbus',
  'Macon-Bibb County': 'Macon',
  'Indianapolis city (balance)': 'Indianapolis',
  'Boise City city': 'Boise',
  'Urban Honolulu CDP': 'Honolulu',
  'Butte-Silver Bow (balance)': 'Butte',
  'Anaconda-Deer Lodge County': 'Anaconda',
  'Washington city': 'Washington',
  'Lynchburg city': 'Lynchburg',
  'Weymouth Town city': 'Weymouth',
  'New York city': 'New York City',
};
const SUFFIX = / (city|town|village|borough|township|municipality|charter township|plantation|consolidated government|unified government|metro government|metropolitan government|urban county)( \(balance\))?$/;

function cleanName(n) {
  if (NAME_FIX[n]) return NAME_FIX[n];
  let s = n.replace(/ \(balance\)$/, '');
  s = s.replace(SUFFIX, '');
  return s.trim();
}
function slug(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function km(a, b) {
  const R = 6371, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function csvRow(line) { // sub-est files have no quoted commas in place rows we use, but be safe
  const out = []; let cur = '', q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out;
}

// ---- ZCTAs from the app's own shards ----
const zips = [];
for (const f of fs.readdirSync(ZDIR).filter((f) => /^\d\d\.json$/.test(f)).sort()) {
  const sh = JSON.parse(fs.readFileSync(path.join(ZDIR, f), 'utf8'));
  for (const k of Object.keys(sh).sort()) zips.push({ zip: f.slice(0, 2) + k, ll: sh[k] });
}
function inState(zip, st) { const p = +zip.slice(0, 3); return ZIP3[st].some(([a, b]) => p >= a && p <= b); }

const towns = [];
for (const st of Object.keys(QUOTA).sort()) {
  const fips = FIPS[st], f2 = String(fips).padStart(2, '0');
  const gaz = {};
  const gl = fs.readFileSync(path.join(DATA, 'gaz', f2 + '.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
  const gh = gl[0].split('|').map((s) => s.trim());
  for (const line of gl.slice(1)) {
    const c = line.split('|').map((s) => s.trim()); const o = {}; gh.forEach((h, i) => { o[h] = c[i]; });
    if (o.USPS !== st) throw new Error('state mismatch in gaz ' + f2);
    gaz[o.GEOID] = o;
  }
  const pl = fs.readFileSync(path.join(DATA, 'pop', fips + '.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const ph = csvRow(pl[0]);
  const rows = pl.slice(1).map((l) => { const c = csvRow(l); const o = {}; ph.forEach((h, i) => { o[h] = c[i]; }); return o; });
  const counties = {}; // county code -> name
  for (const r of rows) if (r.SUMLEV === '050') counties[r.COUNTY] = r.NAME;
  const parts = {}; // place -> [{county, pop}]
  for (const r of rows) if (r.SUMLEV === '157') (parts[r.PLACE] = parts[r.PLACE] || []).push({ county: counties[r.COUNTY], pop: +r.POPESTIMATE2024 });
  const cands = [];
  for (const r of rows) {
    if (r.SUMLEV !== '162' || +r.STATE !== fips) continue;
    const g = gaz[f2 + r.PLACE];
    if (!g) continue; // e.g. a place dissolved after 2024
    const lat = +g.INTPTLAT, lon = +g.INTPTLONG;
    if (lat < MIN_LAT) continue;
    cands.push({ r, g, lat, lon, pop: +r.POPESTIMATE2024 });
  }
  cands.sort((a, b) => b.pop - a.pop || a.r.PLACE.localeCompare(b.r.PLACE));
  const seen = new Set();
  for (const c of cands) {
    if (towns.filter((t) => t.st === st).length >= QUOTA[st]) break;
    const name = cleanName(c.g.NAME);
    let s = slug(name);
    if (seen.has(s)) s = s + '-' + c.r.PLACE; // never happens in the current data; kept for determinism
    seen.add(s);
    let best = null, bd = Infinity;
    for (const z of zips) { if (!inState(z.zip, st)) continue; const d = km([c.lat, c.lon], z.ll); if (d < bd) { bd = d; best = z; } }
    const pp = (parts[c.r.PLACE] || []).filter((p) => p.county).sort((a, b) => b.pop - a.pop);
    towns.push({
      st, state: STATE_NAMES[st], name, slug: s, censusName: c.g.NAME, geoid: c.g.GEOID,
      lat: c.lat, lon: c.lon, pop2024: c.pop, landSqMi: +c.g.ALAND_SQMI,
      counties: pp.map((p) => p.county), mainCounty: pp.length ? pp[0].county : null,
      zip: best.zip, zipKm: Math.round(bd * 10) / 10,
      region: c.lat < 36.5 ? 'rare' : 'used',
    });
  }
}
towns.sort((a, b) => a.st.localeCompare(b.st) || b.pop2024 - a.pop2024);
const far = towns.filter((t) => t.zipKm > 5);
fs.writeFileSync(OUT, JSON.stringify({
  generated: 'node bots/snow/select_towns.js (see header for method)',
  sources: [
    'U.S. Census Bureau, 2025 Gazetteer Files, Places (per-state files): names, internal points, land area',
    'U.S. Census Bureau, Vintage 2024 Population Estimates, sub-county (sub-est2024): POPESTIMATE2024, county parts',
    'U.S. Census Bureau, 2026 Gazetteer Files, ZCTAs (docs/snow/z/): representative ZIP',
  ],
  count: towns.length, towns,
}, null, 1) + '\n');
console.log('wrote', towns.length, 'towns to', OUT);
if (far.length) console.log('ZIP more than 5 km from place point:', far.map((t) => t.name + ', ' + t.st + ' ' + t.zip + ' ' + t.zipKm + 'km').join('; '));
