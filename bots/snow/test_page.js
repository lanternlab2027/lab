// Playwright end-to-end test for docs/snow/ (Snow Day Odds).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/snow/test_page.js <screenshot dir> [--no-live]
// api.weather.gov and the Open-Meteo geocoder are routed to synthetic fixtures (bots/snow/fixtures.js); Kit is stubbed.
// The clock is frozen at fixtures.NOW. A live smoke test at the end tries the real NWS API (skipped if unreachable).
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FX = require('./fixtures.js');

const ROOT = path.resolve(__dirname, '../../docs');
const OUT = path.resolve(process.argv[2] || '.');
const LIVE = !process.argv.includes('--no-live');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8794, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(b);
  });
}).listen(PORT);

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

// Which scenario each fixture location gets
const SCEN = { BUF: { grid: 'heavy', alerts: ['Winter Storm Warning'] }, FFC: { grid: 'early', alerts: [] }, BOU: { grid: 'none', alerts: [] } };
const ALERT_PT = { '42.898,-78.888': 'BUF', '33.753,-84.39': 'FFC', '39.752,-104.998': 'BOU', '42.8864,-78.8784': 'BUF' };
const GEO = {
  Atlanta: [{ name: 'Atlanta', latitude: 33.753, longitude: -84.39, country_code: 'US', admin1: 'Georgia', population: 498715 }, { name: 'Atlanta', latitude: 33.1, longitude: -94.16, country_code: 'US', admin1: 'Texas' }],
  Buffalo: [{ name: 'Buffalo', latitude: 42.8864, longitude: -78.8784, country_code: 'US', admin1: 'New York' }],
};

async function wire(ctx, log) {
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/geo+json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  await ctx.route('https://api.weather.gov/**', (route) => {
    const u = new URL(route.request().url());
    log.push(u.href);
    let m;
    if ((m = /^\/points\/(.+)$/.exec(u.pathname))) {
      let key = m[1];
      if (key === '42.8864,-78.8784') key = '42.898,-78.888'; // geolocation / geocoder Buffalo
      const p = FX.points(key);
      return p ? json(route, 200, p) : json(route, 404, { title: 'Data Unavailable For Requested Point', status: 404 });
    }
    if ((m = /^\/gridpoints\/(\w+)\/\d+,\d+$/.exec(u.pathname))) return json(route, 200, FX.GRIDS[SCEN[m[1]].grid]);
    if (u.pathname === '/alerts/active') { const o = ALERT_PT[u.searchParams.get('point')]; return json(route, 200, FX.alerts(o ? SCEN[o].alerts : [])); }
    return json(route, 404, {});
  });
  await ctx.route('https://geocoding-api.open-meteo.com/**', (route) => {
    const u = new URL(route.request().url()); log.push(u.href);
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ results: GEO[u.searchParams.get('name')] || undefined }) });
  });
  await ctx.route('https://api.convertkit.com/**', (route) => {
    log.push('KIT ' + route.request().postData());
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"subscription":{"id":1}}' });
  });
}

