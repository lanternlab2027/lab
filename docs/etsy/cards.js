/* Year in Review for Etsy sellers: 1080x1920 card renderer (canvas). Same engine as docs/amazon/cards.js with a
 * "sewn label" look of its own (linen, indigo, sage, clay). No marketplace logos or brand colors.
 * Money is only drawn when info.showRevenue is true; listing titles only when info.showNames is true.
 * Nothing about a buyer is ever drawn: regions are counts, repeat buyers a share. */
(function (root) {
  'use strict';

  var W = 1080, H = 1920, M = 104, CW = W - 2 * M;
  var DISPLAY = '"Avenir Next Condensed", "Arial Narrow", "Roboto Condensed", "DejaVu Sans Condensed", "Helvetica Neue", Inter, Arial, sans-serif';
  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';
  var SERIF = 'Georgia, "Iowan Old Style", Cambria, Caladea, "DejaVu Serif", serif';
  var MONO = '"SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", "Courier New", monospace';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var STATE_NAMES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'Washington, DC', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico' };
  var SITE = 'lanternlab2027.github.io/lab/etsy';

  var T = {
    linen:  { bg: ['#f4efe6', '#e4d9c6'], ink: '#2a2320', accent: '#2f6f62', soft: '#8a5a9e', dark: false },
    indigo: { bg: ['#1f2b4d', '#0e1630'], ink: '#f2ede4', accent: '#f2c14e', soft: '#9ad1c3', dark: true },
    sage:   { bg: ['#dfe8d8', '#bfd0b3'], ink: '#1f2a1c', accent: '#6a3d6e', soft: '#2f6f62', dark: false },
    clay:   { bg: ['#f1dcd6', '#dcb9ae'], ink: '#2c1b1a', accent: '#2f4d8a', soft: '#8c3b4a', dark: false },
    forest: { bg: ['#1d3a32', '#0c1d18'], ink: '#eef4ee', accent: '#f2c14e', soft: '#e6a5b5', dark: true },
    plum:   { bg: ['#3b2147', '#1b0e22'], ink: '#f7edf5', accent: '#9ad1c3', soft: '#f2c14e', dark: true }
  };

  function F(kind, weight, size, italic) { return (italic ? 'italic ' : '') + weight + ' ' + size + 'px ' + (kind === 'display' ? DISPLAY : kind === 'serif' ? SERIF : kind === 'mono' ? MONO : SANS); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, ''); }
  function money(n, cur, cents) {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(n); }
    catch (e) { return (cur || '') + ' ' + (cents ? n.toFixed(2) : fmt(n)); }
  }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pick(arr, key) { return arr[hash(key) % arr.length]; }
  function rngFrom(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function spacing(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }
  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }
  function dayDate(day) { var d = new Date(day * 86400000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: (d.getUTCDay() + 6) % 7 }; }

  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function ellipsize(ctx, text, width) {
    text = String(text);
    if (ctx.measureText(text).width <= width) return text;
    var chars = Array.from(text);
    while (chars.length > 1 && ctx.measureText(chars.join('') + '\u2026').width > width) chars.pop();
    return chars.join('').trim() + '\u2026';
  }
  function wrap(ctx, text, width, maxLines, raw) {
    var words = String(text).split(/\s+/).filter(Boolean), lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > width && line) { lines.push(line); line = words[i]; } else line = test;
    }
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = ellipsize(ctx, lines[maxLines - 1] + ' \u2026', width); }
    return raw ? lines : lines.map(function (l) { return ellipsize(ctx, l, width); });
  }
  function fitWrap(ctx, text, kind, weight, max, min, width, maxLines, italic) {
    var size = max, lines;
    for (;;) {
      ctx.font = F(kind, weight, size, italic);
      lines = wrap(ctx, text, width, 0, true);
      var ok = lines.length <= maxLines && lines.every(function (l) { return ctx.measureText(l).width <= width; });
      if (ok || size <= min) break;
      size -= 4;
    }
    ctx.font = F(kind, weight, size, italic);
    return { size: size, lines: wrap(ctx, text, width, maxLines) };
  }
  function fitSize(ctx, text, kind, weight, max, min, width) {
    var s = max; ctx.font = F(kind, weight, s);
    while (s > min && ctx.measureText(text).width > width) { s -= 4; ctx.font = F(kind, weight, s); }
    return s;
  }
  function txt(ctx, th, str, x, y, kind, weight, size, o) {
    o = o || {};
    ctx.save();
    ctx.font = F(kind, weight, size, o.italic); ctx.fillStyle = o.color || th.ink;
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; ctx.textAlign = o.align || 'left';
    if (o.spacing) spacing(ctx, o.spacing);
    ctx.fillText(o.width ? ellipsize(ctx, str, o.width) : str, x, y);
    ctx.restore();
  }
  function block(ctx, th, str, y, o) {
    o = o || {};
    ctx.save();
    var f = fitWrap(ctx, str, o.kind || 'display', o.weight || 800, o.max || 110, o.min || 56, o.width || CW, o.lines || 3, o.italic);
    ctx.fillStyle = o.color || th.ink; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; ctx.textAlign = o.align || 'left';
    var x = o.x != null ? o.x : (o.align === 'center' ? W / 2 : M), lh = f.size * (o.lh || 1.04);
    f.lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * lh); });
    ctx.restore();
    return y + (f.lines.length - 1) * lh;
  }
  function quip(ctx, th, str, y, o) {
    o = o || {};
    return block(ctx, th, str, y, { kind: 'serif', weight: 400, italic: true, max: o.max || 46, min: 34, lines: o.lines || 2, alpha: 0.88, align: o.align, width: o.width });
  }

  // ---------- frame ----------
  function background(ctx, th, seedKey) {
    var g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var r = rngFrom(hash(seedKey));
    // woven linen texture: faint crossing threads
    ctx.save(); ctx.strokeStyle = th.ink; ctx.lineWidth = 1;
    for (var y = 0; y < H; y += 6) { ctx.globalAlpha = (th.dark ? 0.025 : 0.03) + r() * 0.02; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (var x = 0; x < W; x += 6) { ctx.globalAlpha = (th.dark ? 0.02 : 0.025) + r() * 0.02; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.restore();
    // sewn edge: a dashed stitch line inset from the border
    ctx.save(); ctx.strokeStyle = th.ink; ctx.globalAlpha = th.dark ? 0.3 : 0.28; ctx.lineWidth = 4; ctx.setLineDash([22, 14]);
    rr(ctx, 36, 36, W - 72, H - 72, 30); ctx.stroke(); ctx.restore();
    // a few spools of thread in a corner
    ctx.save();
    for (var i = 0; i < 3; i++) {
      var cx = W - 150 - i * 40 + r() * 30, cy = 560 + i * 560 + r() * 80, rad = 70 + r() * 40;
      ctx.globalAlpha = th.dark ? 0.07 : 0.08; ctx.fillStyle = th.ink;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = th.dark ? 0.08 : 0.09; ctx.strokeStyle = th.ink; ctx.lineWidth = 3;
      for (var k = 1; k < 5; k++) { ctx.beginPath(); ctx.arc(cx, cy, rad * k / 5, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore();
  }

  function tagIcon(ctx, x, y, s, fill, hole) {
    ctx.save(); ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(x + s * 0.32, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + s * 0.7); ctx.lineTo(x + s * 0.32, y + s * 0.7); ctx.lineTo(x, y + s * 0.35); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hole; ctx.beginPath(); ctx.arc(x + s * 0.3, y + s * 0.35, s * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function chrome(ctx, th, info, idx, total) {
    ctx.save();
    tagIcon(ctx, M, 108, 46, th.accent, th.dark ? th.bg[1] : '#ffffff');
    ctx.fillStyle = th.ink; ctx.font = F('sans', 800, 26); spacing(ctx, 7); ctx.globalAlpha = 0.9;
    ctx.fillText('SHOP YEAR IN REVIEW', M + 64, 139);
    spacing(ctx, 0);
    ctx.font = F('display', 800, 38);
    var p = info.periodShort, pw = ctx.measureText(p).width + 60, px = W - M - pw;
    ctx.globalAlpha = 1; ctx.fillStyle = th.accent; rr(ctx, px, 96, pw, 62, 31); ctx.fill();
    ctx.fillStyle = th.dark ? '#14110b' : '#ffffff'; ctx.textAlign = 'center'; ctx.fillText(p, px + pw / 2, 141);
    ctx.textAlign = 'left'; ctx.fillStyle = th.ink; ctx.globalAlpha = 0.95;
    ctx.font = F('display', 800, 38);
    ctx.fillText(ellipsize(ctx, info.title, 640), M, H - 128);
    ctx.font = F('sans', 700, 25); ctx.globalAlpha = 0.85;
    var mk = 'Make yours: ' + SITE;
    ctx.fillText(mk, M, H - 86);
    var mw = ctx.measureText(mk).width;
    ctx.textAlign = 'right'; ctx.font = F('sans', 800, 30); ctx.globalAlpha = 0.9;
    ctx.fillText(idx + ' / ' + total, W - M, H - 128);
    ctx.font = F('sans', 600, 25); ctx.globalAlpha = 0.72;
    if (mw + ctx.measureText('made on-device').width + 32 <= CW) ctx.fillText('made on-device', W - M, H - 86);
    ctx.restore();
  }

  function kicker(ctx, th, str, y) {
    ctx.save();
    ctx.strokeStyle = th.accent; ctx.lineWidth = 6; ctx.setLineDash([12, 8]);
    ctx.beginPath(); ctx.moveTo(M, y - 10); ctx.lineTo(M + 56, y - 10); ctx.stroke();
    ctx.fillStyle = th.ink; ctx.font = F('sans', 800, 32); spacing(ctx, 6);
    ctx.fillText(ellipsize(ctx, str, CW - 80), M + 76, y);
    ctx.restore();
  }
  function bigNumber(ctx, th, num, y, max, o) {
    o = o || {};
    ctx.save();
    var size = fitSize(ctx, num, 'display', 800, max || 300, 90, o.width || CW);
    ctx.fillStyle = o.color || th.accent; spacing(ctx, -2); ctx.textAlign = o.align || 'left';
    ctx.fillText(num, o.x != null ? o.x : M - 4, y);
    var w = ctx.measureText(num).width;
    ctx.restore();
    return { size: size, width: w };
  }
  function chip(ctx, th, x, y, w, h, value, label) {
    ctx.save();
    rr(ctx, x, y, w, h, 22);
    ctx.fillStyle = th.ink; ctx.globalAlpha = th.dark ? 0.09 : 0.07; ctx.fill();
    ctx.globalAlpha = 0.35; ctx.strokeStyle = th.ink; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1; ctx.fillStyle = th.ink;
    var vs = fitSize(ctx, value, 'display', 800, 80, 36, w - 48), base = y + 26 + vs * 0.8;
    ctx.fillText(value, x + 24, base);
    ctx.font = F('sans', 700, 26); ctx.globalAlpha = 0.8;
    wrap(ctx, label, w - 48, 2).forEach(function (l, i) { ctx.fillText(l, x + 24, base + 44 + i * 32); });
    ctx.restore();
  }
  function chipRow(ctx, th, y, items, h) {
    var gap = 20, n = items.length, w = (CW - gap * (n - 1)) / n;
    items.forEach(function (it, i) { chip(ctx, th, M + i * (w + gap), y, w, h || 190, it[0], it[1]); });
  }
  function bars(ctx, th, x, top, w, h, vals, labels, highlight, o) {
    o = o || {};
    var n = vals.length, bw = w / n, mx = Math.max.apply(null, vals) || 1;
    ctx.save();
    vals.forEach(function (v, i) {
      var bh = v ? Math.max(12, (h - 56) * v / mx) : 6, bx = x + i * bw + bw * 0.13, bwid = bw * 0.74, hi = highlight.indexOf(i) >= 0;
      rr(ctx, bx, top + h - bh, bwid, bh, Math.min(10, bwid / 2));
      ctx.fillStyle = hi ? th.accent : th.soft; ctx.globalAlpha = hi ? 1 : 0.55; ctx.fill(); ctx.globalAlpha = 1;
      if (v && o.values !== false) { ctx.font = F('display', 800, o.valueSize || 32); ctx.fillStyle = th.ink; ctx.textAlign = 'center'; ctx.fillText(o.fmt ? o.fmt(v) : fmt(v), bx + bwid / 2, top + h - bh - 14); }
      ctx.font = F('sans', 800, o.labelSize || 28); ctx.fillStyle = th.ink; ctx.globalAlpha = hi ? 1 : 0.7; ctx.textAlign = 'center';
      ctx.fillText(labels[i], bx + bwid / 2, top + h + 44); ctx.globalAlpha = 1;
    });
    ctx.restore();
    ctx.save(); ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, top + h + 2); ctx.lineTo(x + w, top + h + 2); ctx.stroke(); ctx.restore();
  }
  function redacted(ctx, th, x, y, w, size, label, color) {
    ctx.save();
    var h = size * 0.82;
    ctx.fillStyle = color || th.ink; ctx.globalAlpha = 0.88;
    rr(ctx, x, y - h * 0.82, w, h, 6); ctx.fill();
    if (label) {
      ctx.globalAlpha = 1; ctx.fillStyle = th.dark && !color ? th.bg[1] : '#ffffff';
      ctx.font = F('sans', 800, Math.round(size * 0.42)); spacing(ctx, 4);
      ctx.fillText(label, x + 20, y - h * 0.82 + h / 2 + size * 0.15);
    }
    ctx.restore();
  }
  // A hang tag (the kind tied to a handmade item) for the summary card. Returns the inner area.
  function hangTag(ctx, x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(20,20,40,0.28)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#fbf6ea';
    ctx.beginPath(); ctx.moveTo(x + 90, y); ctx.lineTo(x + w - 90, y); ctx.lineTo(x + w, y + 90); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + 90); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#d8ccb4'; ctx.beginPath(); ctx.arc(x + w / 2, y + 60, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a2320'; ctx.globalAlpha = 0.25; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
    ctx.beginPath(); ctx.moveTo(x + 100, y + 24); ctx.lineTo(x + w - 100, y + 24); ctx.lineTo(x + w - 24, y + 100); ctx.lineTo(x + w - 24, y + h - 24); ctx.lineTo(x + 24, y + h - 24); ctx.lineTo(x + 24, y + 100); ctx.closePath(); ctx.stroke();
    // string
    ctx.globalAlpha = 0.6; ctx.setLineDash([]); ctx.lineWidth = 4; ctx.strokeStyle = '#7a6a55';
    ctx.beginPath(); ctx.moveTo(x + w / 2, y + 60); ctx.bezierCurveTo(x + w / 2 + 40, y - 60, x + w / 2 + 160, y - 40, x + w / 2 + 220, y - 110); ctx.stroke();
    ctx.restore();
    return { x: x + 64, y: y + 150, w: w - 128 };
  }
  var TAGINK = { bg: ['#fbf6ea', '#fbf6ea'], ink: '#2a2320', accent: '#2f6f62', soft: '#8a5a9e', dark: false };

  function placeName(s, which) { return which === 'state' ? (STATE_NAMES[s] || s) : s; }

  // ---------- cards ----------
  // info: { title, year, periodShort, showRevenue, showNames, handmade }
  function build(stats, info) {
    var s = stats, Y = info.year, key = (info.title || '') + (Y || 'all'), C = s.currency;
    var names = !!info.showNames, rev = !!info.showRevenue;
    var cards = [];
    function add(id, label, theme, draw) { cards.push({ id: id, label: label, theme: theme, draw: draw }); }
    function $(n, cents) { return money(n, C, cents); }

    add('year', 'Orders this year', 'linen', function (ctx, th) {
      kicker(ctx, th, Y ? 'YOUR SHOP IN ' + Y : 'YOUR SHOP, ALL TIME', 300);
      bigNumber(ctx, th, fmt(s.orderCount), 640, 330);
      txt(ctx, th, plural(s.orderCount, 'order') + (Y ? ' in ' + Y : ''), M, 760, 'display', 800, 96);
      var y = 760;
      var q;
      if (Y && s.prevOrders) {
        var d = s.orderCount - s.prevOrders, pct = Math.round(Math.abs(d) / s.prevOrders * 100);
        q = pct < 3 ? 'About the same as ' + (Y - 1) + '. Steady hands.' : d > 0 ? pct + '% more orders than ' + (Y - 1) + '. Busy bench.' : pct + '% fewer than ' + (Y - 1) + ', and every one still went out the door.';
      } else q = pick(['Every one of them packed by hand.', 'Somewhere, a box with your tape on it.', 'One sale at a time, all year.'], key + 'q');
      y = quip(ctx, th, q, y + 110, { max: 48 });
      var chips = [[fmt(s.itemCount), plural(s.itemCount, 'item') + ' sold']];
      if (rev) chips.push([$(s.revenue), 'in sales' + (s.refunds ? ', after refunds' : '')]);
      else if (s.hasItems && s.listingCount) chips.push([fmt(s.listingCount), plural(s.listingCount, 'different listing') + ' sold']);
      chips.push([fmt(s.activeDays), plural(s.activeDays, 'day') + ' with a sale']);
      var chy = Math.max(y + 110, 1080);
      chipRow(ctx, th, chy, chips, 210);
      var ny = chy + 300;
      if (Y && s.firstYear && s.firstYear < Y) { txt(ctx, th, 'Selling since at least ' + s.firstYear + '.', M, ny, 'sans', 800, 32, { color: th.accent, width: CW }); ny += 70; }
      if (Y && ny + 300 < 1760) {
        txt(ctx, th, 'ORDERS BY MONTH', M, ny, 'sans', 800, 26, { spacing: 5, alpha: 0.7 });
        bars(ctx, th, M, ny + 20, CW, 200, s.monthOrders, MONTHS.map(function (m) { return m.charAt(0); }), [s.peakMonth], { values: false, labelSize: 24 });
      }
    });

    if (s.best && s.best.length) add('best', 'Best seller', 'sage', function (ctx, th) {
      var b = s.best[0];
      kicker(ctx, th, 'YOUR BEST SELLER', 300);
      var y = 440;
      if (names) y = block(ctx, th, b.name, y, { max: 104, min: 56, lines: 3 }) + 40;
      else { redacted(ctx, th, M, y, CW * 0.86, 96, 'LISTING NAME HIDDEN', th.accent); redacted(ctx, th, M, y + 110, CW * 0.5, 96, '', th.accent); y += 170; }
      var bn = bigNumber(ctx, th, fmt(b.qty), y + 240, 260, { width: 520 });
      txt(ctx, th, 'sold', M + bn.width + 28, y + 150, 'display', 800, 76);
      txt(ctx, th, 'in ' + fmt(b.orderCount) + ' ' + plural(b.orderCount, 'order'), M + bn.width + 28, y + 230, 'display', 800, 56, { alpha: 0.75 });
      var share = s.itemCount ? Math.round(b.qty / s.itemCount * 100) : 0;
      y = quip(ctx, th, share >= 30 ? 'Nearly a third of everything you sold. The people have spoken.' : share >= 15 ? share + '% of everything you sold. A crowd favorite.' : 'Your top listing, out of ' + fmt(s.listingCount) + ' that sold.', y + 340, { max: 44 });
      var rest = s.best.slice(1, 4), ry = y + 110;
      if (rest.length && ry + rest.length * 96 < 1720) {
        txt(ctx, th, 'ALSO FLYING OFF THE SHELF', M, ry, 'sans', 800, 28, { spacing: 5, alpha: 0.7 });
        rest.forEach(function (e, i) {
          var yy = ry + 80 + i * 96;
          txt(ctx, th, fmt(e.qty) + '\u00d7', W - M, yy, 'display', 800, 52, { align: 'right', color: th.accent });
          if (names) txt(ctx, th, (i + 2) + '. ' + e.name, M, yy, 'sans', 700, 38, { width: CW - 180 });
          else { txt(ctx, th, (i + 2) + '.', M, yy, 'sans', 800, 38); redacted(ctx, th, M + 56, yy + 4, 260 + (hash(e.name) % 300), 44, '', th.ink); }
        });
      }
      if (rev) txt(ctx, th, $(b.total) + ' from this one listing.', M, 1740, 'sans', 700, 30, { alpha: 0.8, width: CW });
    });

    if (s.peakMonth >= 0) add('month', 'Busiest month', 'indigo', function (ctx, th) {
      kicker(ctx, th, 'WHEN THE ORDERS CAME IN', 300);
      var vals, labels, head, peaks;
      if (Y) {
        vals = s.monthOrders; labels = MONTHS.map(function (m) { return m.charAt(0); }); peaks = [s.peakMonth];
        head = MONTHS_LONG[s.peakMonth] + ' was your busiest month';
      } else {
        var ys = Object.keys(s.byYear).map(Number).sort(function (a, b) { return a - b; }).slice(-10);
        vals = ys.map(function (y) { return s.byYear[y]; }); labels = ys.map(function (y) { return '\u2019' + String(y).slice(2); });
        peaks = [vals.indexOf(Math.max.apply(null, vals))];
        head = ys[peaks[0]] + ' was your busiest year';
      }
      var yh = block(ctx, th, head, 430, { max: 96, min: 56, lines: 2 });
      var pv = vals[peaks[0]];
      txt(ctx, th, fmt(pv) + ' ' + plural(pv, 'order') + (Y && rev ? ', ' + $(s.monthSales[s.peakMonth]) + ' in sales' : '') + '.', M, yh + 76, 'serif', 400, 46, { italic: true, alpha: 0.88, width: CW });
      var ctop = yh + 150;
      bars(ctx, th, M, ctop, CW, 560, vals, labels, peaks, { valueSize: 28 });
      var q = Y ? (s.peakMonth >= 10 ? 'Holiday season: the glue gun never cooled.' : s.peakMonth <= 1 ? 'A busy start to the year. Gift cards, perhaps.' : 'Your busy season did not wait for December.') : 'Look at that growth.';
      quip(ctx, th, q, ctop + 700, { max: 44 });
      if (Y) {
        var quiet = s.monthOrders.indexOf(Math.min.apply(null, s.monthOrders.filter(function (v, i) { return v > 0 || i < s.peakMonth; })));
        if (quiet >= 0 && ctop + 840 < 1740) txt(ctx, th, 'Quietest: ' + MONTHS_LONG[quiet] + ' (' + fmt(s.monthOrders[quiet]) + ').', M, ctop + 840, 'sans', 700, 32, { alpha: 0.75 });
      }
    });

    if (s.busiestDay) add('day', 'Busiest day', 'clay', function (ctx, th) {
      kicker(ctx, th, 'YOUR BUSIEST DAY', 300);
      var bd = dayDate(s.busiestDay.day);
      var yh = block(ctx, th, DAYS[bd.wd] + ', ' + MONTHS_LONG[bd.mo - 1] + ' ' + bd.d + (Y ? '' : ', ' + bd.y), 440, { max: 100, min: 60, lines: 2, color: th.accent });
      txt(ctx, th, fmt(s.busiestDay.orders) + ' ' + plural(s.busiestDay.orders, 'order') + ' in a single day.', M, yh + 84, 'serif', 400, 48, { italic: true, alpha: 0.88, width: CW });
      var ctop = yh + 190;
      txt(ctx, th, 'ORDERS BY DAY OF THE WEEK', M, ctop, 'sans', 800, 28, { spacing: 5, alpha: 0.7 });
      bars(ctx, th, M, ctop + 40, CW, 520, s.weekdays, DAYS.map(function (d) { return d.slice(0, 3); }), [s.peakWeekday], { valueSize: 34, labelSize: 30 });
      var wd = s.peakWeekday;
      block(ctx, th, DAYS[wd] + 's were your best day', ctop + 720, { max: 72, min: 48, lines: 1 });
      var share = s.orderCount ? Math.round(s.weekdays[wd] / s.orderCount * 100) : 0;
      quip(ctx, th, share + '% of your orders landed on a ' + DAYS[wd] + '.' + (wd >= 5 ? ' Weekend browsers, weekday packing.' : ''), ctop + 820, { max: 42 });
    });

    if (s.located >= 5 && s.home) add('where', 'Where buyers are', 'forest', function (ctx, th) {
      kicker(ctx, th, 'WHERE YOUR ORDERS WENT', 300);
      var useState = s.states.length >= 2 && s.states[0].orders >= 3;
      var top = useState ? s.states : s.countries, which = useState ? 'state' : 'country';
      var lead = top[0];
      var yh = block(ctx, th, 'Top ' + which + ': ' + placeName(lead.name, which), 440, { max: 96, min: 56, lines: 2 });
      var tot = useState ? s.states.reduce(function (a, x) { return a + x.orders; }, 0) : s.located;
      txt(ctx, th, Math.round(lead.orders / tot * 100) + '% of ' + (useState ? 'your US orders' : 'your orders') + ' shipped there.', M, yh + 76, 'serif', 400, 44, { italic: true, alpha: 0.88, width: CW });
      var list = top.slice(0, 5), mx = list[0].orders, y = yh + 190;
      list.forEach(function (c, i) {
        var yy = y + i * 150;
        txt(ctx, th, placeName(c.name, which), M, yy, 'display', 800, 50, { width: CW - 220, color: i === 0 ? th.accent : th.ink });
        txt(ctx, th, fmt(c.orders), W - M, yy, 'display', 800, 50, { align: 'right' });
        ctx.save(); rr(ctx, M, yy + 26, CW, 30, 15); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.12; ctx.fill();
        rr(ctx, M, yy + 26, Math.max(30, CW * c.orders / mx), 30, 15); ctx.globalAlpha = 1; ctx.fillStyle = i === 0 ? th.accent : th.soft; ctx.fill(); ctx.restore();
      });
      var cy = y + list.length * 150 + 40, chips = [];
      if (s.states.length) chips.push([fmt(s.states.length), plural(s.states.length, 'US state')]);
      chips.push([fmt(s.countries.length), plural(s.countries.length, 'country', 'countries')]);
      if (s.intl) chips.push([fmt(s.intl), 'shipped outside ' + (s.home === 'United States' ? 'the US' : s.home)]);
      if (cy + 196 < 1760) chipRow(ctx, th, cy, chips, 196);
    });

    if (s.repeat && s.repeat.buyers >= 5) add('repeat', 'Repeat buyers', 'plum', function (ctx, th) {
      var R = s.repeat, pct = Math.round(R.share * 100);
      kicker(ctx, th, 'THEY CAME BACK', 300);
      var bn = bigNumber(ctx, th, pct + '%', 640, 330, { width: 640 });
      txt(ctx, th, 'of your buyers', M, 760, 'display', 800, 80);
      txt(ctx, th, 'ordered again', M, 850, 'display', 800, 80, { alpha: 0.8 });
      // a row of 20 little tags, the repeat share filled in
      var n = 20, on = Math.round(R.share * n), gx = CW / 10;
      for (var i = 0; i < n; i++) tagIcon(ctx, M + (i % 10) * gx + 6, 960 + Math.floor(i / 10) * 110, 72, i < on ? th.accent : (th.dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'), th.bg[1]);
      quip(ctx, th, pct >= 25 ? 'Regulars. Every maker\u2019s favorite word.' : pct >= 10 ? 'Some of them could not stop at one.' : 'First-timers, mostly. Plenty of new fans.', 1260, { max: 46 });
      chipRow(ctx, th, 1400, [[fmt(R.repeatBuyers), 'repeat ' + plural(R.repeatBuyers, 'buyer')], [fmt(R.ordersFromRepeat), plural(R.ordersFromRepeat, 'order') + ' from them'], [fmt(R.buyers), 'buyers in all']], 196);
      txt(ctx, th, 'Counted on this device from scrambled buyer IDs. No names, ever.', M, 1690, 'sans', 600, 26, { alpha: 0.7, width: CW });
    });

    if (s.orderCount >= 2) add('average', rev ? 'Average order' : 'Typical order', 'linen', function (ctx, th) {
      kicker(ctx, th, 'THE TYPICAL ORDER', 300);
      if (rev) {
        txt(ctx, th, 'Your average order', M, 440, 'display', 800, 76);
        bigNumber(ctx, th, $(s.avgOrder, true), 720, 280);
        quip(ctx, th, 'Items plus shipping, before sales tax.', 820, { max: 40 });
      } else {
        txt(ctx, th, 'Items per order', M, 440, 'display', 800, 76);
        bigNumber(ctx, th, fmt1(s.itemsPerOrder), 720, 300);
        quip(ctx, th, s.itemsPerOrder >= 1.4 ? 'Hard to stop at one, apparently.' : 'One perfect thing at a time.', 820, { max: 40 });
      }
      var multi = s.itemsPerOrder;
      chipRow(ctx, th, 960, [[fmt1(multi), 'items per order'], [fmt(s.orderCount), plural(s.orderCount, 'order')], [fmt(s.itemCount), plural(s.itemCount, 'item')]], 210);
      if (rev && s.shipping) txt(ctx, th, $(s.shipping) + ' of it was shipping charged to buyers.', M, 1300, 'sans', 700, 32, { alpha: 0.8, width: CW });
      quip(ctx, th, pick(['Wrapped, labeled, sent. Repeat.', 'Small batch, big heart.', 'The post office knows you by name.'], key + 'a'), 1460, { max: 46, lines: 1 });
    });

    if (s.itemCount) add('made', info.handmade ? 'Made by hand' : 'Packed and shipped', 'sage', function (ctx, th) {
      kicker(ctx, th, info.handmade ? 'MADE BY HAND' : 'PACKED AND SHIPPED', 300);
      bigNumber(ctx, th, fmt(s.itemCount), 660, 360);
      var yh = block(ctx, th, info.handmade ? 'things made by hand and sent out into the world' : 'things packed, labeled and sent out into the world', 790, { max: 76, min: 52, lines: 3 });
      var perWeek = s.itemCount / ((Y ? (s.lastDay - Math.round(Date.UTC(Y, 0, 1) / 86400000) + 1) : 365) / 7 || 1);
      // little stitched squares, one per item (up to 300)
      var n = Math.min(300, s.itemCount), cols = 20, cell = CW / cols, gy = yh + 90;
      ctx.save();
      for (var i = 0; i < n; i++) {
        var x = M + (i % cols) * cell, y = gy + Math.floor(i / cols) * cell;
        if (y + cell > 1560) break;
        rr(ctx, x + 4, y + 4, cell - 8, cell - 8, 6); ctx.fillStyle = i % 7 === 0 ? th.accent : th.soft; ctx.globalAlpha = 0.85; ctx.fill();
      }
      ctx.restore();
      var lastY = Math.min(1560, gy + Math.ceil(n / cols) * cell);
      if (s.itemCount > n) txt(ctx, th, '(each square is one item; ' + fmt(s.itemCount - n) + ' more did not fit)', M, lastY + 46, 'sans', 600, 26, { alpha: 0.7, width: CW });
      quip(ctx, th, 'About ' + fmt1(perWeek) + ' a week. ' + (info.handmade ? 'Your hands deserve a rest.' : 'Your tape gun deserves a rest.'), Math.min(1700, lastY + 130), { max: 42, lines: 2 });
    });

    add('summary', 'Your year on a tag', 'indigo', function (ctx, th) {
      kicker(ctx, th, Y ? Y + ', AT A GLANCE' : 'ALL TIME, AT A GLANCE', 300);
      var rows = [['Orders', fmt(s.orderCount)], ['Items sold', fmt(s.itemCount)]];
      if (rev) rows.push(['Sales', $(s.revenue)]);
      if (s.best && s.best.length) rows.push(['Best seller', names ? s.best[0].name : fmt(s.best[0].qty) + ' sold']);
      if (Y && s.peakMonth >= 0) rows.push(['Busiest month', MONTHS_LONG[s.peakMonth]]);
      if (s.peakWeekday >= 0) rows.push(['Best weekday', DAYS[s.peakWeekday]]);
      if (s.located >= 5 && s.home) rows.push([s.states.length >= 2 ? 'Top state' : 'Top country', s.states.length >= 2 ? placeName(s.states[0].name, 'state') : s.home]);
      if (s.repeat) rows.push(['Repeat buyers', Math.round(s.repeat.share * 100) + '%']);
      if (rev && s.orderCount > 1) rows.push(['Average order', $(s.avgOrder, true)]);
      var th2 = Math.min(1180, 330 + rows.length * 82);
      var area = hangTag(ctx, M - 10, 440, CW + 20, th2);
      ctx.save(); ctx.font = F('display', 800, 64); ctx.fillStyle = TAGINK.ink; ctx.textAlign = 'center';
      ctx.fillText(ellipsize(ctx, info.shopLine || 'MY SHOP', area.w), W / 2, area.y + 30); ctx.font = F('mono', 600, 28); spacing(ctx, 3);
      ctx.fillText(info.periodShort.toUpperCase() + '  \u00b7  HANDLE WITH CARE', W / 2, area.y + 80); ctx.restore();
      var y = area.y + 170;
      rows.forEach(function (r) {
        ctx.save(); ctx.font = F('mono', 700, 34); ctx.fillStyle = TAGINK.ink;
        var vw = Math.min(area.w * 0.6, ctx.measureText(r[1]).width);
        ctx.textAlign = 'right'; ctx.fillText(ellipsize(ctx, r[1], area.w * 0.6), area.x + area.w, y);
        ctx.textAlign = 'left'; ctx.globalAlpha = 0.75; ctx.font = F('mono', 600, 32); ctx.fillText(ellipsize(ctx, r[0], area.w - vw - 30), area.x, y);
        ctx.restore(); y += 82;
      });
      var ty = 440 + th2 + 110;
      if (ty < 1720) quip(ctx, th, info.handmade ? 'Thank you for buying handmade.' : 'Thank you for shopping small.', ty, { max: 48, lines: 1 });
    });

    return cards;
  }

  function render(canvas, card, stats, info, idx, total) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    var th = T[card.theme] || T.linen;
    background(ctx, th, (info.title || '') + card.id);
    chrome(ctx, th, info, idx, total);
    card.draw(ctx, th);
  }

  var api = { build: build, render: render, W: W, H: H, THEMES: T, money: money };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EtsyCards = api;
})(typeof self !== 'undefined' ? self : this);
