# Venture Lab: App Ideas, Round 1

Researched 2026-11-13. Research only: no accounts created, nothing posted, nobody contacted.

Constraints applied: static GitHub Pages + GitHub Actions, Kit for email capture, free-tier backend only (Matt sign-up under 5 minutes), no paid APIs without Matt's approval, Stripe (test mode) for payments, legal and within platform terms.

## Scoring

Each criterion is scored 1-5. Total out of 20.

- **(a) Growth:** viral or organic potential (shareable output, network effect, SEO surface, store discovery)
- **(b) Build:** an agent can ship the MVP alone in under 2 days
- **(c) Revenue:** clear path to money (freemium, one-time, B2B)
- **(d) Demand:** evidence that people want it (search volume, competitor traction, threads, store user counts)

## Ranked list

| # | Idea | Type | Backend | a | b | c | d | Total |
|---|------|------|---------|---|---|---|---|-------|
| 1 | **Group Chat Wrapped**: a year-in-review card deck for a WhatsApp or Telegram group | Client-side web app | None | 5 | 5 | 3 | 4 | **17** |
| 2 | **Ad-free sign-up sheets** for potlucks, meal trains, snack rotas and volunteers | Web app | Cloudflare Workers + D1 (free) | 4 | 4 | 4 | 5 | **17** |
| 3 | **No-signup Secret Santa** where the organizer can't peek | Web app | Same Worker + D1 as #2 | 4 | 5 | 2 | 5 | **16** |
| 4 | **Group e-card**: a Kudoboard / GroupGreeting alternative | Web app | Workers + D1 + R2, or Supabase | 4 | 3 | 5 | 4 | 16 |
| 5 | **Fantasy League Awards**: Sleeper league season superlatives | Client-side web app | None | 4 | 4 | 3 | 4 | 15 |
| 6 | **Niche daily guessing game** with an emoji share grid | Static web game | None | 5 | 5 | 1 | 3 | 14 |
| 7 | **Recall Check**: recall lookup for resellers and parents (programmatic SEO + alerts) | Programmatic-SEO site + Actions cron | None, plus Kit | 3 | 4 | 3 | 3 | 13 |
| 8 | **Group availability poll**: a modern when2meet | Web app | Workers + D1 | 4 | 4 | 2 | 3 | 13 |
| 9 | **Ingredient checker** ("does X contain seed oils") built on Open Food Facts | Programmatic-SEO site | None | 3 | 4 | 2 | 3 | 12 |
| 10 | **On-device review-health extension**, filling the gap Fakespot left | Chrome extension | None (Gemini Nano) | 2 | 3 | 2 | 3 | 10 |
| 11 | **Cert-number overlay** for graded cards and autographs on eBay | Chrome extension | None | 2 | 4 | 2 | 2 | 10 |
| 12 | **Unit-price extension** for Amazon, Walmart and Instacart | Chrome extension | None | 2 | 5 | 1 | 2 | 10 |

Ties are broken by timing and by speed to ship. #1 needs no backend and its peak season is three weeks away. #3 ranks above #4 because Secret Santa demand peaks in the next six weeks and it reuses #2's backend.

### Checked and dropped

