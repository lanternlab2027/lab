// Unit tests for docs/eats grade/score logic, violation summaries and query builders.
// Run: node --test bots/eats/test_grades.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const DOCS = path.resolve(__dirname, '../../docs/eats');
const G = require(path.join(DOCS, 'grades.js'));
const V = require(path.join(DOCS, 'violations.js'));
const S = require(path.join(DOCS, 'soda.js'));
const FX = require('./fixtures.js');

test('bandForScore follows DOHMH bands: A 0-13, B 14-27, C 28+', () => {
  assert.equal(G.bandForScore(0), 'A');
  assert.equal(G.bandForScore('13'), 'A');
  assert.equal(G.bandForScore(14), 'B');
  assert.equal(G.bandForScore(27), 'B');
  assert.equal(G.bandForScore(28), 'C');
  assert.equal(G.bandForScore(154), 'C');
  assert.equal(G.bandForScore(null), null);
  assert.equal(G.bandForScore(''), null);
  assert.equal(G.bandForScore('x'), null);
  assert.equal(G.bandForScore(-1), null);
});

test('gradeLabel covers A/B/C/Z/P/N', () => {
  assert.equal(G.gradeLabel('A'), 'Grade A');
  assert.equal(G.gradeLabel('Z'), 'Grade Pending');
  assert.equal(G.gradeLabel('P'), 'Grade Pending');
  assert.equal(G.gradeLabel('N'), 'Not Yet Graded');
  assert.match(G.gradeExplainer('Z'), /OATH/);
  assert.match(G.gradeExplainer('P'), /re-opens/);
});

test('groupInspections: one entry per inspection, newest first, violations collected', () => {
  const ins = G.groupInspections(FX.SUNNY);
  assert.deepEqual(ins.map((i) => i.date), ['2026-10-02', '2025-09-15', '2025-08-20', '2024-08-01']);
  assert.equal(ins[0].violations.length, 2);
  assert.equal(ins[0].critical, 1);
  assert.equal(ins[0].score, 9);
  assert.equal(ins[0].band, 'A');
  assert.equal(ins[2].violations.length, 3);
  assert.equal(ins[2].grade, '');
  assert.equal(ins[3].violations.length, 0); // "No violations" row
  // Order-independent
  const shuffled = FX.SUNNY.slice().reverse();
  assert.deepEqual(G.groupInspections(shuffled).map((i) => i.date), ins.map((i) => i.date));
});

test('currentGrade: A on initial is current grade', () => {
  const cur = G.currentGrade(G.groupInspections(FX.SUNNY));
  assert.equal(cur.grade, 'A');
  assert.equal(cur.gradeDate, '2026-10-02');
  assert.equal(cur.notes.length, 0);
});

test('currentGrade: Grade Pending (Z) on re-inspection', () => {
  const cur = G.currentGrade(G.groupInspections(FX.HARBOR));
  assert.equal(cur.grade, 'Z');
  assert.equal(cur.gradedInspection.score, 22);
});

test('currentGrade: not inspected yet (1900 date) -> N, with note', () => {
  const ins = G.groupInspections(FX.FRESH);
  assert.equal(ins[0].inspected, false);
  const cur = G.currentGrade(ins);
  assert.equal(cur.grade, 'N');
  assert.equal(cur.latest, null);
  assert.equal(cur.notes[0].kind, 'new');
  assert.deepEqual(G.timeline(ins), []);
});

test('currentGrade: newer ungraded initial (score 20) keeps the earlier A and explains the cycle', () => {
  const cur = G.currentGrade(G.groupInspections(FX.DELI));
  assert.equal(cur.grade, 'A');
  assert.equal(cur.gradeDate, '2025-02-25');
  assert.equal(cur.latest.date, '2026-09-30');
  assert.equal(cur.notes.length, 1);
  assert.equal(cur.notes[0].kind, 'cycle');
  assert.match(cur.notes[0].text, /Jul 13, 2026 scored 20 points/);
});

test('currentGrade: re-opening after closure -> P', () => {
  const ins = G.groupInspections(FX.TACO);
  assert.equal(ins[1].closed, true);
  assert.equal(ins[0].reopened, true);
  const cur = G.currentGrade(ins);
  assert.equal(cur.grade, 'P');
  assert.ok(!cur.notes.some((n) => n.kind === 'closed'));
});

test('currentGrade: closure as the latest inspection adds a closure note', () => {
  const cur = G.currentGrade(G.groupInspections(FX.TACO.slice(1)));
  assert.equal(cur.grade, 'N');
  assert.ok(cur.notes.some((n) => n.kind === 'closed'));
  assert.ok(cur.notes.some((n) => n.kind === 'cycle'));
});

test('currentGrade: grade/score mismatch is flagged, grade on record kept', () => {
  const cur = G.currentGrade(G.groupInspections(FX.MISM));
  assert.equal(cur.grade, 'C');
  const n = cur.notes.find((x) => x.kind === 'mismatch');
  assert.ok(n);
  assert.match(n.text, /B range/);
});

