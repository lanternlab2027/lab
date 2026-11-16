// Shared Playwright helper for the GoatCounter page-view counter in local tests.
//
// count.js skips localhost by default, so a local test would never see the beacon.
// stubCounter(ctx) turns on allow_local for the test only (window.goatcounter before
// count.js runs), routes https://lanternlab.goatcounter.com/** to a local 204 and records
// every hit. Register it AFTER a test's own catch-all route: Playwright runs the most
// recently registered matching route first, so the counter never reaches the catch-all.
//
//   const GC = require('../analytics/test_helper.js');
//   const gc = await GC.stubCounter(ctx);
//   ... page.goto(...) ...
//   GC.checkBeacons(gc, check, { forbid: ['my-fixture.txt', 'secret words'] });
//
// Only https://lanternlab.goatcounter.com/count may ever be contacted.
'use strict';

const HOST = 'https://lanternlab.goatcounter.com';
const COUNT = HOST + '/count';

const isCounter = (url) => url === COUNT || url.startsWith(COUNT + '?');

async function stubCounter(ctx) {
  const gc = { hits: [], other: [] };
  await ctx.addInitScript(() => { window.goatcounter = Object.assign(window.goatcounter || {}, { allow_local: true }); });
  await ctx.route(HOST + '/**', (route) => {
    const r = route.request();
    if (isCounter(r.url())) gc.hits.push({ url: r.url(), method: r.method(), body: r.postData() || '', type: r.resourceType() });
    else gc.other.push(r.url());
    return route.fulfill({ status: 204, body: '' });
  });
  return gc;
}

// Decoded query parameters of one beacon.
function params(hit) {
  const u = new URL(hit.url);
  const out = {};
  for (const [k, v] of u.searchParams) out[k] = v;
  return out;
}

// File names (with extension) in a fixtures folder, recursive, as `forbid` strings.
// (Bare stems are left out: some, like "Order History", are also words in a page title.)
function fixtureNames(dir) {
  const fs = require('fs'), path = require('path');
  const out = new Set();
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { walk(path.join(d, e.name)); continue; }
      out.add(e.name);
    }
  };
  walk(dir);
  return [...out];
}

const KEYS = ['p', 'r', 't', 'e', 's', 'b', 'q', 'rnd', 'ns'];

// Asserts every recorded beacon is a plain page view of this site:
// right endpoint, no request body, no '#' (URL hash) anywhere, and none of the
// `forbid` strings (file names, fixture contents, hash payloads) in the URL.
// opts.min: minimum number of beacons expected (default 1).
// opts.expect: exact values for some fields, e.g. { p: '/wrapped/', q: '' } (the page path and
// query string at load), so nothing else can ride along in them.
function checkBeacons(gc, check, opts = {}) {
  const min = opts.min === undefined ? 1 : opts.min;
  const forbid = (opts.forbid || []).filter(Boolean);
  const n = gc.hits.length;
  check(n >= min, `page-view counter beacon sent (${n})`);
  check(gc.other.length === 0, `nothing but /count contacted on the counter host (${gc.other.join(', ') || 'none'})`);
  const bad = { req: [], hash: [], extra: [], expect: [], leak: [] };
  for (const h of gc.hits) {
    const p = params(h);
    const raw = decodeURIComponent(h.url);
    if (!isCounter(h.url) || h.body) bad.req.push(h.method + ' ' + h.url);
    // The hash must not be in the beacon URL itself or in the URL fields (path, query, referrer).
    // (The title may contain '#', e.g. "#1 dog name"; hash-state pages pin their title.)
    if (h.url.includes('#') || ['p', 'q', 'r'].some((k) => (p[k] || '').includes('#'))) bad.hash.push(p.p);
    const extra = Object.keys(p).filter((k) => !KEYS.includes(k));
    if (extra.length) bad.extra.push(extra.join(','));
    for (const [k, v] of Object.entries(opts.expect || {})) if ((p[k] || '') !== v) bad.expect.push(`${k}=${JSON.stringify(p[k] || '')}`);
    for (const f of forbid) if (raw.includes(f) || h.url.includes(encodeURIComponent(f))) bad.leak.push(f);
  }
  const show = (a) => (a.length ? ': ' + [...new Set(a)].slice(0, 3).join(' | ') : '');
  check(!bad.req.length, `beacons are bodyless requests to ${COUNT}${show(bad.req)}`);
  check(!bad.hash.length, `beacons carry no URL hash${show(bad.hash)}`);
  check(!bad.extra.length, `beacons have only page-view fields${show(bad.extra)}`);
  if (opts.expect) check(!bad.expect.length, `beacons match ${JSON.stringify(opts.expect)}${show(bad.expect)}`);
  check(!bad.leak.length, `beacons carry no file or hash data (${forbid.length} strings checked)${show(bad.leak)}`);
}

// True for an uncaught error thrown inside the vendored count.js. Upstream count.js reads
// localStorage without a try/catch, so in a browser where storage access throws it stops
// with an error and sends nothing (fails closed). Tests that block storage use this to tell
// that error apart from the app's own errors, and assert no beacon was sent.
const fromCounter = (err) => /\/vendor\/goatcounter\/count\.js/.test((err && err.stack) || '');

module.exports = { HOST, COUNT, isCounter, stubCounter, checkBeacons, params, fixtureNames, fromCounter };
