/* Snow Day Odds: the 1080x1350 share card (canvas, no libraries). Also draws the 1200x630 OG image. */
(function () {
  'use strict';
  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var C = { sky0: '#0b1a33', sky1: '#1d3a66', snow: '#ffffff', ice: '#9fd3ff', muted: '#b9c8e0', hot: '#ffd166' };

  function fit(x, text, max, size, weight, min) {
    var s = size; x.font = weight + ' ' + s + 'px ' + SANS;
    while (x.measureText(text).width > max && s > (min || 20)) { s -= 2; x.font = weight + ' ' + s + 'px ' + SANS; }
    return s;
  }
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  // Deterministic flakes so the card is the same every time.
  function flakes(x, W, H, n, seed) {
    var s = seed || 7;
    function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    for (var i = 0; i < n; i++) {
      var r = 2 + rnd() * 6;
      x.globalAlpha = 0.15 + rnd() * 0.45; x.fillStyle = C.snow;
      x.beginPath(); x.arc(rnd() * W, rnd() * H, r, 0, 7); x.fill();
    }
    x.globalAlpha = 1;
  }
  function sky(x, W, H) {
    var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.sky0); g.addColorStop(1, C.sky1);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  function drift(x, W, H, h) { // snow bank along the bottom
    x.fillStyle = '#eef5ff'; x.beginPath(); x.moveTo(0, H);
    x.lineTo(0, H - h * 0.7);
    x.bezierCurveTo(W * 0.2, H - h * 1.15, W * 0.35, H - h * 0.55, W * 0.55, H - h * 0.85);
    x.bezierCurveTo(W * 0.75, H - h * 1.15, W * 0.88, H - h * 0.6, W, H - h * 0.9);
    x.lineTo(W, H); x.closePath(); x.fill();
  }
  function meter(x, cx, cy, r, pct) {
    x.lineCap = 'round'; x.lineWidth = 34;
    x.strokeStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); x.stroke();
    x.strokeStyle = pct >= 50 ? C.hot : C.ice; x.beginPath(); x.arc(cx, cy, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * Math.max(0.01, pct / 100))); x.stroke();
  }

  // d: { place, dateText, chance, label, reasons[] }
  function draw(canvas, d) {
    var W = 1080, H = 1350; canvas.width = W; canvas.height = H;
    var x = canvas.getContext('2d');
    sky(x, W, H); flakes(x, W, H, 140, 11);
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.fillStyle = C.ice; x.font = '800 30px ' + SANS; x.letterSpacing = '8px'; x.fillText('SNOW DAY ODDS', 80, 118); x.letterSpacing = '0px';
    x.fillStyle = C.snow; fit(x, d.place || 'Your town', W - 160, 76, '900', 36); x.fillText(d.place || 'Your town', 80, 210);
    x.fillStyle = C.muted; fit(x, d.dateText, W - 160, 38, '600'); x.fillText(d.dateText, 80, 266);

    var cx = W / 2, cy = 590;
    meter(x, cx, cy, 250, d.chance);
    x.textAlign = 'center'; x.fillStyle = C.snow;
    var num = String(d.chance);
    x.font = '900 230px ' + SANS; var nw = x.measureText(num).width;
    x.font = '900 100px ' + SANS; var pw = x.measureText('%').width;
    var left = cx - (nw + pw) / 2;
    x.textAlign = 'left'; x.font = '900 230px ' + SANS; x.fillText(num, left, cy + 70);
    x.font = '900 100px ' + SANS; x.fillText('%', left + nw, cy + 70);
    x.textAlign = 'center'; x.fillStyle = C.muted; x.font = '700 34px ' + SANS; x.fillText('snow-day chance', cx, cy + 135);
    x.fillStyle = d.chance >= 50 ? C.hot : C.ice; fit(x, d.label, W - 200, 52, '900'); x.fillText(d.label, cx, cy + 278);

    // reasons
    x.textAlign = 'left';
    var y = 950;
    (d.reasons || []).slice(0, 2).forEach(function (r) {
      x.fillStyle = 'rgba(255,255,255,.10)'; rr(x, 80, y, W - 160, 92, 24); x.fill();
      x.fillStyle = C.ice; x.beginPath(); x.arc(126, y + 46, 10, 0, 7); x.fill();
      x.fillStyle = C.snow; fit(x, r, W - 260, 38, '700', 24); x.fillText(r, 156, y + 59);
      y += 112;
    });

    drift(x, W, H, 190);
    x.textAlign = 'center';
    x.fillStyle = C.sky0; x.font = '800 36px ' + SANS; x.fillText('Make yours: lanternlab2027.github.io/lab/snow', cx, H - 86);
    x.fillStyle = '#41577a'; x.font = '600 23px ' + SANS; x.fillText('Just for fun. Only your school district decides. NWS forecast data.', cx, H - 44);
    x.textAlign = 'left';
    return canvas;
  }

  function drawOg(canvas, d) {
    var W = 1200, H = 630; canvas.width = W; canvas.height = H;
    var x = canvas.getContext('2d');
    sky(x, W, H); flakes(x, W, H, 90, 5); drift(x, W, H, 110);
    x.fillStyle = C.ice; x.font = '800 26px ' + SANS; x.letterSpacing = '7px'; x.fillText('SNOW DAY ODDS', 70, 100); x.letterSpacing = '0px';
    x.fillStyle = C.snow; x.font = '900 66px ' + SANS; x.fillText('Will school be', 70, 192); x.fillText('canceled tomorrow?', 70, 266);
    x.fillStyle = C.muted; x.font = '600 28px ' + SANS; x.fillText('Snow-day chance from National Weather', 70, 334); x.fillText('Service forecast data. Free, for fun.', 70, 372);
    meter(x, 1000, 290, 130, d.chance);
    x.fillStyle = C.snow; x.textAlign = 'center'; x.font = '900 110px ' + SANS; x.fillText(d.chance + '', 988, 328);
    x.font = '900 48px ' + SANS; x.fillText('%', 1078, 328); x.textAlign = 'left';
    x.fillStyle = C.sky0; x.font = '800 30px ' + SANS; x.fillText('lanternlab2027.github.io/lab/snow', 70, H - 40);
    return canvas;
  }

  window.SnowCard = { draw: draw, drawOg: drawOg };
})();
