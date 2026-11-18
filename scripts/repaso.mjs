/* Enfoque · genera la página de repaso de una unidad a partir de su contenido.
   Uso: node scripts/repaso.mjs <unidad>                    → escribe <unidad>/repaso/index.html
        node scripts/repaso.mjs <unidad> --comprobar        → solo dice si la página está al día
        node scripts/repaso.mjs <unidad> --salida <carpeta> → escribe <carpeta>/<unidad>.html (para comparar)
        node scripts/repaso.mjs <unidad> --plantilla <html> → usa otra plantilla (por defecto scripts/plantilla-repaso.html)
   Fuente: <unidad>/repaso/contenido.json (lo escrito a mano) + scripts/plantilla-repaso.html. De la plantilla se conserva todo
   lo que no depende del tema: estilos, plan de estudio, tarjetas, índice, scripts. Lo que depende del tema se genera aquí.

   contenido.json:
   { unidad, titulo (pestaña), eyebrow, h1, sub, clave (localStorage), examen: {em, asig, examen, fecha}, simulacro (ruta o null),
     bloques: [{ titulo, conceptos: [{ titulo, lv (1-3), fuente ("Diapositiva 8"), defs: [{t, facil, diapo?, n?}],
                 prof (HTML: lo que dice la profe), imgs: [{src, alt, w, h}], entiende (HTML), truco (HTML), q }] }],
     llave: [{q, porque, resp (HTML)}], trampas: [[a, b, c]], numeros: [[num, que]], impres: [{titulo, items: [[preg, resp]]}] }
   El chequeo final y el glosario salen solos (preguntas de cada bloque y definiciones).
   Campos opcionales (los de los repasos que se escribieron a mano): ver la cabecera de scripts/html-a-contenido.mjs.
   Las piezas se pintan con las funciones de ese archivo, que son las mismas con las que se comprobó cada contenido.json.
   amplia (concepto, opcional): «Para saber más». HTML breve (2-4 frases o una lista corta; si es texto sin etiquetas se
     envuelve en <p>) con lo que complementa a la profe: el mecanismo, un ejemplo clínico o una cifra de manual, cómo se ve en
     el laboratorio de anatomía patológica, la relación con otro tema. Es lo único de un concepto que NO sale de las
     diapositivas (excepción de la regla 2 de CLAUDE.md, 2026-11-18): datos de manual bien establecidos, sin contradecir a
     la profe; si hay duda, no se pone. Se pinta al final del concepto, tras «Ponte a prueba», como <details class="amplia">
     cerrado con la etiqueta «Para saber más · de Enfoque, no viene en tus diapositivas». Va fuera de todo lo que leen los
     scripts y las pruebas (.prof-t, .qt, .defs, .fd, data-n): no entra en las tarjetas, ni en app/preguntas, ni en
     tests/fuentes.test.mjs, ni en «Tapar» (solo tapa .fd); en «Ponte a prueba» se esconde con el resto del cuerpo.
     html-a-contenido.mjs no lo conoce: se añade aquí, después de pintaConcepto (lo vigila tests/amplia.test.mjs).

   Después del montaje, enfoque() da a la página el aspecto de la app (cabecera con el logo y el portaobjetos de la unidad,
   iconos del sistema en lugar de emojis, fuentes locales). No cambia ni un texto: los emojis que leen los scripts
   (📍, 📌, «BLOQUE N», los del planificador) siguen en el HTML, escondidos con hidden. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { esc, pintaConcepto, pintaSeccion, pintaCajon, pintaToc, extrasPorDefecto, etiquetas, medidaJpeg } from "./html-a-contenido.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const u = args[0];
const opcion = (k) => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : null; };
if (!u || u.startsWith("--")) { console.error("Uso: node scripts/repaso.mjs <unidad> [--comprobar] [--salida <carpeta>] [--plantilla <html>]"); process.exit(1); }
const D = JSON.parse(fs.readFileSync(path.join(RAIZ, u, "repaso", "contenido.json"), "utf8"));
const APP = createRequire(import.meta.url)("../app/datos.js").UNIDADES.find((x) => x.id === u);
if (!APP) throw new Error("La unidad " + u + " no está en app/datos.js");
const plantilla = fs.readFileSync(opcion("--plantilla") || path.join(RAIZ, "scripts", "plantilla-repaso.html"), "utf8");

const TAG = { 1: "🔴 IMPRESCINDIBLE", 2: "🟠 IMPORTANTE", 3: "🔵 LEER UNA VEZ" };
const MIN = { 1: 9, 2: 6, 3: 3 };
const H = (o, k) => (o[k + "Html"] != null ? o[k + "Html"] : esc(o[k]));

/* ancho y alto reales de un JPEG, para reservar el hueco y que la página no salte al cargar */
const medida = (src) => { const m = medidaJpeg(path.join(RAIZ, u, "repaso", src)); if (!m) throw new Error("Falta o no sé leer la imagen " + src); return m; };

