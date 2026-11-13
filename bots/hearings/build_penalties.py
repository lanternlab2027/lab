#!/usr/bin/env python3
"""NYC Hearing Watch -- build docs/hearings/penalties.json.

Pulls aggregate default-vs-appear penalty figures from the OATH Hearings
Division Case Status dataset (jz4z-kudi) on NYC Open Data, so the lookup page
can say "a default on this kind of summons typically costs $X" without running
slow aggregate queries in the visitor's browser.

Standard library only. No personal data is fetched: every query is a
GROUP BY aggregate (counts, sums, medians); no respondent fields are selected.

Usage:
  python3 build_penalties.py                       # writes ../../docs/hearings/penalties.json
  python3 build_penalties.py --today 2026-11-13 --out /tmp/p.json
"""
import argparse, datetime as dt, json, os, sys, time
import urllib.parse, urllib.request, urllib.error

API = "https://data.cityofnewyork.us/resource/jz4z-kudi.json"
APP_TOKEN = os.environ.get("SOCRATA_APP_TOKEN")  # optional; raises rate limits

DEFAULT = ("DEFAULTED", "Default/ No Appearance")
IN_VIOL = ("IN VIOLATION",)
# Dismissals appear under several labels ("DISMISSED", "Dismissed - Failure to Prosecute", ...).
DISMISSED_SQL = "(hearing_result = 'DISMISSED' OR hearing_result like 'Dismissed%')"

# Agencies shown in the page's comparison table (the big summons issuers).
AGENCIES = {
    "SANITATION OTHERS": "Sanitation (DSNY)",
    "DOS - ENFORCEMENT AGENTS": "Sanitation enforcement agents",
    "SANITATION RECYCLING": "Sanitation recycling",
    "DEPT. OF BUILDINGS": "Buildings (DOB)",
    "FIRE DEPARTMENT OF NYC": "Fire Dept (FDNY)",
    "DEP - BUREAU OF ENV. COMPLIANC": "Environmental Protection (DEP)",
    "PCS - DOHMH": "Health Dept (DOHMH) pest control",
    "DEPT OF TRANSPORTATION": "Transportation (DOT)",
}


def soda(**params):
    q = urllib.parse.urlencode({"$" + k: v for k, v in params.items()})
    req = urllib.request.Request(API + "?" + q, headers={"User-Agent": "hearing-watch-stats/0.1"})
    if APP_TOKEN:
        req.add_header("X-App-Token", APP_TOKEN)
    for i in range(5):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or i == 4:
                raise
        except urllib.error.URLError:
            if i == 4:
                raise
        time.sleep(3 * 2 ** i)


def lit(xs):
    return ",".join("'" + x.replace("'", "''") + "'" for x in xs)


def num(v, nd=2):
    return round(float(v), nd) if v not in (None, "") else None


def agency_block(where):
    """Default / in-violation / dismissed figures per agency for a date window."""
    out = {}
    for label, cond in (("default", f"hearing_result in ({lit(DEFAULT)})"),
                        ("in_violation", f"hearing_result in ({lit(IN_VIOL)})"),
                        ("dismissed", DISMISSED_SQL)):
        rows = soda(select="issuing_agency, count(*) as n, avg(penalty_imposed) as avg, median(penalty_imposed) as med",
                    where=f"{where} AND issuing_agency in ({lit(AGENCIES)}) AND {cond}",
                    group="issuing_agency", limit=100)
        for r in rows:
            a = out.setdefault(r["issuing_agency"], {"label": AGENCIES[r["issuing_agency"]]})
            a[label] = {"n": int(r["n"]), "avg": num(r.get("avg")), "median": num(r.get("med"))}
    return out


