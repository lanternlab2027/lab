#!/usr/bin/env python3
"""Daily per-subscriber alerts for NYC Building Watch and Hearing Watch.

1. Reads subscribers from Kit by tag (read-only, KIT_API_SECRET) -- or from a fixture file.
     building-watch : fields bbl and/or building_address
     nyc-hearings   : fields hearing_tickets (comma list), hearing_lookup (addr:<BBL> | ticket:<n> | name:<x>)
2. Queries NYC Open Data (reuses ../buildingwatch/watch.py).
3. Builds ONE email per subscriber email address per day, only with items not sent before.
4. Hands the emails to sender.py. DRY RUN unless --send AND EMAIL_BACKEND=smtp|kit.

State (default notify_state.json) contains only salted SHA-256 hashes, never emails,
BBLs or ticket numbers, so it can be committed. Salt: NOTIFY_STATE_SALT (required with --send).
State is saved only after a real send succeeds; dry runs never change it.

  python3 daily.py --fixture fixture_subscribers.json                # test, writes outbox/
  python3 daily.py                                                   # read Kit, dry run
  EMAIL_BACKEND=smtp python3 daily.py --send                         # real send
"""
import argparse, datetime as dt, hashlib, html, json, os, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "buildingwatch"))
import watch                                    # noqa: E402  (NYC Open Data logic)
from sender import Message, get_sender          # noqa: E402

TAG_BUILDING, TAG_HEARING = "building-watch", "nyc-hearings"
SITE = "https://lanternlab2027.github.io/"
OATH_COLS = ("ticket_number,hearing_date,hearing_time,hearing_status,hearing_result,issuing_agency,"
             "charge_1_code_description,balance_due")   # no respondent name/address columns
SEV = {"high": 0, "medium": 1, "low": 2}


# ------------------------------------------------------------------ state (hashed)

class State:
    def __init__(self, path, salt):
        self.path, self.salt = path, salt
        try:
            with open(path) as f:
                self.d = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            self.d = {"v": 1, "subs": {}}

    def h(self, *parts):
        return hashlib.sha256((self.salt + "|" + "|".join(map(str, parts))).encode()).hexdigest()[:20]

    def sub(self, tool, sub_id):
        return self.d["subs"].setdefault(self.h(tool, sub_id), {"last_run": None, "seen": {}})

    def is_new(self, s, key):
        return self.h(key) not in s["seen"]

    def mark(self, s, key, today):
        s["seen"][self.h(key)] = today.isoformat()

    def save(self, today):
        cutoff = (today - dt.timedelta(days=180)).isoformat()
        for s in self.d["subs"].values():
            s["seen"] = {k: v for k, v in s["seen"].items() if v >= cutoff}
        tmp = self.path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(self.d, f, indent=0, sort_keys=True)
        os.replace(tmp, self.path)


# ------------------------------------------------------------------ subscribers

def load_subscribers(args):
    if args.fixture:
        with open(args.fixture) as f:
            d = json.load(f)
        return d.get(TAG_BUILDING, []), d.get(TAG_HEARING, [])
    import kit_source
    return list(kit_source.subscribers_for_tag(TAG_BUILDING)), list(kit_source.subscribers_for_tag(TAG_HEARING))


# ------------------------------------------------------------------ Building Watch

def building_items(subs, state, today, first_run_days, overlap_days, workers):
    """Returns {email: [alert,...]} of not-yet-sent alerts, and a list of (state_sub, keys) to mark."""
    plan = {}   # building entry -> earliest since needed
    per_sub = []
    for s in subs:
        f = s.get("fields") or {}
        entry = (f.get("bbl") or "").strip() or (f.get("building_address") or "").strip()
        if not entry:
            continue
        st = state.sub(TAG_BUILDING, s["id"])
        start = st.get("start") or (today - dt.timedelta(days=first_run_days)).isoformat()
        st["start"] = start      # never look back before the subscriber's first window
        since = dt.date.fromisoformat(start)
        if st["last_run"]:
            since = max(since, dt.date.fromisoformat(st["last_run"]) - dt.timedelta(days=overlap_days))
        plan[entry] = min(plan.get(entry, since), since)
        per_sub.append((s, st, entry, since))

    def work(entry):
        b = watch.resolve(entry)
        return entry, b, watch.fetch(b, plan[entry]) + watch.upcoming(b, today) + watch.deadlines(b, today)

    results = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for fu in [pool.submit(work, e) for e in plan]:
            try:
                entry, b, items = fu.result()
                results[entry] = (b, items)
            except Exception as ex:      # one bad building must not stop the others
                print(f"!! building lookup failed: {ex}", file=sys.stderr)

    out, marks = {}, []
    for s, st, entry, since in per_sub:
        if entry not in results:
            continue
        b, items = results[entry]
        new = []
        for it in items:
            d = dt.date.fromisoformat(it["date"]) if it["date"] else today
            key = f"{b['bbl']}|{it['source']}|{it['id']}"
            if d >= since and state.is_new(st, key):
                new.append(dict(it, _key=key))
        marks.append((st, [it["_key"] for it in new]))
        if new:
            out.setdefault(s["email"], {"first_name": s.get("first_name"), "items": []})["items"] += new
    return out, marks


