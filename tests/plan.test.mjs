import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const P = createRequire(import.meta.url)("../app/plan.js");
const d = (s, h = 12) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd, h); };
const ses = (n) => Array.from({ length: n }, (_, i) => ({ id: "s" + i, titulo: "S" + i, minutos: 25 }));

test("plan: en ratos y con los minutos al día del estudiante; los 2 últimos días no cuentan para estudiar", () => {
  /* 7 sesiones de 25 min = 14 ratos de 13 min = 182 min; 5 días hasta el examen → 3 de estudio → 61 min al día */
  const p = P.planExamen({ ex: { id: "x", date: d("2026-11-18") }, sesiones: ses(7), estados: {}, hoy: d("2026-11-13") });
  assert.equal(p.dias, 5); assert.equal(p.fase, "estudio"); assert.equal(p.minutosDia, 20, "20 min si no dice nada");
  assert.equal(p.necesarios, 61);
  assert.deepEqual(p.hoyToca.map((x) => x.id + x.rato), ["s0A"], "con 20 min, un rato (aunque pase un poco)");
  assert.equal(p.minutosHoy, 13); assert.equal(p.ritmo, "apretado"); assert.equal(p.noDa, true);
  const q = P.planExamen({ ex: { id: "x", date: d("2026-11-18") }, sesiones: ses(7), estados: {}, hoy: d("2026-11-13"), minutosDia: 60 });
  assert.deepEqual(q.hoyToca.map((x) => x.id + x.rato), ["s0A", "s0B", "s1A", "s1B"], "con 60 min caben cuatro ratos (52 min)");
  assert.equal(q.minutosHoy, 52); assert.equal(q.noDa, false);
  assert.equal(P.minutosDia("abc"), 20); assert.equal(P.minutosDia(2), 20); assert.equal(P.minutosDia("45"), 45);
});

test("plan: una sesión con el rato A hecho solo pide el B", () => {
  const est = { s0: { ratoA: "2026-11-12", paso: 4 } };
  const p = P.planExamen({ ex: { id: "x", date: d("2026-11-30") }, sesiones: ses(2), estados: est, hoy: d("2026-11-13"), minutosDia: 30 });
  assert.deepEqual(p.hoyToca.map((x) => x.id + x.rato), ["s0B"]);
  assert.equal(P.ratoAHecho({ paso: 2 }), true, "las sesiones empezadas con el orden antiguo que pasaron de «descubre»");
  assert.equal(P.ratoAHecho({ paso: 1 }), false);
});

test("plan: lo hecho no cuenta y con todo hecho toca repasar", () => {
  const est = { s0: { hecha: "2026-11-12" }, s1: { hecha: "2026-11-13" } };
  const p = P.planExamen({ ex: { id: "x", date: d("2026-11-20") }, sesiones: ses(3), estados: est, hoy: d("2026-11-13") });
  assert.equal(p.pendientes, 1); assert.equal(p.hechasHoy, 1); assert.equal(p.ritmo, "holgado"); assert.match(p.mensaje, /te sobran días/);
  const q = P.planExamen({ ex: { id: "x", date: d("2026-11-20") }, sesiones: ses(1), estados: { s0: { hecha: "x" } }, hoy: d("2026-11-13") });
  assert.equal(q.fase, "repaso"); assert.equal(q.ritmo, "listo"); assert.equal(q.hoyToca.length, 0);
});

test("plan: los 2 últimos días, recuperar (test y tarjetas), nada nuevo; el día del examen tampoco; un examen pasado no tiene plan", () => {
  const v = P.planExamen({ ex: { id: "x", date: d("2026-11-14") }, sesiones: ses(2), estados: {}, hoy: d("2026-11-13") });
  assert.equal(v.fase, "recupera"); assert.equal(v.hoyToca.length, 0); assert.match(v.mensaje, /test y las tarjetas/); assert.match(v.mensaje, /las 2 sesiones que faltan/);
  const w = P.planExamen({ ex: { id: "x", date: d("2026-11-15") }, sesiones: ses(2), estados: {}, hoy: d("2026-11-13") });
  assert.equal(w.fase, "recupera"); assert.match(w.mensaje, /Quedan 2 días/);
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
  assert.equal(a[2].accion, "Ya lo hice"); assert.equal(a[2].otra, "Hoy no puedo");
});

test("avisos: el de estudio sale desde 7 días antes, y uno solo por examen", () => {
  const lejos = [{ id: "x9", tipo: "examen", titulo: "Examen · U", unidad: "u1", date: d("2026-11-21") }];
  assert.equal(P.avisos({ evs: lejos, hoy: d("2026-11-13", 10) }).length, 0, "a 8 días, todavía no");
  assert.equal(P.avisos({ evs: lejos, hoy: d("2026-11-14", 10) }).length, 1, "a 7 días, sí");
  const doble = [{ id: "a", tipo: "examen", titulo: "Examen · U", unidad: "u1", date: d("2026-11-16") }, { id: "b", tipo: "oral", titulo: "Oral · U", unidad: "u1", date: d("2026-11-16") }];
  assert.equal(P.avisos({ evs: doble, hoy: d("2026-11-13", 10) }).length, 1);
});

