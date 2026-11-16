// Playwright end-to-end test for docs/ballot/ (Awards-Night Ballot Pool), at 390px and 1280px.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/ballot/test_page.js <screenshot dir>
// Covers: SEO/CSP/naming, show list, print (CSS print + PDF page count), host creates a pool, three players in separate
// browsers, a forged link, leaderboard vs. the demo results (partial, then refreshed to final), awards cards,
// the "My ballot" card, a closed (pre-nominations) show, the late flag, ?ref passthrough and the Kit stub.
// The Kit key is never printed.
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const B = require('../../docs/ballot/ballot.js');
const C = require('../../docs/ballot/codec.js');

const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8852, ORIGIN = 'http://127.0.0.1:' + PORT, URL0 = ORIGIN + '/ballot/';
const server = require('./serve.js')(PORT);
const DOCS = path.join(__dirname, '../../docs/ballot');
const KEY = /KIT_KEY = "([^"]+)"/.exec(fs.readFileSync(path.join(__dirname, '../../docs/eats/kit.js'), 'utf8'))[1];
const DEMO = B.validateShow(JSON.parse(fs.readFileSync(path.join(DOCS, 'shows/demo.json'), 'utf8'))).show;
const FULL = JSON.parse(fs.readFileSync(path.join(DOCS, 'results/demo.json'), 'utf8'));
const PARTIAL = { show: 'demo', updated: 'test partial', final: false, winners: Object.fromEntries(Object.entries(FULL.winners).slice(0, 4)), tiebreak: {} };

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const pngSize = (b) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
const MARKS = /oscar|academy award|grammy|golden globe|emmy|\bsag\b|statuette/i;

async function newCtx(browser, width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, deviceScaleFactor: width === 390 ? 2 : 1, ...opts });
  const offOrigin = [], kit = [];
  ctx.results = null;
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('https://api.convertkit.com/')) { kit.push({ url: u, body: route.request().postData() }); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"subscription":{}}' }); }
    if (!u.startsWith(ORIGIN + '/')) { offOrigin.push(u); return route.abort(); }
    if (ctx.results && /results\/demo\.json/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ctx.results) });
    return route.continue();
  });
  ctx.offOrigin = offOrigin; ctx.kit = kit;
  return ctx;
}
async function open(ctx, url) {
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') page.errs.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('html[data-ready]');
  return page;
}
async function pdfPages(page, format) {
  const buf = await page.pdf({ format, printBackground: true });
  return { n: (await PDFDocument.load(buf)).getPageCount(), buf };
}
async function savePng(page, selector) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
  const p = await dl.path();
  return { buf: fs.readFileSync(p), name: dl.suggestedFilename() };
}
// choose(ci, n) -> nominee index for category ci with n nominees
async function fillAsPlayer(page, name, tb, choose) {
  const n = await page.locator('#cats fieldset').count();
  for (let ci = 0; ci < n; ci++) {
    const k = choose(ci, await page.locator(`#cat-${ci} input`).count());
    if (k >= 0) await page.locator(`#cat-${ci} label.nom`).nth(k).click();
  }
  await page.fill('#pname', name);
  await page.fill('#tb', String(tb));
  await page.click('#finish');
  await page.waitForSelector('#mylink:not([hidden])');
  return page.inputValue('#mylink-url');
}
const winIx = (ci) => DEMO.categories[ci].nominees.findIndex((x) => x.name === FULL.winners[DEMO.categories[ci].id]);

