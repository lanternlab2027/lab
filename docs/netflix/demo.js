/* Streaming Wrapped: deterministic, entirely made-up viewing history. Every show and movie title is invented.
 * Used by the "sample deck" button and the test fixtures. Emits a Netflix-shaped "Title,Date" CSV, newest first. */
(function (root) {
  'use strict';

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function shuffle(r, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // Invented series. marker: how the season segment is written. none = docuseries with no season segment.
  var SHOWS = [
    { name: 'Saltmarsh Inspectors', seasons: 3, eps: 8, marker: 'Season' },
    { name: 'Nightshift at Juniper General', seasons: 5, eps: 12, marker: 'Season' },
    { name: 'The Copper Orchard', seasons: 2, eps: 10, marker: 'Season' },
    { name: 'Orbit Station: Nova Ring', seasons: 2, eps: 9, marker: 'Season' },
    { name: 'Tiny Kitchens, Big Tempers', seasons: 2, eps: 8, marker: 'Season' },
    { name: 'The Velvet Heist Club', seasons: 2, eps: 5, marker: 'Part' },
    { name: 'Glasswing', seasons: 1, eps: 6, marker: 'Limited Series' },
    { name: 'Moth & Lantern', seasons: 1, eps: 8, marker: 'Season' },
    { name: 'The Ferryman\u2019s Daughters', seasons: 2, eps: 6, marker: 'Series' },
    { name: 'Deep Blue Atlas', seasons: 1, eps: 6, marker: 'none' },
    { name: 'Hollow Pines Academy', seasons: 2, eps: 10, marker: 'Season' },
    { name: 'Marigold Street', seasons: 1, eps: 8, marker: 'Season' },
    { name: 'Ranch Hands of Nowhere', seasons: 1, eps: 8, marker: 'Season' },
    { name: 'Crown of Static', seasons: 1, eps: 8, marker: 'Season' },
    { name: 'Ghost Kitchen Detectives', seasons: 2, eps: 6, marker: 'Season' },
    { name: 'Satellite Summer', seasons: 1, eps: 7, marker: 'Season' },
    { name: 'Lakeside Lawyers', seasons: 3, eps: 10, marker: 'Season' },
    { name: 'The Quiet Almanac', seasons: 1, eps: 5, marker: 'none' },
    { name: 'Bramble & Finch', seasons: 2, eps: 8, marker: 'Season' },
    { name: 'Weatherby Hall', seasons: 3, eps: 6, marker: 'Series' }
  ];
  var EP = ['The Low Tide', 'Ignition', 'Chapter One: The Vanishing', 'Fog Bank', 'Paper Trail', 'The Second Key', 'Homecoming', 'Static', 'The Long Night', 'Undertow', 'Red Herring', 'Lights Out', 'Open House', 'The Visitor', 'Crossing Over', 'Burn Notice Day', 'Small Mercies', 'Dead Reckoning', 'The Inheritance', 'Signal and Noise', 'Shore Leave', 'Ashes', 'The Lantern Room', 'Cold Open', 'Pilot', 'Half Measures', 'The Big Melt', 'Kelp Cathedral', 'Glass Houses', 'Fault Lines', 'Mayday', 'The Clean Plate', 'Overtime', 'Sunday Service', 'Night Market', 'Tidewater', 'The Missing Hour', 'Moonlighting', 'Last Orders', 'A Quiet Word', 'Backdraft', 'The Wedding', 'Codebreaker', 'Northern Lights', 'Thin Ice', 'The Audit', 'Daybreak', 'Falling Star', 'The Garden Party', 'Endgame', 'Copper Wire', 'Snowed In', 'The Pitch', 'Feathers', 'The Ledger', 'Old Friends', 'Sinkhole', 'Field Day', 'High Water', 'Curtain Call'];
  var MOVIES = ['Paper Satellites', 'Midnight at the Copper Hotel', 'A Fox for Winter Days', 'Lighthouse Protocol', 'The Borrowed Summer', 'Seventeen Lanterns', 'Ironbark Junction', 'Glass Ferry: The Return', 'The Kindest Lie', 'Saltwater Cowboys', 'Velvet Thunder', 'The Last Ferris Wheel', 'Quiet Hours', 'Northbound: A Love Story', 'The Moth Orchard', 'Concrete Halo', 'Four Weddings and a Lighthouse', 'The Apothecary\u2019s Map', 'Stormglass', 'Late Checkout', 'Ember Valley', 'The Holiday Swap Club', 'Neon Tidepool', 'Cobblestone', 'Heist on Juniper Lane', 'The Cartographer\u2019s Daughter', 'Brass & Bone', 'Skyline Rescue', 'Kite Season', 'The Understudy', 'Harvest Moon Motel', 'The Treehouse Accord', 'Second Fiddle', 'Polar Express Lane', 'Dust & Diamonds', 'The Wrong Twin', 'Salt in the Wound', 'A Very Small Dragon', 'Tin Can Orchestra', 'Overdue at Larkspur Library'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(d, order) {
    var yy = String(d.getUTCFullYear()).slice(2), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, dd = d.getUTCDate();
    if (order === 'dmy') return pad(dd) + '/' + pad(m) + '/' + y;
    if (order === 'dotted') return pad(dd) + '.' + pad(m) + '.' + yy;
    if (order === 'iso') return y + '-' + pad(m) + '-' + pad(dd);
    return m + '/' + dd + '/' + yy; // US: M/D/YY
  }
  function q(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

  // opts: { year (last year, default 2026), endMonth, endDay, order: 'mdy'|'dmy'|'dotted'|'iso', seed, years }
  function history(opts) {
    opts = opts || {};
    var Y = opts.year || 2026, r = rng(opts.seed || 20261114);
    var end = Date.UTC(Y, (opts.endMonth || 11) - 1, opts.endDay || 13);
    var start = Date.UTC(Y - (opts.years || 2) + 1, 0, 1);
    // Build every show's episode list once.
    var queue = SHOWS.map(function (s) {
      var pool = shuffle(r, EP), list = [], k = 0;
      for (var se = 1; se <= s.seasons; se++) for (var e = 1; e <= s.eps; e++) {
        var name = k < pool.length ? pool[k] : 'Episode ' + e; k++;
        var seg = s.marker === 'none' ? '' : s.marker === 'Limited Series' ? 'Limited Series' : s.marker + ' ' + se;
        list.push(seg ? s.name + ': ' + seg + ': ' + name : s.name + ': ' + name);
      }
      return { show: s, list: list, pos: 0 };
    });
    var byName = {}; queue.forEach(function (q2) { byName[q2.show.name] = q2; });
    var movies = shuffle(r, MOVIES), mpos = 0;
    var out = [];
    function next(name) { var s = byName[name]; return s && s.pos < s.list.length ? s.list[s.pos++] : null; }
    function movie() { return mpos < movies.length ? movies[mpos++] : null; }
    // Each year has its own line-up; tried-once shows get a single pilot.
    var LINEUP = {
      old: ['Lakeside Lawyers', 'Hollow Pines Academy', 'Ghost Kitchen Detectives'],
      cur: ['The Copper Orchard', 'Orbit Station: Nova Ring', 'Tiny Kitchens, Big Tempers', 'The Velvet Heist Club', 'Glasswing', 'Moth & Lantern', 'The Ferryman\u2019s Daughters', 'Deep Blue Atlas', 'Hollow Pines Academy', 'The Quiet Almanac', 'Bramble & Finch', 'Ghost Kitchen Detectives', 'Weatherby Hall']
    };
    var tried = ['Marigold Street', 'Ranch Hands of Nowhere', 'Crown of Static', 'Satellite Summer'];
    var ri = 0, rotation = null, rotYear = null, comfortMonth = {}, movieCap = {};
    for (var t = start; t <= end; t += 86400000) {
      var d = new Date(t), dow = d.getUTCDay(), mo = d.getUTCMonth(), y = d.getUTCFullYear(), dom = d.getUTCDate();
      if (rotYear !== y) { rotYear = y; ri = 0; rotation = (y === Y ? LINEUP.cur : LINEUP.old).slice(); }
      var p = 0.3 + (dow === 0 || dow === 6 ? 0.28 : 0) + (mo === 11 || mo === 0 || mo === 6 ? 0.12 : 0) - (mo === 4 || mo === 8 ? 0.14 : 0);
      if (y !== Y) p *= 0.55;
      var streakRun = y === Y && mo === 0 && dom >= 2 && dom <= 20; // a 19-day streak in January
      var bingeDay = y === Y && mo === 2 && dom === 14; // the big binge
      if (!streakRun && !bingeDay && r() > p) continue;
      var day = [];
      if (bingeDay) { for (var b = 0; b < 11; b++) { var x = next('Saltmarsh Inspectors'); if (x) day.push(x); } rotation.splice(ri % rotation.length, 0, 'Saltmarsh Inspectors'); }
      else {
        var n = 1 + (r() < 0.32 ? 1 : 0) + (dow === 6 && r() < 0.25 ? 1 : 0);
        for (var k = 0; k < n; k++) {
          var pick = null, roll = r(), mk = y * 12 + mo;
          // comfort show: a few Juniper General episodes in most months, every year
          if (roll < 0.14 && mo % 4 !== 1 && (comfortMonth[mk] || 0) < 3) { pick = next('Nightshift at Juniper General'); if (pick) comfortMonth[mk] = (comfortMonth[mk] || 0) + 1; }
          else if (roll < 0.3 && (movieCap[y] || 0) < (y === Y ? 24 : 12)) { pick = movie(); if (pick) movieCap[y] = (movieCap[y] || 0) + 1; }
          else if (roll < 0.33 && tried.length && y === Y && mo > 2) pick = next(tried.shift());
          for (var guard = 0; guard < rotation.length && !pick; guard++) {
            var nm = rotation[ri % rotation.length];
            pick = next(nm);
            if (!pick || r() < 0.15) ri++;
          }
          if (pick) day.push(pick);
        }
      }
      day.forEach(function (title) { out.push([title, d]); });
    }
    return out;
  }

  function csv(opts) {
    opts = opts || {};
    var rows = history(opts).reverse(); // newest first, as Netflix lists it
    return 'Title,Date\n' + rows.map(function (r2) { return q(r2[0]) + ',' + q(fmtDate(r2[1], opts.order)); }).join('\n') + '\n';
  }

  var api = { csv: csv, history: history, fmtDate: fmtDate, SHOWS: SHOWS, MOVIES: MOVIES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NetflixDemo = api;
})(typeof self !== 'undefined' ? self : this);
