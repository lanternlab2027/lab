// Playwright end-to-end test for docs/dating/ (Dating Wrapped).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/dating/test_page.js <screenshot dir>
// Uses only synthetic fixtures. Kit is routed to a stub; the real API is never hit.
const { chromium } = require('playwright');
const GC = require('../analytics/test_helper.js'); // page-view counter stub + beacon checks
const JSZip = require(require('path').resolve(__dirname, '../../docs/dating/vendor/jszip-3.10.1.min.js'));
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../../docs');
const FX = path.join(__dirname, 'fixtures');
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8771, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(b);
  });
}).listen(PORT);

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

async function cardInfo(page) {
  return page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let min = 765, max = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4 * 997) { const v = d[i] + d[i + 1] + d[i + 2]; min = Math.min(min, v); max = Math.max(max, v); sum = (sum * 31 + v) >>> 0; }
    return { w: c.width, h: c.height, spread: max - min, hash: sum, label: c.getAttribute('aria-label').replace(/^Card \d+: /, '') };
  }));
}
async function upload(page, files) {
  await page.evaluate(() => { document.querySelector('#deck').innerHTML = ''; document.querySelector('#status').textContent = ''; });
  await page.setInputFiles('#file', [].concat(files).map((f) => path.join(FX, f)));
  await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0 || document.querySelector('#status').classList.contains('err'), null, { timeout: 30000 });
  return cardInfo(page);
}
async function expectError(page, file, re) {
  await page.evaluate(() => { document.querySelector('#status').textContent = ''; document.querySelector('#status').className = 'status'; });
  await page.setInputFiles('#file', path.join(FX, file));
  await page.waitForFunction(() => document.querySelector('#status').classList.contains('err'));
  return re.test(await page.textContent('#status'));
}
const CORE = ['The year in swipes', 'Match rate', 'Peak season', 'Busiest day', 'The swipe clock', 'Longest streak', 'The chat report', 'Ghost town', 'Dating personality'];

