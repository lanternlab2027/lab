(function(){var module={exports:{}};
// Art Year: pure selection + scheduling logic for AIC artwork records.
// Input records have the AIC API artwork schema (same as the data dump and
// bots/art/fixtures/artworks/*.json, which are real AIC sample records).
'use strict';

const MIN_YEAR = 1400;
const MAX_YEAR = 1950;
const TYPES = new Set(['Painting', 'Print', 'Drawing and Watercolor', 'Photograph']);

// Words that suggest nudity, violence or death. Matched as whole words against
// title, subject_titles, term_titles, theme_titles, classification_titles and
// the thumbnail alt text. Errs on the side of dropping a work.
const AVOID = [
  'nude', 'nudes', 'nudity', 'naked', 'undressed', 'bather', 'bathers', 'bathing', 'bath', 'toilette',
  'venus', 'leda', 'susanna', 'danae', 'odalisque', 'erotic', 'erotica', 'eroticism', 'sex', 'sexuality',
  'breast', 'breasts', 'bacchanal', 'bacchanalia', 'satyr', 'satyrs', 'nymph', 'nymphs', 'adam and eve',
  'war', 'wars', 'warfare', 'battle', 'battles', 'combat', 'soldier', 'soldiers', 'army', 'siege',
  'death', 'dead', 'dying', 'corpse', 'corpses', 'skeleton', 'skeletons', 'skull', 'skulls', 'memento mori',
  'murder', 'massacre', 'slaughter', 'execution', 'executed', 'beheading', 'decapitation', 'hanging', 'hanged',
  'martyr', 'martyrdom', 'crucifixion', 'crucified', 'entombment', 'lamentation', 'pieta', 'deposition',
  'torture', 'blood', 'wound', 'wounded', 'violence', 'violent', 'suicide', 'rape', 'abduction',
  'judith', 'holofernes', 'lucretia', 'saint sebastian', 'st. sebastian', 'massacre of the innocents',
  'hunt', 'hunting', 'hunter', 'hunters', 'disaster', 'disasters', 'plague', 'hell', 'demon', 'demons',
  'lynching', 'slavery', 'slave', 'slaves', 'weapon', 'weapons', 'gun', 'guns', 'sword', 'swords',
  'caricature', 'caricatures', 'satire', 'anatomy', 'anatomical', 'medical',
];
const AVOID_RE = new RegExp('\\b(' + AVOID.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i');

// A clean single-year date: date_display is exactly four digits, start == end,
// and the qualifier (if any) is not "working dates", "published" etc.
function singleYear(r) {
  if (typeof r.date_display !== 'string') return null;
  const d = r.date_display.trim();
  if (!/^\d{4}$/.test(d)) return null;
  const y = +d;
  if (r.date_start !== y || r.date_end !== y) return null;
  const q = (r.date_qualifier_title || '').toLowerCase();
  if (q && !['made', 'created', 'painted', 'executed', 'printed', 'drawn', 'photographed', 'original'].includes(q)) return null;
  return y;
}

function textBlob(r) {
  return [
    r.title, r.artist_display,
    ...(r.subject_titles || []), ...(r.term_titles || []), ...(r.theme_titles || []),
    ...(r.classification_titles || []), ...(r.category_titles || []),
    r.thumbnail && r.thumbnail.alt_text,
  ].filter(Boolean).join(' • ');
}

// Why a record is rejected, or null if it is usable.
function reject(r, opts = {}) {
  const min = opts.minYear || MIN_YEAR, max = opts.maxYear || MAX_YEAR;
  if (!r || typeof r.id !== 'number') return 'no id';
  if (r.is_public_domain !== true) return 'not public domain';
  if (!r.image_id) return 'no image';
  if (!r.title || !r.title.trim()) return 'no title';
  if (!TYPES.has(r.artwork_type_title)) return 'type ' + r.artwork_type_title;
  const y = singleYear(r);
  if (y === null) return 'date not a single year: ' + r.date_display;
  if (y < min || y > max) return 'year out of range';
  const th = r.thumbnail || {};
  if (th.width && th.height) {
    const a = th.width / th.height;
    if (a < 0.45 || a > 2.4) return 'awkward aspect ratio';
    if (Math.max(th.width, th.height) < 800) return 'image too small';
  }
  const m = AVOID_RE.exec(textBlob(r));
  if (m) return 'avoid word: ' + m[1].toLowerCase();
  return null;
}

function artistName(r) {
  if (r.artist_title) return r.artist_title;
  const first = (r.artist_display || '').split('\n')[0].trim();
  return first || 'Unknown artist';
}

function toPuzzle(r) {
  const th = r.thumbnail || {};
  return {
    id: r.id,
    title: r.title.trim(),
    artist: artistName(r),
    artist_display: (r.artist_display || '').trim(),
    date_display: r.date_display.trim(),
    year: singleYear(r),
    image_id: r.image_id,
    w: th.width || null,
    h: th.height || null,
    type: r.artwork_type_title,
    medium: (r.medium_display || '').trim(),
    credit_line: (r.credit_line || '').trim(),
    main_reference_number: r.main_reference_number || '',
    url: 'https://www.artic.edu/artworks/' + r.id,
    boosted: !!r.is_boosted,
  };
}

// mulberry32: small deterministic PRNG so builds are reproducible.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Choose up to `target` works spread evenly over 50-year buckets, preferring
// boosted (well-known) works, at most `perArtist` per artist.
function pick(candidates, opts = {}) {
  const target = opts.target || 400, perArtist = opts.perArtist || 3, span = opts.span || 50;
  const min = opts.minYear || MIN_YEAR, max = opts.maxYear || MAX_YEAR;
  const rand = rng(opts.seed || 1);
  const seen = new Set();
  const uniq = candidates.filter((p) => (seen.has(p.id) ? false : seen.add(p.id)));
  const buckets = [];
  for (let s = min; s <= max; s += span) buckets.push(uniq.filter((p) => p.year >= s && p.year < s + span));
  // Within a bucket: boosted first, then the rest, each group shuffled.
  const queues = buckets.map((b) => shuffle(b.filter((p) => p.boosted), rand).concat(shuffle(b.filter((p) => !p.boosted), rand)));
  const perBucket = Math.ceil(target / queues.length);
  const byArtist = {};
  const out = [];
  const take = (q, limit) => {
    let n = 0;
    while (q.length && n < limit && out.length < target) {
      const p = q.shift();
      const k = p.artist.toLowerCase();
      if ((byArtist[k] || 0) >= perArtist) continue;
      byArtist[k] = (byArtist[k] || 0) + 1;
      out.push(p); n++;
    }
  };
  queues.forEach((q) => take(q, perBucket));
  // Fill any shortfall (thin early centuries) from whatever is left.
  let guard = 0;
  while (out.length < target && queues.some((q) => q.length) && guard++ < 1000) queues.forEach((q) => take(q, 1));
  return out;
}

// Order for the daily schedule: shuffled, with no artist on two days running
// and consecutive years at least `gap` apart where possible.
function order(puzzles, opts = {}) {
  const rand = rng(opts.seed || 2);
  const gap = opts.gap == null ? 30 : opts.gap;
  let pool = shuffle(puzzles, rand);
  const out = [];
  while (pool.length) {
    const prev = out[out.length - 1];
    let i = 0;
    if (prev) {
      i = pool.findIndex((p) => p.artist !== prev.artist && Math.abs(p.year - prev.year) >= gap);
      if (i < 0) i = pool.findIndex((p) => p.artist !== prev.artist);
      if (i < 0) i = 0;
    }
    out.push(pool[i]);
    pool.splice(i, 1);
  }
  return out;
}

module.exports = { MIN_YEAR, MAX_YEAR, TYPES, AVOID, singleYear, reject, toPuzzle, artistName, rng, shuffle, pick, order };
var S=module.exports; window.ArtS=S;
var FIELDS=['id','title','artist_title','artist_display','date_display','date_start','date_end','date_qualifier_title','is_public_domain','image_id','thumbnail','artwork_type_title','medium_display','credit_line','main_reference_number','subject_titles','term_titles','theme_titles','classification_titles','category_titles','is_boosted'].join(',');
var API='https://api.artic.edu/api/v1/artworks/search';
var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
window.ArtRun=async function(){
  var st=window._art={records:[],log:[],done:false,err:null,iiif:null};
  try{
  for(var s=S.MIN_YEAR;s<=S.MAX_YEAR;s+=25){for(var boosted of [true,false]){
    var filter=[{term:{is_public_domain:true}},{exists:{field:'image_id'}},{range:{date_start:{gte:s,lte:Math.min(s+24,S.MAX_YEAR)}}}];
    if(boosted)filter.push({term:{is_boosted:true}});
    for(var page=1;page<=4;page++){
      var d=null;
      for(var a=0;a<4;a++){var r=await fetch(API+'?fields='+FIELDS+'&limit=100&page='+page,{method:'POST',headers:{'Content-Type':'application/json','AIC-User-Agent':'art-year-builder (lanternlab2027.github.io/lab/art/)'},body:JSON.stringify({query:{bool:{filter:filter}}})});
        if(r.status===429||r.status>=500){await sleep(5000*(a+1));continue;} if(!r.ok)throw new Error('AIC '+r.status); d=await r.json(); break;}
      if(!d)throw new Error('AIC kept failing');
      if(d.config&&d.config.iiif_url)st.iiif=d.config.iiif_url;
      (d.data||[]).forEach(function(x){st.records.push(x)});
      st.log.push(s+(boosted?'b':'')+' p'+page+':'+(d.data||[]).length);
      await sleep(1100);
      if(!d.pagination||page>=d.pagination.total_pages)break;
    }}}
  }catch(e){st.err=String(e)}
  st.done=true;
};
window.ArtBuild=function(target,seed){
  var reasons={},ok=[];
  window._art.records.forEach(function(r){var why=S.reject(r); if(why){var k=why.replace(/:.*/,'');reasons[k]=(reasons[k]||0)+1;return;} ok.push(S.toPuzzle(r));});
  var chosen=S.pick(ok,{target:target,seed:seed}); var works=S.order(chosen,{seed:seed+1}); works.forEach(function(w){delete w.boosted});
  window._works=works; return {usable:ok.length,reasons:reasons,works:works.length};
};
})();
