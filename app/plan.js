/* Enfoque · organizador (lógica pura, sin DOM): el plan hasta cada examen y los avisos que insisten hasta que se hacen.
   Navegador: window.EnfoquePlan. Node: module.exports.
   - planExamen: reparte las sesiones que faltan de esa unidad (o asignatura) entre los días que quedan; la víspera es para repasar.
   - avisos: entregas de los próximos 7 días sin tachar (insisten cada día hasta tacharlas) y el estudio de hoy para un examen de
     los próximos 14 días (se calla al hacer una sesión de esa unidad hoy o al decir «ya estudié hoy»; vuelve mañana).
   Lo que se descarta se guarda en tsapc:v2 › personal.avisos = { "<id del aviso>": "AAAA-MM-DD" }. */
(function (root, f) { if (typeof module === "object" && module.exports) module.exports = f(); else root.EnfoquePlan = f(); })(this, function () {
  "use strict";
  var DIA = 864e5, MAX_DIA = 3;   /* más de 3 sesiones al día no es realista: se dice claro y se prioriza */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clave(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function soloDia(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function difDias(a, b) { return Math.round((soloDia(a) - soloDia(b)) / DIA); }
  function tiene(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  /* El plan hasta un examen.
     o = { ex: {id, date}, sesiones: [{id, titulo, minutos}], estados: {id: {hecha:"AAAA-MM-DD"}}, hoy: Date }
     Devuelve { dias, pendientes, hechas, total, porDia, hoyToca:[sesiones], minutosHoy, ritmo, fase, mensaje } o null si el examen ya pasó. */
  function planExamen(o) {
    if (!o || !o.ex || !o.ex.date || !o.hoy) return null;
    var dias = difDias(o.ex.date, o.hoy);
    if (dias < 0) return null;
    var ses = Array.isArray(o.sesiones) ? o.sesiones : [], est = o.estados || {};
    var hechaHoy = function (x) { return tiene(est, x.id) && est[x.id] && est[x.id].hecha === clave(o.hoy); };
    var pend = ses.filter(function (x) { return !(tiene(est, x.id) && est[x.id] && est[x.id].hecha); });
    var hechas = ses.length - pend.length;
    /* la víspera y el mismo día no se estudia nada nuevo: se repasa */
    var diasEstudio = Math.max(0, dias - 1);
    var fase = dias === 0 ? "examen" : dias === 1 ? "vispera" : pend.length ? "estudio" : "repaso";
    var porDia = diasEstudio > 0 ? Math.ceil(pend.length / diasEstudio) : 0;
    var noDa = porDia > MAX_DIA;
    var hoyToca = fase === "estudio" ? pend.slice(0, Math.min(porDia, MAX_DIA)) : [];
    var hechasHoy = ses.filter(hechaHoy).length;
    var minutosHoy = hoyToca.reduce(function (a, x) { return a + (+x.minutos || 0); }, 0);
    var ritmo = !pend.length ? "listo" : fase !== "estudio" ? "tarde" : porDia <= 1 ? "holgado" : porDia === 2 ? "justo" : "apretado";
    var mensaje;
    if (fase === "examen") mensaje = "Hoy es el examen. Repasa solo lo que marcaste como difícil y confía en lo que ya sabes.";
    else if (fase === "vispera") mensaje = pend.length ? "Mañana es el examen. No empieces nada nuevo: repasa las tarjetas y lo que te costó. Te quedaron " + pend.length + (pend.length === 1 ? " sesión" : " sesiones") + " sin hacer; míralas en el repaso de la unidad." : "Mañana es el examen. Hoy toca un repaso tranquilo: tarjetas y lo que te costó.";
    else if (fase === "repaso") mensaje = "Has hecho todas las sesiones. Hasta el examen, repaso de hoy y tarjetas: así se queda.";
    else if (noDa) mensaje = "Quedan " + dias + " días y " + pend.length + " sesiones: no da tiempo a todas. Haz " + MAX_DIA + " al día (unos " + minutosHoy + " min) y el resto, con el repaso de la unidad y las tarjetas.";
    else mensaje = (hechasHoy && !hoyToca.length ? "Hoy ya cumpliste. " : "") + "Quedan " + dias + " días y " + pend.length + (pend.length === 1 ? " sesión" : " sesiones") + ": " + (porDia === 1 ? "una al día" : porDia + " al día") + (ritmo === "apretado" ? ". Va justo: si hoy puedes, haz una más." : ritmo === "holgado" && pend.length < diasEstudio ? ", y te sobran días para repasar." : ".");
    return { noDa: noDa, dias: dias, pendientes: pend.length, hechas: hechas, total: ses.length, porDia: porDia, hoyToca: hoyToca, hechasHoy: hechasHoy, minutosHoy: minutosHoy, ritmo: ritmo, fase: fase, mensaje: mensaje };
  }

  /* Los avisos de hoy, del más urgente al menos.
     o = { evs: [eventos preparados], entregadas: {id: iso}, descartados: {idAviso: "AAAA-MM-DD"}, hoy: Date,
           estudioHoy: function (examen) → true si ya se estudió hoy para ese examen }
     Cada aviso: { id, tipo:"entrega"|"estudio", evento, dias, nivel:"hoy"|"manana"|"pronto"|"semana", titulo, texto, accion } */
  function avisos(o) {
    if (!o || !o.hoy) return [];
    var hoy = o.hoy, k = clave(hoy), desc = o.descartados || {}, ent = o.entregadas || {}, out = [];
    (o.evs || []).forEach(function (e) {
      if (!e || !e.date) return;
      var d = difDias(e.date, hoy);
      if (e.tipo === "entrega") {
        if (d < 0 || d > 7 || (tiene(ent, e.id) && ent[e.id])) return;
        if (e.due && e.due < hoy) return;                                   /* ya cerró: no se insiste */
        out.push({ id: "entrega:" + e.id, tipo: "entrega", evento: e, dias: d, nivel: d === 0 ? "hoy" : d === 1 ? "manana" : d <= 3 ? "pronto" : "semana",
          titulo: e.titulo, texto: (d === 0 ? "Se entrega hoy" : d === 1 ? "Se entrega mañana" : "Se entrega en " + d + " días") + (e.hora ? ", a las " + e.hora : "") + "." + (e.nota ? " " + e.nota + "." : ""),
          accion: "Ya lo entregué" });
      } else if (e.tipo === "examen" || e.tipo === "oral") {
        if (d < 0 || d > 14) return;
        var id = "estudio:" + e.id + ":" + k;
        if (tiene(desc, id)) return;
        if (o.estudioHoy && o.estudioHoy(e)) return;
        out.push({ id: id, tipo: "estudio", evento: e, dias: d, nivel: d === 0 ? "hoy" : d === 1 ? "manana" : d <= 3 ? "pronto" : "semana",
          titulo: e.titulo.replace(/^Examen · /, ""), texto: d === 0 ? "Examen hoy." : d === 1 ? "Examen mañana: toca repasar." : "Examen en " + d + " días: hoy toca estudiar un poco.",
          accion: "Ya estudié hoy" });
      }
    });
    var peso = { hoy: 0, manana: 1, pronto: 2, semana: 3 };
    return out.sort(function (a, b) { return peso[a.nivel] - peso[b.nivel] || (a.tipo === "entrega" ? -1 : 1) - (b.tipo === "entrega" ? -1 : 1) || a.dias - b.dias; });
  }

  /* descartar un aviso: devuelve el objeto nuevo (sin mutar) y limpia lo de hace más de 30 días */
  function descartar(descartados, id, hoy) {
    var o = {}, lim = clave(new Date(hoy.getTime() - 30 * DIA));
    for (var x in descartados) if (tiene(descartados, x) && typeof descartados[x] === "string" && descartados[x] >= lim) o[x] = descartados[x];
    o[id] = clave(hoy);
    return o;
  }

  return { planExamen: planExamen, avisos: avisos, descartar: descartar, clave: clave, difDias: difDias };
});
