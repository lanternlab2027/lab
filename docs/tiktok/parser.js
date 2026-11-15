/* TikTok Wrapped: parser for the TikTok "Download your data" export (JSON or TXT).
 * Pure functions, no DOM. Runs in the browser and in Node tests.
 *
 * What we read (and nothing else):
 *   watch history  timestamps only (links are used only to drop exact duplicates)
 *   likes          timestamps only
 *   searches       timestamp + search term
 *   comments       timestamps only (comment text is never kept)
 *   shares         timestamps only
 *   logins         timestamps only (IP addresses and devices are never kept)
 * Direct messages are skipped: zip entries that hold messages are never opened, and the
 * messages branch of the JSON is deleted before anything walks the data.
 *
 * Export layouts seen in the wild (see bots/tiktok/NOTES.md for sources):
 *   2024+  "Your Activity" > "Watch History" > "VideoList" [{Date, Link}], "Likes and Favorites" > "Like List" > "ItemFavoriteList" [{date, link}] ...
 *   older  "Activity" > "Video Browsing History" > "VideoList" ...
 * Dates are UTC wall-clock "YYYY-MM-DD HH:MM:SS", sometimes with a trailing " UTC".
 */
(function (root) {
  'use strict';

  // ---------- dates ----------
  var DATE_RE = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(?:UTC|GMT|Z|\+00:?00)?\s*$/i;
  var DAY_RE = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/;

  // Returns milliseconds since the epoch (UTC), or NaN.
  function parseDate(v) {
    if (v == null) return NaN;
    if (typeof v === 'number') return v > 1e11 ? v : v * 1000;
    var s = String(v), m = DATE_RE.exec(s);
    if (!m) { m = DAY_RE.exec(s); if (m) m = [m[0], m[1], m[2], m[3], '12', '00', '00']; }
    if (!m) { if (/^\d{9,13}$/.test(s.trim())) return parseDate(+s.trim()); return NaN; }
    var y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], se = +(m[6] || 0);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 59) return NaN;
    var t = Date.UTC(y, mo - 1, d, h, mi, se);
    if (new Date(t).getUTCDate() !== d) return NaN; // 2026-02-30
    return t;
  }

  // ---------- time zones ----------
  // Offset of a zone at an instant, cached per half hour (all real-world transitions fall on half hours UTC).
  var fmtCache = {}, offCache = {};
  function zoneOffset(ms, tz) {
    if (!tz || tz === 'UTC') return 0;
    var key = tz + '|' + Math.floor(ms / 1800000);
    if (key in offCache) return offCache[key];
    var f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
    var p = {}; f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    var asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    var off = asUTC - Math.floor(ms / 1000) * 1000;
    offCache[key] = off;
    return off;
  }
  function validZone(tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; } }

  // Local calendar parts for an instant. `day` is days since 1970-01-01 in local time.
  function localParts(ms, tz) {
    var l = ms + zoneOffset(ms, tz), d = new Date(l);
    return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), day: Math.floor(l / 86400000), wd: (d.getUTCDay() + 6) % 7, local: l };
  }

  // ---------- TXT ----------
  // Blank-line separated blocks of "Label: value" lines. Continuation lines join the previous value.
  function parseTxtBlocks(text) {
    text = String(text || '').replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
    var out = [];
    text.split(/\n[ \t]*\n+/).forEach(function (raw) {
      var rec = {}, last = null, n = 0;
      raw.split('\n').forEach(function (line) {
        if (!line.trim()) return;
        var m = /^([^:\n]{1,60}?)::?\s?(.*)$/.exec(line);
        if (m && !/^https?$/i.test(m[1].trim())) { last = m[1].trim().toLowerCase().replace(/\s+/g, ' '); rec[last] = m[2].trim(); n++; }
        else if (last) rec[last] = (rec[last] + ' ' + line.trim()).trim();
      });
      if (n) out.push(rec);
    });
    return out;
  }

  // ---------- which file is which ----------
  // Paths (zip entries or uploaded names) -> section. 'dm' = never open.
  var DM_RE = /direct[ _-]?messages?|chat[ _-]?history|(^|\/)messages?(\/|\.txt$)|(^|\/)inbox(\/|$)/i;
  function classifyPath(path) {
    var p = String(path || '').replace(/\\/g, '/');
    var base = p.split('/').pop().toLowerCase().replace(/\.(txt|json)$/, '').replace(/[_-]+/g, ' ').trim();
    if (DM_RE.test(p)) return 'dm';
    if (/(^|\/)__macosx\//i.test(p) || /(^|\/)\./.test(p)) return 'skip';
    if (/\.json$/i.test(p)) return /user[ _-]?data|tiktok/i.test(base) ? 'json' : 'json?';
    if (!/\.txt$/i.test(p)) return 'skip';
    if (/^(watch history|browsing history|video browsing history)$/.test(base)) return 'watch';
    if (/^(like list|liked videos|likes)$/.test(base)) return 'likes';
    if (/^(searches|search history)$/.test(base)) return 'searches';
    if (/^comments?$/.test(base)) return 'comments';
    if (/^share history$/.test(base)) return 'shares';
    if (/^login history$/.test(base)) return 'logins';
    return 'txt?';
  }

  // Pick what to read from a list of zip paths. A JSON export wins over TXT files in the same zip.
  function pickEntries(paths) {
    var json = [], txt = [], maybe = [], skipped = { dm: 0 };
    paths.forEach(function (p) {
      var k = classifyPath(p);
      if (k === 'dm') skipped.dm++;
      else if (k === 'json') json.push({ path: p, kind: 'json' });
      else if (k === 'json?') maybe.push({ path: p, kind: 'json' });
      else if (k === 'txt?') maybe.push({ path: p, kind: 'txt' });
      else if (k !== 'skip') txt.push({ path: p, kind: k });
    });
    if (json.length) return { read: json.slice(0, 1), skipped: skipped };
    if (txt.length) return { read: txt.concat(maybe.filter(function (m) { return m.kind === 'txt'; })), skipped: skipped };
    return { read: maybe, skipped: skipped };
  }

  // ---------- JSON ----------
  function lc(k) { return String(k).toLowerCase().replace(/[\s_-]+/g, ''); }
  function field(rec, names) {
    for (var k in rec) { if (Object.prototype.hasOwnProperty.call(rec, k) && names.indexOf(lc(k)) >= 0) return rec[k]; }
    return undefined;
  }
  var DATE_KEYS = ['date', 'time', 'timestamp', 'creationtime', 'createtime'];
  var LINK_KEYS = ['link', 'videolink', 'url', 'originalposturl'];
  var TERM_KEYS = ['searchterm', 'term', 'content', 'query'];

  // List-key (lowercased) -> section. VideoList is watch history only under a watch/browsing parent.
  var LIST_SECTIONS = { itemfavoritelist: 'likes', searchlist: 'searches', commentslist: 'comments', sharehistorylist: 'shares', loginhistorylist: 'logins' };
  function isDmKey(k) { return /direct ?messages?|chat ?history|^messages?$|^inbox$/i.test(String(k)); }

  function walkJson(obj, sink, path) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    Object.keys(obj).forEach(function (k) {
      if (isDmKey(k)) return; // never descend into messages
      var v = obj[k], key = lc(k), parent = path[path.length - 1] || '';
      if (Array.isArray(v) || v === null) {
        var sec = null;
        if (key === 'videolist' && /watchhistory|browsinghistory/.test(parent)) sec = 'watch';
        else if (LIST_SECTIONS[key]) sec = LIST_SECTIONS[key];
        if (sec === 'comments' && /live/.test(path.join('/'))) sec = null;
        if (sec) { sink.found[sec] = true; if (v) v.forEach(function (r) { if (r && typeof r === 'object') sink.add(sec, r); }); }
        return;
      }
      if (typeof v === 'object') walkJson(v, sink, path.concat(key));
    });
  }

  function newSink() {
    var s = { watch: [], likes: [], searches: [], comments: [], shares: [], logins: [], found: {}, bad: 0, seen: {} };
    s.add = function (sec, rec) {
      var t = parseDate(field(rec, DATE_KEYS));
      if (!(t === t)) { s.bad++; return; }
      if (sec === 'searches') {
        var term = field(rec, TERM_KEYS);
        term = term == null ? '' : String(term).replace(/\s+/g, ' ').trim();
        var k1 = 's|' + t + '|' + term;
        if (s.seen[k1]) return; s.seen[k1] = 1;
        s.searches.push({ t: t, term: term });
        return;
      }
      var link = (sec === 'watch' || sec === 'likes' || sec === 'shares') ? String(field(rec, LINK_KEYS) || '') : '';
      var k2 = sec + '|' + t + '|' + link;
      if (s.seen[k2]) return; s.seen[k2] = 1;
      s[sec].push(t);
    };
    return s;
  }

  // Raw text of a user_data JSON -> sink. Messages branch is dropped right after parsing.
  function readJson(text, sink) {
    var data;
    try { data = JSON.parse(String(text).replace(/^\ufeff/, '')); } catch (e) { throw new Error('That JSON file couldn\u2019t be read. Upload the original user_data_tiktok.json (or the whole zip) without editing it.'); }
    if (data && typeof data === 'object') Object.keys(data).forEach(function (k) { if (isDmKey(k)) delete data[k]; });
    walkJson(data, sink, []);
    var layout = data && (data['Your Activity'] ? '2024+' : data.Activity ? 'legacy' : 'unknown');
    return layout;
  }

  // One TXT file -> sink. `kind` from classifyPath ('watch', 'likes', ...) or 'txt?' (decide by content).
  function readTxt(text, kind, sink) {
    var blocks = parseTxtBlocks(text);
    if (kind === 'txt?') {
      var hasTerm = blocks.some(function (b) { return 'search term' in b; });
      if (hasTerm) kind = 'searches';
      else return false; // an unnamed Date+Link file could be likes or favorites; don't guess
    }
    if (kind === 'dm') return false;
    sink.found[kind] = true;
    blocks.forEach(function (b) {
      var rec = {};
      for (var k in b) {
        if (k === 'search term') rec.SearchTerm = b[k];
        else if (k === 'date' || k === 'creation time' || k === 'time') rec.Date = b[k];
        else if (k === 'link' || k === 'video link' || k === 'url') rec.Link = b[k];
      }
      if (rec.Date) sink.add(kind, rec);
    });
    return true;
  }

  function finish(sink, meta) {
    var num = function (a, b) { return a - b; };
    ['watch', 'likes', 'comments', 'shares', 'logins'].forEach(function (k) { sink[k].sort(num); });
    sink.searches.sort(function (a, b) { return a.t - b.t; });
    var any = ['watch', 'likes', 'searches', 'comments', 'shares', 'logins'].some(function (k) { return sink.found[k]; });
    if (!any) throw new Error('This doesn\u2019t look like a TikTok data export. Upload the zip TikTok sent you, or the user_data_tiktok.json inside it.');
    if (!sink.watch.length) throw new Error(sink.found.watch ? 'Your export\u2019s watch history is empty, so there\u2019s nothing to wrap yet. TikTok sometimes leaves out the last day or two; if you just started using the account, try again later.' : 'We found your TikTok export, but no watch history in it. When you request it, choose \u201cAll data\u201d (or tick Activity / Watch history).');
    return {
      watch: sink.watch, likes: sink.likes, searches: sink.searches, comments: sink.comments, shares: sink.shares, logins: sink.logins,
      found: sink.found, badDates: sink.bad, format: meta.format, layout: meta.layout || '', skippedDm: meta.skippedDm || 0
    };
  }

  // files: [{ name, text }]. Each is a user_data JSON or a TXT section file. Messages files are ignored by name.
  function parseFiles(files, meta) {
    meta = meta || {};
    var sink = newSink(), fmt = {}, layout = '', dm = meta.skippedDm || 0;
    files.forEach(function (f) {
      var k = classifyPath(f.name);
      var looksJson = /^\s*[{[]/.test(String(f.text).slice(0, 200).replace(/^\ufeff/, ''));
      if (k === 'dm') { dm++; return; }
      if (!String(f.text || '').trim()) return;
      if (k === 'json' || k === 'json?' || looksJson) { layout = readJson(f.text, sink) || layout; fmt.json = 1; return; }
      if (k === 'skip') return;
      if (readTxt(f.text, k, sink)) fmt.txt = 1;
    });
    return finish(sink, { format: fmt.json && fmt.txt ? 'json+txt' : fmt.json ? 'json' : 'txt', layout: layout, skippedDm: dm });
  }

  function videoId(link) { var m = /\/video\/(\d+)/.exec(String(link || '')); return m ? m[1] : ''; }

  var api = { parseDate: parseDate, zoneOffset: zoneOffset, localParts: localParts, validZone: validZone, parseTxtBlocks: parseTxtBlocks, classifyPath: classifyPath, pickEntries: pickEntries, parseFiles: parseFiles, videoId: videoId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TikTokParser = api;
})(typeof self !== 'undefined' ? self : this);
