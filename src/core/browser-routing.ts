import type {Coord,RoutingOptions} from './types';
import {PilotRouter} from './router';
import {JourneyAnalyzer,chooseJourneys} from './journey';

/** Walking only: never apply the pedestrian graph to a motor vehicle. */
export function browserJourneys(router:PilotRouter,analyzer:JourneyAnalyzer,origin:Coord,destination:Coord,departure:Date,detour:number,options:RoutingOptions){
  router.setOptions(options);
  const start=router.nearest(origin),end=router.nearest(destination);
  if(start.node<0||end.node<0||start.distance>120||end.distance>120)throw new Error('No mapped walking street approach within 120 m. Choose a point closer to a mapped street.');
  const candidates=router.routes(start.node,end.node,departure,detour).map(path=>{
    const evidence=path.edges.map((index,i)=>{const edge=router.data.edges[index];return {coords:[router.data.nodes[path.nodes[i]],router.data.nodes[path.nodes[i+1]]],distance:edge.length,minutes:router.edgeMinutes(index),lit:edge.lit,sidewalk:edge.sidewalk,surface:edge.surface,kind:edge.kind,way:edge.way,activityKnown:false,openNearby:false};});
    const analyzed=analyzer.analyze({id:'browser-'+path.id,coords:path.coords,distance:path.distance,minutes:path.minutes,steps:path.steps||[],evidence,snapCoords:[router.data.nodes[start.node],router.data.nodes[end.node]],snapDistances:[start.distance,end.distance],highwayAssistance:false,warnings:['Bundled walking snapshot; current access and closures are unverified.']},'walk',departure);
    return {...analyzed,engine:'bundled-walk' as const};
  });
  return chooseJourneys(candidates,detour);
}
