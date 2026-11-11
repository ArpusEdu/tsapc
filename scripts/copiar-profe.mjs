/* Copia, tal cual, el contenido de la profe del repaso de una unidad a una sesión de estudio.
   Uso: node scripts/copiar-profe.mjs <unidad> <id-de-sesión>      (p. ej. lab1 lab1-limpieza)
   Rellena en cada concepto: profe.dice («Lo que dice la profe»), profe.entiende («Entiéndelo») y profe.truco.
   Si el misterio dice "desde": <n>, su solución es el «Lo que dice la profe» de ese concepto (y su «Entiéndelo»).
   Así lo de la profe nunca se escribe a mano: tests/sesion.test.mjs comprueba que coincide con el original. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const [unidad, id] = process.argv.slice(2);
if (!unidad || !id) { console.error("uso: node scripts/copiar-profe.mjs <unidad> <id-de-sesión>"); process.exit(1); }
const html = readFileSync(ROOT + unidad + "/repaso/index.html", "utf8");
const f = ROOT + "app/sesiones/" + id + ".json";
const S = JSON.parse(readFileSync(f, "utf8"));

function concepto(n) {
  const at = html.indexOf('id="c' + n + '"');
  if (at < 0) throw new Error("no encuentro el concepto " + n + " en " + unidad);
  const ini = html.lastIndexOf("<article", at), fin = html.indexOf("</article>", at);
  const a = html.slice(ini, fin);
  const prof = a.match(/<div class="prof-t">([\s\S]*?)<\/div>\s*(?=<div class="box|<p class="lbl|$)/);
  if (!prof) throw new Error("sin «Lo que dice la profe» en " + n);
  const ent = a.match(/<div class="box und">[\s\S]*?<\/p>\s*<p>([\s\S]*?)<\/p>/);
  const tr = a.match(/<div class="box tip">[\s\S]*?<\/p>\s*<p>([\s\S]*?)<\/p>/);
  return {
    dice: prof[1].replace(/<div class="gal">[\s\S]*?<\/div>/g, "").replace(/<img[^>]*>/g, "").replace(/<p class="cap">[\s\S]*?<\/p>/g, "").trim(),
    entiende: ent ? ent[1].trim() : "",
    truco: tr ? tr[1].trim() : ""
  };
}
for (const c of S.conceptos) {
  const o = concepto(c.n);
  c.profe.dice = o.dice; c.profe.entiende = o.entiende; c.profe.truco = o.truco;
  if (!o.entiende) delete c.profe.entiende;
  if (!o.truco) delete c.profe.truco;
  console.log(c.n, "dice", o.dice.length, "entiende", !!o.entiende, "truco", !!o.truco);
}
if (S.misterio && S.misterio.desde) {
  const o = concepto(S.misterio.desde);
  S.misterio.solucionProfe = o.dice; S.misterio.entiendeProfe = o.entiende;
  console.log("misterio desde", S.misterio.desde, "solución", o.dice.length);
}
writeFileSync(f, JSON.stringify(S, null, 2) + "\n");
