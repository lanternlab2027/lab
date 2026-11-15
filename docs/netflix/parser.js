/* Streaming Wrapped: Netflix viewing-history CSV parser. Pure functions; no network, no storage.
 *
 * Per-profile download (Account > Profiles > [profile] > Viewing activity > "Download all", usually saved as
 * NetflixViewingHistory.csv) has two columns:
 *   Title,Date
 *   "Show Name: Season 1: Episode Title","11/14/26"
 * Dates follow the account's locale: M/D/YY in the US, D/M/YY(YY) in the UK and elsewhere, D.M.YY in Germany.
 * Rows are newest first.
 *
 * Full data request (netflix.com/account/getmyinfo, a zip) has CONTENT_INTERACTION/ViewingActivity.csv:
 *   Profile Name, Start Time, Duration, Attributes, Title, Supplemental Video Type, Device Type, Bookmark,
 *   Latest Bookmark, Country
 * One row per play session; trailers and previews carry a Supplemental Video Type.
 *
 * Columns are found by name (several languages), or by content when the header is unknown or missing.
 */
(function (root) {
  'use strict';

  // ---------- CSV ----------
  function sniffDelimiter(text) {
    var line = '', q = false;
    for (var i = 0; i < text.length && i < 20000; i++) {
      var c = text[i];
      if (c === '"') q = !q;
      if (!q && (c === '\n' || c === '\r')) break;
      if (!q) line += c;
    }
    var best = ',', bestN = 0;
    [',', ';', '\t', '|'].forEach(function (d) { var n = line.split(d).length - 1; if (n > bestN) { bestN = n; best = d; } });
    return best;
  }

  function parseCSV(text, delim) {
    text = String(text || '').replace(/^\ufeff/, '');
    delim = delim || sniffDelimiter(text);
    var rows = [], row = [], field = '', i = 0, n = text.length, q = false;
    while (i < n) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && field.replace(/\s/g, '') === '') { q = true; field = ''; i++; continue; }
      if (c === delim) { row.push(field); field = ''; i++; continue; }
      if (c === '\r' || c === '\n') {
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
        i++; continue;
      }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
    return rows;
  }

  function clean(s) { return String(s == null ? '' : s).replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim(); }
  function normKey(h) { return clean(h).replace(/^"+|"+$/g, '').toLowerCase(); }

  // ---------- dates ----------
  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  var NUMERIC = /^(\d{1,2})([\/\-.])(\d{1,2})\2(\d{2}|\d{4})\.?(?:[ T,].*)?$/;

  function validDate(y, mo, d) {
    if (!(y >= 1990 && y <= 2999 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCMonth() !== mo - 1) return null; // e.g. 2/30
    return { y: y, mo: mo, d: d };
  }

  // order: 'mdy' or 'dmy', only used for the ambiguous a/b/yy form.
  function parseDate(s, order) {
    s = clean(s);
    if (!s) return null;
    var m;
    if ((m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[ T].*)?$/))) return validDate(+m[1], +m[2], +m[3]);
    if ((m = s.match(NUMERIC))) {
      var a = +m[1], b = +m[3], y = +m[4]; if (y < 100) y += 2000;
      var o = order || (m[2] === '.' ? 'dmy' : a > 12 ? 'dmy' : 'mdy');
      if (o === 'mdy' && a > 12) o = 'dmy';
      if (o === 'dmy' && b > 12) o = 'mdy';
      return o === 'dmy' ? validDate(y, b, a) : validDate(y, a, b);
    }
    var mon = function (w) { return MON[w.slice(0, 4).toLowerCase().replace(/\.$/, '')] || MON[w.slice(0, 3).toLowerCase()] || null; };
    if ((m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/)) && mon(m[1])) return validDate(+m[3], mon(m[1]), +m[2]);
    if ((m = s.match(/^(\d{1,2})\.?\s+([A-Za-z]{3,})\.?,?\s+(\d{2}|\d{4})$/)) && mon(m[2])) { var yy = +m[3]; return validDate(yy < 100 ? yy + 2000 : yy, mon(m[2]), +m[1]); }
    return null;
  }

  function dayNum(d) { return Math.round(Date.UTC(d.y, d.mo - 1, d.d) / 86400000); }
  function dateKey(d) { return d ? d.y * 10000 + d.mo * 100 + d.d : 0; }

  // Decide M/D vs D/M for the whole file. Unambiguous values decide it; otherwise the file's
  // newest-first ordering does (the right reading has fewer out-of-order neighbours).
  function detectOrder(strings) {
    var dm = 0, md = 0, dotted = 0, nums = [];
    strings.forEach(function (s) {
      var m = clean(s).match(NUMERIC);
      if (!m) return;
      nums.push(s);
      if (m[2] === '.') dotted++;
      if (+m[1] > 12 && +m[3] <= 12) dm++;
      if (+m[3] > 12 && +m[1] <= 12) md++;
    });
    if (!nums.length) return { order: 'iso', reason: 'iso' };
    if (dm && !md) return { order: 'dmy', reason: 'unambiguous' };
    if (md && !dm) return { order: 'mdy', reason: 'unambiguous' };
    if (dm && md) return { order: dm > md ? 'dmy' : 'mdy', reason: 'mixed' };
    if (dotted > nums.length / 2) return { order: 'dmy', reason: 'dotted' };
    function disorder(o) {
      var bad = 0, prev = null;
      nums.forEach(function (s) {
        var d = parseDate(s, o); if (!d) { bad += 2; return; }
        var k = dayNum(d);
        if (prev != null && k > prev) bad++;
        prev = k;
      });
      return bad;
    }
    var a = disorder('mdy'), b = disorder('dmy');
    return { order: b < a ? 'dmy' : 'mdy', reason: a === b ? 'default' : 'ordering' };
  }

  // ---------- titles ----------
  var NUMW = '(?:\\d+|[ivxlc]+|one|two|three|four|five|six|seven|eight|nine|ten|[a-z])';
  // Strong markers: a season-like segment that marks a series even with no episode name after it.
  var STRONG = new RegExp('^(?:(?:season|series|temporada|saison|staffel|stagione|seizoen|sezon|s\\u00e4song|s\\u00e6son|sesong|kausi|\\u00e9vad|sez\\u00f3na|temporadas)\\s*' + NUMW + '\\b.*|(?:limited series|limited collection|miniseries|mini-series|mini series|the complete series|docuseries|s\\u00e9rie limit\\u00e9e|serie limitada|miniserie|miniss\\u00e9rie|minis\\u00e9rie|miniserien?|serie limitata)\\b.*|specials|' + NUMW + '(?:st|nd|rd|th)? (?:season|series)\\b.*)$', 'i');
  // Weak markers: only mark a series when an episode name follows (so "Film: Part 2" stays a movie).
  var WEAK = new RegExp('^(?:part|parte|partie|teil|deel|volume|vol\\.|book|chapter|collection|batch|cycle|act|arc)\\s*' + NUMW + '\\b.*$', 'i');
  var EPISODE = /^(?:episode|ep\.?|\u00e9pisode|episodio|epis\u00f3dio|folge|aflevering|odcinek|avsnitt|jakso|afsnit|episod|epizoda|b\u00f6l\u00fcm)\s*\d+\b.*$/i;

  function splitSegs(t) { return t.split(/\s*:\s+/).map(clean).filter(Boolean); }

  // Structural parse of one title, before looking at the rest of the file.
  function parseTitle(raw) {
    var t = clean(raw);
    var segs = splitSegs(t);
    for (var i = 1; i < segs.length; i++) {
      var s = segs[i], rest = segs.slice(i + 1).join(': ');
      if (s.length <= 48 && (STRONG.test(s) || (WEAK.test(s) && rest))) {
        return { title: t, show: segs.slice(0, i).join(': '), season: s, episode: rest, kind: 'series', marker: true };
      }
      if (EPISODE.test(s)) return { title: t, show: segs.slice(0, i).join(': '), season: '', episode: segs.slice(i).join(': '), kind: 'series', marker: true };
    }
    return { title: t, show: t, season: '', episode: '', kind: 'movie', marker: false, segs: segs };
  }

  // Whole-file pass: titles with no season marker become episodes when their prefix is a known show,
  // or when two or more different titles share the same prefix ("Docuseries: Episode Name").
  function classify(parsed) {
    var known = {}, prefixTitles = {};
    parsed.forEach(function (p) { if (p.marker) known[p.show.toLowerCase()] = p.show; });
    parsed.forEach(function (p) {
      if (p.marker || !p.segs || p.segs.length < 2) return;
      for (var k = 1; k < p.segs.length; k++) {
        var pre = p.segs.slice(0, k).join(': ').toLowerCase();
        (prefixTitles[pre] = prefixTitles[pre] || {})[p.title.toLowerCase()] = 1;
      }
    });
    parsed.forEach(function (p) {
      if (p.marker || !p.segs || p.segs.length < 2) return;
      var k, pre;
      for (k = p.segs.length - 1; k >= 1; k--) {
        pre = p.segs.slice(0, k).join(': ');
        if (known[pre.toLowerCase()]) { setSeries(p, known[pre.toLowerCase()], k); return; }
      }
      for (k = 1; k < p.segs.length; k++) {
        pre = p.segs.slice(0, k).join(': ');
        if (Object.keys(prefixTitles[pre.toLowerCase()] || {}).length >= 2) { setSeries(p, pre, k); return; }
      }
    });
    // Same show, different capitalisation: use the most common spelling.
    var spell = {};
    parsed.forEach(function (p) { var l = p.show.toLowerCase(); (spell[l] = spell[l] || {})[p.show] = (spell[l][p.show] || 0) + 1; });
    parsed.forEach(function (p) {
      var c = spell[p.show.toLowerCase()];
      p.show = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0];
      delete p.segs;
    });
    return parsed;
  }
  function setSeries(p, show, k) { p.show = show; p.kind = 'series'; p.season = ''; p.episode = p.segs.slice(k).join(': '); }

  // ---------- columns ----------
  var TITLE_KEYS = ['title', 'titel', 'titre', 't\u00edtulo', 'titulo', 'titolo', 'tytu\u0142', 'n\u00e1zev', 'otsikko', 'nimi', 'naam', 'name'];
  var DATE_KEYS = ['date', 'datum', 'fecha', 'data', 'date de visionnage', 'p\u00e4iv\u00e4m\u00e4\u00e4r\u00e4', 'tarih', 'start time', 'watched', 'date watched'];

  function looksDate(s) { s = clean(s); return !!(s && (NUMERIC.test(s) || /^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}/.test(s) || parseDate(s))); }

  function findColumns(rows) {
    var header = rows[0].map(normKey), ti = -1, di = -1;
    TITLE_KEYS.some(function (k) { ti = header.indexOf(k); return ti >= 0; });
    DATE_KEYS.some(function (k) { di = header.indexOf(k); return di >= 0; });
    var hasHeader = ti >= 0 && di >= 0;
    if (!hasHeader) {
      // Unknown header (other language) or none at all: choose by content.
      var sample = rows.slice(1, 400), width = Math.max.apply(null, rows.slice(0, 50).map(function (r) { return r.length; }));
      var dateFrac = [], textFrac = [];
      for (var c = 0; c < width; c++) {
        var dn = 0, tn = 0, n = 0;
        sample.forEach(function (r) { var v = clean(r[c]); if (!v) return; n++; if (looksDate(v)) dn++; else if (/[A-Za-z\u00c0-\uffff]/.test(v)) tn++; });
        dateFrac.push(n ? dn / n : 0); textFrac.push(n ? tn / n : 0);
      }
      di = dateFrac.indexOf(Math.max.apply(null, dateFrac));
      ti = -1; var best = 0;
      textFrac.forEach(function (f, i) { if (i !== di && f > best) { best = f; ti = i; } });
      if (!(dateFrac[di] >= 0.8 && best >= 0.6)) return null;
      hasHeader = !(looksDate(rows[0][di]));
    }
    return {
      title: ti, date: di, hasHeader: hasHeader,
      profile: header.indexOf('profile name'), duration: header.indexOf('duration'),
      supplemental: header.indexOf('supplemental video type'), archive: header.indexOf('start time') === di && hasHeader
    };
  }

  function durationSec(s) {
    var m = clean(s).match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
    return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null;
  }

  var NOT_EXPORT = 'This doesn\u2019t look like a Netflix viewing history. Upload the .csv you get from Viewing activity > Download all (usually NetflixViewingHistory.csv).';

  function parseAny(text, filename) {
    var rows = parseCSV(text);
    if (!rows.length) throw new Error(NOT_EXPORT);
    var cols = findColumns(rows);
    if (!cols) throw new Error(NOT_EXPORT);
    var body = cols.hasHeader ? rows.slice(1) : rows;
    var order = detectOrder(body.map(function (r) { return r[cols.date] || ''; }));
    var raw = [], skipped = 0, extras = 0, seen = {};
    body.forEach(function (r, idx) {
      var title = clean(r[cols.title]);
      var date = parseDate(r[cols.date], order.order === 'iso' ? null : order.order);
      if (!title || !date) { skipped++; return; }
      if (cols.supplemental >= 0 && clean(r[cols.supplemental])) { extras++; return; } // trailers, previews
      if (cols.duration >= 0) { var sec = durationSec(r[cols.duration]); if (sec != null && sec < 120) { extras++; return; } }
      var profile = cols.profile >= 0 ? clean(r[cols.profile]) : '';
      var dupe = profile + '\u0001' + title.toLowerCase() + '\u0001' + dateKey(date);
      if (seen[dupe]) return; // several sessions of the same title on the same day count once
      seen[dupe] = 1;
      var p = parseTitle(title);
      p.date = date; p.day = dayNum(date); p.idx = idx; p.profile = profile;
      raw.push(p);
    });
    if (!raw.length) throw new Error(skipped && !extras ? NOT_EXPORT : 'We found the Netflix columns but nothing watched in that file. Is this profile\u2019s viewing activity empty?');
    var entries = classify(raw);
    var profiles = {};
    entries.forEach(function (e) { if (e.profile) profiles[e.profile] = (profiles[e.profile] || 0) + 1; });
    return {
      source: cols.archive ? 'archive' : 'simple', entries: entries, skipped: skipped, extras: extras,
      dateOrder: order.order, orderReason: order.reason,
      profiles: Object.keys(profiles).sort(function (a, b) { return profiles[b] - profiles[a]; }).map(function (k) { return { name: k, count: profiles[k] }; }),
      filename: filename || ''
    };
  }

  var api = { parseCSV: parseCSV, parseAny: parseAny, parseDate: parseDate, parseTitle: parseTitle, classify: classify, detectOrder: detectOrder, dayNum: dayNum, dateKey: dateKey, NOT_EXPORT: NOT_EXPORT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NetflixParser = api;
})(typeof self !== 'undefined' ? self : this);
