/* Mejoras comunes de los repasos: muestra de la asignatura, barra inferior, progreso de lectura y «siguiente bloque».
   No toca el contenido ni el progreso guardado de cada página. */
(function(){
  const path=location.pathname.split("/").filter(Boolean),folder=path[path.length-2]||"";
  const col=/^fisio/.test(folder)?"fisio":/^bio/.test(folder)?"bio":/^gest/.test(folder)?"gest":/^ingles/.test(folder)?"ing":/^ipe/.test(folder)?"ipe":/^lab/.test(folder)?"lab":"fisio";
  const SHORT={fisio:"Fisio",bio:"Bio",gest:"Gestión",ing:"Inglés",ipe:"IPE",lab:"Lab"};

  document.documentElement.style.setProperty("--spec",tsapcSpecUrl(folder));

  const top=document.querySelector(".top");
  if(top&&!top.querySelector(".spec")){const parts=(top.querySelector(".eyebrow")?.textContent||"").split("·").map(x=>x.trim()),m=(parts.find(x=>/examen|tema|unidad/i.test(x))||parts[parts.length-1]||"").replace(/ examen$/i,"");
    const d=document.createElement("div");d.className="spec";d.setAttribute("aria-hidden","true");
    const l=document.createElement("div");l.className="spec-l";l.textContent=SHORT[col];const b=document.createElement("b");b.textContent=m;l.appendChild(b);d.appendChild(l);top.prepend(d)}

  // Los botones se mueven a una barra; conservan sus funciones porque son los mismos elementos
  const dock=document.createElement("nav");dock.className="dock";dock.setAttribute("aria-label","Herramientas del repaso");
  ["drwOpen","hideFab","fcOpen","upBtn"].forEach(id=>{const e=document.getElementById(id);if(e)dock.appendChild(e)});
  document.body.appendChild(dock);

  const bar=document.createElement("div");bar.id="readbar";bar.setAttribute("aria-hidden","true");document.body.appendChild(bar);
  let tick=false;const upd=()=>{tick=false;const h=document.documentElement.scrollHeight-innerHeight;bar.style.setProperty("--p",h>0?Math.min(1,scrollY/h):0)};
  addEventListener("scroll",()=>{if(!tick){tick=true;requestAnimationFrame(upd)}},{passive:true});addEventListener("resize",upd);upd();

  // Al acabar un bloque, seguir con el siguiente sin volver al índice
  const blks=[...document.querySelectorAll(".blk")];
  blks.forEach((b,i)=>{const n=blks[i+1];if(!n)return;const t=n.querySelector(".bt")?.textContent||"";
    const btn=document.createElement("button");btn.type="button";btn.className="nextblk";
    const a=document.createElement("span");a.textContent="Siguiente bloque: "+t;const c=document.createElement("span");c.setAttribute("aria-hidden","true");c.textContent="→";btn.append(a,c);
    btn.addEventListener("click",()=>{if(!n.classList.contains("open"))n.querySelector(".blk-h").click();n.scrollIntoView();n.querySelector(".blk-h").focus({preventScroll:true})});
    b.appendChild(btn)});

  // El plan de estudio enlaza a veces a secciones que este repaso no tiene: se quita el botón para que no lleve a ninguna parte
  const plan=document.getElementById("planOv");
  if(plan){const clean=()=>plan.querySelectorAll('a[href^="#"]').forEach(a=>{const id=a.getAttribute("href").slice(1);if(id&&!document.getElementById(id))a.remove()});
    new MutationObserver(clean).observe(plan,{childList:true,subtree:true});clean()}

  // Modo sin internet: guarda lo visitado
  if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"))addEventListener("load",()=>navigator.serviceWorker.register("../../sw.js").catch(()=>{}));
})();
