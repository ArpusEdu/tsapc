/* Corte · la guía de bienvenida: #/guia
   Ocho páginas de cuaderno con todo lo que ofrece la app, y tres pequeñas pruebas que se tocan
   (tachar una entrega, destapar una respuesta, girar una ficha). Sin puntos, sin premios.
   Sale sola la primera vez que se abre Hoy; se recuerda en tsapc:v2 › personal.prefs.guiaVista (fecha ISO),
   escrita solo con leer/guardar de app.js (window.tsapcStore). Se vuelve a ver desde Hoy y Mi mesa.
   Navegador: window.CorteGuia(ctx), ctx = { leer, guardar, M, sesionHoy }. Node: module.exports (lógica pura). */
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
  function limitar(n, total) { n = Math.floor(+n || 0); return Math.max(0, Math.min(total - 1, n)); }
  /* las prefs con guiaVista puesta, sin tocar las demás */
  function conVista(prefs, fecha) {
    var o = {}, p = prefs && typeof prefs === "object" && !Array.isArray(prefs) ? prefs : {};
    for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) o[k] = p[k];
    o.guiaVista = fecha;
    return o;
  }

  /* ================= piezas ================= */
  function ico(id) { return '<svg class="ico" aria-hidden="true"><use href="' + SPR + "i-" + id + '"/></svg>'; }
  function peg(n, s) { return '<svg class="pegatina quieta guia-peg" data-subject="' + s + '" viewBox="0 0 80 80" aria-hidden="true"><use href="' + SPR + "st-" + n + '"/></svg>'; }
  function attr(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  var CASILLA = '<svg viewBox="0 0 38 38" aria-hidden="true"><path class="caja" d="M5 6 Q19 3 33 5 Q35 19 33 33 Q19 35 5 33 Q3 19 5 6 Z"/><path class="tic" pathLength="1" d="M9 19 L16 27 L34 4"/></svg>';
  var FICHA = [
    ["Frente", "Repaso, simulacro, tarjetas o práctica: ¿por dónde empiezo?"],
    ["Dorso", "Por el repaso, que es lo que dice la profe. Después, tarjetas y práctica para comprobar que se ha quedado. El simulacro, cuando quieras ver cómo irías en el examen."]
  ];

  /* ================= las páginas ================= */
  var PASOS = [
    { id: "hola", s: "lab", peg: "microscopio", t: "Esto es <em>Corte</em>", c: function () {
      return '<p class="guia-entrada">Tu cuaderno de 1.º de TSAPC, para estudiar en ratos cortos, con el móvil y una mano. Son ocho páginas: en un par de minutos lo tienes.</p>' +
        '<ul class="guia-mapa">' +
        [["hoy", "Hoy", "qué toca hoy y qué viene"], ["agenda", "Agenda", "horario y calendario"], ["asignaturas", "Asignaturas", "cada unidad, con todo para estudiarla"], ["errores", "Errores", "lo que fallas, para volver a ello"], ["mi-mesa", "Mi mesa", "copia, tema e instalación"]]
          .map(function (x) { return "<li>" + ico(x[0]) + "<span><b>" + x[1] + "</b> · " + x[2] + "</span></li>"; }).join("") + "</ul>" +
        '<p class="mano guia-consejo">desliza la hoja o usa «Siguiente»</p>';
    } },
    { id: "hoy", s: "sost", peg: "hoja", t: "Hoy: <em>lo siguiente útil</em>", c: function (d) {
      var on = !!d.tachada;
      return '<p class="guia-entrada">Al abrir Corte llegas a <b>Hoy</b>. Arriba, lo más urgente con su cuenta atrás. Debajo, <b>tu sesión de hoy</b>, elegida por el examen más cercano, y <b>tu repaso de hoy</b>. Después, las entregas del día, los próximos cinco días de clase y tu planta.</p>' +
        '<div class="guia-demo"><p class="guia-demo-etq mano">pruébalo</p>' +
        '<div class="tarea' + (on ? " hecha" : "") + '" data-subject="sost"><button class="casilla" type="button" role="checkbox" aria-checked="' + on + '" data-g="tachar" aria-label="Marcar como hecha: entrega de ejemplo">' + CASILLA + "</button>" +
        '<div><div class="meta"><span class="asig-nombre">Ejemplo</span></div><span class="titulo-w"><span class="titulo">Entrega de ejemplo</span></span></div><span class="hecho" aria-hidden="true">¡hecho!</span></div>' +
        '<p class="guia-demo-pie" aria-live="polite">' + (on ? "Tachada. Cada día que tachas algo, a tu planta le sale una hoja. Un mal día no la seca." : "Toca la casilla al terminar una entrega.") + "</p></div>";
    } },
    { id: "sesion", s: "lab", peg: "matraz", t: "La sesión <em>de estudio</em>", c: function () {
      return '<p class="guia-entrada">Unos minutos, cinco momentos. No tienes que organizarte: Hoy te dice cuál toca.</p>' +
        '<ol class="bloques guia-momentos">' +
        [["El misterio", "un caso real que aún no sabes resolver."], ["Descubre", "lo que dice la profe, tal cual, concepto a concepto."], ["Sin mirar", "lo explicas de memoria antes de volver a leerlo."], ["Resuelve", "vuelves al caso, ahora con lo aprendido."], ["Lo de otros días", "tarjetas de lo que ya estudiaste."]]
          .map(function (x) { return "<li><span><b>" + x[0] + ":</b> " + x[1] + "</span></li>"; }).join("") + "</ol>";
    } },
    { id: "porque", s: "bio", peg: "gafas", t: "Por qué <em>funciona</em>", c: function (d) {
      var on = !!d.destapada;
      return '<div class="guia-demo guia-tapar' + (on ? " destapada" : "") + '"><p class="guia-demo-etq mano">pruébalo</p><p class="guia-preg">¿Qué hace que algo se quede en la memoria?</p>' +
        '<div class="guia-caja"><p class="guia-resp" id="gResp" tabindex="-1"' + (on ? "" : ' aria-hidden="true"') + ">Recordarlo sin mirar, y volver a ello justo antes de olvidarlo.</p>" +
        (on ? "" : '<button class="guia-tapa" type="button" data-g="destapar" aria-controls="gResp" aria-expanded="false" aria-label="Destapar la respuesta"><span class="mano">primero, piénsalo sin mirar</span><span class="guia-tapa-acc">Toca para destapar</span></button>') + "</div>" +
        (on ? '<button class="boton fantasma guia-retapar" type="button" data-g="tapar">Volver a tapar</button>' : "") + "</div>" +
        '<p>Ese esfuerzo de recordar es lo que fija. Por eso existe <b>tu repaso de hoy</b>: lo que estudiaste vuelve en el momento justo. Lo que te costó, antes; lo que dominas, cada vez más tarde. Unos cinco minutos.</p>';
    } },
    { id: "unidades", s: "ipe", peg: "petri", t: "Asignaturas <em>y unidades</em>", c: function (d) {
      var k = d.girada ? 1 : 0;
      return '<p class="guia-entrada">Ocho asignaturas, un color cada una. Dentro de cada unidad:</p>' +
        '<ul class="guia-herramientas">' +
        [["Repaso", "el resumen de la profe, bloque a bloque"], ["Simulacro", "como el examen, en las unidades que lo tienen"], ["Tarjetas", "repaso espaciado: cada una vuelve cuando toca"], ["Práctica", "preguntas barajadas, con nota"]]
          .map(function (x) { return "<li><b>" + x[0] + "</b><span>" + x[1] + "</span></li>"; }).join("") + "</ul>" +
        '<div class="guia-demo"><p class="guia-demo-etq mano">gira la ficha</p>' +
        '<button class="guia-ficha' + (k ? " girada" : "") + '" type="button" data-g="girar"><span class="guia-ficha-meta">Tarjeta de ejemplo · ' + FICHA[k][0].toLowerCase() + '</span><span class="guia-ficha-txt">' + FICHA[k][1] + '</span><span class="guia-ficha-acc">' + ico("actualizar") + (k ? "Volver al frente" : "Toca para girarla") + "</span></button></div>";
    } },
    { id: "errores", s: "fisio", peg: "botiquin", t: "Errores, <em>sin castigo</em>", c: function () {
      return '<p class="guia-entrada">Cada pregunta que fallas al practicar en Corte se apunta en <b>Errores</b>, con tu respuesta y la buena.</p>' +
        '<p>Vuelve a salir hasta que la aciertas dos veces seguidas; entonces sale del mazo. Desde ahí repasas solo tus fallos, unidad a unidad.</p>' +
        '<div class="nota guia-nota"><span class="mano">Fallar aquí es información, no una nota.</span></div>';
    } },
    { id: "agenda", s: "gest", peg: "tubos", t: "La <em>agenda</em>", c: function () {
      return '<p class="guia-entrada">El <b>horario</b> de la semana, con la clase de ahora marcada, y el <b>calendario</b> del curso, por meses o entero: festivos, prácticas, exámenes y entregas.</p>' +
        '<p>Las fechas de examen son las que están apuntadas. Si una todavía no se sabe, lo verás así, sin inventar nada:</p>' +
        '<p class="guia-insignias"><span class="insignia por-confirmar">Fecha por confirmar</span></p>';
    } },
    { id: "mesa", s: "ing", peg: "pantalla", t: "Mi mesa <em>y lo demás</em>", c: function (d, ctx) {
      var h = null; try { h = ctx.sesionHoy ? ctx.sesionHoy() : null; } catch (_) {}
      return '<ul class="guia-lista">' +
        "<li>" + ico("descargar") + "<span><b>Copia de seguridad.</b> Tu progreso vive solo en este móvil, sin cuentas: si borras los datos del navegador o cambias de móvil, sin copia se pierde. Guárdala en Mi mesa de vez en cuando.</span></li>" +
        "<li>" + ico("sin-conexion") + "<span><b>Sin conexión.</b> Tras la primera visita funciona sin red, y puedes instalarla en la pantalla de inicio. Los pasos están en Mi mesa.</span></li>" +
        "<li>" + ico("abrir-fuera") + '<span><b>El centro en 3D.</b> Si te apetece, recorre el pasillo y entra en la sala de cada asignatura: otra forma de llegar a lo mismo.</span></li></ul>' +
        '<div class="guia-final"><a class="boton" href="' + attr(h || "#/hoy") + '" data-g="fin">' + (h ? "Empezar la sesión de hoy" : "Ir a Hoy") + ico("siguiente") + "</a>" +
        '<a class="boton secundario" href="#/asignaturas" data-g="fin">Explorar por mi cuenta</a>' +
        '<a class="boton fantasma guia-centro" href="../centro/" data-g="fuera">' + ico("abrir-fuera") + "Entrar al centro en 3D</a></div>";
    } }
  ];

  /* ================= la pantalla ================= */
  function crear(ctx) {
    var M = ctx.M, N = PASOS.length;
    var paso = 0, demo = {}, desde = null, montada = false, foco = null;
    var $ = function (s, r) { return (r || document).querySelector(s); };

    function prefs() { var p = ctx.leer("personal.prefs", {}); return p && typeof p === "object" ? p : {}; }
    function marcar() { if (!prefs().guiaVista) ctx.guardar("personal.prefs", conVista(prefs(), new Date().toISOString())); }

    function pagina() {
      var P = PASOS[paso], d = demo[P.id] || {};
      return '<article class="guia-pagina" id="guiaPag" data-subject="' + P.s + '" aria-labelledby="titulo">' +
        '<div class="guia-pag-cab">' + peg(P.peg, P.s) + '<span class="mano guia-folio" aria-hidden="true">pág. ' + (paso + 1) + "</span></div>" +
        '<h1 id="titulo" tabindex="-1">' + P.t + "</h1>" + P.c(d, ctx) + "</article>";
    }
    function nav() {
      var ult = paso === N - 1, pts = "";
      for (var i = 0; i < N; i++) pts += '<li class="' + (i === paso ? "es-actual" : i < paso ? "es-vista" : "") + '"></li>';
      return '<button class="boton secundario guia-ant" type="button" data-g="ant"' + (paso === 0 ? " disabled" : "") + ">" + ico("volver") + '<span class="guia-txt">Anterior</span></button>' +
        '<div class="guia-cuenta"><span class="num"><b>' + (paso + 1) + "</b> de " + N + '</span><ol class="guia-puntos" aria-hidden="true">' + pts + "</ol></div>" +
        '<button class="boton guia-sig" type="button" data-g="sig"' + (ult ? " hidden" : "") + ">Siguiente" + ico("siguiente") + "</button>";
    }
    function pantalla() {
      paso = limitar(paso, N);
      var html = '<section class="guia" aria-labelledby="guiaNombre">' +
        '<header class="guia-cab"><p class="guia-nombre" id="guiaNombre">Guía de <em>Corte</em></p><button class="boton fantasma guia-saltar" type="button" data-g="saltar">Saltar<span class="sr"> la guía</span></button></header>' +
        '<div class="guia-zona" id="guiaZona">' + pagina() + "</div>" +
        '<nav class="guia-nav" id="guiaNav" aria-label="Páginas de la guía">' + nav() + "</nav>" +
        '<p class="sr" id="guiaVivo" aria-live="polite" aria-atomic="true"></p></section>';
      return { sec: "", titulo: "Guía", html: html, montar: montar };
    }
    function montar() {
      var raiz = $(".guia"); if (!raiz) return;
      document.documentElement.classList.add("en-guia");
      try { if (ctx.sesionHoy) ctx.sesionHoy(); } catch (_) {}   /* pide ya el índice de sesiones: la última página lleva a la de hoy */
      raiz.addEventListener("click", clic);
      gestos($("#guiaZona"));
      raiz.addEventListener("focusin", function (e) { var g = e.target.getAttribute && (e.target.getAttribute("data-g") || e.target.id); foco = g || null; });
      /* repintado desde fuera (llega la agenda): el foco vuelve a donde estaba */
      if (montada && foco) {
        setTimeout(function () {
          if (document.activeElement && document.activeElement !== document.body && raiz.contains(document.activeElement)) return;
          var el = $('[data-g="' + foco + '"]', raiz) || document.getElementById(foco);
          if (el && !el.disabled && !el.hidden) el.focus({ preventScroll: true });
        }, 0);
      } else setTimeout(function () { var h = $("#titulo"); if (h && !raiz.contains(document.activeElement)) h.focus({ preventScroll: true }); }, 0);
      montada = true;
    }

    /* ---------- pasar de página ---------- */
    function ir(n, dir, desdeX) {
      var z = $("#guiaZona"); if (!z) return;
      n = limitar(n, N);
      if (n === paso) { volverSitio(z.firstElementChild, desdeX); return; }
      paso = n;
      z.innerHTML = pagina();
      $("#guiaNav").innerHTML = nav();
      var vivo = $("#guiaVivo"); if (vivo) { vivo.textContent = ""; setTimeout(function () { vivo.textContent = "Página " + (paso + 1) + " de " + N; }, 40); }
      var top = $(".guia").getBoundingClientRect().top + window.scrollY - 8;
      if (window.scrollY > top) window.scrollTo(0, Math.max(0, top));
      var h = $("#titulo"); if (h) h.focus({ preventScroll: true });
      var art = z.firstElementChild, x = typeof desdeX === "number" ? desdeX : dir * 28;
      M.animar(art, [{ opacity: 0, transform: "translateX(" + x + "px)" }, { opacity: 1, transform: "none" }], { duration: 280, easing: M.CURVA.salida }, "guia-pag");
    }
    function volverSitio(el, dx) {
      if (!el) return;
      el.style.transform = "";
      if (dx && M.modo() === "completo") M.anim(el, [{ transform: "translateX(" + dx + "px)" }, { transform: "none" }], { duration: 240, easing: M.CURVA.salida }, "guia-pag");
    }
    function salir(a) {
      marcar();
      document.documentElement.classList.remove("en-guia");
      location.replace(a || desde || "#/hoy");
    }

    /* ---------- deslizar: la hoja sigue al dedo y, pasado el umbral, se pasa de página ---------- */
    function gestos(z) {
      if (!z) return;
      var x0 = null, y0 = 0, id = null, arr = false, dx = 0, t0 = 0, tragar = false, el = null;
      var freno = function (d) { return (d > 0 && paso === 0) || (d < 0 && paso === N - 1) ? 0.18 : 0.5; };
      z.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse" || x0 !== null) return;
        x0 = e.clientX; y0 = e.clientY; id = e.pointerId; arr = false; dx = 0; t0 = Date.now(); el = z.firstElementChild;
      });
      z.addEventListener("pointermove", function (e) {
        if (x0 === null || e.pointerId !== id) return;
        dx = e.clientX - x0; var dy = e.clientY - y0;
        if (!arr) {
          if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) { arr = true; try { z.setPointerCapture(id); } catch (_) {} }
          else if (Math.abs(dy) > 12) { x0 = null; return; }
          else return;
        }
        if (el && M.modo() === "completo") el.style.transform = "translateX(" + (dx * freno(dx)).toFixed(1) + "px)";
      });
      var soltar = function (e) {
        if (x0 === null || e.pointerId !== id) return;
        x0 = null; if (!arr) return;
        tragar = true; setTimeout(function () { tragar = false; }, 350);
        var v = Math.abs(dx) / Math.max(1, Date.now() - t0), visto = dx * freno(dx);
        if (el) el.style.transform = "";
        var sentido = dx < 0 ? 1 : -1, puede = paso + sentido >= 0 && paso + sentido < N;
        if (puede && (Math.abs(dx) > 70 || (v > 0.45 && Math.abs(dx) > 28))) ir(paso + sentido, sentido, sentido * 40);
        else volverSitio(el, visto);
      };
      z.addEventListener("pointerup", soltar);
      z.addEventListener("pointercancel", function (e) { if (e.pointerId !== id) return; x0 = null; if (el) volverSitio(el, arr ? dx * freno(dx) : 0); });
      /* un arrastre no cuenta como toque en lo que hay debajo */
      z.addEventListener("click", function (e) { if (tragar) { e.stopPropagation(); e.preventDefault(); tragar = false; } }, true);
    }

    /* ---------- toques ---------- */
    function clic(e) {
      var t = e.target.closest ? e.target.closest("[data-g]") : null; if (!t) return;
      var g = t.getAttribute("data-g"), P = PASOS[paso], d = demo[P.id] || (demo[P.id] = {});
      if (g === "saltar") return salir();
      if (g === "ant") return ir(paso - 1, -1);
      if (g === "sig") return ir(paso + 1, 1);
      if (g === "fin" || g === "fuera") { marcar(); document.documentElement.classList.remove("en-guia"); return; }
      if (g === "tachar") {
        d.tachada = !d.tachada;
        t.setAttribute("aria-checked", String(d.tachada));
        t.closest(".tarea").classList.toggle("hecha", d.tachada);
        var pie = $(".guia-demo-pie"); if (pie) pie.textContent = d.tachada ? "Tachada. Cada día que tachas algo, a tu planta le sale una hoja. Un mal día no la seca." : "Toca la casilla al terminar una entrega.";
        if (d.tachada) M.sentir(10);
        return;
      }
      if (g === "destapar") {
        d.destapada = true;
        var caja = t.closest(".guia-tapar"), resp = $("#gResp");
        var fin = function () { repintarPagina(); var r = $("#gResp"); if (r) r.focus({ preventScroll: true }); };
        if (resp) resp.removeAttribute("aria-hidden");
        var a = M.animar(t, [{ transform: "none", opacity: 1 }, { transform: "translate(38%,-34%) rotate(9deg)", opacity: 0 }], { duration: 320, easing: M.CURVA.salida, fill: "forwards", sinFundido: true }, "guia-tapa");
        if (caja) caja.classList.add("destapando");
        if (a) a.onfinish = fin; else fin();
        return;
      }
      if (g === "tapar") { d.destapada = false; repintarPagina(); var b = $('[data-g="destapar"]'); if (b) b.focus({ preventScroll: true }); return; }
      if (g === "girar") {
        var cambiar = function () { d.girada = !d.girada; repintarPagina(); var f2 = $('[data-g="girar"]'); if (f2) f2.focus({ preventScroll: true }); anunciar(FICHA[d.girada ? 1 : 0][0] + ": " + FICHA[d.girada ? 1 : 0][1]); return f2; };
        M.mov(function () {
          var a1 = M.anim(t, [{ transform: "perspective(900px) rotateY(0deg)" }, { transform: "perspective(900px) rotateY(90deg)" }], { duration: 150, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }, "guia-ficha");
          var segunda = function () { var f2 = cambiar(); if (f2) M.anim(f2, [{ transform: "perspective(900px) rotateY(-90deg)" }, { transform: "none" }], { duration: 190, easing: M.CURVA.salida }, "guia-ficha"); };
          if (a1) a1.onfinish = segunda; else segunda();
        }, { reducido: function () { var f2 = cambiar(); if (f2) M.fundido(f2, "guia-ficha"); }, examen: cambiar });
      }
    }
    function repintarPagina() {
      var z = $("#guiaZona"); if (!z) return;
      z.innerHTML = pagina();
    }
    function anunciar(txt) { var v = $("#guiaVivo"); if (!v) return; v.textContent = ""; setTimeout(function () { v.textContent = txt; }, 40); }

    /* ---------- teclado: Esc salta, flechas pasan de página ---------- */
    document.addEventListener("keydown", function (e) {
      if (!document.querySelector(".guia") || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      var tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") { e.preventDefault(); salir(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); ir(paso + 1, 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); ir(paso - 1, -1); }
    });
    /* entrar y salir de #/guia. Se registra antes que el de app.js: la página se elige antes de pintar */
    window.addEventListener("hashchange", function (e) {
      var viejo = "#" + String(e.oldURL || "").split("#")[1], nuevo = location.hash;
      if (esGuia(nuevo) && !esGuia(viejo)) { paso = 0; demo = {}; montada = false; foco = null; desde = /^#\//.test(viejo) ? viejo : null; }
      if (esGuia(viejo) && !esGuia(nuevo)) { marcar(); montada = false; document.documentElement.classList.remove("en-guia"); }
    });

    return { pantalla: pantalla, debeMostrar: function (hash) { return debeMostrar(prefs(), hash); }, marcar: marcar };
  }

  return { crear: crear, esGuia: esGuia, debeMostrar: debeMostrar, limitar: limitar, conVista: conVista, PASOS: PASOS };
});
