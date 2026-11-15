// Unit tests for docs/mileage/parser.js and stats.js. Run: node --test bots/mileage/test_parser.js
// Fixtures are synthetic (bots/mileage/make_fixtures.js); every place is invented.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const P = require('../../docs/mileage/parser.js');
const S = require('../../docs/mileage/stats.js');
const D = require('../../docs/mileage/demo.js');
const FX = path.join(__dirname, 'fixtures');
const read = (f) => fs.readFileSync(path.join(FX, f), 'utf8');
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ` ${a} vs ${b}`);

test('coordinates: geo: strings, degree strings, E7 (incl. int32 wrap), objects', () => {
  assert.deepEqual(P.parseCoord('geo:40.061200,-83.018700'), { lat: 40.0612, lng: -83.0187 });
  assert.deepEqual(P.parseCoord('40.0612000°, -83.0187000°'), { lat: 40.0612, lng: -83.0187 });
  assert.deepEqual(P.parseCoord('48.8566, 2.3522'), { lat: 48.8566, lng: 2.3522 });
  assert.deepEqual(P.parseCoord({ latLng: '1.5°, 2.5°' }), { lat: 1.5, lng: 2.5 });
  assert.deepEqual(P.parseCoord({ latitudeE7: 400612000, longitudeE7: -830187000 }), { lat: 40.0612, lng: -83.0187 });
  assert.deepEqual(P.parseCoord({ latE7: 399652000, lngE7: -829988000 }), { lat: 39.9652, lng: -82.9988 });
  // int32 overflow seen in old exports: -83.0187 stored as unsigned
  close(P.fromE7(4294967296 - 830187000), -83.0187, 1e-9);
  close(P.fromE7('400612000'), 40.0612, 1e-9);
  assert.equal(P.parseCoord('geo:0,0'), null);
  assert.equal(P.parseCoord('geo:95,10'), null);
  assert.equal(P.parseCoord('nonsense'), null);
  assert.equal(P.parseCoord({}), null);
});

