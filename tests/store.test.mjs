import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const S = req("../assets/store.js");
const C = req("../assets/copia.js");

class Store {
  constructor(init = {}) { this.m = new Map(Object.entries(init)); this.fail = null; this.escrituras = []; }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { if (this.fail && this.fail(k)) throw new Error("quota"); this.escrituras.push(k); this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
  snap() { return Object.fromEntries(this.m); }
}
const T0 = new Date("2026-11-03T10:00:00.000Z");
const nuevo = (st, t = T0) => S.crear({ storage: st, ahora: t });

/* Formatos reales, copiados de lo que escriben las páginas. */
const REPASO = { done: { 1: 1, 7: 1, 12: 1 }, f: "0", mode: "test", open: { b2: 1, b5: 1 } };
const SIMU = { a: { A0: 2, A1: 0 }, self: { C0: "texto" }, done: { A0: 1 }, open: {} };
const PLAN = { n: 3, start: "hoy", times: { 0: ["8:00", "13:25"] }, done: { x: 1 } };
const J = JSON.stringify;
const carpetas = ["bio1", "bio2", "bio3", "fisio1", "fisio2", "fisio3", "gest1", "gest2", "ingles1", "ipe2", "ipe-tema5", "lab1", "lab2"];
const claveRepaso = { "ingles1": "ing1-repaso-v1", "ipe-tema5": "ipe5-repaso-v1", fisio2: "fisio2-repaso-v3" };
const claveSimu = { "ipe-tema5": "ipe3-simulacro-v1", fisio2: "fisio2-simulacro-v2" };
const clavePlan = { "ingles1": "plan-estudio-v1-ing1", "ipe-tema5": "plan-estudio-v1-ipe5" };
function datosReales() {
  const d = {};
  for (const c of carpetas) {
    d[claveRepaso[c] ?? `${c}-repaso-v1`] = J(REPASO);
    if (c !== "lab1" && c !== "ingles1") d[claveSimu[c] ?? `${c}-simulacro-v1`] = J(SIMU);
    d[clavePlan[c] ?? `plan-estudio-v1-${c}`] = J(PLAN);
    d[`pos:/tsapc/${c}/repaso/`] = "1234";
  }
  d["pos:/tsapc/ipe-tema5/simulacro/"] = "880";
  d["eng-u12-exam-v2"] = J({ "q1": "b", stName: "Ana", stDate: "2026-10-01" });
  d["eng-u12-simulacro-v1"] = J({ q1: "a", stName: "", stDate: "" });
  d["eng-lab-vocab-v2"] = J({ v1: "x" });
  d["eng-lab-vocab-full-v1"] = J({ v1: "y" });
  d["lab-words-learn-v1"] = J({ box: { casa: 2, perro: 3 } });
  d["lab-u1-test50"] = J({ ans: { 1: 2 }, done: false });
  d["lab-u1-test50-b"] = J({ ans: { 3: 0 } });
  d["lab-u1-test153"] = J({ ans: { 9: 1 } });
  return d;
}

test("migración completa con las 13 unidades", () => {
  const st = new Store(datosReales());
  const v = nuevo(st).migrar();
  assert.equal(v.schema, 1);
  assert.equal(v.creado, T0.toISOString());
  assert.deepEqual(Object.keys(v.unidades).sort(), [...carpetas].sort());
  for (const c of carpetas) {
    assert.deepEqual(v.unidades[c].repaso, { dominados: [1, 7, 12], modo: "test", abiertos: ["b2", "b5"], filtro: "0" }, c);
    assert.deepEqual(v.unidades[c].plan, PLAN, c);
    assert.equal(v.unidades[c].pos.repaso, "1234", c);
    if (c !== "lab1" && c !== "ingles1") assert.deepEqual(v.unidades[c].simulacro, SIMU, c);
  }
  assert.equal(v.unidades["ipe-tema5"].pos.simulacro, "880");
  assert.equal(v.unidades.lab1.simulacro, undefined);
  assert.deepEqual(v.ingles.examen, { q1: "b", stName: "Ana", stDate: "2026-10-01" });
  assert.deepEqual(Object.keys(v.ingles).sort(), ["examen", "examenVocabulario", "simulacro", "simulacroVocabulario", "vocabulario"]);
  assert.deepEqual(v.ingles.vocabulario, { box: { casa: 2, perro: 3 } });
  assert.deepEqual(v.lab1Tests, { test50: { ans: { 1: 2 }, done: false }, test50b: { ans: { 3: 0 } }, banco: { ans: { 9: 1 } } });
  assert.deepEqual(v.personal, { nombre: null, entregadas: {}, profes: {} });
  assert.equal(v.meta.version, 1);
  assert.equal(v.meta.sinInterpretar, undefined);
  assert.deepEqual(v.meta.migradoDe, Object.keys(datosReales()).sort());
  assert.deepEqual(JSON.parse(st.getItem("tsapc:v2")), v);
});

test("idempotente: migrar otra vez no cambia ni escribe nada", () => {
  const st = new Store(datosReales());
  const s = nuevo(st);
  s.migrar();
  const antes = st.snap(); st.escrituras.length = 0;
  const v2 = nuevo(st, new Date("2027-01-01T00:00:00Z")).migrar();
  assert.deepEqual(st.snap(), antes);
  assert.deepEqual(st.escrituras, []);
  assert.equal(v2.actualizado, T0.toISOString());
  assert.deepEqual(nuevo(st).cargar(), JSON.parse(antes["tsapc:v2"]));
});

test("migrar de nuevo añade datos antiguos nuevos sin pisar lo ya migrado ni lo escrito con set()", () => {
  const st = new Store({ "bio1-repaso-v1": J(REPASO) });
  const s = nuevo(st); s.migrar();
  assert.ok(s.set("unidades.bio1.repaso.modo", "read"));
  st.setItem("bio1-repaso-v1", J({ done: { 99: 1 } }));      // la página sigue escribiendo la clave vieja
  st.setItem("bio2-repaso-v1", J(REPASO));
  const v = s.migrar();
  assert.equal(v.unidades.bio1.repaso.modo, "read");
  assert.deepEqual(v.unidades.bio1.repaso.dominados, [1, 7, 12]);
  assert.deepEqual(v.unidades.bio2.repaso.dominados, [1, 7, 12]);
  assert.deepEqual(v.meta.migradoDe, ["bio1-repaso-v1", "bio2-repaso-v1"]);
});

test("no borra ni toca las claves antiguas (byte a byte)", () => {
  const datos = datosReales();
  datos["bio1-simulacro-v1"] = "{roto";                         // incluso las corruptas se respetan
  datos["clave-ajena"] = "no es de tsapc";
  const st = new Store(datos);
  const antes = st.snap();
  const s = nuevo(st);
  s.migrar(); s.migrar(); s.cargar(); s.set("personal.nombre", "Ana"); s.exportar();
  const despues = st.snap();
  for (const [k, v] of Object.entries(antes)) assert.equal(despues[k], v, k);
  assert.deepEqual(Object.keys(despues).filter(k => !(k in antes)).sort(), ["tsapc:backup-v1", "tsapc:v2"]);
  assert.ok(!st.escrituras.some(k => k in antes), "no se ha vuelto a escribir ninguna clave antigua");
});

test("crea el backup una sola vez, en crudo, antes que tsapc:v2", () => {
  const datos = datosReales();
  const st = new Store(datos);
  const s = nuevo(st);
  s.migrar();
  assert.ok(st.escrituras.indexOf("tsapc:backup-v1") < st.escrituras.indexOf("tsapc:v2"));
  const b = JSON.parse(st.getItem("tsapc:backup-v1"));
  assert.deepEqual(b.claves, datos);
  const bruto = st.getItem("tsapc:backup-v1");
  st.setItem("bio1-repaso-v1", J({ done: { 5: 1 } }));
  st.removeItem("tsapc:v2");
  nuevo(st, new Date("2027-02-02T00:00:00Z")).migrar();
  assert.equal(st.getItem("tsapc:backup-v1"), bruto);
  assert.equal(st.escrituras.filter(k => k === "tsapc:backup-v1").length, 1);
});

test("si no se puede guardar el backup, no se escribe tsapc:v2", () => {
  const st = new Store(datosReales()); st.fail = k => k === "tsapc:backup-v1";
  const v = nuevo(st).migrar();
  assert.equal(st.getItem("tsapc:v2"), null);
  assert.equal(v.schema, 1);
});

test("un valor corrupto o raro va a meta.sinInterpretar en crudo y no falla", () => {
  const st = new Store({
    "bio1-repaso-v1": "{esto no es json", "bio2-repaso-v1": J([1, 2]), "bio3-repaso-v1": J({ sin: "done" }),
    "bio1-simulacro-v1": "null", "lab-u1-test50": "{{", "lab-nueva-cosa-v9": J({ x: 1 }),
    "pos:/tsapc/repaso/": "10", "ipe2-repaso-v1": J(REPASO),
  });
  const v = nuevo(st).migrar();
  assert.deepEqual(Object.keys(v.meta.sinInterpretar).sort(),
    ["bio1-repaso-v1", "bio1-simulacro-v1", "bio2-repaso-v1", "bio3-repaso-v1", "lab-nueva-cosa-v9", "lab-u1-test50", "pos:/tsapc/repaso/"]);
  assert.equal(v.meta.sinInterpretar["bio1-repaso-v1"], "{esto no es json");
  assert.equal(v.meta.sinInterpretar["bio2-repaso-v1"], "[1,2]");
  assert.deepEqual(v.unidades.ipe2.repaso.dominados, [1, 7, 12]);
  assert.deepEqual(v.meta.migradoDe, ["ipe2-repaso-v1"]);
});

test("dos versiones de la misma clave: gana la más nueva y la otra se conserva", () => {
  const st = new Store({ "fisio2-repaso-v1": J({ done: { 1: 1 } }), "fisio2-repaso-v3": J({ done: { 2: 1 } }) });
  const v = nuevo(st).migrar();
  assert.deepEqual(v.unidades.fisio2.repaso.dominados, [2]);
  assert.equal(v.meta.sinInterpretar["fisio2-repaso-v1"], J({ done: { 1: 1 } }));
});

test("usuario nuevo: sin datos funciona y no crea backup", () => {
  const st = new Store();
  const s = nuevo(st);
  const v = s.cargar();
  assert.deepEqual(v.unidades, {}); assert.deepEqual(v.ingles, {}); assert.deepEqual(v.lab1Tests, {});
  assert.deepEqual(v.meta.migradoDe, []);
  assert.equal(st.getItem("tsapc:backup-v1"), null);
  assert.ok(st.getItem("tsapc:v2"));
  assert.equal(s.get("personal.nombre"), null);
  assert.equal(s.get("no.existe.nada"), undefined);
});

test("sin localStorage ni fallos de escritura no lanza", () => {
  const s = S.crear({ storage: null, ahora: T0 });
  assert.equal(s.cargar().schema, 1);
  const st = new Store(datosReales()); st.fail = () => true;
  assert.equal(nuevo(st).cargar().schema, 1);
  assert.equal(nuevo(st).set("personal.nombre", "x"), false);
  const roto = { get length() { throw new Error("x"); }, getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } };
  assert.equal(S.crear({ storage: roto }).cargar().schema, 1);
});

