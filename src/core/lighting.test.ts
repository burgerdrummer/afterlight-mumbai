import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lightingState,lightingOverlay} from './lighting.ts';
import type {SegmentEvidence} from './types.ts';
test('unknown lighting never becomes explicitly unlit',()=>{
  for(const value of [undefined,null,'','unknown','limited','Mo-Fr 18:00-23:00'])assert.equal(lightingState(value),'unknown');
  for(const value of ['yes','24/7','automatic','sunset-sunrise'])assert.equal(lightingState(value),'lit');
  assert.equal(lightingState('no'),'unlit');
});
test('lighting features preserve geometry, separate unknown gaps and weight percentages by distance',()=>{
  const segments:SegmentEvidence[]=[
    {coords:[[72.8,19],[72.801,19]],distance:100,lit:'yes',minutes:1,activityKnown:false,openNearby:false},
    {coords:[[72.801,19],[72.802,19]],distance:100,lit:'automatic',minutes:1,activityKnown:false,openNearby:false},
    {coords:[[72.802,19],[72.803,19]],distance:50,lit:'unknown',minutes:1,activityKnown:false,openNearby:false},
    {coords:[[72.803,19],[72.804,19]],distance:150,lit:'no',minutes:1,activityKnown:false,openNearby:false},
  ];
  const before=JSON.stringify(segments),result=lightingOverlay(segments);
  assert.equal(result.collection.features.length,3);assert.deepEqual(result.percent,{lit:50,unlit:37.5,unknown:12.5});
  assert.deepEqual(result.collection.features[0].geometry.coordinates,[[72.8,19],[72.801,19],[72.802,19]]);
  assert.equal(result.collection.features[0].properties.tags,'yes / automatic');assert.equal(JSON.stringify(segments),before);
});
test('separate pieces of route are never joined across a geometry gap',()=>{
  const segment:SegmentEvidence={coords:[[72.8,19],[72.801,19]],distance:100,lit:'yes',minutes:1,activityKnown:false,openNearby:false};
  const result=lightingOverlay([segment,{...segment,coords:[[72.81,19],[72.811,19]]}]);
  assert.equal(result.collection.features.length,2);assert.equal(lightingOverlay([]).collection.features.length,0);
});
