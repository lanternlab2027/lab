/* Dating Wrapped: export parser. Runs in the browser (and in Node for tests).
 *
 * Reads a Tinder data.json and/or a Hinge export (legacy matches.json, or the newer CSV tables)
 * and reduces them to anonymous numbers straight away. The output holds ONLY counts, day numbers
 * and hours: no message text, no names, no match ids, no photos, no profile fields. Message bodies
 * are only ever counted (array length / row count); they are never copied out of the input.
 *
 * Output: { sources: [Source], files: [{name, kind}] }
 * Source: {
 *   app: 'tinder' | 'hinge', format: 'tinder-json' | 'hinge-json' | 'hinge-csv',
 *   has: { opens, likes, passes, supers, matches, lmatch, sent, recv, hours, convos, opener },
 *   days: { <dayNumber>: [opens, likes, passes, supers, matches, lmatch, sent, recv] },
 *   hours: [[dayNumber, hour, kind]]   kind 0 = swipe/like, 1 = message
 *   convos: [[firstDay, sent, recv, first, matched]]   first: 1 you, 2 them, 0 unknown; matched 0/1
 * }
 * dayNumber = days since 1970-01-01 for the LOCAL calendar date (timestamps are converted to the
 * viewer's time zone; Tinder's Usage keys are already calendar dates and are used as-is).
 */
