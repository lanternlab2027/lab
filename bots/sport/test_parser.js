// Unit tests for docs/sport (parser, zip reader, stats, card selection). Run: node --test bots/sport/test_parser.js
// Fixtures are synthetic (bots/sport/make_fixtures.js): a made-up athlete with procedurally generated routes.
process.env.TZ = 'UTC';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const P = require('../../docs/sport/parser.js');
const S = require('../../docs/sport/stats.js');
const Z = require('../../docs/sport/zip.js');
const D = require('../../docs/sport/demo.js');
global.SportStats = S; // cards.js looks this up for route trimming
const C = require('../../docs/sport/cards.js');
const JSZip = require('../../docs/sport/vendor/jszip-3.10.1.min.js');
const FX = path.join(__dirname, 'fixtures');
const read = (f) => fs.readFileSync(path.join(FX, f));
const txt = (f) => read(f).toString('utf8');
const ACTS = D.build({ seed: 7, fromYear: 2025, to: Date.UTC(2026, 10, 12) }); // same athlete as the fixtures
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);

function plausible(acts) {
  acts.forEach((a) => {
    if (a.dist && a.moving) { const v = a.dist / a.moving; assert.ok(v > 0.2 && v < 25, `speed ${v} m/s for ${a.type}`); }
    if (a.dist && a.elev) assert.ok(a.elev / (a.dist / 1000) < 250, `climb rate for ${a.type}`);
    if (a.moving) assert.ok(a.moving < 30 * 3600, 'duration under 30 h');
  });
}

test('CSV: quotes, embedded delimiters and newlines, CRLF, BOM, semicolons', () => {
  assert.deepEqual(P.parseCSV('﻿a,b,c\r\n"x, y","say ""hi""","l1\nl2"\r\n'), [['a', 'b', 'c'], ['x, y', 'say "hi"', 'l1\nl2']]);
  assert.deepEqual(P.parseCSV('a;b\n"1;2";3\n'), [['a', 'b'], ['1;2', '3']]);
});

test('numbers and durations, including thousands separators and decimal commas', () => {
  assert.equal(P.num('1,207'), 1207);
  assert.equal(P.num('5.48'), 5.48);
  assert.equal(P.num('4,55'), 4.55);
  assert.equal(P.num('4,55', true), 4.55);
  assert.equal(P.num('1.207', true), 1207);
  assert.equal(P.num('1.234,5'), 1234.5);
  assert.equal(P.num('4551.31982421875'), 4551.31982421875);
  assert.equal(P.num('--'), null);
  assert.equal(P.num(''), null);
  assert.equal(P.duration('00:31:24'), 1884);
  assert.equal(P.duration('01:54:09.70'), 6849.7);
  assert.equal(P.duration('42:05.26'), 2525.26);
  assert.equal(P.duration('1955.0'), 1955);
  assert.equal(P.duration('--'), null);
});

test('dates: Strava, Garmin, ISO with zones, localized month names, 12 AM/PM', () => {
  const d = P.parseDateTime('Aug 24, 2024, 10:47:26 AM');
  assert.deepEqual([d.y, d.mo, d.d, d.h, d.mi, d.s], [2024, 8, 24, 10, 47, 26]);
  const pm = P.parseDateTime('Jan 2, 2026, 12:05:00 PM'), am = P.parseDateTime('Jan 2, 2026, 12:05:00 AM');
  assert.equal(pm.h, 12); assert.equal(am.h, 0);
  assert.deepEqual(P.parseDateTime('2025-02-06 17:06:03'), { y: 2025, mo: 2, d: 6, h: 17, mi: 6, s: 3 });
  assert.equal(P.parseDateTime('2026-03-14T08:00:00Z').utcMs, Date.UTC(2026, 2, 14, 8));
  assert.equal(P.parseDateTime('2026-03-14T08:00:00+02:00').utcMs, Date.UTC(2026, 2, 14, 6));
  const es = P.parseDateTime('24 ago 2024, 10:47:26');
  assert.deepEqual([es.y, es.mo, es.d, es.h], [2024, 8, 24, 10]);
  const de = P.parseDateTime('3. März 2026, 07:15:00');
  assert.deepEqual([de.y, de.mo, de.d, de.h], [2026, 3, 3, 7]);
  const fr = P.parseDateTime('14 déc. 2025 18:02');
  assert.deepEqual([fr.y, fr.mo, fr.d, fr.h], [2025, 12, 14, 18]);
  assert.deepEqual(P.parseDateTime('24.08.2024 10:47'), { y: 2024, mo: 8, d: 24, h: 10, mi: 47, s: 0 });
  assert.equal(P.parseDateTime('not a date'), null);
  assert.equal(P.parseDateTime('2026-13-40'), null);
});

