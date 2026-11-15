#!/usr/bin/env python3
"""Snow Day Odds email alerts: "free email when odds look high".

1. Lists ACTIVE subscribers on Kit tag snow-day (id 25923836) with the v3 API (KIT_API_SECRET, read-only),
   or reads --fixture. Groups them by custom field snow_zip.
2. Per ZIP (biggest groups first, at most --max-zips): lat/lon from docs/snow/z/NN.json, then NWS
   /points (cached per ZIP), forecastGridData and /alerts/active, at most 1 request per second.
3. Computes the odds with snow_model.py, a line-for-line port of docs/snow/model.js (parity-tested).
   Region defaults like the app: latitude under 36.5 = "rarely sees snow".
4. If odds >= --threshold (50) and the ZIP hasn't been alerted for that school morning, composes ONE
   email for the ZIP group and hands it to bots/notify/sender.py. DRY RUN unless --send AND
   EMAIL_BACKEND=kit|smtp. The kit backend mirrors notify: temporary tag snow-alert-due, per-subscriber
   field snow_alert_body, one private broadcast to that tag (see README.md).

State (default snow_state.json) holds only salted SHA-256 hashes of "zip|date" (salt NOTIFY_STATE_SALT,
required with --send) and is saved only after a real send. Dry runs never change it.

  python3 snow.py --fixture fixture_subscribers.json        # no Kit; NWS live; writes outbox/
  python3 snow.py                                           # read Kit, dry run
  EMAIL_BACKEND=kit python3 snow.py --send                  # real send
"""
import argparse, datetime as dt, hashlib, html, json, os, re, sys, time
import urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "notify"))
import snow_model as M                                         # noqa: E402
import sender as notify_sender                                 # noqa: E402  (bots/notify/sender.py)

TAG_NAME, TAG_ID, ZIP_FIELD = "snow-day", 25923836, "snow_zip"
APP = "https://lanternlab2027.github.io/lab/snow/"
REF = "email-snow"
SHARDS = os.path.join(HERE, "..", "..", "docs", "snow", "z")
NWS = "https://api.weather.gov"
USER_AGENT = "LanternLab-SnowDayOdds/1.0 (https://lanternlab2027.github.io/lab/snow/)"
DISCLAIMER = "Just for fun. Only your school district decides; check their official announcements."
POINTS_TTL_DAYS = 30          # NWS: re-check /points now and then, grid mapping can change
DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def log(*a):
    print(*a, file=sys.stderr)


# ------------------------------------------------------------------ state (hashed, like notify)

class State:
    """{"v":1, "sent": {sha256(salt|zip|date)[:20]: date}}. No ZIPs or emails are stored."""

    def __init__(self, path, salt):
        self.path, self.salt = path, salt
        try:
            with open(path) as f:
                self.d = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            self.d = {"v": 1, "sent": {}}
        self.d.setdefault("sent", {})

    def h(self, *parts):
        return hashlib.sha256((self.salt + "|" + "|".join(map(str, parts))).encode()).hexdigest()[:20]

    def alerted(self, zip5, date):
        return self.h("snow", zip5, date) in self.d["sent"]

    def mark(self, zip5, date):
        self.d["sent"][self.h("snow", zip5, date)] = date

    def save(self, today):
        cutoff = (today - dt.timedelta(days=60)).isoformat()
        self.d["sent"] = {k: v for k, v in self.d["sent"].items() if v >= cutoff}
        tmp = self.path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(self.d, f, indent=0, sort_keys=True)
        os.replace(tmp, self.path)


# ------------------------------------------------------------------ subscribers

def norm_zip(z):
    m = re.match(r"^\s*(\d{5})(?:-\d{4})?\s*$", str(z or ""))
    return m.group(1) if m else None


