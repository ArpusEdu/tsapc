import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const L = req("../app/logica.js");
const D = req("../app/datos.js");
const AG = JSON.parse(readFileSync(new URL("../docs/corte/agenda-2026-27.json", import.meta.url), "utf8"));
const EVS = L.prepararEventos(AG);
const at = (s) => { const [d, t = "00:00"] = s.split("T"); const [y, m, dd] = d.split("-").map(Number); const [h, mi] = t.split(":").map(Number); return new Date(y, m - 1, dd, h, mi); };

test("fechas: clave, parseo y ?hoy=", () => {
  assert.equal(L.clave(new Date(2026, 10, 9)), "2026-11-09");
  assert.equal(L.parseDia("2026-11-09").getDate(), 9);
  assert.equal(L.parseDia("9/11/2026"), null);
  const real = new Date(2026, 10, 9, 18, 30, 12);
  assert.equal(L.ahoraDesde("", real), real);
  const d = L.ahoraDesde("?hoy=2026-11-03", real);
  assert.equal(L.clave(d), "2026-11-03"); assert.equal(d.getHours(), 18); assert.equal(d.getMinutes(), 30);
  const t = L.ahoraDesde("?x=1&hoy=2026-11-03T17:05", real);
  assert.equal(t.getHours(), 17); assert.equal(t.getMinutes(), 5); assert.equal(t.getSeconds(), 0);
  assert.equal(L.diaRelativo(at("2026-11-10"), at("2026-11-09T20:00")), "Mañana");
  assert.equal(L.diaRelativo(at("2026-11-12"), at("2026-11-09T20:00")), "Jueves 12");
});

test("semana de lunes a viernes; en fin de semana, la siguiente", () => {
  assert.deepEqual(L.semana(at("2026-11-11")).map(L.clave), ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]);
  assert.deepEqual(L.semana(at("2026-11-08")).map(L.clave)[0], "2026-11-09");   // domingo
  assert.deepEqual(L.semana(at("2026-11-07")).map(L.clave)[0], "2026-11-09");   // sábado
  assert.deepEqual(L.semana(at("2026-11-13")).map(L.clave)[4], "2026-11-13");   // viernes
});

test("eventos: vencimiento por hora, cierre o primera clase del día", () => {
  const ipe = EVS.find((e) => e.id === "ipe-ejercicios-finales");
  assert.equal(ipe.due.getHours(), 21);
  const fisio = EVS.find((e) => e.id === "fisio-infografia");
  assert.equal(L.clave(fisio.due), "2026-11-04"); assert.equal(fisio.due.getHours(), 0);
  const bio = EVS.find((e) => e.id === "bio-examen-citogenetica");   // miércoles: Bio a las 16:35
  assert.equal(bio.claseHora, "16:35");
  const sp = EVS.find((e) => e.id === "ingles-speaking");
  assert.equal(sp.s, "ing"); assert.equal(sp.claseHora, "14:45");
});

test("lo urgente: pendientes ordenados y sin tachados", () => {
  const n = at("2026-11-03T17:00");
  const p = L.pendientes(EVS, {}, n);
  assert.equal(p[0].id, "ipe-ejercicios-finales");
  assert.equal(L.pendientes(EVS, { "ipe-ejercicios-finales": "x" }, n)[0].id, "fisio-infografia");
  assert.equal(L.pendientes(EVS, {}, at("2027-07-01T12:00")).length, 0);
});

test("próximo examen: agenda y fechas de las unidades", () => {
  assert.equal(L.proximoExamen(EVS, D.UNIDADES, AG.horario, at("2026-11-03T17:00")).id, "bio-examen-citogenetica");
  assert.equal(L.proximoExamen(EVS, D.UNIDADES, AG.horario, at("2026-11-04T17:00")).id, "lab-examen-u2");
  /* después de la semana del 3 de noviembre, el siguiente que haya en el JSON (se lee, no se copia) */
  const sig = EVS.filter((e) => (e.tipo === "examen" || e.tipo === "oral") && e.due > at("2026-11-09T12:00")).sort((a, b) => a.due - b.due)[0] || null;
  const px = L.proximoExamen(EVS, D.UNIDADES, AG.horario, at("2026-11-09T12:00"));
  assert.equal(px ? px.id : null, sig ? sig.id : null);
  assert.equal(L.proximoExamen(EVS, D.UNIDADES, AG.horario, at("2027-06-30T23:00")), null);
  /* una unidad con fecha futura entra aunque no esté en la agenda */
  const u = [{ id: "x1", s: "gest", tema: "Tema X", fecha: "2026-11-12" }];
  const ex = L.proximoExamen([], u, AG.horario, at("2026-11-09T12:00"));
  assert.equal(ex.unidad, "x1"); assert.equal(ex.claseHora, "14:45");
  /* sin repetir: lab2 tiene fecha en la unidad y en la agenda */
  const lab2 = L.proximoExamen(EVS, D.UNIDADES, AG.horario, at("2026-11-05T09:00"));
  assert.equal(lab2.id, "lab-examen-u2");
});

