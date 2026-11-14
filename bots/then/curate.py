#!/usr/bin/env python3
"""Filter harvested LOC candidates down to a shortlist of NYC photos with a
single specific year and a "No known restrictions" rights advisory.

Input:  $THEN_CANDIDATES (from harvest.py)
Output: bots/then/data/shortlist.json  (scored, one row per candidate)
"""
import json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get("THEN_CANDIDATES", os.path.join(HERE, "data", "candidates.json"))
OUT = os.path.join(HERE, "data", "shortlist.json")

# (regex on title/summary, short place label, borough). First match wins.
LANDMARKS = [
    (r"brooklyn bridge", "Brooklyn Bridge", None),
    (r"williamsburg bridge", "Williamsburg Bridge", None),
    (r"manhattan bridge", "Manhattan Bridge", None),
    (r"queensboro|blackwell'?s island bridge", "Queensboro Bridge", None),
    (r"george washington bridge", "George Washington Bridge", "Manhattan"),
    (r"triborough", "Triborough Bridge", None),
    (r"hell gate", "Hell Gate", None),
    (r"flat ?iron|fuller building", "Flatiron Building", "Manhattan"),
    (r"times square|longacre square", "Times Square", "Manhattan"),
    (r"times building", "Times Building", "Manhattan"),
    (r"herald square", "Herald Square", "Manhattan"),
    (r"madison square garden", "Madison Square Garden", "Manhattan"),
    (r"madison square", "Madison Square", "Manhattan"),
    (r"union square", "Union Square", "Manhattan"),
    (r"washington square|washington arch|memorial arch", "Washington Square", "Manhattan"),
    (r"columbus circle", "Columbus Circle", "Manhattan"),
    (r"central park", "Central Park", "Manhattan"),
    (r"riverside drive|riverside park", "Riverside Drive", "Manhattan"),
    (r"grant'?s tomb", "Grant's Tomb", "Manhattan"),
    (r"wall st", "Wall Street", "Manhattan"),
    (r"stock exchange", "New York Stock Exchange", "Manhattan"),
    (r"trinity church", "Trinity Church", "Manhattan"),
    (r"st\.? paul'?s chapel", "St. Paul's Chapel", "Manhattan"),
    (r"city hall park", "City Hall Park", "Manhattan"),
    (r"city hall", "City Hall", "Manhattan"),
    (r"park row", "Park Row", "Manhattan"),
    (r"newspaper row", "Newspaper Row", "Manhattan"),
    (r"woolworth", "Woolworth Building", "Manhattan"),
    (r"singer building|singer tower", "Singer Building", "Manhattan"),
    (r"metropolitan life", "Metropolitan Life Tower", "Manhattan"),
    (r"empire state", "Empire State Building", "Manhattan"),
    (r"chrysler", "Chrysler Building", "Manhattan"),
    (r"rockefeller|radio city|rca building", "Rockefeller Center", "Manhattan"),
    (r"grand central", "Grand Central", "Manhattan"),
    (r"pennsylvania station|penn(sylvania)? (r\.r\. )?station|penn station", "Pennsylvania Station", "Manhattan"),
    (r"public library", "New York Public Library", "Manhattan"),
    (r"st\.? patrick'?s", "St. Patrick's Cathedral", "Manhattan"),
    (r"metropolitan museum", "Metropolitan Museum of Art", "Manhattan"),
    (r"museum of natural history|natural history museum", "American Museum of Natural History", "Manhattan"),
    (r"columbia (university|library|college)|low library", "Columbia University", "Manhattan"),
    (r"plaza hotel|hotel plaza", "Plaza Hotel", "Manhattan"),
    (r"waldorf", "Waldorf-Astoria", "Manhattan"),
    (r"hippodrome", "Hippodrome", "Manhattan"),
    (r"battery park|the battery|battery,", "The Battery", "Manhattan"),
    (r"aquarium", "New York Aquarium", None),
    (r"bowling green", "Bowling Green", "Manhattan"),
    (r"statue of liberty|liberty enlightening", "Statue of Liberty", "Manhattan"),
    (r"bowery", "The Bowery", "Manhattan"),
    (r"mulberry st|mulberry bend", "Mulberry Street", "Manhattan"),
    (r"hester st", "Hester Street", "Manhattan"),
    (r"orchard st", "Orchard Street", "Manhattan"),
    (r"delancey", "Delancey Street", "Manhattan"),
    (r"chinatown|mott st|pell st|doyers", "Chinatown", "Manhattan"),
    (r"fulton (fish )?market", "Fulton Fish Market", "Manhattan"),
    (r"south st", "South Street", "Manhattan"),
    (r"harlem", "Harlem", "Manhattan"),
    (r"fifth ave|5th ave", "Fifth Avenue", "Manhattan"),
    (r"park ave", "Park Avenue", "Manhattan"),
    (r"broadway", "Broadway", "Manhattan"),
    (r"polo grounds", "Polo Grounds", "Manhattan"),
    (r"hilltop park|american league park", "Hilltop Park", "Manhattan"),
    (r"yankee stadium", "Yankee Stadium", "Bronx"),
    (r"ebbets field", "Ebbets Field", "Brooklyn"),
    (r"washington park", "Washington Park", "Brooklyn"),
    (r"coney island|luna park|dreamland|steeplechase|surf ave", "Coney Island", "Brooklyn"),
    (r"brighton beach", "Brighton Beach", "Brooklyn"),
    (r"prospect park", "Prospect Park", "Brooklyn"),
    (r"grand army plaza|soldiers'? and sailors'? arch", "Grand Army Plaza", "Brooklyn"),
    (r"navy yard", "Brooklyn Navy Yard", "Brooklyn"),
    (r"bronx (zoo|park|zoological)|zoological park", "Bronx Zoo", "Bronx"),
    (r"botanical garden", "New York Botanical Garden", "Bronx"),
    (r"poe cottage", "Poe Cottage", "Bronx"),
    (r"world'?s fair", "New York World's Fair", "Queens"),
    (r"flushing", "Flushing", "Queens"),
    (r"jamaica", "Jamaica", "Queens"),
    (r"staten island|st(aten)? george", "Staten Island", "Staten Island"),
    (r"ellis island", None, None),  # mostly New Jersey: skip
]

