/* Corte · Fase 4 · extrae los bancos de preguntas y las tarjetas tal cual, sin cambiar ni una letra.
   Uso: node scripts/extraer-preguntas.mjs            → escribe app/preguntas/<unidad>.json
        node scripts/extraer-preguntas.mjs --comprobar → solo comprueba que los JSON están al día
   Fuentes (solo se leen): <u>/simulacro/index.html, lab1/{banco,test-50,test-50-b}, ingles1/{simulacro,examen,
   simulacro-vocabulario,examen-vocabulario,vocabulario} y <u>/repaso/index.html (las tarjetas del modo «Tarjetas»).
   Ids estables: <u>.q.017 (banco principal), <u>.<banco>.q.017 (otros bancos), <u>.t.q12 / <u>.t.d12_0 / ingles1.t.v7 (tarjetas).
   Nada de dependencias: los datos se leen con un analizador de literales y vm, y el HTML de los repasos con un lector mínimo. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = path.join(RAIZ, "app", "preguntas");

export const UNIDADES = ["bio1", "bio2", "bio3", "fisio1", "fisio2", "fisio3", "fisio4", "gest1", "gest2", "ingles1", "ipe2", "ipe-tema5", "lab1", "lab2"];

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8");
const num = (n) => String(n).padStart(3, "0");

/* ---------- literales JS: `const NOMBRE = <literal>` → valor ---------- */
export function literal(html, nombre) {
  const m = new RegExp("const " + nombre + "\\s*=\\s*").exec(html);
  if (!m) throw new Error("No encuentro const " + nombre);
  let i = m.index + m[0].length;
  const ini = i, abre = html[i];
  if (abre !== "[" && abre !== "{") throw new Error("Literal raro en " + nombre);
  let prof = 0, q = null;
  for (; i < html.length; i++) {
    const c = html[i];
    if (q) { if (c === "\\") { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "[" || c === "{") prof++;
    else if (c === "]" || c === "}") { prof--; if (prof === 0) break; }
  }
  const txt = html.slice(ini, i + 1);
  return vm.runInNewContext("(" + txt + ")", Object.create(null), { timeout: 2000 });
}

/* ---------- HTML mínimo para los repasos ---------- */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodificar(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (t, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1));
    return Object.prototype.hasOwnProperty.call(ENT, e.toLowerCase()) ? ENT[e.toLowerCase()] : t;
  });
}
export const textoDe = (h) => decodificar(h.replace(/<[^>]*>/g, ""));
/* contenido interior del primer <div class="cls"> a partir de `desde`, con los div equilibrados */
function divInterior(html, cls, desde) {
  const abre = '<div class="' + cls + '">';
  const a = html.indexOf(abre, desde || 0);
  if (a < 0) return null;
  let i = a + abre.length, prof = 1;
  const re = /<div\b|<\/div>/g; re.lastIndex = i;
  let m;
  while ((m = re.exec(html))) { prof += m[0] === "</div>" ? -1 : 1; if (prof === 0) return { html: html.slice(i, m.index), fin: re.lastIndex }; }
  throw new Error("div sin cerrar: " + cls);
}

