"""Merge reusable OSM facilities and optional Overture places; retain provenance.

No operating_status value is converted into time-of-day opening hours.
Facility geometry centres are explicitly not verified entrances.
"""
import argparse, datetime, gzip, json, math, re
from pathlib import Path
import osmium
from shapely.geometry import Point, shape
ROOT=Path(__file__).resolve().parents[1]
ACTIVITY={'restaurant','cafe','fast_food','bar','pub','ice_cream','pharmacy','hospital','clinic','police','fuel','bus_station','ferry_terminal','marketplace','library','community_centre','fire_station','doctors','dentist','charging_station'}
def main():
    p=argparse.ArgumentParser();p.add_argument('--pbf',type=Path,required=True);p.add_argument('--overture',type=Path);p.add_argument('--community',type=Path,default=ROOT/'data/community-places.geojson');args=p.parse_args()
    folder=ROOT/'public/data/mumbai';manifest=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
    manifest['landmarks']=[l for l in manifest['landmarks'] if not l['id'].startswith('overture/')]
    boundary=shape(manifest['boundary']);bounds=boundary.bounds;places={}
    class Collect(osmium.SimpleHandler):
        def __init__(self):super().__init__();self.nodes={};self.ways={}
        def add(self,ident,t,coord):
            category=t.get('amenity') or t.get('shop') or t.get('healthcare') or ('station' if t.get('railway')=='station' else 'bus_stop')
            if t.get('access') in {'no','private'} or not (t.get('shop') or t.get('amenity') in ACTIVITY or t.get('healthcare') or t.get('railway')=='station' or t.get('highway')=='bus_stop'):return
            if not boundary.covers(Point(coord)):return
            places[ident]={'id':ident,'name':t.get('name:en',t.get('name',category.replace('_',' ').title())),'category':category,'coord':coord,'hours':t.get('opening_hours'),'checked':t.get('check_date:opening_hours') or t.get('check_date'),'updated':None,'help':category in {'police','hospital','pharmacy','clinic','fire_station'},'accessVerified':False,'source':'https://www.openstreetmap.org/'+ident,'licence':'ODbL-1.0','phone':t.get('contact:phone',t.get('phone')),'website':t.get('contact:website',t.get('website')),'emergency':t.get('emergency'),'provider':'OpenStreetMap'}
        def node(self,n):
            if not n.location.valid():return
            c=[n.location.lon,n.location.lat]
            if bounds[0]-.005<=c[0]<=bounds[2]+.005 and bounds[1]-.005<=c[1]<=bounds[3]+.005:
                self.nodes[n.id]=c
                if len(n.tags):self.add('node/'+str(n.id),dict(n.tags),c)
        def way(self,w):
            c=[self.nodes[n.ref] for n in w.nodes if n.ref in self.nodes]
            if not c or len(c)!=len(w.nodes):return
            centre=[sum(p[0] for p in c)/len(c),sum(p[1] for p in c)/len(c)]
            # Keep regional way centres to locate multi-way facility relations.
            self.ways[w.id]=centre
            if len(w.tags):self.add('way/'+str(w.id),dict(w.tags),centre)
        def relation(self,r):
            t=dict(r.tags)
            if not (t.get('amenity') in ACTIVITY or t.get('shop') or t.get('healthcare')):return
            c=[self.ways[m.ref] for m in r.members if m.type=='w' and m.ref in self.ways and m.role!='inner']
            if c:self.add('relation/'+str(r.id),t,[sum(p[0] for p in c)/len(c),sum(p[1] for p in c)/len(c)])
    print('Reading OSM facilities, contacts and facility relations...',flush=True)
    cache=ROOT/'work/osm-facilities.json'
    signature=[args.pbf.stat().st_size,args.pbf.stat().st_mtime_ns];signature_file=ROOT/'work/osm-facilities-input.json'
    if cache.exists() and signature_file.exists() and json.loads(signature_file.read_text())==signature:places=json.loads(cache.read_text(encoding='utf-8'))
    else:
        collect=Collect();collect.apply_file(str(args.pbf));cache.write_text(json.dumps(places,ensure_ascii=False),encoding='utf-8');signature_file.write_text(json.dumps(signature))
    print('OSM facilities:',len(places),flush=True)
    # Existing OSM IDs remain stable. Name+nearby-coordinate conflation stops a
    # source merge from inflating route counts; hours from OSM are retained.
    def norm(name):return re.sub(r'[^\w]','',name.casefold())
    by_name={}
    for place in places.values():by_name.setdefault(norm(place['name']),[]).append(place)
    added=0;licences={'ODbL-1.0'}
    if args.overture and args.overture.exists():
        raw=json.loads(args.overture.read_text(encoding='utf-8'))
        for f in raw.get('features',[]):
            t=f.get('properties',{});coord=f.get('geometry',{}).get('coordinates',[])
            if f.get('geometry',{}).get('type')!='Point' or not boundary.covers(Point(coord)):continue
            if t.get('operating_status') in {'permanently_closed','temporarily_closed'} or (t.get('confidence') is not None and t['confidence']<.6):continue
            names=t.get('names') or {};name=names.get('primary')
            if not name:continue
            key=norm(name)
            duplicates=[p for p in by_name.get(key,[]) if math.hypot((coord[0]-p['coord'][0])*.945,coord[1]-p['coord'][1])*111000<60]
            if duplicates:continue
            category=((t.get('taxonomy') or {}).get('primary')) or ((t.get('categories') or {}).get('primary')) or t.get('basic_category') or 'place'
            if any(x in category for x in ['residential','mountain','administrative','geographic','natural_feature']):continue
            sources=t.get('sources') or [];licence='; '.join(sorted({s.get('license') or 'CDLA-Permissive-2.0' for s in sources})) or 'CDLA-Permissive-2.0'
            licences.add(licence)
            ident=t.get('id') or f.get('id')
            if not ident:continue
            place={'id':'overture/'+ident,'name':name,'category':category,'coord':coord,'hours':None,'checked':None,'updated':None,'help':any(x in category for x in ['hospital','police','pharmacy','clinic']),'accessVerified':False,'source':'https://docs.overturemaps.org/guides/places/','licence':licence,'phone':(t.get('phones') or [None])[0],'website':(t.get('websites') or [None])[0],'provider':'Overture Maps','sourceRecords':sources}
            places[place['id']]=place;by_name.setdefault(key,[]).append(place);added+=1
    all_places=list(places.values())
    # Retain the separately refreshed explicit OSM schedules on PBF rebuilds.
    hours_overlay=ROOT/'data/opening-hours-osm.json'
    if hours_overlay.exists():
        from refresh_opening_hours import merge_hours_records
        overlay=json.loads(hours_overlay.read_text(encoding='utf-8'))
        all_places,_=merge_hours_records(all_places,overlay['records'])
    if args.community.exists():
        from community_places import parse_community
        combined={place['id']:place for place in all_places}
        for record in parse_community(json.loads(args.community.read_text(encoding='utf-8')),boundary):combined[record['id']]=record;licences.add(record['licence'])
        all_places=list(combined.values())
    provenance={p['id']:p.pop('sourceRecords') for p in all_places if 'sourceRecords' in p}
    (folder/'place-provenance.json.gz').write_bytes(gzip.compress(json.dumps(provenance,separators=(',',':')).encode(),mtime=0))
    (folder/'places-extra.json.gz').write_bytes(gzip.compress(json.dumps(all_places,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
    old={p['id']:p for p in all_places};names={l['name'].casefold() for l in manifest['landmarks']}
    for l in manifest['landmarks']:
        if l['id'] in old:l['requestedCoord']=old[l['id']]['coord']
    for place in all_places:
        if place['name'].casefold() in names or len(place['name'])<3 or norm(place['name'])==norm(place['category']):continue
        manifest['landmarks'].append({'id':place['id'],'name':place['name'],'subtitle':place['category'].replace('_',' ')+' · '+place['provider'],'node':-1,'coord':place['coord'],'requestedCoord':place['coord'],'offset':0});names.add(place['name'].casefold())
    manifest['extraPlacesFile']='places-extra.json.gz'
    manifest['provenanceFile']='place-provenance.json.gz'
    manifest['enrichment']={'places':len(all_places),'withHours':sum(bool(p['hours']) for p in all_places),'sources':sorted({p['provider'] for p in all_places}),'importedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'licences':sorted(licences),'overtureAdded':added,'accessVerified':0}
    raw_manifest=json.dumps(manifest,ensure_ascii=False,separators=(',',':')).encode()
    (folder/'manifest.json').write_bytes(raw_manifest)
    (folder/'manifest.json.gz').write_bytes(gzip.compress(raw_manifest,mtime=0))
    (ROOT/'data/places-audit.json').write_text(json.dumps(manifest['enrichment'],indent=2),encoding='utf-8')
    print(json.dumps(manifest['enrichment'],indent=2),flush=True)
if __name__=='__main__':main()
