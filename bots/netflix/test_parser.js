// Unit tests for docs/netflix/parser.js, stats.js and cards.js build(). Run: node --test bots/netflix/test_parser.js
// Fixtures are synthetic (bots/netflix/make_fixtures.js); every title is invented.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('../../docs/netflix/parser.js');
const S = require('../../docs/netflix/stats.js');
const D = require('../../docs/netflix/demo.js');
const C = require('../../docs/netflix/cards.js');
const JSZip = require('../../docs/netflix/vendor/jszip-3.10.1.min.js');
const FX = path.join(__dirname, 'fixtures');
const read = (f) => fs.readFileSync(path.join(FX, f), 'utf8');
const T = (t) => { const p = P.parseTitle(t); return [p.kind, p.show, p.season, p.episode]; };
const byTitle = (r, t) => r.entries.find((e) => e.title === t);

test('CSV: quotes, doubled quotes, commas and colons in cells, CRLF, BOM, delimiters', () => {
  assert.deepEqual(P.parseCSV('\ufeffTitle,Date\r\n"Show: Season 1: Tide, Wind","11/1/26"\r\n"Say ""hi""",1/2/26\n'),
    [['Title', 'Date'], ['Show: Season 1: Tide, Wind', '11/1/26'], ['Say "hi"', '1/2/26']]);
  assert.deepEqual(P.parseCSV('Title;Date\nA;2026-01-02\n'), [['Title', 'Date'], ['A', '2026-01-02']]);
  assert.deepEqual(P.parseCSV('Title\tDate\nA\t1/2/26\n'), [['Title', 'Date'], ['A', '1/2/26']]);
});

test('dates: US, UK, German, ISO, archive timestamps, month names; invalid dates rejected', () => {
  assert.deepEqual(P.parseDate('11/14/26'), { y: 2026, mo: 11, d: 14 });
  assert.deepEqual(P.parseDate('14/11/2026'), { y: 2026, mo: 11, d: 14 });
  assert.deepEqual(P.parseDate('14.11.26'), { y: 2026, mo: 11, d: 14 });
  assert.deepEqual(P.parseDate('2026-11-14'), { y: 2026, mo: 11, d: 14 });
  assert.deepEqual(P.parseDate('2026-11-14 21:14:05'), { y: 2026, mo: 11, d: 14 });
  assert.deepEqual(P.parseDate('Nov 14, 2026'), { y: 2026, mo: 11, d: 14 });
  assert.deepEqual(P.parseDate('14 Nov 2026'), { y: 2026, mo: 11, d: 14 });
  assert.deepEqual(P.parseDate('3/4/26', 'mdy'), { y: 2026, mo: 3, d: 4 });
  assert.deepEqual(P.parseDate('3/4/26', 'dmy'), { y: 2026, mo: 4, d: 3 });
  assert.equal(P.parseDate('2/30/26'), null);
  assert.equal(P.parseDate('13/13/26'), null);
  assert.equal(P.parseDate(''), null);
  assert.equal(P.parseDate('yesterday'), null);
});

test('date order: decided by unambiguous values, dotted style, or newest-first ordering', () => {
  assert.equal(P.detectOrder(['11/14/26', '3/4/26']).order, 'mdy');
  assert.equal(P.detectOrder(['14/11/26', '3/4/26']).order, 'dmy');
  assert.equal(P.detectOrder(['3.4.26', '1.2.26']).order, 'dmy');
  // Every value ambiguous: D/M reading keeps the newest-first order, M/D does not.
  const r = P.detectOrder(['12/03/2026', '05/03/2026', '10/02/2026', '03/02/2026', '11/01/2026', '02/01/2026']);
  assert.equal(r.order, 'dmy');
  assert.equal(r.reason, 'ordering');
  const a = P.parseAny(read('ambiguous_dmy.csv'));
  assert.equal(a.dateOrder, 'dmy');
  assert.deepEqual(byTitle(a, 'Moth & Lantern: Season 1: Night 12-3').date, { y: 2026, mo: 12, d: 3 });
});

