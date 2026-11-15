/* Dating Wrapped: 1080x1920 card renderer (canvas). Same structure as docs/netflix/cards.js.
 * Our own "airmail stationery" palette (indigo, apricot, lilac, mint). No dating-app logos or brand colors.
 * Cards only ever draw aggregate numbers: never message text, names, photos or anything about another person.
 * Safe share (info.safe) hides absolute counts and keeps rates, ratios, dates and labels. */
(function (root) {
  'use strict';

  var W = 1080, H = 1920, M = 112, CW = W - 2 * M;
  var DISPLAY = '"Avenir Next Condensed", "Arial Narrow", "Roboto Condensed", "DejaVu Sans Condensed", "Helvetica Neue", Inter, Arial, sans-serif';
  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';
  var SERIF = 'Georgia, "Iowan Old Style", Cambria, Caladea, "DejaVu Serif", serif';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  var SITE = 'lanternlab2027.github.io/lab/dating';

  var T = {
    ink:     { bg: ['#211b45', '#0d0b20'], ink: '#f8efe2', accent: '#ffb38a', soft: '#c9b6ff', dark: true },
    apricot: { bg: ['#ffd2ac', '#f4a27c'], ink: '#26142c', accent: '#4a2380', soft: '#a2482f', dark: false },
    lilac:   { bg: ['#3b2f72', '#18123e'], ink: '#f4efff', accent: '#ffd38a', soft: '#9fe3c8', dark: true },
    mint:    { bg: ['#1d4d47', '#0b2420'], ink: '#effaf5', accent: '#ffb38a', soft: '#a8f0d4', dark: true },
    paper:   { bg: ['#faf1e4', '#ebd9c0'], ink: '#28192e', accent: '#6a3192', soft: '#c8673a', dark: false },
    plum:    { bg: ['#40193f', '#1a0a1d'], ink: '#fbeee6', accent: '#ffcf8a', soft: '#d9b3ff', dark: true }
  };

  function F(kind, weight, size, italic) { return (italic ? 'italic ' : '') + weight + ' ' + size + 'px ' + (kind === 'display' ? DISPLAY : kind === 'serif' ? SERIF : SANS); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, ''); }
  function pct(r) { var p = r * 100; return (p > 0 && p < 1 ? '<1' : p > 99 && p < 100 ? '99' : String(Math.round(p))) + '%'; }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rngFrom(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function spacing(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }
  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }
  function dayDate(day) { var d = new Date(day * 86400000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: (d.getUTCDay() + 6) % 7 }; }
  function shortDate(day, withYear) { var d = dayDate(day); return MONTHS[d.mo - 1] + ' ' + d.d + (withYear ? ', ' + d.y : ''); }
  function hourLabel(h) { return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? ' AM' : ' PM'); }
  function hourShort(h) { return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? 'am' : 'pm'); }

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
  // Heart centred at (x, y), roughly s wide.
  function heartPath(ctx, x, y, s) {
    var k = s / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + k * 0.9);
    ctx.bezierCurveTo(x - k * 1.25, y + k * 0.05, x - k * 0.95, y - k * 0.95, x - k * 0.48, y - k * 0.82);
    ctx.bezierCurveTo(x - k * 0.18, y - k * 0.75, x - k * 0.02, y - k * 0.52, x, y - k * 0.36);
    ctx.bezierCurveTo(x + k * 0.02, y - k * 0.52, x + k * 0.18, y - k * 0.75, x + k * 0.48, y - k * 0.82);
    ctx.bezierCurveTo(x + k * 0.95, y - k * 0.95, x + k * 1.25, y + k * 0.05, x, y + k * 0.9);
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
    return block(ctx, th, str, y, { kind: 'serif', weight: 400, italic: true, max: o.max || 46, min: 34, lines: o.lines || 2, alpha: 0.88, align: o.align, width: o.width, x: o.x });
  }

  // ---------- frame ----------
  function background(ctx, th, seedKey) {
    var g = ctx.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var r = rngFrom(hash(seedKey));
    // soft glow
    var gl = ctx.createRadialGradient(W * (0.2 + r() * 0.6), H * 0.28, 40, W / 2, H * 0.3, H * 0.6);
    gl.addColorStop(0, th.dark ? 'rgba(255,214,180,0.16)' : 'rgba(255,255,255,0.45)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    // scattered tiny hearts and sparkles, very faint
    ctx.save();
    for (var i = 0; i < 26; i++) {
      var x = 80 + r() * (W - 160), y = 200 + r() * (H - 420), s = 16 + r() * 26;
      ctx.globalAlpha = 0.06 + r() * 0.06; ctx.fillStyle = r() < 0.5 ? th.accent : th.soft;
      if (r() < 0.6) { heartPath(ctx, x, y, s); ctx.fill(); }
      else { ctx.beginPath(); for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4, rad = k % 2 ? s * 0.16 : s * 0.5; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } ctx.closePath(); ctx.fill(); }
    }
    ctx.restore();
    // paper grain
    ctx.save();
    ctx.fillStyle = th.dark ? '#ffffff' : '#4a2a1a';
    for (var j = 0; j < 2200; j++) { ctx.globalAlpha = 0.025 + r() * 0.04; ctx.fillRect(r() * W, r() * H, 2, 2); }
    ctx.restore();
    // airmail stripes down both edges
    ctx.save();
    [0, W - 34].forEach(function (x0) {
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, 34, H); ctx.clip();
      ctx.globalAlpha = th.dark ? 0.75 : 0.85;
      for (var yy = -60, k = 0; yy < H + 60; yy += 56, k++) {
        ctx.fillStyle = k % 2 ? th.accent : th.soft;
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + 34, yy - 28); ctx.lineTo(x0 + 34, yy); ctx.lineTo(x0, yy + 28); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });
    ctx.restore();
  }

  // Postage stamp with perforated edge; returns nothing.
  function stamp(ctx, th, x, y, w, h, text) {
    ctx.save();
    ctx.fillStyle = th.accent;
    rr(ctx, x, y, w, h, 4); ctx.fill();
    ctx.fillStyle = th.bg[0];
    var step = 14;
    for (var px = x + step / 2; px < x + w; px += step) { ctx.beginPath(); ctx.arc(px, y, 4.5, 0, Math.PI * 2); ctx.arc(px, y + h, 4.5, 0, Math.PI * 2); ctx.fill(); }
    for (var py = y + step / 2; py < y + h; py += step) { ctx.beginPath(); ctx.arc(x, py, 4.5, 0, Math.PI * 2); ctx.arc(x + w, py, 4.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = th.dark ? 'rgba(20,12,30,0.45)' : 'rgba(255,248,236,0.6)'; ctx.lineWidth = 2;
    rr(ctx, x + 9, y + 9, w - 18, h - 18, 3); ctx.stroke();
    ctx.fillStyle = th.dark ? '#1b1230' : '#fff6ea'; ctx.textAlign = 'center';
    ctx.font = F('display', 800, 38, false); ctx.fillText(text, x + w / 2, y + h / 2 + 13);
    ctx.restore();
  }

  function chrome(ctx, th, info, idx, total) {
    ctx.save();
    ctx.fillStyle = th.accent; heartPath(ctx, M + 15, 126, 32); ctx.fill();
    ctx.fillStyle = th.ink; ctx.font = F('sans', 800, 26, false); spacing(ctx, 7); ctx.globalAlpha = 0.9;
    ctx.fillText('DATING WRAPPED', M + 46, 137);
    spacing(ctx, 0);
    ctx.font = F('display', 800, 38, false);
    var p = info.periodShort, pw = Math.max(150, ctx.measureText(p).width + 60);
    ctx.globalAlpha = 1;
    stamp(ctx, th, W - M - pw, 90, pw, 72, p);
    // postmark rings
    ctx.save(); ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.22; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(W - M - pw - 26, 126, 44, -1.2, 1.2); ctx.stroke();
    for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(W - M - pw - 150, 108 + k * 18); ctx.bezierCurveTo(W - M - pw - 120, 98 + k * 18, W - M - pw - 90, 118 + k * 18, W - M - pw - 60, 108 + k * 18); ctx.stroke(); }
    ctx.restore();
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
    ctx.font = F('sans', 800, 32, false); spacing(ctx, 6); ctx.fillStyle = th.ink;
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
  function chip(ctx, th, x, y, w, h, value, label) {
    ctx.save();
    rr(ctx, x, y, w, h, 22);
    ctx.fillStyle = th.ink; ctx.globalAlpha = th.dark ? 0.09 : 0.08; ctx.fill();
    ctx.globalAlpha = 0.3; ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = th.ink;
    var vs = fitSize(ctx, value, 'display', 800, 80, 40, w - 52, false);
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
  function chipGrid(ctx, th, y, items) {
    var gw = (CW - 22) / 2, gh = 190;
    items.forEach(function (t, i) { chip(ctx, th, M + (i % 2) * (gw + 22), y + Math.floor(i / 2) * (gh + 22), gw, gh, t[0], t[1]); });
  }
  function bars(ctx, th, x, top, w, h, vals, labels, highlight, o) {
    o = o || {};
    var n = vals.length, bw = w / n, mx = Math.max.apply(null, vals) || 1, showV = o.values !== false;
    ctx.save();
    vals.forEach(function (v, i) {
      var bh = v ? Math.max(12, (h - (showV ? 56 : 8)) * v / mx) : 6;
      var bx = x + i * bw + bw * 0.13, bwid = bw * 0.74;
      var hi = highlight.indexOf(i) >= 0;
      rr(ctx, bx, top + h - bh, bwid, bh, Math.min(10, bwid / 2));
      ctx.fillStyle = hi ? th.accent : th.soft; ctx.globalAlpha = hi ? 1 : 0.6; ctx.fill();
      ctx.globalAlpha = 1;
      if (v && showV) { ctx.font = F('display', 800, o.valueSize || 32, false); ctx.fillStyle = th.ink; ctx.textAlign = 'center'; ctx.fillText(o.fmt ? o.fmt(v) : fmt(v), bx + bwid / 2, top + h - bh - 14); }
      ctx.font = F('sans', 800, o.labelSize || 28, false); ctx.fillStyle = th.ink; ctx.globalAlpha = hi ? 1 : 0.7; ctx.textAlign = 'center';
      ctx.fillText(labels[i], bx + bwid / 2, top + h + 44);
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    ctx.save(); ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, top + h + 2); ctx.lineTo(x + w, top + h + 2); ctx.stroke(); ctx.restore();
  }
  function compact(n) { return n >= 10000 ? fmt1(n / 1000) + 'k' : fmt(n); }

  // ---------- cards ----------
  function build(stats, info) {
    var s = stats, Y = info.year, safe = !!info.safe;
    var inYear = Y == null ? 'all time' : 'in ' + Y;
    var swipeWord = s.swipeWord || 'swipes';
    var cards = [];
    function add(id, label, theme, draw) { cards.push({ id: id, label: label, theme: theme, draw: draw }); }

    // 1. The year in swipes
    if (s.rightRate != null && s.rights + s.lefts >= 10) add('swipes', 'The year in swipes', 'ink', function (ctx, th) {
      kicker(ctx, th, Y == null ? 'ALL YOUR SWIPES' : 'YOUR ' + Y + ' IN SWIPES', 300);
      var bn = bigNumber(ctx, th, pct(s.rightRate), 640, 340);
      txt(ctx, th, 'right swipes', M, 720, 'display', 800, 64, { alpha: 0.95 });
      var yl = block(ctx, th, s.rightLabel.name, 860, { max: 120, min: 70, lines: 2, color: th.accent });
      var yq = quip(ctx, th, s.rightLabel.line, yl + 80, { max: 46, lines: 2 });
      // split bar
      var by = Math.max(yq + 80, 1060), bh = 96;
      ctx.save();
      rr(ctx, M, by, CW, bh, bh / 2); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.14; ctx.fill();
      ctx.globalAlpha = 1; rr(ctx, M, by, Math.max(bh, CW * s.rightRate), bh, bh / 2); ctx.fillStyle = th.accent; ctx.fill();
      ctx.fillStyle = th.dark ? '#1b1230' : '#fff'; ctx.globalAlpha = 1; heartPath(ctx, M + 50, by + bh / 2 + 2, 44); ctx.fill();
      ctx.restore();
      txt(ctx, th, 'YES', M, by + bh + 52, 'sans', 800, 28, { spacing: 4, alpha: 0.85 });
      txt(ctx, th, 'NOT FOR ME', W - M, by + bh + 52, 'sans', 800, 28, { spacing: 4, alpha: 0.85, align: 'right' });
      var oneIn = s.rightRate > 0 ? 1 / s.rightRate : null;
      var items = safe ? [
        [oneIn && oneIn >= 1.5 ? '1 in ' + Math.round(oneIn) : pct(s.rightRate), oneIn && oneIn >= 1.5 ? 'profiles got a yes' : 'of profiles got a yes'],
        [pct(1 - s.rightRate), 'kindly passed on']
      ] : [[compact(s.rights + s.lefts), 'swipes ' + inYear], [compact(s.rights), 'right'], [compact(s.lefts), 'left']];
      chipRow(ctx, th, by + bh + 120, items, 200);
    });
    else if (!safe && s.likesAll >= 5) add('swipes', 'Likes sent', 'ink', function (ctx, th) {
      kicker(ctx, th, Y == null ? 'ALL YOUR LIKES' : 'YOUR ' + Y + ' IN LIKES', 300);
      bigNumber(ctx, th, fmt(s.likesAll), 640, 340);
      txt(ctx, th, plural(s.likesAll, 'like') + ' sent', M, 720, 'display', 800, 64);
      quip(ctx, th, 'Every one of them a little leap of faith.', 840);
      var items = [[fmt(s.activeDays), plural(s.activeDays, 'day') + ' on the app']];
      if (s.activeDays) items.push([fmt1(s.likesAll / s.activeDays), 'likes on a typical day']);
      chipRow(ctx, th, 1100, items, 200);
    });

    // 2. Match rate
    if (s.matchRate != null && s.matchLikes >= 10) add('match', 'Match rate', 'apricot', function (ctx, th) {
      kicker(ctx, th, 'MATCH RATE', 300);
      var r = s.matchRate, shown = r >= 10 ? String(Math.round(r)) : fmt1(r);
      var bn = bigNumber(ctx, th, shown, 600, 300);
      txt(ctx, th, 'in 100', M + bn.width + 24, 600, 'display', 800, 80, { alpha: 0.9, width: CW - bn.width - 24 });
      txt(ctx, th, swipeWord === 'swipes' ? 'of your right swipes became a match' : 'of your likes became a match', M, 676, 'sans', 700, 36, { alpha: 0.85, width: CW });
      var line = r === 0 ? 'No matches this time. Plenty of year left.' : r >= 40 ? 'Practically mutual. Every time.' : r >= 20 ? 'When you say yes, they tend to say yes back.' : r >= 8 ? 'Quality over quantity, on both sides.' : r >= 3 ? 'The algorithm made you work for it.' : 'Every match was a rare one.';
      quip(ctx, th, line, 760, { max: 44 });
      // 100 hearts
      var filled = r > 0 ? Math.max(1, Math.round(r)) : 0;
      var cols = 10, cell = CW / cols, gy = 830, rowStep = cell * 0.72;
      for (var i = 0; i < 100; i++) {
        var cx = M + (i % cols) * cell + cell / 2, cy = gy + Math.floor(i / cols) * rowStep + cell / 2;
        ctx.save(); heartPath(ctx, cx, cy, cell * 0.58);
        if (i < filled) { ctx.fillStyle = th.accent; ctx.fill(); }
        else { ctx.globalAlpha = 0.22; ctx.strokeStyle = th.ink; ctx.lineWidth = 3; ctx.stroke(); }
        ctx.restore();
      }
      var cy2 = gy + 10 * rowStep + 50;
      var items = [];
      if (!safe) { items.push([compact(s.matchFromLikes), plural(s.matchFromLikes, 'match', 'matches') + ' from your likes']); }
      if (s.inboundShare != null) items.push([pct(s.inboundShare), 'of matches liked you first']);
      else if (safe && r > 0) items.push(['1 in ' + Math.max(1, Math.round(100 / r)), swipeWord === 'swipes' ? 'right swipes matched' : 'likes matched']);
      if (items.length) chipRow(ctx, th, cy2, items, 190);
    });

    // 3. Peak season
    var monthsOk = s.months && s.months.filter(function (v) { return v > 0; }).length >= 2;
    var yearsOk = s.byYear && s.byYear.length >= 2;
    if (monthsOk || yearsOk) add('season', 'Peak season', 'lilac', function (ctx, th) {
      kicker(ctx, th, 'PEAK SEASON', 300);
      if (monthsOk) {
        var pm = s.peakMonth;
        txt(ctx, th, 'You were busiest in', M, 420, 'sans', 700, 40, { alpha: 0.85 });
        block(ctx, th, MONTHS_LONG[pm], 580, { max: 190, min: 100, lines: 1, color: th.accent });
        var line = s.cuffing ? (pm >= 9 ? 'Cuffing season: you felt it coming.' : 'Cuffing season was very much on.') : pm >= 5 && pm <= 7 ? 'Hot dating summer, as promised.' : pm >= 2 && pm <= 4 ? 'Spring fever, right on schedule.' : 'Your own season, on your own terms.';
        quip(ctx, th, line, 680);
        var top = 820, h = 600;
        bars(ctx, th, M, top, CW, h, s.months, MONTHS.map(function (m) { return m.charAt(0); }), [pm], { values: false, labelSize: 30 });
        if (s.cuffing) {
          // bracket over Oct-Feb
          ctx.save(); ctx.strokeStyle = th.soft; ctx.lineWidth = 4; ctx.globalAlpha = 0.9; ctx.setLineDash([12, 10]);
          var bw = CW / 12;
          [[M, M + 2 * bw], [M + 9 * bw, M + 12 * bw]].forEach(function (seg) { ctx.beginPath(); ctx.moveTo(seg[0] + 6, top + h + 82); ctx.lineTo(seg[1] - 6, top + h + 82); ctx.stroke(); });
          ctx.restore();
          txt(ctx, th, 'cuffing season', M + 10.5 * CW / 12, top + h + 126, 'sans', 800, 26, { align: 'center', alpha: 0.85, color: th.soft });
          txt(ctx, th, 'cuffing season', M + 1 * CW / 12, top + h + 126, 'sans', 800, 26, { align: 'center', alpha: 0.85, color: th.soft });
        }
        txt(ctx, th, safe ? pct(s.peakShare) + ' of your year\u2019s ' + swipeWord + ' happened that month' : fmt(s.months[pm]) + ' ' + (s.monthsMetric === 'swipes' ? swipeWord : 'moments on the app') + ' that month', M, 1640, 'sans', 700, 32, { alpha: 0.85, width: CW });
      } else {
        var ys = s.byYear, best = 0;
        ys.forEach(function (y, i) { if (y.v > ys[best].v) best = i; });
        txt(ctx, th, 'Your biggest year', M, 420, 'sans', 700, 40, { alpha: 0.85 });
        block(ctx, th, String(ys[best].year), 600, { max: 220, min: 120, lines: 1, color: th.accent });
        quip(ctx, th, ys.length >= 3 ? ys.length + ' years of looking for your person.' : 'Two chapters, one story.', 700);
        var shown = ys.slice(-8), off = ys.length - shown.length;
        bars(ctx, th, M, 820, CW, 640, shown.map(function (y) { return y.v; }), shown.map(function (y) { return "'" + String(y.year).slice(2); }), [best - off], { values: !safe, fmt: compact, labelSize: 30 });
      }
    });

    // 4. Busiest day
    if (s.busiest && s.busiest.count >= 3 && s.activeDays >= 3) add('busiest', 'Busiest day', 'mint', function (ctx, th) {
      var b = s.busiest, d = dayDate(b.day);
      kicker(ctx, th, b.metric === 'swipes' ? (swipeWord === 'swipes' ? 'YOUR BIGGEST SWIPING DAY' : 'YOUR BIGGEST LIKING DAY') : 'YOUR BUSIEST DAY', 300);
      txt(ctx, th, DAYS[d.wd], M, 420, 'sans', 700, 44, { alpha: 0.85 });
      block(ctx, th, MONTHS_LONG[d.mo - 1] + ' ' + d.d, 590, { max: 170, min: 90, lines: 1, color: th.accent });
      var unit = b.metric === 'swipes' ? swipeWord : 'things on the app';
      var main = safe ? (b.ratio ? fmt1(b.ratio) + '\u00d7 your usual day' : 'Your busiest day') : fmt(b.count) + ' ' + (b.count === 1 ? unit.replace(/s$/, '') : unit) + ' in one day';
      block(ctx, th, main, 720, { max: 72, min: 46, lines: 2 });
      var line = b.ratio >= 8 ? 'Some days you just had a feeling.' : b.ratio >= 4 ? 'The thumb workout of the year.' : 'A good day to be optimistic.';
      if (b.rightRate != null && s.rightRate != null && b.rightRate > s.rightRate + 0.08) line = 'And you were feeling generous: ' + pct(b.rightRate) + ' right swipes that day.';
      quip(ctx, th, line, 830, { lines: 2 });
      var wd = s.weekdays, pw = s.peakWeekday;
      txt(ctx, th, (b.metric === 'swipes' && swipeWord === 'swipes' ? 'Your swipiest weekday: ' : 'Your busiest weekday: ') + DAYS[pw], M, 1040, 'sans', 800, 36, { width: CW });
      bars(ctx, th, M, 1080, CW, 480, wd, DAYS_SHORT, [pw], { values: false });
      if (s.weekendShare != null) txt(ctx, th, pct(s.weekendShare) + ' of it on weekends', M, 1680, 'sans', 700, 30, { alpha: 0.8 });
    });

    // 5. The swipe clock
    if (s.hours && s.hours.total >= 8) add('clock', 'The swipe clock', 'plum', function (ctx, th) {
      var hr = s.hours, ph = hr.peak;
      var title = ph >= 0 && ph < 5 ? 'The ' + hourShort(ph === 0 ? 0 : ph) + ' swiper' : ph >= 22 ? 'The late-night swiper' : ph < 9 ? 'The early bird' : ph < 12 ? 'The morning person' : ph < 14 ? 'The lunch-break swiper' : ph < 18 ? 'The afternoon dater' : 'The evening romantic';
      if (hr.kind === 'messages') title = title.replace('swiper', 'texter');
      kicker(ctx, th, hr.kind === 'swipes' ? 'WHEN YOU SWIPE' : 'WHEN YOU CHAT', 300);
      var yl = block(ctx, th, title, 430, { max: 110, min: 64, lines: 2, color: th.accent });
      txt(ctx, th, 'Your peak hour: ' + hourLabel(ph) + '\u2013' + hourLabel((ph + 1) % 24), M, yl + 74, 'sans', 800, 38, { width: CW });
      // radial clock
      var cx = W / 2, cy = yl + 520, R0 = 120, R1 = 360, mx = Math.max.apply(null, hr.counts) || 1;
      ctx.save();
      ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.18; ctx.lineWidth = 2;
      [R0, (R0 + R1) / 2, R1].forEach(function (rad) { ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke(); });
      ctx.globalAlpha = 1;
      for (var h = 0; h < 24; h++) {
        var a = (h / 24) * Math.PI * 2 - Math.PI / 2, a0 = a - Math.PI / 24 * 0.78, a1 = a + Math.PI / 24 * 0.78;
        var len = R0 + (R1 - R0) * (hr.counts[h] / mx);
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(R0 + 6, len), a0, a1); ctx.arc(cx, cy, R0, a1, a0, true); ctx.closePath();
        ctx.fillStyle = h === ph ? th.accent : th.soft; ctx.globalAlpha = h === ph ? 1 : 0.55; ctx.fill();
      }
      ctx.globalAlpha = 1;
      // moon and sun hints
      ctx.fillStyle = th.ink; ctx.font = F('sans', 800, 28, false); ctx.textAlign = 'center'; ctx.globalAlpha = 0.85;
      [[0, 'midnight'], [6, '6am'], [12, 'noon'], [18, '6pm']].forEach(function (p) {
        var a = (p[0] / 24) * Math.PI * 2 - Math.PI / 2, rad = R1 + 46;
        ctx.fillText(p[1], cx + Math.cos(a) * rad, cy + Math.sin(a) * rad + 10);
      });
      ctx.globalAlpha = 1; ctx.fillStyle = th.accent; heartPath(ctx, cx, cy + 4, 90); ctx.fill();
      ctx.restore();
      var foot = cy + R1 + 130;
      var nightLine = hr.night >= 0.4 ? pct(hr.night) + ' after 10pm. Romance never sleeps.' : hr.night >= 0.15 ? pct(hr.night) + ' after 10pm, ' + 'with the rest at sensible hours.' : 'Mostly at sensible hours. Respect.';
      quip(ctx, th, nightLine, foot, { lines: 2 });
      txt(ctx, th, hr.kind === 'swipes' ? (s.has.passes ? 'From the times of your likes and passes, in your time zone.' : 'From the times of your likes, in your time zone.') : 'From the times you sent messages, in your time zone.', M, Math.min(foot + 120, 1700), 'sans', 600, 26, { alpha: 0.65, width: CW });
    });

    // 6. Longest streak
    if (s.streak && s.streak.len >= 2) add('streak', 'Longest streak', 'paper', function (ctx, th) {
      var st = s.streak;
      kicker(ctx, th, 'LONGEST STREAK', 300);
      var bn = bigNumber(ctx, th, fmt(st.len), 600, 300);
      ctx.save(); var ls = fitSize(ctx, 'days in a row', 'display', 800, 72, 40, CW - bn.width - 28, false); ctx.restore();
      txt(ctx, th, 'days in a row', M + bn.width + 28, 600, 'display', 800, ls);
      txt(ctx, th, shortDate(st.start, Y == null) + ' \u2013 ' + shortDate(st.end, Y == null || dayDate(st.end).y !== dayDate(st.start).y), M, 680, 'sans', 700, 36, { alpha: 0.85, width: CW });
      quip(ctx, th, st.len >= 60 ? 'That\u2019s not a habit, it\u2019s a lifestyle.' : st.len >= 21 ? 'Consistency is attractive, actually.' : st.len >= 7 ? 'A whole week of hope, and then some.' : 'Short and sweet.', 770);
      // year calendar: 12 rows x 31 days
      var yr = Y != null ? Y : dayDate(st.end).y;
      var actSet = s.activeSet || {};
      var top = 860, cell = CW / 31, gap = 5, rowH = cell + 9;
      for (var m = 0; m < 12; m++) {
        txt(ctx, th, MONTHS[m].charAt(0), M - 34, top + m * rowH + cell * 0.72, 'sans', 800, 22, { alpha: 0.6, align: 'center' });
        var dim = new Date(Date.UTC(yr, m + 1, 0)).getUTCDate();
        for (var dd = 1; dd <= dim; dd++) {
          var day = Math.round(Date.UTC(yr, m, dd) / 86400000);
          var on = actSet[day], inS = day >= st.start && day <= st.end, fut = s.period && day > s.period.end;
          ctx.save(); rr(ctx, M + (dd - 1) * cell + gap / 2, top + m * rowH, cell - gap, cell - gap, 5);
          ctx.fillStyle = inS ? th.accent : on ? th.soft : th.ink; ctx.globalAlpha = inS ? 1 : on ? 0.7 : fut ? 0.04 : 0.1; ctx.fill(); ctx.restore();
        }
      }
      var ly = top + 12 * rowH + 40;
      [[th.accent, 1, 'streak'], [th.soft, 0.7, 'on the app'], [th.ink, 0.1, 'day off']].forEach(function (l, i) {
        var lx = M + i * 250;
        ctx.save(); rr(ctx, lx, ly - 22, 26, 26, 5); ctx.fillStyle = l[0]; ctx.globalAlpha = l[1]; ctx.fill(); ctx.restore();
        txt(ctx, th, l[2], lx + 38, ly, 'sans', 700, 26, { alpha: 0.8 });
      });
      chipRow(ctx, th, ly + 50, [[fmt(s.activeDays), plural(s.activeDays, 'day') + ' on the app'], [pct(s.pctDays), 'of the ' + (Y == null ? 'time' : 'year so far')]], 180);
    });

    // 7. The chat report: sent vs received
    if (s.ratio != null && s.ratioSent + s.ratioRecv >= 10) add('chat', 'The chat report', 'lilac', function (ctx, th) {
      var r = s.ratio;
      kicker(ctx, th, 'THE CHAT REPORT', 300);
      txt(ctx, th, 'For every message you got, you sent', M, 420, 'sans', 700, 38, { alpha: 0.85, width: CW });
      bigNumber(ctx, th, r.toFixed(1), 680, 300);
      var label = r >= 1.5 ? 'You carry the conversation' : r >= 1.1 ? 'Always one more thing to say' : r > 0.9 ? 'Perfectly in sync' : r > 0.6 ? 'A great listener' : 'Mysterious, in a good way';
      var yl = block(ctx, th, label, 820, { max: 90, min: 56, lines: 2, color: th.accent });
      // balance scale
      var cx = W / 2, cy = Math.min(yl + 300, 1130), tilt = Math.max(-0.28, Math.min(0.28, (r - 1) * 0.35));
      ctx.save(); ctx.translate(cx, cy);
      ctx.fillStyle = th.ink; ctx.globalAlpha = 0.85; rr(ctx, -8, -10, 16, 240, 6); ctx.fill(); rr(ctx, -110, 222, 220, 22, 8); ctx.fill();
      ctx.rotate(tilt); ctx.globalAlpha = 1;
      rr(ctx, -330, -14, 660, 22, 11); ctx.fillStyle = th.ink; ctx.fill();
      [[-300, th.accent, 'you'], [300, th.soft, 'them']].forEach(function (p) {
        ctx.save(); ctx.translate(p[0], 0); ctx.rotate(-tilt);
        ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.6; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-70, 120); ctx.moveTo(0, 0); ctx.lineTo(70, 120); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = p[1]; ctx.beginPath(); ctx.ellipse(0, 128, 96, 24, 0, 0, Math.PI * 2); ctx.fill();
        // envelope on the pan
        ctx.fillStyle = th.dark ? '#fbeee6' : '#fff'; rr(ctx, -46, 54, 92, 62, 6); ctx.fill();
        ctx.strokeStyle = p[1]; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-42, 58); ctx.lineTo(0, 90); ctx.lineTo(42, 58); ctx.stroke();
        ctx.fillStyle = th.ink; ctx.font = F('sans', 800, 30, false); ctx.textAlign = 'center'; ctx.fillText(p[2], 0, 200);
        ctx.restore();
      });
      ctx.restore();
      var items = safe ? [[r.toFixed(1) + ' : 1', 'sent to received']] : [[compact(s.ratioSent), 'messages sent'], [compact(s.ratioRecv), 'messages received']];
      if (s.convo && s.convo.openerShare != null) items.push([pct(s.convo.openerShare), 'of chats you opened']);
      chipRow(ctx, th, 1440, items, 200);
    });

    // 8. Ghost town / conversation starter
    var cv = s.convo;
    if (cv && cv.messagedShare != null && cv.matched >= 3) add('ghost', 'Ghost town', 'ink', function (ctx, th) {
      kicker(ctx, th, 'GHOST TOWN', 300);
      var q = cv.quietShare;
      txt(ctx, th, 'Matches that never got a message from you', M, 420, 'sans', 700, 38, { alpha: 0.85, width: CW });
      bigNumber(ctx, th, pct(q), 700, 300);
      var line = q <= 0.1 ? 'Nobody left on read. A true gentle soul.' : q <= 0.35 ? 'Mostly said hello. A few stayed mysteries.' : q <= 0.6 ? 'Half the fun is in the matching.' : 'A collector of matches. Hellos optional.';
      var yq = quip(ctx, th, line, 800, { lines: 2 });
      // little ghosts vs envelopes: 20 icons
      var n = 20, quiet = Math.round(q * n), cell = CW / 10, gy = Math.max(yq + 60, 900);
      for (var i = 0; i < n; i++) {
        var x = M + (i % 10) * cell + cell / 2, y = gy + Math.floor(i / 10) * (cell + 20) + cell / 2;
        ctx.save();
        if (i < n - quiet) {
          ctx.fillStyle = th.accent; rr(ctx, x - 32, y - 22, 64, 44, 6); ctx.fill();
          ctx.strokeStyle = th.bg[1]; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 28, y - 18); ctx.lineTo(x, y + 4); ctx.lineTo(x + 28, y - 18); ctx.stroke();
        } else {
          ctx.fillStyle = th.ink; ctx.globalAlpha = 0.55;
          ctx.beginPath(); ctx.arc(x, y - 8, 26, Math.PI, 0); ctx.lineTo(x + 26, y + 26);
          for (var k = 0; k < 3; k++) ctx.quadraticCurveTo(x + 26 - (k * 2 + 1) * 8.7, y + 14, x + 26 - (k + 1) * 17.3, y + 26);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = th.bg[1]; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x - 9, y - 8, 4.5, 0, Math.PI * 2); ctx.arc(x + 9, y - 8, 4.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      var ly = gy + 2 * (cell + 20) + 30;
      txt(ctx, th, 'each icon = 5% of your matches', M, ly, 'sans', 600, 26, { alpha: 0.65 });
      var items = [[pct(cv.messagedShare), 'got a message from you']];
      if (cv.openerShare != null) items.push([pct(cv.openerShare), 'of chats you started']);
      else if (!safe && cv.longest >= 2) items.push([fmt(cv.longest), cv.longestBoth ? 'messages in your longest chat' : 'messages you sent in your longest chat']);
      chipRow(ctx, th, ly + 60, items, 200);
      if (!safe && cv.longest >= 2 && cv.openerShare != null) txt(ctx, th, 'Longest chat: ' + fmt(cv.longest) + ' messages' + (cv.longestBoth ? '' : ' from you') + '.', M, ly + 330, 'sans', 700, 32, { alpha: 0.85, width: CW });
    });
    else if (!safe && cv && cv.longest >= 3) add('ghost', 'Longest talk', 'ink', function (ctx, th) {
      kicker(ctx, th, 'LONGEST TALK', 300);
      txt(ctx, th, cv.longestBoth ? 'Messages in your longest chat' : 'Messages you sent in your longest chat', M, 420, 'sans', 700, 38, { alpha: 0.85, width: CW });
      bigNumber(ctx, th, fmt(cv.longest), 700, 300);
      quip(ctx, th, cv.longest >= 50 ? 'Someone had a lot to talk about.' : 'A proper conversation.', 800);
      chipRow(ctx, th, 1000, [[fmt(cv.count), plural(cv.count, 'chat') + ' with a message from you']], 200);
    });

    // 9. Dating personality
    add('persona', 'Dating personality', 'apricot', function (ctx, th) {
      var p = s.personality;
      kicker(ctx, th, 'YOUR DATING PERSONALITY', 300);
      // wax seal with a heart
      ctx.save(); ctx.translate(W / 2, 480);
      ctx.fillStyle = th.accent;
      ctx.beginPath(); for (var k = 0; k < 18; k++) { var a = k / 18 * Math.PI * 2, rad = k % 2 ? 104 : 116; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = th.bg[0]; ctx.globalAlpha = 0.5; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = th.bg[0]; heartPath(ctx, 0, 4, 92); ctx.fill();
      ctx.restore();
      var yn = block(ctx, th, p.name, 760, { max: 130, min: 70, lines: 2, align: 'center', lh: 1.0, color: th.accent });
      var yl = quip(ctx, th, p.line, yn + 96, { max: 50, lines: 3, align: 'center' });
      var ty = yl + 40;
      if (p.traits.length) {
        txt(ctx, th, 'with a streak of', W / 2, ty + 40, 'sans', 700, 30, { align: 'center', alpha: 0.75 });
        txt(ctx, th, p.traits.join(' & '), W / 2, ty + 100, 'display', 800, 52, { align: 'center', width: CW });
        ty += 110;
      }
      var tiles = [];
      if (s.rightRate != null) tiles.push([pct(s.rightRate), 'right swipes']);
      else if (!safe && s.likesAll) tiles.push([compact(s.likesAll), 'likes sent']);
      if (s.matchRate != null) tiles.push([(s.matchRate >= 10 ? Math.round(s.matchRate) : fmt1(s.matchRate)) + ' in 100', (swipeWord === 'swipes' ? 'swipes matched' : 'likes matched')]);
      if (s.peakMonth != null) tiles.push([MONTHS[s.peakMonth], 'peak month']);
      if (s.hours) tiles.push([hourShort(s.hours.peak), 'peak hour']);
      if (s.streak) tiles.push([fmt(s.streak.len), 'day streak']);
      if (s.ratio != null) tiles.push([s.ratio.toFixed(1) + ' : 1', 'sent to received']);
      if (tiles.length < 4) tiles.push([fmt(s.activeDays), plural(s.activeDays, 'day') + ' on the app']);
      chipGrid(ctx, th, Math.max(ty + 90, 1180), tiles.slice(0, 4));
    });

    return cards;
  }

  function render(canvas, card, stats, info, idx, total) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    var th = T[card.theme] || T.ink;
    background(ctx, th, (info.title || '') + card.id);
    chrome(ctx, th, info, idx, total);
    card.draw(ctx, th);
  }

  var api = { build: build, render: render, W: W, H: H, THEMES: T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DatingCards = api;
})(typeof self !== 'undefined' ? self : this);
