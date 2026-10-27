import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PilotRouter } from './router.ts';
import type { Snapshot } from './types.ts';

const data=JSON.parse(readFileSync(new URL('../../public/data/bandra.json',import.meta.url),'utf8')) as Snapshot;
const router=new PilotRouter(data);
const departure=new Date('2026-10-27T15:30:00Z');

test('real pilot routes use connected graph edges and obey the detour budget',()=>{
  const routes=router.routes(data.landmarks[0].node,data.landmarks[1].node,departure,5);
  assert.ok(routes.length>=2);
  for(const r of routes){
    assert.ok(r.extraMinutes<=5.01);
    assert.equal(r.nodes.length,r.edges.length+1);
    r.edges.forEach((id,i)=>{const e=data.edges[id];assert.ok((e.a===r.nodes[i]&&e.b===r.nodes[i+1])||(e.b===r.nodes[i]&&e.a===r.nodes[i+1]));});
    assert.equal(new Set(r.nodes).size,r.nodes.length,'route must not contain a loop');
    assert.ok(r.lightingYes<=r.lightingKnown+.001);
  }
});
test('zero detour returns the shortest journey without inventing alternatives',()=>{
  const routes=router.routes(data.landmarks[0].node,data.landmarks[1].node,departure,0);
  assert.equal(routes.length,1);
  assert.equal(routes[0].extraMinutes,0);
});
test('every named pilot pair is connected and invalid endpoints are rejected',()=>{
  for(const l of data.landmarks.slice(1)) assert.ok(router.routes(data.landmarks[0].node,l.node,departure,10).length);
  assert.throws(()=>router.routes(0,0,departure,10),/different/);
  assert.throws(()=>router.routes(-1,5,departure,10),/inside/);
});
test('unknown hours never count as open and help access stays unverified',()=>{
  const r=router.routes(data.landmarks[0].node,data.landmarks[1].node,departure,10)[0];
  assert.equal(r.openCount,r.places.filter(p=>p.state==='open'&&p.hours).length);
  assert.ok(r.places.every(p=>!p.accessVerified));
  assert.ok(r.places.filter(p=>!p.hours).every(p=>p.state==='unknown'));
});
test('places are evaluated at passing time, including after closing',()=>{
  const fixture=structuredClone(data);
  fixture.nodes=[[72.82,19.05],[72.821,19.05],[72.822,19.05]];
  fixture.edges=[{a:0,b:1,length:750,way:'1',name:'Test street',kind:'residential',lit:'unknown',sidewalk:'unknown',surface:'unknown'},{a:1,b:2,length:750,way:'2',name:'Test street',kind:'residential',lit:'unknown',sidewalk:'unknown',surface:'unknown'}];
  fixture.places=[{id:'test',name:'Closing shop',category:'shop',coord:[72.822,19.05],hours:'Mo-Su 08:00-21:05',checked:null,updated:null,help:false,accessVerified:false}];
  const r=new PilotRouter(fixture).routes(0,2,departure,0)[0];
  assert.equal(r.places[0].state,'closed');
  assert.equal(r.openCount,0);
  assert.ok(r.lightingKnown===0&&r.lightingYes===0);
});
test('disconnected graph points produce an error, not a straight connector',()=>{
  const fixture=structuredClone(data);fixture.nodes.push([72.825,19.05]);
  assert.throws(()=>new PilotRouter(fixture).routes(0,fixture.nodes.length-1,departure,10),/not connected/);
});
