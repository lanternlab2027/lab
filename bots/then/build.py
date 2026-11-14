#!/usr/bin/env python3
"""Build docs/then/schedule.json and docs/then/img/ from bots/then/picks.json.

For every pick it:
  1. re-fetches the LOC item JSON and checks the rights advisory (stops on anything
     that is not "No known restrictions...");
  2. checks the date again gives one specific year;
  3. downloads the largest service JPEG (<= ~1024px), trims a border, resizes to
     900px wide and saves under 120KB;
  4. writes the schedule in a fixed seeded shuffle (one photo per day, the whole
     list cycles, so no repeats inside any N-day window).

Run: python3 bots/then/build.py            (uses cached downloads in bots/then/data/cache/)
"""
import hashlib, io, json, os, random, re, sys, time, urllib.request, datetime
from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from curate import parse_year  # noqa: E402
from facts import fact_for  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DOCS = os.path.join(ROOT, "docs", "then")
IMG = os.path.join(DOCS, "img")
CACHE = os.environ.get("THEN_CACHE", os.path.join(HERE, "data", "cache"))
PICKS = os.path.join(HERE, "picks.json")
UA = {"User-Agent": "lab-then-builder/1.0 (static game)"}
MAX_BYTES = 118 * 1024
SEED = 20261114
# Default crop (left, top, right, bottom) per collection: removes negative numbers,
# hand-written captions and copyright lines that can give the year away.
TRIM = {
    "detroit-publishing-company": (0.08, 0.07, 0.08, 0.17),
    "bain": (0.06, 0.17, 0.06, 0.17),
    "gottscho-schleisner": (0.03, 0.06, 0.03, 0.04),
    "fsa-owi-black-and-white-negatives": (0.08, 0.14, 0.08, 0.13),
}

CREDITS = {
    "detroit-publishing-company": "Detroit Publishing Co., Library of Congress Prints and Photographs Division",
    "bain": "Bain News Service, Library of Congress Prints and Photographs Division",
    "gottscho-schleisner": "Samuel H. Gottscho / Gottscho-Schleisner Collection, Library of Congress Prints and Photographs Division",
    "fsa-owi-black-and-white-negatives": "Farm Security Administration / Office of War Information, Library of Congress Prints and Photographs Division",
}


def fetch(url, binary=False, tries=5):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                b = r.read()
            return b if binary else json.loads(b.decode("utf-8"))
        except Exception as e:
            print("   retry", i, url[:90], e, file=sys.stderr)
            time.sleep(5 * (i + 1))
    raise RuntimeError("failed " + url)


def cached(name, url, binary):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, name)
    if os.path.exists(p):
        b = open(p, "rb").read()
        return b if binary else json.loads(b)
    b = fetch(url, binary=True)
    if not binary:
        json.loads(b)
    open(p, "wb").write(b)
    time.sleep(1.5)
    return b if binary else json.loads(b)


def best_image(urls):
    best, bw = None, 0
    for u in urls:
        m = re.search(r"#h=(\d+)&w=(\d+)", u)
        if not m or not re.search(r"\.jpe?g", u):
            continue
        w = int(m.group(2))
        if w <= 1100 and w > bw:
            best, bw = u.split("#")[0], w
    return best


def best_file(meta):
    """Largest service JPEG listed in the item record (<= 1100px wide)."""
    best, bw = None, 0
    for r in meta.get("resources") or []:
        for group in r.get("files") or []:
            for f in group:
                w = f.get("width") or 0
                if f.get("mimetype") == "image/jpeg" and bw < w <= 1100 and (f.get("height") or 0) <= 1100:
                    best, bw = f["url"], w
    return best


def is_gray(im):
    s = im.convert("RGB").resize((64, 64))
    px = list(s.get_flattened_data()) if hasattr(s, 'get_flattened_data') else list(s.getdata())
    return max(max(p) - min(p) for p in px) < 18


