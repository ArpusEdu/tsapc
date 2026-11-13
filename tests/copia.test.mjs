import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, existsSync } from "node:fs";
const C = createRequire(import.meta.url)("../assets/copia.js");

class Store {
  constructor(init = {}) { this.m = new Map(Object.entries(init)); this.fail = null; }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { if (this.fail && this.fail(k)) throw new Error("quota"); this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
  snap() { return Object.fromEntries(this.m); }
}
const sembrar = () => new Store({
  "lab2-repaso-v1": JSON.stringify({ done: { a: 1, b: 1 }, f: "0" }),
  "lab2-simulacro-v1": JSON.stringify({ ans: { 1: 2 } }),
  "plan-estudio-v1-bio1": JSON.stringify({ n: 3, done: { x: 1 } }),
  "pos:/tsapc/bio1/repaso/": "1234",
  "tsapc:v2": "{\"schema\":2}",
});
const ex = s => JSON.stringify(C.construirCopia(s, "https://x.github.io"));

test("exportar e importar es idempotente", () => {
  const a = sembrar(), t = ex(a), antes = a.snap();
  const r = C.analizar(t); assert.ok(r.ok);
  const b = new Store(); assert.ok(C.importar(b, r.claves).ok);
  const sb = b.snap(); delete sb[C.BACKUP_KEY];
  assert.deepEqual(sb, antes);
  assert.ok(C.importar(b, r.claves).ok);   // repetir no cambia nada
  const sb2 = b.snap(); delete sb2[C.BACKUP_KEY];
  assert.deepEqual(sb2, antes);
  const j = JSON.parse(t);
  assert.equal(j.app, "tsapc"); assert.equal(j.formato, 1); assert.equal(j.origen, "https://x.github.io");
  assert.ok(!isNaN(Date.parse(j.exportado)));
  assert.match(C.nombreArchivo(new Date("2026-11-03T10:00:00Z")), /^tsapc-copia-2026-11-03\.json$/);
});

test("exporta todas las claves, también las que la lista antigua olvidaba", () => {
  const j = JSON.parse(ex(sembrar()));
  for (const k of ["plan-estudio-v1-bio1", "pos:/tsapc/bio1/repaso/", "tsapc:v2"]) assert.ok(k in j.claves);
});

test("se importa una copia del formato antiguo", () => {
  const vieja = JSON.stringify({ app: "tsapc", saved: "2026-10-30T10:00:00Z", data: { "bio1-repaso-v1": "{\"done\":{\"q\":1}}", "lab2-repaso-v1": "{}" } });
  const r = C.analizar(vieja); assert.ok(r.ok); assert.equal(r.formato, 0);
  const s = new Store(); assert.ok(C.importar(s, r.claves).ok);
  assert.equal(s.getItem("bio1-repaso-v1"), "{\"done\":{\"q\":1}}");
});

test("se rechaza JSON malo y claves peligrosas", () => {
  const malos = ["", "no json", "[]", "null", "{\"app\":\"otra\",\"formato\":1,\"claves\":{\"a\":\"b\"}}",
    "{\"app\":\"tsapc\",\"formato\":1,\"claves\":{\"a\":5}}",
    "{\"app\":\"tsapc\",\"formato\":1,\"claves\":{\"__proto__\":\"x\"}}",
    "{\"app\":\"tsapc\",\"formato\":1,\"claves\":{\"constructor\":\"x\"}}",
    "{\"app\":\"tsapc\",\"formato\":1,\"claves\":{\"a\\u0000b\":\"x\"}}",
    "{\"app\":\"tsapc\",\"formato\":1,\"claves\":{\"\":\"x\"}}",
    "{\"app\":\"tsapc\",\"formato\":9,\"claves\":{\"a\":\"x\"}}",
    "{\"app\":\"tsapc\",\"data\":{\"__proto__\":\"x\"}}",
    "{\"app\":\"tsapc\",\"formato\":1,\"claves\":{}}"];
  for (const m of malos) assert.equal(C.analizar(m).ok, false, m);
  assert.equal(({}).polluted, undefined);
  const grande = JSON.stringify({ app: "tsapc", formato: 1, claves: { k: "x".repeat(5 * 1024 * 1024) } });
  assert.equal(C.analizar(grande).ok, false);
});

test("no se borran claves ajenas a la copia", () => {
  const s = new Store({ ajena: "1", "lab2-repaso-v1": "viejo" });
  const r = C.analizar(JSON.stringify({ app: "tsapc", formato: 1, claves: { "lab2-repaso-v1": "nuevo", "bio1-repaso-v1": "z" } }));
  assert.deepEqual(C.resumen(s, r.claves), { total: 2, existentes: 1 });
  C.importar(s, r.claves);
  assert.equal(s.getItem("ajena"), "1"); assert.equal(s.getItem("lab2-repaso-v1"), "nuevo");
});

test("se crea el backup previo con el estado anterior", () => {
  const s = sembrar(), antes = s.snap();
  const r = C.analizar(JSON.stringify({ app: "tsapc", formato: 1, claves: { "lab2-repaso-v1": "{}" } }));
  C.importar(s, r.claves);
  const b = JSON.parse(s.getItem(C.BACKUP_KEY));
  assert.deepEqual(b.claves, antes);
  assert.ok(!(C.BACKUP_KEY in JSON.parse(ex(s)).claves));   // no se exporta a sí mismo
});

test("si falla la escritura, se deshace todo", () => {
  const s = sembrar(), antes = s.snap();
  s.fail = k => k === "tsapc:zzz";
  const r = C.analizar(JSON.stringify({ app: "tsapc", formato: 1, claves: { "lab2-repaso-v1": "{}", "tsapc:zzz": "1" } }));
  assert.equal(C.importar(s, r.claves).ok, false);
  assert.deepEqual(s.snap(), antes);
});

test("sale de verdad un archivo de más de 1 MB y vuelve entero", () => {
  const s = sembrar();
  for (let i = 0; i < 12; i++) s.setItem("tsapc:grande:" + i, "á".repeat(60000) + i);
  const t = ex(s);
  assert.ok(Buffer.byteLength(t) > 1024 * 1024, "tamaño " + Buffer.byteLength(t));
  assert.ok(Buffer.byteLength(t) < C.MAX_BYTES);
  const r = C.analizar(t); assert.ok(r.ok); assert.equal(r.claves.size, 17);
  const d = new Store(); C.importar(d, r.claves);
  assert.equal(d.getItem("tsapc:grande:7"), s.getItem("tsapc:grande:7"));
});

test("no exporta ni importa claves de otros proyectos del mismo origen", () => {
  const s = sembrar();
  s.setItem("sb-abc-auth-token", "{\"access_token\":\"secreto\"}");
  s.setItem("otro-proyecto:ajustes", "x");
  const j = JSON.parse(ex(s));
  assert.ok(!("sb-abc-auth-token" in j.claves)); assert.ok(!("otro-proyecto:ajustes" in j.claves));
  assert.ok("lab2-repaso-v1" in j.claves);
  const r = C.analizar(JSON.stringify({ app: "tsapc", formato: 1, claves: { "lab2-repaso-v1": "{}", "sb-abc-auth-token": "robada", "otro-proyecto:ajustes": "<img src=x onerror=alert(1)>" } }));
  assert.ok(r.ok); assert.deepEqual([...r.claves.keys()], ["lab2-repaso-v1"]); assert.equal(r.ignoradas, 2);
  C.importar(s, r.claves);
  assert.equal(s.getItem("sb-abc-auth-token"), "{\"access_token\":\"secreto\"}");
  assert.equal(s.getItem("otro-proyecto:ajustes"), "x");
  assert.ok(!JSON.parse(s.getItem(C.BACKUP_KEY)).claves["sb-abc-auth-token"]);   // tampoco va al backup
  for (const k of ["bio1-repaso-v1", "fisio2-simulacro-v2", "eng-u12-exam-v2", "lab-u1-test50-b", "lab-words-learn-v1", "ipe3-simulacro-v1", "plan-estudio-v1-ipe3", "pos:/tsapc/lab1/banco/", "tsapc:v2"])
    assert.ok(C.permitida(k), k);
});

/* Una copia puede venir de otra persona: los valores restaurados no deben acabar como HTML en los repasos. */
const repasos = readdirSync(new URL("..", import.meta.url)).map(d => new URL("../" + d + "/repaso/index.html", import.meta.url)).filter(u => existsSync(u));
test("repasos: el tiempo guardado del temporizador se trata como número (no HTML)", () => {
  assert.ok(repasos.length >= 10);
  for (const u of repasos) {
    const h = readFileSync(u, "utf8"); if (!h.includes("Lo hiciste en ${sp} min")) continue;
    assert.ok(h.includes("sp=+T.s[b.id]||0"), u.pathname);
  }
});
test("repasos: las horas guardadas del plan se validan antes de pintarlas", () => {
  for (const u of repasos) {
    const h = readFileSync(u, "utf8"); if (!h.includes("function times(i)")) continue;
    const m = h.match(/function times\(i\)\{.*?\}(?=\n)/); assert.ok(m, u.pathname);
    const ps = { times: {} }, hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const k = hoy.toISOString().slice(0, 10);
    const times = new Function("ps", "dayDate", "defTimes", m[0] + ";return times")(ps, () => hoy, () => ["8:00", "13:25"]);
    ps.times[k] = ["\"><img src=x onerror=alert(1)>", "9:00"]; assert.deepEqual(times(0), ["8:00", "13:25"], u.pathname);
    ps.times[k] = "<b>"; assert.deepEqual(times(0), ["8:00", "13:25"]);
    ps.times[k] = ["09:30", "12:00"]; assert.deepEqual(times(0), ["09:30", "12:00"]);
  }
});

test("la copia guarda todas las claves que usan las páginas", () => {
  const raiz = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const claves = new Set(["mc-done", "mc-plant", "bio3-entender-v1:dias"]);
  const recorrer = d => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if ([".git", "node_modules", "tests", "scripts", "docs", "files"].includes(e.name)) continue;
      const p = d + "/" + e.name;
      if (e.isDirectory()) recorrer(p);
      else if (/\.(html|js)$/.test(e.name)) {
        const t = readFileSync(p, "utf8");
        for (const m of t.matchAll(/\bKEY\s*=\s*["']([a-z0-9:_-]+)["']/g)) claves.add(m[1]);
      }
    }
  };
  recorrer(decodeURIComponent(raiz));
  const fuera = [...claves].filter(k => !C.RUIDO.has(k) && !C.permitida(k));
  assert.ok(claves.size > 20, "se encontraron pocas claves: " + claves.size);
  assert.deepEqual(fuera, [], "claves que la copia no guardaría");
});
