import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routingConfiguration} from './runtime.ts';
import {browserJourneys} from './browser-routing.ts';
import {PilotRouter} from './router.ts';
import {JourneyAnalyzer} from './journey.ts';
import type {Snapshot} from './types.ts';

test('public static hosts use browser walking while loopback retains the full local service',()=>{
  assert.equal(routingConfiguration('example.chatgpt.site').browser,true);
  assert.equal(routingConfiguration('127.0.0.1').browser,false);
  assert.equal(routingConfiguration('localhost').browser,false);
  assert.equal(routingConfiguration('example.chatgpt.site','https://routing.example.org').browser,false);
  assert.equal(routingConfiguration('127.0.0.1','','browser').browser,true);
});
const data={nodes:[[72.82,19.05],[72.8205,19.0505],[72.821,19.05]],places:[],cameras:[],edges:[
  {a:0,b:2,length:105,kind:'steps',name:'Synthetic steps',way:'1',lit:'unknown',sidewalk:'unknown',surface:'paved'},
  {a:0,b:1,length:80,kind:'footway',name:'Synthetic path',way:'2',lit:'yes',sidewalk:'yes',surface:'paved'},
  {a:1,b:2,length:80,kind:'footway',name:'Synthetic path',way:'3',lit:'yes',sidewalk:'yes',surface:'paved'},
]} as unknown as Snapshot;
test('browser walking uses graph edges, publishes the common score and respects avoid stairs',()=>{
  const router=new PilotRouter(data),analyzer=new JourneyAnalyzer([]),at=new Date('2026-10-27T15:30:00Z');
  const direct=browserJourneys(router,analyzer,data.nodes[0],data.nodes[2],at,5,{avoidStairs:false,avoidTolls:false,avoidUnpaved:false});
  assert.ok(direct.some(r=>r.distance===105));assert.equal(direct[0].engine,'bundled-walk');assert.equal(direct[0].mode,'walk');
  const avoiding=browserJourneys(router,analyzer,data.nodes[0],data.nodes[2],at,5,{avoidStairs:true,avoidTolls:false,avoidUnpaved:false});
  assert.ok(avoiding.every(r=>r.distance===160));assert.deepEqual(avoiding[0].coords,data.nodes);assert.equal(avoiding[0].score.factors.length,3);
});
test('browser walking rejects remote approaches rather than inventing a connecting path',()=>{
  assert.throws(()=>browserJourneys(new PilotRouter(data),new JourneyAnalyzer([]),[72.9,19.2],data.nodes[2],new Date(),5,{avoidStairs:false,avoidTolls:false,avoidUnpaved:false}),/120 m/);
});
