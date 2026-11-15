/* Couples Chat Wrapped: stats for a two-person chat. Pure functions over parsed messages
 * (from ../wrapped/parser.js); no network, no storage. Message text is only ever matched
 * against the keyword lists below and counted. It is never returned or drawn. */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var WP = isNode ? require('../wrapped/parser.js') : root.WrappedParser;
  var WS = isNode ? require('../wrapped/stats.js') : root.WrappedStats;

  var DAY = 864e5, HOUR = 3600e3;
  var REPLY_MAX = 12 * HOUR;       // gaps longer than this are a new conversation, not a reply
  var MORNING_FROM = 5;            // "first text of the morning" = first message at/after 5:00
  var LATE_FROM = 23, LATE_TO = 4; // late night = 11 PM to 3:59 AM

  // ---------- keyword lists (matched on lowercased text with accents stripped) ----------
  // Boundaries: not preceded/followed by a letter or digit.
  var B0 = '(?:^|[^\\p{L}\\p{N}])', B1 = '(?=$|[^\\p{L}\\p{N}])';
  var GOODNIGHT = [
    // en
    'good\\s*-?\\s*nigh+t+', 'good\\s*-?\\s*nite+', "g'?nigh+t+", 'gn+', 'nighty?\\s*-?\\s*nigh+t+', 'nite\\s*-?\\s*nite',
    // es
    'buenas\\s+noches+',
    // fr
    'bonne\\s+nuit',
    // de
    'gute\\s+nacht', 'gn8', 'n8',
    // pt
    'boa\\s+noite',
    // it
    'buona\\s*notte',
    // nl
    'welterusten', 'slaap\\s+lekker'
  ];
  var ILY = [
    // en: "i love you", "love you", "love u", "luv ya", "ily", "ilysm", "ily2"
    '(?:i\\s+)?(?:love|luv|lov)\\s+(?:you|u|ya)', 'ily(?:sm|2)?',
    // es (and pt "te amo")
    'te\\s+(?:quiero|amo|adoro)', 'tqm', 'tkm',
    // fr
    "je\\s+t'?\\s*aime", "j'?\\s*t'?\\s*aime", 'jtm',
    // de
    'ich\\s+liebe\\s+dich', 'hab\\s+dich\\s+(?:so\\s+)?lieb', 'hdl', 'hdgdl',
    // pt
    'amo-te', 'amo\\s+(?:voce|vc|tu)',
    // it
    'ti\\s+amo', 'ti\\s+voglio\\s+(?:tanto\\s+)?bene', 'tvb', 'tvtb'
  ];
  var RE_GN = new RegExp(B0 + '(?:' + GOODNIGHT.join('|') + ')' + B1, 'u');
  var RE_ILY = new RegExp(B0 + '(?:' + ILY.join('|') + ')' + B1, 'u');

  function normalize(text) {
    return String(text || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019\u02bc\u00b4`]/g, "'")
      .replace(/\u00df/g, 'ss');
  }
  function hasGoodnight(text) { return RE_GN.test(normalize(text)); }
  function hasILoveYou(text) { return RE_ILY.test(normalize(text)); }

  // ---------- helpers ----------
  function median(a) { return WS.median(a); }
  function dayNum(m) { return Math.round(Date.UTC(m.y, m.mo - 1, m.d) / DAY); }
  function ymdOf(n) { var d = new Date(n * DAY); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate() }; }
  function topOf(map) {
    var best = null;
    Object.keys(map).forEach(function (k) { if (!best || map[k] > best[1] || (map[k] === best[1] && k < best[0])) best = [k, map[k]]; });
    return best;
  }

  // ---------- 1:1 detection ----------
  // A 1:1 export has exactly two people talking. A third person with a real share of
  // the messages means a group. A tiny stray (e.g. one "Deleted Account" line) is dropped.
  function classify(messages, meta) {
    meta = meta || {};
    var counts = {};
    messages.forEach(function (m) { counts[m.sender] = (counts[m.sender] || 0) + 1; });
    var names = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || (a < b ? -1 : 1); });
    var total = messages.length;
    if (meta.isGroup) return { ok: false, reason: 'group', people: names };
    if (names.length >= 3 && counts[names[2]] >= Math.max(3, total * 0.02)) return { ok: false, reason: 'group', people: names };
    if (names.length < 2) return { ok: false, reason: 'solo', people: names };
    var pair = names.slice(0, 2).sort();
    return { ok: true, people: pair, dropped: names.slice(2) };
  }

  // Telegram JSON: pick a 1:1 chat out of a full-account export, and say whether a single chat is a group.
  function telegramChat(obj) {
    if (obj && obj.chats && Array.isArray(obj.chats.list)) {
      var list = obj.chats.list.filter(function (c) { return Array.isArray(c.messages); });
      var personal = list.filter(function (c) { return /personal|private_chat|^bot/.test(c.type || '') && !/group|channel/.test(c.type || ''); });
      var pool = personal.length ? personal : list;
      pool.sort(function (a, b) { return b.messages.length - a.messages.length; });
      obj = pool[0];
    }
    return { chat: obj, isGroup: !!(obj && /group|channel/.test(obj.type || '')) };
  }

  // Parse any supported export. Returns the parser's output plus { isGroup }.
  function parseExport(text, filename) {
    var trimmed = String(text).replace(/^\ufeff/, '').trimStart();
    if (trimmed.charAt(0) === '{') {
      var obj;
      try { obj = JSON.parse(trimmed); } catch (e) { throw new Error("That JSON file couldn't be read. Export it again from Telegram Desktop as JSON."); }
      var t = telegramChat(obj);
      var res = WP.parseTelegram(t.chat);
      if (!res.messages.length) throw new Error("We couldn't find any messages in that Telegram export.");
      res.messages.sort(function (a, b) { return a.t - b.t; });
      res.isGroup = t.isGroup;
      return res;
    }
    var r = WP.parseAny(text, filename);
    r.isGroup = false;
    return r;
  }

  // ---------- periods ----------
  function periods(messages) {
    var years = WS.years(messages);
    var out = [];
    var first = messages[0], last = messages[messages.length - 1];
    var span = first ? dayNum(last) - dayNum(first) : 0;
    if (span > 400) out.push({ id: 'last12', label: 'Last 12 months' });
    out.push({ id: 'all', label: 'All time' });
    if (years.length > 1) years.forEach(function (y) { out.push({ id: String(y.year), label: y.year + ' (' + y.count.toLocaleString('en-US') + ' messages)' }); });
    return out;
  }
  function filterPeriod(messages, period) {
    if (!period || period === 'all') return messages.slice();
    if (period === 'last12') {
      var last = messages[messages.length - 1];
      var cut = new Date(last.y - 1, last.mo - 1, last.d + 1).getTime();
      return messages.filter(function (m) { return m.t >= cut; });
    }
    var y = +period;
    return messages.filter(function (m) { return m.y === y; });
  }

  // ---------- the stats ----------
  // messages: sorted, from the full file. people: the two names from classify().
  function compute(allMessages, people, opts) {
    opts = opts || {};
    var all = allMessages.filter(function (m) { return m.sender === people[0] || m.sender === people[1]; });
    var msgs = filterPeriod(all, opts.period);
    var P = {};
    people.forEach(function (n) {
      P[n] = { name: n, count: 0, replyGaps: [], morningFirst: 0, goodnights: 0, ily: 0, emojis: 0, emojiFreq: {}, late: 0 };
    });
    var hours = new Array(24).fill(0);
    var days = {}, emojiShow = {};
    var total = 0, goodnights = 0, ily = 0, late = 0, totalEmojis = 0;
    var prev = null;

    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i], p = P[m.sender];
      p.count++; total++;
      hours[m.h]++;
      var isLate = m.h >= LATE_FROM || m.h < LATE_TO;
      if (isLate) { p.late++; late++; }
      var dn = dayNum(m);
      var day = days[dn] || (days[dn] = { n: dn, y: m.y, mo: m.mo, d: m.d, count: 0, morning: null });
      day.count++;
      if (day.morning === null && m.h >= MORNING_FROM) { day.morning = m.sender; p.morningFirst++; }
      if (prev && prev.sender !== m.sender) {
        var gap = m.t - prev.t;
        if (gap >= 0 && gap <= REPLY_MAX) p.replyGaps.push(gap / 1000);
      }
      prev = m;
      if (m.kind !== 'text' || !m.text) continue;
      if (hasGoodnight(m.text)) { p.goodnights++; goodnights++; }
      if (hasILoveYou(m.text)) { p.ily++; ily++; }
      var es = WS.emojisIn(m.text);
      es.forEach(function (e) {
        var k = e.replace(/\ufe0f/g, '');
        if (!emojiShow[k]) emojiShow[k] = e;
        p.emojiFreq[k] = (p.emojiFreq[k] || 0) + 1;
      });
      p.emojis += es.length; totalEmojis += es.length;
    }

    var list = people.map(function (n) {
      var p = P[n];
      p.share = total ? p.count / total : 0;
      p.medianReply = p.replyGaps.length ? median(p.replyGaps) : null;
      p.replies = p.replyGaps.length;
      var t = topOf(p.emojiFreq);
      p.topEmoji = t ? { emoji: emojiShow[t[0]], count: t[1] } : null;
      return p;
    });

    // Shared emoji: used by both; the one with the highest lower count (then the highest total).
    var shared = null;
    var a = list[0].emojiFreq, b = list[1].emojiFreq;
    Object.keys(a).forEach(function (k) {
      if (!b[k]) return;
      var lo = Math.min(a[k], b[k]), sum = a[k] + b[k];
      if (!shared || lo > shared.min || (lo === shared.min && sum > shared.count) || (lo === shared.min && sum === shared.count && k < shared.key)) shared = { key: k, emoji: emojiShow[k], min: lo, count: sum };
    });

    // Days, streak, busiest.
    var dayList = Object.keys(days).map(function (k) { return days[k]; }).sort(function (x, y) { return x.n - y.n; });
    var streak = null, run = 0, runStart = null;
    for (var j = 0; j < dayList.length; j++) {
      if (j > 0 && dayList[j].n === dayList[j - 1].n + 1) run++;
      else { run = 1; runStart = dayList[j].n; }
      if (!streak || run > streak.days) streak = { days: run, startN: runStart, endN: dayList[j].n };
    }
    if (streak) { streak.start = ymdOf(streak.startN); streak.end = ymdOf(streak.endN); }
    var busiest = null;
    dayList.forEach(function (d) { if (!busiest || d.count > busiest.count) busiest = d; });

    var first = msgs[0] || null, last = msgs[msgs.length - 1] || null;
    var spanDays = first ? dayNum(last) - dayNum(first) + 1 : 0;
    var fileFirst = all[0] || null;

    return {
      people: people, persons: list, total: total, totalEmojis: totalEmojis,
      first: first && { y: first.y, mo: first.mo, d: first.d },
      last: last && { y: last.y, mo: last.mo, d: last.d },
      spanDays: spanDays, activeDays: dayList.length, perDay: total / Math.max(1, spanDays),
      hours: hours,
      days: dayList.map(function (d) { return { n: d.n, y: d.y, mo: d.mo, d: d.d, count: d.count }; }),
      busiest: busiest && { y: busiest.y, mo: busiest.mo, d: busiest.d, count: busiest.count },
      streak: streak && { days: streak.days, start: streak.start, end: streak.end },
      late: { count: late, share: total ? late / total : 0 },
      goodnights: goodnights, ily: ily,
      sharedEmoji: shared && { emoji: shared.emoji, count: shared.count },
      morningDays: dayList.filter(function (d) { return d.morning !== null; }).length,
      fileFirst: fileFirst && { y: fileFirst.y, mo: fileFirst.mo, d: fileFirst.d, h: fileFirst.h, mi: fileFirst.mi, sender: fileFirst.sender },
      period: opts.period || 'all'
    };
  }

  var api = {
    classify: classify, parseExport: parseExport, telegramChat: telegramChat, compute: compute,
    periods: periods, filterPeriod: filterPeriod,
    hasGoodnight: hasGoodnight, hasILoveYou: hasILoveYou, normalize: normalize,
    REPLY_MAX: REPLY_MAX, LATE_FROM: LATE_FROM, LATE_TO: LATE_TO, MORNING_FROM: MORNING_FROM
  };
  if (isNode) module.exports = api;
  else root.CouplesStats = api;
})(typeof self !== 'undefined' ? self : this);
