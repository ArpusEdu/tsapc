/* cielo.js · el cielo de Pamplona calculado en el dispositivo, sin red.
   Cálculo puro (sin DOM): lo usan el centro 3D, el pasillo ilustrado y tests/cielo.test.mjs.
   - Sol: posición con las ecuaciones de la NOAA (Meeus simplificado): declinación, ecuación del tiempo,
     ángulo horario; altura con refracción atmosférica. Salida, puesta y crepúsculos por el ángulo horario
     del cénit buscado (90,833°, 96°, 102°) con dos pasadas para afinar.
   - Luna: longitud y latitud eclípticas con los términos principales (error ~1°), tiempo sidéreo
     para la posición y elongación respecto al Sol para la fase.
   - Paleta: colores del cielo, de la luz y de la niebla interpolados de forma continua por la altura del sol.
   - Temporada: el paisaje según el día del año, con transiciones suaves.
   - Tiempo: traduce los códigos WMO de Open-Meteo a lo que se pinta y a una línea de texto.
   Implementación propia: no copia ninguna librería. */

export const PAMPLONA = { lat: 42.8125, lon: -1.6458, tz: 'Europe/Madrid' };
const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const sin = (d) => Math.sin(d * RAD), cos = (d) => Math.cos(d * RAD);
const norm360 = (x) => ((x % 360) + 360) % 360;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const jd = (ms) => ms / 86400000 + 2440587.5;

/* --- Sol (NOAA) --- */
function solar(ms) {
  const T = (jd(ms) - 2451545) / 36525;
  const L0 = norm360(280.46646 + T * (36000.76983 + T * 0.0003032));
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + sin(2 * M) * (0.019993 - 0.000101 * T) + sin(3 * M) * 0.000289;
  const om = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * sin(om);
  const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * cos(om);
  const decl = Math.asin(sin(eps) * sin(lambda)) * DEG;
  const y = Math.tan(eps / 2 * RAD) ** 2;
  const eot = 4 * DEG * (y * sin(2 * L0) - 2 * e * sin(M) + 4 * e * y * sin(M) * cos(2 * L0) - 0.5 * y * y * sin(4 * L0) - 1.25 * e * e * sin(2 * M));
  return { decl, eot, lambda };
}
function refraccion(alt) {
  if (alt > 85) return 0;
  const te = Math.tan(alt * RAD);
  let r;
  if (alt > 5) r = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
  else if (alt > -0.575) r = 1735 + alt * (-518.2 + alt * (103.4 + alt * (-12.79 + alt * 0.711)));
  else r = -20.772 / te;
  return r / 3600;
}
/** Altura y azimut del sol (grados; azimut desde el norte, en sentido horario). */
export function sol(fecha, lat = PAMPLONA.lat, lon = PAMPLONA.lon) {
  const ms = +fecha, { decl, eot } = solar(ms);
  const d = new Date(ms), minUTC = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  const tst = ((minUTC + eot + 4 * lon) % 1440 + 1440) % 1440;
  const ha = tst / 4 - 180;
  const cz = clamp(sin(lat) * sin(decl) + cos(lat) * cos(decl) * cos(ha), -1, 1);
  const zen = Math.acos(cz) * DEG, alt0 = 90 - zen;
  let az = Math.atan2(sin(ha), cos(ha) * sin(lat) - Math.tan(decl * RAD) * cos(lat)) * DEG + 180;
  return { alt: alt0 + refraccion(alt0), altGeo: alt0, az: norm360(az), decl };
}

