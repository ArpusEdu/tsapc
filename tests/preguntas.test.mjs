import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { UNIDADES, extraerUnidad, recuentoOriginal, recuentoTarjetas, literal } from "../scripts/extraer-preguntas.mjs";
import { plano } from "../scripts/practica-enfoque.mjs";

const json = (u) => JSON.parse(readFileSync(new URL("../app/preguntas/" + u + ".json", import.meta.url), "utf8"));
/* bancos copiados de los simulacros (los generados por Enfoque se prueban aparte) */
const sims = (u) => json(u).bancos.filter((b) => !b.generado);
const fuente = (rel) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");
/* todas las cadenas de los datos originales */
function cadenas(v, out) { if (typeof v === "string") out.add(v); else if (Array.isArray(v)) v.forEach((x) => cadenas(x, out)); else if (v && typeof v === "object") Object.values(v).forEach((x) => cadenas(x, out)); return out; }
function originales(u, banco) {
  const html = fuente(banco.fuente + "index.html");
  const nombre = /const D\s*=/.test(html) ? "D" : /const Q\s*=/.test(html) ? "Q" : "EX";
  return cadenas(literal(html, nombre), new Set());
}

test("generador: los JSON están al día y salen igual cada vez", () => {
  for (const u of UNIDADES) assert.deepEqual(json(u), JSON.parse(JSON.stringify(extraerUnidad(u))), u);
});

test("recuento de preguntas por unidad igual que el original", () => {
  for (const u of UNIDADES) assert.deepEqual(sims(u).map((b) => b.preguntas.length), recuentoOriginal(u), u);
});

test("las tarjetas de pregunta coinciden con las del repaso", () => {
  for (const u of UNIDADES) assert.equal(json(u).tarjetas.filter((t) => t.tipo === "pregunta").length, recuentoTarjetas(u), u);
  assert.equal(json("ingles1").tarjetas.filter((t) => t.tipo === "palabra").length, 50);
});

test("ids estables, únicos y con el formato <unidad>.q.017", () => {
  const todos = new Set();
  for (const u of UNIDADES) {
    const d = json(u);
    d.bancos.filter((b) => !b.generado).forEach((b, bi) => b.preguntas.forEach((q, i) => {
      const esp = u + "." + (bi === 0 ? "" : b.id + ".") + "q." + String(i + 1).padStart(3, "0");
      assert.equal(q.id, esp);
      assert.ok(!todos.has(q.id)); todos.add(q.id);
    }));
    d.tarjetas.forEach((t) => { assert.match(t.id, new RegExp("^" + u.replace("-", "\\-") + "\\.t\\.(q\\d+|d\\d+_\\d+|v\\d+)$")); assert.ok(!todos.has(t.id)); todos.add(t.id); });
  }
  assert.equal(json("bio2").bancos[0].preguntas[16].id, "bio2.q.017");
});

test("ni una letra cambiada: cada texto está tal cual en el original", () => {
  for (const u of UNIDADES) {
    for (const b of sims(u)) {
      const orig = originales(u, b);
      for (const q of b.preguntas) {
        const textos = [q.texto, q.explicacion, q.respuesta, q.pista, q.img].concat(q.opciones || [], q.respuestas || [], (q.filas || []).map((f) => f[0]), ...(q.campos || []).map((c) => c.aceptadas));
        for (const t of textos) if (t !== undefined && t !== "") assert.ok(orig.has(t), q.id + ": «" + String(t).slice(0, 60) + "»");
      }
    }
    const rep = fuente(u + "/repaso/index.html");
    for (const t of json(u).tarjetas) if (t.tipo === "pregunta") assert.ok(rep.includes(t.dorso.slice(0, 200)), t.id);
  }
});

