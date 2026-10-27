import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expandGraph, type CompactGraph } from './dataset.ts';
import { PilotRouter } from './router.ts';
import type { Snapshot } from './types.ts';
const path=new URL('../../public/data/mumbai/manifest.json',import.meta.url);
test('citywide extract supports walks beyond Bandra without fabricated connections',{skip:!existsSync(path)},()=>{
  const metadata=JSON.parse(readFileSync(path,'utf8')) as Snapshot;
  const compact=JSON.parse(gunzipSync(readFileSync(new URL('../../public/data/mumbai/graph.json.gz',import.meta.url))).toString()) as CompactGraph;
  const data=expandGraph(metadata,compact),router=new PilotRouter(data);
  assert.ok(data.nodes.length>100000);assert.ok(data.audit.streetKm>1000);
  assert.equal(data.boundaryNames?.length,2);assert.ok((data.cameras||[]).every(c=>c.type!=='guard'&&c.status==='unverified'));
  const find=(name:string)=>{const l=data.landmarks.find(l=>l.name===name);assert.ok(l,`Missing landmark: ${name}`);return l;};
  for(const [start,end] of [['Gateway of India','Churchgate station'],['Andheri station','Borivali station'],['Ghatkopar station','Mulund station']]){
    const a=find(start),b=find(end);const r=router.routes(a.node,b.node,new Date('2026-10-27T15:30:00Z'),5)[0];
    assert.ok(r.distance>100);assert.equal(r.nodes.length,r.edges.length+1);
    for(let i=0;i<r.edges.length;i++){const e=data.edges[r.edges[i]];assert.ok((e.a===r.nodes[i]&&e.b===r.nodes[i+1])||(e.b===r.nodes[i]&&e.a===r.nodes[i+1]));}
  }
});
