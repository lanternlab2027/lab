"""Grouping, dedupe state, budget, rendering, rate limit, Kit backend calls and a full dry run with mocked HTTP.
Nothing here touches the network. Run: python3 -m unittest discover -s bots/snow_alerts/tests -v
"""
import contextlib, io, json, os, shutil, sys, tempfile, unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fakes  # noqa: E402
import snow  # noqa: E402
import snow_model as M  # noqa: E402

FIXTURE = os.path.join(os.path.dirname(HERE), "fixture_subscribers.json")


def read(p):
    with open(p) as f:
        return f.read()


def load_fixture():
    with open(FIXTURE) as f:
        return json.load(f)["snow-day"]


class Tmp(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir)
        env = {k: v for k, v in os.environ.items() if k not in ("EMAIL_BACKEND", "NOTIFY_STATE_SALT", "KIT_V4_API_KEY", "KIT_API_SECRET")}
        p = mock.patch.dict(os.environ, env, clear=True)
        p.start()
        self.addCleanup(p.stop)

    def path(self, name):
        return os.path.join(self.dir, name)

    def run_main(self, *args, http=None, subs=None):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            snow.main(["--now", fakes.RUN_AT, "--state", self.path("state.json"), "--cache", self.path("cache.json"),
                       "--outbox", self.path("outbox"), *args], http=http, subscribers=subs)
        return out.getvalue(), err.getvalue()


class Grouping(unittest.TestCase):
    def test_group_by_zip(self):
        groups, bad = snow.group_by_zip(load_fixture())
        self.assertEqual(sorted(groups), ["00000", "14201", "14202", "30303", "80202"])
        self.assertEqual(len(groups["14201"]), 2)            # ZIP+4 normalized, duplicate email (any case) dropped
        self.assertEqual(bad, 2)                               # null and "abc"
        self.assertEqual(snow.ordered_zips(groups)[0], "14201")

    def test_norm_zip(self):
        self.assertEqual(snow.norm_zip("02134"), "02134")
        self.assertEqual(snow.norm_zip(" 14201-1234 "), "14201")
        for z in (None, "", "1420", "142011", "abcde", 14201.0):
            self.assertIsNone(snow.norm_zip(z), z)

    def test_zip_lookup_uses_app_shards(self):
        z = snow.ZipLookup()
        self.assertEqual(z("14201"), (42.898, -78.888))
        self.assertIsNone(z("00000"))
        self.assertEqual(snow.fix4(42.898) + "," + snow.fix4(-78.888), "42.898,-78.888")


class StateTests(Tmp):
    def test_hashed_dedupe_roundtrip(self):
        s = snow.State(self.path("s.json"), "salt1")
        self.assertFalse(s.alerted("14201", "2026-12-02"))
        s.mark("14201", "2026-12-02")
        s.save(__import__("datetime").date(2026, 12, 1))
        raw = read(self.path("s.json"))
        self.assertNotIn("14201", raw)                         # only salted hashes on disk
        s2 = snow.State(self.path("s.json"), "salt1")
        self.assertTrue(s2.alerted("14201", "2026-12-02"))
        self.assertFalse(s2.alerted("14201", "2026-12-03"))   # a new date can alert again
        self.assertFalse(s2.alerted("14202", "2026-12-02"))
        self.assertFalse(snow.State(self.path("s.json"), "other-salt").alerted("14201", "2026-12-02"))

    def test_old_entries_pruned(self):
        import datetime as dt
        s = snow.State(self.path("s.json"), "x")
        s.mark("14201", "2026-01-02")
        s.mark("14201", "2026-12-02")
        s.save(dt.date(2026, 12, 2))
        self.assertEqual(list(snow.State(self.path("s.json"), "x").d["sent"].values()), ["2026-12-02"])


