"""Refresh the small, reproducible Bandra pilot. Python standard library only.

One bounded request to OSM, not tile scraping. Use --input for an existing XML
extract, --output for a separate candidate snapshot. Review changes before release.
"""
import argparse
import collections
import datetime
import json
import math
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BBOX = [72.815, 19.045, 72.840, 19.070]  # west, south, east, north
URL = 'https://api.openstreetmap.org/api/0.6/map?bbox=' + ','.join(map(str, BBOX))

def distance(a, b):
    x = math.radians(b[0]-a[0])*math.cos(math.radians((a[1]+b[1])/2))
    y = math.radians(b[1]-a[1])
    return 6371000 * math.hypot(x, y)

def inside(p):
    return BBOX[0] <= p[0] <= BBOX[2] and BBOX[1] <= p[1] <= BBOX[3]

def tags(e):
    return {x.get('k'): x.get('v') for x in e.findall('tag')}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT/'public/data/bandra.json')
    args = parser.parse_args()
    if args.input:
        raw = args.input.read_bytes()
    else:
        request = urllib.request.Request(URL, headers={'User-Agent': 'Afterlight-Mumbai/0.1 (open-source-map-pilot)'})
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
    root = ET.fromstring(raw)
    nodes = {n.get('id'): [float(n.get('lon')), float(n.get('lat'))] for n in root.findall('node')}
    node_tags = {n.get('id'): tags(n) for n in root.findall('node') if n.findall('tag')}
    roads, surfaces, places, candidates = [], [], [], []
    coastlines=[]
    excluded = collections.Counter()
    denied = {'no','private','customers','delivery','destination','agricultural','forestry'}
    blocked = {nid for nid,t in node_tags.items() if t.get('foot',t.get('access')) in denied or t.get('barrier') in {'wall','fence','hedge','retaining_wall'} or t.get('locked') == 'yes'}
    for way in root.findall('way'):
        t = tags(way)
        refs = [n.get('ref') for n in way.findall('nd')]
        if not refs or any(n not in nodes for n in refs):
            continue
        coords = [nodes[n] for n in refs]
        if t.get('natural')=='coastline': coastlines.append(refs)
        if t.get('building') or t.get('leisure') in {'park','garden','playground'} or t.get('natural') in {'water','wood'}:
            if refs[0] == refs[-1] and any(inside(p) for p in coords):
                surfaces.append({'type': 'Feature', 'properties': {'kind': 'building' if t.get('building') else 'park', 'name': t.get('name','')}, 'geometry': {'type':'Polygon','coordinates':[coords]}})
        if not t.get('highway'):
            continue
        if len(coords)>1:
            roads.append({'type':'Feature','properties': {'kind':t['highway'],'name':t.get('name','')},'geometry':{'type':'LineString','coordinates':coords}})
        reason = None
        if t['highway'] in {'motorway','motorway_link','trunk','trunk_link','construction','proposed','busway','raceway'}:
            reason = 'road_type'
        elif t.get('area') == 'yes':
            reason = 'pedestrian_area_without_path'
        elif t.get('foot',t.get('access')) in denied:
            reason = 'access'
        elif t.get('foot:conditional') or t.get('access:conditional') or t.get('opening_hours'):
            reason = 'time_restricted_path'
        if reason:
            excluded[reason] += 1
            continue
        segments=[]
        for a,b in zip(refs,refs[1:]):
            if a not in blocked and b not in blocked and inside(nodes[a]) and inside(nodes[b]) and distance(nodes[a],nodes[b])>0.2:
                segments.append((a,b))
        if segments:
            candidates.append({'id':way.get('id'),'name':t.get('name',t.get('name:en','Unnamed path' if t['highway'] in {'path','footway','steps'} else 'Unnamed street')),'kind':t['highway'],'lit':t.get('lit','unknown'),'sidewalk':t.get('sidewalk', 'unknown'),'surface':t.get('surface','unknown'),'segments':segments})
    # OSM coastlines run with land to the left. Stitch these source ways and
    # close the water polygon far offshore, outside the pilot viewport.
    if coastlines:
        coast=coastlines.pop(0)
        while coastlines:
            found=False
            for i,line in enumerate(coastlines):
                if coast[-1]==line[0]:coast+=line[1:]
                elif line[-1]==coast[0]:coast=line[:-1]+coast
                else:continue
                coastlines.pop(i);found=True;break
            if not found:break
        c=[nodes[n] for n in coast]
        water=c+[[72.78,c[-1][1]],[72.78,c[0][1]],c[0]]
        surfaces.insert(0,{'type':'Feature','properties':{'kind':'water','name':'Arabian Sea'},'geometry':{'type':'Polygon','coordinates':[water]}})
    # Only the largest connected component is offered for routing. Never invent
    # connector edges across railways, walls, water or disconnected footpaths.
    adjacency=collections.defaultdict(list)
    for w in candidates:
        for a,b in w['segments']:
            adjacency[a].append(b); adjacency[b].append(a)
    seen=set(); largest=set()
    for start in adjacency:
        if start in seen: continue
        component={start}; seen.add(start); stack=[start]
        while stack:
            for n in adjacency[stack.pop()]:
                if n not in seen:
                    seen.add(n); component.add(n); stack.append(n)
        if len(component)>len(largest): largest=component
    ids=sorted(largest,key=int); index={n:i for i,n in enumerate(ids)}
    graph_nodes=[nodes[n] for n in ids]
    edges=[]; total=lit=sidewalk=0
    for w in candidates:
        for a,b in w['segments']:
            if a not in index or b not in index: continue
            length=distance(nodes[a],nodes[b]); total+=length
            if w['lit'] in {'yes','no','24/7','automatic','sunset-sunrise'}: lit+=length
            if w['sidewalk'] != 'unknown': sidewalk+=length
            # Split along the original OSM segment, never between unrelated ways.
            # Context analysis is thus bounded to pieces of at most 25 metres.
            count=max(1,math.ceil(length/25)); previous=index[a]
            for part in range(1,count+1):
                if part==count: current=index[b]
                else:
                    fraction=part/count
                    current=len(graph_nodes)
                    graph_nodes.append([nodes[a][0]+(nodes[b][0]-nodes[a][0])*fraction,nodes[a][1]+(nodes[b][1]-nodes[a][1])*fraction])
                edges.append({'a':previous,'b':current,'length':round(length/count,2),'way':w['id'],'name':w['name'],'kind':w['kind'],'lit':w['lit'],'sidewalk':w['sidewalk'],'surface':w['surface']})
                previous=current
    # Public activity locations only; no individual contributor metadata or
    # private phone numbers, cameras, residential addresses, or incident reports.
    activity_amenities={'restaurant','cafe','fast_food','bar','pub','ice_cream','pharmacy','hospital','clinic','police','fuel','bus_station','ferry_terminal','marketplace','library','community_centre'}
    def add_place(e,p):
        t=tags(e)
        if not inside(p) or t.get('access') in {'no','private'}:return
        if not (t.get('shop') or t.get('amenity') in activity_amenities or t.get('railway')=='station' or t.get('highway')=='bus_stop'):return
        category=t.get('amenity') or t.get('shop') or ('station' if t.get('railway')=='station' else 'bus_stop')
        places.append({'id':e.tag+'/'+e.get('id'),'name':t.get('name',t.get('name:en',category.replace('_',' ').title())),'category':category,'coord':p,'hours':t.get('opening_hours'),'checked':t.get('check_date:opening_hours') or t.get('check_date'),'updated':e.get('timestamp'),'help':category in {'hospital','police','pharmacy'},'accessVerified':False})
    for e in root.findall('node'):add_place(e,nodes[e.get('id')])
    for e in root.findall('way'):
        refs=[n.get('ref') for n in e.findall('nd') if n.get('ref') in nodes]
        if refs:
            pts=[nodes[n] for n in refs[:-1] if refs[0]==refs[-1]] or [nodes[n] for n in refs]
            add_place(e,[round(sum(p[0] for p in pts)/len(pts),7),round(sum(p[1] for p in pts)/len(pts),7)])
    # These named public locations are search conveniences, not verified entrances.
    targets=[('Bandra Station Road (W)',[72.8377,19.0544],'Station approach'),('Bandstand Promenade',[72.8200,19.0500],'Seafront'),('St. Andrew’s Church',[72.8259,19.0547],'Hill Road'),('Cafe Andora',[72.82768,19.05734],'St. Dominic Street'),('Mount Mary Steps',[72.8250,19.0482],'Mount Mary'),('Pali Village',[72.83045,19.06351],'Neighbourhood'),('Lilavati Hospital approach',[72.8286,19.0514],'Public road nearby')]
    landmarks=[]
    for name,p,subtitle in targets:
        nearest=min(range(len(graph_nodes)),key=lambda i:distance(p,graph_nodes[i]))
        landmarks.append({'id':str(nearest),'name':name,'subtitle':subtitle,'node':nearest,'coord':graph_nodes[nearest],'offset':round(distance(p,graph_nodes[nearest]))})
    audit={'places':len(places),'placesWithHours':sum(bool(p['hours']) for p in places),'placesWithCheckDate':sum(bool(p['checked']) for p in places),'routingNodes':len(graph_nodes),'routingEdges':len(edges),'streetKm':round(total/1000,1),'lightingCoverage':round(lit/total*100,1),'sidewalkCoverage':round(sidewalk/total*100,1),'excludedWays':dict(excluded),'verifiedHelpEntrances':0,'fieldValidated':False}
    snapshot={'version':1,'area':'Bandra West, Mumbai','bbox':BBOX,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':URL,'licence':'ODbL-1.0','attribution':'© OpenStreetMap contributors','nodes':graph_nodes,'edges':edges,'places':places,'landmarks':landmarks,'roads':{'type':'FeatureCollection','features':roads},'surfaces':{'type':'FeatureCollection','features':surfaces},'audit':audit}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(snapshot,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
    (ROOT/'data').mkdir(exist_ok=True)
    (ROOT/'data/audit.json').write_text(json.dumps({'area':snapshot['area'],'fetchedAt':snapshot['fetchedAt'],'source':URL,**audit},indent=2),encoding='utf-8')
    print(json.dumps(audit,indent=2))

if __name__ == '__main__': main()
