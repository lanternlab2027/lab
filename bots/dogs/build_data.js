// Builds docs/dogs/data/ from the raw NYC Dog Licensing CSV (run fetch.sh + make_zipmap.js first).
// Run: node bots/dogs/build_data.js [path/to/dogs.csv]
// Output: meta.json, top.json (all names with a page), breeds.json, boroughs.json, s/{a..z,0}.json (lookup shards)
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./clean.js');

const CACHE = path.join(__dirname, '.cache');
const SRC = process.argv[2] || path.join(CACHE, 'dogs.csv');
const OUT = path.resolve(__dirname, '../../docs/dogs/data');
const ZIPB = require('./zip_borough.json');
const view = fs.existsSync(path.join(CACHE, 'view.json')) ? JSON.parse(fs.readFileSync(path.join(CACHE, 'view.json'))) : {};

const MIN_LOOKUP = 5;   // a name needs 5+ dogs to be looked up at all
const MIN_CELL = 5;     // any breakdown cell (breed, borough, ZIP) under 5 dogs is hidden
const MIN_PAGE = 20;    // static pages: 20+ dogs
const MAX_PAGES = 1500;
const MIN_BREED_PAGE = 300; // breed pages: breed families with 300+ named dogs
const BORO = { M: 'Manhattan', B: 'Bronx', K: 'Brooklyn', Q: 'Queens', S: 'Staten Island' };