# ------------------------------------------------------------------ Hearing Watch

def ticket_variants(t):
    t = t.strip()
    return {t, t.lstrip("0"), "0" + t.lstrip("0")} - {""}


def oath_rows_for(sub, today):
    f = sub.get("fields") or {}
    tickets = set()
    for t in (f.get("hearing_tickets") or "").split(","):
        tickets |= ticket_variants(t) if t.strip() else set()
    look = (f.get("hearing_lookup") or "").strip()
    rows = []
    if look.startswith("ticket:"):
        tickets |= ticket_variants(look[7:])
    if tickets:
        lst = ",".join(watch.q(t) for t in sorted(tickets))
        rows += watch.soda("oath", {"$select": OATH_COLS, "$where": f"ticket_number in ({lst})", "$limit": 200})
    if look.startswith("addr:") and len(look[5:].strip()) == 10:
        bbl = look[5:].strip()
        boro, block, lot = bbl[0], bbl[1:6], bbl[6:]
        rows += watch.soda("oath", {"$select": OATH_COLS, "$limit": 300, "$where":
                                    f"violation_location_borough={watch.q(watch.BORO[boro])} AND "
                                    f"violation_location_block_no={watch.q(block)} AND "
                                    f"violation_location_lot_no in ({watch.q(lot)},{watch.q('0' + lot)}) AND "
                                    f"hearing_date >= {watch.q(today.isoformat())}"})
    # name: lookups are matched at signup time; the page stores their ticket numbers in hearing_tickets.
    uniq = {}
    for r in rows:
        uniq[r["ticket_number"]] = r
    return list(uniq.values())


def clock(t):
    try:
        return dt.datetime.strptime(t.strip()[:5], "%H:%M").strftime("%-I:%M %p")
    except ValueError:
        return t


def hearing_alerts(rows, today):
    out = []
    for r in rows:
        hd = watch.parse_date(r.get("hearing_date"))
        status = watch.clean(r.get("hearing_status"))
        agency = watch.clean(r.get("issuing_agency")).title() or "City agency"
        charge = watch.clean(r.get("charge_1_code_description")).title() or "charge not listed"
        t = r["ticket_number"]
        if hd and status in watch.OATH_OPEN:
            days = (hd - today).days
            stage = "week" if 3 <= days <= 7 else "final" if 0 <= days <= 2 else None
            if stage:
                when = "today" if days == 0 else f"in {days} day{'s' if days != 1 else ''}"
                out.append({"_key": f"hear|{t}|{hd}|{stage}", "severity": "high" if stage == "final" else "medium",
                            "title": f"Your OATH hearing is {when} - summons #{t}",
                            "what": f"{agency}: {charge}. Status: {status.title()}.",
                            "deadline": f"Hearing {watch.fmt(hd)}" + (f" at {clock(r['hearing_time'])}" if r.get("hearing_time") else ""),
                            "next_step": ("Decide whether to pay or contest. OATH asks for phone hearings to be requested "
                                          "at least 3 business days ahead and in-person hearings 5 business days ahead; "
                                          "online hearings can be submitted up to the hearing date."),
                            "link": watch.LINKS["oath_hearings"], "address": None, "source": "Hearing reminder"})
        if status in ("DEFAULTED", "DOCKETED"):
            out.append({"_key": f"hear|{t}|status|{status}", "severity": "high",
                        "title": f"Summons #{t} is now {status.title()}",
                        "what": watch.OATH_STATUS_TXT[status] + f" Issuing agency: {agency}.",
                        "deadline": None,
                        "next_step": "Review the case on the OATH / CityPay site and decide whether to pay or ask for a new hearing.",
                        "link": watch.LINKS["oath_reopen"], "address": None, "source": "Case status change"})
    return out


def hearing_items(subs, state, today, workers):
    out, marks = {}, []

    def work(s):
        return s, oath_rows_for(s, today)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [pool.submit(work, s) for s in subs if (s.get("fields") or {}).get("hearing_tickets")
                or (s.get("fields") or {}).get("hearing_lookup")]
        for fu in futs:
            try:
                s, rows = fu.result()
            except Exception as ex:
                print(f"!! hearing lookup failed: {ex}", file=sys.stderr)
                continue
            st = state.sub(TAG_HEARING, s["id"])
            new = [a for a in hearing_alerts(rows, today) if state.is_new(st, a["_key"])]
            marks.append((st, [a["_key"] for a in new]))
            if new:
                out.setdefault(s["email"], {"first_name": s.get("first_name"), "items": []})["items"] += new
    return out, marks


