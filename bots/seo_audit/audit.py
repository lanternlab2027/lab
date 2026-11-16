#!/usr/bin/env python3
"""SEO quality audit for the programmatic page sets in docs/.

Usage: python3 bots/seo_audit/audit.py [--json out.json] [--verbose]

Read-only. Checks every HTML page in the programmatic sets
(docs/b, docs/eats/r, docs/eats/z, docs/names/n, docs/guides) for: unique title and
meta description, title/description length, self-referencing canonical
that matches its sitemap <loc> exactly, one H1, JSON-LD that parses,
accidental noindex, broken internal links (resolved against the file
tree), click depth from the site home and from the set's hub, related
links per detail page, near-duplicate body text, sitemap lastmod, and
robots.txt -> sitemap-index.xml.
"""
import json, os, re, sys, glob, hashlib, random, datetime, collections
from urllib.parse import urlsplit, unquote
from bs4 import BeautifulSoup

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DOCS = os.path.join(ROOT, 'docs')
BASE = 'https://lanternlab2027.github.io/lab/'
TODAY = datetime.date.today()

SETS = {
    'buildings': {'dir': 'b', 'hub': 'b/index.html',
                  'detail': re.compile(r'^b/\d{10}\.html$'), 'sitemap': 'sitemap-buildings.xml'},
    'eats': {'dir': 'eats/r', 'hub': 'eats/r/index.html',
             'detail': re.compile(r'^eats/r/\d+\.html$'), 'sitemap': 'sitemap-eats.xml'},
    # per-ZIP restaurant index pages (Nov 16); "related" = links to nearby ZIP pages
    'eats_zip': {'dir': 'eats/z', 'hub': 'eats/r/index.html',
                 'detail': re.compile(r'^eats/z/\d{5}\.html$'), 'sitemap': 'sitemap-eats.xml'},
    'names': {'dir': 'names/n', 'hub': 'names/n/index.html',
              'detail': re.compile(r'^names/n/(?!index\.html$)[a-z0-9-]{2,}\.html$'), 'sitemap': 'sitemap-names.xml'},
    'guides': {'dir': 'guides', 'hub': 'guides/index.html',
               'detail': re.compile(r'^guides/(?!index\.html$)[^/]+\.html$'), 'sitemap': 'sitemap.xml'},
}
# Pages whose links we follow when computing click depth (whole site is crawled,
# but only these sets are reported).
EXCLUDE_DIRS = ()


def rel(path):
    return os.path.relpath(path, DOCS).replace(os.sep, '/')


def url_for(relpath):
    """Public URL a file is served at (index.html -> directory URL)."""
    if relpath == 'index.html':
        return BASE
    if relpath.endswith('/index.html'):
        return BASE + relpath[:-len('index.html')]
    return BASE + relpath


def resolve(src_rel, href):
    """Resolve an href found in docs/<src_rel> to a docs-relative file path.
    Returns (target_rel or None, is_internal)."""
    href = href.strip()
    if not href or href.startswith(('#', 'mailto:', 'tel:', 'javascript:', 'data:')):
        return None, False
    parts = urlsplit(href)
    if parts.scheme in ('http', 'https'):
        full = parts.scheme + '://' + parts.netloc + parts.path
        if not full.startswith(BASE) and full + '/' != BASE:
            return None, False
        path = full[len(BASE):] if full.startswith(BASE) else ''
    elif parts.scheme:
        return None, False
    elif parts.path.startswith('/'):
        if not parts.path.startswith('/lab'):
            return parts.path, True  # outside /lab/ -> broken on this host
        path = parts.path[len('/lab/'):] if parts.path.startswith('/lab/') else ''
    else:
        base_dir = os.path.dirname(src_rel)
        if parts.path == '':
            return src_rel, True  # query-only link to self
        path = os.path.normpath(os.path.join(base_dir, unquote(parts.path))).replace(os.sep, '/')
        if path == '.':
            path = ''
        if parts.path.endswith('/') and path:
            path += '/'
        if path.startswith('..'):
            return '/' + path, True  # escapes /lab/
    path = unquote(path)
    if path == '' or path.endswith('/'):
        path = path + 'index.html'
    elif os.path.isdir(os.path.join(DOCS, path)):
        path = path + '/index.html'  # GitHub Pages redirects dir -> dir/
    return path, True


