/* Bridge between build.py and the live app's logic.
   Loads docs/eats/grades.js and docs/eats/violations.js (the exact files the app serves),
   so a static page and the app's ?camis= view compute the current grade the same way.

   Usage: node compute.js <rows.json> <out.json>
     rows.json: { "<camis>": [ Socrata rows... ], ... }
     out.json:  { "<camis>": { id, grade, label, explainer, gradeDate, gradedScore, latestDate,
                               notes: [..], recent: [3 inspections], history: [older inspections], asOf, inspections } } */
'use strict';
const fs = require('fs');
const path = require('path');
const APP = path.resolve(__dirname, '..', '..', 'docs', 'eats');
const G = require(path.join(APP, 'grades.js'));
const V = require(path.join(APP, 'violations.js'));

const [, , inPath, outPath] = process.argv;
const all = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const out = {};
for (const camis of Object.keys(all)) {
  const rows = all[camis];
  if (!rows || !rows.length) continue;
  const id = G.identity(rows);
  const ins = G.groupInspections(rows);
  const cur = G.currentGrade(ins);
  const inspected = ins.filter((i) => i.inspected);
  out[camis] = {
    id,
    grade: cur.grade,
    label: G.gradeLabel(cur.grade),
    explainer: G.gradeExplainer(cur.grade),
    gradeDate: cur.gradeDate || '',
    gradedScore: cur.gradedInspection ? cur.gradedInspection.score : null,
    latestDate: cur.latest ? cur.latest.date : '',
    notes: cur.notes.map((n) => ({ kind: n.kind, text: n.text })),
    asOf: G.dataAsOf(rows),
    inspections: inspected.length,
    // Inspections before the 3 shown in full: date, score and grade only (the page's score history).
    history: inspected.slice(3).map((i) => ({
      date: i.date,
      score: i.score,
      gradeLabel: i.grade && i.grade !== 'N' ? G.gradeLabel(i.grade) : (i.grade === 'N' ? 'Not yet graded' : 'Not graded'),
    })),
    recent: inspected.slice(0, 3).map((i) => ({
      date: i.date,
      type: i.type,
      action: i.action,
      score: i.score,
      band: i.band,
      grade: i.grade,
      gradeLabel: i.grade && i.grade !== 'N' ? G.gradeLabel(i.grade) : (i.grade === 'N' ? 'Not yet graded' : 'Not graded'),
      critical: i.critical,
      violations: i.violations.map((v) => ({
        code: v.code,
        flag: G.flagLabel(v.flag),
        critical: v.flag === 'Critical',
        plain: V.plain(v.code),
        text: v.text,
      })),
    })),
  };
}
fs.writeFileSync(outPath, JSON.stringify(out));
console.log('computed', Object.keys(out).length, 'restaurants');
