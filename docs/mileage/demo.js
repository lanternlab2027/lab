/* Timeline Mileage Log: deterministic invented location history, written in the three real export shapes.
   Used by the "Try a sample" button and by bots/mileage/make_fixtures.js. Every place and person is invented;
   coordinates are generic points around Columbus, Ohio, not real businesses. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MileageDemo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PLACES = {
    home: { lat: 40.0612, lng: -83.0187, name: 'Home', sem: 'HOME' },
    office: { lat: 39.9652, lng: -82.9988, name: 'Studio Office', sem: 'WORK' },
    clientA: { lat: 40.1189, lng: -83.0897, name: 'Brightwater Dental', sem: 'UNKNOWN' },
    clientB: { lat: 39.9101, lng: -82.8233, name: 'Harlow & Pike Architects', sem: 'UNKNOWN' },
    clientC: { lat: 40.2981, lng: -83.0675, name: 'Delmore Farm Supply', sem: 'UNKNOWN' },
    supplier: { lat: 39.9887, lng: -83.1404, name: 'Westfield Print Shop', sem: 'UNKNOWN' },
    grocery: { lat: 40.0705, lng: -83.0011, name: 'Market on High', sem: 'UNKNOWN' },
    gym: { lat: 40.0497, lng: -83.0302, name: 'Riverside Gym', sem: 'UNKNOWN' },
    school: { lat: 40.0731, lng: -83.0422, name: 'Elm Street School', sem: 'UNKNOWN' },
    park: { lat: 40.1405, lng: -82.9822, name: 'Lakeview Park', sem: 'UNKNOWN' }
  };

  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hav(a, b) {
    var r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lng - a.lng) * r;
    var h = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) * Math.sin(dn / 2);
    return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // US Eastern offset in minutes for a UTC instant (DST: 2nd Sunday Mar 07:00Z .. 1st Sunday Nov 06:00Z).
  function nthSunday(y, m, n) { var d = new Date(Date.UTC(y, m, 1)); var first = (7 - d.getUTCDay()) % 7 + 1; return first + (n - 1) * 7; }
  function easternOffset(ms) {
    var y = new Date(ms).getUTCFullYear();
    var a = Date.UTC(y, 2, nthSunday(y, 2, 2), 7), b = Date.UTC(y, 10, nthSunday(y, 10, 1), 6);
    return ms >= a && ms < b ? -240 : -300;
  }
  function isoLocal(ms) {
    var off = easternOffset(ms), d = new Date(ms + off * 60000), o = Math.abs(off);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + '.000' + (off < 0 ? '-' : '+') + pad(o / 60 | 0) + ':' + pad(o % 60);
  }
  function isoZ(ms) { return new Date(ms).toISOString(); }
  // local wall clock (Eastern) -> UTC ms
  function localMs(dateStr, h, m) {
    var p = dateStr.split('-'), guess = Date.UTC(+p[0], +p[1] - 1, +p[2], h, m);
    return guess - easternOffset(guess + 300 * 60000) * 60000;
  }
  function jitter(p, r, meters) {
    var dLat = (r() - 0.5) * 2 * meters / 111320, dLng = (r() - 0.5) * 2 * meters / (111320 * Math.cos(p.lat * Math.PI / 180));
    return { lat: p.lat + dLat, lng: p.lng + dLng };
  }

  // Build an ordered list of movements between visits for each day in [from, to] (YYYY-MM-DD).
  function itinerary(from, to, seed) {
    var r = rng(seed || 7), moves = [];
    var d = new Date(from + 'T12:00:00Z'), end = new Date(to + 'T12:00:00Z');
    var clients = ['clientA', 'clientB', 'clientC', 'supplier'];
    for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      var ds = d.toISOString().slice(0, 10), dow = d.getUTCDay(), plan = [];
      if (dow >= 1 && dow <= 5 && r() > 0.06) {
        var t = 7 * 60 + 40 + Math.floor(r() * 50);
        if (r() < 0.35) { plan.push(['home', 'school', t - 25, 'drive']); plan.push(['school', 'office', t, 'drive']); }
        else plan.push(['home', 'office', t, 'drive']);
        if (r() < 0.55) {
          var c = clients[Math.floor(r() * clients.length)], ct = 10 * 60 + Math.floor(r() * 180);
          plan.push(['office', c, ct, 'drive']);
          plan.push([c, 'office', ct + 75 + Math.floor(r() * 60), 'drive']);
        }
        if (r() < 0.3) { var lt = 12 * 60 + Math.floor(r() * 20); plan.push(['office', 'officeLunch', lt, 'walk']); }
        var ht = 17 * 60 + Math.floor(r() * 70);
        if (r() < 0.3) { plan.push(['office', 'grocery', ht, 'drive']); plan.push(['grocery', 'home', ht + 35, 'drive']); }
        else plan.push(['office', 'home', ht, 'drive']);
        if (r() < 0.2) plan.push(['home', 'gym', 19 * 60 + 15, 'drive'], ['gym', 'home', 20 * 60 + 30, 'drive']);
      } else if (dow === 0 || dow === 6) {
        if (r() < 0.6) { var g = 9 * 60 + Math.floor(r() * 120); plan.push(['home', 'grocery', g, 'drive'], ['grocery', 'home', g + 50, 'drive']); }
        if (r() < 0.35) { var pk = 14 * 60 + Math.floor(r() * 60); plan.push(['home', 'park', pk, r() < 0.5 ? 'cycle' : 'drive'], ['park', 'home', pk + 120, 'drive']); }
      }
      plan.sort(function (a, b) { return a[2] - b[2]; });
      plan.forEach(function (p) {
        if (p[1] === 'officeLunch') return; // short walk: emitted as a walk loop
        var A = jitter(PLACES[p[0]], r, 35), B = jitter(PLACES[p[1]], r, 35);
        var straight = hav(A, B), factor = 1.22 + r() * 0.2, meters = straight * factor;
        var speed = p[3] === 'cycle' ? 4.6 : 11 + r() * 5; // m/s
        var t0 = localMs(ds, Math.floor(p[2] / 60), p[2] % 60) + Math.floor(r() * 50) * 1000;
        moves.push({ from: p[0], to: p[1], A: A, B: B, t0: t0, t1: t0 + Math.round(meters / speed) * 1000, meters: meters, mode: p[3] });
      });
      plan.filter(function (p) { return p[1] === 'officeLunch'; }).forEach(function (p) {
        var A = jitter(PLACES.office, r, 20), B = jitter(PLACES.office, r, 300), t0 = localMs(ds, Math.floor(p[2] / 60), p[2] % 60);
        moves.push({ from: 'office', to: 'office', A: A, B: B, t0: t0, t1: t0 + 1100 * 1000, meters: 1450 + r() * 300, mode: 'walk' });
      });
    }
    moves.sort(function (a, b) { return a.t0 - b.t0; });
    return moves;
  }

  function f7(x) { return x.toFixed(7); }
  function degStr(c) { return f7(c.lat) + '\u00b0, ' + f7(c.lng) + '\u00b0'; }
  function geoStr(c) { return 'geo:' + c.lat.toFixed(6) + ',' + c.lng.toFixed(6); }
  function interp(A, B, k) { return { lat: A.lat + (B.lat - A.lat) * k, lng: A.lng + (B.lng - A.lng) * k }; }
  var ANDROID_TYPE = { drive: 'IN_PASSENGER_VEHICLE', walk: 'WALKING', cycle: 'CYCLING' };
  var IOS_TYPE = { drive: 'in passenger vehicle', walk: 'walking', cycle: 'cycling' };

  // ---------- Android on-device export (Timeline.json) ----------
  function android(from, to, opts) {
    opts = opts || {};
    var moves = itinerary(from, to, opts.seed || 11), r = rng(99), segs = [];
    var prevEnd = null, prevPlace = 'home';
    moves.forEach(function (m, i) {
      if (prevEnd && m.t0 - prevEnd > 5 * 60000) {
        var P = PLACES[prevPlace];
        segs.push({ startTime: isoLocal(prevEnd), endTime: isoLocal(m.t0), startTimeTimezoneUtcOffsetMinutes: easternOffset(prevEnd), endTimeTimezoneUtcOffsetMinutes: easternOffset(m.t0),
          visit: { hierarchyLevel: 0, probability: 0.85 + r() * 0.1, topCandidate: { placeId: 'ChIJ' + prevPlace.toUpperCase() + 'xxxxxxxxxxxx', semanticType: P.sem, probability: 0.5 + r() * 0.4, placeLocation: { latLng: degStr(P) } } } });
      }
      var act = { start: { latLng: degStr(m.A) }, end: { latLng: degStr(m.B) }, distanceMeters: +m.meters.toFixed(10), probability: 0.97 + r() * 0.03,
        topCandidate: { type: ANDROID_TYPE[m.mode], probability: 0.8 + r() * 0.19 } };
      if (opts.dropDistanceEvery && i % opts.dropDistanceEvery === 3) delete act.distanceMeters;
      segs.push({ startTime: isoLocal(m.t0), endTime: isoLocal(m.t1), startTimeTimezoneUtcOffsetMinutes: easternOffset(m.t0), endTimeTimezoneUtcOffsetMinutes: easternOffset(m.t1), activity: act });
      // timelinePath: a 2-hour window of points (real exports group raw path points in 2-hour blocks)
      var w0 = Math.floor(m.t0 / 7200000) * 7200000, pts = [], n = 6;
      for (var k = 0; k <= n; k++) {
        var c = interp(m.A, m.B, k / n), off = (k % 2 ? 1 : -1) * 0.0009 * Math.sin(k / n * Math.PI); // bend the road a bit
        pts.push({ point: degStr({ lat: c.lat + off, lng: c.lng - off }), time: isoLocal(m.t0 + (m.t1 - m.t0) * k / n) });
      }
      segs.push({ startTime: isoLocal(w0), endTime: isoLocal(w0 + 7200000), timelinePath: pts });
      prevEnd = m.t1; prevPlace = m.to;
      if (i === 40) segs.push({ startTime: isoLocal(m.t0), endTime: isoLocal(m.t0 + 3 * 86400000), timelineMemory: { trip: { distanceFromOriginKms: 61, destinations: [{ identifier: { placeId: 'ChIJDESTxxxxxxxxxxxx' } }] } } });
    });
    return {
      semanticSegments: segs,
      rawSignals: [
        { position: { LatLng: degStr(PLACES.home), accuracyMeters: 13, altitudeMeters: 241.6, source: 'WIFI', timestamp: isoLocal(moves.length ? moves[moves.length - 1].t1 : 0), speedMetersPerSecond: 0.0 } },
        { activityRecord: { probableActivities: [{ type: 'STILL', confidence: 0.96 }, { type: 'IN_VEHICLE', confidence: 0.02 }], timestamp: isoLocal(moves.length ? moves[moves.length - 1].t1 : 0) } }
      ],
      userLocationProfile: {
        frequentPlaces: [
          { placeId: 'ChIJHOMExxxxxxxxxxxx', placeLocation: degStr(PLACES.home), label: 'HOME' },
          { placeId: 'ChIJOFFICExxxxxxxxxx', placeLocation: degStr(PLACES.office), label: 'WORK' }
        ],
        persona: { travelModeAffinities: [{ mode: 'IN_PASSENGER_VEHICLE', affinity: 0.82 }, { mode: 'WALKING', affinity: 0.14 }] }
      }
    };
  }

  // ---------- iOS on-device export (location-history.json) ----------
  function ios(from, to, opts) {
    opts = opts || {};
    var moves = itinerary(from, to, opts.seed || 23), r = rng(5), arr = [], paths = [];
    var prevEnd = null, prevPlace = 'home';
    moves.forEach(function (m, i) {
      if (prevEnd && m.t0 - prevEnd > 5 * 60000) {
        var P = PLACES[prevPlace];
        arr.push({ endTime: isoLocal(m.t0), startTime: isoLocal(prevEnd), visit: { hierarchyLevel: '0', topCandidate: { probability: (0.5 + r() * 0.4).toFixed(6), semanticType: P.sem === 'UNKNOWN' ? 'Unknown' : P.sem === 'HOME' ? 'Home' : 'Work', placeID: 'ChIJ' + prevPlace + 'xxxxxxxxxx', placeLocation: geoStr(P) }, probability: (0.8 + r() * 0.15).toFixed(6) } });
      }
      var act = { probability: (0.97 + r() * 0.03).toFixed(6), end: geoStr(m.B), topCandidate: { type: IOS_TYPE[m.mode], probability: (0.8 + r() * 0.19).toFixed(6) }, distanceMeters: m.meters.toFixed(6), start: geoStr(m.A) };
      if (opts.dropDistanceEvery && i % opts.dropDistanceEvery === 2) delete act.distanceMeters;
      arr.push({ endTime: isoLocal(m.t1), startTime: isoLocal(m.t0), activity: act });
      var w0 = Math.floor(m.t0 / 7200000) * 7200000, pts = [];
      for (var k = 0; k <= 4; k++) {
        var c = interp(m.A, m.B, k / 4);
        pts.push({ point: geoStr(c), durationMinutesOffsetFromStartTime: String(Math.round((m.t0 + (m.t1 - m.t0) * k / 4 - w0) / 60000)) });
      }
      paths.push({ endTime: isoZ(w0 + 7200000), startTime: isoZ(w0), timelinePath: pts });
      prevEnd = m.t1; prevPlace = m.to;
    });
    if (moves.length) arr.push({ endTime: isoLocal(moves[moves.length - 1].t1), startTime: isoLocal(moves[0].t0), timelineMemory: { destinations: [{ identifier: 'ChIJDESTxxxxxxxxxxxx' }], distanceFromOriginKms: '61' } });
    return arr.concat(paths); // iOS puts all timelinePath entries at the end of the array
  }

  // ---------- Takeout Semantic Location History (one file per month) ----------
  var MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  var TK_TYPE = { drive: 'IN_PASSENGER_VEHICLE', walk: 'WALKING', cycle: 'CYCLING' };
  function e7(x) { return Math.round(x * 1e7); }
  function takeout(from, to, opts) {
    opts = opts || {};
    var moves = itinerary(from, to, opts.seed || 31), r = rng(77), files = {};
    var prevEnd = null, prevPlace = 'home';
    function bucket(ms) {
      var d = new Date(ms + easternOffset(ms) * 60000), y = d.getUTCFullYear(), mo = d.getUTCMonth();
      var name = y + '/' + y + '_' + MONTHS[mo] + '.json';
      return (files[name] = files[name] || { timelineObjects: [] }).timelineObjects;
    }
    var msStyle = function (ms) { return opts.timestampMsMonth && isoZ(ms).slice(0, 7) === opts.timestampMsMonth; };
    moves.forEach(function (m, i) {
      if (prevEnd && m.t0 - prevEnd > 5 * 60000) {
        var P = PLACES[prevPlace];
        var dur = msStyle(prevEnd) ? { startTimestampMs: String(prevEnd), endTimestampMs: String(m.t0) } : { startTimestamp: isoZ(prevEnd), endTimestamp: isoZ(m.t0) };
        bucket(prevEnd).push({ placeVisit: { location: { latitudeE7: e7(P.lat), longitudeE7: e7(P.lng), placeId: 'ChIJ' + prevPlace + 'xxxxxxxxxx', address: '100 Example Rd, Columbus, OH 43210, USA', name: P.name, semanticType: P.sem === 'HOME' ? 'TYPE_HOME' : P.sem === 'WORK' ? 'TYPE_WORK' : undefined, sourceInfo: { deviceTag: 1438290817 }, locationConfidence: 92.3, calibratedProbability: 80.1 },
          duration: dur, placeConfidence: 'HIGH_CONFIDENCE', centerLatE7: e7(P.lat), centerLngE7: e7(P.lng), visitConfidence: 97, otherCandidateLocations: [], editConfirmationStatus: 'NOT_CONFIRMED', locationConfidence: 93, placeVisitType: 'SINGLE_PLACE', placeVisitImportance: 'MAIN' } });
      }
      var type = TK_TYPE[m.mode];
      var wps = [m.A, interp(m.A, m.B, 0.5), m.B].map(function (c) { return { latE7: e7(c.lat), lngE7: e7(c.lng) }; });
      var seg = {
        startLocation: { latitudeE7: e7(m.A.lat), longitudeE7: e7(m.A.lng), sourceInfo: { deviceTag: 1438290817 } },
        endLocation: { latitudeE7: e7(m.B.lat), longitudeE7: e7(m.B.lng), sourceInfo: { deviceTag: 1438290817 } },
        duration: msStyle(m.t0) ? { startTimestampMs: String(m.t0), endTimestampMs: String(m.t1) } : { startTimestamp: isoZ(m.t0), endTimestamp: isoZ(m.t1) },
        distance: Math.round(m.meters), activityType: type, confidence: 'HIGH',
        activities: [{ activityType: type, probability: 90 + r() * 9 }, { activityType: 'WALKING', probability: r() * 3 }, { activityType: 'IN_BUS', probability: r() }],
        waypointPath: { waypoints: wps, source: 'INFERRED', roadSegment: [{ placeId: 'ChIJroadxxxxxxxxxxx', duration: '9s' }], distanceMeters: +(m.meters * 1.01).toFixed(6), travelMode: type === 'IN_PASSENGER_VEHICLE' ? 'DRIVE' : type === 'WALKING' ? 'WALK' : 'BICYCLE', confidence: 0.99 },
        editConfirmationStatus: 'NOT_CONFIRMED'
      };
      if (type === 'IN_PASSENGER_VEHICLE') seg.parkingEvent = { location: { latitudeE7: e7(m.B.lat), longitudeE7: e7(m.B.lng), accuracyMetres: 21 }, method: 'END_OF_ACTIVITY_SEGMENT', locationSource: 'FROM_ACTIVITY_SEGMENT', timestamp: isoZ(m.t1) };
      if (opts.dropDistanceEvery && i % opts.dropDistanceEvery === 4) { delete seg.distance; delete seg.waypointPath.distanceMeters; }
      if (opts.dropDistanceEvery && i % opts.dropDistanceEvery === 5) { delete seg.distance; delete seg.waypointPath; }
      bucket(m.t0).push({ activitySegment: seg });
      prevEnd = m.t1; prevPlace = m.to;
    });
    return files;
  }

  return { PLACES: PLACES, itinerary: itinerary, android: android, ios: ios, takeout: takeout, haversine: hav };
});
