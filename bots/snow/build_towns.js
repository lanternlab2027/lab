// Builds the Snow Day Odds town landing pages from bots/snow/towns.json (made by select_towns.js).
//   docs/snow/t/<st>/<slug>.html   one page per town (live widget: the app's own model.js/nws.js/card.js/app.js)
//   docs/snow/t/<st>/index.html    state index
//   docs/snow/t/index.html         all-states index
//   docs/snow/t/town.css           the app's CSS (copied from docs/snow/index.html at build time) + page extras
//   docs/sitemap-snow.xml          every page above
// and adds one <sitemap> entry for sitemap-snow.xml to docs/sitemap-index.xml if it isn't there yet.
//
// Run: node bots/snow/build_towns.js            (deterministic: same towns.json + index.html -> same files)
// Markup that must match the app (CSP, region picker, result card, signup box, footer) is cut out of
// docs/snow/index.html each run, so the town pages never drift from the main page.
'use strict';
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../../docs');
const SNOW = path.join(ROOT, 'snow');
const TDIR = path.join(SNOW, 't');
const SITE = 'https://lanternlab2027.github.io/lab/';
const BASE = SITE + 'snow/t/';
const LASTMOD = process.env.SNOW_TOWNS_DATE || '2026-11-15'; // fixed so rebuilds are byte-identical
const NEARBY = 6;
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'towns.json'), 'utf8'));
const TOWNS = DATA.towns;

// ---------- pieces of the main page ----------
const INDEX = fs.readFileSync(path.join(SNOW, 'index.html'), 'utf8');
function cut(re, what) { const m = re.exec(INDEX); if (!m) throw new Error('index.html: could not find ' + what); return m[0]; }
const CSP = cut(/<meta http-equiv="Content-Security-Policy"[^>]*>/, 'CSP meta');
const STYLE = cut(/<style>[\s\S]*?<\/style>/, '<style>').replace(/^<style>\n?/, '').replace(/<\/style>$/, '');
const REGION = cut(/<fieldset class="region">[\s\S]*?<\/fieldset>/, 'region fieldset');
const RESULT = cut(/<section id="result"[\s\S]*?<\/section>/, 'result section');
const SIGNUP = cut(/<section class="sheet signup" id="alert"[\s\S]*?<\/section>/, 'signup section');
const FOOTER = cut(/<footer class="wrap">[\s\S]*?<\/footer>/, 'footer')
  .replace(/href="\.\.\/apps\/"/g, 'href="../../../apps/"').replace(/href="\.\.\/"/g, 'href="../../../"');
