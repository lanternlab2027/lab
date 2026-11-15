/* Watch-Party Bingo: the shareable BINGO picture (1080x1350, 4:5) drawn on a canvas.
 * Text fitting, stamps and confetti are adapted from docs/bingo/render.js (2027 Goal Bingo). */
(function (root) {
  'use strict';
  var SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif';
  var ROUND = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", -apple-system, "Segoe UI", Roboto, Inter, Arial, sans-serif';
  var T = { bg: ['#fff6e9', '#ffeede'], ink: '#2b1d3d', muted: '#6b5a7a', cell: '#ffffff', line: '#2b1d3d', accent: '#ff4f6d', free: '#ffd84d', win: '#ffe58a',
    letters: ['#ff4f6d', '#ffb020', '#22b07d', '#3a86ff', '#9b5de5', '#ff4f6d'] };
  var SITE = 'lanternlab2027.github.io/lab/partybingo';

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  function rr(x, cx, cy, w, h, r) {
    x.beginPath();
    x.moveTo(cx + r, cy); x.arcTo(cx + w, cy, cx + w, cy + h, r); x.arcTo(cx + w, cy + h, cx, cy + h, r);
    x.arcTo(cx, cy + h, cx, cy, r); x.arcTo(cx, cy, cx + w, cy, r); x.closePath();
  }
  function wrap(x, text, maxW, noBreak) {
    var words = String(text).split(' '), lines = [], cur = '';
    function pushWord(w) {
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
  function fit(x, text, w, h, max, min, font, weight) {
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
  function fitOneLine(x, text, maxW, max, font, weight) {
    var s = max;
    do { x.font = weight + ' ' + s + 'px ' + font; s -= 2; } while (x.measureText(text).width > maxW && s > 10);
    return s + 2;
  }
  function star(x, cx, cy, r, color) {
    x.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
    x.closePath(); x.fillStyle = color; x.fill();
  }
  function tick(x, cx, cy, s, color) {
    x.save(); x.strokeStyle = color; x.lineWidth = s * 0.22; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(cx - s * 0.45, cy); x.lineTo(cx - s * 0.12, cy + s * 0.35); x.lineTo(cx + s * 0.5, cy - s * 0.38); x.stroke(); x.restore();
  }
  function confetti(x, W, H, seed, keepOut) {
    var r = rng(seed);
    x.save();
    for (var i = 0; i < 90; i++) {
      var px = r() * W, py = r() * H, s = 7 + r() * 11;
      if (keepOut(px, py)) continue;
      x.globalAlpha = 0.6; x.fillStyle = T.letters[i % 5];
      x.save(); x.translate(px, py); x.rotate(r() * Math.PI);
      if (i % 3 === 0) { x.beginPath(); x.arc(0, 0, s * 0.6, 0, 7); x.fill(); } else x.fillRect(-s, -s * 0.35, s * 2, s * 0.7);
      x.restore();
    }
    x.restore();
  }

  // Short local time like "9:42pm".
  function clock(ms) {
    var d = new Date(ms || Date.now()), h = d.getHours(), m = d.getMinutes();
    return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? 'am' : 'pm');
  }
  function sentence(o) { return 'BINGO at ' + clock(o.time) + ' with ‘' + o.square + '’'; }

  // o: { title, name, cells[25] (null = free), marks[25], lines[[...]], winIdx, time, square }
  function draw(canvas, o) {
    var W = canvas.width = 1080, H = canvas.height = 1350, x = canvas.getContext('2d');
    var g = x.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, T.bg[0]); g.addColorStop(1, T.bg[1]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    var pad = 64, gridW = 700, gx = (W - gridW) / 2;
    confetti(x, W, H, 1 + (o.time | 0) % 99991, function (px, py) { return px > 46 && px < W - 46 && py > 40 && py < H - 70; });

    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    // label + game title
    var y = 92;
    x.fillStyle = T.muted; x.font = '800 26px ' + SANS;
    if ('letterSpacing' in x) x.letterSpacing = '6px';
    x.fillText((o.name ? o.name + '’s card · ' : '') .toUpperCase() + 'WATCH-PARTY BINGO', W / 2 + 3, y);
    if ('letterSpacing' in x) x.letterSpacing = '0px';
    var ts = fitOneLine(x, o.title, W - pad * 2, 54, ROUND, 900);
    y += 14 + ts; x.fillStyle = T.ink; x.font = '900 ' + ts + 'px ' + ROUND; x.fillText(o.title, W / 2, y);

    // BINGO!
    y += 160;
    x.font = '900 170px ' + ROUND;
    var word = 'BINGO!'.split(''), widths = word.map(function (c) { return x.measureText(c).width; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0), cx = W / 2 - total / 2;
    x.textAlign = 'left';
    word.forEach(function (c, i) {
      x.save(); x.translate(cx + widths[i] / 2, y); x.rotate((i % 2 ? 1 : -1) * 0.04);
      x.fillStyle = T.ink; x.fillText(c, -widths[i] / 2 + 5, 6);
      x.fillStyle = T.letters[i]; x.fillText(c, -widths[i] / 2, 0); x.restore();
      cx += widths[i];
    });
    x.textAlign = 'center';

    // "at 9:42pm with" + the square that did it
    y += 62;
    x.fillStyle = T.ink; x.font = '700 40px ' + SANS;
    x.fillText('at ' + clock(o.time) + ' with', W / 2, y);
    var qf = fit(x, '‘' + o.square + '’', W - pad * 2 - 80, 112, 46, 26, ROUND, 900);
    var qh = qf.lines.length * qf.size * 1.15 + 36, qy = y + 22;
    x.font = '900 ' + qf.size + 'px ' + ROUND;
    var qw = Math.max.apply(null, qf.lines.map(function (l) { return x.measureText(l).width; })) + 70;
    x.save(); x.shadowColor = 'rgba(43,29,61,.18)'; x.shadowBlur = 18; x.shadowOffsetY = 6;
    rr(x, W / 2 - qw / 2, qy, qw, qh, 24); x.fillStyle = T.win; x.fill(); x.restore();
    x.fillStyle = T.ink; x.textBaseline = 'middle';
    qf.lines.forEach(function (l, k) { x.fillText(l, W / 2, qy + 18 + qf.size * 1.15 * (k + 0.5)); });
    x.textBaseline = 'alphabetic';

    // the card
    var gy = Math.max(qy + qh + 36, H - 84 - gridW - 10), cell = gridW / 5, gap = cell * 0.05, rad = cell * 0.1;
    if (gy + gridW > H - 84) { gridW = H - 84 - gy; cell = gridW / 5; gap = cell * 0.05; rad = cell * 0.1; gx = (W - gridW) / 2; }
    rr(x, gx - gap, gy - gap, gridW + gap * 2, gridW + gap * 2, rad * 1.4); x.fillStyle = T.line; x.fill();
    var inWin = {}, inAny = {};
    (o.lines || []).forEach(function (ln, k) { ln.forEach(function (i) { inAny[i] = 1; if (k === 0) inWin[i] = 1; }); });
    function box(i) { return { x: gx + (i % 5) * cell + gap, y: gy + Math.floor(i / 5) * cell + gap, w: cell - gap * 2 }; }
    var i, q;
    // pass 1: squares and stamps
    for (i = 0; i < 25; i++) {
      q = box(i); var free = o.cells[i] == null;
      rr(x, q.x, q.y, q.w, q.w, rad); x.fillStyle = free ? T.free : inWin[i] ? T.win : T.cell; x.fill();
      if (!free && o.marks[i]) {
        var si = q.w * 0.075;
        x.save(); x.globalAlpha = 0.2; x.fillStyle = T.accent; rr(x, q.x + si, q.y + si, q.w - si * 2, q.w - si * 2, rad * 0.8); x.fill();
        x.globalAlpha = 0.9; x.lineWidth = q.w * 0.025; x.strokeStyle = T.accent; x.stroke(); x.restore();
      }
    }
    // pass 2: the winning line, under the text
    if (o.lines && o.lines[0]) {
      var a = o.lines[0][0], e = o.lines[0][4];
      var ax = gx + (a % 5 + 0.5) * cell, ay = gy + (Math.floor(a / 5) + 0.5) * cell, ex = gx + (e % 5 + 0.5) * cell, ey = gy + (Math.floor(e / 5) + 0.5) * cell;
      var dx = (ex - ax) * 0.09, dy = (ey - ay) * 0.09;
      x.save(); x.strokeStyle = T.accent; x.globalAlpha = 0.3; x.lineCap = 'round'; x.lineWidth = cell * 0.1;
      x.beginPath(); x.moveTo(ax - dx, ay - dy); x.lineTo(ex + dx, ey + dy); x.stroke(); x.restore();
    }
    // pass 3: text, check badges, and a ring on the square that completed the bingo
    for (i = 0; i < 25; i++) {
      q = box(i); var bx = q.x, by = q.y, bw = q.w;
      if (o.cells[i] == null) { star(x, bx + bw / 2, by + bw * 0.4, bw * 0.2, T.ink); x.fillStyle = T.ink; x.font = '900 ' + Math.round(bw * 0.16) + 'px ' + SANS; x.textBaseline = 'middle'; x.fillText('FREE', bx + bw / 2, by + bw * 0.76); continue; }
      var on = o.marks[i], tw = bw * (on ? 0.78 : 0.86), top = bw * (on ? 0.25 : 0.08), th = bw * (on ? 0.66 : 0.84);
      var f = fit(x, o.cells[i], tw, th, Math.round(bw * 0.15), Math.max(9, Math.round(bw * 0.085)), SANS, 700);
      var lh = f.size * 1.15, bh = f.lines.length * lh, ty = Math.max(bw / 2 - bh / 2, top);
      x.fillStyle = T.ink; x.textBaseline = 'middle'; x.font = '700 ' + f.size + 'px ' + SANS;
      f.lines.forEach(function (l, k) { x.fillText(l, bx + bw / 2, by + ty + lh * (k + 0.5)); });
      if (i === o.winIdx) { x.save(); x.lineWidth = bw * 0.05; x.strokeStyle = T.accent; rr(x, bx + bw * 0.025, by + bw * 0.025, bw * 0.95, bw * 0.95, rad * 0.9); x.stroke(); x.restore(); }
      if (on) { x.fillStyle = T.accent; x.beginPath(); x.arc(bx + bw * 0.875, by + bw * 0.125, bw * 0.085, 0, 7); x.fill(); tick(x, bx + bw * 0.875, by + bw * 0.13, bw * 0.085, '#fff'); }
    }
    x.textBaseline = 'alphabetic';
    x.fillStyle = T.muted; x.font = '700 28px ' + SANS;
    x.fillText('Get a card for your party: ' + SITE, W / 2, H - 38);
    return canvas;
  }

  root.PartyRender = { draw: draw, clock: clock, sentence: sentence };
})(typeof self !== 'undefined' ? self : this);
