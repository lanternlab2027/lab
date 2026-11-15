#!/usr/bin/env bash
# Downloads the raw inputs into bots/dogs/.cache/ (not committed, ~86 MB).
#   dogs.csv      NYC Dog Licensing Dataset (nu7n-tubp), every row
#   zip_311.json  311 requests since 2025 grouped by ZIP + borough (erm2-nwe9), for the ZIP -> borough map
#   zip_rest.json DOHMH restaurant inspections grouped by ZIP + borough (43nn-pn8j), fallback for the map
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)/.cache"; mkdir -p "$D"
API=https://data.cityofnewyork.us/resource
curl -sS -f -m 900 -o "$D/dogs.csv.tmp" "$API/nu7n-tubp.csv?\$limit=5000000&\$order=:id" && mv "$D/dogs.csv.tmp" "$D/dogs.csv"
curl -sS -f -m 300 -o "$D/zip_311.json" "$API/erm2-nwe9.json?\$select=incident_zip,borough,count(*)%20as%20n&\$where=created_date%3E%272025-01-01%27&\$group=incident_zip,borough&\$limit=50000"
curl -sS -f -m 120 -o "$D/zip_rest.json" "$API/43nn-pn8j.json?\$select=zipcode,boro,count(*)%20as%20n&\$group=zipcode,boro&\$limit=50000"
curl -sS -f -m 60 "https://data.cityofnewyork.us/api/views/nu7n-tubp.json" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const v=JSON.parse(s);require("fs").writeFileSync(process.argv[1],JSON.stringify({name:v.name,id:v.id,rowsUpdatedAt:v.rowsUpdatedAt,fetched:new Date().toISOString()}))})' "$D/view.json"
wc -l "$D/dogs.csv"
