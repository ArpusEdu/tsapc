/* Versión del service worker = huella (sha-256) del contenido de los archivos de la app.
   Uso: node scripts/sw-version.mjs   → calcula la huella y la escribe en sw.js
   Así cada cambio en una página, un estilo o un script crea una versión nueva y aparece «Nueva versión · Actualizar». */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SW = ROOT + "sw.js";

export function shellList(src = readFileSync(SW, "utf8")) {
  return JSON.parse(src.match(/const SHELL\s*=\s*(\[[^\]]*\])/)[1]);
}
export function shellVersion(src = readFileSync(SW, "utf8")) {
  const h = createHash("sha256");
  for (const u of shellList(src)) {
    const p = u === "./" ? "index.html" : u.endsWith("/") ? u + "index.html" : u;
    h.update(u + "\0"); h.update(readFileSync(ROOT + p)); h.update("\0");
  }
  return h.digest("hex").slice(0, 12);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const src = readFileSync(SW, "utf8"), v = shellVersion(src);
  const out = src.replace(/const VERSION\s*=\s*"[^"]*"/, `const VERSION = "${v}"`);
  if (out !== src) { writeFileSync(SW, out); console.log("sw.js → versión " + v); }
  else console.log("sw.js ya estaba en la versión " + v);
}
