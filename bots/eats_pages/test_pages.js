// Tests for the static restaurant pages (docs/eats/r/).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/eats_pages/test_pages.js <screenshot dir> [--no-live] [camis ...]
// 1. Playwright at 390px on 5 pages (one per grade type where possible): layout, content, head tags, JSON-LD.
// 2. Every internal link on every generated page (and every sitemap URL) returns 200 from a local server.
// 3. Live smoke (skip with --no-live): the CTA opens the app, which loads that restaurant from NYC Open Data.
'use strict';
const { chromium } = require('playwright');
const GC = require('../analytics/test_helper.js'); // page-view counter stub + beacon checks
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../../docs');
const R = path.join(ROOT, 'eats', 'r');
const Z = path.join(ROOT, 'eats', 'z'); // per-ZIP index pages (Nov 16)
const args = process.argv.slice(2);
const OUT = path.resolve(args[0] || '.');
const LIVE = !args.includes('--no-live');
const PICK = args.slice(1).filter((a) => /^\d+$/.test(a));
const PAGES = PICK.length ? PICK : ['40732665', '40364581', '40745618', '40400997', '50080342'];
fs.mkdirSync(OUT, { recursive: true });

const PORT = 8792, ORIGIN = 'http://127.0.0.1:' + PORT, SITE = 'https://lanternlab2027.github.io/lab/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.xml': 'application/xml', '.png': 'image/png', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, path.normalize(p));
  if (!f.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(b);
  });
}).listen(PORT);

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

function get(url) {
  return new Promise((resolve) => http.get(url, (r) => { r.resume(); r.on('end', () => resolve(r.statusCode)); }).on('error', () => resolve(0)));
}

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? htmlFiles(path.join(dir, d.name)) : (d.name.endsWith('.html') ? [path.join(dir, d.name)] : []));
}

