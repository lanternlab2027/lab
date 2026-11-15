"""welcome.py / reminders.py with Kit mocked at the HTTP layer (urllib.request.urlopen). No network.
Run: cd /home/claude/lab && python3 -m unittest discover -s bots/email/tests -v
"""
import contextlib, datetime as dt, io, json, os, re, shutil, sys, tempfile, unittest, urllib.parse
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
BOT = os.path.dirname(HERE)
sys.path.insert(0, BOT)
import emailbot as E   # noqa: E402
import welcome         # noqa: E402
import reminders       # noqa: E402

FIXTURE = os.path.join(BOT, "fixture_subscribers.json")


class Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


class FakeKit:
    """Tiny in-memory Kit v4 behind urlopen. Records (method, path, query, body) for every call."""

    def __init__(self, tags, members, subscribers):
        self.tags = dict(tags)                      # name -> id
        self.members = {k: list(v) for k, v in members.items()}   # tag id -> [(sid, tagged_at)]
        self.subs = subscribers                     # sid -> {"email_address", "state", "fields"}
        self.broadcasts, self.stats, self.calls, self.next_id = [], {}, [], 5000
        self.fields = []

    def _nid(self):
        self.next_id += 1
        return self.next_id

    def __call__(self, req, timeout=None):
        u = urllib.parse.urlparse(req.full_url)
        assert u.netloc in ("api.kit.com", "api.convertkit.com"), u.netloc
        path = u.path[3:] if u.path.startswith("/v4") else u.path
        q = dict(urllib.parse.parse_qsl(u.query))
        body = json.loads(req.data) if req.data else None
        m = req.get_method()
        self.calls.append((m, path, q, body))
        return Resp(json.dumps(self.route(m, path, q, body)).encode())

    def page(self, key, rows):
        return {key: rows, "pagination": {"has_next_page": False}}

    def route(self, m, path, q, body):
        parts = path.strip("/").split("/")
        if parts == ["tags"]:
            if m == "GET":
                return self.page("tags", [{"id": i, "name": n} for n, i in self.tags.items()])
            i = self._nid()
            self.tags[body["name"]] = i
            return {"tag": {"id": i, "name": body["name"]}}
        if parts[0] == "tags" and parts[2] == "subscribers":
            tid = int(parts[1])
            if len(parts) == 3:
                after = q.get("tagged_after")
                rows = []
                for sid, at in self.members.get(tid, []):
                    s = self.subs[sid]
                    if q.get("status") == "active" and s["state"] != "active":
                        continue
                    if after and at <= after:
                        continue
                    rows.append(dict(s, id=sid, tagged_at=at))
                return self.page("subscribers", rows)
            sid = int(parts[3])
            if m == "DELETE":
                self.members[tid] = [x for x in self.members.get(tid, []) if x[0] != sid]
            else:
                self.members.setdefault(tid, []).append((sid, "2026-11-16T14:00:01Z"))
            return {}
        if parts == ["subscribers"]:
            found = [dict(s, id=i) for i, s in self.subs.items() if s["email_address"] == q["email_address"]]
            return {"subscribers": found}
        if parts[0] == "subscribers" and m == "PUT":
            self.subs[int(parts[1])]["fields"].update(body["fields"])
            return {}
        if parts == ["custom_fields"]:
            if m == "POST":
                self.fields.append(body["label"])
            return self.page("custom_fields", [{"key": f, "label": f} for f in self.fields])
        if parts == ["broadcasts"]:
            if m == "GET":
                return self.page("broadcasts", [{"id": b["id"], "description": b["description"]} for b in self.broadcasts])
            b = dict(body, id=self._nid())
            self.broadcasts.append(b)
            self.stats[b["id"]] = "scheduled"
            return {"broadcast": {"id": b["id"]}}
        if parts[0] == "broadcasts" and parts[2] == "stats":
            return {"broadcast": {"stats": {"status": self.stats[int(parts[1])]}}}
        raise AssertionError(f"unexpected Kit call {m} {path}")

    def writes(self):
        return [c for c in self.calls if c[0] != "GET"]

    def finish_all(self):
        for k in self.stats:
            self.stats[k] = "completed"


