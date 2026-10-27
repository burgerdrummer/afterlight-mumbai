import { PilotRouter } from './router';
import { expandGraph, readJsonResponse, type CompactGraph } from './dataset';
import type { Snapshot, Coord, Place, EngineRoute, TravelMode } from './types';
import { JourneyAnalyzer,chooseJourneys } from './journey';
import {browserJourneys} from './browser-routing';
let router:PilotRouter|null=null;
let analyzer:JourneyAnalyzer|null=null;
let loaded:Snapshot|null=null;
let browser=false,graphUrl='',endpoint='/api/routing';
async function walkingRouter(){
  if(router)return router;
  if(!loaded||!loaded.graphFile)throw new Error('The bundled walking network is unavailable.');
  postMessage({type:'progress',text:'Preparing the public Mumbai walking network…'});
  const places=loaded.places,graph=await readJsonResponse(await fetch(graphUrl)) as CompactGraph;
  loaded={...expandGraph(loaded,graph),places};router=new PilotRouter(loaded);return router;
}
onmessage=async(e:MessageEvent)=>{
  const {id,type,payload}=e.data;
  try{
    if(type==='init'){
      browser=Boolean(payload.routing?.browser);endpoint=payload.routing?.endpoint||'/api/routing';graphUrl=payload.graphUrl;
      let data=payload.data as Snapshot;
      if(data.graphFile&&!data.extraPlacesFile){postMessage({type:'progress',text:'Loading local facilities…'});const graph=await readJsonResponse(await fetch(payload.graphUrl)) as CompactGraph;data=expandGraph(data,graph);}
      postMessage({type:'progress',text:'Indexing streets and nearby places…'});
      if(data.extraPlacesFile)data.places=await readJsonResponse(await fetch(new URL(data.extraPlacesFile,payload.graphUrl))) as Place[];
      loaded=data;if(data.nodes.length)router=new PilotRouter(data);analyzer=new JourneyAnalyzer(data.places,data.cameras);postMessage({id,result:true});return;
    }
    if(!analyzer)throw new Error('The route evidence is still loading.');
    if(type==='journey'){
      if(browser){
        if(payload.mode!=='walk')throw new Error('Bike and Car comparisons need an online routing service. Use Google Maps for directions, or choose Walk to compare routes here.');
        const result=browserJourneys(await walkingRouter(),analyzer,payload.origin,payload.destination,new Date(payload.departure),payload.detour,payload.options);
        postMessage({id,result});return;
      }
      const response=await fetch(endpoint.replace(/\/$/,'')+'/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
      if(!response.headers.get('Content-Type')?.includes('application/json'))throw new Error('The local multimodal router is unavailable. Start npm run router, then compare again.');
      const body=await response.json();if(!response.ok)throw new Error(body.error||'The local routing service is unavailable. Start npm run router.');
      const departure=new Date(payload.departure),mode=payload.mode as TravelMode;
      const candidates=(body.routes as EngineRoute[]).map(r=>analyzer!.analyze(r,mode,departure));
      postMessage({id,result:chooseJourneys(candidates,payload.detour)});return;
    }
    if(type==='routes'){
      if(!router)throw new Error('The legacy walking sample is unavailable.');
      const result=router.routes(payload.start,payload.end,new Date(payload.departure),payload.detour);
      postMessage({id,result});return;
    }
    if(type==='nearest'){
      if(!router)throw new Error('Select a map point. The route engine will snap it to an accessible street.');
      const nearest=router.nearest(payload.coord as Coord);
      postMessage({id,result:{...nearest,coord:router.data.nodes[nearest.node]}});return;
    }
    if(type==='cameras'){
      router?.setCameras(payload.cameras);
      if(loaded){loaded.cameras=payload.cameras;analyzer=new JourneyAnalyzer(loaded.places,payload.cameras);}
      const result=payload.routes.map((r:import('./types').JourneyRoute)=>r.evidence?{...r,cameras:analyzer!.analyze({...r,steps:r.steps||[]},r.mode,new Date(payload.departure)).cameras}:{...r,cameras:router!.analyze({nodes:r.nodes,edges:r.edges},new Date(payload.departure)).cameras});
      postMessage({id,result});return;
    }
    throw new Error('Unknown local routing operation.');
  }catch(err){postMessage({id,error:err instanceof Error?err.message:'Unable to process the local route.'});}
};
