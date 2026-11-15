/* Pruebas del cielo de Pamplona (centro/cielo.js): sol, luna, temporadas y tiempo.
   Valores de referencia: U.S. Naval Observatory, Astronomical Applications, servicio «Sun and Moon Data
   for One Day» (aa.usno.navy.mil/api/rstt/oneday), coordenadas 42.8125, -1.6458, consultado el 13-11-2026:
   - 21-06-2026 (UTC+2): crepúsculo civil 05:53, salida 06:28, paso por el meridiano 14:08, puesta 21:49, fin del civil 22:24.
     Cuarto creciente el 21-06-2026 a las 23:55 (UTC+2) = 21:55 UTC. Tránsito de la luna 19:57 (UTC+2).
   - 21-12-2026 (UTC+1): crepúsculo civil 08:02, salida 08:34, paso 13:05, puesta 17:35, fin del civil 18:08.
     Luna llena el 24-12-2026 a las 02:28 (UTC+1) = 01:28 UTC.
   La USNO redondea al minuto: margen ±3 min. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as C from "../centro/cielo.js";

const min = (d) => { const p = C.relojLocal(d); return p.h * 60 + p.mi + p.s / 60; };
const hm = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const cerca = (d, ref, tol = 3) => assert.ok(Math.abs(min(d) - hm(ref)) <= tol, `${C.hhmm(d)} frente a ${ref}`);

test("salida, puesta y crepúsculo civil en Pamplona el 21 de junio de 2026 (±3 min, USNO)", () => {
  const h = C.horasSol(C.instanteLocal(2026, 6, 21, 12, 0));
  cerca(h.salida, "06:28"); cerca(h.puesta, "21:49"); cerca(h.mediodia, "14:08");
  cerca(h.civilIni, "05:53"); cerca(h.civilFin, "22:24");
});

test("salida, puesta y crepúsculo civil en Pamplona el 21 de diciembre de 2026 (±3 min, USNO)", () => {
  const h = C.horasSol(C.instanteLocal(2026, 12, 21, 12, 0));
  cerca(h.salida, "08:34"); cerca(h.puesta, "17:35"); cerca(h.mediodia, "13:05");
  cerca(h.civilIni, "08:02"); cerca(h.civilFin, "18:08");
});

test("el orden del día: náutico < civil < salida < dorada < mediodía < dorada < puesta < civil < náutico", () => {
  for (const m of [1, 4, 6, 9, 11]) {
    const h = C.horasSol(C.instanteLocal(2026, m, 15));
    const o = [h.nauticoIni, h.civilIni, h.salida, h.doradaFinManana, h.mediodia, h.doradaIniTarde, h.puesta, h.civilFin, h.nauticoFin].map(Number);
    for (let i = 1; i < o.length; i++) assert.ok(o[i] > o[i - 1], "mes " + m + ", paso " + i);
  }
});

test("posición del sol: al mediodía solar del solsticio de verano, al sur y a ~70,6°", () => {
  const s = C.sol(C.instanteLocal(2026, 6, 21, 14, 8));
  assert.ok(Math.abs(s.az - 180) < 1.5, "azimut " + s.az);
  assert.ok(Math.abs(s.altGeo - (90 - 42.8125 + 23.437)) < 0.3, "altura " + s.altGeo);
  assert.ok(C.sol(C.instanteLocal(2026, 12, 21, 2, 0)).alt < -18, "de madrugada es noche cerrada");
  const tarde = C.sol(C.instanteLocal(2026, 12, 21, 17, 0));
  assert.ok(tarde.az > 220 && tarde.az < 245 && tarde.alt > 0 && tarde.alt < 8, "en invierno se pone por el suroeste");
});

test("la puesta de la tabla coincide con la altura −0,833° de la función sol", () => {
  const h = C.horasSol(C.instanteLocal(2026, 3, 20));
  assert.ok(Math.abs(C.sol(h.puesta).altGeo + 0.833) < 0.05);
});

test("fase de la luna en fechas conocidas (USNO)", () => {
  const cc = C.luna(new Date("2026-06-21T21:55:00Z"));
  assert.ok(Math.abs(cc.fase - 0.25) < 0.02, "cuarto creciente: " + cc.fase);
  assert.equal(cc.nombre, "cuarto creciente");
  const ll = C.luna(new Date("2026-12-24T01:28:00Z"));
  assert.ok(Math.abs(ll.fase - 0.5) < 0.02 && ll.ilum > 0.99, "llena: " + ll.fase);
  assert.equal(ll.nombre, "luna llena");
  const tr = C.luna(new Date("2026-06-21T17:57:00Z"));          // tránsito: al sur
  assert.ok(Math.abs(tr.az - 180) < 4, "azimut en el tránsito " + tr.az);
});

test("hora de Pamplona: horario de invierno y de verano", () => {
  assert.equal(C.desfase(Date.UTC(2026, 0, 10)), 60);
  assert.equal(C.desfase(Date.UTC(2026, 6, 10)), 120);
  assert.equal(C.hhmm(C.instanteLocal(2026, 3, 29, 12, 30)), "12:30");
});

test("?hoy y ?hora para pruebas; sin ellos, ahora", () => {
  const t = C.instantePrueba("?hoy=2026-12-21&hora=08:30");
  assert.equal(C.hhmm(t), "08:30"); assert.equal(C.relojLocal(t).d, 21);
  assert.equal(C.hhmm(C.instantePrueba("?hoy=2026-07-01")), "17:00");
  assert.equal(+C.instantePrueba("", 123456789), 123456789);
});

test("la paleta cambia de forma continua y la noche es oscura", () => {
  const l = (c) => c[0] + c[1] + c[2];
  let prev = null;
  for (let a = -20; a <= 60; a += 0.5) {
    const p = C.paleta(a);
    if (prev) assert.ok(Math.abs(l(p.zen) - l(prev.zen)) < 0.2 && Math.abs(p.luz - prev.luz) < 0.1, "salto en " + a);
    prev = p;
  }
  assert.ok(l(C.paleta(-20).zen) < 0.25 && C.paleta(-20).luz === 0);
  assert.ok(l(C.paleta(40).zen) > 1 && C.paleta(40).luz > 0.9);
  assert.ok(C.paleta(30, { nubes: 1 }).luz < C.paleta(30).luz * 0.4, "cubierto: poca luz directa");
});

test("temporadas: ocres y caída en otoño, desnudo en invierno, flor en primavera, verano largo", () => {
  const T = (m, d) => C.temporada(C.instanteLocal(2026, m, d));
  assert.equal(T(11, 5).nombre, "otono"); assert.ok(T(11, 5).caen);
  const o = T(10, 25).colorHoja; assert.ok(o[0] > o[1] && o[1] > o[2], "ocre");
  assert.equal(T(1, 15).nombre, "invierno"); assert.ok(T(1, 15).hojas < 0.1);
  assert.equal(T(4, 20).nombre, "primavera"); assert.ok(T(4, 20).flor > 0.5);
  assert.equal(T(7, 20).nombre, "verano"); assert.ok(T(7, 20).verano > 0.8);
  /* nieve: solo en la época, y «a veces» (no todos los días de enero) */
  assert.equal(T(7, 20).nieve, 0);
  let con = 0; for (let d = 1; d <= 31; d++) if (T(1, d).nieve > 0) con++;
  assert.ok(con > 0 && con < 31, "días de enero con nieve: " + con);
});

