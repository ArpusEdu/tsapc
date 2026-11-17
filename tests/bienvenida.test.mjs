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

test("el recorrido: entre 8 y 10 pasos sobre pantallas de verdad, con texto y sin gamificación", () => {
  assert.ok(G.PASOS.length >= 8 && G.PASOS.length <= 10);
  const ctx = { sesionHoy: () => "#/sesion/x", unidadHoy: () => "bio3" };
  const textos = [];
  G.PASOS.forEach((p) => {
    assert.ok(p.id && p.zona && p.t && Array.isArray(p.el) && p.el.length, p.id);
    const r = p.ruta(ctx, "#/hoy");
    assert.match(r, /^#\//, p.id);
    for (let i = 0; i < p.el.length; i++) textos.push(p.c(i));
    if (p.fase) textos.push(p.fase.t, p.fase.c(0));
    textos.push(p.t);
  });
  const texto = textos.join(" ") + G.CIERRE.t + G.CIERRE.c("#/sesion/x") + G.CIERRE.c(null);
  assert.doesNotMatch(texto, /puntos|monedas|ranking|racha|nivel|logro|enhorabuena|felicidades|confeti|!/i);
  /* recorre Hoy (01, 02, 03), una unidad, una sesión, la agenda, errores, Mi mesa y el centro */
  const rutas = G.PASOS.map((p) => p.ruta(ctx, "#/hoy"));
  ["#/hoy", "#/unidad/bio3", "#/sesion/x", "#/agenda", "#/errores", "#/mesa", "#/asignaturas"].forEach((r) => assert.ok(rutas.includes(r), r));
  assert.match(texto, /Ya lo entregué/); assert.match(texto, /Ya lo hice/); assert.match(texto, /Hoy no puedo/);
  assert.match(texto, /Pamplona/); assert.match(texto, /copia/i); assert.match(texto, /Fecha por confirmar/);
  /* la sesión se salta si no hay; dentro de una sesión se queda en ella */
  const ses = G.PASOS.find((p) => p.id === "sesion");
  assert.equal(ses.ruta({ sesionHoy: () => null }, "#/hoy"), null);
  assert.equal(ses.ruta(ctx, "#/sesion/otra"), "#/sesion/otra");
  /* hay pasos de «hazlo tú» y cada uno espera la ruta a la que se llega al hacerlo */
  const haz = G.PASOS.filter((p) => p.haz);
  assert.ok(haz.length >= 2);
  assert.ok(G.PASOS.find((p) => p.id === "sesiones").haz.espera.test("#/sesion/bio3-arn"));
  assert.ok(!G.PASOS.find((p) => p.id === "sesiones").haz.espera.test("#/sesion/repaso"));
  assert.ok(G.PASOS.find((p) => p.id === "agenda").haz.espera.test("#/agenda/calendario"));
  /* el cierre lleva a la sesión de hoy, y si no la hay, a Hoy */
  assert.match(G.CIERRE.botones("#/sesion/x"), /href="#\/sesion\/x"/);
  assert.match(G.CIERRE.botones(null), /href="#\/hoy"/);
});

test("se retoma donde se dejó y, al terminar, se olvida el paso", () => {
  assert.equal(G.pasoGuardado({}, 10), 0);
  assert.equal(G.pasoGuardado({ guiaPaso: 4 }, 10), 4);
  assert.equal(G.pasoGuardado({ guiaPaso: 40 }, 10), 9);
  assert.equal(G.pasoGuardado({ guiaPaso: "4" }, 10), 0);
  assert.equal(G.pasoGuardado({ guiaPaso: 4, guiaVista: "x" }, 10), 0);   /* ya terminada: vuelve a empezar */
  assert.deepEqual(G.conPaso({ tema: "noche" }, 3), { tema: "noche", guiaPaso: 3 });
  assert.deepEqual(G.conVista({ tema: "noche", guiaPaso: 3 }, "f"), { tema: "noche", guiaVista: "f" });
});

test("el hueco nunca queda debajo de la tarjeta", () => {
  const v = { w: 360, h: 640 }, cw = 336, ch = 260;
  for (const r of [{ left: 16, top: 90, width: 328, height: 120 }, { left: 16, top: 420, width: 328, height: 140 }, { left: 0, top: 10, width: 360, height: 900 }, { left: 200, top: 300, width: 80, height: 40 }]) {
    const s = G.situar(r, v, ch, cw), h = s.hueco, t = s.tarjeta;
    const solapa = !(t.y >= h.y + h.h || t.y + ch <= h.y);
    assert.ok(!solapa, JSON.stringify(r) + " → " + JSON.stringify(s));
    assert.ok(t.x >= 0 && t.x + cw <= v.w, "la tarjeta cabe a lo ancho");
    assert.ok(s.flecha >= 24 && s.flecha <= cw - 24);
  }
  /* tras desplazar, un objetivo bajo queda arriba con sitio para la tarjeta debajo */
  const r = { left: 16, top: 1500, width: 328, height: 120 }, dy = G.desplazamiento(r, 640, 260);
  const s = G.situar({ ...r, top: r.top - dy }, v, 260, cw);
  assert.equal(s.tarjeta.pos, "abajo");
});

test("abrir la sesión de ejemplo no deja datos falsos", () => {
  const antes = { a: { paso: 2 } };
  assert.deepEqual(G.limpiarSesiones(antes, { a: { paso: 2 }, b: { paso: 0, inicio: "2026-11-15" } }), { a: { paso: 2 } });
  assert.equal(G.limpiarSesiones(antes, { a: { paso: 2 }, b: { paso: 0, apuesta: "creo que…" } }), null);   /* lo escrito de verdad se queda */
  assert.equal(G.limpiarSesiones(antes, { a: { paso: 0 } }), null);                                       /* lo que ya estaba no se toca */
  assert.equal(G.limpiarSesiones(antes, null), null);
});

test("el anillo de progreso: un tramo por paso, dentro de la rejilla del símbolo", () => {
  const a = G.arcos(10);
  assert.equal(a.length, 10);
  a.forEach((d) => assert.match(d, /^M[\d.]+ [\d.]+A19\.5 19\.5 0 0 1 [\d.]+ [\d.]+$/));
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
