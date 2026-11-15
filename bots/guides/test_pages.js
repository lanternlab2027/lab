// Playwright check for docs/guides/ at 390px.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/guides/test_pages.js <screenshot dir>
// Serves docs/ under /lab/ locally, blocks all outside requests, and checks every guide page plus
// the three app pages that link to the guides.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../../docs');
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8781, ORIGIN = 'http://127.0.0.1:' + PORT;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (!p.startsWith('/lab/')) { res.writeHead(404); res.end(); return; }
  p = p.slice(4); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(b);
  });
}).listen(PORT);

let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const status = (u) => new Promise((r) => http.get(u, (res) => { res.resume(); r(res.statusCode); }).on('error', () => r(0)));

const GUIDES = ['index.html', 'how-to-export-whatsapp-chat.html', 'how-to-export-telegram-chat-history.html',
  'how-to-export-goodreads-library.html', 'how-to-export-storygraph-data.html', 'how-to-export-libby-timeline.html', 'how-to-find-sleeper-league-id.html'];
const PAGES = GUIDES.map((g) => '/lab/guides/' + g).concat(['/lab/wrapped/', '/lab/reading/', '/lab/awards/']);
const DISCLAIMER = {
  'how-to-export-whatsapp-chat.html': /Not affiliated with WhatsApp or Meta/,
  'how-to-export-telegram-chat-history.html': /Not affiliated with Telegram/,
  'how-to-export-goodreads-library.html': /Not affiliated with Goodreads or Amazon/,
  'how-to-export-storygraph-data.html': /Not affiliated with The StoryGraph/,
  'how-to-export-libby-timeline.html': /Not affiliated with Libby or OverDrive/,
  'how-to-find-sleeper-league-id.html': /Not affiliated with Sleeper/,
  'index.html': /Not affiliated with WhatsApp, Meta, Telegram, Goodreads, Amazon, The StoryGraph, Libby, OverDrive or Sleeper/,
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.route('**/*', (r) => (r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort()));
  const links = new Set(), titles = new Set(), descs = new Set();
  for (const p of PAGES) {
    console.log(p);
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    const res = await page.goto(ORIGIN + p, { waitUntil: 'load' });
    check(res.status() === 200, 'HTTP 200');
    const info = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
      links: [...document.querySelectorAll('a[href]')].map((a) => a.href),
      title: document.title,
      desc: (document.querySelector('meta[name=description]') || {}).content,
      canonical: (document.querySelector('link[rel=canonical]') || {}).href,
      text: document.body.innerText,
      steps: [...document.querySelectorAll('ol.steps > li')].length,
      small: [...document.querySelectorAll('a.btn, summary')].filter((e) => e.getBoundingClientRect().height < 44).length,
    }));
    check(errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
    check(info.overflow <= 0, 'no horizontal overflow (' + info.overflow + ')');
    info.links.filter((u) => u.startsWith(ORIGIN)).forEach((u) => links.add(u.split('#')[0]));
    if (p.startsWith('/lab/guides/')) {
      const g = p.split('/').pop();
      check(info.canonical === 'https://lanternlab2027.github.io' + (g === 'index.html' ? '/lab/guides/' : p), 'canonical ' + info.canonical);
      check(!titles.has(info.title) && !descs.has(info.desc), 'unique title + description');
      titles.add(info.title); descs.add(info.desc);
      check(/Last checked: Nov 2026/.test(info.text), '"Last checked: Nov 2026" shown');
      check(DISCLAIMER[g].test(info.text), 'disclaimer present');
      check(info.small === 0, 'buttons/summaries >= 44px tall');
      let parsed = [];
      try { parsed = info.ld.map((t) => JSON.parse(t)); check(true, 'JSON-LD parses'); } catch (e) { check(false, 'JSON-LD parses: ' + e); }
      if (g !== 'index.html') {
        const how = parsed.find((x) => x['@type'] === 'HowTo');
        const n = how ? how.step.reduce((a, s) => a + (s.itemListElement ? s.itemListElement.length : 1), 0) : 0;
        check(how && n === info.steps, 'HowTo JSON-LD steps (' + n + ') match visible steps (' + info.steps + ')');
        check(/Privacy:/.test(info.text) && /Troubleshooting/.test(info.text) && /Sources/.test(info.text), 'privacy, troubleshooting, sources sections');
        check(info.links.filter((u) => /\/lab\/(wrapped|reading|awards)\/$/.test(u)).length >= 1, 'CTA links to app');
        if (g === 'how-to-export-whatsapp-chat.html' || g === 'how-to-export-libby-timeline.html') await page.screenshot({ path: path.join(OUT, 'guide-' + g.split('-')[3] + '-390.png'), fullPage: true });
      }
    } else {
      check(info.links.some((u) => u.includes('/lab/guides/')), 'app page links to a guide');
    }
    await page.close();
  }
  // every internal link + every sitemap URL must return 200
  const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  [...sm.matchAll(/<loc>https:\/\/lanternlab2027\.github\.io(\/lab\/[^<]*)<\/loc>/g)].forEach((m) => links.add(ORIGIN + m[1].replace(/&amp;/g, '&')));
  console.log('internal links + sitemap URLs: ' + links.size);
  for (const u of [...links].sort()) { const s = await status(u); if (s !== 200) check(false, s + ' ' + u); }
  check(true, 'link sweep done');
  await browser.close(); server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