/* Reproduce el mazo ALL del modo Tarjetas de los repasos (mismo orden y mismos ids). */
export function tarjetasRepaso(u) {
  const html = leer(u + "/repaso/index.html");
  const out = [];
  const reSec = /<section class="blk" id="(b\d+)"[^>]*>[\s\S]*?<span class="bn">([\s\S]*?)<\/span><span class="bt">([\s\S]*?)<\/span>/g;
  const secs = []; let m;
  while ((m = reSec.exec(html))) secs.push({ pos: m.index, id: m[1], bn: textoDe(m[2]), bt: textoDe(m[3]) });
  const reArt = /<article class="cpt[^"]*" id="c(\d+)" data-lv="(\d)">([\s\S]*?)<\/article>/g;
  while ((m = reArt.exec(html))) {
    const n = m[1], lv = m[2], a = m[3];
    const sec = secs.filter((s) => s.pos < m.index).pop();
    const h3 = /<h3>([^<]*)/.exec(a), srcl = /<span class="srcl">([\s\S]*?)<\/span>/.exec(a), qt = /<p class="qt">([\s\S]*?)<\/p>/.exec(a);
    const prof = []; let d = 0, p;
    while ((p = divInterior(a, "prof-t", d))) { prof.push(p.html); d = p.fin; }
    const src = srcl ? textoDe(srcl[1]) : "";
    const base = { bloque: sec.id, bloqueNum: sec.bn, bloqueTit: sec.bt, nivel: +lv, fuente: src };
    if (qt) out.push(Object.assign({ id: u + ".t.q" + n, tipo: "pregunta", titulo: n + ". " + decodificar(h3 ? h3[1] : ""), frente: textoDe(qt[1]), dorso: prof.join(""), formato: "html" }, base));
    const defs = divInterior(a, "defs");
    if (defs) {
      const lis = defs.html.split(/<li>(?=<b class="term">)/).slice(1);
      lis.forEach((li, i) => {
        const ok = /<div class="fd ok">([\s\S]*?)<\/div>/.exec(li);
        if (!ok) return;
        const term = textoDe(/<b class="term">([\s\S]*?)<\/b>/.exec(li)[1]);
        const txt = textoDe(ok[1]).replace(/^📌[^«]*/, "");
        out.push(Object.assign({ id: u + ".t.d" + n + "_" + i, tipo: "definicion", titulo: term, frente: "¿Cómo define la diapositiva: «" + term + "»?", dorso: txt, formato: "texto" }, base));
      });
    }
  }
  return out;
}

function tarjetasVocabulario() {
  const D = literal(leer("ingles1/vocabulario/index.html"), "DATA");
  return D.items.map((w) => ({ id: "ingles1.t.v" + w.n, tipo: "palabra", titulo: w.en, frente: w.en, dorso: w.es, pronuncia: w.p, truco: w.t, ejemplo: w.e, grupo: w.g, formato: "texto", cajaAntigua: w.n }));
}

/* ---------- familia A: const D = {PARTS:[...]} ---------- */
function bancoPartes(u, D, idBase) {
  const partes = [], preguntas = [];
  D.PARTS.forEach((P, pi) => {
    const pid = "P" + pi;
    partes.push({ id: pid, k: P.k, t: P.t, how: P.how });
    P.items.forEach((q) => {
      const b = { id: idBase + num(preguntas.length + 1), parte: pid };
      if (q.l !== undefined) b.n = q.l;
      if (q.type === "mc") Object.assign(b, { tipo: "test", texto: q.q, opciones: q.o, correcta: q.c }, q.j ? { explicacion: q.j } : {});
      else if (q.type === "vf") Object.assign(b, { tipo: "vf", texto: q.q, correcta: q.v === 1 || q.v === true }, q.e ? { explicacion: q.e } : {});
      else Object.assign(b, { tipo: "abierta", texto: q.q, respuesta: q.a, lineas: q.rows || 3 });
      preguntas.push(b);
    });
  });
  return { partes, preguntas };
}

