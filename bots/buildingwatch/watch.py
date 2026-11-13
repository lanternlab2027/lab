#!/usr/bin/env python3
"""NYC Small-Building Watch -- daily alert prototype.

Given buildings (BBL or "address, borough"), resolves BBL/BINs, queries NYC Open
Data (Socrata SODA, no key) for records newer than the stored "last seen" date and
writes one plain-English alert per new item.

Standard library only. Informational, not legal advice.

Usage:
  python3 watch.py --buildings buildings.txt                 # normal daily run
  python3 watch.py --buildings buildings.txt --since 2026-10-15 --no-save
  python3 watch.py --resolve "289 Garfield Pl, Brooklyn"     # test address lookup

buildings.txt: one building per line. Either a 10-digit BBL or
"house number street, borough" (borough or 5-digit ZIP required). '#' = comment.
Optional "| label" suffix, e.g. "3010730066 | Garfield 5-family".
"""
import argparse, datetime as dt, json, os, re, sys, time
import urllib.parse, urllib.request, urllib.error

API = "https://data.cityofnewyork.us/resource/"
APP_TOKEN = os.environ.get("SOCRATA_APP_TOKEN")  # optional; raises rate limits

DS = {
    "pluto": "64uk-42ks",          # Primary Land Use Tax Lot Output (PLUTO)
    "footprints": "5zhs-2jue",     # Building Footprints (BIN <-> BBL)
    "hpd_reg": "tesw-yqqr",        # HPD Multiple Dwelling Registrations (no owner names)
    "hpd_viol": "wvxf-dwi5",       # HPD Housing Maintenance Code Violations
    "hpd_comp": "ygpa-z7cr",       # HPD Complaints and Problems
    "dob_viol": "3h2n-5cm9",       # DOB Violations
    "dob_comp": "eabe-havv",       # DOB Complaints Received
    "ecb": "6bgk-3dad",            # DOB ECB Violations
    "oath": "jz4z-kudi",           # OATH Hearings Division Case Status
    "311": "erm2-nwe9",            # 311 Service Requests from 2020 to Present
}

BORO = {"1": "MANHATTAN", "2": "BRONX", "3": "BROOKLYN", "4": "QUEENS", "5": "STATEN ISLAND"}
PLUTO_BORO = {"1": "MN", "2": "BX", "3": "BK", "4": "QN", "5": "SI"}
BORO_ALIASES = {
    "1": ["manhattan", "new york", "ny", "nyc", "mn", "harlem"],
    "2": ["bronx", "the bronx", "bx"],
    "3": ["brooklyn", "bk", "kings"],
    "4": ["queens", "qn", "astoria", "long island city", "lic", "flushing", "jamaica", "corona",
          "elmhurst", "jackson heights", "woodside", "sunnyside", "ridgewood", "forest hills",
          "bayside", "east elmhurst", "south ozone park", "ozone park", "richmond hill",
          "far rockaway", "fresh meadows", "rego park", "maspeth", "middle village", "whitestone",
          "college point", "kew gardens", "hollis", "queens village", "woodhaven"],
    "5": ["staten island", "si", "richmond"],
}
SUFFIX = {"ST": "STREET", "STR": "STREET", "AVE": "AVENUE", "AV": "AVENUE", "PL": "PLACE",
          "RD": "ROAD", "BLVD": "BOULEVARD", "DR": "DRIVE", "LN": "LANE", "PKWY": "PARKWAY",
          "TER": "TERRACE", "TERR": "TERRACE", "CT": "COURT", "SQ": "SQUARE", "HWY": "HIGHWAY",
          "EXPY": "EXPRESSWAY", "TPKE": "TURNPIKE", "CIR": "CIRCLE", "BL": "BOULEVARD"}
DIRS = {"W": "WEST", "E": "EAST", "N": "NORTH", "S": "SOUTH"}

DISCLAIMER = ("Informational only, not legal advice. Data comes from NYC Open Data and can lag "
              "the agencies' own systems by a day or more; always confirm on the official agency "
              "site before acting.")

