"""India/Maharashtra routing configuration for a Mumbai-only graph.

These enclosing rectangles are CONFIGURATION MASKS, not administrative boundary
data. They are never displayed/exported as real boundaries or used as roads.
They assign country defaults, left-side traffic and Asia/Kolkata to local tiles.
The displayed city boundaries remain the original OSM district polygons.
"""
import ctypes, ctypes.util, json, os, subprocess, sys
from pathlib import Path
import osmium
from valhalla._scripts import PYVALHALLA_BIN_DIR,WIN_LIB_DIR

def configure(out,config):
    mask=out/'regional-context.osm.pbf'
    if not mask.exists():
        w=osmium.SimpleWriter(str(mask))
        for i,location in enumerate([(72,18),(74,18),(74,21),(72,21)],1):w.add_node(osmium.osm.mutable.Node(id=i,location=location))
        w.add_way(osmium.osm.mutable.Way(id=1,nodes=[1,2,3,4,1]))
        for i,name,level,extra in [(1,'India','2',{'ISO3166-1:alpha2':'IN','ISO3166-1':'IN','driving_side':'left'}),(2,'Maharashtra','4',{'ISO3166-2':'IN-MH','driving_side':'left'})]:
            w.add_relation(osmium.osm.mutable.Relation(id=i,members=[('w',1,'outer')],tags={'type':'boundary','boundary':'administrative','admin_level':level,'name':name,'name:en':name,**extra}))
        w.close()
    config['mjolnir']['admin']=str(out/'india-context.sqlite')
    config['mjolnir']['timezone']=str(out/'india-timezone.sqlite')
    config['mjolnir']['data_processing']['use_admin_db']=True
    cp=out/'context-build.json';cp.write_text(json.dumps(config))
    if not Path(config['mjolnir']['admin']).exists():
        environment=dict(os.environ,PATH=str(PYVALHALLA_BIN_DIR)+os.pathsep+WIN_LIB_DIR)
        subprocess.run([sys.executable,'-m','valhalla','valhalla_build_admins','-c',str(cp),str(mask)],env=environment,check=True)
    if not Path(config['mjolnir']['timezone']).exists():
        libs=Path(PYVALHALLA_BIN_DIR).parent.parent/'pyvalhalla.libs'
        def library(prefix):
            found=list(libs.glob(prefix+'*.dll'))+list(libs.glob('lib'+prefix+'*.so*'))+list(libs.glob('lib'+prefix+'*.dylib'))
            return str(found[0]) if found else ctypes.util.find_library(prefix)
        sql=ctypes.CDLL(library('sqlite3'));spatial=ctypes.CDLL(library('spatialite'))
        sql.sqlite3_open.argtypes=[ctypes.c_char_p,ctypes.POINTER(ctypes.c_void_p)];sql.sqlite3_open.restype=ctypes.c_int
        sql.sqlite3_exec.argtypes=[ctypes.c_void_p,ctypes.c_char_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.POINTER(ctypes.c_char_p)];sql.sqlite3_exec.restype=ctypes.c_int
        sql.sqlite3_close.argtypes=[ctypes.c_void_p]
        spatial.spatialite_alloc_connection.restype=ctypes.c_void_p
        spatial.spatialite_init_ex.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_int]
        spatial.spatialite_cleanup_ex.argtypes=[ctypes.c_void_p]
        db=ctypes.c_void_p();status=sql.sqlite3_open(config['mjolnir']['timezone'].encode(),ctypes.byref(db))
        if status:raise RuntimeError('Cannot create local timezone configuration.')
        cache=spatial.spatialite_alloc_connection();spatial.spatialite_init_ex(db,cache,0)
        command="""SELECT InitSpatialMetaData(1);
        CREATE TABLE tz_world (TZID TEXT NOT NULL);
        SELECT AddGeometryColumn('tz_world','geom',4326,'MULTIPOLYGON',2);
        INSERT INTO tz_world(TZID,geom) VALUES ('Asia/Kolkata',GeomFromText('MULTIPOLYGON(((72 18,74 18,74 21,72 21,72 18)))',4326));
        SELECT CreateSpatialIndex('tz_world','geom');"""
        err=ctypes.c_char_p();status=sql.sqlite3_exec(db,command.encode(),None,None,ctypes.byref(err))
        sql.sqlite3_close(db);spatial.spatialite_cleanup_ex(cache)
        if status:raise RuntimeError('Timezone database: '+str(err.value))
