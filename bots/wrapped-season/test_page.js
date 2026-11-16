// Playwright test for docs/wrapped-season/ (the Wrapped season hub). Every non-local request is aborted and recorded.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/wrapped-season/test_page.js <screenshot dir>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const OUT = path.resolve(process.argv[2] || '.'); fs.mkdirSync(OUT, { recursive: true });
const PORT = 8797, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.xml': 'application/xml', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(b); });
}).listen(PORT);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

// Longest export wait first. Request links must be the official pages checked for this page (see NOTES.md).
const ORDER = ['dating', 'tiktok', 'amazon', 'sport', 'reading', 'netflix', 'etsy', 'wrapped', 'couples'];
const REQ = {
  dating: 'https://account.gotinder.com/data',
  tiktok: 'https://support.tiktok.com/en/account-and-privacy/personalized-ads-and-data/requesting-your-data',
  amazon: 'https://www.amazon.com/hz/privacy-central/data-requests/preview.html',
  sport: 'https://www.strava.com/account',
  reading: 'https://www.goodreads.com/review/import',
  netflix: 'https://www.netflix.com/settings/viewing-history',
  etsy: 'https://www.etsy.com/your/shops/me/options',
  wrapped: 'https://whatsapp.com/faq/en/android/23756533',
  couples: 'https://whatsapp.com/faq/en/android/23756533',
};
const PAGE = path.join(ROOT, 'wrapped-season/index.html');

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xFF) return null;
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xC0 && m <= 0xC3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