test("«Hoy no puedo»: calla el aviso hasta mañana y queda la marca del día, sin apuntar estudio", () => {
  const hoy = d("2026-11-13", 10);
  const o = P.noPuedo({}, "estudio:x1:2026-11-13", hoy);
  assert.equal(P.noPuedeHoy(o, hoy), true); assert.equal(P.noPuedeHoy(o, d("2026-11-14", 10)), false);
  assert.ok(!P.avisos({ evs: EVS, entregadas: {}, descartados: o, hoy }).some((x) => x.tipo === "estudio"));
  assert.ok(P.avisos({ evs: EVS, entregadas: {}, descartados: o, hoy: d("2026-11-14", 10) }).some((x) => x.tipo === "estudio"), "mañana vuelve");
});

test("varios exámenes cerca: tope global, un rato de cada", () => {
  const pa = P.planExamen({ ex: { id: "a", date: d("2026-11-20") }, sesiones: ses(3), estados: {}, hoy: d("2026-11-13"), minutosDia: 60 });
  const pb = P.planExamen({ ex: { id: "b", date: d("2026-11-25") }, sesiones: [{ id: "t0", titulo: "T0", minutos: 20 }], estados: {}, hoy: d("2026-11-13") });
  const r = P.repartir([{ ex: { id: "a" }, plan: pa }, { ex: { id: "b" }, plan: pb }]);
  assert.deepEqual(r.items.map((x) => x.ex.id + ":" + x.id + x.rato), ["a:s0A", "b:t0A"]);
  assert.equal(r.mensaje, "Dos exámenes cerca: hoy, una de cada.");
  const solo = P.repartir([{ ex: { id: "a" }, plan: pa }]);
  assert.equal(solo.items.length, pa.hoyToca.length); assert.equal(solo.mensaje, "");
  assert.deepEqual(P.repartir([]).items, []);
});

