"""Assemble the HIC and Process Server static sites into <out>/hic and <out>/processserver.
Usage: python3 -I make_sites.py <out_dir> <guide_quiz_js>
Runs build.py for each exam (questions JSON), then fills templates.
quiz.js is built from the live docs/guide/quiz.js so the Kit unlock flow (and the public
api_key) is identical; only CONFIG, the tag placeholder and the not-configured check change.
"""
import json, pathlib, re, subprocess, sys, html
sys.dont_write_bytecode = True
TOOLS = pathlib.Path(__file__).resolve().parent
TPL = TOOLS.parent / "template"
OUT = pathlib.Path(sys.argv[1])
GUIDE_JS = pathlib.Path(sys.argv[2]).read_text()

DISCLAIMER = "Not affiliated with the City of New York or NYC DCWP; study the official material."
FOOTER = ("Not affiliated with, endorsed by or approved by the City of New York or the NYC Department of Consumer and Worker "
          "Protection (DCWP). Questions are paraphrased from free public nyc.gov material, and each one cites its source page.")
SITES = {
 "hic": dict(
  dir="hic", code="HIC", tag="TAGID_HIC", site="NYC HIC Exam Practice", short="NYC Home Improvement Contractor",
  colors=("#7a3e12", "#1d4ed8", "#f0b27a", "#2a1405", "#93b4f5"),
  logo='<svg class="logo" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="6" fill="#7a3e12"/><path d="M6 14l8-7 8 7M9 12v9h10v-9" stroke="#fff" stroke-width="2.2" fill="none" stroke-linejoin="round"/><rect x="12.5" y="16" width="3" height="5" fill="#f59e0b"/></svg>',
  desc="Free practice questions for the NYC DCWP Home Improvement Contractor license exam, each cited to an official nyc.gov source.",
  links='<a href="https://www.nyc.gov/assets/dca/downloads/pdf/businesses/Home-Improvement-Business-Exam-Guide.pdf">Official Examination Guide (PDF)</a> &middot; <a href="https://www.nyc.gov/site/dca/businesses/license-checklist-home-improvement-contractor.page">DCWP license checklist</a>',
  config="""{
    code: 'HIC', storePrefix: 'hicpractice', shortTitle: 'NYC Home Improvement Contractor',
    subtitle: function (d) { return 'The real DCWP exam has 30 multiple-choice questions and you need at least 21 correct (70%) to pass. DCWP does not publish a time limit. This bank has ' + d.questions.length + ' questions.'; },
    passText: '21 of 30 correct, 70%',
    mocks: [{ label: 'Full-length mock', n: 30, minutes: 30 }],
    mockNote: 'The mock exam has 30 questions, like the real exam. DCWP publishes no time limit, so the mock timer uses a practice pace of one minute per question.'
  }"""),
 "ps": dict(
  dir="processserver", code="PS", tag="TAGID_PS", site="NYC Process Server Exam Practice", short="NYC Process Server",
  colors=("#3b3355", "#b91c1c", "#c4b5fd", "#1b1530", "#f19a9a"),
  logo='<svg class="logo" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="6" fill="#3b3355"/><path d="M8 6h9l4 4v12H8z" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M11 14h7M11 18h5" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>',
  desc="Free practice questions for the NYC DCWP Process Server Individual license exam, each cited to DCWP's official Educational Materials.",
  links='<a href="https://www.nyc.gov/assets/dca/downloads/pdf/businesses/Process-Server-Educational-Materials.pdf">Official Educational Materials (PDF)</a> &middot; <a href="https://www.nyc.gov/site/dca/businesses/license-checklist-process-server-individual.page">DCWP license checklist</a>',
  config="""{
    code: 'PS', storePrefix: 'pspractice', shortTitle: 'NYC Process Server',
    subtitle: function (d) { return 'The real DCWP exam has 35 multiple-choice questions and you need at least 25 correct (about 71%) to pass. DCWP does not publish a time limit. This bank has ' + d.questions.length + ' questions.'; },
    passText: '25 of 35 correct, about 71%',
    mocks: [{ label: 'Full-length mock', n: 35, minutes: 35 }],
    mockNote: 'The mock exam has 35 questions, like the real exam. DCWP publishes no time limit, so the mock timer uses a practice pace of one minute per question.'
  }"""),
}


def make_js(s):
    js = GUIDE_JS
    js, n1 = re.subn(r"var CONFIG = \{.*?\n  \};", lambda m: "var CONFIG = " + s["config"] + ";", js, count=1, flags=re.S)
    js, n2 = re.subn(r"var KIT_URL = 'https://api\.convertkit\.com/v3/tags/[^/']+/subscribe';",
                     "var KIT_URL = 'https://api.convertkit.com/v3/tags/" + s["tag"] + "/subscribe';", js, count=1)
    js, n3 = re.subn(r"var notConfigured = [^\n]*\n",
                     "var notConfigured = KIT_KEY === 'KIT_' + 'PUBLIC_KEY' || KIT_URL.indexOf('/TAG' + 'ID_') > -1;\n", js, count=1)
    js = js.replace("// Kit (ConvertKit) v3 tag-subscribe. Replace TAGID with this exam's Kit tag ID.",
                    "// Kit (ConvertKit) v3 tag-subscribe. Replace " + s["tag"] + " with this exam's Kit tag ID.")
    js = js.replace("// Kit tag placeholder not filled in yet, so unlock anyway (honor system).",
                    "// Kit tag placeholder (" + s["tag"] + ") not filled in yet, so unlock anyway (honor system).")
    assert (n1, n2, n3) == (1, 1, 1), (s["code"], n1, n2, n3)
    return js


for key, s in SITES.items():
    d = OUT / s["dir"]
    d.mkdir(parents=True, exist_ok=True)
    r = subprocess.run([sys.executable, "-I", str(TOOLS / "build.py"), key, str(d)], capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout, r.stderr); sys.exit(1)
    bank = json.loads((d / "questions" / f"{s['code']}.json").read_text())
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
    (d / "style.css").write_text(css)
    (d / "quiz.js").write_text(make_js(s))
    common = {"{{SHORT}}": s["short"], "{{DESC}}": s["desc"], "{{LOGO}}": s["logo"], "{{SITE}}": s["site"],
              "{{DISCLAIMER}}": DISCLAIMER, "{{OFFICIAL_LINKS}}": s["links"], "{{FOOTER}}": FOOTER,
              "{{COUNT}}": str(n), "{{TOPIC_ROWS}}": rows, "{{CODE}}": s["code"]}
    for name, src in (("quiz.html", "quiz.html"), ("index.html", f"index_{key}.html")):
        t = (TPL / src).read_text()
        for k, v in common.items():
            t = t.replace(k, v)
        assert "{{" not in t, (key, name, t[t.index("{{"):t.index("{{") + 40])
        (d / name).write_text(t)
    print(key, n, "questions ->", d)
