// Playwright test for docs/apps/ (apps hub). Kit is routed to a local stub; the real API is never hit.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/apps_hub/test_page.js <screenshot dir>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const OUT = path.resolve(process.argv[2] || '.'); fs.mkdirSync(OUT, { recursive: true });
const PORT = 8794, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.xml': 'application/xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(b); });
}).listen(PORT);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const APPS = ['wrapped', 'reading', 'netflix', 'sport', 'dating', 'awards', 'santa', 'bingo', 'then', 'eats'];

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const pg = await ctx.newPage();
    const errors = [], external = [], kitBodies = [];
    pg.on('pageerror', e => errors.push(String(e)));
    pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    pg.on('request', r => { if (!r.url().startsWith(ORIGIN)) external.push(r.url()); });
    await pg.route('https://api.convertkit.com/**', r => { kitBodies.push(r.request().postDataJSON()); r.fulfill({ status: 200, contentType: 'application/json', body: '{"subscription":{}}' }); });
    await pg.goto(ORIGIN + '/apps/', { waitUntil: 'load' });
    for (const y of [800, 1600, 2400, 3200, 4000, 6000]) { await pg.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y); await pg.waitForTimeout(80); }
    await pg.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await pg.waitForFunction(() => [...document.images].every(i => i.complete));
    ok(errors.length === 0, `${w}px: no console/page errors ${errors.join(' | ')}`);
    ok(external.length === 0, `${w}px: no external requests on load ${external.join(' ')}`);
    const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= w, `${w}px: no horizontal scroll (scrollWidth ${sw})`);
    const broken = await pg.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.src));
    ok(broken.length === 0, `${w}px: all images load ${broken.join(' ')}`);
    const cards = await pg.$$eval('.card', cs => cs.map(c => ({ h: c.querySelector('h3').textContent, img: !!c.querySelector('img'), p: !!c.querySelector('p'), href: c.querySelector('a.try').getAttribute('href'), txt: c.querySelector('a.try').textContent })));
    ok(cards.length === 14 && cards.every(c => c.img && c.p && /Try it/.test(c.txt)), `${w}px: 14 cards each with thumbnail, line and Try it`);
    ok(APPS.every(a => cards.some(c => c.href === '../' + a + '/')), `${w}px: every app linked`);
    for (const id of ['wrapped', 'games', 'tools', 'holidays', 'data', 'signup']) ok(await pg.$('#' + id), `${w}px: section #${id}`);
    ok(await pg.$eval('link[rel=canonical]', l => l.href) === 'https://lanternlab2027.github.io/lab/apps/', `${w}px: canonical`);
    // whole card clickable via stretched Try it link
    const im = await pg.$('#games .card img'); await im.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' })); const box = await im.boundingBox();
    const hit = await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.getAttribute('href'); }, [box.x + 20, box.y + 20]);
    ok(hit === '../then/', `${w}px: card image area is covered by the Try it link (${hit})`);
    await Promise.all([pg.waitForNavigation({ waitUntil: 'commit', timeout: 8000 }).catch(() => null), pg.mouse.click(box.x + 20, box.y + 20)]);
    ok(/\/then\//.test(pg.url()), `${w}px: clicking card image opens app (${pg.url()})`);
    await pg.goto(ORIGIN + '/apps/');
    await pg.$$eval('img[loading=lazy]', is => is.forEach(i => { i.loading = 'eager'; }));
    await pg.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth));
    await pg.screenshot({ path: path.join(OUT, `apps-${w}.png`), fullPage: true });
    await pg.screenshot({ path: path.join(OUT, `apps-${w}-fold.png`) });
    if (w === 390) {
      await pg.fill('#signup-email', 'test@example.com'); await pg.click('#signup-form button');
      await pg.waitForSelector('#signup-form b');
      const b = kitBodies[0] || {};
      ok(kitBodies.length === 1 && Object.keys(b).sort().join() === 'api_key,email' && b.email === 'test@example.com', 'signup sends only api_key + email to Kit');
      await pg.screenshot({ path: path.join(OUT, 'apps-signup-done.png'), clip: await (await pg.$('#signup')).boundingBox() });
    }
    await ctx.close();
  }

  // Home page promo and app footers
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage();
  await pg.goto(ORIGIN + '/');
  ok(await pg.$('a.apps-promo[href="apps/"]'), 'home: prominent apps promo');
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= 390), 'home: no horizontal scroll at 390');
  await pg.screenshot({ path: path.join(OUT, 'home-390-fold.png') });
  for (const a of APPS) {
    const html = fs.readFileSync(path.join(ROOT, a, 'index.html'), 'utf8');
    ok((html.match(/href="\.\.\/apps\/"/g) || []).length === 1 && /More free apps/.test(html), `${a}: footer links More free apps`);
  }
  await ctx.close();

  // Every internal link on the hub, the home page and each app page's footer link resolves 200
  const pages = ['/apps/', '/'];
  const targets = new Set();
  for (const p of pages) {
    const f = path.join(ROOT, p, 'index.html'), html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/(?:href|src)="([^"#]+)/g)) {
      const u = m[1]; if (/^(https?:|mailto:|data:)/.test(u)) continue;
      targets.add(new URL(u, ORIGIN + p).pathname);
    }
  }
  for (const a of APPS) targets.add(new URL('../apps/', ORIGIN + '/' + a + '/').pathname);
  targets.add('/apps/og.png'); targets.add('/sitemap.xml');
  const bad = [];
  for (const t of targets) { const r = await fetch(ORIGIN + t); if (r.status !== 200) bad.push(t + ' ' + r.status); }
  ok(bad.length === 0, `${targets.size} internal links return 200 ${bad.join(', ')}`);
  ok(/\/lab\/apps\/<\/loc>/.test(fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8')), 'sitemap has apps/');

  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
