#!/usr/bin/env python3
"""Build the free "NYC Small Building Owner's 2027 Compliance Calendar" PDF.

Usage:  python3 bots/calendar/build_calendar.py [--html-only]
Output: docs/calendar/nyc-2027-owner-calendar.pdf (and a preview PNG for the landing page)

Every item cites source ids from SOURCES; every source is listed in bots/calendar/NOTES.md
with the date it was checked. Edit ITEMS and STANDING to refresh for a new year.
"""
import base64, calendar, datetime as dt, html, io, pathlib, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT_PDF = ROOT / "docs/calendar/nyc-2027-owner-calendar.pdf"
OUT_HTML = pathlib.Path(tempfile.gettempdir()) / "nyc-owner-calendar.html"
LOGO = ROOT / "docs/brand/logo.png"
YEAR = 2027
CHECKED = "Nov 13, 2026"
LOOKUP_URL = "https://lanternlab2027.github.io/lab/buildingwatch/lookup.html"
LOOKUP_SHOW = "lanternlab2027.github.io/lab/buildingwatch/lookup.html"
CAL_URL = "https://lanternlab2027.github.io/lab/calendar/"

D = lambda m, d, y=YEAR: dt.date(y, m, d)

# ---------------------------------------------------------------- sources
SOURCES = [
    ("hpd-bedbug", "HPD: Bedbugs (annual report, Dec 1-31, period Nov 1-Oct 31)", "https://www.nyc.gov/site/hpd/services-and-information/bedbugs.page"),
    ("hpd-bedbug-faq", "HPD: Bedbug Annual Report FAQ (PDF)", "https://www.nyc.gov/assets/hpd/downloads/pdfs/services/bedbugs-annual-report-faq.pdf"),
    ("hpd-reg", "HPD: Register Your Property (May 21-Sept 1, $13 fee; HCR rent registration by July 31)", "https://www.nyc.gov/site/hpd/services-and-information/register-your-property.page"),
    ("hpd-annual", "HPD: Annual Notice and Investigations (lead: Jan 1-16, Feb 15, Feb 16-Mar 1)", "https://www.nyc.gov/site/hpd/services-and-information/annual-notice-and-investigations.page"),
    ("hpd-lead", "HPD: Lead-Based Paint", "https://www.nyc.gov/site/hpd/services-and-information/lead-based-paint.page"),
    ("doh-wg", "NYC Health (DOHMH): Window Guards (notice Jan 1-15, return by Feb 15)", "https://www.nyc.gov/site/doh/health/health-topics/window-guards.page"),
    ("hpd-wg", "HPD: Window Guards", "https://www.nyc.gov/site/hpd/services-and-information/window-guards.page"),
    ("hpd-stove", "HPD: Stove Knob Covers (annual notice on or before Jan 16)", "https://www.nyc.gov/site/hpd/services-and-information/stove-knob-covers.page"),
    ("hpd-detect", "HPD: Smoke, Carbon Monoxide, and Natural Gas Detectors", "https://www.nyc.gov/site/hpd/services-and-information/detectors.page"),
    ("dob-natgas", "DOB press release, Oct 13, 2026: natural gas detectors required by Jan 1, 2027", "https://www.nyc.gov/site/buildings/dob/pr-nyc_natgas.page"),
    ("hpd-allergen", "HPD: Indoor Allergen Hazards (Local Law 55 of 2018)", "https://www.nyc.gov/site/hpd/services-and-information/indoor-allergen-hazards-mold-and-pests.page"),
    ("hpd-bulletin", "HPD: December 2025 Bulletin to Property Owners (annual dates, stove knobs, LL55, LL86 notice, service interruptions)", "https://www.nyc.gov/site/hpd/services-and-information/property-owner-bulletins/december-2025.page"),
    ("hpd-heat", "HPD: Heat and Hot Water (Oct 1-May 31; 68F/62F; 120F hot water)", "https://www.nyc.gov/site/hpd/services-and-information/heat-and-hot-water-information.page"),
    ("dob-boiler", "DOB: Boiler Compliance (Jan 1-Dec 31 cycle; file within 14 days; late until Jan 14)", "https://www.nyc.gov/site/buildings/safety/boiler-compliance.page"),
    ("dob-gas", "DOB: Gas Piping Inspections, Local Law 152 (sub-cycle D: CDs 11, 12, 14, 15, 17 = 2027)", "https://www.nyc.gov/site/buildings/property-or-business-owner/gas-piping-inspections.page"),
    ("dob-facade", "DOB: Facade Compliance (FISP; over 6 stories; sub-cycle by last digit of tax block)", "https://www.nyc.gov/site/buildings/safety/facade-compliance.page"),
    ("dob-fisp10", "DOB: FISP Cycle 10 Sub-Cycle Diagram (PDF)", "https://www.nyc.gov/assets/buildings/pdf/cycle10-diagram.pdf"),
    ("dob-bench", "DOB: Benchmarking (LL84, May 1) and Energy Grades (LL33, Oct 1 label, $1,250 fine)", "https://www.nyc.gov/site/buildings/codes/benchmarking.page"),
    ("dob-ll97", "DOB: Local Law 97 overview (annual report May 1)", "https://www.nyc.gov/site/buildings/codes/ll97-greenhouse-gas-emissions-reductions.page"),
    ("ll97-law", "Local Law 97 of 2019 (Admin. Code 28-320.3.7) (PDF)", "https://www.nyc.gov/assets/buildings/local_laws/ll97of2019.pdf"),
    ("rcny-103-14", "1 RCNY 103-14 (LL97 rule: extensions, late-filing penalty) (PDF)", "https://www.nyc.gov/assets/buildings/rules/1_RCNY_103-14.pdf"),
    ("dof-due", "DOF: Property Tax Due Dates (quarterly grace to the 15th; next-business-day rule; early-pay discount)", "https://www.nyc.gov/site/finance/property/property-due-dates.page"),
    ("dof-bills", "DOF: Property Tax Bills and Payments (quarterly if AV $250,000 or less)", "https://www.nyc.gov/site/finance/property/property-bills-and-payments.page"),
    ("tc-nopv", "NYC Tax Commission: Challenging Your Notice of Property Value (Mar 1 / Mar 15; NOPV about Jan 15)", "https://www.nyc.gov/site/taxcommission/about/challenging-notice-of-property-value.page"),
    ("tc-forms", "NYC Tax Commission: Forms", "https://www.nyc.gov/site/taxcommission/forms/forms.page"),
    ("tc600", "NYC Tax Commission: TC600 Instructions 2026/27 (PDF)", "https://www.nyc.gov/assets/taxcommission/downloads/pdf/tc600-2026.pdf"),
    ("dof-challenge", "DOF: Challenge Your Assessment", "https://www.nyc.gov/site/finance/property/challenge-your-assessment.page"),
    ("dof-rfr", "DOF: Property Forms, Assessments and Valuations (Request for Review deadlines)", "https://www.nyc.gov/site/finance/property/property-forms-assessments-and-valuations.page"),
    ("dof-cal", "DOF: Finance Calendar", "https://www.nyc.gov/site/finance/about/finance-calendar.page"),
    ("dof-rpie", "DOF: Real Property Income and Expense (RPIE) Statements", "https://www.nyc.gov/site/finance/property/property-rpie.page"),
    ("dof-rpie-info", "DOF: RPIE filing information (PDF; who must file, exclusions)", "https://www.nyc.gov/assets/finance/downloads/pdf/rpie/rpiefilinginfo.pdf"),
    ("dsny-bins", "DSNY: Residential Containerization (NYC Bins for 1-9 units)", "https://www.nyc.gov/site/dsny/collection/containerization/residential-containerization.page"),
    ("hpd-signage", "HPD: Required Signage and Notices", "https://www.nyc.gov/site/hpd/services-and-information/required-signage.page"),
]
SRC_NUM = {k: i + 1 for i, (k, _, _) in enumerate(SOURCES)}

