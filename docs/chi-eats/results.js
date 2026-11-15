/* Result and risk logic for Chicago Restaurant Report Card. Pure functions, no DOM.
   Chicago has no letter grades. Each inspection has a RESULT and the establishment has a RISK category.
   Definitions come from the Chicago Department of Public Health (CDPH):
   - Inspection_FAQ_2019.pdf: Pass = no priority or priority foundation violations; Pass with Conditions =
     priority/priority foundation violations found but corrected on site; Fail = priority/priority foundation
     violations that could not be corrected during the inspection. Results usually posted within 2-3 weeks.
   - FoodProtServices-HlthCodeEnforcement-Oct2021.pdf: risk tiers (FDA model) by type of food and how it is prepared.
   - "Understand Health Code Requirements for Food Establishments": risk 1 inspected twice a year, risk 2 once a year,
     risk 3 every other year.
   Out of Business, No Entry, Not Ready and Business Not Located are not inspection outcomes; we found no official
   definition, so they are described only by their own labels. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChiResults = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var RULE_CHANGE = '2018-07-01';

  // key: css/colour key. outcome: true for the three real inspection results.
  var RESULTS = {
    pass: {
      key: 'pass', label: 'Pass', outcome: true,
      def: 'No priority or priority foundation violations were noted during the inspection.',
      phrase: 'passed its last inspection on {d}'
    },
    cond: {
      key: 'cond', label: 'Pass with Conditions', outcome: true,
      def: 'One or more priority or priority foundation violations were found, and all of them were corrected on site during the inspection.',
      phrase: 'passed with conditions at its last inspection on {d}'
    },
    fail: {
      key: 'fail', label: 'Fail', outcome: true,
      def: 'One or more priority or priority foundation violations were found that could not be corrected during the inspection.',
      phrase: 'failed its last inspection on {d}'
    },
    oob: {
      key: 'oob', label: 'Out of Business', outcome: false,
      def: 'Not an inspection result. The city recorded the business as out of business at this visit.',
      phrase: 'was recorded as “Out of Business” at the city’s last visit on {d}'
    },
    noentry: {
      key: 'noentry', label: 'No Entry', outcome: false,
      def: 'Not an inspection result. The record is labeled “No Entry”, so no inspection was completed at this visit.',
      phrase: 'had its last city visit on {d} recorded as “No Entry”'
    },
    notready: {
      key: 'notready', label: 'Not Ready', outcome: false,
      def: 'Not an inspection result. The record is labeled “Not Ready”, so no inspection was completed at this visit.',
      phrase: 'had its last city visit on {d} recorded as “Not Ready”'
    },
    notlocated: {
      key: 'notlocated', label: 'Business Not Located', outcome: false,
      def: 'Not an inspection result. The record is labeled “Business Not Located”.',
      phrase: 'had its last city visit on {d} recorded as “Business Not Located”'
    },
    other: {
      key: 'other', label: 'Other', outcome: false,
      def: 'A result label we don’t recognize. The official label is shown as published.',
      phrase: 'had its last city record on {d}'
    }
  };

  /** Raw RESULTS value -> entry in RESULTS (never null). */
  function normResult(s) {
    var t = String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (t === 'pass') return RESULTS.pass;
    if (/^pass (w\/|with) ?conditions?$/.test(t)) return RESULTS.cond;
    if (t === 'fail' || t === 'failed') return RESULTS.fail;
    if (t === 'out of business') return RESULTS.oob;
    if (t === 'no entry') return RESULTS.noentry;
    if (t === 'not ready') return RESULTS.notready;
    if (t === 'business not located') return RESULTS.notlocated;
    return RESULTS.other;
  }

  var RISK = {
    1: { level: 1, label: 'High', freq: 'inspected twice a year' },
    2: { level: 2, label: 'Medium', freq: 'inspected once a year' },
    3: { level: 3, label: 'Low', freq: 'inspected every other year' }
  };
  /** "Risk 1 (High)" -> {level:1,label:'High',freq,text}. "All" -> {level:null,label:'All'}. Unknown -> null. */
  function parseRisk(s) {
    var t = String(s || '').trim();
    if (!t) return null;
    var m = /risk\s*([123])/i.exec(t);
    if (m) { var r = RISK[m[1]]; return { level: r.level, label: r.label, freq: r.freq, text: 'Risk ' + r.level + ' (' + r.label + ')' }; }
    if (/^all$/i.test(t) || /risk\s*all/i.test(t)) return { level: null, label: 'All', freq: '', text: 'All' };
    return null;
  }
  function riskExplainer(r) {
    if (!r) return 'No risk category in the data.';
    if (!r.level) return 'The data lists the risk category as “All”. CDPH’s public pages don’t define this value.';
    return 'Risk ' + r.level + ' (' + r.label + ') reflects the kind of food served and how it is prepared, not how the place performed. CDPH says risk ' + r.level + ' establishments are ' + r.freq + '.';
  }

  /** Split the packed VIOLATIONS cell: "NN. TITLE - Comments: ..." joined by " | ". */
  function parseViolations(text) {
    var s = String(text || '').trim();
    if (!s) return [];
    var parts = s.split(/\s+\|\s+/);
    // Re-join a piece that does not start with a violation number (a stray "|" inside comments).
    var items = [];
    parts.forEach(function (p) {
      if (!items.length || /^\d{1,3}\.\s/.test(p)) items.push(p); else items[items.length - 1] += ' | ' + p;
    });
    return items.map(function (p) {
      var m = /^(\d{1,3})\.\s*([\s\S]*?)(?:\s+-\s+Comments:\s*([\s\S]*))?$/i.exec(p.trim());
      var v = m ? { num: Number(m[1]), title: m[2].trim(), comments: (m[3] || '').trim() } : { num: null, title: p.trim(), comments: '' };
      v.severity = severity(v.comments);
      v.raw = p.trim();
      return v;
    });
  }

  /** What the inspector's comment itself says about severity (post-2018 comments often name it). */
  function severity(comments) {
    var c = String(comments || '').toUpperCase().replace(/PREVIOUS\s+(PRIORITY\s+FOUNDATION|PRIORITY|CORE)/g, 'PREVIOUS');
    if (/PRIORITY\s+FOUNDATION\s+VIOLATION/.test(c)) return 'pf';
    if (/PRIORITY\s+VIOLATION/.test(c)) return 'p';
    if (/CORE\s+VIOLATION/.test(c)) return 'core';
    return null;
  }
  var SEVERITY_LABEL = { p: 'Priority', pf: 'Priority foundation', core: 'Core' };

  function isoDay(s) { return s ? String(s).slice(0, 10) : ''; }
  function fmtDate(s, long) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay(s));
    if (!m) return '';
    var mi = Number(m[2]) - 1;
    return (long ? MONTHS_LONG[mi] : MONTHS[mi]) + ' ' + Number(m[3]) + ', ' + m[1];
  }

  var SMALL = { AND: 1, OF: 1, THE: 1, AT: 1, IN: 1, ON: 1, FOR: 1, A: 1, AN: 1, TO: 1, BY: 1, 'W/': 1 };
  function titleCase(s) {
    return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim().split(' ').map(function (w, i) {
      if (i > 0 && SMALL[w.toUpperCase()]) return w;
      if (/^(\d+)(st|nd|rd|th)$/.test(w)) return w;
      if (/^[nsew]$/.test(w)) return w.toUpperCase();
      return w.replace(/(^|[\-\/(&.'])([a-z])/g, function (_, a, b) { return a + b.toUpperCase(); }).replace(/'S\b/g, "'s");
    }).join(' ');
  }
  /** DBA names are mostly upper case; title-case those, keep mixed-case ones. */
  function tidyName(s) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s && s === s.toUpperCase() ? titleCase(s) : s;
  }

  /** Rows (one per inspection) -> inspections, newest first, duplicates removed. */
  function groupInspections(rows) {
    var seen = {}, out = [];
    (rows || []).forEach(function (r) {
      var date = isoDay(r.inspection_date);
      var k = r.inspection_id ? 'id' + r.inspection_id : 'x' + date + '|' + (r.inspection_type || '') + '|' + (r.results || '') + '|' + String(r.violations || '').length;
      if (seen[k]) return;
      seen[k] = 1;
      var res = normResult(r.results);
      out.push({
        id: r.inspection_id ? String(r.inspection_id) : '',
        date: date,
        type: tidyType(r.inspection_type),
        result: res,
        rawResult: String(r.results || '').trim(),
        risk: parseRisk(r.risk),
        violations: parseViolations(r.violations),
        before2018: !!date && date < RULE_CHANGE,
        row: r
      });
    });
    out.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
    return out;
  }
  function tidyType(t) {
    t = String(t || '').trim();
    if (!t) return '';
    return t === t.toUpperCase() || t === t.toLowerCase() ? titleCase(t) : t;
  }

  /** Name, address, license from the newest row that has them. */
  function identity(rows) {
    var sorted = (rows || []).slice().sort(function (a, b) { return String(b.inspection_date || '') < String(a.inspection_date || '') ? -1 : 1; });
    function pick(f) { for (var i = 0; i < sorted.length; i++) { var v = String(sorted[i][f] || '').trim(); if (v) return v; } return ''; }
    var dba = pick('dba_name'), aka = pick('aka_name');
    var name = tidyName(aka && aka.toUpperCase() !== dba.toUpperCase() && aka.length < 40 ? aka : dba) || 'Unnamed establishment';
    return {
      name: name,
      dba: tidyName(dba),
      aka: tidyName(aka),
      rawDba: dba,
      license: pick('license_'),
      address: titleCase(pick('address')),
      rawAddress: pick('address'),
      zip: pick('zip'),
      facility: tidyType(pick('facility_type'))
    };
  }

  function addDays(day, n) {
    var t = Date.parse(day + 'T12:00:00Z');
    return isFinite(t) ? new Date(t + n * 86400000).toISOString().slice(0, 10) : '';
  }

  /**
   * Summarize inspections (newest first).
   * latest = newest record of any kind; lastOutcome = newest Pass / Pass with Conditions / Fail.
   * today (YYYY-MM-DD) is only used to word the "more than two years ago" note.
   */
  function summarize(ins, today) {
    ins = ins || [];
    var latest = ins[0] || null;
    var lastOutcome = null, risk = null;
    for (var i = 0; i < ins.length; i++) {
      if (!lastOutcome && ins[i].result.outcome) lastOutcome = ins[i];
      if (!risk && ins[i].risk) risk = ins[i].risk;
    }
    var counts = { pass: 0, cond: 0, fail: 0, other: 0 };
    ins.forEach(function (x) { if (counts[x.result.key] !== undefined) counts[x.result.key]++; else counts.other++; });

    var notes = [];
    if (latest && !latest.result.outcome && lastOutcome) {
      notes.push({ kind: 'nonoutcome', text: 'The newest record (' + fmtDate(latest.date) + ') is “' + (latest.rawResult || latest.result.label) + '”, which is not an inspection result. The last completed inspection, on ' + fmtDate(lastOutcome.date) + ', was ' + lastOutcome.result.label + '.' });
    }
    if (latest && latest.result.key === 'oob') {
      notes.push({ kind: 'oob', text: 'The city recorded this business as Out of Business on ' + fmtDate(latest.date) + '. It may have closed, moved or changed owners (a new owner gets a new license, which shows up as a separate listing).' });
    }
    if (latest && latest.result.key === 'fail') {
      notes.push({ kind: 'fail', text: 'After a failed inspection, CDPH re-inspects once the establishment has had time to correct the violations. No later inspection appears in the data yet; results are usually posted within 2–3 weeks of an inspection.' });
    }
    if (lastOutcome && lastOutcome.before2018) {
      notes.push({ kind: 'old-rules', text: 'The last completed inspection was before July 1, 2018, when Chicago changed its inspection procedures and violation list, so it was judged under the older rules.' });
    }
    if (lastOutcome && today && lastOutcome.date < addDays(today, -730)) {
      notes.push({ kind: 'stale', text: 'The last completed inspection was more than two years ago.' });
    }
    return { latest: latest, lastOutcome: lastOutcome, risk: risk, counts: counts, total: ins.length, notes: notes };
  }

  /** "passed its last inspection on Oct 2, 2026" (lower-case, no name). Based on the newest record. */
  function phrase(sum) {
    var l = sum && sum.latest;
    if (!l) return 'has no inspection records in the data';
    return l.result.phrase.replace('{d}', fmtDate(l.date));
  }
  function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  /** Sentence used on the card and in share text. */
  function headline(name, sum) { return (name || 'This restaurant') + ' ' + phrase(sum) + '.'; }

  /** Counts for the history header: "12 inspections since 2016: 8 Pass, 3 Pass with Conditions, 1 Fail". */
  function countsLine(sum, ins) {
    if (!ins || !ins.length) return '';
    var first = ins[ins.length - 1].date.slice(0, 4);
    var parts = [];
    if (sum.counts.pass) parts.push(sum.counts.pass + ' Pass');
    if (sum.counts.cond) parts.push(sum.counts.cond + ' Pass with Conditions');
    if (sum.counts.fail) parts.push(sum.counts.fail + ' Fail');
    if (sum.counts.other) parts.push(sum.counts.other + ' other record' + (sum.counts.other === 1 ? '' : 's'));
    return ins.length + ' record' + (ins.length === 1 ? '' : 's') + ' since ' + first + ': ' + parts.join(', ') + '.';
  }

  return {
    RESULTS: RESULTS, RISK: RISK, RULE_CHANGE: RULE_CHANGE, SEVERITY_LABEL: SEVERITY_LABEL,
    normResult: normResult, parseRisk: parseRisk, riskExplainer: riskExplainer,
    parseViolations: parseViolations, severity: severity,
    isoDay: isoDay, fmtDate: fmtDate, titleCase: titleCase, tidyName: tidyName, tidyType: tidyType,
    groupInspections: groupInspections, identity: identity, summarize: summarize,
    phrase: phrase, capFirst: capFirst, headline: headline, countsLine: countsLine, addDays: addDays
  };
});
