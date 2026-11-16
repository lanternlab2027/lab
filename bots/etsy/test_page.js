// Playwright end-to-end test for docs/etsy/ (Seller Year in Review).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/etsy/test_page.js <screenshot dir>
// Uses only synthetic fixtures (bots/etsy/make_fixtures.js). Kit is routed to a local stub; the real API is never hit.
const { chromium } = require('playwright');
const GC = require('../analytics/test_helper.js'); // page-view counter stub + beacon checks
const JSZip = require(require('path').resolve(__dirname, '../../docs/etsy/vendor/jszip-3.10.1.min.js'));
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../../docs');
const FX = path.join(__dirname, 'fixtures');
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8772, ORIGIN = 'http://127.0.0.1:' + PORT;
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
// Values from the fixtures that must never appear on the page: buyer names, addresses, usernames, coupons.
const PII = /Sentinelname|Zelda|Secretaddress|Hiddencity|94999|SECRETCOUPON|zelda_user|Sample Street|Exampleville|Apt 4|Avery Example|Glaze:Speckled|Demoford|Testwood/;
const STMTS = fs.readdirSync(FX).filter((n) => /^etsy_statement_2026_\d+\.csv$/.test(n));
const ALL2026 = ['EtsySoldOrders2026.csv', 'EtsySoldOrderItems2026.csv', 'EtsySoldOrders2025.csv', 'EtsySoldOrderItems2025.csv'].concat(STMTS);

