#!/usr/bin/env python3
"""Building pages generator: one static, crawlable page per NYC building.

Stage 1 (fetch): picks a pilot set of buildings, the ones with the most open HPD
violations plus HPD complaints received in the last 12 months, and pulls aggregate
facts for each from NYC Open Data (Socrata SODA, no key needed). Results are cached
as JSON so rendering can be re-run offline.

Stage 2 (render): writes docs/b/{bbl}.html for every building, borough and
neighborhood index pages, docs/sitemap-buildings.xml and docs/sitemap-index.xml.

Privacy: only building-level facts are published. The generator never selects owner,
agent or ECB respondent names. It fetches HPD violation descriptions solely to sort
them into broad categories in memory. The descriptions can contain apartment numbers
and occasionally a person's name, so their text is never written to a page.

Usage:
  python3 build.py fetch  [--limit 500]      # query NYC Open Data -> .cache/data.json
  python3 build.py render                    # .cache/data.json -> docs/b/*.html + sitemaps
  python3 build.py all    [--limit 500]

Standard library only.
"""
import argparse, collections, concurrent.futures as cf, datetime as dt, html, json, os, re, sys, time
import urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
DOCS = os.path.join(REPO, "docs")
OUT = os.path.join(DOCS, "b")
CACHE = os.path.join(HERE, ".cache", "data.json")

SITE = "https://lanternlab2027.github.io/lab/"
LOOKUP = "../buildingwatch/lookup.html"
API = "https://data.cityofnewyork.us/resource/"
APP_TOKEN = os.environ.get("SOCRATA_APP_TOKEN")

DS = {
    "pluto": "64uk-42ks", "footprints": "5zhs-2jue", "hpd_reg": "tesw-yqqr",
    "hpd_viol": "wvxf-dwi5", "hpd_comp": "ygpa-z7cr", "dob_viol": "3h2n-5cm9",
    "ecb": "6bgk-3dad", "aep": "hcir-3275",
}
DS_NAMES = {
    "hpd_viol": "HPD Housing Maintenance Code Violations", "hpd_comp": "HPD Complaints and Problems",
    "ecb": "DOB ECB Violations", "dob_viol": "DOB Violations", "hpd_reg": "HPD Multiple Dwelling Registrations",
    "pluto": "Primary Land Use Tax Lot Output (PLUTO)", "aep": "HPD Alternative Enforcement Program buildings",
}
BORO = {"1": "Manhattan", "2": "Bronx", "3": "Brooklyn", "4": "Queens", "5": "Staten Island"}
BORO_SLUG = {k: v.lower().replace(" ", "-") for k, v in BORO.items()}
BORO_IN = {"1": "Manhattan", "2": "the Bronx", "3": "Brooklyn", "4": "Queens", "5": "Staten Island"}

HPD_CLEAR = "https://www.nyc.gov/site/hpd/services-and-information/clear-violations.page"
HPD_ONLINE = "https://hpdonline.nyc.gov/hpdonline/"
BATCH = 40


# ----------------------------------------------------------------------------- fetch

def soda(ds, params, retries=4):
    url = API + DS[ds] + ".json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "lantern-lab-building-pages/0.1"})
    if APP_TOKEN:
        req.add_header("X-App-Token", APP_TOKEN)
    for i in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)
        except Exception as e:
            if i == retries - 1:
                raise RuntimeError(f"SODA query failed for {ds}: {e}") from e
            time.sleep(3 * (i + 1))


def soda_all(ds, params, page=50000):
    out, off = [], 0
    while True:
        rows = soda(ds, {**params, "$limit": page, "$offset": off})
        out += rows
        if len(rows) < page:
            return out
        off += page


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def inlist(vals):
    return ",".join(q(v) for v in vals)


def chunks(xs, n):
    for i in range(0, len(xs), n):
        yield xs[i:i + n]


def norm_bbl(v):
    try:
        s = str(int(float(v)))
    except (TypeError, ValueError):
        return None
    return s if len(s) == 10 and s[0] in "12345" else None


def select_pilot(limit, since12):
    """Union of the top buildings by open HPD violations and by 12-month complaints,
    re-counted exactly for both metrics, then ranked by the sum."""
    pool = max(limit * 2, 1000)
    a = soda("hpd_viol", {"$select": "bbl,count(*) as n", "$where": "violationstatus='Open' AND bbl IS NOT NULL",
                          "$group": "bbl", "$order": "n DESC", "$limit": pool})
    b = soda("hpd_comp", {"$select": "bbl,count(distinct complaint_id) as n",
                          "$where": f"received_date >= {q(since12)} AND bbl IS NOT NULL",
                          "$group": "bbl", "$order": "n DESC", "$limit": pool})
    cand = sorted({x for x in (norm_bbl(r.get("bbl")) for r in a + b) if x})
    open_n, comp_n = collections.Counter(), collections.Counter()

    def count(batch):
        r1 = soda("hpd_viol", {"$select": "bbl,count(*) as n", "$where": f"violationstatus='Open' AND bbl in ({inlist(batch)})",
                               "$group": "bbl", "$limit": 5000})
        r2 = soda("hpd_comp", {"$select": "bbl,count(distinct complaint_id) as n",
                               "$where": f"received_date >= {q(since12)} AND bbl in ({inlist(batch)})",
                               "$group": "bbl", "$limit": 5000})
        return r1, r2

    with cf.ThreadPoolExecutor(4) as ex:
        for r1, r2 in ex.map(count, list(chunks(cand, 100))):
            for r in r1:
                open_n[norm_bbl(r["bbl"])] += int(r["n"])
            for r in r2:
                comp_n[norm_bbl(r["bbl"])] += int(r["n"])
    ranked = sorted(cand, key=lambda x: (-(open_n[x] + comp_n[x]), x))
    print(f"candidates {len(cand)}; picking {limit}", file=sys.stderr, flush=True)
    return ranked[:limit]


