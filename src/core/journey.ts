import type { CameraPoint, EngineRoute, JourneyRoute, Place, RoutePlace, SegmentEvidence, TravelMode } from './types';
import { meters,pointSegmentDistance } from './geo';
import { placeState } from './hours';
import { scoreRoute } from './scoring';
import { SpatialGrid } from './spatial';
export function facilityKind(p:Place){
  const c=p.category.toLowerCase();
  if(c==='police'||c.includes('police_station'))return 'Police station';
  if(c.includes('hospital'))return p.emergency==='yes'?'Hospital · emergency service mapped':'Hospital · emergency service unconfirmed';
  if(c.includes('pharmac'))return 'Pharmacy';
  if(c.includes('clinic')||c==='doctors'||c.includes('medical'))return 'Clinic / medical service';
  if(c==='fire_station')return 'Fire station';
  if(c==='fuel'||c.includes('gas_station')||c.includes('petrol'))return 'Fuel station';
  if(c.includes('repair')||c==='car_repair')return 'Repair service';
  if(c==='station'||c==='bus_station')return 'Transport facility';
  return p.category.replaceAll('_',' ');
}
export function assistance(p:Place,mode:TravelMode){
  const c=p.category.toLowerCase();
  return p.help||/police|hospital|pharmacy|clinic|fire_station/.test(c)||(mode!=='walk'&&/fuel|petrol|gas_station|repair/.test(c));
}
export function extraTime(minutes:number){return minutes<.01?'Same ETA':minutes<1?'+<1 min':`+${Math.ceil(minutes)} min`;}
export class JourneyAnalyzer{
  private grid:SpatialGrid;private camerasGrid:SpatialGrid;
  constructor(private places:Place[],private cameras:CameraPoint[]=[]){this.grid=new SpatialGrid(places.map(p=>p.coord));this.camerasGrid=new SpatialGrid(cameras.map(c=>c.coord));}
  analyze(input:EngineRoute,mode:TravelMode,departure:Date):JourneyRoute{
    const found=new Map<string,RoutePlace>(),nearCameras=new Map<string,CameraPoint>();
    const evidence:SegmentEvidence[]=[];let elapsed=0,gap=0,longest=0,knownLit=0,yesLit=0,knownSide=0,openLength=0;
    for(const edge of input.evidence){
      // Sample original geometry in <=25 m pieces; never create new graph links.
      const geometryLength=edge.coords.slice(1).reduce((n,b,i)=>n+meters(edge.coords[i],b),0)||1;
      for(let part=1;part<edge.coords.length;part++){
        const a=edge.coords[part-1],b=edge.coords[part],partLength=meters(a,b),count=Math.max(1,Math.ceil(partLength/25));
        for(let k=0;k<count;k++){
          const lerp=(f:number):[number,number]=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
          const start=lerp(k/count),end=lerp((k+1)/count),distance=partLength/count,duration=edge.minutes*distance/geometryLength;
          const radius=mode==='walk'?50:100;let open=false,activityKnown=false,helpKnown=false;
          for(const index of this.grid.around(start,radius+30)){
            const p=this.places[index],near=pointSegmentDistance(p.coord,start,end);
            if(near.distance>radius)continue;
            const passing=new Date(departure.getTime()+(elapsed+duration*near.t)*60000),state=placeState(p,passing);
            // Geometric proximity cannot establish a reachable public entrance.
            // Retain it as activity context; assistance earns no score without
            // independent entrance and access checks.
            if(state!=='unknown')activityKnown=true;if(state==='open')open=true;
            const previous=found.get(p.id);
            if(!previous||near.distance<previous.distance)found.set(p.id,{...p,help:assistance(p,mode),state,passingAt:passing.toISOString(),distance:near.distance,reachable:false});
            helpKnown=helpKnown||false;
          }
          for(const index of this.camerasGrid.around(start,80)){
            const c=this.cameras[index];if(pointSegmentDistance(c.coord,start,end).distance<=50)nearCameras.set(c.id,c);
          }
          if(open){longest=Math.max(longest,gap);gap=0;openLength+=distance;}else gap+=distance;
          if(['yes','no','24/7','automatic','sunset-sunrise'].includes(edge.lit))knownLit+=distance;
          if(['yes','24/7','automatic','sunset-sunrise'].includes(edge.lit))yesLit+=distance;
          if(edge.sidewalk&&edge.sidewalk!=='unknown')knownSide+=distance;
          evidence.push({...edge,coords:[start,end],distance,minutes:duration,activityKnown,openNearby:open,helpKnown,helpQuality:0});elapsed+=duration;
        }
      }
    }
    longest=Math.max(longest,gap);const length=evidence.reduce((n,e)=>n+e.distance,0)||1,places=[...found.values()].sort((a,b)=>Number(b.help)-Number(a.help)||Number(b.state==='open')-Number(a.state==='open')||a.distance-b.distance);
    const score=scoreRoute(evidence,mode,departure);
    return {...input,mode,engine:'valhalla',score,evidence,nodes:[],edges:[],title:'Alternative route',description:'',extraMinutes:0,lightingKnown:knownLit/length*100,lightingYes:yesLit/length*100,sidewalkKnown:knownSide/length*100,longestGap:longest,openCount:places.filter(p=>p.state==='open').length,hoursKnown:places.filter(p=>p.state!=='unknown').length,nearbyCount:places.length,places,support:score.lower/100,reason:'',streetNames:input.steps.map(s=>s.name),segments:evidence.map((s,i)=>({edge:i,distance:s.distance,startMinutes:0,openNearby:s.openNearby,lit:s.lit,coords:[s.coords[0],s.coords[s.coords.length-1]]})),cameras:[...nearCameras.values()],baseline:false,highestSupport:false,arrival:new Date(departure.getTime()+input.minutes*60000).toISOString(),liveTraffic:false};
  }
}
export function chooseJourneys(candidates:JourneyRoute[],maxDetour:number){
  if(!candidates.length)throw new Error('No route is available for this journey.');
  candidates.sort((a,b)=>a.minutes-b.minutes);const base=candidates[0];
  const eligible=candidates.filter(r=>r.minutes-base.minutes<=maxDetour+.01);
  const alternatives=eligible.slice(1).sort((a,b)=>b.score.lower-a.score.lower||a.minutes-b.minutes);
  const results=[base,...alternatives.slice(0,2)].sort((a,b)=>a.minutes-b.minutes),best=Math.max(...results.map(r=>r.score.lower));
  for(const r of results){
    r.baseline=r===base;r.extraMinutes=Math.max(0,r.minutes-base.minutes);r.highestSupport=r.score.lower>=best-.01&&best>0;
    r.title=r.baseline?'Fastest estimated':r.highestSupport?'More mapped support':'Alternative route';
    r.description='Estimated without live traffic.';
    r.reason=r.baseline?'Lowest ETA among the mapped candidates found for this mode.':`${extraTime(r.extraMinutes)} versus fastest estimated; ${Math.round(r.score.coverage)}% evidence coverage.`;
  }
  return results;
}
