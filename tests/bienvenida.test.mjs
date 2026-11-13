import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const G = req("../app/bienvenida.js");
const leer = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("la guía sale sola solo la primera vez y solo al entrar por Hoy", () => {
  assert.equal(G.debeMostrar({}, "#/hoy"), true);
  assert.equal(G.debeMostrar(null, ""), true);
  assert.equal(G.debeMostrar(undefined, "#/"), true);
  assert.equal(G.debeMostrar({ tema: "noche" }, "#/hoy"), true);
  assert.equal(G.debeMostrar({ guiaVista: "2026-11-13T10:00:00.000Z" }, "#/hoy"), false);
  /* un enlace directo a otra pantalla no se interrumpe */
  assert.equal(G.debeMostrar({}, "#/sesion/bio3-arn"), false);
  assert.equal(G.debeMostrar({}, "#/mesa"), false);
  assert.equal(G.debeMostrar({}, "#/guia"), false);
});

test("ruta de la guía y páginas dentro de rango", () => {
  assert.equal(G.esGuia("#/guia"), true);
  assert.equal(G.esGuia("#/guia/3"), true);
  assert.equal(G.esGuia("#/guiax"), false);
  assert.equal(G.esGuia("#/hoy"), false);
  assert.equal(G.limitar(-2, 8), 0);
  assert.equal(G.limitar(99, 8), 7);
  assert.equal(G.limitar("3", 8), 3);
  assert.equal(G.limitar(NaN, 8), 0);
});

test("marcar la guía como vista no toca las demás preferencias", () => {
  const antes = { tema: "papel", hora: "24", bienvenida: true };
  const o = G.conVista(antes, "2026-11-13T10:00:00.000Z");
  assert.deepEqual(o, { tema: "papel", hora: "24", bienvenida: true, guiaVista: "2026-11-13T10:00:00.000Z" });
  assert.deepEqual(antes, { tema: "papel", hora: "24", bienvenida: true });
  assert.deepEqual(G.conVista(null, "x"), { guiaVista: "x" });
  assert.deepEqual(G.conVista([1], "x"), { guiaVista: "x" });
});

test("entre 6 y 8 páginas, con título, y sin gamificación", () => {
  assert.ok(G.PASOS.length >= 6 && G.PASOS.length <= 8);
  const ctx = { sesionHoy: () => "#/sesion/x" };
  const texto = G.PASOS.map((p) => p.t + p.c({}, ctx) + p.c({ tachada: true, destapada: true, girada: true }, ctx)).join(" ");
  G.PASOS.forEach((p) => assert.ok(p.t && p.id && p.s && p.peg));
  assert.doesNotMatch(texto, /puntos|monedas|ranking|racha|nivel|logro|enhorabuena|felicidades|confeti|!!/i);
  /* la última lleva a la sesión de hoy, y si no la hay, a Hoy */
  const ult = G.PASOS[G.PASOS.length - 1];
  assert.match(ult.c({}, ctx), /href="#\/sesion\/x"/);
  assert.match(ult.c({}, { sesionHoy: () => null }), /href="#\/hoy"/);
});

test("la guía está cargada en la app y guardada para usarla sin conexión", () => {
  const html = leer("app/index.html");
  assert.ok(html.indexOf('src="bienvenida.js"') > 0 && html.indexOf('src="bienvenida.js"') < html.indexOf('src="app.js"'));
  assert.match(html, /href="bienvenida\.css"/);
  const sw = leer("sw.js");
  assert.match(sw, /"app\/bienvenida\.js"/);
  assert.match(sw, /"app\/bienvenida\.css"/);
  /* solo se guarda con leer/guardar de app.js: nada de localStorage directo */
  assert.doesNotMatch(leer("app/bienvenida.js"), /localStorage/);
});
