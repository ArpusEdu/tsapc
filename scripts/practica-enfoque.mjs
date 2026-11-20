/* Enfoque · «Práctica de Enfoque»: preguntas de huecos, relacionar y verdadero/falso sacadas
   del texto LITERAL de la profe (campo `prof` de <u>/repaso/contenido.json). No se inventa nada:
   - Huecos: una frase de la profe con un término en negrita tapado.
   - Relacionar: una lista de la profe «Término: lo que es» (3 a 6 filas).
   - Verdadero/falso: «Término: lo que es» tal cual (verdadero) o con lo de otro término
     de la misma lista (falso); la explicación es la frase buena de la profe.
   Las pruebas (tests/preguntas.test.mjs) comprueban que cada trozo está tal cual en el `prof`. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* texto plano de un trozo de HTML (igual criterio que app/quiz.js › plano) */
export function plano(s) {
  return String(s == null ? "" : s).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
const norm = (s) => plano(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* trozos: el HTML partido por etiquetas de bloque; cada trozo conserva su HTML en línea (strong, em, sub…) */
const BLOQUE = /<\/?(?:li|p|ul|ol|br|h\d|tr|td|th|table|tbody|thead|div|dt|dd|dl|blockquote|figure|figcaption)\b[^>]*>/gi;
export function trozos(html) {
  return String(html || "").split(BLOQUE).map((t) => t.trim()).filter((t) => plano(t).length > 0);
}
/* «<strong>Término:</strong> lo que es» o «<strong>Término</strong>: lo que es» */
const PAR = /^<strong>([^<]{2,60}?)\s*:\s*<\/strong>\s*([\s\S]+)$|^<strong>([^<]{2,60}?)<\/strong>\s*:\s*([\s\S]+)$/;
const sinTablas = (html) => String(html || "").replace(/<table[\s\S]*?<\/table>/gi, " ");
/* filas de tabla de 2 columnas: «primera casilla» ↔ «segunda casilla» (solo para relacionar) */
function paresTabla(html) {
  const out = [];
  for (const tb of String(html || "").match(/<tbody[\s\S]*?<\/tbody>/gi) || []) {
    for (const tr of tb.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
      const td = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1].trim());
      if (td.length !== 2) continue;
      const termino = plano(td[0]), dp = plano(td[1]);
      if (termino.length < 2 || termino.length > 60 || dp.length < 4 || dp.length > 240) continue;
      out.push({ termino, desc: td[1], tabla: true });
    }
  }
  return out;
}
export function pares(html) {
  const out = paresTabla(html);
  for (const t of trozos(sinTablas(html))) {
    const m = PAR.exec(t); if (!m) continue;
    const termino = (m[1] || m[3]).trim(), desc = (m[2] || m[4]).trim();
    const dp = plano(desc);
    if (dp.length < 12 || dp.length > 240 || /^[\d\s.,]+$/.test(termino)) continue;
    out.push({ termino, desc, trozo: t });
  }
  return out;
}
const contiene = (texto, termino) => norm(texto).includes(norm(termino));

function huecos(c) {
  const out = [];
  for (const t of trozos(sinTablas(c.prof))) {
    if (PAR.test(t)) continue;                       /* las definiciones van a relacionar y V/F */
    const pt = plano(t); if (pt.length < 30 || pt.length > 260) continue;
    const negritas = [...t.matchAll(/<strong>([^<]{2,40})<\/strong>/g)];
    for (const m of negritas) {
      const term = m[1].trim(), pl = plano(term);
      if (/[:;]$/.test(term) || pl.split(" ").length > 4 || pl.length < 3 || /^[\d\s.,%+-]+$/.test(pl)) continue;
      const resto = t.slice(0, m.index) + t.slice(m.index + m[0].length);
      if (contiene(resto, pl)) continue;               /* si la respuesta se ve en la frase, no vale */
      if (plano(resto).replace(/[^a-záéíóúñü]/gi, "").length < 18) continue;
      out.push({ texto: t.slice(0, m.index) + "<strong>_____</strong>" + t.slice(m.index + m[0].length), respuesta: pl });
      break;                                         /* un hueco por frase */
    }
    if (out.length >= 2) break;
  }
  return out;
}

