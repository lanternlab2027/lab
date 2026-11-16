// Unit tests for docs/wrapped/parser.js and stats.js. Run: node --test bots/wrapped/test_parser.js
// Fixtures are synthetic (bots/wrapped/make_fixtures.py); no real chat data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('../../docs/wrapped/parser.js');
const S = require('../../docs/wrapped/stats.js');
const FX = path.join(__dirname, 'fixtures');
const read = (f) => fs.readFileSync(path.join(FX, f), 'utf8');
const senders = (r) => [...new Set(r.messages.map((m) => m.sender))].sort();

test('iOS US 12h: brackets, seconds, NNBSP, LRM system lines, media, multiline, deleted, edited, ~ names', () => {
  const r = P.parseAny(read('ios_us_12h.txt'), '_chat.txt');
  assert.equal(r.source, 'whatsapp');
  assert.equal(r.dateOrder, 'MDY');
  assert.equal(r.title, 'Taco Tuesday Club');
  assert.deepEqual(senders(r), ['Ana Ruiz', 'Ben Ito', 'Cleo']);
  assert.equal(r.messages.length, 7);
  const media = r.messages.filter((m) => m.kind === 'media');
  assert.equal(media.length, 1);
  assert.equal(r.messages.filter((m) => m.kind === 'deleted').length, 1);
  const multi = r.messages.find((m) => m.sender === 'Cleo');
  assert.equal(multi.text, 'first line\nsecond line of the same message\nthird line');
  const late = r.messages.find((m) => m.text.startsWith('still up'));
  assert.equal(late.text, 'still up haha');
  assert.equal(late.h, 0); // 12:30 AM
  assert.equal(late.d, 15);
  const noon = r.messages.find((m) => m.text === 'noon check');
  assert.equal(noon.h, 12);
  const pm = r.messages.find((m) => m.text.startsWith('who is in'));
  assert.deepEqual([pm.y, pm.mo, pm.d, pm.h, pm.mi], [2025, 3, 14, 9, 1]);
});

test('Android US 12h: dash format, system lines dropped, <Media omitted>, multiline numbered list', () => {
  const r = P.parseAny(read('android_us_12h.txt'), 'WhatsApp Chat with Board Game Night.txt');
  assert.equal(r.dateOrder, 'MDY');
  assert.equal(r.title, 'Board Game Night');
  assert.deepEqual(senders(r), ['Ana Ruiz', 'Ben Ito', 'Cleo Park']);
  assert.equal(r.messages.length, 4);
  assert.equal(r.messages.filter((m) => m.kind === 'media').length, 1);
  const rules = r.messages.find((m) => m.text.startsWith('ok rules'));
  assert.equal(rules.text, 'ok rules:\n1. no flipping the board\n2. snacks are mandatory');
  const morning = r.messages.find((m) => m.sender === 'Cleo Park');
  assert.deepEqual([morning.mo, morning.d, morning.h], [1, 13, 7]);
});

test('Android UK 24h: DD/MM/YYYY detected from day > 12', () => {
  const r = P.parseAny(read('android_uk_24h.txt'));
  assert.equal(r.dateOrder, 'DMY');
  const m = r.messages[0];
  assert.deepEqual([m.y, m.mo, m.d, m.h], [2024, 12, 25, 9]);
  assert.equal(r.messages[2].h, 0);
  assert.equal(r.messages[3].kind, 'media');
});

test('Ambiguous DD/MM (all days <= 12) resolved by chronology', () => {
  const r = P.parseAny(read('android_ambiguous_dmy.txt'));
  assert.equal(r.dateOrder, 'DMY');
  assert.deepEqual(r.messages.map((m) => m.mo + '/' + m.d), ['3/11', '3/12', '4/1', '4/2', '5/3']);
});

test('Ambiguous single-day 12h chat defaults to MM/DD', () => {
  const txt = '3/4/25, 9:00 PM - Ana Ruiz: hi\n3/4/25, 9:01 PM - Ben Ito: hey\n';
  const r = P.parseAny(txt);
  assert.equal(r.dateOrder, 'MDY');
  assert.deepEqual([r.messages[0].mo, r.messages[0].d, r.messages[0].h], [3, 4, 21]);
});

