import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../../public/sw.js',import.meta.url),'utf8');
test('offline help never intercepts route POSTs, APIs or map databases',()=>{
  const listeners:Record<string,(e:any)=>void>={};
  runInNewContext(source,{URL,self:{location:{href:'https://example.org/app/sw.js'},addEventListener:(n:string,fn:(e:any)=>void)=>listeners[n]=fn},caches:{},fetch:()=>{throw new Error('Unexpected fetch');}});
  for(const [method,path] of [['POST','api/routing/route'],['GET','api/routing/health'],['GET','data/mumbai/places-extra.json.gz']]){let intercepted=false;listeners.fetch({request:{method,url:'https://example.org/app/'+path,mode:'cors'},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false);}
});
test('offline navigation returns public contacts without saving navigation URLs',async()=>{
  const listeners:Record<string,(e:any)=>void>={},matched:string[]=[];
  runInNewContext(source,{URL,self:{location:{href:'https://example.org/app/sw.js'},addEventListener:(n:string,fn:(e:any)=>void)=>listeners[n]=fn},caches:{match:async(url:string)=>{matched.push(url);return 'offline-help';}},fetch:async()=>{throw new Error('offline');}});
  let result:Promise<unknown>|undefined;listeners.fetch({request:{method:'GET',url:'https://example.org/app/?review=test',mode:'navigate'},respondWith:(p:Promise<unknown>)=>result=p});assert.equal(await result,'offline-help');assert.deepEqual(matched,['https://example.org/app/offline.html']);
});
