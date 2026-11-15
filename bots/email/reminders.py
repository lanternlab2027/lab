#!/usr/bin/env python3
"""Dated reminders the apps' signup pages promised (reminder_texts.json). Run once a day.

Kinds of reminder:
  date          send on `date`; a missed day is caught up for `grace_days` (scroll-wrapped Dec 1 2026,
                tax-time Jan 12 2027, couples Feb 7 2027, bracket Selection Sunday Mar 14 2027)
  monthly       day `day` of each month from..to (goal-bingo: the 1st, Feb to Dec 2027)
  before_field  `days_before` a per-subscriber date field (secret-santa: santa_exchange_date - 7 days, sent
                on any day from then until the day before; blank dates use `fallback_date`)

Each (reminder occurrence, subscriber) is sent once: salted-hash state in reminder_state.json, marked after
each Kit broadcast is created. Only that tag's ACTIVE subscribers get it. Someone with several reminders due
on one day gets one combined email. Tags are read only on days when one of their reminders is open.
DRY RUN unless --send AND EMAIL_BACKEND=kit. Kit: temp tags reminder-due-<n>, field reminder_body,
marker [reminder], one private broadcast per subject. An optional send_at (bracket) schedules it later that day.

  python3 reminders.py --fixture fixture_subscribers.json --today 2026-12-01   # offline preview
  python3 reminders.py                                                         # read Kit, dry run (today)
  EMAIL_BACKEND=kit python3 reminders.py --send                                # daily
"""
import argparse, calendar, datetime as dt, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import emailbot as E   # noqa: E402


def real_today():
    return dt.date.today()


def month_iter(a, b):
    y, m = map(int, a.split("-"))
    y2, m2 = map(int, b.split("-"))
    while (y, m) <= (y2, m2):
        yield y, m
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


def open_occurrences(r, today):
    """[(occurrence_id, values)] of a date/monthly reminder whose send window includes today."""
    g = dt.timedelta(days=r.get("grace_days", 0))
    if r["kind"] == "date":
        d = dt.date.fromisoformat(r["date"])
        return [(r["id"], {})] if d <= today <= d + g else []
    if r["kind"] == "monthly":
        out = []
        for y, m in month_iter(r["from"], r["to"]):
            d = dt.date(y, m, r.get("day", 1))
            if d <= today <= d + g:
                out.append((r["id"].format(month=f"{y}-{m:02d}"), {"month_name": calendar.month_name[m]}))
        return out
    return []


def when_phrase(days):
    return "tomorrow" if days == 1 else "one week from today" if days == 7 else f"in {days} days"


def field_occurrence(r, fields, today):
    """before_field: (occurrence_id, values, variant) if today is in [date - days_before, date - 1], else None."""
    exch, variant = E.parse_day((fields or {}).get(r["field"])), None
    if exch is None and r.get("fallback_date"):
        exch, variant = dt.date.fromisoformat(r["fallback_date"]), "fallback"
    if exch is None:
        return None
    days = (exch - today).days
    if not 1 <= days <= r["days_before"]:
        return None
    return f"{r['id']}|{exch.isoformat()}", {"when": when_phrase(days), "exchange_long": E.nice_date(exch)}, variant


def collect(texts, reader, today, state, keep):
    """{sub_id: {"email", "items": [(occ_id, entry, values)]}} of reminders due today and not yet sent."""
    due = {}             # tag -> [reminder]
    for r in texts["reminders"]:
        if r["kind"] == "before_field" or open_occurrences(r, today):
            due.setdefault(r["tag"], []).append(r)
    if not due:
        return {}, {}
    ids = reader.tag_ids()
    people, counts = {}, {}
    for tag, rs in due.items():
        if tag not in ids:
            E.log(f"!! tag {tag!r} not in Kit; skipped")
            continue
        for s in reader.tag_subscribers(ids[tag]):
            if not s["email"] or not keep(s):
                continue
            for r in rs:
                if r["kind"] == "before_field":
                    hit = field_occurrence(r, s["fields"], today)
                    occs = [hit] if hit else []
                else:
                    occs = [(o, v, None) for o, v in open_occurrences(r, today)]
                for occ, vals, variant in occs:
                    if state.has("reminder", occ, s["id"]):
                        continue
                    entry = dict(r, **r["variants"][variant]) if variant else r
                    p = people.setdefault(s["id"], {"email": s["email"], "items": []})
                    p["items"].append((occ, entry, vals))
                    counts[occ] = counts.get(occ, 0) + 1
    return people, counts


def main(argv=None, reader=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fixture", help="JSON of fake subscribers instead of reading Kit")
    ap.add_argument("--state", default=os.path.join(HERE, "reminder_state.json"))
    ap.add_argument("--outbox", default=os.path.join(HERE, "outbox"))
    ap.add_argument("--send", action="store_true", help="really send (also needs EMAIL_BACKEND=kit)")
    ap.add_argument("--only-email", help="only this subscriber (first live test)")
    ap.add_argument("--today", help="YYYY-MM-DD to evaluate (testing / preview); default: today")
    ap.add_argument("--no-save", action="store_true")
    a = ap.parse_args(argv)

    salt = E.get_salt(a.send)
    today = dt.date.fromisoformat(a.today) if a.today else real_today()
    if a.today and a.send and today != real_today():
        raise SystemExit("--today is for previews; it can't be combined with --send")
    texts = E.load_json("reminder_texts.json")
    state = E.HashState(a.state, salt)
    keep = E.only_filter(a.only_email)

    open_now = [o for r in texts["reminders"] for o, _ in open_occurrences(r, today)]
    E.log(f"reminders {today}: open date/monthly reminders: {', '.join(open_now) or 'none'} (+ per-subscriber secret-santa)")
    reader = reader or (E.FixtureReader(a.fixture) if a.fixture else E.KitReader.from_env())
    people, counts = collect(texts, reader, today, state, keep)
    E.log("reminders: due " + (", ".join(f"{o} x{n}" for o, n in sorted(counts.items())) or "nothing"))

    out = E.get_sender(a.send, a.outbox, "reminder", "reminder-due", "reminder_body", "[reminder]")
    for sid, p in people.items():
        entries = [e for _, e, _ in p["items"]]
        vals = [v for _, _, v in p["items"]]
        subject, paras = E.compose(entries, texts["combined"], vals)
        send_at = max((e.get("send_at") or "" for e in entries), default="") or None
        out.add(E.Message(to=p["email"], subject=subject, text=E.to_text(paras), html=E.to_html(paras),
                          tag="reminder", meta={"rid": state.rid(sid), "sid": sid, "send_at": send_at,
                                                "items": [o for o, _, _ in p["items"]]}))

    real = out.name != "outbox"

    def on_sent(msgs):
        for m in msgs:
            for occ in m.meta["items"]:
                state.mark(today, "reminder", occ, m.meta["sid"])
        if not a.no_save:
            state.save(today)
    if real:
        out.on_sent = on_sent
    result = out.flush()
    if not real:
        E.log("dry run: state not saved (nothing was sent)")
    E.log(f"reminders: {len(people)} email(s) via {out.name}: {result}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