test("cuenta atrás", () => {
  assert.equal(L.cuentaAtras(0), "cerrado");
  assert.equal(L.cuentaAtras(3 * 864e5 + 4 * 36e5), "3 d 4 h");
  assert.equal(L.cuentaAtras(2 * 36e5 + 5 * 6e4 + 9000), "02:05:09");
  assert.equal(L.cuentaAtras(2 * 36e5 + 5 * 6e4, true), "2 h 05 min");
  assert.deepEqual(L.partes(26 * 36e5 + 61000), [["1", "d"], ["02", "h"], ["01", "m"]]);
  assert.deepEqual(L.partes(2 * 36e5 + 61000), [["02", "h"], ["01", "m"], ["01", "s"]]);
  assert.deepEqual(L.partes(-5), [["00", "h"], ["00", "m"], ["00", "s"]]);
});

test("formato 12 h", () => {
  assert.equal(L.h12("14:45"), "2:45 p. m.");
  assert.equal(L.h12("14:45", true), "2:45 pm");
  assert.equal(L.h12("00:10", true), "12:10 am");
  assert.equal(L.h12("12:00", true), "12:00 pm");
  assert.equal(L.h12r("14:45", "16:35"), "2:45–4:35 p. m.");
  assert.equal(L.h12r("11:30", "12:30"), "11:30 a. m.–12:30 p. m.");
  assert.equal(L.rango("14:45", "16:35", "24"), "14:45–16:35");
  assert.equal(L.rango("14:45", "16:35", "ambas"), "14:45–16:35 (2:45–4:35 p. m.)");
  assert.equal(L.hora("20:45", "12"), "8:45 pm");
  assert.equal(L.formatoValido("<b>"), "ambas");
});

test("progreso por unidad: v2, clave antigua viva y tope", () => {
  assert.deepEqual(L.progreso(37, [1, 2, 3], null), { hechos: 3, total: 37, pct: 8 });
  assert.deepEqual(L.progreso(37, [1], JSON.stringify({ done: { 1: 1, 2: 1, 5: 1, 6: 0 } })), { hechos: 3, total: 37, pct: 8 });
  assert.equal(L.progreso(2, [1, 2, 3, 4], null).hechos, 2);
  assert.equal(L.progreso(10, undefined, "{roto").hechos, 0);
  assert.equal(L.progreso(0, [1], null).pct, 0);
  for (const u of D.UNIDADES) assert.ok(u.progreso && u.progreso.total > 0, u.id);
});

test("planta: una hoja por día con algo tachado", () => {
  const a = ["2026-11-02"];
  assert.deepEqual(L.planta(a, "2026-11-03", true), ["2026-11-02", "2026-11-03"]);
  assert.deepEqual(a, ["2026-11-02"]);
  assert.deepEqual(L.planta(["2026-11-03"], "2026-11-03", true), ["2026-11-03"]);
  assert.deepEqual(L.planta(["2026-11-03"], "2026-11-03", false), []);
  assert.deepEqual(L.planta(null, "2026-11-03", false), []);
});

test("calendario: festivos, rangos y fechas clave", () => {
  assert.deepEqual(L.infoDia(AG.calendario, EVS, "2026-11-02").cls, ["es-festivo"]);
  assert.deepEqual(L.infoDia(AG.calendario, EVS, "2026-12-28").cls, ["es-sinclase"]);
  assert.ok(L.infoDia(AG.calendario, EVS, "2026-11-06").cls.includes("es-clave"));
  assert.equal(L.infoDia(AG.calendario, EVS, "2026-11-05").evs.length, 3);
});

test("datos: 13 unidades, ids de carpeta y bloques", () => {
  assert.equal(D.UNIDADES.length, 13);
  const S = req("../assets/store.js");
  assert.deepEqual(D.UNIDADES.map((u) => u.id).sort(), [...S.UNIDADES].sort());
  for (const u of D.UNIDADES) {
    assert.ok(D.ASIGNATURAS[u.s], u.id);
    assert.ok(u.bloques.length > 0, u.id);
    assert.ok(u.repaso.web.startsWith(u.id + "/"), u.id);
  }
  assert.equal(D.unidad("__proto__"), null);
  assert.equal(D.ORDEN_ASIG.length, 8);
  assert.ok(D.FRANKLIN.includes("@foto"));
  assert.equal(L.escapar('<a href="x">'), "&lt;a href=&quot;x&quot;&gt;");
});
