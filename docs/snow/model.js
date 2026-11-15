/* Snow Day Odds: pure logic (no DOM, no network). Works in the browser (window.SnowModel) and in Node (module.exports).
   1) Parse NWS gridpoint data: ISO 8601 validTime intervals ("2026-12-01T06:00:00+00:00/PT6H") and WMO unit codes ("wmoUnit:mm").
   2) Pick tomorrow morning's window in the location's own time zone.
   3) Score a transparent, documented heuristic. This is a points table, not machine learning. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SnowModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HOUR = 3600 * 1000;
  var DEG = '\u00b0';

  // ---------- ISO 8601 ----------
  // Durations as NWS uses them: P1D, PT6H, P1DT12H, PT30M, P2DT3H30M (weeks too, for safety).
  function parseDuration(s) {
    var m = /^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(String(s || '').trim());
    if (!m || s === 'P' || /T$/.test(s)) return NaN;
    var w = +(m[1] || 0), d = +(m[2] || 0), h = +(m[3] || 0), mi = +(m[4] || 0), se = +(m[5] || 0);
    return (((w * 7 + d) * 24 + h) * 60 + mi) * 60000 + se * 1000;
  }
  // "start/duration" (what NWS sends), plus "start/end" for robustness.
  function parseValidTime(vt) {
    var parts = String(vt || '').split('/');
    if (parts.length !== 2) return null;
    var start = Date.parse(parts[0]);
    if (isNaN(start)) return null;
    var end;
    if (/^P/.test(parts[1])) { var d = parseDuration(parts[1]); if (isNaN(d)) return null; end = start + d; }
    else { end = Date.parse(parts[1]); if (isNaN(end)) return null; }
    if (end <= start) return null;
    return { start: start, end: end };
  }

  // ---------- units ----------
  // Returns a function that converts a value in `uom` to the target unit ('in', 'degF' or 'percent').
  var LENGTH_MM = { mm: 1, cm: 10, m: 1000, km: 1e6, in: 25.4, ft: 304.8 };
  function unitName(uom) { return String(uom || '').replace(/^(wmoUnit|nwsUnit|unit):/, ''); }
  function toInches(v, uom) {
    var u = unitName(uom); if (!(u in LENGTH_MM)) throw new Error('Unknown length unit: ' + uom);
    return v * LENGTH_MM[u] / 25.4;
  }
  function toF(v, uom) {
    var u = unitName(uom);
    if (u === 'degC') return v * 9 / 5 + 32;
    if (u === 'degF') return v;
    if (u === 'K' || u === 'degK') return (v - 273.15) * 9 / 5 + 32;
    throw new Error('Unknown temperature unit: ' + uom);
  }

  // A gridData layer -> [{start, end, value}] in our units (in, degF, percent). Null values are dropped.
  function layer(props, key, kind) {
    var L = props && props[key];
    if (!L || !L.values) return [];
    var out = [];
    L.values.forEach(function (v) {
      if (v.value == null) return;
      var t = parseValidTime(v.validTime); if (!t) return;
      var val = kind === 'len' ? toInches(v.value, L.uom) : kind === 'temp' ? toF(v.value, L.uom) : +v.value;
      out.push({ start: t.start, end: t.end, value: val });
    });
    return out;
  }
  function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }
  // Accumulations (snow, ice): pro-rate each interval by how much of it falls inside [t0, t1).
  function sumIn(rows, t0, t1) {
    var s = 0; rows.forEach(function (r) { var o = overlap(r.start, r.end, t0, t1); if (o > 0) s += r.value * o / (r.end - r.start); });
    return s;
  }
  function minIn(rows, t0, t1) { var m = null; rows.forEach(function (r) { if (overlap(r.start, r.end, t0, t1) > 0 && (m === null || r.value < m)) m = r.value; }); return m; }
  function maxIn(rows, t0, t1) { var m = null; rows.forEach(function (r) { if (overlap(r.start, r.end, t0, t1) > 0 && (m === null || r.value > m)) m = r.value; }); return m; }
  function covered(rows, t0, t1) { return rows.some(function (r) { return r.start <= t0; }) && rows.some(function (r) { return r.end >= t1; }); }

  // ---------- time zones ----------
  function partsIn(ms, tz) {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var o = {}; f.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
  }
  // UTC ms for a wall-clock time in tz (handles DST by iterating on the offset).
  function zonedTime(y, mo, d, h, tz) {
    var guess = Date.UTC(y, mo - 1, d, h);
    for (var i = 0; i < 3; i++) {
      var p = partsIn(guess, tz);
      var asUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
      var want = Date.UTC(y, mo - 1, d, h);
      if (asUTC === want) break;
      guess += want - asUTC;
    }
    return guess;
  }
  // The school morning we predict for: tomorrow, unless it is still before 5am locally (then this morning).
  // Window: 6pm the evening before until 8am. "Late" part: 5am to 8am.
  function targetWindow(nowMs, tz) {
    var p = partsIn(nowMs, tz);
    var base = Date.UTC(p.y, p.mo - 1, p.d);
    var day = new Date(p.h < 5 ? base : base + 24 * HOUR);
    var y = day.getUTCFullYear(), mo = day.getUTCMonth() + 1, d = day.getUTCDate();
    var prev = new Date(Date.UTC(y, mo - 1, d) - 24 * HOUR);
    return {
      date: { y: y, mo: mo, d: d, dow: day.getUTCDay() },
      isoDate: y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'),
      start: zonedTime(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate(), 18, tz),
      late: zonedTime(y, mo, d, 5, tz),
      end: zonedTime(y, mo, d, 8, tz),
      thisMorning: p.h < 5
    };
  }

  // ---------- inputs from NWS ----------
  // grid: the forecastGridData JSON (properties.*). alerts: /alerts/active JSON (features[]).
  function extract(grid, alerts, win) {
    var P = (grid && grid.properties) || grid || {};
    var snow = layer(P, 'snowfallAmount', 'len'), ice = layer(P, 'iceAccumulation', 'len');
    var temp = layer(P, 'temperature', 'temp'), wc = layer(P, 'windChill', 'temp'), pop = layer(P, 'probabilityOfPrecipitation', 'pct');
    var snowEarly = sumIn(snow, win.start, win.late), snowLate = sumIn(snow, win.late, win.end);
    var events = [];
    ((alerts && alerts.features) || []).forEach(function (f) {
      var a = f.properties || f; if (!a.event) return;
      var ends = Date.parse(a.ends || '') || null, onset = Date.parse(a.onset || a.effective || '') || null;
      if (ends && ends <= win.start) return;           // over before tonight
      if (onset && onset >= win.end + 4 * HOUR) return; // starts after noon tomorrow
      if (a.messageType === 'Cancel' || a.status === 'Test') return;
      events.push(a.event);
    });
    return {
      snowIn: snowEarly + snowLate, snowEarlyIn: snowEarly, snowLateIn: snowLate,
      iceIn: sumIn(ice, win.start, win.end),
      lowF: minIn(temp, win.start, win.end), windChillF: minIn(wc, win.start, win.end),
      popMax: maxIn(pop, win.start, win.end),
      hasSnowData: covered(snow, win.start, win.end),
      alerts: events.filter(function (e, i) { return events.indexOf(e) === i; })
    };
  }

  // ---------- the heuristic ----------
  // Every number here is written out on the page under "How we estimate".
  var REGION = {
    used: { label: 'Snow-used', snowT: 6, iceT: 0.25, cold: [[-25, 25], [-15, 10]], advisory: 8 },
    rare: { label: 'Rarely sees snow', snowT: 1.5, iceT: 0.1, cold: [[0, 20], [10, 10]], advisory: 15 }
  };
  var ALERTS = [ // [event name, points, plain label]
    ['Blizzard Warning', 25], ['Ice Storm Warning', 25], ['Winter Storm Warning', 20],
    ['Extreme Cold Warning', 15], ['Wind Chill Warning', 15], ['Lake Effect Snow Warning', 20],
    ['Winter Weather Advisory', 'adv'], ['Winter Storm Watch', 6],
    ['Cold Weather Advisory', 5], ['Wind Chill Advisory', 5]
  ];
  var ALERT_CAP = 30, SNOW_CAP = 75, ICE_CAP = 60;

  function r1(x) { return Math.round(x * 10) / 10; }
  function inchText(x) { if (x < 0.05) return 'under 0.1 in.'; return r1(x).toFixed(x < 10 ? 1 : 0) + ' in.'; }

  function odds(inp, regionKey) {
    var R = REGION[regionKey] || REGION.used;
    var reasons = []; // {pts, text}
    var late = inp.snowLateIn >= 0.1;
    var effSnow = inp.snowLateIn + inp.snowEarlyIn * (late ? 1 : 0.6);
    var pop = inp.popMax == null ? 100 : inp.popMax;
    var popF = 0.6 + 0.4 * Math.min(1, pop / 70);

    var snowPts = Math.min(SNOW_CAP, 50 * effSnow / R.snowT) * popF;
    var icePts = Math.min(ICE_CAP, 50 * inp.iceIn / R.iceT) * popF;

    var coldPts = 0, cold = inp.windChillF != null ? inp.windChillF : inp.lowF;
    if (cold != null) { for (var i = 0; i < R.cold.length; i++) { if (cold <= R.cold[i][0]) { coldPts = R.cold[i][1]; break; } } }

    var alertPts = 0, alertList = [];
    inp.alerts.forEach(function (ev) {
      for (var j = 0; j < ALERTS.length; j++) {
        if (ALERTS[j][0].toLowerCase() === String(ev).toLowerCase()) {
          var p = ALERTS[j][1] === 'adv' ? R.advisory : ALERTS[j][1];
          alertList.push({ event: ALERTS[j][0], pts: p }); alertPts += p; return;
        }
      }
    });
    alertPts = Math.min(ALERT_CAP, alertPts);
    alertList.sort(function (a, b) { return b.pts - a.pts; });

    var raw = snowPts + icePts + coldPts + alertPts;
    var chance = Math.max(1, Math.min(99, Math.round(raw)));

    // Plain reasons, biggest contributor first.
    if (inp.snowIn >= 0.05) {
      var t = inchText(inp.snowIn) + ' of snow expected overnight';
      if (!late) t = inchText(inp.snowIn) + ' of snow, ending before 5am';
      reasons.push({ pts: snowPts, text: t });
    }
    if (inp.iceIn >= 0.01) reasons.push({ pts: icePts, text: (inp.iceIn < 0.1 ? 'A glaze of ice' : r1(inp.iceIn) + ' in. of ice') + ' expected' });
    alertList.forEach(function (a, k) { reasons.push({ pts: k === 0 ? Math.min(a.pts, ALERT_CAP) : 0.5, text: a.event + ' in effect' }); });
    if (coldPts > 0) reasons.push({ pts: coldPts, text: (inp.windChillF != null ? 'Wind chill near ' : 'Low near ') + Math.round(cold) + DEG + 'F' });
    if (!reasons.length) {
      if (!inp.hasSnowData) reasons.push({ pts: 0, text: 'Forecast doesn\u2019t reach tomorrow morning yet' });
      reasons.push({ pts: 0, text: 'No snow or ice in the overnight forecast' });
      if (inp.lowF != null) reasons.push({ pts: 0, text: 'Low near ' + Math.round(inp.lowF) + DEG + 'F' });
    } else if (inp.snowIn < 0.05 && inp.iceIn < 0.01) {
      reasons.push({ pts: 0, text: 'No snow or ice in the overnight forecast' });
    }
    reasons.sort(function (a, b) { return b.pts - a.pts; });

    return {
      chance: chance, region: regionKey in REGION ? regionKey : 'used',
      parts: { snow: r1(snowPts), ice: r1(icePts), cold: coldPts, alerts: alertPts, popFactor: Math.round(popF * 100) / 100, effectiveSnowIn: r1(effSnow) },
      reasons: reasons.map(function (r) { return r.text; }),
      label: label(chance)
    };
  }
  function label(c) {
    if (c >= 75) return 'Pajamas inside out';
    if (c >= 50) return 'Real chance';
    if (c >= 25) return 'Maybe a delay';
    if (c >= 10) return 'Long shot';
    return 'Pack your bag';
  }

  return {
    parseDuration: parseDuration, parseValidTime: parseValidTime, toInches: toInches, toF: toF,
    layer: layer, sumIn: sumIn, minIn: minIn, partsIn: partsIn, zonedTime: zonedTime,
    targetWindow: targetWindow, extract: extract, odds: odds, label: label, REGION: REGION, ALERTS: ALERTS
  };
});
