#!/usr/bin/env python3
"""Assemble bots/chicago-then/picks.json from hand-chosen LOC ids (reviewed on
contact sheets made by contact_sheet.py). Adapted from bots/then/make_picks.py.

Each pick is (lccn, place label, accepted areas). Areas are given ONLY when the
LOC title or place field names a spot whose part of town is unambiguous
(e.g. "State Street", "Lincoln Park", "Black Belt", "47th Street",
"Maxwell Street"). Otherwise the list is empty and the game skips the bonus.
A lakefront park counts as both its side of town and "Lakefront".

Run: CHI_CANDIDATES=bots/chicago-then/data/candidates.json python3 bots/chicago-then/make_picks.py
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import curate
from curate import parse_year

LOOP, NN, NS, WS, SS, LF = "Loop", "Near North", "North Side", "West Side", "South Side", "Lakefront"

# lccn, place shown after the game, accepted areas ([] = no bonus)
PICKS = [
    # --- Detroit Publishing Co., 1898-1911 ---
    ("2016801970", "Chicago Beach Hotel, Hyde Park", [SS, LF]),
    ("2016799521", "Grain elevators on the Chicago River", []),
    ("2016799516", "Masonic Temple, State and Randolph", [LOOP]),
    ("2016801822", "Art Institute of Chicago", [LOOP, LF]),
    ("2016801824", "Lake Shore Drive", []),
    ("2016813810", "Drexel Boulevard", [SS]),
    ("2016813811", "Grand Boulevard", [SS]),
    ("2016802057", "Michigan Avenue from the lake front", [LOOP, LF]),
    ("2016805496", "State Street", [LOOP]),
    ("2016813801", "Dearborn Street", [LOOP]),
    ("2016813802", "Jackknife bridge on the Chicago River", []),
    ("2016801919", "Chicago Public Library (now the Cultural Center)", [LOOP]),
    ("2016799977", "Lake Shore Drive", []),
    ("2016802473", "Chicago & North Western passenger terminal", [LOOP, WS]),
    ("2016801826", "High Bridge, Lincoln Park", [NS, LF]),
    ("2016813814", "Pavilion, Jackson Park", [SS, LF]),
    ("2016799518", "Auditorium Building and annex", [LOOP]),
    ("2016802472", "Skyline from the lake front", [LOOP, LF]),
    ("2016813799", "Columbia Yacht Club", [LOOP, LF]),
    ("2016813806", "Wabash Avenue under the L", [LOOP]),
    ("2016803650", "University of Chicago", [SS]),
    ("2016799517", "Illinois Trust and Savings Bank, LaSalle Street", [LOOP]),
    ("2016795886", "Madison and State Streets", [LOOP]),
    ("2016794963", "Conservatory and gardens, Lincoln Park", [NS, LF]),
    ("2016801971", "State Street north from Madison", [LOOP]),
    ("2016799499", "Bear pit, Lincoln Park Zoo", [NS, LF]),
    ("2016813800", "Commuters arriving from the suburbs", []),
    ("2016800500", "Band concert, Lincoln Park", [NS, LF]),
    ("2016795887", "Boating in Garfield Park", [WS]),
    ("2016805489", "Boat house, Lincoln Park", [NS, LF]),
    ("2016813815", "Resting house, Jackson Park", [SS, LF]),
    ("2016800245", "Field Columbian Museum, Jackson Park", [SS, LF]),
    ("2016794994", "Lake Shore Drive, Jackson Park", [SS, LF]),
    ("2016799520", "Wabash Avenue north from Adams", [LOOP]),
    ("2016805484", "Chicago Board of Trade trading floor", [LOOP]),
    ("2016799519", "Madison Street east from Wells", [LOOP]),
    ("2016797850", "Chicago & North Western station", []),
    ("2016799121", "Randolph Street east from LaSalle", [LOOP]),
    ("2016799976", "State Street toward Adams", [LOOP]),
    ("2016806856", "Field Columbian Museum, Jackson Park", [SS, LF]),
    ("2016813812", "Grant Park and the Auditorium Building", [LOOP, LF]),
    ("2016805487", "Field Columbian Museum, Jackson Park", [SS, LF]),
    ("2016799498", "A walk in Lincoln Park", [NS, LF]),
    ("2016794576", "Flower flag, Lincoln Park", [NS, LF]),
    ("2016794910", "Lagoon, Lincoln Park", [NS, LF]),
    # --- Panoramic photographs, 1893-1938 ---
    ("2007663722", "Marshall Field, University of Chicago", [SS]),
    ("2007660845", "Grant Park", [LOOP, LF]),
    ("2007660861", "Chicago's lake front", [LOOP, LF]),
    ("2007663563", "Chicago harbor and skyline", []),
    ("2007663978", "South Side Park, home of the White Sox", [SS]),
    ("2007663919", "University of Chicago", [SS]),
    ("2007660844", "Union Stock Yards", [SS]),
    ("2007660835", "Bird's-eye view of Chicago", []),
    ("2007663915", "The Loop from the Majestic Building", [LOOP]),
    ("2007663728", "Opening day at the new ballpark at Clark and Addison", [NS]),
    ("2007663986", "McCormick reaper works", []),
    ("2007663791", "West Side Grounds, home of the Cubs", [WS]),
    ("2007664374", "Army tournament in Grant Park", [LOOP, LF]),
    ("2007663379", "World's Columbian Exposition", [SS, LF]),
    ("2007660812", "Bird's-eye view of Chicago", []),
    # --- FSA/OWI, 1940-1943 ---
    ("2017720254", "Art Institute of Chicago", [LOOP, LF]),
    ("2017746503", "Coal barge on the Chicago River", []),
    ("2017729486", "Shoeshine on 47th Street", [SS]),
    ("2017746305", "Congress Plaza on the lakefront", [LOOP, LF]),
    ("2017788913", "Rowhouses on the South Side", [SS]),
    ("2017746802", "Drawbridge on the Chicago River", []),
    ("2017746304", "Michigan Avenue", []),
    ("2017720272", "State Street", [LOOP]),
    ("2017862307", "Street scene", []),
    ("2017788936", "47th Street", [SS]),
    ("2017812561", "Union Stock Yards", [SS]),
    ("2017814063", "Congress Plaza, Grant Park, in snow", [LOOP, LF]),
    ("2017814026", "Michigan Avenue in snow", []),
    ("2017844041", "Burlington streamliner leaving Union Station", [LOOP, WS]),
    ("2017720267", "Waiting for the streetcar", []),
    ("2017746450", "Public bathing beach", [LF]),
    ("2017843832", "Union Station concourse", [LOOP, WS]),
    ("2017834284", "Lake Michigan beach", [LF]),
    ("2017788750", "Regal Theater, South Side", [SS]),
    ("2017720513", "Waiting for the streetcar", []),
    ("2017746497", "Stoplight on Michigan Avenue", []),
    ("2017746500", "Ohio Street beach", [NN, LF]),
    ("2017729559", "Street scene in the Black Belt", [SS]),
    ("2017746673", "Buckingham Fountain, Grant Park", [LOOP, LF]),
    ("2017720510", "Under the elevated tracks", []),
    ("2017729627", "Street corner in the Black Belt", [SS]),
    ("2017812576", "Stock Yard Gate, Union Stock Yards", [SS]),
    ("2017812647", "Trucks at the Union Stock Yards", [SS]),
    ("2017878167", "Illinois Central freight terminal, South Water Street", [LOOP]),
    ("2017878170", "Illinois Central freight terminal, South Water Street", [LOOP]),
    ("2017833393", "Ida B. Wells Homes", [SS]),
    ("2017844143", "Saying goodbye at Union Station", [LOOP, WS]),
    ("2017844150", "Zephyr ticket window, Union Station", [LOOP, WS]),
    ("2017743575", "Maxwell and Halsted Streets", [WS]),
    ("2017829181", "Ida B. Wells Homes", [SS]),
    ("2017746458", "Bathing beach and the Gold Coast", [NN, LF]),
    ("2017853591", "Caboose at the South Water Street freight terminal", [LOOP]),
    ("2017743574", "Shoe stall on Maxwell Street", [WS]),
    ("2017743523", "Lunch wagon under the L", []),
    ("2017853596", "South Water Street freight terminal", [LOOP]),
    ("2017853580", "Office towers from the South Water Street terminal at night", [LOOP]),
    ("2017720270", "Newsstand", []),
    ("2017720276", "Billboards", []),
    ("2017788797", "Painted wall sign", []),
    ("2017720505", "Alley under the L, downtown", [LOOP]),
    ("2017746649", "Parking lot and skyline", []),
    ("2017746913", "Five o'clock crowds", []),
    ("2017746924", "Climbing the stairs to the L", []),
    ("2017789062", "Brownstone apartment houses", []),
    ("2017812577", "Apartment house in South Chicago", [SS]),
    ("2017844076", "Tracks leading into a station", []),
    ("2017743610", "Apartment building with back porches", []),
    ("2017720275", "Skyline reflected in a shop window", []),
    ("2017788758", "Old house converted into a church", []),
    ("2017720508", "Under the elevated railway", []),
    ("2017720253", "Theater on Michigan Avenue", []),
    ("2017720261", "Catholic church", []),
    ("2017720271", "Clark Street", []),
    ("2017729670", "Federal Street", []),
    ("2017743670", "Storefront office", []),
    ("2017788978", "Back porches of wooden houses", []),
]

# Extra crops (left, top, right, bottom fractions) found on review.
TRIM = {
    # Panoramics: cut mounts, printed captions and copyright lines (several carry dates).
    "2007663722": [0.01, 0.10, 0.02, 0.03],
    "2007660845": [0.04, 0.36, 0.08, 0.14],
    "2007660861": [0.03, 0.12, 0.03, 0.22],
    "2007663563": [0.05, 0.36, 0.03, 0.30],
    "2007663978": [0.02, 0.05, 0.03, 0.16],
    "2007663919": [0.02, 0.05, 0.03, 0.03],
    "2007660844": [0.01, 0.30, 0.02, 0.08],
    "2007660835": [0.04, 0.25, 0.04, 0.30],
    "2007663915": [0.01, 0.08, 0.01, 0.03],
    "2007663728": [0.03, 0.05, 0.02, 0.26],
    "2007663986": [0.02, 0.35, 0.04, 0.23],
    "2007663791": [0.01, 0.25, 0.01, 0.28],
    "2007664374": [0.07, 0.14, 0.03, 0.21],
    "2007663379": [0.02, 0.28, 0.02, 0.18],
    "2007660812": [0.04, 0.30, 0.04, 0.25],
    # FSA color transparencies: black frame edges.
    "2017878167": [0.06, 0.06, 0.07, 0.10],
    "2017878170": [0.08, 0.08, 0.06, 0.10],
}


def main():
    pool = {}
    for r in curate.load(os.environ.get("CHI_CANDIDATES", curate.SRC)):
        pool.setdefault(r["id"].rstrip("/").split("/")[-1], r)
    picks, seen = [], set()
    for lccn, place, areas in PICKS:
        assert lccn not in seen, lccn
        seen.add(lccn)
        r = pool[lccn]
        it = r.get("item", {})
        t = r.get("title") or ""
        t = t[0] if isinstance(t, list) else t
        y = parse_year(it.get("date"))
        assert y, lccn
        d = dict(id=r["id"], coll=r["_coll"], title=t, year=y, place=place, area_ok=areas,
                 images=r.get("image_url") or [])
        if lccn in TRIM:
            d["trim"] = TRIM[lccn]
        picks.append(d)
    json.dump(picks, open(os.path.join(HERE, "picks.json"), "w"), indent=1)
    print(len(picks), "picks")


if __name__ == "__main__":
    main()
