"""Verify question banks against fetched official source text and write questions/<code>.json.

Usage: python3 -I build.py <hic|ps> <out_site_dir>

Pass 1 (automatic): 4 distinct options, quote <= 25 words, quote appears verbatim
(whitespace/punctuation-insensitive) on the cited PDF page, or anywhere on the cited
HTML page (HTML pages have page=None).
Pass 2 (manual review): drops recorded in drops.json {exam: {index: reason}}.
"""
import json, re, random, sys, importlib.util, pathlib
sys.dont_write_bytecode = True

TOOLS = pathlib.Path(__file__).resolve().parent
ROOT = TOOLS.parent
SRC = ROOT / "src"

EXAMS = {
    "hic": dict(code="HIC", bank="bank_hic.py", title="NYC Home Improvement Contractor License Exam",
                real_q=30, real_pass=21, minutes=None, mock_q=30, mock_minutes=None),
    "ps": dict(code="PS", bank="bank_ps.py", title="NYC Process Server Individual License Exam",
               real_q=35, real_pass=25, minutes=None, mock_q=35, mock_minutes=None),
}


def norm(s):
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace("ﬁ", "fi").replace("ﬂ", "fl")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def load(bank):
    spec = importlib.util.spec_from_file_location(bank[:-3], TOOLS / bank)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def src_name(url):
    # map URL -> fetched file stem via sources.json
    return SOURCE_FILES[url]


SOURCE_FILES = json.loads((TOOLS / "sources.json").read_text())

exam = sys.argv[1]
out_dir = pathlib.Path(sys.argv[2])
cfg = EXAMS[exam]
mod = load(cfg["bank"])
drops = json.loads((TOOLS / "drops.json").read_text()).get(exam, {}) if (TOOLS / "drops.json").exists() else {}

cache = {}
def pages_for(url):
    if url not in cache:
        stem = SOURCE_FILES[url]
        txt = (SRC / (stem + ".txt")).read_text(errors="replace")
        cache[url] = [norm(p) for p in txt.split("\f")]
    return cache[url]

rng = random.Random(exam)
out, fails = [], []
for i, item in enumerate(mod.Q):
    topic, q, opts, expl, key, page, quote = item
    url, stitle = mod.SOURCES[key]
    errs = []
    if len(opts) != 4 or len({o.strip().lower() for o in opts}) != 4:
        errs.append("needs 4 distinct options")
    if len(quote.split()) > 25:
        errs.append(f"quote {len(quote.split())} words")
    pg = pages_for(url)
    nq = norm(quote)
    if page is None:
        if len(pg) > 1 and url.endswith(".pdf"):
            errs.append("pdf source needs a page number")
        elif not any(nq in p for p in pg):
            errs.append("quote not found on page")
    else:
        if not (1 <= page <= len(pg)) or nq not in pg[page - 1]:
            found = [n + 1 for n, t in enumerate(pg) if nq in t]
            errs.append(f"quote not on p{page} (found on {found})")
    if errs:
        fails.append(i)
        print(f"[{exam} #{i}] {q[:70]} -> {errs}")
        continue
    if str(i) in drops:
        continue
    order = list(range(4))
    rng.shuffle(order)
    out.append({
        "id": f"{cfg['code']}-{len(out)+1:03d}",
        "topic": topic,
        "question": q,
        "options": [opts[k] for k in order],
        "answer": order.index(0),
        "explanation": expl,
        "source": {"url": url, "title": stitle, "page": page, "quote": quote},
    })

doc = {"exam": cfg["code"], "title": cfg["title"], "real_exam_questions": cfg["real_q"],
       "real_exam_pass": cfg["real_pass"], "real_exam_minutes": cfg["minutes"],
       "mock_questions": cfg["mock_q"], "mock_minutes": cfg["mock_minutes"],
       "page_numbering": "PDF page index (1 = first page of the PDF file); null for HTML pages",
       "questions": out}
(out_dir / "questions").mkdir(parents=True, exist_ok=True)
(out_dir / "questions" / f"{cfg['code']}.json").write_text(json.dumps(doc, indent=1, ensure_ascii=False))
topics = {}
for e in out:
    topics[e["topic"]] = topics.get(e["topic"], 0) + 1
rep = dict(drafted=len(mod.Q), auto_fail=len(fails), manual_drop=len(drops), final=len(out), topics=topics)
print(json.dumps(rep, indent=1))
(TOOLS / f"report_{exam}.json").write_text(json.dumps(rep, indent=1))
sys.exit(1 if fails else 0)
