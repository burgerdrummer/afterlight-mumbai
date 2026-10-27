import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, MapPin, Search } from 'lucide-react';
import type { Landmark } from '../core/types';
export function LocationPicker({label,value,items,onChange,letter}:{label:string;value:Landmark;items:Landmark[];onChange:(item:Landmark)=>void;letter:string}){
  const [query,setQuery]=useState(value.name),[open,setOpen]=useState(false),[active,setActive]=useState(0),ref=useRef<HTMLDivElement>(null);
  useEffect(()=>setQuery(value.name),[value]);
  useEffect(()=>{const close=(e:MouseEvent)=>{if(!ref.current?.contains(e.target as Node)){setOpen(false);setQuery(value.name);}};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);},[value]);
  const filtered=useMemo(()=>{const words=query.toLocaleLowerCase().trim().split(/\s+/),found:Landmark[]=[];for(const item of items){if(words.every(w=>(item.name+' '+item.subtitle).toLocaleLowerCase().includes(w)))found.push(item);if(found.length===8)break;}return found;},[query,items]);
  function choose(item:Landmark){onChange(item);setQuery(item.name);setOpen(false);setActive(0);}
  return <div className="location-input" ref={ref}><span className={`input-dot ${letter==='B'?'destination-dot':''}`}>{letter==='B'&&<MapPin size={16}/>}</span><div className="location-field"><label htmlFor={'location-'+letter}>{label}</label><input id={'location-'+letter} value={query} role="combobox" aria-expanded={open} aria-controls={'options-'+letter} aria-activedescendant={open&&filtered[active]?'option-'+letter+'-'+active:undefined} aria-autocomplete="list" autoComplete="off" placeholder="Search Mumbai places or neighbourhoods" onFocus={()=>{setQuery('');setOpen(true);setActive(0);}} onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(0);}} onBlur={e=>{if(!ref.current?.contains(e.relatedTarget as Node)){setOpen(false);setQuery(value.name);}}} onKeyDown={e=>{
    if(e.key==='Escape'){setOpen(false);setQuery(value.name);}
    if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(n=>Math.min(n+1,filtered.length-1));}
    if(e.key==='ArrowUp'){e.preventDefault();setActive(n=>Math.max(n-1,0));}
    if(e.key==='Enter'&&open&&filtered[active]){e.preventDefault();choose(filtered[active]);}
  }}/></div><Search size={17} className="search-symbol"/>{open&&<div className="location-options" id={'options-'+letter} role="listbox" aria-label={label+' suggestions'}>{filtered.map((l,i)=><button type="button" role="option" tabIndex={-1} id={'option-'+letter+'-'+i} aria-selected={active===i} className={active===i?'active-option':''} key={l.id+'-'+l.name} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(l)}><MapPin size={17}/><span><strong>{l.name}</strong><small>{l.subtitle}</small></span>{l.id===value.id&&<Check size={16}/>}</button>)}{!filtered.length&&<p>No matching mapped place. Try a neighbourhood, station, or a point on the map.</p>}</div>}</div>;
}