class Render(unittest.TestCase):
    def test_email_content(self):
        win = M.target_window(M.parse_ms(fakes.RUN_AT), "America/New_York")
        res = M.odds(M.extract(fakes.GRIDS["heavy"], fakes.alerts(["Winter Storm Warning"]), win), "used")
        res["reasons"] = res["reasons"] + ["Wind chill near -18\u00b0F", "fourth reason"]
        subject, text, body = snow.render("14201", "Buffalo, NY", win, res)
        for s in (subject, text, body):
            s.encode("ascii")                                  # ASCII-safe
        self.assertIn(f"{res['chance']}%", subject)
        self.assertIn("Buffalo, NY", subject)
        self.assertIn("Wednesday, Dec 2", text)
        self.assertIn(snow.DISCLAIMER, text)
        self.assertIn(snow.DISCLAIMER, body)
        self.assertIn("https://lanternlab2027.github.io/lab/snow/?zip=14201&r=used&ref=email-snow", text)
        self.assertIn("?zip=14201&amp;r=used&amp;ref=email-snow", body)
        self.assertIn("- " + res["reasons"][0], text)
        self.assertNotIn("fourth reason", text)                # top 3 reasons only
        self.assertIn("Winter Storm Warning in effect", text)

    def test_degree_sign(self):
        win = M.target_window(M.parse_ms(fakes.RUN_AT), "America/New_York")
        res = {"chance": 60, "label": "Real chance", "region": "used", "reasons": ["Wind chill near -18\u00b0F"]}
        _, text, body = snow.render("14201", "", win, res)
        self.assertIn("Wind chill near -18F", text)
        self.assertIn("-18&deg;F", body)
        self.assertIn("ZIP 14201", text)                       # no town -> ZIP


class RateLimit(unittest.TestCase):
    def test_one_request_per_second_and_user_agent(self):
        t = [100.0]
        sleeps = []

        def sleep(s):
            sleeps.append(s)
            t[0] += s

        seen = []

        class Resp(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        def urlopen(req, timeout=None):
            seen.append((t[0], req.get_header("User-agent"), req.full_url))
            t[0] += 0.1
            return Resp(b"{}")

        h = snow.Http(sleep=sleep, clock=lambda: t[0])
        with mock.patch("urllib.request.urlopen", urlopen):
            for _ in range(3):
                h.get_json("https://api.weather.gov/points/1,2")
        self.assertEqual(len(seen), 3)
        gaps = [b[0] - a[0] for a, b in zip(seen, seen[1:])]
        self.assertTrue(all(g >= 0.999 for g in gaps), gaps)
        self.assertIn("https://lanternlab2027.github.io/lab/snow/", seen[0][1])


class DryRun(Tmp):
    def test_full_dry_run_with_mocked_nws(self):
        routes, pt = fakes.default_routes()
        http = fakes.FakeHttp(routes)
        out, err = self.run_main("--fixture", FIXTURE, http=http)
        # Buffalo (both ZIPs) and Atlanta (ice, rare region) are over 50%; Denver isn't; 00000 isn't a ZIP we know.
        self.assertIn("ZIP 14201 (2 sub): Buffalo, NY 2026-12-02", out)
        self.assertIn("ZIP 00000 (1 sub): skipped: ZIP not in docs/snow/z", out)
        self.assertRegex(out, r"ZIP 80202 \(1 sub\): Denver, CO 2026-12-02: \d+% .*\n")
        self.assertNotIn("80202 (1 sub): Denver, CO 2026-12-02: 5", out.replace("ALERT", ""))
        idx = json.loads(read(self.path("outbox/index.json")))
        self.assertEqual(idx["mode"], "dry-run")
        self.assertEqual(sorted(e["zip"] for e in idx["emails"]), ["14201", "14202", "30303"])
        self.assertEqual({e["zip"]: e["recipients"] for e in idx["emails"]}["14201"], 2)
        for f in os.listdir(self.path("outbox")):
            data = read(self.path("outbox/" + f))
            self.assertNotIn("@", data, f)                     # no addresses in the dry-run output
            data.encode("ascii")
        txt = read(self.path("outbox/snow_14201.txt"))
        self.assertIn("ref=email-snow", txt)
        self.assertIn("Just for fun", txt)
        # Dry run never writes state; gridpoint cache is written.
        self.assertFalse(os.path.exists(self.path("state.json")))
        cache = json.loads(read(self.path("cache.json")))
        self.assertEqual(cache["14201"]["town"], "Buffalo, NY")
        # Shared grid cell fetched once: 4 points + 3 grids + 4 alerts.
        self.assertEqual(http.calls, 11)
        self.assertEqual(sum("/gridpoints/BUF/" in u for u in http.urls), 1)
        self.assertIn("nothing sent", err)

    def test_gridpoint_cache_reused_next_run(self):
        routes, pt = fakes.default_routes()
        self.run_main("--fixture", FIXTURE, http=fakes.FakeHttp(routes))
        http2 = fakes.FakeHttp(routes)
        self.run_main("--fixture", FIXTURE, http=http2)
        self.assertFalse(any("/points/" in u for u in http2.urls))

    def test_budget(self):
        routes, _ = fakes.default_routes()
        http = fakes.FakeHttp(routes)
        out, _ = self.run_main("--fixture", FIXTURE, "--max-zips", "1", http=http)
        self.assertEqual(out.count("over the --max-zips budget"), 4)   # all but the biggest group
        self.assertEqual(json.loads(read(self.path("outbox/index.json")))["count"], 1)

    def test_nws_error_does_not_stop_others(self):
        routes, pt = fakes.default_routes()
        routes["https://api.weather.gov/gridpoints/FFC/51,87"] = snow.HttpError(503, "x")
        out, _ = self.run_main("--fixture", FIXTURE, http=fakes.FakeHttp(routes))
        self.assertIn("ZIP 30303 (1 sub): error: HTTP 503", out)
        self.assertEqual(json.loads(read(self.path("outbox/index.json")))["count"], 2)

    def test_breaker_stops_after_repeated_nws_failures(self):
        subs = [{"id": i, "email": f"u{i}@example.com", "fields": {"snow_zip": z}}
                for i, z in enumerate(["14201", "14202", "30303", "80202", "10001", "02134", "60601", "55401"])]
        http = fakes.FakeHttp({u: snow.HttpError(0, u) for u in []})
        http.get_json = lambda url: (_ for _ in ()).throw(snow.HttpError(0, url, "blocked"))
        out_buf, err_buf = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out_buf), contextlib.redirect_stderr(err_buf):
            rc = snow.main(["--now", fakes.RUN_AT, "--state", self.path("s"), "--cache", self.path("c"),
                            "--outbox", self.path("ob")], http=http, subscribers=subs)
        self.assertEqual(rc, 1)
        self.assertEqual(out_buf.getvalue().count("error: network error (blocked)"), snow.BREAKER)
        self.assertEqual(out_buf.getvalue().count("failed 5 times in a row"), 3)

    def test_weekend_target_skipped(self):
        routes, _ = fakes.default_routes()
        out, _ = self.run_main("--fixture", FIXTURE, http=fakes.FakeHttp(routes))
        self.assertNotIn("weekend", out)
        with contextlib.redirect_stdout(io.StringIO()) as o, contextlib.redirect_stderr(io.StringIO()):
            snow.main(["--now", "2026-12-05T01:30:00Z", "--fixture", FIXTURE, "--state", self.path("s"), "--cache",
                       self.path("c"), "--outbox", self.path("ob")], http=fakes.FakeHttp(routes))   # Fri night -> Sat
        self.assertIn("2026-12-05 is a weekend", o.getvalue())

    def test_send_without_backend_stays_dry(self):
        os.environ["NOTIFY_STATE_SALT"] = "s"
        routes, _ = fakes.default_routes()
        _, err = self.run_main("--fixture", FIXTURE, "--send", http=fakes.FakeHttp(routes))
        self.assertIn("EMAIL_BACKEND=", err)
        self.assertFalse(os.path.exists(self.path("state.json")))

    def test_send_requires_salt(self):
        with self.assertRaises(SystemExit):
            self.run_main("--fixture", FIXTURE, "--send", http=fakes.FakeHttp({}))


