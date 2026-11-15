// Unit tests for the Chicago result/risk logic. Run: node --test bots/chi-eats/test_results.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../docs/chi-eats/results.js');
const S = require('../../docs/chi-eats/soda.js');
const VS = require('../../docs/chi-eats/violations.js');
const FX = require('./fixtures.js');

test('normResult maps every published label, and never invents a grade', () => {
  assert.equal(R.normResult('Pass').key, 'pass');
  assert.equal(R.normResult('Pass w/ Conditions').key, 'cond');
  assert.equal(R.normResult('PASS WITH CONDITIONS').key, 'cond');
  assert.equal(R.normResult('Fail').key, 'fail');
  assert.equal(R.normResult('Out of Business').key, 'oob');
  assert.equal(R.normResult('No Entry').key, 'noentry');
  assert.equal(R.normResult('Not Ready').key, 'notready');
  assert.equal(R.normResult('Business Not Located').key, 'notlocated');
  assert.equal(R.normResult('Something else').key, 'other');
  assert.equal(R.normResult('').key, 'other');
  for (const k of ['pass', 'cond', 'fail']) assert.equal(R.RESULTS[k].outcome, true);
  for (const k of ['oob', 'noentry', 'notready', 'notlocated', 'other']) assert.equal(R.RESULTS[k].outcome, false);
  const all = JSON.stringify(R.RESULTS);
  assert.doesNotMatch(all, /\bgrade\b|\bA\b grade|letter/i);
});

test('result definitions follow CDPH wording', () => {
  assert.match(R.RESULTS.pass.def, /No priority or priority foundation violations/);
  assert.match(R.RESULTS.cond.def, /corrected on site/);
  assert.match(R.RESULTS.fail.def, /could not be corrected during the inspection/);
  assert.match(R.RESULTS.oob.def, /^Not an inspection result/);
});

test('parseRisk', () => {
  assert.deepEqual(R.parseRisk('Risk 1 (High)'), { level: 1, label: 'High', freq: 'inspected twice a year', text: 'Risk 1 (High)' });
  assert.equal(R.parseRisk('Risk 2 (Medium)').freq, 'inspected once a year');
  assert.equal(R.parseRisk('Risk 3 (Low)').freq, 'inspected every other year');
  assert.equal(R.parseRisk('All').label, 'All');
  assert.equal(R.parseRisk('All').level, null);
  assert.equal(R.parseRisk(''), null);
  assert.equal(R.parseRisk(undefined), null);
  assert.match(R.riskExplainer(R.parseRisk('Risk 1 (High)')), /not how the place performed/);
  assert.match(R.riskExplainer(R.parseRisk('All')), /don.t define/);
});

test('parseViolations splits items, keeps official text, re-joins stray pipes', () => {
  const v = R.parseViolations(FX.V.coldHolding + ' | ' + FX.V.mystery + ' | ' + FX.V.floors);
  assert.equal(v.length, 3);
  assert.equal(v[0].num, 22);
  assert.equal(v[0].title, 'PROPER COLD HOLDING TEMPERATURES');
  assert.match(v[0].comments, /^OBSERVED TCS FOODS/);
  assert.equal(v[0].severity, 'p');
  assert.equal(v[1].num, 99);
  assert.match(v[1].comments, /A \| PIPE INSIDE/);
  assert.equal(v[2].severity, null);
  assert.deepEqual(R.parseViolations(''), []);
  assert.deepEqual(R.parseViolations(undefined), []);
  const noComment = R.parseViolations('5. PROCEDURES FOR RESPONDING TO VOMITING AND DIARRHEAL EVENTS');
  assert.equal(noComment[0].title, 'PROCEDURES FOR RESPONDING TO VOMITING AND DIARRHEAL EVENTS');
  assert.equal(noComment[0].comments, '');
});

test('severity comes only from what the inspector wrote', () => {
  assert.equal(R.severity(FX.V.rodent.split('Comments: ')[1]), 'pf');
  assert.equal(R.severity('PREVIOUS PRIORITY VIOLATION NOT CORRECTED. PRIORITY VIOLATION 7-42-090.'), 'p');
  assert.equal(R.severity('PREVIOUS PRIORITY VIOLATION NOT CORRECTED. CORE VIOLATION 7-42-090.'), 'core');
  assert.equal(R.severity('INSTRUCTED TO CLEAN'), null);
});

test('groupInspections dedupes by inspection id and sorts newest first', () => {
  const ins = R.groupInspections(FX.RESTAURANTS['1000001']);
  assert.equal(ins.length, 4);
  assert.deepEqual(ins.map((i) => i.date), ['2026-10-02', '2025-09-19', '2025-09-09', '2024-03-14']);
  assert.equal(ins[0].type, 'Canvass');
  assert.equal(ins[1].type, 'Canvass Re-Inspection');
  assert.equal(ins[2].violations.length, 3);
});

