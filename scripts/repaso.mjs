/* Corte · genera la página de repaso de una unidad a partir de su contenido.
   Uso: node scripts/repaso.mjs <unidad>          → escribe <unidad>/repaso/index.html
        node scripts/repaso.mjs <unidad> --comprobar → solo dice si la página está al día
   Fuente: <unidad>/repaso/contenido.json (lo escrito a mano) + scripts/plantilla-repaso.html
   (copia del repaso original de Bio 3). De la plantilla se conserva todo lo que no depende del tema: estilos, plan de estudio,
   tarjetas, índice, scripts. Lo que depende del tema se genera aquí.

   contenido.json:
   { unidad, titulo (pestaña), eyebrow, h1, sub, clave (localStorage), examen: {em, asig, examen, fecha}, simulacro (ruta o null),
     bloques: [{ titulo, conceptos: [{ titulo, lv (1-3), fuente ("Diapositiva 8"), defs: [{t, facil, diapo?, n?}],
                 prof (HTML: lo que dice la profe), imgs: [{src, alt, w, h}], entiende (HTML), truco (HTML), q }] }],
     llave: [{q, porque, resp (HTML)}], trampas: [[a, b, c]], numeros: [[num, que]], impres: [{titulo, items: [[preg, resp]]}] }
   El chequeo final y el glosario salen solos (preguntas de cada bloque y definiciones). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [u, opt] = process.argv.slice(2);
if (!u) { console.error("Uso: node scripts/repaso.mjs <unidad> [--comprobar]"); process.exit(1); }
const D = JSON.parse(fs.readFileSync(path.join(RAIZ, u, "repaso", "contenido.json"), "utf8"));
const plantilla = fs.readFileSync(path.join(RAIZ, "scripts", "plantilla-repaso.html"), "utf8");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const TAG = { 1: "🔴 IMPRESCINDIBLE", 2: "🟠 IMPORTANTE", 3: "🔵 LEER UNA VEZ" };
const MIN = { 1: 9, 2: 6, 3: 3 };
const ICO = { 1: "🔴", 2: "🟠", 3: "🔵" };

/* ancho y alto reales de un JPEG (marcador SOF), para reservar el hueco y que la página no salte al cargar */
function medida(src) {
  const f = path.join(RAIZ, u, "repaso", src);
  if (!fs.existsSync(f)) throw new Error("Falta la imagen " + f);
  const b = fs.readFileSync(f);
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  throw new Error("No sé leer el tamaño de " + f);
}

/* numeración global */
let n = 0;
const bloques = D.bloques.map((b, i) => ({ ...b, i, conceptos: b.conceptos.map((c) => ({ ...c, n: ++n })) }));
const todos = bloques.flatMap((b) => b.conceptos);
const cuenta = (lv) => todos.filter((c) => c.lv === lv).length;

function concepto(c) {
  const defs = (c.defs || []).length
    ? '<div class="defs"><p class="lbl">📘 Qué significa cada palabra</p><ul>' + c.defs.map((d) =>
        '<li><b class="term">' + d.t + '</b><div class="fd easy"><span class="fl">💡 Para entenderlo</span>' + d.facil + "</div>" +
        (d.diapo ? '<div class="fd ok"><span class="fl">📌 Definición de la diapositiva · la del examen</span>«' + d.diapo + (d.n ? " (diap. " + d.n + ")" : "") + "»</div>" : "") + "</li>").join("") + "</ul></div>\n"
    : "";
  const figs = (c.imgs || []).map((f) => { const [w, hh] = medida(f.src); return '<figure><img src="' + f.src + '" width="' + w + '" height="' + hh + '" loading="lazy" decoding="async" alt="' + esc(f.alt) + '"><figcaption>' + esc(f.alt) + "</figcaption></figure>\n"; }).join("");
  return '<article class="cpt lv' + c.lv + '" id="c' + c.n + '" data-lv="' + c.lv + '">\n' +
    '<header class="c-h"><span class="c-n">' + c.n + "</span><h3>" + esc(c.titulo) + "</h3></header>\n" +
    '<div class="c-meta"><span class="tag lv' + c.lv + '">' + TAG[c.lv] + '</span><span class="srcl">📍 ' + esc(c.fuente) + "</span></div>\n" +
    '<div class="c-body">\n' + defs +
    '<p class="lbl prof">📋 Lo que dice la profe</p>\n<div class="prof-t">' + c.prof + "</div>\n" + figs +
    (c.entiende ? '<div class="box und"><p class="lbl">💡 Entiéndelo</p><p>' + c.entiende + "</p></div>\n" : "") +
    (c.truco ? '<div class="box tip"><p class="lbl">🧠 Truco para recordarlo</p><p>' + c.truco + "</p></div>\n" : "") +
    '<div class="box q"><p class="lbl">❓ Ponte a prueba</p><p class="qt">' + esc(c.q) + '</p><label class="dom"><input type="checkbox" data-n="' + c.n + '"> Lo domino</label></div>\n' +
    "</div></article>\n";
}

