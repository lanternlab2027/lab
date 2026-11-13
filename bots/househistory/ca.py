import json,sys
import urllib.request as _u
_o=_u.build_opener();_o.addheaders=[('User-Agent','curl/8.5.0')];_u.install_opener(_o)
import json,re,urllib.request,urllib.parse,xml.etree.ElementTree as ET,os,hashlib
q=sys.argv[1]; pat=re.compile(sys.argv[2],re.I); extra=sys.argv[3] if len(sys.argv)>3 else ""
url="https://www.loc.gov/collections/chronicling-america/?"+urllib.parse.urlencode({"q":q,"fo":"json","c":"40","at":"results,pagination"})+extra
d=json.load(urllib.request.urlopen(url,timeout=120))
print("TOTAL",d["pagination"].get("of"),url)
cache="/tmp/claude-0/-home-claude/69ef2e03-4772-566e-a19b-2f78e096e5ba/scratchpad/househistory/raw/alto"; os.makedirs(cache,exist_ok=True)
for r in d["results"]:
    wc=r.get("word_coordinates_url","")
    m=re.search(r"segment=([^&]+)",wc)
    if not m: continue
    seg=urllib.parse.unquote(m.group(1))
    f=os.path.join(cache,hashlib.md5(seg.encode()).hexdigest()+".xml")
    if not os.path.exists(f):
        try: open(f,"wb").write(urllib.request.urlopen("https://tile.loc.gov/storage-services"+seg,timeout=120).read())
        except Exception as e: print("ERR",e); continue
    root=ET.parse(f).getroot()
    lines=[]
    for tl in root.iter():
        if tl.tag.endswith("TextLine"):
            lines.append(" ".join(s.get("CONTENT","") for s in tl if s.tag.endswith("String")))
    hits=[i for i,l in enumerate(lines) if pat.search(l)]
    if not hits: continue
    print("\n###",r.get("date"),r.get("partof_title",[""])[0],r["id"].replace("http://","https://"))
    for i in hits[:4]:
        print("   ","\n    ".join(lines[max(0,i-3):i+4]));print("    ---")