if (/href="\.\.\/(?!\.\.)/.test(FOOTER)) throw new Error('footer has a relative link this build does not know how to move');

const EXTRA_CSS = `
/* ---- town pages ---- */
.crumbs { font-size: 13px; color: #b9c8e0; margin: 8px 0 0; }
.crumbs a { color: #d4e0f2; }
.crumbs ol { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
.crumbs li + li::before { content: "/"; margin-right: 4px; opacity: .7; }
h1.town { font-size: clamp(30px, 8vw, 50px); line-height: 1.05; }
.facts-local p { margin: 0 0 10px; }
ul.towns { list-style: none; margin: 8px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
ul.towns a { display: block; padding: 10px 12px; min-height: 44px; border-radius: 10px; background: var(--sheet); border: 1px solid var(--line); font-weight: 700; text-decoration: none; }
ul.towns a:hover { border-color: var(--ink); }
ul.towns small { display: block; color: var(--muted); font-weight: 600; font-size: 13px; }
.morelinks { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 12px 0 0; font-weight: 700; }
.morelinks a { min-height: 44px; display: inline-flex; align-items: center; }
`;

// ---------- helpers ----------
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function ascii(s, where) { if (/[^\x00-\x7e\n\t]/.test(s)) throw new Error('non-ASCII output in ' + where); return s; }
function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function miles(a, b) {
  const R = 3958.8, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function stSlug(st) { return st.toLowerCase(); }
function townUrl(t) { return BASE + stSlug(t.st) + '/' + t.slug + '.html'; }
function stateUrl(st) { return BASE + stSlug(st) + '/'; }
function jsonld(obj) { return '<script type="application/ld+json">\n' + JSON.stringify(obj, null, 1).replace(/</g, '\\u003c') + '\n</script>'; }
function kind(t) { const m = / (city|town|village|borough)$/.exec(t.censusName.replace(/ \(balance\)$/, '')); return m ? m[1] : 'city'; }
const isCounty = (c) => / (County|Parish)$/.test(c || '');

function head(o) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${CSP}
<meta name="referrer" content="no-referrer">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${o.url}">
<meta name="theme-color" content="#0b1a33">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lantern Lab">
<meta property="og:title" content="${esc(o.ogTitle || o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${o.url}">
<meta property="og:image" content="${SITE}snow/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Snow Day Odds: will school be canceled tomorrow? A snow-day chance meter.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.ogTitle || o.title)}">
<meta name="twitter:description" content="${esc(o.desc)}">
<meta name="twitter:image" content="${SITE}snow/og.png">
${jsonld(o.ld)}
<link rel="stylesheet" href="${o.up}town.css">
<script data-goatcounter="https://lanternlab.goatcounter.com/count" async src="${o.up}../../vendor/goatcounter/count.js"></script>
</head>
<body>
`;
}
function crumbsHtml(items) { // [[name, relHref|null]]
  return '<nav class="crumbs" aria-label="Breadcrumb"><ol>' + items.map(([n, h]) => '<li>' + (h ? '<a href="' + h + '">' + esc(n) + '</a>' : '<span aria-current="page">' + esc(n) + '</span>') + '</li>').join('') + '</ol></nav>';
}
function crumbsLd(items) { // [[name, absUrl]]
  return { '@type': 'BreadcrumbList', itemListElement: items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: u })) };
}
function promo(up) { // up = path from the page to docs/snow/t/
  return `<link rel="stylesheet" href="${up}../../apps/more.css">
<div id="more-apps" class="wrap" data-from="snow"></div>
<script src="${up}../../apps/more.js" defer></script>
`;
}
const DISCLAIMER = '<p class="disclaimer">Just for fun. Only your school district decides; check their official announcements.</p>';
const PUBLISHER = { '@type': 'Organization', name: 'Lantern Lab', url: SITE };

// ---------- group ----------
const byState = {};
for (const t of TOWNS) (byState[t.st] = byState[t.st] || []).push(t);
const STATES = Object.keys(byState).sort((a, b) => byState[a][0].state.localeCompare(byState[b][0].state));
const seenTitle = new Set();

function townPage(t) {
  const label = t.name + ', ' + t.st;
  const url = townUrl(t);
  const title = 'Snow Day Calculator for ' + label + ': Will School Be Canceled Tomorrow?';
  if (seenTitle.has(title)) throw new Error('duplicate title ' + title); seenTitle.add(title);
  const desc = 'Free snow day calculator for ' + t.name + ', ' + t.state + ': tomorrow\'s snow-day chance from the National Weather Service forecast for ZIP ' + t.zip + ' (snow, ice, timing, cold and winter alerts). Just for fun.';
  const crumbs = [['Lantern Lab', SITE], ['Snow Day Odds', SITE + 'snow/'], ['Towns', BASE], [t.state, stateUrl(t.st)], [t.name, url]];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': url, url, name: title, description: desc, inLanguage: 'en-US', isPartOf: { '@type': 'WebSite', name: 'Lantern Lab', url: SITE }, publisher: PUBLISHER,
      about: { '@type': 'City', name: label, geo: { '@type': 'GeoCoordinates', latitude: t.lat, longitude: t.lon } } },
    crumbsLd(crumbs),
  ] };
  const near = byState[t.st].filter((o) => o !== t).map((o) => ({ o, d: miles(t, o) })).sort((a, b) => a.d - b.d || a.o.slug.localeCompare(b.o.slug)).slice(0, NEARBY);

  // Local context: only Census facts carried in towns.json.
  const stName = (t.st === 'DC' ? 'the ' : '') + t.state;
  const cs = t.counties.filter(isCounty);
  let where = ' in ' + stName;
  if (cs.length === 1) where = ' in ' + cs[0] + ', ' + stName;
  else if (cs.length > 1 && cs.length === t.counties.length) where = ' in ' + stName + ' that spans ' + cs.length + ' counties (most residents live in ' + t.mainCounty + ')';
  const regionLabel = t.region === 'rare' ? 'Rarely sees snow' : 'Snow-used';
  const regionWhy = t.region === 'rare'
    ? t.name + ' is south of 36.5&deg; N, where an inch of snow or a glaze of ice can close schools'
    : t.name + ' is north of 36.5&deg; N, where schools usually expect to plow and keep going';
  const local = `<p>${esc(t.name)} is a ${kind(t)}${esc(where)}. The U.S. Census Bureau estimates its population at ${num(t.pop2024)} (July 1, 2024) and its land area at ${t.landSqMi.toFixed(1)} square miles.</p>
      <p>Forecast point: the center of ZIP code area ${t.zip}, the ZIP area whose center is nearest ${esc(t.name)}'s Census center point. Weather can differ across town, so type your own ZIP above for your exact spot.</p>
      <p>This page starts with &ldquo;${regionLabel}&rdquo; because ${regionWhy}. That is the same rule the main calculator uses for its first guess; switch it above if it doesn't fit your schools.</p>`;

  const form = `<form class="find" id="find" novalidate data-town-zip="${t.zip}" data-town-region="${t.region}" data-town-name="${esc(label)}">
      <div>
        <label class="lab" for="q">ZIP code or town</label>
        <div class="row">
          <input id="q" name="q" type="text" autocomplete="postal-code" autocapitalize="words" enterkeyhint="go" placeholder="${t.zip} or ${esc(label)}" value="${t.zip}" required>
          <button class="btn" id="go" type="submit">Check</button>
        </div>
        <button class="linkbtn" id="geo" type="button">Use my location</button>
      </div>
      ${REGION.replace(/ checked>/g, '>').replace('value="' + t.region + '">', 'value="' + t.region + '" checked>')}
    </form>`;

  const html = head({ title, desc, url, ld, up: '../', ogTitle: 'Snow day odds for ' + label }) + `<header class="hero">
  <div class="wrap">
    <a class="brand" href="../../../">Lantern Lab</a>
    ${crumbsHtml([['Snow Day Odds', '../../'], ['Towns', '../'], [t.state, './'], [t.name, null]])}
    <h1 class="town">Snow Day Calculator for ${esc(label)}</h1>
    <p class="lede">Will school be canceled tomorrow in ${esc(t.name)}? This page checks the National Weather Service forecast for ${esc(t.name)} and turns tonight's snow, ice, timing, cold and winter alerts into a snow-day chance, with the same points table as our main calculator.</p>
    ${form}
    <p class="status" id="status" role="status" aria-live="polite"></p>
  </div>
</header>

<main class="wrap">
  ${RESULT}

  ${SIGNUP}

  <section class="sheet facts-local" aria-labelledby="about-h">
    <h2 id="about-h">About ${esc(label)}</h2>
      ${local}
    <p class="small">Population and land area: U.S. Census Bureau, Vintage 2024 population estimates and 2025 Gazetteer Files. Forecast and alerts: National Weather Service API. <a href="../../#how">How we estimate</a>.</p>
    ${DISCLAIMER}
  </section>

  <section aria-labelledby="near-h">
    <h2 id="near-h">Snow day odds near ${esc(t.name)}</h2>
    ${near.length ? '<ul class="towns">' + near.map(({ o, d }) => `<li><a href="${o.slug}.html">${esc(o.name)}<small>${Math.max(1, Math.round(d))} mi away</small></a></li>`).join('') + '</ul>' : '<p>No other ' + esc(t.state) + ' towns have a page yet.</p>'}
    <p class="morelinks"><a href="./">All ${esc(t.state)} towns</a> <a href="../">All states</a> <a href="../../">Snow day calculator (any ZIP)</a></p>
  </section>
</main>

${promo('../')}${FOOTER}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="../../model.js"></script>
<script src="../../nws.js"></script>
<script src="../../card.js"></script>
<script src="../../app.js"></script>
<script src="../../kit.js"></script>
</body>
</html>
`;
  return ascii(html, url);
}

function simpleFooter(up) { // up = path from the page to docs/
  return `<footer class="wrap">
  <p><b>Not affiliated with the National Weather Service</b> or NOAA. Town names, populations and locations come from the U.S. Census Bureau; odds come from the NWS forecast on each town's page.</p>
  <p><a href="${up}">A Lantern Lab project</a> &middot; <a href="${up}apps/">More free apps &rarr;</a></p>
</footer>`;
}

function statePage(st) {
  const list = byState[st].slice().sort((a, b) => a.name.localeCompare(b.name));
  const sn = list[0].state, url = stateUrl(st);
  const title = 'Snow Day Calculator for ' + sn + ' Towns: Snow Day Odds by City';
  if (seenTitle.has(title)) throw new Error('duplicate title ' + title); seenTitle.add(title);
  const desc = 'Snow day odds for ' + list.length + ' ' + sn + ' ' + (list.length === 1 ? 'city' : 'cities and towns') + ', from the National Weather Service forecast. Pick a town to see tomorrow\'s snow-day chance. Just for fun.';
  const crumbs = [['Lantern Lab', SITE], ['Snow Day Odds', SITE + 'snow/'], ['Towns', BASE], [sn, url]];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', '@id': url, url, name: title, description: desc, inLanguage: 'en-US', isPartOf: { '@type': 'WebSite', name: 'Lantern Lab', url: SITE }, publisher: PUBLISHER },
    crumbsLd(crumbs),
  ] };
  const html = head({ title, desc, url, ld, up: '../' }) + `<header class="hero">
  <div class="wrap">
    <a class="brand" href="../../../">Lantern Lab</a>
    ${crumbsHtml([['Snow Day Odds', '../../'], ['Towns', '../'], [sn, null]])}
    <h1 class="town">Snow day odds in ${esc(sn)}</h1>
    <p class="lede">Pick a town to see tomorrow's snow-day chance from the National Weather Service forecast. Not on the list? <a href="../../" style="color:#fff">Use any ZIP code</a>.</p>
  </div>
</header>
<main class="wrap">
  <section aria-labelledby="list-h">
    <h2 id="list-h">${esc(sn)} towns</h2>
    <ul class="towns">${list.map((t) => `<li><a href="${t.slug}.html">${esc(t.name)}<small>ZIP ${t.zip}</small></a></li>`).join('')}</ul>
    <p class="small">The ${list.length === 1 ? 'city' : list.length + ' largest incorporated places'} in ${esc(sn)} by U.S. Census Bureau 2024 population estimate, alphabetically.</p>
    <p class="morelinks"><a href="../">All states</a> <a href="../../">Snow day calculator (any ZIP)</a></p>
    ${DISCLAIMER}
  </section>
</main>
${promo('../')}${simpleFooter('../../../')}
</body>
</html>
`;
  return ascii(html, url);
}

