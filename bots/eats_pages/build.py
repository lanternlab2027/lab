#!/usr/bin/env python3
"""Restaurant pages generator: one static, crawlable page per NYC restaurant in a pilot set.

Answers "[restaurant] health grade" / "[restaurant] inspection" searches with the current
DOHMH grade, the last 3 inspections and a link into the live app (docs/eats/?camis=...)
for the full history and the share card.

Stages
  select   pick the pilot set from NYC Open Data 43nn-pn8j -> bots/eats_pages/pilot.json
           (re-running merges: a restaurant already in pilot.json is never dropped)
  fetch    pull every inspection row for the pilot set -> .cache/rows.json, .cache/meta.json
  render   rows -> node compute.js (the app's own grades.js + violations.js) -> HTML:
           docs/eats/r/{camis}.html, r/index.html, r/borough/*.html, r/cuisine/*.html,
           r/r.css, docs/sitemap-eats.xml, docs/sitemap-index.xml entry
  all      select (only if pilot.json is missing, or with --reselect), fetch, render

Restaurants that disappear from the open data, or whose last inspection is older than
STALE_MONTHS, keep their page, rendered from bots/eats_pages/last_known.json.gz and
marked "Closed or no recent inspection". Pages are never deleted by this script.

Privacy: only establishment-level fields are requested (no phone, no coordinates, no
inspector or owner data; the dataset has none of the latter). Violation text is DOHMH's
standard wording.

Standard library only, plus `node` for compute.js.
"""
import argparse, collections, datetime as dt, gzip, html, json, os, re, subprocess, sys, time
import urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
DOCS = os.path.join(REPO, "docs")
APP_DIR = os.path.join(DOCS, "eats")
OUT = os.path.join(APP_DIR, "r")
CACHE = os.path.join(HERE, ".cache")
PILOT = os.path.join(HERE, "pilot.json")
LAST_KNOWN = os.path.join(HERE, "last_known.json.gz")

SITE = "https://lanternlab2027.github.io/lab/"
APP_URL = SITE + "eats/"
R_URL = APP_URL + "r/"
API = "https://data.cityofnewyork.us/resource/43nn-pn8j.json"
DATASET_URL = "https://data.cityofnewyork.us/d/43nn-pn8j"
APP_TOKEN = os.environ.get("SOCRATA_APP_TOKEN")

DOH_GRADING = "https://www.nyc.gov/site/doh/business/food-operators/letter-grading-for-restaurants.page"
DOH_FAQ = "https://www.nyc.gov/assets/doh/downloads/pdf/rii/restaurant-grading-faq.pdf"
DOH_ABC = "https://www.nyc.gov/site/doh/services/restaurant-grades.page"

BOROS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"]
BORO_SLUG = {b: b.lower().replace(" ", "-") for b in BOROS}
BORO_IN = {"Manhattan": "Manhattan", "Brooklyn": "Brooklyn", "Queens": "Queens", "Bronx": "the Bronx", "Staten Island": "Staten Island"}
# Pilot size per borough. Roughly proportional to restaurant counts in the data
# (M 40%, Bk 26%, Q 22%, Bx 8%, SI 4%), with Staten Island and the Bronx rounded up.
QUOTA = {"Manhattan": 390, "Brooklyn": 250, "Queens": 220, "Bronx": 90, "Staten Island": 50}
ACTIVE_MONTHS = 18     # selection: inspected within this many months of the data date
STALE_MONTHS = 18      # render: no inspection within this many months -> "closed or no recent inspection"
MIN_YEARS = 3          # selection: inspection records in at least this many calendar years
MIN_CUISINE_PAGE = 5   # a cuisine index page needs at least this many restaurants
BATCH = 50

