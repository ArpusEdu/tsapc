import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const Q = req("../app/quiz.js");
const S = req("../app/sm2.js");
const banco = (u, i = 0) => JSON.parse(readFileSync(new URL("../app/preguntas/" + u + ".json", import.meta.url), "utf8")).bancos[i];

const mc = { id: "x.q.001", tipo: "test", texto: "¿2+2?", opciones: ["3", "4", "5", "6"], correcta: 1 };
const vf = { id: "x.q.002", tipo: "vf", texto: "El agua moja", correcta: true };
const ab = { id: "x.q.003", tipo: "abierta", texto: "Explica", respuesta: "Así" };
const rel = { id: "x.q.004", tipo: "relacionar", texto: "Relaciona", opciones: ["A", "B", "C"], filas: [["uno", [0]], ["dos", [1]], ["tres", [2, 1]]] };
const esq = { id: "x.q.005", tipo: "esquema", texto: "Partes", img: "img/1.jpg", respuestas: ["Tejido conectivo", "Núcleo (carioteca)"] };
const esc = { id: "x.q.006", tipo: "escribir", texto: "go", campos: [{ etiqueta: "Past simple", aceptadas: ["went"] }, { etiqueta: "Past participle", aceptadas: ["gone"] }] };
const TODAS = [mc, vf, ab, rel, esq, esc];

test("barajado estable por intento y con la correcta reasignada", () => {
  const p = banco("bio2").preguntas.filter((q) => q.tipo === "test");
  const a = Q.crearIntento({ unidad: "bio2", banco: "sim", preguntas: p, semilla: "s1", ahora: 1 });
  const b = Q.crearIntento({ unidad: "bio2", banco: "sim", preguntas: p, semilla: "s1", ahora: 2 });
  const c = Q.crearIntento({ unidad: "bio2", banco: "sim", preguntas: p, semilla: "s2", ahora: 3 });
  assert.deepEqual(a.orden, b.orden); assert.deepEqual(a.perm, b.perm);
  assert.notDeepEqual(a.orden, c.orden);
  assert.deepEqual([...a.orden].sort(), p.map((q) => q.id).sort());
  let movidas = 0;
  for (const q of p) {
    const v = Q.presentar(q, a);
    assert.equal(v.opciones[v.correcta], q.opciones[q.correcta]);
    assert.deepEqual([...v.opciones].sort(), [...q.opciones].sort());
    if (v.correcta !== q.correcta) movidas++;
    assert.equal(Q.valorDesdePosicion(q, a, v.correcta), q.correcta);
  }
  assert.ok(movidas > p.length / 3, "la respuesta buena cambia de sitio");
  const sin = Q.crearIntento({ preguntas: p, barajar: false, ahora: 1 });
  assert.deepEqual(sin.orden, p.map((q) => q.id)); assert.deepEqual(sin.perm, {});
});

test("las opciones que se refieren a otras no se barajan", () => {
  assert.equal(Q.barajable({ tipo: "test", opciones: ["x", "y", "Todas las anteriores"] }), false);
  assert.equal(Q.barajable({ tipo: "test", opciones: ["x", "y", "a) y b) son correctas"] }), false);
  assert.equal(Q.barajable(mc), true);
});

test("avisa de las sin contestar, en el orden del intento", () => {
  const i = Q.crearIntento({ preguntas: TODAS, barajar: false, ahora: 1 });
  assert.deepEqual(Q.sinContestar(i, TODAS), TODAS.map((q) => q.id));
  Q.responder(i, mc.id, 1); Q.responder(i, vf.id, false); Q.responder(i, ab.id, "   ");
  Q.responder(i, rel.id, [0, 1]);                         /* a medias: cuenta como sin contestar */
  Q.responder(i, esq.id, ["tejido conectivo", "nucleo"]); Q.responder(i, esc.id, ["went", ""]);
  assert.deepEqual(Q.sinContestar(i, TODAS), [ab.id, rel.id, esc.id]);
  Q.responder(i, mc.id, null);
  assert.ok(Q.sinContestar(i, TODAS).includes(mc.id));
});

