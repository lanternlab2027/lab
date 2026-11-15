// Builds docs/sport/og.png (1200x630) and docs/sport/preview.jpg (720x491) from the synthetic sample deck.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/sport/make_og.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : 'text/html' }); r.end(b); }); }).listen(8793);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ locale: 'en-GB' });
  await pg.clock.install({ time: new Date('2026-11-14T12:00:00') });
  await pg.goto('http://127.0.0.1:8793/sport/');
  await pg.click('#sample');
  await pg.waitForFunction(() => document.querySelectorAll('#deck canvas').length >= 8);
  const out = await pg.evaluate(() => {
    const cs = [...document.querySelectorAll('#deck canvas')];
    const pick = (lbl) => cs.find((c) => c.getAttribute('aria-label').includes(lbl));
    const DISP = '"Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", "DejaVu Sans Condensed", Arial, sans-serif', SANS = 'Inter, "Segoe UI", Arial, sans-serif';
    function poster(w, h, withText) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, w * 0.5, h); g.addColorStop(0, '#0d1a45'); g.addColorStop(1, '#050a1c'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#c6ff1a'; [0, 1, 2].forEach((k) => { x.globalAlpha = 0.9 - k * 0.3; x.beginPath(); const y0 = 40 + k * 20; x.moveTo(w - 300 + k * 20, y0); x.lineTo(w - 60, y0); x.lineTo(w - 70, y0 + 10); x.lineTo(w - 310 + k * 20, y0 + 10); x.fill(); }); x.globalAlpha = 1;
      const skew = (str, px, py, size, col) => { x.save(); x.font = '800 ' + size + 'px ' + DISP; x.fillStyle = col; x.translate(px, py); x.transform(1, 0, -0.18, 1, 0, 0); x.fillText(str, 0, 0); x.restore(); };
      const cards = withText ? [[pick('Route art'), 1030, 330, 0.08], [pick('Total distance'), 780, 330, -0.08], [pick('Your year'), 905, 315, 0]] : [[pick('Route art'), 590, 250, 0.08], [pick('Total distance'), 130, 250, -0.08], [pick('Your year'), 360, 240, 0]];
      if (withText) {
        x.fillStyle = '#ff5b1f'; x.font = '800 20px ' + SANS; x.letterSpacing = '5px'; x.fillText('YOUR FREE YEAR IN SPORT', 64, 150); x.letterSpacing = '0px';
        skew('YEAR IN', 58, 250, 104, '#f3f6ff'); skew('MOTION', 58, 350, 104, '#ff5b1f');
        x.fillStyle = 'rgba(243,246,255,.9)'; x.font = '600 25px ' + SANS;
        ['From your Strava, Garmin or GPX export.', 'Free. Your activities never', 'leave your device.'].forEach((l, i) => x.fillText(l, 64, 420 + i * 36));
        x.fillStyle = 'rgba(243,246,255,.6)'; x.font = '600 18px ' + SANS; x.fillText('lanternlab2027.github.io/lab/sport', 64, 570);
      }
      cards.forEach(([cv, cx, cy, rot]) => {
        const cw = withText ? 250 : 260, chh = cw * 16 / 9; x.save(); x.translate(cx, cy); x.rotate(rot);
        x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 30; x.shadowOffsetY = 12; x.fillStyle = '#000'; x.fillRect(-cw / 2, -chh / 2, cw, chh); x.shadowColor = 'transparent';
        x.drawImage(cv, -cw / 2, -chh / 2, cw, chh); x.restore();
      });
      return c;
    }
    return { og: poster(1200, 630, true).toDataURL('image/png'), pv: poster(720, 491, false).toDataURL('image/jpeg', 0.84) };
  });
  fs.writeFileSync(path.join(ROOT, 'sport/og.png'), Buffer.from(out.og.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(ROOT, 'sport/preview.jpg'), Buffer.from(out.pv.split(',')[1], 'base64'));
  await b.close(); srv.close();
})();