async function linkCheck() {
  console.log('Internal links');
  const files = htmlFiles(R).concat(fs.existsSync(Z) ? htmlFiles(Z) : []);
  const targets = new Map(); // absolute local URL -> first page that links to it
  for (const f of files) {
    const rel = '/' + path.relative(ROOT, f).split(path.sep).join('/');
    const base = ORIGIN + rel;
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const h = m[1].replace(/&amp;/g, '&');
      if (/^(https?:|mailto:|#)/.test(h)) continue;
      const u = new URL(h, base).href;
      if (!targets.has(u)) targets.set(u, rel);
    }
  }
  // Sitemap URLs map to local paths too (sitemap-eats.xml, plus sitemap-eats-2.xml ... when split).
  const smFiles = fs.readdirSync(ROOT).filter((f) => /^sitemap-eats(-\d+)?\.xml$/.test(f));
  const smUrls = smFiles.flatMap((f) => [...fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  smUrls.forEach((u) => { const l = ORIGIN + '/' + u.slice(SITE.length); if (!targets.has(l)) targets.set(l, 'sitemap-eats.xml'); });
  const bad = [];
  const list = [...targets.keys()];
  for (let i = 0; i < list.length; i += 50) {
    const codes = await Promise.all(list.slice(i, i + 50).map(get));
    codes.forEach((c, k) => { if (c !== 200) bad.push(c + ' ' + list[i + k] + ' (from ' + targets.get(list[i + k]) + ')'); });
  }
  check(bad.length === 0, `${list.length} unique internal URLs from ${files.length} pages + ${smUrls.length} sitemap URLs return 200` + (bad.length ? ':\n    ' + bad.slice(0, 20).join('\n    ') : ''));
  const idx = fs.readFileSync(path.join(ROOT, 'sitemap-index.xml'), 'utf8');
  check(idx.includes(SITE + 'sitemap.xml') && idx.includes(SITE + 'sitemap-buildings.xml') && smFiles.every((f) => idx.includes(SITE + f)),
    `sitemap-index.xml lists sitemap.xml, sitemap-buildings.xml and ${smFiles.join(', ')}`);
  check(smUrls.length === files.length && new Set(smUrls).size === smUrls.length, `eats sitemaps list every generated page once (${smUrls.length} URLs, ${files.length} files)`);
  // Wording and markup guards across all pages.
  let banned = [], ratingMarkup = [];
  // Restaurant trading names are the pages' subject and are excluded from the wording check
  // ("Best Deli", "U Best Bakery" are real DBAs), as escaped in the HTML.
  const BAN = /\b(worst|best|dirtiest|filthy|gross|disgusting|shocking|avoid|ranked|ranking|top \d+)\b/i;
  const bannedNames = new Set();
  for (const f of files) {
    if (!/\/\d+\.html$/.test(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/<h1>([^<]*)<\/h1>/);
    if (m && BAN.test(m[1])) { bannedNames.add(m[1]); bannedNames.add(m[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')); }
  }
  const names = [...bannedNames].sort((a, b) => b.length - a.length);
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    let visible = s.replace(/<p class="off">[\s\S]*?<\/p>/g, ''); // official DOHMH text excluded
    for (const n of names) visible = visible.split(n).join(' ');
    if (BAN.test(visible.replace(/<[^>]+>/g, ' '))) banned.push(path.basename(f));
    if (/"@type":\s*"(Restaurant|FoodEstablishment|Review|AggregateRating|Rating|LocalBusiness)"/.test(s)) ratingMarkup.push(path.basename(f));
  }
  check(!banned.length, `no ranking or sensational wording (outside ${names.length} restaurant names)` + (banned.length ? ': ' + banned.slice(0, 5).join(', ') : ''));
  check(!ratingMarkup.length, 'no Restaurant/Review/Rating structured data' + (ratingMarkup.length ? ': ' + ratingMarkup.slice(0, 5).join(', ') : ''));
  check(!files.some((f) => /<img|url\(/.test(fs.readFileSync(f, 'utf8'))), 'no images on any page');
}

async function pageChecks(browser) {
  console.log('Pages at 390px');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const gc = await GC.stubCounter(ctx); // GoatCounter -> local 204; checked per page below
  for (const camis of PAGES) {
    const page = await ctx.newPage();
    const external = [];
    const gcBefore = gc.hits.length;
    page.on('request', (r) => { if (!r.url().startsWith(ORIGIN) && !GC.isCounter(r.url())) external.push(r.url()); });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const res = await page.goto(`${ORIGIN}/eats/r/${camis}.html`);
    const info = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
      const cta = q('a.cta');
      const r = cta ? cta.getBoundingClientRect() : null;
      return {
        title: document.title, desc: (q('meta[name=description]') || {}).content || '', canonical: (q('link[rel=canonical]') || {}).href || '',
        h1: (q('h1') || {}).textContent || '', badge: !!q('.badge'), grade: (q('.glabel') || {}).textContent || '',
        ld, cta: cta ? { text: cta.textContent, href: cta.getAttribute('href'), w: r.width, top: r.top } : null,
        ins: document.querySelectorAll('article.ins').length, viol: document.querySelectorAll('ul.viol li').length,
        codes: document.querySelectorAll('ul.viol .code').length,
        sw: document.documentElement.scrollWidth, asof: /Data as of [A-Z][a-z]+ \d+, \d{4}/.test(document.body.innerText),
        how: /How NYC restaurant grades work/.test(document.body.innerText) && /snapshot/.test(document.body.innerText) && !!q('a[href*="nyc.gov"]'),
        bytes: document.documentElement.outerHTML.length,
      };
    });
    console.log(` ${camis}: ${info.h1} - ${info.grade}`);
    check(res.status() === 200, 'HTTP 200');
    check(info.sw <= 390, `no horizontal scroll (scrollWidth ${info.sw})`);
    check(info.h1 && info.badge && info.grade, 'name, badge and grade label shown');
    check(info.title.length > 20 && info.desc.length > 60, `title (${info.title.length} chars) and description (${info.desc.length} chars)`);
    check(info.canonical === `${SITE}eats/r/${camis}.html`, 'canonical is the production URL');
    const bc = info.ld.find((x) => x['@type'] === 'BreadcrumbList');
    check(info.ld.length === 1 && bc && bc.itemListElement.length >= 4 && bc.itemListElement.every((e, i) => e.position === i + 1 && e.item.startsWith(SITE)), 'one JSON-LD block: a valid BreadcrumbList');
    check(info.cta && info.cta.text === 'Full history and share card' && info.cta.href === `../?camis=${camis}` && info.cta.w >= 300, 'CTA "Full history and share card" -> ../?camis=, full width');
    check(info.ins >= 1 && info.ins <= 3, `${info.ins} recent inspections shown`);
    check(info.codes === info.viol, `every violation (${info.viol}) shows its official code`);
    check(info.asof, '"Data as of" date shown');
    check(info.how, 'grading note with DOHMH citation and snapshot caveat');
    check(external.length === 0, 'no external requests besides the page-view counter' + (external.length ? ': ' + external.join(', ') : ''));
    GC.checkBeacons({ hits: gc.hits.slice(gcBefore), other: gc.other }, check, { expect: { p: `/eats/r/${camis}.html`, q: '' } });
    check(errors.length === 0, 'no page errors');
    await page.screenshot({ path: path.join(OUT, `r-${camis}-390.png`), fullPage: true });
    await page.close();
  }
  // Index pages at 390px.
  const zipPage = fs.existsSync(Z) ? '/eats/z/' + fs.readdirSync(Z).filter((f) => f.endsWith('.html')).sort()[0] : null;
  for (const p of ['/eats/r/', '/eats/r/borough/staten-island.html', '/eats/r/cuisine/pizza.html', '/eats/r/cuisine/pizza/brooklyn.html', zipPage].filter(Boolean)) {
    const page = await ctx.newPage();
    const res = await page.goto(ORIGIN + p);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(res.status() === 200 && sw <= 390, `${p}: 200, no horizontal scroll (${sw})`);
    if (p === '/eats/r/') await page.screenshot({ path: path.join(OUT, 'r-index-390.png'), fullPage: false });
    if (p === zipPage) await page.screenshot({ path: path.join(OUT, 'z-index-390.png'), fullPage: false });
    await page.close();
  }
  await ctx.close();
}

async function liveSmoke(browser) {
  console.log('Live smoke: CTA into the app');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const camis = PAGES[0];
  await page.goto(`${ORIGIN}/eats/r/${camis}.html`);
  const name = (await page.textContent('h1')).trim();
  await Promise.all([page.waitForURL(/\/eats\/\?camis=/), page.click('a.cta')]);
  try {
    await page.waitForFunction((n) => { const e = document.querySelector('#rc-name'); return e && e.textContent.trim() === n; }, name, { timeout: 30000 });
    check(true, `app opened ?camis=${camis} and loaded "${name}" from NYC Open Data`);
    await page.screenshot({ path: path.join(OUT, `app-from-cta-390.png`) });
  } catch (e) { check(false, 'app did not load the restaurant: ' + e.message.split('\n')[0]); }
  await ctx.close();
}

(async () => {
  await linkCheck();
  const browser = await chromium.launch();
  try {
    await pageChecks(browser);
    if (LIVE) await liveSmoke(browser);
  } finally { await browser.close(); server.close(); }
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
