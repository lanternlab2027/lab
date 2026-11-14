/* Grade and score logic for NYC Restaurant Report Card.
   Rules come from DOHMH:
   - "How We Score and Grade" (restaurant-grading-faq.pdf): A = 0-13, B = 14-27, C = 28+.
     Initial inspections are graded only when they earn an A; the re-inspection is graded A, B or C.
   - "About Restaurant Inspection Data on NYC Open Data" (dataset attachment): the current grade
     is the grade on the most recent inspection where a grade card or Grade Pending card was issued
     (GRADE in A, B, C, P, Z). Z = Grade Pending, P = Grade Pending issued on re-opening after a
     closure, N = Not Yet Graded. Inspection date 1900-01-01 = not yet inspected. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EatsGrades = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CARD_GRADES = { A: 1, B: 1, C: 1, P: 1, Z: 1 };
  var NEVER = '1900-01-01';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /** Score band per DOHMH: 0-13 A, 14-27 B, 28+ C. Returns null for missing/invalid scores. */
  function bandForScore(score) {
    if (score === null || score === undefined || score === '') return null;
    var n = Number(score);
    if (!isFinite(n) || n < 0) return null;
    if (n <= 13) return 'A';
    if (n <= 27) return 'B';
    return 'C';
  }

  var LABELS = {
    A: 'Grade A', B: 'Grade B', C: 'Grade C',
    Z: 'Grade Pending', P: 'Grade Pending', N: 'Not Yet Graded'
  };
  function gradeLabel(g) { return LABELS[g] || 'No grade on record'; }

  function gradeExplainer(g) {
    switch (g) {
      case 'A': return 'Scored 0 to 13 points on a graded inspection.';
      case 'B': return 'Scored 14 to 27 points on a graded re-inspection.';
      case 'C': return 'Scored 28 or more points on a graded re-inspection.';
      case 'Z': return 'Grade Pending (code Z). A restaurant that gets a B or C on re-inspection also gets a Grade Pending card and can post either one until its hearing at the Office of Administrative Trials and Hearings (OATH).';
      case 'P': return 'Grade Pending (code P): issued when a restaurant re-opens after being closed following an initial inspection, until a re-inspection sets the next grade.';
      case 'N': return 'Not Yet Graded (code N): the restaurant has not had a graded inspection yet.';
      default: return 'No letter grade is on record in the open data for this restaurant.';
    }
  }

  /** "2026-11-10T00:00:00.000" -> "2026-11-10" (no time zone shifting). */
  function isoDay(s) { return s ? String(s).slice(0, 10) : ''; }
  function fmtDate(s, long) {
    var d = isoDay(s);
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (!m) return '';
    var mi = Number(m[2]) - 1;
    return (long ? MONTHS_LONG[mi] : MONTHS[mi]) + ' ' + Number(m[3]) + ', ' + m[1];
  }

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function isInitial(type) { return /initial inspection/i.test(type || ''); }
  function isReinspection(type) { return /\/\s*re-inspection/i.test(type || ''); }
  function isReopening(type) { return /reopening inspection/i.test(type || ''); }
  /** Gradable inspection types per DOHMH's open-data note. */
  function isGradableType(type) {
    return /^(cycle inspection|pre-permit \(operational\)) \/ (initial inspection|re-inspection)$/i.test(String(type || '').trim());
  }

  /** Group flat Socrata rows (one per violation) into inspections, newest first. */
  function groupInspections(rows) {
    var map = {}, order = [];
    (rows || []).forEach(function (r) {
      var day = isoDay(r.inspection_date);
      var key = day + '|' + (r.inspection_type || '') + '|' + (r.action || '');
      var ins = map[key];
      if (!ins) {
        ins = map[key] = {
          date: day,
          type: r.inspection_type || '',
          action: r.action || '',
          score: num(r.score),
          grade: r.grade || '',
          gradeDate: isoDay(r.grade_date),
          recordDate: isoDay(r.record_date),
          violations: []
        };
        order.push(key);
      }
      if (ins.score === null && num(r.score) !== null) ins.score = num(r.score);
      if (!ins.grade && r.grade) { ins.grade = r.grade; ins.gradeDate = isoDay(r.grade_date); }
      if (r.record_date && isoDay(r.record_date) > ins.recordDate) ins.recordDate = isoDay(r.record_date);
      if (r.violation_code || r.violation_description) {
        var dup = ins.violations.some(function (v) { return v.code === (r.violation_code || '') && v.text === (r.violation_description || ''); });
        if (!dup) ins.violations.push({ code: r.violation_code || '', text: r.violation_description || '', flag: r.critical_flag || '' });
      }
    });
    var list = order.map(function (k) { return map[k]; });
    list.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return 0;
    });
    list.forEach(function (ins) {
      ins.inspected = ins.date !== NEVER && !!ins.date;
      ins.critical = ins.violations.filter(function (v) { return v.flag === 'Critical'; }).length;
      ins.closed = /closed by dohmh/i.test(ins.action);
      ins.reclosed = /re-closed/i.test(ins.action);
      ins.reopened = /re-opened/i.test(ins.action);
      ins.band = bandForScore(ins.score);
    });
    return list;
  }

  /** Restaurant identity from rows (latest row wins). */
  function identity(rows) {
    var r = (rows || [])[0] || {};
    var best = r;
    (rows || []).forEach(function (x) { if (isoDay(x.inspection_date) > isoDay(best.inspection_date)) best = x; });
    return {
      camis: best.camis || '',
      name: tidyName(best.dba || ''),
      rawName: best.dba || '',
      boro: best.boro && best.boro !== '0' ? best.boro : '',
      building: best.building || '',
      street: titleCase(best.street || ''),
      zip: best.zipcode || '',
      cuisine: best.cuisine_description || '',
      address: [best.building, titleCase(best.street || '')].filter(Boolean).join(' ')
    };
  }

  function titleCase(s) {
    return String(s).toLowerCase().replace(/(^|[\s\-\/(&])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); })
      .replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, function (m, n, suf) { return n + suf.toLowerCase(); });
  }
  /** DBA names are upper case in the data. Keep short all-caps tokens (e.g. "NYC", "BBQ") readable. */
  function tidyName(s) {
    s = String(s).trim().replace(/\s+/g, ' ');
    if (!s) return '';
    if (s !== s.toUpperCase()) return s;
    return s.split(' ').map(function (w) {
      if (/^(NYC|BBQ|USA|II|III|IV|LLC|INC|NY|UWS|UES|LES|KFC|IHOP|TGI|DC|LA|JFK|CVS)$/.test(w.replace(/[^A-Z]/g, ''))) return w;
      return w.toLowerCase().replace(/(^|[\-\/(&.])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); })
        .replace(/^([a-z])/, function (c) { return c.toUpperCase(); });
    }).join(' ').replace(/'S\b/g, "'s").replace(/’S\b/g, '’s');
  }

  /**
   * Current grade, following DOHMH's open-data guidance: the grade on the most recent
   * inspection that issued a grade card or Grade Pending card (A, B, C, P, Z).
   * Also flags an in-progress cycle (a newer ungraded initial inspection scoring 14+).
   */
  function currentGrade(inspections) {
    var list = (inspections || []).filter(function (i) { return i.inspected; });
    var graded = null;
    for (var i = 0; i < list.length; i++) { if (CARD_GRADES[list[i].grade]) { graded = list[i]; break; } }
    var latest = list[0] || null;
    var out = {
      // DOHMH: "Until a restaurant has a graded inspection, it is listed as Not Yet Graded."
      grade: graded ? graded.grade : 'N',
      gradeDate: graded ? (graded.gradeDate || graded.date) : '',
      gradedInspection: graded,
      latest: latest,
      inspectedEver: list.length > 0,
      notes: []
    };
    if (!latest) {
      out.notes.push({ kind: 'new', text: 'No inspection on record yet. New restaurants appear in the data with a placeholder date until their first inspection.' });
      return out;
    }
    if (graded && latest.date > graded.date) {
      // Newest gradable (cycle / pre-permit operational) inspection after the graded one.
      var newerGradable = null;
      for (var j = 0; j < list.length && list[j].date > graded.date; j++) {
        if (isGradableType(list[j].type)) { newerGradable = list[j]; break; }
      }
      if (newerGradable && isInitial(newerGradable.type) && newerGradable.score !== null && newerGradable.score >= 14) {
        out.notes.push({ kind: 'cycle', text: 'A newer initial inspection on ' + fmtDate(newerGradable.date) + ' scored ' + newerGradable.score + ' points. Initial inspections scoring 14 or more are not graded; DOHMH re-inspects, typically within a month, and grades the re-inspection. Until a new grade is issued, the grade shown is from the last graded inspection.' });
      } else {
        out.notes.push({ kind: 'later', text: 'The latest inspection (' + fmtDate(latest.date) + ', ' + (latest.type || 'type not listed') + ') did not issue a grade. Not every inspection is graded.' });
      }
    }
    if (!graded && latest && isInitial(latest.type) && latest.score !== null && latest.score >= 14) {
      out.notes.push({ kind: 'cycle', text: 'Its latest inspection was an initial inspection that scored ' + latest.score + ' points. Initial inspections scoring 14 or more are not graded; the re-inspection is.' });
    }
    if (graded && (graded.grade === 'A' || graded.grade === 'B' || graded.grade === 'C')) {
      var band = bandForScore(graded.score);
      if (band && band !== graded.grade) {
        out.notes.push({ kind: 'mismatch', text: 'The recorded score (' + graded.score + ') falls in the ' + band + ' range, but the grade on record is ' + graded.grade + '. DOHMH notes that scores can change after a hearing (adjudication) and that the data can contain inconsistencies, so check ABCEats or the posted card if it matters.' });
      }
    }
    if (latest.closed && !latest.reopened) {
      out.notes.push({ kind: 'closed', text: 'DOHMH recorded a closure at the inspection on ' + fmtDate(latest.date) + '. Restaurants closed by DOHMH need a re-opening inspection before they can serve again; a later re-opening may not appear in the data yet.' });
    }
    return out;
  }

  /** Score points for a timeline, oldest first, inspections with a numeric score only. */
  function timeline(inspections) {
    return (inspections || []).filter(function (i) { return i.inspected && i.score !== null; })
      .slice().reverse()
      .map(function (i) { return { date: i.date, score: i.score, grade: i.grade, band: i.band, type: i.type }; });
  }

  function dataAsOf(rows) {
    var max = '';
    (rows || []).forEach(function (r) { var d = isoDay(r.record_date); if (d > max) max = d; });
    return max;
  }

  /** One-line share headline, neutral wording. */
  function headline(name, grade) {
    switch (grade) {
      case 'A': case 'B': case 'C': return 'Before you go: ' + name + ' got ' + (grade === 'A' ? 'an A' : 'a ' + grade);
      case 'Z': case 'P': return 'Before you go: ' + name + ' has a Grade Pending';
      default: return 'Before you go: ' + name + ' is not graded yet';
    }
  }

  function flagLabel(flag) {
    if (flag === 'Critical') return 'Critical';
    if (flag === 'Not Critical') return 'Not critical';
    if (flag === 'Not Applicable') return 'Not applicable';
    return flag || '';
  }

  return {
    bandForScore: bandForScore, gradeLabel: gradeLabel, gradeExplainer: gradeExplainer,
    groupInspections: groupInspections, currentGrade: currentGrade, timeline: timeline,
    identity: identity, tidyName: tidyName, titleCase: titleCase, dataAsOf: dataAsOf,
    headline: headline, fmtDate: fmtDate, isoDay: isoDay, flagLabel: flagLabel,
    isInitial: isInitial, isReinspection: isReinspection, isReopening: isReopening, isGradableType: isGradableType,
    NEVER: NEVER
  };
});
