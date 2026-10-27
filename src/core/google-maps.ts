import { meters, pointSegmentDistance } from './geo';
import type { Coord,TravelMode } from './types';
/** Google supports at most 3 waypoints on mobile browsers. They guide its own
 * calculation; Maps URLs cannot import our exact polyline or scoring.
 */
export function googleMapsWaypoints(coords:Coord[]):Coord[]{
  if(coords.length<3)return [];
  const chosen=[0,coords.length-1];
  for(let count=0;count<3;count++){
    let best=-1,bestDeviation=-1;
    for(let s=0;s<chosen.length-1;s++)for(let i=chosen[s]+1;i<chosen[s+1];i++){
      if(meters(coords[i],coords[0])<50||meters(coords[i],coords[coords.length-1])<50)continue;
      if(chosen.some(j=>meters(coords[i],coords[j])<50))continue;
      const deviation=pointSegmentDistance(coords[i],coords[chosen[s]],coords[chosen[s+1]]).distance;
      if(deviation>bestDeviation){best=i;bestDeviation=deviation;}
    }
    if(best<0)break;
    chosen.push(best);chosen.sort((a,b)=>a-b);
  }
  return chosen.slice(1,-1).map(i=>coords[i]);
}
export function googleMapsUrl(coords:Coord[],mode:TravelMode='walk'):string|null{
  if(coords.length<2||coords.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90))return null;
  const coordinate=(p:Coord)=>`${p[1].toFixed(6)},${p[0].toFixed(6)}`;
  const url=new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api','1');url.searchParams.set('origin',coordinate(coords[0]));url.searchParams.set('destination',coordinate(coords[coords.length-1]));url.searchParams.set('travelmode',mode==='walk'?'walking':mode==='motorcycle'?'two-wheeler':'driving');
  const waypoints=googleMapsWaypoints(coords);
  if(waypoints.length)url.searchParams.set('waypoints',waypoints.map(coordinate).join('|'));
  return url.toString();
}