test('haversine: known distances', () => {
  close(P.haversine({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), 111195, 5); // 1 degree of longitude at the equator
  close(P.haversine({ lat: 40.0612, lng: -83.0187 }, { lat: 40.0612, lng: -83.0187 }), 0, 1e-9);
  // JFK -> LAX great-circle distance is about 3,974 km
  close(P.haversine({ lat: 40.6413, lng: -73.7781 }, { lat: 33.9416, lng: -118.4085 }) / 1000, 3974, 6);
  close(P.pathLength([{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 0, lng: 2 }]), 2 * 111195, 10);
});

test('times: local date taken from the string offset; Z strings use offset when given', () => {
  assert.deepEqual(P.parseTime('2026-03-03T23:30:00.000-05:00').local, '2026-03-03');
  assert.equal(P.parseTime('2026-03-03T23:30:00.000-05:00').hm, '23:30');
  assert.equal(P.parseTime('2026-03-04T04:30:00Z', -300).local, '2026-03-03');
  assert.equal(P.parseTime('1709589720000').ms, 1709589720000);
  assert.equal(P.parseTime('2025-03-24 20:07:24 +0100').hm, '20:07');
  assert.equal(P.parseTime('garbage'), null);
});

test('detect formats and reject non-trip files with clear messages', () => {
  assert.equal(P.detect(JSON.parse(read('tiny-android.json'))), 'android');
  assert.equal(P.detect(JSON.parse(read('tiny-ios.json'))), 'ios');
  assert.equal(P.detect(JSON.parse(read('2024_MARCH.json'))), 'takeout');
  assert.throws(() => P.parseText(read('Records.json')), /Records\.json/);
  assert.throws(() => P.parseText(read('not-timeline.json')), /doesn.t look like a Google Maps Timeline/);
  assert.throws(() => P.parseText(read('notes.txt'), 'notes.txt'), /isn.t a JSON file/);
  assert.equal(P.parseText(read('empty-android.json')).trips.length, 0);
  assert.equal(P.parseText('﻿' + read('tiny-ios.json')).format, 'ios'); // BOM
});

test('Android parser: activities, distanceMeters, timelinePath fallback, local dates, hints', () => {
  const r = P.parseText(read('tiny-android.json'));
  assert.equal(r.format, 'android');
  assert.equal(r.trips.length, 4);
  const [a, walk, b, late] = r.trips;
  assert.equal(a.type, 'IN_PASSENGER_VEHICLE'); assert.equal(a.distSource, 'file');
  close(a.miles, 13679.5 / 1609.344, 1e-9); assert.equal(a.date, '2026-03-02'); assert.equal(a.startHM, '08:00'); assert.equal(a.endHM, '08:20');
  assert.equal(walk.type, 'WALKING');
  assert.equal(b.distSource, 'path');
  const pts = [{ lat: 39.9652, lng: -82.9988 }, { lat: 40.01, lng: -83.0 }, { lat: 40.0612, lng: -83.0187 }];
  close(b.meters, P.pathLength(pts), 0.01, 'path fallback');
  assert.equal(late.date, '2026-03-03'); // 23:30 local, 04:30 UTC next day
  assert.ok(r.hints.some((h) => h.name === 'Home'));
  assert.ok(r.hints.some((h) => h.name === 'Work'));
});

test('iOS parser: top-level array, string numbers, geo: points, lower-case types, offset-minute paths', () => {
  const r = P.parseText(read('tiny-ios.json'));
  assert.equal(r.format, 'ios');
  assert.deepEqual(r.trips.map((t) => t.type), ['IN_PASSENGER_VEHICLE', 'IN_PASSENGER_VEHICLE', 'CYCLING']);
  close(r.trips[0].miles, 13679.5 / 1609.344, 1e-9);
  assert.equal(r.trips[1].distSource, 'path'); // no distanceMeters: timelinePath points (startTime + offset minutes)
  close(r.trips[1].meters, P.pathLength([{ lat: 39.9652, lng: -82.9988 }, { lat: 40.01, lng: -83.0 }, { lat: 40.0612, lng: -83.0187 }]), 0.01);
  close(r.trips[2].meters, 1900, 1e-9);
  assert.ok(r.hints.some((h) => h.name === 'Work'));
});

test('Takeout parser: E7, distance, timestampMs, waypoint path and straight-line fallbacks, visit names', () => {
  const r = P.parseText(read('2024_MARCH.json'));
  assert.equal(r.format, 'takeout');
  assert.equal(r.trips.length, 4);
  const [a, b, c, w] = r.trips;
  assert.equal(a.distSource, 'file'); close(a.meters, 13680, 1e-9); // `distance` wins over waypointPath.distanceMeters
  assert.equal(b.distSource, 'path');
  close(b.meters, P.pathLength([{ lat: 39.9652, lng: -82.9988 }, { lat: 40.01, lng: -83.0 }, { lat: 40.0612, lng: -83.0187 }]), 0.01);
  assert.equal(b.ms, 1709589720000);
  assert.equal(c.distSource, 'straight'); assert.equal(c.type, 'IN_VEHICLE');
  close(c.meters, P.haversine({ lat: 40.0612, lng: -83.0187 }, { lat: 40.0705, lng: -83.0011 }), 1e-6);
  assert.equal(w.type, 'WALKING');
  assert.ok(r.hints.some((h) => h.name === 'Studio Office'));
});

test('full fixtures: all three formats give consistent driving miles for the same kind of history', () => {
  const an = P.parseText(read('Timeline.json'));
  const io = P.parseText(read('location-history.json'));
  assert.ok(an.trips.length > 1000 && io.trips.length > 200);
  for (const r of [an, io]) {
    assert.ok(r.trips.some((t) => t.distSource === 'path'), 'some trips use the path fallback');
    assert.ok(r.trips.every((t) => /^\d{4}-\d\d-\d\d$/.test(t.date) && t.miles >= 0 && t.miles < 200));
  }
  // takeout month files merge with dedupe
  const dir = path.join(FX, 'Semantic Location History');
  const files = [];
  for (const y of fs.readdirSync(dir)) for (const f of fs.readdirSync(path.join(dir, y))) files.push(P.parseText(fs.readFileSync(path.join(dir, y, f), 'utf8'), f));
  const m = P.merge(files), again = P.merge(files.concat(files));
  assert.equal(again.trips.length, m.trips.length); assert.equal(again.dupes, m.trips.length);
  assert.ok(m.trips.some((t) => t.ms && new Date(t.ms).toISOString().startsWith('2023-12'))); // timestampMs month
  assert.ok(m.trips.some((t) => t.distSource === 'straight'));
  // Demo itinerary for the same span gives identical driving miles in Android and iOS shapes
  const A = P.parseText(JSON.stringify(D.android('2026-02-01', '2026-02-28', { seed: 3 })));
  const I = P.parseText(JSON.stringify(D.ios('2026-02-01', '2026-02-28', { seed: 3 })));
  const T = P.merge(Object.values(D.takeout('2026-02-01', '2026-02-28', { seed: 3 })).map((o) => P.parseText(JSON.stringify(o))));
  const sum = (r) => r.trips.filter((t) => t.type === 'IN_PASSENGER_VEHICLE').reduce((s, t) => s + t.miles, 0);
  close(sum(A), sum(I), 0.01); close(sum(A), sum(T), 1); // takeout rounds distance to whole meters
});

test('clustering: endpoints within 150 m join one place; names from hints', () => {
  const r = P.parseText(read('tiny-android.json'));
  const cl = S.clusterPlaces(r.trips, r.hints, 150);
  const home = cl.places.find((p) => p.suggested === 'Home'), work = cl.places.find((p) => p.suggested === 'Work');
  assert.ok(home && work);
  assert.equal(cl.startPlace[0], home.id); assert.equal(cl.endPlace[0], work.id);
  assert.equal(cl.startPlace[2], work.id); assert.equal(cl.endPlace[2], home.id);
  // 100 m apart -> one place; 400 m apart -> two
  const mk = (lat, lng) => ({ start: { lat, lng }, end: { lat: lat + 1, lng }, miles: 1 });
  const near = S.clusterPlaces([mk(40, -83), mk(40.0009, -83)], [], 150);
  assert.equal(near.startPlace[0], near.startPlace[1]);
  const far = S.clusterPlaces([mk(40, -83), mk(40.0036, -83)], [], 150);
  assert.notEqual(far.startPlace[0], far.startPlace[1]);
  // big file: Home and Office are single places even with GPS jitter
  const big = P.parseText(read('Timeline.json')), bc = S.clusterPlaces(big.trips, big.hints, 150);
  const ids = new Set();
  big.trips.forEach((t, i) => { if (t.type === 'IN_PASSENGER_VEHICLE' && P.haversine(t.end, D.PLACES.office) < 60) ids.add(bc.endPlace[i]); });
  assert.equal(ids.size, 1, 'every drive ending at the office lands in one place');
});

test('IRS rates by date, filter and totals', () => {
  assert.equal(S.rateFor('2026-06-30').cents, 72.5);
  assert.equal(S.rateFor('2026-07-01').cents, 76);
  assert.equal(S.rateFor('2025-12-31').cents, 70);
  assert.equal(S.rateFor('2024-03-04').cents, 67);
  assert.equal(S.rateFor('2021-05-01'), null);
  const trip = (date, miles, type) => ({ id: date + miles, date, miles, type: type || 'IN_PASSENGER_VEHICLE', startHM: '09:00', endHM: '09:30', distSource: 'file' });
  const trips = [trip('2026-03-01', 10.04), trip('2026-08-01', 20), trip('2026-08-02', 5, 'WALKING'), trip('2025-12-31', 3.06), trip('2021-01-05', 2), trip('2026-09-09', 0.04)];
  const f = S.filter(trips, { from: '2026-01-01', to: '2026-12-31', types: { IN_PASSENGER_VEHICLE: true } });
  assert.deepEqual(f.map((t) => t.date), ['2026-03-01', '2026-08-01']); // walking, out-of-range and < 0.1 mi dropped
  const tot = S.totals([{ trip: trips[0], purpose: 'business' }, { trip: trips[1], purpose: 'business' }, { trip: trips[3], purpose: 'personal' }, { trip: trips[4], purpose: 'business' }, { trip: trips[2], purpose: '' }]);
  assert.equal(tot.business, 32); // 10.0 + 20.0 + 2.0, rounded per trip
  assert.equal(tot.personal, 3.1); assert.equal(tot.untagged, 5);
  assert.equal(tot.estimate, 22.45); // 10*0.725 + 20*0.76
  assert.equal(tot.unratedMiles, 2);
});

test('CSV: header, rows, escaping, formula guard, totals', () => {
  const t1 = { id: 'a', date: '2026-07-02', startHM: '08:00', endHM: '08:20', miles: 13679.5 / 1609.344, distSource: 'file', type: 'IN_PASSENGER_VEHICLE' };
  const t2 = { id: 'b', date: '2026-07-03', startHM: '17:30', endHM: '17:50', miles: 6.77, distSource: 'straight', type: 'IN_PASSENGER_VEHICLE' };
  const csv = S.toCSV([
    { trip: t1, from: 'Home', to: 'Harlow, "Pike" & Co', purpose: 'business', note: '=HYPERLINK("x")' },
    { trip: t2, from: '-Office', to: 'Home', purpose: 'personal', note: 'line1\nline2' }
  ], { period: 'Tax year 2026' });
  assert.ok(csv.startsWith('﻿Date,Start time,End time,From,To,Miles,Purpose,Business purpose / notes,Distance from,IRS rate ($/mi),Estimated amount ($)\r\n'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[1], '2026-07-02,08:00,08:20,Home,"Harlow, ""Pike"" & Co",8.5,Business,"\'=HYPERLINK(""x"")",Google Timeline,0.760,6.46');
  assert.equal(lines[2], "2026-07-03,17:30,17:50,'-Office,Home,6.8,Personal,\"line1\nline2\",Straight line (underestimate),,");
  assert.ok(csv.includes('\r\nTotal miles,15.3\r\n'));
  assert.ok(csv.includes('\r\nBusiness miles,8.5\r\n'));
  assert.ok(csv.includes('\r\nEstimated standard mileage amount ($),6.46\r\n'));
  assert.ok(csv.includes('Period,Tax year 2026'));
  assert.ok(/not tax advice/.test(csv));
  assert.equal(S.csvCell('-5.2'), '-5.2'); // plain negative numbers are left alone
});
