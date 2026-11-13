import json,sys,urllib.request,urllib.parse
B="https://data.cityofnewyork.us/resource/"
def q(ds,params):
    url=B+ds+".json?"+urllib.parse.urlencode(params)
    return json.load(urllib.request.urlopen(url,timeout=90))
boro,block,lot,tag=sys.argv[1:5]
leg=q("8h5j-fqxa",{"borough":boro,"block":block,"lot":lot,"$limit":500})
ids=sorted({l["document_id"] for l in leg})
out=[]
for i in range(0,len(ids),40):
    chunk=ids[i:i+40]
    w="document_id in("+",".join("'%s'"%c for c in chunk)+")"
    m=q("bnx9-e6tj",{"$where":w,"$limit":500})
    p=q("636b-3b5g",{"$where":w,"$limit":2000})
    for d in m:
        d["parties"]=[{"type":x.get("party_type"),"name":x.get("name")} for x in p if x["document_id"]==d["document_id"]]
        out.append(d)
out.sort(key=lambda d:d.get("document_date") or d.get("recorded_datetime") or "")
json.dump(out,open(f"acris_{tag}.json","w"),indent=1)
for d in out:
    print(d["document_id"],d.get("doc_type"),(d.get("document_date") or "")[:10],(d.get("recorded_datetime") or "")[:10],d.get("document_amt"),"|",["%s:%s"%(x["type"],x["name"]) for x in d["parties"]])