test('summarize: Pass latest', () => {
  const sum = R.summarize(R.groupInspections(FX.RESTAURANTS['1000001']), '2026-11-15');
  assert.equal(sum.latest.result.key, 'pass');
  assert.equal(sum.lastOutcome, sum.latest);
  assert.equal(sum.risk.level, 1);
  assert.deepEqual(sum.counts, { pass: 2, cond: 1, fail: 1, other: 0 });
  assert.equal(sum.notes.length, 0);
  assert.equal(R.headline("Lou's Sample Diner", sum), "Lou's Sample Diner passed its last inspection on Oct 2, 2026.");
  assert.equal(R.capFirst(R.phrase(sum)), 'Passed its last inspection on Oct 2, 2026');
});

test('summarize: Pass with Conditions and Fail phrasing', () => {
  const c = R.summarize(R.groupInspections(FX.RESTAURANTS['1000002']), '2026-11-15');
  assert.equal(R.phrase(c), 'passed with conditions at its last inspection on Aug 21, 2026');
  assert.equal(c.risk.level, 2);
  const f = R.summarize(R.groupInspections(FX.RESTAURANTS['1000003']), '2026-11-15');
  assert.equal(R.phrase(f), 'failed its last inspection on Nov 3, 2026');
  assert.ok(f.notes.some((n) => n.kind === 'fail' && /re-inspects/.test(n.text) && /2.3 weeks/.test(n.text)));
});

test('summarize: non-outcome latest points to last completed inspection', () => {
  const o = R.summarize(R.groupInspections(FX.RESTAURANTS['1000004']), '2026-11-15');
  assert.equal(o.latest.result.key, 'oob');
  assert.equal(o.lastOutcome.result.key, 'pass');
  assert.match(R.phrase(o), /Out of Business.*Jun 10, 2026/);
  assert.ok(o.notes.some((n) => n.kind === 'nonoutcome' && /last completed inspection, on May 2, 2025, was Pass/.test(n.text)));
  assert.ok(o.notes.some((n) => n.kind === 'oob'));
  const ne = R.summarize(R.groupInspections(FX.RESTAURANTS['1000005']), '2026-11-15');
  assert.match(R.phrase(ne), /No Entry/);
  assert.doesNotMatch(R.phrase(ne), /passed|failed/);
  assert.equal(ne.lastOutcome.result.key, 'cond');
});

test('summarize: pre-2018 and stale notes', () => {
  const s = R.summarize(R.groupInspections(FX.RESTAURANTS['1000006']), '2026-11-15');
  assert.ok(s.notes.some((n) => n.kind === 'old-rules'));
  assert.ok(s.notes.some((n) => n.kind === 'stale'));
  assert.equal(s.risk.level, 3);
  assert.equal(R.summarize([], '2026-11-15').latest, null);
  assert.equal(R.phrase(R.summarize([])), 'has no inspection records in the data');
});

test('identity prefers AKA when it differs, keeps license', () => {
  const id = R.identity(FX.RESTAURANTS['1000002']);
  assert.equal(id.name, 'Taco Test');
  assert.equal(id.dba, 'Tt Holdings LLC'.replace('LLC', 'Llc'));
  assert.equal(id.license, '1000002');
  assert.equal(id.address, '2001 W Division St');
  const lou = R.identity(FX.RESTAURANTS['1000001']);
  assert.equal(lou.name, "Lou's Sample Diner");
});

test('fmtDate / titleCase', () => {
  assert.equal(R.fmtDate('2026-10-02T00:00:00.000'), 'Oct 2, 2026');
  assert.equal(R.fmtDate('2026-10-02', true), 'October 2, 2026');
  assert.equal(R.fmtDate('nope'), '');
  assert.equal(R.titleCase('1500 W 18TH ST'), '1500 W 18th St');
});

test('countsLine', () => {
  const ins = R.groupInspections(FX.RESTAURANTS['1000001']);
  assert.equal(R.countsLine(R.summarize(ins), ins), '4 records since 2024: 2 Pass, 1 Pass with Conditions, 1 Fail.');
});

