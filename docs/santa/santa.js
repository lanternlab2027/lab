/* Lantern Lab Secret Santa core: draw + link crypto. No network, no dependencies.
   Works in browsers and in Node 22+ (global WebCrypto). */
(function (root) {
  'use strict';
  const C = root.crypto;

  // ---------- randomness ----------
  // Unbiased integer in [0, n) from crypto.getRandomValues (rejection sampling).
  function randInt(n) {
    if (!(n > 0 && n <= 0x100000000)) throw new RangeError('bad n');
    const lim = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    for (;;) { C.getRandomValues(buf); if (buf[0] < lim) return buf[0] % n; }
  }
  function shuffle(a) { // Fisher-Yates, in place
    for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ---------- draw ----------
  // allowed[g][r] === true when giver g may buy for receiver r.
  function buildAllowed(n, exclusions) {
    const A = [];
    for (let i = 0; i < n; i++) { A.push([]); for (let j = 0; j < n; j++) A[i].push(i !== j); }
    for (const [a, b] of exclusions || []) {
      if (a === b || a < 0 || b < 0 || a >= n || b >= n) continue;
      A[a][b] = false; A[b][a] = false; // exclusions are two-way (couples)
    }
    return A;
  }
  // Size of a maximum bipartite matching givers -> receivers (Kuhn's algorithm), skipping
  // givers/receivers listed in usedG/usedR.
  function maxMatching(A, usedG, usedR) {
    const n = A.length, matchR = new Array(n).fill(-1);
    let size = 0;
    function tryG(g, seen) {
      for (let r = 0; r < n; r++) {
        if (!A[g][r] || seen[r] || (usedR && usedR[r])) continue;
        seen[r] = true;
        if (matchR[r] === -1 || tryG(matchR[r], seen)) { matchR[r] = g; return true; }
      }
      return false;
    }
    for (let g = 0; g < n; g++) { if (usedG && usedG[g]) continue; if (tryG(g, new Array(n).fill(false))) size++; }
    return size;
  }
  function isValid(perm, A) {
    const seen = new Set();
    for (let g = 0; g < perm.length; g++) { if (!A[g][perm[g]] || seen.has(perm[g])) return false; seen.add(perm[g]); }
    return seen.size === perm.length;
  }
  class DrawError extends Error { constructor(msg, who) { super(msg); this.name = 'DrawError'; this.who = who || null; } }

  // Returns perm where perm[g] is the receiver index for giver g.
  // Uniform over all valid assignments (rejection sampling); a matching-guided fallback
  // handles extremely constrained groups (valid, but not guaranteed uniform).
  function draw(n, exclusions, opts) {
    opts = opts || {};
    if (!Number.isInteger(n) || n < 3) throw new DrawError('Add at least 3 people.');
    const A = buildAllowed(n, exclusions);
    for (let i = 0; i < n; i++) {
      if (!A[i].some(Boolean)) throw new DrawError('Person ' + (i + 1) + ' is excluded from everyone.', i);
    }
    if (maxMatching(A) < n) throw new DrawError('These exclusions leave no valid way to draw.');
    const maxTries = opts.maxTries || 200000;
    const perm = [];
    for (let i = 0; i < n; i++) perm.push(i);
    for (let t = 0; t < maxTries; t++) {
      shuffle(perm);
      if (isValid(perm, A)) return perm.slice();
    }
    // Fallback: assign givers in random order, picking a random receiver that keeps a full matching possible.
    const out = new Array(n).fill(-1), usedG = new Array(n).fill(false), usedR = new Array(n).fill(false);
    const order = shuffle([...Array(n).keys()]);
    for (const g of order) {
      const cands = shuffle([...Array(n).keys()].filter(r => A[g][r] && !usedR[r]));
      let ok = false;
      for (const r of cands) {
        usedG[g] = true; usedR[r] = true;
        const remaining = n - order.indexOf(g) - 1;
        if (maxMatching(A, usedG, usedR) === remaining) { out[g] = r; ok = true; break; }
        usedG[g] = false; usedR[r] = false;
      }
      if (!ok) throw new DrawError('These exclusions leave no valid way to draw.');
    }
    return out;
  }

  // ---------- base64url ----------
  function b64uEnc(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64uDec(str) {
    if (!/^[A-Za-z0-9_-]*$/.test(str)) throw new Error('bad encoding');
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const s = atob(str), out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  // ---------- link crypto ----------
  // Fragment: "<prefix>.<key>.<iv+ciphertext>", AES-GCM-128 with a fresh random key per link.
  // The key travels in the same fragment, so this hides the match from anyone who merely
  // SEES the link (chat previews, the organizer's screen); it does not stop someone who OPENS it.
  async function seal(obj, prefix) {
    const key = C.getRandomValues(new Uint8Array(16)), iv = C.getRandomValues(new Uint8Array(12));
    const k = await C.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
    const pt = new TextEncoder().encode(JSON.stringify(obj));
    const ct = new Uint8Array(await C.subtle.encrypt({ name: 'AES-GCM', iv }, k, pt));
    const body = new Uint8Array(iv.length + ct.length); body.set(iv); body.set(ct, iv.length);
    return (prefix || 's1') + '.' + b64uEnc(key) + '.' + b64uEnc(body);
  }
  async function open(frag) {
    frag = String(frag || '').replace(/^#/, '').trim();
    const parts = frag.split('.');
    if (parts.length !== 3) throw new Error('This link looks incomplete.');
    const key = b64uDec(parts[1]), body = b64uDec(parts[2]);
    if (key.length !== 16 || body.length < 12 + 16) throw new Error('This link looks incomplete.');
    const k = await C.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
    let pt;
    try { pt = await C.subtle.decrypt({ name: 'AES-GCM', iv: body.slice(0, 12) }, k, body.slice(12)); }
    catch (e) { throw new Error('This link was damaged or cut off.'); }
    return { prefix: parts[0], data: JSON.parse(new TextDecoder().decode(pt)) };
  }

  // ---------- calendar ----------
  function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsFold(line) { // RFC 5545: fold at 75 octets (approximate with chars, safe for ASCII-heavy text)
    const out = []; while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); } out.push(line); return out.join('\r\n');
  }
  function makeIcs(o) { // o: {date:'YYYY-MM-DD', title, description, uid}
    const d = o.date.replace(/-/g, '');
    const next = new Date(Date.UTC(+o.date.slice(0, 4), +o.date.slice(5, 7) - 1, +o.date.slice(8, 10) + 1));
    const d2 = next.toISOString().slice(0, 10).replace(/-/g, '');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lantern Lab//Secret Santa//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:' + (o.uid || stamp + '@santa.lanternlab'), 'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + d2,
      icsFold('SUMMARY:' + icsEscape(o.title)), icsFold('DESCRIPTION:' + icsEscape(o.description)),
      'BEGIN:VALARM', 'ACTION:DISPLAY', icsFold('DESCRIPTION:' + icsEscape('Buy your Secret Santa gift: ' + o.title)), 'TRIGGER:-P7D', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR', ''
    ].join('\r\n');
  }

  const api = { randInt, shuffle, buildAllowed, maxMatching, isValid, draw, DrawError, b64uEnc, b64uDec, seal, open, makeIcs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SantaCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
