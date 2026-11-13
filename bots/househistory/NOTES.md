# NYC House History Report: data pipeline notes

These notes cover how the two samples were built, so the process can be repeated for each order.

- Samples: 20 East 127th St, Manhattan (Langston Hughes House, BBL 1-01751-0064, BIN 1054123), and 70 Willow St, Brooklyn (Brooklyn Heights HD, BBL 3-00224-0016, BIN 3001657).
- Helper scripts (copied for reuse) are in `../build/`:
  - `acris.py`: ACRIS legals, master and parties join.
  - `ca.py`: Chronicling America search plus OCR line extraction.
  - `build.py`: inlines the CSS and base64 map image into the sample HTML.
- Raw pulls are in `raw/`.

## Time taken
- About 25 minutes of wall-clock time for both houses together, including a lot of one-time discovery: endpoints, Sanborn volume indexes and template design.
- A repeat order should take about 30–45 minutes of hands-on time per house. Most of that goes on:
  - reading OCR hits to discard false matches;
  - locating the right Sanborn sheet;
  - writing the narrative ($149 tier).

## Step 0: Resolve the address to BBL / BIN
PLUTO (`64uk-42ks`). Use the address in PLUTO's spelling (`20 EAST 127 STREET`, `70 WILLOW STREET`) plus `borough` (MN/BX/BK/QN/SI). Always `$select` away `ownername`.
```
https://data.cityofnewyork.us/resource/64uk-42ks.json?address=70%20WILLOW%20STREET&borough=BK&$select=bbl,yearbuilt,numfloors,lotfront,lotdepth,bldgfront,bldgdepth,bldgarea,bldgclass,unitsres,landmark,histdist,zonedist1,sanborn,latitude,longitude
```
- Gives: year built, floors, lot and building dimensions, building class, units, landmark and historic district, and the modern Sanborn sheet code (e.g. `302 014`, `108N087`). The modern code does not map to old LoC volumes.
- BIN comes from the LPC building DB (step 1). It is also available in the Building Footprints dataset.

## Step 1: At a glance (LPC)
- **Building database** (`gpmc-yuvp`, the parent of map view `7mgd-s57w`), by BBL:
  - `https://data.cityofnewyork.us/resource/gpmc-yuvp.json?bbl=3002240016`
  - Fields: `date_combo`, `arch_build`, `own_devel`, `style_prim`, `mat_*`, `build_type`, `altered`, `notes`, `hist_dist`, `lm_new`, `bin`.
  - Covers every building in a historic district or individual landmark. It is empty for non-designated buildings, so fall back to PLUTO `yearbuilt`, which is often an estimate.
- **Individual landmarks** (`buis-pvji`): `?bbl=1017510064` returns the LP number and designation date.
- **Historic districts** (`skyk-mpzq`): `?area_name=Brooklyn%20Heights%20Historic%20District` returns the LP number, designation date and hearing date.
- **Designation report PDF**: `https://s-media.nyc.gov/agencies/lpc/lp/{LPnumber 4-digit}.pdf`, e.g. `1135.pdf`.
  - **Blocked from the shell (proxy 403).** It was read with WebFetch instead. Historic-district reports such as `0099.pdf` are huge, so search them for the address.

## Step 2: Permits and changes
- **DOB BIS job filings** (`ic3t-wcy2`), roughly 1989 to 2020s: `?bin__=3001657&$limit=500`.
  - Rows repeat (one per doc/status), so dedupe on `job__` + `doc__`.
  - Useful fields: `job_type` (A1/A2/A3/NB/DM), `job_status_descrp`, `pre__filing_date`, `initial_cost`, `existing/proposed_dwelling_units`, `job_description`.
- **DOB NOW filings** (`w9ak-ipjd`): `?bin=1054123`.
- **DOB permit issuance** (`ipu4-2q9a`): `?bin__=...`. It returned nothing extra for these two.
- **LPC permit applications** (`dpm2-m9mq`): `?borough=Brooklyn&block=224&lot=16&$select=docket,received_date,issue_date,regulation_type,worktypes`.
  - Block and lot are unpadded.
  - **Do not select `owner_name` or the applicant fields.**

## Step 3: Ownership since 1966 (ACRIS)
Run `python3 acris.py <boro 1-5> <block> <lot> <tag>`. It does three things:
1. Calls Legals `8h5j-fqxa` with `?borough=3&block=224&lot=16` to get the document IDs.
2. Calls Master `bnx9-e6tj` with `$where=document_id in(...)` to get `doc_type`, `document_date`, `recorded_datetime` and `document_amt`.
3. Calls Parties `636b-3b5g` with the same `$where` to get the names (party_type 1 = grantor/borrower, 2 = grantee/lender).

Decode doc types with `7isb-wh4c`: DEED, MTGE, SAT, ASST, TLS, DTL, PAT, CTOR (court order), LDMK.

Privacy rules applied in the reports:
- No individual names in transfers after 1990.
- Never name the current owner, even if the deed is pre-1990. 20 E 127th has been privately owned since 1985, so that sale is anonymized.
- LLCs, banks and institutions are named.
- Private owners' financing is summarized, not itemized. Tax liens, court orders and mortgage amounts for individuals are not shown.
- PLUTO, LPC-permit and ACRIS-parties source links are trimmed (`$select`, or a bare dataset link) so the citations don't surface owner names.

## Step 4: Newspapers (Chronicling America)
- `chroniclingamerica.loc.gov` now redirects to `https://www.loc.gov/collections/chronicling-america/`.
- The JSON API returns **403 without a User-Agent**. Send a generic one (`curl/8.5.0`).
- Search:
  ```
  https://www.loc.gov/collections/chronicling-america/?q=%2220+east+127th%22&fo=json&c=40&at=results,pagination[&fa=location_state:new+york][&sp=2]
  ```
