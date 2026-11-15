// Writes synthetic Google Maps Timeline fixtures to bots/mileage/fixtures/. Every place is invented.
// Run: node bots/mileage/make_fixtures.js
const fs = require('fs'), path = require('path');
const D = require('../../docs/mileage/demo.js');
const JSZip = require('../../docs/mileage/vendor/jszip-3.10.1.min.js');
const FX = path.join(__dirname, 'fixtures');
fs.mkdirSync(FX, { recursive: true });
const w = (f, obj, indent) => fs.writeFileSync(path.join(FX, f), typeof obj === 'string' ? obj : JSON.stringify(obj, null, indent === undefined ? 2 : indent));

// Full-size exports
w('Timeline.json', D.android('2025-11-01', '2026-11-10', { dropDistanceEvery: 50 }), 2);
w('location-history.json', D.ios('2026-01-05', '2026-03-31', { dropDistanceEvery: 40 }), 2); // iOS pretty-prints with " : " but JSON is JSON
const tk = D.takeout('2023-11-01', '2024-02-29', { dropDistanceEvery: 30, timestampMsMonth: '2023-12' });
fs.rmSync(path.join(FX, 'Semantic Location History'), { recursive: true, force: true });
for (const [name, obj] of Object.entries(tk)) {
  fs.mkdirSync(path.join(FX, 'Semantic Location History', path.dirname(name)), { recursive: true });
  w(path.join('Semantic Location History', name), obj);
}

// Small hand-checkable files (values used by test_parser.js)
w('tiny-android.json', {
  semanticSegments: [
    { startTime: '2026-03-02T08:00:00.000-05:00', endTime: '2026-03-02T08:20:00.000-05:00', startTimeTimezoneUtcOffsetMinutes: -300, endTimeTimezoneUtcOffsetMinutes: -300,
      activity: { start: { latLng: '40.0612000°, -83.0187000°' }, end: { latLng: '39.9652000°, -82.9988000°' }, distanceMeters: 13679.5, probability: 0.99, topCandidate: { type: 'IN_PASSENGER_VEHICLE', probability: 0.95 } } },
    { startTime: '2026-03-02T08:20:00.000-05:00', endTime: '2026-03-02T17:30:00.000-05:00', startTimeTimezoneUtcOffsetMinutes: -300, endTimeTimezoneUtcOffsetMinutes: -300,
      visit: { hierarchyLevel: 0, probability: 0.9, topCandidate: { placeId: 'ChIJOFFICExxxxxxxxxx', semanticType: 'WORK', probability: 0.8, placeLocation: { latLng: '39.9652500°, -82.9988500°' } } } },
    { startTime: '2026-03-02T12:05:00.000-05:00', endTime: '2026-03-02T12:25:00.000-05:00', startTimeTimezoneUtcOffsetMinutes: -300, endTimeTimezoneUtcOffsetMinutes: -300,
      activity: { start: { latLng: '39.9652000°, -82.9988000°' }, end: { latLng: '39.9660000°, -82.9950000°' }, distanceMeters: 640.2, probability: 0.97, topCandidate: { type: 'WALKING', probability: 0.9 } } },
    // no distanceMeters: filled from the timelinePath points in its time window
    { startTime: '2026-03-02T17:30:00.000-05:00', endTime: '2026-03-02T17:50:00.000-05:00', startTimeTimezoneUtcOffsetMinutes: -300, endTimeTimezoneUtcOffsetMinutes: -300,
      activity: { start: { latLng: '39.9652000°, -82.9988000°' }, end: { latLng: '40.0612000°, -83.0187000°' }, probability: 0.99, topCandidate: { type: 'IN_PASSENGER_VEHICLE', probability: 0.93 } } },
    { startTime: '2026-03-02T16:00:00.000-05:00', endTime: '2026-03-02T18:00:00.000-05:00',
      timelinePath: [
        { point: '39.9652000°, -82.9988000°', time: '2026-03-02T17:31:00.000-05:00' },
        { point: '40.0100000°, -83.0000000°', time: '2026-03-02T17:40:00.000-05:00' },
        { point: '40.0612000°, -83.0187000°', time: '2026-03-02T17:49:00.000-05:00' }
      ] },
    // late-night trip: local date is Mar 3 even though UTC is Mar 4
    { startTime: '2026-03-03T23:30:00.000-05:00', endTime: '2026-03-03T23:45:00.000-05:00', startTimeTimezoneUtcOffsetMinutes: -300, endTimeTimezoneUtcOffsetMinutes: -300,
      activity: { start: { latLng: '40.0612000°, -83.0187000°' }, end: { latLng: '40.0705000°, -83.0011000°' }, distanceMeters: 2100, probability: 0.9, topCandidate: { type: 'IN_PASSENGER_VEHICLE', probability: 0.9 } } }
  ],
  rawSignals: [],
  userLocationProfile: { frequentPlaces: [{ placeId: 'ChIJHOMExxxxxxxxxxxx', placeLocation: '40.0612000°, -83.0187000°', label: 'HOME' }] }
});

