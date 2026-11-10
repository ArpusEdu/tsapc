/* Corte · mov.js: la puerta única del movimiento. Toda animación de la app pasa por aquí.
   Tres modos: «completo», «reducido» (prefers-reduced-motion: todo es un fundido de 150 ms) y «examen» (sin nada).
   Solo se animan transform, opacity, filter y clip-path, con WAAPI. Todo se puede cortar: cada animación lleva
   una clave y una nueva con la misma clave termina la anterior (se queda en su estado final, nunca a medias).
   En el navegador: window.CorteMov. En Node: module.exports.crear(entorno) para las pruebas. */
(function (root, f) { var api = f(); if (typeof module === "object" && module.exports) module.exports = api; else root.CorteMov = api.crear(root); })(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var REDUCIDO_MS = 150;
  var CURVA = { salida: "cubic-bezier(.23,1,.32,1)", foco: "cubic-bezier(.16,1,.3,1)", muelle: "cubic-bezier(.3,1.5,.5,1)", trazo: "cubic-bezier(.6,.05,.25,1)", giro: "cubic-bezier(.65,0,.35,1)" };
  var PERMITIDAS = { transform: 1, opacity: 1, filter: 1, clipPath: 1, offset: 1, easing: 1, composite: 1 };

  function crear(w) {
    w = w || {};
    var doc = w.document, nav = w.navigator;
    var rm = w.matchMedia ? w.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    var vivas = {};                      /* clave → Animation en curso */

    function modo() {
      var r = doc && doc.documentElement;
      if (r && r.getAttribute && r.getAttribute("data-examen") === "1") return "examen";
      return rm.matches ? "reducido" : "completo";
    }
    /* la puerta: completo() solo corre en modo completo; si no, la versión reducida o la del examen (estado final, sin tween) */
    function mov(completo, alt) {
      alt = alt || {};
      var m = modo();
      if (m === "examen") return alt.examen ? alt.examen() : undefined;
      if (m === "reducido") return alt.reducido ? alt.reducido() : undefined;
      return completo();
    }
    function soloPermitidas(kf) {
      (Array.isArray(kf) ? kf : [kf]).forEach(function (k) { for (var p in k) if (!PERMITIDAS[p]) throw new Error("mov: propiedad no permitida «" + p + "»"); });
      return kf;
    }
    /* corta la animación de esa clave dejándola en su estado final */
    function cortar(clave) {
      var a = vivas[clave]; if (!a) return;
      delete vivas[clave];
      try { a.finish(); } catch (_) { try { a.cancel(); } catch (__) {} }
    }
    function cortarTodo() { Object.keys(vivas).forEach(cortar); }
    /* WAAPI con clave. Devuelve la Animation o null si no hay elemento o no hay WAAPI */
    function anim(el, kf, op, clave) {
      if (!el || typeof el.animate !== "function") return null;
      soloPermitidas(kf);
      clave = clave || null;
      if (clave) cortar(clave);
      var o = {}; for (var k in op) o[k] = op[k];
      if (o.fill === undefined) o.fill = "backwards";
      var a = el.animate(kf, o);
      if (clave) {
        vivas[clave] = a;
        var fin = function () { if (vivas[clave] === a) delete vivas[clave]; };
        a.onfinish = fin; a.oncancel = fin;
      }
      return a;
    }
    /* el fundido único del modo reducido */
    function fundido(el, clave, op) {
      return anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: REDUCIDO_MS, easing: "linear", pseudoElement: op && op.pseudo }, clave);
    }
    /* anima en completo; en reducido funde; en examen nada */
    function animar(el, kf, op, clave) {
      return mov(function () { return anim(el, kf, op, clave); }, { reducido: function () { return op && op.sinFundido ? null : fundido(el, clave, { pseudo: op && op.pseudoElement }); } });
    }
    /* vibración corta: nunca en examen ni con movimiento reducido */
    function sentir(ms) {
      return mov(function () {
        if (!nav || typeof nav.vibrate !== "function") return false;
        if (nav.userActivation && !nav.userActivation.hasBeenActive) return false;   /* sin un toque previo el navegador la bloquea */
        try { return nav.vibrate(ms || 10); } catch (_) { return false; }
      });
    }
    function enCurso() { return Object.keys(vivas).length; }
    return { modo: modo, mov: mov, anim: anim, animar: animar, fundido: fundido, cortar: cortar, cortarTodo: cortarTodo, sentir: sentir, enCurso: enCurso, CURVA: CURVA, REDUCIDO_MS: REDUCIDO_MS };
  }
  return { crear: crear, CURVA: CURVA, REDUCIDO_MS: REDUCIDO_MS };
});