# Violation categories: keyword rules over HPD's templated order text (first match wins).
# Order matters, e.g. lead paint before plaster/paint, window guards before windows.
CATS = [
    ("mold", "Mold", [r"\bMOLD\b"]),
    ("lead", "Lead-based paint", [r"LEAD-BASED PAINT", r"LEAD BASED PAINT", r"\bLEAD\b"]),
    ("heat", "Heat and hot water", [r"SUPPLY OF HEAT", r"HOT WATER", r"HEATING SYSTEM", r"\bBOILER\b"]),
    ("leak", "Leaks and water damage", [r"WATER LEAK", r"WILL NOT LEAK", r"ROOF LEAK", r"LEAKING ROOF"]),
    ("roach", "Roaches", [r"ROACH"]),
    ("mice", "Mice", [r"\bMICE\b"]),
    ("rats", "Rats", [r"\bRATS?\b"]),
    ("bedbug_paper", "Bedbug report filing", [r"BEDBUG REPORT", r"BED BUG REPORT"]),
    ("bedbug", "Bedbugs", [r"BEDBUG", r"BED BUG"]),
    ("pests", "Other pests", [r"INFESTATION", r"\bPESTS?\b", r"\bPIGEON", r"VERMIN"]),
    ("detector", "Smoke and carbon monoxide detectors", [r"SMOKE DETECT", r"CARBON MONOXIDE"]),
    ("guard", "Window guards", [r"WINDOW GUARD"]),
    ("selfclose", "Self-closing doors", [r"SELF-CLOSING", r"SELF CLOSING"]),
    ("egress", "Fire escapes and blocked exits", [r"FIRE ESCAPE", r"EGRESS", r"ENCUMBRANCE", r"\bEXIT\b"]),
    ("plaster", "Plaster and paint", [r"PLASTER", r"\bPAINT\b"]),
    ("plumb", "Plumbing and fixtures", [r"FAUCET", r"WASTE LINE", r"WASTE PIPE", r"WATER CLOSET", r"\bSINK\b", r"BATHTUB",
                                        r"TOILET", r"PLUMBING", r"WASHBASIN", r"DRAIN", r"WATER SUPPLY", r"COLD WATER", r"OBSTRUCTIONS AND REPAIR", r"\bLEAKY\b"]),
    ("elec", "Electrical", [r"ELECTRIC", r"OUTLET", r"OUTLIT", r"LIGHT FIXTURE", r"LIGHTING", r"LIGHT OR LIGHTS", r"\bWIRING\b", r"\bSWITCH", r"INTERCOM", r"BUZZER"]),
    ("gas", "Gas supply", [r"SUPPLY OF GAS", r"\bGAS\b"]),
    ("garbage", "Garbage and cleanliness", [r"REFUSE", r"RUBBISH", r"CLEAN CONDITION", r"GARBAGE", r"TRASH", r"COMPACTOR"]),
    ("paper", "Required notices and filings", [r"\bPOST\b", r"\bFILE\b", r"REGISTRATION", r"\bNOTICE\b", r"\bREGISTER\b"]),
    ("window", "Windows", [r"WINDOW", r"\bSASH"]),
    ("door", "Doors and locks", [r"\bDOORS?\b", r"\bLOCKS?\b"]),
    ("floor", "Floors, stairs and railings", [r"FLOOR", r"TREAD", r"STAIR", r"BALUSTER", r"RAILING", r"HANDRAIL", r"STOOP"]),
    ("ceiling", "Ceilings and walls", [r"CEILING", r"\bWALLS?\b"]),
    ("appl", "Appliances", [r"REFRIGERATOR", r"\bRANGE\b", r"\bSTOVE\b", r"\bOVEN\b"]),
]
CATS_RX = [(k, lab, re.compile("|".join(p))) for k, lab, p in CATS]
CAT_LABEL = {k: lab for k, lab, _ in CATS}
CAT_LABEL["other"] = "Other repairs"


def categorize(desc):
    d = (desc or "").upper()
    # Drop the location tail ("LOCATED AT APT ...", "IN THE KITCHEN ...") where possible, so a
    # mention of a window or wall as the *place* doesn't decide the category.
    head = re.split(r"\bLOCATED AT\b|, SECTION ''", d)[0]
    for k, _, rx in CATS_RX:
        if rx.search(head):
            return k
    return "other"