def kit_subscribers(secret=None):
    """Active subscribers on the snow-day tag (v3 api_secret; read-only). Reuses notify's kit_source."""
    import kit_source
    secret = secret or os.environ.get("KIT_API_SECRET")
    if not secret:
        raise SystemExit("KIT_API_SECRET is not set (or use --fixture)")
    page = 1
    while True:
        d = kit_source._get(f"/tags/{TAG_ID}/subscriptions",
                            {"api_secret": secret, "subscriber_state": "active", "page": page})
        for s in d.get("subscriptions", []):
            sub = s.get("subscriber") or {}
            if sub.get("state", "active") != "active":
                continue
            yield {"id": sub["id"], "email": sub["email_address"], "fields": sub.get("fields") or {}}
        if page >= d.get("total_pages", 1):
            return
        page += 1


def group_by_zip(subs):
    """{zip5: [subscriber,...]} with one entry per email address; bad or missing ZIPs are dropped."""
    groups, seen, bad = {}, set(), 0
    for s in subs:
        z = norm_zip((s.get("fields") or {}).get(ZIP_FIELD))
        email = (s.get("email") or "").strip()
        if not z or not email:
            bad += 1
            continue
        key = (z, email.lower())
        if key in seen:
            continue
        seen.add(key)
        groups.setdefault(z, []).append(s)
    return groups, bad


def ordered_zips(groups):
    """Biggest groups first, then ZIP order, so the budget covers the most people."""
    return sorted(groups, key=lambda z: (-len(groups[z]), z))


# ------------------------------------------------------------------ ZIP -> lat/lon

class ZipLookup:
    def __init__(self, shard_dir=SHARDS):
        self.dir, self.cache = shard_dir, {}

    def __call__(self, zip5):
        k = zip5[:2]
        if k not in self.cache:
            try:
                with open(os.path.join(self.dir, k + ".json")) as f:
                    self.cache[k] = json.load(f)
            except FileNotFoundError:
                self.cache[k] = {}
        c = self.cache[k].get(zip5[2:])
        return (c[0], c[1]) if c else None


# ------------------------------------------------------------------ NWS client

class HttpError(Exception):
    def __init__(self, status, url, why=""):
        super().__init__(f"HTTP {status} for {url}" if status else f"network error ({why or 'no response'}) for {url}")
        self.status = status


class Http:
    """GET JSON with the NWS User-Agent, at most 1 request per `interval` seconds, retries on 429/5xx."""

    def __init__(self, interval=1.0, retries=2, timeout=30, sleep=time.sleep, clock=time.monotonic):
        self.interval, self.retries, self.timeout = interval, retries, timeout
        self.sleep, self.clock, self.last, self.calls = sleep, clock, None, 0

    def _wait(self):
        if self.last is not None:
            gap = self.interval - (self.clock() - self.last)
            if gap > 0:
                self.sleep(gap)
        self.last = self.clock()

    def get_json(self, url):
        for attempt in range(self.retries + 1):
            self._wait()
            self.calls += 1
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/geo+json"})
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    return json.load(r)
            except urllib.error.HTTPError as e:
                if (e.code == 429 or e.code >= 500) and attempt < self.retries:
                    self.sleep(5 * (attempt + 1))        # NWS docs: retry after ~5 s
                    continue
                raise HttpError(e.code, url) from None
            except (urllib.error.URLError, TimeoutError) as e:
                if attempt < self.retries:
                    self.sleep(5 * (attempt + 1))
                    continue
                raise HttpError(0, url, str(getattr(e, "reason", e))[:80]) from e
        raise HttpError(0, url)


def fix4(x):
    """Same as nws.js: /points redirects for more than 4 decimals."""
    return M.js_num_str(M.js_round(x * 1e4) / 1e4)


