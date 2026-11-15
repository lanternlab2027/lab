// Synthetic NWS API fixtures in the documented response shapes (/points, /gridpoints, /alerts/active).
// api.weather.gov was not reachable from the build container (proxy 403), so these were written by hand
// from the API's GeoJSON schema, not recorded. Times are built around a fixed "now" so tests are stable.
'use strict';

const NOW = Date.parse('2026-12-01T22:00:00Z'); // 5pm EST, Tue Dec 1 2026 -> target morning Wed Dec 2

function iso(ms) { return new Date(ms).toISOString().replace('.000Z', '+00:00'); }
const H = 3600 * 1000;
// rows: [hoursFromNow, durationHours, value]
function series(uom, rows) {
  return { uom, values: rows.map(([h, d, v]) => ({ validTime: iso(NOW + h * H) + '/PT' + d + 'H', value: v })) };
}
// A whole-week layer that's flat except where overridden.
function grid(o) {
  const tempC = o.tempC == null ? -2 : o.tempC;
  return {
    '@context': ['https://geojson.org/geojson-ld/geojson-context.jsonld'],
    type: 'Feature',
    properties: {
      updateTime: iso(NOW - 2 * H),
      validTimes: iso(NOW - 4 * H) + '/P7DT5H',
      temperature: series('wmoUnit:degC', o.temp || [[-4, 6, tempC], [2, 6, tempC - 1], [8, 6, tempC - 2], [14, 6, tempC - 1], [20, 24, tempC + 2]]),
      windChill: series('wmoUnit:degC', o.windChill || [[-4, 48, tempC - 4]]),
      probabilityOfPrecipitation: series('wmoUnit:percent', o.pop || [[-4, 48, 10]]),
      snowfallAmount: series('wmoUnit:mm', o.snow || [[-4, 48, 0]]),
      iceAccumulation: series('wmoUnit:mm', o.ice || [[-4, 48, 0]]),
    },
  };
}
// Snow scenarios. Window: tonight 6pm EST = +1h ... 8am = +15h; "late" part 5am-8am = +12h ... +15h.
const GRIDS = {
  // ~8.7 in. (220 mm) in the window, 9pm to 11am: heavy, lasting through the bus run
  heavy: grid({ tempC: -5, pop: [[-4, 6, 40], [2, 12, 95], [14, 30, 60]], snow: [[-4, 8, 0], [4, 6, 120], [10, 6, 120], [16, 28, 0]] }),
  // ~3 in. (76 mm) between 9pm and 3am, done before 5am
  early: grid({ tempC: -3, pop: [[-4, 6, 30], [2, 6, 90], [8, 36, 20]], snow: [[-4, 8, 0], [4, 6, 76], [10, 34, 0]] }),
  // nothing
  none: grid({ tempC: 4 }),
  // freezing rain glaze in the south
  ice: grid({ tempC: -1, pop: [[-4, 48, 80]], ice: [[-4, 10, 0], [6, 6, 4], [12, 30, 0]] }),
};
const POINTS = {
  '42.898,-78.888': { city: 'Buffalo', state: 'NY', tz: 'America/New_York', office: 'BUF', x: 35, y: 47 },
  '33.753,-84.39': { city: 'Atlanta', state: 'GA', tz: 'America/New_York', office: 'FFC', x: 51, y: 87 },
  '39.752,-104.998': { city: 'Denver', state: 'CO', tz: 'America/Denver', office: 'BOU', x: 63, y: 62 },
};
function points(key) {
  const p = POINTS[key]; if (!p) return null;
  const base = 'https://api.weather.gov/gridpoints/' + p.office + '/' + p.x + ',' + p.y;
  return {
    type: 'Feature',
    properties: {
      gridId: p.office, gridX: p.x, gridY: p.y,
      forecast: base + '/forecast', forecastHourly: base + '/forecast/hourly', forecastGridData: base,
      timeZone: p.tz,
      relativeLocation: { type: 'Feature', properties: { city: p.city, state: p.state, distance: { unitCode: 'wmoUnit:m', value: 1200 } } },
    },
  };
}
function alerts(events) {
  return {
    type: 'FeatureCollection',
    features: events.map((ev, i) => ({
      id: 'urn:oid:test.' + i, type: 'Feature',
      properties: { event: ev, status: 'Actual', messageType: 'Alert', severity: 'Moderate', headline: ev + ' issued by NWS', onset: iso(NOW - H), ends: iso(NOW + 20 * H), expires: iso(NOW + 6 * H) },
    })),
  };
}
module.exports = { NOW, iso, grid, GRIDS, POINTS, points, alerts };
