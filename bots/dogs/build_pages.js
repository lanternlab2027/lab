// Generates the static SEO pages from docs/dogs/data/ (run build_data.js first).
// Run: node bots/dogs/build_pages.js
// Output: docs/dogs/n/{key}.html (top names with 20+ dogs), n/index.html (top 100 + A-Z), n/{letter}.html,
//         docs/dogs/breed/index.html + breed/{slug}.html, docs/dogs/borough/index.html + borough/{slug}.html,
//         docs/sitemap-dogs.xml (and appends it to docs/sitemap-index.xml if missing).
'use strict';
const fs = require('fs'), path = require('path');
const S = require('../../docs/dogs/stats.js');
const { isGenericBreed } = require('./clean.js');

const DOCS = path.resolve(__dirname, '../../docs');
const ROOT = path.join(DOCS, 'dogs'), D = path.join(ROOT, 'data');
const BASE = 'https://lanternlab2027.github.io/lab/';
const TODAY = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
const meta = JSON.parse(fs.readFileSync(path.join(D, 'meta.json')));
const top = JSON.parse(fs.readFileSync(path.join(D, 'top.json')));
const breeds = JSON.parse(fs.readFileSync(path.join(D, 'breeds.json')));
const boroughs = JSON.parse(fs.readFileSync(path.join(D, 'boroughs.json')));
const { esc, fmt } = S;
const recs = new Map();
for (const f of fs.readdirSync(path.join(D, 's'))) for (const [k, r] of Object.entries(JSON.parse(fs.readFileSync(path.join(D, 's', f))))) recs.set(k, r);

// baby-name crossover (docs/names), optional
let baby = null;
try {
  const bt = JSON.parse(fs.readFileSync(path.join(DOCS, 'names/data/top.json'))), bm = JSON.parse(fs.readFileSync(path.join(DOCS, 'names/data/meta.json')));
  baby = { latest: bm.latest, rank: new Map() };
  for (const s of ['F', 'M']) bt[s].forEach((n, i) => { if (!n) return; const k = n.toLowerCase(); const cur = baby.rank.get(k); if (!cur || i + 1 < cur.r) baby.rank.set(k, { r: i + 1, s, name: n }); });
} catch (e) { baby = null; }

const pageKeys = top.map((t) => t[1]);
const pageSet = new Set(pageKeys);
const RESERVED = new Set(['index']);
for (const k of pageKeys) if (RESERVED.has(k) || /^[a-z0-9]$/.test(k)) throw new Error('name key collides with an index page: ' + k);
const href = (k) => k + '.html';
const breedLabel = (b) => (b.generic ? b.name + ' mix' : b.name);
const breedBySlug = new Map(breeds.map((b) => [b.name, b]));
const BORO_SLUG = { M: 'manhattan', B: 'bronx', K: 'brooklyn', Q: 'queens', S: 'staten-island' };
const yrs = `${meta.firstIssue}&ndash;${meta.latest}`;

