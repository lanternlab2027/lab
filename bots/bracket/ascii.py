# Re-escape any non-ASCII characters in the bracket app's JS as \uXXXX, and report non-ASCII in HTML/JSON/MD.
# Run: python3 bots/bracket/ascii.py
import glob, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
for f in glob.glob(os.path.join(root, 'docs/bracket/*.js')) + glob.glob(os.path.join(root, 'bots/bracket/*.js')):
    s = open(f, encoding='utf8').read()
    t = ''.join(c if ord(c) < 128 else '\\u%04x' % ord(c) for c in s)
    if t != s:
        open(f, 'w', encoding='utf8').write(t); print('escaped', os.path.relpath(f, root))
for f in glob.glob(os.path.join(root, 'docs/bracket/*.html')) + glob.glob(os.path.join(root, 'docs/bracket/*.json')) + glob.glob(os.path.join(root, 'bots/bracket/*.md')):
    for i, line in enumerate(open(f, encoding='utf8'), 1):
        if any(ord(c) > 127 for c in line): print('NON-ASCII', os.path.relpath(f, root), i, line.strip()[:80].encode('ascii', 'replace'))
