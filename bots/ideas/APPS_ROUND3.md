# Venture Lab: App Ideas, Round 3

Researched 2026-11-15. Research only: nothing was built, committed, pushed, signed up for or posted.

**What this round targets.** Tech/app ideas that can catch on: a shareable result, a group or invite loop, a daily habit, or programmatic SEO with real search demand. Each one runs as a free static app on GitHub Pages with no server, no paid APIs and no accounts. Public data must come from a CORS-enabled API or be pre-built into static JSON by GitHub Actions.

**What it avoids.** Nothing repeats Rounds 1-2 or the live apps:
- the five Wrapped apps: chat, reading, streaming, sport and dating;
- Fantasy Awards, Secret Santa and Goal Bingo;
- NYC Then, Chicago Then and Art Year;
- the NYC and Chicago restaurant report cards;
- the baby-name report card;
- the mileage log;
- the NYC compliance tools.

**Research limits (same as Round 2).**
- The proxy here blocked direct requests to most APIs, including ESPN, Sleeper, vPIC and AIC. CORS status is marked in one of three ways:
  - **verified live:** an `Access-Control-Allow-Origin` header was seen today;
  - **documented:** vendor docs or a maintainer say so;
  - **unverified.**
- Two endpoints were verified live today with `Access-Control-Allow-Origin: *`: NYC Socrata `data.cityofnewyork.us` and `loc.gov` JSON.
- Google Trends was not reachable. Demand evidence is competitor counts, press, paid apps, and outlets that republish the same printable every year.

## Scoring (same rubric as Round 2)

Each criterion is scored 1-5, for a total out of 20.
- **Share:** does the output land in front of people who then make their own?
- **Demand:** concrete signals plus timing.
- **Build:** can it ship in 1-3 days, static, with no backend and no keys?
- **Revenue:** a believable later path.

## Ranked list

| # | Idea | Launch by | Share | Demand | Build | Revenue | Total |
|---|------|-----------|---|---|---|---|---|
| 1 | **Watch-Party Bingo**: one link, a different card on every guest's phone | Feb 1 (Super Bowl LXI is Feb 14) | 5 | 4 | 5 | 3 | **17** |
| 2 | **TikTok Wrapped** from the TikTok data export | Dec 1 | 5 | 5 | 4 | 2 | **16** |
| 3 | **Amazon Year in Orders**: "what I spent on Amazon in 2026" | Dec 26 | 4 | 4 | 4 | 3 | **15** |
| 4 | **Snow Day Odds**: tomorrow's snow-day chance from NWS data, plus town pages | Dec 1 | 5 | 5 | 4 | 1 | **15** |
| 5 | **76-Team Bracket**: printable bracket, no-account pool and end-of-tournament awards | Mar 1 (printable), Mar 14 (pool) | 5 | 4 | 3 | 2 | **14** |
| 6 | **Seller Year in Review**: Etsy shop stats and a tax-prep summary | Jan 5 | 3 | 3 | 4 | 4 | **14** |
| 7 | **Car Loan Interest Checker**: does my car qualify, plus a 1098-VLI explainer | Jan 12 | 2 | 4 | 4 | 3 | **13** |
| 8 | **Awards-Night Ballot Pool**: everyone picks by link, live leaderboard | Jan 21 (nominations) | 4 | 4 | 4 | 1 | **13** |
| 9 | **Weather Wrapped**: "your city's 2026 in weather" pages and share cards | Jan 2 | 4 | 3 | 4 | 1 | **12** |
| 10 | **Price Then**: daily "guess what it cost in 1985" game | Any time (Jan is good) | 4 | 3 | 4 | 1 | **12** |

Ties are broken by timing and by how crowded the market is:
- #3 beats #4 because Snow Day calculators are flooded with clones.
- #5 beats #6 because the new 76-team format creates a one-time search wave.
- #7 beats #8 because tax search lasts four months, while the awards pool lasts six weeks.

### Sequels (reuse an existing engine, about a day each)

| # | Sequel | Engine | Launch by | Share | Demand | Build | Revenue | Total |
|---|--------|--------|-----------|---|---|---|---|---|
| S1 | **Couples Chat Wrapped** ("our year in texts") | Wrapped card engine + the existing chat parser | Feb 1 | 4 | 4 | 5 | 3 | **16** |
| S2 | **NYC Dog Name Report Card** | Report-card engine (names + Socrata) | Jan 15 | 4 | 3 | 5 | 1 | **13** |
| S3 | **Ballpark Then** (guess the year of the baseball photo) | Then game engine + LOC pipeline | Mar 15 (Opening Day Mar 24) | 3 | 2 | 5 | 1 | **11** |

### Requested sequel examples, checked

