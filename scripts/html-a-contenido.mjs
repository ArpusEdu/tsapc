/* Enfoque · convierte un repaso escrito a mano (<u>/repaso/index.html) en el contenido.json del generador
   (scripts/repaso.mjs), sacando cada texto tal cual del HTML. No toca el index.html.
   Uso: node scripts/html-a-contenido.mjs <unidad…> [--salida <carpeta>] [--plantilla <html>] [--forzar]
        sin --salida escribe <u>/repaso/contenido.json (y no pisa uno que ya exista, salvo con --forzar);
        con --salida escribe <carpeta>/<u>.json.
        --plantilla: plantilla con la que se compara lo que no es contenido (tipografia, css, buscar, plan);
        por defecto scripts/plantilla-repaso.html. Los contenido.json de noviembre de 2026 se hicieron con la plantilla
        de antes del rediseño (la que genera bio3 idéntico).

   Qué se conserva, porque de ello depende el progreso guardado:
   - la clave de localStorage (const KEY) → "clave";
   - el id del examen (EXAM.id, que da la clave del plan «plan-estudio-v1-<id>») → "examen.id" si no es la carpeta;
   - el orden y la numeración de los conceptos (id="cN", data-n): el generador numera 1..N en orden; aquí se comprueba
     que la página original también lo hace (si no, se para) y cada concepto lleva su "n" de guarda.

   Cómo trabaja: lee cada pieza; si tiene exactamente la forma que pinta el generador, la guarda como dato; si no,
   la guarda como HTML literal en su sitio. Después vuelve a pintar cada concepto y cada sección con las funciones de
   abajo (las del generador más los campos nuevos) y solo acepta el dato si sale idéntico al original.

   Campos del formato que ya existen: ver la cabecera de scripts/repaso.mjs.
   Campos NUEVOS (todos opcionales: si faltan, se pinta lo de siempre). Todo «HTML» va literal, tal cual estaba:
   página
     examen.id        EXAM.id cuando no coincide con la carpeta (ing1, ipe5). Lo usa la clave del plan de estudio.
     examen.fecha     tal cual ("" o "2026-10-19"); ojo: hoy el generador escribe `fecha || null` y convierte "" en null.
     examen.horario   EXAM.horario si no es ["8:00","13:25"].
     eyebrowHtml, h1Html, subHtml   HTML cuando el original lleva etiquetas (el campo sin Html queda en texto llano).
     como             HTML interior de <details class="how"> («Cómo usar este repaso»): cada repaso a mano tiene el suyo.
     leyenda          HTML interior de <div class="legend"> si no es el que se calcula.
     etiquetas        textos de las etiquetas fijas de la unidad cuando no son los de siempre:
                      { defs, facil, diapo, no, prof, entiende, truco, q } (ver ETQ más abajo).
     tocBloque        palabra de las <option> del índice desplegable en vez de «Bloque» (fisio1: «Entrega»).
     toc, cajon       último recurso: HTML literal de las <option> (sin «Ir a…») / del interior de <div class="drw-l">.
     extras           lista ordenada de lo que va después de los bloques (sustituye al orden fijo de hoy):
                      "empty" (el <p id="empty">) | id de sección generada ("llave" "trampas" "numeros" "chequeo"
                      "impres" "glosario") | objeto { id, … } con:
                        html     el <section> entero literal (secciones propias: hoja, x1, nave…);
                        titulo   HTML del <h2 class="xs-h"> si no es el de siempre;
                        intro    HTML entre el <h2> y el contenido si no es el de siempre ("" = nada);
                        cab      cabeceras de la tabla (trampas, numeros, glosario) si no son las de siempre;
                        fin      HTML después del contenido, dentro del <section>;
                        opcion   texto de su <option> en el índice desplegable (sin él, no sale);
                        indice   HTML del enlace en el índice lateral, bajo «Extras» (sin él, no sale);
                        arriba   HTML del enlace entero que va en el índice lateral ANTES de «Extras» (llave).
                      Con "extras", el desplegable y el lateral se montan solo con opcion/indice/arriba.
     tipografia       familia de Google Fonts de los títulos (lo que va tras css2?family=, hasta el primer &).
     css              reglas CSS de la unidad que no están en la plantilla, una por línea (p. ej. #nave, .dl.b10).
     buscar           [[selector, etiqueta]]: secciones cuyas .pq entran en el buscador, con su etiqueta
                      (document.querySelectorAll("<selector> .pq").forEach(d=>add(d,"<etiqueta>",…))).
     plan             textos propios del plan de estudio: { repaso: código JS literal del array REVIEW,
                      unDia: HTML del aviso «Con 1 solo día…», ultimoDia: [tras el rango, sin rango] del último día }.
     chequeo          [HTML de cada <li>] cuando el chequeo está escrito a mano (si no, sale de las preguntas).
     glosario         [[término, significado]] cuando el glosario está escrito a mano (si no, sale de las definiciones).
   bloque
     tituloHtml       HTML literal del título si lleva etiquetas.
     bn               texto de <span class="bn"> si no es «BLOQUE n».
     min              data-min (y minutos) si no es el que se calcula.
     bc               HTML interior de <span class="bc"> si no es el que se calcula (con min ya aplicado).
     antes, despues   HTML literal antes del primer concepto / después del último, dentro del <section>.
   concepto
     n                número del concepto (1..N en orden). El generador numera solo; es una guarda
                      (tests/contenido.test.mjs lo compara con data-n del index.html).
     tituloHtml       HTML del <h3> si lleva etiquetas (p. ej. <span class="note">); "titulo" queda sin la nota.
     qHtml            HTML de la pregunta si lleva etiquetas; "q" queda en texto llano.
     nota             HTML literal entre </header> y <div class="c-meta">.
     meta             HTML interior de <div class="c-meta"> si no es tag + «📍 fuente».
     defs[].no        HTML de <div class="fd no"> («⚠️ La diapositiva no la define»).
     imgs[].cap       HTML de <figcaption> si no es el alt; imgs[].w / .h si el ancho/alto del HTML no es el del JPEG;
     imgs[].img       la etiqueta <img> literal si no es la que pinta el generador (p. ej. atributos repetidos).
     extra            [{ tras, html }]: piezas literales del cuerpo que el formato no tiene, en su sitio.
                      tras = "inicio" | "defs" | "prof" | "imgs" | "entiende" | "truco" | "q"
                      (van justo después de esa pieza, en el orden en que aparecen).
     html             último recurso: el <article> entero literal. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- utilidades de HTML ---------- */
