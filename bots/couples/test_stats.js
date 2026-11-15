// Unit tests for docs/couples/stats.js (on top of the shared docs/wrapped/parser.js).
// Run: node --test bots/couples/test_stats.js   Fixtures are synthetic (bots/couples/make_fixtures.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const S = require('../../docs/couples/stats.js');
const Cards = require('../../docs/couples/cards.js');
const Demo = require('../../docs/couples/demo.js');
const FX = path.join(__dirname, 'fixtures');
const WFX = path.join(__dirname, '../wrapped/fixtures');
const load = (f, dir) => { const r = S.parseExport(fs.readFileSync(path.join(dir || FX, f), 'utf8'), f); return { r, c: S.classify(r.messages, r) }; };
const run = (f, opts) => { const { r, c } = load(f); assert.ok(c.ok, f + ' should be 1:1'); return S.compute(r.messages, c.people, opts || {}); };
const by = (st, n) => st.persons.find((p) => p.name === n);

test('iOS 1:1 (English): counts, system lines dropped, people', () => {
  const { r, c } = load('ios_1to1_en.txt');
  assert.equal(r.dateOrder, 'MDY');
  assert.deepEqual(c.people, ['Priya Shah', 'Tom Reyes']);
  const st = S.compute(r.messages, c.people);
  assert.equal(st.total, 12); // encryption notice + missed call are system lines
  assert.equal(by(st, 'Priya Shah').count, 7);
  assert.equal(by(st, 'Tom Reyes').count, 5);
});

test('reply time: median per person, only on sender change, gaps over 12h ignored', () => {
  const st = run('ios_1to1_en.txt');
  assert.deepEqual(by(st, 'Tom Reyes').replyGaps, [120, 60, 600]);
  assert.equal(by(st, 'Tom Reyes').medianReply, 120);
  // 2h23m counts (under 12h); the Jan 17 -> Jan 19 gap does not.
  assert.deepEqual(by(st, 'Priya Shah').replyGaps, [8580, 120, 300]);
  assert.equal(by(st, 'Priya Shah').medianReply, 300);
  // German: a 7h48m overnight gap is a reply, and the median of two is their mean.
  const de = run('ios_de_1to1.txt');
  assert.deepEqual(by(de, 'Anna M\u00fcller').replyGaps, [477, 28110]);
  assert.equal(by(de, 'Jonas Weber').medianReply, 495);
  // Exactly-12h boundary: 12h counts, 12h + 1s does not.
  const mk = (sec) => [{ t: 0, y: 2026, mo: 1, d: 1, h: 8, mi: 0, sender: 'A', text: 'x', kind: 'text' }, { t: sec * 1000, y: 2026, mo: 1, d: 1, h: 20, mi: 0, sender: 'B', text: 'y', kind: 'text' }];
  assert.deepEqual(S.compute(mk(43200), ['A', 'B']).persons[1].replyGaps, [43200]);
  assert.deepEqual(S.compute(mk(43201), ['A', 'B']).persons[1].replyGaps, []);
});

test('first texter of the morning: first message at or after 5 AM each day', () => {
  const st = run('ios_1to1_en.txt');
  // Jan 15 Priya (9:05 PM), Jan 16 Tom, Jan 17 Priya (2:10 AM doesn't count, 9:00 AM does), Jan 19 Tom
  assert.equal(by(st, 'Priya Shah').morningFirst, 2);
  assert.equal(by(st, 'Tom Reyes').morningFirst, 2);
  assert.equal(st.morningDays, 4);
  const tg = run('telegram_personal.json');
  assert.equal(by(tg, 'Sam Park').morningFirst, 2);
  assert.equal(by(tg, 'Kai Chen').morningFirst, 0);
});

