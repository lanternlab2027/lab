// Playwright end-to-end test for docs/weather/ (Weather Wrapped), at 390px and 1280px.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/weather/test_page.js <screenshot dir>
// The shell can't reach Open-Meteo, so archive-api.open-meteo.com and geocoding-api.open-meteo.com are routed to
// synthetic fixtures in the documented response format (bots/weather/fixtures.js); Kit is stubbed. Clocks are frozen.
'use strict';
const { chromium } = require('playwright');
const GC = require('../analytics/test_helper.js'); // page-view counter stub + beacon checks
const http = require('http'), fs = require('fs'), path = require('path');
const FX = require('./fixtures.js');

const ROOT = path.resolve(__dirname, '../../docs');
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8797, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p.replace(/^\/lab/, ''));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(b);
  });
}).listen(PORT);

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

const NOV = '2026-11-16T15:00:00-05:00', JAN = '2027-01-02T10:00:00-05:00';
const GEO = {
  '14201': [{ name: 'Buffalo', latitude: 42.88645, longitude: -78.87837, country_code: 'US', country: 'United States', admin1: 'New York', postcodes: ['14201'] }],
  Phoenix: [{ name: 'Phoenix', latitude: 33.44838, longitude: -112.07404, country_code: 'US', country: 'United States', admin1: 'Arizona', population: 1608139 }],
  London: [{ name: 'London', latitude: 51.50853, longitude: -0.12574, country_code: 'GB', country: 'United Kingdom', admin1: 'England', population: 7556900 }],
};
function cityFor(lat, lon) {
  let best = null, bd = 1e9;
  for (const [k, c] of Object.entries(FX.CLIMATES)) { const d = Math.hypot(c.lat - lat, c.lon - lon); if (d < bd) { bd = d; best = k; } }
  return bd < 1.5 ? best : null;
}

async function newPage(browser, width, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: 1, acceptDownloads: true });
  const log = [], errors = [], hosts = new Set();
  await ctx.route('https://archive-api.open-meteo.com/**', (route) => {
    const url = route.request().url(); log.push(url);
    if (opts.failNormals && /start_date=\d{4}-01-01&end_date=\d{4}-12-31/.test(url) && /daily=temperature_2m_max&/.test(url)) {
      return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"error":true,"reason":"fixture outage"}' });
    }
    const r = FX.respond(url, cityFor);
    route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r.body) });
  });
  await ctx.route('https://geocoding-api.open-meteo.com/**', (route) => {
    const u = new URL(route.request().url()); log.push(u.href);
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ results: GEO[u.searchParams.get('name')] || undefined }) });
  });
  await ctx.route('https://api.convertkit.com/**', (route) => {
    log.push('KIT ' + Object.keys(JSON.parse(route.request().postData() || '{}')).sort().join(','));
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"subscription":{"id":1}}' });
  });
  ctx.gc = await GC.stubCounter(ctx); // GoatCounter -> local 204; checked with the hosts check
  if (opts.kit) await ctx.addInitScript(() => { window.WEATHER_KIT_TAG_TEST = '1234567'; });
  await ctx.addInitScript(() => {
    window.__copied = [];
    try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } }); } catch (e) {}
    document.addEventListener('securitypolicyviolation', (e) => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI); });
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(opts.now || NOV));
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, log, errors, hosts };
}
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const cardCount = (page) => page.locator('#deck figure').count();
async function waitCards(page, n) { await page.waitForFunction((n) => document.querySelectorAll('#deck figure').length === n, n, { timeout: 15000 }); }
async function saveCards(page, prefix) {
  const urls = await page.evaluate(() => window.__weatherState.canvases.map((c) => c.toDataURL('image/png')));
  urls.forEach((u, i) => fs.writeFileSync(path.join(OUT, prefix + '-' + String(i + 1).padStart(2, '0') + '.png'), Buffer.from(u.split(',')[1], 'base64')));
  return urls.length;
}

