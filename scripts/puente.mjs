/* Fase 7 · conecta páginas de unidad de antes al puente de Corte (assets/corte/puente.css y puente.js).
   Uso: node scripts/puente.mjs lab1/repaso lab1/banco …   (carpetas con index.html)
   Solo cambia la cabecera: class="corte" en <html>, el CSS después de los estilos de la página y el JS al final.
   No toca el contenido ni los scripts de la página. Se puede repetir: si ya está conectada, no hace nada. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CSS = '<link rel="stylesheet" href="../../assets/corte/puente.css">';
const JS = '<script src="../../assets/corte/puente.js" defer></script>';

export function conectar(html) {
  if (html.includes("assets/corte/puente.css")) return html;
  const tag = html.match(/<html\b[^>]*>/);
  if (!tag || !/data-unit="[^"]+"/.test(tag[0])) throw new Error("la página no tiene <html data-unit>");
  const nuevoTag = /class="/.test(tag[0]) ? tag[0].replace(/class="/, 'class="corte ') : tag[0].replace(/<html/, '<html class="corte"');
  let h = html.replace(tag[0], nuevoTag);
  /* después del último estilo propio de la unidad */
  const links = [...h.matchAll(/<link rel="stylesheet" href="\.\.\/\.\.\/assets\/(?:repaso|unidades|practica)\.css">/g)];
  if (!links.length) throw new Error("no encuentro los estilos de la unidad");
  const ult = links[links.length - 1], fin = ult.index + ult[0].length;
  h = h.slice(0, fin) + "\n" + CSS + h.slice(fin);
  const cierre = h.lastIndexOf("</body>");
  if (cierre < 0) throw new Error("no hay </body>");
  h = h.slice(0, cierre) + JS + "\n" + h.slice(cierre);
  return h;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const d of process.argv.slice(2)) {
    const f = ROOT + d.replace(/\/$/, "") + "/index.html";
    const antes = readFileSync(f, "utf8"), despues = conectar(antes);
    if (despues === antes) { console.log("ya conectada:", d); continue; }
    writeFileSync(f, despues); console.log("conectada:", d);
  }
}
