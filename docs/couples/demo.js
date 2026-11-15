/* Couples Chat Wrapped: synthetic sample chat. Both people and every line here are made up. */
(function (root) {
  'use strict';

  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  var A = { name: 'Jamie Lin', wake: 7, reply: [20, 240], emoji: 0.35, mine: ['\u{1F97A}', '\u{1F49B}', '\u{1F602}'] };
  var B = { name: 'Rowan Diaz', wake: 8, reply: [40, 900], emoji: 0.25, mine: ['\u{1F602}', '\u{1F525}', '\u2764\ufe0f'] };
  var SHARED = ['\u2764\ufe0f', '\u{1F602}', '\u{1F97A}'];
  var MORNING = ['good morning', 'morning!!', 'mornin', 'up yet?', 'coffee?', 'did you sleep ok'];
  var DAYTIME = [
    'what do you want for dinner', 'tacos tonight?', 'running 10 min late', 'look at this dog', 'ok that meeting was long',
    'can you grab milk on the way', 'I booked the table for 8', 'the plant is thriving', 'movie tonight or no',
    'my mom says hi', 'leaving work now', 'how is your day going', 'ok I miss you', 'pizza or thai', 'did you feed the cat',
    'that song is stuck in my head', 'the train is delayed again', 'I found the best bakery', 'want to go hiking sunday',
    'call you on my break', 'so proud of you', 'what are we watching', 'traffic is wild', 'ok see you soon'
  ];
  var NIGHT = ['still up?', 'cant sleep', 'one more episode', 'tell me a story', 'thinking about the trip'];
  var GOODNIGHT = ['goodnight', 'good night', 'night night', 'gn', 'goodnight, sleep well'];
  var LOVE = ['love you', 'I love you', 'love you too', 'ily'];

  function build(seed) {
    var r = rng(seed || 14);
    function pick(a) { return a[Math.floor(r() * a.length)]; }
    function decorate(who, text) {
      if (r() < who.emoji) text += ' ' + (r() < 0.55 ? pick(SHARED) : pick(who.mine));
      return text;
    }
    var msgs = [];
    var start = new Date(2026, 0, 1);
    for (var day = 0; day < 314; day++) {
      var date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + day);
      var y = date.getFullYear(), mo = date.getMonth(), d = date.getDate();
      // A few quiet days (trips together, phones away), but not in the long streak in spring.
      if (r() < 0.06 && !(mo >= 2 && mo <= 4)) continue;
      var big = mo === 1 && d === 14;
      var t;
      // Morning: one of them says good morning first.
      var first = r() < 0.58 ? A : B;
      t = new Date(y, mo, d, first.wake, Math.floor(r() * 50)).getTime();
      var who = first;
      var n = 2 + Math.floor(r() * 4) + (big ? 30 : 0);
      for (var k = 0; k < n; k++) {
        var text = k === 0 ? pick(MORNING) : (big && r() < 0.3 ? pick(['happy valentines', 'best day', 'dinner was perfect', 'I love you']) : pick(DAYTIME));
        msgs.push({ t: t, sender: who.name, text: decorate(who, text), kind: r() < 0.05 ? 'media' : 'text' });
        var nextWho = r() < 0.72 ? (who === A ? B : A) : who;
        var gap = nextWho === who ? 5 + r() * 40 : nextWho.reply[0] + r() * (nextWho.reply[1] - nextWho.reply[0]);
        t += Math.round(gap * (k > 2 && !big ? 30 : 1)) * 1000;
        who = nextWho;
      }
      // Evening and sometimes late night.
      var eh = 21 + Math.floor(r() * 2);
      t = Math.max(t + 600000, new Date(y, mo, d, eh, Math.floor(r() * 60)).getTime());
      var lateNight = r() < 0.22;
      var m2 = 2 + Math.floor(r() * 5);
      who = r() < 0.5 ? A : B;
      for (var j = 0; j < m2; j++) {
        msgs.push({ t: t, sender: who.name, text: decorate(who, lateNight && j > 0 ? pick(NIGHT) : pick(DAYTIME)), kind: 'text' });
        who = who === A ? B : A;
        t += Math.round(who.reply[0] + r() * who.reply[1]) * 1000 * (lateNight ? 6 : 1);
      }
      if (r() < 0.55) { msgs.push({ t: t, sender: who.name, text: decorate(who, pick(GOODNIGHT)), kind: 'text' }); t += 60000; who = who === A ? B : A; }
      if (r() < 0.45) { msgs.push({ t: t, sender: who.name, text: decorate(who, pick(LOVE)) + (r() < 0.5 ? ' \u2764\ufe0f' : ''), kind: 'text' }); t += 45000; }
      if (r() < 0.4) msgs.push({ t: t, sender: (who === A ? B : A).name, text: pick(GOODNIGHT), kind: 'text' });
    }
    msgs.sort(function (a, b) { return a.t - b.t; });
    return msgs;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // iOS-style export, like a real 1:1 "WhatsApp Chat - Rowan Diaz.zip" _chat.txt
  function whatsappText(seed) {
    var out = ['[1/1/26, 7:00:00\u202fAM] Rowan Diaz: \u200eMessages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.'];
    build(seed).forEach(function (m) {
      var d = new Date(m.t);
      var h = d.getHours(), ap = h < 12 ? 'AM' : 'PM', h12 = h % 12 || 12;
      out.push('[' + (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2) + ', ' + h12 + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '\u202f' + ap + '] ' + m.sender + ': ' + (m.kind === 'media' ? '\u200eimage omitted' : m.text));
    });
    return out.join('\n') + '\n';
  }

  var api = { build: build, whatsappText: whatsappText, names: [A.name, B.name] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CouplesDemo = api;
})(typeof self !== 'undefined' ? self : this);
