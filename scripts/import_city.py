"""Build Mumbai city + suburban districts from a regional OSM PBF.

No map-API tiling, fabricated roads, or guessed city boundary. Optional Python
dependencies are listed in requirements-data.txt. Raw input stays outside public/.
"""
import argparse, collections, datetime, gzip, hashlib, json, math, time, pickle
from pathlib import Path
import osmium
from shapely.geometry import LineString, Point, Polygon, mapping
from shapely.ops import polygonize, unary_union
from shapely.prepared import prep

ROOT=Path(__file__).resolve().parents[1]
SOURCE='https://download.geofabrik.de/asia/india/western-zone-latest.osm.pbf'
DISTRICTS={7964375:'Mumbai Suburban District',7964376:'Mumbai City District'}
ENVELOPE=(72.70,18.84,73.07,19.36)
CELL=.025
ACTIVITY={'restaurant','cafe','fast_food','bar','pub','ice_cream','pharmacy','hospital','clinic','police','fuel','bus_station','ferry_terminal','marketplace','library','community_centre'}
DENIED={'no','private','customers','delivery','destination','agricultural','forestry'}

def meters(a,b):
    rad=math.pi/180
    return 6371000*math.hypot((b[0]-a[0])*rad*math.cos((a[1]+b[1])*rad/2),(b[1]-a[1])*rad)

def in_envelope(p):return ENVELOPE[0]<=p[0]<=ENVELOPE[2] and ENVELOPE[1]<=p[1]<=ENVELOPE[3]
def dump(path,value,compress=False):
    path.parent.mkdir(parents=True,exist_ok=True)
    raw=json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()
    path.write_bytes(gzip.compress(raw,compresslevel=6,mtime=0) if compress else raw)
    return len(raw)