/* «Para saber más»: después de lo que pinta pintaConcepto, al final del cuerpo del concepto */
const ETQ_AMPLIA = '<span class="lbl">Para saber más</span><span class="amplia-de"> · de Enfoque, no viene en tus diapositivas</span>';
function conAmplia(c, art) {
  if (c.amplia == null) return art;
  const cuerpo = /^\s*</.test(c.amplia) ? c.amplia : "<p>" + c.amplia + "</p>";
  const caja = '<details class="amplia"><summary>' + ETQ_AMPLIA + '</summary><div class="amplia-b">' + cuerpo + "</div></details>\n";
  const FIN = /<\/div><\/article>\n$/;
  if (!FIN.test(art)) throw new Error("No sé dónde poner «Para saber más» en " + c.titulo);
  return art.replace(FIN, () => caja + "</div></article>\n");
}

/* numeración global */
let n = 0;
const bloques = D.bloques.map((b, i) => ({ ...b, i, conceptos: b.conceptos.map((c) => ({ ...c, n: ++n })) }));
const todos = bloques.flatMap((b) => b.conceptos);
todos.forEach((c, i) => { if (c.n !== i + 1) throw new Error("Numeración rota en " + c.titulo); });
const E = etiquetas(D);
const cuenta = (lv) => todos.filter((c) => c.lv === lv).length;

function bloque(b) {
  const cs = b.conceptos, min = b.min != null ? b.min : cs.reduce((s, c) => s + MIN[c.lv], 0) + 4;
  const r = cs.filter((c) => c.lv === 1).length;
  const bc = b.bc != null ? b.bc : "⏱ " + min + " min · Conceptos " + cs[0].n + "–" + cs[cs.length - 1].n + " · " + r + ' 🔴 · <b class="bd">0</b>/' + cs.length + " dominados";
  return '<section class="blk" id="b' + b.i + '" data-min="' + min + '"><h2 class="blk-h"><span class="bn">' + (b.bn != null ? esc(b.bn) : "BLOQUE " + (b.i + 1)) + '</span><span class="bt">' + H(b, "titulo") +
    '</span><span class="bc">' + bc + "</span></h2>" + (b.antes ? b.antes + "\n" : "") + cs.map((c) => conAmplia(c, pintaConcepto(c, medida, E))).join("") + (b.despues ? b.despues + "\n" : "") + "</section>";
}

/* ---------- montaje sobre la plantilla ---------- */
let h = plantilla;
const cambia = (re, fn, que) => { if (!re.test(h)) throw new Error("La plantilla no tiene: " + que); h = h.replace(re, fn); };
cambia(/data-unit="[^"]*"/, 'data-unit="' + u + '"', "data-unit");
cambia(/data-subject="[^"]*"/, 'data-subject="' + APP.s + '"', "data-subject");
const SPR = "../../assets/corte/iconos.svg#i-";
const ICO = (id) => '<svg class="ico" aria-hidden="true" focusable="false"><use href="' + SPR + id + '"/></svg>';
const VOLVER = "../../app/#/unidad/" + encodeURIComponent(u);
cambia(/<a class="dt big" href="[^"]*">/, '<a class="dt big" href="' + VOLVER + '">', "volver del índice");
cambia(/<title>[^<]*<\/title>/, "<title>" + esc(D.titulo) + "</title>", "title");
const leyenda = D.leyenda != null ? D.leyenda : [1, 2, 3].filter((lv) => cuenta(lv)).map((lv) => '<span class="tag lv' + lv + '">' + TAG[lv] + " · " + cuenta(lv) + "</span>").join("");
/* cabecera como la de la unidad en la app: volver y logo arriba (en el HTML, para que nada salte al cargar);
   el portaobjetos con el código y el tema en el color de la asignatura (.spec: repaso.js ya no lo inserta) */