/* --- fechas en la zona de Pamplona --- */
const fmtCache = {};
function partes(ms, tz = PAMPLONA.tz) {
  const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const o = {}; for (const p of f.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = +p.value;
  return { y: o.year, m: o.month, d: o.day, h: o.hour % 24, mi: o.minute, s: o.second };
}
/** Desfase de la zona respecto a UTC en minutos (CET 60, CEST 120). */
export function desfase(ms, tz = PAMPLONA.tz) {
  const p = partes(ms, tz);
  return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000) / 60000);
}
/** Instante de una fecha y hora de reloj en Pamplona. */
export function instanteLocal(y, m, d, h = 12, mi = 0, tz = PAMPLONA.tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let ms = guess - desfase(guess, tz) * 60000;
  ms = guess - desfase(ms, tz) * 60000;
  return new Date(ms);
}
/** Día (y, m, d) y hora de reloj de un instante en Pamplona. */
export function relojLocal(fecha, tz = PAMPLONA.tz) { return partes(+fecha, tz); }
export function hhmm(fecha, tz = PAMPLONA.tz) { if (!fecha) return '—'; const p = partes(+fecha, tz); return String(p.h).padStart(2, '0') + ':' + String(p.mi).padStart(2, '0'); }

/* hora UTC (minutos desde la medianoche UTC del día) en que el centro del sol cruza el cénit dado */
function cruce(y, m, d, zenit, manana, lat, lon) {
  const base = Date.UTC(y, m - 1, d);
  let t = 720 - 4 * lon;                          // primera aproximación: mediodía solar
  for (let i = 0; i < 3; i++) {
    const { decl, eot } = solar(base + t * 60000);
    const c = cos(zenit) / (cos(lat) * cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl * RAD);
    if (c > 1 || c < -1) return null;               // ese día no se alcanza
    const ha = Math.acos(c) * DEG * (manana ? 1 : -1);
    t = 720 - 4 * (lon + ha) - eot;
  }
  return new Date(base + t * 60000);
}
/** Horas del sol para el día (en Pamplona) que contiene `fecha`. */
export function horasSol(fecha, lat = PAMPLONA.lat, lon = PAMPLONA.lon) {
  const p = partes(+fecha), a = (z, mn) => cruce(p.y, p.m, p.d, z, mn, lat, lon);
  const base = Date.UTC(p.y, p.m - 1, p.d);
  const { eot } = solar(base + (720 - 4 * lon) * 60000);
  return {
    nauticoIni: a(102, true), civilIni: a(96, true), salida: a(90.833, true), doradaFinManana: a(84, true),
    mediodia: new Date(base + (720 - 4 * lon - eot) * 60000),
    doradaIniTarde: a(84, false), puesta: a(90.833, false), civilFin: a(96, false), nauticoFin: a(102, false)
  };
}
/** Momento del día con nombre: noche, alba (náutico), amanecer (civil), dorada, día. */
export function momento(alt) {
  if (alt < -12) return 'noche';
  if (alt < -6) return 'alba';
  if (alt < -0.833) return 'crepusculo';
  if (alt < 6) return 'dorada';
  return 'dia';
}

/* --- Luna --- */
export function luna(fecha, lat = PAMPLONA.lat, lon = PAMPLONA.lon) {
  const ms = +fecha, d = jd(ms) - 2451545;
  const L = 218.316 + 13.176396 * d, M = 134.963 + 13.064993 * d, F = 93.272 + 13.22935 * d;
  const D = 297.850 + 12.190749 * d, Ms = 357.529 + 0.98560028 * d;
  const l = L + 6.289 * sin(M) + 1.274 * sin(2 * D - M) + 0.658 * sin(2 * D) + 0.214 * sin(2 * M) - 0.186 * sin(Ms) - 0.114 * sin(2 * F);
  const b = 5.128 * sin(F) + 0.28 * sin(M + F) + 0.277 * sin(M - F);
  const e = 23.4397;
  const ra = Math.atan2(sin(l) * cos(e) - Math.tan(b * RAD) * sin(e), cos(l)) * DEG;
  const dec = Math.asin(clamp(sin(b) * cos(e) + cos(b) * sin(e) * sin(l), -1, 1)) * DEG;
  const gmst = 280.46061837 + 360.98564736629 * d;
  const H = gmst + lon - ra;
  const alt = Math.asin(clamp(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H), -1, 1)) * DEG;
  const az = norm360(Math.atan2(sin(H), cos(H) * sin(lat) - Math.tan(dec * RAD) * cos(lat)) * DEG + 180);
  const ls = solar(ms).lambda;
  const fase = norm360(l - ls) / 360;                      // 0 nueva · 0,25 cuarto creciente · 0,5 llena · 0,75 menguante
  const ilum = (1 - Math.cos(fase * 2 * Math.PI)) / 2;
  return { alt, az, fase, ilum, nombre: nombreFase(fase) };
}
export function nombreFase(f) {
  const n = ['luna nueva', 'creciente', 'cuarto creciente', 'gibosa creciente', 'luna llena', 'gibosa menguante', 'cuarto menguante', 'menguante'];
  return n[Math.round(norm360(f * 360) / 45) % 8];
}

