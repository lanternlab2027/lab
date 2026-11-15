// Renders every card for a set of fixtures to PNGs for visual review.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/dating/render_cards.js <out dir> [safe|full]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs'), FX = path.join(__dirname, 'fixtures');
const OUT = path.resolve(process.argv[2] || '.'); fs.mkdirSync(OUT, { recursive: true });
const MODE = process.argv[3] || 'both';
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(b); }); }).listen(8795);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/New_York' });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
  await pg.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await pg.goto('http://127.0.0.1:8795/dating/');
  const sets = [['tinder', ['tinder-export.zip']], ['hingejson', ['hinge-export.zip']], ['hingecsv', ['hinge-csv-export.zip']], ['tiny', ['tinder_zero_matches.json']], ['csvsent', ['hinge-csv-sent-only.zip']]];
  for (const [tag, files] of sets) {
    await pg.click('#reset').catch(() => {});
    await pg.setInputFiles('#file', files.map((f) => path.join(FX, f)));
    await pg.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0 || /err/.test(document.querySelector('#status').className), null, { timeout: 30000 });
    for (const safe of MODE === 'both' ? [true, false] : [MODE === 'safe']) {
      if ((await pg.isChecked('#safe')) !== safe) { await pg.click('#safe'); await pg.waitForTimeout(200); }
      const urls = await pg.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => [c.getAttribute('aria-label'), c.toDataURL('image/png')]));
      urls.forEach(([l, u], i) => fs.writeFileSync(path.join(OUT, `${tag}-${safe ? 'safe' : 'full'}-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
      console.log(tag, safe ? 'safe' : 'full', urls.map((x) => x[0].replace(/^Card /, '')).join(' | '));
    }
  }
  await b.close(); srv.close();
})();
