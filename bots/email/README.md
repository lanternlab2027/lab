# Welcome emails and dated reminders

Two daily jobs that keep the promises made by the Kit signup boxes on the Lantern Lab pages:

- `welcome.py` sends each new member of each app tag the welcome for that tag. Someone who joined several tags since the last run gets one combined "Welcome to Lantern Lab" email. The copy is in `welcome_texts.json` and comes from `WELCOME_EMAILS.md` section 2.
- `reminders.py` sends the dated emails the pages promised. The schedule and copy are in `reminder_texts.json`.

Both use only the standard library (Python 3.11+). They reuse `bots/notify/sender.py`: `Message`, `KitApi` and the `KitBroadcastSender` steps, through `emailbot.ScopedKitSender`. They also reuse `bots/notify/kit_source.py` for the v3 fallback reads.

## Daily command (lab sprint, cloud workspace)

The secrets come from env vars only and are never printed or written to a file:
- `KIT_V4_API_KEY`: reads tags and subscribers, and handles the tags, fields and broadcasts.
- `NOTIFY_STATE_SALT`: the same salt as notify.
- `KIT_API_SECRET` is used only as a read-only fallback when there is no V4 key.

**Real send, once a day (after the first-send plan below is done):**

```sh
cd /home/claude/lab/bots/email && EMAIL_BACKEND=kit python3 welcome.py --send && EMAIL_BACKEND=kit python3 reminders.py --send
```

**Dry run.** This is the default. It reads Kit, writes `outbox/`, sends nothing and saves no state:

```sh
cd /home/claude/lab/bots/email && python3 welcome.py && python3 reminders.py
```

- Run it once a day at about the same time, for example 9-10am ET, off the hour.
- A run takes about 30 s: `KitApi` waits 0.55 s per call.
- Kit sends each broadcast `KIT_SEND_DELAY_MIN` minutes after the run (15 by default). That leaves time to cancel in Kit.
- After a real send, commit `welcome_state.json` and `reminder_state.json`. They hold only salted hashes.
- Never commit `outbox/`. It is git-ignored.

Offline previews use fake `example.com` subscribers and make no Kit calls:

```sh
cd /home/claude/lab/bots/email && python3 welcome.py --fixture fixture_subscribers.json --now 2026-11-16T14:00:00Z
cd /home/claude/lab/bots/email && python3 reminders.py --fixture fixture_subscribers.json --today 2026-12-18
```

## First-send plan

The first real email goes only to the test subscriber, through `--only-email`.

1. **Dry run against Kit.** Run `python3 welcome.py`, then check `outbox/welcome_index.json` and the `.txt` files.
2. **Test send to one address:**
   ```sh
   cd /home/claude/lab/bots/email && EMAIL_BACKEND=kit python3 welcome.py --send --only-email veraashwoodbooks@gmail.com
   ```
   - Only that subscriber is tagged `welcome-due-1`, and one private broadcast is scheduled for 15 minutes later.
   - The address must already be on at least one app tag in Kit. If it isn't, the run prints `0 matching subscriber(s)` and sends nothing. To fix that, sign up once on any page, for example `/tiktok/`.
   - `--only-email` doesn't move the watermark, so the next full run still finds everyone else.
3. **In the inbox, check:**
   - The HTML from the `welcome_body` custom field renders, including the links. This is notify's open item, still untested.
   - The subject is right.
   - Kit's unsubscribe footer is present.
4. **Wait** until Kit shows that broadcast as completed. The next run refuses to run while a `[welcome]` broadcast is still draft, scheduled or sending.
5. **Switch the sprint to the daily command above.** The first full run welcomes everyone tagged since 2026-11-09 (`FIRST_SINCE`) and skips the test address, which was already welcomed.
6. **Reminders.** The first one is due on 2026-12-01 (scroll-wrapped). That morning, run:
   ```sh
   EMAIL_BACKEND=kit python3 reminders.py --send --only-email veraashwoodbooks@gmail.com
   ```
   Wait for that broadcast to complete, then run the daily command. If the test address isn't on `scroll-wrapped`, `--only-email` finds nothing and sends nothing. Preview it any day with `python3 reminders.py --today 2026-12-01`.

## How sending is scoped in Kit (`EMAIL_BACKEND=kit`)

This uses the same steps as notify, with its own names, so it never touches notify's or snow's recipients:

| | notify | snow_alerts | welcome.py | reminders.py |
|---|---|---|---|---|
| temporary tags | `alert-due` | `snow-alert-due` | `welcome-due-1..N` | `reminder-due-1..N` |
| body field | `alert_body` | `snow_alert_body` | `welcome_body` | `reminder_body` |
| broadcast marker | `[alerts]` | `[snow-alerts]` | `[welcome]` | `[reminder]` |

