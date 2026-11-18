/* Enfoque · simulacros: solo aspecto. Algunos títulos de parte traen un emoji en los datos (p. ej. «🔑 PREGUNTA LLAVE»).
   Los datos no se tocan (los lee scripts/extraer-preguntas.mjs): aquí, al pintarse, el emoji del principio se cambia por
   un icono dibujado. El texto que se lee (PREGUNTA LLAVE) sigue igual. Sin dependencias. */
(function () {
  var ICONOS = {
    "🔑": '<svg class="ico ki" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M14.5 9.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM13.3 12.7 20 19.4M17 16.4l2-2M18.8 18.2l1.6-1.6"/></svg>'
  };
  var RE = /(🔑)️?\s*/;
  function limpiar(raiz) {
    var els = (raiz || document).querySelectorAll(".sec-h .t, .pchip > span, .it .q > .n");
    for (var i = 0; i < els.length; i++) {
      for (var t = els[i].firstChild; t; t = t.nextSibling) {
        if (t.nodeType !== 3) continue;
        var m = RE.exec(t.nodeValue);
        if (!m) continue;
        var resto = t.splitText(m.index);                 /* «1 · » | «🔑 PREGUNTA LLAVE» */
        resto.nodeValue = resto.nodeValue.slice(m[0].length);
        var caja = document.createElement("span"); caja.innerHTML = ICONOS[m[1]];
        t.parentNode.insertBefore(caja.firstChild, resto);
        break;
      }
    }
  }
  function vigilar() {
    limpiar();
    if (!window.MutationObserver) return;
    var ob = new MutationObserver(function () { limpiar(); });
    ["exam", "chips"].forEach(function (id) { var el = document.getElementById(id); if (el) ob.observe(el, { childList: true, subtree: true }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", vigilar); else vigilar();
})();
