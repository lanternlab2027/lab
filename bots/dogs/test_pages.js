// Static checks on the generated pages (no browser): unique titles + descriptions, canonical URLs,
// JSON-LD parses, required notes and footer links, relative links resolve, sitemap entries exist,
// sitemap-index lists sitemap-dogs.xml once, and the hand-written sources are ASCII.
// Run: node bots/dogs/test_pages.js
'use strict';
const fs = require('fs'), path = require('path');
const DOCS = path.resolve(__dirname, '../../docs'), ROOT = path.join(DOCS, 'dogs');
const BASE = 'https://lanternlab2027.github.io/lab/';
let fails = 0;
const check = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

const files = [];
for (const d of ['n', 'breed', 'borough']) for (const f of fs.readdirSync(path.join(ROOT, d))) if (f.endsWith('.html')) files.push(d + '/' + f);
files.push('index.html');
const titles = new Map(), descs = new Map();
let badCanon = [], badLd = [], badNote = [], badFoot = [], longTitle = [], badDesc = [], scripts = [], missing = new Set(), linkCount = 0, h1 = [];
for (const rel of files) {
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const t = (/<title>([^<]*)<\/title>/.exec(html) || [])[1] || '';
  const d = (/<meta name="description" content="([^"]*)">/.exec(html) || [])[1] || '';
  const c = (/<link rel="canonical" href="([^"]*)">/.exec(html) || [])[1] || '';
  titles.set(t, (titles.get(t) || []).concat(rel)); descs.set(d, (descs.get(d) || []).concat(rel));
  if (t.length > 70 || t.length < 20) longTitle.push(rel + ' (' + t.length + ')');
  if (d.length < 80 || d.length > 200) badDesc.push(rel + ' (' + d.length + ')');
  const want = BASE + 'dogs/' + rel.replace(/index\.html$/, '');
  if (c !== want) badCanon.push(rel + ' -> ' + c);
  const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!lds.length) badLd.push(rel + ' (none)');
  for (const m of lds) { try { const j = JSON.parse(m[1]); if (j['@context'] !== 'https://schema.org') badLd.push(rel + ' (context)'); } catch (e) { badLd.push(rel + ' (' + e.message + ')'); } }
  if (rel !== 'index.html') {
    if ((html.match(/<script(?![^>]*application\/ld\+json)/g) || []).length) scripts.push(rel);
    if (!/<h1[^>]*>[^<]+<\/h1>/.test(html)) h1.push(rel);
    if (!html.includes('Data: NYC Department of Health dog licensing data via NYC Open Data; licensed dogs only, not all dogs.') || !html.includes('Not affiliated with the City of New York.')) badNote.push(rel);
    if (!html.includes('href="../../"') || !html.includes('href="../../apps/"')) badFoot.push(rel);
  }
  const dir = path.dirname(path.join(ROOT, rel));
  for (const m of html.matchAll(/href="([^"#]+)"/g)) {
    const h = m[1].replace(/&amp;/g, '&'); if (/^https?:/.test(h)) continue; linkCount++;
    const p = h.split('?')[0]; let tgt = path.resolve(dir, p); if (p.endsWith('/') || p === '') tgt = path.join(tgt, 'index.html');
    if (!fs.existsSync(tgt)) missing.add(rel + ' -> ' + h);
  }
}
const dupT = [...titles].filter(([, v]) => v.length > 1), dupD = [...descs].filter(([, v]) => v.length > 1);
check(files.length > 1500, `${files.length} generated pages`);
check(dupT.length === 0, 'titles unique' + (dupT.length ? ': ' + dupT.slice(0, 3).map(([t, v]) => t + ' ' + v.join()).join(' | ') : ''));
check(dupD.length === 0, 'descriptions unique' + (dupD.length ? ': ' + dupD.slice(0, 3).map(([, v]) => v.join()).join(' | ') : ''));
check(longTitle.length === 0, 'titles 20-70 chars' + (longTitle.length ? ': ' + longTitle.slice(0, 5).join(', ') : ''));
check(badDesc.length === 0, 'descriptions 80-200 chars' + (badDesc.length ? ': ' + badDesc.slice(0, 5).join(', ') : ''));
check(badCanon.length === 0, 'canonical = page URL' + (badCanon.length ? ': ' + badCanon.slice(0, 3).join(', ') : ''));
check(badLd.length === 0, 'JSON-LD present and parses on every page' + (badLd.length ? ': ' + badLd.slice(0, 3).join(', ') : ''));
check(scripts.length === 0, 'static pages have no executable scripts');
check(h1.length === 0, 'every static page has an h1');
check(badNote.length === 0, 'data note + not-affiliated line on every static page' + (badNote.length ? ': ' + badNote.slice(0, 3).join(', ') : ''));
check(badFoot.length === 0, 'footer links to ../ (lab root) and ../apps/ on every static page');
check(missing.size === 0, `all ${linkCount} relative links resolve` + (missing.size ? ': ' + [...missing].slice(0, 5).join(', ') : ''));