# Named picks. kind "chain": one location per borough, the one with the longest record in
# the data (our flagship proxy). kind "landmark": up to 3 active locations under that name.
# Patterns match the DBA (upper case) as a regex.
NAMED = [
    # chains and multi-location names people search by name
    ("chain", r"^SHAKE SHACK"), ("chain", r"^JOE'?S PIZZA"), ("chain", r"^STARBUCKS"),
    ("chain", r"^MCDONALD'?S"), ("chain", r"^DUNKIN"), ("chain", r"^CHIPOTLE"),
    ("chain", r"^SWEETGREEN"), ("chain", r"^CHICK-FIL-A"), ("chain", r"^POPEYES"),
    ("chain", r"^BURGER KING"), ("chain", r"^WENDY'?S"), ("chain", r"^TACO BELL"),
    ("chain", r"^KFC|^KENTUCKY FRIED"), ("chain", r"^DOMINO'?S"), ("chain", r"^PAPA JOHN'?S"),
    ("chain", r"^PANERA"), ("chain", r"^FIVE GUYS"), ("chain", r"^CAVA\b"),
    ("chain", r"^JUNIOR'?S"), ("chain", r"^XI'?AN FAMOUS"), ("chain", r"^NATHAN'?S FAMOUS"),
    ("chain", r"^IHOP"), ("chain", r"^APPLEBEE'?S"), ("chain", r"^OLIVE GARDEN"),
    ("chain", r"^RED LOBSTER"), ("chain", r"^THE HALAL GUYS|^HALAL GUYS"), ("chain", r"^PRET A MANGER"),
    ("chain", r"^LE PAIN QUOTIDIEN"), ("chain", r"^LEVAIN"), ("chain", r"^MAGNOLIA BAKERY"),
    ("chain", r"^WHITE CASTLE"), ("chain", r"^JOLLIBEE"), ("chain", r"^2 BROS\.? PIZZA"),
    ("chain", r"^PATSY'?S PIZZERIA"), ("chain", r"^CARMINE'?S"), ("chain", r"^ROSA MEXICANO"),
    ("chain", r"^JOE'?S SHANGHAI"), ("chain", r"^DIG\b"), ("chain", r"^JUST SALAD"),
    ("chain", r"^PIZZA HUT"), ("chain", r"^SUBWAY\b"), ("chain", r"^TIM HORTONS"),
    ("chain", r"^BLUESTONE LANE"), ("chain", r"^BLUE BOTTLE"), ("chain", r"^RALPH'?S FAMOUS ITALIAN ICES"),
    ("chain", r"^ARTICHOKE BASILLE"), ("chain", r"^PAN ?PAN|^NAN XIANG"), ("chain", r"^DOS TOROS"),
    ("chain", r"^LUKE'?S LOBSTER"), ("chain", r"^BAREBURGER"), ("chain", r"^SMASHBURGER"),
    ("chain", r"^THE COFFEE BEAN|^COFFEE BEAN"), ("chain", r"^PEET'?S"), ("chain", r"^CROWN FRIED CHICKEN"),
    # long-running places people look up by name
    ("landmark", r"^KATZ'?S"), ("landmark", r"^PETER LUGER"), ("landmark", r"^RUSS ?(&|AND) ?DAUGHTERS"),
    ("landmark", r"^DI FARA"), ("landmark", r"^LOMBARDI'?S"), ("landmark", r"^GRIMALDI'?S"),
    ("landmark", r"^JULIANA'?S"), ("landmark", r"^TAVERN ON THE GREEN"), ("landmark", r"^LE BERNARDIN"),
    ("landmark", r"^GRAMERCY TAVERN"), ("landmark", r"^CARBONE"), ("landmark", r"^KEENS"),
    ("landmark", r"^SYLVIA'?S"), ("landmark", r"^L ?& ?B SPUMONI"), ("landmark", r"^TOTONNO'?S"),
    ("landmark", r"^PETER PAN DONUT"), ("landmark", r"^BARNEY GREENGRASS"), ("landmark", r"^EISENBERG'?S"),
    ("landmark", r"^MIKE'?S DELI"), ("landmark", r"^RAO'?S$"), ("landmark", r"^BALTHAZAR"),
    ("landmark", r"^MINETTA TAVERN"), ("landmark", r"^EMPELLON"), ("landmark", r"^LUCALI"),
    ("landmark", r"^ROBERTA'?S"), ("landmark", r"^PRINCE STREET PIZZA"), ("landmark", r"^JOE'?S STEAM RICE"),
    ("landmark", r"^SECOND AVE(NUE)? DELI"), ("landmark", r"^CARNEGIE DELI"), ("landmark", r"^SAMMY'?S ROUMANIAN"),
    ("landmark", r"^OYSTER BAR|^GRAND CENTRAL OYSTER"), ("landmark", r"^THE RIVER CAFE|^RIVER CAFE"),
    ("landmark", r"^NOM WAH"), ("landmark", r"^ORWASHER'?S"), ("landmark", r"^VENIERO'?S"),
    ("landmark", r"^FERRARA"), ("landmark", r"^DOMINIQUE ANSEL"), ("landmark", r"^EILEEN'?S SPECIAL CHEESECAKE"),
    ("landmark", r"^PATSY'?S ITALIAN"), ("landmark", r"^GALLAGHER'?S"), ("landmark", r"^SMITH ?(&|AND) ?WOLLENSKY"),
    ("landmark", r"^ELEVEN MADISON"), ("landmark", r"^PER SE\b"), ("landmark", r"^DANIEL$"),
    ("landmark", r"^JEAN[- ]GEORGES"), ("landmark", r"^MASA$"), ("landmark", r"^ATOBOY|^ATOMIX"),
    ("landmark", r"^VIA CAROTA"), ("landmark", r"^I SODI"), ("landmark", r"^DON ANGIE"),
    ("landmark", r"^THE DUTCH\b"), ("landmark", r"^BUVETTE"), ("landmark", r"^CAFE LALO"),
    ("landmark", r"^TOM'?S RESTAURANT"), ("landmark", r"^ARTHUR AVENUE"), ("landmark", r"^DENINO'?S"),
    ("landmark", r"^ENOTECA MARIA"), ("landmark", r"^PIZZERIA GIGI|^JOE & PAT'?S"), ("landmark", r"^ROLF'?S"),
    ("landmark", r"^PETER MCMANUS"), ("landmark", r"^MCSORLEY'?S"), ("landmark", r"^WHITE HORSE TAVERN"),
    ("landmark", r"^PJ CLARKE'?S|^P\.? ?J\.? CLARKE'?S"), ("landmark", r"^SAHADI'?S"),
]

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
ROW_FIELDS = ("camis,dba,boro,building,street,zipcode,cuisine_description,inspection_date,action,"
              "violation_code,violation_description,critical_flag,score,grade,grade_date,record_date,inspection_type")


# ----------------------------------------------------------------------------- helpers

def soda(params, retries=5):
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "lantern-lab-eats-pages/0.1", "Accept": "application/json"})
    if APP_TOKEN:
        req.add_header("X-App-Token", APP_TOKEN)
    for i in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:
            if i == retries - 1:
                raise RuntimeError(f"SODA query failed: {e}") from e
            time.sleep(4 * (i + 1))


def day(s):
    return str(s or "")[:10]


def months_before(iso, n):
    d = dt.date.fromisoformat(iso)
    m = d.month - 1 - n
    y = d.year + m // 12
    m = m % 12 + 1
    return dt.date(y, m, min(d.day, 28)).isoformat()


def fmt(iso, long=False):
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", day(iso))
    if not m:
        return ""
    names = MONTHS_LONG if long else MONTHS
    return f"{names[int(m[2]) - 1]} {int(m[3])}, {m[1]}"


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")
    return s or "other"


def load_json(path, default):
    if not os.path.exists(path):
        return default
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, obj, indent=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "wt", encoding="utf-8") as f:
        json.dump(obj, f, indent=indent, ensure_ascii=False, sort_keys=bool(indent))
        if indent:
            f.write("\n")


# ----------------------------------------------------------------------------- select

def fetch_aggregates():
    rows = soda({
        "$select": "camis, max(dba) as dba, max(boro) as boro, count(distinct inspection_date) as d, "
                   "count(distinct date_extract_y(inspection_date)) as y, "
                   "min(inspection_date) as mn, max(inspection_date) as mx, max(record_date) as rd",
        "$where": "inspection_date > '1901-01-01'",
        "$group": "camis",
        "$limit": "100000",
    })
    asof = max(day(r.get("rd")) for r in rows)
    out = []
    for r in rows:
        out.append({"camis": r["camis"], "dba": (r.get("dba") or "").upper().replace("’", "'"),
                    "boro": r.get("boro") or "", "d": int(r["d"]), "y": int(r["y"]),
                    "mn": day(r["mn"]), "mx": day(r["mx"])})
    return out, asof


