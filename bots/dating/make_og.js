// Builds docs/dating/og.png (1200x630) and docs/dating/preview.jpg (720x491) from the made-up sample deck.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/dating/make_og.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(b); }); }).listen(8794);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await pg.goto('http://127.0.0.1:8794/dating/');
  await pg.click('#sample');
  await pg.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 5);
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
      const g = x.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, '#211b45'); g.addColorStop(1, '#0d0b20'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      const r = x.createRadialGradient(W * 0.75, H * 0.3, 20, W * 0.75, H * 0.3, H); r.addColorStop(0, 'rgba(255,179,138,.22)'); r.addColorStop(1, 'rgba(255,179,138,0)'); x.fillStyle = r; x.fillRect(0, 0, W, H);
      // airmail stripes top and bottom
      x.save(); for (let i = -2, k = 0; i * 28 < W + 40; i++, k++) { x.fillStyle = k % 2 ? '#ffb38a' : '#c9b6ff'; x.globalAlpha = 0.85; [0, H - 12].forEach((y0) => { x.beginPath(); x.moveTo(i * 28, y0 + 12); x.lineTo(i * 28 + 14, y0); x.lineTo(i * 28 + 28, y0); x.lineTo(i * 28 + 14, y0 + 12); x.closePath(); x.fill(); }); } x.restore();
    }
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
    bg(x, 1200, 630);
    x.fillStyle = '#9fe3c8'; x.font = '800 20px ' + SANS; x.letterSpacing = '5px'; x.fillText('YOUR YEAR IN DATING', 70, 150); x.letterSpacing = '0px';
    x.fillStyle = '#f8efe2'; x.font = '800 96px ' + DISP; x.fillText('DATING', 64, 250);
    x.fillStyle = '#ffb38a'; x.fillText('WRAPPED', 64, 342);
    x.fillStyle = 'rgba(248,239,226,.92)'; x.font = '600 25px ' + SANS;
    ['A free Tinder or Hinge Wrapped from', 'your own data export. Nothing', 'leaves your device.'].forEach((l, i) => x.fillText(l, 70, 410 + i * 36));
    x.fillStyle = 'rgba(248,239,226,.6)'; x.font = '600 17px ' + SANS; x.fillText('lanternlab2027.github.io/lab/dating  ·  not affiliated with Tinder, Hinge or Match Group', 70, 575);
    fan(x, [[pick('Match rate'), 1030, 330, 0.09], [pick('Peak season'), 770, 330, -0.08], [pick('The year in swipes'), 900, 315, 0]], 245);
    const p = document.createElement('canvas'); p.width = 720; p.height = 491; const y = p.getContext('2d');
    bg(y, 720, 491);
    fan(y, [[pick('Match rate'), 600, 300, 0.08], [pick('Dating personality'), 120, 300, -0.08], [pick('The year in swipes'), 360, 280, 0]], 230);
    return [c.toDataURL('image/png'), p.toDataURL('image/jpeg', 0.84)];
  });
  fs.writeFileSync(path.join(ROOT, 'dating/og.png'), Buffer.from(og.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(ROOT, 'dating/preview.jpg'), Buffer.from(preview.split(',')[1], 'base64'));
  await b.close(); srv.close();
  console.log('wrote og.png and preview.jpg');
})();
