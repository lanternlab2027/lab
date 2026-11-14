/* Group Chat Wrapped: stats. Pure functions over parsed messages; no network, no storage. */
(function (root) {
  'use strict';

  var STOP = ('a about above after again all also am an and any are aren as at be because been before being below between both but by can cant could couldnt did didnt do does doesnt doing dont down during each few for from further had hadnt has hasnt have havent having he hed hell hes her here heres hers herself him himself his how hows i id ill im ive if in into is isnt it its itself lets me more most mustnt my myself no nor not of off on once only or other ought our ours ourselves out over own same shant she shed shell shes should shouldnt so some such than that thats the their theirs them themselves then there theres these they theyd theyll theyre theyve this those through to too under until up very was wasnt we wed well were weve werent what whats when whens where wheres which while who whos whom why whys with wont would wouldnt you youd youll youre youve your yours yourself yourselves ' +
    'yeah yes yep yup nah nope okay ok okk kk just like get got gonna wanna gotta also really one will can know think thing things going go still even now yet much many well oh ohh hmm umm uh lol lmao lmfao haha hahaha hehe rofl xd omg idk tbh btw rn ya yea ye u ur r im its thats dont cant didnt doesnt isnt wasnt ive ill id youre theyre thats whats theres hes shes lets aint gotta need want make made say said last first next see way back time day today tomorrow tonight yesterday right good sure though thats cause cuz bc pls plz thanks thank thx ty would could should might must shall let put take come came went tell told ask asked look looks guys guy also every any anyone someone something anything nothing everything ' +
    'media omitted image video audio sticker deleted message edited null attached file document http https www com ' +
    'que de la el en los las un una por con para del se lo como pero mas mais der die das und ist ich nicht ein eine zu den mit auf les des est pas une pour qui dans sur').split(/\s+/);
  var STOPSET = {};
  STOP.forEach(function (w) { if (w) STOPSET[w] = 1; });

  var LAUGH_RE = /(?:^|[^\p{L}])(l+o+l+z?|lmf?a+o+|rofl|ha(?:ha)+h*|a?h(?:ah)+a?|he(?:he)+|ja(?:ja)+|jsjs+|kkkk+|xd+|haha)(?=$|[^\p{L}])/giu;
  var LAUGH_EMOJI_RE = /\u{1F602}|\u{1F923}|\u{1F639}/gu;
  var PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
  var EMOJI_FALLBACK = /(?:\p{Regional_Indicator}{2})|(?:\p{Extended_Pictographic}(?:\ufe0f|[\u{1F3FB}-\u{1F3FF}])?(?:\u200d\p{Extended_Pictographic}(?:\ufe0f|[\u{1F3FB}-\u{1F3FF}])?)*)/gu;
  var segmenter = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

  function emojisIn(text) {
    var out = [];
    if (!text || !PICTO.test(text)) return out;
    if (segmenter) {
      var it = segmenter.segment(text);
      for (var seg of it) {
        var g = seg.segment;
        if (PICTO.test(g) && !/^[\u00a9\u00ae\u2122]$/.test(g)) out.push(g);
      }
    } else {
      var m = text.match(EMOJI_FALLBACK);
      if (m) out = m;
    }
    return out;
  }

  function emojiKey(e) { return e.replace(/\ufe0f/g, ''); }

  function wordsIn(text) {
    return text
      .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
      .replace(/@\S+/g, ' ')
      .toLowerCase()
      .split(/[^\p{L}\p{N}']+/u)
      .map(function (w) { return w.replace(/^'+|'+$/g, ''); })
      .filter(Boolean);
  }

  function laughsIn(text) {
    var n = 0;
    LAUGH_RE.lastIndex = 0;
    while (LAUGH_RE.exec(text)) n++;
    var e = text.match(LAUGH_EMOJI_RE);
    return n + (e ? e.length : 0);
  }

  function dayKey(m) { return m.y + '-' + (m.mo < 10 ? '0' : '') + m.mo + '-' + (m.d < 10 ? '0' : '') + m.d; }

  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var k = s.length >> 1;
    return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
  }

  function top(map, n) {
    return Object.keys(map).map(function (k) { return [k, map[k]]; })
      .sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); }).slice(0, n);
  }

  function years(messages) {
    var c = {};
    messages.forEach(function (m) { c[m.y] = (c[m.y] || 0) + 1; });
    return Object.keys(c).map(Number).sort().map(function (y) { return { year: y, count: c[y] }; });
  }

  function compute(allMessages, opts) {
    opts = opts || {};
    var msgs = opts.year ? allMessages.filter(function (m) { return m.y === opts.year; }) : allMessages.slice();
    var people = {};
    var hours = new Array(24).fill(0);
    var days = {};
    var wordFreq = {}, emojiFreq = {}, emojiShow = {};
    var total = 0, totalWords = 0, totalEmojis = 0, totalLaughs = 0, totalMedia = 0, totalText = 0;
    var nameTokens = {};
    var START_GAP = 4 * 3600 * 1000, REPLY_WINDOW = 3 * 3600 * 1000;

    function person(name) {
      if (!people[name]) {
        people[name] = { name: name, count: 0, words: 0, textCount: 0, media: 0, deleted: 0, emojis: 0, emojiFreq: {}, laughs: 0, night: 0, early: 0, starts: 0, replyGaps: [], longest: null };
        wordsIn(name).forEach(function (w) { nameTokens[w] = 1; });
      }
      return people[name];
    }

    var prev = null;
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      var p = person(m.sender);
      p.count++; total++;
      hours[m.h]++;
      if (m.h >= 0 && m.h < 5) p.night++;
      if (m.h >= 5 && m.h < 9) p.early++;
      var dk = dayKey(m);
      var day = days[dk] || (days[dk] = { key: dk, y: m.y, mo: m.mo, d: m.d, count: 0, by: {} });
      day.count++; day.by[m.sender] = (day.by[m.sender] || 0) + 1;

      if (!prev || m.t - prev.t >= START_GAP) p.starts++;
      if (prev && prev.sender !== m.sender && m.t - prev.t >= 0 && m.t - prev.t <= REPLY_WINDOW) p.replyGaps.push((m.t - prev.t) / 1000);
      prev = m;

      if (m.kind === 'media') { p.media++; totalMedia++; continue; }
      if (m.kind === 'deleted') { p.deleted++; continue; }
      p.textCount++; totalText++;
      var ws = wordsIn(m.text);
      p.words += ws.length; totalWords += ws.length;
      if (!p.longest || ws.length > p.longest.words) p.longest = { words: ws.length, chars: m.text.length, y: m.y, mo: m.mo, d: m.d };
      ws.forEach(function (w) {
        if (w.length < 3 || STOPSET[w] || /^\d+$/.test(w)) return;
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      });
      var es = emojisIn(m.text);
      es.forEach(function (e) {
        var k = emojiKey(e);
        if (!emojiShow[k]) emojiShow[k] = e;
        emojiFreq[k] = (emojiFreq[k] || 0) + 1;
        p.emojiFreq[k] = (p.emojiFreq[k] || 0) + 1;
      });
      p.emojis += es.length; totalEmojis += es.length;
      var l = laughsIn(m.text);
      p.laughs += l; totalLaughs += l;
    }

    // Never surface members' own names as "top words" (they would leak when names are hidden).
    Object.keys(nameTokens).forEach(function (w) { delete wordFreq[w]; });

    var list = Object.keys(people).map(function (k) { return people[k]; });
    list.forEach(function (p) {
      p.share = total ? p.count / total : 0;
      p.medianReply = p.replyGaps.length ? median(p.replyGaps) : null;
      p.meanReply = p.replyGaps.length ? p.replyGaps.reduce(function (x, y) { return x + y; }, 0) / p.replyGaps.length : null;
      p.avgWords = p.textCount ? p.words / p.textCount : 0;
      p.topEmojis = top(p.emojiFreq, 3).map(function (e) { return emojiShow[e[0]]; });
    });
    var ranked = list.slice().sort(function (a, b) { return b.count - a.count || (a.name < b.name ? -1 : 1); });
    var dayList = Object.keys(days).map(function (k) { return days[k]; }).sort(function (a, b) { return a.key < b.key ? -1 : 1; });
    var first = msgs[0], last = msgs[msgs.length - 1];
    var spanDays = first ? Math.max(1, Math.round((new Date(last.y, last.mo - 1, last.d) - new Date(first.y, first.mo - 1, first.d)) / 864e5) + 1) : 0;

    function best(arr, score, ok) {
      var b = null, bs = -Infinity;
      arr.forEach(function (p) { if (ok && !ok(p)) return; var s = score(p); if (s > bs) { bs = s; b = p; } });
      return b;
    }

    var awards = {};
    awards.yapper = ranked[0] || null;
    awards.ghost = ranked.length >= 3 ? ranked[ranked.length - 1] : null;
    awards.nightOwl = best(list, function (p) { return p.night + p.night / Math.max(1, p.count); }, function (p) { return p.night > 0; });
    awards.earlyBird = best(list, function (p) { return p.early + p.early / Math.max(1, p.count); }, function (p) { return p.early > 0; });
    awards.emoji = best(list, function (p) { return p.emojis; }, function (p) { return p.emojis > 0; });
    awards.laugh = best(list, function (p) { return p.laughs; }, function (p) { return p.laughs > 0; });
    var minReplies = Math.max(3, Math.min(10, Math.round(total * 0.01)));
    awards.fastest = best(list, function (p) { return -(p.medianReply + p.meanReply / 1e4); }, function (p) { return p.replyGaps.length >= minReplies; });
    awards.essay = best(list, function (p) { return p.longest ? p.longest.words : 0; }, function (p) { return p.longest && p.longest.words > 0; });
    awards.starter = best(list, function (p) { return p.starts; }, function (p) { return p.starts > 0; });
    if (awards.starter && list.length < 2) awards.starter = null;

    var busiest = dayList.slice().sort(function (a, b) { return b.count - a.count || (a.key < b.key ? -1 : 1); })[0] || null;
    if (busiest) busiest.mvp = top(busiest.by, 1)[0];

    var allReplies = [];
    list.forEach(function (p) { allReplies = allReplies.concat(p.replyGaps); });
    var peakHour = hours.indexOf(Math.max.apply(null, hours));

    var metrics = {
      perDay: total / Math.max(1, spanDays),
      activeDays: dayList.length,
      laughsPer100: totalText ? totalLaughs / totalText * 100 : 0,
      emojisPer100: totalText ? totalEmojis / totalText * 100 : 0,
      avgWords: totalText ? totalWords / totalText : 0,
      mediaShare: total ? totalMedia / total : 0,
      nightShare: total ? (hours[0] + hours[1] + hours[2] + hours[3] + hours[4]) / total : 0,
      medianReply: median(allReplies),
      peakHour: peakHour
    };

    return {
      total: total, totalWords: totalWords, totalEmojis: totalEmojis, totalLaughs: totalLaughs, totalMedia: totalMedia,
      members: ranked, memberCount: ranked.length,
      first: first || null, last: last || null, spanDays: spanDays,
      hours: hours, days: dayList, busiest: busiest,
      topWords: top(wordFreq, 5),
      topEmojis: top(emojiFreq, 5).map(function (e) { return [emojiShow[e[0]], e[1]]; }),
      awards: awards, metrics: metrics, vibe: vibe(metrics, total),
      year: opts.year || null
    };
  }

  var VIBES = [
    { id: 'chaos', name: 'Certified Chaos', emoji: '\u{1F32A}\ufe0f', line: 'Fast, loud and constantly cracking up. Muting this chat was never an option.', score: function (m) { return Math.min(m.perDay / 60, m.laughsPer100 / 6); } },
    { id: 'comedy', name: 'The Comedy Club', emoji: '\u{1F602}', line: 'Nobody here can send a single message without someone losing it.', score: function (m) { return m.laughsPer100 / 8; } },
    { id: 'emoji', name: 'Emoji Overload', emoji: '\u{1FAE0}', line: 'Why use words when a tiny yellow face says it better?', score: function (m) { return m.emojisPer100 / 35; } },
    { id: 'night', name: 'Night Shift', emoji: '\u{1F319}', line: 'This group comes alive when everyone else is asleep.', score: function (m) { return Math.max(m.nightShare / 0.14, (m.peakHour >= 22 || m.peakHour <= 2) ? 1.05 : 0); } },
    { id: 'book', name: 'The Book Club', emoji: '\u{1F4DA}', line: 'Paragraphs. Plural. This group does not do short replies.', score: function (m) { return m.avgWords / 15; } },
    { id: 'meme', name: 'Meme Exchange', emoji: '\u{1F5BC}\ufe0f', line: 'Half photos, half reactions to photos. A visual people.', score: function (m) { return m.mediaShare / 0.2; } },
    { id: 'rapid', name: 'Rapid Fire', emoji: '\u26a1', line: 'Replies land before the typing bubble even shows up.', score: function (m) { return m.medianReply ? 75 / m.medianReply : 0; } },
    { id: 'slow', name: 'Slow & Steady', emoji: '\u{1F422}', line: 'Quiet, loyal and always there when it counts.', score: function (m) { return m.perDay > 0 ? 2.5 / m.perDay : 0; } }
  ];

  function vibe(metrics, total) {
    var bestV = null, bestS = 0;
    VIBES.forEach(function (v) { var s = v.score(metrics); if (s > bestS) { bestS = s; bestV = v; } });
    if (!bestV || bestS < 1 || total < 20) bestV = { id: 'good', name: 'Good Vibes Only', emoji: '\u2728', line: 'Balanced, chatty and fun. The group chat everyone wishes they were in.' };
    return { id: bestV.id, name: bestV.name, emoji: bestV.emoji, line: bestV.line };
  }

  var api = { compute: compute, years: years, emojisIn: emojisIn, wordsIn: wordsIn, laughsIn: laughsIn, median: median };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WrappedStats = api;
})(typeof self !== 'undefined' ? self : this);
