/* Corte · registra sesiones nuevas: las añade al final de app/sesiones/indice.json y a la caché sin conexión (sw.js).
   Uso: node scripts/registrar-sesiones.mjs <id> [<id> …]
   El índice toma de cada sesión su bloque, título y minutos; la pegatina, de la unidad (app/datos.js);
   el gancho, del título del misterio en minúsculas. Lo que ya está registrado no se toca. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ids = process.argv.slice(2);
if (!ids.length) { console.error("Uso: node scripts/registrar-sesiones.mjs <id> […]"); process.exit(1); }

const D = createRequire(import.meta.url)(path.join(RAIZ, "app", "datos.js"));
const unidad = (u) => D.unidad(u);

const ip = path.join(RAIZ, "app", "sesiones", "indice.json");
let txt = fs.readFileSync(ip, "utf8");
const I = JSON.parse(txt);
const lineas = [];
for (const id of ids) {
  if (I.sesiones.some((x) => x.id === id)) continue;
  const S = JSON.parse(fs.readFileSync(path.join(RAIZ, "app", "sesiones", id + ".json"), "utf8"));
  const U = unidad(S.unidad);
  if (!U) throw new Error("Unidad desconocida: " + S.unidad);
  const gancho = S.gancho || S.misterio.titulo.charAt(0).toLowerCase() + S.misterio.titulo.slice(1);
  lineas.push('    { "id": ' + JSON.stringify(id) + ', "unidad": ' + JSON.stringify(S.unidad) + ', "bloque": ' + S.bloque + ', "titulo": ' + JSON.stringify(S.titulo) +
    ', "minutos": ' + S.minutos + ', "pegatina": ' + JSON.stringify(U.pegatina) + ', "gancho": ' + JSON.stringify(gancho) + " }");
}
if (lineas.length) {
  const fin = txt.lastIndexOf("}\n  ]");
  if (fin < 0) throw new Error("No sé dónde acaba la lista de indice.json");
  txt = txt.slice(0, fin + 1) + ",\n" + lineas.join(",\n") + txt.slice(fin + 1);
  JSON.parse(txt);
  fs.writeFileSync(ip, txt);
}

const sp = path.join(RAIZ, "sw.js");
let sw = fs.readFileSync(sp, "utf8");
const nuevos = ids.filter((id) => !sw.includes('"app/sesiones/' + id + '.json"'));
if (nuevos.length) {
  const todas = [...sw.matchAll(/"app\/sesiones\/[a-z0-9-]+\.json"/g)];
  const ult = todas[todas.length - 1];
  const pos = ult.index + ult[0].length;
  sw = sw.slice(0, pos) + ", " + nuevos.map((id) => '"app/sesiones/' + id + '.json"').join(", ") + sw.slice(pos);
  fs.writeFileSync(sp, sw);
}
console.log("índice +" + lineas.length + " · sin conexión +" + nuevos.length);
