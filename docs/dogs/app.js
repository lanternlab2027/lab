/* NYC Dog Name Report Card: app. Data loads from ./data (same origin). No tracking. */
(function () {
  'use strict';
  var S = window.DogStats, Card = window.DogCard;
  var $ = function (s) { return document.querySelector(s); };
  var esc = S.esc, fmt = S.fmt;
  var meta = null, shards = {}, current = null;

  function say(msg, isError) { var s = $('#status'); s.textContent = msg || ''; s.className = 'status' + (isError ? ' err' : ''); }

  // ---------- share links: ?ref= passthrough (URL only, nothing stored) ----------
  var APP_URL = 'https://lanternlab2027.github.io/lab/dogs/';
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
  function shareUrl() { return APP_URL + '?' + (current ? 'n=' + encodeURIComponent(current.n) + '&' : '') + 'ref=' + encodeURIComponent(REF); }
  function shareText() {
    if (!current) return 'How many NYC dogs share your dog\u2019s name? Free report card from the city\u2019s dog license data: ' + shareUrl();
    return Card.headline(current) + ' (#' + fmt(current.r) + '). Look up yours: ' + shareUrl();
  }

  // ---------- data ----------
  function getJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  function lookup(k) {
    if (!k) return Promise.resolve(null);
    var s = /^[a-z]/.test(k) ? k[0] : '0';
    if ((' ' + meta.shards + ' ').indexOf(' ' + s + ' ') < 0) return Promise.resolve(null);
    var p = shards[s] || (shards[s] = getJSON('data/s/' + s + '.json').catch(function (e) { delete shards[s]; throw e; }));
    return p.then(function (sh) { return sh[k] || null; });
  }

  // ---------- rendering ----------
  function bars(rows, total, label) {
    var max = rows.reduce(function (a, r) { return Math.max(a, r[1]); }, 1);
    return '<ul class="bars" aria-label="' + esc(label) + '">' + rows.map(function (r) {
      return '<li><span>' + r[0] + '</span><span class="bar" aria-hidden="true"><i style="width:' + (r[1] / max * 100).toFixed(1) + '%"></i></span><b>' + fmt(r[1]) + (r[2] ? ' <small>' + r[2] + '</small>' : '') + '</b></li>';
    }).join('') + '</ul>';
  }
  function reportHtml(rec) {
    var pk = S.peak(rec, meta), tr = S.trend(rec, meta), sh = S.shares(rec, meta);
    var boros = S.BORO_ORDER.filter(function (b) { return rec.bo[b]; }).map(function (b) { return [S.BORO_TITLE[b], rec.bo[b], '#' + rec.bor[b]]; });
    var hidden = rec.t - boros.reduce(function (a, r) { return a + r[1]; }, 0);
    var page = rec.p ? '<p class="small"><a href="n/' + S.key(rec.n) + '.html">Full page for ' + esc(rec.n) + ' &rarr;</a></p>' : '';
    var zipLine = rec.z1.length ? '<p class="why"><b>#1 dog name in ' + rec.z1.length + ' ZIP code' + (rec.z1.length > 1 ? 's' : '') + ':</b> ' + rec.z1.map(esc).join(', ') + '.</p>' : '';
    return '<section class="sheet" aria-label="Report card for ' + esc(rec.n) + '">' +
      '<div class="rc-head"><h2 class="rc-name">' + esc(rec.n) + '</h2><span class="stamp ' + tr.key + '">' + esc(tr.label) + '</span></div>' +
      '<p class="big">There are <b>' + fmt(rec.t) + '</b> licensed dogs named ' + esc(rec.n) + ' in NYC.</p>' +
      '<p>' + esc(S.summary(rec, meta)) + '</p>' +
      '<div class="grid">' +
      '<div class="stat"><b>#' + fmt(rec.r) + '</b><span>rank among ' + fmt(meta.distinctNames) + ' names</span></div>' +
      '<div class="stat"><b>' + fmt(rec.t) + '</b><span>dogs licensed ' + meta.firstIssue + '&ndash;' + meta.latest + '</span></div>' +
      '<div class="stat"><b>' + pk.year + '</b><span>peak year (' + pk.per10k.toFixed(1) + ' per 10k)</span></div>' +
      '<div class="stat"><b>' + (rec.b || '&mdash;') + '</b><span>typical birth year (median)</span></div>' +
      '</div>' +
      '<p class="why"><b>Trend: ' + esc(tr.label) + '.</b> ' + esc(tr.why) + '</p>' + zipLine +
      S.svgChart([{ label: rec.n, values: sh, color: '#1f4d3f' }], meta.years, { label: 'Dogs named ' + rec.n + ' per 10,000 licensed, by license year ' + meta.years[0] + '-' + meta.latest, mark: pk.year }) +
      '<p class="small" style="margin:2px 0 0">Dogs named ' + esc(rec.n) + ' per 10,000 dogs licensed each year. The filled dot marks the peak.</p>' +
      '<div class="cols"><div><h3>Top breeds</h3>' + (rec.br.length ? bars(rec.br.map(function (b) { return [esc(b[0]), b[1]]; }), rec.t, 'Top breeds') : '<p class="small">No breed has 5+ dogs with this name.</p>') + '<p class="small">Mixes count toward their main breed.</p></div>' +
      '<div><h3>By borough</h3>' + (boros.length ? bars(boros, rec.t, 'Dogs by borough') : '<p class="small">No borough has 5+ dogs with this name.</p>') + '<p class="small">Rank within each borough on the right.' + (hidden > 0 ? ' ' + fmt(hidden) + ' dogs are in boroughs with fewer than 5 or have no NYC ZIP.' : '') + '</p></div></div>' +
      (rec.z.length ? '<h3>Top ZIP codes</h3>' + bars(rec.z.map(function (z) { return [esc(z[0]), z[1]]; }), rec.t, 'Top ZIP codes') : '') +
      page + '</section>';
  }

  function setUrl(n) { try { var p = new URLSearchParams(location.search); p.set('n', n); history.replaceState(null, '', '?' + p.toString()); } catch (e) { /* ignore */ } }
  function run() {
    var raw = $('#q').value.trim(), k = S.key(raw);
    if (!k) { say('Type a dog name.', true); return; }
    if (!meta) { say('Still loading the data\u2026'); return; }
    say('Looking up ' + raw + '\u2026');
    lookup(k).then(function (rec) {
      if (!rec) { say('No match for \u201c' + raw + '\u201d. Only names shared by at least ' + meta.minLookup + ' licensed NYC dogs are listed, to protect owners\u2019 privacy. Check the spelling or try a variant.', true); return; }
      current = rec;
      var out = $('#result'); out.hidden = false; out.innerHTML = reportHtml(rec);
      setUrl(rec.n);
      document.title = rec.n + ' \u00b7 NYC Dog Name Report Card';
      say('');
      Card.draw($('#card'), rec, meta);
      $('#share').hidden = false;
      $('#pass-text').textContent = shareText();
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () { say('Couldn\u2019t load the name data. Check your connection and try again.', true); });
  }
  $('#search').addEventListener('submit', function (e) { e.preventDefault(); run(); });
  $('#quick').addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-name]'); if (!a) return;
    e.preventDefault(); $('#q').value = a.getAttribute('data-name'); run();
  });

  // ---------- share card ----------
  function fileName() { return 'nyc-dog-name-' + (current ? S.key(current.n) : 'card') + '.png'; }
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
      try { await navigator.share({ files: [f], title: 'NYC Dog Name Report Card', text: shareText() }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    download(b); $('#pass-msg').textContent = 'Saved the image. Paste the text above with it.';
  });
  $('#card-copy').addEventListener('click', async function () {
    $('#pass-msg').textContent = (await copyText(shareText())) ? 'Copied. Paste it with your card.' : 'Couldn\u2019t copy. Press and hold the text above to copy it.';
  });

  // ---------- boot ----------
  Promise.all([getJSON('data/meta.json'), getJSON('data/top.json')]).then(function (r) {
    meta = r[0];
    $('#suggest').innerHTML = r[1].map(function (t) { return '<option value="' + esc(t[0]) + '">'; }).join('');
    var set = function (sel, v) { Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) { el.textContent = v; }); };
    set('.dogs-n', fmt(meta.dogs)); set('.first', meta.firstIssue); set('.latest', meta.latest); set('.y0', meta.years[0]);
    var n = new URLSearchParams(location.search).get('n');
    if (n) { $('#q').value = n.slice(0, 30); run(); }
  }).catch(function () { say('Couldn\u2019t load the name data. Refresh to try again.', true); });
  $('#pass-text').textContent = shareText();

  Object.defineProperty(window, '__dogsState', { get: function () { return current; } });
})();
