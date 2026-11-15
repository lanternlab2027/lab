/* 76-Team Bracket: 1080x1350 share cards (canvas, no libraries): awards and "my picks". */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BracketCards = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var W = 1080, H = 1350, M = 84;
  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var SITE = 'lanternlab2027.github.io/lab/bracket';
  var THEMES = {
    best: { bg: ['#1b2a4a', '#0b1324'], accent: '#ffb02e', label: 'Gold' },
    upset: { bg: ['#7a1630', '#2a0610'], accent: '#ffd25e' },
    cinderella: { bg: ['#3c2a86', '#140b33'], accent: '#a8e8ff' },
    busted: { bg: ['#4b4f58', '#15171c'], accent: '#ff8a65' },
    hotstart: { bg: ['#b2420f', '#3d1203'], accent: '#ffe7a3' },
    chalk: { bg: ['#0f5c55', '#03221f'], accent: '#c8ffef' },
    picks: { bg: ['#13294b', '#081226'], accent: '#ff7a1a' }
  };

  function F(w, s) { return w + ' ' + s + 'px ' + SANS; }
  function spacing(x, px) { if ('letterSpacing' in x) x.letterSpacing = px + 'px'; }
  function fit(x, text, max, size, weight, min) {
    var s = size; x.font = F(weight, s);
    while (x.measureText(text).width > max && s > (min || 24)) { s -= 2; x.font = F(weight, s); }
    return s;
  }
  function wrap(x, text, max) {
    var out = [], cur = '';
    String(text).split(' ').forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (x.measureText(t).width <= max || !cur) cur = t; else { out.push(cur); cur = w; }
    });
    if (cur) out.push(cur);
    return out;
  }
  function background(x, th) {
    var g = x.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // faint bracket lines down both edges
    x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 4;
    for (var side = 0; side < 2; side++) {
      for (var k = 0; k < 8; k++) {
        var y = 120 + k * 150, x0 = side ? W : 0, d = side ? -1 : 1;
        x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + d * 70, y); x.lineTo(x0 + d * 70, y + 75); x.lineTo(x0, y + 75); x.stroke();
        if (k % 2 === 0) { x.beginPath(); x.moveTo(x0 + d * 70, y + 37); x.lineTo(x0 + d * 130, y + 37); x.lineTo(x0 + d * 130, y + 187); x.lineTo(x0 + d * 70, y + 187); x.stroke(); }
      }
    }
  }
  function ball(x, cx, cy, r, color) {
    x.save();
    x.fillStyle = color; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = r * 0.06;
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx + r, cy); x.stroke();
    x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx, cy + r); x.stroke();
    x.beginPath(); x.arc(cx - r * 1.35, cy, r * 1.05, -0.75, 0.75); x.stroke();
    x.beginPath(); x.arc(cx + r * 1.35, cy, r * 1.05, Math.PI - 0.75, Math.PI + 0.75); x.stroke();
    x.restore();
  }
  function footer(x, th, extra) {
    x.textAlign = 'center';
    x.fillStyle = 'rgba(255,255,255,.72)'; x.font = F('600', 28);
    x.fillText(extra || 'For bragging rights. Not affiliated with the NCAA.', W / 2, H - 112);
    x.fillStyle = th.accent; x.font = F('800', 34);
    x.fillText('Make yours: ' + SITE, W / 2, H - 62);
  }
  function kicker(x, th, text, sub) {
    x.textAlign = 'center';
    x.fillStyle = th.accent; x.font = F('800', 30); spacing(x, 6);
    x.fillText(text, W / 2, 116); spacing(x, 0);
    if (sub) { x.fillStyle = 'rgba(255,255,255,.8)'; fit(x, sub, W - 2 * M, 34, '700', 22); x.fillText(sub, W / 2, 166); }
  }

  // a: { id, title, stat, blurb, name }, pool: pool name
  function drawAward(canvas, a, pool) {
    canvas.width = W; canvas.height = H;
    var x = canvas.getContext('2d'), th = THEMES[a.id] || THEMES.best;
    background(x, th);
    kicker(x, th, 'BRACKET POOL AWARDS 2027', pool);
    ball(x, W / 2, 360, 110, th.accent);
    x.textAlign = 'center'; x.fillStyle = '#fff';
    x.font = F('900', 88);
    var tl = wrap(x, a.title, W - 2 * M).slice(0, 2), y = 620;
    tl.forEach(function (l, i) { fit(x, l, W - 2 * M, 88, '900', 50); x.fillText(l, W / 2, y + i * 96); });
    y += (tl.length - 1) * 96 + 170;
    x.fillStyle = th.accent; fit(x, a.name, W - 2 * M, 128, '900', 48); x.fillText(a.name, W / 2, y);
    y += 120;
    x.fillStyle = '#fff'; x.font = F('700', 44);
    wrap(x, a.stat, W - 2 * M).slice(0, 3).forEach(function (l, i) { x.fillText(l, W / 2, y + i * 56); });
    y += Math.min(3, wrap(x, a.stat, W - 2 * M).length) * 56 + 26;
    x.fillStyle = 'rgba(255,255,255,.78)'; x.font = F('500', 36);
    wrap(x, a.blurb, W - 2 * M).slice(0, 2).forEach(function (l, i) { x.fillText(l, W / 2, y + i * 46); });
    footer(x, th);
    return canvas;
  }

  // p: { name, pool, champ, finalists: [a, b], semis: [4 labels], upset: label or '', tb }
  function drawPicks(canvas, p) {
    canvas.width = W; canvas.height = H;
    var x = canvas.getContext('2d'), th = THEMES.picks;
    background(x, th);
    kicker(x, th, 'MY 2027 BRACKET', p.pool);
    x.textAlign = 'center';
    x.fillStyle = '#fff'; fit(x, p.name, W - 2 * M, 96, '900', 44); x.fillText(p.name, W / 2, 290);
    ball(x, W / 2, 420, 70, th.accent);
    x.fillStyle = 'rgba(255,255,255,.75)'; x.font = F('800', 32); spacing(x, 5); x.fillText('CHAMPION', W / 2, 560); spacing(x, 0);
    x.fillStyle = th.accent; fit(x, p.champ || 'Not picked yet', W - 2 * M, 104, '900', 44); x.fillText(p.champ || 'Not picked yet', W / 2, 670);
    var y = 770;
    x.fillStyle = 'rgba(255,255,255,.75)'; x.font = F('800', 28); spacing(x, 4); x.fillText('TITLE GAME', W / 2, y); spacing(x, 0);
    x.fillStyle = '#fff'; var tg = (p.finalists[0] || '?') + '  vs  ' + (p.finalists[1] || '?');
    fit(x, tg, W - 2 * M, 50, '800', 26); x.fillText(tg, W / 2, y + 62);
    y += 150;
    x.fillStyle = 'rgba(255,255,255,.75)'; x.font = F('800', 28); spacing(x, 4); x.fillText('NATIONAL SEMIFINALS', W / 2, y); spacing(x, 0);
    x.fillStyle = '#fff';
    [p.semis.slice(0, 2).join('  \u00b7  '), p.semis.slice(2, 4).join('  \u00b7  ')].forEach(function (l, i) { fit(x, l, W - 2 * M, 40, '700', 22); x.fillText(l, W / 2, y + 56 + i * 52); });
    y += 190;
    if (p.upset) {
      x.fillStyle = 'rgba(255,255,255,.75)'; x.font = F('800', 26); spacing(x, 4); x.fillText('BOLDEST PICK', W / 2, y); spacing(x, 0);
      x.fillStyle = th.accent; fit(x, p.upset, W - 2 * M, 38, '700', 22); x.fillText(p.upset, W / 2, y + 50);
    }
    footer(x, th, 'For bragging rights. Not affiliated with the NCAA.');
    return canvas;
  }

  return { W: W, H: H, drawAward: drawAward, drawPicks: drawPicks, THEMES: THEMES, SITE: SITE };
});