# ---------------------------------------------------------------- applies-to tags
TAGS = {
    "all":    ("All owners", "t-all"),
    "rent":   ("Has tenants", "t-all"),
    "3plus":  ("3+ units", "t-size"),
    "pre60":  ("Built before 1960", "t-age"),
    "rs":     ("Rent-stabilized", "t-rs"),
    "boiler": ("6+ units or mixed-use, with boiler", "t-size"),
    "rpie":   ("11+ units or mixed-use", "t-size"),
    "25k":    ("Over 25,000 sq ft", "t-size"),
    "6story": ("Over 6 stories", "t-size"),
    "gas":    ("Has gas piping", "t-gas"),
    "notr3":  ("Not a 1-2 family home", "t-size"),
    "1to9":   ("1-9 units", "t-size"),
    "qtr":    ("Quarterly payers", "t-all"),
    "class1": ("Tax class 1 (1-3 family)", "t-all"),
    "class24": ("Tax class 2, 3 or 4", "t-all"),
    "class4": ("Tax class 4", "t-all"),
}

# ---------------------------------------------------------------- dated items
# kind: "due" (deadline), "window" (start-end range), "opens", "info"
ITEMS = [
    # JANUARY
    dict(s=D(1, 1), kind="due", title="Natural gas detectors required", tags=["gas"], src=["hpd-detect", "dob-natgas", "hpd-bulletin"],
         text="Every apartment in a residential building with gas piping needs a natural gas alarm listed to UL 1484 or UL 2075, placed near the gas appliances. Battery, plug-in and hard-wired models are all allowed. Give each unit the testing and maintenance notice, and post the detector notice where required.",
         note="HPD covers multiple dwellings and 1-2 family homes that aren't owner-occupied. DOB's notice also lists 1-2 family homes."),
    dict(s=D(1, 1), kind="due", title="Property tax payment due", tags=["all"], src=["dof-due", "dof-bills"],
         text="Jan 1 is a federal holiday, so DOF's next-business-day rule applies. Quarterly payers (assessed value $250,000 or less) can pay interest-free through the grace period, Fri Jan 15. Semi-annual payers (over $250,000) owe the second half and get no grace period."),
    dict(s=D(1, 1), e=D(1, 15), kind="window", title="Window-guard annual notice to every apartment", tags=["3plus"], src=["doh-wg", "hpd-wg", "hpd-bulletin"],
         text="Deliver the Health Department's annual notice asking whether a child 10 or younger lives there. Use the revised form (it changed for 2026). For buildings built before 1960, the combined lead and window-guard form covers both notices.",
         note="DOHMH says Jan 1-15 and HPD's bulletin says by Jan 16, so delivering by Jan 15 meets both."),
    dict(s=D(1, 1), e=D(1, 16), kind="window", title="Lead-paint annual notice", tags=["pre60"], src=["hpd-annual", "hpd-lead"],
         text="Ask each tenant whether a child under 6 resides there (spends 10+ hours a week). Give two copies in English and two in Spanish, and keep proof of delivery.",
         note="Applies to multiple dwellings and tenant-occupied units in 1-2 family homes. It also applies to 1960-1978 buildings if you know there is lead paint."),
    dict(s=D(1, 16), kind="due", title="Stove knob cover annual notice", tags=["3plus"], src=["hpd-stove", "hpd-bulletin"],
         text="Send by Jan 16 (a Saturday in 2027). The notice tells tenants they can ask for stove knob covers or permanent safety knobs for gas stoves. Provide a device within 30 days of a written request. Devices are required wherever you know a child under 6 lives. Keep your records for 5 years."),
    dict(s=D(1, 1), kind="opens", title="2027 boiler inspection cycle opens", tags=["boiler"], src=["dob-boiler"],
         text="Inspect between Jan 1 and Dec 31, and file the report in DOB NOW: Safety within 14 days of the inspection. Thu Jan 14 is also the last day to file a late 2026 report.",
         note="Exempt: low-pressure boilers in residential buildings with 5 or fewer families, and a boiler that heats only one apartment."),
    dict(s=D(1, 1), kind="opens", title="Gas piping inspection year (Local Law 152)", tags=["notr3"], src=["dob-gas"],
         text="Due in 2027 if the building is in Community District 11, 12, 14, 15 or 17 in any borough. A Licensed Master Plumber inspects, and the certification goes to DOB within 60 days. No gas piping? File a no-gas certification instead.",
         note="Look up your community district with DOB's LL152 tool. Other districts are due in 2028, 2029 or 2030."),
    dict(s=D(1, 15), kind="info", expected=True, title="Notice of Property Value arrives (2027/28)", tags=["all"], src=["tc-nopv", "dof-cal"],
         text="DOF mails the Notice of Property Value on or about Jan 15. Check the market value, tax class and exemptions now, because the appeal deadlines are in March."),
    # FEBRUARY
    dict(s=D(2, 15), kind="due", title="Annual notices due back from tenants", tags=["3plus", "pre60"], src=["doh-wg", "hpd-annual"],
         text="Collect the window-guard and lead notices. Install window guards wherever a child 10 or younger lives or a tenant asks for them. Do a visual lead investigation at least once a year in every unit where a child under 6 resides."),
    dict(s=D(2, 16), e=D(3, 1), kind="window", title="Lead follow-up for units that didn't answer", tags=["pre60"], src=["hpd-annual"],
         text="Make reasonable attempts to inspect each unit that didn't return the notice. If you can't get access by Mar 1, notify the Health Department in writing: DOHMH Healthy Homes, 125 Worth St, 6th Fl, CN58, New York, NY 10013. Keep a copy."),
    dict(s=D(2, 21), kind="due", title="Facade (FISP) Cycle 10A closes; 10C opens", tags=["6story"], src=["dob-facade", "dob-fisp10"],
         text="If the tax block ends in 4, 5, 6 or 9, the sub-cycle 10A filing window (Feb 21, 2025-Feb 21, 2027) closes. If it ends in 1, 2 or 3, the 10C window opens (to Feb 21, 2029). Feb 21, 2027 is a Sunday."),
    # MARCH
    dict(s=D(3, 1), kind="due", title="Lead access attempts end", tags=["pre60"], src=["hpd-annual"],
         text="This is the last day of the Feb 16-Mar 1 access period. Notify DOHMH in writing about any unit you couldn't get into."),
    dict(s=D(3, 1), kind="due", expected=True, title="Tax appeal deadline: class 2, 3 and 4", tags=["class24"], src=["tc-nopv", "tc-forms", "tc600", "dof-rfr"],
         text="The Tax Commission must receive the application by this date (Mon Mar 1, 2027). File in person or by mail, with an original signature; fax and email aren't accepted. In 2026 the cutoff was 5:00 PM. DOF's free online Request for Review had the same date for class 2.",
         note="Expected: this is the statutory date. The 2027 forms aren't posted yet."),
    dict(s=D(3, 15), kind="due", expected=True, title="Tax appeal deadline: class 1 (1-3 family)", tags=["class1"], src=["tc-nopv", "tc-forms", "tc600", "dof-challenge", "dof-rfr"],
         text="The Tax Commission must receive the application by Mon Mar 15, 2027. DOF's online Request for Review for class 1 had the same date in 2026. Before you file, compare the NOPV's assessed value with 6% of what you think the home is worth (form TC108).",
         note="Expected: this is the statutory date. The 2027 forms aren't posted yet."),
    # APRIL
    dict(s=D(4, 1), kind="due", title="Property tax payment due (quarterly)", tags=["qtr"], src=["dof-due"],
         text="Due Thu Apr 1, with an interest-free grace period through Thu Apr 15. After the grace period, interest runs from Apr 1 and compounds daily."),
    dict(s=D(4, 1), kind="due", expected=True, title="DOF Request for Review deadline: class 4", tags=["class4"], src=["dof-rfr"],
         text="This is DOF's free online review for commercial (class 4) property. The 2026 deadline was Apr 1. It doesn't replace a Tax Commission appeal.",
         note="Expected: based on the 2026 date. DOF hasn't posted the 2027 dates."),
    # MAY
    dict(s=D(5, 1), kind="due", title="Energy benchmarking (LL84) and LL97 emissions report", tags=["25k"], src=["dob-bench", "dob-ll97", "ll97-law", "rcny-103-14"],
         text="Submit calendar-2026 energy and water data through ENERGY STAR Portfolio Manager. File the LL97 report, certified by a registered design professional. You can request an LL97 extension from 30 days before to 60 days after May 1. A missed LL84 filing costs $500, plus $500 per missed quarter.",
         note="May 1, 2027 is a Saturday. DOB hadn't posted its 2027 deadline notice when we checked."),
    dict(s=D(5, 21), kind="opens", title="HPD property registration window opens", tags=["3plus"], src=["hpd-reg"],
         text="The window runs May 21-Sept 1. Renewing early avoids the summer rush, and a valid registration is needed to file the December bedbug report.",
         note="1-2 unit buildings must register only if neither the owner nor the owner's immediate family lives there."),
    dict(s=D(5, 31), kind="due", title="Heat season ends", tags=["rent"], src=["hpd-heat"],
         text="Heat rules end after May 31. Hot water at 120°F is still required all year."),
    # JUNE
    dict(s=D(6, 1), kind="due", expected=True, title="RPIE income and expense filing", tags=["rpie"], src=["dof-rpie", "dof-rpie-info"],
         text="Required for income-producing property with an actual assessed value over $40,000. File RPIE-2026 (calendar-2026 income and expenses) or a claim of exclusion on DOF SmartFile. If you have ground- or second-floor storefronts, also file the Storefront Registry. Penalties start at $300.",
         note="Not required: residential buildings with 10 or fewer units, or class 1 or 2 with 6 or fewer units and at most one commercial unit. Expected: RPIE-2025 was due June 1, 2026."),
    # JULY
    dict(s=D(7, 1), kind="due", title="Property tax payment due (new tax year)", tags=["all"], src=["dof-due", "dof-bills"],
         text="This is the start of the 2027/28 tax year. Quarterly payers have a grace period through Thu Jul 15, and semi-annual payers owe the first half. Paying the whole year by the July due date (or the grace date) earns a 0.5% discount."),
    dict(s=D(7, 31), kind="due", title="NY State rent registration (HCR)", tags=["rs"], src=["hpd-reg", "hpd-bulletin"],
         text="Register the building's rent-stabilized apartments with NY State Homes and Community Renewal, and give each tenant their unit's copy. This is separate from HPD registration. Jul 31, 2027 is a Saturday."),
    # AUGUST
    dict(s=D(8, 1), kind="info", title="Benchmarking: quarterly late-penalty date", tags=["25k"], src=["dob-bench"],
         text="Only if the May 1 benchmarking filing still hasn't been made: another $500 penalty can apply at each missed quarter (Aug 1, Nov 1, Feb 1), up to $2,000 a year."),
    # SEPTEMBER
    dict(s=D(9, 1), kind="due", title="HPD property registration deadline", tags=["3plus"], src=["hpd-reg", "hpd-bulletin"],
         text="Renew online. The $13 fee is billed on your DOF property tax statement. Unregistered buildings get violations, and you can't file the bedbug report in December without a valid registration.",
         note="1-2 unit buildings must register only if neither the owner nor the owner's immediate family lives there."),
    # OCTOBER
    dict(s=D(10, 1), kind="opens", title="Heat season begins (runs to May 31)", tags=["rent"], src=["hpd-heat"],
         text="From 6am to 10pm, when it's below 55°F outside, keep apartments at 68°F or warmer. Overnight, keep them at 62°F or warmer regardless of the outside temperature."),
    dict(s=D(10, 1), kind="due", title="Property tax payment due (quarterly)", tags=["qtr"], src=["dof-due"],
         text="Due Fri Oct 1, with an interest-free grace period through Fri Oct 15."),
    dict(s=D(10, 1), e=D(10, 31), kind="window", title="Post the energy grade label", tags=["25k"], src=["dob-bench"],
         text="DOB posts the label in DOB NOW on Oct 1. Print it and display it near each public entrance within 30 days. The fine for not posting it is $1,250."),
    dict(s=D(10, 31), kind="info", title="Bedbug reporting year ends", tags=["3plus"], src=["hpd-bedbug"],
         text="The Dec 2027 report covers Nov 1, 2026-Oct 31, 2027. Pull your records of infested units, units treated and re-infestations for that period."),
    # NOVEMBER
    dict(s=D(11, 1), kind="info", title="Benchmarking: quarterly late-penalty date", tags=["25k"], src=["dob-bench"],
         text="Only if the May 1 benchmarking filing still hasn't been made: another $500 penalty can apply."),
    # DECEMBER
    dict(s=D(12, 1), e=D(12, 31), kind="window", title="Bedbug annual report to HPD", tags=["3plus"], src=["hpd-bedbug", "hpd-bedbug-faq", "hpd-bulletin"],
         text="Filing is free. Corporate owners must file online, and individual owners may use the paper form. Afterwards, post the filing receipt or give it to tenants, along with DOHMH's “Stop Bedbugs Safely.” Ignore companies that charge to file for you."),
    dict(s=D(12, 31), kind="due", title="Gas piping inspection year ends (CDs 11, 12, 14, 15, 17)", tags=["notr3"], src=["dob-gas"],
         text="If you're in one of these districts, the inspection must be done in 2027. Submit the certification to DOB within 60 days of the inspection."),
    dict(s=D(12, 31), kind="due", title="2027 boiler inspection cycle ends", tags=["boiler"], src=["dob-boiler"],
         text="Inspect by Dec 31 and file within 14 days. Reports filed after 14 days but by Jan 14, 2028 count as late."),
]