def fetch_card_grades():
    """Latest card grade (A, B, C, P, Z) per camis, the same rule grades.js uses. No card -> N."""
    rows = soda({
        "$select": "camis, grade, max(inspection_date) as d",
        "$where": "grade in('A','B','C','P','Z')",
        "$group": "camis, grade",
        "$limit": "200000",
    })
    best = {}
    for r in rows:
        if r["camis"] not in best or day(r["d"]) > best[r["camis"]][0]:
            best[r["camis"]] = (day(r["d"]), r["grade"])
    return {c: ("Z" if g == "P" else g) for c, (_, g) in best.items()}  # P and Z are both Grade Pending


def select(existing):
    aggs, asof = fetch_aggregates()
    grades = fetch_card_grades()
    cutoff = months_before(asof, ACTIVE_MONTHS)
    active = [a for a in aggs if a["boro"] in BOROS and a["mx"] >= cutoff]
    for a in active:
        a["g"] = grades.get(a["camis"], "N")
    print(f"restaurants in data: {len(aggs)}, active in the 5 boroughs since {cutoff}: {len(active)}")

    # Grade caps: per borough, no grade may take more than its citywide share (among active
    # restaurants in that borough) of the borough's quota, plus a slot of slack. This keeps
    # the pilot's grade mix close to the city's, so the set never reads as a list of low grades.
    caps = {}
    for b in BOROS:
        mix = collections.Counter(a["g"] for a in active if a["boro"] == b)
        n = sum(mix.values())
        caps[b] = {g: int(QUOTA[b] * mix[g] / n) + 1 for g in ("A", "B", "C", "Z", "N")}

    chosen = collections.OrderedDict()  # camis -> reason
    for c in existing:
        chosen[c["camis"]] = c["reason"]
    count = collections.Counter()
    gcount = collections.Counter()
    by_camis = {a["camis"]: a for a in active}
    for c in chosen:
        if c in by_camis:
            count[by_camis[c]["boro"]] += 1
            gcount[(by_camis[c]["boro"], by_camis[c]["g"])] += 1

    def take(a, reason, capped=True):
        b, g = a["boro"], a["g"]
        if a["camis"] in chosen or count[b] >= QUOTA[b]:
            return False
        if capped and gcount[(b, g)] >= caps[b][g]:
            return False
        chosen[a["camis"]] = reason
        count[b] += 1
        gcount[(b, g)] += 1
        return True

    # 1. Named picks: chains (one flagship-proxy location per borough) and landmarks.
    #    Not grade-capped (people search these by name whatever their grade), but they count
    #    toward the caps.
    named_hits = 0
    for kind, pat in NAMED:
        rx = re.compile(pat)
        hits = [a for a in active if rx.search(a["dba"])]
        hits.sort(key=lambda a: (a["mn"], -a["d"]))  # longest record first
        if kind == "chain":
            seen = set()
            for a in hits:
                if a["boro"] not in seen and take(a, "chain:" + pat, capped=False):
                    seen.add(a["boro"]); named_hits += 1
        else:
            for a in hits[:3]:
                named_hits += take(a, "landmark:" + pat, capped=False)
    print(f"named picks: {named_hits}")

    # 2. Fill each borough's quota, alternating two proxies so neither dominates:
    #    (a) most distinct inspection dates over several years (the requested proxy), and
    #    (b) longest record in the data (earliest inspection), among the same pool.
    #    (a) alone leans toward restaurants that needed re-inspections; (b) and the grade
    #    caps offset that.
    for b in BOROS:
        pool = [a for a in active if a["boro"] == b and a["y"] >= MIN_YEARS]
        lists = [("most-inspection-records", sorted(pool, key=lambda a: (-a["d"], a["mn"], a["camis"]))),
                 ("longest-record", sorted(pool, key=lambda a: (a["mn"], -a["d"], a["camis"])))]
        pos = [0, 0]
        turn = 0
        while count[b] < QUOTA[b] and any(pos[k] < len(lists[k][1]) for k in (0, 1)):
            k = turn % 2 if pos[turn % 2] < len(lists[turn % 2][1]) else 1 - turn % 2
            # advance list k until one restaurant is taken (or the list runs out)
            while pos[k] < len(lists[k][1]):
                a = lists[k][1][pos[k]]; pos[k] += 1
                if take(a, lists[k][0]):
                    break
            turn += 1
        # Slots the caps left open (the pool runs short of some grade, usually N): fill them
        # from the longest-record list, which tracks the citywide mix closely.
        for a in lists[1][1]:
            if count[b] >= QUOTA[b]:
                break
            take(a, "longest-record", capped=False)
    print("per borough:", dict(count))
    mix = collections.Counter(g for (_, g), n in gcount.items() for _ in range(n))
    print("grade mix at selection:", dict(mix))
    return [{"camis": c, "reason": r} for c, r in chosen.items()], asof


# ----------------------------------------------------------------------------- fetch

def fetch_rows(camis_list):
    out = {c: [] for c in camis_list}
    for i in range(0, len(camis_list), BATCH):
        ids = camis_list[i:i + BATCH]
        rows = soda({
            "$select": ROW_FIELDS,
            "$where": "camis in(" + ",".join(f"'{c}'" for c in ids) + ")",
            "$order": "camis, inspection_date DESC",
            "$limit": "50000",
        })
        for r in rows:
            out.setdefault(r["camis"], []).append(r)
        print(f"  rows {i + len(ids)}/{len(camis_list)}", end="\r", flush=True)
    print()
    return out


def fetch_asof():
    r = soda({"$select": "max(record_date) as rd"})
    return day(r[0]["rd"])


# ----------------------------------------------------------------------------- render