test("corrige: nota sobre 10, desglose por tipo y abiertas por marcar", () => {
  const i = Q.crearIntento({ preguntas: TODAS, barajar: false, ahora: 1 });
  Q.responder(i, mc.id, 1);                                /* bien: 1/1 */
  Q.responder(i, vf.id, false);                            /* mal: 0/1 */
  Q.responder(i, ab.id, "Así");                            /* por marcar: 0/1 */
  Q.responder(i, rel.id, [0, 2, 1]);                       /* uno bien, dos mal, tres bien (vale 1 o 2): 2/3 */
  Q.responder(i, esq.id, ["tejido conectivo", "carioteca"]); /* 2/2 con alternativas del paréntesis */
  Q.responder(i, esc.id, ["Went.", "goned"]);              /* 1/2 */
  let c = Q.corregir(i, TODAS);
  assert.equal(c.max, 10); assert.equal(c.puntos, 6); assert.equal(c.nota, 6);
  assert.deepEqual(c.pendientes, [ab.id]);
  assert.deepEqual(c.falladas, [vf.id, rel.id, esc.id]);
  assert.equal(c.porTipo.relacionar.puntos, 2); assert.equal(c.porTipo.relacionar.max, 3);
  assert.equal(c.porTipo.test.aciertos, 1);
  Q.autoevaluar(i, ab.id, true);
  c = Q.corregir(i, TODAS);
  assert.equal(c.nota, 7); assert.deepEqual(c.pendientes, []);
  assert.equal(c.porPregunta[vf.id].dada, "Falso"); assert.equal(c.porPregunta[vf.id].correcta, "Verdadero");
});

test("nota con decimales y sin contestar = fallo", () => {
  const p = banco("lab1").preguntas.slice(0, 3);
  const i = Q.crearIntento({ preguntas: p, semilla: "z", ahora: 1 });
  Q.responder(i, p[0].id, p[0].correcta);
  const c = Q.corregir(i, p);
  assert.equal(c.nota, 3.3); assert.equal(c.falladas.length, 2);
  assert.equal(c.porPregunta[p[1].id].dada, "");
});

test("repetir solo las falladas", () => {
  const p = banco("gest1").preguntas.slice(0, 10);
  const i = Q.crearIntento({ preguntas: p, semilla: "a", ahora: 1 });
  p.forEach((q, k) => Q.responder(i, q.id, k % 2 ? q.correcta : (q.correcta + 1) % q.opciones.length));
  const c = Q.corregir(i, p);
  const otra = Q.crearIntento({ preguntas: p.filter((q) => c.falladas.includes(q.id)), modo: "falladas", semilla: "b", ahora: 2 });
  assert.equal(otra.orden.length, 5); assert.equal(otra.modo, "falladas");
  assert.deepEqual([...otra.orden].sort(), [...c.falladas].sort());
});

test("modo examen: temporizador, final e historial", () => {
  const i = Q.crearIntento({ preguntas: [mc, vf], modo: "examen", minutos: 10, ahora: 1000 });
  assert.equal(Q.restante(i, 1000 + 60000), 9 * 60000);
  assert.equal(Q.agotado(i, 1000 + 600000), true);
  assert.equal(Q.restante(Q.crearIntento({ preguntas: [mc], ahora: 1 }), 5), null);
  Q.responder(i, mc.id, 1); Q.terminar(i, 1000 + 120000);
  Q.responder(i, vf.id, true);                             /* terminado: ya no cambia */
  assert.equal(i.resp[vf.id], undefined);
  const r = Q.resumen(i, Q.corregir(i, [mc, vf]));
  assert.equal(r.nota, 5); assert.equal(r.segundos, 120); assert.equal(r.modo, "examen");
  let h = Q.registrar([], r);
  h = Q.registrar(h, Object.assign({}, r, { id: "otro", nota: 8 }));
  h = Q.registrar(h, Object.assign({}, r, { nota: 6 }));    /* mismo id: se actualiza */
  assert.equal(h.length, 2); assert.equal(Q.mejor(h).nota, 8); assert.equal(Q.ultimo(h).nota, 6);
  let largo = []; for (let k = 0; k < 70; k++) largo = Q.registrar(largo, { id: "i" + k, nota: k % 10 });
  assert.equal(largo.length, 60); assert.equal(largo[0].id, "i10");
});

