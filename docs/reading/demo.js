/* Reading Wrapped: deterministic, entirely made-up sample library (titles and authors are invented).
 * Used by the "try a sample" button and by the test fixtures. Emits Goodreads- or StoryGraph-shaped CSV. */
(function (root) {
  'use strict';

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  var AUTHORS = ['Imogen Vale', 'Theo Marchetti', 'Ada Okonkwo-Reyes', 'Rowan Ashby', 'Priya Castellan', 'Silas Wren', 'Maren Holloway', 'Jun Takeda-Hart', 'Cora Lindqvist', 'Felix Abernathy', 'Nadia Sol', 'Hugo Brannagh', 'Elsie Fairweather', 'Tomas Arroyo', 'Wren Delacroix', 'Bea Kowalczyk', 'Lionel Achterberg', 'Odette Mbeki', 'Calla Thorne', 'Arjun Velasco'];
  var ADJ = ['Salt', 'Glass', 'Hollow', 'Quiet', 'Lantern', 'Copper', 'Winter', 'Paper', 'Velvet', 'Midnight', 'Orchard', 'Silver', 'Ember', 'Drowned', 'Clockwork', 'Wandering', 'Borrowed', 'Last', 'Lighthouse', 'Ivory', 'Thistle', 'Gilded', 'Northern', 'Sunken', 'Patient'];
  var NOUN = ['Tide', 'Orchard', 'Cartographer', 'Archive', 'Garden', 'Harbor', 'Atlas', 'Choir', 'Engine', 'Ledger', 'Kingdom', 'Weather', 'Apothecary', 'Bridge', 'Inheritance', 'Almanac', 'Observatory', 'Ferry', 'Library', 'Sisters', 'Glasshouse', 'Map', 'Moth', 'Fox', 'Season'];
  var OF = ['Small Hours', 'Unfinished Letters', 'Lost Rivers', 'Quiet Stars', 'Borrowed Light', 'Second Chances', 'Folded Maps', 'Distant Bells', 'Saltwater', 'Late Summers', 'Lanterns', 'Hidden Rooms'];
  var GENRES = [['fantasy', 14], ['literary-fiction', 11], ['mystery', 9], ['sci-fi', 7], ['historical-fiction', 7], ['romance', 6], ['nonfiction', 6], ['memoir', 4], ['horror', 3], ['poetry', 2], ['thriller', 5]];
  var MOODS = { fantasy: ['adventurous', 'mysterious', 'hopeful'], 'literary-fiction': ['reflective', 'emotional', 'sad'], mystery: ['mysterious', 'tense', 'dark'], 'sci-fi': ['adventurous', 'challenging', 'tense'], 'historical-fiction': ['emotional', 'reflective', 'informative'], romance: ['lighthearted', 'funny', 'hopeful'], nonfiction: ['informative', 'challenging', 'inspiring'], memoir: ['reflective', 'emotional', 'inspiring'], horror: ['dark', 'tense', 'mysterious'], poetry: ['reflective', 'emotional'], thriller: ['tense', 'dark', 'mysterious'] };
  var BINDINGS = [['Paperback', 9], ['Hardcover', 5], ['Kindle Edition', 6], ['Audiobook', 3], ['Mass Market Paperback', 2], ['Audible Audio', 1]];

  function weighted(r, pairs) { var t = 0; pairs.forEach(function (p) { t += p[1]; }); var x = r() * t; for (var i = 0; i < pairs.length; i++) { x -= pairs[i][1]; if (x < 0) return pairs[i][0]; } return pairs[0][0]; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.y + '/' + pad(d.mo) + '/' + pad(d.d); }
  function q(s) { s = s == null ? '' : String(s); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function isbn13(r) { var s = '978'; for (var i = 0; i < 10; i++) s += Math.floor(r() * 10); return s; }

  // opts: { year: last year in the library (default: current), month: last month with reads (1-12), seed }
  function library(opts) {
    opts = opts || {};
    var now = new Date();
    var Y = opts.year || now.getFullYear();
    var lastMo = opts.month || (opts.year ? 11 : now.getMonth() + 1);
    var r = rng(opts.seed || 20261114);
    var used = {}, books = [];
    function title() {
      for (var k = 0; k < 50; k++) {
        var f = r(), t;
        if (f < 0.45) t = 'The ' + ADJ[Math.floor(r() * ADJ.length)] + ' ' + NOUN[Math.floor(r() * NOUN.length)];
        else if (f < 0.75) t = NOUN[Math.floor(r() * NOUN.length)] + ' of ' + OF[Math.floor(r() * OF.length)];
        else t = 'A ' + NOUN[Math.floor(r() * NOUN.length)] + ' for ' + ADJ[Math.floor(r() * ADJ.length)] + ' Days';
        if (!used[t]) { used[t] = 1; return t; }
      }
      return 'Untitled ' + books.length;
    }
    function date(y, mo) { return { y: y, mo: mo, d: 1 + Math.floor(r() * 27) }; }
    function make(y, mo, extra) {
      var g1 = weighted(r, GENRES), g2 = r() < 0.45 ? weighted(r, GENRES) : null;
      var genres = g2 && g2 !== g1 ? [g1, g2] : [g1];
      var b = {
        title: title(), author: AUTHORS[Math.floor(Math.pow(r(), 1.3) * AUTHORS.length)], extra: '', series: '',
        pages: 140 + Math.floor(r() * 380) + (r() < 0.2 ? Math.floor(r() * 300) : 0),
        rating: weighted(r, [[5, 5], [4, 9], [3, 5], [2, 1.5], [1, 0.5], [0, 1.5]]),
        avg: Math.round((3.55 + r() * 0.85) * 100) / 100,
        genres: genres, binding: weighted(r, BINDINGS), pub: r() < 0.7 ? y - Math.floor(r() * 6) : 1880 + Math.floor(r() * 120),
        shelf: 'read', reads: y ? [date(y, mo)] : [], added: null, readCount: 1, review: ''
      };
      for (var k in extra) b[k] = extra[k];
      if (b.pub > Y) b.pub = Y;
      var a = b.reads[0] || { y: Y, mo: Math.max(1, lastMo - 1), d: 3 };
      b.added = { y: a.mo > 2 ? a.y : a.y - 1, mo: a.mo > 2 ? a.mo - 2 : 10, d: 1 + Math.floor(r() * 27) };
      books.push(b);
      return b;
    }
    // A reading year: more in summer and December, a few slow months.
    var plan = {};
    plan[Y - 2] = [2, 2, 3, 2, 2, 3, 4, 4, 2, 2, 2, 3];
    plan[Y - 1] = [3, 2, 3, 3, 2, 4, 5, 4, 3, 3, 2, 4];
    plan[Y] = [4, 3, 3, 2, 4, 3, 7, 6, 3, 3, 4, 3];
    [Y - 2, Y - 1, Y].forEach(function (y) {
      plan[y].forEach(function (n, i) { if (y === Y && i + 1 > lastMo) return; for (var k = 0; k < n; k++) make(y, i + 1); });
    });
    // A series binge by one author this year (the "most-read author").
    ['The Lantern Coast', 'The Lantern Coast', 'The Lantern Coast', 'The Lantern Coast'].forEach(function (s, i) {
      make(Y, Math.min(lastMo, 6 + i), { author: 'Imogen Vale', series: s + ', #' + (i + 1), genres: ['fantasy', 'romance'].slice(0, i % 2 + 1), rating: i === 2 ? 5 : 4, pages: 380 + i * 41 });
    });
    // The doorstopper, the novella, a five-star with a long review (multiline, commas, quotes).
    make(Y, Math.min(lastMo, 2), { title: 'The Cartographer\u2019s Winter', author: 'Lionel Achterberg', pages: 1104, rating: 4, genres: ['historical-fiction'], binding: 'Hardcover', pub: 1961 });
    make(Y, Math.min(lastMo, 9), { title: 'Small Hours', author: 'Odette Mbeki', pages: 96, rating: 3, genres: ['poetry'] });
    make(Y, Math.min(lastMo, 5), { title: 'Everything the River Kept', author: 'Calla Thorne', pages: 412, rating: 5, avg: 3.71, genres: ['literary-fiction'], review: 'Loved it, start to finish.\nThe "river" chapters, especially. Five stars, no notes.' });
    // Re-reads this year.
    make(Y, Math.min(lastMo, 1), { title: 'The Velvet Almanac', author: 'Silas Wren', pages: 288, rating: 5, readCount: 3, genres: ['fantasy'] });
    make(Y, Math.min(lastMo, 10), { title: 'Moth of Late Summers', author: 'Maren Holloway', pages: 334, rating: 4, readCount: 2, genres: ['literary-fiction'] });
    // Abandoned (DNF), currently reading, to-read.
    make(null, 0, { title: 'The Patient Engine', author: 'Arjun Velasco', pages: 640, rating: 0, shelf: 'did-not-finish', genres: ['sci-fi'], reads: [], dnf: { y: Y, mo: Math.min(lastMo, 4), d: 18 } });
    make(null, 0, { title: 'Ledger of Distant Bells', author: 'Hugo Brannagh', pages: 512, rating: 0, shelf: 'did-not-finish', genres: ['thriller'], reads: [], dnf: { y: Y - 1, mo: 8, d: 2 } });
    for (var c = 0; c < 2; c++) make(null, 0, { shelf: 'currently-reading', rating: 0, reads: [] });
    for (var t = 0; t < 14; t++) make(null, 0, { shelf: 'to-read', rating: 0, reads: [], readCount: 0 });
    books.forEach(function (b) {
      b.isbn = isbn13(r);
      if (b.dnf) b.added = { y: b.dnf.y, mo: b.dnf.mo, d: Math.max(1, b.dnf.d - 10) };
      if (b.readCount > 1 && b.reads.length) b.earlier = [{ y: Y - 6 + b.readCount, mo: 3, d: 10 }, { y: Y - 9, mo: 7, d: 4 }].slice(0, b.readCount - 1);
    });
    return books;
  }

  var GR_HEAD = 'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies';
  function goodreadsCSV(opts) {
    var books = library(opts), Y = (opts && opts.year) || new Date().getFullYear();
    var rows = books.map(function (b, i) {
      var parts = b.author.split(' '), lf = parts.slice(-1)[0] + ', ' + parts.slice(0, -1).join(' ');
      var shelves = b.genres.slice();
      if (b.rating === 5 && i % 2) shelves.push('favorites');
      if (b.binding === 'Kindle Edition') shelves.push('kindle');
      if (b.reads[0] && b.reads[0].y === Y) shelves.push(Y + '-reading-challenge');
      if (b.shelf !== 'read') shelves.unshift(b.shelf);
      var t = b.series ? b.title + ' (' + b.series + ')' : b.title;
      var dr = b.reads[0] ? ymd(b.reads[0]) : '';
      return [1000 + i, q(t), q(b.author), q(lf), '', '"=""' + b.isbn.slice(3, 12) + 'X"""', '"=""' + b.isbn + '"""', b.rating, b.avg.toFixed(2), 'Lantern House', q(b.binding), b.pages, b.pub, b.pub, dr, ymd(b.added), q(shelves.join(', ')), q(shelves.map(function (s, k) { return s + ' (#' + (k + 1) + ')'; }).join(', ')), b.shelf, q(b.review), '', '', b.readCount, b.binding === 'Kindle Edition' ? 0 : 1].join(',');
    });
    return GR_HEAD + '\n' + rows.join('\n') + '\n';
  }

  var SG_HEAD = 'Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Dates Read,Read Count,Moods,Pace,Character- or Plot-Driven?,Strong Character Development?,Loveable Characters?,Diverse Characters?,Flawed Characters?,Star Rating,Review,Content Warnings,Content Warning Description,Tags,Owned?';
  function storygraphCSV(opts) {
    var books = library(opts), r = rng(7);
    var rows = books.map(function (b) {
      var fmt = /audi/i.test(b.binding) ? 'audio' : /kindle/i.test(b.binding) ? 'digital' : /hard/i.test(b.binding) ? 'hardcover' : 'paperback';
      var status = b.shelf;
      var periods = (b.earlier || []).concat(b.reads).map(function (d) { var s = { y: d.y, mo: d.mo, d: Math.max(1, d.d - 9) }; return ymd(s) + '-' + ymd(d); });
      var last = b.reads[0] ? ymd(b.reads[b.reads.length - 1]) : b.dnf ? ymd(b.dnf) : '';
      var moods = []; b.genres.forEach(function (g) { (MOODS[g] || []).slice(0, 2).forEach(function (m) { if (moods.indexOf(m) < 0) moods.push(m); }); });
      var star = b.rating ? Math.max(0.5, Math.min(5, b.rating - (r() < 0.3 ? 0.25 : r() < 0.2 ? 0.5 : 0))) : '';
      var pace = ['fast', 'medium', 'slow'][Math.floor(r() * 3)];
      var tags = b.genres.join(', ');
      return [q(b.series ? b.title + ' (' + b.series + ')' : b.title), q(b.author), '', b.isbn, fmt, status, ymd(b.added), last, q(periods.join(', ')), status === 'read' ? b.readCount : 0, q(status === 'read' ? moods.join(', ') : ''), status === 'read' ? pace : '', status === 'read' ? 'A mix' : '', 'Yes', 'Yes', 'It\'s complicated', 'Yes', star, q(b.review), '', '', q(tags), fmt === 'digital' ? 'No' : 'Yes'].join(',');
    });
    return SG_HEAD + '\n' + rows.join('\n') + '\n';
  }

  var api = { library: library, goodreadsCSV: goodreadsCSV, storygraphCSV: storygraphCSV, GR_HEAD: GR_HEAD, SG_HEAD: SG_HEAD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReadingDemo = api;
})(typeof self !== 'undefined' ? self : this);
