/* Dating Wrapped: turns parsed sources (counts only) into the numbers the cards show.
 * compute(sources, { year: 2026 | null, app: 'all' | 'tinder' | 'hinge', today: dayNumber }) */
(function (root) {
  'use strict';

  var KEYS = ['opens', 'likes', 'passes', 'supers', 'matches', 'lmatch', 'sent', 'recv'];
  var DAY = 86400000;
  function ymd(day) { var d = new Date(day * DAY); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: (d.getUTCDay() + 6) % 7 }; }
  function dayOf(y, m, d) { return Math.round(Date.UTC(y, m, d) / DAY); }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function argmax(a) { var b = -1, bi = -1; for (var i = 0; i < a.length; i++) if (a[i] > b) { b = a[i]; bi = i; } return bi; }

  function rightLabel(rate) {
    if (rate == null) return null;
    if (rate < 0.12) return { name: 'Very picky', line: 'You know exactly what you\u2019re looking for.' };
    if (rate < 0.3) return { name: 'Picky', line: 'High standards, and no apologies.' };
    if (rate < 0.5) return { name: 'Selective', line: 'Open-minded, within reason.' };
    if (rate < 0.75) return { name: 'Generous', line: 'You see the best in people.' };
    if (rate < 0.93) return { name: 'Very generous', line: 'Love is a numbers game, and you came to play.' };
    return { name: 'Swiped right on everyone', line: 'Why choose when you can be open to everything?' };
  }

  function hourName(h) {
    if (h >= 22 || h < 2) return 'late-night';
    if (h < 5) return 'small-hours';
    if (h < 9) return 'early-morning';
    if (h < 12) return 'morning';
    if (h < 14) return 'lunch-break';
    if (h < 18) return 'afternoon';
    return 'evening';
  }

  function personality(s) {
    var c = [];
    function add(score, name, line, trait) { if (score > 0) c.push({ score: score, name: name, line: line, trait: trait }); }
    var hr = s.hours, rr = s.rightRate, mr = s.matchRate;
    if (hr && hr.total >= 20) add((hr.night - 0.3) * 4, 'The Night Shift', 'Your best swiping happens after the world goes quiet.', 'night owl');
    if (rr != null) {
      add((0.2 - rr) * 6, 'The Selective Romantic', 'Few right swipes, every one of them meant.', 'high standards');
      add((rr - 0.65) * 5, 'The Open Heart', 'You give everyone a fair shot.', 'big heart');
    }
    if (mr != null && s.likes >= 30) add((mr - 18) / 8, 'The Magnet', 'When you swipe right, it tends to swipe back.', 'magnetic');
    if (s.convo && s.convo.messagedShare != null && s.convo.matched >= 5) add((s.convo.messagedShare - 0.8) * 5, 'The Conversationalist', 'A match is just the start of the story for you.', 'great chat');
    if (s.ratio != null && s.sent + s.recv >= 40) add((s.ratio - 1.4) * 1.5, 'The Enthusiast', 'You bring the energy to every chat.', 'double-texter');
    if (s.streak && s.period.days >= 30) add((s.streak.len - 30) / 20, 'The Daily Devotee', 'Rain or shine, you checked in.', 'steady');
    if (s.busiest && s.busiest.ratio != null) add((s.busiest.ratio - 6) / 3, 'The Marathon Swiper', 'When the mood strikes, you go all in.', 'marathon sessions');
    if (s.weekendShare != null && s.swipes >= 50) add((s.weekendShare - 0.45) * 5, 'The Weekend Romantic', 'Saturdays are for swiping.', 'weekend energy');
    if (s.cuffing && s.peakMonth != null) add(0.5 + (s.peakShare - 0.12) * 4, 'The Cuffing-Season Strategist', 'You knew exactly when to turn up the heat.', 'seasonal timing');
    if (s.convo && s.convo.messagedShare != null && s.convo.matched >= 8) add((0.35 - s.convo.messagedShare) * 4, 'The Collector', 'Matching is the fun part. Chatting can wait.', 'match collector');
    c.sort(function (a, b) { return b.score - a.score; });
    if (!c.length) return { name: 'The Easygoing Dater', line: 'No rush, no pressure, just seeing what happens.', traits: [] };
    return { name: c[0].name, line: c[0].line, traits: c.slice(1, 3).filter(function (x) { return x.score > 0.15; }).map(function (x) { return x.trait; }) };
  }

  function compute(sources, opts) {
    opts = opts || {};
    var year = opts.year == null ? null : +opts.year;
    var app = opts.app || 'all';
    var src = sources.filter(function (s) { return app === 'all' || s.app === app; });
    var today = opts.today != null ? opts.today : Math.floor(Date.now() / DAY);
    var lo = -Infinity, hi = Infinity;
    if (year != null) { lo = dayOf(year, 0, 1); hi = dayOf(year, 11, 31); }
    function inR(d) { return d != null && d >= lo && d <= hi; }

    // Per-source totals, so a rate only uses sources that have BOTH sides of it.
    var tot = {}, has = {};
    KEYS.forEach(function (k) { tot[k] = 0; has[k] = false; });
    var perSrc = src.map(function (s) {
      var t = {}; KEYS.forEach(function (k) { t[k] = 0; });
      Object.keys(s.days).forEach(function (d) { if (!inR(+d)) return; var row = s.days[d]; for (var i = 0; i < KEYS.length; i++) t[KEYS[i]] += row[i]; });
      KEYS.forEach(function (k) { if (s.has[k]) { tot[k] += t[k]; has[k] = true; } });
      return { s: s, t: t };
    });
    function pair(a, b) { var x = 0, y = 0, ok = false; perSrc.forEach(function (p) { if (p.s.has[a] && p.s.has[b]) { x += p.t[a]; y += p.t[b]; ok = true; } }); return ok ? [x, y] : null; }

    // Activity per day (any metric > 0) and swipes per day.
    var act = {}, swipeDay = {};
    src.forEach(function (s) {
      Object.keys(s.days).forEach(function (d) {
        d = +d; if (!inR(d)) return;
        var r = s.days[d];
        if (r.some(function (v) { return v > 0; })) act[d] = 1;
        var sw = r[1] + r[2] + (s.app === 'tinder' ? r[3] : 0);
        if (sw) swipeDay[d] = (swipeDay[d] || 0) + sw;
      });
      s.convos.forEach(function (c) { if (inR(c[0])) act[c[0]] = 1; });
      s.hours.forEach(function (h) { if (inR(h[0])) act[h[0]] = 1; });
    });
    var actDays = Object.keys(act).map(Number).sort(function (a, b) { return a - b; });

    var st = { year: year, app: app, apps: src.map(function (s) { return s.app; }).filter(function (a, i, arr) { return arr.indexOf(a) === i; }), formats: src.map(function (s) { return s.format; }) };
    var first = actDays[0], last = actDays[actDays.length - 1];
    var pStart = year != null ? lo : first, pEnd = year != null ? Math.min(hi, Math.max(today, last || lo)) : last;
    st.period = { start: pStart, end: pEnd, days: actDays.length ? pEnd - pStart + 1 : 0 };
    st.activeDays = actDays.length;
    st.pctDays = st.period.days ? actDays.length / st.period.days : 0;
    st.has = has;
    KEYS.forEach(function (k) { st[k] = tot[k]; });

    // Swipes: right-swipe rate (likes + super likes) / (likes + super likes + passes).
    var rights = 0, lefts = 0, swOk = false;
    perSrc.forEach(function (p) { if (p.s.has.likes && p.s.has.passes) { rights += p.t.likes + (p.s.app === 'tinder' ? p.t.supers : 0); lefts += p.t.passes; swOk = true; } });
    st.rights = rights; st.lefts = lefts;
    st.swipes = sum(Object.keys(swipeDay).map(function (d) { return swipeDay[d]; }));
    st.rightRate = swOk && rights + lefts >= 1 ? rights / (rights + lefts) : null;
    st.rightLabel = rightLabel(st.rightRate);
    // Likes you sent (all sources, for "likes" wording when passes aren't known)
    st.likesAll = 0; perSrc.forEach(function (p) { if (p.s.has.likes) st.likesAll += p.t.likes + (p.s.app === 'tinder' ? p.t.supers : 0); });

    // Match rate: matches that followed your own like, per 100 likes.
    var mr = null, ml = 0, mm = 0;
    perSrc.forEach(function (p) { if (p.s.has.lmatch && p.s.has.likes) { ml += p.t.likes + (p.s.app === 'tinder' ? p.t.supers : 0); mm += p.t.lmatch; } });
    if (ml >= 1) mr = Math.min(100, (mm / ml) * 100);
    st.matchRate = mr; st.matchLikes = ml; st.matchFromLikes = mm;
    st.inboundShare = null;
    var hj = perSrc.filter(function (p) { return p.s.format === 'hinge-json'; });
    if (hj.length) { var a = 0, b = 0; hj.forEach(function (p) { a += p.t.matches - p.t.lmatch; b += p.t.matches; }); if (b >= 3) st.inboundShare = Math.max(0, a) / b; }

    // Months (or years for All time): swipes if known, else activity events.
    var useSw = st.swipes > 0;
    function weightOf(d) { return useSw ? (swipeDay[d] || 0) : 0; }
    var evDay = {};
    if (!useSw) src.forEach(function (s) { Object.keys(s.days).forEach(function (d) { if (inR(+d)) { var r = s.days[d]; evDay[d] = (evDay[d] || 0) + sum(r) - r[5]; } }); });
    var dayW = useSw ? swipeDay : evDay;
    st.monthsMetric = useSw ? 'swipes' : 'activity';
    st.swipeWord = has.passes ? 'swipes' : 'likes';
    if (year != null) {
      var mo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      Object.keys(dayW).forEach(function (d) { mo[ymd(+d).m] += dayW[d]; });
      st.months = mo;
      var pm = argmax(mo); st.peakMonth = mo[pm] > 0 ? pm : null;
      st.peakShare = st.peakMonth != null ? mo[pm] / (sum(mo) || 1) : 0;
      st.cuffing = st.peakMonth != null && [9, 10, 11, 0, 1].indexOf(st.peakMonth) >= 0;
    } else {
      var yrs = {};
      Object.keys(dayW).forEach(function (d) { var y = ymd(+d).y; yrs[y] = (yrs[y] || 0) + dayW[d]; });
      var ys = Object.keys(yrs).map(Number).sort();
      if (ys.length) { var all = []; for (var y = ys[0]; y <= ys[ys.length - 1]; y++) all.push(y); ys = all; }
      st.byYear = ys.map(function (y) { return { year: y, v: yrs[y] || 0 }; });
      st.months = null; st.peakMonth = null; st.cuffing = false; st.peakShare = 0;
    }

    // Weekdays + busiest day.
    var wd = [0, 0, 0, 0, 0, 0, 0];
    Object.keys(dayW).forEach(function (d) { wd[ymd(+d).wd] += dayW[d]; });
    st.weekdays = wd;
    st.peakWeekday = sum(wd) ? argmax(wd) : null;
    st.weekendShare = sum(wd) ? (wd[5] + wd[6]) / sum(wd) : null;
    var bd = null, bv = 0, n = 0, tsum = 0;
    Object.keys(dayW).forEach(function (d) { var v = dayW[d]; if (v > 0) { n++; tsum += v; } if (v > bv || (v === bv && bd != null && +d > bd)) { bv = v; bd = +d; } });
    st.busiest = bd != null && bv > 0 ? { day: bd, count: bv, avg: tsum / n, ratio: n > 1 ? bv / (tsum / n) : null, metric: st.monthsMetric } : null;
    if (st.busiest && useSw) {
      var r2 = 0, l2 = 0; perSrc.forEach(function (p) { if (p.s.has.passes && p.s.days[bd]) { var r = p.s.days[bd]; r2 += r[1] + (p.s.app === 'tinder' ? r[3] : 0); l2 += r[2]; } });
      st.busiest.rightRate = r2 + l2 ? r2 / (r2 + l2) : null;
    }

    // Hours: prefer swipe/like timestamps; fall back to message times.
    var hs = [new Array(24).fill(0), new Array(24).fill(0)];
    src.forEach(function (s) { s.hours.forEach(function (h) { if (inR(h[0])) hs[h[2]][h[1]]++; }); });
    var kind = sum(hs[0]) >= 20 ? 0 : sum(hs[1]) ? 1 : sum(hs[0]) ? 0 : -1;
    if (kind >= 0) {
      var arr = hs[kind], total = sum(arr), ph = argmax(arr);
      var night = 0; [22, 23, 0, 1, 2, 3, 4].forEach(function (h) { night += arr[h]; });
      st.hours = { counts: arr, total: total, peak: ph, kind: kind === 0 ? 'swipes' : 'messages', night: night / total, name: hourName(ph) };
    } else st.hours = null;

    // Longest streak of consecutive active days.
    var best = null, cur = null;
    actDays.forEach(function (d) {
      if (cur && d === cur.end + 1) cur.end = d; else cur = { start: d, end: d };
      var len = cur.end - cur.start + 1;
      if (!best || len > best.len) best = { start: cur.start, end: cur.end, len: len };
    });
    st.streak = best && best.len >= 2 ? best : null;

    // Messages: sent vs received.
    var sr = pair('sent', 'recv');
    st.ratio = sr && sr[1] > 0 ? sr[0] / sr[1] : null;
    st.ratioSent = sr ? sr[0] : 0; st.ratioRecv = sr ? sr[1] : 0;

    // Conversations (counts only).
    var cv = { count: 0, longest: 0, longestBoth: false, opened: 0, openKnown: 0, matched: 0, messagedShare: null, quietShare: null };
    var mt = 0, msg = 0, cvOk = false;
    perSrc.forEach(function (p) {
      var s = p.s;
      if (!s.has.convos) return;
      cvOk = true;
      s.convos.forEach(function (c) {
        if (!inR(c[0])) return;
        var size = c[1] + c[2];
        if (size > 0) cv.count++;
        if (size > cv.longest) { cv.longest = size; cv.longestBoth = s.has.recv && s.format === 'hinge-csv'; }
        if (s.has.opener && c[3]) { cv.openKnown++; if (c[3] === 1) cv.opened++; }
      });
      if (s.has.matches) {
        // Share of matches that got at least one message from you.
        var you = 0;
        if (s.format === 'tinder-json') s.convos.forEach(function (c) { if (inR(c[0]) && c[1] > 0) you++; });
        else s.convos.forEach(function (c) { if (inR(c[0]) && c[4] && c[1] > 0) you++; });
        mt += p.t.matches; msg += Math.min(you, p.t.matches);
      }
    });
    cv.matched = mt;
    if (mt >= 1) { cv.messagedShare = Math.min(1, msg / mt); cv.quietShare = 1 - cv.messagedShare; }
    cv.openerShare = cv.openKnown >= 3 ? cv.opened / cv.openKnown : null;
    st.convo = cvOk ? cv : null;

    st.activeSet = act;
    st.anything = actDays.length > 0;
    st.personality = personality(st);
    return st;
  }

  var api = { compute: compute, rightLabel: rightLabel, hourName: hourName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DatingStats = api;
})(typeof self !== 'undefined' ? self : this);
