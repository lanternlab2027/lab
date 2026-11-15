/* NYC Restaurant Report Card: UI. Depends on violations.js, grades.js, soda.js, card.js. */
(function () {
  'use strict';
  var G = window.EatsGrades, S = window.EatsSoda, V = window.EatsViolations, C = window.EatsCard;
  var SITE = 'https://lanternlab2027.github.io/lab/eats/';
  var $ = function (s) { return document.querySelector(s); };
  var state = { results: [], resultsKey: '', current: null };

  // ---------- ?ref= passthrough (URL only, nothing stored) ----------
  // Opened with ?ref=X -> links this visitor shares carry ref=share-X (then share2-X, share3-X...);
  // no ref -> ref=share. The incoming ref is also kept in the address bar as the page navigates.
  var IN_REF = '';
  try { IN_REF = (new URLSearchParams(location.search).get('ref') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40); } catch (e) { IN_REF = ''; }
  function nextRef() {
    var r = IN_REF;
    if (!r) return 'share';
    var m = /^share(\d*)(?:-(.+))?$/.exec(r);
    if (m) return 'share' + ((m[1] ? +m[1] : 1) + 1) + (m[2] ? '-' + m[2] : '');
    return 'share-' + r;
  }
  var REF = nextRef();
  function keepRef(qs) { return IN_REF ? qs + '&ref=' + encodeURIComponent(IN_REF) : qs; }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function setStatus(msg, err) { var el = $('#status'); el.textContent = msg || ''; el.className = 'status' + (err ? ' err' : ''); }
  var toastTimer;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2200); }

  function chip(grade, cls) {
    var g = grade || '';
    var word = { Z: 'Grade<br>Pending', P: 'Grade<br>Pending', N: 'Not yet<br>graded', '': 'No<br>grade' }[g];
    return '<span class="' + cls + ' g-' + esc(g) + (word ? ' sm' : '') + '" aria-label="' + esc(G.gradeLabel(g)) + '">' + (word || esc(g)) + '</span>';
  }

  // ---------- Search ----------
  async function runSearch(q, area, push) {
    q = (q || '').trim();
    if (!q) { setStatus('Type a restaurant name or a street address.', true); return; }
    if (area.zip && !/^\d{5}$/.test(area.zip)) { setStatus('ZIP should be 5 digits, or leave it blank.', true); return; }
    var plan = S.searchPlan(q, area);
    if (!plan.length) { setStatus('Type a restaurant name or a street address.', true); return; }
    $('#go').disabled = true;
    setStatus('Searching NYC Open Data…');
    try {
      var rows = [], mode = '';
      for (var i = 0; i < plan.length; i++) {
        rows = S.dedupe(await S.get(plan[i].params));
        mode = plan[i].mode;
        if (rows.length) break;
      }
      var grades = null;
      if (rows.length) {
        try { var gp = S.gradesParams(rows.map(function (r) { return r.camis; })); if (gp) grades = S.latestGrades(await S.get(gp)); } catch (e) { grades = null; /* chips are optional */ }
      }
      state.results = rows.map(function (r) {
        var gr = grades && grades[r.camis];
        // No grade card on record = Not Yet Graded (DOHMH). If the chip query failed, show no chip.
        return Object.assign({}, r, { cardGrade: gr ? gr.grade : (grades ? 'N' : null) });
      });
      state.resultsKey = JSON.stringify([q, area]);
      if (push) history.pushState({ q: q, area: area }, '', keepRef('?' + new URLSearchParams(Object.assign({ q: q }, area.boro ? { boro: area.boro } : {}, area.zip ? { zip: area.zip } : {})).toString()));
      renderResults(mode, q, area);
      showResults();
    } catch (e) {
      setStatus(e.message || String(e), true);
    } finally { $('#go').disabled = false; }
  }

  function renderResults(mode, q, area) {
    var list = state.results, ul = $('#results');
    var where = [area.boro, area.zip].filter(Boolean).join(' ');
    if (!list.length) {
      ul.innerHTML = '';
      $('#results-note').textContent = '';
      setStatus('No restaurants found for “' + q + '”' + (where ? ' in ' + where : '') + '. Try fewer words, a different spelling, or remove the borough or ZIP.', true);
      return;
    }
    setStatus(list.length + (list.length >= S.SEARCH_LIMIT ? '+' : '') + ' result' + (list.length === 1 ? '' : 's') + '. Pick one to see its report card.');
    $('#results-note').textContent = (mode === 'fulltext' ? 'No exact name match, so these are the closest full-text matches. ' : '') +
      (list.length >= S.SEARCH_LIMIT ? 'Showing the first ' + S.SEARCH_LIMIT + '. Add a borough or ZIP to narrow it down. ' : '') +
      'Sorted by most recent inspection.';
    ul.innerHTML = list.map(function (r, i) {
      var addr = [r.building, G.titleCase(r.street || '')].filter(Boolean).join(' ');
      var last = String(r.last || '').slice(0, 10);
      var lastTxt = last === G.NEVER ? 'Not inspected yet' : 'Last inspected ' + G.fmtDate(last);
      return '<li><button type="button" data-i="' + i + '"><b>' + esc(G.tidyName(r.dba || 'Unnamed')) + '</b>' + (r.cardGrade === null ? '' : chip(r.cardGrade, 'chip')) +
        '<small>' + esc([addr, r.boro && r.boro !== '0' ? r.boro : '', r.zipcode].filter(Boolean).join(', ')) + '</small>' +
        '<small>' + esc([r.cuisine_description, lastTxt].filter(Boolean).join(' · ')) + '</small></button></li>';
    }).join('');
  }

  function showResults() {
    $('#detail').hidden = true;
    $('#results-sec').hidden = !state.results.length;
    document.title = 'NYC Restaurant Grades Lookup: Health Inspection Report Card (Free)';
  }

  // ---------- Detail ----------
  async function openRestaurant(camis, push) {
    if (!S.validCamis(camis)) { setStatus('That restaurant ID doesn’t look right.', true); return; }
    setStatus('Loading inspection history…');
    try {
      var rows = await S.get(S.detailParams(camis));
      if (!rows.length) { setStatus('No records found for that restaurant. It may have closed and been removed from the city’s data.', true); return; }
      if (push) history.pushState({ camis: camis }, '', keepRef('?camis=' + camis));
      renderDetail(rows);
      setStatus('');
      $('#results-sec').hidden = true;
      $('#detail').hidden = false;
      $('#back').hidden = !state.results.length;
      $('#rc-name').setAttribute('tabindex', '-1');
      $('#rc-name').focus({ preventScroll: true });
      $('#detail').scrollIntoView({ block: 'start' });
    } catch (e) { setStatus(e.message || String(e), true); }
  }

  function renderDetail(rows) {
    var id = G.identity(rows);
    var ins = G.groupInspections(rows);
    var cur = G.currentGrade(ins);
    var asOf = G.dataAsOf(rows);
    var latest = cur.latest;
    state.current = { id: id, ins: ins, cur: cur, asOf: asOf };
    document.title = id.name + ' health inspection grade | NYC Restaurant Report Card';

    var g = cur.grade || '';
    var badge = $('#badge');
    badge.className = 'badge g-' + g + (/^[ABC]$/.test(g) ? '' : ' word');
    badge.innerHTML = /^[ABC]$/.test(g) ? g : (g === 'Z' || g === 'P' ? 'Grade<br>Pending' : (g === 'N' ? 'Not yet<br>graded' : 'No<br>grade'));
    $('#rc-name').textContent = id.name;
    $('#rc-meta').textContent = [id.address, id.boro, id.zip].filter(Boolean).join(', ') + (id.cuisine ? ' · ' + id.cuisine : '');
    $('#glabel').textContent = G.gradeLabel(g) + (/^[ZPN]$/.test(g) ? ' (code ' + g + ')' : '');
    $('#glabel').className = 'glabel g-' + g;
    $('#gexplain').textContent = G.gradeExplainer(g);

    var facts = [];
    if (cur.gradedInspection) facts.push(['Grade issued', G.fmtDate(cur.gradeDate)]);
    if (cur.gradedInspection && cur.gradedInspection.score !== null) facts.push(['Score on that inspection', cur.gradedInspection.score + ' points']);
    if (latest) facts.push(['Most recent inspection', G.fmtDate(latest.date)]);
    if (latest && latest !== cur.gradedInspection && latest.score !== null) facts.push(['Most recent score', latest.score + ' points (' + (latest.type || 'type not listed') + ')']);
    facts.push(['Data as of', asOf ? G.fmtDate(asOf) : 'unknown']);
    $('#facts').innerHTML = facts.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('');
    $('#notes').innerHTML = cur.notes.map(function (n) { return '<p class="note">' + esc(n.text) + '</p>'; }).join('');

    $('#chart').innerHTML = chartSvg(G.timeline(ins));
    $('#asof').textContent = 'Most recent first. Official data from NYC DOHMH via NYC Open Data, as of ' + (asOf ? G.fmtDate(asOf, true) : 'unknown') + '. The open data covers up to three years before the latest inspection.';
    $('#history').innerHTML = ins.filter(function (i) { return i.inspected; }).map(function (i, k) { return inspectionHtml(i, k === 0); }).join('') ||
      '<p class="small">No inspections on record yet.</p>';

    $('#cardwrap').hidden = true;
    var alertBox = $('#alert');
    if (alertBox.getAttribute('data-disabled') !== '1') {
      alertBox.hidden = false;
      $('#alert-name').textContent = id.name;
      $('#signup-camis').value = id.camis;
    }
  }

  function inspectionHtml(i, open) {
    var gtxt = i.grade && i.grade !== 'N' ? G.gradeLabel(i.grade) : (i.grade === 'N' ? 'Not yet graded' : 'Not graded');
    var crit = i.critical ? ' · ' + i.critical + ' critical' : '';
    var vcount = i.violations.length;
    var sum = '<summary><b>' + esc(G.fmtDate(i.date)) + '</b>' +
      '<span class="sc g-' + esc(i.band || '') + '">' + (i.score === null ? '—' : esc(i.score)) + '<span>' + (i.score === null ? 'no score' : 'points') + '</span></span>' +
      '<small>' + esc(i.type || 'Inspection') + '</small>' +
      '<small>' + esc(gtxt) + ' · ' + vcount + ' violation' + (vcount === 1 ? '' : 's') + crit + '</small></summary>';
    var body = '<div>' + (i.action ? '<p class="action">' + esc(i.action) + '</p>' : '');
    if (vcount) {
      body += '<ul class="viol">' + i.violations.map(function (v) {
        var cls = v.flag === 'Critical' ? 'crit' : (v.flag === 'Not Critical' ? 'gen' : 'na');
        var plain = V.plain(v.code);
        return '<li><div class="vhead">' + (v.code ? '<span class="code">' + esc(v.code) + '</span>' : '') +
          (v.flag ? '<span class="flag ' + cls + '">' + esc(G.flagLabel(v.flag)) + '</span>' : '') + '</div>' +
          (plain ? '<p class="plain">' + esc(plain) + '</p>' : '') +
          '<p class="official"><span class="sr">Official text: </span>' + (plain ? 'Official text: ' : '') + esc(v.text || '(no description in the data)') + '</p></li>';
      }).join('') + '</ul>';
    }
    body += '</div>';
    return '<details class="ins"' + (open ? ' open' : '') + '>' + sum + body + '</details>';
  }

  function chartSvg(pts) {
    if (!pts.length) return '<p class="small">No scored inspections to chart.</p>';
    var W = 760, H = 260, L = 40, R = 16, T = 14, B = 34;
    var maxS = Math.max(40, Math.ceil(Math.max.apply(null, pts.map(function (p) { return p.score; })) / 10) * 10);
    var t = pts.map(function (p) { return Date.parse(p.date + 'T12:00:00Z'); });
    var t0 = Math.min.apply(null, t), t1 = Math.max.apply(null, t);
    if (t1 === t0) { t0 -= 86400000 * 30; t1 += 86400000 * 30; }
    var x = function (v) { return L + (W - L - R) * (v - t0) / (t1 - t0); };
    var y = function (s) { return T + (H - T - B) * (1 - s / maxS); };
    var css = function (g) { return 'var(--' + ({ A: 'A', B: 'B', C: 'C' }[g] || 'N') + ')'; };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Inspection scores over time, ' + pts.length + ' scored inspections from ' + esc(G.fmtDate(pts[0].date)) + ' to ' + esc(G.fmtDate(pts[pts.length - 1].date)) + '. Lower is better.">';
    // Bands
    [[0, 13.5, 'A'], [13.5, 27.5, 'B'], [27.5, maxS, 'C']].forEach(function (b) {
      s += '<rect x="' + L + '" y="' + y(b[1]) + '" width="' + (W - L - R) + '" height="' + (y(b[0]) - y(b[1])) + '" fill="' + css(b[2]) + '" opacity=".09"/>';
      s += '<text x="' + (W - R - 4) + '" y="' + (y(b[1]) + 16) + '" text-anchor="end" font-size="13" font-weight="700" style="fill:' + css(b[2]) + '">' + b[2] + '</text>';
    });
    [0, 13, 27].concat(maxS > 40 ? [maxS] : [40]).forEach(function (v) {
      s += '<text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="12">' + v + '</text>';
    });
    // Year ticks
    var y0 = new Date(t0).getUTCFullYear(), y1 = new Date(t1).getUTCFullYear();
    for (var yr = y0; yr <= y1 + 1; yr++) {
      var tt = Date.UTC(yr, 0, 1);
      if (tt < t0 || tt > t1) continue;
      s += '<line x1="' + x(tt) + '" x2="' + x(tt) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--line)"/>';
      s += '<text x="' + x(tt) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="12">' + yr + '</text>';
    }
    s += '<text x="' + L + '" y="' + (H - 12) + '" font-size="12">' + esc(G.fmtDate(pts[0].date)) + '</text>';
    if (pts.length > 1) s += '<text x="' + (W - R) + '" y="' + (H - 12) + '" text-anchor="end" font-size="12">' + esc(G.fmtDate(pts[pts.length - 1].date)) + '</text>';
    // Line + dots
    s += '<polyline fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-opacity=".6" points="' + pts.map(function (p, i) { return x(t[i]) + ',' + y(Math.min(p.score, maxS)); }).join(' ') + '"/>';
    pts.forEach(function (p, i) {
      var graded = /^[ABCZP]$/.test(p.grade || '');
      var c = css(p.band);
      s += '<circle cx="' + x(t[i]) + '" cy="' + y(Math.min(p.score, maxS)) + '" r="6.5" stroke="' + c + '" stroke-width="2.5" fill="' + (graded ? c : 'var(--sheet)') + '"><title>' + esc(G.fmtDate(p.date) + ': ' + p.score + ' points, ' + (p.type || '') + (graded ? ', ' + G.gradeLabel(p.grade) : ', not graded')) + '</title></circle>';
    });
    s += '</svg>';
    s += '<p class="legend"><span><i style="background:var(--A)"></i>A range</span><span><i style="background:var(--B)"></i>B range</span><span><i style="background:var(--C)"></i>C range</span><span><i style="border:2px solid var(--muted)"></i>hollow = not graded</span></p>';
    return s;
  }

  // ---------- Sharing ----------
  function shareUrl() { return SITE + '?camis=' + (state.current ? state.current.id.camis : '') + '&ref=' + encodeURIComponent(REF); }
  function shareText() {
    var c = state.current; if (!c) return '';
    var when = c.cur.gradedInspection ? ' (graded ' + G.fmtDate(c.cur.gradeDate) + ')' : '';
    return G.headline(c.id.name, c.cur.grade) + when + '. Full inspection history: ' + shareUrl();
  }
  function cardData() {
    var c = state.current;
    return {
      name: c.id.name, address: c.id.address, boro: c.id.boro, grade: c.cur.grade,
      gradeDate: c.cur.gradedInspection ? G.fmtDate(c.cur.gradeDate) : '',
      lastDate: c.cur.latest ? G.fmtDate(c.cur.latest.date) : 'Not inspected yet',
      score: c.cur.gradedInspection ? c.cur.gradedInspection.score : (c.cur.latest ? c.cur.latest.score : null),
      asOf: c.asOf ? G.fmtDate(c.asOf) : ''
    };
  }
  function makeCard() {
    var cv = $('#card');
    C.draw(cv, cardData());
    $('#cardwrap').hidden = false;
    return cv;
  }
  function cardBlob() { return new Promise(function (res) { makeCard().toBlob(function (b) { res(b); }, 'image/png'); }); }
  function fileName() { return 'report-card-' + (state.current.id.name || 'restaurant').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png'; }
  function download(blob) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  async function shareImage() {
    var blob = await cardBlob();
    var file = new File([blob], fileName(), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: shareText() }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    download(blob);
    toast('Image saved. Paste the link in your group chat too.');
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareText()); toast('Link copied'); }
    catch (e) { window.prompt('Copy this link:', shareUrl()); }
  }

  // ---------- Wiring ----------
  function area() { return { boro: $('#boro').value, zip: $('#zip').value.trim() }; }
  $('#search').addEventListener('submit', function (e) { e.preventDefault(); runSearch($('#q').value, area(), true); });
  $('#results').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-i]'); if (!b) return;
    var r = state.results[Number(b.getAttribute('data-i'))]; if (r) openRestaurant(r.camis, true);
  });
  $('#back').addEventListener('click', function () { if (history.state && history.state.camis) history.back(); else showResults(); });
  $('#share').addEventListener('click', function () { makeCard(); $('#cardwrap').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  $('#card-share').addEventListener('click', shareImage);
  $('#card-save').addEventListener('click', async function () { download(await cardBlob()); });
  $('#copy').addEventListener('click', copyLink);

  function fromUrl() {
    var p = new URLSearchParams(location.search);
    var camis = p.get('camis');
    if (camis) { openRestaurant(camis, false); return; }
    var q = p.get('q');
    if (q) {
      $('#q').value = q; $('#boro').value = p.get('boro') || ''; $('#zip').value = p.get('zip') || '';
      var key = JSON.stringify([q, area()]);
      if (state.resultsKey === key && state.results.length) showResults();
      else runSearch(q, area(), false);
      return;
    }
    $('#detail').hidden = true; $('#results-sec').hidden = true; setStatus('');
  }
  window.addEventListener('popstate', fromUrl);
  fromUrl();
})();