class FakeBackend:
    name = "fake"

    def __init__(self):
        self.msgs, self.fail = [], False

    def add(self, m):
        self.msgs.append(m)

    def flush(self):
        if self.fail:
            raise RuntimeError("boom")
        return {"sent": len(self.msgs)}


class SendAndDedupe(Tmp):
    def test_alert_once_per_zip_and_date(self):
        os.environ["NOTIFY_STATE_SALT"] = "test-salt"
        routes, _ = fakes.default_routes()
        b1 = FakeBackend()
        with mock.patch.object(snow, "get_sender", lambda send, outbox, subject: snow.GroupSender(b1)):
            self.run_main("--fixture", FIXTURE, "--send", http=fakes.FakeHttp(routes))
        self.assertEqual(sorted(m.to for m in b1.msgs),
                         ["atl@example.com", "buffalo-south@example.com", "parent-a@example.com", "parent-b@example.com"])
        self.assertEqual(len({m.subject for m in b1.msgs if m.meta["zip"] == "14201"}), 1)  # one email per ZIP group
        raw = read(self.path("state.json"))
        self.assertNotIn("14201", raw)
        self.assertNotIn("example.com", raw)

        b2, http2 = FakeBackend(), fakes.FakeHttp(routes)
        with mock.patch.object(snow, "get_sender", lambda send, outbox, subject: snow.GroupSender(b2)):
            out, _ = self.run_main("--fixture", FIXTURE, "--send", http=http2)
        self.assertEqual(b2.msgs, [])
        self.assertIn("ZIP 14201 (2 sub): skipped: already alerted for 2026-12-02", out)
        self.assertFalse(any("/gridpoints/BUF/" in u for u in http2.urls))   # no NWS grid call for done ZIPs

    def test_failed_send_is_not_marked(self):
        os.environ["NOTIFY_STATE_SALT"] = "test-salt"
        routes, _ = fakes.default_routes()
        b = FakeBackend()
        b.fail = True
        with mock.patch.object(snow, "get_sender", lambda send, outbox, subject: snow.GroupSender(b)):
            with self.assertRaises(RuntimeError):
                self.run_main("--fixture", FIXTURE, "--send", http=fakes.FakeHttp(routes))
        self.assertFalse(os.path.exists(self.path("state.json")))