function allPage() {
  const url = BASE;
  const title = 'Snow Day Calculator by Town: Snow Day Odds for ' + TOWNS.length + ' U.S. Cities';
  const desc = 'Browse snow day odds for ' + TOWNS.length + ' U.S. cities and towns in ' + STATES.length + ' states, from Buffalo to Atlanta, built from the National Weather Service forecast. Just for fun.';
  const crumbs = [['Lantern Lab', SITE], ['Snow Day Odds', SITE + 'snow/'], ['Towns', url]];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', '@id': url, url, name: title, description: desc, inLanguage: 'en-US', isPartOf: { '@type': 'WebSite', name: 'Lantern Lab', url: SITE }, publisher: PUBLISHER },
    crumbsLd(crumbs),
  ] };
  const html = head({ title, desc, url, ld, up: '' }) + `<header class="hero">
  <div class="wrap">
    <a class="brand" href="../../">Lantern Lab</a>
    ${crumbsHtml([['Snow Day Odds', '../'], ['Towns', null]])}
    <h1 class="town">Snow day odds by town</h1>
    <p class="lede">Pick your state, then your town, to see tomorrow's snow-day chance from the National Weather Service forecast. Not listed? <a href="../" style="color:#fff">Use any ZIP code</a>.</p>
  </div>
</header>
<main class="wrap">
  <section aria-labelledby="st-h">
    <h2 id="st-h">States</h2>
    <ul class="towns">${STATES.map((st) => `<li><a href="${stSlug(st)}/">${esc(byState[st][0].state)}<small>${byState[st].length} ${byState[st].length === 1 ? 'town' : 'towns'}</small></a></li>`).join('')}</ul>
    <p class="small">How towns were picked: the largest incorporated places by U.S. Census Bureau 2024 population estimate in snow-belt, Northeast, Great Lakes, Upper Midwest and Mountain West states, plus the largest cities in southern states that rarely see snow, where an inch can close schools.</p>
    ${DISCLAIMER}
  </section>
</main>
${promo('')}${simpleFooter('../../')}
</body>
</html>
`;
  return ascii(html, url);
}

