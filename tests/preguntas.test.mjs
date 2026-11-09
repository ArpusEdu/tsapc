import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { UNIDADES, extraerUnidad, recuentoOriginal, recuentoTarjetas, literal } from "../scripts/extraer-preguntas.mjs";

const json = (u) => JSON.parse(readFileSync(new URL("../app/preguntas/" + u + ".json", import.meta.url), "utf8"));
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
  for (const u of UNIDADES) assert.deepEqual(json(u).bancos.map((b) => b.preguntas.length), recuentoOriginal(u), u);
});

test("las tarjetas de pregunta coinciden con las del repaso", () => {
  for (const u of UNIDADES) assert.equal(json(u).tarjetas.filter((t) => t.tipo === "pregunta").length, recuentoTarjetas(u), u);
  assert.equal(json("ingles1").tarjetas.filter((t) => t.tipo === "palabra").length, 50);
});

test("ids estables, únicos y con el formato <unidad>.q.017", () => {
  const todos = new Set();
  for (const u of UNIDADES) {
    const d = json(u);
    d.bancos.forEach((b, bi) => b.preguntas.forEach((q, i) => {
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
    for (const b of json(u).bancos) {
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
    if (q.tipo === "esquema") assert.ok(q.img && q.respuestas.length, q.id);
    if (q.tipo === "abierta") assert.equal(typeof q.respuesta, "string", q.id);
    assert.ok(b.partes.some((p) => p.id === q.parte), q.id);
  }
});
