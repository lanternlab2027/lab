/* Couples Chat Wrapped: 1080x1920 card renderer (canvas). Adapted from ../wrapped/cards.js.
 * Cards only ever draw counts, dates and names (or initials/nicknames). No message text. */
(function (root) {
  'use strict';

  var W = 1080, H = 1920, M = 88;
  var STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  var EMOJI_STACK = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var SITE = 'lanternlab2027.github.io/lab/couples';
  var HEART = '\u2764\ufe0f';

  var THEMES = {
    intro:   { bg: ['#ff5c8a', '#d6246e', '#5a0b3c'], ink: '#ffffff', accent: '#ffe3ec', a: '#ffd1e0', b: '#ffffff' },
    count:   { bg: ['#ffb3c7', '#ff6f91', '#c2185b'], ink: '#ffffff', accent: '#fff4c2', a: '#fff4c2', b: '#ffffff' },
    reply:   { bg: ['#ff8a65', '#ff4f7b', '#8e1b5c'], ink: '#ffffff', accent: '#fff1b8', a: '#fff1b8', b: '#ffffff' },
    night:   { bg: ['#1c0b33', '#3a1257', '#7a1f6b'], ink: '#ffffff', accent: '#ffb3d1', a: '#ffb3d1', b: '#c9b8ff' },
    emoji:   { bg: ['#fff0f4', '#ffc2d4', '#ff8fb1'], ink: '#4a0a26', accent: '#d81b60', a: '#d81b60', b: '#4a0a26' },
    streak:  { bg: ['#ff3d6e', '#c2185b', '#4a0a3a'], ink: '#ffffff', accent: '#ffe066', a: '#ffe066', b: '#ffffff' },
    busiest: { bg: ['#f857a6', '#ff5858', '#9c1c4b'], ink: '#ffffff', accent: '#fff3d6', a: '#fff3d6', b: '#ffffff' },
    late:    { bg: ['#0b0f2e', '#26185c', '#5b2a86'], ink: '#ffffff', accent: '#ff9ecb', a: '#ff9ecb', b: '#b9c3ff' },
    ily:     { bg: ['#ff1f5a', '#d10a4a', '#6b0632'], ink: '#ffffff', accent: '#ffe0ea', a: '#ffe0ea', b: '#ffffff' },
    first:   { bg: ['#fde2e4', '#f8b4c4', '#e17aa0'], ink: '#4a0a26', accent: '#b0124f', a: '#b0124f', b: '#4a0a26' },
    summary: { bg: ['#ff6f91', '#c2185b', '#3d0a3a'], ink: '#ffffff', accent: '#ffe066', a: '#ffe066', b: '#ffffff' }
  };

  function F(weight, size) { return weight + ' ' + size + 'px ' + STACK; }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pick(arr, key) { return arr[hash(key) % arr.length]; }
  function rngFrom(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function spacing(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }
  function pct(x) { var p = x * 100; return (p > 0 && p < 1 ? '<1' : String(Math.round(p))) + '%'; }
  function dateLong(o) { return MONTHS_LONG[o.mo - 1] + ' ' + o.d + ', ' + o.y; }
  function dateShort(o) { return MONTHS[o.mo - 1] + ' ' + o.d; }
  function weekday(o) { return WEEKDAYS[new Date(o.y, o.mo - 1, o.d).getDay()]; }

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

  function heartPath(ctx, x, y, s) {
    // centred at (x, y), roughly s wide
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 0.6, y - s * 0.05, x - s * 0.45, y - s * 0.55, x, y - s * 0.22);
    ctx.bezierCurveTo(x + s * 0.45, y - s * 0.55, x + s * 0.6, y - s * 0.05, x, y + s * 0.35);
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
    if (on) { ctx.shadowColor = 'rgba(0,0,0,' + (strength || 0.2) + ')'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8; }
    else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  }

  function background(ctx, theme, seedKey, watermark) {
    var g = ctx.createLinearGradient(0, 0, W * 0.35, H);
    g.addColorStop(0, theme.bg[0]); g.addColorStop(0.55, theme.bg[1]); g.addColorStop(1, theme.bg[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var r = rngFrom(hash(seedKey));
    for (var i = 0; i < 3; i++) {
      var x = r() * W, y = r() * H, rad = 380 + r() * 420;
      var rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
      rg.addColorStop(0, 'rgba(255,255,255,' + (0.14 + r() * 0.1) + ')');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
    // scattered outline hearts
    ctx.save();
    ctx.strokeStyle = theme.ink; ctx.globalAlpha = 0.12; ctx.lineWidth = 4;
    for (var k = 0; k < 9; k++) {
      var hx = r() * W, hy = 180 + r() * (H - 420), hs = 40 + r() * 90;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate((r() - 0.5) * 0.7); heartPath(ctx, 0, 0, hs); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    if (watermark) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.translate(W - 120, H - 430);
      ctx.rotate(-0.22);
      ctx.font = '600px ' + EMOJI_STACK;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(watermark, 0, 0);
      ctx.restore();
    }
  }

  function chrome(ctx, theme, info, idx, total) {
    ctx.save();
    ctx.fillStyle = theme.ink; ctx.textBaseline = 'alphabetic';
    ctx.font = F(800, 30); spacing(ctx, 6);
    ctx.globalAlpha = 0.9;
    ctx.fillText('COUPLES CHAT WRAPPED', M, 128);
    spacing(ctx, 0);
    ctx.font = F(800, 30);
    var p = info.periodShort, pw = ctx.measureText(p).width + 48;
    ctx.globalAlpha = 1;
    rr(ctx, W - M - pw, 88, pw, 56, 28);
    ctx.strokeStyle = theme.ink; ctx.lineWidth = 3; ctx.globalAlpha = 0.85; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.fillText(p, W - M - pw / 2, 128);
    ctx.textAlign = 'left'; ctx.globalAlpha = 0.92;
    ctx.font = F(800, 34);
    ctx.fillText(ellipsize(ctx, info.pair, 620), M, H - 104);
    ctx.font = F(700, 28); ctx.globalAlpha = 0.9;
    var mk = 'Make yours: ' + SITE;
    ctx.fillText(mk, M, H - 62);
    var mw = ctx.measureText(mk).width;
    ctx.textAlign = 'right'; ctx.font = F(800, 34); ctx.globalAlpha = 0.92;
    ctx.fillText(idx + ' / ' + total, W - M, H - 104);
    ctx.globalAlpha = 0.75;
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
    ctx.fillStyle = theme.bg[2]; ctx.textBaseline = 'middle';
    ctx.fillText(text, M + 32, y + 41);
    ctx.restore();
    return y + 78;
  }

  function emojiAt(ctx, e, x, y, size, align) {
    ctx.save();
    ctx.font = size + 'px ' + EMOJI_STACK;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = align || 'left';
    shadow(ctx, true, 0.18);
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
    var s = opts.maxWidth ? ellipsize(ctx, str, opts.maxWidth) : str;
    ctx.fillText(s, x, y);
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

  function headline(ctx, theme, str, y, max, maxLines) {
    ctx.save(); ctx.fillStyle = theme.ink; shadow(ctx, true); spacing(ctx, -2);
    var size = max, lines;
    while (true) {
      ctx.font = F(900, size); lines = wrap(ctx, str, W - 2 * M);
      if ((lines.length <= (maxLines || 2) && lines.every(function (l) { return ctx.measureText(l).width <= W - 2 * M; })) || size <= 56) break;
      size -= 6;
    }
    lines = lines.slice(0, maxLines || 2);
    lines.forEach(function (l, i) { ctx.fillText(ellipsize(ctx, l, W - 2 * M), M - 4, y + i * size * 1.05); });
    ctx.restore();
    return y + (lines.length - 1) * size * 1.05;
  }

  function bigNumber(ctx, theme, num, unit, y, max) {
    ctx.save();
    var size = fitSize(ctx, num, 900, max || 300, 110, W - 2 * M);
    ctx.fillStyle = theme.accent; spacing(ctx, -8); shadow(ctx, true, 0.22);
    ctx.fillText(num, M - 10, y);
    ctx.restore();
    ctx.save();
    ctx.font = F(800, 48); ctx.fillStyle = theme.ink;
    var lines = wrap(ctx, unit, W - 2 * M, 2);
    lines.forEach(function (l, i) { ctx.fillText(l, M, y + 78 + i * 60); });
    ctx.restore();
    return y + 78 + (lines.length - 1) * 60;
  }

  function chip(ctx, theme, x, y, w, h, value, label, emojiValue) {
    ctx.save();
    rr(ctx, x, y, w, h, 36);
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = theme.ink;
    var vs = emojiValue ? 84 : fitSize(ctx, value, 900, 84, 40, w - 64);
    var base = y + 30 + vs * 0.86;
    if (emojiValue) { ctx.restore(); emojiAt(ctx, value, x + 30, base, vs); ctx.save(); ctx.fillStyle = theme.ink; }
    else { ctx.font = F(900, vs); ctx.fillText(value, x + 32, base); }
    ctx.font = F(700, 32); ctx.globalAlpha = 0.9;
    wrap(ctx, label, w - 64, 2).forEach(function (l, i) { ctx.fillText(l, x + 32, base + 54 + i * 38); });
    ctx.restore();
  }

  // Two-segment bar with a label row above it.
  function splitBar(ctx, theme, y, title, nA, nB, vA, vB, labelA, labelB) {
    text(ctx, theme, title, M, y, 800, 44, { alpha: 0.92 });
    var bx = M, by = y + 34, bw = W - 2 * M, bh = 96;
    var tot = vA + vB || 1, wa = Math.max(bh, Math.min(bw - bh, bw * vA / tot));
    ctx.save();
    rr(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = theme.b; ctx.globalAlpha = 0.85; ctx.fill();
    ctx.globalAlpha = 1;
    rr(ctx, bx, by, wa, bh, bh / 2); ctx.fillStyle = theme.a; ctx.fill();
    // little heart where they meet
    ctx.save(); ctx.translate(bx + wa, by + bh / 2); heartPath(ctx, 0, 6, 70); ctx.fillStyle = theme.bg[2]; ctx.fill(); ctx.restore();
    ctx.restore();
    var rowY = by + bh + 70;
    text(ctx, theme, nA, M, rowY, 900, 52, { maxWidth: (W - 2 * M) / 2 - 20 });
    text(ctx, theme, labelA, M, rowY + 52, 700, 38, { alpha: 0.88 });
    text(ctx, theme, nB, W - M, rowY, 900, 52, { align: 'right', maxWidth: (W - 2 * M) / 2 - 20 });
    text(ctx, theme, labelB, W - M, rowY + 52, 700, 38, { alpha: 0.88, align: 'right' });
    return rowY + 52;
  }

  function fmtDuration(sec) {
    if (sec == null) return ['\u2013', ''];
    if (sec < 60) return [String(Math.max(1, Math.round(sec))), 'sec'];
    if (sec < 3600) { var m = Math.round(sec / 60); return [String(m), 'min']; }
    var h = sec / 3600; return [h < 10 ? h.toFixed(1).replace(/\.0$/, '') : String(Math.round(h)), h < 1.05 ? 'hour' : 'hours'];
  }
  function hourLabel(h) { return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM'); }

  // ---------- cards ----------
  function build(st, info) {
    var name = info.name;
    var pA = st.persons[0], pB = st.persons[1];
    var nA = name(pA.name), nB = name(pB.name);
    var key = info.pair;
    var cards = [];
    function add(id, label, emoji, draw) { cards.push({ id: id, label: label, emoji: emoji, draw: draw }); }

    add('intro', 'Our year in texts', '\u{1F48C}', function (ctx, theme) {
      var y = pill(ctx, theme, info.year ? info.year + ' IN TEXTS' : info.last12 ? 'OUR YEAR IN TEXTS' : 'OUR STORY IN TEXTS', 250);
      emojiAt(ctx, '\u{1F48C}', M - 6, y + 230, 170);
      var after = headline(ctx, theme, nA + ' & ' + nB, y + 420, 150, 2);
      paragraph(ctx, theme, info.periodLong, after + 90, 46, 1, 0.88);
      var gx = M, gw = (W - 2 * M - 32) / 2, gh = 240, gy = 1040;
      chip(ctx, theme, gx, gy, gw, gh, fmt(st.total), 'messages between you two');
      chip(ctx, theme, gx + gw + 32, gy, gw, gh, fmt(st.activeDays), st.activeDays === 1 ? 'day you texted' : 'days you texted');
      chip(ctx, theme, gx, gy + gh + 32, gw, gh, fmt(st.totalEmojis), 'emojis sent');
      chip(ctx, theme, gx + gw + 32, gy + gh + 32, gw, gh, st.perDay >= 10 ? fmt(st.perDay) : st.perDay.toFixed(1), 'messages a day');
      paragraph(ctx, theme, pick(['Every \u201con my way\u201d, every \u201cwhat\u2019s for dinner\u201d. Counted with love.', 'A year of tiny messages, added up. Swipe through.', 'No receipts, just numbers. The cute kind.'], key + 'i'), 1650, 44, 2);
    });

    add('count', 'Who texts first', '\u2600\ufe0f', function (ctx, theme) {
      var y = pill(ctx, theme, 'THE TEXT COUNT', 250);
      var after = splitBar(ctx, theme, y + 130, 'Messages sent', nA, nB, pA.count, pB.count, fmt(pA.count) + ' \u00b7 ' + pct(pA.share), fmt(pB.count) + ' \u00b7 ' + pct(pB.share));
      emojiAt(ctx, '\u2600\ufe0f', M - 4, after + 230, 130);
      text(ctx, theme, 'First text of the morning', M + 160, after + 160, 900, 50, { maxWidth: W - 2 * M - 160 });
      text(ctx, theme, 'the first message after 5 AM, each day', M + 160, after + 214, 700, 34, { alpha: 0.85 });
      var after2 = splitBar(ctx, theme, after + 360, 'Days each of you said hi first', nA, nB, pA.morningFirst, pB.morningFirst, fmt(pA.morningFirst) + (pA.morningFirst === 1 ? ' day' : ' days'), fmt(pB.morningFirst) + (pB.morningFirst === 1 ? ' day' : ' days'));
      paragraph(ctx, theme, pick(['Two thumbs, one very long conversation.', 'Somebody\u2019s alarm goes off first. Now you know whose.', 'Good morning texts: the tiny daily habit that adds up.'], key + 'c'), Math.max(after2 + 140, 1560), 46, 2);
    });

    if (pA.medianReply != null && pB.medianReply != null) add('reply', 'Reply speed', '\u26a1', function (ctx, theme) {
      var y = pill(ctx, theme, 'REPLY SPEED', 250);
      headline(ctx, theme, 'How fast you two write back', y + 130, 84, 2);
      function block(yy, nm, p, col) {
        var d = fmtDuration(p.medianReply);
        text(ctx, theme, nm, M, yy, 900, 60, { maxWidth: W - 2 * M });
        ctx.save(); ctx.fillStyle = col; shadow(ctx, true, 0.2); spacing(ctx, -6); ctx.font = F(900, 220);
        ctx.fillText(d[0], M - 8, yy + 220); var w = ctx.measureText(d[0]).width; ctx.restore();
        text(ctx, theme, d[1], M + w + 20, yy + 220, 900, 80);
        text(ctx, theme, 'typical reply \u00b7 ' + fmt(p.replies) + ' replies counted', M, yy + 290, 700, 36, { alpha: 0.85 });
      }
      block(y + 360, nA, pA, theme.a);
      block(y + 760, nB, pB, theme.b);
      paragraph(ctx, theme, 'Median time to reply. Gaps over 12 hours count as a new conversation, not a reply.', 1560, 38, 3, 0.85);
    });

    if (st.goodnights > 0) add('goodnight', 'Goodnights', '\u{1F319}', function (ctx, theme) {
      var y = pill(ctx, theme, 'GOODNIGHT', 250);
      emojiAt(ctx, '\u{1F319}', M - 6, y + 250, 200);
      text(ctx, theme, 'You two said goodnight', M, y + 360, 800, 54, { alpha: 0.92 });
      var after = bigNumber(ctx, theme, fmt(st.goodnights), st.goodnights === 1 ? 'time' : 'times', 960);
      var weeks = Math.max(1, st.spanDays / 7);
      var perWeek = st.goodnights / weeks;
      paragraph(ctx, theme, (perWeek >= 1 ? 'That\u2019s about ' + (perWeek >= 10 ? fmt(perWeek) : perWeek.toFixed(1).replace(/\.0$/, '')) + ' a week. ' : '') + pick(['Sweet dreams, on repeat.', 'Lights out, phones down. Eventually.', 'The last text of the day, again and again.'], key + 'g'), after + 140, 48, 3);
      paragraph(ctx, theme, 'Counts messages with goodnight, gn, buenas noches, bonne nuit, gute Nacht, boa noite, buonanotte\u2026', 1620, 30, 2, 0.75);
    });

    if (pA.topEmoji || pB.topEmoji) add('emoji', 'Your emojis', '\u{1F970}', function (ctx, theme) {
      var y = pill(ctx, theme, 'YOUR EMOJIS', 250);
      text(ctx, theme, 'Most-used emoji', M, y + 110, 800, 50, { alpha: 0.92 });
      function col(x, nm, p, align) {
        var cx = align === 'right' ? W - M : M;
        text(ctx, theme, nm, cx, y + 210, 900, 54, { align: align, maxWidth: (W - 2 * M) / 2 - 20 });
        if (p.topEmoji) {
          emojiAt(ctx, p.topEmoji.emoji, cx, y + 440, 200, align);
          text(ctx, theme, fmt(p.topEmoji.count) + '\u00d7', cx, y + 520, 800, 44, { align: align, alpha: 0.9 });
        } else text(ctx, theme, 'no emojis', cx, y + 420, 700, 44, { align: align, alpha: 0.8 });
      }
      col(M, nA, pA, 'left');
      col(W - M, nB, pB, 'right');
      if (st.sharedEmoji) {
        var sy = y + 700;
        ctx.save();
        heartPath(ctx, W / 2, sy + 330, 760); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
        ctx.restore();
        text(ctx, theme, 'Your shared emoji', W / 2, sy + 40, 900, 56, { align: 'center' });
        emojiAt(ctx, st.sharedEmoji.emoji, W / 2, sy + 380, 260, 'center');
        text(ctx, theme, 'sent ' + fmt(st.sharedEmoji.count) + ' times between you', W / 2, sy + 480, 800, 44, { align: 'center', alpha: 0.9 });
      }
    });

    if (st.streak && st.streak.days >= 2) add('streak', 'Longest streak', '\u{1F525}', function (ctx, theme) {
      var s = st.streak;
      var y = pill(ctx, theme, 'LONGEST STREAK', 250);
      emojiAt(ctx, '\u{1F525}', M - 6, y + 250, 200);
      text(ctx, theme, 'Days in a row you texted', M, y + 360, 800, 54, { alpha: 0.92 });
      var after = bigNumber(ctx, theme, fmt(s.days), 'days, from ' + dateShort(s.start) + (s.start.y !== s.end.y ? ', ' + s.start.y : '') + ' to ' + dateShort(s.end) + ', ' + s.end.y, 960);
      paragraph(ctx, theme, pick(['Not a single day off. Not even a \u201ck\u201d day.', 'Every day, something to say.', 'Streak goals: unlocked.'], key + 's'), after + 140, 48, 3);
    });

    if (st.busiest) add('busiest', 'Busiest day', '\u{1F4C5}', function (ctx, theme) {
      var b = st.busiest;
      var y = pill(ctx, theme, 'BUSIEST DAY', 250);
      ctx.save(); ctx.fillStyle = theme.ink; shadow(ctx, true); spacing(ctx, -3);
      var lbl = MONTHS[b.mo - 1].toUpperCase() + ' ' + b.d;
      fitSize(ctx, lbl, 900, 250, 120, W - 2 * M); ctx.fillText(lbl, M - 10, y + 260);
      ctx.restore();
      text(ctx, theme, weekday(b) + ', ' + b.y, M, y + 340, 800, 60, { alpha: 0.88 });
      var after = bigNumber(ctx, theme, fmt(b.count), 'messages in one day', 1010);
      // volume sparkline (weekly buckets for long chats)
      var days = st.days, n = days.length, sx = M, sy = after + 100, sw = W - 2 * M, sh = 200;
      if (n > 1) {
        var step = days[n - 1].n - days[0].n > 160 ? 7 : 1;
        var nb = Math.floor((days[n - 1].n - days[0].n) / step) + 1, buckets = [], peak = 0;
        for (var i = 0; i < nb; i++) buckets.push(0);
        days.forEach(function (d) { var k = Math.floor((d.n - days[0].n) / step); buckets[k] += d.count; if (d.y === b.y && d.mo === b.mo && d.d === b.d) peak = k; });
        var mx = Math.max.apply(null, buckets) || 1, bw = sw / nb;
        ctx.save();
        buckets.forEach(function (v, i2) {
          var h = Math.max(4, sh * v / mx);
          ctx.fillStyle = i2 === peak ? theme.accent : 'rgba(255,255,255,0.45)';
          ctx.fillRect(sx + i2 * bw, sy + sh - h, Math.max(1.5, bw - (bw > 6 ? 2 : 0.5)), h);
        });
        ctx.restore();
      }
      paragraph(ctx, theme, pick(['Whatever happened that day, you had a lot to say about it.', 'A big day. You know why.', 'Phones: fully charged. Then not.'], key + 'b'), sy + sh + 110, 46, 2);
    });

    if (st.total >= 10) add('late', 'Late-night texts', '\u{1F30C}', function (ctx, theme) {
      var y = pill(ctx, theme, 'AFTER DARK', 250);
      var after = bigNumber(ctx, theme, pct(st.late.share), 'of your messages were sent between 11 PM and 4 AM', y + 300);
      var cx = M, cy = after + 110, cw = W - 2 * M, ch = 330;
      var hrs = st.hours, max = Math.max.apply(null, hrs) || 1, bw = cw / 24;
      ctx.save();
      hrs.forEach(function (v, h) {
        var bh = Math.max(8, ch * v / max);
        rr(ctx, cx + h * bw + 4, cy + ch - bh, bw - 8, bh, 8);
        ctx.fillStyle = (h >= 23 || h < 4) ? theme.a : 'rgba(255,255,255,0.38)';
        ctx.fill();
      });
      ctx.fillStyle = theme.ink; ctx.globalAlpha = 0.75; ctx.font = F(700, 30);
      [[0, '12a'], [6, '6a'], [12, '12p'], [18, '6p']].forEach(function (t) { ctx.fillText(t[1], cx + t[0] * bw + 2, cy + ch + 46); });
      ctx.restore();
      var peak = hrs.indexOf(Math.max.apply(null, hrs));
      paragraph(ctx, theme, fmt(st.late.count) + ' late-night messages. Your busiest hour: ' + hourLabel(peak) + '.', cy + ch + 140, 46, 2);
      paragraph(ctx, theme, pick(['The best talks happen after the lights go off.', 'Five more minutes. Said nobody, ever, just once.', 'Sleep is important. So is this.'], key + 'l'), cy + ch + 290, 44, 2, 0.88);
    });

    if (st.ily > 0) add('ily', 'I love yous', HEART, function (ctx, theme) {
      var y = pill(ctx, theme, 'I LOVE YOU', 250);
      ctx.save(); ctx.translate(W - M - 170, y + 190); ctx.rotate(0.12); heartPath(ctx, 0, 0, 300); ctx.fillStyle = theme.accent; shadow(ctx, true, 0.2); ctx.fill(); ctx.restore();
      text(ctx, theme, 'Times it was said', M, y + 200, 800, 54, { alpha: 0.92 });
      text(ctx, theme, 'in this chat', M, y + 262, 800, 54, { alpha: 0.92 });
      var after = bigNumber(ctx, theme, fmt(st.ily), st.ily === 1 ? 'I love you' : 'I love yous (and love yous, ilys, te quieros\u2026)', 960);
      var weeks = Math.max(1, st.spanDays / 7), pw = st.ily / weeks;
      paragraph(ctx, theme, (pw >= 1 ? 'About ' + (pw >= 10 ? fmt(pw) : pw.toFixed(1).replace(/\.0$/, '')) + ' a week. ' : '') + pick(['Never gets old.', 'Said it, meant it, said it again.', 'Three little words, over and over.'], key + 'y'), after + 140, 48, 3);
      paragraph(ctx, theme, 'Matched in English, Spanish, French, German, Portuguese and Italian.', 1620, 30, 2, 0.75);
    });

    if (info.fileFirst) add('first', 'Where it starts', '\u{1F331}', function (ctx, theme) {
      var f = info.fileFirst;
      var y = pill(ctx, theme, 'WHERE IT STARTS', 250);
      emojiAt(ctx, '\u{1F331}', M - 6, y + 250, 200);
      text(ctx, theme, 'The first message in this chat file', M, y + 360, 800, 50, { alpha: 0.92 });
      ctx.save(); ctx.fillStyle = theme.accent; shadow(ctx, true, 0.15); spacing(ctx, -4);
      var lbl = MONTHS_LONG[f.mo - 1] + ' ' + f.d;
      fitSize(ctx, lbl, 900, 200, 100, W - 2 * M); ctx.fillText(lbl, M - 8, y + 600);
      ctx.restore();
      text(ctx, theme, weekday(f) + ', ' + f.y + ' \u00b7 ' + hourLabel(f.h).replace(' ', ':' + (f.mi < 10 ? '0' : '') + f.mi + ' '), M, y + 690, 800, 54, { alpha: 0.9 });
      text(ctx, theme, 'sent by ' + name(f.sender), M, y + 770, 700, 46, { alpha: 0.85, maxWidth: W - 2 * M });
      var days = Math.round((new Date(info.fileLast.y, info.fileLast.mo - 1, info.fileLast.d) - new Date(f.y, f.mo - 1, f.d)) / 864e5);
      if (days > 0) bigNumber(ctx, theme, fmt(days), 'days of texts since then (in this file)', y + 1100, 200);
      paragraph(ctx, theme, 'Exports can start partway through a chat, so this is the earliest message we found, not necessarily the very first.', 1600, 34, 3, 0.8);
    });

    add('summary', 'Us, in texts', '\u{1F49E}', function (ctx, theme) {
      var y = pill(ctx, theme, 'US, IN TEXTS', 250);
      headline(ctx, theme, nA + ' & ' + nB, y + 150, 110, 1);
      var gx = M, gw = (W - 2 * M - 32) / 2, gh = 230, gy = y + 250, gap = 28;
      var tiles = [[fmt(st.total), 'messages'], [st.streak ? fmt(st.streak.days) + (st.streak.days === 1 ? ' day' : ' days') : '\u2013', 'longest streak']];
      tiles.push(st.goodnights ? [fmt(st.goodnights), 'goodnights'] : [fmt(st.activeDays), 'days texting']);
      tiles.push(st.ily ? [fmt(st.ily), 'I love yous'] : [fmt(st.totalEmojis), 'emojis']);
      tiles.push([pct(st.late.share), 'after 11 PM']);
      tiles.push(st.busiest ? [dateShort(st.busiest), 'busiest day'] : [fmt(st.perDay), 'a day']);
      tiles.push(st.sharedEmoji ? [st.sharedEmoji.emoji, 'shared emoji', true] : [fmt(st.totalEmojis), 'emojis']);
      tiles.push(info.fileFirst ? [MONTHS[info.fileFirst.mo - 1] + ' \u2019' + String(info.fileFirst.y).slice(2), 'first message here'] : [fmt(st.activeDays), 'days texting']);
      tiles.forEach(function (t, i) {
        chip(ctx, theme, gx + (i % 2) * (gw + 32), gy + Math.floor(i / 2) * (gh + gap), gw, gh, t[0], t[1], t[2]);
      });
      paragraph(ctx, theme, pick(['Fun facts only. No scores, no winners. Just you two.', 'Not a test. Just a very cute spreadsheet.', 'Here\u2019s to another year of \u201con my way\u201d.'], key + 'z'), gy + 4 * (gh + gap) + 60, 42, 2);
    });

    return cards;
  }

  function render(canvas, card, st, info, idx, total) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    var theme = THEMES[card.id === 'goodnight' ? 'night' : card.id] || THEMES.intro;
    background(ctx, theme, info.pair + card.id, card.emoji);
    chrome(ctx, theme, info, idx, total);
    card.draw(ctx, theme);
  }

  var api = { build: build, render: render, W: W, H: H, fmtDuration: fmtDuration };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CouplesCards = api;
})(typeof self !== 'undefined' ? self : this);
