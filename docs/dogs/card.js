/* NYC Dog Name Report Card: the 1080x1350 share card (canvas, no libraries). */
(function () {
  'use strict';
  var S = window.DogStats;
  var SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, Cambria, serif';
  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var W = 1080, H = 1350;
  var C = { bg: '#f3efe4', paper: '#fffdf8', ink: '#1d2422', muted: '#58615d', green: '#1f4d3f', orange: '#c4521f', tag: '#e2a12b' };

  function fit(x, text, max, size, weight, font) {
    var s = size; x.font = weight + ' ' + s + 'px ' + font;
    while (x.measureText(text).width > max && s > 18) { s -= 4; x.font = weight + ' ' + s + 'px ' + font; }
    return s;
  }
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

  function frame(x) {
    x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
    x.fillStyle = C.paper; rr(x, 48, 48, W - 96, H - 96, 34); x.fill();
    x.strokeStyle = 'rgba(29,36,34,.16)'; x.lineWidth = 2; x.stroke();
    x.fillStyle = C.green; rr(x, 48, 48, W - 96, 120, 34); x.fill(); x.fillRect(48, 120, W - 96, 48);
    x.fillStyle = '#fff'; x.font = '800 30px ' + SANS; x.letterSpacing = '8px'; x.fillText('NYC DOG NAME REPORT CARD', 96, 122); x.letterSpacing = '0px';
    // license tag
    x.save(); x.translate(930, 108); x.rotate(-0.18);
    x.fillStyle = C.tag; x.beginPath(); x.arc(0, 0, 44, 0, 7); x.fill();
    x.fillStyle = C.green; x.beginPath(); x.arc(0, -28, 7, 0, 7); x.fill();
    x.fillStyle = C.green; x.font = '900 22px ' + SANS; x.textAlign = 'center'; x.fillText('NYC', 0, 8); x.font = '800 12px ' + SANS; x.fillText('LICENSED', 0, 26); x.textAlign = 'left';
    x.restore();
    x.fillStyle = C.green; x.fillRect(48, H - 160, W - 96, 2);
    x.fillStyle = C.ink; x.font = '700 34px ' + SANS; x.fillText('Make yours: lanternlab2027.github.io/lab/dogs', 96, H - 102);
    x.fillStyle = C.muted; fit(x, 'NYC DOHMH dog license data. Licensed dogs only. Not affiliated with NYC.', W - 192, 22, '500', SANS);
    x.fillText('NYC DOHMH dog license data. Licensed dogs only. Not affiliated with NYC.', 96, H - 66);
  }

  function chart(x, values, years, mark, box) {
    var max = 0; values.forEach(function (v) { if (v > max) max = v; });
    var top = S.niceMax(max), n = values.length;
    x.strokeStyle = 'rgba(29,36,34,.12)'; x.lineWidth = 2;
    for (var g = 0; g <= 2; g++) { var yy = box.y + box.h * g / 2; x.beginPath(); x.moveTo(box.x, yy); x.lineTo(box.x + box.w, yy); x.stroke(); }
    x.fillStyle = C.muted; x.font = '600 22px ' + SANS;
    [0, Math.floor((n - 1) / 2), n - 1].forEach(function (i, k) { x.textAlign = ['left', 'center', 'right'][k]; x.fillText(String(years[i]), box.x + box.w * i / (n - 1), box.y + box.h + 34); });
    x.textAlign = 'left';
    var px = function (i) { return box.x + box.w * i / (n - 1); }, py = function (v) { return box.y + box.h * (1 - v / top); };
    x.beginPath(); values.forEach(function (v, i) { if (i) x.lineTo(px(i), py(v)); else x.moveTo(px(i), py(v)); });
    x.strokeStyle = C.green; x.lineWidth = 7; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke();
    var mi = years.indexOf(mark);
    if (mi >= 0) { x.fillStyle = C.orange; x.beginPath(); x.arc(px(mi), py(values[mi]), 14, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 5; x.stroke(); }
  }

  function statBox(x, bx, by, w, h, big, small, color) {
    x.fillStyle = '#fff'; rr(x, bx, by, w, h, 20); x.fill(); x.strokeStyle = 'rgba(29,36,34,.16)'; x.lineWidth = 2; x.stroke();
    x.fillStyle = color || C.green; fit(x, big, w - 40, 50, '800', SANS); x.fillText(big, bx + 22, by + 68);
    x.fillStyle = C.muted; fit(x, small, w - 40, 24, '600', SANS); x.fillText(small, bx + 22, by + 108);
  }

  function headline(rec) { return 'There are ' + S.fmt(rec.t) + ' licensed dogs named ' + rec.n + ' in NYC'; }

  function draw(canvas, rec, meta) {
    var x = canvas.getContext('2d'); frame(x);
    var pk = S.peak(rec, meta), tr = S.trend(rec, meta), bo = S.boroLine(rec), br = rec.br[0];
    x.fillStyle = C.ink; x.font = '600 46px ' + SANS; x.fillText('There are', 98, 262);
    x.fillStyle = C.orange; fit(x, S.fmt(rec.t), W - 200, 200, '700', SERIF); x.fillText(S.fmt(rec.t), 92, 430);
    x.fillStyle = C.ink; x.font = '600 46px ' + SANS; x.fillText('licensed dogs named', 98, 500);
    x.fillStyle = C.green; fit(x, rec.n, W - 200, 130, '700', SERIF); x.fillText(rec.n, 92, 625);
    x.fillStyle = C.ink; x.font = '600 46px ' + SANS; x.fillText('in New York City.', 98, 690);
    chart(x, S.shares(rec, meta), meta.years, pk.year, { x: 100, y: 740, w: W - 200, h: 170 });
    var bw = (W - 192 - 32) / 3, by = 970;
    statBox(x, 96, by, bw, 130, '#' + S.fmt(rec.r), 'name among NYC dogs');
    statBox(x, 96 + bw + 16, by, bw, 130, br ? br[0] : '\u2014', 'most common breed');
    statBox(x, 96 + 2 * (bw + 16), by, bw, 130, bo ? bo.title : '\u2014', 'top borough');
    var line = (rec.z1 && rec.z1.length ? '#1 name in ' + rec.z1.length + ' NYC ZIP code' + (rec.z1.length > 1 ? 's' : '') + ' \u00b7 ' : '') + 'peaked in ' + pk.year + ' \u00b7 ' + tr.label.toLowerCase();
    x.fillStyle = C.ink; fit(x, line, W - 200, 32, '700', SANS); x.fillText(line, 98, 1150);
  }

  window.DogCard = { draw: draw, headline: headline, W: W, H: H };
})();