test("vuelta: tras 3 días o más sin nada hecho, lo dice; si hoy ya hiciste algo, no", () => {
  assert.equal(P.vuelta(["2026-11-01", "2026-11-07"], d("2026-11-13")), 6);
  assert.equal(P.vuelta(["2026-11-11"], d("2026-11-13")), 0, "dos días: nada que decir");
  assert.equal(P.vuelta(["2026-11-07", "2026-11-13"], d("2026-11-13")), 0);
  assert.equal(P.vuelta([], d("2026-11-13")), 0, "quien empieza no «vuelve»");
  assert.equal(P.vuelta(["basura", 3], d("2026-11-13")), 0);
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

test("plan: si no da tiempo con tus minutos, se dice claro y hoy solo lo que cabe", () => {
  const p = P.planExamen({ ex: { id: "x", date: d("2026-11-17") }, sesiones: ses(23), estados: {}, hoy: d("2026-11-13"), minutosDia: 30 });
  assert.equal(p.noDa, true); assert.equal(p.hoyToca.length, 2, "dos ratos de 13 min en 30"); assert.match(p.mensaje, /con 30 min al día no da para todas/);
});

/* ---------- tiempos: de menos a más, total, ritmo real y «tengo X minutos» ---------- */
const HOY = d("2026-11-17", 16);
const base = (extra = {}) => ({
  hoy: HOY, repaso: 4, estimaciones: {},
  tarjetas: [{ u: "bio1", titulo: "BIO 1", n: 10 }, { u: "lab1", titulo: "LAB 1", n: 0 }],
  sesiones: [{ id: "s1", titulo: "Sesión uno", minutos: 25, vence: d("2026-11-20"), examen: "BIO 1" }],
  entregas: [{ id: "e1", titulo: "Informe", vence: d("2026-11-18", 23) }],
  ...extra,
});

test("tiempos: repaso 1,5 min por concepto, tarjetas 0,7 min, sesiones sus minutos; de menos a más", () => {
  const t = P.pendientesTiempo(base());
  assert.deepEqual(t.items.map((x) => [x.id, x.minutos]), [["repaso", 6], ["tarjetas:bio1", 7], ["sesion:s1", 25], ["entrega:e1", null]]);
  assert.equal(t.total, 38, "el total suma solo lo que tiene tiempo");
  assert.equal(t.sinEstimar, 1, "la entrega sin tiempo se cuenta aparte");
  assert.ok(!t.items.some((x) => x.id === "tarjetas:lab1"), "una unidad sin tarjetas vencidas no sale");
});

test("tiempos: la entrega con minutos apuntados entra en el orden y en el total; lo absurdo se ignora", () => {
  const t = P.pendientesTiempo(base({ estimaciones: { e1: 15 } }));
  assert.deepEqual(t.items.map((x) => x.id), ["repaso", "tarjetas:bio1", "entrega:e1", "sesion:s1"]);
  assert.equal(t.total, 53); assert.equal(t.sinEstimar, 0);
  assert.equal(P.pendientesTiempo(base({ estimaciones: { e1: -3 } })).items.at(-1).minutos, null);
  assert.equal(P.minValidos("45"), 45); assert.equal(P.minValidos("0"), null); assert.equal(P.minValidos("abc"), null); assert.equal(P.minValidos(9999), null);
});

test("tiempos: el ritmo real ajusta las sesiones (y nada si hay pocas medidas)", () => {
  const ses = [{ id: "a", minutos: 20 }, { id: "b", minutos: 20 }, { id: "c", minutos: 20 }];
  const est = { a: { hecha: "2026-11-10" }, b: { hecha: "2026-11-12" } };
  assert.equal(P.ritmo({ medidas: { a: 30 }, sesiones: ses, estados: est }), null, "con una sola medida no se ajusta");
  const r = P.ritmo({ medidas: { a: 30, b: 30, c: 99 }, sesiones: ses, estados: est });
  assert.equal(r.factor, 1.5); assert.equal(r.n, 2, "la sesión sin hacer no cuenta");
  assert.equal(P.ritmo({ medidas: { a: 200, b: 200 }, sesiones: ses, estados: est }).factor, 2, "pantalla olvidada abierta: se recorta");
  assert.equal(P.ritmo({ medidas: { a: 1, b: 1 }, sesiones: ses, estados: est }), null, "medidas de menos de 3 min no valen");
  assert.equal(P.pendientesTiempo(base({ factor: 1.5 })).items.find((x) => x.tipo === "sesion").minutos, 38);
});

test("tengo X minutos: lo más urgente que quepa; el repaso y las tarjetas se parten", () => {
  const t = P.pendientesTiempo(base({ estimaciones: { e1: 8 } }));
  const a = P.tanda(t.items, 10);
  assert.deepEqual(a.items.map((x) => x.id), ["entrega:e1"], "la entrega de mañana va primero; lo demás no cabe entero ni en 3 min");
  assert.equal(a.sobran, 2);
  const b = P.tanda(t.items, 25);
  assert.deepEqual(b.items.map((x) => [x.id, x.minutos, !!x.parcial]), [["entrega:e1", 8, false], ["repaso", 6, false], ["tarjetas:bio1", 7, false]]);
  const c = P.tanda(t.items, 45);
  assert.deepEqual(c.items.map((x) => x.id), ["entrega:e1", "repaso", "tarjetas:bio1"], "la sesión de 25 no cabe en los 24 que quedan");
  assert.equal(c.quedanFuera, 1);
  const p = P.tanda(P.pendientesTiempo(base({ repaso: 20 })).items, 12);
  assert.deepEqual(p.items.map((x) => [x.id, x.minutos, !!x.parcial]), [["repaso", 12, true]], "el repaso de 30 min se parte para llenar 12");
  assert.deepEqual(p.sinTiempo.map((x) => x.id), ["entrega:e1"], "la entrega sin tiempo que vence pronto se avisa aparte");
});

test("tengo X minutos: el examen más cercano manda entre sesiones", () => {
  const items = P.pendientesTiempo({ hoy: HOY, sesiones: [
    { id: "lejos", titulo: "Lejos", minutos: 20, vence: d("2026-11-28") },
    { id: "cerca", titulo: "Cerca", minutos: 25, vence: d("2026-11-19") },
  ] }).items;
  assert.deepEqual(P.tanda(items, 30).items.map((x) => x.id), ["sesion:cerca"]);
  assert.deepEqual(P.tanda([], 25).items, []);
});

test("tengo X minutos: una sesión cuenta como dos ratos y solo entra lo que cabe", () => {
  const items = P.pendientesTiempo({ hoy: HOY, sesiones: [
    { id: "s1", titulo: "Sesión", minutos: 13, rato: "A", vence: d("2026-11-20") },
    { id: "s1", titulo: "Sesión", minutos: 13, rato: "B", vence: d("2026-11-20") },
  ] }).items;
  assert.deepEqual(items.map((x) => x.id), ["sesion:s1:A", "sesion:s1:B"]);
  assert.match(items[0].titulo, /rato A/);
  const t = P.tanda(items, 10);
  assert.deepEqual(t.items, [], "un rato de 13 min no entra en 10: solo lo que cabe");
  assert.equal(t.sobran, 10);
  assert.deepEqual(P.tanda(items, 13).items.map((x) => x.id), ["sesion:s1:A"], "en 13, justo");
  assert.deepEqual(P.tanda(items, 25).items.map((x) => x.id), ["sesion:s1:A"], "el B no entra en los 12 que quedan");
  assert.deepEqual(P.tanda(items, 26).items.map((x) => x.id), ["sesion:s1:A", "sesion:s1:B"]);
});

test("duración en palabras", () => {
  assert.equal(P.duracion(80), "1 h 20 min"); assert.equal(P.duracion(45), "45 min"); assert.equal(P.duracion(120), "2 h"); assert.equal(P.duracion(0), "0 min");
});
