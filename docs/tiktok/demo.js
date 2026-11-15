/* TikTok Wrapped: deterministic, invented export for the sample deck and the test fixtures.
 * Produces an object in the 2024+ "user_data_tiktok.json" layout. Every link, search term and number is made up. */
(function (root) {
  'use strict';

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()); }

  var TERMS = ['sourdough starter', 'air fryer salmon', 'lofi study playlist', 'how to fold a fitted sheet', 'marathon training plan', 'cat hiding spots',
    'budget trip lisbon', 'easy pasta dinner', 'desk setup ideas', 'beginner crochet', 'houseplant care', 'thrift flip', 'study with me', 'capsule wardrobe',
    'morning routine', 'sea shanty duet', 'mini golf trick shot', 'pickleball serve'];
  var TERM_W = [26, 19, 15, 11, 9, 8, 6, 6, 5, 4, 4, 3, 3, 2, 2, 2, 1, 1];

  // opts: { year, endMonth (1-12), endDay, seed, utcOffsetHours (local = UTC + offset), prevYear (bool), dmCanary (string) }
  function build(opts) {
    opts = opts || {};
    var Y = opts.year || 2026, r = rng(opts.seed || 20261115), off = opts.utcOffsetHours == null ? -5 : opts.utcOffsetHours;
    var end = Date.UTC(Y, (opts.endMonth || 11) - 1, opts.endDay || 14, 23, 59);
    var start = opts.prevYear === false ? Date.UTC(Y, 0, 1) : Date.UTC(Y - 1, 8, 1);
    var watch = [], likes = [], shares = [], comments = [], searches = [], logins = [];
    function link() { var id = '73'; for (var q = 0; q < 17; q++) id += Math.floor(r() * 10); return 'https://www.tiktokv.com/share/video/' + id + '/'; }
    function term() { var tot = TERM_W.reduce(function (a, b) { return a + b; }, 0), x = r() * tot; for (var i = 0; i < TERMS.length; i++) { x -= TERM_W[i]; if (x < 0) return TERMS[i]; } return TERMS[0]; }
    // month mood: summer and December are heavier
    var MOOD = [1.0, 0.9, 0.85, 0.8, 0.9, 1.05, 1.25, 1.35, 0.95, 0.9, 1.0, 1.15];
    var bigDay = Math.floor(Date.UTC(Y, 6, 19) / 86400000); // a Saturday in July
    var dropDays = {}; // a few offline days so the streak is not the whole year
    [Date.UTC(Y, 2, 14), Date.UTC(Y, 2, 15), Date.UTC(Y, 5, 2), Date.UTC(Y, 8, 21), Date.UTC(Y, 9, 30)].forEach(function (t) { dropDays[Math.floor(t / 86400000)] = 1; });
    for (var day = Math.floor(start / 86400000); day * 86400000 <= end; day++) {
      var d = new Date(day * 86400000), mo = d.getUTCMonth(), dow = d.getUTCDay();
      var inY = d.getUTCFullYear() === Y;
      if (dropDays[day] || (!inY && r() < 0.18) || (inY && r() < 0.04)) continue;
      var nSess = 1 + Math.floor(r() * 3) + (dow === 0 || dow === 6 ? 1 : 0);
      if (day === bigDay) nSess = 5;
      for (var k = 0; k < nSess; k++) {
        var hr = r() < 0.11 ? Math.floor(r() * 3) : r() < 0.5 ? 19 + Math.floor(r() * 5) : 7 + Math.floor(r() * 12);
        if (day === bigDay && k === 0) hr = 13;
        var t = (day * 86400 + hr * 3600 + Math.floor(r() * 3600)) * 1000;
        var n = Math.max(3, Math.round((8 + r() * 40) * MOOD[mo] * (inY ? 1 : 0.8)));
        if (day === bigDay && k === 0) n = 260;
        for (var v = 0; v < n; v++) {
          var gap = r() < 0.06 ? 60 + r() * 50 : 4 + r() * 30;
          t += Math.round(gap * 1000);
          var utc = t - off * 3600000; // local -> UTC
          if (utc > end - off * 3600000) break;
          var l = link();
          watch.push({ Date: stamp(utc), Link: l });
          if (r() < 0.085) likes.push({ date: stamp(utc + 4000), link: l });
          if (r() < 0.006) shares.push({ Date: stamp(utc + 7000), SharedContent: 'video', Link: l, Method: r() < 0.5 ? 'chat_merge' : 'copy' });
          if (r() < 0.0025) comments.push({ date: stamp(utc + 9000), comment: 'so good', photo: 'N/A', url: '' });
        }
        if (r() < 0.22) searches.push({ Date: stamp(t - off * 3600000 - 30000), SearchTerm: term() });
        if (r() < 0.03) logins.push({ Date: stamp(t - off * 3600000 - 60000), IP: '192.0.2.' + (1 + Math.floor(r() * 250)), DeviceModel: 'Phone', DeviceSystem: 'OS', NetworkType: 'Wi-Fi', Carrier: '' });
      }
    }
    var desc = function (a, b) { return a.Date < b.Date ? 1 : a.Date > b.Date ? -1 : 0; };
    var descL = function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; };
    watch.sort(desc); shares.sort(desc); searches.sort(desc); logins.sort(desc); likes.sort(descL); comments.sort(descL);
    var out = {
      'Comment': { 'Comments': { 'CommentsList': comments } },
      'Likes and Favorites': {
        'Favorite Videos': { 'FavoriteVideoList': likes.slice(0, 12).map(function (x) { return { Date: x.date, Link: x.link }; }) },
        'Like List': { 'ItemFavoriteList': likes }
      },
      'Profile And Settings': { 'Profile Info': { 'ProfileMap': { userName: 'sample_user', bioDescription: '' } } },
      'Your Activity': {
        'Login History': { 'LoginHistoryList': logins },
        'Searches': { 'SearchList': searches },
        'Share History': { 'ShareHistoryList': shares },
        'Watch History': { 'VideoList': watch }
      }
    };
    if (opts.dmCanary) out['Direct Message'] = { 'Direct Messages': { 'ChatHistory': { 'Chat History with friend_one:': [{ Date: stamp(end - 3600000), From: 'friend_one', Content: opts.dmCanary }] } } };
    return out;
  }

  var api = { build: build, stamp: stamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TikTokDemo = api;
})(typeof self !== 'undefined' ? self : this);
