import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, ArrowRight, ArrowUpRight, Cctv, Check, CalendarDays, Clock3, Footprints, Github, Info, LocateFixed, LoaderCircle, MapPin, Moon, Navigation, ShieldCheck, Store, X, Car, Bike, Phone } from 'lucide-react';
import type { Coord, Landmark, JourneyRoute, Snapshot, TravelMode, RoutingOptions, RoutePlace } from './core/types';
import { formatDistance } from './core/geo';
import { istDateTimeInput, istInputToDate } from './core/hours';
import { googleMapsUrl } from './core/google-maps';
import { mergeCameraPoints, parseCameraGeoJson } from './core/cctv';
import { RoutingClient } from './core/routing-client';
import {routingConfig} from './core/runtime';
import { RouteDetails } from './components/RouteDetails';
import { afterlightScore,dataQuality,recommendationReason,routeChoices,routeColour,routeTitle,scoreOrder } from './core/presentation';
import { SosDialog } from './components/SosDialog';
import { MODE_LABELS } from './core/scoring';
import { extraTime } from './core/journey';
import { readJsonResponse } from './core/dataset';
import { LocationPicker } from './components/LocationPicker';
import { ProjectDialog, type Panel } from './components/ProjectDialog';
const CityMap=lazy(()=>import('./components/CityMap').then(m=>({default:m.CityMap})));
const repo='https://github.com/burgerdrummer/afterlight-mumbai';

