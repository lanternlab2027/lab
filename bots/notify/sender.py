"""Email sending for the Venture Lab watchers. Standard library only.

Dry run by default: every message is written to an outbox folder and nothing is sent.
A real send needs BOTH an explicit opt-in (send=True, i.e. `--send` on the CLI) AND
EMAIL_BACKEND set to "smtp" or "kit". Anything else falls back to the outbox.

Backends
  outbox  (default) writes <outbox>/<n>_<to>.txt/.html plus index.json. Never sends.
  smtp    any SMTP relay (Gmail app password, Brevo, Mailjet, SES...).
          env: SMTP_HOST, SMTP_PORT (465=SSL, else STARTTLS), SMTP_USER, SMTP_PASSWORD,
               EMAIL_FROM ("Name <addr>"), optional EMAIL_REPLY_TO, SMTP_MAX_PER_RUN.
  kit     Kit (ConvertKit) v4 API: stores each subscriber's alert HTML in a custom field,
          tags them, and schedules ONE broadcast to that tag whose body is
          {{ subscriber.alert_body }}. Recipients must already be Kit subscribers.
          env: KIT_V4_API_KEY (Kit > Settings > Developer > V4 keys), optional
               KIT_ALERT_TAG (default "alert-due"), KIT_ALERT_FIELD (default "alert_body"),
               KIT_SEND_DELAY_MIN (default 15).

Usage
  s = get_sender(send=args.send)
  s.add(Message(to=..., subject=..., text=..., html=...))
  s.flush()          # outbox/smtp write or send each message; kit makes one broadcast
"""
import datetime as dt, json, os, re, smtplib, ssl, sys, time
import urllib.error, urllib.parse, urllib.request
from dataclasses import dataclass, field, asdict
from email.message import EmailMessage
from email.utils import formataddr, make_msgid, parseaddr


@dataclass
class Message:
    to: str
    subject: str
    text: str
    html: str = ""
    tag: str = ""                       # which tool produced it, e.g. "building-watch"
    meta: dict = field(default_factory=dict)


def log(*a):
    print("[sender]", *a, file=sys.stderr)


def _slug(s, n=60):
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")[:n]


# ------------------------------------------------------------------ outbox (dry run)

class OutboxSender:
    name = "outbox"

    def __init__(self, outbox="outbox", reason="dry run"):
        self.outbox, self.reason, self.msgs = outbox, reason, []

    def add(self, m: Message):
        self.msgs.append(m)

    def flush(self):
        os.makedirs(self.outbox, exist_ok=True)
        index = []
        for i, m in enumerate(self.msgs, 1):
            base = os.path.join(self.outbox, f"{i:03d}_{_slug(m.to)}")
            with open(base + ".txt", "w") as f:
                f.write(f"To: {m.to}\nSubject: {m.subject}\n\n{m.text}")
            if m.html:
                with open(base + ".html", "w") as f:
                    f.write(m.html)
            index.append({"file": base, "to": m.to, "subject": m.subject, "tag": m.tag, "meta": m.meta})
        with open(os.path.join(self.outbox, "index.json"), "w") as f:
            json.dump({"mode": "dry-run", "reason": self.reason, "count": len(index), "messages": index}, f, indent=1)
        log(f"DRY RUN ({self.reason}): {len(self.msgs)} message(s) written to {self.outbox}/, nothing sent")
        return {"sent": 0, "written": len(self.msgs)}


# ------------------------------------------------------------------ SMTP