STANDING = [
    ("Heat and hot water", ["rent"], ["hpd-heat"],
     "Oct 1-May 31: when it's below 55°F outside, keep apartments at 68°F+ from 6am to 10pm. Overnight, keep them at 62°F+ regardless. Hot water at 120°F all year."),
    ("Smoke and carbon monoxide detectors", ["rent"], ["hpd-detect"],
     "Put a smoke detector in every unit of a multiple dwelling. CO detectors are required in every unit where the building has fossil-fuel appliances, including 1-2 family homes that aren't owner-occupied. Replace detectors at the end of their useful life, before a new tenant moves in if one is missing, and within 30 days if one fails from a defect in its first year. Give the notice at installation, post the building notice, and record install and expiration dates."),
    ("Natural gas detectors (from Jan 1, 2027)", ["gas"], ["hpd-detect", "dob-natgas"],
     "One in every unit near the gas appliances, listed to UL 1484 or UL 2075. Combination smoke, CO and gas units are allowed if each part is installed to code."),
    ("Indoor allergens: mold and pests (Local Law 55)", ["3plus"], ["hpd-allergen", "hpd-bulletin"],
     "Inspect every unit for mice, rats, roaches and mold once a year, and respond to complaints. Give HPD's fact sheet and an allergen notice with each lease. Clean vacant units before a new tenant moves in. Fix pests with integrated pest management, using a DEC-licensed applicator for any pesticide. Buildings with 10+ units must use licensed mold assessors and remediators for more than 10 sq ft of mold."),
    ("Stove knob covers", ["3plus"], ["hpd-stove"],
     "Send the annual notice by Jan 16, and provide covers or safety knobs within 30 days of a written request. They're required where a child under 6 lives. You don't have to provide more than two replacements a year. Keep records for 5 years."),
    ("Window guards", ["3plus"], ["doh-wg", "hpd-wg"],
     "Install guards where a child 10 or younger lives, or whenever a tenant asks, and repair them. Window air conditioners in those apartments must be securely installed."),
    ("Lead-safe work", ["pre60"], ["hpd-annual", "hpd-lead"],
     "Do a visual investigation every year in units where a child under 6 resides. Use safe work practices and certified contractors when more than 2 sq ft of lead or unknown paint is disturbed."),
    ("Official NYC Bins for trash", ["1to9"], ["dsny-bins"],
     "Required since June 1, 2026, with full enforcement since Sept 8, 2026."),
    ("Rent-stabilized building notice", ["rs"], ["hpd-bulletin", "hpd-signage"],
     "Since Jan 26, 2026 (Local Law 86 of 2025), post the notice in English and Spanish in the entrance common area. It must show the address and the HPD registration number."),
    ("Interruption of service notice", ["3plus"], ["hpd-bulletin"],
     "Post a notice in English and Spanish at least 24 hours before planned work that will cut heat, hot water, cold water, gas or electricity for 2 hours or more."),
]

