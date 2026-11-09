/* Pruebas del service worker (sw.js) en un entorno simulado: cachés, red y eventos. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { shellVersion } from "../scripts/sw-version.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const SCOPE = "https://arpusedu.github.io/tsapc/";
const num = (re) => +SRC.match(re)[1];
const VERSION = SRC.match(/const VERSION\s*=\s*"([^"]+)"/)[1];
const MEDIA_MAX = num(/MEDIA_MAX\s*=\s*(\d+)/);
const SHELL = JSON.parse(SRC.match(/const SHELL\s*=\s*(\[[^\]]*\])/)[1]);

/* --- cachés simuladas: conservan el orden de inserción, como la Cache API --- */
class FakeCache {
  constructor() { this.m = new Map(); }
  key(r, ignoreSearch) { const u = new URL(typeof r === "string" ? r : r.url, SCOPE); if (ignoreSearch) u.search = ""; return u.href; }
  async match(r, o = {}) { if (o.ignoreSearch) { const k = this.key(r, true); for (const [kk, v] of this.m) if (this.key(kk, true) === k) return v.clone(); return undefined; } const v = this.m.get(this.key(r)); return v ? v.clone() : undefined; }
  async put(r, res) { const k = this.key(r); this.m.delete(k); this.m.set(k, res); }
  async add(r) { const res = await env.fetch(r); if (!res.ok) throw new Error("add"); await this.put(r, res); }
  async addAll(list) { for (const r of list) await this.add(r); }
  async delete(r) { return this.m.delete(this.key(r)); }
  async keys() { return [...this.m.keys()].map((u) => new Request(u)); }
}
let env;
function makeEnv({ online = true, files = {} } = {}) {
  const stores = new Map(), listeners = {}, calls = { skip: 0, claim: 0, fetched: [] };
  const caches = {
    async open(n) { if (!stores.has(n)) stores.set(n, new FakeCache()); return stores.get(n); },
    async keys() { return [...stores.keys()]; },
    async delete(n) { return stores.delete(n); },
    async has(n) { return stores.has(n); },
    async match(r) { for (const c of stores.values()) { const h = await c.match(r); if (h) return h; } return undefined; }
  };
  const fetch = async (r) => {
    const url = typeof r === "string" ? new URL(r, SCOPE).href : r.url; calls.fetched.push(url);
    if (!env.online) throw new TypeError("sin red");
    const body = env.files[url] ?? env.files[url.replace(/\?.*$/, "")];
    return body === undefined ? new Response("no", { status: 404 }) : new Response(body, { status: 200 });
  };
  const self = {
    location: new URL("sw.js", SCOPE),
    addEventListener: (t, f) => { listeners[t] = f; },
    skipWaiting: async () => { calls.skip++; },
    clients: { claim: async () => { calls.claim++; } }
  };
  env = { online, files, stores, caches, calls, fetch, self, listeners };
  vm.runInNewContext(SRC, { self, caches, fetch, URL, Request, Response, Headers, setTimeout, clearTimeout, Promise, console });
  return env;
}
async function fire(type, extra = {}) {
  const waits = []; let responded;
  const ev = { ...extra, waitUntil: (p) => waits.push(p), respondWith: (p) => { responded = p; } };
  env.listeners[type](ev);
  const out = responded ? await responded : undefined;
  let n; do { n = waits.length; await Promise.all(waits); await new Promise((r) => setTimeout(r, 0)); } while (waits.length !== n);
  return out;
}
const get = (path, mode = "no-cors") => {
  const r = new Request(new URL(path, SCOPE).href);
  Object.defineProperty(r, "mode", { value: mode });
  return r;
};
const allShell = () => Object.fromEntries(SHELL.map((u) => [new URL(u, SCOPE).href, "contenido de " + u]));

test("cada archivo del SHELL existe en el repositorio", () => {
  for (const u of SHELL) { const p = u === "./" ? "index.html" : u.endsWith("/") ? u + "index.html" : u; assert.ok(existsSync(ROOT + p), "falta " + u); }
});

