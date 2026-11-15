// Playwright end-to-end test for docs/tiktok/ (TikTok Wrapped / Scroll Wrapped).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/tiktok/test_page.js <screenshot dir>
// Uses only synthetic fixtures. Kit is routed to a local stub; the real API is never hit.
const { chromium } = require('playwright');
const JSZip = require(require('path').resolve(__dirname, '../../docs/tiktok/vendor/jszip-3.10.1.min.js'));
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../../docs');
const FX = path.join(__dirname, 'fixtures');
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const CANARY = 'SECRET-DM-CANARY-7731';
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

async function upload(page, file) {
  await page.evaluate(() => { document.querySelector('#deck').innerHTML = ''; document.querySelector('#file').value = ''; });
  await page.setInputFiles('#file', [].concat(file).map((f) => path.join(FX, f)));
  await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0, null, { timeout: 60000 });
  return cardInfo(page);
}

async function expectError(page, file, re) {
  await page.evaluate(() => { document.querySelector('#status').className = 'status'; });
  await page.setInputFiles('#file', path.join(FX, file));
  await page.waitForFunction(() => document.querySelector('#status').classList.contains('err'));
  return re.test(await page.textContent('#status'));
}

const ALL = ['Videos watched', 'Time estimate', 'Busiest day', 'Scroll clock', 'Peak month', 'Doomscroll session', 'Longest streak', 'Likes', 'Top searches', 'Your year in the feed'];

