/* Enfoque · la bienvenida: la pantalla de llegada (#/llegada) y la guía (#/guia).
   Orden la primera vez: llegada → guía → Hoy.
   · Llegada: qué es esto, dónde estás y qué haces aquí, en un vistazo. «Empezar» lleva a la guía; «Ya la conozco», a Hoy.
     Se recuerda en tsapc:v2 › personal.prefs.llegadaVista (fecha ISO). No sale a quien ya vio la guía o ya tiene progreso.
   · Guía: tres pasos sobre Hoy de verdad (lo siguiente, tu examen y lo pendiente); las demás pantallas traen una pista
     la primera vez (personal.prefs.pistas). Oscurece el resto con un velo y deja un hueco iluminado, como el campo del microscopio,
     alrededor de lo que explica. Una tarjeta con la etiqueta de portaobjetos dice qué es y para qué sirve. En algunos pasos
     lo haces tú (abrir la sesión, pasar al calendario) y el paso avanza al hacerlo. Al final, la sesión de hoy.
     Se recuerda en personal.prefs.guiaVista (fecha ISO) y, mientras está a medias, el paso en personal.prefs.guiaPaso
     (se retoma donde se dejó). Se vuelve a ver desde Hoy y Mi mesa.
     No guarda nada falso: si abrir la sesión de ejemplo la deja registrada sin tocar, se quita al salir de ese paso.
   Todo se escribe solo con leer/guardar de app.js (window.tsapcStore).
   Navegador: window.CorteGuia(ctx), ctx = { leer, guardar, M, sesionHoy, unidadHoy, unidades, logo, simbolo }. Node: module.exports (lógica pura). */
