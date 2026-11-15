// Writes synthetic fixtures for Year in Motion tests. Run: node bots/sport/make_fixtures.js
// Everything is generated: the athlete and routes come from docs/sport/demo.js (procedural shapes in the open
// Atlantic), and the FIT files are written by a small encoder below. No real person's data is used.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const JSZip = require(path.resolve(__dirname, '../../docs/sport/vendor/jszip-3.10.1.min.js'));
const D = require('../../docs/sport/demo.js');
const OUT = path.join(__dirname, 'fixtures');
fs.mkdirSync(OUT, { recursive: true });
const w = (f, b) => fs.writeFileSync(path.join(OUT, f), b);

// ---------- minimal FIT encoder ----------
// Records use a big-endian definition with a developer field; every other point uses a compressed-timestamp header.
function fitFile(pts, sport, startUtc, elapsedS, distM, ascentM) {
  const FE = 631065600000, out = [];
  const u8 = (v) => out.push(v & 255);
  const u16le = (v) => { u8(v); u8(v >> 8); };
  const u32le = (v) => { u8(v); u8(v >> 8); u8(v >> 16); u8(v >>> 24); };
  const u32be = (v) => { u8(v >>> 24); u8(v >> 16); u8(v >> 8); u8(v); };
  const ts = (ms) => Math.round((ms - FE) / 1000);
  const semi = (deg) => Math.round(deg * 2147483648 / 180) | 0;
  // def local 0: record, big-endian, fields 253 u32, 0 s32, 1 s32, 78 u32; 1 developer field of 2 bytes
  u8(0x40 | 0x20 | 0); u8(0); u8(1); u8(0); u8(20); u8(4);
  [[253, 4, 0x86], [0, 4, 0x85], [1, 4, 0x85], [78, 4, 0x86]].forEach(([n, s, b]) => { u8(n); u8(s); u8(b); });
  u8(1); u8(0); u8(2); u8(0);
  // def local 2: record without timestamp (for compressed-timestamp records), little-endian
  u8(0x40 | 2); u8(0); u8(0); u16le(20); u8(3);
  [[0, 4, 0x85], [1, 4, 0x85], [78, 4, 0x86]].forEach(([n, s, b]) => { u8(n); u8(s); u8(b); });
  let last = null;
  pts.forEach((p, i) => {
    const t = ts(p[2]), alt = Math.round((p[3] + 500) * 5);
    if (i % 2 === 1 && last != null && t - last < 31 && t > last) {
      u8(0x80 | (2 << 5) | (t & 0x1f));
      u32le(semi(p[0])); u32le(semi(p[1])); u32le(alt);
    } else {
      u8(0); u32be(t); u32be(semi(p[0])); u32be(semi(p[1])); u32be(alt); u8(0xab); u8(0xcd);
    }
    last = t;
  });
  // def local 1: session
  u8(0x40 | 1); u8(0); u8(0); u16le(18); u8(6);
  [[253, 4, 0x86], [2, 4, 0x86], [5, 1, 0x00], [7, 4, 0x86], [9, 4, 0x86], [22, 2, 0x84]].forEach(([n, s, b]) => { u8(n); u8(s); u8(b); });
  u8(1); u32le(ts(startUtc + elapsedS * 1000)); u32le(ts(startUtc)); u8(sport); u32le(Math.round(elapsedS * 1000)); u32le(Math.round(distM * 100)); u16le(Math.round(ascentM));
  const data = Buffer.from(out), h = Buffer.alloc(14);
  h[0] = 14; h[1] = 0x20; h.writeUInt16LE(2132, 2); h.writeUInt32LE(data.length, 4); h.write('.FIT', 8, 'ascii');
  return Buffer.concat([h, data, Buffer.from([0, 0])]);
}
const FIT_SPORT = { Run: 1, Ride: 2, Walk: 11, Hike: 17 };

