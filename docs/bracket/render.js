/* 76-Team Bracket: the one-page bracket sheet as SVG (viewBox 1100 x 850 = Letter landscape at 100 units/inch).
 * Used on screen (pick by clicking a team), in print (CSS @media print) and in the PDF view (print.html).
 * Every line is "a team entering game g on side s"; the champion has its own box in the middle.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./bracket.js'));
  else root.BracketRender = factory(root.Bracket);
})(typeof self !== 'undefined' ? self : this, function (B) {
  'use strict';

  var W = 1100, H = 850, M = 22;
  var TOP = 86, BOT = 812, GAP = 24;
  var RH = (BOT - TOP - GAP) / 2, ROW = RH / 16;
  // column widths from the outside in: Opening Round, first round, second round, regional semis, regional final, national semis
  var COLW = [64, 98, 80, 74, 70, 64];
  var COLX = []; (function () { var x = M; for (var i = 0; i < COLW.length; i++) { COLX.push(x); x += COLW[i]; } })();
  var INNER = COLX[5] + COLW[5]; // 472: where the left half ends
  var MID = (TOP + BOT) / 2;
  var POS = {}; B.POD.forEach(function (p, i) { POS[p[0]] = 2 * i; POS[p[1]] = 2 * i + 1; });
  var HEAD = [
    ['Opening Round', 'Mar 16-17'], ['First round', 'Mar 18-19'], ['Second round', 'Mar 20-21'],
    ['Regional semis', 'Mar 25-26'], ['Regional final', 'Mar 27-28'], ['Natl. semis', 'Apr 3']
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function f1(n) { return Math.round(n * 10) / 10; }
  // half: 0 = left (regions 0,1), 1 = right (regions 2,3); col: 0..5 -> [x1, x2]
  function span(half, col) {
    var a = COLX[col], b = a + COLW[col];
    return half ? [W - b, W - a] : [a, b];
  }
  function regionTop(r) { return TOP + (r % 2) * (RH + GAP); }
  function slotY(S, slot) {
    var t = S.slots[slot], y = regionTop(t.region) + (POS[t.seed] + 0.5) * ROW;
    if (t.sub === 'a') return y - ROW / 2;
    if (t.sub === 'b') return y + ROW / 2;
    return y;
  }
  // geometry for every (game, side) line
  function geometry(S) {
    if (S._geo) return S._geo;
    var ys = [];
    function y(g, side) {
      var src = side ? S.games[g].b : S.games[g].a;
      return src.slot != null ? slotY(S, src.slot) : (ys[src.game][0] + ys[src.game][1]) / 2;
    }
    S.games.forEach(function (g) { ys[g.i] = [y(g.i, 0), y(g.i, 1)]; });
    var lines = [];
    S.games.forEach(function (g) {
      for (var side = 0; side < 2; side++) {
        var half, x1, x2;
        if (g.round === 6) { half = side; x1 = side ? W / 2 + 4 : INNER; x2 = side ? W - INNER : W / 2 - 4; }
        else {
          half = g.round === 5 ? (g.code === S.games[S.final].code ? side : (S.games[S.final].a.game === g.i ? 0 : 1)) : (g.region >= 2 ? 1 : 0);
          var c = g.round === 0 ? 0 : g.round, sp = span(half, c); x1 = sp[0]; x2 = sp[1];
        }
        lines.push({ g: g.i, side: side, round: g.round, half: half, x1: x1, x2: x2, y: ys[g.i][side] });
      }
    });
    S._geo = { lines: lines, ys: ys };
    return S._geo;
  }

  // opts: {
  //   names(slot) -> label for a team, picks (array) or null, showNames (bool: print team names on entry lines),
  //   R (results from Bracket.readResults) or null, title, subtitle, interactive (bool), tb (tiebreak value or null),
  //   regionsNote (small text under the region name), footer
  // }
  function svg(S, opts) {
    opts = opts || {};
    var picks = opts.picks || B.emptyPicks(), geo = geometry(S), memo = {}, out = [];
    var R = opts.R, names = opts.names || function (slot) { return B.placeholder(S, slot); };
    var elim = R ? B.eliminated(S, R) : {};
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" class="bsheet" role="img" aria-label="' + esc(opts.title || '76-team bracket') + '">');
    out.push('<rect class="paper" x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff"/>');
    // header
    out.push('<text class="t-title" x="' + W / 2 + '" y="30" text-anchor="middle" font-size="20" font-weight="800" fill="#111">' + esc(opts.title || '2027 Men\u2019s College Basketball Tournament: 76-Team Bracket') + '</text>');
    out.push('<text class="t-sub" x="' + W / 2 + '" y="47" text-anchor="middle" font-size="9.5" fill="#444">' + esc(opts.subtitle || 'Selection Sunday Mar 14 \u00b7 Opening Round Mar 16-17 \u00b7 National semifinals Apr 3 and title game Apr 5, Detroit') + '</text>');
    for (var half = 0; half < 2; half++) {
      for (var c = 0; c < 6; c++) {
        var sp = span(half, c), cx = (sp[0] + sp[1]) / 2;
        out.push('<text class="t-head" x="' + f1(cx) + '" y="68" text-anchor="middle" font-size="7.6" font-weight="700" fill="#333">' + esc(HEAD[c][0]) + '</text>');
        out.push('<text class="t-date" x="' + f1(cx) + '" y="78" text-anchor="middle" font-size="7" fill="#666">' + esc(HEAD[c][1]) + '</text>');
      }
    }
    out.push('<text class="t-head" x="' + W / 2 + '" y="68" text-anchor="middle" font-size="7.6" font-weight="700" fill="#333">Title game</text>');
    out.push('<text class="t-date" x="' + W / 2 + '" y="78" text-anchor="middle" font-size="7" fill="#666">Apr 5</text>');
    // region names
    S.layout.forEach(function (reg, r) {
      var h = r >= 2 ? 1 : 0, sp = span(h, 4), x = h ? sp[0] - 30 : sp[1] + 30, y = regionTop(r) + (r % 2 ? RH - 18 : 26);
      out.push('<text class="t-region" x="' + f1((sp[0] + sp[1]) / 2 + (h ? -12 : 12)) + '" y="' + f1(y) + '" text-anchor="middle" font-size="17" font-weight="900" letter-spacing="1.5" fill="#999">' + esc(reg.name.toUpperCase()) + '</text>');
      void x;
    });
    // lines + connectors
    var champ = B.winnerOf(S, picks, S.final, memo);
    geo.lines.forEach(function (L) {
      var t = B.teamsIn(S, picks, L.g, memo)[L.side];
      var g = S.games[L.g], fromSlot = (L.side ? g.b : g.a).slot != null;
      var cls = 'ln', mark = '';
      if (R && t != null && !fromSlot) {
        var actual = B.actualTeams(S, R.win, L.g)[L.side];
        if (actual != null) mark = actual === t ? ' ok' : ' bad';
        else if (elim[t] != null) mark = ' bad';
      }
      if (picks[L.g] && picks[L.g] - 1 === L.side) cls += ' won';
      out.push('<g class="' + cls + mark + '" data-g="' + L.g + '" data-s="' + L.side + '">');
      if (opts.interactive && t != null) out.push('<rect class="hit" x="' + f1(L.x1) + '" y="' + f1(L.y - 11) + '" width="' + f1(L.x2 - L.x1) + '" height="12" fill="transparent"/>');
      out.push('<line x1="' + f1(L.x1) + '" y1="' + f1(L.y) + '" x2="' + f1(L.x2) + '" y2="' + f1(L.y) + '" stroke="#222" stroke-width="0.8"/>');
      var seed = t != null ? B.seedOf(S, t) : (fromSlot ? B.seedOf(S, (L.side ? g.b : g.a).slot) : null);
      var label = t != null && (opts.showNames || !fromSlot) ? names(t) : '';
      var x = L.x1 + 2;
      if (seed != null) { out.push('<text class="t-seed" x="' + f1(x) + '" y="' + f1(L.y - 2.6) + '" font-size="7" font-weight="700" fill="#555">' + seed + '</text>'); x += seed >= 10 ? 10 : 7; }
      if (label) {
        var avail = L.x2 - x - 2, est = label.length * 4.6;
        out.push('<text class="t-team" x="' + f1(x) + '" y="' + f1(L.y - 2.6) + '" font-size="8.4" fill="#111"' + (est > avail ? ' textLength="' + f1(avail) + '" lengthAdjust="spacingAndGlyphs"' : '') + '>' + esc(label) + '</text>');
      }
      out.push('</g>');
    });
    S.games.forEach(function (g) {
      if (g.round === 6) return;
      var a = geo.lines[2 * g.i], b = geo.lines[2 * g.i + 1], x = a.half ? a.x1 : a.x2;
      out.push('<line class="conn" x1="' + f1(x) + '" y1="' + f1(a.y) + '" x2="' + f1(x) + '" y2="' + f1(b.y) + '" stroke="#222" stroke-width="0.8"/>');
    });
    // champion box
    var bx = W / 2 - 62, by = MID - 92;
    out.push('<text class="t-head" x="' + W / 2 + '" y="' + f1(by - 8) + '" text-anchor="middle" font-size="9" font-weight="800" letter-spacing="2" fill="#333">CHAMPION</text>');
    out.push('<rect class="champ" x="' + bx + '" y="' + by + '" width="124" height="34" rx="5" fill="none" stroke="#222" stroke-width="1.4"/>');
    if (champ != null) {
      var cm = '';
      if (R && R.win[S.final] != null) cm = R.win[S.final] === champ ? ' ok' : ' bad'; else if (R && elim[champ] != null) cm = ' bad';
      var cl = names(champ), ce = cl.length * 6.4;
      out.push('<g class="ln won' + cm + '"><text class="t-champ" x="' + W / 2 + '" y="' + f1(by + 22) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#111"' + (ce > 116 ? ' textLength="116" lengthAdjust="spacingAndGlyphs"' : '') + '>' + esc(B.seedOf(S, champ) + ' ' + cl) + '</text></g>');
    }
    out.push('<line class="conn" x1="' + W / 2 + '" y1="' + f1(by + 34) + '" x2="' + W / 2 + '" y2="' + f1(MID - 12) + '" stroke="#222" stroke-width="0.8"/>');
    out.push('<text class="t-date" x="' + W / 2 + '" y="' + f1(MID + 28) + '" text-anchor="middle" font-size="7.6" fill="#444">Title game total points</text>');
    out.push('<rect x="' + (W / 2 - 26) + '" y="' + f1(MID + 34) + '" width="52" height="18" rx="3" fill="none" stroke="#222" stroke-width="0.8"/>');
    if (opts.tb != null) out.push('<text class="t-team" x="' + W / 2 + '" y="' + f1(MID + 47) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#111">' + esc(opts.tb) + '</text>');
    if (opts.name) out.push('<text class="t-head" x="' + W / 2 + '" y="' + f1(MID + 80) + '" text-anchor="middle" font-size="10" font-weight="800" fill="#222">' + esc(opts.name) + '</text>');
    else out.push('<text class="t-date" x="' + W / 2 + '" y="' + f1(MID + 80) + '" text-anchor="middle" font-size="7.6" fill="#444">Name ______________</text>');
    if (opts.note) out.push('<text class="t-date" x="' + W / 2 + '" y="' + f1(MID + 96) + '" text-anchor="middle" font-size="7" fill="#666">' + esc(opts.note) + '</text>');
    // footer
    out.push('<text class="t-foot" x="' + M + '" y="836" font-size="7.4" fill="#555">' + esc(opts.footer || 'Free printable for bragging rights. Not affiliated with the NCAA. Opening Round lines and semifinal pairings are set on Selection Sunday.') + '</text>');
    out.push('<text class="t-foot" x="' + (W - M) + '" y="836" text-anchor="end" font-size="7.4" font-weight="700" fill="#333">lanternlab2027.github.io/lab/bracket</text>');
    out.push('</svg>');
    return out.join('');
  }

  return { W: W, H: H, svg: svg, geometry: geometry, esc: esc };
});