function head({ title, desc, canonical, ld, depth = 1 }) {
  const up = '../'.repeat(depth);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://lanternlab.goatcounter.com; connect-src https://lanternlab.goatcounter.com; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Lantern Lab">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${BASE}dogs/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="${up}dogs.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script data-goatcounter="https://lanternlab.goatcounter.com/count" async src="${up}../vendor/goatcounter/count.js"></script>
</head>
<body>
<div class="wrap">`;
}
const crumbLd = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) });
const foot = (depth = 1) => {
  const up = '../'.repeat(depth);
  return `
<footer>
<p><a href="${up}../">A Lantern Lab project</a> &middot; <a href="${up}../apps/">More free apps &rarr;</a> &middot; <a href="${up}">NYC Dog Name Report Card</a> &middot; <a href="${up}n/">Top names A&ndash;Z</a> &middot; <a href="${up}breed/">By breed</a> &middot; <a href="${up}borough/">By borough</a></p>
<p>Data: NYC Department of Health dog licensing data via NYC Open Data; licensed dogs only, not all dogs. Not affiliated with the City of New York. Dogs licensed ${yrs}, deduplicated; names with fewer than ${meta.minLookup} dogs and breakdowns under ${meta.minCell} are not shown.</p>
</footer>
</div>
</body>
</html>
`;
};

function bars(rows) {
  const max = rows.reduce((a, r) => Math.max(a, r[1]), 1);
  return `<ul class="bars">${rows.map((r) => `<li><span>${r[0]}</span><span class="bar" aria-hidden="true"><i style="width:${(r[1] / max * 100).toFixed(1)}%"></i></span><b>${fmt(r[1])}${r[2] ? ` <small>${r[2]}</small>` : ''}</b></li>`).join('')}</ul>`;
}
const nameLink = (k, display, pre = '') => (pageSet.has(k) ? `<a href="${pre}${href(k)}">${esc(display)}</a>` : `<a href="../?n=${encodeURIComponent(display)}">${esc(display)}</a>`);

function breedPhrase(rec) {
  const b = rec.br[0]; if (!b) return '';
  return isGenericBreed(b[0]) ? `a ${b[0].toLowerCase()} mix` : `a ${b[0]}`;
}

// ---------- name pages ----------
function namePage(k, i) {
  const rec = recs.get(k), n = rec.n, pk = S.peak(rec, meta), tr = S.trend(rec, meta), sh = S.shares(rec, meta), bo = S.boroLine(rec);
  let title = `${n}: #${fmt(rec.r)} Dog Name in NYC, ${fmt(rec.t)} Licensed Dogs`;
  if (title.length > 65) title = `${n}: #${fmt(rec.r)} Dog Name in NYC`;
  const bp = breedPhrase(rec);
  const desc = `How popular is ${n} as a dog name? ${fmt(rec.t)} licensed NYC dogs are named ${n} (#${fmt(rec.r)}).${bp ? ` Most often ${bp}` : ''}${bo ? `${bp ? ',' : ' Most'} in ${bo.name}` : ''}${bp || bo ? '.' : ''} Peak year ${pk.year}; ${tr.label.toLowerCase()}.`;
  const boros = S.BORO_ORDER.filter((b) => rec.bo[b]).map((b) => [`<a href="../borough/${BORO_SLUG[b]}.html">${S.BORO_TITLE[b]}</a>`, rec.bo[b], '#' + fmt(rec.bor[b])]);
  const hidden = rec.t - S.BORO_ORDER.reduce((a, b) => a + (rec.bo[b] || 0), 0);
  const br = rec.br.map((b) => { const g = breedBySlug.get(b[0]), lab = isGenericBreed(b[0]) ? b[0] + ' mix' : b[0]; return [g ? `<a href="../breed/${g.slug}.html">${esc(lab)}</a>` : esc(lab), b[1]]; });
  const zipLine = rec.z1.length ? `<p class="why"><b>#1 dog name in ${rec.z1.length} ZIP code${rec.z1.length > 1 ? 's' : ''}:</b> ${rec.z1.join(', ')}.</p>` : '';
  const yearRows = meta.years.map((y, j) => `<tr><td>${y}</td><td class="n">${fmt(rec.y[j])}</td><td class="n">${sh[j].toFixed(1)}</td></tr>`).join('');
  const bb = baby && baby.rank.get(n.toLowerCase());
  const babyHtml = bb && fs.existsSync(path.join(DOCS, 'names/n', S.key(bb.name) + '.html'))
    ? `<p class="note"><b>Dogs vs babies:</b> ${esc(n)} is the #${fmt(rec.r)} name among NYC's licensed dogs and #${fmt(bb.r)} for U.S. baby ${bb.s === 'F' ? 'girls' : 'boys'} in ${baby.latest}. <a href="../../names/n/${S.key(bb.name)}.html">See ${esc(bb.name)}'s baby name report card</a>.</p>` : '';
  const nb = []; for (let j = Math.max(0, i - 3); j <= Math.min(top.length - 1, i + 3); j++) nb.push(j === i ? `<li><span><b>#${fmt(recs.get(top[j][1]).r)} ${esc(top[j][0])}</b></span></li>` : `<li><a href="${href(top[j][1])}">#${fmt(recs.get(top[j][1]).r)} ${esc(top[j][0])}</a></li>`);
  const L = n[0].toUpperCase(), lk = /[A-Z]/.test(L) ? L.toLowerCase() : '0';
  const ld = crumbLd([['NYC Dog Name Report Card', BASE + 'dogs/'], ['Top dog names', BASE + 'dogs/n/'], [n, BASE + 'dogs/n/' + href(k)]]);
  return head({ title, desc, canonical: `${BASE}dogs/n/${href(k)}`, ld }) + `
<p class="crumbs"><a href="../">NYC Dog Name Report Card</a> &rsaquo; <a href="./">Top names</a> &rsaquo; <a href="${lk}.html">${/[A-Z]/.test(L) ? L : '0-9'}</a> &rsaquo; ${esc(n)}</p>
<main class="sheet" style="margin-top:12px">
<div class="rc-head"><h1 class="rc-name">${esc(n)}</h1><span class="stamp ${tr.key}">${esc(tr.label)}</span></div>
<p class="big">There are <b>${fmt(rec.t)}</b> licensed dogs named ${esc(n)} in NYC.</p>
<p>${esc(S.summary(rec, meta))}</p>
<div class="grid">
<div class="stat"><b>#${fmt(rec.r)}</b><span>rank among ${fmt(meta.distinctNames)} names</span></div>
<div class="stat"><b>${fmt(rec.t)}</b><span>dogs licensed ${yrs}</span></div>
<div class="stat"><b>${pk.year}</b><span>peak year (${pk.per10k.toFixed(1)} per 10k)</span></div>
<div class="stat"><b>${rec.b || '&mdash;'}</b><span>typical birth year (median)</span></div>
</div>
<p class="why"><b>Trend: ${esc(tr.label)}.</b> ${esc(tr.why)}</p>
${zipLine}
${S.svgChart([{ label: n, values: sh, color: '#1f4d3f' }], meta.years, { label: `Dogs named ${n} per 10,000 licensed, by license year ${meta.years[0]}-${meta.latest}`, mark: pk.year })}
<p class="small" style="margin:2px 0 0">Dogs named ${esc(n)} per 10,000 dogs licensed each year, ${meta.years[0]}&ndash;${meta.latest}. The filled dot marks the peak.</p>
<div class="cta"><a class="btn" href="../?n=${encodeURIComponent(n)}">Get the ${esc(n)} share card</a></div>
</main>

<div class="cols">
<section><h2>Top breeds named ${esc(n)}</h2>${br.length ? bars(br) : '<p>No single breed has 5 or more.</p>'}<p class="small">Breed families: mixes count toward their main breed. Unknown breeds are left out.</p></section>
<section><h2>${esc(n)} by borough</h2>${boros.length ? bars(boros) : '<p>No borough has 5 or more.</p>'}<p class="small">The small number is ${esc(n)}'s rank in that borough.${hidden > 0 ? ` ${fmt(hidden)} more are in a borough with fewer than 5 or have no NYC ZIP code.` : ''}</p></section>
</div>
${rec.z.length ? `<h2>ZIP codes with the most dogs named ${esc(n)}</h2>${bars(rec.z.map((z) => [z[0], z[1]]))}` : ''}
${babyHtml}
<h2>${esc(n)} licenses by year</h2>
<div class="tablewrap"><table><thead><tr><th>License issued</th><th class="n">Dogs named ${esc(n)}</th><th class="n">Per 10,000 licensed</th></tr></thead><tbody>
${yearRows}
</tbody></table></div>
<p class="small">A dog is counted in every year it got a license. ${meta.firstIssue} is left out because the data starts that September. The city's yearly extracts don't capture every year equally (${meta.years[0]} and ${meta.years.slice(-4)[0]}&ndash;${meta.latest} are thinner), so compare the per-10,000 column, not raw counts.</p>

<h2>Ranked next to ${esc(n)}</h2>
<ul class="chips">${nb.join('')}</ul>
` + foot();
}

