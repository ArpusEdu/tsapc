import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { L } = req("../app/sesion.js");
const S2 = req("../app/sm2.js");
const ROOT = new URL("../", import.meta.url);

test("sesión: la nota sale de lo que dijiste sin mirar", () => {
  assert.equal(L.nota([true, true, true], 3), "facil");
  assert.equal(L.nota([true, true, false, false], 4), "bien");
  assert.equal(L.nota([true, false, false], 3), "otra");
  assert.equal(L.nota([], 0), "bien");
});

test("sesión: datos guardados raros no rompen nada", () => {
  const e = L.estado({ paso: 99, i: -3, apuesta: 7, acierto: "quizá", cola: [{ u: "lab1", id: "x" }, null, { u: 3 }] });
  assert.equal(e.paso, 5); assert.equal(e.i, 0); assert.equal(e.apuesta, ""); assert.equal(e.acierto, null);
  assert.deepEqual(e.cola, [{ u: "lab1", id: "x" }]);
  assert.deepEqual(L.estado(null).paso, 0);
});

test("sesión: lo de otros días trae primero lo que ya toca y mezcla asignaturas", () => {
  const hoy = "2026-11-11";
  const f = [
    { unidad: "lab1", bloques: ["BLOQUE 1"], tarjetas: [{ id: "a", bloqueNum: "BLOQUE 1" }, { id: "b", bloqueNum: "BLOQUE 1" }, { id: "c", bloqueNum: "BLOQUE 3" }], estados: { b: { due: "2026-11-10" } } },
    { unidad: "bio1", bloques: [], tarjetas: [{ id: "z", bloqueNum: "BLOQUE 1" }, { id: "y", bloqueNum: "BLOQUE 2" }], estados: {} }
  ];
  const r = L.elegirOtros(f, hoy, S2, 4);
  assert.deepEqual(r[0], { u: "lab1", id: "b" }, "la vencida va primero");
  assert.ok(!r.some((x) => x.id === "c"), "solo de los bloques pedidos");
  assert.deepEqual(r.slice(1).map((x) => x.u), ["lab1", "bio1", "bio1"], "alterna unidades");
});

test("repaso: vuelve lo que ya toca, nunca lo estudiado hoy mismo", () => {
  const hoy = "2026-11-12";
  const est = { a: { due: "2026-11-12", ult: "2026-11-11" }, b: { due: "2026-11-11", ult: "2026-11-11" }, c: { due: "2026-11-12", ult: "2026-11-12" }, d: { due: "2026-11-20", ult: "2026-11-11" } };
  assert.deepEqual(L.conceptosHoy(est, hoy), ["b", "a"], "primero el más atrasado; ni el de hoy ni el futuro");
  assert.equal(L.vuelve({ due: "2026-11-12" }, "2026-11-12", S2), "mañana", "lo que se estudia hoy vuelve, como pronto, mañana");
  assert.equal(L.vuelve({ due: "2026-11-15" }, "2026-11-12", S2), "en 3 días");
});

test("sesión lab1-agua: todo lo marcado como «profe» está tal cual en el repaso de Lab 1", () => {
  const S = JSON.parse(readFileSync(new URL("app/sesiones/lab1-agua.json", ROOT), "utf8"));
  const html = readFileSync(new URL("lab1/repaso/index.html", ROOT), "utf8");
  /* las etiquetas de formato (negrita, cursiva…) se quitan sin dejar hueco: «<strong>De</strong>stilación» = «Destilación» */
  const plano = (s) => s.replace(/<\/?(strong|b|em|i|u|span|mark|sub|sup|small)\b[^>]*>/g, "").replace(/<[^>]+>/g, " ").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&").replace(/[«»"]/g, "").replace(/\s+/g, " ").replace(/\s+([.,;:)…])/g, "$1").replace(/\(\s+/g, "(").trim();
  const original = plano(html);
  for (const c of S.conceptos) {
    for (const k of ["dice", "entiende", "truco"]) {
      if (!c.profe[k]) continue;
      /* cada frase (o celda) de la profe tiene que aparecer en el original */
      const trozos = plano(c.profe[k].replace(/<\/(li|td|th|p)>/g, "|")).split("|").map((x) => x.trim().replace(/^Entiéndelo:\s*/i, "")).filter((x) => x.length > 3);
      for (const t of trozos) assert.ok(original.toLowerCase().includes(t.toLowerCase()), c.id + " · " + k + ": no está tal cual → «" + t + "»");
    }
    for (const p of c.recuerda.puntos) assert.ok(typeof p === "string" && p.length > 5);
    assert.ok(c.gancho && c.porque.pregunta && c.porque.respuesta, c.id + ": falta el gancho o el porqué");
    for (const a of c.aplica) assert.ok(a.buena >= 0 && a.buena < a.opciones.length, c.id + ": respuesta buena fuera de rango");
    if (c.profe.img) assert.ok(existsSync(new URL(c.profe.img.replace(/^\.\.\//, ""), ROOT)), c.id + ": falta la imagen");
  }
  assert.ok(S.misterio.caso && S.misterio.solucion && S.misterio.corte);
});
