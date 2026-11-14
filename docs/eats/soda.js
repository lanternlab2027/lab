/* Socrata (NYC Open Data) queries for dataset 43nn-pn8j, called straight from the browser.
   No app token: anonymous requests are throttled by Socrata, so queries are kept small. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EatsSoda = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var BASE = 'https://data.cityofnewyork.us/resource/43nn-pn8j.json';
  var BOROS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
  var SEARCH_LIMIT = 40;
  var DETAIL_LIMIT = 2000;
  var SKIP_STREET = { E: 1, W: 1, N: 1, S: 1, EAST: 1, WEST: 1, NORTH: 1, SOUTH: 1, ST: 1, STREET: 1, AVE: 1, AV: 1, AVENUE: 1, RD: 1, ROAD: 1, BLVD: 1, BOULEVARD: 1, PL: 1, PLACE: 1, PKWY: 1, PARKWAY: 1, DR: 1, DRIVE: 1, LN: 1, LANE: 1, SQ: 1, THE: 1, OF: 1, NY: 1, NYC: 1, 'NEW': 1, YORK: 1 };

  function clean(s) { return String(s || '').toUpperCase().replace(/[\u2018\u2019`]/g, "'").replace(/[%_\\"]/g, ' ').replace(/\s+/g, ' ').trim(); }

  /** Name token -> LIKE pattern. Apostrophes become wildcards so "joes" finds "JOE'S". */
  function nameLike(tok) {
    var t = tok.replace(/[^A-Z0-9'&\-]/g, '');
    if (!t) return '';
    if (t.indexOf("'") >= 0) t = t.replace(/'+/g, '%');
    else if (t.length >= 4 && /[A-Z]S$/.test(t)) t = t.slice(0, -1) + '%S';
    return "upper(dba) like '%" + t + "%'";
  }

  /** Looks like "205 E Houston St" or "30-65 14th Street". */
  function parseAddress(q) {
    var m = /^(\d+[A-Z]?(?:-\d+[A-Z]?)?)\s+(.+)$/.exec(clean(q));
    if (!m) return null;
    var words = m[2].replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter(Boolean);
    var street = words.filter(function (w) { return !SKIP_STREET[w]; });
    // Ordinal streets: "14" -> "14TH" style is inconsistent in the data, so match the digits.
    street = street.map(function (w) { return /^\d+(ST|ND|RD|TH)$/.test(w) ? w.replace(/(ST|ND|RD|TH)$/, '') : w; });
    if (!street.length) return null;
    return { building: m[1], streetTokens: street.slice(0, 3) };
  }

  function areaWhere(area) {
    var parts = [];
    if (area && area.boro && BOROS.indexOf(area.boro) >= 0) parts.push("boro='" + area.boro + "'");
    if (area && area.zip && /^\d{5}$/.test(area.zip)) parts.push("zipcode='" + area.zip + "'");
    return parts;
  }

  var GROUP = 'camis,dba,boro,building,street,zipcode,cuisine_description';

  /** Build the SoQL params for a search. Returns null if nothing usable was typed. */
  function searchParams(q, area, forceName) {
    var c = clean(q);
    var where = areaWhere(area);
    var addr = forceName ? null : parseAddress(q);
    var mode;
    if (addr) {
      mode = 'address';
      where.push("building='" + addr.building + "'");
      addr.streetTokens.forEach(function (t) { where.push("upper(street) like '%" + t + "%'"); });
    } else {
      var toks = c.split(' ').map(nameLike).filter(Boolean).slice(0, 5);
      if (!toks.length) return null;
      mode = 'name';
      where = where.concat(toks);
    }
    return {
      mode: mode,
      params: {
        $select: GROUP + ',max(inspection_date) as last',
        $where: where.join(' AND '),
        $group: GROUP,
        $order: 'last DESC',
        $limit: String(SEARCH_LIMIT)
      }
    };
  }

  /** Full-text fallback ($q) when the LIKE search finds nothing. */
  function fulltextParams(q, area) {
    var c = String(q || '').replace(/["\\]/g, ' ').trim();
    if (!c) return null;
    var p = { $select: GROUP + ',max(inspection_date) as last', $q: c, $group: GROUP, $order: 'last DESC', $limit: String(SEARCH_LIMIT) };
    var w = areaWhere(area);
    if (w.length) p.$where = w.join(' AND ');
    return { mode: 'fulltext', params: p };
  }

  /** Queries to try in order until one returns rows: address (if it looks like one), name, full text. */
  function searchPlan(q, area) {
    var plan = [];
    var first = searchParams(q, area);
    if (first) plan.push(first);
    if (first && first.mode === 'address') { var byName = searchParams(q, area, true); if (byName) plan.push(byName); }
    var ft = fulltextParams(q, area);
    if (ft) plan.push(ft);
    return plan;
  }

  function validCamis(c) { return /^\d{5,10}$/.test(String(c || '')); }

  function detailParams(camis) {
    if (!validCamis(camis)) return null;
    return { $where: "camis='" + camis + "'", $order: 'inspection_date DESC', $limit: String(DETAIL_LIMIT) };
  }

  /** Grade cards for a list of results (used for the chips in the results list). */
  function gradesParams(camisList) {
    var ids = (camisList || []).filter(validCamis);
    if (!ids.length) return null;
    return {
      $select: 'camis,grade,inspection_date',
      $where: 'camis in(' + ids.map(function (c) { return "'" + c + "'"; }).join(',') + ") AND grade in('A','B','C','P','Z')",
      $group: 'camis,grade,inspection_date',
      $limit: '2000'
    };
  }

  /** Latest card grade per camis from gradesParams rows. */
  function latestGrades(rows) {
    var out = {};
    (rows || []).forEach(function (r) {
      var d = String(r.inspection_date || '').slice(0, 10);
      if (!out[r.camis] || d > out[r.camis].date) out[r.camis] = { grade: r.grade, date: d };
    });
    return out;
  }

  /** Collapse search rows to one per camis (a DBA can change over time). */
  function dedupe(rows) {
    var seen = {}, out = [];
    (rows || []).forEach(function (r) {
      if (!r.camis) return;
      var prev = seen[r.camis];
      if (!prev) { seen[r.camis] = r; out.push(r); }
      else if (String(r.last || '') > String(prev.last || '')) { out[out.indexOf(prev)] = r; seen[r.camis] = r; }
    });
    return out;
  }

  function url(params) {
    var qs = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    return BASE + '?' + qs;
  }

  function get(params, fetchImpl, timeoutMs) {
    var f = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(null) : null);
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 20000) : null;
    return f(url(params), { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (r.status === 429) throw new Error('NYC Open Data is busy right now (too many requests). Please try again in a minute.');
        if (!r.ok) throw new Error('NYC Open Data returned an error (' + r.status + '). Please try again.');
        return r.json();
      }, function (e) {
        if (e && e.name === 'AbortError') throw new Error('NYC Open Data took too long to answer. Please try again.');
        throw new Error('Could not reach NYC Open Data. Check your connection and try again.');
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  return {
    BASE: BASE, BOROS: BOROS, SEARCH_LIMIT: SEARCH_LIMIT,
    searchParams: searchParams, searchPlan: searchPlan, fulltextParams: fulltextParams, detailParams: detailParams,
    gradesParams: gradesParams, latestGrades: latestGrades, dedupe: dedupe,
    parseAddress: parseAddress, nameLike: nameLike, validCamis: validCamis, url: url, get: get
  };
});