CSS = """:root{--paper:#f7f2e8;--sheet:#fffdf8;--ink:#1d1b18;--muted:#5e574c;--line:#d9cfbd;--A:#1f6b4a;--B:#9a6412;--C:#9e3d2a;--Z:#3f5873;--N:#5e574c;--accent:#1d1b18;--accent-ink:#f7f2e8;--focus:#2a62c9;--crit:#8f2f1f;--crit-bg:#f6e1da;--warn-bg:#f3e7cf;--font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#17150f;--sheet:#1f1c16;--ink:#f2ece0;--muted:#b8ae9c;--line:#3a352b;--A:#5fbf8f;--B:#e0a44a;--C:#ec8a74;--Z:#8fb0d6;--N:#b8ae9c;--accent:#f2ece0;--accent-ink:#17150f;--focus:#8fb0ff;--crit:#ffb4a3;--crit-bg:#3a221c;--warn-bg:#33291a;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#17150f;--sheet:#1f1c16;--ink:#f2ece0;--muted:#b8ae9c;--line:#3a352b;--A:#5fbf8f;--B:#e0a44a;--C:#ec8a74;--Z:#8fb0d6;--N:#b8ae9c;--accent:#f2ece0;--accent-ink:#17150f;--focus:#8fb0ff;--crit:#ffb4a3;--crit-bg:#3a221c;--warn-bg:#33291a;color-scheme:dark}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.5 var(--font);overflow-x:hidden}
a{color:inherit;text-underline-offset:3px}:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.wrap{max-width:760px;margin:0 auto;padding:0 16px}
nav.crumbs{padding-top:20px;font-size:14px;color:var(--muted)}nav.crumbs ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px}
nav.crumbs li:not(:last-child)::after{content:"\\203A";margin-left:4px}nav.crumbs a{color:var(--muted)}
h1{font-size:clamp(30px,8vw,46px);line-height:1.05;letter-spacing:-.02em;margin:12px 0 6px;font-weight:900;overflow-wrap:anywhere}
h2{font-size:22px;margin:32px 0 10px;letter-spacing:-.01em}
.meta{color:var(--muted);margin:0 0 16px}
.card{background:var(--sheet);border:1px solid var(--line);border-radius:16px;padding:16px;margin:12px 0}
.grade{display:flex;gap:16px;align-items:center}
.badge{flex:none;width:84px;height:84px;border-radius:14px;border:4px solid currentColor;display:grid;place-items:center;font-size:52px;font-weight:900;line-height:1}
.badge.word{font-size:15px;text-align:center;line-height:1.15;padding:4px}
.g-A{color:var(--A)}.g-B{color:var(--B)}.g-C{color:var(--C)}.g-Z,.g-P{color:var(--Z)}.g-N,.g-{color:var(--N)}
.grade p{margin:0}.glabel{font-weight:900;font-size:20px}.small{font-size:14px;color:var(--muted)}
.note{background:var(--warn-bg);border-radius:10px;padding:10px 12px;margin:10px 0 0;font-size:15px}
.status{border:2px solid var(--line);background:var(--warn-bg)}
.cta{display:block;text-align:center;background:var(--accent);color:var(--accent-ink);text-decoration:none;font-weight:800;font-size:18px;padding:14px 18px;border-radius:12px;margin:16px 0 4px}
.ins h3{margin:0;font-size:18px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
.ins .sc{font-weight:900}.ins .typ{font-size:14px;color:var(--muted);margin:2px 0 0}
ul.viol{list-style:none;margin:10px 0 0;padding:0}ul.viol li{border-top:1px solid var(--line);padding:10px 0}
.vh{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:2px}
.code,.flag{font-size:12px;font-weight:800;border-radius:6px;padding:1px 6px;border:1px solid var(--line)}
.flag.crit{background:var(--crit-bg);color:var(--crit);border-color:transparent}
.plain{margin:0}.off{margin:2px 0 0;font-size:13px;color:var(--muted)}
.how p{margin:0 0 10px}.how p:last-child{margin:0}
ul.list{list-style:none;margin:0;padding:0}ul.list li{border-top:1px solid var(--line);padding:10px 0;display:flex;justify-content:space-between;gap:12px}
ul.list li span{color:var(--muted);font-size:14px}ul.list a{font-weight:700}ul.list .gl{flex:none;font-weight:800;font-size:14px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}.chips a{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:6px 12px;text-decoration:none;font-weight:700;font-size:15px;background:var(--sheet)}
footer{border-top:1px solid var(--line);margin-top:40px;padding:20px 0 40px;color:var(--muted);font-size:14px}footer a{color:var(--ink);font-weight:700}
"""


def head(title, desc, canonical, css_href, crumbs, robots=None):
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList",
          "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(crumbs)]}
    return (
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
        f"<title>{esc(title)}</title>\n<meta name=\"description\" content=\"{esc(desc)}\">\n"
        f"<link rel=\"canonical\" href=\"{esc(canonical)}\">\n"
        + (f"<meta name=\"robots\" content=\"{robots}\">\n" if robots else "")
        + "<meta name=\"theme-color\" content=\"#f7f2e8\">\n"
        f"<meta property=\"og:type\" content=\"website\">\n<meta property=\"og:site_name\" content=\"Lantern Lab\">\n"
        f"<meta property=\"og:title\" content=\"{esc(title)}\">\n<meta property=\"og:description\" content=\"{esc(desc)}\">\n"
        f"<meta property=\"og:url\" content=\"{esc(canonical)}\">\n"
        f"<link rel=\"stylesheet\" href=\"{css_href}\">\n"
        "<script type=\"application/ld+json\">" + json.dumps(ld, ensure_ascii=False).replace("</", "<\\/") + "</script>\n"
        "</head>\n<body>\n"
    )


def crumbs_html(crumbs, rel):
    """crumbs: [(name, absolute url)], rel: same list of relative hrefs (None for current)."""
    items = []
    for (n, _), h in zip(crumbs, rel):
        items.append(f"<li><a href=\"{h}\">{esc(n)}</a></li>" if h else f"<li aria-current=\"page\">{esc(n)}</li>")
    return "<nav class=\"crumbs wrap\" aria-label=\"Breadcrumb\"><ol>" + "".join(items) + "</ol></nav>\n"


def footer(rel_app, rel_lab, asof):
    return (
        "<footer class=\"wrap\">\n"
        f"<p>Data: NYC Department of Health and Mental Hygiene (DOHMH) restaurant inspection results, published on "
        f"<a href=\"{DATASET_URL}\" rel=\"noopener\">NYC Open Data (43nn-pn8j)</a>, as of {esc(fmt(asof, True))}. "
        "The plain-English summaries are Lantern Lab's own paraphrases; the official DOHMH wording is shown under each one.</p>\n"
        "<p><b>Not affiliated with NYC DOHMH</b> or the City of New York. Open data can lag the city's own site and can contain errors. "
        f"For the official record, use <a href=\"{DOH_ABC}\" rel=\"noopener\">ABCEats on nyc.gov</a> or the grade card posted at the restaurant.</p>\n"
        f"<p><a href=\"{rel_app}\">NYC Restaurant Report Card</a> · <a href=\"{rel_lab}\">More free NYC tools from Lantern Lab</a></p>\n"
        "</footer>\n</body>\n</html>\n"
    )


