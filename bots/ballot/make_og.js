// Builds docs/ballot/og.png (1200x630): headline plus a demo ballot card and a leaderboard card.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/ballot/make_og.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const nom = (t, on) => `<div style="display:flex;gap:10px;align-items:center;border:${on ? '2px solid #b8860b' : '1px solid #e1d8c6'};background:${on ? '#fbf1d6' : '#f7f3ea'};border-radius:10px;padding:9px 12px;margin-top:7px;font-weight:700;font-size:18px"><span style="width:16px;height:16px;border-radius:50%;border:2px solid ${on ? '#b8860b' : '#999'};background:${on ? '#b8860b' : 'transparent'}"></span>${t}</div>`;
  const row = (r, n, p, lead) => `<div style="display:flex;justify-content:space-between;padding:9px 4px;border-bottom:1px solid #e1d8c6;font-size:19px;font-weight:${lead ? 800 : 600}"><span>${r}. ${n}</span><span>${p}</span></div>`;
  const html = `<!doctype html><html><body style="margin:0;width:1200px;height:630px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:radial-gradient(120% 90% at 30% -10%,#5a1a2c 0%,#2a0d16 45%,#13060b 100%);position:relative;color:#fff">
  <div style="position:absolute;left:40px;top:-40px;width:240px;height:700px;transform:rotate(16deg);background:linear-gradient(180deg,rgba(233,196,106,.22),rgba(233,196,106,0))"></div>
  <div style="position:absolute;left:60px;top:72px;width:520px">
    <div style="font-weight:800;letter-spacing:5px;font-size:18px;color:#e9c46a">FREE &middot; NO ACCOUNTS &middot; 2027</div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:86px;line-height:.98;margin-top:18px">Awards-Night<br><i style="color:#e9c46a">Ballot Pool</i></div>
    <div style="font-size:27px;font-weight:700;line-height:1.3;margin-top:24px;color:#ecdcd6">Everyone picks by link.<br>The host gets a live leaderboard.<br>Printable ballot included.</div>
    <div style="font-size:18px;font-weight:700;margin-top:28px;color:#d9c3b8">For bragging rights &middot; lanternlab2027.github.io/lab/ballot</div>
  </div>
  <div style="position:absolute;left:640px;top:58px;width:300px;background:#fff;color:#19141a;border-radius:22px;padding:18px;box-shadow:0 30px 60px rgba(0,0,0,.5);transform:rotate(-4deg)">
    <div style="font-size:13px;font-weight:800;letter-spacing:2px;color:#7a1d3a">DEMO BALLOT</div>
    <div style="font-family:Georgia,serif;font-weight:700;font-size:24px;margin:4px 0 4px">Best Picture</div>
    ${nom('Captain Spreadsheet')}${nom('Moonlight Laundromat', true)}${nom('Seven Robots for...')}${nom('A Quiet Place to Park')}
    <div style="font-family:Georgia,serif;font-weight:700;font-size:24px;margin:14px 0 4px">Best Song</div>
    ${nom('Beep Boop Forever', true)}${nom('Spin Cycle of Love')}
  </div>
  <div style="position:absolute;left:880px;top:250px;width:280px;background:#fff;color:#19141a;border-radius:18px;padding:16px 16px 10px;box-shadow:0 30px 60px rgba(0,0,0,.5);transform:rotate(3deg)">
    <div style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;letter-spacing:1px;color:#7a1d3a"><span style="width:10px;height:10px;border-radius:50%;background:#e5484d"></span>LEADERBOARD</div>
    ${row(1, 'Ana', '12', true)}${row(2, 'Cy', '9')}${row(3, 'Ben', '7')}${row(4, 'Dee', '4')}
    <div style="font-size:14px;color:#5d5560;padding-top:8px">6 of 8 winners announced</div>
  </div>
  </body></html>`;
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await pg.setContent(html);
  await pg.screenshot({ path: path.join(__dirname, '../../docs/ballot/og.png') });
  await b.close();
})();
