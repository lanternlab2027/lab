/* Group Chat Wrapped: synthetic sample chat. Every name and line here is made up. */
(function (root) {
  'use strict';

  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  var MEMBERS = [
    { name: 'Maya Chen', weight: 30, hours: [9, 23], laugh: 0.15, emoji: 0.5 },
    { name: 'Leo Okafor', weight: 22, hours: [0, 4], laugh: 0.35, emoji: 0.1 },
    { name: 'Sam Rivera', weight: 18, hours: [5, 9], laugh: 0.05, emoji: 0.15 },
    { name: 'Priya Nair', weight: 16, hours: [11, 22], laugh: 0.2, emoji: 0.3 },
    { name: 'Jonah Baker', weight: 10, hours: [12, 21], laugh: 0.1, emoji: 0.05 },
    { name: 'Tess Moreno', weight: 2, hours: [14, 18], laugh: 0, emoji: 0 }
  ];
  var LINES = [
    'who is bringing snacks saturday', 'pizza again? say less', 'running 10 min late', 'did anyone see the game last night',
    'trivia night thursday, we are winning this time', 'that playlist slaps', 'ok but hear me out: karaoke',
    'my plant died again', 'the group photo is so good', 'brunch spot booked for 11', 'who has my hoodie',
    'tacos tacos tacos', 'is it too early for halloween costumes', 'the dog learned a new trick', 'road trip playlist needs work',
    'bring the board games', 'I am never doing a 6am hike again', 'pancakes > waffles, fight me', 'movie night at mine?',
    'ok trivia team name ideas', 'coffee run anyone', 'the concert tickets are live', 'who ate the last dumpling'
  ];
  var LAUGHS = ['lol', 'LMAO', 'hahaha', 'haha', 'lmaooo', '\u{1F602}\u{1F602}'];
  var EMOJIS = ['\u{1F525}', '\u{1F602}', '\u2764\ufe0f', '\u{1F64C}', '\u{1F480}', '\u{1F389}', '\u{1F355}', '\u{1F440}', '\u{1F62D}', '\u2728'];

  function build(seed) {
    var r = rng(seed || 7);
    function pick(a) { return a[Math.floor(r() * a.length)]; }
    var wsum = MEMBERS.reduce(function (s, m) { return s + m.weight; }, 0);
    function pickMember() { var x = r() * wsum; for (var i = 0; i < MEMBERS.length; i++) { x -= MEMBERS[i].weight; if (x <= 0) return MEMBERS[i]; } return MEMBERS[0]; }
    var msgs = [];
    var start = new Date(2026, 0, 3);
    for (var day = 0; day < 310; day++) {
      var date = new Date(start.getTime() + day * 864e5);
      var bursts = r() < 0.25 ? 0 : 1 + Math.floor(r() * 3);
      if (date.getMonth() === 6 && date.getDate() === 4) bursts = 9; // the big day
      for (var b = 0; b < bursts; b++) {
        var starter = pickMember();
        var h = starter.hours[0] + Math.floor(r() * (starter.hours[1] - starter.hours[0] + 1));
        var t = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h % 24, Math.floor(r() * 60)).getTime();
        var n = 2 + Math.floor(r() * 9);
        var who = starter;
        for (var k = 0; k < n; k++) {
          var text = pick(LINES);
          if (r() < who.laugh) text = pick(LAUGHS) + ' ' + (r() < 0.5 ? text : '');
          if (r() < who.emoji) text += ' ' + pick(EMOJIS) + (r() < 0.4 ? pick(EMOJIS) : '');
          var kind = r() < 0.07 ? 'media' : 'text';
          msgs.push({ t: t, sender: who.name, text: text.trim(), kind: kind });
          who = pickMember();
          if (who.name === 'Tess Moreno' && r() < 0.8) who = MEMBERS[0];
          var gap = who.name === 'Priya Nair' ? 8 + r() * 30 : 30 + r() * 600;
          t += Math.round(gap) * 1000;
        }
      }
    }
    // One essay.
    msgs.push({ t: new Date(2026, 4, 12, 22, 41).getTime(), sender: 'Jonah Baker', kind: 'text',
      text: 'ok I have thoughts about the trip. first, the cabin was amazing and I would go back tomorrow. second, whoever planned the 6am hike owes all of us breakfast for a year. third, the lake was freezing but worth it. fourth, the board game night got way too competitive and I still think the rules were wrong. fifth, the drive home playlist was elite. sixth, we need to book the next one before everyone gets busy again. also thank you all, honestly the best weekend in ages and I mean that' });
    msgs.sort(function (a, b) { return a.t - b.t; });
    return msgs;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function whatsappText(seed) {
    var out = ['1/3/26, 9:00 AM - Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.',
      '1/3/26, 9:00 AM - Maya Chen created group "Weekend Crew"'];
    build(seed).forEach(function (m) {
      var d = new Date(m.t);
      var h = d.getHours(), ap = h < 12 ? 'AM' : 'PM', h12 = h % 12 || 12;
      out.push((d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2) + ', ' + h12 + ':' + pad(d.getMinutes()) + '\u202f' + ap + ' - ' + m.sender + ': ' + (m.kind === 'media' ? '<Media omitted>' : m.text));
    });
    return out.join('\n') + '\n';
  }

  function telegramJson(seed) {
    var id = 1;
    var messages = [{ id: id++, type: 'service', date: '2026-01-03T09:00:00', actor: 'Maya Chen', action: 'create_group', title: 'Weekend Crew', text: '' }];
    build(seed).forEach(function (m) {
      var d = new Date(m.t);
      var iso = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      var msg = { id: id++, type: 'message', date: iso, date_unixtime: String(Math.floor(m.t / 1000)), from: m.sender, from_id: 'user' + (1000 + m.sender.length) };
      if (m.kind === 'media') { msg.photo = '(File not included. Change data exporting settings to download.)'; msg.text = ''; }
      else if (/lol/.test(m.text)) msg.text = [{ type: 'bold', text: 'lol' }, m.text.replace(/^lol/, '')];
      else msg.text = m.text;
      messages.push(msg);
    });
    return { name: 'Weekend Crew', type: 'private_group', id: 4242, messages: messages };
  }

  var api = { build: build, whatsappText: whatsappText, telegramJson: telegramJson };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WrappedDemo = api;
})(typeof self !== 'undefined' ? self : this);
