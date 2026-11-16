// Unit tests for docs/weather/stats.js. Run: node --test bots/weather/test_stats.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../../docs/weather/stats.js');
const FX = require('./fixtures.js');

const F = { temp: 'F', precip: 'in' }, C = { temp: 'C', precip: 'mm' };
const approx = (a, b, eps, m) => assert.ok(Math.abs(a - b) <= (eps || 1e-9), (m || '') + ' ' + a + ' vs ' + b);

// Tiny hand-made response in the documented format.
function mk(rows) {
  const daily = { time: [] }; W.VARS.forEach((v) => (daily[v] = []));
  rows.forEach((r) => {
    daily.time.push(r[0]);
    daily.temperature_2m_max.push(r[1]); daily.temperature_2m_min.push(r[2]); daily.precipitation_sum.push(r[3]);
    daily.snowfall_sum.push(r[4] == null ? 0 : r[4]); daily.sunshine_duration.push(r[5] == null ? 36000 : r[5]); daily.wind_speed_10m_max.push(r[6] == null ? 20 : r[6]);
  });
  return { latitude: 1, longitude: 2, timezone: 'America/New_York', daily };
}

test('unit conversions', () => {
  assert.equal(W.cToF(0), 32); assert.equal(W.cToF(100), 212); approx(W.cToF(-40), -40);
  approx(W.cToF(32.2), 89.96, 1e-9);
  assert.equal(W.dC2F(10), 18);
  approx(W.mmToIn(25.4), 1); approx(W.cmToIn(2.54), 1); approx(W.kmhToMph(1.609344), 1);
  assert.equal(W.fmt.temp(37.8, F), '100\u00b0F');
  assert.equal(W.fmt.temp(37.8, C), '38\u00b0C');
  assert.equal(W.fmt.temp(-17.8, F), '0\u00b0F');
  assert.equal(W.fmt.temp(-0.2, C), '0\u00b0C'); // never "-0"
  assert.equal(W.fmt.tempDelta(10, F), '18\u00b0');
  assert.equal(W.fmt.tempDelta(-10, C), '10\u00b0');
  assert.equal(W.fmt.precip(1049.3, C), '1,049 mm');
  assert.equal(W.fmt.precip(1049.3, F), '41.3 in.');
  assert.equal(W.fmt.precip(0, F), '0.0 in.');
  assert.equal(W.fmt.snow(59.4, C), '59 cm');
  assert.equal(W.fmt.snow(59.4, F), '23.4 in.');
  assert.equal(W.fmt.snow(0.1, F), '<0.1 in.');
  assert.equal(W.fmt.snow(0, F), '0.0 in.');
  assert.equal(W.fmt.wind(100, F), '62 mph');
  assert.equal(W.fmt.wind(100, C), '100 km/h');
  assert.deepEqual(W.unitsFor('US'), F); assert.deepEqual(W.unitsFor('GB'), C); assert.deepEqual(W.unitsFor(''), C);
});

test('dates, slots and ranges', () => {
  assert.equal(W.slot('2026-01-01'), 0); assert.equal(W.slot('2024-02-29'), 59); assert.equal(W.slot('2026-03-01'), 60); assert.equal(W.slot('2026-12-31'), 365);
  assert.equal(W.addDays('2026-03-01', -1), '2026-02-28'); assert.equal(W.addDays('2027-01-01', -1), '2026-12-31');
  assert.deepEqual(W.range(2026, '2026-11-16'), { start: '2026-01-01', end: '2026-11-15' });
  assert.deepEqual(W.range(2026, '2027-01-02'), { start: '2026-01-01', end: '2026-12-31' });
  assert.equal(W.range(2026, '2026-01-01'), null); // nothing before yesterday
  assert.deepEqual(W.normalsRange(2026), { start: '2016-01-01', end: '2025-12-31', from: 2016, to: 2025 });
  assert.equal(W.defaultYear('2026-11-16'), 2026);
  assert.equal(W.defaultYear('2027-01-02'), 2026);
  assert.equal(W.defaultYear('2027-02-01'), 2027);
  assert.equal(W.longDate('2026-02-17'), 'Tuesday, February 17');
});

test('partial-year labeling', () => {
  assert.equal(W.yearLabel(2026, '2026-11-15'), '2026 so far');
  assert.equal(W.yearLabel(2026, '2026-12-30'), '2026 so far');
  assert.equal(W.yearLabel(2026, '2026-12-31'), '2026');
  assert.equal(W.yearLabel(2026, null), '2026 so far');
  const S = W.compute(W.parse(mk([['2026-01-01', 1, -3, 0], ['2026-01-02', 2, -2, 3]])).days, { year: 2026 });
  assert.equal(S.label, '2026 so far'); assert.equal(S.complete, false); assert.equal(S.through, 'Jan 2');
});

