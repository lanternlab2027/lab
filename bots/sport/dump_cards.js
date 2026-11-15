// Dev helper: renders the sample deck (or a fixture) and writes every card as PNG for visual review.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/sport/dump_cards.js <out dir> [fixture file] [units] [name]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const OUT = path.resolve(process.argv[2] || '.'); fs.mkdirSync(OUT, { recursive: true });
const FIX = process.argv[3] && process.argv[3] !== '-' ? process.argv[3].split(',') : null, UNITS = process.argv[4] || 'metric', NAME = process.argv[5] || '';
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(b); }); }).listen(8796);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
  pg.on('pageerror', (e) => console.log('PAGEERROR', e)); pg.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await pg.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await pg.goto('http://127.0.0.1:8796/sport/');
  if (FIX) await pg.setInputFiles('#file', FIX.map((f) => path.resolve(f))); else await pg.click('#sample');
  await pg.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0 || document.querySelector('#status.err'), null, { timeout: 60000 });
  console.log(await pg.textContent('#status'));
  if (UNITS === 'imperial') { await pg.click('#u-imperial'); await pg.waitForTimeout(300); }
  if (NAME) { await pg.fill('#name-input', NAME); await pg.waitForTimeout(600); }
  const urls = await pg.evaluate(() => [...document.querySelectorAll('#deck canvas')].map((c) => [c.getAttribute('aria-label'), c.toDataURL('image/png')]));
  urls.forEach(([l, u], i) => { const f = path.join(OUT, `card-${String(i + 1).padStart(2, '0')}.png`); fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); console.log(f, l); });
  await b.close(); srv.close();
})();