(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px ==`);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, timezoneId: 'America/New_York' });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2026-11-14T12:00:00') });
    const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

    const all = [], offOrigin = [];
    await ctx.route('**/*', (route) => {
      const r = route.request();
      all.push({ url: r.url(), method: r.method() });
      if (!r.url().startsWith(ORIGIN + '/')) { offOrigin.push(r.url()); return route.abort(); }
      return route.continue();
    });
    const gc = await GC.stubCounter(ctx); // GoatCounter -> local 204; checked after the uploads

    await page.goto(ORIGIN + '/dating/?ref=tiktok');
    await page.waitForLoadState('networkidle');
    check(offOrigin.length === 0, `page load makes no off-origin requests (${offOrigin.join(', ') || 'none'})`);
    check(/Nothing uploads\. We never show message text/.test(await page.textContent('#privacy-badge')), 'privacy promise visible');
    check(/Not affiliated with Tinder, Hinge or Match Group/.test(await page.textContent('footer')), 'footer disclaimer present');
    check(await page.locator('footer a[href="../"]').count() === 1, 'footer links to ../');
    const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    check(/default-src 'none'/.test(csp) && /script-src 'self'/.test(csp) && /connect-src https:\/\/api\.convertkit\.com https:\/\/lanternlab\.goatcounter\.com;/.test(csp), 'CSP: scripts self-only, connections to Kit and the page-view counter only');
    const title = await page.title(), desc = await page.getAttribute('meta[name="description"]', 'content');
    check(/tinder wrapped/i.test(title) && /hinge wrapped/i.test(title) && /tinder wrapped/i.test(desc) && /hinge wrapped/i.test(desc), 'SEO title + description target "tinder wrapped" / "hinge wrapped"');
    check(/og\.png$/.test(await page.getAttribute('meta[property="og:image"]', 'content')), 'OG image set');
    const exp = await page.innerHTML('#export');
    check(/help\.tinder\.com\/hc\/en-gb\/articles\/115005626726/.test(exp) && /help\.hinge\.co\/hc\/en-us\/articles\/360011235813/.test(exp), 'export steps cite both help centers');
    check(/\?ref=share-tiktok$/.test(await page.textContent('#pass-text')), '?ref passthrough: shared link carries ref=share-tiktok');
    check(await page.evaluate(() => document.querySelector('.peek img').naturalWidth > 0), 'preview image loads');
    check(!/#fd267a|#ff6036|#fe3c72/i.test(await page.content()), 'no Tinder brand colors in the page');
    const loadCount = all.length;
    const gcAtLoad = gc.hits.length;

    // Tinder zip.
    let cards = await upload(page, 'tinder-export.zip');
    let labels = cards.map((c) => c.label);
    check(cards.length === 9, `Tinder zip -> ${cards.length} cards (${labels.join(', ')})`);
    CORE.forEach((l) => check(labels.includes(l), `has card: ${l}`));
    check(cards.every((c) => c.w === 1080 && c.h === 1920), 'every card is 1080x1920');
    check(cards.every((c) => c.spread > 200), 'every card has rendered content (not blank)');
    check(await page.isChecked('#safe'), 'Safe share is on by default');
    check((await page.inputValue('#year')) === '2026', 'year defaults to the current year (2026)');
    const opts = await page.$$eval('#year option', (o) => o.map((x) => x.value));
    check(JSON.stringify(opts) === '["2026","2025","all"]', `year options ${opts.join(',')}`);
    check(await page.isHidden('#app-wrap'), 'app selector hidden for one app');
    check(!(await page.isHidden('#after')) && /delete/i.test(await page.textContent('#after')), 'advises deleting the export after upload');
    check(!/CANARY/.test(await page.evaluate(() => document.body.innerText)), 'no fixture names/messages anywhere in the page text');
    const h0 = cards.map((c) => c.hash);
    await page.click('#safe');
    let c2 = await cardInfo(page);
    check(c2.length === 9 && c2.filter((c, i) => c.hash !== h0[i]).length >= 4, 'turning Safe share off re-renders cards with counts');
    await page.click('#safe');
    await page.selectOption('#year', '2025');
    c2 = await cardInfo(page);
    check(c2.length >= 7 && c2[0].hash !== h0[0], `2025 re-renders (${c2.length} cards)`);
    await page.selectOption('#year', 'all');
    c2 = await cardInfo(page);
    check(c2.length >= 7 && c2.every((c) => c.spread > 200), `all time renders (${c2.length} cards)`);
    await page.selectOption('#year', '2026');
    await page.fill('#name-input', 'Sam');
    await page.waitForTimeout(450);
    c2 = await cardInfo(page);
    check(c2[0].hash !== h0[0], 'name on cards re-renders');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal page scroll');
    await page.screenshot({ path: path.join(OUT, `page-${width}.png`), fullPage: width === 1280 });
    if (width === 390) await page.locator('#deck').screenshot({ path: path.join(OUT, `deck-${width}.png`) });

    const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('#deck figure:first-child button:has-text("Save PNG")')]);
    const p1 = await dl1.path();
    check(/^dating-wrapped-2026-01-.*\.png$/.test(dl1.suggestedFilename()) && fs.statSync(p1).size > 50000, `Save PNG -> ${dl1.suggestedFilename()} (${fs.statSync(p1).size} bytes)`);
    const [dlz] = await Promise.all([page.waitForEvent('download'), page.click('#zip-all')]);
    const z = await JSZip.loadAsync(fs.readFileSync(await dlz.path()));
    check(Object.keys(z.files).length === 9, `zip has ${Object.keys(z.files).length} PNGs`);

    // Add Hinge (legacy JSON zip) alongside Tinder.
    cards = await upload(page, 'hinge-export.zip');
    check(!(await page.isHidden('#app-wrap')), 'app selector shown with both apps');
    check(cards.length >= 8, `Tinder + Hinge together -> ${cards.length} cards`);
    await page.selectOption('#app', 'hinge');
    c2 = await cardInfo(page);
    check(c2.length >= 6 && !c2.some((c) => c.label === 'The chat report'), `Hinge only -> ${c2.length} cards (${c2.map((c) => c.label).join(', ')})`);
    await page.selectOption('#app', 'tinder');
    c2 = await cardInfo(page);
    check(c2.length === 9, 'Tinder only -> 9 cards');
    await page.screenshot({ path: path.join(OUT, `page-${width}-both.png`) });

    // Other formats on their own.
    for (const [f, min, must] of [
      [['data.json'], 9, 'Match rate'],
      [['matches.json'], 6, 'Ghost town'],
      [['hinge-csv-export.zip'], 6, 'The chat report'],
      [fs.readdirSync(path.join(FX, 'hinge_csv')).map((n) => 'hinge_csv/' + n), 6, 'The year in swipes'],
      [['hinge-csv-sent-only.zip'], 5, 'The year in swipes'],
      [['tinder_iso.json'], 6, 'The swipe clock'],
      [['tinder_zero_matches.json'], 3, 'Dating personality']]) {
      await page.click('#reset');
      cards = await upload(page, f);
      check(cards.length >= min && cards.every((c) => c.spread > 200) && cards.some((c) => c.label === must), `${f.length > 1 ? f.length + ' Hinge CSV files' : f[0]} -> ${cards.length} cards`);
    }
    await page.click('#reset');
    cards = await upload(page, 'tinder_2024_only.json');
    check((await page.inputValue('#year')) === '2024' && /No activity in 2026 yet/.test(await page.textContent('#status')), 'export with only 2024 falls back to 2024 and says so');
    check(await expectError(page, 'not_dating.json', /doesn.t look like a Tinder or Hinge/), 'non-dating JSON shows a clear error');
    check(await expectError(page, 'broken.json', /cut off or damaged/), 'truncated JSON shows a clear error');
    check(await expectError(page, 'empty.json', /empty/), 'empty file shows a clear error');
    check(await expectError(page, 'tinder_empty_usage.json', /no usage history/), 'empty Tinder usage shows a clear error');

    // The core privacy assertion: after page load, uploads and rendering made zero network requests.
    // The static "More free apps" strip (../apps/more.js, more.css, lazy thumbnails) may load after upload; it sends no data.
    const afterUpload = all.slice(loadCount).filter((r) => !(r.method === 'GET' && /^\/apps\/(more\.(js|css)|img\/[a-z-]+\.jpg)$/.test(r.url.replace(ORIGIN, ''))));
    check(afterUpload.length === 0 && offOrigin.length === 0, `zero network requests after upload (${afterUpload.length} made: ${afterUpload.map((r) => r.method + ' ' + r.url).join(', ') || 'none'})`);
    // The only other request allowed is the page-view beacon, sent once at load: no hash, no file names or data.
    GC.checkBeacons(gc, check, { forbid: GC.fixtureNames(FX), expect: { p: '/dating/?ref=tiktok', q: '?ref=tiktok' } });
    check(gc.hits.length === gcAtLoad, 'no page-view beacon after upload (' + (gc.hits.length - gcAtLoad) + ')');
    const blocked = await page.evaluate(() => fetch('https://example.com/x', { method: 'POST', body: 'test' }).then(() => false, () => true));
    check(blocked, 'CSP blocks fetch to a third-party origin');

    // Kit signup sends only the email (export still loaded).
    const kit = [];
    await ctx.unroute('**/*');
    await page.route(/convertkit\.com|kit\.com/, async (route) => {
      kit.push({ url: route.request().url(), body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"subscription":{"id":1}}' });
    });
    await upload(page, 'tinder-export.zip');
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /on the list|didn't go through/.test(document.querySelector('#notify').textContent));
    const body = kit[0] ? JSON.parse(kit[0].body) : {};
    check(kit.length === 1 && /\/v3\/tags\/25914072\/subscribe$/.test(kit[0].url), 'Kit called once with the 25914072 placeholder');
    check(JSON.stringify(Object.keys(body).sort()) === '["api_key","email"]' && !/CANARY|swipe|match/i.test(kit[0].body), 'Kit body has only api_key + email (no dating data)');

    await page.click('#reset');
    await page.click('#sample');
    await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length >= 8);
    check(/made-up sample/.test(await page.textContent('#status')) && (await cardInfo(page)).length === 9, 'sample deck renders 9 cards and says it is made up');
    const realErrs = errs.filter((e) => !/example\.com\/x/.test(e));
    check(realErrs.length === 0, `no page errors (${realErrs.join(' | ') || 'none'})`);
    await ctx.close();
  }

  {
    console.log('\n== January 2027 ==');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'America/New_York' });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2027-01-05T12:00:00') });
    await page.goto(ORIGIN + '/dating/');
    await upload(page, 'data.json');
    check((await page.inputValue('#year')) === '2026', 'falls back to 2026 when 2027 has nothing yet');
    await page.selectOption('#year', '2027');
    await page.waitForFunction(() => !document.querySelector('#empty').hidden);
    check((await page.$$('#deck canvas')).length === 0 && /No activity in 2027/.test(await page.textContent('#empty')), 'empty year shows a message, no cards');
    await ctx.close();
  }

  // Export every card (safe + full) for visual review.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/New_York' });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await page.goto(ORIGIN + '/dating/');
  for (const [fx, tag] of [['tinder-export.zip', 'tinder'], ['hinge-export.zip', 'hingejson'], ['hinge-csv-export.zip', 'hingecsv']]) {
    await page.click('#reset').catch(() => {});
    await upload(page, fx);
    for (const safe of [true, false]) {
      if ((await page.isChecked('#safe')) !== safe) await page.click('#safe');
      const urls = await page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => c.toDataURL('image/png')));
      urls.forEach((u, i) => fs.writeFileSync(path.join(OUT, `card-${tag}-${safe ? 'safe' : 'full'}-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
    }
  }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
