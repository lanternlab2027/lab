// Unit tests for docs/reading/parser.js and stats.js. Run: node --test bots/reading/test_parser.js
// Fixtures are synthetic (bots/reading/make_fixtures.js); no real reading data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('../../docs/reading/parser.js');
const S = require('../../docs/reading/stats.js');
const D = require('../../docs/reading/demo.js');
const C = require('../../docs/reading/cards.js');
const FX = path.join(__dirname, 'fixtures');
const read = (f) => fs.readFileSync(path.join(FX, f), 'utf8');
const NOW = new Date(2026, 10, 14);
const byTitle = (r, t) => r.books.find((b) => b.title === t);

test('CSV: quotes, doubled quotes, embedded newlines and delimiters, CRLF, BOM, ="..." cells', () => {
  const rows = P.parseCSV('﻿a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n="012",,\n');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['x, y', 'say "hi"', 'line1\nline2'], ['=012', '', '']]);
  assert.deepEqual(P.parseCSV('a;b\n"1;2";3\n'), [['a', 'b'], ['1;2', '3']]);
  assert.deepEqual(P.parseCSV('a\tb\n1\t2\n'), [['a', 'b'], ['1', '2']]);
});

test('dates: Goodreads, ISO, spreadsheet re-saves, partial dates and ranges', () => {
  assert.deepEqual(P.parseDate('2026/03/14'), { y: 2026, mo: 3, d: 14 });
  assert.deepEqual(P.parseDate('2026-03-14T08:00:00Z'), { y: 2026, mo: 3, d: 14 });
  assert.deepEqual(P.parseDate('3/14/2026'), { y: 2026, mo: 3, d: 14 });
  assert.deepEqual(P.parseDate('14/03/2026'), { y: 2026, mo: 3, d: 14 });
  assert.deepEqual(P.parseDate('14.03.2026'), { y: 2026, mo: 3, d: 14 });
  assert.deepEqual(P.parseDate('Mar 14, 2026'), { y: 2026, mo: 3, d: 14 });
  assert.deepEqual(P.parseDate('2026/06'), { y: 2026, mo: 6, d: null });
  assert.equal(P.parseDate(''), null);
  assert.equal(P.parseDate('not set'), null);
  assert.equal(P.parseDate('2026/13/40'), null);
  assert.deepEqual(P.datesIn('2019/03/01-2019/03/10, 2026/02/01-2026/02/12').map(P.dateKey), [20190301, 20190310, 20260201, 20260212]);
  assert.deepEqual(P.datesIn('2026/01-2026/02').map(P.dateKey), [20260100, 20260200]);
});

test('series titles split off; DNF shelf names recognized', () => {
  assert.deepEqual(P.splitTitle('The Quiet Harbor (Lantern Coast, #2)'), { title: 'The Quiet Harbor', series: 'Lantern Coast, #2' });
  assert.deepEqual(P.splitTitle('Notes (A Memoir)'), { title: 'Notes (A Memoir)', series: '' });
  ['dnf', 'did-not-finish', 'DNF-2026', 'abandoned', 'gave-up', 'Did Not Finish'].forEach((s) => assert.equal(P.normShelf(s), 'dnf', s));
  assert.equal(P.normShelf('read'), 'read');
  assert.equal(P.normShelf('fantasy'), 'fantasy');
});