class SmtpSender:
    name = "smtp"

    def __init__(self):
        env = os.environ
        missing = [k for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM") if not env.get(k)]
        if missing:
            raise SystemExit(f"smtp backend needs env: {', '.join(missing)}")
        self.host, self.port = env["SMTP_HOST"], int(env.get("SMTP_PORT") or 465)
        self.user, self.pw, self.sender = env["SMTP_USER"], env["SMTP_PASSWORD"], env["EMAIL_FROM"]
        self.reply_to = env.get("EMAIL_REPLY_TO")
        self.max = int(env.get("SMTP_MAX_PER_RUN") or 400)  # stay under Gmail's ~500/day
        self.msgs = []

    def add(self, m: Message):
        self.msgs.append(m)

    def _build(self, m):
        e = EmailMessage()
        e["From"], e["To"], e["Subject"] = self.sender, m.to, m.subject
        e["Message-ID"] = make_msgid(domain=parseaddr(self.sender)[1].split("@")[-1] or None)
        if self.reply_to:
            e["Reply-To"] = self.reply_to
        unsub = parseaddr(self.reply_to or self.sender)[1]
        e["List-Unsubscribe"] = f"<mailto:{unsub}?subject=unsubscribe>"
        e.set_content(m.text)
        if m.html:
            e.add_alternative(m.html, subtype="html")
        return e

    def flush(self):
        if len(self.msgs) > self.max:
            log(f"!! {len(self.msgs)} messages > SMTP_MAX_PER_RUN={self.max}; sending the first {self.max}")
        todo = self.msgs[: self.max]
        sent, failed = 0, []
        ctx = ssl.create_default_context()
        if self.port == 465:
            conn = smtplib.SMTP_SSL(self.host, self.port, context=ctx, timeout=60)
        else:
            conn = smtplib.SMTP(self.host, self.port, timeout=60)
            conn.starttls(context=ctx)
        with conn:
            conn.login(self.user, self.pw)
            for m in todo:
                try:
                    conn.send_message(self._build(m))
                    sent += 1
                except smtplib.SMTPException as ex:
                    failed.append((m.to, str(ex)))
                time.sleep(0.5)
        log(f"smtp: sent {sent}, failed {len(failed)}")
        for to, ex in failed:
            log(f"   failed {to!r}: {ex}")
        return {"sent": sent, "failed": len(failed)}


# ------------------------------------------------------------------ Kit v4 (tag + broadcast)

KIT_V4 = "https://api.kit.com/v4"
ALERT_SUBJECT_PREFIX = "[alerts]"   # internal marker in the broadcast description


class KitApi:
    def __init__(self, key):
        self.key = key

    def call(self, method, path, body=None, params=None, ok=(200, 201, 202, 204)):
        url = KIT_V4 + path + ("?" + urllib.parse.urlencode(params) if params else "")
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers={
            "X-Kit-Api-Key": self.key, "Accept": "application/json",
            "Content-Type": "application/json", "User-Agent": "venture-lab-notify/0.1"})
        for attempt in range(4):
            time.sleep(0.55)                              # stay under 120 requests / 60 s
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    raw = r.read()
                    return json.loads(raw) if raw else {}
            except urllib.error.HTTPError as e:
                if e.code == 429 or e.code >= 500:      # 120 req/min per API key
                    time.sleep(5 * (attempt + 1))
                    continue
                msg = e.read()[:300].decode("utf-8", "replace")
                raise RuntimeError(f"Kit {method} {path} -> HTTP {e.code}: {msg}") from None
        raise RuntimeError(f"Kit {method} {path}: gave up after retries")

    def paged(self, path, key, params=None):
        params = dict(params or {}, per_page=1000)
        while True:
            d = self.call("GET", path, params=params)
            yield from d.get(key, [])
            pg = d.get("pagination") or {}
            if not pg.get("has_next_page"):
                return
            params["after"] = pg["end_cursor"]