async function newPage(browser, width, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: 1, acceptDownloads: true, geolocation: { latitude: 42.8864, longitude: -78.8784 }, permissions: opts.geo ? ['geolocation'] : [] });
  const log = [], hosts = new Set(), errors = [];
  await wire(ctx, log);
  if (opts.kit) await ctx.addInitScript(() => { window.SNOW_KIT_TAG_TEST = '1234567'; });
  await ctx.addInitScript(() => { window.__copied = []; try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } }); } catch (e) {} });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(FX.NOW));
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, log, hosts, errors };
}
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1280]) {
    console.log('\n== width ' + width);
    const { ctx, page, log, hosts, errors } = await newPage(browser, width);
    await page.goto(ORIGIN + '/snow/?ref=share2');
    check(await page.locator('#alert').isVisible(), 'Kit box visible with the real tag');
    check(await noHScroll(page), 'no horizontal scroll on load');
    await page.screenshot({ path: path.join(OUT, `snow-${width}-start.png`), fullPage: false });

    // ZIP in Buffalo: heavy snow + Winter Storm Warning
    await page.fill('#q', '14201'); await page.click('#go');
    await page.waitForSelector('#result:not([hidden])');
    const pct = parseInt(await page.textContent('#pct'), 10);
    check(pct >= 80, 'Buffalo heavy snow + warning is high: ' + pct + '%');
    check((await page.textContent('#place')) === 'Buffalo, NY 14201', 'place name from NWS relativeLocation + ZIP');
    check(/Tomorrow, Wednesday, December 2/.test(await page.textContent('#when')), 'date is tomorrow in local time');
    const reasons = await page.locator('#reasons li').allTextContents();
    check(/in\. of snow expected overnight/.test(reasons[0]) && reasons.includes('Winter Storm Warning in effect'), 'reasons: ' + reasons.join(' | '));
    check(await page.locator('input[name=region][value=used]').isChecked(), 'region guessed snow-used for Buffalo');
    check(/guessed/.test(await page.textContent('#notes')), 'guess note shown');
    check(/zip=14201/.test(page.url()) && /ref=share2/.test(page.url()), 'URL updated with zip, keeps ref: ' + page.url());
    check((await page.locator('.disclaimer').first().textContent()).includes('Only your school district decides; check their official announcements.'), 'disclaimer present');
    await page.screenshot({ path: path.join(OUT, `snow-${width}-buffalo.png`), fullPage: true });

    // Region toggle changes the number (re-scored, not re-fetched)
    const before = log.length;
    await page.click('.seg label:has(input[value=rare])');
    const pctRare = parseInt(await page.textContent('#pct'), 10);
    check(pctRare > pct, 'rarely-sees-snow raises it: ' + pctRare + '%');
    check(log.length === before, 'region change does not refetch');
    await page.click('.seg label:has(input[value=used])');

    // Share card
    await page.click('#share');
    await page.waitForSelector('#cardwrap:not([hidden])');
    const dims = await page.evaluate(() => [document.getElementById('card').width, document.getElementById('card').height]);
    check(dims[0] === 1080 && dims[1] === 1350, 'card is 1080x1350');
    const cardPng = await page.evaluate(() => document.getElementById('card').toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, `snow-${width}-card.png`), Buffer.from(cardPng.split(',')[1], 'base64'));
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#card-save')]);
    check(/^snow-day-odds-buffalo-ny-14201-2026-12-02\.png$/.test(dl.suggestedFilename()), 'save image filename ' + dl.suggestedFilename());
    await page.click('#copy');
    const copied = await page.evaluate(() => window.__copied.slice(-1)[0] || '');
    check(/Buffalo, NY 14201 \(Wed, Dec 2\): \d+%/.test(copied) && /Make yours: https:\/\/lanternlab2027\.github\.io\/lab\/snow\/\?zip=14201&r=used&ref=share3/.test(copied), 'copy link text: ' + copied);
    await page.click('#share-tool');
    const tool = await page.evaluate(() => window.__copied.slice(-1)[0] || '');
    check(/\/lab\/snow\/\?ref=share3$/.test(tool), 'Make yours share-tool link: ' + tool);
    check(await noHScroll(page), 'no horizontal scroll with results');
    await page.screenshot({ path: path.join(OUT, `snow-${width}-card-section.png`), fullPage: false });

    // City search: Atlanta, 3 in. ending before 5am, guessed "rarely"
    await page.click('.seg label:has(input[value=used])'); // explicit choice sticks...
    await ctx.clearCookies();
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(ORIGIN + '/snow/');
    await page.fill('#q', 'Atlanta, GA'); await page.click('#go');
    await page.waitForFunction(() => /Atlanta/.test(document.getElementById('place').textContent));
    check(await page.locator('input[name=region][value=rare]').isChecked(), 'region guessed rarely-sees-snow for Atlanta');
    const pA = parseInt(await page.textContent('#pct'), 10);
    check(pA >= 50, 'Atlanta 3 in. (rare) is a real chance: ' + pA + '%');
    check(/ending before 5am/.test(await page.textContent('#reasons')), 'timing reason shown');
    check((await page.textContent('#place')) === 'Atlanta, GA', 'geocoded name with state abbreviation');
    check(/q=Atlanta%2C\+GA|q=Atlanta%2C%20GA/.test(page.url()), 'URL has q= for city: ' + page.url());
    await page.screenshot({ path: path.join(OUT, `snow-${width}-atlanta.png`), fullPage: false });

    // Shared link loads directly (Denver: nothing)
    await page.goto(ORIGIN + '/snow/?zip=80202&r=used&ref=share');
    await page.waitForSelector('#result:not([hidden])');
    const pD = parseInt(await page.textContent('#pct'), 10);
    check(pD < 5, 'Denver no snow under 5%: ' + pD + '%');
    check(!/guessed/.test(await page.textContent('#notes')), 'no guess note when r= given');

    // Errors
    await page.fill('#q', '00000'); await page.click('#go');
    await page.waitForFunction(() => document.getElementById('status').classList.contains('err'));
    check(/couldn.t find ZIP 00000/.test(await page.textContent('#status')), 'unknown ZIP message');
    await page.fill('#q', 'Nowhereville, ZZ'); await page.click('#go');
    await page.waitForFunction(() => /couldn.t find/.test(document.getElementById('status').textContent));
    check(true, 'unknown city message');
    await page.fill('#q', '00601'); await page.click('#go'); // Puerto Rico ZIP: no fixture -> 404 from /points
    await page.waitForFunction(() => /doesn.t forecast/.test(document.getElementById('status').textContent));
    check(true, 'NWS 404 point message');

    const bad = [...hosts].filter((h) => !['127.0.0.1:' + PORT, 'api.weather.gov', 'geocoding-api.open-meteo.com'].includes(h));
    check(bad.length === 0, 'no other hosts contacted ' + (bad.join(',') || ''));
    check(errors.filter((e) => !/404|Failed to load resource/.test(e)).length === 0, 'no console errors ' + errors.join(' | '));
    await ctx.close();
  }

  // Geolocation (opt-in) + Kit
  console.log('\n== geolocation + kit (390)');
  {
    const { ctx, page, log, errors } = await newPage(browser, 390, { geo: true, kit: true });
    await page.goto(ORIGIN + '/snow/');
    check(!(await page.locator('#alert').isHidden()), 'Kit box visible with a numeric tag');
    const ptsBefore = log.filter((u) => /\/points\//.test(u)).length;
    check(ptsBefore === 0, 'no location request before the user asks');
    await page.click('#geo');
    await page.waitForSelector('#result:not([hidden])');
    check((await page.textContent('#place')) === 'Buffalo, NY', 'geolocation shows nearest town');
    check(!/42\.88|78\.87/.test(page.url()), 'coordinates are not put in the URL');
    await page.click('#copy');
    const copied = await page.evaluate(() => window.__copied.slice(-1)[0] || '');
    check(/\?q=Buffalo%2C%20NY&r=used&ref=share/.test(copied) && !/42\.8|78\.8/.test(copied), 'share link uses town, not coordinates: ' + copied);
    await page.fill('#signup-email', 'kid@example.com');
    await page.fill('#signup-zip', '1420');
    await page.click('#signup-form button');
    check(/5-digit ZIP/.test(await page.textContent('#signup-msg')), 'ZIP validated');
    await page.fill('#signup-zip', '14201');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /You're in/.test(document.getElementById('signup-msg').textContent));
    const kit = log.find((l) => l.startsWith('KIT '));
    const body = JSON.parse(kit.slice(4));
    check(Object.keys(body).sort().join(',') === 'api_key,email,fields' && Object.keys(body.fields).join(',') === 'snow_zip' && body.fields.snow_zip === '14201', 'Kit gets only email + snow_zip');
    await page.locator('#alert').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'snow-390-kit.png'), fullPage: false });
    check(errors.length === 0, 'no console errors ' + errors.join(' | '));
    await ctx.close();
  }

  // Dark mode screenshot
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    await wire(ctx, []);
    const page = await ctx.newPage(); await page.clock.setFixedTime(new Date(FX.NOW));
    await page.goto(ORIGIN + '/snow/?zip=30303');
    await page.waitForSelector('#result:not([hidden])');
    await page.screenshot({ path: path.join(OUT, 'snow-390-dark.png'), fullPage: true });
    await ctx.close();
  }

  // Live smoke test
  if (LIVE) {
    console.log('\n== live smoke (real api.weather.gov)');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
    let reachable = true;
    try {
      const r = await ctx.request.get('https://api.weather.gov/points/42.8864,-78.8784', { timeout: 15000 });
      reachable = r.ok();
      if (reachable) check(r.headers()['access-control-allow-origin'] === '*', 'NWS sends Access-Control-Allow-Origin: *');
    } catch (e) { reachable = false; }
    if (!reachable) console.log('  SKIP live smoke: api.weather.gov is not reachable from this machine');
    else {
      await page.goto(ORIGIN + '/snow/?zip=14201');
      await page.waitForFunction(() => !document.getElementById('result').hidden || document.getElementById('status').classList.contains('err'), null, { timeout: 30000 });
      check(!(await page.locator('#result').isHidden()), 'live: result rendered (' + (await page.textContent('#status')) + ')');
      if (!(await page.locator('#result').isHidden())) console.log('  live: ' + (await page.textContent('#place')) + ' ' + (await page.textContent('#pct')) + ' / ' + (await page.locator('#reasons li').allTextContents()).join(' | '));
      await page.screenshot({ path: path.join(OUT, 'snow-1280-live.png'), fullPage: true });
    }
    await ctx.close();
  }

  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
