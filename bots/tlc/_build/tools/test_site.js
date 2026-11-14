// Usage: node test_sites.js <site_root> <shots_dir>
// Serves <site_root> (containing tlc/) and tests the TLC site at 390px and 1280px.
// api.convertkit.com is routed to a stub: 200 OK at 390px, 401 at 1280px (exercises the TAGID_ placeholder fallback).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const ROOT = process.argv[2], SHOTS = process.argv[3];
const PORT = 8793;
const SITES = [
  { dir: 'tlc', code: 'TLC', tag: '25846742', min: 100, mock: { n: 80, timer: /^(2:00:00|1:59:\d\d)$/ } },
];
const VIEWPORTS = [{ w: 390, h: 844, kitStatus: 200 }, { w: 1280, h: 900, kitStatus: 200 }];
const fails = [];
const check = (cond, msg) => { if (!cond) { fails.push(msg); console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) for (const s of SITES) {
      const L = `${s.dir}@${vp.w}`;
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error' && !/401|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
      let kitReq = null;
      await page.route('https://api.convertkit.com/**', async route => {
        kitReq = { url: route.request().url(), body: route.request().postData(), method: route.request().method() };
        await route.fulfill({ status: vp.kitStatus, contentType: 'application/json', body: vp.kitStatus === 200 ? '{"subscription":{"id":1}}' : '{"error":"stub"}' });
      });
      const base = `http://127.0.0.1:${PORT}/${s.dir}/`;
      const overflow = async (label) => {
        const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.body.scrollWidth]);
        check(w[0] <= vp.w && w[1] <= vp.w, `${L} ${label}: no horizontal overflow (${w})`);
      };

      // index
      await page.goto(base + 'index.html');
      await page.waitForFunction(() => document.querySelector('.count') && /^\d+$/.test(document.querySelector('.count').textContent));
      const count = +(await page.textContent('.count'));
      check(count >= s.min && count <= 150, `${L} index shows ${count} questions`);
      check(/Not affiliated with the City of New York or the NYC Taxi & Limousine Commission \(TLC\)/.test(await page.textContent('.disclaimer')), `${L} index disclaimer`);
      const title = await page.title(); const desc = await page.getAttribute('meta[name=description]', 'content');
      check(/TLC Exam Practice Test/.test(title) && /TLC exam practice test/i.test(desc) && desc.length <= 170, `${L} SEO title "${title}" / description ${desc.length} chars`);
      check(/not affiliated/i.test(await page.textContent('footer')), `${L} footer disclaimer`);
      check(/up to 2 hours/.test(await page.textContent('.facts')) && /80 questions in 2 hours/.test(await page.textContent('main')), `${L} page states 80 Q / 2 h format and mock basis`);
      const cites = await page.$$eval('.facts .cite a', as => as.map(a => a.href));
      check(cites.length >= 6 && cites.every(h => h.startsWith('https://www.nyc.gov/')), `${L} ${cites.length} fact citation links, all nyc.gov`);
      await overflow('index');
      await page.screenshot({ path: path.join(SHOTS, `${s.dir}-${vp.w}-index.png`), fullPage: true });

      // free run
      await page.click('a.btn[href^="quiz.html"]');
      await page.waitForSelector('#runner:not(.hidden)');
      check((await page.textContent('#qcount')) === 'Question 1 of 10', `${L} free run starts at 1 of 10`);
      for (let i = 0; i < 10; i++) {
        await page.click('#opts .opt >> nth=1');
        await page.waitForSelector('#feedback:not(.hidden)');
        if (i === 0) {
          const fb = await page.textContent('#feedback');
          check(/Source:/.test(fb) && /“/.test(fb), `${L} feedback shows source + quote`);
          const href = await page.getAttribute('#feedback .cite a', 'href');
          check(/^https:\/\/www\.nyc\.gov\//.test(href), `${L} feedback cite link ${href}`);
          await overflow('question w/ feedback');
          await page.screenshot({ path: path.join(SHOTS, `${s.dir}-${vp.w}-feedback.png`), fullPage: true });
        }
        await page.click('#next');
      }
      await page.waitForSelector('#gate:not(.hidden)');
      check(/\d+ \/ 10/.test(await page.textContent('#resScore')), `${L} score shown after 10`);
      await overflow('gate');
      await page.screenshot({ path: path.join(SHOTS, `${s.dir}-${vp.w}-gate.png`), fullPage: true });

      // gate
      await page.fill('#email', 'nope');
      await page.click('#gateBtn');
      check(/valid email/.test(await page.textContent('#gateMsg')), `${L} invalid email rejected`);
      check(kitReq === null, `${L} no Kit call for invalid email`);
      await page.fill('#email', 'test@example.com');
      await page.click('#gateBtn');
      await page.waitForSelector('#unlocked:not(.hidden)');
      check(kitReq && kitReq.method === 'POST' && kitReq.url === `https://api.convertkit.com/v3/tags/${s.tag}/subscribe`, `${L} Kit POST to ${s.tag} placeholder URL`);
      const body = kitReq ? JSON.parse(kitReq.body) : {};
      check(body.email === 'test@example.com' && typeof body.api_key === 'string' && body.api_key.length > 10 && body.fields && body.fields.building_address === s.code,
        `${L} Kit body has email, api_key (not shown), fields.building_address=${body.fields && body.fields.building_address}`);
      check(await page.isVisible('#buyBtn'), `${L} buy button visible`);
      const mockBtns = await page.$$('#mockButtons button');
      check(mockBtns.length === 1, `${L} 1 mock button`);
      await overflow('unlocked');
      await page.screenshot({ path: path.join(SHOTS, `${s.dir}-${vp.w}-unlocked.png`), fullPage: true });

      await page.reload();
      await page.waitForSelector('#unlocked:not(.hidden)');
      check(true, `${L} unlock persists after reload`);

      await page.click('#startAll');
      check((await page.textContent('#qcount')) === `Question 1 of ${count}`, `${L} full practice has ${count}`);

      // mock: full run
      await page.reload();
      await page.waitForSelector('#unlocked:not(.hidden)');
      await page.click('#mockButtons button >> nth=0');
      await page.waitForSelector('#timer:not(.hidden)');
      check((await page.textContent('#qcount')) === `Question 1 of ${s.mock.n}`, `${L} mock has ${s.mock.n} questions`);
      const t = await page.textContent('#timer');
      check(s.mock.timer.test(t), `${L} mock timer ${t}`);
      check(await page.isVisible('#finishEarly'), `${L} finish-early visible`);
      await page.click('#opts .opt >> nth=0');
      check(await page.isHidden('#feedback'), `${L} no feedback during mock`);
      await overflow('mock question');
      await page.screenshot({ path: path.join(SHOTS, `${s.dir}-${vp.w}-mock.png`) });
      for (let i = 0; i < s.mock.n; i++) {
        if (i > 0) await page.click('#opts .opt >> nth=0');
        await page.click('#next');
      }
      await page.waitForSelector('#review:not(.hidden)');
      const items = await page.$$eval('#reviewList > li', l => l.length);
      check(items === s.mock.n, `${L} review lists ${items}`);
      const rt = await page.textContent('#resText');
      check(/that would be a pass|below the pass mark/.test(rt), `${L} mock result: ${rt.slice(0, 80)}`);
      await overflow('mock review');

      // finish early
      await page.reload();
      await page.waitForSelector('#unlocked:not(.hidden)');
      await page.click('#mockButtons button >> nth=0');
      page.once('dialog', d => d.accept());
      await page.click('#finishEarly');
      await page.waitForSelector('#results:not(.hidden)');
      check(/^0 \//.test(await page.textContent('#resScore')) && /below the pass mark/.test(await page.textContent('#resText')), `${L} finish early: unanswered count wrong`);

      // timer expiry
      await page.reload();
      await page.waitForSelector('#unlocked:not(.hidden)');
      await page.click('#mockButtons button >> nth=0');
      await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 2 * 3600 * 1000; });
      await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
      check(/^Time is up\./.test(await page.textContent('#resText')), `${L} timer expiry ends the exam`);

      await page.goto(base + 'quiz.html?exam=NOPE');
      await page.waitForSelector('#error:not(.hidden)');
      check(true, `${L} invalid ?exam= shows error`);

      check(errors.length === 0, `${L} no JS errors ${errors.join(' | ')}`);
      await ctx.close();
    }
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const p = await ctx.newPage();
    for (const s of SITES) {
      await p.goto(`http://127.0.0.1:${PORT}/${s.dir}/quiz.html`);
      await p.waitForSelector('#runner:not(.hidden)');
      await p.screenshot({ path: path.join(SHOTS, `${s.dir}-quiz-dark.png`) });
    }
    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }
  console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
})();
