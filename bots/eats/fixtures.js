// Synthetic Socrata rows for dataset 43nn-pn8j (field names verified live Nov 14, 2026).
// Made-up restaurants; shapes copied from real rows. Used by test_grades.js and test_page.js.
'use strict';
const REC = '2026-11-13T06:00:19.000';
const CI = 'Cycle Inspection / Initial Inspection', CR = 'Cycle Inspection / Re-inspection';
const VIOL = 'Violations were cited in the following area(s).';
const NOVIOL = 'No violations were recorded at the time of this inspection.';

function base(camis, dba, extra) {
  return Object.assign({
    camis, dba, boro: 'Brooklyn', building: '123', street: 'EXAMPLE AVENUE', zipcode: '11201', phone: '7185550100',
    cuisine_description: 'Pizza', record_date: REC, latitude: '40.69', longitude: '-73.99'
  }, extra || {});
}
function row(r, date, type, action, score, grade, code, desc, flag) {
  const o = Object.assign({}, r, { inspection_date: date + 'T00:00:00.000', inspection_type: type, action });
  if (score !== null && score !== undefined) o.score = String(score);
  if (grade) { o.grade = grade; o.grade_date = date + 'T00:00:00.000'; }
  if (code) { o.violation_code = code; o.violation_description = desc; o.critical_flag = flag; }
  return o;
}

// 1) Straight A on initial, older B cycle before it. Most recent first in the API order.
const sunny = base('50000001', "SUNNY'S SLICE", { cuisine_description: 'Pizza' });
const SUNNY = [
  row(sunny, '2026-10-02', CI, VIOL, 9, 'A', '10F', 'Non-food contact surface or equipment made of unacceptable material, not kept clean, or not properly sealed, raised, spaced or movable to allow accessibility for cleaning on all sides, above and underneath the unit.', 'Not Critical'),
  row(sunny, '2026-10-02', CI, VIOL, 9, 'A', '02G', 'Cold TCS food item held above 41 °F; smoked or processed fish held above 38 °F; intact raw eggs held above 45 °F; or reduced oxygen packaged (ROP) TCS foods held above required temperatures except during active necessary preparation.', 'Critical'),
  row(sunny, '2025-09-15', CR, VIOL, 19, 'B', '04L', "Evidence of mice or live mice in establishment's food or non-food areas.", 'Critical'),
  row(sunny, '2025-09-15', CR, VIOL, 19, 'B', '08A', 'Establishment is not free of harborage or conditions conducive to rodents, insects or other pests.', 'Not Critical'),
  row(sunny, '2025-08-20', CI, VIOL, 31, null, '04L', "Evidence of mice or live mice in establishment's food or non-food areas.", 'Critical'),
  row(sunny, '2025-08-20', CI, VIOL, 31, null, '06D', 'Food contact surface not properly washed, rinsed and sanitized after each use and following any activity when contamination may have occurred.', 'Critical'),
  row(sunny, '2025-08-20', CI, VIOL, 31, null, '15-27', 'Sign prohibiting smoking or using electronic cigarettes not conspicuously posted.', 'Not Applicable'),
  row(sunny, '2024-08-01', CI, NOVIOL, 0, 'A')
];

// 2) Grade Pending (Z) on re-inspection scoring 22.
const harbor = base('50000002', 'HARBOR NOODLE HOUSE', { boro: 'Queens', building: '30-65', street: '14 STREET', zipcode: '11102', cuisine_description: 'Chinese' });
const HARBOR = [
  row(harbor, '2026-10-20', CR, VIOL, 22, 'Z', '02B', 'Hot TCS food item not held at or above 140 °F.', 'Critical'),
  row(harbor, '2026-10-20', CR, VIOL, 22, 'Z', '10B', 'Anti-siphonage or back-flow prevention device not provided where required; equipment or floor not properly drained; sewage disposal system in disrepair or not functioning properly. Condensation or liquid waste improperly disposed of.', 'Not Critical'),
  row(harbor, '2026-09-25', CI, VIOL, 25, null, '02B', 'Hot TCS food item not held at or above 140 °F.', 'Critical'),
  row(harbor, '2025-10-01', CI, VIOL, 12, 'A', '10F', 'Non-food contact surface or equipment made of unacceptable material, not kept clean, or not properly sealed, raised, spaced or movable to allow accessibility for cleaning on all sides, above and underneath the unit.', 'Not Critical')
];

