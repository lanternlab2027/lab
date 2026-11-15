#!/usr/bin/env python3
"""Filter harvested LOC candidates down to a shortlist of Chicago photos with a
single specific year and a "No known restrictions" rights advisory.

Adapted from bots/then/curate.py (NYC Then). Instead of boroughs, each landmark
maps to the parts of town it unambiguously belongs to (used for the optional
bonus). A landmark with no area (None) still counts as a recognizable place,
but its photos get no bonus question unless make_picks.py overrides it.

Input:  $CHI_CANDIDATES (from harvest.py; comma-separated list allowed)
Output: bots/chicago-then/data/shortlist.json  (one row per candidate)
"""
import json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get("CHI_CANDIDATES", os.path.join(HERE, "data", "candidates.json"))
OUT = os.path.join(HERE, "data", "shortlist.json")

LOOP, NN, NS, WS, SS, LF = "Loop", "Near North", "North Side", "West Side", "South Side", "Lakefront"

# (regex on title, short place label, accepted areas or None). First match wins.
LANDMARKS = [
    (r"century of progress", "Century of Progress fair", [SS, LF]),
    (r"world'?s (columbian|fair)|columbian exposition|court of honor|white city", "World's Columbian Exposition", [SS, LF]),
    (r"buckingham fountain", "Buckingham Fountain, Grant Park", [LOOP, LF]),
    (r"grant park|lake front park|lake-front park", "Grant Park", [LOOP, LF]),
    (r"art institute", "Art Institute of Chicago", [LOOP, LF]),
    (r"field (columbian )?museum|museum of natural history", "Field Museum", None),
    (r"soldier'?s? field", "Soldier Field", None),
    (r"shedd aquarium|adler planetarium", "Museum Campus", None),
    (r"auditorium", "Auditorium Building", [LOOP]),
    (r"board of trade", "Board of Trade", [LOOP]),
    (r"masonic temple", "Masonic Temple", [LOOP]),
    (r"marshall field", "Marshall Field's", [LOOP]),
    (r"monadnock", "Monadnock Building", [LOOP]),
    (r"rookery", "The Rookery", [LOOP]),
    (r"reliance building", "Reliance Building", [LOOP]),
    (r"public library", "Chicago Public Library", [LOOP]),
    (r"post ?office|federal building", "Federal Building", [LOOP]),
    (r"city hall|county court ?house", "City Hall", [LOOP]),
    (r"la ?salle st", "LaSalle Street", [LOOP]),
    (r"dearborn st", "Dearborn Street", [LOOP]),
    (r"clark st", "Clark Street", None),
    (r"wabash av", "Wabash Avenue", [LOOP]),
    (r"randolph st", "Randolph Street", [LOOP]),
    (r"madison st", "Madison Street", None),
    (r"state st", "State Street", [LOOP]),
    (r"south water st", "South Water Street market", [LOOP]),
    (r"union station|union depot", "Union Station", [LOOP, WS]),
    (r"northwestern station|north western station|c\. ?& ?n\. ?w\. (station|depot)", "North Western Station", [LOOP, WS]),
    (r"la ?salle street station|dearborn station|grand central station|illinois central station|central station", "Railroad station", None),
    (r"tribune tower|tribune building", "Tribune Tower", None),
    (r"wrigley building", "Wrigley Building", [NN]),
    (r"merchandise mart", "Merchandise Mart", [NN]),
    (r"water tower", "Chicago Water Tower", [NN]),
    (r"municipal pier|navy pier", "Navy Pier", [NN, LF]),
    (r"lake shore dr|lake shore drive|lakeshore drive", "Lake Shore Drive", None),
    (r"oak st(reet)? beach", "Oak Street Beach", [NN, LF]),
    (r"newberry library", "Newberry Library", [NN]),
    (r"michigan (av|blvd|boul)", "Michigan Avenue", None),
    (r"lincoln park", "Lincoln Park", [NS, LF]),
    (r"edgewater beach", "Edgewater Beach Hotel", [NS, LF]),
    (r"wrigley field|weeghman park|cubs park", "Wrigley Field", [NS]),
    (r"jackson park|wooded island|fine arts building|palace of fine arts|museum of science", "Jackson Park", [SS, LF]),
    (r"midway plaisance|midway", "Midway Plaisance", [SS]),
    (r"university of chicago", "University of Chicago", [SS]),
    (r"washington park", "Washington Park", [SS]),
    (r"stock ?yards|packingtown|packing house|union stock", "Union Stock Yards", [SS]),
    (r"comiskey|white sox park|american league (park|grounds)|south side park", "South Side ballpark", [SS]),
    (r"national league (park|grounds)|west side (park|grounds)", "West Side Grounds", [WS]),
    (r"pullman", "Pullman", [SS]),
    (r"prairie av", "Prairie Avenue", None),
    (r"ida b\.? wells", "Ida B. Wells Homes", [SS]),
    (r"south ?side|black belt|bronzeville|47th st|south parkway|43rd st|35th st", "South Side", [SS]),
    (r"garfield park", "Garfield Park", [WS]),
    (r"humboldt park", "Humboldt Park", [WS]),
    (r"douglas park", "Douglas Park", [WS]),
    (r"hull[- ]house", "Hull House", [WS]),
    (r"maxwell st", "Maxwell Street", [WS]),
    (r"west ?side|halsted st", "West Side", None),
    (r"north ?side", "North Side", None),
    (r"chicago river|river,? chicago|rush st(reet)? bridge|bridge", "Chicago River", None),
    (r"lake michigan|lake front|lakefront|water ?front|beach", "Lakefront", None),
    (r"\bloop\b|elevated|\bl\b station", "The Loop", None),
    (r"sky ?line|bird'?s?[- ]?eye|panorama|view of chicago|from majestic", "Chicago skyline", None),
    (r"street|avenue|boulevard", "Chicago street", None),
]

