// Playwright end-to-end test for docs/sport/ (Year in Motion).
// Run: node bots/sport/make_fixtures.js && NODE_PATH=/opt/npm-tools/node_modules node bots/sport/test_page.js <screenshot dir>
// Uses only synthetic fixtures. Kit is routed to a local stub; the real API is never hit.
const { chromium } = require('playwright');
const JSZip = require(require('path').resolve(__dirname, '../../docs/sport/vendor/jszip-3.10.1.min.js'));
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../../docs');
const FX = path.join(__dirname, 'fixtures');
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8769, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.md': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(b);
  });
}).listen(PORT);

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const ROUTES = fs.readdirSync(FX).filter((f) => /^route_\d+\./.test(f)).map((f) => path.join(FX, f));

// Records every string drawn on each canvas, so we can check the "Make yours" line without OCR.
const INSTRUMENT = () => {
  const orig = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, x, y, w) {
    const c = this.canvas;
    (c.__texts = c.__texts || []).push(String(t));
    return orig.call(this, t, x, y, w);
  };
  const desc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', { get: desc.get, set(v) { this.__texts = []; desc.set.call(this, v); } });
};

async function cardInfo(page) {
  return page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let min = 765, max = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4 * 997) { const v = d[i] + d[i + 1] + d[i + 2]; min = Math.min(min, v); max = Math.max(max, v); sum = (sum * 31 + v) >>> 0; }
    return { w: c.width, h: c.height, spread: max - min, hash: sum, label: c.getAttribute('aria-label'), texts: (c.__texts || []).join(' | ') };
  }));
}
const labels = (cards) => cards.map((c) => c.label.replace(/^Card \d+: /, '')).join(', ');

async function upload(page, files) {
  await page.evaluate(() => { document.querySelector('#deck').innerHTML = ''; document.querySelector('#status').textContent = ''; });
  await page.setInputFiles('#file', [].concat(files).map((f) => path.isAbsolute(f) ? f : path.join(FX, f)));
  await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0 || document.querySelector('#status.err'), null, { timeout: 60000 });
  return cardInfo(page);
}
async function rerender(page, fn) {
  const n = await page.evaluate(() => window.__sportRenders || 0);
  await fn();
  await page.waitForFunction((k) => (window.__sportRenders || 0) > k, n, { timeout: 30000 });
  return cardInfo(page);
}
async function expectError(page, file, re) {
  await page.setInputFiles('#file', path.join(FX, file));
  await page.waitForFunction(() => document.querySelector('#status').classList.contains('err'), null, { timeout: 20000 });
  const t = await page.textContent('#status');
  return re.test(t) ? true : (console.log('    status was: ' + t), false);
}

