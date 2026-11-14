/* 1080x1350 share card for NYC Restaurant Report Card. Canvas only, system fonts. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EatsCard = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var W = 1080, H = 1350;
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var FOOTER = 'lanternlab2027.github.io/lab/eats';
  var COLORS = {
    paper: '#f7f2e8', ink: '#1d1b18', muted: '#5e574c', rule: '#d9cfbd', band: '#1d1b18',
    A: '#1f6b4a', B: '#9a6412', C: '#9e3d2a', Z: '#3f5873', P: '#3f5873', N: '#5e574c'
  };

  function gradeColor(g) { return COLORS[g] || COLORS.N; }

  function wrap(ctx, text, maxW, maxLines) {
    var words = String(text).split(/\s+/).filter(Boolean), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(t).width <= maxW || !cur) cur = t;
      else { lines.push(cur); cur = words[i]; }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = last.replace(/\s+$/, '') + '…';
    }
    // A single very long word: shrink is handled by the caller via fitText.
    return lines;
  }

  /** Pick the largest font size (step 4) where the text fits in maxLines. */
  function fitText(ctx, text, weight, maxW, maxLines, start, min) {
    for (var s = start; s >= min; s -= 4) {
      ctx.font = weight + ' ' + s + 'px ' + FONT;
      var lines = wrap(ctx, text, maxW, 99);
      var widest = Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; }));
      if (lines.length <= maxLines && widest <= maxW) return { size: s, lines: lines };
    }
    ctx.font = weight + ' ' + min + 'px ' + FONT;
    return { size: min, lines: wrap(ctx, text, maxW, maxLines) };
  }

  /**
   * data: { name, address, boro, grade, gradeDate, score, lastDate, asOf }
   * score = score of the graded inspection if gradeDate is set, else of the latest inspection.
   * Dates are already formatted strings.
   */
  function draw(canvas, data) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var g = data.grade;
    var col = gradeColor(g);
    var letter = (g === 'A' || g === 'B' || g === 'C');
    ctx.textBaseline = 'alphabetic';

    // Paper
    ctx.fillStyle = COLORS.paper; ctx.fillRect(0, 0, W, H);
    // Grade-colored top strip
    ctx.fillStyle = col; ctx.fillRect(0, 0, W, 18);

    var L = 84, R = W - 84, MW = R - L;
    ctx.fillStyle = COLORS.muted;
    ctx.font = '800 26px ' + FONT;
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '4px';
    ctx.fillText('NYC RESTAURANT REPORT CARD', L, 102);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

    ctx.fillStyle = COLORS.ink;
    ctx.font = '700 48px ' + FONT;
    ctx.fillText('Before you go:', L, 190);

    var name = fitText(ctx, data.name || 'This restaurant', '900', MW, 2, 104, 72);
    if (name.lines.length > 2 || name.lines[name.lines.length - 1].slice(-1) === '\u2026') name = fitText(ctx, data.name || 'This restaurant', '900', MW, 3, 72, 52);
    var y = 190 + 24;
    ctx.fillStyle = COLORS.ink;
    name.lines.forEach(function (ln) { y += Math.round(name.size * 1.04); ctx.fillText(ln, L, y); });

    var addr = [data.address, data.boro].filter(Boolean).join(', ');
    if (addr) {
      ctx.fillStyle = COLORS.muted;
      var a = fitText(ctx, addr, '600', MW, 1, 34, 24);
      y += 56; ctx.fillText(a.lines[0], L, y);
    }

    // Verb line
    y += 82;
    ctx.fillStyle = COLORS.ink;
    ctx.font = '700 46px ' + FONT;
    var verb = letter ? (g === 'A' ? 'got an' : 'got a') : (g === 'Z' || g === 'P' ? 'has a' : 'is');
    ctx.fillText(verb, L, y);

    // Grade badge: shrink if a long name/address leaves less room (caveat block needs ~170px).
    var by = H - 150;
    var top = y + 30;
    var size = Math.max(250, Math.min(420, by - 190 - top));
    var cx = L + size / 2, cy = top + size / 2;
    ctx.fillStyle = '#fffdf8';
    ctx.strokeStyle = col; ctx.lineWidth = Math.round(size * 0.052);
    ctx.beginPath(); ctx.arc(cx, cy, size / 2 - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.textAlign = 'center';
    if (letter) {
      ctx.font = '900 ' + Math.round(size * 0.714) + 'px ' + FONT;
      ctx.fillText(g, cx, cy + Math.round(size * 0.252));
    } else {
      var t1 = (g === 'Z' || g === 'P') ? 'Grade' : 'Not yet';
      var t2 = (g === 'Z' || g === 'P') ? 'Pending' : 'graded';
      var fs = Math.round(size * 0.181);
      ctx.font = '900 ' + fs + 'px ' + FONT;
      ctx.fillText(t1, cx, cy - fs * 0.08); ctx.fillText(t2, cx, cy + fs * 0.97);
    }
    ctx.textAlign = 'left';

    // Facts to the right of the badge
    var fx = L + size + 48, fw = R - fx, fy = top + Math.min(70, size * 0.17);
    var tight = size < 380;
    function fact(label, value) {
      if (!value) return;
      ctx.fillStyle = COLORS.muted; ctx.font = '700 25px ' + FONT;
      ctx.fillText(label, fx, fy);
      var v = fitText(ctx, value, '800', fw, 2, 40, 26);
      ctx.fillStyle = COLORS.ink;
      v.lines.forEach(function (ln, i) { ctx.fillText(ln, fx, fy + 46 + i * (v.size + 4)); });
      fy += 46 + v.lines.length * (v.size + 4) + (tight ? 22 : 34);
    }
    var hasScore = data.score !== null && data.score !== undefined && data.score !== '';
    if (data.gradeDate) {
      fact('Grade issued', data.gradeDate);
      if (hasScore) fact('Score that inspection', data.score + ' pts');
      fact('Last inspection', data.lastDate);
    } else {
      fact('Last inspection', data.lastDate);
      if (hasScore) fact('Score that day', data.score + ' pts');
    }

    // Caveat
    var cyText = Math.min(Math.max(top + size, fy - 20) + 92, by - 3 * 38 - 8);
    ctx.strokeStyle = COLORS.rule; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(L, cyText - 52); ctx.lineTo(R, cyText - 52); ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '600 27px ' + FONT;
    var cav = wrap(ctx, 'Lower scores are better: A is 0\u201313 points. One inspection is a snapshot of one day. Official data from NYC DOHMH via NYC Open Data' + (data.asOf ? ', as of ' + data.asOf : '') + '.', MW, 3);
    cav.forEach(function (ln, i) { ctx.fillText(ln, L, cyText + i * 38); });

    // Footer band
    ctx.fillStyle = COLORS.band; ctx.fillRect(0, by, W, 150);
    ctx.fillStyle = '#f7f2e8';
    ctx.font = '800 40px ' + FONT;
    ctx.fillText('Make yours', L, by + 68);
    ctx.font = '700 34px ' + FONT;
    ctx.fillStyle = '#e9dfcb';
    ctx.fillText(FOOTER, L, by + 114);
    ctx.textAlign = 'right';
    ctx.font = '600 20px ' + FONT;
    ctx.fillStyle = '#b9ad97';
    ctx.fillText('Not affiliated with NYC DOHMH', R, by + 66);
    ctx.textAlign = 'left';
    return canvas;
  }

  return { draw: draw, W: W, H: H, FOOTER: FOOTER, gradeColor: gradeColor, COLORS: COLORS };
});
