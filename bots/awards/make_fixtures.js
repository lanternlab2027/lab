// Writes bots/awards/fixtures/sleeper_routes.json: API path -> JSON body, shaped like Sleeper's documented
// responses, built from the made-up leagues in docs/awards/demo.js. Used by test_page.js to route fetches.
// Run: node bots/awards/make_fixtures.js
const fs = require('fs'), path = require('path');
const D = require(path.resolve(__dirname, '../../docs/awards/demo.js'));

// League A: current season in progress (weeks 1-10 final, week 11 live).
const a = D.build({ season: '2026', leagueId: '1180000000000000001', weeks: 10, liveWeek: true, playoffStart: 15, orphan: true, seed: 777 });
// League B: same user, a second league so the picker shows up.
const b = D.build({ season: '2026', leagueId: '1180000000000000002', weeks: 10, liveWeek: true, playoffStart: 15, name: 'Work League (No Kickers)', seed: 4242 });

const routes = Object.assign({}, D.routes(b), D.routes(a, 'dana_r'));
const uid = routes['/user/dana_r'].user_id;
routes['/user/' + uid + '/leagues/nfl/2026'] = [a.league, b.league];
routes['/user/' + uid + '/leagues/nfl/2025'] = [];
// A user with no leagues at all
routes['/user/lonely_larry'] = { user_id: '900000000000009999', username: 'lonely_larry', display_name: 'Lonely Larry', avatar: null };
routes['/user/900000000000009999/leagues/nfl/2026'] = [];
routes['/user/900000000000009999/leagues/nfl/2025'] = [];

const out = path.join(__dirname, 'fixtures', 'sleeper_routes.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(routes));
console.log('wrote', out, Object.keys(routes).length, 'routes');
