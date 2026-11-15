/* 76-Team Bracket: link codec. Everything lives in the URL hash; nothing is stored on a server.
 * Same approach as docs/partybingo/codec.js: text -> deflate-raw (CompressionStream) -> base64url.
 *
 *   #p=<z|t><b64>   pool link (commissioner -> players)
 *   #e=<z|t><b64>   "my picks" link (player -> commissioner); carries the pool too, so it opens on its own
 *   #s=<z|t><b64>   standings link (pool + every entry the commissioner pasted)
 *
 * Pool text, newline-separated:
 *   bp1 / pool name / rules / lock / layout / field / [76 team names if field = c] / ~
 *   rules  "1.1.2.4.8.16.32" points per round (Opening Round .. title game), then optional ";u" (upset bonus)
 *          and ";s" (a solo bracket, not a pool)
 *   lock   lock time, ms since 1970 in base 36, or "" for no lock
 *   layout Bracket.layoutText(), e.g. "E=East:11.12.16,W=West:12.15.16,S=South:11.12.16,M=Midwest:12.15.16"
 *   field  "o" = use the official field file (placeholders until it is posted), "c" = names follow
 * Entry text: be1 / player / picks (base64url of 19 bytes) / tiebreak / time36 / check36 / pool text...
 * Standings text: bs1 / count / count lines "player<TAB>picks<TAB>tiebreak<TAB>time36<TAB>check36" / pool text...
 *
 * check36 is a 32-bit FNV-1a checksum of pool id + player + picks + tiebreak + time. It catches links that were
 * cut off, mangled or hand-edited. It is not a lock: anyone who reads this file can make a new valid link.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./bracket.js'));
  else root.BracketCodec = factory(root.Bracket);
})(typeof self !== 'undefined' ? self : this, function (B) {
  'use strict';

  var END = '~';
  var LIMITS = { pool: 48, player: 30, team: 40, entries: 250, tb: 400, hashChars: 40000, inflateBytes: 80000 };

  // ---------- bytes ----------
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
  async function pack(text, noCompress) {
    var bytes = utf8(text), plain = 't' + bytesToB64url(bytes);
    if (!noCompress && canCompress()) {
      try { var z = 'z' + bytesToB64url(await deflate(bytes)); if (z.length < plain.length) return z; } catch (e) { /* fall back */ }
    }
    return plain;
  }
  async function unpack(s) {
    var m = /^([zt])([A-Za-z0-9_-]+)$/.exec(s || '');
    if (!m) throw codecErr('corrupt');
    var bytes;
    try { bytes = b64urlToBytes(m[2]); } catch (e) { throw codecErr('corrupt'); }
    if (m[1] === 'z') {
      if (typeof DecompressionStream === 'undefined') throw codecErr('no-decompress');
      try { bytes = await inflate(bytes); } catch (e) { throw codecErr(/too big/.test(e && e.message) ? 'too-long' : 'truncated'); }
    }
    try { return unutf8(bytes); } catch (e) { throw codecErr('corrupt'); }
  }
  function codecErr(code) { var e = new Error(code); e.code = code; return e; }

  // ---------- helpers ----------
  var clean = B.clean;
  function hash32(str) {
    var b = utf8(str), h = 0x811c9dc5;
    for (var i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function picksStr(picks) { return bytesToB64url(B.packPicks(picks)); }
  function readPicks(s) { try { return B.unpackPicks(b64urlToBytes(s)); } catch (e) { return null; } }

  // ---------- pool ----------
  // opts: { name, rules: {pts, upset}, lock (ms or 0), layout, teams ({slotId: name} or null for the official field), solo }
  function makePool(opts) {
    opts = opts || {};
    var layout = B.normLayout(opts.layout || B.DEFAULT_LAYOUT);
    var rules = opts.rules && B.checkRules(opts.rules) ? { pts: opts.rules.pts.slice(), upset: !!opts.rules.upset } : B.clone(B.PRESETS.classic);
    delete rules.label;
    var teams = null;
    if (opts.teams) {
      var S = B.build(layout); teams = {};
      S.slots.forEach(function (sl) { teams[sl.id] = clean(opts.teams[sl.id], LIMITS.team) || B.placeholder(S, S.slotIx[sl.id]); });
    }
    var lock = +opts.lock || 0;
    return {
      name: clean(opts.name, LIMITS.pool) || (opts.solo ? 'My bracket' : 'Bracket pool'),
      rules: { pts: rules.pts, upset: !!rules.upset }, lock: lock > 0 && lock < 8.64e15 ? Math.round(lock) : 0,
      layout: layout, teams: teams, solo: !!opts.solo
    };
  }
  function poolText(pool) {
    var S = B.build(pool.layout);
    var lines = ['bp1', pool.name, pool.rules.pts.join('.') + (pool.rules.upset ? ';u' : '') + (pool.solo ? ';s' : ''),
      pool.lock ? pool.lock.toString(36) : '', B.layoutText(pool.layout), pool.teams ? 'c' : 'o'];
    if (pool.teams) S.slots.forEach(function (sl) { lines.push(pool.teams[sl.id]); });
    lines.push(END);
    return lines.join('\n');
  }
  function poolId(pool) { return hash32(poolText(pool)).toString(36); }
  // lines starting at index i -> { pool, next } or throws
  function parsePoolLines(lines, i) {
    if (lines[i] !== 'bp1') throw codecErr(lines[i] && 'bp1'.indexOf(lines[i]) === 0 ? 'truncated' : 'version');
    var name = lines[i + 1], ruleLine = lines[i + 2], lockLine = lines[i + 3], layoutLine = lines[i + 4], fieldLine = lines[i + 5];
    if (fieldLine == null) throw codecErr('truncated');
    var rm = /^(\d{1,3}(?:\.\d{1,3}){6})((?:;[us])*)$/.exec(ruleLine || '');
    if (!rm) throw codecErr('corrupt');
    if (!/^[0-9a-z]{0,11}$/.test(lockLine)) throw codecErr('corrupt');
    var layout = B.parseLayoutText(layoutLine);
    if (!layout) throw codecErr('corrupt');
    var S = B.build(layout), teams = null, j = i + 6;
    if (fieldLine === 'c') {
      teams = {};
      for (var k = 0; k < S.slots.length; k++, j++) {
        if (lines[j] == null || lines[j] === END) throw codecErr('truncated');
        teams[S.slots[k].id] = clean(lines[j], LIMITS.team) || B.placeholder(S, k);
      }
    } else if (fieldLine !== 'o') throw codecErr('corrupt');
    if (lines[j] !== END) throw codecErr('truncated');
    var pool = makePool({ name: name, rules: { pts: rm[1].split('.').map(Number), upset: /;u/.test(rm[2]) }, lock: lockLine ? parseInt(lockLine, 36) : 0,
      layout: layout, teams: teams, solo: /;s/.test(rm[2]) });
    return { pool: pool, next: j + 1 };
  }

  // ---------- entries ----------
  // e: { name, picks, tb, time }
  function makeEntry(pool, e) {
    var name = clean(e.name, LIMITS.player) || 'Player';
    var tb = (e.tb === '' || e.tb == null || !isFinite(+e.tb)) ? null : Math.max(0, Math.min(LIMITS.tb, Math.round(+e.tb)));
    var time = Math.max(0, Math.round(+e.time || 0));
    var ent = { name: name, picks: e.picks.slice(), tb: tb, time: time };
    ent.check = checksum(pool, ent);
    return ent;
  }
  function checksum(pool, e) {
    return hash32(poolId(pool) + '|' + e.name + '|' + picksStr(e.picks) + '|' + (e.tb == null ? '' : e.tb) + '|' + e.time.toString(36)).toString(36);
  }
  function entryLine(e) { return [e.name, picksStr(e.picks), e.tb == null ? '' : String(e.tb), e.time.toString(36), e.check].join('\t'); }
  // fields already split -> entry with .ok (checksum matches) and .late (after the lock)
  function readEntry(pool, f) {
    var name = clean(f[0], LIMITS.player), picks = readPicks(f[1]);
    if (!name || !picks) throw codecErr('corrupt');
    if (!B.validPicks(B.build(pool.layout), picks)) throw codecErr('corrupt');
    if (f[2] && !/^\d{1,3}$/.test(f[2])) throw codecErr('corrupt');
    if (!/^[0-9a-z]{0,11}$/.test(f[3] || '') || !/^[0-9a-z]{1,7}$/.test(f[4] || '')) throw codecErr('corrupt');
    var e = { name: name, picks: picks, tb: f[2] ? +f[2] : null, time: f[3] ? parseInt(f[3], 36) : 0, check: f[4] };
    e.ok = checksum(pool, e) === e.check;
    e.late = !!(pool.lock && e.time > pool.lock);
    return e;
  }

  // ---------- encode / decode ----------
  async function encodePool(pool, opts) { return 'p=' + await pack(poolText(pool), opts && opts.noCompress); }
  async function encodeEntry(pool, e, opts) {
    var t = 'be1\n' + [e.name, picksStr(e.picks), e.tb == null ? '' : String(e.tb), e.time.toString(36), e.check].join('\n') + '\n' + poolText(pool);
    return 'e=' + await pack(t, opts && opts.noCompress);
  }
  async function encodeStandings(pool, entries, opts) {
    var t = 'bs1\n' + entries.length + '\n' + entries.map(entryLine).join('\n') + (entries.length ? '\n' : '') + poolText(pool);
    return 's=' + await pack(t, opts && opts.noCompress);
  }

  // -> { type: 'pool'|'entry'|'standings', pool, poolId, entry?, entries? } or { error }
  async function decode(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (!h) return { error: 'empty' };
    if (h.length > LIMITS.hashChars) return { error: 'too-long' };
    var m = /^([pes])=(.*)$/.exec(h);
    if (!m) return { error: 'not-a-link' };
    try {
      var text = await unpack(m[2]), lines = text.split('\n'), r;
      if (m[1] === 'p') {
        r = parsePoolLines(lines, 0);
        if (r.next !== lines.length) throw codecErr('corrupt');
        return { type: 'pool', pool: r.pool, poolId: poolId(r.pool) };
      }
      if (m[1] === 'e') {
        if (lines[0] !== 'be1') throw codecErr(lines[0] && 'be1'.indexOf(lines[0]) === 0 ? 'truncated' : 'version');
        if (lines.length < 8) throw codecErr('truncated');
        r = parsePoolLines(lines, 6);
        if (r.next !== lines.length) throw codecErr('corrupt');
        return { type: 'entry', pool: r.pool, poolId: poolId(r.pool), entry: readEntry(r.pool, lines.slice(1, 6)) };
      }
      if (lines[0] !== 'bs1') throw codecErr(lines[0] && 'bs1'.indexOf(lines[0]) === 0 ? 'truncated' : 'version');
      var n = /^\d{1,3}$/.test(lines[1] || '') ? +lines[1] : -1;
      if (n < 0 || n > LIMITS.entries) throw codecErr('corrupt');
      r = parsePoolLines(lines, 2 + n);
      if (r.next !== lines.length) throw codecErr('corrupt');
      var entries = [];
      for (var i = 0; i < n; i++) {
        var f = lines[2 + i].split('\t');
        if (f.length !== 5) throw codecErr('corrupt');
        entries.push(readEntry(r.pool, f));
      }
      return { type: 'standings', pool: r.pool, poolId: poolId(r.pool), entries: entries };
    } catch (e) {
      return { error: e.code || 'corrupt' };
    }
  }

  // Pull every bracket link (#p= / #e= / #s=) out of pasted text.
  function findLinks(text) {
    var out = [], re = /#([pes]=[zt][A-Za-z0-9_-]+)/g, m;
    while ((m = re.exec(String(text || '')))) out.push(m[1]);
    return out;
  }

  return {
    LIMITS: LIMITS, hash32: hash32, canCompress: canCompress, picksStr: picksStr, readPicks: readPicks,
    makePool: makePool, poolText: poolText, poolId: poolId, makeEntry: makeEntry, checksum: checksum,
    encodePool: encodePool, encodeEntry: encodeEntry, encodeStandings: encodeStandings, decode: decode, findLinks: findLinks,
    b64: { enc: bytesToB64url, dec: b64urlToBytes }
  };
});
