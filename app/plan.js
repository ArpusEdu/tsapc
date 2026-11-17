/* Enfoque · organizador (lógica pura, sin DOM): el plan hasta cada examen y los avisos que insisten hasta que se hacen.
   Navegador: window.EnfoquePlan. Node: module.exports.
   - planExamen: reparte las sesiones que faltan de esa unidad (o asignatura) entre los días que quedan; la víspera es para repasar.
   - avisos: entregas de los próximos 7 días sin tachar (insisten cada día hasta tacharlas) y el estudio de hoy para un examen de
     los próximos 7 días, uno por examen (se calla al hacer una sesión de esa unidad hoy, al decir «Ya lo hice» o «Hoy no puedo»; vuelve mañana).
   Lo que se descarta se guarda en tsapc:v2 › personal.avisos = { "<id del aviso>": "AAAA-MM-DD" }.
   - ritmo, pendientesTiempo, tanda: cuánto lleva cada pendiente (de menos a más), el total para ponerse al día y
     «tengo X minutos». Los minutos que el estudiante pone a una entrega: personal.estimaciones; el ritmo medido: personal.ritmo. */
(function (root, f) { if (typeof module === "object" && module.exports) module.exports = f(); else root.EnfoquePlan = f(); })(this, function () {
  "use strict";
  var DIA = 864e5, MIN_DIA = 20, DIAS_RECUPERA = 2, AVISO_DIAS = 7, TOPE_REPASO = 8;
  /* MIN_DIA: minutos al día si el estudiante no dice otros. DIAS_RECUPERA: los últimos días antes del examen son para recuperar.
     AVISO_DIAS: el aviso de estudio sale desde 7 días antes. TOPE_REPASO: lo que vuelve en un día; el resto se reparte. */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clave(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function soloDia(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function difDias(a, b) { return Math.round((soloDia(a) - soloDia(b)) / DIA); }
  function tiene(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  /* El plan hasta un examen, en ratos de unos 10 min (cada sesión son dos: A = misterio y descubre; B = otros días, sin mirar y resuelve)
     y con los minutos al día que diga el estudiante (personal.prefs.minutosDia; 20 si no dice nada).
     o = { ex: {id, date}, sesiones: [{id, titulo, minutos}], estados: {id: {hecha, ratoA, paso}}, hoy: Date, minutosDia }
     Los 2 últimos días no se estudia nada nuevo: se recupera (test y tarjetas del examen) y se relee solo lo fallado.
     Devuelve { dias, pendientes, hechas, total, porDia, hoyToca:[{id, titulo, minutos, rato}], minutosHoy, minutosDia, necesarios,
     ritmo, fase, noDa, mensaje } o null si el examen ya pasó. */
  function minutosDia(v) { v = Math.round(+v); return isFinite(v) && v >= 5 && v <= 240 ? v : MIN_DIA; }
  /* ¿ya hizo el rato A? (las sesiones empezadas antes de los ratos lo tienen hecho si pasaron de «descubre») */
  function ratoAHecho(e) { return !!(e && (e.ratoA || +e.paso >= 2)); }
  function ratosDe(s, e) {
    var m = Math.max(1, Math.ceil((+s.minutos || 0) / 2)), out = [];
    if (!ratoAHecho(e)) out.push({ id: s.id, titulo: s.titulo, minutos: m, rato: "A", sesionMin: +s.minutos || 0 });
    out.push({ id: s.id, titulo: s.titulo, minutos: m, rato: "B", sesionMin: +s.minutos || 0 });
    return out;
  }
  function planExamen(o) {
    if (!o || !o.ex || !o.ex.date || !o.hoy) return null;
    var dias = difDias(o.ex.date, o.hoy);
    if (dias < 0) return null;
    var ses = Array.isArray(o.sesiones) ? o.sesiones : [], est = o.estados || {}, mDia = minutosDia(o.minutosDia);
    var estDe = function (x) { return tiene(est, x.id) && est[x.id] ? est[x.id] : null; };
    var pend = ses.filter(function (x) { var e = estDe(x); return !(e && e.hecha); });
    var hechas = ses.length - pend.length;
    var hechasHoy = ses.filter(function (x) { var e = estDe(x); return e && e.hecha === clave(o.hoy); }).length;
    var ratos = []; pend.forEach(function (x) { ratosDe(x, estDe(x)).forEach(function (r) { ratos.push(r); }); });
    var minPend = ratos.reduce(function (a, r) { return a + r.minutos; }, 0);
    var diasEstudio = Math.max(0, dias - DIAS_RECUPERA);
    var fase = dias === 0 ? "examen" : dias <= DIAS_RECUPERA ? "recupera" : pend.length ? "estudio" : "repaso";
    var necesarios = diasEstudio > 0 ? Math.ceil(minPend / diasEstudio) : minPend;
    var porDia = diasEstudio > 0 ? Math.ceil(pend.length / diasEstudio) : 0;
    var hoyToca = [], acc = 0;
    if (fase === "estudio") {
      var cap = Math.min(mDia, Math.max(1, necesarios));
      for (var i = 0; i < ratos.length; i++) { if (hoyToca.length && acc + ratos[i].minutos > cap) break; hoyToca.push(ratos[i]); acc += ratos[i].minutos; }
    }
    var noDa = fase === "estudio" && necesarios > mDia * 2;
    var ritmo = !pend.length ? "listo" : fase !== "estudio" ? "tarde" : necesarios <= mDia * 0.6 ? "holgado" : necesarios <= mDia ? "justo" : "apretado";
    var nS = pend.length + (pend.length === 1 ? " sesión" : " sesiones"), mensaje;
    if (fase === "examen") mensaje = "Hoy es el examen. Repasa solo lo que marcaste como difícil y confía en lo que ya sabes.";
    else if (fase === "recupera") mensaje = (dias === 1 ? "Mañana es el examen." : "Quedan 2 días: ya no toca aprender nada nuevo.") + " Hoy, recuperar: el test y las tarjetas del examen, y relee solo lo que falles." + (pend.length ? " Lo que entra de " + (pend.length === 1 ? "la sesión que falta" : "las " + pend.length + " sesiones que faltan") + " también sale ahí." : "") + (dias === 1 ? " Duerme: lo que repases hoy se fija esta noche." : "");
    else if (fase === "repaso") mensaje = "Has hecho todas las sesiones. Hasta el examen, repaso de hoy y tarjetas: así se queda.";
    else if (noDa) mensaje = "Quedan " + dias + " días y " + nS + " (unos " + duracion(minPend) + "): con " + mDia + " min al día no da para todas. Haz lo de hoy y el resto, con el repaso de la unidad y las tarjetas.";
    else mensaje = (hechasHoy && !hoyToca.length ? "Hoy ya cumpliste. " : "") + "Quedan " + dias + " días y " + nS + ": unos " + necesarios + " min al día" + (ritmo === "apretado" ? ". Va justo con tus " + mDia + " min: si hoy puedes, un rato más." : ritmo === "holgado" ? ", y te sobran días para repasar." : ".");
    return { noDa: noDa, dias: dias, pendientes: pend.length, hechas: hechas, total: ses.length, porDia: porDia, hoyToca: hoyToca, hechasHoy: hechasHoy,
      minutosHoy: acc, minutosDia: mDia, necesarios: necesarios, ritmo: ritmo, fase: fase, mensaje: mensaje };
  }

  /* Varios exámenes cerca: el tope es global. Con dos o más que piden algo hoy, un rato de cada uno.
     planes = [{ ex, plan }] (del más cercano al más lejano). Devuelve { items: [rato + {ex}], mensaje }. */
  var NUM_EX = ["", "Un", "Dos", "Tres", "Cuatro", "Cinco"];
  function repartir(planes) {
    var activos = (planes || []).filter(function (x) { return x && x.plan && x.plan.hoyToca && x.plan.hoyToca.length; });
    var con = function (r, ex) { var o = {}, k; for (k in r) if (tiene(r, k)) o[k] = r[k]; o.ex = ex; return o; };
    if (activos.length >= 2) return { items: activos.map(function (x) { return con(x.plan.hoyToca[0], x.ex); }), mensaje: (NUM_EX[activos.length] || activos.length) + " exámenes cerca: hoy, una de cada." };
    if (activos.length === 1) return { items: activos[0].plan.hoyToca.map(function (r) { return con(r, activos[0].ex); }), mensaje: "" };
    return { items: [], mensaje: "" };
  }

  /* Tras unos días sin estudiar: cuántos (si son 3 o más; si no, 0). activos = ["AAAA-MM-DD", ...] días con algo hecho. */
  function vuelta(activos, hoy) {
    var k = clave(hoy), ult = null;
    (activos || []).forEach(function (x) { if (typeof x === "string" && /^\d{4}-\d\d-\d\d$/.test(x) && x < k && (!ult || x > ult)) ult = x; });
    if (!ult || (activos || []).indexOf(k) >= 0) return 0;
    var p = ult.split("-"), n = difDias(hoy, new Date(+p[0], +p[1] - 1, +p[2]));
    return n >= 3 ? n : 0;
  }

  /* Los avisos de hoy, del más urgente al menos.
     o = { evs: [eventos preparados], entregadas: {id: iso}, descartados: {idAviso: "AAAA-MM-DD"}, hoy: Date,
           estudioHoy: function (examen) → true si ya se estudió hoy para ese examen }
     Cada aviso: { id, tipo:"entrega"|"estudio", evento, dias, nivel:"hoy"|"manana"|"pronto"|"semana", titulo, texto, accion } */
  function avisos(o) {
    if (!o || !o.hoy) return [];
    var hoy = o.hoy, k = clave(hoy), desc = o.descartados || {}, ent = o.entregadas || {}, out = [], vistos = {};
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
        if (d < 0 || d > AVISO_DIAS) return;
        /* un solo aviso por examen: si el mismo examen sale dos veces (examen y oral el mismo día de la misma unidad), uno */
        var mismo = (e.unidad || e.s || e.id) + "@" + clave(e.date);
        if (vistos[mismo]) return; vistos[mismo] = 1;
        var id = "estudio:" + e.id + ":" + k;
        if (tiene(desc, id)) return;
        if (o.estudioHoy && o.estudioHoy(e)) return;
        out.push({ id: id, tipo: "estudio", evento: e, dias: d, nivel: d === 0 ? "hoy" : d === 1 ? "manana" : d <= 3 ? "pronto" : "semana",
          titulo: e.titulo.replace(/^Examen · /, ""), texto: d === 0 ? "Examen hoy." : d === 1 ? "Examen mañana: toca repasar." : "Examen en " + d + " días: hoy toca estudiar un poco.",
          accion: "Ya lo hice", otra: "Hoy no puedo" });
      }
    });
    var peso = { hoy: 0, manana: 1, pronto: 2, semana: 3 };
    return out.sort(function (a, b) { return peso[a.nivel] - peso[b.nivel] || (a.tipo === "entrega" ? -1 : 1) - (b.tipo === "entrega" ? -1 : 1) || a.dias - b.dias; });
  }

  /* «Hoy no puedo»: el aviso se calla hasta mañana sin apuntar estudio. Se guarda como descartado y con la marca del día. */
  function noPuedo(descartados, id, hoy) { var o = descartar(descartados, id, hoy); o["nopuedo:" + clave(hoy)] = clave(hoy); return o; }
  function noPuedeHoy(descartados, hoy) { return tiene(descartados, "nopuedo:" + clave(hoy)); }

  /* descartar un aviso: devuelve el objeto nuevo (sin mutar) y limpia lo de hace más de 30 días */
  function descartar(descartados, id, hoy) {
    var o = {}, lim = clave(new Date(hoy.getTime() - 30 * DIA));
    for (var x in descartados) if (tiene(descartados, x) && typeof descartados[x] === "string" && descartados[x] >= lim) o[x] = descartados[x];
    o[id] = clave(hoy);
    return o;
  }

  /* ---------- tiempos: cuánto lleva cada pendiente, ordenado de menos a más ----------
     Estimaciones: sesión = sus minutos (ajustados a tu ritmo si ya se ha medido); repaso = 1,5 min por concepto;
     tarjeta = 0,7 min. Las entregas no tienen estimación: la pone el estudiante (personal.estimaciones.<id>). */
  var RATIO = { concepto: 1.5, tarjeta: 0.7 }, ORDEN_TIPO = { entrega: 0, sesion: 1, repaso: 2, tarjetas: 3 };
  function minutosDe(n, porUno) { n = +n || 0; return n > 0 ? Math.max(1, Math.ceil(n * porUno)) : 0; }
  function minValidos(v) { v = Math.round(+v); return isFinite(v) && v >= 1 && v <= 600 ? v : null; }

  /* el ritmo real: cuánto duran de verdad tus sesiones frente a lo previsto.
     o = { medidas: {id: minutos reales medidos}, sesiones: [{id, minutos}], estados: {id: {hecha}} }
     Solo cuentan las sesiones hechas con una medida creíble (al menos 3 min; lo que pase de 3 veces lo previsto se recorta:
     fue la pantalla abierta, no estudio). Con menos de 2 no se ajusta nada. Devuelve { factor, n, real, previsto } o null. */
  function ritmo(o) {
    if (!o || !o.medidas) return null;
    var med = o.medidas, est = o.estados || {}, real = 0, prev = 0, n = 0;
    (o.sesiones || []).forEach(function (s) {
      var m = +med[s.id], p = +s.minutos;
      if (!tiene(med, s.id) || !(m >= 3) || !(p > 0) || !(tiene(est, s.id) && est[s.id] && est[s.id].hecha)) return;
      real += Math.min(m, p * 3); prev += p; n++;
    });
    if (n < 2 || !prev) return null;
    var f = Math.min(2, Math.max(0.5, real / prev));
    return { factor: Math.round(f * 100) / 100, n: n, real: Math.round(real), previsto: Math.round(prev) };
  }

  /* la lista de pendientes con su tiempo, de menos a más (lo que no tiene tiempo, al final).
     o = { hoy: Date, factor: número (ritmo; 1 si no hay),
           repaso: número de cosas que vuelven hoy,
           tarjetas: [{u, titulo, n}] vencidas por unidad,
           sesiones: [{id, titulo, minutos, vence: Date, examen}] las que tocan por los exámenes cercanos,
           entregas: [{id, titulo, vence: Date}] sin tachar,
           estimaciones: {idEntrega: minutos} }
     Devuelve { items, total, sinEstimar }. Cada item: { id, tipo, titulo, detalle, minutos|null, vence|null, dias|null, divisible } */
  function pendientesTiempo(o) {
    o = o || {};
    var hoy = o.hoy || new Date(), f = +o.factor > 0 ? +o.factor : 1, est = o.estimaciones || {}, items = [];
    var dd = function (v) { return v ? Math.max(0, difDias(v, hoy)) : null; };
    if (+o.repaso > 0) items.push({ id: "repaso", tipo: "repaso", titulo: "Repaso de hoy", detalle: o.repaso + (o.repaso == 1 ? " cosa vuelve" : " cosas vuelven"), minutos: minutosDe(o.repaso, RATIO.concepto), vence: null, dias: null, divisible: true });
    (o.tarjetas || []).forEach(function (t) {
      if (!(+t.n > 0)) return;
      items.push({ id: "tarjetas:" + t.u, tipo: "tarjetas", u: t.u, titulo: "Tarjetas · " + t.titulo, detalle: t.n + (t.n == 1 ? " vencida" : " vencidas"), minutos: minutosDe(t.n, RATIO.tarjeta), vence: null, dias: null, divisible: true });
    });
    var vistas = {};
    (o.sesiones || []).forEach(function (s) {
      if (!s) return;
      var idI = "sesion:" + s.id + (s.rato ? ":" + s.rato : "");
      if (vistas[idI]) return; vistas[idI] = 1;
      items.push({ id: idI, tipo: "sesion", sid: s.id, rato: s.rato || null, titulo: s.titulo + (s.rato ? " · rato " + s.rato : ""),
        detalle: (s.rato === "A" ? "misterio y descubre" : s.rato === "B" ? "otros días, sin mirar y resuelve" : "sesión de estudio") + (s.examen ? " · para " + s.examen : ""),
        minutos: Math.max(1, Math.round((+s.minutos || 0) * f)), vence: s.vence || null, dias: dd(s.vence), divisible: false });
    });
    (o.entregas || []).forEach(function (e) {
      var m = tiene(est, e.id) ? minValidos(est[e.id]) : null;
      items.push({ id: "entrega:" + e.id, tipo: "entrega", eid: e.id, titulo: e.titulo, detalle: "entrega", minutos: m, vence: e.vence || null, dias: dd(e.vence), divisible: false });
    });
    items.sort(function (a, b) {
      if (a.minutos === null || b.minutos === null) return a.minutos === null && b.minutos === null ? (a.dias === null ? 99 : a.dias) - (b.dias === null ? 99 : b.dias) : a.minutos === null ? 1 : -1;
      return a.minutos - b.minutos || (a.dias === null ? 99 : a.dias) - (b.dias === null ? 99 : b.dias) || ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo];
    });
    var total = 0, sin = 0;
    items.forEach(function (x) { if (x.minutos === null) sin++; else total += x.minutos; });
    return { items: items, total: total, sinEstimar: sin };
  }

  /* «tengo X minutos»: una tanda con lo más urgente que quepa.
     Prioridad: lo que vence antes (entregas por su plazo, sesiones por la fecha de su examen); el repaso y las tarjetas
     no tienen plazo, pero vencen hoy: cuentan como «mañana». A igual urgencia, entrega > sesión > repaso > tarjetas.
     El repaso y las tarjetas se pueden partir (si quedan 3 min o más); una sesión o una entrega, no.
     Las entregas sin tiempo no entran: se devuelven aparte en sinTiempo si vencen en 2 días o menos.
     Devuelve { items: [item con minutos (y parcial:true si se parte)], usados, sobran, quedanFuera } */
  function tanda(items, minutos) {
    var cap = Math.max(0, Math.round(+minutos || 0)), urg = function (x) { return x.dias === null ? 1 : x.dias; };
    var cola = (items || []).slice().sort(function (a, b) {
      return urg(a) - urg(b) || ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo] || (a.minutos || 0) - (b.minutos || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    /* un rato de sesión (unos 10 min) entra aunque pase un poco: hasta un 30 % (mínimo 3 min) de lo que tienes */
    var holgura = Math.max(3, Math.round(cap * 0.3));
    var out = [], usados = 0, fuera = 0, sinTiempo = [];
    cola.forEach(function (x) {
      if (x.minutos === null) { if (x.dias !== null && x.dias <= 2) sinTiempo.push(x); return; }
      var libre = cap - usados;
      if (x.minutos <= libre || (x.rato && !usados && x.minutos <= libre + holgura)) { out.push(x); usados += x.minutos; return; }
      if (x.divisible && libre >= 3) { var p = {}; for (var k in x) if (tiene(x, k)) p[k] = x[k]; p.minutos = libre; p.parcial = true; out.push(p); usados += libre; return; }
      fuera++;
    });
    return { items: out, usados: usados, sobran: Math.max(0, cap - usados), quedanFuera: fuera, sinTiempo: sinTiempo };
  }

  /* 80 → «1 h 20 min»; 45 → «45 min» */
  function duracion(min) {
    min = Math.max(0, Math.round(+min || 0));
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + " h" + (m ? " " + m + " min" : "") : m + " min";
  }

  return { planExamen: planExamen, repartir: repartir, vuelta: vuelta, minutosDia: minutosDia, ratoAHecho: ratoAHecho, MIN_DIA: MIN_DIA, TOPE_REPASO: TOPE_REPASO,
    avisos: avisos, descartar: descartar, noPuedo: noPuedo, noPuedeHoy: noPuedeHoy, clave: clave, difDias: difDias,
    ritmo: ritmo, pendientesTiempo: pendientesTiempo, tanda: tanda, duracion: duracion, minValidos: minValidos, RATIO: RATIO };
});