CHI_HINT = re.compile(r"chicago", re.I)
CHI_PLACE = re.compile(r"Illinois--Cook County--Chicago|Illinois--Chicago|Chicago \(Ill\.\)", re.I)
BAD_GENRE = re.compile(r"drawing|print[s]? \(graphic|map|lithograph|engraving|cartoon|poster|architectural drawing", re.I)
BAD_TITLE = re.compile(r"untitled|panel from|exhibit|washington, d\.c|new york|interior|portrait|mrs\.|miss |\bmr\.|baby|dinner|model of|rendering|drawing|\bplan\b|elevation|detail|office of|room|ballroom|lobby|kitchen|\bstage\b|showroom|display|mural|night club|\bbar\b|team|player|pitcher|batter|catcher|manager|outfielder|infielder|umpire|boxer|wrestler|golfer|aviator|candidate|delegate|convention hall|senator|governor|mayor|judge|wife|daughter|son of|\bgirl\b|\bboy\b|woman|man\b|men\b|children|family|funeral|wreck|disaster|victims?|dead|body|bodies|eastland|fire ruins|riot", re.I)


def parse_year(raw):
    """Return a single year or None. Rejects ranges, 'ca.', '?', 'or', decades."""
    if not raw:
        return None
    s = str(raw).strip()
    if re.search(r"\?|ca\.|circa|between|\bor\b|-\d|\d{3}-|\d0s|before|after|not before|not after|early|late|\[n\.d\.\]|undated|compiled", s, re.I):
        return None
    s = re.sub(r"\(date created or published later by bain\)", "", s, flags=re.I)
    years = re.findall(r"(?<!\d)(1[89]\d\d)(?!\d)", s)
    if len(set(years)) == 1:
        return int(years[0])
    if not years:
        m = re.fullmatch(r"\[?\d{1,2}/\d{1,2}/(\d{2})\]?\s*", s.strip())
        if m:
            yy = int(m.group(1))
            return 1900 + yy if yy < 50 else 1800 + yy
    return None


def text_of(r):
    it = r.get("item", {}) or {}
    s = it.get("summary") or ""
    if isinstance(s, list):
        s = " ".join(s)
    return s


def landmark(title):
    for rx, label, areas in LANDMARKS:
        if re.search(rx, title, re.I):
            return label, areas
    return None, None


def load(src=SRC):
    data, ids = [], set()
    for f in src.split(","):
        if os.path.exists(f):
            for r in json.load(open(f)):
                if r["id"] not in ids:
                    ids.add(r["id"]); data.append(r)
    return data


def main():
    rows, why = [], collections.Counter()
    for r in load():
        it = r.get("item", {}) or {}
        title = r.get("title") or it.get("title") or ""
        if isinstance(title, list): title = title[0]
        title = title.strip()
        rights = it.get("rights_advisory") or ""
        if isinstance(rights, list): rights = " ".join(rights)
        rights = rights.strip()
        if not rights.lower().startswith("no known restrictions"):
            why["rights"] += 1; continue
        raw_date = it.get("date") or it.get("created_published_date")
        year = parse_year(raw_date)
        if not year or not (1880 <= year <= 1975):
            why["date"] += 1; continue
        genres = " ".join(it.get("genre") or [])
        if BAD_GENRE.search(genres):
            why["genre"] += 1; continue
        if BAD_TITLE.search(title):
            why["title"] += 1; continue
        places = " ".join((p.get("title") if isinstance(p, dict) else str(p)) for p in (it.get("place") or []))
        summary = text_of(r)
        if not (CHI_PLACE.search(places) or CHI_HINT.search(title)):
            why["notchi"] += 1; continue
        if re.search(r"(chicago heights|east chicago|north chicago|west chicago|chicago junction|chicago,? (burlington|milwaukee|rock island|great western|& |and ))", title, re.I) and not CHI_PLACE.search(places):
            why["notchi"] += 1; continue
        notes = " ".join(it.get("notes") or [])
        if re.search(r"from a (painting|drawing)|painting by|drawing by|rendering|lithograph|photomechanical|composite", notes + " " + title, re.I):
            why["notphoto"] += 1; continue
        label, areas = landmark(title)
        if not label:
            # FSA/OWI and Detroit street scenes often have no landmark in the
            # caption but are still clearly Chicago; keep them for hand review.
            if r["_coll"] in ("fsa-owi-black-and-white-negatives", "fsa-owi-color-photographs", "detroit-publishing-company"):
                label, areas = "Chicago", None
            else:
                why["nolandmark"] += 1; continue
        imgs = r.get("image_url") or []
        if not imgs:
            why["noimg"] += 1; continue
        dims = [tuple(map(int, m)) for m in re.findall(r"#h=(\d+)&w=(\d+)", " ".join(imgs))]
        if dims:
            h, w = max(dims, key=lambda x: x[1])
            if w / max(h, 1) > 3.6 or h / max(w, 1) > 1.6:
                why["aspect"] += 1; continue
        rows.append({
            "id": r["id"], "coll": r["_coll"], "title": title, "year": year, "date_loc": str(raw_date),
            "landmark": label, "areas": areas, "rights": rights, "summary": summary,
            "notes": it.get("notes") or [], "images": imgs, "places": places,
        })
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(rows, open(OUT, "w"), indent=1)
    print("kept", len(rows), "dropped", dict(why))
    c = collections.Counter((x["coll"], x["year"] // 10 * 10) for x in rows)
    for k in sorted(c): print(k, c[k])
    print(collections.Counter(x["landmark"] for x in rows).most_common())


if __name__ == "__main__":
    main()
