#!/usr/bin/env python3
"""Harvest candidate NYC photos from the loc.gov JSON API.

Writes bots/then/data/candidates.json (raw search hits, de-duplicated by item id).
Run: python3 bots/then/harvest.py
"""
import json, os, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("THEN_CANDIDATES", os.path.join(HERE, "data", "candidates.json"))
UA = {"User-Agent": "lab-then-harvester/1.0 (static game; contact via repo)"}

COLLECTIONS = {
    "detroit-publishing-company": [
        "new york n.y.", "brooklyn bridge", "broadway new york", "fifth avenue new york",
        "central park new york", "coney island", "wall street new york", "flatiron",
        "madison square new york", "herald square", "times building", "battery new york",
        "riverside drive", "grant's tomb", "city hall new york", "brooklyn n.y.",
        "bronx", "williamsburg bridge", "statue of liberty", "union square new york",
        "park row", "washington arch", "luna park", "dreamland", "metropolitan museum",
        "columbia university", "prospect park", "grand central", "hippodrome", "bowery",
    ],
    "bain": [
        "times square", "brooklyn bridge", "fifth avenue", "coney island", "wall street",
        "flatiron", "central park", "broadway", "grand central", "woolworth",
        "polo grounds", "ebbets field", "penn station", "statue of liberty", "city hall",
        "manhattan bridge", "queensboro bridge", "hester street", "mulberry street",
        "union square", "battery park", "madison square", "herald square", "bronx zoo",
        "public library", "singer building", "hell gate", "subway new york", "elevated new york",
        "st. patrick's", "washington square",
    ],
    "gottscho-schleisner": [
        "rockefeller center", "empire state", "chrysler building", "times square",
        "brooklyn bridge", "world's fair", "central park", "fifth avenue", "radio city",
        "george washington bridge", "manhattan skyline", "park avenue", "grand central",
        "triborough bridge", "rockefeller plaza", "battery", "fulton fish market",
        "washington square", "columbus circle", "jones beach", "brooklyn", "queens",
    ],
    "fsa-owi-black-and-white-negatives": [
        "times square", "fulton fish market", "brooklyn bridge", "coney island",
        "rockefeller center", "pennsylvania station", "grand central", "bowery",
        "wall street", "harlem", "fifth avenue", "east river", "central park",
    ],
}


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # rate limits come back as HTML/429
            print("  retry", i, e, file=sys.stderr)
            time.sleep(6 * (i + 1))
    return None


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    seen = {}
    if os.path.exists(OUT):
        for r in json.load(open(OUT)):
            seen[r["id"]] = r
    only = sys.argv[1:]
    for coll, queries in COLLECTIONS.items():
        if only and coll not in only:
            continue
        for q in queries:
            for sp in (1, 2):
                url = (f"https://www.loc.gov/collections/{coll}/?"
                       + urllib.parse.urlencode({"q": q, "fo": "json", "c": 100, "sp": sp}))
                d = get(url)
                time.sleep(3)
                if not d or "results" not in d:
                    print("skip", coll, q, sp)
                    break
                n = 0
                for r in d["results"]:
                    if not r.get("id") or not r.get("image_url"):
                        continue
                    r["_coll"] = coll
                    r["_q"] = q
                    if r["id"] not in seen:
                        seen[r["id"]] = r
                        n += 1
                print(f"{coll:40s} {q:28s} p{sp}: +{n} (total {len(seen)})")
                if not d.get("pagination", {}).get("next"):
                    break
        json.dump(list(seen.values()), open(OUT, "w"))
    print("done", len(seen))


if __name__ == "__main__":
    main()
