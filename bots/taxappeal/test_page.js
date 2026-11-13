// Playwright test for docs/taxappeal/index.html. Kit is routed to a local stub; never hits the real API.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = '/home/claude/lab/docs';
const OUT = process.argv[2] || '.';
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, {'Content-Type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream'}); res.end(b); } });
}).listen(8766);

const CASES = [
  {name: 'queens-a5', addr: '45-46 193rd St', boro: '4'},
  {name: 'brooklyn-b1', addr: '3605 Avenue M', boro: '3'},
  {name: 'queens-b2', addr: '53-45 Metropolitan Ave', boro: '4'},
  {name: 'brooklyn-a5-high', addr: '2132 East 73rd St', boro: '3'},
  {name: 'brooklyn-exempt', addr: '3901 Avenue P', boro: '3'},
];
(async () => {
  const browser = await chromium.launch();
  let fails = 0; const check = (c, m) => { if (!c) { fails++; console.log('  FAIL:', m); } };
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({viewport: {width, height: 900}});
    const page = await ctx.newPage();
    const kitCalls = [];
    await page.route(/convertkit\.com|kit\.com/, async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      kitCalls.push({url: route.request().url(), hasKey: !!body.api_key, email: body.email, fields: body.fields});
      await route.fulfill({status: 200, contentType: 'application/json', body: '{"subscription":{"id":1}}'});
    });
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    for (const c of CASES) {
      await page.goto('http://127.0.0.1:8766/taxappeal/');
      await page.fill('#addr', c.addr); await page.selectOption('#boro', c.boro);
      await page.click('#go');
      await page.waitForFunction(() => /fetched|Couldn't|No DOF|Please|busy/.test(document.querySelector('#status').textContent), null, {timeout: 120000});
      const status = await page.textContent('#status');
      const r = await page.evaluate(() => ({
        h: document.querySelector('.bldg h2')?.textContent, meta: document.querySelector('.bldg .meta')?.textContent,
        tiles: [...document.querySelectorAll('.tile')].map(t => t.innerText.replace(/\n/g, ' | ')),
        big: document.querySelector('.verdict .big')?.textContent, so: document.querySelector('.verdict .so')?.textContent,
        steps: [...document.querySelectorAll('.verdict li')].map(l => l.innerText), ncomp: document.querySelectorAll('.comp').length,
        compsH: [...document.querySelectorAll('h2')].map(h => h.textContent).find(t => /Comparable/.test(t)),
        dl: [...document.querySelectorAll('.cal li')].map(l => l.innerText.replace(/\n/g, ' ')),
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      }));
      console.log(`\n[${width}px] ${c.name}: ${r.h}\n  ${r.meta}\n  status: ${status}`);
      if (width === 1280) { console.log('  tiles:', r.tiles.join(' || ')); console.log('  verdict:', r.big, '-', r.so); r.steps.forEach(s => console.log('   -', s)); console.log('  ', r.compsH, '| cards in DOM:', r.ncomp); r.dl.forEach(d => console.log('   dl:', d)); }
      check(/fetched/.test(status), 'lookup finished');
      check(r.big && ['Looks high', 'In line', 'Looks low', 'Fully exempt'].includes(r.big), 'verdict label present');
      check(r.sw <= r.cw, `no horizontal scroll (${r.sw} > ${r.cw})`);
      await page.screenshot({path: `${OUT}/${c.name}-${width}.png`, fullPage: true});
    }
    // Signup goes to the stub only.
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /You're in|didn't go through/.test(document.querySelector('#signup').innerText), null, {timeout: 10000});
    const k = kitCalls[0];
    console.log(`\n[${width}px] Kit stub calls: ${kitCalls.length}; url ends with ${k && k.url.replace(/^.*\/v3\//, '/v3/')}; api_key present: ${k && k.hasKey}; fields: ${k && JSON.stringify(k.fields)}`);
    check(kitCalls.length === 1 && /tags\/25843567\/subscribe/.test(k.url) && k.fields.bbl, 'kit stub called with tag + bbl');
    check(/You're in/.test(await page.innerText('#signup')), 'success message');
    check(!errs.length, 'no page errors ' + errs.join(';'));
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILURES` : '\nALL CHECKS PASSED');
  process.exit(fails ? 1 : 0);
})();
