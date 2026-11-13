"""fetch.py name url  -> src/<name>.(pdf|html) + src/<name>.txt (pages split by \f; HTML = 1 page)"""
import sys, subprocess, re, html, pathlib
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
SRC = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else pathlib.Path(__file__).resolve().parent.parent / "src"
name, url = sys.argv[1], sys.argv[2]
raw = SRC / (name + ".bin")
r = subprocess.run(["curl", "-sSL", "-m", "90", "-A", UA, "-o", str(raw), "-w", "%{http_code} %{content_type}", url], capture_output=True, text=True)
code, ctype = (r.stdout.split(" ", 1) + [""])[:2]
if code != "200":
    print(f"FAIL {code} {name} {url} {r.stderr.strip()}"); sys.exit(1)
if raw.read_bytes()[:4] == b"%PDF":
    raw.rename(SRC / (name + ".pdf"))
    subprocess.run(["pdftotext", "-raw", str(SRC / (name + ".pdf")), str(SRC / (name + ".txt"))])
    n = (SRC / (name + ".txt")).read_text().count("\f")
    print(f"OK pdf {name} pages~{n} {url}")
else:
    raw.rename(SRC / (name + ".html"))
    t = (SRC / (name + ".html")).read_text(errors="replace")
    t = re.sub(r"<(script|style|noscript)\b.*?</\1>", " ", t, flags=re.S | re.I)
    t = re.sub(r"<!--.*?-->", " ", t, flags=re.S)
    t = re.sub(r"<(br|p|div|li|h\d|tr)\b[^>]*>", "\n", t, flags=re.I)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    t = re.sub(r"[ \t\r]+", " ", t); t = re.sub(r"\n\s*\n+", "\n", t)
    (SRC / (name + ".txt")).write_text(t)
    print(f"OK html {name} chars={len(t)} {url}")