(function (root, f) {
  var api = f();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CorteGuia = api.crear;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var SPR = "../assets/corte/iconos.svg#";

  /* ================= lógica pura ================= */
  /* ¿es la ruta de la guía? (#/guia o #/guia/…) */
  function esGuia(hash) { return /^#\/guia(\/|$)/.test(String(hash || "")); }
  /* sale sola solo si nunca se vio y se entra por Hoy (o sin ruta): un enlace directo a otra pantalla no se interrumpe */
  function debeMostrar(prefs, hash) {
    if (prefs && typeof prefs === "object" && prefs.guiaVista) return false;
    var h = String(hash || "").replace(/^#\/?/, "").split("/")[0];
    return h === "" || h === "hoy";
  }
  /* la llegada sale una vez: si nunca se vio, si la guía tampoco y si no hay nada guardado. Solo al entrar por Hoy (o sin ruta) */
  function debeLlegar(prefs, hash, hayProgreso) {
    var p = prefs && typeof prefs === "object" ? prefs : {};
    if (p.llegadaVista || p.guiaVista || p.bienvenida || hayProgreso) return false;
    var h = String(hash || "").replace(/^#\/?/, "").split("/")[0];
    return h === "" || h === "hoy";
  }
  function esLlegada(hash) { return /^#\/llegada(\/|$)/.test(String(hash || "")); }
  function limitar(n, total) { n = Math.floor(+n || 0); return Math.max(0, Math.min(total - 1, n)); }
  /* las prefs con una clave puesta (o quitada, si v es undefined), sin tocar las demás */
  function con(prefs, clave, v) {
    var o = {}, p = prefs && typeof prefs === "object" && !Array.isArray(prefs) ? prefs : {};
    for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k) && k !== clave) o[k] = p[k];
    if (v !== undefined) o[clave] = v;
    return o;
  }
  function conVista(prefs, fecha) { return con(con(prefs, "guiaPaso"), "guiaVista", fecha); }
  function conLlegada(prefs, fecha) { return con(prefs, "llegadaVista", fecha); }
  function conPaso(prefs, n) { return con(prefs, "guiaPaso", n); }
  /* dónde se retoma: el paso guardado si la guía quedó a medias; si ya se terminó (o nunca se empezó), desde el principio */
  function pasoGuardado(prefs, total) {
    var p = prefs && typeof prefs === "object" ? prefs : {};
    if (p.guiaVista || typeof p.guiaPaso !== "number") return 0;
    return limitar(p.guiaPaso, total);
  }

  /* ---------- geometría: dónde va el hueco del velo y dónde la tarjeta (todo en píxeles de la ventana) ---------- */
  var PAD = 8, HUECO = 18, MARGEN = 12;
  function entre(x, a, b) { return Math.max(a, Math.min(b, x)); }
  /* cuánto desplazar la página para que el objetivo quede arriba y la tarjeta quepa debajo, sin taparlo */
  function desplazamiento(r, alto, ch) {
    var cabe = alto - 2 * MARGEN - HUECO - ch - 2 * PAD;
    var th = Math.min(r.height, Math.max(64, cabe));
    var bloque = th + 2 * PAD + HUECO + ch;
    var y = Math.max(MARGEN + PAD, Math.round((alto - bloque) / 2.4));
    return Math.round(r.top - y);
  }
  /* el hueco (con su margen) y la tarjeta: debajo si cabe, encima si no; si el objetivo es más alto que lo que queda,
     el hueco se recorta a lo que se ve y la tarjeta va debajo, fuera de él. La flecha apunta al centro del objetivo. */
  function situar(r, v, ch, cw) {
    var hx = Math.max(4, r.left - PAD), hr = Math.min(v.w - 4, r.left + r.width + PAD);
    var hy = r.top - PAD, hh = r.height + 2 * PAD;
    if (hy < 4) { hh -= 4 - hy; hy = 4; }
    var abajo = v.h - MARGEN - (hy + hh) - HUECO, arriba = hy - MARGEN - HUECO, pos;
    if (abajo >= ch) pos = "abajo";
    else if (arriba >= ch) pos = "arriba";
    else { pos = "abajo"; hh = Math.max(40, v.h - MARGEN - HUECO - ch - hy); }
    var hw = Math.max(24, hr - hx);
    hh = Math.max(24, hh);
    var cx = cw >= v.w - 2 * MARGEN ? Math.round((v.w - cw) / 2) : entre(Math.round(hx + hw / 2 - cw / 2), MARGEN, v.w - MARGEN - cw);
    var cy = pos === "abajo" ? hy + hh + HUECO : hy - HUECO - ch;
    cy = entre(cy, MARGEN, Math.max(MARGEN, v.h - MARGEN - ch));
    return { hueco: { x: Math.round(hx), y: Math.round(hy), w: Math.round(hw), h: Math.round(hh) }, tarjeta: { x: cx, y: Math.round(cy), pos: pos }, flecha: Math.round(entre(hx + hw / 2 - cx, 24, cw - 24)) };
  }
  /* sesiones abiertas solo para enseñarlas: si no existían antes y siguen sin tocar, se quitan. Devuelve el objeto limpio o null si no hay nada que quitar */
  function intacta(e) {
    if (!e || typeof e !== "object") return true;
    return !(+e.paso) && !e.apuesta && !e.hecha && !(e.vistos && typeof e.vistos === "object" && Object.keys(e.vistos).length) && !(e.recuerdo && typeof e.recuerdo === "object" && Object.keys(e.recuerdo).length);
  }
  function limpiarSesiones(antes, ahora) {
    if (!ahora || typeof ahora !== "object" || Array.isArray(ahora)) return null;
    var a = antes && typeof antes === "object" ? antes : {}, o = {}, cambio = false;
    for (var k in ahora) {
      if (!Object.prototype.hasOwnProperty.call(ahora, k)) continue;
      if (!Object.prototype.hasOwnProperty.call(a, k) && intacta(ahora[k])) { cambio = true; continue; }
      o[k] = ahora[k];
    }
    return cambio ? o : null;
  }
  /* el anillo del objetivo partido en n tramos (uno por paso), con la muesca de la marca a la una y media.
     El anillo del logo va de −27° a 297° (324°); entre tramo y tramo, 6° de aire. Devuelve los «d» de cada arco (rejilla de 48). */
  function arcos(n) {
    var out = [], hueco = n > 1 ? 6 : 0, largo = (324 - (n - 1) * hueco) / n;
    var p = function (g) { var a = g * Math.PI / 180; return (24 + 19.5 * Math.cos(a)).toFixed(2) + " " + (24 + 19.5 * Math.sin(a)).toFixed(2); };
    for (var k = 0; k < n; k++) {
      var a0 = -27 + k * (largo + hueco), a1 = a0 + largo;
      out.push("M" + p(a0) + "A19.5 19.5 0 " + (largo > 180 ? 1 : 0) + " 1 " + p(a1));
    }
    return out;
  }

  /* ================= piezas ================= */
  function ico(id) { return '<svg class="ico" aria-hidden="true"><use href="' + SPR + "i-" + id + '"/></svg>'; }
  function attr(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

  /* ================= la llegada: los textos (docs/enfoque/marca.md, «La primera pantalla») ================= */
  var LLEGADA = {
    donde: "Cuaderno de estudio · 1.º TSAPC",
    titulo: "Enfoca lo que <em>toca</em>.",
    que: function (n) { return "Repasos, simulacros y tarjetas de las " + n + " unidades de 1.º de Anatomía Patológica y Citodiagnóstico, con el material de clase tal cual. Abres, ves qué toca y estudias diez minutos."; },
    pasos: [
      ["Abre Hoy.", "Te dice qué toca y cuánto falta para cada examen."],
      ["Estudia un rato.", "Repaso, tarjetas o simulacro: lo que te dé tiempo."],
      ["Lo que falles vuelve.", "Se guarda y sale otra vez, sin castigo."]
    ],
    pie: "Sin cuenta y sin conexión. Tu progreso se queda en este móvil."
  };

  /* ================= los pasos del recorrido =================
     ruta(ctx, hash): la pantalla que se abre (null = el paso no se puede hacer y se salta).
     el: selectores, el primero que exista manda; c(i) recibe cuál fue para adaptar el texto.
     haz: un paso que se hace de verdad. espera: la ruta a la que se llega al hacerlo. boton: lo mismo desde la tarjeta.
     fase: lo que se enseña después de hacerlo, sin cambiar de paso (el hueco se desliza al nuevo sitio). */
  function sesionDe(ctx) { try { return ctx.sesionHoy ? ctx.sesionHoy() : null; } catch (_) { return null; } }
  function unidadDe(ctx) { try { var u = ctx.unidadHoy ? ctx.unidadHoy() : null; return u ? "#/unidad/" + encodeURIComponent(u) : null; } catch (_) { return null; } }
  var AVISO_BOTONES = "Puedes decir «Ya lo hice» o «Hoy no puedo»: los dos lo callan hasta mañana, sin reproches. En una entrega, «Ya lo entregué» lo apaga del todo.";
  /* La guía son tres pasos, todos en Hoy (PASOS). El resto de pantallas trae una pista la primera vez que se entra (PISTAS):
     se recuerda en personal.prefs.pistas = { "<pantalla>": "fecha ISO" }. Los pasos antiguos (unidad, sesión, agenda, errores,
     Mi mesa y el centro) siguen aquí abajo, en PASOS_OTROS, como texto de esas pistas. */
  var PASOS = [
    { id: "ahora", zona: "Hoy · Lo siguiente", t: "Tu sesión <em>de hoy</em>", ruta: function () { return "#/hoy"; },
      el: [".lo-siguiente"],
      c: function () {
        return "<p>Arriba, una sola cosa: lo siguiente que toca. Casi siempre, tu sesión de hoy o tu repaso. Un botón y a estudiar, sin tener que organizarte.</p>" +
          "<p>Cada sesión va en dos ratos de unos diez minutos: si hoy solo tienes uno, mañana sigues donde lo dejes. Lo demás está plegado en «Más para hoy».</p>" +
          "<p>Cuando se acerque un examen o una entrega, debajo sale un aviso. " + AVISO_BOTONES + "</p>";
      } },
    { id: "examen", zona: "Hoy · 02 Para tu examen", t: "La cuenta atrás <em>y tu plan</em>", ruta: function () { return "#/hoy"; },
      el: [".tramo-examen .plan-ex", ".tramo-examen .ex-tarjeta .ex-fila", ".tramo-examen .estado"],
      c: function (i) {
        if (i === 2) return "<p>Ahora no hay ningún examen con fecha. Cuando lo haya, aquí verás la cuenta atrás y tu plan hasta ese día.</p><p>Lo que aún no se sabe pone «Fecha por confirmar». Nada inventado.</p>";
        return (i === 0 ? "<p>Encima, el reloj hasta el próximo examen. Aquí, tu plan hasta ese día: cuántas sesiones llevas, a qué ritmo vas y cuáles tocan hoy.</p>"
          : "<p>El reloj hasta el próximo examen, con su fecha y su hora de clase. Debajo, tu plan hasta ese día.</p>") +
          "<p>Si una fecha puede cambiar, va marcada como provisional; si no se sabe, «Fecha por confirmar».</p>";
      } },
    { id: "pendientes", zona: "Hoy · 03 Pendientes", t: "Entregas, repaso <em>y tarjetas</em>", ruta: function () { return "#/hoy"; },
      el: [".tramo-pend .tramo-rejilla", ".tramo-pend"],
      c: function () {
        return "<p>Las entregas de hoy se tachan al terminarlas. Cada día con algo hecho, a tu planta le sale una hoja; un mal día no la seca.</p>" +
          "<p><b>Tu repaso de hoy</b> trae lo que ya estudiaste justo antes de que se te olvide, unas pocas cosas cada día. Las tarjetas que tocan salen aquí también.</p>";
      } },
  ];
  var PASOS_OTROS = [
    { id: "unidad", zona: "Una unidad", t: "Todo para <em>estudiarla</em>", ruta: function (ctx) { return unidadDe(ctx); },
      el: ['section[aria-labelledby="hEs"] .notas-fila', 'section[aria-labelledby="hEs"]'],
      c: function () {
        return "<p>Cada unidad abre con su portaobjetos y trae lo mismo. <b>Repaso</b>: lo que dice la profe, tal cual. <b>Simulacro</b>: como el examen. <b>Tarjetas</b>: cada una vuelve cuando toca. <b>Práctica</b>: preguntas barajadas, con nota.</p>" +
          "<p>Empieza por el repaso; después, comprueba con tarjetas y práctica.</p>";
      } },
    { id: "sesiones", zona: "Una unidad · sesiones", t: "Tu sesión <em>de hoy</em>", ruta: function (ctx) { return unidadDe(ctx); },
      el: [function (ctx) { var h = sesionDe(ctx); return h ? '.ss-unidad a[href="' + h + '"]' : null; }, ".ss-unidad li a"],
      c: function () { return "<p>Las sesiones de estudio de la unidad, en orden y con lo hecho marcado. No tienes que organizarte: Hoy te dice cuál toca, y es esta.</p>"; },
      haz: { txt: "Toca la sesión iluminada para abrirla.", boton: "Abrir la sesión", espera: /^#\/sesion\/(?!repaso(\/|$))/ } },
    { id: "sesion", zona: "La sesión", t: "Cinco momentos, <em>unos minutos</em>",
      ruta: function (ctx, hash) { return /^#\/sesion\/(?!repaso(\/|$))/.test(hash || "") ? hash : sesionDe(ctx); },
      el: [".ss-pasos"],
      c: function () {
        return '<ol class="rc-momentos">' + [["El misterio", "un caso que aún no sabes resolver."], ["Descubre", "lo de la profe, tal cual."], ["Otros días", "lo que ya estudiaste."], ["Sin mirar", "lo explicas de memoria."], ["Resuelve", "vuelves al caso."]]
          .map(function (x) { return "<li><span><b>" + x[0] + ":</b> " + x[1] + "</span></li>"; }).join("") + "</ol><p>Los dos primeros son el rato A; los otros tres, el rato B. Recordar sin mirar es lo que fija. Si sales, se guarda.</p>";
      } },
    { id: "agenda", zona: "Agenda", t: "Horario <em>y calendario</em>", ruta: function () { return "#/agenda"; },
      el: ["#pestanas .pestanas"],
      c: function () { return "<p>El horario de la semana, con la clase de ahora marcada. Al lado, el calendario de todo el curso.</p>"; },
      haz: { txt: "Toca «Calendario».", boton: "Abrir el calendario", toca: '#pestanas a[href="#/agenda/calendario"]', espera: /^#\/agenda\/calendario/ },
      fase: { ruta: "#/agenda/calendario", t: "El <em>calendario</em>", el: [".mes", ".curso", ".mes-nav"],
        c: function () { return "<p>Por meses o el curso entero: festivos, prácticas, exámenes y entregas. Una fecha que puede cambiar va marcada como provisional; una que no se sabe, «Fecha por confirmar».</p>"; } } },
    { id: "errores", zona: "Errores", t: "Errores, <em>sin castigo</em>", ruta: function () { return "#/errores"; },
      el: ["#vista .err-unidad", "#vista .estado"],
      c: function (i) {
        return (i === 0 ? "<p>Cada pregunta que fallas al practicar se apunta aquí, con tu respuesta y la buena. Vuelve hasta que la aciertas dos veces seguidas; entonces sale del mazo.</p>"
          : "<p>Tu mazo de fallos empieza vacío. Desde aquí repasarás solo lo que falles, unidad a unidad, hasta que salga solo.</p>") +
          '<p class="rc-mano">Fallar aquí es información, no una nota.</p>';
      } },
    { id: "mesa", zona: "Mi mesa", t: "La copia <em>de seguridad</em>", ruta: function () { return "#/mesa"; },
      el: ['section[aria-labelledby="hCo"]'],
      c: function () {
        return "<p>Tu progreso vive solo en este móvil, sin cuentas. Si borras los datos del navegador o cambias de móvil, sin copia se pierde: guárdala de vez en cuando.</p>" +
          "<p>En Mi mesa también eliges papel o noche y ves cómo instalarla.</p>";
      } },
    { id: "centro", zona: "El centro", t: "El centro <em>en 3D</em>", ruta: function () { return "#/asignaturas"; },
      el: [".centro-entrar"],
      c: function () {
        return "<p>Otra forma de llegar a lo mismo: un pasillo con una sala por asignatura. Por la ventana se ve el cielo de Pamplona de ahora mismo, con su hora y su tiempo.</p>" +
          "<p>Si el móvil va justo, dentro tienes «Ver sin 3D».</p>";
      } }
  ];
  /* ---------- pistas: la primera vez que se entra en cada pantalla, una nota corta que se cierra con «Entendido» ----------
     La clave es la sección de la ruta (#/unidad/…, #/sesion/…, #/agenda, #/errores, #/mesa, #/asignaturas). */
  function de(id) { return PASOS_OTROS.filter(function (p) { return p.id === id; })[0]; }
  var PISTAS = {
    unidad: { t: de("unidad").t, c: function () { return de("unidad").c(0) + de("sesiones").c(0).replace("Hoy te dice cuál toca, y es esta.", "Hoy te dice cuál toca."); } },
    sesion: { t: de("sesion").t, c: function () { return de("sesion").c(0); } },
    agenda: { t: de("agenda").t, c: function () { return de("agenda").c(0) + de("agenda").fase.c(0); } },
    errores: { t: de("errores").t, c: function () { return de("errores").c(0); } },
    mesa: { t: de("mesa").t, c: function () { return de("mesa").c(0); } },
    asignaturas: { t: de("centro").t, c: function () { return de("centro").c(0); } }
  };
  function vistasPistas(prefs) { var p = prefs && typeof prefs === "object" && prefs.pistas; return p && typeof p === "object" && !Array.isArray(p) ? p : {}; }
  /* ¿toca la pista de esta pantalla? Solo si existe y no se ha visto */
  function pistaPendiente(prefs, clave) { return !!(clave && Object.prototype.hasOwnProperty.call(PISTAS, clave) && !vistasPistas(prefs)[clave]); }
  /* marcar una pista como vista sin tocar las demás preferencias */
  function conPista(prefs, clave, fecha) {
    var v = vistasPistas(prefs), o = {}, k;
    for (k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = v[k];
    o[clave] = fecha;
    return con(prefs, "pistas", o);
  }

  /* el cierre: lleva a la sesión de hoy (o a Hoy si aún no hay) */
  var CIERRE = {
    t: "Ya lo <em>tienes</em>.",
    c: function (h) {
      return "<p>" + (h ? "Lo siguiente útil es tu sesión de hoy: unos minutos y sin tener que organizarte." : "Lo siguiente útil está en Hoy: lo que toca, de lo urgente a lo que puede esperar.") + "</p>" +
        "<p>La guía sigue en Mi mesa, por si quieres volver a verla.</p>";
    },
    botones: function (h) {
      return '<a class="boton rc-ir" href="' + attr(h || "#/hoy") + '" data-r="fin">' + (h ? "Empezar la sesión de hoy" : "Ir a Hoy") + ico("siguiente") + "</a>" +
        (h ? '<a class="boton secundario rc-ir" href="#/hoy" data-r="fin">Ir a Hoy</a>' : "");
    }
  };

  /* ================= la pantalla ================= */
  function crear(ctx) {
    var M = ctx.M, N = PASOS.length;
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var T = { activo: false, i: 0, fase: 0, gen: 0, obj: null, sel: 0, hueco: null, esperado: null, snap: null, desde: null, raf: 0, mo: null };
    var capa = null, velo = null, tarjeta = null, vivo = null;

    function prefs() { var p = ctx.leer("personal.prefs", {}); return p && typeof p === "object" ? p : {}; }
    function marcar() { var p = prefs(); if (!p.guiaVista || "guiaPaso" in p) ctx.guardar("personal.prefs", conVista(p, p.guiaVista || new Date().toISOString())); }
    function apuntarPaso(n) { var p = prefs(); if (!p.guiaVista && p.guiaPaso !== n) ctx.guardar("personal.prefs", conPaso(p, n)); }
    function completo() { return M.modo() === "completo"; }
    function vista() { return { w: window.innerWidth, h: window.innerHeight }; }

    /* ---------- la capa: el velo (SVG con máscara) y la tarjeta ---------- */
    function construir() {
      if (capa) return;
      capa = document.createElement("div");
      capa.className = "rc"; capa.id = "recorrido"; capa.hidden = true;
      capa.innerHTML =
        '<svg class="rc-velo" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><defs><mask id="rcMasc" x="0" y="0" width="1" height="1" maskContentUnits="userSpaceOnUse">' +
        '<rect x="0" y="0" width="100%" height="100%" fill="#fff"/><rect class="rc-hueco" rx="14" fill="#000"/></mask></defs>' +
        '<rect class="rc-sombra" x="0" y="0" width="100%" height="100%" mask="url(#rcMasc)"/>' +
        '<rect class="rc-halo" rx="14" fill="none"/><rect class="rc-borde" rx="14" fill="none" pathLength="100"/></svg>' +
        '<div class="rc-tarjeta" role="dialog" aria-modal="true" aria-labelledby="rcT" aria-describedby="rcC"><div class="rc-in"></div></div>' +
        '<p class="sr" id="rcVivo" aria-live="polite" aria-atomic="true"></p>';
      document.body.appendChild(capa);
      velo = $(".rc-velo", capa); tarjeta = $(".rc-tarjeta", capa); vivo = $("#rcVivo", capa);
      tarjeta.addEventListener("click", clic);
      window.addEventListener("resize", programar);
      window.addEventListener("scroll", programar, { passive: true });
      if (window.visualViewport) window.visualViewport.addEventListener("resize", programar);
    }

    /* ---------- el progreso: el anillo del logo partido en tantos tramos como pasos ---------- */
    var ARCOS = arcos(N);
    function ocular(i) {
      var sim = ctx.simbolo ? ctx.simbolo({ etiqueta: false, clase: "rc-simbolo" }) : "";
      return '<span class="rc-ocular" aria-hidden="true">' + sim + '<svg class="rc-anillo" viewBox="0 0 48 48" focusable="false"><g class="rc-giro">' +
        ARCOS.map(function (d, k) { return '<path d="' + d + '" class="' + (k < i ? "hecho" : k === i ? "ahora" : "") + '"/>'; }).join("") + "</g></svg></span>";
    }

    /* ---------- el contenido de la tarjeta ---------- */
    function cuerpo(i) {
      var fin = i >= N, P = PASOS[i] || {}, F = !fin && T.fase && P.fase ? P.fase : null;
      var haz = !fin && P.haz && !F, h = fin ? sesionDe(ctx) : null;
      var t = fin ? CIERRE.t : (F ? F.t : P.t), c = fin ? CIERRE.c(h) : (F ? F.c(T.sel) : P.c(T.sel));
      return '<div class="rc-cab">' + ocular(fin ? N : i) +
        '<p class="rc-porta"><span class="rc-cod">' + (fin ? "GUÍA" : "GUÍA " + (i + 1)) + '</span><span class="rc-zona">' + (fin ? "Recorrido hecho" : P.zona) + "</span></p>" +
        '<button class="boton fantasma rc-saltar" type="button" data-r="saltar">' + (fin ? "Cerrar" : "Saltar") + '<span class="sr"> la guía</span></button></div>' +
        '<h2 id="rcT" tabindex="-1">' + t + "</h2>" +
        '<div class="rc-c" id="rcC">' + c + "</div>" +
        (haz ? '<p class="rc-haz">' + ico("info") + "<span>" + P.haz.txt + "</span></p>" : "") +
        '<div class="rc-pie' + (fin ? " rc-pie-fin" : "") + '">' +
        '<button class="boton secundario rc-ant" type="button" data-r="ant"' + (i === 0 && !T.fase ? " disabled" : "") + ">" + ico("volver") + '<span class="rc-txt">Anterior</span></button>' +
        (fin ? '<div class="rc-final">' + CIERRE.botones(h) + "</div>"
          : '<span class="rc-n num"><b>' + (i + 1) + "</b> de " + N + "</span>" +
            '<button class="boton rc-sig" type="button" data-r="' + (haz ? "hacer" : "sig") + '">' + (haz ? P.haz.boton : i === N - 1 ? "Terminar" : "Siguiente") + ico("siguiente") + "</button>") +
        '</div><span class="rc-flecha" aria-hidden="true"></span>';
    }

    /* ---------- encontrar lo que se explica (puede tardar: la agenda o la sesión llegan por red) ---------- */
    function buscar(lista) {
      for (var k = 0; k < lista.length; k++) {
        var s = typeof lista[k] === "function" ? lista[k](ctx) : lista[k];
        if (!s) continue;
        var el = document.querySelector(s);
        /* lo que está en un plegable cerrado («Más para hoy») se abre para poder enseñarlo */
        for (var p = el && el.parentElement; p; p = p.parentElement) if (p.tagName === "DETAILS" && !p.open) p.open = true;
        if (el && el.getClientRects().length && !$(".cargando", document.getElementById("vista") || document)) return { el: el, k: k };
      }
      return null;
    }
    function esperar(lista, gen, hecho) {
      var t0 = Date.now();
      (function mirar() {
        if (gen !== T.gen) return;
        var r = buscar(lista);
        if (r) return hecho(r);
        if (Date.now() - t0 > 4000) return hecho(null);
        setTimeout(mirar, 70);
      })();
    }

    /* ---------- el hueco: se coloca en su sitio y, si toca, llega deslizándose desde donde estaba ---------- */
    function ponerRect(el, h) { el.setAttribute("x", h.x); el.setAttribute("y", h.y); el.setAttribute("width", h.w); el.setAttribute("height", h.h); }
    function muesca(h) {
      /* el borde del campo lleva la muesca del anillo de la marca, cerca de la esquina de arriba a la derecha */
      var per = 2 * (h.w + h.h), a = Math.max(2, (h.w - 18) / per * 100 - 3);
      $(".rc-borde", velo).setAttribute("stroke-dasharray", a.toFixed(2) + " 3.2 " + (100 - a - 3.2).toFixed(2));
    }
    function colocarHueco(h, animar) {
      var piezas = [$(".rc-hueco", velo), $(".rc-halo", velo), $(".rc-borde", velo)], h0 = T.hueco;
      piezas.forEach(function (p) { ponerRect(p, h); });
      muesca(h);
      T.hueco = h;
      if (!animar || !h0 || !completo()) return;
      var desde = "translate(" + (h0.x - h.x) + "px," + (h0.y - h.y) + "px) scale(" + (h0.w / h.w).toFixed(4) + "," + (h0.h / h.h).toFixed(4) + ")";
      piezas.forEach(function (p) { M.anim(p, [{ transform: desde }, { transform: "none" }], { duration: 520, easing: M.CURVA.foco }); });
      /* el campo se enfoca al llegar: el borde de luz se pasa un pelo y vuelve */
      M.anim($(".rc-borde", velo), [{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1 }], { duration: 620, easing: "linear" });
    }
    function colocarTarjeta(s) {
      tarjeta.style.transform = "translate(" + s.tarjeta.x + "px," + s.tarjeta.y + "px)";
      tarjeta.setAttribute("data-pos", s.tarjeta.pos || "centro");
      tarjeta.style.setProperty("--fx", s.flecha + "px");
    }
    /* recolocar sin animar (scroll, giro de pantalla, repintado de la app) */
    function recolocar() {
      T.raf = 0;
      if (!T.activo || !tarjeta) return;
      if (T.i >= N) return centrar(false);
      if (!T.obj || !T.obj.isConnected) {
        var P = PASOS[T.i], r = buscar(T.fase && P.fase ? P.fase.el : P.el);
        if (!r) return;
        T.obj = r.el;
      }
      var s = ajustar(situar(T.obj.getBoundingClientRect(), vista(), tarjeta.offsetHeight, tarjeta.offsetWidth), T.obj);
      colocarHueco(s.hueco, false); colocarTarjeta(s);
    }
    /* si el objetivo no cabe entero, el hueco se corta en el hueco entre dos de sus piezas, no por la mitad de una */
    function ajustar(s, el) {
      var r = el.getBoundingClientRect(), h = s.hueco, fondo = h.y + h.h;
      if (fondo >= r.bottom + PAD - 1) return s;
      var mejor = 0;
      Array.prototype.forEach.call(el.children, function (c) { var b = c.getBoundingClientRect().bottom; if (b + PAD <= fondo && b > mejor) mejor = b; });
      if (mejor > h.y + 48) {
        h.h = Math.round(mejor + PAD - h.y);
        if (s.tarjeta.pos === "abajo") s.tarjeta.y = h.y + h.h + HUECO;
      }
      return s;
    }
    function programar() { if (T.activo && !T.raf) T.raf = requestAnimationFrame(recolocar); }
    function centrar(animar) {
      var v = vista(), cw = tarjeta.offsetWidth, ch = tarjeta.offsetHeight;
      var h = { x: Math.round(v.w / 2 - 12), y: Math.round(v.h / 2 - 12), w: 24, h: 24 };
      colocarHueco(h, animar);
      capa.classList.add("sin-hueco");
      colocarTarjeta({ tarjeta: { x: Math.round((v.w - cw) / 2), y: Math.max(MARGEN, Math.round((v.h - ch) / 2)), pos: "centro" }, flecha: 0 });
    }

    /* ---------- la tarjeta entra y sale: desenfoca al irse, enfoca al llegar ---------- */
    var dentro = function () { return $(".rc-in", tarjeta); };
    function salirTarjeta(dir, luego) {
      if (!completo() || !T.activo || capa.hidden) return luego();
      var a = M.anim(dentro(), [{ opacity: 1, transform: "none", filter: "blur(0)" }, { opacity: 0, transform: "translateY(" + (-6 * dir) + "px)", filter: "blur(2px)" }], { duration: 170, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
      T.salida = a;
      if (a) a.onfinish = function () { luego(); }; else luego();
    }
    function entrarTarjeta(dir, nuevo) {
      var d = dentro();
      if (T.salida) { try { T.salida.cancel(); } catch (_) {} T.salida = null; }
      if (!completo()) { if (M.modo() === "reducido") M.fundido(d, null); return; }
      M.anim(d, [{ opacity: 0, transform: "translateY(" + (14 * dir) + "px) scale(.97)", filter: "blur(2.6px)" }, { opacity: 1, transform: "translateY(" + (-2 * dir) + "px) scale(1.003)", filter: "blur(0)", offset: 0.68 }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 440, easing: M.CURVA.foco, fill: "backwards" });
      /* los bloques del texto llegan uno tras otro, de arriba abajo */
      Array.prototype.slice.call(d.querySelectorAll("#rcT, .rc-c > *, .rc-haz, .rc-final > *")).slice(0, 6).forEach(function (x, k) {
        M.anim(x, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: 90 + k * 45, easing: M.CURVA.salida, fill: "backwards" });
      });
      /* el anillo gira como el del objetivo, se pasa un poco y vuelve; el tramo nuevo se enciende y la muestra pasa de borrosa a nítida */
      if (nuevo) {
        M.anim($(".rc-giro", d), [{ transform: "rotate(-28deg)" }, { transform: "rotate(4deg)", offset: 0.68 }, { transform: "none" }], { duration: 640, easing: M.CURVA.foco });
        var act = $(".rc-anillo .ahora", d) || $(".rc-anillo path:last-child", d);
        if (act) M.anim(act, [{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: 160, easing: "ease-out", fill: "backwards" });
        var mu = $(".rc-simbolo .e-muestra", d);
        if (mu) M.anim(mu, [{ filter: "blur(2.6px)", transform: "scale(1.08)" }, { filter: "blur(0)", transform: "scale(.985)", offset: 0.62 }, { filter: "blur(.55px)", offset: 0.76 }, { filter: "blur(0)", transform: "none" }], { duration: 700, easing: "cubic-bezier(.33,1,.68,1)" });
      }
    }

    /* ---------- moverse por los pasos ---------- */
    function anunciar(txt) { if (!vivo) return; vivo.textContent = ""; setTimeout(function () { vivo.textContent = txt; }, 60); }
    function rutaDe(P, fase) {
      if (fase && P.fase) return P.fase.ruta;
      try { return P.ruta(ctx, location.hash); } catch (_) { return null; }
    }
    function devolverSesiones() {
      if (T.snap === null) return;
      var antes = null; try { antes = JSON.parse(T.snap); } catch (_) {}
      T.snap = null;
      var limpio = limpiarSesiones(antes, ctx.leer("personal.sesiones", null));
      if (limpio) ctx.guardar("personal.sesiones", limpio);
    }
    function ir(i, fase, dir) {
      var gen = ++T.gen;
      dir = dir || 1;
      salirTarjeta(dir, function () { if (gen === T.gen) paso(i, fase, dir, gen); });
    }
    /* un paso que no se puede hacer (no hay sesión, no existe el elemento) se salta en el mismo sentido */
    function paso(i, fase, dir, gen) {
        if (i < 0) { i = 0; fase = 0; dir = 1; }
        if (i >= N) return llegarCierre(gen);
        var P = PASOS[i], ruta = rutaDe(P, fase);
        var ir2 = function (j, d) { paso(j, 0, d, gen); };
        if (!ruta) return ir2(i + dir, dir);
        /* la sesión de ejemplo: se apunta cómo estaba todo antes de abrirla, para no dejar rastro si no se toca */
        var deSesion = P.id === "sesiones" || P.id === "sesion";
        if (deSesion && T.snap === null) T.snap = JSON.stringify(ctx.leer("personal.sesiones", {}) || {});
        if (!deSesion) devolverSesiones();
        if (ruta !== location.hash) { T.esperado = ruta; location.replace(ruta); }
        esperar(fase && P.fase ? P.fase.el : P.el, gen, function (r) {
          if (gen !== T.gen) return;
          if (!r) return ir2(i + dir, dir);
          llegar(i, fase, dir, r);
        });
    }
    function llegar(i, fase, dir, r) {
      var nuevo = i !== T.i || !tarjeta.firstChild || !$(".rc-cab", tarjeta);
      T.i = i; T.fase = fase; T.sel = r.k; T.obj = r.el;
      capa.classList.remove("sin-hueco");
      capa.classList.toggle("con-haz", !!(PASOS[i].haz && !fase));
      dentro().innerHTML = cuerpo(i);
      /* primero se sube la página para que el objetivo y la tarjeta quepan; luego el hueco se desliza hasta él */
      var v = vista(), dy = desplazamiento(T.obj.getBoundingClientRect(), v.h, tarjeta.offsetHeight);
      if (Math.abs(dy) > 1) window.scrollTo({ top: Math.max(0, window.scrollY + dy), behavior: "instant" });
      var s = ajustar(situar(T.obj.getBoundingClientRect(), v, tarjeta.offsetHeight, tarjeta.offsetWidth), T.obj);
      colocarHueco(s.hueco, true); colocarTarjeta(s);
      entrarTarjeta(dir, nuevo);
      enfocar();
      var P = PASOS[i];
      anunciar("Paso " + (i + 1) + " de " + N + ". " + (fase && P.fase ? P.fase.t : P.t).replace(/<[^>]+>/g, "") + (P.haz && !fase ? ". " + P.haz.txt : ""));
      apuntarPaso(i);
    }
    function llegarCierre(gen) {
      devolverSesiones();
      if (gen !== T.gen) return;
      T.i = N; T.fase = 0; T.obj = null;
      capa.classList.remove("con-haz");
      dentro().innerHTML = cuerpo(N);
      centrar(true);
      entrarTarjeta(1, true);
      enfocar();
      anunciar("Recorrido terminado. " + CIERRE.t.replace(/<[^>]+>/g, ""));
    }
    function enfocar() { setTimeout(function () { var h = $("#rcT", tarjeta); if (h && T.activo) h.focus({ preventScroll: true }); }, 30); }

    function sig() {
      var P = PASOS[T.i];
      if (!P) return;
      if (P.haz && !T.fase) return hacer();
      ir(T.i + 1, 0, 1);
    }
    function ant() {
      if (T.i >= N) return ir(N - 1, PASOS[N - 1].fase ? 1 : 0, -1);
      var P = PASOS[T.i];
      if (T.fase) return ir(T.i, 0, -1);
      if (T.i === 0) return;
      var Q = PASOS[T.i - 1];
      ir(T.i - 1, Q.fase ? 1 : 0, -1);
    }
    /* «hazlo tú» desde la tarjeta: lo mismo que tocar lo iluminado */
    function hacer() {
      var P = PASOS[T.i], el = P && P.haz && P.haz.toca ? document.querySelector(P.haz.toca) : T.obj;
      if (el && el.isConnected) el.click();
    }

    /* ---------- empezar, parar y terminar ---------- */
    function iniciar(desde) {
      construir();
      T.activo = true; T.desde = desde || null; T.hueco = null; T.snap = null;
      document.documentElement.classList.add("en-recorrido");
      capa.hidden = false;
      try { if (ctx.sesionHoy) ctx.sesionHoy(); } catch (_) {}   /* pide ya el índice de sesiones */
      if (completo()) M.anim(capa, [{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" });
      dentro().innerHTML = "";
      observar();
      var i = pasoGuardado(prefs(), N);
      T.i = i; T.fase = 0;
      ir(i, 0, 1);
    }
    function observar() {
      var v = document.getElementById("vista");
      if (!v || !window.MutationObserver) return;
      if (!T.mo) T.mo = new MutationObserver(function () { if (T.activo) { T.obj = null; programar(); } });
      T.mo.observe(v, { childList: true });
    }
    function cerrar(luego) {
      if (!T.activo) { if (luego) luego(); return; }
      T.activo = false; T.gen++; T.esperado = null;
      devolverSesiones();
      if (T.mo) T.mo.disconnect();
      var fin = function () { capa.hidden = true; capa.classList.remove("sin-hueco", "con-haz"); document.documentElement.classList.remove("en-recorrido"); T.hueco = null; if (luego) luego(); };
      if (completo()) { var a = M.anim(capa, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in", fill: "forwards" }); if (a) { a.onfinish = function () { a.cancel(); fin(); }; return; } }
      fin();
    }
    function terminar(destino) { marcar(); cerrar(function () { location.replace(destino || T.desde || "#/hoy"); }); }

    /* ---------- toques en la tarjeta ---------- */
    function clic(e) {
      var t = e.target.closest ? e.target.closest("[data-r]") : null; if (!t) return;
      var r = t.getAttribute("data-r");
      if (r === "saltar") return terminar();
      if (r === "ant") return ant();
      if (r === "sig") return sig();
      if (r === "hacer") return hacer();
      if (r === "fin") { e.preventDefault(); return terminar(t.getAttribute("href")); }
    }
    /* mientras dura, lo de detrás no se toca, salvo lo iluminado en un paso de «hazlo tú» */
    document.addEventListener("click", function (e) {
      if (!T.activo || !capa) return;
      var t = e.target;
      if (capa.contains(t)) return;
      if (capa.classList.contains("con-haz") && T.obj && T.obj.contains(t)) return;
      e.preventDefault(); e.stopPropagation();
    }, true);
    /* el foco no se escapa de la tarjeta (salvo a lo iluminado en «hazlo tú») */
    document.addEventListener("focusin", function (e) {
      if (!T.activo || !capa || capa.contains(e.target)) return;
      if (capa.classList.contains("con-haz") && T.obj && T.obj.contains(e.target)) return;
      var h = $("#rcT", tarjeta); if (h) h.focus({ preventScroll: true });
    });

    /* ---------- teclado: Esc salta, flechas pasan de paso, Tab da vueltas dentro de la tarjeta ---------- */
    document.addEventListener("keydown", function (e) {
      if (!T.activo || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      var tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") { e.preventDefault(); return terminar(); }
      if (e.key === "ArrowRight") { e.preventDefault(); return T.i >= N ? null : clic({ target: $(".rc-sig", tarjeta) || document.body, preventDefault: function () {} }); }
      if (e.key === "ArrowLeft") { e.preventDefault(); return ant(); }
      if (e.key === "Tab") {
        var f = Array.prototype.slice.call(tarjeta.querySelectorAll("button:not([disabled]), a[href]"));
        var P = PASOS[T.i], tk = P && P.haz && P.haz.toca ? document.querySelector(P.haz.toca) : T.obj;
        if (capa.classList.contains("con-haz") && tk) f.push(tk);
        if (!f.length) return;
        var k = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });

    /* entrar en #/guia y las navegaciones durante el recorrido. Se registra antes que el de app.js */
    window.addEventListener("hashchange", function (e) {
      var viejo = "#" + String(e.oldURL || "").split("#")[1], nuevo = location.hash;
      if (esGuia(nuevo)) { if (!esGuia(viejo) && !T.activo) T.desde = /^#\//.test(viejo) && !esLlegada(viejo) ? viejo : null; return; }
      if (!T.activo) return;
      if (T.esperado && nuevo === T.esperado) { T.esperado = null; return; }
      var P = PASOS[T.i];
      if (P && P.haz && !T.fase && P.haz.espera.test(nuevo)) {
        T.esperado = null;
        return P.fase ? ir(T.i, 1, 1) : ir(T.i + 1, 0, 1);
      }
      /* se ha ido a otra parte (atrás del navegador, un enlace): el recorrido se aparta y se retoma luego donde estaba */
      cerrar();
    });
    function pantalla() {
      var desde = T.desde;
      var html = '<section class="rc-espera" aria-busy="true"><h1 id="titulo" tabindex="-1" class="sr">Guía de Enfoque</h1></section>';
      return { sec: "", titulo: "Guía", html: html, montar: function () { if (!T.activo) setTimeout(function () { iniciar(desde); }, 0); } };
    }

    /* ================= la llegada (#/llegada) ================= */
    function marcarLlegada() { if (!prefs().llegadaVista) ctx.guardar("personal.prefs", conLlegada(prefs(), new Date().toISOString())); }
    function llegada() {
      var n = ctx.unidades || 15, i = 0, e = function () { return ' style="--i:' + (i++) + '"'; };
      var logo = ctx.logo ? ctx.logo({ animado: true, clase: "ll-logo" }) : '<p class="ll-logo-txt">enfoque</p>';
      var html = '<section class="llegada" aria-labelledby="titulo">' +
        '<div class="ll-ocular" aria-hidden="true"><span class="ll-luz"></span><span class="ll-anillo"></span>' + (ctx.simbolo ? '<span class="ll-campo">' + ctx.simbolo({ animado: true, etiqueta: false, clase: "ll-simbolo" }) + "</span>" : "") + '</div>' +
        '<header class="ll-marca">' + logo + '<p class="ll-donde ll-e"' + e() + ">" + LLEGADA.donde + "</p></header>" +
        '<h1 id="titulo" class="ll-titulo ll-e" tabindex="-1"' + e() + ">" + LLEGADA.titulo + "</h1>" +
        '<p class="ll-que ll-e"' + e() + ">" + LLEGADA.que(n) + "</p>" +
        '<ol class="ll-pasos" aria-label="Qué haces aquí">' + LLEGADA.pasos.map(function (p, k) {
          return '<li class="ll-e"' + e() + '><span class="ll-n" aria-hidden="true">0' + (k + 1) + "</span><span><b>" + p[0] + "</b> " + p[1] + "</span></li>";
        }).join("") + "</ol>" +
        '<div class="ll-acciones ll-e"' + e() + '><a class="boton ll-empezar" href="#/guia" data-l="empezar"><span>Empezar</span>' + ico("siguiente") + '</a>' +
        '<a class="boton secundario" href="#/hoy" data-l="conozco">Ya la conozco<span class="sr">: ir a Hoy</span></a></div>' +
        '<p class="ll-pie ll-e"' + e() + ">" + ico("sin-conexion") + "<span>" + LLEGADA.pie + "</span></p></section>";
      return { sec: "", titulo: "Bienvenida", html: html, montar: montarLlegada };
    }
    function montarLlegada() {
      var raiz = $(".llegada"); if (!raiz) return;
      document.documentElement.classList.add("en-llegada");
      raiz.addEventListener("click", function (ev) {
        var a = ev.target.closest ? ev.target.closest("[data-l]") : null; if (!a) return;
        ev.preventDefault();
        marcarLlegada();
        if (a.getAttribute("data-l") === "conozco") marcar();   /* quien ya la conoce no ve la guía a la fuerza */
        document.documentElement.classList.remove("en-llegada");
        location.replace(a.getAttribute("href"));
      });
      setTimeout(function () { var h = $("#titulo"); if (h && !raiz.contains(document.activeElement)) h.focus({ preventScroll: true }); }, 0);
    }
    window.addEventListener("hashchange", function (e) {
      if (esLlegada("#" + String(e.oldURL || "").split("#")[1]) && !esLlegada(location.hash)) { marcarLlegada(); document.documentElement.classList.remove("en-llegada"); }
    });

    /* ================= las pistas de la primera vez ================= */
    function pista(clave) {
      if (T.activo || !pistaPendiente(prefs(), clave)) return "";
      var P = PISTAS[clave];
      return '<aside class="pista" aria-labelledby="pistaT" data-pista="' + attr(clave) + '"><p class="pista-k">' + ico("info") + "Primera vez aquí</p>" +
        '<h2 class="pista-t" id="pistaT">' + P.t + '</h2><div class="pista-c">' + P.c() + "</div>" +
        '<button type="button" class="boton secundario pista-ok" data-pista-ok="' + attr(clave) + '">Entendido</button></aside>';
    }
    function verPista(clave) { var p = prefs(); if (pistaPendiente(p, clave)) ctx.guardar("personal.prefs", conPista(p, clave, new Date().toISOString())); }

    return { pantalla: pantalla, llegada: llegada, debeMostrar: function (hash) { return debeMostrar(prefs(), hash); }, debeLlegar: function (hash, hay) { return debeLlegar(prefs(), hash, hay); }, marcar: marcar,
      pista: pista, verPista: verPista };
  }

  return { crear: crear, esGuia: esGuia, esLlegada: esLlegada, debeMostrar: debeMostrar, debeLlegar: debeLlegar, limitar: limitar, conVista: conVista, conLlegada: conLlegada, conPaso: conPaso, pasoGuardado: pasoGuardado,
    desplazamiento: desplazamiento, situar: situar, limpiarSesiones: limpiarSesiones, arcos: arcos, PASOS: PASOS, CIERRE: CIERRE, LLEGADA: LLEGADA,
    PISTAS: PISTAS, pistaPendiente: pistaPendiente, conPista: conPista };
});