/* --- colores --- */
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const aHex = (c) => '#' + c.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function tramo(tabla, x) {
  if (x <= tabla[0][0]) return tabla[0][1];
  for (let i = 1; i < tabla.length; i++) if (x <= tabla[i][0]) { const [x0, a] = tabla[i - 1], [x1, b] = tabla[i]; const t = (x - x0) / (x1 - x0); return Array.isArray(a) ? lerp3(a, b, t) : lerp(a, b, t); }
  return tabla[tabla.length - 1][1];
}
const K = (pares) => pares.map(([x, h]) => [x, typeof h === 'string' ? hex(h) : h]);
/* claves por altura del sol (grados): cénit, horizonte, color del sol, luz ambiente */
const ZEN = K([[-18, '#060b1a'], [-12, '#0a1128'], [-6, '#172452'], [-3, '#28386f'], [0, '#3b5290'], [4, '#4766a8'], [10, '#4b78bd'], [25, '#3f78c6'], [60, '#2e6ac4']]);
const HOR = K([[-18, '#141b30'], [-12, '#1c2442'], [-6, '#4a3f6c'], [-3, '#b0607a'], [0, '#f08a5a'], [3, '#ffad72'], [8, '#f4c99e'], [20, '#bcd3ea'], [60, '#a9c9ee']]);
const SOLC = K([[-6, '#ff5a2a'], [0, '#ff7a36'], [3, '#ff9a4c'], [8, '#ffc27e'], [20, '#ffe8c8'], [40, '#fff6ea'], [70, '#ffffff']]);
const AMB = K([[-18, '#141a30'], [-8, '#1e2648'], [-3, '#4a3e62'], [0, '#7a6476'], [6, '#9aa0b4'], [20, '#b6c4d8'], [60, '#c4d2e4']]);
const LUZ = [[-12, 0], [-6, 0.02], [-2, 0.12], [0, 0.3], [4, 0.6], [10, 0.85], [25, 1], [90, 1.05]];
const AMBI = [[-18, 0.06], [-12, 0.09], [-6, 0.2], [0, 0.42], [6, 0.7], [20, 0.92], [60, 1]];
const EXPO = [[-18, 0.82], [-6, 0.88], [0, 0.95], [10, 1.0], [40, 1.04]];
/**
 * Paleta continua para una altura del sol. `nubes` (0..1) y `niebla` (0..1) agrisan y oscurecen.
 * Devuelve colores [r,g,b] en sRGB 0..1.
 */