// ---------- write ----------
const oldHtml = new Map(), oldLastmod = new Map();
const DIRS = ['n', 'breed', 'borough'];
for (const d of DIRS) { const p = path.join(ROOT, d); if (fs.existsSync(p)) for (const f of fs.readdirSync(p)) if (f.endsWith('.html')) oldHtml.set(d + '/' + f, fs.readFileSync(path.join(p, f), 'utf8')); }
const smPath = path.join(DOCS, 'sitemap-dogs.xml');
if (fs.existsSync(smPath)) for (const m of fs.readFileSync(smPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) oldLastmod.set(m[1], m[2]);
for (const d of DIRS) { fs.rmSync(path.join(ROOT, d), { recursive: true, force: true }); fs.mkdirSync(path.join(ROOT, d), { recursive: true }); }
const written = [];
let bytes = 0;
const write = (rel, html) => { if (/[^\x00-\x7f]/.test(html)) { /* fine in output, but keep a count */ } fs.writeFileSync(path.join(ROOT, rel), html); bytes += html.length; written.push(rel); };

top.forEach((t, i) => write('n/' + href(t[1]), namePage(t[1], i)));

// letter pages
const letterOf = (d) => (/[A-Za-z]/.test(d[0]) ? d[0].toUpperCase() : '0');
const letters = [...new Set(top.map((t) => letterOf(t[0])))].sort();
const letterNav = (cur) => `<nav class="letters" aria-label="Dog names by first letter">${letters.map((l) => `<a href="${l.toLowerCase()}.html"${l === cur ? ' aria-current="page"' : ''}>${l === '0' ? '#' : l}</a>`).join('')}</nav>`;
for (const l of letters) {
  const list = top.filter((t) => letterOf(t[0]) === l).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const lead = list.slice().sort((a, b) => b[2] - a[2])[0];
  const lab = l === '0' ? 'a number' : l;
  write('n/' + l.toLowerCase() + '.html', head({
    title: `Dog Names Starting With ${l === '0' ? 'a Number' : l}: ${list.length} Popular NYC Dog Names`,
    desc: `${list.length} of the most common dog names in New York City start with ${lab}. ${lead[0]} leads with ${fmt(lead[2])} licensed dogs. Rank, breeds, boroughs and trend for each.`,
    canonical: `${BASE}dogs/n/${l.toLowerCase()}.html`,
    ld: crumbLd([['NYC Dog Name Report Card', BASE + 'dogs/'], ['Top dog names', BASE + 'dogs/n/'], [l, `${BASE}dogs/n/${l.toLowerCase()}.html`]])
  }) + `
<p class="crumbs"><a href="../">NYC Dog Name Report Card</a> &rsaquo; <a href="./">Top names</a> &rsaquo; ${l === '0' ? '#' : l}</p>
<h1>Dog names starting with ${l === '0' ? 'a number' : l}</h1>
<p class="lede">${list.length} names starting with ${lab} are shared by at least ${meta.minPage} licensed NYC dogs. The most common is <a href="${href(lead[1])}">${esc(lead[0])}</a>, with ${fmt(lead[2])}.</p>
${letterNav(l)}
<ol class="names">
${list.map((t) => `<li><a href="${href(t[1])}">${esc(t[0])}</a> <small>${fmt(t[2])}</small></li>`).join('\n')}
</ol>
` + foot());
}

// top 100 + index
const top100 = top.slice(0, 100);
const sexTop = (s) => top.filter((t) => { const r = recs.get(t[1]); const g = r.f + r.m; return g && (s === 'F' ? r.f / g >= 0.8 : r.m / g >= 0.8); }).slice(0, 25);
const risers = top.slice(0, 500).map((t) => ({ t, tr: S.trend(recs.get(t[1]), meta) })).filter((o) => o.tr.key === 'rising' && o.tr.change !== null).sort((a, b) => b.tr.change - a.tr.change).slice(0, 20);
write('n/index.html', head({
  title: `Most Popular Dog Names in NYC: Top 100 and ${fmt(top.length)} Names A-Z`,
  desc: `The most popular dog names in New York City from ${fmt(meta.dogs)} licensed dogs: ${top.slice(0, 5).map((t) => t[0]).join(', ')} and more. Dog name popularity by rank, breed and borough.`,
  canonical: `${BASE}dogs/n/`,
  ld: { '@context': 'https://schema.org', '@graph': [crumbLd([['NYC Dog Name Report Card', BASE + 'dogs/'], ['Top dog names', BASE + 'dogs/n/']]),
    { '@type': 'ItemList', name: 'Most popular dog names in NYC', numberOfItems: 100, itemListElement: top100.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t[0], url: `${BASE}dogs/n/${href(t[1])}` })) }] }
}) + `
<p class="crumbs"><a href="../">NYC Dog Name Report Card</a> &rsaquo; Top names</p>
<h1>The most popular dog names in NYC</h1>
<p class="lede">The top 100 names among ${fmt(meta.dogs)} dogs licensed in New York City from ${yrs}, plus a page for each of the ${fmt(top.length)} most common names. <a href="../">Look up any name</a> with 5+ dogs.</p>
<p class="note">These are <b>licensed</b> dogs only. Many NYC dogs are never licensed, so this is "most common on the city's license rolls", not a census of every dog.</p>
${letterNav('')}
<h2>Top 100 dog names in New York City</h2>
<ol class="names">
${top100.map((t, i) => `<li><a href="${href(t[1])}">${esc(t[0])}</a> <small>#${fmt(recs.get(t[1]).r)} &middot; ${fmt(t[2])}</small></li>`).join('\n')}
</ol>
<div class="cols">
<section><h2>Top female dog names</h2><ol class="names c3">${sexTop('F').map((t) => `<li>${nameLink(t[1], t[0])} <small>${fmt(t[2])}</small></li>`).join('')}</ol><p class="small">Names where 80%+ of dogs are female.</p></section>
<section><h2>Top male dog names</h2><ol class="names c3">${sexTop('M').map((t) => `<li>${nameLink(t[1], t[0])} <small>${fmt(t[2])}</small></li>`).join('')}</ol><p class="small">Names where 80%+ of dogs are male.</p></section>
</div>
<h2>Fastest-rising dog names</h2>
<p>Among the top 500, the biggest gains in share of new licenses (last three years vs the first three):</p>
<ul class="chips">${risers.map((o) => `<li><a href="${href(o.t[1])}">${esc(o.t[0])} <small>+${Math.round(o.tr.change * 100)}%</small></a></li>`).join('')}</ul>
<p><a href="../breed/">Top names by breed &rarr;</a> &middot; <a href="../borough/">Top names by borough &rarr;</a></p>
` + foot());

// ---------- breed pages ----------
const totals = new Map([...recs].map(([k, r]) => [k, r.t]));
function distinctive(list, groupTotal, minN) {
  return list.filter((x) => x[2] >= minN && totals.get(x[1])).map((x) => ({ x, lift: (x[2] / groupTotal) / (totals.get(x[1]) / meta.dogs) }))
    .filter((o) => o.lift >= 1.5).sort((a, b) => b.lift - a.lift).slice(0, 12);
}
for (const b of breeds) {
  const lab = breedLabel(b), top50 = b.top.slice(0, 50), dist = distinctive(b.top, b.total, 10);
  write('breed/' + b.slug + '.html', head({
    title: `Most Popular ${lab} Names in NYC: Top ${top50.length} Dog Names`.length <= 65 ? `Most Popular ${lab} Names in NYC: Top ${top50.length} Dog Names` : `Top ${lab} Names in NYC`,
    desc: `The most common names for ${lab} dogs in New York City, from ${fmt(b.total)} licensed dogs: ${top50.slice(0, 4).map((x) => x[0]).join(', ')} and more, plus names that are unusually ${b.generic ? 'common for them' : 'common for the breed'}.`,
    canonical: `${BASE}dogs/breed/${b.slug}.html`,
    ld: crumbLd([['NYC Dog Name Report Card', BASE + 'dogs/'], ['By breed', BASE + 'dogs/breed/'], [lab, `${BASE}dogs/breed/${b.slug}.html`]])
  }) + `
