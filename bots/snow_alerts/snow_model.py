"""Python port of docs/snow/model.js (Snow Day Odds). Standard library only.

Keep this file in lock-step with model.js. test_parity.py runs node on shared fixtures
and asserts that every intermediate and final value matches exactly.

JS details mirrored on purpose:
  Math.round      -> js_round (ties go toward +infinity; Python's round() is banker's)
  Number#toFixed  -> js_to_fixed (exact decimal value, ties away from zero)
  String(number)  -> js_num_str ("1" not "1.0")
  Date.parse      -> parse_ms (ISO 8601 with offset; naive times are treated as UTC)
  truthiness      -> js_truthy ({} and [] are truthy, 0 / "" / None are not)
"""
import calendar, datetime as dt, math, re
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

HOUR = 3600 * 1000
DEG = "\u00b0"
_EPOCH = dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc)


# ---------------------------------------------------------------- JS helpers

def js_truthy(x):
    if x is None or x is False:
        return False
    if isinstance(x, (int, float)) and not isinstance(x, bool):
        return not (x == 0 or x != x)
    if isinstance(x, str):
        return x != ""
    return True


def js_round(x):
    f = math.floor(x)
    return f + 1 if x - f >= 0.5 else f


def js_to_fixed(x, digits):
    if x != x:
        return "NaN"
    q = Decimal(1).scaleb(-digits)
    return str(Decimal(x).quantize(q, rounding=ROUND_HALF_UP))


def js_num_str(x):
    if isinstance(x, float) and x.is_integer():
        return str(int(x))
    return repr(x) if isinstance(x, float) else str(x)


def parse_ms(s):
    """Date.parse for ISO 8601 strings. Returns integer ms or None (NaN)."""
    if not isinstance(s, str) or not s.strip():
        return None
    try:
        d = dt.datetime.fromisoformat(s.strip())
    except ValueError:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return (d - _EPOCH) // dt.timedelta(milliseconds=1)


def utc_ms(y, mo, d, h=0, mi=0, s=0):
    """Date.UTC with a 1-based month."""
    return calendar.timegm((y, mo, d, h, mi, s, 0, 0, 0)) * 1000


def _utc_date(ms):
    return _EPOCH + dt.timedelta(milliseconds=ms)


# ---------------------------------------------------------------- ISO 8601

_DUR = re.compile(r"P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?")


def parse_duration(s):
    raw = "" if not js_truthy(s) else str(s)
    m = _DUR.fullmatch(raw.strip())
    if not m or s == "P" or raw.endswith("T"):
        return float("nan")
    w, d, h, mi, se = (float(g or 0) for g in m.groups())
    return (((w * 7 + d) * 24 + h) * 60 + mi) * 60000 + se * 1000


def parse_valid_time(vt):
    parts = ("" if not js_truthy(vt) else str(vt)).split("/")
    if len(parts) != 2:
        return None
    start = parse_ms(parts[0])
    if start is None:
        return None
    if parts[1].startswith("P"):
        d = parse_duration(parts[1])
        if d != d:
            return None
        end = start + d
    else:
        end = parse_ms(parts[1])
        if end is None:
            return None
    if end <= start:
        return None
    return {"start": start, "end": end}


# ---------------------------------------------------------------- units

LENGTH_MM = {"mm": 1, "cm": 10, "m": 1000, "km": 1e6, "in": 25.4, "ft": 304.8}


def unit_name(uom):
    return re.sub(r"^(wmoUnit|nwsUnit|unit):", "", "" if not js_truthy(uom) else str(uom))


def to_inches(v, uom):
    u = unit_name(uom)
    if u not in LENGTH_MM:
        raise ValueError("Unknown length unit: %s" % uom)
    return v * LENGTH_MM[u] / 25.4


def to_f(v, uom):
    u = unit_name(uom)
    if u == "degC":
        return v * 9 / 5 + 32
    if u == "degF":
        return v
    if u in ("K", "degK"):
        return (v - 273.15) * 9 / 5 + 32
    raise ValueError("Unknown temperature unit: %s" % uom)


def layer(props, key, kind):
    L = props.get(key) if isinstance(props, dict) else None
    if not js_truthy(L) or not isinstance(L, dict) or not js_truthy(L.get("values")):
        return []
    out = []
    for v in L["values"]:
        if v.get("value") is None:
            continue
        t = parse_valid_time(v.get("validTime"))
        if not t:
            continue
        if kind == "len":
            val = to_inches(v["value"], L.get("uom"))
        elif kind == "temp":
            val = to_f(v["value"], L.get("uom"))
        else:
            val = float(v["value"])
        out.append({"start": t["start"], "end": t["end"], "value": val})
    return out


