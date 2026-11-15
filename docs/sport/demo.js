/* Year in Motion: a made-up athlete for the sample deck and the tests. Deterministic. Routes are procedurally
 * generated shapes (loops, out-and-backs, lollipops, city grids) placed in the open Atlantic, not anyone's real route.
 * Output mimics a Strava bulk export: activities.csv text (UTC dates) plus raw track points per Filename.
 */
(function (root) {
  'use strict';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var LAT0 = 12.0, LON0 = -38.0; // mid-Atlantic, nowhere near anyone's home
  var OFFSET = -300; // the sample athlete lives at UTC-5 (minutes)

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function stravaDate(utc) {
    var d = new Date(utc), h = d.getUTCHours(), ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return MON[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear() + ', ' + h12 + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + ' ' + ap;
  }
  function q(s) { s = String(s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

  // ---- shapes, in meters, scaled to a target path length ----
  function pathLen(p) { var L = 0; for (var i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
  function scaleTo(p, L) { var k = L / (pathLen(p) || 1); return p.map(function (v) { return [v[0] * k, v[1] * k]; }); }
  function loop(r) {
    var k = 2 + Math.floor(r() * 4), a = 0.15 + r() * 0.35, b = r() * 0.2, ph = r() * 6.28, sx = 0.6 + r() * 0.8, out = [];
    for (var i = 0; i <= 240; i++) { var t = i / 240 * Math.PI * 2, rad = 1 + a * Math.sin(k * t + ph) + b * Math.sin((k + 3) * t); out.push([Math.cos(t) * rad * sx - sx * (1 + a * Math.sin(ph)), Math.sin(t) * rad]); }
    return out;
  }
  function outBack(r) {
    var out = [[0, 0]], x = 0, y = 0, dir = r() * 6.28;
    for (var i = 0; i < 90; i++) { dir += (r() - 0.5) * 0.5; x += Math.cos(dir); y += Math.sin(dir); out.push([x, y]); }
    var back = out.slice(0, -1).reverse().map(function (v, j) { return [v[0] + 0.25 * Math.sin(j / 9), v[1] + 0.25]; });
    return out.concat(back);
  }
  function lollipop(r) {
    var stem = [], x = 0, y = 0, dir = r() * 6.28;
    for (var i = 0; i < 30; i++) { dir += (r() - 0.5) * 0.3; x += Math.cos(dir) * 0.5; y += Math.sin(dir) * 0.5; stem.push([x, y]); }
    var cx = x + Math.cos(dir) * 6, cy = y + Math.sin(dir) * 6, ring = [];
    for (var j = 0; j <= 160; j++) { var t = dir + Math.PI + j / 160 * Math.PI * 2, rr = 6 * (1 + 0.2 * Math.sin(3 * t)); ring.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]); }
    return [[0, 0]].concat(stem, ring, stem.slice().reverse(), [[0, 0]]);
  }
  function grid(r) {
    var out = [[0, 0]], x = 0, y = 0, d = Math.floor(r() * 4);
    for (var i = 0; i < 26; i++) {
      d = (d + (r() < 0.5 ? 1 : 3)) % 4;
      var n = 1 + Math.floor(r() * 4);
      for (var s = 0; s < n; s++) { x += [1, 0, -1, 0][d]; y += [0, 1, 0, -1][d]; out.push([x, y]); }
    }
    // head home along the grid
    while (x !== 0) { x += x > 0 ? -1 : 1; out.push([x, y]); }
    while (y !== 0) { y += y > 0 ? -1 : 1; out.push([x, y]); }
    return out;
  }
  function shapeFor(sport, r) {
    var u = r();
    if (sport === 'ride') return u < 0.6 ? loop(r) : u < 0.85 ? lollipop(r) : outBack(r);
    if (sport === 'hike') return u < 0.5 ? outBack(r) : lollipop(r);
    return u < 0.4 ? loop(r) : u < 0.65 ? grid(r) : u < 0.85 ? outBack(r) : lollipop(r);
  }

  // Resample to ~even spacing and attach time + elevation.
  function toPoints(shape, dist, startUtc, secs, elevGain, r, home) {
    var m = scaleTo(shape, dist), L = pathLen(m), n = Math.max(40, Math.min(420, Math.round(L / 25)));
    var pts = [], seg = 0, acc = 0, cos = Math.cos(LAT0 * Math.PI / 180);
    var bumps = elevGain / 2 || 0, ph = r() * 6;
    for (var i = 0; i <= n; i++) {
      var target = L * i / n;
      while (seg < m.length - 2 && acc + Math.hypot(m[seg + 1][0] - m[seg][0], m[seg + 1][1] - m[seg][1]) < target) { acc += Math.hypot(m[seg + 1][0] - m[seg][0], m[seg + 1][1] - m[seg][1]); seg++; }
      var a = m[seg], b = m[seg + 1] || a, sl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, f = Math.min(1, Math.max(0, (target - acc) / sl));
      var x = a[0] + (b[0] - a[0]) * f + home[0], y = a[1] + (b[1] - a[1]) * f + home[1];
      var ele = 40 + bumps * (0.5 - 0.5 * Math.cos(i / n * Math.PI * 2)) + 6 * Math.sin(i / 7 + ph);
      pts.push([LAT0 + y / 111320, LON0 + x / (111320 * cos), startUtc + Math.round(secs * i / n) * 1000, Math.round(ele * 10) / 10]);
    }
    return pts;
  }

  function build(opts) {
    opts = opts || {};
    var r = rng(opts.seed || 20261114);
    var from = Date.UTC(opts.fromYear || 2025, 0, 1), to = opts.to || Date.UTC(2026, 10, 12);
    var acts = [], id = 9100000000;
    var homes = [[0, 0], [2500, -1200], [-1800, 2600], [9000, 4000]];
    function add(day, hour, minute, type, name, km, paceS, elev, extra) {
      extra = extra || {};
      var localWall = day + (hour * 60 + minute) * 60000 + Math.floor(r() * 50) * 1000;
      var utc = localWall - OFFSET * 60000;
      var dist = km * 1000 * (0.97 + r() * 0.06), moving = Math.round(paceS ? dist / 1000 * paceS : km);
      if (!paceS) dist = 0;
      var elapsed = Math.round(moving * (1.02 + r() * 0.08));
      var gps = /Run|Ride|Walk|Hike/.test(type) && !extra.indoor;
      id += 1 + Math.floor(r() * 9000);
      acts.push({ id: id, utc: utc, name: name, type: type, dist: dist, moving: moving, elapsed: elapsed, elev: gps ? elev * (0.8 + r() * 0.4) : 0, file: gps ? 'activities/' + id + (r() < 0.5 ? '.gpx' : '.fit.gz') : '', commute: !!extra.commute, sport: type });
    }
    function bucket(h) { return h < 11 ? 'Morning' : h < 14 ? 'Lunch' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night'; }
    for (var day = from; day < to; day += 864e5) {
      var d = new Date(day), wd = d.getUTCDay(), mo = d.getUTCMonth(), y = d.getUTCFullYear(), dom = d.getUTCDate();
      var summer = mo >= 4 && mo <= 8, fit = y === 2026 ? 1 : 0.85, h;
      var streak = y === 2026 && mo === 0 && dom <= 26; // a January run streak
      if (r() < 0.06 && !streak) continue; // sick days / travel
      if (wd === 2 || wd === 4 || streak) { h = streak && wd !== 2 && wd !== 4 ? 18 : 6; if (r() < 0.9 * fit || streak) add(day, h, Math.floor(r() * 40), 'Run', bucket(h) + ' Run', streak ? 4 + r() * 3 : 7 + r() * 5, 320 - 15 * fit + r() * 30, 30 + r() * 60); }
      if (wd === 6) {
        if (r() < 0.35) add(day, 8, 0, 'Run', 'Parkrun', 5.05, 262 + r() * 20 - 8 * fit, 18);
        else if (r() < 0.9) add(day, 6, 30 + Math.floor(r() * 20), 'Run', 'Long Run', 14 + r() * 10 * fit, 335 + r() * 25, 80 + r() * 160);
      }
      if (wd === 0) {
        if (summer && r() < 0.35) add(day, 7, 30, 'Hike', 'Morning Hike', 9 + r() * 8, 720 + r() * 120, 500 + r() * 700);
        else if (r() < 0.75) add(day, summer ? 6 : 9, 15, 'Ride', bucket(summer ? 6 : 9) + ' Ride', 35 + r() * 55 * fit, 3600 / (24 + r() * 5), 250 + r() * 700);
      }
      if (wd === 1 && r() < 0.7) add(day, 19, Math.floor(r() * 30), 'Weight Training', 'Evening Weight Training', 45 * 60 + r() * 900, 0, 0);
      if (wd === 3 && r() < (summer ? 0.7 : 0.45)) add(day, 6, 10, 'Swim', 'Morning Swim', 1.6 + r() * 1.2, 1150 + r() * 200, 0);
      if (wd === 5 && r() < 0.5) add(day, 8, 20, 'Ride', 'Morning Ride', 8 + r() * 3, 3600 / 19, 40, { commute: true });
      if (wd === 3 && r() < 0.4) add(day, 12, 15, 'Walk', 'Lunch Walk', 3 + r() * 2, 690 + r() * 60, 20);
      if (wd === 5 && r() < 0.3) add(day, 20, 0, 'Yoga', 'Evening Yoga', 30 * 60 + r() * 900, 0, 0);
    }
    // Races
    [[Date.UTC(2026, 9, 18), 'Run', 'Lakeshore Marathon', 42.4, 283, 120], [Date.UTC(2026, 3, 12), 'Run', 'Spring 10K', 10.05, 268, 40],
     [Date.UTC(2026, 6, 4), 'Run', 'Firecracker Half', 21.2, 277, 90], [Date.UTC(2026, 7, 22), 'Ride', 'Century Ride', 161, 3600 / 27.5, 1650],
     [Date.UTC(2025, 9, 19), 'Run', 'Lakeshore Marathon', 42.3, 297, 120]].forEach(function (x) { if (x[0] < to && x[0] >= from) add(x[0], 7, 0, x[1], x[2], x[3], x[4], x[5]); });
    acts.sort(function (a, b) { return b.utc - a.utc; }); // Strava lists newest first
    acts.forEach(function (a, i) { a.home = homes[i % 7 === 0 ? (i % 4) : 0]; });
    return acts;
  }

  var HEADER = 'Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance,Max Heart Rate,Relative Effort,Commute,Activity Private Note,Activity Gear,Filename,Athlete Weight,Bike Weight,Elapsed Time,Moving Time,Distance,Max Speed,Average Speed,Elevation Gain,Elevation Loss,Elevation Low,Elevation High,Max Grade,Average Grade';

  function stravaCSV(acts) {
    acts = acts || build();
    var lines = [HEADER];
    acts.forEach(function (a) {
      var km = a.dist ? (a.dist / 1000).toFixed(2) : '0.00';
      lines.push([a.id, q(stravaDate(a.utc)), q(a.name), a.type, '""', a.elapsed, km, '', '', a.commute ? 'true' : 'false', '', '', a.file, '', '',
        a.elapsed + '.0', a.moving + '.0', a.dist ? a.dist.toFixed(6) : '0.0', '', a.moving ? (a.dist / a.moving).toFixed(4) : '', a.elev ? a.elev.toFixed(3) : '0.0', '', '', '', '', ''].join(','));
    });
    return lines.join('\n') + '\n';
  }

  // Raw track points ([lat, lon, utcMs, ele]) for one synthetic activity.
  function trackFor(a) {
    var r = rng(a.id % 4294967296);
    return toPoints(shapeFor(a.type === 'Ride' ? 'ride' : a.type === 'Hike' ? 'hike' : 'run', r), a.dist, a.utc, a.elapsed, a.elev, r, a.home || [0, 0]);
  }

  function gpx(a, pts) {
    pts = pts || trackFor(a);
    var t = function (ms) { return new Date(ms).toISOString().replace('.000', ''); };
    var out = ['<?xml version="1.0" encoding="UTF-8"?>', '<gpx creator="Year in Motion sample" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">',
      ' <metadata><time>' + t(pts[0][2]) + '</time></metadata>', ' <trk><name>' + a.name + '</name><type>' + (a.type === 'Ride' ? 'cycling' : a.type === 'Hike' ? 'hiking' : a.type === 'Walk' ? 'walking' : 'running') + '</type><trkseg>'];
    pts.forEach(function (p) { out.push('  <trkpt lat="' + p[0].toFixed(7) + '" lon="' + p[1].toFixed(7) + '"><ele>' + p[3] + '</ele><time>' + t(p[2]) + '</time></trkpt>'); });
    out.push(' </trkseg></trk>', '</gpx>');
    return out.join('\n');
  }

  var api = { build: build, stravaCSV: stravaCSV, trackFor: trackFor, gpx: gpx, OFFSET: OFFSET, LAT0: LAT0, LON0: LON0 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SportDemo = api;
})(typeof self !== 'undefined' ? self : this);
