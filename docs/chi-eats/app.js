/* Chicago Restaurant Report Card: UI. Depends on violations.js, results.js, soda.js, card.js. */
(function () {
  'use strict';
  var R = window.ChiResults, S = window.ChiSoda, V = window.ChiViolations, C = window.ChiCard;
  var SITE = 'https://lanternlab2027.github.io/lab/chi-eats/';
  var HOME_TITLE = document.title;
  var $ = function (s) { return document.querySelector(s); };
  var state = { results: [], resultsKey: '', current: null, newest: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function setStatus(msg, err) { var el = $('#status'); el.textContent = msg || ''; el.className = 'status' + (err ? ' err' : ''); }
  var toastTimer;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2200); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  // ---------- ?ref= passthrough (URL only, nothing stored) ----------
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

  function pill(key, label) { return '<span class="pill r-' + esc(key) + '">' + esc(label) + '</span>'; }
  var SHORT = { cond: 'Pass w/ Conditions', notlocated: 'Not Located' };

  // ---------- Search ----------
  async function runSearch(q, push) {
    q = (q || '').trim();
    var plan = S.searchPlan(q);
    if (!q || !plan.length) { setStatus('Type a restaurant name or a street address.', true); return; }
    $('#go').disabled = true;
    setStatus('Searching the Chicago Data Portal…');
    try {
      var rows = [], mode = '';
      for (var i = 0; i < plan.length; i++) {
        rows = S.dedupe(await S.get(plan[i].params));
        mode = plan[i].mode;
        if (rows.length) break;
      }
      var latest = null;
      if (rows.length) {
        try { latest = S.latestPerLicense(await S.run(function () { return S.chipsParams(rows.map(function (r) { return r.license_; })); })); } catch (e) { latest = null; }
      }
      state.results = rows.map(function (r) {
        var l = latest && S.validLicense(r.license_) ? latest[String(r.license_)] || latest[String(Number(r.license_))] : null;
        return Object.assign({}, r, { latestResult: l ? R.normResult(l.results) : null });
      });
      state.resultsKey = q;
      if (push) history.pushState({ q: q }, '', '?' + new URLSearchParams({ q: q }).toString());
      renderResults(mode, q);
      showResults();
    } catch (e) {
      setStatus(e.message || String(e), true);
    } finally { $('#go').disabled = false; }
  }

  function renderResults(mode, q) {
    var list = state.results, ul = $('#results');
    if (!list.length) {
      ul.innerHTML = ''; $('#results-note').textContent = '';
      setStatus('No establishments found for “' + q + '”. Try fewer words, a different spelling, or just the street number and name.', true);
      return;
    }
    setStatus(list.length + (list.length >= S.SEARCH_LIMIT ? '+' : '') + ' result' + (list.length === 1 ? '' : 's') + '. Pick one to see its report card.');
    $('#results-note').textContent = (mode === 'fulltext' ? 'No exact name match, so these are the closest full-text matches. ' : '') +
      (list.length >= S.SEARCH_LIMIT ? 'Showing the first ' + S.SEARCH_LIMIT + '. Add a street address to narrow it down. ' : '') +
      'Sorted by most recent inspection. Each license is listed separately, so a new owner shows up as a new listing.';
    ul.innerHTML = list.map(function (r, i) {
      var nm = R.tidyName(r.dba_name || 'Unnamed');
      var aka = r.aka_name && String(r.aka_name).trim().toUpperCase() !== String(r.dba_name || '').trim().toUpperCase() ? R.tidyName(r.aka_name) : '';
      var last = String(r.last || '').slice(0, 10);
      var lr = r.latestResult;
      return '<li><button type="button" data-i="' + i + '"><b>' + esc(nm) + (aka ? ' <span class="aka">(' + esc(aka) + ')</span>' : '') + '</b>' +
        (lr ? pill(lr.key, SHORT[lr.key] || lr.label) : '') +
        '<small>' + esc([R.titleCase(r.address || ''), r.zip].filter(Boolean).join(', ')) + '</small>' +
        '<small>' + esc([R.tidyType(r.facility_type), last ? 'Last record ' + R.fmtDate(last) : ''].filter(Boolean).join(' · ')) + '</small></button></li>';
    }).join('');
  }

  function showResults() {
    $('#detail').hidden = true;
    $('#results-sec').hidden = !state.results.length;
    document.title = HOME_TITLE;
  }

  // ---------- Detail ----------
  function keyFromRow(r) { return S.validLicense(r.license_) ? { license: String(Number(r.license_)) } : { dba: String(r.dba_name || ''), address: String(r.address || '') }; }
  function keyQuery(k) { return k.license ? '?license=' + encodeURIComponent(k.license) : '?dba=' + encodeURIComponent(k.dba) + '&addr=' + encodeURIComponent(k.address); }

  async function openRestaurant(key, push) {
    if (!S.detailParams(key)) { setStatus('That restaurant link doesn’t look right.', true); return; }
    setStatus('Loading inspection history…');
    try {
      var rows = await S.run(function () { return S.detailParams(key); });
      if (!rows.length) { setStatus('No records found for that restaurant in the city’s data.', true); return; }
      if (push) history.pushState({ key: key }, '', keyQuery(key));
      renderDetail(rows, key);
      setStatus('');
      $('#results-sec').hidden = true;
      $('#detail').hidden = false;
      $('#back').hidden = !state.results.length;
      $('#rc-name').setAttribute('tabindex', '-1');
      $('#rc-name').focus({ preventScroll: true });
      $('#detail').scrollIntoView({ block: 'start' });
      loadNewest();
    } catch (e) { setStatus(e.message || String(e), true); }
  }

  async function loadNewest() {
    if (!state.newest) {
      try { var r = await S.get(S.newestParams()); state.newest = r && r[0] && r[0].newest ? R.isoDay(r[0].newest) : null; } catch (e) { state.newest = null; }
    }
    renderAsOf();
  }
  function renderAsOf() {
    var n = state.newest;
    $('#asof').textContent = 'Newest first. Official data from the Chicago Department of Public Health via the City of Chicago Data Portal' +
      (n ? '; the dataset includes inspections through ' + R.fmtDate(n, true) : '') + '. Records go back to January 2010.';
  }

  function renderDetail(rows, key) {
    var id = R.identity(rows);
    var ins = R.groupInspections(rows);
    var sum = R.summarize(ins, today());
    state.current = { id: id, ins: ins, sum: sum, key: key };
    document.title = id.name + ' health inspection results | Chicago Restaurant Report Card';

    var latest = sum.latest, rk = latest ? latest.result.key : 'other';
    var badge = $('#badge');
    var BW = { pass: 'Pass', cond: 'Pass w/<br>Conditions', fail: 'Fail', oob: 'Out of<br>Business', noentry: 'No<br>Entry', notready: 'Not<br>Ready', notlocated: 'Not<br>Located', other: 'See<br>record' };
    badge.className = 'badge r-' + rk + (rk === 'pass' || rk === 'fail' ? '' : ' word');
    badge.innerHTML = BW[rk] || BW.other;
    $('#rc-name').textContent = id.name;
    $('#rc-meta').textContent = [id.address, id.zip].filter(Boolean).join(', ') + (id.facility ? ' · ' + id.facility : '') +
      (id.aka && id.name !== id.dba && id.dba ? ' · Licensed as ' + id.dba : '');
    $('#rsentence').textContent = R.capFirst(R.phrase(sum)) + '.';
    $('#rsentence').className = 'rsentence r-' + rk;
    $('#rexplain').textContent = latest ? (latest.rawResult || latest.result.label) + ': ' + latest.result.def : '';

    var facts = [];
    if (latest) facts.push(['Latest result', latest.rawResult || latest.result.label]);
    if (latest) facts.push(['Date', R.fmtDate(latest.date)]);
    if (latest && latest.type) facts.push(['Inspection type', latest.type]);
    if (sum.lastOutcome && sum.lastOutcome !== latest) facts.push(['Last completed inspection', sum.lastOutcome.result.label + ', ' + R.fmtDate(sum.lastOutcome.date)]);
    facts.push(['Risk category', sum.risk ? sum.risk.text : 'Not listed']);
    if (latest) facts.push(['Violations cited', String(latest.violations.length)]);
    if (id.license) facts.push(['License #', id.license]);
    $('#facts').innerHTML = facts.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('');
    $('#risk-explain').textContent = R.riskExplainer(sum.risk);
    $('#notes').innerHTML = sum.notes.map(function (n) { return '<p class="note">' + esc(n.text) + '</p>'; }).join('');

    $('#strip').innerHTML = stripSvg(ins);
    $('#counts').textContent = R.countsLine(sum, ins);
    renderAsOf();
    var firstOpen = -1;
    ins.some(function (x, k) { if (x.result.outcome) { firstOpen = k; return true; } return false; });
    $('#history').innerHTML = ins.map(function (x, k) { return inspectionHtml(x, k === firstOpen || (firstOpen < 0 && k === 0)); }).join('') || '<p class="small">No inspections on record.</p>';

    $('#cardwrap').hidden = true;
    var alertBox = $('#alert');
    if (alertBox.getAttribute('data-disabled') !== '1' && id.license && S.validLicense(id.license)) {
      alertBox.hidden = false;
      $('#alert-name').textContent = id.name;
      $('#signup-license').value = String(Number(id.license));
    } else alertBox.hidden = true;
  }

  function inspectionHtml(x, open) {
    var n = x.violations.length;
    var sum = '<summary><b>' + esc(R.fmtDate(x.date)) + '</b>' + pill(x.result.key, x.rawResult || x.result.label) +
      '<small>' + esc(x.type || 'Inspection') + '</small>' +
      '<small>' + (x.result.outcome || n ? n + ' violation' + (n === 1 ? '' : 's') + ' cited' : 'No inspection completed') + (x.risk ? ' · ' + esc(x.risk.text) : '') + '</small></summary>';
    var body = '<div><p class="action">' + esc(x.result.def) + (x.before2018 ? ' Inspected under the rules in place before July 1, 2018.' : '') + '</p>';
    if (n) {
      body += '<ul class="viol">' + x.violations.map(function (v) {
        var plain = V.plain(v.title);
        var sev = v.severity ? '<span class="flag sev-' + v.severity + '" title="Taken from the inspector’s comment">' + esc(R.SEVERITY_LABEL[v.severity]) + '</span>' : '';
        return '<li><div class="vhead">' + (v.num !== null ? '<span class="code">#' + esc(v.num) + '</span>' : '') + sev + '</div>' +
          (plain ? '<p class="plain">' + esc(plain) + '</p>' : '') +
          '<p class="official"><span class="olabel">Official text:</span> ' + esc(v.title || '(no title)') + '</p>' +
          (v.comments ? '<details class="cmt"><summary>Inspector’s comments</summary><p>' + esc(v.comments) + '</p></details>' : '') + '</li>';
      }).join('') + '</ul>';
    } else if (x.result.outcome) {
      body += '<p class="small" style="margin:0">No violations listed for this inspection.</p>';
    }
    body += '</div>';
    return '<details class="ins"' + (open ? ' open' : '') + '>' + sum + body + '</details>';
  }

  /** Results over time: one dot per record, one row per result kind. */
  function stripSvg(ins) {
    var pts = ins.filter(function (x) { return x.date; }).slice().reverse();
    if (!pts.length) return '';
    var rows = [['pass', 'Pass'], ['cond', 'Pass w/ Cond.'], ['fail', 'Fail'], ['other', 'Other']];
    var rowOf = function (k) { return k === 'pass' ? 0 : k === 'cond' ? 1 : k === 'fail' ? 2 : 3; };
    var W = 760, L = 112, Rm = 16, T = 10, RH = 30, B = 30, H = T + RH * rows.length + B;
    var t = pts.map(function (p) { return Date.parse(p.date + 'T12:00:00Z'); });
    var t0 = Math.min.apply(null, t), t1 = Math.max.apply(null, t);
    if (t1 === t0) { t0 -= 86400000 * 180; t1 += 86400000 * 180; }
    var x = function (v) { return L + (W - L - Rm) * (v - t0) / (t1 - t0); };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(pts.length + ' records from ' + R.fmtDate(pts[0].date) + ' to ' + R.fmtDate(pts[pts.length - 1].date)) + '">';
    rows.forEach(function (r, i) {
      var cy = T + RH * i + RH / 2;
      s += '<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + cy + '" y2="' + cy + '" stroke="var(--line)"/>';
      s += '<text x="' + (L - 10) + '" y="' + (cy + 4) + '" text-anchor="end" font-size="13" font-weight="700">' + r[1] + '</text>';
    });
    var y0 = new Date(t0).getUTCFullYear(), y1 = new Date(t1).getUTCFullYear(), step = y1 - y0 > 8 ? 2 : 1;
    for (var yr = y0; yr <= y1 + 1; yr += step) {
      var tt = Date.UTC(yr, 0, 1);
      if (tt < t0 || tt > t1) continue;
      s += '<line x1="' + x(tt) + '" x2="' + x(tt) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--line)" stroke-dasharray="2 3"/>';
      s += '<text x="' + x(tt) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="12">' + yr + '</text>';
    }
    pts.forEach(function (p, i) {
      var k = p.result.key, ri = rowOf(k), cy = T + RH * ri + RH / 2;
      var fill = 'var(--' + (ri === 3 ? 'other' : k) + ')';
      s += '<circle cx="' + x(t[i]).toFixed(1) + '" cy="' + cy + '" r="7" fill="' + fill + '" stroke="var(--sheet)" stroke-width="2"><title>' + esc(R.fmtDate(p.date) + ': ' + (p.rawResult || p.result.label) + (p.type ? ' (' + p.type + ')' : '')) + '</title></circle>';
    });
    return s + '</svg>';
  }

  // ---------- Sharing ----------
  function shareUrl() { return SITE + (state.current ? keyQuery(state.current.key) + '&' : '?') + 'ref=' + encodeURIComponent(REF); }
  function shareText() {
    var c = state.current; if (!c) return '';
    return R.headline(c.id.name, c.sum) + ' Full inspection history: ' + shareUrl();
  }
  function cardData() {
    var c = state.current, l = c.sum.latest, lo = c.sum.lastOutcome;
    return {
      name: c.id.name, address: c.id.address,
      key: l ? l.result.key : 'none',
      sentence: R.capFirst(R.phrase(c.sum)) + '.',
      resultLabel: l ? (l.rawResult || l.result.label) : '',
      lastOutcome: l && !l.result.outcome && lo ? lo.result.label + ', ' + R.fmtDate(lo.date) : '',
      type: l ? l.type : '',
      risk: c.sum.risk ? c.sum.risk.text : '',
      asOf: state.newest ? R.fmtDate(state.newest) : ''
    };
  }
  function makeCard() { var cv = $('#card'); C.draw(cv, cardData()); $('#cardwrap').hidden = false; return cv; }
  function cardBlob() { return new Promise(function (res) { makeCard().toBlob(function (b) { res(b); }, 'image/png'); }); }
  function fileName() { return 'before-you-go-' + (state.current.id.name || 'restaurant').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png'; }
  function download(blob) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  async function shareImage() {
    var blob = await cardBlob();
    var file = new File([blob], fileName(), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: shareText() + ' Make yours.' }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    download(blob);
    toast('Image saved. Paste the link in your group chat too.');
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareText()); toast('Link copied'); }
    catch (e) { window.prompt('Copy this link:', shareUrl()); }
  }

  // ---------- Wiring ----------
  $('#search').addEventListener('submit', function (e) { e.preventDefault(); runSearch($('#q').value, true); });
  $('#results').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-i]'); if (!b) return;
    var r = state.results[Number(b.getAttribute('data-i'))]; if (r) openRestaurant(keyFromRow(r), true);
  });
  $('#back').addEventListener('click', function () { if (history.state && history.state.key) history.back(); else showResults(); });
  $('#share').addEventListener('click', function () { makeCard(); $('#cardwrap').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  $('#card-share').addEventListener('click', shareImage);
  $('#card-save').addEventListener('click', async function () { download(await cardBlob()); });
  $('#copy').addEventListener('click', copyLink);

  function fromUrl() {
    var p = new URLSearchParams(location.search);
    var lic = p.get('license');
    if (lic) { openRestaurant({ license: lic }, false); return; }
    if (p.get('dba') && p.get('addr')) { openRestaurant({ dba: p.get('dba'), address: p.get('addr') }, false); return; }
    var q = p.get('q');
    if (q) {
      $('#q').value = q;
      if (state.resultsKey === q && state.results.length) showResults(); else runSearch(q, false);
      return;
    }
    $('#detail').hidden = true; $('#results-sec').hidden = true; setStatus(''); document.title = HOME_TITLE;
  }
  window.addEventListener('popstate', fromUrl);
  fromUrl();
})();
