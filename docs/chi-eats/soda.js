/* Socrata (City of Chicago Data Portal) queries for "Food Inspections" (dataset 4ijn-s7e5), called from the browser.
   No app token: anonymous requests are throttled, so queries are kept small and always carry $limit.
   License # (field license_) identifies one establishment at one location. Rows with a missing or 0 license
   fall back to an exact DBA name + address match. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChiSoda = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var BASE = 'https://data.cityofchicago.org/resource/4ijn-s7e5.json';
  var SEARCH_LIMIT = 40;
  var DETAIL_LIMIT = 1000;
  var SKIP_STREET = { N: 1, S: 1, E: 1, W: 1, NORTH: 1, SOUTH: 1, EAST: 1, WEST: 1, ST: 1, STREET: 1, AVE: 1, AV: 1, AVENUE: 1, RD: 1, ROAD: 1, BLVD: 1, BOULEVARD: 1, PL: 1, PLACE: 1, PKWY: 1, PARKWAY: 1, DR: 1, DRIVE: 1, LN: 1, LANE: 1, CT: 1, COURT: 1, HWY: 1, THE: 1, OF: 1, CHICAGO: 1, IL: 1 };
  // license_ is compared as text. If the portal ever types it as a number, the app flips this on a 400 and retries.
  var opts = { licenseNumeric: false };

  function clean(s) { return String(s || '').toUpperCase().replace(/[\u2018\u2019`]/g, "'").replace(/[%_\\"]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function quote(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

  /** Name token -> clause over DBA and AKA. Apostrophes become wildcards so "lous" finds "LOU'S". */
  function nameLike(tok) {
    var t = tok.replace(/[^A-Z0-9'&\-]/g, '');
    if (!t) return '';
    if (t.indexOf("'") >= 0) t = t.replace(/'+/g, '%');
    else if (t.length >= 4 && /[A-Z]S$/.test(t)) t = t.slice(0, -1) + '%S';
    return "(upper(dba_name) like '%" + t + "%' OR upper(aka_name) like '%" + t + "%')";
  }

  /** "1234 N Clark St" -> { number: '1234', streetTokens: ['CLARK'] }. */
  function parseAddress(q) {
    var m = /^(\d{1,6})\s+(.+)$/.exec(clean(q));
    if (!m) return null;
    var words = m[2].replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter(Boolean);
    var street = words.filter(function (w) { return !SKIP_STREET[w]; })
      .map(function (w) { return /^\d+(ST|ND|RD|TH)$/.test(w) ? w.replace(/(ST|ND|RD|TH)$/, '') : w; });
    if (!street.length) return null;
    return { number: m[1], streetTokens: street.slice(0, 3) };
  }

  var GROUP = 'license_,dba_name,aka_name,address,zip,facility_type';

  /** SoQL params for a search. Returns null if nothing usable was typed. */
  function searchParams(q, forceName) {
    var addr = forceName ? null : parseAddress(q);
    var where = [], mode;
    if (addr) {
      mode = 'address';
      where.push("address like '" + addr.number + " %'");
      addr.streetTokens.forEach(function (t) { where.push("upper(address) like '%" + t + "%'"); });
    } else {
      var toks = clean(q).split(' ').map(nameLike).filter(Boolean).slice(0, 5);
      if (!toks.length) return null;
      mode = 'name';
      where = toks;
    }
    return {
      mode: mode,
      params: { $select: GROUP + ',max(inspection_date) as last', $where: where.join(' AND '), $group: GROUP, $order: 'last DESC', $limit: String(SEARCH_LIMIT) }
    };
  }

  function fulltextParams(q) {
    var c = String(q || '').replace(/["\\]/g, ' ').trim();
    if (!c) return null;
    return { mode: 'fulltext', params: { $select: GROUP + ',max(inspection_date) as last', $q: c, $group: GROUP, $order: 'last DESC', $limit: String(SEARCH_LIMIT) } };
  }

  /** Address (if it looks like one), then name, then full text. */
  function searchPlan(q) {
    var plan = [], first = searchParams(q);
    if (first) plan.push(first);
    if (first && first.mode === 'address') { var n = searchParams(q, true); if (n) plan.push(n); }
    var ft = fulltextParams(q);
    if (ft) plan.push(ft);
    return plan;
  }

  function validLicense(l) { return /^\d{1,10}$/.test(String(l || '')) && Number(l) > 0; }
  function licLit(l) { return opts.licenseNumeric ? String(Number(l)) : quote(String(l)); }

  /** Detail key: { license } or { dba, address } (exact raw values) when there's no usable license. */
  function detailParams(key) {
    var where;
    if (key && validLicense(key.license)) where = 'license_=' + licLit(key.license);
    else if (key && key.dba && key.address) where = 'upper(dba_name)=' + quote(String(key.dba).toUpperCase()) + ' AND address=' + quote(key.address);
    else return null;
    return { $where: where, $order: 'inspection_date DESC', $limit: String(DETAIL_LIMIT) };
  }

  /** Latest records for the search results (for the result chips). */
  function chipsParams(licenses) {
    var ids = (licenses || []).filter(validLicense);
    if (!ids.length) return null;
    return {
      $select: 'license_,inspection_id,inspection_date,results',
      $where: 'license_ in(' + ids.map(licLit).join(',') + ')',
      $order: 'inspection_date DESC',
      $limit: '2000'
    };
  }
  /** Newest record per license from chipsParams rows. */
  function latestPerLicense(rows) {
    var out = {};
    (rows || []).forEach(function (r) {
      var k = String(r.license_ || ''), d = String(r.inspection_date || '').slice(0, 10);
      var cur = out[k];
      if (!cur || d > cur.date || (d === cur.date && (Number(r.inspection_id) || 0) > (Number(cur.id) || 0))) out[k] = { date: d, results: r.results, id: r.inspection_id };
    });
    return out;
  }

  /** Newest inspection date in the whole dataset ("data includes inspections through"). */
  function newestParams() { return { $select: 'max(inspection_date) as newest', $limit: '1' }; }

  /** One row per establishment key; an establishment can have rows under several DBA spellings. */
  function dedupe(rows) {
    var seen = {}, out = [];
    (rows || []).forEach(function (r) {
      var k = validLicense(r.license_) ? 'L' + Number(r.license_) : 'X' + clean(r.dba_name) + '|' + clean(r.address);
      var prev = seen[k];
      if (!prev) { seen[k] = r; out.push(r); }
      else if (String(r.last || '') > String(prev.last || '')) { out[out.indexOf(prev)] = r; seen[k] = r; }
    });
    return out;
  }

  function url(params) {
    return BASE + '?' + Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
  }

  function get(params, fetchImpl, timeoutMs) {
    var f = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(null) : null);
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 20000) : null;
    return f(url(params), { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: 'application/json' } })
      .then(function (r) {
        var err;
        if (r.status === 429) err = new Error('The Chicago Data Portal is busy right now (too many requests). Please try again in a minute.');
        else if (!r.ok) err = new Error('The Chicago Data Portal returned an error (' + r.status + '). Please try again.');
        if (err) { err.status = r.status; throw err; }
        return r.json();
      }, function (e) {
        if (e && e.name === 'AbortError') throw new Error('The Chicago Data Portal took too long to answer. Please try again.');
        throw new Error('Could not reach the Chicago Data Portal. Check your connection and try again.');
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  /** Run a query built by build(); on a 400 that may be a license_ type mismatch, flip the literal style once and retry. */
  function run(build, fetchImpl) {
    var p = build();
    if (!p) return Promise.resolve([]);
    return get(p, fetchImpl).catch(function (e) {
      if (e && e.status === 400 && /license_/.test(JSON.stringify(p)) && !opts.flipped) {
        opts.flipped = true; opts.licenseNumeric = !opts.licenseNumeric;
        return get(build(), fetchImpl);
      }
      throw e;
    });
  }

  return {
    BASE: BASE, SEARCH_LIMIT: SEARCH_LIMIT, opts: opts,
    searchParams: searchParams, searchPlan: searchPlan, fulltextParams: fulltextParams, detailParams: detailParams,
    chipsParams: chipsParams, latestPerLicense: latestPerLicense, newestParams: newestParams, dedupe: dedupe,
    parseAddress: parseAddress, nameLike: nameLike, validLicense: validLicense, quote: quote, url: url, get: get, run: run
  };
});