// ---------- write ----------
function write(file, s) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, s); }
// Remove stale generated pages (a town dropped from towns.json) but nothing else.
if (fs.existsSync(TDIR)) {
  for (const d of fs.readdirSync(TDIR)) {
    const p = path.join(TDIR, d);
    if (/^[a-z]{2}$/.test(d) && fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p)) if (f.endsWith('.html')) fs.unlinkSync(path.join(p, f));
  }
}
write(path.join(TDIR, 'town.css'), ascii('/* Generated by bots/snow/build_towns.js from docs/snow/index.html. Do not edit. */\n' + STYLE.replace(/^ {2}/gm, '') + EXTRA_CSS, 'town.css'));
const urls = [BASE];
write(path.join(TDIR, 'index.html'), allPage());
for (const st of STATES) {
  write(path.join(TDIR, stSlug(st), 'index.html'), statePage(st)); urls.push(stateUrl(st));
  for (const t of byState[st]) { write(path.join(TDIR, stSlug(st), t.slug + '.html'), townPage(t)); urls.push(townUrl(t)); }
}
write(path.join(ROOT, 'sitemap-snow.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + urls.map((u) => '  <url><loc>' + u + '</loc><lastmod>' + LASTMOD + '</lastmod></url>\n').join('') + '</urlset>\n');

// One entry in the sitemap index; leave the others exactly as they are.
const IDX = path.join(ROOT, 'sitemap-index.xml');
const idx = fs.readFileSync(IDX, 'utf8');
const entry = '  <sitemap><loc>' + SITE + 'sitemap-snow.xml</loc><lastmod>' + LASTMOD + '</lastmod></sitemap>\n';
if (!idx.includes(SITE + 'sitemap-snow.xml')) {
  if (!idx.includes('</sitemapindex>')) throw new Error('sitemap-index.xml: no closing tag');
  fs.writeFileSync(IDX, idx.replace('</sitemapindex>', entry + '</sitemapindex>'));
}
console.log('wrote', TOWNS.length, 'town pages,', STATES.length, 'state pages, 1 index;', urls.length, 'URLs in sitemap-snow.xml');
