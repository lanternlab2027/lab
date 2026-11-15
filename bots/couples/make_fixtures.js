// Writes synthetic 1:1 chat fixtures for Couples Chat Wrapped to bots/couples/fixtures/.
// Run: node bots/couples/make_fixtures.js   (everything here is made up; no real chats)
const fs = require('fs'), path = require('path');
const JSZip = require(path.resolve(__dirname, '../../docs/couples/vendor/jszip-3.10.1.min.js'));
const Demo = require(path.resolve(__dirname, '../../docs/couples/demo.js'));
const FX = path.join(__dirname, 'fixtures');
fs.mkdirSync(FX, { recursive: true });
const NN = '\u202f', LRM = '\u200e';
const w = (f, s) => fs.writeFileSync(path.join(FX, f), s);

// iOS, US English, 12h with narrow no-break spaces; system lines carry an LRM under the contact's name.
// Expected values are asserted in test_stats.js.
w('ios_1to1_en.txt', [
  `[1/15/26, 9:00:00${NN}PM] Tom Reyes: ${LRM}Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.`,
  `[1/15/26, 9:05:00${NN}PM] Priya Shah: are we still on for friday`,
  `[1/15/26, 9:07:00${NN}PM] Tom Reyes: yes!! 7pm \u2764\ufe0f`,
  `[1/15/26, 11:30:00${NN}PM] Priya Shah: goodnight \u{1F618}`,
  `[1/15/26, 11:31:00${NN}PM] Tom Reyes: gn, love you \u2764\ufe0f`,
  `[1/16/26, 8:01:00${NN}AM] Tom Reyes: morning \u2600\ufe0f`,
  `[1/16/26, 8:03:00${NN}AM] Priya Shah: morning! \u2764\ufe0f`,
  `[1/16/26, 8:04:00${NN}AM] Priya Shah: ${LRM}image omitted`,
  `[1/16/26, 8:20:00${NN}AM] Tom Reyes: ${LRM}Missed voice call, ${LRM}Tap to call back`,
  `[1/17/26, 2:10:00${NN}AM] Priya Shah: cant sleep`,
  `[1/17/26, 9:00:00${NN}AM] Priya Shah: I love you`,
  `[1/17/26, 9:10:00${NN}AM] Tom Reyes: love you too \u{1F970}`,
  `[1/19/26, 10:00:00${NN}AM] Tom Reyes: hi`,
  `[1/19/26, 10:05:00${NN}AM] Priya Shah: hey \u{1F618}`
].join('\n') + '\n');

// Android, Spanish, DD/MM/YYYY 24h.
w('android_es_1to1.txt', [
  '15/01/2026, 07:00 - Los mensajes y las llamadas est\u00e1n cifrados de extremo a extremo.',
  '15/01/2026, 07:30 - Mateo Ruiz: buenos d\u00edas \u2600\ufe0f',
  '15/01/2026, 07:45 - Luc\u00eda G\u00f3mez: buen d\u00eda \u{1F60A}',
  '15/01/2026, 23:50 - Mateo Ruiz: Buenas noches, te quiero',
  '16/01/2026, 00:05 - Luc\u00eda G\u00f3mez: Te amo \u2764\ufe0f buenas noches',
  '16/01/2026, 08:00 - Luc\u00eda G\u00f3mez: <Multimedia omitido>'
].join('\n') + '\n');

// iOS, German, dotted dates, 24h with seconds.
w('ios_de_1to1.txt', [
  `[15.01.26, 07:10:00] Jonas Weber: ${LRM}Nachrichten und Anrufe sind Ende-zu-Ende-verschl\u00fcsselt.`,
  '[15.01.26, 07:12:03] Jonas Weber: Guten Morgen',
  '[15.01.26, 07:20:00] Anna M\u00fcller: Morgen \u{1F60D}',
  '[15.01.26, 22:40:00] Anna M\u00fcller: Gute Nacht! Hab dich lieb',
  '[15.01.26, 22:41:30] Jonas Weber: gn8, ich liebe dich',
  `[16.01.26, 06:30:00] Anna M\u00fcller: ${LRM}Bild weggelassen`,
  '[16.01.26, 06:45:00] Jonas Weber: HDL \u{1F60D}'
].join('\n') + '\n');