class KitBroadcastSender:
    """One broadcast per run, targeted at a tag, body = each subscriber's own custom field.

    Order of operations (each step aborts the run on error, before anything is sent):
      1. refuse if an earlier alert broadcast is still draft/scheduled/sending
      2. remove the alert tag from everyone who still has it (yesterday's recipients)
      3. for each message: find the subscriber by email (skip if missing / not active),
         write the HTML into the alert field, add the alert tag
      4. create the broadcast: public=false, filter = that tag, send_at = now + delay
    """
    name = "kit"

    def __init__(self):
        key = os.environ.get("KIT_V4_API_KEY")
        if not key:
            raise SystemExit("kit backend needs KIT_V4_API_KEY (a V4 key; V3 key/secret are rejected by /v4)")
        self.api = KitApi(key)
        self.tag_name = os.environ.get("KIT_ALERT_TAG") or "alert-due"
        self.field = os.environ.get("KIT_ALERT_FIELD") or "alert_body"
        self.delay = int(os.environ.get("KIT_SEND_DELAY_MIN") or 15)
        self.msgs = []

    def add(self, m: Message):
        self.msgs.append(m)

    def _tag_id(self):
        for t in self.api.paged("/tags", "tags"):
            if t["name"] == self.tag_name:
                return t["id"]
        return self.api.call("POST", "/tags", {"name": self.tag_name})["tag"]["id"]

    def _ensure_field(self):
        for f in self.api.paged("/custom_fields", "custom_fields"):
            if f.get("key") == self.field or f.get("label") == self.field:
                return
        self.api.call("POST", "/custom_fields", {"label": self.field})

    def _pending_alert_broadcasts(self):
        busy = []
        for b in self.api.paged("/broadcasts", "broadcasts"):
            if not (b.get("description") or "").startswith(ALERT_SUBJECT_PREFIX):
                continue
            st = self.api.call("GET", f"/broadcasts/{b['id']}/stats").get("broadcast", {}).get("stats", {})
            if st.get("status") not in ("completed", None):
                busy.append((b["id"], st.get("status")))
        return busy

    def flush(self):
        if not self.msgs:
            log("kit: nothing to send")
            return {"sent": 0}
        busy = self._pending_alert_broadcasts()
        if busy:
            raise RuntimeError(f"kit: earlier alert broadcast(s) not finished {busy}; not touching tags today")
        tag_id = self._tag_id()
        self._ensure_field()
        old = list(self.api.paged(f"/tags/{tag_id}/subscribers", "subscribers", {"status": "all"}))
        for s in old:
            self.api.call("DELETE", f"/tags/{tag_id}/subscribers/{s['id']}")
        log(f"kit: cleared tag '{self.tag_name}' from {len(old)} earlier recipient(s)")

        tagged, skipped = 0, []
        for m in self.msgs:
            found = self.api.call("GET", "/subscribers", params={"email_address": m.to, "status": "all"}).get("subscribers", [])
            if not found or found[0].get("state") != "active":
                skipped.append(m.to)
                continue
            sid = found[0]["id"]
            self.api.call("PUT", f"/subscribers/{sid}", {"email_address": found[0]["email_address"],
                                                         "fields": {self.field: m.html or m.text}})
            self.api.call("POST", f"/tags/{tag_id}/subscribers/{sid}", {})
            tagged += 1
        if skipped:
            log(f"kit: skipped {len(skipped)} recipient(s) not found or not active")
        if not tagged:
            return {"sent": 0, "skipped": len(skipped)}
        send_at = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=self.delay)).strftime("%Y-%m-%dT%H:%M:%SZ")
        today = dt.date.today()
        b = self.api.call("POST", "/broadcasts", {
            "subject": f"Your NYC alerts for {today.strftime('%a %b %-d')}",
            "description": f"{ALERT_SUBJECT_PREFIX} {today.isoformat()} ({tagged} recipients)",
            "content": "{{ subscriber.%s }}" % self.field,
            "public": False,
            "send_at": send_at,
            "subscriber_filter": [{"all": [{"type": "tag", "ids": [tag_id]}]}],
        })
        log(f"kit: broadcast {b.get('broadcast', {}).get('id')} scheduled {send_at} to {tagged} subscriber(s)")
        return {"sent": tagged, "skipped": len(skipped)}


# ------------------------------------------------------------------ factory

def get_sender(send=False, outbox="outbox"):
    backend = (os.environ.get("EMAIL_BACKEND") or "outbox").lower()
    if not send:
        return OutboxSender(outbox, "no --send flag")
    if backend == "smtp":
        return SmtpSender()
    if backend == "kit":
        return KitBroadcastSender()
    return OutboxSender(outbox, f"--send given but EMAIL_BACKEND={backend!r}")
