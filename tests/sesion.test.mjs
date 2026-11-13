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

test("recorrido: Hoy propone la que está a medias; si no, la primera sin hacer", () => {
  const l = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(L.siguienteSesion(l, {}).id, "a");
  assert.equal(L.siguienteSesion(l, { a: { hecha: "2026-11-10", paso: 4, inicio: "2026-11-10" } }).id, "b");
  assert.equal(L.siguienteSesion(l, { a: { hecha: "2026-11-10", paso: 4, inicio: "x" }, c: { inicio: "2026-11-11", paso: 2 } }).id, "c", "la empezada manda");
  assert.equal(L.siguienteSesion(l, { a: { hecha: "1" }, b: { hecha: "1" }, c: { hecha: "1" } }), null);
});

test("índice de sesiones: cada una existe, está en el modo sin conexión y apunta a una unidad real", () => {
  const I = JSON.parse(readFileSync(new URL("app/sesiones/indice.json", ROOT), "utf8"));
  const sw = readFileSync(new URL("sw.js", ROOT), "utf8");
  const D = req("../app/datos.js");
  const ids = new Set();
  for (const s of I.sesiones) {
    assert.ok(!ids.has(s.id), "repetida: " + s.id); ids.add(s.id);
    assert.ok(existsSync(new URL("app/sesiones/" + s.id + ".json", ROOT)), "falta el archivo de " + s.id);
    assert.ok(sw.includes('"app/sesiones/' + s.id + '.json"'), "no está en el SHELL del service worker: " + s.id);
    assert.ok(D.UNIDADES.some((u) => u.id === s.unidad), "unidad desconocida: " + s.unidad);
    const S = JSON.parse(readFileSync(new URL("app/sesiones/" + s.id + ".json", ROOT), "utf8"));
    assert.equal(S.id, s.id); assert.equal(S.unidad, s.unidad);
  }
});

const INDICE = JSON.parse(readFileSync(new URL("app/sesiones/indice.json", ROOT), "utf8")).sesiones;
for (const entrada of INDICE) test("sesión " + entrada.id + ": todo lo marcado como «profe» está tal cual en el repaso de " + entrada.unidad, () => {
  const S = JSON.parse(readFileSync(new URL("app/sesiones/" + entrada.id + ".json", ROOT), "utf8"));
  const html = readFileSync(new URL(S.unidad + "/repaso/index.html", ROOT), "utf8");
  /* las etiquetas de formato (negrita, cursiva…) se quitan sin dejar hueco: «<strong>De</strong>stilación» = «Destilación» */
  const plano = (s) => s.replace(/<\/?(strong|b|em|i|u|span|mark|sub|sup|small)\b[^>]*>/g, "").replace(/<[^>]+>/g, " ").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&").replace(/[«»"]/g, "").replace(/\s+/g, " ").replace(/\s+([.,;:)…])/g, "$1").replace(/\(\s+/g, "(").trim();
  const original = plano(html);
  for (const c of S.conceptos) {
    for (const k of ["dice", "entiende", "truco"]) {
      if (!c.profe[k]) continue;
      /* el copiador no puede arrastrar trozos de la ficha de al lado (figuras, recuadros, «Entiéndelo» dentro de «dice») */
      const cuenta = (re) => (c.profe[k].match(re) || []).length;
      assert.ok(!/<figure|<div class="box/.test(c.profe[k]) && cuenta(/<div\b/g) === cuenta(/<\/div>/g),c.id + " · " + k + ": se ha colado HTML de fuera del texto de la profe");
      /* cada frase (o celda) de la profe tiene que aparecer en el original */
      const trozos = plano(c.profe[k].replace(/<\/(li|td|th|p)>/g, "|")).split("|").map((x) => x.trim().replace(/^Entiéndelo:\s*/i, "")).filter((x) => x.length > 3);
      for (const t of trozos) assert.ok(original.toLowerCase().includes(t.toLowerCase()), c.id + " · " + k + ": no está tal cual → «" + t + "»");
    }
    for (const p of c.recuerda.puntos) assert.ok(typeof p === "string" && p.length > 5);
    assert.ok(c.gancho && c.porque.pregunta && c.porque.respuesta, c.id + ": falta el gancho o el porqué");
    for (const a of c.aplica) assert.ok(a.buena >= 0 && a.buena < a.opciones.length, c.id + ": respuesta buena fuera de rango");
    if (c.profe.img) assert.ok(existsSync(new URL(c.profe.img.replace(/^\.\.\//, ""), ROOT)), c.id + ": falta la imagen");
  }
  assert.ok(S.misterio.caso && (S.misterio.solucion || S.misterio.solucionProfe) && S.misterio.corte);
  for (const k of ["solucionProfe", "entiendeProfe"]) {
    if (!S.misterio[k]) continue;
    const trozos = plano(S.misterio[k].replace(/<\/(li|td|th|p)>/g, "|")).split("|").map((x) => x.trim()).filter((x) => x.length > 3);
    for (const t of trozos) assert.ok(original.toLowerCase().includes(t.toLowerCase()), "misterio · " + k + ": no está tal cual → «" + t + "»");
  }
  assert.ok(S.conceptos.every((c) => c.profe.dice), "algún concepto sin «Lo que dice la profe» (¿falta node scripts/copiar-profe.mjs?)");
});

test("sesión de hoy: la guía el examen más cercano", () => {
  const l = [{ id: "lab1-a", unidad: "lab1" }, { id: "ipe2-a", unidad: "ipe2" }, { id: "ipe2-b", unidad: "ipe2" }, { id: "ipe5-a", unidad: "ipe-tema5" }];
  const asig = (u) => (u.startsWith("ipe") ? "ipe" : "lab");
  assert.equal(L.siguienteParaExamen(l, {}, null, asig).s.id, "lab1-a", "sin examen: el recorrido");
  assert.equal(L.siguienteParaExamen(l, {}, { unidad: "ipe2", s: "ipe" }, asig).s.id, "ipe2-a", "con examen: su unidad");
  const hechas = { "ipe2-a": { hecha: "x", inicio: "x", paso: 4 }, "ipe2-b": { hecha: "x", inicio: "x", paso: 4 } };
  assert.equal(L.siguienteParaExamen(l, hechas, { unidad: "ipe2", s: "ipe" }, asig).s.id, "ipe5-a", "unidad hecha: su asignatura");
  assert.equal(L.siguienteParaExamen(l, {}, { s: "ipe" }, asig).s.id, "ipe2-a", "examen sin unidad: su asignatura");
  assert.equal(L.siguienteParaExamen(l, {}, { unidad: "ipe2", s: "ipe" }, asig).de.length, 2);
});