test('titles: Show: Season N: Episode, colons in show and episode names, other season words', () => {
  assert.deepEqual(T('Saltmarsh Inspectors: Season 2: The Low Tide'), ['series', 'Saltmarsh Inspectors', 'Season 2', 'The Low Tide']);
  assert.deepEqual(T('Orbit Station: Nova Ring: Season 1: Chapter One: Ignition'), ['series', 'Orbit Station: Nova Ring', 'Season 1', 'Chapter One: Ignition']);
  assert.deepEqual(T('Glasswing: Limited Series: Smoke'), ['series', 'Glasswing', 'Limited Series', 'Smoke']);
  assert.deepEqual(T('The Ferryman\u2019s Daughters: Series 1: Fog'), ['series', 'The Ferryman\u2019s Daughters', 'Series 1', 'Fog']);
  assert.deepEqual(T('The Velvet Heist Club: Part 2: Episode 3'), ['series', 'The Velvet Heist Club', 'Part 2', 'Episode 3']);
  assert.deepEqual(T('Kitchen Wars: Episode 1'), ['series', 'Kitchen Wars', '', 'Episode 1']);
  assert.deepEqual(T('Casa del Faro: Temporada 1: El regreso'), ['series', 'Casa del Faro', 'Temporada 1', 'El regreso']);
  assert.deepEqual(T('Haus am See: Staffel 2: Folge 3'), ['series', 'Haus am See', 'Staffel 2', 'Folge 3']);
  assert.deepEqual(T('Saltmarsh Inspectors: Specials: Behind the Tide'), ['series', 'Saltmarsh Inspectors', 'Specials', 'Behind the Tide']);
  assert.deepEqual(T('Saltmarsh Inspectors: Season 1: Tide, Wind, and Rain'), ['series', 'Saltmarsh Inspectors', 'Season 1', 'Tide, Wind, and Rain']);
  // movies, including ones with colons and sequel parts
  assert.deepEqual(T('Paper Satellites'), ['movie', 'Paper Satellites', '', '']);
  assert.deepEqual(T('Glass Ferry: The Return'), ['movie', 'Glass Ferry: The Return', '', '']);
  assert.deepEqual(T('Glass Ferry: Part 2'), ['movie', 'Glass Ferry: Part 2', '', '']);
  assert.deepEqual(T('10:30 Express'), ['movie', '10:30 Express', '', '']);
  assert.deepEqual(T('Comedy Night: Special'), ['movie', 'Comedy Night: Special', '', '']);
});

test('titles: whole-file pass groups docuseries without season markers and merges capitalisation', () => {
  const r = P.parseAny(read('tricky_titles.csv'));
  assert.equal(r.entries.length, 16);
  assert.deepEqual(['kind', 'show', 'episode'].map((k) => byTitle(r, 'Deep Blue Atlas: The Kelp Cathedral')[k]), ['series', 'Deep Blue Atlas', 'The Kelp Cathedral']);
  assert.equal(byTitle(r, 'Mission: Improbable').kind, 'movie');
  assert.equal(byTitle(r, 'Comedy Night: Live at the Ferry Hall').kind, 'movie');
  assert.equal(byTitle(r, 'saltmarsh inspectors: Season 2: Lowercase').show, 'Saltmarsh Inspectors');
  const shows = S.compute(r.entries, { year: 2026 }).shows.map((s) => s.name + '=' + s.episodes);
  assert.ok(shows.includes('Saltmarsh Inspectors=3'), shows.join(', '));
  assert.ok(shows.includes('Orbit Station: Nova Ring=2'));
});

test('main export: detected, every row parsed, US dates', () => {
  const r = P.parseAny(read('NetflixViewingHistory.csv'), 'NetflixViewingHistory.csv');
  assert.equal(r.source, 'simple');
  assert.equal(r.skipped, 0);
  assert.equal(r.dateOrder, 'mdy');
  assert.equal(r.entries.length, read('NetflixViewingHistory.csv').trim().split('\n').length - 1);
  assert.ok(r.entries.every((e) => e.date.y === 2025 || e.date.y === 2026));
});

