#!/usr/bin/env python3
"""Refresh the official LL33 energy grades embedded in docs/ll97/index.html.

DOB publishes each year's grades only as a large PDF ("LL33 Data Disclosure").
This script downloads it, parses BBL / score / grade rows, encodes them compactly
and rewrites the `const GRADES = ...;` line (and GRADES_SRC) in the page.

Usage:
  python3 bots/ll97/build_grades.py \
      --url https://www.nyc.gov/assets/buildings/pdf/ll33_Data_Disclosure_2024-CBL.pdf \
      --label "2025 label (CY2024 data)"

Needs `pdftotext` (poppler-utils). See NOTES.md.
"""
import argparse, json, pathlib, re, subprocess, sys, tempfile, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
PAGE = ROOT / "docs" / "ll97" / "index.html"
B36 = "0123456789abcdefghijklmnopqrstuvwxyz"


def b36(n):
    s = ""
    while True:
        n, r = divmod(n, 36)
        s = B36[r] + s
        if n == 0:
            return s


def grade_for(s):
    return "A" if s >= 85 else "B" if s >= 70 else "C" if s >= 55 else "D"


def parse(text):
    rows = {}
    for line in text.splitlines():
        m = re.match(r"\s*([1-5]\d{9})\s+(.*?)\s{2,}([\d,]+)\s+(\d{1,3})?\s*([ABCDFN])\s*$", line)
        if m:
            rows[m.group(1)] = (m.group(4), m.group(5))
            continue
        m = re.match(r"\s*([1-5]\d{9})\b", line)
        if m:  # wrapped row ("missing required benchmarking information"): grade at line end
            g = re.search(r"\s([ABCDFN])\s*$", line)
            rows[m.group(1)] = (None, g.group(1) if g else "?")
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--label", required=True, help='e.g. "2026 label (CY2025 data)"')
    a = ap.parse_args()
    with tempfile.TemporaryDirectory() as td:
        pdf = pathlib.Path(td) / "ll33.pdf"
        req = urllib.request.Request(a.url, headers={"User-Agent": "Mozilla/5.0"})
        pdf.write_bytes(urllib.request.urlopen(req, timeout=120).read())
        text = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], check=True, capture_output=True, text=True).stdout
    rows = parse(text)
    expected = len(re.findall(r"(?m)^\s*[1-5]\d{9}\b", text))
    bad = [k for k, (s, g) in rows.items() if g == "?" or (s is None and g != "F") or (s is not None and grade_for(int(s)) != g)]
    print(f"parsed {len(rows)} rows (expected {expected}); inconsistent: {len(bad)}", file=sys.stderr)
    if len(rows) != expected or bad:
        sys.exit("Parse check failed; inspect the PDF layout before publishing. " + json.dumps(bad[:10]))
    prev, out = 0, []
    for k in sorted(rows, key=int):
        s, g = rows[k]
        out.append(b36(int(k) - prev) + "." + (s if s is not None else "F"))
        prev = int(k)
    blob = ",".join(out)
    html = PAGE.read_text()
    html, n1 = re.subn(r'const GRADES = "[^"]*";', lambda _: f'const GRADES = "{blob}";', html)
    html, n2 = re.subn(r'const GRADES_SRC = "[^"]*";', lambda _: f'const GRADES_SRC = {json.dumps(a.label)};', html)
    if n1 != 1 or n2 != 1:
        sys.exit("Couldn't find the GRADES / GRADES_SRC lines in the page.")
    PAGE.write_text(html)
    print(f"wrote {len(blob):,} chars of grade data to {PAGE}", file=sys.stderr)


if __name__ == "__main__":
    main()