test("la versión coincide con el contenido actual (si falla: node scripts/sw-version.mjs)", () => {
  assert.equal(VERSION, shellVersion());
});

test("al instalar guarda la app en su cajón con versión y no se activa sola", async () => {
  makeEnv({ files: allShell() });
  await fire("install");
  const app = env.stores.get("tsapc-app-" + VERSION);
  assert.ok(app, "existe el cajón de la app");
  assert.equal(app.m.size, SHELL.length);
  assert.equal(env.calls.skip, 0, "no llama a skipWaiting por su cuenta");
});

test("al activar borra cajones viejos, rescata imágenes y PDF y no toca cachés ajenas", async () => {
  makeEnv({ files: allShell() });
  const old = await env.caches.open("tsapc-copia2");
  await old.put(SCOPE + "files/tema.pdf", new Response("pdf"));
  await old.put(SCOPE + "assets/logo.png", new Response("png"));
  await old.put(SCOPE + "bio1/repaso/", new Response("viejo"));
  await env.caches.open("tsapc-app-0123456789ab");
  await env.caches.open("otra-web");
  const ajena = await env.caches.open("tsapc-de-otro-proyecto"); await ajena.put("https://arpusedu.github.io/otro/x.pdf", new Response("suyo"));
  await fire("install"); await fire("activate");
  const names = await env.caches.keys();
  assert.equal(await (await env.stores.get("tsapc-app-" + VERSION).match(SCOPE + "bio1/repaso/")).text(), "contenido de bio1/repaso/", "la página nueva gana a la vieja");
  assert.ok(!names.includes("tsapc-copia2") && !names.includes("tsapc-app-0123456789ab"));
  assert.ok(names.includes("otra-web"), "no toca lo que no es suyo");
  assert.ok(names.includes("tsapc-de-otro-proyecto"), "un cajón que empieza por tsapc- pero no es de esta web no se toca");
  const media = env.stores.get("tsapc-media");
  assert.equal(await (await media.match(SCOPE + "files/tema.pdf")).text(), "pdf");
  assert.ok(await media.match(SCOPE + "assets/logo.png"));
  assert.equal(await media.match(SCOPE + "bio1/repaso/"), undefined, "las páginas no pasan al cajón de archivos");
  assert.equal(env.calls.claim, 1);
});

test("un PDF guardado se abre sin red y una actualización no lo borra", async () => {
  makeEnv({ files: { ...allShell(), [SCOPE + "files/a.pdf"]: "A" } });
  await fire("install"); await fire("activate");
  assert.equal(await (await fire("fetch", { request: get("files/a.pdf") })).text(), "A");
  env.online = false;
  assert.equal(await (await fire("fetch", { request: get("files/a.pdf") })).text(), "A");
  // llega otra versión: el cajón de archivos sigue ahí
  await env.caches.open("tsapc-app-otra"); await fire("activate");
  assert.ok(await env.stores.get("tsapc-media").match(SCOPE + "files/a.pdf"));
});

test("el cajón de archivos no pasa del límite y borra primero lo que hace más tiempo que no se abre", async () => {
  const files = allShell(); for (let i = 0; i < MEDIA_MAX + 5; i++) files[SCOPE + `files/f${i}.pdf`] = "f" + i;
  makeEnv({ files });
  await fire("install"); await fire("activate");
  for (let i = 0; i < MEDIA_MAX; i++) await fire("fetch", { request: get(`files/f${i}.pdf`) });
  await fire("fetch", { request: get("files/f0.pdf") });                 // f0 se vuelve a abrir: pasa a ser la más reciente
  for (let i = MEDIA_MAX; i < MEDIA_MAX + 5; i++) await fire("fetch", { request: get(`files/f${i}.pdf`) });
  const media = env.stores.get("tsapc-media");
  assert.equal(media.m.size, MEDIA_MAX);
  assert.ok(await media.match(SCOPE + "files/f0.pdf"), "la que se abrió hace poco se queda");
  assert.equal(await media.match(SCOPE + "files/f1.pdf"), undefined, "la más antigua sin abrir se va");
});

