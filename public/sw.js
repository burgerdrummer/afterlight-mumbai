// Intentionally small offline footprint. Never cache journeys, API requests,
// opening-hour data or map databases. Offline navigation shows public contacts.
const CACHE='afterlight-help-v07';
const root=new URL('./',self.location.href);
const files=['offline.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
const urls=files.map(p=>new URL(p,root).href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('afterlight-help-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);if(url.origin!==root.origin)return;
  if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('offline.html',root).href)));return;}
  if(urls.includes(url.href))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
