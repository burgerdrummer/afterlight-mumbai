import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JourneyAnalyzer,chooseJourneys,facilityKind} from './journey.ts';
import {DAY_WEIGHTS,NIGHT_WEIGHTS,daylight,scoreRoute} from './scoring.ts';
import type {EngineRoute,Place,SegmentEvidence} from './types.ts';
const night=new Date('2026-10-27T15:30:00Z');
const segment:SegmentEvidence={coords:[[72.82,19.05],[72.821,19.05]],distance:105,minutes:2,lit:'unknown',kind:'residential',surface:'unknown',sidewalk:'unknown',activityKnown:false,openNearby:false};
const route:EngineRoute={id:'fixture',coords:segment.coords,distance:105,minutes:2,steps:[],evidence:[segment],snapCoords:[segment.coords[0],segment.coords[1]],snapDistances:[0,0],highwayAssistance:false,warnings:[]};
test('unknown evidence remains a full unresolved range and never earns points',()=>{
  for(const mode of ['walk','motorcycle','car'] as const){const s=scoreRoute([segment],mode,night);assert.equal(s.lower,0);assert.equal(s.upper,100);assert.equal(s.coverage,0);}
});
test('known unlit resolves uncertainty without treating unknown as unlit',()=>{
  const unknown=scoreRoute([segment],'walk',night),unlit=scoreRoute([{...segment,lit:'no'}],'walk',night),lit=scoreRoute([{...segment,lit:'yes'}],'walk',night);
  assert.equal(unknown.coverage,0);assert.equal(unlit.coverage,35);assert.equal(unlit.lower,0);assert.equal(unlit.upper,65);assert.equal(lit.lower,35);assert.equal(lit.upper,100);
});
test('mode weights differ, remain explicit and do not redistribute unknown factors',()=>{
  for(const presets of [NIGHT_WEIGHTS,DAY_WEIGHTS])for(const weights of Object.values(presets))assert.equal(weights.reduce((a,b)=>a+b,0),100);
  assert.equal(scoreRoute([{...segment,lit:'yes'}],'motorcycle',night).lower,25);
  assert.equal(scoreRoute([{...segment,lit:'yes'}],'car',night).lower,20);
  assert.ok(daylight(segment.coords[0],new Date('2026-10-27T06:30:00Z')));assert.ok(!daylight(segment.coords[0],night));
  assert.equal(scoreRoute([{...segment,lit:'yes'}],'walk',new Date('2026-10-27T06:30:00Z')).lower,0);
});
test('nearby shops and medical facilities require schedules; proximity never earns assistance credit',()=>{
  const p:Place={id:'test-only',name:'Synthetic clinic fixture',category:'clinic',coord:[72.8205,19.05],hours:null,checked:null,updated:null,help:true,accessVerified:false};
  const unknown=new JourneyAnalyzer([p]).analyze(route,'walk',night);assert.equal(unknown.openCount,0);assert.equal(unknown.score.coverage,0);assert.equal(unknown.score.factors.some(f=>f.key==='assistance'),false);
  const open=new JourneyAnalyzer([{...p,hours:'24/7'}]).analyze(route,'walk',night);assert.equal(open.openCount,1);assert.ok(open.score.lower>unknown.score.lower);assert.equal(open.score.factors.some(f=>f.key==='assistance'),false);assert.equal(open.places[0].reachable,false);
  assert.match(facilityKind({...p,category:'hospital'}),/unconfirmed/);
});
test('camera density and unknown-hours POIs cannot inflate support',()=>{
  const p:Place={id:'test-only',name:'Synthetic unknown fixture',category:'shop',coord:[72.8205,19.05],hours:null,checked:null,updated:null,help:false,accessVerified:false};
  const a=new JourneyAnalyzer([]).analyze(route,'car',night),b=new JourneyAnalyzer([p],[{id:'camera-test-only',name:'Synthetic fixture',coord:p.coord,type:'camera',status:'unverified',source:'https://example.org/test',licence:'CC0'}]).analyze(route,'car',night);
  assert.deepEqual(a.score,b.score);assert.ok(b.cameras?.length);assert.equal(b.nearbyCount,1);
});
test('open state follows passing time rather than departure',()=>{
  const p:Place={id:'test-only',name:'Closing fixture',category:'shop',coord:[72.821,19.05],hours:'Mo-Su 08:00-21:01',checked:null,updated:null,help:false,accessVerified:false};
  const r=new JourneyAnalyzer([p]).analyze({...route,minutes:10,evidence:[{...segment,minutes:10}]},'walk',night);
  assert.equal(r.places[0].state,'closed');assert.equal(r.openCount,0);
});
test('fastest candidate is based on ETA, detour is a hard cap, and support does not override ETA',()=>{
  const analyzer=new JourneyAnalyzer([]),slow=analyzer.analyze({...route,id:'slow',minutes:12},'walk',night),fast=analyzer.analyze({...route,id:'fast',minutes:5},'walk',night),medium=analyzer.analyze({...route,id:'medium',minutes:8},'walk',night);
  slow.score.lower=90;medium.score.lower=30;const chosen=chooseJourneys([slow,medium,fast],4);
  assert.deepEqual(chosen.map(r=>r.id),['fast','medium']);assert.equal(chosen[0].baseline,true);assert.equal(chosen[1].extraMinutes,3);assert.equal(chosen[1].highestSupport,true);
});


test('unsupported assistance and current-condition factors are excluded citywide',()=>{
  for(const mode of ['walk','motorcycle','car'] as const){
    const s=scoreRoute([{...segment,helpKnown:true,helpQuality:1}],mode,night);
    assert.deepEqual(s.factors.map(f=>f.key),['infrastructure','lighting','activity']);
    assert.equal(s.lower,0);assert.equal(s.factors.reduce((n,f)=>n+f.weight,0),100);
  }
});
test('complete favourable observations can earn the full supported score in every mode and preset',()=>{
  const observed={...segment,sidewalk:'yes',surface:'asphalt',lit:'yes',activityKnown:true,openNearby:true};
  for(const mode of ['walk','motorcycle','car'] as const)for(const at of [night,new Date('2026-10-27T06:30:00Z')]){
    const s=scoreRoute([observed],mode,at);assert.equal(s.lower,100);assert.equal(s.coverage,100);
  }
});