function relacionar(ps) {
  const filas = ps.filter((p) => !contiene(p.desc, p.termino));
  const unicos = [...new Map(filas.map((p) => [norm(p.termino), p])).values()].slice(0, 6);
  if (unicos.length < 3) return null;
  return { opciones: unicos.map((p) => plano(p.termino)), filas: unicos.map((p, i) => [p.desc, [i]]) };
}

function vf(ps, semilla) {
  const ok = [...new Map(ps.filter((p) => !p.tabla).map((p) => [norm(p.termino), p])).values()].filter((p) => !contiene(p.desc, p.termino));
  if (ok.length < 2) return [];
  const a = ok[semilla % ok.length], b = ok[(semilla + 1) % ok.length];
  const out = [{ texto: "<strong>" + a.termino + ":</strong> " + a.desc, correcta: true }];
  /* falso: el término «b» con lo que dice la profe de «a» (si no se parecen y no nombra a «b») */
  if (norm(a.desc) !== norm(b.desc) && !contiene(a.desc, b.termino))
    out.push({ texto: "<strong>" + b.termino + ":</strong> " + a.desc, correcta: false, explicacion: "Eso es de <strong>" + a.termino + "</strong>. <strong>" + b.termino + ":</strong> " + b.desc });
  return out;
}

const diap = (f) => /^Diapositivas?\s/i.test(String(f || "")) ? String(f).replace(/^Diapositivas?\s*/i, "") : "";

export function bancoEnfoque(u) {
  const f = path.join(RAIZ, u, "repaso", "contenido.json");
  if (!fs.existsSync(f)) return null;
  const C = JSON.parse(fs.readFileSync(f, "utf8"));
  const partes = [], preguntas = [];
  let n = 0;
  (C.bloques || []).forEach((b, bi) => {
    const parte = "b" + bi;
    let alguna = false;
    (b.conceptos || []).forEach((c) => {
      n++;
      if (!c.prof) return;
      const base = u + ".e.c" + n + ".", ps = pares(c.prof), tit = c.titulo;
      huecos(c).forEach((h, k) => {
        preguntas.push(Object.assign({ id: base + "h" + (k + 1), parte, tipo: "esquema", variante: "hueco", texto: h.texto, respuestas: [h.respuesta] }, diap(c.fuente) ? { diapositiva: diap(c.fuente) } : {}, { concepto: tit }));
      });
      const r = relacionar(ps);
      if (r) preguntas.push({ id: base + "r", parte, tipo: "relacionar", texto: "<strong>Relaciona.</strong> " + tit, opciones: r.opciones, filas: r.filas, concepto: tit });
      vf(ps, n).forEach((v, k) => {
        preguntas.push(Object.assign({ id: base + "v" + (k + 1), parte, tipo: "vf", texto: v.texto, correcta: v.correcta, concepto: tit }, v.explicacion ? { explicacion: v.explicacion } : {}));
      });
      alguna = alguna || preguntas.some((q) => q.parte === parte);
    });
    if (alguna) partes.push({ id: parte, k: "Bloque " + (bi + 1), t: b.titulo });
  });
  if (!preguntas.length) return null;
  return { id: "enfoque", titulo: "Práctica de Enfoque", fuente: u + "/repaso/", formato: "html", generado: true, partes, preguntas };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const us = process.argv.slice(2);
  for (const u of us) {
    const b = bancoEnfoque(u);
    if (!b) { console.log(u, "sin preguntas"); continue; }
    const t = {}; b.preguntas.forEach((q) => { const k = q.variante || q.tipo; t[k] = (t[k] || 0) + 1; });
    console.log(u, b.preguntas.length, JSON.stringify(t));
    if (process.argv.includes("--ver") || us.length === 1) b.preguntas.slice(0, 40).forEach((q) => console.log(" ", q.id, q.tipo, plano(q.texto).slice(0, 110), "→", q.respuestas ? q.respuestas[0] : q.tipo === "vf" ? q.correcta : q.opciones.join(" | ")));
  }
}
