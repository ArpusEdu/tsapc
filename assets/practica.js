/* Cabecera con el dibujo de la unidad y progreso de lectura en simulacros, exámenes y tests. No toca preguntas, respuestas ni resultados guardados. */
(function(){
  const path=location.pathname.split("/").filter(Boolean),unit=document.documentElement.dataset.unit||path[path.length-2]||"";
  const SHORT={fisio1:"Fisio",fisio2:"Fisio",fisio3:"Fisio",bio1:"Bio",bio2:"Bio",bio3:"Bio",gest1:"Gestión",gest2:"Gestión",ingles1:"Inglés",ipe2:"IPE","ipe-tema5":"IPE",lab1:"Lab"};
  document.documentElement.style.setProperty("--spec",tsapcSpecUrl(unit));
  const h1=document.querySelector(".wrap h1,h1"),top=h1&&h1.parentElement;
  if(top&&top!==document.body&&!top.classList.contains("wrap")){top.classList.add("top");
    const eb=top.querySelector(".eyebrow,.school"),hit=(eb?.textContent||"").match(/\d+\S*\s+examen|tema\s+\d+|unidad\s+\d+|units?\s+[\d–-]+/i),m=hit?hit[0].replace(/\s+examen$/i,""):"";
    const d=document.createElement("div");d.className="spec";d.setAttribute("aria-hidden","true");
    const l=document.createElement("div");l.className="spec-l";l.textContent=SHORT[unit]||"";if(m){const b=document.createElement("b");b.textContent=m;l.appendChild(b)}d.appendChild(l);top.prepend(d)}
  const bar=document.createElement("div");bar.id="readbar";bar.setAttribute("aria-hidden","true");document.body.appendChild(bar);
  let tick=false;const upd=()=>{tick=false;const h=document.documentElement.scrollHeight-innerHeight;bar.style.setProperty("--p",h>0?Math.min(1,scrollY/h):0)};
  addEventListener("scroll",()=>{if(!tick){tick=true;requestAnimationFrame(upd)}},{passive:true});addEventListener("resize",upd);upd();
  if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"))addEventListener("load",()=>navigator.serviceWorker.register("../../sw.js").catch(()=>{}));
})();
