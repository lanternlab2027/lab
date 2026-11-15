// Builds docs/dogs/og.png (1200x630) from the app's own share card for a sample name.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/dogs/make_og.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const srv = require('../names/serve.js')(8795);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('http://127.0.0.1:8795/dogs/?n=Luna');
  await pg.waitForFunction(() => window.__dogsState && window.__dogsState.n);
  const url = await pg.evaluate(() => {
    const card = document.querySelector('#card');
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
    const SERIF = '"Iowan Old Style", Palatino, Georgia, Cambria, serif', SANS = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    x.fillStyle = '#1f4d3f'; x.fillRect(0, 0, 1200, 630);
    x.fillStyle = '#e2a12b'; x.font = '800 22px ' + SANS; x.letterSpacing = '6px'; x.fillText('FREE \u00b7 NYC LICENSE DATA', 64, 140); x.letterSpacing = '0px';
    x.fillStyle = '#fff'; x.font = '700 78px ' + SERIF; x.fillText('NYC Dog Name', 60, 232); x.fillText('Report Card', 60, 316);
    x.fillStyle = 'rgba(255,255,255,.88)'; x.font = '600 28px ' + SANS;
    ['How many NYC dogs share', 'your dog\u2019s name? Rank, breeds,', 'boroughs and trend.'].forEach((l, i) => x.fillText(l, 64, 390 + i * 40));
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '600 20px ' + SANS; x.fillText('lanternlab2027.github.io/lab/dogs', 64, 574);
    const h = 540, w = h * 1080 / 1350;
    x.save(); x.translate(940, 315); x.rotate(0.035);
    x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 40; x.shadowOffsetY = 14; x.fillStyle = '#000'; x.fillRect(-w / 2, -h / 2, w, h); x.shadowColor = 'transparent';
    x.drawImage(card, -w / 2, -h / 2, w, h); x.restore();
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.resolve(__dirname, '../../docs/dogs/og.png'), Buffer.from(url.split(',')[1], 'base64'));
  await b.close(); srv.close();
  console.log('wrote docs/dogs/og.png');
})();