test('sport types from Strava, Garmin and FIT all map to sport groups', () => {
  const cases = { Run: 'run', 'Trail Run': 'run', 'Treadmill Running': 'run', VirtualRide: 'ride', 'Virtual Ride': 'ride', 'Indoor Cycling': 'ride', 'Mountain Biking': 'ride', 'E-Bike Ride': 'ride',
    'Pool Swim': 'swim', 'Open Water Swimming': 'swim', 'Weight Training': 'strength', 'Strength Training': 'strength', HIIT: 'strength', Workout: 'strength', Yoga: 'yoga', Pilates: 'yoga',
    Hike: 'hike', Hiking: 'hike', Walk: 'walk', 'Alpine Ski': 'ski', 'Backcountry Skiing': 'ski', Snowboard: 'ski', Rowing: 'row', Kayaking: 'paddle', 'Rock Climbing': 'climb', Golf: 'other', '': 'other' };
  Object.keys(cases).forEach((k) => assert.equal(P.sportOf(k), cases[k], k));
});

test('Strava activities.csv: every row, meters from the second Distance column, UTC times', () => {
  const r = P.parseActivitiesCSV(txt('strava_activities.csv'));
  assert.equal(r.source, 'strava');
  assert.equal(r.acts.length, ACTS.length);
  assert.equal(r.skipped, 0);
  const byUtc = new Map(r.acts.map((a) => [a.utc, a]));
  ACTS.forEach((src) => {
    const a = byUtc.get(src.utc);
    assert.ok(a, 'activity at ' + new Date(src.utc).toISOString());
    if (src.dist) near(a.dist, src.dist, 1e-6, 'distance');
    near(a.moving, src.moving, 1e-6, 'moving time');
    if (src.elev) near(a.elev, src.elev, 1e-3, 'elevation');
    assert.equal(a.file, src.file);
    assert.equal(a.commute, src.commute);
  });
  plausible(r.acts);
});

test('Strava older header (Distance in km only) and localized headers (positional fallback)', () => {
  const o = P.parseActivitiesCSV(txt('strava_old.csv'));
  assert.equal(o.source, 'strava'); assert.equal(o.acts.length, 120);
  near(o.acts[0].dist, ACTS[0].dist, 0.002, 'km column scaled to meters');
  assert.equal(o.acts[0].utc, Math.floor(ACTS[0].utc / 1000) * 1000);
  const l = P.parseActivitiesCSV(txt('strava_localized.csv'));
  assert.equal(l.source, 'strava'); assert.equal(l.positional, true); assert.equal(l.acts.length, 80);
  near(l.acts[0].dist, ACTS[0].dist, 0.002, 'decimal-comma km');
  assert.equal(l.acts[0].sport, P.sportOf(ACTS[0].type));
  assert.equal(new Date(l.acts[0].utc).getUTCDate(), new Date(ACTS[0].utc).getUTCDate());
  plausible(o.acts); plausible(l.acts);
});

test('Garmin CSV: units guessed (metric and imperial), converted to SI, local times, swims in m/yd', () => {
  const m = P.parseActivitiesCSV(txt('garmin_activities_metric.csv'));
  const i = P.parseActivitiesCSV(txt('garmin_activities_imperial.csv'));
  assert.equal(m.source, 'garmin'); assert.equal(m.unitsGuess, 'metric');
  assert.equal(i.source, 'garmin'); assert.equal(i.unitsGuess, 'imperial');
  assert.equal(m.acts.length, ACTS.length); assert.equal(i.acts.length, ACTS.length);
  ACTS.forEach((src, k) => {
    [m.acts[k], i.acts[k]].forEach((a, j) => {
      const tag = (j ? 'imperial ' : 'metric ') + src.type;
      if (src.dist) near(a.dist, src.dist, src.type === 'Swim' ? 0.01 : 0.004, tag + ' distance');
      if (src.elev >= 10) near(a.elev, src.elev, 0.03, tag + ' ascent');
      near(a.moving, src.moving, 0.002, tag + ' moving');
      assert.equal(a.wall, Math.floor((src.utc + D.OFFSET * 60000) / 1000) * 1000, tag + ' local time');
    });
  });
  // forcing the wrong unit scales distances by a mile
  const forced = P.parseActivitiesCSV(txt('garmin_activities_metric.csv'), { garminUnits: 'imperial' });
  const k = ACTS.findIndex((a) => a.type === 'Run');
  near(forced.acts[k].dist / m.acts[k].dist, 1.609344, 1e-6, 'unit override');
  plausible(m.acts); plausible(i.acts);
});

