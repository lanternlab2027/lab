// Unit tests for docs/dating/parser.js + stats.js. Synthetic fixtures only.
// Run: node bots/dating/make_fixtures.js && TZ=America/New_York node --test bots/dating/test_parser.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const P = require('../../docs/dating/parser.js');
const S = require('../../docs/dating/stats.js');
const C = require('../../docs/dating/cards.js');
const FX = path.join(__dirname, 'fixtures');
const read = (n) => fs.readFileSync(path.join(FX, n), 'utf8');
const one = (n) => P.parseFiles([{ name: n, text: read(n) }]);
const csvFiles = () => fs.readdirSync(path.join(FX, 'hinge_csv')).map((n) => ({ name: 'Hinge Data/tables/' + n, text: fs.readFileSync(path.join(FX, 'hinge_csv', n), 'utf8') }));
const TODAY = Math.round(Date.UTC(2026, 10, 14) / 864e5);
const day = (s) => Math.round(Date.parse(s + 'T00:00:00Z') / 864e5);
const sumKey = (src, i, y) => Object.keys(src.days).filter((d) => !y || new Date(d * 864e5).getUTCFullYear() === y).reduce((a, d) => a + src.days[d][i], 0);

test('Tinder data.json: Usage totals match the raw file exactly', () => {
  const raw = JSON.parse(read('data.json'));
  const src = one('data.json').sources[0];
  assert.equal(src.app, 'tinder');
  const tot = (k) => Object.entries(raw.Usage[k]).filter(([d]) => d.startsWith('2026')).reduce((a, [, v]) => a + v, 0);
  assert.equal(sumKey(src, P.K.likes, 2026), tot('swipes_likes'));
  assert.equal(sumKey(src, P.K.passes, 2026), tot('swipes_passes'));
  assert.equal(sumKey(src, P.K.matches, 2026), tot('matches'));
  assert.equal(sumKey(src, P.K.sent, 2026), tot('messages_sent'));
  assert.equal(sumKey(src, P.K.recv, 2026), tot('messages_received'));
  assert.equal(sumKey(src, P.K.opens, 2026), tot('app_opens'));
  // Usage day keys are calendar dates: Feb 8 stays Feb 8 in any time zone.
  assert.ok(src.days[day('2026-02-08')][P.K.likes] + src.days[day('2026-02-08')][P.K.passes] === 412);
  const st = S.compute([src], { year: 2026, today: TODAY });
  assert.equal(st.busiest.day, day('2026-02-08'));
  assert.equal(st.busiest.count, 412);
  const exp = (tot('swipes_likes') + tot('superlikes')) / (tot('swipes_likes') + tot('superlikes') + tot('swipes_passes'));
  assert.ok(Math.abs(st.rightRate - exp) < 1e-9);
  assert.ok(Math.abs(st.matchRate - 100 * tot('matches') / (tot('swipes_likes') + tot('superlikes'))) < 1e-9);
  assert.ok(Math.abs(st.ratio - tot('messages_sent') / tot('messages_received')) < 1e-9);
});

test('privacy: parser output never contains message text, names, ids, bios or photos', () => {
  const outs = [one('data.json'), one('matches.json'), P.parseFiles(csvFiles()), one('tinder_iso.json')];
  for (const o of outs) {
    const j = JSON.stringify(o);
    assert.ok(!/CANARY|example\.invalid|hey there|coffee|Match \d/.test(j), 'leak in ' + o.sources[0].format);
    // Only numbers and fixed vocabulary inside sources.
    o.sources.forEach((s) => {
      s.hours.forEach((h) => assert.ok(h.every((x) => typeof x === 'number')));
      s.convos.forEach((c) => assert.ok(c.every((x) => typeof x === 'number' || x === null)));
    });
  }
});

test('privacy: no card label or stat string carries fixture text', () => {
  const srcs = [...one('data.json').sources, ...one('matches.json').sources, ...P.parseFiles(csvFiles()).sources];
  const st = S.compute(srcs, { year: 2026, today: TODAY });
  const cards = C.build(st, { title: 'My 2026 in dating', year: 2026, periodShort: '2026', safe: false });
  const j = JSON.stringify(st) + JSON.stringify(cards.map((c) => c.label));
  assert.ok(!/CANARY/.test(j));
});

