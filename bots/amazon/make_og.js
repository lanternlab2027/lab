// Builds docs/amazon/og.png (1200x630) from the synthetic sample deck (names hidden).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/amazon/make_og.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, decodeURIComponent(p)), (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(b); }); }).listen(8794);
(async () => {
  const b = await chromium.launch();
  const pg = await (await b.newContext({ timezoneId: 'America/New_York' })).newPage();
  await pg.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await pg.goto('http://127.0.0.1:8794/amazon/');
  await pg.setInputFiles('#file', path.join(__dirname, 'fixtures/Your Orders.zip'));
  await pg.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0);
  const og = await pg.evaluate(() => {
    const cs = [...document.querySelectorAll('#deck canvas')];
    const pick = (lbl) => cs.find((c) => c.getAttribute('aria-label').includes(lbl));
    const SANS = 'Inter, "Segoe UI", Arial, sans-serif', DISP = '"Avenir Next Condensed", "Arial Narrow", "DejaVu Sans Condensed", Inter, Arial, sans-serif', SERIF = 'Georgia, "DejaVu Serif", serif';
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 400, 630); g.addColorStop(0, '#f7f2e7'); g.addColorStop(1, '#e9dfca'); x.fillStyle = g; x.fillRect(0, 0, 1200, 630);
    x.fillStyle = 'rgba(29,36,51,.08)'; for (let yy = 20; yy < 630; yy += 24) for (let xx = 20; xx < 1200; xx += 24) { x.beginPath(); x.arc(xx, yy, 1.4, 0, 7); x.fill(); }
    x.fillStyle = '#1f7a5c'; x.fillRect(70, 112, 34, 28); x.fillStyle = '#fff'; x.fillRect(84, 112, 6, 28);
    x.fillStyle = '#1d2433'; x.font = '800 20px ' + SANS; x.letterSpacing = '5px'; x.fillText('WHAT DID I SPEND IN 2026?', 118, 134); x.letterSpacing = '0px';
    x.fillStyle = '#1d2433'; x.font = '800 104px ' + DISP; x.fillText('YEAR IN', 64, 250);
    x.fillStyle = '#1f7a5c'; x.fillText('ORDERS', 64, 345);
    x.fillStyle = '#7b2d5e'; x.font = 'italic 30px ' + SERIF; x.fillText('for your Amazon data', 70, 395);
    x.fillStyle = 'rgba(29,36,51,.85)'; x.font = '600 24px ' + SANS;
    ['Total spent, biggest order, busiest month,', '2am orders, plus a tax-time business filter.', 'Free. Nothing leaves your device.'].forEach((l, i) => x.fillText(l, 70, 450 + i * 34));
    x.fillStyle = 'rgba(29,36,51,.6)'; x.font = '600 17px ' + SANS; x.fillText('lanternlab2027.github.io/lab/amazon  \u00b7  not affiliated with Amazon', 70, 585);
    const w = 240;
    [[pick('Your year, itemized'), 1060, 330, 0.08], [pick('Late-night'), 790, 330, -0.08], [pick('Total spent'), 925, 312, 0]].forEach(([cv, cx, cy, rot]) => {
      const h = w * 16 / 9; x.save(); x.translate(cx, cy); x.rotate(rot);
      x.shadowColor = 'rgba(29,36,51,.35)'; x.shadowBlur = 28; x.shadowOffsetY = 10; x.fillStyle = '#000'; x.fillRect(-w / 2, -h / 2, w, h); x.shadowColor = 'transparent';
      x.drawImage(cv, -w / 2, -h / 2, w, h); x.restore();
    });
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(ROOT, 'amazon/og.png'), Buffer.from(og.split(',')[1], 'base64'));
  await b.close(); srv.close();
  console.log('wrote docs/amazon/og.png');
})();