test('Garmin "Export Your Data" summarizedActivities.json (cm / ms detected)', async () => {
  const z = await JSZip.loadAsync(read('garmin_data_export.zip'));
  const name = Object.keys(z.files).find((n) => /summarizedActivities\.json$/.test(n));
  const r = P.parseGarminJSON(await z.file(name).async('string'));
  assert.equal(r.acts.length, ACTS.length);
  const a = r.acts[0];
  near(a.dist, ACTS[0].dist, 1e-6, 'distance'); near(a.moving, ACTS[0].moving, 1e-6, 'moving');
  assert.equal(a.wall, ACTS[0].utc + D.OFFSET * 60000);
  // same data in meters / seconds is detected too
  const alt = JSON.stringify(ACTS.map((x) => ({ activityType: x.type, startTimeGmt: x.utc, duration: x.elapsed, distance: x.dist })));
  near(P.parseGarminJSON(alt).acts[0].dist, ACTS[0].dist, 1e-6, 'meters variant');
  assert.equal(P.parseGarminJSON('{"nope":1}'), null);
  plausible(r.acts);
});

test('bad CSVs give clear errors', () => {
  assert.throws(() => P.parseActivitiesCSV(txt('not_an_export.csv')), /doesn.t look like a Strava/);
  assert.throws(() => P.parseActivitiesCSV(txt('empty_strava.csv')), /No activities/);
  assert.throws(() => P.parseActivitiesCSV(''), /empty/);
});

test('GPX (plain, gzipped, namespaced, no times), TCX and FIT tracks match the synthetic source', () => {
  const src = ACTS.filter((a) => a.file && a.utc >= Date.UTC(2026, 0, 1)).slice(0, 12);
  for (let i = 0; i < 12; i++) {
    const n = 'route_' + String(i + 1).padStart(2, '0');
    const f = fs.readdirSync(FX).find((x) => x.startsWith(n + '.'));
    let bytes = read(f);
    if (/\.gz$/.test(f)) bytes = zlib.gunzipSync(bytes);
    const tr = P.parseTrackFile(f, new Uint8Array(bytes));
    const a = src[i], pts = D.trackFor(a);
    assert.ok(tr.act, f + ' has an activity');
    assert.equal(tr.utc, pts[0][2], f + ' start time');
    near(tr.act.dist, a.dist, /\.fit|\.tcx/.test(f) ? 1e-3 : 0.03, f + ' distance');
    assert.equal(tr.act.sport, P.sportOf(a.type), f + ' sport');
    assert.ok(tr.line.length >= 20 && tr.line.length <= 1201, f + ' polyline size');
    near(tr.line[0][0], pts[0][0], 1e-6, f + ' first lat'); near(tr.line[0][1], pts[0][1], 1e-6, f + ' first lon');
    if (/\.fit/.test(f)) {
      near(tr.act.elev, a.elev, 0.01, f + ' session ascent');
      near(tr.act.elapsed, a.elapsed, 0.01, f + ' session elapsed');
    }
  }
  // FIT internals: every point survives, including compressed-timestamp records and big-endian fields
  const a = src[9], pts = D.trackFor(a), fit = P.parseFIT(new Uint8Array(read('route_10.fit')));
  assert.equal(fit.pts.length, pts.length);
  fit.pts.forEach((p, k) => { near(p[0], pts[k][0], 1e-6, 'lat ' + k); near(p[1], pts[k][1], 1e-6, 'lon ' + k); assert.equal(p[2], Math.round(pts[k][2] / 1000) * 1000, 'time ' + k); near(p[3], pts[k][3], 0.21, 'alt ' + k); });
  // no timestamps: a shape, but no date, so it can't be placed in a year
  const nt = P.parseTrackFile('route_notime.gpx', txt('route_notime.gpx'));
  assert.equal(nt.act, null); assert.ok(nt.line.length > 30);
  assert.throws(() => P.parseTrackFile('broken.fit', new Uint8Array(read('broken.fit'))), /not a FIT/);
});

