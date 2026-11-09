/* Corte · motor de práctica (lógica pura, sin DOM). En el navegador: window.CorteQuiz. En Node: module.exports.
   Un intento guarda las respuestas con los índices ORIGINALES de las opciones; el barajado solo cambia lo que se ve.
   Tipos: test, vf, relacionar, esquema, escribir (puntúan solos) y abierta (se marca a mano: «La tenía bien / mal»). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CorteQuiz = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var TIPOS = { test: "Test", vf: "Verdadero o falso", relacionar: "Relacionar", esquema: "Esquemas", escribir: "Escribir", abierta: "Respuesta abierta" };
  var LETRAS = "abcdefghij";
  var tiene = function (o, k) { return o !== null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k); };

  /* ---------- azar estable ---------- */
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(semilla) {
    var a = typeof semilla === "number" ? semilla >>> 0 : hash(semilla);
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function barajar(lista, semilla) {
    var r = rng(semilla), a = lista.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function rango(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }

  /* ---------- texto ---------- */
  function plano(s) { return String(s == null ? "" : s).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\*\*?/g, "").replace(/\s+/g, " ").trim(); }
  /* normalizaciones de los simulacros originales, tal cual */
  function normIngles(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’‘`´]/g, "'").replace(/[.?!,;:]/g, "").replace(/\s+/g, " ").trim(); }
  function normEsquema(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim(); }
  function okEsquema(v, a) {
    var x = normEsquema(v); if (x.length < 3) return false;
    var base = normEsquema(a.replace(/\(.*?\)/g, ""));
    var alts = [base].concat((a.match(/\((.*?)\)/g) || []).reduce(function (acc, p) { return acc.concat(p.slice(1, -1).split(/[,/]| o /)); }, []).map(normEsquema)).filter(Boolean);
    return alts.some(function (c) { return c === x || (c.indexOf(x) === 0 && x.length >= Math.min(c.length, Math.max(5, c.length * 0.6))) || (x.indexOf(c) >= 0 && c.length >= 4); });
  }

  /* opciones que se refieren a otras por su posición: no se barajan */
  var REFIERE = /anteriores|^ambas\b|\b[a-d]\)\s*y\s*[a-d]\)|^\s*[a-d]\s*y\s*[a-d]\b/i;
  function barajable(q) { return q.tipo === "test" && !q.opciones.some(function (o) { return REFIERE.test(plano(o)); }); }

  /* ---------- intento ---------- */
  /* opts: {unidad, banco, preguntas:[q], modo:"practica"|"examen"|"falladas", semilla, minutos, barajar, ahora(ms), partes} */
  function crearIntento(opts) {
    var ahora = typeof opts.ahora === "number" ? opts.ahora : Date.now();
    var semilla = opts.semilla != null ? String(opts.semilla) : String(ahora);
    var ids = opts.preguntas.map(function (q) { return q.id; });
    var mezcla = opts.barajar !== false;
    var orden = mezcla ? barajar(ids, semilla + "|orden") : ids;
    var perm = {};
    opts.preguntas.forEach(function (q) {
      if (mezcla && barajable(q)) perm[q.id] = barajar(rango(q.opciones.length), semilla + "|" + q.id);
      else if (mezcla && q.tipo === "relacionar") perm[q.id] = barajar(rango(q.filas.length), semilla + "|" + q.id);
    });
    return {
      id: "i" + ahora.toString(36) + hash(semilla).toString(36).slice(0, 4),
      unidad: opts.unidad, banco: opts.banco, modo: opts.modo || "practica", partes: opts.partes || null,
      semilla: semilla, orden: orden, perm: perm, resp: {}, auto: {}, vistas: {}, pos: 0,
      inicio: ahora, limite: opts.minutos ? ahora + opts.minutos * 60000 : null, terminado: false
    };
  }

  /* La pregunta tal como se ve en este intento: opciones (o filas) en su orden barajado y la correcta reasignada. */
  function presentar(q, intento) {
    var p = intento && tiene(intento.perm, q.id) ? intento.perm[q.id] : null;
    if (q.tipo === "test") {
      var orden = p || rango(q.opciones.length);
      return { q: q, orden: orden, opciones: orden.map(function (i) { return q.opciones[i]; }), correcta: orden.indexOf(q.correcta) };
    }
    if (q.tipo === "vf") return { q: q, orden: [0, 1], opciones: ["Verdadero", "Falso"], correcta: q.correcta ? 0 : 1 };
    if (q.tipo === "relacionar") { var o = p || rango(q.filas.length); return { q: q, orden: o, filas: o.map(function (i) { return q.filas[i]; }) }; }
    return { q: q };
  }

  /* Respuesta a partir de lo que pulsa: posición mostrada → índice original (test) o booleano (vf). */
  function valorDesdePosicion(q, intento, pos) {
    if (q.tipo === "vf") return pos === 0;
    if (q.tipo === "test") { var v = presentar(q, intento); return pos >= 0 && pos < v.orden.length ? v.orden[pos] : undefined; }
    return undefined;
  }

  function responder(intento, qid, valor) {
    if (intento.terminado) return intento;
    if (valor === undefined || valor === null || valor === "") delete intento.resp[qid];
    else intento.resp[qid] = valor;
    return intento;
  }
  function autoevaluar(intento, qid, bien) { intento.auto[qid] = bien ? 1 : 0; return intento; }

  function contestada(q, r) {
    if (r === undefined || r === null) return false;
    if (q.tipo === "test") return typeof r === "number";
    if (q.tipo === "vf") return typeof r === "boolean";
    if (q.tipo === "abierta") return typeof r === "string" && r.trim() !== "";
    if (q.tipo === "relacionar") return Array.isArray(r) && q.filas.every(function (_, k) { return typeof r[k] === "number"; });
    if (q.tipo === "esquema" || q.tipo === "escribir") { var n = q.tipo === "esquema" ? q.respuestas.length : q.campos.length; return Array.isArray(r) && r.length >= n && r.slice(0, n).every(function (x) { return typeof x === "string" && x.trim() !== ""; }); }
    return false;
  }
  function porId(preguntas) { var m = {}; preguntas.forEach(function (q) { m[q.id] = q; }); return m; }
  /* ids sin contestar, en el orden del intento */
  function sinContestar(intento, preguntas) {
    var m = porId(preguntas);
    return intento.orden.filter(function (id) { return m[id] && !contestada(m[id], intento.resp[id]); });
  }

  function maximo(q) {
    if (q.tipo === "relacionar") return q.filas.length;
    if (q.tipo === "esquema") return q.respuestas.length;
    if (q.tipo === "escribir") return q.campos.length;
    return 1;
  }
  function textoOpcion(q, i) { return i === undefined || i === null ? "" : (q.tipo === "test" ? q.opciones[i] : ""); }

  /* Corrige una pregunta. auto = 1/0/undefined para las abiertas. Devuelve {puntos, max, ok, pendiente, dada, correcta, detalle} */
  function corregirPregunta(q, r, auto) {
    var max = maximo(q), puntos = 0, dada = "", buena = "", detalle = null, pendiente = false;
    if (q.tipo === "test") {
      puntos = r === q.correcta ? 1 : 0;
      dada = typeof r === "number" ? textoOpcion(q, r) : "";
      buena = q.opciones[q.correcta];
    } else if (q.tipo === "vf") {
      puntos = typeof r === "boolean" && r === q.correcta ? 1 : 0;
      dada = typeof r === "boolean" ? (r ? "Verdadero" : "Falso") : "";
      buena = q.correcta ? "Verdadero" : "Falso";
    } else if (q.tipo === "relacionar") {
      detalle = q.filas.map(function (f, k) { var v = Array.isArray(r) ? r[k] : undefined; return { ok: typeof v === "number" && f[1].indexOf(v) >= 0, dada: typeof v === "number" ? q.opciones[v] : "", buena: q.opciones[f[1][0]], texto: f[0] }; });
      puntos = detalle.filter(function (d) { return d.ok; }).length;
      dada = detalle.map(function (d) { return plano(d.texto) + " → " + (d.dada ? plano(d.dada) : "—"); }).join(" · ");
      buena = detalle.map(function (d) { return plano(d.texto) + " → " + plano(d.buena); }).join(" · ");
    } else if (q.tipo === "esquema") {
      detalle = q.respuestas.map(function (a, k) { var v = Array.isArray(r) ? r[k] : ""; return { ok: okEsquema(v, a) || (Array.isArray(auto) && auto[k] === 1), dada: v || "", buena: a }; });
      puntos = detalle.filter(function (d) { return d.ok; }).length;
      dada = detalle.map(function (d, k) { return (k + 1) + ". " + (d.dada || "—"); }).join(" · ");
      buena = q.respuestas.map(function (a, k) { return (k + 1) + ". " + a; }).join(" · ");
    } else if (q.tipo === "escribir") {
      detalle = q.campos.map(function (c, k) {
        var v = Array.isArray(r) ? r[k] : "";
        var ok = typeof v === "string" && c.aceptadas.map(normIngles).indexOf(normIngles(v)) >= 0;
        return { ok: ok, dada: v || "", buena: c.aceptadas[0], etiqueta: c.etiqueta || "" };
      });
      puntos = detalle.filter(function (d) { return d.ok; }).length;
      dada = detalle.map(function (d) { return (d.etiqueta ? d.etiqueta + " " : "") + (d.dada || "—"); }).join(" · ");
      buena = detalle.map(function (d) { return (d.etiqueta ? d.etiqueta + " " : "") + d.buena; }).join(" · ");
    } else if (q.tipo === "abierta") {
      pendiente = auto !== 1 && auto !== 0;
      puntos = auto === 1 ? 1 : 0;
      dada = typeof r === "string" ? r : "";
      buena = q.respuesta;
    }
    return { puntos: puntos, max: max, ok: puntos === max && !pendiente, pendiente: pendiente, dada: dada, correcta: buena, detalle: detalle };
  }

  function redondear(x) { return Math.round(x * 10) / 10; }
  /* Corrige todo el intento: nota sobre 10 (un decimal), desglose por tipo, falladas y abiertas por marcar. */
  function corregir(intento, preguntas) {
    var m = porId(preguntas), puntos = 0, max = 0, porTipo = {}, falladas = [], pendientes = [], porPregunta = {}, aciertos = 0;
    intento.orden.forEach(function (id) {
      var q = m[id]; if (!q) return;
      var c = corregirPregunta(q, intento.resp[id], intento.auto[id]);
      porPregunta[id] = c;
      puntos += c.puntos; max += c.max;
      var t = porTipo[q.tipo] || (porTipo[q.tipo] = { nombre: TIPOS[q.tipo], puntos: 0, max: 0, preguntas: 0, aciertos: 0 });
      t.puntos += c.puntos; t.max += c.max; t.preguntas++;
      if (c.ok) { t.aciertos++; aciertos++; }
      if (c.pendiente) pendientes.push(id); else if (!c.ok) falladas.push(id);
    });
    return { nota: max ? redondear(puntos / max * 10) : 0, puntos: puntos, max: max, preguntas: intento.orden.length, aciertos: aciertos, porTipo: porTipo, falladas: falladas, pendientes: pendientes, porPregunta: porPregunta };
  }

  function terminar(intento, ahora) { intento.terminado = true; intento.fin = typeof ahora === "number" ? ahora : Date.now(); return intento; }
  function restante(intento, ahora) { return intento.limite ? Math.max(0, intento.limite - ahora) : null; }
  function agotado(intento, ahora) { return !!intento.limite && ahora >= intento.limite; }

  /* ---------- historial ---------- */
  function resumen(intento, corr) {
    return { id: intento.id, fecha: new Date(intento.fin || intento.inicio).toISOString(), modo: intento.modo, banco: intento.banco, nota: corr.nota, puntos: corr.puntos, max: corr.max, preguntas: corr.preguntas, aciertos: corr.aciertos,
      segundos: intento.fin ? Math.round((intento.fin - intento.inicio) / 1000) : null,
      porTipo: Object.keys(corr.porTipo).reduce(function (o, k) { o[k] = { puntos: corr.porTipo[k].puntos, max: corr.porTipo[k].max }; return o; }, {}) };
  }
  /* Añade (o actualiza, si ya está por id) y deja como mucho `tope` intentos, los más nuevos. */
  function registrar(historial, r, tope) {
    var h = Array.isArray(historial) ? historial.filter(function (x) { return x && x.id !== r.id; }) : [];
    h.push(r); tope = tope || 60;
    return h.length > tope ? h.slice(h.length - tope) : h;
  }
  function mejor(historial) { var h = Array.isArray(historial) ? historial : []; return h.reduce(function (b, x) { return !b || x.nota > b.nota ? x : b; }, null); }
  function ultimo(historial) { var h = Array.isArray(historial) ? historial : []; return h.length ? h[h.length - 1] : null; }

  /* ---------- mazo de errores ---------- */
  /* Cada fallo se apunta con la respuesta dada y la correcta. Sale tras 2 aciertos seguidos. Devuelve {mazo, entran, salen}. */
  var SALIDA = 2;
  function apuntar(mazo, intento, preguntas, corr, ahora) {
    var out = {}, k; mazo = mazo && typeof mazo === "object" ? mazo : {};
    for (k in mazo) if (tiene(mazo, k)) out[k] = mazo[k];
    var m = porId(preguntas), entran = [], salen = [], fecha = new Date(typeof ahora === "number" ? ahora : Date.now()).toISOString();
    intento.orden.forEach(function (id) {
      var c = corr.porPregunta[id], q = m[id]; if (!c || !q || c.pendiente) return;
      if (!c.ok) {
        var prev = out[id];
        out[id] = { banco: intento.banco, tipo: q.tipo, texto: plano(q.texto || (q.hueco ? "(" + q.hueco + ")" : "")).slice(0, 220), dada: plano(c.dada).slice(0, 300) || "(sin contestar)", correcta: plano(c.correcta).slice(0, 300), veces: (prev ? prev.veces || 1 : 0) + 1, racha: 0, fecha: fecha };
        if (!prev) entran.push(id);
      } else if (tiene(out, id)) {
        var e = {}; for (var x in out[id]) if (tiene(out[id], x)) e[x] = out[id][x];
        e.racha = (e.racha || 0) + 1;
        if (e.racha >= SALIDA) { delete out[id]; salen.push(id); } else out[id] = e;
      }
    });
    return { mazo: out, entran: entran, salen: salen };
  }

  return { TIPOS: TIPOS, LETRAS: LETRAS, SALIDA: SALIDA, hash: hash, rng: rng, barajar: barajar, plano: plano, normIngles: normIngles, okEsquema: okEsquema, barajable: barajable,
    crearIntento: crearIntento, presentar: presentar, valorDesdePosicion: valorDesdePosicion, responder: responder, autoevaluar: autoevaluar,
    contestada: contestada, sinContestar: sinContestar, maximo: maximo, corregirPregunta: corregirPregunta, corregir: corregir, terminar: terminar,
    restante: restante, agotado: agotado, resumen: resumen, registrar: registrar, mejor: mejor, ultimo: ultimo, apuntar: apuntar };
});
