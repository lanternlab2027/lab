// Writes synthetic fixtures for Reading Wrapped to bots/reading/fixtures/. Every title and name is invented.
// Run: node bots/reading/make_fixtures.js
const fs = require('fs'), path = require('path');
const D = require('../../docs/reading/demo.js');
const JSZip = require('../../docs/reading/vendor/jszip-3.10.1.min.js');
const OUT = path.join(__dirname, 'fixtures');
fs.mkdirSync(OUT, { recursive: true });
const w = (f, s) => { fs.writeFileSync(path.join(OUT, f), s); console.log('wrote', f); };

// 1-2. Full synthetic libraries (2024-2026, through November 2026).
const gr = D.goodreadsCSV({ year: 2026, month: 11 });
w('goodreads_library_export.csv', gr);
w('storygraph_export.csv', D.storygraphCSV({ year: 2026, month: 11 }));

// 3. Goodreads oddities: BOM + CRLF, legacy extra columns, missing author (only "Author l-f"), no pages, zero pages,
//    unrated, read with no Date Read, custom DNF exclusive shelf, multiline review with quotes and commas, series title,
//    Read Count 2, a blank line and a short (truncated) row.
const legacy = 'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Recommended For,Recommended By,Owned Copies,Original Purchase Date,Original Purchase Location,Condition,Condition Description,BCID';
const odd = [
  '﻿' + legacy,
  '1,"The Quiet Harbor (Lantern Coast, #2)",Imogen Vale,"Vale, Imogen",,"=""0000000000""","=""9780000000001""",5,4.21,Lantern House,Paperback,402,2025,2025,2026/03/14,2026/01/02,"fantasy, favorites","fantasy (#3), favorites (#1)",read,"Wow.\nJust ""wow"", honestly, start to finish.",,,2,,,1,,,,,',
  '2,Paper Lanterns,,"Sol, Nadia",,"=""""","=""""",0,3.80,,Kindle Edition,,2024,,2026/07/01,2026/06/20,"memoir, kindle","memoir (#1), kindle (#2)",read,,,,1,,,0,,,,,',
  '3,The Copper Ferry,Rowan Ashby,"Ashby, Rowan",,,,4,0,,Hardcover,0,,,2026/08/09,2026/08/01,mystery,mystery (#4),read,,,,,,,,,,,,',
  '4,Undated Atlas,Silas Wren,"Wren, Silas",,,,3,3.9,,Paperback,250,2001,1999,,2026/02/11,"sci-fi",sci-fi (#1),read,,,,1,,,1,,,,,',
  '5,The Patient Engine,Arjun Velasco,"Velasco, Arjun",,,,0,3.5,,Paperback,640,2020,2020,,2026/04/18,"abandoned, sci-fi","abandoned (#1)",abandoned,,,,0,,,0,,,,,',
  '6,Somewhere Next,Bea Kowalczyk,"Kowalczyk, Bea",,,,0,4.0,,Paperback,300,2026,2026,,2026/10/01,to-read,to-read (#9),to-read,,,,0,,,0,,,,,',
  '',
  '7,Short Row Book,Tomas Arroyo,"Arroyo, Tomas",,,,4,4.1,,Audiobook,310,2023,2023,2026/09/30',
].join('\r\n') + '\r\n';
w('goodreads_odd.csv', odd);

// 4. Goodreads export re-saved by a spreadsheet: semicolons, M/D/YYYY dates, ISBNs unwrapped, columns reordered,
//    "Average Rating" dropped, decimal comma.
w('goodreads_excel_semicolon.csv', [
  'Title;Author;Exclusive Shelf;Date Read;Date Added;My Rating;Number of Pages;Bookshelves;Read Count;ISBN13;Binding',
  'The Salt Orchard;Imogen Vale;read;1/15/2026;12/20/2025;4;1.234;fantasy;1;9780000000002;Hardcover',
  '"Garden; of Rivers";Theo Marchetti;read;7/4/2026;6/1/2026;5;310;literary-fiction, favorites;1;9780000000003;Paperback',
  'Ember Choir;Theo Marchetti;read;14/07/2026;6/1/2026;3;288;literary-fiction;1;9780000000004;Paperback',
  'Northern Map;Cora Lindqvist;read;3/2/2025;1/1/2025;4;199;mystery;1;9780000000005;Paperback',
].join('\r\n') + '\r\n');

