/* Streaming Wrapped: 1080x1920 card renderer (canvas). Same structure as docs/reading/cards.js; our own
 * "late show" palette (teal, amber, coral on near-black). No streaming-service logos or brand colors. */
(function (root) {
  'use strict';

  var W = 1080, H = 1920, M = 112, CW = W - 2 * M;
  var DISPLAY = '"Avenir Next Condensed", "Arial Narrow", "Roboto Condensed", "DejaVu Sans Condensed", "Helvetica Neue", Inter, Arial, sans-serif';
  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';
  var SERIF = 'Georgia, "Iowan Old Style", Cambria, Caladea, "DejaVu Serif", serif';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var SITE = 'lanternlab2027.github.io/lab/netflix';

  var T = {
    night:   { bg: ['#10262d', '#060e11'], ink: '#f4ecdc', accent: '#ffb648', soft: '#5ee0d0', dark: true },
    marquee: { bg: ['#ffcf6a', '#f29a2e'], ink: '#1c1307', accent: '#0b4248', soft: '#8a4f0c', dark: false },
    teal:    { bg: ['#0f5056', '#06282b'], ink: '#f2efe4', accent: '#ffd27a', soft: '#86e6da', dark: true },
    navy:    { bg: ['#1a2452', '#0a0f27'], ink: '#eef0ff', accent: '#ff9b73', soft: '#9fb0ff', dark: true },
    cream:   { bg: ['#f7eedb', '#e8d6b0'], ink: '#1e1a13', accent: '#0e5b60', soft: '#c4692e', dark: false },
    ink:     { bg: ['#1d1c22', '#0b0b0e'], ink: '#efe9dc', accent: '#5ee0d0', soft: '#ffb648', dark: true }
  };
  var TILE = ['#ffb648', '#5ee0d0', '#ff9b73', '#9fb0ff', '#f6d98b', '#7fc8a9', '#e7a3c4', '#c9b6ff'];

  function F(kind, weight, size, italic) { return (italic ? 'italic ' : '') + weight + ' ' + size + 'px ' + (kind === 'display' ? DISPLAY : kind === 'serif' ? SERIF : SANS); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, ''); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pick(arr, key) { return arr[hash(key) % arr.length]; }
  function rngFrom(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function spacing(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }
  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }
  function dayDate(day) { var d = new Date(day * 86400000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: (d.getUTCDay() + 6) % 7 }; }
  function shortDate(day, withYear) { var d = dayDate(day); return MONTHS[d.mo - 1] + ' ' + d.d + (withYear ? ', ' + d.y : ''); }

  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
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
      if (ctx.measureText(test).width > width && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = ellipsize(ctx, lines[maxLines - 1] + ' \u2026', width);
    }
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

  function fitSize(ctx, text, kind, weight, max, min, width, italic) {
    var s = max; ctx.font = F(kind, weight, s, italic);
    while (s > min && ctx.measureText(text).width > width) { s -= 4; ctx.font = F(kind, weight, s, italic); }
    return s;
  }

  function txt(ctx, th, str, x, y, kind, weight, size, o) {
    o = o || {};
    ctx.save();
    ctx.font = F(kind, weight, size, o.italic);
    ctx.fillStyle = o.color || th.ink;
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.textAlign = o.align || 'left';
    if (o.spacing) spacing(ctx, o.spacing);
    ctx.fillText(o.width ? ellipsize(ctx, str, o.width) : str, x, y);
    ctx.restore();
  }

  // Wrapped text block; returns the baseline of the last line.
  function block(ctx, th, str, y, o) {
    o = o || {};
    ctx.save();
    var f = fitWrap(ctx, str, o.kind || 'display', o.weight || 800, o.max || 110, o.min || 56, o.width || CW, o.lines || 3, o.italic);
    ctx.fillStyle = o.color || th.ink; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.textAlign = o.align || 'left';
    var x = o.x != null ? o.x : (o.align === 'center' ? W / 2 : M);
    var lh = f.size * (o.lh || 1.04);
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
    var g = ctx.createLinearGradient(0, 0, W * 0.35, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var r = rngFrom(hash(seedKey));
    // projector beam from the top
    ctx.save();
    var bx = W * (0.3 + r() * 0.4);
    var bg = ctx.createLinearGradient(0, 0, 0, H * 0.75);
    bg.addColorStop(0, th.dark ? 'rgba(255,240,205,0.13)' : 'rgba(255,255,255,0.4)');
    bg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(bx - 40, 0); ctx.lineTo(bx + 40, 0); ctx.lineTo(bx + 620, H * 0.75); ctx.lineTo(bx - 620, H * 0.75); ctx.closePath(); ctx.fill();
    ctx.restore();
    // film grain (light, so PNGs stay small)
    ctx.save();
    ctx.fillStyle = th.dark ? '#ffffff' : '#3b2a12';
    for (var i = 0; i < 2600; i++) { ctx.globalAlpha = 0.03 + r() * 0.05; ctx.fillRect(r() * W, r() * H, 2, 2); }
    ctx.restore();
    // vignette
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, th.dark ? 'rgba(0,0,0,0.4)' : 'rgba(90,50,10,0.18)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // film-strip edges with sprocket holes
    ctx.save();
    [0, W - 58].forEach(function (x0) {
      ctx.globalAlpha = 1; ctx.fillStyle = th.dark ? 'rgba(0,0,0,0.38)' : 'rgba(40,24,6,0.16)'; ctx.fillRect(x0, 0, 58, H);
      ctx.fillStyle = th.dark ? 'rgba(255,246,226,0.17)' : 'rgba(255,250,238,0.75)';
      for (var y = 22; y < H; y += 74) { rr(ctx, x0 + 15, y, 28, 42, 7); ctx.fill(); }
    });
    ctx.restore();
  }

  function chrome(ctx, th, info, idx, total) {
    ctx.save();
    ctx.fillStyle = th.accent;
    ctx.beginPath(); ctx.moveTo(M, 112); ctx.lineTo(M + 26, 128); ctx.lineTo(M, 144); ctx.closePath(); ctx.fill(); // play mark
    ctx.fillStyle = th.ink; ctx.font = F('sans', 800, 26, false); spacing(ctx, 7); ctx.globalAlpha = 0.9;
    ctx.fillText('STREAMING WRAPPED', M + 44, 139);
    spacing(ctx, 0);
    // period ticket
    ctx.font = F('display', 800, 38, false);
    var p = info.periodShort, pw = ctx.measureText(p).width + 64;
    var px = W - M - pw;
    ctx.globalAlpha = 1; ctx.fillStyle = th.accent;
    rr(ctx, px, 96, pw, 62, 10); ctx.fill();
    ctx.fillStyle = th.bg[1];
    ctx.beginPath(); ctx.arc(px, 127, 11, 0, Math.PI * 2); ctx.arc(px + pw, 127, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = th.dark ? '#14110b' : '#fff7e6'; ctx.textAlign = 'center'; ctx.fillText(p, px + pw / 2, 141);
    // footer
    ctx.textAlign = 'left'; ctx.fillStyle = th.ink; ctx.globalAlpha = 0.95;
    ctx.font = F('display', 800, 38, false);
    ctx.fillText(ellipsize(ctx, info.title, 620), M, H - 128);
    ctx.font = F('sans', 700, 25, false); ctx.globalAlpha = 0.85;
    var mk = 'Make yours: ' + SITE;
    ctx.fillText(mk, M, H - 86);
    var mw = ctx.measureText(mk).width;
    ctx.textAlign = 'right'; ctx.font = F('sans', 800, 30, false); ctx.globalAlpha = 0.9;
    ctx.fillText(idx + ' / ' + total, W - M, H - 128);
    ctx.font = F('sans', 600, 25, false); ctx.globalAlpha = 0.72;
    if (mw + ctx.measureText('made on-device').width + 32 <= CW) ctx.fillText('made on-device', W - M, H - 86);
    ctx.restore();
  }

  function kicker(ctx, th, str, y) {
    ctx.save();
    ctx.fillStyle = th.accent; ctx.fillRect(M, y - 13, 56, 6);
    ctx.font = F('sans', 800, 32, false); spacing(ctx, 6);
    ctx.fillText(ellipsize(ctx, str, CW - 80), M + 76, y);
    ctx.restore();
  }

  function bigNumber(ctx, th, num, y, max, o) {
    o = o || {};
    ctx.save();
    var size = fitSize(ctx, num, 'display', 800, max || 300, 100, o.width || CW, false);
    ctx.fillStyle = o.color || th.accent; spacing(ctx, -2);
    ctx.textAlign = o.align || 'left';
    ctx.fillText(num, o.x != null ? o.x : M - 6, y);
    var w = ctx.measureText(num).width;
    ctx.restore();
    return { size: size, width: w };
  }

  function rule(ctx, th, y, alpha) {
    ctx.save(); ctx.strokeStyle = th.ink; ctx.globalAlpha = alpha || 0.3; ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); ctx.restore();
  }

  function chip(ctx, th, x, y, w, h, value, label) {
    ctx.save();
    rr(ctx, x, y, w, h, 22);
    ctx.fillStyle = th.ink; ctx.globalAlpha = th.dark ? 0.09 : 0.08; ctx.fill();
    ctx.globalAlpha = 0.3; ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = th.ink;
    var vs = fitSize(ctx, value, 'display', 800, 84, 40, w - 52, false);
    var base = y + 28 + vs * 0.8;
    ctx.fillText(value, x + 26, base);
    ctx.font = F('sans', 700, 27, false); ctx.globalAlpha = 0.8;
    wrap(ctx, label, w - 52, 2).forEach(function (l, i) { ctx.fillText(l, x + 26, base + 46 + i * 33); });
    ctx.restore();
  }

  function chipRow(ctx, th, y, items, h) {
    var gap = 22, n = items.length, w = (CW - gap * (n - 1)) / n;
    items.forEach(function (it, i) { chip(ctx, th, M + i * (w + gap), y, w, h || 200, it[0], it[1]); });
  }

  // Bar chart: vals with labels; highlight = indices.
  function bars(ctx, th, x, top, w, h, vals, labels, highlight, o) {
    o = o || {};
    var n = vals.length, bw = w / n, mx = Math.max.apply(null, vals) || 1;
    ctx.save();
    vals.forEach(function (v, i) {
      var bh = v ? Math.max(12, (h - (o.values === false ? 8 : 56)) * v / mx) : 6;
      var bx = x + i * bw + bw * 0.13, bwid = bw * 0.74;
      var hi = highlight.indexOf(i) >= 0;
      rr(ctx, bx, top + h - bh, bwid, bh, Math.min(10, bwid / 2));
      ctx.fillStyle = hi ? th.accent : th.soft; ctx.globalAlpha = hi ? 1 : 0.6; ctx.fill();
      ctx.globalAlpha = 1;
      if (v && o.values !== false) { ctx.font = F('display', 800, o.valueSize || 34, false); ctx.fillStyle = th.ink; ctx.textAlign = 'center'; ctx.fillText(fmt(v), bx + bwid / 2, top + h - bh - 14); }
      ctx.font = F('sans', 800, o.labelSize || 28, false); ctx.fillStyle = th.ink; ctx.globalAlpha = hi ? 1 : 0.7; ctx.textAlign = 'center';
      ctx.fillText(labels[i], bx + bwid / 2, top + h + 44);
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    ctx.save(); ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, top + h + 2); ctx.lineTo(x + w, top + h + 2); ctx.stroke(); ctx.restore();
  }

  function tieWords(idx, names) {
    var ns = idx.map(function (i) { return names[i]; });
    return ns.length === 2 ? ns.join(' and ') : ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1];
  }

  // Marquee sign with bulbs.
  function marquee(ctx, th, x, y, w, h, text) {
    ctx.save();
    rr(ctx, x, y, w, h, 26); ctx.fillStyle = '#16110a'; ctx.fill();
    rr(ctx, x + 34, y + 34, w - 68, h - 68, 12); ctx.fillStyle = '#fff6dc'; ctx.fill();
    var step = 46, n;
    function bulb(bx, by, i) {
      var on = i % 3 !== 1;
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2);
      ctx.fillStyle = on ? '#ffe39a' : '#9b7a3a'; ctx.fill();
      if (on) { ctx.globalAlpha = 0.28; ctx.beginPath(); ctx.arc(bx, by, 17, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    }
    n = Math.floor((w - 40) / step); for (var i = 0; i <= n; i++) { var bx = x + 20 + i * (w - 40) / n; bulb(bx, y + 17, i); bulb(bx, y + h - 17, i + 1); }
    n = Math.floor((h - 40) / step); for (var j = 1; j < n; j++) { var by = y + 20 + j * (h - 40) / n; bulb(x + 17, by, j); bulb(x + w - 17, by, j + 1); }
    ctx.restore();
    var f = fitWrap(ctx, text.toUpperCase(), 'display', 800, 120, 52, w - 120, 2);
    ctx.save(); ctx.fillStyle = '#1a1208'; ctx.textAlign = 'center'; ctx.font = F('display', 800, f.size, false); spacing(ctx, 2);
    var lh = f.size * 1.02, total = lh * (f.lines.length - 1);
    f.lines.forEach(function (l, i) { ctx.fillText(l, x + w / 2, y + h / 2 + f.size * 0.36 - total / 2 + i * lh); });
    ctx.restore();
  }

  // Ticket stub with a perforated edge.
  function mix(a, b, t) {
    var pa = [1, 3, 5].map(function (i) { return parseInt(a.substr(i, 2), 16); }), pb = [1, 3, 5].map(function (i) { return parseInt(b.substr(i, 2), 16); });
    return 'rgb(' + pa.map(function (v, i) { return Math.round(v + (pb[i] - v) * t); }).join(',') + ')';
  }
  function ticket(ctx, th, x, y, w, h, label, date, title, sub, color) {
    ctx.save();
    ctx.shadowColor = 'rgba(60,35,5,0.25)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.fillStyle = color;
    rr(ctx, x, y, w, h, 18); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = mix(th.bg[0], th.bg[1], (y + h / 2) / H);
    ctx.beginPath(); ctx.arc(x, y + h / 2, 26, 0, Math.PI * 2); ctx.arc(x + w, y + h / 2, 26, 0, Math.PI * 2); ctx.fill();
    var sx = x + 200;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([8, 10]);
    ctx.beginPath(); ctx.moveTo(sx, y + 20); ctx.lineTo(sx, y + h - 20); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#18120a'; ctx.textAlign = 'center';
    ctx.save(); ctx.translate(x + 100, y + h / 2); ctx.rotate(-Math.PI / 2);
    ctx.font = F('sans', 800, 26, false); spacing(ctx, 5); ctx.fillText(ellipsize(ctx, label, h - 50), 0, -12);
    ctx.font = F('display', 800, 40, false); spacing(ctx, 0); ctx.fillText(date, 0, 34);
    ctx.restore();
    ctx.textAlign = 'left';
    var f = fitWrap(ctx, title, 'display', 800, 66, 40, w - 260, 2);
    var lh = f.size * 1.02, subN;
    ctx.font = F('serif', 400, 34, true); subN = sub ? Math.min(2, wrap(ctx, sub, w - 260).length) : 0;
    var blockH = f.size * 0.72 + (f.lines.length - 1) * lh + (subN ? 58 + (subN - 1) * 40 : 0);
    var ty = y + (h - blockH) / 2 + f.size * 0.72;
    ctx.font = F('display', 800, f.size, false);
    f.lines.forEach(function (l, i) { ctx.fillText(l, sx + 34, ty + i * lh); });
    if (sub) { ctx.font = F('serif', 400, 34, true); ctx.globalAlpha = 0.8; wrap(ctx, sub, w - 260, 2).forEach(function (l, i) { ctx.fillText(l, sx + 34, ty + (f.lines.length - 1) * lh + 58 + i * 40); }); }
    ctx.restore();
  }

  function episodeLine(e) {
    if (e.kind !== 'series') return 'Movie or special';
    var parts = [];
    if (e.season) parts.push(e.season);
    if (e.episode) parts.push('\u201c' + e.episode + '\u201d');
    return parts.join(' \u00b7 ');
  }

  // ---------- cards ----------
  function build(stats, info) {
    var s = stats, Y = info.year, key = (info.title || '') + (Y || 'all');
    var cards = [];
    function add(id, label, theme, draw) { cards.push({ id: id, label: label, theme: theme, draw: draw }); }
    var showColor = {};
    (s.shows || []).slice(0, TILE.length - 1).forEach(function (x, i) { showColor[x.name] = TILE[(i + 1) % TILE.length]; });

    add('titles', 'Titles watched', 'night', function (ctx, th) {
      kicker(ctx, th, Y ? 'YOUR ' + Y + ' ON SCREEN' : 'YOUR LIFE ON SCREEN', 300);
      bigNumber(ctx, th, fmt(s.count), 660, 400);
      txt(ctx, th, plural(s.count, 'title') + ' watched', M, 770, 'display', 800, 84, { width: CW });
      var sub;
      if (s.prevCount) {
        var d = s.count - s.prevCount;
        sub = d > 0 ? fmt(d) + ' more than ' + (Y - 1) + '. The couch noticed.' : d < 0 ? fmt(-d) + ' fewer than ' + (Y - 1) + '. Touching grass, maybe?' : 'Exactly as many as ' + (Y - 1) + '. Remarkably consistent.';
      } else sub = fmt(s.showCount) + (s.showCount === 1 ? ' show' : ' different shows') + ' and ' + fmt(s.movies) + ' ' + plural(s.movies, 'movie') + ', one screen.';
      quip(ctx, th, sub, 850, { lines: 1 });
      // a wall of screens: one tile per title, colored by show
      var list = s.list, n = list.length, per = Math.max(1, Math.ceil(n / 480)), tiles = Math.ceil(n / per);
      var top = 920, area = 400, cell = Math.floor(Math.sqrt(CW * area / tiles));
      var cols, rows;
      for (;;) { cols = Math.floor(CW / cell); rows = Math.ceil(tiles / cols); if (rows * cell <= area || cell <= 10) break; cell--; }
      cell = Math.min(cell, tiles < 30 ? 110 : 64);
      ctx.save();
      for (var i = 0; i < tiles; i++) {
        var e = list[i * per], cx = M + (i % cols) * cell, cy = top + Math.floor(i / cols) * cell;
        rr(ctx, cx, cy, cell - 4, cell * 0.72, Math.min(6, cell / 6));
        ctx.fillStyle = e.kind === 'movie' ? '#f4ecdc' : (showColor[e.show] || '#3b5a62'); ctx.globalAlpha = e.kind === 'movie' ? 0.9 : 1; ctx.fill();
      }
      ctx.restore();
      var ly = top + rows * cell + 40;
      // legend
      var leg = (s.shows || []).slice(0, 2).map(function (x) { return [showColor[x.name], x.name]; });
      if (s.movies) leg.push(['#f4ecdc', 'movies']);
      leg.push(['#3b5a62', 'everything else']);
      ctx.save(); ctx.font = F('sans', 700, 26, false);
      var lx = M, lrow = 0;
      leg.forEach(function (l) {
        var label = ellipsize(ctx, l[1], 360), wdt = ctx.measureText(label).width + 60;
        if (lx + wdt > W - M) { lx = M; lrow++; }
        ctx.fillStyle = l[0]; rr(ctx, lx, ly + lrow * 42 - 20, 28, 22, 4); ctx.fill();
        ctx.fillStyle = th.ink; ctx.globalAlpha = 0.85; ctx.fillText(label, lx + 40, ly + lrow * 42); ctx.globalAlpha = 1;
        lx += wdt + 12;
      });
      ctx.restore();
      txt(ctx, th, per === 1 ? 'One tile per title, in the order you watched.' : 'One tile per ' + per + ' titles, in the order you watched.', M, ly + lrow * 42 + 50, 'sans', 600, 24, { alpha: 0.6 });
      chipRow(ctx, th, 1500, [[fmt(s.episodes), plural(s.episodes, 'episode')], [fmt(s.movies), plural(s.movies, 'movie or special', 'movies & specials')], ['\u2248' + fmt(s.hoursEst), 'hours (estimated)']], 196);
    });

    if (s.topShow) add('topshow', 'Top show', 'marquee', function (ctx, th) {
      var t = s.topShow;
      kicker(ctx, th, 'YOUR TOP SHOW', 300);
      marquee(ctx, th, M - 10, 370, CW + 20, 360, t.name);
      var bn = bigNumber(ctx, th, fmt(t.episodes), 1010, 250, { width: 480, color: th.ink });
      txt(ctx, th, plural(t.episodes, 'episode'), M + bn.width + 24, 900, 'display', 800, 72);
      txt(ctx, th, Y ? 'in ' + Y : 'all time', M + bn.width + 24, 975, 'serif', 400, 46, { italic: true, alpha: 0.8 });
      var share = Math.round(t.episodes / s.count * 100);
      var y = 1110;
      var lines = [];
      if (t.seasons.length) lines.push(t.seasons.length === 1 ? t.seasons[0] : t.seasons.length + ' seasons: ' + t.seasons.map(function (x) { return x.replace(/^(Season|Series|Part|Volume)\s+/i, '').replace(x.indexOf(t.name + ' ') === 0 ? t.name + ' ' : /$^/, ''); }).join(', '));
      lines.push('First: ' + shortDate(t.first.day, !Y) + '  \u00b7  Latest: ' + shortDate(t.last.day, !Y));
      lines.push(share + '% of everything you watched' + (Y ? ' this year' : ''));
      lines.forEach(function (l, i) {
        ctx.save(); ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(M + 12, y + i * 76 - 12, 9, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        txt(ctx, th, l, M + 44, y + i * 76, 'sans', 700, 36, { width: CW - 44 });
      });
      var q2 = t.episodes >= 30 ? pick(['That\u2019s not a show. That\u2019s a relationship.', 'You and this show need to talk about where this is going.'], key + 't') : pick(['Press play, repeat. You know what you like.', 'Of everything on offer, this one had your heart.', 'The theme song lives rent-free in your head now.'], key + 't2');
      rule(ctx, th, y + lines.length * 76 + 10, 0.35);
      var yq = quip(ctx, th, q2, y + lines.length * 76 + 100, { max: 50 });
      if (Y) {
        var pm = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        s.list.forEach(function (e) { if (e.show === t.name && e.kind === 'series') pm[e.date.mo - 1]++; });
        var hiM = pm.map(function (v, i) { return v ? i : -1; }).filter(function (i) { return i >= 0; });
        bars(ctx, th, M, yq + 40, CW, 120, pm, MONTHS.map(function (m) { return m.charAt(0); }), hiM, { values: false, labelSize: 24 });
        yq += 204;
      }
      if (s.shows.length >= 2 && yq + 60 <= 1730) {
        var ru = s.shows[1];
        txt(ctx, th, 'Runner-up: ' + ru.name + ' (' + fmt(ru.episodes) + ' ' + plural(ru.episodes, 'episode') + ')', M, Math.max(yq + 60, 1640), 'sans', 700, 32, { alpha: 0.85, width: CW });
      }
    });

    if (s.binge) add('binge', 'The binge', 'teal', function (ctx, th) {
      var b = s.binge, dd = dayDate(b.day);
      kicker(ctx, th, 'THE BIG BINGE', 300);
      block(ctx, th, DAYS[dd.wd] + ', ' + MONTHS_LONG[dd.mo - 1] + ' ' + dd.d + (Y ? '' : ', ' + dd.y), 420, { max: 84, min: 54, lines: 1 });
      var bn = bigNumber(ctx, th, fmt(b.count), 700, 280, { width: 420 });
      var what = b.distinct === 1 && s.list.filter(function (e) { return e.day === b.day; })[0].kind === 'series' ? plural(b.count, 'episode') : plural(b.count, 'title');
      txt(ctx, th, what, M + bn.width + 28, 590, 'display', 800, 72);
      txt(ctx, th, 'in one day', M + bn.width + 28, 670, 'display', 800, 72, { alpha: 0.75 });
      var head = b.distinct === 1 ? b.show : b.show + ' + ' + (b.distinct - 1) + ' more';
      var yh = block(ctx, th, head, 830, { max: 70, min: 44, lines: 2, color: th.accent });
      // the playlist
      var y = yh + 90, shown = b.entries.slice(0, 8);
      shown.forEach(function (e, i) {
        var yy = y + i * 70;
        txt(ctx, th, String(i + 1).padStart(2, '0'), M, yy, 'display', 800, 36, { alpha: 0.55 });
        var label = e.kind === 'series' ? (b.distinct === 1 ? (e.episode || e.season || e.title) : e.show + (e.episode ? ': ' + e.episode : '')) : e.title;
        txt(ctx, th, label, M + 72, yy, 'sans', 600, 36, { width: CW - 72 });
      });
      var after = y + shown.length * 70;
      if (b.entries.length > shown.length) { txt(ctx, th, '+ ' + (b.entries.length - shown.length) + ' more', M + 72, after, 'sans', 700, 32, { alpha: 0.7 }); after += 60; }
      var avg = fmt1(s.perWatchDay);
      quip(ctx, th, pick(['Snacks: stocked. Plans: cancelled. Regrets: none.', 'Somewhere around episode four, the couch became furniture you live in.', '\u201cAre you still watching?\u201d Yes. Obviously.'], key + 'b'), Math.max(after + 50, 1560), { max: 44 });
      txt(ctx, th, 'On a normal watch day: ' + avg + ' ' + plural(+avg, 'title'), M, 1720, 'sans', 700, 30, { alpha: 0.75 });
    });

    add('when', 'When you watch', 'navy', function (ctx, th) {
      kicker(ctx, th, 'WHEN YOU WATCH', 300);
      var vals, labels, head, peaks;
      if (Y) {
        vals = s.months; labels = MONTHS.map(function (m) { return m.charAt(0); });
        peaks = vals.map(function (v, i) { return v === vals[s.peakMonth] ? i : -1; }).filter(function (i) { return i >= 0; });
        head = peaks.length === 1 ? MONTHS_LONG[peaks[0]] + ' was your big month' : peaks.length <= 3 ? tieWords(peaks, MONTHS_LONG) + ' tied for first' : 'Spread out across the year';
      } else {
        var ys = Object.keys(s.byYear).map(Number).sort(function (a, b) { return a - b; }).slice(-12);
        vals = ys.map(function (y) { return s.byYear[y]; }); labels = ys.map(function (y) { return '\u2019' + String(y).slice(2); });
        var mxv = Math.max.apply(null, vals);
        peaks = vals.map(function (v, i) { return v === mxv ? i : -1; }).filter(function (i) { return i >= 0; });
        head = ys[peaks[0]] + ' was your biggest year';
      }
      var yh = block(ctx, th, head, 420, { max: 84, min: 56, lines: 2 });
      txt(ctx, th, fmt(vals[peaks[0]]) + ' ' + plural(vals[peaks[0]], 'title') + (peaks.length > 1 ? ' each' : '') + (Y ? '' : ' that year') + '.', M, yh + 66, 'serif', 400, 44, { italic: true, alpha: 0.85 });
      var ctop = yh + 120;
      bars(ctx, th, M, ctop, CW, 420, vals, labels, peaks, { valueSize: vals.length > 7 ? 30 : 36 });
      // weekdays
      var wy = ctop + 560;
      var wpk = s.weekdays.map(function (v, i) { return v === s.weekdays[s.peakWeekday] ? i : -1; }).filter(function (i) { return i >= 0; });
      var whead = wpk.length === 1 ? DAYS[wpk[0]] + 's are for screens' : tieWords(wpk, DAYS.map(function (d) { return d + 's'; })) + ', equally';
      block(ctx, th, whead, wy, { max: 64, min: 44, lines: 1, color: th.accent });
      bars(ctx, th, M, wy + 40, CW, 330, s.weekdays, ['M', 'T', 'W', 'T', 'F', 'S', 'S'], wpk, { valueSize: 32 });
      txt(ctx, th, Math.round(s.weekendShare * 100) + '% of your watching happened on weekends.', M, wy + 470, 'sans', 700, 30, { alpha: 0.8, width: CW });
    });

    if (s.count >= 3 && (s.movies || s.episodes)) add('mix', 'Movies vs series', 'cream', function (ctx, th) {
      kicker(ctx, th, 'MOVIES VS SERIES', 300);
      var ms = s.movies / s.count;
      var head = ms >= 0.6 ? 'A movie person' : ms >= 0.4 ? 'Perfectly split' : ms >= 0.15 ? 'Series first, movies sometimes' : ms > 0 ? 'Series, nearly every time' : 'Series only. No movies at all.';
      var yh = block(ctx, th, head, 440, { max: 100, min: 60, lines: 2 });
      // two big numbers
      var ny = yh + 260, half = CW / 2;
      bigNumber(ctx, th, fmt(s.episodes), ny, 210, { width: half - 30, color: th.accent });
      bigNumber(ctx, th, fmt(s.movies), ny, 210, { width: half - 30, x: M + half, color: th.soft });
      txt(ctx, th, plural(s.episodes, 'episode'), M, ny + 62, 'sans', 800, 34);
      txt(ctx, th, plural(s.movies, 'movie or special', 'movies & specials'), M + half, ny + 62, 'sans', 800, 34, { width: half });
      // split bar
      var by = ny + 120, ew = Math.round(CW * (1 - ms));
      ctx.save();
      rr(ctx, M, by, CW, 70, 35); ctx.fillStyle = th.soft; ctx.fill();
      if (ew > 0) { rr(ctx, M, by, Math.max(70, ew), 70, 35); ctx.fillStyle = th.accent; ctx.fill(); }
      ctx.restore();
      txt(ctx, th, Math.round((1 - ms) * 100) + '% series', M, by + 120, 'sans', 700, 30, { alpha: 0.8 });
      txt(ctx, th, Math.round(ms * 100) + '% movies', W - M, by + 120, 'sans', 700, 30, { alpha: 0.8, align: 'right' });
      var ly = by + 220;
      if (s.movieList.length) {
        rule(ctx, th, ly - 50, 0.3);
        txt(ctx, th, s.movieList.length > 5 ? 'LATEST MOVIES' : 'THE MOVIES', M, ly, 'sans', 800, 28, { spacing: 5, alpha: 0.7 });
        var mv = s.movieList.slice(-5).reverse();
        mv.forEach(function (e, i) {
          var yy = ly + 70 + i * 66;
          if (yy > 1740) return;
          txt(ctx, th, shortDate(e.day), M, yy, 'sans', 700, 28, { alpha: 0.65 });
          txt(ctx, th, e.title, M + 150, yy, 'display', 800, 40, { width: CW - 150 });
        });
        quip(ctx, th, ms >= 0.4 ? 'Two hours, a beginning, a middle and an end. Respect.' : 'A movie now and then, between seasons.', Math.min(ly + 70 + Math.min(5, mv.length) * 66 + 40, 1700), { max: 44, lines: 1 });
      } else quip(ctx, th, 'Why commit to two hours when you can commit to twelve seasons?', ly, { max: 46 });
    });

    if (s.comfort) add('comfort', 'Comfort watch', 'ink', function (ctx, th) {
      var c = s.comfort;
      kicker(ctx, th, 'YOUR COMFORT WATCH', 300);
      var yh = block(ctx, th, c.name, 450, { max: 120, min: 60, lines: 3 });
      var line = 'You came back to it in ' + c.months + ' different ' + plural(c.months, 'month') + (Y ? ' of ' + Y : '') + '.';
      var yl = quip(ctx, th, line, yh + 90, { max: 50 });
      // month dots
      var dy = yl + 150;
      if (Y) {
        var on = {}; c.monthKeys.forEach(function (k) { on[k % 12] = 1; });
        var gap = CW / 12;
        for (var i = 0; i < 12; i++) {
          var cx = M + gap * i + gap / 2;
          ctx.save(); ctx.beginPath(); ctx.arc(cx, dy, gap * 0.36, 0, Math.PI * 2);
          if (on[i]) { ctx.fillStyle = th.accent; ctx.fill(); } else { ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 3; ctx.stroke(); }
          ctx.restore();
          txt(ctx, th, MONTHS[i].charAt(0), cx, dy + gap * 0.36 + 46, 'sans', 800, 28, { align: 'center', alpha: on[i] ? 1 : 0.55 });
        }
        dy += 160;
      } else {
        var have = {}; c.monthKeys.forEach(function (k) { have[k] = 1; });
        var yrs = c.monthKeys.map(function (k) { return Math.floor(k / 12); }).filter(function (v, i, arr) { return arr.indexOf(v) === i; }).sort().slice(-4);
        var gx2 = (CW - 110) / 12, r2 = Math.min(22, gx2 * 0.36);
        dy -= 40;
        yrs.forEach(function (yr, row) {
          var yy = dy + row * 70;
          txt(ctx, th, String(yr), M, yy + 11, 'sans', 800, 28, { alpha: 0.8 });
          for (var mm = 0; mm < 12; mm++) {
            var cx2 = M + 110 + gx2 * mm + gx2 / 2;
            ctx.save(); ctx.beginPath(); ctx.arc(cx2, yy, r2, 0, Math.PI * 2);
            if (have[yr * 12 + mm]) { ctx.fillStyle = th.accent; ctx.fill(); } else { ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.3; ctx.lineWidth = 3; ctx.stroke(); }
            ctx.restore();
          }
        });
        MONTHS.forEach(function (m, mm) { txt(ctx, th, m.charAt(0), M + 110 + gx2 * mm + gx2 / 2, dy + yrs.length * 70 + 4, 'sans', 800, 24, { align: 'center', alpha: 0.6 }); });
        dy += yrs.length * 70 + 80;
      }
      var facts = [];
      facts.push([fmt(c.count), c.kind === 'series' ? plural(c.count, 'episode') + (Y ? ' this year' : '') : plural(c.count, 'viewing')]);
      facts.push([fmt(c.months), plural(c.months, 'month') + ' you returned']);
      if (c.priorYears) facts.push([fmt(c.priorYears), plural(c.priorYears, 'earlier year') + ' too']);
      else if (c.rewatches) facts.push([fmt(c.rewatches), plural(c.rewatches, 'repeat') + ' of the exact same title']);
      chipRow(ctx, th, dy, facts, 200);
      var q2 = c.priorYears ? 'An old friend. Some shows aren\u2019t watched, they\u2019re revisited.' : pick(['Background noise, emotional support, same thing.', 'The show you put on when you don\u2019t know what to put on.', 'Not the most-watched. The most returned-to.'], key + 'c');
      var yq2 = quip(ctx, th, q2, Math.min(dy + 330, 1640), { max: 48 });
      var lastE = null; s.list.forEach(function (e) { if (e.show === c.name) lastE = e; });
      if (lastE && yq2 + 90 <= 1730) txt(ctx, th, 'Most recently: ' + shortDate(lastE.day, !Y) + (lastE.kind === 'series' && lastE.episode ? ', \u201c' + lastE.episode + '\u201d' : ''), M, yq2 + 90, 'sans', 700, 30, { alpha: 0.75, width: CW });
    });

    if (s.streak) add('streak', 'Longest streak', 'teal', function (ctx, th) {
      var st = s.streak;
      kicker(ctx, th, 'YOUR LONGEST STREAK', 300);
      var bn = bigNumber(ctx, th, fmt(st.len), 610, 300, { width: 520 });
      txt(ctx, th, 'days', M + bn.width + 28, 520, 'display', 800, 80);
      txt(ctx, th, 'in a row', M + bn.width + 28, 600, 'display', 800, 80, { alpha: 0.75 });
      var sd = dayDate(st.start), ed = dayDate(st.end);
      txt(ctx, th, shortDate(st.start, sd.y !== ed.y || !Y) + ' \u2013 ' + shortDate(st.end, sd.y !== ed.y || !Y), M, 700, 'serif', 400, 46, { italic: true, alpha: 0.88 });
      // calendar: 12 months, 4 x 3
      var cy0 = 790, calY = ed.y;
      var cols = 4, gx = 26, mw = (CW - gx * (cols - 1)) / cols, cell = Math.floor(mw / 7), gy = 228;
      var inStreak = function (d) { return d >= st.start && d <= st.end; };
      ctx.save();
      for (var m = 0; m < 12; m++) {
        var ox = M + (m % cols) * (mw + gx), oy = cy0 + Math.floor(m / cols) * gy;
        ctx.font = F('sans', 800, 26, false); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.8; ctx.fillText(MONTHS[m].toUpperCase(), ox, oy);
        var first = Math.round(Date.UTC(calY, m, 1) / 86400000), lead = dayDate(first).wd, dim = new Date(Date.UTC(calY, m + 1, 0)).getUTCDate();
        for (var d = 0; d < dim; d++) {
          var slot = lead + d, x = ox + (slot % 7) * cell, y = oy + 18 + Math.floor(slot / 7) * cell, dn = first + d;
          rr(ctx, x, y, cell - 4, cell - 4, 4);
          if (inStreak(dn)) { ctx.fillStyle = th.accent; ctx.globalAlpha = 1; }
          else if (s.perDay[dn]) { ctx.fillStyle = th.soft; ctx.globalAlpha = Math.min(1, 0.4 + s.perDay[dn].length * 0.15); }
          else { ctx.fillStyle = th.ink; ctx.globalAlpha = 0.1; }
          ctx.fill();
        }
      }
      ctx.restore();
      var ly = cy0 + 2 * gy + 18 + 6 * cell + 50;
      if (!Y) txt(ctx, th, 'Calendar: ' + calY, W - M, cy0 - 64, 'sans', 700, 26, { align: 'right', alpha: 0.7 });
      ctx.save(); ctx.font = F('sans', 700, 26, false);
      [[th.accent, 1, 'the streak'], [th.soft, 0.7, 'other days you watched']].forEach(function (l, i) {
        var lx = M + i * 300; ctx.fillStyle = l[0]; ctx.globalAlpha = l[1]; rr(ctx, lx, ly - 22, 26, 26, 4); ctx.fill();
        ctx.globalAlpha = 0.85; ctx.fillStyle = th.ink; ctx.fillText(l[2], lx + 40, ly);
      });
      ctx.restore();
      chipRow(ctx, th, 1530, [[fmt(s.watchDays), plural(s.watchDays, 'day') + ' with something on'], [Math.round(s.watchDays / s.spanDays * 100) + '%', 'of days ' + (Y ? 'so far this year' : 'since your first title')]], 190);
    });

    add('firstlast', 'First and last', 'cream', function (ctx, th) {
      kicker(ctx, th, Y ? 'FIRST & LATEST OF ' + Y : 'FIRST & LATEST', 300);
      var head = Y ? 'How your year opened, and where it stands' : 'Where it started, and where it stands';
      var yh = block(ctx, th, head, 430, { max: 80, min: 54, lines: 2 });
      var f = s.first, l = s.last, tw = CW + 20;
      ticket(ctx, th, M - 10, yh + 90, tw, 360, 'FIRST', shortDate(f.day, !Y), f.kind === 'series' ? f.show : f.title, f.kind === 'series' ? episodeLine(f) : 'A movie or special', '#ffcf6a');
      if (s.count > 1) ticket(ctx, th, M - 10, yh + 500, tw, 360, s.count > 1 ? 'LATEST' : 'ALSO', shortDate(l.day, !Y), l.kind === 'series' ? l.show : l.title, l.kind === 'series' ? episodeLine(l) : 'A movie or special', '#8fd9cf');
      var span = l.day - f.day;
      var q2 = s.count < 2 ? 'Just the one so far.' : span === 0 ? 'Both on the same day. Busy one.' : f.show === l.show ? 'Same show at both ends. Some things never change.' : fmt(span) + ' ' + plural(span, 'day') + (s.count > 2 ? ' and ' + fmt(s.count - 2) + ' ' + plural(s.count - 2, 'title') + ' in between.' : ' apart, and nothing in between.');
      quip(ctx, th, q2, yh + 960, { max: 46 });
      if (s.count > 2) chipRow(ctx, th, Math.min(yh + 1020, 1540), [[fmt(s.watchDays), plural(s.watchDays, 'day') + ' with something on'], [fmt(s.showCount), plural(s.showCount, 'show') + ' along the way']], 190);
    });

    if (s.shows && s.shows.length >= 3) add('top5', 'Your top shows', 'night', function (ctx, th) {
      kicker(ctx, th, 'YOUR TOP ' + Math.min(5, s.shows.length) + ' SHOWS', 300);
      var top = s.shows.slice(0, 5), mx = top[0].episodes;
      var y = 450;
      top.forEach(function (x, i) {
        var yy = y + i * 230;
        txt(ctx, th, String(i + 1), M, yy + 66, 'display', 800, 150, { color: i === 0 ? th.accent : th.ink, alpha: i === 0 ? 1 : 0.5 });
        var tx = M + 140;
        var yb = block(ctx, th, x.name, yy, { max: 58, min: 40, lines: 2, x: tx, width: CW - 140 });
        ctx.save(); rr(ctx, tx, yb + 30, CW - 140, 30, 15); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.12; ctx.fill();
        rr(ctx, tx, yb + 30, Math.max(30, (CW - 140 - 200) * x.episodes / mx), 30, 15); ctx.globalAlpha = 1; ctx.fillStyle = TILE[(i + 1) % TILE.length]; ctx.fill(); ctx.restore();
        txt(ctx, th, fmt(x.episodes) + ' ' + plural(x.episodes, 'ep'), W - M, yb + 56, 'sans', 800, 30, { align: 'right', alpha: 0.9 });
      });
      var others = s.shows.length - top.length;
      if (others > 0) txt(ctx, th, '+ ' + fmt(others) + ' more ' + plural(others, 'show') + (s.triedOnce ? ', ' + fmt(s.triedOnce) + ' of them tried for just one episode' : ''), M, 1690, 'sans', 700, 30, { alpha: 0.75, width: CW });
    });

    add('persona', 'Viewer personality', 'navy', function (ctx, th) {
      var p = s.personality;
      kicker(ctx, th, 'YOUR VIEWER PERSONALITY', 300);
      // clapperboard
      ctx.save(); ctx.translate(W / 2, 470);
      ctx.fillStyle = th.ink; rr(ctx, -110, -20, 220, 140, 12); ctx.fill();
      ctx.save(); ctx.rotate(-0.22); ctx.fillStyle = th.ink; rr(ctx, -112, -78, 224, 50, 8); ctx.fill();
      ctx.fillStyle = th.bg[1]; for (var k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-92 + k * 46, -78); ctx.lineTo(-68 + k * 46, -78); ctx.lineTo(-88 + k * 46, -28); ctx.lineTo(-112 + k * 46, -28); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = th.accent; ctx.fillRect(-90, 20, 180, 10); ctx.fillRect(-90, 56, 120, 10);
      ctx.restore();
      var yn = block(ctx, th, p.name, 760, { max: 140, min: 76, lines: 2, align: 'center', lh: 1.0, color: th.accent });
      var yl = quip(ctx, th, p.line, yn + 100, { max: 50, lines: 3, align: 'center' });
      var ty = yl + 40;
      if (p.traits.length) {
        txt(ctx, th, 'with a streak of', W / 2, ty + 40, 'sans', 700, 30, { align: 'center', alpha: 0.75 });
        txt(ctx, th, p.traits.join(' & '), W / 2, ty + 100, 'display', 800, 52, { align: 'center', width: CW });
        ty += 110;
      }
      var gy = Math.max(ty + 90, 1180), gw = (CW - 22) / 2, gh = 190;
      var tiles = [[fmt(s.count), plural(s.count, 'title') + ' watched']];
      tiles.push(s.topShow ? [fmt(s.topShow.episodes), 'eps of your top show'] : [fmt(s.movies), plural(s.movies, 'movie')]);
      tiles.push(s.binge ? [fmt(s.binge.count), 'in your biggest day'] : [fmt(s.watchDays), plural(s.watchDays, 'day') + ' watching']);
      tiles.push(s.streak ? [fmt(s.streak.len), 'day streak'] : [fmt(s.showCount), plural(s.showCount, 'show')]);
      tiles.forEach(function (t, i) { chip(ctx, th, M + (i % 2) * (gw + 22), gy + Math.floor(i / 2) * (gh + 22), gw, gh, t[0], t[1]); });
    });

    var dropOrder = ['top5', 'mix', 'firstlast'];
    while (cards.length > 10 && dropOrder.length) { var id = dropOrder.shift(); cards = cards.filter(function (c) { return c.id !== id; }); }
    return cards;
  }

  function render(canvas, card, stats, info, idx, total) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    var th = T[card.theme] || T.night;
    background(ctx, th, (info.title || '') + card.id);
    chrome(ctx, th, info, idx, total);
    card.draw(ctx, th);
  }

  var api = { build: build, render: render, W: W, H: H, THEMES: T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NetflixCards = api;
})(typeof self !== 'undefined' ? self : this);