async function open(ctx, url) {
  const pg = await ctx.newPage();
  const errors = [], external = [], local404 = [];
  pg.on('pageerror', e => errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  pg.on('response', r => { if (r.url().startsWith(ORIGIN) && r.status() >= 400) local404.push(r.url()); });
  await pg.route('**/*', r => { const u = r.request().url(); if (!u.startsWith(ORIGIN)) { external.push(u); return r.abort(); } return r.continue(); });
  await pg.goto(ORIGIN + url, { waitUntil: 'load' });
  return { pg, errors, external, local404 };
}

(async () => {
  // Static checks
  const html = fs.readFileSync(PAGE, 'utf8');
  for (const f of ['wrapped-season/index.html', 'wrapped-season/hub.js']) ok(/^[\x00-\x7F]*$/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), `${f}: ASCII only`);
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  ok(/default-src 'none'/.test(csp) && /script-src 'self'/.test(csp) && !/connect-src/.test(csp) && !/<script>(?!\s*$)/.test(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '')), 'strict CSP, no connect-src, no inline scripts');
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
  const desc = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1] || '';
  ok(/Wrapped Alternatives 2026/.test(title) && title.length <= 70, `title (${title.length} chars): ${title}`);
  ok(desc.length >= 120 && desc.length <= 200 && /Wrapped alternatives/i.test(desc) && /don't have one/.test(desc), `description (${desc.length} chars)`);
  ok(/<link rel="canonical" href="https:\/\/lanternlab2027\.github\.io\/lab\/wrapped-season\/">/.test(html), 'canonical');
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const items = ld.mainEntity.itemListElement;
  ok(ld.mainEntity['@type'] === 'ItemList' && items.length === 9 && items.every((it, i) => it.position === i + 1 && it.url === `https://lanternlab2027.github.io/lab/${ORDER[i]}/`), 'JSON-LD ItemList: 9 items in page order');
  const og = fs.readFileSync(path.join(ROOT, 'wrapped-season/og.jpg')), dim = jpegSize(og);
  ok(dim && dim.w === 1200 && dim.h === 630 && og.length < 150 * 1024, `og.jpg 1200x630 under 150 KB (${dim && dim.w}x${dim && dim.h}, ${Math.round(og.length / 1024)} KB)`);
  ok(/og:image" content="https:\/\/lanternlab2027\.github\.io\/lab\/wrapped-season\/og\.jpg"/.test(html) && /twitter:card" content="summary_large_image"/.test(html), 'og:image and twitter card');
  const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  ok(/<loc>https:\/\/lanternlab2027\.github\.io\/lab\/wrapped-season\/<\/loc>/.test(sm), 'sitemap has wrapped-season/');
  ok(/class="season-banner" href="\.\.\/wrapped-season\/"/.test(fs.readFileSync(path.join(ROOT, 'apps/index.html'), 'utf8')), 'apps hub banner links here');
  ok(/class="season-link" href="wrapped-season\/"/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')), 'home page links here');

  const browser = await chromium.launch();
  for (const [w, h, scheme] of [[390, 844, 'light'], [1280, 900, 'light'], [390, 844, 'dark']]) {
    const tag = `${w}px ${scheme}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const { pg, errors, external, local404 } = await open(ctx, '/wrapped-season/');
    await pg.$$eval('img[loading=lazy]', is => is.forEach(i => { i.loading = 'eager'; }));
    await pg.evaluate(() => document.getElementById('more-apps').scrollIntoView({ behavior: 'instant' }));
    await pg.waitForSelector('#more-apps .llm-a');
    await pg.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 8000 }).catch(() => {});
    await pg.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    ok(errors.length === 0, `${tag}: no console/page errors ${errors.join(' | ')}`);
    ok(external.length === 0, `${tag}: no external requests ${external.join(' ')}`);
    ok(local404.length === 0, `${tag}: no local 404s ${local404.join(' ')}`);
    const r = await pg.evaluate(() => ({
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      broken: [...document.images].filter(i => !i.naturalWidth).map(i => i.src),
      ids: [...document.querySelectorAll('ol.apps > li.app')].map(li => li.id),
      entries: [...document.querySelectorAll('ol.apps > li.app')].map(li => ({
        id: li.id,
        dts: [...li.querySelectorAll('dt')].map(d => d.textContent.trim()),
        dds: [...li.querySelectorAll('dd')].map(d => d.textContent.trim()),
        req: li.querySelector('a.req') && li.querySelector('a.req').getAttribute('href'),
        reqText: li.querySelector('a.req') && li.querySelector('a.req').textContent.trim(),
        sample: li.querySelector('a.sample') && li.querySelector('a.sample').getAttribute('href'),
        sampleText: li.querySelector('a.sample') && li.querySelector('a.sample').textContent.trim(),
        open: li.querySelector('a.open') && li.querySelector('a.open').getAttribute('href'),
        wait: li.querySelector('.wait') && li.querySelector('.wait').textContent.trim(),
      })),
      today: [...document.querySelectorAll('#today a')].map(a => a.getAttribute('href')),
      todayFirst: document.querySelector('#today').getBoundingClientRect().top < document.querySelector('ol.apps').getBoundingClientRect().top,
      small: [...document.querySelectorAll('.btn, #today .links a')].filter(a => a.getBoundingClientRect().height < 44).map(a => a.textContent.trim()),
      more: [...document.querySelectorAll('#more-apps a')].map(a => a.getAttribute('href')),
      bg: getComputedStyle(document.body).backgroundColor,
    }));
    ok(r.sw <= r.cw, `${tag}: no horizontal scroll (${r.sw} <= ${r.cw})`);
    ok(r.broken.length === 0, `${tag}: all images load ${r.broken.join(' ')}`);
    ok(r.ids.join() === ORDER.join(), `${tag}: 9 apps, longest wait first (${r.ids.join(', ')})`);
    ok(r.entries.every(e => e.dts.join() === 'File,Export wait' && e.dds.every(d => d.length > 10)), `${tag}: every entry says the file and the export wait`);
    ok(r.entries.every(e => e.req === REQ[e.id] && /^(Request your export|Get your export|How to export)$/.test(e.reqText)), `${tag}: every entry has its official export link`);
    ok(r.entries.every(e => e.sample === `../${e.id}/?ref=wrapped-season#sample` && e.sampleText === 'Try a sample' && e.open === `../${e.id}/?ref=wrapped-season`), `${tag}: Try a sample + Open app links carry ?ref=wrapped-season`);
    ok(r.todayFirst && ['https://account.gotinder.com/data', REQ.tiktok, REQ.amazon].every(u => r.today.includes(u)), `${tag}: "Request these today" callout sits above the list with TikTok, Amazon and Tinder`);
    ok(r.small.length === 0, `${tag}: buttons are >=44px tall ${r.small.join(' | ')}`);
    ok(r.more.length === 3 && r.more.every(u => /\?ref=more-wrapped-season$/.test(u)), `${tag}: cross-promo strip (${r.more.join(', ')})`);
    ok(scheme === 'dark' ? r.bg === 'rgb(17, 14, 24)' : r.bg === 'rgb(250, 248, 245)', `${tag}: ${scheme} background (${r.bg})`);
    await pg.screenshot({ path: path.join(OUT, `wseason-${w}-${scheme}.png`), fullPage: true });
    await pg.screenshot({ path: path.join(OUT, `wseason-${w}-${scheme}-fold.png`) });

    if (w === 390 && scheme === 'light') {
      // Every same-site link on the page resolves locally, and each #hash exists on the target page.
      const links = await pg.$$eval('a[href]', as => as.map(a => a.getAttribute('href')).filter(h => !/^(https?:|mailto:)/.test(h)));
      const bad = [];
      for (const l of new Set(links)) {
        const u = new URL(l, ORIGIN + '/wrapped-season/');
        const res = await fetch(u.origin + u.pathname);
        if (res.status !== 200) { bad.push(l + ' ' + res.status); continue; }
        if (u.hash) { const body = await res.text(); if (!body.includes(`id="${u.hash.slice(1)}"`)) bad.push(l + ' (no ' + u.hash + ')'); }
      }
      ok(bad.length === 0, `${new Set(links).size} local links resolve, hashes exist ${bad.join(', ')}`);
      // Following Try a sample lands on the app's sample button.
      for (const app of ['tiktok', 'amazon']) {
        await pg.goto(ORIGIN + '/wrapped-season/');
        await Promise.all([pg.waitForNavigation({ waitUntil: 'load' }), pg.click(`#${app} a.sample`)]);
        const vis = await pg.evaluate(() => { const b = document.getElementById('sample'); const r = b && b.getBoundingClientRect(); return !!r && r.height > 0 && r.top >= 0 && r.top < innerHeight; });
        ok(new URL(pg.url()).pathname === `/${app}/` && new URL(pg.url()).searchParams.get('ref') === 'wrapped-season' && vis, `Try a sample opens /${app}/ with the sample button in view`);
      }
    }
    await ctx.close();
  }

  // ?ref passthrough
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const { pg, errors } = await open(ctx, '/wrapped-season/?ref=PH-Wrapped-Season%3Cx%3E');
    const hrefs = await pg.$$eval('a.app-link', as => as.map(a => a.getAttribute('href')));
    ok(hrefs.length >= 27 && hrefs.every(hh => /\?ref=ph-wrapped-seasonx(#[a-z]+)?$/.test(hh)), `incoming ?ref is sanitized and passed to all ${hrefs.length} app links (${hrefs[1]})`);
    ok(await pg.$eval('#tiktok a.sample', a => a.getAttribute('href')) === '../tiktok/?ref=ph-wrapped-seasonx#sample', 'sample link keeps its #sample hash');
    ok(errors.length === 0, 'ref passthrough: no errors');
    await ctx.close();
  }

  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
