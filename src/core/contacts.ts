import type { JourneyRoute } from './types';
export type PublicContact={id:string;name:string;number:string;kind:'call'|'whatsapp';scope:string;source:string;reviewed:string};
export const CONTACTS:PublicContact[]=[
  {id:'112',name:'Emergency assistance',number:'112',kind:'call',scope:'Police, fire and medical emergency · India',source:'https://sdma.maharashtra.gov.in/en/',reviewed:'2026-10-27'},
  {id:'108',name:'Emergency ambulance',number:'108',kind:'call',scope:'Maharashtra emergency medical service',source:'https://phd.maharashtra.gov.in/en/helpline/emergency-medical-service/',reviewed:'2026-10-27'},
  {id:'101',name:'Fire Brigade',number:'101',kind:'call',scope:'Fire emergency · Mumbai',source:'https://maharashtracdhg.gov.in/cde/blackout/Advisory%20for%20Housing%20Societies.pdf',reviewed:'2026-10-27'},
  {id:'1916',name:'BMC disaster management',number:'1916',kind:'call',scope:'Mumbai civic disasters, flooding and disruptions',source:'https://dm.mcgm.gov.in/',reviewed:'2026-10-27'},
  {id:'139',name:'RailMadad',number:'139',kind:'call',scope:'Railway assistance, security and medical support',source:'https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=1703201&lang=2&reg=48',reviewed:'2026-10-27'},
  {id:'1033',name:'National Highways assistance',number:'1033',kind:'call',scope:'NHAI tolled highway stretches · coverage depends on the road operator',source:'https://ihmcl.co.in/24x7-national-highways-helpline-1033-page/',reviewed:'2026-10-27'},
  {id:'traffic',name:'Mumbai Traffic Police',number:'8454999999',kind:'whatsapp',scope:'Traffic reporting on WhatsApp · not an emergency dispatch call',source:'https://www.mumbaipolice.gov.in/impcontacts',reviewed:'2026-10-27'},
];
export function contactLink(c:PublicContact){return c.kind==='whatsapp'?`https://wa.me/91${c.number}`:`tel:${c.number}`;}
export function phoneLink(phone?:string){if(!phone)return null;const first=phone.split(/[;,]/)[0].trim();if(!/^\+?[\d\s()-]{3,25}$/.test(first))return null;return 'tel:'+first.replace(/[^+\d]/g,'');}
export function routeContacts(route?:JourneyRoute){const rail=!!route?.places.some(p=>p.category==='station'||/railway|train_station|metro_station/.test(p.category));return CONTACTS.map(c=>({...c,relevant:['112','108','101','1916'].includes(c.id)||(c.id==='139'&&rail)||(c.id==='1033'&&!!route?.highwayAssistance)||(c.id==='traffic'&&!!route&&route.mode!=='walk')})).sort((a,b)=>Number(b.relevant)-Number(a.relevant));}
