// Builds docs/couples/og.png (1200x630) and docs/couples/preview.jpg (720x464) from the synthetic sample deck.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/couples/make_og.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(b); }); }).listen(8794);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('http://127.0.0.1:8794/couples/');
  await pg.click('#sample');
  await pg.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0);
  const [og, preview] = await pg.evaluate(() => {
    const cs = [...document.querySelectorAll('#deck canvas')];
    const pick = (lbl) => cs.find((c) => c.getAttribute('aria-label').includes(lbl));
    const SANS = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    function heart(x, cx, cy, s) {
      x.beginPath(); x.moveTo(cx, cy + s * 0.35);
      x.bezierCurveTo(cx - s * 0.6, cy - s * 0.05, cx - s * 0.45, cy - s * 0.55, cx, cy - s * 0.22);
      x.bezierCurveTo(cx + s * 0.45, cy - s * 0.55, cx + s * 0.6, cy - s * 0.05, cx, cy + s * 0.35); x.closePath();
    }
    function bg(x, W, H) {
      const g = x.createLinearGradient(0, 0, W * 0.5, H); g.addColorStop(0, '#d6246e'); g.addColorStop(0.6, '#7a0f4a'); g.addColorStop(1, '#2a0620');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 3;
      [[0.1, 0.15, 60], [0.45, 0.85, 80], [0.6, 0.12, 40], [0.95, 0.9, 70], [0.3, 0.5, 30]].forEach(([a, c, s]) => { heart(x, a * W, c * H, s); x.stroke(); });
    }
    function fan(x, list, w) {
      list.forEach(([cv, cx, cy, rot]) => {
        const h = w * 16 / 9; x.save(); x.translate(cx, cy); x.rotate(rot);
        x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 30; x.shadowOffsetY = 12; x.fillStyle = '#000'; x.fillRect(-w / 2, -h / 2, w, h); x.shadowColor = 'transparent';
        x.drawImage(cv, -w / 2, -h / 2, w, h); x.restore();
      });
    }
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
    bg(x, 1200, 630);
    x.fillStyle = '#ffd1e0'; x.font = '800 20px ' + SANS; x.letterSpacing = '5px'; x.fillText('OUR YEAR IN TEXTS', 70, 150); x.letterSpacing = '0px';
    x.fillStyle = '#ffffff'; x.font = '900 82px ' + SANS; x.fillText('Couples Chat', 64, 240);
    x.fillStyle = '#ffe066'; x.fillText('Wrapped', 64, 324);
    x.fillStyle = 'rgba(255,240,245,.92)'; x.font = '600 25px ' + SANS;
    ['Goodnights, I love yous, reply speed', 'and your shared emoji, from your', 'WhatsApp or Telegram chat. On-device.'].forEach((l, i) => x.fillText(l, 70, 400 + i * 36));
    x.fillStyle = 'rgba(255,240,245,.65)'; x.font = '600 18px ' + SANS; x.fillText('lanternlab2027.github.io/lab/couples  \u00b7  free, nothing uploaded', 70, 570);
    fan(x, [[pick('Us, in texts'), 1050, 330, 0.09], [pick('Goodnights'), 790, 335, -0.08], [pick('Who texts first'), 920, 315, 0]], 245);
    const p = document.createElement('canvas'); p.width = 720; p.height = 464; const y = p.getContext('2d');
    bg(y, 720, 464);
    fan(y, [[pick('Us, in texts'), 600, 290, 0.08], [pick('Goodnights'), 120, 290, -0.08], [pick('Who texts first'), 360, 270, 0]], 220);
    return [c.toDataURL('image/png'), p.toDataURL('image/jpeg', 0.84)];
  });
  fs.writeFileSync(path.join(ROOT, 'couples/og.png'), Buffer.from(og.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(ROOT, 'couples/preview.jpg'), Buffer.from(preview.split(',')[1], 'base64'));
  await b.close(); srv.close();
  console.log('wrote og.png and preview.jpg');
})();
