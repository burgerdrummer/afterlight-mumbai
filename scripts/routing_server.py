"""Loopback-only Valhalla adapter. No external routing API or journey logging."""
import argparse, datetime, gzip, hashlib, json, math, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from valhalla import Actor
ROOT=Path(__file__).resolve().parents[1]
MODES={'walk':'pedestrian','motorcycle':'motorcycle','car':'auto'}
LOCK=threading.Lock()

def distance(a,b):return 6371000*math.hypot(math.radians(b[0]-a[0])*math.cos(math.radians((a[1]+b[1])/2)),math.radians(b[1]-a[1]))
def decode(encoded):
    out=[];at=0;lat=lon=0
    while at<len(encoded):
        values=[]
        for _ in range(2):
            value=shift=0
            while True:
                char=ord(encoded[at])-63;at+=1;value|=(char&31)<<shift;shift+=5
                if char<32:break
            values.append(~(value>>1) if value&1 else value>>1)
        lat+=values[0];lon+=values[1];out.append([lon/1e6,lat/1e6])
    return out

def metadata():
    path=ROOT/'work/routing/road-attributes.json.gz'
    if path.exists():return json.loads(gzip.decompress(path.read_bytes()))
    import osmium
    records={}
    class Read(osmium.SimpleHandler):
        def way(self,w):
            t=dict(w.tags)
            if not ('highway' in t or t.get('route')=='ferry'):return
            records[str(w.id)]={k:t[k] for k in ['highway','lit','sidewalk','sidewalk:both','surface','ref','network','operator','motorcycle','motor_vehicle','motorcar','access','toll'] if k in t}
    Read().apply_file(str(ROOT/'work/routing/mumbai.osm.pbf'))
    path.write_bytes(gzip.compress(json.dumps(records).encode(),mtime=0));return records

def validate(body):
    if body.get('mode') not in MODES:raise ValueError('Choose walking, motorcycle / scooter, or car.')
    for key in ['origin','destination']:
        p=body.get(key)
        if not isinstance(p,list) or len(p)!=2 or any(isinstance(x,bool) or not isinstance(x,(int,float)) or not math.isfinite(x) for x in p):raise ValueError('Choose valid coordinates.')
        if not (72.70<=p[0]<=73.10 and 18.84<=p[1]<=19.37):raise ValueError('Choose locations within the local Mumbai routing area.')
    if distance(body['origin'],body['destination'])<2:raise ValueError('Choose two different locations.')
    departure=datetime.datetime.fromisoformat(body['departure'].replace('Z','+00:00'))
    if departure.tzinfo is None:raise ValueError('Departure needs a timezone.')
    return departure.astimezone(datetime.timezone(datetime.timedelta(hours=5,minutes=30)))