test('Tinder message timestamps: RFC 1123 and ISO forms both parse; hours are local', () => {
  assert.equal(P.parseTs('Tue, 30 Nov 2021 05:08:21 GMT'), Date.UTC(2021, 10, 30, 5, 8, 21));
  assert.equal(P.parseTs('2026-01-12T12:00:00.000Z'), Date.UTC(2026, 0, 12, 12));
  const l = P.local(P.parseTs('Tue, 30 Nov 2021 03:08:21 GMT'));
  // TZ=America/New_York in the test command: 03:08 UTC is 22:08 the previous day.
  if (process.env.TZ === 'America/New_York') { assert.equal(l.hour, 22); assert.equal(l.day, day('2021-11-29')); }
  const iso = one('tinder_iso.json').sources[0];
  assert.ok(iso.has.hours && iso.hours.length > 100);
  assert.equal(iso.has.supers, false);
  const st = S.compute([iso], { year: 2026, today: TODAY });
  assert.ok(st.rightRate > 0.3 && st.rightRate < 0.45);
});

test('Hinge timestamps: naive (UTC), microseconds and offsets', () => {
  assert.equal(P.parseTs('2021-03-15 14:23:11'), Date.UTC(2021, 2, 15, 14, 23, 11));
  assert.equal(P.parseTs('2021-03-15 14:23:11.123456+00:00'), Date.UTC(2021, 2, 15, 14, 23, 11, 123));
  assert.equal(P.parseTs('2021-03-15 14:23:11.5-0500'), Date.UTC(2021, 2, 15, 19, 23, 11, 500));
  assert.equal(P.parseTs('nonsense'), null);
  assert.equal(P.dayKey('2026-02-30'), null);
});

test('Hinge matches.json: likes, matches from your likes, incoming matches, sent chats', () => {
  const raw = JSON.parse(read('matches.json'));
  const src = one('matches.json').sources[0];
  assert.equal(src.format, 'hinge-json');
  const likes = raw.reduce((a, t) => a + (t.like ? t.like.length : 0), 0);
  const matches = raw.reduce((a, t) => a + (t.match ? t.match.length : 0), 0);
  const fromLikes = raw.filter((t) => t.like && t.match).length;
  const chats = raw.reduce((a, t) => a + (t.chats ? t.chats.length : 0), 0);
  assert.equal(sumKey(src, P.K.likes), likes);
  assert.equal(sumKey(src, P.K.matches), matches);
  assert.equal(sumKey(src, P.K.lmatch), fromLikes);
  assert.equal(sumKey(src, P.K.sent), chats);
  assert.equal(src.has.passes, false);
  assert.equal(src.has.recv, false);
  const st = S.compute([src], { year: null, today: TODAY });
  assert.equal(st.rightRate, null, 'no passes in legacy Hinge -> no right-swipe rate');
  assert.ok(Math.abs(st.matchRate - 100 * fromLikes / likes) < 1e-9);
  assert.ok(Math.abs(st.inboundShare - (matches - fromLikes) / matches) < 1e-9);
  const quiet = raw.filter((t) => t.match && !(t.chats && t.chats.length)).length;
  assert.ok(Math.abs(st.convo.quietShare - quiet / matches) < 1e-9);
});

test('Hinge CSV tables: likes+roses vs skips, sent/received, who opened, no match rate', () => {
  const files = csvFiles();
  const src = P.parseFiles(files).sources[0];
  assert.equal(src.format, 'hinge-csv');
  const rows = (n) => P.parseCsv(files.find((f) => f.name.endsWith(n)).text).length - 1;
  assert.equal(sumKey(src, P.K.likes), rows('match_likes.csv') + rows('match_roses.csv'));
  assert.equal(sumKey(src, P.K.passes), rows('match_skips.csv'));
  const msgs = P.parseCsv(files.find((f) => f.name.endsWith('chat_message.csv')).text).slice(1);
  assert.equal(sumKey(src, P.K.sent), msgs.filter((r) => r[1] === 'sent').length);
  assert.equal(sumKey(src, P.K.recv), msgs.filter((r) => r[1] === 'received').length);
  assert.equal(src.convos.length, new Set(msgs.map((r) => r[3])).size);
  assert.ok(src.has.opener && !src.has.matches);
  const st = S.compute([src], { year: null, today: TODAY });
  assert.equal(st.matchRate, null);
  assert.ok(st.convo.openerShare > 0 && st.convo.openerShare < 1);
  assert.ok(st.rightRate > 0.2 && st.rightRate < 0.45);
});

test('CSV parser: quoted commas, quotes, newlines, BOM, CRLF', () => {
  const r = P.parseCsv('﻿a,b\r\n"x, ""y""","line1\nline2"\r\n');
  assert.deepEqual(r, [['a', 'b'], ['x, "y"', 'line1\nline2']]);
});

test('Hinge sent-only CSV: no received rows -> no ratio, no opener', () => {
  const JSZip = require('../../docs/dating/vendor/jszip-3.10.1.min.js');
  return JSZip.loadAsync(fs.readFileSync(path.join(FX, 'hinge-csv-sent-only.zip'))).then(async (z) => {
    const files = [];
    for (const n of Object.keys(z.files)) files.push({ name: n, text: await z.files[n].async('string') });
    const src = P.parseFiles(files).sources[0];
    assert.equal(src.has.recv, false);
    assert.equal(src.has.opener, false);
    const st = S.compute([src], { year: 2026, today: TODAY });
    assert.equal(st.ratio, null);
  });
});

