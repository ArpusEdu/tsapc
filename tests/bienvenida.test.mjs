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

test("la llegada sale una sola vez, antes de la guía, y no a quien ya conoce la app", () => {
  assert.equal(G.debeLlegar({}, "#/hoy", false), true);
  assert.equal(G.debeLlegar(null, "", false), true);
  assert.equal(G.debeLlegar({}, "#/hoy", true), false);                 /* ya hay progreso guardado */
  assert.equal(G.debeLlegar({ llegadaVista: "2026-11-15" }, "#/hoy", false), false);
  assert.equal(G.debeLlegar({ guiaVista: "2026-11-13" }, "#/hoy", false), false);   /* quien ya vio la guía no la ve a la fuerza */
  assert.equal(G.debeLlegar({ bienvenida: true }, "", false), false);
  assert.equal(G.debeLlegar({}, "#/sesion/bio3-arn", false), false);    /* un enlace directo no se interrumpe */
  assert.equal(G.esLlegada("#/llegada"), true);
  assert.equal(G.esLlegada("#/hoy"), false);
  const antes = { tema: "noche", guiaVista: "x" };
  assert.deepEqual(G.conLlegada(antes, "f"), { tema: "noche", guiaVista: "x", llegadaVista: "f" });
  assert.deepEqual(antes, { tema: "noche", guiaVista: "x" });
});

test("la llegada responde qué es, dónde estás y qué haces, con el lema y sin gamificación", () => {
  const L = G.LLEGADA;
  assert.match(L.titulo, /Enfoca lo que <em>toca<\/em>\./);
  assert.equal(L.pasos.length, 3);
  assert.match(L.que(15), /15 unidades/);
  const texto = [L.donde, L.titulo, L.que(15), L.pie].concat(L.pasos.flat()).join(" ");
  assert.doesNotMatch(texto, /puntos|monedas|ranking|racha|nivel|logro|enhorabuena|confeti|!/i);
  assert.match(leer("sw.js"), /"app\/marca\.js"/);
  assert.ok(leer("app/index.html").indexOf('src="marca.js"') < leer("app/index.html").indexOf('src="bienvenida.js"'));
});