w('tiny-ios.json', [
  { endTime: '2026-03-02T08:20:00.000-05:00', startTime: '2026-03-02T08:00:00.000-05:00', activity: { probability: '0.991856', end: 'geo:39.965200,-82.998800', topCandidate: { type: 'in passenger vehicle', probability: '0.869566' }, distanceMeters: '13679.500000', start: 'geo:40.061200,-83.018700' } },
  { endTime: '2026-03-02T17:30:00.000-05:00', startTime: '2026-03-02T08:20:00.000-05:00', visit: { hierarchyLevel: '0', topCandidate: { probability: '0.785181', semanticType: 'Work', placeID: 'ChIJOFFICExxxxxxxxxx', placeLocation: 'geo:39.965250,-82.998850' }, probability: '0.710000' } },
  { endTime: '2026-03-02T17:50:00.000-05:00', startTime: '2026-03-02T17:30:00.000-05:00', activity: { probability: '0.990000', end: 'geo:40.061200,-83.018700', topCandidate: { type: 'in passenger vehicle', probability: '0.930000' }, start: 'geo:39.965200,-82.998800' } },
  { endTime: '2026-03-02T18:12:00.000-05:00', startTime: '2026-03-02T18:00:00.000-05:00', activity: { probability: '0.990000', end: 'geo:40.070500,-83.001100', topCandidate: { type: 'cycling', probability: '0.930000' }, distanceMeters: '1900.000000', start: 'geo:40.061200,-83.018700' } },
  { endTime: '2026-03-03T00:00:00.000Z', startTime: '2026-03-02T22:00:00.000Z', timelinePath: [
    { point: 'geo:39.965200,-82.998800', durationMinutesOffsetFromStartTime: '31' },
    { point: 'geo:40.010000,-83.000000', durationMinutesOffsetFromStartTime: '40' },
    { point: 'geo:40.061200,-83.018700', durationMinutesOffsetFromStartTime: '49' }
  ] }
]);

w('2024_MARCH.json', { timelineObjects: [
  { activitySegment: { startLocation: { latitudeE7: 400612000, longitudeE7: -830187000, sourceInfo: { deviceTag: 1438290817 } }, endLocation: { latitudeE7: 399652000, longitudeE7: -829988000, sourceInfo: { deviceTag: 1438290817 } },
    duration: { startTimestamp: '2024-03-04T13:00:12.345Z', endTimestamp: '2024-03-04T13:21:40.002Z' }, distance: 13680, activityType: 'IN_PASSENGER_VEHICLE', confidence: 'HIGH',
    activities: [{ activityType: 'IN_PASSENGER_VEHICLE', probability: 97.1 }, { activityType: 'IN_BUS', probability: 1.2 }],
    waypointPath: { waypoints: [{ latE7: 400612000, lngE7: -830187000 }, { latE7: 399652000, lngE7: -829988000 }], source: 'INFERRED', distanceMeters: 13810.4, travelMode: 'DRIVE', confidence: 0.99 },
    editConfirmationStatus: 'NOT_CONFIRMED' } },
  { placeVisit: { location: { latitudeE7: 399652400, longitudeE7: -829988300, placeId: 'ChIJOFFICExxxxxxxxxx', address: '100 Example Rd, Columbus, OH 43210, USA', name: 'Studio Office', sourceInfo: { deviceTag: 1438290817 }, locationConfidence: 92.3 },
    duration: { startTimestamp: '2024-03-04T13:21:40.002Z', endTimestamp: '2024-03-04T22:02:00Z' }, placeConfidence: 'HIGH_CONFIDENCE', editConfirmationStatus: 'NOT_CONFIRMED' } },
  // no distance, waypointPath without distanceMeters: path length used
  { activitySegment: { startLocation: { latitudeE7: 399652000, longitudeE7: -829988000 }, endLocation: { latitudeE7: 400612000, longitudeE7: -830187000 },
    duration: { startTimestampMs: '1709589720000', endTimestampMs: '1709590920000' }, activityType: 'IN_PASSENGER_VEHICLE', confidence: 'MEDIUM',
    waypointPath: { waypoints: [{ latE7: 399652000, lngE7: -829988000 }, { latE7: 400100000, lngE7: -830000000 }, { latE7: 400612000, lngE7: -830187000 }], source: 'INFERRED', travelMode: 'DRIVE' } } },
  // no distance and no path: straight line between endpoints
  { activitySegment: { startLocation: { latitudeE7: 400612000, longitudeE7: -830187000 }, endLocation: { latitudeE7: 400705000, longitudeE7: -830011000 },
    duration: { startTimestamp: '2024-03-05T23:10:00Z', endTimestamp: '2024-03-05T23:18:00Z' }, activityType: 'IN_VEHICLE', confidence: 'LOW' } },
  { activitySegment: { startLocation: { latitudeE7: 400612000, longitudeE7: -830187000 }, endLocation: { latitudeE7: 400705000, longitudeE7: -830011000 },
    duration: { startTimestamp: '2024-03-06T15:00:00Z', endTimestamp: '2024-03-06T15:20:00Z' }, distance: 1800, activityType: 'WALKING', confidence: 'HIGH' } }
] });

w('Records.json', { locations: [{ latitudeE7: 400612000, longitudeE7: -830187000, accuracy: 12, source: 'WIFI', deviceTag: 1438290817, timestamp: '2024-03-04T13:00:12.345Z' }] });
w('not-timeline.json', { hello: 'world', items: [1, 2, 3] });
w('notes.txt', 'This is not JSON.');
w('empty-android.json', { semanticSegments: [], rawSignals: [], userLocationProfile: {} });

(async () => {
  const zip = new JSZip();
  for (const [name, obj] of Object.entries(tk)) zip.file('Takeout/Location History (Timeline)/Semantic Location History/' + name, JSON.stringify(obj, null, 2));
  zip.file('Takeout/Location History (Timeline)/Settings.json', JSON.stringify({ createdTime: '2015-01-01T00:00:00Z' }));
  zip.file('Takeout/archive_browser.html', '<html></html>');
  fs.writeFileSync(path.join(FX, 'takeout-2024.zip'), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  const sizes = fs.readdirSync(FX).map((f) => f + ' ' + (fs.statSync(path.join(FX, f)).isFile() ? fs.statSync(path.join(FX, f)).size : 'dir'));
  console.log(sizes.join('\n'));
})();