export const desesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* fin (índice tras el cierre) del elemento que abre en i, contando anidamiento de la misma etiqueta */
export function fin(h, i) {
  const tag = /^<([a-zA-Z0-9]+)/.exec(h.slice(i, i + 20))[1].toLowerCase();
  if (["img", "br", "hr", "input", "meta", "link", "source", "wbr"].includes(tag)) return h.indexOf(">", i) + 1;
  const re = new RegExp("<(/?)" + tag + "(?=[\\s>/])[^>]*>", "gi");
  re.lastIndex = i;
  let d = 0, m;
  while ((m = re.exec(h))) {
    if (m[1]) { if (--d === 0) return m.index + m[0].length; }
    else if (!m[0].endsWith("/>")) d++;
  }
  throw new Error("Etiqueta <" + tag + "> sin cerrar en " + i);
}
/* hijos de primer nivel de un trozo de HTML: [{tipo:"el"|"txt", html, tag, cls, abre}] (sin los textos en blanco) */
export function hijos(h) {
  const out = [];
  let i = 0;
  while (i < h.length) {
    const j = h.indexOf("<", i);
    if (j < 0) { out.push({ tipo: "txt", html: h.slice(i) }); break; }
    if (j > i) out.push({ tipo: "txt", html: h.slice(i, j) });
    if (h.startsWith("<!--", j)) { const k = h.indexOf("-->", j) + 3; out.push({ tipo: "txt", html: h.slice(j, k) }); i = k; continue; }
    const k = fin(h, j);
    const ab = h.slice(j, h.indexOf(">", j) + 1);
    out.push({ tipo: "el", html: h.slice(j, k), tag: /^<(\w+)/.exec(ab)[1].toLowerCase(), cls: (/class="([^"]*)"/.exec(ab) || [, ""])[1], abre: ab });
    i = k;
  }
  return out.filter((x) => x.tipo === "el" || x.html.trim());
}
/* campo de texto que el generador escapa: si el original lleva etiquetas, se guarda también <campo>Html, literal,
   y <campo> queda como texto llano (sin la <span class="note">) para quien lo lea desde fuera */
export function campo(o, k, html) {
  if (/<[a-zA-Z]/.test(html)) { o[k] = desesc(html.replace(/<span class="note">[\s\S]*?<\/span>/g, "").replace(/<[^>]+>/g, "")).trim(); o[k + "Html"] = html; }
  else o[k] = desesc(html);
}
const H = (o, k) => (o[k + "Html"] != null ? o[k + "Html"] : esc(o[k]));
const interior = (el) => el.slice(el.indexOf(">") + 1, el.lastIndexOf("</"));
/* compara HTML sin fijarse en los espacios entre etiquetas ni en los saltos de línea */
export const plano = (s) => s.replace(/\s+/g, " ").replace(/> </g, "><").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

/* ---------- lo que pinta el generador (copia de scripts/repaso.mjs, con los campos nuevos) ---------- */
const TAG = { 1: "🔴 IMPRESCINDIBLE", 2: "🟠 IMPORTANTE", 3: "🔵 LEER UNA VEZ" };
const MIN = { 1: 9, 2: 6, 3: 3 };
export const ETQ = { defs: "📘 Qué significa cada palabra", facil: "💡 Para entenderlo", diapo: "📌 Definición de la diapositiva · la del examen", no: "⚠️ La diapositiva no la define",
  prof: "📋 Lo que dice la profe", entiende: "💡 Entiéndelo", truco: "🧠 Truco para recordarlo", q: "❓ Ponte a prueba" };
export const etiquetas = (D) => ({ ...ETQ, ...(D.etiquetas || {}) });

export function medidaJpeg(f) {
  if (!fs.existsSync(f)) return null;
  const b = fs.readFileSync(f);
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
}

function pintaDefs(c, E) {
  return (c.defs || []).length
    ? '<div class="defs"><p class="lbl">' + E.defs + "</p><ul>" + c.defs.map((d) =>
        '<li><b class="term">' + d.t + '</b><div class="fd easy"><span class="fl">' + E.facil + "</span>" + d.facil + "</div>" +
        (d.diapo ? '<div class="fd ok"><span class="fl">' + E.diapo + "</span>«" + d.diapo + (d.n ? " (diap. " + d.n + ")" : "") + "»</div>" : "") +
        (d.no != null ? '<div class="fd no"><span class="fl">' + E.no + "</span>" + d.no + "</div>" : "") + "</li>").join("") + "</ul></div>\n"
    : "";
}
const etiquetaImg = (f, w, hh) => '<img src="' + f.src + '" width="' + w + '" height="' + hh + '" loading="lazy" decoding="async" alt="' + esc(f.alt) + '">';
const figura = (f, med) => { const [w, hh] = f.w ? [f.w, f.h] : med(f.src); return "<figure>" + (f.img != null ? f.img : etiquetaImg(f, w, hh)) + "<figcaption>" + (f.cap != null ? f.cap : esc(f.alt)) + "</figcaption></figure>\n"; };

export function pintaConcepto(c, med, E = ETQ) {
  if (c.html) return c.html + "\n";
  const ex = (t) => (c.extra || []).filter((x) => x.tras === t).map((x) => x.html + "\n").join("");
  const meta = c.meta != null ? c.meta : '<span class="tag lv' + c.lv + '">' + TAG[c.lv] + '</span><span class="srcl">📍 ' + esc(c.fuente) + "</span>";
  return '<article class="cpt lv' + c.lv + '" id="c' + c.n + '" data-lv="' + c.lv + '">\n' +
    '<header class="c-h"><span class="c-n">' + c.n + "</span><h3>" + H(c, "titulo") + "</h3></header>\n" + (c.nota ? c.nota + "\n" : "") +
    '<div class="c-meta">' + meta + "</div>\n" +
    '<div class="c-body">\n' + ex("inicio") + pintaDefs(c, E) + ex("defs") +
    (c.prof != null ? '<p class="lbl prof">' + E.prof + '</p>\n<div class="prof-t">' + c.prof + "</div>\n" : "") + ex("prof") +
    (c.imgs || []).map((f) => figura(f, med)).join("") + ex("imgs") +
    (c.entiende ? '<div class="box und"><p class="lbl">' + E.entiende + "</p><p>" + c.entiende + "</p></div>\n" : "") + ex("entiende") +
    (c.truco ? '<div class="box tip"><p class="lbl">' + E.truco + "</p><p>" + c.truco + "</p></div>\n" : "") + ex("truco") +
    (c.q != null ? '<div class="box q"><p class="lbl">' + E.q + '</p><p class="qt">' + H(c, "q") + '</p><label class="dom"><input type="checkbox" data-n="' + c.n + '"> Lo domino</label></div>\n' : "") + ex("q") +
    "</div></article>\n";
}
export const minBloque = (b) => b.conceptos.reduce((s, c) => s + MIN[c.lv], 0) + 4;
export const bcBloque = (b, min) => { const cs = b.conceptos; return "⏱ " + min + " min · Conceptos " + cs[0].n + "–" + cs[cs.length - 1].n + " · " + cs.filter((c) => c.lv === 1).length + ' 🔴 · <b class="bd">0</b>/' + cs.length + " dominados"; };
const tabla = (cab, filas) => '<div class="tw"><table><thead><tr>' + cab.map((x) => "<th>" + x + "</th>").join("") + "</tr></thead><tbody>" +
  filas.map((f) => "<tr>" + f.map((x) => "<td>" + x + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";

/* secciones de después de los bloques: lo de siempre, con titulo / intro / cab / fin cambiables */
const SEC = {
  llave: { titulo: (nb) => "🔑 Bloque " + (nb + 1) + " · Preguntas llave", intro: '<p>Candidatas elegidas por lo que más destacan las diapositivas, de más a menos probable. <strong>No son preguntas confirmadas por la profe.</strong> Escríbelas de memoria al menos una vez.</p>' },
  trampas: { titulo: "⚠️ Trampas típicas del examen", intro: "", cab: ["No confundas…", "…con…", "Cómo diferenciarlos"] },
  numeros: { titulo: "🔢 Números clave (apréndelos como una tabla de multiplicar)", intro: "", cab: ["Número", "Qué es"] },
  chequeo: { titulo: "✅ Chequeo final (contesta sin mirar; si fallas una, vuelve a su bloque)", intro: "" },
  impres: { titulo: "⚡ Lo imprescindible (repaso exprés)", intro: '<p class="meta">Pregunta directa → respuesta corta. Toca cada pregunta para ver la respuesta.</p>' },
  glosario: { titulo: "📖 Glosario (palabras importantes, por orden alfabético)", intro: "", cab: ["Término", "Qué significa"] },
};
const def = (id, k, nb) => { const v = SEC[id][k]; return typeof v === "function" ? v(nb) : v; };
function glosarioAuto(todos) {
  const glos = new Map();
  for (const c of todos) for (const d of c.defs || []) if (!glos.has(d.t.toLowerCase())) glos.set(d.t.toLowerCase(), [d.t, d.facil]);
  return [...glos.values()].sort((a, b) => a[0].localeCompare(b[0], "es"));
}
export function pintaSeccion(x, D, bloques, todos) {
  const id = typeof x === "string" ? x : x.id;
  if (typeof x === "object" && x.html != null) return x.html;
  if (id === "empty") return '<p class="empty" id="empty" hidden>No hay conceptos con ese filtro o esa búsqueda.</p>';
  if (!SEC[id]) throw new Error("Sección desconocida sin html: " + id);
  const o = typeof x === "object" ? x : {};
  const val = (k) => (o[k] !== undefined ? o[k] : def(id, k, bloques.length));
  let cuerpo;
  if (id === "llave") cuerpo = D.llave.map((p, i) => '<details class="pq"><summary><span class="pn">🔑 ' + (i + 1) + "</span> " + esc(p.q) + '</summary><div class="pa"><p><em>Por qué:</em> ' + esc(p.porque) + "</p><p><strong>Respuesta modelo:</strong></p><p>" + p.resp + "</p></div></details>").join("");
  if (id === "trampas") cuerpo = tabla(val("cab"), D.trampas);
  if (id === "numeros") cuerpo = tabla(val("cab"), D.numeros.map(([a, b]) => ["<strong>" + a + "</strong>", b]));
  if (id === "chequeo") cuerpo = "<ol>" + (D.chequeo ? D.chequeo.map((li) => "<li>" + li + "</li>")
    : bloques.map((b) => { const c = b.conceptos.find((x) => x.lv === 1) || b.conceptos[0]; return "<li>" + H(c, "q") + " (Bloque " + (b.i + 1) + ")</li>"; })).join("") + "</ol>";
  if (id === "impres") cuerpo = D.impres.map((g, i) => "<h3 class='ih'>" + (i + 1) + " · " + esc(g.titulo) + "</h3>" + g.items.map(([p, r]) => '<details class="pq"><summary>' + esc(p) + '</summary><div class="pa"><p>' + r + "</p></div></details>").join("")).join("");
  if (id === "glosario") {
    const g = D.glosario || glosarioAuto(todos);
    if (!g.length) return "";
    cuerpo = tabla(val("cab"), g.map(([t, f]) => ["<strong>" + t + "</strong>", f]));
  }
  return '<section class="xs" id="' + id + '"><h2 class="xs-h">' + val("titulo") + "</h2>" + val("intro") + cuerpo + (o.fin || "") + "</section>";
}
/* lo que va tras los bloques cuando no hay "extras": el orden fijo de hoy */
export const extrasPorDefecto = (D, todos) => [D.llave && D.llave.length && "llave", "empty", D.trampas && D.trampas.length && "trampas", D.numeros && D.numeros.length && "numeros", "chequeo",
  D.impres && D.impres.length && "impres", (D.glosario ? D.glosario.length : todos.some((c) => (c.defs || []).length)) && "glosario"].filter(Boolean);

export function pintaToc(D, bloques) {
  if (D.toc != null) return D.toc;
  const pal = D.tocBloque || "Bloque";
  return bloques.map((x) => '<option value="b' + x.i + '">' + pal + " " + (x.i + 1) + " · " + esc(x.titulo) + "</option>").join("") +
    (D.extras ? D.extras.filter((e) => typeof e === "object" && e.opcion != null).map((e) => '<option value="' + e.id + '">' + e.opcion + "</option>").join("")
      : D.llave && D.llave.length ? '<option value="llave">🔑 Preguntas llave</option>' : "");
}
const TXT_EXTRA = { trampas: "⚠️ Trampas típicas del examen", numeros: "🔢 Números clave (apréndelos como una tabla de multiplicar)", chequeo: "✅ Chequeo final (contesta sin mirar; si fallas una, vuelve a su bloque)", impres: "⚡ Lo imprescindible", glosario: "📖 Glosario (palabras importantes, por orden alfabético)" };
export function pintaCajonBloques(bloques) {
  return bloques.map((b) => '<details class="db"><summary><span class="dn">' + (b.i + 1) + '</span><span class="dt2">' + esc(b.titulo) + '</span><span class="dc" data-b="b' + b.i + '">0/' + b.conceptos.length + '</span></summary><a class="dbk" href="#b' + b.i + '">Ir al inicio del bloque</a>' +
    b.conceptos.map((c) => '<a class="dl i' + c.lv + '" href="#c' + c.n + '"><i></i>' + c.n + ". " + esc(c.titulo) + "</a>").join("") + "</details>").join("\n");
}
export function pintaCajon(D, bloques) {
  if (D.cajon != null) return D.cajon;
  const det = pintaCajonBloques(bloques);
  if (D.extras) {
    const es = D.extras.filter((e) => typeof e === "object");
    return det + "\n\n" + es.filter((e) => e.arriba != null).map((e) => e.arriba + "\n").join("") + '<p class="dx">Extras</p>' +
      es.filter((e) => e.indice != null).map((e) => '<a class="dl" href="#' + e.id + '">' + e.indice + "</a>").join("");
  }
  const todos = bloques.flatMap((b) => b.conceptos);
  const ex = Object.entries(TXT_EXTRA).filter(([id]) => id === "chequeo" || (id === "glosario" ? todos.some((c) => (c.defs || []).length) : (D[id] || []).length));
  return det + "\n\n" + (D.llave && D.llave.length ? '<a class="dl bll" href="#llave"><span class="dn">' + (bloques.length + 1) + "</span>🔑 Preguntas llave</a>\n" : "") +
    '<p class="dx">Extras</p>' + ex.map(([id, t]) => '<a class="dl" href="#' + id + '">' + t + "</a>").join("");
}

/* ---------- lectura de un concepto ---------- */
function leeDefs(el, E) {
  const hs = hijos(interior(el));
  if (hs.length !== 2 || hs[0].html !== '<p class="lbl">' + E.defs + "</p>" || hs[1].tag !== "ul" || hs[1].abre !== "<ul>") return null;
  const defs = [];
  for (const li of hijos(interior(hs[1].html))) {
    if (li.tag !== "li" || li.abre !== "<li>") return null;
    const ps = hijos(interior(li.html));
    const t = ps[0] && /^<b class="term">([\s\S]*)<\/b>$/.exec(ps[0].html);
    if (!t) return null;
    const d = { t: t[1] };
    const fd = (p, cls, lbl) => { if (!p || p.abre !== '<div class="fd ' + cls + '">') return null; const r = '<span class="fl">' + lbl + "</span>", x = interior(p.html); return x.startsWith(r) ? x.slice(r.length) : null; };
    let k = 1;
    const f = fd(ps[k], "easy", E.facil);
    if (f == null) return null;
    d.facil = f; k++;
    const ok = fd(ps[k], "ok", E.diapo);
    if (ok != null) {
      const m = /^«([\s\S]*?)(?: \(diap\. (\d+)\))?»$/.exec(ok);
      if (!m || !m[1]) return null;
      d.diapo = m[1]; if (m[2]) d.n = +m[2];
      k++;
    }
    const no = fd(ps[k], "no", E.no);
    if (no != null) { d.no = no; k++; }
    if (k !== ps.length) return null;
    defs.push(d);
  }
  return defs.length ? defs : null;
}
function leeCaja(el, cls, lbl) {
  if (el.tag !== "div" || el.abre !== '<div class="box ' + cls + '">') return null;
  const hs = hijos(interior(el.html));
  if (hs.length !== 2 || hs[0].html !== '<p class="lbl">' + lbl + "</p>" || hs[1].tag !== "p" || hs[1].abre !== "<p>") return null;
  const t = interior(hs[1].html);
  return t ? t : null;
}
function leeFigura(el) {
  if (el.tag !== "figure" || el.abre !== "<figure>") return null;
  const hs = hijos(interior(el.html));
  if (hs.length !== 2 || hs[0].tag !== "img" || hs[1].tag !== "figcaption" || hs[1].abre !== "<figcaption>") return null;
  const a = (n) => { const m = new RegExp("\\s" + n + '="([^"]*)"').exec(hs[0].html); return m ? m[1] : null; };
  const src = a("src"), alt = a("alt");
  if (src == null || alt == null) return null;
  return { src, alt: desesc(alt), w: +a("width") || null, h: +a("height") || null, cap: interior(hs[1].html), img: hs[0].html };
}

const ORDEN = ["inicio", "defs", "prof", "imgs", "entiende", "truco", "q"];

function leeConcepto(art, n, carpeta, E) {
  const ab = art.slice(0, art.indexOf(">") + 1);
  const lvC = +(/class="cpt lv(\d)"/.exec(ab) || [])[1], lv = +(/data-lv="(\d)"/.exec(ab) || [])[1];
  const literal = (por) => { const c = { lv }; campo(c, "titulo", (/<h3>([\s\S]*?)<\/h3>/.exec(art) || [, ""])[1]); c.html = art; c._aviso = "concepto entero literal (" + por + ")"; return c; };
  const c = { titulo: null, lv, fuente: null };
  const hs = hijos(interior(art));
  let k = 0;
  const h3 = hs[k] && hs[k].tag === "header" ? /^<header class="c-h"><span class="c-n">(\d+)<\/span><h3>([\s\S]*?)<\/h3><\/header>$/.exec(hs[k].html) : null;
  if (!h3 || +h3[1] !== n || lvC !== lv || !lv || ab !== '<article class="cpt lv' + lv + '" id="c' + n + '" data-lv="' + lv + '">') return literal("cabecera fuera de formato");
  campo(c, "titulo", h3[2]); k++;
  const notas = [];
  while (hs[k] && !(hs[k].tag === "div" && hs[k].cls === "c-meta")) notas.push(hs[k++].html);
  if (notas.length) c.nota = notas.join("\n");
  const meta = hs[k++];
  const mm = meta && /^<div class="c-meta"><span class="tag lv(\d)">([^<]*)<\/span><span class="srcl">📍 ([^<]*)<\/span><\/div>$/.exec(meta.html);
  if (mm && +mm[1] === lv && mm[2] === TAG[lv]) c.fuente = desesc(mm[3]);
  else { c.fuente = meta ? desesc(meta.html.replace(/<[^>]+>/g, "")).replace(/^[\s\S]*?📍\s*/, "") : ""; c.meta = meta ? interior(meta.html) : ""; }
  const body = hs[k++];
  if (!body || body.abre !== '<div class="c-body">' || k !== hs.length) return literal("cuerpo fuera de formato");
  const bs = hijos(interior(body.html));
  let pos = 0, ultimo = "inicio";
  const extra = [];
  const toma = (p) => { const i = ORDEN.indexOf(p); if (i < pos) return false; pos = i; ultimo = p; return true; };
  for (let i = 0; i < bs.length; i++) {
    const el = bs[i];
    let hecho = false;
    if (el.tipo === "el") {
      if (el.cls === "defs" && !c.defs && pos <= 0) { const d = leeDefs(el.html, E); if (d && toma("defs")) { c.defs = d; hecho = true; } }
      else if (el.html === '<p class="lbl prof">' + E.prof + "</p>" && c.prof == null && pos <= 1 && bs[i + 1] && bs[i + 1].abre === '<div class="prof-t">') {
        if (toma("prof")) { c.prof = interior(bs[i + 1].html); i++; hecho = true; }
      } else if (el.tag === "figure" && (pos < 3 || ultimo === "imgs")) {
        const f = leeFigura(el);
        if (f && toma("imgs")) {
          const med = medidaJpeg(path.join(carpeta, f.src));
          const img = { src: f.src, alt: f.alt };
          if (f.cap !== esc(f.alt)) img.cap = f.cap;
          if (!med || med[0] !== f.w || med[1] !== f.h) { img.w = f.w; img.h = f.h; }
          if (f.img !== etiquetaImg(img, f.w, f.h)) img.img = f.img;
          (c.imgs = c.imgs || []).push(img); hecho = true;
        }
      } else if (el.cls === "box und" && !c.entiende && pos < 4) { const t = leeCaja(el, "und", E.entiende); if (t && toma("entiende")) { c.entiende = t; hecho = true; } }
      else if (el.cls === "box tip" && !c.truco && pos < 5) { const t = leeCaja(el, "tip", E.truco); if (t && toma("truco")) { c.truco = t; hecho = true; } }
      else if (el.cls === "box q" && c.q == null && pos < 6) {
        const r = '<div class="box q"><p class="lbl">' + E.q + '</p><p class="qt">';
        const m = el.html.startsWith(r) && /^([\s\S]*?)<\/p><label class="dom"><input type="checkbox" data-n="(\d+)"> Lo domino<\/label><\/div>$/.exec(el.html.slice(r.length));
        if (m && +m[2] === n && toma("q")) { campo(c, "q", m[1]); hecho = true; }
      }
    }
    if (!hecho) extra.push({ tras: ultimo, html: el.html });
  }
  if (extra.length) c.extra = extra;
  return c;
}

/* etiqueta fija más usada en la unidad (si no es la de siempre, va a "etiquetas") */
function etiquetasDe(h) {
  const RE = { defs: /<div class="defs"><p class="lbl">([^<]*)<\/p>/g, facil: /<div class="fd easy"><span class="fl">([^<]*)<\/span>/g, diapo: /<div class="fd ok"><span class="fl">([^<]*)<\/span>/g,
    no: /<div class="fd no"><span class="fl">([^<]*)<\/span>/g, prof: /<p class="lbl prof">([^<]*)<\/p>/g, entiende: /<div class="box und"><p class="lbl">([^<]*)<\/p>/g,
    truco: /<div class="box tip"><p class="lbl">([^<]*)<\/p>/g, q: /<div class="box q"><p class="lbl">([^<]*)<\/p>/g };
  const out = {};
  for (const [k, re] of Object.entries(RE)) {
    const n = new Map();
    for (const m of h.matchAll(re)) n.set(m[1], (n.get(m[1]) || 0) + 1);
    const top = [...n].sort((a, b) => b[1] - a[1])[0];
    if (top && top[0] !== ETQ[k]) out[k] = top[0];
  }
  return out;
}

/* lee una sección conocida con su forma; devuelve { datos, sobre } o null */
export function leeSeccion(id, html, bloques) {
  const hs = hijos(interior(html));
  if (!hs[0] || hs[0].abre !== '<h2 class="xs-h">') return null;
  const titulo = interior(hs[0].html), resto = hs.slice(1);
  let a, b, datos, cabT;
  /* <div class="tw"><table><thead><tr><th>…</th></tr></thead><tbody><tr><td>…</td></tr>…</tbody></table></div> */
  const leeTabla = (tw) => {
    const t = hijos(interior(tw));
    if (t.length !== 1 || t[0].abre !== "<table>") return null;
    const p = hijos(interior(t[0].html));
    if (p.length !== 2 || p[0].abre !== "<thead>" || p[1].abre !== "<tbody>") return null;
    const trh = hijos(interior(p[0].html));
    if (trh.length !== 1 || trh[0].abre !== "<tr>") return null;
    const celdas = (tr, tag) => hijos(interior(tr)).map((x) => (x.abre === "<" + tag + ">" ? interior(x.html) : null));
    const cab = celdas(trh[0].html, "th");
    const filas = hijos(interior(p[1].html)).map((tr) => (tr.abre === "<tr>" ? celdas(tr.html, "td") : null));
    if (cab.includes(null) || filas.some((f) => !f || f.includes(null))) return null;
    return { cab, filas };
  };
  if (["trampas", "numeros", "glosario"].includes(id)) {
    a = resto.findIndex((x) => x.abre === '<div class="tw">'); b = a;
    if (a < 0 || resto.slice(a + 1).some((x) => x.abre === '<div class="tw">')) return null;
    const t = leeTabla(resto[a].html);
    if (!t) return null;
    const { cab, filas } = t;
    cabT = cab;
    if (id === "trampas") datos = filas;
    else {
      if (filas.some((f) => f.length !== 2 || !/^<strong>[\s\S]*<\/strong>$/.test(f[0]) || /<\/strong>[\s\S]*<strong>/.test(f[0]))) return null;
      datos = filas.map(([x, y]) => [x.slice(8, -9), y]);
    }
  } else if (id === "chequeo") {
    a = resto.findIndex((x) => x.tag === "ol"); b = a;
    if (a < 0 || resto[a].abre !== "<ol>") return null;
    const lis = hijos(interior(resto[a].html));
    if (lis.some((x) => x.abre !== "<li>")) return null;
    datos = lis.map((x) => interior(x.html));
  } else if (id === "llave" || id === "impres") {
    a = resto.findIndex((x) => x.abre === '<details class="pq">' || (id === "impres" && /^<h3 class=['"]ih['"]>$/.test(x.abre)));
    if (a < 0) return null;
    b = a; while (b + 1 < resto.length && (resto[b + 1].abre === '<details class="pq">' || (id === "impres" && /^<h3 class=['"]ih['"]>$/.test(resto[b + 1].abre)))) b++;
    const piezas = resto.slice(a, b + 1);
    if (id === "llave") {
      datos = [];
      for (const [i, p] of piezas.entries()) {
        const m = /^<details class="pq"><summary><span class="pn">🔑 (\d+)<\/span> ([^<]*)<\/summary><div class="pa"><p><em>Por qué:<\/em> ([^<]*)<\/p><p><strong>Respuesta modelo:<\/strong><\/p><p>([\s\S]*)<\/p><\/div><\/details>$/.exec(p.html);
        if (!m || +m[1] !== i + 1 || m[4].includes("</p>")) return null;
        datos.push({ q: desesc(m[2]), porque: desesc(m[3]), resp: m[4] });
      }
    } else {
      datos = [];
      for (const p of piezas) {
        if (p.tag === "h3") {
          const m = /^<h3 class=['"]ih['"]>(\d+) · ([^<]*)<\/h3>$/.exec(p.html);
          if (!m || +m[1] !== datos.length + 1) return null;
          datos.push({ titulo: desesc(m[2]), items: [] });
        } else {
          const m = /^<details class="pq"><summary>([^<]*)<\/summary><div class="pa"><p>([\s\S]*)<\/p><\/div><\/details>$/.exec(p.html);
          if (!m || !datos.length || m[2].includes("</p>")) return null;
          datos[datos.length - 1].items.push([desesc(m[1]), m[2]]);
        }
      }
    }
  } else return null;
  const sobre = {};
  const intro = resto.slice(0, a).map((x) => x.html).join(""), fin = resto.slice(b + 1).map((x) => x.html).join("");
  if (titulo !== def(id, "titulo", bloques.length)) sobre.titulo = titulo;
  if (intro !== def(id, "intro", bloques.length)) sobre.intro = intro;
  if (fin) sobre.fin = fin;
  if (cabT && JSON.stringify(cabT) !== JSON.stringify(SEC[id].cab)) sobre.cab = cabT;
  return { datos, sobre };
}

/* ---------- la página ---------- */
/* lo propio de la unidad fuera del contenido: tipografía de títulos, reglas CSS que no están en la plantilla,
   secciones que entran en el buscador y textos del plan de estudio. Se compara con la plantilla de referencia. */
const RE_BUSCA = /document\.querySelectorAll\("([^"]+) \.pq"\)\.forEach\(d=>add\(d,"([^"]*)",d\.querySelector\("summary"\)\.textContent,txt\(d\)\)\)/g;
const RE_REVIEW = /const REVIEW=(\[[\s\S]*?\}\s*\]);/;
const RE_UNDIA = /else if\(N===1\)msg\.innerHTML=`<p class="note warn">([\s\S]*?)<\/p>`/;
const RE_FINAL = /\(rng\?rng\+"([^"]*)":"([^"]*)"\):rng/;
const RE_FUENTE = /fonts\.googleapis\.com\/css2\?family=([^&"]*)&/;
/* reglas de primer nivel de un CSS, respetando las llaves; las de @media se abren en "@media X{regla}" una a una */
function reglas(css) {
  const out = [];
  let d = 0, ini = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") d++;
    else if (css[i] === "}" && --d === 0) { out.push(css.slice(ini, i + 1).trim()); ini = i + 1; }
  }
  return out.flatMap((r) => {
    const m = /^(@media[^{]*)\{([\s\S]*)\}$/.exec(r);
    return m ? reglas(m[2]).map((x) => m[1].trim() + "{" + x + "}") : [r];
  });
}
const reglasCss = (h) => [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].flatMap((m) => reglas(m[1].replace(/\s+/g, " ")));
export function pagina(h, P) {
  const o = {};
  if (!P) return o;
  const f = RE_FUENTE.exec(h), fp = RE_FUENTE.exec(P);
  if (f && fp && f[1] !== fp[1]) o.tipografia = f[1];
  const rp = new Set(reglasCss(P));
  /* sin la zona de contenido: un <style> dentro de una sección ya va en su HTML literal */
  const i = h.indexOf('<section class="blk" id="b0"'), j = h.indexOf('<div class="tpill"', i);
  const fuera = i >= 0 && j > i ? h.slice(0, i) + h.slice(j) : h;
  const css = [...new Set(reglasCss(fuera))].filter((r) => !rp.has(r));
  if (css.length) o.css = css.join("\n");
  const b = [...h.matchAll(RE_BUSCA)].map((m) => [m[1], m[2]]), bp = [...P.matchAll(RE_BUSCA)].map((m) => [m[1], m[2]]);
  if (JSON.stringify(b) !== JSON.stringify(bp)) o.buscar = b;
  const plan = {};
  const r = RE_REVIEW.exec(h), rpv = RE_REVIEW.exec(P);
  if (r && rpv && r[1] !== rpv[1]) plan.repaso = r[1];
  const d = RE_UNDIA.exec(h), dp = RE_UNDIA.exec(P);
  if (d && dp && d[1] !== dp[1]) plan.unDia = d[1];
  const fi = RE_FINAL.exec(h), fip = RE_FINAL.exec(P);
  if (fi && fip && (fi[1] !== fip[1] || fi[2] !== fip[2])) plan.ultimoDia = [fi[1], fi[2]];
  if (Object.keys(plan).length) o.plan = plan;
  return o;
}

let plantillaRef = null;
export const usaPlantilla = (txt) => { plantillaRef = txt; };

export function convertir(h, u) {
  const carpeta = path.join(RAIZ, u, "repaso");
  const avisos = [];
  const D = { unidad: u };
  D.titulo = desesc(/<title>([^<]*)<\/title>/.exec(h)[1]);
  const top = /<header class="top"><p class="eyebrow">([\s\S]*?)<\/p>\n<h1>([\s\S]*?)<\/h1>\n<p class="sub">([\s\S]*?)<\/p>\n<div class="legend">([\s\S]*?)<\/div><\/header><details class="how">/.exec(h);
  if (!top) throw new Error(u + ": cabecera fuera de formato");
  campo(D, "eyebrow", top[1]); campo(D, "h1", top[2]); campo(D, "sub", top[3]);
  const legendaOrig = top[4];
  /* «Cómo usar este repaso»: en los repasos escritos a mano cada unidad tiene el suyo */
  const ih = h.indexOf('<details class="how">', top.index);
  D.como = interior(h.slice(ih, fin(h, ih)));
  D.clave = /const KEY="([^"]*)"/.exec(h)[1];
  const ex = /const EXAM=\{id:("[^"]*"),em:("[^"]*"),asig:("[^"]*"),examen:("[^"]*"),fecha:([^,]*),horario:(\[[^\]]*\]),repaso:"#",simulacro:([^,]*),/.exec(h);
  if (!ex) throw new Error(u + ": EXAM fuera de formato");
  const [id, em, asig, examen, fecha, horario, sim] = ex.slice(1).map((x) => JSON.parse(x));
  D.examen = { em, asig, examen, fecha };
  if (id !== u) D.examen.id = id;
  if (JSON.stringify(horario) !== JSON.stringify(["8:00", "13:25"])) D.examen.horario = horario;
  if (sim && !sim.startsWith("../../")) throw new Error(u + ": simulacro con ruta rara " + sim);
  D.simulacro = sim ? sim.slice(6) : null;
  const simlink = /<a class="simlink" href="([^"]*)">/.exec(h), simdt = /<a class="dt sim" href="([^"]*)">/.exec(h);
  if ((simlink && simlink[1] !== sim) || (simdt && simdt[1] !== sim)) avisos.push("los enlaces al simulacro no apuntan a EXAM.simulacro");
  Object.assign(D, pagina(h, plantillaRef));
  const E0 = etiquetasDe(h);
  if (Object.keys(E0).length) D.etiquetas = E0;
  const E = etiquetas(D);

  /* bloques: de b0 hasta <div class="tpill">; primero los bloques, lo que sigue son las secciones extra */
  const ini = h.indexOf('<section class="blk" id="b0"');
  const ftp = h.indexOf('<div class="tpill"', ini);
  const secs = hijos(h.slice(ini, ftp));
  D.bloques = [];
  let n = 0;
  const xs = [];
  for (const s of secs) {
    if (s.abre !== '<section class="blk" id="b' + D.bloques.length + '" data-min="' + (/data-min="(\d+)"/.exec(s.abre || "") || [])[1] + '">') { xs.push(s); continue; }
    if (xs.length) throw new Error(u + ": HTML entre bloques: " + xs[0].html.slice(0, 80));
    const i = D.bloques.length;
    const m = /^<section class="blk" id="b(\d+)" data-min="(\d+)"><h2 class="blk-h"><span class="bn">([^<]*)<\/span><span class="bt">([\s\S]*?)<\/span><span class="bc">([\s\S]*?)<\/span><\/h2>/.exec(s.html);
    if (!m) throw new Error(u + ": bloque " + i + " fuera de formato");
    const b = {}; campo(b, "titulo", m[4]);
    const partes = hijos(s.html.slice(m[0].length, s.html.lastIndexOf("</section>")));
    const arts = partes.filter((p) => p.tag === "article");
    const primero = partes.indexOf(arts[0]), ultimo = partes.lastIndexOf(arts[arts.length - 1]);
    const medio = partes.slice(primero, ultimo + 1).filter((p) => p.tag !== "article");
    if (medio.length) throw new Error(u + ": hay HTML entre conceptos del bloque " + (i + 1) + ": " + medio[0].html.slice(0, 80));
    b.conceptos = arts.map((a) => {
      n++;
      const idm = /^<article class="cpt[^"]*" id="c(\d+)"/.exec(a.html);
      if (!idm || +idm[1] !== n) throw new Error(u + ": el concepto " + n + " no tiene id=c" + n + " (numeración fuera de orden)");
      const c = leeConcepto(a.html, n, carpeta, E);
      if (c._aviso) { avisos.push("concepto " + n + ": " + c._aviso); delete c._aviso; }
      c.n = n;
      return c;
    });
    if (m[3] !== "BLOQUE " + (i + 1)) b.bn = desesc(m[3]);
    const min = minBloque(b);
    if (+m[2] !== min) b.min = +m[2];
    if (m[5] !== bcBloque(b, b.min != null ? b.min : min)) b.bc = m[5];
    const antes = partes.slice(0, primero).map((p) => p.html), despues = partes.slice(ultimo + 1).map((p) => p.html);
    if (antes.length) b.antes = antes.join("\n");
    if (despues.length) b.despues = despues.join("\n");
    D.bloques.push(b);
  }
  const bloques = D.bloques.map((b, i) => ({ ...b, i }));
  const todos = bloques.flatMap((b) => b.conceptos);
  /* comprobación: cada concepto se vuelve a pintar igual que el original */
  const med = (src) => medidaJpeg(path.join(carpeta, src)) || [0, 0];
  const origArts = [...h.slice(ini, ftp).matchAll(/<article class="cpt[\s\S]*?<\/article>/g)].map((m) => m[0]);
  todos.forEach((c, i) => { if (plano(pintaConcepto(c, med, E)) !== plano(origArts[i])) { const g = plano(pintaConcepto(c, med, E)), o = plano(origArts[i]); let k = 0; while (g[k] === o[k]) k++; throw new Error(u + ": el concepto " + c.n + " no se vuelve a pintar igual:\n O " + o.slice(Math.max(0, k - 60), k + 140) + "\n G " + g.slice(Math.max(0, k - 60), k + 140)); } });

  /* leyenda */
  const cuenta = (lv) => todos.filter((c) => c.lv === lv).length;
  const leyenda = [1, 2, 3].filter((lv) => cuenta(lv)).map((lv) => '<span class="tag lv' + lv + '">' + TAG[lv] + " · " + cuenta(lv) + "</span>").join("");
  if (legendaOrig !== leyenda) D.leyenda = legendaOrig;

  /* secciones extra */
  const lista = [];
  for (const s of xs) {
    const sid = (/\bid="([^"]*)"/.exec(s.abre || "") || [])[1] || null;
    if (sid === "empty" && s.html === pintaSeccion("empty")) { lista.push("empty"); continue; }
    let e = null;
    if (s.tag === "section" && s.abre === '<section class="xs" id="' + sid + '">' && SEC[sid]) {
      const r = leeSeccion(sid, s.html, bloques);
      if (r) {
        const prev = D[sid];
        if (sid === "chequeo" || sid === "glosario") {
          /* si sale igual de lo automático, no hace falta guardarlo */
          if (plano(pintaSeccion({ id: sid, ...r.sobre }, D, bloques, todos)) !== plano(s.html)) D[sid] = r.datos;
        } else D[sid] = r.datos;
        const cand = { id: sid, ...r.sobre };
        if (plano(pintaSeccion(cand, D, bloques, todos)) === plano(s.html)) e = Object.keys(r.sobre).length ? cand : sid;
        else if (prev === undefined) delete D[sid]; else D[sid] = prev;
      }
    }
    if (e === null) { e = { id: sid, html: s.html }; if (!sid) avisos.push("sección sin id tras los bloques: " + s.html.slice(0, 60)); }
    lista.push(e);
  }

  /* índice desplegable y lateral: si con el orden fijo de hoy no salen igual, van en "extras" (opcion / indice / arriba) */
  const tocO = /<select id="toc"[^>]*><option value="">Ir a…<\/option>([\s\S]*?)<\/select>/.exec(h)[1];
  const dr = h.indexOf('<div class="drw-l">');
  const cajO = h.slice(dr + '<div class="drw-l">'.length, h.indexOf("</div></aside>", dr));
  const pd = extrasPorDefecto(D, todos);
  const igual = () => plano(pintaToc(D, bloques)) === plano(tocO) && plano(pintaCajon(D, bloques)) === plano(cajO);
  if (JSON.stringify(lista) === JSON.stringify(pd) && igual()) return { D, avisos };
  D.extras = lista.map((e) => (typeof e === "string" ? (e === "empty" ? e : { id: e }) : e));
  const porId = (x) => D.extras.find((e) => typeof e === "object" && e.id === x);
  /* desplegable */
  const ops = hijos(tocO);
  const pal = (/^<option value="b0">(\S+) 1 · /.exec(ops[0] ? ops[0].html : "") || [])[1];
  if (pal && pal !== "Bloque") D.tocBloque = pal;
  let tocOk = true;
  for (const o of ops.slice(bloques.length)) {
    const m = /^<option value="([^"]*)">([\s\S]*)<\/option>$/.exec(o.html), e = m && porId(m[1]);
    if (!e || e.opcion != null) { tocOk = false; break; }
    e.opcion = m[2];
  }
  if (!tocOk || plano(pintaToc(D, bloques)) !== plano(tocO)) { for (const e of D.extras) if (typeof e === "object") delete e.opcion; delete D.tocBloque; D.toc = tocO; avisos.push("índice desplegable literal"); }
  /* lateral */
  const cs = hijos(cajO);
  const nDet = cs.findIndex((x) => x.tag !== "details");
  let cajOk = nDet === bloques.length && plano(cs.slice(0, nDet).map((x) => x.html).join("\n")) === plano(pintaCajonBloques(bloques));
  const iDx = cs.findIndex((x) => x.html === '<p class="dx">Extras</p>');
  if (cajOk && iDx >= 0) {
    for (const [j, a] of cs.slice(nDet).entries()) {
      if (nDet + j === iDx) continue;
      const href = (/href="#([^"]*)"/.exec(a.abre || "") || [])[1], e = href && porId(href);
      if (!e) { cajOk = false; break; }
      if (nDet + j < iDx) { if (e.arriba != null) { cajOk = false; break; } e.arriba = a.html; }
      else {
        const m = /^<a class="dl" href="#[^"]*">([\s\S]*)<\/a>$/.exec(a.html);
        if (!m || e.indice != null) { cajOk = false; break; }
        e.indice = m[1];
      }
    }
  } else cajOk = false;
  if (!cajOk || plano(pintaCajon(D, bloques)) !== plano(cajO)) {
    for (const e of D.extras) if (typeof e === "object") { delete e.indice; delete e.arriba; }
    D.cajon = cajO.replace(/^\n/, ""); avisos.push("índice lateral literal");
  }
  D.extras = D.extras.map((e) => (typeof e === "object" && Object.keys(e).length === 1 ? e.id : e));
  if (!igual()) throw new Error(u + ": los índices no se vuelven a pintar igual");
  return { D, avisos };
}

export const aJson = (D) => JSON.stringify(D, null, 1) + "\n";

/* ---------- línea de órdenes ---------- */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const forzar = args.includes("--forzar");
  const is = args.indexOf("--salida");
  const salida = is >= 0 ? args[is + 1] : null;
  const ip = args.indexOf("--plantilla");
  usaPlantilla(fs.readFileSync(ip >= 0 ? args[ip + 1] : path.join(RAIZ, "scripts", "plantilla-repaso.html"), "utf8"));
  const us = args.filter((a, i) => !a.startsWith("--") && (is < 0 || i !== is + 1) && (ip < 0 || i !== ip + 1));
  if (!us.length) { console.error("Uso: node scripts/html-a-contenido.mjs <unidad…> [--salida <carpeta>] [--plantilla <html>] [--forzar]"); process.exit(1); }
  for (const u of us) {
    const h = fs.readFileSync(path.join(RAIZ, u, "repaso", "index.html"), "utf8");
    const { D, avisos } = convertir(h, u);
    const dest = salida ? path.join(salida, u + ".json") : path.join(RAIZ, u, "repaso", "contenido.json");
    if (!salida && fs.existsSync(dest) && !forzar) { console.error(u + ": ya existe " + dest + " (usa --forzar para pisarlo)"); process.exitCode = 1; continue; }
    if (salida) fs.mkdirSync(salida, { recursive: true });
    fs.writeFileSync(dest, aJson(D));
    const cs = D.bloques.flatMap((b) => b.conceptos);
    console.log(u + " → " + dest + " · " + D.bloques.length + " bloques · " + cs.length + " conceptos · literales: " +
      cs.filter((c) => c.html).length + " conceptos enteros, " + cs.filter((c) => c.extra).length + " con piezas extra" + (avisos.length ? "\n  " + avisos.join("\n  ") : ""));
  }
}