test("tsapc:v2 corrupto: se guarda aparte y se reconstruye", () => {
  const st = new Store({ "bio1-repaso-v1": J(REPASO), "tsapc:v2": "{{{" });
  const v = nuevo(st).cargar();
  assert.equal(st.getItem("tsapc:v2-corrupto"), "{{{");
  assert.deepEqual(v.unidades.bio1.repaso.dominados, [1, 7, 12]);
});

test("get, set y actualizado", () => {
  const st = new Store({ "bio1-repaso-v1": J(REPASO) });
  const s = nuevo(st);
  assert.deepEqual(s.get("unidades.bio1.repaso.dominados"), [1, 7, 12]);
  const s2 = nuevo(st, new Date("2026-11-04T08:00:00.000Z"));
  assert.ok(s2.set("personal.entregadas.ipe-entrega-20261103", { en: "x" }));
  assert.ok(s2.set(["personal", "nombre"], "Arpus"));
  const v = JSON.parse(st.getItem("tsapc:v2"));
  assert.equal(v.actualizado, "2026-11-04T08:00:00.000Z");
  assert.equal(v.creado, T0.toISOString());
  assert.equal(v.personal.nombre, "Arpus");
  assert.deepEqual(v.unidades.bio1.repaso.dominados, [1, 7, 12]);   // no pisa el resto
  assert.equal(s2.set("schema", 9), false);
  assert.equal(s2.set("", 1), false);
});