// 5. StoryGraph oddities: BOM, reordered subset of columns, no Moods/Tags, multiple read periods (a re-read),
//    a partial date, quarter-star ratings, paused, DNF with Last Date Read, read with no dates, multiple authors.
w('storygraph_odd.csv', '﻿' + [
  'Read Status,Title,Authors,Star Rating,Last Date Read,Dates Read,Read Count,Format,Date Added,ISBN/UID',
  'read,The Velvet Almanac,Silas Wren,4.75,2026/02/12,"2019/03/01-2019/03/10, 2026/02/01-2026/02/12",2,paperback,2019/02/01,9780000000010',
  'read,"Ledger, Of Small Hours","Maren Holloway, Hugo Brannagh",3.25,2026/05/30,2026/05/01-2026/05/30,1,digital,2026/04/01,9780000000011',
  'read,Month Only,Calla Thorne,4,,2026/06,1,audio,2026/05/01,',
  'read,No Dates At All,Felix Abernathy,2.5,,,1,paperback,2026/03/03,',
  'paused,Halfway House,Elsie Fairweather,,,2026/01/05-,0,paperback,2025/12/01,',
  'did-not-finish,The Patient Engine,Arjun Velasco,,2026/04/18,,0,hardcover,2026/04/01,',
  'to-read,Someday Book,Wren Delacroix,,,,0,,2026/09/09,',
].join('\n') + '\n');

// 6-7. Not an export; an export with no books.
w('not_an_export.csv', 'date,amount,merchant\n2026-01-01,4.50,Coffee\n');
w('empty_goodreads.csv', D.GR_HEAD + '\n');

// 8. Tiny library: two books this year.
w('tiny_goodreads.csv', [D.GR_HEAD,
  '1,Only Two,Ada Okonkwo-Reyes,"Okonkwo-Reyes, Ada",,,,4,4.0,,Paperback,220,2026,2026,2026/02/02,2026/01/01,,,read,,,,1,1',
  '2,Books Here,Priya Castellan,"Castellan, Priya",,,,5,4.4,,Paperback,330,2026,2026,2026/03/03,2026/01/01,,,read,,,,1,1'].join('\n') + '\n');

// 9-10. Libby timeline, Spreadsheet (CSV) and Data (JSON) shapes, built from the same made-up library.
//       Columns/keys follow open-source Libby parsers (see bots/reading/NOTES.md); every value is invented.
const lb = D.libbyCSV({ year: 2026, month: 11 });
w('libbytimeline-activities.csv', lb);
w('libbytimeline-activities.json', D.libbyJSON({ year: 2026, month: 11 }));

