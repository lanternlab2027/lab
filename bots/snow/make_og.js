// Renders docs/snow/og.png (1200x630) with docs/snow/card.js in headless Chromium.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/snow/make_og.js
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent('<canvas id="c"></canvas>');
  await p.addScriptTag({ content: fs.readFileSync(path.resolve(__dirname, '../../docs/snow/card.js'), 'utf8') });
  const url = await p.evaluate(() => window.SnowCard.drawOg(document.getElementById('c'), { chance: 72 }).toDataURL('image/png'));
  fs.writeFileSync(path.resolve(__dirname, '../../docs/snow/og.png'), Buffer.from(url.split(',')[1], 'base64'));
  await b.close(); console.log('wrote docs/snow/og.png');
})();