// 3) New restaurant, not inspected yet (1900 placeholder date, no type/action).
const fresh = base('50000003', 'FRESH START CAFE', { boro: 'Manhattan', building: '1', street: 'NEW STREET', zipcode: '10004', cuisine_description: 'Coffee/Tea' });
const FRESH = [Object.assign({}, fresh, { inspection_date: '1900-01-01T00:00:00.000' })];

// 4) Graded A earlier; newer initial inspection scored 20 (ungraded), then an unrelated task-force visit.
const deli = base('50000004', "MURRAY'S CORNER DELI & GRILL OF LOWER MANHATTAN", { boro: 'Manhattan', building: '205', street: 'EAST EXAMPLE STREET', zipcode: '10002', cuisine_description: 'Sandwiches' });
const DELI = [
  row(deli, '2026-09-30', 'Inter-Agency Task Force / Initial Inspection', NOVIOL, 0, null),
  row(deli, '2026-07-13', CI, VIOL, 20, null, '04N', 'Filth flies or food/refuse/sewage associated with (FRSA) flies or other nuisance pests in establishment’s food and/or non-food areas. FRSA flies include house flies, blow flies, bottle flies, flesh flies, drain flies, Phorid flies and fruit flies.', 'Critical'),
  row(deli, '2026-07-13', CI, VIOL, 20, null, '06C', 'Food, supplies, or equipment not protected from potential source of contamination during storage, preparation, transportation, display, service or from customer’s refillable, reusable container. Condiments not in single-service containers or dispensed directly by the vendor.', 'Critical'),
  row(deli, '2025-02-25', CI, VIOL, 7, 'A', '06C', 'Food, supplies, or equipment not protected from potential source of contamination during storage, preparation, transportation, display, service or from customer’s refillable, reusable container. Condiments not in single-service containers or dispensed directly by the vendor.', 'Critical')
];

// 5) Closed on initial inspection, re-opened with P.
const taco = base('50000005', 'TACO TEST', { boro: 'Bronx', building: '50', street: 'GRAND CONCOURSE', zipcode: '10451', cuisine_description: 'Mexican' });
const TACO = [
  row(taco, '2026-11-05', 'Cycle Inspection / Reopening Inspection', 'Establishment re-opened by DOHMH.', 3, 'P', '10F', 'Non-food contact surface or equipment made of unacceptable material, not kept clean, or not properly sealed, raised, spaced or movable to allow accessibility for cleaning on all sides, above and underneath the unit.', 'Not Critical'),
  row(taco, '2026-11-03', CI, 'Establishment Closed by DOHMH. Violations were cited in the following area(s) and those requiring immediate action were addressed.', 48, null, '04K', "Evidence of rats or live rats in establishment's food or non-food areas.", 'Critical')
];

// 6) Grade/score mismatch (adjudicated): grade C, score 21.
const mism = base('50000006', 'BAGEL BENCHMARK', { boro: 'Staten Island', building: '9', street: 'TEST ROAD', zipcode: '10301', cuisine_description: 'Bagels/Pretzels' });
const MISM = [
  row(mism, '2026-06-01', CR, VIOL, 21, 'C', '02G', 'Cold TCS food item held above 41 °F.', 'Critical')
];

// 7) Pre-permit initial, scored 16, N grade, never graded.
const nope = base('50000007', 'NOT YET NOODLES', { cuisine_description: 'Japanese' });
const NOPE = [
  row(nope, '2026-10-10', 'Pre-permit (Operational) / Initial Inspection', VIOL, 16, 'N', '04A', 'Food Protection Certificate (FPC) not held by manager or supervisor of food operations.', 'Critical')
];

const RESTAURANTS = { '50000001': SUNNY, '50000002': HARBOR, '50000003': FRESH, '50000004': DELI, '50000005': TACO, '50000006': MISM, '50000007': NOPE };

// Grouped search rows like the $select/$group query returns.
function searchRow(rows) {
  const r = rows[0];
  const last = rows.map((x) => x.inspection_date).sort().pop();
  const o = { camis: r.camis, dba: r.dba, boro: r.boro, street: r.street, zipcode: r.zipcode, cuisine_description: r.cuisine_description, last };
  if (r.building) o.building = r.building;
  return o;
}
const SEARCH_ALL = Object.values(RESTAURANTS).map(searchRow);

module.exports = { RESTAURANTS, SEARCH_ALL, searchRow, SUNNY, HARBOR, FRESH, DELI, TACO, MISM, NOPE };
