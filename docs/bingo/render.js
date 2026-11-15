/* Goal Bingo: themes + canvas renderer for the downloadable card images. */
(function (root) {
  'use strict';
  var C = root.BingoCodec;

  var SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif';
  var ROUND = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", -apple-system, "Segoe UI", Roboto, Inter, Arial, sans-serif';
  var SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, Cambria, Caladea, serif';

  // Each theme drives both the on-page grid (CSS variables) and the canvas export.
  var THEMES = {
    confetti: { name: 'Confetti', bg: ['#fff6e9', '#ffeede'], ink: '#2b1d3d', muted: '#6b5a7a', cell: '#ffffff', cellInk: '#2b1d3d', line: '#2b1d3d', lineW: 0.035,
      accent: '#ff4f6d', head: ROUND, headWeight: 900, letters: ['#ff4f6d', '#ffb020', '#22b07d', '#3a86ff', '#9b5de5'], pattern: 'confetti', freeBg: '#ffd84d', freeInk: '#2b1d3d' },
    midnight: { name: 'Midnight', bg: ['#16204a', '#0b0f26'], ink: '#f7efd9', muted: '#b9b3cf', cell: '#1a2352', cellInk: '#f7efd9', onAccent: '#16204a', stamp: '#2d3d85', line: '#d8b45c', lineW: 0.02,
      accent: '#e9c46a', head: SERIF, headWeight: 700, italic: true, letters: ['#e9c46a'], pattern: 'stars', freeBg: '#e9c46a', freeInk: '#16204a' },
    sage: { name: 'Sage', bg: ['#eef2e6', '#e2e9d8'], ink: '#2f4032', muted: '#5f6f5f', cell: '#fbfcf7', cellInk: '#2f4032', line: '#9fb39b', lineW: 0.02,
      accent: '#5d8a62', head: SERIF, headWeight: 700, italic: true, letters: ['#5d8a62'], pattern: 'leaves', freeBg: '#5d8a62', freeInk: '#fbfcf7' },
    sunset: { name: 'Sunset', bg: ['#ffb489', '#ff6f91', '#8b5cf6'], ink: '#ffffff', muted: 'rgba(255,255,255,0.85)', cell: 'rgba(255,255,255,0.9)', cellInk: '#3b1f4e', line: 'rgba(255,255,255,0.95)', lineW: 0.02,
      accent: '#ff3d7f', head: SANS, headWeight: 900, letters: ['#ffffff'], pattern: 'sun', freeBg: '#3b1f4e', freeInk: '#ffd2a8' },
    mono: { name: 'Mono (print-friendly)', bg: ['#ffffff', '#ffffff'], ink: '#111111', muted: '#555555', cell: '#ffffff', cellInk: '#111111', line: '#111111', lineW: 0.03,
      accent: '#111111', head: SANS, headWeight: 900, letters: ['#111111'], pattern: 'none', freeBg: '#111111', freeInk: '#ffffff' },
    lantern: { name: 'Lantern', bg: ['#f5ecd9', '#ebdfc4'], ink: '#17402c', muted: '#55604f', cell: '#fffaf0', cellInk: '#1d2a21', line: '#17402c', lineW: 0.025,
      accent: '#7d1f32', head: SERIF, headWeight: 700, letters: ['#7d1f32', '#17402c'], pattern: 'glow', freeBg: '#17402c', freeInk: '#e4bc62' }
  };

  // Deterministic random so a card always renders the same way.
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }

  function rr(x, cx, cy, w, h, r) {
    x.beginPath();
    x.moveTo(cx + r, cy); x.arcTo(cx + w, cy, cx + w, cy + h, r); x.arcTo(cx + w, cy + h, cx, cy + h, r);
    x.arcTo(cx, cy + h, cx, cy, r); x.arcTo(cx, cy, cx + w, cy, r); x.closePath();
  }

  function wrap(x, text, maxW, noBreak) {
    var words = String(text).split(' '), lines = [], cur = '';
    function pushWord(w) {
      // break a single word that is wider than the box
      while (x.measureText(w).width > maxW && w.length > 1) {
        var cs = Array.from(w), k = cs.length - 1;
        while (k > 1 && x.measureText(cs.slice(0, k).join('') + '-').width > maxW) k--;
        lines.push(cs.slice(0, k).join('') + '-'); w = cs.slice(k).join('');
      }
      return w;
    }
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (x.measureText(t).width <= maxW) { cur = t; return; }
      if (cur) lines.push(cur);
      cur = noBreak ? w : pushWord(w);
    });
    if (cur) lines.push(cur);
    return lines;
  }

  // Largest font size (within range) whose wrapped lines fit the box.
  function fit(x, text, w, h, max, min, font, weight) {
    // first pass: whole words only; second pass: allow breaking long words
    for (var pass = 0; pass < 2; pass++)
    for (var s = max; s >= min; s -= Math.max(1, Math.round(s * 0.06))) {
      x.font = weight + ' ' + s + 'px ' + font;
      var L = wrap(x, text, w, pass === 0);
      if (L.length * s * 1.15 <= h && L.every(function (l) { return x.measureText(l).width <= w + 0.5; })) return { size: s, lines: L };
    }
    x.font = weight + ' ' + min + 'px ' + font;
    var lines = wrap(x, text, w), maxL = Math.max(1, Math.floor(h / (min * 1.15)));
    if (lines.length > maxL) { lines = lines.slice(0, maxL); lines[maxL - 1] = lines[maxL - 1].replace(/.?$/, '…'); }
    return { size: min, lines: lines };
  }

  function fitOneLine(x, text, maxW, max, font, weight, italic) {
    var s = max;
    do { x.font = (italic ? 'italic ' : '') + weight + ' ' + s + 'px ' + font; s -= 2; } while (x.measureText(text).width > maxW && s > 10);
    return s + 2;
  }

  function drawBg(x, t, W, H, seed) {
    var g = x.createLinearGradient(0, 0, W * 0.4, H);
    t.bg.forEach(function (c, i) { g.addColorStop(i / (t.bg.length - 1), c); });
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    var r = rng(seed), i, u = W / 1000;
    x.save();
    if (t.pattern === 'confetti') {
      for (i = 0; i < 70; i++) {
        var px = r() * W, py = r() * H, s = (6 + r() * 10) * u;
        var edge = W * 0.055;
        if (px > edge && px < W - edge && py > H * 0.035 && py < H - H * 0.03) { if (r() < 0.5) px = r() * edge; else px = W - r() * edge; }
        x.globalAlpha = 0.55; x.fillStyle = t.letters[i % t.letters.length];
        x.save(); x.translate(px, py); x.rotate(r() * Math.PI);
        if (i % 3 === 0) { x.beginPath(); x.arc(0, 0, s * 0.6, 0, 7); x.fill(); } else x.fillRect(-s, -s * 0.35, s * 2, s * 0.7);
        x.restore();
      }
    } else if (t.pattern === 'stars') {
      for (i = 0; i < 140; i++) { x.globalAlpha = 0.25 + r() * 0.6; x.fillStyle = '#fff6d8'; x.beginPath(); x.arc(r() * W, r() * H, (0.8 + r() * 2.2) * u, 0, 7); x.fill(); }
      x.globalAlpha = 0.18; var gg = x.createRadialGradient(W * 0.85, H * 0.05, 0, W * 0.85, H * 0.05, W * 0.8); gg.addColorStop(0, '#e9c46a'); gg.addColorStop(1, 'rgba(233,196,106,0)'); x.fillStyle = gg; x.fillRect(0, 0, W, H);
    } else if (t.pattern === 'leaves') {
      for (i = 0; i < 26; i++) {
        x.globalAlpha = 0.12 + r() * 0.1; x.fillStyle = '#5d8a62';
        x.save(); x.translate(r() * W, r() * H); x.rotate(r() * Math.PI * 2); var l = (30 + r() * 50) * u;
        x.beginPath(); x.moveTo(0, -l); x.quadraticCurveTo(l * 0.6, 0, 0, l); x.quadraticCurveTo(-l * 0.6, 0, 0, -l); x.fill(); x.restore();
      }
    } else if (t.pattern === 'sun') {
      x.globalAlpha = 0.35; var sg = x.createRadialGradient(W * 0.8, H * 0.12, 0, W * 0.8, H * 0.12, W * 0.7); sg.addColorStop(0, '#fff3c4'); sg.addColorStop(1, 'rgba(255,243,196,0)'); x.fillStyle = sg; x.fillRect(0, 0, W, H);
    } else if (t.pattern === 'glow') {
      x.globalAlpha = 0.5; var lg = x.createRadialGradient(W * 0.9, 0, 0, W * 0.9, 0, W * 0.9); lg.addColorStop(0, 'rgba(201,154,59,0.55)'); lg.addColorStop(1, 'rgba(201,154,59,0)'); x.fillStyle = lg; x.fillRect(0, 0, W, H);
    }
    x.restore();
  }

  function star(x, cx, cy, r, color) {
    x.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
    x.closePath(); x.fillStyle = color; x.fill();
  }

  function check(x, cx, cy, s, color) {
    x.save(); x.strokeStyle = color; x.lineWidth = s * 0.22; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(cx - s * 0.45, cy); x.lineTo(cx - s * 0.12, cy + s * 0.35); x.lineTo(cx + s * 0.5, cy - s * 0.38); x.stroke(); x.restore();
  }

  function headerLetters(size) { return size === 5 ? ['B', 'I', 'N', 'G', 'O'] : size === 4 ? ['2', '0', '2', '7'] : null; }

  // kind: 'letter' | 'wallpaper' | 'story' | 'square'
  function draw(canvas, card, kind) {
    var t = THEMES[card.theme] || THEMES.confetti;
    var W = canvas.width, H = canvas.height, x = canvas.getContext('2d');
    var n = card.size, u = W / 1000, m = card.free ? C.centre(n) : -1;
    var prog = C.progress(card);
    var seed = 0; (card.title + card.goals.join('')).split('').forEach(function (ch) { seed = (seed * 31 + ch.charCodeAt(0)) >>> 0; });
    drawBg(x, t, W, H, seed || 7);

    var pad = W * 0.07;
    var topReserve = kind === 'wallpaper' ? H * 0.27 : kind === 'story' ? H * 0.08 : pad * 0.9;
    var bottomReserve = kind === 'wallpaper' ? H * 0.11 : kind === 'story' ? H * 0.06 : pad * 0.6;
    var title = card.title || 'My 2027 Goal Bingo';
    var label = card.group ? card.group + ' · 2027 bingo' : '2027 Goal Bingo';
    var showProgress = prog.done > 0;

    // measure header
    var labelS = 30 * u, titleMax = (kind === 'letter' ? 92 : 84) * u, nameS = 30 * u;
    var titleS = fitOneLine(x, title, W - pad * 2, titleMax, t.head, t.headWeight, t.italic);
    var headerH = labelS * 1.6 + titleS * 1.15 + (card.name ? nameS * 1.7 : 0) + 24 * u;
    var footerH = 64 * u, progH = showProgress ? 62 * u : 0;
    var gridLetters = headerLetters(n);
    var availW = W - pad * 2;
    var availH = H - topReserve - bottomReserve - headerH - footerH - progH - (kind === 'letter' ? 30 * u : 20 * u);
    var cell = Math.floor(Math.min(availW, availH * (gridLetters ? n / (n + 0.55) : 1)) / n);
    var gridW = cell * n, lettersRow = gridLetters ? cell * 0.55 : 0;
    var blockH = headerH + lettersRow + gridW + progH;
    var y0 = topReserve + Math.max(0, (H - topReserve - bottomReserve - footerH - blockH) / 2);
    var gx = (W - gridW) / 2;

    // header
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    var y = y0 + labelS;
    x.fillStyle = t.muted; x.font = '800 ' + labelS + 'px ' + SANS;
    if ('letterSpacing' in x) x.letterSpacing = (labelS * 0.22) + 'px';
    x.fillText(label.toUpperCase(), W / 2 + (('letterSpacing' in x) ? labelS * 0.11 : 0), y);
    if ('letterSpacing' in x) x.letterSpacing = '0px';
    y += labelS * 0.6 + titleS;
    x.fillStyle = t.ink; x.font = (t.italic ? 'italic ' : '') + t.headWeight + ' ' + titleS + 'px ' + t.head;
    x.fillText(title, W / 2, y);
    if (card.name) { y += nameS * 1.6; x.fillStyle = t.muted; x.font = '600 ' + nameS + 'px ' + SANS; x.fillText(card.name, W / 2, y); }
    y += 24 * u;

    // B I N G O
    if (gridLetters) {
      var ls = lettersRow * 0.82;
      x.font = t.headWeight + ' ' + ls + 'px ' + t.head; x.textBaseline = 'middle';
      gridLetters.forEach(function (L, i) { x.fillStyle = t.letters[i % t.letters.length]; x.fillText(L, gx + cell * (i + 0.5), y + lettersRow * 0.5); });
      y += lettersRow;
    }

    // grid
    var gy = y, gap = cell * 0.045, rad = cell * 0.09;
    x.save();
    rr(x, gx - gap, gy - gap, gridW + gap * 2, gridW + gap * 2, rad * 1.4);
    x.fillStyle = t.line; x.globalAlpha = t.pattern === 'none' ? 1 : 0.95; x.fill(); x.restore();
    var inBingo = {}; prog.lines.forEach(function (ln) { ln.forEach(function (k) { inBingo[k] = 1; }); });
    function box(i) { var r = Math.floor(i / n), c = i % n; return { x: gx + c * cell + gap, y: gy + r * cell + gap, w: cell - gap * 2 }; }
    // pass 1: squares, stamps, bingo outlines
    for (var i = 0; i < n * n; i++) {
      var b = box(i);
      rr(x, b.x, b.y, b.w, b.w, rad); x.fillStyle = i === m ? t.freeBg : t.cell; x.fill();
      if (inBingo[i] && i !== m) { x.save(); rr(x, b.x + gap * 0.6, b.y + gap * 0.6, b.w - gap * 1.2, b.w - gap * 1.2, rad * 0.8); x.lineWidth = gap * 1.1; x.strokeStyle = t.accent; x.stroke(); x.restore(); }
      if (card.checked[i] && i !== m) {
        // stamp: a rounded rectangle covering most of the square, so any goal text fits inside it
        var si = b.w * 0.075;
        x.save(); x.globalAlpha = t.stamp ? 1 : 0.22; x.fillStyle = t.stamp || t.accent; rr(x, b.x + si, b.y + si, b.w - si * 2, b.w - si * 2, rad * 0.8); x.fill();
        x.globalAlpha = 0.9; x.lineWidth = b.w * 0.02; x.strokeStyle = t.accent; x.stroke(); x.restore();
      }
    }
    // text layout first, so the bingo line can be kept out of the text
    var lay = [], holes = [];
    for (i = 0; i < n * n; i++) {
      var p = box(i), txt = card.goals[i];
      if (i === m) {
        var ff = fit(x, txt || 'FREE', p.w * 0.84, p.w * 0.32, p.w * 0.17, p.w * 0.075, SANS, 900);
        lay[i] = { f: ff, weight: 900, lh: ff.size * 1.12, top: p.y + p.w * 0.7 - (ff.lines.length - 1) * ff.size * 1.12 / 2 };
      } else if (txt) {
        var on = card.checked[i];
        // checked: text stays inside the stamp and below the check badge (top band reserved)
        var bw = p.w * (on ? 0.78 : 0.84), bt = p.w * (on ? 0.25 : 0.1), bh = p.w * (on ? 0.66 : 0.8);
        var f = fit(x, txt, bw, bh, Math.round(p.w * 0.16), Math.max(8, Math.round(p.w * (on ? 0.07 : 0.075))), SANS, 700);
        var lh = f.size * 1.15, blockH = f.lines.length * lh;
        var topY = Math.max(p.w / 2 - blockH / 2, bt);  // centred, unless that would reach the badge band
        lay[i] = { f: f, weight: 700, lh: lh, top: p.y + topY + lh / 2 };
      } else continue;
      var Lz = lay[i]; x.font = Lz.weight + ' ' + Lz.f.size + 'px ' + SANS;
      Lz.f.lines.forEach(function (l, k) {
        var lw = x.measureText(l).width + Lz.f.size * 0.4, ly = Lz.top + k * Lz.lh;
        holes.push([p.x + p.w / 2 - lw / 2, ly - Lz.lh / 2, lw, Lz.lh]);
      });
    }
    // pass 2: bingo lines, under the text and clipped out of it so goals stay readable
    x.save();
    if (prog.lines.length) {
      x.beginPath(); x.rect(0, 0, W, H);
      holes.forEach(function (h) { x.rect(h[0], h[1], h[2], h[3]); });
      x.clip('evenodd');
    }
    x.strokeStyle = t.accent; x.globalAlpha = 0.28; x.lineCap = 'round'; x.lineWidth = cell * 0.05;
    prog.lines.forEach(function (ln) {
      var a = ln[0], e = ln[ln.length - 1];
      var ax = gx + (a % n + 0.5) * cell, ay = gy + (Math.floor(a / n) + 0.5) * cell, bx = gx + (e % n + 0.5) * cell, by = gy + (Math.floor(e / n) + 0.5) * cell;
      var dx = (bx - ax) / (n - 1) * 0.3, dy = (by - ay) / (n - 1) * 0.3;
      x.beginPath(); x.moveTo(ax - dx, ay - dy); x.lineTo(bx + dx, by + dy); x.stroke();
    });
    x.restore();
    // pass 3: text and check badges
    for (i = 0; i < n * n; i++) {
      var q = box(i), cx = q.x, cy = q.y, cw = q.w, Q = lay[i];
      if (i === m) star(x, cx + cw / 2, cy + cw * 0.36, cw * 0.17, t.freeInk);
      if (Q) {
        x.fillStyle = i === m ? t.freeInk : t.cellInk; x.font = Q.weight + ' ' + Q.f.size + 'px ' + SANS; x.textBaseline = 'middle';
        Q.f.lines.forEach(function (l, k) { x.fillText(l, cx + cw / 2, Q.top + k * Q.lh); });
      }
      if (i === m) continue;
      if (card.checked[i]) {
        // badge sits in the reserved top band (ends at 0.21 of the square; text starts at 0.25)
        x.save(); x.fillStyle = t.accent; x.beginPath(); x.arc(cx + cw * 0.875, cy + cw * 0.125, cw * 0.085, 0, 7); x.fill();
        check(x, cx + cw * 0.875, cy + cw * 0.13, cw * 0.085, t.onAccent || '#ffffff'); x.restore();
      }
    }
    y = gy + gridW + gap;

    // progress
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    if (showProgress) {
      var ps = 34 * u, msg = prog.done + ' of ' + prog.total + ' done' + (prog.blackout ? ' · BLACKOUT!' : prog.bingos ? ' · ' + prog.bingos + ' BINGO' + (prog.bingos > 1 ? 'S' : '') + '!' : '');
      x.font = '800 ' + ps + 'px ' + SANS;
      var pw = x.measureText(msg).width + ps * 1.6;
      rr(x, W / 2 - pw / 2, y + 16 * u, pw, ps * 1.6, ps * 0.8); x.fillStyle = t.accent; x.fill();
      x.fillStyle = t.onAccent || '#ffffff'; x.fillText(msg, W / 2, y + 16 * u + ps * 1.13);
    }

    // footer: the share loop
    var fs = 26 * u;
    x.font = '700 ' + fs + 'px ' + SANS; x.fillStyle = t.muted;
    x.fillText('Make yours: lanternlab2027.github.io/lab/bingo', W / 2, H - bottomReserve - fs * 0.6);
    return canvas;
  }

  var SIZES = {
    letter: { w: 2550, h: 3300, label: 'Letter (8.5×11 in)' },
    wallpaper: { w: 1170, h: 2532, label: 'Phone wallpaper' },
    story: { w: 1080, h: 1920, label: 'Story (9:16)' }
  };

  function render(card, kind, scale) {
    var s = SIZES[kind]; scale = scale || 1;
    var cv = document.createElement('canvas'); cv.width = Math.round(s.w * scale); cv.height = Math.round(s.h * scale);
    return draw(cv, card, kind);
  }

  // Minimal one-page PDF wrapping a JPEG (DCTDecode). Page is US Letter, image fills it.
  function pdfFromJpeg(jpeg, imgW, imgH) {
    var enc = function (s) { var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
    var content = 'q 612 0 0 792 0 0 cm /Im0 Do Q';
    var objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
      null,
      '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'
    ];
    var parts = [], off = 0, offsets = [];
    function push(b) { parts.push(b); off += b.length; }
    push(enc('%PDF-1.4\n%âãÏÓ\n'));
    for (var i = 0; i < objs.length; i++) {
      offsets.push(off);
      if (i === 3) {
        push(enc('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n'));
        push(jpeg); push(enc('\nendstream\nendobj\n'));
      } else push(enc((i + 1) + ' 0 obj\n' + objs[i] + '\nendobj\n'));
    }
    var xref = off, s = 'xref\n0 6\n0000000000 65535 f \n';
    offsets.forEach(function (o) { s += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
    s += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    push(enc(s));
    var out = new Uint8Array(off), p = 0;
    parts.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }

  root.BingoRender = { THEMES: THEMES, SIZES: SIZES, draw: draw, render: render, pdfFromJpeg: pdfFromJpeg };
})(typeof self !== 'undefined' ? self : this);
