// Builds synthetic TikTok export fixtures in bots/tiktok/fixtures/. Run: node bots/tiktok/make_fixtures.js
// Layouts follow the real export (see NOTES.md for sources); every value is invented by docs/tiktok/demo.js.
const fs = require('fs'), path = require('path');
const D = require('../../docs/tiktok/demo.js');
const JSZip = require('../../docs/tiktok/vendor/jszip-3.10.1.min.js');
const FX = path.join(__dirname, 'fixtures');
fs.mkdirSync(FX, { recursive: true });
const CANARY = 'SECRET-DM-CANARY-7731';
const put = (f, s) => fs.writeFileSync(path.join(FX, f), s);

const data = D.build({ year: 2026, endMonth: 11, endDay: 14, seed: 4242, dmCanary: CANARY });
const A = data['Your Activity'], L = data['Likes and Favorites'];

// 1. 2024+ JSON layout (user_data_tiktok.json), pretty-printed like TikTok's file.
put('user_data_tiktok.json', JSON.stringify(data, null, 2));

// 2. Legacy JSON layout (user_data.json, 2023 and earlier): "Activity" > "Video Browsing History".
const legacy = {
  Activity: {
    'Favorite Videos': { FavoriteVideoList: L['Favorite Videos'].FavoriteVideoList },
    'Like List': { ItemFavoriteList: L['Like List'].ItemFavoriteList },
    'Login History': A['Login History'],
    'Search History': { SearchList: A.Searches.SearchList },
    'Share History': A['Share History'],
    'Video Browsing History': { VideoList: A['Watch History'].VideoList }
  },
  Comment: data.Comment,
  'Direct Messages': { 'Chat History': { ChatHistory: { 'Chat History with friend_one:': [{ Date: '2026-11-01 10:00:00', From: 'friend_one', Content: CANARY }] } } },
  Video: { Videos: { VideoList: [{ Date: '2026-05-01 10:00:00', Link: 'https://www.tiktokv.com/share/video/7000000000000000001/', Likes: '3' }] } }
};
put('user_data_legacy.json', JSON.stringify(legacy, null, 2));

// 3. TXT export: blank-line separated "Label: value" blocks, dates with " UTC".
const blocks = (list, fn) => list.map((x) => fn(x).join('\n')).join('\n\n') + '\n';
const U = (s) => s + ' UTC';
const txt = {
  'Your Activity/Watch History.txt': blocks(A['Watch History'].VideoList, (x) => ['Date: ' + U(x.Date), 'Link: ' + x.Link]),
  'Your Activity/Searches.txt': blocks(A.Searches.SearchList, (x) => ['Date: ' + U(x.Date), 'Search Term: ' + x.SearchTerm]),
  'Your Activity/Share History.txt': blocks(A['Share History'].ShareHistoryList, (x) => ['Date: ' + U(x.Date), 'Shared Content: ' + x.SharedContent, 'Link: ' + x.Link, 'Method: ' + x.Method]),
  'Your Activity/Login History.txt': blocks(A['Login History'].LoginHistoryList, (x) => ['Date: ' + U(x.Date), 'IP: ' + x.IP, 'Device Model: ' + x.DeviceModel, 'Device System: ' + x.DeviceSystem, 'Network Type: ' + x.NetworkType, 'Carrier: ' + x.Carrier]),
  'Likes and Favourites/Like List.txt': blocks(L['Like List'].ItemFavoriteList, (x) => ['Date: ' + U(x.date), 'Link: ' + x.link]),
  'Likes and Favourites/Favourite Videos.txt': blocks(L['Favorite Videos'].FavoriteVideoList, (x) => ['Date: ' + U(x.Date), 'Link: ' + x.Link]),
  'Comment/Comments.txt': blocks(data.Comment.Comments.CommentsList, (x) => ['Date: ' + U(x.date), 'Comment: ' + x.comment]),
  'Direct Message/Direct Messages.txt': '>>> Chat History with friend_one::\nDate: 2026-11-01 10:00:00 UTC\nFrom: friend_one\nContent: ' + CANARY + '\n'
};

(async () => {
  const z1 = new JSZip();
  Object.keys(txt).forEach((k) => z1.file('TikTok/' + k, txt[k]));
  put('tiktok_txt_export.zip', await z1.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

  const z2 = new JSZip();
  z2.file('user_data_tiktok.json', JSON.stringify(data));
  put('tiktok_json_export.zip', await z2.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

  // Legacy TXT names (Activity/Browsing History.txt), no " UTC", CRLF line endings.
  const crlf = (s) => s.replace(/ UTC/g, '').replace(/\n/g, '\r\n');
  const z3 = new JSZip();
  z3.file('Activity/Browsing History.txt', crlf(txt['Your Activity/Watch History.txt']));
  z3.file('Activity/Like List.txt', crlf(txt['Likes and Favourites/Like List.txt']));
  z3.file('Activity/Searches.txt', crlf(txt['Your Activity/Searches.txt']));
  z3.file('Direct Messages/Direct Messages.txt', txt['Direct Message/Direct Messages.txt']);
  put('tiktok_txt_legacy.zip', await z3.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

  put('Watch History.txt', txt['Your Activity/Watch History.txt']);

  // Sections present but empty (TikTok writes null for empty lists).
  put('empty_sections.json', JSON.stringify({ 'Your Activity': { 'Watch History': { VideoList: null }, Searches: { SearchList: null } }, 'Likes and Favorites': { 'Like List': { ItemFavoriteList: null } }, Comment: { Comments: { CommentsList: null } } }, null, 2));
  // Watch history only: other sections missing or null.
  put('watch_only.json', JSON.stringify({ 'Your Activity': { 'Watch History': { VideoList: A['Watch History'].VideoList.slice(0, 900) }, Searches: { SearchList: null } } }, null, 2));
  // Time-zone probes around UTC midnight.
  put('tz.json', JSON.stringify({ 'Your Activity': { 'Watch History': { VideoList: [
    { Date: '2026-03-01 03:30:00', Link: 'https://www.tiktokv.com/share/video/7400000000000000001/' },
    { Date: '2026-03-01 03:31:00', Link: 'https://www.tiktokv.com/share/video/7400000000000000002/' },
    { Date: '2026-01-01 02:00:00 UTC', Link: 'https://www.tiktokv.com/share/video/7400000000000000003/' },
    { Date: '2026-06-30 23:30:00', Link: 'https://www.tiktokv.com/share/video/7400000000000000004/' }
  ] } } }, null, 2));
  put('tiny.json', JSON.stringify({ 'Your Activity': { 'Watch History': { VideoList: [
    { Date: '2026-10-02 21:00:00', Link: 'https://www.tiktokv.com/share/video/7400000000000000011/' },
    { Date: '2026-10-02 21:00:40', Link: 'https://www.tiktokv.com/share/video/7400000000000000012/' },
    { Date: '2026-10-04 12:00:00', Link: 'https://www.tiktokv.com/share/video/7400000000000000013/' }
  ] } } }, null, 2));
  put('not_tiktok.json', JSON.stringify({ messages: [{ text: 'hi' }], items: [{ a: 1 }] }));
  put('empty.json', '');
  console.log('fixtures written:', fs.readdirSync(FX).join(', '));
})();
