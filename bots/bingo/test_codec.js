// Unit tests for docs/bingo/codec.js. Run: node bots/bingo/test_codec.js
const C = require('../../docs/bingo/codec.js');
let fails = 0, n = 0;
const check = (c, m) => { n++; console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// --- round trip, every size and theme
for (const size of C.SIZES) {
  for (const theme of C.THEMES) {
    const card = C.blank({ size, theme, title: 'My 2027 Bingo', name: 'Sam', group: 'Book club' });
    card.goals = card.goals.map((_, i) => i % 3 ? `Goal number ${i}` : '');
    card.checked = card.checked.map((_, i) => i % 4 === 1);
    const norm = C.normalize(card);
    const d = C.decode('#' + C.encode(norm));
    if (!(d.kind === 'card' && eq(d.card, norm))) { check(false, `round trip ${size}x${size} ${theme}`); }
  }
}
check(true, 'round trip for every size x theme (3 sizes x 6 themes)');

// --- free centre
let c5 = C.blank({ size: 5 });
check(c5.free === true && C.normalize(c5).checked[12] === true, '5x5 defaults to a free centre, which counts as checked');
check(C.blank({ size: 4, free: true }).free === false, '4x4 can never have a free centre');
let d = C.decode(C.encode(C.blank({ size: 3, free: false })));
check(d.card.free === false && d.card.checked.every((x) => !x), '3x3 without free centre round-trips with nothing checked');

// --- unicode, emoji, punctuation, separators in text
const fancy = C.blank({ size: 3, title: 'Año 2027 ✨', name: 'Zoë' });
fancy.goals = ['Run a 5K 🏃‍♀️', 'Learn 日本語', 'Line\nbreak\tand tab', 'a=b&c#d/e?f', '  spaces   everywhere  ', '', '"quotes" & <tags>', 'Ünïcödé', '🎉'];
d = C.decode(C.encode(fancy));
check(d.card.title === 'Año 2027 ✨' && d.card.name === 'Zoë', 'unicode title and name survive');
check(d.card.goals[0] === 'Run a 5K 🏃‍♀️' && d.card.goals[1] === 'Learn 日本語', 'emoji (ZWJ) and CJK goals survive');
check(d.card.goals[2] === 'Line break and tab', 'newlines/tabs become spaces, so the format cannot be broken');
check(d.card.goals[3] === 'a=b&c#d/e?f' && d.card.goals[6] === '"quotes" & <tags>', 'URL-ish and HTML-ish characters survive');
check(d.card.goals[4] === 'spaces everywhere', 'whitespace is collapsed');
check(/^c=[A-Za-z0-9_-]+$/.test(C.encode(fancy)), 'encoded hash is URL-safe base64 (no +, /, =)');

// --- checked bits
const full = C.blank({ size: 5, free: false });
full.checked = full.checked.map(() => true);
d = C.decode(C.encode(full));
check(d.card.checked.every(Boolean), 'all 25 checked bits survive');
const p = C.progress(d.card);
check(p.done === 25 && p.total === 25 && p.bingos === 12 && p.blackout, `blackout: 25/25, 12 bingos (got ${p.done}/${p.total}, ${p.bingos})`);
const row = C.blank({ size: 5 }); [0, 1, 2, 3, 4].forEach((i) => (row.checked[i] = true));
check(C.progress(C.normalize(row)).bingos === 1, 'one full row = 1 bingo');
const diag = C.normalize(C.blank({ size: 5 })); [0, 6, 18, 24].forEach((i) => (diag.checked[i] = true));
check(C.progress(diag).bingos === 1 && C.progress(diag).done === 4 && C.progress(diag).total === 24, 'diagonal through the free centre = bingo; free square not counted in totals');

// --- size limits
const long = C.blank({ size: 5, title: 'T'.repeat(500), name: 'N'.repeat(500), group: 'G'.repeat(500) });
long.goals = long.goals.map(() => 'x'.repeat(500));
d = C.decode(C.encode(long));
check(d.card.title.length === C.LIMITS.title && d.card.name.length === C.LIMITS.name && d.card.group.length === C.LIMITS.group, 'title/name/group clamped to their limits');
check(d.card.goals.every((g) => g.length === C.LIMITS.goal), `each goal clamped to ${C.LIMITS.goal} characters`);
const maxAscii = C.encode(long);
check(maxAscii.length < 4200, `longest possible plain-text card fits in a ${maxAscii.length}-char hash`);

const emoji = C.blank({ size: 5 });
emoji.goals = emoji.goals.map(() => '🎯'.repeat(200));
const enc = C.encode(emoji);
check(enc.length <= Math.ceil(C.LIMITS.payloadBytes * 4 / 3) + 2, `emoji-heavy card is trimmed to the byte budget (${enc.length} chars)`);
d = C.decode(enc);
check(d.kind === 'card' && d.card.goals.every((g) => g.length > 0 && /^(🎯)+$/.test(g)), 'trimming keeps whole emoji (never splits a surrogate pair)');
const lens = d.card.goals.map((g) => Array.from(g).length);
check(Math.max(...lens) - Math.min(...lens) <= 1, `trimming shortens the longest goals first (lengths ${Math.min(...lens)}-${Math.max(...lens)})`);
check(C.byteLen(['b1'].join('')) === 2 && C.fit(emoji).goals[0] === d.card.goals[0], 'fit() and encode() agree');

check(C.decode('#c=' + 'A'.repeat(C.LIMITS.hashChars + 1)).error === 'too-long', 'hash over the limit is rejected before decoding');

// --- hostile and broken input
check(C.decode('').error === 'empty', 'empty hash -> empty');
check(C.decode('#about').error === 'not-a-card', 'unrelated hash -> not-a-card');
check(C.decode('#c=!!!').error === 'not-a-card', 'bad characters -> not-a-card');
check(C.decode('#c=_w').error === 'corrupt', 'invalid UTF-8 -> corrupt');
const b64 = (s) => Buffer.from(s + '\n~', 'utf8').toString('base64url');
check(C.decode('#c=' + b64('b9\n5f\nconfetti\n0')).error === 'version', 'unknown version -> version error');
check(C.decode('#c=' + b64('b1\n7\nconfetti\n0')).error === 'corrupt', 'size 7 -> corrupt');
d = C.decode('#c=' + b64('b1\n3\nnot-a-theme\nzzzzzzzzzz\nT\n\n\na\nb'));
check(d.kind === 'card' && d.card.theme === 'confetti' && d.card.checked.every((x) => !x), 'unknown theme -> default; malformed bitmask -> nothing checked');
check(d.card.goals.length === 9 && d.card.goals[0] === 'a' && d.card.goals[8] === '', 'missing trailing goals padded to n*n');
d = C.decode('#c=' + b64('b1\n3\nmono\n1ekf\n\n\n\n' + Array(40).fill('g').join('\n')));
check(d.card.goals.length === 9 && d.card.checked.length === 9, 'extra goals and extra checked bits are ignored');
d = C.decode('#c=' + b64('b1\n4f\nmono\n0'));
check(d.kind === 'card' && d.card.free === false, '"4f" (free centre on even size) is coerced to no free centre');

// --- truncated links (cut off while copying) are detected, never half-loaded
const tfull = C.encode(fancy);
let allTrunc = true;
for (let k = 3; k < tfull.length; k++) { const r = C.decode(tfull.slice(0, k)); if (r.kind) { allTrunc = false; console.log('     loaded at', k); break; } }
check(allTrunc, `every prefix of a card link is rejected (${tfull.length - 3} prefixes)`);
check(C.decode(tfull.slice(0, 40)).error === 'truncated' || C.decode(tfull.slice(0, 40)).error === 'corrupt', 'a cut-off link reports truncated/corrupt');

// --- group links carry no goals
const g = C.blank({ size: 4, theme: 'sunset', group: 'Smith family', title: 'Smith 2027' });
g.goals[0] = 'secret goal'; g.checked[0] = true;
const ge = C.encodeGroup(g);
check(/^g=/.test(ge) && !Buffer.from(ge.slice(2), 'base64url').toString().includes('secret'), 'group link never contains goals');
d = C.decode(ge);
check(d.kind === 'group' && d.card.theme === 'sunset' && d.card.size === 4 && d.card.group === 'Smith family' && d.card.title === 'Smith 2027' && d.card.goals.every((x) => !x), 'group link -> blank card, same theme/size/group/title');

console.log(`\n${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
