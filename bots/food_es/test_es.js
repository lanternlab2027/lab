// Playwright test for docs/food/es/. Usage: node test_es.js <baseURL e.g. http://127.0.0.1:8793/food/> <shotDir>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2];
const SHOTS = process.argv[3];
const bank = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/food/es/questions/FPCES.json'), 'utf8'));
const byQ = {}; bank.questions.forEach(q => { byQ[q.question] = q; });

let pass = 0, failN = 0;
function check(name, ok, extra) { if (ok) pass++; else { failN++; console.log('FAIL', name, extra || ''); } }

async function noOverflow(page, label, w) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`no horizontal overflow: ${label} @${w}`, o <= 0, 'overflow=' + o);
}

async function answerCurrent(page, correct) {
  const qt = await page.textContent('#qtext');
  const q = byQ[qt];
  if (!q) return { q: null };
  const want = q.options[q.answer];
  const btns = await page.$$('#opts .opt');
  let target = null;
  for (const b of btns) {
    const t = (await b.textContent()).slice(1).trim();
    if ((t === want) === correct) { target = b; break; }
  }
  await target.click();
  return { q };
}

async function run(width) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // The stubbed Kit 500 (placeholder-tag test) logs a network error by design; ignore only that.
  page.on('console', m => { if (m.type() === 'error' && !/status of 500/.test(m.text())) errors.push(m.text()); });
  const kitCalls = [];
  let kitStatus = 200;
  await ctx.route('**/api.convertkit.com/**', async route => {
    const req = route.request();
    kitCalls.push({ url: req.url(), body: req.postDataJSON() });
    await route.fulfill({ status: kitStatus, contentType: 'application/json', body: kitStatus === 200 ? '{"subscription":{}}' : '{"error":"x"}' });
  });

  // ---- landing ----
  await page.goto(BASE + 'es/');
  check('index lang=es', (await page.getAttribute('html', 'lang')) === 'es');
  const title = await page.title();
  check('index title Spanish', /Examen de Protección de Alimentos NYC/.test(title) && /práctica/.test(title), title);
  const desc = await page.getAttribute('meta[name=description]', 'content');
  check('index description', /protección de alimentos de NYC/i.test(desc) && /práctica/i.test(desc), desc);
  check('hreflang en alternate', (await page.$$('link[rel=alternate][hreflang=en]')).length === 1);
  check('disclaimer', (await page.textContent('.disclaimer')).includes('No afiliado con la Ciudad de Nueva York'));
  await page.waitForFunction(() => document.querySelector('.count').textContent === '131');
  check('count 131', true);
  check('english link', (await page.getAttribute('header .langlink', 'href')) === '../');
  await noOverflow(page, 'index', width);
  await page.screenshot({ path: `${SHOTS}/es_index_${width}.png`, fullPage: true });
  await page.click('header .langlink');
  await page.waitForLoadState();
  check('english page reached', (await page.getAttribute('html', 'lang')) === 'en' && page.url().endsWith('/food/'));
  check('english page links back', (await page.getAttribute('header .langlink', 'href')) === 'es/');
  await page.click('header .langlink');
  await page.waitForLoadState();
  check('back to spanish', page.url().endsWith('/food/es/'));

  // ---- free sample ----
  await page.click('text=Empezar la práctica gratis');
  await page.waitForSelector('#runner:not(.hidden)');
  check('quiz lang=es', (await page.getAttribute('html', 'lang')) === 'es');
  check('quiz title', /Protección de Alimentos de NYC/.test(await page.textContent('#title')));
  check('mode label', (await page.textContent('#qmode')) === 'Muestra gratis');
  check('qcount', (await page.textContent('#qcount')) === 'Pregunta 1 de 10');
  for (let i = 0; i < 10; i++) {
    const { q } = await answerCurrent(page, i % 2 === 0);
    check('question found in bank', !!q);
    const fb = await page.textContent('#feedback');
    check('verdict text', i % 2 === 0 ? fb.startsWith('¡Correcto!') : fb.startsWith('No es correcto. La respuesta es:'), fb.slice(0, 60));
    const pre = q.source.lang === 'en' ? 'Fuente (inglés):' : 'Fuente:';
    check('cite prefix ' + q.id, fb.includes(pre) && (q.source.lang === 'en' || !fb.includes('Fuente (inglés)')));
    if (i === 0) { await noOverflow(page, 'feedback', width); await page.screenshot({ path: `${SHOTS}/es_feedback_${width}.png`, fullPage: true }); }
    await page.click('#next');
  }
  check('free result text', (await page.textContent('#resText')).includes('Esa fue la muestra gratis de 10 preguntas.'));
  check('gate shown', await page.isVisible('#gate'));
  check('gate title', (await page.textContent('#gateTitle')) === 'Desbloquee las 131 preguntas y el examen de práctica con reloj');
  await noOverflow(page, 'gate', width);
  await page.screenshot({ path: `${SHOTS}/es_gate_${width}.png`, fullPage: true });

  // invalid email
  await page.fill('#email', 'no-es-correo');
  await page.click('#gateBtn');
  check('invalid email msg', (await page.textContent('#gateMsg')) === 'Escriba un correo electrónico válido.');
  check('no kit call for invalid', kitCalls.length === 0);

  // Kit success unlocks (real tag)
  kitStatus = 200;
  await page.fill('#email', 'prueba@example.com');
  await page.click('#gateBtn');
  await page.waitForSelector('#unlocked:not(.hidden)');
  check('kit called once', kitCalls.length === 1);
  const c = kitCalls[0];
  check('kit url tag', c.url === 'https://api.convertkit.com/v3/tags/25845321/subscribe', c.url);
  check('kit body email', c.body.email === 'prueba@example.com');
  check('kit body field', c.body.fields && c.body.fields.building_address === 'FPCES');
  check('kit body has api_key', typeof c.body.api_key === 'string' && c.body.api_key.length > 10);
  check('unlocked text', (await page.textContent('#unlockedText')).startsWith('Practique las 131 preguntas'));
  check('no buy button', (await page.$('#buyBtn')) === null);

  // persists after reload
  await page.reload();
  await page.waitForSelector('#unlocked:not(.hidden)');
  check('unlock persists', true);
  check('mock button label', (await page.textContent('#mockButtons button')) === 'Examen de práctica: 50 preguntas, 60 min');
  await noOverflow(page, 'unlocked', width);

  // ---- full bank: every question, check citation prefix vs source lang ----
  if (width === 390) {
    await page.click('#startAll');
    check('full count', (await page.textContent('#qcount')) === 'Pregunta 1 de 131');
    const seen = new Set();
    for (let i = 0; i < 131; i++) {
      const { q } = await answerCurrent(page, true);
      seen.add(q.id);
      const fb = await page.innerHTML('#feedback');
      const pre = q.source.lang === 'en' ? 'Fuente (inglés): ' : 'Fuente: ';
      check('full cite ' + q.id, fb.includes(pre) && fb.includes(q.source.url.replace(/&/g, '&amp;')));
      if (q.source.lang === 'en') check('blockquote lang en ' + q.id, fb.includes('<blockquote lang="en">'));
      await noOverflow(page, 'q ' + q.id, width);
      await page.click('#next');
    }
    check('all 131 seen', seen.size === 131, seen.size);
    check('full result 100%', (await page.textContent('#resText')).startsWith('100% de respuestas correctas.'));
  }

  // ---- mock ----
  await page.reload();
  await page.waitForSelector('#unlocked:not(.hidden)');
  await page.click('#mockButtons button');
  check('mock count', (await page.textContent('#qcount')) === 'Pregunta 1 de 50');
  check('mock timer', (await page.textContent('#timer')) === '1:00:00', await page.textContent('#timer'));
  await answerCurrent(page, true);
  check('no feedback in mock', !(await page.isVisible('#feedback')));
  await page.click('#next');
  await answerCurrent(page, false);
  await noOverflow(page, 'mock', width);
  page.once('dialog', d => { check('confirm text', d.message().startsWith('¿Terminar el examen ahora?')); d.accept(); });
  await page.click('#finishEarly');
  await page.waitForSelector('#results:not(.hidden)');
  check('mock score', (await page.textContent('#resScore')) === '1 / 50');
  check('mock fail text', (await page.textContent('#resText')).includes('no alcanza para aprobar (70%, o sea 35 de 50)'));
  check('review length', (await page.$$('#reviewList > li')).length === 50);
  const rv = await page.textContent('#reviewList');
  check('review labels', rv.includes('Correcto') && rv.includes('Usted eligió:') && rv.includes('Sin contestar') && rv.includes('Respuesta:'));
  await noOverflow(page, 'review', width);
  await page.screenshot({ path: `${SHOTS}/es_review_${width}.png` });

  // ---- timer expiry (fresh page with fake clock) ----
  const p2 = await ctx.newPage();
  p2.on('pageerror', e => errors.push(e.message));
  await p2.clock.install();
  await p2.goto(BASE + 'es/quiz.html?exam=FPCES');
  await p2.waitForSelector('#unlocked:not(.hidden)');
  await p2.click('#mockButtons button');
  await p2.clock.fastForward('01:00:05');
  await p2.waitForSelector('#results:not(.hidden)');
  check('time up text', (await p2.textContent('#resText')).startsWith('Se acabó el tiempo.'));
  await p2.close();

  // ---- real tag: failure must NOT unlock (simulate by rewriting the placeholder) ----
  const p3ctx = await browser.newContext({ viewport: { width, height: 844 } });
  await p3ctx.route('**/api.convertkit.com/**', r => r.fulfill({ status: 500, body: '{}' }));
  await p3ctx.route('**/es/quiz.js', async r => {
    const resp = await r.fetch(); const body = (await resp.text()).replace(/25845321/g, '1234567');
    r.fulfill({ response: resp, body });
  });
  const p3 = await p3ctx.newPage();
  await p3.goto(BASE + 'es/quiz.html?exam=FPCES');
  await p3.waitForSelector('#runner:not(.hidden)');
  for (let i = 0; i < 10; i++) { await answerCurrent(p3, true); await p3.click('#next'); }
  await p3.fill('#email', 'prueba@example.com');
  await p3.click('#gateBtn');
  await p3.waitForFunction(() => document.querySelector('#gateMsg').classList.contains('err'));
  check('real tag + 500 stays locked', (await p3.textContent('#gateMsg')).startsWith('Lo sentimos') && !(await p3.isVisible('#unlocked')));
  await p3ctx.close();

  // ---- bad exam param ----
  await page.goto(BASE + 'es/quiz.html?exam=NOPE');
  await page.waitForSelector('#error:not(.hidden)');
  check('error text', (await page.textContent('#error')).includes('Esa prueba de práctica no existe en este sitio.'));
  await noOverflow(page, 'error', width);

  check(`no JS errors @${width}`, errors.length === 0, errors.join(' | '));
  await browser.close();
}

(async () => {
  for (const w of [390, 1280]) await run(w);
  console.log(`passed ${pass}, failed ${failN}`);
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
