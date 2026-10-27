import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const data = JSON.parse(readFileSync(new URL('../public/data/bandra.json', import.meta.url), 'utf8'));
if (!data.nodes.length || !data.edges.length || !data.places.length) throw new Error('Snapshot is empty.');
for (const edge of data.edges) {
  if (!data.nodes[edge.a] || !data.nodes[edge.b] || edge.length <= 0) throw new Error('Invalid graph edge.');
}
for (const p of data.places) if(p.accessVerified) throw new Error('This snapshot contains no field-verified entrances.');
console.log(JSON.stringify({ area: data.area, fetchedAt: data.fetchedAt, ...data.audit }, null, 2));
const cityPath=new URL('../public/data/mumbai/manifest.json',import.meta.url);
if(existsSync(cityPath)){
  const city=JSON.parse(readFileSync(cityPath,'utf8'));
  const graph=JSON.parse(gunzipSync(readFileSync(new URL('../public/data/mumbai/graph.json.gz',import.meta.url))).toString());
  for(const [a,b,length,wi] of graph.e){if(!graph.n[a]||!graph.n[b]||!graph.w[wi]||length<=0)throw new Error('Invalid city graph edge.');}
  if(graph.n.length!==city.audit.routingNodes||graph.e.length!==city.audit.routingEdges||graph.p.length!==city.audit.places)throw new Error('City manifest and graph counts do not match.');
  if(city.cameras.some(p=>p.type==='guard'||p.status!=='unverified'))throw new Error('Snapshot camera records must not claim independently verified operation or include guards.');
  console.log(JSON.stringify({area:city.area,sourceDataThrough:city.sourceDataThrough,importedAt:city.fetchedAt,...city.audit},null,2));
  if(city.extraPlacesFile){
    const extra=JSON.parse(gunzipSync(readFileSync(new URL('../public/data/mumbai/'+city.extraPlacesFile,import.meta.url))).toString());
    if(new Set(extra.map(p=>p.id)).size!==extra.length)throw new Error('Duplicate facility source IDs.');
    if(extra.length!==city.enrichment.places||extra.filter(p=>p.hours).length!==city.enrichment.withHours)throw new Error('Facility audit counts do not match.');
    for(const p of extra){if(!p.source?.startsWith('https://')&&!p.source?.startsWith('http://'))throw new Error('Facility provenance missing.');if(!p.licence||p.accessVerified)throw new Error('Unlicensed or falsely verified facility.');if(p.provider==='Overture Maps'&&p.hours&&(!p.hoursSource||p.hoursSource===p.source||!p.hoursLicence))throw new Error('Opening hours on an Overture place require independent sourced and licensed evidence.');}
    const provenance=JSON.parse(gunzipSync(readFileSync(new URL('../public/data/mumbai/place-provenance.json.gz',import.meta.url))).toString());
    for(const p of extra.filter(p=>p.provider==='Overture Maps'))if(!provenance[p.id]?.length)throw new Error('Provider source metadata is missing.');
    console.log(JSON.stringify({facilityMerge:city.enrichment},null,2));
  }
}
