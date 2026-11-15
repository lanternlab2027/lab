// End-to-end test for docs/dogs/ (app + static pages) at 390px and 1280px, plus an internal-link check.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/dogs/test_page.js [screenshot dir]
// Kit is routed to a local stub; the real API is never hit. Any other off-origin request fails the test.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '.cache', 'shots'));
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8814, ORIGIN = 'http://127.0.0.1:' + PORT;
const srv = require('../names/serve.js')(PORT);

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const status = (u) => new Promise((res) => http.get(u, (r) => { r.resume(); res(r.statusCode); }).on('error', () => res(0)));
const PAGES = ['/dogs/n/luna.html', '/dogs/n/coco.html', '/dogs/n/shih-tzu.html', '/dogs/n/index.html', '/dogs/n/m.html', '/dogs/breed/', '/dogs/breed/french-bulldog.html', '/dogs/borough/', '/dogs/borough/brooklyn.html'];

(async () => {
  const browser = await chromium.launch();
  const linksSeen = new Set();
  const meta = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../docs/dogs/data/meta.json')));
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
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text() + ' @' + page.url()); }); page.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    const noHScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    const collect = async () => (await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href))).forEach((h) => linksSeen.add(h.split('#')[0]));

    // ---- app ----
    await page.goto(ORIGIN + '/dogs/?ref=tiktok');
    await page.waitForFunction(() => document.querySelectorAll('#suggest option').length >= 1000);
    check(await noHScroll(), 'app: no horizontal scroll on load');
    check((await page.textContent('h1')).includes('Report Card'), 'app: title renders');
    check(await page.evaluate(() => document.querySelector('.dogs-n').textContent) === meta.dogs.toLocaleString('en-US'), 'app: dog count filled from meta');
    check(await page.evaluate(() => !document.getElementById('signup').hidden), 'kit: signup visible with the real tag');
    if (width === 390) await page.screenshot({ path: path.join(OUT, 'app-empty-390.png'), fullPage: true });
    await page.fill('#q', 'luna'); await page.click('#search button[type=submit]');
    await page.waitForSelector('#result .rc-name');
    const app = await page.evaluate(() => ({
      name: document.querySelector('#result .rc-name').textContent,
      big: document.querySelector('#result .big').textContent,
      stats: [...document.querySelectorAll('#result .stat b')].map((b) => b.textContent),
      polylines: document.querySelectorAll('#result svg.chart polyline').length,
      bars: document.querySelectorAll('#result .bars li').length,
      url: location.search, pass: document.querySelector('#pass-text').textContent,
      full: !!document.querySelector('#result a[href="n/luna.html"]')
    }));
    check(app.name === 'Luna' && /There are [\d,]+ licensed dogs named Luna in NYC\./.test(app.big), 'app: Luna card headline (' + app.big + ')');
    check(app.stats[0] === '#2', 'app: Luna is #2 (' + app.stats.join(', ') + ')');
    check(app.polylines === 1 && app.bars >= 10 && app.full, 'app: chart, breed/borough/ZIP bars, link to static page');
    check(/n=Luna/.test(app.url) && /ref=tiktok/.test(app.url), 'app: URL updated, incoming ref kept (' + app.url + ')');
    check(app.pass.includes('https://lanternlab2027.github.io/lab/dogs/?n=Luna&ref=share-tiktok') && /There are [\d,]+ licensed dogs named Luna in NYC/.test(app.pass), 'app: share text has headline, link, ref passthrough');
    const card = await page.evaluate(() => {
      const c = document.querySelector('#card'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let min = 765, max = 0; for (let i = 0; i < d.length; i += 4 * 499) { const v = d[i] + d[i + 1] + d[i + 2]; min = Math.min(min, v); max = Math.max(max, v); }
      return { w: c.width, h: c.height, spread: max - min };
    });
    check(card.w === 1080 && card.h === 1350 && card.spread > 300, 'app: share card is 1080x1350 and drawn');
    const dl = page.waitForEvent('download'); await page.click('#card-save'); const d = await dl;
    check(d.suggestedFilename() === 'nyc-dog-name-luna.png', 'app: Save PNG downloads ' + d.suggestedFilename());
    if (width === 390) { await page.screenshot({ path: path.join(OUT, 'app-luna-390.png'), fullPage: true }); fs.writeFileSync(path.join(OUT, 'card-luna.png'), Buffer.from((await page.evaluate(() => document.querySelector('#card').toDataURL())).split(',')[1], 'base64')); }
    else await page.screenshot({ path: path.join(OUT, 'app-luna-1280.png'), fullPage: true });
    check(await noHScroll(), 'app: no horizontal scroll with report');
    await collect();

    // variant spellings resolve to one name
    await page.fill('#q', 'JAY JAY'); await page.click('#search button[type=submit]');
    await page.waitForFunction(() => /Jay/.test(document.querySelector('#result .rc-name').textContent));
    check(/^Jay[- ]Jay$/.test(await page.textContent('#result .rc-name')), 'app: "JAY JAY" finds ' + await page.textContent('#result .rc-name'));
    // quick link
    await page.click('#quick a[data-name="Max"]');
    await page.waitForFunction(() => document.querySelector('#result .rc-name').textContent === 'Max');
    check(true, 'app: quick link loads Max');
    // junk / rare names are not found
    for (const q of ['Unknown', 'Zzqxvbl']) {
      await page.fill('#q', q); await page.click('#search button[type=submit]');
      await page.waitForFunction(() => document.querySelector('#status').classList.contains('err'));
      check(/at least 5 licensed NYC dogs/.test(await page.textContent('#status')), `app: "${q}" not found, privacy rule explained`);
    }
    // a small name (5-19 dogs) works in the app but has no static page
    const small = await page.evaluate(async () => { const s = await (await fetch('data/s/z.json')).json(); const e = Object.values(s).find((r) => r.t < 20); return e && e.n; });
    if (small) {
      await page.fill('#q', small); await page.click('#search button[type=submit]');
      await page.waitForFunction((n) => document.querySelector('#result .rc-name') && document.querySelector('#result .rc-name').textContent === n, small);
      check(!(await page.$('#result a[href^="n/"]')), `app: small name "${small}" shows a card without a static-page link`);
    }

    // ---- Kit signup with a numeric test tag (stubbed) ----
    await page.addInitScript(() => { window.DOGS_KIT_TAG_TEST = '123456'; });
    await page.goto(ORIGIN + '/dogs/');
    await page.waitForFunction(() => !document.getElementById('signup').hidden);
    await page.fill('#signup-email', 'test@example.com'); await page.click('#signup-form button');
    await page.waitForFunction(() => /on the list/.test(document.querySelector('#signup-msg').textContent));
    const k = kit[kit.length - 1];
    check(k && /\/v3\/tags\/123456\/subscribe$/.test(k.url) && JSON.parse(k.body).email === 'test@example.com' && Object.keys(JSON.parse(k.body)).sort().join() === 'api_key,email', 'kit: posts only api_key + email to the tag');

    // ---- static pages ----
    for (const p of PAGES) {
      await page.goto(ORIGIN + p);
      const info = await page.evaluate(() => ({
        h1: document.querySelector('h1').textContent, scripts: document.querySelectorAll('script:not([type="application/ld+json"])').length,
        title: document.title, canon: document.querySelector('link[rel=canonical]').href,
        note: /licensed dogs only, not all dogs/.test(document.body.textContent) && /Not affiliated with the City of New York/.test(document.body.textContent),
        footer: [...document.querySelectorAll('footer a')].map((a) => a.getAttribute('href')),
        ld: [...document.querySelectorAll('script[type="application/ld+json"]')].every((s) => { try { JSON.parse(s.textContent); return true; } catch (e) { return false; } })
      }));
      const up = p.split('/').length - 3; // /dogs/n/x.html -> 1
      check(info.h1 && info.scripts === 0 && info.ld && info.note, `${p}: h1, no scripts, JSON-LD, data note`);
      check(info.canon === 'https://lanternlab2027.github.io/lab' + p.replace(/index\.html$/, ''), `${p}: canonical`);
      check(info.footer.includes('../'.repeat(up) + '../') && info.footer.includes('../'.repeat(up) + '../apps/'), `${p}: footer links to lab root + apps`);
      check(await noHScroll(), `${p}: no horizontal scroll`);
      const shot = { '/dogs/n/luna.html': 'page-luna', '/dogs/n/index.html': 'page-top100', '/dogs/breed/french-bulldog.html': 'page-frenchie', '/dogs/borough/brooklyn.html': 'page-brooklyn', '/dogs/breed/': 'page-breeds' }[p];
      if (shot) await page.screenshot({ path: path.join(OUT, `${shot}-${width}.png`), fullPage: true });
      await collect();
    }

    check(errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    check(offOrigin.length === 0, 'no off-origin requests except stubbed Kit' + (offOrigin.length ? ': ' + offOrigin.slice(0, 3).join(', ') : ''));
    await ctx.close();
  }
  await browser.close();

  console.log('\n== links ==');
  const internal = [...linksSeen].filter((u) => u.startsWith(ORIGIN));
  const bad = [];
  for (const u of internal) { const s = await status(u); if (s !== 200) bad.push(s + ' ' + u); }
  check(bad.length === 0, `${internal.length} internal links from visited pages return 200` + (bad.length ? ': ' + bad.slice(0, 5).join(', ') : ''));
  const external = [...linksSeen].filter((u) => !u.startsWith(ORIGIN));
  check(external.every((u) => /^https:\/\/lanternlab2027\.github\.io\//.test(u)), 'no external links besides our own site (' + external.length + ')');
  srv.close();
  console.log(`\n${fails ? fails + ' FAILED' : 'all passed'}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
