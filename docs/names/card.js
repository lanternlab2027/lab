/* Baby Name Report Card: the 1080x1350 share card (canvas, no libraries). */
(function () {
  'use strict';
  var S = window.NameStats;
  var SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, Cambria, serif';
  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var W = 1080, H = 1350;
  var C = { bg: '#f6f0e2', paper: '#fffdf7', ink: '#1f2430', muted: '#5d6170', navy: '#23345c', red: '#b8323a', F: '#b5446e', M: '#2f6db5', alt: '#b07d0e' };
  var STAMP = { rising: '#2e7d4f', revival: '#8a5a00', classic: C.navy, steady: C.muted, falling: C.red };

  function fit(x, text, max, size, weight, font) {
    var s = size; x.font = weight + ' ' + s + 'px ' + font;
    while (x.measureText(text).width > max && s > 20) { s -= 4; x.font = weight + ' ' + s + 'px ' + font; }
    return s;
  }
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

  function frame(x) {
    x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
    x.fillStyle = C.paper; rr(x, 48, 48, W - 96, H - 96, 34); x.fill();
    x.strokeStyle = 'rgba(31,36,48,.16)'; x.lineWidth = 2; x.stroke();
    // ruled header band
    x.fillStyle = C.navy; rr(x, 48, 48, W - 96, 120, 34); x.fill(); x.fillRect(48, 120, W - 96, 48);
    x.fillStyle = '#fff'; x.font = '800 30px ' + SANS; x.letterSpacing = '8px'; x.fillText('BABY NAME REPORT CARD', 96, 122); x.letterSpacing = '0px';
    // footer
    x.fillStyle = C.navy; x.fillRect(48, H - 160, W - 96, 2);
    x.fillStyle = C.ink; x.font = '700 34px ' + SANS; x.fillText('Make yours: lanternlab2027.github.io/lab/names', 96, H - 102);
    x.fillStyle = C.muted; x.font = '500 22px ' + SANS; x.fillText('Source: U.S. Social Security Administration. Not affiliated.', 96, H - 66);
  }

  function chart(x, series, first, box) {
    var max = 0; series.forEach(function (s) { s.values.forEach(function (v) { if (v > max) max = v; }); });
    var top = S.niceMax(max), n = series[0].values.length;
    x.strokeStyle = 'rgba(31,36,48,.12)'; x.lineWidth = 2;
    for (var g = 0; g <= 2; g++) { var yy = box.y + box.h * g / 2; x.beginPath(); x.moveTo(box.x, yy); x.lineTo(box.x + box.w, yy); x.stroke(); }
    x.fillStyle = C.muted; x.font = '600 22px ' + SANS;
    [first, 1950, first + n - 1].forEach(function (yr, i) { x.textAlign = ['left', 'center', 'right'][i]; x.fillText(String(yr), box.x + box.w * (yr - first) / (n - 1), box.y + box.h + 34); });
    x.textAlign = 'left';
    series.forEach(function (s) {
      x.beginPath();
      s.values.forEach(function (v, i) { var px = box.x + box.w * i / (n - 1), py = box.y + box.h * (1 - v / top); if (i) x.lineTo(px, py); else x.moveTo(px, py); });
      x.strokeStyle = s.color; x.lineWidth = 7; x.lineJoin = 'round'; x.stroke();
      if (s.mark != null) {
        var i = s.mark - first, px2 = box.x + box.w * i / (n - 1), py2 = box.y + box.h * (1 - s.values[i] / top);
        x.fillStyle = s.color; x.beginPath(); x.arc(px2, py2, 13, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 5; x.stroke();
      }
    });
  }

  function statBox(x, bx, by, w, h, big, small, color) {
    x.fillStyle = '#fff'; rr(x, bx, by, w, h, 20); x.fill(); x.strokeStyle = 'rgba(31,36,48,.16)'; x.lineWidth = 2; x.stroke();
    x.fillStyle = color || C.navy; fit(x, big, w - 40, 56, '800', SANS); x.fillText(big, bx + 22, by + 70);
    x.fillStyle = C.muted; fit(x, small, w - 40, 24, '600', SANS); x.fillText(small, bx + 22, by + 110);
  }

  function headline(rep) {
    var p = rep.sexes[rep.primary];
    var now = p.rank ? 'now #' + S.fmt(p.rank) : 'unranked in ' + rep.latest;
    return (rep.peak.year === rep.latest ? 'Peaking now (' + rep.latest + ')' : 'Peaked in ' + rep.peak.year) + ' \u00b7 ' + now;
  }

  function drawOne(canvas, rep) {
    var x = canvas.getContext('2d'); frame(x);
    var p = rep.sexes[rep.primary];
    x.fillStyle = C.navy; fit(x, rep.name, W - 200, 170, '700', SERIF); x.fillText(rep.name, 96, 360);
    x.fillStyle = C.red; fit(x, headline(rep), W - 200, 52, '800', SANS); x.fillText(headline(rep), 98, 440);
    var series = [{ values: p.share, color: C[rep.primary], mark: rep.peak.year }];
    chart(x, series, rep.first, { x: 100, y: 500, w: W - 200, h: 320 });
    var bw = (W - 192 - 32) / 3, by = 900;
    statBox(x, 96, by, bw, 140, S.fmt(rep.latestCount), 'babies in ' + rep.latest);
    statBox(x, 96 + bw + 16, by, bw, 140, rep.trend.label, 'trend', STAMP[rep.trend.key]);
    statBox(x, 96 + 2 * (bw + 16), by, bw, 140, '1 in ' + S.fmt(rep.peak.oneIn), S.SEX_WORD[rep.primary] + ' at its peak');
    x.fillStyle = C.ink; x.font = '600 30px ' + SANS;
    var line = rep.sameYear ? S.fmt(rep.sameYear) + ' others born in ' + rep.latest + ' share it.' : 'The only one recorded in ' + rep.latest + '.';
    if (!rep.latestCount) line = 'Not given to 5+ babies of one sex in ' + rep.latest + '.';
    fit(x, line, W - 200, 30, '600', SANS); x.fillText(line, 98, 1110);
  }

  function drawTwo(canvas, a, b) {
    var x = canvas.getContext('2d'); frame(x);
    var title = a.name + ' vs ' + b.name;
    var s = fit(x, title, W - 200, 130, '700', SERIF);
    x.fillStyle = C.navy; x.font = '700 ' + s + 'px ' + SERIF; x.fillText(a.name, 96, 340);
    var wa = x.measureText(a.name + ' ').width; x.fillStyle = C.red; x.font = 'italic 700 ' + s + 'px ' + SERIF; x.fillText('vs', 96 + wa, 340);
    var wv = x.measureText('vs ').width; x.fillStyle = C.alt; x.font = '700 ' + s + 'px ' + SERIF; x.fillText(b.name, 96 + wa + wv, 340);
    chart(x, [
      { values: a.sexes[a.primary].share, color: C.navy, mark: a.peak.year },
      { values: b.sexes[b.primary].share, color: C.alt, mark: b.peak.year }
    ], a.first, { x: 100, y: 420, w: W - 200, h: 360 });
    var bw = (W - 192 - 16) / 2;
    [[a, C.navy, 96], [b, C.alt, 96 + bw + 16]].forEach(function (t) {
      var r = t[0], p = r.sexes[r.primary];
      statBox(x, t[2], 860, bw, 140, p.rank ? '#' + S.fmt(p.rank) : 'Unranked', r.name + ' in ' + r.latest, t[1]);
      statBox(x, t[2], 1016, bw, 140, String(r.peak.year), r.name + ' peak year \u00b7 ' + r.trend.label.toLowerCase(), t[1]);
    });
  }

  window.NameCard = { drawOne: drawOne, drawTwo: drawTwo, headline: headline, W: W, H: H };
})();
