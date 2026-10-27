import type { Coord } from './types';
/** Small local cells replace a citywide O(edges × places) scan. */
export class SpatialGrid {
  private cells=new Map<string,number[]>();
  constructor(private points:Coord[],private cell=.001){points.forEach((p,i)=>{const key=this.key(p);const list=this.cells.get(key);if(list)list.push(i);else this.cells.set(key,[i]);});}
  private key(p:Coord){return `${Math.floor(p[0]/this.cell)},${Math.floor(p[1]/this.cell)}`;}
  box(west:number,south:number,east:number,north:number){const found:number[]=[];for(let x=Math.floor(west/this.cell);x<=Math.floor(east/this.cell);x++)for(let y=Math.floor(south/this.cell);y<=Math.floor(north/this.cell);y++){const ids=this.cells.get(`${x},${y}`);if(ids)found.push(...ids);}return found;}
  around(p:Coord,radiusMetres:number){const dy=radiusMetres/111000,dx=dy/Math.cos(p[1]*Math.PI/180);return this.box(p[0]-dx,p[1]-dy,p[0]+dx,p[1]+dy);}
}
