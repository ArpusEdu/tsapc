/* Enfoque · el contenido.json de cada repaso no puede romper el progreso guardado al regenerar la página.
   Para cada unidad con <u>/repaso/contenido.json, comprueba contra el <u>/repaso/index.html actual:
   - la clave de localStorage (const KEY) es la "clave" del contenido;
   - la numeración de los conceptos: el generador los numera 1..N en orden, así que los data-n de «Lo domino»
     y los id="cN" de la página tienen que ser exactamente 1..N, y el "n" de cada concepto (si lo lleva), su puesto;
   - el id del examen (EXAM.id, que da la clave del plan de estudio) es "examen.id" o, si falta, la carpeta. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const leer = (p) => readFileSync(new URL(p, ROOT), "utf8");
const unidades = readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  .filter((u) => existsSync(new URL(u + "/repaso/contenido.json", ROOT)) && existsSync(new URL(u + "/repaso/index.html", ROOT)));

test("hay unidades con contenido.json", () => assert.ok(unidades.length >= 15, "solo " + unidades.length));

for (const u of unidades) {
  const D = JSON.parse(leer(u + "/repaso/contenido.json"));
  const h = leer(u + "/repaso/index.html");
  const sinScripts = h.replace(/<script[\s\S]*?<\/script>/gi, "");
  const conceptos = D.bloques.flatMap((b) => b.conceptos);
  const esperado = conceptos.map((c, i) => i + 1);

  test(u + ": la clave de guardado es la misma", () => {
    assert.equal((/const KEY="([^"]*)"/.exec(h) || [])[1], D.clave);
  });

  test(u + ": los conceptos tienen la misma numeración (data-n e id=cN)", () => {
    conceptos.forEach((c, i) => { if (c.n !== undefined) assert.equal(c.n, i + 1, "el concepto «" + c.titulo + "» lleva n=" + c.n + " y es el " + (i + 1)); });
    assert.deepEqual([...sinScripts.matchAll(/<input type="checkbox" data-n="(\d+)"/g)].map((m) => +m[1]), esperado);
    assert.deepEqual([...sinScripts.matchAll(/<article class="cpt[^"]*" id="c(\d+)"/g)].map((m) => +m[1]), esperado);
  });

  test(u + ": el id del examen (plan de estudio) es el mismo", () => {
    assert.equal((/const EXAM=\{id:"([^"]*)"/.exec(h) || [])[1], (D.examen && D.examen.id) || u);
  });
}
