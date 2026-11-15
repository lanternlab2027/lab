/* Year in Motion: activity parsers. Pure functions; no network, no storage.
 *
 * Strava bulk export ("Download your account" -> Request download): a .zip with activities.csv and an activities/
 * folder of the original files (.fit.gz / .gpx / .gpx.gz / .tcx.gz). activities.csv (current header, verified on
 * public sample exports) starts:
 *   Activity ID, Activity Date, Activity Name, Activity Type, Activity Description, Elapsed Time, Distance,
 *   Max Heart Rate, Relative Effort, Commute, Activity Private Note, Activity Gear, Filename, Athlete Weight,
 *   Bike Weight, Elapsed Time, Moving Time, Distance, Max Speed, Average Speed, Elevation Gain, ...
 * Names repeat: the first Distance is in display units (km), the second in meters; times are seconds; elevation is
 * meters. Activity Date looks like "Aug 24, 2024, 10:47:26 AM" and is UTC. Older exports have only the first block
 * (some label it "Distance in Kilometers"). Headers can be localized, so a positional fallback is used.
 *
 * Garmin Connect web -> Activities -> Export CSV (only the rows loaded on screen are exported). Header starts:
 *   Activity Type, Date, Favorite, Title, Distance, Calories, Time, Avg HR, Max HR, ... Total Ascent (or Ascent),
 *   Total Descent, ... Moving Time, Elapsed Time, Min Elevation, Max Elevation
 * Values follow the account's unit settings (km or mi, m or ft) with no unit in the header, quoted, with "--" for
 * missing and "1,207"-style thousands. Date is local time "2025-02-06 17:06:03". Durations are "00:31:24(.3)".
 *
 * Garmin "Export Your Data" archive: no CSV; DI_CONNECT/DI-Connect-Fitness/*_summarizedActivities.json is read
 * (best effort; units are sanity-checked because Garmin does not document them).
 *
 * All times end up as "local wall clock" ms: Date.UTC(y, m, d, h, mi) of the local time, read back with getUTC*.
 */
