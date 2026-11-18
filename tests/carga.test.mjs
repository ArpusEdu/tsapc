/* Lo que llega por red en las sesiones (app/sesion.js › cargar, sesionDe y bancoDe): tras un error NO se vuelve a pedir
   al repintar (antes se pedía sin parar, ~140 veces por segundo), se ve el error con «Reintentar» y solo ese botón lo pide otra vez. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const S2 = req("../app/sm2.js");

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
function montar(responder, hash, datos) {
  const pedidas = [], clics = [];
  globalThis.window = { CorteSM2: S2, addEventListener() {} };
  globalThis.location = { hash };
  globalThis.document = {
    addEventListener(t, f) { if (t === "click") clics.push(f); },
    querySelector() { return null }, getElementById() { return null },
    documentElement: { classList: { add() {}, remove() {} } }
  };
  globalThis.fetch = (url) => { pedidas.push(url); return responder(url); };
  delete req.cache[req.resolve("../app/sesion.js")];
  const crear = req("../app/sesion.js").crear;
  let html = "", pintadas = 0, api = null;
  const U = { id: "lab1", s: "lab", codigo: "Lab 1", titulo: "Unidad", pegatina: "matraz" };
  const ctx = {
    D: { unidad: () => U }, A: { lab: { nombre: "Laboratorio", ab: "Lab" } },
    esc: (s) => String(s), ico: (i) => "<i:" + i + ">", ahora: () => new Date(2026, 10, 17, 18, 0),
    leer: (r, d) => { const k = Array.isArray(r) ? r.join(".") : r; return k in (datos || {}) ? datos[k] : d; }, guardar: () => true,
    aviso() {}, cargando: (t) => "<cargando " + t + ">", titulo: (h) => "<h1>" + h + "</h1>", ruta: () => "", pegatina: () => "",
    pintar() { pintadas++; html = api.sesion(location.hash.split("/")[2]).html; }, repintar() {}
  };
  api = crear(ctx);
  html = api.sesion(hash.split("/")[2]).html;
  return { api, pedidas, clics, get html() { return html; }, get pintadas() { return pintadas; } };
}
const json = (o) => Promise.resolve({ ok: true, json: () => Promise.resolve(o) });
const falla = () => Promise.reject(new Error("sin red"));

test("sesión sin red: se pide una vez, sale el error con «Reintentar» y no hay bucle", async () => {
  const m = montar(falla, "#/sesion/lab1-vidrio");
  await espera(60);
  assert.equal(m.pedidas.filter((u) => u === "sesiones/lab1-vidrio.json").length, 1, "una sola petición, aunque se repinte");
  assert.ok(m.pintadas >= 1);
  assert.match(m.html, /No se pudo cargar la sesión/);
  assert.match(m.html, /data-ss-reintentar/);
  assert.match(m.html, /Reintentar/);
  /* «Reintentar» lo pide otra vez, una sola */
  m.api.reintentar(); await espera(60);
  assert.equal(m.pedidas.filter((u) => u === "sesiones/lab1-vidrio.json").length, 2);
  assert.equal(m.api.hayFallo(), true);
});

test("repaso de hoy con el banco de tarjetas sin red (bancoDe): una petición y el error", async () => {
  const datos = { "personal.sesiones": { s1: { inicio: "2026-11-16", paso: 1 } }, "personal.conceptos": {} };
  const m = montar((u) => u === "sesiones/indice.json" ? json({ sesiones: [{ id: "s1", unidad: "lab1", bloque: 1, titulo: "S1", minutos: 20 }] })
    : u === "sesiones/s1.json" ? json({ id: "s1", unidad: "lab1", bloque: 1, titulo: "S1", minutos: 20, conceptos: [], otrosDias: [] }) : falla(), "#/sesion/repaso", datos);
  await espera(120);
  assert.equal(m.pedidas.filter((u) => u === "preguntas/lab1.json").length, 1, "el banco se pide una vez");
  assert.ok(m.pedidas.length <= 4, "nada de peticiones de más: " + m.pedidas.join(", "));
  assert.match(m.html, /No se pudo preparar el repaso/);
  assert.match(m.html, /Reintentar/);
  assert.match(m.html, /Salir/, "el repaso tiene salida");
});

test("cuando todo llega, no se vuelve a pedir nada al repintar", async () => {
  const m = montar((u) => json({ id: "x", unidad: "lab1", bloque: 1, titulo: "X", minutos: 20, misterio: { titulo: "T", caso: "C", pregunta: "P", claves: [] }, conceptos: [{ id: "c1", n: 1, titulo: "C1", diapositivas: "1", gancho: "g", profe: { dice: "" }, porque: { pregunta: "p", respuesta: "r" }, recuerda: { pide: "x", puntos: ["a"] } }] }), "#/sesion/x");
  await espera(60);
  m.api.sesion("x"); m.api.sesion("x"); await espera(30);
  assert.equal(m.pedidas.length, 1);
  assert.doesNotMatch(m.html, /Reintentar/);
});