test('streak, busiest day, late-night share, first message date', () => {
  const st = run('ios_1to1_en.txt');
  assert.equal(st.streak.days, 3);
  assert.deepEqual(st.streak.start, { y: 2026, mo: 1, d: 15 });
  assert.deepEqual(st.streak.end, { y: 2026, mo: 1, d: 17 });
  assert.deepEqual(st.busiest, { y: 2026, mo: 1, d: 15, count: 4 });
  assert.equal(st.late.count, 3); // 11:30 PM, 11:31 PM, 2:10 AM
  assert.equal(st.late.share, 0.25);
  assert.deepEqual([st.fileFirst.y, st.fileFirst.mo, st.fileFirst.d, st.fileFirst.h, st.fileFirst.mi], [2026, 1, 15, 21, 5]);
  // The busiest-day result carries only a date and a count, never message text.
  assert.deepEqual(Object.keys(st.busiest).sort(), ['count', 'd', 'mo', 'y']);
  // Streak across a month boundary.
  const m = (y, mo, d) => ({ t: new Date(y, mo - 1, d, 12).getTime(), y, mo, d, h: 12, mi: 0, sender: d % 2 ? 'A' : 'B', text: 'x', kind: 'text' });
  const msgs = [m(2026, 1, 30), m(2026, 1, 31), m(2026, 2, 1), m(2026, 2, 2), m(2026, 2, 5)];
  assert.equal(S.compute(msgs, ['A', 'B']).streak.days, 4);
});

test('emoji: top per person and the most-used shared one', () => {
  const st = run('ios_1to1_en.txt');
  assert.deepEqual(by(st, 'Priya Shah').topEmoji, { emoji: '\u{1F618}', count: 2 });
  assert.deepEqual(by(st, 'Tom Reyes').topEmoji, { emoji: '\u2764\ufe0f', count: 2 });
  assert.deepEqual(st.sharedEmoji, { emoji: '\u2764\ufe0f', count: 3 });
  assert.equal(run('android_fr_1to1.txt').sharedEmoji, null);
});

test('goodnight and I-love-you counts across locales', () => {
  const want = {
    'ios_1to1_en.txt': [2, 3],
    'android_es_1to1.txt': [2, 2],
    'ios_de_1to1.txt': [2, 3],
    'android_fr_1to1.txt': [2, 2],
    'ios_pt_1to1.txt': [2, 2],
    'android_it_1to1.txt': [2, 3],
    'telegram_personal.json': [2, 2]
  };
  for (const [f, [gn, ily]] of Object.entries(want)) {
    const st = run(f);
    assert.equal(st.goodnights, gn, f + ' goodnights');
    assert.equal(st.ily, ily, f + ' I love yous');
  }
});

test('keyword matcher: positives and look-alikes', () => {
  const gn = ['Goodnight!!', 'good night \u2764\ufe0f', 'gn', 'Gnight babe', 'nighty night', 'Buenas noches', 'BONNE NUIT', 'Gute Nacht', 'gn8', 'boa noite', 'buonanotte', 'Buona notte', 'welterusten'];
  const notGn = ['sign in', 'gnome', 'knight rider', 'good nightclub', 'tonight', 'midnight snack'];
  gn.forEach((t) => assert.ok(S.hasGoodnight(t), t));
  notGn.forEach((t) => assert.ok(!S.hasGoodnight(t), t));
  const ily = ['I love you', 'love u', 'LOVE YA', 'ily', 'ilysm', 'te quiero', 'Te amo', 'je t\u2019aime', "je t'aime", 'jtm', 'Ich liebe dich', 'hab dich lieb', 'HDL', 'amo-te', 'amo voc\u00ea', 'ti amo', 'ti voglio bene', 'tvb'];
  const notIly = ['lovely', 'I love your dog', 'glove you left', 'family', 'te quiero ver? no wait', 'tvbox'];
  ily.forEach((t) => assert.ok(S.hasILoveYou(t), t));
  notIly.slice(0, 4).concat(notIly.slice(5)).forEach((t) => assert.ok(!S.hasILoveYou(t), t));
  // Counted once per message, not per repetition.
  const mm = [{ t: 0, y: 2026, mo: 1, d: 1, h: 23, mi: 0, sender: 'A', text: 'gn gn goodnight love you love you', kind: 'text' }, { t: 1, y: 2026, mo: 1, d: 1, h: 23, mi: 0, sender: 'B', text: 'x', kind: 'text' }];
  const st = S.compute(mm, ['A', 'B']);
  assert.equal(st.goodnights, 1); assert.equal(st.ily, 1);
});