def kit_from_fixture():
    with open(FIXTURE) as f:
        d = json.load(f)
    tags = dict(d["tags"], **{"alert-due": 1, "snow-alert-due": 2})
    members, subs = {}, {}
    for name, rows in d["subscribers"].items():
        for r in rows:
            members.setdefault(d["tags"][name], []).append((r["id"], r["tagged_at"]))
            s = subs.setdefault(r["id"], {"email_address": r["email"], "state": "active", "fields": {}})
            s["fields"].update(r["fields"])
    return FakeKit(tags, members, subs)


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir)
        env = {k: v for k, v in os.environ.items() if k not in
               ("EMAIL_BACKEND", "NOTIFY_STATE_SALT", "KIT_V4_API_KEY", "KIT_API_SECRET", "KIT_API_KEY")}
        for p in (mock.patch.dict(os.environ, env, clear=True), mock.patch("time.sleep", lambda s: None)):
            p.start()
            self.addCleanup(p.stop)
        self.kit = kit_from_fixture()
        p = mock.patch("urllib.request.urlopen", self.kit)
        p.start()
        self.addCleanup(p.stop)

    def p(self, *a):
        return os.path.join(self.dir, *a)

    def live(self):
        os.environ.update({"KIT_V4_API_KEY": "fake-v4-key", "NOTIFY_STATE_SALT": "test-salt", "EMAIL_BACKEND": "kit"})

    def welcome(self, *args):
        os.environ.setdefault("KIT_V4_API_KEY", "fake-v4-key")
        err = io.StringIO()
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
            welcome.main(["--state", self.p("w.json"), "--outbox", self.p("outbox"), *args])
        return err.getvalue()

    def remind(self, *args):
        os.environ.setdefault("KIT_V4_API_KEY", "fake-v4-key")
        err = io.StringIO()
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
            reminders.main(["--state", self.p("r.json"), "--outbox", self.p("outbox"), *args])
        return err.getvalue()

    def outbox(self, prefix):
        with open(self.p("outbox", f"{prefix}_index.json")) as f:
            return json.load(f)["messages"]

    def read_out(self, item):
        with open(self.p("outbox", item["file"] + ".txt")) as f:
            return f.read()


# ------------------------------------------------------------------ welcome

class WelcomeDetection(Base):
    def test_uses_tagged_after_and_finds_only_new(self):
        self.welcome("--now", "2026-11-16T14:00:00Z")
        gets = [c for c in self.kit.calls if c[0] == "GET" and c[1].endswith("/subscribers") and c[1].startswith("/tags/")]
        self.assertTrue(gets)
        self.assertTrue(all(c[2]["tagged_after"] == "2026-11-09T00:00:00Z" and c[2]["status"] == "active" for c in gets))
        self.assertEqual(self.kit.writes(), [])                     # dry run: no Kit writes at all
        items = sorted(t for m in self.outbox("welcome") for t in m["items"])
        self.assertNotIn(900009, [m["rid"] for m in self.outbox("welcome")])
        self.assertEqual(items.count("building-watch"), 1)          # old@ (tagged Nov 1) is not new
        self.assertIn("nyc-then", items)                            # Then apps are welcomed now

    def test_watermark_moves_after_full_real_run(self):
        self.live()
        self.welcome("--send", "--now", "2026-11-16T14:00:00Z")
        with open(self.p("w.json")) as f:
            st = json.load(f)
        self.assertEqual(st["last_run"], "2026-11-16T14:00:00Z")
        self.kit.finish_all()
        self.kit.calls.clear()
        self.welcome("--send", "--now", "2026-11-17T14:00:00Z")
        gets = [c for c in self.kit.calls if c[1].startswith("/tags/") and c[1].endswith("/subscribers") and "tagged_after" in c[2]]
        self.assertTrue(all(c[2]["tagged_after"] == "2026-11-15T14:00:00Z" for c in gets))   # last_run - 24h overlap

    def test_skip_tags(self):
        self.welcome("--now", "2026-11-16T14:00:00Z", "--skip-tags", "nyc-then,snow-day")
        items = [t for m in self.outbox("welcome") for t in m["items"]]
        self.assertNotIn("nyc-then", items)
        self.assertNotIn("snow-day", items)


