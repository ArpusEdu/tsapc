/* Corte · lógica pura de la app (sin DOM): fechas, eventos, cuenta atrás, horas, progreso y planta.
   En el navegador: window.CorteLogica. En Node: module.exports (tests/app.test.mjs). */
(function (root, f) { var api = f(); if (typeof module === "object" && module.exports) module.exports = api; else root.CorteLogica = api; })(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var may = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  function escapar(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  /* «ingles» en la agenda es «ing» en el sistema de diseño */
  function sid(a) { return a === "ingles" ? "ing" : a; }
  function clave(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseDia(s) {
    var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(s || ""));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function hm(s) { var p = String(s).split(":"); return [+p[0], +p[1]]; }
  function soloDia(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function difDias(a, b) { return Math.round((soloDia(a) - soloDia(b)) / 864e5); }

  /* La hora real. ?hoy=AAAA-MM-DD cambia el día (conserva la hora real); ?hoy=AAAA-MM-DDTHH:MM fija también la hora. */
  function ahoraDesde(search, real) {
    real = real || new Date();
    var m = /[?&]hoy=(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/.exec(search || "");
    if (!m) return real;
    var d = new Date(+m[1], +m[2] - 1, +m[3], m[4] != null ? +m[4] : real.getHours(), m[5] != null ? +m[5] : real.getMinutes(), m[4] != null ? 0 : real.getSeconds());
    return isNaN(d) ? real : d;
  }
  /* desplazamiento fijo entre la hora simulada y la real, para que el reloj siga andando */
  function reloj(search) {
    var base = ahoraDesde(search, new Date()), off = base - new Date();
    return function () { return new Date(Date.now() + off); };
  }

  /* primera clase de esa asignatura ese día de la semana («14:45»), o null */
  function inicioClase(horario, s, d) {
    var dow = d.getDay(), best = null;
    (horario || []).forEach(function (h) { if (h.dia === dow && sid(h.asig) === s && (!best || h.inicio < best)) best = h.inicio; });
    return best;
  }

  /* eventos de la agenda con asignatura normalizada, fecha y vencimiento */
  function prepararEventos(agenda) {
    var horario = agenda && agenda.horario || [];
    return ((agenda && agenda.eventos) || []).map(function (e) {
      var o = {}; for (var k in e) if (Object.prototype.hasOwnProperty.call(e, k)) o[k] = e[k];
      o.s = sid(e.asig); o.date = parseDia(e.fecha);
      if (!o.date) return null;
      if (e.cierre) { var c = e.cierre.split("T"), dd = parseDia(c[0]), t = hm(c[1]); o.due = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate(), t[0], t[1]); }
      else if (e.hora) { var t2 = hm(e.hora); o.due = new Date(o.date.getFullYear(), o.date.getMonth(), o.date.getDate(), t2[0], t2[1]); }
      else { var cs = inicioClase(horario, o.s, o.date) || "14:45", t3 = hm(cs); o.due = new Date(o.date.getFullYear(), o.date.getMonth(), o.date.getDate(), t3[0], t3[1]); o.claseHora = cs; }
      return o;
    }).filter(Boolean);
  }

  /* lo urgente: entregas, exámenes y orales que no han vencido y no están tachados, del más cercano al más lejano */
  function pendientes(evs, hechas, n) {
    hechas = hechas || {};
    return evs.filter(function (e) { return e.due > n && !hechas[e.id]; }).sort(function (a, b) { return a.due - b.due; });
  }

  /* próximo examen: los de la agenda y las fechas de examen de las unidades (sin repetir unidad) */
  function proximoExamen(evs, unidades, horario, n) {
    var lista = evs.filter(function (e) { return e.tipo === "examen" || e.tipo === "oral"; });
    (unidades || []).forEach(function (u) {
      if (!u.fecha || lista.some(function (e) { return e.unidad === u.id; })) return;
      var d = parseDia(u.fecha); if (!d) return;
      var cs = inicioClase(horario, u.s, d) || "14:45", t = hm(cs);
      lista.push({ id: "unidad-" + u.id, tipo: "examen", s: u.s, unidad: u.id, titulo: "Examen · " + u.tema, fecha: u.fecha, date: d,
        due: new Date(d.getFullYear(), d.getMonth(), d.getDate(), t[0], t[1]), claseHora: cs });
    });
    return lista.filter(function (e) { return e.due > n; }).sort(function (a, b) { return a.due - b.due; })[0] || null;
  }

  /* «3 d 4 h», «2 h 05 min» (corta) o «02:05:09»; «cerrado» si ya pasó */
  function cuentaAtras(ms, corta) {
    if (!(ms > 0)) return "cerrado";
    var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    if (d > 0) return d + " d " + h + " h";
    if (corta) return h + " h " + pad(m) + " min";
    return pad(h) + ":" + pad(m) + ":" + pad(sec);
  }
  /* las tres casillas del LCD: horas, minutos y segundos; con un día o más, días, horas y minutos */
  function partes(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    if (s >= 86400) return [[String(Math.floor(s / 86400)), "d"], [pad(Math.floor(s % 86400 / 3600)), "h"], [pad(Math.floor(s % 3600 / 60)), "m"]];
    return [[pad(Math.floor(s / 3600)), "h"], [pad(Math.floor(s % 3600 / 60)), "m"], [pad(s % 60), "s"]];
  }
  /* 24 h → 12 h: «14:45» → «2:45 p. m.» (corta: «2:45 pm») */
  function h12(t, corta) {
    var p = hm(t), h = p[0] % 12 || 12, pm = p[0] >= 12;
    return h + ":" + pad(p[1]) + (corta ? (pm ? " pm" : " am") : (pm ? " p. m." : " a. m."));
  }
  function h12r(a, b) {
    var pa = hm(a)[0] >= 12, pb = hm(b)[0] >= 12;
    return pa === pb ? h12(a).replace(/ [ap]\. m\.$/, "") + "–" + h12(b) : h12(a) + "–" + h12(b);
  }
  /* una hora suelta según el formato elegido: «24», «12» o «ambas» */
  function hora(t, fmt) { return fmt === "12" ? h12(t, true) : fmt === "ambas" ? t + " (" + h12(t, true) + ")" : t; }
  function rango(a, b, fmt) { return fmt === "12" ? h12r(a, b) : fmt === "ambas" ? a + "–" + b + " (" + h12r(a, b) + ")" : a + "–" + b; }
  function formatoValido(f) { return f === "24" || f === "12" || f === "ambas" ? f : "ambas"; }

  function diaRelativo(d, n) {
    var k = difDias(d, n);
    return k === 0 ? "Hoy" : k === 1 ? "Mañana" : k === -1 ? "Ayer" : may(DIAS[d.getDay()]) + " " + d.getDate();
  }
  function fechaLarga(d) { return DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()]; }

  /* lunes a viernes de esta semana; en fin de semana, la que viene */
  function semana(n) {
    var wd = (n.getDay() + 6) % 7, lunes = new Date(n.getFullYear(), n.getMonth(), n.getDate() - wd + (wd > 4 ? 7 : 0));
    return [0, 1, 2, 3, 4].map(function (i) { return new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i); });
  }

  var TIPO = { "festivo": "Festivo", "no-lectivo": "Sin clase", "sin-clases": "Sin clases", "inicio": "Empieza el curso", "fin": "Último día de clase", "fin-trimestre": "Fin de trimestre", "recuperaciones": "Recuperaciones", "practicas": "Prácticas en empresa", "notas": "Entrega de notas", "reclamaciones": "Reclamaciones" };
  function infoDia(cal, evs, k) {
    var tipos = [], notas = [], ev = [];
    (cal || []).forEach(function (c) {
      if (c.fecha ? c.fecha === k : (k >= c.desde && k <= c.hasta)) { tipos.push(c.tipo); notas.push(c.nota || TIPO[c.tipo] || c.tipo); }
    });
    (evs || []).forEach(function (e) { if (e.fecha === k) ev.push(e); });
    var cls = [];
    if (tipos.indexOf("festivo") >= 0) cls.push("es-festivo");
    if (tipos.indexOf("no-lectivo") >= 0 || tipos.indexOf("sin-clases") >= 0) cls.push("es-sinclase");
    if (tipos.indexOf("practicas") >= 0) cls.push("es-practicas");
    if (tipos.indexOf("recuperaciones") >= 0) cls.push("es-recuperacion");
    if (["inicio", "fin", "fin-trimestre", "notas", "reclamaciones"].some(function (x) { return tipos.indexOf(x) >= 0; })) cls.push("es-clave");
    return { tipos: tipos, notas: notas, evs: ev, cls: cls };
  }

  /* cuántos bloques dominados de una unidad. Lee lo guardado en tsapc:v2 y, si la página de repaso
     ha seguido escribiendo en su clave antigua, también eso (gana el mayor). Nunca pasa del total. */
  function progreso(total, dominadosV2, crudoAntiguo) {
    var a = Array.isArray(dominadosV2) ? dominadosV2.length : 0, b = 0;
    if (typeof crudoAntiguo === "string") {
      try { var o = JSON.parse(crudoAntiguo); if (o && typeof o === "object" && o.done && typeof o.done === "object") b = Object.keys(o.done).filter(function (k) { return o.done[k]; }).length; } catch (_) {}
    }
    var hechos = Math.min(Math.max(a, b), total > 0 ? total : 0);
    return { hechos: hechos, total: total > 0 ? total : 0, pct: total > 0 ? Math.round(hechos / total * 100) : 0 };
  }

  /* planta: un día por cada día con algo tachado. Devuelve la lista nueva (no muta la recibida). */
  function planta(dias, k, hayHecha) {
    var l = Array.isArray(dias) ? dias.filter(function (x) { return typeof x === "string"; }) : [];
    var i = l.indexOf(k);
    if (hayHecha && i < 0) l.push(k);
    if (!hayHecha && i >= 0) l.splice(i, 1);
    return l;
  }

  var NUM = ["ninguna", "una", "dos", "tres", "cuatro", "cinco", "seis"];
  function resumenHoy(evs, hechas, n, ex) {
    var k = clave(n), hoy = evs.filter(function (e) { return e.tipo === "entrega" && e.fecha === k; });
    var quedan = hoy.filter(function (e) { return !(hechas || {})[e.id]; }).length;
    var a = quedan ? "Hoy, " + (quedan === 1 ? "una entrega" : (NUM[quedan] || quedan) + " entregas") + "." : (hoy.length ? "Hoy, todo entregado." : "Hoy, sin entregas.");
    if (!ex) return a;
    var r = diaRelativo(ex.date, n);
    return a + " " + (r === "Hoy" ? "Hoy toca examen." : r + ", examen.");
  }

  /* ---------- colección de temas dominados (Mi mesa · tsapc:v2 › personal.coleccion) ----------
     {<unidad>: {desde:"AAAA-MM-DD", ultimo:"AAAA-MM-DD", vista:bool}}. Nunca se borra nada: solo se añade o se refresca. */
  function coleccionLimpia(c) {
    var out = {}; if (!c || typeof c !== "object" || Array.isArray(c)) return out;
    for (var k in c) if (Object.prototype.hasOwnProperty.call(c, k) && c[k] && typeof c[k] === "object" && /^\d{4}-\d{2}-\d{2}$/.test(c[k].desde)) {
      out[k] = { desde: c[k].desde, ultimo: /^\d{4}-\d{2}-\d{2}$/.test(c[k].ultimo) ? c[k].ultimo : c[k].desde, vista: c[k].vista === true };
    }
    return out;
  }
  /* añade las unidades al 100 % que falten; devuelve {col, nuevas:[ids]} */
  function estampar(col, completas, hoy) {
    var c = coleccionLimpia(col), nuevas = [];
    (completas || []).forEach(function (id) { if (!c[id]) { c[id] = { desde: hoy, ultimo: hoy, vista: false }; nuevas.push(id); } });
    return { col: c, nuevas: nuevas };
  }
  /* se ha repasado algo de la unidad: recupera el color (solo si ya está en la colección) */
  function refrescar(col, id, hoy) {
    var c = coleccionLimpia(col); if (c[id] && c[id].ultimo < hoy) c[id].ultimo = hoy; return c;
  }
  function marcarVistas(col) { var c = coleccionLimpia(col); for (var k in c) c[k].vista = true; return c; }
  /* 0 = viva (menos de 7 días), 1 = algo pálida (7–13), 2 = pálida (14–29), 3 = muy pálida (30 o más). Nunca desaparece. */
  function palidez(entrada, hoy) {
    if (!entrada) return 0;
    var d = difDias(parseDia(hoy), parseDia(entrada.ultimo));
    return d >= 30 ? 3 : d >= 14 ? 2 : d >= 7 ? 1 : 0;
  }

  return { DIAS: DIAS, MESES: MESES, TIPO: TIPO, pad: pad, may: may, escapar: escapar, sid: sid, clave: clave, parseDia: parseDia, hm: hm, difDias: difDias,
    ahoraDesde: ahoraDesde, reloj: reloj, inicioClase: inicioClase, prepararEventos: prepararEventos, pendientes: pendientes, proximoExamen: proximoExamen,
    cuentaAtras: cuentaAtras, partes: partes, h12: h12, h12r: h12r, hora: hora, rango: rango, formatoValido: formatoValido, diaRelativo: diaRelativo, fechaLarga: fechaLarga,
    semana: semana, infoDia: infoDia, progreso: progreso, planta: planta, resumenHoy: resumenHoy,
    coleccionLimpia: coleccionLimpia, estampar: estampar, refrescar: refrescar, marcarVistas: marcarVistas, palidez: palidez };
});
