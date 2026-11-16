// Tests for the Snow Day Odds town pages (bots/snow/build_towns.js).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/snow/test_towns.js <screenshot dir>
// Static checks over every generated page, then Playwright on 5 town pages (seeded pick) at 390px with
// api.weather.gov routed to the synthetic fixtures in bots/snow/fixtures.js and the clock frozen at FX.NOW.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const FX = require('./fixtures.js');

const ROOT = path.resolve(__dirname, '../../docs');
const TDIR = path.join(ROOT, 'snow', 't');
const SITE = 'https://lanternlab2027.github.io/lab/';
const OUT = path.resolve(process.argv[2] || '.');
const TOWNS = JSON.parse(fs.readFileSync(path.join(__dirname, 'towns.json'), 'utf8')).towns;

let fails = 0;
const check = (c, m) => { if (!c) { console.log('  FAIL ' + m); fails++; } return c; };
const ok = (m) => console.log('  ok   ' + m);

// ---------- static ----------
console.log('== static checks');
const pages = [];
(function walk(d) { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) pages.push(p); } })(TDIR);
const townFiles = pages.filter((p) => !p.endsWith('index.html'));
check(townFiles.length === TOWNS.length, 'one page per town (' + townFiles.length + ' vs ' + TOWNS.length + ')') && ok(townFiles.length + ' town pages, ' + (pages.length - townFiles.length) + ' index pages');
check(TOWNS.length >= 380 && TOWNS.length <= 450, 'about 400 towns');