def visible_text(soup):
    body = soup.body or soup
    for t in body(['script', 'style', 'svg', 'noscript']):
        t.decompose()
    return re.sub(r'\s+', ' ', body.get_text(' ')).strip()


def parse_sitemap(name):
    p = os.path.join(DOCS, name)
    if not os.path.exists(p):
        return None
    xml = open(p, encoding='utf-8').read()
    out = []
    for m in re.finditer(r'<url>(.*?)</url>', xml, re.S):
        loc = re.search(r'<loc>(.*?)</loc>', m.group(1))
        lm = re.search(r'<lastmod>(.*?)</lastmod>', m.group(1))
        out.append((loc.group(1).strip().replace('&amp;', '&') if loc else None,
                    lm.group(1).strip() if lm else None))
    return out


def shingles(text, k=5):
    w = re.findall(r'[a-z0-9]+', text.lower())
    return {hash(' '.join(w[i:i + k])) for i in range(max(1, len(w) - k + 1))}


def minhash_dupes(pages, threshold=0.85, nperm=64, bands=16):
    """pages: {rel: shingle set}. Returns list of (a, b, jaccard) with J >= threshold."""
    rnd = random.Random(7)
    P = (1 << 61) - 1
    coeffs = [(rnd.randrange(1, P), rnd.randrange(0, P)) for _ in range(nperm)]
    sigs = {}
    for r, sh in pages.items():
        hs = [h & 0xFFFFFFFFFFFF for h in sh] or [0]
        sigs[r] = [min((a * h + b) % P for h in hs) for a, b in coeffs]
    rows = nperm // bands
    buckets = collections.defaultdict(list)
    for r, s in sigs.items():
        for b in range(bands):
            buckets[(b, tuple(s[b * rows:(b + 1) * rows]))].append(r)
    cands = set()
    for v in buckets.values():
        if 1 < len(v) < 200:
            for i in range(len(v)):
                for j in range(i + 1, len(v)):
                    cands.add(tuple(sorted((v[i], v[j]))))
    out = []
    for a, b in cands:
        A, B = pages[a], pages[b]
        j = len(A & B) / max(1, len(A | B))
        if j >= threshold:
            out.append((a, b, round(j, 3)))
    return sorted(out, key=lambda x: -x[2])