test('lazy zip reader: central directory only, inflates on demand, matches JSZip', async () => {
  const buf = read('strava_export.zip');
  const z = await Z.openNative(new Blob([buf]));
  const names = z.entries.map((e) => e.name);
  assert.ok(names.includes('activities.csv'));
  assert.ok(names.filter((n) => /^media\//.test(n)).length === 4);
  const csv = new TextDecoder().decode(await z.read(z.entries.find((e) => e.name === 'activities.csv')));
  const ref = await (await JSZip.loadAsync(buf)).file('activities.csv').async('string');
  assert.equal(csv, ref);
  const fitgz = z.entries.find((e) => /\.fit\.gz$/.test(e.name));
  const fit = await Z.gunzip(await z.read(fitgz));
  assert.ok(P.parseFIT(fit).pts.length > 10);
  const stored = z.entries.find((e) => /^media\//.test(e.name));
  assert.equal((await z.read(stored)).length, 200000);
  await assert.rejects(() => Z.openNative(new Blob([read('corrupt.zip')])), /zip/);
});

test('lazy zip reader: Zip64 records (archives over 4 GB)', async () => {
  // Hand-built Zip64 archive: sizes and offsets live in the 0x0001 extra field and a Zip64 end record.
  const data = Buffer.from('hello zip64'), name = Buffer.from('activities.csv');
  const x64 = (vals) => { const b = Buffer.alloc(4 + vals.length * 8); b.writeUInt16LE(1, 0); b.writeUInt16LE(vals.length * 8, 2); vals.forEach((v, i) => b.writeBigUInt64LE(BigInt(v), 4 + i * 8)); return b; };
  const lhX = x64([data.length, data.length]);
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(45, 4); lh.writeUInt32LE(0xffffffff, 18); lh.writeUInt32LE(0xffffffff, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(lhX.length, 28);
  const local = Buffer.concat([lh, name, lhX, data]);
  const cdX = x64([data.length, data.length, 0]);
  const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(45, 4); ch.writeUInt16LE(45, 6); ch.writeUInt32LE(0xffffffff, 20); ch.writeUInt32LE(0xffffffff, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(cdX.length, 30); ch.writeUInt32LE(0xffffffff, 42);
  const cd = Buffer.concat([ch, name, cdX]);
  const e64 = Buffer.alloc(56); e64.writeUInt32LE(0x06064b50, 0); e64.writeBigUInt64LE(44n, 4); e64.writeBigUInt64LE(1n, 24); e64.writeBigUInt64LE(1n, 32); e64.writeBigUInt64LE(BigInt(cd.length), 40); e64.writeBigUInt64LE(BigInt(local.length), 48);
  const loc = Buffer.alloc(20); loc.writeUInt32LE(0x07064b50, 0); loc.writeBigUInt64LE(BigInt(local.length + cd.length), 8); loc.writeUInt32LE(1, 16);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0xffff, 8); eocd.writeUInt16LE(0xffff, 10); eocd.writeUInt32LE(0xffffffff, 12); eocd.writeUInt32LE(0xffffffff, 16);
  const z = await Z.openNative(new Blob([Buffer.concat([local, cd, e64, loc, eocd])]));
  assert.equal(z.entries.length, 1);
  assert.equal(new TextDecoder().decode(await z.read(z.entries[0])), 'hello zip64');
});

test('time zone: Strava UTC dates shifted using the default activity names', () => {
  const r = P.parseActivitiesCSV(txt('strava_activities.csv'));
  const zone = P.inferZone(r.acts); // this process runs in UTC; the athlete lives at UTC-5
  assert.equal(zone.kind, 'fixed'); assert.equal(zone.offset, D.OFFSET);
  P.applyZone(r.acts, zone);
  const morning = r.acts.filter((a) => /^Morning/.test(a.nameHint));
  assert.ok(morning.every((a) => new Date(a.t).getUTCHours() < 12));
  // no default names: browser zone
  assert.equal(P.inferZone(r.acts.map((a) => Object.assign({}, a, { nameHint: 'Club run' }))).kind, 'browser');
});

test('privacy trim: nothing within 500 m of a start or finish survives, anywhere on the route', () => {
  const a = ACTS.find((x) => x.type === 'Run' && x.file && x.dist > 9000);
  const line = P.summarizeTrack({ pts: D.trackFor(a) }).line;
  const segs = S.trimLine(line, 500);
  assert.ok(segs.length >= 1);
  const first = line[0], last = line[line.length - 1];
  segs.forEach((sg) => { assert.ok(sg.length >= 2); sg.forEach((p) => { assert.ok(P.hav(p[0], p[1], first[0], first[1]) > 500); assert.ok(P.hav(p[0], p[1], last[0], last[1]) > 500); }); });
  assert.deepEqual(S.trimLine(line, 0), [line]);
  const tiny = [[D.LAT0, D.LON0], [D.LAT0 + 0.001, D.LON0], [D.LAT0, D.LON0 + 0.001]];
  assert.deepEqual(S.trimLine(tiny, 500), [], 'a short loop near home vanishes entirely');
});

test('stats: totals, months, streaks, time of day, PRs and personality for the sample year', () => {
  const r = P.parseActivitiesCSV(txt('strava_activities.csv'));
  P.applyZone(r.acts, { kind: 'fixed', offset: D.OFFSET });
  const s = S.compute(r.acts, { year: 2026, now: Date.UTC(2026, 10, 14) });
  const src = ACTS.filter((a) => new Date(a.utc + D.OFFSET * 60000).getUTCFullYear() === 2026);
  assert.equal(s.count, src.length);
  near(s.dist, src.reduce((x, a) => x + a.dist, 0), 1e-6, 'total distance');
  assert.equal(s.streakDays.start, 0); assert.ok(s.streakDays.len >= 26, 'January run streak');
  assert.equal(s.monthsDone, 10);
  assert.equal(s.weeksElapsed, 46);
  assert.equal(s.todTop.key, 'dawn');
  assert.ok(s.sports[0].key === 'run');
  const labels = s.prs.map((p) => p.label);
  assert.ok(labels.includes('5K') && labels.includes('Marathon'));
  s.prs.filter((p) => p.kind === 'run').forEach((p) => assert.ok(p.pace >= 150 && p.pace <= 900));
  assert.ok(typeof s.personality.name === 'string' && s.personality.name.length > 3);
  assert.deepEqual(S.years(r.acts).map((y) => y.year), [2026, 2025]);
  // implausible efforts never become PRs
  const fake = [{ t: Date.UTC(2026, 4, 1, 7), sport: 'run', type: 'Run', dist: 5000, moving: 480 }, { t: Date.UTC(2026, 4, 2, 7), sport: 'run', type: 'Treadmill Run', dist: 5000, moving: 1200 }];
  assert.equal(S.compute(fake, { year: 2026 }).prs.length, 0);
});

test('card selection: 8-10 cards, route art only with routes, PR card only when supported, units', () => {
  const r = P.parseActivitiesCSV(txt('strava_activities.csv'));
  P.applyZone(r.acts, { kind: 'fixed', offset: D.OFFSET });
  const tracks = ACTS.filter((a) => a.file).map((a) => { const t = P.summarizeTrack({ pts: D.trackFor(a) }); return { t: a.utc + D.OFFSET * 60000, line: t.line, start: t.line[0], sport: 'run' }; });
  const s = S.compute(r.acts, { year: 2026, tracks, now: Date.UTC(2026, 10, 14) });
  const ids = (info) => C.build(s, Object.assign({ title: 'T', units: 'metric', trim: 500 }, info)).map((c) => c.id);
  const full = ids({});
  assert.ok(full.length >= 8 && full.length <= 10, full.join(','));
  assert.ok(full.includes('routes') && full.includes('persona') && full.includes('clock') && full.includes('mix'));
  assert.ok(!ids({ hideRoutes: true }).includes('routes'));
  const noTracks = S.compute(r.acts, { year: 2026, tracks: [] });
  assert.ok(!C.build(noTracks, { title: 'T', units: 'metric' }).some((c) => c.id === 'routes'));
  const gym = [0, 1, 2, 3].map((d) => ({ t: Date.UTC(2026, 1, 1 + d, 18), sport: 'strength', type: 'Weight Training', moving: 3600 }));
  const gs = S.compute(gym, { year: 2026 });
  const g = C.build(gs, { title: 'T', units: 'metric' }).map((c) => c.id);
  assert.ok(!g.includes('prs') && !g.includes('distance') && !g.includes('climb') && g.includes('persona'), g.join(','));
  const u = C.U('imperial');
  near(u.dist(1609.344), 1, 1e-9, 'mile'); near(u.elev(8849), 29032, 0.001, 'Everest in feet');
  const ny = C.PAIRS.find((p) => p.a === 'New York' && p.b === 'Chicago');
  near(ny.km, 1145, 0.01, 'NYC-Chicago great-circle km');
});
