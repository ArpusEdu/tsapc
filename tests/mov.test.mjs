import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const M = req("../app/mov.js");
const L = req("../app/logica.js");

/* entorno falso: <html data-examen>, matchMedia y navigator.vibrate */
function entorno({ examen = false, reducido = false } = {}) {
  const attrs = { "data-examen": examen ? "1" : null };
  const vib = [];
  const w = {
    document: { documentElement: { getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v; } } },
    matchMedia: () => ({ matches: reducido }),
    navigator: { vibrate: (ms) => { vib.push(ms); return true; } },
  };
  return { w, vib, attrs };
}
/* elemento falso con WAAPI mínima */
function elemento() {
  const hechas = [];
  return {
    hechas,
    animate(kf, op) {
      const a = { kf, op, estado: "corriendo", finish() { this.estado = "fin"; this.onfinish && this.onfinish(); }, cancel() { this.estado = "cancelada"; this.oncancel && this.oncancel(); } };
      hechas.push(a); return a;
    },
  };
}

test("mov(): modo completo ejecuta la animación entera", () => {
  const { w } = entorno();
  const m = M.crear(w);
  assert.equal(m.modo(), "completo");
  assert.equal(m.mov(() => "completo", { reducido: () => "reducido", examen: () => "examen" }), "completo");
  const el = elemento();
  m.animar(el, [{ transform: "scale(1.02)", filter: "blur(8px)" }, { transform: "none", filter: "none" }], { duration: 360 });
  assert.equal(el.hechas.length, 1);
  assert.equal(el.hechas[0].op.duration, 360);
});

test("mov(): modo reducido convierte todo en un fundido de 150 ms", () => {
  const { w, vib } = entorno({ reducido: true });
  const m = M.crear(w);
  assert.equal(m.modo(), "reducido");
  assert.equal(m.mov(() => "completo", { reducido: () => "reducido" }), "reducido");
  assert.equal(m.mov(() => "completo"), undefined);
  const el = elemento();
  m.animar(el, [{ transform: "translateX(-3px)" }, { transform: "none" }], { duration: 300 });
  assert.equal(el.hechas.length, 1);
  assert.deepEqual(el.hechas[0].kf, [{ opacity: 0 }, { opacity: 1 }]);
  assert.equal(el.hechas[0].op.duration, 150);
  assert.equal(el.hechas[0].op.easing, "linear");
  m.sentir(10);
  assert.deepEqual(vib, [], "sin vibración con movimiento reducido");
});

test("mov(): modo examen no anima, no vibra y deja el estado final", () => {
  const { w, vib } = entorno({ examen: true, reducido: true });
  const m = M.crear(w);
  assert.equal(m.modo(), "examen", "examen manda sobre reducido");
  assert.equal(m.mov(() => "completo", { reducido: () => "reducido", examen: () => "final" }), "final");
  const el = elemento();
  assert.equal(m.animar(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 }), undefined);
  assert.equal(el.hechas.length, 0);
  m.sentir(10);
  assert.deepEqual(vib, []);
});

test("mov(): el modo se lee en cada llamada (entrar y salir del examen)", () => {
  const { w, attrs, vib } = entorno();
  const m = M.crear(w);
  attrs["data-examen"] = "1"; assert.equal(m.modo(), "examen");
  attrs["data-examen"] = null; assert.equal(m.modo(), "completo");
  m.sentir(10); assert.deepEqual(vib, [10]);
});

test("mov(): una animación con la misma clave corta la anterior (se completa, no se queda a medias)", () => {
  const m = M.crear(entorno().w);
  const el = elemento();
  const a = m.anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }, "op");
  assert.equal(m.enCurso(), 1);
  const b = m.anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }, "op");
  assert.equal(a.estado, "fin");
  assert.equal(b.estado, "corriendo");
  m.cortarTodo();
  assert.equal(b.estado, "fin");
  assert.equal(m.enCurso(), 0);
});

test("mov(): solo transform, opacity, filter y clip-path", () => {
  const m = M.crear(entorno().w);
  assert.throws(() => m.anim(elemento(), [{ width: "0px" }, { width: "10px" }], { duration: 100 }), /no permitida/);
  assert.throws(() => m.anim(elemento(), [{ backgroundColor: "red" }], { duration: 100 }), /no permitida/);
  assert.ok(m.anim(elemento(), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0)" }], { duration: 100 }));
});

test("colección: se estampa al 100 %, nunca se borra y no se duplica", () => {
  let r = L.estampar({}, ["bio2"], "2026-11-09");
  assert.deepEqual(r.nuevas, ["bio2"]);
  assert.deepEqual(r.col.bio2, { desde: "2026-11-09", ultimo: "2026-11-09", vista: false });
  r = L.estampar(r.col, ["bio2", "lab1"], "2026-11-20");
  assert.deepEqual(r.nuevas, ["lab1"]);
  assert.equal(r.col.bio2.desde, "2026-11-09", "la primera fecha se conserva");
  r = L.estampar(r.col, [], "2026-12-30");
  assert.deepEqual(Object.keys(r.col).sort(), ["bio2", "lab1"], "aunque deje de estar al 100 %, no se borra");
  assert.deepEqual(L.marcarVistas(r.col).bio2.vista, true);
});

test("colección: se decolora con los días sin repasar y vuelve al repasar", () => {
  const e = { desde: "2026-11-01", ultimo: "2026-11-01", vista: true };
  assert.equal(L.palidez(e, "2026-11-05"), 0);
  assert.equal(L.palidez(e, "2026-11-08"), 1);
  assert.equal(L.palidez(e, "2026-11-15"), 2);
  assert.equal(L.palidez(e, "2027-02-01"), 3);
  const c = L.refrescar({ bio2: e }, "bio2", "2027-02-01");
  assert.equal(L.palidez(c.bio2, "2027-02-01"), 0);
  assert.deepEqual(L.refrescar({}, "bio2", "2027-02-01"), {}, "repasar no añade a la colección");
});

test("colección: datos raros no rompen nada", () => {
  assert.deepEqual(L.coleccionLimpia(null), {});
  assert.deepEqual(L.coleccionLimpia([1, 2]), {});
  assert.deepEqual(L.coleccionLimpia({ x: "no", y: { desde: "ayer" } }), {});
  assert.equal(L.coleccionLimpia({ z: { desde: "2026-01-02" } }).z.ultimo, "2026-01-02");
});
