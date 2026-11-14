// Playwright end-to-end test for docs/awards/ (Fantasy League Awards).
// Run: node bots/awards/make_fixtures.js && NODE_PATH=/opt/npm-tools/node_modules node bots/awards/test_page.js <screenshot dir>
// Sleeper API calls are routed to synthetic fixtures; Kit is stubbed. No real network is used.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const JSZip = require(path.resolve(__dirname, '../../docs/awards/vendor/jszip-3.10.1.min.js'));

const ROOT = path.resolve(__dirname, '../../docs');
const ROUTES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/sleeper_routes.json'), 'utf8'));
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8771, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.md': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(b);
  });
}).listen(PORT);

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const LEAGUE = '1180000000000000001';

async function cards(page) {
  return page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let min = 765, max = 0;
    for (let i = 0; i < d.length; i += 4 * 1009) { const v = d[i] + d[i + 1] + d[i + 2]; min = Math.min(min, v); max = Math.max(max, v); }
    // footer band should contain bright text pixels
    const f = c.getContext('2d').getImageData(300, c.height - 64, 480, 36).data;
    let bright = 0; for (let i = 0; i < f.length; i += 4) if (f[i] + f[i + 1] + f[i + 2] > 600) bright++;
    return { w: c.width, h: c.height, spread: max - min, footerInk: bright, label: c.getAttribute('aria-label') };
  }));
}
async function waitCards(page, n) {
  await page.waitForFunction((k) => document.querySelectorAll('#deck canvas').length === k, n, { timeout: 20000 });
  return cards(page);
}
async function dumpCards(page, prefix) {
  const urls = await page.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => c.toDataURL('image/png')));
  urls.forEach((u, i) => fs.writeFileSync(path.join(OUT, `${prefix}-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
}
function pngSize(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }

(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px ==`);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' && !/Content Security Policy|ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });

    const sleeperCalls = [], kitCalls = [], offOrigin = [];
    await ctx.route('**/*', (route) => {
      const r = route.request(), url = r.url();
      if (url.startsWith(ORIGIN + '/')) return route.continue();
      if (url.startsWith('https://api.sleeper.app/v1/')) {
        const p = url.slice('https://api.sleeper.app/v1'.length).split('?')[0];
        sleeperCalls.push(p);
        const body = Object.prototype.hasOwnProperty.call(ROUTES, p) ? JSON.stringify(ROUTES[p]) : 'null';
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });
      }
      if (url.startsWith('https://api.convertkit.com/')) {
        if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST' } });
        kitCalls.push({ url, body: r.postData() });
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"subscription":{"id":1}}' });
      }
      offOrigin.push(url); return route.abort();
    });

    await page.goto(ORIGIN + '/awards/');
    await page.waitForLoadState('networkidle');
    // SEO / static content
    const meta = await page.evaluate(() => ({
      title: document.title, desc: document.querySelector('meta[name=description]').content,
      og: !!document.querySelector('meta[property="og:image"]') && !!document.querySelector('meta[property="og:title"]'),
      canon: document.querySelector('link[rel=canonical]').href,
      disclaimer: /Not affiliated with Sleeper/.test(document.body.innerText),
      home: !!document.querySelector('footer a[href="../"]')
    }));
    check(/sleeper league awards/i.test(meta.title) && /fantasy football weekly awards/i.test(meta.title + ' ' + meta.desc), 'SEO title/description: ' + meta.title);
    check(meta.og && meta.canon.endsWith('/lab/awards/'), 'OG tags + canonical');
    check(meta.disclaimer && meta.home, 'disclaimer + footer link to ../');
    check(sleeperCalls.length === 0, 'no Sleeper calls before the visitor asks');

    // Unknown user / user with no leagues
    await page.fill('#q', 'nobody_xyz'); await page.click('#go');
    await page.waitForFunction(() => /No Sleeper user/.test(document.querySelector('#status').textContent));
    check(true, 'unknown username -> friendly error');
    await page.fill('#q', 'lonely_larry'); await page.click('#go');
    await page.waitForFunction(() => /No NFL leagues/.test(document.querySelector('#status').textContent));
    check(true, 'user without leagues -> friendly error');

    // Username -> league picker -> awards
    sleeperCalls.length = 0;
    await page.fill('#q', 'dana_r'); await page.click('#go');
    await page.waitForSelector('#leagues button');
    const lg = await page.$$eval('#leagues button', (b) => b.map((x) => x.textContent));
    check(lg.length === 2 && /Sunday Scaries/.test(lg[0]), 'picker lists 2 leagues: ' + lg.join(' | '));
    const before = sleeperCalls.length;
    await page.click('#leagues button >> nth=0');
    let c = await waitCards(page, 8);
    const loadCalls = sleeperCalls.length - before;
    check(loadCalls <= 4 + 2 * 11, `league load used ${loadCalls} Sleeper calls (4 base + 2 per week)`);
    check(c.every((x) => x.w === 1080 && x.h === 1350), 'weekly cards are 1080x1350');
    check(c.every((x) => x.spread > 200), 'weekly cards are not blank');
    check(c.every((x) => x.footerInk > 150), 'every card has footer text');
    const wk = await page.$eval('#week', (s) => ({ v: s.value, opts: [...s.options].map((o) => o.textContent) }));
    check(wk.v === '10' && wk.opts.includes('Week 11 (in progress)'), 'defaults to last final week (10); week 11 marked in progress');
    check(new URL(page.url()).searchParams.get('league') === LEAGUE && new URL(page.url()).searchParams.get('week') === '10', 'URL carries ?league=&week=');
    check(await page.isHidden('#live-note'), 'no live note on a final week');
    const labels = c.map((x) => x.label);
    check(/^Week 10 Awards$/.test(labels[0]) && /^Highest Scorer: /.test(labels[1]), 'card labels: ' + labels.slice(0, 3).join(' / '));
    await dumpCards(page, `w${width}-week10`);
    await page.screenshot({ path: path.join(OUT, `page-${width}-week.png`), fullPage: false });
    await page.locator('#results').screenshot({ path: path.join(OUT, `results-${width}-week.png`) });

    // Recap
    await page.click('#copy');
    await page.waitForFunction(() => /copied/.test(document.querySelector('#copy-status').textContent));
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    check(/Sunday Scaries League: Week 10 awards/.test(clip) && /Highest scorer: /.test(clip) && /lanternlab2027\.github\.io\/lab\/awards/.test(clip), 'recap copied to clipboard');
    if (width === 390) fs.writeFileSync(path.join(OUT, 'recap-week10.txt'), clip);

    // Live week
    await page.selectOption('#week', '11');
    c = await waitCards(page, 8);
    check(await page.isVisible('#live-note'), 'live week shows "still being played" note');
    check(new URL(page.url()).searchParams.get('week') === '11', 'URL week updates');

    // Season tab
    await page.click('#tab-season');
    c = await waitCards(page, 7);
    check(c.every((x) => x.w === 1080 && x.h === 1350 && x.spread > 200 && x.footerInk > 150), 'season cards 1080x1350, not blank, footer present');
    check(await page.isHidden('#week-wrap'), 'week picker hidden on season tab');
    await dumpCards(page, `w${width}-season`);
    await page.click('#copy');
    const clip2 = await page.evaluate(() => navigator.clipboard.readText());
    check(/season so far \(10 weeks\)/.test(clip2) && /Power rankings: 1\. /.test(clip2), 'season recap (live week excluded: 10 weeks)');
    if (width === 390) fs.writeFileSync(path.join(OUT, 'recap-season.txt'), clip2);

    // Downloads
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#deck figure:first-child button:has-text("Save")')]);
    const png = fs.readFileSync(await dl.path()); const sz = pngSize(png);
    check(sz.w === 1080 && sz.h === 1350 && /^awards-season-2026-01-power-rankings\.png$/.test(dl.suggestedFilename()), 'Save PNG: ' + dl.suggestedFilename() + ` ${sz.w}x${sz.h}`);
    const [dz] = await Promise.all([page.waitForEvent('download'), page.click('#zip-all')]);
    const zip = await JSZip.loadAsync(fs.readFileSync(await dz.path()));
    check(Object.keys(zip.files).length === 7, 'zip has 7 PNGs');

    // Layout
    const hs = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(hs <= 0, 'no horizontal page scroll (' + hs + ')');
    await page.screenshot({ path: path.join(OUT, `page-${width}-season.png`), fullPage: true });

    // Kit signup: only api_key, email, fields.league_id; tag placeholder
    await page.fill('#signup-email', 'fan@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /in\./.test(document.querySelector('#signup').textContent));
    check(kitCalls.length === 1 && /\/v3\/tags\/25878869\/subscribe$/.test(kitCalls[0].url), 'one Kit call to 25878869');
    const kb = JSON.parse(kitCalls[0].body);
    check(JSON.stringify(Object.keys(kb).sort()) === '["api_key","email","fields"]' && JSON.stringify(kb.fields) === JSON.stringify({ league_id: LEAGUE }) && kb.email === 'fan@example.com' && typeof kb.api_key === 'string' && kb.api_key.length > 10,
      'Kit body is exactly api_key + email + fields.league_id (key not printed)');

    // CSP blocks other origins
    const csp = await page.evaluate(() => new Promise((res) => {
      document.addEventListener('securitypolicyviolation', (e) => res(e.violatedDirective), { once: true });
      fetch('https://example.com/x').catch(() => {}); setTimeout(() => res('none'), 2000);
    }));
    check(/connect-src/.test(csp), 'CSP blocks third-party fetch (' + csp + ')');

    // Deep link: ?league=&week=5 loads straight away
    sleeperCalls.length = 0;
    await page.goto(ORIGIN + '/awards/?league=' + LEAGUE + '&week=5');
    c = await waitCards(page, 8);
    check((await page.$eval('#week', (s) => s.value)) === '5', 'deep link opens week 5');

    // Paste league ID directly (league URL form)
    await page.click('#reset');
    await page.fill('#q', 'https://sleeper.com/leagues/1180000000000000002/matchup');
    await page.click('#go');
    await page.waitForFunction(() => /Work League/.test(document.querySelector('#lg-name').textContent));
    await waitCards(page, 8);
    check(true, 'pasted league URL loads the league');

    // Sample league: no Sleeper calls
    await page.click('#reset');
    sleeperCalls.length = 0;
    await page.click('#sample');
    c = await waitCards(page, 8);
    check(sleeperCalls.length === 0 && c.every((x) => x.spread > 200), 'sample league renders with zero API calls');
    if (width === 1280) { await page.click('#tab-season'); await waitCards(page, 7); await dumpCards(page, 'sample-season'); await page.click('#tab-week'); await waitCards(page, 8); await dumpCards(page, 'sample-week'); }

    check(offOrigin.filter((u) => !/example\.com/.test(u)).length === 0, 'no requests to other origins: ' + offOrigin.join(', '));
    check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
