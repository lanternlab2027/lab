/* Year in Orders: 1080x1920 card renderer (canvas). Same engine as docs/netflix/cards.js with a "receipt"
 * look of our own (paper, ink, mint, plum). No store logos or brand colors.
 * Product names are only drawn when info.showNames is true; otherwise they become redaction bars. */
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
  var SITE = 'lanternlab2027.github.io/lab/amazon';

  var T = {
    paper: { bg: ['#f7f2e7', '#e9dfca'], ink: '#1d2433', accent: '#1f7a5c', soft: '#b5523f', dark: false },
    night: { bg: ['#17254a', '#0a1124'], ink: '#f3eee2', accent: '#7fe0b8', soft: '#f2a7c3', dark: true },
    mint:  { bg: ['#d3f0e2', '#a7dbc4'], ink: '#10291f', accent: '#7b2d5e', soft: '#1f7a5c', dark: false },
    plum:  { bg: ['#3d2050', '#1d0f28'], ink: '#f8edf5', accent: '#ffd166', soft: '#9fe3c8', dark: true },
    sky:   { bg: ['#e3ebff', '#c3d2fa'], ink: '#14213d', accent: '#c4384f', soft: '#2f5aa8', dark: false },
    forest:{ bg: ['#123a30', '#081d17'], ink: '#eef6ef', accent: '#ffd166', soft: '#7fe0b8', dark: true }
  };
  var TILE = ['#1f7a5c', '#c4384f', '#2f5aa8', '#7b2d5e', '#d49a1f', '#4b9e8a', '#8d5bb8', '#5b6b8a'];

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
  function shortDate(day, withYear) { var d = dayDate(day); return MONTHS[d.mo - 1] + ' ' + d.d + (withYear ? ', ' + d.y : ''); }
  function clock(h, mi) { return (h % 12 === 0 ? 12 : h % 12) + ':' + String(mi).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); }

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

  function fitSize(ctx, text, kind, weight, max, min, width) {
    var s = max; ctx.font = F(kind, weight, s);
    while (s > min && ctx.measureText(text).width > width) { s -= 4; ctx.font = F(kind, weight, s); }
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
    return block(ctx, th, str, y, { kind: 'serif', weight: 400, italic: true, max: o.max || 46, min: 34, lines: o.lines || 2, alpha: 0.88, align: o.align, width: o.width });
  }

  // ---------- frame ----------
  function background(ctx, th, seedKey) {
    var g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var r = rngFrom(hash(seedKey));
    // dotted grid, like graph paper
    ctx.save();
    ctx.fillStyle = th.ink; ctx.globalAlpha = th.dark ? 0.07 : 0.08;
    for (var y = 40; y < H; y += 48) for (var x = 40; x < W; x += 48) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // a few soft parcels drifting in the corner
    ctx.save();
    for (var i = 0; i < 3; i++) {
      var s = 140 + r() * 120, px = W - 160 + r() * 120 - i * 70, py = 380 + i * 520 + r() * 120;
      ctx.translate(px, py); ctx.rotate(-0.3 + r() * 0.6);
      ctx.globalAlpha = th.dark ? 0.06 : 0.07; ctx.fillStyle = th.ink;
      rr(ctx, -s / 2, -s / 2, s, s, 14); ctx.fill();
      ctx.globalAlpha = th.dark ? 0.08 : 0.09; ctx.fillRect(-s * 0.08, -s / 2, s * 0.16, s);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
    // paper grain
    ctx.save();
    ctx.fillStyle = th.dark ? '#ffffff' : '#3b2a12';
    for (var k = 0; k < 1800; k++) { ctx.globalAlpha = 0.02 + r() * 0.04; ctx.fillRect(r() * W, r() * H, 2, 2); }
    ctx.restore();
  }

  function parcel(ctx, x, y, s, fill, tape) {
    ctx.save();
    ctx.fillStyle = fill; rr(ctx, x, y, s, s * 0.82, 6); ctx.fill();
    ctx.fillStyle = tape; ctx.fillRect(x + s * 0.42, y, s * 0.16, s * 0.82);
    ctx.restore();
  }

  function chrome(ctx, th, info, idx, total) {
    ctx.save();
    parcel(ctx, M, 104, 40, th.accent, th.dark ? th.bg[1] : '#ffffff');
    ctx.fillStyle = th.ink; ctx.font = F('sans', 800, 26); spacing(ctx, 7); ctx.globalAlpha = 0.9;
    ctx.fillText('YEAR IN ORDERS', M + 60, 139);
    spacing(ctx, 0);
    ctx.font = F('display', 800, 38);
    var p = info.periodShort, pw = ctx.measureText(p).width + 60;
    var px = W - M - pw;
    ctx.globalAlpha = 1; ctx.fillStyle = th.accent;
    rr(ctx, px, 96, pw, 62, 31); ctx.fill();
    ctx.fillStyle = th.dark ? '#14110b' : '#ffffff'; ctx.textAlign = 'center'; ctx.fillText(p, px + pw / 2, 141);
    // footer
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
    ctx.fillStyle = th.accent; ctx.fillRect(M, y - 13, 56, 6);
    ctx.fillStyle = th.ink;
    ctx.font = F('sans', 800, 32); spacing(ctx, 6);
    ctx.fillText(ellipsize(ctx, str, CW - 80), M + 76, y);
    ctx.restore();
  }

  function bigNumber(ctx, th, num, y, max, o) {
    o = o || {};
    ctx.save();
    var size = fitSize(ctx, num, 'display', 800, max || 300, 90, o.width || CW);
    ctx.fillStyle = o.color || th.accent; spacing(ctx, -2);
    ctx.textAlign = o.align || 'left';
    ctx.fillText(num, o.x != null ? o.x : M - 4, y);
    var w = ctx.measureText(num).width;
    ctx.restore();
    return { size: size, width: w };
  }

  function rule(ctx, th, y, alpha, x0, x1) {
    ctx.save(); ctx.strokeStyle = th.ink; ctx.globalAlpha = alpha || 0.3; ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(x0 == null ? M : x0, y); ctx.lineTo(x1 == null ? W - M : x1, y); ctx.stroke(); ctx.restore();
  }

  function chip(ctx, th, x, y, w, h, value, label) {
    ctx.save();
    rr(ctx, x, y, w, h, 22);
    ctx.fillStyle = th.ink; ctx.globalAlpha = th.dark ? 0.09 : 0.07; ctx.fill();
    ctx.globalAlpha = 0.28; ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = th.ink;
    var vs = fitSize(ctx, value, 'display', 800, 80, 36, w - 48);
    var base = y + 26 + vs * 0.8;
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
      var bh = v ? Math.max(12, (h - (o.values === false ? 8 : 56)) * v / mx) : 6;
      var bx = x + i * bw + bw * 0.13, bwid = bw * 0.74;
      var hi = highlight.indexOf(i) >= 0;
      rr(ctx, bx, top + h - bh, bwid, bh, Math.min(10, bwid / 2));
      ctx.fillStyle = hi ? th.accent : th.soft; ctx.globalAlpha = hi ? 1 : 0.55; ctx.fill();
      ctx.globalAlpha = 1;
      if (v && o.values !== false) { ctx.font = F('display', 800, o.valueSize || 32); ctx.fillStyle = th.ink; ctx.textAlign = 'center'; ctx.fillText(o.fmt ? o.fmt(v) : fmt(v), bx + bwid / 2, top + h - bh - 14); }
      ctx.font = F('sans', 800, o.labelSize || 28); ctx.fillStyle = th.ink; ctx.globalAlpha = hi ? 1 : 0.7; ctx.textAlign = 'center';
      ctx.fillText(labels[i], bx + bwid / 2, top + h + 44);
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    ctx.save(); ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, top + h + 2); ctx.lineTo(x + w, top + h + 2); ctx.stroke(); ctx.restore();
  }

  // A redaction bar where a product name would go.
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

  // A paper receipt with a torn (zigzag) bottom edge; returns the inner drawing area.
  function receipt(ctx, x, y, w, h, seed) {
    ctx.save();
    ctx.shadowColor = 'rgba(20,20,40,0.28)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#fffdf7';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h);
    var teeth = 18, tw = w / teeth;
    for (var i = teeth; i > 0; i--) { ctx.lineTo(x + (i - 0.5) * tw, y + h - 18); ctx.lineTo(x + (i - 1) * tw, y + h); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
    return { x: x + 48, y: y + 70, w: w - 96 };
  }
  var RINK = { bg: ['#fffdf7', '#fffdf7'], ink: '#22252e', accent: '#1f7a5c', soft: '#b5523f', dark: false };

  // Receipt line: label on the left (or a redaction bar), amount on the right.
  function rline(ctx, x, y, w, label, amount, o) {
    o = o || {};
    ctx.save();
    ctx.font = F('mono', o.bold ? 800 : 600, o.size || 34); ctx.fillStyle = o.color || RINK.ink;
    ctx.textAlign = 'right'; ctx.fillText(amount, x + w, y);
    var aw = ctx.measureText(amount).width;
    ctx.textAlign = 'left';
    if (o.hidden) redacted(ctx, RINK, x, y, Math.min(w - aw - 40, o.hidden), o.size || 34, 'NAME HIDDEN', '#2d3140');
    else ctx.fillText(ellipsize(ctx, label, w - aw - 30), x, y);
    ctx.restore();
  }

  // ---------- cards ----------
  function build(stats, info) {
    var s = stats, Y = info.year, key = (info.title || '') + (Y || 'all'), C = s.currency;
    var names = !!info.showNames;
    var cards = [];
    function add(id, label, theme, draw) { cards.push({ id: id, label: label, theme: theme, draw: draw }); }
    function $(n, cents) { return money(n, C, cents); }
    var thisYear = Y ? 'in ' + Y : 'all time';

    add('total', 'Total spent', 'paper', function (ctx, th) {
      kicker(ctx, th, Y ? 'YOUR ' + Y + ' IN ORDERS' : 'ALL YOUR ORDERS', 300);
      txt(ctx, th, 'You spent', M, 440, 'display', 800, 80);
      bigNumber(ctx, th, $(s.net), 720, 290);
      var sub = 'on ' + fmt(s.orderCount) + ' ' + plural(s.orderCount, 'order') + (s.itemCount == null ? '' : ' and ' + fmt(s.itemCount) + ' ' + plural(s.itemCount, 'item')) + (s.refundTotal ? ', after refunds.' : '.');
      var y = block(ctx, th, sub, 820, { max: 60, min: 40, lines: 2 });
      var q;
      if (s.prevGross) {
        var d = s.gross - s.prevGross, pct = Math.round(Math.abs(d) / s.prevGross * 100);
        q = Math.abs(pct) < 3 ? 'About the same as ' + (Y - 1) + '. Consistent, at least.' : d > 0 ? pct + '% more than ' + (Y - 1) + '. The doorstep noticed.' : pct + '% less than ' + (Y - 1) + '. Restraint looks good on you.';
      } else q = pick(['Every one of them a small, brown-box decision.', 'Click, confirm, wait by the door. Repeat.', 'The porch has seen things.'], key + 'q');
      y = quip(ctx, th, q, y + 90, { max: 46 });
      var chips = [[fmt(s.orderCount), plural(s.orderCount, 'order')]];
      if (s.itemCount != null) chips.push([fmt(s.itemCount), plural(s.itemCount, 'item')]);
      else chips.push([fmt(s.activeDays), plural(s.activeDays, 'day') + ' with an order']);
      if (s.refundTotal) chips.push([$(s.refundTotal), 'came back in refunds']);
      else chips.push([$(s.avgOrder), 'average order']);
      var chy = Math.max(y + 110, 1060);
      chipRow(ctx, th, chy, chips, 196);
      var cy = chy + 196 + 80;
      var what = 'Counted: item totals with tax and shipping' + (s.digitalCount ? ', digital orders included' : '') + (s.refundTotal ? ', minus refunds on these orders' : s.hasRefundFile ? '; no refunds on these orders' : '; no refund file, so refunds are not taken off') + '. Cancelled orders left out.';
      ctx.save(); ctx.font = F('sans', 600, 26); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.7;
      wrap(ctx, what, CW, 3).forEach(function (l, i) { ctx.fillText(l, M, cy + i * 36); });
      ctx.restore();
      if (Y && s.firstYear && s.firstYear < Y && cy + 170 < 1740) txt(ctx, th, 'Since ' + s.firstYear + ': ' + $(s.allTime) + ' in this file, before refunds.', M, cy + 150, 'sans', 800, 30, { color: th.accent, width: CW });
    });

    if (s.orderCount >= 2 && s.everyDays) add('cadence', 'A delivery every few days', 'night', function (ctx, th) {
      kicker(ctx, th, 'HOW OFTEN', 300);
      var every = s.everyDays;
      var head = every < 1.05 ? 'An order a day, roughly' : 'An order every ' + fmt1(every) + ' days';
      var yh = block(ctx, th, head, 440, { max: 110, min: 64, lines: 2 });
      txt(ctx, th, fmt(s.orderCount) + ' ' + plural(s.orderCount, 'order') + ' over ' + fmt(s.spanDays) + ' days' + (Y ? ' of ' + Y : '') + '.', M, yh + 80, 'serif', 400, 44, { italic: true, alpha: 0.88, width: CW });
      // calendar: 12 months in a 4 x 3 grid, one square per day; lit = at least one order
      var calY = Y || dayDate(s.lastDay).y, cy0 = yh + 180;
      var cols = 4, gx = 26, mw = (CW - gx * (cols - 1)) / cols, cell = Math.floor(mw / 7), gy = 7 * cell + 40;
      ctx.save();
      for (var m = 0; m < 12; m++) {
        var ox = M + (m % cols) * (mw + gx), oy = cy0 + Math.floor(m / cols) * gy;
        ctx.font = F('sans', 800, 24); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.8; ctx.fillText(MONTHS[m].toUpperCase(), ox, oy);
        var first = Math.round(Date.UTC(calY, m, 1) / 86400000), lead = dayDate(first).wd, dim = new Date(Date.UTC(calY, m + 1, 0)).getUTCDate();
        for (var dd = 0; dd < dim; dd++) {
          var slot = lead + dd, x = ox + (slot % 7) * cell, yy = oy + 16 + Math.floor(slot / 7) * cell, pd = s.perDay[first + dd];
          rr(ctx, x, yy, cell - 4, cell - 4, 4);
          if (pd) { ctx.fillStyle = pd.orders > 1 ? th.soft : th.accent; ctx.globalAlpha = 1; }
          else { ctx.fillStyle = th.ink; ctx.globalAlpha = 0.1; }
          ctx.fill();
        }
      }
      ctx.restore();
      var my = cy0 + 3 * gy + 10;
      ctx.save(); ctx.font = F('sans', 700, 26);
      [[th.accent, 'an order that day'], [th.soft, 'two or more']].forEach(function (l, i) {
        var lx = M + i * 330; ctx.fillStyle = l[0]; rr(ctx, lx, my - 22, 26, 26, 4); ctx.fill();
        ctx.globalAlpha = 0.85; ctx.fillStyle = th.ink; ctx.fillText(l[1], lx + 40, my); ctx.globalAlpha = 1;
      });
      ctx.restore();
      if (!Y) txt(ctx, th, 'Calendar: ' + calY, W - M, my, 'sans', 700, 26, { align: 'right', alpha: 0.7 });
      var wk = s.weekdays.indexOf(Math.max.apply(null, s.weekdays));
      var cchips = [[fmt(s.activeDays), plural(s.activeDays, 'day') + ' with an order'], [DAYS[wk].slice(0, 3), 'your top ordering day']];
      if (s.itemCount != null) cchips.push([fmt(s.itemCount), plural(s.itemCount, 'item') + ' delivered']);
      chipRow(ctx, th, my + 60, cchips, 196);
      if (my + 330 < 1730) quip(ctx, th, every < 3 ? 'The delivery driver knows your dog by name.' : every < 7 ? 'A box a week keeps the doorstep busy.' : 'Measured. Deliberate. Occasional.', my + 330, { max: 44, lines: 1 });
    });

    if (s.biggest) add('biggest', 'Biggest order', 'mint', function (ctx, th) {
      var b = s.biggest, d = b.at;
      kicker(ctx, th, 'YOUR BIGGEST ORDER', 300);
      bigNumber(ctx, th, $(b.total), 560, 250);
      txt(ctx, th, DAYS[d.wd] + ', ' + MONTHS_LONG[d.mo - 1] + ' ' + d.d + (Y ? '' : ', ' + d.y) + (b.timed ? ' at ' + clock(d.h, d.mi) : ''), M, 650, 'serif', 400, 44, { italic: true, alpha: 0.88, width: CW });
      var lines = b.lines.slice().sort(function (a, c) { return c.total - a.total; });
      var shown = lines.slice(0, 5), rh = 260 + shown.length * 74 + (lines.length > shown.length ? 60 : 0);
      var area = receipt(ctx, M - 10, 730, CW + 20, rh, key);
      ctx.save(); ctx.font = F('mono', 800, 30); ctx.fillStyle = RINK.ink; ctx.textAlign = 'center'; spacing(ctx, 6);
      ctx.fillText('ORDER RECEIPT', W / 2, area.y); ctx.restore();
      rule(ctx, RINK, area.y + 34, 0.35, area.x, area.x + area.w);
      shown.forEach(function (ln, i) {
        var y = area.y + 104 + i * 74;
        // Old summary-report lines have no item name, so there is nothing to hide: they read "Shipment".
        var label = ln.noItems ? 'Shipment' + (lines.length > 1 ? ' ' + (i + 1) : '') : (ln.qty > 1 ? ln.qty + 'x ' : '') + ln.name;
        rline(ctx, area.x, y, area.w, label, $(ln.total, true), { hidden: names || ln.noItems ? 0 : 300 + (hash(ln.name) % 260) });
      });
      var ey = area.y + 104 + shown.length * 74;
      if (lines.length > shown.length) { txt(ctx, RINK, '+ ' + (lines.length - shown.length) + ' more', area.x, ey - 10, 'mono', 600, 30, { alpha: 0.7 }); ey += 60; }
      rule(ctx, RINK, ey - 30, 0.35, area.x, area.x + area.w);
      var bNoItems = b.lines.every(function (ln) { return ln.noItems; });
      rline(ctx, area.x, ey + 30, area.w, bNoItems ? 'TOTAL' : 'TOTAL  ' + fmt(b.qty) + ' ' + plural(b.qty, 'item'), $(b.total, true), { bold: true, size: 38 });
      var after = 730 + rh + 90;
      var times = b.total / (s.avgOrder || 1);
      quip(ctx, th, times >= 2 ? 'That\u2019s ' + fmt1(times) + ' times your average order. Treat yourself, apparently.' : 'Your biggest, and still pretty close to your usual.', after, { max: 46 });
      var chy = Math.max(after + 170, 1400);
      if (chy + 196 < 1700) chipRow(ctx, th, chy, [[fmt(b.qty), plural(b.qty, 'item') + ' in one order'], [fmt1(times) + '\u00d7', 'your average order'], [Math.round(b.total / (s.gross || 1) * 100) + '%', 'of your ' + (Y ? 'year' : 'total') + ' in one go']], 196);
    });

    if (s.peakMonth >= 0) add('when', 'Busiest month', 'sky', function (ctx, th) {
      kicker(ctx, th, 'WHEN YOU SHOPPED', 300);
      var vals, labels, head, peaks;
      if (Y) {
        vals = s.monthSpend; labels = MONTHS.map(function (m) { return m.charAt(0); });
        peaks = [s.peakMonth];
        head = MONTHS_LONG[s.peakMonth] + ' was your big month';
      } else {
        var ys = Object.keys(s.byYear).map(Number).sort(function (a, b) { return a - b; }).slice(-10);
        vals = ys.map(function (y) { return s.byYear[y]; }); labels = ys.map(function (y) { return '\u2019' + String(y).slice(2); });
        var mx = Math.max.apply(null, vals); peaks = [vals.indexOf(mx)];
        head = ys[peaks[0]] + ' was your biggest year';
      }
      var yh = block(ctx, th, head, 420, { max: 90, min: 56, lines: 2 });
      var pv = vals[peaks[0]];
      txt(ctx, th, $(pv) + (Y ? ' across ' + fmt(s.monthOrders[s.peakMonth]) + ' ' + plural(s.monthOrders[s.peakMonth], 'order') : ' that year') + '.', M, yh + 70, 'serif', 400, 46, { italic: true, alpha: 0.88, width: CW });
      var ctop = yh + 130;
      bars(ctx, th, M, ctop, CW, 440, vals, labels, peaks, { valueSize: 24, fmt: function (v) { return v >= 1000 ? (C === 'USD' ? '$' : '') + fmt1(v / 1000) + 'k' : fmt(v); } });
      var by = ctop + 560;
      if (s.busiestDay) {
        var bd = dayDate(s.busiestDay.day);
        txt(ctx, th, 'YOUR BUSIEST DAY', M, by, 'sans', 800, 28, { spacing: 5, alpha: 0.7 });
        block(ctx, th, DAYS[bd.wd] + ', ' + MONTHS_LONG[bd.mo - 1] + ' ' + bd.d + (Y ? '' : ', ' + bd.y), by + 80, { max: 72, min: 48, lines: 1, color: th.accent });
        txt(ctx, th, fmt(s.busiestDay.orders) + ' separate ' + plural(s.busiestDay.orders, 'order') + ', ' + $(s.busiestDay.total) + ' in one day.', M, by + 150, 'sans', 700, 34, { width: CW });
      }
      var wk = s.weekdays.indexOf(Math.max.apply(null, s.weekdays));
      txt(ctx, th, DAYS[wk] + 's were your top day of the week (' + fmt(s.weekdays[wk]) + ' ' + plural(s.weekdays[wk], 'order') + ').', M, Math.min(by + 230, 1730), 'sans', 600, 30, { alpha: 0.8, width: CW });
    });

    if (s.categories) add('categories', 'Top categories', 'forest', function (ctx, th) {
      kicker(ctx, th, 'WHERE IT WENT', 300);
      var top = s.categories.slice(0, 5), mx = top[0].total;
      var yh = block(ctx, th, 'Mostly ' + top[0].name, 430, { max: 96, min: 52, lines: 2 });
      txt(ctx, th, Math.round(top[0].total / s.gross * 100) + '% of your spend, by the department in your file.', M, yh + 66, 'serif', 400, 40, { italic: true, alpha: 0.85, width: CW });
      var y = yh + 170;
      top.forEach(function (c, i) {
        var yy = y + i * 190;
        txt(ctx, th, c.name, M, yy, 'display', 800, 52, { width: CW - 220, color: i === 0 ? th.accent : th.ink });
        txt(ctx, th, $(c.total), W - M, yy, 'display', 800, 52, { align: 'right' });
        ctx.save(); rr(ctx, M, yy + 34, CW, 34, 17); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.12; ctx.fill();
        rr(ctx, M, yy + 34, Math.max(34, CW * c.total / mx), 34, 17); ctx.globalAlpha = 1; ctx.fillStyle = i === 0 ? th.accent : th.soft; ctx.fill(); ctx.restore();
        txt(ctx, th, fmt(c.items) + ' ' + plural(c.items, 'item'), M, yy + 112, 'sans', 700, 28, { alpha: 0.7 });
      });
      var others = s.categories.length - top.length;
      if (others > 0) txt(ctx, th, '+ ' + others + ' more ' + plural(others, 'department'), M, Math.min(y + top.length * 190 + 20, 1740), 'sans', 700, 30, { alpha: 0.75 });
    });

    if (s.reorder) add('reorder', 'Most re-ordered', 'plum', function (ctx, th) {
      var r = s.reorder;
      kicker(ctx, th, 'ON REPEAT', 300);
      var bn = bigNumber(ctx, th, fmt(r.times) + '\u00d7', 640, 320, { width: 560 });
      txt(ctx, th, 'the same', M + bn.width + 30, 530, 'display', 800, 72);
      txt(ctx, th, 'thing', M + bn.width + 30, 610, 'display', 800, 72, { alpha: 0.75 });
      var y = 760;
      if (names) y = block(ctx, th, r.name, y, { max: 72, min: 44, lines: 3, color: th.ink }) + 30;
      else { redacted(ctx, th, M, y, CW * 0.86, 76, 'NAME HIDDEN', th.accent); redacted(ctx, th, M, y + 92, CW * 0.55, 76, '', th.accent); y += 130; }
      txt(ctx, th, 'Your most re-ordered item', M, y + 40, 'serif', 400, 42, { italic: true, alpha: 0.85 });
      var gap = s.spanDays && r.times > 1 ? s.spanDays / r.times : 0;
      chipRow(ctx, th, y + 130, [[fmt(r.times), 'separate orders'], [$(r.total), 'spent on it ' + thisYear], [gap ? '~' + fmt(Math.max(1, gap / 7)) + ' wk' : fmt(r.qty), gap ? 'between orders' : 'bought']], 196);
      quip(ctx, th, r.times >= 8 ? 'At this point, consider a subscription.' : r.times >= 4 ? 'A staple. The pantry would riot without it.' : 'Once was not enough.', y + 420, { max: 46 });
      if (s.reorderCount > 1) txt(ctx, th, fmt(s.reorderCount) + ' different items were ordered more than once.', M, Math.min(y + 560, 1740), 'sans', 700, 30, { alpha: 0.75, width: CW });
    });

    if (s.late && s.late.count) add('late', 'Late-night orders', 'night', function (ctx, th) {
      var L = s.late;
      kicker(ctx, th, 'AFTER MIDNIGHT', 300);
      var bn = bigNumber(ctx, th, fmt(L.count), 620, 300, { width: 420 });
      txt(ctx, th, plural(L.count, 'order'), M + bn.width + 28, 520, 'display', 800, 76);
      txt(ctx, th, 'placed 12\u20135 am', M + bn.width + 28, 600, 'display', 800, 64, { alpha: 0.75 });
      // a 24-hour clock with order counts
      var cx = W / 2, cy = 1050, R0 = 140, R1 = 280, mx = Math.max.apply(null, s.hours) || 1;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R1 + 24, 0, Math.PI * 2); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.06; ctx.fill();
      for (var h = 0; h < 24; h++) {
        var a0 = (h / 24) * Math.PI * 2 - Math.PI / 2, a1 = ((h + 1) / 24) * Math.PI * 2 - Math.PI / 2, len = R0 + (R1 - R0) * s.hours[h] / mx;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a0) * R0, cy + Math.sin(a0) * R0);
        ctx.arc(cx, cy, Math.max(R0 + 6, len), a0 + 0.02, a1 - 0.02); ctx.arc(cx, cy, R0, a1 - 0.02, a0 + 0.02, true); ctx.closePath();
        ctx.fillStyle = h < 5 ? th.soft : th.accent; ctx.globalAlpha = s.hours[h] ? (h < 5 ? 1 : 0.55) : 0.15; ctx.fill();
      }
      ctx.restore();
      [['12am', 0], ['6am', 6], ['noon', 12], ['6pm', 18]].forEach(function (l) {
        var a = (l[1] / 24) * Math.PI * 2 - Math.PI / 2;
        txt(ctx, th, l[0], cx + Math.cos(a) * (R1 + 64), cy + Math.sin(a) * (R1 + 64) + 10, 'sans', 800, 26, { align: 'center', alpha: 0.8 });
      });
      txt(ctx, th, 'orders by hour', cx, cy + 10, 'sans', 700, 26, { align: 'center', alpha: 0.6 });
      var y = cy + R1 + 150;
      if (L.latest) txt(ctx, th, 'Latest of the late: ' + clock(Math.floor(L.latest.min / 60), L.latest.min % 60) + '.', M, y, 'display', 800, 56, { color: th.soft, width: CW });
      quip(ctx, th, L.share > 0.15 ? 'Sleep is temporary. Two-day shipping is forever.' : pick(['Nothing good happens after midnight, except checkout.', 'The 2am cart: no regrets, only tracking numbers.'], key + 'l'), y + 90, { max: 44 });
      txt(ctx, th, Math.round(L.share * 100) + '% of your orders, ' + $(L.total) + ' in all. Times are in this device\u2019s time zone.', M, Math.min(y + 230, 1740), 'sans', 600, 26, { alpha: 0.7, width: CW });
    });

    if (s.orderCount >= 2) add('average', 'Average order', 'paper', function (ctx, th) {
      kicker(ctx, th, 'THE TYPICAL ORDER', 300);
      txt(ctx, th, 'Your average order', M, 440, 'display', 800, 72);
      bigNumber(ctx, th, $(s.avgOrder, true), 700, 260);
      quip(ctx, th, 'Middle of the pack: ' + $(s.medianOrder, true) + '. Half your orders were under that.', 790, { max: 40 });
      var labs = ['Under ' + $(25), $(25) + '\u2013' + $(100), $(100) + '\u2013' + $(250), $(250) + '+'];
      var mx = Math.max.apply(null, s.buckets) || 1, y = 930;
      s.buckets.forEach(function (v, i) {
        var yy = y + i * 150;
        txt(ctx, th, labs[i], M, yy + 40, 'sans', 800, 34);
        txt(ctx, th, fmt(v) + ' ' + plural(v, 'order'), W - M, yy + 40, 'sans', 800, 34, { align: 'right', alpha: 0.85 });
        ctx.save(); rr(ctx, M, yy + 64, CW, 36, 18); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.1; ctx.fill();
        if (v) { rr(ctx, M, yy + 64, Math.max(36, CW * v / mx), 36, 18); ctx.globalAlpha = 1; ctx.fillStyle = v === mx ? th.accent : th.soft; ctx.fill(); }
        ctx.restore();
      });
      var small = s.buckets[0] / (s.orderCount || 1);
      quip(ctx, th, small >= 0.5 ? 'Death by a thousand small boxes.' : small >= 0.3 ? 'Mostly modest, with the odd splurge.' : 'You don\u2019t do small orders. Respect.', 1560, { max: 46 });
      if (s.topItem && names) txt(ctx, th, 'Most spent on one item: ' + s.topItem.name, M, 1700, 'sans', 700, 28, { alpha: 0.8, width: CW });
    });

    add('receipt', 'Your year, itemized', 'forest', function (ctx, th) {
      kicker(ctx, th, Y ? 'YOUR ' + Y + ', ITEMIZED' : 'ALL TIME, ITEMIZED', 300);
      var rows = [];
      rows.push(['Orders', fmt(s.orderCount)]);
      if (s.itemCount != null) rows.push(['Items', fmt(s.itemCount)]);
      if (s.everyDays && s.orderCount > 1) rows.push(['An order every', fmt1(s.everyDays) + ' days']);
      if (s.biggest) rows.push(['Biggest order', $(s.biggest.total, true)]);
      rows.push(['Average order', $(s.avgOrder, true)]);
      if (Y && s.peakMonth >= 0) rows.push(['Busiest month', MONTHS[s.peakMonth]]);
      if (s.reorder) rows.push(['Most re-ordered', fmt(s.reorder.times) + '\u00d7']);
      if (s.late) rows.push(['Orders after midnight', fmt(s.late.count)]);
      if (s.categories) rows.push(['Top department', s.categories[0].name.split(/[,&]/)[0].trim()]);
      if (names && s.topItem) rows.push(['Top item', s.topItem.name]);
      var rh = 300 + rows.length * 72 + (s.refundTotal ? 150 : 70) + 100;
      var area = receipt(ctx, M - 10, 400, CW + 20, Math.min(rh, 1280), key);
      ctx.save(); ctx.font = F('mono', 800, 40); ctx.fillStyle = RINK.ink; ctx.textAlign = 'center'; spacing(ctx, 8);
      ctx.fillText('YEAR IN ORDERS', W / 2, area.y + 10); ctx.font = F('mono', 600, 28); spacing(ctx, 2);
      ctx.fillText(info.periodShort + '  \u00b7  ' + C, W / 2, area.y + 56); ctx.restore();
      rule(ctx, RINK, area.y + 92, 0.4, area.x, area.x + area.w);
      var y = area.y + 160;
      rows.forEach(function (r) {
        ctx.save(); ctx.font = F('mono', 600, 32); ctx.fillStyle = RINK.ink;
        var vw = Math.min(area.w * 0.55, ctx.measureText(r[1]).width);
        ctx.textAlign = 'right'; ctx.fillText(ellipsize(ctx, r[1], area.w * 0.55), area.x + area.w, y);
        ctx.textAlign = 'left'; ctx.globalAlpha = 0.8; ctx.fillText(ellipsize(ctx, r[0], area.w - vw - 30), area.x, y);
        ctx.restore(); y += 72;
      });
      rule(ctx, RINK, y - 26, 0.4, area.x, area.x + area.w);
      y += 30;
      if (s.refundTotal) {
        rline(ctx, area.x, y, area.w, 'SUBTOTAL', $(s.gross, true), { size: 34 });
        rline(ctx, area.x, y + 60, area.w, 'REFUNDS', '\u2212' + $(s.refundTotal, true), { size: 34, color: RINK.soft });
        y += 130;
      }
      rline(ctx, area.x, y, area.w, 'TOTAL', $(s.net, true), { size: 46, bold: true });
      // barcode
      var bx = area.x, bw = area.w, by = y + 50, rnd = rngFrom(hash(key + 'bar'));
      ctx.save(); ctx.fillStyle = RINK.ink;
      for (var x = bx; x < bx + bw && by + 70 < 400 + Math.min(rh, 1280) - 30; ) { var w = 2 + Math.floor(rnd() * 4) * 2; ctx.fillRect(x, by, w, 60); x += w + 3 + Math.floor(rnd() * 3) * 3; }
      ctx.restore();
      var ty = 400 + Math.min(rh, 1280) + 80;
      if (ty < 1720) quip(ctx, th, 'Thank you for shopping. Please keep this receipt.', ty, { max: 42, lines: 1 });
    });

    return cards;
  }

  function render(canvas, card, stats, info, idx, total) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    var th = T[card.theme] || T.paper;
    background(ctx, th, (info.title || '') + card.id);
    chrome(ctx, th, info, idx, total);
    card.draw(ctx, th);
  }

  var api = { build: build, render: render, W: W, H: H, THEMES: T, money: money };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AmazonCards = api;
})(typeof self !== 'undefined' ? self : this);
