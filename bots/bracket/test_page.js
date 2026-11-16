// Playwright end-to-end test for docs/bracket/ (76-Team Bracket), at 390px and 1280px.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/bracket/test_page.js <screenshot dir>
// Covers: SEO/CSP, print (one page, Letter + A4), PDF view, fill, pool create, two players, a tampered link,
// standings against stubbed results, awards cards, the picks picture and the Kit stub. The Kit key is never printed.
const { chromium } = require('playwright');
const GC = require('../analytics/test_helper.js'); // page-view counter stub + beacon checks
const { PDFDocument } = require('pdf-lib');
const fs = require('fs'), path = require('path');
const B = require('../../docs/bracket/bracket.js');
const C = require('../../docs/bracket/codec.js');

const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8842, ORIGIN = 'http://127.0.0.1:' + PORT, URL0 = ORIGIN + '/bracket/';
const server = require('./serve.js')(PORT);
const KEY = /KIT_KEY = "([^"]+)"/.exec(fs.readFileSync(path.join(__dirname, '../../docs/eats/kit.js'), 'utf8'))[1];

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const pngSize = (b) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });

// results fixtures: better seed wins, with a few deterministic upsets
const S = B.build();
function simulate(upTo) {
  let p = B.emptyPicks(), seed = 12345; const win = {};
  for (let g = 0; g < (upTo || 75); g++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const t = B.teamsIn(S, p, g); let side = B.seedOf(S, t[0]) <= B.seedOf(S, t[1]) ? 1 : 2;
    if ((seed >>> 8) % 100 < 25) side = 3 - side;
    p = B.setPick(S, p, g, side); win[S.games[g].code] = S.slots[t[side - 1]].id;
  }
  return { year: 2027, updated: 'test', winners: win, championshipTotal: upTo ? null : 139 };
}
const PARTIAL = simulate(44), FULL = simulate();

async function newCtx(browser, width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, deviceScaleFactor: width === 390 ? 2 : 1, ...opts });
  const offOrigin = [], kit = [];
  ctx.results = null;
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('https://api.convertkit.com/')) { kit.push({ url: u, body: route.request().postData() }); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"subscription":{}}' }); }
    if (!u.startsWith(ORIGIN + '/')) { offOrigin.push(u); return route.abort(); }
    if (ctx.results && /results-2027\.json/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ctx.results) });
    return route.continue();
  });
  ctx.offOrigin = offOrigin; ctx.kit = kit;
  ctx.gc = await GC.stubCounter(ctx); ctx.hashes = []; // GoatCounter -> local 204; game data in #hashes must never reach it
  return ctx;
}
async function open(ctx, url) {
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') page.errs.push(m.text()); });
  if (url.includes('#')) ctx.hashes.push(url.split('#')[1]);
  await page.goto(url);
  await page.waitForSelector('html[data-ready]');
  return page;
}
async function pdfPages(page, format) {
  const buf = await page.pdf({ format, landscape: true, printBackground: true, preferCSSPageSize: false });
  return (await PDFDocument.load(buf)).getPageCount();
}
async function fillAsPlayer(page, name, tb, underdogs) {
  // tap a few games by hand (the first Opening Round game, then its first-round game), then fill the rest
  const first = page.locator('#games button.tm[data-g]').first();
  await first.click();
  if (underdogs) {
    // pick the lower seed (bigger number) in every visible East game, round by round
    for (let k = 0; k < 18; k++) {
      const games = await page.$$eval('#games .game', (gs) => gs.map((g) => {
        const bs = [...g.querySelectorAll('button.tm[data-g]')];
        if (bs.length < 2 || bs.some((b) => b.classList.contains('on'))) return null;
        const seeds = bs.map((b) => +b.querySelector('b').textContent);
        return { g: bs[0].dataset.g, s: seeds[0] > seeds[1] ? 1 : 2 };
      }).filter(Boolean));
      if (!games.length) break;
      await page.click(`#games button.tm[data-g="${games[0].g}"][data-s="${games[0].s}"]`);
      if (await page.$eval('#tabs .tab.on', (t) => !/^East/.test(t.textContent))) break;
    }
  }
  await page.click('#autofill');
  await page.fill('#pname', name);
  await page.fill('#tb', String(tb));
  await page.click('#finish');
  await page.waitForSelector('#mylink:not([hidden])');
  return page.inputValue('#mylink-url');
}

