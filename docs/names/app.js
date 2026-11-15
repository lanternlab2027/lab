/* Baby Name Report Card: app. Data loads from ./data (same origin). No tracking. */
(function () {
  'use strict';
  var S = window.NameStats, Card = window.NameCard;
  var $ = function (s) { return document.querySelector(s); };
  var esc = S.esc, fmt = S.fmt;
  var COLORS = { F: '#b5446e', M: '#2f6db5' }, CMP = ['#23345c', '#b07d0e'];
  var meta = null, rising = [], topSet = {}, shards = {};
  var current = null; // { a: rep, b: rep|null }

  function say(msg, isError) { var s = $('#status'); s.textContent = msg || ''; s.className = 'status' + (isError ? ' err' : ''); }

  // ---------- share links: ?ref= passthrough (URL only, nothing stored) ----------
  var APP_URL = 'https://lanternlab2027.github.io/lab/names/';
  function nextRef() {
    var r = '';
    try { r = new URLSearchParams(location.search).get('ref') || ''; } catch (e) { r = ''; }
    r = r.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    if (!r) return 'share';
    var m = /^share(\d*)(?:-(.+))?$/.exec(r);
    if (m) return 'share' + ((m[1] ? +m[1] : 1) + 1) + (m[2] ? '-' + m[2] : '');
    return 'share-' + r;
  }
  var REF = nextRef();
  function shareUrl() {
    var u = APP_URL + '?';
    if (current) { u += 'n=' + encodeURIComponent(current.a.name) + (current.b ? '&vs=' + encodeURIComponent(current.b.name) : '') + '&'; }
    return u + 'ref=' + encodeURIComponent(REF);
  }
  function shareText() {
    if (!current) return 'When did your name peak? Free baby name report card from Social Security data: ' + shareUrl();
    var a = current.a, b = current.b;
    if (b) return a.name + ' vs ' + b.name + ': ' + Card.headline(a).toLowerCase() + ' vs ' + Card.headline(b).toLowerCase() + '. Make yours: ' + shareUrl();
    return a.name + ': ' + Card.headline(a).replace('Peaked', 'peaked').replace('Peaking', 'peaking') + '. Make yours: ' + shareUrl();
  }

  // ---------- data ----------
  function getJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  function norm(q) { q = String(q || '').replace(/[^A-Za-z]/g, ''); return q ? q.charAt(0).toUpperCase() + q.slice(1).toLowerCase() : ''; }
  function lookup(name) {
    if (name.length < 2) return Promise.resolve(null);
    var key = name.slice(0, 2).toLowerCase();
    if (meta.shards && (' ' + meta.shards + ' ').indexOf(' ' + key + ' ') < 0) return Promise.resolve(null);
    var p = shards[key] || (shards[key] = getJSON('data/s/' + key + '.json').catch(function (e) { delete shards[key]; if (/404/.test(e.message)) return {}; throw e; }));
    return p.then(function (sh) {
      var rec = sh[name]; if (!rec) return null;
      var recs = {}; Object.keys(rec).forEach(function (s) { recs[s] = S.decodeRec(rec[s], meta); });
      return S.report(name, recs, meta);
    });
  }

  // ---------- rendering ----------
  function legend(items) { return '<p class="legend">' + items.map(function (i) { return '<span><i style="background:' + i[1] + '"></i>' + esc(i[0]) + '</span>'; }).join('') + '</p>'; }
  function chartFor(rep) {
    var series = S.seriesFor(rep, COLORS); // primary sex drawn last (on top)
    return S.svgChart(series, rep.first, { label: 'Babies named ' + rep.name + ' per million births, ' + rep.first + '\u2013' + rep.latest, mark: rep.peak.year }) +
      legend(series.map(function (s) { return [s.label, s.color]; }).reverse()) + '<p class="small" style="margin:2px 0 0">Babies per million births of each sex.</p>';
  }
  function splitHtml(rep) {
    var f = rep.split.latestF, a = rep.split.allF;
    var bar = function (v) { return '<div class="splitbar" aria-hidden="true"><div class="f" style="width:' + (v * 100).toFixed(1) + '%"></div><div class="m" style="width:' + ((1 - v) * 100).toFixed(1) + '%"></div></div>'; };
    var row = function (label, v) { var pp = S.pctPair(v); return '<p style="margin:8px 0 0"><b>' + label + ':</b> ' + pp[0] + ' girls, ' + pp[1] + ' boys</p>' + bar(v); };
    return (f !== null ? row('In ' + rep.latest, f) : '<p style="margin:8px 0 0">Not recorded in ' + rep.latest + '.</p>') + row('All years since ' + rep.first, a);
  }
  function decadeTable(rep) {
    var p = rep.sexes[rep.primary], rows = [];
    for (var d = rep.first; d <= rep.latest; d += 10) {
      var i0 = d - rep.first, i1 = Math.min(d + 9, rep.latest) - rep.first, c = 0;
      for (var i = i0; i <= i1; i++) c += p.counts[i];
      rows.push('<tr><td>' + d + 's</td><td class="n">' + (p.decadeRanks[d] ? '#' + fmt(p.decadeRanks[d]) : '&mdash;') + '</td><td class="n">' + fmt(c) + '</td></tr>');
    }
    return '<div class="tablewrap"><table><thead><tr><th>Decade</th><th class="n">Rank (' + S.SEX_WORD[rep.primary] + ')</th><th class="n">Babies</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div><p class="small">Rank by total births in the decade, top 1,000 only. The ' + (rep.latest - rep.latest % 10) + 's are partial.</p>';
  }
  function similarHtml(rep) {
    var sim = S.similarRising(rep.name, rep.primary, rising, 6);
    if (!sim.length) return '<p>No similar-looking names are climbing fast right now.</p>';
    return '<ul class="chips">' + sim.map(function (o) {
      return '<li><a href="?n=' + encodeURIComponent(o.name) + '" data-name="' + esc(o.name) + '">' + esc(o.name) + ' <small>+' + Math.round((o.growth - 1) * 100) + '%</small></a></li>';
    }).join('') + '</ul><p class="small">Change in share of births over five years. <a href="#how-h">How these are picked</a>.</p>';
  }
  function birthYearHtml(rep, y) {
    if (!y) return '';
    var c = S.countIn(rep, y);
    if (c === null) return '<p class="why">Pick a year between ' + rep.first + ' and ' + rep.latest + '.</p>';
    return '<p><b>Born in ' + y + '?</b> ' + (c ? fmt(c) + ' U.S. babies were named ' + esc(rep.name) + ' that year' + (c > 1 ? ', so ' + fmt(c - 1) + ' others share your name and birth year.' : '.') : 'Fewer than 5 babies of either sex were named ' + esc(rep.name) + ' that year, so SSA didn\u2019t publish it.') + '</p>';
  }

  function reportHtml(rep, y) {
    var p = rep.sexes[rep.primary], w = S.SEX_WORD[rep.primary];
    var page = topSet[rep.name] ? '<p class="small"><a href="n/' + S.slug(rep.name) + '.html">Full page for ' + esc(rep.name) + ' &rarr;</a></p>' : '';
    return '<section class="sheet" aria-label="Report card for ' + esc(rep.name) + '">' +
      '<div class="rc-head"><h2 class="rc-name">' + esc(rep.name) + '</h2><span class="stamp ' + rep.trend.key + '">' + esc(rep.trend.label) + '</span></div>' +
      '<p>' + esc(S.summary(rep)) + '</p>' +
      '<div class="grid">' +
      '<div class="stat"><b>' + S.ordinalRank(p.rank) + '</b><span>' + rep.latest + ' rank, ' + w + '</span></div>' +
      '<div class="stat"><b>' + fmt(rep.latestCount) + '</b><span>' + S.countLabel(rep) + '</span></div>' +
      '<div class="stat"><b>' + rep.peak.year + '</b><span>peak year (1 in ' + fmt(rep.peak.oneIn) + ' ' + w + ')</span></div>' +
      '<div class="stat"><b>' + fmt(rep.allTime) + '</b><span>babies since ' + rep.first + '</span></div>' +
      '</div>' +
      '<p class="why"><b>Trend: ' + esc(rep.trend.label) + '.</b> ' + esc(rep.trend.why) + '</p>' +
      '<p class="why"><b>Same-year twins:</b> ' + (rep.latestCount ? 'if your kid was named ' + esc(rep.name) + ' in ' + rep.latest + ', ' + fmt(rep.sameYear) + ' other babies born that year share it.' : 'nobody was recorded with it in ' + rep.latest + '.') + '</p>' +
      birthYearHtml(rep, y) +
      chartFor(rep) +
      '<div class="cols"><div><h3 style="margin-top:18px">Girls vs boys</h3>' + splitHtml(rep) + '</div>' +
      '<div><h3 style="margin-top:18px">Similar names on the rise</h3>' + similarHtml(rep) + '</div></div>' +
      '<h3 style="margin-top:18px">Rank by decade</h3>' + decadeTable(rep) + page +
      '</section>';
  }

  function compareHtml(a, b) {
    var rows = [
      ['Trend', function (r) { return esc(r.trend.label); }],
      [meta.latest + ' rank', function (r) { return S.ordinalRank(r.rank) + ' (' + S.SEX_WORD[r.primary] + ')'; }],
      ['Babies in ' + meta.latest, function (r) { return fmt(r.latestCount); }],
      ['Peak year', function (r) { return r.peak.year + ' (1 in ' + fmt(r.peak.oneIn) + ')'; }],
      ['Best rank ever', function (r) { var p = r.sexes[r.primary]; return S.ordinalRank(p.bestRank) + ' in ' + p.bestRankYear; }],
      ['Babies since ' + meta.first, function (r) { return fmt(r.allTime); }],
      ['Girls, all years', function (r) { return S.pctPair(r.split.allF)[0]; }]
    ];
    var series = [
      { label: a.name, values: a.sexes[a.primary].share, color: CMP[0] },
      { label: b.name, values: b.sexes[b.primary].share, color: CMP[1] }
    ];
    var lead = a.latestCount === b.latestCount ? 'They were tied in ' + meta.latest + '.' :
      (a.latestCount > b.latestCount ? a : b).name + ' was given to ' + fmt(Math.abs(a.latestCount - b.latestCount)) + ' more babies in ' + meta.latest + '.';
    return '<section class="sheet" aria-label="Compare ' + esc(a.name) + ' and ' + esc(b.name) + '">' +
      '<div class="rc-head"><h2 class="rc-name">' + esc(a.name) + ' <span class="vs">vs</span> ' + esc(b.name) + '</h2></div>' +
      '<p>' + esc(lead) + '</p>' +
      S.svgChart(series, meta.first, { label: a.name + ' and ' + b.name + ' per million births since ' + meta.first }) +
      legend(series.map(function (s) { return [s.label + ' (' + S.SEX_WORD[(s.label === a.name ? a : b).primary] + ')', s.color]; })) +
      '<div class="tablewrap"><table><thead><tr><th></th><th>' + esc(a.name) + '</th><th>' + esc(b.name) + '</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + r[1](a) + '</td><td>' + r[1](b) + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>' + reportHtml(a) + reportHtml(b);
  }

  // ---------- run ----------
  function setUrl(a, b, y) {
    try {
      var p = new URLSearchParams(location.search);
      p.set('n', a); if (b) p.set('vs', b); else p.delete('vs'); if (y) p.set('y', y); else p.delete('y');
      history.replaceState(null, '', '?' + p.toString());
    } catch (e) { /* ignore */ }
  }
  var NOT_FOUND = function (n) { return 'No record for \u201c' + n + '\u201d. SSA only publishes names given to at least 5 babies of one sex in a year; this tool covers every name given in ' + meta.latest + ' plus any with 200+ babies since ' + meta.first + '. Check the spelling, or try a common variant.'; };

  function run() {
    var n1 = norm($('#q').value), compare = !$('#vs-row').hidden, n2 = compare ? norm($('#q2').value) : '';
    var y = parseInt($('#yr').value, 10) || 0;
    if (!n1) { say('Type a first name (letters only).', true); return; }
    if (!meta) { say('Still loading the data\u2026'); return; }
    say('Looking up ' + n1 + (n2 ? ' and ' + n2 : '') + '\u2026');
    Promise.all([lookup(n1), n2 ? lookup(n2) : Promise.resolve(null)]).then(function (res) {
      var a = res[0], b = res[1];
      if (!a) { say(NOT_FOUND(n1), true); return; }
      if (n2 && !b) { say(NOT_FOUND(n2), true); return; }
      current = { a: a, b: b };
      var out = $('#result'); out.hidden = false;
      out.innerHTML = b ? compareHtml(a, b) : reportHtml(a, y);
      setUrl(a.name, b && b.name, y);
      document.title = (b ? a.name + ' vs ' + b.name : a.name) + ' \u00b7 Baby Name Report Card';
      say('');
      if (b) Card.drawTwo($('#card'), a, b); else Card.drawOne($('#card'), a);
      $('#share').hidden = false;
      $('#pass-text').textContent = shareText();
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () { say('Couldn\u2019t load the name data. Check your connection and try again.', true); });
  }

  $('#search').addEventListener('submit', function (e) { e.preventDefault(); run(); });
  $('#vs-toggle').addEventListener('click', function () {
    var r = $('#vs-row'); r.hidden = !r.hidden;
    this.textContent = r.hidden ? 'Compare two names' : 'Just one name';
    if (!r.hidden) $('#q2').focus(); else $('#q2').value = '';
  });
  $('#result').addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-name]'); if (!a) return;
    e.preventDefault(); $('#q').value = a.getAttribute('data-name'); $('#vs-row').hidden = true; $('#q2').value = ''; $('#vs-toggle').textContent = 'Compare two names'; run();
  });

  // ---------- share card ----------
  function fileName() { return 'name-report-card-' + (current ? S.slug(current.a.name) + (current.b ? '-vs-' + S.slug(current.b.name) : '') : 'card') + '.png'; }
  function blob() { return new Promise(function (res) { $('#card').toBlob(res, 'image/png'); }); }
  function download(b) { var u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = fileName(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } ta.remove(); return ok;
    }
  }
  $('#card-save').addEventListener('click', async function () { download(await blob()); });
  $('#card-share').addEventListener('click', async function () {
    var b = await blob(), f = new File([b], fileName(), { type: 'image/png' });
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: 'Baby Name Report Card', text: shareText() }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    download(b); $('#pass-msg').textContent = 'Saved the image. Paste the text above with it.';
  });
  $('#card-copy').addEventListener('click', async function () {
    $('#pass-msg').textContent = (await copyText(shareText())) ? 'Copied. Paste it with your card.' : 'Couldn\u2019t copy. Press and hold the text above to copy it.';
  });

  // ---------- boot ----------
  Promise.all([getJSON('data/meta.json'), getJSON('data/rising.json'), getJSON('data/top.json')]).then(function (r) {
    meta = r[0]; rising = r[1];
    var names = [];
    ['F', 'M'].forEach(function (s) { r[2][s].forEach(function (n) { if (n && !topSet[n]) { topSet[n] = 1; names.push(n); } }); });
    names.sort();
    $('#suggest').innerHTML = names.map(function (n) { return '<option value="' + n + '">'; }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('.latest'), function (el) { el.textContent = meta.latest; });
    Array.prototype.forEach.call(document.querySelectorAll('.next'), function (el) { el.textContent = meta.latest + 1; });
    $('#yr').max = meta.latest;
    var p = new URLSearchParams(location.search);
    if (p.get('n')) {
      $('#q').value = norm(p.get('n'));
      if (p.get('vs')) { $('#vs-row').hidden = false; $('#vs-toggle').textContent = 'Just one name'; $('#q2').value = norm(p.get('vs')); }
      if (/^\d{4}$/.test(p.get('y') || '')) $('#yr').value = p.get('y');
      run();
    }
  }).catch(function () { say('Couldn\u2019t load the name data. Refresh to try again.', true); });
  $('#pass-text').textContent = shareText();

  // ---------- email signup (sends only the email address) ----------
  (function () {
    var KIT_KEY = '9OgTfHEbtX6FB0NWVjkgyg'; var TAG = '25915951';
    var f = document.getElementById('signup-form');
    var msg = document.getElementById('signup-msg');
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = document.getElementById('signup-email').value.trim();
      var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing up...';
      try {
        var r = await fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: KIT_KEY, email: email })
        });
        if (!r.ok) throw new Error('status ' + r.status);
        f.innerHTML = "<b>You're on the list.</b> One email when SSA's new rankings are in.";
        msg.textContent = '';
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Email me in May';
        msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
      }
    });
  })();

  Object.defineProperty(window, '__namesState', { get: function () { return current; } });
})();
