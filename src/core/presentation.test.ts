import {test} from 'node:test';
import assert from 'node:assert/strict';
import {afterlightScore,routeChoices,routeColour,routeTitle,ROUTE_COLOURS,scoreOrder} from './presentation.ts';
import type {JourneyRoute} from './types.ts';
function candidate(id:string,minutes:number,points:number,coverage:number){return {id,minutes,score:{lower:points,upper:100,coverage}} as JourneyRoute;}

test('the displayed score uses earned points, without normalizing sparse data',()=>{
  const r=candidate('synthetic',5,10.4,11);assert.equal(afterlightScore(r.score),10);assert.equal(afterlightScore({...r.score,upper:50}),10);
});
test('the highest displayed score is recommended even when coverage is limited',()=>{
  const c=routeChoices([candidate('fast',5,10,11),candidate('higher',8,36,39)]);
  assert.equal(c.recommended,1);assert.equal(c.fastest,0);
  assert.equal(routeColour(1,c),ROUTE_COLOURS.recommended);assert.equal(routeColour(0,c),ROUTE_COLOURS.fastest);
});
test('coverage remains separate and cannot silently override the score ranking',()=>{
  assert.equal(routeChoices([candidate('fast',5,20,80),candidate('higher',8,31,45)]).recommended,1);
});
test('tied displayed scores prefer the faster route and combine identities without duplicate text',()=>{
  const c=routeChoices([candidate('slower',8,30.4,45),candidate('faster',5,29.6,45)]);
  assert.equal(c.recommended,1);assert.equal(c.fastest,1);assert.equal(routeTitle(1,c),'Recommended · Fastest');
  assert.equal(routeColour(1,c),ROUTE_COLOURS.recommended);assert.deepEqual(c.primary,[1]);
});
test('an unordered ETA list still identifies fastest and preserves the highest-score recommendation',()=>{
  const c=routeChoices([candidate('slow',15,70,80),candidate('fast',5,30,40),candidate('middle',10,50,60)]);
  assert.equal(c.fastest,1);assert.equal(c.recommended,0);assert.deepEqual(routeChoices([]).primary,[]);
});
test('cards sort by descending displayed score with stable map identities and faster ties',()=>{
  const routes=[candidate('fast',5,30,40),candidate('best',10,70,80),candidate('same-score',8,30.2,50)];
  assert.deepEqual(scoreOrder(routes),[1,0,2]);assert.deepEqual(routes.map(r=>r.id),['fast','best','same-score']);
  const choices=routeChoices(routes);assert.equal(scoreOrder(routes)[0],choices.recommended);assert.equal(routeColour(0,choices),ROUTE_COLOURS.fastest);
});