Each run follows these steps:
1. It stops if an earlier broadcast with its marker isn't completed.
2. It removes its own `*-due-N` tags from last run's recipients.
3. It groups the emails by subject (plus `send_at`). Each person gets one email per run, so each person is in exactly one group.
4. For each recipient, it looks them up by email (and skips them if they aren't active), writes the HTML into the body field, and adds that group's tag.
5. It creates one broadcast per group:
   - `public: false`
   - filter = that group's tag
   - content `{{ subscriber.<field> }}`
   - `send_at` = now + 15 min (or the reminder's own `send_at` if that is later)

State is saved right after each broadcast is created. A crash therefore never resends a group that was already scheduled, and anything not yet scheduled is retried on the next run. A real send needs both `--send` and `EMAIL_BACKEND=kit`. Anything else writes `outbox/`.

## welcome.py

- **Which subscribers it reads.** For each tag in `welcome_texts.json` it reads the active subscribers with `tagged_after` = (last full real run − 24 h). The first run uses 2026-11-09. `--since` overrides the window. The overlap re-reads people, and the state decides who was really welcomed: one salted hash per (tag, subscriber).
- **Custom fields it fills in.** Placeholders come from the subscriber's custom fields:
  - `building_address` and `snow_zip`, with defaults when empty
  - `santa_exchange_date`, shown as "Saturday, December 19"
  - `league_id`
  - `exam_code`: the quizzes' own field (Kit id 1433461). It is used only when it looks like `F-01`.
- **Copy variants:**
  - fantasy-awards with an empty `league_id` gets a "look up your own league" version.
  - secret-santa with no date says the reminder comes on Fri Dec 18, a week before Christmas.
  - house-history with no address gets a generic subject.
  - From 2026-12-04, scroll-wrapped's welcome becomes the export nudge itself, because its reminder date has passed.
- **nyc-then and chicago-then** are included. Both pages now promise only launch news, a few times a year.
- **house-history** prints a NOTE with the number of new leads, because its welcome promises a personal email within a day. Matt has to send that by hand.
- `--skip-tags a,b` holds back tags for one run.

## reminders.py: the schedule

Each (occurrence, subscriber) pair is sent at most once. Only that tag's active subscribers get it. A tag is read only on days when one of its reminders is open. A person with several reminders due on the same day gets one combined email. Links carry `?ref=email-<tag>`.

| id | tag | when | the page's promise |
|---|---|---|---|
| scroll-wrapped-2026 | scroll-wrapped | **2026-12-01** (catch-up to Dec 4) | "One email in late November" / "once when Wrapped season opens" |
| secret-santa | secret-santa | 7 days before `santa_exchange_date`, or any day until the day before. If the date is blank or can't be read: Dec 18–24, using Christmas as the date | "once, a week before your exchange" |
| year-in-orders-tax-2027 | year-in-orders | 2027-01-12 (to Jan 17) | "One email in January to pull your business purchases" |
| etsy-year-tax-2027 | etsy-year | 2027-01-12 (to Jan 17) | "One email in January to download your statements and run the summary" |
| mileage-log-tax-2027 | mileage-log | 2027-01-12 (to Jan 17) | "One email in January to export your Timeline and build your log" |
| couples-wrapped-valentines-2027 | couples-wrapped | 2027-02-07 (to Feb 10) | "one reminder before Valentine's Day" |
| bracket-2027-selection-sunday | bracket-2027 | 2027-03-14 (to Mar 15). The broadcast is scheduled for **8:30pm EDT** (`send_at` 2027-03-15T00:30Z), after the field is revealed | "One email on March 14, 2027, when the field is posted" |
| goal-bingo-{month} | goal-bingo | 1st of each month, Feb–Dec 2027 (catch-up 2 days) | "One short email a month in 2027". The rule is from `bots/bingo/NOTES.md`. |

- `--today YYYY-MM-DD` previews any date. It can't be combined with `--send`.
- To change a date or the copy, edit `reminder_texts.json`. Keep it ASCII and write any other character as a `\u` escape.

### Decisions to confirm, and promises still without a sender

- **scroll-wrapped:** the page says "late November", but the brief set Dec 1. The welcome now says "on December 1". Moving the date to Nov 30 is a one-line edit in `reminder_texts.json`, plus the welcome line in `welcome_texts.json`.
- **Tax time:** Jan 12, 2027 is my pick within "January". The bracket email depends on the field being posted on `docs/bracket/` by 8:30pm on Mar 14.
- **Not dated, so not sent yet:**
  - `nyc-taxappeal`: comparable sales after about Jan 15, plus a reminder before the class deadline. Both need data and the official 2027 dates.
  - sport-wrapped and dating-wrapped: a "come back" reminder that has no date.
  - Event-based promises: new SSA names, dog data, next year's editions, card packs, app drops, fantasy awards, and LL97, eats and chi-eats alerts.

## Files

| File | What |
|---|---|
| `welcome.py`, `reminders.py` | The two jobs. |
| `emailbot.py` | Shared code: hashed state, Kit reader (v4, or v3 fallback), rendering, `ScopedKitSender`, `Outbox`. |
| `welcome_texts.json`, `reminder_texts.json` | Copy and schedule, ASCII with `\u` escapes. |
| `fixture_subscribers.json` | Fake `example.com` signups for `--fixture`. |
| `welcome_state.json`, `reminder_state.json` | Created by the first real send. `sha256(salt|...)` hashes plus `last_run`. Safe to commit. |
| `outbox/` | Dry-run preview. Files are named `welcome_<n>_<hashed id>` and `reminder_<n>_<hashed id>`, and they contain no email addresses. Git-ignored. |
| `tests/test_email_bots.py` | 24 tests. Kit is faked at `urllib.request.urlopen`. |

## Tests

```sh
cd /home/claude/lab && python3 -m unittest discover -s bots/email/tests -v
```

The tests cover:
- `tagged_after` new-subscriber detection and the watermark
- the combined welcome, fields and variants
- per-subject scoped broadcasts, dedupe state with no emails or ids in it, `--only-email`, and refusal while a broadcast is pending
- reminder date windows, the secret-santa per-subscriber window and its fallback, and the bracket `send_at`
- dry-run output with no addresses, and the `--send` gates

## Not verified

- **A live send.** In particular:
  - whether HTML from a custom field renders in a broadcast
  - the custom field length limit
- **A live read.** This workspace has no Kit keys, so `tagged_after` and `fields` in the v4 tag listing are as documented in `WELCOME_EMAILS.md`. If `fields` is missing from the listing, the reader fetches each subscriber once.
