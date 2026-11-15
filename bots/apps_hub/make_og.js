// Builds docs/apps/og.png (1200x630): a collage of the apps' existing preview.jpg images plus a headline.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/apps_hub/make_og.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const img = (a) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(ROOT, a, 'preview.jpg')).toString('base64');
const tiles = [
  ['wrapped', 580, 40, -6], ['reading', 860, 20, 5], ['netflix', 610, 230, 3],
  ['sport', 900, 220, -4], ['dating', 640, 420, -3], ['awards', 920, 410, 6],
];
const html = `<!doctype html><html><head><style>
*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;background:#15111f;font-family:Inter,"Segoe UI",Roboto,Arial,sans-serif;color:#fff;position:relative}
.b1,.b2{position:absolute;border-radius:50%;filter:blur(80px);opacity:.6}
.b1{width:520px;height:520px;background:#ff3d7f;right:-120px;top:-200px}.b2{width:480px;height:480px;background:#7b5cff;left:-180px;bottom:-260px}
.t{position:absolute;width:300px;border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,.55);border:3px solid rgba(255,255,255,.9)}
.txt{position:absolute;left:64px;top:84px;width:500px}
.k{font-size:20px;font-weight:800;letter-spacing:4px;color:#ffb35c}
h1{margin:16px 0 0;font-size:78px;line-height:1;letter-spacing:-3px;font-weight:800}
.g{background:linear-gradient(90deg,#ff9f1c,#ff3d7f 60%,#c86bff);-webkit-background-clip:text;background-clip:text;color:transparent}
p{font-size:27px;line-height:1.35;color:rgba(255,255,255,.86);margin:24px 0 0;font-weight:600}
.pills{display:flex;gap:10px;margin-top:28px}.pills span{font-size:18px;font-weight:700;padding:7px 14px;border-radius:99px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22)}
.u{position:absolute;left:64px;bottom:34px;font-size:18px;font-weight:600;color:rgba(255,255,255,.6)}
</style></head><body><div class="b1"></div><div class="b2"></div>
${tiles.map(([a, x, y, r]) => `<img class="t" src="${img(a)}" style="left:${x}px;top:${y}px;transform:rotate(${r}deg)">`).join('')}
<div class="txt"><div class="k">FREE WRAPPED APPS</div><h1>Wrapped for <span class="g">everything else.</span></h1>
<p>Group chat, books, Netflix, workouts, dating and more.</p>
<div class="pills"><span>Free</span><span>No sign-up</span><span>On your device</span></div></div>
<div class="u">lanternlab2027.github.io/lab/apps</div></body></html>`;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await pg.setContent(html); await pg.waitForTimeout(200);
  await pg.screenshot({ path: path.join(ROOT, 'apps/og.png') });
  await b.close(); console.log('wrote docs/apps/og.png');
})();