function build(text) {
  const t0 = Date.now();
  const { dogs, total, junk } = C.dedupe(C.csvObjects(text));
  // trend years: first full issue year through the latest issue year in the data (2014 starts in September)
  let minY = 9999, maxY = 0;
  for (const d of dogs.values()) for (const y of d.years) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const firstFull = minY + 1, years = []; for (let y = firstFull; y <= maxY; y++) years.push(y);
  const yearTotals = years.map(() => 0);
  const boroTotals = { M: 0, B: 0, K: 0, Q: 0, S: 0 };

  const names = new Map(); // key -> agg
  const agg = (k) => names.get(k) || (names.set(k, { key: k, spell: new Map(), t: 0, F: 0, M: 0, births: [], y: years.map(() => 0), br: new Map(), bo: {}, z: new Map() }), names.get(k));
  const breedAll = new Map(), boroAll = { M: new Map(), B: new Map(), K: new Map(), Q: new Map(), S: new Map() }, zipAll = new Map();
  const inc = (m, k, v = 1) => m.set(k, (m.get(k) || 0) + v);

  for (const d of dogs.values()) {
    const a = agg(d.nameKey);
    for (const [s, n] of d.spellings) inc(a.spell, s, n);
    a.t++;
    if (d.gender) a[d.gender]++;
    if (d.birth) a.births.push(d.birth);
    years.forEach((y, i) => { if (d.years.has(y)) { a.y[i]++; yearTotals[i]++; } });
    if (d.breed) { inc(a.br, d.breed); const bm = breedAll.get(d.breed) || (breedAll.set(d.breed, new Map()), breedAll.get(d.breed)); inc(bm, d.nameKey); }
    const b = ZIPB[d.zip];
    if (b) { a.bo[b] = (a.bo[b] || 0) + 1; inc(boroAll[b], d.nameKey); boroTotals[b]++; }
    if (d.zip) { inc(a.z, d.zip); const zm = zipAll.get(d.zip) || (zipAll.set(d.zip, new Map()), zipAll.get(d.zip)); inc(zm, d.nameKey); }
  }

  // ranks: competition ranking by total dogs (ties share a rank)
  const ranked = [...names.values()].sort((a, b) => b.t - a.t || (a.key < b.key ? -1 : 1));
  let prev = -1, rank = 0;
  ranked.forEach((a, i) => { if (a.t !== prev) { rank = i + 1; prev = a.t; } a.rank = rank; a.display = C.pickDisplay(a.spell); });
  const rankIn = (m) => { const r = new Map(); const arr = [...m].sort((x, y) => y[1] - x[1]); let p = -1, rk = 0; arr.forEach(([k, n], i) => { if (n !== p) { rk = i + 1; p = n; } r.set(k, rk); }); return r; };
  const boroRank = {}; for (const b of Object.keys(boroAll)) boroRank[b] = rankIn(boroAll[b]);
  // ZIPs where a name is #1 (outright, 5+ dogs)
  const zipTop = new Map();
  for (const [z, m] of zipAll) {
    const arr = [...m].sort((x, y) => y[1] - x[1]);
    if (arr.length && arr[0][1] >= MIN_CELL && (arr.length < 2 || arr[0][1] > arr[1][1])) { const l = zipTop.get(arr[0][0]) || []; l.push(z); zipTop.set(arr[0][0], l); }
  }

  const lookup = ranked.filter((a) => a.t >= MIN_LOOKUP);
  const pageNames = ranked.filter((a) => a.t >= MIN_PAGE).slice(0, MAX_PAGES);
  const pageSet = new Set(pageNames.map((a) => a.key));
  const rec = (a) => {
    const top = (m, n) => [...m].filter(([, v]) => v >= MIN_CELL).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, n);
    const bo = {}, br = {};
    for (const b of Object.keys(a.bo)) if (a.bo[b] >= MIN_CELL) { bo[b] = a.bo[b]; br[b] = boroRank[b].get(a.key); }
    return {
      n: a.display, t: a.t, r: a.rank, f: a.F, m: a.M,
      b: a.births.length >= MIN_CELL ? C.median(a.births) : 0,
      y: a.y,
      br: top(a.br, 5),
      bo, bor: br,
      z: top(a.z, 5),
      z1: (zipTop.get(a.key) || []).sort(),
      p: pageSet.has(a.key) ? 1 : 0
    };
  };

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 's'), { recursive: true });
  const shards = {};
  for (const a of lookup) { const s = /^[a-z]/.test(a.key) ? a.key[0] : '0'; (shards[s] = shards[s] || {})[a.key] = rec(a); }
  let bytes = 0;
  for (const s of Object.keys(shards).sort()) { const j = JSON.stringify(shards[s]); bytes += j.length; fs.writeFileSync(path.join(OUT, 's', s + '.json'), j); }

  // breed families: top names per breed (cells >= 5)
  const breeds = [...breedAll].map(([g, m]) => ({ g, t: [...m.values()].reduce((s, v) => s + v, 0), m }))
    .filter((b) => b.t >= MIN_BREED_PAGE).sort((a, b) => b.t - a.t)
    .map((b) => ({ name: b.g, slug: C.nameKey(b.g), total: b.t, generic: C.isGenericBreed(b.g) ? 1 : 0,
      top: [...b.m].filter(([, v]) => v >= MIN_CELL).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, 50).map(([k, v]) => [names.get(k).display, k, v, pageSet.has(k) ? 1 : 0]) }));
  const boroughs = Object.keys(BORO).map((b) => ({ code: b, name: BORO[b], total: boroTotals[b],
    top: [...boroAll[b]].filter(([, v]) => v >= MIN_CELL).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, 100).map(([k, v]) => [names.get(k).display, k, v, pageSet.has(k) ? 1 : 0]) }));

  const meta = {
    source: 'NYC Dog Licensing Dataset (nu7n-tubp), NYC Open Data', dataset: 'nu7n-tubp',
    rowsUpdated: view.rowsUpdatedAt ? new Date(view.rowsUpdatedAt * 1000).toISOString().slice(0, 10) : '',
    fetched: view.fetched ? view.fetched.slice(0, 10) : '',
    firstIssue: minY, years, yearTotals, latest: maxY,
    rows: total, junkRows: junk, dogs: dogs.size, distinctNames: names.size, lookupNames: lookup.length, pageNames: pageNames.length,
    boroTotals, minLookup: MIN_LOOKUP, minCell: MIN_CELL, minPage: MIN_PAGE,
    shards: Object.keys(shards).sort().join(' ')
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
  fs.writeFileSync(path.join(OUT, 'top.json'), JSON.stringify(pageNames.map((a) => [a.display, a.key, a.t])));
  fs.writeFileSync(path.join(OUT, 'breeds.json'), JSON.stringify(breeds.map((b) => ({ name: b.name, slug: b.slug, total: b.total, generic: b.generic, top: b.top }))));
  fs.writeFileSync(path.join(OUT, 'boroughs.json'), JSON.stringify(boroughs));
  console.log(`rows ${total}, junk-name rows ${junk}, unique dogs ${dogs.size}, names ${names.size}, lookup ${lookup.length}, pages ${pageNames.length}, breeds ${breeds.length}, shard bytes ${(bytes / 1e6).toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return meta;
}

if (require.main === module) build(fs.readFileSync(SRC, 'utf8'));
module.exports = { build };
