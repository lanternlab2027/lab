"""Shared code for bots/email (welcome.py, reminders.py). Standard library only.

Reuses bots/notify: sender.Message, sender.KitApi (v4 calls) and sender.KitBroadcastSender (tag + custom
field + private broadcast), plus kit_source._get for the read-only v3 fallback.

- HashState     salted-hash state file, no emails or ids in clear (salt NOTIFY_STATE_SALT)
- KitReader     tag ids + subscribers per tag (v4 with KIT_V4_API_KEY, else v3 with KIT_API_SECRET)
- FixtureReader the same interface over a JSON file of fake subscribers
- render        paragraphs -> plain text + ASCII-safe HTML
- ScopedKitSender  notify's Kit mechanism with its own tag/field/marker and ONE broadcast PER SUBJECT
- Outbox        dry-run preview; file names use hashed ids, and no email address is written anywhere
"""
import datetime as dt, hashlib, html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "notify"))
import sender as notify_sender        # noqa: E402  (bots/notify/sender.py)
import kit_source                     # noqa: E402  (bots/notify/kit_source.py, v3 reads)

Message = notify_sender.Message


def log(*a):
    print(*a, file=sys.stderr)


def load_json(name):
    with open(os.path.join(HERE, name)) as f:
        return json.load(f)


def utc_iso(t):
    return t.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(s):
    if not s:
        return None
    t = dt.datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def get_salt(send):
    salt = os.environ.get("NOTIFY_STATE_SALT")
    if not salt:
        if send:
            raise SystemExit("NOTIFY_STATE_SALT is required with --send")
        salt = "dry-run-salt"
    return salt


# ------------------------------------------------------------------ state (salted hashes only)

class HashState:
    """{"v":1, "done": {sha256(salt|parts)[:20]: "YYYY-MM-DD"}, "last_run": iso|null}."""

    def __init__(self, path, salt):
        self.path, self.salt = path, salt
        try:
            with open(path) as f:
                self.d = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            self.d = {}
        self.d.setdefault("v", 1)
        self.d.setdefault("done", {})
        self.d.setdefault("last_run", None)

    def h(self, *parts):
        return hashlib.sha256((self.salt + "|" + "|".join(map(str, parts))).encode()).hexdigest()[:20]

    def rid(self, sub_id):
        """Stable, non-reversible id for a subscriber, used in outbox file names and logs."""
        return self.h("rid", sub_id)[:12]

    def has(self, *parts):
        return self.h(*parts) in self.d["done"]

    def mark(self, day, *parts):
        self.d["done"][self.h(*parts)] = day.isoformat()

    def save(self, today, keep_days=400):
        cutoff = (today - dt.timedelta(days=keep_days)).isoformat()
        self.d["done"] = {k: v for k, v in self.d["done"].items() if v >= cutoff}
        tmp = self.path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(self.d, f, indent=0, sort_keys=True)
        os.replace(tmp, self.path)


# ------------------------------------------------------------------ reading subscribers

def _norm(sid, email, fields, tagged_at):
    return {"id": sid, "email": (email or "").strip(), "fields": fields or {}, "tagged_at": tagged_at or ""}


class KitReader:
    """Read-only. v4 (KIT_V4_API_KEY): GET /v4/tags, GET /v4/tags/{id}/subscribers?status=active&tagged_after=.
    v3 fallback (KIT_API_SECRET): GET /v3/tags, /v3/tags/{id}/subscriptions; tagged_after is applied locally."""

    def __init__(self, v4_key=None, v3_secret=None):
        self.v4_key, self.v3_secret = v4_key, v3_secret
        if v4_key:
            self.api, self.mode = notify_sender.KitApi(v4_key), "v4"
        elif v3_secret:
            self.api, self.mode = None, "v3"
        else:
            raise SystemExit("set KIT_V4_API_KEY (or KIT_API_SECRET for read-only v3), or use --fixture")

    @classmethod
    def from_env(cls):
        return cls(os.environ.get("KIT_V4_API_KEY"), os.environ.get("KIT_API_SECRET"))

    def tag_ids(self):
        if self.mode == "v4":
            return {t["name"]: t["id"] for t in self.api.paged("/tags", "tags")}
        return kit_source.tag_ids(self.v3_secret)

    def tag_subscribers(self, tag_id, tagged_after=None):
        if self.mode == "v4":
            params = {"status": "active"}
            if tagged_after:
                params["tagged_after"] = utc_iso(tagged_after)
            out = []
            for s in self.api.paged(f"/tags/{tag_id}/subscribers", "subscribers", params):
                if s.get("state", "active") != "active":
                    continue
                fields = s.get("fields")
                if fields is None:      # not every listing carries fields; fetch the subscriber once
                    fields = (self.api.call("GET", f"/subscribers/{s['id']}").get("subscriber") or {}).get("fields") or {}
                out.append(_norm(s["id"], s.get("email_address"), fields, s.get("tagged_at")))
            return out
        out, page = [], 1
        while True:
            d = kit_source._get(f"/tags/{tag_id}/subscriptions",
                                {"api_secret": self.v3_secret, "subscriber_state": "active", "page": page})
            for row in d.get("subscriptions", []):
                sub = row.get("subscriber") or {}
                if sub.get("state", "active") != "active":
                    continue
                t = parse_iso(row.get("created_at"))
                if tagged_after and t and t <= tagged_after:
                    continue
                out.append(_norm(sub["id"], sub.get("email_address"), sub.get("fields"), row.get("created_at")))
            if page >= d.get("total_pages", 1):
                return out
            page += 1


