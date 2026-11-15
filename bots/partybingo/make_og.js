// Builds docs/partybingo/og.png (1200x630): two different guest cards on phones plus a BINGO result picture.
// Run: NODE_PATH=/opt/npm-tools/node_modules node bots/partybingo/make_og.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const srv = require('./serve.js')(8834);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('http://127.0.0.1:8834/partybingo/');
  await pg.waitForSelector('html[data-ready]');
  const url = await pg.evaluate(() => {
    const C = PartyCodec, P = PartyPresets[0];
    const R = 'ui-rounded, "SF Pro Rounded", -apple-system, "Segoe UI", Inter, Arial, sans-serif';
    const S = '-apple-system, "Segoe UI", Inter, Arial, sans-serif';
    const cols = ['#ff4f6d', '#ffb020', '#22b07d', '#3a86ff', '#9b5de5'];
    function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
    function wrapLines(x, t, w) { const out = []; let cur = ''; t.split(' ').forEach((wd) => { const s = cur ? cur + ' ' + wd : wd; if (x.measureText(s).width <= w) cur = s; else { if (cur) out.push(cur); cur = wd; } }); if (cur) out.push(cur); return out; }
    // a phone showing one guest card
    function phone(seed, marks) {
      const W = 300, H = 600, c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2; const x = c.getContext('2d'); x.scale(2, 2);
      rr(x, 0, 0, W, H, 40); x.fillStyle = '#2b1d3d'; x.fill();
      rr(x, 10, 10, W - 20, H - 20, 32); x.fillStyle = '#fff6e9'; x.fill();
      x.textAlign = 'center'; x.fillStyle = '#6b5a7a'; x.font = '800 11px ' + S; x.fillText('WATCH-PARTY BINGO', W / 2, 70);
      x.fillStyle = '#2b1d3d'; x.font = '900 26px ' + R; x.fillText('Big Game Bingo', W / 2, 102);
      x.font = '900 30px ' + R; 'BINGO'.split('').forEach((L, i) => { x.fillStyle = cols[i]; x.fillText(L, 34 + i * 58, 150); });
      const cells = C.deal(P.squares, seed), g = 54, gx = 15, gy = 166;
      rr(x, gx - 3, gy - 3, g * 5 + 6, g * 5 + 6, 10); x.fillStyle = '#2b1d3d'; x.fill();
      cells.forEach((t, i) => {
        const cx = gx + (i % 5) * g + 2, cy = gy + Math.floor(i / 5) * g + 2, w = g - 4;
        rr(x, cx, cy, w, w, 7); x.fillStyle = t == null ? '#ffd84d' : '#fff'; x.fill();
        if (marks.includes(i) && t != null) { rr(x, cx + 3, cy + 3, w - 6, w - 6, 5); x.fillStyle = 'rgba(255,79,109,.22)'; x.fill(); x.strokeStyle = '#ff4f6d'; x.lineWidth = 1.5; x.stroke(); }
        x.fillStyle = '#2b1d3d'; x.font = '700 7.5px ' + S;
        const L = wrapLines(x, t == null ? '★ FREE' : t, w - 6).slice(0, 4);
        L.forEach((l, k) => x.fillText(l, cx + w / 2, cy + w / 2 - (L.length - 1) * 4.5 + k * 9 + 3));
      });
      x.fillStyle = '#6b5a7a'; x.font = '700 11px ' + S; x.fillText('Your card is different from everyone else’s', W / 2, 470);
      return c;
    }
    const cells = C.deal(P.squares, 777);
    const res = PartyRender.draw(document.createElement('canvas'), { title: 'Big Game Bingo', name: 'Sam', cells, marks: cells.map((_, i) => [10, 11, 12, 13, 14, 3, 21].includes(i)), lines: [[10, 11, 12, 13, 14]], winIdx: 14, time: new Date(2027, 1, 14, 21, 42).getTime(), square: cells[14] });

    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
    x.fillStyle = '#fff6e9'; x.fillRect(0, 0, 1200, 630);
    for (let i = 0; i < 46; i++) { x.globalAlpha = .45; x.fillStyle = cols[i % 5]; x.save(); x.translate((i * 137) % 600, (i * 241) % 630); x.rotate(i); x.fillRect(-9, -3, 18, 6); x.restore(); }
    x.globalAlpha = 1;
    x.fillStyle = 'rgba(255,246,233,.88)'; x.fillRect(40, 70, 560, 490);
    x.fillStyle = '#6b5a7a'; x.font = '800 20px ' + R; x.letterSpacing = '5px'; x.fillText('FREE PARTY BINGO CARDS', 64, 130); x.letterSpacing = '0px';
    x.font = '900 78px ' + R; x.fillStyle = '#2b1d3d'; x.fillText('Watch-Party', 58, 225); x.fillStyle = '#ff4f6d'; x.font = '900 96px ' + R; x.fillText('Bingo', 58, 322);
    x.fillStyle = '#2b1d3d'; x.font = '700 30px ' + R;
    ['One link. A different card', 'on every guest’s phone.'].forEach((l, i) => x.fillText(l, 64, 392 + i * 40));
    x.font = '600 23px ' + R; x.fillStyle = '#4a3a5c'; x.fillText('Or print a stack of unique cards.', 64, 482);
    x.fillStyle = '#6b5a7a'; x.font = '700 19px ' + R; x.fillText('lanternlab2027.github.io/lab/partybingo', 64, 540);
    const draw = (cv, cx, cy, w, h, rot, shadow) => { x.save(); x.translate(cx, cy); x.rotate(rot); x.shadowColor = 'rgba(43,29,61,.35)'; x.shadowBlur = shadow; x.shadowOffsetY = 12; x.fillStyle = '#2b1d3d'; rr(x, -w / 2, -h / 2, w, h, 18); x.fill(); x.shadowColor = 'transparent'; x.drawImage(cv, -w / 2, -h / 2, w, h); x.restore(); };
    draw(phone(11, [2, 7]), 745, 330, 250, 500, -0.1, 30);
    draw(phone(42, [0, 18, 24]), 1075, 330, 250, 500, 0.1, 30);
    x.save(); x.translate(910, 318); x.rotate(0); x.shadowColor = 'rgba(43,29,61,.4)'; x.shadowBlur = 34; x.shadowOffsetY = 14; x.fillStyle = '#fff'; rr(x, -164, -205, 328, 410, 18); x.fill(); x.restore();
    x.save(); rr(x, 910 - 164, 318 - 205, 328, 410, 18); x.clip(); x.drawImage(res, 910 - 164, 318 - 205, 328, 410); x.restore();
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(__dirname, '../../docs/partybingo/og.png'), Buffer.from(url.split(',')[1], 'base64'));
  await b.close(); srv.close();
})();
