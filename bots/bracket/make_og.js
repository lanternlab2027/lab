// Builds docs/bracket/og.png (1200x630): headline plus a tilted printed sheet of the 76-team bracket.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/bracket/make_og.js
const { chromium } = require('playwright');
const path = require('path');
const B = require('../../docs/bracket/bracket.js'), Rn = require('../../docs/bracket/render.js');
(async () => {
  const S = B.build();
  let p = B.emptyPicks();
  for (let g = 0; g < 12; g++) p = B.setPick(S, p, g, 1);
  const sheet = Rn.svg(S, { picks: null });
  const html = `<!doctype html><html><body style="margin:0;width:1200px;height:630px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:linear-gradient(160deg,#13294b,#0b1a33);position:relative;color:#fff">
  <div style="position:absolute;right:-150px;top:70px;width:880px;transform:rotate(-6deg);box-shadow:0 30px 60px rgba(0,0,0,.45);background:#fff;padding:12px;border-radius:6px">${sheet.replace('<svg ', '<svg width="856" ')}</div>
  <div style="position:absolute;left:0;top:0;bottom:0;width:560px;background:linear-gradient(90deg,#0f2242 70%,rgba(15,34,66,0))"></div>
  <div style="position:absolute;left:60px;top:70px;width:500px">
    <div style="font-weight:800;letter-spacing:5px;font-size:19px;color:#ffb27a">FREE PRINTABLE &middot; 2027</div>
    <div style="font-weight:900;font-size:92px;line-height:.95;letter-spacing:-3px;margin-top:18px">76-Team<br><span style="color:#ff8a3d">Bracket</span></div>
    <div style="font-size:28px;font-weight:700;line-height:1.3;margin-top:24px;color:#e3ebf7">New 12-game Opening Round.<br>Print it, fill it in, or run a<br>no-account pool by link.</div>
    <div style="font-size:19px;font-weight:700;margin-top:30px;color:#b9c8e0">For bragging rights &middot; lanternlab2027.github.io/lab/bracket</div>
  </div></body></html>`;
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await pg.setContent(html);
  await pg.screenshot({ path: path.join(__dirname, '../../docs/bracket/og.png') });
  await b.close();
})();