- **Spotify "receipt" or stats apps.** Spotify stopped new app creation on 2025-12-28. Development Mode is now capped at 5 users and needs Premium, and extended access requires 250k MAU. The idea is dead. ([Headphonesty](https://www.headphonesty.com/2026/02/spotify-crackdown-thousands-third-party-music-apps/), [Spotify community thread](https://community.spotify.com/t5/Spotify-for-Developers/Web-API-quota-updates-for-Development-Mode/td-p/7508852))
- **YouTube Wrapped from Google Takeout.** YouTube launched its own native Recap in December 2025. ([Digital Music News](https://www.digitalmusicnews.com/2025/12/02/youtube-recap-debuts-spotify-wrapped-style-stats/), [Chrome Unboxed](https://chromeunboxed.com/youtube-launches-its-own-end-of-year-video-recap/))
- **Splitwise clone.** The anger over Splitwise's daily cap is real, but the space is flooded with clones (Spliit, Tricount, Splid and dozens of pages.dev sites). ([Finny comparison](https://getfinny.app/blog/best-splitwise-alternatives-2026), [AlternativeTo](https://alternativeto.net/software/splitwise/?p=3))
- **Tariff / HTS lookup programmatic SEO.** Saturated in 2026, and wrong answers carry liability. ([AMZ Prep calculator](https://amzprep.com/us-reciprocal-tariffs-calculator/), [tariffsapi](https://tariffsapi.com/tariff-calculator?hts=8415), [Flexport-style simulators](https://www.sdcexec.com/transportation/fleet-management/news/22950028/project44-project44-launches-free-tariff-simulator))
- **Generic AI page summarizer extension.** Chrome now ships Gemini in Chrome, and the summarizer extension space is crowded.

---

## Candidate notes and evidence

### 1. Group Chat Wrapped (client-side, no backend)

**What it is.** The user exports a WhatsApp chat (`.txt` or `.zip`) or a Telegram Desktop export (JSON) and drops it on the page. Everything is parsed in the browser and nothing is uploaded. The page builds 10-15 swipeable cards:

- who texts most;
- the night owl;
- the ghost;
- the essay writer;
- top emoji;
- longest streak;
- busiest day;
- response-time "fastest replier";
- one award for each member.

Users download the cards or share them back to the chat through the Web Share API.

**Why it spreads.** The output is about the group, so it gets posted back into that same group. Every member wants to see their own award, and each of them belongs to other groups. The timing fits "Wrapped season": Spotify Wrapped usually lands in the first week of December.

**Evidence.**
- Several paid native apps already sell this: [WhatStats: Wrapped & Analytics](https://apps.apple.com/us/app/id1481007233), [Spilk Chat Wrapped](https://apps.apple.com/us/app/-/id6627342798), [ChatWrapped: Love Wrapped](https://mwm.ai/apps/chatwrapped-love-wrapped/6740534904), [The Cringe: Chat Wrapped](https://mwm.ai/apps/the-cringe-chat-wrapped/6766070732) and [Wrapp: Chat Recap](https://apps.apple.com/us/app/-/id6745177108).
- It has launched on Product Hunt: [WhatsApp Wrapped](https://www.producthunt.com/posts/whatsapp-wrapped) and [wspwrapped](https://www.hunted.space/product/wspwrapped).
- Web versions exist too: [whatsappwrapped.demolab.com](https://whatsappwrapped.demolab.com/) and [trymypost](https://www.trymypost.com/whatsapp/wrapped). [ZapZipped](https://feedbagel.com/post/zapzipped-whatsapp-group-year-in-review-tool-for-analyzing-chat-statistics) has been covered.
- There is a trust problem: [Ground News ran "WhatsApp Wrapped: genuine or scam?"](https://ground.news/article/analyzing-whatsapp-wrapped-genuine-feature-or-scam), and [WhatsWrapped was pulled from the US App Store](https://appgoblin.info/apps/6744784832). A web version that is open source and verifiably never uploads anything is the way to stand out.

**Risks.**
- Don't use "WhatsApp" in the product name or logo. "Works with WhatsApp exports" is fine.
- The export format varies by locale and OS, so the parser needs tests against date formats from US, UK, EU and 24-hour locales.

### 2. Ad-free sign-up sheets (Workers + D1)

**What it is.** No account needed. The organizer builds a sheet (potluck, Friendsgiving, meal train, snack schedule, volunteer shifts, carpool) and gets two links: one to share and one secret admin link. Participants claim a slot with just their name.

**Why it spreads.** Every sheet goes out to 10-40 people, and the footer reads "Make your own: free, no ads, no sign-up". Template landing pages give a long tail of SEO pages.

**Evidence.**
- SignUpGenius ranks [#352 in the US and #1,538 globally on Similarweb](https://www.similarweb.com/website/signupgenius.com/competitors). Meal Train ranks #8,735 globally and PerfectPotluck #149,104.
- An industry of "SignUpGenius alternative" pages exists ([Grasshopper](https://grasshoppersignup.com/signup-genius-alternatives), [Zelos](https://getzelos.com/signup-genius-alternative), [Jotform roundup](https://www.jotform.com/nonprofit/sign-up-genius-alternative/), [AlternativeTo](https://alternativeto.net/software/signupgenius/)). That signals real dissatisfaction with ads, fees and forced sign-up ([Grasshopper on fees](https://grasshoppersignup.com/answers/signupgenius-too-expensive)).
- Thanksgiving 2026 is Thursday Nov 26.

**Risks.**
- Crowded at the top, but the long-tail templates are winnable.
- Reminder emails need a transactional email provider, so they are left out of the MVP (see the spec).

### 3. No-signup Secret Santa (shares #2's backend)

**What it is.**
1. The organizer creates a group and posts one join link in the group chat.
2. Each person joins with a name and an optional wishlist.
3. The organizer sets exclusions (couples) and clicks Draw.
4. Each person sees only their own match. Because the draw runs server-side, the organizer can't peek.

**Evidence.**
- "Secret santa" gets 301k searches a month worldwide on average. In 2025 that was 1.22M in November and 1.83M in December ([RankHero](https://www.rankhero.com/keywords/secret-santa)).
- The drawnames app has about 197.5K ratings and an estimated 9.9M+ installs ([AppGoblin](https://appgoblin.info/apps/932002377/keywords)).
- Elfster has been around since 2011 with 2M+ members ([Wikipedia](https://en.wikipedia.org/wiki/Elfster)).
- Indie "no email" and "organizer can't peek" versions exist ([PH: no email required](https://www.producthunt.com/p/secret-santa-generator-no-email-required/secret-santa-generator-no-email-required), [PH: organizer can't peek](https://www.producthunt.com/p/self-promotion/built-an-anonymous-secret-santa-where-the-organizer-can-t-peek-looking-for-honest-feedback), [Hashnode build log](https://hashnode.com/posts/how-i-built-a-no-signup-secret-santa-generator-in-3-weeks-and-what-i-learned/691426a28d5516dc38b89e6b), [giftlist.com tool](https://giftlist.com/tools/secret-santa-generator)).

**Risks.**
- Very crowded. A new domain won't rank in Google before December, so growth has to come from the in-product loop.
- Revenue is weak: affiliate gift ideas (Amazon Associates is free but Matt has to sign up) and cross-selling to #1 and #2.
- Strategically it is the **seasonal wedge** for #2: the same organizers run potlucks and school sign-ups all year.

### 4. Group e-card: Kudoboard / GroupGreeting alternative

**What it is.** A coworker creates a farewell or birthday board, 10-50 people sign it with text, a GIF or a photo, and it is delivered to the recipient. Every card exposes the product to the signers and then to the recipient.

**Evidence.**
- GroupGreeting charges $5.99 a single card and $54-$399 for bundles ([G2 pricing](https://www.g2.com/products/groupgreeting/pricing)).
- Kudoboard is an established paid product ([G2 compare](https://www.g2.com/compare/groupgreeting-vs-kudoboard)). Free challengers are piling in ([RecoCards](https://gamma.recocards.com/blog/ecards/is-kudoboard-worth-it-pricing-explained/), [invitiapp](https://invitiapp.com/blog/kudoboard-alternative), [groupcards.io](https://groupcards.io/blog/the-best-group-card-websites-of-2025-top-picks-for-farewells-birthdays-team-celebrations/)).

**Why it scores lower on build.** It needs image uploads and moderation. R2 (Cloudflare's file storage) has a 10GB free tier, and Supabase Storage gets 1GB. A GIF picker needs a free GIPHY or Tenor API key, which takes a sign-up.

This has the best B2B revenue of the list, but it is a 3-4 day build if done properly. It is a strong Round 2 candidate on the #2 stack.

### 5. Fantasy League Awards (Sleeper, client-side)

**What it is.** Paste a Sleeper username or league ID and get season superlatives: the "luckiest" team (points-against), the worst trade, a bench-points "what if" table, the playoff path and per-manager award cards to share in the league chat.

**Evidence.**
- The [Sleeper API](https://pypi.org/project/sleeper-api-wrapper/) is free, read-only and needs no key.
- The open-source [fantasy-football-wrapped](https://github.blesdmm.dns-dynamic.net/kt474/fantasy-football-wrapped) project claims "nearly 30,000 users" and [launched on Product Hunt as ffwrapped](https://www.producthunt.com/products/ffwrapped).
- Paid adjacent tools exist: [Stacked Pro weekly emails](https://www.stackedfantasy.com/nfl/news/weekly-emails), [AI weekly recaps](https://www.stork.ai/startups/fantasy-football-ai-weekly-recaps) and [FPL Wrapped](https://www.fantasyfootballscout.co.uk/2025/06/02/say-goodbye-to-2024-25-with-fpl-wrapped).
- Fantasy playoffs run mid-to-late December, so the timing works.

**Risks.**
- ESPN private leagues need user cookies and Yahoo needs OAuth, so the MVP covers Sleeper only.
- Avoid NFL or team logos.
- Stay away from betting affiliates.
- A direct competitor already has traction.

### 6. Niche daily guessing game

Daily puzzles with an emoji share grid spread on their own, and an agent can build one in a day. The money is poor, though. [csdle.gg](https://flippa.com/13016744-csdle-gg-is-a-1-year-old-cs2-daily-guessing-game-with-800k-guesses-organic-seo-traffic-leaderboards-xp-and-multiple-game-modes) had about 11K active users and 800K guesses over 90 days, yet listed **$3/month** profit, with an asking price of $8K.

Exits do happen ([Wordle to NYT](https://www.gamepressure.com/newsroom/puzzle-game-wordle-acquired-by-new-york-times/zb3faa), [Puzzmo to Hearst](https://hn.jakechampion.name/reader/https://www.theverge.com/2023/12/4/23984103/puzzmo-acquired-hearst-zach-gage)) but they are lottery tickets. This is good as a cheap traffic-and-list builder, not as a revenue play.

### 7. Recall Check (programmatic SEO + alerts)

**What it is.** Pages for each brand and product category, built from the free CPSC (SaferProducts), NHTSA and openFDA recall APIs. A GitHub Actions job refreshes them daily, and a Kit form handles "alert me" sign-ups. A B2B angle would be bulk CSV checks of inventory for resellers.

**Evidence.**
- National coverage of recalled products being resold on Marketplace, eBay and Craigslist, including seller liability ([Sinclair "Spotlight on America"](https://wjla.com/news/spotlight-on-america/hidden-danger-recalled-products-resold-online-facebook-marketplace-craigslist-ebay-liability-rock-n-play-baby-death-reported-newborn-infant)).
- It fits the lab's proven strength: NYC data tools built the same way.

**Weakness.** It doesn't spread on its own, and incumbents like recalls.gov and NHTSA own the head terms.

### 8. Group availability poll (modern when2meet)

The network loop is good and the idea is evergreen, but money is thin. The open-source [Rallly](https://rallly.co/en-GB/when2meet-alternative) and crab.fit cover it, and Cal.com, Doodle and ClickUp all publish "when2meet alternatives" content ([Cal.com](https://cal.com/blog/when2meet-alternatives), [AlternativeTo](https://alternativeto.net/software/when2meet/?p=2), [r/opensource "I made a better when2meet"](https://redlib.hackliberty.org/r/opensource/comments/1dlol7r/i_made_a_better_when2meet)). It is worth adding later as a module on the #2 brand, not as a standalone product.

### 9. Ingredient checker from Open Food Facts

**What it is.** Pages for each product, such as "Does X contain seed oils / dyes / gluten". The data is ODbL-licensed, so it needs attribution and share-alike on the database ([OFF data](https://world.openfoodfacts.org/data), [ODbL notes](https://wiki.openfoodfacts.org/ODBL_License)).

**Evidence.** [Seed Oil Scout](https://appgoblin.info/apps/com.extravirginventures.seedoilscout) has about 285K installs and an estimated <$10K/month, but installs are declining.

**Weaknesses.** Data gaps and health-claim sensitivity. Revenue is affiliate only.

### 10. On-device review-health extension (Fakespot gap)

**Why there's an opening.** Mozilla shut Fakespot down on 2025-07-01 because it had no sustainable business model ([Michael Tsai roundup](https://mjtsai.com/blog/?p=48317), [Slickdeals PSA](https://slickdeals.net/f/18333682-psa-fakespot-is-shutting-down)). Chrome's built-in [Summarizer and Prompt APIs](https://developer.chrome.com/docs/ai/built-in-apis?hl=en) (Gemini Nano, stable for extensions since Chrome 138) make on-device inference free.

**Weaknesses.**
- [Review Guardian](https://chromewebstore.google.com/detail/bcbikaimlbbbeihljpmaeeccnlddpcdl), which does exactly this, has **76 users**. Store discovery alone isn't enough.
- It can only read the page the user is viewing. Background-fetching Amazon review pages risks breaking Amazon's terms.

### 11. Cert-number overlay for graded cards and autographs on eBay

Detect PSA, BGS, SGC or JSA cert numbers in a listing and link to the official verification page. It already exists: [CertCheck for Chrome](https://chromewebstore.google.com/detail/mofjoojkbejdalfenhcmbcgdjenpijok) and [eBay Coin Cert Lookup](https://chromewebstore.google.com/detail/ebay-coin-cert-lookup/ieleidbkemmpdoffdbjaglameabpodoi). It also sits close to Matt's Autographia industry, which he has said he wants kept separate from the lab. Low priority.

### 12. Unit-price extension

It solves a real daily annoyance, but the space is saturated with tiny extensions. The leading [Amazon Unit Price](https://chromewebstore.google.com/detail/amazon-unit-price/aggicbiihjlccnmafankkdfemoandjkj) has about **1,000 users**, and others include Walmart Unit Price, Instacart Unit Price and Unit Price Shopper ([listing roundup](https://chromeboard.com/extension/amazon-unit-price-aggicbiihjlccnmafankkdfemoandjkj), [maker's r/chrome_extensions post](https://redlib.librenode.com/r/chrome_extensions/comments/1k8432q/unit_price_shopper_progress_and_learnings)). The low ceiling is the evidence against it.

---

## Top 3: MVP specs

### #1 Group Chat Wrapped

The working name is a placeholder; avoid "WhatsApp" in the brand.

**Core user flow**
1. The landing page shows a 15-second demo deck made from a synthetic chat, plus the line "Your chat never leaves your phone" and a link to the open-source code.
2. A "How to export" toggle (iPhone / Android / Telegram Desktop) shows a three-step GIF for each platform.
3. The user drops in the `.zip` or `.txt`. JSZip and the parser run in a Web Worker, and a progress bar shows activity. No network call is made after the page loads; this is enforced by a strict CSP `connect-src 'self'`.
4. The user picks a year (default 2026) and sees a card deck: group totals, top talkers, the hourly heatmap, top emoji and words, the longest streak, the "left on read" award, and one superlative for each member.
5. The user can share a card through the Web Share API (straight into WhatsApp), download a PNG, or download all cards as a ZIP.
6. Every card carries a small URL watermark with `?ref=card`.

**Tech stack**
- Static GitHub Pages: vanilla TypeScript or Preact, JSZip, and `html-to-image` for PNG export.
- Parser fixtures for US, UK and EU 12/24-hour WhatsApp formats, plus Telegram JSON. Tests run in GitHub Actions.
- Optional progressive enhancement: where the browser supports Chrome's built-in Prompt or Summarizer API (on-device Gemini Nano), show an extra "group vibe in one line" card. Otherwise it is hidden. There is no API cost either way.
- Backend: **none** for the free tier. For the paid unlock, either use a Stripe Payment Link that returns an unlock code (simple, crackable, acceptable at $2.99), or add one **Cloudflare Worker (free tier)** that verifies the Stripe Checkout session. Either way Matt has to take Stripe out of test mode.
- Analytics: Cloudflare Web Analytics or GoatCounter. Both are free and need a sign-up from Matt.

**Free vs paid**
- **Free:** 8 core cards with a watermark, current year only.
- **$2.99 one-time per chat**, or **$4.99 for unlimited chats this season**: all 15+ cards, a per-member award slide for everyone, no watermark, a 9:16 story-format set, a year-over-year comparison and an MP4/slideshow export (canvas recording, client-side).

**Growth loop.** Card posted into the group → 5-50 members see their own award → some tap the watermark → they run it on their other groups. Secondary loop: screen-recorded "our group chat Wrapped" videos on TikTok and Reels. The cards are designed to be filmed.

**7-day launch plan (free channels only)**

The plan is to soft-launch Nov 24-30 and push Dec 1-5, when Spotify Wrapped lands.

| Day | Work |
|-----|------|
| 1 | Build the parser, stats engine and 8 cards. Write synthetic test chats. |
| 2 | Polish the cards, add the share and download flow, the export GIFs, the privacy page and the CSP. Open-source the repo. Matt runs it once on a real group chat as QA. |
| 3 | Lab-account or friends-and-family soft launch: Matt drops it in 2-3 of his own group chats (needs his OK). Measure the share rate. Fix parser failures from real exports. |
| 4 | Show HN: "Group chat Wrapped that runs 100% in your browser (open source)". HN rewards the privacy and client-side angle. Submit to free directories: AlternativeTo, Indie Hackers products, BetaList, There's An AI For That (only if the AI card ships). |
| 5 | Post 3 short demo videos on a new lab TikTok and Instagram account, made from synthetic chats (Matt creates the accounts). |
| 6 | Reddit, only in subs whose rules allow tools, framed as a free, privacy-first tool and posted by an account with history (Matt's call). Product Hunt launch, timed with Spotify Wrapped day. |
| 7 | Read the funnel (landing → file dropped → deck viewed → share). Fix the biggest drop. Turn on the paid tier if the share rate is healthy. |

**The single "it's working" metric**

Viral coefficient k = new decks generated by `?ref=card` visitors ÷ decks generated.
- **k ≥ 0.3 in week 1** means it's working.
- **k ≥ 1** means it's breaking out.

Drop-off at "file dropped" is the leading indicator to watch.

### #2 Ad-free sign-up sheets

The brand is a placeholder.

**Core user flow**
1. The organizer picks a template: potluck, Friendsgiving, meal train, snack schedule, volunteer shifts, carpool, or custom.
2. They edit the slots (item, quantity, date and time, notes). Example: "Potluck · 4 sides, 3 desserts, 2 drinks".
3. Create returns a **share link** and a **secret admin link**. "Email me my admin link" is optional and goes through a Kit form tag.
4. Participants open the share link and claim a slot with a name and an optional note. No account is needed.
5. They can add the event to their calendar (.ics) and edit or cancel through a personal edit link.
6. The organizer's admin view shows a live sheet, lets them lock or close it, and exports CSV.
7. The footer on every page reads "Make your own free sheet — no ads, no sign-up".

**Tech stack**
- Static GitHub Pages frontend (Preact).
- **Cloudflare Workers + D1, free tier**: about 100k requests a day, 5M rows read and 100k rows written a day, and 5GB of storage. It never pauses, which is why it is preferred over Supabase: Supabase free projects pause after a week of inactivity. Matt signs up in under 5 minutes.
- Turnstile (free) on create and claim forms against spam bots.
- Template pages are pre-rendered by GitHub Actions for SEO.
- Reminder emails are deferred to Phase 2. They need a transactional email provider such as Resend's free tier; Kit isn't built for transactional mail.

**Free vs paid**
- **Free forever:** unlimited sheets, no ads, .ics files, CSV export.
- **Pro at $4/month or $29/year** for PTAs, teams and churches: email and SMS reminders, logo and colors, recurring schedules (weekly snack rota), multiple admins, custom questions, and an organization page listing all sheets.

**Growth loop.** Each sheet reaches 10-40 participants, so 10-40 new people see "make your own". Some of them organize their own event within weeks. On top of that, programmatic template pages target the long tail: "Thanksgiving potluck sign up sheet", "meal train for new baby", "soccer snack schedule", "teacher appreciation week sign up" and similar.

**7-day launch plan (free channels only)**

The plan is timed so the sheet is live for Friendsgiving and Thanksgiving (Nov 26). That means starting by Nov 16.

| Day | Work |
|-----|------|
| 1 | Worker + D1 schema (sheets, slots, claims, tokens), create and claim API, Turnstile. |
| 2 | Frontend for the create, share, claim and admin flows. 6 templates. .ics and CSV. Mobile-first QA. |
| 3 | 20 template landing pages with print-friendly versions. Submit the sitemap to Google Search Console and Bing Webmaster Tools (free, Matt verifies). |
| 4 | Pinterest pins for each template on the lab Pinterest account. Pinterest is where people look for "potluck sign up sheet" ideas. Matt creates the account. |
| 5 | Post to the lab Facebook Page (already approved) and to local parent and PTA groups only where the rules allow it. Listings on AlternativeTo and SaaSHub as a "SignUpGenius alternative". |
| 6 | Ship the Secret Santa module (#3) on the same domain and cross-link both ways. |
| 7 | Review where sheets come from (direct, footer, SEO) and fix the worst step in the claim flow. |

**The single "it's working" metric**

Footer-sourced organizers ÷ total organizers per week: new sheets whose creator first arrived through another sheet's footer.
- **≥ 15% by week 2** means the network loop is real.

### #3 No-signup Secret Santa

This runs as a module of #2, on the same domain and backend.

**Core user flow**
1. The organizer enters a group name, budget, exchange date and an optional "organizer plays too" flag.
2. They get one **join link** to post in the group chat.
3. Each person opens it, enters a name and an optional wishlist (text and links), and gets a private personal link to bookmark. Saving it to the browser's localStorage is optional.
4. The organizer sees who has joined (names only), sets exclusions (couples, last year's pairs) and clicks **Draw**.
5. The draw runs inside the Worker as a derangement with constraints, so the organizer can't see the results.
6. Each person's private link reveals only their own giftee and that person's wishlist.
7. Anonymous "ask my Santa a question" Q&A goes through the Worker.
8. Every page carries a "Run your own exchange" footer, plus a Kit form: "Remind me next November".

A zero-backend fallback mode (encrypted assignment in the URL fragment) is offered for families where the organizer doesn't play.

**Tech stack**
- Same GitHub Pages frontend and the same Cloudflare Worker + D1 as #2, plus Turnstile. No extra sign-ups beyond #2.
- Gift-idea pages by budget ("$20 secret santa gifts", "secret santa for coworkers") are generated statically.

**Free vs paid**
- **Everything is free.** Monetize through (a) Amazon Associates links on the gift-idea pages (Matt signs up; free; Associates needs 3 qualifying sales within 180 days to stay active), (b) a $2 "Office Pack" (logo, PDF name tags, white-elephant rules sheet), and (c) funneling organizers into #2 and #1.

**Growth loop.** One join link goes into a group chat, so 5-25 people use the tool. Every participant sees the "Run your own" footer, and people belong to 2-4 exchanges each season (family, office, friends). The Kit list ("remind me next year") gives a warm audience in 2027.

**7-day launch plan (free channels only)**

The plan has to be live by about Nov 22, because most draws happen between Thanksgiving and Dec 10.

| Day | Work |
|-----|------|
| 1 | Join and draw endpoints, exclusion solver with unit tests (impossible-constraint detection), private reveal page. |
| 2 | Wishlist and Q&A, mobile QA, zero-backend fallback mode, 10 gift-idea pages by budget and audience. |
| 3 | Friends-and-family test: Matt's own family or office exchange, if he wants. |
| 4 | Show HN and Product Hunt with the "organizer can't peek, no emails, no accounts" angle. Submit to free "Secret Santa generator" roundup authors such as [PopSci](https://www.popsci.com/story/diy/secret-santa-websites-guide/), [Educators Technology](https://www.educatorstechnology.com/2022/12/the-7-best-secret-santa-generators.html) and [Uplup](https://uplup.com/blog/best-secret-santa-generator-tools) through their public contact forms. **That is outreach, so it needs Matt's OK.** |
| 5 | Pinterest pins (gift ideas by budget) and a lab Facebook Page post. |
| 6 | TikTok demo: "the Secret Santa app where even the organizer doesn't know". |
| 7 | Review the join-to-draw completion rate and the footer-sourced new groups. |

**The single "it's working" metric**

Groups created by people who first arrived as participants in another group.
- **≥ 10% of new groups by Dec 7** means the loop works and #2's brand has a seasonal feeder.

---

## What Matt would need to do (batched, none needed yet)

1. Create a **Cloudflare account** (free). It covers Workers, D1, Turnstile and Web Analytics for #1-#3.
2. Decide whether to buy a **domain**. github.io works at $0, but a domain helps SEO and trust. About $10/year, so it needs his OK.
3. Flip **Stripe to live** for #1's $2.99 unlock when we're ready.
4. Optionally sign up for **Amazon Associates** (#3 gift pages).
5. Decide whether to make lab social accounts (TikTok, Instagram, Pinterest) for launches. Approve any Reddit, HN or Product Hunt posts and any roundup-author outreach before they happen.

## Recommended order

1. Build #2's backend skeleton and ship **#3 Secret Santa first**, by about Nov 22. It is time-critical and fast to build.
2. Ship **#1 Group Chat Wrapped** by Nov 28 for the December Wrapped wave.
3. Expand **#2 sign-up sheets** into the year-round product: potlucks now, school and sports sheets in January.