def overlap(a0, a1, b0, b1):
    return max(0, min(a1, b1) - max(a0, b0))


def sum_in(rows, t0, t1):
    s = 0
    for r in rows:
        o = overlap(r["start"], r["end"], t0, t1)
        if o > 0:
            s += r["value"] * o / (r["end"] - r["start"])
    return s


def min_in(rows, t0, t1):
    m = None
    for r in rows:
        if overlap(r["start"], r["end"], t0, t1) > 0 and (m is None or r["value"] < m):
            m = r["value"]
    return m


def max_in(rows, t0, t1):
    m = None
    for r in rows:
        if overlap(r["start"], r["end"], t0, t1) > 0 and (m is None or r["value"] > m):
            m = r["value"]
    return m


def covered(rows, t0, t1):
    return any(r["start"] <= t0 for r in rows) and any(r["end"] >= t1 for r in rows)


# ---------------------------------------------------------------- time zones

def parts_in(ms, tz):
    d = _utc_date(ms).astimezone(ZoneInfo(tz))
    return {"y": d.year, "mo": d.month, "d": d.day, "h": d.hour % 24, "mi": d.minute, "s": d.second}


def zoned_time(y, mo, d, h, tz):
    guess = utc_ms(y, mo, d, h)
    for _ in range(3):
        p = parts_in(guess, tz)
        as_utc = utc_ms(p["y"], p["mo"], p["d"], p["h"], p["mi"], p["s"])
        want = utc_ms(y, mo, d, h)
        if as_utc == want:
            break
        guess += want - as_utc
    return guess


def target_window(now_ms, tz):
    p = parts_in(now_ms, tz)
    base = utc_ms(p["y"], p["mo"], p["d"])
    day = _utc_date(base if p["h"] < 5 else base + 24 * HOUR)
    y, mo, d = day.year, day.month, day.day
    prev = _utc_date(utc_ms(y, mo, d) - 24 * HOUR)
    return {
        "date": {"y": y, "mo": mo, "d": d, "dow": (day.weekday() + 1) % 7},
        "isoDate": "%04d-%02d-%02d" % (y, mo, d),
        "start": zoned_time(prev.year, prev.month, prev.day, 18, tz),
        "late": zoned_time(y, mo, d, 5, tz),
        "end": zoned_time(y, mo, d, 8, tz),
        "thisMorning": p["h"] < 5,
    }


# ---------------------------------------------------------------- inputs from NWS

def extract(grid, alerts, win):
    P = (grid.get("properties") if isinstance(grid, dict) else None)
    if not js_truthy(P):
        P = grid if js_truthy(grid) else {}
    snow, ice = layer(P, "snowfallAmount", "len"), layer(P, "iceAccumulation", "len")
    temp, wc = layer(P, "temperature", "temp"), layer(P, "windChill", "temp")
    pop = layer(P, "probabilityOfPrecipitation", "pct")
    snow_early, snow_late = sum_in(snow, win["start"], win["late"]), sum_in(snow, win["late"], win["end"])
    events = []
    feats = alerts.get("features") if isinstance(alerts, dict) else None
    for f in (feats if js_truthy(feats) else []):
        a = f.get("properties")
        if not js_truthy(a):
            a = f
        if not js_truthy(a.get("event")):
            continue
        ends = parse_ms(a.get("ends") or "") or None
        onset = parse_ms(a.get("onset") or a.get("effective") or "") or None
        if ends and ends <= win["start"]:
            continue
        if onset and onset >= win["end"] + 4 * HOUR:
            continue
        if a.get("messageType") == "Cancel" or a.get("status") == "Test":
            continue
        events.append(a["event"])
    uniq = [e for i, e in enumerate(events) if events.index(e) == i]
    return {
        "snowIn": snow_early + snow_late, "snowEarlyIn": snow_early, "snowLateIn": snow_late,
        "iceIn": sum_in(ice, win["start"], win["end"]),
        "lowF": min_in(temp, win["start"], win["end"]), "windChillF": min_in(wc, win["start"], win["end"]),
        "popMax": max_in(pop, win["start"], win["end"]),
        "hasSnowData": covered(snow, win["start"], win["end"]),
        "alerts": uniq,
    }


# ---------------------------------------------------------------- the heuristic