HOW = (
    "<section class=\"card how\" aria-labelledby=\"how\">\n<h2 id=\"how\" style=\"margin-top:0\">How NYC restaurant grades work</h2>\n"
    "<p>The city's Health Department (DOHMH) inspects restaurants unannounced, at least once a year. Each violation adds points, "
    "so a lower score is better: <b>0 to 13 points is an A, 14 to 27 a B, and 28 or more a C</b>.</p>\n"
    "<p>An initial inspection is graded only if it earns an A. Otherwise DOHMH returns for a re-inspection, typically within a month, "
    "and grades that. A restaurant that gets a B or C may post a Grade Pending card (code Z) until its hearing at the Office of "
    "Administrative Trials and Hearings. Code P is a Grade Pending card issued when a restaurant re-opens after a closure, and N means "
    "not yet graded. Scores can change after a hearing.</p>\n"
    "<p><b>One inspection is a snapshot</b> of one visit on one day. It doesn't show how a kitchen runs on other days, and it is not a "
    "rating of the food or service.</p>\n"
    f"<p class=\"small\">Sources: DOHMH, <a href=\"{DOH_FAQ}\" rel=\"noopener\">How We Score and Grade</a> and "
    f"<a href=\"{DOH_GRADING}\" rel=\"noopener\">Letter Grading for Restaurants</a>; the grade codes are from the "
    f"<a href=\"{DATASET_URL}\" rel=\"noopener\">dataset's documentation</a>.</p>\n</section>\n"
)


def badge(g):
    if g in ("A", "B", "C"):
        return f"<div class=\"badge g-{g}\" aria-hidden=\"true\">{g}</div>"
    word = "Grade<br>Pending" if g in ("Z", "P") else ("Not yet<br>graded" if g == "N" else "No<br>grade")
    return f"<div class=\"badge word g-{esc(g)}\" aria-hidden=\"true\">{word}</div>"


def short_grade(g):
    return {"A": "Grade A", "B": "Grade B", "C": "Grade C", "Z": "Grade Pending", "P": "Grade Pending", "N": "Not yet graded"}.get(g, "No grade")


def place_line(idn):
    return ", ".join(x for x in [idn.get("address"), idn.get("boro"), idn.get("zip")] if x)


def inspection_html(i):
    if i["score"] is None:
        sc = "No score"
    else:
        sc = f"{i['score']} point{'s' if i['score'] != 1 else ''}"
        if i.get("band"):
            sc += f" <span class=\"small\">({i['band']} range)</span>"
    n = len(i["violations"])
    meta = f"{esc(i['gradeLabel'])} · {n} violation{'s' if n != 1 else ''}" + (f" · {i['critical']} critical" if i["critical"] else "")
    out = [f"<article class=\"card ins\">\n<h3><span>{esc(fmt(i['date'], True))}</span><span class=\"sc g-{esc(i.get('band') or '')}\">{sc}</span></h3>\n"
           f"<p class=\"typ\">{esc(i['type'] or 'Inspection')} · {meta}</p>\n"]
    if i.get("action"):
        out.append(f"<p class=\"typ\">Action recorded: {esc(i['action'])}</p>\n")
    if n:
        out.append("<ul class=\"viol\">\n")
        for v in i["violations"]:
            flag = f"<span class=\"flag{' crit' if v['critical'] else ''}\">{esc(v['flag'])}</span>" if v["flag"] else ""
            code = f"<span class=\"code\">Code {esc(v['code'])}</span>" if v["code"] else ""
            body = f"<p class=\"plain\">{esc(v['plain'])}</p>" if v["plain"] else ""
            off = v["text"] or "(no description in the data)"
            body += f"<p class=\"off\">{'Official text: ' if v['plain'] else ''}{esc(off)}</p>"
            out.append(f"<li><div class=\"vh\">{code}{flag}</div>{body}</li>\n")
        out.append("</ul>\n")
    out.append("</article>\n")
    return "".join(out)


def restaurant_title(idn, disambig=None):
    """Longest of the title forms that fits in 65 characters (SEO audit Nov 15:
    the single long form ran to 110). The address stays in every form, because it
    tells chain locations apart, and the borough is dropped only as a last resort. `disambig` (the cuisine, or the permit number) is
    added only when two listed restaurants would otherwise share a title."""
    name = idn["name"] or "Restaurant"
    boro = idn.get("boro") or ""
    addr = idn.get("address") or boro
    tail = f", {boro}" if boro and addr != boro else ""
    forms = [f"{name} Health Grade and Inspections, {addr}{tail}",
             f"{name} Health Grade, {addr}{tail}",
             f"{name} Health Grade, {addr}"]
    title = next((t for t in forms if len(t) <= 65), forms[-1])
    if disambig:
        title += f" ({disambig})"
    return title


