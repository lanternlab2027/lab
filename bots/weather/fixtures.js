// Synthetic Open-Meteo Historical Weather (archive) responses for tests. The shell here can't reach
// archive-api.open-meteo.com, so these follow the documented response format
// (https://open-meteo.com/en/docs/historical-weather-api): top-level latitude, longitude, elevation,
// generationtime_ms, utc_offset_seconds, timezone, timezone_abbreviation, daily_units, and daily = { time: [...],
// <variable>: [...] } with API default units (C, mm, cm for snowfall, seconds for sunshine, km/h).
// The weather itself is invented (seeded random around a seasonal curve); it is NOT real data for any city.
'use strict';

const CLIMATES = {
  // mean high in C at mid-winter / mid-summer, daily spread, precip chance, mean wet-day mm, sunny-day hours
  buffalo: { lat: 42.8864, lon: -78.8784, tz: 'America/New_York', abbr: 'EST', off: -18000, elev: 183, winterHi: -1, summerHi: 27, range: 8, wetP: 0.42, wetMM: 6, sunW: 3, sunS: 10 },
  phoenix: { lat: 33.4484, lon: -112.074, tz: 'America/Phoenix', abbr: 'MST', off: -25200, elev: 331, winterHi: 19.5, summerHi: 41.5, range: 14, wetP: 0.08, wetMM: 7, sunW: 8.5, sunS: 12 },
  london:  { lat: 51.5085, lon: -0.1257, tz: 'Europe/London', abbr: 'GMT', off: 0, elev: 23, winterHi: 8, summerHi: 23, range: 7, wetP: 0.45, wetMM: 4, sunW: 1.8, sunS: 7 },
};

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function days(start, end) {
  const out = []; let t = Date.parse(start + 'T00:00:00Z'); const e = Date.parse(end + 'T00:00:00Z');
  for (; t <= e; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
const r1 = (x) => Math.round(x * 10) / 10;

// Seasonal mean high for a date, peaking ~Jul 20 (doy 200).
function seasonal(cl, date) {
  const d = new Date(date + 'T00:00:00Z'), doy = (d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000;
  const k = (1 - Math.cos(2 * Math.PI * (doy - 20) / 365)) / 2; // 0 in late Jan, 1 in late Jul
  return { hi: cl.winterHi + (cl.summerHi - cl.winterHi) * k, k };
}

// Special days baked into every 2026 fixture so the tests know the answers.
const EVENTS2026 = {
  '2026-02-17': { hiAdd: 19 },          // weirdest day: a February heat spike
  '2026-07-14': { hiAdd: 6 },           // hottest day (nudged)
  '2026-01-25': { hiAdd: -9, loAdd: -9 }, // coldest night
};

function cityDaily(city, start, end, vars, opts) {
  opts = opts || {};
  const cl = CLIMATES[city];
  const r = rng(hashStr(city + start + end + (opts.seedExtra || '')));
  const time = days(start, end), daily = { time };
  vars.forEach((v) => (daily[v] = []));
  let wetPrev = false;
  time.forEach((date, i) => {
    const s = seasonal(cl, date);
    const ev = (opts.events || {})[date] || {};
    let hi = s.hi + (r() - 0.5) * 8 + (ev.hiAdd || 0);
    let lo = hi - cl.range * (0.7 + r() * 0.5) + (ev.loAdd || 0);
    // precipitation with some persistence, and a long dry spell in mid-2026 for the streak card
    const dryForced = opts.drySpell && date >= opts.drySpell[0] && date <= opts.drySpell[1];
    const wetForced = opts.wetSpell && date >= opts.wetSpell[0] && date <= opts.wetSpell[1];
    let wet = wetForced || (!dryForced && r() < cl.wetP * (wetPrev ? 1.35 : 0.85));
    let p = wet ? r1(Math.max(1, -Math.log(1 - r() * 0.98) * cl.wetMM)) : (r() < 0.3 && !dryForced ? r1(r() * 0.8) : 0);
    wetPrev = wet;
    const snowCm = (p > 0 && hi < 2) ? r1(p * (0.7 + r() * 0.6)) : 0;
    const sunH = Math.max(0, (cl.sunW + (cl.sunS - cl.sunW) * s.k) * (wet ? 0.35 : 1) * (0.75 + r() * 0.4));
    const windK = r1(10 + r() * 22 + (wet ? 8 : 0));
    const vals = {
      temperature_2m_max: r1(hi), temperature_2m_min: r1(lo), precipitation_sum: p, snowfall_sum: snowCm,
      sunshine_duration: Math.round(sunH * 3600 * 100) / 100, wind_speed_10m_max: windK,
    };
    vars.forEach((v) => daily[v].push(vals[v]));
    // the newest day(s) can be null while reanalysis catches up
    if (opts.nullTail && i >= time.length - opts.nullTail) vars.forEach((v) => (daily[v][i] = null));
  });
  const UNITS = { time: 'iso8601', temperature_2m_max: '\u00b0C', temperature_2m_min: '\u00b0C', precipitation_sum: 'mm', snowfall_sum: 'cm', sunshine_duration: 's', wind_speed_10m_max: 'km/h' };
  const daily_units = {}; ['time'].concat(vars).forEach((v) => (daily_units[v] = UNITS[v]));
  return {
    latitude: r1(cl.lat * 100) / 100 + 0.004, longitude: r1(cl.lon * 100) / 100 - 0.003, generationtime_ms: 12.3,
    utc_offset_seconds: cl.off, timezone: cl.tz, timezone_abbreviation: cl.abbr, elevation: cl.elev,
    daily_units, daily,
  };
}

const VARS = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'snowfall_sum', 'sunshine_duration', 'wind_speed_10m_max'];

// What the archive endpoint answers for a request URL (used by the Playwright route and by unit tests).
function respond(url, cityForLatLon) {
  const u = new URL(url), q = u.searchParams;
  const city = cityForLatLon(+q.get('latitude'), +q.get('longitude'));
  if (!city) return { status: 400, body: { error: true, reason: 'Fixture: unknown location' } };
  const vars = (q.get('daily') || '').split(',').filter(Boolean);
  const start = q.get('start_date'), end = q.get('end_date');
  const year = +start.slice(0, 4);
  const isNormals = +end.slice(0, 4) - year >= 1;
  if (isNormals) return { status: 200, body: cityDaily(city, start, end, vars, { seedExtra: 'normals' }) };
  return { status: 200, body: cityDaily(city, start, end, vars, year === 2026 ? { events: EVENTS2026, drySpell: ['2026-08-03', '2026-08-26'], wetSpell: ['2026-04-06', '2026-04-14'], nullTail: 0 } : {}) };
}

module.exports = { CLIMATES, VARS, cityDaily, respond, EVENTS2026, days };
