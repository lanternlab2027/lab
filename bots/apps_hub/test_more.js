// Playwright check for the "More free apps" strip (docs/apps/more.js + more.css) on every app page.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/apps_hub/test_more.js <screenshot dir>
// All non-local requests are aborted and recorded, so the check also proves the strip makes none.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const OUT = path.resolve(process.argv[2] || '.'); fs.mkdirSync(OUT, { recursive: true });
const PORT = 8796, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(b); });
}).listen(PORT);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const APPS = ['wrapped', 'reading', 'netflix', 'sport', 'dating', 'tiktok', 'couples', 'amazon', 'awards', 'santa', 'bingo', 'partybingo', 'then', 'chicago-then', 'eats', 'chi-eats', 'names', 'mileage', 'dogs'];
const SHOT = new Set(process.env.SHOT_ALL ? APPS : ['wrapped', 'santa', 'eats', 'then', 'names', 'mileage', 'partybingo', 'awards']);

async function open(ctx, app, blockStrip) {
  const pg = await ctx.newPage();
  const errors = [], external = [], local404 = [];
  pg.on('pageerror', e => errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  pg.on('response', r => { if (r.url().startsWith(ORIGIN) && r.status() >= 400) local404.push(r.url()); });
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (!u.startsWith(ORIGIN)) { external.push(u); return r.abort(); }
    if (blockStrip && /\/apps\/more\.js$/.test(u)) return r.abort();
    return r.continue();
  });
  await pg.goto(ORIGIN + '/' + app + '/', { waitUntil: 'load' });
  return { pg, errors, external, local404 };
}

(async () => {
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 2 });
    for (const app of APPS) {
      // Reserved height: with the script blocked, the placeholder's height and the footer's offset from it must equal
      // the rendered ones (measured relative to the strip, so the app's own async content doesn't count).
      const ctl = await open(ctx, app, true);
      const before = await ctl.pg.evaluate(() => { const b = document.getElementById('more-apps'); let f = b.nextElementSibling; while (f.tagName === 'SCRIPT') f = f.nextElementSibling; return { h: b.getBoundingClientRect().height, f: f.getBoundingClientRect().top - b.getBoundingClientRect().top }; });
      await ctl.pg.close();

      const { pg, errors, external, local404 } = await open(ctx, app, false);
      await pg.waitForSelector('#more-apps .llm-a');
      await pg.evaluate(() => document.getElementById('more-apps').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await pg.waitForFunction(() => [...document.querySelectorAll('#more-apps img')].every(i => i.complete), null, { timeout: 5000 }).catch(() => {});
      const r = await pg.evaluate(() => {
        const b = document.getElementById('more-apps'); let f = b.nextElementSibling; while (f.tagName === 'SCRIPT') f = f.nextElementSibling;
        const links = [...b.querySelectorAll('a')].map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim(), h: a.getBoundingClientRect().height, w: a.getBoundingClientRect().width }));
        const imgs = [...b.querySelectorAll('img')].map(i => ({ src: i.getAttribute('src'), lazy: i.loading, ok: i.complete && i.naturalWidth > 0 }));
        const h2 = b.querySelector('h2');
        const footerTop = f.getBoundingClientRect().top - b.getBoundingClientRect().top;
        return { links, imgs, heading: h2 && h2.textContent, h: b.getBoundingClientRect().height, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, footerTop, nextIsFooter: f.tagName === 'FOOTER', labelled: b.getAttribute('aria-labelledby') === (h2 && h2.id) };
      });
      const tag = `${app} ${scheme}`;
      ok(r.heading === 'More free apps from Lantern Lab' && r.labelled, `${tag}: heading present and labels the region`);
      ok(r.links.length === 3, `${tag}: 3 links (${r.links.map(l => l.href).join(', ')})`);
      ok(r.links.every(l => !l.href.startsWith('../' + app + '/')), `${tag}: no link to the current app`);
      ok(r.links.every(l => l.href.endsWith('?ref=more-' + app)), `${tag}: links carry ?ref=more-${app}`);
      ok(r.links.every(l => l.h >= 44 && l.text.length > 5), `${tag}: links have text and >=44px tap targets`);
      ok(r.imgs.every(i => i.lazy === 'lazy' && i.src.startsWith('../apps/img/') && i.ok), `${tag}: thumbnails lazy, from ../apps/img/, loaded`);
      ok(Math.abs(r.h - before.h) < 0.5 && Math.abs(r.footerTop - before.f) < 0.5, `${tag}: no layout shift (reserved ${before.h}px, rendered ${r.h}px; footer offset from strip ${before.f} -> ${r.footerTop})`);
      ok(r.nextIsFooter, `${tag}: strip sits directly above the footer`);
      ok(r.sw <= r.cw, `${tag}: no horizontal scroll (${r.sw} <= ${r.cw})`);
      ok(errors.length === 0, `${tag}: no console errors ${errors.join(' | ')}`);
      ok(local404.length === 0, `${tag}: no local 404s ${local404.join(' ')}`);
      ok(!external.some(u => /more|apps\/img/.test(u)), `${tag}: strip makes no external requests`);
      if (external.length) console.log(`  note ${tag}: page's own external requests (aborted): ${[...new Set(external.map(u => new URL(u).host))].join(', ')}`);
      if (SHOT.has(app)) {
        const box = await pg.evaluate(() => { const b = document.getElementById('more-apps').getBoundingClientRect(); return { y: b.top + scrollY }; });
        await pg.screenshot({ path: path.join(OUT, `${app}-390-${scheme}.png`), clip: { x: 0, y: Math.max(0, box.y - 140), width: 390, height: 560 }, fullPage: true });
      }
      await pg.close();
    }
    await ctx.close();
  }
  // Seasonal picks: January on a "rest" app.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    await pg.clock.setFixedTime(new Date('2027-01-10T12:00:00'));
    await pg.goto(ORIGIN + '/mileage/', { waitUntil: 'load' });
    const hrefs = await pg.$$eval('#more-apps a', as => as.map(a => a.getAttribute('href')));
    ok(hrefs.join() === '../bingo/?ref=more-mileage,../amazon/?ref=more-mileage,../apps/?ref=more-mileage', `January on mileage: ${hrefs.join(', ')}`);
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
