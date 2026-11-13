# NYC Food Protection practice test: Spanish version (build notes)

Built 2026-11-13. Not committed or pushed.

## What's here
- Site: `docs/food/es/` contains `index.html`, `quiz.html`, `quiz.js` and `questions/FPCES.json`. It uses `../style.css`.
- English pages: `docs/food/index.html` and `quiz.html` now have an "Español" header link and hreflang alternates. Two Spanish URLs were added to `docs/sitemap.xml`.
- Build: `bots/food_es/bank_es.py` holds the Spanish text for all 131 items. `build_es.py` merges it with `docs/food/questions/FPC.json` (same ids, same answer index, same option order), checks it and writes the JSON.
  - Run: `python3 -I bots/food_es/build_es.py <textdir>`. `<textdir>` holds `study-guide-sp/pN.txt` and `fpc-manual-sp/pN.txt` from `pdftotext -layout`, one file per page.
  - It exits non-zero if a quote is not on the cited page or is over 25 words.
  - Negative test: a changed temperature and a wrong page were both caught.
- Test: `node bots/food_es/test_es.js http://127.0.0.1:PORT/food/ <shotdir>`, serving `docs/` over HTTP. **439/439 checks pass** at 390 px and 1280 px.
- **Git:** `.git/info/exclude` lists `docs/food/es/` and `bots/food_es/` ("WIP agent output; remove these lines when publishing"). I did not touch it. Those lines must be removed, or the files force-added, before a commit picks them up.