test('parse drops trailing all-null days (reanalysis lag) but keeps inner gaps', () => {
  const p = W.parse(mk([['2026-01-01', 1, -3, 0], ['2026-01-02', null, null, null], ['2026-01-03', 2, -2, 0], ['2026-01-04', null, null, null], ['2026-01-05', null, null, null]]));
  assert.equal(p.days.length, 3); assert.equal(p.days[2].date, '2026-01-03'); assert.equal(p.days[1].tmax, null);
  assert.throws(() => W.parse({ error: true, reason: 'Parameter x is invalid' }), /invalid/);
  // legacy name windspeed_10m_max is accepted too
  const legacy = W.parse({ daily: { time: ['2026-01-01'], temperature_2m_max: [5], windspeed_10m_max: [33] } });
  assert.equal(legacy.days[0].wind, 33);
});

test('streak logic', () => {
  const d = (date, prcp) => ({ date, prcp });
  const days = [d('2026-01-01', 0), d('2026-01-02', 0.9), d('2026-01-03', 1.0), d('2026-01-04', 5), d('2026-01-05', 0), d('2026-01-06', 0), d('2026-01-07', 0), d('2026-01-08', 2)];
  assert.deepEqual(W.longestRun(days, W.isDry), { len: 3, start: '2026-01-05', end: '2026-01-07' });
  assert.deepEqual(W.longestRun(days, W.isWet), { len: 2, start: '2026-01-03', end: '2026-01-04' });
  // ties go to the earlier run
  assert.deepEqual(W.longestRun([d('2026-01-01', 0), d('2026-01-02', 3), d('2026-01-03', 0)], W.isDry), { len: 1, start: '2026-01-01', end: '2026-01-01' });
  // missing values break a run and count as neither
  const gap = [d('2026-01-01', 0), d('2026-01-02', 0), d('2026-01-03', null), d('2026-01-04', 0)];
  assert.equal(W.longestRun(gap, W.isDry).len, 2); assert.equal(W.longestRun(gap, W.isWet).len, 0);
  // missing calendar days break a run too
  assert.equal(W.longestRun([d('2026-01-01', 0), d('2026-01-03', 0)], W.isDry).len, 1);
  // across a month boundary
  assert.equal(W.longestRun([d('2026-01-31', 0), d('2026-02-01', 0), d('2026-02-02', 0)], W.isDry).len, 3);
  assert.deepEqual(W.longestRun([], W.isDry), { len: 0, start: null, end: null });
});

test('thresholds: 90F and 32F applied in Fahrenheit', () => {
  const S = W.compute(W.parse(mk([
    ['2026-07-01', 32.2, 20, 0],   // 89.96 F: not 90
    ['2026-07-02', 32.3, 20, 0],   // 90.1 F: counts
    ['2026-07-03', 40, 25, 0],
    ['2026-01-01', 1, 0, 0],       // low exactly 32 F: not below 32
    ['2026-01-02', 1, -0.1, 0],    // 31.8 F
  ].sort((a, b) => a[0] < b[0] ? -1 : 1))).days, { year: 2026 });
  assert.equal(S.hotDays, 2); assert.equal(S.freezeDays, 1);
});