test('Goodreads export: detected, every row parsed, fields normalized', () => {
  const r = P.parseAny(read('goodreads_library_export.csv'), 'goodreads_library_export.csv');
  assert.equal(r.source, 'goodreads');
  assert.equal(r.skipped, 0);
  assert.equal(r.books.length, 138);
  const b = byTitle(r, 'Everything the River Kept');
  assert.equal(b.author, 'Calla Thorne');
  assert.equal(b.pages, 412);
  assert.equal(b.myRating, 5);
  assert.equal(b.avgRating, 3.71);
  assert.equal(b.shelf, 'read');
  assert.deepEqual(b.reads, [b.lastRead]);
  assert.ok(b.shelves.includes('literary-fiction'));
  const series = r.books.find((x) => x.series && /Lantern Coast/.test(x.series));
  assert.ok(series && !/\(/.test(series.title), 'series stripped from title');
  assert.equal(r.books.filter((x) => x.shelf === 'dnf').length, 2);
  assert.equal(r.books.filter((x) => x.shelf === 'to-read').length, 14);
  assert.equal(byTitle(r, 'The Velvet Almanac').readCount, 3);
  assert.ok(r.books.every((x) => x.format), 'binding mapped to a format');
});

test('Goodreads oddities: legacy columns, BOM/CRLF, missing author/pages/rating, undated, custom DNF, truncated row', () => {
  const r = P.parseAny(read('goodreads_odd.csv'));
  assert.equal(r.source, 'goodreads');
  assert.equal(r.books.length, 7);
  const h = byTitle(r, 'The Quiet Harbor');
  assert.equal(h.series, 'Lantern Coast, #2');
  assert.equal(h.readCount, 2);
  const pl = byTitle(r, 'Paper Lanterns');
  assert.equal(pl.author, 'Nadia Sol'); // rebuilt from "Author l-f"
  assert.equal(pl.pages, null);
  assert.equal(pl.myRating, null); // 0 = unrated
  assert.equal(pl.format, 'ebook');
  const cf = byTitle(r, 'The Copper Ferry');
  assert.equal(cf.pages, null); // "0" pages
  assert.equal(cf.avgRating, null);
  assert.equal(cf.readCount, 1); // blank Read Count on a read book
  assert.deepEqual(byTitle(r, 'Undated Atlas').reads, []);
  assert.equal(byTitle(r, 'The Patient Engine').shelf, 'dnf');
  const tr = byTitle(r, 'Short Row Book');
  assert.equal(tr.shelf, 'read'); // shelf column missing, but it has a Date Read
  assert.equal(tr.format, 'audio');
});

test('Goodreads re-saved by a spreadsheet: semicolons, M/D/YYYY and D/M/YYYY, thousands separator, missing columns', () => {
  const r = P.parseAny(read('goodreads_excel_semicolon.csv'));
  assert.equal(r.source, 'goodreads');
  assert.equal(r.books.length, 4);
  assert.equal(byTitle(r, 'The Salt Orchard').pages, 1234);
  assert.deepEqual(byTitle(r, 'The Salt Orchard').reads[0], { y: 2026, mo: 1, d: 15 });
  assert.deepEqual(byTitle(r, 'Ember Choir').reads[0], { y: 2026, mo: 7, d: 14 });
  assert.equal(byTitle(r, 'Garden; of Rivers').myRating, 5);
  assert.ok(r.books.every((b) => b.avgRating === null));
});

test('StoryGraph export: detected, quarter stars, read periods, moods, tags, formats', () => {
  const r = P.parseAny(read('storygraph_export.csv'), 'storygraph.csv');
  assert.equal(r.source, 'storygraph');
  assert.equal(r.books.length, 138);
  assert.ok(r.books.every((b) => b.pages === null && b.avgRating === null));
  assert.ok(r.books.some((b) => b.myRating && b.myRating % 1 !== 0), 'quarter/half stars kept');
  const v = byTitle(r, 'The Velvet Almanac');
  assert.equal(v.readCount, 3);
  assert.equal(v.reads.length, 3); // two earlier periods + this year's
  assert.equal(v.reads[v.reads.length - 1].y, 2026);
  const anyRead = r.books.find((b) => b.shelf === 'read');
  assert.ok(anyRead.moods.length && anyRead.tags.length && anyRead.pace);
  const dnf = byTitle(r, 'The Patient Engine');
  assert.equal(dnf.shelf, 'dnf');
  assert.deepEqual(dnf.reads, []);
  assert.equal(dnf.lastRead.y, 2026);
  assert.ok(['print', 'ebook', 'audio'].every((k) => r.books.some((b) => b.format === k)));
});

test('StoryGraph oddities: reordered subset, multi-author, partial dates, paused, no dates', () => {
  const r = P.parseAny(read('storygraph_odd.csv'));
  assert.equal(r.source, 'storygraph');
  assert.equal(r.books.length, 7);
  const v = byTitle(r, 'The Velvet Almanac');
  assert.deepEqual(v.reads.map(P.dateKey), [20190310, 20260212]);
  assert.equal(v.myRating, 4.75);
  const l = byTitle(r, 'Ledger, Of Small Hours');
  assert.equal(l.author, 'Maren Holloway');
  assert.equal(l.myRating, 3.25);
  assert.deepEqual(byTitle(r, 'Month Only').reads[0], { y: 2026, mo: 6, d: null });
  assert.deepEqual(byTitle(r, 'No Dates At All').reads, []);
  assert.equal(byTitle(r, 'Halfway House').shelf, 'paused');
  assert.equal(byTitle(r, 'The Patient Engine').shelf, 'dnf');
});

test('rejects files that are not exports, and exports with no books', () => {
  assert.throws(() => P.parseAny(read('not_an_export.csv')), /doesn.t look like a Goodreads or StoryGraph export/);
  assert.throws(() => P.parseAny(read('empty_goodreads.csv')), /no books/);
  assert.throws(() => P.parseAny(''), /doesn.t look like/);
});

test('stats (Goodreads, 2026): counts, pages, longest, top-rated, author, mix, DNF, re-reads, critic', () => {
  const r = P.parseAny(read('goodreads_library_export.csv'));
  assert.deepEqual(S.years(r.books), [{ year: 2024, count: 31 }, { year: 2025, count: 38 }, { year: 2026, count: 51 }]);
  const s = S.compute(r.books, { year: 2026, now: NOW, source: r.source });
  assert.equal(s.count, 51);
  assert.equal(s.prevCount, 38);
  assert.equal(s.pages, s.list.reduce((a, b) => a + b.pages, 0));
  assert.equal(s.longest.title, 'The Cartographer’s Winter');
  assert.equal(s.longest.pages, 1104);
  assert.equal(s.shortest.title, 'Small Hours');
  assert.equal(s.topRated.myRating, 5);
  assert.equal(s.topAuthor.name, 'Imogen Vale');
  assert.ok(s.topAuthor.count >= 4);
  assert.equal(s.mix.kind, 'shelves');
  assert.equal(s.mix.items[0][0], 'Fantasy');
  assert.ok(!s.mix.items.some((x) => /favorites|kindle|challenge|2026/i.test(x[0])), 'non-genre shelves filtered');
  assert.equal(s.dnf.book.title, 'The Patient Engine');
  assert.equal(s.dnf.count, 1);
  assert.deepEqual(s.rereads.map((x) => x.book.title), ['The Velvet Almanac', 'Moth of Late Summers']);
  assert.ok(s.critic && ['harsh', 'easy', 'fair'].includes(s.critic.kind));
  assert.equal(s.months.reduce((a, b) => a + b, 0), 51);
  assert.equal(s.months[11], 0); // nothing after November
  assert.ok(s.personality.name);
});

test('stats (StoryGraph): mix falls back to tags, no pages, ratings without a community average', () => {
  const r = P.parseAny(read('storygraph_export.csv'));
  const s = S.compute(r.books, { year: 2026, now: NOW, source: r.source });
  assert.equal(s.count, 51);
  assert.equal(s.pagesKnown, 0);
  assert.equal(s.longest, null);
  assert.equal(s.critic, null);
  assert.equal(s.mix.kind, 'tags');
  assert.ok(s.paces.fast + s.paces.medium + s.paces.slow > 0);
  const noTags = r.books.map((b) => Object.assign({}, b, { tags: [] }));
  assert.equal(S.compute(noTags, { year: 2026, now: NOW, source: 'storygraph' }).mix.kind, 'moods');
});

test('undated read books only count when asked; all-time works; empty years are empty', () => {
  const r = P.parseAny(read('goodreads_odd.csv'));
  const a = S.compute(r.books, { year: 2026, now: NOW });
  const b = S.compute(r.books, { year: 2026, now: NOW, undated: true });
  assert.equal(b.count, a.count + 1);
  assert.equal(a.undatedCount, 1);
  assert.equal(S.compute(r.books, { year: 2019, now: NOW }).count, 0);
  assert.ok(S.compute(r.books, { year: null, now: NOW }).count >= a.count);
});

test('genre filter and labels', () => {
  ['to-read', 'favorites', 'owned', 'kindle', '2026-reading-challenge', 'read-in-2025', 'dnf', 'audiobooks', 'library'].forEach((x) => assert.equal(S.isGenre(x), false, x));
  ['fantasy', 'sci-fi', 'historical-fiction', 'romance'].forEach((x) => assert.equal(S.isGenre(x), true, x));
  assert.equal(S.prettyShelf('sci-fi'), 'Sci-fi');
  assert.equal(S.prettyShelf('historical-fiction'), 'Historical fiction');
  assert.equal(S.prettyShelf('ya'), 'YA');
});

test('card deck: 8-10 cards for a full year, capped at 10, longest folds into pages when dropped', () => {
  const info = { title: 'My 2026 in books', year: 2026, periodShort: '2026' };
  const gr = P.parseAny(read('goodreads_library_export.csv'));
  const cards = C.build(S.compute(gr.books, { year: 2026, now: NOW, source: 'goodreads' }), info);
  assert.ok(cards.length >= 8 && cards.length <= 10, cards.length);
  const ids = cards.map((c) => c.id);
  ['books', 'pages', 'rhythm', 'toprated', 'author', 'mix', 'critic', 'dnf', 'persona'].forEach((id) => assert.ok(ids.includes(id), id));
  const sg = P.parseAny(read('storygraph_export.csv'));
  const sgc = C.build(S.compute(sg.books, { year: 2026, now: NOW, source: 'storygraph' }), info).map((c) => c.id);
  assert.ok(sgc.length >= 8 && sgc.length <= 10 && !sgc.includes('pages') && !sgc.includes('longest'), sgc.join());
});

test('demo library is deterministic and synthetic', () => {
  assert.equal(D.goodreadsCSV({ year: 2026, month: 11 }), D.goodreadsCSV({ year: 2026, month: 11 }));
  assert.equal(D.goodreadsCSV({ year: 2026, month: 11 }), read('goodreads_library_export.csv'));
});
