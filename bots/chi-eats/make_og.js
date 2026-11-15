// Renders docs/chi-eats/og.png (1200x630) from card.js with a made-up restaurant.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/chi-eats/make_og.js
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const DOCS = path.resolve(__dirname, '../../docs/chi-eats');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(`<!doctype html><html><head><style>
    body{margin:0;width:1200px;height:630px;background:#f6f3ec;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#16191d;display:flex;align-items:center;overflow:hidden}
    .t{padding:0 0 0 72px;width:640px}
    .k{font-weight:800;letter-spacing:.18em;font-size:18px;color:#565b62;text-transform:uppercase}
    .fl{display:flex;gap:8px;align-items:center;margin:16px 0 0}.fl i{display:block;width:44px;height:8px;border-radius:4px;background:#2b6c9e}.fl b{color:#b8322a;font-size:20px;letter-spacing:3px}
    h1{font-size:76px;line-height:.98;margin:14px 0 18px;letter-spacing:-.03em;font-weight:900}
    p{font-size:27px;line-height:1.3;color:#565b62;margin:0}
    canvas{width:432px;height:540px;margin-left:24px;border-radius:18px;box-shadow:0 18px 40px rgba(0,0,0,.18);transform:rotate(2deg)}
  </style></head><body><div class="t"><div class="k">Lantern Lab</div><div class="fl"><i></i><b>&#10038;&#10038;&#10038;&#10038;</b><i></i></div><h1>Chicago Restaurant Report Card</h1>
  <p>Health inspection results, risk category and violations in plain English. Free, from official city data.</p></div><canvas id="c"></canvas></body></html>`);
  await p.addScriptTag({ path: path.join(DOCS, 'card.js') });
  await p.evaluate(() => window.ChiCard.draw(document.getElementById('c'), {
    name: 'Sample Noodle Bar', address: '123 W Example St', key: 'pass', sentence: 'Passed its last inspection on Oct 2, 2026.',
    resultLabel: 'Pass', type: 'Canvass', risk: 'Risk 1 (High)', asOf: 'Nov 12, 2026'
  }));
  await p.screenshot({ path: path.join(DOCS, 'og.png') });
  await b.close();
  console.log('wrote', path.join(DOCS, 'og.png'));
})();
