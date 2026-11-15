#!/usr/bin/env python3
"""Make numbered contact sheets of shortlist thumbnails for visual review.
Usage: python3 contact_sheet.py <shortlist.json> <out_dir> [ids_file]
"""
import io, json, os, sys, time, urllib.request
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
rows = json.load(open(src))
if len(sys.argv) > 3:
    want = [l.strip() for l in open(sys.argv[3]) if l.strip()]
    by = {r["id"]: r for r in rows}
    rows = [by[w] for w in want if w in by]
os.makedirs(out, exist_ok=True)
cache = os.path.join(out, "thumbs"); os.makedirs(cache, exist_ok=True)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
TW, TH, COLS = 300, 230, 5
for page in range(0, len(rows), 30):
    chunk = rows[page:page + 30]
    sheet = Image.new("RGB", (COLS * TW, ((len(chunk) + COLS - 1) // COLS) * TH), "white")
    d = ImageDraw.Draw(sheet)
    for i, r in enumerate(chunk):
        lccn = r["id"].rstrip("/").split("/")[-1]
        p = os.path.join(cache, lccn + ".jpg")
        if not os.path.exists(p):
            urls = [u for u in r["images"] if "#h=" in u]
            u = sorted(urls, key=lambda x: int(x.split("w=")[-1]))
            u = [x for x in u if int(x.split("w=")[-1]) >= 300] or u
            try:
                b = urllib.request.urlopen(urllib.request.Request(u[0].split("#")[0], headers={"User-Agent": "lab-then/1.0"}), timeout=60).read()
                open(p, "wb").write(b); time.sleep(0.5)
            except Exception as e:
                print("fail", lccn, e); continue
        try:
            im = Image.open(p).convert("RGB"); im.thumbnail((TW - 6, TH - 40))
        except Exception:
            continue
        x, y = (i % COLS) * TW, (i // COLS) * TH
        sheet.paste(im, (x + 3, y + 3))
        d.text((x + 4, y + TH - 34), "%d %s %d" % (page + i, r["landmark"][:18], r["year"]), fill="red", font=font)
        d.text((x + 4, y + TH - 18), lccn[:30], fill="black", font=font)
    sheet.save(os.path.join(out, "sheet_%03d.jpg" % (page // 30)), quality=80)
    print("sheet", page // 30, len(chunk))