(async () => {
  const browser = await chromium.launch();
  const sizes = {};
  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px ==`);
    const tag = `-${width}`;

    // ---------------- home: SEO, CSP, blank bracket, print
    const hctx = await newCtx(browser, width);
    const home = await open(hctx, URL0);
    const csp = await home.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    check(/default-src 'none'/.test(csp) && /script-src 'self';/.test(csp) && /connect-src 'self' https:\/\/api\.convertkit\.com https:\/\/lanternlab\.goatcounter\.com;/.test(csp), 'strict CSP (self + Kit + page-view counter only)');
    const title = await home.title(), desc = await home.getAttribute('meta[name="description"]', 'content');
    check(/printable 76-team bracket 2027/i.test(title), `SEO title: ${title}`);
    check(/printable 76 team bracket for 2027/i.test(desc) && /bragging rights/i.test(desc), 'meta description has "printable 76 team bracket" + bragging rights');
    const head = await home.evaluate(() => document.title + ' ' + [...document.querySelectorAll('meta')].map((m) => m.content).join(' ') + ' ' + document.querySelector('h1').textContent);
    check(!/march madness|final four|elite eight|sweet 16|sweet sixteen|first four|big dance/i.test(head), 'no NCAA marks in title, meta or h1');
    const body = await home.evaluate(() => [...document.body.children].filter((e) => e.id !== 'more-apps').map((e) => e.innerText || '').join('\n'));
    check(!/\b(bet|bets|betting|wager|gambl|odds|sportsbook|cash|prize money|buy-in)\b/i.test(body.replace(/no money, no entry fees, no prizes/gi, '')), 'no gambling language');
    check(/Not affiliated with the NCAA/.test(body) && /bragging rights/i.test(body), '"Not affiliated with the NCAA" and "bragging rights" shown');
    check(/bracket\/og\.png$/.test(await home.getAttribute('meta[property="og:image"]', 'content')) && fs.existsSync(path.join(__dirname, '../../docs/bracket/og.png')), 'OG image set and present');
    check(await home.locator('footer a[href="../"]').count() >= 1 && await home.locator('footer a[href="../apps/"]').count() === 1, 'footer links to ../ and ../apps/');
    check(await home.getAttribute('#more-apps', 'data-from') === 'bracket' && await home.locator('link[href="../apps/more.css"]').count() === 1, 'cross-promo strip with data-from="bracket"');
    check(/Make yours:/.test(await home.textContent('footer')), '"Make yours" footer');
    check(await home.locator('#sheet svg g.ln[data-g]').count() === 150 && await home.locator('#sheet svg .t-region').count() === 4, 'blank sheet: 150 team lines (75 games) and 4 regions');
    check(await home.isVisible('#remind'), 'Kit box visible with the real tag');
    const sheetOverflow = await home.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    check(sheetOverflow, 'no horizontal page scroll (the sheet scrolls inside its box)');
    await home.screenshot({ path: path.join(OUT, `home${tag}.png`) });
    await home.screenshot({ path: path.join(OUT, `home-full${tag}.png`), fullPage: true });
    await home.emulateMedia({ media: 'print' });
    const vis = await home.evaluate(() => [...document.querySelectorAll('header, #create, #how, #faq, footer, #more-apps, #sheet-h')].filter((e) => getComputedStyle(e).display !== 'none').length);
    check(vis === 0, 'print CSS hides everything but the sheet');
    await home.screenshot({ path: path.join(OUT, `print-media${tag}.png`), fullPage: true });
    await home.emulateMedia({ media: null });
    if (width === 1280) {
      check(await pdfPages(home, 'Letter') === 1, 'prints on exactly one Letter landscape page');
      check(await pdfPages(home, 'A4') === 1, 'prints on exactly one A4 landscape page');
      fs.writeFileSync(path.join(OUT, 'print-blank-letter.pdf'), await home.pdf({ format: 'Letter', landscape: true }));
    }
    // PDF view
    const pv = await open(hctx, URL0 + 'print.html');
    check(await pv.locator('#page svg g.ln').count() === 150, 'PDF view draws the sheet');
    await pv.screenshot({ path: path.join(OUT, `pdfview${tag}.png`) });
    if (width === 1280) {
      check(await pdfPages(pv, 'Letter') === 1, 'PDF view: one Letter page');
      await pv.selectOption('#paper', 'a4');
      check(await pv.evaluate(() => [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => /a4 landscape/i.test(r.cssText)); } catch (e) { return false; } })), 'A4 choice sets @page size');
      check(await pdfPages(pv, 'A4') === 1, 'PDF view: one A4 page');
      fs.writeFileSync(path.join(OUT, 'pdfview-a4.pdf'), await pv.pdf({ format: 'A4', landscape: true }));
    }
    check(pv.errs.length === 0, 'PDF view: no errors ' + pv.errs.join(' | '));

    // ---------------- solo fill
    await home.click('#start-solo');
    await home.waitForSelector('#fill:not([hidden])');
    check(/^#p=/.test(await home.evaluate(() => location.hash)), 'Fill in my bracket opens a solo bracket link');
    check(/East 1/.test(await home.textContent('#games')) || /East 16a/.test(await home.textContent('#games')), 'placeholders like "East 16a" before Selection Sunday');
    await home.locator('#games button.tm[data-g]').first().click();
    check(/1 of 75/.test(await home.textContent('#prog')), 'tapping a team records a pick');
    await home.click('#autofill');
    check(/75 of 75/.test(await home.textContent('#prog')) && /Champion: [A-Za-z]+ 1$/.test(await home.textContent('#champ-pick')), 'autofill finishes the bracket with the better seeds');
    await home.screenshot({ path: path.join(OUT, `fill${tag}.png`) });
    await home.click('#finish');
    check(/Add your name/.test(await home.textContent('#finish-msg')), 'name required before the link');
    await home.fill('#pname', 'Solo Sam'); await home.fill('#tb', '141'); await home.click('#finish');
    const soloUrl = await home.inputValue('#mylink-url');
    check(/\?ref=share#e=z/.test(soloUrl), 'solo bracket link made (with ?ref=share)');
    const dlP = home.waitForEvent('download');
    await home.click('#mylink-img');
    const dl = await dlP; const pick = fs.readFileSync(await dl.path());
    const ps = pngSize(pick);
    check(ps.w === 1080 && ps.h === 1350, 'picks picture is 1080x1350');
    fs.writeFileSync(path.join(OUT, `picks-card${tag}.png`), pick);
    await home.screenshot({ path: path.join(OUT, `fill-done${tag}.png`) });
    check(home.errs.length === 0, 'home/fill: no errors ' + home.errs.join(' | '));

    // ---------------- commissioner creates a pool
    const cctx = await newCtx(browser, width);
    const com = await open(cctx, URL0);
    await com.fill('#pool-name', 'Test Office Pool');
    await com.selectOption('#preset', 'upset');
    check(await com.isChecked('#upset'), 'upset preset turns on the bonus');
    await com.click('#field-own');
    await com.click('#create-form button[type=submit]');
    check(/Paste or type/.test(await com.textContent('#create-msg')), 'own field: empty paste rejected');
    await com.click('#field-off');
    await com.click('#create-form button[type=submit]');
    await com.waitForSelector('#pool-made:not([hidden])');
    const poolUrl = await com.inputValue('#pool-url'), stUrl = await com.inputValue('#pool-st-url');
    check(/#p=/.test(poolUrl) && /#s=/.test(stUrl), 'pool link and standings link created');
    const dp = await C.decode(poolUrl.split('#')[1]);
    check(dp.pool && dp.pool.name === 'Test Office Pool' && dp.pool.rules.upset && dp.pool.lock === Date.UTC(2027, 2, 16, 22), 'pool link holds name, rules and the default lock (Mar 16 6pm ET)');
    await com.locator('#pool-made').screenshot({ path: path.join(OUT, `pool-created${tag}.png`) });

    // ---------------- two players (separate browsers, separate storage)
    const links = [];
    for (const [i, nm, tb, und] of [[1, 'Alex', 150, false], [2, 'Jordan', 128, true]]) {
      const pctx = await newCtx(browser, width);
      const pl = await open(pctx, poolUrl.replace(/^https:\/\/lanternlab2027\.github\.io\/lab\/bracket\//, URL0));
      check(await pl.textContent('#ph-name') === 'Test Office Pool' && /upset bonus/.test(await pl.textContent('#ph-meta')), `player ${i}: sees pool name and rules`);
      const link = await fillAsPlayer(pl, nm, tb, und);
      check(/#e=/.test(link), `player ${i}: got a picks link`);
      links.push(link);
      await pl.screenshot({ path: path.join(OUT, `player${i}${tag}.png`) });
      if (i === 2) {
        const ep = await open(pctx, link);
        check(/Jordan.s picks for/.test(await ep.textContent('#entry-h')) && await ep.isHidden('#entry-bad'), 'player 2: picks page opens, checksum ok');
        await ep.screenshot({ path: path.join(OUT, `entry${tag}.png`) });
        check(ep.errs.length === 0, 'entry page: no errors ' + ep.errs.join(' | '));
      }
      check(pl.errs.length === 0, `player ${i}: no errors ` + pl.errs.join(' | '));
      check(pctx.offOrigin.length === 0, `player ${i}: no off-site requests`);
      GC.checkBeacons(pctx.gc, check, { forbid: pctx.hashes.flatMap((h) => [h, h.slice(0, 16)]) }); // pool link hash never reaches the counter
      await pctx.close();
    }
    const d1 = await C.decode(links[0].split('#')[1]), d2 = await C.decode(links[1].split('#')[1]);
    check(d1.entry.name === 'Alex' && d2.entry.name === 'Jordan' && d1.entry.picks.join() !== d2.entry.picks.join(), 'two different brackets');
    const eastR1 = S.games.filter((g) => g.region === 0 && g.round === 1);
    check(eastR1.filter((g) => d2.entry.picks[g.i] && B.seedOf(S, B.winnerOf(S, d2.entry.picks, g.i)) > 8).length >= 6, 'player 2 picked underdogs in the East by tapping');
    // a tampered link: Alex changes his champion but keeps the old checksum
    const forged = Object.assign({}, d1.entry, { name: 'Alex', picks: B.setPick(S, d1.entry.picks, S.final, 3 - d1.entry.picks[S.final]) });
    const forgedLink = URL0 + '#' + await C.encodeEntry(dp.pool, Object.assign(forged, { name: 'Casey' }));

    // ---------------- standings with partial results
    cctx.results = PARTIAL;
    const st = await open(cctx, stUrl.replace(/^https:\/\/lanternlab2027\.github\.io\/lab\/bracket\//, URL0));
    await st.fill('#paste', `Alex: ${links[0]}\nJordan sent ${links[1]} thanks!\n${forgedLink}\n${URL0}#e=zBROKEN\n${links[0]}`);
    await st.click('#paste-add');
    await st.waitForFunction(() => document.querySelectorAll('#st-table tbody tr').length === 3);
    const msg = await st.textContent('#paste-msg');
    check(/Added 3 entries/.test(msg) && /couldn.t be read/.test(msg), 'paste: 3 added, the broken link reported, the duplicate ignored: ' + msg);
    check(/edited link/.test(await st.textContent('#st-table')) && /changed after it was made/.test(await st.textContent('#st-flags')), 'tampered link flagged "edited link"');
    const R = B.readResults(S, PARTIAL);
    const exp = { Alex: B.score(S, dp.pool.rules, d1.entry.picks, R).points, Jordan: B.score(S, dp.pool.rules, d2.entry.picks, R).points };
    const shown = await st.$$eval('#st-table tbody tr', (rs) => Object.fromEntries(rs.map((r) => [r.children[1].querySelector('a').textContent, +r.children[2].textContent])));
    check(shown.Alex === exp.Alex && shown.Jordan === exp.Jordan, `scores match the model (Alex ${shown.Alex}, Jordan ${shown.Jordan})`);
    check(/Results through 44 of 75/.test(await st.textContent('#st-status')), 'results status shows 44 games');
    check(/#s=/.test(await st.evaluate(() => location.hash)) && (await C.decode((await st.inputValue('#st-url')).split('#')[1])).entries.length === 3, 'standings link updated with all 3 entries');
    await st.screenshot({ path: path.join(OUT, `standings${tag}.png`), fullPage: true });
    check(st.errs.length === 0, 'standings: no errors ' + st.errs.join(' | '));

    // ---------------- final results -> awards
    cctx.results = FULL;
    const st2 = await open(cctx, await st.inputValue('#st-url').then((u) => u.replace(/^https:\/\/lanternlab2027\.github\.io\/lab\/bracket\//, URL0)));
    await st2.waitForSelector('#awards figure');
    const aw = await st2.$$eval('#awards figcaption b', (b) => b.map((x) => x.textContent));
    check(aw.includes('Best Bracket') && aw.length >= 4, 'awards after the title game: ' + aw.join(', '));
    check(!(await st2.textContent('#awards')).includes('Casey'), 'the edited entry gets no award');
    await st2.locator('#awards').screenshot({ path: path.join(OUT, `awards${tag}.png`) });
    const dl2P = st2.waitForEvent('download');
    await st2.locator('#awards button[data-award]').first().click();
    const awardPng = fs.readFileSync(await (await dl2P).path());
    const as = pngSize(awardPng);
    check(as.w === 1080 && as.h === 1350, 'award card picture is 1080x1350');
    fs.writeFileSync(path.join(OUT, `award-card${tag}.png`), awardPng);
    check(st2.errs.length === 0, 'awards: no errors ' + st2.errs.join(' | '));
    check(cctx.offOrigin.length === 0 && hctx.offOrigin.length === 0, 'no off-site requests');
    const beacons = { hits: [cctx, hctx].flatMap((c) => c.gc.hits), other: [cctx, hctx].flatMap((c) => c.gc.other) };
    const hashes = [cctx, hctx].flatMap((c) => c.hashes).flatMap((h) => [h, h.slice(0, 16), decodeURIComponent(h).slice(0, 16)]);
    check(hashes.length > 0, 'hash links were opened (' + hashes.length / 3 + ')');
    GC.checkBeacons(beacons, check, { forbid: hashes });

    // demo preview with the real (empty) results file
    const dctx = await newCtx(browser, width);
    const dm = await open(dctx, await st.inputValue('#st-url').then((u) => u.replace(/^https:\/\/lanternlab2027\.github\.io\/lab\/bracket\//, URL0)));
    check(/No games played yet/.test(await dm.textContent('#st-status')), 'empty results file: "No games played yet"');
    await dm.click('#demo');
    await dm.waitForSelector('#awards figure');
    check(/made-up demo results/.test(await dm.textContent('#st-status')), 'demo preview labelled as made up');
    await dctx.close();

    // ---------------- Kit (stubbed)
    const kctx = await newCtx(browser, width);
    await kctx.addInitScript(() => { window.BRACKET_KIT_TAG_TEST = '424242'; });
    const kp = await open(kctx, URL0);
    check(await kp.isVisible('#remind'), 'Kit box visible with a numeric tag');
    await kp.fill('#remind-email', 'test@example.com');
    await kp.click('#remind-form button');
    await kp.waitForFunction(() => /You.re in/.test(document.getElementById('remind-msg').textContent));
    const sent = kctx.kit[0] ? JSON.parse(kctx.kit[0].body) : {};
    check(kctx.kit.length === 1 && /tags\/424242\/subscribe/.test(kctx.kit[0].url) && sent.email === 'test@example.com' && sent.api_key === KEY && Object.keys(sent).length === 2, 'Kit: one request, email + key only (key matches eats, not printed)');
    await kp.locator('#remind').screenshot({ path: path.join(OUT, `remind${tag}.png`) });
    await kctx.close();
    sizes[width] = { pool: poolUrl.length, entry: links[0].length };
    await hctx.close(); await cctx.close();
  }
  console.log('\nlink lengths', JSON.stringify(sizes));
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
