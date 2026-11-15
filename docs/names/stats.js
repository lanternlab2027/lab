/* Baby Name Report Card: shared stats. Runs in the browser (window.NameStats) and in Node (require).
   Data: U.S. Social Security Administration national baby-name files (names with 5+ births per sex per year). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NameStats = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SEXES = ['F', 'M'];
  var SEX_WORD = { F: 'girls', M: 'boys' };

  // ---------- record decoding ----------
  // Shard record per sex: [firstYear, "counts base36, comma-separated, empty = 0", latestRank (0 = absent),
  //                        bestRank, bestRankYear, "decade ranks base36, comma-separated from 1880s, empty = not top 1000" | ""]
  function decodeRec(arr, meta) {
    var first = meta.first, n = meta.latest - first + 1;
    var counts = new Array(n); for (var i = 0; i < n; i++) counts[i] = 0;
    var parts = String(arr[1]).split(','), y0 = arr[0] - first;
    for (var j = 0; j < parts.length; j++) if (parts[j]) counts[y0 + j] = parseInt(parts[j], 36);
    var dr = {};
    if (arr[5]) String(arr[5]).split(',').forEach(function (v, k) { if (v) dr[first + k * 10] = parseInt(v, 36); });
    return { counts: counts, rank: arr[2] || 0, bestRank: arr[3] || 0, bestRankYear: arr[4] || 0, decadeRanks: dr };
  }

  function encodeCounts(counts, first) {
    var a = -1, b = -1;
    for (var i = 0; i < counts.length; i++) if (counts[i]) { if (a < 0) a = i; b = i; }
    if (a < 0) return [first, ''];
    var out = [];
    for (var k = a; k <= b; k++) out.push(counts[k] ? counts[k].toString(36) : '');
    return [first + a, out.join(',')];
  }

  // ---------- helpers ----------
  function sum(a, from, to) { var s = 0; for (var i = Math.max(0, from); i <= Math.min(a.length - 1, to); i++) s += a[i]; return s; }
  function perMillion(counts, totals) { return counts.map(function (c, i) { return totals[i] ? c / totals[i] * 1e6 : 0; }); }
  function avg(a, from, to) { from = Math.max(0, from); to = Math.min(a.length - 1, to); if (to < from) return 0; return sum(a, from, to) / (to - from + 1); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function ordinalRank(r) { return r ? '#' + fmt(r) : 'unranked'; }
  function oneIn(pm) { return pm > 0 ? Math.max(1, Math.round(1e6 / pm)) : 0; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function decadeAverages(share, first) {
    // average per-million share for each calendar decade (partial last decade uses the years available)
    var out = [];
    for (var d = first - (first % 10); d <= first + share.length - 1; d += 10) {
      var a = d - first, b = d + 9 - first;
      out.push({ decade: d, pm: avg(share, a, b) });
    }
    return out;
  }

  // ---------- trend ----------
  // All tests use share of births (per million babies of that sex), so baby booms don't fake a trend.
  //   Vintage revival: a 1880s-1940s decade averaged 300+ per million, some decade from the 1950s-2000s fell to 25% of that or less,
  //                    and the last 5 years are at least 3x that low point and 100+ per million.
  //   Classic:         given every single year since 1880, still 300+ per million, and its best full decade is no more than 8x its worst
  //                    (16x for names still at 1,000+ per million, roughly the top 150).
  //   Rising/Falling:  last 5 years' average share vs the same 5 years a decade earlier: +25% or more / -20% or more.
  //   Falling (long-term): level over the last decade but under 10% of its best decade's share.
  //   Steady:          anything else.
  function trend(share, first) {
    var L = share.length - 1;
    var recent = avg(share, L - 4, L), prior = avg(share, L - 14, L - 10);
    var dec = decadeAverages(share, first);
    var early = 0, earlyDec = 0, trough = Infinity, troughDec = 0;
    dec.forEach(function (d) {
      if (d.decade <= 1940 && d.pm > early) { early = d.pm; earlyDec = d.decade; }
      if (d.decade >= 1950 && d.decade <= 2000 && d.pm < trough) { trough = d.pm; troughDec = d.decade; }
    });
    var everyYear = share.every(function (v) { return v > 0; });
    var full = dec.filter(function (d) { return d.decade + 9 <= first + L; });
    var maxD = Math.max.apply(null, full.map(function (d) { return d.pm; }));
    var minD = Math.min.apply(null, full.map(function (d) { return d.pm; }));
    var change = prior > 0 ? recent / prior : (recent > 0 ? Infinity : 1);
    var firstYear = first + share.findIndex(function (v) { return v > 0; });
    var r = { recent: recent, prior: prior, change: change, early: early, earlyDecade: earlyDec, trough: trough, troughDecade: troughDec, firstYear: firstYear };
    var latest = first + L;
    if (early >= 300 && trough <= early * 0.25 && recent >= Math.max(trough * 3, 100)) {
      r.key = 'revival'; r.label = 'Vintage revival';
      r.why = 'Popular in the ' + earlyDec + 's, faded by the ' + troughDec + 's, and back: the last five years run ' + (trough > 0 ? Math.round(recent / trough) + 'x' : 'far above') + ' its low point.';
    } else if (everyYear && minD > 0 && recent >= 300 && maxD / minD <= (recent >= 1000 ? 16 : 8)) {
      r.key = 'classic'; r.label = 'Classic';
      r.why = 'Given every year since ' + first + ' and still common. Its busiest decade was ' + Math.round(maxD / minD) + 'x its quietest, a narrow swing for a name this old.';
    } else if (change >= 1.25) {
      r.key = 'rising'; r.label = 'Rising';
      r.why = prior > 0 ? 'Up ' + pct(change) + ' in share of births over the last decade (' + (latest - 4) + '\u2013' + latest + ' vs ' + (latest - 14) + '\u2013' + (latest - 10) + ').'
        : 'New on the list: first recorded in ' + firstYear + '.';
    } else if (change <= 0.8) {
      r.key = 'falling'; r.label = 'Falling';
      r.why = 'Down ' + pct(change) + ' in share of births over the last decade (' + (latest - 4) + '\u2013' + latest + ' vs ' + (latest - 14) + '\u2013' + (latest - 10) + ').';
    } else if (recent < maxD * 0.1) {
      var top = dec.reduce(function (a, d) { return d.pm > a.pm ? d : a; });
      r.key = 'falling'; r.label = 'Falling';
      r.why = 'Long-term faller: its share of births is down ' + Math.round((1 - recent / top.pm) * 100) + '% from its peak decade (the ' + top.decade + 's), though it has held about level over the last ten years.';
    } else {
      r.key = 'steady'; r.label = 'Steady';
      r.why = 'Within ' + Math.abs(Math.round((change - 1) * 100)) + '% of where it was a decade ago, measured by share of births.';
    }
    return r;
  }
  function pct(ratio) { return Math.abs(Math.round((ratio - 1) * 100)) + '%'; }

  // ---------- the report ----------
  // recs: { F: decoded|undefined, M: decoded|undefined }; meta: { first, latest, totals: { F: [...], M: [...] } }
  function report(name, recs, meta) {
    var first = meta.first, latest = meta.latest, L = latest - first;
    var sexes = {};
    SEXES.forEach(function (s) {
      var d = recs[s]; if (!d) return;
      var share = perMillion(d.counts, meta.totals[s]);
      var pk = 0; for (var i = 1; i < share.length; i++) if (share[i] > share[pk]) pk = i;
      var pkc = 0; for (var k = 1; k < d.counts.length; k++) if (d.counts[k] > d.counts[pkc]) pkc = k;
      sexes[s] = {
        sex: s, counts: d.counts, share: share, total: sum(d.counts, 0, L),
        latestCount: d.counts[L], rank: d.rank, bestRank: d.bestRank, bestRankYear: d.bestRankYear, decadeRanks: d.decadeRanks,
        peak: { year: first + pk, count: d.counts[pk], perMillion: share[pk], oneIn: oneIn(share[pk]) },
        peakCount: { year: first + pkc, count: d.counts[pkc] },
        trend: trend(share, first)
      };
    });
    var have = Object.keys(sexes);
    if (!have.length) return null;
    // primary sex: more births in the latest year; tie or absent -> more births all-time
    var primary = have.length === 1 ? have[0] : (function () {
      var f = sexes.F, m = sexes.M;
      if (f.latestCount !== m.latestCount) return f.latestCount > m.latestCount ? 'F' : 'M';
      return f.total >= m.total ? 'F' : 'M';
    })();
    var lf = sexes.F ? sexes.F.latestCount : 0, lm = sexes.M ? sexes.M.latestCount : 0;
    var tf = sexes.F ? sexes.F.total : 0, tm = sexes.M ? sexes.M.total : 0;
    var p = sexes[primary];
    return {
      name: name, first: first, latest: latest, sexes: sexes, primary: primary,
      latestCount: lf + lm, allTime: tf + tm,
      split: { latestF: lf + lm ? lf / (lf + lm) : null, allF: tf / (tf + tm) },
      peak: p.peak, rank: p.rank, trend: p.trend,
      sameYear: Math.max(0, lf + lm - 1)
    };
  }

  function countIn(rep, year) {
    var i = year - rep.first; if (i < 0 || year > rep.latest) return null;
    var c = 0; SEXES.forEach(function (s) { if (rep.sexes[s]) c += rep.sexes[s].counts[i]; }); return c;
  }

  var GENERATIONS = [
    ['Greatest Generation', 1901, 1927], ['Silent Generation', 1928, 1945], ['Baby Boomers', 1946, 1964],
    ['Gen X', 1965, 1980], ['Millennials', 1981, 1996], ['Gen Z', 1997, 2012], ['Gen Alpha', 2013, 2025]
  ];
  function generations(rep) {
    return GENERATIONS.map(function (g) {
      var to = Math.min(g[2], rep.latest), c = 0;
      for (var y = g[1]; y <= to; y++) c += countIn(rep, y) || 0;
      return { label: g[0], from: g[1], to: to, count: c };
    });
  }

  // ---------- similar-sounding names that are rising ----------
  // A name counts as "similar" when, lowercased, it is one letter edit from yours (add, drop or swap a letter), or two edits away
  // with the same first letter (both names 5+ letters), or it shares your first two letters and your last two letters. Only names whose share of births grew 30%+ over the last five years
  // (with at least 100 babies in the latest year) are eligible; they come from rising.json. Same-sex names first, closest spelling first.
  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    var prev = []; for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      var cur = [i];
      for (var k = 1; k <= n; k++) cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(k - 1) ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function similarScore(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    if (a === b) return -1;
    var d = lev(a, b);
    if (d === 1 && Math.min(a.length, b.length) >= 3) return 1;
    if (d === 2 && a[0] === b[0] && Math.min(a.length, b.length) >= 5) return 2;
    if (a.length >= 3 && b.length >= 3 && a.slice(0, 2) === b.slice(0, 2) && a.slice(-2) === b.slice(-2)) return 2.5;
    return -1;
  }
  // rising: [[name, sex, latestCount, growthRatio], ...]
  function similarRising(name, sex, rising, limit) {
    var seen = {}, out = [];
    rising.forEach(function (r) {
      var sc = similarScore(name, r[0]); if (sc < 0) return;
      out.push({ name: r[0], sex: r[1], count: r[2], growth: r[3], score: sc + (r[1] === sex ? 0 : 10) });
    });
    out.sort(function (x, y) { return x.score - y.score || y.growth - x.growth; });
    return out.filter(function (o) { if (seen[o.name]) return false; seen[o.name] = 1; return true; }).slice(0, limit || 6);
  }

  // ---------- written summary (used on the static pages and in the app) ----------
  function summary(rep) {
    var p = rep.sexes[rep.primary], w = SEX_WORD[rep.primary], out = [];
    var latest = rep.latest;
    if (p.rank) out.push(rep.name + ' was the ' + (p.rank === 1 ? '' : ordinalWord(p.rank) + ' ') + 'most popular name for ' + w + ' born in the U.S. in ' + latest + ', given to ' + fmt(p.latestCount) + ' ' + w + '.');
    else if (rep.latestCount) out.push(fmt(rep.latestCount) + ' U.S. babies were named ' + rep.name + ' in ' + latest + '.');
    else out.push('No U.S. babies were recorded as ' + rep.name + ' in ' + latest + ' (fewer than 5 per sex are not published).');
    var pk = p.peak;
    if (pk.year === latest) out.push('That is its highest share of births on record.');
    else out.push('It peaked in ' + pk.year + ', when about 1 in ' + fmt(pk.oneIn) + ' ' + w + ' got the name (' + fmt(pk.count) + ' babies).');
    if (p.bestRank && p.bestRank !== p.rank) out.push('Its best-ever rank was ' + ordinalRank(p.bestRank) + ' in ' + p.bestRankYear + '.');
    var other = rep.primary === 'F' ? rep.sexes.M : rep.sexes.F;
    if (other && rep.split.allF !== null) {
      var share = rep.primary === 'F' ? 1 - rep.split.allF : rep.split.allF;
      if (share >= 0.05) out.push('Since ' + rep.first + ', ' + Math.round(share * 100) + '% of babies named ' + rep.name + ' have been ' + SEX_WORD[other.sex] + '.');
    }
    return out.join(' ');
  }
  function ordinalWord(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return fmt(n) + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // ---------- SVG chart (static pages and the app share this) ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // series: [{ label, values (per million, one per year), color }]
  function svgChart(series, first, opts) {
    opts = opts || {};
    var W = opts.width || 640, H = opts.height || 250, pl = 46, pr = 18, pt = 12, pb = 30;
    var n = series[0].values.length, last = first + n - 1;
    var max = 0; series.forEach(function (s) { s.values.forEach(function (v) { if (v > max) max = v; }); });
    var top = niceMax(max);
    var x = function (i) { return pl + (W - pl - pr) * i / (n - 1); };
    var y = function (v) { return pt + (H - pt - pb) * (1 - v / top); };
    var parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'Popularity chart') + '" class="chart">'];
    for (var g = 0; g <= 4; g++) {
      var v = top * g / 4, yy = Math.round(y(v));
      parts.push('<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" class="grid"/>');
      parts.push('<text x="' + (pl - 6) + '" y="' + (+yy + 5) + '" text-anchor="end" class="tick">' + shortNum(v) + '</text>');
    }
    for (var yr = Math.ceil(first / 20) * 20; yr <= last; yr += 20) {
      parts.push('<text x="' + Math.round(x(yr - first)) + '" y="' + (H - 8) + '" text-anchor="middle" class="tick">' + yr + '</text>');
    }
    series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return Math.round(x(i)) + ',' + Math.round(y(v)); }).join(' ');
      parts.push('<polyline fill="none" stroke="' + s.color + '" stroke-width="2.5" stroke-linejoin="round" points="' + pts + '"><title>' + esc(s.label) + '</title></polyline>');
    });
    if (opts.mark != null) {
      var ms = series[series.length - 1], mi = opts.mark - first, mv = ms.values[mi]; // the mark belongs to the last (top) series
      if (mi >= 0 && mi < n) parts.push('<circle cx="' + Math.round(x(mi)) + '" cy="' + Math.round(y(mv)) + '" r="5" fill="' + ms.color + '" stroke="#fff" stroke-width="2"/>');
    }
    parts.push('</svg>');
    return parts.join('');
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  function shortNum(v) { var t = function (x) { return String(+x.toFixed(2)); }; return v >= 1000 ? t(v / 1000) + 'k' : (v < 10 ? t(v) : String(Math.round(v))); }

  // whole-percent split that never shows 0% or 100% for a sex that has babies
  function pctPair(f) {
    var a = Math.round(f * 100), b = 100 - a;
    var fs = f > 0 && a === 0 ? '<1%' : f < 1 && a === 100 ? '>99%' : a + '%';
    var ms = f < 1 && b === 0 ? '<1%' : f > 0 && b === 100 ? '>99%' : b + '%';
    return [fs, ms];
  }
  // chart series for a report: the other sex is drawn only if it's 1%+ of the name's babies
  function seriesFor(rep, colors) {
    var out = [];
    SEXES.forEach(function (s) {
      var d = rep.sexes[s]; if (!d || s === rep.primary || d.total < rep.allTime * 0.01) return;
      out.push({ label: rep.name + ' (' + SEX_WORD[s] + ')', values: d.share, color: colors[s] });
    });
    out.push({ label: rep.name + ' (' + SEX_WORD[rep.primary] + ')', values: rep.sexes[rep.primary].share, color: colors[rep.primary] });
    return out;
  }
  function countLabel(rep) { return rep.sexes.F && rep.sexes.M && rep.sexes.F.latestCount && rep.sexes.M.latestCount ? 'girls + boys in ' + rep.latest : 'babies in ' + rep.latest; }

  function slug(name) { return name.toLowerCase().replace(/[^a-z]/g, ''); }

  return {
    SEXES: SEXES, SEX_WORD: SEX_WORD, decodeRec: decodeRec, encodeCounts: encodeCounts, perMillion: perMillion, trend: trend,
    report: report, countIn: countIn, generations: generations, lev: lev, similarScore: similarScore, similarRising: similarRising,
    summary: summary, svgChart: svgChart, niceMax: niceMax, fmt: fmt, ordinalRank: ordinalRank, ordinalWord: ordinalWord, oneIn: oneIn,
    esc: esc, slug: slug, pctPair: pctPair, seriesFor: seriesFor, countLabel: countLabel, decadeAverages: decadeAverages, cap: cap, avg: avg
  };
});
