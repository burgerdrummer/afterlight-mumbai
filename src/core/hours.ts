import OpeningHours from 'opening_hours';
import type { HoursState, Place } from './types';
const parsers = new Map<string, OpeningHours | null>();
/** Pass an absolute instant. opening_hours evaluates in the host timezone, so
 * create an IST wall-clock Date from UTC fields before evaluation. India has no
 * DST. Holidays and unsupported/ambiguous expressions remain unknown.
 */
export function hoursState(expression:string|null|undefined,instant:Date):HoursState {
  if(!expression || !Number.isFinite(instant.getTime())) return 'unknown';
  // An uncertain schedule cannot substantiate a route preference.
  if(/\b(PH|SH)\b|sunrise|sunset|dawn|dusk|\|\||"|\bunknown\b|\boff\b.*\+/i.test(expression)) return 'unknown';
  if(!parsers.has(expression)) {
    try {parsers.set(expression,new OpeningHours(expression,{lat:19.055,lon:72.828,address:{country_code:'in',state:'Maharashtra'}}));}
    catch {parsers.set(expression,null);}
  }
  const parser=parsers.get(expression);
  if(!parser)return 'unknown';
  const ist=new Date(instant.getTime()+330*60000);
  const localWallTime=new Date(ist.getUTCFullYear(),ist.getUTCMonth(),ist.getUTCDate(),ist.getUTCHours(),ist.getUTCMinutes(),ist.getUTCSeconds());
  try {
    if(parser.getUnknown(localWallTime)) return 'unknown';
    return parser.getState(localWallTime)?'open':'closed';
  }catch {return 'unknown';}
}
export function placeState(place:Place,instant:Date):HoursState {return hoursState(place.hours,instant);}
export function istInputToDate(input:string):Date {return new Date(input+':00+05:30');}
export function istDateInput(now=new Date()) {
  const ist=new Date(now.getTime()+330*60000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth()+1).padStart(2,'0')}-${String(ist.getUTCDate()).padStart(2,'0')}`;
}
export function istDateTimeInput(now=new Date()) {
  const ist=new Date(now.getTime()+330*60000);
  return {date:istDateInput(now),time:`${String(ist.getUTCHours()).padStart(2,'0')}:${String(ist.getUTCMinutes()).padStart(2,'0')}`};
}
export const istTime=(instant:string|Date) => new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(instant));