/* ---------- familia B: const D = {MC,VF,MATCH,FIGS,SC,SF,SG,SE,SH} (los PARTS.push del original) ---------- */
function bancoArrays(u, html, D, idBase) {
  const partes = [], preguntas = [];
  const re = /PARTS\.push\(\{id:"([A-Z])",k:"([^"]*)",t:"([^"]*)",how:"([^"]*)",items:D\.([A-Z]+)\.map\(\([a-z],i\)=>([a-zA-Z]+)\(/g;
  let m;
  while ((m = re.exec(html))) {
    const [, pid, k, t, how, arr, fn] = m;
    partes.push({ id: pid, k, t, how });
    D[arr].forEach((q, i) => {
      const b = { id: idBase + num(preguntas.length + 1), parte: pid };
      if (fn === "mcItem") { b.n = String(i + 1); Object.assign(b, { tipo: "test", texto: q[0], opciones: q[1], correcta: q[2] }); }
      else if (fn === "vfItem") { b.n = "B" + (i + 1); Object.assign(b, { tipo: "vf", texto: q[0], correcta: q[1] === 1 || q[1] === true }, q[2] ? { explicacion: q[2] } : {}); }
      else if (fn === "matchItem") Object.assign(b, { tipo: "relacionar", texto: q.t, opciones: q.opts, filas: q.items });
      else if (fn === "labelItem") Object.assign(b, { tipo: "esquema", texto: q.title, diapositiva: q.slide, img: q.img, respuestas: q.answers });
      else if (fn === "selfItem") { b.n = pid + (i + 1); Object.assign(b, { tipo: "abierta", texto: q[0], respuesta: q[1] }); }
      else throw new Error(u + ": tipo desconocido " + fn);
      preguntas.push(b);
    });
  }
  return { partes, preguntas };
}

/* ---------- familia C: lab1 const Q = [...] ---------- */
function bancoLab1(Q, idBase) {
  const bloques = [...new Set(Q.map((q) => q.s))];
  const partes = bloques.map((s, i) => ({ id: "S" + i, k: "", t: s, how: "" }));
  const preguntas = Q.map((q, i) => Object.assign({ id: idBase + num(i + 1), parte: "S" + bloques.indexOf(q.s), n: String(q.n), tipo: "test", texto: q.q, opciones: q.o, correcta: q.a },
    q.e ? { explicacion: q.e } : {}, { bloque: q.b, diapositiva: q.d }));
  return { partes, preguntas };
}

/* ---------- familia D: ingles1 const EX = [...] ---------- */
function bancoIngles(EX, idBase) {
  const partes = [], preguntas = [];
  EX.forEach((ex, si) => {
    const pid = "E" + si;
    partes.push(Object.assign({ id: pid, k: String(si + 1), t: ex.t, how: ex.es }, ex.type === "cloze" ? { contexto: ex.text } : {}));
    ex.items.forEach((it, i) => {
      const b = { id: idBase + num(preguntas.length + 1), parte: pid, variante: ex.type };
      if (ex.type === "mc" || ex.type === "sel" || ex.type === "selgap") Object.assign(b, { tipo: "test", texto: it[0], opciones: it[1], correcta: it[2] });
      else if (ex.type === "gap" || ex.type === "fix" || ex.type === "voc") Object.assign(b, { tipo: "escribir", texto: it[0], campos: [{ aceptadas: it[1] }] });
      else if (ex.type === "spell") Object.assign(b, { tipo: "escribir", texto: it[0], pista: it[1], campos: [{ aceptadas: it[2] }] });
      else if (ex.type === "table") Object.assign(b, { tipo: "escribir", texto: it[0], campos: [{ etiqueta: "Past simple", aceptadas: it[1] }, { etiqueta: "Past participle", aceptadas: it[2] }] });
      else if (ex.type === "pair") Object.assign(b, { tipo: "escribir", texto: it[0], campos: [{ etiqueta: "Negative:", aceptadas: it[1] }, { etiqueta: "Question:", aceptadas: it[2] }] });
      else if (ex.type === "cloze" && ex.bank) Object.assign(b, { tipo: "test", texto: "", hueco: i + 1, opciones: ex.bank, correcta: it });
      else if (ex.type === "cloze") Object.assign(b, { tipo: "escribir", texto: "", hueco: i + 1, campos: [{ aceptadas: it }] });
      else throw new Error("ingles1: tipo desconocido " + ex.type);
      preguntas.push(b);
    });
  });
  return { partes, preguntas };
}

