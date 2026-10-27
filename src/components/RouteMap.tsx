import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers3, LocateFixed, Minus, Plus, Maximize2 } from 'lucide-react';
import type { Landmark, Route, Snapshot } from '../core/types';
import { istTime } from '../core/hours';
maplibregl.setWorkerUrl(workerUrl);
type Props={data:Snapshot;routes:Route[];selected:number;origin:Landmark;destination:Landmark;showOpen:boolean;showHelp:boolean;showGaps:boolean;onPick:(node:number)=>void};
export function RouteMap({data,routes,selected,origin,destination,showOpen,showHelp,showGaps,onPick}:Props){
  const container=useRef<HTMLDivElement>(null),mapRef=useRef<maplibregl.Map|null>(null);
  const markers=useRef<maplibregl.Marker[]>([]),pickRef=useRef(onPick);
  const [ready,setReady]=useState(false),[mapError,setMapError]=useState(false);
  pickRef.current=onPick;
  useEffect(()=>{
    if(!container.current)return;
    let map:maplibregl.Map;
    let resize:ResizeObserver|undefined;
    try{
      map=new maplibregl.Map({container:container.current,center:[72.827,19.056],zoom:14.8,minZoom:13,maxZoom:18,maxBounds:[[72.805,19.037],[72.850,19.078]],attributionControl:false,style:{version:8,sources:{surfaces:{type:'geojson',data:data.surfaces},roads:{type:'geojson',data:data.roads}},layers:[
        {id:'background',type:'background',paint:{'background-color':'#f0f2e9'}},
        {id:'water',type:'fill',source:'surfaces',filter:['==','kind','water'],paint:{'fill-color':'#dfece8'}},
        {id:'parks',type:'fill',source:'surfaces',filter:['==','kind','park'],paint:{'fill-color':'#dbe5d2','fill-opacity':.85}},
        {id:'buildings',type:'fill',source:'surfaces',filter:['==','kind','building'],paint:{'fill-color':'#e2e5da','fill-outline-color':'#d9ded3'}},
        {id:'roads-casing',type:'line',source:'roads',paint:{'line-color':'#fffef8','line-width':['interpolate',['linear'],['zoom'],13,2,16,11]}},
        {id:'roads-fill',type:'line',source:'roads',paint:{'line-color':'#cbd5c5','line-width':['interpolate',['linear'],['zoom'],13,1,16,3.5]}},
      ]}});
      mapRef.current=map;
      resize=new ResizeObserver(()=>map.resize());resize.observe(container.current);
      map.addControl(new maplibregl.AttributionControl({compact:false,customAttribution:'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · ODbL'}),'bottom-right');
      map.on('load',()=>setReady(true));
      map.on('click',e=>{
        const target=e.originalEvent.target as HTMLElement;
        if(target.closest('.maplibregl-marker')||target.closest('.maplibregl-popup'))return;
        let node=0,best=Infinity;
        data.nodes.forEach((p,i)=>{const d=(p[0]-e.lngLat.lng)**2+(p[1]-e.lngLat.lat)**2;if(d<best){best=d;node=i;}});
        // Do not silently snap a click across an unmapped block or water.
        if(best<.000001)pickRef.current(node);
      });
    }catch {setMapError(true);return;}
    return()=>{resize?.disconnect();setReady(false);map.remove();mapRef.current=null;};
  },[data]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map)return;
    const source='journeys';
    const featureData:FeatureCollection={type:'FeatureCollection',features:routes.map((r,i)=>({type:'Feature',properties:{selected:i===selected,index:i},geometry:{type:'LineString',coordinates:r.coords}}))};
    if(map.getSource(source))(map.getSource(source) as maplibregl.GeoJSONSource).setData(featureData);
    else{
      map.addSource(source,{type:'geojson',data:featureData});
      map.addLayer({id:'route-alternatives',type:'line',source,filter:['==','selected',false],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#8eaaa3','line-width':5,'line-opacity':.8}});
      map.addLayer({id:'route-outline',type:'line',source,filter:['==','selected',true],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fffef9','line-width':10}});
      map.addLayer({id:'route-main',type:'line',source,filter:['==','selected',true],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#276b58','line-width':5}});
    }
    const route=routes[selected];
    if(route){const bounds=new maplibregl.LngLatBounds();route.coords.forEach(p=>bounds.extend(p));map.resize();map.fitBounds(bounds,{padding:map.getContainer().clientWidth<600?{top:90,bottom:100,left:50,right:50}:{top:110,bottom:110,left:80,right:80},maxZoom:15.8,duration:0});}
  },[routes,selected,ready]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready)return;
    markers.current.forEach(m=>m.remove());markers.current=[];
    function marker(coord:[number,number],className:string,text:string,popup?:HTMLElement){const el=document.createElement('div');el.className=className;el.textContent=text;const m=new maplibregl.Marker({element:el}).setLngLat(coord).addTo(map!);if(popup)m.setPopup(new maplibregl.Popup({offset:14,closeButton:true}).setDOMContent(popup));markers.current.push(m);return el;}
    for(const item of data.landmarks.filter(l=>!l.name.includes('Hospital')&&l.node!==origin.node&&l.node!==destination.node))marker(item.coord,'neighbourhood-label',item.name.replace(' approach',''));
    const roadNames=new Set<string>();
    for(const f of data.roads.features){const props=f.properties;if(!props?.name||roadNames.has(props.name)||!['secondary','tertiary','primary'].includes(props.kind)||f.geometry.type!=='LineString')continue;const c=f.geometry.coordinates;if(c.length<4)continue;roadNames.add(props.name);if(roadNames.size>12)break;marker(c[Math.floor(c.length/2)] as [number,number],'road-label',props.name);}
    const r=routes[selected];
    if(r){
      for(const p of r.places){
        if(!((showOpen&&p.state==='open')||(showHelp&&p.help)))continue;
        const popup=document.createElement('div');const title=document.createElement('strong');title.textContent=p.name;
        const subtitle=document.createElement('p');subtitle.textContent=`${p.category.replaceAll('_',' ')} · ${p.state==='open'?'Listed open':p.state==='closed'?'Listed closed':'Hours unknown'} at ${istTime(p.passingAt)}`;
        const note=document.createElement('small');note.textContent=`${p.hours?'Schedule: '+p.hours+'. ':''}Entrance and current operation have not been verified.`;popup.append(title,subtitle,note);
        marker(p.coord,`place-marker ${p.help?'help-marker':''}`,p.help?'+':'',popup);
      }
    }
    const a=marker(origin.coord,'endpoint-marker start-marker','A');a.setAttribute('aria-label','Starting point: '+origin.name);
    const b=marker(destination.coord,'endpoint-marker end-marker','B');b.setAttribute('aria-label','Destination: '+destination.name);
    if(r){const mid=r.coords[Math.floor(r.coords.length/2)];marker(mid,'route-duration',`${Math.ceil(r.minutes)} min walk`);}
  },[data,ready,routes,selected,origin,destination,showOpen,showHelp]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map)return;
    const route=routes[selected];
    const collection:FeatureCollection={type:'FeatureCollection',features:showGaps&&route?route.segments.filter(s=>!s.openNearby).map(s=>{const e=data.edges[s.edge];return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[data.nodes[e.a],data.nodes[e.b]]}}}):[]};
    if(map.getSource('gaps'))(map.getSource('gaps') as maplibregl.GeoJSONSource).setData(collection);else{map.addSource('gaps',{type:'geojson',data:collection});map.addLayer({id:'gaps-line',source:'gaps',type:'line',paint:{'line-color':'#c28e43','line-width':3,'line-dasharray':[1,2]}});}
  },[data,ready,routes,selected,showGaps]);
  function fit(){const map=mapRef.current,r=routes[selected];if(map&&r){const b=new maplibregl.LngLatBounds();r.coords.forEach(p=>b.extend(p));map.fitBounds(b,{padding:100,maxZoom:15.8});}}
  return <section className="map-panel" aria-label="Walking route map">
    <div ref={container} className="map-canvas" />
    {mapError&&<div className="map-fallback"><Layers3 size={32}/><h3>Your browser couldn’t load the map.</h3><p>The route cards and street-by-street details below contain the same journey information.</p></div>}
    <div className="map-location"><span className="location-dot"/><div><strong>Bandra West</strong><span>Mumbai, Maharashtra</span></div><span className="pilot-mini">PILOT AREA</span></div>
    <div className="map-tools"><button aria-label="Zoom in" onClick={()=>mapRef.current?.zoomIn()}><Plus size={19}/></button><button aria-label="Zoom out" onClick={()=>mapRef.current?.zoomOut()}><Minus size={19}/></button><span/><button aria-label="Fit route to map" onClick={fit}><Maximize2 size={17}/></button></div>
    <div className="map-note"><LocateFixed size={15}/><span>Click a street to choose a mapped point</span></div>
    <div className="map-legend"><div><i className="legend-route"/>Your selected walk</div>{showOpen&&<div><i className="legend-place"/>Listed open</div>}{showHelp&&<div><i className="legend-help">+</i>Listed help point</div>}{showGaps&&<div><i className="legend-gap"/>No listed open place nearby</div>}</div>
    <div className="offline-label">Bundled street map · No live conditions</div>
  </section>;
}
