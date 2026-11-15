/* Dating Wrapped: deterministic made-up sample export (Tinder-shaped) for the "See a sample deck" button.
 * Every number is invented. It contains no names and no message text at all, only timestamps. */
(function (root) {
  'use strict';
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // opts: { year, endMonth (1-12), endDay }
  function tinderJson(opts) {
    var Y = opts.year, r = rng(20261114);
    var end = Date.UTC(Y, (opts.endMonth || 12) - 1, opts.endDay || 31);
    var start = Date.UTC(Y - 1, 1, 1);
    var U = { app_opens: {}, swipes_likes: {}, swipes_passes: {}, superlikes: {}, matches: {}, messages_sent: {}, messages_received: {} };
    var Messages = [];
    for (var t = start; t <= end; t += 86400000) {
      var d = new Date(t), k = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
      var m = d.getUTCMonth(), wd = d.getUTCDay();
      var season = [1.5, 1.7, 1.1, 0.9, 0.8, 0.7, 0.75, 0.8, 0.9, 1.15, 1.35, 1.55][m];
      var weekend = wd === 0 || wd === 6 ? 1.55 : 1;
      var inStreak = d.getUTCFullYear() === Y && m === 0 && d.getUTCDate() >= 3;
      var active = inStreak || r() < 0.66 * Math.min(1, season);
      var swipes = active ? Math.round((8 + r() * 46) * season * weekend) : 0;
      if (d.getUTCFullYear() === Y && m === 1 && d.getUTCDate() === 8) swipes = 386;
      var likes = Math.round(swipes * (0.27 + r() * 0.12));
      var matches = 0; for (var i = 0; i < likes; i++) if (r() < 0.085) matches++;
      var recv = active ? Math.round(r() * 11 * season) : 0;
      U.app_opens[k] = active ? 1 + Math.round(r() * 7) : 0;
      U.swipes_likes[k] = likes; U.swipes_passes[k] = swipes - likes;
      U.superlikes[k] = active && r() < 0.06 ? 1 : 0;
      U.matches[k] = matches; U.messages_received[k] = recv; U.messages_sent[k] = active ? Math.round(recv * (0.85 + r() * 0.5)) : 0;
      for (var j = 0; j < matches; j++) {
        var msgs = [];
        if (r() < 0.7) {
          var n = 1 + Math.floor(r() * r() * 34), off = new Date(t).getTimezoneOffset() * 60000;
          for (var q = 0; q < n; q++) {
            var h = r() < 0.18 ? 22 + r() * 4 : 12 + r() * 10; // mostly afternoons and evenings, some late nights (local time)
            msgs.push({ sent_date: new Date(t + Math.floor(q / 3) * 86400000 + h * 3600000 + off).toUTCString() });
          }
        }
        Messages.push({ messages: msgs });
      }
    }
    return { Usage: U, Messages: Messages };
  }

  var api = { tinderJson: tinderJson };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DatingDemo = api;
})(typeof self !== 'undefined' ? self : this);