class FixtureReader:
    """{"tags": {name: id}, "subscribers": {tag_name: [{id, email, fields, tagged_at}]}} (fake addresses only)."""

    def __init__(self, path):
        with open(path) as f:
            self.d = json.load(f)
        self.mode = "fixture"
        self.names = {v: k for k, v in self.d["tags"].items()}

    def tag_ids(self):
        return dict(self.d["tags"])

    def tag_subscribers(self, tag_id, tagged_after=None):
        out = []
        for s in self.d["subscribers"].get(self.names[tag_id], []):
            t = parse_iso(s.get("tagged_at"))
            if tagged_after and t and t <= tagged_after:
                continue
            out.append(_norm(s["id"], s.get("email"), s.get("fields"), s.get("tagged_at")))
        return out


def only_filter(email):
    want = (email or "").strip().lower()
    return (lambda s: s["email"].lower() == want) if want else (lambda s: True)


# ------------------------------------------------------------------ rendering

PLACEHOLDER = re.compile(r"\{(\w+)\}")
URL = re.compile(r"https?://[^\s<>\"]+")


def fill(s, values):
    return PLACEHOLDER.sub(lambda m: str(values[m.group(1)]) if values.get(m.group(1)) not in (None, "") else m.group(0), s)


def pick_variant(entry, values, today):
    """Applies the first matching variant: 'no:<key>' (value empty), 'has:<key>' (value set), 'after:YYYY-MM-DD'."""
    for cond, over in (entry.get("variants") or {}).items():
        kind, _, arg = cond.partition(":")
        hit = ((kind == "no" and not values.get(arg)) or (kind == "has" and bool(values.get(arg)))
               or (kind == "after" and today >= dt.date.fromisoformat(arg)))
        if hit:
            return dict(entry, **over)
    return entry


def compose(entries, combined, values_list):
    """entries: chosen copy dicts (one per tag/reminder), values_list: their fill values. Returns subject, paragraphs."""
    if len(entries) == 1:
        e, v = entries[0], values_list[0]
        return fill(e["subject"], v), [fill(p, v) for p in e["body"]]
    paras = [combined["intro"]]
    for e, v in zip(entries, values_list):
        paras.append(f"{fill(e['name'], v)}: {fill(e['next'], v)}\n{e['link']}")
    return combined["subject"], paras + list(combined["outro"])


def to_text(paras):
    return "\n\n".join(paras) + "\n"


def to_html(paras):
    out = []
    for p in paras:
        esc = html.escape(p, quote=False)

        def a(m):
            u = m.group(0).rstrip(".,;)")
            return f'<a href="{u}">{u}</a>' + m.group(0)[len(u):]
        esc = URL.sub(a, esc).replace("\n", "<br>\n")
        out.append(f'<p style="margin:0 0 14px;line-height:1.5">{esc}</p>')
    return "\n".join(out).encode("ascii", "xmlcharrefreplace").decode()


def nice_date(d):
    return f"{d.strftime('%A, %B')} {d.day}"


def parse_day(s):
    """'2026-12-19' (input type=date) or '12/19/2026'; anything else -> None."""
    s = (s or "").strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return dt.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


# ------------------------------------------------------------------ Kit backend: one broadcast per subject