const diap = (() => { const t = String(APP.tema || "").split(" · ")[0]; return t && t !== APP.examen && t.length <= 14 ? t + " · " + APP.examen : APP.examen; })();
cambia(/<header class="top">[\s\S]*?<\/header><details class="how">/, () => '<header class="top"><div class="top-barra"><a class="mc-back" href="' + VOLVER + '">' + ICO("volver") + "Volver a la unidad</a>" +
  '<a class="top-marca" href="../../app/#/hoy" aria-label="Enfoque: ir a Hoy"><img class="logo-papel" src="../../assets/enfoque/logo.svg" width="120" height="32" alt=""><img class="logo-noche" src="../../assets/enfoque/logo-noche.svg" width="120" height="32" alt=""></a></div>\n' +
  '<div class="spec porta"><div class="porta-etq" aria-hidden="true"><span class="porta-cod">' + esc(APP.codigo.toUpperCase()) + '</span><span class="porta-diap">' + esc(diap) + '</span></div><div class="porta-muestra">' +
  '<p class="eyebrow">' + H(D, "eyebrow") + "</p>\n<h1>" + H(D, "h1") + '</h1>\n<p class="sub">' + H(D, "sub") + '</p></div></div>\n<div class="legend">' + leyenda + '</div></header><details class="how">', "cabecera");
if (D.como != null) cambia(/<details class="how">[\s\S]*?<\/details>/, () => '<details class="how">' + D.como + "</details>", "cómo usar");
cambia(/(<select id="toc"[^>]*><option value="">Ir a…<\/option>)[\s\S]*?(<\/select>)/, (m, a, b) => a + pintaToc(D, bloques) + b, "índice desplegable");
const sim = D.simulacro ? "../../" + D.simulacro : null;
cambia(/<a class="simlink" href="[^"]*">[\s\S]*?<\/a>/, () => sim ? '<a class="simlink" href="' + sim + '">' + ICO("editar") + '<span>Cuando acabes un bloque, ponte a prueba en el <b>Simulacro</b></span><svg class="ico flecha" aria-hidden="true" focusable="false"><use href="' + SPR + 'siguiente"/></svg></a>' : "", "enlace al simulacro");
cambia(/<a class="dt sim" href="[^"]*">[^<]*<\/a>/, () => sim ? '<a class="dt sim" href="' + sim + '">' + ICO("editar") + "Simulacro</a>" : "", "simulacro del índice");
cambia(/<section class="blk" id="b0"[\s\S]*?(?=<section class="xs")/, () => bloques.map(bloque).join("\n") + "\n", "bloques");
const extras = (D.extras || extrasPorDefecto(D, todos)).map((x) => pintaSeccion(x, D, bloques, todos)).join("");
cambia(/<section class="xs"[\s\S]*?(?=<\/main>)/, () => extras + "\n", "secciones extra");
cambia(/<details class="db">[\s\S]*?(?=<\/div><\/aside>)/, () => pintaCajon(D, bloques), "índice lateral");
cambia(/const KEY="[^"]*"/, 'const KEY="' + D.clave + '"', "KEY");
const EX = D.examen;
cambia(/const EXAM=\{id:"[^"]*",em:"[^"]*",asig:"[^"]*",examen:"[^"]*",fecha:[^,]*,(horario:\[[^\]]*\]),repaso:"#",simulacro:[^,]*,/, (m, hor) =>
  "const EXAM={id:" + JSON.stringify(EX.id || u) + ",em:" + JSON.stringify(EX.em) + ",asig:" + JSON.stringify(EX.asig) + ",examen:" + JSON.stringify(EX.examen) + ",fecha:" + JSON.stringify(EX.fecha === undefined ? null : EX.fecha) + "," +
  (EX.horario ? "horario:" + JSON.stringify(EX.horario) : hor) + ',repaso:"#",simulacro:' + JSON.stringify(sim) + ",", "EXAM");
/* lo propio de la unidad fuera del contenido */
if (D.tipografia && /fonts\.googleapis\.com\/css2\?family=/.test(h)) cambia(/(fonts\.googleapis\.com\/css2\?family=)[^&"]*&/, (m, a) => a + D.tipografia + "&", "tipografía");
if (D.css) cambia(/<\/head>/, () => "<style>" + D.css + "</style></head>", "</head>");
if (D.buscar) {
  const RE = /document\.querySelectorAll\("([^"]+) \.pq"\)\.forEach\(d=>add\(d,"([^"]*)",d\.querySelector\("summary"\)\.textContent,txt\(d\)\)\)/g;
  const ms = [...h.matchAll(RE)];
  if (!ms.length) throw new Error("La plantilla no tiene el buscador de secciones");
  const a = ms[0].index, b = ms[ms.length - 1].index + ms[ms.length - 1][0].length;
  h = h.slice(0, a) + D.buscar.map(([s, t]) => 'document.querySelectorAll("' + s + ' .pq").forEach(d=>add(d,"' + t + '",d.querySelector("summary").textContent,txt(d)))').join(";") + h.slice(b);
}
const P = D.plan || {};
if (P.repaso) cambia(/const REVIEW=(\[[\s\S]*?\}\s*\]);/, () => "const REVIEW=" + P.repaso + ";", "REVIEW");
if (P.unDia) cambia(/(else if\(N===1\)msg\.innerHTML=`<p class="note warn">)[\s\S]*?(<\/p>`)/, (m, a, b) => a + P.unDia + b, "aviso de 1 día");
if (P.ultimoDia) cambia(/\(rng\?rng\+"[^"]*":"[^"]*"\):rng/, () => '(rng?rng+"' + P.ultimoDia[0] + '":"' + P.ultimoDia[1] + '"):rng', "último día");

