/* NYC Dog Name Report Card: shared stats. Runs in the browser (window.DogStats) and in Node (require).
   Data: NYC Department of Health dog licensing data via NYC Open Data (nu7n-tubp). Licensed dogs only. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DogStats = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BORO = { M: 'Manhattan', B: 'the Bronx', K: 'Brooklyn', Q: 'Queens', S: 'Staten Island' };
  var BORO_TITLE = { M: 'Manhattan', B: 'Bronx', K: 'Brooklyn', Q: 'Queens', S: 'Staten Island' };
  var BORO_ORDER = ['M', 'K', 'Q', 'B', 'S'];
  var TREND = {
    rising: { label: 'Rising', why: 'Its share of new licenses in the last three years is at least 25% above the first three.' },
    falling: { label: 'Fading', why: 'Its share of new licenses in the last three years is at least 20% below the first three.' },
    steady: { label: 'Steady', why: 'Its share of new licenses has stayed within the 25% up / 20% down band.' },
    'new': { label: 'Newcomer', why: 'No licenses in the first three years of the data, but it shows up now.' }
  };

  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function key(name) {
    var s = String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');
    if (/^([A-Z]\.\s?)+[A-Z]?\.?$/.test(s)) s = s.replace(/[.\s]/g, '');
    return s.replace(/['\u2019`]/g, '').replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  }

  // dogs per 10,000 dogs licensed that year
  function shares(rec, meta) { return rec.y.map(function (c, i) { return meta.yearTotals[i] ? c / meta.yearTotals[i] * 1e4 : 0; }); }
  function avg(a, i0, i1) { var s = 0; for (var i = i0; i <= i1; i++) s += a[i]; return s / (i1 - i0 + 1); }

  function trend(rec, meta) {
    var sh = shares(rec, meta), n = sh.length, early = avg(sh, 0, 2), late = avg(sh, n - 3, n - 1);
    var k = early === 0 ? (late > 0 ? 'new' : 'steady') : late / early >= 1.25 ? 'rising' : late / early <= 0.8 ? 'falling' : 'steady';
    return { key: k, label: TREND[k].label, why: TREND[k].why, change: early ? late / early - 1 : null };
  }
  function peak(rec, meta) {
    var sh = shares(rec, meta), bi = 0;
    for (var i = 1; i < sh.length; i++) if (sh[i] > sh[bi]) bi = i;
    return { year: meta.years[bi], per10k: sh[bi], count: rec.y[bi] };
  }
  function boroLine(rec) {
    var best = null;
    for (var b in rec.bo) if (!best || rec.bo[b] > rec.bo[best]) best = b;
    return best ? { code: best, name: BORO[best], title: BORO_TITLE[best], n: rec.bo[best] } : null;
  }
  function girlsPct(rec) { var g = rec.f + rec.m; return g ? rec.f / g : null; }
  function sexLine(rec) {
    var p = girlsPct(rec); if (p === null) return '';
    var pc = function (v) { var r = Math.round(v * 100); return v < 1 && r === 100 ? 'over 99' : String(r); };
    if (p >= 0.9) return pc(p) + '% are female';
    if (p <= 0.1) return pc(1 - p) + '% are male';
    return Math.round(p * 100) + '% female, ' + Math.round((1 - p) * 100) + '% male';
  }
  function oneIn(rec, meta) { var t = meta.dogs; return rec.t ? Math.max(1, Math.round(t / rec.t)) : 0; }

  function summary(rec, meta) {
    var pk = peak(rec, meta), tr = trend(rec, meta), bo = boroLine(rec), br = rec.br[0];
    var s = rec.n + ' is the ' + ordinal(rec.r) + ' most common name among NYC\u2019s licensed dogs: ' + fmt(rec.t) + ' dogs licensed since ' + meta.firstIssue + ', about 1 in ' + fmt(oneIn(rec, meta)) + '.';
    var sl = sexLine(rec); if (sl) s += ' ' + sl.charAt(0).toUpperCase() + sl.slice(1) + '.';
    if (br) s += ' The most common breed is ' + br[0] + (br[0] === 'Terrier' || br[0] === 'Hound' || br[0] === 'Shepherd' ? ' (mix)' : '') + '.';
    if (bo) s += ' Most live in ' + bo.name + '.';
    s += ' Its share of new licenses peaked in ' + pk.year + ' and the trend is ' + tr.label.toLowerCase() + '.';
    return s;
  }

  // ---------- SVG chart (string; used by the app and the static pages) ----------
  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  function tick(v) { return v >= 100 ? String(Math.round(v)) : String(+v.toFixed(v < 1 ? 2 : 1)); }
  function svgChart(series, years, opts) {
    opts = opts || {};
    var W = opts.width || 640, H = opts.height || 240, pl = 46, pr = 18, pt = 14, pb = 30;
    var n = years.length, max = 0;
    series.forEach(function (s) { s.values.forEach(function (v) { if (v > max) max = v; }); });
    var top = niceMax(max);
    var x = function (i) { return pl + (W - pl - pr) * i / Math.max(1, n - 1); };
    var y = function (v) { return pt + (H - pt - pb) * (1 - v / top); };
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'Trend chart') + '" class="chart">'];
    for (var g = 0; g <= 4; g++) {
      var v = top * g / 4, yy = Math.round(y(v));
      out.push('<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" class="grid"/>');
      out.push('<text x="' + (pl - 6) + '" y="' + (yy + 5) + '" text-anchor="end" class="tick">' + tick(v) + '</text>');
    }
    for (var i = 0; i < n; i += 2) out.push('<text x="' + Math.round(x(i)) + '" y="' + (H - 8) + '" text-anchor="middle" class="tick">' + years[i] + '</text>');
    series.forEach(function (s) {
      var pts = s.values.map(function (v, i2) { return Math.round(x(i2)) + ',' + Math.round(y(v)); }).join(' ');
      out.push('<polyline fill="none" stroke="' + s.color + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="' + pts + '"><title>' + esc(s.label) + '</title></polyline>');
      s.values.forEach(function (v, i2) { out.push('<circle cx="' + Math.round(x(i2)) + '" cy="' + Math.round(y(v)) + '" r="' + (opts.mark === years[i2] ? 6 : 3) + '" fill="' + (opts.mark === years[i2] ? s.color : '#fff') + '" stroke="' + s.color + '" stroke-width="2"/>'); });
    });
    out.push('</svg>');
    return out.join('');
  }

  return { BORO: BORO, BORO_TITLE: BORO_TITLE, BORO_ORDER: BORO_ORDER, TREND: TREND, fmt: fmt, esc: esc, ordinal: ordinal, key: key,
    shares: shares, trend: trend, peak: peak, boroLine: boroLine, girlsPct: girlsPct, sexLine: sexLine, oneIn: oneIn, summary: summary,
    svgChart: svgChart, niceMax: niceMax };
});
