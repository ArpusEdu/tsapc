import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const P = createRequire(import.meta.url)("../app/plan.js");
const d = (s, h = 12) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd, h); };
const ses = (n) => Array.from({ length: n }, (_, i) => ({ id: "s" + i, titulo: "S" + i, minutos: 25 }));

test("plan: reparte lo que falta entre los días, sin contar la víspera", () => {
  const p = P.planExamen({ ex: { id: "x", date: d("2026-11-17") }, sesiones: ses(7), estados: {}, hoy: d("2026-11-13") });
  assert.equal(p.dias, 4); assert.equal(p.fase, "estudio");
  assert.equal(p.porDia, 3, "7 sesiones en 3 días de estudio");
  assert.deepEqual(p.hoyToca.map((x) => x.id), ["s0", "s1", "s2"]);
  assert.equal(p.minutosHoy, 75); assert.equal(p.ritmo, "apretado");
});

test("plan: lo hecho no cuenta y con todo hecho toca repasar", () => {
  const est = { s0: { hecha: "2026-11-12" }, s1: { hecha: "2026-11-13" } };
  const p = P.planExamen({ ex: { id: "x", date: d("2026-11-20") }, sesiones: ses(3), estados: est, hoy: d("2026-11-13") });
  assert.equal(p.pendientes, 1); assert.equal(p.hechasHoy, 1); assert.equal(p.ritmo, "holgado");
  const q = P.planExamen({ ex: { id: "x", date: d("2026-11-20") }, sesiones: ses(1), estados: { s0: { hecha: "x" } }, hoy: d("2026-11-13") });
  assert.equal(q.fase, "repaso"); assert.equal(q.ritmo, "listo"); assert.equal(q.hoyToca.length, 0);
});

test("plan: víspera y día del examen no proponen nada nuevo; un examen pasado no tiene plan", () => {
  assert.equal(P.planExamen({ ex: { id: "x", date: d("2026-11-14") }, sesiones: ses(2), estados: {}, hoy: d("2026-11-13") }).fase, "vispera");
  assert.equal(P.planExamen({ ex: { id: "x", date: d("2026-11-13") }, sesiones: ses(2), estados: {}, hoy: d("2026-11-13") }).hoyToca.length, 0);
  assert.equal(P.planExamen({ ex: { id: "x", date: d("2026-11-10") }, sesiones: ses(2), estados: {}, hoy: d("2026-11-13") }), null);
});

const EVS = [
  { id: "e1", tipo: "entrega", titulo: "Trabajo", date: d("2026-11-16"), due: d("2026-11-16", 23), hora: "23:59" },
  { id: "e2", tipo: "entrega", titulo: "Lejos", date: d("2026-11-30"), due: d("2026-11-30", 23) },
  { id: "e3", tipo: "entrega", titulo: "Hoy", date: d("2026-11-13"), due: d("2026-11-13", 21), hora: "21:00" },
  { id: "x1", tipo: "examen", titulo: "Examen · Unidad 1", date: d("2026-11-17") },
];

test("avisos: entregas de la semana sin tachar y el estudio del examen, por urgencia", () => {
  const a = P.avisos({ evs: EVS, entregadas: {}, descartados: {}, hoy: d("2026-11-13", 10) });
  assert.deepEqual(a.map((x) => x.id), ["entrega:e3", "entrega:e1", "estudio:x1:2026-11-13"]);
  assert.equal(a[0].nivel, "hoy"); assert.match(a[0].texto, /hoy, a las 21:00/);
  assert.equal(a[2].titulo, "Unidad 1");
});

test("avisos: insisten hasta hacerlo; el de estudio vuelve al día siguiente", () => {
  const hoy = d("2026-11-13", 10);
  let des = P.descartar({}, "estudio:x1:2026-11-13", hoy);
  const a = P.avisos({ evs: EVS, entregadas: { e3: "2026-11-13T09:00:00Z" }, descartados: des, hoy });
  assert.deepEqual(a.map((x) => x.id), ["entrega:e1"], "entrega tachada y estudio de hoy hecho: solo queda una");
  const m = P.avisos({ evs: EVS, entregadas: { e3: "x" }, descartados: des, hoy: d("2026-11-14", 10) });
  assert.ok(m.some((x) => x.id === "estudio:x1:2026-11-14"), "mañana vuelve a pedirlo");
  const e = P.avisos({ evs: EVS, entregadas: {}, descartados: {}, hoy, estudioHoy: () => true });
  assert.ok(!e.some((x) => x.tipo === "estudio"), "una sesión hecha hoy calla el aviso");
});

test("avisos: lo que ya cerró no insiste y descartar limpia lo viejo", () => {
  const tarde = P.avisos({ evs: EVS, entregadas: {}, descartados: {}, hoy: d("2026-11-13", 22) });
  assert.ok(!tarde.some((x) => x.id === "entrega:e3"));
  const o = P.descartar({ viejo: "2026-09-01", nuevo: "2026-11-10" }, "z", d("2026-11-13"));
  assert.deepEqual(Object.keys(o).sort(), ["nuevo", "z"]);
});

test("plan: si no da tiempo, como mucho 3 al día y se dice claro", () => {
  const p = P.planExamen({ ex: { id: "x", date: d("2026-11-17") }, sesiones: ses(23), estados: {}, hoy: d("2026-11-13") });
  assert.equal(p.noDa, true); assert.equal(p.hoyToca.length, 3); assert.match(p.mensaje, /no da tiempo a todas/);
});