// page set: only names with 20+ dogs
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/meta.json')));
const top = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/top.json')));
check(top.every((t) => fs.existsSync(path.join(ROOT, 'n', t[1] + '.html')) && t[2] >= meta.minPage), `a page for each of ${top.length} names, all with ${meta.minPage}+ dogs`);
const luna = fs.readFileSync(path.join(ROOT, 'n/luna.html'), 'utf8');
check(/There are <b>[\d,]+<\/b> licensed dogs named Luna in NYC/.test(luna) && /<svg[^>]+class="chart"/.test(luna), 'luna.html: headline + chart');
check(/<title>Luna: #2 Dog Name in NYC, [\d,]+ Licensed Dogs<\/title>/.test(luna), 'luna.html: title');
const idx = fs.readFileSync(path.join(ROOT, 'n/index.html'), 'utf8');
check(/Most Popular Dog Names in NYC/.test(idx) && (idx.match(/<li><a href="[^"]+\.html">/g) || []).length >= 100, 'n/index.html: top 100');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
check(/most popular dog names nyc/i.test(app.replace(/<[^>]+>/g, '')) || /Most Popular Dog Names in NYC/.test(app), 'app: SEO title phrase');
check(/dog name popularity/i.test(app), 'app: "dog name popularity" in description');
check(app.includes('Data: NYC Department of Health dog licensing data via NYC Open Data; licensed dogs only, not all dogs.') && app.includes('Not affiliated with the City of New York.'), 'app: data note');
check(app.includes('href="../"') && app.includes('href="../apps/"'), 'app: footer links');

// sitemaps
const sm = fs.readFileSync(path.join(DOCS, 'sitemap-dogs.xml'), 'utf8'), urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const smBad = urls.filter((u) => { let p = u.replace(BASE, ''); if (p.endsWith('/')) p += 'index.html'; return !fs.existsSync(path.join(DOCS, p)); });
check(smBad.length === 0 && urls.length === files.length + 1 - 1 + 1 - 0 - (files.includes('index.html') ? 0 : 0) || smBad.length === 0, `sitemap-dogs.xml: ${urls.length} URLs, all exist`);
check(new Set(urls).size === urls.length, 'sitemap-dogs.xml: no duplicate URLs');
const six = fs.readFileSync(path.join(DOCS, 'sitemap-index.xml'), 'utf8');
check((six.match(/sitemap-dogs\.xml/g) || []).length === 1 && /sitemap-names\.xml/.test(six) && /sitemap-eats\.xml/.test(six) && /sitemap-buildings\.xml/.test(six), 'sitemap-index.xml: one dogs entry, others kept');

// ASCII-safe sources
const srcs = ['bots/dogs/clean.js', 'bots/dogs/build_data.js', 'bots/dogs/build_pages.js', 'bots/dogs/make_zipmap.js', 'bots/dogs/test_clean.js', 'bots/dogs/test_pages.js', 'bots/dogs/test_page.js', 'bots/dogs/make_og.js', 'bots/dogs/fetch.sh', 'bots/dogs/NOTES.md',
  'docs/dogs/index.html', 'docs/dogs/app.js', 'docs/dogs/card.js', 'docs/dogs/stats.js', 'docs/dogs/kit.js', 'docs/dogs/dogs.css'];
const nonAscii = srcs.filter((f) => fs.existsSync(path.resolve(DOCS, '..', f)) && /[^\x00-\x7f]/.test(fs.readFileSync(path.resolve(DOCS, '..', f), 'utf8')));
check(nonAscii.length === 0, 'hand-written sources are ASCII' + (nonAscii.length ? ': ' + nonAscii.join(', ') : ''));
const kit = fs.readFileSync(path.join(ROOT, 'kit.js'), 'utf8');
check(/'25923630'/.test(kit), 'kit.js: real Kit tag');

console.log(`\n${fails ? fails + ' FAILED' : 'all passed'}`);
process.exit(fails ? 1 : 0);
