// Unit tests for docs/tiktok/parser.js, stats.js and cards.js build(). Run: node --test bots/tiktok/test_parser.js
// Fixtures are synthetic (bots/tiktok/make_fixtures.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('../../docs/tiktok/parser.js');
const S = require('../../docs/tiktok/stats.js');
const C = require('../../docs/tiktok/cards.js');
const D = require('../../docs/tiktok/demo.js');
const JSZip = require('../../docs/tiktok/vendor/jszip-3.10.1.min.js');
const FX = path.join(__dirname, 'fixtures');
const CANARY = 'SECRET-DM-CANARY-7731';
const read = (f) => fs.readFileSync(path.join(FX, f), 'utf8');
const parse = (f) => P.parseFiles([{ name: f, text: read(f) }]);
async function parseZip(f) {
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(FX, f)));
  const paths = []; zip.forEach((p, e) => { if (!e.dir) paths.push(p); });
  const pick = P.pickEntries(paths);
  const files = [];
  for (const e of pick.read) files.push({ name: e.path, text: await zip.file(e.path).async('string') });
  return { parsed: P.parseFiles(files, { skippedDm: pick.skipped.dm }), pick, files };
}
const summary = (p) => [p.watch.length, p.likes.length, p.searches.length, p.comments.length, p.shares.length, p.logins.length];

test('dates: TikTok UTC stamps, " UTC" suffix, ISO T/Z, epoch; invalid rejected', () => {
  assert.equal(P.parseDate('2026-03-01 03:30:00'), Date.UTC(2026, 2, 1, 3, 30, 0));
  assert.equal(P.parseDate('2026-03-01 03:30:00 UTC'), Date.UTC(2026, 2, 1, 3, 30, 0));
  assert.equal(P.parseDate('2026-03-01T03:30:00Z'), Date.UTC(2026, 2, 1, 3, 30, 0));
  assert.equal(P.parseDate('2026-03-01T03:30:00.123'), Date.UTC(2026, 2, 1, 3, 30, 0));
  assert.equal(P.parseDate(1772335800), 1772335800000);
  assert.ok(Number.isNaN(P.parseDate('2026-02-30 10:00:00')));
  assert.ok(Number.isNaN(P.parseDate('yesterday')));
  assert.ok(Number.isNaN(P.parseDate(undefined)));
});

test('time zones: UTC export times convert to local calendar days and hours', () => {
  const t = P.parseDate('2026-03-01 03:30:00');
  assert.deepEqual([P.localParts(t, 'UTC').d, P.localParts(t, 'UTC').h], [1, 3]);
  const ny = P.localParts(t, 'America/New_York'); // EST, UTC-5
  assert.deepEqual([ny.mo, ny.d, ny.h, ny.mi], [2, 28, 22, 30]);
  const tokyo = P.localParts(t, 'Asia/Tokyo');
  assert.deepEqual([tokyo.d, tokyo.h], [1, 12]);
  const summer = P.localParts(P.parseDate('2026-06-30 23:30:00'), 'America/New_York'); // EDT, UTC-4
  assert.deepEqual([summer.mo, summer.d, summer.h], [6, 30, 19]);
  const kolkata = P.localParts(P.parseDate('2026-06-30 23:30:00'), 'Asia/Kolkata'); // +5:30 crosses midnight
  assert.deepEqual([kolkata.mo, kolkata.d, kolkata.h, kolkata.mi], [7, 1, 5, 0]);
  // a New Year's Eve video at 9pm New York is 2am UTC next year: year assignment follows the chosen zone
  const p = parse('tz.json');
  assert.deepEqual(S.years(p.watch, 'UTC').map((y) => y.year), [2026]);
  assert.deepEqual(S.years(p.watch, 'America/New_York').map((y) => [y.year, y.count]), [[2026, 3], [2025, 1]]);
  const s = S.compute(p, { year: 2026, tz: 'America/New_York' });
  assert.equal(s.count, 3);
  assert.equal(s.hours[22], 2); // the 03:30 UTC pair at 10:30pm local
  assert.equal(S.compute(p, { year: 2026, tz: 'UTC' }).nightCount, 3);
  assert.ok(P.validZone('Europe/Berlin') && !P.validZone('Mars/Olympus'));
});