test('fixture year: Buffalo 2026 so far (through Nov 15)', () => {
  const json = FX.cityDaily('buffalo', '2026-01-01', '2026-11-15', FX.VARS, { events: FX.EVENTS2026, drySpell: ['2026-08-03', '2026-08-26'], wetSpell: ['2026-04-06', '2026-04-14'] });
  const days = W.parse(json).days;
  const S = W.compute(days, { year: 2026 });
  assert.equal(S.n, 319); assert.equal(S.label, '2026 so far'); assert.equal(S.through, 'Nov 15');
  // hottest/coldest match a brute-force scan
  const hi = Math.max(...json.daily.temperature_2m_max), lo = Math.min(...json.daily.temperature_2m_min);
  assert.equal(S.hottest.c, hi); assert.equal(S.coldest.c, lo);
  assert.equal(S.hottest.date, json.daily.time[json.daily.temperature_2m_max.indexOf(hi)]);
  assert.equal(S.hottest.date, '2026-07-14'); assert.equal(S.coldest.date, '2026-01-25');
  // totals
  approx(S.precipMM, json.daily.precipitation_sum.reduce((a, b) => a + b, 0), 1e-6);
  approx(S.snowCM, json.daily.snowfall_sum.reduce((a, b) => a + b, 0), 1e-6);
  assert.ok(S.snowCM > 0);
  // streaks: the forced 24-day dry spell and 9-day wet spell are at least that long
  assert.ok(S.dry.len >= 24 && S.dry.start <= '2026-08-03' && S.dry.end >= '2026-08-26', JSON.stringify(S.dry));
  assert.ok(S.wet.len >= 9 && S.wet.start <= '2026-04-06', JSON.stringify(S.wet));
  // brute-force the dry streak
  let best = 0, cur = 0; json.daily.precipitation_sum.forEach((p) => { cur = p < 1 ? cur + 1 : 0; best = Math.max(best, cur); });
  assert.equal(S.dry.len, best);
  // counts
  assert.equal(S.hotDays, json.daily.temperature_2m_max.filter((t) => t * 9 / 5 + 32 >= 90 - 1e-9).length);
  assert.equal(S.freezeDays, json.daily.temperature_2m_min.filter((t) => t * 9 / 5 + 32 < 32 - 1e-9).length);
  assert.ok(S.freezeDays > 30);
  // sunniest month is a full summer month with the top hours/day, never November (only 15 days)
  assert.ok(S.sunniest && S.sunniest.mo >= 5 && S.sunniest.mo <= 8, S.sunniest && S.sunniest.name);
  const eligible = S.months.filter((m) => m.sunDays >= 20);
  assert.equal(S.sunniest.sunPerDay, Math.max(...eligible.map((m) => m.sunPerDay)));
  assert.equal(S.months[10].days, 15);
  assert.ok(S.windiest.kmh > 0);
  assert.equal(S.weird, undefined); // no normals given
});

test('full year (Jan 2 launch): labeled 2026, 365 days', () => {
  const json = FX.cityDaily('phoenix', '2026-01-01', '2026-12-31', FX.VARS, { events: FX.EVENTS2026 });
  const S = W.compute(W.parse(json).days, { year: 2026 });
  assert.equal(S.n, 365); assert.equal(S.label, '2026'); assert.equal(S.complete, true);
  assert.ok(S.hotDays > 60); assert.equal(S.snowCM, 0); assert.equal(S.snowiest, null);
});

test('reanalysis lag: null tail trimmed, label stays "so far" through the last real day', () => {
  const json = FX.cityDaily('london', '2026-01-01', '2026-12-31', FX.VARS, { nullTail: 3 });
  const S = W.compute(W.parse(json).days, { year: 2026 });
  assert.equal(S.last, '2026-12-28'); assert.equal(S.label, '2026 so far');
});

test('normals and the weirdest day', () => {
  const N = W.normals(FX.cityDaily('buffalo', '2016-01-01', '2025-12-31', ['temperature_2m_max'], { seedExtra: 'normals' }));
  assert.equal(N.length, 366); assert.deepEqual(N.years, [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  // each slot averages 15 calendar slots over 10 years (Feb 29 only in 2016, 2020, 2024)
  assert.equal(N[180].n, 150); assert.ok(N[59].n < 150 && N[59].n > 140);
  assert.ok(N[200].mean > N[20].mean + 15); // summer is warmer than winter
  // brute-force one slot
  const j = FX.cityDaily('buffalo', '2016-01-01', '2025-12-31', ['temperature_2m_max'], { seedExtra: 'normals' });
  let s = 0, n = 0; j.daily.time.forEach((t, i) => { const k = W.slot(t); if (Math.abs(k - 180) <= 7) { s += j.daily.temperature_2m_max[i]; n++; } });
  approx(N[180].mean, s / n, 1e-9);
  // wraps around New Year
  let s0 = 0, n0 = 0; j.daily.time.forEach((t, i) => { const k = W.slot(t); const dist = Math.min(Math.abs(k - 0), 366 - Math.abs(k - 0)); if (dist <= 7) { s0 += j.daily.temperature_2m_max[i]; n0++; } });
  approx(N[0].mean, s0 / n0, 1e-9);

  const days = W.parse(FX.cityDaily('buffalo', '2026-01-01', '2026-11-15', FX.VARS, { events: FX.EVENTS2026 })).days;
  const S = W.compute(days, { year: 2026, normals: N });
  assert.equal(S.weird.date, '2026-02-17'); assert.ok(S.weird.diff > 15);
  approx(S.weird.normal, N[W.slot('2026-02-17')].mean, 1e-9);
  assert.equal(S.normalYears, '2016\u20132025');
  assert.equal(typeof S.vsNormal, 'number');
});
