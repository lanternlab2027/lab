// Unit tests for docs/then/game.js. Run: node --test bots/then/test_game.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const G = require(path.resolve(__dirname, '../../docs/then/game.js'));
const sched = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../docs/then/schedule.json'), 'utf8'));

test('epoch is puzzle #1 and numbering is per NY calendar day', () => {
  assert.equal(G.puzzleNumberForDate(G.EPOCH), 1);
  assert.equal(G.puzzleNumberForDate('2026-11-15'), 2);
  assert.equal(G.puzzleNumberForDate('2027-01-01'), 49);
  assert.equal(G.puzzleNumberForDate('2020-01-01'), 1, 'dates before launch clamp to #1');
  assert.equal(G.dateForPuzzle(1), G.EPOCH);
  for (let n = 1; n < 800; n += 37) assert.equal(G.puzzleNumberForDate(G.dateForPuzzle(n)), n);
});

test('New York day boundary in winter (EST, UTC-5)', () => {
  assert.equal(G.nyDate(new Date('2026-11-15T04:59:59Z')), '2026-11-14');
  assert.equal(G.nyDate(new Date('2026-11-15T05:00:00Z')), '2026-11-15');
  assert.equal(G.puzzleNumberAt(new Date('2026-11-15T04:59:59Z')), 1);
  assert.equal(G.puzzleNumberAt(new Date('2026-11-15T05:00:00Z')), 2);
  // UTC midnight is still the previous NY day
  assert.equal(G.puzzleNumberAt(new Date('2026-11-15T00:30:00Z')), 1);
});

test('New York day boundary in summer (EDT, UTC-4)', () => {
  assert.equal(G.nyDate(new Date('2027-07-04T03:59:59Z')), '2027-07-03');
  assert.equal(G.nyDate(new Date('2027-07-04T04:00:00Z')), '2027-07-04');
});

test('DST transitions do not skip or repeat a puzzle', () => {
  // Spring forward 2027-03-14 (23h day); fall back 2027-11-07 (25h day).
  const days = (startIso, hours) => {
    const seen = [];
    for (let h = 0; h <= hours; h++) {
      const n = G.puzzleNumberAt(new Date(Date.parse(startIso) + h * 3600000));
      if (seen[seen.length - 1] !== n) seen.push(n);
    }
    return seen;
  };
  for (const [start, mid] of [['2027-03-12T12:00:00Z', '2027-03-14'], ['2027-11-05T12:00:00Z', '2027-11-07']]) {
    const seq = days(start, 96);
    for (let i = 1; i < seq.length; i++) assert.equal(seq[i], seq[i - 1] + 1, 'consecutive');
    assert.ok(seq.includes(G.puzzleNumberForDate(mid)));
  }
  // Exact boundaries around DST days
  assert.equal(G.nyDate(new Date('2027-03-14T04:59:59Z')), '2027-03-13'); // still EST
  assert.equal(G.nyDate(new Date('2027-03-14T05:00:00Z')), '2027-03-14');
  assert.equal(G.nyDate(new Date('2027-03-15T03:59:59Z')), '2027-03-14'); // now EDT
  assert.equal(G.nyDate(new Date('2027-03-15T04:00:00Z')), '2027-03-15');
  assert.equal(G.nyDate(new Date('2027-11-07T03:59:59Z')), '2027-11-06'); // EDT
  assert.equal(G.nyDate(new Date('2027-11-07T04:00:00Z')), '2027-11-07');
  assert.equal(G.nyDate(new Date('2027-11-08T04:59:59Z')), '2027-11-07'); // EST again
  assert.equal(G.nyDate(new Date('2027-11-08T05:00:00Z')), '2027-11-08');
});

test('msUntilNext handles 23h and 25h days', () => {
  const near = (a, b) => Math.abs(a - b) <= 1000;
  assert.ok(near(G.msUntilNext(new Date('2027-03-14T05:00:00Z')), 23 * 3600000));
  assert.ok(near(G.msUntilNext(new Date('2027-11-07T04:00:00Z')), 25 * 3600000));
  assert.ok(near(G.msUntilNext(new Date('2026-11-15T04:00:00Z')), 3600000));
});

test('schedule: no repeat within any 120-day window, deterministic', () => {
  const N = sched.photos.length;
  assert.ok(N >= 120, 'at least 120 photos, got ' + N);
  for (let start = 1; start <= 400; start++) {
    const ids = new Set();
    for (let n = start; n < start + 120; n++) ids.add(sched.photos[G.photoIndex(n, N)].id);
    assert.equal(ids.size, 120, 'window starting at #' + start);
  }
  assert.equal(G.photoIndex(1, N), 0);
  assert.equal(G.photoIndex(N + 1, N), 0);
  assert.equal(G.photoIndex(5, N), G.photoIndex(5, N));
});

