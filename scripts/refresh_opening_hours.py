"""Refresh explicit OSM opening schedules; never infer hours from category.

Uses a bounded public Overpass query. Raw responses stay in work/; normalized
ODbL records and an audit are retained so subsequent imports reproduce the merge.
"""
import argparse, datetime, gzip, json, math, re, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
AMENITIES={'restaurant','cafe','fast_food','bar','pub','ice_cream','pharmacy','hospital','clinic','police','fuel','bus_station','ferry_terminal','marketplace','library','community_centre','fire_station','doctors','dentist','charging_station','cinema','arts_centre','bank','post_office'}

def in_ring(point,ring):
    x,y=point;inside=False
    for a,b in zip(ring,ring[1:]+ring[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
    return inside

def in_boundary(point,boundary):
    polygons=boundary['coordinates'] if boundary['type']=='MultiPolygon' else [boundary['coordinates']]
    return any(in_ring(point,p[0]) and not any(in_ring(point,hole) for hole in p[1:]) for p in polygons)

def normalized_records(raw,boundary):
    if raw.get('remark') or not isinstance(raw.get('elements'),list):raise ValueError('Incomplete Overpass response; no data was changed.')
    records=[]
    for item in raw['elements']:
        tags=item.get('tags',{});centre=item if item['type']=='node' else item.get('center',{})
        hours=tags.get('opening_hours')
        eligible=tags.get('shop') or tags.get('healthcare') or tags.get('amenity') in AMENITIES or tags.get('tourism') in {'hotel','hostel','motel'} or tags.get('leisure') in {'fitness_centre','sports_centre'}
        if not eligible or tags.get('access') in {'no','private'} or not isinstance(hours,str) or not hours.strip():continue
        if any(k in tags for k in ['disused:shop','abandoned:amenity']) or 'lon' not in centre or 'lat' not in centre:continue
        coord=[centre['lon'],centre['lat']]
        if any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in coord) or not in_boundary(coord,boundary):continue
        category=tags.get('amenity') or tags.get('shop') or tags.get('healthcare') or tags.get('tourism') or tags.get('leisure')
        ident=f"{item['type']}/{item['id']}";source='https://www.openstreetmap.org/'+ident
        records.append({'id':ident,'name':tags.get('name:en',tags.get('name',category.replace('_',' ').title())),'category':category,'coord':coord,'hours':hours.strip(),'checked':tags.get('check_date:opening_hours') or tags.get('check_date'),'updated':item.get('timestamp'),'help':category in {'police','hospital','pharmacy','clinic','fire_station'},'accessVerified':False,'source':source,'licence':'ODbL-1.0','phone':tags.get('contact:phone',tags.get('phone')),'website':tags.get('contact:website',tags.get('website')),'emergency':tags.get('emergency'),'provider':'OpenStreetMap','hoursSource':source,'hoursLicence':'ODbL-1.0','hoursUpdated':item.get('timestamp')})
    return records

def merge_hours_records(places,records):
    by_id={p['id']:p for p in places};by_name={};counts={'addedPlaces':0,'addedSchedules':0,'changedSchedules':0,'matchedDuplicates':0}
    norm=lambda name:re.sub(r'[^\w]','',name.casefold())
    for place in places:by_name.setdefault(norm(place['name']),[]).append(place)
    for record in records:
        existing=by_id.get(record['id'])
        if not existing:
            candidates=by_name.get(norm(record['name']),[])
            existing=next((p for p in candidates if math.hypot((p['coord'][0]-record['coord'][0])*.945,p['coord'][1]-record['coord'][1])*111000<40),None)
            if existing:counts['matchedDuplicates']+=1
        if existing:
            if existing.get('hoursUpdated') and record.get('hoursUpdated') and existing['hoursUpdated']>record['hoursUpdated']:continue
            if not existing.get('hours'):counts['addedSchedules']+=1
            elif existing['hours']!=record['hours']:counts['changedSchedules']+=1
            for key in ['hours','hoursSource','hoursLicence','hoursUpdated']:
                if record.get(key) is not None:existing[key]=record[key]
            if record.get('checked'):existing['checked']=record['checked']
        else:
            place=dict(record);places.append(place);by_id[place['id']]=place;by_name.setdefault(norm(place['name']),[]).append(place)
            counts['addedPlaces']+=1;counts['addedSchedules']+=1
    return places,counts

def write_json(path,value,compressed=False):
    raw=json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()
    if compressed:raw=gzip.compress(raw,mtime=0)
    temporary=path.with_name(path.name+'.tmp');temporary.write_bytes(raw)
    try:temporary.replace(path)
    except PermissionError:
        # A Windows dev-server watcher can permit writes but hold a rename lock.
        path.write_bytes(raw);temporary.unlink()

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--fetch',action='store_true');parser.add_argument('--fetch-only',action='store_true');parser.add_argument('--input',type=Path,default=ROOT/'work/latest-hours-overpass.json');parser.add_argument('--endpoint',default='https://overpass-api.de/api/interpreter');args=parser.parse_args()
    folder=ROOT/'public/data/mumbai';manifest=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
    if args.fetch or args.fetch_only:
        west,south,east,north=manifest['bbox'];query=f'[out:json][timeout:45];nwr["opening_hours"]({south},{west},{north},{east});out center meta;'
        request=urllib.request.Request(args.endpoint,data=urllib.parse.urlencode({'data':query}).encode(),headers={'User-Agent':'AfterlightMumbai/0.6 (open-source opening-hours refresh)'})
        with urllib.request.urlopen(request,timeout=55) as response:payload=response.read(15_000_001)
        if len(payload)>15_000_000:raise ValueError('Response exceeded 15 MB; no data was changed.')
        raw=json.loads(payload)
        if raw.get('remark') or not raw.get('elements'):raise ValueError('Incomplete or empty query; no data was changed.')
        args.input.parent.mkdir(parents=True,exist_ok=True);args.input.write_bytes(payload)
        print('Downloaded',len(raw['elements']),'OSM records',flush=True)
        if args.fetch_only:return
    raw=json.loads(args.input.read_text(encoding='utf-8'));records=normalized_records(raw,manifest['boundary'])
    if not records:raise ValueError('No public facility schedules inside Mumbai; no data was changed.')
    places=json.loads(gzip.decompress((folder/'places-extra.json.gz').read_bytes()))
    before={'places':len(places),'withHours':sum(bool(p.get('hours')) for p in places)}
    places,counts=merge_hours_records(places,records)
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    # This normalized overlay is applied by enrich_places.py after future imports.
    write_json(ROOT/'data/opening-hours-osm.json',{'licence':'ODbL-1.0','source':args.endpoint,'fetchedAt':now,'osmBase':raw.get('osm3s',{}).get('timestamp_osm_base'),'records':records})
    after={'places':len(places),'withHours':sum(bool(p.get('hours')) for p in places)}
    audit={'before':before,'after':after,**counts,'publicScheduledRecords':len(records),'fetchedAt':now,'osmBase':raw.get('osm3s',{}).get('timestamp_osm_base'),'source':args.endpoint,'licence':'ODbL-1.0'}
    manifest['enrichment'].update(after);manifest['enrichment']['openingHoursRefresh']=audit
    known={l['id'] for l in manifest['landmarks']}
    for place in places:
        if place['id'] not in known and place['hours'] and len(place['name'])>2:
            manifest['landmarks'].append({'id':place['id'],'name':place['name'],'subtitle':place['category'].replace('_',' ')+' · '+place['provider'],'node':-1,'coord':place['coord'],'requestedCoord':place['coord'],'offset':0});known.add(place['id'])
    write_json(folder/'places-extra.json.gz',places,True);write_json(folder/'manifest.json',manifest);write_json(folder/'manifest.json.gz',manifest,True)
    write_json(ROOT/'data/opening-hours-audit.json',audit);write_json(ROOT/'data/places-audit.json',manifest['enrichment'])
    print(json.dumps(audit,indent=2))

if __name__=='__main__':main()