REGION = {
    "used": {"label": "Snow-used", "snowT": 6, "iceT": 0.25, "cold": [[-25, 25], [-15, 10]], "advisory": 8},
    "rare": {"label": "Rarely sees snow", "snowT": 1.5, "iceT": 0.1, "cold": [[0, 20], [10, 10]], "advisory": 15},
}
ALERTS = [
    ["Blizzard Warning", 25], ["Ice Storm Warning", 25], ["Winter Storm Warning", 20],
    ["Extreme Cold Warning", 15], ["Wind Chill Warning", 15], ["Lake Effect Snow Warning", 20],
    ["Winter Weather Advisory", "adv"], ["Winter Storm Watch", 6],
    ["Cold Weather Advisory", 5], ["Wind Chill Advisory", 5],
]
ALERT_CAP, SNOW_CAP, ICE_CAP = 30, 75, 60


def r1(x):
    return js_round(x * 10) / 10


def inch_text(x):
    if x < 0.05:
        return "under 0.1 in."
    return js_to_fixed(r1(x), 1 if x < 10 else 0) + " in."


def odds(inp, region_key):
    R = REGION.get(region_key) or REGION["used"]
    reasons = []
    late = inp["snowLateIn"] >= 0.1
    eff_snow = inp["snowLateIn"] + inp["snowEarlyIn"] * (1 if late else 0.6)
    pop = 100 if inp["popMax"] is None else inp["popMax"]
    pop_f = 0.6 + 0.4 * min(1, pop / 70)

    snow_pts = min(SNOW_CAP, 50 * eff_snow / R["snowT"]) * pop_f
    ice_pts = min(ICE_CAP, 50 * inp["iceIn"] / R["iceT"]) * pop_f

    cold_pts = 0
    cold = inp["windChillF"] if inp["windChillF"] is not None else inp["lowF"]
    if cold is not None:
        for lim, pts in R["cold"]:
            if cold <= lim:
                cold_pts = pts
                break

    alert_pts, alert_list = 0, []
    for ev in inp["alerts"]:
        for name, pts in ALERTS:
            if name.lower() == str(ev).lower():
                p = R["advisory"] if pts == "adv" else pts
                alert_list.append({"event": name, "pts": p})
                alert_pts += p
                break
    alert_pts = min(ALERT_CAP, alert_pts)
    alert_list.sort(key=lambda a: -a["pts"])

    raw = snow_pts + ice_pts + cold_pts + alert_pts
    chance = max(1, min(99, js_round(raw)))

    if inp["snowIn"] >= 0.05:
        t = inch_text(inp["snowIn"]) + " of snow expected overnight"
        if not late:
            t = inch_text(inp["snowIn"]) + " of snow, ending before 5am"
        reasons.append({"pts": snow_pts, "text": t})
    if inp["iceIn"] >= 0.01:
        reasons.append({"pts": ice_pts, "text": ("A glaze of ice" if inp["iceIn"] < 0.1
                                                 else js_num_str(r1(inp["iceIn"])) + " in. of ice") + " expected"})
    for k, a in enumerate(alert_list):
        reasons.append({"pts": min(a["pts"], ALERT_CAP) if k == 0 else 0.5, "text": a["event"] + " in effect"})
    if cold_pts > 0:
        reasons.append({"pts": cold_pts, "text": ("Wind chill near " if inp["windChillF"] is not None else "Low near ")
                        + str(js_round(cold)) + DEG + "F"})
    if not reasons:
        if not inp["hasSnowData"]:
            reasons.append({"pts": 0, "text": "Forecast doesn\u2019t reach tomorrow morning yet"})
        reasons.append({"pts": 0, "text": "No snow or ice in the overnight forecast"})
        if inp["lowF"] is not None:
            reasons.append({"pts": 0, "text": "Low near " + str(js_round(inp["lowF"])) + DEG + "F"})
    elif inp["snowIn"] < 0.05 and inp["iceIn"] < 0.01:
        reasons.append({"pts": 0, "text": "No snow or ice in the overnight forecast"})
    reasons.sort(key=lambda r: -r["pts"])

    return {
        "chance": chance, "region": region_key if region_key in REGION else "used",
        "parts": {"snow": r1(snow_pts), "ice": r1(ice_pts), "cold": cold_pts, "alerts": alert_pts,
                  "popFactor": js_round(pop_f * 100) / 100, "effectiveSnowIn": r1(eff_snow)},
        "reasons": [r["text"] for r in reasons],
        "label": label(chance),
    }


def label(c):
    if c >= 75:
        return "Pajamas inside out"
    if c >= 50:
        return "Real chance"
    if c >= 25:
        return "Maybe a delay"
    if c >= 10:
        return "Long shot"
    return "Pack your bag"


def default_region(lat):
    """Same default as docs/snow/app.js: south of 36.5 N is 'rarely sees snow'."""
    return "rare" if lat < 36.5 else "used"
