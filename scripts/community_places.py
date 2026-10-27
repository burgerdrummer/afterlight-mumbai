"""Reviewed public facility corrections with explicit reuse provenance."""
import datetime,math,re
from urllib.parse import urlsplit
def parse_community(raw,boundary):
    from shapely.geometry import Point
    if raw.get('type')!='FeatureCollection' or not isinstance(raw.get('features'),list) or len(raw['features'])>10000:raise ValueError('Community data must be a GeoJSON FeatureCollection with at most 10,000 points.')
    output=[];ids=set()
    for f in raw['features']:
        t=f.get('properties') or {};g=f.get('geometry') or {};c=g.get('coordinates');ident=str(f.get('id') or t.get('id') or '')
        if not ident or ident in ids:raise ValueError('Every community point needs a unique stable ID.')
        ids.add(ident)
        if g.get('type')!='Point' or not isinstance(c,list) or len(c)!=2 or any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in c) or not boundary.covers(Point(c)):raise ValueError('Community coordinates must be inside the Mumbai district polygons.')
        if urlsplit(t.get('source','')).scheme not in {'http','https'} or not urlsplit(t.get('source','')).netloc or not t.get('licence'):raise ValueError('Community records need a public HTTP(S) source and a reuse licence.')
        if not t.get('name') or not t.get('category'):raise ValueError('Community records need name and category.')
        checked=t.get('checked')
        if checked and not re.fullmatch(r'\d{4}-\d{2}-\d{2}',checked):raise ValueError('Use YYYY-MM-DD check dates.')
        if checked and datetime.date.fromisoformat(checked)>datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5,minutes=30))).date():raise ValueError('A check date cannot be in the future.')
        output.append({'id':ident,'name':t['name'],'category':t['category'],'coord':c,'hours':t.get('opening_hours'),'checked':checked,'updated':None,'help':t['category'] in {'police','hospital','pharmacy','clinic','fire_station'},'accessVerified':False,'source':t['source'],'licence':t['licence'],'phone':t.get('phone'),'website':t.get('website'),'emergency':t.get('emergency'),'provider':'Community submission'})
    return output
