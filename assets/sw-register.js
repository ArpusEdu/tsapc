/* Registro del service worker para todas las páginas (portada, repasos y simulacros).
   - Cuando hay una versión nueva NO cambia la web de golpe: enseña «Nueva versión · Actualizar».
   - Pide al navegador que no borre los datos guardados (navigator.storage.persist).
   - En iPhone, una sola vez, explica cómo añadir la web a la pantalla de inicio.
   Sin dependencias. Se carga con <script src=".../assets/sw-register.js" defer>. */
(function () {
  var me = document.currentScript;
  var base = new URL("../", (me && me.src) || location.href);   // la carpeta raíz de tsapc
  var local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var ok = "serviceWorker" in navigator && (location.protocol === "https:" || local);

  function alCargar(fn) { if (document.readyState === "complete") fn(); else addEventListener("load", fn); }
  function css(el, s) { el.style.cssText = s; return el; }
  function boton(texto, principal) {
    var b = document.createElement("button"); b.type = "button"; b.textContent = texto;
    css(b, "appearance:none;font:700 15px system-ui,sans-serif;min-height:44px;padding:0 16px;border-radius:999px;cursor:pointer;" +
      (principal ? "border:0;background:#ffcf8a;color:#14110d" : "border:1px solid rgba(243,237,226,.3);background:transparent;color:#f3ede2"));
    return b;
  }
  function aviso(texto, botones) {
    var caja = css(document.createElement("div"), "position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483000;" +
      "display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 24px);padding:10px 12px 10px 18px;border-radius:18px;" +
      "background:#14171f;color:#f3ede2;font:15px/1.35 system-ui,sans-serif;box-shadow:0 18px 40px -12px rgba(0,0,0,.6);border:1px solid rgba(243,237,226,.14)");
    caja.setAttribute("role", "status"); caja.setAttribute("aria-live", "polite");
    var t = document.createElement("span"); t.textContent = texto; caja.appendChild(t);
    botones.forEach(function (b) { caja.appendChild(b); });
    document.body.appendChild(caja);
    return caja;
  }

  /* --- versión nueva --- */
  var pedido = false;
  function avisoVersion(reg) {
    if (!reg.waiting || document.getElementById("tsapc-nueva-version")) return;
    var act = boton("Actualizar", true), luego = boton("Luego", false);
    var caja = aviso("Hay una versión nueva. Actualiza cuando termines lo que estás haciendo: la página se recarga.", [act, luego]); caja.id = "tsapc-nueva-version";
    act.addEventListener("click", function () {
      pedido = true; act.disabled = true; act.textContent = "Actualizando…";
      var w = reg.waiting; if (!w) { location.reload(); return; }
      /* tres caminos para recargar, por si alguno no llega: controllerchange, el estado del nuevo worker o 4 s */
      w.addEventListener("statechange", function () { if (w.state === "activated" && pedido) { pedido = false; location.reload(); } });
      setTimeout(function () { if (pedido) { pedido = false; location.reload(); } }, 4000);
      w.postMessage({ type: "SKIP_WAITING" });
    });
    luego.addEventListener("click", function () { caja.remove(); });
  }
  if (ok) {
    /* solo se recarga si la persona pulsó «Actualizar» (la primera instalación no recarga nada) */
    navigator.serviceWorker.addEventListener("controllerchange", function () { if (pedido) { pedido = false; location.reload(); } });
    alCargar(function () {
      navigator.serviceWorker.register(new URL("sw.js", base).href).then(function (reg) {
        if (reg.waiting && (navigator.serviceWorker.controller || reg.active)) avisoVersion(reg);
        reg.addEventListener("updatefound", function () {
          var w = reg.installing; if (!w) return;
          w.addEventListener("statechange", function () { if (w.state === "installed" && navigator.serviceWorker.controller) avisoVersion(reg); });
        });
        setInterval(function () { reg.update().catch(function () {}); }, 60 * 60 * 1000);
      }).catch(function () {});
    });
  }

  /* --- que el navegador no borre el progreso (solo si ya hay algo guardado) --- */
  try {
    if (navigator.storage && navigator.storage.persist && localStorage.length > 0) {
      navigator.storage.persisted().then(function (p) { if (!p) return navigator.storage.persist(); }).catch(function () {});
    }
  } catch (e) {}

  /* --- iPhone: cómo añadirla a la pantalla de inicio (una sola vez) --- */
  try {
    var ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var app = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
    var CLAVE = "tsapc:aviso-iphone";
    var portada = location.pathname === base.pathname || location.pathname === base.pathname + "index.html";
    if (ios && !app && portada && !localStorage.getItem(CLAVE)) {
      alCargar(function () {
        setTimeout(function () {
          if (document.getElementById("tsapc-nueva-version")) return;
          var vale = boton("Entendido", true);
          try { localStorage.setItem(CLAVE, "1"); } catch (e) {}   /* sale una sola vez */
          var caja = aviso("Úsala como una app: pulsa Compartir y luego «Añadir a pantalla de inicio». Así el iPhone no borra tu progreso.", [vale]);
          vale.addEventListener("click", function () { caja.remove(); });
        }, 2500);
      });
    }
  } catch (e) {}
})();