# ---------------------------------------------------------------- rendering
e = html.escape
MON = calendar.month_name
MAB = calendar.month_abbr


def logo_uri():
    try:
        from PIL import Image
        im = Image.open(LOGO).convert("RGB").resize((180, 180))
        b = io.BytesIO(); im.save(b, "PNG", optimize=True)
        return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()
    except Exception:
        return ""


def tag_html(keys, expected=False):
    out = "".join(f'<span class="tag {TAGS[k][1]}">{e(TAGS[k][0])}</span>' for k in keys)
    if expected:
        out += '<span class="tag t-exp">Expected date</span>'
    return out


def refs(keys):
    return '<span class="refs">Sources ' + ", ".join(str(SRC_NUM[k]) for k in keys) + "</span>"


def date_badge(it):
    s, en = it["s"], it.get("e")
    if en and en.month == s.month:
        return f'<b>{MAB[s.month]}</b><span>{s.day}-{en.day}</span>'
    if en:
        return f'<b>{MAB[s.month]} {s.day}</b><span class="small">to {MAB[en.month]} {en.day}</span>'
    return f'<b>{MAB[s.month]}</b><span>{s.day}</span><small>{s.strftime("%a")}</small>'


def mini_month(m, items):
    due = {it["s"].day for it in items if it["s"].month == m and it["kind"] in ("due", "opens", "info") and not it.get("e")}
    due |= {it["e"].day for it in items if it.get("e") and it["e"].month == m}
    win = set()
    for it in items:
        if it.get("e"):
            d = it["s"]
            while d <= it["e"]:
                if d.month == m:
                    win.add(d.day)
                d += dt.timedelta(days=1)
    cal = calendar.Calendar(firstweekday=6)
    rows = ['<tr>' + "".join(f"<th>{d}</th>" for d in "SMTWTFS") + "</tr>"]
    for wk in cal.monthdayscalendar(YEAR, m):
        cells = []
        for d in wk:
            if not d:
                cells.append("<td></td>"); continue
            cls = []
            if d in win: cls.append("win")
            if d in due: cls.append("due")
            cells.append(f'<td class="{" ".join(cls)}"><i>{d}</i></td>')
        rows.append("<tr>" + "".join(cells) + "</tr>")
    return f'<table class="mini">{"".join(rows)}</table>'