(async () => {
  const acts = D.build({ seed: 7, fromYear: 2025, to: Date.UTC(2026, 10, 12) });
  const csv = D.stravaCSV(acts);
  w('strava_activities.csv', csv);

  // Strava bulk export zip: activities.csv + activities/ (gpx, gpx.gz, fit.gz) + a media/ folder we must ignore.
  const z = new JSZip();
  z.file('activities.csv', csv);
  z.file('profile.csv', 'Athlete ID,Email Address\n1,someone@example.com\n');
  let nGps = 0;
  acts.forEach((a) => {
    if (!a.file) return;
    const pts = D.trackFor(a);
    nGps++;
    if (/\.fit\.gz$/.test(a.file)) z.file(a.file, zlib.gzipSync(fitFile(pts, FIT_SPORT[a.type] || 0, a.utc, a.elapsed, a.dist, a.elev)));
    else if (nGps % 3 === 0) { a.file += '.gz'; z.file(a.file, zlib.gzipSync(D.gpx(a, pts))); }
    else z.file(a.file, D.gpx(a, pts));
  });
  // the csv must reflect renamed .gpx.gz files
  z.file('activities.csv', D.stravaCSV(acts));
  for (let i = 0; i < 4; i++) z.file('media/photo_' + i + '.jpg', Buffer.alloc(200000, i), { compression: 'STORE' });
  w('strava_export.zip', await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

  // Older Strava layout (single block of columns, "Distance" in km)
  const old = ['Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance,Relative Effort,Commute,Activity Gear,Filename'];
  acts.slice(0, 120).forEach((a) => old.push([a.id, '"' + new Date(a.utc).toUTCString().replace(/^\w+, (\d+) (\w+) (\d+) (\d+):(\d+):(\d+) GMT$/, (m, d, mo, y, h, mi, s) => mo + ' ' + +d + ', ' + y + ', ' + ((+h % 12) || 12) + ':' + mi + ':' + s + ' ' + (+h >= 12 ? 'PM' : 'AM')) + '"', a.name, a.type, '', a.elapsed, (a.dist / 1000).toFixed(2), '', 'false', '', ''].join(',')));
  w('strava_old.csv', old.join('\n') + '\n');

  // Localized headers (made-up translation; same column order as the real export), Spanish-style dates, decimal commas.
  const loc = ['ID de la actividad;Fecha de la actividad;Nombre de la actividad;Tipo de actividad;Descripción;Tiempo transcurrido;Distancia;Frecuencia cardíaca máxima;Esfuerzo relativo;Desplazamiento;Nota privada;Equipo;Nombre del archivo'];
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
  acts.slice(0, 80).forEach((a) => { const d = new Date(a.utc); loc.push([a.id, d.getUTCDate() + ' ' + MES[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ', ' + d.toISOString().slice(11, 19), a.name, a.type, '', a.elapsed, (a.dist / 1000).toFixed(2).replace('.', ','), '', '', 'false', '', '', a.file].join(';')); });
  w('strava_localized.csv', '﻿' + loc.join('\r\n') + '\r\n');
  // QA Nov 15 2026: CJK display locales. Japanese "2026\u5e7411\u670810\u65e5 11:12:07";
  // Korean "2026. 11. 10. \uc624\ud6c4 3:12:07" (AM/PM as a word before a 12-hour time). Same column order.
  const cjk = (fmt) => [loc[0]].concat(acts.slice(0, 40).map((a) => { const d = new Date(a.utc); return [a.id, fmt(d), a.name, a.type, '', a.elapsed, (a.dist / 1000).toFixed(2), '', '', 'false', '', '', a.file].join(';'); })).join('\r\n') + '\r\n';
  w('strava_ja.csv', cjk((d) => d.getUTCFullYear() + '\u5e74' + (d.getUTCMonth() + 1) + '\u6708' + d.getUTCDate() + '\u65e5 ' + d.toISOString().slice(11, 19)));
  w('strava_ko.csv', cjk((d) => { const h = d.getUTCHours(); return d.getUTCFullYear() + '. ' + (d.getUTCMonth() + 1) + '. ' + d.getUTCDate() + '. ' + (h >= 12 ? '\uc624\ud6c4 ' : '\uc624\uc804 ') + ((h % 12) || 12) + d.toISOString().slice(13, 19); }));

  // Garmin Connect "Export CSV" (metric account and imperial account)
  const GT = { Run: 'Running', Ride: 'Cycling', Swim: 'Pool Swim', 'Weight Training': 'Strength Training', Hike: 'Hiking', Walk: 'Walking', Yoga: 'Yoga' };
  const GH = 'Activity Type,Date,Favorite,Title,Distance,Calories,Time,Avg HR,Max HR,Aerobic TE,Avg Run Cadence,Max Run Cadence,Avg Pace,Best Pace,Total Ascent,Total Descent,Avg Stride Length,Training Stress Score®,Steps,Min Temp,Decompression,Best Lap Time,Number of Laps,Max Temp,Moving Time,Elapsed Time,Min Elevation,Max Elevation';
  const hms = (s) => { s = Math.round(s); return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':'); };
  const garmin = (imp) => {
    const rows = [GH];
    acts.forEach((a, i) => {
      const local = new Date(a.utc + D.OFFSET * 60000).toISOString().replace('T', ' ').slice(0, 19);
      const swim = a.type === 'Swim';
      let dist = swim ? (imp ? a.dist / 0.9144 : a.dist).toFixed(0) : (a.dist / (imp ? 1609.344 : 1000)).toFixed(2);
      if (swim) dist = Number(dist).toLocaleString('en-US');
      const asc = a.elev ? Math.round(a.elev * (imp ? 3.28084 : 1)).toLocaleString('en-US') : '--';
      const temp = imp ? (50 + (i % 30)).toFixed(1) : (10 + (i % 15)).toFixed(1);
      rows.push([GT[a.type] || a.type, local, 'false', '"' + a.name + '"', '"' + (a.dist ? dist : '0.00') + '"', '"' + (300 + i % 400) + '"', '"' + hms(a.elapsed) + '"', '"140"', '"170"', '"3.0"', '"--"', '"--"', '"--"', '"--"', '"' + asc + '"', '"' + asc + '"', '"1.10"', '"0.0"', '"4,808"', '"' + temp + '"', '"No"', '"00:05:00"', '"3"', '"' + temp + '"', '"' + hms(a.moving) + '"', '"' + hms(a.elapsed) + '"', '"--"', '"' + (imp ? 1200 : 380) + '"'].join(','));
    });
    return rows.join('\n') + '\n';
  };
  w('garmin_activities_metric.csv', garmin(false));
  w('garmin_activities_imperial.csv', garmin(true));

  // Garmin "Export Your Data" archive with summarizedActivities.json (cm, ms)
  const gz = new JSZip();
  gz.file('DI_CONNECT/DI-Connect-Fitness/someone_0_summarizedActivities.json', JSON.stringify([{ summarizedActivitiesExport: acts.map((a, i) => ({ activityId: i + 1, name: a.name, activityType: (GT[a.type] || a.type).toLowerCase().replace(/ /g, '_'), startTimeLocal: a.utc + D.OFFSET * 60000, startTimeGmt: a.utc, duration: a.elapsed * 1000, movingDuration: a.moving * 1000, distance: a.dist * 100, elevationGain: a.elev * 100 })) }]));
  gz.file('DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_0-_Part1.zip', Buffer.alloc(1000));
  w('garmin_data_export.zip', await gz.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

  // Loose route files: GPX, GPX.gz, TCX, FIT, FIT.gz
  const gpsActs = acts.filter((a) => a.file && a.utc >= Date.UTC(2026, 0, 1)).slice(0, 12);
  gpsActs.forEach((a, i) => {
    const pts = D.trackFor(a), n = 'route_' + String(i + 1).padStart(2, '0');
    if (i < 6) w(n + '.gpx', D.gpx(a, pts));
    else if (i < 8) w(n + '.gpx.gz', zlib.gzipSync(D.gpx(a, pts)));
    else if (i < 9) w(n + '.tcx', tcx(a, pts));
    else if (i < 11) w(n + '.fit', fitFile(pts, FIT_SPORT[a.type] || 0, a.utc, a.elapsed, a.dist, a.elev));
    else w(n + '.fit.gz', zlib.gzipSync(fitFile(pts, FIT_SPORT[a.type] || 0, a.utc, a.elapsed, a.dist, a.elev)));
  });
  // A GPX with no timestamps, odd attribute order and a namespace prefix
  w('route_notime.gpx', '<?xml version="1.0"?>\n<gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/1"><gpx:trk><gpx:name>Loop</gpx:name><gpx:trkseg>' +
    Array.from({ length: 60 }, (_, k) => { const t = k / 59 * Math.PI * 2; return `<gpx:trkpt lon='${(D.LON0 + 0.01 * Math.cos(t)).toFixed(6)}' lat='${(D.LAT0 + 0.01 * Math.sin(t)).toFixed(6)}'/>`; }).join('') + '</gpx:trkseg></gpx:trk></gpx:gpx>');

  // Bad inputs
  w('not_an_export.csv', 'Name,Email\nSam,sam@example.com\n');
  w('empty_strava.csv', D.stravaCSV([]).split('\n')[0] + '\n');
  w('corrupt.zip', Buffer.from('PK\u0003\u0004 this is not really a zip'));
  w('broken.fit', Buffer.from('not a fit file at all'));
  console.log('fixtures written to', OUT, '(' + acts.length + ' activities, ' + nGps + ' routes in the Strava zip)');
})();

function tcx(a, pts) {
  const t = (ms) => new Date(ms).toISOString();
  return '<?xml version="1.0" encoding="UTF-8"?>\n<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="' + (a.type === 'Ride' ? 'Biking' : 'Running') + '"><Id>' + t(a.utc) + '</Id><Lap StartTime="' + t(a.utc) + '"><TotalTimeSeconds>' + a.moving + '</TotalTimeSeconds><DistanceMeters>' + a.dist.toFixed(1) + '</DistanceMeters><Track>' +
    pts.map((p) => '<Trackpoint><Time>' + t(p[2]) + '</Time><Position><LatitudeDegrees>' + p[0].toFixed(7) + '</LatitudeDegrees><LongitudeDegrees>' + p[1].toFixed(7) + '</LongitudeDegrees></Position><AltitudeMeters>' + p[3] + '</AltitudeMeters></Trackpoint>').join('') +
    '</Track></Lap></Activity></Activities></TrainingCenterDatabase>';
}
