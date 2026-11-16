// Playwright end-to-end test for docs/then/ (NYC Then).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/then/test_page.js <screenshot dir>
// Serves docs/ locally, blocks every off-origin request, stubs Kit.
const { chromium } = require('playwright');
const GC = require('../analytics/test_helper.js'); // page-view counter stub + beacon checks
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../../docs');
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8771, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(b);
  });
}).listen(PORT);

const G = require(path.join(ROOT, 'then/game.js'));
const sched = JSON.parse(fs.readFileSync(path.join(ROOT, 'then/schedule.json'), 'utf8'));
const NOW = new Date('2026-11-20T15:00:00Z'); // NY: Fri Nov 20 2026, 10am => puzzle #7
const TODAY = G.puzzleNumberAt(NOW);
const photoFor = (n) => sched.photos[G.photoIndex(n, sched.photos.length)];

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

async function guess(page, y) {
  await page.fill('#range', String(y));
  check((await page.textContent('#year')) === String(y), 'picker shows ' + y);
  await page.click('#guess');
}

async function run(width, mobile) {
  console.log(`\n== ${width}px ${mobile ? '(mobile, Web Share)' : '(desktop, clipboard)'} ==`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width, height: mobile ? 844 : 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile,
    userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined,
  });
  const thirdParty = [], kitCalls = [];
  let allowKit = false;
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN) || u.startsWith('data:')) return route.continue();
    if (allowKit && u.startsWith('https://api.convertkit.com/')) {
      kitCalls.push({ url: u, body: route.request().postData() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"subscription":{}}' });
    }
    thirdParty.push(u); return route.abort();
  });
  const gc = await GC.stubCounter(ctx); // GoatCounter -> local 204; checked after play
  await ctx.addInitScript(() => {
    window.__shared = []; window.__copied = [];
    if (navigator.clipboard) navigator.clipboard.writeText = (t) => { window.__copied.push(t); return Promise.resolve(); };
    else Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } });
  });
  if (mobile) await ctx.addInitScript(() => { navigator.share = (d) => { window.__shared.push(d.text); return Promise.resolve(); }; });
  const page = await ctx.newPage();
  await page.clock.install({ time: NOW });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(ORIGIN + '/then/');
  await page.waitForSelector('#photo.ready', { timeout: 15000 });
  check(await page.isVisible('#help'), 'help dialog opens on first visit');
  await page.screenshot({ path: path.join(OUT, `then-${width}-0-help.png`) });
  await page.click('#help .ok');
  check(!(await page.isVisible('#help')), 'help closes');
  check((await page.textContent('#num')) === '#' + TODAY, 'puzzle number #' + TODAY + ' for ' + NOW.toISOString());
  const p = photoFor(TODAY);
  const src = await page.getAttribute('#photo', 'src');
  check(src === 'img/' + p.file, 'shows the scheduled photo ' + p.file);
  check(!(await page.content()).includes(String(p.year) + '</'), 'answer year not in DOM before playing');
  await page.screenshot({ path: path.join(OUT, `then-${width}-1-start.png`) });

  // Full game: far miss, warm miss, close miss, borough, then the answer.
  const A = p.year;
  const g1 = A - 25 >= sched.minYear ? A - 25 : A + 25;
  await guess(page, g1);
  check((await page.locator('#rows .row').nth(0).getAttribute('class')).includes('cold'), 'guess 1 cold');
  check((await page.locator('#rows .row').nth(0).textContent()).includes(g1 < A ? 'Later' : 'Earlier'), 'guess 1 higher/lower hint');
  const lo1 = +(await page.getAttribute('#range', 'min')), hi1 = +(await page.getAttribute('#range', 'max'));
  check(g1 < A ? lo1 === g1 + 1 : hi1 === g1 - 1, 'slider narrowed to ' + lo1 + '-' + hi1);
  const g2 = A + 6 <= hi1 ? A + 6 : A - 6;
  await guess(page, g2);
  check((await page.locator('#rows .row').nth(1).getAttribute('class')).includes('warm'), 'guess 2 warm');
  const g3 = A - 2 >= +(await page.getAttribute('#range', 'min')) ? A - 2 : A + 2;
  await guess(page, g3);
  check((await page.locator('#rows .row').nth(2).getAttribute('class')).includes('close'), 'guess 3 close');
  check((await page.textContent('#tries')).startsWith('2 of 5'), 'tries counter');
  await page.screenshot({ path: path.join(OUT, `then-${width}-2-midgame.png`), fullPage: true });
  await page.click(`#boroughs [data-b="${p.borough}"]`);
  check((await page.locator(`#boroughs [data-b="${p.borough}"]`).getAttribute('class')).includes('right'), 'borough marked right');
  check(await page.locator('#boroughs button:not([disabled])').count() === 0, 'borough is one try');
  await guess(page, A);
  await page.waitForSelector('#result:not([hidden])');
  check((await page.textContent('#answer-year')) === String(A), 'answer year revealed');
  check(((await page.textContent('#fact')) || '').length > 20, 'fun fact shown');
  check((await page.getAttribute('#loc-link', 'href')) === p.url, 'LOC credit link ' + p.url);
  check(((await page.textContent('#rights')) || '').startsWith('No known restrictions'), 'rights statement shown');
  const expected = G.shareText(TODAY, [g1, g2, g3, A], A, p.borough, p.borough);
  check((await page.textContent('#share-preview')) === expected, 'share preview text');
  await page.click('#share');
  await page.waitForTimeout(100);
  const got = mobile ? await page.evaluate(() => window.__shared) : await page.evaluate(() => window.__copied);
  check(got.length === 1 && got[0] === expected, (mobile ? 'Web Share' : 'clipboard') + ' got: ' + JSON.stringify(got[0]));
  check(/^NYC Then #\d+ [\u2B1B\u{1F7E7}\u{1F7E8}\u{1F7E9}]{4} 4\/5 \u{1F4CD}\u2705\nlanternlab2027\.github\.io\/lab\/then$/u.test(got[0] || ''), 'share format');
  if (!mobile) check((await page.textContent('#share-msg')).includes('Copied'), 'copied message');
  check(/^\d+:\d\d:\d\d$/.test(await page.textContent('#countdown')), 'countdown to next puzzle');
  await page.screenshot({ path: path.join(OUT, `then-${width}-3-result.png`), fullPage: true });

  // Persistence and stats
  await page.reload();
  await page.waitForSelector('#result:not([hidden])');
  check(!(await page.isVisible('#help')), 'help not shown again');
  check(await page.locator('#rows .row.hit').count() === 1, 'state restored after reload');
  await page.click('#btn-stats');
  check((await page.textContent('#st-played')) === '1' && (await page.textContent('#st-cur')) === '1', 'stats: played 1, streak 1');
  await page.screenshot({ path: path.join(OUT, `then-${width}-4-stats.png`) });
  await page.keyboard.press('Escape');

  // Archive: only days up to today, newest first
  await page.click('#btn-archive');
  const items = await page.locator('#archive-list a').count();
  check(items === TODAY, `archive lists ${items} days (expected ${TODAY})`);
  check((await page.locator('#archive-list a').first().textContent()).includes('#' + TODAY), 'archive newest first');
  await page.screenshot({ path: path.join(OUT, `then-${width}-5-archive.png`) });
  await page.locator('#archive-list a[data-n="2"]').click();
  check((await page.textContent('#num')) === '#2', 'archive opens #2');
  check(await page.isVisible('#archive-note'), 'archive note shown');
  const p2 = photoFor(2);
  check((await page.getAttribute('#photo', 'src')) === 'img/' + p2.file, 'archive photo correct');
  // Lose this one: always guess the edge far from the answer.
  for (let i = 0; i < 5; i++) {
    const lo = +(await page.getAttribute('#range', 'min')), hi = +(await page.getAttribute('#range', 'max'));
    await guess(page, p2.year - lo > hi - p2.year ? lo : hi);
  }
  await page.waitForSelector('#result:not([hidden])');
  check((await page.textContent('#share-preview')).startsWith('NYC Then #2 ') && (await page.textContent('#share-preview')).includes(' X/5'), 'lost game shares X/5');
  check(await page.isVisible('#play-today') && !(await page.isVisible('#next-wrap')), 'archive result offers today');
  await page.click('#btn-stats');
  check((await page.textContent('#st-played')) === '2' && (await page.textContent('#st-cur')) === '1', 'archive loss counts as played, not against streak');
  await page.keyboard.press('Escape');
  // Future puzzle via URL is refused
  await page.goto(ORIGIN + '/then/?n=' + (TODAY + 5));
  await page.waitForSelector('#photo.ready');
  check((await page.textContent('#num')) === '#' + TODAY, 'future ?n= falls back to today');

  // Layout: no horizontal scroll
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  check(sw[0] <= sw[1], 'no horizontal scroll ' + sw.join('/'));

  // Zero third-party requests during play
  check(thirdParty.length === 0, 'zero third-party requests during play' + (thirdParty.length ? ': ' + thirdParty.join(', ') : ''));
  GC.checkBeacons(gc, check); // only page views: no hash, nothing but page-view fields

  // Kit signup (stubbed): exactly api_key + email to 25880799
  allowKit = true;
  await page.fill('#signup-email', 'test@example.com');
  await page.click('#signup-form button');
  await page.waitForFunction(() => /in\./.test(document.querySelector('#signup-form').textContent));
  check(kitCalls.length === 1 && kitCalls[0].url.includes('/tags/25880799/subscribe'), 'Kit called once with 25880799');
  const body = JSON.parse(kitCalls[0] ? kitCalls[0].body : '{}');
  check(JSON.stringify(Object.keys(body).sort()) === '["api_key","email"]' && body.email === 'test@example.com', 'Kit body has only api_key + email');
  const signupText = (await page.textContent('#signup')) || '';
  check(/new photo packs or new city games launch \(a few times a year\)/.test(signupText) && !/tomorrow|inbox|email a day|Daily reminder/i.test(signupText), 'signup copy promises launch news only, no daily email');

  // localStorage blocked: game still playable
  const ctx2 = await browser.newContext({ viewport: { width, height: 800 } });
  await ctx2.route('**/*', (r) => r.request().url().startsWith(ORIGIN) ? r.continue() : (thirdParty.push(r.request().url()), r.abort()));
  await ctx2.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  const pg2 = await ctx2.newPage();
  await pg2.clock.install({ time: NOW });
  const errs2 = []; pg2.on('pageerror', (e) => errs2.push(String(e)));
  await pg2.goto(ORIGIN + '/then/');
  await pg2.waitForSelector('#photo.ready');
  await pg2.click('#help .ok');
  await pg2.fill('#range', String(p.year)); await pg2.click('#guess');
  check(await pg2.isVisible('#result') && errs2.length === 0, 'plays with localStorage blocked');
  await ctx2.close();

  check(errors.length === 0, 'no page/console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
}

(async () => {
  try {
    await run(390, true);
    await run(1280, false);
  } catch (e) { console.error(e); fails++; }
  server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})();