def item_html(it):
    kind = {"due": "Deadline", "window": "Window", "opens": "Starts", "info": "Heads-up"}[it["kind"]]
    note = f'<p class="note">{e(it["note"])}</p>' if it.get("note") else ""
    return f'''<li class="item k-{it["kind"]}"><div class="dbadge">{date_badge(it)}</div>
<div class="ibody"><div class="ihead"><span class="kind">{kind}</span><h3>{e(it["title"])}</h3></div>
<div class="tags">{tag_html(it["tags"], it.get("expected"))}</div>
<p>{e(it["text"])}</p>{note}{refs(it["src"])}</div></li>'''


def footer(n):
    return f'''<footer><span><b>Lantern Lab NYC</b> &middot; Free building lookup: <a href="{LOOKUP_URL}">{LOOKUP_SHOW}</a></span>
<span>Not legal advice. Not affiliated with the City of New York. &middot; {n}</span></footer>'''


def month_pages(m, n):
    its = sorted([it for it in ITEMS if it["s"].month == m], key=lambda i: (i["s"], i.get("e") or i["s"]))
    if len(its) <= 5:
        return [month_page(m, n, its, True, False)]
    h = (len(its) + 1) // 2
    return [month_page(m, n, its[:h], False, False), month_page(m, n + 1, its[h:], True, True)]


