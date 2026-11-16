/* Awards-Night Ballot Pool: core model (no DOM). Show files, picks, results, scoring, tiebreaks and awards.
 * Loaded in the page (window.Ballot) and in node tests (require).
 *
 * Show file (docs/ballot/shows/<id>.json):
 *   { id, rev, name, short, about, demo?, ceremony (ISO time, = default lock), ceremonyLabel, nominations (YYYY-MM-DD),
 *     nominationsLabel, resultsUrl (https), sources: [{label, url}], tiebreakers: [{id, q, min, max}],
 *     categories: [{ id, name, group?, weight (1-5), nominees: [{ name, note? }] }] }
 *   A show is "open" for ballots once every category has at least 2 nominees.
 * Results file (docs/ballot/results/<id>.json):
 *   { show, updated, final, winners: { <category id>: "Nominee name" | ["tie", "names"] }, tiebreak: { <tiebreaker id>: number } }
 * Picks: one number per category, the nominee index, or -1 for no pick. In links: one base-36 char each ('0' = none).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Ballot = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIM = { categories: 60, nominees: 30, name: 80, note: 80, tbMax: 100000 };

  function clean(s, max) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f\u2028\u2029~]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 60);
  }
  function norm(s) { return clean(s, 200).toLowerCase(); }

  // ---------- show files ----------
  // -> { ok, errors: [..], show } (show is a normalized copy; only when ok)
  function validateShow(j) {
    var errs = [];
    function err(m) { if (errs.length < 40) errs.push(m); }
    if (!j || typeof j !== 'object' || Array.isArray(j)) return { ok: false, errors: ['not an object'] };
    if (!/^[a-z0-9-]{1,32}$/.test(j.id || '')) err('id must be 1-32 chars a-z, 0-9, -');
    if (!(Number.isInteger(j.rev) && j.rev >= 1 && j.rev < 1296)) err('rev must be an integer 1-1295');
    if (!clean(j.name, LIM.name)) err('name is missing');
    var t = j.ceremony == null ? NaN : Date.parse(j.ceremony);
    if (j.ceremony != null && (typeof j.ceremony !== 'string' || !/[zZ]|[+-]\d\d:\d\d$/.test(j.ceremony) || !isFinite(t))) err('ceremony must be an ISO time with a zone, or null');
    if (j.nominations != null && !/^\d{4}-\d\d-\d\d$/.test(j.nominations)) err('nominations must be YYYY-MM-DD');
    if (j.resultsUrl != null && !/^https:\/\/[^\s"<>]+$/.test(j.resultsUrl)) err('resultsUrl must be https');
    (j.sources || []).forEach(function (s, i) { if (!s || !/^https:\/\/[^\s"<>]+$/.test(s.url || '') || !clean(s.label)) err('sources[' + i + '] needs label and https url'); });
    var tbs = [];
    if (j.tiebreakers != null && !Array.isArray(j.tiebreakers)) err('tiebreakers must be a list');
    (Array.isArray(j.tiebreakers) ? j.tiebreakers : []).forEach(function (q, i) {
      if (!q || !/^[a-z0-9-]{1,16}$/.test(q.id || '') || q.id === 'custom' || !clean(q.q, 120)) { err('tiebreakers[' + i + '] needs id and q'); return; }
      if (tbs.some(function (x) { return x.id === q.id; })) err('duplicate tiebreaker ' + q.id);
      tbs.push({ id: q.id, q: clean(q.q, 120), min: Number.isFinite(q.min) ? q.min : 0, max: Number.isFinite(q.max) ? q.max : LIM.tbMax });
    });
    var cats = [];
    if (!Array.isArray(j.categories) || !j.categories.length) err('categories must be a non-empty list');
    else if (j.categories.length > LIM.categories) err('too many categories (max ' + LIM.categories + ')');
    else j.categories.forEach(function (c, i) {
      var where = 'categories[' + i + ']';
      if (!c || typeof c !== 'object') { err(where + ' is not an object'); return; }
      if (!/^[a-z0-9-]{1,24}$/.test(c.id || '')) err(where + ' id must be 1-24 chars a-z, 0-9, -');
      else if (cats.some(function (x) { return x.id === c.id; })) err('duplicate category id ' + c.id);
      if (!clean(c.name, LIM.name)) err(where + ' name is missing');
      var w = c.weight == null ? 1 : c.weight;
      if (!(Number.isInteger(w) && w >= 1 && w <= 5)) err(where + ' weight must be 1-5');
      if (!Array.isArray(c.nominees)) { err(where + ' nominees must be a list'); return; }
      if (c.nominees.length > LIM.nominees) err(where + ' has too many nominees');
      var noms = [];
      c.nominees.forEach(function (n, k) {
        var nm = typeof n === 'string' ? n : n && n.name;
        if (!clean(nm, LIM.name)) { err(where + '.nominees[' + k + '] name is missing'); return; }
        if (noms.some(function (x) { return norm(x.name) === norm(nm); })) err(where + ' duplicate nominee ' + clean(nm, LIM.name));
        noms.push({ name: clean(nm, LIM.name), note: clean(typeof n === 'object' ? n.note : '', LIM.note) });
      });
      if (noms.length === 1) err(where + ' has only one nominee');
      cats.push({ id: c.id, name: clean(c.name, LIM.name), group: clean(c.group, 40), weight: w, nominees: noms });
    });
    var lens = cats.map(function (c) { return c.nominees.length; });
    if (lens.some(function (n) { return n > 0; }) && lens.some(function (n) { return n === 0; })) err('some categories have nominees and some do not');
    if (errs.length) return { ok: false, errors: errs };
    return { ok: true, errors: [], show: {
      id: j.id, rev: j.rev, name: clean(j.name, LIM.name), short: clean(j.short || j.name, 40), about: clean(j.about, 300), demo: !!j.demo,
      ceremony: isFinite(t) ? t : 0, ceremonyLabel: clean(j.ceremonyLabel, 80), nominations: j.nominations || '', nominationsLabel: clean(j.nominationsLabel, 60),
      resultsUrl: j.resultsUrl || '', sources: (j.sources || []).map(function (s) { return { label: clean(s.label, 80), url: s.url }; }),
      tiebreakers: tbs, categories: cats
    } };
  }
  function isOpen(show) { return !!show && show.categories.every(function (c) { return c.nominees.length >= 2; }); }
  // 'soon' (nominations date in the future), 'pending' (date passed, nominees not added yet), 'open', 'over' (after the ceremony)
  function status(show, now) {
    now = now == null ? Date.now() : now;
    if (!isOpen(show)) {
      var nd = show.nominations ? Date.parse(show.nominations + 'T23:59:59Z') : 0;
      return nd && now > nd ? 'pending' : 'soon';
    }
    return show.ceremony && now > show.ceremony + 6 * 3600e3 ? 'over' : 'open';
  }

  // ---------- picks ----------
  var B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
  function emptyPicks(show) { return show.categories.map(function () { return -1; }); }
  function packPicks(picks) { return picks.map(function (p) { return B36.charAt(p < 0 ? 0 : p + 1); }).join(''); }
  function unpackPicks(s) {
    if (!/^[0-9a-z]{0,60}$/.test(s || '')) return null;
    return s.split('').map(function (c) { return B36.indexOf(c) - 1; });
  }
  function validPicks(show, picks) {
    return Array.isArray(picks) && picks.length === show.categories.length && picks.every(function (p, i) {
      return p === -1 || (Number.isInteger(p) && p >= 0 && p < show.categories[i].nominees.length);
    });
  }
  function countPicked(picks) { return picks.filter(function (p) { return p >= 0; }).length; }

  // ---------- results ----------
  // -> { won: [null | [nominee ix...]] per category, decided, total, tb: {id: n}, updated, final }
  function readResults(show, j) {
    var won = show.categories.map(function () { return null; }), tb = {};
    var w = j && j.winners && typeof j.winners === 'object' ? j.winners : {};
    show.categories.forEach(function (c, ci) {
      var v = w[c.id];
      if (v == null || v === '') return;
      var names = Array.isArray(v) ? v : [v], ix = [];
      names.forEach(function (n) {
        var k = c.nominees.findIndex(function (x) { return norm(x.name) === norm(n); });
        if (k >= 0 && ix.indexOf(k) < 0) ix.push(k);
      });
      if (ix.length) won[ci] = ix;
    });
    if (j && j.tiebreak && typeof j.tiebreak === 'object') {
      Object.keys(j.tiebreak).forEach(function (k) { var n = j.tiebreak[k]; if (typeof n === 'number' && isFinite(n)) tb[k] = n; });
    }
    var decided = won.filter(Boolean).length;
    return { won: won, decided: decided, total: show.categories.length, tb: tb, updated: clean(j && j.updated, 60), final: !!(j && j.final) || decided === show.categories.length };
  }
  function noResults(show) { return readResults(show, null); }

  // ---------- scoring ----------
  function weight(show, rules, ci) { return rules === 'weighted' ? show.categories[ci].weight : 1; }
  function maxPoints(show, rules) { var s = 0; show.categories.forEach(function (c, i) { s += weight(show, rules, i); }); return s; }
  // -> { points, correct, decided, possible (max still reachable) }
  function score(show, rules, picks, R) {
    var points = 0, correct = 0, possible = 0;
    show.categories.forEach(function (c, ci) {
      var w = weight(show, rules, ci), p = picks[ci], won = R.won[ci];
      if (won) { if (p >= 0 && won.indexOf(p) >= 0) { points += w; correct++; } }
      else if (p >= 0) possible += w;
    });
    return { points: points, correct: correct, decided: R.decided, possible: points + possible };
  }
  // The tiebreak answer for this pool: a preset from the results file, or the host's own (custom question).
  function tbAnswer(pool, R, hostAnswer) {
    if (!pool.tbKey) return null;
    if (pool.tbKey === 'custom') return hostAnswer == null || hostAnswer === '' || !isFinite(+hostAnswer) ? null : +hostAnswer;
    return R.tb[pool.tbKey] == null ? null : R.tb[pool.tbKey];
  }
  function tbQuestion(pool, show) {
    if (!pool.tbKey) return '';
    if (pool.tbKey === 'custom') return pool.tbQ || 'Tiebreaker';
    var q = show && show.tiebreakers.filter(function (t) { return t.id === pool.tbKey; })[0];
    return q ? q.q : (pool.tbQ || 'Tiebreaker');
  }
  // entries: [{ name, picks, tb, ok, late, ... }] -> rows sorted, with rank (ties share a rank)
  // Order: points, then closest tiebreak guess (no guess = last), then more correct picks... then name.
  function standings(show, pool, entries, R, hostAnswer) {
    var ans = tbAnswer(pool, R, hostAnswer);
    var rows = entries.map(function (e, ix) {
      var s = score(show, pool.rules, e.picks, R);
      var off = ans == null || e.tb == null ? null : Math.abs(e.tb - ans);
      return { ix: ix, entry: e, score: s, off: off };
    });
    // edited links (checksum mismatch) are listed last and get no rank
    function cmp(a, b) {
      var ae = a.entry.ok === false, be = b.entry.ok === false;
      if (ae !== be) return ae ? 1 : -1;
      if (b.score.points !== a.score.points) return b.score.points - a.score.points;
      if (ans != null) {
        var ao = a.off == null ? Infinity : a.off, bo = b.off == null ? Infinity : b.off;
        if (ao !== bo) return ao - bo;
      }
      return 0;
    }
    rows.sort(function (a, b) { return cmp(a, b) || (a.entry.name < b.entry.name ? -1 : a.entry.name > b.entry.name ? 1 : a.ix - b.ix); });
    rows.forEach(function (r, i) { r.rank = r.entry.ok === false ? null : i && cmp(rows[i - 1], r) === 0 ? rows[i - 1].rank : i + 1; });
    return { rows: rows, answer: ans };
  }

  // ---------- pool consensus and awards ----------
  // share[ci][k] = fraction of entries that picked nominee k in category ci
  function consensus(show, entries) {
    return show.categories.map(function (c, ci) {
      var counts = c.nominees.map(function () { return 0; }), n = 0;
      entries.forEach(function (e) { if (e.picks[ci] >= 0) { counts[e.picks[ci]]++; n++; } });
      return { counts: counts, n: n, share: counts.map(function (x) { return n ? x / n : 0; }) };
    });
  }
  // Awards are given only to entries whose checksum is fine. Needs 2+ entries; Upset caller needs results.
  // -> [{ id, title, name, stat, blurb, row }]
  function awards(show, pool, st, R, entries) {
    var rows = st.rows.filter(function (r) { return r.entry.ok !== false; });
    if (rows.length < 2) return [];
    var cons = consensus(show, rows.map(function (r) { return r.entry; })), out = [], word = R.final ? '' : ' so far';
    if (R.decided) {
      var top = rows[0];
      out.push({ id: 'oracle', title: 'The Oracle', name: top.entry.name, row: top,
        stat: top.score.correct + ' of ' + R.decided + ' categories right' + word,
        blurb: R.final ? 'Saw it all coming. Top of the pool.' : 'Leading the pool' + (rows[1] && rows[1].score.points === top.score.points ? ' (tied)' : '') + ' with ' + top.score.points + ' point' + (top.score.points === 1 ? '' : 's') + '.' });
      // Upset caller: the correct pick the fewest people in the pool made
      var best = null;
      rows.forEach(function (r) {
        show.categories.forEach(function (c, ci) {
          var p = r.entry.picks[ci], won = R.won[ci];
          if (!won || p < 0 || won.indexOf(p) < 0) return;
          var cnt = cons[ci].counts[p], sh = cons[ci].share[p];
          if (sh >= 0.5) return;
          if (!best || sh < best.sh || (sh === best.sh && c.weight > show.categories[best.ci].weight) || (sh === best.sh && c.weight === show.categories[best.ci].weight && r.score.points > best.r.score.points)) best = { r: r, ci: ci, p: p, cnt: cnt, sh: sh };
        });
      });
      if (best) {
        var c = show.categories[best.ci], n = cons[best.ci].n;
        out.push({ id: 'upset', title: 'Upset Caller', name: best.r.entry.name, row: best.r,
          stat: 'Called ' + c.nominees[best.p].name + ' for ' + c.name,
          blurb: best.cnt === 1 ? 'The only one of ' + n + ' in the pool who saw it coming.' : 'Only ' + best.cnt + ' of ' + n + ' in the pool saw it coming.' });
      }
    }
    // Contrarian: lowest average agreement with the rest of the pool (needs 3+ to mean anything)
    if (rows.length >= 3) {
      var worst = null;
      rows.forEach(function (r) {
        var tot = 0, k = 0;
        show.categories.forEach(function (c, ci) {
          var p = r.entry.picks[ci]; if (p < 0 || cons[ci].n < 2) return;
          tot += (cons[ci].counts[p] - 1) / (cons[ci].n - 1); k++;
        });
        if (!k) return;
        var avg = tot / k;
        if (!worst || avg < worst.avg) worst = { r: r, avg: avg, k: k };
      });
      if (worst) {
        var lone = 0;
        show.categories.forEach(function (c, ci) { var p = worst.r.entry.picks[ci]; if (p >= 0 && cons[ci].counts[p] === 1 && cons[ci].n >= 2) lone++; });
        out.push({ id: 'contrarian', title: 'The Contrarian', name: worst.r.entry.name, row: worst.r,
          stat: lone ? lone + ' pick' + (lone === 1 ? '' : 's') + ' nobody else in the pool made' : 'Agreed with the pool just ' + Math.round(worst.avg * 100) + '% of the time',
          blurb: 'Went their own way. Agreed with the pool on ' + Math.round(worst.avg * 100) + '% of picks.' });
      }
    }
    return out;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  return {
    LIM: LIM, clean: clean, norm: norm, validateShow: validateShow, isOpen: isOpen, status: status,
    emptyPicks: emptyPicks, packPicks: packPicks, unpackPicks: unpackPicks, validPicks: validPicks, countPicked: countPicked,
    readResults: readResults, noResults: noResults, weight: weight, maxPoints: maxPoints, score: score,
    tbAnswer: tbAnswer, tbQuestion: tbQuestion, standings: standings, consensus: consensus, awards: awards, clone: clone
  };
});