class WelcomeCompose(Base):
    def test_combined_welcome_for_several_tags(self):
        self.welcome("--now", "2026-11-16T14:00:00Z")
        multi = [m for m in self.outbox("welcome") if len(m["items"]) > 1]
        self.assertEqual(sorted(sorted(m["items"]) for m in multi),
                         [["building-watch", "snow-day"], ["etsy-year", "mileage-log"]])
        txt = self.read_out([m for m in multi if "snow-day" in m["items"]][0])
        self.assertIn("Subject: Welcome to Lantern Lab", txt)
        self.assertIn("289 Garfield Pl, Brooklyn", txt)
        self.assertIn("11215", txt)
        self.assertIn("?ref=welcome-building-watch", txt)
        self.assertIn("?ref=welcome-snow-day", txt)
        self.assertEqual(txt.count("unsubscribe link"), 1)

    def test_fields_defaults_and_variants(self):
        self.welcome("--now", "2026-11-16T14:00:00Z")
        subj = {tuple(m["items"]): m["subject"] for m in self.outbox("welcome")}
        self.assertEqual(subj[("fdny-cof",)], "Your FDNY F-01 practice bank is unlocked")   # exam_code field
        self.assertEqual(subj[("fantasy-awards",)], "Weekly fantasy awards: add your league")  # empty league_id
        self.assertEqual(subj[("house-history",)], "We got your house history request")
        self.assertIn("Snow day alerts on for your ZIP", subj.values())                      # empty snow_zip
        texts = [self.read_out(m) for m in self.outbox("welcome")]
        self.assertTrue(any("exchange on Saturday, December 19" in t for t in texts))
        self.assertTrue(any("Friday, December 18, a week before Christmas" in t for t in texts))
        for t in texts:
            self.assertNotRegex(t, r"\{\w+\}")                      # no unfilled placeholders

    def test_scroll_welcome_becomes_the_nudge_after_the_reminder(self):
        self.welcome("--now", "2026-12-05T14:00:00Z", "--since", "2026-11-09T00:00:00Z")
        subj = {tuple(m["items"]): m["subject"] for m in self.outbox("welcome")}
        self.assertEqual(subj[("scroll-wrapped",)], "Wrapped season is here: request your TikTok export")

    def test_html_is_ascii_and_linked(self):
        self.welcome("--now", "2026-11-16T14:00:00Z")
        m = [m for m in self.outbox("welcome") if m["items"] == ["nyc-food-es"]][0]
        with open(self.p("outbox", m["file"] + ".html")) as f:
            h = f.read()
        h.encode("ascii")
        self.assertIn("pr&#225;ctica", h)
        self.assertIn('<a href="https://lanternlab2027.github.io/lab/food/es/quiz?ref=welcome-nyc-food-es">', h)


