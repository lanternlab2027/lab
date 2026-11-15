// Builds docs/netflix/og.png (1200x630) and docs/netflix/preview.jpg (720x491) from the synthetic sample deck.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/netflix/make_og.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(b); }); }).listen(8793);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await pg.goto('http://127.0.0.1:8793/netflix/');
  await pg.setInputFiles('#file', path.join(__dirname, 'fixtures/NetflixViewingHistory.csv'));
  await pg.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0);
  const [og, preview] = await pg.evaluate(() => {
    const cs = [...document.querySelectorAll('#deck canvas')];
    const pick = (lbl) => cs.find((c) => c.getAttribute('aria-label').includes(lbl));
    const SANS = 'Inter, "Segoe UI", Arial, sans-serif', DISP = '"Avenir Next Condensed", "Arial Narrow", "DejaVu Sans Condensed", Inter, Arial, sans-serif';
    function fan(x, list, w) {
      list.forEach(([cv, cx, cy, rot]) => {
        const h = w * 16 / 9; x.save(); x.translate(cx, cy); x.rotate(rot);
        x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 30; x.shadowOffsetY = 12; x.fillStyle = '#000'; x.fillRect(-w / 2, -h / 2, w, h); x.shadowColor = 'transparent';
        x.drawImage(cv, -w / 2, -h / 2, w, h); x.restore();
      });
    }
    function bg(x, W, H) {
      const g = x.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, '#10262d'); g.addColorStop(1, '#060e11'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      const b2 = x.createLinearGradient(0, 0, 0, H); b2.addColorStop(0, 'rgba(255,240,205,.14)'); b2.addColorStop(1, 'rgba(255,240,205,0)');
      x.fillStyle = b2; x.beginPath(); x.moveTo(W * 0.68, 0); x.lineTo(W * 0.74, 0); x.lineTo(W * 1.05, H); x.lineTo(W * 0.4, H); x.closePath(); x.fill();
    }
    // OG
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
    bg(x, 1200, 630);
    x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, 0, 30, 630); x.fillRect(1170, 0, 30, 630);
    x.fillStyle = 'rgba(255,246,226,.18)'; for (let y = 12; y < 630; y += 40) { x.fillRect(8, y, 14, 22); x.fillRect(1178, y, 14, 22); }
    x.fillStyle = '#5ee0d0'; x.font = '800 20px ' + SANS; x.letterSpacing = '5px'; x.fillText('YOUR YEAR ON SCREEN', 70, 150); x.letterSpacing = '0px';
    x.fillStyle = '#f4ecdc'; x.font = '800 92px ' + DISP; x.fillText('STREAMING', 64, 250);
    x.fillStyle = '#ffb648'; x.fillText('WRAPPED', 64, 340);
    x.fillStyle = 'rgba(244,236,220,.9)'; x.font = '600 25px ' + SANS;
    ['A free Netflix Wrapped from your', 'viewing history. Nothing leaves', 'your device.'].forEach((l, i) => x.fillText(l, 70, 410 + i * 36));
    x.fillStyle = 'rgba(244,236,220,.6)'; x.font = '600 18px ' + SANS; x.fillText('lanternlab2027.github.io/lab/netflix  \u00b7  not affiliated with Netflix', 70, 570);
    fan(x, [[pick('Top show'), 1015, 330, 0.09], [pick('The binge'), 765, 330, -0.08], [pick('Titles watched'), 890, 315, 0]], 250);
    // preview strip for the page
    const p = document.createElement('canvas'); p.width = 720; p.height = 491; const y = p.getContext('2d');
    bg(y, 720, 491);
    fan(y, [[pick('Top show'), 600, 300, 0.08], [pick('The binge'), 120, 300, -0.08], [pick('Titles watched'), 360, 280, 0]], 230);
    return [c.toDataURL('image/png'), p.toDataURL('image/jpeg', 0.84)];
  });
  fs.writeFileSync(path.join(ROOT, 'netflix/og.png'), Buffer.from(og.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(ROOT, 'netflix/preview.jpg'), Buffer.from(preview.split(',')[1], 'base64'));
  await b.close(); srv.close();
  console.log('wrote og.png and preview.jpg');
})();
