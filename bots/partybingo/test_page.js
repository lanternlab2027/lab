// Playwright end-to-end test for docs/partybingo/ (Watch-Party Bingo), at 390px and 1280px.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/partybingo/test_page.js <screenshot dir>
// Kit is routed to a local stub; the real API is never hit. The Kit key is never printed.
const { chromium } = require('playwright');
const GC = require('../analytics/test_helper.js'); // page-view counter stub + beacon checks
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const C = require('../../docs/partybingo/codec.js');

const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8833, ORIGIN = 'http://127.0.0.1:' + PORT, URL0 = ORIGIN + '/partybingo/';
const server = require('./serve.js')(PORT);
const EATS_KEY = /KIT_KEY = "([^"]+)"/.exec(fs.readFileSync(path.join(__dirname, '../../docs/eats/kit.js'), 'utf8'))[1];

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const pngSize = (b) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
const scanQR = (pngFile) => execFileSync('python3', ['-I', '-c', 'import sys,cv2\nv,_,_=cv2.QRCodeDetector().detectAndDecode(cv2.imread(sys.argv[1]))\nprint(v)', pngFile]).toString().trim();

async function newCtx(browser, width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, deviceScaleFactor: width === 390 ? 2 : 1, ...opts });
  const offOrigin = [], kit = [];
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('https://api.convertkit.com/')) { kit.push({ url: u, body: route.request().postData() }); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"subscription":{}}' }); }
    if (!u.startsWith(ORIGIN + '/')) { offOrigin.push(u); return route.abort(); }
    return route.continue();
  });
  ctx.offOrigin = offOrigin; ctx.kit = kit;
  ctx.gc = await GC.stubCounter(ctx); ctx.hashes = []; // GoatCounter -> local 204; game data in #hashes must never reach it
  return ctx;
}
async function open(ctx, url) {
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => (GC.fromCounter(e) ? (ctx.gcErrs = (ctx.gcErrs || []).concat(String(e))) : page.errs.push(String(e))));
  page.on('console', (m) => { if (m.type() === 'error') page.errs.push(m.text()); });
  if (url.includes('#')) ctx.hashes.push(url.split('#')[1]);
  await page.goto(url);
  await page.waitForSelector('html[data-ready]');
  return page;
}
const cells = (p) => p.evaluate(() => window.__party.cells.slice());
const tap = (p, i) => p.click(`#grid .sq[data-i="${i}"]`);