def month_page(m, n, its, last, cont):
    heat = '<div class="ongoing"><b>All month:</b> heat season is on (Oct 1-May 31). See the standing rules page.</div>' if (m <= 4 or m >= 11) else ""
    if m == 5: heat = '<div class="ongoing"><b>Through May 31:</b> heat season is on. Hot water at 120°F all year.</div>'
    if m == 10: heat = '<div class="ongoing"><b>From Oct 1:</b> heat season is on through May 31.</div>'
    nm = m % 12 + 1
    ny = YEAR if m < 12 else YEAR + 1
    nxt = sorted([it for it in ITEMS if it["s"].month == nm], key=lambda i: i["s"])
    if m == 12:
        nxt_txt = "Jan 1-15, 2028: window-guard, lead and stove knob notices go out again. Jan 1, 2028: property tax due and a new boiler inspection cycle opens."
    else:
        seen, parts = set(), []
        for it in nxt:
            if it["title"] in seen: continue
            seen.add(it["title"])
            dlab = f'{MAB[it["s"].month]} {it["s"].day}'
            parts.append(f'{dlab}: {it["title"]}')
        nxt_txt = "; ".join(parts) + "."
    lines = max(0, 7 - len(its)) if last else 0
    nyl = "" if ny == YEAR else " " + str(ny)
    nextbox = (f'<div class="next"><b>Coming up in {MON[nm]}{nyl}:</b> {e(nxt_txt)}</div>' if last
               else '<div class="next"><b>Continued on the next page.</b></div>')
    notes = '<div class="notes"><b>Notes</b>' + '<div class="ln"></div>' * (2 + lines * 2) + "</div>" if lines else ""
    return f'''<section class="page month">
<header class="mh"><div><div class="kicker">NYC small building owner's compliance calendar</div><h2>{MON[m]} <span>{YEAR}{" (continued)" if cont else ""}</span></h2>{heat}</div>{mini_month(m, ITEMS)}</header>
<ul class="items">{"".join(item_html(i) for i in its)}</ul>
{nextbox}
{notes}
{footer(n)}</section>'''


def cover():
    return f'''<section class="page cover">
<div class="brand"><img src="{logo_uri()}" alt=""><div><b>Lantern Lab NYC</b><span>Free tools for NYC building owners</span></div></div>
<h1>NYC Small Building Owner's<br><em>{YEAR} Compliance Calendar</em></h1>
<p class="lede">The city deadlines that owners of 1-20 unit buildings run into, month by month: HPD registration and annual notices, bedbug filing, gas piping and boiler cycles, heat season, property tax, tax appeals, and the new natural gas detector rule. Each date was checked on nyc.gov or in the rule text on {CHECKED}, and each item lists its sources.</p>
<div class="box urgent"><h3>Before {YEAR} starts</h3><ul>
<li><b>Dec 1-31, 2026:</b> file the HPD bedbug report for Nov 1, 2025-Oct 31, 2026 (3+ units). <i>Sources {SRC_NUM["hpd-bedbug"]}, {SRC_NUM["hpd-bulletin"]}</i></li>
<li><b>By Jan 1, 2027:</b> natural gas detectors in every apartment of a building with gas piping. <i>Sources {SRC_NUM["hpd-detect"]}, {SRC_NUM["dob-natgas"]}</i></li></ul></div>
<div class="box"><h3>How to read this calendar</h3>
<p>Each item has tags for the buildings it applies to. If no tag matches your building, the item probably doesn't apply. Check the official page to be sure.</p>
<div class="legend">{tag_html(["all", "rent", "3plus", "pre60", "rs", "gas", "25k", "6story"])}<span class="tag t-exp">Expected date</span></div>
<p><b>Expected date</b> means the agency hadn't published the {YEAR} date when we checked. We show the date set by law or used last year. Mark it and confirm it in January.</p>
<p><b>Unit counts:</b> a "multiple dwelling" has 3 or more apartments. Most HPD notices and filings apply only to those buildings.</p></div>
<div class="box cta"><h3>Which of these apply to your building?</h3>
<p>Enter an address in the free lookup to see open HPD and DOB violations, your gas piping year, whether the bedbug report was filed, and a personal 12-month calendar.</p>
<p class="url"><a href="{LOOKUP_URL}">{LOOKUP_SHOW}</a></p></div>
<p class="disc"><b>Not legal advice.</b> This calendar is general information, and it isn't legal, tax or engineering advice. Lantern Lab NYC isn't affiliated with or endorsed by the City of New York or any City agency. Rules and dates change, and some apply only to certain buildings. Confirm on the official page, or with a lawyer or licensed professional, before you act.</p>
{footer(1)}</section>'''


