"""Create a local, multimodal Valhalla graph from a reusable regional OSM PBF.

Keeps complete road ways and their turn restrictions in a padded Mumbai area.
Raw data and generated binaries stay in ignored work/routing/.
"""
import argparse, json, subprocess, sys, os
from pathlib import Path
import osmium
from valhalla import get_config

ROOT = Path(__file__).resolve().parents[1]
BOX = (72.70, 18.84, 73.10, 19.37)

def main():
    p = argparse.ArgumentParser(); p.add_argument('--pbf', type=Path, required=True)
    args = p.parse_args(); out = ROOT / 'work/routing'; out.mkdir(parents=True, exist_ok=True)
    signature=[args.pbf.stat().st_size,args.pbf.stat().st_mtime_ns]
    signature_file=out/'input.json'
    if signature_file.exists() and json.loads(signature_file.read_text())!=signature:raise RuntimeError('The regional input changed. Use a new work/routing directory (move the previous one aside) to rebuild without mixing snapshots.')
    clipped = out / 'mumbai.osm.pbf'
    if not clipped.exists():
        class Select(osmium.SimpleHandler):
            def __init__(self): super().__init__(); self.inside=set(); self.ways=set(); self.nodes=set(); self.relations=set()
            def node(self,n):
                if n.location.valid() and BOX[0]<=n.location.lon<=BOX[2] and BOX[1]<=n.location.lat<=BOX[3]: self.inside.add(n.id)
            def way(self,w):
                if ('highway' in w.tags or w.tags.get('route')=='ferry') and any(n.ref in self.inside for n in w.nodes):
                    self.ways.add(w.id); self.nodes.update(n.ref for n in w.nodes)
            def relation(self,r):
                if r.tags.get('type')=='restriction' and all(m.ref in self.ways if m.type=='w' else m.ref in self.nodes if m.type=='n' else False for m in r.members):self.relations.add(r.id)
        select=Select(); print('Selecting complete roads and restrictions...',flush=True); select.apply_file(str(args.pbf))
        writer=osmium.SimpleWriter(str(clipped))
        class Write(osmium.SimpleHandler):
            def node(self,n):
                if n.id in select.nodes:writer.add_node(n)
            def way(self,w):
                if w.id in select.ways:writer.add_way(w)
            def relation(self,r):
                if r.id in select.relations:writer.add_relation(r)
        Write().apply_file(str(args.pbf));writer.close()
        print(f'Wrote {len(select.ways)} ways, {len(select.relations)} turn restrictions.',flush=True)
    signature_file.write_text(json.dumps(signature))
    (out/'tiles-india').mkdir(parents=True,exist_ok=True)
    config=get_config(tile_dir=str(out/'tiles-india'),tile_extract='')
    config['mjolnir'].update(tile_dir=str(out/'tiles-india'),tile_extract='',concurrency=2)
    from regional_context import configure
    configure(out,config)
    config['service_limits']['pedestrian']['max_distance']=150000
    config['service_limits']['max_alternates']=3
    config['service_limits']['allow_hard_exclusions']=True
    config_path=out/'valhalla.json';config_path.write_text(json.dumps(config,indent=2))
    ready=json.loads((out/'ready.json').read_text()) if (out/'ready.json').exists() else {}
    if ready.get('profile')!='india-1':
        from valhalla._scripts import PYVALHALLA_BIN_DIR,WIN_LIB_DIR
        environment=dict(os.environ,PATH=str(PYVALHALLA_BIN_DIR)+os.pathsep+WIN_LIB_DIR)
        subprocess.run([sys.executable,'-m','valhalla','valhalla_build_tiles','-c',str(config_path),str(clipped)],check=True,env=environment)
        (out/'ready.json').write_text(json.dumps({'source':str(args.pbf.name),'bbox':BOX,'liveTraffic':False,'engine':'Valhalla','licence':'ODbL-1.0','profile':'india-1'}))
    print('Local graph ready:',config_path,flush=True)

if __name__=='__main__':main()
