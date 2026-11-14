/* Fantasy League Awards: 1080x1350 award card renderer (canvas) and deck builders. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./awards.js'));
  else root.AwardCards = factory(root.Awards);
})(typeof self !== 'undefined' ? self : this, function (A) {
  'use strict';

  var W = 1080, H = 1350, M = 80;
  var STACK = '"Helvetica Neue", "Segoe UI", Roboto, "Liberation Sans", Arial, sans-serif';
  var SITE = 'lanternlab2027.github.io/lab/awards';

  var THEMES = {
    cover:      { bg: ['#123d6b', '#071a33'], accent: '#ffcc33', icon: 'football' },
    high:       { bg: ['#16804a', '#06351d'], accent: '#ffd23f', icon: 'trophy' },
    blowout:    { bg: ['#d1162f', '#4c0611'], accent: '#ffe14d', icon: 'bolt' },
    heartbreak: { bg: ['#a61e6e', '#330a24'], accent: '#ffa3c4', icon: 'heart' },
    bench:      { bg: ['#2563a6', '#0a1e3a'], accent: '#8fdcff', icon: 'bench' },
    luckiest:   { bg: ['#2a9d48', '#0b3a19'], accent: '#c6ff5e', icon: 'clover' },
    unluckiest: { bg: ['#4a5468', '#141820'], accent: '#a9c8ff', icon: 'cloud' },
    low:        { bg: ['#b45a10', '#3a1a03'], accent: '#ffd08a', icon: 'down' },
    power:      { bg: ['#5b2bb5', '#1a0840'], accent: '#ffd23f', icon: 'crown' },
    allplay:    { bg: ['#0f7680', '#04282c'], accent: '#86f5e6', icon: 'bars' },
    moves:      { bg: ['#e0561b', '#4a1405'], accent: '#ffe8a3', icon: 'swap' },
    best:       { bg: ['#c99a06', '#4a3300'], accent: '#fff3b8', icon: 'flame' }
  };

  function F(style, size) { return style + ' ' + size + 'px ' + STACK; }
  function spacing(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fit(ctx, text, style, max, min, width) {
    var s = max; ctx.font = F(style, s);
    while (s > min && ctx.measureText(text).width > width) { s -= 2; ctx.font = F(style, s); }
    return s;
  }
  function ellipsize(ctx, text, width) {
    if (ctx.measureText(text).width <= width) return text;
    var c = Array.from(text);
    while (c.length > 1 && ctx.measureText(c.join('') + '\u2026').width > width) c.pop();
    return c.join('').trim() + '\u2026';
  }
  function wrap(ctx, text, width, maxLines) {
    var words = String(text).split(/\s+/), lines = [], line = '';
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > width && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = ellipsize(ctx, lines[maxLines - 1] + '\u2026', width); }
    return lines;
  }

  function background(ctx, th) {
    var g = ctx.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // yard lines + hash marks
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 4;
    for (var y = 150; y < H - 120; y += 120) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.lineWidth = 3;
      for (var x = 36; x < W; x += 72) { ctx.beginPath(); ctx.moveTo(x, y + 52); ctx.lineTo(x, y + 68); ctx.stroke(); }
      ctx.lineWidth = 4;
    }
    // diagonal speed stripes
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      var x0 = 620 + i * 120;
      ctx.moveTo(x0, 0); ctx.lineTo(x0 + 60, 0); ctx.lineTo(x0 - 340, H); ctx.lineTo(x0 - 400, H); ctx.closePath(); ctx.fill();
    }
    // vignette
    var v = ctx.createRadialGradient(W / 2, H * 0.45, 200, W / 2, H * 0.45, 900);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function header(ctx, th, spec) {
    ctx.save();
    ctx.fillStyle = th.accent; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = F('italic 900', 30); spacing(ctx, 3);
    ctx.fillText('FANTASY LEAGUE AWARDS', M, 84);
    spacing(ctx, 0);
    // pill
    ctx.font = F('900', 30); spacing(ctx, 2);
    var t = spec.pill.toUpperCase(), tw = ctx.measureText(t).width + 48;
    ctx.fillStyle = th.accent; rr(ctx, W - M - tw, 56, tw, 56, 28); ctx.fill();
    ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.fillText(t, W - M - tw / 2, 85);
    spacing(ctx, 0);
    // league name
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = F('700', 34);
    ctx.fillText(ellipsize(ctx, spec.league || '', W - 2 * M), M, 150);
    ctx.restore();
  }

  function footer(ctx, th) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(M, H - 86); ctx.lineTo(W - M, H - 86); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = F('700', 28); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    spacing(ctx, 1);
    ctx.fillText(SITE, W / 2, H - 46);
    ctx.restore();
  }

  /* ---------- icons (drawn, so they look the same everywhere) ---------- */
  function icon(ctx, kind, cx, cy, r, th) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.arc(cx, cy + 8, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, r - 12, 0, Math.PI * 2); ctx.stroke();
    var ink = th.bg[1];
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var s = r / 100;
    ctx.translate(cx, cy); ctx.scale(s, s);
    var p = ctx;
    switch (kind) {
      case 'trophy':
        p.beginPath(); p.moveTo(-38, -46); p.lineTo(38, -46); p.lineTo(34, -6); p.quadraticCurveTo(0, 26, -34, -6); p.closePath(); p.fill();
        p.lineWidth = 9; p.beginPath(); p.arc(-40, -26, 16, Math.PI * 0.5, Math.PI * 1.5); p.stroke(); p.beginPath(); p.arc(40, -26, 16, -Math.PI * 0.5, Math.PI * 0.5); p.stroke();
        p.fillRect(-7, 10, 14, 22); p.fillRect(-28, 32, 56, 14); break;
      case 'bolt':
        p.beginPath(); p.moveTo(12, -58); p.lineTo(-32, 6); p.lineTo(-2, 6); p.lineTo(-14, 58); p.lineTo(32, -10); p.lineTo(2, -10); p.closePath(); p.fill(); break;
      case 'heart':
        p.beginPath(); p.moveTo(0, 46); p.bezierCurveTo(-70, 0, -46, -54, 0, -24); p.bezierCurveTo(46, -54, 70, 0, 0, 46); p.fill();
        p.strokeStyle = THEMES.heartbreak.accent; p.lineWidth = 8; p.beginPath(); p.moveTo(2, -22); p.lineTo(-10, 0); p.lineTo(8, 8); p.lineTo(-2, 40); p.stroke(); break;
      case 'bench':
        p.fillRect(-56, -6, 112, 14); p.fillRect(-56, -40, 112, 12);
        p.fillRect(-48, -40, 10, 80); p.fillRect(38, -40, 10, 80); p.fillRect(-48, 8, 10, 34); break;
      case 'clover':
        [[0, -24], [24, 0], [0, 24], [-24, 0]].forEach(function (o) { p.beginPath(); p.arc(o[0], o[1], 22, 0, Math.PI * 2); p.fill(); });
        p.lineWidth = 9; p.beginPath(); p.moveTo(6, 10); p.quadraticCurveTo(20, 40, 36, 56); p.stroke(); break;
      case 'cloud':
        p.beginPath(); p.arc(-24, -6, 24, 0, Math.PI * 2); p.arc(10, -20, 30, 0, Math.PI * 2); p.arc(36, 2, 20, 0, Math.PI * 2); p.fill(); p.fillRect(-24, -4, 60, 26);
        p.lineWidth = 7; [-24, 0, 24].forEach(function (x) { p.beginPath(); p.moveTo(x, 36); p.lineTo(x - 8, 56); p.stroke(); }); break;
      case 'down':
        p.lineWidth = 14; p.beginPath(); p.moveTo(-34, -40); p.lineTo(0, -8); p.lineTo(34, -40); p.stroke();
        p.beginPath(); p.moveTo(-34, 4); p.lineTo(0, 36); p.lineTo(34, 4); p.stroke(); break;
      case 'crown':
        p.beginPath(); p.moveTo(-54, 34); p.lineTo(-58, -30); p.lineTo(-26, -2); p.lineTo(0, -46); p.lineTo(26, -2); p.lineTo(58, -30); p.lineTo(54, 34); p.closePath(); p.fill(); break;
      case 'bars':
        p.fillRect(-50, 4, 24, 42); p.fillRect(-12, -22, 24, 68); p.fillRect(26, -48, 24, 94); break;
      case 'swap':
        p.lineWidth = 11;
        p.beginPath(); p.moveTo(-46, -18); p.lineTo(40, -18); p.stroke(); p.beginPath(); p.moveTo(20, -38); p.lineTo(44, -18); p.lineTo(20, 2); p.stroke();
        p.beginPath(); p.moveTo(46, 22); p.lineTo(-40, 22); p.stroke(); p.beginPath(); p.moveTo(-20, 2); p.lineTo(-44, 22); p.lineTo(-20, 42); p.stroke(); break;
      case 'flame':
        p.beginPath(); p.moveTo(0, -58); p.bezierCurveTo(30, -20, 50, 0, 40, 26); p.bezierCurveTo(30, 54, -30, 54, -40, 26); p.bezierCurveTo(-48, 0, -20, -14, -14, -34); p.bezierCurveTo(-6, -18, 6, -18, 0, -58); p.fill(); break;
      default: // football
        p.save(); p.rotate(-0.6); p.beginPath(); p.ellipse(0, 0, 62, 36, 0, 0, Math.PI * 2); p.fill();
        p.strokeStyle = th.accent; p.lineWidth = 6; p.beginPath(); p.moveTo(-24, 0); p.lineTo(24, 0); p.stroke();
        for (var k = -16; k <= 16; k += 11) { p.beginPath(); p.moveTo(k, -9); p.lineTo(k, 9); p.stroke(); }
        p.restore();
    }
    ctx.restore();
  }

  /* ---------- layouts ---------- */
  function titleBlock(ctx, th, spec, y) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    var title = spec.title.toUpperCase();
    var sz = fit(ctx, title, 'italic 900', 104, 56, W - 2 * M);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillText(title, W / 2 + 5, y + 6);
    ctx.fillStyle = '#fff'; ctx.fillText(title, W / 2, y);
    if (spec.subtitle) {
      ctx.font = F('600', 34); ctx.fillStyle = th.accent;
      ctx.fillText(ellipsize(ctx, spec.subtitle, W - 2 * M), W / 2, y + 58);
    }
    ctx.restore();
    return sz;
  }

  function drawAward(ctx, th, spec) {
    icon(ctx, th.icon, W / 2, 300, 104, th);
    titleBlock(ctx, th, spec, 530);
    // team plate (skewed)
    var py = 625, ph = spec.manager ? 190 : 160;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(M + 30, py); ctx.lineTo(W - M, py); ctx.lineTo(W - M - 30, py + ph); ctx.lineTo(M, py + ph); ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.accent; ctx.fillRect(M + 8, py + ph - 12, W - 2 * M - 46, 12);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#111';
    var name = spec.team || '';
    var sz = fit(ctx, name, 'italic 900', 92, 44, W - 2 * M - 110);
    if (ctx.measureText(name).width > W - 2 * M - 110) name = ellipsize(ctx, name, W - 2 * M - 110);
    ctx.fillText(name, W / 2, py + (spec.manager ? 78 : ph / 2 - 4));
    if (spec.manager) { ctx.font = F('700', 34); ctx.fillStyle = '#555'; ctx.fillText(ellipsize(ctx, '@' + spec.manager, W - 2 * M - 120), W / 2, py + 142); }
    ctx.restore();

    // big stat
    var by = py + ph + 140;
    ctx.save(); ctx.textBaseline = 'alphabetic';
    ctx.font = F('900', 150); var big = String(spec.big);
    var unit = (spec.unit || '').toUpperCase();
    var bw = ctx.measureText(big).width;
    ctx.font = F('italic 900', 44); var uw = unit ? ctx.measureText(unit).width + 24 : 0;
    var bsz = 150;
    while (bw + uw > W - 2 * M && bsz > 80) { bsz -= 6; ctx.font = F('900', bsz); bw = ctx.measureText(big).width; }
    var x0 = (W - bw - uw) / 2;
    ctx.textAlign = 'left'; ctx.font = F('900', bsz); ctx.fillStyle = th.accent; ctx.fillText(big, x0, by);
    if (unit) { ctx.font = F('italic 900', 44); ctx.fillStyle = '#fff'; ctx.fillText(unit, x0 + bw + 24, by); }
    ctx.restore();

    // detail lines
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = F('600', 38);
    var y = by + 70, maxY = spec.mini && spec.mini.length ? 1060 : H - 130;
    (spec.lines || []).forEach(function (line) {
      wrap(ctx, line, W - 2 * M, 2).forEach(function (l) { if (y <= maxY) { ctx.fillText(l, W / 2, y); y += 50; } });
    });
    ctx.restore();

    if (spec.mini && spec.mini.length) {
      var my = Math.max(y - 10, 1060), rows = spec.mini.slice(0, Math.floor((H - 94 - my) / 58));
      rows.forEach(function (r, i) { boardRow(ctx, th, r, my + i * 58, 50, 30); });
    }
  }

  function boardRow(ctx, th, r, y, h, fs) {
    ctx.save();
    ctx.fillStyle = r.hl ? th.accent : 'rgba(255,255,255,0.12)';
    rr(ctx, M, y, W - 2 * M, h, 12); ctx.fill();
    var ink = r.hl ? '#111' : '#fff';
    ctx.textBaseline = 'middle'; ctx.fillStyle = ink;
    ctx.font = F('italic 900', fs); ctx.textAlign = 'center';
    ctx.fillText(String(r.rank), M + 40, y + h / 2 + 1);
    var right = r.value != null ? String(r.value) : '';
    var right2 = r.value2 != null ? String(r.value2) : '';
    ctx.font = F('900', fs); var rw = right ? ctx.measureText(right).width : 0;
    ctx.font = F('600', fs - 4); var r2w = right2 ? ctx.measureText(right2).width + 28 : 0;
    ctx.textAlign = 'left'; ctx.font = F('800', fs);
    ctx.fillText(ellipsize(ctx, r.name, W - 2 * M - 110 - rw - r2w - 30), M + 84, y + h / 2 + 1);
    ctx.textAlign = 'right';
    if (right) { ctx.font = F('900', fs); ctx.fillText(right, W - M - 24, y + h / 2 + 1); }
    if (right2) { ctx.font = F('600', fs - 4); ctx.fillStyle = r.hl ? 'rgba(0,0,0,0.65)' : (r.tone === 'up' ? '#a8ffb0' : r.tone === 'down' ? '#ffb3b3' : 'rgba(255,255,255,0.75)'); ctx.fillText(right2, W - M - 24 - rw - 28, y + h / 2 + 1); }
    ctx.restore();
  }

  function drawBoard(ctx, th, spec) {
    icon(ctx, th.icon, M + 70, 270, 70, th);
    ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    var title = spec.title.toUpperCase();
    fit(ctx, title, 'italic 900', 84, 48, W - 2 * M - 170);
    ctx.fillStyle = '#fff'; ctx.fillText(title, M + 170, 290);
    if (spec.subtitle) { ctx.font = F('600', 30); ctx.fillStyle = th.accent; ctx.fillText(ellipsize(ctx, spec.subtitle, W - 2 * M - 170), M + 170, 336); }
    ctx.restore();
    var rows = (spec.board || []).slice(0, 12);
    var top = 392, avail = H - 120 - top - (spec.note ? 40 : 0);
    var h = Math.min(86, Math.floor(avail / Math.max(rows.length, 1)) - 10);
    var fs = Math.max(28, Math.min(40, Math.round(h * 0.5)));
    if (spec.boardHead) {
      ctx.save(); ctx.font = F('800', 22); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'right'; spacing(ctx, 2);
      ctx.fillText(spec.boardHead.toUpperCase(), W - M - 24, top - 12); ctx.restore();
    }
    rows.forEach(function (r, i) { boardRow(ctx, th, r, top + i * (h + 10), h, fs); });
    if (spec.note) {
      ctx.save(); ctx.font = F('600', 26); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.textAlign = 'center';
      ctx.fillText(ellipsize(ctx, spec.note, W - 2 * M), W / 2, H - 112); ctx.restore();
    }
  }

  function render(canvas, spec) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var th = THEMES[spec.theme] || THEMES.cover;
    background(ctx, th);
    header(ctx, th, spec);
    if (spec.layout === 'board') drawBoard(ctx, th, spec); else drawAward(ctx, th, spec);
    footer(ctx, th);
    return canvas;
  }

  /* ---------- deck builders ---------- */
  var P = function (x) { return A.fmtPts(x); };
  function pct(x) { return x.toFixed(3).replace(/^0/, ''); }

  function weeklyDeck(wk, meta) {
    if (!wk) return [];
    var pill = 'Week ' + meta.week + (meta.live ? ' \u2022 live' : '');
    var base = { league: meta.leagueName, pill: pill };
    function C(o) { var c = {}; Object.keys(base).forEach(function (k) { c[k] = base[k]; }); Object.keys(o).forEach(function (k) { c[k] = o[k]; }); return c; }
    var deck = [];
    var summary = [];
    summary.push({ rank: '\u2605', name: 'Top score: ' + wk.high.team.name, value: P(wk.high.points), hl: true });
    if (wk.blowout) summary.push({ rank: '\u2605', name: 'Blowout: ' + wk.blowout.winner.name, value: '+' + P(wk.blowout.margin) });
    if (wk.heartbreak) summary.push({ rank: '\u2605', name: 'Heartbreak: ' + wk.heartbreak.loser.name, value: '-' + P(wk.heartbreak.margin) });
    if (wk.bench) summary.push({ rank: '\u2605', name: 'Bench: ' + wk.bench.team.name, value: P(wk.bench.bench) });
    if (wk.luckiest) summary.push({ rank: '\u2605', name: 'Luckiest: ' + wk.luckiest.team.name, value: P(wk.luckiest.points) });
    if (wk.unluckiest) summary.push({ rank: '\u2605', name: 'Unluckiest: ' + wk.unluckiest.team.name, value: P(wk.unluckiest.points) });
    summary.push({ rank: '\u2605', name: 'Low score: ' + wk.low.team.name, value: P(wk.low.points) });
    deck.push(C({ id: 'w-cover', theme: 'cover', layout: 'board', title: 'Week ' + meta.week + ' Awards', subtitle: meta.live ? 'Week still in progress: scores can change' : wk.teamCount + ' teams \u2022 final scores', board: summary }));

    var h = wk.high;
    deck.push(C({ id: 'w-high', theme: 'high', title: 'Highest Scorer', subtitle: 'Top score of the week', team: h.team.name, manager: h.team.manager, big: P(h.points), unit: 'pts',
      lines: h.opp ? [(h.points > h.oppPoints ? 'Beat ' : 'Somehow lost to ') + h.opp.name + ' ' + P(h.points) + '\u2013' + P(h.oppPoints)] : [],
      mini: wk.ranked.slice(0, 3).map(function (r, i) { return { rank: i + 1, name: r.team.name, value: P(r.points), hl: i === 0 }; }) }));
    if (wk.blowout) {
      var b = wk.blowout;
      deck.push(C({ id: 'w-blowout', theme: 'blowout', title: 'Biggest Blowout', subtitle: 'Largest margin of victory', team: b.winner.name, manager: b.winner.manager, big: '+' + P(b.margin), unit: 'margin',
        lines: [b.winner.name + ' ' + P(b.wPts) + ', ' + b.loser.name + ' ' + P(b.lPts), 'Somebody check on ' + b.loser.name + '.'] }));
    }
    if (wk.heartbreak) {
      var hb = wk.heartbreak;
      deck.push(C({ id: 'w-heartbreak', theme: 'heartbreak', title: 'Heartbreak Award', subtitle: 'Narrowest loss of the week', team: hb.loser.name, manager: hb.loser.manager, big: P(hb.margin), unit: 'pts short',
        lines: ['Lost to ' + hb.winner.name + ' ' + P(hb.wPts) + '\u2013' + P(hb.lPts)] }));
    }
    if (wk.bench) {
      var be = wk.bench;
      deck.push(C({ id: 'w-bench', theme: 'bench', title: 'Bench Warmer', subtitle: 'Most points left on the bench', team: be.team.name, manager: be.team.manager, big: P(be.bench), unit: 'on bench',
        lines: ['Starters scored ' + P(be.points) + (be.lost ? ' in a loss.' : '.')] }));
    }
    if (wk.luckiest) {
      var lk = wk.luckiest;
      var l1 = 'Only the ' + A.ordinal(lk.rank) + '-best score of ' + wk.teamCount;
      deck.push(C({ id: 'w-luckiest', theme: 'luckiest', title: 'Luckiest Win', subtitle: 'Lowest score that still won', team: lk.team.name, manager: lk.team.manager, big: P(lk.points), unit: 'and won',
        lines: [l1, 'Beat ' + lk.opp.name + ' (' + P(lk.oppPoints) + (lk.oppWasLowest ? ', the week\u2019s lowest' : '') + ')', lk.wouldHaveLostTo ? 'Would have lost to ' + lk.wouldHaveLostTo + ' team' + (lk.wouldHaveLostTo === 1 ? '' : 's') : 'Top score anyway. Not that lucky.'] }));
    }
    if (wk.unluckiest) {
      var uk = wk.unluckiest;
      deck.push(C({ id: 'w-unluckiest', theme: 'unluckiest', title: 'Unluckiest Loss', subtitle: 'Highest score that still lost', team: uk.team.name, manager: uk.team.manager, big: P(uk.points), unit: 'and lost',
        lines: [A.ordinal(uk.rank) + '-best score of ' + wk.teamCount, 'Ran into ' + uk.opp.name + ' (' + P(uk.oppPoints) + ')', 'Would have beaten ' + uk.wouldHaveBeaten + ' team' + (uk.wouldHaveBeaten === 1 ? '' : 's')] }));
    }
    var lo = wk.low;
    deck.push(C({ id: 'w-low', theme: 'low', title: 'Participation Trophy', subtitle: 'Lowest score of the week', team: lo.team.name, manager: lo.team.manager, big: P(lo.points), unit: 'pts',
      lines: lo.opp ? [(lo.points < lo.oppPoints ? 'Lost to ' : 'Still beat ') + lo.opp.name + ' (' + P(lo.oppPoints) + ')', 'There\u2019s always next week.'] : ['There\u2019s always next week.'] }));
    return deck;
  }

  function seasonDeck(se, meta) {
    if (!se) return [];
    var n = se.weeks.length;
    var base = { league: meta.leagueName, pill: meta.season + ' season' };
    function C(o) { var c = {}; Object.keys(base).forEach(function (k) { c[k] = base[k]; }); Object.keys(o).forEach(function (k) { c[k] = o[k]; }); return c; }
    var thru = 'Through week ' + se.weeks[n - 1] + ' \u2022 ' + n + ' week' + (n === 1 ? '' : 's');
    var deck = [];
    deck.push(C({ id: 's-power', theme: 'power', layout: 'board', title: 'Power Rankings', subtitle: thru, boardHead: 'record \u00b7 score',
      board: se.power.map(function (s, i) { return { rank: i + 1, name: s.team.name, value: s.power.toFixed(1), value2: A.record(s), hl: i === 0 }; }),
      note: 'Score: 50% all-play win %, 30% points per game, 20% last 3 weeks' }));
    deck.push(C({ id: 's-allplay', theme: 'allplay', layout: 'board', title: 'Record vs All-Play', subtitle: 'If you played every team every week', boardHead: 'actual \u00b7 all-play',
      board: se.allPlay.map(function (s, i) { var d = s.winPct - s.apPct; return { rank: i + 1, name: s.team.name, value: A.apRecord(s), value2: A.record(s), tone: d > 0.08 ? 'up' : d < -0.08 ? 'down' : '', hl: false }; }),
      note: 'Green = winning more than their scores deserve. Red = robbed.' }));
    var lk = se.luckiest, un = se.unluckiest;
    function paMost(s) { var r = 1 + se.standings.filter(function (x) { return x.pa > s.pa; }).length; return r === 1 ? 'most in the league' : A.ordinal(r) + '-most'; }
    function paFewest(s) { var r = 1 + se.standings.filter(function (x) { return x.pa < s.pa; }).length; return r === 1 ? 'fewest in the league' : A.ordinal(r) + '-fewest'; }
    deck.push(C({ id: 's-luckiest', theme: 'luckiest', title: 'Luckiest Manager', subtitle: 'Biggest gap: real record over all-play', team: lk.team.name, manager: lk.team.manager, big: A.record(lk), unit: 'record',
      lines: ['All-play record: ' + A.apRecord(lk) + ' (' + pct(lk.apPct) + ')', 'Points against: ' + P(lk.pa) + ' (' + paFewest(lk) + ')'] }));
    deck.push(C({ id: 's-unluckiest', theme: 'unluckiest', title: 'Unluckiest Manager', subtitle: 'All-play record says they deserve better', team: un.team.name, manager: un.team.manager, big: A.record(un), unit: 'record',
      lines: ['All-play record: ' + A.apRecord(un) + ' (' + pct(un.apPct) + ')', 'Points against: ' + P(un.pa) + ' (' + paMost(un) + ')'] }));
    if (se.moves) {
      var k = se.moves.king;
      deck.push(C({ id: 's-moves', theme: 'moves', title: 'Trade & Waiver King', subtitle: 'Most completed transactions', team: k.team.name, manager: k.team.manager, big: String(k.total), unit: k.total === 1 ? 'move' : 'moves',
        lines: [k.trades + ' trade' + (k.trades === 1 ? '' : 's') + ' \u2022 ' + k.waivers + ' waiver claim' + (k.waivers === 1 ? '' : 's') + ' \u2022 ' + k.freeAgents + ' free agent' + (k.freeAgents === 1 ? '' : 's')],
        mini: se.moves.ranked.slice(0, 3).map(function (m, i) { return { rank: i + 1, name: m.team.name, value: String(m.total), hl: i === 0 }; }) }));
    }
    if (se.bench) {
      var bb = se.bench[0];
      deck.push(C({ id: 's-bench', theme: 'bench', title: 'Season Bench Boss', subtitle: 'Most points left on the bench', team: bb.team.name, manager: bb.team.manager, big: P(bb.bench), unit: 'bench pts',
        lines: ['That\u2019s ' + P(bb.bench / Math.max(1, bb.scores.length)) + ' a week sitting on the pine.'],
        mini: se.bench.slice(0, 3).map(function (s, i) { return { rank: i + 1, name: s.team.name, value: P(s.bench), hl: i === 0 }; }) }));
    }
    if (se.bestWeek) {
      var bw = se.bestWeek;
      deck.push(C({ id: 's-best', theme: 'best', title: 'Week of the Year', subtitle: 'Highest single-week score', team: bw.team.name, manager: bw.team.manager, big: P(bw.points), unit: 'in week ' + bw.week,
        lines: ['Most points overall: ' + se.mostPf.team.name + ' (' + P(se.mostPf.pf) + ')'] }));
    }
    return deck;
  }

  return { render: render, weeklyDeck: weeklyDeck, seasonDeck: seasonDeck, W: W, H: H, SITE: SITE, THEMES: THEMES };
});
