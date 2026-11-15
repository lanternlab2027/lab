#!/usr/bin/env python3
"""Harvest candidate Chicago photos from the loc.gov JSON API.

Adapted from bots/then/harvest.py (NYC Then). Pages through every "chicago" hit
in each collection, plus a few targeted queries, and de-duplicates by item id.
Saves after every page, so it can be re-run after an interruption (it resumes
from what is already in the output file and skips finished query/page pairs).

Output: $CHI_CANDIDATES (default bots/chicago-then/data/candidates.json)
Run:    python3 bots/chicago-then/harvest.py [collection ...]
"""
import json, os, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("CHI_CANDIDATES", os.path.join(HERE, "data", "candidates.json"))
DONE = OUT + ".done"
UA = {"User-Agent": "lab-then-harvester/1.0 (static game; contact via repo)"}

# collection slug -> queries. "chicago" pages through every hit.
COLLECTIONS = {
    "detroit-publishing-company": ["chicago"],
    "bain": ["chicago"],
    "fsa-owi-black-and-white-negatives": ["chicago"],
    "fsa-owi-color-photographs": ["chicago"],
    "gottscho-schleisner": ["chicago"],
    "national-photo-company": ["chicago"],
    "harris-ewing": ["chicago"],
    "historic-american-buildings-landscapes-and-engineering-records": ["chicago"],
    "panoramic-photographs": ["chicago"],
}
MAX_PAGES = 40


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
    done = set(open(DONE).read().split("\n")) if os.path.exists(DONE) else set()
    only = sys.argv[1:]
    for coll, queries in COLLECTIONS.items():
        if only and coll not in only:
            continue
        for q in queries:
            fails = 0
            for sp in range(1, MAX_PAGES + 1):
                key = "%s|%s|%d" % (coll, q, sp)
                if key in done:
                    continue
                url = (f"https://www.loc.gov/collections/{coll}/?"
                       + urllib.parse.urlencode({"q": q, "fo": "json", "c": 100, "sp": sp}))
                d = get(url)
                time.sleep(3)
                if not d or "results" not in d:
                    # Some 100-item pages 404 persistently (one bad record). Fetch the
                    # same range as four 25-item pages so only the bad slice is lost.
                    got = 0
                    for sub in range((sp - 1) * 4 + 1, sp * 4 + 1):
                        dd = get(f"https://www.loc.gov/collections/{coll}/?"
                                 + urllib.parse.urlencode({"q": q, "fo": "json", "c": 25, "sp": sub}), tries=2)
                        time.sleep(3)
                        for r in (dd or {}).get("results") or []:
                            if r.get("id") and r.get("image_url") and r["id"] not in seen:
                                r["_coll"] = coll; r["_q"] = q; seen[r["id"]] = r; got += 1
                    if got:
                        print(f"{coll:40s} {q:20s} p{sp}: +{got} via 25-item pages (total {len(seen)})", flush=True)
                        json.dump(list(seen.values()), open(OUT, "w"))
                        with open(DONE, "a") as f:
                            f.write(key + "\n")
                        fails = 0
                        continue
                    print("skip", coll, q, sp, flush=True)
                    fails += 1
                    if fails >= 3:
                        break
                    continue
                fails = 0
                n = 0
                for r in d["results"]:
                    if not r.get("id") or not r.get("image_url"):
                        continue
                    r["_coll"] = coll
                    r["_q"] = q
                    if r["id"] not in seen:
                        seen[r["id"]] = r
                        n += 1
                print(f"{coll:40s} {q:20s} p{sp}: +{n} (total {len(seen)})", flush=True)
                json.dump(list(seen.values()), open(OUT, "w"))
                with open(DONE, "a") as f:
                    f.write(key + "\n")
                if not d.get("pagination", {}).get("next"):
                    break
    print("done", len(seen))


if __name__ == "__main__":
    main()
