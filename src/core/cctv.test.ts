import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCameraPoints, parseCameraGeoJson } from './cctv.ts';
import type { Snapshot } from './types.ts';
const bounds:Snapshot['bbox']=[72.77,18.89,72.99,19.28];
const fixture=()=>({type:'FeatureCollection',features:[{type:'Feature',id:'unit-test-only',geometry:{type:'Point',coordinates:[72.83,19.05]},properties:{name:'Test fixture, not a real camera',source:'https://example.org/test-fixture',licence:'CC0-1.0'}}]});
test('camera import retains source and licence and defaults to unverified',()=>{const points=parseCameraGeoJson(fixture(),bounds);assert.equal(points[0].status,'unverified');assert.equal(points[0].source,'https://example.org/test-fixture');assert.equal(points[0].licence,'CC0-1.0');});
test('invalid camera coordinates and missing provenance are rejected',()=>{
  const outside=fixture();outside.features[0].geometry.coordinates=[19.05,72.83];assert.throws(()=>parseCameraGeoJson(outside,bounds),/coordinates/);
  const unsafe=fixture();unsafe.features[0].properties.source='javascript:alert(1)';assert.throws(()=>parseCameraGeoJson(unsafe,bounds),/source URL/);
  const noLicence=fixture();noLicence.features[0].properties.licence='';assert.throws(()=>parseCameraGeoJson(noLicence,bounds),/licence/);
});
test('duplicate imported IDs cannot silently overwrite each other',()=>{const f=fixture();f.features.push(f.features[0]);assert.throws(()=>parseCameraGeoJson(f,bounds),/duplicate/);});
test('reimporting a camera source at the same coordinates updates rather than double-counts',()=>{const first=parseCameraGeoJson(fixture(),bounds),updated={...first[0],id:'another-local-id',status:'reported_inactive' as const};const merged=mergeCameraPoints(first,[updated]);assert.equal(merged.length,1);assert.equal(merged[0].status,'reported_inactive');});
