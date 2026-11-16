/* Weather Wrapped: 1080x1920 story cards (canvas, no libraries). Same structure as docs/netflix/cards.js:
 * build(stats, info) -> card list; render(canvas, card, stats, info, i, n). Also drawOg() for the 1200x630 image.
 * Every card carries the place, the year label ("2026" or "2026 so far"), "Make yours" and the data credit. */
(function (root) {
  'use strict';
  var WS = root.WeatherStats;
  var W = 1080, H = 1920, M = 96, CW = W - 2 * M;
  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';
  var DISPLAY = '"Avenir Next Condensed", "Arial Narrow", "Roboto Condensed", "DejaVu Sans Condensed", "Helvetica Neue", Arial, sans-serif';
  var SITE = 'lanternlab2027.github.io/lab/weather';
  var DEG = '\u00b0', DASH = '\u2013';

  var T = {
    heat:  { bg: ['#ff8a3d', '#b8202f'], ink: '#fff7ee', soft: '#ffe0b8', accent: '#fff2a8', chip: 'rgba(255,255,255,.16)' },
    ice:   { bg: ['#1b3d75', '#091a36'], ink: '#eef6ff', soft: '#a9cdf5', accent: '#8fe3ff', chip: 'rgba(255,255,255,.10)' },
    rain:  { bg: ['#25586a', '#0d2530'], ink: '#ecfbff', soft: '#a6d7e2', accent: '#7fe0d1', chip: 'rgba(255,255,255,.10)' },
    sun:   { bg: ['#ffd36b', '#ff9f43'], ink: '#2b1702', soft: '#6b3d07', accent: '#9a2c00', chip: 'rgba(60,30,0,.10)' },
    dusk:  { bg: ['#3a2a6b', '#120c2b'], ink: '#f4f0ff', soft: '#c4b8f0', accent: '#ffb86b', chip: 'rgba(255,255,255,.10)' },
    storm: { bg: ['#4b5563', '#151a22'], ink: '#f3f6fa', soft: '#c3cad4', accent: '#ffd166', chip: 'rgba(255,255,255,.10)' },
    sky:   { bg: ['#7cc4f2', '#2c74c4'], ink: '#ffffff', soft: '#e3f3ff', accent: '#fff3a3', chip: 'rgba(255,255,255,.18)' }
  };

  function F(w, s, kind) { return w + ' ' + s + 'px ' + (kind === 'd' ? DISPLAY : SANS); }
  function rr(x, a, b, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function fit(x, text, max, size, w, min, kind) { var s = size; x.font = F(w, s, kind); while (x.measureText(text).width > max && s > (min || 20)) { s -= 2; x.font = F(w, s, kind); } return s; }
  function ell(x, t, w) { t = String(t); if (x.measureText(t).width <= w) return t; while (t.length > 1 && x.measureText(t + '\u2026').width > w) t = t.slice(0, -1); return t + '\u2026'; }
  function text(x, t, a, b, o) {
    o = o || {}; x.save();
    x.font = F(o.w || 700, o.s || 40, o.kind); x.fillStyle = o.c; x.textAlign = o.align || 'left'; x.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.ls && 'letterSpacing' in x) x.letterSpacing = o.ls + 'px';
    if (o.fit) { fit(x, t, o.fit, o.s, o.w || 700, o.min || 24, o.kind); }
    x.fillText(o.max ? ell(x, t, o.max) : t, a, b); x.restore();
  }
  function wrapLines(x, t, width) {
    var words = String(t).split(/\s+/), lines = [], line = '';
    words.forEach(function (w) { var test = line ? line + ' ' + w : w; if (x.measureText(test).width > width && line) { lines.push(line); line = w; } else line = test; });
    if (line) lines.push(line); return lines;
  }
  function para(x, t, a, b, o) {
    x.save(); x.font = F(o.w || 500, o.s || 38); x.fillStyle = o.c; x.globalAlpha = o.alpha == null ? 1 : o.alpha;
    var lines = wrapLines(x, t, o.width || CW).slice(0, o.lines || 4), lh = (o.s || 38) * 1.3;
    lines.forEach(function (l, i) { x.fillText(l, a, b + i * lh); }); x.restore();
    return b + (lines.length - 1) * lh;
  }
  function sentence(t) { return /\.$/.test(t) ? t : t + '.'; }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function mix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t), g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t), bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  // Temperature color: deep blue (-20 C) -> cyan -> pale -> amber -> red (40 C)
  var TSTOPS = [[-20, '#3b4cc0'], [-5, '#5fa8e8'], [8, '#bfe3f2'], [18, '#f6e7a1'], [28, '#f59a4a'], [38, '#d7301f']];
  function tcol(c) {
    if (c <= TSTOPS[0][0]) return TSTOPS[0][1];
    for (var i = 1; i < TSTOPS.length; i++) if (c <= TSTOPS[i][0]) { var a = TSTOPS[i - 1], b = TSTOPS[i]; return mix(a[1], b[1], (c - a[0]) / (b[0] - a[0])); }
    return TSTOPS[TSTOPS.length - 1][1];
  }

  // ---------- frame ----------
  function frame(x, th, card, info, i, n) {
    var g = x.createLinearGradient(0, 0, W * 0.3, H); g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // soft cloud blobs
    var r = rng(hash(card.id + info.place));
    x.save();
    for (var k = 0; k < 5; k++) {
      var cx = r() * W, cy = r() * H * 0.9, rad = 180 + r() * 260;
      var rg = x.createRadialGradient(cx, cy, 0, cx, cy, rad); rg.addColorStop(0, 'rgba(255,255,255,0.09)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = rg; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    x.restore();
    // header
    text(x, 'WEATHER WRAPPED', M, 128, { w: 800, s: 30, c: th.soft, ls: 7 });
    text(x, i + ' / ' + n, W - M, 128, { w: 700, s: 28, c: th.soft, align: 'right' });
    text(x, info.place, M, 196, { w: 800, s: 50, c: th.ink, fit: CW, min: 30 });
    text(x, info.label + (info.complete ? '' : '  \u00b7  through ' + info.through), M, 248, { w: 600, s: 32, c: th.soft, max: CW });
    // footer
    x.save(); x.fillStyle = th.chip; rr(x, M - 24, H - 214, CW + 48, 128, 28); x.fill(); x.restore();
    text(x, 'Make yours: ' + SITE, W / 2, H - 154, { w: 800, s: 34, c: th.ink, align: 'center', fit: CW, min: 24 });
    text(x, 'Data: Open-Meteo.com, ERA5 reanalysis (CC BY 4.0). A grid estimate, not a station.', W / 2, H - 110, { w: 500, s: 22, c: th.soft, align: 'center', fit: CW, min: 16 });
  }
  function kicker(x, th, t, y) { text(x, t.toUpperCase(), M, y, { w: 800, s: 34, c: th.accent, ls: 4 }); }
  function big(x, th, t, y, size, o) { o = o || {}; text(x, t, o.x == null ? M : o.x, y, { w: 900, s: size, c: o.c || th.ink, kind: 'd', fit: o.fit || CW, min: 60, align: o.align }); }

  // ---------- cards ----------
  function monthAxis(x, th, x0, y, w) {
    for (var m = 0; m < 12; m++) text(x, WS.MONTHS[m].charAt(0), x0 + (m + 0.5) * w / 12, y, { w: 700, s: 24, c: th.soft, align: 'center' });
  }
  function xOfSlot(s, x0, w) { return x0 + (s + 0.5) * w / 366; }

  function cExtremes(x, th, S, info) {
    var u = info.units;
    kicker(x, th, 'Hottest day', 360);
    big(x, th, WS.fmt.temp(S.hottest.c, u), 520, 190);
    text(x, WS.longDate(S.hottest.date), M, 590, { w: 700, s: 40, c: th.ink });
    kicker(x, th, 'Coldest night', 720);
    big(x, th, WS.fmt.temp(S.coldest.c, u), 880, 190, { c: '#cfe8ff' });
    text(x, WS.longDate(S.coldest.date), M, 950, { w: 700, s: 40, c: th.ink });
    // ribbon: one bar per day, low to high
    var top = 1060, bot = 1560, x0 = M, w = CW;
    var lo = S.coldest.c, hi = S.hottest.c, span = Math.max(1, hi - lo);
    x.save(); x.fillStyle = 'rgba(0,0,0,.18)'; rr(x, x0 - 16, top - 20, w + 32, bot - top + 90, 24); x.fill(); x.restore();
    var yOf = function (c) { return bot - (c - lo) / span * (bot - top); };
    S.series.forEach(function (d) {
      if (d.tmax == null || d.tmin == null) return;
      var xx = xOfSlot(d.slot, x0, w);
      x.strokeStyle = tcol((d.tmax + d.tmin) / 2); x.lineWidth = 2.6; x.beginPath(); x.moveTo(xx, yOf(d.tmin)); x.lineTo(xx, yOf(d.tmax)); x.stroke();
    });
    [[S.hottest, S.hottest.c, '#fff2a8'], [S.coldest, S.coldest.c, '#8fe3ff']].forEach(function (p) {
      var xx = xOfSlot(WS.slot(p[0].date), x0, w), yy = yOf(p[1]);
      x.fillStyle = p[2]; x.strokeStyle = '#1b1b1b'; x.lineWidth = 4; x.beginPath(); x.arc(xx, yy, 14, 0, 7); x.fill(); x.stroke();
    });
    monthAxis(x, th, x0, bot + 50, w);
    para(x, 'Each line is one day, from its low to its high.', M, 1680, { s: 30, c: th.soft, w: 500 });
  }

  function cPrecip(x, th, S, info) {
    var u = info.units;
    kicker(x, th, 'Rain and melted snow', 360);
    big(x, th, WS.fmt.precip(S.precipMM, u), 530, 200);
    text(x, S.wetDays + ' wet days (' + (u.precip === 'in' ? '0.04 in.' : '1 mm') + ' or more)', M, 600, { w: 700, s: 38, c: th.ink });
    kicker(x, th, 'Snowfall', 730);
    big(x, th, S.snowCM > 0 ? WS.fmt.snow(S.snowCM, u) : 'No snow', 890, 180, { c: '#ffffff' });
    var sub = S.snowiest ? 'Snowiest day: ' + WS.shortDate(S.snowiest.date) + ', ' + WS.fmt.snow(S.snowiest.cm, u) : 'Not a flake on the books.';
    text(x, sub, M, 960, { w: 700, s: 38, c: th.ink, max: CW });
    // monthly bars: precipitation, with the snow months frosted
    var top = 1060, bot = 1460, x0 = M, w = CW, bw = w / 12;
    var mx = Math.max.apply(null, S.months.map(function (m) { return m.prcp; }).concat([1]));
    S.months.forEach(function (m, k) {
      if (!m.days) return;
      var h = (bot - top) * m.prcp / mx, xx = x0 + k * bw + 10;
      x.fillStyle = th.accent; rr(x, xx, bot - h, bw - 20, Math.max(4, h), 10); x.fill();
      // Open-Meteo: 7 cm of snow = 10 mm of water, so the snow share of the bar is (snow cm * 10 / 7) / precipitation mm
      if (m.snow > 0 && m.prcp > 0) { var sh = h * Math.min(1, m.snow * 10 / 7 / m.prcp); x.fillStyle = 'rgba(255,255,255,.9)'; rr(x, xx, bot - h, bw - 20, Math.max(4, sh), 10); x.fill(); }
    });
    monthAxis(x, th, x0, bot + 50, w);
    if (S.wettest) para(x, sentence('Wettest day: ' + WS.longDate(S.wettest.date) + ', ' + WS.fmt.precip(S.wettest.mm, u)), M, 1590, { s: 34, c: th.ink, w: 700 });
    if (S.snowCM > 0) para(x, 'White: the part that fell as snow.', M, 1648, { s: 28, c: th.soft, w: 500 });
  }

  function cStreaks(x, th, S, info) {
    kicker(x, th, 'Longest dry streak', 360);
    big(x, th, S.dry.len + (S.dry.len === 1 ? ' day' : ' days'), 520, 180, { c: '#ffd9a0' });
    if (S.dry.len) text(x, WS.shortDate(S.dry.start) + ' ' + DASH + ' ' + WS.shortDate(S.dry.end) + ' without a wet day', M, 590, { w: 700, s: 36, c: th.ink, max: CW });
    kicker(x, th, 'Longest wet streak', 720);
    big(x, th, S.wet.len + (S.wet.len === 1 ? ' day' : ' days'), 880, 180, { c: '#9be7ff' });
    if (S.wet.len) text(x, WS.shortDate(S.wet.start) + ' ' + DASH + ' ' + WS.shortDate(S.wet.end) + ', ' + (info.units.precip === 'in' ? '0.04 in.' : '1 mm') + ' or more each day', M, 950, { w: 700, s: 36, c: th.ink, max: CW });
    // calendar: 12 rows x 31 dots
    var top = 1040, x0 = M + 70, cw = (CW - 70) / 31, ch = 46, rad = Math.min(cw, ch) * 0.36;
    var dryS = WS.epochDay(S.dry.start), dryE = WS.epochDay(S.dry.end), wetS = WS.epochDay(S.wet.start), wetE = WS.epochDay(S.wet.end);
    for (var m = 0; m < 12; m++) text(x, WS.MONTHS[m], M, top + m * ch + 10, { w: 700, s: 22, c: th.soft });
    S.series.forEach(function (d) {
      var p = WS.parseISO(d.date), cx = x0 + (p.d - 0.5) * cw, cy = top + (p.mo - 1) * ch, e = WS.epochDay(d.date);
      var inDry = S.dry.len && e >= dryS && e <= dryE, inWet = S.wet.len && e >= wetS && e <= wetE;
      x.beginPath(); x.arc(cx, cy, rad, 0, 7);
      if (inDry) x.fillStyle = '#ffb648'; else if (inWet) x.fillStyle = '#5fd4ff';
      else if (d.prcp == null) x.fillStyle = 'rgba(255,255,255,.08)';
      else x.fillStyle = d.prcp >= WS.WET_MM ? 'rgba(127,224,209,.75)' : 'rgba(255,255,255,.22)';
      x.fill();
    });
    var ly = top + 12 * ch + 30;
    [['#ffb648', 'dry streak'], ['#5fd4ff', 'wet streak'], ['rgba(127,224,209,.75)', 'wet day'], ['rgba(255,255,255,.22)', 'dry day']].forEach(function (l, k) {
      var lx = M + k * 230; x.fillStyle = l[0]; x.beginPath(); x.arc(lx + 12, ly - 10, 11, 0, 7); x.fill();
      text(x, l[1], lx + 32, ly, { w: 600, s: 26, c: th.soft });
    });
  }

  function cSun(x, th, S, info) {
    var m = S.sunniest;
    // sun
    var cx = W - M - 110, cy = 380;
    x.save(); x.globalAlpha = 0.85; x.fillStyle = '#fff6c8'; x.beginPath(); x.arc(cx, cy, 70, 0, 7); x.fill();
    x.strokeStyle = '#fff6c8'; x.lineWidth = 12; x.lineCap = 'round';
    for (var k = 0; k < 12; k++) { var a = k * Math.PI / 6; x.beginPath(); x.moveTo(cx + Math.cos(a) * 95, cy + Math.sin(a) * 95); x.lineTo(cx + Math.cos(a) * 130, cy + Math.sin(a) * 130); x.stroke(); }
    x.restore();
    kicker(x, th, 'Sunniest month', 360);
    big(x, th, m.name, 540, 210);
    text(x, Math.round(m.sunH) + ' hours of sunshine, ' + WS.num(m.sunPerDay, true) + ' a day', M, 615, { w: 700, s: 40, c: th.ink, max: CW });
    var top = 760, bot = 1460, x0 = M, w = CW, bw = w / 12;
    var mx = Math.max.apply(null, S.months.map(function (q) { return q.sunPerDay || 0; }).concat([1]));
    S.months.forEach(function (q, k) {
      if (q.sunPerDay == null) return;
      var h = (bot - top) * q.sunPerDay / mx, xx = x0 + k * bw + 8;
      x.fillStyle = q === m ? th.accent : 'rgba(80,40,0,.28)'; rr(x, xx, bot - h, bw - 16, Math.max(4, h), 12); x.fill();
      text(x, WS.num(q.sunPerDay, true), xx + (bw - 16) / 2, bot - h - 14, { w: 800, s: 26, c: q === m ? th.accent : th.soft, align: 'center' });
    });
    monthAxis(x, th, x0, bot + 50, w);
    para(x, 'Average hours of sunshine per day, by month.', M, 1600, { s: 30, c: th.soft, w: 600 });
    para(x, Math.round(S.sunHours).toLocaleString('en-US') + ' hours of sun in all.', M, 1660, { s: 34, c: th.ink, w: 700 });
  }

  function cHotCold(x, th, S, info) {
    var u = info.units;
    kicker(x, th, 'Days ' + WS.fmt.hotLabel(u), 360);
    big(x, th, String(S.hotDays), 560, 260, { c: '#ffb36b' });
    kicker(x, th, 'Nights ' + WS.fmt.freezeLabel(u), 720);
    big(x, th, String(S.freezeDays), 920, 260, { c: '#9be7ff' });
    // calendar: one square per day, a row per month
    var top = 1010, x0 = M + 70, cw = (CW - 70) / 31, ch = 44, sz = Math.min(cw, ch) - 5;
    for (var mo = 0; mo < 12; mo++) text(x, WS.MONTHS[mo], M, top + mo * ch + sz - 4, { w: 700, s: 22, c: th.soft });
    S.series.forEach(function (d) {
      var p = WS.parseISO(d.date), xx = x0 + (p.d - 1) * cw, yy = top + (p.mo - 1) * ch;
      var hotD = d.tmax != null && WS.cToF(d.tmax) >= WS.HOT_F - 1e-9, frz = d.tmin != null && WS.cToF(d.tmin) < WS.FREEZE_F - 1e-9;
      x.fillStyle = hotD && frz ? '#c38cff' : hotD ? '#ff7a45' : frz ? '#5fc7ff' : 'rgba(255,255,255,.14)';
      rr(x, xx, yy, sz, sz, 5); x.fill();
    });
    var ly = top + 12 * ch + 44;
    [['#ff7a45', 'hot day'], ['#5fc7ff', 'freezing night'], ['rgba(255,255,255,.14)', 'neither']].forEach(function (l, k) {
      var lx = M + k * 300; x.fillStyle = l[0]; rr(x, lx, ly - 26, 28, 28, 6); x.fill();
      text(x, l[1], lx + 42, ly - 2, { w: 600, s: 28, c: th.soft });
    });
  }

  function cWeird(x, th, S, info) {
    var u = info.units, wd = S.weird, warm = wd.diff > 0;
    kicker(x, th, 'The weirdest day', 360);
    big(x, th, WS.shortDate(wd.date), 540, 220);
    text(x, WS.longDate(wd.date).split(',')[0], M, 610, { w: 700, s: 40, c: th.soft });
    para(x, 'The high hit ' + WS.fmt.temp(wd.c, u) + '. A normal high for that time of year is ' + WS.fmt.temp(wd.normal, u) + '.', M, 720, { s: 44, c: th.ink, w: 700, lines: 3 });
    x.save(); x.fillStyle = warm ? '#ff8a3d' : '#3fa9f5'; rr(x, M, 880, CW, 150, 30); x.fill(); x.restore();
    text(x, WS.fmt.tempDelta(wd.diff, u) + (warm ? ' warmer' : ' colder') + ' than normal', W / 2, 980, { w: 900, s: 70, c: '#ffffff', align: 'center', kind: 'd', fit: CW - 60 });
    // chart: normal curve + the year's highs
    var top = 1110, bot = 1530, x0 = M, w = CW;
    var vals = S.series.filter(function (d) { return d.tmax != null; }).map(function (d) { return d.tmax; });
    var nn = S.normals.filter(Boolean).map(function (n) { return n.mean; });
    var lo = Math.min.apply(null, vals.concat(nn)) - 2, hi = Math.max.apply(null, vals.concat(nn)) + 2;
    var yOf = function (c) { return bot - (c - lo) / (hi - lo) * (bot - top); };
    S.series.forEach(function (d) { if (d.tmax == null) return; x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(xOfSlot(d.slot, x0, w), yOf(d.tmax), 3.2, 0, 7); x.fill(); });
    x.strokeStyle = th.accent; x.lineWidth = 6; x.beginPath();
    S.normals.forEach(function (n, s) { if (!n) return; var xx = xOfSlot(s, x0, w), yy = yOf(n.mean); if (s === 0) x.moveTo(xx, yy); else x.lineTo(xx, yy); });
    x.stroke();
    var ws = WS.slot(wd.date), wx = xOfSlot(ws, x0, w);
    x.strokeStyle = '#ffffff'; x.lineWidth = 5; x.setLineDash([10, 8]); x.beginPath(); x.moveTo(wx, yOf(wd.normal)); x.lineTo(wx, yOf(wd.c)); x.stroke(); x.setLineDash([]);
    x.fillStyle = warm ? '#ff8a3d' : '#3fa9f5'; x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.arc(wx, yOf(wd.c), 16, 0, 7); x.fill(); x.stroke();
    monthAxis(x, th, x0, bot + 50, w);
    para(x, 'The line: the normal high for each date, averaged over ' + S.normalYears + ' (same place, same data). Dots: this year\u2019s daily highs.', M, 1650, { s: 28, c: th.soft, w: 500, lines: 3 });
  }

  function cSummary(x, th, S, info) {
    var u = info.units;
    kicker(x, th, 'The year in weather', 360);
    var rows = [
      ['Hottest', WS.fmt.temp(S.hottest.c, u), WS.shortDate(S.hottest.date)],
      ['Coldest', WS.fmt.temp(S.coldest.c, u), WS.shortDate(S.coldest.date)],
      ['Rain + melted snow', WS.fmt.precip(S.precipMM, u), S.wetDays + ' wet days'],
      ['Snowfall', S.snowCM > 0 ? WS.fmt.snow(S.snowCM, u) : 'none', S.snowiest ? 'most on ' + WS.shortDate(S.snowiest.date) : ''],
      ['Days ' + (u.temp === 'F' ? '90' + DEG + 'F+' : '32' + DEG + 'C+'), String(S.hotDays), ''],
      ['Freezing nights', String(S.freezeDays), u.temp === 'F' ? 'below 32' + DEG + 'F' : 'below 0' + DEG + 'C'],
      ['Longest dry streak', S.dry.len + ' days', S.dry.len ? WS.shortDate(S.dry.start) + ' ' + DASH + ' ' + WS.shortDate(S.dry.end) : ''],
      ['Sunniest month', S.sunniest ? S.sunniest.name : 'n/a', S.sunniest ? WS.num(S.sunniest.sunPerDay, true) + ' h/day' : ''],
      ['Windiest day', S.windiest ? WS.fmt.wind(S.windiest.kmh, u) : 'n/a', S.windiest ? WS.shortDate(S.windiest.date) : '']
    ];
    if (S.weird) rows.push(['Weirdest day', WS.shortDate(S.weird.date), WS.fmt.tempDelta(S.weird.diff, u) + (S.weird.diff > 0 ? ' above' : ' below') + ' normal']);
    var y = 430, rh = Math.min(116, 1180 / rows.length);
    rows.forEach(function (r, k) {
      x.save(); x.fillStyle = k % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.11)'; rr(x, M - 20, y, CW + 40, rh - 10, 18); x.fill(); x.restore();
      text(x, r[0], M + 6, y + rh * 0.42, { w: 700, s: 30, c: th.soft, max: 470 });
      if (r[2]) text(x, r[2], M + 6, y + rh * 0.42 + 36, { w: 500, s: 25, c: th.soft, alpha: 0.85, max: 470 });
      text(x, r[1], W - M - 6, y + rh * 0.62, { w: 900, s: 54, c: th.ink, align: 'right', kind: 'd', fit: 420, min: 30 });
      y += rh;
    });
    if (S.vsNormal != null) {
      var d = S.vsNormal, word = Math.abs(d) < 0.25 ? 'Right on the 10-year normal for highs' : 'Highs ran ' + WS.fmt.tempDelta(d, u) + (d > 0 ? ' warmer' : ' cooler') + ' than ' + S.normalYears + ', on average';
      if (Math.abs(d) >= 0.25 && u.temp === 'F') word = 'Highs ran ' + WS.num(Math.abs(WS.dC2F(d)), true) + DEG + (d > 0 ? ' warmer' : ' cooler') + ' than ' + S.normalYears + ', on average';
      if (Math.abs(d) >= 0.25 && u.temp === 'C') word = 'Highs ran ' + WS.num(Math.abs(d), true) + DEG + (d > 0 ? ' warmer' : ' cooler') + ' than ' + S.normalYears + ', on average';
      para(x, word + '.', M, y + 60, { s: 34, c: th.accent, w: 800, lines: 2 });
    }
  }

  // ---------- deck ----------
  function build(S, info) {
    var cards = [];
    if (!S || !S.n) return cards;
    if (S.hottest && S.coldest) cards.push({ id: 'extremes', label: 'Hottest and coldest', theme: 'heat', draw: cExtremes });
    if (S.precipDays) cards.push({ id: 'precip', label: 'Rain and snow', theme: 'rain', draw: cPrecip });
    if (S.precipDays >= 14) cards.push({ id: 'streaks', label: 'Dry and wet streaks', theme: 'storm', draw: cStreaks });
    if (S.sunniest) cards.push({ id: 'sun', label: 'Sunniest month', theme: 'sun', draw: cSun });
    if (S.tempDays) cards.push({ id: 'hotcold', label: 'Hot days and freezing nights', theme: 'dusk', draw: cHotCold });
    if (S.weird) cards.push({ id: 'weird', label: 'The weirdest day', theme: 'ice', draw: cWeird });
    if (S.hottest && S.coldest) cards.push({ id: 'summary', label: 'Summary', theme: 'sky', draw: cSummary });
    return cards;
  }
  function render(canvas, card, S, info, i, n) {
    canvas.width = W; canvas.height = H;
    var x = canvas.getContext('2d'), th = T[card.theme];
    x.textBaseline = 'alphabetic';
    frame(x, th, card, info, i, n);
    card.draw(x, th, S, info);
    return canvas;
  }

  // ---------- OG image (1200x630) ----------
  function drawOg(canvas) {
    var w = 1200, h = 630; canvas.width = w; canvas.height = h;
    var x = canvas.getContext('2d');
    var g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2c74c4'); g.addColorStop(0.55, '#3a2a6b'); g.addColorStop(1, '#b8202f');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // a year of invented highs as a ribbon, for decoration
    var r = rng(9);
    for (var s = 0; s < 366; s++) {
      var k = (1 - Math.cos(2 * Math.PI * (s - 20) / 366)) / 2, hi = -2 + 30 * k + (r() - 0.5) * 9, lo = hi - 8 - r() * 4;
      var xx = 40 + s * (w - 80) / 366;
      x.strokeStyle = tcol((hi + lo) / 2); x.globalAlpha = 0.9; x.lineWidth = 2.4;
      x.beginPath(); x.moveTo(xx, 585 - (lo + 15) * 4.2); x.lineTo(xx, 585 - (hi + 15) * 4.2); x.stroke();
    }
    x.globalAlpha = 1;
    x.fillStyle = 'rgba(10,12,30,.55)'; rr(x, 40, 40, 760, 330, 28); x.fill();
    text(x, 'WEATHER WRAPPED', 76, 104, { w: 800, s: 28, c: '#fff3a3', ls: 7 });
    text(x, 'Your city\u2019s 2026', 76, 190, { w: 900, s: 76, c: '#ffffff', kind: 'd' });
    text(x, 'in weather', 76, 268, { w: 900, s: 76, c: '#ffffff', kind: 'd' });
    text(x, 'Hottest day, rain and snow, streaks, the weirdest day.', 76, 330, { w: 600, s: 26, c: '#e3f3ff', max: 700 });
    x.fillStyle = 'rgba(10,12,30,.7)'; rr(x, 40, 552, 560, 62, 20); x.fill();
    text(x, SITE, 64, 594, { w: 800, s: 28, c: '#ffffff' });
    return canvas;
  }

  var api = { W: W, H: H, build: build, render: render, drawOg: drawOg, tcol: tcol };
  root.WeatherCards = api;
})(typeof window !== 'undefined' ? window : this);
