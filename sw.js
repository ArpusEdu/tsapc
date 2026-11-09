/* tsapc · service worker (Fase 1, paso 3)
   Dos cajones:
   - APP: páginas, estilos y scripts. Lleva versión (huella del contenido): cada versión nueva lo renueva entero.
   - MEDIA: imágenes, PDF y fuentes. Sobrevive a las actualizaciones; guarda como máximo MEDIA_MAX archivos y,
     si se llena, borra primero lo que hace más tiempo que no se abre (fecha de uso en la cabecera x-tsapc-uso).
   El progreso NO vive aquí (está en localStorage): ninguna actualización lo toca.
   No se activa solo: la página enseña «Nueva versión» y, al pulsar «Actualizar», manda SKIP_WAITING.
   Si una instalación no consigue bajar lo esencial, falla y sigue el service worker anterior.
   La versión se calcula con: node scripts/sw-version.mjs */
const VERSION = "d5cc59e9242c";
const APP = "tsapc-app-" + VERSION, MEDIA = "tsapc-media", MEDIA_MAX = 120, OFFLINE = "offline.html";
const SHELL = ["./", "offline.html", "manifest.webmanifest", "assets/copia.js", "assets/sw-register.js", "assets/especimen.js", "assets/practica.css", "assets/practica.js", "assets/repaso.css", "assets/repaso.js", "assets/unidades.css", "bio1/repaso/", "bio1/simulacro/", "bio2/repaso/", "bio2/simulacro/", "bio3/repaso/", "bio3/simulacro/", "fisio1/repaso/", "fisio1/simulacro/", "fisio2/repaso/", "fisio2/simulacro/", "fisio3/repaso/", "fisio3/simulacro/", "gest1/repaso/", "gest1/simulacro/", "gest2/repaso/", "gest2/simulacro/", "ingles1/examen-vocabulario/", "ingles1/examen/", "ingles1/repaso/", "ingles1/simulacro-vocabulario/", "ingles1/simulacro/", "ingles1/vocabulario/", "ipe-tema5/repaso/", "ipe-tema5/simulacro/", "ipe2/repaso/", "ipe2/simulacro/", "lab1/banco/", "lab1/repaso/", "lab1/test-50-b/", "lab1/test-50/", "lab2/repaso/", "lab2/simulacro/", "assets/logo.svg", "assets/icon-192.png", "assets/icon-512.png", "app/", "app/app.js", "app/app.css", "app/datos.js", "app/logica.js", "app/manifest.webmanifest", "assets/store.js", "assets/corte/tokens.css", "assets/corte/base.css", "assets/corte/texturas.css", "assets/corte/componentes.css", "assets/corte/iconos.svg", "docs/corte/agenda-2026-27.json", "assets/corte/fuentes/atkinson-400-italic.woff2", "assets/corte/fuentes/atkinson-400.woff2", "assets/corte/fuentes/atkinson-700.woff2", "assets/corte/fuentes/atkinson-mono-var.woff2", "assets/corte/fuentes/caveat-600.woff2", "assets/corte/fuentes/fraunces-italic-500.woff2", "assets/corte/fuentes/fraunces-var.woff2"];
/* sin esto no se instala: la portada, la página sin conexión y el código común */
const ESENCIAL = ["./", "offline.html", "manifest.webmanifest", "assets/copia.js", "assets/sw-register.js", "assets/practica.css", "assets/practica.js", "assets/repaso.css", "assets/repaso.js", "assets/unidades.css"];
/* otros sitios cuyos archivos se guardan (fuentes y librerías); el resto pasa sin tocar */
const ORIGENES = ["https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://unpkg.com"];
const SCOPE = new URL("./", self.location);
const MEDIA_RE = /\.(pdf|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|mp3|mp4|webm)$/i;
const SEMANA = 7 * 24 * 3600 * 1000;
const isMedia = (u) => MEDIA_RE.test(u.pathname) || u.hostname === "fonts.gstatic.com";
const urlDe = (u) => new URL(u, SCOPE).href;
let seq = 0;
const ahora = () => Date.now() * 1000 + (seq++ % 1000);          // fecha de uso única y creciente (µs falsos)

/* --- instalar --- */
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(APP);
    const req = (u) => new Request(urlDe(u), { cache: "reload" });
    await c.addAll(ESENCIAL.map(req));                               // si falla, la instalación falla: sigue el SW anterior
    await Promise.all(SHELL.filter((u) => !ESENCIAL.includes(u)).map((u) => c.add(req(u)).catch(() => {})));
  })());
});