class Nws:
    def __init__(self, http, cache_path=None, today=None):
        self.http, self.cache_path = http, cache_path
        self.today = today or dt.date.today()
        self.grids, self.alerts = {}, {}            # per run: shared grid cells / points
        try:
            with open(cache_path) as f:
                self.points = json.load(f)
        except (TypeError, FileNotFoundError, json.JSONDecodeError):
            self.points = {}

    def save_cache(self):
        if not self.cache_path:
            return
        tmp = self.cache_path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(self.points, f, indent=0, sort_keys=True)
        os.replace(tmp, self.cache_path)

    def point(self, zip5, lat, lon):
        """Cached /points summary for a ZIP: grid URL, time zone, nearest town. None = outside NWS."""
        c = self.points.get(zip5)
        fresh = c and c.get("fetched", "") >= (self.today - dt.timedelta(days=POINTS_TTL_DAYS)).isoformat()
        if fresh and c.get("pt") == fix4(lat) + "," + fix4(lon):
            return c if c.get("grid") else None
        pt = fix4(lat) + "," + fix4(lon)
        try:
            P = self.http.get_json(f"{NWS}/points/{pt}").get("properties") or {}
        except HttpError as e:
            if e.status == 404:
                self.points[zip5] = {"pt": pt, "grid": None, "fetched": self.today.isoformat()}
                return None
            raise
        rel = (P.get("relativeLocation") or {}).get("properties") or {}
        c = {"pt": pt, "grid": P.get("forecastGridData"), "tz": P.get("timeZone") or "America/New_York",
             "town": f"{rel['city']}, {rel['state']}" if rel.get("city") else "",
             "fetched": self.today.isoformat()}
        self.points[zip5] = c
        return c if c["grid"] else None

    def grid(self, url):
        if url not in self.grids:
            self.grids[url] = self.http.get_json(url)
        return self.grids[url]

    def active_alerts(self, pt):
        if pt not in self.alerts:
            try:
                self.alerts[pt] = self.http.get_json(f"{NWS}/alerts/active?point={pt}")
            except HttpError:
                self.alerts[pt] = {"features": [], "failed": True}     # same fallback as nws.js
        return self.alerts[pt]


# ------------------------------------------------------------------ email

def ascii_text(s):
    return s.replace("\u00b0", "").replace("\u2019", "'").encode("ascii", "replace").decode()


def ascii_html(s):
    return html.escape(s).replace("\u00b0", "&deg;").replace("\u2019", "&rsquo;").encode("ascii", "xmlcharrefreplace").decode()


def app_link(zip5, region):
    return APP + "?" + urllib.parse.urlencode({"zip": zip5, "r": region, "ref": REF})


def day_text(win):
    d = win["date"]
    return f"{DOW[d['dow']]}, {MON[d['mo'] - 1]} {d['d']}"


def render(zip5, town, win, res, n_reasons=3):
    place = town or f"ZIP {zip5}"
    day = day_text(win)
    link = app_link(zip5, res["region"])
    reasons = res["reasons"][:n_reasons]
    subject = ascii_text(f"Snow day odds for {place}: {res['chance']}% for {day}")
    head = f"{res['chance']}% chance of a snow day {day} - {res['label']}"
    foot = (f"You get this because you asked for an email when snow day odds look high for ZIP {zip5} "
            f"at {APP}. Forecast data: National Weather Service. To stop, use the unsubscribe link below.")
    t = [f"Snow Day Odds for {place} (ZIP {zip5})", "", head, "", "Why:"]
    t += [f"- {r}" for r in reasons]
    t += ["", DISCLAIMER, "", f"See the details: {link}", "", "--", foot]
    h = [f"<p style=\"margin:0 0 4px;font-size:14px;color:#555\">Snow Day Odds for {ascii_html(place)} (ZIP {zip5})</p>",
         f"<h2 style=\"margin:0 0 12px;font-size:24px\">{res['chance']}% chance of a snow day {ascii_html(day)}</h2>",
         f"<p style=\"margin:0 0 8px\"><b>{ascii_html(res['label'])}.</b> Why:</p>",
         "<ul style=\"margin:0 0 12px;padding-left:20px\">" + "".join(f"<li>{ascii_html(r)}</li>" for r in reasons) + "</ul>",
         f"<p style=\"margin:0 0 12px;padding:8px 10px;background:#fff4d6;border-radius:8px\"><b>{ascii_html(DISCLAIMER)}</b></p>",
         f"<p style=\"margin:0 0 16px\"><a href=\"{html.escape(link)}\">See the details for {ascii_html(place)}</a></p>",
         f"<hr><p style=\"font-size:12px;color:#666\">{ascii_html(foot)}</p>"]
    return subject, ascii_text("\n".join(t)), "\n".join(h)


