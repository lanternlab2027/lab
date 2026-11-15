# Welcome emails for Kit signups

Status as of 2026-11-15. Research and drafts only. Nothing was created in Kit, nothing was sent, and only read-only GET calls were made.

## TL;DR

- **The API can create sequences and their emails, but it cannot attach them to a tag.** Kit v4 has `POST /v4/sequences`, `POST /v4/sequences/{id}/emails` and `POST /v4/sequences/{id}/subscribers/{subscriber_id}`. There is no endpoint that creates or edits visual automations or rules, so the tag-to-sequence trigger has to be built in the Kit UI.
- **The free plan allows 1 sequence and 1 basic visual automation, and no Rules.** We have 36 app tags. The account shows `plan_type: creator` today (live check), probably the trial, which likely ends around Nov 23. After that, one sequence per app doesn't fit.
- **Recommendation: build the welcome bot in section 4.** It is a small daily job that finds each tag's new subscribers since the last run (`tagged_after` works, checked live) and sends each one the right welcome through the same tag + custom field + private broadcast mechanism that `bots/notify` and `bots/snow_alerts` use. It costs $0, works on the free plan and needs nothing from Matt in the Kit UI.
- **Optional, only while on Creator:** section 3 has the exact (not executed) API calls to create the sequences, plus about 2 minutes of UI steps per tag to attach each one.
- **Honesty check:** most signup promises have **no sender yet** (update: `bots/email/welcome.py` and `reminders.py` now send the welcomes and the dated reminders). Only `building-watch`, `nyc-hearings` (`bots/notify/daily.py`) and `snow-day` (`bots/snow_alerts/snow.py`) have code that sends the promised email. The welcomes below repeat each page's promise and add no new ones. The table in section 2 lists which promises still need a sender.

---

## 1. What the Kit API can and cannot do

### Live read-only checks (2026-11-15, V4 key and V3 secret)