/* --- activar: se rescata lo guardado en los cajones viejos y luego se borran --- */
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    try {
      const app = await caches.open(APP), media = await caches.open(MEDIA);
      for (const name of await caches.keys()) {
        if (!name.startsWith("tsapc-") || name === APP || name === MEDIA) continue;
        try {
          const old = await caches.open(name);
          for (const req of await old.keys()) {
            try {
              const u = new URL(req.url), dest = isMedia(u) ? media : app;
              if (await dest.match(req)) continue;
              const res = await old.match(req);
              if (!res || res.status !== 200) continue;
              await dest.put(req, isMedia(u) ? marcar(res) : res);
            } catch (_) {}
          }
          await caches.delete(name);
        } catch (_) {}
      }
      await trim(media);
    } catch (_) {
    } finally {
      await self.clients.claim();
    }
  })());
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") e.waitUntil(self.skipWaiting());
});

/* --- cajón de archivos: fecha de uso y límite --- */
function marcar(res) {
  const h = new Headers(res.headers); h.set("x-tsapc-uso", String(ahora()));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
const usado = (res) => +(res.headers.get("x-tsapc-uso") || 0);
async function trim(media) {
  const keys = await media.keys();
  if (keys.length <= MEDIA_MAX) return;
  const conFecha = [];
  for (const k of keys) { const r = await media.match(k); conFecha.push([r ? usado(r) : 0, k]); }
  conFecha.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < conFecha.length - MEDIA_MAX; i++) await media.delete(conFecha[i][1]);
}
async function guardar(media, r, res) {
  await media.put(r, marcar(res)); await trim(media);
}

/* --- peticiones --- */
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (!/^https?:$/.test(u.protocol)) return;
  const propio = u.origin === SCOPE.origin;
  if (propio && !u.pathname.startsWith(SCOPE.pathname)) return;    // otras webs del mismo dominio: no son nuestras
  if (!propio && !ORIGENES.includes(u.origin)) return;              // sitios externos no previstos: pasan sin tocar
  if (isMedia(u)) return e.respondWith(fromMedia(r, e));
  if (!propio) return e.respondWith(staleWhileRevalidate(r, e));
  e.respondWith(networkFirst(r, e));
});

/* imágenes, PDF y fuentes: primero lo guardado; si no está, se descarga y se guarda por detrás */
async function fromMedia(r, e) {
  if (r.headers.has("range")) return fetch(r);                      // vídeo y audio a trozos: directo de la red
  const media = await caches.open(MEDIA);
  const hit = (await media.match(r)) || (await caches.match(r));    // los iconos precargados están en APP
  if (hit) {
    const viejo = Date.now() - usado(hit) / 1000 > SEMANA;
    e.waitUntil((async () => {
      try {
        if (viejo) { const res = await fetch(r); if (res.status === 200 && res.type !== "opaque") return guardar(media, r, res); }
        if (await media.match(r)) await media.put(r, marcar(hit.clone()));    // «tocar»: pasa a ser lo más reciente
      } catch (_) {}
    })());
    return hit;
  }
  try {
    const res = await fetch(r);
    if (res.status === 200 && res.type !== "opaque") e.waitUntil(guardar(media, r, res.clone()).catch(() => {}));
    return res;
  } catch (err) {
    if (r.mode === "navigate") { const off = await caches.match(urlDe(OFFLINE)); if (off) return off; }
    throw err;
  }
}

/* fuentes y librerías de otros sitios: lo guardado al momento y, por detrás, se refresca */
async function staleWhileRevalidate(r, e) {
  const app = await caches.open(APP), hit = await app.match(r);
  const net = fetch(r).then((res) => { if (res.ok && res.type !== "opaque") return app.put(r, res.clone()).catch(() => {}).then(() => res); return res; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

/* páginas, estilos y scripts: primero la red para ver siempre lo último; si falla o tarda 3,5 s, lo guardado */
async function networkFirst(r, e) {
  const app = await caches.open(APP);
  const net = fetch(r).then((res) => { if (res.ok) return app.put(r, res.clone()).catch(() => {}).then(() => res); return res; });
  e.waitUntil(net.catch(() => {}));
  const late = new Promise((ok) => setTimeout(() => ok(null), 3500));
  try { const res = await Promise.race([net, late]); if (res) return res; } catch (_) {}
  const hit = await app.match(r, { ignoreSearch: r.mode === "navigate" });
  if (hit) return hit;
  try { return await net; }
  catch (err) {
    if (r.mode === "navigate") { const off = await app.match(urlDe(OFFLINE)); if (off) return off; }
    throw err;
  }
}
