/* Year in Motion: lazy zip reader. Reads only the central directory and the entries we ask for, straight from the
 * File (Blob.slice), so a multi-gigabyte Strava archive full of photos never has to fit in memory.
 * Inflates with the browser's own DecompressionStream('deflate-raw'). Handles Zip64 (archives over 4 GB).
 * Pure client-side; no network. Falls back to the vendored JSZip when DecompressionStream is missing (old Safari).
 */
(function (root) {
  'use strict';

  function hasNativeInflate() {
    try { new DecompressionStream('deflate-raw'); return true; } catch (e) { return false; }
  }
  function hasNativeGunzip() {
    try { new DecompressionStream('gzip'); return true; } catch (e) { return false; }
  }

  async function bytesOf(blob, start, end) { return new Uint8Array(await blob.slice(start, end).arrayBuffer()); }
  async function streamBytes(stream) { return new Uint8Array(await new Response(stream).arrayBuffer()); }

  function u64(dv, p) { return dv.getUint32(p, true) + dv.getUint32(p + 4, true) * 4294967296; }

  var utf8 = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

  async function openNative(blob) {
    var size = blob.size;
    if (size < 22) throw new Error('That zip file is empty or damaged.');
    var tailLen = Math.min(size, 65557 + 20);
    var tail = await bytesOf(blob, size - tailLen, size);
    var dv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    var i;
    for (i = tail.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) break;
    if (i < 0) throw new Error('That doesn\u2019t look like a zip file.');
    var count = dv.getUint16(i + 10, true), cdSize = dv.getUint32(i + 12, true), cdOff = dv.getUint32(i + 16, true);
    if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) {
      var l = i - 20;
      if (l >= 0 && dv.getUint32(l, true) === 0x07064b50) {
        var e64 = u64(dv, l + 8);
        var e = await bytesOf(blob, e64, e64 + 56), ev = new DataView(e.buffer);
        if (ev.getUint32(0, true) === 0x06064b50) { count = u64(ev, 32); cdSize = u64(ev, 40); cdOff = u64(ev, 48); }
      }
    }
    if (cdOff + cdSize > size) throw new Error('That zip file looks cut short. Try downloading it again.');
    var cd = await bytesOf(blob, cdOff, cdOff + cdSize), cv = new DataView(cd.buffer);
    var entries = [], p = 0;
    while (p + 46 <= cd.length && cv.getUint32(p, true) === 0x02014b50) {
      var flags = cv.getUint16(p + 8, true), method = cv.getUint16(p + 10, true);
      var csize = cv.getUint32(p + 20, true), usize = cv.getUint32(p + 24, true);
      var nlen = cv.getUint16(p + 28, true), xlen = cv.getUint16(p + 30, true), clen = cv.getUint16(p + 32, true);
      var off = cv.getUint32(p + 42, true);
      var nb = cd.subarray(p + 46, p + 46 + nlen);
      var name = utf8 ? utf8.decode(nb) : String.fromCharCode.apply(null, nb);
      var x = p + 46 + nlen, xe = x + xlen;
      while (x + 4 <= xe) {
        var id = cv.getUint16(x, true), sz = cv.getUint16(x + 2, true);
        if (id === 1) {
          var q = x + 4;
          if (usize === 0xffffffff) { usize = u64(cv, q); q += 8; }
          if (csize === 0xffffffff) { csize = u64(cv, q); q += 8; }
          if (off === 0xffffffff) { off = u64(cv, q); q += 8; }
        }
        x += 4 + sz;
      }
      entries.push({ name: name, method: method, csize: csize, size: usize, offset: off, encrypted: !!(flags & 1), dir: /\/$/.test(name) });
      p = xe + clen;
    }
    return {
      entries: entries.filter(function (en) { return !en.dir; }),
      read: async function (en) {
        if (en.encrypted) throw new Error('That zip is password-protected.');
        var lh = await bytesOf(blob, en.offset, en.offset + 30), lv = new DataView(lh.buffer);
        if (lv.getUint32(0, true) !== 0x04034b50) throw new Error('Damaged zip entry: ' + en.name);
        var start = en.offset + 30 + lv.getUint16(26, true) + lv.getUint16(28, true);
        var part = blob.slice(start, start + en.csize);
        if (en.method === 0) return new Uint8Array(await part.arrayBuffer());
        if (en.method === 8) return streamBytes(part.stream().pipeThrough(new DecompressionStream('deflate-raw')));
        throw new Error('Unsupported zip compression in ' + en.name);
      }
    };
  }

  async function openJSZip(blob) {
    if (!root.JSZip) throw new Error('This browser can\u2019t open zip files here. Unzip it and upload activities.csv instead.');
    var z = await root.JSZip.loadAsync(blob);
    var entries = [];
    z.forEach(function (path, f) { if (!f.dir) entries.push({ name: path, size: (f._data && f._data.uncompressedSize) || 0, _f: f }); });
    return { entries: entries, read: function (en) { return en._f.async('uint8array'); } };
  }

  function open(blob) { return hasNativeInflate() && blob.stream ? openNative(blob) : openJSZip(blob); }

  async function gunzip(bytes) {
    if (!hasNativeGunzip()) throw new Error('gzip not supported in this browser');
    return streamBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
  }

  var api = { open: open, openNative: openNative, gunzip: gunzip, hasNativeInflate: hasNativeInflate, hasNativeGunzip: hasNativeGunzip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SportZip = api;
})(typeof self !== 'undefined' ? self : this);