class ScopedKitSender(notify_sender.KitBroadcastSender):
    """notify's KitBroadcastSender steps, with its own names and one private broadcast per distinct subject.

      1. refuse if an earlier broadcast whose description starts with `prefix` is still draft/scheduled/sending
      2. remove every tag named <tag_base> or <tag_base>-<n> from last run's recipients
      3. group messages by (subject, send_at); group k uses tag <tag_base>-<k> (created on demand).
         Per message: find the subscriber by email (skip if missing or not active), write the HTML into
         `field`, add the group's tag. Each person is in exactly one group per run, so the shared field
         never collides.
      4. per group: POST /broadcasts, public=false, filter = that tag, content {{ subscriber.<field> }},
         send_at = max(now + KIT_SEND_DELAY_MIN, message send_at)
    After each broadcast is created, on_sent(messages) is called so the caller can record state at once.
    """
    name = "kit"

    def __init__(self, tag_base, field, prefix):
        super().__init__()                      # needs KIT_V4_API_KEY
        self.tag_name, self.tag_base, self.field, self.prefix = tag_base, tag_base, field, prefix
        self.on_sent = None

    def _pending_alert_broadcasts(self):
        busy = []
        for b in self.api.paged("/broadcasts", "broadcasts"):
            if not (b.get("description") or "").startswith(self.prefix):
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
            raise RuntimeError(f"kit: earlier {self.prefix} broadcast(s) not finished {busy}; not touching tags today")
        self._ensure_field()
        tags = {t["name"]: t["id"] for t in self.api.paged("/tags", "tags")}
        mine = re.compile(r"^%s(-\d+)?$" % re.escape(self.tag_base))
        cleared = 0
        for name, tid in sorted(tags.items()):
            if mine.match(name):
                for s in list(self.api.paged(f"/tags/{tid}/subscribers", "subscribers", {"status": "all"})):
                    self.api.call("DELETE", f"/tags/{tid}/subscribers/{s['id']}")
                    cleared += 1
        log(f"kit: cleared {self.tag_base}* tags from {cleared} earlier recipient(s)")

        groups = {}
        for m in self.msgs:
            groups.setdefault((m.subject, m.meta.get("send_at") or ""), []).append(m)
        sent, skipped, made = 0, 0, 0
        for k, ((subject, want_at), ms) in enumerate(groups.items(), 1):
            tname = f"{self.tag_base}-{k}"
            tid = tags.get(tname) or self.api.call("POST", "/tags", {"name": tname})["tag"]["id"]
            tags[tname] = tid
            done = []
            for m in ms:
                found = self.api.call("GET", "/subscribers", params={"email_address": m.to, "status": "all"}).get("subscribers", [])
                if not found or found[0].get("state") != "active":
                    skipped += 1
                    continue
                sid = found[0]["id"]
                self.api.call("PUT", f"/subscribers/{sid}", {"email_address": found[0]["email_address"],
                                                             "fields": {self.field: m.html or m.text}})
                self.api.call("POST", f"/tags/{tid}/subscribers/{sid}", {})
                done.append(m)
            if not done:
                continue
            at = utc_iso(dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=self.delay))
            if want_at and want_at > at:
                at = want_at
            b = self.api.call("POST", "/broadcasts", {
                "subject": subject,
                "description": f"{self.prefix} {dt.date.today().isoformat()} group {k}/{len(groups)} ({len(done)} recipients)",
                "content": "{{ subscriber.%s }}" % self.field,
                "public": False,
                "send_at": at,
                "subscriber_filter": [{"all": [{"type": "tag", "ids": [tid]}]}],
            })
            made += 1
            sent += len(done)
            log(f"kit: broadcast {b.get('broadcast', {}).get('id')} '{subject}' scheduled {at} to {len(done)} subscriber(s)")
            if self.on_sent:
                self.on_sent(done)
        if skipped:
            log(f"kit: skipped {skipped} recipient(s) not found or not active")
        return {"sent": sent, "skipped": skipped, "broadcasts": made}


# ------------------------------------------------------------------ dry run

class Outbox:
    """Writes <outbox>/<prefix>_<n>_<rid>.txt/.html and <prefix>_index.json. rid is a salted hash of the
    Kit subscriber id. No email address goes into any file name or file."""
    name = "outbox"

    def __init__(self, outbox, prefix, reason):
        self.outbox, self.prefix, self.reason, self.msgs = outbox, prefix, reason, []
        self.on_sent = None

    def add(self, m):
        self.msgs.append(m)

    def flush(self):
        os.makedirs(self.outbox, exist_ok=True)
        for f in os.listdir(self.outbox):
            if f.startswith(self.prefix + "_"):
                os.remove(os.path.join(self.outbox, f))
        index = []
        for i, m in enumerate(self.msgs, 1):
            rid = m.meta["rid"]
            base = os.path.join(self.outbox, f"{self.prefix}_{i:03d}_{rid}")
            items = m.meta.get("items", [])
            with open(base + ".txt", "w") as f:
                f.write(f"To: subscriber {rid}\nItems: {', '.join(items)}\n"
                        + (f"Send at: {m.meta['send_at']}\n" if m.meta.get("send_at") else "")
                        + f"Subject: {m.subject}\n\n{m.text}")
            with open(base + ".html", "w") as f:
                f.write(m.html + "\n")
            index.append({"file": os.path.basename(base), "rid": rid, "subject": m.subject, "items": items,
                          "send_at": m.meta.get("send_at")})
        with open(os.path.join(self.outbox, f"{self.prefix}_index.json"), "w") as f:
            json.dump({"mode": "dry-run", "reason": self.reason, "count": len(index), "messages": index}, f, indent=1)
        log(f"DRY RUN ({self.reason}): {len(index)} email(s) written to {self.outbox}/{self.prefix}_*, nothing sent")
        return {"sent": 0, "written": len(index)}


def get_sender(send, outbox, prefix, tag_base, field, marker):
    """Real send needs --send AND EMAIL_BACKEND=kit. Anything else writes the outbox."""
    backend = (os.environ.get("EMAIL_BACKEND") or "outbox").lower()
    if not send:
        return Outbox(outbox, prefix, "no --send flag")
    if backend == "kit":
        return ScopedKitSender(tag_base, field, marker)
    return Outbox(outbox, prefix, f"--send given but EMAIL_BACKEND={backend!r} (only 'kit' sends)")
