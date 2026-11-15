# Snow Day Odds email alerts

The sender behind the "free email when odds look high" box on `docs/snow/`. It reads signups from Kit tag
`snow-day` (id 25923836, custom field `snow_zip`), computes each ZIP's odds the way the page does, and emails a
ZIP's subscribers when the chance is 50% or higher. Each ZIP gets at most one email per school morning.

Standard library only (Python 3.11+). It reuses `bots/notify/sender.py` (backends) and `bots/notify/kit_source.py` (v3 reads).

## Run it daily at about 8:30pm ET

The lab's scheduled sprint should run this every evening, about 8:30pm America/New_York, from about Nov 15 to Mar 31.
It needs the same secrets as bots/notify, set as env vars from outside the repo (never put them in files here):
`KIT_API_SECRET` (v3, read subscribers), `KIT_V4_API_KEY` (v4, tag and broadcast), `NOTIFY_STATE_SALT`.

**Real send (the exact command):**

```sh
cd /home/claude/lab/bots/snow_alerts && EMAIL_BACKEND=kit python3 snow.py --send --state snow_state.json
```

**Dry run (default; reads Kit, calls NWS, writes `outbox/`, sends nothing, saves no state):**

```sh
cd /home/claude/lab/bots/snow_alerts && python3 snow.py --state snow_state.json
```

Schedules: cron `CRON_TZ=America/New_York 27 20 * * *` (8:27pm, off the hour), or in GitHub Actions
(UTC only) `cron: "31 1 * * *"`, which is 8:31pm EST. That lands at 9:31pm after the March DST change.
Kit sends the broadcast `KIT_SEND_DELAY_MIN` (default 15) minutes after the run, so about 8:45pm.
Like notify.yml, commit `snow_state.json` after a real send. It holds only salted hashes.

Exit code 0 means OK. It is 1 when NWS failed 5 times in a row and the remaining ZIPs were skipped.
State isn't marked for skipped ZIPs, so re-running later that evening is safe.

## What a run does

1. Lists active subscribers on the tag (v3 `GET /tags/25923836/subscriptions`, `api_secret`). Groups them by
   `snow_zip`, which accepts `12345` or `12345-6789`. Bad or missing ZIPs are counted and skipped, and duplicate
   emails in a ZIP are dropped.
2. Goes through ZIPs biggest group first, with a **budget of `--max-zips 300`**. The rest are listed as skipped.
   Lat/lon comes from `docs/snow/z/NN.json`, the app's own shards.
3. NWS (`api.weather.gov`) with `User-Agent: LanternLab-SnowDayOdds/1.0 (https://lanternlab2027.github.io/lab/snow/)`,
   **at most 1 request per second**, with retries after 5 s on 429/5xx:
   - `/points/{lat},{lon}` (4 decimals, like nws.js), **cached per ZIP** in `gridpoint_cache.json` for 30 days.
     A ZIP that NWS returns 404 for is cached as "outside coverage".
   - `forecastGridData`. In a run, ZIPs that share a grid cell share one fetch.
   - `/alerts/active?point=`. A failure here counts as no alerts, same as the page.
   ZIPs already alerted for that date are skipped before any grid call.
4. Odds come from `snow_model.py`, a line-for-line port of `docs/snow/model.js` with the same window, extract,
   points table, rounding and reasons. Region is the app's default: latitude under 36.5 counts as "rarely sees
   snow". The email link carries `r=` so the page shows the same number.
5. Weekend mornings are skipped (Fri/Sat night runs) unless you pass `--include-weekends`. Holidays are not handled.
6. At `--threshold 50` or above, it builds **one email per ZIP group** with the town (NWS `relativeLocation`),
   the %, the label, the top 3 reasons, the "Just for fun. Only your school district decides; check their official
   announcements." disclaimer, and a link to
   `https://lanternlab2027.github.io/lab/snow/?zip=NNNNN&r=used|rare&ref=email-snow`. Each email has plain text
   plus simple inline-styled HTML. All of it is ASCII; the degree sign is `&deg;` in HTML and dropped in text.