class Extract(osmium.SimpleHandler):
    def __init__(self):
        super().__init__();self.nodes={};self.blocked=set();self.roads=[];self.boundary_ways={};self.relations={};self.places=[];self.cameras=[];self.surfaces=[];self.coasts=[];self.labels=[];self.source_date='';self.excluded=collections.Counter()
    def add_place(self,ident,t,p,updated):
        category=t.get('amenity') or t.get('shop') or ('station' if t.get('railway')=='station' else 'bus_stop')
        if t.get('access') not in {'no','private'} and (t.get('shop') or t.get('amenity') in ACTIVITY or t.get('railway')=='station' or t.get('highway')=='bus_stop'):
            self.places.append({'id':ident,'name':t.get('name:en',t.get('name',category.replace('_',' ').title())),'category':category,'coord':p,'hours':t.get('opening_hours'),'checked':t.get('check_date:opening_hours') or t.get('check_date'),'updated':updated,'help':category in {'police','hospital','pharmacy'},'accessVerified':False})
        if t.get('man_made')=='surveillance' and t.get('surveillance:type') not in {'guard','gunshot_detector'} and t.get('surveillance')!='indoor' and t.get('indoor')!='yes' and t.get('surveillance:zone') not in {'shop','bank','building'}:
            self.cameras.append({'id':ident,'name':t.get('name:en',t.get('name','Mapped CCTV / surveillance point')),'coord':p,'operator':t.get('operator'),'type':t.get('surveillance:type','unspecified'),'zone':t.get('surveillance:zone','unknown'),'checked':t.get('check_date'),'updated':str(updated),'status':'unverified','source':'https://www.openstreetmap.org/'+ident,'licence':'ODbL-1.0'})
        if (t.get('place') in {'suburb','neighbourhood','quarter','locality'} or t.get('railway')=='station') and (t.get('name:en') or t.get('name')):
            self.labels.append({'name':t.get('name:en',t.get('name')),'coord':p,'category':t.get('place',t.get('railway'))})
    def node(self,n):
        if not n.location.valid():return
        p=[round(n.location.lon,7),round(n.location.lat,7)]
        if not in_envelope(p):return
        self.nodes[n.id]=p
        if not len(n.tags):return
        t=dict(n.tags)
        if t.get('foot',t.get('access')) in DENIED or t.get('locked')=='yes' or t.get('barrier') in {'wall','fence','hedge','retaining_wall'}:self.blocked.add(n.id)
        self.add_place('node/'+str(n.id),t,p,str(n.timestamp))
    def way(self,w):
        t=dict(w.tags);refs=[n.ref for n in w.nodes]
        if t.get('boundary')=='administrative':self.boundary_ways[w.id]=refs
        if not any(n in self.nodes for n in refs):return
        if t.get('highway'):
            reason=None
            if t['highway'] in {'motorway','motorway_link','trunk','trunk_link','construction','proposed','busway','raceway'}:reason='road_type'
            elif t.get('area')=='yes':reason='pedestrian_area_without_path'
            elif t.get('foot',t.get('access')) in DENIED:reason='access'
            elif t.get('access:conditional') or t.get('foot:conditional') or t.get('opening_hours'):reason='time_restricted_path'
            if reason:self.excluded[reason]+=1
            self.roads.append((w.id,refs,{'id':str(w.id),'name':t.get('name:en',t.get('name','Unnamed path' if t['highway'] in {'path','footway','steps'} else 'Unnamed street')),'kind':t['highway'],'lit':t.get('lit','unknown'),'sidewalk':t.get('sidewalk','unknown'),'surface':t.get('surface','unknown')},reason))
        coords=[self.nodes[n] for n in refs if n in self.nodes]
        if len(coords)==len(refs) and coords:
            centre=[round(sum(p[0] for p in coords)/len(coords),7),round(sum(p[1] for p in coords)/len(coords),7)]
            self.add_place('way/'+str(w.id),t,centre,str(w.timestamp))
            if t.get('natural')=='coastline':self.coasts.append(coords)
            if refs[0]==refs[-1] and len(refs)>3 and (t.get('building') or t.get('leisure') in {'park','garden','playground'} or t.get('natural') in {'wood','water'}):
                kind='building' if t.get('building') else 'water' if t.get('natural')=='water' else 'park'
                self.surfaces.append({'type':'Feature','id':'s'+str(w.id),'properties':{'kind':kind},'geometry':{'type':'Polygon','coordinates':[coords]}})
    def relation(self,r):
        if r.id in DISTRICTS:self.relations[r.id]=[(m.ref,m.role) for m in r.members if m.type=='w' and m.role in {'outer','inner',''}]

