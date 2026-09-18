const CACHE="english-quiz-v4.1.0";
const CORE=["./","./index.html","./app.js","./manifest.webmanifest","./icon-192.png","./icon-512.png"];

self.addEventListener("install",e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;

  const url=new URL(e.request.url);

  // External dictionary requests are not intercepted by the service worker.
  if(url.origin!==self.location.origin) return;

  // Core app files: network first, cache fallback.
  e.respondWith(
    fetch(e.request,{cache:"no-store"})
      .then(r=>{
        const cp=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,cp));
        return r;
      })
      .catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html")))
  );
});