// 11. Libby oddities: BOM + CRLF, an extra column, the three timestamp styles seen in the wild
//     (M/D/YY h:mm, "Month D, YYYY h:mm AM", epoch ms, ISO with and without a zone), a return with no borrow in the export, a finished marker,
//     a renewal, a re-borrow after a return, an expired loan, a cancelled hold, a blank line and junk rows.
w('libby_odd.csv', '﻿' + [
  'Cover,Title,Author,Publisher,ISBN,Timestamp,Activity,Details,Library,Color',
  ',"The Quiet Harbor (Lantern Coast, #2)",Imogen Vale,Lantern House,9780000000001,3/14/26 19:05,Returned,,Lantern Valley Public Library,#123456',
  ',"The Quiet Harbor (Lantern Coast, #2)",Imogen Vale,Lantern House,9780000000001,2/28/26 08:15,Borrowed, 21 days ,Lantern Valley Public Library,#123456',
  ',"The Quiet Harbor (Lantern Coast, #2)",Imogen Vale,Lantern House,9780000000001,1/02/26 08:15,Placed on hold,,Lantern Valley Public Library,#123456',
  ',Paper Lanterns,Nadia Sol,Brightwater Audio,,"July 1, 2026 9:41 PM",Returned,,Harbor County Library,',
  ',Paper Lanterns,Nadia Sol,Brightwater Audio,,"June 20, 2026 7:02 AM",Borrowed, 14 days ,Harbor County Library,',
  ',The Copper Ferry,Rowan Ashby,Lantern House,,1786262400000,Returned,,Lantern Valley Public Library,',
  ',Short Row Book,Tomas Arroyo,Lantern House Audio,,2026-09-30T12:00:00Z,Finished,,Lantern Valley Public Library,',
  ',Undated Atlas,Silas Wren,Lantern House,,2026-04-02 12:00,Renewed, 21 days ,Lantern Valley Public Library,',
  ',Undated Atlas,Silas Wren,Lantern House,,2026-03-12 12:00,Borrowed, 21 days ,Lantern Valley Public Library,',
  ',The Velvet Almanac,Silas Wren,Lantern House,,2026-08-20 12:00,Borrowed, 21 days ,Lantern Valley Public Library,',
  ',The Velvet Almanac,Silas Wren,Lantern House,,2026-02-12 12:00,Returned,,Lantern Valley Public Library,',
  ',The Velvet Almanac,Silas Wren,Lantern House,,2026-02-01 12:00,Borrowed, 21 days ,Lantern Valley Public Library,',
  ',Somewhere Next,Bea Kowalczyk,Lantern House,,2026-10-01 12:00,Hold cancelled,,Lantern Valley Public Library,',
  '',
  ',,No Title Row,Lantern House,,2026-05-05 12:00,Borrowed,,Lantern Valley Public Library,',
  ',Bad Date Row,Wren Delacroix,Lantern House,,someday,Borrowed,,Lantern Valley Public Library,',
].join('\r\n') + '\r\n');

// 12. A filtered timeline with nothing in it; a JSON file that isn't Libby's.
w('libby_empty.csv', D.LIBBY_HEAD + '\n');
w('not_libby.json', JSON.stringify({ hello: 'world', items: 3 }) + '\n');

// 14. QA Nov 15 2026: a UK-locale Libby spreadsheet with day-first "DD/MM/YYYY HH:MM" timestamps.
//     Only one row has a day > 12, so per-row parsing alone would put the rest in the wrong month.
w('libby_uk_dayfirst.csv', [
  'Cover,Title,Author,Publisher,ISBN,Timestamp,Activity,Details,Library',
  'https://covers.example.invalid/a.jpg,The Quiet Ferry,Mara Ellison,Lantern House,9780000000011,03/04/2026 09:15,Borrowed, 14 days ,Lantern Valley Libraries',
  'https://covers.example.invalid/a.jpg,The Quiet Ferry,Mara Ellison,Lantern House,9780000000011,10/04/2026 21:40,Returned,,Lantern Valley Libraries',
  'https://covers.example.invalid/b.jpg,Salt and Signal,Ivo Brandt,Harbor Audio,9780000000028,01/02/2026 18:05,Borrowed, 21 days ,Lantern Valley Libraries',
  'https://covers.example.invalid/b.jpg,Salt and Signal,Ivo Brandt,Harbor Audio,9780000000028,19/02/2026 07:30,Returned,,Lantern Valley Libraries',
].join('\r\n') + '\r\n');

// 13. The Goodreads export inside a zip; the Libby JSON inside a zip.
(async () => {
  const z = new JSZip();
  z.file('goodreads_library_export.csv', gr);
  w('goodreads_export.zip', await z.generateAsync({ type: 'nodebuffer' }));
  const z2 = new JSZip();
  z2.file('libbytimeline-activities.json', D.libbyJSON({ year: 2026, month: 11 }));
  w('libby_export.zip', await z2.generateAsync({ type: 'nodebuffer' }));
})();
