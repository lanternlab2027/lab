// Builds docs/names/og.png (1200x630) from the app's own share card for a sample name.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/names/make_og.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const srv = require('./serve.js')(8793);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('http://127.0.0.1:8793/names/?n=Hazel');
  await pg.waitForFunction(() => window.__namesState && window.__namesState.a);
  const url = await pg.evaluate(() => {
    const card = document.querySelector('#card');
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
    const SERIF = '"Iowan Old Style", Palatino, Georgia, Cambria, serif', SANS = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    x.fillStyle = '#23345c'; x.fillRect(0, 0, 1200, 630);
    x.fillStyle = '#d9a425'; x.font = '800 22px ' + SANS; x.letterSpacing = '6px'; x.fillText('FREE · 1880 TO 2025', 64, 140); x.letterSpacing = '0px';
    x.fillStyle = '#fff'; x.font = '700 82px ' + SERIF; x.fillText('Baby Name', 60, 236); x.fillText('Report Card', 60, 322);
    x.fillStyle = 'rgba(255,255,255,.88)'; x.font = '600 28px ' + SANS;
    ['When did your name peak?', 'Rank, trend and a chart for any', 'U.S. name, from SSA data.'].forEach((l, i) => x.fillText(l, 64, 392 + i * 40));
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '600 20px ' + SANS; x.fillText('lanternlab2027.github.io/lab/names', 64, 574);
    const h = 540, w = h * 1080 / 1350;
    x.save(); x.translate(930, 315); x.rotate(0.035);
    x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 40; x.shadowOffsetY = 14; x.fillStyle = '#000'; x.fillRect(-w / 2, -h / 2, w, h); x.shadowColor = 'transparent';
    x.drawImage(card, -w / 2, -h / 2, w, h); x.restore();
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.resolve(__dirname, '../../docs/names/og.png'), Buffer.from(url.split(',')[1], 'base64'));
  await b.close(); srv.close();
  console.log('wrote docs/names/og.png');
})();
