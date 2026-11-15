"""Mocked NWS for tests: the same scenarios as bots/snow/fixtures.js, built in Python.

NOW = 2026-12-01T22:00Z (5pm EST Tue). A run at 8:30pm EST (--now 2026-12-02T01:30:00Z) targets Wed Dec 2.
"""
import datetime as dt, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import snow  # noqa: E402

NOW = dt.datetime(2026, 12, 1, 22, tzinfo=dt.timezone.utc)
RUN_AT = "2026-12-02T01:30:00Z"


def iso(h):
    return (NOW + dt.timedelta(hours=h)).isoformat()


def series(uom, rows):
    return {"uom": uom, "values": [{"validTime": iso(h) + f"/PT{d}H", "value": v} for h, d, v in rows]}


def grid(tempC=-2, pop=None, snow_rows=None, ice=None):
    return {"type": "Feature", "properties": {
        "temperature": series("wmoUnit:degC", [[-4, 6, tempC], [2, 6, tempC - 1], [8, 6, tempC - 2], [14, 6, tempC - 1], [20, 24, tempC + 2]]),
        "windChill": series("wmoUnit:degC", [[-4, 48, tempC - 4]]),
        "probabilityOfPrecipitation": series("wmoUnit:percent", pop or [[-4, 48, 10]]),
        "snowfallAmount": series("wmoUnit:mm", snow_rows or [[-4, 48, 0]]),
        "iceAccumulation": series("wmoUnit:mm", ice or [[-4, 48, 0]]),
    }}


GRIDS = {
    "heavy": grid(-5, [[-4, 6, 40], [2, 12, 95], [14, 30, 60]], [[-4, 8, 0], [4, 6, 120], [10, 6, 120], [16, 28, 0]]),
    "none": grid(4),
    "ice": grid(-1, [[-4, 48, 80]], None, [[-4, 10, 0], [6, 6, 4], [12, 30, 0]]),
}


def alerts(events):
    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"event": e, "status": "Actual", "messageType": "Alert",
                                           "onset": iso(-1), "ends": iso(20)}} for e in events]}


def points(city, state, tz, office, x, y):
    base = f"https://api.weather.gov/gridpoints/{office}/{x},{y}"
    return {"properties": {"gridId": office, "forecastGridData": base, "timeZone": tz,
                           "relativeLocation": {"properties": {"city": city, "state": state}}}}


class FakeHttp:
    """Answers by exact URL; records every URL; 1/sec limiter uses a fake clock (no real sleeping)."""

    def __init__(self, routes):
        self.routes, self.urls, self.calls = routes, [], 0

    def get_json(self, url):
        self.calls += 1
        self.urls.append(url)
        r = self.routes.get(url)
        if r is None:
            raise snow.HttpError(404, url)
        if isinstance(r, Exception):
            raise r
        return r


def default_routes():
    """14201 and 14202 share one Buffalo grid cell (heavy + warning); 30303 Atlanta ice; 80202 Denver nothing."""
    z = snow.ZipLookup()
    pt = {k: snow.fix4(z(k)[0]) + "," + snow.fix4(z(k)[1]) for k in ("14201", "14202", "30303", "80202")}
    buf = points("Buffalo", "NY", "America/New_York", "BUF", 35, 47)
    r = {
        f"{snow.NWS}/points/{pt['14201']}": buf,
        f"{snow.NWS}/points/{pt['14202']}": buf,
        f"{snow.NWS}/points/{pt['30303']}": points("Atlanta", "GA", "America/New_York", "FFC", 51, 87),
        f"{snow.NWS}/points/{pt['80202']}": points("Denver", "CO", "America/Denver", "BOU", 63, 62),
        "https://api.weather.gov/gridpoints/BUF/35,47": GRIDS["heavy"],
        "https://api.weather.gov/gridpoints/FFC/51,87": GRIDS["ice"],
        "https://api.weather.gov/gridpoints/BOU/63,62": GRIDS["none"],
    }
    for k in pt:
        r[f"{snow.NWS}/alerts/active?point={pt[k]}"] = alerts(["Winter Storm Warning"] if k.startswith("142") else [])
    return r, pt
