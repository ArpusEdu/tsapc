/* Corte · sesión de estudio (Fase 7, nueva metodología): #/sesion/<id>
   Cinco momentos: 1 El misterio · 2 Descubre · 3 Sin mirar · 4 Resuelve · 5 Lo de otros días.
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
  var PASOS = [["misterio", "El misterio"], ["descubre", "Descubre"], ["sinmirar", "Sin mirar"], ["resuelve", "Resuelve"], ["otros", "Lo de otros días"]];

  /* ================= lógica pura ================= */
  /* lo que dijiste sin mirar → nota del repaso espaciado: todo = «fácil», la mitad o más = «bien», menos = «otra vez» */
  function nota(marcas, total) {
    var n = 0; (marcas || []).forEach(function (m) { if (m) n++; });
    if (!total) return "bien";
    return n >= total ? "facil" : n * 2 >= total ? "bien" : "otra";
  }
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
      inicio: typeof e.inicio === "string" ? e.inicio : null, hecha: typeof e.hecha === "string" ? e.hecha : null
    };
  }
  /* la siguiente sesión del recorrido: la que está a medias; si no, la primera sin hacer; si no, ninguna */
  function siguienteSesion(lista, estados) {
    var e = function (x) { return estado(estados && estados[x.id]); };
    return lista.filter(function (x) { var s = e(x); return s.inicio && !s.hecha && s.paso > 0; })[0] || lista.filter(function (x) { return !e(x).hecha; })[0] || null;
  }
  /* los conceptos que vuelven hoy: ya tocan y no se estudiaron hoy mismo (lo de hoy vuelve, como pronto, mañana) */
  function conceptosHoy(estados, hoy) {
    var out = [];
    for (var k in estados) if (Object.prototype.hasOwnProperty.call(estados, k)) {
      var e = estados[k]; if (e && e.due && e.due <= hoy && (!e.ult || e.ult < hoy)) out.push({ id: k, due: e.due });
    }
    return out.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; }).map(function (x) { return x.id; });
  }
  /* cuándo vuelve, dicho para una persona */
  function vuelve(e, hoy, S2) {
    if (!e || !e.due) return "";
    var d = e.due <= hoy ? S2.sumarDias(hoy, 1) : e.due;
    var p = hoy.split("-"), q = d.split("-"), dias = Math.round((new Date(+q[0], +q[1] - 1, +q[2]) - new Date(+p[0], +p[1] - 1, +p[2])) / 864e5);
    return dias <= 1 ? "mañana" : "en " + dias + " días";
  }
  /* las tarjetas de otros días: primero las que ya tocan (vencidas), después las nuevas de los bloques pedidos; mezcladas y sin repetir unidad seguida si se puede */
  function elegirOtros(fuentes, hoy, S2, n, soloVencidas) {
    var vencidas = [], nuevas = [];
    fuentes.forEach(function (f) {
      (f.tarjetas || []).forEach(function (t) {
        if (f.bloques && f.bloques.length && f.bloques.indexOf(t.bloqueNum) < 0) return;
        var e = f.estados && f.estados[t.id];
        if (e && S2.vencida(e, hoy)) vencidas.push({ u: f.unidad, id: t.id, due: e.due });
        else if (!e) nuevas.push({ u: f.unidad, id: t.id });
      });
    });
    vencidas.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
    var porU = {}; nuevas.forEach(function (x) { (porU[x.u] = porU[x.u] || []).push(x); });
    var us = Object.keys(porU), mezcla = [], quedan = true;
    for (var r = 0; quedan; r++) { quedan = false; us.forEach(function (u) { if (porU[u][r]) { mezcla.push(porU[u][r]); quedan = true; } }); }
    return vencidas.map(function (x) { return { u: x.u, id: x.id }; }).concat(soloVencidas ? [] : mezcla).slice(0, n || 4);
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
          .then(function () { if (/^#\/(sesion|hoy|unidad)/.test(location.hash) || !location.hash) ctx.pintar(true); });
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

    /* ---------- piezas ---------- */
    function sello(texto) { return '<span class="ss-sello">' + ico("info") + esc(texto) + "</span>"; }
    var DE_CORTE = sello("de Corte"), DE_PROFE = '<span class="ss-sello profe">' + ico("check") + "de tu profe</span>";
    function pasos(n) {
      return '<ol class="ss-pasos" aria-label="Momentos de la sesión">' + PASOS.map(function (p, k) {
        var cl = k < n ? "hecho" : k === n ? "ahora" : "";
        return '<li class="' + cl + '"' + (k === n ? ' aria-current="step"' : "") + '><span class="ss-num num">' + (k < n ? "✓" : k + 1) + '</span><span class="ss-nom">' + p[1] + "</span></li>";
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
        '<div class="ss-gancho">' + DE_CORTE + '<p class="mano">' + esc(c.gancho) + '</p><p class="ss-mini">Piénsalo unos segundos antes de abrir. No hace falta acertar.</p></div>';
      if (!v.profe) return h + '<div class="acciones">' + boton("Ver lo que dice la profe", 'data-ss="profe"', false, "abrir-fuera") + "</div></article>";
      var p = c.profe;
      h += '<section class="ss-profe" aria-label="Lo que dice la profe">' + DE_PROFE +
        (p.glosario ? '<div class="ss-glos rico">' + rico(p.glosario) + "</div>" : "") +
        (p.img ? '<figure class="ss-fig"><img src="' + esc(p.img) + '" alt="' + esc(p.imgAlt || "") + '" loading="lazy"><figcaption>' + esc(p.imgAlt || "") + "</figcaption></figure>" : "") +
        '<div class="ss-dice rico">' + rico(p.dice) + "</div>" +
        (p.entiende ? '<div class="ss-ent"><b>Entiéndelo:</b> ' + rico(p.entiende) + "</div>" : "") +
        (p.truco ? '<div class="ss-truco"><span class="mano">Truco:</span> ' + rico(p.truco) + "</div>" : "") + "</section>";
      h += '<section class="ss-porque nota" aria-labelledby="ssPq">' + DE_CORTE + '<h3 id="ssPq">¿Por qué?</h3><p>' + esc(c.porque.pregunta) + "</p>" +
        (v.porque ? '<p class="ss-resp">' + esc(c.porque.respuesta) + "</p>" : '<div class="acciones">' + boton("Lo he pensado: ver una respuesta", 'data-ss="porque"', true) + "</div>") + "</section>";
      if (c.aplica && c.aplica.length) {
        h += '<section class="ss-aplica" aria-labelledby="ssAp">' + DE_CORTE + '<h3 id="ssAp">Úsalo</h3><ol>' + c.aplica.map(function (a, k) {
          var r = v.aplica && typeof v.aplica[k] === "number" ? v.aplica[k] : null;
          return '<li><p>' + esc(a.caso) + '</p><div class="ss-ops" role="group" aria-label="Elige">' + a.opciones.map(function (o, j) {
            var cl = r === null ? "" : j === a.buena ? " buena" : j === r ? " mala" : "";
            return '<button type="button" class="ss-op' + cl + '" data-ss-ap="' + k + ":" + j + '"' + (r !== null ? ' aria-disabled="true"' : "") + ' aria-pressed="' + (r === j) + '">' + esc(o) + "</button>";
          }).join("") + "</div>" + (r !== null ? '<p class="ss-fb ' + (r === a.buena ? "bien" : "mal") + '" role="status">' + (r === a.buena ? "<b>Eso es.</b> " : "<b>No exactamente.</b> ") + esc(a.porque) + "</p>" : "") + "</li>";
        }).join("") + "</ol></section>";
      }
      var ult = e.i === n - 1;
      return h + '<div class="acciones ss-sig">' + (ult ? boton("Ahora, sin mirar", 'data-ss="sig"', false, "siguiente") : boton("Siguiente concepto", 'data-ss="sig"', false, "siguiente")) + "</div></article>";
    }
    /* ---------- 3 · sin mirar ---------- */
    function vSinMirar(S, e) {
      var c = S.conceptos[e.i], r = e.recuerdo[c.id] || {}, n = S.conceptos.length;
      var h = '<p class="ss-cuenta num">' + (e.i + 1) + " de " + n + " · todo tapado</p>" +
        '<article class="ss-recuerda" aria-labelledby="ssR"><h2 id="ssR">' + esc(c.titulo) + '</h2><p class="ss-pide">' + esc(c.recuerda.pide) + "</p>" +
        '<label class="sr" for="ssTxt">Tu explicación</label><textarea id="ssTxt" rows="6" data-ss-txt="rec:' + esc(c.id) + '"' + (r.comparado ? " readonly" : "") + ' placeholder="Escríbelo como se lo contarías a alguien que no sabe nada. También vale decirlo en voz alta y escribir solo las palabras clave.">' + esc(r.txt || "") + "</textarea>";
      if (!r.comparado) return h + '<div class="acciones">' + boton("Comparar con el original", 'data-ss="comparar"', false, "check") + '</div><p class="ss-por mano">Lo que cuesta un poco recordar es lo que más se queda. Sacarlo de la cabeza vale más que releerlo tres veces.</p></article>';
      var marcas = Array.isArray(r.marcas) ? r.marcas : [];
      h += '<section class="ss-puntos" aria-labelledby="ssPt">' + DE_PROFE + '<h3 id="ssPt">¿Qué dijiste?</h3><p class="ss-mini">Marca lo que tenías, aunque fuera con otras palabras.</p><ul>' + c.recuerda.puntos.map(function (p, k) {
        return '<li><label class="ss-check"><input type="checkbox" data-ss-marca="' + k + '"' + (marcas[k] ? " checked" : "") + (r.guardado ? " disabled" : "") + "><span>" + esc(p) + "</span></label></li>";
      }).join("") + "</ul></section>";
      if (!r.guardado) return h + '<div class="acciones">' + boton("Listo, seguir", 'data-ss="puntuar"', false, "siguiente") + "</div></article>";
      var st = conceptos()[c.id];
      var n2 = marcas.filter(Boolean).length, tot = c.recuerda.puntos.length;
      h += '<p class="ss-fb ' + (n2 >= tot ? "bien" : "mal") + '" role="status"><b>' + n2 + " de " + tot + ".</b> " + (n2 >= tot ? "Lo tienes. " : n2 * 2 >= tot ? "Buena base; lo que faltó vuelve antes. " : "Normal la primera vez: vuelve pronto para afianzarlo. ") + "Te lo vuelvo a pedir " + vuelve(st, hoy(), S2) + ", en tu repaso.</p>";
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
        (ok ? '<p class="ss-fb bien" role="status">' + (ok === "no" ? "Perfecto que fallaras al principio: justo eso hace que ahora se te quede." : "Fíjate: antes no lo sabías y ahora sí.") + "</p>" : "") +
        (con.length ? '<section class="ss-conecta" aria-labelledby="ssCo"><h3 id="ssCo">Esto se conecta con…</h3><ul>' + con.map(function (x) { return '<li><a href="' + esc(x.ruta) + '">' + esc(x.texto) + "</a></li>"; }).join("") + "</ul></section>" : "") +
        (ok ? '<div class="acciones">' + boton("Lo de otros días", 'data-ss="sig"', false, "siguiente") + "</div>" : "") + "</section>";
    }
    /* ---------- 5 · lo de otros días ---------- */
    function fuentes(S) {
      return (S.otrosDias || []).map(function (f) { var J = bancoDe(f.unidad); return J ? { unidad: f.unidad, bloques: f.bloques, tarjetas: J.tarjetas, estados: ctx.leer(["unidades", f.unidad, "tarjetas"], {}) || {} } : null; });
    }
    function vOtros(S, e, id) {
      var fs = fuentes(S);
      if (fs.some(function (f) { return !f; })) return ctx.cargando("Buscando lo de otros días");
      if (!e.cola) { e.cola = elegirOtros(fs, hoy(), S2, 4); e.k = 0; e.vuelta = false; guardarS(id, e); }
      if (e.k >= e.cola.length) return vFin(S, e);
      var it = e.cola[e.k], J = BANCOS[it.u], t = J && J.tarjetas.filter(function (x) { return x.id === it.id; })[0];
      if (!t) { e.k++; guardarS(id, e); return vOtros(S, e, id); }
      var U = D.unidad(it.u), S1 = U ? A[U.s] : null;
      return '<p class="ss-cuenta num">' + (e.k + 1) + " de " + e.cola.length + " · mezclado: así se recuerda en el examen y en el trabajo</p>" +
        '<article class="tj-ficha ss-ficha' + (e.vuelta ? " vuelta" : "") + '"' + (S1 ? ' data-subject="' + esc(U.s) + '"' : "") + ' aria-live="polite"><p class="tj-meta">' + (U ? esc(U.codigo + " · " + U.titulo) : "") + '</p><h2 class="tj-frente">' + esc(t.frente) + "</h2>" +
        (e.vuelta ? '<div class="tj-dorso rico">' + ctx.rico(t.dorso, t.formato, "../" + it.u + "/repaso/") + "</div>" : '<p class="ss-mini">Dilo en voz alta o en la cabeza antes de girarla.</p>') + "</article>" +
        (e.vuelta ? '<div class="tj-botones" role="group" aria-label="¿Cómo te ha ido?">' + boton("Otra vez", 'data-ss-tj="otra"', true) + boton("Bien", 'data-ss-tj="bien"') + boton("Fácil", 'data-ss-tj="facil"', true) + "</div>"
          : '<div class="tj-botones">' + boton("Ver la respuesta", 'data-ss="girar"') + "</div>");
    }
    function vFin(S, e) {
      var cs = conceptos(), filas = S.conceptos.map(function (c) {
        var r = e.recuerdo[c.id] || {}, m = (r.marcas || []).filter(Boolean).length, st = cs[c.id];
        return "<li><b>" + esc(c.titulo) + '</b><span class="num">' + m + " / " + c.recuerda.puntos.length + "</span><span>" + (st && st.due ? "vuelve " + vuelve(st, hoy(), S2) : "") + "</span></li>";
      }).join("");
      return '<section class="ss-fin recuadro" aria-labelledby="ssFin"><span class="washi" aria-hidden="true"></span>' + ctx.pegatina("matraz", "lab", "") +
        '<h2 id="ssFin">Sesión hecha</h2><p>' + (e.hecha === hoy() ? "Has estudiado para entender, no solo para aprobar. " : "") + "Esto es lo que te llevas y cuándo vuelve:</p>" +
        '<ul class="ss-resumen">' + filas + "</ul>" +
        '<p class="mano">No hace falta repasarlo antes: cuando toque, en Hoy aparecerá «Tu repaso de hoy» y te lo pediré otra vez sin mirar.</p>' +
        '<div class="acciones"><a class="boton" href="#/hoy">Volver a Hoy</a><button type="button" class="boton secundario" data-ss="reiniciar">Repetir la sesión desde el principio</button></div></section>';
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
        var idx = indiceConceptos(ls), cola = conceptosHoy(conceptos(), hoy()).filter(function (id) { return idx[id]; }).map(function (id) { return { t: "c", id: id }; });
        var us = {}; ls.forEach(function (S) { us[S.unidad] = 1; (S.otrosDias || []).forEach(function (f) { us[f.unidad] = 1; }); });
        var fs = Object.keys(us).map(function (u) { var J = bancoDe(u); return J ? { unidad: u, bloques: [], tarjetas: J.tarjetas, estados: ctx.leer(["unidades", u, "tarjetas"], {}) || {} } : null; });
        if (fs.some(function (f) { return !f; })) return { sec: "hoy", titulo: "Repaso de hoy", html: cab + ctx.cargando("Buscando lo que vuelve hoy") };
        elegirOtros(fs, hoy(), S2, 6, true).forEach(function (x) { cola.push({ t: "t", u: x.u, id: x.id }); });
        r = { fecha: hoy(), cola: cola, k: 0 }; guardarR(r);
      }
      var html;
      if (!r.cola.length) html = '<div class="estado">' + ctx.pegatina("gafas", "lab", "quieta") + '<div><h2 class="estado-tit">Hoy no vuelve nada</h2><p>Todo lo que has estudiado está fresco. Puedes hacer una sesión nueva o descansar: también cuenta.</p><div class="acciones"><a class="boton" href="#/hoy">Volver a Hoy</a></div></div></div>';
      else if (r.k >= r.cola.length) html = '<section class="ss-fin recuadro"><span class="washi" aria-hidden="true"></span>' + ctx.pegatina("matraz", "lab", "") + '<h2>Repaso hecho</h2><p>' + r.cola.length + (r.cola.length === 1 ? " cosa repasada" : " cosas repasadas") + ". Lo que te costó vuelve antes; lo que dominas, cada vez más tarde.</p><div class=\"acciones\"><a class=\"boton\" href=\"#/hoy\">Volver a Hoy</a></div></section>";
      else {
        var it = r.cola[r.k], cuenta = '<p class="ss-cuenta num">' + (r.k + 1) + " de " + r.cola.length + "</p>";
        if (it.t === "c") {
          var x = indiceConceptos(ls)[it.id], c = x.c, U = D.unidad(x.S.unidad), marcas = Array.isArray(r.marcas) ? r.marcas : [];
          html = cuenta + '<article class="ss-recuerda" data-subject="' + esc(U.s) + '" aria-labelledby="rpT"><p class="ss-k mano">' + esc(U.codigo + " · " + x.S.titulo) + '</p><h2 id="rpT">' + esc(c.titulo) + '</h2><p class="ss-pide">' + esc(c.recuerda.pide) + "</p>" +
            '<label class="sr" for="ssTxt">Tu explicación</label><textarea id="ssTxt" rows="5" data-rp-txt' + (r.comparado ? " readonly" : "") + ' placeholder="Sin mirar: lo que recuerdes, con tus palabras.">' + esc(r.txt || "") + "</textarea>";
          if (!r.comparado) html += '<div class="acciones">' + boton("Comparar con el original", 'data-rp="comparar"', false, "check") + "</div></article>";
          else html += '<section class="ss-puntos">' + DE_PROFE + '<h3>¿Qué dijiste?</h3><ul>' + c.recuerda.puntos.map(function (p, k) { return '<li><label class="ss-check"><input type="checkbox" data-rp-marca="' + k + '"' + (marcas[k] ? " checked" : "") + "><span>" + esc(p) + "</span></label></li>"; }).join("") + '</ul></section><div class="acciones">' + boton("Listo, seguir", 'data-rp="puntuar"', false, "siguiente") + "</div></article>";
        } else {
          var J = BANCOS[it.u], t = J && J.tarjetas.filter(function (y) { return y.id === it.id; })[0], U2 = D.unidad(it.u);
          if (!t) { r.k++; guardarR(r); return pRepaso(); }
          html = cuenta + '<article class="tj-ficha ss-ficha' + (r.vuelta ? " vuelta" : "") + '" data-subject="' + esc(U2.s) + '" aria-live="polite"><p class="tj-meta">' + esc(U2.codigo + " · tarjeta") + '</p><h2 class="tj-frente">' + esc(t.frente) + "</h2>" +
            (r.vuelta ? '<div class="tj-dorso rico">' + ctx.rico(t.dorso, t.formato, "../" + it.u + "/repaso/") + "</div>" : '<p class="ss-mini">Dilo antes de girarla.</p>') + "</article>" +
            (r.vuelta ? '<div class="tj-botones" role="group" aria-label="¿Cómo te ha ido?">' + boton("Otra vez", 'data-rp-tj="otra"', true) + boton("Bien", 'data-rp-tj="bien"') + boton("Fácil", 'data-rp-tj="facil"', true) + "</div>" : '<div class="tj-botones">' + boton("Ver la respuesta", 'data-rp="girar"') + "</div>");
        }
      }
      return { sec: "hoy", titulo: "Repaso de hoy", html: cab + '<div class="ss-cuerpo" id="ssCuerpo">' + html + "</div>", animar: function (M) { var f = EF; EF = null; var c2 = $("#ssCuerpo"); if (f && c2) M.animar(c2, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: M.CURVA.salida }, "ss"); } };
    }
    function clicRepaso(t) {
      var r = leerR(); if (!r || r.k >= r.cola.length) return;
      var it = r.cola[r.k], a = t.getAttribute("data-rp");
      if (a === "comparar") { var tx = $("#ssTxt"); r.txt = tx ? tx.value.slice(0, 4000) : ""; r.comparado = true; r.marcas = []; EF = "x"; guardarR(r); return ctx.repintar("[data-rp-marca]"); }
      if (a === "puntuar") {
        var idx = indiceConceptos(todas() || []), x = idx[it.id]; if (!x) return;
        var m = x.c.recuerda.puntos.map(function (_, k) { var el = document.querySelector('[data-rp-marca="' + k + '"]'); return !!(el && el.checked); });
        var todos = conceptos(); todos[it.id] = S2.puntuar(todos[it.id] || null, nota(m, m.length), hoy()); ctx.guardar(["personal", "conceptos"], todos);
        ctx.refrescar && ctx.refrescar(x.S.unidad);
        r.k++; r.comparado = false; r.marcas = []; r.txt = ""; EF = "x"; guardarR(r); return ctx.repintar("#titulo", true);
      }
      if (a === "girar") { r.vuelta = true; EF = "x"; guardarR(r); return ctx.repintar('[data-rp-tj="bien"]'); }
      if (t.hasAttribute("data-rp-tj")) {
        var est = ctx.leer(["unidades", it.u, "tarjetas"], {}) || {};
        est[it.id] = S2.puntuar(est[it.id] || null, t.getAttribute("data-rp-tj"), hoy()); ctx.guardar(["unidades", it.u, "tarjetas"], est); ctx.refrescar && ctx.refrescar(it.u);
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
      var cuerpo = e.paso === 0 ? vMisterio(S, e) : e.paso === 1 ? vDescubre(S, e) : e.paso === 2 ? vSinMirar(S, e) : e.paso === 3 ? vResuelve(S, e) : vOtros(S, e, id);
      var html = ctx.ruta([["Asignaturas", "#/asignaturas"], [A[U.s].nombre, "#/asignatura/" + U.s], [U.codigo, "#/unidad/" + U.id], ["Sesión"]]) +
        '<header class="cab ss-cab"><p class="ss-k mano">Sesión de estudio · ' + esc(U.codigo) + " · bloque " + S.bloque + " · unos " + S.minutos + " min</p>" + ctx.titulo('<span class="fluor asig">' + esc(S.titulo) + "</span>") + "</header>" +
        pasos(Math.min(e.paso, 4) + (e.paso === 4 && e.cola && e.k >= e.cola.length ? 1 : 0)) + '<div class="ss-cuerpo" id="ssCuerpo">' + cuerpo + "</div>";
      return { sec: "asignaturas", titulo: "Sesión · " + S.titulo, subject: U.s, html: html, montar: etiquetarTablas, animar: function (M) { var f = EF; EF = null; var c = $("#ssCuerpo"); if (f && c) M.animar(f === "abajo" ? (c.querySelector(".ss-profe, .ss-resp, .ss-puntos, .ss-fb, .tj-dorso") || c) : c, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 280, easing: M.CURVA.salida }, "ss"); } };
    }

    /* ---------- acciones ---------- */
    function rutaAct() { var p = location.hash.replace(/^#\/?/, "").split("/"); return p[0] === "sesion" ? decodeURIComponent(p[1] || "") : null; }
    function avanzar(id, e, S) {
      var n = S.conceptos.length;
      if ((e.paso === 1 || e.paso === 2) && e.i < n - 1) e.i++;
      else { e.paso++; e.i = 0; }
      EF = "pagina"; guardarS(id, e); ctx.repintar("#titulo", true);
    }
    document.addEventListener("click", function (ev) {
      var id = rutaAct(), t = ev.target.closest ? ev.target.closest("button") : null;
      if (!id || !t || !document.getElementById("vista").contains(t)) return;
      if (id === "repaso") return clicRepaso(t);
      var S = DATOS[id]; if (!S) return;
      var e = leerS(id), c = S.conceptos[e.i], a = t.getAttribute("data-ss");
      if (a === "apostar") { var ta = $("#ssApuesta"); e.apuesta = ta ? ta.value.slice(0, 2000) : e.apuesta; e.paso = 1; e.i = 0; EF = "pagina"; guardarS(id, e); return ctx.repintar("#titulo", true); }
      if (a === "profe") { (e.vistos[c.id] = e.vistos[c.id] || {}).profe = true; EF = "abajo"; guardarS(id, e); return ctx.repintar('[data-ss="porque"]'); }
      if (a === "porque") { (e.vistos[c.id] = e.vistos[c.id] || {}).porque = true; EF = "abajo"; guardarS(id, e); return ctx.repintar(".ss-aplica .ss-op, [data-ss=sig]"); }
      if (t.hasAttribute("data-ss-ap")) {
        var p = t.getAttribute("data-ss-ap").split(":"), k = +p[0], j = +p[1], v = e.vistos[c.id] = e.vistos[c.id] || {};
        v.aplica = v.aplica || {}; if (typeof v.aplica[k] === "number") return;
        v.aplica[k] = j; guardarS(id, e); ctx.refrescar && ctx.refrescar(S.unidad);
        return ctx.repintar('[data-ss-ap^="' + (k + 1) + ':"], [data-ss=sig]');
      }
      if (a === "sig") return avanzar(id, e, S);
      if (a === "comparar") { var r = e.recuerdo[c.id] = e.recuerdo[c.id] || {}; var tx = $("#ssTxt"); r.txt = tx ? tx.value.slice(0, 4000) : r.txt || ""; r.comparado = true; r.marcas = c.recuerda.puntos.map(function () { return false; }); EF = "abajo"; guardarS(id, e); return ctx.repintar("[data-ss-marca]"); }
      if (a === "puntuar") {
        var r2 = e.recuerdo[c.id] = e.recuerdo[c.id] || {};
        r2.marcas = c.recuerda.puntos.map(function (_, k2) { var x = document.querySelector('[data-ss-marca="' + k2 + '"]'); return !!(x && x.checked); });
        r2.guardado = true;
        var todos = conceptos(); todos[c.id] = S2.puntuar(todos[c.id] || null, nota(r2.marcas, c.recuerda.puntos.length), hoy());
        ctx.guardar(["personal", "conceptos"], todos); ctx.refrescar && ctx.refrescar(S.unidad);
        EF = "abajo"; guardarS(id, e); return ctx.repintar("[data-ss=sig]");
      }
      if (t.hasAttribute("data-ss-ac")) { e.acierto = t.getAttribute("data-ss-ac"); EF = "abajo"; guardarS(id, e); return ctx.repintar("[data-ss=sig]"); }
      if (a === "girar") { e.vuelta = true; EF = "abajo"; guardarS(id, e); return ctx.repintar('[data-ss-tj="bien"]'); }
      if (t.hasAttribute("data-ss-tj")) {
        var it = e.cola[e.k], est = ctx.leer(["unidades", it.u, "tarjetas"], {}) || {};
        est[it.id] = S2.puntuar(est[it.id] || null, t.getAttribute("data-ss-tj"), hoy());
        ctx.guardar(["unidades", it.u, "tarjetas"], est); ctx.refrescar && ctx.refrescar(it.u);
        e.k++; e.vuelta = false; if (e.k >= e.cola.length) e.hecha = hoy();
        EF = "pagina"; guardarS(id, e); return ctx.repintar('[data-ss="girar"], .ss-fin .boton');
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
    /* en Hoy: primero el repaso (lo estudiado vuelve sin mirar) y después la siguiente sesión del recorrido */
    function hoyBloque() {
      var h = hoy(), lista = indice(), est = estadosTodas(), html = "";
      var rp = leerR(), nRep = rp ? rp.cola.length - rp.k : pendientesHoy(), repHecho = rp && rp.cola.length && rp.k >= rp.cola.length;
      if (nRep > 0 || repHecho) {
        html += '<div class="sec-cab"><h2 id="hRp">Tu repaso de hoy</h2><span class="mano">' + (repHecho ? "hecho" : "unos 5 min") + "</span></div>" +
          tarjetaHoy("#/sesion/repaso", "gafas", "lab", "vuelve justo antes de olvidarse", repHecho ? "Repaso hecho" : rp ? nRep + (nRep === 1 ? " cosa vuelve hoy" : " cosas vuelven hoy") : nRep + (nRep === 1 ? " concepto vuelve hoy" : " conceptos vuelven hoy"),
            repHecho ? "Lo que te costó volverá antes. Mañana, más." : "Explícalo otra vez sin mirar. Si lo recuerdas, tardará más en volver.", repHecho ? "Verlo" : "Repasar");
      }
      if (!lista) return '<section class="ancho ss-hoy" aria-label="Estudio de hoy">' + html + "</section>";
      var sig = siguienteSesion(lista, est), hechas = lista.filter(function (x) { return est[x.id] && est[x.id].hecha; }).length;
      var hoyHecha = lista.filter(function (x) { return est[x.id] && est[x.id].hecha === h; })[0];
      var prog = '<span class="ss-recorrido" aria-label="' + hechas + " de " + lista.length + ' sesiones hechas"><i style="width:' + Math.round(hechas / Math.max(1, lista.length) * 100) + '%"></i></span><span class="ss-mini">' + hechas + " de " + lista.length + " sesiones del recorrido</span>";
      html += '<div class="sec-cab"><h2 id="hSs">Tu sesión de hoy</h2><span class="mano">' + (sig ? "unos " + sig.minutos + " min" : "recorrido completo") + "</span></div>";
      if (!sig) html += tarjetaHoy("#/asignaturas", "gafas", "lab", "todas hechas", "Has terminado el recorrido", "Lo que estudiaste seguirá volviendo en tu repaso. Pronto llegarán más sesiones.", "Ver unidades", prog);
      else {
        var U = D.unidad(sig.unidad), e = estado(est[sig.id]), empezada = e.inicio && !e.hecha && e.paso > 0;
        var k = (U ? U.codigo : "") + " · bloque " + sig.bloque + " · " + (sig.gancho || "empieza con un misterio");
        var txt = hoyHecha && !empezada ? "Ya hiciste una hoy (" + hoyHecha.titulo + "). Si te apetece, sigue con la siguiente; si no, mañana." : empezada ? "La dejaste a medias: sigue donde ibas." : "Un caso real, unos pocos conceptos y lo de otros días. Sin tener que organizarte.";
        html += tarjetaHoy("#/sesion/" + encodeURIComponent(sig.id), sig.pegatina || (U ? U.pegatina : "matraz"), U ? U.s : "lab", k, sig.titulo, txt, empezada ? "Seguir" : "Empezar", prog);
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

    return { sesion: pSesion, hoyBloque: hoyBloque, unidadBloque: unidadBloque };
  }

  return { crear: crear, L: { nota: nota, estado: estado, elegirOtros: elegirOtros, conceptosHoy: conceptosHoy, vuelve: vuelve, siguienteSesion: siguienteSesion, PASOS: PASOS } };
});
