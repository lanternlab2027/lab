/* "More free apps from Lantern Lab" cross-promo strip.
 * Renders 3 picks into <div id="more-apps" data-from="<app>"> on each app page.
 * Static, same-origin only: no network calls, no storage, no tracking.
 * Styles live in more.css (linked just before the placeholder, which reserves the height). */
(function () {
  'use strict';

  var APPS = {
    wrapped:        ['Group Chat Wrapped', "Your group chat's year, as cards"],
    reading:        ['Reading Wrapped', 'Your year in books'],
    netflix:        ['Streaming Wrapped', 'Your year on Netflix'],
    sport:          ['Year in Motion', 'Your Strava or Garmin year'],
    dating:         ['Dating Wrapped', 'Your year on Tinder or Hinge'],
    tiktok:         ['Scroll Wrapped', 'Your TikTok year in review'],
    couples:        ['Couples Chat Wrapped', 'Your year in texts, together'],
    amazon:         ['Year in Orders', 'What you spent on Amazon'],
    awards:         ['Fantasy League Awards', 'Weekly awards for your Sleeper league'],
    santa:          ['Secret Santa', 'Draw names, no sign-up'],
    bingo:          ['2027 Goal Bingo', 'Your resolutions as a bingo card'],
    partybingo:     ['Watch-Party Bingo', "A card on every guest's phone"],
    then:           ['NYC Then', 'Guess the year of an old NYC photo'],
    'chicago-then': ['Chicago Then', 'Guess the year of an old Chicago photo'],
    eats:           ['NYC Restaurant Report Card', 'Health grades in plain English'],
    'chi-eats':     ['Chicago Restaurant Report Card', 'Inspections in plain English'],
    names:          ['Baby Name Report Card', "Any name's rank since 1880"],
    mileage:        ['Timeline Mileage Log', 'Business miles from Google Maps'],
    dogs:           ['NYC Dog Name Report Card', "How many NYC dogs share a name"],
    snow:           ['Snow Day Odds', "Tomorrow's snow-day chance"],
    bracket:        ['76-Team Bracket', 'Printable bracket + no-account pool'],
    hub:            ['All free apps', 'Wrapped apps, games and tools']
  };

  // Context picks, hard-coded. Wrapped apps -> other Wrapped apps; NYC tools (eats, then, dogs) -> other NYC
  // tools first; the Chicago editions -> Chicago first, then their NYC twins.
  var FIXED = {
    wrapped:        ['couples', 'tiktok', 'reading'],
    reading:        ['netflix', 'wrapped', 'sport'],
    netflix:        ['reading', 'tiktok', 'wrapped'],
    sport:          ['reading', 'netflix', 'amazon'],
    dating:         ['couples', 'wrapped', 'tiktok'],
    tiktok:         ['netflix', 'wrapped', 'amazon'],
    couples:        ['wrapped', 'dating', 'netflix'],
    amazon:         ['netflix', 'tiktok', 'reading'],
    eats:           ['then', 'dogs', 'chi-eats'],
    then:           ['eats', 'dogs', 'chicago-then'],
    dogs:           ['eats', 'then', 'names'],
    'chi-eats':     ['chicago-then', 'eats', 'then'],
    'chicago-then': ['chi-eats', 'then', 'eats']
  };

  // Everything else: the seasonal picks (by month, 0 = Jan) plus the hub.
  var SEASON = {
    10: ['santa', 'snow'],             // Nov: Wrapped season starts
    11: ['santa', 'snow'],             // Dec
    0:  ['bingo', 'amazon', 'mileage'],   // Jan
    1:  ['couples', 'partybingo'],        // Feb
    2:  ['bracket', 'partybingo']         // Mar
  };
  var OFF_SEASON = ['then', 'names'];
  var FILL = ['bingo', 'wrapped', 'then', 'names', 'eats'];
  // Related picks that lead the seasonal list for a "rest" app.
  var RELATED = { names: ['dogs'] };

  function pick(from, month) {
    if (FIXED[from]) return FIXED[from].filter(function (k) { return k !== from; }).slice(0, 3);
    var out = [];
    var src = (RELATED[from] || []).concat(SEASON[month] || OFF_SEASON, FILL);
    for (var i = 0; i < src.length && out.length < 2; i++) {
      if (src[i] !== from && out.indexOf(src[i]) < 0) out.push(src[i]);
    }
    out.push('hub');
    return out;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { pick: pick, APPS: APPS };
  if (typeof document === 'undefined') return;

  var box = document.getElementById('more-apps');
  if (!box || box.firstChild) return;
  var from = String(box.getAttribute('data-from') || '').replace(/[^a-z0-9-]/g, '');
  if (!from) {
    var m = /\/([a-z0-9-]+)\/(?:index\.html)?$/.exec(location.pathname);
    from = m ? m[1] : 'unknown';
  }
  var ref = '?ref=' + encodeURIComponent('more-' + from);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  var h = el('h2', 'llm-h', 'More free apps from Lantern Lab');
  h.id = 'more-apps-h';
  var ul = el('ul', 'llm-list');
  pick(from, new Date().getMonth()).forEach(function (key) {
    var info = APPS[key];
    var a = el('a', 'llm-a');
    a.href = (key === 'hub' ? '../apps/' : '../' + key + '/') + ref;
    var thumb;
    if (key === 'hub') {
      thumb = el('span', 'llm-thumb llm-hub');
      thumb.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 4; i++) thumb.appendChild(el('span'));
    } else {
      thumb = el('img', 'llm-thumb');
      thumb.src = '../apps/img/' + key + '.jpg';
      thumb.alt = '';
      thumb.width = 64;
      thumb.height = 40;
      thumb.loading = 'lazy';
      thumb.decoding = 'async';
    }
    var txt = el('span', 'llm-txt');
    txt.appendChild(el('span', 'llm-t', info[0]));
    txt.appendChild(el('span', 'llm-s', info[1]));
    a.appendChild(thumb);
    a.appendChild(txt);
    var li = el('li');
    li.appendChild(a);
    ul.appendChild(li);
  });
  box.setAttribute('role', 'region');
  box.setAttribute('aria-labelledby', 'more-apps-h');
  box.appendChild(h);
  box.appendChild(ul);
})();
