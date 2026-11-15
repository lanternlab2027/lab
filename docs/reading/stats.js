/* Reading Wrapped: stats. Pure functions over parsed books; no network, no storage. */
(function (root) {
  'use strict';

  // Shelves that describe status, format, ownership or challenges rather than what the book is about.
  var NOT_GENRE = /^(read|currently-reading|to-read|tbr|want-to-read|dnf|did-not-finish|paused|on-hold|favou?rites?|faves?|all-time-favou?rites?|owned|own|owned-books|my-books|my-library|books|library|library-books?|borrowed|kindle|kindle-unlimited|ku|ebooks?|e-books?|audio|audiobooks?|audible|libby|hoopla|physical|hardcover|paperback|wishlist|wish-list|arc|arcs|netgalley|signed|gift|gifted|book-?club|re-?reads?|re-?read|series|standalone|default|unread|maybe|abandoned|5-stars?|five-stars?|4-stars?)$/;
  var DNF_RE = /^(dnf|did-?n[o']?t-?finish|abandon|gave-?up|unfinished|not-?finished|stopped-?reading|quit|never-?finished)/;

  function isGenre(s) {
    if (!s || NOT_GENRE.test(s) || DNF_RE.test(s)) return false;
    if (/\d{4}/.test(s) || /challenge|readathon|read-in|tbr|owned|kindle|audible|library|wishlist/.test(s)) return false;
    return true;
  }

  var SPECIAL = { 'sci-fi': 'Sci-fi', 'scifi': 'Sci-fi', 'sf': 'Sci-fi', 'ya': 'YA', 'young-adult': 'Young adult', 'non-fiction': 'Nonfiction', 'nonfiction': 'Nonfiction', 'self-help': 'Self-help', 'lgbtq': 'LGBTQ+', 'lgbtq+': 'LGBTQ+', 'lgbt': 'LGBTQ+', 'mg': 'Middle grade', 'sff': 'SFF', 'romantasy': 'Romantasy' };
  function prettyShelf(s) {
    s = String(s || '').toLowerCase();
    if (SPECIAL[s]) return SPECIAL[s];
    var t = s.replace(/[-_]+/g, ' ').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function dkey(d) { return d ? d.y * 10000 + (d.mo || 0) * 100 + (d.d || 0) : 0; }
  function inPeriod(d, year) { return !!d && (year == null || d.y === year); }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; }
  function top(map, n) { return Object.keys(map).map(function (k) { return [k, map[k]]; }).sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); }).slice(0, n); }
  function authorKey(a) { return String(a || '').toLowerCase().replace(/[.\s]+/g, ' ').trim(); }

  // The finish dates that count for a book. "undated" lets read books with no finish date fall back to Date Added.
  function finishes(b, undated) {
    if (b.shelf !== 'read') return [];
    if (b.reads.length) return b.reads;
    if (undated && b.dateAdded) return [b.dateAdded];
    return [];
  }

  function years(books, undated) {
    var c = {};
    books.forEach(function (b) {
      var seen = {};
      finishes(b, undated).forEach(function (d) { if (!seen[d.y]) { seen[d.y] = 1; c[d.y] = (c[d.y] || 0) + 1; } });
    });
    return Object.keys(c).map(function (y) { return { year: +y, count: c[y] }; }).sort(function (a, b) { return a.year - b.year; });
  }

  function compute(books, opts) {
    opts = opts || {};
    var year = opts.year == null ? null : +opts.year;
    var undated = !!opts.undated;
    var now = opts.now || new Date();
    var source = opts.source || 'goodreads';

    var fin = []; // one entry per (book, finish in period)
    books.forEach(function (b) {
      finishes(b, undated).forEach(function (d) { if (inPeriod(d, year)) fin.push({ book: b, date: d }); });
    });
    fin.sort(function (a, b) { return dkey(a.date) - dkey(b.date); });
    var list = [], seenB = new Set();
    fin.forEach(function (f) { if (!seenB.has(f.book)) { seenB.add(f.book); list.push(f.book); } });
    var lastFinish = new Map(); fin.forEach(function (f) { lastFinish.set(f.book, f.date); });

    var count = list.length;
    var undatedCount = books.filter(function (b) { return b.shelf === 'read' && !b.reads.length; }).length;

    // pages
    var withPages = list.filter(function (b) { return b.pages; });
    var pages = withPages.reduce(function (s, b) { return s + b.pages; }, 0);
    var byLen = withPages.slice().sort(function (a, b) { return b.pages - a.pages || (a.title < b.title ? -1 : 1); });
    var longest = byLen[0] || null, shortest = byLen.length > 1 ? byLen[byLen.length - 1] : null;
    var periodDays;
    if (year == null) {
      var f0 = fin[0], fl = fin[fin.length - 1];
      periodDays = f0 ? Math.max(1, Math.round((new Date(fl.date.y, (fl.date.mo || 12) - 1, fl.date.d || 28) - new Date(f0.date.y, (f0.date.mo || 1) - 1, f0.date.d || 1)) / 864e5) + 1) : 1;
    } else if (year === now.getFullYear()) {
      periodDays = Math.max(1, Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(year, 0, 1)) / 864e5) + 1);
    } else {
      periodDays = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
    }

    // months (or years, for all time)
    var months = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], monthBooks = [[], [], [], [], [], [], [], [], [], [], [], []], undatedMonth = 0;
    var byYear = {};
    fin.forEach(function (f) {
      if (f.date.mo) { months[f.date.mo - 1]++; monthBooks[f.date.mo - 1].push(f.book); } else undatedMonth++;
      byYear[f.date.y] = (byYear[f.date.y] || 0) + 1;
    });
    var peakMonth = months.indexOf(Math.max.apply(null, months));
    var activeMonths = months.filter(function (v) { return v > 0; }).length;

    // ratings
    var rated = list.filter(function (b) { return b.myRating; });
    var topRated = rated.slice().sort(function (a, b) {
      return b.myRating - a.myRating ||
        ((b.avgRating ? b.myRating - b.avgRating : 0) - (a.avgRating ? a.myRating - a.avgRating : 0)) ||
        dkey(lastFinish.get(b)) - dkey(lastFinish.get(a));
    })[0] || null;
    var fiveStars = rated.filter(function (b) { return b.myRating >= 5; }).length;
    var dist = [0, 0, 0, 0, 0];
    rated.forEach(function (b) { dist[Math.min(4, Math.max(0, Math.round(b.myRating) - 1))]++; });
    var myAvg = mean(rated.map(function (b) { return b.myRating; }));
    var both = rated.filter(function (b) { return b.avgRating; });
    var critic = null;
    if (both.length >= 3) {
      var ma = mean(both.map(function (b) { return b.myRating; })), ga = mean(both.map(function (b) { return b.avgRating; }));
      var diff = ma - ga;
      var biggest = both.slice().sort(function (a, b) { return Math.abs(b.myRating - b.avgRating) - Math.abs(a.myRating - a.avgRating); })[0];
      critic = {
        n: both.length, mine: ma, theirs: ga, diff: diff,
        kind: diff <= -0.3 ? 'harsh' : diff >= 0.3 ? 'easy' : 'fair',
        label: diff <= -0.3 ? 'Harsh critic' : diff >= 0.3 ? 'Easy grader' : 'Fair judge',
        outlier: biggest
      };
    }

    // authors
    var auth = {}, authName = {}, authTitles = {};
    list.forEach(function (b) {
      var k = authorKey(b.author); if (!k || k === 'unknown author') return;
      auth[k] = (auth[k] || 0) + 1; authName[k] = authName[k] || b.author;
      (authTitles[k] = authTitles[k] || []).push(b.title);
    });
    var ta = top(auth, 5);
    var topAuthor = ta.length && ta[0][1] >= 2 ? { name: authName[ta[0][0]], count: ta[0][1], titles: authTitles[ta[0][0]], runnersUp: ta.slice(1).filter(function (x) { return x[1] >= 2; }).map(function (x) { return [authName[x[0]], x[1]]; }) } : null;
    var authorCount = Object.keys(auth).length;

    // genre / shelf / tag / mood mix
    function tally(field, filter) {
      var t = {}, covered = 0;
      list.forEach(function (b) {
        var any = false, seen = {};
        (b[field] || []).forEach(function (s) { if (filter(s) && !seen[s]) { seen[s] = 1; t[s] = (t[s] || 0) + 1; any = true; } });
        if (any) covered++;
      });
      return { t: t, covered: covered };
    }
    var mix = null;
    var sh = tally('shelves', isGenre), tg = tally('tags', isGenre), md = tally('moods', function (s) { return !!s; });
    var pickMix = function (kind, tl) { var items = top(tl.t, 6); return items.length >= 2 && tl.covered >= Math.max(2, count * 0.3) ? { kind: kind, items: items.map(function (x) { return [prettyShelf(x[0]), x[1]]; }), covered: tl.covered, distinct: Object.keys(tl.t).length } : null; };
    mix = pickMix('shelves', sh) || pickMix('tags', tg) || pickMix('moods', md);

    // abandoned
    var dnfs = books.filter(function (b) { return b.shelf === 'dnf' && inPeriod(b.lastRead || b.dateAdded, year); });
    dnfs.sort(function (a, b) { return dkey(b.lastRead || b.dateAdded) - dkey(a.lastRead || a.dateAdded); });
    var dnf = dnfs.length ? { book: dnfs[0], count: dnfs.length, others: dnfs.slice(1, 4) } : null;

    // re-reads: read before (Read Count >= 2, or several finish dates)
    var rereads = list.filter(function (b) { return Math.max(b.readCount || 0, b.reads.length) >= 2; }).map(function (b) {
      return { book: b, times: Math.max(b.readCount || 0, b.reads.length), thisPeriod: fin.filter(function (f) { return f.book === b; }).length };
    }).sort(function (a, b) { return b.times - a.times || (a.book.title < b.book.title ? -1 : 1); });

    // formats + pace
    var formats = { print: 0, ebook: 0, audio: 0 };
    list.forEach(function (b) { if (b.format) formats[b.format]++; });
    var formatKnown = formats.print + formats.ebook + formats.audio;
    var paces = { fast: 0, medium: 0, slow: 0 };
    list.forEach(function (b) { if (paces[b.pace] != null) paces[b.pace]++; });

    // publication years
    var pubs = list.filter(function (b) { return b.pubYear; });
    var oldest = pubs.slice().sort(function (a, b) { return a.pubYear - b.pubYear; })[0] || null;
    var refYear = year || now.getFullYear();
    var newShare = pubs.length >= 4 ? pubs.filter(function (b) { return b.pubYear >= refYear - 1; }).length / pubs.length : 0;

    // Libby: loans, libraries, ebook vs audiobook, holds (all by borrow/hold date, in the period)
    var library = null;
    if (books.some(function (b) { return b.loans; })) {
      var loans = [], holds = [], libs = {}, lf = { ebook: 0, audio: 0, magazine: 0 }, perBook = [];
      books.forEach(function (b) {
        var mine = (b.loans || []).filter(function (l) { return inPeriod(l.date, year); });
        mine.forEach(function (l) {
          loans.push(l);
          if (l.library) libs[l.library] = (libs[l.library] || 0) + 1;
          var f = b.libbyFormat === 'magazine' ? 'magazine' : (l.format === 'audio' || l.format === 'magazine' ? l.format : 'ebook');
          lf[f]++;
        });
        if (mine.length && b.libbyFormat !== 'magazine') perBook.push({ book: b, n: mine.length });
        // hold -> next borrow of the same title = days waited
        (b.holds || []).filter(function (h) { return inPeriod(h.date, year); }).forEach(function (h) {
          var next = (b.loans || []).filter(function (l) { return l.t >= h.t; })[0];
          holds.push({ book: b, wait: next ? Math.max(0, Math.round((next.t - h.t) / 864e5)) : null });
        });
      });
      if (loans.length) {
        var libList = top(libs, 5);
        var waits = holds.filter(function (h) { return h.wait != null; }).sort(function (a, b) { return b.wait - a.wait; });
        perBook.sort(function (a, b) { return b.n - a.n || (a.book.title < b.book.title ? -1 : 1); });
        library = {
          loans: loans.length, libraries: libList, libraryCount: Object.keys(libs).length,
          favorite: libList[0] ? { name: libList[0][0], count: libList[0][1] } : null,
          formats: lf, holds: holds.length,
          longestWait: waits[0] && waits[0].wait >= 1 ? waits[0] : null,
          avgWait: waits.length ? mean(waits.map(function (w) { return w.wait; })) : null,
          mostBorrowed: perBook[0] && perBook[0].n >= 2 ? perBook[0] : null,
          stamps: loans.filter(function (l) { return !libList[0] || l.library === libList[0][0]; }).sort(function (a, b) { return b.t - a.t; }).slice(0, 6).map(function (l) { return l.date; })
        };
      }
    }

    var prevCount = year != null ? (years(books, undated).filter(function (y) { return y.year === year - 1; })[0] || { count: 0 }).count : null;

    var s = {
      source: source, year: year, count: count, finishes: fin.length, list: list, fin: fin,
      pages: pages, pagesKnown: withPages.length, avgPages: withPages.length ? pages / withPages.length : null,
      perDay: pages / periodDays, periodDays: periodDays, booksPerMonth: count / Math.max(1, periodDays / 30.44),
      longest: longest, shortest: shortest,
      months: months, monthBooks: monthBooks, undatedMonth: undatedMonth, peakMonth: peakMonth, activeMonths: activeMonths, byYear: byYear,
      rated: rated.length, myAvg: myAvg, topRated: topRated, fiveStars: fiveStars, dist: dist, critic: critic,
      topAuthor: topAuthor, authorCount: authorCount,
      mix: mix, dnf: dnf, rereads: rereads,
      formats: formats, formatKnown: formatKnown, paces: paces,
      oldest: oldest, medianPub: median(pubs.map(function (b) { return b.pubYear; })), newShare: newShare,
      prevCount: prevCount, undatedCount: undatedCount, library: library,
      currentlyReading: books.filter(function (b) { return b.shelf === 'currently-reading'; }).length
    };
    s.personality = personality(s);
    return s;
  }

  var TYPES = [
    { id: 'marathon', name: 'The Marathoner', line: 'You go long. Doorstoppers don\u2019t scare you; they call your name.', score: function (s) { return s.pagesKnown >= 3 ? s.avgPages / 430 : 0; } },
    { id: 'devourer', name: 'The Devourer', line: 'A book a week, easily. Your to-read pile never stood a chance.', score: function (s) { return s.count / (52 * Math.min(1, s.periodDays / 365)); } },
    { id: 'superfan', name: 'The Superfan', line: 'Find an author you love, then read everything they\u2019ve got.', score: function (s) { return s.topAuthor && s.topAuthor.count >= 3 ? (s.topAuthor.count / s.count) / 0.2 : 0; } },
    { id: 'hopper', name: 'The Genre Hopper', line: 'Mystery on Monday, dragons by Friday. You read all over the map.', score: function (s) { return s.mix && s.mix.kind !== 'moods' && s.mix.distinct >= 5 && s.mix.items[0][1] / s.count < 0.4 ? s.mix.distinct / 5.5 : 0; } },
    { id: 'critic', name: 'The Tough Critic', line: 'Five stars are earned, not given. Authors fear your reviews.', score: function (s) { return s.critic ? -s.critic.diff / 0.3 : (s.rated >= 5 && s.myAvg ? (3.7 - s.myAvg) / 0.4 : 0); } },
    { id: 'generous', name: 'The Generous Heart', line: 'You find something to love in almost every book.', score: function (s) { return s.critic ? s.critic.diff / 0.3 : (s.rated >= 5 ? (s.fiveStars / s.rated) / 0.45 : 0); } },
    { id: 'comfort', name: 'The Comfort Re-reader', line: 'Some stories are home, and you keep going back.', score: function (s) { return s.rereads.length >= 2 ? (s.rereads.length / s.count) / 0.1 : 0; } },
    { id: 'binge', name: 'The Binge Reader', line: 'You read in great big gulps, then come up for air.', score: function (s) { return s.year != null && s.count >= 8 ? (s.months[s.peakMonth] / s.count) / 0.22 : 0; } },
    { id: 'steady', name: 'The Steady Page-Turner', line: 'A little reading every month. Consistency is your superpower.', score: function (s) { return s.year != null && s.activeMonths >= 10 ? 1 + (s.activeMonths - 10) * 0.04 : 0; } },
    { id: 'time', name: 'The Time Traveler', line: 'Your favorite new reads are decades old.', score: function (s) { return s.medianPub && s.medianPub <= (s.year || 2026) - 40 ? 1.15 : 0; } },
    { id: 'fresh', name: 'The Early Adopter', line: 'Fresh off the press. You read them before everyone else.', score: function (s) { return s.newShare / 0.45; } },
    { id: 'audio', name: 'The Audio Adventurer', line: 'Headphones in, world out. Your books are something you hear.', score: function (s) { return s.formatKnown >= 4 ? (s.formats.audio / s.formatKnown) / 0.4 : 0; } },
    { id: 'quick', name: 'The Quick Dipper', line: 'Short, sharp and satisfying. You like a book you can finish in a sitting.', score: function (s) { return s.pagesKnown >= 3 && s.avgPages ? 230 / s.avgPages : 0; } }
  ];

  function personality(s) {
    var scored = TYPES.map(function (t) { var v = s.count ? t.score(s) : 0; return { t: t, v: isFinite(v) ? v : 0 }; }).sort(function (a, b) { return b.v - a.v; });
    var main = scored[0] && scored[0].v >= 1 ? scored[0].t : { id: 'curious', name: 'The Curious Reader', line: 'A little of everything, read with an open mind.' };
    var traits = scored.filter(function (x) { return x.t !== main && x.v >= 0.8; }).slice(0, 2).map(function (x) { return x.t.name.replace(/^The /, ''); });
    return { id: main.id, name: main.name, line: main.line, traits: traits };
  }

  var api = { compute: compute, years: years, isGenre: isGenre, prettyShelf: prettyShelf, finishes: finishes, TYPES: TYPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReadingStats = api;
})(typeof self !== 'undefined' ? self : this);