test('group chats are rejected; tiny strays are dropped', () => {
  let x = load('WhatsApp Chat with Weekend Crew.txt', WFX);
  assert.equal(x.c.ok, false); assert.equal(x.c.reason, 'group'); assert.equal(x.c.people.length, 6);
  x = load('result.json', WFX); // Telegram group
  assert.equal(x.c.reason, 'group');
  x = load('telegram_group_two_senders.json'); // a group type, even with only two talking
  assert.equal(x.c.reason, 'group');
  // One-person export
  x = load('telegram_full_export.json', WFX);
  assert.equal(x.c.ok, false); assert.equal(x.c.reason, 'solo');
  // A third sender with a single line in a big chat is a stray, not a group.
  const r = S.parseExport(Demo.whatsappText(14), 'x.txt');
  const extra = r.messages.concat([{ t: r.messages[5].t + 1, y: 2026, mo: 1, d: 2, h: 9, mi: 0, sender: 'Deleted Account', text: 'hi', kind: 'text' }]);
  const c = S.classify(extra, {});
  assert.ok(c.ok); assert.deepEqual(c.dropped, ['Deleted Account']);
});

test('Telegram full-account export: picks the 1:1 chat, not the busier group', () => {
  const { r, c } = load('telegram_full_export.json');
  assert.equal(r.title, 'Kai Chen');
  assert.ok(c.ok);
  assert.deepEqual(c.people, ['Kai Chen', 'Sam Park']);
});

test('wrapped iOS 1:1 fixture (contact name carries system lines) still works', () => {
  const { r, c } = load('ios_1to1_us.txt', WFX);
  assert.ok(c.ok);
  assert.deepEqual(c.people, ['Priya Shah', 'Tom Reyes']);
  const st = S.compute(r.messages, c.people);
  assert.ok(st.total >= 4);
});

test('periods: last 12 months only offered for long chats, and filters correctly', () => {
  const d = (y, mo, dd, s) => ({ t: new Date(y, mo - 1, dd, 12).getTime(), y, mo, d: dd, h: 12, mi: 0, sender: s, text: 'x', kind: 'text' });
  const msgs = [d(2024, 6, 1, 'A'), d(2025, 3, 1, 'B'), d(2025, 11, 20, 'A'), d(2026, 2, 14, 'B'), d(2026, 11, 10, 'A')];
  const ps = S.periods(msgs).map((p) => p.id);
  assert.deepEqual(ps, ['last12', 'all', '2024', '2025', '2026']);
  const st = S.compute(msgs, ['A', 'B'], { period: 'last12' });
  assert.equal(st.total, 3); // from Nov 11 2025
  assert.equal(st.fileFirst.y, 2024); // first message date always comes from the whole file
  assert.deepEqual(S.periods(msgs.slice(3)).map((p) => p.id), ['all']);
});

test('cards: demo deck builds every card, and no card text comes from messages', () => {
  const r = S.parseExport(Demo.whatsappText(14), 'WhatsApp Chat - Rowan Diaz.zip');
  const c = S.classify(r.messages, r);
  const st = S.compute(r.messages, c.people, { period: 'all' });
  const names = { 'Jamie Lin': 'J.L.', 'Rowan Diaz': 'R.D.' };
  const info = { pair: 'J.L. & R.D.', name: (n) => names[n], periodShort: 'ALL TIME', periodLong: 'x', fileFirst: st.fileFirst, fileLast: st.last };
  const cards = Cards.build(st, info);
  assert.deepEqual(cards.map((k) => k.id), ['intro', 'count', 'reply', 'goodnight', 'emoji', 'streak', 'busiest', 'late', 'ily', 'first', 'summary']);
  // The stats object carries no message text at all.
  const json = JSON.stringify(st);
  ['dinner', 'tacos', 'good morning', 'love you', 'sleep well', 'still up', 'cant sleep'].forEach((w) => assert.ok(!json.includes(w), w));
  // Without goodnights / ily, those cards are skipped.
  const fr = S.compute([{ t: 0, y: 2026, mo: 1, d: 1, h: 9, mi: 0, sender: 'A', text: 'salut', kind: 'text' }, { t: 60000, y: 2026, mo: 1, d: 1, h: 9, mi: 1, sender: 'B', text: 'coucou', kind: 'text' }], ['A', 'B']);
  const ids = Cards.build(fr, { pair: 'A & B', name: (n) => n, periodShort: 'ALL TIME', periodLong: '', fileFirst: fr.fileFirst, fileLast: fr.last }).map((k) => k.id);
  assert.ok(!ids.includes('goodnight') && !ids.includes('ily') && ids.includes('summary'));
});
