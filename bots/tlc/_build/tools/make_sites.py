"""Assemble the NYC TLC Driver License Exam practice site into <out>/tlc.
Usage: python3 -I make_sites.py <out_dir> <hic_quiz_js>
Runs build.py (questions JSON), then fills templates.
quiz.js is built from the live docs/hic/quiz.js so the Kit unlock flow (and the public
api_key) is identical; only CONFIG, the tag URL (placeholder 25846742) and comments change.
"""
import json, pathlib, re, subprocess, sys, html
sys.dont_write_bytecode = True
TOOLS = pathlib.Path(__file__).resolve().parent
TPL = TOOLS.parent / "template"
OUT = pathlib.Path(sys.argv[1])
BASE_JS = pathlib.Path(sys.argv[2]).read_text()

DISCLAIMER = "Not affiliated with the City of New York or the NYC Taxi & Limousine Commission (TLC); study the official material."
FOOTER = ("Not affiliated with, endorsed by or approved by the City of New York or the NYC Taxi &amp; Limousine Commission (TLC), "
          "or by PSI. Questions are paraphrased from free public nyc.gov material and TLC Rules, and each one cites its source.")
S = dict(
  dir="tlc", code="TLC", tag="25846742", site="NYC TLC Exam Practice", short="NYC TLC Driver License",
  colors=("#23262b", "#8a5a00", "#f5c518", "#1a1500", "#e8b923"),
  logo='<svg class="logo" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="6" fill="#f5c518"/><path d="M5 17l2.2-5.2A2 2 0 0 1 9 10.5h10a2 2 0 0 1 1.8 1.3L23 17v3.5H5z" fill="#1a1a1a"/><rect x="11" y="6.5" width="6" height="3" rx="1" fill="#1a1a1a"/><circle cx="9" cy="20.5" r="2" fill="#f5c518" stroke="#1a1a1a" stroke-width="1.5"/><circle cx="19" cy="20.5" r="2" fill="#f5c518" stroke="#1a1a1a" stroke-width="1.5"/></svg>',
  desc="Free NYC TLC exam practice test: {n} questions on TLC rules, fares, WAV service and NYC geography, each cited to nyc.gov, plus an 80-question, 2-hour mock exam.",
  links='<a href="https://www.nyc.gov/assets/tlc/downloads/pdf/driver_education_study_guide.pdf">TLC Study Guide (PDF)</a> &middot; <a href="https://www.nyc.gov/site/tlc/drivers/driver-education.page">TLC Licensing Education</a> &middot; <a href="https://www.nyc.gov/assets/tlc/downloads/pdf/rule_book_current_chapter_80.pdf">TLC Rules Chapter 80 (PDF)</a>',
  config="""{
    code: 'TLC', storePrefix: 'tlcpractice', shortTitle: 'NYC TLC Driver License',
    subtitle: function (d) { return 'The real TLC Driver License Exam has 80 multiple-choice questions and a 2-hour limit, and you need at least 56 correct (70%) to pass. This bank has ' + d.questions.length + ' questions.'; },
    passText: '56 of 80 correct, 70%',
    mocks: [{ label: 'Full-length mock', n: 80, minutes: 120 }],
    mockNote: 'The mock exam matches the published format: 80 questions in 2 hours, with no feedback until the end. The real exam also has map and photo geography questions, and TLC does not publish how many questions come from each topic.'
  }""")
EXTRA_CSS = """
/* TLC: dark-mode accent is light, so the buy button needs dark text there */
:root { --buy-ink: #ffffff; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --buy-ink: #1a1500; } }
:root[data-theme="dark"] { --buy-ink: #1a1500; }
.btn.buy { color: var(--buy-ink); }
"""


def make_js(s):
    js = BASE_JS
    js, n1 = re.subn(r"var CONFIG = \{.*?\n  \};", lambda m: "var CONFIG = " + s["config"] + ";", js, count=1, flags=re.S)
    js, n2 = re.subn(r"var KIT_URL = 'https://api\.convertkit\.com/v3/tags/[^/']+/subscribe';",
                     "var KIT_URL = 'https://api.convertkit.com/v3/tags/" + s["tag"] + "/subscribe';", js, count=1)
    js, n3 = re.subn(r"var notConfigured = [^\n]*\n",
                     "var notConfigured = KIT_KEY === 'KIT_' + 'PUBLIC_KEY' || KIT_URL.indexOf('/TAG' + 'ID_') > -1;\n", js, count=1)
    js, n4 = re.subn(r"// Kit \(ConvertKit\) v3 tag-subscribe\. Replace [A-Z_]+ with this exam's Kit tag ID\.",
                     "// Kit (ConvertKit) v3 tag-subscribe. Replace " + s["tag"] + " with this exam's Kit tag ID.", js, count=1)
    js, n5 = re.subn(r"// Kit tag placeholder \([A-Z_]+\) not filled in yet",
                     "// Kit tag placeholder (" + s["tag"] + ") not filled in yet", js, count=1)
    assert (n1, n2, n3, n4, n5) == (1, 1, 1, 1, 1), (n1, n2, n3, n4, n5)
    assert "HIC" not in js and "hicpractice" not in js
    return js


s = S
d = OUT / s["dir"]
d.mkdir(parents=True, exist_ok=True)
r = subprocess.run([sys.executable, "-I", str(TOOLS / "build.py"), "tlc", str(d)], capture_output=True, text=True)
if r.returncode != 0:
    print(r.stdout, r.stderr); sys.exit(1)
bank = json.loads((d / "questions" / "TLC.json").read_text())
n = len(bank["questions"])
topics = {}
for q in bank["questions"]:
    topics[q["topic"]] = topics.get(q["topic"], 0) + 1
rows = "\n".join(f"<tr><td>{html.escape(t)}</td><td>{c}</td></tr>" for t, c in topics.items())
brand, accent, dbrand, dink, daccent = s["colors"]
css = (TPL / "style.css").read_text()
for a, b in (("--brand: #1f3a5f;", f"--brand: {brand};"), ("--accent: #b3261e;", f"--accent: {accent};"),
             ("--brand: #8fb3e3; --brand-ink: #0e1726; --accent: #f08a82;", f"--brand: {dbrand}; --brand-ink: {dink}; --accent: {daccent};")):
    assert a in css, a
    css = css.replace(a, b)
(d / "style.css").write_text(css + EXTRA_CSS)
(d / "quiz.js").write_text(make_js(s))
desc = s["desc"].format(n=n)
common = {"{{SHORT}}": s["short"], "{{DESC}}": desc, "{{LOGO}}": s["logo"], "{{SITE}}": s["site"],
          "{{DISCLAIMER}}": DISCLAIMER, "{{OFFICIAL_LINKS}}": s["links"], "{{FOOTER}}": FOOTER,
          "{{COUNT}}": str(n), "{{TOPIC_ROWS}}": rows, "{{CODE}}": s["code"]}
for name, src in (("quiz.html", "quiz.html"), ("index.html", "index_tlc.html")):
    t = (TPL / src).read_text()
    for k, v in common.items():
        t = t.replace(k, v)
    assert "{{" not in t, (name, t[t.index("{{"):t.index("{{") + 40])
    (d / name).write_text(t)
print("tlc", n, "questions ->", d)
