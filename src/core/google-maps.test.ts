import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleMapsUrl, googleMapsWaypoints } from './google-maps.ts';
import type { Coord } from './types.ts';
const coords:Coord[]=[[72.82,19.05],[72.823,19.05],[72.823,19.054],[72.827,19.054],[72.827,19.06],[72.83,19.06]];
test('Google handoff uses walking, correct coordinate order and the selected endpoints',()=>{
  const url=new URL(googleMapsUrl(coords)!);
  assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('api'),'1');assert.equal(url.searchParams.get('travelmode'),'walking');
  assert.equal(url.searchParams.get('origin'),'19.050000,72.820000');assert.equal(url.searchParams.get('destination'),'19.060000,72.830000');
  assert.ok(url.href.length<2048);
});
test('waypoints respect the three-point mobile limit and route ordering',()=>{
  const waypoints=googleMapsWaypoints(coords);assert.ok(waypoints.length>0&&waypoints.length<=3);
  const indices=waypoints.map(p=>coords.indexOf(p));assert.deepEqual(indices,[...indices].sort((a,b)=>a-b));assert.ok(!waypoints.includes(coords[0])&&!waypoints.includes(coords.at(-1)!));
});
test('invalid and empty geometries cannot produce a misleading handoff',()=>{
  assert.equal(googleMapsUrl([]),null);assert.equal(googleMapsUrl([[NaN,19],[72,20]]),null);assert.equal(googleMapsUrl([[190,20],[72,20]]),null);
});
