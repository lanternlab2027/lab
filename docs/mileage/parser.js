/* Timeline Mileage Log: parser for Google Maps Timeline exports. Runs in the browser and in Node (tests).
   Formats:
   - "android": on-device export, an object { semanticSegments: [...], rawSignals: [...], userLocationProfile: {...} };
     coordinates are degree strings like "41.8781136\u00b0, -87.6297982\u00b0", numbers are numbers.
   - "ios": on-device export (location-history.json), a top-level array; numbers are strings,
     coordinates are "geo:lat,lng", activity types are lower case with spaces ("in passenger vehicle").
   - "takeout": older Takeout "Semantic Location History" monthly files, { timelineObjects: [ {activitySegment}|{placeVisit} ] },
     coordinates in E7 integers (latitudeE7 / latE7), distance in meters, activityType.
   Nothing here touches the network. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MileageParser = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var R = 6371008.8; // mean Earth radius, meters
  var M_PER_MI = 1609.344;

  function haversine(a, b) {
    if (!a || !b) return 0;
    var rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var s = Math.sin(dLat / 2), t = Math.sin(dLng / 2);
    var h = s * s + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * t * t;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function pathLength(pts) {
    var m = 0;
    for (var i = 1; i < pts.length; i++) m += haversine(pts[i - 1], pts[i]);
    return m;
  }

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (typeof v === 'string' && v.trim() !== '') return Number(v);
    return NaN;
  }
  function valid(lat, lng) {
    return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  }
  // E7 integers. Some old exports wrote values past int32 range (unsigned wrap); undo that.
  function fromE7(v) {
    var n = num(v);
    if (!isFinite(n)) return NaN;
    if (n > 1800000000) n -= 4294967296;
    else if (n < -1800000000) n += 4294967296;
    return n / 1e7;
  }

  // Accepts "geo:41.88,-87.63", "41.88\u00b0, -87.63\u00b0", "41.88, -87.63", {latLng: "..."}, {LatLng},
  // {latitudeE7, longitudeE7}, {latE7, lngE7}, {lat, lng}, {latitude, longitude}.
  function parseCoord(v) {
    if (v == null) return null;
    if (typeof v === 'string') {
      var s = v.trim().replace(/^geo:/i, '').replace(/\u00b0/g, '').split(';')[0];
      var m = /^\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)/.exec(s);
      if (!m) return null;
      var lat = +m[1], lng = +m[2];
      return valid(lat, lng) ? { lat: lat, lng: lng } : null;
    }
    if (typeof v !== 'object') return null;
    if (v.latLng != null) return parseCoord(v.latLng);
    if (v.LatLng != null) return parseCoord(v.LatLng);
    if (v.point != null) return parseCoord(v.point);
    var a, b;
    if (v.latitudeE7 != null) { a = fromE7(v.latitudeE7); b = fromE7(v.longitudeE7); }
    else if (v.latE7 != null) { a = fromE7(v.latE7); b = fromE7(v.lngE7); }
    else if (v.lat != null) { a = num(v.lat); b = num(v.lng != null ? v.lng : v.lon); }
    else if (v.latitude != null) { a = num(v.latitude); b = num(v.longitude); }
    else return null;
    return valid(a, b) ? { lat: a, lng: b } : null;
  }

  // ---------- time ----------
  // Returns { ms, local: "YYYY-MM-DD", hm: "HH:MM" }. When the string carries its own UTC offset
  // (on-device exports do: "2026-03-02T08:14:00.000-05:00"), the local date/time is read from the string,
  // so a trip is dated where it happened. Strings ending in Z (Takeout) use offsetMin if given, else the
  // browser's time zone.
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseTime(v, offsetMin) {
    if (v == null || v === '') return null;
    var ms, m;
    if (typeof v === 'number' || /^\d{10,13}$/.test(String(v))) {
      ms = +v; if (ms < 1e11) ms *= 1000;
    } else {
      var s = String(v).trim();
      // "2025-03-24 20:07:24 +0100" style
      s = s.replace(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d(?::\d\d(?:\.\d+)?)?) ?([+-]\d\d):?(\d\d)$/, '$1T$2$3:$4');
      ms = Date.parse(s);
      if (!isFinite(ms)) return null;
      m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::\d\d(?:\.\d+)?)?([+-]\d\d:?\d\d)$/.exec(s);
      if (m) return { ms: ms, local: m[1] + '-' + m[2] + '-' + m[3], hm: m[4] + ':' + m[5] };
    }
    var d;
    if (isFinite(offsetMin) && offsetMin !== null) {
      d = new Date(ms + offsetMin * 60000);
      return { ms: ms, local: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()), hm: pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) };
    }
    d = new Date(ms);
    return { ms: ms, local: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), hm: pad(d.getHours()) + ':' + pad(d.getMinutes()) };
  }

  // ---------- activity types ----------
  function normType(t) {
    if (t == null) return 'UNKNOWN';
    return String(t).trim().toUpperCase().replace(/[\s-]+/g, '_') || 'UNKNOWN';
  }
  // Checked by default in the UI: you were (probably) in a car.
  var DRIVING = ['IN_PASSENGER_VEHICLE', 'IN_VEHICLE', 'IN_ROAD_VEHICLE', 'IN_CAR', 'DRIVING', 'DRIVE', 'MOTORCYCLING'];
  var TYPE_LABELS = {
    IN_PASSENGER_VEHICLE: 'Driving (car)', IN_VEHICLE: 'In a vehicle', IN_ROAD_VEHICLE: 'Road vehicle', IN_CAR: 'Car', DRIVING: 'Driving', DRIVE: 'Driving',
    MOTORCYCLING: 'Motorcycle', IN_TAXI: 'Taxi / rideshare', IN_BUS: 'Bus', IN_TRAIN: 'Train', IN_SUBWAY: 'Subway', IN_TRAM: 'Tram', IN_FERRY: 'Ferry',
    FLYING: 'Flying', WALKING: 'Walking', RUNNING: 'Running', CYCLING: 'Cycling', ON_FOOT: 'On foot', SAILING: 'Boat', UNKNOWN_ACTIVITY_TYPE: 'Unknown', UNKNOWN: 'Unknown'
  };
  function typeLabel(t) { return TYPE_LABELS[t] || t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' '); }

  // ---------- format detection ----------
  function detect(data) {
    if (Array.isArray(data)) {
      if (!data.length) return 'ios';
      var hit = 0;
      for (var i = 0; i < Math.min(data.length, 50); i++) {
        var o = data[i];
        if (o && typeof o === 'object' && (o.activity || o.visit || o.timelinePath || o.timelineMemory) && (o.startTime || o.endTime)) hit++;
      }
      return hit ? 'ios' : null;
    }
    if (!data || typeof data !== 'object') return null;
    if (Array.isArray(data.semanticSegments)) return 'android';
    if (Array.isArray(data.timelineObjects)) return 'takeout';
    if (Array.isArray(data.locations)) return 'records';
    if (Array.isArray(data.timelineEdits)) return 'edits';
    return null;
  }

  // ---------- shared builders ----------
  function makeTrip(o) {
    // o: { start, end, t0, t1, type, meters (from file) , path (array of coords) , source }
    var meters = num(o.meters), src = 'file';
    if (!(meters >= 0)) {
      if (o.path && o.path.length >= 2) {
        var pts = o.path.slice();
        if (o.start && haversine(o.start, pts[0]) > 1) pts.unshift(o.start);
        if (o.end && haversine(o.end, pts[pts.length - 1]) > 1) pts.push(o.end);
        meters = pathLength(pts); src = 'path';
      } else if (o.start && o.end) {
        meters = haversine(o.start, o.end); src = 'straight';
      } else { meters = NaN; }
    }
    if (!(meters >= 0)) return null;
    return {
      id: o.t0.ms.toString(36) + '-' + o.type.slice(0, 6) + '-' + Math.round(meters),
      type: o.type, start: o.start, end: o.end, ms: o.t0.ms, endMs: o.t1 ? o.t1.ms : o.t0.ms,
      date: o.t0.local, startHM: o.t0.hm, endHM: o.t1 ? o.t1.hm : '', meters: meters, miles: meters / M_PER_MI, distSource: src,
      startHint: o.startHint || '', endHint: o.endHint || ''
    };
  }

  function semanticHint(t) {
    t = normType(t);
    if (/HOME/.test(t)) return 'Home';
    if (/WORK/.test(t)) return 'Work';
    if (/SEARCHED_ADDRESS|ALIASED_LOCATION/.test(t)) return '';
    return '';
  }

  // Places named in the file (Takeout visit names, HOME/WORK labels): {lat,lng,name}
  function pushHint(list, c, name) { if (c && name) list.push({ lat: c.lat, lng: c.lng, name: name }); }

  // ---------- on-device (Android object or iOS array) ----------
  function parseOnDevice(segs, fmt, out) {
    var paths = []; // {ms, c}
    var acts = [];
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (!s || typeof s !== 'object') continue;
      var off0 = num(s.startTimeTimezoneUtcOffsetMinutes), off1 = num(s.endTimeTimezoneUtcOffsetMinutes);
      if (s.timelinePath && Array.isArray(s.timelinePath)) {
        var base = parseTime(s.startTime, off0);
        for (var j = 0; j < s.timelinePath.length; j++) {
          var p = s.timelinePath[j], c = parseCoord(p.point);
          if (!c) continue;
          var ms = null;
          if (p.time) { var tt = parseTime(p.time); ms = tt && tt.ms; }
          else if (base && p.durationMinutesOffsetFromStartTime != null) ms = base.ms + num(p.durationMinutesOffsetFromStartTime) * 60000;
          if (isFinite(ms)) paths.push({ ms: ms, c: c });
        }
      }
      if (s.visit) {
        var tc = s.visit.topCandidate || {};
        var vc = parseCoord(tc.placeLocation);
        pushHint(out.hints, vc, semanticHint(tc.semanticType));
        out.visits++;
      }
      if (s.activity) {
        var a = s.activity, top = a.topCandidate || {};
        var type = normType(top.type || a.type);
        var t0 = parseTime(s.startTime, off0), t1 = parseTime(s.endTime, isFinite(off1) ? off1 : off0);
        if (!t0) { out.skipped++; continue; }
        acts.push({ start: parseCoord(a.start), end: parseCoord(a.end), t0: t0, t1: t1, type: type, meters: a.distanceMeters });
      }
    }
    paths.sort(function (x, y) { return x.ms - y.ms; });
    for (var k = 0; k < acts.length; k++) {
      var ac = acts[k];
      if (!(num(ac.meters) >= 0) && paths.length && ac.t1) {
        ac.path = inWindow(paths, ac.t0.ms, ac.t1.ms);
      }
      var trip = makeTrip(ac);
      if (trip) out.trips.push(trip); else out.skipped++;
    }
  }
  function inWindow(paths, a, b) {
    var lo = 0, hi = paths.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (paths[mid].ms < a) lo = mid + 1; else hi = mid; }
    var res = [];
    for (var i = lo; i < paths.length && paths[i].ms <= b; i++) res.push(paths[i].c);
    return res;
  }

  // ---------- Takeout Semantic Location History ----------
  function parseTakeout(objs, out) {
    var lastVisitEnd = null;
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i] || {};
      if (o.placeVisit) {
        var loc = o.placeVisit.location || {};
        var c = parseCoord(loc);
        var nm = loc.name || (loc.semanticType ? semanticHint(loc.semanticType) : '') || '';
        if (!nm && loc.address) nm = String(loc.address).split(',')[0];
        pushHint(out.hints, c, nm);
        out.visits++;
        continue;
      }
      var a = o.activitySegment;
      if (!a) continue;
      var d = a.duration || {};
      var t0 = parseTime(d.startTimestamp != null ? d.startTimestamp : d.startTimestampMs);
      var t1 = parseTime(d.endTimestamp != null ? d.endTimestamp : d.endTimestampMs);
      if (!t0) { out.skipped++; continue; }
      var type = normType(a.activityType || (a.activities && a.activities[0] && a.activities[0].activityType));
      var wp = a.waypointPath || {}, srp = a.simplifiedRawPath || {};
      var path = [];
      (wp.waypoints || []).forEach(function (w) { var cc = parseCoord(w); if (cc) path.push(cc); });
      if (path.length < 2) { path = []; (srp.points || []).forEach(function (w) { var cc = parseCoord(w); if (cc) path.push(cc); }); }
      var start = parseCoord(a.startLocation) || path[0] || null;
      var end = parseCoord(a.endLocation) || path[path.length - 1] || null;
      var meters = a.distance != null ? a.distance : wp.distanceMeters;
      var trip = makeTrip({ start: start, end: end, t0: t0, t1: t1, type: type, meters: meters, path: path });
      if (trip) out.trips.push(trip); else out.skipped++;
    }
  }

  function friendlyError(fmt) {
    if (fmt === 'records') return 'That looks like Records.json (raw location points), which has no trips in it. Upload the Semantic Location History month files, or the Timeline export from your phone.';
    if (fmt === 'edits') return 'That looks like Timeline Edits.json, which has no trips in it. Upload the Timeline export from your phone (Timeline.json or location-history.json).';
    return 'That file doesn\u2019t look like a Google Maps Timeline export. See the steps below for exporting from your phone.';
  }

  // Parse one file's text. Returns { format, trips, hints, visits, skipped }.
  function parseText(text, name) {
    if (typeof text !== 'string') text = String(text || '');
    text = text.replace(/^\ufeff/, '');
    var data;
    try { data = JSON.parse(text); } catch (e) {
      throw new Error((name ? name + ': ' : '') + 'that isn\u2019t a JSON file. Google Maps Timeline exports are .json files.');
    }
    var fmt = detect(data);
    if (!fmt || fmt === 'records' || fmt === 'edits') throw new Error(friendlyError(fmt));
    var out = { format: fmt, trips: [], hints: [], visits: 0, skipped: 0 };
    if (fmt === 'android') {
      parseOnDevice(data.semanticSegments, fmt, out);
      var prof = data.userLocationProfile || {};
      (prof.frequentPlaces || []).forEach(function (f) {
        var lbl = f.label ? semanticHint(f.label) : '';
        pushHint(out.hints, parseCoord(f.placeLocation), lbl);
      });
    } else if (fmt === 'ios') parseOnDevice(data, fmt, out);
    else parseTakeout(data.timelineObjects, out);
    return out;
  }

  // Merge several parsed files (Takeout comes as one file per month). Duplicates (same start time, type
  // and roughly the same distance) are dropped.
  function merge(list) {
    var seen = {}, res = { formats: [], trips: [], hints: [], visits: 0, skipped: 0, dupes: 0 };
    list.forEach(function (r) {
      if (res.formats.indexOf(r.format) < 0) res.formats.push(r.format);
      res.visits += r.visits; res.skipped += r.skipped;
      res.hints = res.hints.concat(r.hints);
      r.trips.forEach(function (t) {
        var k = Math.round(t.ms / 60000) + '|' + t.type + '|' + Math.round(t.meters / 50);
        if (seen[k]) { res.dupes++; return; }
        seen[k] = 1; res.trips.push(t);
      });
    });
    res.trips.sort(function (a, b) { return a.ms - b.ms; });
    return res;
  }

  return {
    haversine: haversine, pathLength: pathLength, parseCoord: parseCoord, fromE7: fromE7, parseTime: parseTime,
    normType: normType, typeLabel: typeLabel, DRIVING: DRIVING, detect: detect, parseText: parseText, merge: merge,
    M_PER_MI: M_PER_MI
  };
});