# ------------------------------------------------------------------ Kit backend (mirrors notify)

SNOW_PREFIX = "[snow-alerts]"


class SnowKitSender(notify_sender.KitBroadcastSender):
    """notify's tag + field + private broadcast, with its own tag, field, subject and marker.

    Same steps as KitBroadcastSender.flush: refuse if an earlier [snow-alerts] broadcast is still
    draft/scheduled/sending; clear tag snow-alert-due from last run's recipients; per recipient write
    the ZIP group's HTML into field snow_alert_body and add the tag; then one broadcast, public=false,
    filter = that tag, body {{ subscriber.snow_alert_body }}, send_at = now + KIT_SEND_DELAY_MIN.
    """

    def __init__(self, subject):
        super().__init__()
        self.tag_name = os.environ.get("SNOW_ALERT_TAG") or "snow-alert-due"
        self.field = os.environ.get("SNOW_ALERT_FIELD") or "snow_alert_body"
        self.subject = subject

    def _pending_alert_broadcasts(self):
        busy = []
        for b in self.api.paged("/broadcasts", "broadcasts"):
            if not (b.get("description") or "").startswith(SNOW_PREFIX):
                continue
            st = self.api.call("GET", f"/broadcasts/{b['id']}/stats").get("broadcast", {}).get("stats", {})
            if st.get("status") not in ("completed", None):
                busy.append((b["id"], st.get("status")))
        return busy

    def clear_tag(self):
        """Remove snow-alert-due from everyone (after the broadcast completed). Next run does it anyway."""
        busy = self._pending_alert_broadcasts()
        if busy:
            raise RuntimeError(f"kit: snow broadcast(s) not finished {busy}; leaving the tag in place")
        tag_id = self._tag_id()
        old = list(self.api.paged(f"/tags/{tag_id}/subscribers", "subscribers", {"status": "all"}))
        for s in old:
            self.api.call("DELETE", f"/tags/{tag_id}/subscribers/{s['id']}")
        log(f"kit: cleared tag '{self.tag_name}' from {len(old)} subscriber(s)")
        return len(old)

    def flush(self):
        if not self.msgs:
            log("kit: nothing to send")
            return {"sent": 0}
        busy = self._pending_alert_broadcasts()
        if busy:
            raise RuntimeError(f"kit: earlier snow broadcast(s) not finished {busy}; not touching tags today")
        tag_id = self._tag_id()
        self._ensure_field()
        old = list(self.api.paged(f"/tags/{tag_id}/subscribers", "subscribers", {"status": "all"}))
        for s in old:
            self.api.call("DELETE", f"/tags/{tag_id}/subscribers/{s['id']}")
        log(f"kit: cleared tag '{self.tag_name}' from {len(old)} earlier recipient(s)")
        tagged, skipped = 0, 0
        for m in self.msgs:
            found = self.api.call("GET", "/subscribers", params={"email_address": m.to, "status": "all"}).get("subscribers", [])
            if not found or found[0].get("state") != "active":
                skipped += 1
                continue
            sid = found[0]["id"]
            self.api.call("PUT", f"/subscribers/{sid}", {"email_address": found[0]["email_address"],
                                                         "fields": {self.field: m.html or m.text}})
            self.api.call("POST", f"/tags/{tag_id}/subscribers/{sid}", {})
            tagged += 1
        if skipped:
            log(f"kit: skipped {skipped} recipient(s) not found or not active")
        if not tagged:
            return {"sent": 0, "skipped": skipped}
        send_at = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=self.delay)).strftime("%Y-%m-%dT%H:%M:%SZ")
        b = self.api.call("POST", "/broadcasts", {
            "subject": self.subject,
            "description": f"{SNOW_PREFIX} {dt.date.today().isoformat()} ({tagged} recipients)",
            "content": "{{ subscriber.%s }}" % self.field,
            "public": False,
            "send_at": send_at,
            "subscriber_filter": [{"all": [{"type": "tag", "ids": [tag_id]}]}],
        })
        log(f"kit: broadcast {b.get('broadcast', {}).get('id')} scheduled {send_at} to {tagged} subscriber(s)")
        return {"sent": tagged, "skipped": skipped}


