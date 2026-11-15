/* Watch-Party Bingo: game <-> URL hash codec, seeded card dealing and bingo maths.
 * No dependencies; works in browsers and in Node 22 (for tests).
 *
 * Game link:   #g=<z|t><base64url>            z = deflate-raw (CompressionStream), t = plain UTF-8 (fallback)
 * Check link:  #g=...&v=<seed36>.<marks36>.<time36>   one guest's card + marks, so anyone can recompute and check it
 *
 * Game text (before compression), newline-separated:
 *   line 0  "pw1"            format version
 *   line 1  title
 *   line 2  "@<presetId>" for an unedited preset (squares come from presets.js), or "" for a custom list
 *   line 3+ one square per line (custom lists only)
 *   last    "~" end marker, so a link cut off while copying is detected
 * Newlines and control characters in text become spaces, so input can't break the format.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./presets.js'));
  else root.PartyCodec = factory(root.PartyPresets);
})(typeof self !== 'undefined' ? self : this, function (PRESETS) {
  'use strict';

  var VERSION = 'pw1', END = '~', SIZE = 5, CENTRE = 12, CELLS = 24;
  var LIMITS = {
    minSquares: 24,
    maxSquares: 100,
    square: 60,        // characters per square (code points)
    title: 48,
    textBytes: 12000,  // game text before compression
    hashChars: 9000,   // anything longer is refused before decoding
    inflateBytes: 16000 // decompression stops past this (guards against a zip bomb in a crafted link)
  };

  // ---------- text helpers ----------
  function chars(s) { return Array.from(String(s == null ? '' : s)); }
  function clean(s, max) {
    var t = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
    var c = chars(t);
    return c.length > max ? c.slice(0, max).join('').trim() : t;
  }
  function utf8(str) { return new TextEncoder().encode(str); }
  function unutf8(bytes) { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  function bytesToB64url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    var b64 = typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlToBytes(s) {
    if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('bad characters');
    if (s.length % 4 === 1) throw new Error('bad length');
    var b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ---------- compression (CompressionStream; plain text when it isn't there) ----------
  function canCompress() {
    if (typeof CompressionStream === 'undefined') return false;
    try { new CompressionStream('deflate-raw'); return true; } catch (e) { return false; }
  }
  async function readAll(stream, max) {
    var reader = stream.getReader(), parts = [], total = 0;
    for (;;) {
      var r = await reader.read();
      if (r.done) break;
      total += r.value.length;
      if (max && total > max) { try { await reader.cancel(); } catch (e) { /* ignore */ } throw new Error('too big'); }
      parts.push(r.value);
    }
    var out = new Uint8Array(total), p = 0;
    parts.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }
  async function deflate(bytes) {
    var cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter();
    w.write(bytes); w.close();
    return readAll(cs.readable);
  }
  async function inflate(bytes) {
    var ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter();
    w.write(bytes).catch(function () {}); w.close().catch(function () {});
    return readAll(ds.readable, LIMITS.inflateBytes);
  }

  // ---------- game model ----------
  function presetById(id) { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i]; return null; }

  // One square per line; trims, drops blanks and case-insensitive duplicates, caps length and count.
  function parseList(text) {
    var seen = {}, out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var s = clean(line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ''), LIMITS.square);
      var k = s.toLowerCase();
      if (!s || s === END || seen[k] || out.length >= LIMITS.maxSquares) return;
      seen[k] = 1; out.push(s);
    });
    return out;
  }

  function sameList(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }

  // { title, squares, presetId } -> normalized game. An unedited preset keeps its id (short links).
  function makeGame(opts) {
    opts = opts || {};
    var squares = Array.isArray(opts.squares) ? parseList(opts.squares.join('\n')) : parseList(opts.text);
    var p = opts.presetId ? presetById(opts.presetId) : null;
    if (p && !(opts.squares || opts.text != null)) squares = p.squares.slice();
    var presetId = p && sameList(squares, p.squares) ? p.id : '';
    var title = clean(opts.title != null ? opts.title : (p ? p.title : ''), LIMITS.title) || 'Watch-Party Bingo';
    return { title: title, presetId: presetId, squares: squares };
  }
  function validate(game) {
    if (game.squares.length < LIMITS.minSquares) return 'too-few';
    if (utf8(gameText(game)).length > LIMITS.textBytes) return 'too-big';
    return '';
  }
  function gameText(game) {
    var lines = [VERSION, game.title, game.presetId ? '@' + game.presetId : ''];
    if (!game.presetId) lines = lines.concat(game.squares);
    lines.push(END);
    return lines.join('\n');
  }
  function parseText(text) {
    var lines = text.split('\n');
    if (lines[0] !== VERSION) return { error: lines[0] && VERSION.indexOf(lines[0]) === 0 ? 'truncated' : 'version' };
    if (lines.length < 4 || lines[lines.length - 1] !== END) return { error: 'truncated' };
    lines.pop();
    var title = clean(lines[1], LIMITS.title) || 'Watch-Party Bingo', src = lines[2], squares;
    if (src) {
      var p = /^@([a-z0-9]+)$/.exec(src) ? presetById(src.slice(1)) : null;
      if (!p) return { error: 'unknown-preset' };
      return { game: { title: title, presetId: p.id, squares: p.squares.slice() } };
    }
    squares = parseList(lines.slice(3).join('\n'));
    if (squares.length < LIMITS.minSquares) return { error: 'too-few' };
    return { game: { title: title, presetId: '', squares: squares } };
  }

  // FNV-1a over the game text: stable id used for the guest's localStorage key and print seeds.
  function hash32(str) {
    var b = utf8(str), h = 0x811c9dc5;
    for (var i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function gameId(game) { return hash32(gameText(game)).toString(36); }

  async function encode(game, opts) {
    var text = gameText(game), bytes = utf8(text);
    var plain = 't' + bytesToB64url(bytes);
    if (!(opts && opts.noCompress) && canCompress()) {
      try { var z = 'z' + bytesToB64url(await deflate(bytes)); if (z.length < plain.length) return 'g=' + z; } catch (e) { /* fall back */ }
    }
    return 'g=' + plain;
  }

  function parseVerify(v) {
    var m = /^([0-9a-z]{1,7})\.([0-9a-z]{1,6})\.([0-9a-z]{0,9})$/.exec(v || '');
    if (!m) return null;
    var seed = parseInt(m[1], 36) >>> 0, mask = parseInt(m[2], 36), marks = [];
    if (!isFinite(mask) || mask >= 33554432) return null;
    for (var i = 0; i < 25; i++) { marks.push(mask % 2 === 1); mask = Math.floor(mask / 2); }
    marks[CENTRE] = true;
    var t = m[3] ? parseInt(m[3], 36) : 0;
    return { seed: seed, marks: marks, time: t > 0 && t < 4e12 ? t : 0 };
  }
  function verifyParam(seed, marks, time) {
    var mask = 0;
    for (var i = 24; i >= 0; i--) mask = mask * 2 + (marks[i] && i !== CENTRE ? 1 : 0);
    return (seed >>> 0).toString(36) + '.' + mask.toString(36) + '.' + (time ? Math.round(time).toString(36) : '');
  }

  async function decode(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (!h) return { error: 'empty' };
    if (h.length > LIMITS.hashChars) return { error: 'too-long' };
    var m = /^g=([zt])([A-Za-z0-9_-]+)(?:&v=([0-9a-z.]+))?$/.exec(h);
    if (!m) return { error: /^g=/.test(h) ? 'corrupt' : 'not-a-game' };
    var bytes, text;
    try { bytes = b64urlToBytes(m[2]); } catch (e) { return { error: 'corrupt' }; }
    if (m[1] === 'z') {
      if (typeof DecompressionStream === 'undefined') return { error: 'no-decompress' };
      try { bytes = await inflate(bytes); } catch (e) { return { error: /too big/.test(e && e.message) ? 'too-long' : 'truncated' }; }
    }
    try { text = unutf8(bytes); } catch (e) { return { error: 'corrupt' }; }
    var r = parseText(text);
    if (r.error) return r;
    r.id = gameId(r.game);
    if (m[3]) { r.verify = parseVerify(m[3]); if (!r.verify) return { error: 'corrupt' }; }
    return r;
  }

  // ---------- seeded dealing ----------
  // mulberry32: small, fast, good enough to shuffle a bingo card.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, seed) {
    var a = list.slice(), r = rng(seed);
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // 25 cells, row-major; the centre (12) is the free space (null).
  function deal(squares, seed) {
    var pick = shuffle(squares, seed).slice(0, CELLS);
    pick.splice(CENTRE, 0, null);
    return pick;
  }
  function cardKey(cells) { return cells.join('\u0001'); }
  function randomSeed() {
    try { var a = new Uint32Array(1); (typeof crypto !== 'undefined' ? crypto : require('crypto').webcrypto).getRandomValues(a); return a[0] || 1; }
    catch (e) { return (Math.floor(Math.random() * 4294967295) >>> 0) || 1; }
  }
  // N distinct seeds for printing, derived from the game so a reprint gives the same cards.
  function printSeeds(game, n) {
    var id = gameId(game), seeds = [], seen = {}, k = 0;
    while (seeds.length < n && k < n * 20) {
      var s = hash32(id + ':print:' + (k++)), key = cardKey(deal(game.squares, s));
      if (seen[key]) continue;
      seen[key] = 1; seeds.push(s);
    }
    return seeds;
  }

  // ---------- bingo maths ----------
  var LINES = (function () {
    var L = [], r, c;
    for (r = 0; r < SIZE; r++) { var row = []; for (c = 0; c < SIZE; c++) row.push(r * SIZE + c); L.push(row); }
    for (c = 0; c < SIZE; c++) { var col = []; for (r = 0; r < SIZE; r++) col.push(r * SIZE + c); L.push(col); }
    var d1 = [], d2 = [];
    for (r = 0; r < SIZE; r++) { d1.push(r * SIZE + r); d2.push(r * SIZE + (SIZE - 1 - r)); }
    L.push(d1, d2);
    return L;
  })();
  // marks: 25 booleans (the centre always counts as marked)
  function progress(marks) {
    var m = function (i) { return i === CENTRE || !!marks[i]; }, done = 0;
    for (var i = 0; i < 25; i++) if (i !== CENTRE && marks[i]) done++;
    var lines = LINES.filter(function (ln) { return ln.every(m); });
    return { done: done, total: CELLS, bingos: lines.length, lines: lines, blackout: done === CELLS };
  }

  return {
    VERSION: VERSION, LIMITS: LIMITS, CENTRE: CENTRE, LINES: LINES, PRESETS: PRESETS,
    clean: clean, parseList: parseList, makeGame: makeGame, validate: validate, gameText: gameText, gameId: gameId, hash32: hash32,
    encode: encode, decode: decode, canCompress: canCompress, verifyParam: verifyParam, parseVerify: parseVerify,
    rng: rng, shuffle: shuffle, deal: deal, cardKey: cardKey, randomSeed: randomSeed, printSeeds: printSeeds,
    progress: progress, presetById: presetById
  };
});
