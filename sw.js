/* Sin internet: primero la red para ver siempre lo último; si falla o tarda, lo guardado.
   Las páginas se guardan al instalar; imágenes y PDF, la primera vez que se abren. */
const CACHE="tsapc-4e2a1b8c";
const SHELL=["./", "manifest.webmanifest", "assets/especimen.js", "assets/practica.css", "assets/practica.js", "assets/repaso.css", "assets/repaso.js", "assets/unidades.css", "bio1/repaso/", "bio1/simulacro/", "bio2/repaso/", "bio2/simulacro/", "fisio1/repaso/", "fisio1/simulacro/", "fisio2/repaso/", "fisio2/simulacro/", "fisio3/repaso/", "fisio3/simulacro/", "gest1/repaso/", "gest1/simulacro/", "gest2/repaso/", "gest2/simulacro/", "ingles1/examen-vocabulario/", "ingles1/examen/", "ingles1/repaso/", "ingles1/simulacro-vocabulario/", "ingles1/simulacro/", "ingles1/vocabulario/", "ipe-tema5/repaso/", "ipe-tema5/simulacro/", "ipe2/repaso/", "ipe2/simulacro/", "lab1/banco/", "lab1/repaso/", "lab1/test-50-b/", "lab1/test-50/", "assets/icon-192.png", "assets/icon-512.png"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>Promise.all(SHELL.map(u=>c.add(new Request(new URL(u,self.location),{cache:"reload"})).catch(()=>{})))))});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("tsapc-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);if(!/^https?:$/.test(u.protocol))return;
  const same=u.origin===self.location.origin;if(same&&!u.pathname.startsWith(new URL(".",self.location).pathname))return;
  e.respondWith((async()=>{const c=await caches.open(CACHE);
    if(!same){const hit=await c.match(r);if(hit)return hit;const res=await fetch(r);if(res.ok||res.type==="opaque")c.put(r,res.clone());return res}
    const net=fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res});
    const late=new Promise(ok=>setTimeout(()=>ok(null),3500));
    try{const res=await Promise.race([net,late]);if(res)return res}catch(_){}
    const hit=await c.match(r,{ignoreSearch:r.mode==="navigate"});if(hit)return hit;
    return net})())});