class GroupOutbox:
    """Dry run: one .txt/.html per ZIP group plus index.json. Recipient COUNTS only, never addresses."""
    name = "outbox"

    def __init__(self, outbox, reason):
        self.outbox, self.reason, self.groups = outbox, reason, []

    def add_group(self, zip5, subject, text, body, recipients, meta):
        self.groups.append((zip5, subject, text, body, len(recipients), meta))

    def flush(self):
        os.makedirs(self.outbox, exist_ok=True)
        for f in os.listdir(self.outbox):
            if f.startswith("snow_") or f == "index.json":
                os.remove(os.path.join(self.outbox, f))
        index = []
        for zip5, subject, text, body, n, meta in self.groups:
            base = os.path.join(self.outbox, f"snow_{zip5}")
            with open(base + ".txt", "w") as f:
                f.write(f"To: {n} subscriber(s) in ZIP {zip5}\nSubject: {subject}\n\n{text}\n")
            with open(base + ".html", "w") as f:
                f.write(body + "\n")
            index.append(dict(meta, zip=zip5, subject=subject, recipients=n, file=base))
        with open(os.path.join(self.outbox, "index.json"), "w") as f:
            json.dump({"mode": "dry-run", "reason": self.reason, "count": len(index), "emails": index}, f, indent=1)
        log(f"DRY RUN ({self.reason}): {len(index)} ZIP email(s) written to {self.outbox}/, nothing sent")
        return {"sent": 0, "written": len(index)}


class GroupSender:
    """Real send: the ZIP group's email goes to each address in the group through notify's backend."""

    def __init__(self, backend):
        self.backend, self.name = backend, backend.name

    def add_group(self, zip5, subject, text, body, recipients, meta):
        for s in recipients:
            self.backend.add(notify_sender.Message(to=s["email"], subject=subject, text=text, html=body,
                                                   tag=TAG_NAME, meta=dict(meta, zip=zip5)))

    def flush(self):
        return self.backend.flush()


def get_sender(send, outbox, subject):
    backend = (os.environ.get("EMAIL_BACKEND") or "outbox").lower()
    if not send:
        return GroupOutbox(outbox, "no --send flag")
    if backend == "kit":
        return GroupSender(SnowKitSender(subject))
    if backend == "smtp":
        return GroupSender(notify_sender.SmtpSender())
    return GroupOutbox(outbox, f"--send given but EMAIL_BACKEND={backend!r}")


# ------------------------------------------------------------------ main loop

BREAKER = 5   # consecutive NWS failures before the run gives up on the remaining ZIPs


def evaluate(groups, nws, zips, state, now_ms, threshold, max_zips, include_weekends):
    """Returns (due, report, nws_down). due = [(zip, town, win, res)] at or over threshold, not yet alerted."""
    due, report, checked, fails = [], [], 0, 0
    order = ordered_zips(groups)
    for z in order:
        if fails >= BREAKER:
            report.append((z, f"skipped: NWS failed {BREAKER} times in a row"))
            continue
        if checked >= max_zips:
            report.append((z, "skipped: over the --max-zips budget"))
            continue
        ll = zips(z)
        if not ll:
            report.append((z, "skipped: ZIP not in docs/snow/z"))
            continue
        checked += 1
        try:
            p = nws.point(z, *ll)
            if not p:
                report.append((z, "skipped: outside NWS coverage"))
                continue
            win = M.target_window(now_ms, p["tz"])
            if not include_weekends and win["date"]["dow"] in (0, 6):
                report.append((z, f"skipped: {win['isoDate']} is a weekend"))
                continue
            if state.alerted(z, win["isoDate"]):
                report.append((z, f"skipped: already alerted for {win['isoDate']}"))
                continue
            grid = nws.grid(p["grid"])
            alerts = nws.active_alerts(p["pt"])
            res = M.odds(M.extract(grid, alerts, win), M.default_region(ll[0]))
        except Exception as ex:                    # one bad ZIP must not stop the others
            report.append((z, f"error: {ex}"))
            fails += 1
            continue
        fails = 0
        hit = res["chance"] >= threshold
        report.append((z, f"{p['town'] or '?'} {win['isoDate']}: {res['chance']}% ({res['label']})"
                          + (" -> ALERT" if hit else "")))
        if hit:
            due.append((z, p["town"], win, res))
    return due, report, fails >= BREAKER