class KitBackend(Tmp):
    def test_kit_call_order_and_broadcast(self):
        os.environ["KIT_V4_API_KEY"] = "fake-key-for-test"
        calls = []

        def call(method, path, body=None, params=None, ok=None):
            calls.append((method, path, body, params))
            if path == "/subscribers" and method == "GET":
                if params["email_address"] == "gone@example.com":
                    return {"subscribers": []}
                return {"subscribers": [{"id": 77, "email_address": params["email_address"], "state": "active"}]}
            if path == "/broadcasts" and method == "POST":
                return {"broadcast": {"id": 5}}
            return {}

        def paged(path, key, params=None):
            if path == "/tags":
                return iter([{"name": "alert-due", "id": 1}, {"name": "snow-alert-due", "id": 42}])
            if path == "/custom_fields":
                return iter([{"key": "snow_alert_body", "label": "snow_alert_body"}])
            if path == "/broadcasts":
                return iter([{"id": 9, "description": "[alerts] 2026-12-01 (3 recipients)"}])   # notify's: ignored
            if path == "/tags/42/subscribers":
                return iter([{"id": 70}])
            raise AssertionError(path)

        k = snow.SnowKitSender("Snow day odds look high for Wednesday, Dec 2")
        k.api.call, k.api.paged = call, paged
        s = snow.GroupSender(k)
        s.add_group("14201", "subj", "text", "<p>html</p>", [{"email": "a@example.com"}, {"email": "gone@example.com"}], {})
        r = s.flush()
        self.assertEqual(r, {"sent": 1, "skipped": 1})
        seq = [(m, p) for m, p, _, _ in calls]
        self.assertEqual(seq[0], ("DELETE", "/tags/42/subscribers/70"))           # last run's tag cleared first
        self.assertIn(("PUT", "/subscribers/77"), seq)
        self.assertLess(seq.index(("PUT", "/subscribers/77")), seq.index(("POST", "/tags/42/subscribers/77")))
        self.assertNotIn(("GET", "/broadcasts/9/stats"), seq)                   # notify's broadcasts aren't ours
        bc = [b for m, p, b, _ in calls if p == "/broadcasts" and m == "POST"][0]
        self.assertIs(bc["public"], False)
        self.assertEqual(bc["subscriber_filter"], [{"all": [{"type": "tag", "ids": [42]}]}])
        self.assertEqual(bc["content"], "{{ subscriber.snow_alert_body }}")
        self.assertTrue(bc["description"].startswith("[snow-alerts]"))
        self.assertEqual(bc["subject"], "Snow day odds look high for Wednesday, Dec 2")
        put = [b for m, p, b, _ in calls if m == "PUT"][0]
        self.assertEqual(put["fields"], {"snow_alert_body": "<p>html</p>"})

    def test_kit_refuses_while_snow_broadcast_pending(self):
        os.environ["KIT_V4_API_KEY"] = "fake-key-for-test"
        k = snow.SnowKitSender("s")
        k.api.paged = lambda path, key, params=None: iter([{"id": 3, "description": "[snow-alerts] 2026-12-01 (2 recipients)"}])
        k.api.call = lambda method, path, body=None, params=None, ok=None: {"broadcast": {"stats": {"status": "scheduled"}}}
        k.add(snow.notify_sender.Message(to="a@example.com", subject="s", text="t"))
        with self.assertRaises(RuntimeError):
            k.flush()


if __name__ == "__main__":
    unittest.main()