(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px ==`);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, timezoneId: 'America/New_York' });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2026-11-15T12:00:00') });
    const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

    const all = [], offOrigin = [];
    await ctx.route('**/*', (route) => {
      const r = route.request();
      all.push({ url: r.url(), method: r.method() });
      if (!r.url().startsWith(ORIGIN + '/')) { offOrigin.push(r.url()); return route.abort(); }
      return route.continue();
    });

    await page.goto(ORIGIN + '/tiktok/?ref=tiktok');
    await page.waitForLoadState('networkidle');
    check(offOrigin.length === 0, `page load makes no off-origin requests (${offOrigin.join(', ') || 'none'})`);
    check(/never leaves your device/.test(await page.textContent('#privacy-badge')), 'privacy promise visible');
    check(/Not affiliated with TikTok or ByteDance/.test(await page.textContent('footer')), 'footer disclaimer: not affiliated with TikTok or ByteDance');
    check(await page.locator('footer a[href="../"]').count() === 1 && await page.locator('footer a[href="../apps/"]').count() === 1, 'footer links to ../ and ../apps/');
    const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    check(/default-src 'none'/.test(csp) && /script-src 'self'/.test(csp) && /connect-src https:\/\/api\.convertkit\.com;/.test(csp), 'CSP: scripts self-only, connections to Kit only');
    const title = await page.title(), desc = await page.getAttribute('meta[name="description"]', 'content');
    check(/TikTok Wrapped 2026/.test(title) && /TikTok Wrapped 2026/.test(desc), 'SEO title/description target "TikTok Wrapped 2026"');
    check(/og\.(png|jpg)$/.test(await page.getAttribute('meta[property="og:image"]', 'content')), 'OG image set');
    const reqBox = await page.locator('#request').boundingBox(), dropBox = await page.locator('#drop').boundingBox();
    check(reqBox && dropBox && reqBox.y < dropBox.y && /1.4 days/.test(await page.textContent('#request-h')), 'request-your-export guide (1-4 days) sits above the upload');
    check((await page.$$('#request ol li')).length >= 6 && /support\.tiktok\.com/.test(await page.innerHTML('#request')), 'request guide has steps and cites TikTok support');
    check(/Direct messages are skipped entirely/.test(await page.textContent('#dm-note')), 'privacy note says DMs are skipped');
    check(/\?ref=share-tiktok$/.test(await page.textContent('#pass-text')), '?ref passthrough: shared link carries ref=share-tiktok');
    check(await page.evaluate(() => document.querySelector('.peek img').naturalWidth > 0), 'preview image loads');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal page scroll (landing)');
    if (width === 390) await page.screenshot({ path: path.join(OUT, `landing-${width}.png`), fullPage: true });
    const loadCount = all.length;

    // Demo deck.
    await page.click('#sample');
    await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length >= 8);
    let cards = await cardInfo(page);
    check(cards.length === 10 && /made-up sample/.test(await page.textContent('#status')), `sample deck renders ${cards.length} cards and says it is made up`);
    await page.screenshot({ path: path.join(OUT, `demo-${width}.png`), fullPage: width === 1280 });

    // JSON upload.
    cards = await upload(page, 'user_data_tiktok.json');
    const labels = cards.map((c) => c.label);
    check(cards.length === 10, `JSON export -> ${cards.length} cards (${labels.join(', ')})`);
    ALL.forEach((l) => check(labels.includes(l), `has card: ${l}`));
    check(cards.every((c) => c.w === 1080 && c.h === 1920), 'every card is 1080x1920');
    check(cards.every((c) => c.spread > 200), 'every card has rendered content (not blank)');
    check((await page.inputValue('#year')) === '2026', 'year selector defaults to the current year (2026)');
    check((await page.inputValue('#tz')) === 'America/New_York', 'time zone defaults to the device zone');
    const opts = await page.$$eval('#year option', (o) => o.map((x) => x.value));
    check(JSON.stringify(opts) === '["2026","2025","all"]', `year options ${opts.join(',')}`);
    const stateDump = await page.evaluate(() => JSON.stringify(window.__tiktokState.parsed));
    const bodyText = await page.evaluate(() => document.body.innerText);
    check(!stateDump.includes(CANARY) && !bodyText.includes(CANARY), 'DM canary is in neither page state nor page text');
    check(!/so good/.test(stateDump) && !/192\.0\.2\./.test(stateDump), 'comment text and login IPs are not kept');
    const base = cards.map((c) => c.hash);
    const searchIdx = labels.indexOf('Top searches');
    await page.check('#show-terms');
    let c2 = await cardInfo(page);
    check(c2[searchIdx].hash !== base[searchIdx] && c2.filter((c, i) => c.hash !== base[i]).length === 1, 'show-search-terms opt-in changes only the searches card');
    await page.uncheck('#show-terms');
    await page.selectOption('#tz', 'Asia/Tokyo');
    c2 = await cardInfo(page);
    check(c2[3].hash !== base[3], 'changing time zone re-renders the scroll clock');
    await page.selectOption('#tz', 'America/New_York');
    await page.selectOption('#year', '2025');
    c2 = await cardInfo(page);
    check(c2.length >= 6 && c2[0].hash !== base[0], `2025 re-renders (${c2.length} cards)`);
    await page.selectOption('#year', 'all');
    c2 = await cardInfo(page);
    check(c2.length >= 8 && c2.every((c) => c.spread > 200), `all time renders (${c2.length} cards)`);
    await page.selectOption('#year', '2026');
    await page.fill('#name-input', 'Sam');
    await page.waitForTimeout(450);
    c2 = await cardInfo(page);
    check(c2[0].hash !== base[0], 'name on cards re-renders');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal page scroll (deck)');
    await page.screenshot({ path: path.join(OUT, `upload-${width}.png`), fullPage: width === 1280 });
    if (width === 390) await page.locator('#deck').screenshot({ path: path.join(OUT, `deck-${width}.png`) });
    await page.fill('#name-input', '');
    await page.waitForTimeout(450);

    const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('#deck figure:first-child button:has-text("Save PNG")')]);
    const p1 = await dl1.path();
    check(/^scroll-wrapped-2026-01-.*\.png$/.test(dl1.suggestedFilename()) && fs.statSync(p1).size > 50000, `Save PNG -> ${dl1.suggestedFilename()} (${fs.statSync(p1).size} bytes)`);
    const [dlz] = await Promise.all([page.waitForEvent('download'), page.click('#zip-all')]);
    const z = await JSZip.loadAsync(fs.readFileSync(await dlz.path()));
    check(Object.keys(z.files).length === cards.length, `zip has ${Object.keys(z.files).length} PNGs`);

    // Other export shapes give the identical deck.
    for (const f of ['tiktok_txt_export.zip', 'tiktok_json_export.zip', 'user_data_legacy.json']) {
      const cs = await upload(page, f);
      check(cs.length === cards.length && cs.every((c, i) => c.hash === base[i]), `${f} -> identical ${cs.length} cards`);
    }
    // The legacy TXT fixture has no comments/shares files, so only the likes and summary cards may differ.
    const lg = await upload(page, 'tiktok_txt_legacy.zip');
    check(lg.map((c) => c.label).join() === labels.join() && lg.filter((c, i) => c.hash !== base[i]).every((c) => /Likes|year in the feed/.test(c.label)), 'tiktok_txt_legacy.zip -> same cards (likes chips differ: no comments/shares in that fixture)');
    check(/Direct messages were skipped/.test(await page.textContent('#status')), 'status confirms DMs were skipped');
    for (const [f, min] of [['Watch History.txt', 7], ['watch_only.json', 5], ['tiny.json', 4], [['Watch History.txt', 'tiktok_txt_export.zip'], 10]]) {
      cards = await upload(page, f);
      check(cards.length >= min && cards.every((c) => c.spread > 200), `${[].concat(f).join(' + ')} -> ${cards.length} cards`);
    }
    check(await expectError(page, 'not_tiktok.json', /doesn.t look like a TikTok data export/), 'non-TikTok JSON shows a clear error');
    check(await expectError(page, 'empty_sections.json', /watch history is empty/), 'export with empty sections shows a clear error');

    // The static "More free apps" strip (../apps/more.js, more.css, lazy thumbnails) may load after upload; it sends no data.
    const afterUpload = all.slice(loadCount).filter((r) => !(r.method === 'GET' && /^\/apps\/(more\.(js|css)|img\/[a-z-]+\.jpg)$/.test(r.url.replace(ORIGIN, ''))));
    check(afterUpload.length === 0 && offOrigin.length === 0, `zero network requests after upload (${afterUpload.length} made: ${afterUpload.map((r) => r.method + ' ' + r.url).join(', ') || 'none'})`);
    const blocked = await page.evaluate(() => fetch('https://example.com/x', { method: 'POST', body: 'test' }).then(() => false, () => true));
    check(blocked, 'CSP blocks fetch to a third-party origin');

    // Kit reminder sends only the email.
    const kit = [];
    await ctx.unroute('**/*');
    await page.route(/convertkit\.com|kit\.com/, async (route) => {
      kit.push({ url: route.request().url(), body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"subscription":{"id":1}}' });
    });
    await upload(page, 'user_data_tiktok.json');
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /on the list|didn't go through/.test(document.querySelector('#notify').textContent));
    const body = kit[0] ? JSON.parse(kit[0].body) : {};
    check(kit.length === 1 && /\/v3\/tags\/25919883\/subscribe$/.test(kit[0].url), 'Kit called once with the real tag');
    check(JSON.stringify(Object.keys(body).sort()) === '["api_key","email"]' && typeof body.api_key === 'string' && body.api_key.length > 10 && !/sourdough|tiktokv|2026-/.test(kit[0].body), 'Kit body has only api_key + email (no export data)');
    const realErrs = errs.filter((e) => !/example\.com\/x/.test(e));
    check(realErrs.length === 0, `no page errors (${realErrs.join(' | ') || 'none'})`);
    await ctx.close();
  }

  {
    console.log('\n== January 2027 ==');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'America/New_York' });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2027-01-05T12:00:00') });
    await page.goto(ORIGIN + '/tiktok/');
    await upload(page, 'user_data_tiktok.json');
    check((await page.inputValue('#year')) === '2026', 'falls back to 2026 when 2027 has nothing yet');
    check(/Nothing watched in 2027 yet/.test(await page.textContent('#status')), 'status explains the fallback');
    await ctx.close();
  }

  // Export every card for visual review.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/New_York' });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-11-15T12:00:00') });
  await page.goto(ORIGIN + '/tiktok/');
  for (const [fx, tag, terms] of [['user_data_tiktok.json', 'main', false], [null, 'terms', true], ['tiny.json', 'tiny', false]]) {
    if (fx) await upload(page, fx);
    if (terms) await page.check('#show-terms'); else await page.uncheck('#show-terms');
    const urls = await page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => c.toDataURL('image/png')));
    urls.forEach((u, i) => fs.writeFileSync(path.join(OUT, `card-${tag}-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
  }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