## Step 1: what nyc.gov says (fetched 2026-11-13, browser UA)
- Online course page (https://www.nyc.gov/site/doh/business/health-academy/food-protection-online-free.page):
  - "The online course is offered in English, Spanish and Chinese."
  - "The study guide and exam are offered in English and 36 other languages."
  - The study-guide language list has exactly 36 links, Español included. The page does not name Spanish for the *exam* separately, so the site says "confirm the exam language when you book".
- Classroom page (https://www.nyc.gov/site/doh/business/health-academy/food-protection-classroom.page): "The Food Protection Course is available in person in English, Spanish and Bengali."
- FAQ PDF (https://www.nyc.gov/assets/doh/downloads/pdf/hany/food-protection-course-faq.pdf): "What language is it available in? The online course is offered in English, Spanish and Chinese."
- **Official Spanish materials exist** and are linked from both pages:
  - Study guide: https://www.nyc.gov/assets/doh/downloads/pdf/rii/study-guide-sp.pdf ("Revisión del Día 1–5", 9 pp, PDF dated 2017-04-17). It is a direct translation of the English study guide.
  - Manual: https://www.nyc.gov/assets/doh/downloads/pdf/rii/fpc-manual-sp.pdf (126 pp, PDF dated **2012-01-11**). It is **older than the English 2015 manual**, and some facts differ (below).

## How sources were chosen
- **111 items** quote the official Spanish text verbatim:
  - 94 from the Spanish study guide;
  - 17 from the Spanish manual, used only where the fact matches the current English material.
- **20 items** keep the English source and quote, shown as **"Fuente (inglés)"** with `lang="en"` on the quote. They fall into three groups:
  - No Spanish source: FPC-001–006 (nyc.gov web pages and FAQ in English only) and FPC-016, 017, 030, 044, 045, 077, 078, 079, 081, 095 (no matching passage in the 2012 Spanish manual).
  - Outdated or different in the Spanish manual: FPC-080 (the 2012 Spanish manual adds "por no más de dos horas" for thawing in cold running water, which the 2015 English manual does not say) and FPC-120 (the 2012 Spanish manual allows "metal o plástico duro" garbage cans; the 2015 English manual says metal).
  - Errors in the official Spanish text: FPC-073 (the Spanish guide says "**al menos** a 25 pies", which means *at least* 25 ft, the opposite of "within 25 feet") and FPC-074 (typo "agua corriente, caliente y fía").
- Each JSON item also keeps `en.question` and `en.answer` for traceability.

Spanish manual facts that are **outdated compared with the current material** (not used): pork is 155 °F in the manual (p54) vs 150 °F in the 2017 guide, and the manual's own quiz uses 155. The landing page says this and tells readers to trust the guide and course.

## Engine and Kit
- `es/quiz.js` is `docs/food/quiz.js` with the UI strings translated and these changes:
  - `code: 'FPCES'`;
  - `KIT_URL = .../v3/tags/TAGID_FOOD_ES/subscribe`;
  - `KIT_KEY` copied from the English file (not printed);
  - the citation prefix is "Fuente:" or "Fuente (inglés):", depending on `source.lang`.
- The email field `building_address` is set to `FPCES`, so Spanish signups can be told apart in Kit.
- Kit placeholder: `notConfigured = KIT_URL.indexOf('TAGID_') >= 0`. While the placeholder is in place, the page unlocks even if the request fails. With a real tag, a non-2xx response keeps the page locked. Both cases are tested.
- `localStorage` key: `fpcpractice_unlocked_FPCES`, separate from English.
- **No "$14.99 prep pack" button** on the Spanish unlocked screen. There is no Spanish pack, so add it back only when one exists.
- No Spanish study-guide page was built. The site links to DOHMH's official Spanish guide PDF instead.

## Is a fluent reviewer needed? Yes, recommended before promoting
I wrote plain Latin-American Spanish using "usted", but a native speaker who has worked in a NYC kitchen should check the items below. The official Spanish translation itself has several awkward or wrong terms. Where I quote it verbatim, the quote keeps its wording and my question/answer text uses the clearer term.

| Item | Term (EN) | Official Spanish | What I used | Why uncertain |
|---|---|---|---|---|
| FPC-014/015 | Potentially Hazardous Foods | "alimentos potencialmente dañinos" (guide), "peligrosos" (manual) | "potencialmente peligrosos (PHF)" | Two official versions |
| FPC-024 | warmest spot | "partes más cálidas" | "parte más caliente" | fine, just confirm |
| FPC-025–027 | bimetallic stem / thermocouple / thermistor | "vástago bimetálico", "termopar", "termistor" | same | Do workers know these, or say "termómetro de aguja"? |
| FPC-050 | First Aid Choking poster | "Primeros auxilios para ahogamiento" | "atragantamiento" | "ahogamiento" usually means drowning |
| FPC-059 | lag phase | "reposo" | "reposo (lag)" | Textbooks usually say "fase de latencia" |
| FPC-065 | raw shell eggs | "cáscaras de los huevos crudos" (*shells of* eggs) | "huevos crudos con cáscara" | Official wording changes the meaning |
| FPC-067 | carried by healthy people | "transmitida … por" | "que la lleven personas sanas" | "transmitida" ≠ "carried" |
| FPC-068 | quote has a grammar slip ("y si evitando") | — | quoted verbatim | Reviewer may prefer English quote |
| FPC-071 | bluefish | "pescado azul" | explanation says "anjova (bluefish)" | "pescado azul" is a fish category in Spain |
| FPC-086 | lamb | "**ternera**" (= veal) | dropped lamb from the question; quote keeps "ternera" | Official mistranslation |
| FPC-087 | stove | "hornillo" | "estufa" | Regional |
| FPC-097 | deli paper | "papel de celofán" (guide), "papel de restaurante" (manual) | "papel para alimentos (papel de deli)" | No standard term |
| FPC-098 | air break | "espacio de aire (dispositivos de prevención de reflujo)" | "espacio de aire (air break)" | Air break vs air gap |
| FPC-099 | Atmospheric Vacuum Breaker | "**igualadores** de vacío atmosférico" | "rompedor de vacío atmosférico (AVB)", with the official term in the explanation | Official term looks wrong |
| FPC-100 | hose bib vacuum breaker | "interruptor de vacío tipo grifo de manguera" | same, plus English | Plumbers may say "rompevacío" |
| FPC-101 | back draft | "que no haya humo" | "que los gases no se regresen (back draft)" | Official wording changes the meaning |
| FPC-108/110 | bleach | "cloro" | "cloro" | Standard in LatAm; confirm |
| FPC-115 | starve / build out / destroy | "matar de hambre, **acorralar**, destruir" | "dejarlas sin comida, cerrarles la entrada y destruirlas" | "acorralar" (to corner) ≠ "build out" |
| FPC-118 | licensed pest control officer | "funcionario de control de plagas autorizado" | "profesional de control de plagas con licencia" | "funcionario" suggests a government employee |
| FPC-122 | set up critical limits | "establecimiento de medidas de control" | explanation says "fijar límites críticos" | Official mistranslation |
| FPC-131 | food defense | — | "proteger los alimentos contra actos intencionales (food defense)" | No common Spanish term |

Also worth a look: the FIFO and HACCP options keep the English expansion followed by a Spanish gloss, so the acronym question still works.

## Still open (carried over from bots/exams2/NOTES.md)
- The "50 Q / 1 hr / 70%" facts come from a816-healthpsi.nyc.gov, which curl cannot reach, so they are not script-verified.
- The Health Academy floor conflicts between sources (3rd vs 2nd). The materials are 2012–2017 and the Health Code has changed since.
- Kit: create the Spanish tag and replace `TAGID_FOOD_ES` in `docs/food/es/quiz.js`.