export function paleta(alt, { nubes = 0, niebla = 0, verano = 0, lunaIlum = 0, lunaAlt = -90 } = {}) {
  let zen = tramo(ZEN, alt), hor = tramo(HOR, alt), solC = tramo(SOLC, alt), amb = tramo(AMB, alt);
  let luz = tramo(LUZ, alt), ambI = tramo(AMBI, alt), expo = tramo(EXPO, alt);
  /* verano: luz dura, más blanca y con el cielo más profundo */
  if (verano > 0 && alt > 10) { const v = verano * clamp((alt - 10) / 30); zen = lerp3(zen, hex('#2a62c2'), v * 0.5); solC = lerp3(solC, [1, 1, 1], v * 0.6); luz *= 1 + 0.12 * v; ambI *= 1 - 0.1 * v; expo += 0.03 * v; }
  /* noche con luna: un poco de luz fría */
  const ln = clamp((lunaAlt + 2) / 20) * lunaIlum * clamp((-alt - 4) / 8);
  if (ln > 0) { amb = lerp3(amb, hex('#3a4a72'), 0.35 * ln); ambI += 0.06 * ln; zen = lerp3(zen, hex('#0d1630'), 0.5 * ln); hor = lerp3(hor, hex('#1d2a4a'), 0.4 * ln); }
  /* cubierto: gris uniforme, menos luz directa */
  const g = clamp(nubes * 0.85 + niebla);
  if (g > 0) {
    const gris = (c, k) => { const l = lum(c) * k; return lerp3(c, [l * 0.98, l, l * 1.04], g * 0.9); };
    zen = gris(lerp3(zen, hor, g * 0.6), 1.05); hor = gris(hor, 1.0); solC = lerp3(solC, [lum(solC), lum(solC), lum(solC)], g * 0.6); amb = gris(amb, 1);
    luz *= 1 - 0.8 * g; ambI *= 1 - 0.15 * g; expo -= 0.04 * g;
  }
  const niebla0 = lerp3(hor, amb, 0.35);
  return { zen, hor, sol: solC, amb, niebla: niebla0, luz, ambI, expo, noche: clamp((-alt - 4) / 10) };
}

/* --- temporada --- */
function diaDelAnio(p) { return (Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(p.y, 0, 1)) / 86400000 + 1; }
/* claves por día del año: hojas (cantidad y color), flor, campo (la cuenca: cereal verde, dorado, rastrojo, labrado) y nieve posible */
const T_HOJAS = [[0, 0.02], [60, 0.04], [85, 0.25], [105, 0.6], [135, 0.95], [260, 1], [290, 0.85], [310, 0.55], [330, 0.22], [350, 0.04], [366, 0.02]];
const T_HOJAC = K([[0, '#6a5a3a'], [80, '#a8c860'], [110, '#8cc04c'], [140, '#5d9438'], [190, '#3f6e2c'], [240, '#4d6a2c'], [270, '#7a7a30'], [290, '#c8892e'], [310, '#c0682a'], [335, '#8a4a26'], [366, '#6a5a3a']]);
const T_FLOR = [[0, 0], [70, 0], [90, 0.6], [110, 1], [130, 0.4], [150, 0], [366, 0]];
const T_CAMPO = K([[0, '#5a6a44'], [60, '#62803e'], [110, '#79a846'], [150, '#8aa846'], [172, '#c2a456'], [200, '#cfae66'], [240, '#bc9a62'], [265, '#8c6c4a'], [300, '#7a6242'], [330, '#6a6a44'], [366, '#5a6a44']]);
const T_NIEVE = [[0, 0.75], [40, 0.8], [75, 0.5], [105, 0.2], [130, 0], [320, 0], [340, 0.35], [366, 0.75]];
const T_VERANO = [[0, 0], [140, 0], [172, 0.9], [215, 1], [250, 0.4], [270, 0], [366, 0]];
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** Estado del paisaje para un día. `nieve` es 0..1: cota de nieve en los montes (a veces, en invierno). */
export function temporada(fecha) {
  const p = partes(+fecha), dy = diaDelAnio(p);
  const nombre = dy < 79 || dy >= 355 ? 'invierno' : dy < 172 ? 'primavera' : dy < 265 ? 'verano' : 'otono';
  const posible = tramo(T_NIEVE, dy);
  /* «a veces»: tramos de 4 días con o sin nieve, siempre igual para la misma fecha */
  const tramoN = Math.floor((Date.UTC(p.y, p.m - 1, p.d) / 86400000) / 4);
  const hay = hash(tramoN) < posible;
  const caen = dy > 280 && dy < 340;                        // otoño: hojas cayendo
  const petalos = dy > 85 && dy < 130;
  return {
    nombre, dia: dy,
    hojas: tramo(T_HOJAS, dy), colorHoja: tramo(T_HOJAC, dy), flor: tramo(T_FLOR, dy), campo: tramo(T_CAMPO, dy),
    nieve: hay ? clamp(0.35 + posible * 0.6) : 0, caen, petalos, verano: tramo(T_VERANO, dy)
  };
}