(function (root) {
  'use strict';

  // ---------- CSV ----------
  function sniffDelimiter(text) {
    var line = '', q = false;
    for (var i = 0; i < text.length && i < 20000; i++) {
      var c = text[i];
      if (c === '"') q = !q;
      if (!q && (c === '\n' || c === '\r')) break;
      if (!q) line += c;
    }
    var best = ',', bestN = 0;
    [',', ';', '\t'].forEach(function (d) { var n = line.split(d).length - 1; if (n > bestN) { bestN = n; best = d; } });
    return best;
  }

  function parseCSV(text, delim) {
    text = String(text || '').replace(/^\ufeff/, '');
    delim = delim || sniffDelimiter(text);
    var rows = [], row = [], field = '', i = 0, n = text.length, q = false;
    while (i < n) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && field.replace(/\s/g, '') === '') { q = true; field = ''; i++; continue; }
      if (c === delim) { row.push(field); field = ''; i++; continue; }
      if (c === '\r' || c === '\n') {
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
        i++; continue;
      }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
    return rows;
  }

  function normKey(h) { return String(h || '').replace(/^\ufeff/, '').replace(/[\u00ae\u2122]/g, '').trim().toLowerCase().replace(/\s+/g, ' '); }

  // Column lookup that keeps every occurrence of a repeated header (Strava repeats Distance, Elapsed Time...).
  function columns(header) {
    var map = {};
    header.forEach(function (h, i) { (map[h] = map[h] || []).push(i); });
    return function (names, nth) {
      for (var k = 0; k < names.length; k++) {
        var a = map[names[k]];
        if (a && a.length > (nth || 0)) return a[nth || 0];
      }
      return -1;
    };
  }

  // ---------- fields ----------
  function cell(row, i) { return i < 0 || row[i] == null ? '' : String(row[i]).trim(); }
  function missing(s) { return s === '' || s === '--' || /^n\/?a$/i.test(s) || s === '-'; }

  // dc: the file uses decimal commas ("5,48"). Without it, "1,207" is thousands and "5.48" is decimal.
  function num(s, dc) {
    s = String(s == null ? '' : s).trim().replace(/[\s\u00a0']/g, '');
    if (missing(s)) return null;
    if (/[.,].*[.,]/.test(s) && /,/.test(s) && /\./.test(s)) {
      // both: the last one is the decimal mark
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (/,/.test(s)) {
      if (!dc && /^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
      else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (dc && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, '');
    if (!/^-?\d+(\.\d+)?$/.test(s) && !/^-?\.\d+$/.test(s)) return null;
    var v = parseFloat(s);
    return isFinite(v) ? v : null;
  }

  // "1955", "1955.0", "00:31:24", "01:54:09.70", "42:05.26", "1:02:03" -> seconds
  function duration(s, dc) {
    s = String(s == null ? '' : s).trim();
    if (missing(s)) return null;
    if (/^\d+(:\d{1,2}){1,2}([.,]\d+)?$/.test(s)) {
      var parts = s.replace(',', '.').split(':').map(parseFloat), t = 0;
      parts.forEach(function (p) { t = t * 60 + p; });
      return t;
    }
    return num(s, dc);
  }

  // ---------- dates ----------
  var MONTHS = {};
  [['jan january janv janvier januar ene enero gen gennaio janeiro jaen', 1],
   ['feb february febr fevr fevrier februar febrero febbraio fev fevereiro', 2],
   ['mar march mars marz maerz mrz marzo mrt maart marco', 3],
   ['apr april avr avril abr abril aprile', 4],
   ['may mai mei mayo mag maggio maio', 5],
   ['jun june juin juni junio giu giugno junho', 6],
   ['jul july juil juillet juli julio lug luglio julho', 7],
   ['aug august aout ago agosto augustus', 8],
   ['sep sept september septembre septiembre set settembre setembro', 9],
   ['oct october octobre okt oktober octubre ott ottobre out outubro', 10],
   ['nov november novembre noviembre novembro', 11],
   ['dec december decembre dez dezember dic diciembre dicembre dezembro', 12]
  ].forEach(function (m) { m[0].split(' ').forEach(function (k) { MONTHS[k] = m[1]; }); });

  function deaccent(s) { return s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s; }

  function valid(o) {
    if (!o || !(o.y >= 1970 && o.y <= 2100) || !(o.mo >= 1 && o.mo <= 12) || !(o.d >= 1 && o.d <= 31)) return null;
    if (!(o.h >= 0 && o.h <= 23) || !(o.mi >= 0 && o.mi <= 59)) return null;
    return o;
  }

  // Returns { y, mo, d, h, mi, s, utcMs? } or null. utcMs is set when the string carries a zone (Z or +hh:mm).
  function parseDateTime(str) {
    var s = String(str == null ? '' : str).trim();
    if (!s) return null;
    var m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?)?\s*(Z|UTC|GMT|[+-]\d{2}:?\d{2})?$/i.exec(s);
    var o;
    if (m) {
      o = { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
      if (!valid(o)) return null;
      if (m[7]) {
        var off = 0;
        if (/^[+-]/.test(m[7])) { var z = m[7].replace(':', ''); off = (z[0] === '-' ? -1 : 1) * (+z.slice(1, 3) * 60 + +z.slice(3, 5)); }
        o.utcMs = Date.UTC(o.y, o.mo - 1, o.d, o.h, o.mi, o.s) - off * 60000;
      }
      return o;
    }
    var low = deaccent(s.toLowerCase());
    var tm = /(\d{1,2})[:h](\d{2})(?::(\d{2}))?\s*([ap])?\.?\s*(m\.?)?(?![a-z])/.exec(low);
    var h = 0, mi = 0, sec = 0, rest = low;
    if (tm) {
      h = +tm[1]; mi = +tm[2]; sec = +(tm[3] || 0);
      if (tm[4] === 'p' && h < 12) h += 12;
      if (tm[4] === 'a' && h === 12) h = 0;
      rest = low.slice(0, tm.index) + ' ' + low.slice(tm.index + tm[0].length);
    }
    var zone = /\b(utc|gmt|z)\b/.test(rest);
    // Month-name forms: "Aug 24, 2024", "24 Aug 2024", "24. Aug. 2024", "24 de ago. de 2024"
    var words = rest.match(/[a-z]+/g) || [], mo = null;
    for (var i = 0; i < words.length && !mo; i++) if (MONTHS[words[i]]) mo = MONTHS[words[i]];
    var nums = (rest.match(/\d+/g) || []).map(Number);
    if (mo) {
      var y = null, d = null;
      nums.forEach(function (n) { if (n >= 1970 && n <= 2100 && y == null) y = n; else if (n >= 1 && n <= 31 && d == null) d = n; });
      o = valid({ y: y, mo: mo, d: d, h: h, mi: mi, s: sec });
    } else {
      var nm = /(\d{1,4})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(rest);
      if (!nm) return null;
      var a = +nm[1], b = +nm[2], c = +nm[3];
      if (nm[1].length === 4) o = valid({ y: a, mo: b, d: c, h: h, mi: mi, s: sec });
      else {
        if (c < 100) c += 2000;
        var dayFirst = a > 12 || /\./.test(nm[0]);
        o = valid(dayFirst ? { y: c, mo: b, d: a, h: h, mi: mi, s: sec } : { y: c, mo: a, d: b, h: h, mi: mi, s: sec });
      }
    }
    if (o && zone) o.utcMs = Date.UTC(o.y, o.mo - 1, o.d, o.h, o.mi, o.s);
    return o;
  }

  function wall(o) { return Date.UTC(o.y, o.mo - 1, o.d, o.h, o.mi, o.s || 0); }

  // ---------- sports ----------
  var SPORTS = [
    ['swim', /swim/],
    ['ride', /ride|cycl|bik(e|ing)|velomobile|handcycle|spin/],
    ['ski', /ski|snowboard|snowshoe/],
    ['run', /run|jog|treadmill/],
    ['hike', /hik|mountaineer|trek/],
    ['walk', /walk/],
    ['row', /row/],
    ['paddle', /kayak|canoe|paddl|\bsup\b|surf|kite/],
    ['climb', /climb|boulder/],
    ['yoga', /yoga|pilates|stretch|breath|meditat|barre/],
    ['strength', /weight|strength|crossfit|hiit|workout|cardio|training|elliptical|stair|fitness|core|bootcamp|gym/]
  ];
  var FIT_SPORT = { 1: 'running', 2: 'cycling', 4: 'fitness equipment', 5: 'swimming', 10: 'training', 11: 'walking', 12: 'cross country skiing', 13: 'alpine skiing', 14: 'snowboarding', 15: 'rowing', 16: 'mountaineering', 17: 'hiking', 19: 'paddling', 21: 'e-biking', 31: 'rock climbing', 37: 'stand up paddleboarding', 41: 'kayaking', 43: 'yoga' };

  function sportOf(type) {
    var t = deaccent(String(type || '').toLowerCase()).replace(/([a-z])([A-Z])/g, '$1 $2');
    for (var i = 0; i < SPORTS.length; i++) if (SPORTS[i][1].test(t)) return SPORTS[i][0];
    return 'other';
  }

  function mkAct(o) {
    return {
      src: o.src, type: o.type || '', sport: sportOf(o.type), wall: o.wall == null ? null : o.wall, utc: o.utc == null ? null : o.utc,
      dist: o.dist > 0 ? o.dist : null, moving: o.moving > 0 ? o.moving : null, elapsed: o.elapsed > 0 ? o.elapsed : null,
      elev: o.elev > 0 ? o.elev : null, file: o.file || '', commute: !!o.commute, nameHint: o.nameHint || ''
    };
  }

  function detectDecimalComma(rows, cols) {
    var commas = 0, dots = 0;
    for (var r = 1; r < rows.length && r < 400; r++) cols.forEach(function (c) {
      var v = cell(rows[r], c).replace(/\s/g, '');
      if (/^\d+,\d{1,2}$/.test(v)) commas++;
      else if (/^\d+\.\d{1,2}$/.test(v) || /^\d+\.\d{4,}$/.test(v)) dots++;
    });
    return commas > dots;
  }

  // ---------- Strava activities.csv ----------
  function looksStrava(header) { return header.indexOf('activity id') >= 0 && (header.indexOf('activity date') >= 0 || header.indexOf('activity type') >= 0); }

  function parseStrava(rows) {
    var header = rows[0].map(normKey), col = columns(header);
    var c = {
      date: col(['activity date']), type: col(['activity type']), name: col(['activity name']),
      elapsed: col(['elapsed time']), moving: col(['moving time']),
      dist1: col(['distance', 'distance in kilometers']), distMi: col(['distance in miles']), dist2: col(['distance'], 1),
      elev: col(['elevation gain']), file: col(['filename']), commute: col(['commute'])
    };
    var positional = false;
    if (c.date < 0 || c.type < 0) {
      // Localized headers: Strava's column order has been stable (ID, Date, Name, Type, Description, Elapsed, Distance...).
      var okDates = 0, sample = rows.slice(1, 40);
      sample.forEach(function (r) { if (parseDateTime(cell(r, 1))) okDates++; });
      if (!sample.length || okDates < sample.length * 0.8) return null;
      positional = true;
      c = { date: 1, name: 2, type: 3, elapsed: 5, dist1: 6, distMi: -1, dist2: -1, moving: -1, elev: -1, file: -1, commute: -1 };
      if (header.length > 20 && header[15] === header[5] && header[17] === header[6]) { c.moving = 16; c.dist2 = 17; c.elev = 20; }
      for (var k = 0; k < header.length; k++) if (rows.slice(1, 30).some(function (r) { return /^activities\//.test(cell(r, k)); })) { c.file = k; break; }
    }
    var dc = detectDecimalComma(rows, [c.dist1]);
    var acts = [], skipped = 0;
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i], dt = parseDateTime(cell(r, c.date));
      if (!dt) { skipped++; continue; }
      var type = cell(r, c.type), sport = sportOf(type);
      var d2 = num(cell(r, c.dist2)), d1 = num(cell(r, c.dist1), dc), dmi = num(cell(r, c.distMi), dc);
      var dist = d2 != null && d2 > 0 ? d2 : dmi != null ? dmi * 1609.344 : d1 != null ? (sport === 'swim' && d1 >= 50 ? d1 : d1 * 1000) : null;
      var utc = dt.utcMs != null ? dt.utcMs : wall(dt); // Strava's Activity Date is UTC
      acts.push(mkAct({
        src: 'strava', type: type, utc: utc, dist: dist,
        elapsed: duration(cell(r, c.elapsed)), moving: duration(cell(r, c.moving)), elev: num(cell(r, c.elev)),
        file: cell(r, c.file), commute: /^(true|1|yes)$/i.test(cell(r, c.commute)), nameHint: cell(r, c.name)
      }));
    }
    return { source: 'strava', acts: acts, skipped: skipped, positional: positional, tz: 'utc' };
  }

  // ---------- Garmin Connect activities CSV ----------
  function looksGarmin(header) { return header.indexOf('activity type') >= 0 && header.indexOf('date') >= 0 && (header.indexOf('title') >= 0 || header.indexOf('favorite') >= 0 || header.indexOf('distance') >= 0); }

  // Garmin writes values in the account's units. Guess from temperatures and elevations; null when unsure.
  function guessGarminUnits(rows) {
    var header = rows[0].map(normKey), col = columns(header);
    var temps = [], elevs = [];
    var tc = [col(['min temp']), col(['max temp'])], ec = col(['max elevation']);
    for (var i = 1; i < rows.length; i++) {
      tc.forEach(function (k) { var v = num(cell(rows[i], k)); if (v != null && v !== 0) temps.push(v); });
      var e = num(cell(rows[i], ec)); if (e != null) elevs.push(e);
    }
    temps.sort(function (a, b) { return a - b; });
    if (temps.length >= 3) { var med = temps[temps.length >> 1]; if (med >= 45) return 'imperial'; if (med <= 32) return 'metric'; }
    if (elevs.some(function (e) { return e > 9000; })) return 'imperial';
    return null;
  }

  function parseGarmin(rows, units) {
    var header = rows[0].map(normKey), col = columns(header);
    var c = {
      type: col(['activity type']), date: col(['date', 'start time']), title: col(['title']),
      dist: col(['distance']), time: col(['time']), moving: col(['moving time']), elapsed: col(['elapsed time']),
      elev: col(['total ascent', 'ascent', 'elevation gain'])
    };
    var dc = detectDecimalComma(rows, [c.dist]);
    var imp = units === 'imperial';
    var acts = [], skipped = 0;
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i], dt = parseDateTime(cell(r, c.date));
      if (!dt) { skipped++; continue; }
      var type = cell(r, c.type), sport = sportOf(type);
      var dv = num(cell(r, c.dist), dc), dist = null;
      if (dv != null) {
        if (sport === 'swim' && dv >= 50) dist = imp ? dv * 0.9144 : dv; // pool swims are in m or yd
        else dist = dv * (imp ? 1609.344 : 1000);
      }
      var ev = num(cell(r, c.elev), dc);
      var time = duration(cell(r, c.time)), mv = duration(cell(r, c.moving)), el = duration(cell(r, c.elapsed));
      acts.push(mkAct({
        src: 'garmin', type: type, wall: dt.utcMs != null ? null : wall(dt), utc: dt.utcMs != null ? dt.utcMs : null, dist: dist,
        moving: mv > 0 ? mv : time, elapsed: el > 0 ? el : time, elev: ev == null ? null : ev * (imp ? 0.3048 : 1), nameHint: cell(r, c.title)
      }));
    }
    return { source: 'garmin', acts: acts, skipped: skipped, tz: 'local' };
  }

  // Garmin "Export Your Data" summarizedActivities.json (undocumented; units checked against plausible speeds).
  function parseGarminJSON(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return null; }
    var list = null;
    (function find(o, depth) {
      if (list || depth > 4 || !o || typeof o !== 'object') return;
      if (Array.isArray(o)) {
        if (o.length && o[0] && typeof o[0] === 'object' && ('activityType' in o[0] || 'activityId' in o[0]) && ('startTimeLocal' in o[0] || 'startTimeGmt' in o[0])) { list = o; return; }
        o.forEach(function (x) { find(x, depth + 1); });
      } else Object.keys(o).forEach(function (k) { find(o[k], depth + 1); });
    })(data, 0);
    if (!list) return null;
    // Decide units: distance in cm and duration in ms is what recent exports use; fall back to m / s if speeds are absurd.
    var ratios = [];
    list.forEach(function (a) { if (a.distance > 0 && a.duration > 0) ratios.push(a.distance / a.duration); });
    ratios.sort(function (a, b) { return a - b; });
    var r = ratios.length ? ratios[ratios.length >> 1] : 300;
    var pick = [[0.01, 0.001], [1, 1], [1, 0.001], [0.01, 1]].filter(function (u) { var v = r * u[0] / u[1]; return v > 0.2 && v < 25; })[0] || [0.01, 0.001];
    var dScale = pick[0], tScale = pick[1];
    var acts = list.map(function (a) {
      var type = typeof a.activityType === 'string' ? a.activityType : (a.activityType && (a.activityType.typeKey || a.activityType.type)) || a.sportType || '';
      var wallMs = typeof a.startTimeLocal === 'number' ? a.startTimeLocal : null;
      var utc = typeof a.startTimeGmt === 'number' ? a.startTimeGmt : null;
      if (wallMs == null && utc == null) return null;
      return mkAct({
        src: 'garmin', type: String(type).replace(/_/g, ' '), wall: wallMs, utc: wallMs == null ? utc : null,
        dist: a.distance > 0 ? a.distance * dScale : null, elapsed: a.elapsedDuration > 0 ? a.elapsedDuration * tScale : a.duration * tScale,
        moving: a.movingDuration > 0 ? a.movingDuration * tScale : a.duration * tScale, elev: a.elevationGain > 0 ? a.elevationGain * dScale : null, nameHint: a.name || ''
      });
    }).filter(Boolean);
    return { source: 'garmin-archive', acts: acts, skipped: list.length - acts.length, tz: 'local' };
  }

  // Detect and parse any supported CSV. opts.garminUnits: 'metric' | 'imperial' | null (auto).
  function parseActivitiesCSV(text, opts) {
    opts = opts || {};
    var rows = parseCSV(text);
    if (rows.length < 1) throw new Error('That file is empty.');
    var header = rows[0].map(normKey), res = null;
    if (looksStrava(header) || (rows.length > 1 && /^\d{6,}$/.test(cell(rows[1], 0)) && parseDateTime(cell(rows[1], 1)))) res = parseStrava(rows);
    else if (looksGarmin(header)) {
      var guess = guessGarminUnits(rows);
      res = parseGarmin(rows, opts.garminUnits || guess || opts.defaultUnits || 'metric');
      res.unitsGuess = guess;
    }
    if (!res) throw new Error('That CSV doesn\u2019t look like a Strava activities.csv or a Garmin Connect activities export.');
    if (!res.acts.length) throw new Error('No activities found in that file.');
    return res;
  }

  // ---------- tracks: GPX / TCX / FIT ----------
  var R = 6371008.8;
  function hav(la1, lo1, la2, lo2) {
    var p = Math.PI / 180, dla = (la2 - la1) * p, dlo = (lo2 - lo1) * p;
    var a = Math.sin(dla / 2) * Math.sin(dla / 2) + Math.cos(la1 * p) * Math.cos(la2 * p) * Math.sin(dlo / 2) * Math.sin(dlo / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function tag(block, name) {
    var m = new RegExp('<(?:\\w+:)?' + name + '\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?' + name + '>', 'i').exec(block);
    return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
  }
  function attr(s, name) { var m = new RegExp('\\b' + name + '\\s*=\\s*["\']([^"\']*)["\']', 'i').exec(s); return m ? m[1] : null; }
  function isoUtc(s) { var d = parseDateTime(s); return d ? (d.utcMs != null ? d.utcMs : wall(d)) : null; }

  function parseGPX(text) {
    var pts = [], re = /<(?:\w+:)?(trkpt|rtept)\b([^>]*?)(\/>|>([\s\S]*?)<\/(?:\w+:)?\1>)/gi, m;
    while ((m = re.exec(text))) {
      var la = parseFloat(attr(m[2], 'lat')), lo = parseFloat(attr(m[2], 'lon'));
      if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) continue;
      var body = m[4] || '';
      var ele = parseFloat(tag(body, 'ele')), t = body ? isoUtc(tag(body, 'time')) : null;
      pts.push([la, lo, t, isFinite(ele) ? ele : null]);
    }
    var trk = /<(?:\w+:)?trk\b[^>]*>([\s\S]*?)<(?:\w+:)?trkseg/i.exec(text);
    var type = trk ? tag(trk[1], 'type') : '';
    if (/^\d+$/.test(type)) type = '';
    var t0 = isoUtc(tag(tag(text, 'metadata'), 'time'));
    return { kind: 'gpx', type: type, pts: pts, startUtc: t0 };
  }

  function parseTCX(text) {
    var pts = [], re = /<(?:\w+:)?Trackpoint\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Trackpoint>/gi, m;
    while ((m = re.exec(text))) {
      var b = m[1], la = parseFloat(tag(b, 'LatitudeDegrees')), lo = parseFloat(tag(b, 'LongitudeDegrees'));
      if (!isFinite(la) || !isFinite(lo)) continue;
      var ele = parseFloat(tag(b, 'AltitudeMeters'));
      pts.push([la, lo, isoUtc(tag(b, 'Time')), isFinite(ele) ? ele : null]);
    }
    var sm = /<(?:\w+:)?Activity\b[^>]*Sport\s*=\s*["']([^"']+)["']/i.exec(text);
    var lap = /<(?:\w+:)?Lap\b[^>]*StartTime\s*=\s*["']([^"']+)["']/i.exec(text);
    var tot = 0, dist = 0, lre = /<(?:\w+:)?Lap\b[\s\S]*?<\/(?:\w+:)?Lap>/gi, lm;
    while ((lm = lre.exec(text))) { tot += parseFloat(tag(lm[0], 'TotalTimeSeconds')) || 0; var dd = /<\/(?:\w+:)?TotalTimeSeconds>\s*<(?:\w+:)?DistanceMeters>([\d.]+)/i.exec(lm[0]); if (dd) dist += parseFloat(dd[1]); }
    return { kind: 'tcx', type: sm ? sm[1] : '', pts: pts, startUtc: lap ? isoUtc(lap[1]) : null, timer: tot || null, dist: dist || null };
  }

  // Minimal FIT reader: record (20) positions/altitude/timestamps and session (18) totals. Handles compressed
  // timestamp headers, developer fields, big-endian definitions and chained FIT files.
  var FIT_EPOCH = 631065600000;
  function parseFIT(buf) {
    var dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    var out = { kind: 'fit', type: '', pts: [], startUtc: null, timer: null, elapsed: null, dist: null, ascent: null };
    var pos = 0, files = 0;
    function rd(p, f, le) {
      var bt = f.b & 0x1f;
      switch (bt) {
        case 0: case 2: case 10: case 13: return f.s === 1 ? buf[p] : null;
        case 1: return f.s === 1 ? dv.getInt8(p) : null;
        case 3: return f.s === 2 ? dv.getInt16(p, le) : null;
        case 4: case 11: return f.s === 2 ? dv.getUint16(p, le) : null;
        case 5: return f.s === 4 ? dv.getInt32(p, le) : null;
        case 6: case 12: return f.s === 4 ? dv.getUint32(p, le) : null;
        case 8: return f.s === 4 ? dv.getFloat32(p, le) : null;
        default: return null;
      }
    }
    var BAD = { 0: 0xff, 2: 0xff, 1: 0x7f, 3: 0x7fff, 4: 0xffff, 5: 0x7fffffff, 6: 0xffffffff, 10: 0, 11: 0, 12: 0 };
    while (pos + 12 <= buf.length && files < 8) {
      var hs = buf[pos];
      if (hs < 12 || pos + hs > buf.length) break;
      if (String.fromCharCode(buf[pos + 8], buf[pos + 9], buf[pos + 10], buf[pos + 11]) !== '.FIT') break;
      var size = dv.getUint32(pos + 4, true), p = pos + hs, end = Math.min(buf.length, p + size);
      var defs = {}, lastTs = 0;
      files++;
      while (p < end) {
        var h = buf[p++], d, ts = null;
        if (h & 0x80) {
          d = defs[(h >> 5) & 3];
          var off = h & 0x1f;
          ts = ((lastTs & ~0x1f) >>> 0) + off;
          if (off < (lastTs & 0x1f)) ts += 0x20;
          lastTs = ts;
        } else if (h & 0x40) {
          if (p + 5 > end) break;
          var le = buf[p + 1] === 0, gm = dv.getUint16(p + 2, le), nf = buf[p + 4];
          p += 5;
          var fields = [], total = 0;
          for (var i = 0; i < nf; i++) { fields.push({ n: buf[p], s: buf[p + 1], b: buf[p + 2] }); total += buf[p + 1]; p += 3; }
          if (h & 0x20) { var nd = buf[p++]; for (var j = 0; j < nd; j++) { total += buf[p + 1]; p += 3; } }
          defs[h & 0x0f] = { gm: gm, le: le, fields: fields, total: total };
          continue;
        } else d = defs[h & 0x0f];
        if (!d) break; // corrupt: data before definition
        if (p + d.total > end) break;
        if (d.gm === 20 || d.gm === 18 || d.gm === 12) {
          var v = {}, q = p;
          for (var k = 0; k < d.fields.length; k++) {
            var f = d.fields[k], val = rd(q, f, d.le);
            if (val != null && val !== BAD[f.b & 0x1f]) v[f.n] = val;
            q += f.s;
          }
          if (v[253] != null) { lastTs = v[253]; if (ts == null) ts = v[253]; }
          if (d.gm === 20) {
            if (v[0] != null && v[1] != null) {
              var alt = v[78] != null ? v[78] / 5 - 500 : v[2] != null ? v[2] / 5 - 500 : null;
              out.pts.push([v[0] * (180 / 2147483648), v[1] * (180 / 2147483648), ts != null ? FIT_EPOCH + ts * 1000 : null, alt]);
            }
          } else if (d.gm === 18) {
            if (v[2] != null && out.startUtc == null) out.startUtc = FIT_EPOCH + v[2] * 1000;
            if (v[5] != null && !out.type) out.type = FIT_SPORT[v[5]] || '';
            if (v[7] != null) out.elapsed = (out.elapsed || 0) + v[7] / 1000;
            if (v[8] != null) out.timer = (out.timer || 0) + v[8] / 1000;
            if (v[9] != null) out.dist = (out.dist || 0) + v[9] / 100;
            if (v[22] != null) out.ascent = (out.ascent || 0) + v[22];
          } else if (d.gm === 12 && v[0] != null && !out.type) out.type = FIT_SPORT[v[0]] || '';
        }
        p += d.total;
      }
      pos = end + 2;
    }
    if (!files) throw new Error('not a FIT file');
    return out;
  }

  // Summarize a raw track into an activity plus a light polyline for the route art.
  function summarizeTrack(raw) {
    var pts = raw.pts.filter(function (p) { return !(p[0] === 0 && p[1] === 0); });
    var dist = 0, moving = 0, gain = 0, ref = null;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], dd = hav(a[0], a[1], b[0], b[1]);
      dist += dd;
      if (a[2] != null && b[2] != null) { var dt = (b[2] - a[2]) / 1000; if (dt > 0 && dt <= 300 && dd / dt >= 0.3) moving += dt; }
    }
    pts.forEach(function (p) {
      if (p[3] == null) return;
      if (ref == null) ref = p[3];
      else if (p[3] > ref + 4) { gain += p[3] - ref; ref = p[3]; }
      else if (p[3] < ref - 4) ref = p[3];
    });
    var times = pts.filter(function (p) { return p[2] != null; });
    var start = raw.startUtc != null ? raw.startUtc : times.length ? times[0][2] : null;
    var elapsed = raw.elapsed || (times.length > 1 ? (times[times.length - 1][2] - times[0][2]) / 1000 : null);
    var totalDist = raw.dist || dist;
    var mv = raw.timer || moving || elapsed;
    var type = raw.type;
    if (!type && totalDist > 0 && mv > 0) {
      var v = totalDist / mv;
      type = v < 1.9 ? (gain / (totalDist / 1000) > 40 ? 'Hike' : 'Walk') : v < 4.3 ? 'Run' : 'Ride';
    }
    // Light polyline: drop points closer than 8 m, then cap at 1200 points.
    var line = [], last = null;
    pts.forEach(function (p) { if (!last || hav(last[0], last[1], p[0], p[1]) >= 8) { line.push([p[0], p[1]]); last = p; } });
    if (pts.length && line.length && line[line.length - 1] !== pts[pts.length - 1]) line.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
    if (line.length > 1200) { var step = line.length / 1200, l2 = []; for (var s = 0; s < 1200; s++) l2.push(line[Math.floor(s * step)]); l2.push(line[line.length - 1]); line = l2; }
    return {
      act: start == null ? null : mkAct({ src: 'track', type: type || 'Workout', utc: start, dist: totalDist, moving: mv, elapsed: elapsed, elev: raw.ascent != null ? raw.ascent : gain }),
      line: line.length >= 2 ? line : null, utc: start
    };
  }

  function textOf(bytes) { return typeof bytes === 'string' ? bytes : new TextDecoder('utf-8').decode(bytes); }

  // name: file name; bytes: Uint8Array (already gunzipped) or string.
  function parseTrackFile(name, bytes) {
    var n = name.toLowerCase().replace(/\.gz$/, '');
    if (/\.fit$/.test(n)) return summarizeTrack(parseFIT(bytes));
    var t = textOf(bytes);
    if (/\.tcx$/.test(n) || /<TrainingCenterDatabase/i.test(t.slice(0, 2000))) return summarizeTrack(parseTCX(t));
    if (/\.gpx$/.test(n) || /<gpx/i.test(t.slice(0, 2000))) return summarizeTrack(parseGPX(t));
    throw new Error('Unsupported track file: ' + name);
  }

  // ---------- time zones ----------
  // Strava's default names ("Morning Run", "Lunch Ride"...) are based on local start time, so they reveal the
  // athlete's UTC offset. Use the browser's zone unless a fixed offset explains those names clearly better.
  var NAME_WINDOWS = [[/^morning\b/i, function (h) { return h >= 3 && h < 12; }], [/^lunch\b/i, function (h) { return h >= 10 && h < 15; }],
    [/^afternoon\b/i, function (h) { return h >= 12 && h < 18; }], [/^evening\b/i, function (h) { return h >= 16 && h < 22; }],
    [/^night\b/i, function (h) { return h >= 20 || h < 5; }]];
  function browserWall(utc) { return utc - new Date(utc).getTimezoneOffset() * 60000; }

  function inferZone(acts) {
    var named = [];
    acts.forEach(function (a) {
      if (a.utc == null) return;
      for (var i = 0; i < NAME_WINDOWS.length; i++) if (NAME_WINDOWS[i][0].test(a.nameHint)) { named.push([a.utc, NAME_WINDOWS[i][1]]); break; }
    });
    if (named.length < 6) return { kind: 'browser', named: named.length };
    function hits(fn) { var n = 0; named.forEach(function (x) { if (x[1](new Date(fn(x[0])).getUTCHours())) n++; }); return n; }
    var bh = hits(browserWall), bestH = -1, all = [];
    for (var off = -720; off <= 840; off += 30) {
      var hh = hits(function (u) { return u + off * 60000; });
      all.push([off, hh]); if (hh > bestH) bestH = hh;
    }
    // Several offsets usually explain the names equally well; take the middle of that plateau.
    var plateau = all.filter(function (x) { return x[1] === bestH; }).map(function (x) { return x[0]; });
    var best = plateau[Math.floor((plateau.length - 1) / 2)];
    if (plateau.length % 2 === 0) best = Math.round((plateau[plateau.length / 2 - 1] + plateau[plateau.length / 2]) / 60) * 30;
    if (bestH > bh + Math.max(2, named.length * 0.1)) return { kind: 'fixed', offset: best, named: named.length, hits: bestH, browserHits: bh };
    return { kind: 'browser', named: named.length, hits: bh };
  }

  // Sets a.t (wall-clock ms) on every activity. zone: {kind:'browser'} | {kind:'fixed', offset: minutes}
  function applyZone(acts, zone) {
    acts.forEach(function (a) {
      if (a.wall != null) a.t = a.wall;
      else if (a.utc != null) a.t = zone && zone.kind === 'fixed' ? a.utc + zone.offset * 60000 : browserWall(a.utc);
      else a.t = null;
    });
    return acts;
  }

  var api = {
    parseCSV: parseCSV, num: num, duration: duration, parseDateTime: parseDateTime, sportOf: sportOf,
    parseActivitiesCSV: parseActivitiesCSV, parseStrava: parseStrava, parseGarmin: parseGarmin, guessGarminUnits: guessGarminUnits, parseGarminJSON: parseGarminJSON,
    parseGPX: parseGPX, parseTCX: parseTCX, parseFIT: parseFIT, summarizeTrack: summarizeTrack, parseTrackFile: parseTrackFile,
    inferZone: inferZone, applyZone: applyZone, hav: hav, wall: wall
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SportParser = api;
})(typeof self !== 'undefined' ? self : this);
