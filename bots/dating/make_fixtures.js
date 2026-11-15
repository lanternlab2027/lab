// Builds SYNTHETIC Tinder and Hinge exports for tests. Every name, message and number is invented.
// Strings containing CANARY must never appear in parser output or on a card.
// Run: node bots/dating/make_fixtures.js
const fs = require('fs'), path = require('path');
const JSZip = require(path.resolve(__dirname, '../../docs/dating/vendor/jszip-3.10.1.min.js'));
const OUT = path.join(__dirname, 'fixtures');
fs.mkdirSync(OUT, { recursive: true });

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const pad = (n) => String(n).padStart(2, '0');
const key = (d) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
function eachDay(from, to, fn) { for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 86400000) fn(new Date(t)); }
const NAMES = ['CANARY_Alexis', 'CANARY_Jordan', 'CANARY_Morgan', 'CANARY_Riley'];
const LINES = ['CANARY_TEXT hey there', 'CANARY_TEXT how was your week', 'CANARY_TEXT coffee sometime?', 'CANARY_TEXT ha, same'];

// ---------- Tinder ----------
function tinder({ seed = 7, from = '2025-02-01', to = '2026-11-14', likeRate = 0.38, matchRate = 0.09, iso = false, noSupers = false, quiet = false } = {}) {
  const r = rng(seed);
  const U = { app_opens: {}, swipes_likes: {}, swipes_passes: {}, superlikes: {}, matches: {}, messages_sent: {}, messages_received: {} };
  const Messages = [];
  let matchNo = 0;
  eachDay(from, to, (d) => {
    const k = key(d), m = d.getUTCMonth(), wd = d.getUTCDay();
    const season = [1.5, 1.6, 1.0, 0.9, 0.8, 0.7, 0.7, 0.8, 0.9, 1.2, 1.4, 1.6][m];
    const weekend = wd === 0 || wd === 6 ? 1.5 : 1;
    const active = r() < 0.72 * Math.min(1, season);
    const opens = active ? Math.round((2 + r() * 6) * season) : 0;
    let swipes = active ? Math.round((10 + r() * 50) * season * weekend) : 0;
    if (k === '2026-02-08') swipes = 412; // a big day
    if (k === '2025-12-28') swipes = 300;
    const likes = Math.round(swipes * likeRate * (0.8 + r() * 0.4));
    const passes = swipes - likes;
    const supers = !noSupers && active && r() < 0.1 ? 1 : 0;
    let matches = 0; for (let i = 0; i < likes; i++) if (r() < matchRate) matches++;
    const recv = active ? Math.round(r() * 12 * season) : 0;
    const sent = active ? Math.round(recv * (0.7 + r() * 0.6)) : 0;
    U.app_opens[k] = opens; U.swipes_likes[k] = likes; U.swipes_passes[k] = passes;
    if (!noSupers) U.superlikes[k] = supers;
    U.matches[k] = matches; U.messages_sent[k] = quiet ? 0 : sent; U.messages_received[k] = quiet ? 0 : recv;
    for (let i = 0; i < matches; i++) {
      matchNo++;
      const msgs = [];
      if (!quiet && r() < 0.62) {
        const n = 1 + Math.floor(r() * r() * 40) + (matchNo === 17 ? 90 : 0);
        let t = d.getTime() + (18 + r() * 6) * 3600000;
        for (let j = 0; j < n; j++) {
          t += r() * 5 * 3600000;
          const dt = new Date(t);
          msgs.push({ to: matchNo, from: 'You', message: LINES[j % LINES.length] + ' ' + NAMES[j % NAMES.length], sent_date: iso ? dt.toISOString() : dt.toUTCString(), fixed_height: '' });
        }
      }
      Messages.push({ match_id: 'Match ' + matchNo, messages: msgs });
    }
  });
  if (noSupers) delete U.superlikes;
  return {
    User: { birth_date: '1994-05-05', create_date: '2024-11-01', full_name: 'CANARY_Owner Person', name: 'CANARY_Owner', email: 'canary@example.invalid', bio: 'CANARY_BIO loves hiking', gender: 'M', interested_in: 'F', jobs: [{ title: { name: 'CANARY_JOB', displayed: true } }] },
    Usage: U, Messages, Photos: ['https://example.invalid/CANARY_photo.jpg'], Purchases: { subscription: [], consumable: [] }, Spotify: {}, Campaigns: { current_campaigns: [], expired_campaigns: [] }, Experiences: {}, SwipeNotes: []
  };
}

