/* Group Chat Wrapped: chat export parser.
 * Runs entirely in the browser (and in Node for the unit tests). No network access.
 * Output: { source, title, dateOrder, messages: [{ t, y, mo, d, h, mi, sender, text, kind }] }
 *   kind: "text" | "media" | "deleted"   (system messages are dropped)
 */
(function (root) {
  'use strict';

  var MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
  var SPACES = /[\u202f\u00a0\u2007\u2009]/g;

  // "13. 6. 2018" (Czech/Croatian) and "2024. 1. 15." (Korean) put a space after each separator.
  var DATE = '(\\d{1,4})([\\/.\\-])\\s?(\\d{1,2})\\2\\s?(\\d{1,4})\\.?';
  // Optional word before the time: Finnish "klo", or a CJK AM/PM marker (Korean, Chinese, Japanese).
  var PRE = '(?:(?:klo|kl\\.)\\s*|(\uc624\uc804|\uc624\ud6c4|\u4e0a\u5348|\u4e0b\u5348|\u5348\u524d|\u5348\u5f8c)\\s*)?';
  // AM/PM after the time: "PM", "p. m.", or Arabic \u0635 (AM) / \u0645 (PM).
  var TIME = '(\\d{1,2})[:.](\\d{2})(?:[:.](\\d{2}))?(?:\\s*(?:([aApP])\\.?\\s*[mM]\\.?|(\u0635|\u0645)(?![\\w\u0600-\u06ff])))?';
  // iOS:     [1/15/24, 9:05:12 PM] Name: msg
  var RE_BRACKET = new RegExp('^\\[' + DATE + ',?\\s*' + PRE + TIME + '\\]\\s*(.*)$');
  // Android: 1/15/24, 9:05 PM - Name: msg
  var RE_DASH = new RegExp('^' + DATE + ',?\\s*' + PRE + TIME + '\\s*[-\\u2013\\u2014]\\s(.*)$');
  var PM_WORDS = /\uc624\ud6c4|\u4e0b\u5348|\u5348\u5f8c|\u0645/;

  var RE_MEDIA = [
    /^<?\s*media omitted\s*>?$/i,
    /^<?\s*(image|video|audio|sticker|gif|document|contact card|file|photo|voice message) omitted\s*>?$/i,
    /\b(image|video|audio|sticker|gif|document|contact card) omitted$/i,
    /^<attached: [^>]+>$/i,
    // "IMG-20240101-WA0001.jpg (file attached)" in any language: "(Datei angeh\u00e4ngt)", "(archivo adjunto)"...
    /^\S+\.(jpe?g|png|gif|webp|heic|mp4|mov|3gp|opus|ogg|m4a|aac|mp3|pdf|vcf|webm|docx?|xlsx?|pptx?|zip|txt) [(<][^()<>]{2,40}[)>]$/i,
    /^<?(medien ausgeschlossen|media weggelaten|multimedia omitido|archivo omitido|m[\u00e9e]dias? omis|m[\u00edi]dia oculta|media omessi|immagine omessa)>?$/i,
    /^(bild|video|audio|sticker|gif|dokument) weggelassen$/i,
    /^(imagen|video|audio|sticker|gif|documento) omitid[oa]$/i,
    /^(image|vid\u00e9o|audio|autocollant|gif|document) (absente?|omise?)$/i,
    /^null$/,
    /^(location|live location shared|standort|ubicaci[\u00f3o]n): /i
  ];
  var RE_DELETED = /^(this message was deleted\.?|you deleted this message\.?|diese nachricht wurde gel[\u00f6o]scht\.?|du hast diese nachricht gel[\u00f6o]scht\.?|se elimin[\u00f3o] este mensaje\.?|eliminaste este mensaje\.?|ce message a [\u00e9e]t[\u00e9e] supprim[\u00e9e]\.?|vous avez supprim[\u00e9e] ce message\.?|questo messaggio [\u00e8e] stato eliminato\.?|essa mensagem foi apagada\.?|mensagem apagada)$/i;
  var RE_EDITED = /\s*<\s*(this message was edited|diese nachricht wurde bearbeitet|se edit[\u00f3o] este mensaje|ce message a [\u00e9e]t[\u00e9e] modifi[\u00e9e])\s*>\s*$/i;

  // Arabic-Indic and Persian digits become ASCII; the Arabic comma becomes ",".
  function digits(s) {
    return s.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, function (c) { var n = c.charCodeAt(0); return String(n >= 0x6f0 ? n - 0x6f0 : n - 0x660); }).replace(/\u060c/g, ',');
  }
  function norm(s) { return digits(s.replace(SPACES, ' ').replace(MARKS, '')); }

  function classify(text) {
    var t = text.trim();
    if (RE_DELETED.test(t)) return 'deleted';
    for (var i = 0; i < RE_MEDIA.length; i++) if (RE_MEDIA[i].test(t)) return 'media';
    return 'text';
  }

  function cleanSender(s) {
    return s.replace(/^~\s*/, '').replace(/\s+/g, ' ').trim();
  }

  // ---- WhatsApp ----
  function parseWhatsAppRaw(text) {
    var lines = text.replace(/^\ufeff/, '').split(/\r\n|\r|\n|\u2028/);
    var recs = [];
    var cur = null;
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var line = norm(raw);
      var m = RE_BRACKET.exec(line);
      var ios = !!m;
      if (!m) m = RE_DASH.exec(line);
      if (m) {
        cur = {
          p: [m[1], m[3], m[4]], sep: m[2],
          h: +m[6], mi: +m[7], s: m[8] ? +m[8] : 0,
          ap: m[9] ? m[9].toLowerCase() : (m[5] || m[10]) ? (PM_WORDS.test(m[5] || m[10]) ? 'p' : 'a') : null,
          rest: m[11], ios: ios,
          // iOS marks system lines (and media) with a left-to-right mark right after "Name: "
          mark: /:\s[\u200e\u200f]/.test(raw.replace(SPACES, ' '))
        };
        recs.push(cur);
      } else if (cur) {
        cur.rest += '\n' + line;
      }
    }
    return recs;
  }

  function toYMD(p, order) {
    var a = +p[0], b = +p[1], c = +p[2];
    var y, mo, d;
    if (order === 'YMD') { y = a; mo = b; d = c; }
    else if (order === 'DMY') { d = a; mo = b; y = c; }
    else { mo = a; d = b; y = c; }
    if (y < 100) y += 2000;
    return [y, mo, d];
  }

  function hour24(r) {
    var h = r.h;
    if (r.ap === 'p' && h < 12) h += 12;
    if (r.ap === 'a' && h === 12) h = 0;
    return h;
  }

  function stamp(r, order) {
    var ymd = toYMD(r.p, order);
    return new Date(ymd[0], ymd[1] - 1, ymd[2], hour24(r), r.mi, r.s).getTime();
  }

  function valid(r, order) {
    var ymd = toYMD(r.p, order);
    return ymd[1] >= 1 && ymd[1] <= 12 && ymd[2] >= 1 && ymd[2] <= 31;
  }

  function detectDateOrder(recs) {
    if (!recs.length) return 'MDY';
    if (recs[0].p[0].length === 4) return 'YMD';
    var firstBig = false, secondBig = false;
    for (var i = 0; i < recs.length; i++) {
      if (+recs[i].p[0] > 12) firstBig = true;
      if (+recs[i].p[1] > 12) secondBig = true;
    }
    if (firstBig && !secondBig) return 'DMY';
    if (secondBig && !firstBig) return 'MDY';
    // Ambiguous: messages are chronological, so pick the reading with fewer backwards jumps.
    function backwards(order) {
      var n = 0, prev = -Infinity;
      for (var j = 0; j < recs.length; j++) {
        var t = stamp(recs[j], order);
        if (t < prev - 60000) n++;
        prev = t;
      }
      return n;
    }
    var mdy = backwards('MDY'), dmy = backwards('DMY');
    if (mdy !== dmy) return mdy < dmy ? 'MDY' : 'DMY';
    // Still tied (e.g. a chat inside one day): 12-hour clocks and "/" suggest US, dots suggest Europe.
    var ampm = recs.some(function (r) { return r.ap; });
    if (recs[0].sep === '.') return 'DMY';
    return ampm ? 'MDY' : 'DMY';
  }

  function titleFromFilename(name) {
    if (!name) return null;
    var base = name.replace(/^.*[\\/]/, '').replace(/\.(txt|zip|json)$/i, '');
    var m = /^WhatsApp Chat (?:with|-|\u2013)\s*(.+)$/i.exec(base) || /^(?:Chat de WhatsApp con|WhatsApp-Chat mit|Discussion WhatsApp avec|Conversa do WhatsApp com)\s+(.+)$/i.exec(base);
    if (m) return m[1].trim();
    return null;
  }

  function parseWhatsApp(text, filename) {
    var recs = parseWhatsAppRaw(text);
    var order = detectDateOrder(recs);
    var out = [];
    var title = titleFromFilename(filename);
    var systemSenders = {};
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (!valid(r, order)) continue;
      var rest = r.rest;
      var idx = rest.indexOf(': ');
      var sender = idx > 0 ? rest.slice(0, idx) : '';
      var body = idx > 0 ? rest.slice(idx + 2) : rest;
      var isSystem = false;
      if (idx <= 0 || /["\u201c\u201d\u00ab\u00bb]/.test(sender) || sender.length > 60) isSystem = true;
      else {
        var kind0 = classify(body);
        if (r.mark && kind0 === 'text') {
          isSystem = true; // iOS: "Group Name: \u200eAlice added Bob"
          systemSenders[cleanSender(sender)] = 1;
          if (!title && r.ios) title = cleanSender(sender);
        }
      }
      if (isSystem) {
        if (!title) {
          var g = /created group [\u201c"](.+)[\u201d"]/.exec(rest);
          if (g) title = g[1];
        }
        continue;
      }
      body = body.replace(/\s+$/, '').replace(RE_EDITED, '');
      var kind = classify(body);
      var ymd = toYMD(r.p, order);
      var h = hour24(r);
      out.push({
        t: new Date(ymd[0], ymd[1] - 1, ymd[2], h, r.mi, r.s).getTime(),
        y: ymd[0], mo: ymd[1], d: ymd[2], h: h, mi: r.mi,
        sender: cleanSender(sender),
        text: kind === 'text' ? body : '',
        kind: kind
      });
    }
    // A "sender" that only ever posted iOS system lines is the group itself, not a member.
    // In a 1:1 iOS chat the contact's own name carries the system lines (and is the title),
    // so never drop a sender who also wrote real text.
    var wroteText = {};
    out.forEach(function (m) { if (m.kind === 'text') wroteText[m.sender] = 1; });
    out = out.filter(function (m) { return !(systemSenders[m.sender] && m.sender === title && !wroteText[m.sender]); });
    return { source: 'whatsapp', title: title, dateOrder: order, messages: out };
  }

  // ---- Telegram (Desktop: Export chat history -> JSON -> result.json) ----
  function flattenTelegramText(t) {
    if (typeof t === 'string') return t;
    if (Array.isArray(t)) return t.map(function (x) { return typeof x === 'string' ? x : (x && x.text) || ''; }).join('');
    return '';
  }

  function parseTelegram(obj) {
    var chat = obj;
    if (obj && obj.chats && Array.isArray(obj.chats.list)) {
      // Full account export: use the busiest group chat.
      var list = obj.chats.list.filter(function (c) { return Array.isArray(c.messages); });
      var groups = list.filter(function (c) { return /group|supergroup/.test(c.type || ''); });
      var pool = groups.length ? groups : list;
      pool.sort(function (a, b) { return b.messages.length - a.messages.length; });
      chat = pool[0];
    }
    if (!chat || !Array.isArray(chat.messages)) throw new Error('This JSON file is not a Telegram chat export (result.json).');
    var out = [];
    chat.messages.forEach(function (m) {
      if (!m || m.type !== 'message') return;
      var dm = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(m.date || '');
      var y, mo, d, h, mi, s;
      if (dm) { y = +dm[1]; mo = +dm[2]; d = +dm[3]; h = +dm[4]; mi = +dm[5]; s = +dm[6]; }
      else if (m.date_unixtime) {
        var dt = new Date(+m.date_unixtime * 1000);
        y = dt.getFullYear(); mo = dt.getMonth() + 1; d = dt.getDate(); h = dt.getHours(); mi = dt.getMinutes(); s = dt.getSeconds();
      } else return;
      var text = flattenTelegramText(m.text);
      var hasMedia = !!(m.media_type || m.photo || m.file || m.sticker_emoji || m.poll || m.location_information || m.contact_information);
      var kind = text.trim() ? 'text' : (hasMedia ? 'media' : 'text');
      if (kind === 'text' && !text.trim()) return;
      out.push({
        t: new Date(y, mo - 1, d, h, mi, s).getTime(),
        y: y, mo: mo, d: d, h: h, mi: mi,
        sender: cleanSender(m.from || 'Deleted Account'),
        text: kind === 'text' ? text : '',
        kind: kind
      });
    });
    return { source: 'telegram', title: chat.name || null, dateOrder: 'YMD', messages: out };
  }

  function parseAny(text, filename) {
    var trimmed = text.replace(/^\ufeff/, '').trimStart();
    var res;
    if (/^<(!doctype|html)/i.test(trimmed)) {
      throw new Error("That's an HTML export. In Telegram Desktop, export the chat again and set Format to Machine-readable JSON, then upload result.json.");
    }
    if (trimmed.charAt(0) === '{') {
      var obj;
      try { obj = JSON.parse(trimmed); } catch (e) { throw new Error("That JSON file couldn't be read. Export it again from Telegram Desktop as JSON."); }
      res = parseTelegram(obj);
    } else {
      res = parseWhatsApp(text, filename);
    }
    if (!res.messages.length) throw new Error("We couldn't find any messages in that file. Make sure it's a WhatsApp chat export (.txt or .zip) or a Telegram result.json.");
    res.messages.sort(function (a, b) { return a.t - b.t; });
    return res;
  }

  var api = { parseAny: parseAny, parseWhatsApp: parseWhatsApp, parseTelegram: parseTelegram, detectDateOrder: detectDateOrder, parseWhatsAppRaw: parseWhatsAppRaw, titleFromFilename: titleFromFilename };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WrappedParser = api;
})(typeof self !== 'undefined' ? self : this);
