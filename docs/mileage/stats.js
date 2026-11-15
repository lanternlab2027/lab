/* Timeline Mileage Log: places, filters, totals, IRS rate estimate and CSV. Browser + Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./parser.js'));
  else root.MileageStats = factory(root.MileageParser);
})(typeof self !== 'undefined' ? self : this, function (P) {
  'use strict';

  // IRS business standard mileage rates, cents per mile, from
  // https://www.irs.gov/tax-professionals/standard-mileage-rates (checked Nov 15, 2026).
  var RATES = [
    { from: '2022-01-01', to: '2022-06-30', cents: 58.5, cite: 'IR-2021-251', url: 'https://www.irs.gov/newsroom/irs-issues-standard-mileage-rates-for-2022' },
    { from: '2022-07-01', to: '2022-12-31', cents: 62.5, cite: 'IR-2022-124', url: 'https://www.irs.gov/newsroom/irs-increases-mileage-rate-for-remainder-of-2022' },
    { from: '2023-01-01', to: '2023-12-31', cents: 65.5, cite: 'IR-2022-234', url: 'https://www.irs.gov/newsroom/irs-issues-standard-mileage-rates-for-2023-business-use-increases-3-cents-per-mile' },
    { from: '2024-01-01', to: '2024-12-31', cents: 67, cite: 'IR-2023-239', url: 'https://www.irs.gov/tax-professionals/standard-mileage-rates' },
    { from: '2025-01-01', to: '2025-12-31', cents: 70, cite: 'IR-2024-312', url: 'https://www.irs.gov/tax-professionals/standard-mileage-rates' },
    { from: '2026-01-01', to: '2026-06-30', cents: 72.5, cite: 'IR-2025-128 / Notice 2026-10', url: 'https://www.irs.gov/newsroom/irs-sets-2026-business-standard-mileage-rate-at-725-cents-per-mile-up-25-cents' },
    { from: '2026-07-01', to: '2026-12-31', cents: 76, cite: 'Announcement 2026-11 (IRB 2026-29)', url: 'https://www.irs.gov/irb/2026-29_irb' }
  ];
  function rateFor(date) {
    for (var i = 0; i < RATES.length; i++) if (date >= RATES[i].from && date <= RATES[i].to) return RATES[i];
    return null;
  }

  // ---------- places: cluster trip endpoints within ~150 m ----------
  // Greedy: each endpoint joins the nearest existing place whose center is within `radius` meters, else starts
  // a new place. Centers are running means. Endpoints are visited in order of how often their ~50 m cell
  // appears, so busy places seed first and stay stable.
  function clusterPlaces(trips, hints, radius) {
    radius = radius || 150;
    var pts = [];
    trips.forEach(function (t, i) {
      if (t.start) pts.push({ c: t.start, trip: i, end: 'start', hint: t.startHint });
      if (t.end) pts.push({ c: t.end, trip: i, end: 'end', hint: t.endHint });
    });
    var cell = function (c) { return Math.round(c.lat * 2000) + ',' + Math.round(c.lng * 2000); };
    var freq = {};
    pts.forEach(function (p) { var k = cell(p.c); freq[k] = (freq[k] || 0) + 1; });
    var order = pts.map(function (p, i) { return i; });
    order.sort(function (a, b) { return (freq[cell(pts[b].c)] - freq[cell(pts[a].c)]) || (a - b); });
    var places = [];
    var grid = {}; // coarse grid (~1.1 km) for lookups
    var gkey = function (c) { return Math.floor(c.lat * 100) + ',' + Math.floor(c.lng * 100); };
    function nearby(c) {
      var la = Math.floor(c.lat * 100), ln = Math.floor(c.lng * 100), res = [];
      for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) { var g = grid[(la + a) + ',' + (ln + b)]; if (g) res = res.concat(g); }
      return res;
    }
    var assign = { start: [], end: [] };
    order.forEach(function (i) {
      var p = pts[i], best = null, bd = Infinity;
      nearby(p.c).forEach(function (pl) { var d = P.haversine(pl, p.c); if (d < bd) { bd = d; best = pl; } });
      if (!best || bd > radius) {
        best = { id: places.length, lat: p.c.lat, lng: p.c.lng, n: 0, sumLat: 0, sumLng: 0, suggested: '' };
        places.push(best);
        var k = gkey(best); (grid[k] = grid[k] || []).push(best);
      }
      best.n++; best.sumLat += p.c.lat; best.sumLng += p.c.lng;
      best.lat = best.sumLat / best.n; best.lng = best.sumLng / best.n;
      if (!best.suggested && p.hint) best.suggested = p.hint;
      assign[p.end][p.trip] = best.id;
    });
    // names the file itself suggests (Takeout visit names, HOME/WORK labels)
    (hints || []).forEach(function (h) {
      var best = null, bd = Infinity;
      nearby(h).forEach(function (pl) { var d = P.haversine(pl, h); if (d < bd) { bd = d; best = pl; } });
      if (best && bd <= radius && !best.suggested) best.suggested = h.name;
    });
    places.forEach(function (pl) { delete pl.sumLat; delete pl.sumLng; pl.lat = +pl.lat.toFixed(6); pl.lng = +pl.lng.toFixed(6); });
    return { places: places, startPlace: assign.start, endPlace: assign.end };
  }

  // ---------- filtering ----------
  function years(trips) {
    var s = {};
    trips.forEach(function (t) { s[t.date.slice(0, 4)] = 1; });
    return Object.keys(s).sort().reverse();
  }
  function typeCounts(trips) {
    var c = {};
    trips.forEach(function (t) { c[t.type] = (c[t.type] || 0) + 1; });
    return c;
  }
  // opts: { from: 'YYYY-MM-DD', to, types: {TYPE:true}, minMiles }
  function filter(trips, opts) {
    var min = opts.minMiles != null ? opts.minMiles : 0.1;
    return trips.filter(function (t) {
      return (!opts.from || t.date >= opts.from) && (!opts.to || t.date <= opts.to) && (!opts.types || opts.types[t.type]) && t.miles >= min;
    });
  }

  function round1(x) { return Math.round(x * 10) / 10; }

  // rows: [{trip, purpose: 'business'|'personal'|'', miles (rounded)}] -> totals and IRS estimate.
  // Trip miles are rounded to 0.1 first, so the totals add up to the rows in the table and CSV.
  function totals(rows) {
    var t = { trips: rows.length, all: 0, business: 0, personal: 0, untagged: 0, nBusiness: 0, estimate: 0, unratedMiles: 0, byRate: {} };
    rows.forEach(function (r) {
      var mi = round1(r.trip.miles);
      t.all += mi;
      if (r.purpose === 'business') {
        t.business += mi; t.nBusiness++;
        var rate = rateFor(r.trip.date);
        if (rate) {
          t.estimate += mi * rate.cents / 100;
          var k = rate.from;
          (t.byRate[k] = t.byRate[k] || { rate: rate, miles: 0 }).miles += mi;
        } else t.unratedMiles += mi;
      } else if (r.purpose === 'personal') t.personal += mi;
      else t.untagged += mi;
    });
    ['all', 'business', 'personal', 'untagged', 'unratedMiles'].forEach(function (k) { t[k] = round1(t[k]); });
    Object.keys(t.byRate).forEach(function (k) { t.byRate[k].miles = round1(t.byRate[k].miles); });
    t.estimate = Math.round(t.estimate * 100) / 100;
    return t;
  }

  // ---------- CSV ----------
  function cell(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; // spreadsheet formula injection
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  // rows: [{trip, from, to, purpose, note}]
  function toCSV(rows, opts) {
    opts = opts || {};
    var head = ['Date', 'Start time', 'End time', 'From', 'To', 'Miles', 'Purpose', 'Business purpose / notes', 'Distance from', 'IRS rate ($/mi)', 'Estimated amount ($)'];
    var lines = [head.map(cell).join(',')];
    var tot = totals(rows);
    rows.forEach(function (r) {
      var t = r.trip, mi = round1(t.miles), rate = r.purpose === 'business' ? rateFor(t.date) : null;
      var purpose = r.purpose === 'business' ? 'Business' : r.purpose === 'personal' ? 'Personal' : '';
      var src = t.distSource === 'file' ? 'Google Timeline' : t.distSource === 'path' ? 'Path points (estimate)' : 'Straight line (underestimate)';
      lines.push([t.date, t.startHM, t.endHM, r.from, r.to, mi.toFixed(1), purpose, r.note || '', src,
        rate ? (rate.cents / 100).toFixed(3) : '', rate ? (mi * rate.cents / 100).toFixed(2) : ''].map(cell).join(','));
    });
    lines.push('');
    lines.push([cell('Total miles'), tot.all.toFixed(1)].join(','));
    lines.push([cell('Business miles'), tot.business.toFixed(1)].join(','));
    lines.push([cell('Personal miles'), tot.personal.toFixed(1)].join(','));
    lines.push([cell('Untagged miles'), tot.untagged.toFixed(1)].join(','));
    lines.push([cell('Estimated standard mileage amount ($)'), tot.estimate.toFixed(2)].join(','));
    if (opts.period) lines.push([cell('Period'), cell(opts.period)].join(','));
    lines.push(cell('Reconstructed from Google Maps Timeline location history. Estimate only; not tax advice. Verify every trip. See IRS Publication 463, chapter 5.'));
    return '\ufeff' + lines.join('\r\n') + '\r\n';
  }

  return { RATES: RATES, rateFor: rateFor, clusterPlaces: clusterPlaces, years: years, typeCounts: typeCounts, filter: filter, totals: totals, toCSV: toCSV, csvCell: cell, round1: round1 };
});