test('same history in UK, German, spreadsheet-ISO and headerless forms parses to the same dates', () => {
  const us = P.parseAny(read('NetflixViewingHistory.csv')).entries.map((e) => e.title + P.dateKey(e.date));
  ['NetflixViewingHistory_uk.csv', 'NetflixViewingHistory_de.csv'].forEach((f) => {
    assert.deepEqual(P.parseAny(read(f)).entries.map((e) => e.title + P.dateKey(e.date)), us, f);
  });
  assert.deepEqual(P.parseAny(read('excel_semicolon.csv')).entries.map((e) => e.title + P.dateKey(e.date)), us.slice(0, 120));
  const nh = P.parseAny(read('no_header.csv'));
  assert.equal(nh.entries.length, 40);
  assert.deepEqual(nh.entries.map((e) => e.title + P.dateKey(e.date)), us.slice(0, 40));
});

test('data-request archive: ViewingActivity.csv, two profiles, trailers/previews/repeat sessions dropped', async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(FX, 'netflix-report.zip')));
  const text = await zip.file('CONTENT_INTERACTION/ViewingActivity.csv').async('string');
  const r = P.parseAny(text, 'ViewingActivity.csv');
  assert.equal(r.source, 'archive');
  assert.deepEqual(r.profiles.map((p) => p.name), ['Sam', 'Robin']);
  assert.ok(r.extras > 0, 'trailers and short previews are counted as extras');
  assert.ok(!r.entries.some((e) => /Trailer/.test(e.title)));
  const simple = P.parseAny(read('NetflixViewingHistory.csv')).entries.length;
  assert.equal(r.entries.filter((e) => e.profile === 'Sam').length, simple, 'Sam matches the per-profile download exactly');
});

test('errors: not an export, header only', () => {
  assert.throws(() => P.parseAny(read('not_netflix.csv')), /doesn.t look like a Netflix viewing history/);
  assert.throws(() => P.parseAny(read('empty.csv')), /doesn.t look like|nothing watched/);
  assert.throws(() => P.parseAny(''), /doesn.t look like/);
});

test('stats: the sample year', () => {
  const r = P.parseAny(read('NetflixViewingHistory.csv'));
  const s = S.compute(r.entries, { year: 2026 });
  assert.equal(s.count, r.entries.filter((e) => e.date.y === 2026).length);
  assert.equal(s.episodes + s.movies, s.count);
  assert.ok(s.prevCount > 0 && s.prevCount < s.count);
  assert.equal(s.topShow.name, 'Saltmarsh Inspectors');
  assert.equal(s.binge.count, 11);
  assert.deepEqual(s.binge.date, { y: 2026, mo: 3, d: 14 });
  assert.equal(s.binge.show, 'Saltmarsh Inspectors');
  assert.ok(s.streak.len >= 19, 'January streak');
  assert.equal(s.months.reduce((a, b) => a + b, 0), s.count);
  assert.equal(s.weekdays.reduce((a, b) => a + b, 0), s.count);
  assert.equal(s.comfort.name, 'Nightshift at Juniper General');
  assert.ok(s.comfort.months >= 3 && s.comfort.priorYears === 1);
  assert.equal(s.first.date.y, 2026); assert.equal(s.first.date.mo, 1);
  assert.ok(s.last.day >= s.first.day);
  assert.ok(S.PERSONAS[s.personality.id]);
  const all = S.compute(r.entries, { year: null });
  assert.equal(all.count, r.entries.length);
  assert.deepEqual(Object.keys(all.byYear), ['2025', '2026']);
});