LINKS = {
    "hpd_online": "https://www.nyc.gov/hpdonline",
    "hpd_clear": "https://www.nyc.gov/site/hpd/services-and-information/clear-violations.page",
    "hpd_register": "https://www.nyc.gov/site/hpd/services-and-information/register-your-property.page",
    "bedbugs": "https://www.nyc.gov/site/hpd/services-and-information/bedbugs.page",
    "oath_hearings": "https://www.nyc.gov/site/oath/hearings/hearings-and-defaults.page",
    "oath_summons": "https://www.nyc.gov/site/oath/help-center/you-received-a-summons-now-what.page",
    "oath_reopen": "https://www.nyc.gov/site/oath/hearings/reopen-a-missed-hearing-default-online.page",
    "dob_find": "https://www.nyc.gov/site/buildings/dob/find-building-data.page",
    "311": "https://portal.311.nyc.gov/",
}


def bis_profile(bin_):
    return f"https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?bin={bin_}"


def bis_ecb(num):
    return f"https://a810-bisweb.nyc.gov/bisweb/ECBQueryByNumberServlet?ecbin={num}"


# ---------------------------------------------------------------- HTTP

def soda(ds, params, retries=3):
    url = API + DS[ds] + ".json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "small-building-watch/0.1"})
    if APP_TOKEN:
        req.add_header("X-App-Token", APP_TOKEN)
    for i in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:  # URLError, HTTPError 5xx, timeouts, dropped connections
            if i == retries - 1:
                raise RuntimeError(f"SODA query failed for {ds}: {e}") from e
            time.sleep(2 * (i + 1))


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


# ---------------------------------------------------------------- dates

def parse_date(v):
    """Accepts ISO floating timestamps, YYYYMMDD and MM/DD/YYYY. Returns date or None."""
    if not v:
        return None
    v = str(v).strip()
    try:
        if re.match(r"^\d{4}-\d{2}-\d{2}", v):
            return dt.date.fromisoformat(v[:10])
        if re.match(r"^\d{8}$", v):
            return dt.date(int(v[:4]), int(v[4:6]), int(v[6:8]))
        m = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", v)
        if m:
            return dt.date(int(m[3]), int(m[1]), int(m[2]))
    except ValueError:
        return None
    return None


def fmt(d):
    return d.strftime("%a %b %-d, %Y") if d else "n/a"


