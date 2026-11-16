// End-to-end test for docs/names/ (app + static pages) at 390px and 1280px, plus an internal-link check.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/names/test_page.js [screenshot dir]
// Kit is routed to a local stub; the real API is never hit. Any other off-origin request fails the test.
const { chromium } = require('playwright');
const GC = require('../analytics/test_helper.js'); // page-view counter stub + beacon checks
const fs = require('fs'), path = require('path'), http = require('http');
const DOCS = path.resolve(__dirname, '../../docs');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'shots'));
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8812, ORIGIN = 'http://127.0.0.1:' + PORT;
const srv = require('./serve.js')(PORT);

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const status = (u) => new Promise((res) => http.get(u, (r) => { r.resume(); res(r.statusCode); }).on('error', () => res(0)));
const PAGES = ['/names/n/olivia.html', '/names/n/jordan.html', '/names/n/theodore.html'];

(async () => {
  const browser = await chromium.launch();
  const linksSeen = new Set();
  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px ==`);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
    const offOrigin = [], kit = [];
    await ctx.route('**/*', (route) => {
      const r = route.request(), u = r.url();
      if (u.startsWith(ORIGIN)) return route.continue();
      if (u.startsWith('https://api.convertkit.com/')) { kit.push({ url: u, body: r.postData() }); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"subscription":{}}' }); }
      offOrigin.push(u); return route.abort();
    });
    const gc = await GC.stubCounter(ctx); // GoatCounter -> local 204; checked with the off-origin check
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text() + ' @' + page.url()); }); page.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    const noHScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    const collect = async () => (await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href))).forEach((h) => linksSeen.add(h.split('#')[0]));

    // ---- app: single name ----
    await page.goto(ORIGIN + '/names/?ref=tiktok');
    await page.waitForFunction(() => document.querySelectorAll('#suggest option').length > 1000);
    check(await noHScroll(), 'app: no horizontal scroll on load');
    check((await page.textContent('h1')).includes('Report Card'), 'app: title renders');
    await page.fill('#q', 'hazel'); await page.fill('#yr', '1990'); await page.click('#search button[type=submit]');
    await page.waitForSelector('#result .rc-name');
    const app = await page.evaluate(() => ({
      name: document.querySelector('#result .rc-name').textContent,
      stamp: document.querySelector('#result .stamp').textContent,
      stats: [...document.querySelectorAll('#result .stat b')].map((b) => b.textContent),
      polylines: document.querySelectorAll('#result svg.chart polyline').length,
      born: /Born in 1990\?/.test(document.querySelector('#result').textContent),
      twins: /6,341 other babies born that year share it/.test(document.querySelector('#result').textContent),
      chips: document.querySelectorAll('#result ul.chips a[data-name]').length,
      url: location.search, pass: document.querySelector('#pass-text').textContent
    }));
    check(app.name === 'Hazel' && app.stamp === 'Vintage revival', 'app: Hazel report, vintage revival stamp');
    check(app.stats[0] === '#21' && app.stats[2] === '1897', 'app: rank #21 and peak 1897 (' + app.stats.join(', ') + ')');
    check(app.polylines >= 1 && app.born && app.twins, 'app: chart, birth-year line and same-year line');
    check(app.chips > 0, 'app: similar rising names listed (' + app.chips + ')');
    check(/n=Hazel/.test(app.url) && /y=1990/.test(app.url) && /ref=tiktok/.test(app.url), 'app: URL updated, incoming ref kept (' + app.url + ')');
    check(app.pass.includes('https://lanternlab2027.github.io/lab/names/?n=Hazel&ref=share-tiktok') && /peaked in 1897/.test(app.pass), 'app: share text has link + ref passthrough');
    const card = await page.evaluate(() => {
      const c = document.querySelector('#card'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let min = 765, max = 0; for (let i = 0; i < d.length; i += 4 * 499) { const v = d[i] + d[i + 1] + d[i + 2]; min = Math.min(min, v); max = Math.max(max, v); }
      return { w: c.width, h: c.height, spread: max - min };
    });
    check(card.w === 1080 && card.h === 1350 && card.spread > 300, 'app: share card is 1080x1350 and drawn');
    const dl = page.waitForEvent('download'); await page.click('#card-save'); const d = await dl;
    check(d.suggestedFilename() === 'name-report-card-hazel.png', 'app: Save PNG downloads ' + d.suggestedFilename());
    if (width === 390) { await page.screenshot({ path: path.join(OUT, 'app-390.png'), fullPage: true }); fs.writeFileSync(path.join(OUT, 'card.png'), Buffer.from((await page.evaluate(() => document.querySelector('#card').toDataURL())).split(',')[1], 'base64')); }
    check(await noHScroll(), 'app: no horizontal scroll with report');
    await collect();

    // similar-name chip navigates in place
    const chipName = await page.getAttribute('#result ul.chips a[data-name]', 'data-name');
    await page.click('#result ul.chips a[data-name]');
    await page.waitForFunction((n) => document.querySelector('#result .rc-name').textContent === n, chipName);
    check(true, 'app: clicking similar name "' + chipName + '" loads its card');

    // not found
    await page.fill('#q', 'Zzqxv'); await page.fill('#yr', ''); await page.click('#search button[type=submit]');
    await page.waitForFunction(() => document.querySelector('#status').classList.contains('err'));
    check(/at least 5 babies/.test(await page.textContent('#status')), 'app: unknown name explains the 5-baby rule');

    // ---- compare mode ----
    await page.goto(ORIGIN + '/names/?n=Hazel&vs=Violet');
    await page.waitForSelector('#result table');
    const cmp = await page.evaluate(() => ({ h: document.querySelector('#result .rc-name').textContent, lines: document.querySelector('#result svg.chart').querySelectorAll('polyline').length, cards: document.querySelectorAll('#result .rc-name').length, pass: document.querySelector('#pass-text').textContent }));
    check(/Hazel\s*vs\s*Violet/.test(cmp.h) && cmp.lines === 2 && cmp.cards === 3, 'compare: heading, two-line chart, both report cards');
    check(cmp.pass.includes('?n=Hazel&vs=Violet&ref=share'), 'compare: share link carries both names');
    check(await noHScroll(), 'compare: no horizontal scroll');
    if (width === 1280) await page.screenshot({ path: path.join(OUT, 'compare-1280.png'), fullPage: true });

    // ---- Kit signup (stubbed) ----
    await page.fill('#signup-email', 'test@example.com'); await page.click('#signup-form button');
    await page.waitForFunction(() => /on the list/.test(document.querySelector('#signup-form').textContent));
    const k = kit[kit.length - 1];
    check(k && /\/v3\/tags\/25915951\/subscribe$/.test(k.url) && JSON.parse(k.body).email === 'test@example.com' && Object.keys(JSON.parse(k.body)).sort().join() === 'api_key,email', 'kit: posts only api_key + email to tag 25915951');

    // ---- static pages ----
    for (const p of PAGES) {
      await page.goto(ORIGIN + p);
      const info = await page.evaluate(() => ({
        h1: document.querySelector('h1').textContent, scripts: document.querySelectorAll('script:not([type="application/ld+json"]):not([data-goatcounter])').length, counter: document.querySelectorAll('script[data-goatcounter]').length,
        poly: document.querySelectorAll('svg.chart polyline').length, title: document.title, desc: document.querySelector('meta[name=description]').content,
        canon: document.querySelector('link[rel=canonical]').href, note: /Source: U\.S\. Social Security Administration\. Not affiliated\./.test(document.body.textContent),
        footer: [...document.querySelectorAll('footer a')].map((a) => a.getAttribute('href'))
      }));
      const n = path.basename(p, '.html');
      check(info.h1.toLowerCase() === n && info.poly >= 1 && info.scripts === 0 && info.counter === 1, `${p}: h1, inline SVG chart, no scripts but the page-view counter`);
      check(info.title.length <= 70 && info.desc.length >= 80 && info.desc.length <= 200 && info.canon.endsWith(p.replace('/names/', '/lab/names/')), `${p}: title (${info.title.length}), description (${info.desc.length}), canonical`);
      check(info.note && info.footer.includes('../../') && info.footer.includes('../../apps/'), `${p}: data note + footer links`);
      check(await noHScroll(), `${p}: no horizontal scroll`);
      if (n === 'jordan') await page.screenshot({ path: path.join(OUT, `page-jordan-${width}.png`), fullPage: true });
      await collect();
    }
    for (const p of ['/names/n/', '/names/n/m.html']) { await page.goto(ORIGIN + p); check(await noHScroll(), `${p}: no horizontal scroll`); await collect(); }

    check(errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    check(offOrigin.length === 0, 'no off-origin requests except stubbed Kit' + (offOrigin.length ? ': ' + offOrigin.slice(0, 3).join(', ') : ''));
    GC.checkBeacons(gc, check); // one page view per load: no hash, nothing but page-view fields
    await ctx.close();
  }
  await browser.close();

  // ---- internal links from the pages visited: every one returns 200 ----
  console.log('\n== links ==');
  const internal = [...linksSeen].filter((u) => u.startsWith(ORIGIN));
  const bad = [];
  for (const u of internal) { const s = await status(u); if (s !== 200) bad.push(s + ' ' + u); }
  check(bad.length === 0, `${internal.length} internal links from visited pages return 200` + (bad.length ? ': ' + bad.slice(0, 5).join(', ') : ''));
  const external = [...linksSeen].filter((u) => !u.startsWith(ORIGIN));
  check(external.every((u) => /^https:\/\/lanternlab2027\.github\.io\//.test(u)), 'no external links besides our own site (' + external.length + ')');

  // ---- static check of every relative link in every generated page ----
  const dir = path.join(DOCS, 'names/n'); let total = 0; const missing = new Set();
  for (const f of fs.readdirSync(dir)) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of html.matchAll(/href="([^"#]+)"/g)) {
      const h = m[1].replace(/&amp;/g, '&'); if (/^https?:/.test(h)) continue; total++;
      let t = path.resolve(dir, h.split('?')[0]); if (h.split('?')[0].endsWith('/')) t = path.join(t, 'index.html');
      if (!fs.existsSync(t)) missing.add(f + ' -> ' + h);
    }
  }
  check(missing.size === 0, `all ${total} relative links across ${fs.readdirSync(dir).length} generated pages resolve` + (missing.size ? ': ' + [...missing].slice(0, 5).join(', ') : ''));
  const sm = fs.readFileSync(path.join(DOCS, 'sitemap-names.xml'), 'utf8'), smUrls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const smBad = smUrls.filter((u) => { let p = u.replace('https://lanternlab2027.github.io/lab/', ''); if (p.endsWith('/') || !p) p += 'index.html'; return !fs.existsSync(path.join(DOCS, p)); });
  check(smBad.length === 0 && /sitemap-names\.xml/.test(fs.readFileSync(path.join(DOCS, 'sitemap-index.xml'), 'utf8')), `sitemap-names.xml: ${smUrls.length} URLs all exist; listed in sitemap-index.xml`);

  srv.close();
  console.log(`\n${fails ? fails + ' FAILED' : 'all passed'}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
