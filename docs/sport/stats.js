/* Year in Motion: numbers for one year. Pure functions; everything in SI (meters, seconds).
 * Activities carry .t = wall-clock ms (local time encoded as UTC; read with getUTC*).
 */
(function (root) {
  'use strict';
  var DAY = 864e5;

  var SPORT_LABEL = { run: 'Run', ride: 'Ride', walk: 'Walk', hike: 'Hike', swim: 'Swim', strength: 'Strength', yoga: 'Yoga & mobility', row: 'Row', ski: 'Snow', paddle: 'Paddle', climb: 'Climb', other: 'Other' };
  var SPORT_NOUN = { run: 'runs', ride: 'rides', walk: 'walks', hike: 'hikes', swim: 'swims', strength: 'strength sessions', yoga: 'yoga sessions', row: 'rows', ski: 'days on snow', paddle: 'paddles', climb: 'climbs', other: 'workouts' };

  function dur(a) { return a.moving || a.elapsed || 0; }
  function yearOf(t) { return new Date(t).getUTCFullYear(); }

  function years(acts) {
    var m = {};
    acts.forEach(function (a) { if (a.t != null) { var y = yearOf(a.t); m[y] = (m[y] || 0) + 1; } });
    return Object.keys(m).map(function (y) { return { year: +y, count: m[y] }; }).sort(function (a, b) { return b.year - a.year; });
  }

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

  // Plausibility limits so a GPS glitch or a mislabeled activity can't become a "PR".
  var RUN_BUCKETS = [['5K', 5000, 4900, 5600], ['10K', 10000, 9800, 11000], ['Half marathon', 21097.5, 21000, 22300], ['Marathon', 42195, 42000, 43800]];
  function prs(list) {
    var runs = list.filter(function (a) { return a.sport === 'run' && a.dist && dur(a) && !/treadmill|virtual/i.test(a.type); });
    var out = [];
    RUN_BUCKETS.forEach(function (b) {
      var c = runs.filter(function (a) {
        if (a.dist < b[2] || a.dist > b[3]) return false;
        var pace = dur(a) / (a.dist / 1000);
        return pace >= 150 && pace <= 900; // 2:30 to 15:00 per km
      });
      if (!c.length) return;
      c.sort(function (x, y) { return dur(x) / x.dist - dur(y) / y.dist; });
      var best = c[0];
      out.push({ kind: 'run', label: b[0], act: best, n: c.length, pace: dur(best) / (best.dist / 1000), est: dur(best) / best.dist * b[1] });
    });
    var rides = list.filter(function (a) { return a.sport === 'ride' && a.dist >= 20000 && dur(a) && !/virtual|indoor|e-?bike/i.test(a.type); })
      .filter(function (a) { var v = a.dist / dur(a) * 3.6; return v >= 8 && v <= 55; });
    if (rides.length >= 3) {
      rides.sort(function (x, y) { return y.dist / dur(y) - x.dist / dur(x); });
      out.push({ kind: 'ride', label: 'Fastest ride (20 km+)', act: rides[0], n: rides.length, speed: rides[0].dist / dur(rides[0]) });
    }
    return out;
  }

  function compute(acts, opts) {
    opts = opts || {};
    var Y = opts.year, tracks = opts.tracks || [];
    var jan1 = Date.UTC(Y, 0, 1), nDays = isLeap(Y) ? 366 : 365;
    var list = acts.filter(function (a) { return a.t != null && yearOf(a.t) === Y; }).sort(function (a, b) { return a.t - b.t; });
    var s = { year: Y, list: list, count: list.length, nDays: nDays, jan1Dow: (new Date(jan1).getUTCDay() + 6) % 7 };
    if (!list.length) return s;

    s.time = 0; s.dist = 0; s.elev = 0; s.distKnown = 0; s.elevKnown = 0;
    s.dayMin = new Array(nDays).fill(0);
    s.months = []; for (var m = 0; m < 12; m++) s.months.push({ count: 0, time: 0, dist: 0 });
    s.hours = new Array(24).fill(0); s.weekday = new Array(7).fill(0); s.weekdayTime = new Array(7).fill(0);
    var sports = {}, commute = 0;
    list.forEach(function (a) {
      var d = new Date(a.t), di = Math.floor((a.t - jan1) / DAY), t = dur(a);
      s.time += t;
      if (a.dist) { s.dist += a.dist; s.distKnown++; }
      if (a.elev) { s.elev += a.elev; s.elevKnown++; }
      if (di >= 0 && di < nDays) s.dayMin[di] += t / 60;
      var mo = s.months[d.getUTCMonth()]; mo.count++; mo.time += t; mo.dist += a.dist || 0;
      s.hours[d.getUTCHours()]++;
      var wd = (d.getUTCDay() + 6) % 7; s.weekday[wd]++; s.weekdayTime[wd] += t;
      var sp = sports[a.sport] || (sports[a.sport] = { key: a.sport, label: SPORT_LABEL[a.sport] || 'Other', noun: SPORT_NOUN[a.sport] || 'workouts', count: 0, time: 0, dist: 0, elev: 0 });
      sp.count++; sp.time += t; sp.dist += a.dist || 0; sp.elev += a.elev || 0;
      if (a.commute) commute++;
    });
    s.sports = Object.keys(sports).map(function (k) { return sports[k]; }).sort(function (a, b) { return b.time - a.time || b.count - a.count; });
    s.activeDays = s.dayMin.filter(function (v) { return v > 0; }).length;

    // months
    var pk = 0; s.months.forEach(function (mo, i) { if (mo.time > s.months[pk].time || (mo.time === s.months[pk].time && mo.count > s.months[pk].count)) pk = i; });
    s.peakMonth = pk;

    // biggest efforts
    s.longest = list.slice().sort(function (a, b) { return dur(b) - dur(a); })[0];
    var withDist = list.filter(function (a) { return a.dist; });
    s.furthest = withDist.length ? withDist.slice().sort(function (a, b) { return b.dist - a.dist; })[0] : null;
    var withElev = list.filter(function (a) { return a.elev; });
    s.highest = withElev.length ? withElev.slice().sort(function (a, b) { return b.elev - a.elev; })[0] : null;

    // streaks (days and Monday-based weeks), limited to "today" when the year isn't over
    var lastDay = nDays - 1;
    if (opts.now != null && yearOf(opts.now) === Y) lastDay = Math.floor((opts.now - jan1) / DAY);
    var best = { len: 0, start: 0 }, cur = 0;
    for (var i = 0; i < nDays; i++) {
      if (s.dayMin[i] > 0) { cur++; if (cur > best.len) best = { len: cur, start: i - cur + 1 }; } else cur = 0;
    }
    s.streakDays = best;
    var nWeeks = Math.floor((nDays - 1 + s.jan1Dow) / 7) + 1, weeks = new Array(nWeeks).fill(0);
    for (i = 0; i < nDays; i++) if (s.dayMin[i] > 0) weeks[Math.floor((i + s.jan1Dow) / 7)] += s.dayMin[i];
    var wb = { len: 0, start: 0 }; cur = 0;
    weeks.forEach(function (v, w) { if (v > 0) { cur++; if (cur > wb.len) wb = { len: cur, start: w - cur + 1 }; } else cur = 0; });
    s.streakWeeks = wb;
    s.weeks = weeks;
    s.monthsDone = opts.now != null && yearOf(opts.now) === Y ? new Date(opts.now).getUTCMonth() : 12;
    s.weeksElapsed = Math.max(1, Math.min(nWeeks, Math.floor((lastDay + s.jan1Dow) / 7) + 1));
    s.weeksActive = weeks.slice(0, s.weeksElapsed).filter(function (v) { return v > 0; }).length;

    // time of day
    var B = [['dawn', 4, 7], ['morning', 7, 11], ['lunch', 11, 14], ['afternoon', 14, 17], ['evening', 17, 21], ['night', 21, 28]];
    s.tod = B.map(function (b) {
      var n = 0; for (var h = b[1]; h < b[2]; h++) n += s.hours[h % 24];
      return { key: b[0], n: n, share: n / s.count };
    });
    var topTod = s.tod.slice().sort(function (a, b) { return b.n - a.n; })[0];
    s.todTop = topTod;
    var TOD_NAMES = { dawn: ['Dawn Patrol', 'Out the door before the city wakes up.'], morning: ['Morning Mover', 'Your day starts with a workout.'],
      lunch: ['Lunch-Break Legend', 'Who needs a sandwich when you have a lunch hour?'], afternoon: ['Afternoon Grinder', 'Prime time for you is mid-afternoon.'],
      evening: ['After-Work Warrior', 'Clock out, lace up.'], night: ['Night Owl', 'Your best work happens after dark.'] };
    s.todName = TOD_NAMES[topTod.key][0]; s.todLine = TOD_NAMES[topTod.key][1];
    s.peakHour = s.hours.indexOf(Math.max.apply(null, s.hours));
    s.weekendShare = (s.weekdayTime[5] + s.weekdayTime[6]) / (s.time || 1);

    s.prs = prs(list);

    // previous year
    var prev = acts.filter(function (a) { return a.t != null && yearOf(a.t) === Y - 1; });
    if (prev.length) s.prev = { count: prev.length, time: prev.reduce(function (x, a) { return x + dur(a); }, 0), dist: prev.reduce(function (x, a) { return x + (a.dist || 0); }, 0) };

    // tracks for the route art (already filtered by year by the caller or here)
    s.tracks = tracks.filter(function (tr) { return tr.t != null && yearOf(tr.t) === Y && tr.line && tr.line.length >= 2; });
    var cells = {};
    s.tracks.forEach(function (tr) { if (tr.start) cells[Math.round(tr.start[0] * 100) + ':' + Math.round(tr.start[1] * 100)] = 1; });
    s.uniqueStarts = Object.keys(cells).length;

    s.commuteShare = commute / s.count;
    s.avgDur = s.time / s.count;
    s.personality = personality(s);
    return s;
  }

  var SPECIALIST = { run: ['The Pure Runner', 'One sport, all year. Your shoes know the way.'], ride: ['The Saddle Devotee', 'Two wheels, one obsession.'],
    swim: ['The Fish', 'Happiest with your face in the water.'], walk: ['The Wanderer', 'Step by step, you covered a lot of ground.'],
    hike: ['The Trail Hound', 'If there\u2019s a trail, you\u2019re on it.'], strength: ['The Iron Regular', 'The gym knows your name.'] };

  function personality(s) {
    var top = s.sports[0], topShare = top.time / (s.time || 1);
    var mix = s.sports.filter(function (x) { return x.time / (s.time || 1) >= 0.1; }).length;
    var gym = s.sports.filter(function (x) { return x.key === 'strength' || x.key === 'yoga'; }).reduce(function (a, x) { return a + x.time; }, 0) / (s.time || 1);
    var km = s.dist / 1000;
    var cands = [
      ['The Streak Machine', 'You simply do not skip days.', 'streaks', s.streakDays.len / 21],
      ['The Metronome', 'Week in, week out. Consistency is your superpower.', 'consistency', s.count >= 30 ? (s.weeksActive / s.weeksElapsed) / 0.9 : 0],
      ['The Weekend Warrior', 'Saturdays and Sundays are for the big stuff.', 'weekend epics', s.count >= 8 ? s.weekendShare / 0.5 : 0],
      ['Dawn Patrol', 'First light belongs to you.', 'early starts', s.tod[0].share / 0.35],
      ['The Night Owl', 'Your best sessions happen after dark.', 'late sessions', s.tod[5].share / 0.3],
      ['The Mountain Goat', 'Flat is boring. You go up.', 'big climbs', km > 50 ? (s.elev / km) / 18 : 0],
      ['The Endurance Engine', 'Long and steady wins your heart.', 'long hauls', s.avgDur / 5400],
      ['The Multisport Machine', 'Why pick one sport when you can do them all?', 'variety', mix / 3],
      ['The Explorer', 'New starts, new routes, new places.', 'exploring', s.tracks.length >= 10 ? s.uniqueStarts / 20 : 0],
      ['The Commuter', 'Your workouts actually take you somewhere.', 'commuting', s.commuteShare / 0.3],
      ['The Gym Regular', 'Reps, sets and the occasional sweaty selfie.', 'gym time', gym / 0.5]
    ];
    if (topShare >= 0.85 && SPECIALIST[top.key]) cands.push([SPECIALIST[top.key][0], SPECIALIST[top.key][1], 'focus', topShare / 0.85 - 0.01]);
    cands.sort(function (a, b) { return b[3] - a[3]; });
    var win = cands[0][3] >= 1 ? cands[0] : ['The All-Rounder', 'A bit of everything, all year long.', 'balance', 0];
    var traits = cands.filter(function (c) { return c !== win && c[3] >= 0.8; }).slice(0, 2).map(function (c) { return c[2]; });
    return { name: win[0], line: win[1], traits: traits, scores: cands.map(function (c) { return [c[0], Math.round(c[3] * 100) / 100]; }) };
  }

  // Privacy: drop every point within `m` meters (straight line) of the track's start or finish, anywhere along
  // the route, like a privacy zone around home. Returns a list of segments (each >= 2 points), possibly empty.
  function trimLine(line, m) {
    if (!line || line.length < 2) return [];
    if (!m) return [line];
    var a = line[0], b = line[line.length - 1], segs = [], cur = [];
    var p = Math.PI / 180;
    function far(q, z) {
      var dla = (q[0] - z[0]) * p, dlo = (q[1] - z[1]) * p;
      var h = Math.sin(dla / 2) * Math.sin(dla / 2) + Math.cos(q[0] * p) * Math.cos(z[0] * p) * Math.sin(dlo / 2) * Math.sin(dlo / 2);
      return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h))) > m;
    }
    line.forEach(function (q) {
      if (far(q, a) && far(q, b)) cur.push(q);
      else { if (cur.length >= 2) segs.push(cur); cur = []; }
    });
    if (cur.length >= 2) segs.push(cur);
    return segs;
  }

  var api = { compute: compute, years: years, dur: dur, trimLine: trimLine, SPORT_LABEL: SPORT_LABEL, SPORT_NOUN: SPORT_NOUN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SportStats = api;
})(typeof self !== 'undefined' ? self : this);
