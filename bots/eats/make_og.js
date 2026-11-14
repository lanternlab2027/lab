// Renders docs/eats/og.png (1200x630) from card.js with a made-up restaurant.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/eats/make_og.js
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const DOCS = path.resolve(__dirname, '../../docs/eats');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(`<!doctype html><html><head><style>
    body{margin:0;width:1200px;height:630px;background:#f7f2e8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#1d1b18;display:flex;align-items:center;overflow:hidden}
    .t{padding:0 0 0 72px;width:640px}
    .k{font-weight:800;letter-spacing:.18em;font-size:18px;color:#5e574c;text-transform:uppercase}
    h1{font-size:76px;line-height:.98;margin:14px 0 18px;letter-spacing:-.03em;font-weight:900}
    p{font-size:27px;line-height:1.3;color:#5e574c;margin:0}
    canvas{width:432px;height:540px;margin-left:24px;border-radius:18px;box-shadow:0 18px 40px rgba(0,0,0,.18);transform:rotate(2deg)}
    .bar{position:absolute;left:0;top:0;right:0;height:12px;background:#1f6b4a}
  </style></head><body><div class="bar"></div><div class="t"><div class="k">Lantern Lab</div><h1>NYC Restaurant Report Card</h1>
  <p>Health inspection grades, history and violations in plain English. Free, from official city data.</p></div><canvas id="c"></canvas></body></html>`);
  await p.addScriptTag({ path: path.join(DOCS, 'card.js') });
  await p.evaluate(() => window.EatsCard.draw(document.getElementById('c'), {
    name: 'Sample Noodle Bar', address: '123 Example Street', boro: 'Brooklyn', grade: 'A',
    gradeDate: 'Oct 2, 2026', lastDate: 'Oct 2, 2026', lastScore: 9, asOf: 'Nov 13, 2026'
  }));
  await p.screenshot({ path: path.join(DOCS, 'og.png') });
  await b.close();
  console.log('wrote', path.join(DOCS, 'og.png'));
})();
