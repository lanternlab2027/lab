// Unit tests: cleaning, dedupe, stats helpers, and checks on the built data (if docs/dogs/data exists).
// Run: node bots/dogs/test_clean.js
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./clean.js');
const S = require('../../docs/dogs/stats.js');
let fails = 0, n = 0;
const eq = (a, b, m) => { n++; const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('  FAIL ' + m + ': got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); } };
const ok = (c, m) => eq(!!c, true, m);

// ---- name keys and junk ----
eq(C.nameKey('  BELLA '), 'bella', 'key trims + lowercases');
eq(C.nameKey('Jay-Jay'), C.nameKey('JAY JAY'), 'hyphen == space');
eq(C.nameKey('A.J.'), 'aj', 'dotted initials collapse');
eq(C.nameKey('A. J.'), 'aj', 'spaced initials collapse');
eq(C.nameKey("REESE'S"), 'reeses', 'apostrophe dropped');
eq(C.nameKey('MR.PICKLES'), 'mr-pickles', 'dot separates words');
eq(C.nameKey('Chlo\u00e9'), 'chloe', 'accents folded');
for (const j of ['UNKNOWN', 'unknown', 'NAME NOT PROVIDED', 'NAME', 'NAME?', 'N/A', 'N.A.', 'NA', 'NONE', 'NONAME', 'UNKOWN', 'UNKNOWED', 'TBD', '', '   ', '.', 'A', 'X', 'MR.', 'DR.', 'OGDEN16668022', 'NCR6627', null, undefined])
  ok(C.isJunkName(j), 'junk: ' + JSON.stringify(j));
for (const g of ['BELLA', 'LUNA', 'BO', 'JJ', 'A.J.', 'MR. PICKLES', 'K9', 'BABY', 'DOG', "D'ARTAGNAN", 'MAX'])
  ok(!C.isJunkName(g), 'kept: ' + g);

// ---- display ----
eq(C.displayName('BELLA'), 'Bella', 'title case');
eq(C.displayName('JAY-JAY'), 'Jay-Jay', 'hyphen title case');
eq(C.displayName("REESE'S"), "Reese's", 'apostrophe kept, no cap after it');
eq(C.displayName('MR.PICKLES'), 'Mr. Pickles', 'space after title dot');
eq(C.displayName('a.j.'), 'AJ', 'initials upper');
eq(C.displayName('BONITA,'), 'Bonita', 'trailing punctuation stripped');
eq(C.displayName('mia!'), 'Mia', 'bang stripped');
eq(C.displayName('LEO-'), 'Leo', 'trailing hyphen stripped');
eq(C.pickDisplay(new Map([['LUNA', 50], ['LUNA.', 2], ['LUNA ', 1]])), 'Luna', 'most common spelling wins');
eq(C.pickDisplay(new Map([['JAY-JAY', 3], ['JAY JAY', 3]])), 'Jay Jay', 'tie: fewer non-letters... equal, then alphabetical');
eq(C.pickDisplay(new Map([['A.J.', 3], ['AJ', 3]])), 'AJ', 'tie: fewer non-letters wins');

// ---- breeds ----
eq(C.breedGroup('Chihuahua Crossbreed'), 'Chihuahua', 'crossbreed -> base');
eq(C.breedGroup('Terrier mix'), 'Terrier', 'mix suffix');
eq(C.breedGroup('American Pit Bull Mix / Pit Bull Mix'), 'Pit Bull', 'pit bull mix alias checked before suffix strip');
eq(C.breedGroup('American Pit Bull Terrier/Pit Bull'), 'Pit Bull', 'pit bull alias');
eq(C.breedGroup('Poodle, Toy'), 'Poodle', 'poodle sizes merge');
eq(C.breedGroup('Schnauzer, Miniature Crossbreed'), 'Miniature Schnauzer', 'suffix then alias');
eq(C.breedGroup('Welsh Corgi, Pembroke'), 'Corgi', 'corgi');
eq(C.breedGroup('Cotton De Tulear'), 'Coton de Tulear', 'coton spelling');
eq(C.breedGroup('American Eskimo dog'), 'American Eskimo Dog', 'capitalised');
eq(C.breedGroup('Unknown'), null, 'unknown -> null');
eq(C.breedGroup('Not Provided'), null, 'not provided -> null');
eq(C.breedGroup(''), null, 'blank -> null');
ok(C.isGenericBreed('Terrier') && !C.isGenericBreed('Beagle'), 'generic breed flag');

// ---- fields ----
eq(C.birthYear('2014', 2016), 2014, 'birth year');
eq(C.birthYear('1014', 2016), 0, 'birth typo rejected');
eq(C.birthYear('2019', 2016), 0, 'birth after first license rejected');
eq(C.birthYear('ERROR: #VALUE!', 2016), 0, 'birth error rejected');
eq(C.zip5('10035'), '10035', 'zip');
eq(C.zip5('1003'), '', '4-digit zip rejected');
eq(C.zip5('07030'), '', 'NJ zip rejected');
eq(C.year('2014-09-12T00:00:00.000'), 2014, 'issue year');
eq(C.median([2010, 2014, 2012]), 2012, 'median odd');
eq(C.median([2010, 2013]), 2012, 'median even rounds');
eq(C.median([]), 0, 'median empty');

// ---- CSV ----
eq([...C.parseCSV('a,b\n"x, y","he said ""hi"""\n')], [['a', 'b'], ['x, y', 'he said "hi"']], 'csv quotes');
eq([...C.csvObjects('a,b\r\n1,2\r\n')], [{ a: '1', b: '2' }], 'csv objects + CRLF');

// ---- dedupe ----
const row = (name, g, birth, breed, zip, issued, extract) => ({ animalname: name, animalgender: g, animalbirth: birth, breedname: breed, zipcode: zip, licenseissueddate: issued + '-01-05T00:00:00.000', licenseexpireddate: '', extract_year: extract });
const rows = [
  row('LUNA', 'F', '2015', 'Chihuahua', '10025', '2016', '2016'),
  row('LUNA', 'F', '2015', 'Chihuahua', '10025', '2016', '2017'), // same license, next extract
  row('Luna ', 'F', '2015', 'CHIHUAHUA', '10025', '2019', '2022'), // renewal, case/space differences
  row('LUNA', 'M', '2015', 'Chihuahua', '10025', '2020', '2022'), // gender flipped once
  row('LUNA', 'F', '2016', 'Chihuahua', '10025', '2017', '2017'), // different birth year -> different dog
  row('LUNA', 'F', '2015', 'Chihuahua', '11215', '2017', '2017'), // different ZIP -> different dog
  row('UNKNOWN', 'F', '2015', 'Chihuahua', '10025', '2017', '2017'),
  row('NAME NOT PROVIDED', 'M', '2015', 'Beagle', '10025', '2017', '2017')
];
const dd = C.dedupe(rows);
eq(dd.total, 8, 'dedupe: rows seen');
eq(dd.junk, 2, 'dedupe: junk rows dropped');
eq(dd.dogs.size, 3, 'dedupe: 6 named rows -> 3 dogs');
const first = [...dd.dogs.values()].find((d) => d.rows === 4);
ok(first && first.gender === 'F' && [...first.years].sort().join() === '2016,2019,2020' && first.birth === 2015, 'dedupe: merged dog has majority gender, all issue years, birth year');

// ---- stats (docs/dogs/stats.js) ----
const meta = { years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], yearTotals: Array(11).fill(10000) };
const mk = (y) => ({ n: 'X', t: y.reduce((a, b) => a + b, 0), r: 9, f: 1, m: 1, b: 2018, y, br: [], bo: {}, bor: {}, z: [], z1: [], p: 0 });
eq(S.trend(mk([10, 10, 10, 10, 10, 10, 10, 10, 20, 20, 20]), meta).key, 'rising', 'trend rising');
eq(S.trend(mk([20, 20, 20, 10, 10, 10, 10, 10, 10, 10, 10]), meta).key, 'falling', 'trend falling');
eq(S.trend(mk([10, 10, 10, 10, 10, 10, 10, 10, 11, 10, 10]), meta).key, 'steady', 'trend steady');
eq(S.trend(mk([0, 0, 0, 0, 5, 5, 10, 10, 20, 20, 20]), meta).key, 'new', 'trend newcomer');
const pk = S.peak(mk([1, 2, 3, 9, 2, 1, 1, 1, 1, 1, 1]), { years: meta.years, yearTotals: [100, 100, 100, 1000, 100, 100, 100, 100, 100, 100, 100] });
eq(pk.year, 2017, 'peak by share, not count');
eq(S.fmt(1234), '1,234', 'fmt');
eq(S.esc('<a "b">&'), '&lt;a &quot;b&quot;&gt;&amp;', 'esc');
eq(S.ordinal(1), '1st', 'ordinal'); eq(S.ordinal(12), '12th', 'ordinal 12'); eq(S.ordinal(22), '22nd', 'ordinal 22');
ok(/<svg[^>]+viewBox/.test(S.svgChart([{ label: 'a<b', values: [1, 2, 3], color: '#000' }], [2015, 2016, 2017], {})) && !/a<b/.test(S.svgChart([{ label: 'a<b', values: [1, 2, 3], color: '#000' }], [2015, 2016, 2017], {})), 'svg chart escapes labels');
eq(S.boroLine({ bo: { M: 10, K: 30, Q: 5 } }).code, 'K', 'top borough');

// ---- built data (real numbers) ----
const D = path.resolve(__dirname, '../../docs/dogs/data');
if (fs.existsSync(path.join(D, 'meta.json'))) {
  const m = JSON.parse(fs.readFileSync(path.join(D, 'meta.json')));
  const top = JSON.parse(fs.readFileSync(path.join(D, 'top.json')));
  ok(m.rows > 800000 && m.dogs > 300000 && m.dogs < m.rows, 'data: dedupe shrinks ' + m.rows + ' rows to ' + m.dogs + ' dogs');
  eq(m.years[0], m.firstIssue + 1, 'data: trend starts at first full issue year');
  ok(top.length <= 1500 && top.every((t) => t[2] >= m.minPage), 'data: pages only for names with ' + m.minPage + '+ dogs');
  ok(!top.some((t) => C.isJunkName(t[0]) || C.JUNK.has(t[1])), 'data: no junk names among page names');
  ok(top[0][0] === 'Bella' && top[1][0] === 'Luna', 'data: Bella #1, Luna #2 (' + top.slice(0, 3).map((t) => t[0]).join(', ') + ')');
  let cellsOk = true, lookupOk = true, ranksOk = true, prev = Infinity;
  for (const f of fs.readdirSync(path.join(D, 's'))) {
    const sh = JSON.parse(fs.readFileSync(path.join(D, 's', f)));
    for (const [k, r] of Object.entries(sh)) {
      if (r.t < m.minLookup) lookupOk = false;
      if (r.br.some((x) => x[1] < m.minCell) || r.z.some((x) => x[1] < m.minCell) || Object.values(r.bo).some((v) => v < m.minCell)) cellsOk = false;
      if (k !== C.nameKey(r.n)) ranksOk = false;
    }
  }
  for (const t of top) { if (t[2] > prev) ranksOk = false; prev = t[2]; }
  ok(lookupOk, 'data: every lookup name has ' + m.minLookup + '+ dogs');
  ok(cellsOk, 'data: no breed/borough/ZIP cell under ' + m.minCell);
  ok(ranksOk, 'data: keys match display names; top list sorted');
  const sumY = m.yearTotals.reduce((a, b) => a + b, 0); ok(sumY >= m.dogs * 0.9, 'data: year totals cover the dogs (dogs can span years)');
  const bo = JSON.parse(fs.readFileSync(path.join(D, 'boroughs.json')));
  ok(bo.length === 5 && bo.every((b) => b.top.length >= 50), 'data: five boroughs with top lists');
}

console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