/* --- tiempo (Open-Meteo, códigos WMO) --- */
export const URL_TIEMPO = 'https://api.open-meteo.com/v1/forecast?latitude=42.8125&longitude=-1.6458&current=weather_code,cloud_cover,precipitation,rain,snowfall,wind_speed_10m,is_day,temperature_2m&timezone=Europe%2FMadrid';
export const ESPERA_TIEMPO = 20 * 60 * 1000;      // no se vuelve a consultar antes de 20 min
export const CADUCA_TIEMPO = 12 * 3600 * 1000;    // una respuesta de hace más de 12 h ya no describe el cielo
/** Reduce la respuesta de Open-Meteo a lo que se guarda (sin nada personal). */
export function resumirTiempo(json) {
  const c = json && json.current; if (!c || typeof c.weather_code !== 'number') return null;
  const n = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  return { code: c.weather_code, nubes: n(c.cloud_cover), prec: n(c.precipitation), lluvia: n(c.rain), nieve: n(c.snowfall), viento: n(c.wind_speed_10m), dia: c.is_day === 1 ? 1 : c.is_day === 0 ? 0 : null, temp: n(c.temperature_2m), hora: typeof c.time === 'string' ? c.time : null };
}
/** Qué se pinta: tipo, intensidad (0..1), nubes (0..1), niebla (0..1), viento (km/h) y texto. */
export function interpretarTiempo(t) {
  const out = { tipo: 'despejado', intensidad: 0, nubes: 0.08, niebla: 0, viento: 8, tormenta: false, texto: 'despejado' };
  if (!t) return out;
  const c = t.code;
  const cov = t.nubes != null ? clamp(t.nubes / 100) : null;
  out.viento = t.viento != null ? t.viento : 8;
  const set = (tipo, int, nub, texto) => { out.tipo = tipo; out.intensidad = int; out.nubes = cov != null ? Math.max(cov, nub * 0.8) : nub; out.texto = texto; };
  if (c === 0) set('despejado', 0, 0.05, 'despejado');
  else if (c === 1) set('nubes', 0, 0.22, 'casi despejado');
  else if (c === 2) set('nubes', 0, 0.5, 'nubes y claros');
  else if (c === 3) set('nubes', 0, 0.95, 'cubierto');
  else if (c === 45 || c === 48) { set('niebla', 0, 0.9, c === 48 ? 'niebla con escarcha' : 'niebla'); out.niebla = 1; }
  else if (c >= 51 && c <= 57) { set('llovizna', c === 51 || c === 56 ? 0.3 : c === 53 ? 0.45 : 0.6, 0.9, 'lloviznando'); out.niebla = 0.25; }
  else if (c === 61 || c === 80) set('lluvia', 0.45, 0.92, 'lloviendo');
  else if (c === 63 || c === 81) set('lluvia', 0.7, 0.95, 'lloviendo');
  else if (c === 65 || c === 82) set('lluvia', 1, 1, 'lloviendo fuerte');
  else if (c === 66 || c === 67) set('lluvia', 0.6, 0.95, 'lluvia helada');
  else if (c === 71 || c === 85) set('nieve', 0.45, 0.95, 'nevando');
  else if (c === 73) set('nieve', 0.7, 0.97, 'nevando');
  else if (c === 75 || c === 86) set('nieve', 1, 1, 'nevando fuerte');
  else if (c === 77) set('nieve', 0.35, 0.9, 'cayendo cinarra');
  else if (c >= 95) { set('lluvia', c === 95 ? 0.75 : 1, 1, c === 95 ? 'tormenta' : 'tormenta con granizo'); out.tormenta = true; }
  else if (cov != null) set(cov > 0.85 ? 'nubes' : cov > 0.15 ? 'nubes' : 'despejado', 0, cov, cov > 0.85 ? 'cubierto' : cov > 0.15 ? 'nubes y claros' : 'despejado');
  /* lo medido manda sobre el código cuando hay precipitación real */
  if (out.tipo !== 'nieve' && (t.nieve || 0) > 0.05) { out.tipo = 'nieve'; out.intensidad = Math.max(out.intensidad, clamp(t.nieve / 1.5, 0.35, 1)); out.texto = 'nevando'; }
  if (out.tipo === 'lluvia' || out.tipo === 'llovizna') out.intensidad = Math.max(out.intensidad, clamp((t.lluvia || t.prec || 0) / 4, 0, 1));
  return out;
}
/** «Pamplona · 14 °C · lloviznando» (sin temperatura si no viene). */
export function lineaTiempo(t, interp = interpretarTiempo(t)) {
  const partes0 = ['Pamplona'];
  if (t && typeof t.temp === 'number') partes0.push(String(Math.round(t.temp)).replace('-', '−') + ' °C');
  partes0.push(interp.texto);
  return partes0.join(' · ');
}
/** ¿Toca consultar? Solo si no hay nada guardado o tiene 20 min o más. */
export function tocaConsultar(guardado, ahoraMs) {
  return !guardado || typeof guardado.t !== 'number' || !(ahoraMs - guardado.t < ESPERA_TIEMPO) || guardado.t > ahoraMs + 60000;
}
/** Lo guardado sirve si existe y no es demasiado viejo. */
export function tiempoVigente(guardado, ahoraMs) {
  return guardado && typeof guardado.t === 'number' && guardado.d && ahoraMs - guardado.t < CADUCA_TIEMPO ? guardado.d : null;
}
/**
 * Consulta Open-Meteo con caché de 20 min. Dependencias inyectadas para poder probarlo:
 * leer() → lo guardado · escribir(v) · fetch · ahora() ms. Nunca lanza: si falla, lo último guardado.
 */
