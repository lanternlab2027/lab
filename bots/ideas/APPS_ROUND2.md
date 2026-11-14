# Venture Lab: App Ideas, Round 2

Researched 2026-11-14. Research only: no accounts created, nothing posted, nobody contacted.

The target is the same sweet spot as the live apps: static, client-side, a shareable output that brings in new users, a seasonal hook or programmatic SEO on open data, zero backend and zero paid APIs. Nothing here repeats Round 1 (`APPS_ROUND1.md`).

**Research limits.**
- This environment's network allowlist blocked Google autocomplete, Google Trends, Similarweb pages for most domains, and direct `curl` CORS checks on every portal except `data.cityofnewyork.us`.
- Demand signals are therefore press coverage, competitor user counts, forum threads and store numbers, all with links.
- CORS is marked **documented** (vendor docs say so) or **verified live** (a header was seen). Only NYC Socrata was verified live (`Access-Control-Allow-Origin: *`, Nov 14). Before building, re-check each portal from a browser console on `lanternlab2027.github.io`.

## Scoring

Each criterion is scored 1-5, for a total out of 20.

- **Share:** how strong the share loop is. Does the output land in front of people who would then make their own?
- **Demand:** concrete search or usage signals, and timing.
- **Build:** can it ship in under 2 days, static, with no backend and no keys?
- **Revenue:** a believable later path, such as a $2.99 unlock, affiliate links or B2B.

## Ranked list

| # | Idea | Hook / timing | Share | Demand | Build | Revenue | Total |
|---|------|------|---|---|---|---|---|
| 1 | **Free "Year in Sport"**: a fitness Wrapped from your own Strava export (plus Garmin CSV and GPX files) | Strava and Garmin put their recaps behind paywalls in Dec 2025. Ship by Dec 8. | 5 | 5 | 4 | 4 | **18** |
| 2 | **Dating Wrapped** from Tinder and Hinge data exports | "Dating Wrapped" trend in late Dec; Valentine's Day | 5 | 4 | 4 | 4 | **17** |
| 3 | **Streaming Wrapped** from Netflix viewing history (instant CSV) | Netflix has no official recap; press covers the workaround every December | 4 | 5 | 5 | 2 | **16** |
| 4 | **2027 Goal Card**: goal bingo and punch-card maker with progress re-shares | Dec 26 - Jan 15, with re-shares in Feb and July | 4 | 4 | 5 | 3 | **16** |
| 5 | **Name Report Card**: programmatic SEO on SSA baby-name data, with a "my name peaked in 1987" card | Evergreen; new SSA data each May | 4 | 4 | 4 | 2 | **14** |
| 6 | **"Then" franchise**: Chicago Then, then Boston, DC and SF, reusing the NYC Then pipeline | Evergreen daily | 4 | 3 | 5 | 1 | **13** |
| 7 | **Restaurant Report Card: Chicago**, then SF | Evergreen programmatic SEO | 3 | 3 | 5 | 2 | **13** |
| 8 | **Libby Wrapped** as an importer added to Reading Wrapped | December | 3 | 3 | 5 | 2 | **13** |
| 9 | **Timeline Mileage Log + Travel card** from Google Maps `Timeline.json` | Tax season Jan-Apr; Wrapped in December | 3 | 3 | 3 | 4 | **13** |
| 10 | **Art Year**: a daily "guess the year" game on Art Institute of Chicago public-domain works | Evergreen daily | 4 | 3 | 4 | 1 | **12** |

Ties are broken by timing. #3 beats #4 because it lands in the same December wave as Group Chat Wrapped and reuses that card engine. #6-#9 are ordered by build cost, because #6-#8 are mostly reuse.

### Checked and dropped

