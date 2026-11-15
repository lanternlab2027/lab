/* Reading Wrapped: 1080x1920 card renderer (canvas). Structure follows docs/wrapped/cards.js; bookish palette. */
(function (root) {
  'use strict';

  var W = 1080, H = 1920, M = 96, CW = W - 2 * M;
  var SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, Cambria, Caladea, "DejaVu Serif", serif';
  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SITE = 'lanternlab2027.github.io/lab/reading';

  // Warm paper, deep greens, burgundy, a little gilt.
  var T = {
    forest: { bg: ['#1b4632', '#0d281c'], ink: '#f6eddb', accent: '#e4bc62', soft: '#9fc2a6', dark: true },
    paper:  { bg: ['#f8f0de', '#ecdfc2'], ink: '#1f2c23', accent: '#7d1f32', soft: '#2f6048', dark: false },
    claret: { bg: ['#80233a', '#3f0e1a'], ink: '#f8eedc', accent: '#f1cb78', soft: '#e7a3ad', dark: true },
    sage:   { bg: ['#e6ead8', '#cdd7bd'], ink: '#18311f', accent: '#7d1f32', soft: '#4f7a5c', dark: false },
    gilt:   { bg: ['#f3d98d', '#d7a647'], ink: '#2b1b0b', accent: '#7d1f32', soft: '#6b4a17', dark: false },
    ink:    { bg: ['#262824', '#121311'], ink: '#efe6d1', accent: '#dc7d8a', soft: '#a9b8a4', dark: true }
  };
  var SPINES = ['#1f4a35', '#7d1f32', '#c99a3b', '#2f6a5a', '#a8443f', '#e6d6b0', '#3d3b5e', '#8a6a3a', '#5d8462', '#d9b45a', '#4a1622', '#93a88a'];

  function F(kind, weight, size, italic) { return (italic ? 'italic ' : '') + weight + ' ' + size + 'px ' + (kind === 'serif' ? SERIF : SANS); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, ''); }
  function fmt2(n) { return n.toFixed(2); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pick(arr, key) { return arr[hash(key) % arr.length]; }
  function rngFrom(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function spacing(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }
  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }

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
    if (ctx.measureText(text).width <= width) return text;
    var chars = Array.from(text);
    while (chars.length > 1 && ctx.measureText(chars.join('') + '\u2026').width > width) chars.pop();
    return chars.join('').trim() + '\u2026';
  }

  function wrap(ctx, text, width, maxLines) {
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
    return lines.map(function (l) { return ellipsize(ctx, l, width); });
  }

  // Largest size (max..min) at which text wraps into <= maxLines lines that all fit.
  function fitWrap(ctx, text, kind, weight, max, min, width, maxLines, italic) {
    var size = max, lines;
    for (;;) {
      ctx.font = F(kind, weight, size, italic);
      lines = wrap(ctx, text, width);
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
    var s = o.width ? ellipsize(ctx, str, o.width) : str;
    ctx.fillText(s, x, y);
    ctx.restore();
  }

  // Wrapped serif block; returns the baseline of the last line.
  function block(ctx, th, str, y, o) {
    o = o || {};
    ctx.save();
    var f = fitWrap(ctx, str, o.kind || 'serif', o.weight || 700, o.max || 110, o.min || 56, o.width || CW, o.lines || 3, o.italic);
    ctx.fillStyle = o.color || th.ink; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.textAlign = o.align || 'left';
    var x = o.x != null ? o.x : (o.align === 'center' ? W / 2 : M);
    var lh = f.size * (o.lh || 1.08);
    f.lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * lh); });
    ctx.restore();
    return y + (f.lines.length - 1) * lh;
  }

  // ---------- frame ----------
  function background(ctx, th, seedKey) {
    var g = ctx.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var r = rngFrom(hash(seedKey));
    // a soft lamp-light glow
    var gx = r() * W, gy = 200 + r() * 600;
    var rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, 900);
    rg.addColorStop(0, th.dark ? 'rgba(255,236,190,0.13)' : 'rgba(255,255,255,0.45)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    // paper grain
    ctx.save();
    ctx.fillStyle = th.dark ? '#ffffff' : '#3b2a12';
    for (var i = 0; i < 7000; i++) {
      ctx.globalAlpha = 0.025 + r() * 0.05;
      var s = r() < 0.9 ? 1.6 : 2.6;
      ctx.fillRect(r() * W, r() * H, s, s);
    }
    ctx.restore();
    // vignette
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, th.dark ? 'rgba(0,0,0,0.35)' : 'rgba(90,60,20,0.16)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // double-rule frame with corner diamonds
    ctx.save();
    ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.32;
    ctx.lineWidth = 3; ctx.strokeRect(36, 36, W - 72, H - 72);
    ctx.lineWidth = 1.5; ctx.strokeRect(50, 50, W - 100, H - 100);
    ctx.globalAlpha = 0.85; ctx.fillStyle = th.accent;
    [[43, 43], [W - 43, 43], [43, H - 43], [W - 43, H - 43]].forEach(function (p) {
      ctx.beginPath(); ctx.moveTo(p[0], p[1] - 12); ctx.lineTo(p[0] + 12, p[1]); ctx.lineTo(p[0], p[1] + 12); ctx.lineTo(p[0] - 12, p[1]); ctx.closePath(); ctx.fill();
    });
    ctx.restore();
  }

  function chrome(ctx, th, info, idx, total) {
    ctx.save();
    ctx.fillStyle = th.ink; ctx.textBaseline = 'alphabetic';
    ctx.font = F('sans', 800, 26, false); spacing(ctx, 7); ctx.globalAlpha = 0.85;
    ctx.fillText('READING WRAPPED', M, 140);
    spacing(ctx, 0);
    // period tag
    ctx.font = F('serif', 700, 36, true);
    var p = info.periodShort, pw = ctx.measureText(p).width + 52;
    ctx.globalAlpha = 1;
    rr(ctx, W - M - pw, 96, pw, 62, 31);
    ctx.strokeStyle = th.ink; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.7; ctx.stroke();
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillText(p, W - M - pw / 2, 139);
    // footer
    ctx.textAlign = 'left'; ctx.globalAlpha = 0.95;
    ctx.font = F('serif', 700, 36, true);
    ctx.fillText(ellipsize(ctx, info.title, 640), M, H - 128);
    // "Make yours" line: the card itself carries the way back to the app.
    ctx.font = F('sans', 700, 25, false); ctx.globalAlpha = 0.85;
    var mk = 'Make yours: ' + SITE;
    ctx.fillText(mk, M, H - 86);
    var mw = ctx.measureText(mk).width;
    ctx.textAlign = 'right'; ctx.font = F('sans', 800, 30, false); ctx.globalAlpha = 0.9;
    ctx.fillText(idx + ' / ' + total, W - M, H - 128);
    ctx.font = F('sans', 600, 25, false); ctx.globalAlpha = 0.72;
    if (mw + ctx.measureText('made on-device').width + 32 <= W - 2 * M) ctx.fillText('made on-device', W - M, H - 86);
    ctx.restore();
  }

  // Small-caps kicker with a short accent rule.
  function kicker(ctx, th, str, y) {
    ctx.save();
    ctx.fillStyle = th.accent; ctx.fillRect(M, y - 13, 56, 5);
    ctx.font = F('sans', 800, 32, false); spacing(ctx, 6);
    ctx.fillStyle = th.accent;
    ctx.fillText(ellipsize(ctx, str, CW - 80), M + 76, y);
    ctx.restore();
    return y;
  }

  function bigNumber(ctx, th, num, y, max, o) {
    o = o || {};
    ctx.save();
    var size = fitSize(ctx, num, 'serif', 700, max || 300, 100, o.width || CW, true);
    ctx.fillStyle = o.color || th.accent; spacing(ctx, -4);
    ctx.textAlign = o.align || 'left';
    ctx.fillText(num, o.x != null ? o.x : M - 8, y);
    ctx.restore();
    return size;
  }

  function rule(ctx, th, y, alpha) {
    ctx.save(); ctx.strokeStyle = th.ink; ctx.globalAlpha = alpha || 0.3; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); ctx.restore();
  }

  function fleuron(ctx, th, cx, cy, s) {
    ctx.save(); ctx.fillStyle = th.accent; ctx.strokeStyle = th.accent; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s * 0.55, cy); ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s * 0.55, cy); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(cx - s * 5, cy); ctx.lineTo(cx - s * 1.2, cy); ctx.moveTo(cx + s * 1.2, cy); ctx.lineTo(cx + s * 5, cy); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx - s * 5.6, cy, s * 0.28, 0, Math.PI * 2); ctx.arc(cx + s * 5.6, cy, s * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Stat tile: big serif value + small sans label.
  function chip(ctx, th, x, y, w, h, value, label) {
    ctx.save();
    rr(ctx, x, y, w, h, 26);
    ctx.fillStyle = th.ink; ctx.globalAlpha = th.dark ? 0.09 : 0.07; ctx.fill();
    ctx.globalAlpha = 0.28; ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = th.ink;
    var vs = fitSize(ctx, value, 'serif', 700, 84, 40, w - 56, false);
    var base = y + 30 + vs * 0.8;
    ctx.fillText(value, x + 28, base);
    ctx.font = F('sans', 700, 28, false); ctx.globalAlpha = 0.78;
    wrap(ctx, label, w - 56, 2).forEach(function (l, i) { ctx.fillText(l, x + 28, base + 48 + i * 34); });
    ctx.restore();
  }

  function chipRow(ctx, th, y, items, h) {
    var gap = 24, n = items.length, w = (CW - gap * (n - 1)) / n;
    items.forEach(function (it, i) { chip(ctx, th, M + i * (w + gap), y, w, h || 210, it[0], it[1]); });
  }

  function starPath(ctx, cx, cy, R) {
    var r = R * 0.48;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
      ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    ctx.closePath();
  }

  function stars(ctx, th, x, cy, R, rating, gap, color) {
    ctx.save();
    for (var i = 0; i < 5; i++) {
      var cx = x + R + i * (2 * R + gap);
      starPath(ctx, cx, cy, R);
      ctx.fillStyle = th.ink; ctx.globalAlpha = 0.16; ctx.fill();
      var frac = Math.max(0, Math.min(1, rating - i));
      if (frac > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(cx - R, cy - R, 2 * R * frac, 2 * R); ctx.clip();
        starPath(ctx, cx, cy, R); ctx.globalAlpha = 1; ctx.fillStyle = color || th.accent; ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
    return x + 5 * 2 * R + 4 * gap;
  }

  // Books as spines on one or two shelves. Thickness follows page count; a short year gets one shelf of bigger books.
  function shelf(ctx, th, books, top, rows, rowH) {
    var gap = 3;
    var widths = books.map(function (b) { return Math.max(14, Math.min(46, 12 + (b.pages || 300) / 16)); });
    var total = widths.reduce(function (s, w) { return s + w + gap; }, 0);
    var scale, hScale = 1;
    if (total <= CW * 0.9) { rows = 1; scale = Math.min(2.2, CW * 0.75 / total); hScale = 1.45; top += rowH * 2 - rowH * hScale; rowH *= hScale; }
    else scale = Math.max(5 / 14, Math.min(1, (CW * rows - 60 * rows) / total));
    function fits(reserve) {
      var xx = M, rw = 0;
      for (var k = 0; k < books.length; k++) { var ww = widths[k] * scale; if (xx + ww > W - M - (rw === rows - 1 ? reserve : 0)) { rw++; xx = M; if (rw >= rows) return k; } xx += ww + gap; }
      return books.length;
    }
    var reserve = fits(0) < books.length ? 150 : 0, limit = fits(reserve);
    var x = M, row = 0, drawn = 0;
    ctx.save();
    for (var i = 0; i < limit; i++) {
      var w = widths[i] * scale;
      if (x + w > W - M - (row === rows - 1 ? reserve : 0)) { row++; x = M; }
      var b = books[i], hh = hash(b.title + b.author);
      var h = rowH * (0.62 + (hh % 1000) / 1000 * 0.3);
      var base = top + (row + 1) * rowH;
      var col = SPINES[hh % SPINES.length];
      if (col.toLowerCase() === th.bg[0].toLowerCase()) col = SPINES[(hh + 1) % SPINES.length];
      ctx.globalAlpha = 1;
      rr(ctx, x, base - h, w, h, Math.min(4, w / 4));
      ctx.fillStyle = col; ctx.fill();
      ctx.globalAlpha = 0.25; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
      if (w >= 10) {
        ctx.globalAlpha = 0.55; ctx.fillStyle = (hh >> 3) % 2 ? '#f1d48a' : '#fff6e0';
        ctx.fillRect(x + 2, base - h + 14 * hScale, w - 4, 3 * hScale);
        ctx.fillRect(x + 2, base - 20 * hScale, w - 4, 3 * hScale);
      }
      x += w + gap; drawn++;
    }
    for (var r = 0; r < rows; r++) {
      var y = top + (r + 1) * rowH;
      ctx.globalAlpha = 1; ctx.fillStyle = th.dark ? '#c9a46a' : '#6b4a26';
      rr(ctx, M - 18, y, CW + 36, 14, 4); ctx.fill();
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.fillRect(M - 18, y + 14, CW + 36, 8);
    }
    ctx.restore();
    if (drawn < books.length) txt(ctx, th, '+' + fmt(books.length - drawn) + ' more', W - M, top + rows * rowH - 16, 'sans', 800, 30, { align: 'right', alpha: 0.9 });
  }

  // ---------- cards ----------
  function build(stats, info) {
    var s = stats, Y = info.year, key = (info.title || '') + (Y || 'all');
    var period = Y ? String(Y) : 'all time';
    var thisYear = Y ? 'this year' : 'so far';
    var cards = [], foldLongest = false;
    function add(id, label, theme, draw) { cards.push({ id: id, label: label, theme: theme, draw: draw }); }
    var src = s.source === 'storygraph' ? 'StoryGraph' : 'Goodreads';

    add('books', 'Books read', 'forest', function (ctx, th) {
      kicker(ctx, th, Y ? 'YOUR ' + Y + ' IN BOOKS' : 'YOUR READING LIFE', 300);
      bigNumber(ctx, th, fmt(s.count), 690, 420);
      txt(ctx, th, plural(s.count, 'book finished', 'books finished'), M, 790, 'serif', 700, 72);
      var sub = '';
      if (s.prevCount != null && s.prevCount > 0) {
        var d = s.count - s.prevCount;
        sub = d > 0 ? fmt(d) + ' more than ' + (Y - 1) + '. Look at you.' : d < 0 ? fmt(-d) + ' fewer than ' + (Y - 1) + ', and that\u2019s fine.' : 'Exactly the same as ' + (Y - 1) + '. Consistent.';
      } else if (s.library) sub = pick(['Borrowed, read and returned.', 'Every loan you brought back, counted.'], key + 'b');
      else sub = pick(['Every one of them counted.', 'One page at a time.', 'Here\u2019s the whole shelf.'], key + 'b');
      txt(ctx, th, sub, M, 866, 'serif', 400, 46, { italic: true, alpha: 0.88, width: CW });
      shelf(ctx, th, s.list, 930, 2, 230);
      var chips = [];
      if (s.pagesKnown) chips.push([fmt(s.pages), 'pages']);
      if (s.library) chips.push([fmt(s.library.loans), plural(s.library.loans, 'library loan')]);
      chips.push([fmt(s.authorCount), plural(s.authorCount, 'author')]);
      if (s.myAvg) chips.push([fmt2(s.myAvg), 'avg rating']);
      chips.push([fmt1(s.booksPerMonth), 'books a month']);
      chipRow(ctx, th, 1460, chips.slice(0, 3), 200);
    });

    if (s.pagesKnown) add('pages', 'Pages read', 'paper', function (ctx, th) {
      kicker(ctx, th, 'PAGES TURNED', 300);
      bigNumber(ctx, th, fmt(s.pages), 600, 290);
      txt(ctx, th, 'pages read in ' + period, M, 690, 'serif', 700, 64);
      txt(ctx, th, 'That\u2019s about ' + fmt(Math.max(1, s.perDay)) + ' ' + plural(Math.round(Math.max(1, s.perDay)), 'page') + ' a day, every day.', M, 770, 'serif', 400, 46, { italic: true, alpha: 0.85, width: CW });
      // the year as a stack of books, thickness by pages
      var books = s.list.filter(function (b) { return b.pages; });
      var top = 850, bottom = 1360, room = bottom - top;
      var tot = books.reduce(function (a, b) { return a + b.pages; }, 0) || 1;
      var n = books.length, sgap = n > 60 ? 1 : 2, minH = n > 100 ? 1.5 : n > 50 ? 3 : 4;
      var unit = Math.min(Math.max(0, room - n * (sgap + minH)) / tot, 0.28), y = bottom, longY = null;
      ctx.save();
      ctx.fillStyle = th.dark ? '#c9a46a' : '#6b4a26'; rr(ctx, M + 40, bottom + 2, CW - 80, 12, 4); ctx.fill();
      books.forEach(function (b, i) {
        var hh = hash(b.title + i), h = minH + b.pages * unit;
        var w = 520 + (hh % 220), x = W / 2 - w / 2 + ((hh >> 4) % 50) - 25;
        y -= h + sgap;
        rr(ctx, x, y, w, h, Math.min(5, h / 3));
        ctx.fillStyle = foldLongest && b === s.longest ? th.accent : SPINES[hh % SPINES.length]; ctx.fill();
        ctx.globalAlpha = 0.18; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
        if (foldLongest && b === s.longest) longY = y + h / 2;
        if (h >= 10) { ctx.fillStyle = '#fbf3df'; ctx.globalAlpha = 0.85; ctx.fillRect(x + w - 26, y + 2, 18, h - 4); ctx.globalAlpha = 1; }
      });
      ctx.restore();
      if (foldLongest && s.longest) txt(ctx, th, 'Longest: ' + s.longest.title + ', ' + fmt(s.longest.pages) + ' pages', W / 2, bottom + 62, 'serif', 700, 36, { italic: true, align: 'center', color: th.accent, width: CW });
      else txt(ctx, th, 'Your ' + (Y ? 'year' : 'reading') + ', stacked', W / 2, bottom + 62, 'serif', 400, 36, { italic: true, align: 'center', alpha: 0.75 });
      var chips = [[fmt(s.avgPages), 'pages in an average book']];
      chips.push([fmt1(s.booksPerMonth), 'books a month']);
      chipRow(ctx, th, 1530, chips, 190);
      if (s.pagesKnown < s.count) txt(ctx, th, (s.count - s.pagesKnown) + ' ' + plural(s.count - s.pagesKnown, 'book') + ' had no page count, so ' + plural(s.count - s.pagesKnown, 'it isn\u2019t', 'they aren\u2019t') + ' counted here.', W / 2, bottom + 112, 'sans', 600, 26, { alpha: 0.7, width: CW, align: 'center' });
    });

    if (s.longest && s.pagesKnown >= 2) add('longest', 'The longest book', 'claret', function (ctx, th) {
      var b = s.longest;
      kicker(ctx, th, 'THE LONGEST ONE', 300);
      bigNumber(ctx, th, fmt(b.pages), 590, 300);
      txt(ctx, th, 'pages', M, 670, 'serif', 700, 64, { alpha: 0.95 });
      var yb = block(ctx, th, b.title, 820, { max: 112, min: 60, lines: 3 });
      txt(ctx, th, 'by ' + b.author, M, yb + 80, 'serif', 400, 50, { italic: true, alpha: 0.88, width: CW });
      // length comparison bars
      var rows = [['This one', b.pages, true], ['Your average', Math.round(s.avgPages)]];
      if (s.shortest) rows.push(['Your shortest', s.shortest.pages]);
      var by = Math.max(yb + 200, 1170), mx = b.pages;
      rows.forEach(function (r, i) {
        var y = by + i * 128;
        txt(ctx, th, r[0], M, y, 'sans', 700, 30, { alpha: 0.8 });
        txt(ctx, th, fmt(r[1]), W - M, y, 'sans', 800, 30, { align: 'right', alpha: 0.9 });
        ctx.save(); rr(ctx, M, y + 20, CW, 40, 20); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.12; ctx.fill();
        rr(ctx, M, y + 20, Math.max(40, CW * r[1] / mx), 40, 20); ctx.globalAlpha = 1; ctx.fillStyle = r[2] ? th.accent : th.ink; if (!r[2]) ctx.globalAlpha = 0.6; ctx.fill(); ctx.restore();
      });
      var line = b.pages >= 700 ? pick(['A true doorstopper. Your wrists deserve a medal.', 'Brick-sized, and you finished it anyway.', 'Some books you read. This one you climbed.'], key + 'l') : pick(['The longest of the year, and worth every page.', 'You settled in for the long haul on this one.'], key + 'l2');
      block(ctx, th, line, by + rows.length * 128 + 70, { max: 46, min: 36, lines: 2, italic: true, weight: 400, alpha: 0.88 });
    });

    add('rhythm', 'Reading pace by month', 'sage', function (ctx, th) {
      kicker(ctx, th, 'YOUR READING RHYTHM', 300);
      var vals, labels, peak, head, sub, peaks = null;
      if (Y) {
        vals = s.months; labels = MONTHS.map(function (m) { return m.charAt(0); });
        peak = s.peakMonth;
        var tops = vals.map(function (v, i) { return v === vals[peak] ? i : -1; }).filter(function (i) { return i >= 0; });
        if (tops.length === 1) {
          head = MONTHS_LONG[peak] + ' was your big month';
          sub = fmt(vals[peak]) + ' ' + plural(vals[peak], 'book') + ' finished in ' + MONTHS_LONG[peak] + '.';
        } else if (tops.length <= 3) {
          head = tops.map(function (i) { return MONTHS_LONG[i]; }).join(tops.length === 2 ? ' and ' : ', ').replace(/, ([^,]*)$/, ' and $1') + ' tied';
          sub = fmt(vals[peak]) + ' ' + plural(vals[peak], 'book') + ' finished in each.';
        } else {
          head = 'Spread out across the year';
          sub = 'No single month ran away with it.';
        }
        peaks = tops;
      } else {
        var ys = Object.keys(s.byYear).map(Number).sort(function (a, b) { return a - b; }).slice(-12);
        vals = ys.map(function (y) { return s.byYear[y]; }); labels = ys.map(function (y) { return '\u2019' + String(y).slice(2); });
        peak = vals.indexOf(Math.max.apply(null, vals));
        head = ys[peak] + ' was your biggest year';
        sub = fmt(vals[peak]) + ' ' + plural(vals[peak], 'book') + ' finished in ' + ys[peak] + '.';
      }
      var yh = block(ctx, th, head, 420, { max: 96, min: 60, lines: 2 });
      txt(ctx, th, sub, M, yh + 72, 'serif', 400, 46, { italic: true, alpha: 0.85, width: CW });
      var cx = M, cw = CW, ctop = yh + 190, ch = 1450 - ctop, n = vals.length, bw = cw / n;
      var mx = Math.max.apply(null, vals) || 1;
      ctx.save();
      vals.forEach(function (v, i) {
        var h = v ? Math.max(14, (ch - 70) * v / mx) : 6;
        var x = cx + i * bw + bw * 0.14, w = bw * 0.72;
        rr(ctx, x, ctop + ch - h, w, h, Math.min(14, w / 2));
        var isPk = peaks ? peaks.indexOf(i) >= 0 : i === peak;
        ctx.fillStyle = isPk ? th.accent : th.soft; ctx.globalAlpha = isPk ? 1 : 0.75; ctx.fill();
        ctx.globalAlpha = 1;
        if (v) { ctx.font = F('serif', 700, n > 12 ? 30 : 36, false); ctx.fillStyle = th.ink; ctx.textAlign = 'center'; ctx.fillText(String(v), x + w / 2, ctop + ch - h - 16); }
        ctx.font = F('sans', 800, 30, false); ctx.fillStyle = th.ink; ctx.globalAlpha = isPk ? 1 : 0.7; ctx.textAlign = 'center';
        ctx.fillText(labels[i], x + w / 2, ctop + ch + 48);
        ctx.globalAlpha = 1;
      });
      ctx.restore();
      rule(ctx, th, ctop + ch + 2, 0.35);
      var chips;
      if (Y) {
        var nz = s.months.map(function (v, i) { return [v, i]; }).filter(function (x) { return x[0] > 0; });
        var quiet = nz.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; })[0];
        chips = [[s.activeMonths + ' of 12', 'months with a finished book'], [fmt1(s.booksPerMonth), 'books a month, on average']];
        if (quiet && quiet[0] < vals[peak]) chips.push([MONTHS[quiet[1]], 'quietest month']);
      } else chips = [[fmt(vals.length), 'years of reading'], [fmt1(s.booksPerMonth), 'books a month, on average']];
      chipRow(ctx, th, 1560, chips, 180);
    });

    if (s.topRated) add('toprated', 'Top-rated book', 'gilt', function (ctx, th) {
      var b = s.topRated;
      kicker(ctx, th, 'YOUR TOP-RATED READ', 300);
      // ribbon bookmark
      ctx.save(); ctx.fillStyle = th.accent; ctx.beginPath(); ctx.moveTo(W - M - 316, 36); ctx.lineTo(W - M - 246, 36); ctx.lineTo(W - M - 246, 236); ctx.lineTo(W - M - 281, 204); ctx.lineTo(W - M - 316, 236); ctx.closePath(); ctx.fill(); ctx.restore();
      stars(ctx, th, M, 470, 62, b.myRating, 22);
      txt(ctx, th, (b.myRating % 1 ? fmt2(b.myRating).replace(/0$/, '') : String(b.myRating)) + ' out of 5 stars', M, 600, 'sans', 800, 32, { alpha: 0.8, spacing: 2 });
      var yb = block(ctx, th, b.title, 760, { max: 128, min: 64, lines: 3 });
      txt(ctx, th, 'by ' + b.author, M, yb + 84, 'serif', 400, 54, { italic: true, alpha: 0.9, width: CW });
      var yy = Math.max(yb + 220, 1200);
      rule(ctx, th, yy - 60, 0.35);
      var lines = [];
      if (s.fiveStars > 1 && b.myRating >= 5) lines.push('One of ' + fmt(s.fiveStars) + ' five-star reads ' + (Y ? 'in ' + Y : 'so far') + '.');
      else if (s.fiveStars === 1 && b.myRating >= 5) lines.push('Your only five-star read ' + (Y ? 'of ' + Y : 'so far') + '. That\u2019s rare air.');
      else lines.push('The highest rating you gave ' + thisYear + '.');
      if (b.avgRating) lines.push(src + ' readers average ' + fmt2(b.avgRating) + (b.myRating - b.avgRating >= 0.5 ? '. You saw something they missed.' : '.'));
      if (b.series) lines.push('From ' + b.series.replace(/,?\s*#\s*[\d.]+$/, '') + '.');
      var y2 = yy;
      lines.slice(0, 3).forEach(function (l) { y2 = block(ctx, th, l, y2, { max: 48, min: 36, lines: 2, weight: 400, italic: true, alpha: 0.9 }) + 92; });
      var more = s.list.filter(function (x) { return x !== b && x.myRating; }).sort(function (a, c) { return c.myRating - a.myRating; }).slice(0, 3);
      if (more.length && y2 + 60 + more.length * 70 <= 1740) {
        txt(ctx, th, 'ALSO NEAR THE TOP', M, y2 + 10, 'sans', 800, 28, { spacing: 5, alpha: 0.7 });
        more.forEach(function (x, i) {
          var yy2 = y2 + 80 + i * 70;
          stars(ctx, th, M, yy2 - 14, 15, x.myRating, 5);
          txt(ctx, th, x.title, M + 200, yy2, 'serif', 700, 38, { width: CW - 200 });
        });
      }
    });

    if (s.topAuthor) add('author', 'Most-read author', 'forest', function (ctx, th) {
      var a = s.topAuthor;
      kicker(ctx, th, 'MOST-READ AUTHOR', 300);
      var yn = block(ctx, th, a.name, 470, { max: 140, min: 70, lines: 2, lh: 1.02 });
      bigNumber(ctx, th, String(a.count), yn + 260, 250, { width: 400 });
      ctx.save(); ctx.font = F('serif', 700, 250, true); spacing(ctx, -4); var nw = ctx.measureText(String(a.count)).width; ctx.restore();
      txt(ctx, th, plural(a.count, 'book'), M + nw + 30, yn + 180, 'serif', 700, 64);
      txt(ctx, th, (Y ? 'in ' + Y : 'all time'), M + nw + 30, yn + 250, 'serif', 400, 46, { italic: true, alpha: 0.8 });
      // contents page
      var ty = yn + 360;
      txt(ctx, th, 'CONTENTS', M, ty, 'sans', 800, 28, { spacing: 6, alpha: 0.7 });
      ty += 30;
      var shown = a.titles.slice(0, 6);
      shown.forEach(function (t, i) {
        var y = ty + 76 + i * 82;
        txt(ctx, th, ['I', 'II', 'III', 'IV', 'V', 'VI'][i], M, y, 'serif', 700, 38, { color: th.accent });
        txt(ctx, th, t, M + 100, y, 'serif', 400, 44, { width: CW - 100 });
      });
      var after = ty + 76 + shown.length * 82;
      if (a.titles.length > shown.length) { txt(ctx, th, '+ ' + (a.titles.length - shown.length) + ' more', M + 100, after, 'serif', 400, 38, { italic: true, alpha: 0.75 }); after += 60; }
      if (a.runnersUp.length) {
        var ru = 'Runner-up: ' + a.runnersUp[0][0] + ' (' + a.runnersUp[0][1] + ')';
        rule(ctx, th, Math.min(after + 10, 1640), 0.3);
        txt(ctx, th, ru, M, Math.min(after + 80, 1710), 'sans', 700, 32, { alpha: 0.82, width: CW });
      }
    });

    if (s.mix) add('mix', s.mix.kind === 'moods' ? 'Mood mix' : 'Genre mix', 'paper', function (ctx, th) {
      var mx = s.mix, items = mx.items;
      var kinds = { shelves: ['WHAT YOU READ', 'Based on your ' + src + ' shelves'], tags: ['WHAT YOU READ', 'Based on your ' + src + ' tags'], moods: ['YOUR READING MOODS', 'Based on the moods you logged on ' + src] };
      kicker(ctx, th, kinds[mx.kind][0], 300);
      var lead = items[0][0];
      var head = mx.kind === 'moods' ? 'Mostly ' + lead.toLowerCase() : (items[0][1] / s.count >= 0.3 ? 'Mostly ' + (lead === 'YA' || lead === 'SFF' ? lead : lead.toLowerCase()) : 'A bit of everything');
      var yh = block(ctx, th, head, 440, { max: 112, min: 64, lines: 2 });
      txt(ctx, th, fmt(mx.distinct) + ' different ' + (mx.kind === 'moods' ? 'moods' : mx.kind === 'tags' ? 'tags' : 'shelves') + ' across ' + fmt(s.count) + ' ' + plural(s.count, 'book'), M, yh + 74, 'serif', 400, 46, { italic: true, alpha: 0.85, width: CW });
      var by = yh + 170, rowH = Math.min(170, (1640 - by) / items.length), mxv = items[0][1];
      var cols = ['#1f4a35', '#7d1f32', '#c99a3b', '#2f6a5a', '#a8443f', '#3d3b5e'];
      items.forEach(function (it, i) {
        var y = by + i * rowH;
        txt(ctx, th, it[0], M, y + 46, 'serif', 700, 46, { width: CW - 160 });
        txt(ctx, th, fmt(it[1]), W - M, y + 46, 'serif', 700, 46, { align: 'right', color: th.accent });
        ctx.save();
        rr(ctx, M, y + 70, CW, 34, 17); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.09; ctx.fill();
        rr(ctx, M, y + 70, Math.max(34, CW * it[1] / mxv), 34, 17); ctx.globalAlpha = 1; ctx.fillStyle = cols[i % cols.length]; ctx.fill();
        ctx.restore();
      });
      txt(ctx, th, kinds[mx.kind][1] + (mx.kind === 'moods' ? '.' : '. A book can count twice.'), M, 1730, 'sans', 600, 25, { alpha: 0.65, width: CW });
    });

    if (s.critic || s.rated >= 3) add('critic', s.critic ? s.critic.label : 'How you rate', 'claret', function (ctx, th) {
      var c = s.critic;
      kicker(ctx, th, c ? 'THE VERDICT' : 'HOW YOU RATE', 300);
      if (c) {
        block(ctx, th, c.label, 470, { max: 150, min: 80, lines: 1 });
        var line = c.kind === 'harsh' ? 'You rate ' + fmt2(-c.diff) + ' stars below the ' + src + ' average. Tough crowd.' : c.kind === 'easy' ? 'You rate ' + fmt2(c.diff) + ' stars above the ' + src + ' average. Generous!' : 'Within ' + fmt2(Math.abs(c.diff)) + ' stars of the ' + src + ' average. Right on the money.';
        var yl = block(ctx, th, line, 570, { max: 46, min: 36, lines: 2, weight: 400, italic: true, alpha: 0.9 });
        // two numbers
        var ny = yl + 230, half = CW / 2;
        bigNumber(ctx, th, fmt2(c.mine), ny, 190, { width: half - 30 });
        bigNumber(ctx, th, fmt2(c.theirs), ny, 190, { width: half - 30, x: M + half, color: th.ink });
        txt(ctx, th, 'your average', M, ny + 60, 'sans', 700, 32, { alpha: 0.85 });
        txt(ctx, th, 'everyone else\u2019s', M + half, ny + 60, 'sans', 700, 32, { alpha: 0.85 });
        // scale 1-5
        var sy = ny + 150, sx = M + 20, sw = CW - 40;
        ctx.save(); rr(ctx, sx, sy, sw, 16, 8); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.2; ctx.fill(); ctx.restore();
        for (var k = 1; k <= 5; k++) txt(ctx, th, String(k), sx + sw * (k - 1) / 4, sy + 64, 'sans', 700, 28, { align: 'center', alpha: 0.6 });
        [[c.theirs, th.ink], [c.mine, th.accent]].forEach(function (p) {
          var px = sx + sw * (p[0] - 1) / 4;
          ctx.save(); ctx.fillStyle = p[1]; ctx.beginPath(); ctx.arc(px, sy + 8, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        });
        var dy0 = sy + 135, mxd = Math.max.apply(null, s.dist) || 1;
        txt(ctx, th, 'YOUR STARS', M, dy0, 'sans', 800, 28, { spacing: 5, alpha: 0.75 });
        for (var di = 4; di >= 0; di--) {
          var ry = dy0 + 30 + (4 - di) * 54;
          stars(ctx, th, M, ry + 20, 14, di + 1, 4);
          ctx.save(); rr(ctx, M + 190, ry + 6, CW - 290, 28, 14); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.12; ctx.fill();
          if (s.dist[di]) { rr(ctx, M + 190, ry + 6, Math.max(28, (CW - 290) * s.dist[di] / mxd), 28, 14); ctx.globalAlpha = 1; ctx.fillStyle = th.accent; ctx.fill(); }
          ctx.restore();
          txt(ctx, th, fmt(s.dist[di]), W - M, ry + 31, 'sans', 800, 30, { align: 'right', alpha: 0.9 });
        }
        var oy = dy0 + 345;
        var o = c.outlier;
        if (o && Math.abs(o.myRating - o.avgRating) >= 1 && oy + 170 <= 1745) {
          rule(ctx, th, oy - 46, 0.3);
          txt(ctx, th, 'BIGGEST DISAGREEMENT', M, oy, 'sans', 800, 28, { spacing: 5, alpha: 0.75 });
          var yo = block(ctx, th, o.title, oy + 70, { max: 56, min: 40, lines: 1 });
          stars(ctx, th, M, yo + 64, 22, o.myRating, 8);
          txt(ctx, th, 'you  \u00b7  everyone: ' + fmt2(o.avgRating), M + 270, yo + 76, 'sans', 700, 32, { alpha: 0.85 });
        }
      } else {
        var yh = block(ctx, th, fmt2(s.myAvg) + ' stars, on average', 450, { max: 110, min: 64, lines: 2 });
        txt(ctx, th, 'Across ' + fmt(s.rated) + ' rated ' + plural(s.rated, 'book') + '.', M, yh + 76, 'serif', 400, 46, { italic: true, alpha: 0.88 });
        var dy = yh + 150;
        var mxd = Math.max.apply(null, s.dist) || 1;
        for (var i = 4; i >= 0; i--) {
          var y = dy + (4 - i) * 140;
          stars(ctx, th, M, y + 40, 22, i + 1, 6);
          var bx = M + 280, bwid = CW - 280 - 90;
          ctx.save(); rr(ctx, bx, y + 18, bwid, 44, 22); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.12; ctx.fill();
          if (s.dist[i]) { rr(ctx, bx, y + 18, Math.max(44, bwid * s.dist[i] / mxd), 44, 22); ctx.globalAlpha = 1; ctx.fillStyle = th.accent; ctx.fill(); }
          ctx.restore();
          txt(ctx, th, fmt(s.dist[i]), W - M, y + 54, 'serif', 700, 44, { align: 'right' });
        }
        var five = s.fiveStars;
        block(ctx, th, five ? 'You handed out ' + fmt(five) + ' five-star ' + plural(five, 'rating') + '.' : 'Not a single five-star rating. Impressive restraint.', Math.min(dy + 5 * 140 + 50, 1660), { max: 50, min: 38, lines: 2, weight: 400, italic: true, alpha: 0.9 });
      }
    });

    if (s.rereads.length) add('rereads', 'Re-reads', 'sage', function (ctx, th) {
      var rs = s.rereads;
      kicker(ctx, th, 'BACK FOR MORE', 300);
      var head = rs.length === 1 ? 'You went back to an old favorite' : 'You re-read ' + rs.length + ' books';
      var yh = block(ctx, th, head, 450, { max: 110, min: 64, lines: 2 });
      txt(ctx, th, pick(['Some stories are worth living twice.', 'Comfort reads are a form of self-care.', 'Knowing the ending only makes it better.'], key + 'rr'), M, yh + 74, 'serif', 400, 46, { italic: true, alpha: 0.85, width: CW });
      var y = yh + 200;
      rs.slice(0, 4).forEach(function (r) {
        var yb = block(ctx, th, r.book.title, y, { max: 68, min: 44, lines: 2 });
        txt(ctx, th, 'by ' + r.book.author, M, yb + 56, 'serif', 400, 38, { italic: true, alpha: 0.8, width: CW });
        // tally marks
        var tx = M, ty = yb + 96;
        ctx.save(); ctx.strokeStyle = th.accent; ctx.lineWidth = 7; ctx.lineCap = 'round';
        var n = Math.min(r.times, 12);
        for (var k = 0; k < n; k++) {
          if (k % 5 === 4) { ctx.beginPath(); ctx.moveTo(tx - 4 * 22 - 10, ty + 50); ctx.lineTo(tx + 6, ty + 6); ctx.stroke(); tx += 30; continue; }
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty + 56); ctx.stroke(); tx += 22;
        }
        ctx.restore();
        txt(ctx, th, 'read ' + r.times + ' times' + (r.thisPeriod > 1 ? ' (' + r.thisPeriod + (Y ? ' this year' : '') + ')' : ''), Math.max(tx + 30, M + 150), ty + 46, 'sans', 800, 32, { alpha: 0.85 });
        y = ty + 190;
      });
      if (rs.length > 4) { txt(ctx, th, '+ ' + (rs.length - 4) + ' more re-reads', M, y - 40, 'serif', 400, 40, { italic: true, alpha: 0.8 }); y += 40; }
      if (y <= 1500) chipRow(ctx, th, 1520, [[fmt(rs.length), plural(rs.length, 're-read')], [Math.round(rs.length / s.count * 100) + '%', 'of your ' + (Y ? 'year' : 'books')], [fmt(rs.reduce(function (a, r) { return a + r.times; }, 0)), 'trips through them, all time']], 200);
    });

    if (s.dnf) add('dnf', 'The one you abandoned', 'ink', function (ctx, th) {
      var b = s.dnf.book, d = b.lastRead || b.dateAdded;
      kicker(ctx, th, 'THE ONE YOU ABANDONED', 300);
      // a closed book, set down at an angle
      ctx.save(); ctx.translate(W - M - 190, 600); ctx.rotate(-0.28); ctx.scale(1.25, 1.25);
      rr(ctx, -110, -160, 220, 320, 10); ctx.fillStyle = SPINES[hash(b.title) % 4 === 2 ? 0 : hash(b.title) % 4]; ctx.fill();
      ctx.fillStyle = '#efe3c4'; ctx.fillRect(100, -150, 12, 300);
      ctx.fillStyle = th.accent; ctx.beginPath(); ctx.moveTo(30, -160); ctx.lineTo(60, -160); ctx.lineTo(60, -40); ctx.lineTo(45, -58); ctx.lineTo(30, -40); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#f1d48a'; ctx.fillRect(-80, -100, 160, 4); ctx.fillRect(-80, 90, 160, 4);
      ctx.restore();
      var yb = block(ctx, th, b.title, 960, { max: 120, min: 64, lines: 3 });
      txt(ctx, th, 'by ' + b.author, M, yb + 80, 'serif', 400, 52, { italic: true, alpha: 0.88, width: CW });
      var y = yb + 200;
      if (d && d.mo) { txt(ctx, th, 'Set down in ' + MONTHS_LONG[d.mo - 1] + (Y ? '' : ' ' + d.y) + '.', M, y, 'serif', 700, 54); y += 90; }
      y = block(ctx, th, pick(['Life\u2019s too short for books you don\u2019t love. No regrets.', 'Not every book is your book. Onward.', 'Bookmark still in it. Maybe someday. Probably not.'], key + 'dnf'), y, { max: 50, min: 38, lines: 2, weight: 400, italic: true, alpha: 0.88 });
      var started = s.count + s.dnf.count;
      chipRow(ctx, th, Math.max(y + 90, 1500), [[fmt(s.dnf.count), plural(s.dnf.count, 'book') + ' left unfinished'], [Math.round(s.count / started * 100) + '%', 'of the books you started, you finished']], 210);
    });

    if (s.library) add('library', 'Library love', 'claret', function (ctx, th) {
      var L = s.library, f = L.formats;
      kicker(ctx, th, 'LIBRARY LOVE', 300);
      bigNumber(ctx, th, fmt(L.loans), 590, 300);
      txt(ctx, th, plural(L.loans, 'library loan'), M, 676, 'serif', 700, 64);
      var sub = L.libraryCount > 1 ? 'Borrowed from ' + L.libraryCount + ' different libraries.' : pick(['Free books, every one of them.', 'Your library card earned its keep.', 'Every one of them borrowed, not bought.'], key + 'lib');
      txt(ctx, th, sub, M, 750, 'serif', 400, 46, { italic: true, alpha: 0.88, width: CW });

      // A due-date slip: favorite library on top, the latest borrow dates stamped below.
      var sx = M, sy = 820, sw = CW, slipRows = Math.max(1, Math.ceil(L.stamps.length / 3)), sh = 196 + slipRows * 76 + 30;
      ctx.save();
      ctx.translate(W / 2, sy + sh / 2); ctx.rotate(-0.012); ctx.translate(-W / 2, -(sy + sh / 2));
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
      rr(ctx, sx, sy, sw, sh, 10); ctx.fillStyle = '#f7eed6'; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#b8323f'; ctx.fillRect(sx, sy + 118, sw, 3);
      ctx.strokeStyle = '#7c9cc2'; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5;
      for (var ly = sy + 196; ly < sy + sh - 10; ly += 76) { ctx.beginPath(); ctx.moveTo(sx + 20, ly); ctx.lineTo(sx + sw - 20, ly); ctx.stroke(); }
      ctx.globalAlpha = 1;
      var slipInk = { ink: '#2a2118' };
      txt(ctx, slipInk, L.favorite ? 'FAVORITE LIBRARY' : 'YOUR LIBRARY', sx + 34, sy + 48, 'sans', 800, 24, { spacing: 5, alpha: 0.65 });
      if (L.favorite) {
        ctx.save(); var ns = fitSize(ctx, L.favorite.name, 'serif', 700, 54, 30, sw - 68, false); ctx.restore();
        txt(ctx, slipInk, L.favorite.name, sx + 34, sy + 100, 'serif', 700, ns, { width: sw - 68 });
      } else txt(ctx, slipInk, 'Your local library', sx + 34, sy + 100, 'serif', 700, 54);
      txt(ctx, slipInk, 'DATE BORROWED', sx + 34, sy + 160, 'sans', 800, 22, { spacing: 4, alpha: 0.55 });
      if (L.favorite && L.libraryCount > 1) txt(ctx, slipInk, fmt(L.favorite.count) + ' of ' + fmt(L.loans) + ' loans', sx + sw - 34, sy + 160, 'sans', 800, 22, { align: 'right', spacing: 2, alpha: 0.55 });
      var r = rngFrom(hash(key + 'stamp')), colW = (sw - 68) / 3;
      L.stamps.forEach(function (d, i) {
        var cx = sx + 34 + (i % 3) * colW + colW / 2, cy = sy + 240 + Math.floor(i / 3) * 76;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate((r() - 0.5) * 0.14);
        ctx.globalAlpha = 0.72 + r() * 0.2; ctx.fillStyle = '#5b3f8c'; ctx.textAlign = 'center';
        ctx.font = F('sans', 800, 36, false); spacing(ctx, 2);
        ctx.fillText((MONTHS[d.mo - 1] || '').toUpperCase() + ' ' + (d.d || '') + (Y ? '' : ' \u2019' + String(d.y).slice(2)), 0, 12);
        ctx.restore();
      });
      ctx.restore();

      // ebook vs audiobook (and magazines, when there are any)
      var parts = [['ebook', 'Ebooks', '#e4bc62'], ['audio', 'Audiobooks', '#9fc2a6']];
      if (f.magazine) parts.push(['magazine', 'Magazines', '#e7a3ad']);
      var tot = parts.reduce(function (a, p) { return a + f[p[0]]; }, 0) || 1;
      var lead = parts.slice().sort(function (a, b) { return f[b[0]] - f[a[0]]; })[0];
      var by = sy + sh + 80;
      txt(ctx, th, f.audio && f.ebook ? (f[lead[0]] / tot >= 0.6 ? (lead[0] === 'audio' ? 'Mostly ears' : 'Mostly eyes') + ': ' + Math.round(f[lead[0]] / tot * 100) + '% ' + lead[1].toLowerCase() : 'A true format mixer') : (f.audio ? 'All audiobooks' : 'All ebooks'), M, by, 'serif', 700, 52, { width: CW });
      ctx.save(); var x = M;
      parts.forEach(function (p) { var w = CW * f[p[0]] / tot; if (!w) return; rr(ctx, x, by + 34, Math.max(w - 6, 10), 56, 14); ctx.fillStyle = p[2]; ctx.fill(); x += w; });
      ctx.restore();
      var lx = M;
      parts.forEach(function (p) {
        if (!f[p[0]]) return;
        var label = fmt(f[p[0]]) + ' ' + p[1].toLowerCase().replace(/s$/, f[p[0]] === 1 ? '' : 's');
        ctx.save(); ctx.fillStyle = p[2]; ctx.beginPath(); ctx.arc(lx + 12, by + 134, 12, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        txt(ctx, th, label, lx + 34, by + 145, 'sans', 700, 30, { alpha: 0.88 });
        ctx.save(); ctx.font = F('sans', 700, 30, false); lx += ctx.measureText(label).width + 80; ctx.restore();
      });

      var chips = [];
      if (L.holds) chips.push([fmt(L.holds), plural(L.holds, 'hold') + ' placed']);
      if (L.longestWait && L.longestWait.wait >= 7) chips.push([fmt(L.longestWait.wait) + 'd', 'longest wait: ' + L.longestWait.book.title]);
      else if (L.avgWait != null && L.holds) chips.push([fmt(L.avgWait) + 'd', 'average wait for a hold']);
      if (L.mostBorrowed && chips.length < 2) chips.push([L.mostBorrowed.n + '\u00d7', 'borrowed: ' + L.mostBorrowed.book.title]);
      if (chips.length < 2) chips.push([fmt(s.count), plural(s.count, 'book') + ' returned']);
      chipRow(ctx, th, Math.min(1540, by + 240), chips.slice(0, 2), 190);
    });

    if (s.formatKnown >= 3 && !s.library) add('formats', 'How you read', 'paper', function (ctx, th) {
      var f = s.formats, tot = s.formatKnown;
      kicker(ctx, th, 'HOW YOU READ', 300);
      var order = [['print', 'Print', 'paper and ink'], ['ebook', 'Ebook', 'on a screen'], ['audio', 'Audio', 'listened to']];
      var lead = order.slice().sort(function (a, b) { return f[b[0]] - f[a[0]]; })[0];
      var head = f[lead[0]] / tot >= 0.6 ? (lead[0] === 'print' ? 'Paper all the way' : lead[0] === 'ebook' ? 'Screen reader' : 'All ears') : 'A format mixer';
      block(ctx, th, head, 450, { max: 120, min: 64, lines: 2 });
      var by = 640;
      ctx.save(); var x = M, cols = { print: '#1f4a35', ebook: '#c99a3b', audio: '#7d1f32' };
      order.forEach(function (o) { var w = CW * f[o[0]] / tot; if (!w) return; rr(ctx, x, by, Math.max(w - 6, 8), 90, 16); ctx.fillStyle = cols[o[0]]; ctx.fill(); x += w; });
      ctx.restore();
      order.forEach(function (o, i) {
        var y = by + 260 + i * 220;
        ctx.save(); ctx.fillStyle = cols[o[0]]; rr(ctx, M, y - 70, 24, 90, 8); ctx.fill(); ctx.restore();
        txt(ctx, th, fmt(f[o[0]]), M + 60, y, 'serif', 700, 120, { color: th.ink });
        ctx.save(); ctx.font = F('serif', 700, 120, false); var nw = ctx.measureText(fmt(f[o[0]])).width; ctx.restore();
        txt(ctx, th, o[1], M + 100 + nw, y - 40, 'serif', 700, 52);
        txt(ctx, th, o[2] + ' \u00b7 ' + Math.round(f[o[0]] / tot * 100) + '%', M + 100 + nw, y + 6, 'sans', 700, 30, { alpha: 0.75 });
      });
      if (s.source === 'storygraph' && (s.paces.fast + s.paces.medium + s.paces.slow) >= 3) {
        var p = s.paces, pl = ['fast', 'medium', 'slow'].sort(function (a, b) { return p[b] - p[a]; })[0];
        rule(ctx, th, 1560, 0.3);
        txt(ctx, th, 'Favorite pace: ' + pl + ' (' + p[pl] + ' ' + plural(p[pl], 'book') + ')', M, 1640, 'serif', 400, 46, { italic: true, alpha: 0.88 });
      }
    });

    add('persona', 'Reader personality', 'forest', function (ctx, th) {
      var p = s.personality;
      kicker(ctx, th, 'YOUR READER PERSONALITY', 300);
      fleuron(ctx, th, W / 2, 440, 20);
      var yn = block(ctx, th, p.name, 620, { max: 150, min: 80, lines: 2, align: 'center', lh: 1.02 });
      var yl = block(ctx, th, p.line, yn + 110, { max: 52, min: 40, lines: 3, weight: 400, italic: true, align: 'center', alpha: 0.92 });
      var ty = yl + 60;
      if (p.traits.length) {
        ty += 30;
        txt(ctx, th, 'with a streak of', W / 2, ty, 'sans', 700, 30, { align: 'center', alpha: 0.75 });
        txt(ctx, th, p.traits.join(' & '), W / 2, ty + 60, 'serif', 700, 44, { align: 'center', color: th.accent, width: CW });
        ty += 60;
      }
      fleuron(ctx, th, W / 2, ty + 80, 12);
      var gy = Math.max(ty + 150, 1130), gw = (CW - 24) / 2, gh = 200;
      var tiles = [[fmt(s.count), plural(s.count, 'book') + ' finished']];
      tiles.push(s.myAvg ? [fmt2(s.myAvg), 'average rating'] : [fmt(s.authorCount), plural(s.authorCount, 'author')]);
      tiles.push(s.avgPages ? [fmt(s.avgPages), 'pages per book'] : [fmt1(s.booksPerMonth), 'books a month']);
      tiles.push(s.mix ? [s.mix.items[0][0], s.mix.kind === 'moods' ? 'top mood' : 'top shelf'] : [fmt1(s.booksPerMonth), 'books a month']);
      if (tiles[2][1] === tiles[3][1]) tiles[3] = [fmt(s.authorCount), plural(s.authorCount, 'author')];
      // Decks without ratings, pages or a mix (Libby, sparse exports) would repeat a tile: swap in something new.
      if (tiles[3][1] === tiles[1][1]) tiles[3] = s.library ? [fmt(s.library.loans), plural(s.library.loans, 'library loan')] : Y ? [s.activeMonths + ' of 12', 'months with a finished book'] : [fmt(Object.keys(s.byYear).length), 'years of reading'];
      tiles.forEach(function (t, i) { chip(ctx, th, M + (i % 2) * (gw + 24), gy + Math.floor(i / 2) * (gh + 24), gw, gh, t[0], t[1]); });
    });

    // Keep the deck at 10 cards or fewer. Drop the extras in this order.
    var dropOrder = ['formats', 'longest', 'rereads', 'critic'];
    while (cards.length > 10 && dropOrder.length) { var id = dropOrder.shift(); cards = cards.filter(function (c) { return c.id !== id; }); }
    foldLongest = !cards.some(function (c) { return c.id === 'longest'; });
    return cards;
  }

  function render(canvas, card, stats, info, idx, total) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    var th = T[card.theme] || T.forest;
    background(ctx, th, (info.title || '') + card.id);
    chrome(ctx, th, info, idx, total);
    card.draw(ctx, th);
  }

  var api = { build: build, render: render, W: W, H: H, THEMES: T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReadingCards = api;
})(typeof self !== 'undefined' ? self : this);
