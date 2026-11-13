/* Copia de seguridad de tsapc: exporta e importa las claves de localStorage de tsapc (lista PERMITIDAS).
   El origen arpusedu.github.io es compartido con otros proyectos: sus claves no salen ni se pueden sobrescribir.
   Sin dependencias. En el navegador: window.tsapcCopia. En Node: module.exports. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.tsapcCopia = api;
})(typeof self !== "undefined" ? self : this, function () {
  const APP = "tsapc", FORMATO = 1;
  const BACKUP_KEY = "tsapc:backup-antes-de-importar";
  const MAX_BYTES = 5 * 1024 * 1024;   /* 5 MB: hay copias reales de más de 1 MB; bajar el límite podría impedir restaurarlas */
  const MAX_CLAVES = 5000, MAX_LARGO_CLAVE = 200;
  /* Ruido: solo la copia automática que crea el propio importador (evita copias dentro de copias). */
  /* tsapc:backup-v1 y tsapc:v2-corrupto duplican claves que ya van en la copia */
  const RUIDO = new Set([BACKUP_KEY, "tsapc:backup-v1", "tsapc:v2-corrupto"]);
  const PELIGROSAS = new Set(["__proto__", "constructor", "prototype"]);
  /* Solo claves de tsapc. Añadir aquí cualquier prefijo nuevo que usen las páginas. */
  const PERMITIDAS = [
    /^(bio|fisio|gest|ipe|ing|lab)\d+-(repaso|simulacro)-v\d+$/,   /* bio1-repaso-v1, fisio2-simulacro-v2... */
    /^(eng|lab)-[a-z0-9-]+$/,                                       /* eng-u12-exam-v2, lab-u1-test50... */
    /^bio\d+-(aprende|entender)-v\d+(:dias)?$/,                      /* bio3 aprende y entender */
    /^mc-(done|plant)$/,                                             /* centro 3D antiguo (ya pasado a tsapc:v2) */
    /^plan-estudio-v\d+-[a-z0-9-]+$/,                                /* planificador de cada repaso */
    /^pos:\/tsapc\//,                                                /* posición de lectura */
    /^tsapc:/                                                        /* rediseño Corte (tsapc:v2…) */
  ];
  const permitida = k => PERMITIDAS.some(r => r.test(k));

  const bytes = s => typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s).length : s.length * 3;
  const claveValida = k =>
    typeof k === "string" && k.length > 0 && k.length <= MAX_LARGO_CLAVE &&
    !PELIGROSAS.has(k) && !/[\u0000-\u001f\u007f]/.test(k);

  function leerTodo(storage) {
    const out = {};
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k === null || RUIDO.has(k) || !permitida(k)) continue;
      const v = storage.getItem(k);
      if (v !== null) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
    }
    return out;
  }

  function construirCopia(storage, origen, ahora) {
    return { app: APP, formato: FORMATO, exportado: (ahora || new Date()).toISOString(), origen: origen || "", claves: leerTodo(storage) };
  }

  function nombreArchivo(ahora) {
    return "tsapc-copia-" + (ahora || new Date()).toISOString().slice(0, 10) + ".json";
  }

  /* Devuelve {ok:true, claves:Map, formato, ignoradas} o {ok:false, error}. */
  function analizar(texto) {
    if (typeof texto !== "string" || !texto.trim()) return { ok: false, error: "El archivo está vacío." };
    if (bytes(texto) >= MAX_BYTES) return { ok: false, error: "El archivo es demasiado grande (máximo 5 MB)." };
    let j;
    try { j = JSON.parse(texto); } catch (_) { return { ok: false, error: "Ese archivo no es una copia válida." }; }
    if (!j || typeof j !== "object" || Array.isArray(j) || j.app !== APP) return { ok: false, error: "Ese archivo no es una copia de esta web." };
    let src, formato;
    if (j.formato === FORMATO && j.claves && typeof j.claves === "object" && !Array.isArray(j.claves)) { src = j.claves; formato = 1; }
    else if (j.formato === undefined && j.data && typeof j.data === "object" && !Array.isArray(j.data)) { src = j.data; formato = 0; } /* antiguo: {app,saved,data} */
    else if (typeof j.formato === "number" && j.formato > FORMATO) return { ok: false, error: "La copia es de una versión más nueva de la web." };
    else return { ok: false, error: "Ese archivo no es una copia válida." };
    const ks = Object.keys(src);
    if (ks.length > MAX_CLAVES) return { ok: false, error: "La copia tiene demasiadas claves." };
    const claves = new Map();
    let ignoradas = 0;
    for (const k of ks) {
      if (!claveValida(k)) return { ok: false, error: "La copia contiene una clave no permitida." };
      if (typeof src[k] !== "string") {
        if (formato === 0) { ignoradas++; continue; } /* el formato antiguo solo guardaba strings */
        return { ok: false, error: "La copia contiene un valor que no es texto." };
      }
      if (RUIDO.has(k) || !permitida(k)) { ignoradas++; continue; } /* claves ajenas a tsapc: no se tocan */
      claves.set(k, src[k]);
    }
    if (!claves.size) return { ok: false, error: "La copia no contiene progreso." };
    return { ok: true, claves, formato, ignoradas };
  }

  function resumen(storage, claves) {
    let existentes = 0;
    for (const k of claves.keys()) if (storage.getItem(k) !== null) existentes++;
    return { total: claves.size, existentes };
  }

  /* Guarda el estado actual y escribe solo las claves de la copia. Si algo falla, deja todo como estaba. */
  function importar(storage, claves, ahora) {
    const previo = leerTodo(storage);
    const prevBackup = storage.getItem(BACKUP_KEY);
    const copiaPrevia = JSON.stringify({ app: APP, formato: FORMATO, exportado: (ahora || new Date()).toISOString(), motivo: "antes-de-importar", claves: previo });
    try { storage.setItem(BACKUP_KEY, copiaPrevia); }
    catch (_) { return { ok: false, error: "No hay espacio para la copia de seguridad previa; no se ha cambiado nada." }; }
    const escritas = [];
    try {
      for (const [k, v] of claves) {
        const antes = storage.getItem(k);
        storage.setItem(k, v);
        escritas.push([k, antes]);
      }
    } catch (_) {
      for (const [k, antes] of escritas.reverse()) { try { antes === null ? storage.removeItem(k) : storage.setItem(k, antes); } catch (__) {} }
      try { prevBackup === null ? storage.removeItem(BACKUP_KEY) : storage.setItem(BACKUP_KEY, prevBackup); } catch (__) {}
      return { ok: false, error: "El navegador no deja guardar la copia; no se ha cambiado nada." };
    }
    return { ok: true, escritas: escritas.length };
  }

  /* Interfaz: enlaza los botones existentes y el de copiar. */
  function iniciar(o) {
    const { storage, msg, botonGuardar, entradaArchivo, botonCopiar } = o;
    const doc = o.document || document;
    const pie = n => n + (n === 1 ? " clave" : " claves");
    function texto() {
      const c = construirCopia(storage, location.origin);
      return Object.keys(c.claves).length ? JSON.stringify(c) : null;
    }
    botonGuardar.addEventListener("click", () => {
      const t = texto();
      if (!t) { msg.textContent = "Todavía no hay progreso que guardar."; return; }
      const url = URL.createObjectURL(new Blob([t], { type: "application/json" }));
      const a = doc.createElement("a"); a.href = url; a.download = nombreArchivo();
      doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      msg.textContent = "Copia guardada con " + pie(Object.keys(JSON.parse(t).claves).length) + ".";
    });
    if (botonCopiar) botonCopiar.addEventListener("click", async () => {
      const t = texto();
      if (!t) { msg.textContent = "Todavía no hay progreso que copiar."; return; }
      try { await navigator.clipboard.writeText(t); msg.textContent = "Copia en el portapapeles (" + pie(Object.keys(JSON.parse(t).claves).length) + ")."; }
      catch (_) { msg.textContent = "El navegador no permite copiar. Usa «Guardar copia de mi progreso»."; }
    });
    entradaArchivo.addEventListener("change", async ev => {
      const f = ev.target.files[0]; ev.target.value = ""; if (!f) return;
      if (f.size >= MAX_BYTES) { msg.textContent = "El archivo es demasiado grande (máximo 5 MB)."; return; }
      const r = analizar(await f.text());
      if (!r.ok) { msg.textContent = r.error; return; }
      const s = resumen(storage, r.claves);
      msg.textContent = "";
      const p = doc.createElement("span");
      p.textContent = "Se van a restaurar " + s.total + " claves; " + s.existentes + " ya existen y se sustituirán. No se borra nada más. ";
      const estilo = "appearance:none;font:inherit;font-weight:700;min-height:44px;padding:0 16px;border-radius:999px;border:0;background:#fff;color:#21124f;cursor:pointer;margin:6px 8px 0 0";
      const si = doc.createElement("button"); si.type = "button"; si.textContent = "Sí, restaurar"; si.style.cssText = estilo;
      const no = doc.createElement("button"); no.type = "button"; no.textContent = "Cancelar"; no.style.cssText = estilo;
      msg.append(p, si, no);
      no.addEventListener("click", () => { msg.textContent = "Restauración cancelada. No se ha cambiado nada."; });
      si.addEventListener("click", () => {
        const x = importar(storage, r.claves);
        if (!x.ok) { msg.textContent = x.error; return; }
        msg.textContent = "Copia restaurada (" + pie(x.escritas) + "). Actualizando…";
        setTimeout(() => location.reload(), 700);
      });
    });
  }

  return { APP, FORMATO, BACKUP_KEY, MAX_BYTES, RUIDO, permitida, construirCopia, nombreArchivo, analizar, resumen, importar, iniciar };
});