test('currentGrade: pre-permit initial with N stays Not Yet Graded', () => {
  const cur = G.currentGrade(G.groupInspections(FX.NOPE));
  assert.equal(cur.grade, 'N');
  assert.equal(cur.gradedInspection, null);
  assert.ok(cur.notes.some((n) => n.kind === 'cycle'));
});

test('timeline: oldest first, scored inspections only', () => {
  const t = G.timeline(G.groupInspections(FX.SUNNY));
  assert.deepEqual(t.map((p) => p.score), [0, 31, 19, 9]);
  assert.deepEqual(t.map((p) => p.band), ['A', 'C', 'B', 'A']);
});

test('dates: no time zone drift, dataAsOf = max record_date', () => {
  assert.equal(G.fmtDate('2026-01-01T00:00:00.000'), 'Jan 1, 2026');
  assert.equal(G.fmtDate('2026-11-10', true), 'November 10, 2026');
  assert.equal(G.fmtDate(''), '');
  assert.equal(G.dataAsOf(FX.SUNNY), '2026-11-13');
});

test('headline wording is neutral and grammatical', () => {
  assert.equal(G.headline("Sunny's Slice", 'A'), "Before you go: Sunny's Slice got an A");
  assert.equal(G.headline('X', 'B'), 'Before you go: X got a B');
  assert.equal(G.headline('X', 'C'), 'Before you go: X got a C');
  assert.equal(G.headline('X', 'Z'), 'Before you go: X has a Grade Pending');
  assert.equal(G.headline('X', 'N'), 'Before you go: X is not graded yet');
});

test('identity and name tidying', () => {
  const id = G.identity(FX.DELI);
  assert.equal(id.name, "Murray's Corner Deli & Grill Of Lower Manhattan");
  assert.equal(id.address, '205 East Example Street');
  assert.equal(G.tidyName('NYC BBQ HOUSE'), 'NYC BBQ House');
  assert.equal(G.tidyName('Already Mixed'), 'Already Mixed');
  assert.equal(G.titleCase('W 10TH ST'), 'W 10th St');
});

test('violation summaries: exact code, family fallback, unknown', () => {
  assert.match(V.plain('04L'), /mice/);
  assert.match(V.plain('02g'), /41 °F/);
  assert.match(V.plain('15-27'), /Smoke-Free Air Act/);
  assert.match(V.plain('16-03'), /Menu labeling/);
  assert.equal(V.plain('ZZ9'), '');
  assert.equal(V.plain(''), '');
  // every summary is one short sentence-ish line
  Object.values(V.PLAIN).forEach((s) => assert.ok(s.length < 170, s));
});

test('query builders: name search tolerates apostrophes; address mode; area filters', () => {
  const n = S.searchParams("Joe's pizza", { boro: 'Brooklyn' });
  assert.equal(n.mode, 'name');
  assert.equal(n.params.$where, "boro='Brooklyn' AND upper(dba) like '%JOE%S%' AND upper(dba) like '%PIZZA%'");
  assert.equal(S.searchParams('joes pizza', {}).params.$where, "upper(dba) like '%JOE%S%' AND upper(dba) like '%PIZZA%'");
  assert.equal(n.params.$limit, '40');
  const a = S.searchParams('205 E Houston St', { zip: '10002' });
  assert.equal(a.mode, 'address');
  assert.equal(a.params.$where, "zipcode='10002' AND building='205' AND upper(street) like '%HOUSTON%'");
  const q = S.searchParams('30-65 14th Street', {});
  assert.equal(q.params.$where, "building='30-65' AND upper(street) like '%14%'");
  // bad area values are ignored, injection characters stripped
  const bad = S.searchParams("x' OR 1=1 --", { boro: 'Narnia', zip: '1234' });
  assert.ok(!/Narnia|1234/.test(bad.params.$where));
  assert.equal((bad.params.$where.match(/'/g) || []).length % 2, 0);
  assert.equal(S.searchParams('   ', {}), null);
  // plan: address -> name -> full text
  assert.deepEqual(S.searchPlan('21 club', {}).map((p) => p.mode), ['address', 'name', 'fulltext']);
  assert.deepEqual(S.searchPlan('katz', {}).map((p) => p.mode), ['name', 'fulltext']);
});

test('detail and grade-chip queries validate CAMIS', () => {
  assert.equal(S.detailParams("1' OR '1'='1"), null);
  assert.equal(S.detailParams('40732665').$where, "camis='40732665'");
  assert.equal(S.gradesParams(['50000001', 'bad']).$where, "camis in('50000001') AND grade in('A','B','C','P','Z')");
  const lg = S.latestGrades([{ camis: '1', grade: 'B', inspection_date: '2025-01-01T00:00:00.000' }, { camis: '1', grade: 'A', inspection_date: '2026-01-01T00:00:00.000' }]);
  assert.deepEqual(lg['1'], { grade: 'A', date: '2026-01-01' });
  const d = S.dedupe([{ camis: '1', dba: 'OLD', last: '2024' }, { camis: '1', dba: 'NEW', last: '2026' }, { camis: '2', last: '2025' }]);
  assert.deepEqual(d.map((r) => r.dba || r.camis), ['NEW', '2']);
});