export async function obtenerTiempo({ leer, escribir, fetch: f, ahora = Date.now, espera = 6000 }) {
  const g = leer(), t0 = ahora();
  if (!tocaConsultar(g, t0)) return { datos: tiempoVigente(g, t0), origen: 'guardado' };
  try {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), espera) : null;
    const r = await f(URL_TIEMPO, { signal: ctl && ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    if (tm) clearTimeout(tm);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = resumirTiempo(await r.json()); if (!d) throw new Error('respuesta rara');
    escribir({ t: t0, d });
    return { datos: d, origen: 'red' };
  } catch (e) {
    return { datos: tiempoVigente(g, t0), origen: 'sin-red' };
  }
}

/* --- pruebas: ?hoy=AAAA-MM-DD, ?hora=HH:MM y ?tiempo=lluvia|nieve|niebla|nubes|despejado|tormenta|llovizna --- */
export function instantePrueba(search, ahoraMs = Date.now()) {
  const h = /[?&]hoy=(\d{4})-(\d\d)-(\d\d)/.exec(search || ''), m = /[?&]hora=(\d{1,2}):(\d\d)/.exec(search || '');
  if (!h && !m) return new Date(ahoraMs);
  const p = partes(ahoraMs);
  const [y, mo, d] = h ? [+h[1], +h[2], +h[3]] : [p.y, p.m, p.d];
  const [hh, mi] = m ? [+m[1], +m[2]] : h ? [17, 0] : [p.h, p.mi];
  return instanteLocal(y, mo, d, hh, mi);
}
const FALSOS = { despejado: 0, nubes: 2, cubierto: 3, niebla: 45, llovizna: 53, lluvia: 63, nieve: 73, tormenta: 95 };
export function tiempoPrueba(search) {
  const m = /[?&]tiempo=([a-z]+)/.exec(search || ''); if (!m || !(m[1] in FALSOS)) return null;
  const code = FALSOS[m[1]];
  return { code, nubes: code === 0 ? 5 : code === 2 ? 50 : 95, prec: code >= 51 ? 1.2 : 0, lluvia: code >= 51 && code < 70 || code === 95 ? 1.2 : 0, nieve: code === 73 ? 1 : 0, viento: 14, dia: null, temp: code === 73 ? -1 : 12, hora: null };
}