(async () => {
  const browser = await chromium.launch();
  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px ==`);
    const tag = `-${width}`;

    // ---------------- home
    const hctx = await newCtx(browser, width);
    const home = await open(hctx, URL0);
    const csp = await home.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    check(/default-src 'none'/.test(csp) && /script-src 'self';/.test(csp) && /connect-src 'self' https:\/\/api\.convertkit\.com;/.test(csp), 'strict CSP (self + Kit only)');
    const title = await home.title(), desc = await home.getAttribute('meta[name="description"]', 'content');
    check(/printable awards ballot 2027/i.test(title) && /awards night ballot pool/i.test(title), `SEO title: ${title}`);
    check(/printable awards ballot for 2027/i.test(desc) && /awards night ballot pool/i.test(desc) && /bragging rights/i.test(desc), 'meta description has both phrases + bragging rights');
    const head = await home.evaluate(() => document.title + ' ' + [...document.querySelectorAll('meta')].map((m) => m.content).join(' ') + ' ' + document.querySelector('h1').textContent + ' ' + document.querySelector('script[type="application/ld+json"]').textContent);
    check(!MARKS.test(head), 'no awards trademarks in title, meta, JSON-LD or h1');
    const body = await home.evaluate(() => [...document.body.children].filter((e) => e.id !== 'more-apps').map((e) => e.innerText || '').join('\n'));
    check(!MARKS.test(body), 'no awards trademarks anywhere in the visible page');
    check(!/\b(bet|bets|betting|wager|gambl\w*|odds|sportsbook|cash|prize money|buy-in|payout|jackpot)\b/i.test(body.replace(/no money, no entry fees, no prizes/gi, '')), 'no betting or money language');
    check(/Not affiliated with any awards organization/.test(body) && /bragging rights/i.test(body), '"Not affiliated with any awards organization" + "bragging rights"');
    check(/ballot\/og\.png$/.test(await home.getAttribute('meta[property="og:image"]', 'content')) && fs.existsSync(path.join(DOCS, 'og.png')), 'OG image set and present');
    check(await home.locator('footer a[href="../"]').count() >= 1 && await home.locator('footer a[href="../apps/"]').count() === 1, 'footer links to ../ and ../apps/');
    check(await home.getAttribute('#more-apps', 'data-from') === 'ballot' && await home.locator('link[href="../apps/more.css"]').count() === 1 && await home.locator('#more-apps a').count() === 3, 'cross-promo strip (data-from="ballot") renders 3 picks');
    check(/Make yours:/.test(await home.textContent('footer')), '"Make yours" footer');
    check(await home.locator('#shows .show').count() === 4, 'four shows listed');
    const filmCard = await home.textContent('#shows [data-show="film-2027"]');
    check(/Nominations announced Thu, Jan 21, 2027; ballots open then\./.test(filmCard) && /Mar 14, 2027/.test(filmCard), 'film show: "Nominations announced Thu, Jan 21, 2027; ballots open then."');
    check(/Feb 7, 2027/.test(await home.textContent('#shows [data-show="music-2027"]')) && /Jan 10, 2027/.test(await home.textContent('#shows [data-show="globes-2027"]')), 'music Feb 7 and film+TV Jan 10 shown');
    check(/Demo/.test(await home.textContent('#shows [data-show="demo"] .badge.demo')), 'demo show labelled Demo');
    check(await home.isVisible('#remind'), 'Kit box visible with the real tag');
    check(await home.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal page scroll');
    await home.screenshot({ path: path.join(OUT, `home${tag}.png`) });
    await home.screenshot({ path: path.join(OUT, `home-full${tag}.png`), fullPage: true });

    // ---------------- print (blank film ballot before nominations, then the demo)
    await home.selectOption('#p-show', 'film-2027');
    check(await home.locator('#paper .pc').count() === 24 && await home.locator('#paper .blank').count() === 24 * 5, 'film printable: 24 categories with write-in lines');
    await home.emulateMedia({ media: 'print' });
    const vis = await home.evaluate(() => [...document.querySelectorAll('header, #shows-sec, #create, #how, #faq, footer, #more-apps, #print-sec h2, #print')].filter((e) => e.getClientRects().length > 0).length);
    check(vis === 0, 'print CSS hides everything but the ballot');
    check(await home.evaluate(() => getComputedStyle(document.getElementById('paper')).maxHeight === 'none'), 'print shows the whole ballot (no clipping)');
    await home.screenshot({ path: path.join(OUT, `print-media-film${tag}.png`), fullPage: true });
    await home.emulateMedia({ media: null });
    if (width === 1280) {
      let r = await pdfPages(home, 'Letter');
      check(r.n <= 2, `film blank ballot prints on ${r.n} Letter page(s)`);
      fs.writeFileSync(path.join(OUT, 'print-film-letter.pdf'), r.buf);
      await home.selectOption('#p-show', 'demo');
      r = await pdfPages(home, 'Letter');
      check(r.n === 1, 'demo ballot prints on one Letter page');
      r = await pdfPages(home, 'A4');
      check(r.n === 1, 'demo ballot prints on one A4 page');
      fs.writeFileSync(path.join(OUT, 'print-demo-a4.pdf'), r.buf);
    }

    // ---------------- ?ref passthrough
    const rctx = await newCtx(browser, width);
    for (const [inRef, outRef] of [['', 'share'], ['tiktok', 'share-tiktok'], ['share', 'share2'], ['share2-tiktok', 'share3-tiktok']]) {
      const pg = await open(rctx, URL0 + (inRef ? '?ref=' + inRef : ''));
      await pg.selectOption('#c-show', 'demo'); await pg.click('#create-form button[type=submit]');
      await pg.waitForSelector('#pool-made:not([hidden])');
      check(new URL(await pg.inputValue('#pool-url')).searchParams.get('ref') === outRef, `?ref=${inRef || '(none)'} -> ref=${outRef}`);
      await pg.close();
    }

    // ---------------- host creates a pool on the demo show
    const host = await open(hctx, URL0 + '?ref=tiktok');
    await host.selectOption('#c-show', 'demo');
    await host.fill('#pool-name', 'Smith Family Awards Night');
    await host.check('#r-weighted');
    check(await host.inputValue('#c-tb') === 'runtime', 'default tiebreaker is the show preset');
    await host.click('#create-form button[type=submit]');
    await host.waitForSelector('#pool-made:not([hidden])');
    const poolUrl = await host.inputValue('#pool-url'), stUrl = await host.inputValue('#pool-st-url');
    check(/#p=[zt]/.test(poolUrl) && /ref=share-tiktok/.test(poolUrl) && /#s=/.test(stUrl), 'pool link + leaderboard link made (with ref=share-tiktok)');
    const poolD = await C.decode(new URL(poolUrl).hash);
    check(poolD.pool.name === 'Smith Family Awards Night' && poolD.pool.rules === 'weighted' && poolD.pool.tbKey === 'runtime' && poolD.pool.show === 'demo', 'pool link holds name, weighted rules, tiebreaker, show');
    await host.screenshot({ path: path.join(OUT, `pool-created${tag}.png`) });

    // ---------------- three players, each in their own browser
    const p1ctx = await newCtx(browser, width), p2ctx = await newCtx(browser, width), p3ctx = await newCtx(browser, width);
    const p1 = await open(p1ctx, poolUrl);
    check(await p1.isVisible('#fill') && await p1.locator('#cats fieldset').count() === 8, 'player sees the demo ballot (8 categories)');
    check(/demo/i.test(await p1.textContent('#ph-meta')) && /\(Demo\)/.test(await p1.textContent('#cats')), 'ballot is clearly labelled demo');
    check(/3 pts/.test(await p1.textContent('#cat-0 legend')), 'weighted pool shows category points');
    await p1.screenshot({ path: path.join(OUT, `player1-fill${tag}.png`) });
    // Ana: right on everything except director; Ben: first nominee everywhere; Cy: last nominee, skips one
    const ana = await fillAsPlayer(p1, 'Ana', 210, (ci, n) => (ci === 1 ? (winIx(ci) + 1) % n : winIx(ci)));
    await p1.screenshot({ path: path.join(OUT, `player1-link${tag}.png`) });
    check(await p1.isHidden('#late-msg'), 'no lock -> not late');
    const card = await savePng(p1, '#mylink-img');
    check(pngSize(card.buf).w === 1080 && pngSize(card.buf).h === 1350 && /^my-ballot-ana\.png$/.test(card.name), '"My ballot" card is 1080x1350 PNG');
    fs.writeFileSync(path.join(OUT, `card-my-ballot${tag}.png`), card.buf);
    const p2 = await open(p2ctx, poolUrl);
    const ben = await fillAsPlayer(p2, 'Ben', 250, () => 0);
    const p3 = await open(p3ctx, poolUrl);
    const cy = await fillAsPlayer(p3, 'Cy', 190, (ci, n) => (ci === 7 ? -1 : n - 1));
    check(/1 category skipped/.test(await p3.textContent('#finish-msg')), 'skipped category noted');
    // draft survives a reload
    const p3b = await open(p3ctx, poolUrl);
    check(await p3b.inputValue('#pname') === 'Cy' && await p3b.locator('#cats label.nom.on').count() === 7, 'draft picks kept on this device');
    // forged link: Ben's link with a changed pick (no valid checksum)
    const bd = await C.decode(new URL(ben).hash);
    const forgedEntry = Object.assign({}, bd.entry, { name: 'Forger', picks: DEMO.categories.map((c, ci) => winIx(ci)) });
    const forged = URL0 + '#' + await C.encodeEntry(bd.pool, forgedEntry);
    // late ballot: same pool but made after a lock -> a separate pool with a lock in the past
    // a ballot for another pool
    const otherPool = C.makePool({ name: 'Other', show: 'demo' });
    const other = URL0 + '#' + await C.encodeEntry(otherPool, C.makeEntry(otherPool, { name: 'Zed', picks: B.emptyPicks(DEMO).map(() => 0), time: Date.now(), rev: 1 }));

    // ---------------- entry page
    const ep = await open(p2ctx, ana);
    check(await ep.isVisible('#entry') && /Ana's ballot/.test(await ep.textContent('#entry-h')), 'picks link opens as Ana\'s ballot');
    check(await ep.locator('#entry-picks li.ok').count() === 7 && await ep.locator('#entry-picks li.bad').count() === 1, 'entry page marks 7 right, 1 wrong against the demo results');
    await ep.screenshot({ path: path.join(OUT, `entry${tag}.png`) });
    await ep.emulateMedia({ media: 'print' });
    check(await ep.locator('#paper .bx.x').count() === 8 && /Ana/.test(await ep.textContent('#paper .lines')), 'printing an entry marks its picks and name');
    await ep.screenshot({ path: path.join(OUT, `print-entry${tag}.png`), fullPage: true });
    await ep.emulateMedia({ media: null });

    // ---------------- leaderboard: partial results, then refresh to final
    hctx.results = PARTIAL;
    const st = await open(hctx, stUrl);
    check(await st.isVisible('#standings') && /No ballots yet/.test(await st.textContent('#st-table')), 'empty leaderboard');
    await st.fill('#paste', `Ana: ${ana}\nBen says ${ben} thanks!\n${cy}\nForged: ${forged}\nwrong pool ${other}\npool ${poolUrl}`);
    await st.click('#paste-add');
    await st.waitForSelector('#st-table table');
    const pm = await st.textContent('#paste-msg');
    check(/4 added/.test(pm) && /1 from a different pool/.test(pm) && /1 pool link/.test(pm), 'paste: 4 added, other pool skipped, pool link ignored (' + pm + ')');
    check(/4 of 8 winners announced/.test(await st.textContent('#st-status')), 'partial results: 4 of 8 announced');
    const rowsOf = () => st.$$eval('#st-table tbody tr', (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent.trim())));
    const ents = (await C.decode(new URL(st.url()).hash)).entries;
    check(ents.length === 4, 'leaderboard link updated in place with 4 ballots');
    const model = (res) => B.standings(DEMO, poolD.pool, ents, B.readResults(DEMO, res)).rows.map((r) => r.entry.name + ':' + r.score.points);
    let rows = await rowsOf();
    check(rows.map((r) => r[1].replace(/(late|edited link).*$/, '') + ':' + r[2]).join(',') === model(PARTIAL).join(','), 'partial scores match the model: ' + model(PARTIAL).join(','));
    check(rows.some((r) => /Forger/.test(r[1]) && /edited link/.test(r[1])), 'forged link flagged "edited link"');
    await st.screenshot({ path: path.join(OUT, `standings-partial${tag}.png`), fullPage: true });
    hctx.results = FULL;
    await st.click('#refresh');
    await st.waitForFunction(() => /8 of 8 winners announced/.test(document.getElementById('st-status').textContent));
    rows = await rowsOf();
    check(rows.map((r) => r[1].replace(/(late|edited link).*$/, '') + ':' + r[2]).join(',') === model(FULL).join(','), 'after refresh, final scores match the model: ' + model(FULL).join(','));
    check(/Ana/.test(rows[0][1]) && rows[0][0] === '1' && /Forger/.test(rows[rows.length - 1][1]) && rows[rows.length - 1][0] === '-', 'Ana leads; the edited link is listed last, unranked');
    check((await st.$$eval('#st-table td', (t) => t.map((x) => x.textContent))).includes('210off by 4') && /Answer: 214/.test(await st.textContent('#st-flags')), 'tiebreak answer 214 from results, guesses shown as "off by"');
    const awardIds = await st.$$eval('#awards [data-award]', (bs) => bs.map((b) => b.dataset.award));
    check(['oracle', 'upset', 'contrarian'].every((a) => awardIds.includes(a)), 'awards: Oracle, Upset Caller, Contrarian (' + awardIds.join(',') + ')');
    check(!/Forger/.test(await st.textContent('#awards')), 'edited link gets no awards');
    check(/The Oracle:\s*Ana/.test(await st.textContent('#awards')), 'Ana is the Oracle');
    for (const a of ['oracle', 'upset', 'contrarian']) {
      const png = await savePng(st, `#awards [data-award="${a}"]`);
      check(pngSize(png.buf).w === 1080 && pngSize(png.buf).h === 1350, `${a} card is 1080x1350`);
      fs.writeFileSync(path.join(OUT, `card-${a}${tag}.png`), png.buf);
    }
    await st.screenshot({ path: path.join(OUT, `standings-final${tag}.png`), fullPage: true });
    await st.screenshot({ path: path.join(OUT, `standings-fold${tag}.png`) });
    // the ballot card after results shows the score line
    const ep2 = await open(p2ctx, ana);
    const scored = await savePng(ep2, '#entry-img');
    fs.writeFileSync(path.join(OUT, `card-my-ballot-scored${tag}.png`), scored.buf);
    check(pngSize(scored.buf).h === 1350, 'scored ballot card saved');
    // re-pasting the same links changes nothing; a newer ballot from Ben replaces his old one
    await st.fill('#paste', ana + ' ' + ben);
    await st.click('#paste-add');
    check(/2 already in/.test(await st.textContent('#paste-msg')), 're-pasting is a no-op');

    // ---------------- custom tiebreak pool + late flag (lock in the past)
    const lp = C.makePool({ name: 'Late Pool', show: 'demo', rules: 'flat', lock: Date.now() - 3600e3, tbKey: 'custom', tbQ: 'How many speeches thank a pet?' });
    const lpage = await open(p1ctx, URL0 + '#' + await C.encodePool(lp));
    const late = await fillAsPlayer(lpage, 'Dee', 3, () => 1);
    check(await lpage.isVisible('#late-msg'), 'after the lock, the player is told the ballot is late');
    const lst = await open(hctx, URL0 + '#' + await C.encodeStandings(lp, [], null));
    await lst.fill('#paste', late); await lst.click('#paste-add'); await lst.waitForSelector('#st-table table');
    check(/late/.test(await lst.textContent('#st-table')), 'leaderboard flags the late ballot');
    check(await lst.isVisible('#host-tb'), 'custom tiebreak: host answer box shown');
    await lst.fill('#host-tb-in', '5'); await lst.click('#host-tb-set');
    check((await C.decode(new URL(lst.url()).hash)).hostAnswer === 5 && /off by 2/.test(await lst.textContent('#st-table')), 'host answer saved in the link and used');

    // ---------------- a real show before nominations
    const fp = C.makePool({ name: 'Office Movie Night', show: 'film-2027', rules: 'weighted', lock: Date.parse('2027-03-14T23:00:00Z'), tbKey: 'runtime' });
    const fpage = await open(p1ctx, URL0 + '#' + await C.encodePool(fp));
    check(await fpage.isVisible('#fill-closed') && /Nominations announced Thu, Jan 21, 2027; ballots open then\./.test(await fpage.textContent('#fill-closed')), 'film pool before nominations: "ballots open then"');
    check(await fpage.isHidden('#finish'), 'no picks possible before nominees are posted');
    await fpage.screenshot({ path: path.join(OUT, `closed-film${tag}.png`) });

    // ---------------- damaged link
    const bad = await open(p1ctx, URL0 + '#e=' + new URL(ana).hash.slice(3, 40));
    check(await bad.isVisible('#linkerr'), 'damaged link shows an error');

    // ---------------- Kit stub (tag set via test hook)
    const kctx = await newCtx(browser, width);
    await kctx.addInitScript(() => { window.BALLOT_KIT_TAG_TEST = '12345'; });
    const kp = await open(kctx, URL0);
    check(await kp.isVisible('#remind') && /Tell me when ballots open/.test(await kp.textContent('#remind h2')), 'Kit box "Tell me when ballots open" shows once a tag is set');
    await kp.fill('#remind-email', 'test@example.com'); await kp.click('#remind-form button');
    await kp.waitForFunction(() => /You're in/.test(document.getElementById('remind-msg').textContent));
    const kb = JSON.parse(kctx.kit[0].body);
    check(kctx.kit.length === 1 && /\/tags\/12345\/subscribe$/.test(kctx.kit[0].url) && kb.email === 'test@example.com' && kb.api_key === KEY && Object.keys(kb).length === 2, 'Kit gets only the email (key matches eats/kit.js, not printed)');
    if (width === 390) await kp.screenshot({ path: path.join(OUT, `remind${tag}.png`), clip: await kp.locator('#remind').boundingBox().then((b) => ({ x: 0, y: b.y - 10, width: 390, height: b.height + 20 })) });

    // ---------------- hygiene
    const all = [hctx, rctx, p1ctx, p2ctx, p3ctx, kctx];
    check(all.every((c) => c.offOrigin.length === 0), 'no off-site requests ' + all.map((c) => c.offOrigin.join(' ')).join(''));
    const errs = [];
    for (const c of all) for (const pg of c.pages()) if (pg.errs) errs.push(...pg.errs);
    check(errs.length === 0, 'no console errors ' + errs.join(' | '));
    for (const c of all) await c.close();
  }
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