class WelcomeSendAndDedupe(Base):
    def test_kit_send_scoped_per_subject_and_deduped(self):
        self.live()
        self.kit.members[1] = [(900001, "x")]                       # notify's alert-due: must not be touched
        self.welcome("--send", "--now", "2026-11-16T14:00:00Z")
        bs = self.kit.broadcasts
        self.assertEqual(len(bs), len({b["subject"] for b in bs}))  # one broadcast per subject
        for b in bs:
            self.assertIs(b["public"], False)
            self.assertEqual(b["content"], "{{ subscriber.welcome_body }}")
            self.assertTrue(b["description"].startswith("[welcome]"))
            (tid,) = b["subscriber_filter"][0]["all"][0]["ids"]
            name = [n for n, i in self.kit.tags.items() if i == tid][0]
            self.assertRegex(name, r"^welcome-due-\d+$")
        self.assertIn("welcome_body", self.kit.fields)
        self.assertEqual(self.kit.members[1], [(900001, "x")])
        scroll = [b for b in bs if b["subject"] == "Your Scroll Wrapped reminder is set"][0]
        self.assertEqual(len(self.kit.members[scroll["subscriber_filter"][0]["all"][0]["ids"][0]]), 2)
        with open(self.p("w.json")) as f:
            raw = f.read()
        self.assertNotIn("example.com", raw)
        self.assertNotIn("9000", raw)                               # no subscriber ids either

        n = len(bs)
        self.kit.finish_all()
        self.kit.calls.clear()
        self.welcome("--send", "--now", "2026-11-17T14:00:00Z", "--since", "2026-11-09T00:00:00Z")
        self.assertEqual(len(self.kit.broadcasts), n)               # everyone already welcomed
        self.assertEqual(self.kit.writes(), [])                     # nothing to send: Kit untouched

    def test_new_tag_later_gets_only_that_welcome(self):
        self.live()
        self.welcome("--send", "--now", "2026-11-16T14:00:00Z")
        self.kit.finish_all()
        self.kit.members[self.kit.tags["goal-bingo"]].append((900001, "2026-11-16T20:00:00Z"))
        self.kit.calls.clear()
        self.welcome("--send", "--now", "2026-11-17T14:00:00Z")
        due_ids = {i for nm, i in self.kit.tags.items() if nm.startswith("welcome-due")}
        dels = [c for c in self.kit.calls if c[0] == "DELETE"]
        self.assertGreater(len(dels), 10)                           # yesterday's welcome-due-* recipients cleared
        self.assertTrue(all(int(c[1].split("/")[2]) in due_ids for c in dels))
        last = self.kit.broadcasts[-1]
        self.assertEqual(len(self.kit.broadcasts), len({b["subject"] for b in self.kit.broadcasts[:-1]}) + 1)
        self.assertEqual(last["subject"], "Your monthly goal bingo nudge is set")
        self.assertIn("goal-bingo", self.kit.subs[900001]["fields"]["welcome_body"])

    def test_refuses_while_welcome_broadcast_pending(self):
        self.live()
        self.kit.broadcasts.append({"id": 77, "description": "[alerts] 2026-11-16 (1 recipients)"})
        self.kit.stats[77] = "scheduled"                            # notify's: ignored
        self.welcome("--send", "--now", "2026-11-16T14:00:00Z")
        self.kit.calls.clear()
        self.kit.members[self.kit.tags["goal-bingo"]].append((900001, "2026-11-16T20:00:00Z"))
        with self.assertRaises(RuntimeError):
            self.welcome("--send", "--now", "2026-11-17T14:00:00Z")   # yesterday's [welcome] still scheduled
        self.assertEqual(self.kit.writes(), [])

    def test_only_email(self):
        self.live()
        self.welcome("--send", "--only-email", "Test@Example.com", "--now", "2026-11-16T14:00:00Z")
        self.assertEqual(len(self.kit.broadcasts), 1)
        tid = self.kit.broadcasts[0]["subscriber_filter"][0]["all"][0]["ids"][0]
        self.assertEqual([s for s, _ in self.kit.members[tid]], [900010])
        with open(self.p("w.json")) as f:
            self.assertIsNone(json.load(f)["last_run"])            # watermark not moved by a test send
        self.kit.finish_all()
        self.welcome("--send", "--now", "2026-11-16T15:00:00Z")
        tid = [b for b in self.kit.broadcasts if b["subject"] == "Your Scroll Wrapped reminder is set"][-1]
        ids = [s for s, _ in self.kit.members[tid["subscriber_filter"][0]["all"][0]["ids"][0]]]
        self.assertEqual(ids, [900007])                             # test address not welcomed twice