test('iOS German locale: dotted dates, 24h, localized media placeholders', () => {
  const r = P.parseAny(read('ios_de_24h_dots.txt'));
  assert.equal(r.dateOrder, 'DMY');
  assert.equal(r.messages.length, 4);
  assert.deepEqual([r.messages[0].y, r.messages[0].mo, r.messages[0].d, r.messages[0].h], [2024, 1, 15, 21]);
  assert.equal(r.messages.filter((m) => m.kind === 'media').length, 2);
});

test('Spanish "p. m." / "a. m." times', () => {
  const r = P.parseAny(read('android_es_pm.txt'));
  assert.equal(r.dateOrder, 'DMY');
  assert.equal(r.messages[0].h, 21);
  assert.equal(r.messages[1].kind, 'media');
  assert.equal(r.messages[2].h, 0);
});

test('Telegram result.json: rich text arrays, service messages, media, deleted accounts', () => {
  const r = P.parseAny(read('telegram_result.json'));
  assert.equal(r.source, 'telegram');
  assert.equal(r.title, 'Book Swap');
  assert.equal(r.messages.length, 5);
  assert.equal(r.messages[1].text, 'lol thanks https://example.com');
  assert.equal(r.messages[2].kind, 'media');
  assert.equal(r.messages[2].h, 2);
  assert.ok(senders(r).includes('Deleted Account'));
  assert.equal(r.messages[4].kind, 'media'); // sticker
});

test('Telegram full-account export picks the group chat', () => {
  const r = P.parseAny(read('telegram_full_export.json'));
  assert.equal(r.title, 'Book Swap');
});

test('Non-chat files give a friendly error', () => {
  assert.throws(() => P.parseAny('hello\nthis is not a chat\n'), /couldn't find any messages/);
  assert.throws(() => P.parseAny('{"foo": 1}'), /not a Telegram chat export/);
  assert.throws(() => P.parseAny('{broken'), /couldn't be read/);
});

test('A line inside a message that looks date-like but lacks the separator stays in the message', () => {
  const r = P.parseAny('1/5/25, 8:19 PM - Ana Ruiz: dates:\n1/6/25 works for me\n');
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].text, 'dates:\n1/6/25 works for me');
});

test('Stats: awards, laughs, emojis, words exclude names, reply times', () => {
  const r = P.parseAny(read('WhatsApp Chat with Weekend Crew.txt'), 'WhatsApp Chat with Weekend Crew.txt');
  const s = S.compute(r.messages);
  assert.equal(s.memberCount, 6);
  assert.equal(s.awards.yapper.name, 'Maya Chen');
  assert.equal(s.awards.ghost.name, 'Tess Moreno');
  assert.equal(s.awards.nightOwl.name, 'Leo Okafor');
  assert.equal(s.awards.earlyBird.name, 'Sam Rivera');
  assert.equal(s.awards.fastest.name, 'Priya Nair');
  assert.equal(s.awards.essay.name, 'Jonah Baker');
  assert.equal(s.busiest.key, '2026-07-04');
  assert.equal(s.topWords.length, 5);
  const names = ['maya', 'chen', 'leo', 'okafor', 'sam', 'rivera', 'priya', 'nair', 'jonah', 'baker', 'tess', 'moreno'];
  s.topWords.forEach(([w]) => assert.ok(!names.includes(w), w));
  assert.ok(s.topEmojis.length >= 3);
  assert.equal(s.hours.reduce((a, b) => a + b, 0), s.total);
  const y = S.compute(r.messages, { year: 2026 });
  assert.equal(y.total, s.total);
});

test('Stats helpers', () => {
  assert.equal(S.laughsIn('LOL that was funny hahaha \u{1F602}\u{1F602} lollipop'), 4);
  assert.deepEqual(S.emojisIn('hi \u{1F44B}\u{1F3FD} ❤️ \u{1F1FA}\u{1F1F8} \u{1F468}‍\u{1F469}‍\u{1F467}'), ['\u{1F44B}\u{1F3FD}', '❤️', '\u{1F1FA}\u{1F1F8}', '\u{1F468}‍\u{1F469}‍\u{1F467}']);
  assert.equal(S.median([5, 1, 3]), 3);
});

