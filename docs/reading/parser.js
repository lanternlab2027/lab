/* Reading Wrapped: Goodreads + StoryGraph CSV parser. Pure functions; no network, no storage.
 *
 * Goodreads "Export Library" header (current, 24 columns):
 *   Book Id, Title, Author, Author l-f, Additional Authors, ISBN, ISBN13, My Rating, Average Rating, Publisher,
 *   Binding, Number of Pages, Year Published, Original Publication Year, Date Read, Date Added, Bookshelves,
 *   Bookshelves with positions, Exclusive Shelf, My Review, Spoiler, Private Notes, Read Count, Owned Copies
 * Older exports add Recommended For/By, Original Purchase Date/Location, Condition, BCID. ISBNs come as ="0123".
 *
 * StoryGraph "Export your data" header (23 columns):
 *   Title, Authors, Contributors, ISBN/UID, Format, Read Status, Date Added, Last Date Read, Dates Read, Read Count,
 *   Moods, Pace, Character- or Plot-Driven?, Strong Character Development?, Loveable Characters?, Diverse Characters?,
 *   Flawed Characters?, Star Rating, Review, Content Warnings, Content Warning Description, Tags, Owned?
 * No page counts, genres or community ratings. Star Rating is 0-5 in quarter steps. Dates Read holds periods
 * like 2026/01/03-2026/01/19, comma-separated for re-reads.
 *
 * Columns are found by name (case/space-insensitive), never by position, so reordered, missing or extra columns
 * and spreadsheet re-saves (semicolons, tabs, M/D/YYYY dates) still work.
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
      if (c === '"' && field.replace(/\s/g, '') === '' ) { q = true; field = ''; i++; continue; }
      if (c === '"' && /^=$/.test(field)) { q = true; field = '='; i++; continue; } // ="0123" in some re-saves
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

  function normKey(h) { return String(h || '').replace(/^\ufeff/, '').replace(/^"+|"+$/g, '').trim().toLowerCase().replace(/\s+/g, ' '); }

  function table(text) {
    var rows = parseCSV(text);
    if (!rows.length) return { header: [], records: [] };
    var header = rows[0].map(normKey);
    var records = rows.slice(1).map(function (r) {
      var o = {};
      header.forEach(function (h, i) { if (h && !(h in o && o[h] !== '')) o[h] = r[i] == null ? '' : r[i]; });
      return o;
    });
    return { header: header, records: records };
  }

  function get(o, names) {
    for (var i = 0; i < names.length; i++) {
      var v = o[names[i]];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  // ---------- fields ----------
  function clean(s) {
    s = String(s || '').replace(/^="?|"$/g, '').replace(/\s+/g, ' ').trim();
    return s === '""' ? '' : s;
  }

  function num(s) {
    s = clean(s).replace(/\s/g, '');
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, ''); // 1,104 or 1.104 (thousands)
    else s = s.replace(/,/g, '.'); // 4,21 (decimal comma)
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    return parseFloat(s);
  }

  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

  function validDate(y, mo, d) {
    if (!(y >= 1000 && y <= 2999)) return null;
    if (mo != null && !(mo >= 1 && mo <= 12)) return null;
    if (d != null && !(d >= 1 && d <= 31)) return null;
    return { y: y, mo: mo == null ? null : mo, d: d == null ? null : d };
  }

  // Accepts YYYY/MM/DD, YYYY-MM-DD(Thh:mm), YYYY/MM, YYYY, M/D/YYYY (spreadsheet re-save), D.M.YYYY, "Jan 5, 2026".
  function parseDate(s) {
    s = clean(s);
    if (!s || /^(not set|none|n\/a|-)$/i.test(s)) return null;
    var m;
    if ((m = s.match(/^(\d{4})[\/\-.](\d{1,2})(?:[\/\-.](\d{1,2}))?(?:[T\s].*)?$/))) return validDate(+m[1], +m[2], m[3] ? +m[3] : null);
    if ((m = s.match(/^(\d{4})$/))) return validDate(+m[1], null, null);
    if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})(?:\s.*)?$/))) {
      var a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000;
      var dotted = /\./.test(s);
      if (a > 12 || (dotted && b <= 12)) return validDate(y, b, a); // D/M/Y
      return validDate(y, a, b); // M/D/Y
    }
    var mon = function (w) { return MON[w.slice(0, 3).toLowerCase()] || null; };
    if ((m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/)) && mon(m[1])) return validDate(+m[3], mon(m[1]), +m[2]);
    if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{4})$/)) && mon(m[2])) return validDate(+m[3], mon(m[2]), +m[1]);
    if ((m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{4})$/)) && mon(m[1])) return validDate(+m[2], mon(m[1]), null);
    return null;
  }

  // Every date inside a free-form string (used for StoryGraph "Dates Read" periods).
  var DATE_TOKEN = /\d{4}([\/\-.])\d{1,2}\1\d{1,2}(?!\d)|\d{1,2}([\/.])\d{1,2}\2\d{4}|\d{4}[\/\-.]\d{1,2}(?![\/.]\d|\d)|\b\d{4}\b/g;
  function datesIn(s) {
    var out = [], m;
    s = clean(s);
    DATE_TOKEN.lastIndex = 0;
    while ((m = DATE_TOKEN.exec(s))) { var d = parseDate(m[0]); if (d) out.push(d); }
    return out;
  }

  function dateKey(d) { return d ? d.y * 10000 + (d.mo || 0) * 100 + (d.d || 0) : 0; }

  function splitTitle(t) {
    t = clean(t);
    var m = t.match(/^(.*\S)\s*\(([^()]*#\s*[\d.]+[^()]*)\)\s*$/);
    if (m) return { title: m[1], series: m[2].replace(/\s+/g, ' ') };
    return { title: t, series: '' };
  }

  function splitList(s) {
    return clean(s).split(/\s*[,;]\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  var DNF_RE = /^(dnf|did-?n[o']?t-?finish|did-not-finish|abandon|abandoned|gave-?up|unfinished|not-?finished|stopped-?reading|quit|never-?finished)/i;

  function normShelf(s) {
    s = clean(s).toLowerCase().replace(/\s+/g, '-');
    if (!s) return '';
    if (s === 'read' || s === 'finished') return 'read';
    if (s === 'currently-reading' || s === 'reading' || s === 'current') return 'currently-reading';
    if (s === 'to-read' || s === 'want-to-read' || s === 'tbr') return 'to-read';
    if (DNF_RE.test(s)) return 'dnf';
    if (s === 'paused' || s === 'on-hold') return 'paused';
    return s;
  }

  function audio(s) { return /audio|audible|mp3|cd\b/i.test(s); }
  function digital(s) { return /kindle|ebook|e-book|digital|nook|kobo|epub/i.test(s); }
  function formatKind(s) { s = clean(s); if (!s) return ''; return audio(s) ? 'audio' : digital(s) ? 'ebook' : 'print'; }

  // ---------- formats ----------
  function detect(header) {
    var h = {}; header.forEach(function (k) { h[k] = 1; });
    if (h['read status'] || h['isbn/uid'] || (h['star rating'] && h['authors'])) return 'storygraph';
    if (h['exclusive shelf'] || h['my rating'] || h['bookshelves'] || h['book id']) return 'goodreads';
    return null;
  }

  function goodreadsBook(o) {
    var t = splitTitle(get(o, ['title']));
    if (!t.title) return null;
    var shelf = normShelf(get(o, ['exclusive shelf']));
    var shelves = splitList(get(o, ['bookshelves'])).map(function (s) { return s.toLowerCase(); });
    var read = parseDate(get(o, ['date read']));
    if (!shelf) shelf = shelves.indexOf('read') >= 0 || read ? 'read' : shelves.indexOf('currently-reading') >= 0 ? 'currently-reading' : shelves.some(function (s) { return DNF_RE.test(s); }) ? 'dnf' : 'to-read';
    var rating = num(get(o, ['my rating']));
    var pages = num(get(o, ['number of pages', 'num pages', 'pages']));
    var rc = num(get(o, ['read count']));
    var avg = num(get(o, ['average rating']));
    var author = clean(get(o, ['author'])) || (function () { var lf = clean(get(o, ['author l-f'])); var p = lf.split(/\s*,\s*/); return p.length === 2 ? p[1] + ' ' + p[0] : lf; })();
    var pub = num(get(o, ['original publication year'])) || num(get(o, ['year published']));
    var binding = clean(get(o, ['binding']));
    return {
      title: t.title, series: t.series,
      author: author || 'Unknown author',
      pages: pages && pages > 0 && pages < 30000 ? Math.round(pages) : null,
      myRating: rating && rating > 0 && rating <= 5 ? rating : null,
      avgRating: avg && avg > 0 && avg <= 5 ? avg : null,
      shelf: shelf,
      shelves: shelves,
      tags: [], moods: [], pace: '',
      format: formatKind(binding), formatRaw: binding,
      reads: read && shelf === 'read' ? [read] : [],
      lastRead: read,
      dateAdded: parseDate(get(o, ['date added'])),
      readCount: rc != null && rc >= 0 ? Math.round(rc) : (shelf === 'read' ? 1 : 0),
      pubYear: pub && pub > 0 && pub < 3000 ? Math.round(pub) : null
    };
  }

  function storygraphBook(o) {
    var t = splitTitle(get(o, ['title']));
    if (!t.title) return null;
    var shelf = normShelf(get(o, ['read status']));
    if (!shelf) shelf = 'to-read';
    var authors = splitList(get(o, ['authors', 'author']));
    var periods = clean(get(o, ['dates read'])).split(/\s*,\s*(?=\d)|\s*;\s*|\s+and\s+/i).filter(Boolean);
    var reads = [];
    periods.forEach(function (p) { var ds = datesIn(p); if (ds.length) reads.push(ds[ds.length - 1]); });
    var last = parseDate(get(o, ['last date read']));
    if (last && !reads.some(function (d) { return dateKey(d) === dateKey(last); })) reads.push(last);
    reads.sort(function (a, b) { return dateKey(a) - dateKey(b); });
    var rc = num(get(o, ['read count']));
    var rating = num(get(o, ['star rating', 'my rating', 'rating']));
    var fmt = clean(get(o, ['format']));
    var pages = num(get(o, ['number of pages', 'pages', 'page count']));
    return {
      title: t.title, series: t.series,
      author: authors[0] || 'Unknown author',
      pages: pages && pages > 0 && pages < 30000 ? Math.round(pages) : null,
      myRating: rating && rating > 0 && rating <= 5 ? rating : null,
      avgRating: null,
      shelf: shelf,
      shelves: [],
      tags: splitList(get(o, ['tags'])).map(function (s) { return s.toLowerCase(); }),
      moods: splitList(get(o, ['moods'])).map(function (s) { return s.toLowerCase(); }),
      pace: clean(get(o, ['pace'])).toLowerCase(),
      format: formatKind(fmt), formatRaw: fmt,
      reads: shelf === 'read' ? reads : [],
      lastRead: reads.length ? reads[reads.length - 1] : last,
      dateAdded: parseDate(get(o, ['date added'])),
      readCount: rc != null && rc >= 0 ? Math.round(rc) : reads.length,
      pubYear: null
    };
  }

  function parseAny(text, filename) {
    var tb = table(text);
    var source = detect(tb.header);
    if (!source) throw new Error('This doesn\u2019t look like a Goodreads or StoryGraph export. Upload the .csv file the site gives you (for Goodreads it\u2019s usually goodreads_library_export.csv).');
    var mk = source === 'goodreads' ? goodreadsBook : storygraphBook;
    var books = [], skipped = 0;
    tb.records.forEach(function (o) {
      var b = null;
      try { b = mk(o); } catch (e) { b = null; }
      if (b) books.push(b); else skipped++;
    });
    if (!books.length) throw new Error('We found the ' + (source === 'goodreads' ? 'Goodreads' : 'StoryGraph') + ' columns but no books in that file. Is your library empty?');
    return { source: source, books: books, skipped: skipped, filename: filename || '' };
  }

  var api = { parseCSV: parseCSV, parseAny: parseAny, parseDate: parseDate, datesIn: datesIn, splitTitle: splitTitle, normShelf: normShelf, detect: detect, dateKey: dateKey, formatKind: formatKind, DNF_RE: DNF_RE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReadingParser = api;
})(typeof self !== 'undefined' ? self : this);
