/* Awards-Night Ballot Pool: 1080x1350 share cards (canvas, no libraries): "My ballot" and the post-show awards. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BallotCards = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var W = 1080, H = 1350, M = 84;
  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var SERIF = 'Georgia, "Times New Roman", Times, serif';
  var SITE = 'lanternlab2027.github.io/lab/ballot';
  var FOOT = 'For bragging rights. Not affiliated with any awards organization.';
  var THEMES = {
    ballot: { bg: ['#1a1410', '#07060a'], accent: '#e9c46a', glow: 'rgba(233,196,106,.20)' },
    oracle: { bg: ['#2a1a4a', '#0b0618'], accent: '#f3d27a', glow: 'rgba(243,210,122,.22)' },
    upset: { bg: ['#5a0f1f', '#1a0308'], accent: '#ffcf70', glow: 'rgba(255,140,90,.22)' },
    contrarian: { bg: ['#0e3b3a', '#031413'], accent: '#9ff0d8', glow: 'rgba(159,240,216,.18)' }
  };

  function F(w, s, fam) { return w + ' ' + s + 'px ' + (fam || SANS); }
  function spacing(x, px) { if ('letterSpacing' in x) x.letterSpacing = px + 'px'; }
  function fit(x, text, max, size, weight, min, fam) {
    var s = size; x.font = F(weight, s, fam);
    while (x.measureText(text).width > max && s > (min || 22)) { s -= 2; x.font = F(weight, s, fam); }
    return s;
  }
  function ellipsize(x, text, max) {
    text = String(text);
    if (x.measureText(text).width <= max) return text;
    while (text.length > 1 && x.measureText(text + '...').width > max) text = text.slice(0, -1);
    return text.replace(/\s+$/, '') + '...';
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
  function star(x, cx, cy, r, color) {
    x.save(); x.fillStyle = color; x.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r;
      x[i ? 'lineTo' : 'moveTo'](cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    x.closePath(); x.fill(); x.restore();
  }
  function background(x, th) {
    var g = x.createLinearGradient(0, 0, W * 0.3, H); g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // two spotlight beams from the top corners
    [[-60, 1], [W + 60, -1]].forEach(function (s) {
      var gr = x.createLinearGradient(s[0], 0, W / 2, H * 0.55);
      gr.addColorStop(0, th.glow); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.beginPath(); x.moveTo(s[0], -10); x.lineTo(W / 2 - s[1] * 260, H * 0.62); x.lineTo(W / 2 + s[1] * 40, H * 0.62); x.closePath(); x.fill();
    });
    // art-deco double frame
    x.strokeStyle = th.accent; x.globalAlpha = 0.55; x.lineWidth = 3; x.strokeRect(34, 34, W - 68, H - 68);
    x.globalAlpha = 0.3; x.lineWidth = 1.5; x.strokeRect(48, 48, W - 96, H - 96); x.globalAlpha = 1;
    [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]].forEach(function (p) { star(x, p[0], p[1], 14, th.accent); });
  }
  function footer(x, th) {
    x.textAlign = 'center';
    x.fillStyle = 'rgba(255,255,255,.72)'; fit(x, FOOT, W - 2 * M, 27, '600', 20); x.fillText(FOOT, W / 2, H - 116);
    x.fillStyle = th.accent; x.font = F('800', 34);
    x.fillText('Make yours: ' + SITE, W / 2, H - 70);
  }
  function kicker(x, th, text, sub) {
    x.textAlign = 'center';
    x.fillStyle = th.accent; x.font = F('800', 28); spacing(x, 7);
    x.fillText(text, W / 2, 124); spacing(x, 0);
    if (sub) { x.fillStyle = 'rgba(255,255,255,.82)'; fit(x, sub, W - 2 * M - 40, 34, '700', 22); x.fillText(sub, W / 2, 172); }
  }
  function rule(x, th, y) {
    x.strokeStyle = th.accent; x.globalAlpha = 0.6; x.lineWidth = 2;
    x.beginPath(); x.moveTo(W / 2 - 220, y); x.lineTo(W / 2 - 30, y); x.moveTo(W / 2 + 30, y); x.lineTo(W / 2 + 220, y); x.stroke();
    x.globalAlpha = 1; star(x, W / 2, y, 12, th.accent);
  }

  // p: { name, pool, show, demo, picks: [{ cat, pick, mark: 'ok'|'bad'|'' }], picked, total, score: '6 of 8 right' or '' }
  function drawBallot(canvas, p) {
    canvas.width = W; canvas.height = H;
    var x = canvas.getContext('2d'), th = THEMES.ballot;
    background(x, th);
    kicker(x, th, p.demo ? 'MY BALLOT  -  DEMO' : 'MY BALLOT', p.show);
    x.textAlign = 'center'; x.fillStyle = '#fff';
    fit(x, p.name, W - 2 * M - 40, 92, '700', 44, SERIF); x.fillText(p.name, W / 2, 285);
    x.fillStyle = 'rgba(255,255,255,.7)'; fit(x, p.pool, W - 2 * M - 40, 30, '600', 20); x.fillText(p.pool, W / 2, 333);
    rule(x, th, 372);
    var rows = p.picks.slice(0, 8), y = 440, rowH = Math.min(100, Math.floor(650 / Math.max(rows.length, 1)));
    rows.forEach(function (r) {
      x.textAlign = 'left';
      x.fillStyle = 'rgba(255,255,255,.62)'; x.font = F('800', 22); spacing(x, 2);
      x.fillText(ellipsize(x, r.cat.toUpperCase(), W - 2 * M - 120), M + 40, y); spacing(x, 0);
      x.fillStyle = r.mark === 'bad' ? 'rgba(255,255,255,.55)' : '#fff';
      x.font = F('700', 36, SERIF); x.fillText(ellipsize(x, r.pick || '-', W - 2 * M - 120), M + 40, y + 40);
      if (r.mark) {
        x.textAlign = 'right'; x.font = F('900', 40);
        x.fillStyle = r.mark === 'ok' ? th.accent : 'rgba(255,140,120,.9)';
        x.fillText(r.mark === 'ok' ? '\u2713' : '\u2717', W - M - 36, y + 34);
      }
      y += rowH;
    });
    x.textAlign = 'center';
    var line = p.score || (p.picked + ' of ' + p.total + ' categories picked' + (p.total > rows.length ? ' (top ' + rows.length + ' shown)' : ''));
    x.fillStyle = th.accent; fit(x, line, W - 2 * M - 40, 40, '800', 24); x.fillText(line, W / 2, H - 196);
    footer(x, th);
    return canvas;
  }

  // a: { id, title, name, stat, blurb }; pool, show: strings
  function drawAward(canvas, a, pool, show, demo) {
    canvas.width = W; canvas.height = H;
    var x = canvas.getContext('2d'), th = THEMES[a.id] || THEMES.oracle;
    background(x, th);
    kicker(x, th, demo ? 'BALLOT POOL AWARDS  -  DEMO' : 'BALLOT POOL AWARDS', pool);
    // emblem: a star in a ring of small stars
    star(x, W / 2, 360, 96, th.accent);
    for (var i = 0; i < 12; i++) { var ang = i * Math.PI / 6; star(x, W / 2 + 150 * Math.cos(ang), 360 + 150 * Math.sin(ang), 9, th.accent); }
    x.textAlign = 'center'; x.fillStyle = '#fff';
    var y = 640;
    fit(x, a.title, W - 2 * M - 40, 96, '700', 50, SERIF); x.fillText(a.title, W / 2, y);
    y += 140;
    x.fillStyle = th.accent; fit(x, a.name, W - 2 * M - 40, 120, '900', 46); x.fillText(a.name, W / 2, y);
    y += 100;
    x.fillStyle = '#fff'; x.font = F('700', 42);
    var sl = wrap(x, a.stat, W - 2 * M - 60).slice(0, 2);
    sl.forEach(function (l, k) { x.fillText(l, W / 2, y + k * 54); });
    y += sl.length * 54 + 22;
    x.fillStyle = 'rgba(255,255,255,.78)'; x.font = F('500', 34);
    wrap(x, a.blurb, W - 2 * M - 60).slice(0, 2).forEach(function (l, k) { x.fillText(l, W / 2, y + k * 44); });
    x.fillStyle = 'rgba(255,255,255,.6)'; fit(x, show, W - 2 * M - 40, 28, '700', 20); x.fillText(show, W / 2, H - 186);
    footer(x, th);
    return canvas;
  }

  return { W: W, H: H, drawBallot: drawBallot, drawAward: drawAward, THEMES: THEMES, SITE: SITE };
});
