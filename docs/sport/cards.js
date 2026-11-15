/* Year in Motion: 1080x1920 card renderer (canvas). Engine structure follows docs/reading/cards.js and
 * docs/wrapped/cards.js; the look is its own: deep navy, electric orange, volt lime, condensed italic numerals.
 */
(function (root) {
  'use strict';

  var W = 1080, H = 1920, M = 88, CW = W - 2 * M;
  var DISPLAY = '"Avenir Next Condensed", "DIN Condensed", "Roboto Condensed", "Arial Narrow", "Helvetica Neue", "DejaVu Sans Condensed", Arial, sans-serif';
  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var SITE = 'lanternlab2027.github.io/lab/sport';
  var NAVY = '#0a1433', ORANGE = '#ff5b1f', VOLT = '#c6ff1a';

  var T = {
    navy:   { bg: ['#0d1a45', '#050a1c'], ink: '#f3f6ff', hot: ORANGE, volt: VOLT, dark: true },
    orange: { bg: ['#ff6a2b', '#e9400b'], ink: NAVY, hot: '#ffffff', volt: NAVY, dark: false },
    volt:   { bg: ['#d2ff3d', '#a6e300'], ink: NAVY, hot: '#ff4a10', volt: NAVY, dark: false },
    blue:   { bg: ['#1f3dff', '#0b1a9a'], ink: '#ffffff', hot: VOLT, volt: ORANGE, dark: true },
    ink:    { bg: ['#171a22', '#04050a'], ink: '#ffffff', hot: VOLT, volt: ORANGE, dark: true }
  };
  var SPORT_COL = { run: '#ff5b1f', ride: '#c6ff1a', walk: '#5ad1ff', hike: '#ffd23f', swim: '#4d8bff', strength: '#ff4f9a', yoga: '#b88cff', row: '#2fe0b0', ski: '#e6f0ff', paddle: '#22c3c3', climb: '#ff9f43', other: '#9aa5c4' };

  // City pairs (great-circle distance computed below) and landmarks for "that's like..." lines.
  var CITIES = {
    'New York': [40.7128, -74.006], 'Philadelphia': [39.9526, -75.1652], 'Boston': [42.3601, -71.0589], 'London': [51.5074, -0.1278], 'Paris': [48.8566, 2.3522],
    'Seattle': [47.6062, -122.3321], 'Portland': [45.5152, -122.6784], 'Tokyo': [35.6762, 139.6503], 'Osaka': [34.6937, 135.5023], 'Toronto': [43.6532, -79.3832],
    'Montreal': [45.5017, -73.5673], 'San Francisco': [37.7749, -122.4194], 'Los Angeles': [34.0522, -118.2437], 'Amsterdam': [52.3676, 4.9041], 'Berlin': [52.52, 13.405],
    'Sydney': [-33.8688, 151.2093], 'Melbourne': [-37.8136, 144.9631], 'Chicago': [41.8781, -87.6298], 'Denver': [39.7392, -104.9903], 'Rome': [41.9028, 12.4964],
    'Miami': [25.7617, -80.1918], 'Madrid': [40.4168, -3.7038], 'Moscow': [55.7558, 37.6173], 'Dallas': [32.7767, -96.797], 'Washington, DC': [38.9072, -77.0369]
  };
  var PAIRS = [['New York', 'Philadelphia'], ['Seattle', 'Portland'], ['New York', 'Boston'], ['London', 'Paris'], ['Tokyo', 'Osaka'], ['Toronto', 'Montreal'],
    ['San Francisco', 'Los Angeles'], ['Amsterdam', 'Berlin'], ['Sydney', 'Melbourne'], ['Paris', 'Berlin'], ['New York', 'Chicago'], ['Denver', 'Los Angeles'],
    ['London', 'Rome'], ['New York', 'Miami'], ['Washington, DC', 'Dallas'], ['Madrid', 'Moscow'], ['New York', 'Los Angeles'], ['London', 'New York']];
  function gc(a, b) {
    var p = Math.PI / 180, dla = (b[0] - a[0]) * p, dlo = (b[1] - a[1]) * p;
    var h = Math.sin(dla / 2) * Math.sin(dla / 2) + Math.cos(a[0] * p) * Math.cos(b[0] * p) * Math.sin(dlo / 2) * Math.sin(dlo / 2);
    return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
  }
  PAIRS = PAIRS.map(function (p) { return { a: p[0], b: p[1], km: gc(CITIES[p[0]], CITIES[p[1]]) }; });
  var EARTH_KM = 40075;
  var PEAKS = [['Mount Everest', 8849], ['Kilimanjaro', 5895], ['Mont Blanc', 4806], ['Mount Fuji', 3776], ['Burj Khalifas', 828], ['Empire State Buildings', 443], ['Eiffel Towers', 330]];

  // ---------- units & formatting ----------
  function U(units) {
    var imp = units === 'imperial';
    return {
      imp: imp, d: imp ? 'mi' : 'km', e: imp ? 'ft' : 'm',
      dist: function (m) { return m / (imp ? 1609.344 : 1000); },
      elev: function (m) { return m * (imp ? 3.28084 : 1); },
      pace: function (sPerKm) { return sPerKm * (imp ? 1.609344 : 1); },
      speed: function (mps) { return mps * (imp ? 2.236936 : 3.6); }, sp: imp ? 'mph' : 'km/h'
    };
  }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmt1(n) { return n >= 100 ? fmt(n) : (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, ''); }
  function fmtD(m, u) { var v = u.dist(m); return v >= 100 ? fmt(v) : fmt1(v); }
  function hms(s) { s = Math.round(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + (m < 10 ? '0' : '') + m : String(m)) + ':' + (x < 10 ? '0' : '') + x; }
  function hrs(s) { var h = s / 3600; return h >= 10 ? fmt(h) : fmt1(h); }
  function hm(s) { var h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); if (m === 60) { h++; m = 0; } return h ? h + 'h ' + (m < 10 ? '0' : '') + m + 'm' : m + ' min'; }
  function plural(n, one, many) { return Math.round(n) === 1 ? one : (many || one + 's'); }
  function dayName(t) { var d = new Date(t); return DAYS_LONG[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate(); }
  function shortDate(t) { var d = new Date(t); return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate(); }
  function hourLabel(h) { return h === 0 ? 'midnight' : h === 12 ? 'noon' : (h % 12) + (h < 12 ? ' AM' : ' PM'); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pick(arr, key) { return arr[hash(key) % arr.length]; }

  // ---------- drawing helpers ----------
  function F(family, weight, size) { return weight + ' ' + size + 'px ' + family; }
  function spacing(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function ellipsize(ctx, text, width) {
    if (ctx.measureText(text).width <= width) return text;
    var chars = Array.from(text);
    while (chars.length > 1 && ctx.measureText(chars.join('') + '\u2026').width > width) chars.pop();
    return chars.join('').trim() + '\u2026';
  }
  function wrap(ctx, text, width, maxLines) {
    var words = String(text).split(/\s+/).filter(Boolean), lines = [], line = '';
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > width && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = ellipsize(ctx, lines[maxLines - 1] + ' \u2026', width); }
    return lines.map(function (l) { return ellipsize(ctx, l, width); });
  }

  var SKEW = -0.18;
  // Condensed heavy display type with a forward lean. Returns the font size used.
  function dispSize(ctx, str, max, min, width) {
    var s = max;
    for (;;) { ctx.font = F(DISPLAY, 800, s); if (ctx.measureText(str).width + s * 0.16 <= width || s <= min) return s; s -= 4; }
  }
  function disp(ctx, str, x, y, size, color, o) {
    o = o || {};
    ctx.save();
    ctx.font = F(DISPLAY, 800, size); ctx.fillStyle = color; ctx.textAlign = o.align || 'left';
    if (o.spacing != null) spacing(ctx, o.spacing); else spacing(ctx, -size * 0.02);
    ctx.translate(x, y); ctx.transform(1, 0, SKEW, 1, 0, 0);
    ctx.fillText(str, 0, 0);
    var w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }
  function txt(ctx, str, x, y, size, color, o) {
    o = o || {};
    ctx.save();
    ctx.font = F(o.family || SANS, o.weight || 700, size); ctx.fillStyle = color; ctx.textAlign = o.align || 'left';
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.spacing) spacing(ctx, o.spacing);
    ctx.fillText(o.width ? ellipsize(ctx, str, o.width) : str, x, y);
    ctx.restore();
  }
  // Wrapped block; returns the baseline of the last line.
  function block(ctx, str, y, o) {
    o = o || {};
    if (o.upper) str = String(str).toUpperCase();
    var fam = o.display ? DISPLAY : SANS, wt = o.weight || (o.display ? 800 : 700), width = o.width || CW, size = o.max || 64, lines;
    for (;;) {
      ctx.font = F(fam, wt, size); lines = wrap(ctx, str, width - (o.display ? size * 0.16 : 0));
      if ((lines.length <= (o.lines || 2) && lines.every(function (l) { return ctx.measureText(l).width <= width; })) || size <= (o.min || 30)) break;
      size -= 4;
    }
    ctx.font = F(fam, wt, size); lines = wrap(ctx, str, width - (o.display ? size * 0.16 : 0), o.lines || 2);
    var lh = size * (o.lh || 1.12), x = o.x != null ? o.x : o.align === 'center' ? W / 2 : M;
    lines.forEach(function (l, i) {
      if (o.display) disp(ctx, o.upper ? l.toUpperCase() : l, x, y + i * lh, size, o.color, { align: o.align });
      else txt(ctx, l, x, y + i * lh, size, o.color, { weight: wt, align: o.align, alpha: o.alpha });
    });
    return y + (lines.length - 1) * lh;
  }

  // ---------- frame ----------
  function background(ctx, th, key) {
    var g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var h = hash(key);
    // running-track lanes sweeping off one corner
    ctx.save();
    var right = h % 2 === 0, cx = right ? W + 160 : -160, cy = 380 + (h >> 3) % 500;
    ctx.strokeStyle = th.ink; ctx.lineWidth = 3;
    for (var i = 0; i < 6; i++) { ctx.globalAlpha = th.dark ? 0.06 : 0.09; ctx.beginPath(); ctx.arc(cx, cy, 300 + i * 64, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    // speed stripes
    ctx.save();
    ctx.fillStyle = th.dark ? th.volt : th.ink; ctx.globalAlpha = th.dark ? 0.9 : 0.85;
    var sy = 214, sx = W - 300;
    for (var k = 0; k < 3; k++) {
      var y0 = sy + k * 30, len = 200 + k * 50;
      ctx.beginPath(); ctx.moveTo(sx + k * 30, y0); ctx.lineTo(sx + k * 30 + len, y0); ctx.lineTo(sx + k * 30 + len - 14, y0 + 14); ctx.lineTo(sx + k * 30 - 14, y0 + 14); ctx.closePath();
      ctx.globalAlpha = (th.dark ? 0.5 : 0.25) - k * 0.1; ctx.fill();
    }
    ctx.restore();
  }

  function footerTitle(ctx, th, info) {
    // drawn separately so long names get ellipsized against the real font
    ctx.save(); ctx.font = F(DISPLAY, 800, 40); var t = ellipsize(ctx, info.title.toUpperCase(), 700); ctx.restore();
    return t;
  }

  function kicker(ctx, th, str, y) {
    ctx.save();
    ctx.fillStyle = th.hot;
    ctx.beginPath(); ctx.moveTo(M + 8, y - 30); ctx.lineTo(M + 30, y - 30); ctx.lineTo(M + 22, y + 2); ctx.lineTo(M, y + 2); ctx.closePath(); ctx.fill();
    ctx.font = F(SANS, 800, 32); spacing(ctx, 5); ctx.fillStyle = th.hot;
    ctx.fillText(ellipsize(ctx, str, CW - 60), M + 50, y);
    ctx.restore();
  }

  // Big number with a small unit hugging it. Returns {size, end}.
  function bigStat(ctx, th, num, unit, y, max, o) {
    o = o || {};
    var width = o.width || CW, uSize = 0, uw = 0;
    if (unit) { ctx.font = F(DISPLAY, 800, Math.round(max * 0.32)); uw = ctx.measureText(unit).width + 24; }
    var s = dispSize(ctx, num, max, 90, width - uw);
    var x = o.x != null ? o.x : M - 6;
    var w = disp(ctx, num, x, y, s, o.color || th.hot);
    if (unit) { uSize = Math.round(s * 0.32); disp(ctx, unit, x + w + 22 + s * 0.05, y, uSize, o.unitColor || th.ink); }
    return { size: s, end: x + w };
  }

  // Stat tile.
  function tile(ctx, th, x, y, w, h, value, label, o) {
    o = o || {};
    ctx.save();
    rr(ctx, x, y, w, h, 18);
    ctx.fillStyle = o.fill || th.ink; ctx.globalAlpha = o.fill ? 1 : th.dark ? 0.1 : 0.12; ctx.fill();
    ctx.restore();
    var col = o.fill ? (o.ink || NAVY) : th.ink;
    var vs = dispSize(ctx, value, Math.min(88, h * 0.42), 40, w - 50);
    disp(ctx, value, x + 26, y + 26 + vs * 0.78, vs, o.valueColor || col);
    ctx.save(); ctx.font = F(SANS, 700, 27);
    var lines = wrap(ctx, label, w - 52, 2);
    ctx.restore();
    lines.forEach(function (l, i) { txt(ctx, l, x + 26, y + 26 + vs * 0.78 + 46 + i * 32, 27, col, { alpha: 0.85 }); });
  }
  function tiles(ctx, th, y, items, h, o) {
    var gap = 22, n = items.length, w = (CW - gap * (n - 1)) / n;
    items.forEach(function (it, i) { tile(ctx, th, M + i * (w + gap), y, w, h || 200, it[0], it[1], it[2] || o); });
  }

  function hbar(ctx, x, y, w, h, frac, col, bgCol, bgAlpha) {
    ctx.save();
    rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = bgCol; ctx.globalAlpha = bgAlpha == null ? 0.14 : bgAlpha; ctx.fill();
    ctx.globalAlpha = 1; rr(ctx, x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2); ctx.fillStyle = col; ctx.fill();
    ctx.restore();
  }

  // ---------- route drawing ----------
  function project(segs) {
    var lat0 = 0, n = 0;
    segs.forEach(function (s) { s.forEach(function (p) { lat0 += p[0]; n++; }); });
    lat0 /= n || 1;
    var k = Math.cos(lat0 * Math.PI / 180);
    return segs.map(function (s) { return s.map(function (p) { return [p[1] * k, -p[0]]; }); });
  }
  function drawSegs(ctx, segs, x, y, w, h, col, lw) {
    var ps = project(segs), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ps.forEach(function (s) { s.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }); });
    var bw = Math.max(x1 - x0, 1e-9), bh = Math.max(y1 - y0, 1e-9), sc = Math.min(w / bw, h / bh);
    var ox = x + (w - bw * sc) / 2 - x0 * sc, oy = y + (h - bh * sc) / 2 - y0 * sc;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ps.forEach(function (s) { ctx.beginPath(); s.forEach(function (p, i) { var X = ox + p[0] * sc, Y = oy + p[1] * sc; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke(); });
    ctx.restore();
  }

  // ---------- cards ----------
  function build(stats, info) {
    var s = stats, Y = s.year, u = U(info.units), key = (info.title || '') + Y;
    var cards = [];
    function add(id, label, theme, draw) { cards.push({ id: id, label: label, theme: theme, draw: draw }); }
    var km = s.dist / 1000, hasDist = s.distKnown > 0 && s.dist > 1000, hasElev = s.elev >= 150;

    // 1. intro
    add('intro', 'Your year in motion', 'navy', function (ctx, th) {
      kicker(ctx, th, Y + ' IN MOTION', 320);
      bigStat(ctx, th, fmt(s.count), null, 640, 330);
      disp(ctx, plural(s.count, 'ACTIVITY', 'ACTIVITIES'), M, 730, 84, th.ink, { spacing: 2 });
      var items = [[hrs(s.time), 'hours moving']];
      if (hasDist) items.push([fmtD(s.dist, u), u.d + ' covered']);
      if (hasElev) items.push([fmt(u.elev(s.elev)), u.e + ' climbed']);
      else items.push([fmt(s.activeDays), plural(s.activeDays, 'active day')]);
      tiles(ctx, th, 800, items, 200);
      // the year as a heat strip: two rows of half-years
      var top = 1110, cols = 27, cell = CW / cols, sq = cell - 5, rowH = cell * 7 + 62;
      var mx = Math.max.apply(null, s.dayMin) || 1;
      var more = s.prev && s.prev.count && s.count > s.prev.count ? ' \u00b7 ' + fmt(s.count - s.prev.count) + ' MORE THAN ' + (Y - 1) : '';
      txt(ctx, s.activeDays + ' ACTIVE ' + plural(s.activeDays, 'DAY', 'DAYS') + more, M, top - 30, 28, th.ink, { weight: 800, spacing: 3, alpha: 0.85, width: CW });
      for (var half = 0; half < 2; half++) {
        var start = half ? Date.UTC(Y, 6, 1) : Date.UTC(Y, 0, 1), end = half ? Date.UTC(Y + 1, 0, 1) : Date.UTC(Y, 6, 1);
        var dow0 = (new Date(start).getUTCDay() + 6) % 7, base = Math.round((start - Date.UTC(Y, 0, 1)) / 864e5);
        var y0 = top + half * rowH;
        for (var t = start, i = 0; t < end; t += 864e5, i++) {
          var col = Math.floor((i + dow0) / 7), row = (i + dow0) % 7;
          if (col >= cols) continue;
          var v = s.dayMin[base + i] || 0, x = M + col * cell, yy = y0 + row * cell;
          ctx.save(); rr(ctx, x, yy, sq, sq, 5);
          if (v > 0) { ctx.fillStyle = th.volt; ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, Math.sqrt(v / mx)); }
          else { ctx.fillStyle = th.ink; ctx.globalAlpha = 0.09; }
          ctx.fill(); ctx.restore();
          var dd = new Date(t);
          if (dd.getUTCDate() === 1) txt(ctx, MONTHS[dd.getUTCMonth()].toUpperCase(), x, y0 + 7 * cell + 34, 24, th.ink, { weight: 800, alpha: 0.7 });
        }
      }
    });

    // 2. distance
    if (hasDist) add('distance', 'Total distance', 'orange', function (ctx, th) {
      kicker(ctx, th, 'DISTANCE COVERED', 320);
      bigStat(ctx, th, fmtD(s.dist, u), u.d.toUpperCase(), 620, 330, { color: th.ink, unitColor: th.ink });
      // comparison
      var best = null;
      PAIRS.forEach(function (p) { var r = km / p.km; if (r >= 0.8 && r <= 1.6 && (!best || Math.abs(Math.log(r)) < Math.abs(Math.log(km / best.km)))) best = p; });
      var head, frac = 0, a = '', b = '';
      if (km >= 5000) { var e = km / EARTH_KM; head = e >= 1 ? 'That\u2019s ' + fmt1(e) + ' times around the Earth.' : 'That\u2019s ' + Math.round(e * 100) + '% of the way around the Earth.'; frac = Math.min(1, e % 1 || 1); a = 'Equator'; b = fmt(u.dist(EARTH_KM * 1000)) + ' ' + u.d; }
      else if (best) { var r = km / best.km; head = r < 1.12 && r > 0.9 ? 'About ' + best.a + ' to ' + best.b + '.' : r < 1 ? Math.round(r * 100) + '% of the way from ' + best.a + ' to ' + best.b + '.' : fmt1(r) + '\u00d7 ' + best.a + ' to ' + best.b + '.'; frac = Math.min(1, r); a = best.a; b = best.b; }
      else { var mar = km / 42.195; head = 'That\u2019s ' + fmt1(mar) + ' marathons, end to end.'; frac = Math.min(1, mar / Math.ceil(mar)); a = 'Start'; b = Math.ceil(mar) + ' marathons'; }
      var yh = block(ctx, head, 760, { display: true, max: 92, min: 56, lines: 2, color: th.ink, upper: true });
      // route line between two dots
      var ly = yh + 170, x0 = M + 24, x1 = W - M - 24;
      ctx.save();
      ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 8; ctx.setLineDash([2, 22]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, ly); ctx.lineTo(x1, ly); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1; ctx.strokeStyle = th.hot; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(x0, ly); ctx.lineTo(x0 + (x1 - x0) * frac, ly); ctx.stroke();
      [[x0, th.ink], [x1, th.ink], [x0 + (x1 - x0) * frac, th.hot]].forEach(function (p, i) { ctx.beginPath(); ctx.arc(p[0], ly, i === 2 ? 26 : 18, 0, Math.PI * 2); ctx.fillStyle = p[1]; ctx.fill(); });
      ctx.restore();
      txt(ctx, a.toUpperCase(), x0 - 24, ly + 70, 28, th.ink, { weight: 800, spacing: 2 });
      txt(ctx, b.toUpperCase(), x1 + 24, ly + 70, 28, th.ink, { weight: 800, spacing: 2, align: 'right' });
      // by sport
      var folded = hasElev && !cards.some(function (c) { return c.id === 'climb'; }), evs = s.elev / 8849, mrt = km / 42.195;
      var extra = folded ? (evs >= 0.5 ? 'PLUS ' + fmt1(evs) + '\u00d7 UP EVEREST' : 'PLUS ' + fmt(s.elev / 330) + ' EIFFEL TOWERS UP') : mrt >= 2 ? 'OR ' + fmt(mrt) + ' MARATHONS' : '';
      var sp = s.sports.filter(function (x) { return x.dist > 0; }).sort(function (a2, b2) { return b2.dist - a2.dist; }).slice(0, extra ? 3 : 4);
      var by = ly + 170, mxd = sp.length ? sp[0].dist : 1;
      txt(ctx, 'BY SPORT', M, by, 28, th.ink, { weight: 800, spacing: 4, alpha: 0.8 });
      sp.forEach(function (x, i) {
        var yy = by + 70 + i * 104;
        txt(ctx, x.label, M, yy, 40, th.ink, { weight: 800 });
        txt(ctx, fmtD(x.dist, u) + ' ' + u.d, W - M, yy, 40, th.ink, { weight: 800, align: 'right' });
        hbar(ctx, M, yy + 18, CW, 22, x.dist / mxd, th.ink, th.ink, 0.15);
      });
      if (extra) disp(ctx, extra, M, Math.min(by + 70 + sp.length * 104 + 50, H - 250), dispSize(ctx, extra, 64, 40, CW), th.ink);
    });

    // 3. climb
    if (hasElev) add('climb', 'Elevation gained', 'volt', function (ctx, th) {
      kicker(ctx, th, 'UP, UP AND UP', 320);
      bigStat(ctx, th, fmt(u.elev(s.elev)), u.e.toUpperCase(), 620, 300, { color: th.ink });
      var ev = s.elev / 8849, peak = PEAKS[0];
      if (ev < 0.6) peak = PEAKS.filter(function (p) { return s.elev / p[1] >= 1; })[0] || PEAKS[PEAKS.length - 1];
      var ratio = s.elev / peak[1];
      var head = peak[0] === 'Mount Everest' ? (ratio >= 1.05 || ratio < 0.95 ? fmt1(ratio) + ' times up Everest.' : 'One whole Everest.') : 'That\u2019s ' + fmt1(ratio) + ' ' + (ratio >= 1.5 && !/s$/.test(peak[0]) ? peak[0] + 's' : peak[0]) + '.';
      if (peak[0] === 'Kilimanjaro' || peak[0] === 'Mont Blanc' || peak[0] === 'Mount Fuji') head = fmt1(ratio) + ' times up ' + peak[0] + '.';
      var yh = block(ctx, head, 760, { display: true, max: 104, min: 60, lines: 2, color: th.ink, upper: true });
      // mountains: one per full peak, the last one clipped to the fraction
      var n = Math.min(10, Math.ceil(ratio - 1e-9)), base = 1390, mw = Math.min(300, CW / Math.max(1, n) * 1.6), step = n > 1 ? (CW - mw) / (n - 1) : 0;
      var mh = Math.min(420, mw * 1.1);
      for (var i = 0; i < n; i++) {
        var x = M + i * step + (n === 1 ? (CW - mw) / 2 : 0), f = i === n - 1 && ratio < 10 ? ratio - (n - 1) : 1;
        ctx.save();
        ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + mw * 0.5, base - mh); ctx.lineTo(x + mw, base); ctx.closePath();
        ctx.fillStyle = th.ink; ctx.globalAlpha = 0.16; ctx.fill();
        ctx.save(); ctx.clip(); ctx.globalAlpha = 1; ctx.fillStyle = i % 2 ? '#24346b' : NAVY; ctx.fillRect(x, base - mh * f, mw, mh * f); ctx.restore();
        // snow cap
        if (f >= 0.999) { ctx.beginPath(); ctx.moveTo(x + mw * 0.5, base - mh); ctx.lineTo(x + mw * 0.5 - mw * 0.11, base - mh * 0.78); ctx.lineTo(x + mw * 0.5, base - mh * 0.84); ctx.lineTo(x + mw * 0.5 + mw * 0.11, base - mh * 0.78); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 1; ctx.fill(); }
        ctx.restore();
      }
      if (ratio > 10) txt(ctx, '\u00d7' + fmt1(ratio), W - M, base - mh - 20, 44, th.ink, { weight: 800, align: 'right' });
      ctx.save(); ctx.fillStyle = th.ink; ctx.fillRect(M - 20, base, CW + 40, 8); ctx.restore();
      var items = [[fmt(s.elev / 330), 'Eiffel Towers'], [fmt(s.elev / 443), 'Empire State Buildings']];
      if (s.highest) items = [[fmt(u.elev(s.highest.elev)) + ' ' + u.e, 'biggest climb, ' + shortDate(s.highest.t)], items[0]];
      tiles(ctx, th, base + 70, items, 200, { fill: NAVY, ink: '#ffffff', valueColor: VOLT });
    });

    // 4. sport mix
    add('mix', 'Sport mix', 'navy', function (ctx, th) {
      var sp = s.sports.slice(0, 6), rest = s.sports.slice(6), tot = s.time || 1;
      if (rest.length) sp = sp.slice(0, 5).concat([{ key: 'other', label: 'Everything else', count: rest.concat(s.sports.slice(5, 6)).reduce(function (a, x) { return a + x.count; }, 0), time: rest.concat(s.sports.slice(5, 6)).reduce(function (a, x) { return a + x.time; }, 0) }]);
      kicker(ctx, th, 'YOUR SPORT MIX', 320);
      var top = sp[0], share = top.time / tot;
      var head = s.sports.length === 1 ? 'All ' + top.label.toLowerCase() + ', all year' : share >= 0.6 ? 'Mostly ' + (top.key === 'other' ? 'workouts' : top.noun) : sp.length >= 3 ? sp.slice(0, 3).map(function (x) { return x.label; }).join(', ') + '. Repeat.' : sp[0].label + ' and ' + sp[1].label.toLowerCase();
      var yh = block(ctx, head, 450, { display: true, max: 110, min: 64, lines: 2, color: th.ink, upper: true });
      // donut by time
      var cx = W / 2, cy = yh + 340, R = 260, r0 = 160, a0 = -Math.PI / 2;
      sp.forEach(function (x) {
        var a1 = a0 + Math.PI * 2 * x.time / tot;
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, a0 + 0.012, a1 - 0.012); ctx.arc(cx, cy, r0, a1 - 0.02, a0 + 0.02, true); ctx.closePath();
        ctx.fillStyle = SPORT_COL[x.key] || SPORT_COL.other; ctx.fill(); ctx.restore();
        a0 = a1;
      });
      disp(ctx, hrs(s.time), cx, cy + 20, 110, th.ink, { align: 'center' });
      txt(ctx, 'HOURS', cx, cy + 70, 30, th.ink, { weight: 800, spacing: 4, align: 'center', alpha: 0.75 });
      var ly = cy + R + 110, rowH = Math.min(90, (H - 240 - ly) / sp.length);
      sp.forEach(function (x, i) {
        var y = ly + i * rowH;
        ctx.save(); ctx.fillStyle = SPORT_COL[x.key] || SPORT_COL.other; rr(ctx, M, y - 30, 34, 34, 8); ctx.fill(); ctx.restore();
        txt(ctx, x.label, M + 56, y, 40, th.ink, { weight: 800, width: 420 });
        txt(ctx, hrs(x.time) + ' h \u00b7 ' + fmt(x.count) + '\u00d7', W - M - 130, y, 36, th.ink, { weight: 700, align: 'right', alpha: 0.85 });
        disp(ctx, Math.round(x.time / tot * 100) + '%', W - M, y, 48, th.volt, { align: 'right' });
      });
    });

    // 5. busiest month
    add('month', 'Busiest month', 'blue', function (ctx, th) {
      var pk = s.peakMonth, mo = s.months[pk];
      kicker(ctx, th, 'BUSIEST MONTH', 320);
      disp(ctx, MONTHS_LONG[pk].toUpperCase(), M - 6, 560, dispSize(ctx, MONTHS_LONG[pk].toUpperCase(), 230, 120, CW), th.hot);
      var line = hrs(mo.time) + ' hours across ' + mo.count + ' ' + plural(mo.count, 'activity', 'activities') + (mo.dist > 0 && hasDist ? ', ' + fmtD(mo.dist, u) + ' ' + u.d : '') + '.';
      var yl = block(ctx, line, 660, { max: 46, min: 34, lines: 2, color: th.ink });
      var top = yl + 120, ch = 1440 - top, bw = CW / 12, mx = Math.max.apply(null, s.months.map(function (m) { return m.time; })) || 1;
      s.months.forEach(function (m, i) {
        var h = m.time ? Math.max(14, (ch - 60) * m.time / mx) : 6, x = M + i * bw + bw * 0.12, w = bw * 0.76;
        ctx.save();
        ctx.beginPath(); ctx.moveTo(x + 10, top + ch - h); ctx.lineTo(x + w + 10, top + ch - h); ctx.lineTo(x + w, top + ch); ctx.lineTo(x, top + ch); ctx.closePath();
        ctx.fillStyle = i === pk ? th.hot : th.ink; ctx.globalAlpha = i === pk ? 1 : 0.35; ctx.fill(); ctx.restore();
        if (m.time && (i === pk || bw > 60)) txt(ctx, hrs(m.time), x + w / 2 + 5, top + ch - h - 16, i === pk ? 34 : 24, th.ink, { weight: 800, align: 'center', alpha: i === pk ? 1 : 0.75 });
        txt(ctx, MONTHS[i].charAt(0), x + w / 2, top + ch + 50, 30, th.ink, { weight: 800, align: 'center', alpha: i === pk ? 1 : 0.6 });
      });
      var quiet = s.months.map(function (m, i) { return [m.time, i]; }).filter(function (x) { return x[0] > 0 && x[1] < (s.monthsDone == null ? 12 : s.monthsDone); }).sort(function (a, b) { return a[0] - b[0]; })[0];
      var items = [[fmt(s.months.filter(function (m) { return m.count; }).length) + '/12', 'active months'], [hrs(s.time / Math.max(1, Math.min(12, (s.monthsDone || 12)))), 'hours a month']];
      if (quiet && quiet[1] !== pk) items.push([MONTHS[quiet[1]], 'quietest month']);
      tiles(ctx, th, 1530, items, 190);
    });

    // 6. longest effort
    var L = s.longest;
    if (L && (L.moving || L.elapsed)) add('longest', 'Longest effort', 'ink', function (ctx, th) {
      var d = L.moving || L.elapsed;
      kicker(ctx, th, 'THE LONGEST EFFORT', 320);
      bigStat(ctx, th, hms(d), null, 600, 280, { color: th.hot });
      var sp = (s.sports.filter(function (x) { return x.key === L.sport; })[0] || { label: 'Workout' }).label;
      var yh = block(ctx, sp + ' \u00b7 ' + dayName(L.t), 720, { display: true, max: 76, min: 48, lines: 2, color: th.ink, upper: true });
      // the day as a 24h track: when you started and finished
      var y = yh + 120, st = new Date(L.t), h0 = st.getUTCHours() + st.getUTCMinutes() / 60, h1 = h0 + (L.elapsed || d) / 3600;
      ctx.save(); rr(ctx, M, y, CW, 50, 25); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.12; ctx.fill(); ctx.restore();
      var xs = M + CW * h0 / 24, xe = M + CW * Math.min(24, h1) / 24;
      ctx.save(); rr(ctx, xs, y, Math.max(50, xe - xs), 50, 25); ctx.fillStyle = th.volt; ctx.fill(); ctx.restore();
      [0, 6, 12, 18, 24].forEach(function (h) { txt(ctx, h === 24 ? '' : hourLabel(h).toUpperCase(), M + CW * h / 24, y + 96, 24, th.ink, { weight: 800, alpha: 0.6, align: h === 0 ? 'left' : 'center' }); });
      txt(ctx, 'Started ' + hourLabel(st.getUTCHours()).replace(/^(\d+)/, '$1:' + ('0' + st.getUTCMinutes()).slice(-2)), M, y + 160, 36, th.ink, { weight: 700, alpha: 0.9 });
      var items = [];
      if (L.dist) items.push([fmtD(L.dist, u), u.d]);
      if (L.elev) items.push([fmt(u.elev(L.elev)), u.e + ' climbed']);
      if (L.dist && d) items.push(L.sport === 'run' || L.sport === 'walk' || L.sport === 'hike' ? [hms(u.pace(d / (L.dist / 1000))).replace(/^0:/, ''), 'per ' + u.d] : [fmt1(u.speed(L.dist / d)), u.sp]);
      if (!items.length) items.push([hm(d), 'of ' + sp.toLowerCase()]);
      tiles(ctx, th, y + 220, items.slice(0, 3), 200);
      var F2 = s.furthest;
      var ny = y + 480;
      if (F2 && F2 !== L) {
        ctx.save(); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.25; ctx.fillRect(M, ny - 70, CW, 3); ctx.restore();
        txt(ctx, 'FURTHEST', M, ny, 28, th.hot, { weight: 800, spacing: 4 });
        var fs = (s.sports.filter(function (x) { return x.key === F2.sport; })[0] || { label: 'Workout' }).label;
        disp(ctx, fmtD(F2.dist, u) + ' ' + u.d.toUpperCase(), M, ny + 100, 96, th.ink);
        txt(ctx, fs + ' \u00b7 ' + dayName(F2.t), M, ny + 160, 36, th.ink, { weight: 700, alpha: 0.85, width: CW });
      } else {
        var nxt = s.list.filter(function (a) { return a !== L; }).sort(function (a, b) { return (b.moving || b.elapsed || 0) - (a.moving || a.elapsed || 0); }).slice(0, 3);
        txt(ctx, nxt.length ? 'RUNNERS-UP' : pick(['Long days build big years.', 'That one earned a nap.'], key + 'L'), M, ny - 20, 28, th.hot, { weight: 800, spacing: 4 });
        nxt.forEach(function (a, i) {
          var yy = ny + 56 + i * 86, lab = (s.sports.filter(function (x) { return x.key === a.sport; })[0] || { label: 'Workout' }).label;
          disp(ctx, hms(a.moving || a.elapsed), M, yy, 64, th.ink);
          txt(ctx, lab + ' \u00b7 ' + shortDate(a.t) + (a.dist ? ' \u00b7 ' + fmtD(a.dist, u) + ' ' + u.d : ''), W - M, yy - 6, 32, th.ink, { weight: 700, align: 'right', alpha: 0.85 });
        });
      }
    });

    // 7. streaks
    if (s.streakDays.len >= 2 || s.streakWeeks.len >= 3) add('streak', 'Streaks', 'volt', function (ctx, th) {
      var sd = s.streakDays, sw = s.streakWeeks;
      kicker(ctx, th, 'STREAKS', 320);
      var dayFirst = sd.len >= 7 || sw.len < 4;
      var bigN = dayFirst ? sd.len : sw.len;
      bigStat(ctx, th, fmt(bigN), null, 640, 380, { color: th.ink });
      disp(ctx, (dayFirst ? plural(bigN, 'DAY', 'DAYS') : plural(bigN, 'WEEK', 'WEEKS')) + ' IN A ROW', M, 740, 92, th.ink);
      var j1 = Date.UTC(Y, 0, 1);
      var range = dayFirst ? shortDate(j1 + sd.start * 864e5) + ' \u2013 ' + shortDate(j1 + (sd.start + sd.len - 1) * 864e5) : 'Weeks ' + (sw.start + 1) + '\u2013' + (sw.start + sw.len) + ', a session in every one';
      txt(ctx, range, M, 820, 40, th.ink, { weight: 700, width: CW });
      // 53 week blocks
      var top = 930, n = s.weeks.length, cols = 9, cell = CW / cols, rows = Math.ceil(n / cols), bh = Math.min(70, (560 - (rows - 1) * 12) / rows);
      txt(ctx, 'YOUR WEEKS', M, top - 20, 26, th.ink, { weight: 800, spacing: 4, alpha: 0.75 });
      s.weeks.forEach(function (v, w) {
        var x = M + (w % cols) * cell, y = top + Math.floor(w / cols) * (bh + 12);
        var inStreak = w >= sw.start && w < sw.start + sw.len;
        ctx.save(); rr(ctx, x, y, cell - 12, bh, 10);
        if (w >= s.weeksElapsed) { ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.25; ctx.lineWidth = 2; ctx.stroke(); }
        else if (v > 0) { ctx.fillStyle = inStreak ? th.hot : NAVY; ctx.globalAlpha = inStreak ? 1 : 0.85; ctx.fill(); }
        else { ctx.fillStyle = th.ink; ctx.globalAlpha = 0.12; ctx.fill(); }
        ctx.restore();
      });
      var yb = top + rows * (bh + 12) + 40;
      ctx.save(); ctx.fillStyle = th.hot; rr(ctx, M, yb - 26, 30, 30, 6); ctx.fill(); ctx.restore();
      txt(ctx, 'longest run of active weeks: ' + sw.len, M + 46, yb, 30, th.ink, { weight: 700 });
      tiles(ctx, th, Math.max(yb + 60, 1520), [[fmt(sd.len), 'day streak, best'], [s.weeksActive + '/' + s.weeksElapsed, 'weeks with activity'], [fmt(s.activeDays), plural(s.activeDays, 'active day')]], 180, { fill: NAVY, ink: '#ffffff', valueColor: VOLT });
    });

    // 8. clock
    add('clock', s.todName, 'navy', function (ctx, th) {
      kicker(ctx, th, 'WHEN YOU MOVE', 320);
      var yh = block(ctx, s.todName, 470, { display: true, max: 150, min: 80, lines: 2, color: th.hot, upper: true });
      var yl = block(ctx, s.todLine, yh + 80, { max: 44, min: 32, lines: 2, color: th.ink });
      // 24h radial
      var cx = W / 2, cy = Math.min(yl + 400, 1130), R0 = 115, R1 = 290, mx = Math.max.apply(null, s.hours) || 1;
      ctx.save(); ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.15; ctx.lineWidth = 2;
      [R0, (R0 + R1) / 2, R1].forEach(function (r) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }); ctx.restore();
      for (var h = 0; h < 24; h++) {
        var a0 = -Math.PI / 2 + h / 24 * Math.PI * 2 + 0.02, a1 = a0 + Math.PI * 2 / 24 - 0.04, v = s.hours[h];
        if (!v) continue;
        var r = R0 + 16 + (R1 - R0 - 16) * Math.sqrt(v / mx);
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.arc(cx, cy, R0, a1, a0, true); ctx.closePath();
        ctx.fillStyle = h === s.peakHour ? th.hot : th.volt; ctx.globalAlpha = h === s.peakHour ? 1 : 0.85; ctx.fill(); ctx.restore();
      }
      [[0, 'MIDNIGHT'], [6, '6 AM'], [12, 'NOON'], [18, '6 PM']].forEach(function (p) {
        var a = -Math.PI / 2 + p[0] / 24 * Math.PI * 2, rx = cx + Math.cos(a) * (R1 + 56), ry = cy + Math.sin(a) * (R1 + 56) + 10;
        txt(ctx, p[1], rx, ry, 26, th.ink, { weight: 800, align: 'center', alpha: 0.75 });
      });
      disp(ctx, hourLabel(s.peakHour).toUpperCase(), cx, cy + 22, 64, th.ink, { align: 'center' });
      txt(ctx, 'favorite start', cx, cy + 62, 26, th.ink, { weight: 700, align: 'center', alpha: 0.7 });
      var tod = {}; s.tod.forEach(function (t) { tod[t.key] = t.share; });
      tiles(ctx, th, 1510, [[Math.round((tod.dawn + tod.morning) * 100) + '%', 'before 11 AM'], [Math.round((tod.evening + tod.night) * 100) + '%', 'after 5 PM'], [Math.round(s.weekendShare * 100) + '%', 'of hours on weekends']], 190);
    });

    // 9. PR-ish efforts (only when whole-activity data supports them)
    var prs = s.prs.filter(function (p) { return p.kind === 'run'; }).concat(s.prs.filter(function (p) { return p.kind === 'ride'; }));
    if (prs.length) add('prs', 'Fastest efforts', 'orange', function (ctx, th) {
      kicker(ctx, th, 'FASTEST EFFORTS', 320);
      var head = prs.length === 1 && prs[0].kind === 'ride' ? 'Need for speed' : 'Your quick ones';
      block(ctx, head, 470, { display: true, max: 130, min: 80, lines: 1, color: th.ink, upper: true });
      var rows = prs.slice(0, 4), y = 600, rowH = Math.min(330, (1600 - y) / rows.length);
      rows.forEach(function (p) {
        txt(ctx, (p.kind === 'run' ? p.label + '-ish run' : p.label).toUpperCase(), M, y + 40, 30, th.ink, { weight: 800, spacing: 3 });
        var big = p.kind === 'run' ? hms(p.act.moving || p.act.elapsed) : fmt1(u.speed(p.speed)) + ' ' + u.sp;
        disp(ctx, big, M - 4, y + 150, Math.min(120, rowH * 0.5), th.hot === '#ffffff' ? '#ffffff' : th.hot);
        var sub = p.kind === 'run' ? hms(u.pace(p.pace)).replace(/^0:/, '') + ' per ' + u.d + ' over ' + fmtD(p.act.dist, u) + ' ' + u.d : fmtD(p.act.dist, u) + ' ' + u.d + ' ride';
        txt(ctx, sub, M, y + 200, 34, th.ink, { weight: 700, width: CW * 0.68 });
        txt(ctx, shortDate(p.act.t), W - M, y + 200, 34, th.ink, { weight: 800, align: 'right' });
        if (rowH >= 300 && p.n >= 2) txt(ctx, 'Best of ' + p.n + ' ' + (p.kind === 'run' ? plural(p.n, 'run') + ' around this distance' : plural(p.n, 'ride') + ' of 20 km or more'), M, y + 246, 30, th.ink, { weight: 600, alpha: 0.8 });
        ctx.save(); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.25; ctx.fillRect(M, y + rowH - 22, CW, 3); ctx.restore();
        y += rowH;
      });
      block(ctx, 'From whole-activity averages, not split times, so a real race may have been quicker.', Math.max(y + 30, 1660), { max: 28, min: 24, lines: 2, color: th.ink, weight: 600, alpha: 0.8 });
    });

    // 10. route art
    var routes = info.hideRoutes ? [] : (s.tracks || []).map(function (tr) { return { tr: tr, segs: info.trim ? trimFn(tr.line, info.trim) : [tr.line] }; }).filter(function (x) { return x.segs.length; });
    if (routes.length >= 1) add('routes', 'Route art', 'ink', function (ctx, th) {
      var list = routes;
      if (list.length > 120) list = list.slice().sort(function (a, b) { return (b.tr.dist || 0) - (a.tr.dist || 0); }).slice(0, 120).sort(function (a, b) { return a.tr.t - b.tr.t; });
      kicker(ctx, th, 'EVERY ROUTE, ' + Y, 320);
      disp(ctx, fmt(routes.length) + ' ' + plural(routes.length, 'ROUTE', 'ROUTES'), M - 4, 450, dispSize(ctx, fmt(routes.length) + ' ROUTES', 120, 70, CW), th.ink);
      var top = 510, bottom = H - 300, n = list.length;
      var cols = Math.max(1, Math.ceil(Math.sqrt(n * CW / (bottom - top)))), rows = Math.ceil(n / cols);
      while (rows * (CW / cols) > bottom - top) { cols++; rows = Math.ceil(n / cols); }
      var cell = CW / cols, pad = Math.max(6, cell * 0.12), lw = Math.max(2, Math.min(7, cell / 34));
      var gy = top + (bottom - top - rows * cell) / 2;
      list.forEach(function (x, i) {
        var cxx = M + (i % cols) * cell, cyy = gy + Math.floor(i / cols) * cell;
        drawSegs(ctx, x.segs, cxx + pad, cyy + pad, cell - 2 * pad, cell - 2 * pad, SPORT_COL[x.tr.sport] || th.hot, lw);
      });
      var note = (info.trim ? '500 m around starts and finishes hidden' : 'Full routes shown') + ' \u00b7 no map';
      if (list.length < routes.length) note = 'Your ' + list.length + ' longest \u00b7 ' + note;
      txt(ctx, note, M, bottom + 50, 27, th.ink, { weight: 700, alpha: 0.7, width: CW });
    });

    // 11. personality
    add('persona', 'Sport personality', 'volt', function (ctx, th) {
      var p = s.personality;
      kicker(ctx, th, 'YOUR SPORT PERSONALITY', 320);
      var yn = block(ctx, p.name, 520, { display: true, max: 190, min: 96, lines: 2, color: th.ink, upper: true, lh: 0.98 });
      var yl = block(ctx, p.line, yn + 110, { max: 50, min: 36, lines: 2, color: th.ink });
      var ty = yl + 40;
      if (p.traits.length) {
        txt(ctx, 'WITH A STREAK OF', M, ty + 50, 28, th.ink, { weight: 800, spacing: 4, alpha: 0.8 });
        var x = M;
        p.traits.forEach(function (t) {
          ctx.save(); ctx.font = F(SANS, 800, 40); var w = ctx.measureText(t).width + 56; ctx.restore();
          ctx.save(); rr(ctx, x, ty + 80, w, 72, 36); ctx.fillStyle = NAVY; ctx.fill(); ctx.restore();
          txt(ctx, t, x + 28, ty + 130, 40, '#ffffff', { weight: 800 });
          x += w + 18;
        });
        ty += 170;
      }
      var gy = Math.max(ty + 70, 1080), gw = (CW - 22) / 2, gh = 210;
      var top = s.sports[0];
      var t4 = [[fmt(s.count), plural(s.count, 'activity', 'activities')], [hrs(s.time), 'hours'], [top.label, 'top sport, ' + Math.round(top.time / (s.time || 1) * 100) + '% of time'],
        hasDist ? [fmtD(s.dist, u), u.d + ' total'] : [fmt(s.streakDays.len), 'day streak']];
      t4.forEach(function (t, i) { tile(ctx, th, M + (i % 2) * (gw + 22), gy + Math.floor(i / 2) * (gh + 22), gw, gh, t[0], t[1], { fill: NAVY, ink: '#ffffff', valueColor: i === 0 ? ORANGE : VOLT }); });
    });

    // Keep the deck at 10 cards or fewer.
    var dropOrder = ['climb', 'prs', 'streak'];
    while (cards.length > 10 && dropOrder.length) { var id = dropOrder.shift(); cards = cards.filter(function (c) { return c.id !== id; }); }
    return cards;
  }

  var trimFn = function (line, m) { return root.SportStats ? root.SportStats.trimLine(line, m) : [line]; };

  function render(canvas, card, stats, info, idx, total) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    var th = T[card.theme] || T.navy;
    background(ctx, th, (info.title || '') + card.id);
    card.draw(ctx, th);
    var t = Object.assign({}, info, { title: footerTitle(ctx, th, info) });
    chrome(ctx, th, t, idx, total);
  }
  function chrome(ctx, th, info, idx, total) {
    ctx.save();
    disp(ctx, 'YEAR IN MOTION', M, 150, 44, th.ink, { spacing: 3 });
    ctx.fillStyle = th.hot; ctx.beginPath(); ctx.moveTo(M, 170); ctx.lineTo(M + 120, 170); ctx.lineTo(M + 114, 178); ctx.lineTo(M - 6, 178); ctx.closePath(); ctx.fill();
    ctx.font = F(DISPLAY, 800, 52);
    var yw = ctx.measureText(info.periodShort).width + 56, bx = W - M - yw, by = 98;
    ctx.beginPath(); ctx.moveTo(bx + 14, by); ctx.lineTo(bx + yw + 14, by); ctx.lineTo(bx + yw - 6, by + 72); ctx.lineTo(bx - 6, by + 72); ctx.closePath();
    ctx.fillStyle = th.hot; ctx.fill();
    disp(ctx, info.periodShort, bx + yw / 2 + 4, by + 56, 52, th.dark || th.hot === '#ffffff' ? NAVY : '#ffffff', { align: 'center', spacing: 1 });
    ctx.fillStyle = th.ink; ctx.globalAlpha = 0.25; ctx.fillRect(M, H - 196, CW, 3); ctx.globalAlpha = 1;
    disp(ctx, info.title, M, H - 130, 40, th.ink, { spacing: 1 });
    txt(ctx, 'Make yours: ' + SITE, M, H - 82, 27, th.ink, { weight: 700, alpha: 0.9 });
    disp(ctx, idx + '/' + total, W - M, H - 130, 40, th.ink, { align: 'right' });
    txt(ctx, 'free \u00b7 no upload', W - M, H - 82, 25, th.ink, { weight: 600, alpha: 0.7, align: 'right' });
    ctx.restore();
  }

  var api = { build: build, render: render, W: W, H: H, THEMES: T, PAIRS: PAIRS, SPORT_COL: SPORT_COL, U: U, hms: hms };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SportCards = api;
})(typeof self !== 'undefined' ? self : this);
