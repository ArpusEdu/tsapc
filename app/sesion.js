/* Corte · sesión de estudio (Fase 7, nueva metodología): #/sesion/<id>
   Cinco momentos en dos ratos de unos 10 min: rato A = 1 El misterio · 2 Descubre; rato B = 3 Lo de otros días · 4 Sin mirar · 5 Resuelve.
   El número de «paso» guardado no cambia de significado (0 misterio, 1 descubre, 2 sin mirar, 3 resuelve, 4 otros días, 5 hecha):
   solo cambia el orden en que se recorren, así las sesiones a medias de antes siguen donde estaban.
   Contenido en app/sesiones/<id>.json: «profe» va tal cual del repaso; «corte» está escrito para la sesión y se marca.
   Guardado en tsapc:v2 › personal.sesiones.<id> (por dónde vas, tu apuesta, lo que escribiste)
   y personal.conceptos.<id> (repaso espaciado de cada concepto, el mismo SM-2 de las tarjetas).
   Lo de otros días usa tus tarjetas de siempre (unidades.<u>.tarjetas), con su mismo historial.
   Navegador: window.CorteSesion(ctx). Node: module.exports.L (lógica pura, para las pruebas). */
(function (root, f) {
  var api = f();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CorteSesion = api.crear;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  /* en el orden en que se hacen; VISTA traduce el «paso» guardado a su sitio en esta lista */
  var PASOS = [["misterio", "El misterio"], ["descubre", "Descubre"], ["otros", "Lo de otros días"], ["sinmirar", "Sin mirar"], ["resuelve", "Resuelve"]];
  var VISTA = { 0: 0, 1: 1, 4: 2, 2: 3, 3: 4, 5: 5 };
  var TOPE_REPASO = 8;   /* lo que vuelve en un día; el resto, los días siguientes (los más atrasados primero) */

  /* ================= lógica pura ================= */
  /* lo que dijiste sin mirar → nota del repaso espaciado: todo = «fácil», la mitad o más = «bien», menos = «otra vez».
     o.intento === false (ni palabras escritas ni «Lo he dicho en voz alta»): como mucho «otra».
     o.primera (la primera vez que se puntúa ese concepto): como mucho «bien». */
  function nota(marcas, total, o) {
    var n = 0; (marcas || []).forEach(function (m) { if (m) n++; });
    o = o || {};
    if (o.intento === false) return "otra";
    var r = !total ? "bien" : n >= total ? "facil" : n * 2 >= total ? "bien" : "otra";
    return o.primera && r === "facil" ? "bien" : r;
  }
  /* ¿hubo intento de recordar? Unas palabras escritas (dos o más) o haberlo dicho en voz alta */
  function hayIntento(txt, voz) { return !!voz || (String(txt || "").match(/[0-9A-Za-zÀ-ÖØ-öø-ÿ]{2,}/g) || []).length >= 2; }
  /* el resultado, en tres: todo / la mitad o más / menos de la mitad */
  function resultado(n, total) { return !total || n >= total ? "todo" : n * 2 >= total ? "mitad" : "poco"; }
  /* el orden del recorrido: misterio → descubre → (pausa) → otros días → sin mirar → resuelve → hecha.
     Decide por lo que ya está hecho, así una sesión empezada con el orden antiguo sigue sin perder nada. ids: los conceptos. */
  function otrosHecho(e) { return !!(e.cola && e.k >= e.cola.length); }
  function sinMirarHecho(e, ids) { return (ids || []).every(function (id) { return e.recuerdo[id] && e.recuerdo[id].guardado; }); }
  function siguientePaso(e, ids) {
    if (e.paso === 0) return 1;
    if (e.paso === 1 || !otrosHecho(e)) return 4;
    if (!sinMirarHecho(e, ids)) return 2;
    if (!e.acierto) return 3;
    return 5;
  }
  /* ¿toca la pausa entre ratos? Rato A hecho hoy y aún no se ha empezado el B */
  function enPausa(e, hoy) { return e.paso === 4 && !!e.ratoA && !e.ratoB && e.ratoA === hoy && !e.hecha; }
  /* estado inicial de una sesión, o el guardado limpio */
  function estado(v) {
    var e = v && typeof v === "object" && !Array.isArray(v) ? v : {};
    return {
      paso: Math.max(0, Math.min(5, +e.paso || 0)), i: Math.max(0, +e.i || 0),
      apuesta: typeof e.apuesta === "string" ? e.apuesta.slice(0, 2000) : "",
      vistos: e.vistos && typeof e.vistos === "object" ? e.vistos : {},
      recuerdo: e.recuerdo && typeof e.recuerdo === "object" ? e.recuerdo : {},
      acierto: e.acierto === "si" || e.acierto === "casi" || e.acierto === "no" ? e.acierto : null,
      cola: Array.isArray(e.cola) ? e.cola.filter(function (x) { return x && typeof x.u === "string" && typeof x.id === "string"; }).slice(0, 6) : null,
      k: Math.max(0, +e.k || 0), vuelta: !!e.vuelta,
      inicio: typeof e.inicio === "string" ? e.inicio : null, hecha: typeof e.hecha === "string" ? e.hecha : null,
      ratoA: typeof e.ratoA === "string" ? e.ratoA : null, ratoB: typeof e.ratoB === "string" ? e.ratoB : null
    };
  }
  /* la siguiente sesión del recorrido: la que está a medias; si no, la primera sin hacer; si no, ninguna */
  function siguienteSesion(lista, estados) {
    var e = function (x) { return estado(estados && estados[x.id]); };
    return lista.filter(function (x) { var s = e(x); return s.inicio && !s.hecha && s.paso > 0; })[0] || lista.filter(function (x) { return !e(x).hecha; })[0] || null;
  }
  /* guiada por el examen más cercano: primero las sesiones de esa unidad; si no quedan, las de su asignatura; si no, el recorrido */
  function siguienteParaExamen(lista, estados, ex, asigDe) {
    if (ex) {
      /* si el examen dice qué sesiones entran (por diapositivas), solo esas */
      var deU = Array.isArray(ex.sesiones) && ex.sesiones.length ? lista.filter(function (x) { return ex.sesiones.indexOf(x.id) >= 0; }) : ex.unidad ? lista.filter(function (x) { return x.unidad === ex.unidad; }) : [];
      var r = deU.length ? siguienteSesion(deU, estados) : null;
      if (r) return { s: r, de: deU };
      var deA = ex.s ? lista.filter(function (x) { return asigDe(x.unidad) === ex.s; }) : [];
      r = deA.length ? siguienteSesion(deA, estados) : null;
      if (r) return { s: r, de: deA };
    }
    return { s: siguienteSesion(lista, estados), de: null };
  }
  /* los conceptos que vuelven hoy: ya tocan y no se estudiaron hoy mismo (lo de hoy vuelve, como pronto, mañana).
     Los más atrasados primero; con tope, solo los primeros (el resto vuelve los días siguientes). */
  function conceptosHoy(estados, hoy, tope) {
    var out = [];
    for (var k in estados) if (Object.prototype.hasOwnProperty.call(estados, k)) {
      var e = estados[k]; if (e && e.due && e.due <= hoy && (!e.ult || e.ult < hoy)) out.push({ id: k, due: e.due });
    }
    out = out.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; }).map(function (x) { return x.id; });
    return tope > 0 ? out.slice(0, tope) : out;
  }
  /* cuándo vuelve, dicho para una persona */
  function vuelve(e, hoy, S2) {
    if (!e || !e.due) return "";
    var d = e.due <= hoy ? S2.sumarDias(hoy, 1) : e.due;
    var p = hoy.split("-"), q = d.split("-"), dias = Math.round((new Date(+q[0], +q[1] - 1, +q[2]) - new Date(+p[0], +p[1] - 1, +p[2])) / 864e5);
    return dias <= 1 ? "mañana" : "en " + dias + " días";
  }
  /* las tarjetas de otros días: primero las que ya tocan (vencidas, las más atrasadas antes); después, solo tarjetas ya vistas
     de los bloques pedidos (las que antes vuelven), mezcladas y sin repetir unidad seguida si se puede.
     Nunca tarjetas sin estudiar: lo de otros días es recordar, no aprender algo nuevo de golpe. */
  function elegirOtros(fuentes, hoy, S2, n, soloVencidas) {
    var vencidas = [], vistas = [];
    fuentes.forEach(function (f) {
      (f.tarjetas || []).forEach(function (t) {
        if (f.bloques && f.bloques.length && f.bloques.indexOf(t.bloqueNum) < 0) return;
        var e = f.estados && f.estados[t.id];
        if (!e || !e.due) return;
        if (S2.vencida(e, hoy)) vencidas.push({ u: f.unidad, id: t.id, due: e.due });
        else if (e.ult !== hoy) vistas.push({ u: f.unidad, id: t.id, due: e.due });
      });
    });
    var porFecha = function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; };
    vencidas.sort(porFecha); vistas.sort(porFecha);
    var porU = {}; vistas.forEach(function (x) { (porU[x.u] = porU[x.u] || []).push(x); });
    var us = Object.keys(porU), mezcla = [], quedan = true;
    for (var r = 0; quedan; r++) { quedan = false; us.forEach(function (u) { if (porU[u][r]) { mezcla.push(porU[u][r]); quedan = true; } }); }
    var lim = n === 0 ? 0 : n || 4;
    return vencidas.concat(soloVencidas ? [] : mezcla).map(function (x) { return { u: x.u, id: x.id }; }).slice(0, lim);
  }

  /* ================= la pantalla ================= */
  function crear(ctx) {
    var D = ctx.D, A = ctx.A, esc = ctx.esc, ico = ctx.ico, S2 = window.CorteSM2;
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var hoy = function () { return S2.dia(ctx.ahora()); };
    var DATOS = {}, CARGA = {}, BANCOS = {}, EF = null;

    function cargar(url, caja, clave) {
      if (caja[clave]) return caja[clave];
      if (CARGA[url] !== "cargando" && CARGA[url] !== "ok") {
        CARGA[url] = "cargando";
        fetch(url, { credentials: "same-origin" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function (j) { caja[clave] = j; CARGA[url] = "ok"; }).catch(function () { CARGA[url] = "error"; })
          .then(function () { if (/^#\/(sesion|hoy|unidad|examen)/.test(location.hash) || !location.hash) ctx.pintar(true); });
      }
      return null;
    }
    var sesionDe = function (id) { return /^[a-z0-9-]+$/.test(id || "") ? cargar("sesiones/" + id + ".json", DATOS, id) : null; };
    var bancoDe = function (u) { return /^[a-z0-9-]+$/.test(u || "") ? cargar("preguntas/" + u + ".json", BANCOS, u) : null; };
    var falloDe = function (url) { return CARGA[url] === "error"; };

    var rutaS = function (id) { return ["personal", "sesiones", id]; };
    function leerS(id) { return estado(ctx.leer(rutaS(id), null)); }
    function guardarS(id, e) { if (!ctx.guardar(rutaS(id), e)) ctx.aviso("No se pudo guardar. Revisa el espacio del navegador.", "error"); }
    function conceptos() { var c = ctx.leer(["personal", "conceptos"], {}); return c && typeof c === "object" ? c : {}; }
    /* con un examen cerca, lo de su unidad no vence después de la víspera (app.js dice cuál es) */
    function topeDe(u) { try { return ctx.vispera ? ctx.vispera(u) : null; } catch (_) { return null; } }
    function puntuarConcepto(cid, u, resp) {
      var todos = conceptos(); todos[cid] = S2.limitar(S2.puntuar(todos[cid] || null, resp, hoy()), topeDe(u), hoy());
      ctx.guardar(["personal", "conceptos"], todos); return todos[cid];
    }
    function puntuarTarjeta(u, tid, resp) {
      var est = ctx.leer(["unidades", u, "tarjetas"], {}) || {};
      est[tid] = S2.limitar(S2.puntuar(est[tid] || null, resp, hoy()), topeDe(u), hoy());
      ctx.guardar(["unidades", u, "tarjetas"], est);
    }

    /* la siguiente sesión que conviene (guiada por el examen cercano), sin contar la actual */
    function siguienteGuiada(sinId) {
      try {
        var li = indice(); if (!li) return null;
        var exa = ctx.examen ? ctx.examen() : null;
        return siguienteParaExamen(li.filter(function (x) { return x.id !== sinId; }), estadosTodas(), exa && exa.ex, function (u) { var U = D.unidad(u); return U ? U.s : ""; }).s;
      } catch (_) { return null; }
    }
    /* estudiar también hace crecer la planta: una hoja por cada día con algo hecho */
    function crecePlanta() {
      var L2 = window.CorteLogica; if (!L2) return;
      var a = ctx.leer(["personal", "planta"], []), d = L2.planta(a, L2.clave(ctx.ahora()), true);
      if (d.length !== (Array.isArray(a) ? a.length : 0)) ctx.guardar(["personal", "planta"], d);
    }
    /* modo foco: sin la barra de abajo mientras se estudia */
    function foco() { document.documentElement.classList.add("ss-foco"); }
    window.addEventListener("hashchange", function () { if (!/^#\/sesion\//.test(location.hash)) document.documentElement.classList.remove("ss-foco"); });

    /* ---------- piezas ---------- */
    function sello(texto) { return '<span class="ss-sello">' + ico("info") + esc(texto) + "</span>"; }
    var DE_CORTE = sello("de Enfoque"), DE_PROFE = '<span class="ss-sello profe">' + ico("check") + "de tu profe</span>";
    function pasos(n) {
      return '<ol class="ss-pasos" aria-label="Momentos de la sesión">' + PASOS.map(function (p, k) {
        var cl = (k < n ? "hecho" : k === n ? "ahora" : "") + (k === 2 ? " rato-b" : "");
        return '<li class="' + cl + '"' + (k === n ? ' aria-current="step"' : "") + '><span class="ss-num num">' + (k < n ? ico("check") : k + 1) + '</span><span class="ss-nom">' + (k === 0 || k === 2 ? '<span class="sr">' + (k === 0 ? "Rato A: " : "Rato B: ") + "</span>" : "") + p[1] + "</span></li>";
      }).join("") + "</ol>";
    }
    function boton(txt, attr, sec, icono) { return '<button type="button" class="boton' + (sec ? " secundario" : "") + '" ' + attr + ">" + (icono ? ico(icono) : "") + txt + "</button>"; }
    function rico(s) { return ctx.rico ? ctx.rico(s, "html", "./") : esc(s); }

    /* ---------- 1 · el misterio ---------- */
    function vMisterio(S, e) {
      var m = S.misterio;
      return '<section class="ss-caso recuadro" aria-labelledby="ssCasoT"><span class="washi" aria-hidden="true"></span>' + DE_CORTE +
        '<p class="ss-k mano">Un caso real · todavía no sabes resolverlo, y está bien</p><h2 id="ssCasoT">' + esc(m.titulo) + "</h2><p class=\"ss-caso-t\">" + esc(m.caso) + '</p><p class="ss-preg"><b>' + esc(m.pregunta) + "</b></p>" +
        '<label class="ss-lbl" for="ssApuesta">Tu apuesta <span class="mano">(una frase basta; no se corrige)</span></label><textarea id="ssApuesta" rows="3" data-ss-txt="apuesta" placeholder="Yo creo que…">' + esc(e.apuesta) + "</textarea>" +
        '<div class="acciones">' + boton("Apostar y empezar", 'data-ss="apostar"', false, "siguiente") + boton("No tengo ni idea: empezar", 'data-ss="apostar"', true) + "</div>" +
        '<p class="ss-por mano">¿Por qué empezar así? Intentar responder antes de estudiar, aunque falles, hace que lo que aprendas después se quede mucho mejor.</p></section>';
    }
    /* ---------- 2 · descubre ---------- */
    function vDescubre(S, e) {
      var c = S.conceptos[e.i], v = e.vistos[c.id] || {}, n = S.conceptos.length;
      var h = '<p class="ss-cuenta num">Concepto ' + (e.i + 1) + " de " + n + " · diapositiva " + esc(c.diapositivas) + "</p>" +
        '<article class="ss-concepto" aria-labelledby="ssC"><h2 id="ssC">' + esc(c.titulo) + "</h2>" +
        '<div class="ss-gancho">' + DE_CORTE + '<p class="mano">' + esc(c.gancho) + "</p>" +
        (v.profe ? (v.gan ? '<p class="ss-tuya"><span>Tu idea</span> ' + esc(v.gan) + "</p>" : "")
          : '<label class="ss-lbl" for="ssGan">Tu idea <span class="mano">(una palabra basta; no se corrige)</span></label><input id="ssGan" type="text" maxlength="300" autocomplete="off" data-ss-txt="gan:' + esc(c.id) + '" value="' + esc(v.gan || "") + '" placeholder="Yo diría que…">') + "</div>";
      if (!v.profe) return h + '<div class="acciones">' + boton("Ver lo que dice la profe", 'data-ss="profe"', false, "siguiente") + "</div></article>";
      var p = c.profe, hayAp = !!(c.aplica && c.aplica.length);
      var respondidas = hayAp ? c.aplica.every(function (_, k) { return v.aplica && typeof v.aplica[k] === "number"; }) : true;
      var plegar = v.porque && hayAp;
      h += (plegar ? '<details class="ss-plegado"' + (respondidas ? " open" : "") + "><summary>Volver a mirar lo de la profe</summary>" : "") +
        '<section class="ss-profe" aria-label="Lo que dice la profe">' + DE_PROFE +
        (p.glosario ? '<div class="ss-glos rico">' + rico(p.glosario) + "</div>" : "") +
        (p.img ? '<figure class="ss-fig"><img src="' + esc(p.img) + '" alt="' + esc(p.imgAlt || "") + '" loading="lazy"><figcaption>' + esc(p.imgAlt || "") + "</figcaption></figure>" : "") +
        '<div class="ss-dice rico">' + rico(p.dice) + "</div>" +
        (p.entiende ? '<div class="ss-ent"><b>Entiéndelo:</b> ' + rico(p.entiende) + "</div>" : "") +
        (p.truco ? '<div class="ss-truco"><span class="mano">Truco:</span> ' + rico(p.truco) + "</div>" : "") + "</section>" + (plegar ? "</details>" : "");
      h += '<section class="ss-porque nota" aria-labelledby="ssPq">' + DE_CORTE + '<h3 id="ssPq">¿Por qué?</h3><p>' + esc(c.porque.pregunta) + "</p>" +
        (v.porque ? '<p class="ss-resp">' + esc(c.porque.respuesta) + "</p>" : '<div class="acciones">' + boton("Lo he pensado: ver una respuesta", 'data-ss="porque"', true) + "</div>") + "</section>";
      if (c.aplica && c.aplica.length) {
        h += '<section class="ss-aplica" aria-labelledby="ssAp">' + DE_CORTE + '<h3 id="ssAp">Úsalo</h3>' + (respondidas ? "" : '<p class="ss-mini">Sin mirar arriba. Si dudas, abre «Volver a mirar».</p>') + "<ol>" + c.aplica.map(function (a, k) {
          var r = v.aplica && typeof v.aplica[k] === "number" ? v.aplica[k] : null;
          return '<li><p>' + esc(a.caso) + '</p><div class="ss-ops" role="group" aria-label="Elige">' + a.opciones.map(function (o, j) {
            var cl = r === null ? "" : j === a.buena ? " buena" : j === r ? " mala" : "";
            return '<button type="button" class="ss-op' + cl + '" data-ss-ap="' + k + ":" + j + '"' + (r !== null ? ' aria-disabled="true"' : "") + ' aria-pressed="' + (r === j) + '">' + esc(o) + "</button>";
          }).join("") + "</div>" + (r !== null ? '<p class="ss-fb ' + (r === a.buena ? "bien" : "mal") + '" role="status">' + (r === a.buena ? "<b>Eso es.</b> " : "<b>No exactamente.</b> ") + esc(a.porque) + "</p>" : "") + "</li>";
        }).join("") + "</ol></section>";
      }
      var ult = e.i === n - 1;
      if (!v.porque || !respondidas) return h + '<p class="ss-falta mano">' + (!v.porque ? "Para seguir: piensa el «¿por qué?» y ábrelo." : "Para seguir: responde «Úsalo».") + "</p></article>";
      return h + '<div class="acciones ss-sig">' + (ult ? boton("Ahora, sin mirar", 'data-ss="sig"', false, "siguiente") : boton("Siguiente concepto", 'data-ss="sig"', false, "siguiente")) + "</div></article>";
    }
    /* ---------- 3 · sin mirar ---------- */
    /* antes de comparar: el intento (palabras o «en voz alta») y la calibración de un toque («¿cuántos puntos crees que tienes?») */
    function intentoHTML(r, tot, pre) {
      var voz = '<button type="button" class="boton secundario ss-voz" data-' + pre + '="voz" aria-pressed="' + !!r.voz + '">' + ico(r.voz ? "check" : "info") + "Lo he dicho en voz alta</button>";
      var cree = '<div class="ss-cree" role="group" aria-labelledby="' + pre + 'Cree"><p id="' + pre + 'Cree" class="ss-mini">¿Cuántos puntos crees que tienes? <span class="mano">(de ' + tot + ')</span></p><div class="segmentado">';
      for (var k = 0; k <= tot; k++) cree += '<button type="button" data-' + pre + '-cree="' + k + '" aria-pressed="' + (r.cree === k) + '">' + k + "</button>";
      return '<div class="ss-intento">' + voz + cree + "</div></div></div>";
    }
    /* después de puntuar: tres estilos (todo / la mitad o más / menos), la calibración y lo que faltó, con lo de la profe plegado */
    function resultadoHTML(c, r, marcas, cuando) {
      var n2 = marcas.filter(Boolean).length, tot = c.recuerda.puntos.length, res = resultado(n2, tot), sin = r.intento === false;
      var txt = sin ? "Sin intento (ni escrito ni en voz alta), así que vuelve mañana. La próxima vez, aunque sean dos palabras."
        : res === "todo" ? "Lo tienes." : res === "mitad" ? "Buena base: lo que faltó vuelve antes." : "Normal al principio: vuelve pronto para afianzarlo.";
      var cal = typeof r.cree === "number" ? '<p class="ss-cal">Creías ' + r.cree + " de " + tot + "; tenías " + n2 + "." + (r.cree === n2 ? " Te conoces bien." : r.cree > n2 ? " Sabías menos de lo que creías: es lo normal, por eso se comprueba." : " Sabías más de lo que creías.") + "</p>" : "";
      var falta = c.recuerda.puntos.filter(function (_, k) { return !marcas[k]; });
      return '<p class="ss-fb ' + (sin ? "poco" : res === "todo" ? "bien" : res === "mitad" ? "medio" : "poco") + '" role="status"><b>' + n2 + " de " + tot + ".</b> " + txt + (cuando ? " Te lo vuelvo a pedir " + cuando + ", en tu repaso." : "") + "</p>" + cal + faltaHTML(c, falta);
    }
    function faltaHTML(c, falta) {
      if (!falta.length) return "";
      return '<section class="ss-falta-pt" aria-label="Lo que faltó"><p class="ss-mini">Lo que faltó:</p><ul>' + falta.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" + profePlegada(c) + "</section>";
    }
    function profePlegada(c) { return c.profe && c.profe.dice ? '<details class="ss-plegado ss-ver-profe"><summary>Ver lo de la profe</summary><div class="ss-profe">' + DE_PROFE + '<div class="ss-dice rico">' + rico(c.profe.dice) + "</div></div></details>" : ""; }
    function vSinMirar(S, e) {
      var c = S.conceptos[e.i], r = e.recuerdo[c.id] || {}, n = S.conceptos.length, tot = c.recuerda.puntos.length;
      var h = '<p class="ss-cuenta num">' + (e.i + 1) + " de " + n + " · todo tapado</p>" +
        '<article class="ss-recuerda" aria-labelledby="ssR"><h2 id="ssR">' + esc(c.titulo) + '</h2><p class="ss-pide">' + esc(c.recuerda.pide) + "</p>" +
        '<label class="sr" for="ssTxt">Tu explicación</label><textarea id="ssTxt" rows="6" data-ss-txt="rec:' + esc(c.id) + '"' + (r.comparado ? " readonly" : "") + ' placeholder="Escríbelo como se lo contarías a alguien que no sabe nada. También vale decirlo en voz alta y escribir solo las palabras clave.">' + esc(r.txt || "") + "</textarea>";
      if (!r.comparado) return h + intentoHTML(r, tot, "ss") + '<div class="acciones">' + boton("Comparar con el original", 'data-ss="comparar"', false, "check") + '</div><p class="ss-por mano">Escribe unas palabras o dilo en voz alta: sin intento, vuelve mañana igual. Lo que cuesta un poco recordar es lo que más se queda.</p></article>';
      var marcas = Array.isArray(r.marcas) ? r.marcas : [];
      h += '<section class="ss-puntos" aria-labelledby="ssPt">' + DE_PROFE + '<h3 id="ssPt">¿Qué dijiste?</h3><p class="ss-mini">Marca lo que tenías, aunque fuera con otras palabras.</p><ul>' + c.recuerda.puntos.map(function (p, k) {
        return '<li><label class="ss-check"><input type="checkbox" data-ss-marca="' + k + '"' + (marcas[k] ? " checked" : "") + (r.guardado ? " disabled" : "") + "><span>" + esc(p) + "</span></label></li>";
      }).join("") + "</ul></section>";
      if (!r.guardado) return h + '<div class="acciones">' + boton("Listo, seguir", 'data-ss="puntuar"', false, "siguiente") + "</div></article>";
      h += resultadoHTML(c, r, marcas, vuelve(conceptos()[c.id], hoy(), S2));
      return h + '<div class="acciones">' + boton(e.i === n - 1 ? "Volver al misterio" : "Siguiente", 'data-ss="sig"', false, "siguiente") + "</div></article>";
    }
    /* ---------- 4 · resuelve ---------- */
    function vResuelve(S, e) {
      var m = S.misterio, ok = e.acierto;
      var con = []; S.conceptos.forEach(function (c) { (c.conecta || []).forEach(function (x) { con.push(x); }); });
      return '<section class="ss-caso recuadro" aria-labelledby="ssRes"><span class="washi" aria-hidden="true"></span>' + DE_CORTE + '<p class="ss-k mano">Vuelves al caso del principio</p><h2 id="ssRes">' + esc(m.titulo) + "</h2>" +
        '<p class="ss-preg"><b>' + esc(m.pregunta) + "</b></p>" +
        '<p class="ss-tuya"><span>Tu apuesta</span> ' + (e.apuesta ? esc(e.apuesta) : "<i>(no apostaste)</i>") + "</p>" +
        '<details class="ss-sol"' + (ok ? " open" : "") + '><summary>Antes de abrir: con lo que acabas de aprender, ¿cómo lo resolverías ahora? <b>Ver la solución</b></summary>' +
        (m.solucionProfe ? '<div class="ss-profe">' + DE_PROFE + '<div class="ss-dice rico">' + rico(m.solucionProfe) + "</div>" + (m.entiendeProfe ? '<div class="ss-ent"><b>Entiéndelo:</b> ' + rico(m.entiendeProfe) + "</div>" : "") + "</div>" : "<p>" + esc(m.solucion) + "</p>") +
        '<ul class="ss-claves">' + m.claves.map(function (k) { return "<li>" + esc(k) + "</li>"; }).join("") + "</ul>" +
        '<div class="ss-ac" role="group" aria-label="¿Tu apuesta iba bien encaminada?"><span>¿Tu apuesta iba bien encaminada?</span>' + [["si", "Sí"], ["casi", "Más o menos"], ["no", "No"]].map(function (x) { return '<button type="button" class="boton secundario" data-ss-ac="' + x[0] + '" aria-pressed="' + (ok === x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div></details>" +
        (ok ? '<p class="ss-fb bien" role="status">' + (ok === "no" ? "Fallar al principio es lo que hace que ahora se quede." : "Fíjate: antes no lo sabías y ahora sí.") + "</p>" : "") +
        (con.length ? '<section class="ss-conecta" aria-labelledby="ssCo"><h3 id="ssCo">Esto se conecta con…</h3><ul>' + con.map(function (x) { return '<li><a href="' + esc(x.ruta) + '">' + esc(x.texto) + "</a></li>"; }).join("") + "</ul></section>" : "") +
        (ok ? '<div class="acciones">' + boton(otrosHecho(e) ? "Terminar la sesión" : "Lo de otros días", 'data-ss="sig"', false, "siguiente") + "</div>" : "") + "</section>";
    }
    /* ---------- 5 · lo de otros días ---------- */
    function fuentes(S) {
      return (S.otrosDias || []).map(function (f) { var J = bancoDe(f.unidad); return J ? { unidad: f.unidad, bloques: f.bloques, tarjetas: J.tarjetas, estados: ctx.leer(["unidades", f.unidad, "tarjetas"], {}) || {} } : null; });
    }
    function vOtros(S, e, id) {
      var fs = fuentes(S);
      if (fs.some(function (f) { return !f; })) return ctx.cargando("Buscando lo de otros días");
      if (!e.cola) { e.cola = elegirOtros(fs, hoy(), S2, 4); e.k = 0; e.vuelta = false; guardarS(id, e); }
      if (!e.cola.length) return '<section class="ss-caso recuadro" aria-labelledby="ssOt"><span class="washi" aria-hidden="true"></span><h2 id="ssOt">Hoy no vuelve nada de otros días</h2><p>Todo lo que ya estudiaste está fresco. Pasa directamente a recordar sin mirar.</p><div class="acciones">' + boton("Ahora, sin mirar", 'data-ss="sig"', false, "siguiente") + "</div></section>";
      if (e.k >= e.cola.length) return '<section class="ss-caso recuadro" aria-labelledby="ssOt"><span class="washi" aria-hidden="true"></span><h2 id="ssOt">Lo de otros días, hecho</h2><div class="acciones">' + boton("Seguir", 'data-ss="sig"', false, "siguiente") + "</div></section>";
      var it = e.cola[e.k], J = BANCOS[it.u], t = J && J.tarjetas.filter(function (x) { return x.id === it.id; })[0];
      if (!t) { e.k++; guardarS(id, e); return vOtros(S, e, id); }
      var U = D.unidad(it.u), S1 = U ? A[U.s] : null;
      return '<p class="ss-cuenta num">' + (e.k + 1) + " de " + e.cola.length + " · antes de recordar sin mirar, un poco de otra cosa</p>" +
        '<article class="tj-ficha ss-ficha' + (e.vuelta ? " vuelta" : "") + '"' + (S1 ? ' data-subject="' + esc(U.s) + '"' : "") + ' aria-live="polite"><p class="tj-meta">' + (U ? esc(U.codigo + " · " + U.titulo) : "") + '</p><h2 class="tj-frente">' + esc(t.frente) + "</h2>" +
        (e.vuelta ? '<div class="tj-dorso rico">' + ctx.rico(t.dorso, t.formato, "../" + it.u + "/repaso/") + "</div>" : '<p class="ss-mini">Dilo en voz alta o en la cabeza antes de girarla.</p>') + "</article>" +
        (e.vuelta ? '<div class="tj-botones" role="group" aria-label="¿Cómo te ha ido?">' + boton("Otra vez", 'data-ss-tj="otra"', true) + boton("Bien", 'data-ss-tj="bien"') + boton("Fácil", 'data-ss-tj="facil"', true) + "</div>"
          : '<div class="tj-botones">' + boton("Ver la respuesta", 'data-ss="girar"') + "</div>");
    }
    /* ---------- entre los dos ratos ---------- */
    function vPausa(S, e) {
      var m = Math.max(1, Math.ceil((+S.minutos || 0) / 2));
      return '<section class="ss-fin ss-pausa recuadro" aria-labelledby="ssPa"><span class="washi" aria-hidden="true"></span>' +
        '<h2 id="ssPa">Rato A, hecho</h2><p>Mañana sigues donde lo dejes (o ahora mismo). Lo que queda es el rato B: lo de otros días, recordar sin mirar y resolver el misterio. Unos ' + m + "\u00a0min.</p>" +
        '<p class="mano">Dejar pasar un rato antes de recordarlo sin mirar cuesta un poco más, y por eso se queda mejor.</p>' +
        '<div class="acciones">' + boton("Seguir ahora con el rato B", 'data-ss="ratob"', false, "siguiente") + '<a class="boton secundario" href="#/hoy">Volver a Hoy</a></div></section>';
    }
    function vFin(S, e) {
      var sigS = siguienteGuiada(S.id);
      var cs = conceptos(), filas = S.conceptos.map(function (c) {
        var r = e.recuerdo[c.id] || {}, m = (r.marcas || []).filter(Boolean).length, st = cs[c.id];
        return "<li><b>" + esc(c.titulo) + '</b><span class="num">' + m + " / " + c.recuerda.puntos.length + "</span><span>" + (st && st.due ? "vuelve " + vuelve(st, hoy(), S2) : "") + "</span></li>";
      }).join("");
      var pri = null; S.conceptos.forEach(function (c) { var st = cs[c.id]; if (st && st.due && (!pri || st.due < pri.due)) pri = st; });
      var nC = S.conceptos.length;
      return '<section class="ss-fin recuadro" aria-labelledby="ssFin"><span class="washi" aria-hidden="true"></span>' + ctx.pegatina("matraz", "lab", "") +
        '<h2 id="ssFin">Sesión hecha</h2><p>' + (e.hecha === hoy() ? "Hoy te llevas " + nC + (nC === 1 ? " concepto" : " conceptos") + "." + (pri ? " El primero vuelve " + vuelve(pri, hoy(), S2) + "." : "") + " " : "") + "Esto es lo que te llevas y cuándo vuelve:</p>" +
        '<ul class="ss-resumen">' + filas + "</ul>" +
        '<p class="mano">No hace falta repasarlo antes: cuando toque, en Hoy aparecerá «Tu repaso de hoy» y te lo pediré otra vez sin mirar.</p>' +
        (sigS ? '<p class="ss-sigue">Lo siguiente: <b>' + esc(sigS.titulo) + "</b>. Mañana, o ahora si te quedan ganas.</p>" : "") +
        '<div class="acciones"><a class="boton" href="#/hoy">Volver a Hoy</a>' + (sigS ? '<a class="boton secundario" href="#/sesion/' + encodeURIComponent(sigS.id) + '">Empezar la siguiente</a>' : "") + '<button type="button" class="boton secundario" data-ss="reiniciar">Repetir la sesión desde el principio</button></div></section>';
    }
    /* ================= el repaso de los días siguientes: #/sesion/repaso =================
       Lo que vuelve hoy: los conceptos de tus sesiones que ya tocan (otra vez sin mirar) y tus tarjetas vencidas.
       Estado del día en personal.sesiones._repaso = {fecha, cola:[{t:"c",id}|{t:"t",u,id}], k, comparado, marcas, txt, vuelta}. */
    /* para el repaso solo hacen falta las sesiones que ya se han empezado */
    function todas() {
      var lista = indice(); if (!lista) return null;
      var est = estadosTodas(), l = lista.filter(function (x) { return est[x.id]; }).map(function (x) { return sesionDe(x.id); });
      return l.some(function (x) { return !x; }) ? null : l;
    }
    function indiceConceptos(ls) { var o = {}; ls.forEach(function (S) { S.conceptos.forEach(function (c) { o[c.id] = { c: c, S: S }; }); }); return o; }
    function leerR() {
      var r = ctx.leer(["personal", "sesiones", "_repaso"], null);
      return r && typeof r === "object" && r.fecha === hoy() && Array.isArray(r.cola) ? r : null;
    }
    function guardarR(r) { if (!ctx.guardar(["personal", "sesiones", "_repaso"], r)) ctx.aviso("No se pudo guardar. Revisa el espacio del navegador.", "error"); }
    function pendientesHoy() { return conceptosHoy(conceptos(), hoy()).length; }
    function pRepaso() {
      var cab = '<header class="cab ss-cab"><p class="ss-k mano">Lo que estudiaste vuelve justo antes de olvidarse</p>' + ctx.titulo('Tu repaso <em>de hoy</em>') + "</header>";
      var ls = todas();
      if (!ls) return { sec: "hoy", titulo: "Repaso de hoy", html: cab + ctx.cargando("Preparando el repaso") };
      var r = leerR();
      if (!r) {
        var idx = indiceConceptos(ls), cola = conceptosHoy(conceptos(), hoy()).filter(function (id) { return idx[id]; }).slice(0, TOPE_REPASO).map(function (id) { return { t: "c", id: id }; });
        var us = {}; ls.forEach(function (S) { us[S.unidad] = 1; (S.otrosDias || []).forEach(function (f) { us[f.unidad] = 1; }); });
        var fs = Object.keys(us).map(function (u) { var J = bancoDe(u); return J ? { unidad: u, bloques: [], tarjetas: J.tarjetas, estados: ctx.leer(["unidades", u, "tarjetas"], {}) || {} } : null; });
        if (fs.some(function (f) { return !f; })) return { sec: "hoy", titulo: "Repaso de hoy", html: cab + ctx.cargando("Buscando lo que vuelve hoy") };
        elegirOtros(fs, hoy(), S2, TOPE_REPASO - cola.length, true).forEach(function (x) { cola.push({ t: "t", u: x.u, id: x.id }); });
        r = { fecha: hoy(), cola: cola, k: 0, total: conceptosHoy(conceptos(), hoy()).filter(function (id) { return idx[id]; }).length }; guardarR(r);
      }
      var html;
      if (!r.cola.length) html = '<div class="estado">' + ctx.pegatina("gafas", "lab", "quieta") + '<div><h2 class="estado-tit">Hoy no vuelve nada</h2><p>Todo lo que has estudiado está fresco. Puedes hacer una sesión nueva o descansar: también cuenta.</p><div class="acciones">' + (function () { var s = siguienteGuiada(""); return s ? '<a class="boton" href="#/sesion/' + encodeURIComponent(s.id) + '">Hacer «' + esc(s.titulo) + '»</a><a class="boton secundario" href="#/hoy">Volver a Hoy</a>' : '<a class="boton" href="#/hoy">Volver a Hoy</a>'; })() + "</div></div></div>";
      else if (r.k >= r.cola.length) html = '<section class="ss-fin recuadro"><span class="washi" aria-hidden="true"></span>' + ctx.pegatina("matraz", "lab", "") + '<h2>Repaso hecho</h2><p>' + r.cola.length + (r.cola.length === 1 ? " cosa repasada" : " cosas repasadas") + ". Lo que te costó vuelve antes; lo que dominas, cada vez más tarde.</p><div class=\"acciones\"><a class=\"boton\" href=\"#/hoy\">Volver a Hoy</a></div></section>";
      else {
        var it = r.cola[r.k], cuenta = '<p class="ss-cuenta num">' + (r.k + 1) + " de " + r.cola.length + "</p>";
        if (it.t === "c") {
          var x = indiceConceptos(ls)[it.id], c = x.c, U = D.unidad(x.S.unidad), marcas = Array.isArray(r.marcas) ? r.marcas : [];
          html = cuenta + '<article class="ss-recuerda" data-subject="' + esc(U.s) + '" aria-labelledby="rpT"><p class="ss-k mano">' + esc(U.codigo + " · " + x.S.titulo) + '</p><h2 id="rpT">' + esc(c.titulo) + '</h2><p class="ss-pide">' + esc(c.recuerda.pide) + "</p>" +
            '<label class="sr" for="ssTxt">Tu explicación</label><textarea id="ssTxt" rows="5" data-rp-txt' + (r.comparado ? " readonly" : "") + ' placeholder="Sin mirar: lo que recuerdes, con tus palabras.">' + esc(r.txt || "") + "</textarea>";
          if (!r.comparado) html += intentoHTML(r, c.recuerda.puntos.length, "rp") + '<div class="acciones">' + boton("Comparar con el original", 'data-rp="comparar"', false, "check") + "</div></article>";
          else html += '<section class="ss-puntos">' + DE_PROFE + '<h3>¿Qué dijiste?</h3><p class="ss-mini">Marca lo que tenías, aunque fuera con otras palabras.</p><ul>' + c.recuerda.puntos.map(function (p, k) { return '<li><label class="ss-check"><input type="checkbox" data-rp-marca="' + k + '"' + (marcas[k] ? " checked" : "") + "><span>" + esc(p) + "</span></label></li>"; }).join("") + "</ul>" + profePlegada(c) + '</section><div class="acciones">' + boton("Listo, seguir", 'data-rp="puntuar"', false, "siguiente") + "</div></article>";
        } else {
          var J = BANCOS[it.u], t = J && J.tarjetas.filter(function (y) { return y.id === it.id; })[0], U2 = D.unidad(it.u);
          if (!t) { r.k++; guardarR(r); return pRepaso(); }
          html = cuenta + '<article class="tj-ficha ss-ficha' + (r.vuelta ? " vuelta" : "") + '" data-subject="' + esc(U2.s) + '" aria-live="polite"><p class="tj-meta">' + esc(U2.codigo + " · tarjeta") + '</p><h2 class="tj-frente">' + esc(t.frente) + "</h2>" +
            (r.vuelta ? '<div class="tj-dorso rico">' + ctx.rico(t.dorso, t.formato, "../" + it.u + "/repaso/") + "</div>" : '<p class="ss-mini">Dilo antes de girarla.</p>') + "</article>" +
            (r.vuelta ? '<div class="tj-botones" role="group" aria-label="¿Cómo te ha ido?">' + boton("Otra vez", 'data-rp-tj="otra"', true) + boton("Bien", 'data-rp-tj="bien"') + boton("Fácil", 'data-rp-tj="facil"', true) + "</div>" : '<div class="tj-botones">' + boton("Ver la respuesta", 'data-rp="girar"') + "</div>");
        }
      }
      return { sec: "hoy", titulo: "Repaso de hoy", html: cab + '<div class="ss-cuerpo" id="ssCuerpo">' + html + "</div>", montar: foco, animar: function (M) { var f = EF; EF = null; var c2 = $("#ssCuerpo"); if (f && c2) M.animar(c2, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: M.CURVA.salida }, "ss"); } };
    }
    function clicRepaso(t) {
      var r = leerR(); if (!r || r.k >= r.cola.length) return;
      var it = r.cola[r.k], a = t.getAttribute("data-rp");
      var tx0 = $("#ssTxt");
      if (a === "voz") { if (tx0) r.txt = tx0.value.slice(0, 4000); r.voz = !r.voz; guardarR(r); return ctx.repintar('[data-rp="voz"]'); }
      if (t.hasAttribute("data-rp-cree")) { if (tx0) r.txt = tx0.value.slice(0, 4000); r.cree = +t.getAttribute("data-rp-cree"); guardarR(r); return ctx.repintar('[data-rp-cree="' + r.cree + '"]'); }
      if (a === "comparar") { r.txt = tx0 ? tx0.value.slice(0, 4000) : ""; r.intento = hayIntento(r.txt, r.voz); r.comparado = true; r.marcas = []; EF = "x"; guardarR(r); return ctx.repintar("[data-rp-marca]"); }
      if (a === "puntuar") {
        var idx = indiceConceptos(todas() || []), x = idx[it.id]; if (!x) return;
        var m = x.c.recuerda.puntos.map(function (_, k) { var el = document.querySelector('[data-rp-marca="' + k + '"]'); return !!(el && el.checked); });
        puntuarConcepto(it.id, x.S.unidad, nota(m, m.length, { intento: r.intento })); crecePlanta();
        ctx.refrescar && ctx.refrescar(x.S.unidad);
        var nM = m.filter(Boolean).length;
        if (typeof r.cree === "number") ctx.aviso("Creías " + r.cree + " de " + m.length + "; tenías " + nM + ".");
        else if (r.intento === false) ctx.aviso("Sin intento: vuelve mañana.");
        r.k++; r.comparado = false; r.marcas = []; r.txt = ""; r.voz = false; r.cree = null; r.intento = null; EF = "x"; guardarR(r); return ctx.repintar("#titulo", true);
      }
      if (a === "girar") { r.vuelta = true; EF = "x"; guardarR(r); return ctx.repintar('[data-rp-tj="bien"]'); }
      if (t.hasAttribute("data-rp-tj")) {
        puntuarTarjeta(it.u, it.id, t.getAttribute("data-rp-tj")); ctx.refrescar && ctx.refrescar(it.u); crecePlanta();
        r.k++; r.vuelta = false; EF = "x"; guardarR(r); return ctx.repintar('[data-rp="girar"], [data-rp="comparar"], .ss-fin .boton');
      }
    }

    /* en el móvil las tablas de la profe se leen como fichas: cada celda lleva el nombre de su columna (el texto no cambia) */
    function etiquetarTablas() {
      Array.prototype.forEach.call(document.querySelectorAll(".ss-dice table"), function (tb) {
        var cab = Array.prototype.map.call(tb.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
        Array.prototype.forEach.call(tb.querySelectorAll("tbody tr"), function (tr) {
          Array.prototype.forEach.call(tr.children, function (td, i) { if (cab[i]) td.setAttribute("data-col", cab[i]); });
        });
        tb.classList.add("ss-fichas");
      });
    }

    /* ---------- pantalla ---------- */
    function pSesion(id) {
      if (id === "repaso") return pRepaso();
      var S = sesionDe(id), url = "sesiones/" + id + ".json";
      if (!S) {
        return { sec: "hoy", titulo: "Sesión", html: '<header class="cab">' + ctx.titulo("Sesión de <em>estudio</em>") + "</header>" + (falloDe(url) ? '<div class="estado es-error" role="alert"><div><h2 class="estado-tit">No se pudo cargar la sesión</h2><p>Comprueba la conexión. Después funcionará sin red.</p></div></div>' : ctx.cargando("Preparando la sesión")) };
      }
      var U = D.unidad(S.unidad), e = leerS(id);
      if (!e.inicio) { e.inicio = hoy(); guardarS(id, e); }
      /* el rato A se hizo otro día: el B empieza solo, sin pausa */
      if (e.paso === 4 && e.ratoA && !e.ratoB && e.ratoA < hoy()) { e.ratoB = hoy(); guardarS(id, e); }
      var fin = !!e.hecha || e.paso === 5;
      var cuerpo = fin ? vFin(S, e) : e.paso === 0 ? vMisterio(S, e) : e.paso === 1 ? vDescubre(S, e) : e.paso === 2 ? vSinMirar(S, e) : e.paso === 3 ? vResuelve(S, e) : enPausa(e, hoy()) ? vPausa(S, e) : vOtros(S, e, id);
      var compacta = e.paso > 0;
      var html = (compacta ? "" : ctx.ruta([["Asignaturas", "#/asignaturas"], [A[U.s].nombre, "#/asignatura/" + U.s], [U.codigo, "#/unidad/" + U.id], ["Sesión"]])) +
        '<header class="cab ss-cab' + (compacta ? " compacta" : "") + '"><div class="ss-cab-fila"><p class="ss-k mano">Sesión · ' + esc(U.codigo) + (compacta ? "" : " · bloque " + S.bloque + " · dos ratos de unos " + Math.max(1, Math.ceil((+S.minutos || 0) / 2)) + "\u00a0min") + '</p><a class="ss-salir" href="#/hoy">Salir <span class="mano">(se guarda)</span></a></div>' + ctx.titulo('<span class="fluor asig">' + esc(S.titulo) + "</span>") + "</header>" +
        pasos(fin ? 5 : VISTA[e.paso]) + '<div class="ss-cuerpo" id="ssCuerpo">' + cuerpo + "</div>";
      return { sec: "hoy", titulo: "Sesión · " + S.titulo, subject: U.s, html: html, montar: function () { foco(); etiquetarTablas(); }, animar: function (M) { var f = EF; EF = null; var c = $("#ssCuerpo"); if (f && c) M.animar(f === "abajo" ? (c.querySelector(".ss-profe, .ss-resp, .ss-puntos, .ss-fb, .tj-dorso") || c) : c, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 280, easing: M.CURVA.salida }, "ss"); } };
    }

    /* ---------- acciones ---------- */
    function rutaAct() { var p = location.hash.replace(/^#\/?/, "").split("/"); return p[0] === "sesion" ? decodeURIComponent(p[1] || "") : null; }
    /* pasar al siguiente momento según lo hecho (el rato A termina al acabar «descubre») */
    function saltar(e, S) {
      var ids = S.conceptos.map(function (c) { return c.id; }), ant = e.paso;
      e.paso = siguientePaso(e, ids); e.i = 0;
      if (ant === 1) { e.ratoA = hoy(); e.ratoB = null; }
      if (e.paso === 2) { for (var k = 0; k < ids.length; k++) if (!(e.recuerdo[ids[k]] && e.recuerdo[ids[k]].guardado)) { e.i = k; break; } }
      if (e.paso === 5 && !e.hecha) { e.hecha = hoy(); crecePlanta(); }
    }
    function avanzar(id, e, S) {
      var n = S.conceptos.length;
      if ((e.paso === 1 || e.paso === 2) && e.i < n - 1) e.i++;
      else saltar(e, S);
      EF = "pagina"; guardarS(id, e); ctx.repintar("#titulo", true);
    }
    document.addEventListener("click", function (ev) {
      var id = rutaAct(), t = ev.target.closest ? ev.target.closest("button") : null;
      if (!id || !t || !document.getElementById("vista").contains(t)) return;
      if (id === "repaso") return clicRepaso(t);
      var S = DATOS[id]; if (!S) return;
      var e = leerS(id), c = S.conceptos[e.i], a = t.getAttribute("data-ss");
      if (a === "apostar") { var ta = $("#ssApuesta"); e.apuesta = ta ? ta.value.slice(0, 2000) : e.apuesta; e.paso = 1; e.i = 0; EF = "pagina"; guardarS(id, e); return ctx.repintar("#titulo", true); }
      if (a === "profe") { var gi = $("#ssGan"), vv = e.vistos[c.id] = e.vistos[c.id] || {}; if (gi) vv.gan = gi.value.slice(0, 300); vv.profe = true; EF = "abajo"; guardarS(id, e); return ctx.repintar('[data-ss="porque"]'); }
      if (a === "porque") { (e.vistos[c.id] = e.vistos[c.id] || {}).porque = true; EF = "abajo"; guardarS(id, e); return ctx.repintar(".ss-aplica .ss-op, [data-ss=sig]"); }
      if (t.hasAttribute("data-ss-ap")) {
        var p = t.getAttribute("data-ss-ap").split(":"), k = +p[0], j = +p[1], v = e.vistos[c.id] = e.vistos[c.id] || {};
        v.aplica = v.aplica || {}; if (typeof v.aplica[k] === "number") return;
        v.aplica[k] = j; guardarS(id, e); ctx.refrescar && ctx.refrescar(S.unidad);
        return ctx.repintar('[data-ss-ap^="' + (k + 1) + ':"], [data-ss=sig]');
      }
      if (a === "sig") return avanzar(id, e, S);
      if (a === "ratob") { e.ratoB = hoy(); EF = "pagina"; guardarS(id, e); return ctx.repintar("#titulo", true); }
      if (e.paso === 2 && c && (a === "voz" || t.hasAttribute("data-ss-cree"))) {
        var rv = e.recuerdo[c.id] = e.recuerdo[c.id] || {}, txv = $("#ssTxt"); if (txv) rv.txt = txv.value.slice(0, 4000);
        if (a === "voz") { rv.voz = !rv.voz; guardarS(id, e); return ctx.repintar('[data-ss="voz"]'); }
        rv.cree = +t.getAttribute("data-ss-cree"); guardarS(id, e); return ctx.repintar('[data-ss-cree="' + rv.cree + '"]');
      }
      if (a === "comparar") { var r = e.recuerdo[c.id] = e.recuerdo[c.id] || {}; var tx = $("#ssTxt"); r.txt = tx ? tx.value.slice(0, 4000) : r.txt || ""; r.intento = hayIntento(r.txt, r.voz); r.comparado = true; r.marcas = c.recuerda.puntos.map(function () { return false; }); EF = "abajo"; guardarS(id, e); return ctx.repintar("[data-ss-marca]"); }
      if (a === "puntuar") {
        var r2 = e.recuerdo[c.id] = e.recuerdo[c.id] || {};
        r2.marcas = c.recuerda.puntos.map(function (_, k2) { var x = document.querySelector('[data-ss-marca="' + k2 + '"]'); return !!(x && x.checked); });
        r2.guardado = true;
        var primera = !conceptos()[c.id];
        puntuarConcepto(c.id, S.unidad, nota(r2.marcas, c.recuerda.puntos.length, { intento: r2.intento, primera: primera }));
        ctx.refrescar && ctx.refrescar(S.unidad); crecePlanta();
        EF = "abajo"; guardarS(id, e); return ctx.repintar("[data-ss=sig]");
      }
      if (t.hasAttribute("data-ss-ac")) { e.acierto = t.getAttribute("data-ss-ac"); EF = "abajo"; guardarS(id, e); return ctx.repintar("[data-ss=sig]"); }
      if (a === "girar") { e.vuelta = true; EF = "abajo"; guardarS(id, e); return ctx.repintar('[data-ss-tj="bien"]'); }
      if (t.hasAttribute("data-ss-tj")) {
        var it = e.cola[e.k];
        puntuarTarjeta(it.u, it.id, t.getAttribute("data-ss-tj")); ctx.refrescar && ctx.refrescar(it.u); crecePlanta();
        e.k++; e.vuelta = false; if (e.k >= e.cola.length) saltar(e, S);
        EF = "pagina"; guardarS(id, e); return ctx.repintar(e.paso === 4 ? '[data-ss="girar"]' : "#titulo", e.paso !== 4);
      }
      if (a === "reiniciar") { var nuevo = estado(null); nuevo.inicio = hoy(); guardarS(id, nuevo); EF = "pagina"; return ctx.repintar("#titulo", true); }
    });
    /* lo escrito se guarda al momento (la apuesta y las explicaciones) */
    var tm = null;
    document.addEventListener("input", function (ev) {
      var id = rutaAct(), t = ev.target; if (!id || !t.hasAttribute) return;
      if (id === "repaso" && t.hasAttribute("data-rp-txt")) { clearTimeout(tm); tm = setTimeout(function () { var r = leerR(); if (r) { r.txt = t.value.slice(0, 4000); guardarR(r); } }, 300); return; }
      if (!t.hasAttribute("data-ss-txt") || !DATOS[id]) return;
      clearTimeout(tm); tm = setTimeout(function () {
        var e = leerS(id), k = t.getAttribute("data-ss-txt");
        if (k === "apuesta") e.apuesta = t.value.slice(0, 2000);
        else if (k.indexOf("gan:") === 0) { var gid = k.slice(4); (e.vistos[gid] = e.vistos[gid] || {}).gan = t.value.slice(0, 300); }
        else if (k.indexOf("rec:") === 0) { var cid = k.slice(4); (e.recuerdo[cid] = e.recuerdo[cid] || {}).txt = t.value.slice(0, 4000); }
        guardarS(id, e);
      }, 300);
    });

    /* ---------- el recorrido: app/sesiones/indice.json ---------- */
    var INDICE = {};
    function indice() { var j = cargar("sesiones/indice.json", INDICE, "i"); return j && Array.isArray(j.sesiones) ? j.sesiones : null; }
    function estadosTodas() { var o = ctx.leer(["personal", "sesiones"], {}); return o && typeof o === "object" ? o : {}; }
    function tarjetaHoy(href, peg, s, k, tit, txt, btn, extra) {
      return '<a class="ss-hoy-tarjeta recuadro" data-subject="' + esc(s) + '" href="' + href + '"><span class="washi" aria-hidden="true"></span>' + ctx.pegatina(peg, s, "quieta") +
        '<span class="ss-hoy-txt"><span class="ss-k mano">' + esc(k) + "</span><b>" + esc(tit) + "</b><span>" + esc(txt) + "</span>" + (extra || "") + "</span>" +
        '<span class="boton">' + esc(btn) + ico("siguiente") + "</span></a>";
    }
    /* lo que pinta Hoy: el repaso de hoy (con tope y sus minutos de verdad) y la siguiente sesión, por ratos.
       { repaso: {n, total, minutos, hecho, empezado}, sesion: {id, titulo, href, rato, minutos, empezada, unidad, s, pegatina, guia, hechas, base, hoyHecha} | null } */
    function hoyInfo() {
      var h = hoy(), est = estadosTodas(), rp = leerR(), todosV = pendientesHoy(), rep;
      if (rp) {
        var q = rp.cola.slice(rp.k), nc = q.filter(function (x) { return x.t === "c"; }).length;
        rep = { n: q.length, total: Math.max(+rp.total || 0, rp.cola.filter(function (x) { return x.t === "c"; }).length), minutos: q.length ? Math.max(1, Math.ceil(nc * 1.5 + (q.length - nc) * 0.7)) : 0, hecho: !!(rp.cola.length && rp.k >= rp.cola.length), empezado: rp.k > 0 };
      } else { var n0 = Math.min(todosV, TOPE_REPASO); rep = { n: n0, total: todosV, minutos: n0 ? Math.max(1, Math.ceil(n0 * 1.5)) : 0, hecho: false, empezado: false }; }
      var lista = indice(); if (!lista) return { repaso: rep, sesion: null, cargando: true };
      var exa = null; try { exa = ctx.examen ? ctx.examen() : null; } catch (_) {}
      var guia = siguienteParaExamen(lista, est, exa && exa.ex, function (u) { var U = D.unidad(u); return U ? U.s : ""; });
      var sig = guia.s, base = guia.de || lista;
      var info = { repaso: rep, sesion: null, exa: guia.de ? exa : null, hechas: base.filter(function (x) { return est[x.id] && est[x.id].hecha; }).length, base: base.length,
        hoyHecha: lista.filter(function (x) { return est[x.id] && est[x.id].hecha === h; })[0] || null };
      if (sig) {
        var e = estado(est[sig.id]), U = D.unidad(sig.unidad), aHecho = !!(e.ratoA || e.paso >= 2);
        info.sesion = { id: sig.id, titulo: sig.titulo, href: "#/sesion/" + encodeURIComponent(sig.id), rato: aHecho ? "B" : "A", minutos: Math.max(1, Math.ceil((+sig.minutos || 0) / 2)),
          empezada: !!(e.inicio && !e.hecha && e.paso > 0), ratoAHoy: e.ratoA === h, unidad: sig.unidad, s: U ? U.s : "lab", pegatina: sig.pegatina || (U ? U.pegatina : "matraz"), bloque: sig.bloque, gancho: sig.gancho, codigo: U ? U.codigo : "" };
      }
      return info;
    }
    /* en Hoy: primero el repaso (lo estudiado vuelve sin mirar) y después la siguiente sesión del recorrido */
    function hoyBloque() {
      var I = hoyInfo(), R = I.repaso, html = "";
      if (R.n > 0 || R.hecho) {
        var tope = !R.hecho && R.total > R.n;
        html += '<div class="sec-cab"><h2 id="hRp">Tu repaso de hoy</h2><span class="mano">' + (R.hecho ? "hecho" : "unos " + R.minutos + " min") + "</span></div>" +
          tarjetaHoy("#/sesion/repaso", "gafas", "lab", "vuelve justo antes de olvidarse", R.hecho ? "Repaso hecho" : tope ? "Vuelven " + R.n + " de " + R.total : R.n + (R.n === 1 ? " cosa vuelve hoy" : " cosas vuelven hoy"),
            R.hecho ? "Lo que te costó volverá antes. Mañana, más." : tope ? "El resto, repartido en los próximos días. Primero, lo más atrasado." : "Explícalo otra vez sin mirar. Si lo recuerdas, tardará más en volver.", R.hecho ? "Verlo" : R.empezado ? "Seguir" : "Repasar");
      }
      if (I.cargando) return '<section class="ancho ss-hoy" aria-label="Estudio de hoy">' + html + "</section>";
      var sig = I.sesion, exa = I.exa;
      var deQue = exa ? " de " + (exa.ex.unidad && D.unidad(exa.ex.unidad) ? D.unidad(exa.ex.unidad).codigo : (A[exa.ex.s] ? A[exa.ex.s].ab : "esta asignatura")) : " del recorrido";
      var prog = '<span class="ss-recorrido" aria-label="' + I.hechas + " de " + I.base + ' sesiones hechas"><i style="width:' + Math.round(I.hechas / Math.max(1, I.base) * 100) + '%"></i></span><span class="ss-mini">' + I.hechas + " de " + I.base + " sesiones" + deQue + "</span>";
      html += '<div class="sec-cab"><h2 id="hSs">Tu sesión de hoy</h2><span class="mano">' + (sig ? "rato " + sig.rato + " · unos " + sig.minutos + " min" : "recorrido completo") + "</span></div>";
      if (!sig) html += tarjetaHoy("#/asignaturas", "gafas", "lab", "todas hechas", "Has terminado el recorrido", "Lo que estudiaste seguirá volviendo en tu repaso. Pronto llegarán más sesiones.", "Ver unidades", prog);
      else {
        var k = exa ? "para tu examen · " + exa.cuando.toLowerCase() : sig.codigo + " · bloque " + sig.bloque + " · " + (sig.gancho || "empieza con un misterio");
        var txt = sig.rato === "B" ? (sig.ratoAHoy ? "Rato A hecho hoy. Mañana sigues con el B (o ahora mismo): otros días, sin mirar y resuelve." : "Rato B: lo de otros días, recordar sin mirar y resolver el misterio.")
          : sig.empezada ? "La dejaste a medias: sigue donde ibas."
          : I.hoyHecha ? "Ya hiciste una hoy (" + I.hoyHecha.titulo + "). Si te apetece, el primer rato de la siguiente; si no, mañana."
          : "Rato A: un caso real y unos pocos conceptos. El resto, otro rato.";
        html += tarjetaHoy(sig.href, sig.pegatina, sig.s, k, sig.titulo, txt, sig.rato === "B" ? "Seguir con el rato B" : sig.empezada ? "Seguir" : "Empezar", prog);
      }
      return '<section class="ancho ss-hoy" aria-labelledby="hSs">' + html + "</section>";
    }
    /* en la unidad: sus sesiones, en orden, con lo hecho marcado */
    function unidadBloque(u) {
      var lista = indice(); if (!lista) return "";
      var mias = lista.filter(function (x) { return x.unidad === u; }); if (!mias.length) return "";
      var est = estadosTodas();
      return '<section class="ss-unidad" aria-labelledby="hSsU"><div class="sec-cab"><h2 id="hSsU">Sesiones de estudio</h2><span class="mano">la nueva forma de estudiar</span></div><ol class="ss-lista">' + mias.map(function (x) {
        var e = estado(est[x.id]), st = e.hecha ? "hecha" : e.inicio && e.paso > 0 ? "a medias" : "";
        return '<li class="' + (e.hecha ? "hecha" : "") + '"><a href="#/sesion/' + encodeURIComponent(x.id) + '"><span class="ss-b mano">B' + x.bloque + '</span><span class="ss-lt"><b>' + esc(x.titulo) + "</b><small>" + esc(x.gancho || "") + " · " + x.minutos + " min</small></span>" + (st ? '<span class="insignia' + (e.hecha ? " pasada" : "") + '">' + st + "</span>" : "") + ico("siguiente", "u-flecha") + "</a></li>";
      }).join("") + "</ol></section>";
    }

    /* las sesiones que cuentan para un examen: las de su unidad o, si no hay, las de su asignatura */
    function paraExamen(ex) {
      var li = indice(); if (!li || !ex) return null;
      var deU = Array.isArray(ex.sesiones) && ex.sesiones.length ? li.filter(function (x) { return ex.sesiones.indexOf(x.id) >= 0; }) : ex.unidad ? li.filter(function (x) { return x.unidad === ex.unidad; }) : [];
      var base = deU.length ? deU : li.filter(function (x) { var U = D.unidad(x.unidad); return U && U.s === ex.s; });
      return { sesiones: base, estados: estadosTodas() };
    }
    /* todo lo de un examen: sus sesiones (con conceptos y diapositivas) y las tarjetas de sus bloques; null mientras carga */
    function examenDatos(ex) {
      var d = paraExamen(ex); if (!d) return null;
      var ses = d.sesiones.map(function (x) { return { x: x, S: sesionDe(x.id) }; });
      if (ses.some(function (o) { return !o.S; })) return null;
      var unidades = {}, bloques = {};
      ses.forEach(function (o) { unidades[o.S.unidad] = 1; bloques[o.S.unidad + ":b" + (o.S.bloque - 1)] = 1; });
      var tarjetas = [], falta = false;
      Object.keys(unidades).forEach(function (u) {
        var J = bancoDe(u); if (!J) { falta = true; return; }
        (J.tarjetas || []).forEach(function (t) { if (bloques[u + ":" + t.bloque]) tarjetas.push({ u: u, t: t }); });
      });
      if (falta) return null;
      return {
        sesiones: ses.map(function (o) { var e = estado(d.estados[o.x.id]); return { id: o.x.id, unidad: o.S.unidad, titulo: o.S.titulo, minutos: +o.S.minutos || 0, bloque: o.S.bloque, hecha: !!e.hecha, empezada: !!(e.inicio && e.paso > 0 && !e.hecha), conceptos: o.S.conceptos.map(function (c) { return { n: c.n, titulo: c.titulo, diapositivas: c.diapositivas }; }) }; }),
        bloques: Object.keys(bloques).map(function (k) { var p = k.split(":"); return { unidad: p[0], id: p[1] }; }),
        tarjetas: tarjetas
      };
    }
    /* el enlace de la sesión que toca hoy (lo usa la guía) */
    function sesionHoy() { var s = siguienteGuiada(""); return s ? "#/sesion/" + encodeURIComponent(s.id) : null; }
    return { sesion: pSesion, hoyBloque: hoyBloque, hoyInfo: hoyInfo, unidadBloque: unidadBloque, sesionHoy: sesionHoy, paraExamen: paraExamen, examenDatos: examenDatos };
  }

  return { crear: crear, L: { nota: nota, hayIntento: hayIntento, resultado: resultado, siguientePaso: siguientePaso, enPausa: enPausa, VISTA: VISTA, TOPE_REPASO: TOPE_REPASO, estado: estado, elegirOtros: elegirOtros, conceptosHoy: conceptosHoy, vuelve: vuelve, siguienteSesion: siguienteSesion, siguienteParaExamen: siguienteParaExamen, PASOS: PASOS } };
});
