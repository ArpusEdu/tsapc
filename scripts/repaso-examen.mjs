#!/usr/bin/env node
/* Repaso para un examen: una sola página con SOLO lo que entra.
   Uso: node scripts/repaso-examen.mjs <unidad>   (lee <unidad>/examen/datos.json y escribe <unidad>/examen/index.html)
   - Lo de la profe sale tal cual de <unidad>/repaso/contenido.json (conceptos del rango «conceptos»).
   - El test de la profe sale de «impres» (rango «test»); las tarjetas, de app/preguntas/<unidad>.json (bloques de esos conceptos).
   - Mapa, casos con respuesta modelo, chuleta y plan son de Enfoque y van en datos.json. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const u = process.argv[2];
if (!u || !/^[a-z0-9-]+$/.test(u)) { console.error("Uso: node scripts/repaso-examen.mjs <unidad>"); process.exit(1); }
const leer = (p) => JSON.parse(fs.readFileSync(path.join(RAIZ, p), "utf8"));
const D = leer(u + "/examen/datos.json"), C = leer(u + "/repaso/contenido.json");
const P = fs.existsSync(path.join(RAIZ, "app/preguntas/" + u + ".json")) ? leer("app/preguntas/" + u + ".json") : { tarjetas: [] };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const [desde, hasta] = D.conceptos;

/* conceptos del rango, con su bloque */
let n = 0; const cs = [], bloques = new Set();
C.bloques.forEach((b, i) => b.conceptos.forEach((k) => { n++; if (n >= desde && n <= hasta) { cs.push({ n, k, bi: i, bt: b.titulo }); bloques.add("b" + i); } }));
const tarjetas = (P.tarjetas || []).filter((t) => bloques.has(t.bloque));
const test = ((C.impres && C.impres[0] && C.impres[0].items) || []).filter(([q]) => { const m = /^(\d+)\./.exec(q); return m && +m[1] >= D.test[0] && +m[1] <= D.test[1]; });

const concepto = ({ n, k }) => {
  const defs = (k.defs || []).map((d) => "<li><b>" + esc(d.t) + ":</b> " + (d.diapo ? "«" + esc(d.diapo) + "»" : esc(d.facil || "")) + "</li>").join("");
  const imgs = (k.imgs || []).map((im) => '<figure><img src="../repaso/' + esc(im.src) + '" alt="' + esc(im.alt) + '" loading="lazy"><figcaption>' + esc(im.alt) + "</figcaption></figure>").join("");
  return '<article class="cx" id="c' + n + '"><header class="cx-cab"><span class="cx-n">' + n + '</span><div><h3>' + k.titulo + '</h3><p class="cx-f">' + esc(k.fuente) + (k.lv === 1 ? ' · <span class="imp">imprescindible</span>' : "") + "</p></div></header>" +
    '<div class="profe"><p class="et">Lo que dice la profe</p><div class="profe-t">' + k.prof + "</div>" + (defs ? '<ul class="defs">' + defs + "</ul>" : "") + "</div>" + imgs +
    (k.entiende ? '<p class="ent"><b>Entiéndelo:</b> ' + k.entiende + "</p>" : "") +
    (k.truco ? '<p class="truco"><b>Truco:</b> ' + k.truco + "</p>" : "") +
    (k.q ? '<p class="pq"><b>Ponte a prueba:</b> ' + k.q + "</p>" : "") + "</article>";
};

