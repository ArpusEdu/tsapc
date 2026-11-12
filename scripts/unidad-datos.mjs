/* Corte · pone al día los datos de una unidad generada con scripts/repaso.mjs en el resto de la web:
   app/datos.js (progreso y bloques), index.html (PROG) y centro/index.html (bloques del aula 3D).
   Uso: node scripts/unidad-datos.mjs <unidad> */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const u = process.argv[2];
const D = JSON.parse(fs.readFileSync(path.join(RAIZ, u, "repaso", "contenido.json"), "utf8"));
const total = D.bloques.reduce((s, b) => s + b.conceptos.length, 0);
const titulos = D.bloques.map((b) => b.titulo);

/* app/datos.js: el objeto de la unidad, en JSON con sangría de 1 espacio */
const dp = path.join(RAIZ, "app", "datos.js");
let d = fs.readFileSync(dp, "utf8");
const ini = d.indexOf('\n {\n  "id": "' + u + '"');
if (ini < 0) throw new Error("No encuentro la unidad " + u + " en app/datos.js");
const fin = d.indexOf("\n }", ini + 1) + 3;
const obj = JSON.parse(d.slice(ini, fin));
obj.progreso = { clave: D.clave, total };
obj.bloques = titulos;
const nuevo = "\n" + JSON.stringify(obj, null, 1).split("\n").map((l) => " " + l).join("\n");
d = d.slice(0, ini) + nuevo + d.slice(fin);
fs.writeFileSync(dp, d);

/* index.html: PROG */
const ip = path.join(RAIZ, "index.html");
let h = fs.readFileSync(ip, "utf8");
const re = new RegExp('"' + u + '": \\{"key": "[^"]*", "total": \\d+\\}');
if (re.test(h)) h = h.replace(re, '"' + u + '": {"key": "' + D.clave + '", "total": ' + total + "}");
else h = h.replace("const PROG={", 'const PROG={"' + u + '": {"key": "' + D.clave + '", "total": ' + total + "}, ");
fs.writeFileSync(ip, h);

/* centro/index.html: blocks:[…] de la unidad */
const cp = path.join(RAIZ, "centro", "index.html");
let c = fs.readFileSync(cp, "utf8");
const rc = new RegExp("(\\n  " + u.replace("-", "\\-") + ":\\{[^\\n]*?blocks:)\\[[^\\]]*\\]");
if (rc.test(c)) { c = c.replace(rc, (m, a) => a + "[" + titulos.map((t) => "'" + t.replace(/'/g, "\\'") + "'").join(",") + "]"); fs.writeFileSync(cp, c); }
else console.log("aviso: la unidad no está en centro/index.html");

console.log(u, "·", total, "conceptos ·", titulos.length, "bloques · clave", D.clave);
