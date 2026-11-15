// Shared fixtures for the Python/JS parity test. Prints JSON: each case has the raw NWS-shaped
// inputs plus what docs/snow/model.js computes from them. test_parity.py feeds the same inputs
// to snow_model.py and compares every field.  Run: node bots/snow_alerts/tests/parity_cases.js
'use strict';
const M = require('../../../docs/snow/model.js');
const FX = require('../../snow/fixtures.js');

const H = 3600 * 1000;
const cases = [];
function add(name, nowMs, tz, region, grid, alerts) {
  const win = M.targetWindow(nowMs, tz);
  const inp = M.extract(grid, alerts, win);
  const res = M.odds(inp, region);
  cases.push({ name, now: nowMs, tz, region, grid, alerts, win, inp, res });
}

// 1) The hand-written scenarios from bots/snow/fixtures.js, both regions, a few alert sets.
const ALERT_SETS = [[], ['Winter Storm Warning'], ['Winter Weather Advisory'], ['Blizzard Warning', 'Ice Storm Warning', 'Winter Storm Warning'],
  ['Wind Chill Advisory', 'winter storm watch'], ['Special Weather Statement']];
for (const g of Object.keys(FX.GRIDS)) for (const r of ['used', 'rare']) for (const a of ALERT_SETS)
  add('fx:' + g + ':' + r + ':' + a.join('+'), FX.NOW, 'America/New_York', r, FX.GRIDS[g], FX.alerts(a));
add('fx:frigid', FX.NOW, 'America/New_York', 'used', FX.grid({ tempC: -30, windChill: [[-4, 48, -35]] }), FX.alerts([]));
add('fx:monster', FX.NOW, 'America/New_York', 'rare', FX.grid({ pop: [[-4, 48, 100]], snow: [[-4, 48, 900]], ice: [[-4, 48, 30]] }), FX.alerts(['Blizzard Warning']));
add('fx:empty-props', FX.NOW, 'America/New_York', 'used', { properties: {} }, { features: [] });
add('fx:bad-region', FX.NOW, 'America/Denver', 'xyz', FX.GRIDS.heavy, FX.alerts([]));
add('fx:3am', Date.parse('2026-12-02T08:00:00Z'), 'America/New_York', 'used', FX.GRIDS.heavy, FX.alerts([]));
add('fx:dst', Date.parse('2026-03-07T22:00:00Z'), 'America/New_York', 'used', FX.GRIDS.heavy, FX.alerts([]));

// 2) Seeded random grids: odd units, nulls, start/end intervals, day+hour durations, alert edge cases,
//    many time zones and dates (including DST nights). Deterministic (LCG), so the test is stable.
let seed = 20261115;
function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function iso(ms, off) { // off in minutes; renders the instant with that UTC offset
  const d = new Date(ms + off * 60000).toISOString().replace('.000Z', '');
  if (off === 0 && rnd() < 0.5) return d + 'Z';
  const s = off < 0 ? '-' : '+', a = Math.abs(off);
  return d + s + String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0');
}
function lay(uoms, lo, hi, t0, nullP) {
  const uom = pick(uoms), values = [];
  let t = t0 - Math.floor(rnd() * 8) * H;
  const stop = t0 + 50 * H;
  while (t < stop) {
    const h = 1 + Math.floor(rnd() * 12);
    const form = rnd();
    let vt;
    if (form < 0.6) vt = iso(t, 0) + '/PT' + h + 'H';
    else if (form < 0.75) vt = iso(t, pick([0, -300, -360, 60])) + '/' + (h > 6 ? 'P0DT' + h + 'H' : 'PT' + h + 'H');
    else if (form < 0.85) vt = iso(t, 0) + '/' + iso(t + h * H, pick([0, -300]));
    else if (form < 0.9) vt = iso(t, 0) + '/PT' + (h * 60) + 'M';
    else if (form < 0.95) vt = iso(t, 0) + '/P1DT' + h + 'H';
    else vt = pick(['garbage', iso(t, 0) + '/PTX', iso(t, 0) + '/' + iso(t - H, 0)]);
    const raw = lo + rnd() * (hi - lo);
    const value = rnd() < nullP ? null : Math.round(raw * 100) / 100;
    values.push({ validTime: vt, value });
    t += (form >= 0.9 && form < 0.95 ? 24 * H : 0) + h * H;
  }
  return { uom, values };
}
const TZS = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'America/Puerto_Rico', 'America/Indiana/Indianapolis'];
const EVENTS = ['Blizzard Warning', 'Ice Storm Warning', 'Winter Storm Warning', 'Extreme Cold Warning', 'Wind Chill Warning', 'Lake Effect Snow Warning',
  'Winter Weather Advisory', 'Winter Storm Watch', 'Cold Weather Advisory', 'Wind Chill Advisory', 'WINTER STORM WARNING', 'Flood Watch', 'Special Weather Statement'];
