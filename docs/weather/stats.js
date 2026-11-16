/* Weather Wrapped: pure stats on Open-Meteo Historical Weather (archive) daily data. No DOM, no network.
 * Works in the browser (window.WeatherStats) and in Node (module.exports) for the unit tests.
 * Values arrive in the API defaults: degrees C, precipitation mm, snowfall cm, sunshine seconds, wind km/h. */
(function (root) {
  'use strict';

  var VARS = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'snowfall_sum', 'sunshine_duration', 'wind_speed_10m_max'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WET_MM = 1.0;          // a "wet day" has at least 1 mm (0.04 in.) of precipitation; anything less is dry
  var HOT_F = 90, FREEZE_F = 32;
  var NORMAL_WINDOW = 7;     // normal for a date = average over the same date +/- 7 days, across the 10 earlier years

  // ---------- dates (ISO yyyy-mm-dd, treated as plain calendar days) ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseISO(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null; }
  function iso(y, mo, d) { return y + '-' + pad(mo) + '-' + pad(d); }
  function epochDay(s) { var p = parseISO(s); return p ? Math.round(Date.UTC(p.y, p.mo - 1, p.d) / 86400000) : NaN; }
  function fromEpochDay(n) { var d = new Date(n * 86400000); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  function addDays(s, k) { return fromEpochDay(epochDay(s) + k); }
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  // Slot 0..365 in a leap-year calendar, so Feb 29 has its own slot and Mar 1 is the same slot every year.
  var CUM = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  function slot(s) { var p = parseISO(s); return CUM[p.mo - 1] + p.d - 1; }
  function shortDate(s, withYear) { var p = parseISO(s); return p ? MONTHS[p.mo - 1] + ' ' + p.d + (withYear ? ', ' + p.y : '') : ''; }
  function longDate(s) { var p = parseISO(s); if (!p) return ''; var wd = new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay(); return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][wd] + ', ' + MONTHS_LONG[p.mo - 1] + ' ' + p.d; }

  // ---------- which year, which dates ----------
  // In January the year that just ended is the one people want; otherwise the current year (so far).
  function defaultYear(todayISO) { var t = parseISO(todayISO); return t.mo === 1 ? t.y - 1 : t.y; }
  // Data only through yesterday (yesterday in the visitor's own calendar).
  function range(year, todayISO) {
    var yest = addDays(todayISO, -1), end = iso(year, 12, 31);
    if (yest < end) end = yest;
    var start = iso(year, 1, 1);
    return end < start ? null : { start: start, end: end };
  }
  function normalsRange(year) { return { start: iso(year - 10, 1, 1), end: iso(year - 1, 12, 31), from: year - 10, to: year - 1 }; }
  // "2026" when the data reach Dec 31, else "2026 so far".
  function yearLabel(year, lastISO) { return lastISO && lastISO >= iso(year, 12, 31) ? String(year) : year + ' so far'; }
  function isComplete(year, lastISO) { return !!lastISO && lastISO >= iso(year, 12, 31); }

  // ---------- units ----------
  function cToF(c) { return c * 9 / 5 + 32; }
  function dC2F(d) { return d * 9 / 5; }               // a temperature difference
  function mmToIn(mm) { return mm / 25.4; }
  function cmToIn(cm) { return cm / 2.54; }
  function kmhToMph(k) { return k / 1.609344; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function num(n, dec) {
    var s = (dec ? r1(n).toFixed(1) : String(Math.round(n)));
    if (dec && /\.0$/.test(s) && Math.abs(n) >= 100) s = s.slice(0, -2);
    var parts = s.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    s = parts.join('.');
    return s === '-0' ? '0' : s;
  }
  var DEG = '\u00b0';
  // u = { temp: 'F'|'C', precip: 'in'|'mm' }
  function temp(c, u) { return num(u.temp === 'F' ? cToF(c) : c) + DEG + u.temp; }
  function tempNum(c, u) { return Math.round(u.temp === 'F' ? cToF(c) : c); }
  function tempDelta(dc, u) { return num(Math.abs(u.temp === 'F' ? dC2F(dc) : dc)) + DEG; }
  function precip(mm, u) {
    if (u.precip === 'in') { var i = mmToIn(mm); return (i >= 100 ? num(i) : num(i, true)) + ' in.'; }
    return num(mm) + ' mm';
  }
  function snow(cm, u) {
    if (u.precip === 'in') { var i = cmToIn(cm); return (i > 0 && i < 0.05 ? '<0.1' : i >= 100 ? num(i) : num(i, true)) + ' in.'; }
    return (cm > 0 && cm < 0.5 ? '<1' : num(cm)) + ' cm';
  }
  function wind(kmh, u) { return u.precip === 'in' ? num(kmhToMph(kmh)) + ' mph' : num(kmh) + ' km/h'; }
  function hotLabel(u) { return u.temp === 'F' ? '90' + DEG + 'F or hotter' : '32' + DEG + 'C (90' + DEG + 'F) or hotter'; }
  function freezeLabel(u) { return u.temp === 'F' ? 'below 32' + DEG + 'F' : 'below 0' + DEG + 'C (32' + DEG + 'F)'; }
  function unitsFor(countryCode) { return /^(US|PR|GU|VI|AS|MP|LR|FM|MH|PW|BS|BZ|KY)$/i.test(countryCode || '') ? { temp: 'F', precip: 'in' } : { temp: 'C', precip: 'mm' }; }

  // ---------- parsing ----------
  function finite(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  // Turns an archive response into an array of days. Trailing days with no data at all are dropped (the newest
  // reanalysis days can lag), so "through" is the last day we really have.
  function parse(json) {
    if (!json || json.error) { var e = new Error((json && json.reason) || 'Bad response'); e.api = true; throw e; }
    var d = json.daily || {}, t = d.time || [], days = [];
    for (var i = 0; i < t.length; i++) {
      var p = parseISO(t[i]); if (!p) continue;
      days.push({
        date: iso(p.y, p.mo, p.d), y: p.y, mo: p.mo, d: p.d,
        tmax: finite((d.temperature_2m_max || [])[i]), tmin: finite((d.temperature_2m_min || [])[i]),
        prcp: finite((d.precipitation_sum || [])[i]), snow: finite((d.snowfall_sum || [])[i]),
        sun: finite((d.sunshine_duration || [])[i]), wind: finite((d.wind_speed_10m_max || d.windspeed_10m_max || [])[i])
      });
    }
    while (days.length && days[days.length - 1].tmax == null && days[days.length - 1].tmin == null && days[days.length - 1].prcp == null) days.pop();
    return { days: days, timezone: json.timezone || '', lat: json.latitude, lon: json.longitude, elevation: json.elevation };
  }

  // ---------- streaks ----------
  // Longest run of consecutive calendar days where pred(day) is true. A missing value (pred gets null) or a
  // gap in the dates breaks the run. Ties go to the earlier run.
  function longestRun(days, pred) {
    var best = { len: 0, start: null, end: null }, len = 0, start = null, prev = null;
    for (var i = 0; i < days.length; i++) {
      var day = days[i], ok = !!pred(day), contiguous = prev != null && epochDay(day.date) === epochDay(prev) + 1;
      if (ok) {
        if (len && contiguous) len++; else { len = 1; start = day.date; }
        if (len > best.len) best = { len: len, start: start, end: day.date };
      } else len = 0;
      prev = day.date;
    }
    return best;
  }
  function isDry(day) { return day.prcp != null && day.prcp < WET_MM; }
  function isWet(day) { return day.prcp != null && day.prcp >= WET_MM; }

  // ---------- normals (from the 10 earlier years of the same API) ----------
  // Returns 366 slots of { mean, n } for daily max temperature: each slot averages every value within
  // +/- NORMAL_WINDOW slots (wrapping around the new year), across all the years given.
  function normals(json) {
    var p = parse(json), sum = new Array(366).fill(0), cnt = new Array(366).fill(0);
    p.days.forEach(function (day) { if (day.tmax != null) { var s = slot(day.date); sum[s] += day.tmax; cnt[s]++; } });
    var out = [];
    for (var s = 0; s < 366; s++) {
      var a = 0, n = 0;
      for (var k = -NORMAL_WINDOW; k <= NORMAL_WINDOW; k++) { var j = (s + k + 366) % 366; a += sum[j]; n += cnt[j]; }
      out.push(n ? { mean: a / n, n: n } : null);
    }
    var years = {}; p.days.forEach(function (day) { if (day.tmax != null) years[day.y] = 1; });
    out.years = Object.keys(years).map(Number).sort();
    return out;
  }

  // ---------- the year ----------
  function compute(days, opts) {
    opts = opts || {};
    var year = opts.year || (days[0] && days[0].y);
    days = days.filter(function (d) { return d.y === year; });
    var S = { year: year, n: days.length };
    if (!days.length) return S;
    var first = days[0].date, last = days[days.length - 1].date;
    S.first = first; S.last = last;
    S.complete = isComplete(year, last);
    S.label = yearLabel(year, last);
    S.through = shortDate(last);
    S.span = shortDate(first) + ' \u2013 ' + shortDate(last);

    var withT = days.filter(function (d) { return d.tmax != null; });
    var withL = days.filter(function (d) { return d.tmin != null; });
    var withP = days.filter(function (d) { return d.prcp != null; });
    function maxBy(arr, k) { var b = null; arr.forEach(function (d) { if (b == null || d[k] > b[k]) b = d; }); return b; }
    function minBy(arr, k) { var b = null; arr.forEach(function (d) { if (b == null || d[k] < b[k]) b = d; }); return b; }

    var hot = maxBy(withT, 'tmax'), cold = minBy(withL, 'tmin');
    S.hottest = hot ? { date: hot.date, c: hot.tmax } : null;
    S.coldest = cold ? { date: cold.date, c: cold.tmin } : null;
    S.avgHigh = withT.length ? withT.reduce(function (a, d) { return a + d.tmax; }, 0) / withT.length : null;
    S.avgLow = withL.length ? withL.reduce(function (a, d) { return a + d.tmin; }, 0) / withL.length : null;

    // Thresholds are applied in Fahrenheit (with a tiny tolerance for float error), so 32.2 C (89.96 F) is
    // not a 90-degree day and a low of exactly 0 C (32 F) is not "below 32".
    S.hotDays = withT.filter(function (d) { return cToF(d.tmax) >= HOT_F - 1e-9; }).length;
    S.freezeDays = withL.filter(function (d) { return cToF(d.tmin) < FREEZE_F - 1e-9; }).length;
    S.tempDays = withT.length;

    S.precipMM = withP.reduce(function (a, d) { return a + d.prcp; }, 0);
    S.snowCM = days.reduce(function (a, d) { return a + (d.snow || 0); }, 0);
    S.wetDays = withP.filter(isWet).length;
    S.precipDays = withP.length;
    var wettest = maxBy(withP, 'prcp');
    S.wettest = wettest && wettest.prcp > 0 ? { date: wettest.date, mm: wettest.prcp } : null;
    var snowiest = maxBy(days.filter(function (d) { return d.snow != null; }), 'snow');
    S.snowiest = snowiest && snowiest.snow > 0 ? { date: snowiest.date, cm: snowiest.snow } : null;
    S.snowDays = days.filter(function (d) { return d.snow != null && d.snow >= 0.5; }).length;
    S.dry = longestRun(days, isDry);
    S.wet = longestRun(days, isWet);

    var windy = maxBy(days.filter(function (d) { return d.wind != null; }), 'wind');
    S.windiest = windy ? { date: windy.date, kmh: windy.wind } : null;

    // Months: sunshine hours, highs, precipitation. The sunniest month is the one with the most sunshine per
    // day, among months with at least 20 days of data (so a half-finished month can't win on a fluke).
    var months = [];
    for (var m = 1; m <= 12; m++) months.push({ mo: m, name: MONTHS_LONG[m - 1], short: MONTHS[m - 1], days: 0, sunDays: 0, sunH: 0, hiSum: 0, hiN: 0, prcp: 0, snow: 0 });
    days.forEach(function (d) {
      var M = months[d.mo - 1]; M.days++;
      if (d.sun != null) { M.sunDays++; M.sunH += d.sun / 3600; }
      if (d.tmax != null) { M.hiSum += d.tmax; M.hiN++; }
      if (d.prcp != null) M.prcp += d.prcp;
      if (d.snow != null) M.snow += d.snow;
    });
    months.forEach(function (M) { M.sunPerDay = M.sunDays ? M.sunH / M.sunDays : null; M.avgHigh = M.hiN ? M.hiSum / M.hiN : null; });
    S.months = months;
    var sunny = null;
    months.forEach(function (M) { if (M.sunDays >= 20 && (sunny == null || M.sunPerDay > sunny.sunPerDay)) sunny = M; });
    S.sunniest = sunny;
    S.sunHours = days.reduce(function (a, d) { return a + (d.sun || 0) / 3600; }, 0);

    // Daily series for charts.
    S.series = days.map(function (d) { return { date: d.date, slot: slot(d.date), tmax: d.tmax, tmin: d.tmin, prcp: d.prcp, snow: d.snow }; });

    if (opts.normals) addNormals(S, days, opts.normals);
    return S;
  }

  // The "weirdest day": biggest gap between the day's high and the normal high for that date.
  function addNormals(S, days, N) {
    var best = null, diffSum = 0, diffN = 0;
    days.forEach(function (d) {
      if (d.tmax == null) return;
      var n = N[slot(d.date)];
      if (!n || n.n < 30) return;
      var diff = d.tmax - n.mean;
      diffSum += diff; diffN++;
      if (best == null || Math.abs(diff) > Math.abs(best.diff)) best = { date: d.date, c: d.tmax, normal: n.mean, diff: diff };
    });
    if (best) {
      S.weird = best;
      S.normalYears = N.years && N.years.length ? N.years[0] + '\u2013' + N.years[N.years.length - 1] : '';
    }
    if (diffN >= 30) S.vsNormal = diffSum / diffN; // average high vs the 10-year normal, same dates
    S.normals = N;
  }

  var api = {
    VARS: VARS, MONTHS: MONTHS, MONTHS_LONG: MONTHS_LONG, WET_MM: WET_MM, HOT_F: HOT_F, FREEZE_F: FREEZE_F, NORMAL_WINDOW: NORMAL_WINDOW,
    parseISO: parseISO, iso: iso, epochDay: epochDay, addDays: addDays, slot: slot, isLeap: isLeap, shortDate: shortDate, longDate: longDate,
    defaultYear: defaultYear, range: range, normalsRange: normalsRange, yearLabel: yearLabel, isComplete: isComplete,
    cToF: cToF, dC2F: dC2F, mmToIn: mmToIn, cmToIn: cmToIn, kmhToMph: kmhToMph, num: num,
    fmt: { temp: temp, tempNum: tempNum, tempDelta: tempDelta, precip: precip, snow: snow, wind: wind, hotLabel: hotLabel, freezeLabel: freezeLabel },
    unitsFor: unitsFor, parse: parse, longestRun: longestRun, isDry: isDry, isWet: isWet, normals: normals, compute: compute
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WeatherStats = api;
})(typeof window !== 'undefined' ? window : this);