// ---------- Hinge legacy JSON ----------
function hingeMatches({ seed = 11, from = '2025-03-01', to = '2026-11-12' } = {}) {
  const r = rng(seed), threads = [];
  const ts = (t) => new Date(t).toISOString().replace('T', ' ').replace('Z', '').replace(/\.(\d{3})$/, '.$1000') ;
  eachDay(from, to, (d) => {
    const m = d.getUTCMonth();
    const season = [1.4, 1.5, 1.0, 0.9, 0.8, 0.7, 0.7, 0.8, 0.9, 1.1, 1.3, 1.5][m];
    if (r() > 0.6) return;
    const nLikes = Math.round((1 + r() * 7) * season);
    for (let i = 0; i < nLikes; i++) {
      const t = d.getTime() + (19 + r() * 7) * 3600000;
      const th = { like: [{ timestamp: ts(t), like: [{ timestamp: ts(t), comment: r() < 0.3 ? 'CANARY_COMMENT nice prompt' : undefined }] }] };
      if (r() < 0.22) {
        const mt = t + r() * 30 * 3600000;
        th.match = [{ timestamp: ts(mt) }];
        if (r() < 0.7) { th.chats = []; let ct = mt; const n = 1 + Math.floor(r() * r() * 30); for (let j = 0; j < n; j++) { ct += r() * 6 * 3600000; th.chats.push({ body: LINES[j % 4] + ' ' + NAMES[j % 4], timestamp: ts(ct) }); } }
        if (r() < 0.15) th.block = [{ block_type: 'remove', timestamp: ts(mt + 86400000 * 5) }];
        if (r() < 0.1) th.we_met = [{ timestamp: ts(mt + 86400000 * 9), did_meet_subject: 'Yes', was_my_type: 'true' }];
      }
      threads.push(th);
    }
    // incoming likes you matched with (no like key)
    if (r() < 0.12) {
      const mt = d.getTime() + 21 * 3600000;
      threads.push({ match: [{ timestamp: ts(mt) }], chats: [{ body: 'CANARY_TEXT hi ' + NAMES[0], timestamp: ts(mt + 3600000) }] });
    }
    if (r() < 0.05) threads.push({ block: [{ block_type: 'remove', timestamp: ts(d.getTime() + 3600000 * 12) }] });
  });
  return threads;
}

