/* Corte · estudiar: #/practica/<u>, #/tarjetas/<u>, el mazo real de Errores y los añadidos de Hoy y Unidad.
   Se carga antes de app.js; app.js lo arranca con CorteEstudio(ctx). Lógica en quiz.js y sm2.js.
   Guardado en tsapc:v2 › unidades.<u>.{intentos:{actual, historial}, errores, tarjetas}. Se guarda tras cada respuesta.
   Todo texto de las preguntas pasa por esc() o por rico(), que solo deja etiquetas de formato y escapa el resto. */
(function () {
  "use strict";
  window.CorteEstudio = function (ctx) {
    var Q = window.CorteQuiz, S2 = window.CorteSM2, D = ctx.D, A = ctx.A, esc = ctx.esc, ico = ctx.ico;
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
    var tiene = function (o, k) { return o !== null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k); };
    var hoyClave = function () { return S2.dia(ctx.ahora()); };
    var coma = function (n) { return (Math.round(n * 10) / 10).toFixed(1).replace(".", ","); };
    var refrescar = function (u) { if (ctx.refrescar) { try { ctx.refrescar(u); } catch (_) {} } };   /* la pegatina de la colección recupera el color */

    /* ---------- movimiento (Fase 5): cada acción deja apuntado su efecto y la pantalla lo anima al repintarse ----------
       Todo pasa por app/mov.js: en modo examen no se mueve nada y con «reducir movimiento» solo hay fundidos. */
    var EF = null;
    function efectosPractica(M) {
      var f = EF; EF = null; if (!f) return;
      if (f.t === "resp") {
        var caja = $(".qz-fb") || $(".qz-modelo");
        if (caja) M.animar(caja, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: M.CURVA.salida }, "qz-fb");
        if (f.abierta) return;
        var buena = $(".qz-op.buena"), mala = $(".qz-op.mala");
        if (f.ok) {
          if (buena) M.animar(buena, [{ transform: "none" }, { transform: "scale(1.025)", offset: 0.4 }, { transform: "none" }], { duration: 320, easing: M.CURVA.muelle, sinFundido: true }, "qz-op");
          var tic = buena && buena.querySelector(".ico");
          if (tic) M.animar(tic, [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 300, delay: 60, easing: M.CURVA.trazo, sinFundido: true }, "qz-tic");
          $$(".qz-campo.bien, .qz-rel-f.bien").forEach(function (el, i) { M.animar(el, [{ transform: "none" }, { transform: "scale(1.02)", offset: 0.4 }, { transform: "none" }], { duration: 300, delay: i * 40, easing: M.CURVA.muelle, sinFundido: true }, "qz-c" + i); });
          M.sentir(8);
        } else {
          /* fallo: la elegida tiembla poco y la buena entra en foco. Sin rojo chillón. */
          if (mala) M.animar(mala, [{ transform: "none" }, { transform: "translateX(-5px)" }, { transform: "translateX(4px)" }, { transform: "translateX(-2px)" }, { transform: "none" }], { duration: 300, easing: "ease-out", sinFundido: true }, "qz-op");
          if (buena) M.animar(buena, [{ transform: "scale(.985)", filter: "blur(1.5px)" }, { transform: "none", filter: "none" }], { duration: 380, delay: 160, easing: M.CURVA.foco }, "qz-buena");
          $$(".qz-campo.mal .qz-buena, .qz-rel-f.mal .qz-buena").forEach(function (el, i) { M.animar(el, [{ opacity: 0, filter: "blur(2px)" }, { opacity: 1, filter: "none" }], { duration: 360, delay: 120 + i * 50, easing: M.CURVA.foco }, "qz-b" + i); });
          M.sentir(15);
        }
      } else if (f.t === "nota") subirNota(M);
    }
    /* la nota sube contando en 800 ms; un toque (o una tecla) la deja en su sitio */
    function subirNota(M) {
      var el = $(".qz-nota-n"), caja = $(".qz-nota-caja"); if (!el) return;
      var fin = parseFloat(el.textContent.replace(",", ".")); if (!(fin > 0)) return;
      M.mov(function () {
        var t0 = null, parar = false, DUR = 800;
        var saltar = function () { parar = true; el.textContent = coma(fin); quitar(); };
        var quitar = function () { if (caja) caja.removeEventListener("click", saltar); document.removeEventListener("keydown", saltar, true); };
        if (caja) caja.addEventListener("click", saltar);
        document.addEventListener("keydown", saltar, true);
        el.textContent = coma(0);
        var paso = function (ts) {
          if (parar || !document.contains(el)) return quitar();
          if (t0 === null) t0 = ts;
          var x = Math.min(1, (ts - t0) / DUR), e = 1 - Math.pow(1 - x, 3);
          el.textContent = coma(fin * e);
          if (x < 1) requestAnimationFrame(paso); else quitar();
        };
        requestAnimationFrame(paso);
      });
    }
    function efectosTarjetas(M) {
      var f = EF; EF = null;
      var ficha = $(".tj-ficha"); if (!ficha) return;
      if (f && f.t === "voltear") M.animar(ficha, [{ transform: "perspective(900px) rotateY(-80deg)", opacity: 0.4 }, { transform: "perspective(900px) rotateY(0deg)", opacity: 1 }], { duration: 340, easing: M.CURVA.salida }, "tj");
      if (f && f.t === "puntuada") { var d = f.r === "otra" ? -1 : 1; M.animar(ficha, [{ transform: "translateX(" + d * 28 + "px) rotate(" + d * 2 + "deg)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 300, easing: M.CURVA.salida }, "tj"); }
      if (ficha.classList.contains("vuelta") && M.modo() === "completo") deslizar(ficha, M);
    }
    /* deslizar la tarjeta ya girada: → «Bien», ← «Otra vez». Los botones siguen ahí para quien no quiera arrastrar. */
    function deslizar(ficha, M) {
      var x0 = null, y0 = 0, dx = 0, id = null, UMBRAL = 90;
      ficha.addEventListener("pointerdown", function (ev) {
        if (ev.button !== 0 || (ev.target.closest && ev.target.closest("a, button, summary"))) return;
        x0 = ev.clientX; y0 = ev.clientY; dx = 0; id = ev.pointerId;
      });
      ficha.addEventListener("pointermove", function (ev) {
        if (x0 === null || ev.pointerId !== id) return;
        dx = ev.clientX - x0;
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(ev.clientY - y0)) return;
        if (!ficha.hasPointerCapture(id)) ficha.setPointerCapture(id);
        ficha.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 18).toFixed(2) + "deg)";
        ficha.setAttribute("data-va", dx > UMBRAL ? "bien" : dx < -UMBRAL ? "otra" : "");
      });
      var soltar = function (ev) {
        if (x0 === null || ev.pointerId !== id) return;
        x0 = null; ficha.removeAttribute("data-va");
        var b = dx > UMBRAL ? $('[data-tj-r="bien"]') : dx < -UMBRAL ? $('[data-tj-r="otra"]') : null;
        if (b) { b.click(); return; }
        var ahoraT = ficha.style.transform; ficha.style.transform = "";
        if (ahoraT) M.anim(ficha, [{ transform: ahoraT }, { transform: "none" }], { duration: 240, easing: M.CURVA.muelle }, "tj-vuelve");
      };
      ficha.addEventListener("pointerup", soltar);
      ficha.addEventListener("pointercancel", soltar);
    }

    /* ---------- bancos (fetch y memoria) ---------- */
    var BANCOS = {}, CARGA = {};
    function banco(u) {
      if (BANCOS[u]) return BANCOS[u];
      if (!CARGA[u] || CARGA[u] === "error") {
        CARGA[u] = "cargando";
        fetch("preguntas/" + u + ".json", { credentials: "same-origin" })
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function (j) { j.porId = {}; j.bancos.forEach(function (b) { b.preguntas.forEach(function (q) { q._b = b; j.porId[q.id] = q; }); }); BANCOS[u] = j; CARGA[u] = "ok"; })
          .catch(function () { CARGA[u] = "error"; })
          .then(function () { var r = location.hash; if (r.indexOf("/" + u) > 0 || /^#\/(errores|hoy)/.test(r)) ctx.pintar(true); });
      }
      return null;
    }
    function esperaBanco(u) {
      if (CARGA[u] === "error") return '<div class="estado es-error" role="alert"><svg aria-hidden="true"><use href="' + ctx.SPR + 'i-sin-conexion"/></svg><div><h2 class="estado-tit">No se pudieron cargar las preguntas</h2><p>Sin conexión y sin copia guardada todavía. Conéctate un momento: después funcionará sin red.</p><div class="acciones"><button class="boton" type="button" data-qz="recargar">' + ico("actualizar") + "Reintentar</button></div></div></div>";
      return ctx.cargando("Cargando las preguntas");
    }

    /* ---------- texto rico seguro ---------- */
    var PERMITIDAS = { P: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, S: 1, BR: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TH: 1, TD: 1, CODE: 1, SUB: 1, SUP: 1, SPAN: 1, A: 1, SMALL: 1, MARK: 1 };
    var FUERA = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, TEMPLATE: 1, NOSCRIPT: 1 };
    var parser = typeof DOMParser !== "undefined" ? new DOMParser() : null;
    function limpiar(nodo, base) {
      var out = "";
      for (var n = nodo.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) { out += esc(n.nodeValue); continue; }
        if (n.nodeType !== 1) continue;
        var t = n.tagName;
        if (FUERA[t]) continue;
        if (!PERMITIDAS[t]) { out += limpiar(n, base); continue; }
        var at = "";
        if (t === "A") {
          var h = n.getAttribute("href") || "", u = null;
          try { u = new URL(h, new URL(base, location.href)); } catch (_) {}
          if (u && /^https?:$/.test(u.protocol)) at = ' href="' + esc(u.href) + '"' + (u.origin !== location.origin ? ' rel="noopener" target="_blank"' : "");
        }
        if ((t === "TD" || t === "TH") && /^\d{1,2}$/.test(n.getAttribute("colspan") || "")) at += ' colspan="' + n.getAttribute("colspan") + '"';
        var tg = t.toLowerCase();
        out += t === "BR" ? "<br>" : "<" + tg + at + ">" + limpiar(n, base) + "</" + tg + ">";
      }
      return out;
    }
    function rico(s, formato, base) {
      s = s == null ? "" : String(s);
      if (formato === "md") return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/\n/g, "<br>");
      if (formato !== "html" || !parser) return esc(s).replace(/\n/g, "<br>");
      return limpiar(parser.parseFromString("<!doctype html><body>" + s, "text/html").body, base || "./");
    }
    function fmtDe(q) { return q._b.formato; }
    function baseDe(q) { return "../" + q._b.fuente; }
    function r(q, s) { return rico(s, fmtDe(q), baseDe(q)); }

    /* ---------- datos guardados ---------- */
    var rutaU = function (u, k) { return ["unidades", u, k]; };
    function intentos(u) { var v = ctx.leer(rutaU(u, "intentos"), {}); return v && typeof v === "object" ? v : {}; }
    function guardarIntento(u, it) { var v = intentos(u); v.actual = it; if (!ctx.guardar(rutaU(u, "intentos"), v)) ctx.aviso("No se pudo guardar. Revisa el espacio del navegador.", "error"); }
    function historial(u) { var h = intentos(u).historial; return Array.isArray(h) ? h : []; }
    function mazo(u) { var m = ctx.leer(rutaU(u, "errores"), {}); return m && typeof m === "object" ? m : {}; }
    function estadosT(u) { var m = ctx.leer(rutaU(u, "tarjetas"), {}); return m && typeof m === "object" ? m : {}; }
    function nMazo(u) { return Object.keys(mazo(u)).length; }

    /* ---------- diálogo de confirmación ---------- */
    function confirmar(titulo, texto, si, no) {
      return new Promise(function (res) {
        var antes = document.activeElement, capa = document.createElement("div");
        capa.className = "qz-capa";
        capa.innerHTML = '<div class="qz-dialogo hoja" role="alertdialog" aria-modal="true" aria-labelledby="qzDlgT" aria-describedby="qzDlgP"><h2 id="qzDlgT"></h2><p id="qzDlgP"></p><div class="acciones"><button type="button" class="boton" data-r="1"></button><button type="button" class="boton secundario" data-r="0"></button></div></div>';
        $("#qzDlgT", capa).textContent = titulo; $("#qzDlgP", capa).textContent = texto;
        $('[data-r="1"]', capa).textContent = si; $('[data-r="0"]', capa).textContent = no;
        function fin(v) { document.removeEventListener("keydown", tecla, true); capa.remove(); if (antes && antes.focus && document.contains(antes)) antes.focus({ preventScroll: true }); res(v); }
        function tecla(e) {
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fin(false); }
          else if (e.key === "Tab") { var b = $$("button", capa), i = b.indexOf(document.activeElement); e.preventDefault(); b[(i + (e.shiftKey ? b.length - 1 : 1)) % b.length].focus(); }
        }
        capa.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) fin(b.getAttribute("data-r") === "1"); else if (e.target === capa) fin(false); });
        document.addEventListener("keydown", tecla, true);
        document.body.appendChild(capa);
        $('[data-r="0"]', capa).focus();
      });
    }

    /* ================= PRÁCTICA ================= */
    var EST = {};          /* estado de pantalla por unidad (no se guarda: lo que importa está en tsapc:v2) */
    var MODOS = { practica: "Práctica", examen: "Examen", falladas: "Solo falladas" };
    /* al llegar desde otra pantalla se empieza por elegir (o se sigue el intento a medias) */
    window.addEventListener("hashchange", function () { for (var k in EST) if (tiene(EST, k)) { EST[k].fase = null; EST[k].llegada = true; } });
    function est(u) { return EST[u] || (EST[u] = { fase: null, banco: null, partes: [], modo: "practica", minutos: 0, barajar: true, filtro: "falladas", indice: false }); }
    function unidadOk(id) { return id && D.unidad(id) ? D.unidad(id) : null; }
    function preguntasDe(J, it) { return it.orden.map(function (id) { return J.porId[id]; }).filter(Boolean); }

    function pPractica(id, arg2) {
      var u = unidadOk(id); if (!u) return null;
      var S1 = A[u.s], J = banco(u.id), e = est(u.id);
      var rt = ctx.ruta([["Asignaturas", "#/asignaturas"], [S1.nombre, "#/asignatura/" + u.s], [u.codigo, "#/unidad/" + u.id], ["Practicar"]]);
      var cab = '<header class="cab">' + ctx.titulo('Practicar <span class="fluor asig">' + esc(u.titulo) + "</span>") + "</header>";
      if (!J) return { sec: "asignaturas", titulo: "Practicar · " + u.codigo, subject: u.s, html: rt + cab + esperaBanco(u.id) };
      var act = intentos(u.id).actual;
      if (act && !J.porId[act.orden[0]]) act = null;
      if (e.fase === null) {
        e.fase = act && !act.terminado && !e.llegada ? "hacer" : "elegir";   /* al recargar se sigue; al llegar desde otra pantalla, se elige */
        e.llegada = false;
        if (arg2 === "errores") { e.modo = "falladas"; e.fase = "elegir"; }
      }
      if ((e.fase === "hacer" || e.fase === "aviso" || e.fase === "resultado") && !act) e.fase = "elegir";
      var cuerpo = e.fase === "hacer" ? vistaPregunta(u, J, act, e) : e.fase === "aviso" ? vistaAviso(u, J, act) : e.fase === "resultado" ? vistaResultado(u, J, act, e) : vistaElegir(u, J, act, e);
      var enCurso = e.fase === "hacer" || e.fase === "aviso";
      return { sec: "asignaturas", titulo: (enCurso ? "Pregunta · " : "Practicar · ") + u.codigo, subject: u.s, html: (enCurso ? "" : rt + cab) + cuerpo, montar: enCurso ? montarHacer : null,
        examen: enCurso && !!act && act.modo === "examen" && !act.terminado, animar: efectosPractica };
    }

    /* --- elegir --- */
    function bancoSel(J, e) { var b = J.bancos.filter(function (x) { return x.id === e.banco; })[0]; return b || J.bancos[0]; }
    function seleccion(u, J, e) {
      if (e.modo === "falladas") { var m = mazo(u.id); return Object.keys(m).map(function (k) { return J.porId[k]; }).filter(Boolean); }
      var b = bancoSel(J, e), ps = e.partes.filter(function (p) { return b.partes.some(function (x) { return x.id === p; }); });
      return b.preguntas.filter(function (q) { return !ps.length || ps.indexOf(q.parte) >= 0; });
    }
    function seg(nombre, val, ops, etq) {
      return '<div class="segmentado compacto" role="group" aria-label="' + esc(etq) + '">' + ops.map(function (o) { return '<button type="button" data-qz-' + nombre + '="' + esc(String(o[0])) + '" aria-pressed="' + (String(val) === String(o[0])) + '"' + (o[2] ? " disabled" : "") + ">" + esc(o[1]) + "</button>"; }).join("") + "</div>";
    }
    function vistaElegir(u, J, act, e) {
      var b = bancoSel(J, e), n = seleccion(u, J, e).length, nm = nMazo(u.id), h = historial(u.id), mj = Q.mejor(h);
      var tipos = {}; b.preguntas.forEach(function (q) { tipos[q.tipo] = (tipos[q.tipo] || 0) + 1; });
      var html = '<p class="sub qz-intro">' + esc(b.titulo) + " · " + b.preguntas.length + " preguntas sacadas tal cual del simulacro: " + Object.keys(tipos).map(function (t) { return tipos[t] + " de " + Q.TIPOS[t].toLowerCase(); }).join(", ") + ".</p>";
      if (act && !act.terminado) {
        var hechas = act.orden.filter(function (id) { return J.porId[id] && Q.contestada(J.porId[id], act.resp[id]); }).length;
        html += '<div class="recuadro qz-medias"><span class="washi" aria-hidden="true"></span><h2 class="qz-h">Tienes un intento a medias</h2><p>' + MODOS[act.modo] + " · " + hechas + " de " + act.orden.length + " contestadas" + (act.limite ? " · con tiempo" : "") + '. Está guardado: sigue donde lo dejaste.</p><div class="acciones"><button type="button" class="boton" data-qz="seguir">Seguir' + ico("siguiente") + '</button><button type="button" class="boton secundario" data-qz="descartar">Descartarlo</button></div></div>';
      }
      if (act && act.terminado) {
        var cu = Q.corregir(act, preguntasDe(J, act));
        html += '<div class="recuadro qz-medias"><span class="washi" aria-hidden="true"></span><h2 class="qz-h">Último intento corregido: <span class="num qz-hist-nota' + (cu.nota >= 5 ? " ok" : "") + '">' + coma(cu.nota) + '</span></h2><p>' + MODOS[act.modo] + " · " + cu.aciertos + " de " + cu.preguntas + " bien" + (cu.pendientes.length ? " · " + cu.pendientes.length + " abiertas por marcar" : "") + '.</p><div class="acciones"><button type="button" class="boton secundario" data-qz="ver-resultado">Ver la corrección</button></div></div>';
      }
      html += '<div class="rejilla rejilla-qz"><section aria-labelledby="hQm"><h2 id="hQm">Modo</h2><div class="qz-modos" role="group" aria-label="Modo">' +
        [["practica", "Práctica", "Ves si aciertas al momento, con la explicación si la hay."], ["examen", "Examen", "Sin ver aciertos hasta el final. Nota sobre 10 e historial."], ["falladas", "Solo falladas", nm ? "Las " + nm + " de tu mazo de errores." : "Tu mazo de errores está vacío."]].map(function (m) {
          return '<button type="button" class="qz-modo" data-qz-modo="' + m[0] + '" aria-pressed="' + (e.modo === m[0]) + '"' + (m[0] === "falladas" && !nm ? " disabled" : "") + "><b>" + m[1] + "</b><span>" + esc(m[2]) + "</span></button>";
        }).join("") + "</div>" +
        (e.modo === "examen" ? '<h3 class="qz-h3" id="hQt">Tiempo</h3>' + seg("min", e.minutos, [[0, "Sin tiempo"], [15, "15 min"], [30, "30 min"], [45, "45 min"], [60, "60 min"]], "Tiempo del examen") : "") +
        '<label class="qz-check"><input type="checkbox" data-qz-barajar' + (e.barajar ? " checked" : "") + '> Barajar preguntas y opciones</label></section>';
      if (e.modo !== "falladas") {
        html += '<section aria-labelledby="hQe"><h2 id="hQe">Qué entra</h2>' + (J.bancos.length > 1 ? '<h3 class="qz-h3">Banco</h3>' + seg("banco", b.id, J.bancos.map(function (x) { return [x.id, x.titulo]; }), "Banco de preguntas") : "") +
          '<ul class="qz-partes">' + '<li><button type="button" data-qz-parte="" aria-pressed="' + !e.partes.length + '"><span>Todo</span><b class="num">' + b.preguntas.length + "</b></button></li>" +
          b.partes.map(function (p) { var c = b.preguntas.filter(function (q) { return q.parte === p.id; }).length; return '<li><button type="button" data-qz-parte="' + esc(p.id) + '" aria-pressed="' + (e.partes.indexOf(p.id) >= 0) + '"><span>' + esc(Q.plano((p.k ? p.k + " · " : "") + p.t)) + '</span><b class="num">' + c + "</b></button></li>"; }).join("") + "</ul></section>";
      }
      html += '<section class="ancho qz-empezar"><button type="button" class="boton" data-qz="empezar"' + (n ? "" : " disabled") + ">" + (n ? "Empezar · " + n + (n === 1 ? " pregunta" : " preguntas") : "No hay preguntas con esa elección") + ico("siguiente") + "</button>" +
        '<a class="boton fantasma" href="../' + esc(J.bancos[0].fuente) + '">Abrir el simulacro de siempre</a></section>';
      html += '<section class="ancho" aria-labelledby="hQh"><div class="sec-cab"><h2 id="hQh">Tus intentos</h2>' + (mj ? '<span class="mano">mejor nota: ' + coma(mj.nota) + "</span>" : "") + "</div>" + listaHistorial(h) + "</section></div>";
      return html;
    }
    function listaHistorial(h) {
      if (!h.length) return '<p class="sub">Aún no has terminado ningún intento. Cuando corrijas uno, aquí verás la fecha, el modo y la nota.</p>';
      return '<ol class="qz-hist">' + h.slice(-8).reverse().map(function (x) {
        var f = new Date(x.fecha);
        return '<li><span class="num qz-hist-nota' + (x.nota >= 5 ? " ok" : "") + '">' + coma(x.nota) + '</span><span>' + esc(MODOS[x.modo] || x.modo) + " · " + x.aciertos + "/" + x.preguntas + " bien</span><span class=\"qz-hist-f\">" + f.getDate() + " " + ctx.MESES[f.getMonth()].slice(0, 3) + (x.segundos ? " · " + Math.max(1, Math.round(x.segundos / 60)) + " min" : "") + "</span></li>";
      }).join("") + "</ol>";
    }

    /* --- hacer --- */
    function pos(act) { return Math.max(0, Math.min(act.orden.length - 1, act.pos || 0)); }
    function relojTxt(ms) { var s = Math.ceil(ms / 1000), m = Math.floor(s / 60); return (m < 10 ? "0" : "") + m + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
    function vistaPregunta(u, J, act, e) {
      var i = pos(act), q = J.porId[act.orden[i]], total = act.orden.length, ex = act.modo === "examen";
      var vista = !ex && !!act.vistas[q.id];
      var hechas = act.orden.filter(function (id) { return J.porId[id] && Q.contestada(J.porId[id], act.resp[id]); }).length;
      var parte = q._b.partes.filter(function (p) { return p.id === q.parte; })[0] || {};
      var barra = '<div class="qz-barra"><a class="qz-salir" href="#/unidad/' + esc(u.id) + '" data-qz="salir" aria-label="Salir (Esc)">' + ico("cerrar") + '</a><div class="qz-cuenta"><span class="num"><b>' + (i + 1) + "</b> / " + total + '</span><span class="qz-modo-et">' + MODOS[act.modo] + '</span></div><div class="qz-prog" role="progressbar" aria-label="Contestadas" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + hechas + '"><i style="width:' + (hechas / total * 100) + '%"></i></div>' +
        (act.limite ? '<span class="qz-reloj num" role="timer" aria-label="Tiempo que queda" data-qz-reloj>' + relojTxt(Q.restante(act, ctx.ahora().getTime())) + "</span>" : "") +
        '<button type="button" class="qz-ind-b" data-qz="indice" aria-expanded="' + !!e.indice + '" aria-controls="qzIndice">Índice</button></div>';
      var indice = '<div class="qz-indice" id="qzIndice"' + (e.indice ? "" : " hidden") + '><ol>' + act.orden.map(function (id, k) {
        var qq = J.porId[id], c = qq && Q.contestada(qq, act.resp[id]), cl = c ? " contestada" : "";
        if (!ex && qq && act.vistas[id]) cl += Q.corregirPregunta(qq, act.resp[id], act.auto[id]).ok ? " bien" : " mal";
        return '<li><button type="button" data-qz-ir="' + k + '" class="' + cl + '"' + (k === i ? ' aria-current="step"' : "") + ' aria-label="Pregunta ' + (k + 1) + (c ? ", contestada" : ", sin contestar") + '">' + (k + 1) + "</button></li>";
      }).join("") + "</ol></div>";
      var ctxTxt = parte.contexto ? '<div class="qz-contexto">' + esc(parte.contexto).replace(/\{(\d+)\}/g, function (m, d) { return '<span class="qz-hueco' + (+d === q.hueco ? " actual" : "") + '">(' + d + ")" + (+d === q.hueco ? " ____" : "") + "</span>"; }) + "</div>" : "";
      var how = parte.how ? '<details class="qz-how"' + (/<blockquote|Caso/.test(parte.how) ? " open" : "") + "><summary>" + esc(Q.plano((parte.k ? parte.k + " · " : "") + parte.t)) + '</summary><div class="rico">' + r(q, parte.how) + "</div></details>" : "";
      var enun = q.hueco ? "Hueco (" + q.hueco + ")" : q.tipo === "esquema" ? r(q, q.texto) + ' <span class="qz-n">diap. ' + esc(String(q.diapositiva)) + "</span>" : r(q, q.variante === "selgap" || q.variante === "gap" ? q.texto.replace("{}", "_____") : q.texto);
      var html = barra + indice + '<article class="qz-hoja" aria-labelledby="qzEnun">' + how + ctxTxt +
        '<div class="qz-num mano" aria-hidden="true">' + esc(q.n ? q.n : String(i + 1)) + '.</div><h1 id="titulo" tabindex="-1" class="qz-enun' + (q.variante === "fix" ? " qz-tachado" : "") + '"><span class="sr">Pregunta ' + (i + 1) + " de " + total + ". </span><span id=\"qzEnun\" class=\"rico\">" + enun + "</span>" + (q.pista ? ' <span class="qz-pista">(' + esc(q.pista) + ")</span>" : "") + "</h1>" +
        respuestaHTML(q, act, vista, ex) + "</article>";
      var ult = i === total - 1;
      html += '<nav class="qz-nav" aria-label="Moverse entre preguntas"><button type="button" class="boton secundario" data-qz="ant"' + (i ? "" : " disabled") + ">" + ico("volver") + 'Anterior</button>' +
        (ult ? '<button type="button" class="boton" data-qz="corregir">Corregir' + ico("check") + "</button>" : '<button type="button" class="boton" data-qz="sig">Siguiente' + ico("siguiente") + "</button>") +
        (ult ? "" : '<button type="button" class="boton fantasma" data-qz="corregir">Terminar y corregir</button>') + '</nav><p class="qz-teclas" aria-hidden="true"><kbd>1</kbd>–<kbd>4</kbd> elige · <kbd>Intro</kbd> siguiente · <kbd>Esc</kbd> salir</p>';
      return html;
    }
    function fb(ok, texto) { return '<div class="qz-fb ' + (ok ? "bien" : "mal") + '" role="status">' + ico(ok ? "check" : "cerrar") + "<div>" + texto + "</div></div>"; }
    function respuestaHTML(q, act, vista, ex) {
      var v = act.resp[q.id], c = vista ? Q.corregirPregunta(q, v, act.auto[q.id]) : null, h = "";
      if (q.tipo === "test" || q.tipo === "vf") {
        var p = Q.presentar(q, act);
        var elegida = q.tipo === "vf" ? (typeof v === "boolean" ? (v ? 0 : 1) : -1) : (typeof v === "number" ? p.orden.indexOf(v) : -1);
        h = '<div class="qz-opciones' + (q.tipo === "vf" ? " vf" : "") + '" role="group" aria-labelledby="qzEnun">' + p.opciones.map(function (o, k) {
          var cl = k === elegida ? " elegida" : "";
          if (vista) cl += k === p.correcta ? " buena" : k === elegida ? " mala" : "";
          return '<button type="button" class="qz-op' + cl + '" data-qz-op="' + k + '" aria-pressed="' + (k === elegida) + '"' + (vista ? ' aria-disabled="true"' : "") + '><span class="qz-letra" aria-hidden="true">' + (q.tipo === "vf" ? (k ? "F" : "V") : Q.LETRAS[k]) + '</span><span class="qz-op-t rico">' + (q.tipo === "vf" ? o : r(q, o)) + '</span>' + (vista && k === p.correcta ? ico("check") + '<span class="sr"> (la buena)</span>' : vista && k === elegida ? ico("cerrar") + '<span class="sr"> (fallada)</span>' : "") + (k < 9 ? '<kbd class="qz-tecla" aria-hidden="true">' + (k + 1) + "</kbd>" : "") + "</button>";
        }).join("") + "</div>";
        if (vista) h += fb(c.ok, (c.ok ? "<b>Bien.</b>" : "<b>No.</b> La buena: " + (q.tipo === "vf" ? c.correcta : Q.LETRAS[p.correcta] + ") " + r(q, c.correcta))) + (q.explicacion ? '<div class="rico qz-expl">' + r(q, q.explicacion) + "</div>" : ""));
        return h;
      }
      if (q.tipo === "relacionar") {
        var pr = Q.presentar(q, act);
        h = '<div class="qz-rel">' + pr.filas.map(function (f, k) {
          var oi = pr.orden[k], val = Array.isArray(v) && typeof v[oi] === "number" ? v[oi] : "", d = c ? c.detalle[oi] : null;
          return '<div class="qz-rel-f' + (d ? (d.ok ? " bien" : " mal") : "") + '"><label for="qzR' + oi + '" class="rico">' + (d ? ico(d.ok ? "check" : "cerrar") + '<span class="sr">' + (d.ok ? "Bien: " : "Mal: ") + "</span>" : "") + r(q, f[0]) + '</label><select id="qzR' + oi + '" data-qz-rel="' + oi + '"' + (vista ? " disabled" : "") + '><option value="">— elige —</option>' + q.opciones.map(function (o, j) { return '<option value="' + j + '"' + (val === j ? " selected" : "") + ">" + esc(Q.plano(o)) + "</option>"; }).join("") + "</select>" + (d && !d.ok ? '<span class="qz-buena">' + esc(Q.plano(d.buena)) + "</span>" : "") + "</div>";
        }).join("") + "</div>";
      } else if (q.tipo === "esquema" || q.tipo === "escribir") {
        var campos = q.tipo === "esquema" ? q.respuestas.map(function (a, k) { return { etiqueta: String(k + 1) }; }) : q.campos;
        if (q.tipo === "esquema") h += '<figure class="qz-fig"><img src="' + esc(baseDe(q) + q.img) + '" alt="Esquema para rellenar: ' + esc(Q.plano(q.texto)) + '" loading="lazy"></figure>';
        h += '<div class="qz-campos' + (q.tipo === "esquema" ? " esquema" : "") + '">' + campos.map(function (f, k) {
          var val = Array.isArray(v) && typeof v[k] === "string" ? v[k] : "", d = c ? c.detalle[k] : null;
          var ovr = d && !d.ok && val && q.tipo === "esquema" ? ' <button type="button" class="qz-mini" data-qz-ovr="' + k + '">La tenía bien</button>' : "";
          return '<div class="qz-campo' + (d ? (d.ok ? " bien" : " mal") : "") + '"><label for="qzC' + k + '">' + (d ? ico(d.ok ? "check" : "cerrar") + '<span class="sr">' + (d.ok ? "Bien: " : "Mal: ") + "</span>" : "") + esc(f.etiqueta || (campos.length > 1 ? String(k + 1) : "Tu respuesta")) + '</label><input id="qzC' + k + '" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" data-qz-campo="' + k + '" value="' + esc(val) + '"' + (vista ? " readonly" : "") + ">" + (d && !d.ok ? '<span class="qz-buena">' + esc(d.buena) + "</span>" + ovr : "") + "</div>";
        }).join("") + "</div>";
      } else if (q.tipo === "abierta") {
        h = '<label class="sr" for="qzTxt">Tu respuesta</label><textarea id="qzTxt" rows="' + (q.lineas || 4) + '" data-qz-txt placeholder="Escribe tu respuesta (o contéstala en voz alta)">' + esc(typeof v === "string" ? v : "") + "</textarea>";
        if (!ex && !vista) h += '<button type="button" class="boton secundario qz-comprobar" data-qz="ver">Ver la respuesta modelo</button>';
        if (vista) h += modelo(q, act.auto[q.id]);
        return h;
      }
      if (!ex && !vista) h += '<button type="button" class="boton secundario qz-comprobar" data-qz="ver">Comprobar</button>';
      if (vista) h += fb(c.ok, "<b>" + c.puntos + " de " + c.max + "</b>" + (c.ok ? " · ¡Bien!" : ""));
      return h;
    }
    function modelo(q, auto) {
      return '<div class="qz-modelo"><p class="qz-modelo-t">Respuesta modelo</p><div class="rico">' + r(q, q.respuesta) + '</div></div><div class="qz-auto" role="group" aria-label="¿La tenías bien?"><button type="button" class="boton secundario" data-qz-auto="1" data-qid="' + esc(q.id) + '" aria-pressed="' + (auto === 1) + '">' + ico("check") + 'La tenía bien</button><button type="button" class="boton secundario" data-qz-auto="0" data-qid="' + esc(q.id) + '" aria-pressed="' + (auto === 0) + '">' + ico("cerrar") + "La tenía mal</button></div>";
    }

    /* --- aviso de sin contestar --- */
    function vistaAviso(u, J, act) {
      var faltan = Q.sinContestar(act, preguntasDe(J, act));
      return '<div class="qz-barra"><span class="qz-cuenta"><span class="num"><b>' + (act.orden.length - faltan.length) + "</b> / " + act.orden.length + "</span><span class=\"qz-modo-et\">contestadas</span></span></div>" +
        '<section class="qz-aviso" aria-labelledby="titulo"><span class="washi" aria-hidden="true"></span>' + ctx.titulo("Te " + (faltan.length === 1 ? "queda <em>1 pregunta</em>" : "quedan <em>" + faltan.length + " preguntas</em>") + " sin contestar") +
        '<p class="sub">Si corriges ahora, contarán como falladas. Toca una para ir a ella.</p><ol class="qz-faltan">' + faltan.slice(0, 40).map(function (id) {
          var k = act.orden.indexOf(id), q = J.porId[id];
          return '<li><button type="button" data-qz-ir="' + k + '"><span class="num">' + (k + 1) + "</span><span>" + esc(Q.plano(q.texto || "Hueco (" + q.hueco + ")").slice(0, 110)) + "</span></button></li>";
        }).join("") + (faltan.length > 40 ? "<li>… y " + (faltan.length - 40) + " más</li>" : "") + '</ol><div class="acciones"><button type="button" class="boton" data-qz="ir-faltan">Contestarlas</button><button type="button" class="boton secundario" data-qz="corregir-ya">Corregir igualmente</button></div></section>';
    }

    /* --- resultado --- */
    var CIRCULO = '<svg class="qz-circulo" viewBox="0 0 200 140" aria-hidden="true"><path pathLength="1" d="M150 18 C112 2 40 10 22 52 C6 92 52 132 108 128 C164 124 196 92 186 56 C178 28 140 14 96 18"/></svg>';
    function vistaResultado(u, J, act, e) {
      var ps = preguntasDe(J, act), c = Q.corregir(act, ps), h = historial(u.id), mj = Q.mejor(h);
      var mins = act.fin ? Math.max(1, Math.round((act.fin - act.inicio) / 60000)) : null;
      var tipos = Object.keys(c.porTipo).map(function (t) { var x = c.porTipo[t]; return '<tr><th scope="row">' + esc(x.nombre) + '</th><td class="num">' + x.puntos + " / " + x.max + '</td><td><span class="qz-mini-barra"><i style="width:' + (x.max ? x.puntos / x.max * 100 : 0) + '%"></i></span></td></tr>'; }).join("");
      var lista = act.orden.filter(function (id) { return e.filtro === "todas" || c.falladas.indexOf(id) >= 0 || J.porId[id].tipo === "abierta"; });
      var html = '<div class="qz-nota-caja"><div class="qz-nota" role="img" aria-label="Nota: ' + coma(c.nota) + ' sobre 10">' + CIRCULO + '<span class="qz-nota-n">' + coma(c.nota) + '</span><span class="qz-nota-s">sobre 10</span></div><div class="qz-nota-txt"><p class="mano">' + (c.nota >= 9 ? "¡Bordado!" : c.nota >= 7 ? "Muy bien." : c.nota >= 5 ? "Aprobado. A por las falladas." : "Toca repasar las falladas.") + "</p><p>" + c.aciertos + " de " + c.preguntas + " bien · " + c.puntos + " de " + c.max + " puntos" + (mins ? " · " + mins + " min" : "") + " · " + MODOS[act.modo] + "</p>" +
        (c.pendientes.length ? '<p class="qz-pend">' + ico("alerta") + "<span>Te " + (c.pendientes.length === 1 ? "queda 1 respuesta abierta" : "quedan " + c.pendientes.length + " respuestas abiertas") + " por marcar. La nota cambia al marcarlas.</span></p>" : "") +
        (mj ? '<p class="sub">Tu mejor nota en esta unidad: <b class="num">' + coma(mj.nota) + "</b></p>" : "") + "</div></div>";
      html += '<div class="acciones qz-acc">' + (c.falladas.length ? '<button type="button" class="boton" data-qz="repetir-falladas">Repetir solo las falladas · ' + c.falladas.length + "</button>" : "") + '<button type="button" class="boton secundario" data-qz="otro">Otro intento</button><a class="boton fantasma" href="#/unidad/' + esc(u.id) + '">Volver a la unidad</a></div>';
      html += '<div class="rejilla"><section aria-labelledby="hQd"><h2 id="hQd">Por tipo</h2><table class="qz-tipos"><tbody>' + tipos + '</tbody></table></section><section aria-labelledby="hQz"><h2 id="hQz">Tu mazo de errores</h2><p>' + (nMazo(u.id) ? "Tienes <b>" + nMazo(u.id) + "</b> en el mazo de " + esc(u.codigo) + ". Cada una sale tras acertarla 2 veces seguidas." : "Vacío: no te queda ninguna por repasar.") + '</p><p><a class="boton fantasma" href="#/errores">Ver Errores</a></p></section>' +
        '<section class="ancho" aria-labelledby="hQr"><div class="sec-cab"><h2 id="hQr">Corrección</h2>' + seg("filtro", e.filtro, [["falladas", "Falladas y abiertas"], ["todas", "Todas"]], "Qué preguntas ver") + "</div>" +
        (lista.length ? '<ol class="qz-revision">' + lista.map(function (id) { return revision(J.porId[id], act, c.porPregunta[id], act.orden.indexOf(id)); }).join("") + "</ol>" : '<p class="sub">Ninguna fallada. Nada que revisar aquí.</p>') + "</section></div>";
      return html;
    }
    function revision(q, act, c, k) {
      var est = c.pendiente ? "pend" : c.ok ? "bien" : "mal";
      var h = '<li class="qz-rev ' + est + '"><div class="qz-rev-cab"><span class="num">' + (k + 1) + '</span><span class="qz-rev-tipo">' + esc(Q.TIPOS[q.tipo]) + (c.max > 1 ? " · " + c.puntos + "/" + c.max : "") + '</span><span class="qz-rev-est">' + ico(c.pendiente ? "alerta" : c.ok ? "check" : "cerrar") + (c.pendiente ? "por marcar" : c.ok ? "bien" : "fallada") + '</span></div><div class="rico qz-rev-q">' + (q.texto ? r(q, q.texto) : "Hueco (" + q.hueco + ")") + "</div>";
      if (q.tipo === "abierta") return h + (c.dada ? '<p class="qz-tuya"><span>Tu respuesta</span> ' + esc(c.dada) + "</p>" : '<p class="qz-tuya"><span>Tu respuesta</span> (en blanco)</p>') + modelo(q, act.auto[q.id]) + "</li>";
      if (!c.ok) h += '<p class="qz-tuya"><span>Tu respuesta</span> ' + (c.dada ? (q.tipo === "test" ? '<span class="rico">' + r(q, c.dada) + "</span>" : esc(c.dada)) : "(sin contestar)") + '</p><p class="qz-la-buena"><span>La buena</span> ' + (q.tipo === "test" ? '<span class="rico">' + r(q, c.correcta) + "</span>" : esc(c.correcta)) + "</p>";
      if (q.explicacion) h += '<div class="rico qz-expl">' + r(q, q.explicacion) + "</div>";
      return h + "</li>";
    }

    /* --- acciones de la práctica --- */
    function actual(u) { return intentos(u).actual; }
    function empezar(u, ps, modo, minutos, barajar, bancoId) {
      var it = Q.crearIntento({ unidad: u, banco: bancoId, preguntas: ps, modo: modo, minutos: modo === "examen" ? minutos : 0, barajar: barajar, ahora: ctx.ahora().getTime() });
      guardarIntento(u, it); est(u).fase = "hacer"; est(u).indice = false;
      ctx.repintar("#titulo", true);
    }
    function terminarIntento(u, J, porTiempo) {
      var it = actual(u); if (!it || it.terminado) return;
      Q.terminar(it, Math.min(ctx.ahora().getTime(), it.limite || Infinity));
      var ps = preguntasDe(J, it), c = Q.corregir(it, ps), r0 = Q.apuntar(mazo(u), it, ps, c, ctx.ahora().getTime());
      var v = intentos(u); v.actual = it; v.historial = Q.registrar(v.historial, Q.resumen(it, c));
      ctx.guardar(rutaU(u, "intentos"), v); ctx.guardar(rutaU(u, "errores"), r0.mazo);
      est(u).fase = "resultado"; est(u).filtro = c.falladas.length || c.pendientes.length ? "falladas" : "todas";
      EF = { t: "nota" }; refrescar(u);
      ctx.repintar("#titulo", true);
      ctx.aviso(porTiempo ? "Se acabó el tiempo: examen corregido." : r0.entran.length ? r0.entran.length + (r0.entran.length === 1 ? " pregunta nueva" : " preguntas nuevas") + " en tu mazo de errores." : r0.salen.length ? r0.salen.length + " sale" + (r0.salen.length === 1 ? "" : "n") + " del mazo de errores." : "Corregido.");
    }
    function intentarCorregir(u, J) {
      var it = actual(u); if (!it) return;
      if (Q.sinContestar(it, preguntasDe(J, it)).length) { est(u).fase = "aviso"; return ctx.repintar("#titulo", true); }
      terminarIntento(u, J);
    }
    function irA(u, k) { var it = actual(u); if (!it) return; it.pos = Math.max(0, Math.min(it.orden.length - 1, k)); guardarIntento(u, it); est(u).fase = "hacer"; ctx.repintar("#titulo", true); }

    /* entrada de texto: se guarda al momento (con un respiro de 250 ms) */
    var pendiente = null;
    function guardarYa() { if (pendiente) { clearTimeout(pendiente.t); var p = pendiente; pendiente = null; guardarIntento(p.u, p.it); } }
    window.addEventListener("pagehide", guardarYa);
    function entrada(ev) {
      var t = ev.target, R = rutaAct(); if (!R || R.sec !== "practica" || !t.closest || !t.closest("#vista")) return;
      var u = R.u, it = pendiente && pendiente.u === u ? pendiente.it : actual(u); if (!it || it.terminado) return;
      var id = it.orden[pos(it)], v = it.resp[id];
      if (t.hasAttribute("data-qz-txt")) Q.responder(it, id, t.value);
      else if (t.hasAttribute("data-qz-campo") || t.hasAttribute("data-qz-rel")) {
        var k = +(t.getAttribute("data-qz-campo") || t.getAttribute("data-qz-rel")), arr = Array.isArray(v) ? v.slice() : [];
        arr[k] = t.hasAttribute("data-qz-rel") ? (t.value === "" ? null : +t.value) : t.value;
        for (var x = 0; x < arr.length; x++) if (arr[x] === undefined) arr[x] = t.hasAttribute("data-qz-rel") ? null : "";
        Q.responder(it, id, arr);
      } else return;
      if (pendiente) clearTimeout(pendiente.t);
      pendiente = { u: u, it: it, t: setTimeout(guardarYa, ev.type === "change" ? 0 : 250) };
    }
    document.addEventListener("input", entrada);
    document.addEventListener("change", entrada);

    function rutaAct() { var p = location.hash.replace(/^#\/?/, "").split("/"); return p[0] === "practica" || p[0] === "tarjetas" ? { sec: p[0], u: decodeURIComponent(p[1] || "") } : null; }

    function clicPractica(t, u, J) {
      var e = est(u), it = actual(u), a = t.getAttribute("data-qz");
      if (t.hasAttribute("data-qz-modo")) { e.modo = t.getAttribute("data-qz-modo"); return ctx.repintar('[data-qz-modo="' + e.modo + '"]'); }
      if (t.hasAttribute("data-qz-min")) { e.minutos = +t.getAttribute("data-qz-min"); return ctx.repintar('[data-qz-min="' + e.minutos + '"]'); }
      if (t.hasAttribute("data-qz-banco")) { e.banco = t.getAttribute("data-qz-banco"); e.partes = []; return ctx.repintar('[data-qz-banco="' + e.banco + '"]'); }
      if (t.hasAttribute("data-qz-parte")) {
        var p = t.getAttribute("data-qz-parte"), i = e.partes.indexOf(p);
        if (!p) e.partes = []; else if (i >= 0) e.partes.splice(i, 1); else e.partes.push(p);
        return ctx.repintar('[data-qz-parte="' + p + '"]');
      }
      if (t.hasAttribute("data-qz-filtro")) { e.filtro = t.getAttribute("data-qz-filtro"); return ctx.repintar('[data-qz-filtro="' + e.filtro + '"]'); }
      if (t.hasAttribute("data-qz-ir")) return irA(u, +t.getAttribute("data-qz-ir"));
      if (t.hasAttribute("data-qz-auto")) {
        var qid = t.getAttribute("data-qid"), bien = t.getAttribute("data-qz-auto") === "1"; if (!it) return;
        guardarYa(); it = actual(u);
        it.auto[qid] = bien ? 1 : 0;
        if (it.terminado) {
          var ps = preguntasDe(J, it), c = Q.corregir(it, ps), v = intentos(u);
          v.actual = it; v.historial = Q.registrar(v.historial, Q.resumen(it, c)); ctx.guardar(rutaU(u, "intentos"), v);
          ctx.guardar(rutaU(u, "errores"), Q.apuntar(mazo(u), { orden: [qid], banco: it.banco }, ps, c, ctx.ahora().getTime()).mazo);
        } else guardarIntento(u, it);
        return ctx.repintar('[data-qz-auto="' + (bien ? 1 : 0) + '"][data-qid="' + qid + '"]');
      }
      if (t.hasAttribute("data-qz-op")) {
        if (!it || it.terminado) return; guardarYa(); it = actual(u);
        var q = J.porId[it.orden[pos(it)]], ex = it.modo === "examen";
        if (!ex && it.vistas[q.id]) return;
        Q.responder(it, q.id, Q.valorDesdePosicion(q, it, +t.getAttribute("data-qz-op")));
        if (!ex) { it.vistas[q.id] = 1; EF = { t: "resp", ok: Q.corregirPregunta(q, it.resp[q.id], it.auto[q.id]).ok }; }
        guardarIntento(u, it); refrescar(u);
        return ctx.repintar('.qz-nav [data-qz="sig"], .qz-nav .boton[data-qz="corregir"]');   /* Intro pasa a la siguiente */
      }
      if (t.hasAttribute("data-qz-ovr")) {
        guardarYa(); it = actual(u); var qq = J.porId[it.orden[pos(it)]], au = Array.isArray(it.auto[qq.id]) ? it.auto[qq.id] : [];
        au[+t.getAttribute("data-qz-ovr")] = 1; for (var z = 0; z < au.length; z++) if (au[z] == null) au[z] = 0;
        it.auto[qq.id] = au; guardarIntento(u, it); return ctx.repintar(".qz-nav .boton:not([disabled])");
      }
      switch (a) {
        case "recargar": CARGA[u] = "error"; banco(u); return ctx.pintar(true);
        case "seguir": e.fase = "hacer"; return ctx.repintar("#titulo", true);
        case "ver-resultado": e.fase = "resultado"; return ctx.repintar("#titulo", true);
        case "descartar": return confirmar("¿Descartar el intento a medias?", "Se borran sus respuestas. Tu historial y tu mazo de errores no se tocan.", "Descartar", "Cancelar").then(function (ok) { if (!ok) return; var v = intentos(u); v.actual = null; ctx.guardar(rutaU(u, "intentos"), v); ctx.repintar('[data-qz="empezar"]'); });
        case "empezar": {
          var sel = seleccion(D.unidad(u), J, e); if (!sel.length) return;
          var go = function () { empezar(u, sel, e.modo, e.minutos, e.barajar, e.modo === "falladas" ? "errores" : bancoSel(J, e).id); };
          if (it && !it.terminado) return confirmar("¿Empezar otro intento?", "Tienes uno a medias. Si empiezas otro, se descarta.", "Empezar otro", "Cancelar").then(function (ok) { if (ok) go(); });
          return go();
        }
        case "indice": e.indice = !e.indice; return ctx.repintar('[data-qz="indice"]');
        case "ant": return irA(u, pos(it) - 1);
        case "sig": return irA(u, pos(it) + 1);
        case "ver": { guardarYa(); it = actual(u); var q2 = J.porId[it.orden[pos(it)]]; it.vistas[q2.id] = 1; guardarIntento(u, it); refrescar(u);
          EF = { t: "resp", abierta: q2.tipo === "abierta", ok: q2.tipo === "abierta" ? false : Q.corregirPregunta(q2, it.resp[q2.id], it.auto[q2.id]).ok }; return ctx.repintar(".qz-auto button, .qz-nav [data-qz=sig], .qz-nav [data-qz=corregir]"); }
        case "corregir": guardarYa(); return intentarCorregir(u, J);
        case "corregir-ya": guardarYa(); return terminarIntento(u, J);
        case "ir-faltan": { var f = Q.sinContestar(it, preguntasDe(J, it)); return irA(u, f.length ? it.orden.indexOf(f[0]) : 0); }
        case "repetir-falladas": {
          var c2 = Q.corregir(it, preguntasDe(J, it)), ps2 = c2.falladas.map(function (id) { return J.porId[id]; });
          e.modo = it.modo === "examen" ? "examen" : "practica";
          return empezar(u, ps2, it.modo === "falladas" ? "falladas" : e.modo, it.limite ? Math.max(5, Math.round((it.limite - it.inicio) / 60000 * ps2.length / it.orden.length)) : 0, e.barajar, it.banco);
        }
        case "otro": e.fase = "elegir"; { var v2 = intentos(u); v2.actual = null; ctx.guardar(rutaU(u, "intentos"), v2); } return ctx.repintar('[data-qz="empezar"]', true);
      }
    }
    function salir(u) {
      guardarYa();
      return confirmar("¿Salir del simulacro?", "Lo contestado queda guardado: puedes seguir cuando quieras.", "Salir", "Seguir aquí").then(function (ok) { if (ok) { est(u).fase = null; location.hash = "#/unidad/" + u; } });
    }

    /* reloj del examen */
    function montarHacer() {}
    setInterval(function () {
      var R = rutaAct(); if (!R || R.sec !== "practica" || document.hidden) return;
      var el = $("[data-qz-reloj]"); if (!el) return;
      var it = actual(R.u); if (!it || !it.limite || it.terminado) return;
      var n = ctx.ahora().getTime(), rest = Q.restante(it, n);
      el.textContent = relojTxt(rest); el.classList.toggle("poco", rest < 60000);
      if (Q.agotado(it, n) && BANCOS[R.u]) { guardarYa(); terminarIntento(R.u, BANCOS[R.u], true); }
    }, 1000);

    /* ================= TARJETAS ================= */
    var SES = {};          /* sesión de tarjetas por unidad: {cola:[ids], hechas, vuelta} */
    var NIVEL = { 1: "Imprescindible", 2: "Importante", 3: "Leer una vez" };
    function estadosCon(u, J) {
      var est0 = estadosT(u), out = {}, k; for (k in est0) if (tiene(est0, k)) out[k] = est0[k];
      if (u === "ingles1") {
        var box = ctx.leer(["ingles", "vocabulario", "box"], null), hoy = hoyClave();
        if (box && typeof box === "object") J.tarjetas.forEach(function (t) { if (t.tipo === "palabra" && !out[t.id] && +box[t.cajaAntigua] > 0) out[t.id] = S2.desdeCaja(box[t.cajaAntigua], hoy); });
      }
      return out;
    }
    function sesion(u, J, nueva) {
      var s = SES[u];
      if (!s || nueva) { var e = estadosCon(u, J); s = SES[u] = { cola: S2.paraHoy(J.tarjetas, e, hoyClave()).map(function (t) { return t.id; }), hechas: 0, vuelta: false }; }
      return s;
    }
    function pTarjetas(id) {
      var u = unidadOk(id); if (!u) return null;
      var S1 = A[u.s], J = banco(u.id);
      var rt = ctx.ruta([["Asignaturas", "#/asignaturas"], [S1.nombre, "#/asignatura/" + u.s], [u.codigo, "#/unidad/" + u.id], ["Tarjetas"]]);
      var cab = '<header class="cab">' + ctx.titulo('Tarjetas de <span class="fluor asig">' + esc(u.titulo) + "</span>") + '<p class="sub">Las del modo Tarjetas del repaso' + (u.id === "ingles1" ? " y las 50 palabras del vocabulario" : "") + ". Vuelven justo antes de que se te olviden.</p></header>";
      if (!J) return { sec: "asignaturas", titulo: "Tarjetas · " + u.codigo, subject: u.s, html: rt + cab + esperaBanco(u.id) };
      if (!J.tarjetas.length) return { sec: "asignaturas", titulo: "Tarjetas · " + u.codigo, subject: u.s, html: rt + cab + '<div class="estado"><div><h2 class="estado-tit">Esta unidad no tiene tarjetas</h2><p>El repaso no trae preguntas con respuesta.</p></div></div>' };
      var es = estadosCon(u.id, J), rc = S2.recuento(J.tarjetas, es), s = sesion(u.id, J);
      var cajas = '<div class="tj-cajas" role="list" aria-label="Cajas">' + S2.CAJAS.map(function (n, k) { return '<div class="tj-caja c' + k + '" role="listitem"><span class="tj-pila" aria-hidden="true" style="--n:' + Math.min(6, Math.ceil(rc.cajas[k] / Math.max(1, rc.total) * 12)) + '"></span><b class="num">' + rc.cajas[k] + "</b><span>" + n + "</span></div>"; }).join("") + "</div>" +
        '<p class="tj-dom"><b class="num">' + rc.dominadas + " de " + rc.total + "</b> dominadas · se dominan con " + S2.DOMINADA + " aciertos seguidos</p>";
      var cuerpo;
      var tid = s.cola[0], t = tid && J.tarjetas.filter(function (x) { return x.id === tid; })[0];
      if (!t) {
        var prox = Object.keys(es).map(function (k) { return es[k].due; }).filter(Boolean).sort()[0];
        cuerpo = '<div class="estado tj-fin">' + ctx.pegatina(u.pegatina, u.s, "") + '<div><h2 class="estado-tit">' + (s.hechas ? "Hecho por hoy: " + s.hechas + (s.hechas === 1 ? " tarjeta" : " tarjetas") : "Hoy no te toca ninguna") + "</h2><p>" + (prox ? "La próxima vuelve el " + fechaCorta(prox) + "." : "") + ' Si quieres más, adelanta las de los próximos días.</p><div class="acciones"><button type="button" class="boton" data-tj="mas">Adelantar 10</button><a class="boton secundario" href="#/unidad/' + esc(u.id) + '">Volver a la unidad</a></div></div></div>';
      } else {
        var e0 = es[t.id] || null, pv = S2.previsto(e0, hoyClave());
        var meta = t.tipo === "palabra" ? esc(t.grupo) : esc(t.bloqueNum.replace("BLOQUE", "Bloque") + " · " + t.bloqueTit) + (NIVEL[t.nivel] ? ' · <span class="tj-nivel n' + t.nivel + '">' + NIVEL[t.nivel] + "</span>" : "");
        var dorso = t.tipo === "palabra" ? '<p class="tj-palabra">' + esc(t.dorso) + '</p><p class="tj-extra">Se dice: «' + esc(t.pronuncia) + '»</p><p class="tj-extra"><b>Truco:</b> ' + esc(t.truco) + '</p><p class="tj-extra">“' + esc(t.ejemplo) + "”</p>" : '<div class="rico">' + rico(t.dorso, t.formato, "../" + u.id + "/repaso/") + "</div>" + (t.fuente ? '<p class="tj-fuente">' + esc(t.fuente) + "</p>" : "");
        cuerpo = '<div class="tj-cont"><span class="num">' + (s.hechas + 1) + "</span> · quedan " + s.cola.length + (S2.caja(e0) ? " · " + S2.CAJAS[S2.caja(e0)] : " · nueva") + '</div><article class="tj-ficha' + (s.vuelta ? " vuelta" : "") + '" aria-live="polite"><p class="tj-meta">' + meta + '</p><h2 class="tj-frente">' + esc(t.frente) + "</h2>" +
          (s.vuelta ? '<div class="tj-dorso">' + dorso + "</div>" : "") + "</article>" +
          (s.vuelta ? '<p class="tj-desliza mano" aria-hidden="true">o desliza la tarjeta: → bien · ← otra vez</p>' : "") +
          (s.vuelta ? '<div class="tj-botones" role="group" aria-label="¿Cómo te ha ido?"><button type="button" class="boton secundario tj-otra" data-tj-r="otra"><span>Otra vez</span><small>hoy · <kbd>1</kbd></small></button><button type="button" class="boton" data-tj-r="bien"><span>Bien</span><small>' + dias(pv.bien) + ' · <kbd>2</kbd></small></button><button type="button" class="boton secundario" data-tj-r="facil"><span>Fácil</span><small>' + dias(pv.facil) + " · <kbd>3</kbd></small></button></div>"
            : '<div class="tj-botones"><button type="button" class="boton" data-tj="voltear">Ver la respuesta <kbd>Espacio</kbd></button></div>');
      }
      return { sec: "asignaturas", titulo: "Tarjetas · " + u.codigo, subject: u.s, html: rt + cab + '<div class="tj-rejilla"><div class="tj-sesion">' + cuerpo + '</div><aside class="tj-lado">' + cajas + "</aside></div>", animar: efectosTarjetas };
    }
    function dias(n) { return n === 1 ? "mañana" : "en " + n + " días"; }
    function fechaCorta(k) { var p = k.split("-"); return +p[2] + " de " + ctx.MESES[+p[1] - 1]; }
    function clicTarjetas(t, u, J) {
      var s = sesion(u, J);
      if (t.getAttribute("data-tj") === "voltear") { s.vuelta = true; EF = { t: "voltear" }; return ctx.repintar('[data-tj-r="bien"]'); }
      if (t.getAttribute("data-tj") === "mas") {
        var es = estadosCon(u, J), hoy = hoyClave();
        var futuras = J.tarjetas.filter(function (x) { return es[x.id] && es[x.id].due > hoy; }).sort(function (a, b) { return es[a.id].due < es[b.id].due ? -1 : 1; });
        var nuevas = J.tarjetas.filter(function (x) { return !es[x.id]; });
        s.cola = futuras.concat(nuevas).slice(0, 10).map(function (x) { return x.id; }); s.vuelta = false;
        if (!s.cola.length) ctx.aviso("No queda ninguna por adelantar.");
        return ctx.repintar('[data-tj="voltear"]');
      }
      var resp = t.getAttribute("data-tj-r"); if (!resp || !s.cola.length) return;
      var id = s.cola.shift(), todos = estadosT(u), previo = estadosCon(u, J)[id] || null;
      todos[id] = S2.puntuar(previo, resp, hoyClave());
      if (!ctx.guardar(rutaU(u, "tarjetas"), todos)) ctx.aviso("No se pudo guardar.", "error");
      if (resp === "otra") s.cola.splice(Math.min(3, s.cola.length), 0, id); else s.hechas++;
      s.vuelta = false; EF = { t: "puntuada", r: resp }; refrescar(u);
      ctx.repintar('[data-tj="voltear"], [data-tj="mas"]');
    }

    /* ================= clics y teclado ================= */
    document.addEventListener("click", function (ev) {
      var R = rutaAct(), t = ev.target.closest ? ev.target.closest("button, a[data-qz]") : null;
      if (!R || !t || !document.getElementById("vista").contains(t)) return;
      var J = BANCOS[R.u];
      if (t.getAttribute("data-qz") === "recargar") { CARGA[R.u] = "error"; banco(R.u); return ctx.pintar(true); }
      if (!J) return;
      if (t.getAttribute("data-qz") === "salir") { ev.preventDefault(); return salir(R.u); }
      if (R.sec === "practica") clicPractica(t, R.u, J); else clicTarjetas(t, R.u, J);
    });
    document.addEventListener("change", function (ev) {
      var R = rutaAct(); if (R && R.sec === "practica" && ev.target.hasAttribute && ev.target.hasAttribute("data-qz-barajar")) est(R.u).barajar = ev.target.checked;
    });
    document.addEventListener("keydown", function (ev) {
      var R = rutaAct(); if (!R || ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey || $(".qz-capa")) return;
      var J = BANCOS[R.u]; if (!J) return;
      var tag = (ev.target.tagName || "").toUpperCase(), escribiendo = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (R.sec === "practica") {
        var e = est(R.u); if (e.fase !== "hacer") return;
        var it = actual(R.u); if (!it) return;
        if (ev.key === "Escape") { ev.preventDefault(); return salir(R.u); }
        if (!escribiendo && /^[1-9]$/.test(ev.key)) { var b = $('[data-qz-op="' + (+ev.key - 1) + '"]'); if (b) { ev.preventDefault(); b.click(); } return; }
        if (ev.key === "Enter" && tag !== "TEXTAREA" && tag !== "BUTTON" && tag !== "A" && tag !== "SUMMARY") {
          ev.preventDefault(); guardarYa();
          var ver = $('[data-qz="ver"]'), q = J.porId[it.orden[pos(it)]];
          if (ver && tag === "INPUT" && Q.contestada(q, actual(R.u).resp[q.id])) return ver.click();
          var sg = $('.qz-nav [data-qz="sig"]') || $('.qz-nav [data-qz="corregir"]'); if (sg) sg.click();
        }
      } else {
        var s = SES[R.u]; if (!s || !s.cola.length) return;
        if (ev.key === "Escape") { ev.preventDefault(); return confirmar("¿Salir de las tarjetas?", "Lo que has puntuado ya está guardado.", "Salir", "Seguir aquí").then(function (ok) { if (ok) location.hash = "#/unidad/" + R.u; }); }
        if (escribiendo) return;
        if (!s.vuelta && (ev.key === " " || ev.key === "Enter") && tag !== "BUTTON" && tag !== "A") { ev.preventDefault(); var v = $('[data-tj="voltear"]'); if (v) v.click(); return; }
        if (s.vuelta && /^[123]$/.test(ev.key)) { ev.preventDefault(); var g = $('[data-tj-r="' + ["otra", "bien", "facil"][+ev.key - 1] + '"]'); if (g) g.click(); }
      }
    });

    /* ================= añadidos para Errores, Unidad y Hoy ================= */
    function pErrores() {
      var bloques = [], total = 0;
      D.UNIDADES.forEach(function (u) {
        var m = mazo(u.id), ids = Object.keys(m); if (!ids.length) return;
        total += ids.length;
        ids.sort(function (a, b) { return (m[b].veces || 1) - (m[a].veces || 1) || (m[a].fecha < m[b].fecha ? 1 : -1); });
        bloques.push('<section class="err-unidad" data-subject="' + u.s + '" aria-labelledby="err-' + esc(u.id) + '"><div class="sec-cab"><h2 id="err-' + esc(u.id) + '"><span class="mano err-cod">' + esc(u.codigo) + "</span> " + esc(u.titulo) + '</h2><span class="insignia">' + ids.length + (ids.length === 1 ? " fallo" : " fallos") + '</span></div><ol class="err-lista">' +
          ids.slice(0, 6).map(function (id) { var x = m[id]; return '<li><p class="err-q">' + esc(x.texto || "Pregunta") + '</p><p class="err-r"><span class="err-tuya"><span class="sr">Tu respuesta: </span>' + esc(x.dada) + '</span><span class="err-buena"><span class="sr">La buena: </span>' + esc(x.correcta) + '</span></p><p class="err-meta">' + (x.veces > 1 ? "fallada " + x.veces + " veces · " : "") + (x.racha ? "acertada 1 vez: 1 más y sale" : "sale tras 2 aciertos seguidos") + "</p></li>"; }).join("") +
          (ids.length > 6 ? '<li class="err-mas">… y ' + (ids.length - 6) + " más</li>" : "") + '</ol><a class="boton" href="#/practica/' + esc(u.id) + '/errores">Repasar mis fallos · ' + ids.length + ico("siguiente") + "</a></section>");
      });
      if (!bloques.length) return '<div class="estado" data-subject="fisio">' + ctx.pegatina("microscopio", "fisio", "") + '<div><h2 class="estado-tit">Tu mazo está vacío</h2><p>Cuando corrijas un simulacro en Corte, cada pregunta que falles se apuntará aquí con tu respuesta y la buena. Sale del mazo cuando la aciertes 2 veces seguidas.</p><div class="acciones"><a class="boton secundario" href="#/asignaturas">Ir a practicar</a></div></div></div>';
      return '<p class="mano err-total">' + total + (total === 1 ? " pregunta por dominar" : " preguntas por dominar") + "</p>" + bloques.join("");
    }
    function unidadNotas(u) {
      return '<a class="nota-boton lila" href="#/practica/' + esc(u.id) + '"><b>Practicar aquí</b><span class="mano">barajado, con nota</span><span class="ext">Práctica o examen' + ico("siguiente") + "</span></a>" +
        '<a class="nota-boton" data-subject="' + u.s + '" href="#/tarjetas/' + esc(u.id) + '"><b>Tarjetas</b><span class="mano">' + (function () { var n = S2.pendientes(estadosT(u.id), hoyClave()); return n ? n + " para hoy" : "repaso espaciado"; })() + '</span><span class="ext">Repasar' + ico("siguiente") + "</span></a>";
    }
    function unidadResumen(u) {
      var h = historial(u.id), ul = Q.ultimo(h), mj = Q.mejor(h), nm = nMazo(u.id);
      if (!ul && !nm) return "";
      return '<div class="qz-resumen" role="group" aria-label="Tus intentos">' + (ul ? '<div><span>Último intento</span><b class="num">' + coma(ul.nota) + "</b><small>" + esc(MODOS[ul.modo] || "") + "</small></div>" : "") + (mj ? '<div><span>Mejor nota</span><b class="num">' + coma(mj.nota) + "</b><small>" + h.length + (h.length === 1 ? " intento" : " intentos") + "</small></div>" : "") +
        (nm ? '<div><span>En el mazo</span><b class="num">' + nm + '</b><small><a href="#/errores">ver errores</a></small></div>' : "") + "</div>";
    }
    function hoyTarjetas() {
      var hoy = hoyClave(), filas = [], total = 0;
      D.UNIDADES.forEach(function (u) { var n = S2.pendientes(estadosT(u.id), hoy); if (n) { total += n; filas.push('<li data-subject="' + u.s + '"><a href="#/tarjetas/' + esc(u.id) + '">' + esc(u.codigo + " · " + u.titulo) + ' <b class="num">' + n + "</b></a></li>"); } });
      if (!total) return "";
      return '<section aria-labelledby="hTj"><div class="sec-cab"><h2 id="hTj">Tarjetas para hoy: <span class="num">' + total + '</span></h2><span class="mano">diez minutos</span></div><ul class="enlaces-unidad tj-hoy">' + filas.join("") + "</ul></section>";
    }

    return { practica: pPractica, tarjetas: pTarjetas, errores: pErrores, unidadNotas: unidadNotas, unidadResumen: unidadResumen, hoyTarjetas: hoyTarjetas, rico: rico };
  };
})();