const NOWS = ['2026-12-01T22:00:00Z', '2026-12-02T01:30:00Z', '2027-01-15T01:31:00Z', '2027-02-05T01:31:00Z', '2027-03-14T01:31:00Z',
  '2027-03-13T23:00:00Z', '2026-11-01T01:30:00Z', '2027-01-01T09:00:00Z', '2027-02-28T05:59:00Z'];
for (let i = 0; i < 400; i++) {
  const now = Date.parse(pick(NOWS)) + Math.floor(rnd() * 6) * H * (rnd() < 0.5 ? -1 : 1);
  const P = {};
  const big = rnd() < 0.3;
  if (rnd() < 0.95) P.snowfallAmount = lay(['wmoUnit:mm', 'wmoUnit:cm', 'wmoUnit:m', 'unit:in', 'nwsUnit:ft'], 0, big ? 60 : 8, now, 0.1);
  if (P.snowfallAmount && P.snowfallAmount.uom === 'wmoUnit:m') P.snowfallAmount.values.forEach(v => { if (v.value != null) v.value = v.value / 1000; });
  if (P.snowfallAmount && P.snowfallAmount.uom === 'nwsUnit:ft') P.snowfallAmount.values.forEach(v => { if (v.value != null) v.value = v.value / 300; });
  if (rnd() < 0.8) P.iceAccumulation = lay(['wmoUnit:mm', 'wmoUnit:cm'], 0, rnd() < 0.3 ? 8 : 0.4, now, 0.1);
  if (rnd() < 0.95) P.temperature = lay(['wmoUnit:degC', 'wmoUnit:degF', 'wmoUnit:K'], -25, 10, now, 0.05);
  if (P.temperature && P.temperature.uom === 'wmoUnit:degF') P.temperature.values.forEach(v => { if (v.value != null) v.value = v.value * 1.8 + 32; });
  if (P.temperature && P.temperature.uom === 'wmoUnit:K') P.temperature.values.forEach(v => { if (v.value != null) v.value = Math.round((v.value + 273.15) * 100) / 100; });
  if (rnd() < 0.7) P.windChill = lay(['wmoUnit:degC'], -40, 5, now, 0.05);
  if (rnd() < 0.85) P.probabilityOfPrecipitation = lay(['wmoUnit:percent'], 0, 100, now, 0.05);
  const feats = [];
  const nA = Math.floor(rnd() * 4);
  for (let k = 0; k < nA; k++) {
    const p = { event: pick(EVENTS), status: rnd() < 0.08 ? 'Test' : 'Actual', messageType: rnd() < 0.08 ? 'Cancel' : pick(['Alert', 'Update']) };
    const o = rnd();
    if (o < 0.6) { p.onset = iso(now + Math.floor(rnd() * 40 - 10) * H, -300); p.ends = iso(now + Math.floor(rnd() * 50 - 8) * H, -300); }
    else if (o < 0.75) { p.effective = iso(now - 2 * H, 0); p.ends = null; }
    else if (o < 0.85) { p.onset = 'not a date'; }
    feats.push(rnd() < 0.1 ? Object.assign({ type: 'Feature' }, p) : { type: 'Feature', properties: p });
  }
  if (rnd() < 0.05) feats.push({ type: 'Feature', properties: {} });
  add('rnd:' + i, now, pick(TZS), pick(['used', 'rare', 'used', 'rare', 'bogus']), rnd() < 0.5 ? { type: 'Feature', properties: P } : P, rnd() < 0.05 ? {} : { type: 'FeatureCollection', features: feats });
}
process.stdout.write(JSON.stringify({ cases }));
