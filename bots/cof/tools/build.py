"""Verify question banks against extracted PDF text and write questions/<code>.json.

Pass 1 (automatic): structure, quote length <= 25 words, quote appears verbatim
(whitespace/punctuation-insensitive) on the cited PDF page.
Pass 2 (manual review, recorded in DROPS below): questions whose answer is not
clearly and unambiguously supported by the quote/page are dropped with a reason.
"""
import json, re, random, sys, importlib.util, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "pdf"
BASE = "https://www.nyc.gov/assets/fdny/downloads/pdf/business/"

EXAMS = {
    "F-01": dict(bank="bank_f01.py", txt="f01.raw.txt", pdf="cof-f01-noe-study-materials.pdf",
                 title="Fire Guard for Impairment (Citywide)", real_q=20, minutes=30),
    "F-03": dict(bank="bank_f03.py", txt="f03.raw.txt", pdf="cof-f03-noe-study-materials.pdf",
                 title="Indoor Place of Assembly Safety Personnel", real_q=25, minutes=38),
    "F-60": dict(bank="bank_f60.py", txt="f60.raw.txt", pdf="cof-f60-noe-study-materials.pdf",
                 title="Fire Guard for Torch Operations", real_q=25, minutes=38),
    "S-95": dict(bank="bank_s95.py", txt="s95.raw.txt", pdf="cof-s95-noe-study-materials.pdf",
                 title="Supervision of Fire Alarm Systems", real_q=35, minutes=53),
}

# Pass-2 manual drops: {exam: {question_index: reason}}
DROPS = {}
if (ROOT / "tools" / "drops.json").exists():
    DROPS = json.loads((ROOT / "tools" / "drops.json").read_text())


def norm(s):
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"[^a-z0-9]", "", s.lower())


def load(bank):
    spec = importlib.util.spec_from_file_location(bank[:-3], ROOT / "tools" / bank)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m.Q


report = {}
problems = 0
for code, cfg in EXAMS.items():
    pages = (SRC / cfg["txt"]).read_text().split("\f")
    npages = [norm(p) for p in pages]
    out, drops_auto = [], []
    rng = random.Random(code)
    qs = load(cfg["bank"])
    manual = DROPS.get(code, {})
    for i, item in enumerate(qs):
        q, opts, expl, page, quote = item[:5]
        theater = len(item) > 5 and item[5]
        errs = []
        if len(opts) != 4 or len({o.strip().lower() for o in opts}) != 4:
            errs.append("needs 4 distinct options")
        if len(quote.split()) > 25:
            errs.append(f"quote {len(quote.split())} words")
        if not (1 <= page <= len(pages)) or norm(quote) not in npages[page - 1]:
            found = [p + 1 for p, t in enumerate(npages) if norm(quote) in t]
            errs.append(f"quote not on p{page} (found on {found})")
        if errs:
            problems += 1
            drops_auto.append((i, q, errs))
            print(f"[{code} #{i}] {q[:60]}... -> {errs}")
            continue
        if str(i) in manual:
            continue
        order = list(range(4))
        rng.shuffle(order)
        entry = {
            "id": f"{code}-{len(out)+1:03d}",
            "question": q,
            "options": [opts[k] for k in order],
            "answer": order.index(0),
            "explanation": expl,
            "source": {"url": BASE + cfg["pdf"], "page": page, "quote": quote},
        }
        if theater:
            entry["theater_section"] = True
        out.append(entry)
    doc = {"exam": code, "title": cfg["title"], "real_exam_questions": cfg["real_q"],
           "real_exam_minutes": cfg["minutes"], "source_pdf": BASE + cfg["pdf"],
           "page_numbering": "PDF page index (1 = first page of the PDF file)",
           "questions": out}
    (ROOT / "questions" / f"{code}.json").write_text(json.dumps(doc, indent=1, ensure_ascii=False))
    report[code] = dict(drafted=len(qs), auto_fail=len(drops_auto), manual_drop=len(manual), final=len(out))

print(json.dumps(report, indent=1))
(ROOT / "tools" / "report.json").write_text(json.dumps(report, indent=1))
sys.exit(1 if problems else 0)
