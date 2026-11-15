// NYC Dog Name Report Card: cleaning + dedupe rules (pure functions, unit-tested in test_clean.js).
// Source rows: NYC Dog Licensing Dataset (nu7n-tubp), fields animalname, animalgender, animalbirth,
// breedname, zipcode, licenseissueddate, licenseexpireddate, extract_year.
'use strict';

// ---------- names ----------
// Group key = the slug: lowercase letters/digits, words joined by '-'. Space, hyphen and period all
// separate words, apostrophes vanish, and dotted initials collapse ("A.J." == "AJ"), so
// "Jay-Jay" / "JAY JAY" and "Reese's" / "Reeses" count as one name.
function nameKey(raw) {
  let s = String(raw == null ? '' : raw).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  s = s.replace(/\s+/g, ' ');
  if (/^([A-Z]\.\s?)+[A-Z]?\.?$/.test(s)) s = s.replace(/[.\s]/g, ''); // initials: A.J. / A. J. / P.J
  s = s.replace(/['\u2019`]/g, '');
  s = s.replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s.toLowerCase();
}

// Placeholders the city's data uses for "no name" (checked on the key, so punctuation variants match).
const JUNK = new Set([
  'unknown', 'unknowed', 'unknow', 'unkown', 'unknwn', 'unk', 'unkn', 'unknownmor', 'unknown-name', 'name-unknown',
  'name-not-provided', 'not-provided', 'name-not-given', 'not-given', 'no-name-provided', 'name', 'noname', 'no-name',
  'nameme', 'none', 'na', 'n-a', 'nan', 'no', 'null', 'nil', 'tbd', 'tba', 'nothing', 'not-named', 'unnamed',
  'not-applicable', 'refused', 'missing', 'test', 'error-value', 'value',
  // a title on its own (field cut short): "MR.", "DR."
  'mr', 'mrs', 'ms', 'dr', 'jr', 'sr', 'st', 'capt'
]);

function isJunkName(raw) {
  const k = nameKey(raw);
  if (!k) return true;
  if (JUNK.has(k)) return true;
  if (/^unk/.test(k) && k.length <= 10) return true; // unknwon, unkno...
  const letters = k.replace(/[^a-z]/g, '');
  if (letters.length < 2 && !(letters.length === 1 && /\d/.test(k))) return true; // "A", ".", "X", "1" (but "K9" stays)
  if (/\d{3,}/.test(k)) return true; // license / tag numbers typed into the name field
  return false;
}

// Title-case a raw spelling for display: "MR.PICKLES" -> "Mr. Pickles", "JAY-JAY" -> "Jay-Jay",
// "REESE'S" -> "Reese's", "A.J." -> "AJ".
function displayName(raw) {
  let s = String(raw).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
  if (/^([A-Za-z]\.\s?)+[A-Za-z]?\.?$/.test(s)) return s.replace(/[.\s]/g, '').toUpperCase();
  // two-letter initials without dots: AJ, TJ, KC, BB (but Bo, Mo, Jo, Ty stay words)
  if (/^[A-Za-z]{2}$/.test(s) && (/j$/i.test(s) || s[0].toLowerCase() === s[1].toLowerCase() || !/[aeiouy]/i.test(s))) return s.toUpperCase();
  s = s.replace(/[^A-Za-z0-9 .'\-&]/g, '').replace(/[.\-' ]+$/g, '').replace(/^[.\-' ]+/g, '');
  s = s.replace(/([A-Za-z]{2,})\.(?=[A-Za-z])/g, '$1. ');
  s = s.toLowerCase().replace(/(^|[\s\-.])([a-z])/g, (m, p, c) => p + c.toUpperCase());
  return s;
}

// ---------- breeds ----------
// Group the dataset's ~1,600 breed spellings into families: a "Crossbreed"/"mix" counts toward its
// base breed, and known spelling variants are merged. Returns null for unknown / not provided.
const BREED_ALIAS = {
  'american pit bull mix / pit bull mix': 'Pit Bull', 'american pit bull terrier/pit bull': 'Pit Bull', 'american pit bull terrier': 'Pit Bull', 'pit bull': 'Pit Bull',
  'poodle, toy': 'Poodle', 'poodle, miniature': 'Poodle', 'poodle, standard': 'Poodle', 'toy poodle': 'Poodle', 'miniature poodle': 'Poodle', 'standard poodle': 'Poodle',
  'schnauzer, miniature': 'Miniature Schnauzer', 'schnauzer, standard': 'Standard Schnauzer', 'schnauzer, giant': 'Giant Schnauzer',
  'bull dog, english': 'English Bulldog', 'bulldog': 'English Bulldog', 'english bulldog': 'English Bulldog',
  'bull dog, french': 'French Bulldog', 'bull dog, american': 'American Bulldog', 'american bull dog': 'American Bulldog',
  'dachshund smooth coat': 'Dachshund', 'dachshund smooth coat miniature': 'Dachshund', 'dachshund, long haired miniature': 'Dachshund',
  'dachshund, long haired': 'Dachshund', 'dachshund, wirehaired, miniature': 'Dachshund', 'dachshund, wirehaired': 'Dachshund', 'dachshund, miniature': 'Dachshund',
  'jindo dog, korea': 'Jindo', 'korean jindo': 'Jindo',
  'welsh corgi, pembroke': 'Corgi', 'pembroke welsh corgi': 'Corgi', 'welsh corgi, cardigan': 'Corgi', 'cardigan welsh corgi': 'Corgi',
  'west high white terrier': 'West Highland White Terrier',
  'wheaton terrier': 'Wheaten Terrier', 'soft coated wheaten terrier': 'Wheaten Terrier',
  'australian cattledog': 'Australian Cattle Dog',
  'shepard': 'Shepherd', 'shepherd': 'Shepherd', 'german shepherd dog': 'German Shepherd',
  'collie, border': 'Border Collie', 'collie, rough coat': 'Collie', 'collie, smooth coat': 'Collie',
  'cotton de tulear': 'Coton de Tulear', 'coton de tulear': 'Coton de Tulear',
  'shar-pei, chinese': 'Shar-Pei', 'chinese shar-pei': 'Shar-Pei',
  'bassett hound': 'Basset Hound',
  'coonhound, black and tan': 'Black and Tan Coonhound', 'coonhound, treeing walker': 'Treeing Walker Coonhound',
  'coonhound, blue tick': 'Bluetick Coonhound', 'coonhound, redbone': 'Redbone Coonhound',
  'pointer, german shorthaired': 'German Shorthaired Pointer', 'pointer, german wirehaired': 'German Wirehaired Pointer',
  'st. bernard': 'Saint Bernard', 'schipperkee': 'Schipperke', 'japanese chin/spaniel': 'Japanese Chin', 'brittany spaniel': 'Brittany',
  'mastiff, bull': 'Bullmastiff', 'mastiff, old english': 'Mastiff', 'goldendoodle miniature': 'Goldendoodle',
  'australian silky terrier': 'Silky Terrier', 'american eskimo dog': 'American Eskimo Dog', 'alaskan klee kai': 'Alaskan Klee Kai',
  'terrier': 'Terrier', 'hound': 'Hound', 'retriever': 'Retriever', 'spaniel': 'Spaniel'
};
const GENERIC = new Set(['Terrier', 'Hound', 'Shepherd', 'Retriever', 'Spaniel', 'Collie', 'Mixed Breed']);

function breedGroup(raw) {
  let s = String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
  const low0 = s.toLowerCase();
  if (!s || /^(unknown|not provided|n\/?a|none|other|unk)$/.test(low0)) return null;
  if (/^(mixed|mixed breed|mix|mutt|crossbreed)$/.test(low0)) return 'Mixed Breed';
  if (BREED_ALIAS[low0]) return BREED_ALIAS[low0];
  s = s.replace(/\s*(crossbreed|cross breed|mixed breed|mixed|mix)$/i, '').trim();
  const low = s.toLowerCase();
  if (BREED_ALIAS[low]) return BREED_ALIAS[low];
  if (!s) return 'Mixed Breed';
  // keep the source's spelling, but capitalise each word ("American Eskimo dog" -> "American Eskimo Dog")
  return s.replace(/(^|[\s\-/(])([a-z])/g, (m, p, c) => p + c.toUpperCase()).replace(/\bDe\b/g, 'de');
}
const isGenericBreed = (g) => GENERIC.has(g);

// ---------- other fields ----------
function birthYear(raw, issueYear) {
  const m = /^(\d{4})/.exec(String(raw || '').trim());
  if (!m) return 0;
  const y = +m[1];
  if (y < 1995 || y > (issueYear || 2100)) return 0; // typos like 1014 or a birth after the license
  return y;
}
function zip5(raw) {
  const s = String(raw == null ? '' : raw).trim().replace(/\.0+$/, '');
  return /^1[01]\d{3}$/.test(s) ? s : ''; // NYC ZIPs are 100xx-104xx and 110xx-116xx
}
function gender(raw) { const g = String(raw || '').trim().toUpperCase(); return g === 'F' || g === 'M' ? g : ''; }
function year(raw) { const m = /^(\d{4})-/.exec(String(raw || '')); return m ? +m[1] : 0; }

// ---------- dedupe ----------
// A dog shows up once per license, and again in every yearly extract that still lists that license
// (and renewals are new rows). One dog = name key + birth year (raw, as typed) + breed (raw,
// case-folded) + ZIP. Gender is NOT in the key (it flips between renewals in ~1% of cases); the most
// common value wins. Rows with a placeholder name are dropped before deduping.
function dogKey(r) {
  return [nameKey(r.animalname), String(r.animalbirth || '').trim().slice(0, 4), String(r.breedname || '').trim().toLowerCase().replace(/\s+/g, ' '), String(r.zipcode || '').trim()].join('|');
}

// rows: iterable of raw objects. Returns Map key -> dog
//   dog = { key, nameKey, spellings: Map(raw->n), g: {F,M}, birth, breedRaw, breed, zip, years:Set, rows }
function dedupe(rows) {
  const dogs = new Map();
  let total = 0, junk = 0;
  for (const r of rows) {
    total++;
    if (isJunkName(r.animalname)) { junk++; continue; }
    const k = dogKey(r);
    let d = dogs.get(k);
    const iy = year(r.licenseissueddate);
    if (!d) {
      d = { key: k, nameKey: nameKey(r.animalname), spellings: new Map(), g: { F: 0, M: 0 }, birthRaw: String(r.animalbirth || '').trim(),
        breedRaw: String(r.breedname || '').trim(), breed: breedGroup(r.breedname), zip: zip5(r.zipcode), years: new Set(), firstIssue: 9999, rows: 0 };
      dogs.set(k, d);
    }
    d.rows++;
    const sp = String(r.animalname).trim().replace(/\s+/g, ' ').toUpperCase();
    d.spellings.set(sp, (d.spellings.get(sp) || 0) + 1);
    const g = gender(r.animalgender); if (g) d.g[g]++;
    if (iy) { d.years.add(iy); if (iy < d.firstIssue) d.firstIssue = iy; }
  }
  for (const d of dogs.values()) {
    d.gender = d.g.F > d.g.M ? 'F' : d.g.M > d.g.F ? 'M' : '';
    d.birth = birthYear(d.birthRaw, d.firstIssue === 9999 ? 0 : d.firstIssue);
  }
  return { dogs, total, junk };
}

function median(arr) {
  if (!arr.length) return 0;
  const a = arr.slice().sort((x, y) => x - y), m = a.length >> 1;
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

// Pick the display spelling for a name key: the most common raw spelling across all its dogs
// (ties: the one with fewer non-letters, then alphabetical), title-cased.
function pickDisplay(spellCounts) {
  let best = null, bn = -1;
  for (const [s, n] of spellCounts) {
    const better = n > bn || (n === bn && (s.replace(/[A-Z]/g, '').length < best.replace(/[A-Z]/g, '').length || (s.replace(/[A-Z]/g, '').length === best.replace(/[A-Z]/g, '').length && s < best)));
    if (better) { best = s; bn = n; }
  }
  return best === null ? '' : displayName(best);
}

// ---------- tiny CSV parser (RFC 4180, quoted fields) ----------
function* parseCSV(text) {
  let i = 0, field = '', row = [], q = false;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); yield row; row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); yield row; }
}
function* csvObjects(text) {
  let head = null;
  for (const row of parseCSV(text)) {
    if (!head) { head = row; continue; }
    const o = {}; for (let j = 0; j < head.length; j++) o[head[j]] = row[j]; yield o;
  }
}

module.exports = { nameKey, isJunkName, displayName, breedGroup, isGenericBreed, birthYear, zip5, gender, year, dogKey, dedupe, median, pickDisplay, parseCSV, csvObjects, JUNK };