def clean(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


# ---------------------------------------------------------------- resolution

def norm_street(s):
    toks = re.sub(r"[.,#]", " ", s.upper()).split()
    out = []
    for i, t in enumerate(toks):
        t = re.sub(r"^(\d+)(ST|ND|RD|TH)$", r"\1", t)
        if i == 0 and t in DIRS and len(toks) > 1:
            t = DIRS[t]
        elif i == len(toks) - 1 and t in SUFFIX:
            t = SUFFIX[t]
        out.append(t)
    return " ".join(out)


def parse_address(text):
    parts = [p.strip() for p in text.split(",") if p.strip()]
    boro, zipc = None, None
    for p in parts[1:]:
        low = p.lower()
        z = re.search(r"\b(\d{5})\b", p)
        if z:
            zipc = z.group(1)
        low = re.sub(r"\b(ny|new york)\s*\d{5}\b", "", low).strip() or low
        for code, names in BORO_ALIASES.items():
            if low in names or low.replace(" ny", "") in names:
                boro = boro or code
    m = re.match(r"^\s*([0-9]+(?:-[0-9]+)?[A-Z]?)\s+(.+)$", parts[0].upper())
    if not m:
        raise ValueError(f"Could not find a house number in: {text!r}")
    return m.group(1), norm_street(m.group(2)), boro, zipc


def resolve(entry):
    """Returns building dict with bbl, bins, address, units. Never stores owner names."""
    label = None
    if "|" in entry:
        entry, label = [x.strip() for x in entry.split("|", 1)]
    entry = entry.strip()
    if re.fullmatch(r"\d{10}", entry):
        bbl = entry
    else:
        house, street, boro, zipc = parse_address(entry)
        where = f"address={q(house + ' ' + street)}"
        if boro:
            where += f" AND borough={q(PLUTO_BORO[boro])}"
        elif zipc:
            where += f" AND zipcode={q(zipc)}"
        else:
            raise ValueError(f"Add a borough or ZIP to: {entry!r}")
        rows = soda("pluto", {"$select": "bbl", "$where": where, "$limit": 5})
        if not rows:  # fall back to HPD registrations (handles address ranges)
            w2 = f"streetname={q(street)} AND (housenumber={q(house)} OR (lowhousenumber<={q(house)} AND highhousenumber>={q(house)}))"
            if boro:
                w2 += f" AND boroid={q(boro)}"
            elif zipc:
                w2 += f" AND zip={q(zipc)}"
            r2 = soda("hpd_reg", {"$select": "boroid,block,lot", "$where": w2, "$limit": 5})
            if r2:
                rows = [{"bbl": f"{r2[0]['boroid']}{int(r2[0]['block']):05d}{int(r2[0]['lot']):04d}"}]
        if not rows:
            raise ValueError(f"No tax lot found for {entry!r} (tried PLUTO and HPD registrations)")
        bbl = str(int(float(rows[0]["bbl"])))
    # Explicit column list: PLUTO's owner-name column is deliberately never selected.
    p = soda("pluto", {"$select": "bbl,address,borough,zipcode,unitsres,unitstotal,bldgclass,numfloors",
                       "$where": f"bbl={q(bbl)} OR bbl={q(bbl + '.00000000')}", "$limit": 1})
    p = p[0] if p else {}
    boro, block, lot = bbl[0], bbl[1:6], bbl[6:]
    bins = set()
    for r in soda("footprints", {"$select": "bin", "$where": f"base_bbl={q(bbl)} OR mappluto_bbl={q(bbl)}", "$limit": 50}):
        if r.get("bin") and not r["bin"].endswith("000000"):  # x000000 = placeholder BIN
            bins.add(r["bin"])
    reg = soda("hpd_reg", {"$select": "registrationid,buildingid,bin,lastregistrationdate,registrationenddate",
                           "$where": f"boroid={q(boro)} AND block={q(int(block))} AND lot={q(int(lot))}",
                           "$order": "registrationenddate DESC", "$limit": 5})
    for r in reg:
        if r.get("bin") and not r["bin"].endswith("000000"):
            bins.add(r["bin"])
    return {
        "key": bbl, "label": label, "bbl": bbl, "boro": boro, "block": block, "lot": lot,
        "bins": sorted(bins),
        "address": f"{p.get('address', entry)}, {BORO[boro].title()}",
        "zip": p.get("zipcode"),
        "units_res": int(float(p.get("unitsres") or 0)),
        "units_total": int(float(p.get("unitstotal") or 0)),
        "bldg_class": p.get("bldgclass"),
        "hpd_building_id": reg[0].get("buildingid") if reg else None,
        "hpd_registration_end": (reg[0].get("registrationenddate") or "")[:10] if reg else None,
    }


# ---------------------------------------------------------------- explanations

HPD_CLASS = {
    "A": ("Class A (non-hazardous)", "low"),
    "B": ("Class B (hazardous)", "medium"),
    "C": ("Class C (immediately hazardous)", "high"),
    "I": ("Class I (information / administrative order)", "medium"),
}
ECB_CLASS = {
    "CLASS - 1": ("Class 1 (immediately hazardous)", "high"),
    "CLASS - 2": ("Class 2 (major)", "medium"),
    "CLASS - 3": ("Class 3 (lesser)", "low"),
}
# Common DOB complaint category codes (subset; unknown codes are shown as-is).
DOB_CAT = {
    "01": "Accident - construction/plumbing", "03": "Adjacent building not protected",
    "04": "After-hours work - illegal", "05": "Work without a permit",
    "10": "Debris / building falling or in danger of falling", "12": "Demolition - unsafe/illegal",
    "23": "Sidewalk shed / scaffold problem", "30": "Building shaking / structural stability",
    "31": "Certificate of Occupancy - none / illegal / contrary to CO",
    "45": "Illegal conversion", "49": "Storefront or business sign / awning - illegal",
    "58": "Boiler - defective / no permit", "59": "Electrical wiring - defective / exposed",
    "63": "Elevator - dangerous condition", "66": "Plumbing work - illegal / no permit",
    "73": "Failure to maintain", "83": "Construction contrary to approved plans/permits",
    "86": "Work contrary to Stop Work Order", "94": "Plumbing - defective / leaking",
    "2A": "Posted notice or order removed / tampered with",
    "53": "Vent / exhaust - illegal or improper",
    "1A": "Illegal conversion of commercial space to dwelling units",
    "4A": "Illegal hotel rooms in residential building",
}
OATH_OPEN = {"NEW ISSUANCE", "RESCHEDULED", "ASSIGNED", "STIPULATION OFFERED", "ADJOURNED", "PENDING"}
OATH_STATUS_TXT = {
    "DEFAULTED": "OATH records this case as DEFAULTED (no response by the hearing date). A default "
                 "decision finds the respondent in violation and may carry a higher penalty. OATH has a process "
                 "to ask for a new hearing after a default; see the link.",
    "DOCKETED": "OATH records the unpaid penalty as DOCKETED, meaning it has been entered as a "
                "judgment, which the City can try to collect like other civil judgments.",
    "HEARING COMPLETED": "The hearing has been completed; check the decision on the OATH site.",
    "PAID IN FULL": "Recorded as paid in full.",
}


def alert(b, source, id_, date, title, severity, what, deadline=None, next_step="", link=""):
    return {"building": b["key"], "address": b["address"], "source": source, "id": id_,
            "date": date.isoformat() if date else None, "title": title, "severity": severity,
            "what": what, "deadline": deadline, "next_step": next_step, "link": link}


def hpd_violation(b, r):
    cls, sev = HPD_CLASS.get(r.get("class"), (f"Class {r.get('class')}", "medium"))
    d = parse_date(r.get("novissueddate")) or parse_date(r.get("inspectiondate"))
    unit = r.get("apartment")
    where = f"apartment {unit}" if unit else "building-wide / public area"
    correct = parse_date(r.get("newcorrectbydate")) or parse_date(r.get("originalcorrectbydate"))
    certify = parse_date(r.get("newcertifybydate")) or parse_date(r.get("originalcertifybydate"))
    dl = []
    if r.get("violationstatus") == "Close":
        correct = certify = None  # already closed: no deadline to show
    if correct and correct.year < 2100:
        dl.append(f"correct by {fmt(correct)}")
    if certify and certify.year < 2100:
        dl.append(f"certify correction by {fmt(certify)}")
    status = clean(r.get("currentstatus"))
    if r.get("class") == "I":
        nxt = ("Read the order and take the action it names (for example, file or update the "
               "property registration). Contact HPD if you believe it was issued in error.")
    else:
        nxt = ("Fix the condition, then certify the correction with HPD by the certify-by date "
               "(HPD's Clear Violations page explains how). Open violations stay on the building's "
               "public record, and HPD can seek civil penalties for violations that are not corrected.")
    rent = " HPD has marked it rent-impairing." if r.get("rentimpairing") == "Y" else ""
    return alert(b, "HPD violation", r["violationid"], d, f"New HPD {cls} violation - {where}", sev,
                 clean(r.get("novdescription"))[:600] + f" (Current status: {status}.){rent}",
                 "; ".join(dl) or None, nxt, LINKS["hpd_clear"])


def hpd_complaint(b, r):
    d = parse_date(r.get("received_date"))
    emerg = r.get("type") in ("EMERGENCY", "IMMEDIATE EMERGENCY")
    unit = r.get("apartment")
    where = "building-wide" if (not unit or unit == "BLDG") else f"apartment {unit}"
    what = (f"A tenant complaint was filed with HPD: {clean(r.get('major_category')).title()} - "
            f"{clean(r.get('minor_category')).title()} ({clean(r.get('problem_code')).title()}), {where}. "
            f"Type: {clean(r.get('type')).title()}. Status: {clean(r.get('problem_status')).title()}.")
    nxt = ("A complaint is not a violation. Contact the tenant, arrange access and fix the condition. "
           "HPD may call the tenant or send an inspector; if the condition is still there, an inspector "
           "can issue a violation.")
    if r.get("major_category") == "HEAT/HOT WATER":
        nxt += " Heat season (Oct 1 - May 31) has minimum indoor temperature rules; hot water is required year-round."
    return alert(b, "HPD complaint", r["problem_id"], d, f"New HPD complaint - {clean(r.get('major_category')).title()}",
                 "high" if emerg else "low", what, None, nxt, LINKS["hpd_online"])


def dob_violation(b, r):
    d = parse_date(r.get("issue_date"))
    vtype = clean(r.get("violation_type"))
    desc = clean(r.get("description")) or vtype
    return alert(b, "DOB violation", r["isn_dob_bis_viol"], d,
                 f"New DOB violation ({vtype.split(' ')[0] if vtype else 'type n/a'})", "medium",
                 f"{desc[:600]} Category: {clean(r.get('violation_category'))}. BIN {r.get('bin')}.",
                 None,
                 ("Read the violation in DOB's Buildings Information System. DOB violations generally stay "
                  "open until the condition is corrected and DOB accepts proof (and any related civil "
                  "penalty is resolved); open violations can complicate later DOB filings. A licensed "
                  "professional or expediter can tell you what this one needs."),
                 bis_profile(r.get("bin")))


def dob_complaint(b, r):
    d = parse_date(r.get("date_entered"))
    cat = r.get("complaint_category") or ""
    catname = DOB_CAT.get(cat, f"category code {cat}")
    return alert(b, "DOB complaint", r["complaint_number"], d, f"New DOB complaint - {catname}",
                 "medium" if cat in ("05", "45", "1A", "4A", "30", "10", "86") else "low",
                 f"Someone filed a complaint with the Department of Buildings: {catname}. "
                 f"Status: {clean(r.get('status')).title()}. Complaint #{r['complaint_number']}, BIN {r.get('bin')}."
                 + (f" Inspection date on record: {fmt(parse_date(r.get('inspection_date')))}." if r.get("inspection_date") else ""),
                 None,
                 ("A complaint is not a violation. DOB may send an inspector; if they find a problem they can "
                  "issue a violation or summons. Check the complaint's disposition in BIS and make sure any "
                  "work at the building has the permits it needs."),
                 bis_profile(r.get("bin")))


def ecb_violation(b, r):
    sev_txt, sev = ECB_CLASS.get(r.get("severity"), (clean(r.get("severity")) or "class n/a", "medium"))
    d = parse_date(r.get("issue_date"))
    hd = parse_date(r.get("hearing_date"))
    law = clean(r.get("section_law_description1"))
    pen = r.get("penality_imposed")
    bal = r.get("balance_due")
    vt = clean(r.get('violation_type'))
    what = (f"{vt + ' violation' if vt else 'Violation'}, {sev_txt}. {clean(r.get('violation_description'))[:500]}"
            + (f" Charge: {law}." if law else "")
            + (f" Penalty amount listed in DOB data: ${pen} (balance due ${bal}); while a case is pending "
               f"this is not a final decision." if pen else "")
            + f" Hearing status: {clean(r.get('hearing_status')) or 'n/a'}.")
    dl = f"OATH hearing {fmt(hd)}" if hd and hd >= dt.date.today() else None
    return alert(b, "DOB/ECB violation (OATH summons)", r["ecb_violation_number"], d,
                 f"New DOB/ECB summons - {sev_txt}", sev, what, dl,
                 ("Respond to the summons at OATH by the hearing date: the respondent can admit and pay, or "
                  "contest it online, by phone or in person. If no one responds, OATH can find the respondent "
                  "in violation by default and impose a higher penalty. Separately, paying does not by itself close a DOB "
                  "violation - DOB generally also needs proof of correction (Certificate of Correction)."),
                 bis_ecb(r["ecb_violation_number"]))


def oath_case(b, r):
    d = parse_date(r.get("violation_date"))
    hd = parse_date(r.get("hearing_date"))
    agency = clean(r.get("issuing_agency")) or "a City agency"
    charge = clean(r.get("charge_1_code_description")) or clean(r.get("violation_description"))
    amt = r.get("total_violation_amount")
    status = clean(r.get("hearing_status"))
    when = f" Hearing time on record: {r.get('hearing_time')}." if r.get("hearing_time") else ""
    what = (f"Summons #{r['ticket_number']} from {agency.title()}: {charge.title() if charge else 'charge n/a'}."
            + (f" Penalty amount on record: ${amt}." if amt else "")
            + f" Status: {status.title() or 'n/a'}.{when}"
            + " This summons is tied to the building's location; the respondent may be a tenant or business "
              "there rather than the owner.")
    sev = "high" if status in ("DEFAULTED", "DOCKETED") else "medium"
    return alert(b, "OATH summons", r["ticket_number"], d, f"New OATH summons - {agency.title()}", sev, what,
                 f"OATH hearing {fmt(hd)}" if hd and hd >= dt.date.today() else None,
                 ("If the summons is addressed to you, respond by the hearing date: admit and pay, or contest "
                  "online, by phone or in person. Missing the hearing can lead to a default decision with a "
                  "higher penalty. If it belongs to a commercial tenant, you may want to make sure they know."),
                 LINKS["oath_summons"])


def sr311(b, r):
    d = parse_date(r.get("created_date"))
    return alert(b, "311 request", r["unique_key"], d,
                 f"New 311 request - {clean(r.get('complaint_type')).title()}", "low",
                 f"{clean(r.get('agency_name'))}: {clean(r.get('complaint_type'))} / {clean(r.get('descriptor'))}. "
                 f"Status: {clean(r.get('status'))}." + (f" Agency note: {clean(r.get('resolution_description'))[:300]}" if r.get("resolution_description") else ""),
                 None,
                 "Heads-up only: a 311 request is not a violation, but it can lead to an inspection. Check the condition it describes.",
                 LINKS["311"])


# ---------------------------------------------------------------- fetch per building

def fetch(b, since):
    s_iso = since.isoformat()
    s_ymd = since.strftime("%Y%m%d")
    bins = b["bins"]
    out = []
    bbl = b["bbl"]

    for r in soda("hpd_viol", {"$where": f"bbl={q(bbl)} AND (novissueddate >= {q(s_iso)} OR (novissueddate IS NULL AND inspectiondate >= {q(s_iso)}))", "$limit": 500}):
        out.append(hpd_violation(b, r))
    for r in soda("hpd_comp", {"$where": f"bbl={q(bbl)} AND received_date >= {q(s_iso)}", "$limit": 500}):
        out.append(hpd_complaint(b, r))

    seen_tickets = set()
    if bins:
        binlist = ",".join(q(x) for x in bins)
        # DOB date columns are text (YYYYMMDD); upper bound filters junk values like 'Y9990120'.
        for r in soda("dob_viol", {"$where": f"bin in ({binlist}) AND issue_date >= {q(s_ymd)} AND issue_date < '29991231'", "$limit": 500}):
            out.append(dob_violation(b, r))
        for r in soda("ecb", {"$where": f"bin in ({binlist}) AND issue_date >= {q(s_ymd)} AND issue_date < '29991231'", "$limit": 500}):
            out.append(ecb_violation(b, r))
            seen_tickets.add(r["ecb_violation_number"].lstrip("0"))
        # date_entered is MM/DD/YYYY text -> cannot range-filter server-side; filter here.
        for r in soda("dob_comp", {"$where": f"bin in ({binlist})", "$order": "complaint_number DESC", "$limit": 1000}):
            d = parse_date(r.get("date_entered"))
            if d and d >= since:
                out.append(dob_complaint(b, r))

    # OATH: match on violation-location borough/block/lot (street name is often blank since May 2026).
    oath_where = (f"violation_location_borough={q(BORO[b['boro']])} AND violation_location_block_no={q(b['block'])} "
                  f"AND violation_location_lot_no in ({q(b['lot'][-4:])},{q('0' + b['lot'][-4:])})")  # FDNY/DOB rows can use 5-digit lots
    oath_rows = soda("oath", {"$where": f"{oath_where} AND violation_date >= {q(s_iso)}", "$limit": 500})
    for r in oath_rows:
        if r["ticket_number"].lstrip("0") in seen_tickets:
            continue  # already reported via the DOB ECB dataset
        out.append(oath_case(b, r))

    for r in soda("311", {"$where": f"bbl={q(bbl)} AND created_date >= {q(s_iso)} AND agency not in ('HPD','DOB','NYPD')", "$limit": 500}):
        out.append(sr311(b, r))
    return out


def upcoming(b, today, horizon=14):
    """Reminders for OATH hearings in the next `horizon` days and status changes worth flagging."""
    out = []
    oath_where = (f"violation_location_borough={q(BORO[b['boro']])} AND violation_location_block_no={q(b['block'])} "
                  f"AND violation_location_lot_no in ({q(b['lot'][-4:])},{q('0' + b['lot'][-4:])})")  # FDNY/DOB rows can use 5-digit lots
    rows = soda("oath", {"$where": f"{oath_where} AND hearing_date >= {q((today - dt.timedelta(days=120)).isoformat())}", "$limit": 500})
    for r in rows:
        hd = parse_date(r.get("hearing_date"))
        status = clean(r.get("hearing_status"))
        agency = clean(r.get("issuing_agency")).title() or "City agency"
        if hd and today <= hd <= today + dt.timedelta(days=horizon) and status in OATH_OPEN:
            days = (hd - today).days
            out.append(alert(b, "Hearing reminder", f"remind:{r['ticket_number']}:{hd}", today,
                             f"OATH hearing in {days} day{'s' if days != 1 else ''} - summons #{r['ticket_number']}",
                             "high" if days <= 3 else "medium",
                             f"Summons from {agency}: {clean(r.get('charge_1_code_description')).title()}. "
                             f"Status: {status.title()}. The respondent may be a tenant or business at this "
                             "location rather than the owner.",
                             f"OATH hearing {fmt(hd)}" + (f" at {r['hearing_time']}" if r.get("hearing_time") else ""),
                             ("Decide now whether to pay or contest. Phone hearings must be requested at least 3 "
                              "business days ahead and in-person hearings 5 business days ahead (per OATH); "
                              "online hearings can be submitted up to the hearing date."),
                             LINKS["oath_hearings"]))
        if status in ("DEFAULTED", "DOCKETED"):
            out.append(alert(b, "Case status change", f"status:{r['ticket_number']}:{status}", today,
                             f"Summons #{r['ticket_number']} is now {status.title()}", "high",
                             OATH_STATUS_TXT[status] + f" Issuing agency: {agency}. Balance due on record: "
                             f"${r.get('balance_due') or 'n/a'}. The respondent may be a tenant or business at this "
                             "location rather than the owner.",
                             None,
                             "Review the case on the OATH / CityPay site and decide whether to pay or ask for a new hearing.",
                             LINKS["oath_reopen"]))
    return out


def deadlines(b, today):
    out = []
    if b["units_res"] >= 3:
        start = dt.date(today.year, 12, 1)
        end = dt.date(today.year, 12, 31)
        if today <= end and (start - today).days <= 30:
            window = "is open now" if today >= start else f"opens in {(start - today).days} days"
            out.append(alert(b, "Filing deadline", f"bedbug:{today.year}", today,
                             f"Annual bedbug report: filing window {window} (Dec 1 - Dec 31)", "medium",
                             (f"This building has {b['units_res']} residential units per PLUTO, so as a multiple "
                              f"dwelling it falls under the annual bedbug filing rule (Local Law 69 of 2017). The "
                              f"report covers Nov 1, {today.year - 1} - Oct 31, {today.year} and is filed with HPD "
                              f"even if there were no infestations. The property registration must be current to file online."),
                             f"File Dec 1 - Dec 31, {today.year}",
                             ("File online through HPD (corporate owners must file online; individual owners may use "
                              "the paper form). Afterwards give tenants the filing receipt at lease start/renewal or "
                              "post it in the building, and provide or post DOHMH's 'Stop Bedbugs Safely' guide."),
                             LINKS["bedbugs"]))
    end = parse_date(b.get("hpd_registration_end"))
    if b["units_res"] >= 3 and not end:
        out.append(alert(b, "Filing deadline", "registration:none", today,
                         "No HPD property registration found for this lot", "medium",
                         ("HPD's open registration list has no record for this tax lot, although PLUTO shows "
                          f"{b['units_res']} residential units. Buildings with 3+ units must register with HPD every "
                          "year. This can be a data-matching gap, so confirm on HPD Online before acting."),
                         None,
                         "Look the building up on HPD Online; if it isn't registered, register through HPD's Property Registration Online System.",
                         LINKS["hpd_register"]))
    if b["units_res"] >= 3 and end and end - today <= dt.timedelta(days=45):
        state = "expired" if end < today else "expires"
        out.append(alert(b, "Filing deadline", f"registration:{end}", today,
                         f"HPD property registration {state} {fmt(end)}", "medium" if end >= today else "high",
                         ("HPD's registration list shows this building's annual registration "
                          f"{'ended' if end < today else 'ending'} on {fmt(end)}. Buildings with 3+ units must register "
                          "with HPD every year. Note the open-data copy can lag; confirm on HPD Online."),
                         None,
                         ("Renew the registration through HPD's Property Registration Online System. Without a "
                          "valid registration an owner can't certify HPD violations or file the bedbug report online, "
                          "and can be subject to civil penalties."),
                         LINKS["hpd_register"]))
    return out


# ---------------------------------------------------------------- state & output

def load_state(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"buildings": {}}


def save_state(path, state):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f, indent=1, sort_keys=True)
    os.replace(tmp, path)


