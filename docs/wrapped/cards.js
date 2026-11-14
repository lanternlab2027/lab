/* Group Chat Wrapped: 1080x1920 card renderer (canvas). */
(function (root) {
  'use strict';

  var W = 1080, H = 1920, M = 88;
  var STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  var EMOJI_STACK = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SITE = 'lanternlab2027.github.io/lab/wrapped';

  var THEMES = {
    intro:   { bg: ['#ff3d77', '#7a2cf5', '#1d0b57'], ink: '#ffffff', accent: '#ffe066' },
    yapper:  { bg: ['#ff9f1c', '#ff2e63', '#9b0a7d'], ink: '#ffffff', accent: '#fff3b0' },
    clock:   { bg: ['#05092e', '#1f1d74', '#6a3cf6'], ink: '#ffffff', accent: '#ffd166' },
    emoji:   { bg: ['#fff06a', '#ffc21a', '#ff7a00'], ink: '#2b1400', accent: '#ffffff' },
    fastest: { bg: ['#00d2ff', '#0a7cff', '#2a1fa8'], ink: '#ffffff', accent: '#b9ff66' },
    essay:   { bg: ['#fff4d6', '#ffc39b', '#ff8a7a'], ink: '#3a0d14', accent: '#ff3d5e' },
    laugh:   { bg: ['#ff2a68', '#ff5e3a', '#ff9500'], ink: '#ffffff', accent: '#fff36b' },
    busiest: { bg: ['#12c2e9', '#c471ed', '#f64f59'], ink: '#ffffff', accent: '#fffbe0' },
    words:   { bg: ['#052e22', '#0f6b4b', '#22d38a'], ink: '#ffffff', accent: '#b8ffdc' },
    starter: { bg: ['#b63cff', '#5b10e8', '#170050'], ink: '#ffffff', accent: '#7dfcff' },
    ghost:   { bg: ['#14161d', '#262a36', '#454a5c'], ink: '#ffffff', accent: '#b9c3ff' },
    vibe:    { bg: ['#fc466b', '#8a3dff', '#2f5bfb'], ink: '#ffffff', accent: '#ffe066' }
  };

  function F(weight, size) { return weight + ' ' + size + 'px ' + STACK; }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pick(arr, key) { return arr[hash(key) % arr.length]; }
  function rngFrom(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function spacing(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fitSize(ctx, text, weight, max, min, width) {
    var s = max;
    ctx.font = F(weight, s);
    while (s > min && ctx.measureText(text).width > width) { s -= 4; ctx.font = F(weight, s); }
    return s;
  }

  function ellipsize(ctx, text, width) {
    if (ctx.measureText(text).width <= width) return text;
    var chars = Array.from(text);
    while (chars.length > 1 && ctx.measureText(chars.join('') + '\u2026').width > width) chars.pop();
    return chars.join('').trim() + '\u2026';
  }

  function wrap(ctx, text, width, maxLines) {
    var words = text.split(/\s+/), lines = [], line = '';
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
    return lines;
  }

  function shadow(ctx, on, strength) {
    if (on) { ctx.shadowColor = 'rgba(0,0,0,' + (strength || 0.22) + ')'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8; }
    else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  }

  function background(ctx, theme, seedKey, watermark) {
    var g = ctx.createLinearGradient(0, 0, W * 0.35, H);
    g.addColorStop(0, theme.bg[0]); g.addColorStop(0.55, theme.bg[1]); g.addColorStop(1, theme.bg[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var r = rngFrom(hash(seedKey));
    // soft glows
    for (var i = 0; i < 3; i++) {
      var x = r() * W, y = r() * H, rad = 380 + r() * 420;
      var rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
      rg.addColorStop(0, 'rgba(255,255,255,' + (0.16 + r() * 0.1) + ')');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
    // concentric rings in a corner
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 3;
    var cx = r() < 0.5 ? W + 40 : -40, cy = 260 + r() * 500;
    for (var k = 1; k <= 6; k++) { ctx.beginPath(); ctx.arc(cx, cy, k * 70, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    // big faded emoji watermark
    if (watermark) {
      ctx.save();
      ctx.globalAlpha = 0.13;
      ctx.translate(W - 120, H - 430);
      ctx.rotate(-0.22);
      ctx.font = '640px ' + EMOJI_STACK;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(watermark, 0, 0);
      ctx.restore();
    }
  }

  function chrome(ctx, theme, info, idx, total) {
    ctx.save();
    ctx.fillStyle = theme.ink; ctx.textBaseline = 'alphabetic';
    // brand row
    ctx.font = F(800, 30); spacing(ctx, 6);
    ctx.globalAlpha = 0.9;
    ctx.fillText('GROUP CHAT WRAPPED', M, 128);
    spacing(ctx, 0);
    // period pill
    ctx.font = F(800, 30);
    var p = info.periodShort, pw = ctx.measureText(p).width + 48;
    ctx.globalAlpha = 1;
    rr(ctx, W - M - pw, 88, pw, 56, 28);
    ctx.strokeStyle = theme.ink; ctx.lineWidth = 3; ctx.globalAlpha = 0.85; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.fillText(p, W - M - pw / 2, 128);
    // footer
    ctx.textAlign = 'left'; ctx.globalAlpha = 0.92;
    ctx.font = F(800, 34);
    ctx.fillText(ellipsize(ctx, info.title, 620), M, H - 104);
    // "Make yours" line: the card itself carries the way back to the app.
    ctx.font = F(700, 28); ctx.globalAlpha = 0.9;
    var mk = 'Make yours: ' + SITE;
    ctx.fillText(mk, M, H - 62);
    var mw = ctx.measureText(mk).width;
    ctx.textAlign = 'right'; ctx.font = F(800, 34); ctx.globalAlpha = 0.92;
    ctx.fillText(idx + ' / ' + total, W - M, H - 104);
    ctx.globalAlpha = 0.75;
    // Privacy label: longest version that fits beside the "Make yours" line.
    var opts = [[28, '\u{1F512} made on-device'], [28, '\u{1F512} on-device'], [24, '\u{1F512} on-device']];
    for (var k = 0; k < opts.length; k++) {
      ctx.font = F(600, opts[k][0]);
      if (mw + ctx.measureText(opts[k][1]).width + 24 <= W - 2 * M) { ctx.fillText(opts[k][1], W - M, H - 62); break; }
    }
    ctx.restore();
  }

  function pill(ctx, theme, text, y) {
    ctx.save();
    ctx.font = F(900, 40); spacing(ctx, 5);
    var w = ctx.measureText(text).width + 64;
    rr(ctx, M, y, w, 78, 39);
    ctx.fillStyle = theme.ink; ctx.fill();
    ctx.fillStyle = theme.bg[1]; ctx.textBaseline = 'middle';
    ctx.fillText(text, M + 32, y + 41);
    ctx.restore();
    return y + 78;
  }

  function emojiAt(ctx, e, x, y, size) {
    ctx.save();
    ctx.font = size + 'px ' + EMOJI_STACK;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    shadow(ctx, true, 0.2);
    ctx.fillText(e, x, y);
    ctx.restore();
  }

  function text(ctx, theme, str, x, y, weight, size, opts) {
    opts = opts || {};
    ctx.save();
    ctx.fillStyle = opts.color || theme.ink;
    ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    ctx.font = F(weight, size);
    ctx.textAlign = opts.align || 'left';
    if (opts.spacing) spacing(ctx, opts.spacing);
    if (opts.shadow) shadow(ctx, true);
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function paragraph(ctx, theme, str, y, size, maxLines, alpha) {
    ctx.save();
    ctx.font = F(700, size);
    var lines = wrap(ctx, str, W - 2 * M, maxLines || 3);
    ctx.fillStyle = theme.ink; ctx.globalAlpha = alpha == null ? 0.95 : alpha;
    lines.forEach(function (l, i) { ctx.fillText(l, M, y + i * size * 1.28); });
    ctx.restore();
    return y + lines.length * size * 1.28;
  }

  function bigName(ctx, theme, name, y, max) {
    ctx.save();
    var size = fitSize(ctx, name, 900, max || 150, 64, W - 2 * M);
    if (ctx.measureText(name).width > W - 2 * M) name = ellipsize(ctx, name, W - 2 * M);
    ctx.fillStyle = theme.ink; spacing(ctx, -2); shadow(ctx, true);
    ctx.fillText(name, M - 4, y);
    ctx.restore();
    return size;
  }

  function bigNumber(ctx, theme, num, unit, y) {
    ctx.save();
    var size = fitSize(ctx, num, 900, 300, 120, W - 2 * M);
    ctx.fillStyle = theme.accent; spacing(ctx, -8); shadow(ctx, true, 0.25);
    ctx.fillText(num, M - 10, y);
    ctx.restore();
    ctx.save();
    ctx.font = F(800, 48); ctx.fillStyle = theme.ink;
    var lines = wrap(ctx, unit, W - 2 * M, 2);
    lines.forEach(function (l, i) { ctx.fillText(l, M, y + 78 + i * 60); });
    ctx.restore();
    return y + 78 + (lines.length - 1) * 60;
  }

  // Standard award layout.
  function award(ctx, theme, o) {
    var y = pill(ctx, theme, o.pill, 250);
    emojiAt(ctx, o.emoji, M - 6, y + 250, 200);
    text(ctx, theme, o.kicker, M, y + 360, 700, 50, { alpha: 0.9 });
    bigName(ctx, theme, o.name, y + 510, 150);
    var after = bigNumber(ctx, theme, o.number, o.unit, 1180);
    if (o.extra) o.extra(after + 90);
    else paragraph(ctx, theme, o.copy, Math.max(after + 140, 1470), 50, 4);
  }

  function chip(ctx, theme, x, y, w, h, value, label) {
    ctx.save();
    rr(ctx, x, y, w, h, 36);
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = theme.ink;
    var vs = fitSize(ctx, value, 900, 92, 44, w - 64);
    var base = y + 36 + vs * 0.86;
    ctx.font = F(900, vs); ctx.fillText(value, x + 32, base);
    ctx.font = F(700, 34); ctx.globalAlpha = 0.88;
    wrap(ctx, label, w - 64, 2).forEach(function (l, i) { ctx.fillText(l, x + 32, base + 58 + i * 40); });
    ctx.restore();
  }

  function fmtDuration(sec) {
    if (sec < 60) return ['<1', 'minute median reply time'];
    if (sec < 3600) { var m = Math.round(sec / 60); return [String(m), (m === 1 ? 'minute' : 'minutes') + ' median reply time']; }
    var h = sec / 3600; return [h < 10 ? h.toFixed(1).replace(/\.0$/, '') : String(Math.round(h)), 'hours median reply time'];
  }
  function hourLabel(h) { return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM'); }
  function pct(x) { return Math.round(x * 100) + '%'; }

  // ---------- cards ----------
  function build(stats, info) {
    var name = info.name || function (n) { return n; };
    var A = stats.awards;
    var key = info.title || 'chat';
    var cards = [];
    function add(id, label, emoji, draw) { cards.push({ id: id, label: label, emoji: emoji, draw: draw }); }

    add('intro', 'Your group, wrapped', '\u{1F381}', function (ctx, theme) {
      var y = pill(ctx, theme, info.year ? info.year + ' WRAPPED' : 'ALL-TIME WRAPPED', 250);
      ctx.save();
      var t = info.title || 'Your group';
      ctx.fillStyle = theme.ink; shadow(ctx, true);
      ctx.font = F(900, 128);
      var size = 128, lines;
      while (true) { ctx.font = F(900, size); lines = wrap(ctx, t, W - 2 * M); if ((lines.length <= 3 && lines.every(function (l) { return ctx.measureText(l).width <= W - 2 * M; })) || size <= 70) break; size -= 6; }
      if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] = ellipsize(ctx, lines[2] + ' \u2026', W - 2 * M); }
      spacing(ctx, -3);
      lines.forEach(function (l, i) { ctx.fillText(ellipsize(ctx, l, W - 2 * M), M - 4, y + 170 + i * size * 1.05); });
      ctx.restore();
      var yy = y + 170 + (lines.length - 1) * size * 1.05 + 90;
      paragraph(ctx, theme, info.periodLong, yy, 46, 1, 0.85);
      var gx = M, gw = (W - 2 * M - 32) / 2, gh = 250, gy = 1000;
      chip(ctx, theme, gx, gy, gw, gh, fmt(stats.total), 'messages sent');
      chip(ctx, theme, gx + gw + 32, gy, gw, gh, fmt(stats.memberCount), stats.memberCount === 1 ? 'person talking' : 'people talking');
      chip(ctx, theme, gx, gy + gh + 32, gw, gh, fmt(stats.metrics.activeDays), 'days with messages');
      chip(ctx, theme, gx + gw + 32, gy + gh + 32, gw, gh, fmt(stats.totalEmojis), 'emojis thrown');
      paragraph(ctx, theme, pick(['Swipe through. Someone in here is about to get exposed.', 'The receipts are in. Let\u2019s see who really runs this chat.', 'Every message, every emoji, every 3am rant. Counted.'], key + 'intro'), 1640, 46, 2);
    });

    if (A.yapper) add('yapper', 'Top yapper', '\u{1F5E3}\ufe0f', function (ctx, theme) {
      var p = A.yapper;
      var y = pill(ctx, theme, 'TOP YAPPER', 250);
      emojiAt(ctx, '\u{1F5E3}\ufe0f', M - 6, y + 230, 180);
      text(ctx, theme, 'The loudest voice in the chat', M, y + 330, 700, 50, { alpha: 0.9 });
      bigName(ctx, theme, name(p.name), y + 480, 150);
      var after = bigNumber(ctx, theme, fmt(p.count), 'messages \u00b7 ' + pct(p.share) + ' of the whole chat', 1110);
      // leaderboard
      var top = stats.members.slice(0, 5), maxC = top[0].count;
      var by = after + 90, rowH = 82;
      ctx.save();
      top.forEach(function (m, i) {
        var yy = by + i * rowH;
        var bw = Math.max(30, (W - 2 * M - 230) * m.count / maxC);
        rr(ctx, M + 70, yy, bw, 58, 29);
        ctx.fillStyle = i === 0 ? theme.accent : 'rgba(255,255,255,0.32)'; ctx.fill();
        ctx.fillStyle = theme.ink; ctx.font = F(900, 40);
        ctx.fillText(String(i + 1), M, yy + 44);
        ctx.font = F(800, 34);
        ctx.fillStyle = i === 0 ? theme.bg[2] : theme.ink;
        var label = ellipsize(ctx, name(m.name), Math.max(bw - 40, 300));
        if (ctx.measureText(label).width + 48 > bw) ctx.fillStyle = theme.ink, ctx.fillText(label, M + 70 + bw + 20, yy + 42);
        else ctx.fillText(label, M + 94, yy + 42);
        ctx.fillStyle = theme.ink; ctx.textAlign = 'right'; ctx.font = F(800, 34);
        ctx.fillText(fmt(m.count), W - M, yy + 42); ctx.textAlign = 'left';
      });
      ctx.restore();
    });

    if (A.nightOwl || A.earlyBird) add('clock', 'Night owl & early bird', '\u{1F989}', function (ctx, theme) {
      var y = pill(ctx, theme, 'AROUND THE CLOCK', 250);
      text(ctx, theme, 'When the chat is awake', M, y + 110, 900, 82, { shadow: true });
      text(ctx, theme, 'Busiest hour: ' + hourLabel(stats.metrics.peakHour), M, y + 180, 700, 46, { alpha: 0.88 });
      // 24h chart
      var cx = M, cy = y + 230, cw = W - 2 * M, ch = 330;
      var max = Math.max.apply(null, stats.hours) || 1, bw = cw / 24;
      ctx.save();
      stats.hours.forEach(function (v, h) {
        var bh = Math.max(8, ch * v / max);
        rr(ctx, cx + h * bw + 4, cy + ch - bh, bw - 8, bh, 8);
        var night = h < 5, early = h >= 5 && h < 9;
        ctx.fillStyle = night ? '#9d8cff' : early ? theme.accent : h === stats.metrics.peakHour ? '#ffffff' : 'rgba(255,255,255,0.42)';
        ctx.fill();
      });
      ctx.fillStyle = theme.ink; ctx.globalAlpha = 0.75; ctx.font = F(700, 30);
      [[0, '12a'], [6, '6a'], [12, '12p'], [18, '6p']].forEach(function (t) { ctx.fillText(t[1], cx + t[0] * bw + 2, cy + ch + 46); });
      ctx.restore();
      function block(yy, emoji, title, p, n, desc) {
        emojiAt(ctx, emoji, M - 4, yy + 130, 130);
        text(ctx, theme, title, M + 170, yy + 40, 900, 36, { alpha: 0.85, spacing: 4 });
        ctx.save(); var s = fitSize(ctx, name(p.name), 900, 92, 48, W - 2 * M - 170); ctx.fillStyle = theme.ink; shadow(ctx, true); ctx.fillText(ellipsize(ctx, name(p.name), W - 2 * M - 170), M + 170, yy + 130); ctx.restore();
        text(ctx, theme, desc, M + 170, yy + 190, 700, 38, { alpha: 0.9 });
      }
      var yy = cy + ch + 120;
      if (A.nightOwl) { block(yy, '\u{1F989}', 'NIGHT OWL', A.nightOwl, A.nightOwl.night, fmt(A.nightOwl.night) + ' messages between midnight and 5 AM'); yy += 300; }
      if (A.earlyBird) block(yy, '\u{1F426}', 'EARLY BIRD', A.earlyBird, A.earlyBird.early, fmt(A.earlyBird.early) + ' messages between 5 and 9 AM');
    });

    if (A.emoji) add('emoji', 'Emoji royalty', '\u{1F451}', function (ctx, theme) {
      var p = A.emoji;
      award(ctx, theme, {
        pill: 'EMOJI ROYALTY', emoji: '\u{1F451}', kicker: 'Speaks fluent emoji', name: name(p.name),
        number: fmt(p.emojis), unit: 'emojis sent \u00b7 ' + (p.textCount ? (p.emojis / p.textCount).toFixed(1).replace(/\.0$/, '') : 0) + ' per message',
        extra: function (y) {
          text(ctx, theme, 'Signature emojis', M, y + 40, 800, 40, { alpha: 0.85 });
          (p.topEmojis || []).forEach(function (e, i) { emojiAt(ctx, e, M + i * 200, y + 230, 150); });
        }
      });
    });

    if (A.fastest) add('fastest', 'Fastest replier', '\u26a1', function (ctx, theme) {
      var d = fmtDuration(A.fastest.medianReply);
      award(ctx, theme, {
        pill: 'FASTEST REPLIER', emoji: '\u26a1', kicker: 'Phone permanently in hand', name: name(A.fastest.name),
        number: d[0], unit: d[1],
        copy: pick(['Replies before you even lock your phone. Respect.', 'Typing bubble? Never heard of her. Already replied.', 'Notifications on. Volume up. Ready at all times.'], key + 'fast')
      });
    });

    if (A.essay) add('essay', 'The essay writer', '\u{1F4DC}', function (ctx, theme) {
      var p = A.essay, L = p.longest;
      award(ctx, theme, {
        pill: 'THE ESSAY WRITER', emoji: '\u{1F4DC}', kicker: 'Never met a short reply', name: name(p.name),
        number: fmt(L.words), unit: 'words in a single message, on ' + MONTHS_LONG[L.mo - 1] + ' ' + L.d,
        copy: pick(['That\u2019s not a text, that\u2019s a chapter. We read it. Mostly.', 'Somebody get this person a blog.', 'Scrolled for a while to get through that one.'], key + 'essay')
      });
    });

    if (A.laugh) add('laugh', 'Laugh track', '\u{1F602}', function (ctx, theme) {
      var p = A.laugh;
      award(ctx, theme, {
        pill: 'THE LAUGH TRACK', emoji: '\u{1F602}', kicker: 'Easiest audience in the group', name: name(p.name),
        number: fmt(p.laughs), unit: 'lols, hahas and \u{1F602}s',
        copy: pick(['Every group needs one person who thinks everyone is hilarious.', 'Laughing at every joke, even the bad ones. Especially the bad ones.', 'Single-handedly keeping morale up.'], key + 'laugh')
      });
    });

    if (stats.busiest) add('busiest', 'Busiest day', '\u{1F4C5}', function (ctx, theme) {
      var b = stats.busiest;
      var y = pill(ctx, theme, 'BUSIEST DAY EVER', 250);
      ctx.save(); ctx.fillStyle = theme.ink; shadow(ctx, true); spacing(ctx, -3);
      ctx.font = F(900, 250); ctx.fillText(MONTHS[b.mo - 1].toUpperCase() + ' ' + b.d, M - 10, y + 260);
      ctx.restore();
      text(ctx, theme, String(b.y), M, y + 340, 800, 64, { alpha: 0.85 });
      var after = bigNumber(ctx, theme, fmt(b.count), 'messages in one day', 1030);
      // daily sparkline (weekly buckets if long)
      var days = stats.days, n = days.length, sx = M, sy = after + 100, sw = W - 2 * M, sh = 200;
      var buckets = [], peakIdx = 0;
      var step = n > 160 ? 7 : 1;
      var start = new Date(days[0].y, days[0].mo - 1, days[0].d).getTime();
      var lastD = days[n - 1], end = new Date(lastD.y, lastD.mo - 1, lastD.d).getTime();
      var nb = Math.floor((end - start) / 864e5 / step) + 1;
      for (var i = 0; i < nb; i++) buckets.push(0);
      days.forEach(function (d) {
        var k = Math.floor((new Date(d.y, d.mo - 1, d.d).getTime() - start) / 864e5 / step);
        buckets[k] += d.count; if (d === b) peakIdx = k;
      });
      var mx = Math.max.apply(null, buckets) || 1, bw = sw / nb;
      ctx.save();
      buckets.forEach(function (v, i) {
        var h = Math.max(4, sh * v / mx);
        ctx.fillStyle = i === peakIdx ? theme.accent : 'rgba(255,255,255,0.45)';
        ctx.fillRect(sx + i * bw, sy + sh - h, Math.max(1.5, bw - (bw > 6 ? 2 : 0.5)), h);
      });
      ctx.restore();
      var mvp = b.mvp;
      if (mvp) paragraph(ctx, theme, name(mvp[0]) + ' alone sent ' + fmt(mvp[1]) + ' of them. Something happened that day.', sy + sh + 110, 46, 2);
    });

    if (stats.topWords.length || stats.topEmojis.length) add('words', 'Top words & emojis', '\u{1F4AC}', function (ctx, theme) {
      var y = pill(ctx, theme, 'IN YOUR OWN WORDS', 250);
      text(ctx, theme, 'The words that defined you', M, y + 100, 700, 50, { alpha: 0.9 });
      var yy = y + 150;
      stats.topWords.slice(0, 5).forEach(function (w, i) {
        var s = [190, 156, 132, 116, 104][i];
        ctx.save();
        ctx.fillStyle = theme.ink; ctx.globalAlpha = 0.6; ctx.font = F(900, 44);
        ctx.fillText(String(i + 1), M, yy + s * 0.82);
        ctx.globalAlpha = 1; shadow(ctx, i === 0);
        var fs = fitSize(ctx, w[0], 900, s, 50, W - 2 * M - 300);
        ctx.fillStyle = i === 0 ? theme.accent : theme.ink; spacing(ctx, -2);
        ctx.fillText(w[0], M + 70, yy + s * 0.85);
        shadow(ctx, false); spacing(ctx, 0);
        ctx.textAlign = 'right'; ctx.font = F(800, 40); ctx.fillStyle = theme.ink; ctx.globalAlpha = 0.8;
        ctx.fillText(fmt(w[1]) + '\u00d7', W - M, yy + s * 0.85);
        ctx.restore();
        yy += s * 1.12;
      });
      if (stats.topEmojis.length) {
        var ey = yy + 110;
        text(ctx, theme, 'Most-used emojis', M, ey, 800, 44, { alpha: 0.9 });
        stats.topEmojis.slice(0, 5).forEach(function (e, i) {
          var x = M + i * 182;
          emojiAt(ctx, e[0], x, ey + 170, 128);
          text(ctx, theme, fmt(e[1]), x + 4, ey + 240, 800, 36, { alpha: 0.85 });
        });
      }
    });

    if (A.starter) add('starter', 'Conversation starter', '\u{1F399}\ufe0f', function (ctx, theme) {
      var p = A.starter;
      award(ctx, theme, {
        pill: 'CONVERSATION STARTER', emoji: '\u{1F399}\ufe0f', kicker: 'Breaks the silence, every time', name: name(p.name),
        number: fmt(p.starts), unit: 'conversations kicked off after the chat went quiet',
        copy: pick(['When the chat goes dead, they bring it back to life.', 'Without them this group would be a graveyard.', 'The spark plug. The opener. The \u201canyone up?\u201d'], key + 'start')
      });
    });

    if (A.ghost) add('ghost', 'The ghost', '\u{1F47B}', function (ctx, theme) {
      var p = A.ghost;
      award(ctx, theme, {
        pill: 'THE GHOST', emoji: '\u{1F47B}', kicker: 'Reads everything. Says nothing.', name: name(p.name),
        number: fmt(p.count), unit: (p.count === 1 ? 'message' : 'messages') + ' total \u00b7 ' + (p.share < 0.01 ? 'under 1%' : pct(p.share)) + ' of the chat',
        copy: pick(['Seen at every message. Typing\u2026 never. Mysterious. Iconic.', 'Rumour has it they\u2019re still in the group.', 'Quality over quantity. Probably.'], key + 'ghost')
      });
    });

    add('vibe', 'Group vibe', stats.vibe.emoji, function (ctx, theme) {
      var v = stats.vibe, m = stats.metrics;
      var y = pill(ctx, theme, 'THE GROUP VIBE', 250);
      emojiAt(ctx, v.emoji, M - 6, y + 250, 210);
      ctx.save(); ctx.fillStyle = theme.ink; shadow(ctx, true); spacing(ctx, -3);
      var size = 150, lines;
      while (true) { ctx.font = F(900, size); lines = wrap(ctx, v.name, W - 2 * M); if ((lines.length <= 2 && lines.every(function (l) { return ctx.measureText(l).width <= W - 2 * M; })) || size <= 80) break; size -= 6; }
      lines = lines.slice(0, 2);
      lines.forEach(function (l, i) { ctx.fillText(l, M - 4, y + 420 + i * size); });
      ctx.restore();
      var py = paragraph(ctx, theme, v.line, y + 420 + (lines.length - 1) * size + 100, 48, 3);
      var gx = M, gw = (W - 2 * M - 32) / 2, gh = 250, gy = Math.max(py + 70, 1150);
      chip(ctx, theme, gx, gy, gw, gh, m.perDay >= 10 ? fmt(m.perDay) : m.perDay.toFixed(1), 'messages a day');
      chip(ctx, theme, gx + gw + 32, gy, gw, gh, hourLabel(m.peakHour), 'peak hour');
      chip(ctx, theme, gx, gy + gh + 32, gw, gh, fmt(m.laughsPer100), 'laughs per 100 messages');
      chip(ctx, theme, gx + gw + 32, gy + gh + 32, gw, gh, m.avgWords.toFixed(1), 'words per message');
    });

    return cards.slice(0, 12);
  }

  function render(canvas, card, stats, info, idx, total) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    var theme = THEMES[card.id] || THEMES.intro;
    background(ctx, theme, (info.title || '') + card.id, card.emoji);
    chrome(ctx, theme, info, idx, total);
    card.draw(ctx, theme);
  }

  var api = { build: build, render: render, W: W, H: H };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WrappedCards = api;
})(typeof self !== 'undefined' ? self : this);