(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px ==`);
    const tag = `-${width}`;

    // ---------------- host
    const hctx = await newCtx(browser, width);
    const host = await open(hctx, URL0);
    const csp = await host.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    check(/default-src 'none'/.test(csp) && /script-src 'self'/.test(csp) && /connect-src https:\/\/api\.convertkit\.com https:\/\/lanternlab\.goatcounter\.com;/.test(csp), 'CSP matches the other apps');
    const title = await host.title(), desc = await host.getAttribute('meta[name="description"]', 'content');
    check(/watch-party bingo/i.test(title) && /printable/i.test(title) && /unique card for every guest/i.test(title), `SEO title: ${title}`);
    check(/free printable and phone bingo cards for watch parties/i.test(desc) && /unique card for every guest/i.test(desc), 'meta description has the target phrases');
    const head = await host.evaluate(() => document.title + ' ' + [...document.querySelectorAll('meta')].map((m) => m.content).join(' ') + ' ' + document.querySelector('h1').textContent);
    check(!/super\s*bowl|nfl|oscar|academy award|grammy|emmy/i.test(head), 'no league / event / award trademarks in title, meta or h1');
    check(/partybingo\/og\.png$/.test(await host.getAttribute('meta[property="og:image"]', 'content')) && fs.existsSync(path.join(__dirname, '../../docs/partybingo/og.png')), 'OG image set and present');
    check(await host.locator('footer a[href="../"]').count() >= 1 && await host.locator('footer a[href="../apps/"]').count() === 1, 'footer links to ../ and ../apps/');
    check(await host.locator('#presets .preset').count() === 7, '6 presets + "Write my own"');
    check(await host.isVisible('#notify'), 'signup box visible with the real Kit tag');
    await host.screenshot({ path: path.join(OUT, `host${tag}.png`), fullPage: true });

    // custom list: needs 24
    await host.click('.preset[data-preset="custom"]');
    await host.fill('#game-title', 'Office Party');
    await host.fill('#squares', Array.from({ length: 23 }, (_, i) => `Custom square ${i + 1}`).join('\n'));
    await host.waitForTimeout(250);
    check(await host.isDisabled('#create') && /add 1 more/.test(await host.textContent('#sq-count')), '23 squares: create disabled, "add 1 more"');
    await host.fill('#squares', Array.from({ length: 30 }, (_, i) => `Custom square ${i + 1}`).join('\n'));
    await host.waitForTimeout(250);
    check(await host.isEnabled('#create'), '30 squares: create enabled');
    await host.click('#create');
    const customLink = await host.inputValue('#game-link');
    const cd = await C.decode(customLink.split('#')[1]);
    check(!cd.error && cd.game.title === 'Office Party' && cd.game.squares.length === 30 && cd.game.presetId === '', `custom game link decodes in Node (${customLink.split('#')[1].length}-char hash)`);

    // preset: Big Game
    await host.click('.preset[data-preset="biggame1"]');
    await host.waitForTimeout(200);
    check((await host.inputValue('#game-title')) === 'Big Game Bingo' && (await host.inputValue('#squares')).split('\n').length >= 60, 'Big Game preset fills title and 60+ squares');
    await host.click('#create');
    await host.waitForSelector('#share:not([hidden])');
    const link = await host.inputValue('#game-link');
    const ld = await C.decode(link.split('#')[1]);
    check(!ld.error && ld.game.presetId === 'biggame1', `preset link is short and decodes (${link.length} chars)`);
    check(link.startsWith(URL0 + '?ref=share#g='), '?ref passthrough: no incoming ref -> game link carries ?ref=share before the # (' + link.slice(0, 60) + '...)');
    check((await host.getAttribute('#open-card', 'href')) === URL0 + '#' + link.split('#')[1], '"Open my own card" points at the game (same page, no ref bump)');
    // QR scans back to the link
    const qrPng = path.join(OUT, `qr${tag}.png`);
    fs.writeFileSync(qrPng, Buffer.from((await host.evaluate(() => document.getElementById('qr').toDataURL('image/png'))).split(',')[1], 'base64'));
    check(scanQR(qrPng) === link, 'QR code on the page scans back to the exact game link (OpenCV)');
    const [qdl] = await Promise.all([host.waitForEvent('download'), host.click('#dl-qr')]);
    check(/big-game-bingo-qr\.png/.test(qdl.suggestedFilename()), 'QR download');
    await host.screenshot({ path: path.join(OUT, `share${tag}.png`), fullPage: true });

    // print 5 unique cards
    await host.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await host.fill('#print-n', '5');
    await host.click('#print-btn');
    const printed = await host.evaluate(() => ({ calls: window.__printed, cards: [...document.querySelectorAll('#print .pcard')].map((c) => [...c.querySelectorAll('.pc')].map((x) => x.textContent).join('|')), body: document.body.className }));
    check(printed.calls === 1 && printed.cards.length === 5 && new Set(printed.cards).size === 5 && /printing/.test(printed.body), 'Print: window.print called, 5 cards, all different');
    const sameCards = ld.game && C.printSeeds(ld.game, 5).map((s) => C.deal(ld.game.squares, s).map((x) => x == null ? '★FREE' : x).join('|'));
    check(JSON.stringify(sameCards) === JSON.stringify(printed.cards), 'printed cards match the codec (reprints are identical)');
    await host.emulateMedia({ media: 'print' });
    if (width === 1280) {
      const pdf = await host.pdf({ format: 'Letter', preferCSSPageSize: true, printBackground: true });
      const pdfPath = path.join(OUT, 'print-5-cards.pdf'); fs.writeFileSync(pdfPath, pdf);
      const pages = +(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdfPath]).toString()) || [])[1];
      check(pages === 5, `print PDF has 5 pages (${pages})`);
      execFileSync('pdftoppm', ['-png', '-r', '60', '-f', '1', '-l', '2', pdfPath, path.join(OUT, 'print-page')]);
    }
    await host.screenshot({ path: path.join(OUT, `print-media${tag}.png`) });
    await host.emulateMedia({ media: 'screen' });
    await host.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    check(!(await host.evaluate(() => document.body.classList.contains('printing'))), 'afterprint clears print mode');

    // ---------------- two guests, separate browsers
    const g1ctx = await newCtx(browser, width, { permissions: ['clipboard-read', 'clipboard-write'] });
    const g2ctx = await newCtx(browser, width);
    const g1 = await open(g1ctx, link), g2 = await open(g2ctx, link);
    check(await g1.isVisible('#guest-view') && await g1.isHidden('#host-view'), 'guest sees the card view');
    const c1 = await cells(g1), c2 = await cells(g2);
    check(c1.length === 25 && c1[12] === null && c1.filter(Boolean).every((s) => ld.game.squares.includes(s)), 'guest 1 card: 24 squares from the list + free centre');
    check(JSON.stringify(c1) !== JSON.stringify(c2), 'guest 2 gets a different card');
    const shownText = await g1.$$eval('#grid .sq .tx', (els) => els.map((e) => e.textContent));
    check(shownText.every((t, i) => i === 12 ? /FREE/.test(t) : t === c1[i]), 'board shows the dealt squares');
    await g2.screenshot({ path: path.join(OUT, `guest2${tag}.png`), fullPage: true });
    await g1.reload(); await g1.waitForSelector('html[data-ready]');
    check(JSON.stringify(await cells(g1)) === JSON.stringify(c1), 'refresh keeps the same card (seed in localStorage)');
    const g1b = await open(g1ctx, link);
    check(JSON.stringify(await cells(g1b)) === JSON.stringify(c1), 'a second tab in the same browser shows the same card');
    await g1b.close();

    // ---------------- marking + bingo
    await g1.fill('#my-name', 'Sam');
    await tap(g1, 12);
    check(/always marked/.test(await g1.textContent('#toast')), 'tapping the free space explains it is always marked');
    for (const i of [10, 11, 13]) await tap(g1, i);
    check(await g1.isHidden('#celebrate') && /3 of 24/.test(await g1.textContent('#progress')), 'three in the middle row + free: no bingo yet');
    await tap(g1, 0); await tap(g1, 0); // mark and unmark
    check(!(await g1.evaluate(() => window.__party.marks[0])), 'tap again un-marks');
    await tap(g1, 14);
    await g1.waitForSelector('#celebrate:not([hidden])');
    const sent = await g1.textContent('#cel-text');
    check(new RegExp('^BINGO at \\d{1,2}:\\d{2}(am|pm) with ‘' + c1[14].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '’$').test(sent), `celebration: "${sent}"`);
    check(/1 bingo/.test(await g1.textContent('#progress')), 'progress shows 1 bingo');
    const imgSrc = await g1.getAttribute('#cel-img', 'src');
    const resultPng = Buffer.from(imgSrc.split(',')[1], 'base64');
    check(pngSize(resultPng).w === 1080 && pngSize(resultPng).h === 1350, 'result picture is 1080x1350');
    fs.writeFileSync(path.join(OUT, `result${tag}.png`), resultPng);
    await g1.waitForTimeout(400);
    await g1.screenshot({ path: path.join(OUT, `bingo${tag}.png`) });
    const [rdl] = await Promise.all([g1.waitForEvent('download'), g1.click('#cel-dl')]);
    check(/^bingo-big-game-bingo\.png$/.test(rdl.suggestedFilename()), 'result picture downloads');
    // share fallback (no Web Share in headless): downloads + copies the message
    const [sdl] = await Promise.all([g1.waitForEvent('download'), g1.click('#cel-share')]);
    const clip1 = await g1.evaluate(() => navigator.clipboard.readText());
    check(!!sdl && /^BINGO at .* Check my card: http.*&v=/.test(clip1), 'share fallback: picture downloaded, message + check link copied');
    await g1.click('#cel-copy');
    const checkLink = await g1.evaluate(() => navigator.clipboard.readText());
    const link2 = link.replace('?ref=share#', '?ref=share2#');
    check(checkLink.startsWith(link2 + '&v='), 'check link = game link + &v=, ref bumped to share2 (guest arrived via ref=share)');
    await g1.keyboard.press('Escape');
    check(await g1.isHidden('#celebrate') && await g1.isVisible('#winline') && await g1.isVisible('#share-bingo'), 'Escape closes; win line and "Share my bingo" stay');
    await g1.screenshot({ path: path.join(OUT, `guest1-after${tag}.png`), fullPage: true });
    await tap(g1, 0); await tap(g1, 6); await tap(g1, 18); await tap(g1, 24);
    check(/2 bingos/.test(await g1.textContent('#progress')) && /Another bingo/.test(await g1.textContent('#toast')) && await g1.isHidden('#celebrate'), 'second bingo: toast, no second overlay');
    await g1.reload(); await g1.waitForSelector('html[data-ready]');
    check(/2 bingos/.test(await g1.textContent('#progress')) && /BINGO at/.test(await g1.textContent('#winline')), 'refresh keeps marks and the bingo time');
    const vd = await C.decode(checkLink.split('#')[1]);
    check(!vd.error && JSON.stringify(C.deal(vd.game.squares, vd.verify.seed)) === JSON.stringify(c1) && C.progress(vd.verify.marks).bingos === 1, 'check link decodes in Node to the same card with the bingo');

    // ---------------- check view in a fresh browser
    const vctx = await newCtx(browser, width);
    const v = await open(vctx, checkLink);
    check(JSON.stringify(await cells(v)) === JSON.stringify(c1), 'check link shows the winner\'s exact card');
    check(/BINGO at \d/.test(await v.textContent('#check-banner')) && await v.isHidden('#me-panel'), 'check view: banner with the bingo time, no controls');
    await tap(v, 0);
    check(!(await v.evaluate(() => window.__party.marks[0])), 'check view is read only');
    check((await v.getAttribute('#own-card', 'href')) === link2.split('&v=')[0], '"Get my own card" goes to the plain game link (keeps the incoming ref)');
    await v.screenshot({ path: path.join(OUT, `check${tag}.png`), fullPage: true });
    await v.click('#own-card'); await v.waitForTimeout(300);
    const own = await cells(v);
    check(await v.isVisible('#me-panel') && JSON.stringify(own) !== JSON.stringify(c1), 'then the viewer gets their own, different card');

    // ---------------- new card
    g2.once('dialog', (d) => d.accept());
    await tap(g2, 3);
    await g2.click('#new-card');
    const c2b = await cells(g2);
    check(JSON.stringify(c2b) !== JSON.stringify(c2) && !(await g2.evaluate(() => window.__party.marks[3])), '"Deal me a new card" re-deals and clears marks');

    // ---------------- custom game for a guest
    const cg = await open(g2ctx, customLink);
    const cc = await cells(cg);
    check(await cg.textContent('#g-title') === 'Office Party' && cc.filter(Boolean).every((s) => /^Custom square \d+$/.test(s)), 'custom game opens with its own squares');
    // guest prints from the guest view
    await cg.evaluate(() => { window.print = () => { window.__p = 1; }; });
    await cg.click('#guest-view summary'); await cg.fill('#g-print-n', '3'); await cg.click('#g-print-btn');
    check(await cg.evaluate(() => window.__p === 1 && document.querySelectorAll('#print .pcard').length === 3), 'guest view can print 3 cards too');

    // ---------------- storage blocked
    const sctx = await newCtx(browser, width);
    await sctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
    const s = await open(sctx, link);
    await tap(s, 0);
    check(s.errs.length === 0 && (await cells(s)).length === 25 && await s.evaluate(() => window.__party.marks[0]), 'works with localStorage throwing');
    const sh = await open(sctx, URL0);
    check(sh.errs.length === 0 && await sh.isVisible('#host-view'), 'host view works with storage blocked');
    check(sctx.gc.hits.length === 0, 'page-view counter sends nothing when storage is blocked (fails closed: ' + (sctx.gcErrs || []).length + ' count.js error(s))');

    // ---------------- bad links
    const t = await open(g2ctx, link.slice(0, link.length - 6));
    check(await t.isVisible('#host-view') && /cut off|damaged/.test(await t.textContent('#notice')), 'truncated link: friendly notice, host view');

    // ---------------- ?ref passthrough from an incoming ref
    const rctx = await newCtx(browser, width, { permissions: ['clipboard-read', 'clipboard-write'] });
    const rh = await open(rctx, URL0 + '?ref=tiktok');
    await rh.click('.preset[data-preset="biggame1"]'); await rh.waitForTimeout(200);
    await rh.click('#create'); await rh.waitForSelector('#share:not([hidden])');
    const rlink = await rh.inputValue('#game-link');
    check(rlink === URL0 + '?ref=share-tiktok#' + link.split('#')[1], '?ref=tiktok -> game link carries ?ref=share-tiktok, hash payload unchanged');
    const rqr = path.join(OUT, `qr-ref${tag}.png`);
    fs.writeFileSync(rqr, Buffer.from((await rh.evaluate(() => document.getElementById('qr').toDataURL('image/png'))).split(',')[1], 'base64'));
    check(scanQR(rqr) === rlink, 'QR carries the ref link too');
    const rg = await open(rctx, rlink);
    check(await rg.isVisible('#guest-view') && (await cells(rg)).length === 25, 'guest opens the ref link fine (hash decodes)');
    await rg.click('#share-game'); await rg.waitForTimeout(200);
    const rclip = await rg.evaluate(() => navigator.clipboard.readText());
    check(rclip === URL0 + '?ref=share2-tiktok#' + link.split('#')[1], 'guest "Invite someone" link: ?ref=share2-tiktok + same hash (' + rclip.slice(0, 70) + '...)');
    check((await rg.getAttribute('#host-own', 'href')) === './?ref=share-tiktok', '"Host your own game" keeps the incoming ref');
    fs.unlinkSync(rqr);

    // ---------------- Kit (stubbed)
    const kctx = await newCtx(browser, width);
    await kctx.addInitScript(() => { window.PARTYBINGO_KIT_TAG_TEST = '12345'; });
    const k = await open(kctx, URL0);
    check(await k.isVisible('#notify') && /new preset packs/i.test(await k.textContent('#notify h3')), 'with a numeric tag the "Get new preset packs" box shows');
    await k.fill('#signup-email', 'test@example.com');
    await k.click('#signup-form button');
    await k.waitForSelector('#signup-msg:has-text("You\'re in")');
    const kb = kctx.kit[0] && JSON.parse(kctx.kit[0].body);
    check(kctx.kit.length === 1 && /\/v3\/tags\/12345\/subscribe$/.test(kctx.kit[0].url) && JSON.stringify(Object.keys(kb).sort()) === '["api_key","email"]', 'Kit: tag URL, body is only api_key + email');
    check(kb.api_key === EATS_KEY, 'Kit key matches docs/eats/kit.js (not printed)');

    // ---------------- hygiene
    const all = [hctx, g1ctx, g2ctx, vctx, sctx, kctx, rctx];
    check(all.every((c) => c.offOrigin.length === 0), 'no off-origin requests anywhere (except the stubbed Kit call)');
    const beacons = { hits: all.flatMap((c) => c.gc.hits), other: all.flatMap((c) => c.gc.other) };
    const hashes = all.flatMap((c) => c.hashes).flatMap((h) => [h, h.slice(0, 16), decodeURIComponent(h).slice(0, 16)]);
    check(hashes.length > 0, 'hash links were opened (' + hashes.length / 3 + ')');
    GC.checkBeacons(beacons, check, { forbid: hashes, expect: { t: 'Watch-Party Bingo: Free Printable and Phone Bingo Cards, a Unique Card for Every Guest' } });
    const errs = [host, g1, g2, v, cg, k, rh, rg].flatMap((p) => p.errs);
    check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    for (const c of all) await c.close();
  }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
