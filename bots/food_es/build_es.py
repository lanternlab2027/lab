#!/usr/bin/env python3
"""Build docs/food/es/questions/FPCES.json from the English bank + bank_es.py, and verify it.

Usage: python3 -I build_es.py <dir with study-guide-sp/pN.txt and fpc-manual-sp/pN.txt>
(extract with: pdftotext -layout -f N -l N <pdf> <dir>/<name>/pN.txt)
Exits non-zero on any failure.
"""
import json, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from bank_es import B, TOPICS  # noqa: E402

LAB = os.path.abspath(os.path.join(HERE, '..', '..'))
EN = os.path.join(LAB, 'docs/food/questions/FPC.json')
OUT = os.path.join(LAB, 'docs/food/es/questions/FPCES.json')

SRC = {
    'sg': ('https://www.nyc.gov/assets/doh/downloads/pdf/rii/study-guide-sp.pdf',
           'DOHMH: Guía de estudio del curso en línea (PDF oficial en español)', 'study-guide-sp'),
    'man': ('https://www.nyc.gov/assets/doh/downloads/pdf/rii/fpc-manual-sp.pdf',
            'DOHMH: Manual de capacitación del Curso sobre Protección de Alimentos (PDF oficial en español, 2012)', 'fpc-manual-sp'),
}


def norm(s):
    s = unicodedata.normalize('NFC', s).lower().replace('º', '°')
    s = re.sub(r'[^\w½±°]+', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def words(s):
    return len([t for t in s.split() if re.search(r'\w', t)])


def main():
    textdir = sys.argv[1]
    en = json.load(open(EN, encoding='utf8'))
    errs = []
    out_q = []
    ids = [q['id'] for q in en['questions']]
    if set(ids) != set(B):
        errs.append('id mismatch: missing %s extra %s' % (set(ids) - set(B), set(B) - set(ids)))
    cache = {}
    for q in en['questions']:
        qid = q['id']
        if qid not in B:
            continue
        question, opts, expl, src = B[qid]
        if len(opts) != 4 or len(set(o.strip().lower() for o in opts)) != 4:
            errs.append(qid + ': need 4 distinct options')
        if src[0] == 'en':
            s = dict(q['source']); s['lang'] = 'en'
        else:
            kind, page, quote = src
            url, title, folder = SRC[kind]
            key = (folder, page)
            if key not in cache:
                cache[key] = norm(open(os.path.join(textdir, folder, 'p%d.txt' % page), encoding='utf8').read())
            if norm(quote) not in cache[key]:
                errs.append('%s: quote not found on %s p%d: %s' % (qid, folder, page, quote))
            if words(quote) > 25:
                errs.append('%s: quote has %d words' % (qid, words(quote)))
            s = {'url': url, 'title': title, 'page': page, 'quote': quote, 'lang': 'es'}
        out_q.append({
            'id': qid, 'topic': TOPICS[q['topic']], 'question': question, 'options': opts,
            'answer': q['answer'], 'explanation': expl, 'source': s,
            'en': {'question': q['question'], 'answer': q['options'][q['answer']]},
        })
    meta = {k: v for k, v in en.items() if k != 'questions'}
    meta.update({'exam': 'FPCES', 'lang': 'es', 'title': 'Examen de Protección de Alimentos de NYC',
                 'page_numbering': 'Índice de página del PDF (1 = primera página); null para páginas HTML'})
    meta['questions'] = out_q
    n_es = sum(1 for x in out_q if x['source']['lang'] == 'es')
    print('questions: %d  spanish-source: %d  english-source: %d' % (len(out_q), n_es, len(out_q) - n_es))
    if errs:
        print('\n'.join('FAIL ' + e for e in errs))
        sys.exit(1)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print('wrote', OUT)


if __name__ == '__main__':
    main()
