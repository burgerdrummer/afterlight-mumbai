import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection, Feature } from 'geojson';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Cctv, Lightbulb, Layers3, LocateFixed, Minus, Plus, Maximize2 } from 'lucide-react';
import type { CameraPoint, Coord, Landmark, JourneyRoute, RoutePlace, Snapshot } from '../core/types';
import { routeChoices,routeColour,routeTitle } from '../core/presentation';
import { extraTime,facilityKind } from '../core/journey';
import { istTime } from '../core/hours';
import { readJsonResponse } from '../core/dataset';
import {lightingOverlay,LIGHTING_LABELS,LIGHTING_COLOURS,type LightingState} from '../core/lighting';
maplibregl.setWorkerUrl(workerUrl);
const empty:FeatureCollection={type:'FeatureCollection',features:[]};
type Props={data:Snapshot;baseUrl:string;routes:JourneyRoute[];selected:number;origin:Landmark;destination:Landmark;showOpen:boolean;showHelp:boolean;showGaps:boolean;showCameras:boolean;showLighting:boolean;focusedPlace?:RoutePlace|null;visibleIndices:number[];onPick:(coord:Coord)=>void;onRouteSelect:(index:number)=>void};
function textPopup(title:string,paragraphs:string[],source?:string){
  const el=document.createElement('div'),heading=document.createElement('strong');heading.textContent=title;el.append(heading);
  paragraphs.forEach(text=>{const p=document.createElement('p');p.textContent=text;el.append(p);});
  if(source){try{const u=new URL(source);if(['https:','http:'].includes(u.protocol)){const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='View source record ↗';el.append(a);}}catch{/* unusable source URLs are not links */}}
  return el;
}
function placePopup(p:RoutePlace){return textPopup(p.name,[`${facilityKind(p)} · ${p.state==='open'?'Listed open':p.state==='closed'?'Listed closed':'Hours unknown'} around ${istTime(p.passingAt)}`,p.hours?`Schedule: ${p.hours}`:'No opening schedule recorded.',`${p.provider||'OpenStreetMap'} · ${p.checked?'Recorded check: '+p.checked:'No field-check date'}. Entrance and reachability unverified.`],p.source||`https://www.openstreetmap.org/${p.id}`);}
function lightingPopupContent(feature:maplibregl.MapGeoJSONFeature){
  const value=feature.properties?.state,state:LightingState=value==='lit'||value==='unlit'?value:'unknown';
  const way=String(feature.properties?.wayId||'');
  return textPopup(LIGHTING_LABELS[state],[`Recorded lit tag: ${feature.properties?.tags||'not recorded'}`,state==='unknown'?'No usable lighting classification is recorded here.':'This is a mapped street tag, not a live observation.'],/^\d+$/.test(way)?`https://www.openstreetmap.org/way/${way}`:undefined);
}
export function CityMap(props:Props){
  const {data,baseUrl,routes,selected,origin,destination,showOpen,showHelp,showGaps,showCameras,showLighting}=props;
  const container=useRef<HTMLDivElement>(null),mapRef=useRef<maplibregl.Map|null>(null),markers=useRef<maplibregl.Marker[]>([]),latest=useRef(props);
  latest.current=props;
  const visibleKey=props.visibleIndices.join(',');
  const lighting=useMemo(()=>lightingOverlay(routes[selected]?.evidence||[]),[routes,selected]);
  const lightingPopupRef=useRef<maplibregl.Popup|null>(null);
  const [ready,setReady]=useState(false),[mapError,setMapError]=useState(false),[detailNote,setDetailNote]=useState('');
  useEffect(()=>{
    if(!container.current)return;
    let map:maplibregl.Map,resize:ResizeObserver|undefined;
    try{
      const city=data.version===2;
      map=new maplibregl.Map({container:container.current,center:origin.coord,zoom:14.8,minZoom:city?9:13,maxZoom:18,cooperativeGestures:true,maxBounds:[[data.bbox[0]-.02,data.bbox[1]-.02],[data.bbox[2]+.02,data.bbox[3]+.02]],attributionControl:false,style:{version:8,sources:{surfaces:{type:'geojson',data:data.surfaces},roads:{type:'geojson',data:data.roads},details:{type:'geojson',data:empty}},layers:[
        {id:'background',type:'background',paint:{'background-color':city?'#e9eee6':'#f0f2e9'}},
        {id:'land',source:'surfaces',type:'fill',filter:['==',['get','kind'],'land'],paint:{'fill-color':'#f0f2e9'}},
        {id:'water',source:'surfaces',type:'fill',filter:['==',['get','kind'],'water'],paint:{'fill-color':'#dfece8'}},
        {id:'parks',source:'surfaces',type:'fill',filter:['==',['get','kind'],'park'],paint:{'fill-color':'#dbe5d2'}},
        {id:'buildings',source:'surfaces',type:'fill',filter:['==',['get','kind'],'building'],paint:{'fill-color':'#e2e5da','fill-outline-color':'#d9ded3'}},
        {id:'overview-casing',source:'roads',type:'line',paint:{'line-color':'#fffef8','line-width':['interpolate',['linear'],['zoom'],10,1,16,10]}},
        {id:'overview-roads',source:'roads',type:'line',paint:{'line-color':'#cbd5c5','line-width':['interpolate',['linear'],['zoom'],10,.5,16,3]}},
        {id:'detail-water',source:'details',type:'fill',filter:['all',['==',['geometry-type'],'Polygon'],['==',['get','kind'],'water']],paint:{'fill-color':'#dfece8'}},
        {id:'detail-parks',source:'details',type:'fill',filter:['all',['==',['geometry-type'],'Polygon'],['==',['get','kind'],'park']],paint:{'fill-color':'#dbe5d2'}},
        {id:'detail-buildings',source:'details',type:'fill',filter:['all',['==',['geometry-type'],'Polygon'],['==',['get','kind'],'building']],paint:{'fill-color':'#e2e5da','fill-outline-color':'#d9ded3'}},
        {id:'detail-casing',source:'details',type:'line',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#fffef8','line-width':['interpolate',['linear'],['zoom'],12,1.5,16,10]}},
        {id:'detail-roads',source:'details',type:'line',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#cbd5c5','line-width':['interpolate',['linear'],['zoom'],12,.5,16,3]}},
      ]}});
      mapRef.current=map;resize=new ResizeObserver(()=>map.resize());resize.observe(container.current);
      map.addControl(new maplibregl.AttributionControl({compact:false,customAttribution:'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · ODbL'}),'bottom-right');
      map.on('load',()=>setReady(true));
      map.on('click',e=>{
        if((e.originalEvent.target as HTMLElement).closest('.maplibregl-marker'))return;
        const current=latest.current;
        const cameraFeature=map.getLayer('cctv-points')?map.queryRenderedFeatures(e.point,{layers:['cctv-points']})[0]:null;
        if(cameraFeature){const p=current.data.cameras?.find(p=>p.id===cameraFeature.properties?.id);if(p){new maplibregl.Popup({offset:14}).setLngLat(p.coord).setDOMContent(textPopup(p.name,[`${p.type==='unspecified'?'Equipment type unspecified':p.type} · ${p.operator||'Operator not recorded'}`,`Operational status: ${p.status.replaceAll('_',' ')}. Coverage and monitoring are not verified.`,p.checked?`Recorded check date: ${p.checked}`:'No field-check date recorded.'],p.source)).addTo(map);return;}}
        const placeFeature=map.getLayer('listed-places')?map.queryRenderedFeatures(e.point,{layers:['listed-places']})[0]:null;
        if(placeFeature){const p=current.routes[current.selected]?.places.find(p=>p.id===placeFeature.properties?.id);if(p){new maplibregl.Popup({offset:14}).setLngLat(p.coord).setDOMContent(placePopup(p)).addTo(map);return;}}
        const lightFeature=current.showLighting&&map.getLayer('lighting-casing')?map.queryRenderedFeatures(e.point,{layers:['lighting-casing']})[0]:null;
        if(lightFeature){hover?.remove();lightingPopupRef.current?.remove();lightingPopupRef.current=new maplibregl.Popup({offset:14}).setLngLat(e.lngLat).setDOMContent(lightingPopupContent(lightFeature)).addTo(map);return;}
        const journeyFeature=map.getLayer('alternatives')?map.queryRenderedFeatures(e.point,{layers:['alternatives','route-main']})[0]:null;
        if(journeyFeature){current.onRouteSelect(Number(journeyFeature.properties?.index)||0);return;}
        current.onPick([e.lngLat.lng,e.lngLat.lat]);
      });
      let hover:maplibregl.Popup|undefined,hoverId='';
      map.on('mousemove',e=>{
        if(!map.getLayer('listed-places'))return;
        const feature=map.queryRenderedFeatures(e.point,{layers:['listed-places']})[0];
        const lightFeature=!feature&&latest.current.showLighting&&map.getLayer('lighting-casing')?map.queryRenderedFeatures(e.point,{layers:['lighting-casing']})[0]:null;
        const id=feature?.properties?.id||(lightFeature?'lighting-'+lightFeature.properties?.state+'-'+lightFeature.properties?.tags+'-'+lightFeature.properties?.wayId:'');
        if(id===hoverId){if(lightFeature)hover?.setLngLat(e.lngLat);return;}hoverId=id;hover?.remove();map.getCanvas().style.cursor=id?'pointer':'';
        const p=latest.current.routes[latest.current.selected]?.places.find(p=>p.id===id);
        if(p)hover=new maplibregl.Popup({offset:12,closeButton:false,closeOnClick:true}).setLngLat(p.coord).setDOMContent(placePopup(p)).addTo(map);
        else if(lightFeature)hover=new maplibregl.Popup({offset:12,closeButton:false,closeOnClick:true}).setLngLat(e.lngLat).setDOMContent(lightingPopupContent(lightFeature)).addTo(map);
      });
      map.on('mouseout',()=>{hover?.remove();hoverId='';});
    }catch{setMapError(true);return;}
    return()=>{resize?.disconnect();setReady(false);map.remove();mapRef.current=null;};
  },[data.area,data.fetchedAt]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map||!data.tiles?.length)return;
    const cache=new Map<string,FeatureCollection>();let controller:AbortController|undefined;let disposed=false;
    async function load(){
      controller?.abort();controller=new AbortController();const signal=controller.signal;
      if(map!.getZoom()<12.7){(map!.getSource('details') as maplibregl.GeoJSONSource).setData(empty);setDetailNote('Zoom in for street detail');return;}
      const b=map!.getBounds(),centre=map!.getCenter();
      const tiles=data.tiles!.filter(t=>t.bbox[0]<b.getEast()&&t.bbox[2]>b.getWest()&&t.bbox[1]<b.getNorth()&&t.bbox[3]>b.getSouth()).sort((a,b)=>((a.bbox[0]+a.bbox[2])/2-centre.lng)**2+((a.bbox[1]+a.bbox[3])/2-centre.lat)**2-(((b.bbox[0]+b.bbox[2])/2-centre.lng)**2+((b.bbox[1]+b.bbox[3])/2-centre.lat)**2)).slice(0,16);
      try{
        const collections=await Promise.all(tiles.map(async tile=>{if(cache.has(tile.file))return cache.get(tile.file)!;const c=await readJsonResponse(await fetch(new URL(tile.file,baseUrl),{signal})) as FeatureCollection;if(signal.aborted)throw new DOMException('Aborted','AbortError');cache.set(tile.file,c);return c;}));
        if(disposed||signal.aborted)return;
        const unique=new Map<string|number,Feature>();for(const c of collections)for(const f of c.features)unique.set(f.id??JSON.stringify(f.geometry),f);
        (map!.getSource('details') as maplibregl.GeoJSONSource).setData({type:'FeatureCollection',features:[...unique.values()]});
        while(cache.size>24)cache.delete(cache.keys().next().value!);
        setDetailNote('');
      }catch(err){if(!disposed&&!signal.aborted)setDetailNote('Some street detail could not load. Route calculations still use the imported network.');}
    }
    map.on('moveend',load);void load();
    return()=>{disposed=true;controller?.abort();map.off('moveend',load);};
  },[ready,data.tiles,baseUrl]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map)return;
    const features:FeatureCollection={type:'FeatureCollection',features:props.visibleIndices.map(i=>({type:'Feature',properties:{index:i,selected:i===selected,offset:props.visibleIndices.filter(n=>n!==selected).indexOf(i)%2===0?8:-8,color:routeColour(i,routeChoices(routes))},geometry:{type:'LineString',coordinates:routes[i].coords}}))};
    if(map.getSource('journeys'))(map.getSource('journeys') as maplibregl.GeoJSONSource).setData(features);
    else{
      map.addSource('journeys',{type:'geojson',data:features});
      map.addLayer({id:'alternatives',source:'journeys',type:'line',filter:['==',['get','selected'],false],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','color'],'line-width':4,'line-opacity':.62,'line-offset':['get','offset']}});
      map.addLayer({id:'route-outline',source:'journeys',type:'line',filter:['==',['get','selected'],true],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fffef9','line-width':15}});
      map.addLayer({id:'route-main',source:'journeys',type:'line',filter:['==',['get','selected'],true],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','color'],'line-width':9}});
    }
  },[ready,routes,selected,visibleKey]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map)return;
    const data=showLighting?lighting.collection:empty;
    if(map.getSource('lighting'))(map.getSource('lighting') as maplibregl.GeoJSONSource).setData(data);
    else{
      map.addSource('lighting',{type:'geojson',data});
      map.addLayer({id:'lighting-casing',source:'lighting',type:'line',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fffef9','line-width':6,'line-offset':13}},'route-outline');
      for(const state of ['lit','unlit','unknown'] as LightingState[]){
        map.addLayer({id:'lighting-'+state,source:'lighting',type:'line',filter:['==',['get','state'],state],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':LIGHTING_COLOURS[state],'line-width':state==='unknown'?3:3.5,'line-offset':13,...(state==='lit'?{}:{'line-dasharray':state==='unlit'?[1.4,1.1]:[.3,1.8]})}},'route-outline');
      }
    }
  },[ready,lighting,showLighting]);
  useEffect(()=>{lightingPopupRef.current?.remove();lightingPopupRef.current=null;},[showLighting,selected]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map||!routes.length)return;
    const bounds=new maplibregl.LngLatBounds();props.visibleIndices.forEach(i=>routes[i].coords.forEach(p=>bounds.extend(p)));
    const mobile=window.matchMedia('(max-width:800px)').matches;
    map.resize();map.fitBounds(bounds,{padding:mobile?{top:65,bottom:105,left:35,right:55}:{top:70,bottom:105,left:65,right:65},maxZoom:15.8,duration:0});
  },[ready,routes,visibleKey]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map)return;
    markers.current.forEach(m=>m.remove());markers.current=[];
    const marker=(coord:Coord,cls:string,text:string)=>{const el=document.createElement('div');el.className=cls;el.textContent=text;const m=new maplibregl.Marker({element:el}).setLngLat(coord).addTo(map);markers.current.push(m);};
    const r=routes[selected];
    const labels=(data.labels||data.landmarks.map(l=>({name:l.name,coord:l.coord}))).filter(l=>{const b=map.getBounds();return b.contains(l.coord);}).slice(0,12);
    labels.forEach(l=>marker(l.coord,'neighbourhood-label',l.name));
    marker(origin.requestedCoord||origin.coord,'endpoint-marker start-marker','A');marker(destination.requestedCoord||destination.coord,'endpoint-marker end-marker','B');
    const places:FeatureCollection={type:'FeatureCollection',features:(r?.places||[]).filter(p=>(showOpen&&p.state==='open')||(showHelp&&p.help)||props.focusedPlace?.id===p.id).map(p=>({type:'Feature',properties:{id:p.id,help:p.help},geometry:{type:'Point',coordinates:p.coord}}))};
    if(map.getSource('places'))(map.getSource('places') as maplibregl.GeoJSONSource).setData(places);else{map.addSource('places',{type:'geojson',data:places});map.addLayer({id:'listed-places',source:'places',type:'circle',paint:{'circle-radius':['case',['boolean',['get','help'],false],6,4],'circle-color':['case',['boolean',['get','help'],false],'#577b50','#9eb875'],'circle-stroke-width':2,'circle-stroke-color':'#fffef8'}});}
  },[ready,data,routes,selected,origin,destination,showOpen,showHelp,props.focusedPlace]);
  useEffect(()=>{const map=mapRef.current,p=props.focusedPlace;if(!ready||!map||!p)return;map.easeTo({center:p.coord,zoom:16,duration:0});const popup=new maplibregl.Popup({offset:14}).setLngLat(p.coord).setDOMContent(placePopup(p)).addTo(map);return()=>{popup.remove();};},[ready,props.focusedPlace]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map)return;
    const features:FeatureCollection={type:'FeatureCollection',features:showCameras?(data.cameras||[]).map(p=>({type:'Feature',properties:{id:p.id},geometry:{type:'Point',coordinates:p.coord}})):[]};
    if(map.getSource('cctv'))(map.getSource('cctv') as maplibregl.GeoJSONSource).setData(features);else{map.addSource('cctv',{type:'geojson',data:features});map.addLayer({id:'cctv-points',source:'cctv',type:'circle',paint:{'circle-radius':6,'circle-color':'#796790','circle-stroke-color':'#fffef8','circle-stroke-width':2}});}
  },[ready,data.cameras,showCameras]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map)return;const r=routes[selected];
    const features:FeatureCollection={type:'FeatureCollection',features:showGaps&&r?r.segments.filter(s=>!s.openNearby&&s.coords).map(s=>({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:s.coords!}})):[]};
    if(map.getSource('gaps'))(map.getSource('gaps') as maplibregl.GeoJSONSource).setData(features);else{map.addSource('gaps',{type:'geojson',data:features});map.addLayer({id:'gap-lines',source:'gaps',type:'line',paint:{'line-color':'#c28e43','line-width':3,'line-dasharray':[1,2]}});}
  },[ready,routes,selected,showGaps]);
  function fit(){const map=mapRef.current,r=routes[selected];if(!map||!r)return;const b=new maplibregl.LngLatBounds();r.coords.forEach(p=>b.extend(p));const mobile=window.matchMedia('(max-width:800px)').matches;map.fitBounds(b,{padding:mobile?{top:65,bottom:105,left:35,right:55}:{top:70,bottom:105,left:70,right:70},maxZoom:15.8,duration:0});}
  const selectedRoute=routes[selected],choices=routeChoices(routes);
  return <section className="map-panel" aria-label="Route comparison map"><div ref={container} className="map-canvas"/>{mapError&&<div className="map-fallback"><Layers3 size={28}/><h3>Map unavailable</h3><p>Your route choices are still available.</p></div>}{selectedRoute&&<div className="map-route-pill" style={{borderColor:routeColour(selected,choices)}}><i style={{background:routeColour(selected,choices)}}/><strong>{routeTitle(selected,choices)}</strong><span>{Math.ceil(selectedRoute.minutes)} min</span></div>}{showLighting&&lighting.collection.features.length>0&&<div className="lighting-legend" aria-label="Lighting on selected route"><div><strong><Lightbulb size={13}/>Lighting · selected route</strong><span>Street tags · not live</span></div><ul>{(['lit','unlit','unknown'] as LightingState[]).map(state=><li key={state}><i className={`lighting-swatch ${state}`}/><span>{LIGHTING_LABELS[state]} <b>{Math.round(lighting.percent[state])}%</b></span></li>)}</ul></div>}<div className="map-tools"><button aria-label="Zoom in" onClick={()=>mapRef.current?.zoomIn()}><Plus size={19}/></button><button aria-label="Zoom out" onClick={()=>mapRef.current?.zoomOut()}><Minus size={19}/></button><span/><button aria-label="Fit route to map" onClick={fit}><Maximize2 size={18}/></button></div>{detailNote&&<div className="map-detail-note">{detailNote}</div>}</section>;
}