BRIDGE_BORO = {"Brooklyn Bridge": "Manhattan", "Williamsburg Bridge": "Manhattan", "Manhattan Bridge": "Manhattan",
               "Queensboro Bridge": "Manhattan", "Triborough Bridge": "Queens", "Hell Gate": "Queens",
               "New York Aquarium": "Manhattan"}

NYC_HINT = re.compile(r"new york|n\.\s?y\.|brooklyn|bronx|queens|staten island|manhattan|coney island", re.I)
NYC_PLACE = re.compile(r"New York \(State\)--(New York|Brooklyn|Bronx|Queens|Staten Island)|New York \(N\.Y\.\)", re.I)
BAD_GENRE = re.compile(r"drawing|print[s]? \(graphic|map|lithograph|engraving|cartoon|poster|architectural drawing", re.I)
BAD_TITLE = re.compile(r"untitled|panel from|exhibit|washington, d\.c|saratoga|west point|rockaway|buffalo|rochester|albany|niagara|syracuse|schrafft|foyer|soda fountain|washer|frialator|kitchen|entrance|\(baseball\)|\bmodel\b|stage|store\b|shop\b|showroom|display|mural|night club|bar\b|hall of|building\. (rear|side)|general view of exhibit|\[montage\]|interior|portrait|mrs\.|miss |\bmr\.|baby|dinner|model of|rendering|drawing|plan\b|elevation|detail|office of|apartment of|residence of|room|ballroom|lobby", re.I)


def parse_year(raw):
    """Return a single year or None. Rejects ranges, 'ca.', '?', 'or', decades."""
    if not raw:
        return None
    s = str(raw).strip()
    if re.search(r"\?|ca\.|circa|between|\bor\b|-\d|\d{3}-|\d0s|before|after|not before|not after|early|late|\[n\.d\.\]|undated", s, re.I):
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


def main():
    data, ids = [], set()
    for f in SRC.split(','):
        if os.path.exists(f):
            for r in json.load(open(f)):
                if r['id'] not in ids: ids.add(r['id']); data.append(r)
    rows, why = [], collections.Counter()
    for r in data:
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
        blob = title + " " + summary
        if (places.strip() and not NYC_PLACE.search(places)) or not (NYC_PLACE.search(places) or NYC_HINT.search(title)):
            why["notnyc"] += 1; continue
        lm = None
        for rx, label, boro in LANDMARKS:
            if re.search(rx, title, re.I):
                lm = (label, boro); break
        if not lm or not lm[0]:
            why["nolandmark"] += 1; continue
        label, boro = lm
        boro = boro or BRIDGE_BORO.get(label)
        if not boro:
            m = re.search(r"New York \(State\)--(Brooklyn|Bronx|Queens|Staten Island)", places)
            boro = m.group(1) if m else ("Brooklyn" if re.search(r"brooklyn", blob, re.I) else "Manhattan")
        imgs = r.get("image_url") or []
        if not imgs:
            why["noimg"] += 1; continue
        score = 0
        if len(summary) > 80: score += 3
        if r["_coll"] == "gottscho-schleisner": score += 1
        rows.append({
            "id": r["id"], "coll": r["_coll"], "title": title, "year": year, "date_loc": str(raw_date),
            "landmark": label, "borough": boro, "rights": rights, "summary": summary,
            "notes": it.get("notes") or [], "images": imgs, "places": places,
            "contributor": it.get("contributor_names") or it.get("contributors") or r.get("contributor") or [],
            "score": score,
        })
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(rows, open(OUT, "w"), indent=1)
    print("kept", len(rows), "dropped", dict(why))
    c = collections.Counter((x["coll"], x["year"] // 10 * 10) for x in rows)
    for k in sorted(c): print(k, c[k])
    print(collections.Counter(x["landmark"] for x in rows).most_common())


if __name__ == "__main__":
    main()