| Call | Result |
|---|---|
| `GET /v4/account` | 200, `plan_type: creator` (the V4 key works) |
| `GET /v3/tags` | 37 tags: the 36 app tags (ids match the brief) plus `alert-due` 25845233 |
| `GET /v3/sequences`, `GET /v4/sequences` | `[]`, so no sequences exist |
| `GET /v4/email_templates` | one template: `Text only` id **5679874** (default) |
| `GET /v4/webhooks` | `[]` |
| `GET /v4/tags/{id}/subscribers` for each app tag | `building-watch` has 1 (Matt's test address). Every other tag has 0. |
| `GET /v4/tags/25837871/subscribers?tagged_after=2020-01-01T00:00:00Z` | 1 row, and each row has a **`tagged_at`** field. The same call with `tagged_after=2030-…` returned 0, so the filter works. |

### What the docs say

| Question | Answer | Source |
|---|---|---|
| Create a sequence by API? | **Yes (v4).** `POST /v4/sequences`. Body: `name` (required), `email_address`, `email_template_id`, `send_days`, `send_hour`, `time_zone`, `active`, `repeat`, `hold`, `exclude_subscriber_sources` (by tag, sequence, form or segment ids). The API key goes in `X-Kit-Api-Key`. It creates an *empty* sequence. | [Create a sequence](https://developers.kit.com/api-reference/sequences/create-a-sequence.md) |
| Add emails to a sequence by API? | **Yes (v4).** `POST /v4/sequences/{sequence_id}/emails`. Body: `subject`, `delay_value`, `delay_unit` (`days` or `hours`) are required; optional: `content` (HTML), `preview_text`, `email_template_id`, `published` (default **false** = draft), `send_days`, `position`. Notes: "Only the first email can send immediately" (`delay_value: 0`, `delay_unit: "days"`), and publishing an immediate first email "sends to those subscribers right away". Update and get endpoints also exist. | [Create a sequence email](https://developers.kit.com/api-reference/sequence-emails/create-a-sequence-email.md), [Update a sequence email](https://developers.kit.com/api-reference/sequence-emails/update-a-sequence-email.md) |
| Add a subscriber to a sequence by API? | **Yes.** `POST /v4/sequences/{sequence_id}/subscribers/{id}` with body `{}`. It returns 201 when the subscriber is added and **200 when they were already in it** (no duplicate). The subscriber must already exist. A by-email variant exists. v3 has `POST /v3/sequences/{id}/subscribe`. | [Add subscriber to sequence](https://developers.kit.com/api-reference/sequences/add-subscriber-to-sequence.md), [by email](https://developers.kit.com/api-reference/sequences/add-subscriber-to-sequence-by-email-address.md), [v3 sequences](https://developers.kit.com/api-reference/v3/sequences) |
| Create or attach a **visual automation** or **rule** (for example, tag added → sequence) by API? | **No.** The v4 reference has no automation or rule endpoints. The only "automation" paths in v3 were webhook hooks, and v4 renamed them: "The URL paths for webhooks have changed from `/automations/hooks` to `/webhooks`." Kit's docs describe automations only as UI features. | [Upgrading to v4](https://developers.kit.com/api-reference/upgrading-to-v4), [Creating your first visual automation (help)](https://help.kit.com/en/articles/5523023-how-to-create-your-first-kit-visual-automation), [Automation rules (help)](https://help.kit.com/en/articles/6611507-how-to-create-and-manage-automation-rules-in-kit) |
| Webhooks on tag add? | Yes, `POST /v4/webhooks` can fire on subscriber events. But it needs a public HTTPS receiver, and the lab only has GitHub Pages, which is static. Not usable without a server. | [Create a webhook](https://developers.kit.com/api-reference/webhooks/create-a-webhook), [Event types](https://developers.kit.com/webhooks/event-types) |
| List new subscribers per tag? | Yes. `GET /v4/tags/{id}/subscribers` accepts `tagged_after`, and each row carries `tagged_at` (confirmed live). Sequence subscriber lists also accept `added_after` and `created_after`. | live check; [List subscribers for a sequence](https://developers.kit.com/api-reference/sequences/list-subscribers-for-a-sequence) |
| Plan limits | Free Newsletter plan: "1 basic visual automation with 1 email sequence". Paid plans: "Unlimited Visual Automations and Sequences" and "More automation features like Rules". The help page doesn't say what happens to extra sequences or automations after a downgrade. | [The Kit Newsletter plan](https://help.kit.com/en/articles/9053602-the-kit-newsletter-plan) |

**Bottom line:** the API can create every sequence and email, and it can enroll people in a sequence. It cannot make the tag trigger. That leaves three options:
- **(a)** Matt builds the triggers in the UI (Creator plan only, 36 of them).
- **(b)** A bot enrolls new tag members into the sequences by API (still Creator plan only, because each app needs its own sequence).
- **(c)** The broadcast bot (works on any plan). This is the recommendation.

---

## 2. The welcome emails

Conventions for every email:
- Links use `https://lanternlab2027.github.io/lab/<path>?ref=welcome-<tag>`.
- Kit appends the real unsubscribe link and address footer to both broadcasts and sequence emails.
- A Kit unsubscribe removes the person from *all* Lantern Lab email, and each email says so.
- Signups never collect a first name, so there is no `Hi {{name}}`.
- `{{ subscriber.<field> | default: "…" }}` is Kit Liquid for the sequence version. The bot (section 4) fills the same values in Python instead, so it doesn't depend on Liquid.
- Every body is under 120 words.

### Promise and sender status

| Tag | Page promise (quoted from the source) | Sender exists? |
|---|---|---|
| building-watch | "first alert digest for this building within a day"; daily alerts; free 3 months, then $6/building/month or $59/year | **Yes**, `bots/notify/daily.py` |
| nyc-hearings | "in the week before each upcoming hearing … and again in the last two days. Email reminders are starting soon" | **Yes**, `daily.py` (3–7 days and 0–2 days before) |
| snow-day | "email you when the odds for [ZIP] look high" | **Yes**, `bots/snow_alerts/snow.py` |
| house-history | "we'll email you within a day with what we can find for that house and a link to order" | **No, manual.** Matt has to reply by hand. |
| ll97-energy, nyc-taxappeal, nyc-eats, chi-eats | change alerts / deadline reminder / comparables | No |
| exams (6 EN + 1 ES) | "occasional study tips for your exam" | No |
| nyc-calendar-2027 | PDF shown on page + "occasional emails about NYC building deadlines" | No (PDF already delivered on the page) |
| nyc-then, chicago-then | "an email when new photo packs or new city games launch (a few times a year)"; no daily email (page and `signup.js` updated) | No (launch news is sent by hand when a pack or game ships) |
| fantasy-awards | "weekly awards emailed … still testing" | No |
| goal-bingo | "one short email a month in 2027" | No |
| secret-santa | "once, a week before your exchange" (field `santa_exchange_date`) | No. **Time-sensitive: exchanges are in December.** |
| scroll-wrapped | "One email in late November" | No. **Due within about 2 weeks.** |
| bracket-2027 | "One email on March 14, 2027" | No |
| mileage-log, year-in-orders, etsy-year | January tax-time email (+ next year's recap for orders and etsy) | No |
| baby-names / nyc-dog-names | one email when new SSA rankings (May) / city dog data is in | No |
| sport-wrapped, dating-wrapped | one "come back" reminder + next year's edition | No |
| reading-wrapped, netflix-wrapped | once, when next year's edition is ready | No |
| wrapped, couples-wrapped, party-bingo, app-drops | new card packs / Valentine's reminder + packs / new preset packs / new app drops | No |

---

### NYC building owners

**building-watch** (`docs/buildingwatch/lookup.html`)
```
Subject: You're on Building Watch for {{ subscriber.building_address | default: "your building" }}

Thanks for signing up for Building Watch.

What happens next: every day we check NYC Open Data. When something new is filed for your building (violations, complaints, summonses, hearing dates, deadlines), we email you a plain-English digest. Your first one should arrive within a day. Quiet days mean no email.

Free for your first 3 months while we're in beta. After that it's $6 per building per month or $59 a year. We never took a card, so nothing is charged automatically.

Look up another building: https://lanternlab2027.github.io/lab/buildingwatch/lookup?ref=welcome-building-watch

Informational only, not legal advice.
To stop these emails, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**nyc-hearings** (`docs/hearings/index.html`)
```
Subject: Your OATH hearing reminders are set

Thanks for joining the Hearing Watch beta.

What you signed up for: an email in the week before each upcoming hearing on your lookup, and another in the last two days. It's free while we're in beta.

Please don't rely on email alone. Add the hearing to your calendar with the .ics download under each result, and always confirm the date on your latest OATH notice.

Check a hearing or a new summons: https://lanternlab2027.github.io/lab/hearings/?ref=welcome-nyc-hearings

Not legal advice, and not affiliated with OATH.
To stop these emails, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```
*Note:* the page still says "Email reminders are starting soon". Once `daily.py` is scheduled, update that page line. This email avoids saying "soon".

**ll97-energy** (`docs/ll97/index.html`)
```
Subject: We'll watch your building's energy data

Thanks for signing up.

What happens next: we'll email you when new benchmarking data, a new energy letter grade or a DOB deadline change shows up for your building. NYC publishes this data a few times a year, so expect only a few emails a year, and none when nothing changes.

Reminder: the LL97 penalty on the page is a rough estimate. Only a registered design professional's LL97 report filed with DOB counts.

Check your building again: https://lanternlab2027.github.io/lab/ll97/?ref=welcome-ll97-energy

To stop these emails, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**nyc-taxappeal** (`docs/taxappeal/index.html`)
```
Subject: Your tax appeal reminder is set

Thanks for signing up.

What happens next:
1. Around mid-January, after DOF posts the new tentative values (usually about January 15), we'll send this property's comparable sales.
2. Before your tax class's 2027 appeal deadline, we'll send a reminder so you have time to file with the Tax Commission.

That's it. It's free.

Re-run the appeal check any time: https://lanternlab2027.github.io/lab/taxappeal/?ref=welcome-nyc-taxappeal

Not legal or tax advice.
To stop these emails, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**nyc-calendar-2027** (`docs/calendar/index.html`)
```
Subject: Your 2027 NYC owner compliance calendar

Thanks for downloading the calendar. Here's the link again in case you lost the tab:
https://lanternlab2027.github.io/lab/calendar/nyc-2027-owner-calendar.pdf?ref=welcome-nyc-calendar-2027

It's 17 printable pages with every 2027 city deadline for 1-20 unit buildings, each with its source. Dates marked "Expected" will be confirmed once the City publishes them.

What's next: occasional emails about NYC building deadlines, mostly when one is coming up. Nothing weekly.

Want deadlines for your own building? https://lanternlab2027.github.io/lab/buildingwatch/lookup?ref=welcome-nyc-calendar-2027

General information, not legal advice.
To stop these emails, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**house-history** (`docs/househistory/index.html`). Human follow-up required.
```
Subject: We got your house: {{ subscriber.building_address | default: "your address" }}

Thanks for asking about your house's history.

What happens next: we're opening orders in small batches. Within a day you'll get a personal email from us with what the public records hold for that address (deeds back to 1966, old maps and photos where they exist) and a link to order the full report, from $79. If there isn't much on your house, we'll tell you plainly.

See sample reports: https://lanternlab2027.github.io/lab/househistory/?ref=welcome-house-history

To stop these emails, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```
*Note:* "within a day" is a promise Matt has to keep by hand. If he can't, change the page and this email to "within a few days".

### Exam practice (one template, 6 English exams)

The quizzes store the exam code in its own custom field `exam_code` (Kit field id 1433461). This replaced `building_address`; see the note in section 5.

```
Subject: Your {EXAM} practice bank is unlocked

Thanks for signing up. The full question bank and the timed mock exam are now open on the device you used. On a new phone or computer, enter your email again to unlock it there.

Pick up where you left off: {URL}?ref=welcome-{TAG}

What's next: an occasional study tip for your exam, nothing more. Official materials always win. Check the agency's own study guide before test day.

Good luck on the exam.

To stop these emails, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

| Tag | {EXAM} | {URL} |
|---|---|---|
| fdny-cof | FDNY Certificate of Fitness | https://lanternlab2027.github.io/lab/cof/quiz |
| nyc-guide | NYC Sightseeing Guide | https://lanternlab2027.github.io/lab/guide/quiz |
| nyc-food | NYC Food Protection | https://lanternlab2027.github.io/lab/food/quiz |
| nyc-hic | NYC Home Improvement Contractor | https://lanternlab2027.github.io/lab/hic/quiz |
| nyc-processserver | NYC Process Server | https://lanternlab2027.github.io/lab/processserver/quiz |
| nyc-tlc | NYC TLC Driver | https://lanternlab2027.github.io/lab/tlc/quiz |

For fdny-cof, the bot can add the exam code from the field: "Your FDNY {{ subscriber.exam_code }} practice bank…" (F-01, F-03, F-60, S-95).

**nyc-food-es** (Spanish, `docs/food/es/quiz.html`)
```
Subject: Su banco de preguntas de Protección de Alimentos está desbloqueado

Gracias por inscribirse. Todas las preguntas y el examen de práctica con reloj ya están abiertos en el dispositivo que usó. En otro teléfono o computadora, escriba su correo otra vez para desbloquearlos.

Siga practicando: https://lanternlab2027.github.io/lab/food/es/quiz?ref=welcome-nyc-food-es

Qué sigue: de vez en cuando, un consejo de estudio para su examen. Nada más. Revise siempre el manual oficial antes del examen.

¡Mucha suerte!

Para dejar de recibir estos correos, use el enlace para darse de baja al final (detiene todos los correos de Lantern Lab).
- Lantern Lab
```

### Restaurant alerts

**nyc-eats** (`docs/eats/kit.js`, field `restaurant_camis`)
```
Subject: Grade alert set for your restaurant

Thanks for signing up.

What happens next: we'll email you when a new letter grade for this restaurant shows up in the NYC Health Department's inspection data. Grades change only after an inspection, which happens at least once a year, so this email may be the only one for months.

See the report card again: https://lanternlab2027.github.io/lab/eats/?ref=welcome-nyc-eats

A grade reflects one inspection on one day. Read the full history before drawing conclusions.
To stop these emails, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**chi-eats** (`docs/chi-eats/kit.js`, field `restaurant_license`)
```
Subject: Inspection alert set for your restaurant

Thanks for signing up.

What happens next: we'll email you when a new inspection for this restaurant shows up in the City of Chicago's data. Inspections happen on the city's schedule, so you may not hear from us for a while.

Check the inspection history again: https://lanternlab2027.github.io/lab/chi-eats/?ref=welcome-chi-eats

One inspection reflects one day. Read the full history before drawing conclusions.
To stop these emails, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

### Daily photo games (launch news only)

**nyc-then** (`docs/then/signup.js`)
```
Subject: You're on the NYC Then list

Thanks for signing up.

What happens next: an email when new photo packs or new city games launch, a few times a year. There's no daily email, so come back to the page for each day's photo.

Play today's photo: https://lanternlab2027.github.io/lab/then/?ref=welcome-nyc-then

All photos come from the Library of Congress.
To stop these emails, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**chicago-then** (`docs/chicago-then/signup.js`)
```
Subject: You're on the Chicago Then list

Thanks for signing up.

What happens next: an email when new photo packs or new city games launch, a few times a year. There's no daily email, so come back to the page for each day's photo.

Play today's photo: https://lanternlab2027.github.io/lab/chicago-then/?ref=welcome-chicago-then

All photos come from the Library of Congress.
To stop these emails, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```
*Updated:* both pages now promise only launch news (a few times a year), with no daily email, so these welcomes are sent like the others.

### Wrapped apps: "we'll write once, when it's time"

**reading-wrapped**
```
Subject: You're on the list for next year's Reading Wrapped

Thanks for signing up.

What happens next: one email, when next year's Reading Wrapped is ready (around the end of 2027). That's the only email this list sends.

Your library never left your device, and we only have your email address.

Make or share this year's cards: https://lanternlab2027.github.io/lab/reading/?ref=welcome-reading-wrapped

To stop this, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**netflix-wrapped**
```
Subject: You're on the list for next year's Streaming Wrapped

Thanks for signing up.

What happens next: one email, when next year's Streaming Wrapped is ready (around the end of 2027). That's all.

Your viewing history never left your device. We only have your email address.

Make or share this year's cards: https://lanternlab2027.github.io/lab/netflix/?ref=welcome-netflix-wrapped

To stop this, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**sport-wrapped**
```
Subject: We'll remind you to make your Year in Motion cards

Thanks for signing up.

Strava and Garmin exports can take a while to arrive. What happens next: one reminder to come back and make your cards once your export is ready, then one note when next year's edition is live. That's all.

Your activities never leave your device. We only have your email address.

Come back here: https://lanternlab2027.github.io/lab/sport/?ref=welcome-sport-wrapped

To stop these, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**dating-wrapped**
```
Subject: We'll remind you when to come back

Thanks for signing up.

Tinder and Hinge exports can take days to arrive. What happens next: one reminder to come back and make your Dating Wrapped, then one note when next year's edition is ready. Nothing else.

Your export never leaves your device. We only have your email address.

Come back here: https://lanternlab2027.github.io/lab/dating/?ref=welcome-dating-wrapped

To stop these, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**scroll-wrapped**
```
Subject: Your Scroll Wrapped reminder is set

Thanks for signing up.

What happens next: one email in late November, when Wrapped season opens, as a nudge to request your TikTok data export. It can take a few days to arrive, so it helps to ask early.

The messages section of your export is thrown away the moment it's opened, and nothing leaves your device.

Get a head start: https://lanternlab2027.github.io/lab/tiktok/?ref=welcome-scroll-wrapped

To stop this, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```
*Note:* late November is now. Send this reminder soon, or make the welcome itself the nudge.

**wrapped** (Group Chat Wrapped)
```
Subject: You'll hear about new Group Chat Wrapped card packs

Thanks for signing up.

What happens next: a short email when we drop a new card pack. There's no fixed schedule, so expect only a few a year.

Nothing from your chat was ever sent anywhere. We only have your email address.

Run your chat again: https://lanternlab2027.github.io/lab/wrapped/?ref=welcome-wrapped

To stop these, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**couples-wrapped**
```
Subject: Your Valentine's reminder is set

Thanks for signing up.

What happens next: one reminder before Valentine's Day 2027 to make your Couples Chat Wrapped, plus a note when we add new card packs. That's it.

Nothing from your chat was ever sent anywhere. We only have your email address.

Make your cards: https://lanternlab2027.github.io/lab/couples/?ref=welcome-couples-wrapped

To stop these, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

### Tax-time reminders

**mileage-log**
```
Subject: Your January mileage-log reminder is set

Thanks for signing up.

What happens next: one email in January to export your Google Maps Timeline and build your mileage log for tax season. That's the only one.

Your trips never leave your device. We only have your email address.

The tool: https://lanternlab2027.github.io/lab/mileage/?ref=welcome-mileage-log

Not tax advice. Check your log against your calendar and receipts.
To stop this, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**year-in-orders**
```
Subject: Your tax-time reminder is set

Thanks for signing up.

What happens next: two emails. One in January reminds you to pull your business purchases for taxes. The other comes when next year's Year in Orders recap is ready.

Your orders never leave your device. We only have your email address.

Back to your recap: https://lanternlab2027.github.io/lab/amazon/?ref=welcome-year-in-orders

Not tax advice.
To stop these, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**etsy-year**
```
Subject: Your January reminder is set

Thanks for signing up.

What happens next: two emails. One in January reminds you to download your Etsy statements and run your tax summary. The other comes when next year's Seller Year in Review is ready.

Your shop data never leaves your device. We only have your email address.

Back to your review: https://lanternlab2027.github.io/lab/etsy/?ref=welcome-etsy-year

Not tax advice.
To stop these, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

### Once-a-year data updates

**baby-names**
```
Subject: We'll email you when the new baby name rankings land

Thanks for signing up.

What happens next: one email when the Social Security Administration publishes its new baby name rankings (usually in May) and they're in the report card. That's it.

Look up a name: https://lanternlab2027.github.io/lab/names/?ref=welcome-baby-names

To stop this, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**nyc-dog-names**
```
Subject: We'll email you when the new NYC dog names are in

Thanks for signing up.

What happens next: one email when the city's new dog license data is in. It updates about once a year.

Look up a dog name: https://lanternlab2027.github.io/lab/dogs/?ref=welcome-nyc-dog-names

To stop this, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

### Date-based reminders

**secret-santa** (field `santa_exchange_date`)
```
Subject: Your Secret Santa reminder is set

Thanks for signing up.

What happens next: one email a week before your exchange on {{ subscriber.santa_exchange_date | default: "the date you picked" }}, so there's time to shop. That's the only email.

We never saw your group's names or who drew whom.

Need to start over or make a wish list? https://lanternlab2027.github.io/lab/santa/?ref=welcome-secret-santa

To stop this, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**bracket-2027**
```
Subject: Selection Sunday reminder is set

Thanks for signing up.

What happens next: one email on Selection Sunday, March 14, 2027, when the 76-team field is posted and the bracket fills in with real teams. Nothing else.

Print the blank bracket or set up a pool: https://lanternlab2027.github.io/lab/bracket/?ref=welcome-bracket-2027

To stop this, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**goal-bingo**
```
Subject: Your monthly goal bingo nudge is set

Thanks for signing up.

What happens next: one short email a month in 2027 to remind you to check off squares. Your card and goals stay on your device, so bookmark your card link.

Open your card: https://lanternlab2027.github.io/lab/bingo/?ref=welcome-goal-bingo

To stop these, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**snow-day** (field `snow_zip`)
```
Subject: Snow day alerts on for {{ subscriber.snow_zip | default: "your ZIP" }}

Thanks for signing up.

What happens next: on school nights when our estimate for your ZIP reaches 50% or higher, we'll email you that evening. At most one email per school morning, and none when snow isn't likely.

It's just for fun. Only your school district decides, so check its official announcements.

Check the odds any time: https://lanternlab2027.github.io/lab/snow/?ref=welcome-snow-day

To stop these, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

### Fun and feature updates

**fantasy-awards** (field `league_id`)
```
Subject: Weekly awards for your league

Thanks for signing up.

What happens next: after each week's games, we'll email your league's awards (top scorer, biggest blowout, heartbreak loss and the rest). Emailed awards are still in testing, so the first ones may be a little rough.

See this week's cards now: https://lanternlab2027.github.io/lab/awards/?ref=welcome-fantasy-awards

We only stored your email and your league ID.
To stop these, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```
*Note:* signups from the sample league have an empty `league_id`. The bot should send those people a version without "your league's" and with a line asking them to look up their own league.

**party-bingo**
```
Subject: You'll get new watch-party bingo packs

Thanks for signing up.

What happens next: an occasional email when we add new ready-made square lists for big nights, like awards season, the tournament and finales. Nothing else.

Host your next game: https://lanternlab2027.github.io/lab/partybingo/?ref=welcome-party-bingo

To stop these, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

**app-drops**
```
Subject: You're on the Lantern Lab app list

Thanks for signing up.

What happens next: one short email when we ship a new app. That's it.

In the meantime, see what's already out: https://lanternlab2027.github.io/lab/apps/?ref=welcome-app-drops

To stop these, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

### Combined welcome (one person, several new tags in one run)

```
Subject: Welcome to Lantern Lab

Thanks for signing up. Here's what you'll get from us:

{one 1-2 sentence block per tag: the "What happens next" line + its ?ref=welcome-<tag> link}

To stop these emails, use the unsubscribe link below (it stops all Lantern Lab email).
- Lantern Lab
```

---

## 3. If staying on Creator: sequences by API + triggers in the UI

**Proposed only. Not executed.** These calls need the V4 key, and they only make sense if the account stays on a paid plan, because the free plan allows 1 sequence.

### 3a. API calls (per tag)

Load the key in one command without echoing it:

```sh
export KIT_V4_API_KEY="$(cat /tmp/claude-0/-home-claude/69ef2e03-4772-566e-a19b-2f78e096e5ba/scratchpad/secrets/kit_v4_key)"
```

Create the sequence. Example for `building-watch`; repeat with each tag's name.

```sh
curl -sS -X POST https://api.kit.com/v4/sequences \
  -H "X-Kit-Api-Key: $KIT_V4_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Welcome: building-watch","email_template_id":5679874,
       "time_zone":"America/New_York","active":true,"repeat":false,"hold":false}'
# -> {"sequence":{"id":SEQ_ID,...}}
```

Add the welcome as the first email, as a draft first:

```sh
curl -sS -X POST https://api.kit.com/v4/sequences/SEQ_ID/emails \
  -H "X-Kit-Api-Key: $KIT_V4_API_KEY" -H "Content-Type: application/json" \
  -d '{"subject":"You'\''re on Building Watch for {{ subscriber.building_address | default: \"your building\" }}",
       "delay_value":0,"delay_unit":"days","published":false,
       "content":"<p>Thanks for signing up for Building Watch.</p><p>…(body from section 2, one <p> per paragraph)…</p>"}'
# -> {"email":{"id":EMAIL_ID,"published":false,...}}
```

Publish it after Matt previews it in the UI:

```sh
curl -sS -X PUT https://api.kit.com/v4/sequences/SEQ_ID/emails/EMAIL_ID \
  -H "X-Kit-Api-Key: $KIT_V4_API_KEY" -H "Content-Type: application/json" \
  -d '{"published":true}'
```

Notes:
- `delay_value: 0` + `days` is the only way to send immediately, and only for the first email (docs).
- The sequence is empty when published, so publishing an immediate email sends nothing retroactively.
- The 7 exam tags can share the template text, but each needs its own sequence, because the exam name and link differ.
- `nyc-then` and `chicago-then` now promise only launch news (a few times a year), so their welcomes can be included.

### 3b. Attaching each sequence to its tag

The API can't do this, so the choice is between two routes.

**Route 1: an enrollment bot.** This is all API, with no UI. Add an enrollment step to the bot in section 4 that calls `POST /v4/sequences/{SEQ_ID}/subscribers/{subscriber_id}` with body `{}` for each new tag member.
- A 200 response means they were already enrolled, so there is no duplicate send.
- This replaces the broadcast step but keeps the same "find new members per tag" logic.

**Route 2: Matt in the Kit UI.** About 2 minutes per tag, 36 tags. With Rules, which are paid-plan only and fastest:
1. Kit → **Automate** → **Rules** → **+ New rule**.
2. Trigger: **Tag added** → pick the tag (e.g. `building-watch`).
3. Action: **Subscribe to sequence** → pick `Welcome: building-watch`.
4. **Save rule.** Repeat for the next tag.

Or with a visual automation, if Rules aren't shown:
1. **Automate** → **Visual Automations** → **+ New automation** → **Start from scratch**.
2. Entry point: **Tag is added** → pick the tag → **Add event**.
3. Click **+** below it → **Action** → **Email sequence** → pick `Welcome: <tag>` → **Add action**.
4. Rename it at the top to `Welcome: <tag>`, then switch **Draft** to **Live**.

Then test it: in **Subscribers**, add the tag to Matt's test address and confirm the welcome arrives. Remove the tag afterwards.

---

## 4. Recommended fallback: the daily welcome bot (design only, not built)

**Goal:** within about a day of signup, every new member of each app tag gets the matching welcome from section 2. It works on the free plan, needs no UI work and costs $0.

**Files:** `bots/welcome/welcome.py`, `welcome_copy.json`, `welcome_state.json`, `welcome.yml`. It's standard library only and reuses `bots/notify/sender.py`, the same way `bots/snow_alerts/snow.py` subclasses `KitBroadcastSender`.

**Flow (one run):**

1. **Find new members.** For each of the 36 app tags, call `GET /v4/tags/{id}/subscribers?status=active&tagged_after=<last_run − 1 day>`, paging with `after`. That is 36+ GETs, which the existing throttle in `KitApi.call` handles in about 25 s.
   - **Watermark:** the overlap window absorbs clock skew. The state file decides who has really been welcomed.
   - **Dedupe:** skip `(subscriber_id, tag)` pairs whose salted hash is already in `welcome_state.json`. Hashes use `NOTIFY_STATE_SALT`, as in `notify_state.json`, so the file holds no emails and is safe to commit.
   - **First run:** `--since 2026-11-09` (the account's first objects). That welcomes the few real signups and Matt's test address.
   - **Skip list:** `--skip-tags` for any tag whose promise has no sender yet. (The Then tags no longer need it: they now promise only launch news.)
2. **Compose.** Group by subscriber.
   - One new tag: use that tag's subject and body from `welcome_copy.json`, filling in `building_address`, `snow_zip`, `santa_exchange_date`, `league_id` and `exam_code` from the subscriber's `fields`. Empty fields fall back to the defaults shown in section 2.
   - Several new tags in one run: send the combined welcome. Each person gets one email per run.
   - The body is a short HTML version of the text: one `<p>` per paragraph, with the links as anchors.
3. **Send through the scoped broadcast.** This mirrors `KitBroadcastSender.flush`, with its own names so it never collides with `alert-due`/`alert_body` or `snow-alert-due`/`snow_alert_body`:
   - Use tag `welcome-due`, field `welcome_body` and a description prefix of `[welcome]`.
   - **a.** Refuse to run if an earlier `[welcome]` broadcast is still draft, scheduled or sending.
   - **b.** Remove `welcome-due` from last run's recipients.
   - **c.** For each recipient, `PUT /v4/subscribers/{id}` with `fields.welcome_body = html` (and `welcome_subject`, see below), then `POST /v4/tags/{welcome-due}/subscribers/{id}`.
   - **d.** `POST /v4/broadcasts` with `public: false` (hard-coded), `subscriber_filter: [{"all":[{"type":"tag","ids":[welcome_due_id]}]}]`, `content: "{{ subscriber.welcome_body }}"` and `send_at` = now + `KIT_SEND_DELAY_MIN` (15 minutes). That leaves a window to cancel in the Kit UI.
   - **e.** Save `welcome_state.json` only after the broadcast is created, so a failed run retries the next day.
4. **The subject problem.** A broadcast has one subject, but each app's welcome has its own. Two options:
   - **Test first:** subject `{{ subscriber.welcome_subject }}`. Kit Liquid may render in subjects, but that's not confirmed in the docs. Check it in the first live test to Matt's address. If it works, one broadcast per run is enough.
   - **Fallback:** one broadcast per distinct subject per run, each with its own short-lived tag (`welcome-due-1` … `welcome-due-N`, created on demand and cleared next run). Each person is in exactly one group per run, so the shared `welcome_body` field never collides. Expect about 1–5 broadcasts a day at current volume. The free plan allows unlimited broadcasts.

**Schedule:** GitHub Actions, daily, `cron: "17 14 * * *"` (9:17am EST / 10:17am EDT). That puts the worst-case wait just under a day, which matches Building Watch's "within a day". Every 6 hours (`"17 */6 * * *"`) is possible later, since each run is cheap.

**Secrets:** `KIT_V4_API_KEY` and `NOTIFY_STATE_SALT`, the same as notify. The V3 secret isn't needed, because the v4 tag listing does the reads.

**Safety:** same gate as notify. It's a dry run by default and writes `outbox/` with one file per welcome. A real send needs `--send` **and** `EMAIL_BACKEND=kit`. Dry runs in the Action delete `outbox/` and never upload or commit it.

**Load:** about 3 API calls per recipient plus about 40 per run. At 120 per minute, 100 new signups a day take about 3 minutes.

**Test plan before going live:**
1. Run against a fixture JSON of fake `example.com` subscribers across several tags, including one person on 2 tags, an empty `snow_zip` and an empty `league_id`. Check the outbox.
2. Run a mocked-API test of the call order and confirm it refuses to run while a `[welcome]` broadcast is pending.
3. Do one real send to Matt's test address only. Confirm the HTML in the custom field renders and that the subject Liquid works. Both are the same open item as `bots/EMAIL_SENDING.md`.

**Limits to accept:**
- A Kit unsubscribe removes the person from all Lantern Lab email. Every welcome says this.
- The welcome arrives up to about a day after signup, not instantly.
- Custom field length limits are untested.

---

## 5. Things found along the way

- **Field collision bug (fixed):** the 6 English exam quizzes and the Spanish one used to send the exam code in `fields.building_address`, which Building Watch (`bots/notify/daily.py:87`) and house-history use for the address. They now send it in its own Kit custom field `exam_code` (id 1433461), live on main. Older quiz signups may still have an exam code in `building_address`.
- **Promises with no sender:** see the table in section 2. These are the most urgent:
  - **scroll-wrapped** promised "late November"
  - **secret-santa** has exchanges in December
  - ~~**nyc-then / chicago-then** promise a daily email~~ Fixed: both pages now promise only launch news, with no daily email.
- **Plan timing:** the account still reports `creator`. If Matt wants the sequence route in section 3, it has to be set up and paid for before the trial ends (around Nov 23, inferred in `bots/EMAIL_SENDING.md`). Otherwise use section 4.