def fetch_batch(bbls, since12, since24):
    L = inlist(bbls)
    res = {b: {"bbl": b} for b in bbls}

    pl = soda("pluto", {"$select": "bbl,address,zipcode,unitsres,unitstotal,yearbuilt,numfloors,numbldgs,bldgclass",
                        "$where": f"bbl in ({L}) OR bbl in ({inlist(b + '.00000000' for b in bbls)})", "$limit": 5000})
    for r in pl:
        b = norm_bbl(r.get("bbl"))
        if b in res:
            res[b]["pluto"] = {k: r.get(k) for k in ("address", "zipcode", "unitsres", "unitstotal", "yearbuilt",
                                                      "numfloors", "numbldgs", "bldgclass")}

    # Open HPD violations by class, plus rent-impairing and oldest open.
    for r in soda("hpd_viol", {"$select": "bbl,class,count(*) as n,min(novissueddate) as oldest",
                               "$where": f"violationstatus='Open' AND bbl in ({L})", "$group": "bbl,class", "$limit": 5000}):
        b = norm_bbl(r["bbl"]); d = res[b].setdefault("open_class", {})
        d[r.get("class") or "?"] = int(r["n"])
        o = (r.get("oldest") or "")[:10]
        if o and (not res[b].get("oldest_open") or o < res[b]["oldest_open"]):
            res[b]["oldest_open"] = o
    for r in soda("hpd_viol", {"$select": "bbl,count(*) as n", "$where": f"violationstatus='Open' AND rentimpairing='Y' AND bbl in ({L})",
                               "$group": "bbl", "$limit": 5000}):
        res[norm_bbl(r["bbl"])]["rent_impairing"] = int(r["n"])
    # Issued in the last 12 months by class, and the 12 months before that.
    for r in soda("hpd_viol", {"$select": "bbl,class,count(*) as n", "$where": f"novissueddate >= {q(since12)} AND bbl in ({L})",
                               "$group": "bbl,class", "$limit": 5000}):
        res[norm_bbl(r["bbl"])].setdefault("v12_class", {})[r.get("class") or "?"] = int(r["n"])
    for r in soda("hpd_viol", {"$select": "bbl,count(*) as n",
                               "$where": f"novissueddate >= {q(since24)} AND novissueddate < {q(since12)} AND bbl in ({L})",
                               "$group": "bbl", "$limit": 5000}):
        res[norm_bbl(r["bbl"])]["v_prev12"] = int(r["n"])
    # Neighborhood (NTA) and street addresses that carry violations.
    for r in soda("hpd_viol", {"$select": "bbl,nta,count(*) as n", "$where": f"bbl in ({L}) AND (violationstatus='Open' OR novissueddate >= {q(since24)})",
                               "$group": "bbl,nta", "$limit": 5000}):
        if r.get("nta"):
            res[norm_bbl(r["bbl"])].setdefault("nta", collections.Counter())[r["nta"]] += int(r["n"])
    for r in soda("hpd_viol", {"$select": "bbl,housenumber,streetname,zip,count(*) as n",
                               "$where": f"bbl in ({L}) AND (violationstatus='Open' OR novissueddate >= {q(since24)})",
                               "$group": "bbl,housenumber,streetname,zip", "$limit": 20000}):
        if r.get("housenumber") and r.get("streetname"):
            res[norm_bbl(r["bbl"])].setdefault("viol_addr", []).append(
                [r["housenumber"].strip(), r["streetname"].strip(), r.get("zip"), int(r["n"])])
    # Category counts. Descriptions are classified here and discarded (never stored or published).
    rows = soda_all("hpd_viol", {"$select": "violationid,bbl,class,violationstatus,novissueddate,novdescription",
                                 "$where": f"bbl in ({L}) AND (violationstatus='Open' OR novissueddate >= {q(since12)})",
                                 "$order": "violationid"})
    for r in rows:
        b = norm_bbl(r["bbl"]); c = categorize(r.get("novdescription"))
        if r.get("violationstatus") == "Open":
            res[b].setdefault("open_cat", collections.Counter())[c] += 1
            if r.get("class") == "C":
                res[b].setdefault("open_c_cat", collections.Counter())[c] += 1
        if (r.get("novissueddate") or "") >= since12:
            res[b].setdefault("v12_cat", collections.Counter())[c] += 1

    # HPD complaints, last 12 months.
    for r in soda("hpd_comp", {"$select": "bbl,count(distinct complaint_id) as n,count(*) as p",
                               "$where": f"received_date >= {q(since12)} AND bbl in ({L})", "$group": "bbl", "$limit": 5000}):
        b = norm_bbl(r["bbl"]); res[b]["c12"] = int(r["n"]); res[b]["c12_problems"] = int(r["p"])
    for r in soda("hpd_comp", {"$select": "bbl,count(distinct complaint_id) as n",
                               "$where": f"received_date >= {q(since24)} AND received_date < {q(since12)} AND bbl in ({L})",
                               "$group": "bbl", "$limit": 5000}):
        res[norm_bbl(r["bbl"])]["c_prev12"] = int(r["n"])
    for r in soda("hpd_comp", {"$select": "bbl,major_category,minor_category,count(*) as n",
                               "$where": f"received_date >= {q(since12)} AND bbl in ({L})",
                               "$group": "bbl,major_category,minor_category", "$limit": 20000}):
        b = norm_bbl(r["bbl"])
        res[b].setdefault("c12_major", collections.Counter())[r.get("major_category") or "OTHER"] += int(r["n"])
        res[b].setdefault("c12_minor", collections.Counter())[r.get("minor_category") or "OTHER"] += int(r["n"])
    for r in soda("hpd_comp", {"$select": "bbl,nta,count(*) as n", "$where": f"received_date >= {q(since24)} AND bbl in ({L})",
                               "$group": "bbl,nta", "$limit": 5000}):
        if r.get("nta"):
            res[norm_bbl(r["bbl"])].setdefault("nta_c", collections.Counter())[r["nta"]] += int(r["n"])

    # HPD registration (no owner/agent contact data: tesw-yqqr holds building-level fields only).
    where = " OR ".join(f"(boroid={q(b[0])} AND block={q(int(b[1:6]))} AND lot={q(int(b[6:]))})" for b in bbls)
    for r in soda("hpd_reg", {"$select": "boroid,block,lot,bin,lowhousenumber,highhousenumber,housenumber,streetname,zip,"
                                         "lastregistrationdate,registrationenddate",
                              "$where": where, "$limit": 20000}):
        b = f"{r['boroid']}{int(r['block']):05d}{int(r['lot']):04d}"
        if b not in res:
            continue
        res[b].setdefault("reg", []).append({k: r.get(k) for k in ("bin", "lowhousenumber", "highhousenumber", "housenumber",
                                                                    "streetname", "zip", "lastregistrationdate", "registrationenddate")})
    # BINs: footprints (base or billing BBL) + registrations.
    for r in soda("footprints", {"$select": "bin,base_bbl,mappluto_bbl",
                                 "$where": f"base_bbl in ({L}) OR mappluto_bbl in ({L})", "$limit": 20000}):
        for k in ("mappluto_bbl", "base_bbl"):
            b = norm_bbl(r.get(k))
            if b in res and r.get("bin"):
                res[b].setdefault("bins", set()).add(str(int(float(r["bin"]))))
    for b in bbls:
        for r in res[b].get("reg", []):
            if r.get("bin") and r["bin"] not in ("0",) and not re.fullmatch(r"[1-5]0{6}", r["bin"]):
                res[b].setdefault("bins", set()).add(r["bin"])
    bin2bbl = {}
    for b in bbls:
        res[b]["bins"] = sorted(x for x in res[b].get("bins", set()) if not re.fullmatch(r"[1-5]0{6}", x))
        for x in res[b]["bins"]:
            bin2bbl.setdefault(x, b)
    bins = sorted(bin2bbl)
    s12 = since12.replace("-", "")
    for bl in chunks(bins, 150):
        BL = inlist(bl)
        for r in soda("ecb", {"$select": "bin,severity,violation_type,count(*) as n",
                              "$where": f"ecb_violation_status='ACTIVE' AND bin in ({BL})",
                              "$group": "bin,severity,violation_type", "$limit": 20000}):
            b = bin2bbl[r["bin"]]
            res[b].setdefault("ecb_active_sev", collections.Counter())[r.get("severity") or "Unknown"] += int(r["n"])
            res[b].setdefault("ecb_active_type", collections.Counter())[(r.get("violation_type") or "Other").strip()] += int(r["n"])
        for r in soda("ecb", {"$select": "bin,count(*) as n",
                              "$where": f"issue_date >= {q(s12)} AND issue_date < '29991231' AND bin in ({BL})",
                              "$group": "bin", "$limit": 20000}):
            b = bin2bbl[r["bin"]]; res[b]["ecb12"] = res[b].get("ecb12", 0) + int(r["n"])
        for r in soda("dob_viol", {"$select": "bin,violation_type,count(*) as n",
                                   "$where": f"violation_category like '%ACTIVE%' AND bin in ({BL})",
                                   "$group": "bin,violation_type", "$limit": 20000}):
            b = bin2bbl[r["bin"]]
            t = re.sub(r"\s{2,}.*$", "", (r.get("violation_type") or "Other").strip())
            res[b].setdefault("dob_active_type", collections.Counter())[t] += int(r["n"])

    for r in soda("aep", {"$select": "bbl,current_status,aep_start_date,discharge_date",
                          "$where": f"bbl in ({L})", "$limit": 5000}):
        b = norm_bbl(r.get("bbl"))
        if b in res:
            res[b].setdefault("aep", []).append({k: r.get(k) for k in ("current_status", "aep_start_date", "discharge_date")})

    for b in bbls:
        for k, v in list(res[b].items()):
            if isinstance(v, collections.Counter):
                res[b][k] = dict(v)
    return res


def fetch(limit, fresh=False):
    """Resumable: the pilot selection and each batch are cached under .cache/ for the day,
    so an interrupted run picks up where it stopped."""
    today = dt.date.today()
    since12 = (today - dt.timedelta(days=365)).isoformat()
    since24 = (today - dt.timedelta(days=730)).isoformat()
    work = os.path.join(os.path.dirname(CACHE), f"work-{today.isoformat()}-{limit}")
    if fresh and os.path.isdir(work):
        for fn in os.listdir(work):
            os.remove(os.path.join(work, fn))
    os.makedirs(work, exist_ok=True)
    sel = os.path.join(work, "selection.json")
    if os.path.exists(sel):
        bbls = json.load(open(sel))
    else:
        bbls = select_pilot(limit, since12)
        json.dump(bbls, open(sel, "w"))
    data = {}
    batches = list(chunks(bbls, BATCH))

    def run(i, bl):
        fn = os.path.join(work, f"batch-{i:03d}.json")
        if os.path.exists(fn):
            return json.load(open(fn))
        r = fetch_batch(bl, since12, since24)
        with open(fn + ".tmp", "w") as f:
            json.dump(r, f)
        os.replace(fn + ".tmp", fn)
        return r

    with cf.ThreadPoolExecutor(2) as ex:
        futs = {ex.submit(run, i, bl): i for i, bl in enumerate(batches)}
        for n, f in enumerate(cf.as_completed(futs), 1):
            data.update(f.result())
            print(f"batch {n}/{len(batches)} done", file=sys.stderr, flush=True)
    latest = soda("hpd_viol", {"$select": "max(novissueddate) as d"})[0].get("d", "")[:10]
    meta = {"fetched": today.isoformat(), "since12": since12, "since24": since24,
            "hpd_latest_issued": latest, "rank": bbls}
    with open(CACHE, "w") as f:
        json.dump({"meta": meta, "buildings": data}, f)
    print(f"wrote {CACHE} ({len(data)} buildings)", file=sys.stderr, flush=True)


# ----------------------------------------------------------------------------- render

SUFFIX_WORDS = {"STREET", "AVENUE", "PLACE", "ROAD", "DRIVE", "TERRACE", "LANE", "COURT"}
SMALL = {"OF", "THE", "AND", "DE", "LA"}


