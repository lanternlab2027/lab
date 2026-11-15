// Generates the static SEO pages from docs/names/data/ (run build_data.js first).
// Run: node bots/names/build_pages.js
// Output: docs/names/n/{slug}.html (latest-year top 1,000 per sex, deduplicated), docs/names/n/index.html,
//         docs/names/n/{letter}.html, docs/sitemap-names.xml (and adds it to docs/sitemap-index.xml).
const fs = require('fs'), path = require('path');
const S = require('../../docs/names/stats.js');

const DOCS = path.resolve(__dirname, '../../docs');
const D = path.join(DOCS, 'names/data'), OUT = path.join(DOCS, 'names/n');
const BASE = 'https://lanternlab2027.github.io/lab/';
const meta = JSON.parse(fs.readFileSync(path.join(D, 'meta.json')));
const rising = JSON.parse(fs.readFileSync(path.join(D, 'rising.json')));
const top = JSON.parse(fs.readFileSync(path.join(D, 'top.json')));
const TODAY = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
const COLORS = { F: '#b5446e', M: '#2f6db5' };
const { esc, fmt } = S;

const shardCache = {};
function report(name) {
  const key = name.slice(0, 2).toLowerCase();
  const sh = shardCache[key] || (shardCache[key] = JSON.parse(fs.readFileSync(path.join(D, 's', key + '.json'))));
  const rec = sh[name]; if (!rec) return null;
  const recs = {}; for (const s of Object.keys(rec)) recs[s] = S.decodeRec(rec[s], meta);
  return S.report(name, recs, meta);
}

// deduplicated page list; a name's page covers both sexes
const pageSet = new Map();
for (const s of ['F', 'M']) top[s].forEach((n) => { if (n && !pageSet.has(n)) pageSet.set(n, true); });
const names = [...pageSet.keys()].sort();
const reports = new Map(names.map((n) => [n, report(n)]));
const hasPage = (n) => reports.has(n);
const href = (n) => S.slug(n) + '.html';
const nameLink = (n) => (hasPage(n) ? `<a href="${href(n)}">${esc(n)}</a>` : `<a href="../?n=${encodeURIComponent(n)}">${esc(n)}</a>`);

function head({ title, desc, canonical, extra = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Lantern Lab">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${BASE}names/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../names.css">${extra}
</head>
<body>
<div class="wrap">`;
}
const crumbLd = (items) => `\n<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) })}</script>`;
const FOOT = `
<footer>
<p><a href="../../">A Lantern Lab project</a> &middot; <a href="../../apps/">More free apps &rarr;</a> &middot; <a href="../">Baby Name Report Card</a> &middot; <a href="./">All names A&ndash;Z</a></p>
<p>Source: U.S. Social Security Administration. Not affiliated. SSA does not publish a name in a year when fewer than 5 babies of one sex got it. Data: ${meta.first}&ndash;${meta.latest}.</p>
</footer>
</div>
</body>
</html>
`;

function neighbors(rep) {
  const s = rep.primary, r = rep.sexes[s].rank; if (!r) return '';
  const list = top[s], out = [];
  for (let i = Math.max(1, r - 3); i <= Math.min(list.length, r + 3); i++) {
    const n = list[i - 1]; if (!n) continue;
    out.push(n === rep.name ? `<li><span><b>#${i} ${esc(n)}</b></span></li>` : `<li><a href="${href(n)}">#${i} ${esc(n)}</a></li>`);
  }
  return `<h2>Ranked next to ${esc(rep.name)} in ${meta.latest}</h2><p>The ${S.SEX_WORD[s]}' names just above and below it on the SSA list:</p><ul class="chips">${out.join('')}</ul>`;
}

function decadeRows(rep) {
  const p = rep.sexes[rep.primary], rows = [];
  for (let d = meta.first; d <= meta.latest; d += 10) {
    let c = 0; for (let y = d; y <= Math.min(d + 9, meta.latest); y++) c += p.counts[y - meta.first];
    const pm = S.avg(p.share, d - meta.first, Math.min(d + 9, meta.latest) - meta.first);
    rows.push(`<tr><td>${d}s</td><td class="n">${p.decadeRanks[d] ? '#' + fmt(p.decadeRanks[d]) : '&mdash;'}</td><td class="n">${fmt(c)}</td><td class="n">${pm >= 1 ? '1 in ' + fmt(S.oneIn(pm)) : '&mdash;'}</td></tr>`);
  }
  return rows.join('');
}

function bar(v) { return `<div class="splitbar" aria-hidden="true"><div class="f" style="width:${(v * 100).toFixed(1)}%"></div><div class="m" style="width:${((1 - v) * 100).toFixed(1)}%"></div></div>`; }