class DryRunSafety(Base):
    def test_outbox_has_no_addresses(self):
        self.welcome("--now", "2026-11-16T14:00:00Z")
        self.remind("--today", "2026-12-18")
        files = os.listdir(self.p("outbox"))
        self.assertTrue(any(f.startswith("welcome_") for f in files) and any(f.startswith("reminder_") for f in files))
        for f in files:
            self.assertNotIn("@", f)
            self.assertRegex(f, r"^(welcome|reminder)_(\d{3}_[0-9a-f]{12}\.(txt|html)|index\.json)$")
            with open(self.p("outbox", f)) as fh:
                self.assertNotIn("example.com", fh.read())
        self.assertFalse(os.path.exists(self.p("w.json")))
        self.assertFalse(os.path.exists(self.p("r.json")))

    def test_send_without_kit_backend_stays_dry(self):
        os.environ["NOTIFY_STATE_SALT"] = "s"
        out = self.welcome("--send", "--now", "2026-11-16T14:00:00Z")
        self.assertIn("--send given but EMAIL_BACKEND='outbox'", out)
        self.assertEqual(self.kit.writes(), [])
        self.assertEqual(self.kit.broadcasts, [])

    def test_send_requires_salt(self):
        os.environ["EMAIL_BACKEND"] = "kit"
        with self.assertRaises(SystemExit):
            self.welcome("--send")
        with self.assertRaises(SystemExit):
            self.remind("--send")

    def test_fixture_mode_needs_no_kit(self):
        os.environ.pop("KIT_V4_API_KEY", None)
        err = io.StringIO()
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
            welcome.main(["--fixture", FIXTURE, "--now", "2026-11-16T14:00:00Z",
                          "--state", self.p("w.json"), "--outbox", self.p("outbox")])
        self.assertEqual(self.kit.calls, [])
        self.assertEqual(len(self.outbox("welcome")), 14)


# ------------------------------------------------------------------ reminders

def R(rid):
    return [r for r in E.load_json("reminder_texts.json")["reminders"] if r["id"] == rid][0]


class ReminderDates(unittest.TestCase):
    def test_fixed_dates_and_grace(self):
        sc = R("scroll-wrapped-2026")
        d = dt.date
        self.assertEqual(reminders.open_occurrences(sc, d(2026, 11, 29)), [])
        self.assertEqual(reminders.open_occurrences(sc, d(2026, 11, 30)), [("scroll-wrapped-2026", {})])
        self.assertTrue(reminders.open_occurrences(sc, d(2026, 12, 3)))
        self.assertEqual(reminders.open_occurrences(sc, d(2026, 12, 4)), [])
        br = R("bracket-2027-selection-sunday")
        self.assertEqual(br["date"], "2027-03-14")
        self.assertEqual(reminders.open_occurrences(br, d(2027, 3, 13)), [])
        self.assertTrue(reminders.open_occurrences(br, d(2027, 3, 14)))
        for rid in ("year-in-orders-tax-2027", "etsy-year-tax-2027", "mileage-log-tax-2027"):
            self.assertEqual(dt.date.fromisoformat(R(rid)["date"]).month, 1)        # pages say "in January"

    def test_monthly_bingo_first_of_month_feb_to_dec_2027(self):
        b = R("goal-bingo-{month}")
        d = dt.date
        self.assertEqual(reminders.open_occurrences(b, d(2027, 1, 1)), [])
        self.assertEqual(reminders.open_occurrences(b, d(2027, 2, 1)), [("goal-bingo-2027-02", {"month_name": "February"})])
        self.assertEqual(reminders.open_occurrences(b, d(2027, 2, 3))[0][0], "goal-bingo-2027-02")
        self.assertEqual(reminders.open_occurrences(b, d(2027, 2, 4)), [])
        self.assertEqual(reminders.open_occurrences(b, d(2027, 12, 1))[0][0], "goal-bingo-2027-12")
        self.assertEqual(reminders.open_occurrences(b, d(2028, 1, 1)), [])