(async () => {
  const browser = await chromium.launch();

  // ---------- 1. Phone, ZIP, November 2026 ("2026 so far"), arrived via ?ref= ----------
  console.log('390px: ZIP 14201, Nov 16 2026, ?ref=tiktok');
  {
    const { ctx, page, log, errors, hosts } = await newPage(browser, 390, { kit: true });
    await page.goto(ORIGIN + '/weather/?ref=tiktok');
    await page.screenshot({ path: path.join(OUT, 'weather-390-start.png') });
    check(await page.locator('#remind').isVisible(), 'Kit reminder box shows when a tag is set (November)');
    check(await page.locator('#year').inputValue() === '2026', 'default year is 2026');
    check((await page.locator('#year option').first().textContent()) === '2026 so far', 'year menu says "2026 so far"');
    await page.fill('#q', '14201');
    await page.click('#go');
    await waitCards(page, 7);
    check(true, '7 cards once the 10-year normals arrive');
    const arch = log.filter((u) => u.includes('archive-api'));
    const main = arch.find((u) => u.includes('start_date=2026-01-01'));
    check(main && main.includes('end_date=2026-11-15'), 'data requested only through yesterday (2026-11-15)');
    check(main && /daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,sunshine_duration,wind_speed_10m_max&timezone=auto/.test(main), 'requests the 6 documented daily variables, timezone=auto');
    check(main && /latitude=42.898&longitude=-78.888/.test(main), 'ZIP 14201 resolved from the shared ZIP shard (../snow/z/)');
    const norm = arch.find((u) => u.includes('start_date=2016-01-01'));
    check(norm && norm.includes('end_date=2025-12-31') && /daily=temperature_2m_max&/.test(norm), 'normals: 2016-2025, daily highs only (one variable)');
    check(arch.length === 2, 'exactly 2 archive requests (' + arch.length + ')');
    check((await page.textContent('#res-place')) === 'Buffalo, NY', 'ZIP named via geocoding postal-code search');
    check((await page.textContent('#res-label')).startsWith('2026 so far (Jan 1'), 'results header says 2026 so far: ' + await page.textContent('#res-label'));
    check(await page.locator('#partial').isVisible(), 'partial-year note shown');
    check((await page.textContent('#partial-text')).includes('through Nov 15'), 'partial note names the last day');
    check(!(await page.locator('#weird-note').isVisible()), 'weirdest-day loading note hidden once loaded');
    const labels = await page.$$eval('#deck figcaption span', (s) => s.map((x) => x.textContent));
    check(labels.join('|') === '1. Hottest and coldest|2. Rain and snow|3. Dry and wet streaks|4. Sunniest month|5. Hot days and freezing nights|6. The weirdest day|7. Summary', 'card order: ' + labels.join(' | '));
    const st = await page.evaluate(() => { const s = window.__weatherState.stats; return { label: s.label, weird: s.weird && s.weird.date, n: s.n, units: window.__weatherState.units }; });
    check(st.label === '2026 so far' && st.n === 319, 'stats: 2026 so far, 319 days');
    check(st.weird === '2026-02-17', 'weirdest day is the Feb 17 spike');
    check(st.units.temp === 'F' && st.units.precip === 'in', 'US place defaults to F and inches');
    check(page.url().includes('zip=14201') && page.url().includes('ref=tiktok'), 'URL updated with zip, ref kept: ' + page.url());
    check(await noHScroll(page), 'no horizontal scroll at 390');
    // copy link: ?ref passthrough
    await page.click('#copy-link');
    const copied = await page.evaluate(() => window.__copied[window.__copied.length - 1]);
    check(/\?zip=14201&ref=share-tiktok$/.test(copied), 'share text link carries ref=share-tiktok: ' + copied.slice(-60));
    check(copied.includes('2026 so far'), 'share text says 2026 so far');
    // save PNG + zip
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#deck figure').nth(0).locator('button', { hasText: 'Save PNG' }).click()]);
    check(dl.suggestedFilename() === 'weather-wrapped-buffalo-ny-2026-01-hottest-and-coldest.png', 'Save PNG file name: ' + dl.suggestedFilename());
    const [dz] = await Promise.all([page.waitForEvent('download'), page.click('#zip-all')]);
    check(dz.suggestedFilename() === 'weather-wrapped-buffalo-ny-2026.zip', 'zip download: ' + dz.suggestedFilename());
    const zbuf = fs.readFileSync(await dz.path());
    check(zbuf.slice(0, 2).toString() === 'PK' && zbuf.length > 200000, 'zip is a real zip (' + zbuf.length + ' bytes)');
    await page.screenshot({ path: path.join(OUT, 'weather-390-deck.png') });
    await page.locator('#deck figure').nth(0).screenshot({ path: path.join(OUT, 'weather-390-card1.png') });
    check(await saveCards(page, 'card-buffalo-F') === 7, 'saved 7 card PNGs (F, in.)');
    // unit toggles re-render
    await page.click('label:has(input[name=tu][value=C])');
    await page.click('label:has(input[name=pu][value=mm])');
    const u2 = await page.evaluate(() => window.__weatherState.units);
    check(u2.temp === 'C' && u2.precip === 'mm', 'toggles switch to C and mm');
    check(await cardCount(page) === 7, 'still 7 cards after toggling');
    await saveCards(page, 'card-buffalo-C');
    // more-apps strip + footer
    check(await page.locator('#more-apps .llm-a').count() === 3, 'cross-promo strip renders 3 links');
    check((await page.getAttribute('#more-apps .llm-a >> nth=0', 'href')).includes('?ref=more-weather'), 'cross-promo links carry ref=more-weather');
    check(await page.locator('footer a[href="../apps/"]').count() === 1 && await page.locator('footer a[href="../"]').count() === 1, 'footer links to ../ and ../apps/');
    // Kit: only api_key + email
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForSelector('#signup-msg b');
    check(log.includes('KIT api_key,email'), 'Kit signup sends only api_key and email');
    await page.locator('#remind').screenshot({ path: path.join(OUT, 'weather-390-kit.png') });
    await page.screenshot({ path: path.join(OUT, 'weather-390-full.png'), fullPage: true });
    const csp = await page.evaluate(() => window.__csp || []);
    check(!csp.length, 'no CSP violations ' + csp.join('; '));
    check(!errors.length, 'no console errors ' + errors.join(' | '));
    check([...hosts].every((h) => ['127.0.0.1:' + PORT, 'archive-api.open-meteo.com', 'geocoding-api.open-meteo.com', 'api.convertkit.com', 'lanternlab.goatcounter.com'].includes(h)), 'only expected hosts: ' + [...hosts].join(', '));
    GC.checkBeacons(ctx.gc, check); // only page views: no hash, nothing but page-view fields
    await ctx.close();
  }

  // ---------- 2. Desktop, city outside the US ----------
  console.log('1280px: London, Nov 2026');
  {
    const { ctx, page, errors } = await newPage(browser, 1280);
    await page.goto(ORIGIN + '/weather/?q=London');
    await waitCards(page, 7);
    check(await page.locator('#remind').isVisible(), 'Kit box visible with the real tag');
    check((await page.textContent('#res-place')) === 'London, United Kingdom', 'city name');
    const u = await page.evaluate(() => window.__weatherState.units);
    check(u.temp === 'C' && u.precip === 'mm', 'non-US place defaults to C and mm');
    check(await noHScroll(page), 'no horizontal scroll at 1280');
    await page.screenshot({ path: path.join(OUT, 'weather-1280-start.png') });
    await page.locator('#results').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'weather-1280-deck.png'), fullPage: true });
    await saveCards(page, 'card-london');
    check(!errors.length, 'no console errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ---------- 3. Launch day: Jan 2 2027 shows the full 2026 ----------
  console.log('390px: Phoenix, Jan 2 2027 (full year)');
  {
    const { ctx, page, log, errors } = await newPage(browser, 390, { now: JAN, kit: true });
    await page.goto(ORIGIN + '/weather/?q=Phoenix%2C%20AZ');
    await waitCards(page, 7);
    check(await page.locator('#year').inputValue() === '2026', 'in January the default year is the one that just ended');
    check((await page.locator('#year option').first().textContent()) === '2026', 'year menu says plain "2026"');
    const main = log.find((x) => x.includes('archive-api') && x.includes('start_date=2026-01-01'));
    check(main && main.includes('end_date=2026-12-31'), 'requests through Dec 31');
    check((await page.textContent('#res-label')) === '2026', 'label is plain 2026');
    check(!(await page.locator('#partial').isVisible()), 'no partial note');
    check(!(await page.locator('#remind').isVisible()), 'reminder hidden in January');
    const st = await page.evaluate(() => window.__weatherState.stats);
    check(st.n === 365 && st.hotDays > 60 && st.snowCM === 0, 'Phoenix: 365 days, lots of 90F days, no snow');
    await saveCards(page, 'card-phoenix-jan');
    await page.screenshot({ path: path.join(OUT, 'weather-390-phoenix-jan.png') });
    check(!errors.length, 'no console errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ---------- 4. Normals fail: weirdest card skipped ----------
  console.log('390px: normals request fails');
  {
    const { ctx, page, errors } = await newPage(browser, 390, { failNormals: true });
    await page.goto(ORIGIN + '/weather/?zip=14201');
    await waitCards(page, 6);
    await page.waitForFunction(() => /skipped/.test(document.getElementById('weird-note').textContent));
    check(await cardCount(page) === 6, '6 cards without the 10-year comparison');
    check(await page.locator('#weird-note').isVisible(), 'note says the weirdest-day card is skipped');
    check(errors.every((e) => /500|Failed to load/.test(e)), 'only the expected 500 in the console');
    await ctx.close();
  }

  // ---------- 5. Errors ----------
  console.log('390px: unknown ZIP and unknown city');
  {
    const { ctx, page } = await newPage(browser, 390);
    await page.goto(ORIGIN + '/weather/');
    await page.fill('#q', '00000'); await page.click('#go');
    await page.waitForFunction(() => document.getElementById('status').classList.contains('err'));
    check(/couldn.t find ZIP 00000/i.test(await page.textContent('#status')), 'unknown ZIP message');
    await page.fill('#q', 'Nowhereville'); await page.click('#go');
    await page.waitForFunction(() => { const s = document.getElementById('status'); return /Nowhereville/.test(s.textContent) && s.classList.contains('err'); });
    check(/couldn.t find/.test(await page.textContent('#status')), 'unknown city message');
    await page.screenshot({ path: path.join(OUT, 'weather-390-error.png') });
    await ctx.close();
  }

  // ---------- 6. Dark mode ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto(ORIGIN + '/weather/');
    await page.screenshot({ path: path.join(OUT, 'weather-390-dark.png'), fullPage: true });
    await ctx.close();
  }

  await browser.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
