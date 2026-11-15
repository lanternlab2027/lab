// Unit tests for docs/snow/model.js. Run: node --test bots/snow/test_model.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../../docs/snow/model.js');
const FX = require('./fixtures.js');

const TZ = 'America/New_York';
const WIN = M.targetWindow(FX.NOW, TZ);
const run = (gridKey, alerts, region, g) => M.odds(M.extract(g || FX.GRIDS[gridKey], FX.alerts(alerts || []), WIN), region || 'used');

test('ISO 8601 durations', () => {
  assert.equal(M.parseDuration('PT6H'), 6 * 3600e3);
  assert.equal(M.parseDuration('P1D'), 24 * 3600e3);
  assert.equal(M.parseDuration('P1DT12H'), 36 * 3600e3);
  assert.equal(M.parseDuration('PT30M'), 30 * 60e3);
  assert.equal(M.parseDuration('P7DT5H'), (7 * 24 + 5) * 3600e3);
  assert.ok(Number.isNaN(M.parseDuration('P')));
  assert.ok(Number.isNaN(M.parseDuration('PT')));
  assert.ok(Number.isNaN(M.parseDuration('6H')));
});

test('validTime intervals (start/duration and start/end)', () => {
  const a = M.parseValidTime('2026-12-02T06:00:00+00:00/PT6H');
  assert.equal(a.start, Date.parse('2026-12-02T06:00:00Z'));
  assert.equal(a.end, Date.parse('2026-12-02T12:00:00Z'));
  const b = M.parseValidTime('2026-12-02T01:00:00-05:00/P1DT1H');
  assert.equal(b.start, Date.parse('2026-12-02T06:00:00Z'));
  assert.equal(b.end - b.start, 25 * 3600e3);
  const c = M.parseValidTime('2026-12-02T06:00:00Z/2026-12-02T09:00:00Z');
  assert.equal(c.end - c.start, 3 * 3600e3);
  assert.equal(M.parseValidTime('garbage'), null);
  assert.equal(M.parseValidTime('2026-12-02T06:00:00Z/PTX'), null);
});

test('unit codes', () => {
  assert.ok(Math.abs(M.toInches(25.4, 'wmoUnit:mm') - 1) < 1e-9);
  assert.ok(Math.abs(M.toInches(2.54, 'wmoUnit:cm') - 1) < 1e-9);
  assert.ok(Math.abs(M.toInches(0.0254, 'wmoUnit:m') - 1) < 1e-9);
  assert.equal(M.toF(0, 'wmoUnit:degC'), 32);
  assert.equal(M.toF(-40, 'wmoUnit:degC'), -40);
  assert.equal(M.toF(20, 'wmoUnit:degF'), 20);
  assert.ok(Math.abs(M.toF(273.15, 'wmoUnit:K') - 32) < 1e-9);
  assert.throws(() => M.toInches(1, 'wmoUnit:furlong'));
  assert.throws(() => M.toF(1, 'wmoUnit:percent'));
});

test('layer() drops nulls and converts; sumIn pro-rates partial overlaps', () => {
  const props = { snowfallAmount: { uom: 'wmoUnit:mm', values: [
    { validTime: '2026-12-02T00:00:00+00:00/PT6H', value: 25.4 },
    { validTime: '2026-12-02T06:00:00+00:00/PT6H', value: null },
  ] } };
  const rows = M.layer(props, 'snowfallAmount', 'len');
  assert.equal(rows.length, 1);
  assert.ok(Math.abs(rows[0].value - 1) < 1e-9);
  // half of the 6-hour block falls in the window -> half an inch
  const s = M.sumIn(rows, Date.parse('2026-12-02T03:00:00Z'), Date.parse('2026-12-02T12:00:00Z'));
  assert.ok(Math.abs(s - 0.5) < 1e-9);
  assert.deepEqual(M.layer({}, 'iceAccumulation', 'len'), []);
});

test('target window is 6pm to 8am local, across DST and time zones', () => {
  assert.equal(WIN.isoDate, '2026-12-02');
  assert.equal(WIN.start, Date.parse('2026-12-01T23:00:00Z'));
  assert.equal(WIN.late, Date.parse('2026-12-02T10:00:00Z'));
  assert.equal(WIN.end, Date.parse('2026-12-02T13:00:00Z'));
  const den = M.targetWindow(FX.NOW, 'America/Denver');
  assert.equal(den.end, Date.parse('2026-12-02T15:00:00Z'));
  // 3am local: predict for this morning, not tomorrow
  const early = M.targetWindow(Date.parse('2026-12-02T08:00:00Z'), TZ);
  assert.equal(early.isoDate, '2026-12-02');
  assert.ok(early.thisMorning);
  // DST start night (Mar 8 2026 -> the 6pm-8am window is 13 hours)
  const dst = M.targetWindow(Date.parse('2026-03-07T22:00:00Z'), TZ);
  assert.equal((dst.end - dst.start) / 3600e3, 13);
});