h = enfoque(h);

/* ---------- los emojis de las piezas fijas: fuera de la vista, dentro del texto ----------
   Solo en las piezas de la página (etiquetas, títulos de sección, índice, nivel, fuente, «Cómo usar»), nunca en lo de la
   profe ni en las explicaciones. Cada emoji sigue en el HTML dentro de <i hidden>: lo leen extraer-preguntas, las tarjetas
   y el plan («📍 Diapositiva 8» y «📌 Definición…» dan el mismo texto). Los de nivel pasan a su marca (rombo, círculo,
   anillo) y algunos se acompañan del icono del sistema. Dentro de <option> no cabe nada: allí se quita. */
function enfoque(html) {
  const EMO = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(?:️|‍\p{Extended_Pictographic})*\s?/gu;
  const NIVEL = { "🔴": [1, "imprescindible"], "🟠": [2, "importante"], "🔵": [3, "leer una vez"] };
  const ICONO = { "⚠️": "alerta", "⚠": "alerta", "✅": "check", "📅": "calendario", "📆": "calendario", "⏱": "reloj", "⏱️": "reloj", "🔎": "buscar", "📝": "editar" };
  const texto = (t, iconos) => t.replace(EMO, (m) => {
    const e = m.trim(), k = NIVEL[e], sp = m !== e ? " " : "";
    if (k) return '<i class="nv nv' + k[0] + '" role="img" aria-label="' + k[1] + '"><i hidden>' + e + "</i></i>" + sp;
    return "<i hidden>" + m + "</i>" + (iconos && ICONO[e] ? ICO(ICONO[e]) : "");
  });
  const limpia = (frag, iconos) => frag.split(/(<[^>]*>)/).map((p, i) => (i % 2 ? p : texto(p, iconos))).join("");
  const i0 = html.indexOf("<body>");
  return html.slice(0, i0) + html.slice(i0).split(/(<script[\s\S]*?<\/script>)/).map((t, i) => {
    if (i % 2) return t;   /* los scripts no se tocan */
    /* bio1 arrastra en una sección literal los <link> a las hojas viejas (las de los simulacros): se quitan, no son texto */
    t = t.replace(/<link rel="stylesheet" href="\.\.\/\.\.\/assets\/(?:repaso|unidades)\.css">/g, "");
    const en = (re, iconos) => { t = t.replace(re, (m, a, b, c) => a + limpia(b, iconos) + c); };
    en(/(<p class="lbl[^"]*">)([\s\S]*?)(<\/p>)/g, false);
    en(/(<span class="fl">)([^<]*)(<\/span>)/g, true);
    en(/(<span class="srcl">)([\s\S]*?)(<\/span>)/g, true);
    en(/(<span class="tag lv\d">)([^<]*)(<\/span>)/g, false);
    en(/(<span class="bc">)([\s\S]*?)(<\/span><\/h2>)/g, true);
    en(/(<h2 class="xs-h">)([\s\S]*?)(<\/h2>)/g, true);
    en(/(<p class="(?:eyebrow|sub|meta|dx)">)([\s\S]*?)(<\/p>)/g, false);
    en(/(<details class="how">)([\s\S]*?)(<\/details>)/g, false);
    en(/(<span class="pn">)([^<]*)(<\/span>)/g, false);
    en(/(<a class="dl[^"]*"[^>]*>)([\s\S]*?)(<\/a>)/g, true);
    return t.replace(/(<option[^>]*>)([^<]*)(<\/option>)/g, (m, a, b, c) => a + b.replace(EMO, "") + c);
  }).join("");
}

const dest = opcion("--salida") ? path.join(path.resolve(opcion("--salida")), u + ".html") : path.join(RAIZ, u, "repaso", "index.html");
if (args.includes("--comprobar")) {
  const ok = fs.existsSync(dest) && fs.readFileSync(dest, "utf8") === h;
  console.log(u, ok ? "al día" : "DESACTUALIZADA");
  process.exit(ok ? 0 : 1);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, h);
console.log(path.relative(RAIZ, dest) + " ·", todos.length, "conceptos ·", bloques.length, "bloques ·", Math.round(h.length / 1024), "KB");
