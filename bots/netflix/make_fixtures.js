// Writes synthetic Netflix viewing-history fixtures for the tests. Every title is invented.
// Run: node bots/netflix/make_fixtures.js
const fs = require('fs'), path = require('path');
const D = require('../../docs/netflix/demo.js');
const JSZip = require('../../docs/netflix/vendor/jszip-3.10.1.min.js');
const OUT = path.join(__dirname, 'fixtures');
fs.mkdirSync(OUT, { recursive: true });
const w = (f, s) => fs.writeFileSync(path.join(OUT, f), s);
const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';

// 1. The main fixture: US format (M/D/YY), 2025 + 2026 up to Nov 13.
w('NetflixViewingHistory.csv', D.csv({ year: 2026, endMonth: 11, endDay: 13 }));
// 2. UK-style D/M/YYYY.
w('NetflixViewingHistory_uk.csv', D.csv({ year: 2026, endMonth: 11, endDay: 13, order: 'dmy' }));
// 3. German-style dotted dates with a translated header.
w('NetflixViewingHistory_de.csv', D.csv({ year: 2026, endMonth: 11, endDay: 13, order: 'dotted' }).replace(/^Title,Date/, 'Titel,Datum'));
// 4. Spreadsheet re-save: BOM, CRLF, semicolons, ISO dates, unquoted cells.
const rows = D.history({ year: 2026, endMonth: 11, endDay: 13 }).reverse().slice(0, 120);
w('excel_semicolon.csv', '\ufeffTitle;Date\r\n' + rows.map((r) => (/[;"]/.test(r[0]) ? q(r[0]) : r[0]) + ';' + D.fmtDate(r[1], 'iso')).join('\r\n') + '\r\n');
// 5. No header row at all.
w('no_header.csv', rows.slice(0, 40).map((r) => q(r[0]) + ',' + q(D.fmtDate(r[1]))).join('\n') + '\n');
// 6. Every date ambiguous (day <= 12), D/M order. Only the newest-first ordering can tell.
const amb = [];
for (let m = 12; m >= 1; m--) for (let d = 12; d >= 1; d -= 3) amb.push([`Moth & Lantern: Season 1: Night ${m}-${d}`, `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/2026`]);
w('ambiguous_dmy.csv', 'Title,Date\n' + amb.map((r) => q(r[0]) + ',' + q(r[1])).join('\n') + '\n');
// 7. Tricky titles.
const tricky = [
  ['Orbit Station: Nova Ring: Season 2: Chapter Nine: The Long Dark', '11/10/26'],
  ['Orbit Station: Nova Ring: Season 2: Signal', '11/9/26'],
  ['Deep Blue Atlas: The Kelp Cathedral', '11/8/26'],
  ['Deep Blue Atlas: Abyssal Plains', '11/7/26'],
  ['Glass Ferry: The Return', '11/6/26'],
  ['Mission: Improbable', '11/5/26'],
  ['The Velvet Heist Club: Part 2: Episode 3', '11/4/26'],
  ['Glasswing: Limited Series: Smoke', '11/3/26'],
  ['The Ferryman\u2019s Daughters: Series 1: Fog', '11/2/26'],
  ['Hollow Pines Academy: Season 1: "The Prank"', '11/1/26'],
  ['Kitchen Wars: Episode 1', '10/30/26'],
  ['Saltmarsh Inspectors: Specials: Behind the Tide', '10/29/26'],
  ['Saltmarsh Inspectors: Season 1: Tide, Wind, and Rain', '10/28/26'],
  ['Casa del Faro: Temporada 1: El regreso', '10/27/26'],
  ['  saltmarsh inspectors: Season 2: Lowercase  ', '10/26/26'],
  ['Comedy Night: Live at the Ferry Hall', '10/25/26']
];
w('tricky_titles.csv', 'Title,Date\n' + tricky.map((r) => q(r[0]) + ',' + q(r[1])).join('\n') + '\n');
// 8. Tiny, empty, and not an export.
w('tiny.csv', 'Title,Date\n"Paper Satellites","11/2/26"\n"Saltmarsh Inspectors: Season 1: Ignition","3/1/26"\n');
w('empty.csv', 'Title,Date\n');
w('not_netflix.csv', 'Book Id,Title,Author,My Rating\n1,The Glass Orchard,Imogen Vale,4\n2,Salt Tide,Silas Wren,5\n');

// 9. Full data-request archive: ViewingActivity.csv with two profiles, trailers and short sessions.
(async () => {
  const hist = D.history({ year: 2026, endMonth: 11, endDay: 13 });
  const second = D.history({ year: 2026, endMonth: 11, endDay: 13, seed: 777 }).filter((_, i) => i % 3 === 0);
  const lines = ['Profile Name,Start Time,Duration,Attributes,Title,Supplemental Video Type,Device Type,Bookmark,Latest Bookmark,Country'];
  const add = (profile, title, d, hh, dur, supp) => {
    const iso = d.toISOString().slice(0, 10) + ' ' + String(hh).padStart(2, '0') + ':14:05';
    lines.push([profile, iso, dur, '', q(title), supp || '', 'Invented Smart TV', '00:41:00', '00:41:00', 'US (United States)'].join(','));
  };
  const all = [];
  hist.forEach(([t, d]) => all.push(['Sam', t, d]));
  second.forEach(([t, d]) => all.push(['Robin', t, d]));
  all.sort((a, b) => b[2] - a[2]);
  all.forEach(([p, t, d], i) => {
    add(p, t, d, 21, '00:42:10');
    if (i % 7 === 0) add(p, t, d, 22, '00:05:40'); // a second session of the same title the same day
    if (i % 11 === 0) add(p, 'Season 2 Trailer: Saltmarsh Inspectors', d, 20, '00:01:30', 'TRAILER');
    if (i % 13 === 0) add(p, t, d, 19, '00:00:20'); // autoplay preview, too short to count
  });
  const zip = new JSZip();
  zip.file('CONTENT_INTERACTION/ViewingActivity.csv', lines.join('\n') + '\n');
  zip.file('CONTENT_INTERACTION/Ratings.csv', 'Profile Name,Title Name,Thumbs Value\nSam,Paper Satellites,2\n');
  zip.file('Cover sheet.pdf', 'not a real pdf');
  fs.writeFileSync(path.join(OUT, 'netflix-report.zip'), await zip.generateAsync({ type: 'nodebuffer' }));
  console.log('fixtures written to', OUT, fs.readdirSync(OUT).join(', '));
})();