test('extract(): window sums, timing split, temps, alerts', () => {
  const inp = M.extract(FX.GRIDS.heavy, FX.alerts(['Winter Storm Warning']), WIN);
  // Window is +1h..+15h. Block +4..+10 (120 mm) is fully inside; block +10..+16 (120 mm) has 5 of 6 hours inside.
  assert.ok(Math.abs(inp.snowIn - (120 + 120 * 5 / 6) / 25.4) < 1e-6);
  // Late part (+12..+15h) gets 3 of the 6 hours of the second block.
  assert.ok(Math.abs(inp.snowLateIn - 60 / 25.4) < 1e-6);
  assert.ok(inp.snowLateIn > 0.1);
  assert.deepEqual(inp.alerts, ['Winter Storm Warning']);
  assert.equal(inp.popMax, 95);
  assert.ok(inp.lowF < 32);
  const e = M.extract(FX.GRIDS.early, FX.alerts([]), WIN);
  assert.ok(e.snowEarlyIn > 2.9 && e.snowLateIn < 0.01);
  // An alert that ended before tonight is ignored
  const old = FX.alerts(['Winter Storm Warning']); old.features[0].properties.ends = FX.iso(FX.NOW - 3600e3);
  assert.deepEqual(M.extract(FX.GRIDS.none, old, WIN).alerts, []);
});

test('no snow -> under 5%', () => {
  const o = run('none');
  assert.ok(o.chance < 5, 'got ' + o.chance);
  assert.match(o.reasons[0], /No snow/);
  assert.ok(run('none', [], 'rare').chance < 5);
});

test('heavy snow plus a warning -> high', () => {
  const o = run('heavy', ['Winter Storm Warning']);
  assert.ok(o.chance >= 80, 'got ' + o.chance);
  assert.ok(run('heavy', [], 'used').chance < o.chance);
  assert.match(o.reasons[0], /in\. of snow expected overnight/);
  assert.ok(o.reasons.includes('Winter Storm Warning in effect'));
  assert.ok(o.chance <= 99);
});

test('region type changes the result', () => {
  const used = run('early', [], 'used').chance, rare = run('early', [], 'rare').chance;
  assert.ok(rare > used + 20, 'rare ' + rare + ' vs used ' + used);
  const iceU = run('ice', [], 'used').chance, iceR = run('ice', [], 'rare').chance;
  assert.ok(iceR > iceU);
});

test('snow ending before 5am lowers the chance', () => {
  // Same 3 in., once ending at 3am and once falling 5am-8am.
  const ending = FX.grid({ tempC: -3, pop: [[-4, 48, 90]], snow: [[-4, 8, 0], [4, 6, 76], [10, 34, 0]] });
  const morning = FX.grid({ tempC: -3, pop: [[-4, 48, 90]], snow: [[-4, 16, 0], [12, 3, 76], [15, 29, 0]] });
  const a = run(null, [], 'used', ending), b = run(null, [], 'used', morning);
  assert.ok(a.chance < b.chance, a.chance + ' vs ' + b.chance);
  assert.match(a.reasons[0], /ending before 5am/);
});

test('alerts add points, capped; cold adds points; output stays 1..99', () => {
  const base = run('none').chance;
  assert.ok(run('none', ['Winter Weather Advisory'], 'rare').chance > run('none', ['Winter Weather Advisory'], 'used').chance);
  assert.ok(run('none', ['Blizzard Warning', 'Ice Storm Warning', 'Winter Storm Warning']).parts.alerts === 30);
  const frigid = FX.grid({ tempC: -30, windChill: [[-4, 48, -35]] });
  assert.ok(run(null, [], 'used', frigid).chance > base);
  assert.match(run(null, [], 'used', frigid).reasons[0], /Wind chill near -31/);
  const monster = FX.grid({ pop: [[-4, 48, 100]], snow: [[-4, 48, 900]], ice: [[-4, 48, 30]] });
  assert.equal(run(null, ['Blizzard Warning'], 'rare', monster).chance, 99);
  assert.ok(run('none').chance >= 1);
});

test('missing grid layers do not throw', () => {
  const o = M.odds(M.extract({ properties: {} }, { features: [] }, WIN), 'used');
  assert.equal(o.chance, 1);
  assert.match(o.reasons[0], /doesn.t reach/);
});