test('violations.plain matches post- and pre-2018 titles; unknown gets none', () => {
  assert.match(VS.plain('PROPER COLD HOLDING TEMPERATURES'), /Cold food/);
  assert.match(VS.plain('INSECTS, RODENTS, & ANIMALS NOT PRESENT'), /rodents/);
  assert.match(VS.plain('PREVIOUS PRIORITY VIOLATION CORRECTED'), /earlier inspection/);
  assert.match(VS.plain('ADEQUATE HANDWASHING SINKS PROPERLY SUPPLIED AND ACCESSIBLE'), /handwashing sink/);
  assert.match(VS.plain('HANDS CLEAN & PROPERLY WASHED'), /wash their hands/);
  assert.match(VS.plain('CITY OF CHICAGO FOOD SERVICE SANITATION CERTIFICATE'), /certificate/);
  assert.match(VS.plain('FLOORS: CONSTRUCTED PER CODE, CLEANED, GOOD REPAIR'), /Floors/);
  assert.match(VS.plain('NO EVIDENCE OF RODENT OR INSECT OUTER OPENINGS PROTECTED/RODENT PROOFED'), /rodents/);
  assert.match(VS.plain('TOILET FACILITIES: PROPERLY CONSTRUCTED, SUPPLIED, & CLEANED'), /Toilet/);
  assert.match(VS.plain('FOOD & NON-FOOD CONTACT SURFACES CLEANABLE, PROPERLY DESIGNED, CONSTRUCTED & USED'), /poor repair/);
  assert.match(VS.plain('NON-FOOD/FOOD CONTACT SURFACES CLEAN'), /dirty/);
  assert.match(VS.plain('WALLS, CEILINGS, ATTACHED EQUIPMENT CONSTRUCTED PER CODE'), /walls/);
  assert.equal(VS.plain('SOMETHING NEW WE HAVE NO SUMMARY FOR'), '');
  assert.equal(VS.plain(''), '');
});

test('soda: search builders', () => {
  const n = S.searchParams("Lou's diner");
  assert.equal(n.mode, 'name');
  assert.match(n.params.$where, /upper\(dba_name\) like '%LOU%S%' OR upper\(aka_name\) like '%LOU%S%'/);
  assert.match(n.params.$limit, /^\d+$/);
  const a = S.searchParams('1234 N Clark St');
  assert.equal(a.mode, 'address');
  assert.equal(a.params.$where, "address like '1234 %' AND upper(address) like '%CLARK%'");
  assert.deepEqual(S.parseAddress('1500 W 18th St').streetTokens, ['18']);
  assert.equal(S.parseAddress('Clark St'), null);
  assert.deepEqual(S.searchPlan('1234 N Clark').map((p) => p.mode), ['address', 'name', 'fulltext']);
  assert.equal(S.searchPlan('').length, 0);
});

test('soda: detail keys, quoting and license literal flip', async () => {
  assert.equal(S.detailParams({ license: '1000001' }).$where, "license_='1000001'");
  assert.equal(S.detailParams({ dba: "JOE'S", address: '1 W A ST ' }).$where, "upper(dba_name)='JOE''S' AND address='1 W A ST '");
  assert.equal(S.detailParams({ license: '0' }), null);
  assert.equal(S.detailParams({}), null);
  assert.ok(S.validLicense('123') && !S.validLicense('0') && !S.validLicense('12a'));
  // A 400 on a license_ query flips to numeric literals and retries once.
  const urls = [];
  const fake = (u) => { urls.push(decodeURIComponent(u)); return Promise.resolve(urls.length === 1 ? { ok: false, status: 400 } : { ok: true, status: 200, json: () => Promise.resolve([{ x: 1 }]) }); };
  const rows = await S.run(() => S.detailParams({ license: '1000001' }), fake);
  assert.deepEqual(rows, [{ x: 1 }]);
  assert.match(urls[0], /license_='1000001'/);
  assert.match(urls[1], /license_=1000001&/);
  S.opts.licenseNumeric = false; S.opts.flipped = false;
});

test('soda: latestPerLicense and dedupe', () => {
  const l = S.latestPerLicense([
    { license_: '1', inspection_date: '2026-01-01T00:00:00.000', results: 'Fail', inspection_id: '5' },
    { license_: '1', inspection_date: '2026-02-01T00:00:00.000', results: 'Pass', inspection_id: '6' },
    { license_: '2', inspection_date: '2026-02-01T00:00:00.000', results: 'Out of Business', inspection_id: '7' }
  ]);
  assert.equal(l['1'].results, 'Pass');
  assert.equal(l['2'].results, 'Out of Business');
  const d = S.dedupe([
    { license_: '1', dba_name: 'A', last: '2025-01-01' },
    { license_: '1', dba_name: 'A NEW NAME', last: '2026-01-01' },
    { license_: '0', dba_name: 'X', address: '1 A', last: '2026-01-01' },
    { license_: '0', dba_name: 'Y', address: '1 A', last: '2026-01-01' }
  ]);
  assert.equal(d.length, 3);
  assert.equal(d[0].dba_name, 'A NEW NAME');
});