test("mazo de errores: entra con la dada y la buena, sale tras 2 aciertos seguidos", () => {
  const ronda = (mazo, valor, n) => { const i = Q.crearIntento({ preguntas: [mc, ab], barajar: false, ahora: n }); Q.responder(i, mc.id, valor); Q.responder(i, ab.id, "x"); return Q.apuntar(mazo, i, [mc, ab], Q.corregir(i, [mc, ab]), n); };
  let r = ronda({}, 0, 1);
  assert.deepEqual(r.entran, [mc.id]);
  assert.equal(r.mazo[mc.id].dada, "3"); assert.equal(r.mazo[mc.id].correcta, "4"); assert.equal(r.mazo[mc.id].veces, 1);
  assert.equal(r.mazo[ab.id], undefined, "las abiertas sin marcar no entran");
  r = ronda(r.mazo, 1, 2); assert.equal(r.mazo[mc.id].racha, 1);
  r = ronda(r.mazo, 2, 3); assert.equal(r.mazo[mc.id].racha, 0); assert.equal(r.mazo[mc.id].veces, 2);   /* fallo: la racha vuelve a 0 */
  r = ronda(r.mazo, 1, 4); r = ronda(r.mazo, 1, 5);
  assert.deepEqual(r.salen, [mc.id]); assert.equal(r.mazo[mc.id], undefined);
  const antes = { [mc.id]: { racha: 1 } }; ronda(antes, 1, 6);
  assert.equal(antes[mc.id].racha, 1, "no muta el mazo de entrada");
});

test("SM-2: Otra vez, Bien y Fácil", () => {
  const hoy = "2026-11-09";
  let e = S.puntuar(null, "bien", hoy);
  assert.equal(e.rep, 1); assert.equal(e.int, 1); assert.equal(e.due, "2026-11-10");
  e = S.puntuar(e, "bien", "2026-11-10"); assert.equal(e.int, 6); assert.equal(e.due, "2026-11-16");
  e = S.puntuar(e, "bien", "2026-11-16"); assert.equal(e.rep, 3); assert.ok(e.int >= 14); assert.equal(S.dominada(e), true); assert.equal(S.caja(e), 3);
  const f = S.puntuar(e, "otra", "2026-12-01");
  assert.equal(f.rep, 0); assert.equal(f.due, "2026-12-01"); assert.equal(S.dominada(f), false); assert.ok(f.ef < e.ef); assert.equal(f.ko, 1); assert.equal(f.ok, 3);
  const fa = S.puntuar(null, "facil", hoy); assert.equal(fa.int, 3); assert.ok(fa.ef > 2.5);
  let low = null; for (let k = 0; k < 20; k++) low = S.puntuar(low, "otra", hoy); assert.equal(low.ef, 1.3);
  assert.throws(() => S.puntuar(null, "mal", hoy));
  assert.deepEqual(S.previsto(null, hoy), { otra: 0, bien: 1, facil: 3 });
  assert.equal(S.sumarDias("2026-12-30", 3), "2027-01-02");
});

test("SM-2: las de hoy, el aviso y las cajas Leitner", () => {
  const T = [1, 2, 3, 4, 5].map((n) => ({ id: "t" + n }));
  const est = { t1: { rep: 1, due: "2026-11-08" }, t2: { rep: 2, due: "2026-11-20" }, t3: { rep: 0, due: "2026-11-05" } };
  assert.deepEqual(S.paraHoy(T, est, "2026-11-09", 1).map((t) => t.id), ["t3", "t1", "t4"]);
  assert.equal(S.pendientes(est, "2026-11-09"), 2);
  assert.deepEqual(S.recuento(T, Object.assign({}, est, { t5: { rep: 4 } })).cajas, [2, 1, 1, 1]);
  assert.equal(S.desdeCaja(3, "2026-11-09").rep, 3); assert.equal(S.desdeCaja(0, "2026-11-09").due, null);
  assert.equal(S.CAJAS[3], "La sabes");
  const hoyE = { a: S.puntuar(null, "bien", "2026-11-09"), b: S.puntuar(null, "otra", "2026-11-09"), c: S.puntuar(S.puntuar(null, "bien", "2026-11-01"), "bien", "2026-11-09") };
  assert.equal(S.nuevasRestantes(hoyE, "2026-11-09"), S.NUEVAS_DIA - 2, "tope diario de nuevas");
  assert.equal(S.paraHoy(T, {}, "2026-11-09").length, 5);
});
