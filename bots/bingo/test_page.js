// Playwright end-to-end test for docs/bingo/ (2027 Goal Bingo).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/bingo/test_page.js <screenshot dir>
// Kit is routed to a local stub; the real API is never hit. The Kit key is never printed.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const C = require('../../docs/bingo/codec.js');

const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8811, ORIGIN = 'http://127.0.0.1:' + PORT, URL0 = ORIGIN + '/bingo/';
const server = require('./serve.js')(PORT);

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const st = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__bingoState.card)));

async function download(page, sel) {
  const [d] = await Promise.all([page.waitForEvent('download'), page.click(sel)]);
  const p = path.join(OUT, d.suggestedFilename());
  await d.saveAs(p);
  return { name: d.suggestedFilename(), path: p, size: fs.statSync(p).size };
}
function pngSize(file) { const b = fs.readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }

(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px ==`);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, deviceScaleFactor: width === 390 ? 2 : 1 });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    const offOrigin = [], kitBodies = [];
    await ctx.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith('https://api.convertkit.com/')) { kitBodies.push({ url: u, body: route.request().postData() }); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"subscription":{}}' }); }
      if (!u.startsWith(ORIGIN + '/')) { offOrigin.push(u); return route.abort(); }
      return route.continue();
    });

    // ---- page basics
    await page.goto(URL0);
    await page.waitForLoadState('networkidle');
    check(offOrigin.length === 0, 'page load makes no off-origin requests');
    const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    check(/default-src 'none'/.test(csp) && /script-src 'self'/.test(csp) && /connect-src https:\/\/api\.convertkit\.com;/.test(csp), 'CSP matches the other apps');
    const title = await page.title(), desc = await page.getAttribute('meta[name="description"]', 'content');
    check(/goal bingo/i.test(title) && /2027/.test(title) && /resolution bingo card/i.test(title), `SEO title: ${title}`);
    check(/goal bingo card/i.test(desc) && /new year resolution bingo card/i.test(desc), 'meta description targets both phrases');
    check(/bingo\/og\.png$/.test(await page.getAttribute('meta[property="og:image"]', 'content')) && fs.existsSync(path.join(__dirname, '../../docs/bingo/og.png')), 'OG image set and present');
    check(await page.locator('footer a[href="../"]').count() === 1, 'footer links to ../');
    check(await page.locator('#grid .sq').count() === 25, 'starts with a blank 5x5 card');
    check(/FREE/.test(await page.textContent('#grid .sq[data-i="12"]')), 'free centre shown');

    // ---- create: type a goal, use an idea, fill the rest
    await page.click('#grid .sq[data-i="0"]');
    await page.fill('#goal-input', 'Run a half marathon');
    await page.click('.chip[data-cat="travel"]');
    await page.click('#ideas .idea:has-text("Take a solo trip")');
    let s = await st(page);
    check(s.goals[0] === 'Run a half marathon' && s.goals[1] === 'Take a solo trip', 'typed goal in square 1, tapped idea filled square 2');
    check(await page.locator('#ideas .idea.used:has-text("Take a solo trip")').count() === 1, 'used idea is marked');
    await page.click('#fill-empty');
    s = await st(page);
    check(s.goals.filter((g, i) => i !== 12 && g).length === 24, 'fill empty squares -> all 24 filled');
    check(new Set(s.goals.filter(Boolean)).size === 24, 'no duplicate ideas');
    await page.fill('#title-input', 'Sam’s Big 2027');
    await page.fill('#name-input', 'Sam');

    // ---- edit: change a goal, theme, size round-trip keeps goals
    await page.click('#grid .sq[data-i="6"]');
    await page.fill('#goal-input', 'Learn to make ramen 🍜');
    await page.click('.sw[data-theme="midnight"]');
    await page.click('#size-seg button[data-size="3"]');
    s = await st(page);
    check(s.size === 3 && s.free && s.goals[0] === 'Run a half marathon' && s.theme === 'midnight', '5x5 -> 3x3 keeps first goals, theme and free centre');
    await page.click('#size-seg button[data-size="5"]');
    s = await st(page);
    check(s.size === 5 && s.goals[6] === 'Learn to make ramen 🍜' && s.goals.filter(Boolean).length === 24, '3x3 -> 5x5 restores all goals in place');
    await page.click('#size-seg button[data-size="4"]');
    check((await st(page)).free === false && await page.isHidden('#free-wrap'), '4x4 has no free centre option');
    await page.click('#size-seg button[data-size="5"]');

    // ---- check off
    await page.click('#mode-check');
    check(await page.isHidden('#editor'), 'editor hidden in check mode');
    for (const i of [0, 1, 2, 3]) await page.click(`#grid .sq[data-i="${i}"]`);
    check(/4 of 24 done/.test(await page.textContent('#progress')), 'progress 4 of 24');
    await page.click('#grid .sq[data-i="4"]');
    check(/1 bingo!/i.test(await page.textContent('#progress')), 'full row -> 1 bingo');
    await page.waitForSelector('#toast:not([hidden])');
    check(/BINGO/.test(await page.textContent('#toast')), 'bingo toast shown');
    await page.click('#grid .sq[data-i="18"]'); await page.click('#grid .sq[data-i="18"]');
    check((await st(page)).checked[18] === false, 'tapping again un-checks');
    await page.click('#grid .sq[data-i="12"]');
    check((await st(page)).checked[12] === true, 'free centre cannot be un-checked');
    await page.click('#grid .sq[data-i="7"]');
    await page.waitForTimeout(400);
    const before = await st(page);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal page scroll');
    await page.screenshot({ path: path.join(OUT, `page-${width}.png`), fullPage: width === 1280 });
    await page.locator('#board').screenshot({ path: path.join(OUT, `board-${width}.png`) });

    // ---- the link
    const link = await page.inputValue('#card-link');
    const hash = new URL(link).hash;
    check(link.startsWith(URL0 + '#c=') && page.url() === link, 'address bar and link box hold the card hash');
    check(hash.length < 3000, `link length ${link.length} chars`);
    check(JSON.stringify(C.decode(hash).card) === JSON.stringify(before), 'link decodes (in Node) to exactly the on-page card');
    check(/^mailto:\?subject=/.test(await page.getAttribute('#email-link', 'href')), 'email-it-to-myself link built');

    // reload (same tab)
    await page.reload(); await page.waitForLoadState('networkidle');
    check(JSON.stringify(await st(page)) === JSON.stringify(before), 'reload restores the card from the hash');
    check((await page.getAttribute('#mode-check', 'aria-pressed')) === 'true', 'full card opens in Check off mode');
    // fresh browser, no storage: link alone is enough
    const ctx2 = await browser.newContext({ viewport: { width, height: 900 } });
    const p2 = await ctx2.newPage();
    await p2.goto(link); await p2.waitForLoadState('networkidle');
    check(JSON.stringify(await st(p2)) === JSON.stringify(before), 'link opens the same card in a fresh browser');
    check(/1 bingo/i.test(await p2.textContent('#progress')), 'progress and bingo shown from the link');
    await ctx2.close();
    // bare URL -> localStorage
    await page.goto(URL0); await page.waitForLoadState('networkidle');
    check(JSON.stringify(await st(page)) === JSON.stringify(before), 'bare page URL restores the card from localStorage');

    // ---- downloads
    const pdf = await download(page, '#dl-pdf');
    const head = fs.readFileSync(pdf.path).slice(0, 8).toString();
    check(/^goal-bingo-2027-sam-letter\.pdf$/.test(pdf.name) && head.startsWith('%PDF-1.4') && pdf.size > 100000, `PDF ${pdf.name} (${pdf.size} bytes)`);
    let pdfOk = false;
    try {
      const info = execFileSync('pdfinfo', [pdf.path]).toString();
      pdfOk = /Pages:\s+1/.test(info) && /612 x 792/.test(info);
      if (width === 390) execFileSync('pdftoppm', ['-r', '40', '-png', '-singlefile', pdf.path, path.join(OUT, 'pdf-render')]);
    } catch (e) { pdfOk = false; }
    check(pdfOk, 'PDF is valid: 1 page, US Letter (pdfinfo)');
    const pl = await download(page, '#dl-letter');
    check(pl.size > 200000 && JSON.stringify(pngSize(pl.path)) === '{"w":2550,"h":3300}', `Letter PNG 2550x3300 (${pl.size} bytes)`);
    const pw = await download(page, '#dl-wall');
    check(JSON.stringify(pngSize(pw.path)) === '{"w":1170,"h":2532}', 'wallpaper PNG 1170x2532');
    const ps = await download(page, '#dl-story');
    check(JSON.stringify(pngSize(ps.path)) === '{"w":1080,"h":1920}', 'story PNG 1080x1920');
    const ss = await download(page, '#share-img'); // headless has no file share -> falls back to download
    check(/\.png$/.test(ss.name), 'Share falls back to a download where Web Share is missing');

    // ---- group bingo
    await page.fill('#group-input', 'Book club');
    await page.waitForTimeout(300);
    const groupUrl = await page.evaluate(() => { const c = JSON.parse(JSON.stringify(window.__bingoState.card)); c.title = ''; return location.origin + location.pathname + '#' + BingoCodec.encodeGroup(c); });
    check(!groupUrl.includes(Buffer.from('half marathon').toString('base64url').slice(0, 8)) && !Buffer.from(groupUrl.split('#g=')[1], 'base64url').toString().includes('marathon'), 'group link has no goals');
    const myCard = await page.inputValue('#card-link');
    await page.goto(groupUrl); await page.waitForLoadState('networkidle');
    s = await st(page);
    check(!(await page.isHidden('#group-banner')) && /Book club/.test(await page.textContent('#group-banner')), 'group banner names the group');
    check(s.theme === 'midnight' && s.size === 5 && s.group === 'Book club' && s.goals.every((g) => !g), 'friend gets a blank card in the same theme and size');
    check(/BOOK CLUB|Book club/i.test(await page.textContent('#b-label')), 'group name on the friend’s card');
    check(!(await page.isHidden('#prev-card')), '"Open your previous card" offered (own card kept)');
    await page.screenshot({ path: path.join(OUT, `group-${width}.png`) });
    await page.click('#prev-card');
    check((await page.inputValue('#card-link')) === myCard, 'previous card restored exactly');

    // ---- broken link
    await page.goto(URL0 + '#c=' + myCard.split('#c=')[1].slice(0, 30));
    await page.waitForLoadState('networkidle');
    check(!(await page.isHidden('#notice')) && /cut off/.test(await page.textContent('#notice')), 'truncated link shows a "cut off" notice');
    check((await page.inputValue('#card-link')) === myCard, 'truncated link falls back to the saved card, which is untouched');

    // ---- Kit signup (stubbed)
    await page.goto(URL0); await page.waitForLoadState('networkidle');
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /on the list/.test(document.querySelector('#notify').textContent));
    const kb = kitBodies[0] ? JSON.parse(kitBodies[0].body) : {};
    check(kitBodies.length === 1 && /\/v3\/tags\/25913904\/subscribe$/.test(kitBodies[0].url), 'Kit POST goes to tag 25913904');
    check(JSON.stringify(Object.keys(kb).sort()) === '["api_key","email"]' && kb.email === 'test@example.com' && typeof kb.api_key === 'string' && kb.api_key.length > 10, 'Kit body is only api_key + email (no card data)');
    const readingKey = /var KIT_KEY = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname, '../../docs/reading/app.js'), 'utf8'))[1];
    check(kb.api_key === readingKey, 'Kit key matches the reading app (value not printed)');

    check(offOrigin.length === 0, 'no off-origin requests in the whole run');
    check(errs.length === 0, `no page errors (${errs.join(' | ') || 'none'})`);
    await ctx.close();
  }

  // ---- storage blocked (Safari private mode style): page must still work
  console.log('\n== localStorage throws ==');
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx3.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError'); } }); });
  const p3 = await ctx3.newPage(); const e3 = []; p3.on('pageerror', (e) => e3.push(String(e)));
  await p3.goto(URL0);
  await p3.click('#fill-empty'); await p3.click('#mode-check'); await p3.click('#grid .sq[data-i="0"]');
  await p3.waitForTimeout(400);
  check(e3.length === 0 && /#c=/.test(p3.url()) && /1 of 24/.test(await p3.textContent('#progress')), 'works with storage blocked; hash still saves the card');
  await ctx3.close();

  // ---- CSP blocks exfiltration
  const ctx4 = await browser.newContext(); const p4 = await ctx4.newPage();
  await p4.goto(URL0);
  const blocked = await p4.evaluate(() => fetch('https://example.com/x').then(() => false, () => true));
  check(blocked, 'CSP blocks fetch to any other host');
  await ctx4.close();

  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
