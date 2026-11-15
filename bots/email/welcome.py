#!/usr/bin/env python3
"""Daily welcome emails: every new member of each app tag gets that tag's welcome (welcome_texts.json).

1. For each tag in welcome_texts.json (minus --skip-tags), lists ACTIVE subscribers tagged after the watermark
   (last real run minus --overlap-hours; first run: --since, default 2026-11-09). v4 tagged_after with
   KIT_V4_API_KEY, or v3 with KIT_API_SECRET (filtered locally). Read-only.
2. Drops (tag, subscriber) pairs already welcomed (salted-hash state). Groups the rest by subscriber:
   one new tag -> that tag's welcome; several -> the combined "Welcome to Lantern Lab" email.
   Placeholders come from the subscriber's custom fields (building_address, snow_zip, santa_exchange_date,
   league_id, exam_code) with the defaults in welcome_texts.json.
3. DRY RUN unless --send AND EMAIL_BACKEND=kit. Kit: temp tags welcome-due-<n>, field welcome_body,
   marker [welcome], one private broadcast per subject (see emailbot.ScopedKitSender).
4. State (welcome_state.json) is marked after each broadcast is created. The watermark only moves after a
   full real run (never with --only-email), so a partial run is retried the next day.

  python3 welcome.py --fixture fixture_subscribers.json --now 2026-11-16T14:00:00Z   # offline preview
  python3 welcome.py                                                                 # read Kit, dry run
  EMAIL_BACKEND=kit python3 welcome.py --send --only-email test@example.com          # first real send
  EMAIL_BACKEND=kit python3 welcome.py --send                                        # daily
"""
import argparse, datetime as dt, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import emailbot as E   # noqa: E402

FIRST_SINCE = "2026-11-09T00:00:00Z"     # the Kit account's first objects
EXAM_CODE = re.compile(r"^[A-Z]{1,2}-\d{2,3}$")


def values_for(fields):
    v = {k: (str(x).strip() if x is not None else "") for k, x in (fields or {}).items()}
    code = v.get("exam_code", "").upper()
    v["exam_code"] = code if EXAM_CODE.match(code) else ""
    d = E.parse_day(v.get("santa_exchange_date"))
    v["santa_exchange_date"] = E.nice_date(d) if d else ""
    return v


def with_defaults(entry, v):
    v = dict(v)
    for k, default in (entry.get("defaults") or {}).items():
        if not v.get(k):
            v[k] = default
    return v


def build(texts, people, today):
    """people: {sub_id: {"email", "fields", "tags"}} -> [(sub_id, subject, paragraphs)]"""
    out = []
    for sid, p in people.items():
        entries, vals = [], []
        for tag in p["tags"]:
            base = texts["tags"][tag]
            v = values_for(p["fields"])
            entry = E.pick_variant(base, v, today)       # variants see the raw (empty) values
            entries.append(entry)
            vals.append(with_defaults(entry, v))
        subject, paras = E.compose(entries, texts["combined"], vals)
        out.append((sid, subject, paras))
    return out


def main(argv=None, reader=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fixture", help="JSON of fake subscribers instead of reading Kit")
    ap.add_argument("--state", default=os.path.join(HERE, "welcome_state.json"))
    ap.add_argument("--outbox", default=os.path.join(HERE, "outbox"))
    ap.add_argument("--send", action="store_true", help="really send (also needs EMAIL_BACKEND=kit)")
    ap.add_argument("--only-email", help="only this subscriber (first live test); watermark not moved")
    ap.add_argument("--since", help=f"ISO time; overrides the watermark (first run default {FIRST_SINCE})")
    ap.add_argument("--overlap-hours", type=int, default=24)
    ap.add_argument("--skip-tags", default="", help="comma list of tags not to welcome this run")
    ap.add_argument("--now", help="ISO time of the run (testing)")
    ap.add_argument("--no-save", action="store_true")
    a = ap.parse_args(argv)

    salt = E.get_salt(a.send)
    now = E.parse_iso(a.now) if a.now else dt.datetime.now(dt.timezone.utc)
    today = now.date()
    texts = E.load_json("welcome_texts.json")
    state = E.HashState(a.state, salt)
    if a.since:
        since = E.parse_iso(a.since)
    elif state.d["last_run"]:
        since = E.parse_iso(state.d["last_run"]) - dt.timedelta(hours=a.overlap_hours)
    else:
        since = E.parse_iso(FIRST_SINCE)
    skip = {t.strip() for t in a.skip_tags.split(",") if t.strip()}
    skip |= {t for t, e in texts["tags"].items() if e.get("skip")}
    keep = E.only_filter(a.only_email)

    reader = reader or (E.FixtureReader(a.fixture) if a.fixture else E.KitReader.from_env())
    ids = reader.tag_ids()
    people, counts, missing = {}, {}, []
    for tag in texts["tags"]:
        if tag in skip:
            continue
        if tag not in ids:
            missing.append(tag)
            continue
        for s in reader.tag_subscribers(ids[tag], since):
            if not s["email"] or not keep(s) or state.has("welcome", tag, s["id"]):
                continue
            p = people.setdefault(s["id"], {"email": s["email"], "fields": {}, "tags": []})
            p["fields"].update(s["fields"])
            p["tags"].append(tag)
            counts[tag] = counts.get(tag, 0) + 1
    if missing:
        E.log(f"!! {len(missing)} tag(s) not in Kit, skipped: {', '.join(missing)}")
    E.log(f"welcome: read via {reader.mode}, tagged after {E.utc_iso(since)}; "
          f"{len(people)} new subscriber(s): " + (", ".join(f"{t} {n}" for t, n in counts.items()) or "none"))
    if a.only_email:
        E.log(f"welcome: --only-email set, {len(people)} matching subscriber(s)")
    manual = [t for t in counts if texts["tags"][t].get("manual_followup")]
    for t in manual:
        print(f"NOTE: {counts[t]} new {t} signup(s) need a personal email within a day (see Kit tag {t}).")

    out = E.get_sender(a.send, a.outbox, "welcome", "welcome-due", "welcome_body", "[welcome]")
    for sid, subject, paras in build(texts, people, today):
        p = people[sid]
        out.add(E.Message(to=p["email"], subject=subject, text=E.to_text(paras), html=E.to_html(paras),
                          tag="welcome", meta={"rid": state.rid(sid), "sid": sid, "items": p["tags"]}))

    real = out.name != "outbox"

    def on_sent(msgs):
        for m in msgs:
            for tag in m.meta["items"]:
                state.mark(today, "welcome", tag, m.meta["sid"])
        if not a.no_save:
            state.save(today)
    if real:
        out.on_sent = on_sent
    result = out.flush()
    if not real:
        E.log("dry run: state not saved (nothing was sent)")
    elif not a.only_email and not a.no_save:
        state.d["last_run"] = E.utc_iso(now)
        state.save(today)
    E.log(f"welcome: {len(people)} email(s) via {out.name}: {result}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
