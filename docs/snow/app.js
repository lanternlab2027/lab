/* Snow Day Odds: UI. No tracking. Location is sent only to the NWS API (and Open-Meteo for typed town names). */
(function () {
  'use strict';
  var M = window.SnowModel, N = window.SnowNWS, Card = window.SnowCard;
  var $ = function (s) { return document.querySelector(s); };
  var APP_URL = 'https://lanternlab2027.github.io/lab/snow/';
  var state = { loc: null, data: null, win: null, inp: null, res: null, regionChosen: false, busy: false };
  // Town landing pages (docs/snow/t/) set data-town-zip / -region / -name on the form; the page loads that ZIP on open.
  var TOWN = (function () {
    var f = document.getElementById('find'), d = f && f.dataset;
    return d && /^\d{5}$/.test(d.townZip || '') ? { zip: d.townZip, region: d.townRegion === 'rare' ? 'rare' : 'used', name: d.townName || '' } : null;
  })();

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(msg, isErr) { var s = $('#status'); s.textContent = msg || ''; s.className = 'status' + (isErr ? ' err' : ''); }
  var toastT; function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2200); }
  function store(k, v) { try { if (v == null) localStorage.removeItem('snow.' + k); else localStorage.setItem('snow.' + k, v); } catch (e) { /* private mode */ } }
  function load(k) { try { return localStorage.getItem('snow.' + k); } catch (e) { return null; } }

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
  function region() { var r = document.querySelector('input[name=region]:checked'); return r ? r.value : 'used'; }
  function setRegion(v) { var r = document.querySelector('input[name=region][value="' + v + '"]'); if (r) r.checked = true; }
  function shareUrl(toolOnly) {
    var u = APP_URL + '?';
    if (!toolOnly && state.loc) {
      if (state.loc.zip) u += 'zip=' + state.loc.zip + '&';
      else if (state.loc.name) u += 'q=' + encodeURIComponent(state.loc.name) + '&';
      u += 'r=' + region() + '&';
    }
    return u + 'ref=' + encodeURIComponent(REF);
  }
  function dayName() { var d = state.win.date; return new Date(Date.UTC(d.y, d.mo - 1, d.d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }); }
  function dayShort() { var d = state.win.date; return new Date(Date.UTC(d.y, d.mo - 1, d.d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }); }
  function placeName() { return (state.loc && state.loc.name) || state.data.place || 'Your area'; }
  function shareText() {
    if (!state.res) return 'Snow day odds for your ZIP, from National Weather Service data. Make yours: ' + shareUrl(true);
    return 'Snow day odds for ' + placeName() + ' (' + dayShort() + '): ' + state.res.chance + '%. ' + state.res.reasons[0] + '. Just for fun. Make yours: ' + shareUrl();
  }

  // ---------- render ----------
  function deg(f) { return f == null ? 'n/a' : Math.round(f) + '\u00b0F'; }
  function inches(x) { return x < 0.05 ? '0 in.' : (Math.round(x * 10) / 10) + ' in.'; }
  function render() {
    var res = state.res = M.odds(state.inp, region());
    var inp = state.inp, d = state.win.date;
    $('#result').hidden = false;
    $('#place').textContent = placeName();
    $('#when').textContent = (state.win.thisMorning ? 'This morning, ' : 'Tomorrow, ') + dayName();
    $('#pct').innerHTML = res.chance + '<small>%</small>';
    $('#arc').setAttribute('stroke-dasharray', (395.8 * res.chance / 100).toFixed(1) + ' 527.8');
    $('#arc').setAttribute('stroke', res.chance >= 50 ? 'var(--hot)' : 'var(--ice)');
    $('#verdict').textContent = res.label;
    $('#verdict').className = 'verdict' + (res.chance >= 50 ? ' hi' : '');
    $('#sr-chance').textContent = res.chance + ' percent snow-day chance.';
    $('#reasons').innerHTML = res.reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('');
    var notes = [];
    if (d.dow === 0 || d.dow === 6) notes.push((d.dow === 6 ? 'Saturday' : 'Sunday') + ' is usually not a school day anyway. Here are the odds for fun.');
    if (state.data.alerts && state.data.alerts.failed) notes.push('We couldn\u2019t load NWS alerts just now, so alerts aren\u2019t counted. Try again in a minute.');
    if (state.guessedRegion) notes.push('We guessed \u201c' + M.REGION[region()].label + '\u201d from how far north you are. Change it above if that\u2019s wrong.');
    $('#notes').innerHTML = notes.map(function (n) { return '<p class="note">' + esc(n) + '</p>'; }).join('');
    var facts = [
      ['Snow, 6pm to 8am', inches(inp.snowIn)], ['Of that, 5am to 8am', inches(inp.snowLateIn)], ['Ice', inp.iceIn < 0.01 ? 'none' : (Math.round(inp.iceIn * 100) / 100) + ' in.'],
      ['Overnight low', deg(inp.lowF)], ['Lowest wind chill', deg(inp.windChillF)], ['Chance of precipitation', inp.popMax == null ? 'n/a' : inp.popMax + '%'],
      ['Winter alerts', inp.alerts.length ? inp.alerts.join(', ') : 'none']
    ];
    $('#facts').innerHTML = facts.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('');
    if (!$('#cardwrap').hidden) makeCard();
    var z = $('#signup-zip'); if (z && state.loc.zip && !z.value) z.value = state.loc.zip;
  }
  function makeCard() {
    var c = $('#card');
    Card.draw(c, { place: placeName(), dateText: (state.win.thisMorning ? 'This morning, ' : 'Tomorrow, ') + dayName(), chance: state.res.chance, label: state.res.label, reasons: state.res.reasons });
    $('#cardwrap').hidden = false;
    return c;
  }

  // ---------- flow ----------
  function setBusy(b) { state.busy = b; $('#go').disabled = b; $('#geo').disabled = b; }
  function run(locPromise, label, auto) {
    if (state.busy) return;
    setBusy(true); say(label || 'Checking the forecast\u2026');
    locPromise.then(function (loc) {
      state.loc = loc;
      return N.forecast(loc.lat, loc.lon).then(function (data) {
        state.data = data;
        if (!loc.name && !loc.zip) loc.name = data.place; // geolocation: show nearest town, never coordinates
        if (loc.zip && TOWN && TOWN.name && loc.zip === TOWN.zip) loc.name = TOWN.name + ' ' + loc.zip;
        else if (loc.zip && data.place) loc.name = data.place + ' ' + loc.zip;
        state.guessedRegion = false;
        if (!state.regionChosen) { setRegion(loc.lat < 36.5 ? 'rare' : 'used'); state.guessedRegion = true; }
        state.win = M.targetWindow(Date.now(), data.timeZone);
        state.inp = M.extract(data.grid, data.alerts, state.win);
        render();
        say('');
        if (auto) return; // town page opened: don't remember the ZIP, rewrite the URL or scroll
        if (loc.zip) store('q', loc.zip); else if (loc.typed) store('q', loc.typed);
        if (!TOWN) try {
          var u = new URL(location.href); u.search = '';
          if (loc.zip) u.searchParams.set('zip', loc.zip); else if (loc.typed) u.searchParams.set('q', loc.typed);
          var ref = new URLSearchParams(location.search).get('ref'); if (ref) u.searchParams.set('ref', ref);
          history.replaceState(null, '', u.toString());
        } catch (e) { /* ignore */ }
        $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }).catch(function (e) {
      say(e && e.user ? e.message : 'Couldn\u2019t reach the National Weather Service. Please try again in a minute.', true);
    }).then(function () { setBusy(false); });
  }
  function lookup(q) {
    q = String(q || '').trim();
    if (/^\d{5}(-\d{4})?$/.test(q)) return N.zipToPoint(q.slice(0, 5));
    return N.cityToPoint(q).then(function (r) { r.typed = r.name; return r; });
  }

  $('#find').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('#q').value.trim();
    if (!q) { say('Enter a ZIP code or a town name.', true); $('#q').focus(); return; }
    run(lookup(q));
  });
  $('#geo').addEventListener('click', function () {
    if (!navigator.geolocation) { say('Your browser can\u2019t share its location. Enter a ZIP instead.', true); return; }
    say('Asking your browser for your location\u2026');
    navigator.geolocation.getCurrentPosition(function (pos) {
      run(Promise.resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }));
    }, function () { say('Location wasn\u2019t shared. Enter a ZIP or town instead.', true); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name=region]'), function (r) {
    r.addEventListener('change', function () {
      state.regionChosen = true; state.guessedRegion = false; store('region', region());
      if (state.inp) render();
    });
  });

  // share
  function cardBlob() { return new Promise(function (res) { makeCard().toBlob(function (b) { res(b); }, 'image/png'); }); }
  function fileName() { return 'snow-day-odds-' + placeName().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + state.win.isoDate + '.png'; }
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
  }
  async function copyLink(text) {
    try { await navigator.clipboard.writeText(text); toast('Link copied'); }
    catch (e) { window.prompt('Copy this link:', text); }
  }
  $('#share').addEventListener('click', function () { makeCard(); $('#cardwrap').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  $('#card-share').addEventListener('click', shareImage);
  $('#card-save').addEventListener('click', async function () { download(await cardBlob()); });
  $('#copy').addEventListener('click', function () { copyLink(shareText()); });
  $('#share-tool').addEventListener('click', async function () {
    var t = 'Snow day odds for your ZIP, from National Weather Service data: ' + shareUrl(true);
    if (navigator.share) { try { await navigator.share({ text: t }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    copyLink(t);
  });

  // ---------- start ----------
  var params = new URLSearchParams(location.search);
  var r0 = params.get('r') || (TOWN ? TOWN.region : load('region'));
  if (r0 === 'used' || r0 === 'rare') { setRegion(r0); state.regionChosen = true; }
  var q0 = (params.get('zip') || params.get('q') || '').slice(0, 80);
  if (q0) { $('#q').value = q0; run(lookup(q0)); }
  else if (TOWN) { $('#q').value = TOWN.zip; run(lookup(TOWN.zip), 'Loading today\u2019s odds for ' + (TOWN.name || TOWN.zip) + '\u2026', true); }
  else { var last = load('q'); if (last) $('#q').value = last; }
})();
