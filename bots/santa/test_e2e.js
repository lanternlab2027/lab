// End-to-end test for docs/santa/. Kit is routed to a local stub; never hits the real API.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/santa/test_e2e.js <screenshot dir>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = '/home/claude/lab/docs';
const OUT = process.argv[2] || '.';
const PORT = 8771, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); return res.end(); }
    // Simulate a configured Kit tag so the reminder box is exercised (the real file keeps the placeholder).
    if (p === '/santa/index.html') b = Buffer.from(b.toString().replace('"TAGID_SANTA"', '"12345"'));
    res.writeHead(200, {'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream'}); res.end(b);
  });
}).listen(PORT);

const PEOPLE = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Zoë', 'Riley'];
const PAIRS = [['Alex', 'Sam'], ['Jordan', 'Taylor']];
let fails = 0; const check = (c, m) => { console.log((c ? '  ok:   ' : '  FAIL: ') + m); if (!c) fails++; };
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    console.log(`\n[${w}px]`);
    const ctx = await browser.newContext({viewport: {width: w, height: h}, acceptDownloads: true});
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: ORIGIN});
    const offsite = [], kitCalls = [], errs = [];
    ctx.on('request', r => { const u = r.url(); if (!u.startsWith(ORIGIN + '/') && !/^(blob|data):/.test(u)) offsite.push(u); });
    ctx.on('page', p => p.on('pageerror', e => errs.push(String(e))));
    await ctx.route(/convertkit\.com|kit\.com/, async route => {
      kitCalls.push({url: route.request().url(), body: JSON.parse(route.request().postData() || '{}')});
      await route.fulfill({status: 200, contentType: 'application/json', body: '{"subscription":{"id":1}}'});
    });
    const page = await ctx.newPage();
    await page.goto(ORIGIN + '/santa/');
    check(await noHScroll(page), 'organizer page: no horizontal scroll');
    await page.screenshot({path: `${OUT}/santa-${w}-organizer-empty.png`, fullPage: true});

    // Impossible draw: 3 people, one couple.
    const inputs = () => page.locator('#people input');
    await inputs().nth(0).fill('Ann'); await inputs().nth(1).fill('Ben'); await inputs().nth(2).fill('Cy');
    await page.click('#add-excl');
    await page.locator('#excls .excl').nth(0).locator('select').nth(0).selectOption('Ann');
    await page.locator('#excls .excl').nth(0).locator('select').nth(1).selectOption('Ben');
    await page.click('#setup button[type=submit]');
    const err = await page.textContent('#err');
    check(await page.isVisible('#err') && /impossible/.test(err) && await page.isHidden('#results'), 'impossible pairs show a clear error: "' + err.slice(0, 60) + '..."');
    await page.locator('#excls .x').click();
    // Duplicate names.
    await inputs().nth(3).fill('ann');
    await page.click('#setup button[type=submit]');
    check(/listed twice/.test(await page.textContent('#err')), 'duplicate names rejected');

    // Real group: 6 people, paste-to-split, me too, 2 couples.
    for (let i = 0; i < 4; i++) await inputs().nth(i).fill('');
    await inputs().nth(0).fill(PEOPLE[0]);
    await inputs().nth(1).focus();
    await page.evaluate(t => { const dt = new DataTransfer(); dt.setData('text/plain', t); document.querySelectorAll('#people input')[1].dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }, PEOPLE.slice(1).join('\n'));
    const got = await inputs().evaluateAll(els => els.map(e => e.value).filter(Boolean));
    check(JSON.stringify(got) === JSON.stringify(PEOPLE), 'pasting a list splits into rows: ' + got.join(', '));
    await page.fill('#group', 'Smith Family 2026');
    await page.check('#me-too'); await page.selectOption('#me', 'Alex');
    for (const [i, [a, b]] of PAIRS.entries()) {
      await page.click('#add-excl');
      const sels = page.locator('#excls .excl').nth(i).locator('select');
      await sels.nth(0).selectOption(a); await sels.nth(1).selectOption(b);
    }
    await page.fill('#budget', '$30'); await page.fill('#date', '2026-12-19');
    await page.fill('#note', 'Swap at Grandma\'s after dinner. Wrapped, please!');
    await page.screenshot({path: `${OUT}/santa-${w}-organizer-filled.png`, fullPage: true});
    // Capture the draw for verification only (the page itself never displays it).
    await page.evaluate(() => { const d = SantaCore.draw; SantaCore.draw = (...a) => (window.__testDraw = d(...a)); });
    await page.click('#setup button[type=submit]');
    await page.waitForSelector('#results:not(.hidden)');
    const perm = await page.evaluate(() => window.__testDraw);
    const expected = Object.fromEntries(PEOPLE.map((n, i) => [n, PEOPLE[perm[i]]]));
    const resText = await page.innerText('#results');
    check(!/buying for|→|->/i.test(resText), 'results page shows no matches');
    check(await page.isVisible('#remind'), 'reminder box shown (date set)');
    const myHref = await page.getAttribute('#my-link a', 'href');
    check(/\/santa\/go\.html#s1\./.test(myHref) && await page.locator('#links .link-row').count() === 5, 'organizer gets own "Open my link" + 5 rows for others');
    const links = {Alex: myHref};
    for (const rowEl of await page.locator('#links .link-row').all()) {
      const name = await rowEl.locator('b').textContent();
      const sms = decodeURIComponent((await rowEl.locator('a', {hasText: 'Text'}).getAttribute('href')).split('body=')[1]);
      const mail = await rowEl.locator('a', {hasText: 'Email'}).getAttribute('href');
      links[name] = sms.match(/https?:\S+/)[0];
      check(sms.startsWith('Hi ' + name + '!') && mail.startsWith('mailto:?subject=') && decodeURIComponent(mail).includes(links[name]), `${name}: text + email links carry the right URL`);
    }
    const jordan = page.locator('#links .link-row', {hasText: 'Jordan'});
    await jordan.locator('button', {hasText: 'Copy'}).click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    check(clip.includes(links.Jordan) && await jordan.locator('.status').textContent() === 'Copied', 'Copy puts message + link on clipboard and marks row');
    check(Object.values(links).every(u => !PEOPLE.some(n => u.includes(n))), 'no names readable inside any link');
    check(await noHScroll(page), 'results: no horizontal scroll');
    await page.screenshot({path: `${OUT}/santa-${w}-organizer-results.png`, fullPage: true});

    // Each link reveals the right person.
    const revealed = {};
    for (const name of PEOPLE) {
      const p = await ctx.newPage();
      await p.goto(links[name]);
      await p.waitForSelector('#secret:not(.hidden)');
      const who = await p.textContent('#who');
      check(await p.isHidden('#reveal') || !(await p.locator('#reveal.show').count()), `${name}: match hidden until unwrapped`);
      if (name === 'Sam') await p.screenshot({path: `${OUT}/santa-${w}-reveal-gate.png`, fullPage: true});
      await p.click('#unwrap');
      await p.waitForSelector('#reveal.show');
      revealed[name] = await p.textContent('#target');
      const facts = await p.innerText('#facts');
      check(who === name && revealed[name] === expected[name] && /\$30/.test(facts) && /Dec/.test(facts) && /Grandma/.test(facts),
        `${name}: greeting ok, reveals ${revealed[name]}, shows budget/date/note`);
      check(await noHScroll(p), `${name}: no horizontal scroll`);
      if (name === 'Sam') {
        await p.waitForTimeout(500); await p.screenshot({path: `${OUT}/santa-${w}-reveal-confetti.png`});
        await p.waitForTimeout(3200); await p.screenshot({path: `${OUT}/santa-${w}-reveal.png`, fullPage: true});
        const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#cal')]);
        const ics = fs.readFileSync(await dl.path(), 'utf8');
        check(dl.suggestedFilename() === 'secret-santa.ics' && /DTSTART;VALUE=DATE:20261219/.test(ics) && ics.includes('buying for ' + expected.Sam), 'Add to calendar downloads a valid .ics');
        await p.fill('#wish-text', 'Cozy socks (size L)\nhttps://example.com/book');
        await p.click('#wish-go');
        await p.waitForSelector('#wish-out:not(.hidden)');
        const wurl = await p.getAttribute('#wish-acts', 'data-url');
        await p.screenshot({path: `${OUT}/santa-${w}-wishlist-made.png`, fullPage: true});
        const wp = await ctx.newPage(); await wp.goto(wurl); await wp.waitForSelector('#wish:not(.hidden)');
        const wt = await wp.innerText('#wish');
        const a = await wp.getAttribute('#wish-body a', 'href');
        check(/Sam's wishlist/.test(wt) && /Cozy socks/.test(wt) && a === 'https://example.com/book' && !wt.includes(expected.Sam) && await wp.isHidden('#secret'), 'wishlist link shows wishes, links URLs, reveals no match');
        await wp.screenshot({path: `${OUT}/santa-${w}-wishlist-view.png`, fullPage: true}); await wp.close();
      }
      const made = await p.getAttribute('a.made', 'href');
      check(made === './' && /start your own group/.test(await p.textContent('a.made')), `${name}: viral footer links to /santa/`);
      await p.close();
    }
    const receivers = Object.values(revealed);
    check(new Set(receivers).size === 6 && PEOPLE.every(n => revealed[n] !== n), 'everyone gives once and receives once; nobody draws themselves');
    check(PAIRS.every(([a, b]) => revealed[a] !== b && revealed[b] !== a), 'couples never draw each other');

    // Broken link.
    const bp = await ctx.newPage(); await bp.goto(ORIGIN + '/santa/go.html#s1.AAAA.BBBB');
    check(await bp.isVisible('#bad'), 'broken link shows friendly error');
    if (w === 390) await bp.screenshot({path: `${OUT}/santa-${w}-bad.png`, fullPage: true});
    await bp.close();

    check(kitCalls.length === 0, 'no Kit call unless the organizer asks');
    check(offsite.length === 0, 'no requests except same-origin static files ' + offsite.join(', '));

    // Reminder signup (stubbed Kit): only email + date are sent.
    if (w === 390) {
      await page.fill('#signup-email', 'test@example.com'); await page.click('#signup-form button');
      await page.waitForSelector('#remind .note.ok');
      const k = kitCalls[0], body = k && JSON.stringify(k.body);
      check(kitCalls.length === 1 && /\/v3\/tags\/12345\/subscribe$/.test(k.url) && k.body.api_key && k.body.email === 'test@example.com'
        && JSON.stringify(Object.keys(k.body).sort()) === '["api_key","email","fields"]' && k.body.fields.santa_exchange_date === '2026-12-19'
        && JSON.stringify(Object.keys(k.body.fields)) === '["santa_exchange_date"]' && !PEOPLE.concat('Smith').some(n => body.includes(n)),
        'reminder: Kit gets only api_key, email and the date (no names)');
      // Reload restores the sealed links on this device.
      await page.reload(); await page.waitForSelector('#results:not(.hidden)');
      check(await page.getAttribute('#my-link a', 'href') === myHref, 'reload restores the links on this device');
    }
    check(errs.length === 0, 'no page errors ' + errs.join('; '));
    await ctx.close();
  }
  // Placeholder tag: reminder stays hidden in the real file.
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  await p.goto('file://' + ROOT + '/santa/index.html');
  check(/TAGID_SANTA/.test(await p.content()) && await p.getAttribute('#remind', 'data-disabled') === '1', 'unconfigured Kit tag keeps reminder hidden');
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
