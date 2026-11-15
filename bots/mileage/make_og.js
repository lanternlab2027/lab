// Builds docs/mileage/og.png (1200x630) from the synthetic sample (invented places).
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/mileage/make_og.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(b); }); }).listen(8794);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.clock.install({ time: new Date('2026-11-15T12:00:00') });
  await pg.goto('http://127.0.0.1:8794/mileage/');
  await pg.click('#sample');
  await pg.waitForSelector('#rows tr');
  const png = await pg.evaluate(() => {
    const rows = [...document.querySelectorAll('#rows tr')].filter((tr) => tr.querySelector('select').value === 'business').slice(0, 6).map((tr) => ({
      d: tr.querySelector('td.d').firstChild.textContent, r: tr.querySelector('td.rt').textContent.replace('→', ' → '), m: tr.querySelector('td.mi').textContent.replace(/[a-z ]+$/, '') }));
    const biz = document.querySelector('#tot-business').textContent;
    const SANS = '"Segoe UI", Roboto, Arial, sans-serif', MONO = '"DejaVu Sans Mono", Menlo, monospace', DISP = '"Avenir Next Condensed", "Arial Narrow", "DejaVu Sans Condensed", Arial, sans-serif';
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
    x.fillStyle = '#f4efe2'; x.fillRect(0, 0, 1200, 630);
    // left: title
    x.fillStyle = '#5d6670'; x.font = '800 18px ' + SANS; x.letterSpacing = '4px'; x.fillText('FREE · PRIVATE · ON YOUR DEVICE', 64, 92); x.letterSpacing = '0px';
    x.fillStyle = '#1d2733'; x.font = '800 74px ' + DISP; x.fillText('Google Maps', 60, 178); x.fillText('Timeline', 60, 252);
    const rr = (X, Y, W, H, R) => { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); };
    x.font = '800 74px ' + DISP; const tw = x.measureText('mileage log').width;
    x.fillStyle = '#0d6b4e'; rr(56, 272, tw + 36, 92, 14); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 3; rr(63, 279, tw + 22, 78, 10); x.stroke();
    x.fillStyle = '#fff'; x.fillText('mileage log', 74, 340);
    x.fillStyle = '#1d2733'; x.font = '600 25px ' + SANS;
    ['Drop your Timeline export. Tag trips', 'business or personal. Download a CSV.'].forEach((l, i) => x.fillText(l, 64, 418 + i * 36));
    x.fillStyle = '#5d6670'; x.font = '600 18px ' + SANS; x.fillText('lanternlab2027.github.io/lab/mileage  ·  not affiliated with Google  ·  not tax advice', 64, 580);
    // right: logbook card
    x.save(); x.translate(700, 70); x.rotate(0.025);
    x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowBlur = 30; x.shadowOffsetY = 10; x.fillStyle = '#fffdf6'; rr(0, 0, 450, 470, 18); x.fill(); x.shadowColor = 'transparent';
    x.strokeStyle = '#d9d1bd'; x.lineWidth = 2; rr(0, 0, 450, 470, 18); x.stroke();
    x.fillStyle = '#0d6b4e'; rr(20, 20, 410, 96, 12); x.fill();
    x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '800 15px ' + SANS; x.letterSpacing = '3px'; x.fillText('BUSINESS MILES', 40, 50); x.letterSpacing = '0px';
    x.fillStyle = '#fff'; x.font = '800 44px ' + MONO; x.fillText(biz, 40, 98);
    x.fillStyle = '#5d6670'; x.font = '800 13px ' + SANS; x.letterSpacing = '2px'; x.fillText('DATE', 24, 150); x.fillText('TRIP', 100, 150); x.fillText('MILES', 372, 150); x.letterSpacing = '0px';
    rows.forEach((r, i) => {
      const y = 186 + i * 46;
      x.strokeStyle = '#e9e2cf'; x.lineWidth = 1; x.beginPath(); x.moveTo(20, y - 30); x.lineTo(430, y - 30); x.stroke();
      x.fillStyle = '#1d2733'; x.font = '600 16px ' + MONO; x.fillText(r.d.slice(5), 24, y);
      x.font = '600 16px ' + SANS; let t = r.r; while (x.measureText(t).width > 215 && t.length > 4) t = t.slice(0, -2) + '…';
      x.fillText(t, 100, y);
      x.font = '700 17px ' + MONO; x.textAlign = 'right'; x.fillText(r.m, 426, y); x.textAlign = 'left';
      x.fillStyle = '#e1efe7'; rr(320, y - 18, 0, 0, 0);
    });
    x.restore();
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(ROOT, 'mileage/og.png'), Buffer.from(png.split(',')[1], 'base64'));
  await b.close(); srv.close();
  console.log('wrote og.png');
})();
