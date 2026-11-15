// Playwright end-to-end test for docs/amazon/ (Year in Orders).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/amazon/test_page.js <screenshot dir>
// Uses only synthetic fixtures (bots/amazon/make_fixtures.js). Kit is routed to a local stub; the real API is never hit.
const { chromium } = require('playwright');
const JSZip = require(require('path').resolve(__dirname, '../../docs/amazon/vendor/jszip-3.10.1.min.js'));
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
const NAMES = /coffee|Standing desk|dog food|Paper towels|Monitor arm/i;
const TMP = fs.mkdtempSync(path.join(OUT, 'tmp-'));

async function cardInfo(page) {
  return page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let min = 765, max = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4 * 997) { const v = d[i] + d[i + 1] + d[i + 2]; min = Math.min(min, v); max = Math.max(max, v); sum = (sum * 31 + v) >>> 0; }
    return { w: c.width, h: c.height, spread: max - min, hash: sum, label: c.getAttribute('aria-label') };
  }));
}
async function upload(page, files) {
  await page.evaluate(() => { document.querySelector('#deck').innerHTML = ''; });
  await page.setInputFiles('#file', [].concat(files).map((f) => path.isAbsolute(f) ? f : path.join(FX, f)));
  await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0 || !document.querySelector('#empty').hidden, null, { timeout: 30000 });
  return cardInfo(page);
}
async function expectError(page, file, re) {
  await page.setInputFiles('#file', path.join(FX, file));
  await page.waitForFunction(() => document.querySelector('#status').classList.contains('err'));
  return re.test(await page.textContent('#status'));
}
const labelsOf = (cards) => cards.map((c) => c.label.replace(/^Card \d+: /, ''));
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

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

    await page.goto(ORIGIN + '/amazon/?ref=tiktok');
    await page.waitForLoadState('networkidle');
    check(offOrigin.length === 0, `page load makes no off-origin requests (${offOrigin.join(', ') || 'none'})`);
    check(/never leaves your device\./.test(await page.textContent('#privacy-badge')), 'privacy promise visible');
    check(/for your Amazon data/.test(await page.textContent('header')) && /Year in/.test(await page.textContent('h1')), 'named "Year in Orders, for your Amazon data"');
    check(/Not affiliated with Amazon/.test(await page.textContent('footer')), 'footer: not affiliated with Amazon');
    check(await page.locator('footer a[href="../"]').count() === 1 && await page.locator('footer a[href="../apps/"]').count() === 1, 'footer links to ../ and ../apps/');
    check(/Make yours/.test(await page.textContent('footer')), 'footer has "Make yours"');
    const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    check(/default-src 'none'/.test(csp) && /script-src 'self';/.test(csp) && /connect-src https:\/\/api\.convertkit\.com;/.test(csp), 'CSP: scripts self-only, connections to Kit only');
    const title = await page.title(), desc = await page.getAttribute('meta[name="description"]', 'content');
    check(/how much have i spent on amazon/i.test(title) && /amazon order history spending/i.test(desc), 'SEO title/description target the two phrases');
    check(/og\.png$/.test(await page.getAttribute('meta[property="og:image"]', 'content')), 'OG image set');
    const og = await new Promise((res) => http.get(ORIGIN + '/amazon/og.png', (r) => { res(r.statusCode === 200 && r.headers['content-type'] === 'image/png'); r.resume(); }));
    check(og, 'og.png is served');
    const exp = await page.innerHTML('#export');
    check(/nodeId=TP1zlemejtTn6pwYKS/.test(exp) && /days/.test(exp) && /Your Orders/.test(exp), 'request-your-data guide cites Amazon help and says it can take days');
    check(/\?ref=share-tiktok$/.test(await page.textContent('#pass-text')), '?ref passthrough: shared link carries ref=share-tiktok');
    check(await page.isVisible('#signup'), 'Kit box visible with the real tag');
    check(await noHScroll(page), 'landing: no horizontal scroll');
    await page.screenshot({ path: path.join(OUT, `landing-${width}.png`), fullPage: width === 1280 });
    const loadCount = all.length;

    // Sample.
    await page.click('#sample');
    await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length >= 8);
    check(/made-up sample/.test(await page.textContent('#status')), 'sample renders and says it is made up');
    await page.screenshot({ path: path.join(OUT, `sample-${width}.png`) });

    // Main upload: newer-layout zip.
    let cards = await upload(page, 'Your Orders.zip');
    let labels = labelsOf(cards);
    check(cards.length === 9, `Your Orders.zip -> ${cards.length} cards (${labels.join(', ')})`);
    ['Total spent', 'Biggest order', 'Busiest month', 'Top categories', 'Most re-ordered', 'Late-night orders', 'Average order'].forEach((l) => check(labels.includes(l), `has card: ${l}`));
    check(cards.every((c) => c.w === 1080 && c.h === 1920 && c.spread > 200), 'every card is 1080x1920 with content');
    check((await page.inputValue('#year')) === '2026', 'year defaults to 2026');
    const inc = await page.textContent('#included');
    check(/refunded on \d+ orders/.test(inc) && /digital/.test(inc) && /cancelled/.test(inc), `"what's included" note: ${inc.slice(0, 120)}...`);
    check(!NAMES.test(await page.innerHTML('#deck')), 'no product names in card captions or aria labels');
    check(!(await page.isChecked('#names')), 'item names on cards are off by default');
    const h0 = cards.map((c) => c.hash);
    await page.check('#names');
    await page.waitForTimeout(200);
    let c2 = await cardInfo(page);
    const changed = c2.map((c, i) => c.hash !== h0[i]);
    check(changed[labels.indexOf('Biggest order')] && changed[labels.indexOf('Most re-ordered')] && !changed[labels.indexOf('Busiest month')], 'opt-in redraws only the cards that show names');
    await page.uncheck('#names');
    await page.selectOption('#year', '2025');
    c2 = await cardInfo(page);
    check(c2.length >= 7 && c2[0].hash !== h0[0], `2025 re-renders (${c2.length} cards)`);
    await page.selectOption('#year', 'all');
    c2 = await cardInfo(page);
    check(c2.length >= 8 && c2.every((c) => c.spread > 200), `all time renders (${c2.length} cards)`);
    await page.selectOption('#year', '2026');
    await page.uncheck('#digital');
    await page.waitForTimeout(150);
    check(!/digital purchases? included/.test(await page.textContent('#included')), 'unticking digital removes digital orders');
    await page.check('#digital');
    await page.fill('#name-input', 'Sam');
    await page.waitForTimeout(450);
    check((await cardInfo(page))[0].hash !== h0[0], 'name on cards re-renders');
    check(await noHScroll(page), 'results: no horizontal scroll');
    await page.locator('#results').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `deck-${width}.png`), fullPage: width === 1280 });

    const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('#deck figure:first-child button:has-text("Save PNG")')]);
    check(/^year-in-orders-2026-01-.*\.png$/.test(dl1.suggestedFilename()) && fs.statSync(await dl1.path()).size > 50000, `Save PNG -> ${dl1.suggestedFilename()}`);
    const [dlz] = await Promise.all([page.waitForEvent('download'), page.click('#zip-all')]);
    const z = await JSZip.loadAsync(fs.readFileSync(await dlz.path()));
    check(Object.keys(z.files).length === 9, `zip has ${Object.keys(z.files).length} PNGs`);

    // Tax tab.
    await page.click('#tab-tax');
    check(await page.isVisible('#panel-tax') && await page.isHidden('#panel-recap'), 'tax tab switches panels');
    check(/Not tax advice/.test(await page.textContent('#panel-tax')) && /Keep the receipts/.test(await page.textContent('#panel-tax')), 'tax disclaimers: not tax advice, keep the receipts');
    check((await page.inputValue('#from')) === '2026-01-01' && (await page.inputValue('#to')) === '2026-12-31', 'date range follows the year');
    const nRows = await page.locator('#items tbody tr').count();
    check(nRows > 100, `table lists every 2026 item (${nRows} rows)`);
    await page.fill('#q', 'cable');
    await page.waitForTimeout(300);
    const cableRows = await page.locator('#items tbody tr').count();
    check(cableRows > 0 && cableRows < nRows, `search filters rows (${cableRows} cable rows)`);
    await page.click('#tag-shown');
    await page.fill('#q', 'printer paper');
    await page.waitForTimeout(300);
    await page.locator('#items tbody tr').first().locator('input[type=checkbox]').check();
    await page.fill('#q', '');
    await page.selectOption('#show', 'biz');
    await page.waitForTimeout(200);
    const bizRows = await page.locator('#items tbody tr').count();
    check(bizRows === cableRows + 1, `"Business only" shows the ${bizRows} tagged rows`);
    const totals = await page.textContent('#totals');
    check(/Business\(shown\)\$\d/.test(totals.replace(/\s+/g, '')), `totals show a business sum (${totals.replace(/\s+/g, ' ').trim()})`);
    if (width === 390) await page.locator('#panel-tax').screenshot({ path: path.join(OUT, `tax-${width}.png`) });
    else await page.screenshot({ path: path.join(OUT, `tax-${width}.png`), fullPage: false });
    const [dlc] = await Promise.all([page.waitForEvent('download'), page.click('#export-biz')]);
    const csv = fs.readFileSync(await dlc.path(), 'utf8').replace(/^\ufeff/, '').trim().split(/\r?\n/);
    check(/^amazon-business-purchases-2026-01-01-to-2026-12-31\.csv$/.test(dlc.suggestedFilename()), `business CSV name ${dlc.suggestedFilename()}`);
    check(csv[0] === 'Date,Order ID,Item,ASIN,Quantity,Total,Currency,Business,Refund on this order,Type', 'CSV header');
    const body = csv.slice(1, -2);
    check(body.length === bizRows && body.every((l) => /,yes,(yes|no),(physical|digital)$/.test(l)), `CSV has ${body.length} business rows`);
    const tot = body.reduce((a, l) => a + parseFloat(l.split(',').slice(-5)[0]), 0);
    check(Math.abs(parseFloat(csv[csv.length - 2].split(',')[5]) - tot) < 0.01 && /Not tax advice/.test(csv[csv.length - 1]), 'CSV ends with a TOTAL row and the not-tax-advice line');
    check(!/Sample Street|Visa|TBA0/.test(csv.join('\n')), 'CSV has no address, payment or tracking data');
    await page.selectOption('#show', 'all');

    // Remember tags: off by default; when on, only order numbers + product IDs are stored.
    check((await page.evaluate(() => localStorage.getItem('yio-tags'))) === null, 'nothing in localStorage before opting in');
    await page.check('#remember');
    const stored = await page.evaluate(() => localStorage.getItem('yio-tags'));
    check(stored && JSON.parse(stored).length === bizRows && !NAMES.test(stored) && !/cable|paper|\$/i.test(stored), `remembered tags hold only IDs (${stored && stored.slice(0, 60)}...)`);
    await page.reload();
    await upload(page, 'Your Orders.zip');
    await page.click('#tab-tax'); await page.selectOption('#show', 'biz'); await page.waitForTimeout(200);
    check((await page.locator('#items tbody tr').count()) === bizRows && await page.isChecked('#remember'), 'tags come back after a reload when remembered');
    await page.uncheck('#remember');
    check((await page.evaluate(() => localStorage.getItem('yio-tags'))) === null, 'unticking remember clears storage');
    await page.selectOption('#show', 'all');
    await page.click('#tab-recap');

    // Other layouts and file mixes.
    cards = await upload(page, 'classic-export.zip');
    labels = labelsOf(cards);
    check(cards.length === 8 && !labels.includes('Top categories'), `classic zip -> ${cards.length} cards, no categories card (no department column)`);
    check(/no department column/.test(await page.textContent('#included')), 'note says why there is no categories card');
    cards = await upload(page, ['Order History.csv', 'Refund Details.csv']);
    check(cards.length === 9 && /refunded/.test(await page.textContent('#included')), 'two loose CSVs (orders + refunds) work together');
    cards = await upload(page, 'Retail.OrderHistory.1.csv');
    check(cards.length === 8 && /no refund file/.test(await page.textContent('#included')), 'orders CSV alone: says refunds are not taken off');
    cards = await upload(page, 'two-marketplaces.zip');
    check(!(await page.isHidden('#currency-wrap')) && (await page.inputValue('#currency')) === 'USD' && /CAD not included/.test(await page.textContent('#included')), 'two marketplaces: currency picker, USD first, CAD noted');
    const hu = (await cardInfo(page))[0].hash;
    await page.selectOption('#currency', 'CAD');
    await page.waitForTimeout(150);
    check((await cardInfo(page))[0].hash !== hu, 'switching to CAD re-renders');
    for (const [f, min] of [['aliases_reordered.csv', 4], ['eu_amounts.csv', 4], ['old_order_report.csv', 3]]) {
      cards = await upload(page, f);
      check(cards.length >= min && cards.every((c) => c.spread > 200), `${f} -> ${cards.length} cards`);
    }
    // Spreadsheet formula guard in the CSV export.
    const evil = path.join(TMP, 'formula.csv');
    fs.writeFileSync(evil, 'Order ID,Order Date,Product Name,Quantity,Total Owed\n114-1,2026-06-01T12:00:00Z,"=HYPERLINK(""http://x"")",1,5.00\n');
    await upload(page, evil);
    await page.click('#tab-tax');
    const [dle] = await Promise.all([page.waitForEvent('download'), page.click('#export-all')]);
    check(/,"'=HYPERLINK/.test(fs.readFileSync(await dle.path(), 'utf8')), 'CSV export neutralises formulas');
    await page.click('#tab-recap');
    check(await expectError(page, 'not_amazon.csv', /doesn.t look like an Amazon order history/), 'non-Amazon CSV shows a clear error');
    check(await expectError(page, 'empty_orders.csv', /no orders we could read/), 'empty order file shows a clear error');

    // Privacy: after page load, nothing went over the network; CSP blocks exfiltration.
    // The static "More free apps" strip (../apps/more.js, more.css, lazy thumbnails) may load after upload; it sends no data.
    const after = all.slice(loadCount).filter((r) => !/\/amazon\/(\?|$|index\.html|[a-z]+\.js|vendor\/|og\.png)/.test(r.url.replace(ORIGIN, '')) && !(r.method === 'GET' && /^\/apps\/(more\.(js|css)|img\/[a-z-]+\.jpg)$/.test(r.url.replace(ORIGIN, ''))));
    check(after.length === 0 && offOrigin.length === 0, `zero network requests from uploads (${after.map((r) => r.method + ' ' + r.url).join(', ') || 'none'})`);
    const blocked = await page.evaluate(() => fetch('https://example.com/x', { method: 'POST', body: 'test' }).then(() => false, () => true));
    check(blocked, 'CSP blocks fetch to a third-party origin');
    const realErrs = errs.filter((e) => !/example\.com\/x/.test(e));
    check(realErrs.length === 0, `no page errors (${realErrs.join(' | ') || 'none'})`);
    await ctx.close();
  }

  // Kit: with a numeric tag injected for the test, the box shows and sends only api_key + email.
  {
    console.log('\n== Kit (test tag) ==');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.AMAZON_KIT_TAG_TEST = '424242'; });
    const kit = [];
    await page.route(/convertkit\.com|kit\.com/, async (route) => {
      kit.push({ url: route.request().url(), body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"subscription":{"id":1}}' });
    });
    await page.goto(ORIGIN + '/amazon/');
    await upload(page, 'Your Orders.zip');
    check(await page.isVisible('#signup'), 'signup box visible with a numeric tag');
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /You're in|didn't go through/.test(document.querySelector('#signup').textContent));
    const body = kit[0] ? JSON.parse(kit[0].body) : {};
    check(kit.length === 1 && /\/v3\/tags\/424242\/subscribe$/.test(kit[0].url), 'Kit called once on the tag URL');
    check(JSON.stringify(Object.keys(body).sort()) === '["api_key","email"]' && !NAMES.test(kit[0].body), 'Kit body has only api_key + email');
    await ctx.close();
  }

  // January 2027: falls back to the latest year with orders.
  {
    console.log('\n== January 2027 ==');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'America/New_York' });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2027-01-05T12:00:00') });
    await page.goto(ORIGIN + '/amazon/');
    await upload(page, 'Your Orders.zip');
    check((await page.inputValue('#year')) === '2026' && /No orders in 2027 yet/.test(await page.textContent('#status')), 'falls back to 2026 and says so');
    await page.selectOption('#year', '2027');
    await page.waitForFunction(() => !document.querySelector('#empty').hidden);
    check((await page.$$('#deck canvas')).length === 0, 'empty year: message, no cards');
    await ctx.close();
  }

  // Export every card for visual review.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/New_York' });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await page.goto(ORIGIN + '/amazon/');
  for (const [fx, tag, names] of [['Your Orders.zip', 'new', false], ['Your Orders.zip', 'new-names', true], ['classic-export.zip', 'classic', false]]) {
    if (!names) await upload(page, fx);
    if (names) { await page.check('#names'); await page.waitForTimeout(200); } else if (await page.isChecked('#names')) await page.uncheck('#names');
    const urls = await page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => c.toDataURL('image/png')));
    urls.forEach((u, i) => fs.writeFileSync(path.join(OUT, `card-${tag}-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