// Android, French, 24h, curly apostrophe.
w('android_fr_1to1.txt', [
  '20/02/2026 21:05 - Chlo\u00e9 Martin: Bonne nuit \u{1F319}',
  '20/02/2026 21:06 - Hugo Bernard: Bonne nuit, je t\u2019aime',
  '21/02/2026 09:15 - Hugo Bernard: coucou',
  '21/02/2026 09:40 - Chlo\u00e9 Martin: jtm \u{1F970}'
].join('\n') + '\n');

// iOS, Brazilian Portuguese, 4-digit year, 24h.
w('ios_pt_1to1.txt', [
  '[14/02/2026 20:00:00] Ana Souza: feliz dia dos namorados',
  '[14/02/2026 20:02:00] Bruno Lima: Te amo! \u2764\ufe0f',
  '[14/02/2026 23:58:00] Ana Souza: boa noite, amo voc\u00ea',
  '[15/02/2026 00:01:00] Bruno Lima: Boa noite \u2764\ufe0f'
].join('\n') + '\n');

// Android, Italian, 2-digit year, 24h.
w('android_it_1to1.txt', [
  '13/03/26, 22:00 - Giulia Rossi: Buonanotte, ti voglio bene',
  '13/03/26, 22:03 - Marco Bianchi: buona notte \u2764\ufe0f ti amo',
  '14/03/26, 07:30 - Marco Bianchi: buongiorno',
  '14/03/26, 07:31 - Giulia Rossi: tvb'
].join('\n') + '\n');

// Telegram Desktop: a single personal chat, and a full-account export with a personal chat and a group.
const tgMsgs = [
  ['2026-01-10T08:00:00', 'Sam Park', 'morning \u2615'],
  ['2026-01-10T08:02:00', 'Kai Chen', [{ type: 'bold', text: 'morning' }, ' \u2764\ufe0f']],
  ['2026-01-10T23:15:00', 'Kai Chen', 'good night, love you'],
  ['2026-01-10T23:16:00', 'Sam Park', 'nighty night \u2764\ufe0f'],
  ['2026-01-11T09:00:00', 'Sam Park', ''], // photo
  ['2026-01-11T09:30:00', 'Kai Chen', 'ily']
].map(([date, from, text], i) => {
  const m = { id: i + 1, type: 'message', date, from, from_id: 'user' + (from === 'Sam Park' ? 1 : 2), text };
  if (text === '') m.photo = '(File not included. Change data exporting settings to download.)';
  return m;
});
const personal = { name: 'Kai Chen', type: 'personal_chat', id: 77, messages: tgMsgs };
w('telegram_personal.json', JSON.stringify(personal, null, 1));
const group = { name: 'Two of Us + Bot', type: 'private_supergroup', id: 88, messages: tgMsgs.slice(0, 4) };
w('telegram_group_two_senders.json', JSON.stringify(group, null, 1));
const bigGroup = { name: 'Book Swap', type: 'private_supergroup', id: 99, messages: tgMsgs.concat(tgMsgs).map((m, i) => ({ ...m, id: 100 + i })) };
w('telegram_full_export.json', JSON.stringify({ about: 'synthetic', chats: { list: [bigGroup, personal] } }));

// The demo couple as an iOS-style zip (what an iPhone "Export chat" makes) for the upload test.
(async () => {
  const zip = new JSZip();
  zip.file('_chat.txt', Demo.whatsappText(14));
  fs.writeFileSync(path.join(FX, 'WhatsApp Chat - Rowan Diaz.zip'), await zip.generateAsync({ type: 'nodebuffer' }));
  console.log('fixtures written to', FX);
})();