// ---------- Hinge CSV tables ----------
function csvEsc(v) { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function csv(head, rows) { return head.join(',') + '\r\n' + rows.map((r) => r.map(csvEsc).join(',')).join('\r\n') + '\r\n'; }
function hingeCsv({ seed = 23, from = '2025-10-01', to = '2026-11-13', received = true } = {}) {
  const r = rng(seed), likes = [], roses = [], skips = [], msgs = [], blocks = [];
  const ts = (t) => new Date(t).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  let conv = 0;
  eachDay(from, to, (d) => {
    if (r() > 0.55) return;
    const n = Math.round(4 + r() * 20);
    for (let i = 0; i < n; i++) {
      const t = d.getTime() + (12 + r() * 12) * 3600000;
      const x = r();
      if (x < 0.3) likes.push([ts(t), r() < 0.3 ? 'CANARY_COMMENT, "quoted", ' + NAMES[1] : '']);
      else if (x < 0.32) roses.push([ts(t), '']);
      else skips.push([ts(t), '']);
    }
    if (r() < 0.25) {
      conv++;
      const id = 'CANARY_MATCHID_' + conv.toString(16).padStart(8, '0');
      let t = d.getTime() + 20 * 3600000; const n = 2 + Math.floor(r() * 25);
      const firstThem = received && r() < 0.4;
      for (let j = 0; j < n; j++) {
        t += r() * 4 * 3600000;
        const mine = !received ? true : (j === 0 ? !firstThem : r() < 0.5);
        msgs.push([LINES[j % 4] + '\nsecond line, ' + NAMES[j % 4], mine ? 'sent' : 'received', ts(t), id]);
      }
    }
    if (r() < 0.03) blocks.push([ts(d.getTime() + 3600000 * 9), '']);
  });
  return {
    'user.csv': csv(['timestamp', 'signup_timestamp', 'age', 'first_name', 'job_title'], [[ts(Date.parse(from)), '2025-09-20 10:00:00', '31', 'CANARY_Owner', 'CANARY_JOB']]),
    'match_likes.csv': csv(['timestamp', 'comment'], likes),
    'match_roses.csv': csv(['timestamp', 'comment'], roses),
    'match_skips.csv': csv(['timestamp', 'comment'], skips),
    'match_blocks.csv': csv(['timestamp', 'comment'], blocks),
    'chat_message.csv': csv(['message', 'action', 'timestamp', 'match_id'], msgs),
    'profile_prompt_answers.csv': csv(['active', 'timestamp', 'prompt', 'answer'], [['true', ts(Date.parse(from)), 'My simple pleasures', 'CANARY_PROMPT_ANSWER']])
  };
}

(async () => {
  const w = (n, s) => fs.writeFileSync(path.join(OUT, n), s);
  const T = tinder();
  w('data.json', JSON.stringify(T));
  w('tinder_iso.json', JSON.stringify(tinder({ seed: 99, iso: true, noSupers: true, from: '2026-01-01', to: '2026-06-30' })));
  w('tinder_zero_matches.json', JSON.stringify(tinder({ seed: 5, matchRate: 0, quiet: true, from: '2026-03-01', to: '2026-03-20' })));
  w('tinder_2024_only.json', JSON.stringify(tinder({ seed: 3, from: '2024-04-01', to: '2024-09-30' })));
  w('tinder_empty_usage.json', JSON.stringify({ User: { name: 'CANARY_Owner' }, Usage: { app_opens: {}, swipes_likes: {}, swipes_passes: {}, matches: {}, messages_sent: {}, messages_received: {} }, Messages: [] }));
  // Tinder's real zip: data.json plus an index.html viewer and photos.
  let z = new JSZip();
  z.file('tinder-export/data.json', JSON.stringify(T));
  z.file('tinder-export/index.html', '<html><body>CANARY_HTML ' + NAMES[0] + '</body></html>');
  z.file('tinder-export/photos/1.jpg', Buffer.alloc(2048, 7));
  z.file('__MACOSX/tinder-export/._data.json', 'junk');
  w('tinder-export.zip', await z.generateAsync({ type: 'nodebuffer' }));

  const H = hingeMatches();
  w('matches.json', JSON.stringify(H, null, 1));
  z = new JSZip();
  z.file('export/matches.json', JSON.stringify(H));
  z.file('export/user.json', JSON.stringify({ profile: { first_name: 'CANARY_Owner', job_title: 'CANARY_JOB' }, account: { signup_time: '2025-02-20 10:00:00' } }));
  z.file('export/prompts.json', JSON.stringify([{ id: 1, prompt: 'My simple pleasures', type: 'text', text: 'CANARY_PROMPT_ANSWER', created: '2025-03-01 10:00:00', user_updated: '2025-03-01 10:00:00' }]));
  z.file('export/media.json', JSON.stringify([{ url: 'https://example.invalid/CANARY.jpg', type: 'photo' }]));
  z.file('export/media/1.jpg', Buffer.alloc(4096, 3));
  w('hinge-export.zip', await z.generateAsync({ type: 'nodebuffer' }));

  const C = hingeCsv();
  z = new JSZip();
  Object.entries(C).forEach(([n, s]) => z.file('Hinge Data/tables/' + n, s));
  z.file('Hinge Data/tables/chat_message.txt', 'Description of chat_message table');
  z.file('__MACOSX/Hinge Data/tables/._chat_message.csv', 'junk');
  w('hinge-csv-export.zip', await z.generateAsync({ type: 'nodebuffer' }));
  fs.mkdirSync(path.join(OUT, 'hinge_csv'), { recursive: true });
  Object.entries(C).forEach(([n, s]) => w('hinge_csv/' + n, s));
  const Csent = hingeCsv({ seed: 41, received: false, from: '2026-05-01', to: '2026-09-30' });
  z = new JSZip(); Object.entries(Csent).forEach(([n, s]) => z.file(n, s));
  w('hinge-csv-sent-only.zip', await z.generateAsync({ type: 'nodebuffer' }));

  w('not_dating.json', JSON.stringify({ hello: 'world', items: [1, 2, 3] }));
  w('broken.json', '{"Usage": {"app_opens": {"2026-01-01": 3,');
  w('empty.json', '');
  w('notes.txt', 'just some text');
  console.log('fixtures written to', OUT);
})();