function splitText(rep) {
  const n = rep.name, f = rep.split.latestF, a = rep.split.allF;
  const parts = [];
  const pf = f !== null ? S.pctPair(f) : null, pa = S.pctPair(a);
  if (f !== null) parts.push(`<p style="margin:8px 0 0"><b>In ${meta.latest}:</b> ${pf[0]} girls, ${pf[1]} boys (${fmt(rep.sexes.F ? rep.sexes.F.latestCount : 0)} girls, ${fmt(rep.sexes.M ? rep.sexes.M.latestCount : 0)} boys)</p>${bar(f)}`);
  parts.push(`<p style="margin:8px 0 0"><b>All years since ${meta.first}:</b> ${pa[0]} girls, ${pa[1]} boys (${fmt(rep.sexes.F ? rep.sexes.F.total : 0)} girls, ${fmt(rep.sexes.M ? rep.sexes.M.total : 0)} boys)</p>${bar(a)}`);
  let note;
  if (!rep.sexes.F || !rep.sexes.M) note = `${esc(n)} appears in SSA's files only for ${S.SEX_WORD[rep.primary]}.`;
  else if (f !== null && Math.abs(f - a) >= 0.15) note = `${esc(n)} has shifted toward ${f > a ? 'girls' : 'boys'}: ${Math.round((f > a ? f : 1 - f) * 100)}% ${f > a ? 'girls' : 'boys'} now vs ${Math.round((f > a ? a : 1 - a) * 100)}% over all years.`;
  else if (Math.min(a, 1 - a) >= 0.25) note = `${esc(n)} is genuinely unisex in the SSA data.`;
  else note = `Mostly given to ${S.SEX_WORD[rep.primary]}, with a small number of ${rep.primary === 'F' ? 'boys' : 'girls'} each year.`;
  return parts.join('') + `<p class="small">${note}</p>`;
}

function page(rep) {
  const n = rep.name, p = rep.sexes[rep.primary], w = S.SEX_WORD[rep.primary], L = meta.latest;
  const rankBit = p.rank ? `#${fmt(p.rank)} for ${w} in ${L}` : `${fmt(rep.latestCount)} babies in ${L}`;
  let title = `${n}: Name Popularity, ${rankBit.replace(/^#/, 'Rank #')}, Peak ${rep.peak.year}`;
  if (title.length > 65) title = `${n}: Name Popularity, ${rankBit.replace(/^#/, 'Rank #')}`; // SEO audit Nov 15: <= 65 chars
  const summary = S.summary(rep);
  const desc = `${summary.split('. ').slice(0, 2).join('. ').replace(/\.?$/, '.')} Trend: ${rep.trend.label.toLowerCase()}. Chart since ${meta.first} from Social Security data.`;
  const series = S.seriesFor(rep, COLORS);
  const svg = S.svgChart(series, meta.first, { label: `Babies named ${n} per million births, ${meta.first} to ${L}`, mark: rep.peak.year });
  const sim = S.similarRising(n, rep.primary, rising, 6);
  const gens = S.generations(rep).filter((g) => g.from <= L);
  const gmax = gens.reduce((a, g) => (g.count > a.count ? g : a), gens[0]);
  const sameYear = rep.latestCount ? `If your baby was named ${esc(n)} in ${L}, ${fmt(rep.sameYear)} other U.S. babies born that year share the name.` : `No babies were recorded as ${esc(n)} in ${L}.`;
  const neighborName = rep.sexes[rep.primary].rank ? top[rep.primary][rep.sexes[rep.primary].rank] || top[rep.primary][rep.sexes[rep.primary].rank - 2] : null;
  const ld = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Baby Name Report Card', item: BASE + 'names/' },
    { '@type': 'ListItem', position: 2, name: n[0], item: BASE + 'names/n/' + n[0].toLowerCase() + '.html' },
    { '@type': 'ListItem', position: 3, name: n, item: BASE + 'names/n/' + href(n) }] };
  return head({ title, desc, canonical: `${BASE}names/n/${href(n)}`, extra: `\n<script type="application/ld+json">${JSON.stringify(ld)}</script>` }) + `
<p class="crumbs"><a href="../">Baby Name Report Card</a> &rsaquo; <a href="${n[0].toLowerCase()}.html">${n[0]}</a> &rsaquo; ${esc(n)}</p>
<main class="sheet" style="margin-top:12px">
<div class="rc-head"><h1 class="rc-name">${esc(n)}</h1><span class="stamp ${rep.trend.key}">${esc(rep.trend.label)}</span></div>
<p>${esc(summary)}</p>
<div class="grid">
<div class="stat"><b>${S.ordinalRank(p.rank)}</b><span>${L} rank, ${w}</span></div>
<div class="stat"><b>${fmt(rep.latestCount)}</b><span>${S.countLabel(rep)}</span></div>
<div class="stat"><b>${rep.peak.year}</b><span>peak year (1 in ${fmt(rep.peak.oneIn)} ${w})</span></div>
<div class="stat"><b>${fmt(rep.allTime)}</b><span>babies since ${meta.first}</span></div>
</div>
<p class="why"><b>Trend: ${esc(rep.trend.label)}.</b> ${esc(rep.trend.why)}</p>
<p class="why"><b>Same-year twins:</b> ${sameYear}</p>
${svg}
<p class="legend">${series.slice().reverse().map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('')}</p>
<p class="small" style="margin:2px 0 0">Babies per million births of each sex, ${meta.first}&ndash;${L}. The dot marks the peak.</p>
<div class="cta"><a class="btn" href="../?n=${encodeURIComponent(n)}">Get the ${esc(n)} share card</a>${neighborName ? `<a class="btn alt" href="../?n=${encodeURIComponent(n)}&amp;vs=${encodeURIComponent(neighborName)}">Compare with ${esc(neighborName)}</a>` : ''}</div>
</main>

<div class="cols">
<section><h2>Girls vs boys</h2>${splitText(rep)}</section>
<section><h2>Similar names on the rise</h2>${sim.length ? `<ul class="chips">${sim.map((o) => `<li>${nameLink(o.name)} <small>+${Math.round((o.growth - 1) * 100)}%</small></li>`).join('')}</ul><p class="small">Names one or two letters away from ${esc(n)} (or sharing its first and last two letters) whose share of births grew 30%+ in five years. <a href="../#how-h">How they're picked</a>.</p>` : `<p>No similar-looking names are climbing fast right now.</p>`}</section>
</div>

