/* Goal Bingo: card <-> URL hash codec. No dependencies; works in browsers and Node (for tests).
 *
 * Card link:  #c=<base64url(UTF-8 payload)>
 * Group link: #g=<base64url(UTF-8 payload)>   (theme, size, free centre and group name only; never goals)
 *
 * Card payload, newline-separated:
 *   line 0  "b1"                       format version
 *   line 1  size + flags               "5f" = 5x5 with free centre, "4" = 4x4
 *   line 2  theme id
 *   line 3  checked squares, base36 bitmask (bit i = square i, row-major)
 *   line 4  title
 *   line 5  name
 *   line 6  group name
 *   line 7+ one goal per square (n*n lines; trailing empty goals may be omitted)
 *   last    "~" end marker, so a link cut off while copying is detected instead of loading half a card
 * Newlines inside text are turned into spaces, so the format can't be broken by input.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BingoCodec = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 'b1';
  var END = '~';
  var SIZES = [3, 4, 5];
  var THEMES = ['confetti', 'midnight', 'sage', 'sunset', 'mono', 'lantern'];
  var LIMITS = {
    goal: 70,          // characters per goal (code points)
    title: 48,
    name: 30,
    group: 40,
    payloadBytes: 3000, // UTF-8 bytes in the card payload; keeps the link under ~4,100 characters
    hashChars: 6000     // anything longer is rejected on decode before any work is done
  };

  // ---------- small helpers ----------
  function chars(s) { return Array.from(String(s == null ? '' : s)); }
  function clean(s, max) {
    // strip control characters (incl. newlines) and collapse whitespace
    var t = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
    var c = chars(t);
    return c.length > max ? c.slice(0, max).join('').trim() : t;
  }
  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    return Buffer.from(str, 'utf8');
  }
  function utf8Decode(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return Buffer.from(bytes).toString('utf8');
  }
  function toB64url(str) {
    var bytes = utf8Bytes(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var b64 = typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64url(s) {
    if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('bad characters');
    var b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return utf8Decode(bytes);
  }
  function byteLen(str) { return utf8Bytes(str).length; }

  // ---------- card model ----------
  function blank(opts) {
    opts = opts || {};
    var size = SIZES.indexOf(+opts.size) >= 0 ? +opts.size : 5;
    var card = {
      size: size,
      free: size % 2 === 1 ? opts.free !== false : false,
      theme: THEMES.indexOf(opts.theme) >= 0 ? opts.theme : THEMES[0],
      title: clean(opts.title != null ? opts.title : '', LIMITS.title),
      name: clean(opts.name || '', LIMITS.name),
      group: clean(opts.group || '', LIMITS.group),
      goals: [],
      checked: []
    };
    for (var i = 0; i < size * size; i++) { card.goals.push(''); card.checked.push(false); }
    return card;
  }
  function centre(size) { return size % 2 === 1 ? (size * size - 1) / 2 : -1; }

  // Normalise any card-like object into a valid card (clamps every field).
  function normalize(c) {
    var card = blank({ size: c && c.size, theme: c && c.theme, title: c && c.title, name: c && c.name, group: c && c.group, free: !!(c && c.free) });
    var n = card.size * card.size;
    for (var i = 0; i < n; i++) {
      card.goals[i] = clean(c && c.goals && c.goals[i], LIMITS.goal);
      card.checked[i] = !!(c && c.checked && c.checked[i]);
    }
    var m = centre(card.size);
    if (card.free && m >= 0) { card.checked[m] = true; }
    return card;
  }

  function bitsToB36(checked) {
    // 25 bits fits comfortably in a JS number (< 2^53)
    var v = 0;
    for (var i = checked.length - 1; i >= 0; i--) v = v * 2 + (checked[i] ? 1 : 0);
    return v.toString(36);
  }
  function b36ToBits(s, n) {
    var out = [];
    if (!/^[0-9a-z]{1,6}$/.test(s)) s = '0';
    var v = parseInt(s, 36);
    for (var i = 0; i < n; i++) { out.push(v % 2 === 1); v = Math.floor(v / 2); }
    return out;
  }

  function payload(card) {
    var goals = card.goals.slice();
    while (goals.length && !goals[goals.length - 1]) goals.pop();
    return [VERSION, card.size + (card.free ? 'f' : ''), card.theme, bitsToB36(card.checked), card.title, card.name, card.group]
      .concat(goals, [END]).join('\n');
  }

  // Trim the longest goals one character at a time until the payload fits the byte budget.
  // Returns the (possibly shortened) card. Normal cards never hit this; it guards emoji-heavy input.
  function fit(card) {
    card = normalize(card);
    var guard = 0;
    while (byteLen(payload(card)) > LIMITS.payloadBytes && guard++ < 20000) {
      var longest = -1, len = 0;
      for (var i = 0; i < card.goals.length; i++) {
        var l = byteLen(card.goals[i]);
        if (l > len) { len = l; longest = i; }
      }
      if (longest < 0) break;
      var c = chars(card.goals[longest]); c.pop();
      card.goals[longest] = c.join('').trim();
    }
    return card;
  }

  function encode(card) { return 'c=' + toB64url(payload(fit(card))); }

  function decode(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (h.length > LIMITS.hashChars) return { error: 'too-long' };
    var m = /^([cg])=([A-Za-z0-9_-]+)$/.exec(h);
    if (!m) return { error: h ? 'not-a-card' : 'empty' };
    var text;
    try { text = fromB64url(m[2]); } catch (e) { return { error: 'corrupt' }; }
    var lines = text.split('\n');
    if (lines[0] !== VERSION) return { error: lines[0] && VERSION.indexOf(lines[0]) === 0 ? 'truncated' : 'version' };
    if (lines.length < 2 || lines[lines.length - 1] !== END) return { error: 'truncated' };
    lines.pop();
    var sz = /^([345])(f?)$/.exec(lines[1] || '');
    if (!sz) return { error: 'corrupt' };
    var size = +sz[1];
    if (m[1] === 'g') {
      var g = blank({ size: size, free: !!sz[2], theme: lines[2], group: lines[3], title: lines[4] });
      return { kind: 'group', card: g };
    }
    var n = size * size;
    var raw = { size: size, free: !!sz[2], theme: lines[2], title: lines[4], name: lines[5], group: lines[6],
      goals: lines.slice(7, 7 + n), checked: b36ToBits(lines[3] || '0', n) };
    return { kind: 'card', card: normalize(raw) };
  }

  function encodeGroup(card) {
    var c = normalize(card);
    return 'g=' + toB64url([VERSION, c.size + (c.free ? 'f' : ''), c.theme, c.group, c.title, END].join('\n'));
  }

  // ---------- bingo maths ----------
  function lines(size) {
    var L = [], r, c;
    for (r = 0; r < size; r++) { var row = []; for (c = 0; c < size; c++) row.push(r * size + c); L.push(row); }
    for (c = 0; c < size; c++) { var col = []; for (r = 0; r < size; r++) col.push(r * size + c); L.push(col); }
    var d1 = [], d2 = [];
    for (r = 0; r < size; r++) { d1.push(r * size + r); d2.push(r * size + (size - 1 - r)); }
    L.push(d1, d2);
    return L;
  }
  function progress(card) {
    var m = card.free ? centre(card.size) : -1;
    var total = 0, done = 0;
    for (var i = 0; i < card.goals.length; i++) {
      if (i === m) continue;
      total++; if (card.checked[i]) done++;
    }
    var bingos = lines(card.size).filter(function (ln) { return ln.every(function (i) { return card.checked[i]; }); });
    return { done: done, total: total, bingos: bingos.length, lines: bingos, blackout: done === total && total > 0 };
  }

  return {
    VERSION: VERSION, SIZES: SIZES, THEMES: THEMES, LIMITS: LIMITS,
    blank: blank, normalize: normalize, fit: fit, encode: encode, decode: decode, encodeGroup: encodeGroup,
    centre: centre, lines: lines, progress: progress, byteLen: byteLen, clean: clean
  };
});