/* --- el horizonte de Pamplona, estilizado ---
   Altura aparente (grados, exagerada ×2,5 para que se lea) por azimut desde la cuenca.
   lejos: Pirineo (N-NE, con nieve), Leyre e Izco (E), Montejurra y Codés (OSO), Urbasa y Andía (O), Aralar (NO).
   medio: Ezkaba con su fuerte (N), Aranguren (E), Higa de Monreal (SE, el cono), Alaiz y el Perdón (S y SO, con molinos), Sarbil (O).
   cerca: las lomas de la cuenca. */
const bump = (az, c, w, h, k = 2) => { let d = Math.abs(((az - c + 540) % 360) - 180) / w; return d >= 1 ? 0 : h * (1 - d ** k); };
const ruido = (az, s, a) => a * (0.5 * Math.sin(az * 0.21 * s + 1.3) + 0.3 * Math.sin(az * 0.53 * s + 0.4) + 0.2 * Math.sin(az * 1.37 * s + 2.2));
const MONTES = {
  lejos: [[30, 26, 7.5], [52, 22, 9.5], [72, 16, 6.5], [10, 16, 6], [98, 16, 4.4, 1.4], [250, 12, 4.2], [262, 9, 3.6], [292, 18, 5.2, 4], [326, 16, 6.4], [346, 12, 5]],
  medio: [[6, 13, 5.8, 3], [112, 14, 3.4], [128, 8, 8.6, 1.15], [182, 26, 5.6, 3], [228, 26, 7.2, 3], [298, 22, 5.4, 2], [70, 30, 2.2]],
  cerca: [[150, 40, 2.2], [210, 34, 2.6], [260, 30, 2.0], [100, 30, 1.8], [330, 50, 2.4], [30, 40, 1.6]]
};
export function perfil(capa, az) {
  const B = MONTES[capa]; let h = 0;
  for (const [c, w, a, k] of B) h = Math.max(h, bump(az, c, w, a, k || 2));
  if (capa === 'lejos') return Math.max(0, h + ruido(az, 1.8, 0.9) * (0.3 + h / 10));
  if (capa === 'medio') return Math.max(0, h + ruido(az, 2.6, 0.55) * (0.4 + h / 12) + 0.6);
  return Math.max(0, h + ruido(az, 4.2, 0.35) + 0.9);
}
/** Molinos de viento en las crestas del Perdón y de Alaiz: azimut y altura de la cresta. */
export function molinos() {
  const out = [];
  for (let a = 210; a <= 246; a += 2.4) out.push(a);
  for (let a = 168; a <= 196; a += 2.8) out.push(a);
  return out.map((a) => [a, perfil('medio', a)]);
}

/** Todo junto para un instante y un tiempo: lo que necesitan el 3D y el 2D. */
export function estadoCielo(fecha, tiempo = null) {
  const s = sol(fecha), l = luna(fecha), temp = temporada(fecha), w = interpretarTiempo(tiempo);
  if (tiempo && typeof tiempo.temp === 'number' && tiempo.temp <= 1 && temp.nieve < 0.5 && (temp.nombre === 'invierno' || temp.nombre === 'otono')) temp.nieve = Math.max(temp.nieve, 0.45);
  if (w.tipo === 'nieve') temp.nieve = 1;
  const pal = paleta(s.alt, { nubes: w.nubes, niebla: w.niebla, verano: temp.verano, lunaIlum: l.ilum, lunaAlt: l.alt });
  return { fecha: new Date(+fecha), sol: s, luna: l, temporada: temp, tiempo: w, datos: tiempo, paleta: pal, momento: momento(s.alt), horas: horasSol(fecha) };
}
