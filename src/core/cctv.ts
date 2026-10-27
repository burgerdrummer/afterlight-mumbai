import type { CameraPoint, Snapshot } from './types';
/** Imported records are local overlays. Their provenance is required; no feed
 * credentials, streams, or claim of independently verified operation is used. */
export function parseCameraGeoJson(value:unknown,bbox:Snapshot['bbox']):CameraPoint[]{
  const collection=value as {type?:string;features?:unknown[]};
  if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))throw new Error('Choose a GeoJSON FeatureCollection of CCTV point records.');
  if(!collection.features.length||collection.features.length>5000)throw new Error('Import between 1 and 5,000 camera points at a time.');
  const ids=new Set<string>();
  return collection.features.map((raw,index)=>{
    const f=raw as {id?:string|number;geometry?:{type?:string;coordinates?:number[]};properties?:Record<string,unknown>};
    const c=f.geometry?.coordinates,p=f.properties||{};
    if(f.geometry?.type!=='Point'||!c||c.length!==2||!c.every(Number.isFinite)||c[0]<bbox[0]||c[0]>bbox[2]||c[1]<bbox[1]||c[1]>bbox[3])throw new Error(`Point ${index+1} must have valid [longitude, latitude] coordinates inside the imported Mumbai area.`);
    const source=String(p.source||'').trim(),licence=String(p.licence||p.license||'').trim();
    try{if(!['http:','https:'].includes(new URL(source).protocol))throw new Error();}catch{throw new Error(`Point ${index+1} needs an HTTP(S) source URL.`);}
    if(!licence||licence.length>120)throw new Error(`Point ${index+1} needs a reuse licence.`);
    const updated=typeof p.updated==='string'?p.updated:null;
    if(updated&&!Number.isFinite(Date.parse(updated)))throw new Error(`Point ${index+1} has an invalid updated date.`);
    const id='local-'+(f.id??`${c[0]}-${c[1]}`);if(ids.has(id))throw new Error('The import contains duplicate camera IDs.');ids.add(id);
    return {id,name:String(p.name||'Imported CCTV point').slice(0,150),coord:[c[0],c[1]],operator:typeof p.operator==='string'?p.operator.slice(0,150):null,type:String(p.type||'camera').slice(0,50),checked:typeof p.checked==='string'?p.checked:null,updated,status:p.status==='reported_active'||p.status==='reported_inactive'?p.status:'unverified',source,licence};
  });
}
export function mergeCameraPoints(existing:CameraPoint[],incoming:CameraPoint[]):CameraPoint[]{
  const key=(p:CameraPoint)=>`${p.source}|${p.coord[0].toFixed(6)},${p.coord[1].toFixed(6)}`;
  const merged=new Map(existing.map(p=>[key(p),p]));incoming.forEach(p=>merged.set(key(p),p));return [...merged.values()];
}