## How sending is scoped in Kit (`EMAIL_BACKEND=kit`)

This is notify's mechanism (`KitBroadcastSender`), subclassed as `SnowKitSender` with its own names so the two
bots never touch each other's recipients:

| | notify | snow_alerts |
|---|---|---|
| temporary tag | `alert-due` | `snow-alert-due` (env `SNOW_ALERT_TAG`) |
| per-subscriber body field | `alert_body` | `snow_alert_body` (env `SNOW_ALERT_FIELD`) |
| broadcast description marker | `[alerts]` | `[snow-alerts]` |

Per run:
1. If an earlier `[snow-alerts]` broadcast is still draft, scheduled or sending, it stops and changes nothing.
2. It **removes `snow-alert-due` from last run's recipients**. That is the "remove it afterwards" step.
   It can't happen right after scheduling, because Kit resolves the tag filter at send time. So, like notify's
   `alert-due`, it happens at the start of the next run. To clear it sooner, once the broadcast shows completed:
   `EMAIL_BACKEND=kit python3 snow.py --send --clear-tag`.
3. For each recipient, it looks them up by email (skipped if not active), writes their ZIP group's HTML into
   `snow_alert_body`, and adds `snow-alert-due`.
4. It sends one broadcast: `public: false`, `subscriber_filter` = tag `snow-alert-due`, content
   `{{ subscriber.snow_alert_body }}`, `send_at` = now + 15 min. That gives time to cancel in Kit.

So each person gets their own ZIP's email. The Kit **subject is shared** by the whole broadcast
("Snow day odds look high for Wednesday, Dec 2"). The per-ZIP subject ("Snow day odds for Buffalo, NY: 92% ...")
is used by the outbox and `EMAIL_BACKEND=smtp`. Kit stores one `snow_zip` per subscriber, so a person is in only one group.

Before the first real send, check notify's open item: Kit rendering HTML from a custom field inside a broadcast has
not been tested. Send first to a test subscriber who is the only one tagged `snow-day`. If it fails,
`EMAIL_BACKEND=smtp` works with the same command (see `bots/EMAIL_SENDING.md`).

## Files

| File | What |
|---|---|
| `snow.py` | The driver (Kit read, grouping, NWS client, budget, render, `SnowKitSender`, outbox). |
| `snow_model.py` | Python port of `docs/snow/model.js`. **Change both together**; the parity test catches drift. |
| `fixture_subscribers.json` | Fake `example.com` signups for `--fixture` runs. |
| `snow_state.json` | Created by the first real send. Holds `sha256(salt|zip|date)` only, pruned after 60 days. Safe to commit. |
| `gridpoint_cache.json` | `/points` cache keyed by ZIP. It shows which ZIPs have subscribers, so it is **git-ignored. Don't commit it.** |
| `outbox/` | Dry-run output: one `snow_<zip>.txt/.html` per group plus `index.json`. It has recipient counts only, no addresses. Git-ignored. |
| `tests/` | `test_parity.py` (node vs Python on shared fixtures), `test_snow.py` (grouping, dedupe, budget, rate limit, render, Kit calls, dry run with mocked NWS), `fakes.py`, `parity_cases.js`. |

## Tests

```sh
cd /home/claude/lab && python3 -m unittest discover -s bots/snow_alerts/tests -v
```

The tests make no network calls. NWS is mocked, and `api.weather.gov` is blocked from the build container
anyway (see `bots/snow/NOTES.md`). The parity test runs `node tests/parity_cases.js`. That covers the scenarios in
`bots/snow/fixtures.js` plus 400 seeded random grids: mixed units, null values, `start/end` and `P1DT6H` intervals,
cancelled, test, ended and late alerts, 9 time zones and DST nights. It checks that the window, inputs, odds,
parts, reasons and label are identical. It is skipped only if node is missing.

## Not verified

- A live NWS run. The shell here gets an HTTP 403 from the proxy, so the CLI run against the fixture fails cleanly
  with "network error" for every ZIP. Run once from the sprint machine with `--fixture fixture_subscribers.json`
  (a dry run) to see real numbers before turning on `--send`.
- A Kit send (see above).
