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

test("sin mirar: sin intento, como mucho «otra»; la primera vez, como mucho «bien»", () => {
  assert.equal(L.nota([true, true, true], 3, { intento: false }), "otra", "sin palabras ni voz alta no hay «fácil»");
  assert.equal(L.nota([true, true, true], 3, { primera: true }), "bien");
  assert.equal(L.nota([true, false, false], 3, { primera: true }), "otra");
  assert.equal(L.nota([true, true, true], 3, { intento: true }), "facil");
  assert.equal(L.nota([true, true], 2, { intento: undefined }), "facil", "lo guardado antes, sin el dato, no se castiga");
  assert.equal(L.hayIntento("", false), false); assert.equal(L.hayIntento("   x ", false), false);
  assert.equal(L.hayIntento("", true), true, "«Lo he dicho en voz alta» vale");
  assert.equal(L.hayIntento("célula epitelial", false), true);
  assert.equal(L.resultado(3, 3), "todo"); assert.equal(L.resultado(2, 4), "mitad"); assert.equal(L.resultado(1, 4), "poco");
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
  assert.deepEqual(r, [{ u: "lab1", id: "b" }], "solo lo que ya toca o ya viste: nada sin estudiar");
  const f2 = [
    { unidad: "lab1", bloques: [], tarjetas: [{ id: "a" }, { id: "b" }, { id: "n" }], estados: { a: { due: "2026-11-20", ult: "2026-11-09" }, b: { due: "2026-11-10" } } },
    { unidad: "bio1", bloques: [], tarjetas: [{ id: "z" }, { id: "y" }], estados: { z: { due: "2026-11-15", ult: "2026-11-08" }, y: { due: "2026-11-30", ult: "2026-11-11" } } }
  ];
  const r2 = L.elegirOtros(f2, hoy, S2, 4);
  assert.deepEqual(r2[0], { u: "lab1", id: "b" }, "la vencida va primero");
  assert.ok(!r2.some((x) => x.id === "n"), "la tarjeta sin estudiar no sale");
  assert.ok(!r2.some((x) => x.id === "y"), "la vista hoy mismo, tampoco");
  assert.deepEqual(r2.slice(1).map((x) => x.u), ["bio1", "lab1"], "luego las ya vistas que antes vuelven, alternando unidades");
  assert.deepEqual(L.elegirOtros(f2, hoy, S2, 0), [], "con 0, nada");
});

test("sesión en dos ratos: misterio → descubre → (pausa) → otros días → sin mirar → resuelve", () => {
  const ids = ["c1", "c2"];
  const e = (o) => L.estado(o);
  assert.equal(L.siguientePaso(e({ paso: 0 }), ids), 1);
  assert.equal(L.siguientePaso(e({ paso: 1 }), ids), 4, "acabado descubre, el rato B empieza por lo de otros días");
  assert.equal(L.siguientePaso(e({ paso: 4, cola: [{ u: "a", id: "x" }], k: 1 }), ids), 2);
  assert.equal(L.siguientePaso(e({ paso: 2, cola: [], k: 0, recuerdo: { c1: { guardado: true }, c2: { guardado: true } } }), ids), 3);
  assert.equal(L.siguientePaso(e({ paso: 3, cola: [], k: 0, acierto: "si", recuerdo: { c1: { guardado: true }, c2: { guardado: true } } }), ids), 5);
  /* una sesión a medias del orden antiguo (sin mirar hecho, otros días sin hacer) sigue sin perder nada */
  assert.equal(L.siguientePaso(e({ paso: 3, acierto: "no", recuerdo: { c1: { guardado: true }, c2: { guardado: true } } }), ids), 4);
  assert.equal(L.enPausa(e({ paso: 4, ratoA: "2026-11-13" }), "2026-11-13"), true);
  assert.equal(L.enPausa(e({ paso: 4, ratoA: "2026-11-13", ratoB: "2026-11-13" }), "2026-11-13"), false);
  assert.equal(L.enPausa(e({ paso: 4, ratoA: "2026-11-12" }), "2026-11-13"), false, "otro día, el B empieza solo");
  assert.deepEqual(L.PASOS.map((p) => p[0]), ["misterio", "descubre", "otros", "sinmirar", "resuelve"]);
  assert.equal(L.VISTA[4], 2); assert.equal(L.VISTA[2], 3);
});

test("repaso: vuelve lo que ya toca, nunca lo estudiado hoy mismo", () => {
  const hoy = "2026-11-12";
  const est = { a: { due: "2026-11-12", ult: "2026-11-11" }, b: { due: "2026-11-11", ult: "2026-11-11" }, c: { due: "2026-11-12", ult: "2026-11-12" }, d: { due: "2026-11-20", ult: "2026-11-11" } };
  assert.deepEqual(L.conceptosHoy(est, hoy), ["b", "a"], "primero el más atrasado; ni el de hoy ni el futuro");
  assert.deepEqual(L.conceptosHoy(est, hoy, 1), ["b"], "con tope, solo los más atrasados; el resto, otro día");
  const muchos = {}; for (let i = 0; i < 23; i++) muchos["k" + i] = { due: "2026-11-" + String(1 + (i % 11)).padStart(2, "0"), ult: "2026-10-01" };
  assert.equal(L.conceptosHoy(muchos, hoy, L.TOPE_REPASO).length, 8);
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

test("sesión de hoy: si el examen dice qué sesiones entran, solo esas", () => {
  const l = [{ id: "u-a", unidad: "u" }, { id: "u-b", unidad: "u" }, { id: "u-c", unidad: "u" }];
  const r = L.siguienteParaExamen(l, {}, { unidad: "u", s: "x", sesiones: ["u-b", "u-c"] }, () => "x");
  assert.equal(r.s.id, "u-b"); assert.equal(r.de.length, 2);
});
