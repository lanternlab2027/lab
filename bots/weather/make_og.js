// Renders docs/weather/og.png (1200x630) with docs/weather/cards.js in headless Chromium.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/weather/make_og.js
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent('<canvas id="c"></canvas>');
  for (const f of ['stats.js', 'cards.js']) await p.addScriptTag({ content: fs.readFileSync(path.resolve(__dirname, '../../docs/weather/' + f), 'utf8') });
  const url = await p.evaluate(() => window.WeatherCards.drawOg(document.getElementById('c')).toDataURL('image/png'));
  fs.writeFileSync(path.resolve(__dirname, '../../docs/weather/og.png'), Buffer.from(url.split(',')[1], 'base64'));
  await b.close(); console.log('wrote docs/weather/og.png');
})();