test('stats: streak, binge tie-breaks and first/last use the file order within a day', () => {
  const csv = 'Title,Date\n' + [
    ['C: Season 1: Three', '1/3/26'], ['B: Season 1: Two', '1/3/26'], ['A: Season 1: One', '1/2/26'],
    ['Film Two', '1/1/26'], ['Film One', '1/1/26'], ['Old', '12/31/25']
  ].map((r) => `"${r[0]}","${r[1]}"`).join('\n');
  const s = S.compute(P.parseAny(csv).entries, { year: 2026 });
  assert.equal(s.first.title, 'Film One');
  assert.equal(s.last.title, 'C: Season 1: Three');
  assert.equal(s.streak.len, 3);
  assert.equal(s.binge.count, 2);
  assert.equal(s.movies, 2);
});

test('cards: 8-10 cards for the sample, every card has a label, all-time and tiny years still build', () => {
  const r = P.parseAny(D.csv({ year: 2026, endMonth: 11, endDay: 13 }));
  const s = S.compute(r.entries, { year: 2026 });
  const cards = C.build(s, { title: 'My 2026 on screen', year: 2026, periodShort: '2026' });
  assert.ok(cards.length >= 8 && cards.length <= 10, cards.length);
  const ids = cards.map((c) => c.id);
  ['titles', 'topshow', 'binge', 'when', 'mix', 'comfort', 'streak', 'firstlast', 'persona'].forEach((id) => assert.ok(ids.includes(id), id));
  const all = C.build(S.compute(r.entries, { year: null }), { title: 'x', year: null, periodShort: 'All time' });
  assert.ok(all.length >= 8);
  const tiny = C.build(S.compute(P.parseAny(read('tiny.csv')).entries, { year: 2026 }), { title: 'x', year: 2026, periodShort: '2026' });
  assert.ok(tiny.length >= 3 && tiny.every((c) => c.label));
});

test('demo deck uses only invented titles', () => {
  const titles = D.SHOWS.map((s) => s.name).concat(D.MOVIES);
  const real = /^(stranger things|the crown|wednesday|squid game|bridgerton|ozark|narcos|you|dark|lupin|money heist|the witcher|breaking bad|friends|the office|black mirror|cobra kai|emily in paris|outer banks|the queen's gambit)$/i;
  assert.ok(!titles.some((t) => real.test(t)));
});

// ---- QA Nov 15 2026 ----
test('Korean, Hungarian and Czech account locales (spaced dotted dates) parse to the same days', () => {
  const keys = (f) => P.parseAny(fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'), f).entries.map((e) => P.dateKey(e.date));
  const ko = keys('NetflixViewingHistory_ko.csv'), hu = keys('NetflixViewingHistory_hu.csv'), cs = keys('NetflixViewingHistory_cs.csv');
  assert.ok(ko.length > 30);
  assert.deepEqual(hu, ko);
  assert.deepEqual(cs, ko);
  assert.ok(ko.every((k) => k >= 20250101 && k <= 20261113));
  assert.deepEqual(P.parseDate('26. 1. 2.'), { y: 2026, mo: 1, d: 2 });
  assert.deepEqual(P.parseDate('2026. 01. 02.'), { y: 2026, mo: 1, d: 2 });
  assert.deepEqual(P.parseDate('2. 1. 2026'), { y: 2026, mo: 1, d: 2 });
});

// Found on real exports (see bots/launch/REAL_EXPORT_TESTS.md); fixture is synthetic.
test('real-export regression: "Show: Show 3: Chapter One" seasons and "Chapter N" episodes stay one show', () => {
  assert.deepEqual(T('Night Signal: Night Signal 3: Chapter One: Static'), ['series', 'Night Signal', 'Night Signal 3', 'Chapter One: Static']);
  assert.deepEqual(T('Night Signal: Chapter One: The Vanishing'), ['series', 'Night Signal', '', 'Chapter One: The Vanishing']);
  const r = P.parseAny(read('numbered_seasons.csv'));
  const s = S.compute(r.entries, { year: 2026 });
  const ns = s.shows.find((x) => x.name === 'Night Signal');
  assert.equal(ns.episodes, 6);
  assert.deepEqual(ns.seasons.sort(), ['Night Signal 2', 'Night Signal 3']);
  assert.ok(!s.shows.some((x) => /^Night Signal: /.test(x.name)), 'no "Night Signal: Night Signal 3" show');
});