test('schedule entries are complete and rights are verified', () => {
  const ids = new Set();
  for (const p of sched.photos) {
    assert.ok(!ids.has(p.id)); ids.add(p.id);
    for (const k of ['id', 'title', 'caption', 'year', 'place', 'borough', 'url', 'rights', 'file', 'fact', 'credit', 'date_loc', 'w', 'h']) assert.ok(p[k] !== undefined && p[k] !== '', p.id + ' missing ' + k);
    assert.match(p.rights, /^No known restrictions/, p.id);
    assert.match(p.url, /^https:\/\/www\.loc\.gov\/(item|pictures\/item)\//);
    assert.ok(G.BOROUGHS.includes(p.borough), p.id + ' borough');
    assert.ok(Array.isArray(p.ok) && p.ok.includes(p.borough) && p.ok.every((b) => G.BOROUGHS.includes(b)), p.id + ' ok boroughs');
    assert.ok(Number.isInteger(p.year) && p.year >= sched.minYear && p.year <= sched.maxYear, p.id + ' year');
    assert.ok(fs.statSync(path.resolve(__dirname, '../../docs/then/img', p.file)).size < 125 * 1024, p.file + ' size');
    assert.ok(!String(p.file).includes(String(p.year)), 'file name must not leak the year');
  }
});

test('hint: direction and tiers', () => {
  assert.deepEqual([G.hint(1910, 1910).tier, G.hint(1910, 1910).dir], ['hit', 'correct']);
  assert.equal(G.hint(1900, 1910).dir, 'later');
  assert.equal(G.hint(1920, 1910).dir, 'earlier');
  assert.equal(G.hint(1907, 1910).tier, 'close');
  assert.equal(G.hint(1913, 1910).tier, 'close');
  assert.equal(G.hint(1906, 1910).tier, 'warm');
  assert.equal(G.hint(1920, 1910).tier, 'warm');
  assert.equal(G.hint(1921, 1910).tier, 'cold');
  assert.match(G.hint(1900, 1910).text, /^Later/);
  assert.match(G.hint(1950, 1910).text, /^Earlier/);
  assert.equal(G.hint(1910, 1910).emoji, '\u{1F7E9}');
  assert.equal(G.hint(1912, 1910).emoji, '\u{1F7E8}');
  assert.equal(G.hint(1918, 1910).emoji, '\u{1F7E7}');
  assert.equal(G.hint(1890, 1910).emoji, '\u2B1B');
});

test('bounds narrow with higher/lower guesses', () => {
  assert.deepEqual(G.bounds([], 1910, 1880, 1970), { lo: 1880, hi: 1970 });
  assert.deepEqual(G.bounds([1900, 1930, 1905, 1915], 1910, 1880, 1970), { lo: 1906, hi: 1914 });
  assert.deepEqual(G.bounds([1910], 1910, 1880, 1970), { lo: 1880, hi: 1970 });
});

test('game over and share text', () => {
  assert.equal(G.isOver([1900, 1910], 1910), true);
  assert.equal(G.isOver([1, 2, 3, 4], 1910), false);
  assert.equal(G.isOver([1, 2, 3, 4, 5], 1910), true);
  assert.equal(G.shareText(12, [1890, 1908, 1910], 1910, null, 'Manhattan'),
    'NYC Then #12 \u2B1B\u{1F7E8}\u{1F7E9} 3/5\nlanternlab2027.github.io/lab/then');
  assert.equal(G.shareText(3, [1950, 1940, 1930, 1925, 1918], 1910, 'Brooklyn', 'Manhattan'),
    'NYC Then #3 \u2B1B\u2B1B\u2B1B\u2B1B\u{1F7E7} X/5 \u{1F4CD}\u274C\nlanternlab2027.github.io/lab/then');
  assert.match(G.shareText(1, [1910], 1910, 'Manhattan', 'Manhattan'), / 1\/5 \u{1F4CD}\u2705\n/u);
});

test('borough check accepts a list for bridges', () => {
  assert.equal(G.boroughOk('Brooklyn', ['Manhattan', 'Brooklyn']), true);
  assert.equal(G.boroughOk('Queens', ['Manhattan', 'Brooklyn']), false);
  assert.equal(G.boroughOk('Bronx', 'Bronx'), true);
  assert.equal(G.boroughOk(null, 'Bronx'), false);
  assert.match(G.shareText(4, [1910], 1910, 'Brooklyn', ['Manhattan', 'Brooklyn']), /\u2705/u);
});

test('stats and streaks', () => {
  const d = {
    1: { done: true, won: true, live: true, guesses: [1, 2] },
    2: { done: true, won: true, live: true, guesses: [1] },
    3: { done: true, won: false, live: true, guesses: [1, 2, 3, 4, 5] },
    4: { done: true, won: true, live: true, guesses: [1, 2, 3] },
    5: { done: true, won: true, live: true, guesses: [1] },
  };
  let s = G.stats(d, 6); // today (#6) not yet played: streak carries
  assert.equal(s.played, 5); assert.equal(s.won, 4); assert.equal(s.winPct, 80);
  assert.equal(s.current, 2); assert.equal(s.best, 2);
  assert.deepEqual(s.dist, [2, 1, 1, 0, 0]);
  s = G.stats(d, 7); // missed #6
  assert.equal(s.current, 0);
  const archive = { 1: { done: true, won: true, live: false, guesses: [1] } };
  s = G.stats(archive, 5);
  assert.equal(s.played, 1); assert.equal(s.current, 0, 'archive plays do not build streaks');
  assert.deepEqual(G.stats({}, 1), { played: 0, won: 0, winPct: 0, current: 0, best: 0, dist: [0, 0, 0, 0, 0] });
});
