import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const { L } = createRequire(import.meta.url)("../app/pomodoro.js");
const MIN = 60000, T0 = new Date(2026, 10, 17, 16, 0).getTime();

test("pomodoro: ajustes por defecto 25 + 5, largo de 15 cada 4; lo absurdo se recorta", () => {
  assert.deepEqual(L.config({}), { estudio: 25, descanso: 5, largo: 15, cada: 4, objetivo: 0 });
  assert.deepEqual(L.config({ estudio: 500, descanso: -2, cada: "x", objetivo: 90 }), { estudio: 90, descanso: 1, largo: 15, cada: 4, objetivo: 90 });
});

test("pomodoro: lo que queda sale de la hora real, no de contar segundos", () => {
  const e = L.empezar("estudio", 25, T0, 0, null);
  assert.equal(L.restante(e, T0 + 10 * MIN), 15 * MIN);
  assert.equal(L.mmss(L.restante(e, T0 + 10 * MIN + 500)), "15:00", "se redondea hacia arriba: nunca enseña 14:59 antes de tiempo");
  assert.equal(L.restante(e, T0 + 99 * MIN), 0);
  assert.ok(Math.abs(L.progreso(e, T0 + 5 * MIN) - 0.2) < 1e-9);
});

test("pomodoro: la pausa congela y al seguir se corre el inicio", () => {
  let e = L.empezar("estudio", 25, T0, 0, null);
  e = L.pausar(e, T0 + 5 * MIN);
  assert.equal(L.restante(e, T0 + 60 * MIN), 20 * MIN, "en pausa no corre aunque pase una hora");
  e = L.seguir(e, T0 + 60 * MIN);
  assert.equal(L.restante(e, T0 + 61 * MIN), 19 * MIN);
  assert.equal(L.avanzar(L.pausar(e, T0 + 61 * MIN), {}, T0 + 500 * MIN).cambios.length, 0, "en pausa no avanza de fase");
});

test("pomodoro: con la pantalla bloqueada, al volver se apunta el bloque y el descanso empieza donde acabó", () => {
  const e = L.empezar("estudio", 25, T0, 0, { tipo: "sesion", id: "bio1-cultivo", titulo: "Cultivo", href: "#/sesion/bio1-cultivo" });
  const r = L.avanzar(e, {}, T0 + 27 * MIN);
  assert.deepEqual(r.cambios, ["descanso"]);
  assert.deepEqual(r.registros, [{ fin: T0 + 25 * MIN, min: 25, id: "bio1-cultivo" }]);
  assert.equal(r.e.fase, "descanso"); assert.equal(r.e.ini, T0 + 25 * MIN);
  assert.equal(L.restante(r.e, T0 + 27 * MIN), 3 * MIN);
  const tarde = L.avanzar(e, {}, T0 + 90 * MIN);
  assert.deepEqual(tarde.cambios, ["descanso", "fin"], "si pasó también el descanso, queda parado: el siguiente bloque lo empieza el estudiante");
  assert.equal(tarde.e.fase, null); assert.equal(tarde.e.hechos, 1); assert.equal(tarde.registros.length, 1);
});

test("pomodoro: cada 4 bloques, descanso largo", () => {
  const e = L.empezar("estudio", 25, T0, 3, null);
  const r = L.avanzar(e, { cada: 4, largo: 20 }, T0 + 26 * MIN);
  assert.equal(r.e.fase, "largo"); assert.equal(r.e.min, 20); assert.equal(r.e.hechos, 4);
});

test("pomodoro: terminar a medias apunta solo lo estudiado; un descanso no se apunta", () => {
  const e = L.empezar("estudio", 25, T0, 0, null);
  assert.equal(L.terminar(e, T0 + 12 * MIN + 40000).registro.min, 12);
  assert.equal(L.terminar(e, T0 + 30000).registro, null, "menos de un minuto no cuenta");
  assert.equal(L.terminar(L.empezar("descanso", 5, T0, 1, null), T0 + 4 * MIN).registro, null);
});

test("pomodoro: el modo de prueba acelera el reloj pero apunta los minutos nominales", () => {
  const e = L.empezar("estudio", 25, T0, 0, null, 60);   /* ?pomox=60: 25 min duran 25 s */
  const r = L.avanzar(e, {}, T0 + 25000, 60);
  assert.equal(r.registros[0].min, 25); assert.equal(r.e.fase, "descanso");
  assert.equal(L.restante(r.e, T0 + 25000), 5000);
});

test("pomodoro: historial por día y resumen de hoy y de la semana (de lunes a hoy)", () => {
  let h = {};
  h = L.apuntar(h, { fin: new Date(2026, 10, 17, 17).getTime(), min: 25, id: "a" });   /* martes */
  h = L.apuntar(h, { fin: new Date(2026, 10, 17, 18).getTime(), min: 10, id: "" });
  h = L.apuntar(h, { fin: new Date(2026, 10, 16, 18).getTime(), min: 25, id: "" });   /* lunes */
  h = L.apuntar(h, { fin: new Date(2026, 10, 15, 18).getTime(), min: 50, id: "" });   /* domingo: semana anterior */
  assert.deepEqual(h.dias, { "2026-11-17": 35, "2026-11-16": 25, "2026-11-15": 50 });
  assert.equal(h.registro.length, 4); assert.equal(h.registro[0].dia, "2026-11-17");
  const r = L.resumen(h.dias, new Date(2026, 10, 17, 20));
  assert.equal(r.hoy, 35); assert.equal(r.semana, 60);
  assert.equal(r.ultimos.length, 7); assert.equal(r.ultimos[6].min, 35);
  let g = {}; for (let i = 0; i < 130; i++) g = L.apuntar(g, { fin: T0 + i * MIN, min: 1 });
  assert.equal(g.registro.length, 120, "el registro no crece sin límite");
});

test("pomodoro: un estado guardado raro no rompe nada", () => {
  assert.deepEqual(L.estado(null), { fase: null, hechos: 0, origen: null });
  assert.equal(L.estado({ fase: "siesta", ini: 1, dur: 1 }).fase, null);
  assert.equal(L.estado({ fase: "estudio", ini: T0, dur: 25 * MIN, origen: { href: "javascript:alert(1)" } }).origen, null, "solo enlaces internos de la app");
  assert.equal(L.dicho(24 * MIN + 1000), "25 minutos"); assert.equal(L.dicho(40000), "40 segundos");
});

test("organizador: nada nuevo en localStorage; todo va por tsapc:v2 (leer/guardar)", () => {
  for (const f of ["app/pomodoro.js", "app/plan.js"]) {
    const src = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.ok(!/localStorage|sessionStorage|indexedDB/.test(src), f + " no debe tocar el almacenamiento directamente");
  }
  const app = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");
  for (const k of ["personal.pomodoro", "personal.estimaciones", "personal.ritmo"]) assert.ok(app.includes(k) || readFileSync(new URL("../app/pomodoro.js", import.meta.url), "utf8").includes(k), k);
  const html = readFileSync(new URL("../app/index.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("pomodoro.js") > 0 && html.indexOf("pomodoro.js") < html.indexOf('src="app.js"'), "pomodoro.js se carga antes que app.js");
});
