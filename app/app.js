/* Corte · la app: rutas con hash y las pantallas Hoy, Agenda, Asignaturas, Unidad (y la lectura), Errores y Mi mesa.
   Sin build ni dependencias. Datos: app/datos.js, docs/corte/agenda-2026-27.json y tsapc:v2 (assets/store.js).
   Lo guardado por la app va en tsapc:v2 › personal (entregadas, planta, prefs). Las claves antiguas solo se leen. */
(function () {
  "use strict";
  var D = window.CorteDatos, L = window.CorteLogica, S = window.tsapcStore, esc = L.escapar;
  var SPR = "../assets/corte/iconos.svg#";
  /* la puerta única del movimiento (app/mov.js). Si faltara, nada se anima y todo sigue funcionando. */
  var M = window.CorteMov || { modo: function () { return "examen"; }, mov: function (c, a) { return a && a.examen ? a.examen() : undefined; }, anim: function () { return null; }, animar: function () { return null; }, fundido: function () { return null; }, cortar: function () {}, cortarTodo: function () {}, sentir: function () { return false; }, CURVA: {} };
  var ahora = L.reloj(location.search);
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var vista = $("#vista"), mesa = $(".mesa");
  var tiene = function (o, k) { return o && Object.prototype.hasOwnProperty.call(o, k); };

  /* ---------- datos guardados ---------- */
  try { S.migrar(); } catch (_) {}
  function leer(ruta, def) { try { var v = S.get(ruta); return v === undefined || v === null ? def : v; } catch (_) { return def; } }
  function guardar(ruta, v) { try { return S.set(ruta, v); } catch (_) { return false; } }
  function crudo(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }   /* solo lectura */
  function prefs() { var p = leer("personal.prefs", {}); return p && typeof p === "object" ? p : {}; }
  function fmtHora() { return L.formatoValido(prefs().hora); }
  function ponerPref(k, v) { var p = prefs(), o = {}; for (var x in p) if (tiene(p, x)) o[x] = p[x]; o[k] = v; return guardar("personal.prefs", o); }
  function hechas() { var h = leer("personal.entregadas", {}); return h && typeof h === "object" ? h : {}; }

  /* ---------- agenda (fetch) ---------- */
  var AG = null, EVS = [], agError = false;
  function cargarAgenda() {
    agError = false;
    return fetch(D.AGENDA_URL, { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { AG = j; EVS = L.prepararEventos(j); })
      .catch(function () { agError = true; })
      .then(function () { pintar(true); });
  }
  function prof(s) {
    if (!AG) return "";
    var a = (AG.asignaturas || []).filter(function (x) { return L.sid(x.id) === s; })[0];
    return a && a.profesor ? a.profesor : "";
  }

  /* ---------- piezas ---------- */
  var A = D.ASIGNATURAS;
  function ico(id, cls) { return '<svg class="ico' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="' + SPR + "i-" + id + '"/></svg>'; }
  function pegatina(nombre, s, cls) { return '<svg class="pegatina dibujar ' + (cls || "") + '" data-subject="' + esc(s) + '" viewBox="0 0 80 80" aria-hidden="true"><use href="' + SPR + "st-" + nombre + '"/></svg>'; }
  function titulo(html) { return '<h1 id="titulo" tabindex="-1">' + html + "</h1>"; }
  function ruta(items) {
    return '<nav aria-label="Estás en"><ol class="ruta">' + items.map(function (it, i) {
      return i === items.length - 1 ? '<li><span aria-current="page">' + esc(it[0]) + "</span></li>" : '<li><a href="' + it[1] + '">' + esc(it[0]) + "</a></li>";
    }).join("") + "</ol></nav>";
  }
  function cargando(txt) { return '<div class="estado cargando" aria-busy="true"><span class="sr">' + esc(txt) + '</span><div style="grid-column:1/-1"><div class="linea-carga"></div><div class="linea-carga"></div></div></div>'; }
  function errorAgenda() {
    return '<div class="estado es-error" role="alert">' + '<svg aria-hidden="true"><use href="' + SPR + 'i-sin-conexion"/></svg><div><h2 class="estado-tit">No se pudo cargar la agenda</h2><p>Sin conexión y sin copia guardada todavía. Conéctate un momento y vuelve a intentarlo: después funcionará sin red.</p><div class="acciones"><button class="boton" type="button" data-accion="reintentar">' + ico("actualizar") + "Reintentar</button></div></div></div>";
  }
  /* si la pantalla necesita la agenda y no ha llegado */
  function sinAgenda() { return !AG ? (agError ? errorAgenda() : cargando("Cargando la agenda")) : null; }
  var CASILLA = '<svg viewBox="0 0 38 38" aria-hidden="true"><path class="caja" d="M5 6 Q19 3 33 5 Q35 19 33 33 Q19 35 5 33 Q3 19 5 6 Z"/><path class="tic" pathLength="1" d="M9 19 L16 27 L34 4"/></svg>';
  /* fecha provisional: insignia discontinua, como «Fecha por confirmar» */
  var PROV_TXT = "Fecha provisional · puede cambiar";
  function provisional(e, corta) { return e && e.provisional ? '<span class="insignia por-confirmar provisional">' + ico("alerta") + (corta ? "Provisional" : PROV_TXT) + (corta ? '<span class="sr">: la fecha puede cambiar</span>' : "") + "</span>" : ""; }
  function unidadesDe(s) { return D.UNIDADES.filter(function (u) { return u.s === s; }); }
  function examenDe(u) {
    var ev = EVS.filter(function (e) { return e.unidad === u.id; })[0];
    if (ev) return ev;
    if (!u.fecha) return null;
    var d = L.parseDia(u.fecha); return d ? { date: d, fecha: u.fecha, due: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59), tipo: "examen" } : null;
  }
  function insigniaExamen(u, n) {
    var ex = examenDe(u);
    if (!ex) return '<span class="insignia por-confirmar">Fecha por confirmar</span>';
    var pasado = ex.due <= n;
    return (ex.provisional && !pasado ? provisional(ex) + " " : "") + '<span class="insignia' + (pasado ? " pasada" : "") + '">' + ico("calendario") + (pasado ? "Examen hecho · " + ex.date.getDate() + " " + L.MESES[ex.date.getMonth()].slice(0, 3) : "Examen · " + L.diaRelativo(ex.date, n).toLowerCase().replace(/^hoy$/, "hoy") + (ex.claseHora ? " · en tu hora de clase" : "")) + "</span>";
  }
  function progresoDe(u) {
    if (!u.progreso) return null;
    return L.progreso(u.progreso.total, leer(["unidades", u.id, "repaso", "dominados"], null), crudo(u.progreso.clave));
  }
  function barra(p, etiqueta) {
    return '<div class="progreso"><div class="progreso-txt"><span>' + etiqueta + '</span><b class="num">' + p.hechos + " / " + p.total + '</b></div><div class="progreso-barra" role="progressbar" aria-label="' + esc(etiqueta) + '" aria-valuemin="0" aria-valuemax="' + p.total + '" aria-valuenow="' + p.hechos + '" aria-valuetext="' + p.hechos + " de " + p.total + '"><i style="width:' + p.pct + '%"></i></div></div>';
  }

  /* ---------- avisos ---------- */
  function aviso(txt, tipo) {
    var caja = $("#avisos"), a = document.createElement("div");
    a.className = "aviso entra" + (tipo === "error" ? " es-error" : "");
    a.innerHTML = '<svg aria-hidden="true"><use href="' + SPR + (tipo === "error" ? "i-alerta" : "i-check") + '"/></svg><span class="aviso-texto"></span>';
    a.querySelector(".aviso-texto").textContent = txt;
    caja.appendChild(a);
    requestAnimationFrame(function () { requestAnimationFrame(function () { a.classList.remove("entra"); }); });
    setTimeout(function () { a.classList.add("entra"); setTimeout(function () { a.remove(); }, 450); }, 3000);
  }

  /* ================= HOY ================= */
  function pHoy() {
    var n = ahora(), dia = L.may(L.DIAS[n.getDay()]);
    var cab = titulo(dia + ", <em>" + n.getDate() + " de " + L.MESES[n.getMonth()] + "</em>");
    var falta = sinAgenda();
    if (falta) return { sec: "hoy", titulo: "Hoy", html: '<header class="cab">' + cab + "</header>" + falta };
    var h = hechas(), k = L.clave(n);
    var ex = L.proximoExamen(EVS, D.UNIDADES, AG.horario, n);
    var urg = L.pendientes(EVS, h, n)[0];
    var hoy = EVS.filter(function (e) { return e.tipo === "entrega" && e.fecha === k; });

    var pild;
    if (urg) {
      var S1 = A[urg.s], dif = L.difDias(urg.date, n), etq = dif <= 0 ? "Hoy" : dif === 1 ? "Mañana" : "Pronto";
      var dentro = '<span class="punto" aria-hidden="true"></span><span class="etq">' + etq + '</span><span class="que">' + esc(S1.ab + " · " + urg.titulo.replace(/^Examen · /, "") + (urg.provisional ? " (provisional)" : "")) + '</span><span class="cuenta num" data-cuenta="' + esc(urg.id) + '"></span>';
      var lbl = "Lo más urgente: " + urg.titulo + ", " + S1.nombre + (urg.provisional ? ". " + PROV_TXT : "");
      pild = urg.tipo === "entrega" && urg.fecha === k
        ? '<button type="button" class="pildora-hoy" data-subject="' + esc(urg.s) + '" data-ir="t-' + esc(urg.id) + '" aria-label="' + esc(lbl) + '. Ir a la tarea.">' + dentro + "</button>"
        : '<a class="pildora-hoy" data-subject="' + esc(urg.s) + '" href="' + (urg.unidad ? "#/unidad/" + esc(urg.unidad) : "#/agenda/calendario") + '" aria-label="' + esc(lbl) + '">' + dentro + "</a>";
    } else pild = '<span class="pildora-hoy vacia"><span class="punto" aria-hidden="true"></span><span class="que">Nada urgente pendiente</span></span>';

    var tareas = hoy.map(function (e) {
      var on = !!h[e.id], S1 = A[e.s];
      return '<li class="tarea' + (on ? " hecha" : "") + '" id="t-' + esc(e.id) + '" data-subject="' + esc(e.s) + '">' +
        '<button class="casilla" type="button" role="checkbox" aria-checked="' + on + '" data-tarea="' + esc(e.id) + '" aria-label="Marcar como hecha: ' + esc(e.titulo) + ", " + S1.nombre + '">' + CASILLA + "</button>" +
        '<div><div class="meta">' + (e.hora ? '<span class="hora">' + esc(L.hora(e.hora, fmtHora() === "ambas" ? "24" : fmtHora())) + "</span>" : "") + '<span class="asig-nombre">' + S1.nombre + "</span></div>" +
        '<span class="titulo-w"><span class="titulo">' + esc(e.titulo) + '</span></span><div class="queda" data-queda="' + esc(e.id) + '"></div>' +
        (e.nota ? '<p class="mano nota-tarea">' + esc(e.nota) + "</p>" : "") + '</div><span class="hecho" aria-hidden="true">¡hecho!</span></li>';
    }).join("");

    var bloqueEx;
    if (ex) {
      var SE = A[ex.s], nom = ex.titulo.replace(/^Examen · /, "");
      bloqueEx = '<div class="recuadro" data-subject="' + esc(ex.s) + '"><span class="washi" aria-hidden="true"></span>' +
        '<div class="cuando">' + SE.nombre + " · " + (ex.tipo === "oral" ? "oral" : "examen") + " · " + L.diaRelativo(ex.date, n).toLowerCase() + "</div>" +
        '<h3 class="ex-nombre"><span class="fluor asig">' + esc(nom) + "</span></h3>" + (ex.provisional ? '<p class="ex-prov">' + provisional(ex) + "</p>" : "") +
        '<p class="ex-det">' + L.may(L.fechaLarga(ex.date)) + (ex.claseHora ? ", en tu hora de clase: " + L.hora(ex.claseHora, fmtHora()) : "") + "." + (prof(ex.s) ? " Con " + esc(prof(ex.s)) + "." : "") + "</p>" + (ex.nota && ex.provisional ? '<p class="ex-nota">' + ico("info") + "<span>" + esc(ex.nota) + "</span>" + "</p>" : "") +
        '<div class="ex-fila"><div class="lcd" role="timer" aria-label="Cuenta atrás hasta el ' + (ex.tipo === "oral" ? "oral" : "examen") + '"><div class="lcd-pantalla"><span data-lcd="0">--</span><span class="u" data-lcdu="0">h</span><span data-lcd="1">--</span><span class="u" data-lcdu="1">m</span><span data-lcd="2">--</span><span class="u" data-lcdu="2">s</span></div><div class="lcd-pie"><span>LAB TIMER</span><span>' + L.DIAS[ex.date.getDay()].slice(0, 3).toUpperCase() + " → " + (ex.claseHora || "") + (ex.provisional ? " · PROV." : "") + '</span></div></div><span class="mano">hasta el ' + (ex.tipo === "oral" ? "oral" : "examen") + "</span></div>" +
        (ex.unidad && D.unidad(ex.unidad) ? '<a class="boton" href="#/unidad/' + esc(ex.unidad) + '">Preparar ' + esc(D.unidad(ex.unidad).titulo) + ico("siguiente") + "</a>" : "") + "</div>";
    } else {
      var sinF = D.UNIDADES.filter(function (u) { return !examenDe(u); });
      bloqueEx = '<div class="estado">' + pegatina("gafas", "lab", "quieta") + '<div><h3>Ningún examen con fecha</h3><p>Cuando haya una fecha, aquí verás la cuenta atrás. Por confirmar:</p><ul class="enlaces-unidad">' +
        sinF.map(function (u) { return '<li data-subject="' + u.s + '"><a href="#/unidad/' + u.id + '">' + esc(u.codigo + " · " + u.titulo) + "</a></li>"; }).join("") + "</ul></div></div>";
    }

    var semana = L.semana(n).map(function (dt) {
      var kk = L.clave(dt), esHoy = kk === k, inf = L.infoDia(AG.calendario, EVS, kk);
      var items = inf.evs.map(function (e) {
        var pre = e.tipo === "examen" ? "Examen: " : e.tipo === "oral" ? "Oral: " : "";
        return '<li data-subject="' + esc(e.s) + '" class="' + (h[e.id] ? "tachada" : "") + '" data-sem="' + esc(e.id) + '"><b>' + A[e.s].ab + "</b> " + esc(pre + e.titulo.replace(/^Examen · /, "")) + (h[e.id] ? '<span class="sr"> (hecha)</span>' : "") + (e.provisional ? " " + provisional(e, true) : "") + "</li>";
      }).join("");
      return '<li class="sem-dia' + (esHoy ? " es-hoy" : "") + (inf.cls.length ? " " + esc(inf.cls.join(" ")) : "") + '"><div class="sem-cab"><span class="sem-nombre">' + L.may(L.DIAS[dt.getDay()]) + (esHoy ? '<span class="sr"> (hoy)</span>' : "") + '</span><span class="sem-num">' + dt.getDate() + "</span></div>" +
        (inf.notas.length ? '<span class="sem-nota">' + esc(inf.notas[0]) + "</span>" : "") +
        (items ? "<ul>" + items + "</ul>" : (inf.notas.length ? "" : '<span class="mano sem-libre">libre</span>')) + "</li>";
    }).join("");

    var html = '<header class="cab">' + cab + '<p class="mano resumen" id="resumen">' + esc(L.resumenHoy(EVS, h, n, ex)) + "</p></header>" +
      bienvenida() +
      '<div class="urgente">' + pild + "</div>" +
      '<div class="rejilla rejilla-hoy">' + (SS ? SS.hoyBloque() : "") +
      '<section aria-labelledby="hHoy"><div class="sec-cab"><h2 id="hHoy"><span class="fluor">Para hoy</span></h2><span class="mano">tacha al terminar</span></div>' +
      (tareas ? '<ul class="tareas" id="tareas">' + tareas + "</ul>" : '<div class="nota"><span class="mano">Hoy no hay entregas. ' + (ex && L.clave(ex.date) === k ? "Hoy toca examen: a por él." : "Buen día para repasar.") + "</span></div>") + "</section>" +
      '<section aria-labelledby="hEx"><div class="sec-cab"><h2 id="hEx">Próximo examen</h2></div>' + bloqueEx + "</section>" +
      '<section class="ancho" aria-labelledby="hSem"><div class="sec-cab"><h2 id="hSem">Esta semana</h2><span class="mano">de lunes a viernes</span></div><ol class="semana">' + semana + "</ol></section>" +
      E.hoyTarjetas() +
      '<section aria-labelledby="hPl"><div class="sec-cab"><h2 id="hPl">Tu planta</h2><span class="mano">crece contigo</span></div>' + plantaHTML() + "</section>" +
      '<section aria-labelledby="hAt"><div class="sec-cab"><h2 id="hAt">Atajos</h2></div><div class="notas-fila">' +
      '<a class="nota-boton" data-subject="ipe" href="#/agenda"><b>Horario</b><span class="mano">la semana entera</span></a>' +
      '<a class="nota-boton amarilla" href="#/agenda/calendario"><b>Calendario</b><span class="mano">mes y curso</span></a>' +
      '<a class="nota-boton" data-subject="lab" href="#/asignaturas"><b>Unidades</b><span class="mano">repaso y simulacro</span></a>' +
      '<a class="nota-boton lila" href="../centro/"><b>El centro</b><span class="mano">el pasillo y las salas en 3D</span></a></div></section>' +
      "</div>";
    return { sec: "hoy", titulo: "Hoy", html: html, tic: true };
  }

  /* primer uso: una nota de bienvenida en Hoy hasta que se cierra (prefs.bienvenida). Si ya hay progreso guardado, no sale. */
  function bienvenida() {
    if (prefs().bienvenida) return "";
    var u = leer("unidades", {}), pl = leer("personal.planta", []);
    if ((u && typeof u === "object" && Object.keys(u).length) || (Array.isArray(pl) && pl.length) || Object.keys(hechas()).length) return "";
    return '<section class="bienvenida recuadro" aria-labelledby="hBv"><span class="washi" aria-hidden="true"></span>' + pegatina("microscopio", "lab", "quieta") +
      '<div><h2 id="hBv">Te damos la bienvenida a <em>Corte</em></h2><p>Tu cuaderno de 1.º de TSAPC. <b>Hoy</b> te dice qué toca, <b>Agenda</b> guarda el horario y el calendario, y en cada unidad tienes repaso, práctica y tarjetas.</p>' +
      '<p class="mano">Todo se guarda en este móvil, sin cuentas. Haz una copia en Mi mesa de vez en cuando.</p>' +
      '<div class="acciones"><button type="button" class="boton" data-accion="bienvenida">Entendido</button><a class="boton secundario" href="#/asignaturas">Ver las unidades</a></div></div></section>';
  }

  var HOJAS = [[58, 104, -1], [60, 94, 1], [58, 84, -1], [59, 74, 1], [57, 64, -1], [57, 54, 1], [58, 44, -1], [60, 36, 1], [59, 27, -1], [58, 20, 1], [59, 15, -1], [58, 12, 1], [60, 10, -1]];
  function plantaHTML() {
    var dias = leer("personal.planta", []), nd = Array.isArray(dias) ? dias.length : 0, hojas = "";
    for (var i = 0; i < Math.min(nd, HOJAS.length); i++) {
      var p = HOJAS[i], sz = 1 - i * 0.035;
      hojas += '<g class="hoja-p" transform="translate(' + p[0] + " " + p[1] + ") scale(" + (p[2] * sz) + " " + sz + ')"><path d="M0 0 C6 -12 20 -14 28 -10 C22 -2 12 4 0 0 Z"/><path class="vena" d="M1 -1 C9 -6 17 -9 25 -10"/></g>';
    }
    return '<div class="planta" id="planta" data-subject="sost"><svg viewBox="0 0 118 150" role="img" aria-labelledby="plT"><title id="plT">Planta dibujada con ' + nd + (nd === 1 ? " hoja" : " hojas") + ': una por cada día con algo tachado</title>' +
      '<path class="tallo" d="M59 118 C57 98 63 84 58 66 C54 50 62 36 59 18"/><g>' + hojas + '</g><path class="maceta" d="M30 112 H88 L80 146 H38 Z"/><rect class="maceta-borde" x="26" y="106" width="66" height="12" rx="3"/></svg>' +
      '<div><p class="racha num">' + nd + "<small>" + (nd === 1 ? "día" : "días") + "</small></p><p>Cada día que tachas algo, sale una hoja. Un mal día no la seca: la planta espera a que vuelvas.</p></div></div>";
  }

  function tachar(btn) {
    var id = btn.getAttribute("data-tarea"), li = btn.closest(".tarea"), on = btn.getAttribute("aria-checked") !== "true";
    var h = hechas(), o = {}, n = ahora(), k = L.clave(n);
    for (var x in h) if (tiene(h, x) && x !== id) o[x] = h[x];
    if (on) o[id] = n.toISOString();
    if (!guardar("personal.entregadas", o)) { aviso("No se pudo guardar. Revisa el espacio del navegador.", "error"); return; }
    li.classList.toggle("hecha", on); btn.setAttribute("aria-checked", String(on));
    var hay = EVS.some(function (e) { return e.tipo === "entrega" && e.fecha === k && o[e.id]; });
    var antes = leer("personal.planta", []), despues = L.planta(antes, k, hay), crece = despues.length > (Array.isArray(antes) ? antes.length : 0);
    guardar("personal.planta", despues);
    var pl = $("#planta"); if (pl) { pl.outerHTML = plantaHTML(); if (crece) { var g = $("#planta .hoja-p:last-of-type"); if (g) g.classList.add("brota"); } }
    var r = $("#resumen"); if (r) r.textContent = L.resumenHoy(EVS, o, n, L.proximoExamen(EVS, D.UNIDADES, AG.horario, n));
    $$("[data-sem]").forEach(function (el) { el.classList.toggle("tachada", !!o[el.getAttribute("data-sem")]); });
    var t = li.querySelector(".titulo").textContent;
    aviso(on ? t + ": hecho." + (crece ? " Sale una hoja en la planta." : "") : t + ": otra vez pendiente.");
    tic();
  }

  /* ================= AGENDA ================= */
  var calVista = "mes", calMes = null;
  function pestanasAgenda(cual) {
    return '<ul class="pestanas" aria-label="Agenda">' + [["horario", "Horario", "#/agenda", "ipe"], ["calendario", "Calendario", "#/agenda/calendario", "lab"]].map(function (t) {
      return '<li><a class="pestana" data-subject="' + t[3] + '" href="' + t[2] + '"' + (t[0] === cual ? ' aria-current="page"' : "") + ">" + t[1] + "</a></li>";
    }).join("") + "</ul>";
  }
  function pAgenda(arg) {
    var cal = arg === "calendario";
    var r = { sec: "agenda", titulo: cal ? "Calendario" : "Horario", pestanas: pestanasAgenda(cal ? "calendario" : "horario") };
    var falta = sinAgenda();
    if (falta) { r.html = '<header class="cab">' + titulo(cal ? "Calen<em>dario</em>" : "Horario <em>de la semana</em>") + "</header>" + falta; return r; }
    r.html = cal ? calendario() : horario();
    r.tic = !cal;
    r.animar = function (M) {
      /* la línea de «ahora» entra barriendo la columna, como un rotulador */
      var la = $("#ahoraLinea i", vista);
      if (la) M.animar(la, [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 600, delay: 200, easing: M.CURVA.trazo, sinFundido: true }, "ahora");
      /* el mes nuevo llega desde el lado hacia el que se pasa */
      var mes = $(".mes", vista);
      if (mes && dirMes) M.animar(mes, [{ opacity: 0, transform: "translateX(" + dirMes * 28 + "px)" }, { opacity: 1, transform: "none" }], { duration: 280, easing: M.CURVA.salida }, "mes");
      dirMes = 0;
      if (mes) deslizarMes(mes);
    };
    return r;
  }
  function seg(grupo, valor, opciones, etiqueta) {
    return '<div class="segmentado" role="group" aria-label="' + etiqueta + '">' + opciones.map(function (o) {
      return '<button type="button" data-' + grupo + '="' + o[0] + '" aria-pressed="' + (o[0] === valor) + '">' + o[1] + "</button>";
    }).join("") + "</div>";
  }
  var DIASL = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"], DIASA = ["", "L", "M", "X", "J", "V"];
  function horario() {
    var f = fmtHora(), F = AG.franjas, n = ahora(), dow = n.getDay(), nm = n.getHours() * 60 + n.getMinutes();
    /* se escapa el texto (viene del JSON de la agenda), no el HTML de la celda */
    var horaCol = function (t) { var h = esc(L.h12(t, true)); t = esc(t); return f === "12" ? "<span>" + h + "</span>" : f === "24" ? "<span>" + t + "</span>" : "<span>" + t + "</span><small>" + h + "</small>"; };
    var out = '<div class="h-dia" style="grid-row:1;grid-column:1"><span class="sr">Hora</span></div>';
    for (var d = 1; d <= 5; d++) out += '<div class="h-dia' + (d === dow ? " hoy" : "") + '" style="grid-row:1;grid-column:' + (d + 1) + '"><span class="ab" aria-hidden="true">' + DIASA[d] + '</span><span class="completo">' + DIASL[d] + '</span><span class="sr">' + (d === dow ? " (hoy)" : "") + "</span></div>";
    F.forEach(function (fr, i) {
      out += '<div class="h-hora" style="grid-row:' + (i + 2) + ';grid-column:1">' + horaCol(fr.inicio) + "</div>";
      if (fr.recreo) out += '<div class="recreo" style="grid-row:' + (i + 2) + '">recreo · ' + L.rango(fr.inicio, fr.fin, f === "ambas" ? "24" : f) + "</div>";
    });
    var fi = function (t, fin) { for (var i = 0; i < F.length; i++) if ((fin ? F[i].fin : F[i].inicio) === t) return i; return 0; };
    AG.horario.forEach(function (h) {
      var s = L.sid(h.asig), S1 = A[s], a = L.hm(h.inicio), b = L.hm(h.fin), ya = h.dia === dow && nm >= a[0] * 60 + a[1] && nm < b[0] * 60 + b[1];
      var pf = prof(s);
      out += '<div class="celda' + (h.lab ? " es-lab" : "") + (ya ? " es-ahora" : "") + '" data-subject="' + esc(s) + '" style="grid-row:' + (fi(h.inicio) + 2) + "/" + (fi(h.fin, true) + 3) + ";grid-column:" + (h.dia + 1) + '">' +
        '<span class="ab" aria-hidden="true">' + S1.ab + '</span><span class="completo">' + S1.nombre + "</span>" + (pf ? '<small class="completo">' + esc(pf) + "</small>" : "") + (h.nota ? "<small>" + esc(h.nota) + "</small>" : "") +
        '<small class="completo">' + esc(L.rango(h.inicio, h.fin, f === "ambas" ? "24" : f)) + "</small>" +
        '<span class="sr">, ' + DIASL[h.dia] + " de " + esc(L.rango(h.inicio, h.fin, f).replace("–", " a ")) + (pf ? ", con " + esc(pf) : "") + (h.lab ? ", práctica en el laboratorio" : "") + (ya ? ", ahora" : "") + "</span></div>";
    });
    out += lineaAhora(n);
    var hoyL = AG.horario.filter(function (h) { return h.dia === dow; }).map(function (h) {
      var s = L.sid(h.asig);
      return '<li data-subject="' + esc(s) + '"><span class="t num">' + (f === "ambas" ? esc(h.inicio + "–" + h.fin) + "<small>" + esc(L.h12r(h.inicio, h.fin)) + "</small>" : esc(L.rango(h.inicio, h.fin, f))) + "</span><span><b>" + A[s].nombre + "</b>" + (prof(s) ? " · " + esc(prof(s)) : "") + (h.lab ? " · práctica en el laboratorio" : "") + (h.nota ? " · " + esc(h.nota) : "") + "</span></li>";
    }).join("");
    var orden = D.ORDEN_ASIG;
    return '<header class="cab">' + titulo("Horario <em>de la semana</em>") +
      '<p class="sub">' + esc(AG.curso.nombre) + " · " + esc(AG.curso.centro) + " · tarde, " + L.rango("14:45", "20:45", f) + "</p></header>" +
      '<div class="fila-ctl"><span class="ctl-etq" id="etqHora">Ver la hora en</span>' + seg("hora", f, [["ambas", "Ambas"], ["24", "24 h"], ["12", "12 h"]], "Formato de la hora") + "</div>" +
      '<div class="horario-caja"><div class="horario" role="group" aria-label="Horario semanal" style="grid-template-rows:auto repeat(' + F.length + ',minmax(48px,auto))">' + out + "</div></div>" +
      '<ul class="leyenda" aria-label="Leyenda">' + orden.map(function (k) { return '<li data-subject="' + k + '"><i></i>' + A[k].nombre + (prof(k) ? " · " + esc(prof(k)) : "") + "</li>"; }).join("") + '<li data-subject="bio"><i class="l-lab"></i>Clase en el laboratorio</li></ul>' +
      '<div class="rejilla"><section aria-labelledby="hHoyH"><div class="sec-cab"><h2 id="hHoyH">Hoy, <span class="fluor">' + (DIASL[dow] || L.DIAS[dow]).toLowerCase() + "</span></h2></div>" +
      (hoyL ? '<ul class="lista-dia">' + hoyL + "</ul>" : '<div class="nota"><span class="mano">Hoy no hay clase.</span></div>') + "</section>" +
      '<section aria-label="Nota"><div class="nota"><span class="mano">Miércoles, ' + L.rango("18:55", "19:50", f) + ": Gestión es hora de tutoría. Recreo, " + L.rango("17:30", "18:00", f) + ".</span></div></section></div>";
  }

  /* la línea de «ahora»: cruza la columna de hoy a la altura de la hora real, dentro de su franja. Solo en horas de clase. */
  function posAhora(n) {
    var F = AG.franjas, dow = n.getDay(), nm = n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60;
    if (dow < 1 || dow > 5) return null;
    for (var i = 0; i < F.length; i++) {
      var a = L.hm(F[i].inicio), b = L.hm(F[i].fin), ia = a[0] * 60 + a[1], ib = b[0] * 60 + b[1];
      if (nm >= ia && nm < ib) return { fila: i + 2, col: dow + 1, pct: ((nm - ia) / (ib - ia) * 100).toFixed(2) };
    }
    return null;
  }
  function lineaAhora(n) {
    var p = posAhora(n); if (!p) return "";
    return '<div class="ahora-linea" id="ahoraLinea" aria-hidden="true" style="grid-row:' + p.fila + ";grid-column:" + p.col + ";--p:" + p.pct + '%"><i></i><span class="ahora-hora num">' + L.pad(n.getHours()) + ":" + L.pad(n.getMinutes()) + "</span></div>";
  }
  function moverAhora() {
    var el = $("#ahoraLinea"), p = posAhora(ahora()); if (!el) return;
    if (!p) { el.remove(); return; }
    var n = ahora();
    el.style.gridRow = String(p.fila); el.style.gridColumn = String(p.col); el.style.setProperty("--p", p.pct + "%");
    var h = el.querySelector(".ahora-hora"); if (h) h.textContent = L.pad(n.getHours()) + ":" + L.pad(n.getMinutes());
  }

  var MIN_M = new Date(2026, 8, 1), MAX_M = new Date(2027, 5, 1), dirMes = 0;
  function itemsClave(cal, filtro) {
    var it = [];
    AG.calendario.forEach(function (c) { it.push({ k: c.fecha || c.desde, fin: c.hasta, txt: c.nota || L.TIPO[c.tipo] || c.tipo }); });
    EVS.forEach(function (e) { it.push({ k: e.fecha, txt: A[e.s].nombre + " · " + e.titulo + (e.hora ? " · " + L.hora(e.hora, fmtHora()) : " · en clase"), s: e.s, ev: e }); });
    it.sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : 0; });
    if (filtro) {
      var y = filtro.getFullYear() * 12 + filtro.getMonth();
      it = it.filter(function (x) { var a = L.parseDia(x.k), b = x.fin ? L.parseDia(x.fin) : a; return a.getFullYear() * 12 + a.getMonth() <= y && b.getFullYear() * 12 + b.getMonth() >= y; });
    }
    var nk = L.clave(ahora());
    if (!it.length) return '<p class="mano">Nada apuntado este mes.</p>';
    return '<ul class="claves">' + it.map(function (x) {
      var a = L.parseDia(x.k), l = a.getDate() + " " + L.MESES[a.getMonth()].slice(0, 3) + (x.fin ? " – " + L.parseDia(x.fin).getDate() + " " + L.MESES[L.parseDia(x.fin).getMonth()].slice(0, 3) : "");
      var pas = (x.fin || x.k) < nk;
      return '<li class="' + (pas ? "pasada" : "") + '"' + (x.s ? ' data-subject="' + x.s + '"' : "") + '><span class="d num">' + l + "</span><span>" + esc(x.txt) + (pas ? '<span class="sr"> (pasada)</span>' : "") + (x.ev && x.ev.provisional ? " " + provisional(x.ev, true) + (x.ev.nota && !pas ? '<small class="clave-nota">' + esc(x.ev.nota) + "</small>" : "") : "") + "</span></li>";
    }).join("") + "</ul>";
  }
  /* pasar de mes deslizando el calendario con el dedo; los botones ‹ › siguen siendo la vía principal */
  function deslizarMes(mes) {
    var x0 = null, y0 = 0, id = null;
    mes.addEventListener("pointerdown", function (ev) { if (ev.pointerType === "mouse") return; x0 = ev.clientX; y0 = ev.clientY; id = ev.pointerId; });
    var soltar = function (ev) {
      if (x0 === null || ev.pointerId !== id) return;
      var dx = ev.clientX - x0, dy = ev.clientY - y0; x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      var b = $('[data-mes="' + (dx < 0 ? 1 : -1) + '"]:not([disabled])'); if (b) b.click();
    };
    mes.addEventListener("pointerup", soltar);
    mes.addEventListener("pointercancel", function () { x0 = null; });
  }
  var NUM = ["ninguno", "uno", "dos", "tres", "cuatro", "cinco", "seis"];
  function notaMes(m) {
    var y = m.getFullYear(), mo = m.getMonth();
    var evs = EVS.filter(function (e) { return e.date.getFullYear() === y && e.date.getMonth() === mo; });
    var p = [];
    if (evs.length) {
      var ex = evs.filter(function (e) { return e.tipo === "examen"; }).length, en = evs.filter(function (e) { return e.tipo === "entrega"; }).length, or = evs.filter(function (e) { return e.tipo === "oral"; }).length, b = [];
      if (ex) b.push((NUM[ex] || ex) + (ex === 1 ? " examen" : " exámenes")); if (en) b.push((en === 1 ? "una" : NUM[en] || en) + (en === 1 ? " entrega" : " entregas")); if (or) b.push((or === 1 ? "un" : NUM[or] || or) + (or === 1 ? " oral" : " orales"));
      p.push("Este mes: " + b.slice(0, -1).join(", ") + (b.length > 1 ? " y " : "") + b[b.length - 1] + ".");
    }
    AG.calendario.forEach(function (c) { var f = L.parseDia(c.fecha || c.desde); if (f.getFullYear() === y && f.getMonth() === mo && c.tipo === "fin-trimestre") p.push("El " + L.DIAS[f.getDay()] + " " + f.getDate() + ": " + (c.nota || "fin de trimestre").toLowerCase() + "."); });
    var fest = AG.calendario.filter(function (c) { var f = L.parseDia(c.fecha || c.desde); return c.tipo === "festivo" && f.getFullYear() === y && f.getMonth() === mo; }).length;
    if (fest) p.push(fest === 1 ? "Hay un festivo." : "Hay " + (NUM[fest] || fest) + " festivos.");
    return p.length ? p.join(" ") : "Mes tranquilo: no hay exámenes ni entregas apuntados.";
  }
  var LEYENDA_CAL = '<ul class="leyenda" aria-label="Leyenda"><li><i class="l-festivo"></i>Festivo</li><li><i class="l-sinclase"></i>Sin clase</li><li><i class="l-practicas"></i>Prácticas</li><li><i class="l-recuperacion"></i>Recuperaciones</li><li><i class="l-clave"></i>Fecha clave</li><li><i class="l-provisional"></i>Fecha provisional</li><li><i class="l-hoy"></i>Hoy</li></ul>';
  function calendario() {
    var n = ahora();
    if (!calMes) { calMes = new Date(n.getFullYear(), n.getMonth(), 1); if (calMes < MIN_M) calMes = MIN_M; if (calMes > MAX_M) calMes = MAX_M; }
    var cab = '<header class="cab">' + titulo("Calen<em>dario</em>") + '<p class="sub">Curso ' + esc(AG.curso.anio) + ": del " + L.fechaLarga(L.parseDia(AG.curso.inicio)).replace(/^\S+ /, "") + " al " + L.fechaLarga(L.parseDia(AG.curso.fin)).replace(/^\S+ /, "") + "</p></header>" +
      '<div class="fila-ctl">' + seg("cal", calVista, [["mes", "Mes"], ["curso", "Curso"]], "Vista del calendario") + "</div>";
    if (calVista === "curso") {
      var out = "";
      for (var i = 0; i < 10; i++) {
        var m = new Date(2026, 8 + i, 1), y = m.getFullYear(), mo = m.getMonth(), off = (m.getDay() + 6) % 7, nd = new Date(y, mo + 1, 0).getDate(), g = "";
        for (var j = 0; j < off; j++) g += '<i class="o"></i>';
        for (var d = 1; d <= nd; d++) {
          var dt = new Date(y, mo, d), inf = L.infoDia(AG.calendario, EVS, L.clave(dt)), c = inf.cls.slice();
          if (inf.evs.length) { c.push("con-ev"); if (inf.evs.some(function (e) { return e.provisional; })) c.push("es-provisional"); }
          if (dt.getDay() === 0 || dt.getDay() === 6) c.push("es-finde");
          if (L.clave(dt) === L.clave(n)) c.push("es-hoy");
          g += '<i class="' + esc(c.join(" ")) + '"' + (inf.evs.length ? ' data-subject="' + esc(inf.evs[0].s) + '"' : "") + ">" + d + "</i>";
        }
        out += '<div class="mini"><h3>' + L.MESES[mo] + (mo === 0 || i === 0 ? " " + y : "") + '</h3><div class="mini-g" aria-hidden="true">' + g + "</div></div>";
      }
      return cab + '<div class="curso">' + out + "</div>" + LEYENDA_CAL.replace("</ul>", '<li><i class="l-ev"></i>Examen o entrega</li></ul>') +
        '<section class="bloque-claves" aria-labelledby="hFc"><div class="sec-cab"><h2 id="hFc">Fechas clave</h2><span class="mano">lo pasado, en gris</span></div>' + itemsClave(AG.calendario, null) + "</section>";
    }
    var y2 = calMes.getFullYear(), mo2 = calMes.getMonth(), off2 = (new Date(y2, mo2, 1).getDay() + 6) % 7, nd2 = new Date(y2, mo2 + 1, 0).getDate(), celdas = "";
    ["L", "M", "X", "J", "V", "S", "D"].forEach(function (x) { celdas += '<div class="dds" aria-hidden="true">' + x + "</div>"; });
    for (var q = 0; q < off2; q++) celdas += '<div class="dia fuera" aria-hidden="true"></div>';
    for (var dd = 1; dd <= nd2; dd++) {
      var dt2 = new Date(y2, mo2, dd), kk = L.clave(dt2), inf2 = L.infoDia(AG.calendario, EVS, kk), fin = dt2.getDay() === 0 || dt2.getDay() === 6, hoy = kk === L.clave(n);
      var sr = dd + " de " + L.MESES[mo2] + (inf2.notas.length ? ": " + inf2.notas.join(", ") : "") + (inf2.evs.length ? ". " + inf2.evs.map(function (e) { return A[e.s].nombre + ", " + e.titulo + (e.provisional ? " (fecha provisional, puede cambiar)" : ""); }).join("; ") : "") + (hoy ? " (hoy)" : "");
      celdas += '<div class="dia' + (inf2.evs.some(function (e) { return e.provisional; }) ? " es-provisional" : "") + (fin ? " es-finde" : "") + (hoy ? " es-hoy" : "") + (inf2.cls.length ? " " + esc(inf2.cls.join(" ")) : "") + '" role="listitem" aria-label="' + esc(sr) + '"><span class="n" aria-hidden="true">' + dd + "</span>" +
        (inf2.notas.length ? '<span class="dia-nota" aria-hidden="true">' + esc(inf2.notas[0]) + "</span>" : "") +
        inf2.evs.map(function (e) { return '<span class="ev" data-subject="' + esc(e.s) + '" aria-hidden="true">' + esc(A[e.s].ab + " · " + e.titulo.replace(/^Examen · /, "Ex. ") + (e.provisional ? " (prov.)" : "")) + "</span>"; }).join("") +
        (inf2.evs.length ? '<span class="puntos" aria-hidden="true">' + inf2.evs.map(function (e) { return '<i data-subject="' + esc(e.s) + '"></i>'; }).join("") + "</span>" : "") + "</div>";
    }
    return cab +
      '<div class="mes-nav"><button class="boton icono secundario" type="button" data-mes="-1" aria-label="Mes anterior"' + (calMes <= MIN_M ? " disabled" : "") + ">" + ico("volver") + '</button><h2 aria-live="polite">' + L.may(L.MESES[mo2]) + " " + y2 + '</h2><button class="boton icono secundario" type="button" data-mes="1" aria-label="Mes siguiente"' + (calMes >= MAX_M ? " disabled" : "") + ">" + ico("siguiente") + "</button></div>" +
      '<div class="mes" role="list" aria-label="' + L.MESES[mo2] + " de " + y2 + '">' + celdas + "</div>" + LEYENDA_CAL +
      '<div class="rejilla"><section aria-labelledby="hEm"><div class="sec-cab"><h2 id="hEm">Este mes</h2><span class="mano">fechas que importan</span></div>' + itemsClave(AG.calendario, calMes) + "</section>" +
      '<section aria-label="Nota del mes"><div class="nota"><span class="mano">' + esc(notaMes(calMes)) + "</span></div></section></div>";
  }

  /* ================= ASIGNATURAS ================= */
  function pAsignaturas() {
    var li = D.ORDEN_ASIG.map(function (s, i) {
      var S1 = A[s], u = unidadesDe(s), pf = prof(s);
      return '<li><a class="tarjeta asig-tarjeta" data-subject="' + s + '" href="#/asignatura/' + s + '" style="--giro:' + ((i % 3) - 1) * 1.2 + 'deg">' +
        '<span class="washi" aria-hidden="true"></span>' + pegatina(S1.pegatina, s, "") +
        '<span class="asig-txt"><span class="asig-nombre-g">' + S1.nombre + "</span>" + (pf ? '<span class="asig-prof">' + esc(pf) + "</span>" : "") +
        (u.length ? '<span class="asig-cuenta"><b class="num">' + u.length + "</b> " + (u.length === 1 ? "unidad" : "unidades") + "</span>" : '<span class="sello pequeno">Pronto</span>') + "</span></a></li>";
    }).join("");
    return { sec: "asignaturas", titulo: "Asignaturas", html: '<header class="cab">' + titulo("Asig<em>naturas</em>") + '<p class="sub">Ocho asignaturas, un color cada una. Toca una para ver sus unidades.</p>' +
      '<p class="centro-entrar"><a class="boton secundario" href="../centro/">' + ico("abrir-fuera") + "Entrar al centro en 3D</a><span class=\"mano\">cada puerta, una asignatura</span></p></header><ul class=\"asignaturas\">" + li + "</ul>" };
  }
  function pAsignatura(s) {
    if (!tiene(A, s)) return pNada();
    var S1 = A[s], u = unidadesDe(s), n = ahora(), pf = prof(s);
    var cab = ruta([["Asignaturas", "#/asignaturas"], [S1.nombre]]) + '<header class="cab cab-asig"><div>' + titulo('<span class="fluor asig">' + S1.nombre + "</span>") +
      '<p class="sub">' + S1.completo + (pf ? " · " + esc(pf) : "") + "</p></div>" + pegatina(S1.pegatina, s, "grande") + "</header>";
    var evs = EVS.filter(function (e) { return e.s === s; });
    var fechas = '<section aria-labelledby="hLt"><div class="sec-cab"><h2 id="hLt">Fechas de ' + S1.nombre + "</h2></div>" + (evs.length ? '<ul class="lista-dia">' + evs.map(function (e) {
      var pas = e.due <= n;
      return '<li data-subject="' + s + '" class="' + (pas ? "pasada" : "") + '"><span class="t">' + L.may(L.fechaLarga(e.date)) + '</span><span><b>' + esc(e.titulo) + "</b>" + (pas ? '<span class="sr"> (pasada)</span>' : "") + (e.provisional && !pas ? " " + provisional(e) : "") + (e.nota ? '<span class="ev-nota">' + esc(e.nota) + "</span>" : "") + "</span></li>";
    }).join("") + "</ul>" : '<div class="nota"><span class="mano">Nada apuntado. Página en blanco: respira.</span></div>') + "</section>";
    var cuerpo;
    if (u.length) {
      cuerpo = '<ol class="unidades">' + u.map(function (x) {
        var p = progresoDe(x);
        return '<li><a class="unidad-fila" href="#/unidad/' + x.id + '"><span class="u-cod mano">' + esc(x.codigo) + '</span><span class="u-txt"><span class="u-tit">' + esc(x.titulo) + '</span><span class="u-tema">' + esc(x.tema) + "</span>" +
          (p ? '<span class="mini-barra" aria-hidden="true"><i style="width:' + p.pct + '%"></i></span><span class="sr">Repaso: ' + p.hechos + " de " + p.total + "</span>" : "") + "</span>" + insigniaExamen(x, n) + ico("siguiente", "u-flecha") + "</a></li>";
      }).join("") + "</ol>" + (AG ? fechas : "");
    } else {
      cuerpo = '<p class="pronto"><span class="sello estampar">Pronto</span></p><p>Todavía no hay unidades subidas de ' + S1.nombre + ". Cuando lleguen, aparecerán aquí con su repaso y su simulacro.</p>" + (AG ? fechas : "");
    }
    return { sec: "asignaturas", titulo: S1.nombre, subject: s, html: cab + cuerpo };
  }

  /* ================= UNIDAD ================= */
  function pUnidad(id) {
    var u = D.unidad(id); if (!u) return pNada();
    var S1 = A[u.s], n = ahora(), pf = prof(u.s), p = progresoDe(u), ev = EVS.filter(function (e) { return e.unidad === u.id; })[0];
    var notas = '<a class="nota-boton" href="../' + esc(u.repaso.web) + '"><b>Repaso</b><span class="mano">' + (u.porEntregas ? "entrega a entrega" : "bloque a bloque") + '</span><span class="ext">Abrir el repaso' + ico("siguiente") + "</span></a>" +
      (u.simulacro && u.simulacro.web ? '<a class="nota-boton amarilla" href="../' + esc(u.simulacro.web) + '"><b>Simulacro</b><span class="mano">' + esc(u.simulacro.webt || "como el examen") + '</span><span class="ext">Abrir el simulacro' + ico("siguiente") + "</span></a>" : "") +
      E.unidadNotas(u) +
      (u.id === "bio3" ? '<a class="nota-boton" data-subject="bio" href="#/lectura/franklin"><b>Lectura</b><span class="mano">La historia de Rosalind Franklin</span></a>' : "");
    var mat = [];
    if (u.repaso.pdf) mat.push(["Repaso en PDF", u.repaso.pdf]);
    if (u.simulacro && u.simulacro.pdf) mat.push(["Simulacro en PDF", u.simulacro.pdf]);
    u.extra.forEach(function (x) { mat.push(x); });
    var html = ruta([["Asignaturas", "#/asignaturas"], [S1.nombre, "#/asignatura/" + u.s], [u.codigo]]) +
      '<header class="cab cab-asig"><div>' + titulo('<span class="fluor asig">' + esc(u.titulo) + "</span>") +
      '<p class="sub">' + esc(u.tema) + " · " + esc(u.examen) + (pf ? " · " + esc(pf) : "") + "</p>" + insigniaExamen(u, n) + "</div>" + pegatina(u.pegatina, u.s, "grande") + "</header>" +
      (p ? barra(p, "Repaso dominado") : "") + E.unidadResumen(u) + (SS ? SS.unidadBloque(u.id) : "") +
      '<div class="rejilla rejilla-unidad"><section aria-labelledby="hBl"><div class="sec-cab"><h2 id="hBl">Lo que entra</h2><span class="mano">' + (u.porEntregas ? "por entregas" : "bloque a bloque") + '</span></div><ol class="bloques">' + u.bloques.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ol></section>" +
      '<section aria-labelledby="hEs"><div class="sec-cab"><h2 id="hEs">Para estudiar</h2><span class="mano">empieza por el repaso</span></div><div class="notas-fila">' + notas + "</div>" +
      (ev && ev.nota ? '<div class="nota nota-ex"><span class="mano">' + esc(ev.titulo) + ". " + esc(ev.nota) + ".</span></div>" : "") +
      (mat.length ? '<h3 class="mat-tit">Material</h3><ul class="material">' + mat.map(function (m) { var pdf = /\.pdf$/i.test(m[1]); return '<li><a href="../' + esc(m[1]) + '">' + ico(pdf ? "descargar" : "abrir-fuera") + esc(m[0]) + (pdf ? ' <span class="tipo">PDF</span>' : "") + "</a></li>"; }).join("") + "</ul>" : "") +
      "</section></div>";
    return { sec: "asignaturas", titulo: u.codigo + " · " + u.titulo, subject: u.s, html: html };
  }

  /* ---------- lectura de Bio 3 (texto y dibujos de la maqueta, tal cual) ---------- */
  function photo51SVG() {
    var d = ""; for (var k = 1; k <= 6; k++) {
      var dx = k * 8.2, dy = k * 10.5, w = 11 - k * 0.6, o = (0.9 - k * 0.09).toFixed(2);
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (q) { d += '<rect x="' + (100 + q[0] * dx - w / 2).toFixed(1) + '" y="' + (100 + q[1] * dy - 1.8).toFixed(1) + '" width="' + w.toFixed(1) + '" height="3.6" rx="1.6" fill="#1b1b1b" opacity="' + o + '"/>'; });
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400"><defs><radialGradient id="p51" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#b9b9b5"/><stop offset=".55" stop-color="#8e8e8a"/><stop offset=".8" stop-color="#5d5d5a"/><stop offset="1" stop-color="#3a3a38"/></radialGradient></defs>' +
      '<rect width="200" height="200" fill="#111"/><rect x="10" y="10" width="180" height="180" fill="#e9e7e1"/><circle cx="100" cy="100" r="82" fill="url(#p51)"/>' +
      '<path d="M38 62 Q100 18 162 62 L150 74 Q100 40 50 74 Z" fill="#232321" opacity=".85"/><path d="M38 138 Q100 182 162 138 L150 126 Q100 160 50 126 Z" fill="#232321" opacity=".85"/>' +
      d + '<circle cx="100" cy="100" r="5" fill="#fafafa"/><circle cx="100" cy="100" r="8" fill="none" stroke="#2a2a28" stroke-width="2"/></svg>';
  }
  function franklinSVG() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 380" width="600" height="760"><defs><linearGradient id="fbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7d6b6"/><stop offset="1" stop-color="#c7ab80"/></linearGradient><radialGradient id="fsk" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#f1d6bb"/><stop offset="1" stop-color="#d3a985"/></radialGradient></defs>' +
      '<rect width="300" height="380" fill="url(#fbg)"/><circle cx="150" cy="170" r="128" fill="#f3e6cc" opacity=".55"/>' +
      '<path d="M30 380 C40 300 90 276 150 276 C210 276 260 300 270 380 Z" fill="#2f2a33"/>' +
      '<path d="M112 282 L150 330 L188 282 L170 276 L150 300 L130 276 Z" fill="#f6f2ea"/>' +
      '<path d="M130 232 L130 282 Q150 296 170 282 L170 232 Z" fill="#dcb08c"/>' +
      '<ellipse cx="150" cy="178" rx="47" ry="62" fill="url(#fsk)"/>' +
      '<path d="M92 196 C80 120 112 88 156 90 C200 92 222 126 210 192 C214 218 206 238 194 246 C198 222 196 200 190 182 C186 152 176 138 164 130 C150 142 124 140 110 128 C106 150 106 176 110 196 C112 216 106 238 98 246 C88 232 88 212 92 196 Z" fill="#3a2618"/>' +
      '<path d="M110 128 C122 112 150 104 176 112" stroke="#5a3a24" stroke-width="3" fill="none" opacity=".7"/><path d="M98 200 C102 214 98 226 94 232" stroke="#5a3a24" stroke-width="2.4" fill="none" opacity=".7"/><path d="M204 198 C200 212 204 224 208 230" stroke="#5a3a24" stroke-width="2.4" fill="none" opacity=".7"/>' +
      '<path d="M118 160 Q130 153 142 159" stroke="#3a2618" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M160 159 Q172 153 184 160" stroke="#3a2618" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="131" cy="172" rx="7.5" ry="4.6" fill="#fff"/><circle cx="131" cy="172" r="3.4" fill="#2b1d14"/><ellipse cx="171" cy="172" rx="7.5" ry="4.6" fill="#fff"/><circle cx="171" cy="172" r="3.4" fill="#2b1d14"/>' +
      '<path d="M151 176 Q147 196 152 202 Q156 204 160 201" stroke="#b07f5f" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M137 216 Q151 225 165 216 Q151 220 137 216 Z" fill="#c05f66"/>' +
      '<ellipse cx="118" cy="200" rx="10" ry="6" fill="#e59a8a" opacity=".3"/><ellipse cx="184" cy="200" rx="10" ry="6" fill="#e59a8a" opacity=".3"/>' +
      '<rect x="0" y="0" width="300" height="380" fill="none" stroke="#8a6a44" stroke-width="6"/></svg>';
  }
  function svgUrl(svg) { return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); }
  function pLectura(arg) {
    if (arg !== "franklin") return pNada();
    var foto = '<figure class="lec-foto"><span class="washi" aria-hidden="true"></span><img src="' + svgUrl(photo51SVG()) + '" alt="Fotografía 51: un patrón de manchas en forma de cruz, señal de una estructura en hélice" width="240" height="240"><figcaption class="mano">Fotografía 51</figcaption></figure>';
    var cuerpo = D.FRANKLIN.map(function (t) {
      if (t === "@foto") return foto;
      var q = /^(¿|Había una gran pregunta|Pero aquí viene)/.test(t);
      return "<p" + (q ? ' class="lec-q"' : "") + ">" + esc(t) + "</p>";
    }).join("");
    var html = ruta([["Asignaturas", "#/asignaturas"], ["Biología Molecular", "#/asignatura/bio"], ["Bio 3", "#/unidad/bio3"], ["Lectura"]]) +
      '<header class="cab">' + titulo('La historia de <span class="fluor asig">Rosalind Franklin</span>') + '<p class="sub">Bio 3 · Ácidos nucleicos · lectura de clase</p></header>' +
      '<div class="lectura-rejilla"><article class="lectura">' + cuerpo + '<div class="nota nota-pregunta"><span class="mano">' + esc(D.FRANKLIN_PREGUNTA) + "</span></div></article>" +
      '<aside class="lec-lado"><figure class="lec-retrato"><span class="washi derecha" aria-hidden="true"></span><img src="' + svgUrl(franklinSVG()) + '" alt="Retrato ilustrado de Rosalind Franklin" width="300" height="380"><figcaption><b>Rosalind Franklin</b><span>1920 · 1958 · química</span></figcaption></figure>' +
      '<a class="nota-boton lila" href="#/unidad/bio3"><b>Ácidos nucleicos</b><span class="mano">volver a la unidad</span></a></aside></div>';
    return { sec: "asignaturas", titulo: "Rosalind Franklin", subject: "bio", html: html };
  }

  /* ================= ERRORES ================= */
  function pErrores() {
    var uni = leer("unidades", {}), filas = [];
    D.UNIDADES.forEach(function (u) {
      var sm = tiene(uni, u.id) && uni[u.id] && uni[u.id].simulacro;
      if (!sm || typeof sm !== "object") return;
      var r = sm.a && typeof sm.a === "object" ? Object.keys(sm.a).length : 0, au = sm.self && typeof sm.self === "object" ? Object.keys(sm.self).length : 0;
      if (r + au === 0) return;
      filas.push('<li data-subject="' + u.s + '"><a class="unidad-fila" href="../' + esc(u.simulacro.web) + '"><span class="u-cod mano">' + esc(u.codigo) + '</span><span class="u-txt"><span class="u-tit">' + esc(u.titulo) + '</span><span class="u-tema">' + (r ? r + (r === 1 ? " respuesta guardada" : " respuestas guardadas") : "") + (r && au ? " · " : "") + (au ? au + (au === 1 ? " respuesta escrita" : " respuestas escritas") : "") + "</span></span>" + ico("siguiente", "u-flecha") + "</a></li>");
    });
    var html = '<header class="cab">' + titulo("Err<em>ores</em>") + '<p class="sub">Lo que falles en los simulacros, para repasarlo hasta que salga solo.</p></header>' +
      E.errores() +
      (filas.length ? '<section aria-labelledby="hSg"><div class="sec-cab"><h2 id="hSg">Simulacros de siempre empezados</h2><span class="mano">guardados en este móvil</span></div><ul class="unidades">' + filas.join("") + "</ul></section>" : "");
    return { sec: "errores", titulo: "Errores", html: html };
  }

  /* ================= MI MESA ================= */
  /* ---------- colección: una pegatina por unidad dominada al 100 % (tsapc:v2 › personal.coleccion) ----------
     Nunca se borra. Si pasan días sin repasar esa unidad (tarjetas o práctica), la pegatina palidece; al repasar, recupera el color. */
  function coleccion() { return L.coleccionLimpia(leer("personal.coleccion", {})); }
  function completas() { return D.UNIDADES.filter(function (u) { var p = progresoDe(u); return p && p.total > 0 && p.hechos >= p.total; }).map(function (u) { return u.id; }); }
  function estamparColeccion() {
    var r = L.estampar(leer("personal.coleccion", {}), completas(), L.clave(ahora()));
    if (r.nuevas.length) guardar("personal.coleccion", r.col);
    return r.col;
  }
  function refrescarColeccion(id) {
    var antes = coleccion(), hoy = L.clave(ahora());
    if (!antes[id] || antes[id].ultimo >= hoy) return;
    guardar("personal.coleccion", L.refrescar(antes, id, hoy));
  }
  var PALIDEZ = ["", "algo pálida", "pálida", "muy pálida"];
  function hace(dias) { return dias <= 0 ? "hoy" : dias === 1 ? "ayer" : "hace " + dias + " días"; }
  function fechaCorta(k) { var d = L.parseDia(k); return d.getDate() + " " + L.MESES[d.getMonth()].slice(0, 3); }
  function albumHTML(col) {
    var hoy = L.clave(ahora()), n = 0;
    var li = D.UNIDADES.map(function (u) {
      var e = col[u.id];
      if (!e) return '<li class="hueco" data-subject="' + u.s + '"><span class="hueco-marco" aria-hidden="true"></span><span class="alb-cod mano">' + esc(u.codigo) + '</span><span class="sr">' + esc(u.codigo + " · " + u.titulo) + ": todavía sin pegatina</span></li>";
      n++;
      var pz = L.palidez(e, hoy), dias = L.difDias(L.parseDia(hoy), L.parseDia(e.ultimo));
      return '<li class="ganada' + (e.vista ? "" : " nueva") + '" data-subject="' + u.s + '" data-palidez="' + pz + '" data-unidad="' + esc(u.id) + '">' +
        '<a href="#/unidad/' + esc(u.id) + '" aria-label="' + esc(u.codigo + " · " + u.titulo + ": dominada desde el " + fechaCorta(e.desde) + ", repasada " + hace(dias) + (pz ? ", " + PALIDEZ[pz] : "")) + '">' +
        pegatina(u.pegatina, u.s, "quieta") + '<span class="alb-cod mano" aria-hidden="true">' + esc(u.codigo) + "</span>" + (pz ? '<span class="alb-pal" aria-hidden="true">' + hace(dias) + "</span>" : "") + "</a></li>";
    }).join("");
    return '<section class="ancho" aria-labelledby="hCol"><div class="sec-cab"><h2 id="hCol">Tu colección</h2><span class="mano">' + n + " de " + D.UNIDADES.length + "</span></div>" +
      '<p class="sub">Cuando dominas una unidad entera en su repaso, ganas su pegatina. Si pasa una semana sin repasarla (tarjetas o práctica), se va poniendo pálida; nunca se pierde y recupera el color al volver.</p>' +
      '<ul class="album" role="list">' + li + "</ul></section>";
  }

  var instalar = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); instalar = e; var b = $("#instalar"); if (b) b.hidden = false; });
  function pMesa() {
    var p = prefs(), tema = p.tema === "papel" || p.tema === "noche" ? p.tema : "sistema", f = fmtHora(), col = estamparColeccion();
    var html = '<header class="cab">' + titulo("Mi <em>mesa</em>") + '<p class="sub">Tu colección, cómo se ve, cómo se guarda y cómo llevarla en el móvil.</p></header>' +
      '<div class="rejilla rejilla-mesa">' + albumHTML(col) +
      '<section aria-labelledby="hTe"><h2 id="hTe">Tema</h2><p class="sub">Papel de día, noche para la última hora. «Sistema» sigue al móvil.</p>' + seg("tema", tema, [["sistema", "Sistema"], ["papel", "Papel"], ["noche", "Noche"]], "Tema") + "</section>" +
      '<section aria-labelledby="hHo"><h2 id="hHo">Formato de hora</h2><p class="sub">La primera clase: <b class="num" id="ejHora">' + L.hora("14:45", f) + "</b></p>" + seg("hora", f, [["ambas", "Ambas"], ["24", "24 h"], ["12", "12 h"]], "Formato de la hora") + "</section>" +
      '<section class="ancho" aria-labelledby="hCo"><h2 id="hCo">Copia de seguridad</h2><p>Tu progreso se guarda en este dispositivo. Haz una copia para no perderlo o para pasarlo a otro móvil. Al restaurar no se borra nada que no venga en la copia.</p>' +
      '<div class="acciones-copia"><button class="boton" type="button" id="bkSave">' + ico("descargar") + 'Guardar copia de mi progreso</button><button class="boton secundario" type="button" id="bkCopy">Copiar al portapapeles</button>' +
      '<label class="boton secundario archivo">' + ico("subir") + 'Restaurar una copia<input class="sr" type="file" id="bkLoad" accept="application/json,.json"></label></div><p class="copia-msg" id="bkMsg" role="status" aria-live="polite"></p></section>' +
      '<section class="ancho" aria-labelledby="hIn"><h2 id="hIn">Cómo instalarla en el móvil</h2><button class="boton" type="button" id="instalar"' + (instalar ? "" : " hidden") + ">Instalar Corte</button>" +
      '<div class="instalar"><div><h3>iPhone (Safari)</h3><ol><li>Abre esta página en Safari.</li><li>Toca <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li><li>Elige <b>Añadir a pantalla de inicio</b> y luego <b>Añadir</b>.</li></ol></div>' +
      '<div><h3>Android (Chrome)</h3><ol><li>Abre esta página en Chrome.</li><li>Toca el menú <b>⋮</b> de arriba a la derecha.</li><li>Elige <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.</li></ol></div>' +
      '<div><h3>Ordenador (Chrome o Edge)</h3><ol><li>En la barra de direcciones, pulsa el icono de instalar.</li><li>Confirma con <b>Instalar</b>.</li></ol></div></div>' +
      '<p class="sub">Después de la primera visita funciona sin conexión.</p></section>' +
      '<section aria-labelledby="hCr"><h2 id="hCr">Letras</h2><ul class="creditos"><li><b class="f-fraunces">Fraunces</b> · The Fraunces Project Authors (Undercase Type)</li><li><b>Atkinson Hyperlegible</b> · Braille Institute of America</li><li><b class="num">Atkinson Hyperlegible Mono</b> · The Atkinson Hyperlegible Mono Project Authors</li><li><b class="mano">Caveat</b> · The Caveat Project Authors</li></ul><p class="sub">Todas con licencia SIL Open Font License 1.1. <a href="../assets/corte/fuentes/OFL.txt">Leer la licencia</a>.</p></section>' +
      '<section aria-labelledby="hWe"><h2 id="hWe">La web de siempre</h2><p>La portada de antes sigue igual, con todos los repasos y simulacros.</p><p><a class="boton secundario" href="../">Ir a la portada de siempre</a></p></section>' +
      "</div>";
    return {
      sec: "mesa", titulo: "Mi mesa", html: html, montar: function () {
        if (window.tsapcCopia) {
          try { window.tsapcCopia.iniciar({ storage: localStorage, msg: $("#bkMsg"), botonGuardar: $("#bkSave"), entradaArchivo: $("#bkLoad"), botonCopiar: $("#bkCopy") }); }
          catch (_) { $("#bkMsg").textContent = "Este navegador no deja leer el almacenamiento: no se puede hacer copia."; }
        }
        var bi = $("#instalar"); if (bi) bi.addEventListener("click", function () { if (!instalar) return; instalar.prompt(); instalar.userChoice.then(function () { instalar = null; bi.hidden = true; }); });
      },
      /* las pegatinas recién ganadas se estampan una vez (con un poco de giro) y quedan vistas */
      animar: function (M) {
        var nuevas = $$(".album .nueva", vista);
        if (!nuevas.length) return;
        nuevas.forEach(function (li, i) {
          var pg = li.querySelector(".pegatina");
          M.animar(pg, [{ transform: "scale(1.6) rotate(-14deg)", opacity: 0 }, { transform: "scale(.94) rotate(3deg)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }], { duration: 520, delay: 120 + i * 140, easing: M.CURVA.muelle, fill: "both" }, "estampa-" + i);
        });
        M.sentir(12);
        guardar("personal.coleccion", L.marcarVistas(coleccion()));
        aviso(nuevas.length === 1 ? "Pegatina nueva en tu colección." : nuevas.length + " pegatinas nuevas en tu colección.");
      }
    };
  }
  function aplicarTema(t) {
    var r = document.documentElement;
    if (t === "papel" || t === "noche") r.setAttribute("data-theme", t); else r.removeAttribute("data-theme");
    $$('meta[name="theme-color"]').forEach(function (m, i) { m.setAttribute("content", t === "papel" ? "#fbf7ee" : t === "noche" ? "#141821" : (i === 0 ? "#fbf7ee" : "#141821")); });
  }

  function pNada() {
    return { sec: "", titulo: "No encontrada", html: '<header class="cab">' + titulo("Esta página <em>no está</em>") + '</header><div class="estado"><svg aria-hidden="true"><use href="' + SPR + 'i-info"/></svg><div><h2 class="estado-tit">No hay nada en esta dirección</h2><p>Puede que el enlace esté mal escrito o que la unidad aún no exista.</p><div class="acciones"><a class="boton" href="#/hoy">Ir a Hoy</a></div></div></div>' };
  }

  /* ================= estudiar (app/estudio.js) ================= */
  var E = window.CorteEstudio({ D: D, A: A, esc: esc, ico: ico, SPR: SPR, MESES: L.MESES, ahora: ahora, leer: leer, guardar: guardar, aviso: aviso, cargando: cargando, ruta: ruta, titulo: titulo, pegatina: pegatina, refrescar: refrescarColeccion,
    pintar: function (q) { pintar(q); }, repintar: function (sel, arriba) { pintar(!arriba); var b = sel && $(sel, vista); if (b) b.focus({ preventScroll: !arriba }); } });
  /* sesión de estudio (app/sesion.js): misterio → descubre → sin mirar → resuelve → lo de otros días */
  var SS = window.CorteSesion ? window.CorteSesion({ D: D, A: A, esc: esc, ico: ico, MESES: L.MESES, ahora: ahora, leer: leer, guardar: guardar, aviso: aviso, cargando: cargando, ruta: ruta, titulo: titulo, pegatina: pegatina, refrescar: refrescarColeccion, rico: E.rico,
    pintar: function (q) { pintar(q); }, repintar: function (sel, arriba) { pintar(!arriba); var b = sel && $(sel, vista); if (b) b.focus({ preventScroll: !arriba }); } }) : null;
  function pSesionE(id) { return SS ? SS.sesion(id) : pNada(); }
  function pPractica(id, a2) { return E.practica(id, a2) || pNada(); }
  function pTarjetas(id) { return E.tarjetas(id) || pNada(); }

  /* ================= rutas y pintado ================= */
  var PANT = { hoy: pHoy, agenda: pAgenda, asignaturas: pAsignaturas, asignatura: pAsignatura, unidad: pUnidad, lectura: pLectura, errores: pErrores, mesa: pMesa, practica: pPractica, tarjetas: pTarjetas, sesion: pSesionE };
  function leerRuta() {
    var h = location.hash.replace(/^#\/?/, ""), p = h.split("/");
    var arg = null, arg2 = null; try { arg = p[1] ? decodeURIComponent(p[1]) : null; arg2 = p[2] ? decodeURIComponent(p[2]) : null; } catch (_) {}
    return { sec: p[0] || "hoy", arg: arg, arg2: arg2 };
  }
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("dibujada"); io.unobserve(e.target); } });
  }, { threshold: 0.3 }) : null;
  function dibujar() {
    var quietas = M.modo() !== "completo" || !io;
    $$(".pegatina.dibujar", vista).forEach(function (el) { if (quietas) el.classList.add("dibujada"); else io.observe(el); });
  }
  var actual = null;
  function pintar(quieta) {
    var r = leerRuta(), f = tiene(PANT, r.sec) ? PANT[r.sec] : pNada, p;
    try { p = f(r.arg, r.arg2); } catch (err) { p = { sec: "", titulo: "Error", html: '<header class="cab">' + titulo("Algo se ha <em>torcido</em>") + '</header><div class="estado es-error" role="alert"><svg aria-hidden="true"><use href="' + SPR + 'i-alerta"/></svg><div><h2 class="estado-tit">No se pudo pintar esta pantalla</h2><p>Tus datos no se han tocado. Prueba a recargar.</p></div></div>' }; }
    var y = window.scrollY;
    M.cortarTodo();                                   /* nada se queda a medias al repintar */
    /* modo examen: mientras se hace un intento en modo examen, nada se mueve (mov.js lo lee aquí) */
    if (p.examen) document.documentElement.setAttribute("data-examen", "1"); else document.documentElement.removeAttribute("data-examen");
    vista.innerHTML = p.html;
    if (p.subject) vista.setAttribute("data-subject", p.subject); else vista.removeAttribute("data-subject");
    var pt = $("#pestanas");
    if (p.pestanas) { pt.innerHTML = p.pestanas; mesa.classList.add("con-pestanas"); } else { pt.innerHTML = ""; mesa.classList.remove("con-pestanas"); }
    document.title = p.titulo + " · Corte";
    $$("#barra a").forEach(function (a) { if (a.getAttribute("data-sec") === p.sec) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (p.montar) p.montar();
    dibujar();
    actual = p;
    tic();
    /* cada pantalla anima lo suyo después de pintarse; un fallo aquí nunca rompe la pantalla */
    if (p.animar) { try { p.animar(M); } catch (_) {} }
    if (quieta) { window.scrollTo(0, y); return; }
    window.scrollTo(0, 0);
    var h1 = $("#titulo"); if (h1) h1.focus({ preventScroll: true });
  }
  /* cambio de pantalla: completo = la hoja pasa (View Transition o entrada suave); reducido = fundido de 150 ms; examen = nada */
  function cambiar() {
    M.mov(function () {
      if (document.startViewTransition) { document.startViewTransition(function () { pintar(false); }); return; }
      pintar(false);
      M.anim(vista, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: M.CURVA.salida }, "vista");
    }, {
      reducido: function () { pintar(false); M.fundido(vista, "vista"); },
      examen: function () { pintar(false); }
    });
  }
  window.addEventListener("hashchange", function () { if (/^#\/|^$/.test(location.hash)) cambiar(); });
  var salta = $(".saltar"); if (salta) salta.addEventListener("click", function (e) { e.preventDefault(); var h = $("#titulo") || vista; h.focus(); });

  /* ---------- reloj: cuentas atrás ---------- */
  function tic() {
    if (!actual || !actual.tic || !AG) return;
    var n = ahora();
    moverAhora();
    $$("[data-cuenta]").forEach(function (el) { var e = EVS.filter(function (x) { return x.id === el.getAttribute("data-cuenta"); })[0]; if (e) el.textContent = L.cuentaAtras(e.due - n); });
    var h = hechas();
    $$("[data-queda]").forEach(function (el) { var e = EVS.filter(function (x) { return x.id === el.getAttribute("data-queda"); })[0]; if (e) el.textContent = h[e.id] ? "entregada" : e.due > n ? "quedan " + L.cuentaAtras(e.due - n, true) : "plazo cerrado"; });
    if ($('[data-lcd="0"]')) {
      var ex = L.proximoExamen(EVS, D.UNIDADES, AG.horario, n), pr = L.partes(ex ? ex.due - n : 0);
      pr.forEach(function (x, i) { $('[data-lcd="' + i + '"]').textContent = x[0]; $('[data-lcdu="' + i + '"]').textContent = x[1]; });
    }
  }
  setInterval(function () { if (!document.hidden) tic(); }, 1000);

  /* ---------- clics ---------- */
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest ? ev.target.closest("button") : null;
    if (!t || !vista.contains(t) && !t.closest(".mesa")) return;
    if (t.hasAttribute("data-tarea")) return tachar(t);
    if (t.getAttribute("data-accion") === "reintentar") { vista.innerHTML = cargando("Cargando la agenda"); return cargarAgenda(); }
    if (t.getAttribute("data-accion") === "bienvenida") {
      ponerPref("bienvenida", true);
      var bv = t.closest(".bienvenida"), fin = function () { pintar(true); var h1 = $("#titulo"); if (h1) h1.focus({ preventScroll: true }); };
      var a = bv && M.animar(bv, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-6px) rotate(-1deg)" }], { duration: 240, easing: M.CURVA.salida, fill: "forwards" }, "bienvenida");
      if (a) a.onfinish = fin; else fin();
      return;
    }
    if (t.hasAttribute("data-ir")) { var d = document.getElementById(t.getAttribute("data-ir")); if (d) { d.scrollIntoView({ block: "center", behavior: M.modo() === "completo" ? "smooth" : "auto" }); var c = d.querySelector(".casilla"); if (c) c.focus({ preventScroll: true }); } return; }
    if (t.hasAttribute("data-hora")) {
      var v = L.formatoValido(t.getAttribute("data-hora"));
      if (!ponerPref("hora", v)) aviso("No se pudo guardar la preferencia.", "error");
      return repintarConFoco('[data-hora="' + v + '"]');
    }
    if (t.hasAttribute("data-tema")) {
      var tm = t.getAttribute("data-tema"); tm = tm === "papel" || tm === "noche" ? tm : "sistema";
      ponerPref("tema", tm); aplicarTema(tm);
      return repintarConFoco('[data-tema="' + tm + '"]');
    }
    if (t.hasAttribute("data-cal")) { calVista = t.getAttribute("data-cal") === "curso" ? "curso" : "mes"; return repintarConFoco('[data-cal="' + calVista + '"]'); }
    if (t.hasAttribute("data-mes")) {
      var paso = +t.getAttribute("data-mes"), nm = new Date(calMes.getFullYear(), calMes.getMonth() + paso, 1);
      if (nm >= MIN_M && nm <= MAX_M) { calMes = nm; dirMes = paso; }
      return repintarConFoco('[data-mes="' + paso + '"]:not([disabled])', '[data-mes="' + (-paso) + '"]');
    }
  });
  function repintarConFoco(sel, alt) { pintar(true); var b = $(sel, vista) || (alt && $(alt, vista)); if (b) b.focus({ preventScroll: true }); }

  /* ---------- conexión: avisar al perderla y al recuperarla (lo guardado sigue funcionando) ---------- */
  window.addEventListener("offline", function () { aviso("Sin conexión. Lo que ya abriste sigue funcionando y tu progreso se guarda igual."); });
  window.addEventListener("online", function () { aviso("Vuelves a tener conexión."); if (agError) cargarAgenda(); });

  /* ---------- arranque ---------- */
  aplicarTema(prefs().tema);
  if (!location.hash) history.replaceState(null, "", location.pathname + location.search + "#/hoy");
  pintar(true);
  cargarAgenda();
  try { if (S.persistir) S.persistir(); } catch (_) {}
})();