def calculate(actor,attrs,body):
    at=validate(body);mode=body['mode'];costing=MODES[mode];options=body.get('options') or {}
    limits={'ignore_access':False,'ignore_oneways':False,'ignore_restrictions':False,'shortest':False,'exclude_ferries':True,'exclude_tolls':bool(options.get('avoidTolls')),'speed_types':['freeflow','constrained']}
    if mode=='walk':limits.update(walking_speed=4.5,step_penalty=600 if options.get('avoidStairs') else 30)
    else:
        limits.update(use_tolls=0 if options.get('avoidTolls') else .5,exclude_unpaved=bool(options.get('avoidUnpaved')))
        if mode=='motorcycle':limits.update(use_trails=0)
    locations=[{'lat':p[1],'lon':p[0],'radius':100,'search_cutoff':250,'node_snap_tolerance':2,'search_filter':{'exclude_ferry':True,'exclude_steps':mode=='walk' and bool(options.get('avoidStairs'))}} for p in [body['origin'],body['destination']]]
    request={'locations':locations,'costing':costing,'costing_options':{costing:limits},'units':'kilometers','language':'en-US','date_time':{'type':1,'value':at.strftime('%Y-%m-%dT%H:%M')},'alternates':2}
    responses=[actor.route(request)]
    # Time-dependent requests do not return alternates. Additional legal
    # profiles use the SAME departure time and constraints, then ETA-sort.
    profiles=([{'walkway_factor':.55,'sidewalk_factor':.6},{'shortest':True}] if mode=='walk' else [{('use_highway' if mode=='motorcycle' else 'use_highways'):.2,'use_tolls':0},{'shortest':True}])
    for profile in profiles:
        extra=json.loads(json.dumps(request));extra['costing_options'][costing].update(profile)
        try:responses.append(actor.route(extra))
        except RuntimeError:pass
    base_shape=responses[0]['trip']['legs'][0]['shape']
    extra=json.loads(json.dumps(request));extra['linear_cost_factors']=[{'shape':base_shape,'factor':1.5}]
    try:responses.append(actor.route(extra))
    except RuntimeError:pass
    output=[];seen=set()
    for response in responses:
        trip=response.get('trip',{});legs=trip.get('legs',[])
        if not legs:continue
        leg=legs[0];encoded=leg['shape'];coords=decode(encoded);identity=hashlib.sha256(encoded.encode()).hexdigest()[:16]
        if identity in seen:continue
        seen.add(identity);snap=[coords[0],coords[-1]];offsets=[distance(p,q) for p,q in zip([body['origin'],body['destination']],snap)]
        if max(offsets)>150:continue
        trace=actor.trace_attributes({'encoded_polyline':encoded,'shape_match':'edge_walk','costing':costing,'filters':{'action':'include','attributes':['edge.way_id','edge.length','edge.speed','edge.begin_shape_index','edge.end_shape_index','edge.use','edge.road_class','edge.toll','shape']}})
        trace_coords=decode(trace.get('shape',encoded));segments=[];highway=False
        for edge in trace.get('edges',[]):
            way=str(edge.get('way_id',''));tags=attrs.get(way,{})
            begin=edge.get('begin_shape_index',0);end=edge.get('end_shape_index',begin+1);points=trace_coords[begin:end+1]
            if len(points)<2:continue
            length=sum(distance(a,b) for a,b in zip(points,points[1:]));speed=edge.get('speed') or (4.5 if mode=='walk' else 25)
            if edge.get('use')=='ferry':break
            if mode!='walk' and (tags.get('motor_vehicle')=='no' or tags.get('access')=='no' or tags.get('motorcycle' if mode=='motorcycle' else 'motorcar')=='no'):break
            if options.get('avoidStairs') and mode=='walk' and tags.get('highway')=='steps':break
            if options.get('avoidTolls') and edge.get('toll'):break
            if options.get('avoidUnpaved') and tags.get('surface') in {'unpaved','gravel','ground','dirt','sand','mud'}:break
            # NH route relation/ref is a relevance hint, not proof of NHAI
            # operation. The UI states 1033's exact service scope.
            highway=highway or str(tags.get('ref','')).upper().startswith('NH')
            segments.append({'coords':points,'distance':length,'minutes':length/(speed*1000/60),'lit':tags.get('lit','unknown'),'sidewalk':tags.get('sidewalk',tags.get('sidewalk:both','unknown')),'surface':tags.get('surface','unknown'),'kind':tags.get('highway','unknown'),'way':way,'activityKnown':False,'openNearby':False})
        else:
            if not segments:continue
            # Normalize segment times to route ETA, preserving turn delays in
            # passing-time analysis instead of treating every edge as free-flow.
            minutes=trip['summary']['time']/60;raw=sum(s['minutes'] for s in segments) or 1
            for s in segments:s['minutes']*=minutes/raw
            warnings=['Estimated without live traffic or current closure feeds.','Entrance / kerb access is not independently verified.']
            if max(offsets)>20:warnings.append(f'Street approach offsets: {round(offsets[0])} m at start; {round(offsets[1])} m at destination. Off-street approach time is excluded.')
            output.append({'id':identity,'coords':coords,'distance':trip['summary']['length']*1000,'minutes':minutes,'steps':[{'name':' / '.join(m.get('street_names') or []) or m.get('instruction','Continue'),'distance':m.get('length',0)*1000,'instruction':m.get('instruction')} for m in leg.get('maneuvers',[])],'evidence':segments,'snapDistances':offsets,'snapCoords':snap,'highwayAssistance':highway,'warnings':warnings})
    if not output:raise ValueError('No route meets these access constraints within 150 m of both pins. Choose a street approach or relax an avoid option.')
    output.sort(key=lambda r:r['minutes']);return {'engine':'valhalla','liveTraffic':False,'routes':output}

def main():
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8787);args=p.parse_args()
    actor=Actor(ROOT/'work/routing/valhalla.json');attrs=metadata()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass # no journey coordinates in access logs
        def reply(self,status,data):
            raw=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)
        def do_GET(self):self.reply(200,{'engine':'valhalla','ready':True,'modes':list(MODES),'liveTraffic':False}) if self.path=='/health' else self.reply(404,{'error':'Not found'})
        def do_POST(self):
            if self.path!='/route':return self.reply(404,{'error':'Not found'})
            origin=self.headers.get('Origin','')
            if origin and origin not in {'http://127.0.0.1:5173','http://localhost:5173','http://127.0.0.1:4173','http://localhost:4173'}:return self.reply(403,{'error':'Only the local preview may use this service.'})
            try:
                size=int(self.headers.get('Content-Length','0'))
                if not 0<size<=8192:raise ValueError('Invalid route request size.')
                body=json.loads(self.rfile.read(size))
                with LOCK:result=calculate(actor,attrs,body)
                self.reply(200,result)
            except (ValueError,KeyError,RuntimeError) as err:self.reply(400,{'error':str(err)})
    print(f'Local routing ready at http://127.0.0.1:{args.port}',flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
if __name__=='__main__':main()
