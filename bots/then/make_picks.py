#!/usr/bin/env python3
"""Assemble bots/then/picks.json from hand-chosen LOC ids (reviewed on contact sheets).
Place and borough come from curate.LANDMARKS unless overridden here.
`ok` lists every borough accepted for the bonus guess (bridges span two)."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import curate
from curate import parse_year

POOLS = os.environ["THEN_CANDIDATES"].split(",")

DROP = set("""2016807867 2016806148 2016819030 2018653332 2014703913 2004668537 92519195 89714123 97517154 2014709671 2018739271 2018739270 2018722544 2018722280 2018725654 2017851636 2017854505 2017851564 2017772208 2017841971 2017866716 2017837989""".split())  # rejected on contact-sheet review

IDS = """
2016807867 2016794173 2025164862 2016801906 2016801879 2016818769 2016794195 2016800865 2016794197 2016800270
2016808429 2016808149 2016800240 2016800268 2016802054 2016799084 2016809017 2016803365 2016803387 2016803109
2016803132 2016812025 2016799640 2016805092 2016803586 2016803424 2016796687 2016803389 2016796295 2016801111
2016794936 2016794945 2016805340 2016794937 2016799950 2016805350 2016800098 2016806148 2016800097 2016801172
2016818533 2016816376 2016816375 2016802411 2016816385 2016797122 2016803426 2016819030
90705768 98506912 2016652420 2016652416 2014689272 2014689269 98502164 93506590 2001704485 97518648 2002711814
2004665471 2018653332 2014696168 2003654875 97517210 2014703913 2014704575 97517208 2004668537 2006680025 97518642
92519195 89714123 93508235 2005693287 2014711458 2003675329 97517154 99400542 2014714932 2014709671
2018739279 2018739314 2018739297 2018739271 2018739319 2018739270 2018739274 2018750067 2018751229 2018739333
2018739349 2018735529 2018722544 2018726578 2018750094 2018722280 2018722366 2018722296 2018739324 2018739283
2018739287 2018739289 2018739292 2018739308 2018739358 2018739343 2018739342 2018739354 2018739345 2018739366
2018739367 2018739365 2018739364 2018735542 2018722659 2018744960 2018747424 2018725654 2018728071 2018727881
2018750085 2018729415 2018729419 2018731685 2018733268
2017820727 2017774900 2017838701 2017836239 2017851636 2017854505 2017851564 2017856696 2017772208 2017838702
2017856481 2017841971 2017854564 2017848091 2017866716 2017836716 2017837989 2017851582 2017848103 2017836187 2016806152 2016795026
""".split()

BOTH_MB = ["Manhattan", "Brooklyn"]
BOTH_MQ = ["Manhattan", "Queens"]
OVR = {
    "2016800270": dict(place="East River waterfront from the Brooklyn Bridge", ok=BOTH_MB),
    "2016801906": dict(place="South Street and the Brooklyn Bridge"),
    "2016794197": dict(place="South Street and the Brooklyn Bridge"),
    "2016796687": dict(place="Williamsburg Bridge", ok=BOTH_MB),
    "2016801172": dict(place="Williamsburg Bridge Plaza", borough="Brooklyn"),
    "2018739279": dict(place="Brooklyn Bridge and Lower Manhattan, from DUMBO", borough="Brooklyn"),
    "2018739366": dict(place="Financial District through the Brooklyn Bridge", ok=BOTH_MB),
    "2018739283": dict(place="Lower Manhattan from the foot of the Brooklyn Bridge"),
    "2018725654": dict(place="Long Island City, by the Queensboro Bridge", borough="Queens"),
    "2016807867": dict(place="Hudson River at Grant's Tomb"),
    "2016803365": dict(place="Columbia University and the Hudson River"),
    "2016806148": dict(place="Claremont Inn and Grant's Tomb"),
    "2016818533": dict(place="Mott Street, Chinatown"),
    "2017841971": dict(place="Mott Street, Chinatown"),
    "2005693287": dict(place="Broad Channel, Jamaica Bay", borough="Queens"),
    "2004668537": dict(place="Williamsburg Bridge", ok=BOTH_MB),
    "2014689272": dict(place="Luna Park, Coney Island"),
    "2016803387": dict(place="Luna Park, Coney Island"),
    "2016796295": dict(place="Luna Park at night, Coney Island"),
    "2003654875": dict(place="Hell Gate Bridge", borough="Queens", ok=BOTH_MQ, trim=[0.06, 0.22, 0.06, 0.17]),
    "2014696168": dict(place="Manhattan Bridge", ok=BOTH_MB),
    "2016652420": dict(place="Manhattan Bridge", ok=BOTH_MB),
    "2016652416": dict(place="Manhattan Bridge", ok=BOTH_MB),
    "90705768": dict(place="Queensboro Bridge", ok=BOTH_MQ, trim=[0.06, 0.17, 0.06, 0.23]),
    "98506912": dict(place="Union Square", trim=[0.06, 0.2, 0.06, 0.17]),
    "2017851582": dict(place="Fulton Fish Market", trim=[0.14, 0.14, 0.14, 0.13]),
    "2018722296": dict(place="Central Park", trim=[0.09, 0.09, 0.09, 0.09]),
    "2018739292": dict(place="Midtown through the Queensboro Bridge", ok=BOTH_MQ),
    "2018739354": dict(place="59th Street and the Queensboro Bridge"),
    "2017774900": dict(place="East River from the Queensboro Bridge"),
    "2018739270": dict(place="Midtown at night from the Empire State Building"),
    "2018751229": dict(place="Looking north from the Empire State Building"),
    "2018739297": dict(place="Looking east from the Chrysler Building"),
    "2018739342": dict(place="Pike Street and the Manhattan Bridge"),
    "2018739343": dict(place="Fulton Fish Market pier"),
    "2014714932": dict(place="Lewisohn Stadium, City College"),
    "93506590": dict(place="Essex and Hester Streets, Lower East Side"),
    "2014711458": dict(place="Wall Street"),
    "97517154": dict(place="Curb market, Broad Street"),
    "99400542": dict(place="Pennsylvania Station"),
    "2003675329": dict(place="Fifth Avenue suffrage parade"),
    "2018729419": dict(place="Greeley Square"),
    "2018731685": dict(place="Seagram Building plaza, Park Avenue"),
    "2016803426": dict(place="Soldiers' and Sailors' Arch, Grand Army Plaza", borough="Brooklyn"),
    "2018735542": dict(place="Trylon and Perisphere, 1939 World's Fair"),
    "2018722544": dict(place="Trylon, New York World's Fair"),
    "2018735529": dict(place="Federal Building, New York World's Fair"),
    "2018739287": dict(place="Radio City"),
    "2018739358": dict(place="Midtown at night from the RCA Building"),
    "2018739365": dict(place="Central Park from the RCA Building"),
    "2017866716": dict(place="Times Square on D-Day"),
    "2017836716": dict(place="Central Park Lake"),
    "2017856696": dict(place="Pennsylvania Station"),
    "2016819030": dict(place="Statue of Liberty"),
    # Extra crops for copy negatives / frames found on review
    "2016797122": dict(place="City Hall Park", trim=[0.15, 0.15, 0.12, 0.19]),
    "2018722366": dict(place="Central Park", trim=[0.08, 0.08, 0.08, 0.08]),
    "2016799950": dict(place="Statue of Liberty"),
}


def main():
    pool = {}
    for f in POOLS:
        for r in json.load(open(f)):
            pool.setdefault(r["id"].rstrip("/").split("/")[-1], r)
    picks, seen = [], set()
    for lccn in IDS:
        if lccn in seen or lccn in DROP:
            continue
        seen.add(lccn)
        r = pool[lccn]
        it = r.get("item", {})
        t = r.get("title") or ""
        t = t[0] if isinstance(t, list) else t
        y = parse_year(it.get("date"))
        assert y, lccn
        lm = next(((l, b) for rx, l, b in curate.LANDMARKS if re.search(rx, t, re.I)), (None, None))
        o = OVR.get(lccn, {})
        place = o.get("place") or lm[0]
        boro = o.get("borough") or lm[1] or curate.BRIDGE_BORO.get(lm[0]) or "Manhattan"
        ok = o.get("ok") or [boro]
        if boro not in ok:
            ok = [boro] + ok
        assert place, (lccn, t)
        d = dict(id=r["id"], coll=r["_coll"], title=t, year=y, place=place, borough=boro, ok=ok,
                 images=r.get("image_url") or [])
        if o.get("trim"):
            d["trim"] = o["trim"]
        picks.append(d)
    json.dump(picks, open(os.path.join(HERE, "picks.json"), "w"), indent=1)
    print(len(picks), "picks")


if __name__ == "__main__":
    main()