(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px ==`);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, locale: 'en-US', timezoneId: 'America/Chicago' });
    await ctx.addInitScript(INSTRUMENT);
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

    await page.goto(ORIGIN + '/sport/?ref=card');
    await page.waitForLoadState('networkidle');
    check(offOrigin.length === 0, `page load makes no off-origin requests (${offOrigin.join(', ') || 'none'})`);
    check(/Your activities never leave your device\./.test(await page.textContent('#privacy-badge')), 'privacy promise visible');
    check(/Not affiliated with Strava or Garmin/.test(await page.textContent('footer')), 'footer disclaimer present');
    check(await page.locator('footer a[href="../"]').count() === 1, 'footer links to ../');
    const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    check(/default-src 'none'/.test(csp) && /script-src 'self'/.test(csp) && /connect-src https:\/\/api\.convertkit\.com;/.test(csp), 'CSP: scripts self-only, connections to Kit only');
    const title = await page.title(), desc = await page.getAttribute('meta[name="description"]', 'content');
    check(/strava year in sport/i.test(title) && /strava wrapped/i.test(title) && /garmin year in review/i.test(title), 'title targets the three search phrases: ' + title);
    check(/strava year in sport for free/i.test(desc) && /strava wrapped/i.test(desc) && /garmin year in review/i.test(desc), 'meta description targets them too');
    check(/sport\/og\.png$/.test(await page.getAttribute('meta[property="og:image"]', 'content')), 'OG image set');
    check(await page.isDisabled('#poster') && /Printable poster \(coming soon\)/.test(await page.textContent('#poster')), 'poster button present and disabled');
    check(/\?ref=share-card$/.test(await page.textContent('#pass-text')) && /lanternlab2027\.github\.io\/lab\/sport\//.test(await page.textContent('#pass-text')), 'share text carries the link with ?ref passthrough (ref=card -> share-card)');
    await page.click('#tab-garmin');
    check(await page.isVisible('#panel-garmin') && await page.isHidden('#panel-strava'), 'export-help tabs switch');
    const loadCount = all.length;

    // ---- Strava bulk export zip ----
    let cards = await upload(page, 'strava_export.zip');
    check(cards.length >= 8 && cards.length <= 10, `Strava zip -> ${cards.length} cards: ${labels(cards)}`);
    check(cards.every((c) => c.w === 1080 && c.h === 1920), 'every card is 1080x1920');
    check(cards.every((c) => c.spread > 200), 'every card has rendered content');
    check(cards.every((c) => c.texts.includes('Make yours: lanternlab2027.github.io/lab/sport')), '"Make yours: lanternlab2027.github.io/lab/sport" drawn on every card');
    check(cards.every((c) => !/-?\d{1,3}\.\d{4,}/.test(c.texts)), 'no coordinates drawn on any card');
    check(cards.some((c) => /Route art/.test(c.label)), 'route art card present for the zip');
    check((await page.inputValue('#year')) === '2026', 'year defaults to 2026');
    check(await page.isChecked('#trim') && !(await page.isChecked('#hide-routes')), 'trim 500 m ON and hide routes OFF by default');
    check(await page.evaluate(() => window.__sportState.units) === 'imperial', 'en-US defaults to miles');
    check(await page.evaluate(() => { const m = window.__sportState.acts.filter((a) => /^Morning/.test(a.nameHint)); return m.length > 50 && m.every((a) => new Date(a.t).getUTCHours() < 12); }), 'Strava UTC dates converted to local time ("Morning" activities start before noon)');
    const routeIdx = cards.findIndex((c) => /Route art/.test(c.label)), rh = cards[routeIdx].hash, h0 = cards[0].hash;
    let c2 = await rerender(page, () => page.click('#u-metric'));
    check(c2[0].hash !== h0 && /km covered/.test(c2[0].texts), 'units toggle re-renders in km');
    c2 = await rerender(page, () => page.uncheck('#trim'));
    check(c2[routeIdx].hash !== rh && /Full routes shown/.test(c2[routeIdx].texts), 'turning trim off changes the route art');
    await rerender(page, () => page.check('#trim'));
    c2 = await rerender(page, () => page.check('#hide-routes'));
    check(!c2.some((c) => /Route art/.test(c.label)) && /hidden/.test(await page.textContent('#routes-note')), 'hide routes drops the route card');
    await rerender(page, () => page.uncheck('#hide-routes'));
    c2 = await rerender(page, () => page.selectOption('#year', '2025'));
    check(c2.length >= 8 && c2.some((c) => /Route art/.test(c.label)) && c2[0].hash !== h0, `2025 re-renders with its own routes (${c2.length} cards)`);
    await rerender(page, () => page.selectOption('#year', '2026'));
    await page.fill('#name-input', 'Sam');
    await page.waitForTimeout(700);
    c2 = await cardInfo(page);
    check(/SAM.S 2026 IN MOTION/.test(c2[0].texts), 'name appears on the cards');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal page scroll');
    await page.screenshot({ path: path.join(OUT, `page-${width}-zip.png`), fullPage: width === 1280 });
    if (width === 390) await page.locator('#deck').screenshot({ path: path.join(OUT, `deck-${width}.png`) });

    const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('#deck figure:first-child button:has-text("Save PNG")')]);
    const p1 = await dl1.path();
    check(/^year-in-motion-2026-01-.*\.png$/.test(dl1.suggestedFilename()) && fs.statSync(p1).size > 50000, `Save PNG -> ${dl1.suggestedFilename()} (${fs.statSync(p1).size} bytes)`);
    const [dlz] = await Promise.all([page.waitForEvent('download'), page.click('#zip-all')]);
    const z = await JSZip.loadAsync(fs.readFileSync(await dlz.path()));
    check(Object.keys(z.files).length === c2.length, `zip has ${Object.keys(z.files).length} PNGs`);

    // ---- other inputs ----
    cards = await upload(page, 'strava_activities.csv');
    check(cards.length >= 8 && !cards.some((c) => /Route art/.test(c.label)) && /full Strava \.zip/.test(await page.textContent('#routes-note')), `activities.csv alone -> ${cards.length} cards, no route art, explains why`);
    cards = await upload(page, 'garmin_activities_metric.csv');
    check(cards.length >= 8 && await page.isVisible('#garmin-units-wrap') && (await page.inputValue('#garmin-units')) === 'metric', `Garmin metric CSV -> ${cards.length} cards, units guessed metric`);
    const gKm = await page.evaluate(() => window.__sportState.stats.dist);
    await rerender(page, () => page.selectOption('#garmin-units', 'imperial'));
    const gMi = await page.evaluate(() => window.__sportState.stats.dist);
    check(Math.abs(gMi / gKm - 1.609344) < 0.01, 'switching the Garmin file units rescales distances');
    cards = await upload(page, 'garmin_activities_imperial.csv');
    check(cards.length >= 8 && (await page.inputValue('#garmin-units')) === 'imperial', `Garmin imperial CSV -> ${cards.length} cards, units guessed imperial`);
    cards = await upload(page, 'garmin_data_export.zip');
    check(cards.length >= 8 && /Garmin data export/.test(await page.textContent('#status')), `Garmin "Export Your Data" zip -> ${cards.length} cards`);
    cards = await upload(page, ROUTES);
    check(cards.length >= 6 && cards.some((c) => /Route art/.test(c.label)) && /12 activities/.test(await page.textContent('#status')), `GPX/FIT/TCX files -> ${cards.length} cards with route art`);
    await page.screenshot({ path: path.join(OUT, `page-${width}-gpx.png`) });
    cards = await upload(page, 'strava_old.csv');
    check(cards.length >= 6, `older Strava CSV -> ${cards.length} cards`);
    cards = await upload(page, 'strava_localized.csv');
    check(cards.length >= 6, `localized Strava CSV -> ${cards.length} cards`);
    check(await expectError(page, 'not_an_export.csv', /doesn.t look like a Strava/), 'non-export CSV shows a clear error');
    check(await expectError(page, 'empty_strava.csv', /No activities/), 'empty export shows a clear error');
    check(await expectError(page, 'corrupt.zip', /zip/i), 'corrupt zip shows a clear error');

    // The core privacy assertion: after page load, uploads and renders made zero network requests.
    // The static "More free apps" strip (../apps/more.js, more.css, lazy thumbnails) may load after upload; it sends no data.
    const afterUpload = all.slice(loadCount).filter((r) => !(r.method === 'GET' && /^\/apps\/(more\.(js|css)|img\/[a-z-]+\.jpg)$/.test(r.url.replace(ORIGIN, ''))));
    check(afterUpload.length === 0 && offOrigin.length === 0, `zero network requests after upload (${afterUpload.length} made: ${afterUpload.map((r) => r.method + ' ' + r.url).join(', ') || 'none'})`);
    const blocked = await page.evaluate(() => fetch('https://example.com/x', { method: 'POST', body: 'test' }).then(() => false, () => true));
    check(blocked, 'CSP blocks fetch to a third-party origin');

    // Kit signup sends only the email (activities still loaded on the page).
    const kit = [];
    await ctx.unroute('**/*');
    await page.route(/convertkit\.com|kit\.com/, async (route) => {
      kit.push({ url: route.request().url(), body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"subscription":{"id":1}}' });
    });
    await upload(page, 'strava_export.zip');
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /on the list|didn't go through/.test(document.querySelector('#notify').textContent));
    const body = kit[0] ? JSON.parse(kit[0].body) : {};
    check(kit.length === 1 && /\/v3\/tags\/25912977\/subscribe$/.test(kit[0].url), 'Kit called once with the 25912977 placeholder tag');
    check(JSON.stringify(Object.keys(body).sort()) === '["api_key","email"]' && !/Run|Ride|activities|lat|lon/.test(kit[0].body), 'Kit body has only api_key + email');

    // One-tap sample deck.
    await page.click('#reset');
    await page.click('#sample');
    await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length >= 8);
    const sc = await cardInfo(page);
    check(sc.length >= 8 && sc.length <= 10 && sc.some((c) => /Route art/.test(c.label)), `sample deck renders (${sc.length} cards)`);
    const realErrs = errs.filter((e) => !/example\.com\/x/.test(e));
    check(realErrs.length === 0, `no page errors (${realErrs.join(' | ') || 'none'})`);
    await ctx.close();
  }

  // Early January: falls back to last year, and says so.
  {
    console.log('\n== January 2027 ==');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'en-GB' });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2027-01-03T12:00:00') });
    await page.goto(ORIGIN + '/sport/');
    await upload(page, 'strava_activities.csv');
    check((await page.inputValue('#year')) === '2026', 'falls back to 2026 when 2027 has no activities yet');
    check(/No activities in 2027 yet/.test(await page.textContent('#status')), 'status explains the fallback');
    check(await page.evaluate(() => window.__sportState.units) === 'metric', 'en-GB defaults to km');
    await page.selectOption('#year', '2027');
    await page.waitForFunction(() => !document.querySelector('#empty').hidden);
    check((await page.$$('#deck canvas')).length === 0, 'empty year shows a message, no cards');
    await ctx.close();
  }

  // Export every card for visual review.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US', timezoneId: 'America/Chicago' });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await page.goto(ORIGIN + '/sport/');
  for (const [fx, tag] of [['strava_export.zip', 'zip'], ['garmin_activities_metric.csv', 'garmin'], [ROUTES, 'gpx'], ['strava_localized.csv', 'localized']]) {
    await upload(page, fx);
    const urls = await page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => c.toDataURL('image/png')));
    urls.forEach((u, i) => fs.writeFileSync(path.join(OUT, `card-${tag}-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
  }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