def restaurant_page(camis, c, asof, stale, neighbors, cuisine_pages, in_data=True, disambig=None, more=None):
    idn = c["id"]
    name = idn["name"] or "Restaurant"
    boro = idn.get("boro") or ""
    place = place_line(idn)
    g = c["grade"]
    canonical = f"{R_URL}{camis}.html"
    crumbs = [("Lantern Lab", SITE), ("NYC Restaurant Report Card", APP_URL), ("Restaurant pages", R_URL)]
    rel = ["../../", "../", "./"]
    if boro in BORO_SLUG:
        crumbs.append((boro, f"{R_URL}borough/{BORO_SLUG[boro]}.html"))
        rel.append(f"borough/{BORO_SLUG[boro]}.html")
    crumbs.append((name, canonical))
    rel.append(None)

    title = restaurant_title(idn, disambig)
    if disambig:  # keep the description unique too
        place = f"{place} ({disambig})"
    if stale:
        desc = (f"{name}, {place}: closed or no recent inspection. Last NYC health inspection on record {fmt(c['latestDate'])}; "
                f"its last grade and inspections, from DOHMH data as of {fmt(asof)}.")
    elif g in ("A", "B", "C"):
        desc = (f"{name}, {place}: NYC health inspection grade {g} (issued {fmt(c['gradeDate'])}). "
                f"Last 3 inspections with scores and violations in plain English. DOHMH data as of {fmt(asof)}.")
    else:
        desc = (f"{name}, {place}: {c['label']} in NYC health inspections. Last 3 inspections with scores and "
                f"violations in plain English. DOHMH data as of {fmt(asof)}.")

    p = [head(title, desc, canonical, "r.css", crumbs), crumbs_html(crumbs, rel), "<main class=\"wrap\">\n"]
    p.append(f"<h1>{esc(name)}</h1>\n<p class=\"meta\">{esc(place)}"
             + (f" · {esc(idn['cuisine'])}" if idn.get("cuisine") else "") + "</p>\n")
    if stale:
        p.append("<section class=\"card status\" role=\"note\"><p style=\"margin:0\"><b>Closed or no recent inspection.</b> "
                 f"The most recent inspection in the open data is from {esc(fmt(c['latestDate'], True))}. "
                 "DOHMH inspects open restaurants at least once a year, so this restaurant may have closed, moved or changed its permit. "
                 "The information below is the last on record.</p></section>\n")
    # current grade
    lab = c["label"] + (f" (code {g})" if g in ("Z", "P", "N") else "")
    when = f"Issued {fmt(c['gradeDate'], True)}" if c["gradeDate"] else "No grade card on record"
    score = f" on an inspection that scored {c['gradedScore']} points" if c["gradeDate"] and c["gradedScore"] is not None else ""
    p.append(f"<section class=\"card\" aria-labelledby=\"cur\">\n<div class=\"grade\">{badge(g)}<div>"
             f"<p class=\"small\" id=\"cur\">{'Last grade on record' if stale else 'Current grade'}</p><p class=\"glabel g-{esc(g)}\">{esc(lab)}</p>"
             f"<p>{esc(when + score)}.</p></div></div>\n"
             f"<p class=\"small\" style=\"margin:10px 0 0\">{esc(c['explainer'])}</p>\n")
    for n in c["notes"]:
        p.append(f"<p class=\"note\">{esc(n['text'])}</p>\n")
    p.append(f"<p class=\"small\" style=\"margin:10px 0 0\">Data as of {esc(fmt(asof, True))} (NYC Open Data). "
             f"{c['inspections']} inspection{'s' if c['inspections'] != 1 else ''} on record"
             + (f"; most recent {esc(fmt(c['latestDate']))}." if c["latestDate"] else ".") + "</p>\n</section>\n")
    if not in_data:  # gone from the open data: the app's ?camis= view would come back empty
        p.append("<a class=\"cta\" href=\"../\">Search current restaurants</a>\n"
                 "<p class=\"small\" style=\"text-align:center;margin:0\">This restaurant is no longer in the city's open data.</p>\n")
    else:
        p.append(f"<a class=\"cta\" href=\"../?camis={camis}\">Full history and share card</a>\n"
             "<p class=\"small\" style=\"text-align:center;margin:0\">Every inspection, a score chart and a shareable report card, from live city data.</p>\n")
    # recent inspections
    k = len(c["recent"])
    p.append(f"<h2>{'Last ' + str(k) + ' inspections' if k > 1 else ('Last inspection' if k else 'Inspections')}</h2>\n")
    p.append("<p class=\"small\">Most recent first. Plain-English summaries are our paraphrase of each DOHMH violation code; the official text follows.</p>\n")
    if not k:
        p.append("<p>No inspections on record yet.</p>\n")
    for i in c["recent"]:
        p.append(inspection_html(i))
    p.append(HOW)
    # browse
    links = []
    if boro in BORO_SLUG:
        links.append(f"<li><a href=\"borough/{BORO_SLUG[boro]}.html\">Restaurants in {esc(BORO_IN[boro])}</a></li>")
    cs = slug(idn.get("cuisine") or "")
    if cs in cuisine_pages:
        links.append(f"<li><a href=\"cuisine/{cs}.html\">{esc(cuisine_pages[cs])} restaurants</a></li>")
    links.append("<li><a href=\"./\">All restaurant pages</a></li>")
    p.append("<h2>Browse</h2>\n<ul class=\"chips\">" + "".join(links) + "</ul>\n")
    if neighbors:
        p.append(f"<h2>Also in ZIP {esc(idn.get('zip'))}</h2>\n<ul class=\"list\">\n")
        for ncamis, nc in neighbors:
            p.append(f"<li><a href=\"{ncamis}.html\">{esc(nc['id']['name'])}</a><span>{esc(nc['id'].get('address'))}</span></li>\n")
        p.append("</ul>\n")
    if more:
        label, items = more
        p.append(f"<h2>More {esc(label)}</h2>\n<ul class=\"list\">\n")
        for ncamis, nc in items:
            sub = ", ".join(x for x in [nc['id'].get('address'), nc['id'].get('zip')] if x)
            p.append(f"<li><a href=\"{ncamis}.html\">{esc(nc['id']['name'])}</a><span>{esc(sub)}</span></li>\n")
        p.append("</ul>\n")
    p.append("</main>\n")
    p.append(footer("../", "../../", asof))
    return "".join(p)


def list_items(entries, prefix, stale_set):
    out = ["<ul class=\"list\">\n"]
    for camis, c in entries:
        idn = c["id"]
        sub = ", ".join(x for x in [idn.get("address"), idn.get("zip")] if x)
        gl = "Closed or no recent inspection" if camis in stale_set else short_grade(c["grade"])
        out.append(f"<li><div><a href=\"{prefix}{camis}.html\">{esc(idn['name'])}</a><br><span>{esc(sub)}"
                   + (f" · {esc(idn['cuisine'])}" if idn.get("cuisine") else "")
                   + f"</span></div><span class=\"gl\">{esc(gl)}</span></li>\n")
    out.append("</ul>\n")
    return "".join(out)