test('JSON 2024+ layout: every section found, DMs dropped, comment text not kept', () => {
  const p = parse('user_data_tiktok.json');
  assert.equal(p.layout, '2024+'); assert.equal(p.format, 'json');
  const raw = JSON.parse(read('user_data_tiktok.json'));
  const A = raw['Your Activity'];
  assert.equal(p.watch.length, A['Watch History'].VideoList.length);
  assert.equal(p.likes.length, raw['Likes and Favorites']['Like List'].ItemFavoriteList.length);
  assert.equal(p.searches.length, A.Searches.SearchList.length);
  assert.equal(p.comments.length, raw.Comment.Comments.CommentsList.length);
  assert.equal(p.shares.length, A['Share History'].ShareHistoryList.length);
  assert.equal(p.logins.length, A['Login History'].LoginHistoryList.length);
  assert.ok(p.watch.every((t, i) => i === 0 || t >= p.watch[i - 1]), 'watch sorted ascending');
  const dump = JSON.stringify(p);
  assert.ok(!dump.includes(CANARY), 'DM content never reaches the parsed result');
  assert.ok(!dump.includes('so good'), 'comment text is not kept');
  assert.ok(!dump.includes('192.0.2.'), 'login IPs are not kept');
});

test('JSON legacy layout (Activity > Video Browsing History) gives the same counts; posted videos are not watch history', () => {
  const a = parse('user_data_tiktok.json'), b = parse('user_data_legacy.json');
  assert.equal(b.layout, 'legacy');
  assert.deepEqual(summary(b), summary(a));
  assert.ok(!JSON.stringify(b).includes(CANARY));
});

test('TXT zip export matches the JSON export exactly; message files are never opened', async () => {
  const { parsed, pick, files } = await parseZip('tiktok_txt_export.zip');
  assert.equal(parsed.format, 'txt');
  assert.equal(pick.skipped.dm, 1);
  assert.ok(files.every((f) => !/Direct Message/i.test(f.name)), 'DM file not in the read list');
  const j = parse('user_data_tiktok.json');
  assert.deepEqual(summary(parsed), summary(j));
  assert.deepEqual(parsed.watch, j.watch);
  assert.deepEqual(parsed.searches, j.searches);
  assert.equal(parsed.skippedDm, 1);
});

test('legacy TXT zip (Browsing History.txt, CRLF, no UTC suffix) and a lone Watch History.txt', async () => {
  const { parsed } = await parseZip('tiktok_txt_legacy.zip');
  const j = parse('user_data_tiktok.json');
  assert.deepEqual(parsed.watch, j.watch);
  assert.equal(parsed.likes.length, j.likes.length);
  assert.equal(parsed.searches.length, j.searches.length);
  const lone = parse('Watch History.txt');
  assert.deepEqual(lone.watch, j.watch);
  assert.equal(lone.found.likes, undefined);
});

test('JSON inside a zip is preferred over anything else', async () => {
  const { parsed, pick } = await parseZip('tiktok_json_export.zip');
  assert.deepEqual(pick.read.map((r) => r.path), ['user_data_tiktok.json']);
  assert.deepEqual(summary(parsed), summary(parse('user_data_tiktok.json')));
});

test('TXT blocks: labels, continuation lines, BOM, "::" labels, URLs not mistaken for labels', () => {
  const b = P.parseTxtBlocks('﻿Date: 2026-01-02 03:04:05 UTC\r\nLink: https://www.tiktokv.com/share/video/1/\r\n\r\nDate: 2026-01-03 00:00:00\nSearch Term: cats\nand dogs\n\n\nHashTag Link:: https://x/tag\n');
  assert.equal(b.length, 3);
  assert.equal(b[0].link, 'https://www.tiktokv.com/share/video/1/');
  assert.equal(b[1]['search term'], 'cats and dogs');
  assert.equal(b[2]['hashtag link'], 'https://x/tag');
});

test('classifyPath / pickEntries: names, legacy names, DMs, junk', () => {
  assert.equal(P.classifyPath('TikTok/Your Activity/Watch History.txt'), 'watch');
  assert.equal(P.classifyPath('Activity/Browsing History.txt'), 'watch');
  assert.equal(P.classifyPath('Likes and Favourites/Like List.txt'), 'likes');
  assert.equal(P.classifyPath('Your Activity/Searches.txt'), 'searches');
  assert.equal(P.classifyPath('Comment/Comments.txt'), 'comments');
  assert.equal(P.classifyPath('Direct Message/Direct Messages.txt'), 'dm');
  assert.equal(P.classifyPath('Direct Messages/Chat History/friend.txt'), 'dm');
  assert.equal(P.classifyPath('__MACOSX/._user_data_tiktok.json'), 'skip');
  assert.equal(P.classifyPath('user_data_tiktok.json'), 'json');
  assert.equal(P.classifyPath('Your Activity/Favourite Videos.txt'), 'txt?');
  const pk = P.pickEntries(['a/Watch History.txt', 'a/Direct Messages.txt', 'a/Status.txt']);
  assert.deepEqual(pk.read.map((r) => r.kind), ['watch', 'txt']);
  assert.equal(pk.skipped.dm, 1);
});

