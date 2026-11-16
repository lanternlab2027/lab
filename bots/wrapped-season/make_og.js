// Builds docs/wrapped-season/og.jpg (1200x630 JPEG, target < 150 KB) from an HTML card.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/wrapped-season/make_og.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../docs');
const OUT = path.join(ROOT, 'wrapped-season/og.jpg');
const img = (a) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(ROOT, 'apps/img', a + '.jpg')).toString('base64');
// Same order and wait labels as the page (longest export wait first).
const rows = [
  ['dating', 'Dating Wrapped', 'Tinder, Hinge', 'Days to weeks', 'l'],
  ['tiktok', 'Scroll Wrapped', 'TikTok', '1-4 days', 'l'],
  ['amazon', 'Year in Orders', 'Amazon', 'Hours to days', 'm'],
  ['sport', 'Year in Motion', 'Strava, Garmin', 'A few hours', 'm'],
  ['reading', 'Reading Wrapped', 'Goodreads, Libby', 'Minutes', 'f'],
  ['netflix', 'Streaming Wrapped', 'Netflix', 'Instant', 'f'],
  ['etsy', 'Seller Year in Review', 'Etsy', 'Instant', 'f'],
  ['wrapped', 'Group Chat Wrapped', 'WhatsApp, Telegram', '30 seconds', 'f'],
  ['couples', 'Couples Chat Wrapped', 'WhatsApp, Telegram', '30 seconds', 'f'],
];
const html = `<!doctype html><html><head><style>
*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;background:#15111f;font-family:Inter,"Segoe UI",Roboto,Arial,sans-serif;color:#fff;position:relative}
.b1,.b2{position:absolute;border-radius:50%;filter:blur(80px);opacity:.55}
.b1{width:520px;height:520px;background:#ff3d7f;left:260px;top:-260px}.b2{width:480px;height:480px;background:#7b5cff;left:-200px;bottom:-280px}
.txt{position:absolute;left:60px;top:62px;width:500px}
.k{display:inline-block;font-size:18px;font-weight:800;letter-spacing:3px;padding:6px 14px;border-radius:99px;background:linear-gradient(90deg,#ff9f1c,#ff3d7f)}
h1{margin:22px 0 0;font-size:66px;line-height:1.02;letter-spacing:-2.5px;font-weight:800}
.g{background:linear-gradient(90deg,#ff9f1c,#ff3d7f 60%,#c86bff);-webkit-background-clip:text;background-clip:text;color:transparent}
p{font-size:25px;line-height:1.35;color:rgba(255,255,255,.86);margin:22px 0 0;font-weight:600}
.today{margin-top:22px;font-size:21px;font-weight:700;color:#ffd0a0}
.u{position:absolute;left:60px;bottom:34px;font-size:18px;font-weight:600;color:rgba(255,255,255,.6)}
.list{position:absolute;right:40px;top:34px;width:560px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:12px 16px}
.hd{font-size:15px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,.6);margin:2px 4px 6px}
.r{display:flex;align-items:center;gap:12px;height:57px;border-top:1px solid rgba(255,255,255,.08)}
.r:first-of-type{border-top:0}
.n{width:22px;text-align:right;font-weight:800;color:rgba(255,255,255,.5);font-size:16px}
.r img{width:64px;height:40px;border-radius:7px;object-fit:cover}
.nm{flex:1;min-width:0}.nm b{display:block;font-size:20px;line-height:1.1}.nm span{font-size:14px;color:rgba(255,255,255,.62)}
.w{font-size:15px;font-weight:800;padding:4px 11px;border-radius:99px;white-space:nowrap}
.w.l{background:#ff6b5e;color:#2a0905}.w.m{background:#ffc46b;color:#2a1a00}.w.f{background:#6fd59c;color:#06281a}
</style></head><body><div class="b1"></div><div class="b2"></div>
<div class="txt"><span class="k">WRAPPED SEASON 2026</span>
<h1>Wrapped for the apps <span class="g">that don't have one.</span></h1>
<p>9 free year-in-review apps, longest export wait first.</p>
<div class="today">Some exports take days: request those today.</div></div>
<div class="u">lanternlab2027.github.io/lab/wrapped-season</div>
<div class="list"><div class="hd">EXPORT WAIT</div>
${rows.map(([a, n, s, w, c], i) => `<div class="r"><span class="n">${i + 1}</span><img src="${img(a)}"><div class="nm"><b>${n}</b><span>${s}</span></div><span class="w ${c}">${w}</span></div>`).join('')}
</div></body></html>`;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await pg.setContent(html); await pg.waitForTimeout(200);
  let q = 82, buf;
  for (; q >= 50; q -= 4) { buf = await pg.screenshot({ type: 'jpeg', quality: q }); if (buf.length < 150 * 1024) break; }
  fs.writeFileSync(OUT, buf);
  await b.close(); console.log(`wrote ${OUT} (${Math.round(buf.length / 1024)} KB, quality ${q})`);
})();