<p class="crumbs"><a href="../">NYC Dog Name Report Card</a> &rsaquo; <a href="./">By breed</a> &rsaquo; ${esc(lab)}</p>
<h1>Top ${esc(lab)} names in NYC</h1>
<p class="lede">${fmt(b.total)} dogs licensed in New York City from ${yrs} are listed as ${esc(b.name)}${b.generic ? ' (breed not specified further)' : ' or a ' + esc(b.name) + ' mix'}. The most common name is ${nameLink(top50[0][1], top50[0][0], '../n/')}, with ${fmt(top50[0][2])}.</p>
<h2>Top ${top50.length} ${esc(lab)} names</h2>
<ol class="names c3">
${top50.map((x) => `<li>${nameLink(x[1], x[0], '../n/')} <small>${fmt(x[2])}</small></li>`).join('\n')}
</ol>
${dist.length ? `<h2>Names that are unusually ${esc(lab)}</h2><p>Names with 10+ ${esc(lab)} dogs that turn up far more often in this breed than among NYC dogs overall:</p><ul class="chips">${dist.map((o) => `<li>${nameLink(o.x[1], o.x[0], '../n/')} <small>${o.lift.toFixed(1)}x</small></li>`).join('')}</ul><p class="small">"3.0x" means the name's share among ${esc(lab)} dogs is three times its share among all licensed dogs.</p>` : ''}
<p><a href="./">All breeds &rarr;</a></p>
` + foot());
}
write('breed/index.html', head({
  title: 'Most Popular Dog Names by Breed in NYC',
  desc: `Top dog names for ${breeds.length} breeds in New York City, from ${fmt(meta.dogs)} licensed dogs: Shih Tzu, Yorkie, Poodle, Lab, Chihuahua, Pit Bull, French Bulldog and more.`,
  canonical: `${BASE}dogs/breed/`,
  ld: crumbLd([['NYC Dog Name Report Card', BASE + 'dogs/'], ['By breed', BASE + 'dogs/breed/']])
}) + `
<p class="crumbs"><a href="../">NYC Dog Name Report Card</a> &rsaquo; By breed</p>
<h1>Top dog names by breed</h1>
<p class="lede">The ${breeds.length} biggest breed families among licensed NYC dogs, biggest first, with each one's five most common names. Mixes count toward their main breed.</p>
<div class="bgrid">
${breeds.map((b) => `<section><h3><a href="${b.slug}.html">${esc(breedLabel(b))}</a></h3><p class="small">${fmt(b.total)} dogs</p><p>${b.top.slice(0, 5).map((x) => esc(x[0])).join(', ')}</p></section>`).join('\n')}
</div>
` + foot());

// ---------- borough pages ----------
for (const bo of boroughs) {
  const slug = BORO_SLUG[bo.code], nm = bo.name, top100b = bo.top.slice(0, 100), dist = distinctive(bo.top, bo.total, 20);
  write('borough/' + slug + '.html', head({
    title: `Most Popular Dog Names in ${nm}: Top 100`,
    desc: `The most common dog names in ${nm}, from ${fmt(bo.total)} licensed dogs: ${top100b.slice(0, 5).map((x) => x[0]).join(', ')}. Plus the names that are more ${nm} than anywhere else in NYC.`,
    canonical: `${BASE}dogs/borough/${slug}.html`,
    ld: crumbLd([['NYC Dog Name Report Card', BASE + 'dogs/'], ['By borough', BASE + 'dogs/borough/'], [nm, `${BASE}dogs/borough/${slug}.html`]])
  }) + `
