# Sending per-subscriber emails (Building Watch, Hearing Watch, LL97, exams)

Status as of 2026-11-13. "Live" means I checked it against the real Kit account from the shell that day. No email was sent to anyone.

## TL;DR

- **Kit can do this at $0, without a new account.** The v4 API can send a broadcast to just the subscribers with one tag. If the body is `{{ subscriber.alert_body }}`, each person gets their own text. The daily job writes each person's alert into that custom field, tags them `alert-due`, and schedules one broadcast to that tag.
- **What Matt has to do:** create a **V4 API key** in Kit (Settings > Developer > V4 keys > "Add a new key"). The existing v3 key and secret are rejected by `/v4` (live: HTTP 401 "The API key is invalid").
- **Not yet proven:** whether Kit renders HTML stored in a custom field inside a broadcast, and how long a field value can be. The first real send should go to Matt's own test subscriber only. If it fails, switch `EMAIL_BACKEND=smtp` and use Gmail SMTP with an app password (also $0 and no new account). The code supports both.

## 1. Kit: what the account and plan allow

### Live checks (2026-11-13)

| Check | Result |
|---|---|
| `GET /v3/account` (api_secret) | `plan_type: "creator"`. That is the paid Creator tier, not the free Newsletter plan, so this is almost certainly the 14-day Creator trial (Kit offers a 14-day Creator trial, no card: [kit.com/plans](https://kit.com/plans)). The first objects in the account are dated 2026-11-09, so the trial **probably ends around 2026-11-23** (my inference). After that the account drops to the free Newsletter plan. |
| `GET /v4/account` with the v3 key, or with the v3 secret, in `X-Kit-Api-Key` | 401 both times. **v4 needs its own V4 key.** |
| `GET /v3/tags` | 7 tags: `building-watch` 25837871, `nyc-hearings` 25840015, `ll97-energy` 25839659, `fdny-cof` 25838722, `house-history`, `nyc-guide`, `nyc-food` |
| `GET /v3/custom_fields` | `bbl`, `building_address`, `hearing_lookup`, `hearing_tickets`, `next_hearing`, `your_first_name` all exist |
| `GET /v3/subscribers` | 1 subscriber (Matt's test address), all watch fields empty, not tagged |
| `GET /v3/tags/{id}/subscriptions` | Works (0 subscribers on `building-watch` and `nyc-hearings`). `daily.py` reads subscribers this way. |
| `GET /v3/sequences` | none |
| `POST /v3/broadcasts` with no `send_at` | Created draft 27029517. Stats showed `status: draft`, **`recipients: 1` (the whole list)**. Deleted with `DELETE /v3/broadcasts/27029517`, which returned 204. Broadcast list is empty again. |

### What the API and plan allow

| Question | Answer | Source |
|---|---|---|
| Free plan subscriber cap | Up to 10,000 subscribers. Unlimited broadcasts. Tagging and segmentation included. API listed as available on Free. | [kit.com/plans](https://kit.com/plans); [Newsletter plan help](https://intercom.help/convertkit/en/articles/9053602-the-kit-newsletter-plan) ("Up to 10,000 active, unique subscribers", "Unlimited email sends") |
| Broadcast to a tag or segment via the API | **v4 only.** `POST /v4/broadcasts` takes `subscriber_filter: [{"all":[{"type":"tag","ids":[...]}]}]`. Only segment or tag ids are supported, one filter group type per request. `send_at: null` makes a draft; a timestamp schedules the send. | [Create a broadcast (v4)](https://developers.kit.com/api-reference/broadcasts/create-a-broadcast) |
| Broadcast via v3 | No audience filter at all: v3 broadcasts go to every subscriber (confirmed live: `recipients: 1` = whole list). v3 can create drafts and scheduled broadcasts and delete them. | [v3 broadcasts](https://developers.kit.com/api-reference/v3/broadcasts.md) |
| Send to one subscriber | No such endpoint. The v4 docs only mention targeting by segment or tag. The workaround is a tag that only that person (or today's recipients) has. | [Create a broadcast (v4)](https://developers.kit.com/api-reference/broadcasts/create-a-broadcast) |
| Per-subscriber content | Liquid `{{ subscriber.<field_key> }}` inserts custom fields. Kit's FAQ does **not** explicitly confirm this inside broadcasts or say whether HTML is passed through. **Must be tested** before launch. | [Liquid personalization FAQ](https://help.kit.com/en/articles/2502633-basic-email-personalization-with-liquid-faqs) |
| Automations or sequences triggered by a tag | On the free plan you get **one** basic visual automation and **one** sequence. Entry points are form joined, tag added, custom field changed, or purchase. Actions are add to the sequence, add or remove a tag, set a field, and delay. | [Automations on the Newsletter plan](https://help.kit.com/en/articles/9053626-automations-on-the-newsletter-plan) |
| Does v4 need OAuth? | No, not for your own account. A V4 API key is enough. OAuth is required only for `/v4/bulk/*` and the purchase endpoints. V4 keys are "for individual use", which fits: this is Matt's own account. | [Authentication](https://developers.kit.com/api-reference/authentication.md); [V3 vs V4 keys](https://help.kit.com/en/articles/9888250-difference-between-v3-and-v4-api-keys); [Creating API keys](https://help.kit.com/en/articles/9902901-creating-api-keys) |
| Do v3 keys work on v4? | No. Live result: 401. The docs say "V4 API Keys are not compatible with V3", and V4 keys are made separately in Developer settings. | [Upgrading to v4](https://developers.kit.com/api-reference/upgrading-to-v4.md) |
| Rate limit | API key: 120 requests per 60 seconds. OAuth: 600. | [Authentication](https://developers.kit.com/api-reference/authentication.md) |
| v3 status | The v3 docs page calls v3 deprecated and says no new v3 integration keys can be created. Existing keys still work (live). | [v3 subscribers](https://developers.kit.com/api-reference/v3/subscribers.md); [v3 auth](https://developers.kit.com/api-reference/v3/authentication.md) |

**Why not use the free automation?** There is only one automation and one sequence for the whole account, shared by every tool. A sequence holds fixed emails, which doesn't fit "new violation today" or "hearing in 2 days" alerts that repeat. It is also unclear whether a subscriber who already finished the sequence can re-enter it (I did not verify this). The tag-plus-broadcast approach avoids all of that.

### The Kit design (`EMAIL_BACKEND=kit`)

Each daily run makes **one** broadcast:

1. If an earlier alert broadcast (description starts `[alerts]`) is still draft, scheduled or sending, stop and change nothing.
2. Remove the `alert-due` tag from yesterday's recipients.
3. For each recipient: look up the subscriber by email (skip if missing or not active), write the alert HTML into custom field `alert_body`, then add the `alert-due` tag. The tag and field are created if missing.
4. `POST /v4/broadcasts` with `public: false`, filter = tag `alert-due`, content `{{ subscriber.alert_body }}`, subject `Your NYC alerts for <date>`, and `send_at` = now + 15 minutes. That gives a window to cancel in the Kit UI.

Pros: $0, up to 10k subscribers, Kit handles unsubscribes and the CAN-SPAM footer, no new account.
Cons and risks:
- The field-in-broadcast rendering and the field length limit are untested.
- An unsubscribe from an alert unsubscribes the person from all Kit email.
- A run costs about 3 API calls per recipient. At 120 per minute, 100 recipients take about 3 minutes (the code throttles itself).
- `public` must stay `false`, or the broadcast would publish to the Kit creator profile. The code hard-codes `false`.

## 2. Free alternatives (if Kit's broadcast route fails)

| Provider | Free limits | Custom domain needed? (we only have `lanternlab2027.github.io`) | Sign-up < 5 min? | API host(s) |
|---|---|---|---|---|
| **Gmail SMTP + app password** (not a new account if Matt or the lab already has Gmail) | About 500 emails a day ([Gmail limits](https://support.google.com/mail/answer/22839)) | No. Sends from the Gmail address itself. Needs 2-Step Verification to create an app password ([app passwords](https://support.google.com/accounts/answer/185833)). | Yes, about 1 minute | `smtp.gmail.com:465` |
| **Resend** | 3,000 a month, 100 a day ([pricing](https://www.resend.com/docs/knowledge-base/what-is-resend-pricing.md), [limits](https://resend.com/docs/knowledge-base/resend-sending-limits)) | **Yes in practice.** Without a verified domain, `resend.dev` "can only send emails to the email address associated with your Resend account" ([403 doc](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain.md)). | Yes, but useless without a domain | `api.resend.com` |
| **Brevo** | 300 a day, no time limit ([email API](https://www.brevo.com/en/features/email-api/)) | Not strictly. A Gmail sender gets rewritten to `…@<id>.t-sender-sib.com` for transactional mail, and Brevo warns it may be filtered to spam ([Brevo help](https://help.brevo.com/hc/en-us/articles/14925263522578)). Their API page says to verify a sending domain before generating a key. | About 5 minutes, plus account activation | `api.brevo.com` (SMTP: `smtp-relay.brevo.com`) |
| **Mailjet** | 6,000 a month, 200 a day, 1,000 contacts. Free emails appear to carry the Mailjet logo. ([pricing](https://www.mailjet.com/plans-and-pricing/)) | Not strictly. A single verified sender address works, but Mailjet says free webmail senders "will increasingly lead to both delivery and deliverability issues" ([Mailjet doc](https://documentation.mailjet.com/hc/en-us/articles/19308800104091-Why-you-should-avoid-free-webmail-as-a-sender-address)). | About 5 minutes | `api.mailjet.com` (SMTP: `in-v3.mailjet.com`) |
| **SendGrid** | **No free plan.** Retired starting May 27, 2025 ([Twilio changelog](https://www.twilio.com/en-us/changelog/sendgrid-free-plan)). Trial only. | Yes (domain authentication) | n/a | `api.sendgrid.com` |
| **Amazon SES** | 3,000 message charges a month for the first 12 months; new AWS accounts from July 15, 2025 get credits instead ([SES FAQ](https://aws.amazon.com/ses/faqs/)) | Can verify a single address, but **sandbox accounts can only send to verified identities** until a production-access request is approved ([SES FAQ](https://aws.amazon.com/ses/faqs/)). Needs an AWS account and a card. | No | `email.<region>.amazonaws.com` / `email-smtp.<region>.amazonaws.com` |

**GitHub Actions:** hosted runners have open outbound internet, so all of these work from an Action (HTTPS APIs, or SMTP on 465/587). `sender.py` has one SMTP backend that works with Gmail, Brevo, Mailjet or SES SMTP by changing `SMTP_HOST` and the credentials.

**Allowlisting (this sandbox only, not GitHub):** `api.kit.com`, `api.convertkit.com` and `data.cityofnewyork.us` are reachable now. `api.resend.com`, `api.brevo.com`, `api.mailjet.com`, `api.sendgrid.com`, `email.us-east-1.amazonaws.com` and `smtp.gmail.com` all returned proxy 403 here (tested 2026-11-13). SMTP is not HTTPS, so it may not be possible through this proxy at all. Test SMTP from the Action instead.

**Recommendation:** Kit v4 first, because it needs no new account and handles unsubscribes. Gmail SMTP is the fallback: proven, but it sends from a Gmail address and is capped at about 500 a day. Skip Resend and SES until there is a real domain. Pick a domain-based provider once one exists.

## 3. Daily GitHub Action design

Workflow draft: `bots/notify/notify.yml`, which goes in `.github/workflows/`. It runs daily at 11:41 UTC, with a manual run that has a `send` checkbox.

```
Kit (read, V3 secret) ──> daily.py ──> NYC Open Data (watch.py logic) ──> one email per person ──> sender.py
  building-watch: bbl | building_address          HPD/DOB/ECB/OATH/311 since last run         outbox (default)
  nyc-hearings: hearing_tickets, hearing_lookup   OATH jz4z-kudi by ticket / BBL               smtp | kit (with --send)
```

- **Subscribers:** `kit_source.py` lists active subscribers per tag with `GET /v3/tags/{id}/subscriptions` and returns their `fields`. This is read-only. LL97 and exam signups (`ll97-energy`, `fdny-cof`) have no recurring alert yet. Add them later as another section in `daily.py`.
- **Building Watch:** uses `bbl`, falling back to `building_address`. Calls `watch.resolve/fetch/upcoming/deadlines`, one lookup per building shared by all its subscribers. The first run looks back 7 days. Later runs look back to `last_run − 14` days, but never before the first window. Items are deduped per subscriber.
- **Hearing Watch:** `hearing_tickets` (comma list) and `hearing_lookup` (`ticket:` or `addr:<BBL>`) query OATH. A "week" reminder goes out 3–7 days before the hearing and a "final" reminder 0–2 days before, each once, and only while the status is open (`NEW ISSUANCE`, `RESCHEDULED`, …). A one-time alert goes out if a tracked case becomes `DEFAULTED` or `DOCKETED`. `name:` lookups rely on the tickets saved at signup. `next_hearing` is not updated in Kit yet; that would be a write.
- **One email per address per day:** a person on both lists gets a single combined email. It includes a disclaimer, a "why you got this" line and an unsubscribe line. The SMTP backend also adds a `List-Unsubscribe` header.
- **State:** `notify_state.json` holds only salted SHA-256 hashes (salt = secret `NOTIFY_STATE_SALT`). It has no emails, BBLs or ticket numbers, so it is safe to commit even in a public repo (tested). It is saved only after a real send succeeds, so dry runs never change it and a failed send is retried the next day.
- **Privacy:** dry runs in the Action delete `outbox/` and never upload it, because it contains subscriber emails.
- **Secrets and variables:**
  - Always: `KIT_API_SECRET`, `NOTIFY_STATE_SALT`, optional `SOCRATA_APP_TOKEN`.
  - Variable `EMAIL_BACKEND` = `kit` or `smtp`, and variable `EMAIL_SEND` = `true` to turn on scheduled sending.
  - Kit backend: `KIT_V4_API_KEY`.
  - SMTP backend: variables `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM`; secrets `SMTP_USER`, `SMTP_PASSWORD`.

### Files

| File | What |
|---|---|
| `bots/notify/sender.py` | `Message`, `get_sender(send)`. Backends: `outbox` (default), `smtp`, `kit` |
| `bots/notify/kit_source.py` | Read-only Kit subscriber reader (v3 secret) |
| `bots/notify/daily.py` | The daily driver described above |
| `bots/notify/notify.yml` | Draft workflow |
| `bots/notify/fixture_subscribers.json` | Fake `example.com` subscribers with real BBLs and real upcoming summons numbers |
| `bots/buildingwatch/watch.py` | `send_email()` now uses `sender.py`. New `--send` flag; still a dry run by default |

**Safety gate:** a real send needs **both** `--send` **and** `EMAIL_BACKEND` set to `smtp` or `kit`. Any other combination writes to the outbox.

### Tests run (2026-11-13)

- `daily.py --fixture fixture_subscribers.json` dry run against live NYC Open Data. It wrote 4 emails to the outbox in about 32 seconds:
  - owner-a: 23 items for 289 Garfield Pl
  - owner-b: 2 items
  - shared@ (on both tags): 12 items, combined building and hearing email, including two "hearing in 6 days" reminders
  - biz@: 4 "hearing in 3 days" reminders found by `addr:` BBL and ticket number
  - The subscriber with no building was correctly skipped. No state was written.
- `daily.py` against live Kit (read-only): 0 tagged subscribers, 0 emails, no errors.
- Two consecutive runs with state: the first sent 4, the second sent 0. This caught and fixed an overlap bug where the second run looked back further than the first. The state file contains no emails, BBLs or tickets.
- Kit backend with a mocked API:
  - call order is: clear the old tag, create the field, write the field, then tag
  - the broadcast has `public: false`, the tag filter, the `{{ subscriber.alert_body }}` body and a future `send_at`
  - a missing subscriber is skipped
  - it refuses to touch anything while an earlier alert broadcast is still scheduled
- SMTP backend with a mocked server: multipart text and HTML with `List-Unsubscribe`.
- `watch.py --email test@example.com` still writes to the outbox by default.

The test harness lives in the session scratchpad (`test_notify.py`), not in the repo.

## 4. Go-live steps

**Kit route:**
1. In Kit, go to Settings > Developer > V4 keys > Add a new key, and copy it.
2. In the GitHub repo, go to Settings > Secrets and variables > Actions:
   - secrets `KIT_V4_API_KEY`, `KIT_API_SECRET`, `NOTIFY_STATE_SALT` (any random 40+ characters)
   - variable `EMAIL_BACKEND=kit`
3. Copy `bots/notify/notify.yml` to `.github/workflows/notify.yml`.
4. Tag Matt's test subscriber `building-watch` with `bbl=1020250013`. Run the workflow manually with `send` checked. Confirm the email arrives and the HTML renders, then delete the `[alerts]` broadcast if wanted.
5. Set variable `EMAIL_SEND=true` to turn on the daily schedule.

**If step 4 shows raw HTML or a cut-off body:** set `EMAIL_BACKEND=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `EMAIL_FROM=Lantern Lab Alerts <the gmail address>`, and secrets `SMTP_USER` (the Gmail address) and `SMTP_PASSWORD` (an app password from myaccount.google.com/apppasswords). Then repeat step 4.

## Open items

- Test Kit custom-field HTML rendering and the field length limit (launch step 4).
- Hearing Watch's page promises "a week before and 2 days before"; `daily.py` sends at 3–7 days and 0–2 days. Adjust the copy or the windows if they should match exactly.
- Kit trial: once it ends (about Nov 23, inferred), the account is on the free plan. Everything above uses only free-plan features (API, tags, broadcasts).
- Add LL97 and exam follow-ups to `daily.py` once those tools have something recurring to send.
