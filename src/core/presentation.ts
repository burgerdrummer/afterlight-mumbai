import type { JourneyRoute,SupportScore } from './types';
export const ROUTE_COLOURS={fastest:'#2563eb',recommended:'#00866b',other:'#8754c8'};
export function afterlightScore(score:SupportScore){return Math.max(0,Math.min(100,Math.round(score.lower)));}
export function dataQuality(score:SupportScore){return score.coverage<40?'Limited data':score.coverage<70?'Partial data':'Good coverage';}
/** Return indices so sorting cards never changes route identity or map links. */
export function scoreOrder(routes:JourneyRoute[]){return routes.map((_,i)=>i).sort((a,b)=>afterlightScore(routes[b].score)-afterlightScore(routes[a].score)||routes[a].minutes-routes[b].minutes||routes[b].score.lower-routes[a].score.lower||a-b);}
/** Highest displayed score among the time-eligible candidates. Tied scores
 * prefer the shorter ETA, then the unrounded score. Coverage stays separate. */
export function routeChoices(routes:JourneyRoute[]){
  if(!routes.length)return {fastest:-1,recommended:-1,primary:[] as number[]};
  let fastest=0;routes.forEach((r,i)=>{if(r.minutes<routes[fastest].minutes)fastest=i;});
  let recommended=fastest;
  routes.forEach((r,i)=>{const best=routes[recommended],score=afterlightScore(r.score),bestScore=afterlightScore(best.score);if(score>bestScore||(score===bestScore&&(r.minutes<best.minutes||(r.minutes===best.minutes&&r.score.lower>best.score.lower))))recommended=i;});
  return {fastest,recommended,primary:[...new Set([fastest,recommended])]};
}
function alternativeNumber(index:number,choices:ReturnType<typeof routeChoices>){return index+1-choices.primary.filter(i=>i<index).length;}
export function routeColour(index:number,choices:ReturnType<typeof routeChoices>){return index===choices.recommended?ROUTE_COLOURS.recommended:index===choices.fastest?ROUTE_COLOURS.fastest:alternativeNumber(index,choices)%2?ROUTE_COLOURS.other:'#c57616';}
export function routeTitle(index:number,choices:ReturnType<typeof routeChoices>){return index===choices.recommended?(index===choices.fastest?'Recommended · Fastest':'Recommended'):index===choices.fastest?'Fastest':`Alternative ${alternativeNumber(index,choices)}`;}
export function recommendationReason(route:JourneyRoute,baseline:JourneyRoute){
  if(route.id===baseline.id)return 'Highest score and the quickest option. Tied scores favour the shorter journey.';
  return `Highest Afterlight Score within your extra-time limit · ${extraMinutes(route.minutes-baseline.minutes)} longer.`;
}
function extraMinutes(minutes:number){return minutes<1?'less than 1 min':`${Math.ceil(minutes)} min`;}
