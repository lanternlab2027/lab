// Synthetic Chicago Food Inspections rows (field names as in dataset 4ijn-s7e5). All names are made up.
'use strict';
function row(o) {
  return Object.assign({ city: 'CHICAGO', state: 'IL', zip: '60614', facility_type: 'Restaurant', risk: 'Risk 1 (High)', violations: undefined }, o,
    { inspection_date: o.inspection_date + 'T00:00:00.000' });
}
const V = {
  coldHolding: '22. PROPER COLD HOLDING TEMPERATURES - Comments: OBSERVED TCS FOODS HELD AT 48.0F IN THE PREP COOLER. INSTRUCTED TO MAINTAIN AT 41.0F OR BELOW. PRODUCT DISCARDED. PRIORITY VIOLATION 7-38-005. CITATION ISSUED.',
  rodent: '38. INSECTS, RODENTS, & ANIMALS NOT PRESENT - Comments: OBSERVED APPROX. 15 RODENT DROPPINGS ALONG THE BASEBOARD IN THE REAR STORAGE AREA. INSTRUCTED TO CLEAN, SANITIZE AND MAINTAIN. PRIORITY FOUNDATION VIOLATION 7-38-020(A). CITATION ISSUED.',
  floors: '55. PHYSICAL FACILITIES INSTALLED, MAINTAINED & CLEAN - Comments: FLOOR UNDER THE FRYERS HAS GREASE BUILD UP. INSTRUCTED TO CLEAN AND MAINTAIN.',
  handsink: '10. ADEQUATE HANDWASHING SINKS PROPERLY SUPPLIED AND ACCESSIBLE - Comments: NO PAPER TOWELS AT THE HAND SINK IN THE KITCHEN. INSTRUCTED TO PROVIDE. PRIORITY FOUNDATION VIOLATION 7-38-030(C). CORRECTED ON SITE.',
  certificate: '2. CITY OF CHICAGO FOOD SERVICE SANITATION CERTIFICATE - Comments: NO CERTIFIED FOOD MANAGER ON SITE WHILE TCS FOODS ARE PREPARED. PRIORITY FOUNDATION VIOLATION 7-38-012.',
  prevPriority: '59. PREVIOUS PRIORITY VIOLATION CORRECTED - Comments: PREVIOUS PRIORITY VIOLATION FROM REPORT #9000012 NOT CORRECTED, #22 COLD HOLDING. PRIORITY VIOLATION 7-42-090. CITATION ISSUED.',
  summary: '61. SUMMARY REPORT DISPLAYED AND VISIBLE TO THE PUBLIC - Comments: MOST RECENT INSPECTION REPORT NOT POSTED. INSTRUCTED TO POST.',
  mystery: '99. SOMETHING NEW WE HAVE NO SUMMARY FOR - Comments: TEST TEXT WITH A | PIPE INSIDE THE COMMENT.',
  oldFloors: '34. FLOORS: CONSTRUCTED PER CODE, CLEANED, GOOD REPAIR, COVING INSTALLED, DUST-LESS CLEANING METHODS USED - Comments: CLEAN FLOORS UNDER EQUIPMENT.',
  oldRodent: '18. NO EVIDENCE OF RODENT OR INSECT OUTER OPENINGS PROTECTED/RODENT PROOFED, A WRITTEN LOG SHALL BE MAINTAINED AVAILABLE TO THE INSPECTORS - Comments: GAP AT REAR DOOR.'
};
const RESTAURANTS = {
  // Pass now; Fail then a re-inspection Pass before that.
  '1000001': [
    row({ inspection_id: '9000031', dba_name: "LOU'S SAMPLE DINER", aka_name: "LOU'S SAMPLE DINER", license_: '1000001', address: '1234 N CLARK ST ', inspection_date: '2026-10-02', inspection_type: 'Canvass', results: 'Pass', violations: V.floors + ' | ' + V.summary }),
    row({ inspection_id: '9000031', dba_name: "LOU'S SAMPLE DINER", aka_name: "LOU'S SAMPLE DINER", license_: '1000001', address: '1234 N CLARK ST ', inspection_date: '2026-10-02', inspection_type: 'Canvass', results: 'Pass', violations: V.floors + ' | ' + V.summary }), // duplicate
    row({ inspection_id: '9000013', dba_name: "LOU'S SAMPLE DINER", aka_name: "LOU'S SAMPLE DINER", license_: '1000001', address: '1234 N CLARK ST ', inspection_date: '2025-09-19', inspection_type: 'Canvass Re-Inspection', results: 'Pass' }),
    row({ inspection_id: '9000012', dba_name: "LOU'S SAMPLE DINER", aka_name: "LOU'S SAMPLE DINER", license_: '1000001', address: '1234 N CLARK ST ', inspection_date: '2025-09-09', inspection_type: 'Canvass', results: 'Fail', violations: V.coldHolding + ' | ' + V.rodent + ' | ' + V.floors }),
    row({ inspection_id: '9000005', dba_name: "LOU'S SAMPLE DINER", aka_name: '', license_: '1000001', address: '1234 N CLARK ST ', inspection_date: '2024-03-14', inspection_type: 'Complaint', results: 'Pass w/ Conditions', violations: V.handsink })
  ],
  '1000002': [
    row({ inspection_id: '9000040', dba_name: 'TT HOLDINGS LLC', aka_name: 'TACO TEST', license_: '1000002', address: '2001 W DIVISION ST ', zip: '60622', risk: 'Risk 2 (Medium)', inspection_date: '2026-08-21', inspection_type: 'Canvass', results: 'Pass w/ Conditions', violations: V.handsink + ' | ' + V.certificate + ' | ' + V.mystery })
  ],
  '1000003': [
    row({ inspection_id: '9000050', dba_name: 'FAILING FICTION CAFE', aka_name: '', license_: '1000003', address: '77 E MADISON ST ', zip: '60603', inspection_date: '2026-11-03', inspection_type: 'Complaint', results: 'Fail', violations: V.coldHolding + ' | ' + V.prevPriority }),
    row({ inspection_id: '9000020', dba_name: 'FAILING FICTION CAFE', aka_name: '', license_: '1000003', address: '77 E MADISON ST ', zip: '60603', inspection_date: '2026-04-01', inspection_type: 'Canvass', results: 'Pass' })
  ],
  '1000004': [
    row({ inspection_id: '9000060', dba_name: 'GONE GRILL', aka_name: '', license_: '1000004', address: '3100 S HALSTED ST ', zip: '60608', inspection_date: '2026-06-10', inspection_type: 'Canvass', results: 'Out of Business' }),
    row({ inspection_id: '9000030', dba_name: 'GONE GRILL', aka_name: '', license_: '1000004', address: '3100 S HALSTED ST ', zip: '60608', inspection_date: '2025-05-02', inspection_type: 'Canvass', results: 'Pass', violations: V.floors })
  ],
  '1000005': [
    row({ inspection_id: '9000070', dba_name: 'NOENTRY NOODLE', aka_name: '', license_: '1000005', address: '4800 N BROADWAY ', zip: '60640', inspection_date: '2026-09-15', inspection_type: 'Canvass', results: 'No Entry' }),
    row({ inspection_id: '9000035', dba_name: 'NOENTRY NOODLE', aka_name: '', license_: '1000005', address: '4800 N BROADWAY ', zip: '60640', inspection_date: '2025-07-08', inspection_type: 'Canvass', results: 'Pass w/ Conditions', violations: V.handsink })
  ],
  '1000006': [
    row({ inspection_id: '1900001', dba_name: 'OLD RULES BAKERY', aka_name: '', license_: '1000006', address: '1500 W 18TH ST ', zip: '60608', risk: 'Risk 3 (Low)', facility_type: 'Bakery', inspection_date: '2017-05-11', inspection_type: 'Canvass', results: 'Pass', violations: V.oldFloors + ' | ' + V.oldRodent })
  ],
  '1000007': [
    row({ inspection_id: '9000080', dba_name: 'THE EXTREMELY LONG NAMED NEIGHBORHOOD RESTAURANT AND BANQUET HALL OF THE NORTHWEST SIDE', aka_name: '', license_: '1000007', address: '6000 N MILWAUKEE AVE ', zip: '60646', inspection_date: '2026-10-20', inspection_type: 'License', results: 'Pass w/ Conditions', violations: V.handsink })
  ]
};
// No usable license: found by exact DBA + address.
const NOLICENSE = [
  row({ inspection_id: '9000090', dba_name: 'MYSTERY MART', aka_name: '', license_: '0', address: '500 W TEST AVE ', zip: '60607', facility_type: 'Grocery Store', risk: 'Risk 3 (Low)', inspection_date: '2026-07-07', inspection_type: 'Canvass', results: 'Pass' })
];
const ALL_ROWS = [].concat(...Object.values(RESTAURANTS), NOLICENSE);
// Grouped search rows, like the app's $group query.
const SEARCH_ALL = (() => {
  const m = new Map();
  ALL_ROWS.forEach((r) => {
    const k = [r.license_, r.dba_name, r.aka_name, r.address, r.zip, r.facility_type].join('|');
    const prev = m.get(k);
    if (!prev || r.inspection_date > prev.last) m.set(k, { license_: r.license_, dba_name: r.dba_name, aka_name: r.aka_name || undefined, address: r.address, zip: r.zip, facility_type: r.facility_type, last: r.inspection_date });
  });
  return [...m.values()];
})();
const NEWEST = '2026-11-12T00:00:00.000';
module.exports = { RESTAURANTS, NOLICENSE, ALL_ROWS, SEARCH_ALL, NEWEST, V };