export function App(){
  const [initial]=useState(()=>istDateTimeInput());
  const [data,setData]=useState<Snapshot|null>(null),[dataBase,setDataBase]=useState(''),[loadError,setLoadError]=useState(''),[progress,setProgress]=useState('Opening your local Mumbai data…');
  const router=useRef<RoutingClient|null>(null),revision=useRef(0);
  const [origin,setOrigin]=useState<Landmark|null>(null),[destination,setDestination]=useState<Landmark|null>(null);
  const [date,setDate]=useState(initial.date),[time,setTime]=useState(initial.time),[leavingNow,setLeavingNow]=useState(true),[detour,setDetour]=useState(10);
  const [mode,setMode]=useState<TravelMode>('walk'),[options,setOptions]=useState<RoutingOptions>({avoidStairs:false,avoidTolls:false,avoidUnpaved:false}),[sosOpen,setSosOpen]=useState(false),[facility,setFacility]=useState<RoutePlace|null>(null);
  const [routes,setRoutes]=useState<JourneyRoute[]>([]),[selected,setSelected]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [panel,setPanel]=useState<Panel>(null),[showOpen,setShowOpen]=useState(true),[showHelp,setShowHelp]=useState(true),[showGaps]=useState(false),[showCameras,setShowCameras]=useState(true);
  const [pick,setPick]=useState<Landmark|null>(null),[dirty,setDirty]=useState(false),[resultTime,setResultTime]=useState(''),[resultJourney,setResultJourney]=useState<{origin:Landmark;destination:Landmark}|null>(null);
  const resultsRef=useRef<HTMLElement>(null),mapRef=useRef<HTMLDivElement>(null);
  const closePanel=useCallback(()=>setPanel(null),[]);
  const markChanged=()=>{revision.current++;setDirty(true);setError('');};
  useEffect(()=>{
    let cancelled=false;const abort=new AbortController();
    const client=new RoutingClient(text=>{if(!cancelled)setProgress(text);});router.current=client;
    async function load(){
      try{
        const sample=new URLSearchParams(window.location.search).get('dataset')==='bandra';
        const base=new URL(import.meta.env.BASE_URL+'data/'+(sample?'':'mumbai/'),window.location.href);
        const response=await fetch(new URL(sample?'bandra.json':'manifest.json.gz',base),{signal:abort.signal});
        if(!response.ok)throw new Error(sample?'The Bandra sample could not load.':'The Mumbai dataset is not available locally yet. Run the city import in the README, or open the Bandra sample.');
        const metadata=await readJsonResponse(response) as Snapshot;
        if(metadata.landmarks.length<2)throw new Error('This dataset needs at least two searchable street approaches.');
        await client.init(metadata,base.href);if(cancelled)return;
        setProgress('Comparing a first route…');
        const start=metadata.landmarks[0],end=metadata.landmarks[1],departure=new Date();
        let found:JourneyRoute[]=[];try{found=await client.journey(start,end,'walk',departure,10,{avoidStairs:false,avoidTolls:false,avoidUnpaved:false});}catch{if(!cancelled)setError('The local route service is starting or unavailable. Start npm run router, then compare.');}if(cancelled)return;
        const current=istDateTimeInput(departure);setDate(current.date);setTime(current.time);
        setData(metadata);setDataBase(base.href);setOrigin(start);setDestination(end);setRoutes(found);setSelected(routeChoices(found).recommended);setResultTime(departure.toISOString());setResultJourney({origin:start,destination:end});
      }catch(err){if(!cancelled&&(err as Error).name!=='AbortError')setLoadError(err instanceof Error?err.message:'Could not open the local walking network.');}
    }
    void load();return()=>{cancelled=true;abort.abort();client.destroy();if(router.current===client)router.current=null;};
  },[]);
  useEffect(()=>{
    if(!leavingNow)return;
    const update=()=>{const current=istDateTimeInput();setDate(current.date);setTime(current.time);};
    const timer=setInterval(update,15000);document.addEventListener('visibilitychange',update);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};
  },[leavingNow,resultTime]);
  function useNow(){const current=istDateTimeInput();setDate(current.date);setTime(current.time);setLeavingNow(true);markChanged();}
  function scrollTo(section:'plan'|'routes'|'map'){
    if(section==='plan'){document.getElementById('journey-form')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    const el=section==='routes'?resultsRef.current:mapRef.current;
    el?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }
  async function compare(e?:React.FormEvent){
    e?.preventDefault();if(!origin||!destination||!router.current||busy)return;
    if(routingConfig.browser&&mode!=='walk'){
      const href=googleMapsUrl([origin.requestedCoord||origin.coord,destination.requestedCoord||destination.coord],mode);
      if(href)window.open(href,'_blank','noopener,noreferrer');setNotice('Directions opened in Google Maps. Choose Walk for Afterlight route comparisons on this public preview.');return;
    }
    const requestRevision=revision.current,start=origin,end=destination;setBusy(true);setError('');setNotice('');
    try{
      const departure=leavingNow?new Date():istInputToDate(date+'T'+time);
      const found=await router.current.journey(start,end,mode,departure,detour,options);
      setRoutes(found);setSelected(routeChoices(found).recommended);setFacility(null);setDirty(revision.current!==requestRevision);setResultTime(departure.toISOString());setResultJourney({origin:start,destination:end});
      if(found.length===1)setNotice('One distinct route fits your detour limit. A larger limit may reveal another option.');

    }catch(err){setError(err instanceof Error?err.message:'Unable to compare these routes.');}finally{setBusy(false);}
  }
  function changeOrigin(l:Landmark){setOrigin(l);markChanged();setPick(null);}
  function changeDestination(l:Landmark){setDestination(l);markChanged();setPick(null);}
  async function chooseMapPoint(coord:Coord){
    if(!data)return;
    if(coord[0]<data.bbox[0]||coord[0]>data.bbox[2]||coord[1]<data.bbox[1]||coord[1]>data.bbox[3]){setNotice('Choose a point inside the imported Mumbai area.');return;}
    setPick({id:'map-'+coord.join(','),name:'Selected map point',subtitle:'Street approach checked when comparing',node:-1,coord,requestedCoord:coord,offset:0});
  }
  function geolocate(){
    setError('');if(!navigator.geolocation){setError('Location is unavailable. Search for a place instead.');return;}
    setNotice('Waiting for your browser’s location permission…');
    navigator.geolocation.getCurrentPosition(p=>{
      const coord:Coord=[p.coords.longitude,p.coords.latitude];
      if(!data||coord[0]<data.bbox[0]||coord[0]>data.bbox[2]||coord[1]<data.bbox[1]||coord[1]>data.bbox[3]){setNotice('');setError('Your location is outside the Mumbai data area. Search for a mapped place.');return;}
      changeOrigin({id:'my-location',name:'My location',subtitle:'Street access checked when comparing',node:-1,coord,requestedCoord:coord,offset:0});setNotice('Location selected. Compare to check a street approach; the app does not track you.');
    },()=>{setNotice('');setError('Location was unavailable. Search for a place or choose a map point.');},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
  }
  function exportRoute(){
    const r=routes[selected];if(!r)return;if(dirty){setNotice('Compare the changed journey before exporting it.');return;}
    const gpx=`<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Afterlight" xmlns="http://www.topografix.com/GPX/1/1"><metadata><desc>Experimental Mumbai route from an OSM snapshot. Check current mode-specific access and conditions.</desc></metadata><trk><name>Afterlight Mumbai route</name><trkseg>${r.coords.map(p=>`<trkpt lat="${p[1]}" lon="${p[0]}"/>`).join('')}</trkseg></trk></gpx>`;
    const url=URL.createObjectURL(new Blob([gpx],{type:'application/gpx+xml'})),a=document.createElement('a');a.href=url;a.download='afterlight-mumbai-'+r.mode+'.gpx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('GPX downloaded with the selected route geometry. Navigation apps may recalculate it.');
  }
  async function importCameras(file:File){
    if(!data||!router.current)return;setError('');
    try{
      if(file.size>5*1024*1024)throw new Error('Choose a GeoJSON file smaller than 5 MB.');
      const imported=parseCameraGeoJson(JSON.parse(await file.text()),data.bbox);
      const cameras=mergeCameraPoints(data.cameras||[],imported),added=cameras.length-(data.cameras||[]).length;setBusy(true);
      const updated=await router.current.updateCameras(cameras,routes,new Date(resultTime));
      setData({...data,cameras});setRoutes(updated as JourneyRoute[]);setShowCameras(true);setNotice(`${added} new CCTV points added; ${imported.length-added} existing records updated locally. They do not change the route ranking.`);setPanel(null);
    }catch(err){setPanel(null);setError(err instanceof Error?err.message:'Could not import that CCTV file.');}finally{setBusy(false);}
  }
  const route=routes[selected],mapsHref=useMemo(()=>route?googleMapsUrl(route.coords,route.mode):null,[route]);
  function handoff(e:React.MouseEvent){if(dirty){e.preventDefault();setNotice('Compare your changed journey before opening Google Maps.');scrollTo('plan');}}
  const resultOrigin=resultJourney?.origin||origin,resultDestination=resultJourney?.destination||destination;
  function showFacility(p:RoutePlace){setFacility(p);if(p.state==='open')setShowOpen(true);if(p.help)setShowHelp(true);scrollTo('map');}
  function changeOption(key:keyof RoutingOptions){setOptions({...options,[key]:!options[key]});markChanged();}
  const choices=useMemo(()=>routeChoices(routes),[routes]);
  const visibleIndices=useMemo(()=>scoreOrder(routes),[routes]);
  function selectRoute(i:number){setSelected(i);setFacility(null);}
  return <>
    <header className="site-header"><a href={import.meta.env.BASE_URL} className="brand" aria-label="Afterlight home"><span className="brand-icon"><Moon size={22}/><i/></span><span>afterlight<span className="brand-period">.</span></span></a><span className="header-city">Mumbai</span><nav aria-label="Main navigation"><button onClick={()=>scrollTo('plan')}>Plan a journey</button><button onClick={()=>setPanel('method')}>How it works</button></nav><div className="header-right"><button className="sos-button" onClick={()=>setSosOpen(true)}><Phone size={16}/>SOS</button><a href={repo} target="_blank" rel="noreferrer" className="github-link" aria-label="Published source on GitHub"><Github size={18}/></a></div></header>
    <main className="simple-main"><div className="simple-intro"><h1>A better way home.</h1><p>Walk, ride or drive. Find your route.</p></div>
    {loadError?<div className="load-state"><Info size={26}/><p>{loadError}</p><button className="primary-button" onClick={()=>window.location.reload()}>Try again</button></div>:!data||!origin||!destination?<div className="load-state" aria-live="polite"><LoaderCircle className="spin" size={28}/><p>{progress}</p></div>:<>
      {routingConfig.browser&&<p className="public-preview-note"><Info size={15}/><span><strong>Public walking preview.</strong> Compare walking routes here. Bike and Car directions open in Google Maps; scored comparisons need an online routing service.</span></p>}<section className="compact-planner" aria-label="Journey planner">
      <form id="journey-form" className="journey-form compact-form" onSubmit={compare}><div className="planner-primary"><div className="travel-modes" role="group" aria-label="Travel mode">{(['walk','motorcycle','car'] as TravelMode[]).map(m=><button type="button" key={m} aria-pressed={mode===m} onClick={()=>{setMode(m);if(routingConfig.browser){setRoutes([]);setFacility(null);}markChanged();}}>{m==='walk'?<Footprints size={17}/>:m==='motorcycle'?<Bike size={17}/>:<Car size={17}/>}<span>{MODE_LABELS[m]}</span></button>)}</div><div className="location-stack"><LocationPicker label="From" value={origin} items={data.landmarks} onChange={changeOrigin} letter="A"/><button type="button" className="swap-button" aria-label="Swap start and destination" onClick={()=>{setOrigin(destination);setDestination(origin);markChanged();}}><ArrowDownUp size={16}/></button><LocationPicker label="To" value={destination} items={data.landmarks} onChange={changeDestination} letter="B"/></div><button className="primary-button compare-button" type="submit" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<Navigation size={17}/>}<span>{busy?'Finding routes…':routingConfig.browser&&mode!=='walk'?'Open in Google Maps':'Find routes'}</span></button></div><div className="planner-secondary"><div className="departure-actions"><label className="departure-control"><CalendarDays size={15}/><span className="sr-only">Departure date in Mumbai</span><input type="date" aria-label="Departure date in Mumbai" value={date} required onChange={e=>{setDate(e.target.value);setLeavingNow(false);markChanged();}}/><Clock3 size={15}/><input type="time" aria-label="Departure time in Mumbai" value={time} required onChange={e=>{setTime(e.target.value);setLeavingNow(false);markChanged();}}/><span>IST</span></label><button type="button" className="now-button" aria-pressed={leavingNow} onClick={useNow}>Now</button><button type="button" className="use-location" onClick={geolocate}><LocateFixed size={15}/>Use my location</button></div><label className="detour-control">Extra time<select aria-label="Maximum extra travel time" value={detour} onChange={e=>{setDetour(Number(e.target.value));markChanged();}}>{[0,5,10,15,25].map(n=><option key={n} value={n}>{n===0?'None':`Up to ${n} min`}</option>)}</select></label><fieldset className="route-preferences"><legend>Preferences</legend><div>{mode==='walk'?<label><input type="checkbox" checked={options.avoidStairs} onChange={()=>changeOption('avoidStairs')}/>Avoid stairs</label>:<label><input type="checkbox" checked={options.avoidTolls} onChange={()=>changeOption('avoidTolls')}/>Avoid tolls</label>}<label><input type="checkbox" checked={options.avoidUnpaved} onChange={()=>changeOption('avoidUnpaved')}/>Avoid unpaved surfaces</label></div></fieldset></div></form></section>
      <div className="journey-feedback" aria-live="polite">{error&&<div className="feedback error"><Info size={16}/><p>{error}</p></div>}{notice&&<div className="feedback"><p>{notice}</p><button aria-label="Dismiss message" onClick={()=>setNotice('')}><X size={14}/></button></div>}{dirty&&<div className="feedback dirty"><span>Journey changed.</span><button onClick={()=>compare()} disabled={busy}>Update routes <ArrowRight size={14}/></button></div>}</div>
      <div className="compare-board">
        <section className="route-selector" aria-label="Route options" ref={resultsRef}>
          <div className="route-selector-heading"><h2>Choose your route</h2>{busy&&<LoaderCircle className="spin" size={16}/>}</div>
          <div className="route-choice-scroll">{!routes.length&&routingConfig.browser&&<p className="empty-route-note">{mode==='walk'?'Choose your journey and find routes.':'Use Open in Google Maps for these directions, or choose Walk to compare Afterlight Scores here.'}</p>}<div className="choice-cards">{visibleIndices.map(i=>{const r=routes[i],fast=i===choices.fastest,recommended=i===choices.recommended;return <button key={r.id} className={`choice-card ${selected===i?'is-selected':''}`} style={{'--route-colour':routeColour(i,choices)} as React.CSSProperties} aria-pressed={selected===i} aria-label={`${routeTitle(i,choices)}, ${Math.ceil(r.minutes)} minutes, Afterlight Score ${afterlightScore(r.score)} out of 100, ${dataQuality(r.score)}`} onClick={()=>selectRoute(i)}><div className="choice-top"><span className="choice-identity"><i/>{routeTitle(i,choices)}</span><span className="choice-delta">{fast?'Lowest time':extraTime(r.extraMinutes)}</span></div><div className="choice-duration"><strong>{Math.ceil(r.minutes)}<small> min</small></strong><span>{formatDistance(r.distance)}</span>{selected===i&&<Check size={17}/>}</div><div className="choice-score"><span>Afterlight Score <b>{afterlightScore(r.score)}<small>/100</small></b></span><span className="quality-label" title="How much relevant information is mapped. The calculation is shown below the map.">{dataQuality(r.score)}</span></div>{recommended&&<p>{recommendationReason(r,routes[choices.fastest])}</p>}</button>;})}</div></div>
          <div className="selection-actions">{route&&<>{dirty?<button className="primary-button" onClick={()=>compare()} disabled={busy}>{busy?'Updating…':'Update routes'}</button>:mapsHref&&<a href={mapsHref} target="_blank" rel="noopener noreferrer" className="primary-button" onClick={handoff}><Navigation size={17}/>Google Maps<ArrowUpRight size={14}/></a>}</>}</div>
        </section>
        <div className="comparison-map" ref={mapRef}><div className="map-identity-bar"><div className="map-route-key" role="group" aria-label="Route colour key">{visibleIndices.map(i=><button key={routes[i].id} className={selected===i?'key-selected':''} style={{'--route-colour':routeColour(i,choices)} as React.CSSProperties} aria-pressed={selected===i} aria-label={`Show ${routeTitle(i,choices)} on map`} onClick={()=>selectRoute(i)}><i/><span>{routeTitle(i,choices)}</span><small>{Math.ceil(routes[i].minutes)} min</small>{selected===i&&<Check size={13}/>}</button>)}</div><div className="layer-toggles"><button aria-label="Show places listed open" aria-pressed={showOpen} className={showOpen?'enabled':''} onClick={()=>setShowOpen(!showOpen)}><Store size={15}/><span>Places</span></button><button aria-label="Show assistance points" aria-pressed={showHelp} className={showHelp?'enabled':''} onClick={()=>setShowHelp(!showHelp)}><ShieldCheck size={15}/><span>Help</span></button><button aria-label="Show CCTV" aria-pressed={showCameras} className={showCameras?'enabled':''} onClick={()=>setShowCameras(!showCameras)}><Cctv size={15}/><span>CCTV</span></button></div></div><Suspense fallback={<div className="map-loading"><LoaderCircle className="spin" size={26}/></div>}><CityMap focusedPlace={facility} visibleIndices={visibleIndices} data={data} baseUrl={dataBase} routes={routes} selected={selected} origin={resultOrigin!} destination={resultDestination!} showOpen={showOpen} showHelp={showHelp} showGaps={showGaps} showCameras={showCameras} onPick={chooseMapPoint} onRouteSelect={selectRoute}/></Suspense>{pick&&<div className="map-picker"><MapPin size={18}/><span>Use this point as</span><button onClick={()=>{changeOrigin(pick);}}>Start</button><button onClick={()=>{changeDestination(pick);}}>Destination</button><button className="icon-button" aria-label="Cancel map selection" onClick={()=>setPick(null)}><X size={18}/></button></div>}</div>
      </div><div className="quiet-caption"><span>Based on mapped data · no live traffic</span><span>Green: recommended · Blue: fastest</span></div>{route&&<RouteDetails route={route} onShow={showFacility} onExport={exportRoute}/>}
    </>}
    </main><footer><span>Afterlight · Mumbai</span><div><button onClick={()=>setPanel('about')}>About & privacy</button><a href={repo} target="_blank" rel="noreferrer">Open source<ArrowUpRight size={12}/></a><span className="version">v0.7</span></div></footer>
    <SosDialog open={sosOpen} onClose={()=>setSosOpen(false)} route={route}/>{data&&<ProjectDialog panel={panel} onClose={closePanel} data={data} dataBase={dataBase} onImport={importCameras}/>}
  </>;
}
