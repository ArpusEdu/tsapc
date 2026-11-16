import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const leer = (p) => JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));

test("preguntas para clase: bien formadas y enlazadas a su concepto y diapositiva", () => {
  const idx = leer("app/profe/indice.json");
  assert.ok(Array.isArray(idx.unidades) && idx.unidades.length);
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.ok(sw.includes('"app/profe/indice.json"'), "el índice va en el SHELL");
  for (const u of idx.unidades) {
    assert.ok(sw.includes('"app/profe/' + u + '.json"'), u + " va en el SHELL");
    const j = leer("app/profe/" + u + ".json"); assert.equal(j.unidad, u);
    const c = leer(u + "/repaso/contenido.json"), conceptos = c.bloques.flatMap((b) => b.conceptos);
    const ids = new Set();
    for (const q of j.preguntas) {
      assert.ok(!ids.has(q.id), "id repetido " + q.id); ids.add(q.id);
      assert.ok(["entender", "laboratorio", "caso", "examen"].includes(q.tipo), q.id + " tipo");
      assert.ok(q.pregunta.startsWith("¿") && q.pregunta.endsWith("?"), q.id + " es una pregunta");
      assert.ok(q.pregunta.length <= 70, q.id + ": pregunta corta, como se haría en clase (" + q.pregunta.length + ")");
      assert.ok(q.porque.length >= 10 && q.porque.length <= 60, q.id + ": porqué breve");
      const k = conceptos[q.n - 1]; assert.ok(k, q.id + ": no existe el concepto " + q.n);
      const diaps = (k.fuente || "").match(/\d+/g) || [];
      for (const d of q.diap.match(/\d+/g)) assert.ok(diaps.includes(d), q.id + ": la diapositiva " + d + " no es del concepto " + q.n + " (" + k.fuente + ")");
    }
  }
});
