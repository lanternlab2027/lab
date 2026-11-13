# Independent re-implementation of the page's comps math, for cross-checking.
import json, sys, urllib.request, urllib.parse, datetime
A="https://data.cityofnewyork.us/resource/"
def soda(i,p): return json.load(urllib.request.urlopen(A+i+".json?"+urllib.parse.urlencode(p),timeout=120))
def q(s): return "'"+str(s).replace("'","''")+"'"
def quant(a,p):
    if not a: return float('nan')
    i=(len(a)-1)*p; lo=int(i); hi=min(lo+1,len(a)-1) if i!=lo else lo
    return a[lo]+(a[hi]-a[lo])*(i-lo)
bbl=sys.argv[1]; today=datetime.date(2026,11,13)
p=soda("8y4t-faws",{"$where":f"parid='{bbl}'","$order":"year DESC, period DESC","$limit":1})[0]
sf=float(p['gross_sqft']); mv=float(p['curmkttot']); av=float(p['curtxbtot'])
blk=int(p['block']); lot=int(p['lot']); boro=p['boro']; zp=p['zip_code']; cls=p['bldg_class']
nb=[]
for d in ("usep-8jbt","w2pb-icbu"): nb+=soda(d,{"$select":"neighborhood,sale_date","$where":f"borough='{boro}' AND block='{blk}'","$order":"sale_date DESC","$limit":1})
nb.sort(key=lambda r:r['sale_date'],reverse=True); hood=nb[0]['neighborhood'].strip() if nb else None
cut=today.replace(year=today.year-2).isoformat()
w=f"borough='{boro}' AND building_class_at_time_of='{cls}' AND sale_price>=10000 AND sale_date>='{cut}T00:00:00' AND (zip_code='{zp}' OR neighborhood={q(hood)})"
rows=[]
for d in ("usep-8jbt","w2pb-icbu"): rows+=soda(d,{"$where":w,"$limit":5000})
def n(x):
    try: return float(str(x).replace(',',''))
    except: return 0.0
seen={}
for s in rows: seen.setdefault((int(s['block']),int(float(s['lot'])),s['sale_date'][:10],round(n(s['sale_price']))),s)
allr=[s for k,s in seen.items() if not (k[0]==blk and k[1]==lot)]
from collections import Counter
pk=Counter((s['sale_date'][:10],round(n(s['sale_price']))) for s in allr)
allr=[s for s in allr if pk[(s['sale_date'][:10],round(n(s['sale_price'])))]==1 and n(s.get('gross_square_feet'))>0]
for s in allr:
    g=n(s['gross_square_feet']); s['psf']=n(s['sale_price'])/g; s['d']=abs(g-sf)/sf; s['both']=s['neighborhood'].strip()==hood and s['zip_code']==zp
tiers=[(8,lambda s:s['both'] and s['d']<=.25,'T1'),(5,lambda s:s['d']<=.25,'T2'),(5,lambda s:s['d']<=.40,'T3')]
for need,f,name in tiers:
    pick=[s for s in allr if f(s)]
    if len(pick)>=need: break
m0=quant(sorted(s['psf'] for s in pick),.5)
kept=sorted(s['psf'] for s in pick if m0/2<=s['psf']<=2*m0)
med=quant(kept,.5); imp=med*sf; emv=av/0.06
print(bbl,cls,zp,hood,name,'n',len(kept),'excluded',len(pick)-len(kept),'med %.2f p25 %.2f p75 %.2f'%(med,quant(kept,.25),quant(kept,.75)),
 'mvpsf %.2f ratio %.4f implied %.0f emv %.0f'%(mv/sf,mv/sf/med,imp,emv))