test("tiempo: códigos WMO, texto y caché de 20 minutos", async () => {
  assert.equal(C.interpretarTiempo({ code: 53 }).tipo, "llovizna");
  assert.equal(C.interpretarTiempo({ code: 75 }).tipo, "nieve");
  assert.equal(C.interpretarTiempo({ code: 45 }).niebla, 1);
  assert.ok(C.interpretarTiempo({ code: 95 }).tormenta);
  assert.equal(C.interpretarTiempo(null).tipo, "despejado");
  assert.equal(C.lineaTiempo({ code: 53, temp: 14.4 }), "Pamplona · 14 °C · lloviznando");
  assert.equal(C.lineaTiempo({ code: 0, temp: null }), "Pamplona · despejado");
  assert.equal(C.lineaTiempo({ code: 71, temp: -2 }), "Pamplona · −2 °C · nevando");
  assert.ok(C.URL_TIEMPO.includes("temperature_2m") && C.URL_TIEMPO.startsWith("https://api.open-meteo.com/"));

  let almacen = null, pedidas = 0;
  const json = { current: { weather_code: 61, cloud_cover: 90, precipitation: 0.6, rain: 0.6, snowfall: 0, wind_speed_10m: 18, is_day: 1, temperature_2m: 9.6, time: "2026-11-13T10:00" } };
  const red = async () => { pedidas++; return { ok: true, json: async () => json }; };
  const deps = (ahora, f = red) => ({ leer: () => almacen, escribir: (v) => { almacen = v; }, fetch: f, ahora: () => ahora });
  let r = await C.obtenerTiempo(deps(1e12));
  assert.equal(r.origen, "red"); assert.equal(r.datos.code, 61); assert.equal(almacen.t, 1e12); assert.equal(pedidas, 1);
  assert.deepEqual(Object.keys(almacen.d).sort(), ["code", "dia", "hora", "lluvia", "nieve", "nubes", "prec", "temp", "viento"]);
  r = await C.obtenerTiempo(deps(1e12 + 19 * 60000));
  assert.equal(r.origen, "guardado"); assert.equal(pedidas, 1, "antes de 20 min no se pregunta");
  const caida = async () => { pedidas++; throw new TypeError("sin red"); };
  r = await C.obtenerTiempo(deps(1e12 + 25 * 60000, caida));
  assert.equal(r.origen, "sin-red"); assert.equal(r.datos.code, 61, "sin red: lo último guardado"); assert.equal(pedidas, 2);
  r = await C.obtenerTiempo(deps(1e12 + 13 * 3600000, caida));
  assert.equal(r.datos, null, "muy viejo: cielo despejado calculado");
  almacen = null;
  r = await C.obtenerTiempo(deps(1e12, async () => ({ ok: false, status: 500 })));
  assert.equal(r.datos, null);
});