**March Madness bracket awards for Sleeper or ESPN groups: not low-effort. Use #5 instead.**
- Sleeper's bracket game ("Bracket Mania") is app-only ([Sleeper help](https://support.sleeper.com/en/articles/9132739-intro-to-bracket-mania)).
- Sleeper's public API documents only NFL for user leagues: "We only support 'nfl' right now" ([docs.sleeper.com](https://docs.sleeper.com/)). No bracket endpoints are documented.
- ESPN Tournament Challenge runs on an undocumented `gambit-api.fantasy.espn.com` API, which community code calls ([val.town example](https://www.val.town/v/rlesser/espntcGetUsersGroups)). Its CORS behaviour couldn't be checked from here. Building on an undocumented ESPN API is fragile and a terms risk.

**Sleeper terms matter for the live Fantasy Awards app.** The same docs say the API is "free to use for **non-commercial purposes**", and commercial use needs a license. Any paid unlock on the Sleeper awards app needs Sleeper's OK first.

**Music Wrapped from Apple Music or YouTube Music exports: the exports exist and work, but don't build it.**
- **Apple:** privacy.apple.com → "Apple Media Services information". Processing takes up to 7 days, and the download is available for 14 days ([mystats.music](https://mystats.music/blog/apple-music-stats-beyond-replay)).
  - Contents: a "Play History Daily Tracks" CSV with one row per song per day, including play count and listening time, plus a play-by-play activity log.
- **YouTube Music:** Google Takeout → `history/watch-history.json`. Each entry has `title`, `titleUrl`, `subtitles` (channel) and `time`, with **no duration**. YouTube and YouTube Music history come back mixed in one file ([TakeoutDay](https://takeoutday.org/guides/how-to-export-youtube-data)).
- **Why not build:** both platforms now ship native recaps.
  - Apple Replay runs all year.
  - YouTube Music Recap 2025 added AI features ([TechRadar](https://www.techradar.com/audio/audio-streaming/the-youtube-music-recap-for-2025-is-rolling-out-now-with-new-ai-tricks-heres-how-to-get-it)), and YouTube added a video Recap ([TechCrunch](https://techcrunch.com/2025/12/02/youtube-releases-its-first-ever-recap-of-videos-youve-watched)).
  - stats.fm and mystats.music already import the Apple export ([stats.fm guide](https://support.spotistats.app/docs/import/apple-music-import), [mystats guide](https://mystats.music/guides/apple-music-history)).
- **Verdict:** a 7-day wait, a crowded field and native competition.

### Checked and dropped

- **Food-delivery spend Wrapped (Uber Eats / DoorDash).** Uber launched its own recap, "YOUBER", covering rides and Eats, on about Dec 15 2025 ([Fast Company](https://www.fastcompany.com/91462137/uber-eats-snl-spotify-wrapped)). A paid app ([SnackTrack](https://apps.apple.com/us/app/id6755827910)) and an extension ([SnackStats](https://chromewebstore.google.com/detail/dpamdjimipnebihinoccnfehkohpeagh)) cover the rest.
- **Instagram "who doesn't follow me back" from the data export.** Huge demand, but already flooded with export-based clones ([redact.dev](https://redact.dev/tools/instagram-not-following-back), [listsdiff](https://listsdiff.pages.dev/use-cases/who-doesnt-follow-you-back-on-instagram-without-app), [unfollr](https://www.unfollr.com/blog/instagram-who-doesnt-follow-back) and many more). It's also private, so it has no share loop.
- **NYC "is my apartment rent-stabilized" checker.** Covered by [Openigloo's map](https://www.openigloo.com/rent-stabilized-map), [PropertyShark](https://www.propertyshark.com/Real-Estate-Reports/find-rent-regulated-apartments-nyc), [LucidRents](https://lucidrents.com/nyc/rent-stabilization) and others.
- **NYC childcare inspection report card.** The DOHMH dataset `dsg6-ifza` is labeled "(Historical)" and frozen at 5/14/2019 data ([data.gov](https://catalog.data.gov/dataset/dohmh-childcare-center-inspections)).
- **"75 Hard" tracker.** "75 HARD" is a brand with an official app, and the store is full of tracker clones ([AlternativeTo](https://alternativeto.net/software/75-hard/)).
- **"How well do you know me" friendship quiz.** The leader, BuddyMeter, has only about 80K monthly US visits ([Semrush](https://cw.semrush.com/website/buddymeter.com/overview)), and the audience skews young, which is a COPPA risk. A couples version is folded into S1 instead.
- **Venmo Wrapped.** Statement CSVs exist ([Venmo help](https://help.venmo.com/hc/en-us/articles/360016096974-Transaction-History)), but no demand signal turned up, and every card would name friends.

---

## Ideas in detail

### 1. Watch-Party Bingo (score 17)

**Pitch.** The host picks an event and shares one link. Every guest who opens it gets their own unique bingo card for the game, the commercials or the awards show, and the winner's card can be checked.

**Who shares it and why.**
- **The host** posts the link in the party's group chat. That is the invite loop, with 5-30 guests per link.
- **Guests** screenshot "BINGO" to the chat.
- **Next time,** some guests become hosts for the next event: Super Bowl → Grammys → the awards show → the bracket.

**How it works, with no backend.**
- Each card is generated from `hash(partyCode + guestName)`, so every card is unique and reproducible.
- The squares a guest has ticked are stored in their URL hash.
- The "verify my bingo" link carries the card seed plus the ticks, so anyone can recompute it and check.

**Timing.**
- **Super Bowl LXI:** Feb 14 2027, which is also Valentine's Day, on ABC/ESPN ([Wikiwand](https://wikiwand.com/EN/Super_Bowl_LXI)). The date clash is a press hook: "couples' Super Bowl bingo".
- **The awards ceremony:** Mar 14 2027 ([Variety](https://au.variety.com/2026/film/global/oscars-2027-2028-ceremony-dates-march-35012/)).
- **Grammys:** early February. The date was not verified.

**Demand evidence.**
- Outlets republish the same printable every year: [Covers 2026 printable](https://www.covers.com/super-bowl/super-bowl-60-printable-bingo-cards) and [sportsbrackets "1, 10 or 50 unique PDFs"](https://sportsbrackets.net/2026/01/22/free-printable-super-bowl-bingo-cards-2026-download-1-10-or-50-unique-pdfs-for-your-party-super-bowl-lx-fun/).
- [Bingo Card Creator has a commercial-bingo template](https://www.bingocardcreator.com/bingo-cards/superbowl-commercial).
- Etsy sells a "30 cards" pack ([listing](https://www.etsy.com/listing/584754051)), so people pay for *unique* cards.
- Every competitor found is a PDF to print. None found is "one link, a different card per phone".

**Data source.** None. The square lists are written by us and shipped as static JSON, so CORS and terms don't apply.

**Legal.**
- "Super Bowl" is an NFL trademark. The product name must not use it: call it "Big Game Bingo" or "Watch-Party Bingo". Saying "for your Super Bowl party" in page copy is descriptive use. No logos or team marks.
- AMPAS marks (Oscar®, Academy Awards®, the statuette) need the same treatment. Use "awards night".
- No money, no prizes and no sportsbook affiliates. The SERP is betting-affiliate media, so keep the product clean.
- No data collection.

**MVP (1-2 days, reusing the Goal Bingo engine).**
- Day 1:
  - an event picker with 3 square packs: Big Game (60 squares: commercials, broadcast moments, halftime), Awards Night, and Custom;
  - seeded 5x5 generation;
  - tap-to-mark, with the state kept in the hash;
  - a "verify" link and a BINGO share card (9:16).
- Day 2:
  - a host "print 30 unique cards" PDF via jsPDF;
  - OG image;
  - an SEO landing page per event.

**Revenue later.** A $2.99 custom pack (your own squares plus a 50-card print PDF). The Etsy listing shows the price point.

**Top risk.** Printables own Google, so growth depends on the in-party loop working on the night. Square lists must be broadcast-neutral, so they don't go stale if the lineup changes.

### 2. TikTok Wrapped (score 16)

**Pitch.** Request your TikTok data, drop the JSON here, and get a Wrapped deck. It runs entirely in the browser, and search terms are hidden by default.

**Who shares it and why.**
- Gen Z and millennials post it to Stories and TikTok itself, since "my TikTok Wrapped" is a recurring December trend.
- Friends ask "how?" and the watermark plus `?ref=card` brings them in.

**Demand evidence.**
- TikTok has no built-in recap, and "TikTok Wrapped 2025" trended right after Spotify Wrapped ([GameRevolution](https://www.gamerevolution.com/?p=982934)).
- The Tab ran a how-to on Dec 2 2025 ([The Tab](https://thetab.com/2025/12/02/its-time-heres-how-to-get-your-tiktok-wrapped-2025-and-see-all-your-yearly-stats)), as did [Rova](https://www.rova.nz/articles/how-to-find-out-your-tiktok-wrapped), [Vista Social](https://vistasocial.com/insights/tiktok-wrapped) and others.

**Competitors.**
- "Wrapped For TikTok" (wrapped.vantezzen.io) is the one The Tab recommended. It says it doesn't process data on a server, so it is *already* client-side.
- Also [redact.dev](https://redact.dev/tools/tiktok-wrapped) and [trymypost](https://www.trymypost.com/tiktok/wrapped).
- **Our edge has to be better cards plus cross-sell from the 5 live Wrapped apps**, not privacy alone.

**Data source.** The user's own export, so there's no API and no CORS.
- Path: TikTok → Settings and privacy → Account → Download your data → JSON.
- It arrives in 1-4 days (TikTok allows up to 30), and the link expires 4 days after the email.
- Sections: `VideoBrowsingHistory` with timestamps and URLs (full history, not the app's 180 days), searches, likes, comments, shares, follows and DMs ([TakeoutDay](https://takeoutday.org/guides/how-to-export-tiktok-data); [TikTok data-portability data types](https://developers.tiktok.com/doc/data-portability-data-types)).
- Exact JSON keys are **unverified**. A real export is needed for fixtures.

**Terms and privacy.**
- Users process their own data, so no TikTok API terms apply.
- Don't use "TikTok" in the brand: "Works with your TikTok data export" is fine. No logo.
- Never read or render DMs; skip the key entirely.
- Searches stay off the share cards unless the user opts in.

**MVP (2 days, reusing the Wrapped engine).**
- Day 1: parser and fixtures. Cards for:
  - videos watched;
  - an "about N hours" estimate, labeled as an estimate;
  - busiest day;
  - the 3am scroll clock;
  - longest session (gaps under 5 minutes);
  - likes and comments;
  - month bars.
- Day 2:
  - an opt-in "top searches" card;
  - personality card;
  - share/save;
  - Kit "email me when my export arrives" capture, since there is a 1-4 day wait;
  - cross-links.

**Launch.** Dec 1. People must request the export *before* the Spotify Wrapped spike (~Dec 2-3) to have it in time, so the "request now" landing page goes live first.

**Revenue.** Weak: a $2.99 extras pack.

**Top risk.** A free client-side competitor already owns the press link, and the export wait loses people.

### 3. Amazon Year in Orders (score 15)

**Pitch.** Drop your Amazon order-history file and see what you spent in 2026: total, biggest order, busiest month and the 2am orders. The tool also does a clean CSV filter for business expenses at tax time.

**Who shares it and why.** Spending-shame posts spread, like the Uber Eats "I'm ashamed" pieces ([Yahoo AU](https://au.news.yahoo.com/uber-eats-discovery-leaves-ashamed-aussies-reeling-refuse-to-look-054751676.html), [Market Realist](https://marketrealist.com/man-imposes-self-ban-after-realizing-how-much-he-spent-on-uber-and-uber-eats-in-just-two-years)). Couples compare household totals. The tax mode is passed around among freelancers.

**Demand evidence.**
- "How much have I spent on Amazon" is an evergreen how-to: [How-To Geek](https://www.howtogeek.com/292918/how-to-see-how-much-youve-spent-on-amazon/), [Finny 2026](https://getfinny.app/blog/how-much-have-i-spent-on-amazon), [Tiller "updated for 2026"](https://tiller.com/?p=137473) and [Dataquest](https://www.dataquest.io/blog/how-much-spent-amazon-data-analysis/).
- Amazon **removed the built-in order-history report in March 2023** (Finny), so people now have to use a data request plus a spreadsheet.
- Competitors: a small tool ([amazon-spending.evilhead.me](https://amazon-spending.evilhead.me)) and [Amalytix](https://www.amalytix.com/en/tools/amazon-order-analysis/). Neither found makes a Wrapped-style card.

**Data source.** The user's own export.
- Path: Privacy Central → Request Your Data → "Your Orders".
- It is often ready in about an hour, but can take days ([evilhead](https://evilhead.me/blog/calculate-your-amazon-all-time-total-spending)).
- The file is a CSV in `Retail.OrderHistory` with a "Total Owed" column. The other column names are **unverified**, so a real export is needed.

**Privacy.**
- Product names can be sensitive. Share cards show only totals and categories, never item names, unless the user picks one.
- Don't use "Amazon" in the brand: "Works with your Amazon order history" is fine.

**MVP (2 days).**
- Day 1: parser and cards:
  - total spent and number of orders;
  - "a delivery every N days";
  - biggest order;
  - month bars;
  - weekday × hour heatmap;
  - returns and cancellations;
  - "since 2015" all-time total;
  - personality ("The 2am Cart", "The Prime Day Sniper").
- Day 2:
  - tax mode: date range, keyword filter, CSV download;
  - share/save;
  - Kit capture.
- Also check whether the export includes Kindle reading data. If it does, add it as an importer to Reading Wrapped.

**Launch.** Dec 26 for the post-holiday reckoning. A tax-mode push runs Jan 15 - Apr 15.

**Revenue.** $2.99 for the tax-mode export plus all-years. Amazon Associates is a poor fit here.

**Top risk.** The export format changes without notice. Some people are reluctant to request their data.

### 4. Snow Day Odds (score 15)

**Pitch.** Enter a ZIP and get "Tomorrow: 72% snow-day chance", from NWS forecast snow, ice, timing and wind chill, with a card to drop in the class group chat.

**Who shares it and why.**
- Students share it on storm nights, and parents and teachers forward it. That repeats every storm, so it is a habit loop.
- Town pages ("snow day chance Buffalo") give programmatic SEO.

**Demand evidence.**
- The original Snow Day Calculator got national press for years ([CBS Boston](https://www.cbsnews.com/boston/news/snow-day-calculator-app-david-sukhin-school), [WBUR](https://www.wbur.org/news/2015/01/28/snow-day-calculator-mit), [NJ101.5](https://nj1015.com/website-says-it-can-predict-your-nj-schools-next-snow-day/)).
- The sheer number of 2025-26 clones is itself a demand signal: [Perry Weather](https://perryweather.com/snow-day-probability-calculator/), [Product Hunt](https://www.producthunt.com/p/snow-day-calculator-7/snow-day-calculator-11), and dozens of pages.dev and Netlify copies.
- A regional "how much snow closes school" angle exists ([AOL: nine inches in Buffalo, two in Tulsa](https://www.aol.com/nine-inches-buffalo-two-tulsa-130626249.html)).

**Data source.** `api.weather.gov` (`/points` → `/gridpoints`: `snowfallAmount`, `iceAccumulation`, temperatures, `windChill`).
- **CORS: documented.** An NWS maintainer says browser clients should use the default User-Agent and that the API works from the browser. A custom User-Agent triggers a preflight that fails, and Safari was reported as intermittent ([weather-gov/api discussion #312](https://github.com/weather-gov/api/discussions/312)).
- No key is needed today. The maintainer mentioned a possible future move to API keys.
- NWS data is public domain.

**MVP (2 days).**
- Day 1:
  - ZIP → lat/lon from a static ZIP-centroid JSON (Census ZCTA, public domain);
  - NWS fetch;
  - a transparent scoring model: overnight snow inches vs a regional threshold table, ice, and wind chill;
  - a "why" breakdown.
- Day 2:
  - share card;
  - 300 town pages pre-built for the snowiest US metros;
  - a localStorage "my school" setting;
  - a disclaimer ("for fun; your district decides").

**Launch.** Dec 1, and keep it live through Feb.

**Revenue.** Near zero: display ads or a list builder.

**Top risk.** A crowded clone market, plus a public "it said 90% and we had school" moment. Keep the model transparent and the tone playful.

### 5. 76-Team Bracket: printable, no-account pool and awards (score 14)

**Pitch.** A blank and fill-in bracket for the **new 76-team format**, plus a pool that needs no accounts. Picks travel in links, standings and end-of-tournament awards are computed in the browser, and the awards are styled after Fantasy Awards.

**Why now.** The NCAA expanded both tournaments from 68 to 76 teams starting 2027 ([NCAA](https://www.ncaa.org/news/media-center-ncaa-reveals-new-76-team-bracket-for-di-mens-and-womens-basketball-championships/), [Deseret News](https://www.deseret.com/sports/2026/05/07/ncaa-tournament-expands-to-76-teams/)).
- 12 Opening Round games, with all 76 teams seeded.
- Selection Sunday is **Mar 14 2027**. Men's Opening Round is Mar 16-17, and the Final Four is Apr 3-5 in Detroit ([NCAA.com](https://ncaa.com/news/basketball-men/article/2026-08-12/2027-selection-sunday-date-schedule-tv-times-march-madness)).
- Every printable on the web has to be redone. The demand is there: outlets compete for printables every year ([CBS](https://mauth.cbssports.com/college-basketball/news/march-madness-bracket-2026-printable-mens-ncaa-tournament/), [Covers](https://www.covers.com/ncaab/march-madness/printable-bracket-for-2026-ncaa-tournament-predictions), [FanDuel Research](https://www.fanduel.com/research/march-madness-printable-bracket-for-the-2026-men-s-ncaa-tournament)), and ESPN is already running [76-team bracketology](https://www.on3.com/news/2027-ncaa-tournament-espn-releases-updated-bracketology-project-expanded-76-team-field-joe-lunardi/).

**Who shares it and why.**
- **The commissioner** posts a pool link in the office or family chat. Each player posts their entry link back.
- **When it ends,** the awards cards go back into the chat: "Bracket Buster", "Chalk Eater", "Cinderella Believer", "First One Out".

**Data source.**
- The field and seeds are entered by us on Selection Sunday night.
- Results are committed by the agent to `results.json` after each session.
- There is no third-party API, because the free sports APIs are undocumented (ESPN) or off-limits. CORS and terms don't apply.

**Legal.**
- "March Madness", "Final Four" and "Elite Eight" are NCAA trademarks. Name it "76-Team Bracket" or "Bracket Pool", and use the marks only descriptively in copy.
- No entry fees, no prize handling and no sportsbook affiliates.

**MVP (3 days).**
- Day 1: the 76-team bracket component (12 opening-round games feeding the 64), plus a printable PDF (blank, and seeded after Mar 14).
- Day 2:
  - pool links (scoring rules in the hash; each entry's ~75 picks bit-packed to about 16 characters);
  - a standings page built from pasted entry links;
  - a results loader.
- Day 3: awards cards, built by porting `docs/awards/cards.js`.

**Launch.** The blank printable by Mar 1, to catch searches for "76 team bracket". The pool goes live on the evening of Mar 14.

**Revenue.** Low.

**Top risk.** Three weeks of results updates by hand. Standings that live in pasted links are clunky for pools of 50 or more.

### 6. Seller Year in Review: Etsy shop stats and tax summary (score 14)

**Pitch.** Drop your Etsy Orders CSV and get a shareable "my shop's 2026" card. It also produces a tax-prep page: gross sales by month, refunds, and sales by state where the columns allow.

**Who shares it and why.**
- Small sellers post milestones in seller groups and on Instagram.
- The tax page gets forwarded to the bookkeeper or spouse.
- Cards carry "made with ..." links into other seller communities.

**Demand evidence.**
- Paid tools exist for exactly this export: [Craftybase](https://www.craftybase.com/blog/how-do-i-download-a-report-of-sales-and-orders-from-etsy), [Alura](https://www.alura.io/academy/exporting-etsy-sales-data) and [Coupler.io](https://blog.coupler.io/etsy-to-csv/), which shows people pay.
- Etsy publishes platform-level "Seller Year in Review" insights ([Etsy community](https://community.etsy.com/forum/etsy-success-300/topic/etsy-insights-2023-seller-year-in-review-25393/)), but no per-shop shareable recap was found.

**Data source.** The seller's own CSV.
- Path: Shop Manager → Settings → Options → Download Data → Orders CSV, by month or full year. Etsy Payments users also get a Payments CSV.
- Listed columns include item title, item price, SKU and payment method ([Alura](https://www.alura.io/academy/exporting-etsy-sales-data)). Date, shipping, tax and ship-state columns are **unverified**, so a real export is needed.

**Terms.** Don't use "Etsy" in the brand; "works with your Etsy sales export" is fine. Say "not tax advice".

**MVP (2 days).**
- Day 1: parser and cards:
  - orders;
  - revenue;
  - best seller (opt-in, since titles can identify a shop);
  - best month;
  - busiest weekday;
  - repeat-buyer share, if a buyer ID exists.
- Day 2: the tax page with print and CSV.

**Launch.** Jan 5. The 1099-K forms arrive by Jan 31.

**Revenue.** $9 tax pack (multi-year, fees from the Payments CSV, a Schedule C-style summary). This is the best revenue in the round.

**Top risk.** A smaller audience than consumer Wrapped, and the share loop is weaker.

### 7. Car Loan Interest Checker (score 13)

**Pitch.** "Does my car qualify for the new car-loan interest deduction?" Pick a make, model and year, or paste a VIN, and get an instant answer on US final assembly, a phase-out calculator, and a plain explainer of Form 1098-VLI.

**Who shares it and why.** Mostly search. Some sharing happens in car-model forums and owner groups ("is the 2026 RAV4 eligible?").

**Demand evidence and timing.** The rules ([Thomson Reuters](https://tax.thomsonreuters.com/news/2025-2028-vehicle-loan-interest-deduction-what-you-need-to-know/)):
- tax years 2025-2028;
- up to $10,000 of interest;
- phase-out above $100k MAGI single or $200k joint;
- new vehicles with **final assembly in the US**, VIN reported on Schedule 1-A.

The new hook is that **Form 1098-VLI goes out by Jan 31 2027** for tax year 2026, which is the first year lenders issue it. That gives a fresh query ("what is 1098-VLI").

Plenty of press asks "which cars qualify" ([247 Wall St, Aug 2026](https://247wallst.com/personal-finance/2026/08/23/you-can-now-deduct-car-loan-interest-but-only-if-the-final-assembly-happened-in-america-heres-how-to-check-if-a-car-qualifies/), [Claims Journal](https://www.claimsjournal.com/news/national/2026/01/02/334850.htm), [CarPro](https://www.carpro.com/blog/irs-guidance-outlines-eligibility-for-new-auto-loan-interest-tax-break)). The SERP is thin, low-quality pages.dev sites ([example](https://taxo-com.pages.dev/car-loan-interest-deduction-vehicles/)).

**Data sources.**
- **NHTSA Part 583 (AALA) reports** list where each car line is assembled, plus US/Canadian content. Model years 2007-**2027** are posted ([NHTSA](https://nhtsa.gov/part-583-american-automobile-labeling-act-reports)).
  - They are public domain and pre-built to static JSON, so CORS doesn't apply.
  - The file format (PDF vs spreadsheet) is **unverified**, and a PDF needs parsing.
- **VIN box:** the NHTSA vPIC `DecodeVinValues` endpoint returns `PlantCountry` ([example response](https://www.raymondcamden.com/2026/06/26/decoding-vins-with-api)).
  - **CORS unverified.** One directory says it doesn't support CORS ([public-api.org](https://public-api.org/api/1350/nhtsa)).
  - Fallback: decode the WMI and plant character from a pre-built table, and deep-link to the official NHTSA decoder, which the IRS-facing guidance points to.

**MVP (2 days).** About 600 static model-year pages, a VIN box, a phase-out calculator, a 1098-VLI explainer and an FAQ. Every page cites IRS and NHTSA sources.

**Launch.** Jan 12.

**Revenue.** Tax-software affiliate links later (needs Matt's sign-up), or nothing.

**Top risk.** Tax liability if we're wrong, so the copy must say "check your window sticker". There is also crowded SEO from AI-generated sites.

### 8. Awards-Night Ballot Pool (score 13)

**Pitch.** The host makes a ballot link, everyone fills in picks on their phone, and the leaderboard updates live during the show. No printing and no accounts.

**Who shares it and why.** The host shares it in the group chat. Guests share the "I went 19/23" card afterward.

**Demand evidence.** The printable-ballot race repeats every year:
- [Covers](https://www.covers.com/entertainment/printable-oscars-ballot-2025)
- [EW via AOL](https://www.aol.com/articles/picks-2026-oscar-winners-ews-191538350.html)
- [Sportsbook Review](https://www.sportsbookreview.com/picks/more-sports/printable-oscars-ballot-pdf-2026/)
- [Rotten Tomatoes](https://editorial.rottentomatoes.com/article/oscar-ballot-2023-printable-academy-awards-ballot-for-your-oscar-pool)
- [printerfriend.ly](https://printerfriend.ly/printable/oscar-awards-nominees-list-ballot)

Nominations are announced **Jan 21 2027**, and the ceremony is **Mar 14 2027** ([Variety](https://au.variety.com/2026/film/global/oscars-2027-2028-ceremony-dates-march-35012/)). That is the same night as Selection Sunday, so #5 and #8 can cross-promote.

**Data.** Nominees are typed into static JSON on Jan 21. Winners are either marked live by the host on their own device, or committed by the agent during the show. No API.

**Legal.** AMPAS strictly controls "Oscar(s)®", "Academy Awards®" and the statuette. The name is "Awards-Night Ballot", the ceremony is mentioned only descriptively in copy, and there is no statuette art.

**MVP (2 days, reusing the #1 link mechanics).**
- Day 1: ballot UI and pick encoding in the link.
- Day 2: host leaderboard from pasted entry links, a live "mark winner" mode, share card, and a printable fallback.

**Revenue.** None.

**Top risk.** Six weeks of use per year, and the leaderboard built from pasted links is clunky.

### 9. Weather Wrapped by city (score 12)

**Pitch.** "NYC's 2026 in weather": hottest day, days over 90°F, snow total, wettest day, and the year vs normal. There's one static page and one share card per city.

**Who shares it and why.**
- Locals share city pride and "we suffered" cards.
- Local TV meteorologists already use this exact format ([KTNV "2025 Las Vegas Weather Wrapped"](https://ktnv.com/news/2025-las-vegas-weather-wrapped-the-hottest-december-record-rain-and-more), [WOWT Omaha](https://www.wowt.com/2026/01/16/year-review-recapping-omahas-weather-2025/?outputType=amp), [Houston via KEDT](https://www.kedt.org/texas-news/2026-01-05/houston-saw-more-90-plus-degree-days-in-2025-than-ever-before)).
- That makes local outlets a pitch target for links.

**Competitors.** [Extreme Weather Watch](https://www.extremeweatherwatch.com/cities/terre-haute/yearly-days-of-90-degrees) has city tables but no shareable recap.

**Data source.** NOAA GHCN-Daily station files from NCEI, plus NOAA 1991-2020 normals. Both are public domain and pre-built by Actions, so CORS doesn't apply.
- Avoid Open-Meteo's free tier: its terms are non-commercial.

**MVP (2 days).** About 300 cities using their primary airport stations, 6 cards per city, OG images and a sitemap.

**Launch.** Jan 2, once the year is complete. Data lags a few days.

**Revenue.** None.

**Top risk.** Station gaps and QC lag. Check completeness before publishing each city.

### 10. Price Then: daily "guess what it cost" game (score 12)

**Pitch.** Each day, five items: "A dozen eggs, 1985: how much?" Slide to guess and get an emoji grid to share. It's the NYC Then mechanic applied to prices.

**Who shares it and why.**
- A daily share grid, the same habit loop as NYC Then.
- Inflation and egg prices are evergreen talk ([Chowhound on 1980 eggs](https://www.chowhound.com/2030257/how-much-eggs-cost-1980/), [Kiplinger 1980s prices](https://www.kiplinger.com/slideshow/spending/T050-S001-how-much-did-things-cost-in-the-1980s/index.html)).

**Demand evidence.** Quiz formats prove the hook:
- [BuzzFeed gas-price quiz](https://www.buzzfeed.com/meganeliscomb/guess-past-gas-prices)
- [HowStuffWorks quiz](https://play.howstuffworks.com/quiz/can-you-guess-how-much-these-everyday-items-used-cost)
- The Price Is Right's own [Back to '75 game](https://priceisright.com/game/back-to-75)
- [PriceWarp on itch.io](https://zucchidev.itch.io/pricewarp)

Daily price games such as Costcodle guess today's prices, not historical ones.

**Data source.** BLS Average Price (AP) series, roughly 1980 to now, monthly, US city average, for eggs, gas, milk, bread, coffee and similar. Public domain, pre-built to JSON, so CORS doesn't apply.
- BLS API v1 needs no key but is rate-limited. The flat files at `download.bls.gov` may require a User-Agent with contact info (**unverified**). Use a lab address, never Matt's personal one.

**MVP (1-2 days).** Port `docs/then/` game.js: replace the year slider with a price slider and score on log-ratio error. Pre-build 365 days of puzzles.

**Revenue.** None.

**Top risk.** A narrow catalog (about 60 series since 1980) makes puzzles feel repetitive by month 3. Mix in "was it more or less than today, adjusted?" rounds.

---

## Sequels in detail

### S1. Couples Chat Wrapped ("our year in texts") (score 16)

**Pitch.** Export your 1:1 WhatsApp or Telegram chat with your partner and get a Valentine's deck:
- who texts first;
- who says "love you" more;
- the reply-speed duel;
- your 2am talks;
- your emoji;
- your longest streak;
- the first message of 2026;
- a "couple personality" card.

**Who shares it and why.** Couples post to Stories on Feb 13-14. Friends' group chats ask for theirs. With the Super Bowl falling on Feb 14, there's also a "Valentine's vs Big Game" joke card.

**Demand evidence.** Many paid native apps sell exactly this:
- [WhatsAnalyzer: Couple Chats](https://apps.apple.com/us/app/-/id6744703917)
- [WhatsAI: Relationship Analysis](https://apps.apple.com/us/app/id6744169392)
- [Chat Summary - Lover Analysis](https://apps.apple.com/us/app/id6743426238)
- ChatWrapped: Love Wrapped (Round 1 link)
- [Spilk](https://apps.apple.com/us/app/-/id6627342798)

A free browser version that verifiably uploads nothing sets us apart.

**Data.** The existing `docs/wrapped/parser.js` already handles WhatsApp and Telegram exports, so there's no CORS question.
- iMessage can't be exported on iPhone. Say so on the page.

**Privacy.**
- The other person's messages are their data. Cards show counts and rates, plus at most one opt-in quote.
- Nothing is uploaded, and CSP is as in Group Chat Wrapped.

**MVP (1 day).** Detect 2-person chats and add 8 duel-style cards to the existing engine, with a pink theme and a landing page.

**Launch.** Feb 1, pushed Feb 10-14.

**Revenue.** $2.99 for the full pack and no watermark. The paid apps show there's willingness to pay.

**Top risk.** Sensitive content. Keep a "safe share" mode on by default, as in Dating Wrapped.

### S2. NYC Dog Name Report Card (score 13)

**Pitch.** "There are 4,812 dogs named Luna in NYC. #1 in your ZIP, peaked in 2021, most likely a Chihuahua mix." There's a page per name, a card per name, and a borough/ZIP map.

**Who shares it and why.** Dog owners post their dog's card, and NYC media cover dog names every year:
- [Atlas Obscura](https://atlasobscura.com/articles/the-most-popular-dog-names-in-new-york-city)
- [Fox 5](https://www.fox5ny.com/news/what-are-new-yorks-most-popular-dog-names)
- ["Luna" #1 in 2024 via AOL](https://www.aol.com/most-popular-dog-name-york-195859381.html)
- [Brick Underground map](https://www.brickunderground.com/neighbors/most-popular-dog-name-map-NYC)
- [R-bloggers, Oct 2026](https://www.r-bloggers.com/2026/10/dogs-of-new-york-2/)

**Data source.** NYC Dog Licensing Dataset `nu7n-tubp` ([data.gov](https://catalog.data.gov/dataset/nyc-dog-licensing-dataset), modified Jul 15 2026).
- **CORS verified live today** (`Access-Control-Allow-Origin: *`).
- 819,323 rows, latest `licenseissueddate` 2025-12-31.
- Fields: `animalname`, `animalgender`, `animalbirth`, `breedname`, `zipcode`, `licenseissueddate`, `licenseexpireddate`, `extract_year`.
- Pre-build per-name JSON with Actions, as `docs/names/` does. Normalize junk values like "UNKNOWN", which is the top value with 19,775 rows.

**Privacy.** Suppress any name + ZIP + breed combination with fewer than 5 dogs, so a rare name doesn't point at one owner's address area.

**MVP (1 day).** Port `docs/names/`:
- top ~3,000 names as static pages;
- "dogs vs babies" crossover with the existing SSA data ("Luna: #1 dog, #14 baby girl");
- share card;
- sitemap.

**Launch.** Jan 15. Repitch NYC outlets on National Dog Day.

**Revenue.** None. It works as a brand and backlink magnet, and other cities with pet-license data can follow.

**Top risk.** A small niche, and "most licensed" is not "most popular", so label it honestly.

### S3. Ballpark Then (score 11)

**Pitch.** NYC Then for baseball: guess the year of the ballpark or player photo from the Library of Congress, for the run-up to Opening Day.

**Who shares it and why.** Baseball fans share the daily grid in team subreddits and group chats. Nostalgia could rise if there's a lockout.

**Timing.** MLB's earliest-ever Opening Day is Mar 24-25 2027, "if there is a season". The CBA expires Dec 1 2026 and a lockout is widely expected ([KSL/AP](https://www.ksl.com/article/sports/mlb/mlb-to-have-earliest-opening-day-on-march-24-in-2027--if-there-is-a-season/51598676), [Bleacher Report](https://bleacherreport.com/articles/25521127-everything-know-expected-mlb-lockout-free-agency-and-more-key-offseason-dates)).

**Data source.** LOC Bain News Service photos (about 1900-1925, many baseball items) plus NYWT&S and Harris & Ewing photos for later decades.
- `loc.gov` JSON **CORS verified live today**.
- Images are pre-baked by `bots/then/` scripts, and `build.py` already enforces the "No known restrictions" rights check.

**MVP (1 day).** Harvest, curate and build with a "baseball" query set, then reskin. Avoid MLB and team logos in branding; photos showing period uniforms are fine as LOC public-domain items.

**Top risk.** The Bain years cluster at 1905-1925, which makes guessing hard. Curate across decades. A lockout also weakens the Opening Day hook.

---

## Launch calendar (Dec 2026 - Apr 2027)

| Date | Ship |
|------|------|
| Dec 1 | #2 TikTok Wrapped ("request your export now" page first), #4 Snow Day Odds |
| Dec 26 | #3 Amazon Year in Orders |
| Jan 2 | #9 Weather Wrapped |
| Jan 5 | #6 Seller Year in Review |
| Jan 12 | #7 Car Loan Interest Checker (1098-VLI wave by Jan 31) |
| Jan 15 | S2 Dog Name Report Card, #10 Price Then |
| Jan 21 | #8 Awards-Night Ballot (nominations day) |
| Feb 1 | #1 Watch-Party Bingo (Super Bowl Feb 14), S1 Couples Chat Wrapped (Feb 14) |
| Mar 1 | #5 76-team printable, then the pool on Mar 14; awards-night bingo pack |
| Mar 15 | S3 Ballpark Then (Opening Day Mar 24) |
| Apr 5 | #5 bracket awards cards after the title game |

## What Matt would need to do (none of it blocks building)

1. Approve any launch posts, press tips or outreach, as in earlier rounds.
2. Optionally provide real exports for fixtures (TikTok JSON, Amazon order CSV, Etsy Orders CSV). They are used locally and never committed.
3. Before any paid unlock on the live **Sleeper** awards app, decide whether to ask Sleeper for a commercial license. Their API is non-commercial by default.