(function (root) {
  'use strict';

  var K = { opens: 0, likes: 1, passes: 2, supers: 3, matches: 4, lmatch: 5, sent: 6, recv: 7 };
  var KEYS = ['opens', 'likes', 'passes', 'supers', 'matches', 'lmatch', 'sent', 'recv'];

  function DatingError(msg) { var e = new Error(msg); e.name = 'DatingError'; return e; }

  // ---------- dates ----------
  function dayOf(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / 86400000); }

  // 'YYYY-MM-DD' (optionally followed by a time) -> day number, as a calendar date.
  function dayKey(s) {
    var m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
    var n = dayOf(y, mo, d), back = new Date(n * 86400000);
    if (back.getUTCMonth() + 1 !== mo) return null; // 2/30
    return n;
  }

  // Any timestamp the exports use -> epoch ms, or null.
  // Tinder: "Tue, 30 Nov 2021 05:08:21 GMT" or ISO. Hinge: "2021-03-15 14:23:11" or
  // "2021-03-15 14:23:11.123456+00:00" or ISO with Z. A timestamp without a zone is UTC.
  function parseTs(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? (v < 1e11 ? v * 1000 : v) : null;
    var s = String(v).trim();
    var m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(?:\.(\d+))?\s*(Z|[+-]\d{2}:?\d{2}|UTC|GMT)?$/i.exec(s);
    if (m) {
      var frac = m[3] ? '.' + (m[3] + '000').slice(0, 3) : '';
      var tz = m[4] ? m[4].toUpperCase() : 'Z';
      if (tz === 'UTC' || tz === 'GMT') tz = 'Z';
      if (/^[+-]\d{4}$/.test(tz)) tz = tz.slice(0, 3) + ':' + tz.slice(3);
      var t = Date.parse(m[1] + 'T' + (m[2].length === 5 ? m[2] + ':00' : m[2]) + frac + tz);
      return isNaN(t) ? null : t;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { var t0 = Date.parse(s + 'T12:00:00Z'); return isNaN(t0) ? null : t0; }
    if (/^\d{10,13}$/.test(s)) return parseTs(+s);
    var t2 = Date.parse(s);
    return isNaN(t2) ? null : t2;
  }

  // epoch ms -> { day, hour } in the viewer's local time zone.
  function local(ms) {
    var d = new Date(ms);
    var y = d.getFullYear();
    if (y < 2000 || y > 2100) return null;
    return { day: dayOf(y, d.getMonth() + 1, d.getDate()), hour: d.getHours() };
  }

  function newSource(app, format) {
    return { app: app, format: format, has: { opens: false, likes: false, passes: false, supers: false, matches: false, lmatch: false, sent: false, recv: false, hours: false, convos: false, opener: false }, days: {}, hours: [], convos: [] };
  }
  function bump(src, day, key, n) {
    if (day == null || !n) return;
    var row = src.days[day] || (src.days[day] = [0, 0, 0, 0, 0, 0, 0, 0]);
    row[K[key]] += n;
  }
  function num(v) {
    var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
    return isFinite(n) && n > 0 ? Math.round(n) : 0;
  }

  // ---------- Tinder data.json ----------
  function isTinder(o) {
    return o && typeof o === 'object' && !Array.isArray(o) && o.Usage && typeof o.Usage === 'object' &&
      ['app_opens', 'swipes_likes', 'swipes_passes', 'matches', 'messages_sent'].some(function (k) { return k in o.Usage; });
  }

  function parseTinder(o) {
    var src = newSource('tinder', 'tinder-json');
    var U = o.Usage;
    var map = { app_opens: ['opens'], swipes_likes: ['likes'], swipes_passes: ['passes'], superlikes: ['supers'], matches: ['matches', 'lmatch'], messages_sent: ['sent'], messages_received: ['recv'] };
    Object.keys(map).forEach(function (uk) {
      var series = U[uk];
      if (!series || typeof series !== 'object' || Array.isArray(series)) return;
      var any = false;
      Object.keys(series).forEach(function (k) {
        var d = dayKey(k);
        if (d == null) return;
        any = true;
        map[uk].forEach(function (key) { bump(src, d, key, num(series[k])); });
      });
      if (any || Object.keys(series).length === 0) map[uk].forEach(function (key) { src.has[key] = true; });
    });
    // Every Tinder match follows your own right swipe, so all matches count toward your match rate.
    // Messages: one entry per match, holding only the messages YOU sent. Count them; never read the text.
    var M = Array.isArray(o.Messages) ? o.Messages : [];
    M.forEach(function (match) {
      var msgs = match && Array.isArray(match.messages) ? match.messages : [];
      var first = null, n = 0;
      for (var i = 0; i < msgs.length; i++) {
        var t = parseTs(msgs[i] && msgs[i].sent_date);
        n++;
        if (t == null) continue;
        var l = local(t);
        if (!l) continue;
        src.hours.push([l.day, l.hour, 1]);
        if (first == null || l.day < first) first = l.day;
      }
      if (n && first != null) src.convos.push([first, n, 0, 0, 1]);
    });
    src.has.hours = src.hours.length > 0;
    src.has.convos = M.length > 0;
    if (!Object.keys(src.days).length && !src.convos.length) {
      throw DatingError('That Tinder file has no usage history in it. Tinder sometimes sends an empty file for a brand-new or recently reset account.');
    }
    return src;
  }

  // ---------- Hinge legacy JSON (matches.json) ----------
  var HINGE_KEYS = ['like', 'match', 'chats', 'block', 'we_met', 'voice_notes'];
  function isHingeMatches(o) {
    if (!Array.isArray(o)) return false;
    if (!o.length) return true;
    var hits = 0, n = Math.min(o.length, 50);
    for (var i = 0; i < n; i++) if (o[i] && typeof o[i] === 'object' && HINGE_KEYS.some(function (k) { return Array.isArray(o[i][k]); })) hits++;
    return hits >= Math.max(1, n * 0.6);
  }

  function parseHingeMatches(arr) {
    var src = newSource('hinge', 'hinge-json');
    src.has.likes = src.has.matches = src.has.lmatch = src.has.sent = src.has.convos = true;
    arr.forEach(function (th) {
      if (!th || typeof th !== 'object') return;
      var likes = Array.isArray(th.like) ? th.like : [], matches = Array.isArray(th.match) ? th.match : [];
      var chats = Array.isArray(th.chats) ? th.chats : [], voice = Array.isArray(th.voice_notes) ? th.voice_notes : [];
      var likeDay = null;
      likes.forEach(function (lk) {
        var t = parseTs(lk && lk.timestamp);
        if (t == null && lk && Array.isArray(lk.like) && lk.like[0]) t = parseTs(lk.like[0].timestamp);
        var l = t == null ? null : local(t);
        if (!l) return;
        bump(src, l.day, 'likes', 1);
        src.hours.push([l.day, l.hour, 0]);
        if (likeDay == null || l.day < likeDay) likeDay = l.day;
      });
      var matchDay = null;
      matches.forEach(function (mt) {
        var l = local(parseTs(mt && mt.timestamp) || NaN);
        if (!l) return;
        bump(src, l.day, 'matches', 1);
        if (matchDay == null || l.day < matchDay) matchDay = l.day;
      });
      // A match that follows your own like counts toward your match rate, on the day you liked.
      if (matchDay != null && likeDay != null) bump(src, likeDay, 'lmatch', 1);
      var first = null, sent = 0;
      chats.concat(voice).forEach(function (c) {
        sent++;
        var l = local(parseTs(c && c.timestamp) || NaN);
        if (!l) return;
        bump(src, l.day, 'sent', 1);
        src.hours.push([l.day, l.hour, 1]);
        if (first == null || l.day < first) first = l.day;
      });
      if (matchDay != null || sent) src.convos.push([matchDay != null ? matchDay : first, sent, 0, 0, matchDay != null ? 1 : 0]);
    });
    src.has.hours = src.hours.length > 0;
    return src;
  }

  // ---------- Hinge CSV tables (exports from about Oct 2026) ----------
  function parseCsv(text) {
    text = String(text).replace(/^\ufeff/, '');
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f); f = '';
        if (row.some(function (x) { return x !== ''; })) rows.push(row);
        row = [];
      } else f += c;
    }
    row.push(f);
    if (row.some(function (x) { return x !== ''; })) rows.push(row);
    return rows;
  }

  var CSV_TABLES = { match_likes: 'like', match_roses: 'rose', match_skips: 'skip', match_blocks: 'block', chat_message: 'msg', chat_voice_note: 'msg', user: 'user' };
  function csvTable(name) {
    var base = String(name || '').split(/[\\/]/).pop().toLowerCase().replace(/\.csv$/, '');
    return CSV_TABLES[base] ? base : null;
  }

  function parseHingeCsv(tables) {
    var src = newSource('hinge', 'hinge-csv');
    var convo = {}, order = [], anyRecv = false;
    Object.keys(tables).forEach(function (name) {
      var kind = CSV_TABLES[name];
      if (kind === 'user') return; // profile fields: never read
      var rows = parseCsv(tables[name]);
      if (!rows.length) return;
      var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
      var ti = head.indexOf('timestamp'), ai = head.indexOf('action'), mi = head.indexOf('match_id');
      if (ti < 0) throw DatingError('One of the Hinge files (' + name + '.csv) is missing its timestamp column, so it can\u2019t be read.');
      if (kind === 'like' || kind === 'rose') src.has.likes = true;
      if (kind === 'skip') src.has.passes = true;
      if (kind === 'msg') src.has.sent = src.has.convos = true;
      for (var r = 1; r < rows.length; r++) {
        var l = local(parseTs(rows[r][ti]) || NaN);
        if (!l) continue;
        if (kind === 'like') { bump(src, l.day, 'likes', 1); src.hours.push([l.day, l.hour, 0]); }
        else if (kind === 'rose') { bump(src, l.day, 'likes', 1); bump(src, l.day, 'supers', 1); src.hours.push([l.day, l.hour, 0]); }
        else if (kind === 'skip') { bump(src, l.day, 'passes', 1); src.hours.push([l.day, l.hour, 0]); }
        else if (kind === 'msg') {
          var dir = ai >= 0 ? String(rows[r][ai] || '').trim().toLowerCase() : 'sent';
          var mine = dir !== 'received';
          if (!mine) anyRecv = true;
          bump(src, l.day, mine ? 'sent' : 'recv', 1);
          if (mine) src.hours.push([l.day, l.hour, 1]);
          var id = mi >= 0 ? rows[r][mi] : '';
          if (id) {
            var t = parseTs(rows[r][ti]);
            var c = convo[id];
            if (!c) { c = convo[id] = { first: l.day, t: t, sent: 0, recv: 0, by: mine ? 1 : 2 }; order.push(c); }
            if (t < c.t) { c.t = t; c.first = l.day; c.by = mine ? 1 : 2; }
            if (mine) c.sent++; else c.recv++;
          }
        }
      }
    });
    // Only conversations, never ids, leave this function.
    order.forEach(function (c) { src.convos.push([c.first, c.sent, c.recv, anyRecv ? c.by : 0, 1]); });
    src.has.recv = anyRecv;
    src.has.opener = anyRecv && order.length > 0;
    src.has.supers = 'match_roses' in tables;
    src.has.hours = src.hours.length > 0;
    return src;
  }

  // ---------- entry point ----------
  // files: [{ name, text }] (already unzipped). Returns { sources, files }.
  function parseFiles(files) {
    var sources = [], seen = [], csv = {}, nonEmpty = 0, jsonErr = null, unknown = [];
    (files || []).forEach(function (f) {
      var name = String(f.name || ''), base = name.split(/[\\/]/).pop();
      var text = f.text == null ? '' : String(f.text);
      if (/^\s*$/.test(text)) { seen.push({ name: base, kind: 'empty' }); return; }
      nonEmpty++;
      var t = csvTable(name);
      if (t && /\.csv$/i.test(base)) { csv[t] = text; seen.push({ name: base, kind: 'hinge-csv' }); return; }
      if (/^\s*[[{]/.test(text)) {
        var o;
        try { o = JSON.parse(text); } catch (e) { jsonErr = base; return; }
        if (isTinder(o)) { sources.push(parseTinder(o)); seen.push({ name: base, kind: 'tinder' }); return; }
        if (/matches\.json$/i.test(base) || (Array.isArray(o) && o.length && isHingeMatches(o))) {
          if (isHingeMatches(o)) { sources.push(parseHingeMatches(o)); seen.push({ name: base, kind: 'hinge' }); return; }
        }
        seen.push({ name: base, kind: 'ignored' }); // user.json, prompts.json, media.json...: never read further
        return;
      }
      unknown.push(base);
      seen.push({ name: base, kind: 'ignored' });
    });
    var activity = ['match_likes', 'match_roses', 'match_skips', 'chat_message', 'chat_voice_note'].filter(function (k) { return k in csv; });
    if (activity.length) sources.push(parseHingeCsv(csv));

    if (!sources.length) {
      if (jsonErr) throw DatingError('Couldn\u2019t read ' + jsonErr + '. It looks cut off or damaged. Try downloading the export again.');
      if (!nonEmpty) throw DatingError('That file is empty.');
      if ('user' in csv) throw DatingError('That\u2019s the Hinge profile file. Upload the whole Hinge zip (or match_likes.csv, match_skips.csv and chat_message.csv) instead.');
      throw DatingError('That doesn\u2019t look like a Tinder or Hinge data export. Upload Tinder\u2019s data.json, Hinge\u2019s matches.json, or the zip either app emailed you.');
    }
    return { sources: sources, files: seen };
  }

  // Year list across sources: [{ year, active }] (active = days with any activity).
  function years(sources) {
    var by = {};
    sources.forEach(function (s) {
      Object.keys(s.days).forEach(function (d) {
        var row = s.days[d];
        if (!row.some(function (v) { return v > 0; })) return;
        var y = new Date(+d * 86400000).getUTCFullYear();
        by[y] = by[y] || {};
        by[y][d] = 1;
      });
      s.convos.forEach(function (c) { if (c[0] == null) return; var y = new Date(c[0] * 86400000).getUTCFullYear(); by[y] = by[y] || {}; by[y][c[0]] = 1; });
    });
    return Object.keys(by).map(function (y) { return { year: +y, active: Object.keys(by[y]).length }; }).sort(function (a, b) { return b.year - a.year; });
  }

  var api = { parseFiles: parseFiles, parseTs: parseTs, dayKey: dayKey, local: local, parseCsv: parseCsv, years: years, csvTable: csvTable, KEYS: KEYS, K: K, isTinder: isTinder, isHingeMatches: isHingeMatches };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DatingParser = api;
})(typeof self !== 'undefined' ? self : this);
