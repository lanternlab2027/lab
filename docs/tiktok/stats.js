/* TikTok Wrapped: stats from parsed export data. Pure functions. */
(function (root) {
  'use strict';
  var P = (typeof module !== 'undefined' && module.exports) ? require('./parser.js') : root.TikTokParser;

  var AVG_SECONDS = 30;          // assumed average time per video, for the minutes estimate
  var SESSION_GAP_MS = 2 * 60000; // a doomscroll session continues while gaps stay under 2 minutes
  var NIGHT_FROM = 0, NIGHT_TO = 5; // "night owl" = local midnight to 4:59am

  function years(watch, tz) {
    var c = {};
    watch.forEach(function (t) { var y = P.localParts(t, tz).y; c[y] = (c[y] || 0) + 1; });
    return Object.keys(c).map(Number).sort(function (a, b) { return b - a; }).map(function (y) { return { year: y, count: c[y] }; });
  }

  function inYear(list, tz, year, get) {
    get = get || function (x) { return x; };
    return list.filter(function (x) { return year == null || P.localParts(get(x), tz).y === year; });
  }

  function normTerm(s) { return String(s || '').toLowerCase().replace(/[\u2018\u2019]/g, '\'').replace(/\s+/g, ' ').trim().replace(/^#\s*/, ''); }

  // opts: { year (number|null), tz, today (local day number, optional) }
  function compute(parsed, opts) {
    var tz = opts.tz || 'UTC', Y = opts.year == null ? null : opts.year;
    var s = { year: Y, tz: tz, avgSeconds: AVG_SECONDS };
    var w = inYear(parsed.watch, tz, Y);
    s.count = w.length;
    if (!s.count) return s;
    var L = w.map(function (t) { var p = P.localParts(t, tz); p.t = t; return p; });

    s.minutesEst = Math.round(s.count * AVG_SECONDS / 60);
    s.hoursEst = s.minutesEst / 60;

    // per day / month / weekday / hour
    var perDay = {}, months = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], wd = [0, 0, 0, 0, 0, 0, 0], hours = [];
    for (var h = 0; h < 24; h++) hours.push(0);
    var byYear = {};
    L.forEach(function (p) {
      (perDay[p.day] || (perDay[p.day] = [])).push(p);
      months[p.mo - 1]++; wd[p.wd]++; hours[p.h]++;
      byYear[p.y] = (byYear[p.y] || 0) + 1;
    });
    s.perDayCount = {}; Object.keys(perDay).forEach(function (d) { s.perDayCount[d] = perDay[d].length; });
    s.months = months; s.weekdays = wd; s.hours = hours; s.byYear = byYear;
    s.peakMonth = months.indexOf(Math.max.apply(null, months));
    s.peakHour = hours.indexOf(Math.max.apply(null, hours));
    s.peakWeekday = wd.indexOf(Math.max.apply(null, wd));
    var night = 0; for (var hh = NIGHT_FROM; hh < NIGHT_TO; hh++) night += hours[hh];
    s.nightCount = night; s.nightShare = night / s.count;
    var lateNight = L.filter(function (p) { return p.h >= NIGHT_FROM && p.h < NIGHT_TO; });
    s.latest = null; // the latest-in-the-night video (closest to 5am)
    lateNight.forEach(function (p) { var m = p.h * 60 + p.mi; if (!s.latest || m > s.latest.m) s.latest = { m: m, day: p.day, h: p.h, mi: p.mi }; });

    // busiest day
    var days = Object.keys(perDay).map(Number).sort(function (a, b) { return a - b; });
    var best = days[0];
    days.forEach(function (d) { if (perDay[d].length > perDay[best].length) best = d; });
    var bd = perDay[best];
    var bh = []; for (var b2 = 0; b2 < 24; b2++) bh.push(0); bd.forEach(function (p) { bh[p.h]++; });
    s.busiest = { day: best, count: bd.length, hourly: bh, first: bd[0], last: bd[bd.length - 1], minutesEst: Math.round(bd.length * AVG_SECONDS / 60), hours: hourSpread(bd) };
    s.watchDays = days.length;
    s.perWatchDay = s.count / s.watchDays;

    // streak of consecutive local days
    var run = 1, bestRun = { len: 1, start: days[0], end: days[0] };
    for (var i = 1; i < days.length; i++) {
      run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
      if (run > bestRun.len) bestRun = { len: run, start: days[i] - run + 1, end: days[i] };
    }
    s.streak = bestRun;
    var first = days[0], lastDay = days[days.length - 1];
    var spanEnd = lastDay;
    if (Y != null && opts.today != null) { var yearEnd = Math.floor(Date.UTC(Y, 11, 31) / 86400000); spanEnd = Math.max(lastDay, Math.min(opts.today, yearEnd)); }
    var spanStart = Y != null ? Math.min(first, Math.floor(Date.UTC(Y, 0, 1) / 86400000)) : first;
    s.spanDays = spanEnd - spanStart + 1;

    // doomscroll session: longest run of videos with every gap under 2 minutes
    var sess = null, cs = 0, gaps = [];
    for (var j = 1; j <= w.length; j++) {
      var gap = j < w.length ? w[j] - w[j - 1] : Infinity;
      if (gap < SESSION_GAP_MS) { gaps.push(gap); continue; }
      var dur = w[j - 1] - w[cs], n = j - cs;
      if (n >= 2 && (!sess || dur > sess.dur || (dur === sess.dur && n > sess.n))) sess = { start: w[cs], end: w[j - 1], dur: dur, n: n };
      cs = j;
    }
    if (sess) { sess.startP = P.localParts(sess.start, tz); sess.endP = P.localParts(sess.end, tz); sess.minutes = Math.round(sess.dur / 60000); }
    s.session = sess;
    gaps.sort(function (a, b) { return a - b; });
    s.medianGapSec = gaps.length ? Math.round(gaps[Math.floor(gaps.length / 2)] / 1000) : null;

    // likes, comments, shares, logins (counts only)
    var likes = inYear(parsed.likes, tz, Y);
    s.likes = likes.length; s.likeRate = s.likes / s.count; s.hasLikes = !!parsed.found.likes;
    s.comments = inYear(parsed.comments, tz, Y).length; s.hasComments = !!parsed.found.comments;
    s.shares = inYear(parsed.shares, tz, Y).length; s.hasShares = !!parsed.found.shares;
    s.logins = inYear(parsed.logins, tz, Y).length;
    var lm = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; likes.forEach(function (t) { lm[P.localParts(t, tz).mo - 1]++; });
    s.likeMonths = lm;

    // searches
    var se = inYear(parsed.searches, tz, Y, function (x) { return x.t; });
    s.searches = se.length; s.hasSearches = !!parsed.found.searches;
    var tc = {}, disp = {};
    se.forEach(function (x) { var k = normTerm(x.term); if (!k) return; tc[k] = (tc[k] || 0) + 1; if (!disp[k]) disp[k] = x.term.trim(); });
    s.topTerms = Object.keys(tc).sort(function (a, b) { return tc[b] - tc[a] || (a < b ? -1 : 1); }).slice(0, 5).map(function (k) { return { term: k, count: tc[k] }; });
    s.distinctTerms = Object.keys(tc).length;

    // previous year, for comparison
    if (Y != null) s.prevCount = inYear(parsed.watch, tz, Y - 1).length;
    s.firstDay = first; s.lastDay = lastDay;
    return s;
  }

  function hourSpread(list) { var h = {}; list.forEach(function (p) { h[p.h] = 1; }); return Object.keys(h).length; }

  var api = { compute: compute, years: years, normTerm: normTerm, AVG_SECONDS: AVG_SECONDS, SESSION_GAP_MS: SESSION_GAP_MS, NIGHT_FROM: NIGHT_FROM, NIGHT_TO: NIGHT_TO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TikTokStats = api;
})(typeof self !== 'undefined' ? self : this);
