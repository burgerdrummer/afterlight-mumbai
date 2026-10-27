import type { Snapshot, Coord, Route, RoutePlace, CameraPoint,RoutingOptions } from './types';
import { meters, pointSegmentDistance, formatDistance } from './geo';
import { placeState } from './hours';
import { SpatialGrid } from './spatial';

class Heap {
  items:{node:number;cost:number}[]=[];
  push(v:{node:number;cost:number}){let i=this.items.length;this.items.push(v);while(i>0){const p=(i-1)>>1;if(this.items[p].cost<=v.cost)break;this.items[i]=this.items[p];i=p;}this.items[i]=v;}
  pop(){const top=this.items[0],last=this.items.pop();if(this.items.length&&last){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.items[c+1].cost<this.items[c].cost)c++;if(last.cost<=this.items[c].cost)break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return top;}
}
const litYes=(lit:string)=>['yes','24/7','automatic','sunset-sunrise'].includes(lit);
const litKnown=(lit:string)=>litYes(lit)||lit==='no';
// Distance is a proximity signal, not a verified accessible entrance.
export const PLACE_RADIUS=35;
export class PilotRouter {
  private options:RoutingOptions={avoidStairs:false,avoidTolls:false,avoidUnpaved:false};
  setOptions(options:RoutingOptions){this.options=options;}
  data:Snapshot;
  adjacency:{to:number;edge:number}[][];
  nearby:{index:number;distance:number;t:number}[][];
  nodeGrid:SpatialGrid;
  cameraGrid:SpatialGrid;
  constructor(data:Snapshot){
    this.data=data;
    this.nodeGrid=new SpatialGrid(data.nodes);
    const placeGrid=new SpatialGrid(data.places.map(p=>p.coord));
    this.cameraGrid=new SpatialGrid((data.cameras||[]).map(p=>p.coord));
    this.adjacency=data.nodes.map(()=>[]);
    data.edges.forEach((e,i)=>{this.adjacency[e.a].push({to:e.b,edge:i});this.adjacency[e.b].push({to:e.a,edge:i});});
    this.nearby=data.edges.map(e=>{
      const a=data.nodes[e.a],b=data.nodes[e.b];
      return placeGrid.box(Math.min(a[0],b[0])-.0004,Math.min(a[1],b[1])-.0004,Math.max(a[0],b[0])+.0004,Math.max(a[1],b[1])+.0004).flatMap(index=>{
        const p=data.places[index];
        if(p.coord[0]<Math.min(a[0],b[0])-.0004||p.coord[0]>Math.max(a[0],b[0])+.0004||p.coord[1]<Math.min(a[1],b[1])-.0004||p.coord[1]>Math.max(a[1],b[1])+.0004)return [];
        const {distance,t}=pointSegmentDistance(p.coord,a,b);
        return distance<=PLACE_RADIUS?[{index,distance,t}]:[];
      });
    });
  }
  edgeMinutes(i:number){const e=this.data.edges[i];return e.length/(e.kind==='steps'?.75:1.25)/60;}
  path(start:number,end:number,weight:number,open:boolean[],penalties=new Set<number>()){
    const costs=new Float64Array(this.data.nodes.length).fill(Infinity),prevNode=new Int32Array(costs.length).fill(-1),prevEdge=new Int32Array(costs.length).fill(-1);
    const queue=new Heap();costs[start]=0;queue.push({node:start,cost:0});
    while(queue.items.length){
      const current=queue.pop();if(current.cost!==costs[current.node])continue;if(current.node===end)break;
      for(const link of this.adjacency[current.node]){
        const e=this.data.edges[link.edge];
        if(this.options.avoidStairs&&e.kind==='steps')continue;
        if(this.options.avoidUnpaved&&['unpaved','gravel','dirt','ground','sand','mud'].includes(e.surface))continue;
        // Prefer documented positive context. Unknown is never described as dark,
        // closed, or unsafe. The coefficient is an uncalibrated preference.
        const context=(litYes(e.lit)?.45:0)+(open[link.edge]?.55:0);
        const cost=current.cost+this.edgeMinutes(link.edge)*(1+weight*(1-context))*(penalties.has(link.edge)?1.65:1);
        if(cost<costs[link.to]){costs[link.to]=cost;prevNode[link.to]=current.node;prevEdge[link.to]=link.edge;queue.push({node:link.to,cost});}
      }
    }
    if(!Number.isFinite(costs[end]))return null;
    const nodes=[end],edges:number[]=[];
    for(let at=end;at!==start;at=prevNode[at]){if(prevNode[at]<0)return null;edges.push(prevEdge[at]);nodes.push(prevNode[at]);}
    return {nodes:nodes.reverse(),edges:edges.reverse()};
  }
  analyze(path:{nodes:number[];edges:number[]},departure:Date):Route {
    let distance=0,minutes=0,known=0,yes=0,sidewalk=0,gap=0,longest=0,openDistance=0;
    const places=new Map<string,RoutePlace>();
    const cameras=new Map<string,NonNullable<Snapshot['cameras']>[number]>();
    const steps:{name:string;distance:number}[]=[];
    const segments:Route['segments']=[];
    path.edges.forEach((i,idx)=>{
      const e=this.data.edges[i],duration=this.edgeMinutes(i);
      const lastStep=steps[steps.length-1];if(lastStep?.name===e.name)lastStep.distance+=e.length;else steps.push({name:e.name,distance:e.length});
      const a=this.data.nodes[e.a],b=this.data.nodes[e.b];
      for(const cameraId of this.cameraGrid.box(Math.min(a[0],b[0])-.0005,Math.min(a[1],b[1])-.0005,Math.max(a[0],b[0])+.0005,Math.max(a[1],b[1])+.0005)){
        const camera=this.data.cameras![cameraId];if(pointSegmentDistance(camera.coord,a,b).distance<=50)cameras.set(camera.id,camera);
      }
      let openNearby=false;
      for(const near of this.nearby[i]){
        const p=this.data.places[near.index];
        const t=path.nodes[idx]===e.a?near.t:1-near.t;
        const passing=new Date(departure.getTime()+(minutes+duration*t)*60000);
        const state=placeState(p,passing);
        if(state==='open')openNearby=true;
        const existing=places.get(p.id);
        if(!existing||near.distance<existing.distance)places.set(p.id,{...p,state,passingAt:passing.toISOString(),distance:near.distance});
      }
      if(litKnown(e.lit))known+=e.length;
      if(litYes(e.lit))yes+=e.length;
      if(e.sidewalk!=='unknown')sidewalk+=e.length;
      if(openNearby){longest=Math.max(longest,gap);gap=0;openDistance+=e.length;}else gap+=e.length;
      segments.push({edge:i,distance:e.length,startMinutes:minutes,openNearby,lit:e.lit,coords:[a,b]});
      distance+=e.length;minutes+=duration;
    });
    longest=Math.max(longest,gap);
    const all=[...places.values()];
    return {id:path.edges.join('-'),title:'',description:'',nodes:path.nodes,edges:path.edges,coords:path.nodes.map(i=>this.data.nodes[i]),distance,minutes,extraMinutes:0,lightingKnown:known/distance*100,lightingYes:yes/distance*100,sidewalkKnown:sidewalk/distance*100,longestGap:longest,openCount:all.filter(p=>p.state==='open').length,hoursKnown:all.filter(p=>p.state!=='unknown').length,nearbyCount:all.length,places:all,support:(yes*.45+openDistance*.55)/distance,reason:'',streetNames:[...new Set(path.edges.map(i=>this.data.edges[i].name))].filter(n=>!n.startsWith('Unnamed')),segments,steps,cameras:[...cameras.values()]};
  }
  routes(start:number,end:number,departure:Date,maxDetour:number):Route[]{
    if(!this.data.nodes[start]||!this.data.nodes[end])throw new Error('Choose locations inside the imported Mumbai walking network.');
    if(start===end)throw new Error('Choose two different locations.');
    if(!Number.isFinite(departure.getTime()))throw new Error('Choose a valid departure time.');
    if(this.data.components&&this.data.components[start]!==this.data.components[end])throw new Error('These points belong to separate mapped walking networks. Choose another street approach; we do not invent connecting paths.');
    const states=this.data.places.map(p=>placeState(p,departure));
    const open=this.nearby.map(ps=>ps.some(p=>states[p.index]==='open'));
    const shortest=this.path(start,end,0,open);
    if(!shortest)throw new Error('These points are not connected by a mapped walking route.');
    const base=this.analyze(shortest,departure);
    const paths=[shortest];
    for(const weight of [.8,2,5]){const p=this.path(start,end,weight,open);if(p)paths.push(p);}
    const supportPath=paths[paths.length-1];
    for(const p0 of [shortest,supportPath]){
      const p=this.path(start,end,1.5,open,new Set(p0.edges));if(p)paths.push(p);
    }
    const unique=new Map<string,Route>();
    for(const p of paths){const r=this.analyze(p,departure);r.extraMinutes=Math.max(0,r.minutes-base.minutes);if(r.extraMinutes<=maxDetour+.01)unique.set(r.id,r);}
    const candidates=[...unique.values()].filter(r=>r.id!==base.id).sort((a,b)=>b.support-a.support||a.minutes-b.minutes);
    const results=[base];
    for(const r of candidates){
      if(results.length===3)break;
      // Avoid three almost identical route cards for a single street choice.
      const distinct=results.every(existing=>{const overlap=new Set(existing.edges);return r.edges.filter(e=>overlap.has(e)).reduce((s,e)=>s+this.data.edges[e].length,0)/r.distance<.95;});
      if(distinct)results.push(r);
    }
    results.sort((a,b)=>a.minutes-b.minutes);
    results.forEach((r,index)=>{
      r.title=index===0?'Shortest walk':index===1?'Alternative walk':'Another way home';
      r.description=index===0?'The most direct mapped walking route.':'A different path through the neighbourhood.';
      if(index>0&&r.support>base.support+.025){r.title=index===1?'More mapped support':'Another supported option';r.description='Prioritises mapped lighting and places listed as open.';}
      const changes=[];
      if(index>0&&r.lightingYes>base.lightingYes+3)changes.push(`${Math.round(r.lightingYes-base.lightingYes)} percentage points more mapped lighting`);
      if(index>0&&r.longestGap<base.longestGap-40)changes.push(`a ${formatDistance(base.longestGap-r.longestGap)} shorter gap without a listed open place`);
      r.reason=changes.length?`Adds ${Math.max(1,Math.ceil(r.extraMinutes))} min, with ${changes.join(' and ')}.`:index===0?'The shortest route on the bundled walking network.':'Offers a different mapped route within your detour limit.';
    });
    return results;
  }
  nearest(coord:Coord){let node=-1,distance=Infinity;for(const radius of [100,250,500,1000]){for(const i of this.nodeGrid.around(coord,radius)){const d=meters(coord,this.data.nodes[i]);if(d<distance){distance=d;node=i;}}if(distance<=radius)break;}return {node,distance};}
  setCameras(cameras:CameraPoint[]){this.data.cameras=cameras;this.cameraGrid=new SpatialGrid(cameras.map(c=>c.coord));}
}
