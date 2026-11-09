/* Corte · repetición espaciada sencilla (SM-2) para las tarjetas. Lógica pura. Navegador: window.CorteSM2. Node: module.exports.
   Tres botones: «Otra vez» (calidad 1), «Bien» (4) y «Fácil» (5).
   Las cajas Leitner de ingles1 (0 Nueva · 1 Aprendiendo · 2 Casi · 3 La sabes) salen de los aciertos seguidos (rep):
   «Dominada» = 3 aciertos seguidos, nunca una casilla. Estado por tarjeta: {ef, rep, int, due, ok, ko, ult}. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CorteSM2 = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var CALIDAD = { otra: 1, bien: 4, facil: 5 };
  var CAJAS = ["Nueva", "Aprendiendo", "Casi", "La sabes"];
  var DOMINADA = 3;
  var tiene = function (o, k) { return o !== null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k); };

  function dia(d) { var x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
  function sumarDias(clave, n) { var p = clave.split("-"); return dia(new Date(+p[0], +p[1] - 1, +p[2] + n)); }

  function nuevo() { return { ef: 2.5, rep: 0, int: 0, due: null, ok: 0, ko: 0, ult: null, ini: null }; }
  /* Estado inicial desde una caja Leitner antigua (solo se lee): caja b → b aciertos seguidos, toca hoy. */
  function desdeCaja(b, hoy) { var e = nuevo(); b = Math.max(0, Math.min(3, +b || 0)); if (b > 0) { e.rep = b; e.int = [0, 1, 3, 7][b]; e.due = hoy; } return e; }

  /* Puntúa una tarjeta. resp: "otra" | "bien" | "facil". hoy: "AAAA-MM-DD". Devuelve el estado nuevo (no toca el de entrada). */
  function puntuar(estado, resp, hoy) {
    var q = CALIDAD[resp]; if (!q) throw new Error("respuesta no válida: " + resp);
    var e = nuevo(), k; if (estado) for (k in estado) if (tiene(estado, k)) e[k] = estado[k];
    e.ef = Math.max(1.3, Math.round((e.ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)) * 100) / 100);
    if (q < 3) { e.rep = 0; e.int = 0; e.ko++; e.due = hoy; }          /* vuelve hoy, al final de la sesión */
    else {
      e.ok++;
      e.int = e.rep === 0 ? (q === 5 ? 3 : 1) : e.rep === 1 ? (q === 5 ? 8 : 6) : Math.round(e.int * e.ef * (q === 5 ? 1.3 : 1));
      e.rep++;
      e.due = sumarDias(hoy, e.int);
    }
    e.ult = hoy; if (!e.ini) e.ini = hoy;
    return e;
  }
  /* Próximo intervalo de cada botón, para enseñarlo bajo el botón. */
  function previsto(estado, hoy) { return { otra: 0, bien: puntuar(estado, "bien", hoy).int, facil: puntuar(estado, "facil", hoy).int }; }

  function caja(e) { return e ? Math.min(3, e.rep || 0) : 0; }
  function dominada(e) { return !!e && (e.rep || 0) >= DOMINADA; }
  function vencida(e, hoy) { return !!e && !!e.due && e.due <= hoy; }

  /* Tarjetas que tocan hoy: primero las vencidas (las más atrasadas antes), luego hasta `nuevas` sin estudiar, en su orden. */
  var NUEVAS_DIA = 15;
  /* nuevas que aún caben hoy: el tope diario menos las que se empezaron hoy */
  function nuevasRestantes(estados, hoy, tope) { var n = 0; for (var k in estados) if (tiene(estados, k) && estados[k] && estados[k].ini === hoy) n++; return Math.max(0, (tope == null ? NUEVAS_DIA : tope) - n); }
  function paraHoy(tarjetas, estados, hoy, nuevas) {
    estados = estados || {}; nuevas = nuevas == null ? nuevasRestantes(estados, hoy) : nuevas;
    var venc = [], sin = [];
    tarjetas.forEach(function (t) { var e = tiene(estados, t.id) ? estados[t.id] : null; if (e && e.due) { if (e.due <= hoy) venc.push(t); } else sin.push(t); });
    venc.sort(function (a, b) { return estados[a.id].due < estados[b.id].due ? -1 : estados[a.id].due > estados[b.id].due ? 1 : 0; });
    return venc.concat(sin.slice(0, nuevas));
  }
  /* Solo las vencidas (lo que avisa «Hoy»). */
  function pendientes(estados, hoy) { var n = 0; for (var k in estados) if (tiene(estados, k) && vencida(estados[k], hoy)) n++; return n; }
  function recuento(tarjetas, estados) {
    var r = { total: tarjetas.length, cajas: [0, 0, 0, 0], dominadas: 0 };
    tarjetas.forEach(function (t) { var e = estados && tiene(estados, t.id) ? estados[t.id] : null; r.cajas[caja(e)]++; if (dominada(e)) r.dominadas++; });
    return r;
  }

  return { NUEVAS_DIA: NUEVAS_DIA, nuevasRestantes: nuevasRestantes, CALIDAD: CALIDAD, CAJAS: CAJAS, DOMINADA: DOMINADA, dia: dia, sumarDias: sumarDias, nuevo: nuevo, desdeCaja: desdeCaja, puntuar: puntuar, previsto: previsto,
    caja: caja, dominada: dominada, vencida: vencida, paraHoy: paraHoy, pendientes: pendientes, recuento: recuento };
});