const fecha = new Date(D.fecha + "T12:00:00"), DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"], MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Examen · ${esc(D.titulo)} · Enfoque</title>
<meta name="description" content="Repaso para el examen de ${esc(D.asignatura)}: diapositivas ${esc(D.diapositivas)}.">
<link rel="icon" href="../../assets/enfoque/favicon.svg" type="image/svg+xml">
<script>try{var v=JSON.parse(localStorage.getItem("tsapc:v2")),t=v&&v.personal&&v.personal.prefs&&v.personal.prefs.tema;if(t==="papel"||t==="noche")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
<link rel="stylesheet" href="../../assets/corte/tokens.css">
<link rel="stylesheet" href="../../assets/corte/base.css">
<style>
body{margin:0;background:var(--c-fondo);color:var(--c-tinta);font-family:var(--f-texto,"Atkinson Hyperlegible",system-ui,sans-serif);line-height:1.55}
.hoja{max-width:760px;margin:0 auto;padding:16px 16px 96px}
.volver{display:inline-flex;align-items:center;min-height:44px;font-weight:700;color:var(--c-tinta-2)}
h1,h2,h3{font-family:var(--f-titulo,"Fraunces",Georgia,serif);line-height:1.15;margin:0}
h1{font-size:clamp(2rem,7vw,2.8rem);margin-top:8px}
h1 em{color:var(--c-eosina,#c2185b)}
h2{font-size:1.6rem;margin:40px 0 12px}
h3{font-size:1.2rem}
.sub{color:var(--c-tinta-2);margin:6px 0 0}
.porta{display:inline-flex;gap:10px;align-items:center;margin-top:10px;padding:6px 12px;border-radius:8px;background:var(--c-tarjeta);border:1.5px solid var(--c-linea-suave);font-family:var(--f-mono,ui-monospace,monospace);font-size:.85rem;font-weight:700}
.indice{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0;padding:0;list-style:none}
.indice a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-radius:999px;border:1.5px solid var(--c-linea-suave);background:var(--c-tarjeta);color:var(--c-tinta);text-decoration:none;font-weight:700;font-size:.92rem}
.caja{padding:14px 16px;border-radius:14px;background:var(--c-tarjeta);border:1.5px solid var(--c-linea-suave)}
.plan ol{margin:0;padding-left:1.3em}.plan li{margin:6px 0}.plan small{color:var(--c-tinta-2)}
.mapa{display:grid;gap:12px}@media(min-width:680px){.mapa{grid-template-columns:1fr 1fr}}
.mapa h3{margin-bottom:6px}.mapa ul{margin:0;padding-left:1.1em}.mapa li{margin:5px 0}
.cx{margin:18px 0;padding:16px;border-radius:16px;background:var(--c-tarjeta);border:1.5px solid var(--c-linea-suave)}
.cx-cab{display:flex;gap:12px;align-items:flex-start}
.cx-n{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--c-tinta);color:var(--c-hoja);font-weight:700}
.cx-f{margin:2px 0 0;font-size:.85rem;color:var(--c-tinta-2)}
.imp{font-weight:700;color:var(--c-error)}
.profe{margin-top:12px;padding:12px 14px;border-radius:12px;background:var(--fijo-papel);color:var(--fijo-tinta);border:1.5px solid rgba(34,29,46,.18)}
.et{margin:0 0 6px;font-size:.78rem;font-weight:700;letter-spacing:.02em;opacity:.75}
.profe-t :is(p,ul,ol){margin:.4em 0}.profe-t table{border-collapse:collapse;width:100%;font-size:.92rem}.profe-t td,.profe-t th{border:1px solid rgba(34,29,46,.25);padding:6px;vertical-align:top}
.tw{overflow-x:auto}
.defs{margin:10px 0 0;padding-left:1.1em;font-size:.95rem}
.tapado .profe-t,.tapado .defs{filter:blur(6px);user-select:none}
.tapado .profe{cursor:pointer}
figure{margin:12px 0 0}figure img{max-width:100%;height:auto;border-radius:10px;display:block}figcaption{font-size:.8rem;color:var(--c-tinta-2);margin-top:4px}
.ent,.truco,.pq{margin:10px 0 0}.truco{padding:8px 12px;border-radius:10px;background:var(--c-aviso-suave,rgba(255,200,0,.15))}
.pq{font-weight:700}
details{margin:10px 0;padding:4px 14px;border-radius:12px;background:var(--c-tarjeta);border:1.5px solid var(--c-linea-suave)}
summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:700}
details[open]{background:var(--fijo-papel);color:var(--fijo-tinta)}
details>div{padding:0 0 10px}
.caso p{margin:6px 0}
.chuleta li{margin:7px 0}
.boton{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 18px;border-radius:999px;border:0;background:var(--c-tinta);color:var(--c-hoja);font:inherit;font-weight:700;cursor:pointer}
.herr{position:sticky;top:0;z-index:5;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:8px 0;background:var(--c-fondo)}
:focus-visible{outline:3px solid var(--c-foco,#2846a8);outline-offset:2px}
@media print{.herr,.indice,.volver{display:none}.cx,details{break-inside:avoid}details>div{display:block}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
</head>
<body>
<main class="hoja">
<a class="volver" href="../../app/#/examen/${esc(D.evento)}">← Volver al examen en la app</a>
<p class="porta">${esc(D.asignatura)} · diap. ${esc(D.diapositivas)}</p>
<h1>Repaso para el <em>examen</em></h1>
<p class="sub"><b>${esc(D.titulo)}</b> · ${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}. Solo lo que entra: ${cs.length} conceptos, ${test.length} preguntas del test, ${D.casos.length} casos y ${tarjetas.length} tarjetas.</p>
<ul class="indice"><li><a href="#plan">Plan</a></li><li><a href="#mapa">El tema en 1 minuto</a></li><li><a href="#diapos">Diapositiva a diapositiva</a></li><li><a href="#test">Test</a></li><li><a href="#casos">Casos</a></li><li><a href="#tarjetas">Tarjetas</a></li><li><a href="#chuleta">Chuleta</a></li></ul>

<section id="plan" class="plan"><h2>Plan para hoy</h2><div class="caja"><ol>${D.plan.map(([a, b]) => "<li>" + esc(a) + " <small>· " + esc(b) + "</small></li>").join("")}</ol></div></section>

<section id="mapa"><h2>El tema en 1 minuto</h2><div class="mapa">${D.mapa.map((m) => '<div class="caja"><h3>' + esc(m.titulo) + '</h3><p class="cx-f">Diapositivas ' + esc(m.diap) + "</p><ul>" + m.lineas.map((l) => "<li>" + l + "</li>").join("") + "</ul></div>").join("")}</div></section>

<section id="diapos" class="tapado"><h2>Diapositiva a diapositiva</h2>
<div class="herr"><button type="button" class="boton" id="tapar" aria-pressed="true">Destapar todo</button><span class="cx-f">Lo de la profe empieza tapado: dilo en voz alta y toca cada diapositiva para comprobar. Relee solo lo que falles.</span></div>
${cs.map(concepto).join("\n")}
</section>

<section id="test"><h2>Test de la profe (preguntas ${D.test[0]} a ${D.test[1]})</h2><p class="sub">Piensa la respuesta antes de abrir.</p>
${test.map(([q, a]) => "<details><summary>" + esc(q) + "</summary><div>" + a + "</div></details>").join("\n")}
</section>

<section id="casos"><h2>Casos de las actividades</h2>
${D.casos.map((c) => '<div class="caja caso"><h3>' + esc(c.titulo) + '</h3><p class="cx-f">Diapositivas ' + esc(c.diap) + "</p><p>" + esc(c.caso) + "</p><details><summary>Ver la respuesta modelo</summary><div>" + c.respuesta + "</div></details></div>").join("\n")}
<p class="cx-f">Respuestas modelo de Enfoque, hechas solo con lo que dicen las diapositivas.</p>
</section>

<section id="tarjetas"><h2>Tarjetas</h2><p class="sub">Dilo antes de abrir. Las que falles, repítelas al final.</p>
${tarjetas.map((t) => "<details><summary>" + esc(t.frente) + "</summary><div>" + (t.formato === "html" ? t.dorso : "<p>" + esc(t.dorso) + "</p>") + "</div></details>").join("\n")}
</section>

<section id="chuleta" class="chuleta"><h2>Chuleta para mañana</h2><div class="caja"><ul>${D.chuleta.map((x) => "<li>" + esc(x) + "</li>").join("")}</ul></div>
<p class="sub">Mañana, antes de entrar, solo esto. Nada nuevo. Lo de la profe va tal cual; mapa, trucos, casos y chuleta son de Enfoque.</p></section>
</main>
<script>
(function(){var b=document.getElementById("tapar"),s=document.getElementById("diapos");if(!b||!s)return;
b.addEventListener("click",function(){var on=!s.classList.contains("tapado");s.classList.toggle("tapado",on);b.setAttribute("aria-pressed",String(on));b.textContent=on?"Destapar todo":"Tapar lo de la profe"});
s.addEventListener("click",function(e){var p=e.target.closest(".profe");if(p&&s.classList.contains("tapado")){p.querySelectorAll(".profe-t,.defs").forEach(function(x){x.style.filter="none"})}});})();
</script>
<script src="../../assets/sw-register.js" defer></script>
</body>
</html>
`;
fs.writeFileSync(path.join(RAIZ, u, "examen", "index.html"), html);
console.log(u + "/examen/index.html · " + cs.length + " conceptos, " + test.length + " del test, " + D.casos.length + " casos, " + tarjetas.length + " tarjetas");
