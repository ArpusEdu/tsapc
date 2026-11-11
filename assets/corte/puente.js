/* Corte · puente (Fase 7): en las páginas de unidad de antes, «volver» lleva a la unidad dentro de la app.
   Solo toca los enlaces que iban a la portada antigua (href="../../"). No lee ni escribe el progreso. */
(function () {
  "use strict";
  var r = document.documentElement, u = r.getAttribute("data-unit");
  if (!u || !r.classList.contains("corte")) return;
  var NOMBRE = { lab1: "Lab 1", lab2: "Lab 2", bio1: "Bio 1", bio2: "Bio 2", bio3: "Bio 3", fisio1: "Fisio 1", fisio2: "Fisio 2", fisio3: "Fisio 3", gest1: "Gest 1", gest2: "Gest 2", ipe2: "IPE 2", "ipe-tema5": "IPE 5", ingles1: "Inglés 1" };
  var destino = "../../app/#/unidad/" + encodeURIComponent(u), nombre = NOMBRE[u] || "la unidad";
  function arreglar() {
    Array.prototype.forEach.call(document.querySelectorAll('a[href="../../"]'), function (a) {
      a.href = destino;
      if (a.classList.contains("mc-float")) { a.textContent = "← " + nombre; a.setAttribute("aria-label", "Volver a " + nombre + " en Corte"); }
      else if (a.classList.contains("mc-back")) a.textContent = "← " + nombre + " · Corte";
      else if (/Mi carrera/.test(a.textContent)) a.textContent = "← " + nombre;
    });
  }
  /* la página crea (y a veces vuelve a crear) sus botones de volver al cargar: se arreglan al momento y cada vez que aparezca uno nuevo */
  var mo = window.MutationObserver ? new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) if (ms[i].addedNodes.length || ms[i].type === "attributes") { arreglar(); return; }
  }) : null;
  function empezar() { arreglar(); if (mo) mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", empezar); else empezar();
  /* por si alguno se escapa: un clic en un enlace a la portada antigua va a la unidad */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href="../../"]');
    if (a) { e.preventDefault(); location.href = destino; }
  }, true);
})();
