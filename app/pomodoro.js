/* Enfoque · Pomodoro: #/pomodoro (libre), #/pomodoro/sesion/<id> (con una sesión) y #/pomodoro/tanda/<min> (con una tanda de Hoy).
   Bloques de estudio y descansos (por defecto 25 + 5, y uno largo de 15 cada 4). El reloj es la hora real (Date.now()):
   cada fase guarda cuándo empezó y cuánto dura, y lo que queda se calcula; si el móvil bloquea la pantalla, al volver está al día.
   El intervalo de 1 s solo repinta; no cuenta nada.
   Guardado en tsapc:v2 › personal.pomodoro = { cfg, e (la fase en marcha), dias: {"AAAA-MM-DD": minutos}, registro: [...] }.
   Sin sonidos: al cambiar de fase, vibración (si el móvil la tiene), aviso en pantalla y un anuncio para el lector de pantalla.
   Navegador: window.EnfoquePomodoro.crear(ctx). Node: module.exports.L (lógica pura, para las pruebas). */
(function (root, f) {
  var api = f();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EnfoquePomodoro = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var MIN = 60000, DIA = 864e5;
  var DEF = { estudio: 25, descanso: 5, largo: 15, cada: 4, objetivo: 0 };
  var LIM = { estudio: [5, 90], descanso: [1, 30], largo: [5, 45], cada: [2, 8], objetivo: [0, 600] };
  var FASES = { estudio: "Estudio", descanso: "Descanso", largo: "Descanso largo" };
  function tiene(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clave(d) { d = new Date(d); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  /* ================= lógica pura ================= */
  function config(c) {
    var o = {};
    for (var k in DEF) if (tiene(DEF, k)) {
      var v = c && tiene(c, k) ? Math.round(+c[k]) : DEF[k];
      o[k] = isFinite(v) ? Math.min(LIM[k][1], Math.max(LIM[k][0], v)) : DEF[k];
    }
    return o;
  }
  /* la fase en marcha, limpia. fase null = parado. min = minutos nominales de la fase (lo que se apunta al terminarla). */
  function estado(v) {
    var e = v && typeof v === "object" ? v : {};
    var fase = tiene(FASES, e.fase) ? e.fase : null;
    if (!fase || !(+e.ini > 0) || !(+e.dur > 0)) return { fase: null, hechos: Math.max(0, +e.hechos || 0), origen: origen(e.origen) };
    return { fase: fase, ini: +e.ini, dur: +e.dur, min: Math.max(1, +e.min || Math.round(e.dur / MIN)), pausa: +e.pausa > 0 ? +e.pausa : null, hechos: Math.max(0, +e.hechos || 0), origen: origen(e.origen) };
  }
  function origen(o) {
    if (!o || typeof o !== "object" || typeof o.href !== "string" || !/^#\//.test(o.href)) return null;
    return { tipo: String(o.tipo || "").slice(0, 20), id: String(o.id || "").slice(0, 80), titulo: String(o.titulo || "").slice(0, 120), href: o.href.slice(0, 200) };
  }
  /* escala: solo para probar (con ?pomox=60 un minuto dura un segundo); lo apuntado son siempre los minutos nominales */
  function empezar(fase, min, ahora, hechos, org, escala) {
    return { fase: fase, ini: ahora, dur: min * MIN / (escala || 1), min: min, pausa: null, hechos: hechos || 0, origen: org || null };
  }
  function restante(e, ahora) {
    if (!e || !e.fase) return 0;
    return Math.max(0, e.ini + e.dur - (e.pausa || ahora));
  }
  function progreso(e, ahora) { return e && e.fase ? Math.min(1, Math.max(0, 1 - restante(e, ahora) / e.dur)) : 0; }
  function pausar(e, ahora) { if (!e.fase || e.pausa) return e; var o = copia(e); o.pausa = ahora; return o; }
  function seguir(e, ahora) { if (!e.fase || !e.pausa) return e; var o = copia(e); o.ini = e.ini + (ahora - e.pausa); o.pausa = null; return o; }
  function copia(e) { var o = {}; for (var k in e) if (tiene(e, k)) o[k] = e[k]; return o; }

  /* pone la fase al día. Si ha pasado más de una (pantalla bloqueada), las recorre todas.
     Al acabar un bloque de estudio se apunta y empieza el descanso (desde el final del bloque, no desde ahora);
     al acabar un descanso se para: el siguiente bloque lo empieza el estudiante.
     Devuelve { e, registros: [{fin, min, id}], cambios: ["descanso"|"largo"|"fin"] } */
  function avanzar(e, cfg, ahora, escala) {
    var reg = [], cambios = [], vueltas = 0;
    cfg = config(cfg);
    while (e && e.fase && !e.pausa && ahora >= e.ini + e.dur && vueltas++ < 6) {
      var fin = e.ini + e.dur;
      if (e.fase === "estudio") {
        var h = e.hechos + 1, largo = h % cfg.cada === 0, fase = largo ? "largo" : "descanso";
        reg.push({ fin: fin, min: e.min, id: e.origen ? e.origen.id : "" });
        e = empezar(fase, largo ? cfg.largo : cfg.descanso, fin, h, e.origen, escala);
        cambios.push(fase);
      } else {
        e = { fase: null, hechos: e.hechos, origen: e.origen };
        cambios.push("fin");
      }
    }
    return { e: e, registros: reg, cambios: cambios };
  }
  /* parar a medias: si era estudio, se apunta lo estudiado de verdad (minutos enteros, al menos 1) */
  function terminar(e, ahora, escala) {
    var r = null;
    if (e && e.fase === "estudio") {
      var hecho = Math.floor((e.dur - restante(e, ahora)) * (escala || 1) / MIN);
      if (hecho >= 1) r = { fin: e.pausa || ahora, min: Math.min(hecho, e.min), id: e.origen ? e.origen.id : "" };
    }
    return { e: { fase: null, hechos: e ? e.hechos : 0, origen: null }, registro: r };
  }
  /* apuntar un bloque: suma al día en que acabó y guarda los últimos 120 bloques */
  function apuntar(h, r) {
    var dias = {}, reg = Array.isArray(h && h.registro) ? h.registro.slice(-119) : [];
    var hd = h && h.dias && typeof h.dias === "object" ? h.dias : {};
    for (var k in hd) if (tiene(hd, k) && /^\d{4}-\d\d-\d\d$/.test(k) && +hd[k] > 0) dias[k] = +hd[k];
    if (r && r.min > 0) {
      var d = clave(r.fin);
      dias[d] = (dias[d] || 0) + r.min;
      reg.push({ dia: d, fin: new Date(r.fin).toISOString(), min: r.min, id: r.id || "" });
    }
    return { dias: dias, registro: reg };
  }
  /* tiempo efectivo de hoy y de esta semana (de lunes a hoy), y los 7 últimos días */
  function resumen(dias, hoy) {
    dias = dias || {}; hoy = new Date(hoy);
    var k = clave(hoy), dow = (hoy.getDay() + 6) % 7, semana = 0, ult = [];
    for (var i = 0; i <= dow; i++) semana += +dias[clave(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i))] || 0;
    for (var j = 6; j >= 0; j--) { var d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - j), kk = clave(d); ult.push({ dia: kk, d: d, min: +dias[kk] || 0 }); }
    return { hoy: +dias[k] || 0, semana: semana, ultimos: ult };
  }
  function mmss(ms) { var s = Math.ceil(Math.max(0, ms) / 1000); return pad(Math.floor(s / 60)) + ":" + pad(s % 60); }
  /* para el lector de pantalla: «24 minutos» / «40 segundos» (sin segundos sueltos cuando quedan minutos) */
  function dicho(ms) { var s = Math.ceil(Math.max(0, ms) / 1000), m = Math.ceil(s / 60); return s >= 60 ? m + (m === 1 ? " minuto" : " minutos") : s + (s === 1 ? " segundo" : " segundos"); }

  var L = { DEF: DEF, FASES: FASES, config: config, estado: estado, empezar: empezar, restante: restante, progreso: progreso, pausar: pausar, seguir: seguir, avanzar: avanzar, terminar: terminar, apuntar: apuntar, resumen: resumen, mmss: mmss, dicho: dicho, clave: clave };

  /* ================= la pantalla y el indicador ================= */
  function crear(ctx) {
    var esc = ctx.esc, ico = ctx.ico, $ = function (s, r) { return (r || document).querySelector(s); };
    var escala = (function () { var m = /[?&]pomox=(\d{1,3})/.exec(location.search); return m ? Math.max(1, +m[1]) : 1; })();
    var reloj = function () { return ctx.ahora().getTime(); };   /* Date.now() + el desfase fijo de ?hoy= (si lo hay) */
    function datos() { var p = ctx.leer("personal.pomodoro", {}); return p && typeof p === "object" ? p : {}; }
    function guardarTodo(o) { if (!ctx.guardar("personal.pomodoro", o)) ctx.aviso("No se pudo guardar. Revisa el espacio del navegador.", "error"); }
    function cfg() { return config(datos().cfg); }
    function est() { return estado(datos().e); }
    function poner(cambios) { var p = datos(), o = {}; for (var k in p) if (tiene(p, k)) o[k] = p[k]; for (var c in cambios) if (tiene(cambios, c)) o[c] = cambios[c]; guardarTodo(o); }

    /* ---------- el anillo del logo como progreso: la muesca de 36° es el hueco por donde entra el tiempo ---------- */
    var R = 19.5, C = 2 * Math.PI * R;
    function anillo() {
      return '<svg class="pomo-anillo" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
        '<circle class="pomo-campo" cx="24" cy="24" r="18"/>' +
        '<circle class="pomo-pista" cx="24" cy="24" r="' + R + '"/>' +
        '<path class="pomo-muesca" d="M41.37 15.15A19.5 19.5 0 0 0 32.85 6.63"/>' +
        '<circle class="pomo-avance" id="pomoArco" cx="24" cy="24" r="' + R + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + C.toFixed(2) + '" transform="rotate(-90 24 24)"/></svg>';
    }
    function controles(e) {
      if (!e.fase) return '<button type="button" class="boton" data-pomo="empezar">' + ico("siguiente") + (e.hechos ? "Otro bloque de estudio" : "Empezar a estudiar") + "</button>";
      var b = e.pausa ? '<button type="button" class="boton" data-pomo="seguir">' + ico("siguiente") + "Seguir</button>" : '<button type="button" class="boton" data-pomo="pausar">Pausar</button>';
      return b + (e.fase === "estudio" ? '<button type="button" class="boton secundario" data-pomo="terminar">Terminar el bloque</button>' : '<button type="button" class="boton secundario" data-pomo="saltar">Saltar el descanso</button>');
    }
    function etiquetaFase(e) { return e.fase ? FASES[e.fase] + (e.pausa ? " · en pausa" : "") : e.hechos ? "Parado · " + e.hechos + (e.hechos === 1 ? " bloque hecho" : " bloques hechos") : "Listo para empezar"; }
    function diaCorto(d) { return ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getDay()] + "<br>" + d.getDate(); }

    function pantalla(tipo, arg) {
      var c = cfg(), e = est(), p = datos(), n = reloj();
      /* llegar con algo concreto (una sesión o una tanda) lo apunta como origen del siguiente bloque */
      var org = e.origen, preMin = c.estudio;
      if (tipo === "sesion" && arg && /^[a-z0-9-]+$/.test(arg)) org = { tipo: "sesion", id: arg, titulo: ctx.tituloSesion ? ctx.tituloSesion(arg) || "" : "", href: "#/sesion/" + encodeURIComponent(arg) };
      if (tipo === "tanda" && +arg > 0) { preMin = Math.min(90, Math.max(5, Math.round(+arg))); org = { tipo: "tanda", id: "tanda-" + preMin, titulo: "tu tanda de " + preMin + " min", href: "#/hoy" }; }
      if (!e.fase && (tipo === "sesion" || tipo === "tanda")) { pendienteOrigen = { org: org, min: preMin }; }
      else if (!tipo) pendienteOrigen = null;
      var r = resumen(p.dias, new Date(n)), obj = c.objetivo;
      var orgVer = e.fase ? e.origen : pendienteOrigen ? pendienteOrigen.org : null;
      var minBloque = pendienteOrigen && !e.fase ? pendienteOrigen.min : c.estudio;
      var hist = r.ultimos.map(function (x) {
        var alto = Math.round(Math.min(1, x.min / Math.max(60, obj || 0, maxDe(r.ultimos))) * 100);
        return '<li' + (x.min ? "" : ' class="cero"') + '><span class="pomo-barra" aria-hidden="true"><i style="height:' + alto + '%"></i></span><span class="pomo-dia">' + diaCorto(x.d) + '</span>' + (x.min ? '<span class="num">' + x.min + '<span class="sr"> minutos</span></span>' : '<span class="num cero" aria-hidden="true">·</span><span class="sr">sin bloques</span>') + '</li>';
      }).join("");
      var html = '<header class="cab">' + ctx.titulo("Pomo<em>doro</em>") +
        '<p class="sub">' + c.estudio + " min de estudio y " + c.descanso + " de descanso. Cada " + c.cada + " bloques, uno largo de " + c.largo + ".</p></header>" +
        '<section class="pomo" aria-labelledby="hPomo"><h2 class="sr" id="hPomo">Temporizador</h2>' +
        '<div class="pomo-esfera" data-fase="' + (e.fase || "parado") + '"' + (e.pausa ? ' data-pausa=""' : "") + ">" + anillo() +
        '<div class="pomo-lectura"><p class="pomo-fase" id="pomoFase">' + esc(etiquetaFase(e)) + '</p>' +
        '<p class="pomo-tiempo num" role="timer" aria-labelledby="pomoFase" id="pomoTiempo">' + mmss(e.fase ? restante(e, n) : minBloque * MIN) + "</p>" +
        '<p class="pomo-ciclo" id="pomoCiclo">' + cicloTxt(e, c) + "</p></div></div>" +
        (orgVer ? '<p class="pomo-origen">Con <a href="' + esc(orgVer.href) + '">' + esc(orgVer.titulo || "lo que estabas haciendo") + "</a></p>" : "") +
        '<div class="acciones pomo-acc" id="pomoAcc">' + controles(e) + "</div>" +
        '<p class="pomo-nota">Puedes bloquear el móvil: al volver, el tiempo está al día. Al cambiar de fase, vibra (si tu móvil puede) y lo verás aquí.</p></section>' +
        '<div class="rejilla pomo-rejilla"><section aria-labelledby="hPomoT"><div class="sec-cab"><h2 id="hPomoT">Tiempo estudiado</h2><span class="sec-nota">solo bloques de estudio</span></div>' +
        '<dl class="pomo-cifras"><div><dt>Hoy</dt><dd class="num">' + esc(ctx.duracion(r.hoy)) + "</dd></div><div><dt>Esta semana</dt><dd class=\"num\">" + esc(ctx.duracion(r.semana)) + "</dd></div></dl>" +
        (obj ? '<div class="progreso"><div class="progreso-txt"><span>Objetivo de hoy: ' + esc(ctx.duracion(obj)) + '</span><b class="num">' + Math.min(100, Math.round(r.hoy / obj * 100)) + ' %</b></div><div class="progreso-barra" role="progressbar" aria-label="Objetivo de hoy" aria-valuemin="0" aria-valuemax="' + obj + '" aria-valuenow="' + Math.min(obj, r.hoy) + '" aria-valuetext="' + r.hoy + " de " + obj + ' minutos"><i style="width:' + Math.min(100, Math.round(r.hoy / obj * 100)) + '%"></i></div></div>' + (r.hoy >= obj ? '<p class="pomo-cumplido">' + ico("check") + "Objetivo de hoy cumplido. Lo que sigas es extra.</p>" : "") : '<p class="tramo-nota">Sin objetivo diario. Puedes ponerlo en los ajustes.</p>') +
        '<h3 class="pomo-h3">Últimos 7 días</h3><ol class="pomo-hist">' + hist + "</ol></section>" +
        '<section aria-labelledby="hPomoA"><div class="sec-cab"><h2 id="hPomoA">Ajustes</h2><span class="sec-nota">en minutos</span></div>' +
        '<form class="pomo-ajustes" id="pomoAjustes">' +
        campo("estudio", "Estudio", c.estudio) + campo("descanso", "Descanso", c.descanso) + campo("largo", "Descanso largo", c.largo) + campo("cada", "Largo cada (bloques)", c.cada) + campo("objetivo", "Objetivo diario (0 = sin objetivo)", c.objetivo) +
        '<div class="acciones"><button type="submit" class="boton secundario">Guardar ajustes</button></div></form></section></div>';
      return { sec: "hoy", titulo: "Pomodoro", html: html, montar: function () { pintarReloj(); } };
    }
    function maxDe(l) { var m = 0; l.forEach(function (x) { if (x.min > m) m = x.min; }); return m; }
    function campo(k, et, v) { return '<label class="pomo-campo-aj"><span>' + esc(et) + '</span><input type="number" inputmode="numeric" name="' + k + '" min="' + LIM[k][0] + '" max="' + LIM[k][1] + '" value="' + v + '"></label>'; }
    function cicloTxt(e, c) {
      var h = e.hechos % c.cada, prox = e.fase === "estudio" ? h + 1 : h;
      return e.fase === "estudio" ? "bloque " + prox + " de " + c.cada : e.fase ? (e.fase === "largo" ? "después, ronda nueva" : "llevas " + h + " de " + c.cada) : "";
    }
    var pendienteOrigen = null;

    /* ---------- el pulso: pone la fase al día y repinta (no cuenta) ---------- */
    function pulso() {
      var p = datos(), e = estado(p.e), c = config(p.cfg), n = reloj();
      if (e.fase && !e.pausa && n >= e.ini + e.dur) {
        var r = avanzar(e, c, n, escala), h = { dias: p.dias, registro: p.registro };
        r.registros.forEach(function (x) { h = apuntar(h, x); });
        poner({ e: r.e, dias: h.dias, registro: h.registro });
        if (/^#\/pomodoro/.test(location.hash)) refrescar();
        avisar(r.cambios[r.cambios.length - 1], r.e, c);
      }
      pintarReloj();
    }
    function avisar(cambio, e, c) {
      var t = cambio === "fin" ? "Descanso terminado. Cuando quieras, otro bloque." : cambio === "largo" ? "Bloque hecho. Descanso largo: " + c.largo + " min. Levántate y aléjate de la pantalla." : "Bloque hecho. Descanso: " + c.descanso + " min.";
      try { if (navigator.vibrate) navigator.vibrate(cambio === "fin" ? [120, 80, 120] : [200, 100, 200, 100, 200]); } catch (_) {}
      ctx.aviso(t);
      ctx.anunciar(t);
      var esf = $(".pomo-esfera"); if (esf) { esf.classList.remove("cambia"); void esf.offsetWidth; esf.classList.add("cambia"); }
    }
    function pintarReloj() {
      var e = est(), n = reloj(), c = cfg();
      var t = $("#pomoTiempo"), a = $("#pomoArco");
      if (t && e.fase) { var txt = mmss(restante(e, n)); if (t.textContent !== txt) t.textContent = txt; }
      if (a) a.setAttribute("stroke-dashoffset", (C * (1 - progreso(e, n))).toFixed(2));
      mini(e, n, c);
    }
    /* el indicador pequeño en las demás pantallas: un enlace al temporizador, sin región viva (no habla cada segundo) */
    function mini(e, n) {
      var caja = document.getElementById("pomoMini"); if (!caja) return;
      var ver = e.fase && !/^#\/pomodoro/.test(location.hash);
      if (caja.hidden === !!ver) caja.hidden = !ver;
      if (!ver) return;
      var a = caja.querySelector("a"), lbl = FASES[e.fase] + (e.pausa ? ", en pausa" : "") + ": quedan " + dicho(restante(e, n)) + ". Abrir el Pomodoro";
      caja.setAttribute("data-fase", e.fase);
      a.querySelector(".pm-fase").textContent = FASES[e.fase] + (e.pausa ? " · pausa" : "");
      a.querySelector(".pm-t").textContent = mmss(restante(e, n));
      /* la etiqueta solo cambia por minutos, para no fatigar a quien navega con lector */
      var lblMin = lbl.replace(/\d+ segundos?/, "menos de un minuto");
      if (a.getAttribute("aria-label") !== lblMin) a.setAttribute("aria-label", lblMin);
    }

    /* ---------- acciones ---------- */
    function accion(a) {
      var p = datos(), e = estado(p.e), c = config(p.cfg), n = reloj(), h;
      if (a === "empezar") {
        var po = pendienteOrigen; pendienteOrigen = null;
        e = empezar("estudio", po ? po.min : c.estudio, n, e.hechos, po ? po.org : e.origen, escala);
        poner({ e: e }); ctx.anunciar("Empieza el bloque de estudio: " + e.min + " minutos.");
      } else if (a === "pausar") { poner({ e: pausar(e, n) }); ctx.anunciar("En pausa."); }
      else if (a === "seguir") { poner({ e: seguir(e, n) }); ctx.anunciar("Sigue el " + FASES[e.fase].toLowerCase() + "."); }
      else if (a === "terminar") {
        var r = terminar(e, n, escala); h = apuntar({ dias: p.dias, registro: p.registro }, r.registro);
        poner({ e: r.e, dias: h.dias, registro: h.registro });
        ctx.anunciar(r.registro ? "Bloque terminado. Apuntados " + r.registro.min + " min." : "Bloque terminado. Menos de un minuto: no se apunta.");
      } else if (a === "saltar") { poner({ e: { fase: null, hechos: e.hechos, origen: e.origen } }); ctx.anunciar("Descanso saltado."); }
      refrescar(true);
    }
    /* repinta la pantalla; el foco vuelve a los controles solo si estaba en ellos (no se roba a quien escribe en los ajustes) */
    function refrescar(forzar) {
      var ae = document.activeElement, habia = forzar || !!(ae && ae.closest && ae.closest("#pomoAcc"));
      ctx.pintar(true);
      var b = habia && $("#pomoAcc .boton"); if (b) b.focus({ preventScroll: true });
    }
    function guardarAjustes(form) {
      var o = {}; Array.prototype.forEach.call(form.elements, function (el) { if (el.name) o[el.name] = el.value; });
      var c = config(o); poner({ cfg: c });
      ctx.aviso("Ajustes guardados.");
      ctx.pintar(true); var bA = $("#pomoAjustes .boton"); if (bA) bA.focus({ preventScroll: true });
    }
    document.addEventListener("click", function (ev) {
      var t = ev.target.closest ? ev.target.closest("[data-pomo]") : null;
      if (t) accion(t.getAttribute("data-pomo"));
    });
    document.addEventListener("submit", function (ev) {
      if (ev.target && ev.target.id === "pomoAjustes") { ev.preventDefault(); guardarAjustes(ev.target); }
    });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) pulso(); });
    window.addEventListener("hashchange", function () { pintarReloj(); });
    setInterval(function () { if (!document.hidden) pulso(); }, 1000);

    /* el indicador vive fuera de la vista (no se repinta con la pantalla) */
    (function () {
      if (document.getElementById("pomoMini")) return;
      var caja = document.createElement("aside");
      caja.id = "pomoMini"; caja.className = "pomo-mini"; caja.hidden = true; caja.setAttribute("aria-label", "Pomodoro en marcha");
      caja.innerHTML = '<a href="#/pomodoro"><svg class="pm-anillo" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="19.5"/></svg><span class="pm-fase"></span><span class="pm-t num"></span></a>';
      var barra = document.getElementById("barra");
      if (barra && barra.parentNode) barra.parentNode.insertBefore(caja, barra); else document.body.appendChild(caja);
      setTimeout(pulso, 0);   /* después de que la app termine de arrancar */
    })();

    return { pantalla: pantalla, enMarcha: function () { return !!est().fase; } };
  }

  return { crear: crear, L: L };
});
