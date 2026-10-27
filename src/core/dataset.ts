import type { Snapshot, Coord, Place } from './types';
export type CompactGraph={v:2;n:Coord[];e:[number,number,number,number][];w:{id:string;name:string;kind:string;lit:string;sidewalk:string;surface:string}[];p:Place[];c:number[]};
export async function readJsonResponse(response:Response):Promise<unknown>{
  if(!response.ok)throw new Error('Could not load local map data.');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes[0]===31&&bytes[1]===139){
    if(typeof DecompressionStream==='undefined')throw new Error('City data requires a browser that supports gzip decompression. Please update your browser.');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).json();
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function expandGraph(metadata:Snapshot,compact:CompactGraph):Snapshot{
  if(compact.v!==2||!compact.n.length||!compact.e.length)throw new Error('Invalid city walking network.');
  return {...metadata,nodes:compact.n,places:compact.p,components:compact.c,edges:compact.e.map(([a,b,length,way])=>{const w=compact.w[way];if(!w||!compact.n[a]||!compact.n[b])throw new Error('Incomplete city walking network.');return {a,b,length,way:w.id,name:w.name,kind:w.kind,lit:w.lit,sidewalk:w.sidewalk,surface:w.surface};})};
}