<p class="crumbs"><a href="../">NYC Dog Name Report Card</a> &rsaquo; <a href="./">By borough</a> &rsaquo; ${nm}</p>
<h1>Top dog names in ${nm}</h1>
<p class="lede">${fmt(bo.total)} dogs licensed from ${yrs} have a ${nm} ZIP code. The most common name is ${nameLink(top100b[0][1], top100b[0][0], '../n/')} (${fmt(top100b[0][2])}).</p>
<nav class="letters" aria-label="Boroughs" style="gap:8px">${boroughs.map((o) => `<a style="width:auto;padding:0 12px" href="${BORO_SLUG[o.code]}.html"${o.code === bo.code ? ' aria-current="page"' : ''}>${o.name}</a>`).join('')}</nav>
<h2>Top 100 dog names in ${nm}</h2>
<ol class="names">
${top100b.map((x) => `<li>${nameLink(x[1], x[0], '../n/')} <small>${fmt(x[2])}</small></li>`).join('\n')}
</ol>
${dist.length ? `<h2>The most ${nm} dog names</h2><p>Names with 20+ dogs here whose share in ${nm} is well above their share citywide:</p><ul class="chips">${dist.map((o) => `<li>${nameLink(o.x[1], o.x[0], '../n/')} <small>${o.lift.toFixed(1)}x</small></li>`).join('')}</ul>` : ''}
` + foot());
}
write('borough/index.html', head({
  title: 'Most Popular Dog Names by NYC Borough',
  desc: `Top dog names in Manhattan, Brooklyn, Queens, the Bronx and Staten Island, from ${fmt(meta.dogs)} licensed dogs, plus each borough's most distinctive names.`,
  canonical: `${BASE}dogs/borough/`,
  ld: crumbLd([['NYC Dog Name Report Card', BASE + 'dogs/'], ['By borough', BASE + 'dogs/borough/']])
}) + `
<p class="crumbs"><a href="../">NYC Dog Name Report Card</a> &rsaquo; By borough</p>
<h1>Top dog names by borough</h1>
<p class="lede">Each borough's ten most common names among licensed dogs (by the owner's ZIP code).</p>
<div class="bgrid">
${boroughs.map((o) => `<section><h3><a href="${BORO_SLUG[o.code]}.html">${o.name}</a></h3><p class="small">${fmt(o.total)} dogs</p><ol class="names c3" style="columns:1">${o.top.slice(0, 10).map((x) => `<li>${nameLink(x[1], x[0], '../n/')} <small>${fmt(x[2])}</small></li>`).join('')}</ol></section>`).join('\n')}
</div>
` + foot());

