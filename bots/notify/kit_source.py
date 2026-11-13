"""Read Kit subscribers by tag, with custom fields. Read-only. Standard library only.

Uses the V3 API secret (KIT_API_SECRET), which works with the account today.
(V4 would need a separate V4 key; reads don't need it.)
"""
import json, os, time, urllib.error, urllib.parse, urllib.request

V3 = "https://api.convertkit.com/v3"


def _get(path, params, retries=3):
    url = f"{V3}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "venture-lab-notify/0.1"})
    for i in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and i < retries - 1:
                time.sleep(5 * (i + 1))
                continue
            raise RuntimeError(f"Kit GET {path} -> HTTP {e.code}") from None


def tag_ids(secret):
    return {t["name"]: t["id"] for t in _get("/tags", {"api_secret": secret})["tags"]}


def subscribers_for_tag(tag_name, secret=None):
    """Yields {"id", "email", "first_name", "subscribed_at", "fields"} for ACTIVE subscribers with the tag."""
    secret = secret or os.environ.get("KIT_API_SECRET")
    if not secret:
        raise SystemExit("KIT_API_SECRET is not set")
    ids = tag_ids(secret)
    if tag_name not in ids:
        raise SystemExit(f"Kit tag {tag_name!r} not found (have: {', '.join(sorted(ids))})")
    page = 1
    while True:
        d = _get(f"/tags/{ids[tag_name]}/subscriptions",
                 {"api_secret": secret, "subscriber_state": "active", "page": page})
        for s in d.get("subscriptions", []):
            sub = s.get("subscriber") or {}
            if sub.get("state", "active") != "active":
                continue
            yield {"id": sub["id"], "email": sub["email_address"], "first_name": sub.get("first_name"),
                   "subscribed_at": (s.get("created_at") or "")[:10], "fields": sub.get("fields") or {}}
        if page >= d.get("total_pages", 1):
            return
        page += 1