test("sin red, una página guardada se sirve desde la caché", async () => {
  makeEnv({ files: allShell() });
  await fire("install"); await fire("activate");
  env.online = false;
  const res = await fire("fetch", { request: get("bio1/repaso/?x=1", "navigate") });
  assert.equal(await res.text(), "contenido de bio1/repaso/");
});

test("sin red y sin esa página guardada, sale la página «Sin conexión»", async () => {
  makeEnv({ files: allShell() });
  await fire("install"); await fire("activate");
  env.online = false;
  const res = await fire("fetch", { request: get("no-existe/", "navigate") });
  assert.equal(await res.text(), "contenido de offline.html");
});

test("con red, la página nueva se sirve y se guarda en el cajón de la app", async () => {
  makeEnv({ files: allShell() });
  await fire("install"); await fire("activate");
  env.files[SCOPE + "bio1/repaso/"] = "versión nueva";
  assert.equal(await (await fire("fetch", { request: get("bio1/repaso/", "navigate") })).text(), "versión nueva");
  assert.equal(await (await env.stores.get("tsapc-app-" + VERSION).match(SCOPE + "bio1/repaso/")).text(), "versión nueva");
});

test("solo se activa cuando la página lo pide (botón «Actualizar»)", async () => {
  makeEnv({ files: allShell() });
  await fire("message", { data: { type: "otra-cosa" } });
  assert.equal(env.calls.skip, 0);
  await fire("message", { data: { type: "SKIP_WAITING" } });
  assert.equal(env.calls.skip, 1);
});

test("no intercepta peticiones que no son GET ni rutas fuera de la web", async () => {
  makeEnv({ files: allShell() });
  const post = new Request(SCOPE + "x", { method: "POST" });
  assert.equal(await fire("fetch", { request: post }), undefined);
  assert.equal(await fire("fetch", { request: new Request("https://arpusedu.github.io/otro-proyecto/") }), undefined);
});

test("si no se baja lo esencial, la instalación falla y sigue la versión anterior", async () => {
  const files = allShell(); delete files[SCOPE + "offline.html"];
  makeEnv({ files });
  await assert.rejects(fire("install"));
});

test("si falta una página no esencial, se instala igual", async () => {
  const files = allShell(); delete files[SCOPE + "lab1/test-50/"];
  makeEnv({ files });
  await fire("install");
  assert.ok(env.stores.get("tsapc-app-" + VERSION).m.size >= SHELL.length - 1);
});

test("al activar se rescatan las páginas guardadas que no llegaron a bajarse", async () => {
  const files = allShell(); delete files[SCOPE + "lab1/test-50/"];
  makeEnv({ files });
  const old = await env.caches.open("tsapc-copia2"); await old.put(SCOPE + "lab1/test-50/", new Response("copia vieja"));
  await fire("install"); await fire("activate");
  env.online = false;
  assert.equal(await (await fire("fetch", { request: get("lab1/test-50/", "navigate") })).text(), "copia vieja");
});

test("vídeo o audio pedido a trozos (Range) va directo a la red y no se guarda", async () => {
  makeEnv({ files: { ...allShell(), [SCOPE + "files/v.mp4"]: "video" } });
  await fire("install"); await fire("activate");
  const r = new Request(SCOPE + "files/v.mp4", { headers: { range: "bytes=0-99" } });
  assert.equal(await (await fire("fetch", { request: r })).text(), "video");
  assert.equal(await env.stores.get("tsapc-media").match(SCOPE + "files/v.mp4"), undefined);
});

test("si guardar un archivo falla (memoria llena), el archivo se ve igual", async () => {
  makeEnv({ files: { ...allShell(), [SCOPE + "files/b.pdf"]: "B" } });
  await fire("install"); await fire("activate");
  env.stores.get("tsapc-media").put = async () => { throw new Error("QuotaExceededError"); };
  assert.equal(await (await fire("fetch", { request: get("files/b.pdf") })).text(), "B");
});