test('empty sections, missing sections, not-TikTok and empty files give clear errors', () => {
  assert.throws(() => parse('empty_sections.json'), /watch history is empty/);
  assert.throws(() => P.parseFiles([{ name: 'user_data_tiktok.json', text: JSON.stringify({ 'Likes and Favorites': { 'Like List': { ItemFavoriteList: [{ date: '2026-01-01 00:00:00', link: 'x' }] } } }) }]), /no watch history/);
  assert.throws(() => parse('not_tiktok.json'), /doesn.t look like a TikTok data export/);
  assert.throws(() => parse('empty.json'), /doesn.t look like/);
  assert.throws(() => P.parseFiles([{ name: 'user_data_tiktok.json', text: '{"Your Activity": ' }]), /couldn.t be read/);
  const w = parse('watch_only.json');
  assert.equal(w.watch.length, 900);
  assert.ok(w.found.searches && !w.found.likes);
  const s = S.compute(w, { year: 2026, tz: 'UTC' });
  assert.equal(s.hasLikes, false); assert.equal(s.searches, 0);
  const ids = C.build(s, { year: 2026, title: 'x', periodShort: '2026' }).map((c) => c.id);
  assert.ok(!ids.includes('likes') && !ids.includes('searches'), 'no likes or searches card without that data: ' + ids);
});

test('duplicates across files are dropped (JSON + TXT of the same export)', async () => {
  const { files } = await parseZip('tiktok_txt_export.zip');
  const both = P.parseFiles(files.concat([{ name: 'user_data_tiktok.json', text: read('user_data_tiktok.json') }]));
  assert.equal(both.format, 'json+txt');
  assert.deepEqual(summary(both), summary(parse('user_data_tiktok.json')));
});

test('stats: estimate, busiest day, streak, doomscroll, night share, likes, searches', () => {
  const p = parse('tiny.json');
  const s = S.compute(p, { year: 2026, tz: 'UTC' });
  assert.equal(s.count, 3);
  assert.equal(s.minutesEst, Math.round(3 * S.AVG_SECONDS / 60));
  assert.equal(s.busiest.count, 2);
  assert.equal(s.busiest.hourly[21], 2);
  assert.equal(s.streak.len, 1);
  assert.equal(s.session.n, 2); assert.equal(s.session.dur, 40000);
  // a gap of exactly 2 minutes ends a session
  const mk = (ts) => ({ watch: ts.map((x) => Date.UTC(2026, 4, 1, 10, 0, x)), likes: [], searches: [], comments: [], shares: [], logins: [], found: { watch: true } });
  const s2 = S.compute(mk([0, 60, 180, 200, 220, 260, 400]), { year: 2026, tz: 'UTC' });
  assert.deepEqual([s2.session.n, s2.session.dur], [4, 80000]);
  const s3 = S.compute(mk([0, 119, 238]), { year: 2026, tz: 'UTC' });
  assert.equal(s3.session.n, 3);

  const full = S.compute(parse('user_data_tiktok.json'), { year: 2026, tz: 'America/New_York', today: Math.floor(Date.UTC(2026, 10, 15) / 86400000) });
  assert.ok(full.count > 10000);
  assert.ok(full.session.minutes >= 60, 'the invented July marathon shows up');
  assert.equal(full.busiest.day, Math.floor(Date.UTC(2026, 6, 19) / 86400000));
  assert.ok(full.nightShare > 0 && full.nightShare < 0.5);
  assert.ok(full.likeRate > 0.05 && full.likeRate < 0.15);
  assert.equal(full.topTerms[0].term, 'sourdough starter');
  assert.equal(full.months[11], 0);
  assert.ok(full.streak.len >= 7);
  assert.ok(full.prevCount > 0);
  const all = S.compute(parse('user_data_tiktok.json'), { year: null, tz: 'UTC' });
  assert.equal(all.count, parse('user_data_tiktok.json').watch.length);
  assert.equal(S.normTerm('  #Sourdough   Starter '), 'sourdough starter');
});

test('cards: 10 cards for a full export; searches card hides terms unless opted in', () => {
  const s = S.compute(parse('user_data_tiktok.json'), { year: 2026, tz: 'America/New_York', today: 20771 });
  const cards = C.build(s, { year: 2026, title: 'My 2026 scroll', periodShort: '2026' });
  assert.deepEqual(cards.map((c) => c.id), ['videos', 'time', 'busiest', 'clock', 'month', 'session', 'streak', 'likes', 'searches', 'summary']);
  assert.ok(C.persona(s).name.startsWith('The '));
  const demo = P.parseFiles([{ name: 'sample.json', text: JSON.stringify(D.build({ year: 2026, endMonth: 11, endDay: 14 })) }]);
  assert.ok(!JSON.stringify(D.build({ year: 2026 })).includes('Direct'), 'demo export has no messages section');
  assert.ok(demo.watch.length > 10000);
});
