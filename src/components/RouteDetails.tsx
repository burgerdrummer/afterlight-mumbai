import {Download,Store,Route,Lightbulb,Cctv} from 'lucide-react';
import type {JourneyRoute,RoutePlace} from '../core/types';
import {ScorePanel} from './ScorePanel';
import {FacilityList} from './FacilityList';
import {formatDistance} from '../core/geo';
import {istTime} from '../core/hours';
import {MODE_LABELS} from '../core/scoring';

export function RouteDetails({route,onShow,onExport}:{route:JourneyRoute;onShow:(p:RoutePlace)=>void;onExport:()=>void}){
  return <section className="route-details" aria-label="Selected route details">
    <div className="route-details-heading"><div><span className="eyebrow">YOUR SELECTED ROUTE</span><h2>Why this score?</h2><p>{MODE_LABELS[route.mode]}{route.engine==='bundled-walk'?' preview':''} · {Math.ceil(route.minutes)} min · {formatDistance(route.distance)} · Arrive around {istTime(route.arrival)}</p></div><button className="secondary-action" onClick={onExport}><Download size={16}/>Download GPX</button></div>
    <div className="route-detail-grid"><ScorePanel route={route}/><section className="route-context" aria-labelledby="route-context-title"><h3 id="route-context-title">Along this route</h3><div className="route-metrics"><div><Store aria-hidden="true"/><strong>{route.openCount}</strong><span>places listed open</span><small>{route.hoursKnown} with usable hours · {route.nearbyCount-route.hoursKnown} hours unknown</small></div><div><Route aria-hidden="true"/><strong>{formatDistance(route.longestGap)}</strong><span>longest gap between listed-open places</span></div><div><Lightbulb aria-hidden="true"/><strong>{Math.round(route.lightingKnown)}%</strong><span>of the route has lighting tags</span></div><div><Cctv aria-hidden="true"/><strong>{route.cameras?.length||0}</strong><span>mapped CCTV points · operation unverified</span></div></div><h4>What is excluded from the score?</h4><p><strong>Reachable assistance:</strong> this dataset has no verified public entrances or checked access routes, so assistance carries no weight.</p><p><strong>Current road conditions:</strong> no live road-condition feed is connected, so this carries no weight. Recorded surface type is assessed separately.</p><p>CCTV does not affect the score. Nearby assistance and services are listed below for context.</p><h4>Journey notes</h4><p>Times exclude live traffic and unverified off-street access. Street approach offsets: {Math.round(route.snapDistances[0])} m at the start and {Math.round(route.snapDistances[1])} m at the destination. Google Maps recalculates when opened.</p></section></div>
    <FacilityList route={route} onShow={onShow}/>
    <section className="route-directions" aria-labelledby="route-directions-title"><h3 id="route-directions-title">Directions</h3><ol>{route.steps?.map((step,i)=><li key={i}><span>{i+1}</span><div><strong>{step.name}</strong><small>{formatDistance(step.distance)}</small></div></li>)}</ol></section>
  </section>;
}