// ---- QA Nov 15 2026 ----
test('iOS 1:1 chat keeps the contact even though their name carries the system lines', () => {
  const r = P.parseAny(read('ios_1to1_us.txt'), '_chat.txt');
  assert.deepEqual(senders(r), ['Priya Shah', 'Tom Reyes']);
  assert.equal(r.title, 'Priya Shah');
  // encryption notice, missed call and poll are dropped as system lines; the image counts as media
  assert.equal(r.messages.length, 5);
  assert.equal(r.messages.filter((m) => m.kind === 'media').length, 1);
  const r2 = P.parseAny(read('ios_1to1_us.txt'), 'WhatsApp Chat - Priya Shah.zip');
  assert.deepEqual(senders(r2), ['Priya Shah', 'Tom Reyes']);
});

test('Korean, Chinese, Finnish, Czech and Arabic Android exports', () => {
  const hm = (r) => r.messages.map((m) => `${m.y}-${m.mo}-${m.d} ${m.h}:${m.mi}`);
  const ko = P.parseAny(read('android_ko.txt'));
  assert.deepEqual(hm(ko), ['2026-1-15 21:5', '2026-1-15 21:7', '2026-1-16 7:30', '2026-1-16 12:15']);
  const zh = P.parseAny(read('android_zh.txt'));
  assert.deepEqual(hm(zh), ['2026-1-15 21:5', '2026-1-15 21:6', '2026-1-16 8:0']);
  const fi = P.parseAny(read('android_fi_klo.txt'));
  assert.deepEqual(hm(fi), ['2026-1-15 21:5', '2026-1-15 21:6', '2026-1-16 7:45']);
  const cs = P.parseAny(read('android_cs_spaced.txt'));
  assert.equal(cs.dateOrder, 'DMY');
  assert.deepEqual(hm(cs), ['2026-1-15 21:5', '2026-1-15 21:6', '2026-1-16 7:45']);
  assert.equal(cs.messages[1].kind, 'media');
  const ar = P.parseAny(read('android_ar_digits.txt'));
  assert.deepEqual(hm(ar), ['2026-1-15 21:5', '2026-1-15 21:6', '2026-1-16 7:45']);
  assert.deepEqual(senders(ar), ['Omar', 'Sam']);
});

test('Localized "(file attached)" lines count as media, not words', () => {
  const r = P.parseAny(read('android_de_attached.txt'));
  assert.deepEqual(r.messages.map((m) => m.kind), ['text', 'media', 'media', 'text']);
  assert.equal(P.parseAny('[1/5/25, 8:19 PM] Ana: 2015-08-04-PHOTO-00004762.jpg <‎attached>').messages[0].kind, 'media');
  // an ordinary sentence ending in brackets is still text
  assert.equal(P.parseAny('1/5/25, 8:19 PM - Ana: see notes.txt (the long one)').messages[0].kind, 'text');
});

test('Telegram HTML export gets a "choose JSON" hint', () => {
  assert.throws(() => P.parseAny(read('telegram_messages.html'), 'messages.html'), /Machine-readable JSON/);
  assert.throws(() => P.parseAny(''), /That file is empty/);
  assert.throws(() => P.parseAny('\ufeff  \n'), /That file is empty/);
});

// Found on real exports (see bots/launch/REAL_EXPORT_TESTS.md); fixtures are synthetic.
test('real-export regressions: E2E notice without the iOS mark, iOS document with a caption', () => {
  const a = P.parseAny(read('android_e2e_no_mark.txt'));
  assert.deepEqual(senders(a), ['Dev Patel', 'Mara Quinn'], 'group name posting the E2E notice is not a member');
  assert.equal(a.messages.length, 3);
  const b = P.parseAny(read('ios_document_caption.txt'), '_chat.txt');
  assert.equal(b.messages.length, 3);
  const doc = b.messages.find((m) => m.mi === 1 && m.h === 21 && m.kind !== 'text');
  assert.ok(doc, 'document with a caption counts as media');
  assert.equal(b.messages.filter((m) => m.kind === 'media').length, 1);
  assert.equal(b.messages.filter((m) => /attached/.test(m.text)).length, 0);
});
