/* Mejoras comunes de los repasos: muestra de la asignatura, barra inferior, progreso de lectura y «siguiente bloque».
   No toca el contenido ni el progreso guardado de cada página. */
(function(){
  const path=location.pathname.split("/").filter(Boolean),folder=path[path.length-2]||"";
  const col=/^fisio/.test(folder)?"fisio":/^bio/.test(folder)?"bio":/^gest/.test(folder)?"gest":/^ingles/.test(folder)?"ing":/^ipe/.test(folder)?"ipe":/^lab/.test(folder)?"lab":"fisio";
  const SHORT={fisio:"Fisio",bio:"Bio",gest:"Gestión",ing:"Inglés",ipe:"IPE",lab:"Lab"};

  // Misma muestra dibujada que en la portada
  function specimen(id){let s=[...id].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);const r=()=>(s=(s*1664525+1013904223)%4294967296)/4294967296;
    let o="",bg="#f3c3d4";const W=420,H=120;
    if(col==="fisio"){bg="#f2a5be";for(let y=-4;y<H+8;y+=13){const w=4+r()*3,a=r()*5;o+=`<path d="M-5 ${y} Q 105 ${y+a} 210 ${y} T 425 ${y}" fill="none" stroke="#d63a72" stroke-width="${w*1.6}" opacity=".78"/>`;for(let x=r()*50;x<W;x+=46+r()*70)o+=`<ellipse cx="${x}" cy="${y+a/2}" rx="7" ry="2.5" fill="#3a1f8a"/>`}}
    else if(col==="bio"){bg="#e8e0ff";for(let i=0;i<46;i++){const x=r()*W,y=r()*H,a=r()*180,l=7+r()*8,c=["#4a2bb3","#6a3fd6","#2e1a80"][i%3];o+=`<g transform="translate(${x} ${y}) rotate(${a})" stroke="${c}" stroke-width="4.4" stroke-linecap="round"><path d="M${-l/2} ${-l} L${l/2} ${l}"/><path d="M${l/2} ${-l} L${-l/2} ${l}"/></g>`}}
    else if(col==="ipe"){bg="#fbe0d8";for(let i=0;i<78;i++){const x=r()*W,y=r()*H,R=8+r()*2.6;o+=`<circle cx="${x}" cy="${y}" r="${R}" fill="#e0433a" opacity=".85"/><circle cx="${x}" cy="${y}" r="${R*.45}" fill="#f7b3a6" opacity=".9"/>`}}
    else if(col==="lab"){bg="#d9f3e4";for(let x=0;x<=W;x+=30)o+=`<path d="M${x} 0V${H}" stroke="#16764a" stroke-width="${x%120===0?2.4:.8}"/>`;for(let y=0;y<=H;y+=30)o+=`<path d="M0 ${y}H${W}" stroke="#16764a" stroke-width="${y%120===0?2.4:.8}"/>`;for(let i=0;i<60;i++)o+=`<circle cx="${r()*W}" cy="${r()*H}" r="${2.4+r()*2}" fill="${i%5?"#0e5a8a":"#1c1626"}"/>`}
    else if(col==="gest"){bg="#fff1cf";let x=120;while(x<W){const w=2+Math.floor(r()*9);if(r()>.42)o+=`<rect x="${x}" y="14" width="${w}" height="92" fill="#22180a"/>`;x+=w+1}for(let i=0;i<26;i++)o+=`<circle cx="${r()*W}" cy="${r()*H}" r="${3+r()*7}" fill="#f2a71b" opacity=".62"/>`}
    else{bg="#d6e9ff";const t="celltissuestainslidesmearlab";for(let i=0;i<48;i++){const x=r()*W,y=r()*H;o+=`<circle cx="${x}" cy="${y}" r="${13+r()*5}" fill="#7dbbff" opacity=".66"/><text x="${x}" y="${y+5}" text-anchor="middle" font-family="Georgia,serif" font-size="15" fill="#10337f">${t[i%t.length]}</text>`}}
    return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><rect width="${W}" height="${H}" fill="${bg}"/>${o}</svg>`)}")`}

  document.documentElement.style.setProperty("--spec",specimen(folder));

  const top=document.querySelector(".top");
  if(top&&!top.querySelector(".spec")){const m=(top.querySelector(".eyebrow")?.textContent||"").split("·").pop().trim().replace(/ examen$/i,"");
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
})();