test("sin prototype pollution", () => {
  const st = new Store({
    "bio1-repaso-v1": '{"done":{"__proto__":{"polluted":1},"3":1},"mode":"read"}',
    "bio1-simulacro-v1": '{"a":{"__proto__":{"polluted2":1},"constructor":{"prototype":{"polluted3":1}}}}',
    "pos:/tsapc/bio1/__proto__/": "5",
  });
  const s = nuevo(st);
  const v = s.migrar();
  assert.equal({}.polluted, undefined); assert.equal({}.polluted2, undefined); assert.equal({}.polluted3, undefined);
  assert.deepEqual(v.unidades.bio1.repaso.dominados, [3]);
  for (const r of ["__proto__.x", "a.constructor.prototype.x", "personal.__proto__.p", ["prototype", "x"]]) {
    assert.equal(s.set(r, 1), false, String(r));
    assert.equal(s.get(r), undefined);
  }
  assert.equal({}.p, undefined); assert.equal({}.x, undefined);
  assert.ok(s.set("personal.profes.ana", JSON.parse('{"__proto__":{"q":1},"ok":1}')));
  assert.equal({}.q, undefined);
  assert.deepEqual(s.get("personal.profes.ana"), { ok: 1 });
  assert.equal(S.clasificar("pos:/tsapc/bio1/__proto__/"), null);
});