async function cardInfo(page) {
  return page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let min = 765, max = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4 * 997) { const v = d[i] + d[i + 1] + d[i + 2]; min = Math.min(min, v); max = Math.max(max, v); sum = (sum * 31 + v) >>> 0; }
    return { w: c.width, h: c.height, spread: max - min, hash: sum, label: c.getAttribute('aria-label') };
  }));
}
async function upload(page, files, reset = true) {
  if (reset && await page.isVisible('#reset')) await page.click('#reset');
  await page.evaluate(() => { document.querySelector('#deck').innerHTML = ''; document.querySelector('#status').textContent = ''; document.querySelector('#empty').hidden = true; });
  await page.setInputFiles('#file', [].concat(files).map((f) => path.isAbsolute(f) ? f : path.join(FX, f)));
  await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0 || !document.querySelector('#empty').hidden || document.querySelector('#status').classList.contains('err'), null, { timeout: 30000 });
  return cardInfo(page);
}
const labelsOf = (cards) => cards.map((c) => c.label.replace(/^Card \d+: /, ''));
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const bodyText = (page) => page.evaluate(() => document.body.innerText + ' ' + document.body.innerHTML);

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

    await page.goto(ORIGIN + '/etsy/?ref=fbgroup');
    await page.waitForLoadState('networkidle');
    check(offOrigin.length === 0, `page load makes no off-origin requests (${offOrigin.join(', ') || 'none'})`);
    check(/never leaves your device/.test(await page.textContent('#privacy-badge')), 'privacy promise visible');
    check(/Year in Review for Etsy sellers/.test(await page.textContent('header')), 'named "Year in Review for Etsy sellers"');
    check(/Not affiliated with Etsy/.test(await page.textContent('footer')), 'footer: not affiliated with Etsy');
    check(await page.locator('footer a[href="../"]').count() === 1 && await page.locator('footer a[href="../apps/"]').count() === 1, 'footer links to ../ and ../apps/');
    check(/Make yours/.test(await page.textContent('footer')), 'footer has "Make yours"');
    check(await page.locator('#more-apps[data-from="etsy"]').count() === 1 && await page.locator('link[href="../apps/more.css"]').count() === 1, 'cross-promo strip included with data-from="etsy"');
    await page.waitForTimeout(300);
    check((await page.locator('#more-apps a').count()) >= 3, 'cross-promo strip renders links');
    const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    check(/default-src 'none'/.test(csp) && /script-src 'self';/.test(csp) && /connect-src https:\/\/api\.convertkit\.com https:\/\/lanternlab\.goatcounter\.com;/.test(csp), 'CSP: scripts self-only, connections to Kit and the page-view counter only');
    const title = await page.title(), desc = await page.getAttribute('meta[name="description"]', 'content');
    check(/etsy shop year in review/i.test(title) && /etsy sales report/i.test(title) && /etsy fees calculator for taxes/i.test(desc) && /etsy shop year in review/i.test(desc) && /etsy sales report/i.test(desc), 'SEO title/description carry the three phrases');
    check(/og\.png$/.test(await page.getAttribute('meta[property="og:image"]', 'content')), 'OG image set');
    const og = await new Promise((res) => http.get(ORIGIN + '/etsy/og.png', (r) => { res(r.statusCode === 200 && r.headers['content-type'] === 'image/png'); r.resume(); }));
    check(og, 'og.png is served');
    const dl = await page.innerHTML('#download');
    check(/360000343328/.test(dl) && /115015747228/.test(dl) && /Download Data/.test(dl) && /Monthly statements/.test(dl), 'download guide cites Etsy help pages and both paths');
    const irs = await page.innerHTML('#irs');
    check(/irs\.gov/.test(irs) && /\$20,000/.test(irs) && /200 transactions/.test(irs), '1099-K note cites irs.gov with $20,000 / 200');
    check(/\?ref=share-fbgroup$/.test(await page.textContent('#pass-text')), '?ref passthrough: shared link carries ref=share-fbgroup');
    check(await page.isVisible('#signup'), 'Kit box visible with the real tag');
    check(await noHScroll(page), 'landing: no horizontal scroll');
    await page.screenshot({ path: path.join(OUT, `landing-${width}.png`), fullPage: width === 1280 });
    const loadCount = all.length;
    const gcAtLoad = gc.hits.length;

    // Demo.
    await page.click('#sample');
    await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length >= 8);
    check(/made-up sample/.test(await page.textContent('#status')), 'sample renders and says it is made up');
    let cards = await cardInfo(page);
    check(cards.length === 9, `sample -> ${cards.length} cards (${labelsOf(cards).join(', ')})`);
    check(await noHScroll(page), 'sample: no horizontal scroll');
    await page.locator('#results').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `sample-${width}.png`) });
    await page.click('#tab-tax');
    check(/monthly statements/.test(await page.textContent('#tax-source')) && /matches the sum of the Net column/.test(await page.textContent('#tax-source')), 'sample tax tab uses statements and reconciles');
    await page.click('#tab-recap');

    // Upload: orders + items + 11 statements + last year.
    cards = await upload(page, ALL2026);
    const labels = labelsOf(cards);
    check(cards.length === 9, `upload -> ${cards.length} cards (${labels.join(', ')})`);
    ['Orders this year', 'Best seller', 'Busiest month', 'Busiest day', 'Where buyers are', 'Repeat buyers', 'Average order', 'Made by hand', 'Your year on a tag'].forEach((l) => check(labels.includes(l), `has card: ${l}`));
    check(cards.every((c) => c.w === 1080 && c.h === 1920 && c.spread > 200), 'every card is 1080x1920 with content');
    check((await page.inputValue('#year')) === '2026', 'year defaults to 2026');
    check(/Read 2 orders files, 2 order items files, 11 monthly statements/.test(await page.textContent('#status')), 'status says which files were read');
    const inc = await page.textContent('#included');
    check(/refunded on \d+ orders/.test(inc) && /before fees/.test(inc), `"what's counted" note: ${inc.slice(0, 110)}...`);
    check(!PII.test(await bodyText(page)), 'no buyer names, addresses, usernames or coupons anywhere on the page');
    check(!/\b(Riley|Jordan|Casey|Morgan) (Example|Sample|Placeholder)/.test(await bodyText(page)), 'no demo buyer names on the page');

    // Toggles: revenue off redraws money cards only; names off redraws best seller; card picker removes a card.
    const h0 = cards.map((c) => c.hash), L = (l) => labels.indexOf(l);
    await page.uncheck('#revenue'); await page.waitForTimeout(200);
    let c2 = await cardInfo(page);
    check(c2[L('Orders this year')].hash !== h0[L('Orders this year')] && c2[L('Busiest day')].hash === h0[L('Busiest day')] && labelsOf(c2).includes('Typical order'), 'hiding revenue redraws money cards only (average -> typical order)');
    await page.check('#revenue');
    await page.uncheck('#names'); await page.waitForTimeout(200);
    c2 = await cardInfo(page);
    check(c2[L('Best seller')].hash !== h0[L('Best seller')] && c2[L('Busiest month')].hash === h0[L('Busiest month')], 'hiding listing names redraws the best-seller card');
    await page.check('#names');
    await page.uncheck('#handmade'); await page.waitForTimeout(200);
    check(labelsOf(await cardInfo(page)).includes('Packed and shipped'), 'handmade toggle -> "Packed and shipped"');
    await page.check('#handmade');
    await page.uncheck('#picker input[data-card="repeat"]'); await page.waitForTimeout(200);
    c2 = await cardInfo(page);
    check(c2.length === 8 && !labelsOf(c2).includes('Repeat buyers') && /\/ 8|8 cards/.test(await page.textContent('#deck-count')), 'card picker hides a card');
    await page.check('#picker input[data-card="repeat"]'); await page.waitForTimeout(200);
    await page.fill('#name-input', 'Little Kiln');
    await page.waitForTimeout(450);
    check((await cardInfo(page))[0].hash !== h0[0], 'shop name re-renders');
    await page.selectOption('#year', '2025');
    c2 = await cardInfo(page);
    check(c2.length >= 8 && c2[0].hash !== h0[0], `2025 re-renders (${c2.length} cards)`);
    await page.selectOption('#year', 'all');
    c2 = await cardInfo(page);
    check(c2.length >= 8 && c2.every((c) => c.spread > 200), `all years renders (${c2.length} cards)`);
    await page.selectOption('#year', '2026');
    check(await noHScroll(page), 'results: no horizontal scroll');
    await page.locator('#results').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `deck-${width}.png`), fullPage: width === 1280 });

    const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('#deck figure:first-child button:has-text("Save PNG")')]);
    check(/^shop-year-in-review-2026-01-.*\.png$/.test(dl1.suggestedFilename()) && fs.statSync(await dl1.path()).size > 50000, `Save PNG -> ${dl1.suggestedFilename()}`);
    const [dlz] = await Promise.all([page.waitForEvent('download'), page.click('#zip-all')]);
    const z = await JSZip.loadAsync(fs.readFileSync(await dlz.path()));
    check(Object.keys(z.files).length === 9, `zip has ${Object.keys(z.files).length} PNGs`);

    // Tax tab.
    await page.click('#tab-tax');
    check(await page.isVisible('#panel-tax') && await page.isHidden('#panel-recap'), 'tax tab switches panels');
    const ptx = await page.textContent('#panel-tax');
    check(/Not tax advice/.test(ptx) && /accountant or tax preparer should confirm/.test(ptx), 'tax disclaimers: not tax advice, accountant should confirm');
    check(/11 months/.test(await page.textContent('#tax-source')) && /add any missing statements/.test(await page.textContent('#tax-source')), 'says 11 of 12 months covered');
    const tiles = (await page.textContent('#totals')).replace(/\s+/g, ' ');
    check(/Gross sales\s*\$[\d,]+/.test(tiles) && /Net\s*\$[\d,]+/.test(tiles) && /Shipping labels/.test(tiles) && /Ads/.test(tiles), `totals tiles (${tiles.trim().slice(0, 120)}...)`);
    const catsText = await page.textContent('#cats');
    ['Transaction fees', 'Payment processing fees', 'Listing fees', 'Offsite Ads fees', 'Etsy Ads', 'Shipping labels', 'Refunds to buyers'].forEach((c) => check(catsText.includes(c), `category row: ${c}`));
    check((await page.locator('#months tbody tr').count()) === 13, 'month table: 12 months + total');
    check(await noHScroll(page), 'tax tab: no horizontal page scroll (table scrolls inside its box)');
    if (width === 390) await page.locator('#panel-tax').screenshot({ path: path.join(OUT, `tax-${width}.png`) });
    else await page.screenshot({ path: path.join(OUT, `tax-${width}.png`), fullPage: true });
    const [dlc] = await Promise.all([page.waitForEvent('download'), page.click('#export-csv')]);
    const csv = fs.readFileSync(await dlc.path(), 'utf8').replace(/^\ufeff/, '').trim().split(/\r?\n/);
    check(dlc.suggestedFilename() === 'etsy-sales-fees-summary-2026.csv', `CSV name ${dlc.suggestedFilename()}`);
    check(/^Category \(USD\),2026-01,.*2026-12,Total$/.test(csv[0]), 'CSV header: category + 12 months + Total');
    const net = csv.find((l) => /^Net,/.test(l)).split(',');
    const monthsSum = net.slice(1, 13).reduce((a, v) => a + parseFloat(v), 0);
    check(Math.abs(monthsSum - parseFloat(net[13])) < 0.05, `CSV Net months add up to the total (${net[13]})`);
    check(/Not tax advice/.test(csv[csv.length - 1]) && !PII.test(csv.join('\n')), 'CSV ends with the not-tax-advice line; no buyer data');
    await page.click('#tab-recap');

    // Single-file cases.
    cards = await upload(page, 'EtsySoldOrders2026.csv');
    check(cards.length === 8 && !labelsOf(cards).includes('Best seller') && /no order items file/.test(await page.textContent('#included')), 'orders CSV alone: 8 cards, no best seller, says why');
    await page.click('#tab-tax');
    check(/no Etsy fees/.test(await page.textContent('#tax-source')) && (await page.locator('#months tbody tr').count()) === 13, 'orders-only tax tab: monthly sales, says fees need statements');
    await page.click('#tab-recap');
    cards = await upload(page, 'etsy_statement_2026_10.csv');
    check(cards.length === 0 && /Only statements so far/.test(await page.textContent('#empty')), 'statement alone: no cards, explains, tax tab works');
    cards = await upload(page, ['EtsySoldOrders2026.csv'], false);
    check(cards.length === 8 && /1 monthly statement/.test(await page.textContent('#status')), 'adding orders after a statement keeps both');
    cards = await upload(page, 'etsy-2026.zip');
    check(cards.length === 9 && /skipped|Read 1 orders file/.test(await page.textContent('#status')), 'zip of CSVs works (deposits file skipped unopened)');
    cards = await upload(page, ['statement_two_currencies.csv', 'orders_refunds.csv']);
    check(!(await page.isHidden('#currency-wrap')), 'two currencies: currency picker shows');
    await page.click('#tab-tax');
    check(/CAD are not included/.test(await page.textContent('#tax-source')), 'tax tab names the left-out currency');
    await page.selectOption('#currency', 'CAD');
    await page.waitForTimeout(150);
    check(/in CAD/.test(await page.textContent('#tax-source')), 'switching to CAD updates the tax summary');
    await page.click('#tab-recap');
    cards = await upload(page, ['EtsySoldOrders2020-uk.csv']);
    check((await page.inputValue('#year')) === '2020' && cards.length >= 4, `2020 UK file -> ${cards.length} cards, year 2020`);
    cards = await upload(page, 'items_aliases.csv');
    check(cards.length >= 4 && labelsOf(cards).includes('Best seller'), 'aliased order-items file alone works (orders rebuilt)');
    await page.click('#reset');
    await page.setInputFiles('#file', path.join(FX, 'not_etsy.csv'));
    await page.waitForFunction(() => document.querySelector('#status').classList.contains('err'));
    check(/doesn.t look like an Etsy/.test(await page.textContent('#status')), 'non-Etsy CSV shows a clear error');
    check(!PII.test(await bodyText(page)), 'still no buyer data on the page after all uploads');

    // Privacy: after page load, nothing went over the network; CSP blocks exfiltration.
    const after = all.slice(loadCount).filter((r) => !/\/etsy\/(\?|$|index\.html|[a-z]+\.js|vendor\/|og\.png)/.test(r.url.replace(ORIGIN, '')) && !(r.method === 'GET' && /^\/apps\/(more\.(js|css)|img\/[a-z0-9-]+\.(jpg|png|webp))$/.test(r.url.replace(ORIGIN, ''))));
    check(after.length === 0 && offOrigin.length === 0, `zero network requests from uploads (${after.map((r) => r.method + ' ' + r.url).join(', ') || 'none'})`);
    // The only other request allowed is the page-view beacon, sent once at load: no hash, no file names or data.
    GC.checkBeacons(gc, check, { forbid: GC.fixtureNames(FX), expect: { p: '/etsy/?ref=fbgroup', q: '?ref=fbgroup' } });
    check(gc.hits.length === gcAtLoad, 'no page-view beacon after upload (' + (gc.hits.length - gcAtLoad) + ')');
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
    await page.addInitScript(() => { window.ETSY_KIT_TAG_TEST = '424242'; });
    const kit = [];
    await page.route(/convertkit\.com|kit\.com/, async (route) => {
      kit.push({ url: route.request().url(), body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"subscription":{"id":1}}' });
    });
    await page.goto(ORIGIN + '/etsy/');
    await upload(page, ALL2026);
    check(await page.isVisible('#signup'), 'signup box visible with a numeric tag');
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /You're in|didn't go through/.test(document.querySelector('#signup').textContent));
    const body = kit[0] ? JSON.parse(kit[0].body) : {};
    check(kit.length === 1 && /\/v3\/tags\/424242\/subscribe$/.test(kit[0].url), 'Kit called once on the tag URL');
    check(JSON.stringify(Object.keys(body).sort()) === '["api_key","email"]' && !/mug|vase|\$/i.test(kit[0].body), 'Kit body has only api_key + email');
    await page.screenshot({ path: path.join(OUT, 'signup-390.png') });
    await ctx.close();
  }

  // January 2027: falls back to the latest year with orders.
  {
    console.log('\n== January 2027 ==');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'America/New_York' });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2027-01-05T12:00:00') });
    await page.goto(ORIGIN + '/etsy/');
    await upload(page, ALL2026);
    check((await page.inputValue('#year')) === '2026' && /Nothing from 2027 yet/.test(await page.textContent('#status')), 'falls back to 2026 and says so');
    await page.selectOption('#year', '2027');
    await page.waitForFunction(() => !document.querySelector('#empty').hidden);
    check((await page.$$('#deck canvas')).length === 0, 'empty year: message, no cards');
    await ctx.close();
  }

  // Export every card for visual review.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/New_York' });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await page.goto(ORIGIN + '/etsy/');
  await upload(page, ALL2026);
  await page.fill('#name-input', 'Little Kiln Studio'); await page.waitForTimeout(400);
  for (const tag of ['full', 'private']) {
    if (tag === 'private') { await page.uncheck('#revenue'); await page.uncheck('#names'); await page.waitForTimeout(300); }
    const urls = await page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => c.toDataURL('image/png')));
    urls.forEach((u, i) => fs.writeFileSync(path.join(OUT, `card-${tag}-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
  }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