const formatoDe = (html) => /const md=s=>String\(s\);/.test(html) ? "html" : /const md=s=>String\(s\)\.replace\(\/&\/g/.test(html) ? "md" : "texto";

export function extraerUnidad(u) {
  const bancos = [];
  if (u === "lab1") {
    [["banco", "Banco completo", "lab1/banco/", "lab1.q."], ["t50", "Test de 50", "lab1/test-50/", "lab1.t50.q."], ["t50b", "Test de 50 · B", "lab1/test-50-b/", "lab1.t50b.q."]].forEach(([id, titulo, dir, base]) => {
      const Q = literal(leer(dir + "index.html"), "Q");
      bancos.push(Object.assign({ id, titulo, fuente: dir, formato: "texto" }, bancoLab1(Q, base)));
    });
  } else if (u === "ingles1") {
    [["sim", "Simulacro", "ingles1/simulacro/", "ingles1.q."], ["examen", "Examen", "ingles1/examen/", "ingles1.examen.q."], ["simvoc", "Simulacro de vocabulario", "ingles1/simulacro-vocabulario/", "ingles1.simvoc.q."], ["exvoc", "Examen de vocabulario", "ingles1/examen-vocabulario/", "ingles1.exvoc.q."]].forEach(([id, titulo, dir, base]) => {
      const EX = literal(leer(dir + "index.html"), "EX");
      bancos.push(Object.assign({ id, titulo, fuente: dir, formato: "texto" }, bancoIngles(EX, base)));
    });
  } else if (fs.existsSync(path.join(RAIZ, u, "simulacro", "index.html"))) {
    const dir = u + "/simulacro/", html = leer(dir + "index.html"), D = literal(html, "D");
    const r = D.PARTS ? bancoPartes(u, D, u + ".q.") : bancoArrays(u, html, D, u + ".q.");
    bancos.push(Object.assign({ id: "sim", titulo: "Simulacro", fuente: dir, formato: formatoDe(html) }, r));
  }
  const tarjetas = tarjetasRepaso(u).concat(u === "ingles1" ? tarjetasVocabulario() : []);
  return { unidad: u, version: 1, bancos, tarjetas };
}

/* Recuento independiente en los originales (para las pruebas): suma de elementos de cada banco. */
export function recuentoOriginal(u) {
  if (!fs.existsSync(path.join(RAIZ, u, "simulacro", "index.html")) && u !== "lab1" && u !== "ingles1") return [];
  if (u === "lab1") return ["lab1/banco/", "lab1/test-50/", "lab1/test-50-b/"].map((d) => literal(leer(d + "index.html"), "Q").length);
  if (u === "ingles1") return ["simulacro", "examen", "simulacro-vocabulario", "examen-vocabulario"].map((d) => literal(leer("ingles1/" + d + "/index.html"), "EX").reduce((s, e) => s + e.items.length, 0));
  const html = leer(u + "/simulacro/index.html"), D = literal(html, "D");
  if (D.PARTS) return [D.PARTS.reduce((s, p) => s + p.items.length, 0)];
  const usados = [...html.matchAll(/items:D\.([A-Z]+)\.map/g)].map((x) => x[1]);
  return [usados.reduce((s, k) => s + D[k].length, 0)];
}
export const recuentoTarjetas = (u) => (leer(u + "/repaso/index.html").match(/<p class="qt">/g) || []).length;

function principal() {
  const comprobar = process.argv.includes("--comprobar");
  if (!comprobar) fs.mkdirSync(SALIDA, { recursive: true });
  let mal = 0;
  for (const u of UNIDADES) {
    const datos = extraerUnidad(u), txt = JSON.stringify(datos) + "\n", f = path.join(SALIDA, u + ".json");
    const n = datos.bancos.map((b) => b.id + ":" + b.preguntas.length).join(" "), nt = datos.tarjetas.length;
    if (comprobar) { const ok = fs.existsSync(f) && fs.readFileSync(f, "utf8") === txt; if (!ok) mal++; console.log((ok ? "al día  " : "CAMBIADO ") + u); }
    else { fs.writeFileSync(f, txt); console.log(u.padEnd(10), n, "· tarjetas:" + nt, "· " + Math.round(txt.length / 1024) + " KB"); }
  }
  if (mal) process.exit(1);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal();