test("viaje de ida y vuelta con copia.js: exportar, borrar, importar y migrar da el mismo tsapc:v2", () => {
  const origen = new Store(datosReales());
  const s = nuevo(origen);
  const v2 = s.migrar();
  const copia = s.exportar();
  assert.equal(copia.app, "tsapc");
  assert.ok(copia.claves["tsapc:v2"]);
  const texto = JSON.stringify(copia);

  // 1) borrar todo, importar la copia: tsapc:v2 vuelve idéntico (y las antiguas también)
  const dest = new Store();
  const r = C.analizar(texto); assert.ok(r.ok);
  assert.ok(C.importar(dest, r.claves).ok);
  assert.equal(dest.getItem("tsapc:v2"), origen.getItem("tsapc:v2"));
  assert.deepEqual(nuevo(dest).cargar(), v2);
  for (const [k, v] of Object.entries(datosReales())) assert.equal(dest.getItem(k), v, k);

  // 2) importar y quitar tsapc:v2: migrar de las claves antiguas reconstruye lo mismo
  dest.removeItem("tsapc:v2"); dest.removeItem("tsapc:backup-v1");
  assert.deepEqual(nuevo(dest).migrar(), v2);
});

test("exportar funciona sin copia.js (cae a tsapc:v2) y persistir no rompe", async () => {
  const st = new Store({ "bio1-repaso-v1": J(REPASO) });
  const s = nuevo(st);
  assert.ok(s.exportar().claves["tsapc:v2"]);
  assert.equal(await s.persistir(), false);   // en Node no hay navigator.storage
  const ok = S.crear({ storage: st });
  assert.equal(typeof ok.persistir, "function");
});
