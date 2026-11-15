/* 76-Team Bracket: the PDF-friendly view (print.html). Blank, seeded (official field) or a picks link (#e=) / pool (#p=). */
(function () {
  'use strict';
  var B = window.Bracket, C = window.BracketCodec, Rn = window.BracketRender;
  var $ = function (id) { return document.getElementById(id); };
  var official = { layout: B.DEFAULT_LAYOUT, teams: {}, official: false };
  var pageStyle = document.createElement('style'); document.head.appendChild(pageStyle);

  function setPaper(p) {
    $('page').classList.toggle('a4', p === 'a4');
    pageStyle.textContent = '@page { size: ' + (p === 'a4' ? 'A4' : 'letter') + ' landscape; margin: 0.3in; }';
    try { localStorage.setItem('bracket.v1.paper', p); } catch (e) { /* ignore */ }
  }
  async function draw() {
    var h = location.hash.replace(/^#/, ''), pool = null, entry = null, S = B.build(official.layout);
    if (/^[pes]=/.test(h)) {
      var r = await C.decode(h);
      if (!r.error) { pool = r.pool; entry = r.type === 'entry' ? r.entry : null; S = B.build(pool.layout); }
    }
    var same = B.layoutText(S.layout) === B.layoutText(official.layout);
    var names = function (slot) {
      var id = S.slots[slot].id;
      if (pool && pool.teams) return pool.teams[id];
      return (official.official && same && official.teams[id]) || B.placeholder(S, slot);
    };
    var real = !!((pool && pool.teams) || (official.official && same));
    $('page').innerHTML = Rn.svg(S, {
      names: names, picks: entry ? entry.picks : null, showNames: real || !!entry, tb: entry ? entry.tb : null, name: entry ? entry.name : '',
      note: pool && !pool.solo ? 'Pool: ' + pool.name : ''
    });
    $('back').href = './' + (h ? '#' + h : '');
    document.title = (entry ? entry.name + ': ' : '') + '76-Team Bracket 2027: PDF View';
  }
  var saved = null; try { saved = localStorage.getItem('bracket.v1.paper'); } catch (e) { saved = null; }
  var q = null; try { q = new URLSearchParams(location.search).get('paper'); } catch (e) { q = null; }
  var paper = q === 'a4' || q === 'letter' ? q : (saved || (/^en-US|^en-CA|^es-MX/.test(navigator.language || 'en-US') ? 'letter' : 'a4'));
  $('paper').value = paper; setPaper(paper);
  $('paper').addEventListener('change', function () { setPaper($('paper').value); });
  $('print').addEventListener('click', function () { window.print(); });
  window.addEventListener('hashchange', draw);
  fetch('field-2027.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) { official = B.readFieldFile(j); }).catch(function () { /* defaults */ })
    .then(draw).then(function () { document.documentElement.setAttribute('data-ready', '1'); });
})();