def main():
    p=argparse.ArgumentParser();p.add_argument('--pbf',type=Path,required=True);p.add_argument('--out',type=Path,default=ROOT/'public/data/mumbai');p.add_argument('--cache',type=Path,help='Optional trusted local intermediate cache; never load a cache from someone else.');args=p.parse_args()
    start=time.time();extract=Extract();print('Reading regional extract…',flush=True)
    signature=(args.pbf.stat().st_size,args.pbf.stat().st_mtime_ns)
    if args.cache and args.cache.exists():
        with args.cache.open('rb') as f:cached=pickle.load(f)
        if cached['signature']!=signature:raise RuntimeError('The regional file changed. Choose a new local cache path.')
        extract.__dict__.update(cached['data']);print('Reused trusted local intermediate.',flush=True)
    else:
        extract.apply_file(str(args.pbf))
        if args.cache:
            args.cache.parent.mkdir(parents=True,exist_ok=True)
            with args.cache.open('wb') as f:pickle.dump({'signature':signature,'data':extract.__dict__},f,pickle.HIGHEST_PROTOCOL)
    print('Collected',len(extract.nodes),'nodes in city envelope;',len(extract.roads),'street ways;',len(extract.cameras),'candidate camera points',flush=True)
    if set(extract.relations)!=set(DISTRICTS):raise RuntimeError('Both district boundaries must exist in the source extract.')
    missing_ways={w for members in extract.relations.values() for w,_ in members if w not in extract.boundary_ways}
    if missing_ways:
        print('Resolving',len(missing_ways),'coastline/border member ways…',flush=True)
        class BoundaryWays(osmium.SimpleHandler):
            def way(self,w):
                if w.id in missing_ways:extract.boundary_ways[w.id]=[n.ref for n in w.nodes]
        BoundaryWays().apply_file(str(args.pbf))
    needed={n for members in extract.relations.values() for w,_ in members for n in extract.boundary_ways.get(w,[]) if n not in extract.nodes}
    if needed:
        print('Resolving',len(needed),'offshore boundary vertices…',flush=True)
        class BoundaryNodes(osmium.SimpleHandler):
            def node(self,n):
                if n.id in needed:extract.nodes[n.id]=[n.location.lon,n.location.lat]
        BoundaryNodes().apply_file(str(args.pbf))
    polygons=[]
    for rid,members in extract.relations.items():
        lines={role:[] for role in ['outer','inner']}
        for wid,role in members:
            refs=extract.boundary_ways.get(wid)
            if not refs or any(n not in extract.nodes for n in refs):raise RuntimeError('Incomplete district boundary: '+str(wid))
            lines['inner' if role=='inner' else 'outer'].append(LineString([extract.nodes[n] for n in refs]))
        outer=unary_union(list(polygonize(unary_union(lines['outer']))))
        inner=unary_union(list(polygonize(unary_union(lines['inner'])))) if lines['inner'] else Polygon()
        polygon=outer.difference(inner)
        if polygon.is_empty or not polygon.is_valid:raise RuntimeError('Invalid district boundary '+str(rid))
        polygons.append(polygon)
    boundary=unary_union(polygons);inside=prep(boundary);bbox=list(boundary.bounds)
    print('Clipping to Mumbai City + Suburban district polygons:',bbox,flush=True)
    inside_cache={}
    def contains(n):
        if n not in inside_cache:inside_cache[n]=n in extract.nodes and inside.covers(Point(extract.nodes[n]))
        return inside_cache[n]
    originals=[];way_metadata=[];road_features=[];city_excluded=collections.Counter()
    for wid,refs,t,reason in extract.roads:
        # Basemap and graph use exactly the same clipped source node sequences.
        sequences=[];current=[]
        for n in refs:
            if contains(n):current.append(n)
            elif current:
                if len(current)>1:sequences.append(current)
                current=[]
        if len(current)>1:sequences.append(current)
        for j,seq in enumerate(sequences):
            road_features.append({'type':'Feature','id':f'r{wid}-{j}','properties':{'kind':t['kind'],'name':t['name']},'geometry':{'type':'LineString','coordinates':[extract.nodes[n] for n in seq]}})
        if reason:
            if sequences:city_excluded[reason]+=1
            continue
        wi=len(way_metadata);way_metadata.append(t)
        for seq in sequences:
            for a,b in zip(seq,seq[1:]):
                if a not in extract.blocked and b not in extract.blocked:
                    d=meters(extract.nodes[a],extract.nodes[b])
                    if d>.2:originals.append((a,b,d,wi))
    refs=sorted({n for a,b,_,_ in originals for n in (a,b)});index={n:i for i,n in enumerate(refs)}
    coords=[extract.nodes[n] for n in refs];edges=[];adj=collections.defaultdict(list)
    for a,b,length,wi in originals:
        count=max(1,math.ceil(length/25));prev=index[a]
        for part in range(1,count+1):
            if part==count:at=index[b]
            else:
                f=part/count;at=len(coords);coords.append([round(extract.nodes[a][0]+(extract.nodes[b][0]-extract.nodes[a][0])*f,7),round(extract.nodes[a][1]+(extract.nodes[b][1]-extract.nodes[a][1])*f,7)])
            edges.append([prev,at,round(length/count,2),wi]);adj[prev].append(at);adj[at].append(prev);prev=at
    components=[-1]*len(coords);sizes=[]
    for n in range(len(coords)):
        if components[n]>=0:continue
        cid=len(sizes);components[n]=cid;stack=[n];size=0
        while stack:
            at=stack.pop();size+=1
            for other in adj[at]:
                if components[other]<0:components[other]=cid;stack.append(other)
        sizes.append(size)
    largest=max(range(len(sizes)),key=lambda i:sizes[i])
    places=[p for p in extract.places if inside.covers(Point(p['coord']))]
    cameras=[p for p in extract.cameras if p.get('type') not in {'guard','gunshot_detector'} and inside.covers(Point(p['coord']))]
    labels=[p for p in extract.labels if inside.covers(Point(p['coord']))]
    # A modest grid makes both location search indexing and camera/route analysis
    # practical without a citywide all-pairs comparison.
    grid=collections.defaultdict(list)
    for i,c in enumerate(coords):grid[(math.floor(c[0]*1000),math.floor(c[1]*1000))].append(i)
    def snap(c,main_only=False):
        gx,gy=math.floor(c[0]*1000),math.floor(c[1]*1000);best=None;dist=float('inf')
        for radius in range(1,12):
            for x in range(gx-radius,gx+radius+1):
                for y in range(gy-radius,gy+radius+1):
                    for node in grid.get((x,y),[]):
                        if main_only and components[node]!=largest:continue
                        d=meters(c,coords[node])
                        if d<dist:best,dist=node,d
            if dist<radius*80:break
        return best,dist
    targets=[('Bandra Station Road (W)',[72.8377,19.0544],'Bandra West'),('Bandstand Promenade',[72.8200,19.0500],'Bandra West'),('St. Andrew’s Church',[72.8259,19.0547],'Bandra West'),('Cafe Andora',[72.82768,19.05734],'Bandra West'),('Mount Mary Steps',[72.8250,19.0482],'Bandra West'),('Pali Village',[72.83045,19.06351],'Bandra West'),('Gateway of India',[72.8347,18.9220],'Colaba'),('Churchgate station',[72.8261,18.9352],'South Mumbai'),('Dadar station',[72.8426,19.0181],'Dadar'),('Juhu Beach approach',[72.8269,19.0989],'Juhu'),('Andheri station',[72.8465,19.1197],'Andheri'),('Borivali station',[72.8564,19.2290],'Borivali'),('Dahisar station',[72.8595,19.2503],'Dahisar'),('Powai Lake approach',[72.9050,19.1230],'Powai'),('Ghatkopar station',[72.9080,19.0865],'Ghatkopar'),('Chembur station',[72.9000,19.0620],'Chembur'),('Mulund station',[72.9570,19.1726],'Mulund')]
    landmarks=[];names=set()
    for name,c,sub in targets:
        node,offset=snap(c,True)
        if node is not None and offset<400:landmarks.append({'id':'landmark-'+str(node),'name':name,'subtitle':sub+' · mapped street approach','node':node,'coord':coords[node],'offset':round(offset)});names.add(name.lower())
    for point in labels+places:
        name=point['name']
        if name.lower() in names or name.lower().replace(' ','_')==point['category'] or len(name)<3:continue
        node,offset=snap(point['coord'])
        if node is None or offset>100:continue
        landmarks.append({'id':point.get('id','label-'+str(node)),'name':name,'subtitle':point['category'].replace('_',' ')+' · Mumbai','node':node,'coord':coords[node],'offset':round(offset)});names.add(name.lower())
    length=sum(e[2] for e in edges);lit=sum(e[2] for e in edges if way_metadata[e[3]]['lit'] in {'yes','no','24/7','automatic','sunset-sunrise'});sidewalk=sum(e[2] for e in edges if way_metadata[e[3]]['sidewalk']!='unknown')
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    reader=osmium.io.Reader(str(args.pbf),osmium.osm.NOTHING)
    source_date=reader.header().get('osmosis_replication_timestamp');reader.close()
    checksum=hashlib.sha256()
    with args.pbf.open('rb') as f:
        while chunk:=f.read(8*1024*1024):checksum.update(chunk)
    audit={'places':len(places),'placesWithHours':sum(bool(p['hours']) for p in places),'placesWithCheckDate':sum(bool(p['checked']) for p in places),'routingNodes':len(coords),'routingEdges':len(edges),'streetKm':round(length/1000,1),'lightingCoverage':round(lit/length*100,1),'sidewalkCoverage':round(sidewalk/length*100,1),'excludedWays':dict(city_excluded),'verifiedHelpEntrances':0,'fieldValidated':False,'cameraPoints':len(cameras),'verifiedCameraPoints':0,'components':len(sizes),'mainComponentNodes':sizes[largest]}
    simplified=mapping(boundary.simplify(.00008,preserve_topology=True))
    metadata={'version':2,'area':'Mumbai city and suburbs','bbox':bbox,'fetchedAt':now,'sourceDataThrough':source_date,'sourceSha256':checksum.hexdigest(),'source':SOURCE,'boundarySources':['https://www.openstreetmap.org/relation/'+str(i) for i in DISTRICTS],'boundaryNames':list(DISTRICTS.values()),'boundary':simplified,'licence':'ODbL-1.0','attribution':'© OpenStreetMap contributors · Geofabrik extract','nodes':[],'edges':[],'places':[],'cameras':cameras,'landmarks':landmarks,'roads':{'type':'FeatureCollection','features':[]},'surfaces':{'type':'FeatureCollection','features':[]},'audit':audit,'graphFile':'graph.json.gz','tiles':[],'labels':labels}
    compact={'v':2,'n':coords,'e':edges,'w':way_metadata,'p':places,'c':components}
    args.out.mkdir(parents=True,exist_ok=True);dump(args.out/'graph.json.gz',compact,True)
    # Detailed basemap is split into local cells so a phone loads only its view.
    tile_features=collections.defaultdict(list)
    def tile_add(feature):
        g=feature['geometry'];points=g['coordinates'] if g['type']=='LineString' else g['coordinates'][0]
        if not points:return
        minx,maxx=min(p[0] for p in points),max(p[0] for p in points);miny,maxy=min(p[1] for p in points),max(p[1] for p in points)
        for x in range(math.floor(minx/CELL),math.floor(maxx/CELL)+1):
            for y in range(math.floor(miny/CELL),math.floor(maxy/CELL)+1):tile_features[(x,y)].append(feature)
    for f in road_features:tile_add(f)
    for f in extract.surfaces:
        c=f['geometry']['coordinates'][0]
        if inside.covers(Point(c[0])):tile_add(f)
    for (x,y),features in sorted(tile_features.items()):
        name=f'tiles/{x}-{y}.json.gz';dump(args.out/name,{'type':'FeatureCollection','features':features},True)
        metadata['tiles'].append({'bbox':[round(x*CELL,6),round(y*CELL,6),round((x+1)*CELL,6),round((y+1)*CELL,6)],'file':name})
    overview=[]
    for f in road_features:
        if f['properties']['kind'] not in {'primary','secondary','tertiary','motorway','trunk'}:continue
        line=LineString(f['geometry']['coordinates']).simplify(.00015)
        if line.length>.0005:overview.append({**f,'geometry':mapping(line)})
    metadata['roads']['features']=overview
    metadata['surfaces']['features']=[{'type':'Feature','id':'city-boundary','properties':{'kind':'land'},'geometry':simplified}]
    dump(args.out/'manifest.json',metadata)
    dump(ROOT/'data/mumbai-audit.json',{'area':metadata['area'],'importedAt':now,'sourceDataThrough':source_date,'sourceSha256':checksum.hexdigest(),'source':SOURCE,'boundarySources':metadata['boundarySources'],**audit})
    print(json.dumps(audit,indent=2),flush=True)
    print('Saved',len(metadata['tiles']),'local map tiles;',len(landmarks),'searchable places;',round((time.time()-start),1),'seconds',flush=True)

if __name__=='__main__':main()