def process(raw, trim):
    im = Image.open(io.BytesIO(raw))
    im = ImageOps.exif_transpose(im)
    w, h = im.size
    l, t, r, b = trim
    im = im.crop((int(w * l), int(h * t), int(w * (1 - r)), int(h * (1 - b))))
    gray = is_gray(im)
    im = im.convert("L" if gray else "RGB")
    if gray:
        im = ImageOps.autocontrast(im, cutoff=0.5)
    W = 900 if im.width >= im.height else 720
    if im.width > W:
        im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    for q in (82, 78, 74, 70, 66, 62, 58, 54, 50):
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
        if buf.tell() <= MAX_BYTES:
            return buf.getvalue(), im.size, q
    im = im.resize((im.width * 4 // 5, im.height * 4 // 5), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=60, optimize=True, progressive=True)
    return buf.getvalue(), im.size, 60


def loc_note(item):
    """LOC summary text (from the catalog record), if it says more than the title."""
    s = item.get("summary") or ""
    if isinstance(s, list):
        s = " ".join(s)
    s = re.sub(r"\s*\(Source: [^)]*\)\.?", "", s)
    s = re.sub(r"\s*\(Information from:[^)]*\)\.?", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) >= 30 else ""


def main():
    picks = json.load(open(PICKS))
    os.makedirs(IMG, exist_ok=True)
    out, checked_at = [], datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    keep_files = set()
    skipped = []
    for i, p in enumerate(picks):
        lccn = p["id"].rstrip("/").split("/")[-1]
        try:
            meta = cached(lccn + ".json", "https://www.loc.gov/item/%s/?fo=json" % lccn, False)
        except RuntimeError as e:
            # Rights can't be verified without the live record, so the photo is left out.
            print("SKIP (record unavailable)", lccn, e)
            skipped.append(lccn)
            continue
        item = meta.get("item", {})
        rights = item.get("rights_advisory") or ""
        if isinstance(rights, list):
            rights = " ".join(rights)
        rights = rights.strip()
        if not rights.lower().startswith("no known restrictions"):
            raise SystemExit("RIGHTS FAIL %s: %r" % (lccn, rights))
        raw_date = item.get("created_published_date") or (item.get("created_published") or [""])[0] or item.get("date")
        y = parse_year(raw_date)
        if p.get("year_override"):
            y = p["year_override"]
        if y != p["year"]:
            raise SystemExit("YEAR MISMATCH %s: item says %r (%s), pick says %s" % (lccn, raw_date, y, p["year"]))
        img_url = best_file(meta) or best_image(p.get("images") or [])
        if not img_url:
            raise SystemExit("NO IMAGE " + lccn)
        raw = cached(lccn + "." + hashlib.sha1(img_url.encode()).hexdigest()[:8] + ".jpg", img_url, True)
        jpg, size, q = process(raw, p.get("trim") or TRIM[p["coll"]])
        fname = hashlib.sha1(("then:" + lccn).encode()).hexdigest()[:12] + ".jpg"
        open(os.path.join(IMG, fname), "wb").write(jpg)
        keep_files.add(fname)
        rights_full = rights
        out.append({
            "id": lccn,
            "title": (item.get("title") or p["title"]).strip(),
            "year": y,
            "date_loc": str(raw_date),
            "place": p["place"],
            "borough": p["borough"],
            "ok": p["ok"],
            "url": "https://www.loc.gov/item/%s/" % lccn,
            "rights": rights_full,
            "rights_checked": checked_at,
            "credit": CREDITS[p["coll"]],
            "caption": (item.get("title") or p["title"]).strip(),
            "loc_note": loc_note(item),
            "fact": fact_for(p["place"]) or "",
            "file": fname,
            "w": size[0], "h": size[1],
        })
        print("%3d %s %d %-28s %3dKB q%d %s" % (i + 1, lccn, y, p["place"][:28], len(jpg) // 1024, q, rights[:40]))
    for f in os.listdir(IMG):
        if f not in keep_files:
            os.remove(os.path.join(IMG, f))
    rnd = random.Random(SEED)
    order = list(range(len(out)))
    rnd.shuffle(order)
    # Spread decades and landmarks: avoid the same place two days running.
    photos = [out[k] for k in order]
    for _ in range(5):
        for j in range(1, len(photos)):
            if photos[j]["place"] == photos[j - 1]["place"]:
                k = (j + 7) % len(photos)
                photos[j], photos[k] = photos[k], photos[j]
    years = [p["year"] for p in out]
    sched = {
        "version": 1,
        "epoch": "2026-11-14",
        "note": "Day N shows photos[(N-1) % len(photos)]. Day 1 = epoch (America/New_York). Append new photos only at the end of a cycle.",
        "minYear": 1890,
        "maxYear": ((max(years) + 9) // 10) * 10,
        "photos": photos,
    }
    json.dump(sched, open(os.path.join(DOCS, "schedule.json"), "w"), indent=1, ensure_ascii=False)
    print("wrote", len(photos), "photos; years", min(years), "-", max(years), "; skipped", skipped)


if __name__ == "__main__":
    main()
