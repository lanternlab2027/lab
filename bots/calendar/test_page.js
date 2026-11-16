// Playwright test for docs/calendar/index.html. Kit is routed to a local stub; never hits the real API.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/calendar/test_page.js <screenshot dir>
const { chromium } = require('playwright');
const GC = require('../analytics/test_helper.js'); // page-view counter stub + beacon checks
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = '/home/claude/lab/docs';
const OUT = process.argv[2] || '.';
const TYPES = {'.html': 'text/html', '.png': 'image/png', '.pdf': 'application/pdf'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, {'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream'}); res.end(b); } });
}).listen(8767);

(async () => {
  const browser = await chromium.launch();
  let fails = 0; const check = (c, m) => { console.log((c ? '  ok:   ' : '  FAIL: ') + m); if (!c) fails++; };
  for (const mode of ['kit-ok', 'kit-fail']) {
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    const page = await ctx.newPage();
    const kitCalls = [], external = [];
    page.on('request', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1') && !/convertkit|kit\.com/.test(u) && !GC.isCounter(u)) external.push(u); });
    const gc = await GC.stubCounter(ctx); // GoatCounter -> local 204; checked below
    await page.route(/convertkit\.com|kit\.com/, async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      kitCalls.push({url: route.request().url(), hasKey: !!body.api_key, email: body.email});
      await route.fulfill(mode === 'kit-ok'
        ? {status: 200, contentType: 'application/json', body: '{"subscription":{"id":1}}'}
        : {status: 404, contentType: 'application/json', body: '{"error":"Not Found"}'});
    });
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('http://127.0.0.1:8767/calendar/');
    console.log(`\n[390px, ${mode}]`);
    const dims = await page.evaluate(() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      img: document.querySelector('.preview').naturalWidth, h1: document.querySelector('h1').textContent}));
    check(dims.sw <= dims.cw, `no horizontal scroll (${dims.sw} <= ${dims.cw})`);
    check(dims.img > 0, 'preview image loads');
    check(await page.$('#pdf-link') === null, 'no download link before email entered');
    await page.screenshot({path: `${OUT}/calendar-390-before.png`, fullPage: true});
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForSelector('#pdf-link', {timeout: 10000});
    const k = kitCalls[0];
    check(kitCalls.length === 1 && /\/v3\/tags\/25844349\/subscribe$/.test(k.url) && k.hasKey && k.email === 'test@example.com',
      `Kit stub called once with tag 25844349, api_key present, email (calls: ${kitCalls.length})`);
    const href = await page.getAttribute('#pdf-link', 'href');
    const resp = await page.request.get('http://127.0.0.1:8767/calendar/' + href);
    const buf = await resp.body();
    check(resp.status() === 200 && buf.slice(0, 5).toString() === '%PDF-', `PDF link works (${href}, ${buf.length} bytes)`);
    const txt = await page.innerText('#signup');
    check(mode === 'kit-ok' ? /You're in/.test(txt) : /didn't go through, but the download is yours/.test(txt), 'correct message for ' + mode);
    const after = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    check(after, 'no horizontal scroll after signup');
    check(errs.length === 0, 'no page errors ' + errs.join('; '));
    check(external.length === 0, 'no other external requests ' + external.join(', '));
    GC.checkBeacons(gc, check, { expect: { p: '/calendar/', q: '' } });
    await page.screenshot({path: `${OUT}/calendar-390-${mode}.png`, fullPage: true});
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