function bloque(b) {
  const cs = b.conceptos, min = cs.reduce((s, c) => s + MIN[c.lv], 0) + 4;
  const r = cs.filter((c) => c.lv === 1).length;
  return '<section class="blk" id="b' + b.i + '" data-min="' + min + '"><h2 class="blk-h"><span class="bn">BLOQUE ' + (b.i + 1) + '</span><span class="bt">' + esc(b.titulo) +
    '</span><span class="bc">⏱ ' + min + " min · Conceptos " + cs[0].n + "–" + cs[cs.length - 1].n + " · " + r + ' 🔴 · <b class="bd">0</b>/' + cs.length + " dominados</span></h2>" +
    cs.map(concepto).join("") + "</section>";
}

const tabla = (cab, filas) => '<div class="tw"><table><thead><tr>' + cab.map((h) => "<th>" + h + "</th>").join("") + "</tr></thead><tbody>" +
  filas.map((f) => "<tr>" + f.map((x) => "<td>" + x + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";

function extras() {
  let h = "";
  if (D.llave && D.llave.length) h += '<section class="xs" id="llave"><h2 class="xs-h">🔑 Bloque ' + (bloques.length + 1) + ' · Preguntas llave</h2><p>Candidatas elegidas por lo que más destacan las diapositivas, de más a menos probable. <strong>No son preguntas confirmadas por la profe.</strong> Escríbelas de memoria al menos una vez.</p>' +
    D.llave.map((p, i) => '<details class="pq"><summary><span class="pn">🔑 ' + (i + 1) + "</span> " + esc(p.q) + '</summary><div class="pa"><p><em>Por qué:</em> ' + esc(p.porque) + "</p><p><strong>Respuesta modelo:</strong></p><p>" + p.resp + "</p></div></details>").join("") + "</section>";
  /* aviso del buscador y los filtros (repaso.js lo muestra u oculta) */
  h += '<p class="empty" id="empty" hidden>No hay conceptos con ese filtro o esa búsqueda.</p>';
  if (D.trampas && D.trampas.length) h += '<section class="xs" id="trampas"><h2 class="xs-h">⚠️ Trampas típicas del examen</h2>' + tabla(["No confundas…", "…con…", "Cómo diferenciarlos"], D.trampas) + "</section>";
  if (D.numeros && D.numeros.length) h += '<section class="xs" id="numeros"><h2 class="xs-h">🔢 Números clave (apréndelos como una tabla de multiplicar)</h2>' + tabla(["Número", "Qué es"], D.numeros.map(([a, b]) => ["<strong>" + a + "</strong>", b])) + "</section>";
  h += '<section class="xs" id="chequeo"><h2 class="xs-h">✅ Chequeo final (contesta sin mirar; si fallas una, vuelve a su bloque)</h2><ol>' +
    bloques.map((b) => { const c = b.conceptos.find((x) => x.lv === 1) || b.conceptos[0]; return "<li>" + esc(c.q) + " (Bloque " + (b.i + 1) + ")</li>"; }).join("") + "</ol></section>";
  if (D.impres && D.impres.length) h += '<section class="xs" id="impres"><h2 class="xs-h">⚡ Lo imprescindible (repaso exprés)</h2><p class="meta">Pregunta directa → respuesta corta. Toca cada pregunta para ver la respuesta.</p>' +
    D.impres.map((g, i) => "<h3 class='ih'>" + (i + 1) + " · " + esc(g.titulo) + "</h3>" + g.items.map(([p, r]) => '<details class="pq"><summary>' + esc(p) + '</summary><div class="pa"><p>' + r + "</p></div></details>").join("")).join("") + "</section>";
  const glos = new Map();
  for (const c of todos) for (const d of c.defs || []) if (!glos.has(d.t.toLowerCase())) glos.set(d.t.toLowerCase(), [d.t, d.facil]);
  const g = [...glos.values()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  if (g.length) h += '<section class="xs" id="glosario"><h2 class="xs-h">📖 Glosario (palabras importantes, por orden alfabético)</h2>' + tabla(["Término", "Qué significa"], g.map(([t, f]) => ["<strong>" + t + "</strong>", f])) + "</section>";
  return h;
}

function cajon() {
  const det = bloques.map((b) => '<details class="db"><summary><span class="dn">' + (b.i + 1) + '</span><span class="dt2">' + esc(b.titulo) + '</span><span class="dc" data-b="b' + b.i + '">0/' + b.conceptos.length + '</span></summary><a class="dbk" href="#b' + b.i + '">Ir al inicio del bloque</a>' +
    b.conceptos.map((c) => '<a class="dl i' + c.lv + '" href="#c' + c.n + '"><i></i>' + c.n + ". " + esc(c.titulo) + "</a>").join("") + "</details>").join("\n");
  const ex = [["trampas", "⚠️ Trampas típicas del examen"], ["numeros", "🔢 Números clave (apréndelos como una tabla de multiplicar)"], ["chequeo", "✅ Chequeo final (contesta sin mirar; si fallas una, vuelve a su bloque)"], ["impres", "⚡ Lo imprescindible"], ["glosario", "📖 Glosario (palabras importantes, por orden alfabético)"]]
    .filter(([id]) => id === "chequeo" || (id === "glosario" ? todos.some((c) => (c.defs || []).length) : (D[id] || []).length));
  return det + "\n\n" + (D.llave && D.llave.length ? '<a class="dl bll" href="#llave"><span class="dn">' + (bloques.length + 1) + "</span>🔑 Preguntas llave</a>\n" : "") +
    '<p class="dx">Extras</p>' + ex.map(([id, t]) => '<a class="dl" href="#' + id + '">' + t + "</a>").join("");
}

/* ---------- montaje sobre la plantilla ---------- */
let h = plantilla;
const cambia = (re, fn, que) => { if (!re.test(h)) throw new Error("La plantilla no tiene: " + que); h = h.replace(re, fn); };
cambia(/data-unit="[^"]*"/, 'data-unit="' + u + '"', "data-unit");
cambia(/<title>[^<]*<\/title>/, "<title>" + esc(D.titulo) + "</title>", "title");
const leyenda = [1, 2, 3].filter((lv) => cuenta(lv)).map((lv) => '<span class="tag lv' + lv + '">' + TAG[lv] + " · " + cuenta(lv) + "</span>").join("");
cambia(/<header class="top">[\s\S]*?<\/header><details class="how">/, () => '<header class="top"><p class="eyebrow">' + esc(D.eyebrow) + "</p>\n<h1>" + esc(D.h1) + '</h1>\n<p class="sub">' + esc(D.sub) + '</p>\n<div class="legend">' + leyenda + '</div></header><details class="how">', "cabecera");
cambia(/(<select id="toc"[^>]*><option value="">Ir a…<\/option>)[\s\S]*?(<\/select>)/, (m, a, b) => a + bloques.map((x) => '<option value="b' + x.i + '">Bloque ' + (x.i + 1) + " · " + esc(x.titulo) + "</option>").join("") +
  (D.llave && D.llave.length ? '<option value="llave">🔑 Preguntas llave</option>' : "") + b, "índice desplegable");
const sim = D.simulacro ? "../../" + D.simulacro : null;
cambia(/<a class="simlink" href="[^"]*">[\s\S]*?<\/a>/, () => sim ? '<a class="simlink" href="' + sim + '"><span>📝 Cuando acabes un bloque, ponte a prueba en el <b>Simulacro</b></span><span aria-hidden="true">→</span></a>' : "", "enlace al simulacro");
cambia(/<a class="dt sim" href="[^"]*">[^<]*<\/a>/, () => sim ? '<a class="dt sim" href="' + sim + '">📝 Simulacro</a>' : "", "simulacro del índice");
cambia(/<section class="blk" id="b0"[\s\S]*?(?=<section class="xs")/, () => bloques.map(bloque).join("\n") + "\n", "bloques");
cambia(/<section class="xs"[\s\S]*?(?=<div class="tpill")/, () => extras() + "\n", "secciones extra");
cambia(/<details class="db">[\s\S]*?(?=<\/div><\/aside>)/, () => cajon(), "índice lateral");
cambia(/const KEY="[^"]*"/, 'const KEY="' + D.clave + '"', "KEY");
cambia(/const EXAM=\{id:"[^"]*",em:"[^"]*",asig:"[^"]*",examen:"[^"]*",fecha:[^,]*,(horario:\[[^\]]*\]),repaso:"#",simulacro:[^,]*,/, (m, hor) =>
  "const EXAM={id:" + JSON.stringify(u) + ",em:" + JSON.stringify(D.examen.em) + ",asig:" + JSON.stringify(D.examen.asig) + ",examen:" + JSON.stringify(D.examen.examen) + ",fecha:" + JSON.stringify(D.examen.fecha || null) + "," + hor + ',repaso:"#",simulacro:' + JSON.stringify(sim) + ",", "EXAM");

const dest = path.join(RAIZ, u, "repaso", "index.html");
if (opt === "--comprobar") {
  const ok = fs.existsSync(dest) && fs.readFileSync(dest, "utf8") === h;
  console.log(u, ok ? "al día" : "DESACTUALIZADA");
  process.exit(ok ? 0 : 1);
}
fs.writeFileSync(dest, h);
console.log(u + "/repaso/index.html ·", todos.length, "conceptos ·", bloques.length, "bloques ·", Math.round(h.length / 1024), "KB");
