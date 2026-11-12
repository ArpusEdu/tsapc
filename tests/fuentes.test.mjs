/* Corte · los repasos generados con scripts/repaso.mjs dicen lo que dice la profe, tal cual.
   Para cada unidad con <u>/repaso/contenido.json y docs/fuentes/<u>.txt (texto sacado del PDF de la profe, más
   docs/fuentes/<u>-imagenes.txt con el texto que en el PDF está dentro de imágenes), cada trozo de «Lo que dice la profe»
   y cada definición «de la diapositiva» tiene que aparecer en la fuente.
   Se compara solo letras y números (el PDF parte líneas y espacia letras: «L a s b a s e s»), y se corta por frases,
   viñetas, celdas, flechas y dos puntos, porque los repasos ordenan el texto en listas y tablas. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const leer = (p) => readFileSync(new URL(p, ROOT), "utf8");
const plano = (s) => s.toLowerCase().normalize("NFC").replace(/[^a-z0-9áéíóúüñ]/g, "");

const unidades = readdirSync(new URL("docs/fuentes/", ROOT)).filter((f) => /^[a-z0-9-]+\.txt$/.test(f) && !f.includes("-imagenes")).map((f) => f.slice(0, -4))
  .filter((u) => existsSync(new URL(u + "/repaso/contenido.json", ROOT)));

test("hay unidades con fuente para comprobar", () => assert.ok(unidades.length > 0));

for (const u of unidades) {
  test(u + ": «Lo que dice la profe» está tal cual en el PDF", () => {
    let fuente = leer("docs/fuentes/" + u + ".txt");
    if (existsSync(new URL("docs/fuentes/" + u + "-imagenes.txt", ROOT))) fuente += "\n" + leer("docs/fuentes/" + u + "-imagenes.txt");
    const F = plano(fuente);
    const D = JSON.parse(leer(u + "/repaso/contenido.json"));
    const fallos = [];
    let n = 0;
    for (const b of D.bloques) for (const c of b.conceptos) {
      n++;
      const textos = [c.prof].concat((c.defs || []).filter((d) => d.diapo).map((d) => d.diapo));
      for (const t of textos) {
        const trozos = t.replace(/<\/(li|p|td|th|h\d)>|<br\s*\/?>|<li>|<ul>|<ol[^>]*>/g, "|").replace(/<[^>]+>/g, "")
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
          .split(/[|→:;]|\. (?=[A-ZÁÉÍÓÚ¿])|\s\/\s/).map(plano).filter((x) => x.length >= 6);
        for (const x of trozos) if (!F.includes(x)) fallos.push(n + ". " + c.titulo + " → «" + x + "»");
      }
    }
    assert.deepEqual(fallos, [], "Trozos que no están en el PDF:\n" + fallos.join("\n"));
  });

  test(u + ": la página de repaso está al día con su contenido", async () => {
    const { execFileSync } = await import("node:child_process");
    const { fileURLToPath } = await import("node:url");
    execFileSync(process.execPath, [fileURLToPath(new URL("scripts/repaso.mjs", ROOT)), u, "--comprobar"]);
  });
}
