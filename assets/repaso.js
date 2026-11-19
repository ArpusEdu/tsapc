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

/* Escuchar el repaso: lectura en voz alta con la voz del dispositivo (speechSynthesis: gratis y sin conexión).
   Cada concepto lee título, lo de la profe, «Entiéndelo» y el truco; luego la pregunta de «Ponte a prueba» y deja
   unos segundos para responder en voz alta. Sigue solo con el siguiente concepto. La velocidad se guarda en
   tsapc:v2 › personal.prefs.voz (entra en la copia). Si el navegador no tiene voz, no aparece nada. */
(function(){
  const SS=window.speechSynthesis;if(!SS||typeof SpeechSynthesisUtterance!=="function")return;
  const arts=[...document.querySelectorAll("article.cpt[id^='c']")];if(!arts.length)return;
  const VELS=[0.8,1,1.2,1.5],PAUSA=5000;
  const ST=()=>window.tsapcStore;
  const pref=()=>{try{const v=ST()&&ST().get(["personal","prefs","voz"]);return v&&typeof v==="object"?v:{}}catch(e){return{}}};
  let vel=1;const leerVel=()=>{const v=+pref().vel;if(VELS.indexOf(v)>=0)vel=v};leerVel();
  let voz=null;const elegir=()=>{const vs=SS.getVoices()||[];voz=vs.find(v=>/^es[-_]ES/i.test(v.lang))||vs.find(v=>/^es/i.test(v.lang))||null};
  elegir();if("onvoiceschanged" in SS)SS.addEventListener("voiceschanged",elegir);

  /* texto que se lee: los símbolos de los apuntes se dicen con palabras */
  const decir=s=>String(s||"").replace(/\s+/g," ").replace(/→/g,", luego, ").replace(/←/g,", viene de, ").replace(/\s\+\s/g," más ")
    .replace(/>\s*(\d)/g,"más de $1").replace(/<\s*(\d)/g,"menos de $1").replace(/[·•]/g,", ").replace(/≈/g,"unos ").replace(/[«»"]/g,"").trim();
  /* cada párrafo, punto de lista o fila se lee como frase aparte, para que no se peguen */
  const BLQ="p,li,h4,h5,tr,dt,dd";
  const trozos=e=>{const hs=[...e.querySelectorAll(BLQ)].filter(x=>!x.querySelector(BLQ));return hs.length?hs.map(x=>(x.textContent||"").trim()).filter(Boolean):[(e.textContent||"").trim()]};
  const txt=(a,sel)=>[...a.querySelectorAll(sel)].flatMap(trozos).map(t=>/[.;:!?]$/.test(t)?t:t+".").join(" ");
  function partes(a){
    const n=a.querySelector(".c-n")?.textContent||"",t=a.querySelector(".c-h h3")?.textContent||"",out=[];
    out.push("Concepto "+n+". "+t+".");
    const prof=txt(a,".prof-t");if(prof)out.push("Lo que dice la profe. "+prof);
    const und=txt(a,".box.und p:not(.lbl)");if(und)out.push("Entiéndelo. "+und);
    const tip=txt(a,".box.tip p:not(.lbl)");if(tip)out.push("Truco. "+tip);
    const q=a.querySelector(".box.q .qt")?.textContent;
    /* frases cortas: algunos navegadores cortan las locuciones largas */
    const fr=[];
    /* se juntan frases hasta unos 200 caracteres: ni locuciones largas que se cortan ni voz entrecortada */
    out.forEach(p=>{let buf="";decir(p).split(/(?<=[.;!?])\s+/).forEach(f=>{
      while(f.length>220){const i=f.lastIndexOf(",",220);const c=i>60?i+1:220;if(buf){fr.push(buf);buf=""}fr.push(f.slice(0,c));f=f.slice(c).trim()}
      if(!f)return;if(buf&&(buf+" "+f).length>200){fr.push(buf);buf=f}else buf=buf?buf+" "+f:f});if(buf)fr.push(buf)});
    return {frases:fr,pregunta:q?decir("Ponte a prueba. "+q+" Respóndelo en voz alta."):""};
  }

  let actual=-1,cola=[],pos=0,sonando=false,pausado=false,tm=null,gen=0;
  const vivo=document.createElement("p");vivo.className="voz-vivo";vivo.setAttribute("aria-live","polite");document.body.appendChild(vivo);

  /* barra del reproductor */
  const bar=document.createElement("div");bar.className="voz-bar";bar.hidden=true;bar.setAttribute("role","region");bar.setAttribute("aria-label","Lectura en voz alta");
  bar.innerHTML='<span class="voz-que"></span><div class="voz-bs">'+
    '<button type="button" data-voz="ant" aria-label="Concepto anterior">⏮</button>'+
    '<button type="button" data-voz="pp" aria-label="Pausar">⏸</button>'+
    '<button type="button" data-voz="sig" aria-label="Concepto siguiente">⏭</button>'+
    '<button type="button" data-voz="vel" aria-label="Velocidad">1×</button>'+
    '<button type="button" data-voz="fin" aria-label="Dejar de escuchar">✕</button></div>';
  document.body.appendChild(bar);
  const $=k=>bar.querySelector('[data-voz="'+k+'"]');
  const velTxt=()=>{const v=String(vel).replace(".",",");$("vel").textContent=v+"×";$("vel").setAttribute("aria-label","Velocidad: "+v+" veces. Cambiar")};velTxt();

  function marcar(){
    arts.forEach((a,i)=>{const on=i===actual&&sonando;a.classList.toggle("voz-on",on);const b=a.querySelector(".voz-b");
      if(b){b.setAttribute("aria-pressed",String(on));b.textContent=on?"■ Parar":"🔊 Escuchar"}});
    bar.hidden=!sonando;
    if(sonando){const a=arts[actual];bar.querySelector(".voz-que").textContent=(a.querySelector(".c-n")?.textContent||"")+" · "+(a.querySelector(".c-h h3")?.textContent||"");
      $("pp").textContent=pausado?"▶":"⏸";$("pp").setAttribute("aria-label",pausado?"Seguir":"Pausar")}
  }
  function abrirBloque(a){const b=a.closest(".blk");if(b&&!b.classList.contains("open")){const h=b.querySelector(".blk-h");if(h)h.click()}}
  function hablar(f,fin){
    const g=gen,u=new SpeechSynthesisUtterance(f);u.lang=voz?voz.lang:"es-ES";if(voz)u.voice=voz;u.rate=vel;
    u.onend=()=>{if(g===gen)fin()};
    u.onerror=e=>{if(g===gen&&e.error!=="interrupted"&&e.error!=="canceled")fin()};
    SS.speak(u);
  }
  function seguir(){
    if(!sonando||pausado)return;
    if(pos<cola.length){hablar(cola[pos],()=>{pos++;seguir()});return}
    /* tras la pregunta, silencio para responder; luego el siguiente concepto */
    if(actual+1<arts.length)tm=setTimeout(()=>empezar(actual+1),PAUSA);
    else{vivo.textContent="Fin del repaso.";parar()}
  }
  function empezar(i){
    clearTimeout(tm);gen++;SS.cancel();leerVel();
    actual=i;const a=arts[i];abrirBloque(a);const p=partes(a);cola=p.frases.concat(p.pregunta?[p.pregunta]:[]);pos=0;sonando=true;pausado=false;
    a.scrollIntoView({block:"start",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
    vivo.textContent="Leyendo el concepto "+(a.querySelector(".c-n")?.textContent||"");marcar();seguir();
  }
  function parar(){clearTimeout(tm);gen++;SS.cancel();sonando=false;pausado=false;marcar()}
  /* pausar = cortar y recordar la frase: «pause()» no funciona igual en todos los móviles */
  function pausa(){if(!sonando)return;if(pausado){pausado=false;marcar();seguir()}else{pausado=true;clearTimeout(tm);gen++;SS.cancel();marcar()}}

  arts.forEach((a,i)=>{const h=a.querySelector(".c-h");if(!h||h.querySelector(".voz-b"))return;
    const b=document.createElement("button");b.type="button";b.className="voz-b";b.setAttribute("aria-pressed","false");b.textContent="🔊 Escuchar";
    b.setAttribute("aria-label","Escuchar el concepto "+(a.querySelector(".c-n")?.textContent||i+1));
    b.addEventListener("click",ev=>{ev.stopPropagation();if(sonando&&actual===i)parar();else empezar(i)});h.appendChild(b)});
  bar.addEventListener("click",ev=>{const k=ev.target.closest&&ev.target.closest("[data-voz]");if(!k)return;const c=k.getAttribute("data-voz");
    if(c==="pp")pausa();
    else if(c==="fin")parar();
    else if(c==="sig"){if(actual+1<arts.length)empezar(actual+1)}
    else if(c==="ant")empezar(Math.max(0,actual-1));
    else if(c==="vel"){vel=VELS[(VELS.indexOf(vel)+1)%VELS.length];velTxt();
      try{const o=pref();o.vel=vel;if(ST())ST().set(["personal","prefs","voz"],o)}catch(e){}
      if(sonando&&!pausado){gen++;SS.cancel();seguir()}}});
  addEventListener("pagehide",()=>SS.cancel());

  const s=document.createElement("style");
  s.textContent=".c-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}"+
    ".c-h .voz-b{margin-left:auto;flex:none;min-height:44px;padding:0 14px;border-radius:999px;border:1.5px solid currentColor;background:transparent;color:inherit;font:inherit;font-size:.85em;font-weight:700;cursor:pointer}"+
    ".voz-b[aria-pressed=true]{background:rgba(127,127,127,.18)}"+
    "article.cpt.voz-on{outline:3px solid currentColor;outline-offset:4px;border-radius:12px}"+
    ".voz-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom));z-index:60;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;width:min(560px,calc(100% - 32px));padding:8px 10px;border-radius:16px;background:#221d2e;color:#fbf8f1;box-shadow:0 6px 24px rgba(0,0,0,.3)}"+
    ".voz-bar[hidden]{display:none}"+
    ".voz-que{flex:1 1 140px;min-width:0;font-size:.85em;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"+
    ".voz-bs{display:flex;gap:4px}.voz-bar button{min-width:44px;min-height:44px;border-radius:12px;border:0;background:rgba(255,255,255,.12);color:inherit;font:inherit;font-weight:700;cursor:pointer}"+
    ".voz-bar button:focus-visible,.voz-b:focus-visible{outline:3px solid currentColor;outline-offset:2px}"+
    ".voz-vivo{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}@media print{.voz-b,.voz-bar{display:none}}";
  document.head.appendChild(s);
})();