test('both apps together: rates only pool sources that have both sides', () => {
  const t = one('data.json').sources[0], h = one('matches.json').sources[0];
  const st = S.compute([t, h], { year: 2026, today: TODAY });
  const tOnly = S.compute([t], { year: 2026, today: TODAY });
  assert.equal(st.rightRate, tOnly.rightRate, 'Hinge JSON has no passes, so it must not skew right-swipe rate');
  assert.equal(st.ratio, tOnly.ratio, 'Hinge JSON has no received counts');
  assert.ok(st.matchRate > tOnly.matchRate, 'match rate pools both');
  assert.deepEqual(S.compute([t, h], { year: 2026, app: 'hinge', today: TODAY }).apps, ['hinge']);
});

test('years, empty years and all time', () => {
  const t = one('data.json').sources;
  assert.deepEqual(P.years(t).map((y) => y.year), [2026, 2025]);
  const empty = S.compute(t, { year: 2024, today: TODAY });
  assert.equal(empty.anything, false);
  const all = S.compute(t, { year: null, today: TODAY });
  assert.ok(all.byYear.length === 2 && all.months === null);
  const old = one('tinder_2024_only.json').sources;
  assert.deepEqual(P.years(old).map((y) => y.year), [2024]);
});

test('zero matches and a quiet account still build cards without NaN', () => {
  const src = one('tinder_zero_matches.json').sources;
  const st = S.compute(src, { year: 2026, today: TODAY });
  assert.equal(st.matchRate, 0);
  assert.equal(st.ratio, null);
  const cards = C.build(st, { title: 'x', year: 2026, periodShort: '2026', safe: true });
  assert.ok(cards.length >= 3 && cards[cards.length - 1].id === 'persona');
  assert.ok(!/NaN|Infinity|undefined/.test(JSON.stringify(st, (k, v) => (typeof v === 'number' && !isFinite(v) ? 'Infinity' : v === undefined ? 'undefined' : v))));
});

test('errors: not a dating export, broken JSON, empty, empty usage, profile-only CSV', () => {
  assert.throws(() => one('not_dating.json'), /doesn.t look like a Tinder or Hinge/);
  assert.throws(() => one('broken.json'), /cut off or damaged/);
  assert.throws(() => P.parseFiles([{ name: 'empty.json', text: '' }]), /empty/);
  assert.throws(() => one('notes.txt'), /doesn.t look like/);
  assert.throws(() => one('tinder_empty_usage.json'), /no usage history/);
  assert.throws(() => P.parseFiles([{ name: 'user.csv', text: read('hinge_csv/user.csv') }]), /Hinge profile file/);
});

test('ignored files are never parsed for content', () => {
  const o = P.parseFiles([{ name: 'data.json', text: read('data.json') }, { name: 'user.json', text: '{"profile":{"first_name":"CANARY"}}' }, { name: 'prompts.json', text: '[{"id":1,"text":"CANARY"}]' }]);
  assert.equal(o.sources.length, 1);
  assert.deepEqual(o.files.map((f) => f.kind), ['tinder', 'ignored', 'ignored']);
});

test('safe share: no absolute volume counts in any chip text', () => {
  // Render to a fake 2D context and collect every fillText string.
  const texts = [];
  const ctx = new Proxy({ measureText: (t) => ({ width: String(t).length * 20 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText: (t) => texts.push(String(t)) }, { get: (o, k) => (k in o ? o[k] : () => {}), set: () => true });
  const canvas = { getContext: () => ctx };
  const src = one('data.json').sources;
  const st = S.compute(src, { year: 2026, today: TODAY });
  const info = { title: 'My 2026 in dating', year: 2026, periodShort: '2026', safe: true };
  C.build(st, info).forEach((c, i, a) => C.render(canvas, c, st, info, i + 1, a.length));
  const banned = [st.swipes, st.rights, st.lefts, st.matches, st.ratioSent, st.ratioRecv, st.busiest.count].map((n) => n.toLocaleString('en-US'));
  texts.forEach((t) => banned.forEach((b) => assert.ok(!t.split(/[^0-9,]+/).includes(b), `safe card shows ${b} in "${t}"`)));
  // and the full mode does show them
  texts.length = 0;
  const full = Object.assign({}, info, { safe: false });
  C.build(st, full).forEach((c, i, a) => C.render(canvas, c, st, full, i + 1, a.length));
  assert.ok(texts.some((t) => t.includes(st.busiest.count.toLocaleString('en-US'))));
});
