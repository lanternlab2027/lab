// Builds docs/bingo/og.png (1200x630) from three sample cards. Run: NODE_PATH=/opt/npm-tools/node_modules node bots/bingo/make_og.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const srv = require('./serve.js')(8812);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('http://127.0.0.1:8812/bingo/');
  const url = await pg.evaluate(() => {
    const ideas = BingoIdeas;
    const mk = (theme, seed, checks) => {
      const c = BingoCodec.blank({ size: 5, theme });
      c.goals = c.goals.map((_, i) => i === 12 ? '' : ideas[(i + seed) % 7].ideas[(i * 3 + seed) % 15]);
      checks.forEach((i) => (c.checked[i] = true));
      return BingoRender.render(BingoCodec.normalize(c), 'story', 0.5);
    };
    const cards = [mk('midnight', 2, [0, 6, 18, 24, 3]), mk('sunset', 4, [5, 7, 9]), mk('confetti', 0, [0, 1, 2, 3, 4, 8, 16])];
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d');
    x.fillStyle = '#fff6e9'; x.fillRect(0, 0, 1200, 630);
    const cols = ['#ff4f6d', '#ffb020', '#22b07d', '#3a86ff', '#9b5de5'];
    for (let i = 0; i < 40; i++) { x.globalAlpha = .5; x.fillStyle = cols[i % 5]; x.save(); x.translate((i * 137) % 560, (i * 241) % 630); x.rotate(i); x.fillRect(-9, -3, 18, 6); x.restore(); }
    x.globalAlpha = 1;
    const R = 'ui-rounded, "SF Pro Rounded", -apple-system, "Segoe UI", Inter, Arial, sans-serif';
    x.fillStyle = 'rgba(255,246,233,.85)'; x.fillRect(40, 90, 520, 450);
    x.fillStyle = '#6b5a7a'; x.font = '800 20px ' + R; x.letterSpacing = '5px'; x.fillText('NEW YEAR RESOLUTION BINGO', 64, 150); x.letterSpacing = '0px';
    x.font = '900 104px ' + R; x.fillStyle = '#ff4f6d'; x.fillText('2027', 60, 260);
    x.fillStyle = '#2b1d3d'; x.fillText('Goal', 60, 360); x.fillStyle = '#3a86ff'; x.fillText('Bingo', 60 + x.measureText('Goal ').width, 360);
    x.fillStyle = '#2b1d3d'; x.font = '600 26px ' + R;
    ['Make your card, print it or make it', 'your wallpaper, check off all year.', 'Free. No sign-up.'].forEach((l, i) => x.fillText(l, 64, 420 + i * 36));
    x.fillStyle = '#6b5a7a'; x.font = '700 19px ' + R; x.fillText('lanternlab2027.github.io/lab/bingo', 64, 580);
    [[cards[0], 760, 330, -0.08], [cards[1], 1060, 335, 0.08], [cards[2], 910, 318, 0]].forEach(([cv, cx, cy, rot]) => {
      const w = 290, h = w * 16 / 9; x.save(); x.translate(cx, cy); x.rotate(rot);
      x.shadowColor = 'rgba(43,29,61,.35)'; x.shadowBlur = 30; x.shadowOffsetY = 12; x.fillStyle = '#000'; x.fillRect(-w / 2, -h / 2, w, h); x.shadowColor = 'transparent';
      x.drawImage(cv, -w / 2, -h / 2, w, h); x.restore();
    });
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(__dirname, '../../docs/bingo/og.png'), Buffer.from(url.split(',')[1], 'base64'));
  await b.close(); srv.close();
})();
