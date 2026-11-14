// Playwright end-to-end test for docs/eats/ (NYC Restaurant Report Card).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/eats/test_page.js <screenshot dir> [--no-live]
// Socrata calls are routed to synthetic fixtures (bots/eats/fixtures.js); Kit is stubbed.
// One live smoke test at the end hits the real NYC Open Data API (and checks CORS) unless --no-live.
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FX = require('./fixtures.js');

const ROOT = path.resolve(__dirname, '../../docs');
const OUT = path.resolve(process.argv[2] || '.');
const LIVE = !process.argv.includes('--no-live');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8781, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(b);
  });
}).listen(PORT);

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const SODA = 'https://data.cityofnewyork.us/resource/43nn-pn8j.json';

// --- Tiny SoQL evaluator for the fixture server (enough for the queries the app sends) ---
function likeToRe(p) { return new RegExp('^' + p.split('%').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i'); }
function matchWhere(row, where) {
  if (!where) return true;
  return where.split(/ AND /).every((cl) => {
    let m;
    if ((m = /^upper\((\w+)\) like '(.*)'$/.exec(cl))) return likeToRe(m[2]).test(String(row[m[1]] || ''));
    if ((m = /^(\w+)='(.*)'$/.exec(cl))) return String(row[m[1]] || '') === m[2];
    throw new Error('fixture server: unsupported clause ' + cl);
  });
}
function soda(url) {
  const u = new URL(url), p = u.searchParams;
  const where = p.get('$where') || '';
  let m;
  if ((m = /^camis='(\d+)'$/.exec(where))) return FX.RESTAURANTS[m[1]] || [];
  if ((m = /^camis in\((.*)\) AND grade in/.exec(where))) {
    const ids = m[1].match(/\d+/g) || [];
    const out = [], seen = new Set();
    ids.forEach((id) => (FX.RESTAURANTS[id] || []).forEach((r) => {
      if (!/^[ABCPZ]$/.test(r.grade || '')) return;
      const k = id + r.grade + r.inspection_date; if (seen.has(k)) return; seen.add(k);
      out.push({ camis: id, grade: r.grade, inspection_date: r.inspection_date });
    }));
    return out;
  }
  if (p.get('$q')) {
    const q = p.get('$q').toUpperCase();
    return FX.SEARCH_ALL.filter((r) => matchWhere(r, where) && r.dba.toUpperCase().includes(q));
  }
  return FX.SEARCH_ALL.filter((r) => matchWhere(r, where)).sort((a, b) => (a.last < b.last ? 1 : -1));
}

function pngSize(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }

async function setup(browser, width, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  if (opts.kitTag) await ctx.addInitScript((t) => { window.EATS_KIT_TAG_TEST = t; }, opts.kitTag);
  const page = await ctx.newPage();
  const log = { errs: [], soda: [], kit: [], off: [] };
  page.on('pageerror', (e) => log.errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) log.errs.push(m.text()); });
  await ctx.route('**/*', (route) => {
    const r = route.request(), url = r.url();
    if (url.startsWith(ORIGIN + '/')) return route.continue();
    if (url.startsWith(SODA)) {
      log.soda.push(url);
      if (opts.sodaStatus) return route.fulfill({ status: opts.sodaStatus, body: '{}', headers: { 'access-control-allow-origin': '*' } });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(soda(url)) });
    }
    if (url.startsWith('https://api.convertkit.com/')) {
      log.kit.push({ url, body: r.postData() });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"subscription":{"id":1}}' });
    }
    log.off.push(url);
    return route.abort();
  });
  return { ctx, page, log };
}

async function noHScroll(page) { return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); }