SEV_ORDER = {"high": 0, "medium": 1, "low": 2}


def render_md(blds, alerts, run_date):
    lines = [f"# NYC Small-Building Watch - alerts for {fmt(run_date)}", "", f"> {DISCLAIMER}", ""]
    for b in blds:
        mine = sorted([a for a in alerts if a["building"] == b["key"]],
                      key=lambda a: (SEV_ORDER.get(a["severity"], 3), a["date"] or ""))
        title = b["address"] + (f" ({b['label']})" if b.get("label") else "")
        lines += [f"## {title}", "",
                  f"BBL {b['bbl']} | BIN {', '.join(b['bins']) or 'n/a'} | {b['units_res']} residential / "
                  f"{b['units_total']} total units | building class {b['bldg_class']}", ""]
        if not mine:
            lines += ["No new items since the last check.", ""]
        for a in mine:
            lines += [f"### [{a['severity'].upper()}] {a['title']}",
                      f"- **Source:** {a['source']} (record {a['id']}, dated {a['date'] or 'n/a'})",
                      f"- **What it is:** {a['what']}"]
            if a["deadline"]:
                lines.append(f"- **Deadline / hearing:** {a['deadline']}")
            lines += [f"- **Next step:** {a['next_step']}", f"- **Official link:** {a['link']}", ""]
    lines += ["---", DISCLAIMER, ""]
    return "\n".join(lines)