def index_page(kind, key, label, entries, asof, stale_set, n_total):
    if kind == "root":
        canonical, css, prefix, app, lab = R_URL, "r.css", "", "../", "../../"
        crumbs = [("Lantern Lab", SITE), ("NYC Restaurant Report Card", APP_URL), ("Restaurant pages", R_URL)]
        rel = ["../../", "../", None]
    else:
        canonical = f"{R_URL}{kind}/{key}.html"
        css, prefix, app, lab = "../r.css", "../", "../../", "../../../"
        crumbs = [("Lantern Lab", SITE), ("NYC Restaurant Report Card", APP_URL), ("Restaurant pages", R_URL), (label, canonical)]
        rel = ["../../../", "../../", "../", None]
    return crumbs, canonical, css, prefix, app, lab, rel


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def render():
    pilot = load_json(PILOT, None)
    if not pilot:
        sys.exit("no pilot.json; run `build.py select` first")
    rows = load_json(os.path.join(CACHE, "rows.json"), {})
    meta = load_json(os.path.join(CACHE, "meta.json"), {})
    asof = meta.get("asof") or dt.date.today().isoformat()

    comp_path = os.path.join(CACHE, "computed.json")
    subprocess.run(["node", os.path.join(HERE, "compute.js"), os.path.join(CACHE, "rows.json"), comp_path], check=True)
    fresh = load_json(comp_path, {})
    last = load_json(LAST_KNOWN, {})

    stale_cut = months_before(asof, STALE_MONTHS)
    data, stale = {}, set()
    for p in pilot["restaurants"]:
        camis = p["camis"]
        c = fresh.get(camis) or last.get(camis)
        if not c:
            print(f"  skip {camis}: no data now or before")
            continue
        for k in ("address", "street", "name"):
            c["id"][k] = re.sub(r"\s+", " ", c["id"].get(k) or "").strip()
        data[camis] = c
        if camis not in fresh or (c.get("latestDate") or "") < stale_cut:
            stale.add(camis)
    # Remember the newest data for every restaurant ever listed, so a page survives the
    # restaurant dropping out of the open data.
    last.update({k: v for k, v in fresh.items() if k in data})
    save_json(LAST_KNOWN, last)

    def name_key(item):
        return (item[1]["id"]["name"].lower(), item[1]["id"].get("address", ""), item[0])

    by_boro = collections.defaultdict(list)
    by_cuisine = collections.defaultdict(list)
    by_zip = collections.defaultdict(list)
    cuisine_label = {}
    for camis, c in data.items():
        idn = c["id"]
        if idn.get("boro") in BORO_SLUG:
            by_boro[idn["boro"]].append((camis, c))
        cu = idn.get("cuisine") or ""
        if cu and not re.search(r"not listed|not applicable", cu, re.I):
            by_cuisine[slug(cu)].append((camis, c))
            cuisine_label[slug(cu)] = cu
        if idn.get("zip"):
            by_zip[idn["zip"]].append((camis, c))
    cuisine_pages = {s: cuisine_label[s] for s, v in by_cuisine.items() if len(v) >= MIN_CUISINE_PAGE}

    os.makedirs(OUT, exist_ok=True)
    write(os.path.join(OUT, "r.css"), CSS)
    # Titles that would collide (e.g. two counters of one chain at one airport address)
    # get the cuisine, or failing that the permit number, appended.
    tcount = collections.Counter(restaurant_title(c["id"]) for c in data.values())
    disambig = {}
    for camis, c in data.items():
        t = restaurant_title(c["id"])
        if tcount[t] > 1:
            same = [k for k, v in data.items() if restaurant_title(v["id"]) == t]
            cus = [data[k]["id"].get("cuisine") or "" for k in same]
            cu = c["id"].get("cuisine") or ""
            disambig[camis] = cu if cu and cus.count(cu) == 1 else f"permit {camis}"

    def rotate(items, camis, n):
        """The n entries after this restaurant in alphabetical order, wrapping, so
        related links spread across the list instead of always naming the same
        alphabetically-first places (SEO audit Nov 15)."""
        items = sorted(items, key=name_key)
        i = next((j for j, x in enumerate(items) if x[0] == camis), -1)
        out = [x for x in items[i + 1:] + items[:max(i, 0)] if x[0] != camis]
        return out[:n]

    for camis, c in data.items():
        z = c["id"].get("zip")
        b = c["id"].get("boro")
        nb = rotate(by_zip.get(z, []), camis, 6) if z else []
        more = None
        if len(nb) < 3:  # fill to 3 with the same cuisine in the same borough, then the same borough
            cs = slug(c["id"].get("cuisine") or "")
            seen = {camis} | {x[0] for x in nb}
            pool = [x for x in by_cuisine.get(cs, []) if x[1]["id"].get("boro") == b and x[0] not in seen]
            label = f"{cuisine_label[cs]} restaurants in {BORO_IN.get(b, b)}" if pool and cs in cuisine_label else None
            fill = rotate(pool + [(camis, c)], camis, 3 - len(nb))
            if len(fill) < 3 - len(nb):
                seen |= {x[0] for x in fill}
                rest = [x for x in by_boro.get(b, []) if x[0] not in seen]
                fill += rotate(rest + [(camis, c)], camis, 3 - len(nb) - len(fill))
                label = f"restaurants in {BORO_IN.get(b, b)}"
            if fill:
                more = (label or f"restaurants in {BORO_IN.get(b, b)}", fill)
        write(os.path.join(OUT, f"{camis}.html"), restaurant_page(camis, c, asof, camis in stale, nb, cuisine_pages, camis in fresh,
                                                                  disambig.get(camis), more))

    total = len(data)
    pages = []  # (url, path)

    # borough pages
    for b in BOROS:
        entries = sorted(by_boro.get(b, []), key=name_key)
        if not entries:
            continue
        key = BORO_SLUG[b]
        crumbs, canonical, css, prefix, app, lab, rel = index_page("borough", key, b, entries, asof, stale, total)
        title = f"Restaurant Health Grades in {BORO_IN[b]}: {len(entries)} NYC Restaurants"
        desc = (f"Current NYC health inspection grades and recent inspections for {len(entries)} restaurants in {BORO_IN[b]}, "
                f"listed alphabetically, from DOHMH open data as of {fmt(asof)}.")
        body = [head(title, desc, canonical, css, crumbs), crumbs_html(crumbs, rel), "<main class=\"wrap\">\n",
                f"<h1>Restaurants in {esc(BORO_IN[b])}</h1>\n",
                f"<p class=\"meta\">{len(entries)} restaurants, listed alphabetically, each with its current DOHMH grade and last three inspections. "
                f"Data as of {esc(fmt(asof, True))}. This is a selection of frequently looked-up restaurants, not every restaurant in {esc(BORO_IN[b])}; "
                f"<a href=\"{app}\">search any restaurant in the app</a>.</p>\n",
                list_items(entries, prefix, stale), "</main>\n", footer(app, lab, asof)]
        write(os.path.join(OUT, "borough", f"{key}.html"), "".join(body))
        pages.append(canonical)

    # cuisine pages
    for s, label in sorted(cuisine_pages.items(), key=lambda kv: kv[1].lower()):
        entries = sorted(by_cuisine[s], key=lambda it: (it[1]["id"].get("boro", ""),) + name_key(it))
        crumbs, canonical, css, prefix, app, lab, rel = index_page("cuisine", s, label, entries, asof, stale, total)
        title = f"{label} Restaurants in NYC: Health Grades and Inspections"
        desc = (f"Current NYC health inspection grades for {len(entries)} {label} restaurants, by borough, "
                f"with each one's last three inspections. DOHMH open data as of {fmt(asof)}.")
        body = [head(title, desc, canonical, css, crumbs), crumbs_html(crumbs, rel), "<main class=\"wrap\">\n",
                f"<h1>{esc(label)} restaurants</h1>\n",
                f"<p class=\"meta\">{len(entries)} restaurants listed as {esc(label)} in DOHMH's data, grouped by borough and listed alphabetically. "
                f"Data as of {esc(fmt(asof, True))}. A selection, not every {esc(label)} restaurant in NYC; "
                f"<a href=\"{app}\">search any restaurant in the app</a>.</p>\n"]
        for b in BOROS:
            sub = [e for e in entries if e[1]["id"].get("boro") == b]
            if sub:
                body.append(f"<h2>{esc(b)}</h2>\n" + list_items(sub, prefix, stale))
        body += ["</main>\n", footer(app, lab, asof)]
        write(os.path.join(OUT, "cuisine", f"{s}.html"), "".join(body))
        pages.append(canonical)

    # root index
    crumbs, canonical, css, prefix, app, lab, rel = index_page("root", "", "", [], asof, stale, total)
    title = "NYC Restaurant Health Grades by Borough and Cuisine"
    desc = (f"Static pages with the current NYC health inspection grade and last three inspections for {total} frequently "
            f"looked-up restaurants, by borough and cuisine. DOHMH open data as of {fmt(asof)}.")
    body = [head(title, desc, canonical, css, crumbs), crumbs_html(crumbs, rel), "<main class=\"wrap\">\n",
            "<h1>Restaurant pages</h1>\n",
            f"<p class=\"meta\">One page per restaurant for {total} frequently looked-up NYC restaurants: the current DOHMH grade, "
            f"the last three inspections and each violation in plain English. Data as of {esc(fmt(asof, True))}. "
            f"For any other restaurant, <a href=\"{app}\">search the Report Card</a>.</p>\n",
            "<h2>By borough</h2>\n<ul class=\"chips\">"]
    for b in BOROS:
        if by_boro.get(b):
            body.append(f"<li><a href=\"borough/{BORO_SLUG[b]}.html\">{esc(b)} ({len(by_boro[b])})</a></li>")
    body.append("</ul>\n<h2>By cuisine</h2>\n<ul class=\"chips\">")
    for s, label in sorted(cuisine_pages.items(), key=lambda kv: kv[1].lower()):
        body.append(f"<li><a href=\"cuisine/{s}.html\">{esc(label)} ({len(by_cuisine[s])})</a></li>")
    body.append("</ul>\n")
    others = sorted([it for s, v in by_cuisine.items() if s not in cuisine_pages for it in v]
                    + [it for it in data.items() if slug(it[1]["id"].get("cuisine") or "") not in by_cuisine], key=name_key)
    if others:
        body.append(f"<h2>Other cuisines</h2>\n<p class=\"small\">Cuisines with fewer than {MIN_CUISINE_PAGE} restaurants in this set.</p>\n"
                    + list_items(others, prefix, stale))
    body.append(HOW)
    body += ["</main>\n", footer(app, lab, asof)]
    write(os.path.join(OUT, "index.html"), "".join(body))

    # sitemaps
    urls = [R_URL] + pages + [f"{R_URL}{c}.html" for c in sorted(data)]
    sm = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n"]
    sm += [f"  <url><loc>{u}</loc><lastmod>{asof}</lastmod></url>\n" for u in urls]
    sm.append("</urlset>\n")
    write(os.path.join(DOCS, "sitemap-eats.xml"), "".join(sm))
    update_sitemap_index(asof)
    print(f"rendered {total} restaurant pages ({len(stale)} marked closed or no recent inspection), "
          f"{len(pages)} index pages + r/index.html; sitemap has {len(urls)} URLs")