def glance(n):
    rows = []
    for it in sorted(ITEMS, key=lambda i: (i["s"], i.get("e") or i["s"])):
        s, en = it["s"], it.get("e")
        when = f'{MAB[s.month]} {s.day}' + (f'-{MAB[en.month] + " " if en.month != s.month else ""}{en.day}' if en else "")
        who = ", ".join(TAGS[k][0] for k in it["tags"])
        exp = ' <span class="tag t-exp">Expected</span>' if it.get("expected") else ""
        rows.append(f'<tr><td class="w">{e(when)}</td><td>{e(it["title"])}{exp}</td><td class="who">{e(who)}</td></tr>')
    half = (len(rows) + 1) // 2
    return f'''<section class="page glance">
<div class="kicker">NYC small building owner's compliance calendar</div><h2>{YEAR} at a glance</h2>
<p class="sub">Every dated item in this calendar. Each month's page has the details and the sources. The heat season (Oct 1-May 31) and the year-round rules are on the standing rules page.</p>
<table class="gl"><thead><tr><th>Date</th><th>What</th><th>Applies to</th></tr></thead><tbody>{"".join(rows)}</tbody></table>
{footer(n)}</section>'''


def standing_page(n):
    lis = "".join(f'<li><h3>{e(t)}</h3><div class="tags">{tag_html(tg)}</div><p>{e(x)}</p>{refs(src)}</li>' for t, tg, src, x in STANDING)
    return f'''<section class="page standing">
<div class="kicker">NYC small building owner's compliance calendar</div><h2>Standing rules, all year</h2>
<p class="sub">These rules have no single due date, but HPD and DOB inspectors check for them during any visit.</p>
<ul class="st">{lis}</ul>
{footer(n)}</section>'''


def sources_page(n):
    lis = "".join(f'<li><span class="n">{i + 1}</span><div>{e(t)}<br><a href="{u}">{e(u)}</a></div></li>' for i, (k, t, u) in enumerate(SOURCES))
    return f'''<section class="page sources">
<div class="kicker">NYC small building owner's compliance calendar</div><h2>Sources</h2>
<p class="sub">All pages are official City of New York sources (nyc.gov, or the law and rule text DOB publishes there). Each was checked on {CHECKED}. "Expected" items use the statutory date or the {YEAR - 1} pattern, as noted on each one.</p>
<ol class="srcl">{lis}</ol>
<p class="disc">Not legal advice. Lantern Lab NYC isn't affiliated with the City of New York. If anything here is out of date, the official page wins. Get the latest version of this calendar at <a href="{CAL_URL}">{CAL_URL.replace("https://", "")}</a>.</p>
{footer(n)}</section>'''


