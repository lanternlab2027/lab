// Builds docs/reading/og.png (1200x630) from synthetic sample cards. Run: NODE_PATH=/opt/npm-tools/node_modules node bots/reading/make_og.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : 'text/html' }); r.end(b); }); }).listen(8792);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await pg.goto('http://127.0.0.1:8792/reading/');
  await pg.setInputFiles('#file', path.join(__dirname, 'fixtures/goodreads_library_export.csv'));
  await pg.waitForFunction(() => document.querySelectorAll('#deck canvas').length > 0);
  const url = await pg.evaluate(() => {
    const cs = [...document.querySelectorAll('#deck canvas')];
    const pick = (lbl) => cs.find(c => c.getAttribute('aria-label').includes(lbl));
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 500, 630); g.addColorStop(0, '#1b4632'); g.addColorStop(1, '#0b2117'); x.fillStyle = g; x.fillRect(0, 0, 1200, 630);
    x.strokeStyle = 'rgba(246,237,219,.3)'; x.lineWidth = 2; x.strokeRect(18, 18, 1164, 594);
    const SERIF = '"Iowan Old Style", Palatino, Georgia, Cambria, Caladea, serif', SANS = 'Inter, "Segoe UI", Arial, sans-serif';
    x.fillStyle = '#e4bc62'; x.font = '800 20px ' + SANS; x.letterSpacing = '5px'; x.fillText('YOUR YEAR IN BOOKS', 64, 150); x.letterSpacing = '0px';
    x.fillStyle = '#f6eddb'; x.font = '700 92px ' + SERIF; x.fillText('Reading', 60, 250);
    x.fillStyle = '#e4bc62'; x.font = 'italic 700 92px ' + SERIF; x.fillText('Wrapped', 60, 340);
    x.fillStyle = 'rgba(246,237,219,.88)'; x.font = '600 25px ' + SANS;
    ['For Goodreads and StoryGraph.', 'Free, and your library never', 'leaves your device.'].forEach((l, i) => x.fillText(l, 64, 410 + i * 36));
    x.fillStyle = 'rgba(246,237,219,.6)'; x.font = '600 18px ' + SANS; x.fillText('lanternlab2027.github.io/lab/reading', 64, 566);
    [[pick('Card 7'), 1015, 330, 0.09], [pick('Top-rated'), 765, 330, -0.08], [pick('Books read'), 890, 315, 0]].forEach(([cv, cx, cy, rot]) => {
      const w = 250, h = w * 16 / 9; x.save(); x.translate(cx, cy); x.rotate(rot);
      x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 30; x.shadowOffsetY = 12; x.fillStyle = '#000'; x.fillRect(-w / 2, -h / 2, w, h); x.shadowColor = 'transparent';
      x.drawImage(cv, -w / 2, -h / 2, w, h); x.restore();
    });
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(ROOT, 'reading/og.png'), Buffer.from(url.split(',')[1], 'base64'));
  await b.close(); srv.close();
})();
