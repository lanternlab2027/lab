"""Parity: snow_model.py must compute exactly what docs/snow/model.js computes.

Runs node on tests/parity_cases.js (shared fixtures: bots/snow/fixtures.js plus 400 seeded random
grids) and checks the window, the extracted inputs and the odds result for every case.
Run: python3 -m unittest discover -s bots/snow_alerts/tests -v
"""
import json, os, shutil, subprocess, sys, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import snow_model as M  # noqa: E402


def num_eq(a, b):
    if isinstance(a, bool) or isinstance(b, bool) or a is None or b is None:
        return a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return float(a) == float(b)
    return a == b


class Parity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        node = shutil.which("node")
        if not node:
            raise unittest.SkipTest("node is not installed")
        out = subprocess.run([node, os.path.join(HERE, "parity_cases.js")], capture_output=True, text=True, check=True)
        cls.cases = json.loads(out.stdout)["cases"]

    def assertSame(self, js, py, where):
        if isinstance(js, dict):
            self.assertEqual(set(js), set(py), where)
            for k in js:
                self.assertSame(js[k], py[k], f"{where}.{k}")
        elif isinstance(js, list):
            self.assertEqual(len(js), len(py), where)
            for i, (a, b) in enumerate(zip(js, py)):
                self.assertSame(a, b, f"{where}[{i}]")
        else:
            self.assertTrue(num_eq(js, py), f"{where}: js={js!r} py={py!r}")

    def test_enough_cases(self):
        self.assertGreater(len(self.cases), 400)
        chances = {c["res"]["chance"] for c in self.cases}
        self.assertTrue(any(x >= 50 for x in chances) and any(x < 10 for x in chances), "fixtures should span the range")

    def test_every_case_matches(self):
        for c in self.cases:
            with self.subTest(case=c["name"]):
                win = M.target_window(c["now"], c["tz"])
                self.assertSame(c["win"], win, c["name"] + ":win")
                inp = M.extract(c["grid"], c["alerts"], win)
                self.assertSame(c["inp"], inp, c["name"] + ":inp")
                res = M.odds(inp, c["region"])
                self.assertSame(c["res"], res, c["name"] + ":res")

    def test_js_number_helpers(self):
        self.assertEqual(M.js_round(2.5), 3)
        self.assertEqual(M.js_round(-2.5), -2)
        self.assertEqual(M.js_round(0.49999999999999994), 0)
        self.assertEqual(M.js_to_fixed(12.5, 0), "13")
        self.assertEqual(M.js_to_fixed(1.0, 1), "1.0")
        self.assertEqual(M.js_num_str(1.0), "1")
        self.assertEqual(M.js_num_str(0.3), "0.3")


if __name__ == "__main__":
    unittest.main()