test("el estado completo de noche y de día", () => {
  const noche = C.estadoCielo(C.instanteLocal(2026, 11, 13, 23, 0));
  assert.equal(noche.momento, "noche"); assert.ok(noche.paleta.noche > 0.9);
  const dia = C.estadoCielo(C.instanteLocal(2026, 11, 13, 13, 0), { code: 73, temp: -1 });
  assert.equal(dia.momento, "dia"); assert.equal(dia.tiempo.tipo, "nieve"); assert.equal(dia.temporada.nieve, 1);
});

test("el service worker deja pasar Open-Meteo sin guardarla y sin romper", () => {
  const SRC = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const L = {};
  const self = { location: new URL("https://arpusedu.github.io/tsapc/sw.js"), addEventListener: (t, f) => { L[t] = f; }, clients: {} };
  vm.runInNewContext(SRC, { self, caches: {}, fetch: () => { throw new Error("no debe pedir"); }, URL, Request, Response, Headers, setTimeout, clearTimeout, Promise, console });
  let respondio = false;
  L.fetch({ request: new Request(C.URL_TIEMPO), respondWith: () => { respondio = true; }, waitUntil: () => {} });
  assert.equal(respondio, false, "Open-Meteo no pasa por las cachés");
  const shell = JSON.parse(SRC.match(/const SHELL\s*=\s*(\[[^\]]*\])/)[1]);
  assert.ok(shell.includes("centro/cielo.js")); assert.ok(!shell.some((u) => u.includes("open-meteo")));
});