test("los iconos precargados se ven sin conexión", async () => {
  makeEnv({ files: allShell() });
  await fire("install"); await fire("activate");
  env.online = false;
  assert.equal(await (await fire("fetch", { request: get("assets/icon-192.png") })).text(), "contenido de assets/icon-192.png");
});

test("los sitios externos no previstos pasan sin tocar; las fuentes de Google sí se guardan", async () => {
  makeEnv({ files: { ...allShell(), "https://fonts.gstatic.com/s/x.woff2": "font" } });
  await fire("install"); await fire("activate");
  assert.equal(await fire("fetch", { request: new Request("https://api.ejemplo.com/datos") }), undefined);
  assert.equal(await (await fire("fetch", { request: get("https://fonts.gstatic.com/s/x.woff2") })).text(), "font");
  assert.ok(await env.stores.get("tsapc-media").match("https://fonts.gstatic.com/s/x.woff2"));
});

test("abrir un PDF sin conexión que no está guardado lleva a «Sin conexión»", async () => {
  makeEnv({ files: allShell() });
  await fire("install"); await fire("activate");
  env.online = false;
  assert.equal(await (await fire("fetch", { request: get("files/nuevo.pdf", "navigate") })).text(), "contenido de offline.html");
});

test("al activar solo rescata entradas de nuestra carpeta (el dominio se comparte)", async () => {
  makeEnv({ files: allShell() });
  const old = await env.caches.open("tsapc-media");
  const vieja = await env.caches.open("tsapc-4e2a1b8c");
  await vieja.put("https://arpusedu.github.io/otro/pagina/", new Response("de otro"));
  await vieja.put("https://arpusedu.github.io/otro/foto.png", new Response("de otro"));
  await vieja.put(SCOPE + "files/mio.pdf", new Response("mio"));
  await fire("install"); await fire("activate");
  const app = env.stores.get("tsapc-app-" + VERSION), media = env.stores.get("tsapc-media");
  assert.equal(await app.match("https://arpusedu.github.io/otro/pagina/"), undefined);
  assert.equal(await media.match("https://arpusedu.github.io/otro/foto.png"), undefined);
  assert.equal(await (await media.match(SCOPE + "files/mio.pdf")).text(), "mio");
  assert.ok(!(await env.caches.keys()).includes("tsapc-4e2a1b8c"), "el cajón antiguo propio se borra");
  assert.ok(old);
});

test("un archivo que solo está en una caché ajena del mismo dominio no se sirve", async () => {
  makeEnv({ files: allShell() });
  await fire("install"); await fire("activate");
  const ajena = await env.caches.open("cache-de-otro-proyecto");
  await ajena.put(SCOPE + "assets/trampa.png", new Response("ajeno"));
  env.online = false;
  await assert.rejects(fire("fetch", { request: get("assets/trampa.png") }));
});

test("las navegaciones con ?x=1…N se guardan una sola vez, sin el «?»", async () => {
  makeEnv({ files: allShell() });
  await fire("install"); await fire("activate");
  const app = env.stores.get("tsapc-app-" + VERSION), antes = (await app.keys()).length;
  for (let i = 1; i <= 5; i++) await fire("fetch", { request: get("bio1/repaso/?x=" + i, "navigate") });
  const keys = (await app.keys()).map((k) => k.url);
  assert.equal(keys.length, antes);
  assert.ok(!keys.some((k) => k.includes("?x=")));
  env.online = false;
  assert.equal(await (await fire("fetch", { request: get("bio1/repaso/?x=9", "navigate") })).text(), "contenido de bio1/repaso/");
});

test("unpkg.com ya no es un origen previsto", async () => {
  makeEnv({ files: allShell() });
  await fire("install"); await fire("activate");
  assert.ok(!SRC.includes("unpkg.com"));
  assert.equal(await fire("fetch", { request: new Request("https://unpkg.com/x@1.0.0/x.js") }), undefined);
});
