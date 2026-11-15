// Render docs/chicago-then/og.png (1200x630) with Playwright. Adapted from bots/then/make_og.js.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/chicago-then/make_og.js [lccn]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DOCS = path.resolve(__dirname, '../../docs/chicago-then');
const sched = JSON.parse(fs.readFileSync(path.join(DOCS, 'schedule.json'), 'utf8'));
const pickId = process.argv[2];
const ph = sched.photos.find((p) => p.id === pickId) || sched.photos.find((p) => p.w > p.h) || sched.photos[0];
const img = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(DOCS, 'img', ph.file)).toString('base64');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;width:1200px;height:630px;background:#f3ede2;font-family:Lora,Georgia,serif;color:#1d1a16;display:flex;overflow:hidden}
.ph{width:640px;height:630px;padding:36px 0 36px 40px;box-sizing:border-box}
.fr{background:#fbf8f2;padding:12px;box-shadow:0 10px 30px rgba(40,30,15,.25);transform:rotate(-1.5deg);height:100%;box-sizing:border-box}
.fr img{width:100%;height:100%;object-fit:cover;filter:sepia(.15)}
.stripes{height:8px;border-top:3px solid #41b6e6;border-bottom:3px solid #41b6e6;margin:14px 0 20px}
.star{vertical-align:.55em;margin:0 0 0 6px}
.tx{flex:1;padding:70px 56px 0 56px}
h1{font-size:84px;line-height:.95;margin:0 0 6px;font-weight:700;letter-spacing:-1px}
h1 i{color:#c8102e;font-weight:400}
.rule{height:3px;background:#1d1a16;margin:18px 0 22px}
p{font-size:34px;line-height:1.25;margin:0 0 26px}
.tiles{display:flex;gap:10px;margin:0 0 26px}
.tiles span{width:58px;height:58px;border-radius:8px;display:grid;place-items:center;font:700 22px Lora,serif;color:#fff}
.s{font:600 19px "DejaVu Sans",sans-serif;letter-spacing:.1em;white-space:nowrap;text-transform:uppercase;color:#6b6255}
</style></head><body>
<div class="ph"><div class="fr"><img src="${img}"></div></div>
<div class="tx"><h1>Chicago<svg class="star" viewBox="0 0 24 24" width="40" height="40"><path fill="#c8102e" d="M12 0l3 6.8 7.4-.8-4.4 6 4.4 6-7.4-.8L12 24l-3-6.8-7.4.8 4.4-6-4.4-6 7.4.8z"/></svg><br><i>Then</i></h1><div class="stripes"></div>
<p>One old Chicago photo a day. Guess the year in 5 tries.</p>
<div class="tiles"><span style="background:#3b3631">?</span><span style="background:#e07a2e">?</span><span style="background:#d9a521;color:#1d1a16">?</span><span style="background:#2f8f4e">&#10003;</span></div>
<div class="s">Free Chicago history daily game</div></div>
</body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(html);
  await p.screenshot({ path: path.join(DOCS, 'og.png') });
  await b.close();
  console.log('og.png from', ph.id, ph.place, ph.year);
})();
