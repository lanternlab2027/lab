/* Snow Day Odds: network. ZIP lookup (same-origin static files), city geocoding (Open-Meteo, no key), NWS API.
   We do not set a User-Agent: browsers won't let pages set it, and NWS says the browser default is fine for
   client-side apps (weather-gov/api discussion #312). We only set Accept, which is CORS-safelisted (no preflight). */
(function () {
  'use strict';
  var NWS = 'https://api.weather.gov';
  var GEO = 'https://geocoding-api.open-meteo.com/v1/search';
  var STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico' };

  function UserError(msg) { var e = new Error(msg); e.user = true; return e; }

  function getJSON(url, opts) {
    opts = opts || {};
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, opts.timeout || 15000) : null;
    return fetch(url, { headers: opts.accept ? { Accept: opts.accept } : {}, signal: ctl ? ctl.signal : undefined, credentials: 'omit', referrerPolicy: 'no-referrer' })
      .then(function (r) {
        if (timer) clearTimeout(timer);
        if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
        return r.json();
      }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }
  // NWS sometimes answers 500/503 on gridpoints; retry once after a short pause (their docs: retry after ~5 s).
  function nws(path, tries) {
    tries = tries == null ? 2 : tries;
    return getJSON(path.indexOf('http') === 0 ? path : NWS + path, { accept: 'application/geo+json' }).catch(function (e) {
      if (tries > 1 && (!e.status || e.status >= 500 || e.status === 429)) {
        return new Promise(function (res) { setTimeout(res, 1500); }).then(function () { return nws(path, tries - 1); });
      }
      throw e;
    });
  }

  // ---------- location ----------
  // ZIP shards live next to this script (docs/snow/z/), so town pages in subfolders find them too.
  var ZBASE = 'z/';
  try { var me = document.currentScript; if (me && me.src) ZBASE = new URL('z/', me.src).href; } catch (e) { /* keep relative */ }
  var shardCache = {};
  function zipToPoint(zip) {
    if (!/^\d{5}$/.test(zip)) return Promise.reject(UserError('Enter a 5-digit ZIP code.'));
    var k = zip.slice(0, 2);
    var p = shardCache[k] || (shardCache[k] = getJSON(ZBASE + k + '.json').catch(function (e) { delete shardCache[k]; if (e.status === 404) return {}; throw e; }));
    return p.then(function (sh) {
      var c = sh[zip.slice(2)];
      if (!c) throw UserError('We couldn\u2019t find ZIP ' + zip + '. Try a nearby ZIP or your town name.');
      return { lat: c[0], lon: c[1], zip: zip };
    });
  }
  // "Buffalo, NY" / "Buffalo NY" / "Buffalo, New York" / "Buffalo"
  function parseCity(q) {
    q = String(q || '').replace(/\s+/g, ' ').trim();
    var m = /^(.*?)[,\s]+([A-Za-z]{2}|[A-Za-z ]{4,})$/.exec(q), st = null, name = q;
    if (m) {
      var tail = m[2].trim(), up = tail.toUpperCase();
      if (STATES[up]) { st = STATES[up]; name = m[1]; }
      else { for (var k in STATES) if (STATES[k].toLowerCase() === tail.toLowerCase()) { st = STATES[k]; name = m[1]; break; } }
    }
    return { name: name.replace(/,$/, '').trim(), state: st };
  }
  function cityToPoint(q) {
    var c = parseCity(q);
    if (c.name.length < 2) return Promise.reject(UserError('Enter a ZIP code or a town name, like \u201cBuffalo, NY\u201d.'));
    return getJSON(GEO + '?name=' + encodeURIComponent(c.name) + '&count=20&language=en&format=json&countryCode=US').then(function (j) {
      var rs = (j.results || []).filter(function (r) { return r.country_code === 'US' && (!c.state || r.admin1 === c.state); });
      if (!rs.length) throw UserError('We couldn\u2019t find \u201c' + q + '\u201d. Try adding the state (\u201cSpringfield, IL\u201d) or use a ZIP code.');
      var r = rs[0]; // Open-Meteo sorts by relevance/population
      var abbr = ''; for (var k in STATES) if (STATES[k] === r.admin1) abbr = k;
      return { lat: r.latitude, lon: r.longitude, name: r.name + (abbr ? ', ' + abbr : r.admin1 ? ', ' + r.admin1 : '') };
    });
  }

  // ---------- NWS ----------
  function fix4(x) { return (Math.round(x * 1e4) / 1e4).toString(); } // /points redirects for >4 decimals
  function forecast(lat, lon) {
    var pt = fix4(lat) + ',' + fix4(lon);
    return nws('/points/' + pt).catch(function (e) {
      if (e.status === 404) throw UserError('The National Weather Service doesn\u2019t forecast for that spot. It covers the U.S. and its territories.');
      throw e;
    }).then(function (p) {
      var P = p.properties || {};
      if (!P.forecastGridData) throw UserError('No forecast grid for that location yet. Try a nearby ZIP.');
      var rel = (P.relativeLocation && P.relativeLocation.properties) || {};
      return Promise.all([
        nws(P.forecastGridData),
        nws('/alerts/active?point=' + pt).catch(function () { return { features: [], failed: true }; })
      ]).then(function (res) {
        return { grid: res[0], alerts: res[1], timeZone: P.timeZone || 'America/New_York', place: rel.city ? rel.city + ', ' + rel.state : '', office: P.gridId || '' };
      });
    });
  }

  window.SnowNWS = { zipToPoint: zipToPoint, cityToPoint: cityToPoint, parseCity: parseCity, forecast: forecast, STATES: STATES };
})();
