/* Weather Wrapped: network. ZIP lookup (same-origin static shards shared with Snow Day Odds, docs/snow/z/),
 * place names and towns (Open-Meteo geocoding, no key), and the year's daily data (Open-Meteo Historical
 * Weather API, archive-api.open-meteo.com, no key, free for non-commercial use). No cookies, no referrer. */
(function () {
  'use strict';
  var GEO = 'https://geocoding-api.open-meteo.com/v1/search';
  var ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
  var STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico' };

  function UserError(msg) { var e = new Error(msg); e.user = true; return e; }
  function getJSON(url, timeout) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, timeout || 20000) : null;
    return fetch(url, { signal: ctl ? ctl.signal : undefined, credentials: 'omit', referrerPolicy: 'no-referrer' }).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && j.reason) || 'HTTP ' + r.status); e.status = r.status; e.body = j; throw e; }
        return j;
      });
    }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }
  function abbrOf(admin1) { for (var k in STATES) if (STATES[k] === admin1) return k; return ''; }
  function nameOf(r) {
    if (r.country_code === 'US') { var a = abbrOf(r.admin1); return r.name + (a ? ', ' + a : r.admin1 ? ', ' + r.admin1 : ''); }
    return r.name + (r.country ? ', ' + r.country : r.admin1 ? ', ' + r.admin1 : '');
  }

  // ---------- ZIP (U.S. Census ZCTA internal points, shards shared with Snow Day Odds) ----------
  var ZBASE = '../snow/z/';
  try { var me = document.currentScript; if (me && me.src) ZBASE = new URL('../snow/z/', me.src).href; } catch (e) { /* keep relative */ }
  var shardCache = {};
  function zipToPoint(zip) {
    if (!/^\d{5}$/.test(zip)) return Promise.reject(UserError('Enter a 5-digit ZIP code.'));
    var k = zip.slice(0, 2);
    var p = shardCache[k] || (shardCache[k] = getJSON(ZBASE + k + '.json').catch(function (e) { delete shardCache[k]; if (e.status === 404) return {}; throw e; }));
    return p.then(function (sh) {
      var c = sh[zip.slice(2)];
      if (!c) throw UserError('We couldn\u2019t find ZIP ' + zip + '. Try a nearby ZIP or your city name.');
      var loc = { lat: c[0], lon: c[1], zip: zip, name: 'ZIP ' + zip, country: 'US' };
      // Name the ZIP (Open-Meteo geocoding accepts postal codes). Optional: a failure keeps "ZIP 14201".
      return getJSON(GEO + '?name=' + zip + '&count=5&language=en&format=json&countryCode=US', 8000).then(function (j) {
        var r = (j && j.results || []).filter(function (x) { return x.country_code === 'US'; })[0];
        if (r) loc.name = nameOf(r);
        return loc;
      }, function () { return loc; });
    });
  }

  // "Buffalo, NY" / "Buffalo NY" / "Buffalo, New York" / "London" / "Paris, France"
  function parseCity(q) {
    q = String(q || '').replace(/\s+/g, ' ').trim();
    var m = /^(.*?)[,\s]+([A-Za-z]{2}|[A-Za-z ]{4,})$/.exec(q), st = null, name = q, rest = '';
    if (m) {
      var tail = m[2].trim(), up = tail.toUpperCase();
      if (STATES[up]) { st = STATES[up]; name = m[1]; }
      else { for (var k in STATES) if (STATES[k].toLowerCase() === tail.toLowerCase()) { st = STATES[k]; name = m[1]; break; } }
    }
    if (!st && q.indexOf(',') > 0) { name = q.slice(0, q.indexOf(',')); rest = q.slice(q.indexOf(',') + 1).trim().toLowerCase(); }
    return { name: name.replace(/,$/, '').trim(), state: st, rest: rest };
  }
  function cityToPoint(q) {
    var c = parseCity(q);
    if (c.name.length < 2) return Promise.reject(UserError('Enter a ZIP code or a city, like \u201cBuffalo, NY\u201d.'));
    return getJSON(GEO + '?name=' + encodeURIComponent(c.name) + '&count=20&language=en&format=json' + (c.state ? '&countryCode=US' : '')).then(function (j) {
      var rs = (j && j.results || []).filter(function (r) {
        if (c.state) return r.country_code === 'US' && r.admin1 === c.state;
        if (c.rest) return [r.country, r.admin1, r.country_code].some(function (v) { return v && String(v).toLowerCase() === c.rest; });
        return true;
      });
      if (!rs.length) throw UserError('We couldn\u2019t find \u201c' + q + '\u201d. Try adding the state (\u201cSpringfield, IL\u201d) or use a ZIP code.');
      var r = rs[0]; // Open-Meteo sorts by relevance and population
      return { lat: r.latitude, lon: r.longitude, name: nameOf(r), country: r.country_code || '', typed: q };
    });
  }

  // ---------- archive ----------
  function fix(x) { return (Math.round(x * 1e4) / 1e4).toString(); }
  function archiveUrl(lat, lon, start, end, vars) {
    return ARCHIVE + '?latitude=' + fix(lat) + '&longitude=' + fix(lon) + '&start_date=' + start + '&end_date=' + end +
      '&daily=' + vars.join(',') + '&timezone=auto';
  }
  function archive(lat, lon, start, end, vars) {
    return getJSON(archiveUrl(lat, lon, start, end, vars), 30000).catch(function (e) {
      if (e.status === 429) throw UserError('Open-Meteo says it\u2019s getting too many requests right now. Please try again in a minute.');
      if (e.status === 400) throw UserError('Open-Meteo couldn\u2019t answer for that place and dates' + (e.body && e.body.reason ? ' (' + e.body.reason + ')' : '') + '.');
      throw e;
    });
  }

  window.WeatherNet = { zipToPoint: zipToPoint, cityToPoint: cityToPoint, parseCity: parseCity, archive: archive, archiveUrl: archiveUrl, STATES: STATES };
})();
