/* Reading Wrapped: Goodreads + StoryGraph CSV and Libby timeline (CSV/JSON) parser. Pure functions; no network, no storage.
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

  // ---------- Libby (OverDrive) timeline ----------
  // Libby's timeline is a log of events, not a shelf: one row per Borrowed / Returned / Placed on hold.
  // Spreadsheet export (libbytimeline-activities.csv), columns per open-source parsers:
  //   Cover, Title, Author, Publisher, ISBN, Timestamp, Activity, Details, Library
  // Data export (JSON): { version: 1, timeline: [ { cover: { url, title, color, format }, title: { text, url, titleId },
  //   author, publisher, isbn, timestamp (epoch ms), activity, details (" 21 days "), library: { text, url, key } } ] }
  // A single-title "Reading Journey" export ({ readingJourney: {...}, circulation: [...] }) is accepted too.
  // There are no ratings, page counts or shelves. The heuristic (explained on the page):
  //   - a "Returned" (or any finished/completed marker) counts the book as read, dated by the latest one;
  //   - a borrow with no return that is still inside its loan period is "currently reading";
  //   - an older borrow with no return (the loan ran out, or the export only had borrows) is read-but-undated,
  //     dated by when the loan ended; it only counts if the reader ticks the box;
  //   - holds alone are "to-read"; magazines are counted as loans but never as books.
  var AUDIO_PUB = /audio|audible|recorded books|books on tape|blackstone|brilliance|tantor|podium|dreamscape|highbridge|oasis|listening library|naxos|w\.? ?f\.? howes|isis|bolinda|rbmedia|spoken|soundings/i;

  function libbyFormat(raw, publisher, details, author, isbn) {
    var f = clean(raw).toLowerCase();
    if (/magazine|periodical/.test(f)) return 'magazine';
    if (/audio/.test(f)) return 'audio';
    if (/book|epub|kindle|pdf|read/.test(f)) return 'ebook';
    if (/audiobook/i.test(details || '')) return 'audio';
    if (/magazine/i.test(details || '')) return 'magazine';
    // Magazines carry no ISBN and are credited to their publisher (or to no one).
    if (!f && !clean(isbn) && (!clean(author) || clean(author).toLowerCase() === clean(publisher).toLowerCase())) return 'magazine';
    // The spreadsheet has no format column: Libby only lends ebooks, audiobooks and magazines, so a
    // publisher that is an audio imprint means audiobook and anything else is read as an ebook.
    return AUDIO_PUB.test(publisher || '') ? 'audio' : 'ebook';
  }

  // Epoch ms/s, ISO (any zone -> the reader's local date), M/D/YY h:mm, "Feb 5, 2026 10:21 AM", etc.
  function libbyTime(v) {
    var dt = null;
    if (typeof v === 'number' || /^\s*\d{10,13}\s*$/.test(String(v))) {
      var n = +v; if (n < 1e12) n *= 1000; dt = new Date(n);
    } else {
      var s = clean(v);
      if (!s) return null;
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && /(Z|[+\-]\d{2}:?\d{2})$/.test(s)) dt = new Date(s);
      if (!dt || isNaN(dt)) {
        var tm = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/), hh = 0, mi = 0;
        if (tm) { hh = +tm[1] % 12 + (/p/i.test(tm[4] || '') ? 12 : 0); if (!tm[4]) hh = +tm[1]; mi = +tm[2]; }
        var ds = s.replace(/(?:,?\s+at)?,?\s*T?\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*([AaPp][Mm])?.*$/, '').replace(/^[A-Za-z]{3,9},\s+(?=[A-Za-z])/, '').trim();
        var d = parseDate(ds);
        if (!d || !d.mo) return null;
        return { date: { y: d.y, mo: d.mo, d: d.d || 1 }, t: new Date(d.y, d.mo - 1, d.d || 1, hh, mi).getTime() };
      }
    }
    if (!dt || isNaN(dt)) return null;
    return { date: { y: dt.getFullYear(), mo: dt.getMonth() + 1, d: dt.getDate() }, t: dt.getTime() };
  }

  function libbyKind(a) {
    a = clean(a).toLowerCase();
    if (/^borrow|checked out|^loan/.test(a)) return 'borrow';
    if (/^return/.test(a)) return 'return';
    if (/finish|complet|marked (as )?read/.test(a)) return 'finish';
    if (/hold/.test(a) && !/cancel/.test(a)) return 'hold';
    if (/expir/.test(a)) return 'expire';
    if (/renew/.test(a)) return 'renew';
    return 'other';
  }

  function txtOf(v) { return v && typeof v === 'object' ? (v.text || v.name || v.title || '') : (v == null ? '' : String(v)); }

  // Normalized events from either export shape.
  function libbyEventsFromJSON(data) {
    var list = Array.isArray(data) ? data : data && (data.timeline || data.activities || data.items);
    var journey = data && data.readingJourney;
    if (!list && journey && Array.isArray(data.circulation)) {
      list = data.circulation.map(function (c) {
        return { title: journey.title || (journey.cover && journey.cover.title), author: journey.author, publisher: journey.publisher, isbn: journey.isbn,
          cover: journey.cover, timestamp: c.timestamp, activity: c.activity, details: c.details, library: c.library };
      });
    }
    if (!Array.isArray(list)) return null;
    return list.filter(function (e) { return e && typeof e === 'object'; }).map(function (e) {
      var cover = e.cover && typeof e.cover === 'object' ? e.cover : {};
      return {
        title: txtOf(e.title) || cover.title || '', author: txtOf(e.author) || txtOf(e.creator), publisher: txtOf(e.publisher),
        isbn: txtOf(e.isbn), timestamp: e.timestamp, activity: txtOf(e.activity), details: txtOf(e.details),
        library: txtOf(e.library), format: txtOf(e.format) || cover.format || txtOf(e.type) || ''
      };
    });
  }

  function libbyEventsFromCSV(records) {
    return records.map(function (o) {
      return {
        title: get(o, ['title']), author: get(o, ['author', 'authors', 'creator']), publisher: get(o, ['publisher']),
        isbn: get(o, ['isbn']), timestamp: get(o, ['timestamp', 'date', 'time']), activity: get(o, ['activity', 'event']),
        details: get(o, ['details']), library: get(o, ['library']), format: get(o, ['format', 'type', 'media type'])
      };
    });
  }

  function libbyBooks(events, now) {
    now = now || new Date();
    var byKey = {}, order = [], skipped = 0;
    // Spreadsheet dates follow the phone's locale. If any "a/b/yyyy" has a > 12 and none has b > 12,
    // the whole file is day-first (UK/AU/NZ), so read "03/04/2026" as 3 April, not March 4.
    var SLASH = /^\s*(\d{1,2})([\/.\-])(\d{1,2})\2(\d{2,4})\b/, aBig = false, bBig = false;
    events.forEach(function (e) { var m = typeof e.timestamp === 'string' && SLASH.exec(e.timestamp); if (m) { if (+m[1] > 12) aBig = true; if (+m[3] > 12) bBig = true; } });
    var dayFirst = aBig && !bBig;
    events.forEach(function (e) {
      var ts = e.timestamp;
      if (dayFirst && typeof ts === 'string') ts = ts.replace(SLASH, function (all, a, sep, b, y) { return b + '/' + a + '/' + y; });
      var t = splitTitle(e.title), when = libbyTime(ts), kind = libbyKind(e.activity);
      if (!t.title || !when) { skipped++; return; }
      var author = clean(e.author).replace(/\s*;\s*.*$/, '');
      var key = (t.title + '|' + author).toLowerCase().replace(/[^a-z0-9|]+/g, ' ').trim();
      var b = byKey[key];
      if (!b) {
        b = byKey[key] = { title: t.title, series: t.series, author: author || 'Unknown author', events: [], fmt: {}, publisher: '' };
        order.push(key);
      }
      var fmt = libbyFormat(e.format, e.publisher, e.details, e.author, e.isbn);
      if (kind === 'borrow') b.fmt[fmt] = (b.fmt[fmt] || 0) + 1;
      if (!b.publisher) b.publisher = clean(e.publisher);
      var days = (clean(e.details).match(/(\d{1,3})\s*day/i) || [])[1];
      b.events.push({ kind: kind, date: when.date, t: when.t, library: clean(e.library), format: fmt, days: days ? +days : null });
    });
    var books = order.map(function (k) {
      var b = byKey[k], ev = b.events.sort(function (x, y) { return x.t - y.t; });
      var fmts = Object.keys(b.fmt).sort(function (x, y) { return b.fmt[y] - b.fmt[x]; });
      var format = fmts[0] || (ev[0] && ev[0].format) || 'ebook';
      var loans = ev.filter(function (e) { return e.kind === 'borrow'; }).map(function (e) { return { date: e.date, t: e.t, library: e.library, format: e.format }; });
      var holds = ev.filter(function (e) { return e.kind === 'hold'; }).map(function (e) { return { date: e.date, t: e.t, library: e.library }; });
      var ends = ev.filter(function (e) { return e.kind === 'return' || e.kind === 'finish'; });
      var lastBorrow = null; ev.forEach(function (e) { if (e.kind === 'borrow') lastBorrow = e; });
      var lastEnd = ends[ends.length - 1] || null;
      var shelf = 'to-read', reads = [], dateAdded = (ev[0] && ev[0].date) || null, lastRead = null;
      if (format === 'magazine') shelf = 'magazine';
      else if (lastEnd) { shelf = 'read'; reads = [lastEnd.date]; lastRead = lastEnd.date; }
      if (format !== 'magazine' && lastBorrow && (!lastEnd || lastBorrow.t > lastEnd.t)) {
        var expired = ev.filter(function (e) { return e.kind === 'expire' && e.t > lastBorrow.t; })[0];
        var renew = ev.filter(function (e) { return e.kind === 'renew' && e.t > lastBorrow.t; }).pop();
        var base = renew || lastBorrow;
        var due = expired ? expired.t : base.t + (base.days || lastBorrow.days || 21) * 864e5;
        if (!lastEnd && !expired && due >= now.getTime()) shelf = 'currently-reading';
        else if (!lastEnd) { shelf = 'read'; var dd = new Date(due); dateAdded = { y: dd.getFullYear(), mo: dd.getMonth() + 1, d: dd.getDate() }; }
        // a re-borrow after an earlier return stays read (dated by that return)
      }
      return {
        title: b.title, series: b.series, author: b.author,
        pages: null, myRating: null, avgRating: null,
        shelf: shelf, shelves: [], tags: [], moods: [], pace: '',
        format: format === 'magazine' ? '' : format, formatRaw: format, libbyFormat: format,
        reads: reads, lastRead: lastRead, dateAdded: dateAdded,
        readCount: reads.length, pubYear: null,
        publisher: b.publisher, loans: loans, holds: holds
      };
    });
    return { books: books, skipped: skipped };
  }

  function libbyResult(events, filename, now) {
    if (!events) return null;
    var r = libbyBooks(events, now);
    if (!r.books.length) throw new Error('We found a Libby timeline but no loans in it. If you filtered your timeline before exporting, clear the filter and export again.');
    return { source: 'libby', books: r.books, skipped: r.skipped, filename: filename || '' };
  }

  function parseAny(text, filename, opts) {
    opts = opts || {};
    var trimmed = String(text || '').replace(/^\ufeff/, '').trim();
    if (/^[\[{]/.test(trimmed)) {
      var data = null;
      try { data = JSON.parse(trimmed); } catch (e) { data = null; }
      var evs = data && libbyEventsFromJSON(data);
      if (evs) return libbyResult(evs, filename, opts.now);
      throw new Error('That JSON file doesn\u2019t look like a Libby timeline export. In Libby, open Shelf \u2192 Timeline \u2192 Actions \u2192 Export Timeline and upload the file it saves.');
    }
    var tb = table(text);
    var hh = {}; tb.header.forEach(function (k) { hh[k] = 1; });
    if (hh.activity && hh.timestamp && hh.title) return libbyResult(libbyEventsFromCSV(tb.records), filename, opts.now);
    var source = detect(tb.header);
    if (!source) throw new Error('This doesn\u2019t look like a Goodreads, StoryGraph or Libby export. Upload the file the site or app gives you (for Goodreads it\u2019s usually goodreads_library_export.csv; for Libby, libbytimeline-activities.csv).');
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

  var api = { parseCSV: parseCSV, parseAny: parseAny, libbyTime: libbyTime, libbyFormat: libbyFormat, libbyKind: libbyKind, parseDate: parseDate, datesIn: datesIn, splitTitle: splitTitle, normShelf: normShelf, detect: detect, dateKey: dateKey, formatKind: formatKind, DNF_RE: DNF_RE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReadingParser = api;
})(typeof self !== 'undefined' ? self : this);
