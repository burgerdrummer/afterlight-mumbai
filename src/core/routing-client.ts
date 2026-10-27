import type { CameraPoint, Coord, Route, Snapshot, Landmark, TravelMode, RoutingOptions, JourneyRoute } from './types';
import {routingConfig} from './runtime';
export class RoutingClient {
  private worker=new Worker(new URL('./routing.worker.ts',import.meta.url),{type:'module'});
  private sequence=0;
  private pending=new Map<number,{resolve:(value:unknown)=>void;reject:(error:Error)=>void}>();
  constructor(progress:(text:string)=>void){this.worker.onmessage=e=>{if(e.data.type==='progress'){progress(e.data.text);return;}const p=this.pending.get(e.data.id);if(!p)return;this.pending.delete(e.data.id);if(e.data.error)p.reject(new Error(e.data.error));else p.resolve(e.data.result);};this.worker.onerror=()=>{for(const p of this.pending.values())p.reject(new Error('The local routing worker could not start. Reload the page.'));this.pending.clear();};}
  private call<T>(type:string,payload:unknown){return new Promise<T>((resolve,reject)=>{const id=++this.sequence;this.pending.set(id,{resolve:resolve as (value:unknown)=>void,reject});this.worker.postMessage({id,type,payload});});}
  init(data:Snapshot,base:string){return this.call<boolean>('init',{data,graphUrl:new URL((data.graphFile||''),base).href,routing:routingConfig});}
  routes(start:number,end:number,departure:Date,detour:number){return this.call<Route[]>('routes',{start,end,departure:departure.toISOString(),detour});}
  journey(origin:Landmark,destination:Landmark,mode:TravelMode,departure:Date,detour:number,options:RoutingOptions){return this.call<JourneyRoute[]>('journey',{origin:origin.requestedCoord||origin.coord,destination:destination.requestedCoord||destination.coord,mode,departure:departure.toISOString(),detour,options});}
  nearest(coord:Coord){return this.call<{node:number;distance:number;coord:Coord}>('nearest',{coord});}
  updateCameras(cameras:CameraPoint[],routes:Route[],departure:Date){return this.call<Route[]>('cameras',{cameras,routes,departure:departure.toISOString()});}
  destroy(){this.worker.terminate();for(const p of this.pending.values())p.reject(new Error('Local routing was stopped.'));this.pending.clear();}
}
