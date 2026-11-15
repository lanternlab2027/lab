// Checks docs/partybingo/qr.js two ways:
//  1. OpenCV scans the codes back (OpenCV's own decoder is unreliable above ~v17, so scans stop at ~500 bytes);
//  2. every version 1-40 at M and L is compared module-for-module with Kazuhiko Arase's reference encoder
//     (MIT, shipped inside npm's qrcode-terminal), forcing the same mask. Skipped if that copy isn't on disk.
// Run: node bots/partybingo/test_qr.js   (needs python3 with cv2)
const Q = require('../../docs/partybingo/qr.js');
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbqr-'));
const base = 'https://lanternlab2027.github.io/lab/partybingo/#g=z';
const rnd = (n) => { let s = '', x = 7; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) >>> 0; s += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[x >>> 26]; } return s; };
const cases = ['HELLO', 'Watch-Party Bingo ünïcødé ✨', base + rnd(10), base + rnd(60), base + rnd(150), base + rnd(300), base + rnd(450)];
const files = cases.map((t, i) => {
  const q = Q.encode(t), s = 6, quiet = 4, n = (q.size + quiet * 2) * s;
  const px = Buffer.alloc(n * n, 255);
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.get(x, y)) for (let dy = 0; dy < s; dy++) px.fill(0, ((y + quiet) * s + dy) * n + (x + quiet) * s, ((y + quiet) * s + dy) * n + (x + quiet) * s + s);
  const f = path.join(dir, `q${i}.pgm`);
  fs.writeFileSync(f, Buffer.concat([Buffer.from(`P5 ${n} ${n} 255\n`), px]));
  return { f, t, v: q.version, ecl: q.ecl, mask: q.mask };
});
const py = `
import sys, cv2
d = cv2.QRCodeDetector()
for f in sys.argv[1:]:
    img = cv2.imread(f, cv2.IMREAD_GRAYSCALE)
    val, pts, _ = d.detectAndDecode(img)
    print(val.encode('utf-8').hex())
`;
const out = execFileSync('python3', ['-I', '-c', py, ...files.map((x) => x.f)]).toString().trim().split('\n');
let fails = 0;
files.forEach((x, i) => {
  const got = Buffer.from(out[i] || '', 'hex').toString('utf8'), ok = got === x.t;
  if (!ok) fails++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} v${x.v}-${x.ecl} mask ${x.mask}, ${Buffer.byteLength(x.t)} bytes`);
});
fs.rmSync(dir, { recursive: true });
console.log(`${files.length - fails}/${files.length} QR codes scanned back exactly by OpenCV`);

const REF = ['/opt/node22', '/opt/node21', '/opt/node20'].map((p) => p + '/lib/node_modules/npm/node_modules/qrcode-terminal/vendor/QRCode/').find((p) => fs.existsSync(p + 'index.js'));
if (!REF) console.log('  skip reference comparison (qrcode-terminal not found)');
else {
  const R = require(REF + 'index.js'), L = require(REF + 'QRErrorCorrectLevel.js');
  const seen = new Set(); let diffs = 0;
  for (const ecl of ['M', 'L']) for (let len = 1; len <= 2950; len += 11) {
    let q; try { q = Q.encode('h' + rnd(len), { ecl }); } catch (e) { break; }
    const r = new R(q.version, L[q.ecl]); r.addData('h' + rnd(len)); r.makeImpl(false, q.mask);
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (!!r.modules[y][x] !== q.get(x, y)) diffs++;
    seen.add(q.version + q.ecl);
  }
  const ok = diffs === 0 && seen.size >= 70;
  if (!ok) fails++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${seen.size} version/level combos identical to the reference encoder (${diffs} differing modules)`);
}
process.exit(fails ? 1 : 0);