class SantaWindow(unittest.TestCase):
    def occ(self, field, today):
        return reminders.field_occurrence(R("secret-santa"), {"santa_exchange_date": field}, today)

    def test_window_is_seven_days_before_until_day_before(self):
        d = dt.date
        self.assertIsNone(self.occ("2026-12-19", d(2026, 12, 11)))           # 8 days before
        o = self.occ("2026-12-19", d(2026, 12, 12))
        self.assertEqual(o[0], "secret-santa|2026-12-19")
        self.assertEqual(o[1]["when"], "one week from today")
        self.assertEqual(o[1]["exchange_long"], "Saturday, December 19")
        self.assertIsNone(o[2])
        self.assertEqual(self.occ("2026-12-19", d(2026, 12, 16))[1]["when"], "in 3 days")
        self.assertEqual(self.occ("2026-12-19", d(2026, 12, 18))[1]["when"], "tomorrow")
        self.assertIsNone(self.occ("2026-12-19", d(2026, 12, 19)))           # exchange day: too late
        self.assertEqual(self.occ("12/19/2026", d(2026, 12, 12))[0], "secret-santa|2026-12-19")

    def test_blank_or_bad_date_uses_christmas_fallback(self):
        d = dt.date
        for v in ("", None, "soon"):
            self.assertIsNone(self.occ(v, d(2026, 12, 17)))
            o = self.occ(v, d(2026, 12, 18))
            self.assertEqual((o[0], o[2]), ("secret-santa|2026-12-25", "fallback"))


class ReminderSend(Base):
    def test_only_due_tags_read_and_combined_tax_email(self):
        self.remind("--today", "2027-01-12")
        read = {c[1] for c in self.kit.calls if c[1].startswith("/tags/")}
        want = {f"/tags/{self.kit.tags[t]}/subscribers" for t in ("year-in-orders", "etsy-year", "mileage-log", "secret-santa")}
        self.assertEqual(read, want)
        (m,) = self.outbox("reminder")
        self.assertEqual(m["subject"], "Your Lantern Lab reminders")
        txt = self.read_out(m)
        self.assertIn("?ref=email-etsy-year", txt)
        self.assertIn("?ref=email-mileage-log", txt)

    def test_once_per_subscriber_and_scoped_to_tag(self):
        self.live()
        with mock.patch.object(reminders, "real_today") as today:
            today.return_value = dt.date(2026, 12, 1)
            self.remind("--send")
            (b,) = self.kit.broadcasts
            self.assertEqual(b["subject"], "Wrapped season is here: request your TikTok export")
            self.assertTrue(b["description"].startswith("[reminder]"))
            self.assertEqual(b["content"], "{{ subscriber.reminder_body }}")
            tid = b["subscriber_filter"][0]["all"][0]["ids"][0]
            self.assertEqual(sorted(s for s, _ in self.kit.members[tid]), [900007, 900010])  # scroll-wrapped only
            self.assertIn("ref=email-scroll-wrapped", self.kit.subs[900007]["fields"]["reminder_body"])
            self.kit.finish_all()
            today.return_value = dt.date(2026, 12, 2)
            self.remind("--send")
        self.assertEqual(len(self.kit.broadcasts), 1)               # not sent again in the grace window
        with open(self.p("r.json")) as f:
            raw = f.read()
        self.assertNotIn("example.com", raw)
        self.assertNotIn("scroll", raw)

    def test_bracket_broadcast_scheduled_after_reveal(self):
        self.live()
        with mock.patch.object(reminders, "real_today", return_value=dt.date(2027, 3, 14)):
            self.remind("--send")
        (b,) = self.kit.broadcasts
        self.assertEqual(b["send_at"], "2027-03-15T00:30:00Z")

    def test_today_cannot_be_combined_with_send(self):
        self.live()
        with self.assertRaises(SystemExit):
            self.remind("--send", "--today", "2030-01-01")


class TextData(unittest.TestCase):
    def test_ascii_and_ref_links(self):
        for name in ("welcome_texts.json", "reminder_texts.json"):
            with open(os.path.join(BOT, name), "rb") as f:
                f.read().decode("ascii")
        w = E.load_json("welcome_texts.json")
        for tag, e in w["tags"].items():
            self.assertIn(f"ref=welcome-{tag}", e["link"])
            for u in re.findall(r"https://\S+", " ".join(e["body"])):
                self.assertTrue(u.endswith(f"ref=welcome-{tag}"), (tag, u))
        for r in E.load_json("reminder_texts.json")["reminders"]:
            for u in re.findall(r"https://\S+", " ".join(r["body"]) + " " + r["link"]):
                self.assertTrue(u.endswith(f"ref=email-{r['tag']}"), (r["id"], u))


if __name__ == "__main__":
    unittest.main()
