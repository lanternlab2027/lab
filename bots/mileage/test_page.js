// Playwright end-to-end test for docs/mileage/ (Timeline Mileage Log).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/mileage/test_page.js <screenshot dir>
// Uses only synthetic fixtures. Kit is routed to a stub; the real API is never hit.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const S = require('../../docs/mileage/stats.js');

const ROOT = path.resolve(__dirname, '../../docs');
const FX = path.join(__dirname, 'fixtures');
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8771, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(b);
  });
}).listen(PORT);

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const num = (s) => parseFloat(String(s).replace(/[^0-9.\-]/g, ''));

async function upload(page, files) {
  await page.evaluate(() => { document.querySelector('#rows').innerHTML = ''; document.querySelector('#status').textContent = ''; });
  await page.setInputFiles('#file', [].concat(files).map((f) => path.join(FX, f)));
  await page.waitForFunction(() => document.querySelectorAll('#rows tr').length > 0 || document.querySelector('#status').classList.contains('err'), null, { timeout: 30000 });
}
async function expectError(page, file, re) {
  await page.evaluate(() => { document.querySelector('#status').className = 'status'; });
  await page.setInputFiles('#file', path.join(FX, file));
  await page.waitForFunction(() => document.querySelector('#status').classList.contains('err'));
  return re.test(await page.textContent('#status'));
}
async function totals(page) {
  return page.evaluate(() => ({ business: document.querySelector('#tot-business').textContent, personal: document.querySelector('#tot-personal').textContent,
    untagged: document.querySelector('#tot-untagged').textContent, all: document.querySelector('#tot-all').textContent, est: document.querySelector('#estimate-amt').textContent }));
}
async function downloadCSV(page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#csv')]);
  const p = path.join(OUT, dl.suggestedFilename());
  await dl.saveAs(p);
  return { name: dl.suggestedFilename(), text: fs.readFileSync(p, 'utf8') };
}
function parseCSVRows(text) {
  // minimal RFC-4180 parser for checking our own output
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r') { /* skip */ } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px ==`);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, timezoneId: 'America/New_York' });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2026-11-15T12:00:00') });
    const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' && !/Content Security Policy|Failed to fetch|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
    const all = [];
    await ctx.route('**/*', (route) => { const r = route.request(); all.push(r.url()); if (!r.url().startsWith(ORIGIN)) return route.abort(); return route.continue(); });

    await page.goto(ORIGIN + '/mileage/?ref=tiktok');
    // ---- static checks
    const title = await page.title();
    check(/Google Maps Timeline Mileage Log/.test(title) && /Mileage Tracker/i.test(title), 'title targets "Google Maps Timeline mileage log / tracker": ' + title);
    const meta = await page.evaluate(() => ({
      desc: document.querySelector('meta[name=description]').content, og: document.querySelector('meta[property="og:image"]').content,
      canon: document.querySelector('link[rel=canonical]').href, csp: document.querySelector('meta[http-equiv=Content-Security-Policy]').content,
      links: [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')), signupHidden: document.querySelector('#signup').hidden,
      share: document.querySelector('#share-url').textContent, foot: document.querySelector('#disclaimer').textContent, body: document.body.innerText
    }));
    check(/Google Maps Timeline/.test(meta.desc) && /mileage log/.test(meta.desc) && /tracker/.test(meta.desc), 'meta description');
    check(meta.og === 'https://lanternlab2027.github.io/lab/mileage/og.png' && fs.statSync(path.join(ROOT, 'mileage/og.png')).size > 10000, 'og:image exists');
    check(meta.canon === 'https://lanternlab2027.github.io/lab/mileage/', 'canonical');
    check(/default-src 'none'/.test(meta.csp) && /connect-src https:\/\/api\.convertkit\.com;/.test(meta.csp) && /script-src 'self';/.test(meta.csp), 'strict CSP');
    check(meta.links.includes('../') && meta.links.includes('../apps/'), 'links to ../ and ../apps/');
    check(meta.links.includes('https://support.google.com/maps/answer/6258979'), 'export guide cites Google help');
    check(meta.links.includes('https://www.irs.gov/publications/p463'), 'cites IRS Pub 463');
    check(/Settings.*Location.*Location services.*Timeline/s.test(meta.body) && /Location & Privacy/.test(meta.body) && /location-history\.json/.test(meta.body), 'Android + iPhone export steps');
    check(!meta.signupHidden, 'Kit box visible with the real tag');
    check(meta.share === 'lanternlab2027.github.io/lab/mileage/?ref=share-tiktok', '?ref passthrough: ' + meta.share);
    check(/Not tax/.test(meta.foot) && /Not affiliated with Google/.test(meta.foot), 'footer disclaimer');
    const blocked = await page.evaluate(async () => { try { await fetch('https://example.com/x'); return false; } catch (e) { return true; } });
    check(blocked, 'CSP blocks third-party fetch');
    await page.screenshot({ path: path.join(OUT, `landing-${width}.png`) });

    // ---- Android upload
    const before = all.length;
    await upload(page, 'Timeline.json');
    check(/Read 1,319 trips from your Android Timeline export/.test(await page.textContent('#status')), 'android parsed: ' + await page.textContent('#status'));
    check(await page.inputValue('#period') === 'y2026', 'default period is tax year 2026');
    const types = await page.$$eval('#types input', (xs) => xs.map((x) => x.getAttribute('data-type') + ':' + x.checked));
    check(types.join() === 'IN_PASSENGER_VEHICLE:true,WALKING:false,CYCLING:false', 'driving on by default: ' + types.join());
    let t = await totals(page);
    check(num(t.business) === 0 && num(t.untagged) === num(t.all) && num(t.all) > 1000 && t.est === '$0.00', 'fresh totals all untagged: ' + JSON.stringify(t));
    check(await page.$eval('#warn-records', (e) => /Not tax advice/.test(e.textContent) && /at or near the time/.test(e.textContent)), 'contemporaneous-records warning');
    check((await page.$$('#rows tr')).length === 100 && /Page 1 of/.test(await page.textContent('#pager')), 'paged at 100 rows');
    const placeNames = await page.$$eval('#places input[data-name]', (xs) => xs.map((x) => x.value));
    check(placeNames[0] === 'Work' && placeNames[1] === 'Home', 'HOME/WORK labels suggested: ' + placeNames.slice(0, 3));

    // tag one row business
    const firstMiles = num(await page.textContent('#rows tr:first-child td.mi'));
    await page.selectOption('#rows tr:first-child select', 'business');
    await page.fill('#rows tr:first-child input[data-note]', 'Client meeting');
    await page.press('#rows tr:first-child input[data-note]', 'Tab');
    t = await totals(page);
    check(Math.abs(num(t.business) - firstMiles) < 0.05, 'business total follows the tag: ' + t.business);
    const date0 = await page.$eval('#rows tr:first-child td.d', (e) => e.firstChild.textContent);
    const rate = S.rateFor(date0).cents / 100;
    check(Math.abs(num(t.est) - Math.round(firstMiles * rate * 100) / 100) < 0.011, 'estimate uses the IRS rate for the trip date: ' + t.est);

    // name a place, tag its untagged trips
    await page.fill('#places .place:nth-child(3) input', 'Northside Client');
    await page.waitForTimeout(300);
    // the name is checked in the CSV below
    await page.click('#places .place:nth-child(3) [data-p="business"]');
    check(/Tagged \d+ untagged trips? to or from Northside Client as business/.test(await page.textContent('#status')), 'tag by place: ' + await page.textContent('#status'));
    await page.click('#places .place:nth-child(1) [data-p="personal"]');
    t = await totals(page);
    check(num(t.business) > firstMiles && num(t.personal) > 0, 'place tagging moves miles: ' + JSON.stringify(t));
    await page.selectOption('#show', 'business');
    const nb = num(await page.textContent('#count'));
    const allBiz = await page.$$eval('#rows select', (xs) => xs.every((x) => x.value === 'business'));
    check(nb > 1 && allBiz, 'business filter shows only business: ' + nb);
    await page.selectOption('#show', 'all');

    // CSV
    const csv = await downloadCSV(page);
    const rows = parseCSVRows(csv.text);
    const head = rows[0], data = rows.slice(1, rows.findIndex((r) => r.length === 1 && r[0] === ''));
    check(csv.name === 'mileage-log-2026.csv', 'CSV filename ' + csv.name);
    check(head.join('|') === 'Date|Start time|End time|From|To|Miles|Purpose|Business purpose / notes|Distance from|IRS rate ($/mi)|Estimated amount ($)', 'CSV header');
    check(data.length === num(await page.textContent('#count')), 'CSV has every trip in the period: ' + data.length);
    check(data.every((r) => r.length === 11 && /^2026-/.test(r[0])), 'CSV rows well-formed and in 2026');
    const sumBiz = data.filter((r) => r[6] === 'Business').reduce((s, r) => s + +r[5], 0);
    const csvTot = (label) => +rows.find((r) => r[0] === label)[1];
    t = await totals(page);
    check(Math.abs(csvTot('Business miles') - num(t.business)) < 0.05 && Math.abs(sumBiz - num(t.business)) < 0.05, 'CSV business total matches UI and rows');
    check(Math.abs(csvTot('Estimated standard mileage amount ($)') - num(t.est)) < 0.011, 'CSV estimate matches UI');
    check(data.some((r) => r[7] === 'Client meeting') && data.some((r) => r[3] === 'Northside Client' || r[4] === 'Northside Client'), 'CSV carries notes and place names');
    check(data.some((r) => /Place \d+ \(\d+\.\d{4}, -\d+\.\d{4}\)/.test(r[3] + r[4])), 'unnamed places get coordinates in the CSV');
    check(data.filter((r) => r[6] === 'Business').every((r) => r[9] === '0.725' || r[9] === '0.760'), '2026 business rows use 72.5c / 76c');

    // period switches
    await page.selectOption('#period', 'y2025');
    const n2025 = num(await page.textContent('#count'));
    await page.selectOption('#period', 'custom');
    await page.fill('#from', '2026-03-01'); await page.dispatchEvent('#from', 'change');
    await page.fill('#to', '2026-03-31'); await page.dispatchEvent('#to', 'change');
    const dates = await page.$$eval('#rows td.d', (xs) => xs.map((x) => x.firstChild.textContent));
    check(n2025 > 50 && n2025 < 400 && dates.length > 50 && dates.every((d) => d >= '2026-03-01' && d <= '2026-03-31'), `period filters (2025: ${n2025}, Mar 2026: ${dates.length})`);
    await page.check('#types input[data-type="WALKING"]');
    check(await page.$$eval('#rows td.d small', (xs) => xs.some((x) => /Walking/.test(x.textContent))), 'turning on walking shows walks, labeled');
    await page.selectOption('#period', 'y2026');
    await page.screenshot({ path: path.join(OUT, `android-${width}.png`), fullPage: false });
    for (const id of ['totals-panel', 'places-panel', 'log-panel']) { const el = await page.$('#' + id); await el.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(OUT, `${id}-${width}.png`) }); }

    // ---- iPhone
    await upload(page, 'location-history.json');
    check(/Read 330 trips from your iPhone Timeline export/.test(await page.textContent('#status')), 'ios parsed');
    t = await totals(page);
    check(num(t.all) > 1000 && num(t.business) === 0, 'ios totals reset for new file: ' + JSON.stringify(t));
    // ---- Takeout zip and loose month files
    await upload(page, 'takeout-2024.zip');
    check(/Takeout Semantic Location History/.test(await page.textContent('#status')), 'takeout zip parsed: ' + await page.textContent('#status'));
    const zipCount = await page.textContent('#status');
    check(await page.inputValue('#period') === 'y2024', 'takeout defaults to latest year in file (2024)');
    await page.selectOption('#period', 'all');
    const zipAll = num(await page.textContent('#count'));
    const months = [];
    for (const y of fs.readdirSync(path.join(FX, 'Semantic Location History'))) for (const f of fs.readdirSync(path.join(FX, 'Semantic Location History', y))) months.push(path.join('Semantic Location History', y, f));
    await upload(page, months);
    check((await page.textContent('#status')) === zipCount, 'loose month files == zip');
    await page.selectOption('#period', 'all');
    check(num(await page.textContent('#count')) === zipAll, 'same trip count from month files: ' + zipAll);
    await page.selectOption('#period', 'y2023');
    await page.selectOption('#rows tr:first-child select', 'business');
    check(/65\.5/.test(await page.textContent('#estimate')), '2023 trips use 65.5c');
    await upload(page, ['2024_MARCH.json', '2024_MARCH.json']);
    check(/Read 4 trips/.test(await page.textContent('#status')), 'duplicate files deduped');
    check(/straight line/.test(await page.textContent('#rows')) && /path/.test(await page.textContent('#rows')), 'estimated distances are marked');

    // ---- errors
    check(await expectError(page, 'Records.json', /Records\.json/), 'Records.json error');
    check(await expectError(page, 'notes.txt', /isn.t a JSON file/), 'non-JSON error');
    check(await expectError(page, 'not-timeline.json', /doesn.t look like a Google Maps Timeline/), 'wrong JSON error');
    check(await expectError(page, 'empty-android.json', /No trips found/), 'empty export error');

    check(all.slice(before).length === 0, 'zero network requests after upload (' + all.slice(before).length + ')');

    // ---- remember (names + tags in localStorage, opt-in)
    await upload(page, 'tiny-android.json');
    check((await page.evaluate(() => localStorage.length)) === 0, 'nothing stored by default');
    await page.check('#remember');
    await page.fill('#places .place:nth-child(1) input', 'My House');
    await page.selectOption('#rows tr:first-child select', 'business');
    await page.waitForTimeout(400);
    const stored = await page.evaluate(() => localStorage.getItem('lanternlab.mileage.v1'));
    check(stored && /My House/.test(stored) && !/latLng|semanticSegments/.test(stored), 'opt-in storage keeps names/tags only');
    await page.reload();
    await upload(page, 'tiny-android.json');
    check(await page.isChecked('#remember') && (await page.textContent('#rows')).includes('My House') && (await page.inputValue('#rows tr:first-child select')) === 'business', 'names and tags restored after reload');
    await page.uncheck('#remember');
    check((await page.evaluate(() => localStorage.getItem('lanternlab.mileage.v1'))) === null, 'unticking erases storage');

    // ---- sample
    await page.click('#sample');
    await page.waitForFunction(() => /made-up sample/.test(document.querySelector('#status').textContent));
    t = await totals(page);
    check(num(t.business) > 1000 && num(t.est) > 500, 'sample shows a filled-in log: ' + JSON.stringify(t));
    await page.evaluate(() => { window.print = () => { window.__printed = document.querySelectorAll('#rows tr').length; }; });
    await page.click('#print');
    check((await page.evaluate(() => window.__printed)) > 100, 'print renders the whole log');
    check((await page.evaluate(() => document.querySelectorAll('#rows tr').length)) <= 100, 'paging restored after print');
    await page.screenshot({ path: path.join(OUT, `sample-full-${width}.png`), fullPage: true });

    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(sw <= width, `no horizontal scroll (${sw})`);
    check(errs.length === 0, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  // ---- Kit with a test tag (stubbed)
  console.log('\n== Kit ==');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.MILEAGE_KIT_TAG_TEST = '12345'; });
  const calls = [];
  await ctx.route('**/*', (route) => {
    const r = route.request();
    if (r.url().startsWith('https://api.convertkit.com/')) { calls.push({ url: r.url(), body: JSON.parse(r.postData()) }); return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"subscription":{}}' }); }
    if (!r.url().startsWith(ORIGIN)) return route.abort();
    return route.continue();
  });
  await page.goto(ORIGIN + '/mileage/');
  check(!(await page.$eval('#signup', (e) => e.hidden)), 'Kit box shows once a numeric tag is set');
  await page.fill('#signup-email', 'test@example.com');
  await page.click('#signup-form button');
  await page.waitForFunction(() => /in\./.test(document.querySelector('#signup-msg').textContent));
  check(calls.length === 1 && /\/v3\/tags\/12345\/subscribe$/.test(calls[0].url), 'one Kit call to the tag');
  check(calls.length === 1 && Object.keys(calls[0].body).sort().join() === 'api_key,email', 'Kit gets only api_key + email');
  const src = fs.readFileSync(path.join(ROOT, 'mileage/kit.js'), 'utf8');
  check(/"25916948"/.test(src), 'real Kit tag in kit.js');
  await ctx.close();

  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})();
