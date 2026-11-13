# SEO notes: Venture Lab sites (Nov 13, 2026)

Site: https://lanternlab2027.github.io/lab/ (repo `docs/`, branch `main`). Nothing committed or pushed.

## What changed

**Head tags, on all 16 existing HTML pages and the 3 new ones.** Each page got a new `<title>` and meta description (most descriptions are now 150–160 characters), a canonical URL, Open Graph tags and Twitter tags. Everything sits between `<!-- seo:start -->` and `<!-- seo:end -->` in each `<head>`, so it is easy to find or strip.
- The `og:image` is `/lab/brand/cover.png` (1640x624) on every page except Juni. The cover reads "Free tools for NYC building owners", which doesn't fit a kids' letter, so Juni gets a plain `summary` card with no image.
- `cof/quiz.html` has no canonical, because its content depends on `?exam=`. The sitemap lists its four exam URLs instead. The food and guide quiz pages use canonicals with `?exam=FPC` and `?exam=GUIDE`, matching the internal links.
- The quiz pages still set `document.title` from JS (untouched). The static title is what crawlers see before JS runs.

**JSON-LD.**
- Home: `WebSite`.
- Lookup tools (Building Watch lookup, LL97, Hearing Watch, Tax Appeal): `WebApplication`, free offer. No ratings; none were invented.
- House History: `FAQPage`. It is built automatically from the page's own 7 `<details>` Q&As, with the text copied word for word.
- Exam index and study-guide pages: `LearningResource`. Quiz pages: `Quiz`.
- No other page has a real FAQ, so no other FAQPage was added. (Hearing Watch's "What to do" is a numbered list, not Q&A.)

**New study-guide pages:** `cof/study-guide.html`, `food/study-guide.html` and `guide/study-guide.html`.
- They are static and crawlable, grouped by topic: 41 short points for CoF (four exams), 23 for Food and 25 for Guide.
- Every point comes from the verified quotes and explanations in that site's `questions/*.json`. The citation link (source URL, PDF `#page=` and source title) is generated from the bank entry, not typed by hand.
- Each guide carries the same "not affiliated" disclaimer as its site, links to the official PDFs and pages, and links to the quiz.
- The guide-exam page repeats the "Not covered here" list. The food page repeats the note that the manual and study guide are dated.
- The point on DOT's Brooklyn Bridge and Fifth Avenue bus rules is labeled as the holiday-season rules, as the bank says.
- The generator is a scratch script (not in the repo). To change a point, edit the HTML directly.

**Internal links.**
- Each exam index links to its study guide: a button on CoF, and a link next to "Start free practice" on Food and Guide. Each quiz footer links to the guide too.
- Every page now links back to the home page (`../`) with "Lantern Lab NYC: more free NYC tools". On Building Watch, House History and the exam footers, the link is appended to the existing footer. On Lookup, LL97, Hearings and Tax Appeal, it is a new last line in `<main>`.
- No disclaimer text was changed or removed. The House History samples also link back to the order page.
- Juni got a small "A Lantern Lab project" link. **Delete it if you want Little Lantern Letters kept as a separate brand.**

**`docs/robots.txt` and `docs/sitemap.xml`.** The sitemap has 22 URLs: all pages, the 3 study guides, both House History samples, and the quiz URLs with their `?exam=` values.
- **Robots caveat:** crawlers only read robots.txt at the root of a host (`https://lanternlab2027.github.io/robots.txt`). Ours is served at `/lab/robots.txt`, so it is ignored until the site moves to a user site (a repo named `lanternlab2027.github.io`) or a custom domain. Nothing is lost meanwhile: with no robots.txt, everything may be crawled.
- The sitemap still works when submitted directly in Search Console.

**Not touched:** any `.js` or `.json` file, quiz logic, Kit keys and tag IDs (all 8 tag IDs checked, still present), and page layout or CSS. The study guides reuse each site's `style.css` plus a few inline rules.

**Tests:**
- Playwright at 390px on all 20 page URLs: 0 console errors, 0 page errors, no horizontal overflow, all JSON-LD parses.
- All 28 internal link targets and the sitemap URLs return 200 from a local `http.server` that serves `docs/` under `/lab/`.
- I answered one question on each of the 3 quizzes, and they still work.

## Target queries per page

| Page | New title | Main target queries |
|---|---|---|
| Home `/lab/` | Lantern Lab NYC: Free NYC Building Tools & Exam Practice | brand; "free NYC building tools" |
| `buildingwatch/lookup.html` | HPD Violation Lookup by Address: Free NYC Building Search | hpd violation lookup, hpd violations by address, check building violations nyc, dob ecb violations lookup |
| `buildingwatch/` | NYC Violation Alerts for Small Buildings \| Building Watch | nyc building violation alerts, hpd violation notification, small landlord compliance nyc |
| `ll97/` | LL97 Penalty Calculator & NYC Energy Grade Lookup (Free) | ll97 penalty calculator, local law 97 penalty calculator, nyc building energy grade lookup, ll33 energy grade |
| `hearings/` | OATH Hearing Lookup: Find Your NYC Summons Hearing Date | oath hearing lookup, oath summons lookup, ecb ticket finder, oath hearing date, missed oath hearing |
| `taxappeal/` | NYC Property Tax Appeal Check: Should I Appeal? (Free) | nyc property tax appeal, nyc property tax appeal deadline, tax commission appeal class 1, nyc property tax comparable sales |
| `househistory/` | NYC House History Report: Who Built My House? \| From $79 | history of my house nyc, nyc house history report, who built my house nyc, brownstone history research |
| House History samples | A History of 20 East 127th Street… / 70 Willow Street… | langston hughes house harlem, 70 willow street history, truman capote brooklyn heights house |
| `cof/` | FDNY CoF Practice Test: F-01 Fire Guard, F-03, F-60, S-95 | f-01 practice test, f01 fireguard practice test, fdny certificate of fitness practice test, s-95 practice test, f-03 practice test, f-60 practice test |
| `cof/study-guide.html` | F-01, F-03, F-60 & S-95 Study Guide: FDNY CoF Key Facts | f01 study guide, f-03 study material, s95 study guide, fdny cof study guide |
| `food/` | NYC Food Protection Certificate Practice Test (Free, Cited) | nyc food protection practice test, nyc food protection certificate practice test, food handlers test nyc |
| `food/study-guide.html` | NYC Food Protection Exam Study Guide: Temperatures & Rules | nyc food protection study guide, food protection course temperatures, danger zone 41 140 nyc |
| `guide/` | NYC Tour Guide License Exam Practice Test (Sightseeing Guide) | nyc tour guide license exam, nyc sightseeing guide exam practice test, nyc tour guide test questions |
| `guide/study-guide.html` | NYC Tour Guide Exam Study Guide: Sightseeing Guide License | nyc tour guide exam study guide, sightseeing guide study reference |
| `juni/` | Free Printable Pen Pal Letter for Kids from Juni the Owl | printable letter for kids, pen pal letter for kids, letter from an owl printable |

What the search results showed:
- The exam queries are mostly held by generic prep sites (practicetestgeeks, examzify, etc.) and nyc.gov. Our angle is "free + every answer cited to the official booklet", and the titles and descriptions lead with that.
- "LL97 penalty calculator" results are engineering firms and BE-Ex. None of them is a free per-building lookup from public data, so that is our edge.
- "OATH hearing lookup" results are almost all nyc.gov pages plus the ECB Ticket Finder.
- "Calculator" is in the LL97 title because that is the search term. The page and its description both say the result is a rough estimate.

## What Matt needs to do

1. **Review and publish.** Look over the diff (`git status` shows 16 modified files and 5 new ones), then commit and push to `main`. GitHub Pages redeploys in a minute or two.
2. **Verify in Google Search Console.** The verification tag is already on the home page, with a placeholder value.
   1. Go to https://search.google.com/search-console and sign in with the Google account that should own the site.
   2. Click **Add property**, choose the **URL prefix** box (not "Domain", which needs DNS access you don't have on github.io), enter `https://lanternlab2027.github.io/lab/` exactly, and click **Continue**.
   3. In the verification dialog, open **HTML tag** under "Other verification methods". Google shows a tag like `<meta name="google-site-verification" content="AbC123...xyz" />`. Copy only the value inside `content="..."`.
   4. Paste that value over `REPLACE_WITH_SEARCH_CONSOLE_CODE` in `docs/index.html`, or send it to Claude to do it. Commit, push, and wait about 2 minutes for Pages to deploy.
   5. Back in the dialog, click **Verify**. Leave the tag in place permanently, because removing it un-verifies the property.
3. **Submit the sitemap.** In Search Console, open **Sitemaps** (left menu), enter `sitemap.xml` (the box is prefixed with the property URL) and click **Submit**.
4. **Ask for indexing of the top pages.** In **URL Inspection**, paste each URL below and click **Request indexing**. There is a daily cap of about 10.
   - home
   - `buildingwatch/lookup.html`
   - `ll97/`
   - `hearings/`
   - `taxappeal/`
   - the three `study-guide.html` pages
5. **Optional, Bing:** at https://www.bing.com/webmasters, choose **Import from Google Search Console**. It takes one click once step 2 is done, and Bing also feeds DuckDuckGo.
6. **Optional, later:** a custom domain (about $12 a year) or a user-site repo. Either makes robots.txt work and allows a Domain property in Search Console. If you do it, update the canonical/OG URLs and the sitemap. They are all absolute, so a find-and-replace of `https://lanternlab2027.github.io/lab/` covers it.

## Honest expectations

- **FAQ rich results:** since 2023, Google shows FAQ rich results only for well-known government and health sites. House History's FAQPage markup is still valid and may help other search engines and AI answers, but expect no FAQ dropdowns in Google.
- **Quiz rich results:** `Quiz` and `LearningResource` markup does not produce Google "practice problems" rich results unless the questions are visible in the HTML. Ours are rendered by JS, which is why the study guides exist: they are the crawlable text.
- **Time to rank:** a new site on a github.io subpath with no backlinks usually takes weeks to months to rank. The quickest wins are likely the long-tail exam queries ("f-60 practice test", "s-95 study guide") and the study guides.
- **Links matter most now:** a handful of genuine links, from places where the tools actually help people, will do more than further on-page work.