def ordinal(n):
    n = int(n)
    suf = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suf}"


def nice_street(s):
    toks = re.sub(r"\s+", " ", (s or "").strip().upper()).split(" ")
    out = []
    for i, t in enumerate(toks):
        nxt = toks[i + 1] if i + 1 < len(toks) else ""
        if t.isdigit() and nxt in SUFFIX_WORDS:
            out.append(ordinal(t))
        elif t in SMALL and i:
            out.append(t.lower())
        elif t == "ST" and i == 0:
            out.append("St.")
        else:
            out.append(t[:1] + t[1:].lower() if not t[:1].isdigit() else t.lower())
    s = " ".join(out)
    s = re.sub(r"\bMc([a-z])", lambda m: "Mc" + m.group(1).upper(), s)
    s = re.sub(r"\bO'([a-z])", lambda m: "O'" + m.group(1).upper(), s)
    return s


def nice_house(h):
    return re.sub(r"\s+", " ", (h or "").strip()).upper()


def esc(s):
    return html.escape(str(s), quote=True)


def fmt_int(n):
    return f"{int(n):,}"


def fmt_date(iso):
    d = dt.date.fromisoformat(iso[:10])
    return d.strftime("%b %-d, %Y")


def plural(n, one, many=None):
    return f"{fmt_int(n)} {one if n == 1 else (many or one + 's')}"


