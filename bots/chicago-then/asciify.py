#!/usr/bin/env python3
"""Rewrite non-ASCII characters in JS files as \\u escapes (repo convention: pure-ASCII JS)."""
import sys
for p in sys.argv[1:]:
    s = open(p, encoding='utf-8').read()
    out = []
    for ch in s:
        o = ord(ch)
        if o < 128: out.append(ch)
        elif o <= 0xFFFF: out.append('\\u%04X' % o)
        else:
            o -= 0x10000
            out.append('\\u%04X\\u%04X' % (0xD800 + (o >> 10), 0xDC00 + (o & 0x3FF)))
    open(p, 'w', encoding='utf-8').write(''.join(out))