- **Letterboxd Wrapped.** Letterboxd already gives every member a free Year in Review page (for example [letterboxd.com/unameriican/year/2025](https://letterboxd.com/unameriican/year/2025/)), and it [went viral natively in 2025](https://www.academicjobs.com/global-news/letterboxd-wrapped-2025-takes-over-social-media-as-users-share-movie-watching-stats-and-viral-year-end-wraps-33). Browser add-ons ([WrappedBoxd](https://addons.mozilla.org/addon/wrappedboxd/)) and stats sites ([letterboxd-stats](https://letterboxd-stats-zeta.vercel.app/guide)) cover the rest. Too little gap.
- **Chess.com / Lichess Wrapped.** Chess.com runs its own [Year in Review](https://www.chess.com/article/view/year-in-review-2025), and [Chessigma](https://www.chessigma.com/blog/chess-wrapped-2025) already does a third-party chess Wrapped. CORS on `api.chess.com` archives has a history of [user-reported errors](https://www.chess.com/clubs/forum/view/cors-errors-on-monthly-game-archives?lc=1) and no official answer. Small audience for the effort.
- **GitHub Wrapped.** Crowded by GitHub Unwrapped and others. Dev audience, weak revenue.
- **Steam and Duolingo.** Both have native recaps (Steam Replay, Duolingo Year in Review).
- **Last.fm Wrapped.** Last.fm has its own yearly recap. The API key is free but needs a sign-up, and [its API terms](https://www.last.fm/api/tos) could not be fetched here, so commercial use is **unverified**. Low priority.
- **Spotify from the "extended streaming history" export.** This avoids the closed API, but stats.fm/Spotistats already imports these files ([import guide](https://support.spotistats.app/docs/import/spotify-import)), as do others ([mystats.music](https://mystats.music/guides/spotify-extended-history), [Show HN](https://hn.svelte.dev/item/46285058)). The export can also take up to 30 days. Crowded.
- **Apple Health Wrapped.** `export.xml` often runs to gigabytes, which makes it fragile in mobile Safari, and native apps already exist ([Health Wrapped](https://apps.apple.com/us/app/-/id6739070492), [2025 Wrapped Health](https://apps.apple.com/app/id6756115656), [PH launch](https://www.producthunt.com/products/apple-health-wrapped)).
- **Super Bowl squares generator.** The search results are owned by betting-affiliate media ([DefiRate](https://defirate.com/squares/), [SI](https://www.si.com/betting/super-bowl-2026-squares-game-printable-downloadable-super-bowl-squares-sheet-for-seahawks-vs-patriots), [Bleacher Nation](https://www.bleachernation.com/nfl/2026/02/05/super-bowl-squares-template/)) and squares are gambling-adjacent. Skip.
- **"Will you be my Valentine" link pages.** Saturated with free clones ([askmyval](https://www.producthunt.com/posts/askmyval), [bemyvalentine](https://www.producthunt.com/products/bemyvalentine), dozens of GitHub repos) and there's no money in it. At most, this could be a free bonus card inside #2.
- **Apps using YouTube Takeout or the Spotify API.** Already dropped in Round 1.

---

## Candidate notes and evidence

### 1. Free "Year in Sport" (Strava export, Garmin CSV, GPX)

**What it is.** The user drops their Strava bulk-export `.zip`, a Garmin Connect activities CSV, or a handful of GPX files. A deck of 9:16 cards is built in the browser, nothing is uploaded, and a poster-size print is offered as the upsell.

**Why now.**
- **Strava paywall.** Strava moved Year in Sport behind its subscription in December 2025 ([road.cc, Dec 23 2025](https://road.cc/content/news/strava-year-sport-now-only-subscribers-317425)). It was widely covered as an "[$80 paywall](https://tagteam.harvard.edu/hub_feeds/3415/feed_items/17132945/content)", with [T3: "we have a paywall problem"](https://www.t3.com/tech/dear-strava-we-have-a-paywall-problem-thats-gone-a-step-too-far) and [Gadgets & Wearables](https://gadgetsandwearables.com/2025/12/20/strava-year-in-sport/) noting free users' frustration on Reddit.
- **Garmin paywall.** Garmin launched its Year in Review on Dec 9 2025 as a [Connect+-only feature](https://scour.ing/@tyler/p/https://lifehacker.com/health/garmin-year-in-review-connect-plus-feature).
- **Recurring demand.** The TrainerRoad forum thread "[Strava now charging for the end of year recap](https://www.trainerroad.com/forum/t/strava-now-charging-for-the-end-of-year-recap/78728)" runs to [9+ pages](https://www.trainerroad.com/forum/t/strava-now-charging-for-the-end-of-year-recap/78728?page=9) and revives every December.
- **International interest.** "How to make Strava Year in Sport 2025" articles appeared in [Indonesian](https://tirto.id/cara-bikin-strava-year-in-sport-2025-pamer-sosmed-hntq) and [Italian](https://www.tuttotech.net/news/2025/12/22/strava-year-in-sport-pagamento.html) outlets.
- **The API route is closed to new apps.** New Strava API apps start at 1 athlete, self-service caps at 10, wider access needs review, and developers now need a paid subscription ([Terra summary of 2026 Strava API changes](https://tryterra.co/blog/strava-api-changes-2026); [Strava rate limits](https://developers.strava.com/docs/rate-limits/)). So OAuth-based "Strava Wrapped" competitors are capped. The export route sidesteps the API and its terms entirely.

**Revenue evidence.** Personalized route posters sell on Etsy for **$34.58 for a digital file and $44.95-$79.52 for prints** ([example listing, 545 shop sales](https://www.etsy.com/listing/1259302151)). The free/OSS poster generator [GpxTrackPoster](https://www.Github.com/flopp/GpxTrackPoster) shows the "all my year's tracks" grid format people like.

**Free alternatives today.**
- [VeloViewer's infographic](https://blog.veloviewer.com/veloviewer-year-wrapped-2023/) is cycling-heavy and needs an account and sync.
- [Active Maps](https://www.producthunt.com/products/active-maps) uses OAuth and had 2 upvotes on Product Hunt.

Nothing found is client-side, export-based and multi-sport.

### 2. Dating Wrapped (Tinder and Hinge exports)

**What it is.** The user drops a Tinder `data.json` or a Hinge export `.zip` and gets:
- swipe-right rate;
- match rate;
- busiest swiping month;
- "3am swiper";
- ghost rate (matches with no messages);
- longest conversation, as a count only;
- an opener-style label;
- a closing "dating personality".

**Evidence.**
- **The trend exists.** "Dating Wrapped" is a [Know Your Meme entry](https://knowyourmeme.com/memes/dating-wrapped). It got [HuffPost UK](https://huffingtonpost.co.uk/entry/2022-dating-wrapped-tiktok-trend_uk_63999614e4b0c28146486f75) and [Yahoo](https://www.yahoo.com/lifestyle/singles-creating-dating-wrapped-powerpoint-184003507.html) coverage, and singles were [building their own versions by hand](https://www.rova.nz/articles/singletons-are-asking-for-a-dating-app-wrapped-so-these-tiktokers-created-their-own-versions).
- **Hinge Wrapped** ([hingewrapped.com](https://www.hingewrapped.com/)) launched on [Product Hunt in 2021 and again as 2.0 in Nov 2023](https://www.producthunt.com/products/hinge-wrapped), with "how to get your Hinge Wrapped" press ([Stylist](https://stylist.co.uk/relationships/dating-love/hinge-wrapped-dating-2022/747344)).
- **SwipeStats** ([swipestats.io](https://swipestats.io/)) proves people will upload and pay:
  - 12,000+ profiles uploaded and 965k+ views of content built on its data;
  - a paid SwipeStats+ tier;
  - research datasets sold at $15-$1,500.

  It uploads anonymized data to its servers. A tool that never uploads anything is a clean way to stand out.
- **Exports arrive fast enough.** Tinder delivers its export in a few days, usually 24-48 hours ([SwipeStats guide](https://www.swipestats.io/blog/download-tinder-data)). Hinge exports are requested in-app ([Hinge help](https://help.hinge.co/hc/en-us/articles/360011235813-How-do-I-request-a-copy-of-my-personal-data)).

**Timing.** There are two windows: the late-December "Dating Wrapped" TikTok wave, and Valentine's Day (Feb 14, 2027) with a Galentine's angle on Feb 13.

### 3. Streaming Wrapped (Netflix viewing history)

**What it is.** Netflix → Account → Profile → Viewing activity → "Download all" gives an instant CSV of title and date per profile. Drop it in and get:
- titles watched;
- top show;
- biggest binge day;
- "seasons finished";
- late-night share;
- most-watched month;
- shows abandoned after episode 1;
- a closing "viewer personality".

**Evidence.**
- Netflix has no official Wrapped ([BGR](https://bgr.com/entertainment/netflix-doesnt-have-its-own-version-of-spotify-wrapped-but-heres-what-you-can-do-instead/), [Netflix Junkie](https://www.netflixjunkie.com/netflix-news-what-is-netflix-wrapped-is-there-an-official-feature-on-the-app-for-it)).
- Kapwing's free [Netflix Wrapped](https://www.kapwing.com/netflix-wrapped) gets annual press:
  - [What's on Netflix 2024](https://whats-on-netflix.com/news/netflix-wrapped-is-back-for-2024-see-how-much-netflix-you-watched-this-year);
  - [TechRadar](https://www.techradar.com/streaming/netflix/your-netflix-wrapped-2024-recap-is-here-but-dont-tell-netflix);
  - [Apartment Therapy](https://www.apartmenttherapy.com/netflix-year-in-review-37023621);
  - [The Tab, Dec 2 2025](https://thetab.com/2025/12/02/if-youre-curious-heres-exactly-how-you-can-see-your-netflix-wrapped-for-2025);
  - [Beebom](https://beebom.com/unofficial-netflix-wrapped-tool-hands-on).

  That press shows reliable search demand every December.
- Kapwing is an upload service. "Never leaves your browser" plus no sign-up is the angle.

**Weakness.** Kapwing owns the head term, and there's no affiliate fit. Revenue is limited to a $2.99 extras pack.

### 4. 2027 Goal Card (bingo and punch-card maker)

**What it is.** A phone-first maker for a 5x5 (or 4x4/3x3) goal bingo card, plus the newer "punch card" format. It exports a 9:16 story image and a printable PDF. The card state lives in the URL hash and localStorage, so there's no backend. Users tick squares through the year, and a "5/25 done" progress card makes for a second and third share in February and July.

**Evidence.**
- Bingo Baker hosts many user-made "2026 Goals" cards with IDs around 9.9M ([example](https://bingobaker.com/view/9923108), [another](https://bingobaker.com/view/9885350)). [bingocardsfree](https://bingocardsfree.com/card/2026-goals-39821.htm) is another.
- Kapwing published a [2026 bingo card guide](https://www.kapwing.com/resources/how-to-create-a-2026-bingo-card-and-vision-board/) and a [template](https://www.kapwing.com/explore/2026-new-year-bingo-card-template).
- Lifestyle press covered it: [AOL](https://www.aol.com/articles/used-bingo-card-set-2026-183000910.html), [Bustle](https://www.bustle.com/wellness/bingo-vision-board-new-years-resolutions-tiktok), [Apartment Therapy 2025](https://www.apartmenttherapy.com/2025-bingo-card-37450372), [hip2save printable](https://hip2save.com/?p=11835646).
- In Jan 2026 TikTok moved on to "punch cards" ([Daily Dot](https://www.dailydot.com/culture/2026-punch-cards-tiktok/)), so the tool should support both formats.

**Revenue.** $2.99 premium themes and print packs. Etsy-style template demand exists, but no listing data was pulled here.

### 5. Name Report Card (SSA programmatic SEO)

**What it is.** One static page per name, built from SSA's public national baby-name files ([SSA data page](https://www.ssa.gov/oact/babynames/limits.html), [data.gov listing](https://catalog.data.gov/dataset/baby-names-from-social-security-card-applications-national-data)). Each page shows:
- a popularity chart from 1880 to 2025;
- the peak year;
- "babies with your name born the year you were";
- rank by decade;
- similar names that are rising.

The share card reads "My name peaked in 1987 · now #412".

**Evidence.**
- The category is big: behindthename ranks around #11.8K globally and nameberry around #24K ([Similarweb](https://www.similarweb.com/website/nameberry.com/competitors)).
- The best-loved chart tool, the Baby Name Wizard NameVoyager, is gone ([Sancta Nomina, "an important resource is gone"](https://sanctanomina.net/2022/01/26/an-important-resource-is-gone/)). Replacements are small hobby sites ([NameGrapher](https://flowingdata.com/2022/03/15/namegrapher-to-explore-past-baby-name-trends), [engaging-data](https://engaging-data.com/baby-name-visualizer/)).

**Weakness.** The SEO head terms are owned by large sites. The share card is what has to carry it.

### 6. "Then" franchise (Chicago Then first)

**What it is.** The same daily guess-the-year game as NYC Then, built with the same scripts (`bots/then/harvest.py` → `curate.py` → `build.py`). `build.py` already enforces the LOC "No known restrictions" rights check.

**Sources.**
- Chicago has a deep LOC source in the [Chicago Daily News photographs, 1902-1933](https://webarchive.library.unt.edu/eot2008/20080916111824/http:/memory.loc.gov/ammem/ndlpcoop/ichihtml/about.html) (originals at the Chicago History Museum). Rights must be checked per item, which `build.py` does.
- Detroit Publishing Co. covers Boston, DC and others.

**Evidence.** [TimeGuessr](https://appgoblin.info/apps/com.timeguessr.app) has about 115K installs, 3.8K ratings at 4.79, and an estimated <$10K/month from in-app purchases since May 2025. Year-guessing has real pull.

**Fit.** Local pride gives each city its own subreddit and newsletter audience.

### 7. Restaurant Report Card: Chicago, then SF

**Data access.**
- **Chicago:** the CDPH Food Inspections dataset `4ijn-s7e5` on data.cityofchicago.org (Socrata), last modified 2026-11-11 ([data.gov](https://catalog.data.gov/dataset/food-inspections)). Socrata documents CORS on all public SODA endpoints ([dev.socrata.com](https://dev.socrata.com/docs/cors-and-jsonp)), so it is **documented, not verified live** from here.
- **SF:** its data is split across several datasets ([explainer](https://www.eatorbeat.com/blog/how-san-francisco-inspects-its-restaurants/)). A "Health Inspection Scores (2023-present)" set exists ([data.gov](https://catalog.data.gov/dataset/health-inspection-scores-2023-present)).
- **LA:** LA **City**'s Socrata set `29fd-3paw` was last modified Nov 2020 ([data.gov](https://catalog.data.gov/dataset/restaurant-and-market-health-inspections)), so it is stale. LA **County** publishes outside Socrata, so CORS is unknown. Skip LA for now.

**Competition is real.**
- [EatOrBeat](https://www.eatorbeat.com/about-the-data/) covers Chicago, NYC, SF, LA County, Dallas and Florida.
- [CleanPlate Chicago](https://www.cleanplatechicago.com/rankings) is another.
- [chicagorestaurantinspections.com](https://chicagorestaurantinspections.com/methodology) runs AdSense.

This is a cheap port of `docs/eats/`, but don't expect it to win head terms.

### 8. Libby Wrapped (importer for Reading Wrapped)

Libby's Shelf → Timeline → Actions → Export Timeline offers a "Spreadsheet" download ([Libby help](https://help.libbyapp.com/en-us/6207.htm)). Library readers are the same audience as Goodreads users, and Libby is huge. It's a half-day parser added to `docs/reading/`.

**Unverified:** the exact columns and whether the file is CSV. A real export is needed for fixtures.

### 9. Timeline Mileage Log + Travel card

**What it is.**
- Google moved Timeline on-device. Phones now export `Timeline.json` (Android: Settings → Location → Location services → Timeline → Export), while Takeout produces a different `TimelineEdits.json` ([r/GoogleMaps thread](https://libreddit.winscloud.net/r/GoogleMaps/comments/1jaftng/how_to_map_your_exported_json_google_timeline_data)). Users complain about broken converters in that thread.
- MileageWise sells mileage logs built from Timeline data ([exporter page](https://www.mileagewise.com/timeline-exporter/)), which proves willingness to pay in tax season.
- Free converters exist ([dawarich tools](https://dawarich.app/tools/), [ethan.dev visualizer](https://hn.jakechampion.name/reader/https://ethan.dev/utilities/location-history-visualizer)).

**Weakness.** Google already shows its own Timeline recap ([TechRadar](https://www.techradar.com/phones/googles-2024-timeline-update-is-like-spotify-wrapped-for-your-travels)), and the format is unstable.

### 10. Art Year daily game (Art Institute of Chicago)

**Data access.** The [AIC API](https://api.artic.edu/docs) needs no key, allows 60 requests/min per IP, and its data is CC0. Filter for `is_public_domain=true`. IIIF images are served with `Access-Control-Allow-Origin: *` according to the docs. Pre-bake the daily set with GitHub Actions, as NYC Then does, so players never hit the API.

**Competition.** Artle (National Gallery) exists. Revenue is near zero, so this is a list-builder only.

---

## Top 3: MVP specs

### #1 Free "Year in Sport"

The working name is a placeholder, such as **"Year in Miles"**.

**Brand rules.**
- Don't use "Strava" or "Garmin" in the name or logo. "Works with your Strava export" is descriptive use.
- Read [Strava's brand guidelines](https://developers.strava.com/guidelines/) before launch. They are written for API apps, but the logo rules are a useful guide.

**User flow**

1. The landing page shows a 6-card demo deck from a synthetic athlete, the line "Your free Year in Sport. Your file never leaves your phone.", and three tabs: *Strava*, *Garmin*, *GPX files*.
2. Export help for each source:
   - **Strava:** Settings → My Account → Download or delete your account → Request your archive. The email usually arrives within hours ([TakeoutDay guide](https://takeoutday.org/guides/how-to-export-strava-data), [Strava help](https://support.strava.com/en-us/articles/15401919-how-do-i-export-my-strava-data)). A "remind me when it arrives" Kit email capture sits on this step.
   - **Garmin:** Connect web → Activities → scroll to load the year → Export CSV. The export only includes loaded rows ([Garmin forum](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/426756/exporting-activities-to-csv)).
   - **GPX:** multi-select files.
3. The user drops the file.
   - The Strava zip is read lazily with **zip.js** (`BlobReader`). The archive can hold a `media/` folder of photos and run to gigabytes, and JSZip would load all of it into memory.
   - The tool reads `activities.csv` first, then optionally samples `activities/*.gpx|.fit.gz` for the map card. `.fit.gz` is unpacked with the native `DecompressionStream('gzip')`, then run through a small FIT parser (check its license).
   - Parsing runs in a Web Worker behind a progress bar. CSP `connect-src 'self' https://api.convertkit.com`.
4. A year picker defaults to 2026, and a units toggle switches between mi and km.
5. The deck is built and can be shared or saved, with "Download all" as a zip (the Group Chat Wrapped code).

**Data and terms**
- **Source:** the user's own export file, so there are no API terms, no keys, no CORS and no backend.
- **Risks:**
  - `activities.csv` column names are not officially documented ([TakeoutDay](https://takeoutday.org/guides/how-to-export-strava-data), [Redback notes](https://redback-operations.github.io/redback-documentation/docs/project-3/research/strava-bulk-export-data-description)) and may be localized. Build a header-alias map and test against public sample exports from GitHub repos (check each repo's license before committing fixtures).
  - Units are mixed: distance can be km or mi, and elevation m or ft. Assert ranges in tests.

**Cards** (1080x1920 canvas, same engine as `docs/wrapped/`)

1. **Intro:** "2026 in motion": total activities, hours and distance, as a big number over a year strip of 365 tiny squares shaded by daily minutes.
2. **Distance in context:** "You ran 1,204 km, about NYC to Chicago." Uses a fixed list of city-pair distances.
3. **Sport mix:** a donut of run, ride, walk, swim and strength.
4. **Biggest day:** longest activity, with date, distance and elevation.
5. **Climb:** total elevation as landmark multiples ("3.1 Everests").
6. **Streak:** longest run of consecutive active weeks, plus the longest daily streak.
7. **Clock:** a 24h radial of start times, giving "Dawn patrol" or "After-work warrior".
8. **Best month:** 12 bars.
9. **Map** (only when GPS files parse): every 2026 track in a small-multiples grid, GpxTrackPoster style, no basemap and no tiles.
10. **Personality:** "The Metronome", "The Weekend Warrior", "The Explorer" (most unique start points) and similar.

Footer on every card: `lanternlab2027.github.io/lab/sport · free, no upload`.

**Free vs paid**
- **Free:** all cards, with a watermark.
- **$4.99 one-time (later):** an 18x24 in poster PDF at 300 dpi (track grid plus stats), a no-watermark set and a "compare to 2025" card. The Etsy comparables above price a digital file at $34.58.
- The poster is rendered client-side (canvas to PDF with jsPDF), so no print partner is needed.
- Stripe goes live only with Matt's approval.

**Growth loop**
1. Cards go to Instagram Stories and the Strava feed itself, as a photo on an activity.
2. Running and cycling club group chats see "how did you get that without Strava paid?"
3. The watermark brings them in, they request their own export, and they come back.
4. The export wait is a built-in retention step: capture the email at "request your archive", then send one Kit email.

**7-day free launch plan**

Last year's Garmin recap went out on Dec 9 and Strava's around Dec 16-20, when the paywall complaints peak. Build Nov 30 - Dec 6, and launch Dec 8-16.

| Day | Work |
|-----|------|
| 1 | zip.js lazy reader, `activities.csv` parser with alias map, Garmin CSV parser, GPX parser, unit tests on 3 synthetic and 2 public sample exports. |
| 2 | Cards 1-8 and 10, share and save from the Wrapped engine, export-help tabs, Kit "remind me" capture, privacy note, CSP. |
| 3 | Map card from GPX/FIT (cut it if FIT parsing slips), mobile QA on an iPhone with a 1GB zip, OG image, sitemap. |
| 4 | Show HN: "Free Year in Sport from your Strava export, runs in your browser". Free listings: AlternativeTo (as a Strava Year in Sport alternative) and Indie Hackers products. |
| 5 | Reddit drafts for r/running, r/cycling, r/Strava and r/Garmin, only where tools are allowed. Matt posts from an account with history, or approves. |
| 6 | Pitch the paywall angle to the outlets that covered it (road.cc, T3, Gadgets & Wearables) through public tip forms. **That's outreach, so it needs Matt's OK.** |
| 7 | Read the funnel (landing → export requested → file dropped → deck → share). Turn on the poster unlock if the share rate holds. |

**Success metric.** Decks generated by `?ref=card` visitors ÷ all decks generated.
- **≥ 0.3 by Dec 23** means it's working.
- Secondary: "remind me" signups that come back to drop a file, **≥ 40%**.

### #2 Dating Wrapped

The working name is a placeholder, such as **"Swipe Recap"**. Don't use "Tinder" or "Hinge" in the brand; "works with Tinder and Hinge data exports" is fine.

**User flow**
1. The landing page shows a demo deck and the line "Nothing uploads. We never show message text."
2. The user picks their app.
   - **Tinder:** the "Download my data" steps, with "usually 1-2 days" ([guide](https://www.swipestats.io/blog/download-tinder-data)).
   - **Hinge:** the in-app privacy request ([help](https://help.hinge.co/hc/en-us/articles/360011235813-How-do-I-request-a-copy-of-my-personal-data)).
   - Kit capture: "email me when to come back".
3. The user drops `data.json` or the Hinge zip. Parsing runs locally in a Worker.
4. A year picker, then the deck.
5. A **"Safe share" toggle is on by default.** It hides absolute numbers and shows only rates and labels, for people who don't want their friends to see "1,402 swipes".

**Data and terms**
- **Source:** the user's own export file, so there's no API and no CORS.
- **Tinder `data.json`:** a `Usage` object with per-day counts for likes, passes, matches, app opens and messages sent and received ([SwipeStats](https://www.swipestats.io/blog/download-tinder-data)).
- **Hinge:** match and like events with timestamps and chats.
- The exact field names are **unverified** here. Read SwipeStats' open-source parser for structure (check its license and don't copy code if it's incompatible), then build fixtures from synthetic files.
- **Privacy rules:**
  - Message bodies are only ever counted, never rendered.
  - Matches' names are never shown.
  - No analytics events carry stats.
  - The other party's words are their personal data, so the cards stay aggregate-only.

**Cards** (9:16)
1. **The year in swipes:** right-swipe rate as a big percentage, plus a label ("Picky", "Generous" or "Swiped right on everyone").
2. **Match rate:** matches per 100 right swipes, shown as a pictogram of 100 hearts.
3. **Peak season:** month bars with the "cuffing season" peak annotated.
4. **The 2am swiper:** an app-opens clock, using local time from the timestamps.
5. **Ghost town:** the share of matches with zero messages, plus "you ghosted vs got ghosted" where the data allows.
6. **Conversation starter:** the share of chats you opened. Counts only.
7. **Longest talk:** the most messages in one match, as a number only.
8. **Hinge only:** the most-liked prompt, from your own profile text, which is safe to show.
9. **Dating personality:** "The Selective Romantic", "The Night Shift", "The Ghost Hunter" and similar.
10. **Bonus (free, Valentine's week):** a "Be my Valentine?" card or link made from your stats. This is the ask-page trend folded in as a share hook.

**Free vs paid**
- **Free:** the 8 core cards.
- **$2.99 "Roast pack":** 6 extra savage-but-kind cards, a no-watermark set and a year-over-year comparison.
- Optional later: a Galentine's group mode where friends' safe-share stats are merged through a URL hash, with no backend.

**Growth loop.** The cards are built for TikTok and Story screen-recordings, and the "Dating Wrapped" format already exists there ([Know Your Meme](https://knowyourmeme.com/memes/dating-wrapped)). Friends' group chats also pass it around: "do yours". The watermark and `?ref=card` link bring those viewers in.

**7-day free launch plan**

Build Dec 14-18 and soft-launch Dec 26 to ride the "Dating Wrapped" wave. Push again Feb 1-13.

| Day | Work |
|-----|------|
| 1 | Tinder and Hinge parsers, synthetic fixtures, unit tests (time zones, empty years, zero-match accounts). |
| 2 | Cards, safe-share mode, share and save, Kit capture, privacy page stating what is and isn't read. |
| 3 | QA with a real export from a willing tester. Matt decides whether to ask someone, so it's optional; without it, launch with an "early version" label. |
| 4 | Product Hunt plus free directories, angled on "the dating Wrapped that never uploads". |
| 5 | 3 short demo videos from synthetic data for lab TikTok and Instagram, if Matt creates those accounts. |
| 6 | Reddit only where self-made tools are allowed (r/SideProject; dating subs usually ban promotion, so check first). Matt posts or approves. |
| 7 | Funnel review. Turn on the Roast pack if completion → share is ≥ 15%. |

**Success metric.**
- Share rate: decks with at least one share or save ÷ decks generated, **≥ 25%**.
- k-factor: `?ref=card` decks ÷ all decks, **≥ 0.3** in the Feb 1-14 window.

### #3 Streaming Wrapped (Netflix CSV)

The working name is a placeholder, such as **"Binge Report"**. Don't use the Netflix name or logo in the brand; "works with your Netflix viewing history" is fine.

**User flow**
1. The landing page is a 3-step GIF:
   - open Viewing activity on the web;
   - "Download all";
   - drop the file here.

   The download is instant, so there's no waiting step, which is the big UX edge over #1 and #2.
2. The user drops `NetflixViewingHistory.csv`. Several profiles can be dropped at once for a "household" deck.
3. A year picker, then the deck, then share or save.

**Data and terms**
- **Source:** the user's own CSV, so there's no API, no keys and no CORS.
- **Format:**
  - It's `Title,Date`, where Title looks like `Show: Season 1: "Episode"` and the date format follows the account's locale.
  - That format comes from experience and is **unverified** in this session. Confirm it with one real export before building.
  - The parser must handle M/D/YY vs D/M/YY by sniffing values greater than 12.
- **No runtimes in the file.** "Hours watched" is an estimate from episodes × the per-type median. Label it "about".
  - TMDB could supply runtimes but needs a key and has commercial terms, so it's out of the MVP.

**Cards**
1. Titles and episodes this year.
2. Top 5 shows, as a podium.
3. Biggest binge day: date, show and episode count.
4. Seasons finished vs abandoned after episode 1 ("The Quitter's List").
5. Night-owl share. The CSV has dates only (**unverified** whether times are included), so if there are no times, use a weekday heatmap instead.
6. Rewatch champion: the same episode watched 2+ times.
7. Movie vs series split.
8. Household mode (2+ profiles): "who's the biggest binger".
9. Viewer personality.

**Free vs paid.** Free cards. A $2.99 pack adds the household deck, a no-watermark set and "all years" mode.

**Growth loop.** Household and partner comparisons spread through family chats. The "Quitter's List" card is the meme hook. Use the watermark plus `?ref=card` as before.

**7-day free launch plan.** Build Nov 18-22 and launch by Nov 28. Kapwing's version got press on Nov 29 2024 and Dec 2 2025.

| Day | Work |
|-----|------|
| 1 | CSV parser (locale dates, title splitting), stats, fixtures, tests. |
| 2 | Cards, household mode, share and save, Kit capture, OG image. |
| 3 | Cross-link from Group Chat Wrapped and Reading Wrapped ("more Wrapped"), sitemap. |
| 4 | Show HN with the "client-side, open source" angle, plus AlternativeTo as a "Kapwing Netflix Wrapped alternative". |
| 5 | Tips to the writers of last year's how-to pieces (What's on Netflix, The Tab, Beebom) through public forms. **Outreach, needs Matt's OK.** |
| 6 | Short demo video from a synthetic CSV for lab socials, if they exist. |
| 7 | Funnel review. |

**Success metric.** Decks generated ÷ landing visitors **≥ 35%** (the instant export should make this high), and k **≥ 0.2**.

---

## Cross-cutting notes

- All three top picks reuse the existing card engine, share/save and zip code in `docs/wrapped/` and `docs/reading/`. Suggested route: one "Wrapped hub" page at `lab/wrapped-hub/` listing Chat, Reading, Sport, Dating and Streaming, with each deck's footer cross-selling the others.
- Kit tags will be needed for each new app (`TAGID_SPORT`, `TAGID_DATING`, `TAGID_STREAM`), following the existing placeholder pattern.
- Calendar, assuming Round 1 work is unchanged:
  - Streaming Wrapped by Nov 28;
  - Year in Sport by Dec 8;
  - Dating Wrapped by Dec 26 (repush Feb 1);
  - Goal Card by Dec 26;
  - Then/Chicago and Restaurant/Chicago whenever there's slack.

## What Matt would need to do (batched, none blocking the builds)

1. Create 3 Kit tags when each app is ready.
2. Approve any Stripe unlocks ($4.99 poster, $2.99 packs) before payment code is added.
3. Approve any Reddit, HN or Product Hunt posts and press tip-line outreach.
4. Optional: give one real Strava or Garmin export, Netflix CSV or Tinder/Hinge export (his own or a willing friend's) for QA. Each is used locally and never committed.