// ---------- sitemap ----------
const urlFor = (rel) => BASE + 'dogs/' + rel.replace(/index\.html$/, '');
const urls = ['', ...written].map((rel) => ({ rel, url: rel === '' ? BASE + 'dogs/' : urlFor(rel) }));
const mods = urls.map(({ rel, url }) => {
  if (rel === '') return oldLastmod.get(url) || TODAY;
  return oldLastmod.has(url) && oldHtml.get(rel) === fs.readFileSync(path.join(ROOT, rel), 'utf8') ? oldLastmod.get(url) : TODAY;
});
const newest = mods.reduce((a, b) => (b > a ? b : a), '');
fs.writeFileSync(smPath, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u, i) => `  <url><loc>${u.url}</loc><lastmod>${mods[i]}</lastmod></url>`).join('\n')}\n</urlset>\n`);
// sitemap index: append one entry if missing; otherwise only update this entry's lastmod. Other lines untouched.
const si = path.join(DOCS, 'sitemap-index.xml');
let six = fs.readFileSync(si, 'utf8');
const entry = `  <sitemap><loc>${BASE}sitemap-dogs.xml</loc><lastmod>${newest}</lastmod></sitemap>\n`;
if (six.includes('sitemap-dogs.xml')) six = six.replace(/  <sitemap><loc>[^<]*sitemap-dogs\.xml<\/loc>.*\n/, entry);
else six = six.replace('</sitemapindex>', entry + '</sitemapindex>');
fs.writeFileSync(si, six);

console.log(`name pages ${top.length}, letter pages ${letters.length}, breed pages ${breeds.length}, borough pages ${boroughs.length}, files ${written.length}, html ${(bytes / 1e6).toFixed(2)} MB, sitemap urls ${urls.length}`);