def num(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


COMP_LABEL = {
    "HEAT/HOT WATER": "Heat or hot water", "UNSANITARY CONDITION": "Unsanitary conditions (pests, mold, garbage)",
    "PLUMBING": "Plumbing", "PAINT/PLASTER": "Paint or plaster", "DOOR/WINDOW": "Doors or windows",
    "WATER LEAK": "Water leaks", "GENERAL": "General building conditions", "ELECTRIC": "Electrical",
    "FLOORING/STAIRS": "Floors or stairs", "APPLIANCE": "Appliances", "SAFETY": "Safety (detectors, window guards, fire escapes)",
    "ELEVATOR": "Elevators", "OUTSIDE BUILDING": "Outside the building", "LINE OF TRAVEL": "Blocked or unsafe line of travel",
}
ECB_SEV = [("CLASS - 1", "Class 1 (immediately hazardous)"), ("Hazardous", "Hazardous (older code)"),
           ("CLASS - 2", "Class 2 (major)"), ("CLASS - 3", "Class 3 (lesser)"),
           ("Non-Hazardous", "Non-hazardous (older code)"), ("Unknown", "Severity not recorded")]


def addr_list(B):
    """Distinct street addresses for the lot: HPD registration ranges, else violation addresses."""
    seen, out = set(), []
    def hkey(h):
        m = re.match(r"(\d+)(?:-(\d+))?", (h or "").strip())
        return (int(m.group(1)), int(m.group(2) or 0)) if m else (10 ** 9, 0)
    for r in sorted(B.get("reg", []), key=lambda r: (r.get("streetname") or "", hkey(r.get("lowhousenumber") or r.get("housenumber")))):
        lo, hi = nice_house(r.get("lowhousenumber") or r.get("housenumber")), nice_house(r.get("highhousenumber") or r.get("housenumber"))
        st = nice_street(r.get("streetname"))
        if not lo or not st:
            continue
        a = f"{lo}–{hi} {st}" if hi and hi != lo else f"{lo} {st}"
        if a not in seen:
            seen.add(a); out.append(a)
    for h, s, z, n in sorted(B.get("viol_addr", []), key=lambda x: -x[3]):
        a = f"{nice_house(h)} {nice_street(s)}"
        if a not in seen and not any(a.split(" ", 1)[1] == x.split(" ", 1)[1] and "–" in x for x in out):
            seen.add(a); out.append(a)
    return out


def primary(B):
    va = sorted(B.get("viol_addr", []), key=lambda x: -x[3])
    if va:
        h, s, z, _ = va[0]
        return f"{nice_house(h)} {nice_street(s)}", z
    for r in B.get("reg", []):
        if r.get("housenumber") and r.get("streetname"):
            return f"{nice_house(r['housenumber'])} {nice_street(r['streetname'])}", r.get("zip")
    p = B.get("pluto") or {}
    if p.get("address"):
        return nice_street(p["address"]), p.get("zipcode")
    return f"BBL {B['bbl']}", None


def derive(B):
    b = B["bbl"]
    oc = B.get("open_class", {})
    B["boro"] = b[0]
    B["open_total"] = sum(oc.values())
    B["A"], B["B"], B["C"], B["I"] = (oc.get(k, 0) for k in "ABCI")
    B["v12"] = sum(B.get("v12_class", {}).values())
    B["c12"] = B.get("c12", 0)
    addr, z = primary(B)
    p = B.get("pluto") or {}
    B["addr"], B["zip"] = addr, (z or p.get("zipcode") or "")
    nta = collections.Counter(B.get("nta", {})) + collections.Counter(B.get("nta_c", {}))
    B["hood"] = nta.most_common(1)[0][0] if nta else "Other"
    B["addrs"] = addr_list(B)
    B["units"] = num(p.get("unitsres"))
    B["ecb_active"] = sum(B.get("ecb_active_sev", {}).values())
    B["dob_active"] = sum(B.get("dob_active_type", {}).values())
    B["score"] = B["open_total"] + B["c12"]
    return B


def pct_change(now, prev):
    if not prev:
        return None
    return round(100 * (now - prev) / prev)


def top_items(d, n, skip=()):
    return [(k, v) for k, v in sorted(d.items(), key=lambda kv: (-kv[1], kv[0])) if k not in skip][:n]


def summary_sentences(B, meta):
    """Data-driven lede: each clause only appears when the data supports it."""
    s = []
    where = f"in {B['hood']}, {BORO_IN[B['boro']]}" if B["hood"] != "Other" else f"in {BORO_IN[B['boro']]}"
    p = B.get("pluto") or {}
    yb, nb = num(p.get("yearbuilt")), num(p.get("numbldgs"))
    desc = []
    if B["units"]:
        desc.append(f"{fmt_int(B['units'])}-apartment")
    kind = "complex" if nb > 3 else "building"
    lead = f"{B['addr']} is a {' '.join(desc) + ' ' if desc else ''}{kind} {where}"
    if yb > 1800:
        lead += f", built around {yb}" if yb < 1930 else f", built in {yb}"
    s.append(lead + ".")
    if B["open_total"]:
        t = f"HPD lists {plural(B['open_total'], 'open housing code violation')} here"
        if B["C"]:
            t += f", {fmt_int(B['C'])} of them Class C (immediately hazardous)"
        if B["units"] >= 3:
            per = B["open_total"] / B["units"]
            t += f" — about {per:.1f} per apartment" if per >= 0.1 else ""
        s.append(t + ".")
    else:
        s.append("HPD currently lists no open housing code violations here.")
    if B["v12"]:
        cats = top_items(B.get("v12_cat", {}), 2, skip=("other",))
        t = f"In the past 12 months HPD issued {plural(B['v12'], 'violation')}"
        ch = pct_change(B["v12"], B.get("v_prev12", 0))
        if ch is not None and abs(ch) >= 10:
            t += f" ({'up' if ch > 0 else 'down'} {abs(ch)}% from the year before)"
        if cats:
            t += ", most often for " + " and ".join(CAT_LABEL[k].lower() for k, _ in cats)
        s.append(t + ".")
    if B["c12"]:
        mc = top_items(B.get("c12_major", {}), 1)
        t = f"Residents filed {plural(B['c12'], 'complaint')} with HPD over the same period"
        if mc:
            t += f"; the most common problem was {COMP_LABEL.get(mc[0][0], mc[0][0].title()).lower()}"
        s.append(t + ".")
    if B["ecb_active"] or B["dob_active"]:
        parts = []
        if B["ecb_active"]:
            parts.append(plural(B["ecb_active"], "active ECB violation"))
        if B["dob_active"]:
            parts.append(plural(B["dob_active"], "active DOB violation"))
        s.append("The Department of Buildings shows " + " and ".join(parts) + ".")
    return " ".join(s)


CSS = """:root{--bg:#f7f6f2;--card:#fff;--ink:#1c1d1f;--muted:#5e6166;--line:#e3e1da;--accent:#1f5f8b;--accent-ink:#fff;--hi:#b42318;--hi-bg:#fdecea;--md:#9a5b00;--md-bg:#fff4e0;--lo:#2f6b3a;--lo-bg:#e9f5ec;--bar:#1f5f8b}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141518;--card:#1d1f23;--ink:#ecebe7;--muted:#a3a6ad;--line:#2e3036;--accent:#6fb0e0;--accent-ink:#0d1b26;--hi:#ff8a80;--hi-bg:#3a1d1b;--md:#f3b45a;--md-bg:#352a17;--lo:#8fd19e;--lo-bg:#1b2e20;--bar:#6fb0e0}}
:root[data-theme="dark"]{--bg:#141518;--card:#1d1f23;--ink:#ecebe7;--muted:#a3a6ad;--line:#2e3036;--accent:#6fb0e0;--accent-ink:#0d1b26;--hi:#ff8a80;--hi-bg:#3a1d1b;--md:#f3b45a;--md-bg:#352a17;--lo:#8fd19e;--lo-bg:#1b2e20;--bar:#6fb0e0}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:20px 16px 56px}a{color:var(--accent)}
nav.crumbs{font-size:.86rem;color:var(--muted)}nav.crumbs a{color:var(--muted)}
h1{font-size:1.6rem;line-height:1.2;margin:14px 0 4px}h2{font-size:1.2rem;margin:28px 0 8px}
.sub{color:var(--muted);margin:0 0 14px;font-size:.95rem}.lede{font-size:1.02rem}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}@media (max-width:600px){.tiles{grid-template-columns:repeat(2,1fr)}}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px}.tile b{display:block;font-size:1.45rem;line-height:1.1}.tile span{font-size:.8rem;color:var(--muted)}
.tile.c b{color:var(--hi)}
.cta{background:var(--card);border:2px solid var(--accent);border-radius:12px;padding:14px 16px;margin:20px 0}.cta p{margin:4px 0 10px}
.btn{display:inline-block;background:var(--accent);color:var(--accent-ink);font-weight:600;text-decoration:none;padding:10px 16px;border-radius:8px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;font-size:.93rem}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:.8rem;color:var(--muted);font-weight:600}
td.n,th.n{text-align:right;white-space:nowrap}tr:last-child td{border-bottom:0}
.barcell{width:38%}.bar{height:8px;border-radius:4px;background:var(--bar);opacity:.75;min-width:2px}
.pill{font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:99px;white-space:nowrap}.hi{color:var(--hi);background:var(--hi-bg)}.md{color:var(--md);background:var(--md-bg)}.lo{color:var(--lo);background:var(--lo-bg)}
ul.addrs{columns:2;padding-left:18px;margin:6px 0}@media (max-width:600px){ul.addrs{columns:1}}
dl.facts{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;margin:0;font-size:.93rem}dl.facts dt{color:var(--muted)}dl.facts dd{margin:0;overflow-wrap:anywhere}
.note{font-size:.88rem;color:var(--muted)}.box{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.disc{font-size:.82rem;color:var(--muted);border-top:1px solid var(--line);padding-top:12px;margin-top:28px}
.wrap{overflow-x:auto}ul.links{padding-left:18px}ul.links li{margin:3px 0}
"""


def page(title, desc, canon, crumbs, body):
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList",
          "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + u}
                              for i, (n, u) in enumerate(crumbs)]}
    nav = " › ".join(f'<a href="{esc(rel_from(canon, u))}">{esc(n)}</a>' for n, u in crumbs[:-1]) + \
          f' › <span aria-current="page">{esc(crumbs[-1][0])}</span>'
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{esc(SITE + canon)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lantern Lab NYC">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{esc(SITE + canon)}">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<link rel="stylesheet" href="{esc(rel_from(canon, 'b/style.css'))}">
</head>
<body>
<main>
<nav class="crumbs" aria-label="Breadcrumb">{nav}</nav>
{body}
<p class="disc">Lantern Lab NYC is an independent project, not affiliated with HPD, DOB or the City of New York. Figures are counts from NYC Open Data and can lag the agencies' own systems; a violation can be corrected in the building before it is cleared in the record. Informational only, not legal advice. <a href="{esc(rel_from(canon, ''))}">More free NYC tools</a></p>
</main>
</body>
</html>
"""


def rel_from(src, dst):
    """Relative link from page path src (e.g. 'b/n/x.html') to dst (e.g. 'b/123.html')."""
    depth = src.count("/")
    return "../" * depth + dst if dst else ("../" * depth or "./")


def bar_rows(items, total_label=None):
    if not items:
        return ""
    mx = max(v for _, v in items) or 1
    rows = "".join(f'<tr><td>{esc(k)}</td><td class="n">{fmt_int(v)}</td>'
                   f'<td class="barcell" aria-hidden="true"><div class="bar" style="width:{max(2, round(100 * v / mx))}%"></div></td></tr>'
                   for k, v in items)
    return rows


def class_explainer():
    return f"""<h2>What Class A, B and C mean</h2>
<div class="box"><p style="margin-top:0">HPD sorts housing code violations by hazard. Per <a href="{HPD_CLEAR}" rel="noopener">HPD's "Clear Violations" guidance</a>:</p>
<ul>
<li><span class="pill lo">Class A</span> non-hazardous. The owner has 90 days from service of the violation to correct it.</li>
<li><span class="pill md">Class B</span> hazardous. 30 days to correct.</li>
<li><span class="pill hi">Class C</span> immediately hazardous. Most must be corrected within 24 hours; lead-based paint, window guards, mold, mice, roaches and rats within 21 days; self-closing doors within 14 days; heat and hot water immediately.</li>
</ul>
<p class="note" style="margin-bottom:0">HPD also lists Class I entries: orders to repair and vacate orders, which are not ranked by hazard. A violation stays "open" until the owner certifies the correction and HPD clears it, so an open count can include problems already fixed but not yet cleared.</p></div>"""


def building_page(B, by_hood, meta):
    b, boro = B["bbl"], B["boro"]
    canon = f"b/{b}.html"
    cta_url = f"{LOOKUP}?bbl={b}"
    zip_ = f" {B['zip']}" if B["zip"] else ""
    place = f"{B['addr']}, {BORO[boro]}, NY{zip_}"
    title = f"{B['addr']}, {BORO[boro]}: {fmt_int(B['open_total'])} Open HPD Violations"
    if len(title) > 68:
        title = f"{B['addr']}: {fmt_int(B['open_total'])} Open HPD Violations"
    d = (f"{B['addr']}, {BORO[boro]} {B['zip']}: {fmt_int(B['open_total'])} open HPD violations "
         f"({fmt_int(B['C'])} Class C), {fmt_int(B['c12'])} HPD complaints in 12 months, "
         f"{fmt_int(B['ecb_active'])} active ECB violations. Data as of {fmt_date(meta['fetched'])}.")
    hood_slug = slug(B["hood"])
    hood_has_page = len(by_hood.get((boro, B["hood"]), [])) >= 3 and B["hood"] != "Other"
    crumbs = [("Lantern Lab NYC", ""), ("NYC buildings", "b/"), (BORO[boro], f"b/{BORO_SLUG[boro]}.html")]
    if hood_has_page:
        crumbs.append((B["hood"], f"b/n/{boro}-{hood_slug}.html"))
    crumbs.append((B["addr"], canon))

    tiles = (f'<div class="tiles"><div class="tile"><b>{fmt_int(B["open_total"])}</b><span>open HPD violations</span></div>'
             f'<div class="tile c"><b>{fmt_int(B["C"])}</b><span>open Class C (immediately hazardous)</span></div>'
             f'<div class="tile"><b>{fmt_int(B["c12"])}</b><span>HPD complaints, last 12 months</span></div>'
             f'<div class="tile"><b>{fmt_int(B["ecb_active"] + B["dob_active"])}</b><span>active DOB / ECB violations</span></div></div>')

    cta = (f'<div class="cta"><strong>See live details and get alerts</strong>'
           f'<p>This page is a snapshot. The free Building Watch lookup pulls each open violation for {esc(B["addr"])} '
           f'straight from NYC Open Data, shows upcoming OATH hearings and compliance dates, and can email you when something new is filed.</p>'
           f'<a class="btn" href="{esc(cta_url)}">See live details and get alerts</a></div>')

    # Open violations by class
    oc_rows = ""
    for k, lab, pill, fix in (("C", "Class C", "hi", "immediately to 21 days"), ("B", "Class B", "md", "30 days"),
                              ("A", "Class A", "lo", "90 days"), ("I", "Class I (orders)", "md", "per order")):
        if k == "I" and not B["I"]:
            continue
        cc = top_items(B.get("open_c_cat", {}), 3) if k == "C" else []
        what = ", ".join(f"{CAT_LABEL[c].lower()} ({fmt_int(n)})" for c, n in cc) if cc else ""
        oc_rows += (f'<tr><td><span class="pill {pill}">{lab}</span>{"<div class=note>Top: " + esc(what) + "</div>" if what else ""}</td>'
                    f'<td class="n">{fmt_int(B[k])}</td><td>{fix}</td></tr>')
    notes = []
    if B.get("rent_impairing"):
        notes.append(f"{plural(B['rent_impairing'], 'open violation is', 'open violations are')} flagged by HPD as rent impairing.")
    if B.get("oldest_open"):
        y = B["oldest_open"][:4]
        if int(y) <= int(meta["fetched"][:4]) - 2:
            notes.append(f"The oldest open violation was issued in {y}.")
    aep = [a for a in B.get("aep", []) if (a.get("current_status") or "").lower().find("active") >= 0]
    if aep:
        notes.append(f'HPD lists this building as active in its <a href="https://www.nyc.gov/site/hpd/services-and-information/alternative-enforcement-program-aep.page" rel="noopener">Alternative Enforcement Program</a> (since {fmt_date(aep[0]["aep_start_date"])}), which targets buildings with many serious violations.')
    open_sec = (f'<h2>Open HPD violations by class</h2><div class="wrap"><table><thead><tr><th>Class</th><th class="n">Open</th><th>Time HPD allows to correct</th></tr></thead>'
                f'<tbody>{oc_rows}</tbody></table></div>' + ("<p class=note>" + " ".join(notes) + "</p>" if notes else ""))

    # Recent violation types
    v12 = top_items(B.get("v12_cat", {}), 8)
    rec = ""
    if v12:
        rows = bar_rows([(CAT_LABEL[k], v) for k, v in v12])
        ch = pct_change(B["v12"], B.get("v_prev12", 0))
        trend = ""
        if B.get("v_prev12"):
            trend = (f" That compares with {fmt_int(B['v_prev12'])} in the 12 months before"
                     + (f" ({'+' if ch > 0 else ''}{ch}%)." if ch is not None else "."))
        cls12 = B.get("v12_class", {})
        rec = (f'<h2>What HPD cited in the last 12 months</h2>'
               f'<p>HPD issued {plural(B["v12"], "violation")} between {fmt_date(meta["since12"])} and {fmt_date(meta["fetched"])}: '
               f'{fmt_int(cls12.get("C", 0))} Class C, {fmt_int(cls12.get("B", 0))} Class B and {fmt_int(cls12.get("A", 0))} Class A.{trend}</p>'
               f'<div class="wrap"><table><thead><tr><th>Type of condition</th><th class="n">Violations</th><th class="barcell"></th></tr></thead><tbody>{rows}</tbody></table></div>'
               f'<p class="note">Types are grouped by Lantern Lab from HPD\'s violation wording; apartment-level detail is left out.</p>')
    else:
        rec = "<h2>What HPD cited in the last 12 months</h2><p>HPD issued no new violations here in the last 12 months.</p>"

    # Complaints
    comp = "<h2>Complaints to HPD in the last 12 months</h2>"
    if B["c12"]:
        cm = top_items(B.get("c12_major", {}), 7)
        ch = pct_change(B["c12"], B.get("c_prev12", 0))
        comp += (f'<p>{plural(B["c12"], "complaint")} covering {plural(B.get("c12_problems", 0), "reported problem")}'
                 + (f", compared with {fmt_int(B['c_prev12'])} complaints the year before" if B.get("c_prev12") else "")
                 + (f" ({'+' if ch > 0 else ''}{ch}%)" if ch is not None and B.get("c_prev12") else "") + ". "
                 + '</p><div class="wrap"><table><thead><tr><th>Problem area</th><th class="n">Problems</th><th class="barcell"></th></tr></thead><tbody>'
                 + bar_rows([(COMP_LABEL.get(k, k.title()), v) for k, v in cm]) + "</tbody></table></div>")
    else:
        comp += "<p>No HPD complaints were recorded here in the last 12 months.</p>"

    # DOB / ECB
    dob = "<h2>DOB and ECB violations</h2>"
    sev = B.get("ecb_active_sev", {})
    if B["ecb_active"] or B["dob_active"] or B.get("ecb12"):
        rows = "".join(f'<tr><td>{esc(lab)}</td><td class="n">{fmt_int(sev[k])}</td></tr>' for k, lab in ECB_SEV if sev.get(k))
        types = top_items(B.get("ecb_active_type", {}), 4, skip=("Unknown", "Other"))
        dtypes = top_items(B.get("dob_active_type", {}), 4)
        dob += (f'<p>The Department of Buildings records {plural(B["ecb_active"], "active ECB violation")} (summonses heard at OATH) and '
                f'{plural(B["dob_active"], "active DOB violation")} across the building{"s" if len(B["bins"]) > 1 else ""} on this lot'
                + (f"; {plural(B['ecb12'], 'ECB violation was', 'ECB violations were')} issued in the last 12 months." if B.get("ecb12") else ".") + "</p>")
        if rows:
            dob += f'<div class="wrap"><table><thead><tr><th>Active ECB violations by severity</th><th class="n">Count</th></tr></thead><tbody>{rows}</tbody></table></div>'
        bits = []
        if types:
            bits.append("Active ECB violations by type: " + ", ".join(f"{esc(t.lower())} ({fmt_int(n)})" for t, n in types) + ".")
        if dtypes:
            bits.append("Active DOB violations by type: " + ", ".join(f"{esc(t.split('-', 1)[-1].strip().lower())} ({fmt_int(n)})" for t, n in dtypes) + ".")
        if bits:
            dob += "<p class=note>" + " ".join(bits) + " DOB violations stay active until the owner files proof of correction and DOB dismisses them.</p>"
    else:
        dob += "<p>No active DOB or ECB violations are recorded for the buildings on this lot.</p>"

    # Building facts
    p = B.get("pluto") or {}
    regs = B.get("reg", [])
    reg_txt = "Not found in HPD's registration data"
    if regs:
        end = max((r.get("registrationenddate") or "")[:10] for r in regs)
        if end:
            reg_txt = (f"Current, valid through {fmt_date(end)}" if end >= meta["fetched"] else f"Expired {fmt_date(end)} per HPD's data")
    facts = [("Borough", BORO[boro]), ("Neighborhood", B["hood"] if B["hood"] != "Other" else None), ("ZIP code", B["zip"] or None),
             ("BBL", f"{b} (borough {b[0]}, block {int(b[1:6])}, lot {int(b[6:])})"),
             ("BIN" + ("s" if len(B["bins"]) > 1 else ""), (", ".join(B["bins"][:8]) + (f" and {len(B['bins']) - 8} more" if len(B["bins"]) > 8 else "")) or None),
             ("Residential units", fmt_int(B["units"]) if B["units"] else None),
             ("Buildings on lot", fmt_int(num(p.get("numbldgs"))) if num(p.get("numbldgs")) > 1 else None),
             ("Floors", fmt_int(num(p.get("numfloors"))) if num(p.get("numfloors")) else None),
             ("Year built", str(num(p.get("yearbuilt"))) if num(p.get("yearbuilt")) > 1800 else None),
             ("HPD registration", reg_txt)]
    facts_html = "".join(f"<dt>{esc(k)}</dt><dd>{esc(v)}</dd>" for k, v in facts if v)
    addrs = B["addrs"]
    addr_html = ""
    if len(addrs) > 1:
        shown = addrs[:16]
        addr_html = (f'<p class="note" style="margin-bottom:0">Addresses on this tax lot:</p><ul class="addrs">'
                     + "".join(f"<li>{esc(a)}</li>" for a in shown) + "</ul>"
                     + (f'<p class="note">and {len(addrs) - 16} more.</p>' if len(addrs) > 16 else ""))

    # Nearby
    near = [x for x in by_hood.get((boro, B["hood"]), []) if x["bbl"] != b][:6]
    near_html = ""
    if near:
        near_html = (f'<h2>Other buildings in {esc(B["hood"] if B["hood"] != "Other" else BORO[boro])} with many open violations</h2><ul class="links">'
                     + "".join(f'<li><a href="{x["bbl"]}.html">{esc(x["addr"])}</a> ({fmt_int(x["open_total"])} open, {fmt_int(x["C"])} Class C)</li>' for x in near)
                     + "</ul>")
    else:
        near_html = f'<p><a href="{BORO_SLUG[boro]}.html">See other {esc(BORO[boro])} buildings with many open violations</a></p>'

    src = (f'<h2>Sources</h2><p class="note">Data as of {fmt_date(meta["fetched"])} (latest HPD violation in the dataset issued {fmt_date(meta["hpd_latest_issued"])}). '
           f'From NYC Open Data: '
           + ", ".join(f'<a href="https://data.cityofnewyork.us/d/{DS[k]}" rel="noopener">{esc(DS_NAMES[k])}</a>' for k in ("hpd_viol", "hpd_comp", "ecb", "dob_viol", "hpd_reg", "pluto"))
           + f'. Official records: <a href="{HPD_ONLINE}" rel="noopener">HPD Online</a>'
           + (f', <a href="https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?bin={B["bins"][0]}" rel="noopener">DOB Building Information System</a>' if B["bins"] else "")
           + ". Lantern Lab doesn't publish owner, agent or tenant names, or apartment numbers.</p>")

    body = (f'<h1>{esc(B["addr"])}, {esc(BORO[boro])}: HPD violations and complaints</h1>'
            f'<p class="sub">{esc(place)} · BBL {b} · data as of {fmt_date(meta["fetched"])}</p>'
            f'<p class="lede">{esc(summary_sentences(B, meta))}</p>{tiles}{cta}{open_sec}{rec}{comp}{dob}'
            f'<h2>Building facts</h2><div class="box"><dl class="facts">{facts_html}</dl>{addr_html}</div>'
            f'{class_explainer()}'
            f'<div class="cta"><strong>Live record and alerts for {esc(B["addr"])}</strong><p>Open violations line by line, OATH hearing dates and a free email alert when HPD or DOB files something new.</p>'
            f'<a class="btn" href="{esc(cta_url)}">See live details and get alerts</a></div>'
            f'{near_html}{src}')
    return canon, page(title, d, canon, crumbs, body)


def table_rows(bs, prefix=""):
    return "".join(f'<tr><td><a href="{prefix}{x["bbl"]}.html">{esc(x["addr"])}</a></td><td>{esc(x["zip"])}</td>'
                   f'<td class="n">{fmt_int(x["open_total"])}</td><td class="n">{fmt_int(x["C"])}</td><td class="n">{fmt_int(x["c12"])}</td></tr>'
                   for x in bs)


TH = '<thead><tr><th>Address</th><th>ZIP</th><th class="n">Open</th><th class="n">Class C</th><th class="n">Complaints (12 mo)</th></tr></thead>'


def method_note(meta, n):
    return (f'<p class="note">How buildings were chosen: the {n} NYC tax lots with the highest combined count of open HPD violations '
            f'and HPD complaints received from {fmt_date(meta["since12"])} to {fmt_date(meta["fetched"])}, from NYC Open Data. '
            f'Being on this list reflects the public record, not a judgment about any owner. Large complexes appear as one lot. '
            f'Your building isn\'t listed? <a href="{LOOKUP}">Look up any NYC address</a>.</p>')


def render():
    with open(CACHE) as f:
        raw = json.load(f)
    meta, data = raw["meta"], raw["buildings"]
    bs = [derive(data[b]) for b in meta["rank"] if b in data]
    bs.sort(key=lambda x: (-x["score"], x["bbl"]))
    by_hood = collections.defaultdict(list)
    for x in bs:
        by_hood[(x["boro"], x["hood"])].append(x)
    os.makedirs(os.path.join(OUT, "n"), exist_ok=True)
    for fn in os.listdir(OUT):  # remove pages of buildings that dropped out of the set
        if re.fullmatch(r"\d{10}\.html", fn):
            os.remove(os.path.join(OUT, fn))
    for fn in os.listdir(os.path.join(OUT, "n")):
        os.remove(os.path.join(OUT, "n", fn))
    with open(os.path.join(OUT, "style.css"), "w") as f:
        f.write(CSS)
    urls = []
    for x in bs:
        canon, h = building_page(x, by_hood, meta)
        with open(os.path.join(DOCS, canon), "w") as f:
            f.write(h)
        urls.append(canon)

    # Neighborhood pages (only where >=3 buildings, to avoid thin index pages)
    hood_pages = {}
    for (boro, hood), xs in sorted(by_hood.items()):
        if len(xs) < 3 or hood == "Other":
            continue
        canon = f"b/n/{boro}-{slug(hood)}.html"
        hood_pages[(boro, hood)] = canon
        tot = sum(x["open_total"] for x in xs); totc = sum(x["C"] for x in xs); c12 = sum(x["c12"] for x in xs)
        cats = collections.Counter()
        for x in xs:
            cats.update(x.get("v12_cat", {}))
        topc = [CAT_LABEL[k].lower() for k, _ in cats.most_common(4) if k != "other"][:3]
        zips = sorted({x["zip"] for x in xs if x["zip"]})
        body = (f'<h1>{esc(hood)} buildings with the most HPD violations</h1>'
                f'<p class="sub">{esc(BORO[boro])} · ZIP {esc(", ".join(zips))} · data as of {fmt_date(meta["fetched"])}</p>'
                f'<p>These {len(xs)} buildings in {esc(hood)} have {fmt_int(tot)} open HPD violations between them, {fmt_int(totc)} of them Class C, '
                f'and drew {fmt_int(c12)} HPD complaints in the past 12 months.'
                + (f' The conditions HPD cited most often here this year: {", ".join(topc)}.' if topc else "") + '</p>'
                f'<div class="wrap"><table>{TH}<tbody>{table_rows(xs, "../")}</tbody></table></div>'
                f'<div class="cta"><strong>Check any building in {esc(hood)}</strong><p>Look up live violations, hearings and compliance dates for any NYC address, and get free alerts.</p>'
                f'<a class="btn" href="../{LOOKUP}">Look up a building</a></div>{method_note(meta, len(bs))}')
        body = body.replace(f'href="{LOOKUP}"', f'href="../{LOOKUP}"')
        t = f"{hood}, {BORO[boro]}: Buildings With the Most HPD Violations"
        d = (f"{len(xs)} {hood} buildings with the most open HPD violations and complaints: {fmt_int(tot)} open violations, "
             f"{fmt_int(totc)} Class C. Addresses, counts and free alerts. Data as of {fmt_date(meta['fetched'])}.")
        with open(os.path.join(DOCS, canon), "w") as f:
            f.write(page(t, d, canon, [("Lantern Lab NYC", ""), ("NYC buildings", "b/"), (BORO[boro], f"b/{BORO_SLUG[boro]}.html"), (hood, canon)], body))
        urls.append(canon)

    # Borough pages
    boro_counts = {}
    for boro in BORO:
        xs = [x for x in bs if x["boro"] == boro]
        if not xs:
            continue
        canon = f"b/{BORO_SLUG[boro]}.html"
        boro_counts[boro] = (canon, len(xs), sum(x["open_total"] for x in xs))
        hoods = sorted({x["hood"] for x in xs}, key=lambda h: (-len(by_hood[(boro, h)]), h))
        hl = "".join(f'<li><a href="n/{boro}-{slug(h)}.html">{esc(h)}</a> ({len(by_hood[(boro, h)])} buildings)</li>'
                     for h in hoods if (boro, h) in hood_pages)
        sections = ""
        for h in sorted(hoods):
            ys = by_hood[(boro, h)]
            hh = f'<a href="n/{boro}-{slug(h)}.html">{esc(h)}</a>' if (boro, h) in hood_pages else esc(h if h != "Other" else "Neighborhood not recorded")
            sections += f'<h2 id="{slug(h)}">{hh}</h2><div class="wrap"><table>{TH}<tbody>{table_rows(ys)}</tbody></table></div>'
        tot = sum(x["open_total"] for x in xs)
        body = (f'<h1>{esc(BORO[boro])} buildings with the most HPD violations</h1>'
                f'<p class="sub">{len(xs)} buildings · {fmt_int(tot)} open HPD violations · data as of {fmt_date(meta["fetched"])}</p>'
                + (f'<p>Neighborhoods with three or more listed buildings:</p><ul class="links">{hl}</ul>' if hl else "")
                + sections + method_note(meta, len(bs)))
        t = f"{BORO[boro]} Buildings With the Most Open HPD Violations"
        d = (f"The {len(xs)} {BORO[boro]} buildings with the most open HPD violations and recent complaints, by neighborhood: "
             f"{fmt_int(tot)} open violations in all. Data as of {fmt_date(meta['fetched'])}.")
        with open(os.path.join(DOCS, canon), "w") as f:
            f.write(page(t, d, canon, [("Lantern Lab NYC", ""), ("NYC buildings", "b/"), (BORO[boro], canon)], body))
        urls.append(canon)

    # Top index
    canon = "b/"
    bl = "".join(f'<li><a href="{c.split("/")[-1]}">{esc(BORO[k])}</a>: {n} buildings, {fmt_int(o)} open violations</li>'
                 for k, (c, n, o) in boro_counts.items())
    body = (f'<h1>NYC buildings with the most HPD violations</h1>'
            f'<p class="sub">{len(bs)} buildings · data as of {fmt_date(meta["fetched"])}</p>'
            f'<p>Each page summarizes one building\'s public record: open HPD violations by class, what HPD cited in the last year, '
            f'what residents complained about, and DOB/ECB violations, with a link to the live record and free alerts.</p>'
            f'<h2>By borough</h2><ul class="links">{bl}</ul>'
            f'<h2>The 25 buildings with the most open violations and recent complaints</h2>'
            f'<div class="wrap"><table>{TH}<tbody>{table_rows(bs[:25])}</tbody></table></div>'
            + method_note(meta, len(bs)))
    with open(os.path.join(OUT, "index.html"), "w") as f:
        f.write(page("NYC Buildings With the Most HPD Violations (by Borough)",
                     f"Open HPD violations, HPD complaints and DOB/ECB violations for the {len(bs)} NYC buildings with the most, "
                     f"by borough and neighborhood. Free lookup and alerts. Data as of {fmt_date(meta['fetched'])}.",
                     canon, [("Lantern Lab NYC", ""), ("NYC buildings", canon)], body))
    urls.append(canon)

    # Sitemaps
    lm = meta["fetched"]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sm += [f"  <url><loc>{SITE}{u}</loc><lastmod>{lm}</lastmod></url>" for u in sorted(urls)]
    sm.append("</urlset>")
    with open(os.path.join(DOCS, "sitemap-buildings.xml"), "w") as f:
        f.write("\n".join(sm) + "\n")
    idx = ['<?xml version="1.0" encoding="UTF-8"?>', '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
           f"  <sitemap><loc>{SITE}sitemap.xml</loc></sitemap>",
           f"  <sitemap><loc>{SITE}sitemap-buildings.xml</loc><lastmod>{lm}</lastmod></sitemap>", "</sitemapindex>"]
    with open(os.path.join(DOCS, "sitemap-index.xml"), "w") as f:
        f.write("\n".join(idx) + "\n")
    print(f"rendered {len(bs)} building pages, {len(hood_pages)} neighborhood pages, {len(boro_counts)} borough pages", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stage", choices=["fetch", "render", "all"])
    ap.add_argument("--limit", type=int, default=500)
    ap.add_argument("--fresh", action="store_true", help="ignore today's cached selection/batches")
    a = ap.parse_args()
    if a.stage in ("fetch", "all"):
        fetch(a.limit, a.fresh)
    if a.stage in ("render", "all"):
        render()


if __name__ == "__main__":
    main()