def send_email(to_addr, subject, body_md):
    """Stub. Wire to a provider (e.g. Postmark/Resend/SES) using EMAIL_API_KEY from the environment."""
    key = os.environ.get("EMAIL_API_KEY")
    os.makedirs("outbox", exist_ok=True)
    fn = os.path.join("outbox", re.sub(r"[^A-Za-z0-9]+", "_", f"{to_addr}_{subject}")[:120] + ".md")
    with open(fn, "w") as f:
        f.write(body_md)
    print(f"[email stub] {'key present' if key else 'no EMAIL_API_KEY'}; would send '{subject}' to {to_addr}; saved {fn}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--buildings", default="buildings.txt")
    ap.add_argument("--state", default="state.json")
    ap.add_argument("--since", help="YYYY-MM-DD: report items on/after this date (ignores stored last-seen)")
    ap.add_argument("--first-run-days", type=int, default=30, help="look-back for buildings with no state")
    ap.add_argument("--overlap-days", type=int, default=14,
                    help="re-scan this many days before last-seen to catch late-posted records (deduped by ID)")
    ap.add_argument("--out", default="alerts.md")
    ap.add_argument("--json", default="alerts.json")
    ap.add_argument("--no-save", action="store_true", help="don't update state.json")
    ap.add_argument("--email", help="send the digest to this address (stub)")
    ap.add_argument("--workers", type=int, default=4, help="buildings fetched in parallel")
    ap.add_argument("--resolve",help="just resolve one address/BBL and print it")
    a = ap.parse_args()

    if a.resolve:
        print(json.dumps(resolve(a.resolve), indent=1))
        return

    today = dt.date.today()
    state = load_state(a.state)
    with open(a.buildings) as f:
        entries = [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]

    def work(e):
        """Resolve + fetch one building (runs in a thread; ~10 HTTP calls of a few seconds each)."""
        b = resolve(e)
        st = state["buildings"].get(b["key"], {})
        if a.since:
            since = dt.date.fromisoformat(a.since)
        elif st.get("last_seen"):
            since = dt.date.fromisoformat(st["last_seen"]) - dt.timedelta(days=a.overlap_days)
        else:
            since = today - dt.timedelta(days=a.first_run_days)
        print(f"-> {b['address']} BBL {b['bbl']} BINs {b['bins']} since {since}", file=sys.stderr)
        return b, fetch(b, since) + upcoming(b, today) + deadlines(b, today)

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=a.workers) as pool:
        futures = [(e, pool.submit(work, e)) for e in entries]
    results = []
    for e, fu in futures:
        try:
            results.append(fu.result())
        except Exception as ex:  # keep going for the other buildings
            print(f"!! failed for {e!r}: {ex}", file=sys.stderr)

    blds, alerts = [], []
    for b, items in results:
        st = state["buildings"].setdefault(b["key"], {"seen": {}, "last_seen": None})
        new = []
        for it in items:
            k = f"{it['source']}|{it['id']}"
            if k in st["seen"] and not a.since:
                continue
            st["seen"][k] = today.isoformat()
            new.append(it)
        # prune seen keys older than 180 days to keep the file small
        cutoff = (today - dt.timedelta(days=180)).isoformat()
        st["seen"] = {k: v for k, v in st["seen"].items() if v >= cutoff}
        st["last_seen"] = today.isoformat()
        st["address"] = b["address"]
        blds.append(b)
        alerts.extend(new)

    md = render_md(blds, alerts, today)
    with open(a.out, "w") as f:
        f.write(md)
    with open(a.json, "w") as f:
        json.dump({"run_date": today.isoformat(), "disclaimer": DISCLAIMER, "alerts": alerts}, f, indent=1)
    if not a.no_save:
        save_state(a.state, state)
    if a.email and alerts:
        send_email(a.email, f"{len(alerts)} new building alert(s) - {today}", md)
    print(f"{len(alerts)} alert(s) for {len(blds)} building(s) -> {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