<h2>How many people are named ${esc(n)}, by generation</h2>
<p>Babies named ${esc(n)} (girls and boys) born in each generation's years.${gmax.count ? ` The biggest group is ${gmax.label} (${gmax.from}&ndash;${gmax.to}), with ${fmt(gmax.count)}.` : ''}</p>
<div class="tablewrap"><table><thead><tr><th>Generation</th><th>Born</th><th class="n">Babies named ${esc(n)}</th></tr></thead><tbody>
${gens.map((g) => `<tr><td>${g.label}</td><td>${g.from}&ndash;${g.to}</td><td class="n">${fmt(g.count)}</td></tr>`).join('\n')}
</tbody></table></div>

<h2>${esc(n)} rank by decade</h2>
<div class="tablewrap"><table><thead><tr><th>Decade</th><th class="n">Rank (${w})</th><th class="n">Babies</th><th class="n">Share of ${w}</th></tr></thead><tbody>
${decadeRows(rep)}
</tbody></table></div>
<p class="small">Rank by total births in the decade among ${w}' names (top 1,000 shown). The ${L - (L % 10)}s are partial (${L - (L % 10)}&ndash;${L}). Best single-year rank: ${S.ordinalRank(p.bestRank)} in ${p.bestRankYear}.</p>

${neighbors(rep)}
` + FOOT;
}

// ---------- write pages ----------
// Sitemap lastmod = the date a page's HTML last changed, not the build date (SEO audit
// Nov 15), so a rebuild with unchanged data doesn't mark all 1,945 URLs as modified.
const oldHtml = new Map(), oldLastmod = new Map();
if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT)) if (f.endsWith('.html')) oldHtml.set(f, fs.readFileSync(path.join(OUT, f), 'utf8'));
const smPath = path.join(DOCS, 'sitemap-names.xml');
if (fs.existsSync(smPath)) for (const m of fs.readFileSync(smPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) oldLastmod.set(m[1], m[2]);
const lastmodFor = (url, file) => (oldLastmod.has(url) && oldHtml.get(file) === fs.readFileSync(path.join(OUT, file), 'utf8') ? oldLastmod.get(url) : TODAY);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let bytes = 0, count = 0;
for (const [n, rep] of reports) {
  if (!rep) throw new Error('no data for top name ' + n);
  const html = page(rep); bytes += html.length; count++;
  fs.writeFileSync(path.join(OUT, href(n)), html);
}

// ---------- letter indexes ----------
const letters = [...new Set(names.map((n) => n[0]))].sort();
const letterNav = (cur) => `<nav class="letters" aria-label="Names by first letter">${letters.map((l) => (l === cur ? `<a aria-current="page" href="${l.toLowerCase()}.html" style="background:#23345c;color:#fff">${l}</a>` : `<a href="${l.toLowerCase()}.html">${l}</a>`)).join('')}</nav>`;
const rankLabel = (n) => { const r = reports.get(n), p = r.sexes[r.primary]; return p.rank ? `#${p.rank} ${r.primary === 'F' ? 'girls' : 'boys'}` : ''; };
for (const l of letters) {
  const list = names.filter((n) => n[0] === l);
  const risingHere = list.filter((n) => reports.get(n).trend.key === 'rising' || reports.get(n).trend.key === 'revival').length;
  const topHere = list.slice().sort((a, b) => reports.get(b).latestCount - reports.get(a).latestCount)[0];
  const html = head({
    title: `Baby Names Starting With ${l}: ${list.length} Popular ${l} Names (${meta.latest} Rankings)`,
    desc: `${list.length} of the top U.S. baby names of ${meta.latest} start with ${l}. ${topHere} leads with ${fmt(reports.get(topHere).latestCount)} babies. Rank, trend and popularity since ${meta.first} for each.`,
    canonical: `${BASE}names/n/${l.toLowerCase()}.html`,
    extra: crumbLd([['Baby Name Report Card', BASE + 'names/'], ['A–Z', BASE + 'names/n/'], [l, `${BASE}names/n/${l.toLowerCase()}.html`]])
  }) + `
<p class="crumbs"><a href="../">Baby Name Report Card</a> &rsaquo; <a href="./">A&ndash;Z</a> &rsaquo; ${l}</p>
<h1>Names starting with ${l}</h1>
<p class="lede">${list.length} names starting with ${l} made SSA's ${meta.latest} top 1,000 for girls or boys. The most common is <a href="${href(topHere)}">${esc(topHere)}</a> (${fmt(reports.get(topHere).latestCount)} babies); ${risingHere} of them are rising or in a vintage revival.</p>
${letterNav(l)}
<ol class="names">
${list.map((n) => `<li><a href="${href(n)}">${esc(n)}</a> <small>${rankLabel(n)}</small></li>`).join('\n')}
</ol>
` + FOOT;
  fs.writeFileSync(path.join(OUT, l.toLowerCase() + '.html'), html); bytes += html.length;
}
const topList = (s) => top[s].slice(0, 100).map((n, i) => `<li><a href="${href(n)}">${esc(n)}</a> <small>#${i + 1}</small></li>`).join('\n');
const idx = head({
  title: `Top Baby Names of ${meta.latest}: All ${names.length.toLocaleString('en-US')} Name Report Cards A–Z`,
  desc: `Popularity report cards for the ${names.length.toLocaleString('en-US')} names in SSA's ${meta.latest} top 1,000 for girls and boys: rank, peak year, trend and a chart since ${meta.first}. Browse A to Z.`,
  canonical: `${BASE}names/n/`,
  extra: crumbLd([['Baby Name Report Card', BASE + 'names/'], ['A–Z', BASE + 'names/n/']])
}) + `
<p class="crumbs"><a href="../">Baby Name Report Card</a> &rsaquo; A&ndash;Z</p>
<h1>Every top name, A to Z</h1>
<p class="lede">One page for each of the ${names.length.toLocaleString('en-US')} names in the Social Security Administration's ${meta.latest} top 1,000 for girls or boys. <a href="../">Look up any other name</a> in the report card.</p>
${letterNav('')}
<div class="cols">
<section><h2>Top 100 girls' names, ${meta.latest}</h2><ol class="names" style="columns:2">${topList('F')}</ol></section>
<section><h2>Top 100 boys' names, ${meta.latest}</h2><ol class="names" style="columns:2">${topList('M')}</ol></section>
</div>
` + FOOT;
fs.writeFileSync(path.join(OUT, 'index.html'), idx); bytes += idx.length;

