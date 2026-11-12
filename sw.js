/* tsapc · service worker (Fase 1, paso 3)
   Dos cajones:
   - APP: páginas, estilos y scripts. Lleva versión (huella del contenido): cada versión nueva lo renueva entero.
   - MEDIA: imágenes, PDF y fuentes. Sobrevive a las actualizaciones; guarda como máximo MEDIA_MAX archivos (400: caben todas las imágenes de los repasos, los PDF y las fuentes) y,
     si se llena, borra primero lo que hace más tiempo que no se abre (fecha de uso en la cabecera x-tsapc-uso).
   El progreso NO vive aquí (está en localStorage): ninguna actualización lo toca.
   No se activa solo: la página enseña «Nueva versión» y, al pulsar «Actualizar», manda SKIP_WAITING.
   Si una instalación no consigue bajar lo esencial, falla y sigue el service worker anterior.
   La versión se calcula con: node scripts/sw-version.mjs */
const VERSION = "ae36114d79bd";
const APP = "tsapc-app-" + VERSION, MEDIA = "tsapc-media", MEDIA_MAX = 400, OFFLINE = "offline.html";
const SHELL = ["./", "offline.html", "manifest.webmanifest", "assets/copia.js", "assets/sw-register.js", "assets/especimen.js", "assets/practica.css", "assets/practica.js", "assets/repaso.css", "assets/repaso.js", "assets/unidades.css", "bio1/repaso/", "bio1/simulacro/", "bio2/repaso/", "bio2/simulacro/", "bio3/repaso/", "bio3/simulacro/", "bio3/entender/", "bio3/aprende/", "fisio1/repaso/", "fisio1/simulacro/", "fisio2/repaso/", "fisio2/simulacro/", "fisio3/repaso/", "fisio3/simulacro/", "fisio4/repaso/", "gest1/repaso/", "gest1/simulacro/", "gest2/repaso/", "gest2/simulacro/", "ingles1/examen-vocabulario/", "ingles1/examen/", "ingles1/repaso/", "ingles1/simulacro-vocabulario/", "ingles1/simulacro/", "ingles1/vocabulario/", "ipe-tema5/repaso/", "ipe-tema5/simulacro/", "ipe2/repaso/", "ipe2/simulacro/", "ipe-tema4/repaso/", "lab1/banco/", "lab1/repaso/", "lab1/test-50-b/", "lab1/test-50/", "lab2/repaso/", "lab2/simulacro/", "assets/logo.svg", "assets/icon-192.png", "assets/icon-512.png", "app/", "centro/", "centro/fuentes.css", "app/app.js", "app/quiz.js", "app/sm2.js", "app/estudio.js", "app/sesion.js", "app/sesiones/indice.json", "app/sesiones/lab1-vidrio.json", "app/sesiones/lab1-volumenes.json", "app/sesiones/lab1-pipetas.json", "app/sesiones/lab1-cristaleria.json", "app/sesiones/lab1-porcelana.json", "app/sesiones/lab1-equipos1.json", "app/sesiones/lab1-equipos2.json", "app/sesiones/lab2-normas.json", "app/sesiones/lab2-epi.json", "app/sesiones/lab2-agentes.json", "app/sesiones/lab2-etiquetas.json", "app/sesiones/lab2-prevencion.json", "app/sesiones/lab2-equiposa.json", "app/sesiones/lab2-equiposb.json", "app/sesiones/lab2-residuos1.json", "app/sesiones/lab2-residuos2.json", "app/sesiones/lab2-emergencia.json", "app/sesiones/lab2-accidentes.json", "app/sesiones/bio1-cultivo.json", "app/sesiones/bio1-crecimiento.json", "app/sesiones/bio1-lineas.json", "app/sesiones/bio1-procedimientos.json", "app/sesiones/bio1-recuento.json", "app/sesiones/bio1-mantenimiento.json", "app/sesiones/bio1-pase.json", "app/sesiones/bio1-aplicaciones.json", "app/sesiones/bio2-cromosoma.json", "app/sesiones/bio2-numero.json", "app/sesiones/bio2-muestra.json", "app/sesiones/bio2-extension.json", "app/sesiones/bio2-tincion.json", "app/sesiones/bio2-bandas.json", "app/sesiones/bio2-nomenclatura.json", "app/sesiones/bio2-cariotipo.json", "app/sesiones/lab1-limpieza.json", "app/sesiones/lab1-agua.json", "app/sesiones/lab1-reactivos.json", "app/sesiones/lab1-pnt.json", "app/sesiones/bio3-nucleotido.json", "app/sesiones/bio3-propiedades.json", "app/sesiones/bio3-helice.json", "app/sesiones/bio3-tipos.json", "app/sesiones/bio3-arn.json", "app/sesiones/bio3-flujo.json", "app/sesiones/bio3-replicacion.json", "app/sesiones/bio3-enzimas.json", "app/sesiones/bio3-transcripcion.json", "app/sesiones/bio3-maduracion.json", "app/sesiones/bio3-codigo.json", "app/sesiones/bio3-traduccion.json", "app/sesiones/bio3-mutaciones.json", "app/sesiones/fisio4-corazon.json", "app/sesiones/fisio4-latido.json", "app/sesiones/fisio4-vasos.json", "app/sesiones/fisio4-presion.json", "app/sesiones/fisio4-hemostasia.json", "app/sesiones/fisio4-frenos.json", "app/sesiones/fisio4-aneurisma.json", "app/sesiones/fisio4-trombosis.json", "app/sesiones/fisio4-embolia.json", "app/sesiones/fisio4-ictus.json", "app/sesiones/fisio4-cardiaca.json", "app/sesiones/fisio4-tension.json", "app/sesiones/fisio4-edema.json", "app/sesiones/fisio4-coagulopatias.json", "app/sesiones/fisio4-rinon.json", "app/sesiones/fisio4-orina.json", "app/sesiones/fisio4-manifestaciones.json", "app/sesiones/fisio4-renal.json", "app/sesiones/ipe2-ruido.json", "app/sesiones/ipe2-vibraciones.json", "app/sesiones/ipe2-termico.json", "app/sesiones/ipe2-radiaciones.json", "app/sesiones/ipe2-quimicos.json", "app/sesiones/ipe2-control.json", "app/sesiones/ipe2-biologicos.json", "app/sesiones/ipe-tema5-pas.json", "app/sesiones/ipe-tema5-triaje.json", "app/sesiones/ipe-tema5-svb.json", "app/sesiones/ipe-tema5-rcp.json", "app/sesiones/ipe-tema5-atragantamiento.json", "app/sesiones/ipe-tema5-hemorragias.json", "app/sesiones/ipe-tema5-quemaduras.json", "app/sesiones/ipe-tema5-traumatismos.json", "app/sesiones/ipe-tema5-consciencia.json","app/preguntas/bio1.json", "app/preguntas/bio2.json", "app/preguntas/bio3.json", "app/preguntas/fisio1.json", "app/preguntas/fisio2.json", "app/preguntas/fisio3.json", "app/preguntas/fisio4.json", "app/preguntas/gest1.json", "app/preguntas/gest2.json", "app/preguntas/ingles1.json", "app/preguntas/ipe2.json", "app/preguntas/ipe-tema4.json", "app/preguntas/ipe-tema5.json", "app/preguntas/lab1.json", "app/preguntas/lab2.json", "app/app.css", "app/datos.js", "app/logica.js", "app/mov.js","app/manifest.webmanifest", "assets/store.js", "assets/corte/tokens.css", "assets/corte/base.css", "assets/corte/texturas.css", "assets/corte/componentes.css", "assets/corte/iconos.svg", "docs/corte/agenda-2026-27.json", "assets/corte/fuentes/atkinson-400-italic.woff2", "assets/corte/fuentes/atkinson-400.woff2", "assets/corte/fuentes/atkinson-700.woff2", "assets/corte/fuentes/atkinson-mono-var.woff2", "assets/corte/fuentes/caveat-600.woff2", "assets/corte/fuentes/fraunces-italic-500.woff2", "assets/corte/fuentes/fraunces-var.woff2"];
/* sin esto no se instala: la portada, la página sin conexión y el código común */
const ESENCIAL = ["./", "offline.html", "manifest.webmanifest", "assets/copia.js", "assets/sw-register.js", "assets/practica.css", "assets/practica.js", "assets/repaso.css", "assets/repaso.js", "assets/unidades.css"];
/* otros sitios cuyos archivos se guardan (fuentes y librerías); el resto pasa sin tocar */
const ORIGENES = ["https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"];
/* cajones propios (los de ahora y los nombres que usaron versiones anteriores de esta web); el dominio se comparte con otros proyectos */
const PROPIOS = /^tsapc-(app-[0-9a-f]{12}|media|[0-9a-f]{8}|copia2|lab2a1c7)$/;
const esNuestra = (u) => u.origin === SCOPE.origin ? u.pathname.startsWith(SCOPE.pathname) : ORIGENES.includes(u.origin);
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
        if (!PROPIOS.test(name) || name === APP || name === MEDIA) continue;
        try {
          const old = await caches.open(name);
          for (const req of await old.keys()) {
            try {
              const u = new URL(req.url), dest = isMedia(u) ? media : app;
              if (!esNuestra(u)) continue;
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
  const hit = (await media.match(r)) || (await (await caches.open(APP)).match(r));    // los iconos precargados están en APP (nunca cachés ajenas)
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
    if (r.mode === "navigate") { const off = await (await caches.open(APP)).match(urlDe(OFFLINE)); if (off) return off; }
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
  /* las navegaciones se guardan sin «?…»: con ?x=1…N la caché no crece */
  const clave = r.mode === "navigate" ? (() => { const u = new URL(r.url); u.search = ""; return u.href; })() : r;
  const net = fetch(r).then((res) => { if (res.ok) return app.put(clave, res.clone()).catch(() => {}).then(() => res); return res; });
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