const indexHtml = fs.readFileSync(path.join(ROOT, 'snow', 'index.html'), 'utf8');
const CSP = /<meta http-equiv="Content-Security-Policy"[^>]*>/.exec(indexHtml)[0];
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap-snow.xml'), 'utf8');
const smUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check(new Set(smUrls).size === smUrls.length, 'sitemap has no duplicate URLs');
check(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/.test(sitemap) && sitemap.trim().endsWith('</urlset>'), 'sitemap is a urlset');
const smIndex = fs.readFileSync(path.join(ROOT, 'sitemap-index.xml'), 'utf8');
check((smIndex.match(/sitemap-snow\.xml/g) || []).length === 1, 'sitemap-index lists sitemap-snow.xml once');
check(!fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').includes('/snow/t/'), 'main sitemap.xml untouched by town pages');
check(/href="t\/"[^>]*>Browse towns/.test(indexHtml), 'main page links to Browse towns');

const titles = new Map(), canon = new Set();
const zipShards = {};
function zipExists(z) { const k = z.slice(0, 2); if (!zipShards[k]) zipShards[k] = JSON.parse(fs.readFileSync(path.join(ROOT, 'snow', 'z', k + '.json'), 'utf8')); return !!zipShards[k][z.slice(2)]; }
let links = 0, ld = 0;
for (const p of pages) {
  const rel = path.relative(ROOT, p);
  const h = fs.readFileSync(p, 'utf8');
  check(!/[^\x00-\x7e\n\t]/.test(h), rel + ': ASCII only');
  const title = (/<title>([^<]+)<\/title>/.exec(h) || [])[1];
  check(title && !titles.has(title), rel + ': unique title ' + title + (titles.has(title) ? ' (also ' + titles.get(title) + ')' : ''));
  titles.set(title, rel);
  const desc = (/<meta name="description" content="([^"]+)">/.exec(h) || [])[1];
  check(desc && desc.length >= 70 && desc.length <= 300, rel + ': description length ' + (desc || '').length);
  const can = (/<link rel="canonical" href="([^"]+)">/.exec(h) || [])[1];
  const expect = SITE + rel.replace(/index\.html$/, '');
  check(can === expect, rel + ': canonical ' + can + ' != ' + expect);
  check(smUrls.includes(can), rel + ': canonical is in sitemap-snow.xml');
  canon.add(can);
  check(h.includes(CSP), rel + ': same CSP as the main app');
  check((h.match(/http-equiv="Content-Security-Policy"/g) || []).length === 1, rel + ': exactly one CSP');
  check(!/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/.test(h), rel + ': no inline scripts (CSP script-src self)');
  check(!/\son[a-z]+="/.test(h), rel + ': no inline event handlers');
  // JSON-LD
  const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  check(blocks.length === 1, rel + ': one JSON-LD block');
  for (const b of blocks) {
    let j = null; try { j = JSON.parse(b[1]); } catch (e) { check(false, rel + ': JSON-LD parses: ' + e.message); continue; }
    ld++;
    const types = (j['@graph'] || []).map((n) => n['@type']);
    check(j['@context'] === 'https://schema.org', rel + ': schema.org context');
    check(types.includes('BreadcrumbList') && (types.includes('WebPage') || types.includes('CollectionPage')), rel + ': WebPage/CollectionPage + BreadcrumbList: ' + types);
    check(!/aggregateRating|FAQPage|Review|ratingValue/i.test(b[1]), rel + ': no ratings/FAQ claims');
    const bc = j['@graph'].find((n) => n['@type'] === 'BreadcrumbList');
    check(bc.itemListElement[bc.itemListElement.length - 1].item === can, rel + ': last breadcrumb is the page');
    bc.itemListElement.forEach((it, i) => check(it.position === i + 1 && /^https:\/\//.test(it.item), rel + ': breadcrumb item ' + i));
    const wp = j['@graph'].find((n) => /Page$/.test(n['@type']));
    check(wp.url === can && wp.name === title.replace(/&amp;/g, '&'), rel + ': WebPage url/name match');
  }
  // internal links and assets
  for (const m of h.matchAll(/\s(href|src)="([^"]+)"/g)) {
    const u = m[2];
    if (/^(https?:|mailto:|#|data:)/.test(u)) {
      if (u.startsWith(SITE)) { /* absolute self links: canonical/og/ld; checked via sitemap */ }
      continue;
    }
    links++;
    let target = path.resolve(path.dirname(p), u.split('#')[0].split('?')[0]);
    if (u.endsWith('/') || (fs.existsSync(target) && fs.statSync(target).isDirectory())) target = path.join(target, 'index.html');
    check(target.startsWith(ROOT) && fs.existsSync(target), rel + ': broken link ' + u);
  }
  // town-specific
  if (!p.endsWith('index.html')) {
    const st = path.basename(path.dirname(p)), slug = path.basename(p, '.html');
    const t = TOWNS.find((x) => x.st.toLowerCase() === st && x.slug === slug);
    if (!check(!!t, rel + ': in towns.json')) continue;
    check(title === 'Snow Day Calculator for ' + t.name + ', ' + t.st + ': Will School Be Canceled Tomorrow?', rel + ': title format');
    check(h.includes('data-town-zip="' + t.zip + '"') && zipExists(t.zip), rel + ': town ZIP ' + t.zip + ' is in the app ZIP shards');
    check(h.includes('data-town-region="' + t.region + '"') && h.includes('value="' + t.region + '" checked>') && (h.match(/ checked>/g) || []).length === 1, rel + ': region preset ' + t.region);
    check(h.includes('Only your school district decides'), rel + ': disclaimer');
    check(h.includes('href="./"') && h.includes('href="../"'), rel + ': links to state index and all-states index');
    check(h.includes('<div id="more-apps" class="wrap" data-from="snow"></div>') && h.includes('href="../../../apps/more.css"') && h.includes('src="../../../apps/more.js"'), rel + ': cross-promo strip');
    check(/<footer class="wrap">[\s\S]*Not affiliated with the National Weather Service[\s\S]*href="..\/..\/..\/apps\/"/.test(h), rel + ': footer');
    for (const s of ['model.js', 'nws.js', 'card.js', 'app.js']) check(h.includes('<script src="../../' + s + '"></script>'), rel + ': loads the app module ' + s);
    check(!/\d+(\.\d+)? (inches|in\.) of snow (a|per) year|average snowfall|normal snowfall/i.test(h), rel + ': no snowfall claims (normals not available)');
    const nearby = [...h.matchAll(/<li><a href="([a-z0-9-]+)\.html">/g)].map((m) => m[1]);
    const same = TOWNS.filter((x) => x.st === t.st).length;
    check(nearby.length === Math.min(6, same - 1), rel + ': nearby towns ' + nearby.length);
  }
}
check(canon.size === smUrls.length && smUrls.every((u) => canon.has(u)), 'sitemap URLs == set of page canonicals (' + smUrls.length + ')');
console.log(fails ? '  static: ' + fails + ' failures' : '  ok   static: ' + pages.length + ' pages, ' + ld + ' JSON-LD blocks, ' + links + ' relative links all resolve, titles unique, CSP present');

// ---------- browser ----------
async function browser() {
  const { chromium } = require('playwright');
  const GC = require('../analytics/test_helper.js'); // page-view counter stub + beacon checks
  fs.mkdirSync(OUT, { recursive: true });
  const PORT = 8795, ORIGIN = 'http://127.0.0.1:' + PORT;
  const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.jpg': 'image/jpeg' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.startsWith('/lab/')) p = p.slice(4); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
  }).listen(PORT);

  // Seeded pick of 5 towns (mulberry32), plus the scenario each gets.
  let seed = +(process.env.SEED || 20261201);
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pool = TOWNS.slice(), picks = [];
  while (picks.length < 5) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  if (!picks.some((t) => t.region === 'rare')) picks[4] = TOWNS.find((t) => t.region === 'rare' && !picks.includes(t));
  const b = await chromium.launch();
  console.log('\n== browser (390px): ' + picks.map((t) => t.name + ', ' + t.st).join('; '));
  for (const t of picks) {
    const scen = t.region === 'rare' ? { grid: 'early', alerts: [] } : { grid: 'heavy', alerts: ['Winter Storm Warning'] };
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const log = [], hosts = new Set(), errors = [];
    const json = (route, status, body) => route.fulfill({ status, contentType: 'application/geo+json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    await ctx.route('https://api.weather.gov/**', (route) => {
      const u = new URL(route.request().url()); log.push(u.pathname + u.search);
      if (/^\/points\//.test(u.pathname)) {
        const p = FX.points('42.898,-78.888'); // shape only; city/tz overridden below
        p.properties.relativeLocation.properties.city = 'Nearby'; p.properties.relativeLocation.properties.state = t.st;
        p.properties.timeZone = 'America/New_York';
        return json(route, 200, p);
      }
      if (/^\/gridpoints\//.test(u.pathname)) return json(route, 200, FX.GRIDS[scen.grid]);
      if (u.pathname === '/alerts/active') return json(route, 200, FX.alerts(scen.alerts));
      return json(route, 404, {});
    });
    await ctx.route('https://api.convertkit.com/**', (r) => r.fulfill({ status: 200, body: '{}' }));
    const gc = await GC.stubCounter(ctx); // GoatCounter -> local 204; checked with the other-hosts check
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(FX.NOW));
    page.on('request', (r) => hosts.add(new URL(r.url()).host));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    const rel = 'snow/t/' + t.st.toLowerCase() + '/' + t.slug + '.html';
    await page.goto(ORIGIN + '/lab/' + rel);
    await page.waitForSelector('#result:not([hidden])', { timeout: 15000 }).catch(() => {});
    const shown = !(await page.locator('#result').isHidden());
    const pct = shown ? (await page.textContent('#pct')).trim() : '';
    check(shown && /^\d{1,2}%$/.test(pct), rel + ': odds number rendered on load (' + pct + ', status: ' + (await page.textContent('#status')) + ')');
    const place = shown ? await page.textContent('#place') : '';
    check(place === t.name + ', ' + t.st + ' ' + t.zip, rel + ': place shows town + ZIP: ' + place);
    const pt = log.find((l) => l.startsWith('/points/')) || '';
    const zs = JSON.parse(fs.readFileSync(path.join(ROOT, 'snow/z', t.zip.slice(0, 2) + '.json'), 'utf8'))[t.zip.slice(2)];
    check(pt === '/points/' + (Math.round(zs[0] * 1e4) / 1e4) + ',' + (Math.round(zs[1] * 1e4) / 1e4), rel + ': NWS asked for the ZIP ' + t.zip + ' point: ' + pt);
    check(await page.locator('input[name=region][value=' + t.region + ']').isChecked(), rel + ': region ' + t.region + ' selected');
    check(!/guessed/.test(await page.textContent('#notes')), rel + ': no "guessed" note (page sets the region)');
    check(page.url() === ORIGIN + '/lab/' + rel, rel + ': URL not rewritten');
    check(await page.evaluate(() => { try { return localStorage.getItem('snow.q') === null; } catch (e) { return true; } }), rel + ': ZIP not stored on auto-load');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), rel + ': no horizontal scroll at 390px');
    check(await page.evaluate(() => window.scrollY === 0), rel + ': page not scrolled on load');
    // cross-promo links resolve three folders deep (more.js takes the site root from its own URL)
    const promo = await page.$$eval('#more-apps a', (as) => as.map((a) => a.href));
    check(promo.length === 3, rel + ': cross-promo strip rendered (' + promo.length + ' links)');
    for (const h of promo) {
      const u = new URL(h); let f = path.join(ROOT, u.pathname.replace(/^\/lab\//, '/')); if (f.endsWith('/')) f += 'index.html';
      check(u.origin === ORIGIN && fs.existsSync(f), rel + ': cross-promo link resolves: ' + u.pathname);
    }
    const imgs = await page.$$eval('#more-apps img', (is) => is.map((i) => i.src));
    for (const s of imgs) check(fs.existsSync(path.join(ROOT, new URL(s).pathname.replace(/^\/lab\//, '/'))), rel + ': promo image ' + new URL(s).pathname);
    // A typed ZIP still works on a town page
    await page.fill('#q', '30303'); await page.click('#go');
    await page.waitForFunction(() => /30303/.test(document.getElementById('place').textContent), null, { timeout: 10000 }).catch(() => {});
    check(/30303/.test(await page.textContent('#place')), rel + ': a typed ZIP replaces the town result');
    await page.goto(ORIGIN + '/lab/' + rel); await page.waitForSelector('#result:not([hidden])', { timeout: 15000 }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, 'town-390-' + t.st.toLowerCase() + '-' + t.slug + '.png'), fullPage: false });
    await page.screenshot({ path: path.join(OUT, 'town-390-' + t.st.toLowerCase() + '-' + t.slug + '-full.png'), fullPage: true });
    const bad = [...hosts].filter((h) => !['127.0.0.1:' + PORT, 'api.weather.gov', 'lanternlab.goatcounter.com'].includes(h));
    check(bad.length === 0, rel + ': no other hosts ' + bad.join(','));
    GC.checkBeacons(gc, check, { expect: { q: '' } }); // town pages: page views only, nothing else in the query
    check(errors.length === 0, rel + ': no console errors ' + errors.join(' | '));
    ok(rel + ': ' + pct + ' (' + t.region + ')');
    await ctx.close();
  }
  // index pages render
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
  for (const u of ['snow/t/', 'snow/t/ny/', 'snow/t/dc/']) {
    await page.goto(ORIGIN + '/lab/' + u);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), u + ': no horizontal scroll');
    check((await page.$$('ul.towns a')).length > 0, u + ': lists links');
  }
  await page.goto(ORIGIN + '/lab/snow/t/'); await page.screenshot({ path: path.join(OUT, 'towns-390-index.png'), fullPage: false });
  await ctx.close();
  await b.close(); server.close();
}

(async () => {
  if (!process.argv.includes('--static')) await browser();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