def main():
    args = sys.argv[1:]
    verbose = '--verbose' in args
    json_out = args[args.index('--json') + 1] if '--json' in args else None

    # ---- crawl whole docs tree for the link graph
    all_html = sorted(rel(p) for p in glob.glob(os.path.join(DOCS, '**', '*.html'), recursive=True))
    files = set(rel(p) for p in glob.glob(os.path.join(DOCS, '**', '*'), recursive=True) if os.path.isfile(p))
    graph = {}
    page = {}  # info for pages in the audited sets
    set_of = {}
    for r in all_html:
        for sname, s in SETS.items():
            if r.startswith(s['dir'] + '/'):
                set_of[r] = sname
    broken = collections.defaultdict(list)
    for r in all_html:
        raw = open(os.path.join(DOCS, r), encoding='utf-8', errors='replace').read()
        soup = BeautifulSoup(raw, 'lxml')
        links = []
        for tag, attr in (('a', 'href'), ('link', 'href'), ('script', 'src'), ('img', 'src')):
            for el in soup.find_all(tag):
                v = el.get(attr)
                if not v:
                    continue
                if tag == 'link' and (el.get('rel') or [''])[0] in ('canonical', 'alternate'):
                    continue
                tgt, internal = resolve(r, v)
                if not internal:
                    continue
                if tgt not in files:
                    if r in set_of:
                        broken[r].append(v)
                    continue
                if tag == 'a' and tgt.endswith('.html'):
                    links.append(tgt)
        graph[r] = links
        if r not in set_of:
            continue
        head = soup.head or soup
        title = (head.title.string or '').strip() if head.title and head.title.string else ''
        md = head.find('meta', attrs={'name': 'description'})
        desc = (md.get('content') or '').strip() if md else ''
        canon = [l.get('href') for l in head.find_all('link', rel='canonical')]
        robots = ' '.join((m.get('content') or '') for m in soup.find_all('meta', attrs={'name': re.compile('^(robots|googlebot)$', re.I)}))
        h1 = len(soup.find_all('h1'))
        ld_ok, ld_err, ld_types = 0, [], []
        for sc in soup.find_all('script', type='application/ld+json'):
            try:
                d = json.loads(sc.string or '')
                ld_ok += 1
                ld_types.append(d.get('@type') if isinstance(d, dict) else 'list')
            except Exception as e:
                ld_err.append(str(e)[:80])
        text = visible_text(soup)
        page[r] = dict(title=title, desc=desc, canon=canon, robots=robots, h1=h1, ld_ok=ld_ok,
                       ld_err=ld_err, ld_types=ld_types, words=len(text.split()), text=text)

    # ---- click depth (BFS)
    def bfs(start):
        d = {start: 0}
        q = collections.deque([start])
        while q:
            u = q.popleft()
            for v in graph.get(u, []):
                if v not in d:
                    d[v] = d[u] + 1
                    q.append(v)
        return d
    from_home = bfs('index.html')

    report = {'generated': str(TODAY), 'sets': {}}
    for sname, s in SETS.items():
        rels = sorted(r for r in page if set_of.get(r) == sname)
        details = [r for r in rels if s['detail'].match(r)]
        detail_set = set(details)
        from_hub = bfs(s['hub'])
        R = collections.OrderedDict()
        R['pages'] = len(rels)
        R['detail_pages'] = len(details)

        titles = collections.Counter(page[r]['title'] for r in rels)
        descs = collections.Counter(page[r]['desc'] for r in rels)
        R['missing_title'] = [r for r in rels if not page[r]['title']]
        R['dup_titles'] = {t: [r for r in rels if page[r]['title'] == t] for t, c in titles.items() if c > 1 and t}
        R['missing_desc'] = [r for r in rels if not page[r]['desc']]
        R['dup_descs'] = {t: [r for r in rels if page[r]['desc'] == t] for t, c in descs.items() if c > 1 and t}
        tl = [len(page[r]['title']) for r in rels]
        dl = [len(page[r]['desc']) for r in rels]
        R['title_len'] = {'min': min(tl), 'max': max(tl), 'under50': sum(l < 50 for l in tl),
                          'over65': sum(l > 65 for l in tl), 'in_50_65': sum(50 <= l <= 65 for l in tl)}
        R['desc_len'] = {'min': min(dl), 'max': max(dl), 'under70': sum(l < 70 for l in dl),
                         'over160': sum(l > 160 for l in dl)}
        R['title_over65_examples'] = [(r, page[r]['title']) for r in rels if len(page[r]['title']) > 65][:5]
        R['title_under50_examples'] = [(r, page[r]['title']) for r in rels if len(page[r]['title']) < 50][:5]

        # canonical + sitemap
        sm = parse_sitemap(s['sitemap']) or []
        sm_locs = {loc for loc, _ in sm}
        bad_canon, not_in_sm = [], []
        for r in rels:
            want = url_for(r)
            c = page[r]['canon']
            if len(c) != 1 or c[0] != want:
                bad_canon.append((r, c, want))
            elif want not in sm_locs:
                not_in_sm.append(r)
        R['bad_canonical'] = bad_canon
        R['canonical_not_in_sitemap'] = not_in_sm
        set_prefix = BASE + s['dir'] + '/'
        set_locs = [loc for loc, _ in sm if loc and loc.startswith(set_prefix)]
        canon_urls = {url_for(r) for r in rels}
        R['sitemap_urls_without_page'] = [l for l in set_locs if l not in canon_urls]
        lm_bad = []
        for loc, lm in sm:
            if not loc or not loc.startswith(set_prefix):
                continue
            if not lm:
                lm_bad.append((loc, 'missing'))
                continue
            try:
                d = datetime.date.fromisoformat(lm[:10])
                if d > TODAY or d.year < 2024:
                    lm_bad.append((loc, lm))
            except ValueError:
                lm_bad.append((loc, lm))
        R['sitemap_lastmod_bad'] = lm_bad

        R['h1_not_one'] = [(r, page[r]['h1']) for r in rels if page[r]['h1'] != 1]
        R['jsonld_invalid'] = [(r, page[r]['ld_err']) for r in rels if page[r]['ld_err']]
        R['jsonld_none'] = [r for r in rels if page[r]['ld_ok'] == 0]
        R['jsonld_types'] = dict(collections.Counter(str(t) for r in rels for t in page[r]['ld_types']))
        R['noindex'] = [(r, page[r]['robots']) for r in rels if 'noindex' in page[r]['robots'].lower()]
        R['broken_links'] = {r: broken[r] for r in rels if broken.get(r)}
        R['broken_link_count'] = sum(len(broken[r]) for r in rels if broken.get(r))

        R['depth_from_home_gt3'] = sorted(r for r in rels if from_home.get(r, 99) > 3)
        R['unreachable_from_home'] = sorted(r for r in rels if r not in from_home)
        R['depth_from_hub_gt3'] = sorted(r for r in rels if from_hub.get(r, 99) > 3)
        R['depth_hist_home'] = dict(sorted(collections.Counter(from_home.get(r, -1) for r in rels).items()))
        R['depth_hist_hub'] = dict(sorted(collections.Counter(from_hub.get(r, -1) for r in rels).items()))
        R['hub_depth_from_home'] = from_home.get(s['hub'])

        rel_counts = {r: len(set(t for t in graph[r] if t in detail_set and t != r)) for r in details}
        R['related_hist'] = dict(sorted(collections.Counter(rel_counts.values()).items()))
        R['related_lt3'] = sorted(r for r, c in rel_counts.items() if c < 3)
        R['related_gt6'] = sorted(r for r, c in rel_counts.items() if c > 6)
        inbound = collections.Counter(t for r in all_html for t in set(graph[r]) if t in detail_set and t != r)
        R['detail_inbound_hist'] = dict(sorted(collections.Counter(inbound.get(r, 0) for r in details).items()))

        # thin / duplicate
        wc = [page[r]['words'] for r in details]
        R['detail_words'] = {'min': min(wc), 'median': sorted(wc)[len(wc) // 2], 'max': max(wc)} if wc else {}
        R['thin_lt150_words'] = sorted((r, page[r]['words']) for r in details if page[r]['words'] < 150)
        sh = {r: shingles(page[r]['text']) for r in details}
        dupes = minhash_dupes(sh, threshold=0.85)
        R['near_dupes_ge85'] = len(dupes)
        R['near_dupe_examples'] = dupes[:10]
        # share of each page's shingles that are boilerplate (on >=30% of the set's detail pages)
        if details:
            df = collections.Counter(x for v in sh.values() for x in v)
            cut = max(2, int(0.3 * len(details)))
            uniq = sorted(1 - sum(df[x] >= cut for x in v) / max(1, len(v)) for v in sh.values())
            R['unique_text_share'] = {'min': round(uniq[0], 2), 'p10': round(uniq[len(uniq) // 10], 2),
                                      'median': round(uniq[len(uniq) // 2], 2)}
        report['sets'][sname] = R

    # robots + sitemap index
    robots = open(os.path.join(DOCS, 'robots.txt')).read()
    report['robots_has_sitemap_index'] = bool(re.search(r'(?mi)^Sitemap:\s*' + re.escape(BASE + 'sitemap-index.xml') + r'\s*$', robots))
    idx = open(os.path.join(DOCS, 'sitemap-index.xml')).read()
    report['sitemap_index'] = [(m.group(1), (re.search(r'<lastmod>(.*?)</lastmod>', m.group(0)) or [None, None])[1])
                               for m in re.finditer(r'<sitemap>\s*<loc>(.*?)</loc>.*?</sitemap>', idx, re.S)]
    report['sitemap_index_missing_file'] = [l for l, _ in report['sitemap_index']
                                            if not os.path.exists(os.path.join(DOCS, l[len(BASE):]))]

    # ---- print
    def short(v):
        if isinstance(v, (list, dict)) and not verbose:
            n = len(v)
            ex = list(v.items())[:3] if isinstance(v, dict) else v[:3]
            return f'{n}' + (f'  e.g. {ex}' if n else '')
        return v
    for sname, R in report['sets'].items():
        print(f'\n=== {sname} ===')
        for k, v in R.items():
            if k in ('title_len', 'desc_len', 'related_hist', 'depth_hist_home', 'depth_hist_hub', 'detail_words',
                     'unique_text_share', 'jsonld_types', 'detail_inbound_hist', 'pages', 'detail_pages',
                     'near_dupes_ge85', 'broken_link_count', 'hub_depth_from_home'):
                print(f'  {k}: {v}')
            else:
                print(f'  {k}: {short(v)}')
    print('\nrobots.txt references sitemap-index.xml:', report['robots_has_sitemap_index'])
    print('sitemap-index entries:', report['sitemap_index'])
    print('sitemap-index entries with no file:', report['sitemap_index_missing_file'])
    if json_out:
        with open(json_out, 'w') as f:
            json.dump(report, f, indent=1, default=str)


if __name__ == '__main__':
    main()
