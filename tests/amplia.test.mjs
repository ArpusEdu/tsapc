/* Enfoque · «Para saber más» (campo amplia de contenido.json, ver la cabecera de scripts/repaso.mjs).
   Es lo único de un concepto que no viene de las diapositivas, así que tiene que ir aparte y quedarse fuera
   de todo lo que se lee como «de la profe»:
   - cada concepto con amplia tiene exactamente una caja <details class="amplia">, cerrada, con su etiqueta, al final del cuerpo;
   - dentro no hay piezas que lean los scripts o las pruebas (.prof-t, .qt, .defs, .fd, data-n, .box) ni emojis;
   - las tarjetas del repaso (scripts/extraer-preguntas.mjs) no llevan ni una palabra de la ampliación. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { tarjetasRepaso, textoDe } from "../scripts/extraer-preguntas.mjs";

const ROOT = new URL("../", import.meta.url);
const leer = (p) => readFileSync(new URL(p, ROOT), "utf8");
const ETQ = '<summary><span class="lbl">Para saber más</span><span class="amplia-de"> · de Enfoque, no viene en tus diapositivas</span></summary>';
const unidades = readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  .filter((u) => existsSync(new URL(u + "/repaso/contenido.json", ROOT)) && existsSync(new URL(u + "/repaso/index.html", ROOT)))
  .filter((u) => JSON.parse(leer(u + "/repaso/contenido.json")).bloques.some((b) => b.conceptos.some((c) => c.amplia != null)));

for (const u of unidades) {
  const D = JSON.parse(leer(u + "/repaso/contenido.json"));
  const h = leer(u + "/repaso/index.html");
  const conceptos = D.bloques.flatMap((b) => b.conceptos);
  const arts = [...h.matchAll(/<article class="cpt[^"]*" id="c(\d+)"[^>]*>([\s\S]*?)<\/article>/g)].map((m) => m[2]);

  test(u + ": «Para saber más» va aparte, cerrado y al final de su concepto", () => {
    assert.equal(arts.length, conceptos.length);
    conceptos.forEach((c, i) => {
      const a = arts[i], n = (a.match(/<details class="amplia"/g) || []).length;
      assert.equal(n, c.amplia != null ? 1 : 0, (i + 1) + ". " + c.titulo);
      if (c.amplia == null) return;
      assert.ok(a.includes('<details class="amplia">' + ETQ), (i + 1) + ": sin la etiqueta o abierto");
      assert.ok(/<\/details>\n<\/div>$/.test(a), (i + 1) + ": no está al final del cuerpo");
      assert.ok(a.indexOf('<details class="amplia"') > a.lastIndexOf('<div class="box'), (i + 1) + ": va antes de otra caja");
    });
  });

  test(u + ": dentro de «Para saber más» no hay piezas de la profe ni emojis", () => {
    for (const c of conceptos) if (c.amplia != null) {
      assert.ok(!/prof-t|class="qt"|class="defs|class="fd|data-n=|class="box|<details|<input/.test(c.amplia), c.titulo);
      assert.ok(!/\p{Extended_Pictographic}/u.test(c.amplia), c.titulo + ": emoji");
    }
  });

  test(u + ": las tarjetas no llevan nada de «Para saber más»", () => {
    const tarjetas = JSON.stringify(tarjetasRepaso(u));
    assert.ok(!tarjetas.includes("amplia") && !tarjetas.includes("Para saber más"));
    for (const c of conceptos) if (c.amplia != null) {
      const frase = textoDe(c.amplia).split(/(?<=\.)\s/)[0].slice(0, 60);
      assert.ok(!tarjetas.includes(JSON.stringify(frase).slice(1, -1)), c.titulo + ": «" + frase + "» está en las tarjetas");
    }
  });
}
