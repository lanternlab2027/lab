/* Awards-Night Ballot Pool: link codec. Everything lives in the URL hash; nothing is stored on a server.
 * Same approach as docs/bracket/codec.js: text -> deflate-raw (CompressionStream) -> base64url, 'z' prefix
 * (or 't' + plain base64url when compression is missing or longer).
 *
 *   #p=<z|t><b64>   pool link (host -> players)
 *   #e=<z|t><b64>   "my picks" link (player -> host); carries the pool too, so it opens on its own
 *   #s=<z|t><b64>   standings link (pool + every entry the host pasted)
 *
 * Pool text, newline-separated:  ab1 / pool name / show id / rules (f = 1 point per category, w = weighted) /
 *   lock (ms since 1970, base 36, "" = none) / tiebreak key ("" none, "custom", or a show tiebreaker id) / custom question / ~
 * Entry text: ae1 / player / picks / tiebreak guess / time36 / show rev36 / check36 / pool text...
 * Standings text: as1 / host's tiebreak answer / count / count lines "player<TAB>picks<TAB>tb<TAB>time36<TAB>rev36<TAB>check36" / pool text...
 *
 * picks: one base-36 char per category ('0' = no pick, '1' = first nominee ...), see Ballot.packPicks.
 * check36: 32-bit FNV-1a of pool id + player + picks + tb + time + rev. It catches links that were cut off,
 * mangled or hand-edited. It is not a lock: anyone who reads this file can make a new valid link.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ballot.js'));
  else root.BallotCodec = factory(root.Ballot);
})(typeof self !== 'undefined' ? self : this, function (B) {
  'use strict';

  var END = '~';
  var LIMITS = { pool: 48, player: 30, question: 120, entries: 300, tb: 100000, hashChars: 40000, inflateBytes: 80000 };

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
  function tbNum(v) {
    if (v === '' || v == null || !isFinite(+v)) return null;
    return Math.max(0, Math.min(LIMITS.tb, Math.round(+v)));
  }

  // ---------- pool ----------
  // opts: { name, show (id), rules ('flat'|'weighted'), lock (ms or 0), tbKey ('', 'custom' or a show tiebreaker id), tbQ }
  function makePool(opts) {
    opts = opts || {};
    var lock = +opts.lock || 0;
    var tbKey = /^[a-z0-9-]{1,16}$/.test(opts.tbKey || '') ? opts.tbKey : '';
    var tbQ = tbKey === 'custom' ? clean(opts.tbQ, LIMITS.question) : '';
    if (tbKey === 'custom' && !tbQ) tbKey = '';
    return {
      name: clean(opts.name, LIMITS.pool) || 'Awards night pool',
      show: /^[a-z0-9-]{1,32}$/.test(opts.show || '') ? opts.show : 'demo',
      rules: opts.rules === 'weighted' ? 'weighted' : 'flat',
      lock: lock > 0 && lock < 8.64e15 ? Math.round(lock) : 0,
      tbKey: tbKey, tbQ: tbQ
    };
  }
  function poolText(pool) {
    return ['ab1', pool.name, pool.show, pool.rules === 'weighted' ? 'w' : 'f', pool.lock ? pool.lock.toString(36) : '', pool.tbKey, pool.tbQ, END].join('\n');
  }
  function poolId(pool) { return hash32(poolText(pool)).toString(36); }
  function parsePoolLines(lines, i) {
    if (lines[i] !== 'ab1') throw codecErr(lines[i] && 'ab1'.indexOf(lines[i]) === 0 ? 'truncated' : 'version');
    if (lines[i + 7] == null) throw codecErr('truncated');
    if (lines[i + 7] !== END) throw codecErr('corrupt');
    var show = lines[i + 2], rules = lines[i + 3], lock = lines[i + 4], tbKey = lines[i + 5], tbQ = lines[i + 6];
    if (!/^[a-z0-9-]{1,32}$/.test(show) || !/^[fw]$/.test(rules) || !/^[0-9a-z]{0,11}$/.test(lock) || !/^([a-z0-9-]{1,16})?$/.test(tbKey)) throw codecErr('corrupt');
    if (tbKey === 'custom' && !clean(tbQ, LIMITS.question)) throw codecErr('corrupt');
    var pool = makePool({ name: lines[i + 1], show: show, rules: rules === 'w' ? 'weighted' : 'flat', lock: lock ? parseInt(lock, 36) : 0, tbKey: tbKey, tbQ: tbQ });
    return { pool: pool, next: i + 8 };
  }

  // ---------- entries ----------
  // e: { name, picks (array), tb, time, rev }
  function makeEntry(pool, e) {
    var ent = { name: clean(e.name, LIMITS.player) || 'Player', picks: e.picks.slice(), tb: tbNum(e.tb), time: Math.max(0, Math.round(+e.time || 0)), rev: Math.max(0, Math.min(1295, +e.rev || 0)) };
    ent.check = checksum(pool, ent);
    return ent;
  }
  function checksum(pool, e) {
    return hash32(poolId(pool) + '|' + e.name + '|' + B.packPicks(e.picks) + '|' + (e.tb == null ? '' : e.tb) + '|' + e.time.toString(36) + '|' + e.rev.toString(36)).toString(36);
  }
  function fields(e) { return [e.name, B.packPicks(e.picks), e.tb == null ? '' : String(e.tb), e.time.toString(36), e.rev.toString(36), e.check]; }
  // fields already split -> entry with .ok (checksum matches) and .late (made after the lock)
  function readEntry(pool, f) {
    var name = clean(f[0], LIMITS.player), picks = B.unpackPicks(f[1]);
    if (!name || !picks || !picks.length) throw codecErr('corrupt');
    if (f[2] && !/^\d{1,6}$/.test(f[2])) throw codecErr('corrupt');
    if (!/^[0-9a-z]{0,11}$/.test(f[3] || '') || !/^[0-9a-z]{0,2}$/.test(f[4] || '') || !/^[0-9a-z]{1,7}$/.test(f[5] || '')) throw codecErr('corrupt');
    var e = { name: name, picks: picks, tb: f[2] ? +f[2] : null, time: f[3] ? parseInt(f[3], 36) : 0, rev: f[4] ? parseInt(f[4], 36) : 0, check: f[5] };
    e.ok = name === f[0] && checksum(pool, e) === e.check;
    e.late = isLate(pool, e);
    return e;
  }
  function isLate(pool, e) { return !!(pool.lock && e.time > pool.lock); }

  // ---------- encode / decode ----------
  async function encodePool(pool, opts) { return 'p=' + await pack(poolText(pool), opts && opts.noCompress); }
  async function encodeEntry(pool, e, opts) {
    return 'e=' + await pack('ae1\n' + fields(e).join('\n') + '\n' + poolText(pool), opts && opts.noCompress);
  }
  async function encodeStandings(pool, entries, hostAnswer, opts) {
    var ha = tbNum(hostAnswer);
    var t = 'as1\n' + (ha == null ? '' : ha) + '\n' + entries.length + '\n' + entries.map(function (e) { return fields(e).join('\t'); }).join('\n') + (entries.length ? '\n' : '') + poolText(pool);
    return 's=' + await pack(t, opts && opts.noCompress);
  }

  // -> { type: 'pool'|'entry'|'standings', pool, poolId, entry?, entries?, hostAnswer? } or { error }
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
        if (lines[0] !== 'ae1') throw codecErr(lines[0] && 'ae1'.indexOf(lines[0]) === 0 ? 'truncated' : 'version');
        if (lines.length < 9) throw codecErr('truncated');
        r = parsePoolLines(lines, 7);
        if (r.next !== lines.length) throw codecErr('corrupt');
        return { type: 'entry', pool: r.pool, poolId: poolId(r.pool), entry: readEntry(r.pool, lines.slice(1, 7)) };
      }
      if (lines[0] !== 'as1') throw codecErr(lines[0] && 'as1'.indexOf(lines[0]) === 0 ? 'truncated' : 'version');
      if (lines[1] == null || lines[2] == null) throw codecErr('truncated');
      if (!/^(\d{1,6})?$/.test(lines[1])) throw codecErr('corrupt');
      var n = /^\d{1,3}$/.test(lines[2]) ? +lines[2] : -1;
      if (n < 0 || n > LIMITS.entries) throw codecErr('corrupt');
      if (lines.length < 3 + n + 8) throw codecErr('truncated');
      r = parsePoolLines(lines, 3 + n);
      if (r.next !== lines.length) throw codecErr('corrupt');
      var entries = [];
      for (var i = 0; i < n; i++) {
        var f = lines[3 + i].split('\t');
        if (f.length !== 6) throw codecErr('corrupt');
        entries.push(readEntry(r.pool, f));
      }
      return { type: 'standings', pool: r.pool, poolId: poolId(r.pool), entries: entries, hostAnswer: lines[1] === '' ? null : +lines[1] };
    } catch (e) {
      return { error: e.code || 'corrupt' };
    }
  }

  // Pull every ballot link (#p= / #e= / #s=) out of pasted text.
  function findLinks(text) {
    var out = [], re = /#([pes]=[zt][A-Za-z0-9_-]+)/g, m;
    while ((m = re.exec(String(text || '')))) out.push(m[1]);
    return out;
  }

  return {
    LIMITS: LIMITS, hash32: hash32, canCompress: canCompress, isLate: isLate,
    makePool: makePool, poolText: poolText, poolId: poolId, makeEntry: makeEntry, checksum: checksum,
    encodePool: encodePool, encodeEntry: encodeEntry, encodeStandings: encodeStandings, decode: decode, findLinks: findLinks,
    b64: { enc: bytesToB64url, dec: b64urlToBytes }
  };
});
