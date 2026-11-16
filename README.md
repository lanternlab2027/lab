# Lantern Lab

Free, small web apps that need no sign-up. Most of them turn a data export you already have into something fun to share, and your file is read in your browser, never uploaded.

**All apps:** https://lanternlab2027.github.io/lab/apps/

Lantern Lab is a small independent project. It is not affiliated with any of the services named below; their names are used only to say which file or data each app reads.

## Apps

### Wrapped season (your exports, read on your device)

| App | Reads | |
|---|---|---|
| [Group Chat Wrapped](https://lanternlab2027.github.io/lab/wrapped/) | WhatsApp or Telegram group chat export | Top poster, night owl, ghost, emoji stats as shareable cards |
| [Reading Wrapped](https://lanternlab2027.github.io/lab/reading/) | Goodreads, StoryGraph or Libby export | Books and pages read, top author, genre mix |
| [Streaming Wrapped](https://lanternlab2027.github.io/lab/netflix/) | Netflix viewing history CSV | Top show, biggest binge, longest streak |
| [Year in Motion](https://lanternlab2027.github.io/lab/sport/) | Strava bulk export, Garmin Connect CSV or GPX | Distance, climbing, streaks, route art |
| [Dating Wrapped](https://lanternlab2027.github.io/lab/dating/) | Tinder or Hinge export | Rates and patterns only, never names or message text |
| [Scroll Wrapped](https://lanternlab2027.github.io/lab/tiktok/) | TikTok data export | Videos watched, scroll clock; messages are never read |
| [Year in Orders](https://lanternlab2027.github.io/lab/amazon/) | Amazon "Your Orders" export | Spending cards plus a business-expense CSV |
| [Seller Year in Review](https://lanternlab2027.github.io/lab/etsy/) | Etsy shop CSVs | Shop year as cards plus a sales/refunds/fees tax summary; buyer details are never read |
| [Couples Chat Wrapped](https://lanternlab2027.github.io/lab/couples/) | 1:1 WhatsApp or Telegram chat export | Who texts first, reply times; no message text on the cards |
| [Timeline Mileage Log](https://lanternlab2027.github.io/lab/mileage/) | Google Maps Timeline export | Business-mileage log and CSV |

### Games

| App | |
|---|---|
| [NYC Then](https://lanternlab2027.github.io/lab/then/) | One historic New York photo a day; guess the year in five tries |
| [Chicago Then](https://lanternlab2027.github.io/lab/chicago-then/) | The same game with historic Chicago photos |
| [Watch-Party Bingo](https://lanternlab2027.github.io/lab/partybingo/) | One link, a different bingo card on every guest's phone, or print unique cards |
| [Goal Bingo](https://lanternlab2027.github.io/lab/bingo/) | Turn New Year's resolutions into a bingo card for print or your lock screen |
| [76-Team Bracket](https://lanternlab2027.github.io/lab/bracket/) | Printable bracket and a no-account pool for the college tournament |

### Tools

| App | Data |
|---|---|
| [Secret Santa](https://lanternlab2027.github.io/lab/santa/) | Draws names in the browser, keeps couples apart, gives each person a private link. No emails, no server |
| [Fantasy League Awards](https://lanternlab2027.github.io/lab/awards/) | Weekly awards for a Sleeper league, from Sleeper's public API (no Sleeper login) |
| [Snow Day Odds](https://lanternlab2027.github.io/lab/snow/) | National Weather Service forecasts and alerts for your ZIP |
| [NYC Dog Name Report Card](https://lanternlab2027.github.io/lab/dogs/) | NYC Dog Licensing Dataset (NYC Open Data) |
| [Baby Name Report Card](https://lanternlab2027.github.io/lab/names/) | Social Security Administration baby-name data since 1880 |
| [NYC Restaurant Report Card](https://lanternlab2027.github.io/lab/eats/) | DOHMH restaurant inspections (NYC Open Data) |
| [Chicago Restaurant Report Card](https://lanternlab2027.github.io/lab/chi-eats/) | CDPH food inspections (Chicago Data Portal) |

The site root (https://lanternlab2027.github.io/lab/) also has free NYC building lookups and exam practice tests. Building Watch alerts and House History are paid and are labelled as paid on their pages.

## How we handle your data

- **No accounts, no ads, no analytics.**
- **Export-based apps make zero uploads.** Your chat, library, viewing history, workouts, orders or dating export is parsed by JavaScript in your browser tab and never leaves your device.
- **Pages declare their connections.** App pages ship a Content-Security-Policy that limits which servers the browser may contact. The only outside services used are:
  - NYC Open Data and the Chicago Data Portal (restaurant lookups; your search goes straight from your browser to the city's public API);
  - Sleeper's public API (Fantasy League Awards; you enter a league ID);
  - the National Weather Service and Open-Meteo's geocoder (Snow Day Odds; your ZIP is sent to look up the forecast);
  - Kit, our email provider, only if you choose to sign up for new-app emails. It receives just your email address.
- **Shared links carry their own data.** Secret Santa and Watch-Party Bingo put the card or match in the link itself, so there's nothing on a server to leak. Anyone who has a link can open it.

## How it's built

Plain HTML, CSS and JavaScript, served as static files from `docs/` by GitHub Pages. There is no build step for most apps and no backend. Each app lives in its own folder, e.g. `docs/wrapped/`.

## License

Code: no license has been chosen yet, so all rights are reserved for now. The source is public so you can read how each app handles your data.

**Data and images** belong to their sources:
- NYC Open Data datasets (dog licensing `nu7n-tubp`, restaurant inspections `43nn-pn8j`) follow the City of New York's terms of use.
- Chicago Data Portal food inspections (`4ijn-s7e5`) follow the City of Chicago's terms of use.
- Baby-name data is from the US Social Security Administration.
- Historic photos in NYC Then and Chicago Then are from the Library of Congress; see each item's rights statement.
- Forecast data is from the National Weather Service.

Service names (WhatsApp, Telegram, Goodreads, StoryGraph, Libby, Netflix, Strava, Garmin, Tinder, Hinge, TikTok, Amazon, Etsy, Google, Sleeper) are trademarks of their owners and are used only to describe compatible files.