test("sin explicaciones inventadas: solo las que trae el original", () => {
  const fisio1 = json("fisio1").bancos[0].preguntas;
  assert.ok(fisio1.every((q) => q.explicacion === undefined));
  const lab2 = json("lab2").bancos[0].preguntas.filter((q) => q.tipo === "test");
  assert.ok(lab2.every((q) => q.explicacion === undefined), "el test de lab2 no trae explicación");
  assert.ok(json("lab1").bancos[0].preguntas.every((q) => typeof q.explicacion === "string"));
});

test("cada formato tiene lo que necesita para corregirse", () => {
  for (const u of UNIDADES) for (const b of json(u).bancos) for (const q of b.preguntas) {
    if (q.tipo === "test") assert.ok(Number.isInteger(q.correcta) && q.correcta >= 0 && q.correcta < q.opciones.length, q.id);
    if (q.tipo === "vf") assert.equal(typeof q.correcta, "boolean", q.id);
    if (q.tipo === "relacionar") q.filas.forEach((f) => f[1].forEach((i) => assert.ok(i >= 0 && i < q.opciones.length, q.id)));
    if (q.tipo === "escribir") q.campos.forEach((c) => assert.ok(Array.isArray(c.aceptadas) && c.aceptadas.length, q.id));
    if (q.tipo === "esquema") assert.ok((q.img || q.variante === "hueco") && q.respuestas.length, q.id);
    if (q.tipo === "abierta") assert.equal(typeof q.respuesta, "string", q.id);
    assert.ok(b.partes.some((p) => p.id === q.parte), q.id);
  }
});

/* «Práctica de Enfoque»: todo sale de las frases de la profe, sin cambiar nada */
const contenido = (u) => JSON.parse(fuente(u + "/repaso/contenido.json"));
test("práctica de Enfoque: cada trozo está tal cual en lo que dice la profe", () => {
  let total = 0;
  for (const u of UNIDADES) {
    const b = json(u).bancos.find((x) => x.generado); if (!b) continue;
    const prof = contenido(u).bloques.flatMap((bl) => bl.conceptos).map((c) => plano(c.prof || "").replace(/\s+/g, "")).join("\n");
    const sin = (t) => plano(t).replace(/\s+/g, "");
    const esta = (t, q) => assert.ok(prof.includes(sin(t)), q.id + ": «" + plano(t).slice(0, 70) + "»");
    const ids = new Set();
    for (const q of b.preguntas) {
      total++;
      assert.match(q.id, new RegExp("^" + u.replace("-", "\\-") + "\\.e\\.c\\d+\\.(h\\d|r|v\\d)$")); assert.ok(!ids.has(q.id)); ids.add(q.id);
      if (q.tipo === "esquema") { assert.equal(q.variante, "hueco"); esta(q.texto.replace("<strong>_____</strong>", "<strong>" + q.respuestas[0] + "</strong>"), q); }
      else if (q.tipo === "relacionar") { q.opciones.forEach((o) => esta(o, q)); q.filas.forEach((f) => esta(f[0], q)); assert.ok(q.filas.length >= 3 && q.filas.length <= 6, q.id); }
      else if (q.tipo === "vf") {
        const m = /^<strong>([\s\S]+?):<\/strong> ([\s\S]+)$/.exec(q.texto); assert.ok(m, q.id);
        esta(m[1], q); esta(m[2], q);
        if (q.correcta) esta(q.texto, q); else { assert.ok(!prof.includes(sin(q.texto)), q.id + " el falso no puede estar tal cual"); esta(q.explicacion.replace(/^Eso es de <strong>[^<]+<\/strong>\. /, ""), q); }
      } else assert.fail(q.id + ": tipo inesperado " + q.tipo);
    }
  }
  assert.ok(total > 500, "hay práctica de Enfoque en las unidades (" + total + ")");
});
test("práctica de Enfoque: Fisio 4 e IPE tema 4 (sin simulacro) ya tienen preguntas", () => {
  for (const u of ["fisio4", "ipe-tema4"]) assert.ok(json(u).bancos.length === 1 && json(u).bancos[0].generado && json(u).bancos[0].preguntas.length >= 20, u);
});
