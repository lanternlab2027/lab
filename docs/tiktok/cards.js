/* TikTok Wrapped: 1080x1920 card renderer (canvas). Same engine as docs/netflix/cards.js with our own
 * "after dark" palette (forest, lime, amber, coral, indigo, cream). No platform logos or brand colors. */
(function (root) {
  'use strict';

  var W = 1080, H = 1920, M = 112, CW = W - 2 * M;
  var DISPLAY = '"Avenir Next Condensed", "Arial Narrow", "Roboto Condensed", "DejaVu Sans Condensed", "Helvetica Neue", Inter, Arial, sans-serif';
  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';
  var SERIF = 'Georgia, "Iowan Old Style", Cambria, Caladea, "DejaVu Serif", serif';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var SITE = 'lanternlab2027.github.io/lab/tiktok';

  var T = {
    forest: { bg: ['#14352d', '#071715'], ink: '#eef5ea', accent: '#d7f26b', soft: '#7cc6a4', dark: true },
    lime:   { bg: ['#e6f58a', '#c3e052'], ink: '#18220b', accent: '#3a2c8c', soft: '#6f8420', dark: false },
    dusk:   { bg: ['#25224f', '#0e0c24'], ink: '#f6f1e7', accent: '#ffb547', soft: '#a8b8ff', dark: true },
    coral:  { bg: ['#ffa27f', '#f0704b'], ink: '#24100a', accent: '#fff3d6', soft: '#8a2f16', dark: false },
    cream:  { bg: ['#f7f0e2', '#e9dcc1'], ink: '#1f1b14', accent: '#4a36c4', soft: '#d9733d', dark: false },
    ink:    { bg: ['#1e1d24', '#0b0b0e'], ink: '#efe9dc', accent: '#ffb547', soft: '#9fe0b8', dark: true }
  };

  function F(kind, weight, size, italic) { return (italic ? 'italic ' : '') + weight + ' ' + size + 'px ' + (kind === 'display' ? DISPLAY : kind === 'serif' ? SERIF : SANS); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, ''); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pick(arr, key) { return arr[hash(key) % arr.length]; }
  function rngFrom(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function spacing(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }
  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }
  function dayDate(day) { var d = new Date(day * 86400000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: (d.getUTCDay() + 6) % 7 }; }
  function shortDate(day, withYear) { var d = dayDate(day); return MONTHS[d.mo - 1] + ' ' + d.d + (withYear ? ', ' + d.y : ''); }
  function hourName(h) { return h === 0 ? 'midnight' : h === 12 ? 'noon' : (h % 12) + (h < 12 ? 'am' : 'pm'); }
  function hourShort(h) { return h === 0 ? '12a' : h === 12 ? '12p' : (h % 12) + (h < 12 ? 'a' : 'p'); }
  function clock(h, mi) { return (h % 12 === 0 ? 12 : h % 12) + ':' + (mi < 10 ? '0' : '') + mi + (h < 12 ? 'am' : 'pm'); }
  function duration(min) { if (min < 60) return fmt(min) + ' min'; var h = Math.floor(min / 60), m = min % 60; return h + 'h' + (m ? ' ' + (m < 10 ? '0' : '') + m + 'm' : ''); }

  function light(hex) { var v = [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16); }); return 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2] > 150; }
  function hrs(min) { return min < 60 ? fmt(min) + ' ' + plural(Math.round(min), 'minute') : fmt(min / 60) + ' ' + plural(Math.round(min / 60), 'hour'); }
  function hrsShort(min) { return min < 60 ? '\u2248' + fmt(min) + 'm' : '\u2248' + fmt(min / 60) + 'h'; }

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

  // Shrinks until the un-ellipsized lines fit (measuring ellipsized lines would stop shrinking too early).
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

  // Wrapped text block; returns the baseline of the last line.
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
    return block(ctx, th, str, y, { kind: 'serif', weight: 400, italic: true, max: o.max || 46, min: 32, lines: o.lines || 2, alpha: 0.88, align: o.align, width: o.width });
  }

  // ---------- frame ----------
  function background(ctx, th, seedKey) {
    var g = ctx.createLinearGradient(0, 0, W * 0.35, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var r = rngFrom(hash(seedKey));
    // a faint "feed": a tilted column of rounded tiles drifting up the right edge
    ctx.save();
    ctx.translate(W - 120, 0); ctx.rotate(0.12);
    ctx.fillStyle = th.dark ? '#ffffff' : '#000000';
    var y0 = -200 - r() * 300;
    for (var k = 0; k < 9; k++) { ctx.globalAlpha = th.dark ? 0.035 : 0.05; rr(ctx, -60, y0 + k * 330, 230, 300, 30); ctx.fill(); }
    ctx.restore();
    // glow
    var gl = ctx.createRadialGradient(W * 0.1, H * 0.12, 10, W * 0.1, H * 0.12, 900);
    gl.addColorStop(0, th.dark ? 'rgba(255,240,205,0.10)' : 'rgba(255,255,255,0.35)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    // grain (light, so PNGs stay small)
    ctx.save();
    ctx.fillStyle = th.dark ? '#ffffff' : '#3b2a12';
    for (var i = 0; i < 2200; i++) { ctx.globalAlpha = 0.03 + r() * 0.045; ctx.fillRect(r() * W, r() * H, 2, 2); }
    ctx.restore();
  }

  function chrome(ctx, th, info, idx, total) {
    ctx.save();
    // mark: three stacked bars (a feed), not a platform logo
    ctx.fillStyle = th.accent;
    rr(ctx, M, 104, 30, 10, 4); ctx.fill(); rr(ctx, M, 120, 30, 10, 4); ctx.fill(); rr(ctx, M, 136, 30, 10, 4); ctx.fill();
    ctx.fillStyle = th.ink; ctx.font = F('sans', 800, 26, false); spacing(ctx, 7); ctx.globalAlpha = 0.9;
    ctx.fillText('SCROLL WRAPPED', M + 48, 139);
    spacing(ctx, 0);
    ctx.font = F('display', 800, 38, false);
    var p = info.periodShort, pw = ctx.measureText(p).width + 56, px = W - M - pw;
    ctx.globalAlpha = 1; ctx.fillStyle = th.accent; rr(ctx, px, 96, pw, 62, 31); ctx.fill();
    ctx.fillStyle = light(th.accent) ? '#14110b' : '#fff7e6'; ctx.textAlign = 'center'; ctx.fillText(p, px + pw / 2, 141);
    ctx.textAlign = 'left'; ctx.fillStyle = th.ink; ctx.globalAlpha = 0.95;
    ctx.font = F('display', 800, 38, false);
    ctx.fillText(ellipsize(ctx, info.title, 640), M, H - 128);
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
    ctx.fillStyle = th.accent; rr(ctx, M, y - 16, 56, 12, 6); ctx.fill();
    ctx.fillStyle = th.ink; ctx.font = F('sans', 800, 32, false); spacing(ctx, 6);
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

  function rule(ctx, th, y, alpha) {
    ctx.save(); ctx.strokeStyle = th.ink; ctx.globalAlpha = alpha || 0.3; ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); ctx.restore();
  }

  function chip(ctx, th, x, y, w, h, value, label) {
    ctx.save();
    rr(ctx, x, y, w, h, 26);
    ctx.fillStyle = th.ink; ctx.globalAlpha = th.dark ? 0.09 : 0.08; ctx.fill();
    ctx.globalAlpha = 0.3; ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = th.ink;
    var vs = fitSize(ctx, value, 'display', 800, 80, 40, w - 52, false);
    var base = y + 28 + vs * 0.8;
    ctx.fillText(value, x + 26, base);
    ctx.font = F('sans', 700, 26, false); ctx.globalAlpha = 0.8;
    wrap(ctx, label, w - 52, 2).forEach(function (l, i) { ctx.fillText(l, x + 26, base + 44 + i * 32); });
    ctx.restore();
  }

  function chipRow(ctx, th, y, items, h) {
    var gap = 22, n = items.length, w = (CW - gap * (n - 1)) / n;
    items.forEach(function (it, i) { chip(ctx, th, M + i * (w + gap), y, w, h || 200, it[0], it[1]); });
  }

  function bars(ctx, th, x, top, w, h, vals, labels, highlight, o) {
    o = o || {};
    var n = vals.length, bw = w / n, mx = Math.max.apply(null, vals) || 1;
    ctx.save();
    vals.forEach(function (v, i) {
      var bh = v ? Math.max(10, (h - (o.values === false ? 8 : 56)) * v / mx) : 6;
      var bx = x + i * bw + bw * (o.gap || 0.13), bwid = bw * (1 - 2 * (o.gap || 0.13));
      var hi = highlight.indexOf(i) >= 0;
      rr(ctx, bx, top + h - bh, bwid, bh, Math.min(10, bwid / 2));
      ctx.fillStyle = hi ? th.accent : th.soft; ctx.globalAlpha = hi ? 1 : 0.6; ctx.fill();
      ctx.globalAlpha = 1;
      if (v && o.values !== false) { ctx.font = F('display', 800, o.valueSize || 32, false); ctx.fillStyle = th.ink; ctx.textAlign = 'center'; ctx.fillText(o.valueFmt ? o.valueFmt(v) : fmt(v), bx + bwid / 2, top + h - bh - 14); }
      if (labels[i]) { ctx.font = F('sans', 800, o.labelSize || 28, false); ctx.fillStyle = th.ink; ctx.globalAlpha = hi ? 1 : 0.7; ctx.textAlign = 'center'; ctx.fillText(labels[i], bx + bwid / 2, top + h + 44); }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    ctx.save(); ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, top + h + 2); ctx.lineTo(x + w, top + h + 2); ctx.stroke(); ctx.restore();
  }

  function short(v) { return v >= 10000 ? fmt1(v / 1000) + 'k' : v >= 1000 ? fmt1(v / 1000) + 'k' : fmt(v); }

  function tieWords(idx, names) {
    var ns = idx.map(function (i) { return names[i]; });
    return ns.length === 2 ? ns.join(' and ') : ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1];
  }

  function persona(s) {
    var sc = {
      owl: s.nightShare / 0.18,
      marathon: s.session && s.session.n >= 5 ? s.session.minutes / 75 : 0,
      regular: s.streak.len / 45 + (s.spanDays ? (s.watchDays / s.spanDays) * 0.4 : 0),
      hearts: s.hasLikes ? s.likeRate / 0.15 : 0,
      lurker: s.hasLikes && s.count >= 200 ? (0.02 / Math.max(0.002, s.likeRate)) * 0.9 : 0,
      weekend: (s.weekdays[5] + s.weekdays[6]) / s.count / 0.42
    };
    var P = {
      owl: ['The Night Owl', 'The feed is quieter after midnight. You\u2019d know.'],
      marathon: ['The Marathon Scroller', 'You don\u2019t dip in. You go all the way down.'],
      regular: ['The Daily Regular', 'Rain or shine, you checked in. Every. Single. Day.'],
      hearts: ['The Generous Liker', 'If it made you smile, it got a like. Creators love you.'],
      lurker: ['The Quiet Watcher', 'You see everything and like almost nothing. Mysterious.'],
      weekend: ['The Weekend Scroller', 'Weekdays are busy. Weekends belong to the feed.'],
      casual: ['The Casual Scroller', 'A little here, a little there. You keep it chill.']
    };
    var best = 'casual', v = 1;
    Object.keys(sc).forEach(function (k) { if (sc[k] > v) { v = sc[k]; best = k; } });
    return { name: P[best][0], line: P[best][1], id: best };
  }

  // ---------- cards ----------
  function build(stats, info) {
    var s = stats, Y = info.year, key = (info.title || '') + (Y || 'all');
    var cards = [];
    function add(id, label, theme, draw) { cards.push({ id: id, label: label, theme: theme, draw: draw }); }

    add('videos', 'Videos watched', 'forest', function (ctx, th) {
      kicker(ctx, th, Y ? 'YOUR ' + Y + ' OF SCROLLING' : 'ALL YOUR SCROLLING', 300);
      bigNumber(ctx, th, fmt(s.count), 640, 380);
      txt(ctx, th, plural(s.count, 'video') + ' watched', M, 750, 'display', 800, 84, { width: CW });
      var sub;
      if (s.prevCount) {
        var d = s.count - s.prevCount;
        sub = d > 0 ? fmt(d) + ' more than ' + (Y - 1) + '. The feed noticed.' : d < 0 ? fmt(-d) + ' fewer than ' + (Y - 1) + '. Touching grass, maybe?' : 'Exactly as many as ' + (Y - 1) + '. Remarkable.';
      } else sub = 'That\u2019s ' + fmt(s.perWatchDay) + ' a day, on days you opened the app.';
      quip(ctx, th, sub, 830, { lines: 1 });
      // month x day heat grid: one square per day
      var top = 930, cell = Math.floor((CW - 70) / 31), rowH = 40, gx = M + 70;
      var mx = 0; Object.keys(s.perDayCount).forEach(function (k) { mx = Math.max(mx, s.perDayCount[k]); });
      ctx.save();
      var yearShown = Y || dayDate(s.lastDay).y;
      for (var m = 0; m < 12; m++) {
        var yy = top + m * rowH;
        ctx.font = F('sans', 800, 22, false); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.65; ctx.fillText(MONTHS[m].toUpperCase(), M, yy + rowH * 0.62);
        var dim = new Date(Date.UTC(yearShown, m + 1, 0)).getUTCDate();
        for (var dd = 0; dd < dim; dd++) {
          var dn = Math.floor(Date.UTC(yearShown, m, dd + 1) / 86400000), c = s.perDayCount[dn] || 0;
          rr(ctx, gx + dd * cell, yy, cell - 4, rowH - 6, 4);
          if (c) { ctx.fillStyle = th.accent; ctx.globalAlpha = 0.22 + 0.78 * Math.sqrt(c / mx); }
          else { ctx.fillStyle = th.ink; ctx.globalAlpha = 0.08; }
          ctx.fill();
        }
      }
      ctx.restore();
      txt(ctx, th, 'One square per day' + (Y ? '' : ' of ' + yearShown) + '. Brighter = more videos.', M, top + 12 * rowH + 34, 'sans', 600, 24, { alpha: 0.6 });
      chipRow(ctx, th, 1500, [[fmt(s.watchDays), plural(s.watchDays, 'day') + ' you scrolled'], [fmt(s.perWatchDay), 'videos on a typical day'], [hrsShort(s.minutesEst), 'on the feed (estimate)']], 196);
    });

    add('time', 'Time estimate', 'coral', function (ctx, th) {
      kicker(ctx, th, 'TIME ON THE FEED (ESTIMATED)', 300);
      var bn = bigNumber(ctx, th, '\u2248' + fmt(s.minutesEst), 640, 330, { color: th.ink });
      txt(ctx, th, 'minutes', M, 740, 'display', 800, 84);
      var days = s.minutesEst / 1440;
      var yh = quip(ctx, th, 'About ' + hrs(s.minutesEst) + (days >= 1 ? ', or ' + fmt1(days) + ' full ' + plural(Math.round(days * 10) / 10, 'day') : '') + '.', 830, { max: 50 });
      // the assumption, spelled out
      var by = yh + 70, bh = 300;
      ctx.save(); rr(ctx, M, by, CW, bh, 30); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.1; ctx.fill(); ctx.globalAlpha = 0.45; ctx.strokeStyle = th.ink; ctx.lineWidth = 3; ctx.setLineDash([12, 10]); ctx.stroke(); ctx.restore();
      txt(ctx, th, 'HOW WE ESTIMATED IT', M + 40, by + 66, 'sans', 800, 28, { spacing: 4, alpha: 0.75 });
      var eq = fmt(s.count) + ' ' + plural(s.count, 'video') + ' \u00d7 ' + s.avgSeconds + ' sec';
      txt(ctx, th, eq, M + 40, by + 150, 'display', 800, fitSize(ctx, eq, 'display', 800, 64, 40, CW - 80, false));
      block(ctx, th, 'Your export has no watch times, so we assume ' + s.avgSeconds + ' seconds a video. Some you skipped in two; some you watched three times.', by + 210, { kind: 'sans', weight: 600, max: 28, min: 24, lines: 2, width: CW - 80, x: M + 40, alpha: 0.85, lh: 1.25 });
      var cy = by + bh + 70;
      var perDay = s.minutesEst / Math.max(1, s.spanDays);
      chipRow(ctx, th, cy, [[perDay >= 1 ? fmt(perDay) + ' min' : '<1 min', 'a day, averaged over ' + (Y ? 'the year so far' : 'every day')], s.minutesEst >= 110 ? [fmt(s.minutesEst / 110), 'feature films\u2019 worth (110 min each)'] : [fmt(s.watchDays), plural(s.watchDays, 'day') + ' you opened the app']], 200);
      if (s.medianGapSec != null && cy + 300 < 1740) block(ctx, th, 'For scale: in a scrolling session, the typical gap between two videos was ' + s.medianGapSec + ' seconds.', cy + 290, { kind: 'sans', weight: 700, max: 30, min: 26, lines: 2, alpha: 0.8, lh: 1.3 });
    });

    add('busiest', 'Busiest day', 'dusk', function (ctx, th) {
      var b = s.busiest, dd = dayDate(b.day);
      kicker(ctx, th, 'YOUR BUSIEST DAY', 300);
      block(ctx, th, DAYS[dd.wd] + ', ' + MONTHS_LONG[dd.mo - 1] + ' ' + dd.d + (Y ? '' : ', ' + dd.y), 420, { max: 84, min: 54, lines: 1 });
      var bn = bigNumber(ctx, th, fmt(b.count), 700, 280, { width: 520 });
      txt(ctx, th, plural(b.count, 'video'), M + bn.width + 28, 600, 'display', 800, 72);
      txt(ctx, th, 'in one day', M + bn.width + 28, 676, 'display', 800, 72, { alpha: 0.75 });
      quip(ctx, th, '\u2248' + hrs(b.minutesEst) + ', spread across ' + b.hours + ' different ' + plural(b.hours, 'hour') + '.', 790, { max: 46 });
      txt(ctx, th, 'VIDEOS BY HOUR THAT DAY', M, 930, 'sans', 800, 26, { spacing: 4, alpha: 0.7 });
      var pk = b.hourly.indexOf(Math.max.apply(null, b.hourly));
      bars(ctx, th, M, 960, CW, 360, b.hourly, b.hourly.map(function (v, i) { return i % 6 === 0 ? hourShort(i) : ''; }), [pk], { values: false, gap: 0.08, labelSize: 24 });
      txt(ctx, th, 'Busiest hour: ' + hourName(pk) + ' (' + fmt(b.hourly[pk]) + ' ' + plural(b.hourly[pk], 'video') + ')', M, 1420, 'sans', 700, 32, { width: CW });
      chipRow(ctx, th, 1480, [[clock(b.first.h, b.first.mi), 'first video that day'], [clock(b.last.h, b.last.mi), 'last video that day'], [fmt1(b.count / s.perWatchDay) + '\u00d7', 'your typical day']], 200);
    });

    add('clock', 'Scroll clock', 'ink', function (ctx, th) {
      kicker(ctx, th, 'YOUR SCROLL CLOCK', 300);
      var pct = Math.round(s.nightShare * 100);
      var head = pct >= 20 ? 'A certified night owl' : pct >= 8 ? 'A little after-hours scrolling' : s.peakHour < 12 ? 'An early-bird scroller' : 'Mostly a daytime scroller';
      var yh = block(ctx, th, head, 420, { max: 88, min: 56, lines: 2 });
      // 24-hour radial chart
      var cx = W / 2, cy = yh + 430, r0 = 120, r1 = 340, mx = Math.max.apply(null, s.hours) || 1;
      ctx.save();
      // night wedge
      var a = function (h) { return -Math.PI / 2 + h / 24 * Math.PI * 2; };
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r1 + 30, a(0), a(5)); ctx.closePath(); ctx.fillStyle = th.soft; ctx.globalAlpha = 0.12; ctx.fill();
      ctx.globalAlpha = 0.25; ctx.strokeStyle = th.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r1, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r0, 0, Math.PI * 2); ctx.stroke();
      for (var h = 0; h < 24; h++) {
        var v = s.hours[h], len = v ? 14 + (r1 - r0 - 14) * v / mx : 4;
        var a0 = a(h) + 0.03, a1 = a(h + 1) - 0.03;
        ctx.beginPath(); ctx.arc(cx, cy, r0 + len, a0, a1); ctx.arc(cx, cy, r0, a1, a0, true); ctx.closePath();
        ctx.globalAlpha = h === s.peakHour ? 1 : (h < 5 ? 0.95 : 0.55);
        ctx.fillStyle = h === s.peakHour ? th.accent : h < 5 ? th.soft : th.ink; ctx.fill();
      }
      ctx.globalAlpha = 0.85; ctx.fillStyle = th.ink; ctx.textAlign = 'center'; ctx.font = F('sans', 800, 26, false);
      [0, 6, 12, 18].forEach(function (hh) { var aa = a(hh); ctx.fillText(hh === 0 ? '12am' : hh === 12 ? '12pm' : hourShort(hh) + 'm', cx + Math.cos(aa) * (r1 + 56), cy + Math.sin(aa) * (r1 + 56) + 9); });
      ctx.restore();
      txt(ctx, th, pct + '%', cx, cy + 20, 'display', 800, 96, { align: 'center', color: th.soft });
      txt(ctx, th, 'after midnight', cx, cy + 62, 'sans', 700, 24, { align: 'center', alpha: 0.75 });
      var ly = cy + r1 + 130;
      block(ctx, th, pct + '% of your videos were watched between midnight and 5am. Your peak hour was ' + hourName(s.peakHour) + '.', ly, { kind: 'sans', weight: 700, max: 34, min: 26, lines: 2, lh: 1.3 });
      if (s.latest) txt(ctx, th, 'Latest night: still scrolling at ' + clock(s.latest.h, s.latest.mi) + ' on ' + shortDate(s.latest.day, !Y) + '.', M, ly + 120, 'serif', 400, 36, { italic: true, alpha: 0.85, width: CW });
      txt(ctx, th, 'Times shown in ' + (info.tzLabel || s.tz) + '.', M, 1745, 'sans', 600, 24, { alpha: 0.55, width: CW });
    });

    add('month', 'Peak month', 'lime', function (ctx, th) {
      kicker(ctx, th, 'THE MONTH THAT PEAKED', 300);
      var vals, labels, head, peaks;
      if (Y) {
        vals = s.months; labels = MONTHS.map(function (m) { return m.charAt(0); });
        peaks = vals.map(function (v, i) { return v === vals[s.peakMonth] ? i : -1; }).filter(function (i) { return i >= 0; });
        head = peaks.length === 1 ? MONTHS_LONG[peaks[0]] + ' was your peak' : tieWords(peaks.slice(0, 3), MONTHS_LONG) + ' tied for first';
      } else {
        var ys = Object.keys(s.byYear).map(Number).sort(function (a, b) { return a - b; }).slice(-12);
        vals = ys.map(function (y) { return s.byYear[y]; }); labels = ys.map(function (y) { return '\u2019' + String(y).slice(2); });
        var mxv = Math.max.apply(null, vals);
        peaks = vals.map(function (v, i) { return v === mxv ? i : -1; }).filter(function (i) { return i >= 0; });
        head = ys[peaks[0]] + ' was your biggest year';
      }
      var yh = block(ctx, th, head, 430, { max: 96, min: 56, lines: 2 });
      var pv = vals[peaks[0]];
      txt(ctx, th, fmt(pv) + ' ' + plural(pv, 'video') + (peaks.length > 1 ? ' each' : '') + ', about ' + hrs(pv * s.avgSeconds / 60) + '.', M, yh + 70, 'serif', 400, 44, { italic: true, alpha: 0.85, width: CW });
      var ctop = yh + 130;
      bars(ctx, th, M, ctop, CW, 460, vals, labels, peaks, { valueSize: 28, valueFmt: short });
      var wy = ctop + 600;
      var wpk = s.weekdays.map(function (v, i) { return v === s.weekdays[s.peakWeekday] ? i : -1; }).filter(function (i) { return i >= 0; });
      var whead = wpk.length === 1 ? DAYS[wpk[0]] + 's hit hardest' : tieWords(wpk, DAYS.map(function (d) { return d + 's'; })) + ', equally';
      block(ctx, th, whead, wy, { max: 60, min: 44, lines: 1, color: th.accent });
      bars(ctx, th, M, wy + 40, CW, 300, s.weekdays, ['M', 'T', 'W', 'T', 'F', 'S', 'S'], wpk, { valueSize: 28, valueFmt: short });
    });

    if (s.session && s.session.n >= 5) add('session', 'Doomscroll session', 'dusk', function (ctx, th) {
      var se = s.session;
      kicker(ctx, th, 'YOUR LONGEST DOOMSCROLL', 300);
      var bn = bigNumber(ctx, th, duration(se.minutes), 600, 280, { width: CW });
      txt(ctx, th, 'without putting it down', M, 700, 'display', 800, fitSize(ctx, 'without putting it down', 'display', 800, 72, 48, CW, false));
      var sd = se.startP, ed = se.endP;
      quip(ctx, th, DAYS[sd.wd] + ', ' + MONTHS_LONG[sd.mo - 1] + ' ' + sd.d + (Y ? '' : ', ' + sd.y) + ', ' + clock(sd.h, sd.mi) + ' to ' + clock(ed.h, ed.mi) + (ed.day !== sd.day ? ' (next day)' : '') + '.', 790, { max: 44 });
      // the session as a strip of ticks, one per video
      var top = 900, hgt = 260;
      ctx.save();
      rr(ctx, M, top, CW, hgt, 30); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.07; ctx.fill();
      var rnd = rngFrom(hash(key + 'sess')), n = Math.min(se.n, 400);
      for (var i = 0; i < n; i++) {
        var x = M + 24 + (CW - 48) * (n === 1 ? 0.5 : i / (n - 1));
        ctx.globalAlpha = 0.5 + rnd() * 0.5; ctx.fillStyle = i % 9 === 0 ? th.accent : th.soft;
        var hh = 80 + rnd() * 140; ctx.fillRect(x - 1.5, top + (hgt - hh) / 2, 3, hh);
      }
      ctx.restore();
      txt(ctx, th, clock(sd.h, sd.mi), M, top + hgt + 48, 'sans', 800, 28, { alpha: 0.8 });
      txt(ctx, th, clock(ed.h, ed.mi), W - M, top + hgt + 48, 'sans', 800, 28, { alpha: 0.8, align: 'right' });
      txt(ctx, th, se.n > n ? 'one tick per video (first 400)' : 'one tick per video', W / 2, top + hgt + 48, 'sans', 600, 24, { alpha: 0.6, align: 'center' });
      chipRow(ctx, th, 1300, [[fmt(se.n), plural(se.n, 'video') + ' in a row'], [fmt1(se.dur / 1000 / Math.max(1, se.n - 1)) + 's', 'between videos, on average']], 200);
      quip(ctx, th, pick(['\u201cJust one more\u201d said ' + fmt(se.n) + ' times.', 'Somewhere in there, your thumb clocked overtime.', 'The algorithm knew exactly what it was doing.'], key + 's'), 1600, { max: 44 });
      txt(ctx, th, 'A session ends when 2+ minutes pass with no new video.', M, 1745, 'sans', 600, 24, { alpha: 0.55, width: CW });
    });

    if (s.streak && s.streak.len >= 2) add('streak', 'Longest streak', 'forest', function (ctx, th) {
      var st = s.streak;
      kicker(ctx, th, 'YOUR LONGEST STREAK', 300);
      var bn = bigNumber(ctx, th, fmt(st.len), 610, 300, { width: 520 });
      txt(ctx, th, 'days', M + bn.width + 28, 520, 'display', 800, 80);
      txt(ctx, th, 'in a row', M + bn.width + 28, 600, 'display', 800, 80, { alpha: 0.75 });
      var sd = dayDate(st.start), ed = dayDate(st.end);
      txt(ctx, th, shortDate(st.start, sd.y !== ed.y || !Y) + ' \u2013 ' + shortDate(st.end, sd.y !== ed.y || !Y), M, 700, 'serif', 400, 46, { italic: true, alpha: 0.88 });
      var cy0 = 800, calY = ed.y;
      var cols = 4, gx = 26, mw = (CW - gx * (cols - 1)) / cols, cell = Math.floor(mw / 7), gy = 228;
      ctx.save();
      for (var m = 0; m < 12; m++) {
        var ox = M + (m % cols) * (mw + gx), oy = cy0 + Math.floor(m / cols) * gy;
        ctx.font = F('sans', 800, 26, false); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.8; ctx.fillText(MONTHS[m].toUpperCase(), ox, oy);
        var first = Math.round(Date.UTC(calY, m, 1) / 86400000), lead = dayDate(first).wd, dim = new Date(Date.UTC(calY, m + 1, 0)).getUTCDate();
        for (var d = 0; d < dim; d++) {
          var slot = lead + d, x = ox + (slot % 7) * cell, y = oy + 18 + Math.floor(slot / 7) * cell, dn = first + d;
          rr(ctx, x, y, cell - 4, cell - 4, 4);
          if (dn >= st.start && dn <= st.end) { ctx.fillStyle = th.accent; ctx.globalAlpha = 1; }
          else if (s.perDayCount[dn]) { ctx.fillStyle = th.soft; ctx.globalAlpha = 0.55; }
          else { ctx.fillStyle = th.ink; ctx.globalAlpha = 0.1; }
          ctx.fill();
        }
      }
      ctx.restore();
      var ly = cy0 + 2 * gy + 18 + 6 * cell + 50;
      if (!Y) txt(ctx, th, 'Calendar: ' + calY, W - M, cy0 - 64, 'sans', 700, 26, { align: 'right', alpha: 0.7 });
      ctx.save(); ctx.font = F('sans', 700, 26, false);
      [[th.accent, 1, 'the streak'], [th.soft, 0.55, 'other days you scrolled']].forEach(function (l, i) {
        var lx = M + i * 300; ctx.fillStyle = l[0]; ctx.globalAlpha = l[1]; rr(ctx, lx, ly - 22, 26, 26, 4); ctx.fill();
        ctx.globalAlpha = 0.85; ctx.fillStyle = th.ink; ctx.fillText(l[2], lx + 40, ly);
      });
      ctx.restore();
      chipRow(ctx, th, 1530, [[fmt(s.watchDays), plural(s.watchDays, 'day') + ' with at least one video'], [Math.round(s.watchDays / s.spanDays * 100) + '%', 'of days ' + (Y ? 'so far this year' : 'since your first video')]], 190);
    });

    if (s.hasLikes) add('likes', 'Likes', 'cream', function (ctx, th) {
      kicker(ctx, th, 'LIKES', 300);
      var bn = bigNumber(ctx, th, fmt(s.likes), 620, 330, { width: 640 });
      txt(ctx, th, plural(s.likes, 'like'), M + bn.width + 28, 620, 'display', 800, 80);
      var per = s.likes ? Math.round(s.count / s.likes) : 0;
      var rate = s.likeRate * 100, rateTxt = rate >= 10 ? Math.round(rate) + '%' : fmt1(rate) + '%';
      var head = !s.likes ? 'Not a single like. Untouchable.' : per <= 1 ? 'You liked basically everything.' : 'One like for every ' + fmt(per) + ' videos';
      var yh = block(ctx, th, head, 760, { max: 70, min: 46, lines: 2, color: th.accent });
      // waffle: 100 squares, liked share filled
      var top = yh + 80, cell = Math.floor(CW / 10), filled = Math.min(100, Math.round(rate));
      if (rate > 0 && filled === 0) filled = 1;
      ctx.save();
      for (var i = 0; i < 100; i++) {
        var x = M + (i % 10) * cell, y = top + Math.floor(i / 10) * cell * 0.62;
        rr(ctx, x, y, cell - 10, cell * 0.62 - 10, 8);
        if (i < filled) { ctx.fillStyle = th.accent; ctx.globalAlpha = 1; } else { ctx.fillStyle = th.ink; ctx.globalAlpha = 0.1; }
        ctx.fill();
      }
      ctx.restore();
      var wy = top + 10 * cell * 0.62 + 40;
      txt(ctx, th, 'Like rate: ' + rateTxt + ' of the ' + fmt(s.count) + ' videos you watched' + (Y ? ' in ' + Y : '') + '.', M, wy, 'sans', 700, 30, { alpha: 0.85, width: CW });
      var chips = [];
      if (s.hasComments) chips.push([fmt(s.comments), plural(s.comments, 'comment') + ' left']);
      if (s.hasShares) chips.push([fmt(s.shares), plural(s.shares, 'video') + ' shared']);
      if (s.hasLikes && s.likes) { var lmk = s.likeMonths.indexOf(Math.max.apply(null, s.likeMonths)); if (Y) chips.push([MONTHS[lmk], 'most likes']); }
      if (chips.length) chipRow(ctx, th, Math.max(wy + 60, 1480), chips.slice(0, 3), 200);
      if (chips.length < 2) quip(ctx, th, rate >= 12 ? 'Generous with the double-tap.' : 'Selective. A like from you means something.', 1720, { max: 40, lines: 1 });
    });

    if (s.hasSearches && s.searches) add('searches', 'Top searches', 'coral', function (ctx, th) {
      kicker(ctx, th, 'WHAT YOU SEARCHED FOR', 300);
      var yh = block(ctx, th, fmt(s.searches) + ' ' + plural(s.searches, 'search', 'searches') + ', ' + fmt(s.distinctTerms) + ' different ' + plural(s.distinctTerms, 'one'), 430, { max: 84, min: 54, lines: 2 });
      var top = s.topTerms, y = yh + 130, mx = top.length ? top[0].count : 1;
      if (!info.showTerms) {
        top.forEach(function (t, i) {
          var yy = y + i * 190;
          txt(ctx, th, String(i + 1), M, yy + 60, 'display', 800, 120, { alpha: i === 0 ? 1 : 0.5 });
          ctx.save(); rr(ctx, M + 120, yy - 10, (CW - 120) * (0.55 + 0.45 * t.count / mx), 64, 32); ctx.fillStyle = th.ink; ctx.globalAlpha = 0.18; ctx.fill(); ctx.restore();
          txt(ctx, th, fmt(t.count) + '\u00d7', M + 150, yy + 34, 'sans', 800, 30, { alpha: 0.85 });
        });
        quip(ctx, th, 'Search terms stay private unless you choose to show them.', Math.min(y + top.length * 190 + 40, 1640), { max: 40 });
        return;
      }
      top.forEach(function (t, i) {
        var yy = y + i * 190;
        txt(ctx, th, String(i + 1), M, yy + 60, 'display', 800, 120, { color: i === 0 ? th.accent : th.ink, alpha: i === 0 ? 1 : 0.5 });
        var tx = M + 120;
        block(ctx, th, '\u201c' + t.term + '\u201d', yy + 20, { max: 58, min: 38, lines: 1, x: tx, width: CW - 120 });
        ctx.save(); rr(ctx, tx, yy + 50, Math.max(30, (CW - 120 - 160) * t.count / mx), 26, 13); ctx.fillStyle = i === 0 ? th.accent : th.soft; ctx.globalAlpha = 0.85; ctx.fill(); ctx.restore();
        txt(ctx, th, fmt(t.count) + '\u00d7', W - M, yy + 72, 'sans', 800, 30, { align: 'right', alpha: 0.9 });
      });
      if (top.length) quip(ctx, th, pick(['Your search bar, unfiltered.', 'The algorithm took notes.', 'Some of these were research. Allegedly.'], key + 'q'), Math.min(y + top.length * 190 + 40, 1700), { max: 42, lines: 1 });
    });

    add('summary', 'Your year in the feed', 'lime', function (ctx, th) {
      var p = persona(s);
      kicker(ctx, th, Y ? 'YOUR ' + Y + ' IN THE FEED' : 'YOUR TIME IN THE FEED', 300);
      // stacked-feed emblem
      ctx.save(); ctx.translate(W / 2, 470);
      [[-70, -0.16, 0.35], [70, 0.16, 0.35], [0, 0, 1]].forEach(function (c) { ctx.save(); ctx.translate(c[0], 0); ctx.rotate(c[1]); ctx.globalAlpha = c[2]; ctx.fillStyle = c[2] === 1 ? th.accent : th.ink; rr(ctx, -70, -110, 140, 220, 24); ctx.fill(); ctx.restore(); });
      ctx.fillStyle = th.bg[0]; ctx.beginPath(); ctx.moveTo(-18, -30); ctx.lineTo(28, 0); ctx.lineTo(-18, 30); ctx.closePath(); ctx.fill();
      ctx.restore();
      var yn = block(ctx, th, p.name, 720, { max: 120, min: 70, lines: 2, align: 'center', lh: 1.0, color: th.accent });
      var yl = quip(ctx, th, p.line, yn + 90, { max: 46, lines: 2, align: 'center' });
      var gy = Math.max(yl + 90, 1050), gw = (CW - 22) / 2, gh = 180;
      var tiles = [[fmt(s.count), 'videos watched'], [hrsShort(s.minutesEst), 'on the feed (estimate)'], [fmt(s.busiest.count), 'on your busiest day'], [Math.round(s.nightShare * 100) + '%', 'after midnight']];
      tiles.push(s.session && s.session.n >= 5 ? [duration(s.session.minutes), 'longest session'] : [fmt(s.watchDays), 'days scrolled']);
      tiles.push(s.hasLikes ? [fmt(s.likes), plural(s.likes, 'like')] : [fmt(s.streak.len), 'day streak']);
      tiles.forEach(function (t, i) { chip(ctx, th, M + (i % 2) * (gw + 22), gy + Math.floor(i / 2) * (gh + 20), gw, gh, t[0], t[1]); });
    });

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

  var api = { build: build, render: render, persona: persona, W: W, H: H, THEMES: T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TikTokCards = api;
})(typeof self !== 'undefined' ? self : this);
