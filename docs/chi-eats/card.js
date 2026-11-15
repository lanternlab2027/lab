/* 1080x1350 "Before you go" share card for Chicago Restaurant Report Card. Canvas only, system fonts. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChiCard = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var W = 1080, H = 1350;
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var FOOTER = 'lanternlab2027.github.io/lab/chi-eats';
  var COLORS = {
    paper: '#f6f3ec', sheet: '#fffdf8', ink: '#16191d', muted: '#565b62', rule: '#d6d0c4', band: '#16191d',
    pass: '#1f6b4a', cond: '#8a5a0f', fail: '#a23a28', other: '#565b62'
  };
  var BADGE = {
    pass: ['Pass'], cond: ['Pass w/', 'Conditions'], fail: ['Fail'],
    oob: ['Out of', 'Business'], noentry: ['No', 'Entry'], notready: ['Not', 'Ready'], notlocated: ['Not', 'Located'],
    other: ['See', 'record'], none: ['No', 'records']
  };
  function color(k) { return COLORS[k] || COLORS.other; }

  function wrap(ctx, text, maxW, maxLines) {
    var words = String(text).split(/\s+/).filter(Boolean), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = words[i]; }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = last.replace(/\s+$/, '') + '…';
    }
    return lines;
  }
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
   * data: { name, address, key (result key or 'none'), sentence ("Passed its last inspection on Oct 2, 2026."),
   *         resultLabel, type, risk ("Risk 1 (High)"), lastOutcome (e.g. "Pass, Sep 3, 2026") optional, asOf }
   */
  function draw(canvas, data) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var k = data.key || 'none', col = color(k);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLORS.paper; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = col; ctx.fillRect(0, 0, W, 18);

    var L = 84, R = W - 84, MW = R - L;
    ctx.fillStyle = COLORS.muted; ctx.font = '800 26px ' + FONT;
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '4px';
    ctx.fillText('CHICAGO RESTAURANT REPORT CARD', L, 102);
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';

    ctx.fillStyle = COLORS.ink; ctx.font = '700 48px ' + FONT;
    ctx.fillText('Before you go:', L, 186);

    var name = fitText(ctx, data.name || 'This restaurant', '900', MW, 2, 100, 64);
    if (name.lines[name.lines.length - 1].slice(-1) === '…') name = fitText(ctx, data.name || 'This restaurant', '900', MW, 3, 64, 48);
    var y = 186 + 20;
    ctx.fillStyle = COLORS.ink;
    name.lines.forEach(function (ln) { y += Math.round(name.size * 1.04); ctx.fillText(ln, L, y); });

    if (data.address) {
      ctx.fillStyle = COLORS.muted;
      var a = fitText(ctx, data.address + ', Chicago', '600', MW, 1, 34, 24);
      y += 54; ctx.fillText(a.lines[0], L, y);
    }

    // Factual headline sentence
    var hl = fitText(ctx, data.sentence || 'No inspection records in the data.', '800', MW, 3, 54, 38);
    y += 30;
    ctx.fillStyle = col;
    hl.lines.forEach(function (ln) { y += Math.round(hl.size * 1.16); ctx.fillText(ln, L, y); });

    // Badge + facts
    var by = H - 150;
    var top = y + 44;
    var size = Math.max(230, Math.min(330, by - 210 - top));
    var cx = L + size / 2, cy = top + size / 2;
    ctx.fillStyle = COLORS.sheet; ctx.strokeStyle = col; ctx.lineWidth = Math.round(size * 0.055);
    ctx.beginPath(); ctx.arc(cx, cy, size / 2 - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.textAlign = 'center';
    var words = BADGE[k] || BADGE.other;
    if (words.length === 1) {
      var fs1 = Math.round(size * (words[0].length <= 4 ? 0.3 : 0.24));
      ctx.font = '900 ' + fs1 + 'px ' + FONT; ctx.fillText(words[0], cx, cy + fs1 * 0.36);
    } else {
      var fs = Math.round(size * 0.165);
      ctx.font = '900 ' + fs + 'px ' + FONT;
      while (ctx.measureText(words[1]).width > size * 0.74 && fs > 20) { fs -= 2; ctx.font = '900 ' + fs + 'px ' + FONT; }
      ctx.fillText(words[0], cx, cy - fs * 0.12); ctx.fillText(words[1], cx, cy + fs * 0.98);
    }
    ctx.textAlign = 'left';

    var fx = L + size + 44, fw = R - fx, fy = top + 40;
    var factLimit = by - 3 * 36 - 22 - 50 - 24; // keep clear of the caveat rule
    function fact(label, value) {
      if (!value || fy + 42 + 36 > factLimit) return;
      ctx.fillStyle = COLORS.muted; ctx.font = '700 24px ' + FONT; ctx.fillText(label, fx, fy);
      var v = fitText(ctx, value, '800', fw, 2, 36, 24);
      ctx.fillStyle = COLORS.ink;
      v.lines.forEach(function (ln, i) { ctx.fillText(ln, fx, fy + 42 + i * (v.size + 4)); });
      fy += 42 + v.lines.length * (v.size + 4) + 26;
    }
    fact('Result', data.resultLabel);
    if (data.lastOutcome) fact('Last completed inspection', data.lastOutcome);
    else fact('Inspection type', data.type);
    fact('Risk category', data.risk);

    var cyText = Math.min(Math.max(top + size, fy - 20) + 84, by - 3 * 36 - 22);
    ctx.strokeStyle = COLORS.rule; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(L, cyText - 50); ctx.lineTo(R, cyText - 50); ctx.stroke();
    ctx.fillStyle = COLORS.muted; ctx.font = '600 25px ' + FONT;
    var cav = wrap(ctx, 'One inspection is a snapshot of one day. Risk category reflects the type of food served, not performance. Official data from the Chicago Department of Public Health via the City of Chicago Data Portal' + (data.asOf ? ', through ' + data.asOf : '') + '.', MW, 3);
    cav.forEach(function (ln, i) { ctx.fillText(ln, L, cyText + i * 36); });

    ctx.fillStyle = COLORS.band; ctx.fillRect(0, by, W, 150);
    ctx.fillStyle = '#f6f3ec'; ctx.font = '800 40px ' + FONT; ctx.fillText('Make yours', L, by + 68);
    ctx.font = '700 32px ' + FONT; ctx.fillStyle = '#e4e0d6'; ctx.fillText(FOOTER, L, by + 114);
    ctx.textAlign = 'right'; ctx.font = '600 20px ' + FONT; ctx.fillStyle = '#aeb3ba';
    ctx.fillText('Not affiliated with the', R, by + 58);
    ctx.fillText('City of Chicago', R, by + 86);
    ctx.textAlign = 'left';
    return canvas;
  }

  return { draw: draw, W: W, H: H, FOOTER: FOOTER, COLORS: COLORS, color: color };
});