def main(argv=None, http=None, subscribers=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fixture", help="JSON {\"snow-day\": [{id, email, fields:{snow_zip}}]} instead of reading Kit")
    ap.add_argument("--state", default="snow_state.json")
    ap.add_argument("--cache", default="gridpoint_cache.json", help="per-ZIP NWS /points cache (not committed)")
    ap.add_argument("--no-save", action="store_true")
    ap.add_argument("--send", action="store_true", help="really send (also needs EMAIL_BACKEND=kit|smtp)")
    ap.add_argument("--outbox", default="outbox")
    ap.add_argument("--threshold", type=int, default=50)
    ap.add_argument("--max-zips", type=int, default=300)
    ap.add_argument("--include-weekends", action="store_true", help="also alert for Saturday/Sunday mornings")
    ap.add_argument("--now", help="ISO time to predict from (testing), default: the real clock")
    ap.add_argument("--clear-tag", action="store_true", help="only remove snow-alert-due in Kit (needs --send, kit)")
    a = ap.parse_args(argv)

    if a.clear_tag:
        if not a.send or (os.environ.get("EMAIL_BACKEND") or "").lower() != "kit":
            raise SystemExit("--clear-tag changes Kit: it needs --send and EMAIL_BACKEND=kit")
        SnowKitSender("").clear_tag()
        return 0

    salt = os.environ.get("NOTIFY_STATE_SALT")
    if not salt:
        if a.send:
            raise SystemExit("NOTIFY_STATE_SALT is required with --send")
        salt = "dry-run-salt"
    now_ms = M.parse_ms(a.now) if a.now else int(time.time() * 1000)
    if now_ms is None:
        raise SystemExit("--now must be an ISO 8601 time with offset, e.g. 2026-12-02T01:30:00Z")
    today = dt.datetime.fromtimestamp(now_ms / 1000, dt.timezone.utc).date()
    state = State(a.state, salt)

    if subscribers is None:
        if a.fixture:
            with open(a.fixture) as f:
                subscribers = json.load(f).get(TAG_NAME, [])
        else:
            subscribers = list(kit_subscribers())
    groups, bad = group_by_zip(subscribers)
    log(f"subscribers: {len(subscribers)} on '{TAG_NAME}', {len(groups)} ZIP(s), {bad} without a valid ZIP")

    nws = Nws(http or Http(), a.cache, today)
    due, report, nws_down = evaluate(groups, nws, ZipLookup(), state, now_ms, a.threshold, a.max_zips, a.include_weekends)
    nws.save_cache()
    for z, line in report:
        print(f"ZIP {z} ({len(groups[z])} sub): {line}")
    log(f"nws: {nws.http.calls} request(s)")

    dates = sorted({w["isoDate"] for _, _, w, _ in due})
    subject = "Snow day odds look high for " + (day_text(due[0][2]) if len(dates) == 1 else "tomorrow")
    out = get_sender(a.send, a.outbox, subject)
    for z, town, win, res in due:
        subj, text, body = render(z, town, win, res)
        out.add_group(z, subj, text, body, groups[z], {"date": win["isoDate"], "chance": res["chance"]})
    result = out.flush()

    if out.name == "outbox":
        log("dry run: state not saved (nothing was sent)")
    elif not a.no_save:
        for z, _, win, _ in due:              # only after flush succeeded; a failed send retries next run
            state.mark(z, win["isoDate"])
        state.save(today)
    log(f"{len(due)} ZIP email(s) via {out.name}: {result}")
    if nws_down:
        log(f"!! NWS unreachable ({BREAKER} failures in a row); remaining ZIPs were not checked")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