CSS = r"""
@page{size:Letter;margin:0}
:root{--navy:#111827;--ink:#1c1d1f;--muted:#5b6068;--line:#dcd8cf;--gold:#c8913a;--gold-l:#fbf1de;--blue:#1f5f8b}
*{box-sizing:border-box}
html,body{margin:0;background:#fff;color:var(--ink);font:10pt/1.38 Inter,"DejaVu Sans",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
a{color:var(--blue);text-decoration:none}
.page{width:8.5in;height:11in;padding:.5in .55in .7in;position:relative;overflow:hidden;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
footer{position:absolute;left:.55in;right:.55in;bottom:.32in;display:flex;justify-content:space-between;gap:12px;font-size:7pt;white-space:nowrap;color:var(--muted);border-top:1px solid var(--line);padding-top:6px}
.kicker{font-size:7.8pt;letter-spacing:.09em;text-transform:uppercase;color:var(--gold);font-weight:700}
h2{font-size:30pt;line-height:1;margin:4px 0 8px;color:var(--navy);font-weight:800;letter-spacing:-.01em}
h2 span{color:var(--gold);font-weight:600}
.sub{color:var(--muted);margin:0 0 14px;font-size:9.5pt}
/* tags */
.tag{display:inline-block;font-size:7.2pt;font-weight:700;padding:1px 6px;border-radius:99px;margin:0 4px 3px 0;border:1px solid transparent;white-space:nowrap}
.t-all{background:#eef1f5;color:#374151}
.t-size{background:#e7f0f7;color:#1f5f8b}
.t-age{background:#f6ebe2;color:#8a4b14}
.t-rs{background:#efe9f6;color:#5b3a8c}
.t-gas{background:#fdecea;color:#a1261b}
.t-exp{background:#fff;color:#9a5b00;border:1px dashed #c8913a}
/* cover */
.cover .brand{display:flex;align-items:center;gap:12px}
.cover .brand img{width:58px;height:58px;border-radius:12px}
.cover .brand b{display:block;font-size:13pt;color:var(--navy)}
.cover .brand span{font-size:9pt;color:var(--muted)}
.cover h1{font-size:34pt;line-height:1.06;margin:34px 0 14px;color:var(--navy);font-weight:800;letter-spacing:-.015em}
.cover h1 em{font-style:normal;color:var(--gold)}
.lede{font-size:11.5pt;line-height:1.5;margin:0 0 18px;max-width:6.6in}
.box{border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:0 0 12px}
.box h3{margin:0 0 6px;font-size:11pt;color:var(--navy)}
.box p{margin:5px 0;font-size:9.4pt}
.box ul{margin:0;padding-left:18px;font-size:9.6pt}.box li{margin:3px 0}
.box i{color:var(--muted);font-size:8pt;font-style:normal}
.box.urgent{border:2px solid var(--gold);background:var(--gold-l)}
.box.cta{background:var(--navy);color:#f3f4f6;border:0}
.box.cta h3{color:#ffd68a}.box.cta a{color:#ffd68a;font-weight:700}
.box.cta .url{font-size:11pt}
.legend{margin:6px 0 2px}
.disc{font-size:8pt;color:var(--muted);margin-top:10px}
/* month */
.mh{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:3px solid var(--navy);padding-bottom:10px;margin-bottom:10px}
.ongoing{font-size:8.6pt;background:var(--gold-l);border-radius:6px;padding:3px 8px;display:inline-block;margin-top:2px}
.mini{border-collapse:collapse;font-size:7.6pt;flex:none}
.mini th{color:var(--muted);font-weight:600;width:20px;height:14px;text-align:center}
.mini td{width:20px;height:17px;text-align:center;padding:0}
.mini td i{font-style:normal;display:inline-block;width:17px;height:15px;line-height:15px;border-radius:99px}
.mini td.win{background:var(--gold-l)}
.mini td.due i{background:var(--navy);color:#fff;font-weight:700}
.items{list-style:none;margin:0;padding:0}
.item{display:grid;grid-template-columns:62px 1fr;gap:12px;padding:8px 0;border-bottom:1px solid var(--line);break-inside:avoid}
.dbadge{text-align:center;border-radius:8px;background:#f4f3ef;padding:6px 2px;line-height:1.1;align-self:start}
.k-due .dbadge{background:var(--navy);color:#fff}
.k-window .dbadge{background:var(--gold-l);border:1px solid #e9cf9c}
.dbadge b{display:block;font-size:7.6pt;text-transform:uppercase;letter-spacing:.06em}
.dbadge span{display:block;font-size:15pt;font-weight:800}
.dbadge span.small{font-size:8pt;font-weight:600;margin-top:2px}
.dbadge small{display:block;font-size:7pt;opacity:.75}
.ihead{display:flex;gap:8px;align-items:baseline}
.kind{font-size:6.8pt;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700;flex:none}
.item h3{margin:0;font-size:11pt;color:var(--navy);line-height:1.25}
.tags{margin:3px 0 1px}
.item p{margin:2px 0;font-size:9.1pt}
.item p.note{color:var(--muted);font-size:8.4pt}
.refs{font-size:7pt;color:var(--muted)}
.next{margin-top:10px;font-size:8.8pt;background:#f4f3ef;border-radius:8px;padding:7px 10px}
.notes{margin-top:12px;font-size:8.5pt;color:var(--muted)}
.notes .ln{border-bottom:1px solid var(--line);height:21px}
/* glance */
.gl{width:100%;border-collapse:collapse;font-size:8.3pt}
.gl th{text-align:left;color:var(--muted);font-weight:700;border-bottom:2px solid var(--navy);padding:3px 6px}
.gl td{padding:2.4px 6px;border-bottom:1px solid #ebe8e1;vertical-align:top}
.gl td.w{white-space:nowrap;font-weight:700;color:var(--navy);width:82px}
.gl td.who{color:var(--muted);width:2.3in}
.gl .tag{font-size:6.4pt;padding:0 5px;margin:0 0 0 4px}
/* standing */
.st{list-style:none;padding:0;margin:0;columns:2;column-gap:22px}
.st li{break-inside:avoid;margin:0 0 10px;border-top:2px solid var(--navy);padding-top:5px}
.st h3{margin:0;font-size:10.2pt;color:var(--navy)}
.st p{margin:3px 0;font-size:8.6pt}
/* sources */
.srcl{list-style:none;padding:0;margin:0;font-size:7.3pt;line-height:1.28;columns:2;column-gap:18px}
.srcl li{display:grid;grid-template-columns:16px 1fr;gap:3px;margin:0 0 5px;break-inside:avoid}
.srcl .n{font-weight:800;color:var(--gold)}
.srcl a{word-break:break-all;color:var(--blue)}
"""


def build_html():
    pages = [cover(), glance(2)]
    n = 3
    for m in range(1, 13):
        mp = month_pages(m, n); pages += mp; n += len(mp)
    pages.append(standing_page(n)); n += 1
    pages.append(sources_page(n))
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>NYC Small Building Owner's {YEAR} Compliance Calendar | Lantern Lab NYC</title>
<style>{CSS}</style></head><body>{"".join(pages)}</body></html>'''


def main():
    doc = build_html()
    OUT_HTML.write_text(doc, encoding="utf-8")
    if "--html-only" in sys.argv:
        print("wrote", OUT_HTML); return
    from playwright.sync_api import sync_playwright
    OUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.goto(OUT_HTML.as_uri())
        pg.wait_for_load_state("networkidle")
        # fail loudly if any page's content overflows its letter-size box
        over = pg.evaluate("""() => [...document.querySelectorAll('.page')].map((p, i) => {
            const f = p.querySelector('footer'); const kids = [...p.children].filter(c => c !== f);
            const bottom = Math.max(...kids.map(c => c.getBoundingClientRect().bottom));
            return bottom > f.getBoundingClientRect().top - 4 ? i + 1 : 0; }).filter(Boolean)""")
        if over and "--force" not in sys.argv:
            raise SystemExit(f"Content overflows the footer on page(s) {over}; shorten text.")
        pg.pdf(path=str(OUT_PDF), format="Letter", print_background=True, prefer_css_page_size=True,
               margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        b.close()
    print("wrote", OUT_PDF, OUT_PDF.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
