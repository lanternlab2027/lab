/* Chicago Then: pure game logic (no DOM). UMD so Node tests can require it.
   Sister game to ../then/ (NYC Then); same rules, Chicago day boundary. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ThenGame = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TZ = 'America/Chicago';
  var EPOCH = '2026-11-15';      // puzzle #1 (Chicago calendar date)
  var MAX_TRIES = 5;
  var CLOSE = 3;                 // within this many years: yellow
  var WARM = 10;                 // within this many years: orange
  var AREAS = ['Loop', 'Near North', 'North Side', 'West Side', 'South Side', 'Lakefront'];
  var SHARE_URL = 'lanternlab2027.github.io/lab/chicago-then';

  var fmt = null;
  function localDate(d) {
    // Calendar date (YYYY-MM-DD) in Chicago for an instant.
    if (!fmt) fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    var parts = {};
    fmt.formatToParts(d).forEach(function (p) { parts[p.type] = p.value; });
    return parts.year + '-' + parts.month + '-' + parts.day;
  }

  function ymdToUtcDays(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) throw new Error('bad date ' + s);
    return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
  }

  function utcDaysToYmd(n) {
    return new Date(n * 86400000).toISOString().slice(0, 10);
  }

  // Puzzle number for a Chicago calendar date. #1 is EPOCH. Dates before EPOCH give 1.
  function puzzleNumberForDate(ymd) {
    return Math.max(1, ymdToUtcDays(ymd) - ymdToUtcDays(EPOCH) + 1);
  }

  function puzzleNumberAt(instant) { return puzzleNumberForDate(localDate(instant)); }

  function dateForPuzzle(n) { return utcDaysToYmd(ymdToUtcDays(EPOCH) + n - 1); }

  // Index into schedule.photos. The list is a fixed shuffle of every photo, so
  // any run of N consecutive days shows N different photos.
  function photoIndex(n, count) {
    return ((n - 1) % count + count) % count;
  }

  // Milliseconds until the next Chicago midnight (handles 23h/25h DST days).
  function msUntilNext(instant) {
    var today = localDate(instant);
    var t = instant.getTime();
    var lo = t, hi = t + 26 * 3600000;
    while (hi - lo > 1000) {
      var mid = Math.floor((lo + hi) / 2);
      if (localDate(new Date(mid)) === today) lo = mid; else hi = mid;
    }
    return hi - t;
  }

  // Feedback for one year guess.
  function hint(guess, answer) {
    var diff = guess - answer, ad = Math.abs(diff);
    var dir = diff === 0 ? 'correct' : (diff < 0 ? 'later' : 'earlier');
    var tier = ad === 0 ? 'hit' : ad <= CLOSE ? 'close' : ad <= WARM ? 'warm' : 'cold';
    var emoji = { hit: '\uD83D\uDFE9', close: '\uD83D\uDFE8', warm: '\uD83D\uDFE7', cold: '\u2B1B' }[tier];
    var text;
    if (tier === 'hit') text = 'Spot on!';
    else {
      var arrow = dir === 'later' ? 'Later \u2191' : 'Earlier \u2193';
      var how = tier === 'close' ? 'within ' + CLOSE + ' years' : tier === 'warm' ? 'within ' + WARM + ' years' : 'more than ' + WARM + ' years off';
      text = arrow + ' \u00B7 ' + how;
    }
    return { guess: guess, diff: diff, dir: dir, tier: tier, emoji: emoji, text: text };
  }

  // Narrow the allowed range after a set of guesses.
  function bounds(guesses, answer, min, max) {
    var lo = min, hi = max;
    guesses.forEach(function (g) {
      if (g < answer) lo = Math.max(lo, g + 1);
      else if (g > answer) hi = Math.min(hi, g - 1);
    });
    return { lo: lo, hi: hi };
  }

  function isOver(guesses, answer) {
    return guesses.indexOf(answer) !== -1 || guesses.length >= MAX_TRIES;
  }

  // ok: the list of accepted areas (a lakefront park can be both "Loop" and "Lakefront").
  function areaOk(guess, ok) {
    if (!guess || !ok) return false;
    return Array.isArray(ok) ? ok.indexOf(guess) !== -1 : guess === ok;
  }

  function shareText(n, guesses, answer, area, ok) {
    var won = guesses.indexOf(answer) !== -1;
    var squares = guesses.map(function (g) { return hint(g, answer).emoji; }).join('');
    var b = '';
    if (area) b = ' \uD83D\uDCCD' + (areaOk(area, ok) ? '\u2705' : '\u274C');
    return 'Chicago Then #' + n + ' ' + squares + ' ' + (won ? guesses.length : 'X') + '/' + MAX_TRIES + b + '\n' + SHARE_URL;
  }

  // Stats from the saved per-day records. Only days played on their own date
  // ("live") count toward streaks; archive plays count toward played/won.
  function stats(days, todayN) {
    var played = 0, won = 0, dist = [0, 0, 0, 0, 0], cur = 0, best = 0, run = 0;
    var nums = Object.keys(days).map(Number).sort(function (a, b) { return a - b; });
    nums.forEach(function (n) {
      var d = days[n];
      if (!d || !d.done) return;
      played++;
      if (d.won) { won++; dist[Math.min(d.guesses.length, MAX_TRIES) - 1]++; }
    });
    var liveWon = {};
    nums.forEach(function (n) { var d = days[n]; if (d && d.done && d.live) liveWon[n] = !!d.won; });
    for (var n = 1; n <= todayN; n++) {
      if (liveWon[n] === true) { run++; best = Math.max(best, run); }
      else if (liveWon[n] === false) run = 0;
      else if (n < todayN) run = 0; // a missed past day breaks the streak; today may still be unplayed
    }
    cur = run;
    return { played: played, won: won, winPct: played ? Math.round(100 * won / played) : 0, current: cur, best: best, dist: dist };
  }

  return {
    TZ: TZ, EPOCH: EPOCH, MAX_TRIES: MAX_TRIES, AREAS: AREAS, SHARE_URL: SHARE_URL, CLOSE: CLOSE, WARM: WARM,
    localDate: localDate, puzzleNumberForDate: puzzleNumberForDate, puzzleNumberAt: puzzleNumberAt,
    dateForPuzzle: dateForPuzzle, photoIndex: photoIndex, msUntilNext: msUntilNext,
    hint: hint, bounds: bounds, areaOk: areaOk, isOver: isOver, shareText: shareText, stats: stats
  };
});
