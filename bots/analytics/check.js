#!/usr/bin/env node
// Checks the GoatCounter page-view counter on every HTML page in docs/:
//   - the counter tag appears exactly once, async, with the right endpoint;
//   - its src is a relative path that resolves to docs/vendor/goatcounter/count.js
//     (self-hosted, so no third-party script);
//   - if the page has a Content-Security-Policy meta, it allows the script ('self')
//     and the beacon (https://lanternlab.goatcounter.com in connect-src and img-src);
//   - no page loads GoatCounter's hosted script (gc.zgo.at / zgo.at).
// Search-engine verification files (google*.html) are skipped: their content must stay exact.
// Usage: node bots/analytics/check.js        exit code 1 on any problem
'use strict';
const fs = require('fs');
const path = require('path');

const DOCS = path.resolve(__dirname, '../../docs');
const HOST = 'https://lanternlab.goatcounter.com';
const ENDPOINT = HOST + '/count';
const VENDOR = path.join(DOCS, 'vendor/goatcounter/count.js');
const SKIP = /^google[0-9a-f]+\.html$/;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

// CSP directive lookup with the browser's fallback to default-src.
function directive(csp, name) {
  const map = {};
  for (const part of csp.split(';')) {
    const toks = part.trim().split(/\s+/).filter(Boolean);
    if (toks.length) map[toks[0].toLowerCase()] = toks.slice(1);
  }
  if (map[name]) return map[name];
  return map['default-src'] || null; // null: no restriction
}
const allows = (srcs, v) => srcs === null || srcs.includes(v) || srcs.includes('*');

const problems = [];
let pages = 0, withCsp = 0;
if (!fs.existsSync(VENDOR)) problems.push('missing ' + path.relative(DOCS, VENDOR));
else if (!/^\/\/ GoatCounter: https:\/\/www\.goatcounter\.com\n\/\/ This file is released under the ISC license/.test(fs.readFileSync(VENDOR, 'utf8')))
  problems.push('vendor/goatcounter/count.js lost its license header');

for (const file of walk(DOCS, [])) {
  const rel = path.relative(DOCS, file).split(path.sep).join('/');
  if (SKIP.test(path.basename(file)) && rel === path.basename(file)) continue;
  pages++;
  const html = fs.readFileSync(file, 'utf8');
  const bad = (msg) => problems.push(rel + ': ' + msg);

  const tags = html.match(/<script\b[^>]*\bdata-goatcounter=[^>]*>/gi) || [];
  if (tags.length !== 1) bad('counter tag found ' + tags.length + ' times (want 1)');
  for (const t of tags) {
    const ep = /\bdata-goatcounter="([^"]*)"/.exec(t);
    if (!ep || ep[1] !== ENDPOINT) bad('counter endpoint is not ' + ENDPOINT);
    if (!/\sasync[\s>]/.test(t)) bad('counter tag is not async');
    const src = /\bsrc="([^"]*)"/.exec(t);
    if (!src) { bad('counter tag has no src'); continue; }
    if (/^(https?:)?\/\//.test(src[1]) || src[1].startsWith('/')) bad('counter src is not a relative path: ' + src[1]);
    else if (path.resolve(path.dirname(file), src[1]) !== VENDOR) bad('counter src does not resolve to vendor/goatcounter/count.js: ' + src[1]);
    const st = /\bdata-goatcounter-settings='([^']*)'/.exec(t);
    if (st) { try { JSON.parse(st[1]); } catch (e) { bad('data-goatcounter-settings is not valid JSON'); } }
  }
  if (/zgo\.at\/count\.js|gc\.zgo\.at/.test(html)) bad('loads the hosted GoatCounter script');

  const metas = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"/gi) || [];
  if (metas.length > 1) bad(metas.length + ' CSP metas');
  for (const m of metas) {
    withCsp++;
    const csp = /content="([^"]*)"/.exec(m)[1];
    if (!allows(directive(csp, 'script-src'), "'self'")) bad("CSP script-src does not allow 'self'");
    if (!allows(directive(csp, 'connect-src'), HOST)) bad('CSP connect-src does not allow ' + HOST);
    if (!allows(directive(csp, 'img-src'), HOST)) bad('CSP img-src does not allow ' + HOST);
  }
}

if (problems.length) {
  console.error(problems.slice(0, 50).join('\n'));
  if (problems.length > 50) console.error('... and ' + (problems.length - 50) + ' more');
  console.error('FAIL: ' + problems.length + ' problem(s) in ' + pages + ' pages');
  process.exit(1);
}
console.log('OK: ' + pages + ' pages have the counter exactly once; ' + withCsp + ' with a CSP that allows it.');
