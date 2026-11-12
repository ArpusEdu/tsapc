/* Capa de datos única de tsapc: clave tsapc:v2 + migración de las claves antiguas.
   Las claves antiguas NUNCA se borran ni se modifican. Sin dependencias.
   En el navegador: window.tsapcStore. En Node: module.exports. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.tsapcStore = api;
})(typeof self !== "undefined" ? self : this, function (root) {
  const CLAVE = "tsapc:v2", BACKUP = "tsapc:backup-v1", CORRUPTO = "tsapc:v2-corrupto";
  const SCHEMA = 1;
  const UNIDADES = ["bio1", "bio2", "bio3", "fisio1", "fisio2", "fisio3", "fisio4", "gest1", "gest2",
    "ingles1", "ipe2", "ipe-tema4", "ipe-tema5", "lab1", "lab2"];
  /* id antiguo (prefijo de la clave o EXAM.id) -> carpeta */
  const ALIAS = { ing1: "ingles1", ipe5: "ipe-tema5", ipe3: "ipe-tema5", ipe4: "ipe-tema4" };
  const INGLES = {
    "eng-u12-exam-v2": "examen", "eng-u12-simulacro-v1": "simulacro",
    "eng-lab-vocab-v2": "examenVocabulario", "eng-lab-vocab-full-v1": "simulacroVocabulario",
    "lab-words-learn-v1": "vocabulario"
  };
  const LAB1 = { "lab-u1-test50": "test50", "lab-u1-test50-b": "test50b", "lab-u1-test153": "banco" };
  const PELIGROSAS = new Set(["__proto__", "constructor", "prototype"]);
  const ANTIGUA = [
    /^(bio|fisio|gest|ipe|ing|lab)\d+-(repaso|simulacro)-v\d+$/, /^(eng|lab)-[a-z0-9-]+$/,
    /^plan-estudio-v\d+-[a-z0-9-]+$/, /^pos:\/tsapc\//
  ];
  const esAntigua = k => ANTIGUA.some(r => r.test(k));
  const esObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const tiene = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function poner(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true }); return v; }

  /* Copia profunda que descarta claves peligrosas. */
  function sanear(v, prof) {
    prof = prof || 0;
    if (prof > 50) return null;
    if (Array.isArray(v)) return v.map(x => sanear(x, prof + 1));
    if (esObj(v)) {
      const o = {};
      for (const k of Object.keys(v)) if (!PELIGROSAS.has(k)) poner(o, k, sanear(v[k], prof + 1));
      return o;
    }
    return v;
  }
  function parsear(txt) {
    if (typeof txt !== "string") return { ok: false };
    try { return { ok: true, v: sanear(JSON.parse(txt)) }; } catch (_) { return { ok: false }; }
  }
  const clonar = v => JSON.parse(JSON.stringify(v));

  /* ruta "a.b.c" o ["a","b"] -> array seguro, o null */
  function segmentos(ruta) {
    const s = Array.isArray(ruta) ? ruta : typeof ruta === "string" ? (ruta === "" ? [] : ruta.split(".")) : null;
    if (!s) return null;
    for (const x of s) if (typeof x !== "string" || x === "" || PELIGROSAS.has(x)) return null;
    return s;
  }

  /* Interpreta una clave antigua. Devuelve {tipo, unidad, ...} o null si no sabe colocarla. */
  function clasificar(k) {
    let m = /^([a-z]+\d+)-(repaso|simulacro)-v(\d+)$/.exec(k);
    if (m) {
      const u = ALIAS[m[1]] || m[1];
      return UNIDADES.includes(u) ? { tipo: m[2], unidad: u, ver: +m[3] } : null;
    }
    m = /^plan-estudio-v\d+-([a-z0-9-]+)$/.exec(k);
    if (m) { const u = ALIAS[m[1]] || m[1]; return UNIDADES.includes(u) ? { tipo: "plan", unidad: u } : null; }
    if (tiene(INGLES, k)) return { tipo: "ingles", campo: INGLES[k] };
    if (tiene(LAB1, k)) return { tipo: "lab1", campo: LAB1[k] };
    m = /^pos:\/tsapc\/([^/]+)\/(.+?)\/?$/.exec(k);
    if (m && UNIDADES.includes(m[1]) && !m[2].split("/").some(x => PELIGROSAS.has(x))) return { tipo: "pos", unidad: m[1], sub: m[2] };
    return null;
  }

  function convertirRepaso(o) {
    if (!esObj(o) || !esObj(o.done)) return null;
    const r = { dominados: Object.keys(o.done).filter(k => o.done[k]).map(k => /^\d+$/.test(k) ? Number(k) : k) };
    r.modo = typeof o.mode === "string" ? o.mode : "read";
    r.abiertos = esObj(o.open) ? Object.keys(o.open).filter(k => o.open[k]) : [];
    if (typeof o.f === "string") r.filtro = o.f;
    return r;
  }

  /* Construye el objeto v2 a partir de las claves antiguas (solo lectura). */
  function construir(crudas, ahora) {
    const iso = ahora.toISOString();
    const v2 = { schema: SCHEMA, creado: iso, actualizado: iso, unidades: {}, ingles: {}, lab1Tests: {},
      personal: { nombre: null, entregadas: {}, profes: {} }, meta: { migradoDe: [], version: 1 } };
    const sin = {};
    const versiones = {};
    const unidad = u => tiene(v2.unidades, u) ? v2.unidades[u] : poner(v2.unidades, u, {});
    const aSin = (k, raw) => poner(sin, k, raw);
    for (const k of Object.keys(crudas).sort()) {
      const raw = crudas[k], c = clasificar(k);
      if (!c) { aSin(k, raw); continue; }
      if (c.tipo === "pos") { unidad(c.unidad); const u = unidad(c.unidad); if (!u.pos) u.pos = {}; poner(u.pos, c.sub, raw); v2.meta.migradoDe.push(k); continue; }
      const p = parsear(raw);
      if (!p.ok || !esObj(p.v)) { aSin(k, raw); continue; }
      if (c.tipo === "ingles") { poner(v2.ingles, c.campo, p.v); v2.meta.migradoDe.push(k); continue; }
      if (c.tipo === "lab1") { poner(v2.lab1Tests, c.campo, p.v); v2.meta.migradoDe.push(k); continue; }
      let valor = p.v;
      if (c.tipo === "repaso") { valor = convertirRepaso(p.v); if (!valor) { aSin(k, raw); continue; } }
      const id = c.unidad + "/" + c.tipo;
      if (c.ver !== undefined && versiones[id] !== undefined) {
        /* dos versiones de la misma clave: gana la más nueva, la otra se conserva en crudo */
        if (c.ver > versiones[id].ver) { aSin(versiones[id].k, crudas[versiones[id].k]); const i = v2.meta.migradoDe.indexOf(versiones[id].k); if (i >= 0) v2.meta.migradoDe.splice(i, 1); }
        else { aSin(k, raw); continue; }
      }
      if (c.ver !== undefined) versiones[id] = { ver: c.ver, k };
      poner(unidad(c.unidad), c.tipo, valor);
      v2.meta.migradoDe.push(k);
    }
    v2.meta.migradoDe.sort();
    if (Object.keys(sin).length) v2.meta.sinInterpretar = sin;
    return v2;
  }

  /* Añade a `dst` solo lo que le falta de `src`. Devuelve true si cambió algo. Las hojas no se pisan. */
  function rellenar(dst, src) {
    let cambio = false;
    for (const k of Object.keys(src)) {
      if (PELIGROSAS.has(k)) continue;
      if (!tiene(dst, k)) { poner(dst, k, clonar(src[k])); cambio = true; }
      else if (esObj(dst[k]) && esObj(src[k])) { if (rellenar(dst[k], src[k])) cambio = true; }
    }
    return cambio;
  }

  function crear(opts) {
    opts = opts || {};
    const reloj = () => (opts.ahora ? new Date(typeof opts.ahora === "function" ? opts.ahora() : opts.ahora) : new Date());
    function almacen() {
      if (opts.storage) return opts.storage;
      try { return root && root.localStorage ? root.localStorage : null; } catch (_) { return null; }
    }
    const leer = k => { try { const s = almacen(); return s ? s.getItem(k) : null; } catch (_) { return null; } };
    const escribir = (k, v) => { try { const s = almacen(); if (!s) return false; s.setItem(k, v); return true; } catch (_) { return false; } };

    function leerAntiguas() {
      const out = {};
      try {
        const s = almacen(); if (!s) return out;
        for (let i = 0; i < s.length; i++) {
          const k = s.key(i);
          if (k === null || !esAntigua(k)) continue;
          const v = s.getItem(k);
          if (v !== null) poner(out, k, v);
        }
      } catch (_) {}
      return out;
    }

    function valido(o) { return esObj(o) && typeof o.schema === "number"; }
    function leerV2() {
      const raw = leer(CLAVE);
      if (raw === null) return { estado: "falta" };
      const p = parsear(raw);
      return p.ok && valido(p.v) ? { estado: "ok", v: p.v, raw } : { estado: "corrupto", raw };
    }

    function migrar() {
      const act = leerV2();
      if (act.estado === "corrupto") { if (leer(CORRUPTO) === null) escribir(CORRUPTO, act.raw); }
      const crudas = leerAntiguas();
      const nuevo = construir(crudas, reloj());
      if (act.estado === "ok") {
        if (act.v.schema > SCHEMA) return act.v;                 /* de una versión futura: no se toca */
        const v = act.v;
        const ids = new Set(Array.isArray(v.meta && v.meta.migradoDe) ? v.meta.migradoDe : []);
        const sinPrev = (v.meta && esObj(v.meta.sinInterpretar)) ? v.meta.sinInterpretar : {};
        /* solo se añade lo que falta; se ignora lo ya migrado o ya anotado como sin interpretar */
        const fuente = clonar(nuevo);
        for (const k of Object.keys(fuente.meta.sinInterpretar || {})) if (tiene(sinPrev, k)) delete fuente.meta.sinInterpretar[k];
        const nuevasIds = fuente.meta.migradoDe.filter(k => !ids.has(k));
        let cambio = rellenar(v, { unidades: fuente.unidades, ingles: fuente.ingles, lab1Tests: fuente.lab1Tests, personal: fuente.personal });
        if (!esObj(v.meta)) { v.meta = {}; cambio = true; }
        if (nuevasIds.length) { v.meta.migradoDe = Array.from(new Set([...ids, ...nuevasIds])).sort(); cambio = true; }
        const sinN = fuente.meta.sinInterpretar;
        if (sinN && Object.keys(sinN).length) {
          if (!esObj(v.meta.sinInterpretar)) v.meta.sinInterpretar = {};
          if (rellenar(v.meta.sinInterpretar, sinN)) cambio = true;
        }
        if (cambio) { v.actualizado = reloj().toISOString(); escribir(CLAVE, JSON.stringify(v)); }
        return v;
      }
      /* copia cruda de seguridad, una sola vez y antes de escribir nada */
      if (Object.keys(crudas).length && leer(BACKUP) === null) {
        const ok = escribir(BACKUP, JSON.stringify({ app: "tsapc", creado: nuevo.creado, claves: crudas }));
        if (!ok) return nuevo;                                    /* sin copia no se escribe: se devuelve en memoria */
      }
      escribir(CLAVE, JSON.stringify(nuevo));
      return nuevo;
    }

    function cargar() {
      const a = leerV2();
      return a.estado === "ok" ? a.v : migrar();
    }

    function get(ruta) {
      const s = segmentos(ruta); if (!s) return undefined;
      let x = cargar();
      for (const k of s) { if (!esObj(x) || !tiene(x, k)) return undefined; x = x[k]; }
      return x;
    }

    function set(ruta, valor) {
      const s = segmentos(ruta);
      if (!s || !s.length) return false;
      if (s[0] === "schema") return false;
      const v = cargar();                                        /* siempre sobre lo último guardado */
      let x = v;
      for (let i = 0; i < s.length - 1; i++) {
        if (!esObj(x[s[i]]) || !tiene(x, s[i])) poner(x, s[i], {});
        x = x[s[i]];
      }
      let limpio;
      try { limpio = valor === undefined ? null : sanear(JSON.parse(JSON.stringify(valor))); } catch (_) { return false; }
      poner(x, s[s.length - 1], limpio);
      v.actualizado = reloj().toISOString();
      return escribir(CLAVE, JSON.stringify(v));
    }

    /* No sustituye a copia.js: lo usa si está. */
    function exportar() {
      cargar();
      let copia = null;
      try { copia = root && root.tsapcCopia ? root.tsapcCopia : null; } catch (_) {}
      if (!copia && typeof module === "object" && typeof require === "function") { try { copia = require("./copia.js"); } catch (_) {} }
      const s = almacen();
      if (copia && s) {
        let origen = ""; try { origen = root.location && root.location.origin || ""; } catch (_) {}
        return copia.construirCopia(s, origen, reloj());
      }
      const raw = leer(CLAVE);
      const claves = {}; if (raw !== null) poner(claves, CLAVE, raw);
      return { app: "tsapc", formato: 1, exportado: reloj().toISOString(), origen: "", claves };
    }

    async function persistir() {
      try {
        const n = root && root.navigator;
        if (n && n.storage && typeof n.storage.persist === "function") return Boolean(await n.storage.persist());
      } catch (_) {}
      return false;
    }

    return { cargar, migrar, get, set, exportar, persistir };
  }

  const def = crear();
  return Object.assign({ crear, CLAVE, BACKUP, SCHEMA, UNIDADES, clasificar, construir }, def);
});
