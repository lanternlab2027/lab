// Playwright end-to-end test for docs/chi-eats/ (Chicago Restaurant Report Card).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/chi-eats/test_page.js <screenshot dir> [--no-live]
// Socrata calls are routed to synthetic fixtures (bots/chi-eats/fixtures.js); Kit is stubbed.
// One live smoke query at the end hits the real Chicago Data Portal (and checks CORS) unless --no-live.
// If the network blocks data.cityofchicago.org, the live smoke reports BLOCKED (not counted as an app failure).
'use strict';
const { chromium } = require('playwright');
const GC = require('../analytics/test_helper.js'); // page-view counter stub + beacon checks
const http = require('http'), fs = require('fs'), path = require('path');
const FX = require('./fixtures.js');

const ROOT = path.resolve(__dirname, '../../docs');
const OUT = path.resolve(process.argv[2] || '.');
const LIVE = !process.argv.includes('--no-live');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8782, ORIGIN = 'http://127.0.0.1:' + PORT;
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
const SODA = 'https://data.cityofchicago.org/resource/4ijn-s7e5.json';

// --- Tiny SoQL evaluator for the fixture server (only the clauses the app sends) ---
function likeToRe(p) { return new RegExp('^' + p.split('%').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i'); }
function clause(row, cl) {
  let m;
  cl = cl.trim();
  if ((m = /^\((.*)\)$/.exec(cl))) return m[1].split(/ OR /).some((c) => clause(row, c));
  if ((m = /^upper\((\w+)\) like '(.*)'$/.exec(cl))) return likeToRe(m[2]).test(String(row[m[1]] || ''));
  if ((m = /^(\w+) like '(.*)'$/.exec(cl))) return likeToRe(m[2]).test(String(row[m[1]] || ''));
  if ((m = /^upper\((\w+)\)='(.*)'$/.exec(cl))) return String(row[m[1]] || '').toUpperCase() === m[2].replace(/''/g, "'");
  if ((m = /^(\w+)='(.*)'$/.exec(cl))) return String(row[m[1]] || '') === m[2].replace(/''/g, "'");
  if ((m = /^(\w+) in\((.*)\)$/.exec(cl))) return (m[2].match(/'([^']*)'/g) || []).map((s) => s.slice(1, -1)).includes(String(row[m[1]]));
  throw new Error('fixture server: unsupported clause ' + cl);
}
const matchWhere = (row, where) => !where || where.split(/ AND /).every((cl) => clause(row, cl));
function soda(url) {
  const p = new URL(url).searchParams, where = p.get('$where') || '';
  if (/max\(inspection_date\) as newest/.test(p.get('$select') || '')) return [{ newest: FX.NEWEST }];
  if (/^license_ in/.test(where)) return FX.ALL_ROWS.filter((r) => matchWhere(r, where)).map((r) => ({ license_: r.license_, inspection_id: r.inspection_id, inspection_date: r.inspection_date, results: r.results }));
  if (/^license_=|^upper\(dba_name\)=/.test(where)) return FX.ALL_ROWS.filter((r) => matchWhere(r, where)).sort((a, b) => (a.inspection_date < b.inspection_date ? 1 : -1));
  if (p.get('$q')) { const q = p.get('$q').toUpperCase(); return FX.SEARCH_ALL.filter((r) => r.dba_name.toUpperCase().includes(q)); }
  return FX.SEARCH_ALL.filter((r) => matchWhere(r, where)).sort((a, b) => (a.last < b.last ? 1 : -1));
}

function pngSize(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }

async function setup(browser, width, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  if (opts.kitTag) await ctx.addInitScript((t) => { window.CHIEATS_KIT_TAG_TEST = t; }, opts.kitTag);
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
  log.gc = await GC.stubCounter(ctx); // GoatCounter -> local 204; checked with the other-hosts check
  return { ctx, page, log };
}
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function saveCard(page, file) {
  const u = await page.evaluate(() => document.getElementById('card').toDataURL('image/png'));
  fs.writeFileSync(path.join(OUT, file), Buffer.from(u.split(',')[1], 'base64'));
}

(async () => {
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});

  for (const width of [390, 1280]) {
    console.log(`\n== ${width}px (fixtures) ==`);
    const { ctx, page, log } = await setup(browser, width, { kitTag: '12345' });
    await page.goto(ORIGIN + '/chi-eats/');

    // Static content / SEO / fairness
    const title = await page.title();
    check(/Chicago Restaurant Inspection Lookup/.test(title), 'SEO title: ' + title);
    check(await page.locator('meta[name=description]').getAttribute('content').then((c) => /Chicago restaurant inspection lookup/i.test(c) && c.length > 100), 'meta description');
    check(await page.locator('meta[property="og:image"]').count() === 1 && await page.locator('link[rel=canonical]').getAttribute('href') === 'https://lanternlab2027.github.io/lab/chi-eats/', 'OG image + canonical');
    check(fs.existsSync(path.join(ROOT, 'chi-eats/og.png')), 'og.png exists');
    const foot = await page.locator('footer').innerText();
    check(/Not affiliated with the City of Chicago/.test(foot), 'disclaimer in footer');
    check(await page.locator('footer a[href="../"]').count() === 1 && await page.locator('footer a[href="../apps/"]').count() === 1, 'footer links to ../ and ../apps/');
    check(await page.locator('footer a[href="../eats/"]').count() === 1, 'cross-link to NYC version');
    const how = await page.locator('#how').innerText();
    check(/does not give restaurants letter grades/.test(how) && /Pass with Conditions/.test(how) && /Risk categories 1, 2 and 3/.test(how) && /twice a year/.test(how), 'how-it-works: results, risk, frequency');
    check(await page.locator('#how a[href*="Inspection_FAQ_2019.pdf"]').count() === 1 && await page.locator('#how a[href*="understand_healthcoderequirements"]').count() === 1, 'cites CDPH pages');
    const body = await page.locator('body').innerText();
    check(!/\bworst\b|\bbest\b|\brank(ed|ing)?\b(?! here)|top 10/i.test(body.replace(/nothing here is a ranking/, '')), 'no rankings / worst / best language');
    check(!/Grade [ABC]\b/.test(body), 'no invented letter grade');
    check(await noHScroll(page), 'no horizontal scroll (home)');
    await page.screenshot({ path: path.join(OUT, `home-${width}.png`) });

    // Name search: "lous" finds LOU'S via apostrophe wildcard
    await page.fill('#q', 'lous sample');
    await page.click('#go');
    await page.waitForSelector('#results li');
    check(await page.locator('#results li').count() === 1, 'name search: 1 result');
    check((await page.locator('#results .pill').first().innerText()) === 'Pass', 'result chip shows latest result Pass');
    check(/q=lous/.test(page.url()), 'search in URL');
    check(log.soda.every((u) => /\$limit=\d+/.test(decodeURIComponent(u))), 'every Socrata query has $limit');
    check(log.soda.every((u) => !/app_token/i.test(u)), 'no app token');
    await page.screenshot({ path: path.join(OUT, `results-${width}.png`) });

    // Detail
    await page.click('#results li button');
    await page.waitForSelector('#detail:not([hidden])');
    check((await page.locator('#badge').innerText()).trim() === 'Pass', 'badge Pass');
    check(await page.locator('#rc-name').innerText() === "Lou's Sample Diner", 'name tidied');
    check(/license=1000001/.test(page.url()), 'license in URL');
    check((await page.locator('#rsentence').innerText()) === 'Passed its last inspection on Oct 2, 2026.', 'factual sentence');
    check(/No priority or priority foundation violations/.test(await page.locator('#rexplain').innerText()), 'result definition shown');
    const facts = await page.locator('#facts').innerText();
    check(/Risk category\s+Risk 1 \(High\)/.test(facts) && /Inspection type\s+Canvass/.test(facts) && /License #\s+1000001/.test(facts), 'facts: risk, type, license');
    check(/not how the place performed/.test(await page.locator('#risk-explain').innerText()) && /twice a year/.test(await page.locator('#risk-explain').innerText()), 'risk explainer');
    check(await page.locator('#history details.ins').count() === 4, '4 inspections listed (duplicate removed)');
    const dates = await page.locator('#history details.ins summary b').allInnerTexts();
    check(dates.join('|') === 'Oct 2, 2026|Sep 19, 2025|Sep 9, 2025|Mar 14, 2024', 'newest first: ' + dates.join(', '));
    check(await page.locator('#history details.ins').first().getAttribute('open') !== null, 'latest inspection expanded');
    const fail = page.locator('#history details.ins').nth(2);
    await fail.locator(':scope > summary').click();
    const ft = await fail.innerText();
    check(/#22/.test(ft) && /PRIORITY/i.test(ft) && /Cold food was not kept cold enough/.test(ft) && /Official text: PROPER COLD HOLDING TEMPERATURES/.test(ft), 'violation: number, severity from comment, plain summary, official title');
    check(/Priority foundation/i.test(ft), 'priority foundation tag');
    await fail.locator('details.cmt').first().locator('summary').click();
    check(/OBSERVED TCS FOODS HELD AT 48\.0F/.test(await fail.locator('details.cmt').first().innerText()), 'inspector comments shown in full');
    check(await page.locator('#strip svg circle').count() === 4, 'results strip has 4 dots');
    check(/4 records since 2024: 2 Pass, 1 Pass with Conditions, 1 Fail/.test(await page.locator('#counts').innerText()), 'counts line');
    check(/inspections through November 12, 2026/.test(await page.locator('#asof').innerText()), 'data-through date');
    check(/one day/.test(await page.locator('.snap').innerText()), 'snapshot caveat');
    check(await noHScroll(page), 'no horizontal scroll (detail)');
    await page.screenshot({ path: path.join(OUT, `detail-${width}.png`), fullPage: true });

    // Share card
    await page.click('#share');
    await page.waitForSelector('#cardwrap:not([hidden])');
    const card = await page.evaluate(() => {
      const c = document.getElementById('card'); const x = c.getContext('2d');
      const f = x.getImageData(80, c.height - 150, 700, 150).data; let light = 0;
      for (let i = 0; i < f.length; i += 4) if (f[i] + f[i + 1] + f[i + 2] > 600) light++;
      return { w: c.width, h: c.height, top: Array.from(x.getImageData(5, 5, 1, 1).data), footerLight: light };
    });
    check(card.w === 1080 && card.h === 1350, 'card is 1080x1350');
    check(card.top.slice(0, 3).join() === '31,107,74', 'card strip uses Pass colour');
    check(card.footerLight > 500, 'card footer has text');
    await saveCard(page, `card-pass-${width}.png`);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#card-save')]);
    const dlPath = path.join(OUT, `download-${width}.png`); await dl.saveAs(dlPath);
    const sz = pngSize(fs.readFileSync(dlPath));
    check(sz.w === 1080 && sz.h === 1350 && dl.suggestedFilename() === 'before-you-go-lou-s-sample-diner.png', 'download 1080x1350 ' + dl.suggestedFilename());
    await page.click('#copy');
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    check(clip.startsWith("Lou's Sample Diner passed its last inspection on Oct 2, 2026.") && clip.includes('lanternlab2027.github.io/lab/chi-eats/?license=1000001&ref=share'), 'copy text + ref: ' + clip.slice(-70));

    // Kit signup
    check(await page.locator('#alert').isVisible(), 'alert signup visible when tag configured');
    await page.fill('#signup-email', 'test@example.com');
    await page.click('#signup-form button');
    await page.waitForFunction(() => /You're in/.test(document.getElementById('signup-msg').textContent));
    const kb = JSON.parse(log.kit[0].body);
    check(/\/v3\/tags\/12345\/subscribe$/.test(log.kit[0].url), 'Kit tag subscribe URL');
    check(kb.email === 'test@example.com' && kb.fields.restaurant_license === '1000001' && Object.keys(kb.fields).length === 1 && typeof kb.api_key === 'string' && kb.api_key.length > 10, 'Kit body: email + restaurant_license only');

    await page.click('#back');
    await page.waitForSelector('#results-sec:not([hidden])');
    check(await page.locator('#detail').isHidden(), 'back returns to results');

    // ?ref passthrough: an incoming ref is carried forward
    await page.goto(ORIGIN + '/chi-eats/?license=1000002&ref=share2-tiktok');
    await page.waitForSelector('#detail:not([hidden])');
    await page.click('#copy');
    const clip2 = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    check(/\?license=1000002&ref=share3-tiktok$/.test(clip2), 'ref passthrough share2-tiktok -> share3-tiktok');
    check(/Passed with conditions at its last inspection on Aug 21, 2026/.test(await page.locator('#rsentence').innerText()), 'Pass w/ Conditions sentence');
    check(await page.locator('#rc-name').innerText() === 'Taco Test' && /Licensed as Tt Holdings/.test(await page.locator('#rc-meta').innerText()), 'AKA used as name, DBA shown');
    check(/Official text: SOMETHING NEW WE HAVE NO SUMMARY FOR/.test(await page.locator('#history').innerText()), 'unknown violation shows official text only');
    await page.click('#share'); await saveCard(page, `card-cond-${width}.png`);

    // Other scenarios via deep links
    const scen = [
      ['1000003', 'Fail', /^Failed its last inspection on Nov 3, 2026\.$/, /re-inspects/, 'fail'],
      ['1000004', 'Out of\nBusiness', /Out of Business.*Jun 10, 2026/, /last completed inspection, on May 2, 2025, was Pass/, 'oob'],
      ['1000005', 'No\nEntry', /No Entry/, /was Pass with Conditions/, 'noentry'],
      ['1000006', 'Pass', /Passed its last inspection on May 11, 2017/, /before July 1, 2018/, 'old'],
      ['1000007', 'Pass w/\nConditions', /Passed with conditions/, null, 'longname']
    ];
    for (const [lic, badge, sentRe, noteRe, tag] of scen) {
      await page.goto(ORIGIN + '/chi-eats/?license=' + lic);
      await page.waitForSelector('#detail:not([hidden])');
      const b = (await page.locator('#badge').innerText()).trim();
      const sent = await page.locator('#rsentence').innerText();
      check(b === badge && sentRe.test(sent), `deep link ${lic}: badge "${b.replace('\n', ' ')}", "${sent}"`);
      if (noteRe) check(noteRe.test(await page.locator('#notes').innerText()), `note for ${tag}`);
      check(await page.locator('#back').isHidden(), 'no back button on direct deep link');
      await page.click('#share'); await saveCard(page, `card-${tag}-${width}.png`);
    }
    // No-license establishment opens by DBA + address
    await page.goto(ORIGIN + '/chi-eats/');
    await page.fill('#q', 'mystery mart');
    await page.click('#go');
    await page.waitForSelector('#results li');
    await page.click('#results li button');
    await page.waitForSelector('#detail:not([hidden])');
    check(/dba=MYSTERY/.test(page.url()) && /addr=500/.test(page.url()) && (await page.locator('#rc-name').innerText()) === 'Mystery Mart', 'no-license fallback by DBA + address');
    check(await page.locator('#alert').isHidden(), 'no signup without a license number');

    // Address search and no-results
    await page.goto(ORIGIN + '/chi-eats/');
    await page.fill('#q', '1234 N Clark St');
    await page.click('#go');
    await page.waitForSelector('#results li');
    check(/Lou's Sample Diner/.test(await page.locator('#results').innerText()), 'address search finds Lou\'s');
    await page.fill('#q', 'zzzz nothing');
    await page.click('#go');
    await page.waitForFunction(() => /No establishments found/.test(document.getElementById('status').textContent));
    check(true, 'no-results message');

    check(log.errs.length === 0, 'no console errors' + (log.errs.length ? ': ' + log.errs.join(' | ') : ''));
    check(log.off.length === 0, 'no requests to other hosts' + (log.off.length ? ': ' + log.off.join(', ') : ''));
    GC.checkBeacons(log.gc, check); // only page views: no hash, nothing but page-view fields
    await ctx.close();
  }

  console.log('\n== real Kit tag shows signup; 429 handling ==');
  {
    const s1 = await setup(browser, 390, { sodaStatus: 429 });
    await s1.page.goto(ORIGIN + '/chi-eats/?q=lous');
    await s1.page.waitForFunction(() => /too many requests/.test(document.getElementById('status').textContent));
    check(true, '429 shows a friendly message');
    await s1.ctx.close();
    const s2 = await setup(browser, 390);
    await s2.page.goto(ORIGIN + '/chi-eats/?license=1000001');
    await s2.page.waitForSelector('#detail:not([hidden])');
    check(await s2.page.locator('#alert').isVisible(), 'signup visible now that the real Kit tag is set');
    await s2.ctx.close();
  }

  if (LIVE) {
    console.log('\n== live smoke (real Chicago Data Portal, CORS from ' + ORIGIN + ') ==');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await ctx.newPage();
    const errs = [], acao = [], netFail = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('response', (r) => { if (r.url().startsWith(SODA)) acao.push(r.headers()['access-control-allow-origin']); });
    page.on('requestfailed', (r) => { if (r.url().startsWith(SODA)) netFail.push(r.failure() && r.failure().errorText); });
    await ctx.route('https://api.convertkit.com/**', (r) => r.abort());
    await page.goto(ORIGIN + '/chi-eats/');
    await page.fill('#q', 'Lou Mitchell');
    await page.click('#go');
    try {
      await page.waitForFunction(() => document.querySelector('#results li') || /error|reach|busy|No establishments/i.test(document.getElementById('status').textContent), null, { timeout: 30000 });
      if (netFail.length && !acao.length) {
        console.log('  BLOCKED live smoke: browser could not reach data.cityofchicago.org (' + netFail[0] + '). Not counted; re-run from an open network.');
      } else {
        const n = await page.locator('#results li').count();
        check(n >= 1, 'live search returned ' + n + ' result(s); status: ' + await page.locator('#status').innerText());
        check(acao.length > 0 && acao.every((v) => v === '*'), 'Access-Control-Allow-Origin: * (' + acao.join(',') + ')');
        await page.click('#results li button');
        await page.waitForSelector('#detail:not([hidden])', { timeout: 30000 });
        const sent = await page.locator('#rsentence').innerText();
        const ins = await page.locator('#history details.ins').count();
        check(ins >= 1 && sent.length > 10, `live detail: "${sent}", ${ins} records`);
        await page.waitForFunction(() => /through/.test(document.getElementById('asof').textContent), null, { timeout: 20000 }).catch(() => {});
        console.log('  info ' + await page.locator('#asof').innerText());
        await page.click('#share');
        await saveCard(page, 'card-live.png');
        await page.screenshot({ path: path.join(OUT, 'live-detail-390.png'), fullPage: true });
      }
    } catch (e) { check(false, 'live smoke: ' + e.message.split('\n')[0] + ' / status: ' + await page.locator('#status').innerText()); }
    check(errs.length === 0, 'live: no page errors');
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