- Full OCR text:
  - Take the `segment=` path from each result's `word_coordinates_url`.
  - Fetch the ALTO XML at `https://tile.loc.gov/storage-services{segment}`. For example, `.../batch_dlc_denmark_ver02/data/sn83030214/00175041503/1906111001/0182.xml`.
  - Rebuild lines from `TextLine/String@CONTENT`, then regex for the house number and street with a non-digit boundary: `(^|[^0-9])20 (e|east)\.? 127`.
- Queries used:
  - `"20 east 127th"`
  - `"70 willow street"` and `"70 willow st"` (all hits were Augusta, Maine)
  - `"70 willow" brooklyn` with `fa=location_state:new+york`
- **Always** add the state facet and the borough word.
- Discard false matches by hand, e.g. Willow *drive* (New Rochelle), Willow *av.* (Hoboken), 220 E. 127th.
- Run with `timeout` and `run_in_background` for multi-page loops. The API is slow, at 20–60 s per page.
- Paper names come from `partof_title`. The page link is `id` with https.

## Step 5: Maps (Sanborn, Library of Congress)
- Find candidate volumes:
  ```
  https://www.loc.gov/collections/sanborn-maps/?fa=location_state:new+york|location_city:new+york&fo=json&c=100
  ```
  Brooklyn is `q=brooklyn` (items `sanborn05791_NNN`). Manhattan is `sanborn06116_NNN`.
- `https://www.loc.gov/item/sanborn06116_009/?fo=json`:
  - `item.notes` gives the volume and year.
  - `resources[0].files[i]` lists the sheets. The first file is the street index (`...-ind1`); sheet files are `...-0178L` / `...-0178R`.
- Read the street index image to find the sheet for your street and number range.
  - Brooklyn 1887 Vol. 2: "Willow 1–99, sheet 32".
  - Manhattan 1896 Vol. 8: Fifth Ave 2023–2119 and Madison 1950–2056, sheet 178.
  - Then view the sheet and find the house number written on the lot.
- Crop with IIIF:
  ```
  https://tile.loc.gov/image-services/iiif/service:gmd:...:06116_08_1896-0178L/{x},{y},{w},{h}/1400,/0/default.jpg
  ```
- Rights: LoC states "The content of the Library of Congress online Sanborn Maps Collection is in the public domain and is free to use and reuse." Credit line: Library of Congress, Geography and Map Division, Sanborn Maps Collection.
- Viewer link for citation: `https://www.loc.gov/resource/<resource id>/?sp=<file index+1>`.
- Mostly pre-1923 Manhattan and Brooklyn coverage is public domain. Later volumes exist (to 1951) but check each item's rights statement before reproducing.

## Step 6: 1940s tax photo
- NYC Municipal Archives. **Link only, never embed** (personal-use license).
- From this sandbox, `1940s.nyc` was blocked and the Archives' own viewer URL couldn't be verified. The reports therefore link the Archives' homepage and give the borough/block/lot to search.
- On a normal connection, deep-link the specific lot photo instead.

## Secondary sources used (cite as secondary)
- NYC LGBT Historic Sites Project (Hughes dates, National Register 1982).
- Save Harlem Now! (2023 reopening).
- Brownstoner "Walkabout: Lot 16" (Putnam 1886, Red Cross 1944, Smith 1953–94; gives 1834, which conflicts with the LPC's 1839, so the conflict is flagged).
- Wikipedia "Brooklyn Heights: A Personal Memoir" (Capote 1955–65, Holiday Feb 1959).

## Gaps found
- **Pre-1966 ownership:** not online. ACRIS index entries for both lots effectively start in the 1980s, apart from the 1966 LDMK recording. Earlier chain needs City Register libers (on-site) or secondary sources.
- **DOB before about 1989:** not in Open Data. 20 E 127th has **zero** BIS filings; only 2026 DOB NOW scaffold/shed filings.
- **LPC PDFs:** blocked by the shell proxy; WebFetch works.
- **Newspapers:** Chronicling America NY papers largely stop in the early 1920s. The Brooklyn Daily Eagle isn't in it, which is a big gap for Brooklyn houses; Brooklyn Public Library's Eagle archive is the place to add later.
- **1858/1862 house numbering:** pre-1870s address hits are uncertain, since street numbering may have changed. They are flagged as unverified in sample 2.
- **PLUTO quirks:** PLUTO lists 11 residential units at 20 E 127th, which looks wrong for a 2,754 sq ft rowhouse, so it is flagged in the report. Verifying needs a Certificate of Occupancy check on DOB BIS, which isn't reachable from here.
- **OCR quality:** quotes were hand-corrected and labelled "lightly corrected from OCR". Always eyeball the scan.

## Per-order checklist
1. Address → PLUTO → BBL, BIN, year built. `$select` without the owner field.
2. LPC building DB and landmark/district datasets. Fetch the designation report via WebFetch if designated.
3. DOB BIS, DOB NOW and LPC permits by BIN/BBL. Dedupe.
4. Run `acris.py`. Summarize and apply the privacy rules.
5. Run `ca.py` with 2–3 address spellings ("No. 20 East 127th", "20 E. 127th", "70 Willow st., Brooklyn") plus the state facet. Hand-filter. Keep each quote to 2 lines or fewer.
6. Sanborn: volume index → sheet → IIIF crop → annotate → base64 embed.
7. Fill the template, run `build.py`, check every claim has a footnote, and list the gaps.