// ---------- sitemap ----------
const urls = [`${BASE}names/n/`, ...letters.map((l) => `${BASE}names/n/${l.toLowerCase()}.html`), ...names.map((n) => `${BASE}names/n/${href(n)}`)];
const fileFor = (u) => { const r = u.slice((BASE + 'names/n/').length); return r === '' ? 'index.html' : r; };
const mods = urls.map((u) => lastmodFor(u, fileFor(u)));
const newest = mods.reduce((a, b) => (b > a ? b : a), '');
fs.writeFileSync(smPath, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u, i) => `  <url><loc>${u}</loc><lastmod>${mods[i]}</lastmod></url>`).join('\n')}\n</urlset>\n`);
const si = path.join(DOCS, 'sitemap-index.xml');
let six = fs.readFileSync(si, 'utf8');
const entry = `  <sitemap><loc>${BASE}sitemap-names.xml</loc><lastmod>${newest}</lastmod></sitemap>\n`;
if (six.includes('sitemap-names.xml')) six = six.replace(/  <sitemap><loc>[^<]*sitemap-names\.xml<\/loc>.*\n/, entry);
else six = six.replace('</sitemapindex>', entry + '</sitemapindex>');
fs.writeFileSync(si, six);

console.log(`pages ${count}, letter pages ${letters.length}, total html ${(bytes / 1e6).toFixed(2)} MB, avg page ${Math.round(bytes / count)} bytes, sitemap urls ${urls.length}`);
