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
  {const s=document.createElement("script");s.src="../../assets/sw-register.js";s.defer=true;document.head.appendChild(s);}  /* service worker, aviso de versión nueva y persist() */
})();

/* Preguntas para hacer en clase dentro del repaso: una caja al final de cada concepto que tenga pregunta (app/profe/<unidad>.json).
   Lo marcado y la respuesta apuntada se guardan en tsapc:v2 › personal.preguntasProfe, lo mismo que en la app (y entra en la copia). */
(function(){
  const path=location.pathname.replace(/index\.html$/,"").split("/").filter(Boolean),u=path[path.length-2]||"";
  if(!/^[a-z0-9-]+$/.test(u))return;
  const TIPO={entender:"Para entender",laboratorio:"Tu oficio en el laboratorio",caso:"Un caso real",examen:"Para el examen"};
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const ST=()=>window.tsapcStore;
  const estado=()=>{try{const o=ST()&&ST().get(["personal","preguntasProfe",u]);return o&&typeof o==="object"?o:{}}catch(e){return{}}};
  const guardar=o=>{try{return !!(ST()&&ST().set(["personal","preguntasProfe",u],o))}catch(e){return false}};
  let L=[];
  function caja(q){
    const e=estado()[q.id]||{},on=!!e.hecha;
    return '<p class="pp-r-k">Para preguntar en clase · '+esc(TIPO[q.tipo]||q.tipo)+'</p><p class="pp-r-q">'+esc(q.pregunta)+'</p><p class="pp-r-por">'+esc(q.porque)+'</p>'+
      '<button type="button" class="pp-r-b" data-ppr="'+esc(q.id)+'" aria-pressed="'+on+'">'+(on?"✓ La pregunté":"Marcar como preguntada")+'</button>'+
      (on?'<label class="pp-r-l" for="ppr-'+esc(q.id)+'">Lo que te respondió</label><textarea id="ppr-'+esc(q.id)+'" rows="3" data-ppr-nota="'+esc(q.id)+'" placeholder="Apúntalo con tus palabras.">'+esc(e.nota||"")+'</textarea>':"")+
      '<p class="pp-r-ver"><a href="../../app/#/unidad/'+esc(u)+'">Ver todas en la unidad</a></p>';
  }
  function pintar(){
    L.forEach(q=>{const art=document.getElementById("c"+(+q.n));if(!art)return;
      let a=art.querySelector('.pp-r[data-q="'+q.id+'"]');
      if(!a){a=document.createElement("aside");a.className="pp-r";a.dataset.q=q.id;a.setAttribute("aria-label","Para preguntar en clase · concepto "+(+q.n));art.appendChild(a)}
      a.innerHTML=caja(q)})
  }
  function estilos(){
    if(document.getElementById("pp-r-css"))return;
    const s=document.createElement("style");s.id="pp-r-css";
    s.textContent=".pp-r{margin:14px 0 4px;padding:12px 14px;border:1.5px dashed currentColor;border-radius:12px;background:rgba(127,127,127,.07)}"+
      ".pp-r p{margin:0}.pp-r-k{font-size:.78em;font-weight:700;opacity:.8}.pp-r-q{font-weight:700;margin:4px 0 6px!important;line-height:1.35}"+
      ".pp-r-por{font-size:.88em;opacity:.85}.pp-r-b{margin-top:10px;min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid currentColor;background:transparent;color:inherit;font:inherit;font-weight:700;cursor:pointer}"+
      ".pp-r-b[aria-pressed=true]{background:rgba(46,160,90,.18)}.pp-r-b:focus-visible{outline:3px solid currentColor;outline-offset:2px}"+
      ".pp-r-l{display:block;margin-top:10px;font-weight:700;font-size:.88em}.pp-r textarea{width:100%;margin-top:4px;padding:10px 12px;font:inherit;font-size:16px;border-radius:10px;border:1.5px solid rgba(127,127,127,.5);background:transparent;color:inherit}"+
      ".pp-r-ver{margin-top:8px!important;font-size:.85em}.pp-r-ver a{color:inherit}@media print{.pp-r{display:none}}";
    document.head.appendChild(s);
  }
  function arrancar(){
    fetch("../../app/profe/"+u+".json",{credentials:"same-origin"}).then(r=>{if(!r.ok)throw 0;return r.json()}).then(j=>{
      L=Array.isArray(j&&j.preguntas)?j.preguntas:[];if(!L.length)return;estilos();pintar();
      document.addEventListener("click",ev=>{const b=ev.target.closest&&ev.target.closest("[data-ppr]");if(!b)return;
        const id=b.getAttribute("data-ppr"),o=estado(),e=o[id]&&typeof o[id]==="object"?o[id]:{};
        if(e.hecha)delete e.hecha;else{const d=new Date();e.hecha=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
        o[id]=e;guardar(o);pintar();const n=document.querySelector('[data-ppr="'+id+'"]');if(n)n.focus()});
      let tm=null;document.addEventListener("input",ev=>{const t=ev.target;if(!t.getAttribute||!t.getAttribute("data-ppr-nota"))return;
        clearTimeout(tm);tm=setTimeout(()=>{const o=estado(),id=t.getAttribute("data-ppr-nota"),e=o[id]&&typeof o[id]==="object"?o[id]:{};e.nota=t.value.slice(0,2000);o[id]=e;guardar(o)},400)});
    }).catch(()=>{});
  }
  /* el almacén de la app hace falta para guardar igual que ella: se carga si la página no lo trae */
  if(window.tsapcStore)arrancar();
  else{const s=document.createElement("script");s.src="../../assets/store.js";s.onload=arrancar;s.onerror=()=>{};document.head.appendChild(s)}
})();
