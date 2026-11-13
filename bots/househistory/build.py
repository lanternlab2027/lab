import base64,re
B='build/';O='househistory/'
css=open(B+'style.css').read()
sel="&amp;$select=bbl,yearbuilt,numfloors,lotfront,lotdepth,bldgfront,bldgdepth,bldgarea,bldgclass,unitsres,landmark,histdist,zonedist1"
lsel="&amp;$select=docket,received_date,issue_date,regulation_type,worktypes,lmnametype"
for n,img in [('1','sanborn_127th_1896.jpg'),('2','sanborn_willow_1887.jpg')]:
    s=open(B+f'sample{n}.tpl.html').read()
    s=s.replace('{{CSS}}',css).replace('{{IMG}}',base64.b64encode(open(O+img,'rb').read()).decode())
    for a in ['address=20%20EAST%20127%20STREET','address=70%20WILLOW%20STREET&amp;borough=BK']:
        s=s.replace(a+'">',a+sel+'">').replace(a+'</a>',a+sel+'</a>')
    s=re.sub(r'(dpm2-m9mq\.json\?borough=\w+&amp;block=\d+&amp;lot=\d+)',r'\1'+lsel,s)
    s=s.replace('636b-3b5g.json?document_id=2012030501057001">https://data.cityofnewyork.us/resource/636b-3b5g.json?document_id=2012030501057001','636b-3b5g.json">https://data.cityofnewyork.us/resource/636b-3b5g.json')
    open(O+f'sample{n}.html','w').write(s)