# ------------------------------------------------------------------ rendering

def render(first_name, items, today):
    items = sorted(items, key=lambda a: (SEV.get(a["severity"], 3), a.get("address") or ""))
    hi = f"Hi {first_name}," if first_name else "Hi,"
    n = len(items)
    intro = f"{n} new item{'s' if n != 1 else ''} for {watch.fmt(today)}:"
    t = [hi, "", intro, ""]
    h = [f"<p>{html.escape(hi)}</p>", f"<p>{html.escape(intro)}</p>"]
    for a in items:
        head = f"[{a['severity'].upper()}] {a['title']}" + (f" - {a['address']}" if a.get("address") else "")
        t += [head, f"  What it is: {a['what']}"]
        h += [f"<h3 style=\"margin:18px 0 4px;font-size:16px\">{html.escape(head)}</h3>",
              f"<p style=\"margin:0 0 4px\">{html.escape(a['what'])}</p>"]
        if a.get("deadline"):
            t.append(f"  Deadline / hearing: {a['deadline']}")
            h.append(f"<p style=\"margin:0 0 4px\"><b>Deadline / hearing:</b> {html.escape(a['deadline'])}</p>")
        t += [f"  Next step: {a['next_step']}", f"  Official link: {a['link']}", ""]
        h += [f"<p style=\"margin:0 0 4px\"><b>Next step:</b> {html.escape(a['next_step'])}</p>",
              f"<p style=\"margin:0 0 12px\"><a href=\"{html.escape(a['link'])}\">Official page</a></p>"]
    foot = (f"{watch.DISCLAIMER} You get this because you signed up for alerts at {SITE}. "
            "To stop, use the unsubscribe link or reply 'unsubscribe'.")
    t += ["--", foot]
    h.append(f"<hr><p style=\"font-size:12px;color:#666\">{html.escape(foot)}</p>")
    subject = (f"{items[0]['title']}" if n == 1 else f"{n} new alerts: {items[0]['title']}")[:140]
    return subject, "\n".join(t), "\n".join(h)


# ------------------------------------------------------------------ main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fixture", help="JSON {building-watch:[...], nyc-hearings:[...]} instead of reading Kit")
    ap.add_argument("--state", default="notify_state.json")
    ap.add_argument("--no-save", action="store_true")
    ap.add_argument("--send", action="store_true", help="really send (also needs EMAIL_BACKEND=smtp|kit)")
    ap.add_argument("--outbox", default="outbox")
    ap.add_argument("--first-run-days", type=int, default=7)
    ap.add_argument("--overlap-days", type=int, default=14)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()

    salt = os.environ.get("NOTIFY_STATE_SALT")
    if not salt:
        if a.send:
            raise SystemExit("NOTIFY_STATE_SALT is required with --send")
        salt = "dry-run-salt"
    today = dt.date.today()
    state = State(a.state, salt)
    bsubs, hsubs = load_subscribers(a)
    print(f"subscribers: {len(bsubs)} building-watch, {len(hsubs)} nyc-hearings", file=sys.stderr)

    b_out, b_marks = building_items(bsubs, state, today, a.first_run_days, a.overlap_days, a.workers)
    h_out, h_marks = hearing_items(hsubs, state, today, a.workers)

    merged = {}
    for src in (b_out, h_out):
        for email, v in src.items():
            m = merged.setdefault(email, {"first_name": v["first_name"], "items": []})
            m["items"] += v["items"]
            m["first_name"] = m["first_name"] or v["first_name"]

    sender = get_sender(send=a.send, outbox=a.outbox)
    for email, v in merged.items():
        subject, text, body = render(v["first_name"], v["items"], today)
        sender.add(Message(to=email, subject=subject, text=text, html=body,
                           meta={"items": len(v["items"])}))
    result = sender.flush()

    # Mark as sent only after flush succeeded (a failed send is retried tomorrow).
    for st, keys in b_marks + h_marks:
        for k in keys:
            state.mark(st, k, today)
        st["last_run"] = today.isoformat()
    for tool, subs in ((TAG_BUILDING, bsubs), (TAG_HEARING, hsubs)):
        for s in subs:
            state.sub(tool, s["id"])["last_run"] = today.isoformat()
    if sender.name == "outbox":
        print("dry run: state not saved (nothing was sent)", file=sys.stderr)
    elif not a.no_save:
        state.save(today)
    print(f"{len(merged)} email(s) via {sender.name}: {result}", file=sys.stderr)


if __name__ == "__main__":
    main()
