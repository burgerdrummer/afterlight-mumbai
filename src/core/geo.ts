import type { Coord } from './types';
export const meters = (a:Coord,b:Coord) => {
  const rad=Math.PI/180;
  return 6371000*Math.hypot((b[0]-a[0])*rad*Math.cos((a[1]+b[1])*rad/2),(b[1]-a[1])*rad);
};
export function pointSegmentDistance(p:Coord,a:Coord,b:Coord) {
  const scale=Math.cos(p[1]*Math.PI/180);
  const dx=(b[0]-a[0])*scale,dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,(((p[0]-a[0])*scale)*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return {distance:meters(p,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]),t};
}
export const formatDistance=(m:number) => m>=1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m/10)*10} m`;
export function nearestNode(nodes:Coord[],p:Coord) {
  let node=0, distance=Infinity;
  nodes.forEach((n,i)=>{const d=meters(n,p);if(d<distance){distance=d;node=i;}});
  return {node,distance};
}
