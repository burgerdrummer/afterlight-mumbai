import type { Coord, SegmentEvidence, SupportScore, TravelMode } from './types';
export const SCORE_VERSION='0.5-mapped-support-1';
export const MODE_LABELS:Record<TravelMode,string>={walk:'Walk',motorcycle:'Bike',car:'Car'};
// Fixed citywide presets for the three supported inputs. Assistance and live
// road conditions are excluded until usable datasets are connected. Never
// renormalize weights per route: that would reward missing observations.
export const NIGHT_WEIGHTS:Record<TravelMode,number[]>={walk:[40,35,25],motorcycle:[60,25,15],car:[70,20,10]};
export const DAY_WEIGHTS:Record<TravelMode,number[]>={walk:[70,0,30],motorcycle:[80,0,20],car:[85,0,15]};
/** Approximate solar altitude; used only to select published day/night presets.
 * Longitude and an absolute UTC instant avoid host-timezone assumptions. */
export function daylight(p:Coord,at:Date){
  const rad=Math.PI/180,day=(at.getTime()-Date.UTC(at.getUTCFullYear(),0,1))/86400000;
  const gamma=2*Math.PI/365*(day+(at.getUTCHours()-12)/24);
  const decl=.006918-.399912*Math.cos(gamma)+.070257*Math.sin(gamma)-.006758*Math.cos(2*gamma)+.000907*Math.sin(2*gamma)-.002697*Math.cos(3*gamma)+.00148*Math.sin(3*gamma);
  const eq=229.18*(.000075+.001868*Math.cos(gamma)-.032077*Math.sin(gamma)-.014615*Math.cos(2*gamma)-.040849*Math.sin(2*gamma));
  const hour=(at.getUTCHours()*60+at.getUTCMinutes()+eq+4*p[0])/4-180;
  return Math.asin(Math.sin(p[1]*rad)*Math.sin(decl)+Math.cos(p[1]*rad)*Math.cos(decl)*Math.cos(hour*rad))/rad>=0;
}
export function infrastructure(s:SegmentEvidence,mode:TravelMode):[number,number]{
  // Only observed infrastructure, never a blanket reward for main roads.
  if(s.infrastructureKnown!==undefined)return [s.infrastructureKnown,s.infrastructureQuality??0];
  if(mode==='walk'){
    if(['yes','both','left','right','separate'].includes(s.sidewalk||''))return [1,1];
    if(s.sidewalk==='no')return [1,0];
    if(['footway','pedestrian','path','steps'].includes(s.kind||''))return [1,s.kind==='steps'?.5:.85];
    return [0,0];
  }
  if(['asphalt','concrete','paved','concrete:plates'].includes(s.surface||''))return [1,1];
  if(['unpaved','gravel','dirt','ground','sand','mud'].includes(s.surface||''))return [1,mode==='motorcycle'?.1:.3];
  if(['cobblestone','sett','paving_stones'].includes(s.surface||''))return [1,.5];
  return [0,0];
}
export function scoreRoute(segments:SegmentEvidence[],mode:TravelMode,departure:Date):SupportScore{
  const length=segments.reduce((n,s)=>n+s.distance,0)||1;
  const keys=['infrastructure','lighting','activity'];
  const labels=[mode==='walk'?'Mapped walking infrastructure':'Mapped road surface','Street lighting','Places listed open along the route'];
  const factors=keys.map((key,i)=>({key,label:labels[i],weight:0,earned:0,known:0,detail:''}));
  let elapsed=0,dayLength=0;
  for(const s of segments){
    const day=daylight(s.coords[0],new Date(departure.getTime()+(elapsed+s.minutes/2)*60000));elapsed+=s.minutes;if(day)dayLength+=s.distance;
    const w=(day?DAY_WEIGHTS:NIGHT_WEIGHTS)[mode],share=s.distance/length;
    const infra=infrastructure(s,mode),litKnown=['yes','no','24/7','automatic','sunset-sunrise'].includes(s.lit),lit=s.lit!=='no';
    const observations:[number,number][]=[infra,[litKnown?1:0,lit?1:0],[s.activityKnown?1:0,s.openNearby?1:0]];
    factors.forEach((f,i)=>{const [known,quality]=observations[i];f.weight+=w[i]*share;f.known+=w[i]*share*known;f.earned+=w[i]*share*known*quality;});
  }
  factors[0].detail=mode==='walk'?'Route length with mapped sidewalks or pedestrian paths. Steps receive half credit; other pedestrian paths receive 85%. Crossings and junction safety are not assessed.':'Route length with recorded surface: paved surfaces receive full credit; rough surfaces receive less. This describes the mapped surface, not current potholes or road conditions.';
  factors[1].detail='Length with lighting tags at estimated passing time. Daylight uses a separate published weight preset.';
  factors[2].detail='Length near a place with an interpretable schedule; points require it to be listed open at passing time. No live footfall is inferred.';
  const lower=factors.reduce((n,f)=>n+f.earned,0),known=factors.reduce((n,f)=>n+f.known,0);
  return {lower,upper:Math.min(100,lower+100-known),coverage:known,factors,period:dayLength<.01?'night':dayLength>length-.01?'day':'mixed',version:SCORE_VERSION};
}
export function scoreLabel(score:SupportScore){return `${Math.max(0,Math.min(100,Math.round(score.lower)))} / 100`;}
export function scoreColor(score:SupportScore){return score.coverage<40?'#657b83':score.lower>=60?'#14745c':score.lower>=35?'#338d86':'#b18748';}