def update_sitemap_index(asof):
    path = os.path.join(DOCS, "sitemap-index.xml")
    loc = SITE + "sitemap-eats.xml"
    entry = f"  <sitemap><loc>{loc}</loc><lastmod>{asof}</lastmod></sitemap>\n"
    with open(path, encoding="utf-8") as f:
        text = f.read()
    if loc in text:
        text = re.sub(r"  <sitemap><loc>" + re.escape(loc) + r"</loc>.*?</sitemap>\n", entry, text)
    else:
        text = text.replace("</sitemapindex>", entry + "</sitemapindex>")
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


# ----------------------------------------------------------------------------- main

def cmd_select(reselect):
    existing = load_json(PILOT, {}).get("restaurants", []) if reselect else []
    chosen, asof = select(existing)
    save_json(PILOT, {"selected": asof, "note": "Pilot set; see NOTES.md. Re-running select merges, never drops.",
                      "restaurants": chosen}, indent=1)
    print(f"pilot.json: {len(chosen)} restaurants")


def cmd_fetch():
    pilot = load_json(PILOT, None)
    if not pilot:
        sys.exit("no pilot.json; run `build.py select` first")
    camis = [p["camis"] for p in pilot["restaurants"]]
    rows = fetch_rows(camis)
    rows = {k: v for k, v in rows.items() if v}
    asof = fetch_asof()
    save_json(os.path.join(CACHE, "rows.json"), rows)
    save_json(os.path.join(CACHE, "meta.json"), {"asof": asof, "fetched": dt.datetime.now(dt.timezone.utc).isoformat()})
    print(f"fetched rows for {len(rows)}/{len(camis)} restaurants; data as of {asof}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stage", choices=["select", "fetch", "render", "all"])
    ap.add_argument("--reselect", action="store_true", help="with all/select: add new picks to the existing pilot.json")
    a = ap.parse_args()
    if a.stage == "select":
        cmd_select(a.reselect or os.path.exists(PILOT))
    elif a.stage == "fetch":
        cmd_fetch()
    elif a.stage == "render":
        render()
    else:
        if a.reselect or not os.path.exists(PILOT):
            cmd_select(os.path.exists(PILOT))
        cmd_fetch()
        render()


if __name__ == "__main__":
    main()
