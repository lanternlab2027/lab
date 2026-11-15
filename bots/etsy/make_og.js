// Builds docs/etsy/og.png (1200x630) from the synthetic sample shop.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/etsy/make_og.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, decodeURIComponent(p)), (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : p.endsWith('.html') ? 'text/html' : p.endsWith('.css') ? 'text/css' : 'application/octet-stream' }); r.end(b); }); }).listen(8795);
(async () => {
  const b = await chromium.launch();
  const pg = await (await b.newContext({ timezoneId: 'America/New_York' })).newPage();
  await pg.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await pg.goto('http://127.0.0.1:8795/etsy/');
  const FX = path.join(__dirname, 'fixtures');
  await pg.setInputFiles('#file', fs.readdirSync(FX).filter((n) => /^(EtsySold.*202[56]\.csv|etsy_statement_2026_\d+\.csv)$/.test(n)).map((n) => path.join(FX, n)));
  await pg.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 8);
  await pg.fill('#name-input', 'Little Kiln Studio');
  await pg.waitForTimeout(500);
  const og = await pg.evaluate(() => {
    const cs = [...document.querySelectorAll('#deck canvas')];
    const pick = (lbl) => cs.find((c) => c.getAttribute('aria-label').includes(lbl));
    const SANS = 'Inter, "Segoe UI", Arial, sans-serif', DISP = '"Avenir Next Condensed", "Arial Narrow", "DejaVu Sans Condensed", Inter, Arial, sans-serif', SERIF = 'Georgia, "DejaVu Serif", serif';
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 400, 630); g.addColorStop(0, '#f4efe6'); g.addColorStop(1, '#e4d9c6'); x.fillStyle = g; x.fillRect(0, 0, 1200, 630);
    x.strokeStyle = 'rgba(42,35,32,.035)'; for (let yy = 0; yy < 630; yy += 5) { x.beginPath(); x.moveTo(0, yy); x.lineTo(1200, yy); x.stroke(); } for (let xx = 0; xx < 1200; xx += 5) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, 630); x.stroke(); }
    x.strokeStyle = 'rgba(42,35,32,.28)'; x.lineWidth = 3; x.setLineDash([16, 10]); x.strokeRect(20, 20, 1160, 590); x.setLineDash([]);
    x.fillStyle = '#2f6f62'; x.beginPath(); x.moveTo(80, 112); x.lineTo(104, 112); x.lineTo(104, 136); x.lineTo(80, 136); x.lineTo(70, 124); x.closePath(); x.fill();
    x.fillStyle = '#2a2320'; x.font = '800 20px ' + SANS; x.letterSpacing = '5px'; x.fillText('ETSY SHOP YEAR IN REVIEW', 118, 132); x.letterSpacing = '0px';
    x.font = '800 84px ' + DISP; x.fillText('SELLER YEAR', 64, 236);
    x.fillStyle = '#2f6f62'; x.fillText('IN REVIEW', 64, 322);
    x.fillStyle = '#6a3d6e'; x.font = 'italic 30px ' + SERIF; x.fillText('Year in Review for Etsy sellers', 70, 382);
    x.fillStyle = 'rgba(42,35,32,.85)'; x.font = '600 24px ' + SANS;
    ['Orders, best seller, busiest month, top state,', 'repeat buyers, plus fees and net by month', 'for tax time. Free. Nothing leaves your device.'].forEach((l, i) => x.fillText(l, 70, 440 + i * 34));
    x.fillStyle = 'rgba(42,35,32,.6)'; x.font = '600 17px ' + SANS; x.fillText('lanternlab2027.github.io/lab/etsy  \u00b7  not affiliated with Etsy', 70, 580);
    const w = 220;
    [[pick('Your year on a tag'), 1080, 330, 0.08], [pick('Best seller'), 830, 330, -0.08], [pick('Orders this year'), 955, 312, 0]].forEach(([cv, cx, cy, rot]) => {
      const h = w * 16 / 9; x.save(); x.translate(cx, cy); x.rotate(rot);
      x.shadowColor = 'rgba(42,35,32,.35)'; x.shadowBlur = 28; x.shadowOffsetY = 10; x.fillStyle = '#000'; x.fillRect(-w / 2, -h / 2, w, h); x.shadowColor = 'transparent';
      x.drawImage(cv, -w / 2, -h / 2, w, h); x.restore();
    });
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(ROOT, 'etsy/og.png'), Buffer.from(og.split(',')[1], 'base64'));
  await b.close(); srv.close();
  console.log('wrote docs/etsy/og.png');
})();