def code_block(where, min_n):
    """Per charge-#1 code: default vs in-violation penalty (median and mean)."""
    codes = {}
    for label, cond in (("default", f"hearing_result in ({lit(DEFAULT)})"),
                        ("in_violation", f"hearing_result in ({lit(IN_VIOL)})")):
        rows = soda(select="charge_1_code, count(*) as n, avg(penalty_imposed) as avg, median(penalty_imposed) as med",
                    where=f"{where} AND charge_1_code IS NOT NULL AND {cond}",
                    group="charge_1_code", having=f"count(*) >= {min_n}", limit=50000)
        for r in rows:
            codes.setdefault(r["charge_1_code"], {})[label] = [int(r["n"]), num(r.get("med")), num(r.get("avg"))]
    return codes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--today", default=dt.date.today().isoformat())
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "hearings", "penalties.json"))
    ap.add_argument("--recent-days", type=int, default=60)
    a = ap.parse_args()

    today = dt.date.fromisoformat(a.today)
    end = (today - dt.timedelta(days=1)).isoformat()            # through yesterday
    recent_start = (today - dt.timedelta(days=a.recent_days)).isoformat()
    year_start = (today - dt.timedelta(days=365)).isoformat()
    ytd_start = f"{today.year}-01-01"
    W = lambda s: f"hearing_date between '{s}' and '{end}T23:59:59'"

    print("headline...", file=sys.stderr)
    res = soda(select="hearing_result, count(*) as n, sum(penalty_imposed) as pen", where=W(ytd_start), group="hearing_result", limit=500)
    total = sum(int(r["n"]) for r in res)
    no_result = sum(int(r["n"]) for r in res if not r.get("hearing_result"))
    defaults = sum(int(r["n"]) for r in res if r.get("hearing_result") in DEFAULT)
    def_pen = sum(float(r.get("pen") or 0) for r in res if r.get("hearing_result") in DEFAULT)
    upcoming = int(soda(select="count(*) as n", where=f"hearing_date >= '{today.isoformat()}'")[0]["n"])

    print("agencies...", file=sys.stderr)
    ag_recent = agency_block(W(recent_start))
    ag_ytd = agency_block(W(ytd_start))

    print("codes (recent)...", file=sys.stderr)
    codes_recent = code_block(W(recent_start), 5)
    print("codes (12 months)...", file=sys.stderr)
    codes_year = code_block(W(year_start), 5)

    # Description + agency for each code, from the most recent rows.
    desc = {}
    for r in soda(select="charge_1_code, max(charge_1_code_description) as d, max(issuing_agency) as ag",
                  where=f"{W(year_start)} AND charge_1_code IS NOT NULL", group="charge_1_code", limit=50000):
        desc[r["charge_1_code"]] = [r.get("d") or "", r.get("ag") or ""]

    codes = {}
    for c in set(codes_recent) | set(codes_year):
        rec, yr = codes_recent.get(c, {}), codes_year.get(c, {})
        # Prefer the recent window when it has a default sample; schedules change (e.g. DSNY AS26 fell from $300 to $80 in fall 2026).
        use, win = (rec, "recent") if "default" in rec else (yr, "year")
        if "default" not in use:
            continue
        codes[c] = {"w": win, "d": use["default"], "v": use.get("in_violation"), "desc": desc.get(c, ["", ""])[0]}

    out = {
        "generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "dataset": "jz4z-kudi",
        "windows": {"ytd": [ytd_start, end], "recent": [recent_start, end], "year": [year_start, end]},
        "headline": {"hearings": total, "with_result": total - no_result, "defaults": defaults,
                     "default_share": round(defaults / max(1, total - no_result), 4),
                     "default_penalties": round(def_pen), "upcoming": upcoming},
        "agencies_recent": ag_recent,
        "agencies_ytd": ag_ytd,
        "codes": dict(sorted(codes.items())),
        "_codes_format": "d / v = [count, median penalty, mean penalty] for DEFAULTED / IN VIOLATION; w = window used (recent|year)",
    }
    with open(a.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {a.out}: {len(codes)} codes, {total} hearings YTD", file=sys.stderr)


if __name__ == "__main__":
    main()
