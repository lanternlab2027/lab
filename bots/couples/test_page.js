// Playwright end-to-end test for docs/couples/ (Couples Chat Wrapped).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/couples/test_page.js <screenshot dir>
// Uses only synthetic fixtures. Kit is routed to a local stub; the real API is never hit.
const { chromium } = require('playwright');
const GC = require('../analytics/test_helper.js'); // page-view counter stub + beacon checks
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../../docs');
const FX = path.join(__dirname, 'fixtures');
const WFX = path.join(__dirname, '../wrapped/fixtures');
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8771, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.md': 'text/plain' };
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
    return { w: c.width, h: c.height, spread: max - min, hash: sum, label: c.getAttribute('aria-label') };
  }));
}
async function upload(page, file, dir) {
  await page.evaluate(() => { document.querySelector('#deck').innerHTML = ''; });
  await page.setInputFiles('#file', path.join(dir || FX, file));
  await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0 || !document.querySelector('#group-msg').hidden || document.querySelector('#status').classList.contains('err'), null, { timeout: 30000 });
  return cardInfo(page);
}
const dump = async (page, prefix) => {
  const urls = await page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => c.toDataURL('image/png')));
  urls.forEach((u, i) => fs.writeFileSync(path.join(OUT, `${prefix}-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
};

(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px ==`);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    const all = [], offOrigin = [];
    await ctx.route('**/*', (route) => {
      const r = route.request();
      all.push({ url: r.url(), method: r.method() });
      if (!r.url().startsWith(ORIGIN + '/')) { offOrigin.push(r.url()); return route.abort(); }
      return route.continue();
    });
    const gc = await GC.stubCounter(ctx); // GoatCounter -> local 204; checked after the uploads

    await page.goto(ORIGIN + '/couples/?ref=tiktok');
    await page.waitForLoadState('networkidle');
    check(offOrigin.length === 0, `page load makes no off-origin requests (${offOrigin.join(', ') || 'none'})`);
    check(/never leaves your device/.test(await page.textContent('#privacy-badge')), 'privacy promise visible');
    const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    check(/connect-src https:\/\/api\.convertkit\.com https:\/\/lanternlab\.goatcounter\.com;/.test(csp) && /script-src 'self'/.test(csp), 'CSP restricts scripts to self and connections to Kit and the page-view counter only');
    check(/couples chat wrapped/i.test(await page.title()) && /our year in texts/i.test(await page.title()), 'SEO title');
    const desc = await page.getAttribute('meta[name="description"]', 'content');
    check(/WhatsApp chat stats for couples/.test(desc) && /our year in texts/i.test(desc), 'meta description has the target phrases');
    check(await page.locator('footer a[href="../"]').count() === 1 && await page.locator('footer a[href="../apps/"]').count() === 1, 'footer links to ../ and ../apps/');
    check(await page.locator('a[href="../guides/how-to-export-whatsapp-chat.html"]').count() >= 1 && await page.locator('a[href="../guides/how-to-export-telegram-chat-history.html"]').count() >= 1, 'links to export guides');
    check(/ref=share-tiktok/.test(await page.textContent('#pass-text')), '?ref passthrough in the share text');
    check(/\?ref=tiktok$/.test(await page.getAttribute('footer a[href*="wrapped"]', 'href')), 'link to Group Chat Wrapped keeps ?ref');
    check(await page.isVisible('#notify'), 'Kit box visible with the real tag');
    check(await page.evaluate(() => (document.querySelector('#preview, .peek img') || {}).naturalWidth > 0), 'preview image loads');
    const loadCount = all.length;
    const gcAtLoad = gc.hits.length;

    // Demo
    await page.click('#sample');
    await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0);
    let cards = await cardInfo(page);
    check(cards.length === 11, `demo -> ${cards.length} cards`);
    check(cards.every((c) => c.w === 1080 && c.h === 1920 && c.spread > 150), 'every demo card is 1080x1920 and not blank');
    check(await page.isChecked('input[name="names"][value="initials"]') && await page.isHidden('#nick-a'), 'initials are the default; nickname fields hidden');
    const st0 = await page.evaluate(() => window.__couplesState.cards.map((c) => c.label));
    check(st0.includes('Busiest day') && st0.includes('I love yous') && st0.includes('Us, in texts'), 'labels include busiest day, I love yous, summary');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal page scroll');
    await page.screenshot({ path: path.join(OUT, `page-${width}-demo.png`), fullPage: width === 1280 });
    if (width === 390) await page.locator('#deck').screenshot({ path: path.join(OUT, `deck-${width}.png`) });

    // Name modes
    const h0 = cards[0].hash;
    await page.check('input[name="names"][value="first"]');
    const h1 = (await cardInfo(page))[0].hash;
    check(h1 !== h0, 'first names re-render the cards');
    await page.check('input[name="names"][value="nick"]');
    check(await page.isVisible('#nick-a'), 'nickname fields appear');
    await page.fill('#nick-a', 'Bean'); await page.fill('#nick-b', 'Sunshine');
    await page.waitForTimeout(500);
    const h2 = (await cardInfo(page))[0].hash;
    check(h2 !== h0 && h2 !== h1, 'nicknames re-render the cards');
    if (width === 390) await dump(page, 'card-nick');
    await page.check('input[name="names"][value="initials"]');

    // Save one PNG + zip
    const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('#deck figure:first-child button:has-text("Save PNG")')]);
    check(/\.png$/.test(dl1.suggestedFilename()) && fs.statSync(await dl1.path()).size > 50000, `Save PNG -> ${dl1.suggestedFilename()}`);
    const [dlz] = await Promise.all([page.waitForEvent('download'), page.click('#zip-all')]);
    check(/\.zip$/.test(dlz.suggestedFilename()) && fs.statSync(await dlz.path()).size > 200000, `zip -> ${dlz.suggestedFilename()}`);

    // Upload: iOS zip, Spanish Android, Telegram
    cards = await upload(page, 'WhatsApp Chat - Rowan Diaz.zip');
    check(cards.length === 11, `iOS .zip upload -> ${cards.length} cards`);
    cards = await upload(page, 'android_es_1to1.txt');
    check(cards.length >= 8 && cards.every((c) => c.spread > 150), `Spanish Android upload -> ${cards.length} cards`);
    if (width === 1280) await dump(page, 'card-es');
    cards = await upload(page, 'telegram_personal.json');
    check(cards.length >= 8, `Telegram personal chat -> ${cards.length} cards`);
    await page.screenshot({ path: path.join(OUT, `page-${width}-upload.png`) });
    cards = await upload(page, 'ios_1to1_us.txt', WFX);
    check(cards.length >= 6, `wrapped iOS 1:1 fixture -> ${cards.length} cards`);

    // Group chat -> friendly explanation + link to Group Chat Wrapped
    await upload(page, 'WhatsApp Chat with Weekend Crew.txt', WFX);
    check(await page.isVisible('#group-msg') && await page.isHidden('#results'), 'group chat shows the 1:1 notice and no deck');
    check(await page.locator('#group-msg a[href^="../wrapped/"]').count() === 1, 'group notice links to Group Chat Wrapped');
    check((await page.textContent('#group-count')) === '6', 'group notice counts 6 people');
    await page.locator('#group-msg').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `page-${width}-group.png`) });
    await page.setInputFiles('#file', path.join(FX, '..', 'make_fixtures.js'));
    await page.waitForFunction(() => document.querySelector('#status').classList.contains('err'));
    check(true, 'non-chat file shows an error');

    const afterUpload = all.slice(loadCount);
    const bad = afterUpload.filter((r) => !(r.method === 'GET' && r.url.startsWith(ORIGIN + '/')));
    check(bad.length === 0 && offOrigin.length === 0, `no requests carrying chat data after upload (${afterUpload.length} after load, ${bad.length} non-static)`);
    // The only other request allowed is the page-view beacon, sent once at load: no hash, no file names or data.
    GC.checkBeacons(gc, check, { forbid: GC.fixtureNames(FX), expect: { p: '/couples/?ref=tiktok', q: '?ref=tiktok' } });
    check(gc.hits.length === gcAtLoad, 'no page-view beacon after upload (' + (gc.hits.length - gcAtLoad) + ')');
    const blocked = await page.evaluate(() => fetch('https://example.com/x', { method: 'POST', body: 'test' }).then(() => false, () => true));
    check(blocked, 'CSP blocks fetch to a third-party origin');
    const realErrs = errs.filter((e) => !/example\.com\/x/.test(e));
    check(realErrs.length === 0, `no page errors (${realErrs.join(' | ') || 'none'})`);
    await ctx.close();
  }

  // Kit with a test tag: only api_key + email are sent.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    await ctx.addInitScript(() => { window.COUPLES_KIT_TAG_TEST = '12345'; });
    const page = await ctx.newPage();
    const kit = [];
    await page.route(/convertkit\.com/, async (route) => {
      kit.push({ url: route.request().url(), body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"subscription":{"id":1}}' });
    });
    await page.goto(ORIGIN + '/couples/');
    check(await page.isVisible('#notify'), 'Kit box shows once a numeric tag is set');
    await page.click('#sample');
    await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0);
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /You're in|didn't go through/.test(document.querySelector('#notify').textContent));
    const body = kit[0] ? JSON.parse(kit[0].body) : {};
    check(kit.length === 1 && /\/tags\/12345\/subscribe/.test(kit[0].url), 'Kit called once with the tag');
    check(JSON.stringify(Object.keys(body).sort()) === '["api_key","email"]' && !/Jamie|Rowan|dinner/.test(kit[0].body), 'Kit body has only api_key + email');
    await ctx.close();
  }

  // Full demo deck for visual review.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(ORIGIN + '/couples/');
    await page.click('#sample');
    await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0);
    await dump(page, 'card-demo');
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
