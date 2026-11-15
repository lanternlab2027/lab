/* Streaming Wrapped: year stats from parsed viewing history. Pure functions. */
(function (root) {
  'use strict';

  function weekdayMon0(day) { return (new Date(day * 86400000).getUTCDay() + 6) % 7; } // 0 = Monday
  function ym(d) { return d.y * 12 + d.mo - 1; }
  function chrono(a, b) { return a.day - b.day || b.idx - a.idx; } // file is newest-first, so a higher idx is earlier

  function years(entries) {
    var c = {};
    entries.forEach(function (e) { c[e.date.y] = (c[e.date.y] || 0) + 1; });
    return Object.keys(c).map(Number).sort(function (a, b) { return b - a; }).map(function (y) { return { year: y, count: c[y] }; });
  }

  var PERSONAS = {
    binge: { name: 'The Binge Machine', trait: 'binge-watching', line: 'When you start a show, you finish a show. \u201cOne more episode\u201d is a way of life.' },
    loyal: { name: 'The Loyalist', trait: 'loyalty', line: 'You found your show and you stayed. Other series never stood a chance.' },
    film: { name: 'The Film Buff', trait: 'film nerd', line: 'Opening credits, closing credits, the whole thing. You came for the movies.' },
    hopper: { name: 'The Channel Hopper', trait: 'pilot tasting', line: 'You\u2019ll try anything once. Pilot episodes are your tasting menu.' },
    weekend: { name: 'The Weekend Warrior', trait: 'weekend marathons', line: 'Weekdays are for living. Saturdays and Sundays are for the couch.' },
    comfort: { name: 'The Comfort Rewatcher', trait: 'comfort viewing', line: 'New shows are nice, but you know exactly what you like. Home is a show you\u2019ve seen before.' },
    ritual: { name: 'The Daily Ritualist', trait: 'daily ritual', line: 'Not a binger, a regular. A little something on screen, almost every night.' },
    season: { name: 'The Seasonal Hibernator', trait: 'hibernation', line: 'You disappear into the couch for a few months, then vanish back into real life.' },
    casual: { name: 'The Easygoing Viewer', trait: '', line: 'No marathons, no obsessions. You watch what you like, when you feel like it.' }
  };

  function personality(s) {
    var sc = {};
    if (s.count >= 6) {
      if (s.binge) sc.binge = s.binge.count / 6 + (s.perWatchDay >= 3 ? 0.4 : 0);
      if (s.topShow) sc.loyal = (s.topShow.episodes / s.count) / 0.3;
      sc.film = (s.movies / s.count) / 0.45;
      if (s.showCount >= 8) sc.hopper = (s.triedOnce / s.showCount) / 0.45 * Math.min(1, s.showCount / 12);
      sc.weekend = s.weekendShare / 0.5;
      if (s.comfort) sc.comfort = s.comfort.months / 6 + s.comfort.priorYears * 0.35;
      if (s.streak) sc.ritual = Math.max(s.streak.len / 14, s.watchDays / (s.spanDays * 0.6));
      if (s.year) { var m = s.months.slice().sort(function (a, b) { return b - a; }); sc.season = (m[0] + m[1] + m[2]) / s.count / 0.6; }
    }
    var ranked = Object.keys(sc).map(function (k) { return [k, sc[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var top = ranked[0] && ranked[0][1] >= 1 ? ranked[0][0] : 'casual';
    var traits = ranked.filter(function (r) { return r[0] !== top && r[1] >= 1; }).slice(0, 2).map(function (r) { return PERSONAS[r[0]].trait; });
    var p = PERSONAS[top];
    return { id: top, name: p.name, line: p.line, traits: traits, scores: sc };
  }

  // opts: { year: number|null (null = all time), profile: string|'' }
  function compute(all, opts) {
    opts = opts || {};
    var Y = opts.year == null ? null : opts.year;
    if (opts.profile) all = all.filter(function (e) { return e.profile === opts.profile; });
    var list = all.filter(function (e) { return Y == null || e.date.y === Y; }).slice().sort(chrono);
    var s = { year: Y, count: list.length, list: list };
    if (!list.length) return s;

    s.prevCount = Y == null ? null : all.filter(function (e) { return e.date.y === Y - 1; }).length;
    s.episodes = list.filter(function (e) { return e.kind === 'series'; }).length;
    s.movies = s.count - s.episodes;
    s.hoursEst = Math.round((s.episodes * 45 + s.movies * 110) / 60);

    // shows
    var shows = {};
    list.forEach(function (e) {
      if (e.kind !== 'series') return;
      var sh = shows[e.show] || (shows[e.show] = { name: e.show, episodes: 0, seasons: {}, months: {}, days: {}, first: e, last: e, titles: {} });
      sh.episodes++; sh.last = e;
      if (e.season) sh.seasons[e.season] = 1;
      sh.months[ym(e.date)] = 1; sh.days[e.day] = 1;
      sh.titles[e.title] = (sh.titles[e.title] || 0) + 1;
    });
    var showList = Object.keys(shows).map(function (k) {
      var x = shows[k];
      return { name: x.name, episodes: x.episodes, seasons: Object.keys(x.seasons), months: Object.keys(x.months).length, monthKeys: Object.keys(x.months).map(Number), days: Object.keys(x.days).length, first: x.first, last: x.last, rewatches: Object.keys(x.titles).reduce(function (a, t) { return a + x.titles[t] - 1; }, 0) };
    }).sort(function (a, b) { return b.episodes - a.episodes || b.last.day - a.last.day; });
    s.shows = showList;
    s.showCount = showList.length;
    s.topShow = showList[0] && showList[0].episodes >= 2 ? showList[0] : null;
    s.triedOnce = showList.filter(function (x) { return x.episodes === 1; }).length;
    s.movieList = list.filter(function (e) { return e.kind === 'movie'; });

    // days
    var perDay = {};
    list.forEach(function (e) { (perDay[e.day] = perDay[e.day] || []).push(e); });
    var days = Object.keys(perDay).map(Number).sort(function (a, b) { return a - b; });
    s.perDay = perDay;
    s.watchDays = days.length;
    s.perWatchDay = s.count / days.length;
    var bd = days.reduce(function (best, d) { return perDay[d].length > perDay[best].length ? d : best; }, days[0]);
    if (perDay[bd].length >= 2) {
      var es = perDay[bd], byShow = {};
      es.forEach(function (e) { byShow[e.show] = (byShow[e.show] || 0) + 1; });
      var dom = Object.keys(byShow).sort(function (a, b) { return byShow[b] - byShow[a]; })[0];
      s.binge = { day: bd, date: es[0].date, count: es.length, entries: es, show: dom, showCount: byShow[dom], distinct: Object.keys(byShow).length };
    } else s.binge = null;

    // streak
    var best = { len: 1, start: days[0], end: days[0] }, cur = { len: 1, start: days[0] };
    for (var i = 1; i < days.length; i++) {
      if (days[i] === days[i - 1] + 1) cur.len++; else cur = { len: 1, start: days[i] };
      if (cur.len > best.len) best = { len: cur.len, start: cur.start, end: days[i] };
    }
    s.streak = best.len >= 2 ? best : null;
    var startDay = Y == null ? days[0] : Math.round(Date.UTC(Y, 0, 1) / 86400000);
    var endDay = Y == null ? days[days.length - 1] : Math.min(Math.round(Date.UTC(Y, 11, 31) / 86400000), Math.max(days[days.length - 1], opts.today || 0));
    s.spanDays = Math.max(1, endDay - startDay + 1);
    s.startDay = startDay;

    // when
    s.months = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    s.weekdays = [0, 0, 0, 0, 0, 0, 0];
    list.forEach(function (e) { s.months[e.date.mo - 1]++; s.weekdays[weekdayMon0(e.day)]++; });
    s.peakMonth = s.months.indexOf(Math.max.apply(null, s.months));
    s.peakWeekday = s.weekdays.indexOf(Math.max.apply(null, s.weekdays));
    s.weekendShare = (s.weekdays[5] + s.weekdays[6]) / s.count;
    if (Y == null) {
      s.byYear = {};
      list.forEach(function (e) { s.byYear[e.date.y] = (s.byYear[e.date.y] || 0) + 1; });
    }

    // comfort: the title you kept returning to, across months (and earlier years)
    var before = {};
    all.forEach(function (e) { if (Y != null && e.date.y < Y) (before[e.show] = before[e.show] || {})[e.date.y] = 1; });
    var cands = showList.map(function (x) { return { name: x.name, kind: 'series', months: x.months, monthKeys: x.monthKeys, count: x.episodes, rewatches: x.rewatches }; });
    var mv = {};
    s.movieList.forEach(function (e) { var m = mv[e.show] || (mv[e.show] = { name: e.show, kind: 'movie', months: 0, monthKeys: [], count: 0, rewatches: 0 }); m.count++; if (m.monthKeys.indexOf(ym(e.date)) < 0) m.monthKeys.push(ym(e.date)); m.months = m.monthKeys.length; });
    Object.keys(mv).forEach(function (k) { mv[k].rewatches = mv[k].count - 1; cands.push(mv[k]); });
    cands.forEach(function (c) { c.priorYears = before[c.name] ? Object.keys(before[c.name]).length : 0; c.score = c.months + c.priorYears * 1.5 + c.rewatches * 0.5; });
    cands.sort(function (a, b) { return b.score - a.score || b.count - a.count; });
    var cf = cands.filter(function (c) { return c.months >= 3 || (c.months >= 2 && (c.priorYears >= 1 || c.rewatches >= 1)); });
    if (cf.length > 1 && s.topShow && cf[0].name === s.topShow.name && cf[1].score >= cf[0].score - 1) cf.push(cf.shift()); // vary the deck when it's close
    s.comfort = cf[0] || null;

    s.first = list[0];
    s.last = list[list.length - 1];
    s.personality = personality(s);
    return s;
  }

  var api = { compute: compute, years: years, personality: personality, PERSONAS: PERSONAS, weekdayMon0: weekdayMon0 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NetflixStats = api;
})(typeof self !== 'undefined' ? self : this);
