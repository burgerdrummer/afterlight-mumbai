import type {FeatureCollection,LineString} from 'geojson';
import type {SegmentEvidence} from './types';

export type LightingState='lit'|'unlit'|'unknown';
export const LIGHTING_LABELS:Record<LightingState,string>={lit:'Tagged lit',unlit:'Tagged unlit',unknown:'Unknown'};
export const LIGHTING_COLOURS:Record<LightingState,string>={lit:'#52525b',unlit:'#18181b',unknown:'#9ca3af'};
export function lightingState(value:string|undefined|null):LightingState{
  if(['yes','24/7','automatic','sunset-sunrise'].includes(value||''))return 'lit';
  return value==='no'?'unlit':'unknown';
}
type LightingProperties={state:LightingState;tags:string;wayId:string};
export function lightingOverlay(segments:SegmentEvidence[]){
  const collection:FeatureCollection<LineString,LightingProperties>={type:'FeatureCollection',features:[]};
  const distance:Record<LightingState,number>={lit:0,unlit:0,unknown:0};
  for(const segment of segments){
    if(segment.coords.length<2||!Number.isFinite(segment.distance)||segment.distance<=0)continue;
    const state=lightingState(segment.lit),tag=segment.lit||'not recorded',wayId=/^(?:way\/)?\d+$/.test(segment.way||'')?segment.way!.replace('way/',''):'';
    distance[state]+=segment.distance;
    const previous=collection.features.at(-1),end=previous?.geometry.coordinates.at(-1),start=segment.coords[0];
    if(previous&&previous.properties.state===state&&end?.[0]===start[0]&&end?.[1]===start[1]){
      previous.geometry.coordinates.push(...segment.coords.slice(1).map(p=>[...p]));
      const tags=new Set(previous.properties.tags.split(' / '));tags.add(tag);previous.properties.tags=[...tags].join(' / ');
      if(previous.properties.wayId!==wayId)previous.properties.wayId='';
    }else collection.features.push({type:'Feature',properties:{state,tags:tag,wayId},geometry:{type:'LineString',coordinates:segment.coords.map(p=>[...p])}});
  }
  const total=distance.lit+distance.unlit+distance.unknown;
  return {collection,percent:{lit:total?distance.lit/total*100:0,unlit:total?distance.unlit/total*100:0,unknown:total?distance.unknown/total*100:0}};
}