(async () => {
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});

  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px (fixtures) ==`);
    const { ctx, page, log } = await setup(browser, width, { kitTag: '12345' });
    await page.goto(ORIGIN + '/eats/');

    // Static content / SEO
    check((await page.title()).includes('NYC Restaurant'), 'title set');
    check(await page.locator('meta[name=description]').getAttribute('content').then((c) => c.length > 80), 'meta description');
    check(await page.locator('meta[property="og:image"]').count() === 1 && await page.locator('meta[property="og:title"]').count() === 1, 'OG tags');
    check(await page.locator('footer').innerText().then((t) => /Not affiliated with NYC DOHMH/.test(t)), 'disclaimer in footer');
    check(await page.locator('footer a[href="../"]').count() === 1, 'footer link to ../');
    check(await page.locator('#how').innerText().then((t) => /0 to 13/.test(t) && /14 to 27/.test(t) && /28 or more/.test(t) && /Grade Pending/.test(t) && /Critical/.test(t)), 'how-grades section has bands, pending, critical');
    check(await page.locator('#how a[href*="restaurant-grading-faq.pdf"]').count() >= 1, 'cites DOHMH How We Score and Grade');
    check(await noHScroll(page), 'no horizontal scroll (home)');
    check(fs.existsSync(path.join(ROOT, 'eats/og.png')), 'og.png exists');
    await page.screenshot({ path: path.join(OUT, `home-${width}.png`), fullPage: false });

    // Search by name (apostrophe-free typing finds SUNNY'S)
    await page.fill('#q', 'sunnys slice');
    await page.click('#go');
    await page.waitForSelector('#results li');
    check(await page.locator('#results li').count() === 1, 'name search: 1 result');
    check(await page.locator('#results .chip').first().innerText() === 'A', 'result chip shows A');
    check(/q=sunnys/.test(page.url()), 'search in URL');
    check(log.soda.every((u) => /\$limit=\d+/.test(decodeURIComponent(u))), 'every Socrata query has $limit');
    check(log.soda.every((u) => !/app_token|X-App-Token/i.test(u)), 'no app token');
    await page.screenshot({ path: path.join(OUT, `results-${width}.png`) });

    // Detail
    await page.click('#results li button');
    await page.waitForSelector('#detail:not([hidden])');
    check(await page.locator('#badge').innerText() === 'A', 'badge A');
    check(await page.locator('#rc-name').innerText() === "Sunny's Slice", 'name tidied');
    check(/camis=50000001/.test(page.url()), 'camis in URL');
    const facts = await page.locator('#facts').innerText();
    check(/Grade issued\s+Oct 2, 2026/.test(facts), 'grade issued date');
    check(/Data as of\s+Nov 13, 2026/.test(facts), 'data as of');
    check(await page.locator('#history details.ins').count() === 4, '4 inspections listed');
    const dates = await page.locator('#history details.ins summary b').allInnerTexts();
    check(dates.join('|') === 'Oct 2, 2026|Sep 15, 2025|Aug 20, 2025|Aug 1, 2024', 'most recent first: ' + dates.join(', '));
    check(await page.locator('#history details.ins').first().getAttribute('open') !== null, 'latest inspection expanded');
    const v1 = await page.locator('#history details.ins').first().innerText();
    check(/02G/.test(v1) && /CRITICAL/i.test(v1) && /Cold food was being kept warmer/.test(v1) && /Official text: Cold TCS food item held above 41/.test(v1), 'violation: code, critical flag, plain summary, official text');
    check(/10F/.test(v1) && /Not critical/i.test(v1), 'non-critical flag shown');
    check(await page.locator('#chart svg circle').count() === 4, 'timeline has 4 points');
    check(await page.locator('#chart svg circle[fill="var(--sheet)"]').count() === 1, 'one hollow (ungraded) point');
    check(/one inspection on one day/.test(await page.locator('.snap').innerText()), 'snapshot caveat shown');
    check(await noHScroll(page), 'no horizontal scroll (detail)');
    await page.screenshot({ path: path.join(OUT, `detail-${width}.png`), fullPage: true });

    // Share card
    await page.click('#share');
    await page.waitForSelector('#cardwrap:not([hidden])');
    const card = await page.evaluate(() => {
      const c = document.getElementById('card'); const x = c.getContext('2d');
      const px = (X, Y) => Array.from(x.getImageData(X, Y, 1, 1).data);
      // footer band should contain light text pixels
      const f = x.getImageData(80, c.height - 150, 700, 150).data; let light = 0;
      for (let i = 0; i < f.length; i += 4) if (f[i] + f[i + 1] + f[i + 2] > 600) light++;
      return { w: c.width, h: c.height, top: px(5, 5), paper: px(40, 300), footerLight: light, url: c.toDataURL('image/png') };
    });
    check(card.w === 1080 && card.h === 1350, 'card is 1080x1350');
    check(card.top.slice(0, 3).join() === '31,107,74', 'card top strip uses A color');
    check(card.footerLight > 500, 'card footer has text');
    fs.writeFileSync(path.join(OUT, `card-A-${width}.png`), Buffer.from(card.url.split(',')[1], 'base64'));
    // Save image downloads a PNG
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#card-save')]);
    const dlPath = path.join(OUT, `download-${width}.png`); await dl.saveAs(dlPath);
    const sz = pngSize(fs.readFileSync(dlPath));
    check(sz.w === 1080 && sz.h === 1350 && /^report-card-sunny-s-slice\.png$/.test(dl.suggestedFilename()), 'download 1080x1350 ' + dl.suggestedFilename());
    // Copy link
    await page.click('#copy');
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    check(clip.startsWith("Before you go: Sunny's Slice got an A") && clip.includes('lanternlab2027.github.io/lab/eats/?camis=50000001'), 'copy link text: ' + clip.slice(0, 60));

    // Kit signup
    check(await page.locator('#alert').isVisible(), 'alert signup visible when tag configured');
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /You're in/.test(document.getElementById('signup-msg').textContent));
    const kb = JSON.parse(log.kit[0].body);
    check(/\/v3\/tags\/12345\/subscribe$/.test(log.kit[0].url), 'Kit tag subscribe URL');
    check(kb.email === 'test@example.com' && kb.fields && kb.fields.restaurant_camis === '50000001' && typeof kb.api_key === 'string' && kb.api_key.length > 10 && Object.keys(kb.fields).length === 1, 'Kit body: email + restaurant_camis only (+ api_key)');

    // Back to results
    await page.click('#back');
    await page.waitForSelector('#results-sec:not([hidden])');
    check(await page.locator('#detail').isHidden(), 'back returns to results');

    // Deep links for other scenarios
    const scen = [
      ['50000002', /Grade\s*Pending/, /Grade Pending \(code Z\)/, 'Z'],
      ['50000003', /Not yet\s*graded/, /Not Yet Graded \(code N\)/, 'N'],
      ['50000004', /^A$/, /Grade A/, 'A'],
      ['50000005', /Grade\s*Pending/, /code P/, 'P'],
      ['50000006', /^C$/, /Grade C/, 'C']
    ];
    for (const [camis, badgeRe, labelRe, g] of scen) {
      await page.goto(ORIGIN + '/eats/?camis=' + camis);
      await page.waitForSelector('#detail:not([hidden])');
      const b = (await page.locator('#badge').innerText()).trim();
      check(badgeRe.test(b) && labelRe.test(await page.locator('#glabel').innerText()), `deep link ${camis}: ${g}`);
      if (camis === '50000004') check(/Jul 13, 2026 scored 20 points/.test(await page.locator('#notes').innerText()), 'cycle note for newer ungraded initial');
      if (camis === '50000006') check(/B range/.test(await page.locator('#notes').innerText()), 'mismatch note');
      if (camis === '50000003') check(/No inspections on record/.test(await page.locator('#history').innerText()), 'no history for new restaurant');
      if (camis === '50000002' || camis === '50000003') {
        await page.click('#share');
        const u = await page.evaluate(() => document.getElementById('card').toDataURL('image/png'));
        fs.writeFileSync(path.join(OUT, `card-${g}-${width}.png`), Buffer.from(u.split(',')[1], 'base64'));
      }
      check(await page.locator('#back').isHidden(), 'no back button on direct deep link');
    }
    await page.goto(ORIGIN + '/eats/?camis=50000004');
    await page.waitForSelector('#detail:not([hidden])');
    await page.click('#share');
    const longCard = await page.evaluate(() => document.getElementById('card').toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, `card-longname-${width}.png`), Buffer.from(longCard.split(',')[1], 'base64'));

    // Address search + borough filter, and no-results path
    await page.goto(ORIGIN + '/eats/');
    await page.fill('#q', '30-65 14th St');
    await page.click('#go');
    await page.waitForSelector('#results li');
    check(/Harbor Noodle House/.test(await page.locator('#results').innerText()), 'address search finds Harbor Noodle House');
    await page.fill('#q', 'pizza');
    await page.selectOption('#boro', 'Queens');
    await page.click('#go');
    await page.waitForFunction(() => /No restaurants found/.test(document.getElementById('status').textContent));
    check(true, 'no-results message with borough filter');
    await page.fill('#zip', '123');
    await page.click('#go');
    check(/5 digits/.test(await page.locator('#status').innerText()), 'ZIP validation');

    check(log.errs.length === 0, 'no console errors' + (log.errs.length ? ': ' + log.errs.join(' | ') : ''));
    check(log.off.length === 0, 'no requests to other hosts (no tracking)' + (log.off.length ? ': ' + log.off.join(', ') : ''));
    await ctx.close();
  }

  console.log('\n== signup hidden while tag is a placeholder; 429 handling ==');
  {
    const { ctx, page, log } = await setup(browser, 390, { sodaStatus: 429 });
    await page.goto(ORIGIN + '/eats/?q=sunny');
    await page.waitForFunction(() => /too many requests/.test(document.getElementById('status').textContent));
    check(true, '429 shows a friendly message');
    await ctx.close();
    const s2 = await setup(browser, 390);
    await s2.page.goto(ORIGIN + '/eats/?camis=50000001');
    await s2.page.waitForSelector('#detail:not([hidden])');
    check(await s2.page.locator('#alert').isVisible(), 'alert signup visible with real Kit tag');
    await s2.ctx.close();
  }

  if (LIVE) {
    console.log('\n== live smoke (real NYC Open Data, CORS from ' + ORIGIN + ') ==');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
    const acao = [];
    page.on('response', (r) => { if (r.url().startsWith(SODA)) acao.push(r.headers()['access-control-allow-origin']); });
    await ctx.route('https://api.convertkit.com/**', (r) => r.abort());
    await page.goto(ORIGIN + '/eats/');
    await page.fill('#q', "katz's delicatessen");
    await page.selectOption('#boro', 'Manhattan');
    await page.click('#go');
    try {
      await page.waitForSelector('#results li', { timeout: 30000 });
      const n = await page.locator('#results li').count();
      check(n >= 1, 'live search returned ' + n + ' result(s)');
      check(acao.length > 0 && acao.every((v) => v === '*'), 'Socrata sent Access-Control-Allow-Origin: * (' + acao.join(',') + ')');
      await page.click('#results li button');
      await page.waitForSelector('#detail:not([hidden])', { timeout: 30000 });
      const badge = (await page.locator('#badge').innerText()).replace(/\s+/g, ' ');
      const ins = await page.locator('#history details.ins').count();
      const asof = await page.locator('#asof').innerText();
      check(ins >= 1 && badge.length >= 1, `live detail: badge "${badge}", ${ins} inspections`);
      check(/as of \w+ \d+, 20\d\d/.test(asof), 'live data-as-of: ' + asof.match(/as of [^.]+/)[0]);
      await page.click('#share');
      const u = await page.evaluate(() => document.getElementById('card').toDataURL('image/png'));
      fs.writeFileSync(path.join(OUT, 'card-live.png'), Buffer.from(u.split(',')[1], 'base64'));
      await page.screenshot({ path: path.join(OUT, 'live-detail-390.png'), fullPage: true });
    } catch (e) { check(false, 'live smoke: ' + e.message.split('\n')[0] + ' / status: ' + await page.locator('#status').innerText()); }
    check(errs.length === 0, 'live: no page errors');
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
