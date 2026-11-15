/* Watch-Party Bingo: a small QR code encoder (byte mode, ECC level M or L, versions 1-40).
 * Written for Lantern Lab from the QR code spec (ISO/IEC 18004); MIT licensed like the rest of this app.
 * "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
 *
 * PartyQR.encode(text) -> { version, size, ecl, mask, get(x, y) }
 * PartyQR.draw(canvas, qr, pixelsPerModule)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PartyQR = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // [ecc codewords per block, number of blocks] indexed by version (1-40)
  var ECC = {
    L: { bits: 1, per: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
      blocks: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25] },
    M: { bits: 0, per: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
      blocks: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49] }
  };

  function rawModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) { var na = Math.floor(ver / 7) + 2; r -= (25 * na - 10) * na - 55; if (ver >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(ver, ecl) { return Math.floor(rawModules(ver) / 8) - ECC[ecl].per[ver] * ECC[ecl].blocks[ver]; }
  function alignPositions(ver, size) {
    if (ver === 1) return [];
    var na = Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2, out = [6];
    for (var pos = size - 7; out.length < na; pos -= step) out.splice(1, 0, pos);
    return out;
  }

  // ---------- Reed-Solomon over GF(256), polynomial 0x11D ----------
  function gmul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; }
  function rsDivisor(deg) {
    var r = []; for (var i = 0; i < deg; i++) r.push(0); r[deg - 1] = 1;
    var root = 1;
    for (i = 0; i < deg; i++) {
      for (var j = 0; j < deg; j++) { r[j] = gmul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; }
      root = gmul(root, 2);
    }
    return r;
  }
  function rsRemainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ r.shift(); r.push(0);
      div.forEach(function (c, i) { r[i] ^= gmul(c, f); });
    });
    return r;
  }

  function encode(text, opts) {
    var bytes = Array.from(new TextEncoder().encode(String(text)));
    var ecl = (opts && opts.ecl) || 'M', ver;
    function fits(v, e) { var cc = v <= 9 ? 8 : 16; return 4 + cc + bytes.length * 8 <= dataCodewords(v, e) * 8 && bytes.length < (1 << cc); }
    for (ver = 1; ver <= 40 && !fits(ver, ecl); ver++);
    // a long link at M gets very dense; L keeps it a few versions smaller and still scans well off a screen
    if (!(opts && opts.ecl) && ver > 15) { var lv; for (lv = 1; lv <= 40 && !fits(lv, 'L'); lv++); if (lv < ver) { ver = lv; ecl = 'L'; } }
    if (ver > 40) throw new Error('Text too long for a QR code');

    // ---- data bits
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    var cap = dataCodewords(ver, ecl) * 8;
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) { var v = 0; for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; data.push(v); }

    // ---- ECC + interleave
    var nb = ECC[ecl].blocks[ver], el = ECC[ecl].per[ver], raw = Math.floor(rawModules(ver) / 8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(el), blocks = [], k = 0;
    for (i = 0; i < nb; i++) {
      var dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += dat.length;
      var ec = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ec));
    }
    var words = [];
    for (i = 0; i < blocks[0].length; i++) for (j = 0; j < nb; j++) if (i !== shortLen - el || j >= nShort) words.push(blocks[j][i]);

    // ---- function patterns
    var size = ver * 4 + 17, mod = [], fn = [];
    for (i = 0; i < size; i++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function set(x, y, dark) { mod[y][x] = !!dark; fn[y][x] = true; }
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = c[0] + dx, yy = c[1] + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, d !== 2 && d !== 4);
      }
    });
    var ap = alignPositions(ver, size), na = ap.length;
    for (i = 0; i < na; i++) for (j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (var dy2 = -2; dy2 <= 2; dy2++) for (var dx2 = -2; dx2 <= 2; dx2++) set(ap[i] + dx2, ap[j] + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
    }
    function formatBits(mask) {
      var d = (ECC[ecl].bits << 3) | mask, r = d;
      for (var q = 0; q < 10; q++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var b = ((d << 10) | r) ^ 0x5412;
      var bit = function (n) { return (b >>> n) & 1; };
      for (q = 0; q <= 5; q++) set(8, q, bit(q));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (q = 9; q < 15; q++) set(14 - q, 8, bit(q));
      for (q = 0; q < 8; q++) set(size - 1 - q, 8, bit(q));
      for (q = 8; q < 15; q++) set(8, size - 15 + q, bit(q));
      set(8, size - 8, true);
    }
    formatBits(0);
    if (ver >= 7) {
      var r = ver;
      for (i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      var vb = (ver << 12) | r;
      for (i = 0; i < 18; i++) { var bt = (vb >>> i) & 1, a = size - 11 + i % 3, b = Math.floor(i / 3); set(a, b, bt); set(b, a, bt); }
    }

    // ---- codewords, zig-zag
    var bi = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < words.length * 8) { mod[y][x] = ((words[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
      }
    }

    // ---- masks: try all 8, keep the lowest penalty
    var MASKS = [
      function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; },
      function (x) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; }, function (x, y) { return x * y % 2 + x * y % 3 === 0; },
      function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; }, function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }
    ];
    function applyMask(m) { for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x]; }
    function penalty() {
      var p = 0, x, y, dark = 0;
      var pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], rev = pat.slice().reverse();
      function scan(get) {
        for (var a = 0; a < size; a++) {
          var run = 1;
          for (var b = 1; b <= size; b++) {
            if (b < size && get(a, b) === get(a, b - 1)) run++;
            else { if (run >= 5) p += 3 + run - 5; run = 1; }
          }
          for (b = 0; b + 11 <= size; b++) {
            var m1 = true, m2 = true;
            for (var t = 0; t < 11; t++) { var v = get(a, b + t) ? 1 : 0; if (v !== pat[t]) m1 = false; if (v !== rev[t]) m2 = false; }
            if (m1) p += 40; if (m2) p += 40;
          }
        }
      }
      scan(function (a, b) { return mod[a][b]; });
      scan(function (a, b) { return mod[b][a]; });
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { var c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3; }
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (mod[y][x]) dark++;
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    }
    var best = 0, bestP = Infinity;
    for (var m = 0; m < 8; m++) {
      applyMask(m); formatBits(m);
      var pp = penalty(); if (pp < bestP) { bestP = pp; best = m; }
      applyMask(m);
    }
    applyMask(best); formatBits(best);
    return { version: ver, size: size, ecl: ecl, mask: best, modules: mod, get: function (x, y) { return x >= 0 && y >= 0 && x < size && y < size && mod[y][x]; } };
  }

  // Draws with a 4-module quiet zone. Returns the canvas.
  function draw(canvas, qr, scale, fg, bg) {
    var q = 4, n = qr.size + q * 2;
    scale = scale || Math.max(2, Math.floor(512 / n));
    canvas.width = canvas.height = n * scale;
    var x = canvas.getContext('2d');
    x.fillStyle = bg || '#ffffff'; x.fillRect(0, 0, canvas.width, canvas.height);
    x.fillStyle = fg || '#000000';
    for (var r = 0; r < qr.size; r++) for (var c = 0; c < qr.size; c++) if (qr.modules[r][c]) x.fillRect((c + q) * scale, (r + q) * scale, scale, scale);
    return canvas;
  }

  return { encode: encode, draw: draw };
});
