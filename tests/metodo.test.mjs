/* Revisión del método (2026-11): el examen pone tope al repaso espaciado, la cuenta atrás no agobia y la planta cambia de forma sin niveles. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const S2 = req("../app/sm2.js"), L = req("../app/logica.js");

test("con un examen cerca, nada de su unidad vence después de la víspera", () => {
  const e = S2.puntuar(S2.puntuar(null, "facil", "2026-11-10"), "facil", "2026-11-13");
  assert.ok(e.due > "2026-11-17");
  const l = S2.limitar(e, "2026-11-17", "2026-11-13");
  assert.equal(l.due, "2026-11-17"); assert.notEqual(l, e, "no muta el de entrada"); assert.ok(e.due > "2026-11-17");
  assert.equal(S2.limitar(e, null, "2026-11-13"), e, "sin examen, igual");
  assert.equal(S2.limitar({ due: "2026-11-15" }, "2026-11-17", "2026-11-13").due, "2026-11-15", "lo que ya vence antes no se toca");
  assert.equal(S2.limitar(e, "2026-11-13", "2026-11-13"), e, "si la víspera es hoy, no se adelanta a hoy");
});

test("cuenta atrás del examen: días hasta las últimas 24 h; después, horas y minutos", () => {
  assert.deepEqual(L.faltan(9 * 864e5 + 3600e3, 9), { partes: [["9", "días"]], texto: "Faltan 9 días" });
  assert.equal(L.faltan(864e5 + 1, 1).texto, "Faltan 1 día");
  assert.deepEqual(L.faltan(5 * 3600e3 + 7 * 60e3, 1).partes, [["05", "h"], ["07", "min"]]);
  assert.equal(L.faltan(0, 0).texto, "Es ahora");
});

test("la planta: hojas hasta 13 días, luego un botón y después una flor; sin niveles", () => {
  assert.equal(L.formaPlanta(0), "hojas"); assert.equal(L.formaPlanta(13), "hojas");
  assert.equal(L.formaPlanta(14), "boton"); assert.equal(L.formaPlanta(26), "boton"); assert.equal(L.formaPlanta(27), "flor");
});
