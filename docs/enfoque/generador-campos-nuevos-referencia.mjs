/* Referencia: el montaje de scripts/repaso.mjs (copia en snap/) con los campos nuevos de contenido.json.
   No escribe en el repo: devuelve el HTML. Uso: import { genera } from "./gen-ext.mjs" */
import fs from "node:fs";
import path from "node:path";
import { esc, pintaConcepto, pintaSeccion, pintaCajon, pintaToc, extrasPorDefecto, etiquetas, medidaJpeg } from "file:///D:/Proyectos%20Claude/tsapc/scripts/html-a-contenido.mjs";

const SNAP = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "snap", "scripts", "plantilla-repaso.html");
const RAIZ = "D:/Proyectos Claude/tsapc";
const TAG = { 1: "🔴 IMPRESCINDIBLE", 2: "🟠 IMPORTANTE", 3: "🔵 LEER UNA VEZ" };
const MIN = { 1: 9, 2: 6, 3: 3 };
const H = (o, k) => (o[k + "Html"] != null ? o[k + "Html"] : esc(o[k]));

export function genera(D, plantilla = fs.readFileSync(SNAP, "utf8")) {
  const u = D.unidad;
  const med = (src) => { const m = medidaJpeg(path.join(RAIZ, u, "repaso", src)); if (!m) throw new Error("Falta/ilegible " + src); return m; };
  let n = 0;
  const bloques = D.bloques.map((b, i) => ({ ...b, i, conceptos: b.conceptos.map((c) => ({ ...c, n: ++n })) }));
  const todos = bloques.flatMap((b) => b.conceptos);
  const E = etiquetas(D);
  const cuenta = (lv) => todos.filter((c) => c.lv === lv).length;
  const bloque = (b) => {
    const cs = b.conceptos, min = b.min != null ? b.min : cs.reduce((s, c) => s + MIN[c.lv], 0) + 4;
    const r = cs.filter((c) => c.lv === 1).length;
    const bc = b.bc != null ? b.bc : "⏱ " + min + " min · Conceptos " + cs[0].n + "–" + cs[cs.length - 1].n + " · " + r + ' 🔴 · <b class="bd">0</b>/' + cs.length + " dominados";
    return '<section class="blk" id="b' + b.i + '" data-min="' + min + '"><h2 class="blk-h"><span class="bn">' + (b.bn != null ? esc(b.bn) : "BLOQUE " + (b.i + 1)) + '</span><span class="bt">' + H(b, "titulo") +
      '</span><span class="bc">' + bc + "</span></h2>" + (b.antes ? b.antes + "\n" : "") + cs.map((c) => pintaConcepto(c, med, E)).join("") + (b.despues ? b.despues + "\n" : "") + "</section>";
  };
  const extras = (D.extras || extrasPorDefecto(D, todos)).map((x) => pintaSeccion(x, D, bloques, todos)).join("");

  let h = plantilla;
  const cambia = (re, fn, que) => { if (!re.test(h)) throw new Error("La plantilla no tiene: " + que); h = h.replace(re, fn); };
  cambia(/data-unit="[^"]*"/, 'data-unit="' + u + '"', "data-unit");
  cambia(/<title>[^<]*<\/title>/, "<title>" + esc(D.titulo) + "</title>", "title");
  const leyenda = D.leyenda != null ? D.leyenda : [1, 2, 3].filter((lv) => cuenta(lv)).map((lv) => '<span class="tag lv' + lv + '">' + TAG[lv] + " · " + cuenta(lv) + "</span>").join("");
  cambia(/<header class="top">[\s\S]*?<\/header><details class="how">/, () => '<header class="top"><p class="eyebrow">' + H(D, "eyebrow") + "</p>\n<h1>" + H(D, "h1") + '</h1>\n<p class="sub">' + H(D, "sub") + '</p>\n<div class="legend">' + leyenda + '</div></header><details class="how">', "cabecera");
  if (D.como != null) cambia(/<details class="how">[\s\S]*?<\/details>/, () => '<details class="how">' + D.como + "</details>", "cómo usar");
  cambia(/(<select id="toc"[^>]*><option value="">Ir a…<\/option>)[\s\S]*?(<\/select>)/, (m, a, b) => a + pintaToc(D, bloques) + b, "toc");
  const sim = D.simulacro ? "../../" + D.simulacro : null;
  cambia(/<a class="simlink" href="[^"]*">[\s\S]*?<\/a>/, () => sim ? '<a class="simlink" href="' + sim + '"><span>📝 Cuando acabes un bloque, ponte a prueba en el <b>Simulacro</b></span><span aria-hidden="true">→</span></a>' : "", "simlink");
  cambia(/<a class="dt sim" href="[^"]*">[^<]*<\/a>/, () => sim ? '<a class="dt sim" href="' + sim + '">📝 Simulacro</a>' : "", "sim índice");
  cambia(/<section class="blk" id="b0"[\s\S]*?(?=<section class="xs")/, () => bloques.map(bloque).join("\n") + "\n", "bloques");
  cambia(/<section class="xs"[\s\S]*?(?=<div class="tpill")/, () => extras + "\n", "extras");
  cambia(/<details class="db">[\s\S]*?(?=<\/div><\/aside>)/, () => pintaCajon(D, bloques), "cajón");
  cambia(/const KEY="[^"]*"/, 'const KEY="' + D.clave + '"', "KEY");
  const EX = D.examen;
  cambia(/const EXAM=\{id:"[^"]*",em:"[^"]*",asig:"[^"]*",examen:"[^"]*",fecha:[^,]*,(horario:\[[^\]]*\]),repaso:"#",simulacro:[^,]*,/, (m, hor) =>
    "const EXAM={id:" + JSON.stringify(EX.id || u) + ",em:" + JSON.stringify(EX.em) + ",asig:" + JSON.stringify(EX.asig) + ",examen:" + JSON.stringify(EX.examen) + ",fecha:" + JSON.stringify(EX.fecha === undefined ? null : EX.fecha) + "," +
    (EX.horario ? "horario:" + JSON.stringify(EX.horario) : hor) + ',repaso:"#",simulacro:' + JSON.stringify(sim) + ",", "EXAM");
  /* lo propio de la unidad fuera del contenido */
  if (D.tipografia) cambia(/(fonts\.googleapis\.com\/css2\?family=)[^&"]*&/, (m, a) => a + D.tipografia + "&", "tipografía");
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
  return h;
}
