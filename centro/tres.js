/* =========================================================
   3D: un solo renderer, render bajo demanda, una sala viva a la vez.
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as CI from './cielo.js';

await window.MCready;
const MC = window.MC, gsap = await window.cargarGsap();
if (!gsap) throw new Error('sin GSAP');
const D = document, $ = s => D.querySelector(s), html = D.documentElement;
/* el pasillo se monta a trozos: entre trozo y trozo el hilo queda libre (toques, pintura) */
const ceder = () => (window.scheduler && scheduler.yield) ? scheduler.yield() : new Promise(r => setTimeout(r, 0));

if (!MC.flat) main().catch(err => {
  console.warn('[3D] se usa el pasillo ilustrado:', err && err.message);
  if (!MC.flat) { MC.goFlat(); MC.flat = true; }
  html.classList.add('ready');
});

async function main() {
const MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
let W = innerWidth, H = innerHeight;
const SUBJ = MC.SUBJ, UNITS = MC.UNITS, ROOMS = MC.ROOMS;

/* ---------- fuentes antes de pintar texturas con texto ---------- */
await Promise.race([
  Promise.all(['600 60px Fraunces', '700 60px Caveat', '700 30px "Atkinson Hyperlegible"', '400 30px "Atkinson Hyperlegible"'].map(f => D.fonts.load(f))),
  new Promise(r => setTimeout(r, 1800))
]).catch(() => {});
if (MC.flat) return;

/* ---------- renderer único ---------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: 'high-performance', stencil: false });
const DPR_MAX = MOBILE ? 1.25 : 1.75;
renderer.setPixelRatio(Math.min(devicePixelRatio, DPR_MAX));
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = false; // sombras falsas con discos suaves
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
pmrem.dispose();
await ceder();
const KEEP = new Set([envTex]);

const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 80);

/* ---------- utilidades ---------- */
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const col = c => new THREE.Color(c);
const mix = (a, b, t) => col(a).lerp(col(b), t);
function std(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o }); }
function basic(color, o = {}) { return new THREE.MeshBasicMaterial({ color, ...o }); }
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; }
function box(w, h, d, mat, x, y, z, parent) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent); }
function rbox(w, h, d, r, mat, x, y, z, parent) { return mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat, x, y, z, parent); }
function cyl(rt, rb, h, mat, x, y, z, parent, seg = 24) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, parent); }
function sph(r, mat, x, y, z, parent, a = 24, b = 16) { return mesh(new THREE.SphereGeometry(r, a, b), mat, x, y, z, parent); }
function canvasTex(w, h, draw) {
  const c = D.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MOBILE ? 2 : 4;
  t.userData.redraw = fn => { fn(g, w, h); t.needsUpdate = true; };
  return t;
}
function plane(w, h, mat, x, y, z, parent) { return mesh(new THREE.PlaneGeometry(w, h), mat, x, y, z, parent); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrapText(g, text, x, y, maxW, lh) { const words = text.split(' '); let line = '', yy = y; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; } g.fillText(line, x, yy); return yy; }
function noise(g, w, h, n, a, cols) { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = a * Math.random(); g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } g.globalAlpha = 1; }
function disposeTree(root) {
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      for (const k in m) { const v = m[k]; if (v && v.isTexture && !KEEP.has(v)) v.dispose(); }
      m.dispose();
    });
  });
}
async function svgImage(svg) {
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  try { await img.decode(); } catch (e) { }
  return img;
}
/* disco de sombra falsa (compartido) */
const blobTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,.75)'); r.addColorStop(.55, 'rgba(0,0,0,.35)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
KEEP.add(blobTex);
function blob(w, d, op, x, y, z, parent) { const m = plane(w, d, basic(0x000000, { map: blobTex, transparent: true, opacity: op, depthWrite: false }), x, y, z, parent); m.rotation.x = -Math.PI / 2; m.renderOrder = 1; return m; }
const glowTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
KEEP.add(glowTex);
function glowSprite(color, size, x, y, z, parent, op = 0.6) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.set(size, size, 1); s.position.set(x, y, z); if (parent) parent.add(s); return s; }

/* ---------- el cielo de ahora (cielo.js) y la luz que entra por las ventanas ---------- */
function cieloAhora() { return CI.estadoCielo(CI.instantePrueba(location.search), window.__cieloTiempo || null); }
/* fachada al sur: azRel > 0 es sol del oeste (la luz entra hacia −x); sin sol de frente, solo luz difusa */
function luzDe(e) {
  const P = e.paleta, Wt = e.tiempo, mx = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), R = Math.PI / 180;
  const azRel = (e.sol.az - 180) * R, alt = e.sol.alt * R;
  const facing = Math.max(0, Math.min(1, (Math.cos(azRel) - 0.05) / 0.35));
  const direct = Math.max(0, Math.min(1, P.luz * (1 - Wt.nubes * 0.92) * (1 - Wt.niebla))) * facing * (e.sol.alt > 0.5 ? 1 : 0);
  const winK = Math.min(1, 0.08 + P.ambI * 0.9 + P.luz * 0.25);
  const win = mx(mx(P.hor, P.zen, 0.35), P.sol, 0.25 * P.luz), win2 = mx(win, P.amb, 0.4);
  const az2 = Math.max(-1.2, Math.min(1.2, azRel)), al2 = Math.max(alt, 0.1);
  const beam = new THREE.Vector3(-Math.sin(az2) * Math.cos(al2), -Math.sin(al2), Math.cos(az2) * Math.cos(al2)).normalize();
  return { win, win2, winK, sun: P.sol, direct, tanAlt: Math.tan(Math.max(alt, 4 * R)), sinAz: Math.sin(azRel), cosAz: Math.max(0.2, Math.cos(azRel)), sx: 0, beam, beamOp: direct + 0.1 * winK * (1 - Wt.nubes) * (1 - direct) };
}
/* colores del cielo de ahora para las ventanas de las salas (se pintan al entrar) */
function cieloHex() {
  const e = cieloAhora(), P = e.paleta, mx = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  return { zen: CI.aHex(P.zen), mid: CI.aHex(mx(P.zen, P.hor, 0.75)), low: CI.aHex(mx(P.hor, P.sol, 0.3 * P.luz)), dia: P.luz, noche: P.noche, direct: luzDe(e).direct };
}
function luzCambia(a, b) {
  const dc = (x, y) => Math.max(...x.map((v, i) => Math.abs(v - y[i])));
  return dc(a.win, b.win) > 0.03 || dc(a.sun, b.sun) > 0.04 || Math.abs(a.direct - b.direct) > 0.04 || Math.abs(a.winK - b.winK) > 0.04 || Math.abs(a.tanAlt - b.tanAlt) / b.tanAlt > 0.05 || Math.abs(a.sinAz - b.sinAz) > 0.04;
}

/* ---------- bucle bajo demanda ---------- */
let running = false, frozen = false, activeUntil = 0, last = 0, T = 0, space = null;
const NAV = MC.nav;
/* ocupado = hay una transición de navegación en curso o un «volver» pendiente */
const isBusy = () => !!NAV.trans || NAV.cancelled();
const mouse = { x: 0, y: 0 };
function kick(sec = 0.6) { activeUntil = Math.max(activeUntil, performance.now() + sec * 1000); start(); }
function start() { if (running || frozen || D.hidden) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
function anim(target, vars) { kick((vars.duration || 0.5) + (vars.delay || 0) + 0.15); return gsap.to(target, vars); }
function animTL(tl) { kick(tl.totalDuration() + 0.15); return tl; }
const rig = { x: 0, tx: 0, y: 1.6, z: 6, ly: 1.4, lz: 0, fov: 50, px: 0, py: 0, off: 0, lock: false };
let frames = 0, halfTick = 0;
/* ambiente: polvo, luz que respira y cámara que respira. Solo durante 25 s tras la última
   interacción, a 30 fps, y nunca con la pestaña oculta, el cuaderno abierto o el nivel 0. */
let ambientUntil = 0;
const RMQ = matchMedia('(prefers-reduced-motion: reduce)');
function ambientOn() { return tier > 0 && !frozen && !D.hidden && !RMQ.matches && performance.now() < ambientUntil; }
function poke() { ambientUntil = performance.now() + 25000; kick(0.1); }
let bAmp = 0;
function loop(t) {
  if (frozen || D.hidden) { running = false; return; }
  const dt = Math.min((t - last) / 1000, 0.05); last = t; T += dt;
  const k = 1 - Math.exp(-dt * 6.5);
  let moving = false;
  if (!rig.lock) { rig.x += (rig.tx - rig.x) * k; moving = Math.abs(rig.tx - rig.x) > 0.0008; }
  if (!MOBILE) { const kp = 1 - Math.exp(-dt * 3); rig.px += (mouse.x * 0.35 - rig.px) * kp; rig.py += (mouse.y * 0.18 - rig.py) * kp; if (Math.abs(mouse.x * 0.35 - rig.px) > 0.001) moving = true; }
  let idle = false;
  if (space && space.idle) idle = space.idle(T, dt, viewRange()) || false;
  if (!idle && ambientOn()) idle = 'amb';
  bAmp += ((idle && ambientOn() && !rig.lock ? 1 : 0) - bAmp) * Math.min(1, dt * 1.5);
  const half = idle === 'amb' && !moving && t >= activeUntil;
  if (half && (++halfTick & 1)) { requestAnimationFrame(loop); return; }
  const r0 = performance.now(); render(); adapt(performance.now() - r0, half ? dt / 2 : dt);
  frames++;
  if (moving || idle || t < activeUntil) requestAnimationFrame(loop); else running = false;
}
/* resolución adaptativa: si los fotogramas tardan, baja el pixelRatio (nunca sube del tope) */
/* resolución adaptativa: baja el pixelRatio si va lento, pero nunca de 0,9 (por debajo se ve borroso).
   tier: 2 escritorio, 1 móvil, 0 si ya va justo (sin polvo ni respiración). */
const DPR_MIN = 0.9, DPR_TOP = Math.max(DPR_MIN, Math.min(devicePixelRatio, DPR_MAX));
let dpr = DPR_TOP, slow = 0, fast = 0, tier = MOBILE ? 1 : 2;
function adapt(ms, dt) {
  if (dt > 0.03 || ms > 22) { slow++; fast = 0; } else if (dt < 0.019) { fast++; slow = Math.max(0, slow - 1); }
  if (slow > 12) {
    if (dpr > DPR_MIN) { dpr = Math.max(DPR_MIN, +(dpr * 0.85).toFixed(2)); renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); }
    else if (tier > 0) tier = 0;
    slow = 0;
  }
  else if (fast > 180 && dpr < DPR_TOP) { dpr = Math.min(DPR_TOP, +(dpr * 1.12).toFixed(2)); renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); fast = 0; }
}
function viewRange() { const half = Math.tan(THREE.MathUtils.degToRad(rig.fov / 2)) * Math.abs(rig.z - 0.5) * (W / H); return [rig.x - half - 0.8, rig.x + half + 0.8]; }
function render() {
  if (space && space.camera) { renderer.render(space.scene, space.camera); placeHotspots(); return; }
  const bx = Math.sin(T * 0.31) * 0.022 * bAmp, by = Math.sin(T * 0.53) * 0.012 * bAmp;
  cam.position.set(rig.x + rig.px + rig.off + bx, rig.y - rig.py + by, rig.z);
  cam.lookAt(rig.x + rig.px * 0.35 + bx * 0.4, rig.ly + Math.sin(T * 0.41) * 0.006 * bAmp, rig.lz);
  if (space && space.exposure && renderer.toneMappingExposure !== space.exposure) renderer.toneMappingExposure = space.exposure;
  if (cam.fov !== rig.fov) { cam.fov = rig.fov; cam.updateProjectionMatrix(); }
  if (space) renderer.render(space.scene, cam);
  placeHotspots();
}
function dockH() { const d = $('#dock'); return d && !D.getElementById('dock').hidden ? d.getBoundingClientRect().height + 8 : 0; }
function applyView() {
  cam.aspect = W / H;
  if (W < 760 || H < 500) { const top = (space && space !== hallRef()) ? (H < 500 ? 70 : 128) : 58, bot = H < 500 ? H : H - Math.min(dockH(), H * 0.42), cy = (top + bot) / 2; cam.setViewOffset(W, H, 0, -(cy - H / 2), W, H); }
  else cam.clearViewOffset();
  cam.updateProjectionMatrix();
}
function resize() {
  W = innerWidth; H = innerHeight;
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H, false);
  if (space && space.cfg) applyCfg(space.cfg, true);
  applyView(); hsEls.forEach(e => { e._w = 0; });
  if (space && space.onResize) space.onResize();
  kick(0.3);
}
addEventListener('resize', resize);
D.addEventListener('visibilitychange', () => { if (!D.hidden) kick(0.3); });

function freeze(b) {
  frozen = b; canvas.classList.toggle('frozen', b);
  if (!b) kick(0.4);
}

/* ---------- encuadre por espacio ---------- */
function cfgFor(c) { return MOBILE || W < 760 ? { ...c, ...(c.m || {}) } : c; }
function applyCfg(c, keepX) { const k = cfgFor(c); rig.y = k.y; rig.z = k.z; rig.ly = k.ly; rig.lz = k.lz || 0; rig.fov = k.fov; rig.off = k.off || 0; }

/* ---------- etiquetas (hotspots) y tarjeta ---------- */
const hot = $('#hot'), card = $('#card'), goBtn = $('#cardGo'), altBtn = $('#cardAlt');
let hsEls = [], si = 0;
const pv = new THREE.Vector3();
function hallRef() { return MC._hall; }
function buildHotspots() {
  hot.innerHTML = '';
  hsEls = (space.spots || []).map((s, i) => {
    const b = D.createElement('button'); b.type = 'button'; b.className = 'hs';
    b.style.setProperty('--c', s.color);
    b.innerHTML = '<span class="no" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span><span class="nm">' + s.label + '</span>';
    b.setAttribute('aria-label', s.aria || s.label);
    b.addEventListener('click', () => { if (isBusy()) return; setIndex(i); s.act(); });
    b.addEventListener('focus', () => { if (si !== i) setIndex(i); });
    /* con el ratón encima del rótulo, su puerta también se entreabre (antes se cerraba al salir del lienzo) */
    b.addEventListener('pointerenter', e => { if (e.pointerType === 'touch' || isBusy() || !space || !space.hover) return; if (hoverId && hoverId !== s.id) space.hover(hoverId, false); hoverId = s.id; space.hover(s.id, true); kick(0.4); });
    b.addEventListener('pointerleave', e => { if (e.pointerType === 'touch' || !space || !space.hover || hoverId !== s.id) return; space.hover(s.id, false); hoverId = null; kick(0.4); });
    hot.appendChild(b); return b;
  });
}
/* cada etiqueta: un punto en el objeto, una línea fina y el rótulo encima (o debajo si no cabe).
   El rótulo se desplaza en horizontal para no salirse nunca de la pantalla. */
const LEAD = () => (W < 760 || H < 500 ? 26 : 38);
function placeHotspots() {
  if (!space || !space.spots || frozen) return;
  const c = space.camera || cam;
  const rh = D.getElementById('roomHead');
  const topLim = (rh && !rh.hidden ? rh.getBoundingClientRect().bottom : 62) + 6;
  const botLim = H - (W < 760 || H < 500 ? dockH() : 0) - 6;
  const L = LEAD();
  space.spots.forEach((s, i) => {
    const el = hsEls[i]; if (!el) return;
    pv.copy(s.anchor).project(c);
    const x = (pv.x + 1) / 2 * W, y = (1 - pv.y) / 2 * H;
    if (!el._w) { el._w = el.offsetWidth; el._h = el.offsetHeight; }
    const w = el._w, h = el._h;
    if (pv.z > 1 || x < 6 || x > W - 6 || y < 64 || y > botLim) { el.classList.add('off'); return; }
    let top = y - L - h, flip = false;
    if (top < topLim) { top = y + L; flip = true; if (top + h > botLim) { el.classList.add('off'); return; } }
    const left = Math.max(8, Math.min(W - 8 - w, x - w / 2));
    el.classList.remove('off'); el.classList.toggle('flip', flip);
    el.style.setProperty('--x', left.toFixed(1) + 'px'); el.style.setProperty('--y', top.toFixed(1) + 'px');
    el.style.setProperty('--lx', (x - left).toFixed(1) + 'px'); el.style.setProperty('--L', L + 'px');
  });
}
function setIndex(i, instant) {
  const n = space.spots.length; si = Math.max(0, Math.min(n - 1, i));
  const s = space.spots[si]; rig.tx = s.x + (s.dx || 0);
  if (instant) rig.x = rig.tx;
  updateCard(); kick(0.2);
  hsEls.forEach((e, j) => { e.classList.toggle('dim', j !== si); e._w = 0; });
  if (space.onFocus) space.onFocus(s);
}
function updateCard() {
  const s = space.spots[si]; if (!s) return;
  card.style.setProperty('--c', s.color); card.style.setProperty('--ct', s.tint || s.color);
  card.dataset.n = String(si + 1).padStart(2, '0');
  $('#cardK').textContent = s.kicker; $('#cardT').textContent = s.title; $('#cardS').textContent = typeof s.sub === 'function' ? s.sub() : s.sub;
  goBtn.textContent = s.go; goBtn.style.setProperty('--c', s.btn || s.color);
  altBtn.hidden = !s.alt; if (s.alt) altBtn.textContent = s.alt[0];
  $('#prevBtn').disabled = si === 0; $('#nextBtn').disabled = si === space.spots.length - 1;
}
goBtn.addEventListener('click', () => { if (!isBusy() && space && space.spots[si]) space.spots[si].act(); });
altBtn.addEventListener('click', () => { if (!isBusy() && space && space.spots[si] && space.spots[si].alt) space.spots[si].alt[1](); });
$('#prevBtn').addEventListener('click', () => { if (!isBusy()) setIndex(si - 1); });
$('#nextBtn').addEventListener('click', () => { if (!isBusy()) setIndex(si + 1); });
setInterval(() => { if (space && space.spots && !frozen) updateCard(); }, 30000);
/* la interfaz sobre el 3D (etiquetas y tarjeta) la decide la navegación */
let uiOn = null;
function ui(b) {
  if (b === uiOn) return; uiOn = b;
  const els = ['#dock', '#hot'];
  gsap.killTweensOf(els);
  if (b) { hot.classList.remove('hide'); updateCard(); render(); gsap.set(els, { visibility: 'inherit' }); gsap.to(els, { autoAlpha: 1, duration: 0.4 }); poke(); }
  else { hot.classList.add('hide'); gsap.to(els, { autoAlpha: 0, duration: 0.2 }); if (hoverId && space && space.hover) { space.hover(hoverId, false); hoverId = null; } }
}

/* al pasar el puntero, cada objeto de sala reacciona a su manera: se eleva, gira o se inclina */
let lifted = null;
function lift(id) {
  if (lifted) { const o = lifted; gsap.to(o.position, { y: o.userData.y0, duration: 0.35, ease: 'power2.out' }); gsap.to(o.rotation, { y: o.userData.r0, z: 0, duration: 0.5, ease: 'power2.out' }); lifted = null; kick(0.6); }
  if (!id || !space || space === hallRef() || space.camera || space.hover) return;
  const o = (space.pick || []).find(g => g.userData.spot === id); if (!o) return;
  if (o.userData.y0 === undefined) { o.userData.y0 = o.position.y; o.userData.r0 = o.rotation.y; }
  const k = space.spots.findIndex(s => s.id === id) % 3;
  gsap.to(o.position, { y: o.userData.y0 + 0.035, duration: 0.4, ease: 'back.out(3)' });
  if (k === 1) gsap.to(o.rotation, { y: o.userData.r0 + 0.25, duration: 0.6, ease: 'back.out(2)' });
  if (k === 2) gsap.to(o.rotation, { z: 0.05, duration: 0.5, ease: 'back.out(3)' });
  lifted = o; kick(0.8);
}
/* ---------- tocar, arrastrar, rueda y teclado ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let down = null, hoverId = null;
function hitSpot(x, y) {
  if (!space || !space.pick) return null;
  ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, space.camera || cam);
  const h = ray.intersectObjects(space.pick, true)[0];
  if (!h) return null; let o = h.object; while (o && !o.userData.spot) o = o.parent; return o ? o.userData.spot : null;
}
function worldPerPx() { return 2 * Math.tan(THREE.MathUtils.degToRad(rig.fov / 2)) * Math.abs(rig.z) / H; }
canvas.addEventListener('pointerdown', e => { poke(); if (isBusy() || frozen) return; down = { x: e.clientX, y: e.clientY, tx: rig.tx, t: performance.now(), moved: false, lastX: e.clientX, v: 0 }; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  mouse.x = e.clientX / W - 0.5; mouse.y = e.clientY / H - 0.5;
  if (performance.now() > ambientUntil - 24000) poke();
  /* el «pasar por encima» va con cualquier ratón o lápiz, aunque la ventana sea pequeña (antes dependía de MOBILE) */
  if (!down) { if (e.pointerType !== 'touch' && space && !isBusy()) { const id = hitSpot(e.clientX, e.clientY); if (id !== hoverId) { if (space.hover) space.hover(hoverId, false); hoverId = id; if (space.hover) space.hover(id, true); canvas.style.cursor = id ? 'pointer' : 'grab'; lift(id); } kick(0.4); } return; }
  const dx = e.clientX - down.x;
  if (Math.abs(dx) > 8) down.moved = true;
  if (down.moved && space && space.spots && !space.camera) {
    const lim = space.range; rig.tx = Math.max(lim[0], Math.min(lim[1], down.tx - dx * worldPerPx()));
    down.v = e.clientX - down.lastX; down.lastX = e.clientX; kick(0.3);
  }
});
canvas.addEventListener('pointerup', e => {
  if (!down) return; const d = down; down = null;
  if (isBusy() || !space || !space.spots || !space.spots.length) return;
  if (!d.moved) { const id = hitSpot(e.clientX, e.clientY); if (id) { const i = space.spots.findIndex(s => s.id === id); if (i >= 0) { setIndex(i); space.spots[i].act(); } } return; }
  if (space.camera) return;
  // soltar: se ajusta al objeto más cercano, con inercia
  const target = rig.tx - d.v * worldPerPx() * 6;
  let best = 0, bd = 1e9; space.spots.forEach((s, i) => { const dd = Math.abs(s.x - target); if (dd < bd) { bd = dd; best = i; } });
  if (Math.abs(e.clientX - d.x) < W * 0.6) best = Math.max(si - 1, Math.min(si + 1, best));
  setIndex(best);
});
canvas.addEventListener('pointercancel', () => { down = null; });
/* al salir del lienzo (por encima de una etiqueta o de la tarjeta) la puerta se cierra */
canvas.addEventListener('pointerleave', e => {
  /* si el ratón pasa a un rótulo, el rótulo se encarga de su puerta: no se cierra aquí */
  const a = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.hs');
  if (!a && hoverId && space && space.hover) { space.hover(hoverId, false); hoverId = null; }
  canvas.style.cursor = ''; mouse.x = mouse.y = 0; kick(0.4);
});
let wheelAcc = 0, wheelT = 0;
/* la rueda funciona también encima de la tarjeta y de las etiquetas */
addEventListener('wheel', e => {
  if (e.target.closest && e.target.closest('#nb, #cyto .panel')) return;
  if (isBusy() || frozen || !space || space.camera || MC.nbOpen) return; e.preventDefault();
  const now = performance.now(); wheelAcc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(wheelAcc) > 60 && now - wheelT > 380) { setIndex(si + (wheelAcc > 0 ? 1 : -1)); wheelAcc = 0; wheelT = now; }
}, { passive: false });
addEventListener('keydown', e => {
  poke();
  if (isBusy() || frozen || !space || space.camera || MC.nbOpen) return;
  if (e.target.closest && e.target.closest('input,textarea')) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); setIndex(si + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); setIndex(si - 1); }
});

/* =========================================================
   El pasillo del centro (la entrada)
   ========================================================= */
const PLACA = {
  bio: ['Biología Molecular', 'Laboratorio de investigación'], lab: ['Laboratorio', 'Técnicas generales'], fisio: ['Fisiopatología', 'Aula de Fisio'], gest: ['Muestras', 'Recepción de muestras'],
  ipe: ['IPE I', 'Sala de prevención'], ing: ['Inglés', 'Aula de idiomas'], digi: ['Digitalización', 'Sala de pantallas'], sost: ['Sostenibilidad', 'Invernadero']
};
function fitFont(g, text, weight, family, size, maxW) { let s = size; do { g.font = weight + ' ' + s + 'px ' + family; s -= 2; } while (g.measureText(text).width > maxW && s > 14); }

function buildPlant(parent, x, y, z, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale); parent.add(g);
  const prof = [[0, 0], [0.2, 0], [0.22, 0.02], [0.27, 0.36], [0.29, 0.38], [0.29, 0.42], [0.25, 0.42], [0.24, 0.36], [0, 0.36]].map(([a, b]) => new THREE.Vector2(a, b));
  mesh(new THREE.LatheGeometry(prof, 24), std(0xe8e1d4, { roughness: 0.55 }), 0, 0, 0, g);
  const soil = mesh(new THREE.CircleGeometry(0.245, 20), std(0x2a1d14, { roughness: 1 }), 0, 0.37, 0, g); soil.rotation.x = -Math.PI / 2;
  const leafGeo = new THREE.PlaneGeometry(0.2, 0.62, 3, 10); leafGeo.translate(0, 0.31, 0);
  const lp = leafGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) { let px = lp.getX(i), py = lp.getY(i); const t = THREE.MathUtils.clamp(py / 0.62, 0, 1); const w = Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - t * 0.25); px *= w; lp.setXYZ(i, px, py, Math.pow(t, 2) * 0.22 + Math.abs(px) * 0.35); }
  leafGeo.computeVertexNormals();
  const leafMat = std(0x4fae3a, { roughness: 0.5, side: THREE.DoubleSide });
  const leaves = [];
  for (let i = 0; i < 9; i++) { const pv = new THREE.Group(); pv.position.y = 0.36; pv.rotation.y = i * 2.39; const l = mesh(leafGeo, leafMat, 0, 0, 0, pv); l.rotation.x = -(0.25 + (i % 3) * 0.18); l.scale.setScalar(0.75 + (i % 4) * 0.12); g.add(pv); leaves.push(l); }
  blob(0.8, 0.8, 0.45, 0, 0.004, 0, g);
  g.userData.leaves = leaves; return g;
}

/* =========================================================
   Tras cada puerta, su sala (interior mapping)
   Un plano y un shader por puerta. La sala es una caja virtual (fondo, suelo, techo y laterales)
   pintada una sola vez en un atlas de canvas, más una capa de mobiliario a contraluz que hace
   paralaje con la cámara. Anticipa la sala real: mismos colores y los mismos objetos clave.
   Atlas: arriba-izq. fondo · arriba-dcha. mobiliario · abajo-izq. lateral · abajo-dcha. suelo y techo.
   ========================================================= */
const IM = { RW: 1.6, Y0: -1.13, Y1: 1.77, D: 4.2, FD: 1.45, FW: 0.8, FH: 1.6 };
const IM_FS = `uniform sampler2D uA; uniform vec3 uL; uniform vec3 uCam; uniform float uK; varying vec3 vP;
const float RW = ${IM.RW.toFixed(3)}, Y0 = ${IM.Y0.toFixed(3)}, Y1 = ${IM.Y1.toFixed(3)}, DD = ${IM.D.toFixed(3)}, FD = ${IM.FD.toFixed(3)}, FW = ${IM.FW.toFixed(3)}, FH = ${IM.FH.toFixed(3)};
vec2 reg(vec2 q, vec2 o, vec2 s) { return o + clamp(q, 0.004, 0.996) * s; }
void main() {
  vec3 d = normalize(vP - uCam) + vec3(1e-5);
  float tx = ((d.x > 0.0 ? RW : -RW) - vP.x) / d.x;
  float ty = ((d.y > 0.0 ? Y1 : Y0) - vP.y) / d.y;
  float tz = (-DD - vP.z) / d.z;
  float t = min(min(tx, ty), tz);
  vec3 h = vP + d * t;
  float a = (h.x + RW) / (2.0 * RW), b = (h.y - Y0) / (Y1 - Y0), c = -h.z / DD;
  vec2 uv;
  if (t == tz) uv = reg(vec2(a, b), vec2(0.0, 0.5), vec2(0.5));
  else if (t == tx) uv = reg(vec2(d.x > 0.0 ? c : 1.0 - c, b), vec2(0.0), vec2(0.5));
  else if (d.y < 0.0) uv = reg(vec2(a, c), vec2(0.5, 0.25), vec2(0.5, 0.25));
  else uv = reg(vec2(a, c), vec2(0.5, 0.0), vec2(0.5, 0.25));
  vec3 col = texture2D(uA, uv).rgb * mix(1.0, 0.72, clamp(t / 7.0, 0.0, 1.0));
  float tf = (-FD - vP.z) / d.z; vec3 f = vP + d * tf;
  vec2 q = vec2((f.x + FW) / (2.0 * FW), (f.y - Y0) / FH);
  if (tf < t && q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) { vec4 fc = texture2D(uA, reg(q, vec2(0.5), vec2(0.5))); col = mix(col, fc.rgb, fc.a); }
  vec3 L = vec3(0.0, Y1 - 0.3, -DD * 0.55) - uCam; float s = max(dot(L, d), 0.0); float r2 = dot(L, L) - s * s;
  col += uL * 0.16 * exp(-r2 * 1.3);
  gl_FragColor = vec4(col * uK, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const IM_VS = 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
/* pintura: utilidades pequeñas para el atlas */
function glowAt(g, x, y, r, c) { const o = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.globalCompositeOperation = o; }
function shape(g, ink, rim, fn, lw = 3) { g.beginPath(); fn(g); g.fillStyle = ink; g.fill(); g.strokeStyle = rim; g.globalAlpha = 0.7; g.lineWidth = lw; g.stroke(); g.globalAlpha = 1; }
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
/* mesa de laboratorio o pupitre, en el plano del mobiliario (320 px por metro; suelo en y = 512) */
function imBench(g, ink, rim, topY, legs) {
  shape(g, ink, rim, c => { c.rect(36, topY, 440, 14); });
  if (legs) shape(g, ink, rim, c => { c.rect(52, topY + 14, 10, 512 - topY); c.rect(450, topY + 14, 10, 512 - topY); });
  else shape(g, ink, rim, c => { c.rect(46, topY + 14, 420, 512 - topY - 22); });
}
const IM_ROOMS = {
  bio: {
    wall: '#d3d8e4', band: '#9ea6ba', floor: '#868c9c', ceil: '#191c27', light: '#9fadff', ink: '#0d1020', rim: '#b9c4ff',
    back(g) {
      g.strokeStyle = 'rgba(50,60,90,.22)'; g.lineWidth = 2; for (let x = 0; x < 512; x += 92) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
      g.fillStyle = '#eef0f5'; g.fillRect(26, 150, 180, 362); g.fillStyle = '#5b6274'; g.fillRect(26, 138, 180, 16);
      g.fillStyle = '#c9e2ff'; g.fillRect(40, 186, 152, 120); glowAt(g, 116, 246, 130, 'rgba(160,205,255,.75)');
      g.fillStyle = '#a7aec0'; for (let x = 40; x < 192; x += 8) g.fillRect(x, 158, 4, 18);
      [[240, 196], [334, 196]].forEach(([x, y], k) => { g.fillStyle = '#0d1230'; g.fillRect(x, y, 84, 58); g.fillStyle = k ? '#c3adff' : '#8fa6ff'; g.font = '700 12px monospace';
        if (k) { for (let l = 0; l < 6; l++) [14, 30, 46].forEach((yy, b) => g.fillRect(x + 8 + l * 12, y + yy - 6 + ((l * 5 + b * 3) % 7), 9, 3)); }
        else for (let r = 0; r < 5; r++) g.fillText('ATGCGATC'.slice(r % 4, r % 4 + 6), x + 8, y + 14 + r * 10);
        glowAt(g, x + 42, y + 30, 80, 'rgba(130,140,255,.4)'); });
      g.fillStyle = '#e3e7ee'; g.fillRect(436, 190, 70, 322); g.fillStyle = '#0d1230'; g.fillRect(446, 206, 50, 18); g.fillStyle = '#9fb4ff'; g.font = '700 13px monospace'; g.fillText('−80 °C', 448, 220);
    },
    furn(g, ink, rim) {
      imBench(g, ink, rim, 218);
      g.lineWidth = 6; g.lineCap = 'round';
      for (let s = 0; s < 2; s++) { g.strokeStyle = s ? '#9a7bff' : '#c3adff'; g.beginPath(); for (let y = 60; y <= 205; y += 4) { const x = 150 + Math.sin(y * 0.07 + s * Math.PI) * 26; y === 60 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
      g.strokeStyle = 'rgba(230,220,255,.8)'; g.lineWidth = 3; for (let y = 66; y < 205; y += 12) { g.beginPath(); g.moveTo(150 + Math.sin(y * 0.07) * 26, y); g.lineTo(150 - Math.sin(y * 0.07) * 26, y); g.stroke(); }
      shape(g, ink, rim, c => { c.rect(126, 208, 48, 10); });
      shape(g, ink, rim, c => { c.rect(286, 166, 88, 52); }); g.fillStyle = '#c3adff'; g.fillRect(300, 178, 40, 12);
      shape(g, ink, rim, c => { c.rect(386, 198, 82, 20); }); g.fillStyle = 'rgba(255,122,217,.85)'; for (let l = 0; l < 5; l++) g.fillRect(396 + l * 14, 203, 8, 3);
      glowAt(g, 150, 130, 90, 'rgba(165,139,255,.35)');
    }
  },
  lab: {
    wall: '#ece5d6', band: '#d8cfbd', floor: '#8a6e52', ceil: '#1e1915', light: '#ffc98e', ink: '#160f09', rim: '#ffd9a8',
    back(g) {
      g.strokeStyle = 'rgba(120,100,80,.28)'; g.lineWidth = 1.5; for (let x = 0; x < 512; x += 26) { g.beginPath(); g.moveTo(x, 210); g.lineTo(x, 512); g.stroke(); } for (let y = 210; y < 512; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
      const sky = g.createLinearGradient(0, 36, 0, 132); sky.addColorStop(0, '#8a5a7c'); sky.addColorStop(.6, '#ff9a5a'); sky.addColorStop(1, '#ffd08a'); g.fillStyle = sky; g.fillRect(300, 36, 170, 96);
      g.fillStyle = '#6b5640'; [300, 356, 412, 468].forEach(x => g.fillRect(x - 2, 34, 5, 100)); g.fillRect(298, 32, 176, 6); g.fillRect(298, 130, 176, 6);
      glowAt(g, 385, 84, 170, 'rgba(255,170,90,.55)');
      g.fillStyle = '#7a5a3a'; [180, 250].forEach(y => g.fillRect(24, y, 220, 8));
      const bc = ['#b5651d', 'rgba(220,240,245,.9)', '#3a6fd1', '#b5651d', '#e8e2d6', '#2fa77d'];
      [180, 250].forEach((y, r) => { for (let x = 34, i = r; x < 232; x += 26, i++) { const h = 28 + ((i * 7) % 4) * 6; g.fillStyle = bc[i % 6]; g.fillRect(x, y - h, 16, h); g.fillStyle = '#222'; g.fillRect(x + 4, y - h - 6, 8, 6); } });
      g.fillStyle = '#fbf7ee'; g.beginPath(); g.arc(274, 150, 22, 0, 7); g.fill(); g.strokeStyle = '#3a2a1a'; g.lineWidth = 3; g.stroke(); g.beginPath(); g.moveTo(274, 150); g.lineTo(274, 135); g.moveTo(274, 150); g.lineTo(285, 154); g.stroke();
    },
    furn(g, ink, rim) {
      imBench(g, ink, rim, 218);
      shape(g, ink, rim, c => { c.rect(88, 204, 86, 14); c.rect(150, 96, 14, 110); c.rect(104, 82, 64, 16); c.rect(120, 60, 14, 26); c.rect(112, 160, 50, 8); });
      g.beginPath(); g.moveTo(236, 218); g.lineTo(300, 218); g.lineTo(276, 150); g.lineTo(276, 118); g.lineTo(260, 118); g.lineTo(260, 150); g.closePath(); g.fillStyle = 'rgba(190,230,225,.35)'; g.fill(); g.strokeStyle = rim; g.lineWidth = 2; g.stroke();
      g.beginPath(); g.moveTo(244, 218); g.lineTo(292, 218); g.lineTo(283, 190); g.lineTo(253, 190); g.closePath(); g.fillStyle = 'rgba(63,217,164,.85)'; g.fill();
      g.fillStyle = 'rgba(190,230,225,.35)'; g.fillRect(326, 108, 16, 110); g.fillStyle = 'rgba(255,181,71,.85)'; g.fillRect(328, 160, 12, 58);
      shape(g, ink, rim, c => { c.rect(392, 210, 70, 8); c.rect(412, 34, 6, 178); c.rect(412, 120, 30, 6); });
      g.fillStyle = 'rgba(190,230,225,.5)'; g.fillRect(436, 40, 6, 132);
    }
  },
  fisio: {
    wall: '#f3e6d2', band: '#6e2a26', floor: '#6a5140', ceil: '#1c1412', light: '#ffd6aa', ink: '#170b09', rim: '#ffc9a8',
    back(g) {
      [[60, '#ad3326'], [196, '#5a2ec0'], [332, '#ad3326']].forEach(([x, c]) => { g.fillStyle = '#fbf7ee'; g.fillRect(x, 96, 110, 140); g.fillStyle = c; g.fillRect(x, 96, 110, 16); g.fillStyle = 'rgba(255,107,91,.7)'; g.beginPath(); g.arc(x + 55, 172, 26, 0, 7); g.fill(); });
      g.fillStyle = '#dfe9f2'; g.fillRect(466, 110, 46, 90); glowAt(g, 489, 155, 70, 'rgba(170,210,255,.5)');
    },
    furn(g, ink, rim) {
      imBench(g, ink, rim, 256, true);
      shape(g, ink, rim, c => { c.rect(146, 226, 8, 30); c.roundRect(112, 116, 76, 112, 26); c.moveTo(176, 88); c.arc(150, 88, 26, 0, 7); });
      shape(g, ink, rim, c => { c.rect(336, 176, 8, 80); });
      g.fillStyle = '#e0503f'; g.beginPath(); g.moveTo(340, 176); g.bezierCurveTo(300, 150, 300, 110, 326, 104); g.bezierCurveTo(338, 100, 340, 112, 340, 116); g.bezierCurveTo(342, 104, 360, 98, 368, 112); g.bezierCurveTo(380, 136, 360, 160, 340, 176); g.fill();
      glowAt(g, 340, 140, 70, 'rgba(255,80,60,.3)');
    }
  },
  gest: {
    wall: '#e6ecf1', band: '#f5ad1b', floor: '#7b8794', ceil: '#1a1d22', light: '#eef5ff', ink: '#0e1116', rim: '#ffffff',
    back(g) {
      g.fillStyle = '#f5ad1b'; g.fillRect(110, 64, 292, 46); g.fillStyle = '#221d2e'; g.font = '700 26px "Atkinson Hyperlegible"'; g.fillText('Recepción de muestras', 122, 96);
      g.fillStyle = '#d6d2c8'; g.fillRect(80, 206, 352, 8);
      ['#f5ad1b', '#3b82f6', '#ff6b5b', '#2fc796', '#ffffff'].forEach((c, i) => { g.fillStyle = c; g.fillRect(90 + i * 68, 168, 56, 38); });
      g.fillStyle = '#f5ad1b'; g.fillRect(0, 488, 512, 10); glowAt(g, 470, 300, 50, 'rgba(255,60,60,.4)');
    },
    furn(g, ink, rim) {
      imBench(g, ink, rim, 218);
      shape(g, ink, rim, c => { c.rect(190, 206, 150, 12); c.rect(190, 150, 150, 8); c.rect(190, 150, 8, 60); c.rect(332, 150, 8, 60); });
      [0xffb547, 0xa47cf0, 0xe5484d, 0x3d8bff, 0x7ad35c].forEach((cc, i) => { const x = 208 + i * 26; g.fillStyle = 'rgba(230,240,250,.45)'; g.fillRect(x, 112, 14, 94); g.fillStyle = '#' + col(cc).getHexString(); g.fillRect(x - 2, 100, 18, 16); });
      shape(g, ink, rim, c => { c.rect(372, 186, 40, 22); c.rect(380, 204, 14, 14); }); g.fillStyle = '#ff3030'; g.fillRect(404, 192, 5, 5);
    }
  },
  ipe: {
    wall: '#b7babd', band: '#f5c518', floor: '#5c6064', ceil: '#17191c', light: '#ffe2a6', ink: '#0d0e10', rim: '#ffe7a8',
    back(g) {
      g.fillStyle = '#f5c518'; g.fillRect(0, 320, 512, 22); g.fillStyle = '#18191c'; for (let x = -30; x < 512; x += 30) { g.beginPath(); g.moveTo(x, 342); g.lineTo(x + 14, 342); g.lineTo(x + 36, 320); g.lineTo(x + 22, 320); g.fill(); }
      [[120, 120], [190, 120]].forEach(([x, y]) => { g.fillStyle = '#f5c518'; g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x + 32, y + 26); g.lineTo(x - 32, y + 26); g.closePath(); g.fill(); g.strokeStyle = '#18191c'; g.lineWidth = 5; g.stroke(); });
      g.fillStyle = '#0f8a4c'; g.fillRect(270, 80, 90, 90); g.fillStyle = '#fff'; g.fillRect(306, 96, 18, 58); g.fillRect(286, 116, 58, 18);
      glowAt(g, 440, 90, 90, 'rgba(255,170,40,.6)'); g.fillStyle = '#ffa31a'; g.fillRect(432, 80, 16, 20);
    },
    furn(g, ink, rim) {
      imBench(g, ink, rim, 256, true);
      g.fillStyle = '#3a74e8'; g.fillRect(130, 194, 100, 62); g.fillStyle = '#fff'; g.fillRect(172, 204, 16, 42); g.fillRect(159, 217, 42, 16); g.strokeStyle = rim; g.lineWidth = 2; g.strokeRect(130, 194, 100, 62);
      shape(g, ink, rim, c => { c.roundRect(290, 222, 130, 34, 17); c.moveTo(300, 236); c.arc(280, 236, 20, 0, 7); });
    }
  },
  ing: {
    wall: '#3a4f8f', band: '#e8b23a', floor: '#7a6552', ceil: '#12141f', light: '#ffb878', ink: '#0a0c18', rim: '#ffcf9a',
    back(g) {
      g.fillStyle = '#e8b23a'; g.fillRect(0, 470, 512, 12);
      for (let i = 0; i < 14; i++) { const x = 20 + i * 36, y = 70 + Math.sin(i / 13 * Math.PI) * 40; g.fillStyle = '#ffd08a'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); glowAt(g, x, y, 26, 'rgba(255,190,110,.45)'); }
      g.fillStyle = '#fbf7ee'; g.fillRect(60, 160, 150, 104); g.font = '700 30px Caveat'; [['Hello', '#ff8a3d', 74, 196], ['Hola', '#3b82f6', 140, 214], ['Ciao', '#2fc796', 84, 248]].forEach(([t, c, x, y]) => { g.fillStyle = c; g.fillText(t, x, y); });
      g.fillStyle = '#c9b48a'; g.fillRect(270, 150, 190, 110); g.fillStyle = '#5a7f5a'; [[300, 180, 30, 20], [350, 170, 40, 30], [410, 200, 26, 30], [330, 220, 20, 18]].forEach(r => g.fillRect(...r));
    },
    furn(g, ink, rim) {
      imBench(g, ink, rim, 262, true);
      g.lineWidth = 7; g.strokeStyle = ink; g.beginPath(); g.arc(160, 236, 30, Math.PI, 0); g.stroke(); g.fillStyle = '#ff8a3d'; g.fillRect(122, 232, 14, 26); g.fillRect(184, 232, 14, 26);
      g.fillStyle = '#ff8a3d'; g.beginPath(); g.roundRect(268, 92, 160, 86, 30); g.moveTo(300, 176); g.lineTo(288, 210); g.lineTo(326, 176); g.fill();
      g.fillStyle = '#fffaf2'; g.font = '700 46px Caveat'; g.fillText('Hello', 304, 150);
    }
  },
  digi: {
    wall: '#26304a', band: '#1c2438', floor: '#2c3340', ceil: '#0a0c12', light: '#6ea6ff', ink: '#05070c', rim: '#8fb8ff',
    back(g) {
      g.strokeStyle = 'rgba(173,195,218,.12)'; g.lineWidth = 2; for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); } for (let y = 0; y < 512; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
      glowAt(g, 256, 300, 230, 'rgba(90,140,255,.45)');
      g.fillStyle = '#10141c'; g.fillRect(420, 190, 70, 322); for (let y = 206; y < 500; y += 14) { g.fillStyle = (y / 14) % 3 < 1 ? '#4dff9a' : '#3b82f6'; g.fillRect(430, y, 4, 4); }
    },
    furn(g, ink, rim) {
      imBench(g, ink, rim, 269, true);
      [70, 196, 322].forEach((x, k) => { const gr = g.createLinearGradient(x, 150, x + 120, 230); gr.addColorStop(0, '#2a5590'); gr.addColorStop(1, '#8fb8ff'); g.fillStyle = ink; g.fillRect(x - 6, 144, 132, 92); g.fillStyle = gr; g.fillRect(x, 150, 120, 80); g.fillRect(x + 54, 236, 12, 33);
        glowAt(g, x + 60, 190, 90, 'rgba(110,165,255,.35)'); });
      g.fillStyle = '#e8f0ff'; g.font = '600 26px Fraunces'; g.fillText('Pronto', 214, 200);
    }
  },
  sost: {
    wall: '#5d7f9e', band: '#3d5a34', floor: '#8a7656', ceil: '#141a13', light: '#ffc676', ink: '#0b1208', rim: '#ffd590',
    back(g) {
      const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#5d7f9e'); gr.addColorStop(0.62, '#ffb07a'); gr.addColorStop(1, '#ffd29a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      glowAt(g, 340, 330, 160, 'rgba(255,220,150,.7)');
      g.fillStyle = 'rgba(40,70,40,.85)'; for (let x = 0; x < 512; x += 10) { const h = 60 + Math.sin(x * 0.04) * 24 + ((x * 13) % 30); g.fillRect(x, 512 - h, 10, h); }
      g.strokeStyle = 'rgba(240,248,240,.85)'; g.lineWidth = 6; for (let x = 0; x <= 512; x += 86) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); } for (let y = 0; y <= 512; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    },
    furn(g, ink, rim) {
      imBench(g, ink, rim, 288, true);
      [[100, 1], [190, 1.25], [290, 1.1], [380, 1.35]].forEach(([x, s]) => { g.fillStyle = '#b5653a'; g.beginPath(); g.moveTo(x - 22 * s, 250); g.lineTo(x + 22 * s, 250); g.lineTo(x + 17 * s, 288); g.lineTo(x - 17 * s, 288); g.fill();
        g.fillStyle = '#4fae3a'; for (let k = 0; k < 7; k++) { g.save(); g.translate(x, 250); g.rotate(-1.2 + k * 0.4); g.beginPath(); g.ellipse(0, -36 * s, 9 * s, 34 * s, 0, 0, 7); g.fill(); g.restore(); } });
      glowAt(g, 256, 230, 150, 'rgba(255,200,120,.25)');
    }
  }
};
/* pinta el atlas de una sala (una vez) */
function imAtlas(id) {
  const P = IM_ROOMS[id], A = MOBILE ? 512 : 1024;
  const tex = canvasTex(A, A, (g) => {
    const R = (x, y, w, h, lh, fn) => { g.save(); g.beginPath(); g.rect(x * A, y * A, w * A, h * A); g.clip(); g.translate(x * A, y * A); g.scale(w * A / 512, h * A / lh); fn(); g.restore(); };
    const lightUp = (cx, cy, r) => glowAt(g, cx, cy, r, rgba(P.light, 0.55));
    const aoWall = () => { let gr = g.createLinearGradient(0, 0, 0, 110); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 110); gr = g.createLinearGradient(0, 512, 0, 440); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 440, 512, 72); };
    const bandH = id === 'fisio' ? 165 : id === 'ing' || id === 'gest' ? 0 : 60;
    R(0, 0, 0.5, 0.5, 512, () => {                                       // fondo
      g.fillStyle = P.wall; g.fillRect(0, 0, 512, 512); if (bandH) { g.fillStyle = P.band; g.fillRect(0, 512 - bandH, 512, bandH); }
      noise(g, 512, 512, 900, 0.12, ['#ffffff', '#000000']);
      P.back(g); lightUp(256, 40, 330); aoWall();
      const e = g.createLinearGradient(0, 0, 512, 0); e.addColorStop(0, 'rgba(0,0,0,.45)'); e.addColorStop(.2, 'rgba(0,0,0,0)'); e.addColorStop(.8, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = e; g.fillRect(0, 0, 512, 512);
    });
    R(0, 0.5, 0.5, 0.5, 512, () => {                                     // lateral: izquierda = puerta, derecha = fondo
      g.fillStyle = id === 'sost' ? '#4b6a86' : P.wall; g.fillRect(0, 0, 512, 512); if (bandH) { g.fillStyle = P.band; g.fillRect(0, 512 - bandH, 512, bandH); }
      noise(g, 512, 512, 700, 0.1, ['#ffffff', '#000000']);
      if (id === 'sost') { g.strokeStyle = 'rgba(240,248,240,.8)'; g.lineWidth = 6; for (let x = 0; x <= 512; x += 96) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); } }
      else { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(250, 150, 140, 210); }
      lightUp(380, 40, 300); aoWall();
      const s = g.createLinearGradient(0, 0, 512, 0); s.addColorStop(0, 'rgba(0,0,0,.7)'); s.addColorStop(.6, 'rgba(0,0,0,.15)'); s.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = s; g.fillRect(0, 0, 512, 512);
    });
    R(0.5, 0.5, 0.5, 0.25, 256, () => {                                  // suelo: arriba = fondo, abajo = puerta
      g.fillStyle = P.floor; g.fillRect(0, 0, 512, 256); noise(g, 512, 256, 1400, 0.2, ['#ffffff', '#000000']);
      g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.5; for (let x = 0; x <= 512; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } for (let y = 0; y <= 256; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
      g.save(); g.translate(256, 112); g.scale(1, 0.42); glowAt(g, 0, 0, 230, rgba(P.light, 0.75)); g.restore();
      g.save(); g.filter = 'blur(8px)'; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(128, 158, 256, 26); g.restore();
      const n = g.createLinearGradient(0, 256, 0, 150); n.addColorStop(0, 'rgba(0,0,0,.5)'); n.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = n; g.fillRect(0, 150, 512, 106);
    });
    R(0.5, 0.75, 0.5, 0.25, 256, () => {                                 // techo, con su lámpara
      g.fillStyle = P.ceil; g.fillRect(0, 0, 512, 256);
      g.save(); g.translate(256, 115); g.scale(1, 0.45); glowAt(g, 0, 0, 200, rgba(P.light, 0.5)); g.restore();
      g.fillStyle = '#fff6e6'; g.fillRect(196, 104, 120, 20); g.fillStyle = rgba(P.light, 1); g.fillRect(196, 104, 120, 3);
    });
    R(0.5, 0, 0.5, 0.5, 512, () => { g.clearRect(0, 0, 512, 512); P.furn(g, P.ink, P.rim); });   // mobiliario a contraluz
  });
  tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  return { tex, light: col(P.light), P };
}
function imMaterial(atlas) {
  return new THREE.ShaderMaterial({ uniforms: { uA: { value: atlas.tex }, uL: { value: atlas.light }, uCam: { value: V() }, uK: { value: 1.18 } }, vertexShader: IM_VS, fragmentShader: IM_FS });
}

async function buildHall() {
  const scene = new THREE.Scene();
  scene.background = col(0x0d0f14);
  scene.fog = new THREE.Fog(0x0d0f14, 9, 22);
  scene.environment = envTex;
  const L = { x0: -5.6, x1: 24.2 }, LEN = L.x1 - L.x0, CX = (L.x0 + L.x1) / 2;

  /* luces dinámicas: solo para lo que tiene volumen (puertas, corcho, nota). Pared, suelo y techo
     llevan la luz pintada en una textura (lightmap): charcos bajo los tubos, rincones en penumbra
     y la tarde que entra por la ventana. Sin sombras dinámicas. */
  const hemi = new THREE.HemisphereLight(0xb9c4ff, 0x2b2016, 0.06); scene.add(hemi);
  const fluo = new THREE.DirectionalLight(0xfff4e2, 0); fluo.position.set(2, 7, 7); fluo.target.position.set(2, 0, 0); scene.add(fluo, fluo.target);
  const dusk = new THREE.DirectionalLight(0xff8a42, 1.4); dusk.position.set(26, 2.4, 5); dusk.target.position.set(4, 1, 0); scene.add(dusk, dusk.target);
  const sun = new THREE.PointLight(0xff8a3c, 5, 8, 1.6); sun.position.set(10.8, 1.8, 1.2); scene.add(sun);
  const TUBE_X = []; for (let x = L.x0 + 1.5; x < L.x1; x += 2.6) TUBE_X.push(x);
  const WIN_X = 10.8, WINS = [-4.4, 10.8, 21.4], ART = [[-3.09, 1.78, 0.34, 0.46], [6.48, 1.78, 0.4, 0.54], [18.45, 1.72, 0.62, 0.8], [23.15, 1.8, 0.92, 1.18]], DOOR_X = { bio: -2.2, lab: -0.6, fisio: 4.4, gest: 7.4, ipe: 9.0, ing: 12.9, digi: 14.5, sost: 16.1 };
  const RES = MOBILE ? 1 : 2, PI = Math.PI;
  const u = X => (X - L.x0) / LEN;            // posición en la textura (0..1) a lo largo del pasillo
  await ceder();
  /* pared: un azulejo de pintura + zócalo que se repite, multiplicado por la luz pintada */
  const WALL_H = 3.35;
  const wallTile = canvasTex(256, 428, (g, w, h) => {
    const zy = h * (1 - 1.05 / WALL_H);
    g.fillStyle = '#d2c3a8'; g.fillRect(0, 0, w, zy); noise(g, w, zy, 1600, 0.22, ['#b8a98e', '#e6dac4']);
    const zg = g.createLinearGradient(0, zy, 0, h); zg.addColorStop(0, '#45867a'); zg.addColorStop(1, '#2f6559'); g.fillStyle = zg; g.fillRect(0, zy, w, h - zy);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, zy, w, 3); g.fillStyle = 'rgba(255,255,255,.06)'; [64, 192].forEach(x => g.fillRect(x, zy + 10, 2, h - zy - 20));
    noise(g, w, h - zy, 500, 0.14, ['#0e2421', '#2f6a61']);
  });
  wallTile.wrapS = THREE.RepeatWrapping; wallTile.repeat.set(LEN / 2, 1);
  /* la luz de fuera: color de la ventana, sol directo y su dirección (se recalcula con la hora y el tiempo) */
  let LZ = luzDe(cieloAhora());
  const rgbA = (c, a) => 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + a.toFixed(3) + ')';
  function drawWallLM(g, w, h) {
    const yy = Y => (1 - Y / WALL_H) * h, xx = X => u(X) * w, m = w / LEN;
    g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    g.fillStyle = 'rgb(96,88,82)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    TUBE_X.forEach(X => { const r = g.createRadialGradient(xx(X), yy(3.4), 0, xx(X), yy(3.4), 2.3 * m); r.addColorStop(0, 'rgba(250,236,214,.95)'); r.addColorStop(.45, 'rgba(210,190,165,.42)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    const wc = LZ.win, wk = LZ.winK, c2 = LZ.win2;
    WINS.forEach(X => { const k = (X === WIN_X ? 1 : 0.8) * wk; const wr = g.createRadialGradient(xx(X), yy(1.9), 0.4 * m, xx(X), yy(1.9), 4.6 * m * (X === WIN_X ? 1 : 0.8)); wr.addColorStop(0, rgbA(wc, .95 * k)); wr.addColorStop(.35, rgbA(c2, .45 * k)); wr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = wr; g.fillRect(0, 0, w, h); });
    ART.forEach(([X, Y, aw, ah]) => { const r = g.createRadialGradient(xx(X), yy(Y + ah / 2 + 0.1), 0, xx(X), yy(Y + ah / 2 + 0.1), (aw * 0.9 + 0.35) * m); r.addColorStop(0, 'rgba(255,226,180,.85)'); r.addColorStop(.6, 'rgba(255,200,140,.25)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    const rb = g.createLinearGradient(0, h, 0, h * 0.55); rb.addColorStop(0, 'rgba(150,132,112,.55)'); rb.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rb; g.fillRect(0, h * 0.55, w, h * 0.45);   // la luz que rebota del suelo
    g.globalCompositeOperation = 'source-over';
    const top = g.createLinearGradient(0, 0, 0, h * 0.16); top.addColorStop(0, 'rgba(8,6,5,.65)'); top.addColorStop(1, 'rgba(8,6,5,0)'); g.fillStyle = top; g.fillRect(0, 0, w, h * 0.16);
    const bot = g.createLinearGradient(0, h, 0, h * 0.86); bot.addColorStop(0, 'rgba(8,6,5,.5)'); bot.addColorStop(1, 'rgba(8,6,5,0)'); g.fillStyle = bot; g.fillRect(0, h * 0.82, w, h * 0.18);
    g.fillStyle = 'rgba(8,6,5,.45)'; g.fillRect(0, yy(1.04), w, 3 * RES);                       // sombra del pasamanos
    g.save(); g.filter = 'blur(' + (5 * RES) + 'px)'; g.fillStyle = 'rgba(8,6,5,.55)';
    Object.values(DOOR_X).forEach(X => g.fillRect(xx(X - 0.7), yy(2.45), 1.4 * m, yy(0) - yy(2.45)));   // penumbra alrededor de cada marco
    g.fillRect(xx(0.75), yy(2.32), 2.0 * m, yy(1.0) - yy(2.32));                                          // corcho
    g.fillRect(xx(5.45), yy(2.25), 0.8 * m, yy(1.15) - yy(2.25));                                         // calendario
    g.restore();
    const ends = g.createLinearGradient(0, 0, w, 0); ends.addColorStop(0, 'rgba(0,0,0,.55)'); ends.addColorStop(.12, 'rgba(0,0,0,0)'); ends.addColorStop(.9, 'rgba(0,0,0,0)'); ends.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = ends; g.fillRect(0, 0, w, h);
  }
  const wallLM = canvasTex(1024 * RES, 128 * RES, drawWallLM);
  const wallMat = basic(0xffffff, { map: wallTile, lightMap: wallLM, lightMapIntensity: PI * 1.25 });
  plane(LEN, WALL_H, wallMat, CX, WALL_H / 2, 0, scene);
  /* pasamanos y rodapié por tramos: se cortan en cada marco para no cruzar por delante de la sala abierta */
  { const railM = std(0x8a5a34, { roughness: 0.45 }), baseM = std(0x15181c), HW = 0.645;
    const cuts = Object.values(DOOR_X).sort((a, b) => a - b); let xa = L.x0;
    [...cuts, null].forEach(dx => { const xb = dx === null ? L.x1 : dx - HW;
      if (xb - xa > 0.01) { const w = xb - xa, cx = (xa + xb) / 2; box(w, 0.07, 0.06, railM, cx, 1.07, 0.03, scene); box(w, 0.1, 0.03, baseM, cx, 0.05, 0.015, scene); }
      if (dx !== null) xa = dx + HW; }); }
  await ceder();
  /* suelo de terrazo: lascas de mármol en tres tonos sobre base cálida */
  const terr = canvasTex(512 / RES * (MOBILE ? 1 : 1), 512 / RES * (MOBILE ? 1 : 1), (g, w, h) => {
    g.fillStyle = '#b4a690'; g.fillRect(0, 0, w, h); noise(g, w, h, 3000, 0.25, ['#9d907b', '#c8bca7']);
    const C = ['#efe8da', '#e3dccc', '#7d7468', '#c98863', '#5d5751', '#d9cdb7'];
    for (let i = 0; i < (MOBILE ? 700 : 1500); i++) {
      const x = Math.random() * w, y = Math.random() * h, r = (0.6 + Math.random() * Math.random() * 4.5) * (w / 512), n = 4 + (i % 3);
      g.fillStyle = C[i % C.length]; g.globalAlpha = 0.55 + Math.random() * 0.45; g.beginPath();
      for (let k = 0; k < n; k++) { const a = k / n * PI * 2 + Math.random() * 0.6, rr2 = r * (0.6 + Math.random() * 0.6); g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
      g.fill();
    }
    g.globalAlpha = 1;
  });
  terr.wrapS = terr.wrapT = THREE.RepeatWrapping; terr.repeat.set(LEN / 1.4, 9 / 1.4);
  /* la luz del sol en el suelo: la proyección de cada ventana según la altura y el azimut del sol,
     con la sombra del parteluz; sin sol directo, solo el resplandor difuso del cielo */
  const patchC = D.createElement('canvas');
  function drawFloorLM(g, w, h) {
    const xx = X => u(X) * w, zz = Z => Z / 9 * h, m = w / LEN, mz = h / 9;
    g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    g.fillStyle = 'rgb(70,64,60)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    TUBE_X.forEach(X => { g.save(); g.translate(xx(X), zz(1.9)); g.scale(1, mz / m * 1.3); const r = g.createRadialGradient(0, 0, 0, 0, 0, 1.9 * m); r.addColorStop(0, 'rgba(240,228,206,.85)'); r.addColorStop(.5, 'rgba(190,172,150,.35)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(-3 * m, -3 * m, 6 * m, 6 * m); g.restore(); });
    WINS.forEach(X => { g.save(); g.translate(xx(X - LZ.sx * 0.5), zz(1.3)); g.scale(1, 0.7); const r = g.createRadialGradient(0, 0, 0, 0, 0, 1.8 * m); r.addColorStop(0, rgbA(LZ.win, .6 * LZ.winK)); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(-2.2 * m, -2.2 * m, 4.4 * m, 4.4 * m); g.restore(); });
    if (LZ.direct > 0.02) {
      patchC.width = w; patchC.height = h; const pg = patchC.getContext('2d'); pg.clearRect(0, 0, w, h);
      const s1 = 1.125 / LZ.tanAlt, s2 = 2.675 / LZ.tanAlt, sa = LZ.sinAz, ca = LZ.cosAz;
      const fp = (X, dx, s) => [xx(X + dx - s * sa), zz(Math.min(9.5, s * ca))];
      WINS.forEach(X => {
        const k = (X === WIN_X ? 1 : 0.85) * LZ.direct, q = [fp(X, -0.95, s1), fp(X, 0.95, s1), fp(X, 0.95, s2), fp(X, -0.95, s2)];
        const gr = pg.createLinearGradient(0, q[0][1], 0, Math.max(q[0][1] + 1, q[3][1])); gr.addColorStop(0, rgbA(LZ.sun, .95 * k)); gr.addColorStop(1, rgbA(LZ.sun, .35 * k));
        pg.fillStyle = gr; pg.beginPath(); q.forEach((p, i) => i ? pg.lineTo(p[0], p[1]) : pg.moveTo(p[0], p[1])); pg.closePath(); pg.fill();
        pg.globalCompositeOperation = 'destination-out'; pg.strokeStyle = 'rgba(0,0,0,.85)'; pg.lineWidth = Math.max(2, 0.05 * m);
        pg.beginPath(); pg.moveTo(...fp(X, 0, s1)); pg.lineTo(...fp(X, 0, s2)); pg.stroke(); pg.globalCompositeOperation = 'source-over';
      });
      g.save(); g.filter = 'blur(' + Math.round((3 + 4 / Math.max(0.3, LZ.tanAlt)) * RES) + 'px)'; g.drawImage(patchC, 0, 0); g.restore();
    }
    Object.entries(DOOR_X).forEach(([id, X]) => { const S = SUBJ[ROOMS[id].subs[0]]; g.save(); g.translate(xx(X), zz(0.05)); g.scale(1, 0.55); const r = g.createRadialGradient(0, 0, 0, 0, 0, 0.8 * m); r.addColorStop(0, S.c + 'aa'); r.addColorStop(1, S.c + '00'); g.fillStyle = r; g.fillRect(-m, -m, 2 * m, 2 * m); g.restore(); });
    g.globalCompositeOperation = 'source-over';
    const ao = g.createLinearGradient(0, 0, 0, zz(0.45)); ao.addColorStop(0, 'rgba(6,5,4,.75)'); ao.addColorStop(1, 'rgba(6,5,4,0)'); g.fillStyle = ao; g.fillRect(0, 0, w, zz(0.45));
    const far = g.createLinearGradient(0, zz(3), 0, h); far.addColorStop(0, 'rgba(0,0,0,0)'); far.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = far; g.fillRect(0, zz(3), w, h - zz(3));
  }
  const floorLM = canvasTex(1024 * RES, 384 * RES, drawFloorLM);
  const floorMat = basic(0xffffff, { map: terr, lightMap: floorLM, lightMapIntensity: PI * 1.3 });
  const floor = plane(LEN, 9, floorMat, CX, 0, 4.5, scene); floor.rotation.x = -Math.PI / 2;
  /* reflejo falso: tarjetas aditivas del cielo y de los tubos sobre el terrazo pulido */
  const refl = (w, d, c, x, z, op) => { const m = plane(w, d, basic(c, { map: glowTex, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }), x, 0.004, z, scene); m.rotation.x = -Math.PI / 2; return m; };
  const winRefl = WINS.map(X => refl(1.6, 2.6, 0xff9a5a, X - 0.35, 0.9, X === WIN_X ? 0.3 : 0.2));
  TUBE_X.forEach(X => refl(1.5, 0.7, 0xfff0d8, X, 2.35, 0.09));
  await ceder();
  /* techo: oscuro, con el halo de cada tubo pintado */
  const ceilLM = canvasTex(1024 * RES, 128 * RES, (g, w, h) => {
    const xx = X => u(X) * w, m = w / LEN;
    g.fillStyle = 'rgb(92,88,86)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    TUBE_X.forEach(X => { g.save(); g.translate(xx(X), h * (1 - 1.8 / 9)); g.scale(1, (h / 9) / m); const r = g.createRadialGradient(0, 0, 0, 0, 0, 1.2 * m); r.addColorStop(0, 'rgba(220,210,190,.9)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(-2 * m, -2 * m, 4 * m, 4 * m); g.restore(); });
  });
  const ceil = plane(LEN, 9, basic(0x3a3c42, { lightMap: ceilLM, lightMapIntensity: PI * 1.2 }), CX, 3.3, 4.5, scene); ceil.rotation.x = Math.PI / 2;
  const baked = [wallMat, floorMat, ceil.material];
  const tubes = [];
  TUBE_X.forEach(x => {
    box(1.4, 0.05, 0.26, std(0xbfc3c8, { roughness: 0.4 }), x, 3.29, 1.8, scene);
    const m = box(1.3, 0.035, 0.16, basic(0x050505), x, 3.255, 1.8, scene); tubes.push(m.material);
  });
  /* cartel de salida */
  const exitTex = canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#0f8a4c'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '700 46px "Atkinson Hyperlegible"'; g.textAlign = 'center'; g.fillText('SALIDA', w / 2 + 18, 64); g.beginPath(); g.moveTo(28, 48); g.lineTo(52, 30); g.lineTo(52, 66); g.fill(); });
  plane(0.62, 0.23, basic(0xffffff, { map: exitTex }), 18.4, 2.85, 0.02, scene);
  glowSprite(0x3dff9a, 1.2, 18.4, 2.85, 0.1, scene, 0.25);

  await ceder();
  /* ventanas vivas: el cielo real de Pamplona sobre el horizonte de la cuenca.
     Un plano y un shader por ventana. El cielo (degradado cénit/horizonte, halo del sol, luna con su fase,
     estrellas y dos capas de nubes con volumen) es procedural; el paisaje son cuatro panorámicas de 360°
     pintadas una vez (montes lejanos, sierras cercanas con molinos, la ciudad con sus ventanas y los árboles
     del patio) que el shader colorea con la luz de cada momento y la perspectiva atmosférica.
     Las capas se desplazan entre sí con la cámara (paralaje por rayo) y cada ventana mira a otro azimut. */
  const PW = MOBILE ? 1024 : 2048, h01 = v => Math.min(1, Math.max(0, v));
  const mkCanvas = (w, h) => { const c = D.createElement('canvas'); c.width = w; c.height = h; return c; };
  const dataTex = (c, wrap) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.premultiplyAlpha = false; return t; };
  const hsh = x => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const rnd = (() => { let s0 = 11; return () => (s0 = (s0 * 16807) % 2147483647) / 2147483647; })();   // también la usan los cuadros
  const rgbC = (r, g2, b) => 'rgb(' + Math.round(h01(r) * 255) + ',' + Math.round(h01(g2) * 255) + ',' + Math.round(h01(b) * 255) + ')';
  /* montes: R luz de la ladera (alto = mira al este), G altura relativa (para la nieve), B vegetación, A cobertura */
  function montes(capa, PH, E0, E1, extra) {
    const c = mkCanvas(PW, PH), g = c.getContext('2d'), im = g.createImageData(PW, PH), d = im.data;
    const hs = new Float32Array(PW); for (let x = 0; x < PW; x++) hs[x] = CI.perfil(capa, x / PW * 360);
    let hmax = 0; hs.forEach(v => { if (v > hmax) hmax = v; });
    const yOf = el => (1 - (el - E0) / (E1 - E0)) * PH, dpp = 360 / PW;
    for (let x = 0; x < PW; x++) {
      const h = hs[x], sl = (hs[(x + 3) % PW] - hs[(x - 3 + PW) % PW]) / (6 * dpp), top = yOf(h);
      for (let y = Math.max(0, Math.floor(top)); y < PH; y++) {
        const el = E0 + (1 - (y + 0.5) / PH) * (E1 - E0), dep = h - el, i = (y * PW + x) * 4;
        const n = hsh(x * 0.37 + y * 13.1) * 0.1, gully = Math.sin(x * 0.11 * (2048 / PW) + Math.sin(y * 0.23) * 2.2) * 0.1 * Math.min(1, dep);
        d[i] = 255 * h01(0.5 + sl * 0.9 + gully + n - dep * 0.015);
        d[i + 1] = 255 * h01(el / Math.max(1, hmax) + n * 0.4);
        d[i + 2] = 255 * h01(0.15 + dep * 0.22 + Math.sin(x * 0.027 * (2048 / PW) + y * 0.05) * 0.18 + n);
        d[i + 3] = 255 * h01(y + 1 - top);
      }
    }
    g.putImageData(im, 0, 0);
    if (extra) extra(g, yOf, PH / (E1 - E0));
    return dataTex(c, true);
  }
  const tFar = montes('lejos', MOBILE ? 96 : 160, -1, 11);
  const tMid = montes('medio', MOBILE ? 128 : 224, -2, 10, (g, yOf, ppd) => {
    g.strokeStyle = rgbC(0.92, 0, 0); g.lineWidth = MOBILE ? 1 : 1.2; g.lineCap = 'round';      // molinos en el Perdón y en Alaiz
    CI.molinos().forEach(([az, h], i) => { const x = az / 360 * PW, y = yOf(h) + 1, t = 1.5 * ppd, b = 0.6 * ppd, a = i * 1.7;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - t); for (let k = 0; k < 3; k++) { const an = a + k * 2.094; g.moveTo(x, y - t); g.lineTo(x + Math.cos(an) * b, y - t + Math.sin(an) * b); } g.stroke(); });
  });
  await ceder();
  /* la ciudad sobre las lomas: B indica qué es (campo < 0,47 · fachada < 0,72 · tejado); G = ventana (B = orden de encendido) */
  const CA0 = 70, CA1 = 290, TA0 = 50, TA1 = 310;
  const tCity = (() => {
    const PH = MOBILE ? 192 : 320, E0 = -16, E1 = 6, c = mkCanvas(PW, PH), g = c.getContext('2d');
    const sx = PW / (CA1 - CA0), X = az => (az - CA0) * sx, yOf = el => (1 - (el - E0) / (E1 - E0)) * PH, ppd = PH / (E1 - E0);
    const im = g.createImageData(PW, PH), d = im.data;
    for (let x = 0; x < PW; x++) {
      const az = CA0 + x / sx, h = CI.perfil('cerca', az), top = yOf(h), sl = (CI.perfil('cerca', az + 0.6) - CI.perfil('cerca', az - 0.6)) / 1.2;
      const edge = h01(Math.min(x, PW - 1 - x) / 6);
      for (let y = Math.max(0, Math.floor(top)); y < PH; y++) {
        const el = E0 + (1 - (y + 0.5) / PH) * (E1 - E0), i = (y * PW + x) * 4;
        const field = hsh(Math.floor(az / 2.3 + Math.sin(el * 0.9) * 1.5) * 7.1 + Math.floor(el * 3.1) * 31.7), hedge = Math.abs(Math.sin(az * 2.7 + el * 0.8)) < 0.04 ? 0.25 : 0;
        d[i] = 255 * h01(0.5 + sl * 0.8 - hedge + (field - 0.5) * 0.12); d[i + 1] = 0; d[i + 2] = 255 * (0.04 + field * 0.38); d[i + 3] = 255 * h01(y + 1 - top) * edge;
      }
    }
    g.putImageData(im, 0, 0);
    const rnd = (() => { let s0 = 29; return () => (s0 = (s0 * 16807) % 2147483647) / 2147483647; })();
    const building = (az, w, base, ht, roof, row) => {
      const x0 = X(az), bw = w * sx, y1 = yOf(base), y0 = yOf(base + ht), v = rnd();
      const sh = 0.45 + v * 0.3 + (row === 2 ? 0.08 : 0);
      g.fillStyle = rgbC(sh, 0, 0.5 + v * 0.18); g.fillRect(x0, y0, bw, y1 - y0 + 2);
      g.fillStyle = rgbC(sh * 0.55, 0, 0.5 + v * 0.18); g.fillRect(x0 + bw * 0.82, y0, bw * 0.18, y1 - y0 + 2);    // la cara en sombra
      if (roof) { g.fillStyle = rgbC(0.35 + rnd() * 0.3, 0, 0.8 + rnd() * 0.12); g.beginPath(); g.moveTo(x0 - 1, y0 + 0.5); g.lineTo(x0 + bw * (0.3 + rnd() * 0.4), y0 - Math.min(bw * 0.45, ppd * 0.9)); g.lineTo(x0 + bw + 1, y0 + 0.5); g.closePath(); g.fill(); }
      const ws = Math.max(1, ppd * (row === 2 ? 0.32 : 0.2)), gap = ws * 2.3;
      for (let yy = y0 + gap * 0.7; yy < y1 - ws; yy += gap) for (let xx = x0 + ws; xx < x0 + bw - ws * 1.5; xx += gap * 0.9) if (rnd() > 0.18) { g.fillStyle = rgbC(0.5, 1, rnd()); g.fillRect(Math.round(xx), Math.round(yy), Math.ceil(ws), Math.ceil(ws * 1.2)); }
    };
    /* tres filas: la del fondo, casi en el horizonte; la de delante, más grande y más abajo */
    const rows = [[-2.4, 0.5, 2.0, 0.9, 2.6], [-6.5, 1.2, 3.8, 1.6, 4.4], [-13, 2.2, 6.5, 2.8, 7.5]];
    rows.forEach(([base, hmin, hmax, wmin, wmax], row) => {
      for (let az = 84 + rnd() * 3; az < 276;) {
        const dens = Math.exp(-(((az - 180) / 70) ** 2)), w = wmin + rnd() * (wmax - wmin);
        if (rnd() < 0.25 + dens * 0.75) building(az, w, base - rnd() * 0.6, hmin + rnd() * (hmax - hmin) * (0.5 + dens * 0.7), rnd() < 0.55, row);
        az += w * (0.95 + rnd() * 0.4) + (rnd() < 0.15 ? w * 1.5 : 0);
      }
      if (row === 1) {   // la catedral: dos torres con su remate, y una torre de viviendas a la derecha
        const cz = 166, b = -6.6; g.fillStyle = rgbC(0.62, 0, 0.62);
        [[cz - 1.1, 5.6], [cz + 1.1, 5.6]].forEach(([a, ht]) => { g.fillRect(X(a - 0.55), yOf(b + ht), 1.1 * sx, yOf(b) - yOf(b + ht)); g.beginPath(); g.moveTo(X(a - 0.6), yOf(b + ht)); g.lineTo(X(a), yOf(b + ht + 1.4)); g.lineTo(X(a + 0.6), yOf(b + ht)); g.fill(); });
        g.fillRect(X(cz - 1.7), yOf(b + 3.4), 3.4 * sx, yOf(b) - yOf(b + 3.4));
        building(236, 2.4, -6.8, 7.4, false, 1); building(246, 1.8, -6.4, 5.8, false, 1);
      }
      if (row === 0) { g.fillStyle = rgbC(0.6, 0, 0.6); const a = 198, b = -2.6; g.fillRect(X(a - 0.3), yOf(b + 3.2), 0.6 * sx, yOf(b) - yOf(b + 3.2)); g.beginPath(); g.moveTo(X(a - 0.35), yOf(b + 3.2)); g.lineTo(X(a), yOf(b + 4.6)); g.lineTo(X(a + 0.35), yOf(b + 3.2)); g.fill(); }
      /* farolas: puntos de luz en las calles, los primeros en encenderse */
      for (let az = 86; az < 274; az += 0.7 + rnd()) if (rnd() < 0.5) { g.fillStyle = rgbC(0.5, 1, rnd() * 0.25); g.fillRect(X(az), yOf(base + 0.1) - 1, Math.max(1, ppd * 0.2), Math.max(1, ppd * 0.2)); }
    });
    g.fillStyle = rgbC(0.4, 0, 0.55); g.fillRect(X(84), yOf(-14.5), (276 - 84) * sx, PH);
    g.clearRect(0, 0, 3, PH); g.clearRect(PW - 3, 0, 3, PH);
    return dataTex(c, false);
  })();
  await ceder();
  /* árboles del patio: B = 0 rama, B > 0 racimo de hojas (orden en que se caen); G = 1 flor, G = 0,5 perenne */
  const tTree = (() => {
    const PH = MOBILE ? 256 : 512, E0 = -18, E1 = 22, c = mkCanvas(PW, PH), g = c.getContext('2d');
    const sx = PW / (TA1 - TA0), X = az => (az - TA0) * sx, Y = el => (1 - (el - E0) / (E1 - E0)) * PH, ppd = PH / (E1 - E0);
    const rnd = (() => { let s0 = 41; return () => (s0 = (s0 * 16807) % 2147483647) / 2147483647; })();
    const tips = [];
    const branch = (x, y, a, len, wd, dep) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.strokeStyle = rgbC(0.25 + rnd() * 0.15, 0, 0); g.lineWidth = Math.max(0.8, wd); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (rnd() - 0.5) * len * 0.3, (y + y2) / 2, x2, y2); g.stroke();
      if (dep <= 0 || len < 3) { tips.push([x2, y2]); return; }
      const n = dep > 3 ? 2 : 2 + (rnd() < 0.4);
      for (let k = 0; k < n; k++) branch(x2, y2, a + (k - (n - 1) / 2) * (0.55 + rnd() * 0.35) + (rnd() - 0.5) * 0.3, len * (0.68 + rnd() * 0.12), wd * 0.66, dep - 1);
    };
    const tree = (az, ht, spread, flor) => {
      tips.length = 0; const x = X(az), y = Y(E0), len = ht * ppd * 0.34;
      g.lineCap = 'round'; branch(x, y + 4, -Math.PI / 2 + (rnd() - 0.5) * 0.08, len, len * 0.13, 6);
      const leaves = tips.slice();
      /* copa: racimos alrededor de las puntas, más claros arriba a la izquierda */
      const cr = spread * sx * 0.06;
      leaves.forEach(([lx, ly]) => { for (let k = 0; k < 6; k++) { const r = cr * (0.35 + rnd() * 0.55), ox = (rnd() - 0.5) * cr * 1.6, oy = (rnd() - 0.5) * cr * 1.2, ord = 0.06 + rnd() * 0.94;
        const gr = g.createRadialGradient(lx + ox - r * 0.4, ly + oy - r * 0.5, r * 0.1, lx + ox, ly + oy, r); gr.addColorStop(0, rgbC(0.95, 0, ord)); gr.addColorStop(1, rgbC(0.3, 0, ord));
        g.fillStyle = gr; g.beginPath(); g.ellipse(lx + ox, ly + oy, r, r * 0.82, rnd() * 3, 0, 7); g.fill();
        if (flor) for (let f = 0; f < 5; f++) { g.fillStyle = rgbC(0.9, 1, ord); g.fillRect(lx + ox + (rnd() - 0.5) * r * 1.4, ly + oy + (rnd() - 0.5) * r, 1.5, 1.5); } } });
      /* el tronco y las ramas gruesas, por encima: se ven entre las hojas y en invierno */
      tips.length = 0; branch(x, y + 4, -Math.PI / 2, len, len * 0.13, 2);
    };
    const cypress = (az, ht) => { const x = X(az), y = Y(E0), w = 1.4 * sx, top = Y(E0 + ht);
      for (let k = 0; k < 26; k++) { const t = k / 25, yy = y + (top - y) * t, ww = w * (1 - t * 0.85) * (0.8 + rnd() * 0.4); const gr = g.createLinearGradient(x - ww, 0, x + ww, 0); gr.addColorStop(0, rgbC(0.8, 0.5, 0.5)); gr.addColorStop(1, rgbC(0.25, 0.5, 0.5)); g.fillStyle = gr; g.beginPath(); g.ellipse(x, yy, ww, (y - top) / 14, 0, 0, 7); g.fill(); } };
    tree(88, 30, 24, false); cypress(150, 24); cypress(153.5, 19); tree(163, 20, 13, true); tree(213, 33, 26, false); tree(272, 28, 20, true); tree(300, 19, 16, false);
    g.clearRect(0, 0, 3, PH); g.clearRect(PW - 3, 0, 3, PH);
    return dataTex(c, false);
  })();
  await ceder();
  /* ruido periódico para las nubes y las gotas: cuatro escalas en RGBA */
  const tNoise = (() => {
    const N = 128, c = mkCanvas(N, N), g = c.getContext('2d'), im = g.createImageData(N, N), d = im.data;
    const lat = (f, seed) => { const a = new Float32Array(f * f); for (let i = 0; i < a.length; i++) a[i] = hsh(i * 1.37 + seed * 91.7); return a; };
    const smp = (a, f, x, y) => { const fx = x * f, fy = y * f, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx2 = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const q = (i, j) => a[((j % f) + f) % f * f + ((i % f) + f) % f]; return (q(x0, y0) * (1 - sx2) + q(x0 + 1, y0) * sx2) * (1 - sy) + (q(x0, y0 + 1) * (1 - sx2) + q(x0 + 1, y0 + 1) * sx2) * sy; };
    const F = [4, 8, 16, 32], L4 = F.map((f, k) => lat(f, k + 1));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4; for (let k = 0; k < 4; k++) d[i + k] = 255 * smp(L4[k], F[k], x / N, y / N); }
    g.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.premultiplyAlpha = false; return t;
  })();
  [tFar, tMid, tCity, tTree, tNoise].forEach(t => KEEP.add(t));
  const DEG = Math.PI / 180;
  const SKY = {
    uZen: { value: col(0) }, uHor: { value: col(0) }, uSunC: { value: col(0) }, uAmb: { value: col(0) }, uHaze: { value: col(0) }, uCloudLit: { value: col(0) }, uCloudDark: { value: col(0) },
    uSun: { value: new THREE.Vector4() }, uMoon: { value: new THREE.Vector4() }, uWind: { value: new THREE.Vector2(-0.6, 0.2) },
    uNight: { value: 0 }, uCover: { value: 0 }, uFog: { value: 0 }, uWet: { value: 0 }, uCityL: { value: 0 }, uFlash: { value: 0 }, uExpo: { value: 1 }, uSunW: { value: 0.5 },
    uSnow: { value: 0 }, uLeaf: { value: 1 }, uBloom: { value: 0 }, uField: { value: col(0) }, uLeafC: { value: col(0) }, uRock: { value: col(0x77706a) }, uTime: { value: 0 },
    tFar: { value: tFar }, tMid: { value: tMid }, tCity: { value: tCity }, tTree: { value: tTree }, tNoise: { value: tNoise },
    uRC: { value: new THREE.Vector4(CA0 * DEG, CA1 * DEG, -16 * DEG, 6 * DEG) }, uRT: { value: new THREE.Vector4(TA0 * DEG, TA1 * DEG, -18 * DEG, 22 * DEG) }
  };
  const WV_FS = `uniform sampler2D tFar; uniform sampler2D tMid; uniform sampler2D tCity; uniform sampler2D tTree; uniform sampler2D tNoise;
  uniform vec3 uCam; uniform float uAzC; uniform float uTime;
  uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSunC; uniform vec3 uAmb; uniform vec3 uHaze; uniform vec3 uCloudLit; uniform vec3 uCloudDark;
  uniform vec4 uSun; uniform vec4 uMoon; uniform vec2 uWind; uniform vec4 uRC; uniform vec4 uRT;
  uniform float uNight; uniform float uCover; uniform float uFog; uniform float uWet; uniform float uCityL; uniform float uFlash; uniform float uExpo; uniform float uSunW;
  uniform float uSnow; uniform float uLeaf; uniform float uBloom; uniform vec3 uField; uniform vec3 uLeafC; uniform vec3 uRock;
  varying vec3 vP;
  const float PI = 3.14159265, TAU = 6.2831853, K = 4.3, ELO = -0.087;
  vec2 ang(vec3 d) { return vec2(atan(d.x, -d.z), atan(d.y, length(d.xz))); }
  vec3 dirOf(vec2 a) { return vec3(cos(a.y) * sin(a.x), sin(a.y), cos(a.y) * cos(a.x)); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec4 nz(vec2 p) { return texture2D(tNoise, p); }
  /* lámina de nubes: perspectiva de un plano horizontal, volumen con una muestra hacia el sol */
  vec4 clouds(vec2 s, vec3 v, float cs) {
    float el = s.y; if (el <= 0.0) return vec4(0.0);
    float dist = 1.0 / (sin(el) + 0.035);
    vec2 pc = vec2(sin(s.x), cos(s.x)) * dist * 0.11 + uWind * uTime * 0.004;
    vec2 sd = vec2(sin(uSun.x), cos(uSun.x)) * 0.035;
    float n = nz(pc * 0.5).r * 0.5 + nz(pc * 1.1 + 0.3).g * 0.3 + nz(pc * 2.3 + 0.7).b * 0.2;
    float n2 = nz((pc + sd) * 0.5).r * 0.5 + nz((pc + sd) * 1.1 + 0.3).g * 0.3 + nz((pc + sd) * 2.3 + 0.7).b * 0.2;
    float thr = mix(0.9, 0.3, uCover);
    float dens = smoothstep(thr, thr + 0.2, n);
    dens = max(dens, smoothstep(0.8, 1.0, uCover) * (0.82 + 0.18 * n));
    float lit = clamp(0.62 + (n - n2) * 5.0, 0.0, 1.0);
    vec3 c = mix(uCloudDark, uCloudLit, lit * (0.6 + 0.4 * uSun.z) + 0.15);
    c += uSunC * pow(max(cs, 0.0), 10.0) * (1.0 - dens) * 1.6 * uSun.z;            // borde plateado junto al sol
    c += vec3(0.95, 0.58, 0.32) * uCityL * 0.16 * (1.0 - lit) * smoothstep(0.6, 0.0, el);   // la ciudad ilumina las nubes por debajo
    float fade = 1.0 - smoothstep(9.0, 26.0, dist);
    /* cirros altos: estrías finas cuando hay pocas nubes */
    vec2 pk = vec2(sin(s.x), cos(s.x)) * (1.0 / (sin(el) + 0.12)) * vec2(0.05, 0.2) + uWind * uTime * 0.0015;
    float ci = smoothstep(0.62, 0.9, nz(pk).a) * smoothstep(0.08, 0.3, uCover) * (1.0 - smoothstep(0.45, 0.8, uCover)) * 0.4 * smoothstep(0.05, 0.3, el) * (1.0 - smoothstep(0.5, 0.9, el));
    float a = clamp(dens * fade + ci, 0.0, 1.0);
    return vec4(mix(c, uCloudLit, ci / max(a, 0.001) * 0.6), a);
  }
  vec4 layerUV(sampler2D t, vec2 sL, vec4 R) {
    float u = (sL.x - R.x) / (R.y - R.x), v = (sL.y - R.z) / (R.w - R.z);
    if (v < 0.0) return vec4(0.5, 0.0, 0.4, 1.0);
    return texture2D(t, vec2(u, min(v, 0.999)));
  }
  void main() {
    vec3 d = normalize(vP - uCam), dr = normalize(vP - vec3(0.0, -0.45, 6.6));
    vec2 aT = ang(d), aR = ang(dr), base = aR * K + vec2(uAzC, ELO), dl = aT - aR;
    /* cielo */
    vec2 s = base + dl;
    float el = s.y, h = max(el, 0.0);
    vec3 v = dirOf(s), sv = dirOf(uSun.xy);
    float cs = dot(v, sv);
    vec3 LA = uAmb * 0.62, LS = uSunC * 0.5 * uSun.z;
    vec3 sky = mix(uHor, uZen, 1.0 - exp(-h * 2.4));
    float twi = smoothstep(-0.3, -0.01, uSun.y) * (1.0 - smoothstep(0.06, 0.4, uSun.y));
    float side = pow(max(dot(normalize(v.xz + 1e-4), normalize(sv.xz + 1e-4)), 0.0), 3.0);
    sky += uSunC * twi * exp(-h * 5.0) * side * 0.55 * (1.0 - uCover * 0.7);
    sky += uSunC * (pow(max(cs, 0.0), 8.0) * 0.14 + pow(max(cs, 0.0), 120.0) * 0.4) * (0.3 + 0.7 * uSun.z) * (1.0 - uCover * 0.75);
    sky += vec3(1.0, 0.55, 0.25) * uCityL * 0.09 * exp(-h * 6.0);                 // resplandor de la ciudad de noche
    /* estrellas */
    vec2 sg = s * 95.0, id = floor(sg), f = fract(sg) - 0.5; float r = hash(id);
    float st = step(0.972, r) * smoothstep(0.2, 0.0, length(f - (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.6));
    sky += vec3(0.85, 0.9, 1.0) * st * (r - 0.972) * 34.0 * uNight * (1.0 - uCover) * (1.0 - uFog) * smoothstep(0.03, 0.25, el) * (0.75 + 0.25 * sin(uTime * 1.7 + r * 90.0));
    /* sol */
    float disc = smoothstep(0.99925, 0.99948, cs) * uSun.w;
    sky = mix(sky, mix(uSunC, vec3(1.0, 0.98, 0.93), 0.55) * 1.7, disc);
    /* luna, con su fase: se ilumina la cara que mira al sol */
    vec3 mv = dirOf(uMoon.xy); float cm = dot(v, mv);
    if (uMoon.w > 0.0 && cm > 0.998) {
      vec3 e1 = normalize(cross(vec3(0.0, 1.0, 0.0), mv)), e2 = cross(mv, e1);
      vec2 q = vec2(dot(v, e1), dot(v, e2)) / 0.036; float rr = length(q);
      if (rr < 1.0) {
        vec3 n = vec3(q, sqrt(1.0 - rr * rr)), Ls = normalize(vec3(dot(sv, e1), dot(sv, e2), -dot(sv, mv)));
        float lit = smoothstep(-0.06, 0.1, dot(n, Ls)), mar = nz(q * 0.18 + 0.4).g;
        vec3 mc = vec3(0.96, 0.94, 0.88) * (0.78 + 0.3 * mar) * lit + vec3(0.05, 0.06, 0.09);
        sky = mix(sky, mc * 1.3, smoothstep(1.0, 0.92, rr) * uMoon.w);
      }
    }
    sky += vec3(0.55, 0.65, 0.85) * pow(max(cm, 0.0), 600.0) * 0.35 * uMoon.w * uMoon.z * uNight;
    /* nubes */
    vec4 cl = clouds(s, v, cs);
    sky = mix(sky, cl.rgb, cl.a);
    sky += vec3(0.75, 0.8, 1.0) * uFlash * (0.5 + cl.a);
    sky = mix(sky, uHaze, exp(-h * 16.0) * (0.45 + 0.4 * uFog));
    vec3 col = sky;
    vec3 L = LA + LS;
    /* montes lejanos (Pirineo, Leyre, Urbasa, Aralar) */
    vec2 sF = base + dl * 0.9; vec4 m = layerUV(tFar, sF, vec4(0.0, TAU, -1.0 * PI / 180.0, 11.0 * PI / 180.0));
    float lt = mix(m.r, 1.0 - m.r, uSunW);
    vec3 alb = mix(uRock * vec3(0.9, 0.92, 1.0), uField * 0.7, m.b * 0.35);
    alb = mix(alb, vec3(0.8, 0.84, 0.92), smoothstep(0.7 - uSnow * 0.35, 0.76 - uSnow * 0.35, m.g) * step(0.01, uSnow));
    vec3 cF = alb * (LA + LS * (0.3 + 0.7 * lt));
    cF = mix(cF, uHaze, clamp(0.58 + uFog * 0.42 + uWet * 0.15, 0.0, 1.0));
    col = mix(col, cF, m.a * (1.0 - uFog * 0.6));
    /* sierras de la cuenca: Higa, Alaiz, el Perdón */
    vec2 sM = base + dl * 0.78; m = layerUV(tMid, sM, vec4(0.0, TAU, -2.0 * PI / 180.0, 10.0 * PI / 180.0));
    lt = mix(m.r, 1.0 - m.r, uSunW);
    alb = mix(uRock, mix(uField, vec3(0.05, 0.09, 0.035), 0.45), clamp(m.b * 1.1, 0.0, 1.0));
    alb = mix(alb, vec3(0.78, 0.82, 0.9), smoothstep(0.72 - uSnow * 0.3, 0.78 - uSnow * 0.3, m.g) * step(0.5, uSnow));
    vec3 cM = alb * (LA + LS * (0.25 + 0.75 * lt));
    cM = mix(cM, uHaze, clamp(0.27 + uFog * 0.62 + uWet * 0.12, 0.0, 1.0));
    col = mix(col, cM, m.a * (1.0 - uFog * 0.45));
    /* lomas y ciudad: las ventanas se encienden al anochecer, cada una a su hora */
    vec2 sC = base + dl * 0.55; m = layerUV(tCity, sC, uRC);
    vec3 cC;
    if (m.g > 0.5) {
      float on = step(m.b, uCityL);
      cC = mix(mix(vec3(0.03, 0.035, 0.05), uZen, 0.4) * L, vec3(1.0, 0.62, 0.26) * 1.6, on);
    } else if (m.b < 0.47) {
      cC = uField * (0.75 + 0.5 * m.b) * (LA + LS * (0.35 + 0.65 * m.r));
    } else if (m.b < 0.72) {
      cC = mix(vec3(0.34, 0.29, 0.24), vec3(0.52, 0.46, 0.37), (m.b - 0.5) * 4.0) * (LA * 0.9 + LS * (0.15 + 0.85 * m.r));
    } else {
      cC = mix(vec3(0.36, 0.11, 0.06), vec3(0.46, 0.2, 0.11), (m.b - 0.75) * 5.0) * (LA + LS * (0.3 + 0.7 * m.r));
    }
    cC = mix(cC, uHaze, clamp(0.09 + uFog * 0.72 + uWet * 0.1, 0.0, 1.0) * (m.g > 0.5 && m.b < uCityL ? 0.45 : 1.0));
    col = mix(col, cC, m.a);
    /* árboles del patio: ramas, hojas según la estación, flor en primavera */
    vec2 sT = base + dl * 0.25; m = layerUV(tTree, sT, uRT);
    if (m.a > 0.01) {
      vec3 cT; float a = m.a;
      if (m.b < 0.035) cT = vec3(0.06, 0.045, 0.035) * (LA + LS * (0.2 + 0.8 * m.r));
      else if (abs(m.g - 0.5) < 0.2) cT = vec3(0.025, 0.06, 0.025) * (0.6 + 0.6 * m.r) * (LA + LS * (0.3 + 0.7 * m.r));
      else {
        a *= step(m.b, uLeaf);
        vec3 lc = uLeafC * (0.55 + 0.7 * m.r);
        lc = mix(lc, vec3(0.9, 0.62, 0.7), step(0.8, m.g) * uBloom);
        cT = lc * (LA + LS * (0.25 + 0.75 * m.r));
      }
      cT = mix(cT, uHaze, clamp(0.04 + uFog * 0.4, 0.0, 1.0));
      col = mix(col, cT, a);
    }
    /* gotas en el cristal cuando llueve */
    if (uWet > 0.0) {
      vec2 gp = vP.xy * vec2(26.0, 20.0), gi = floor(gp), gf = fract(gp) - 0.5;
      float hr = hash(gi), rad = 0.12 + 0.22 * hash(gi + 5.3);
      vec2 off = (vec2(hash(gi + 1.7), hash(gi + 9.1)) - 0.5) * (0.9 - 2.0 * rad);
      float dd = length((gf - off) * vec2(1.0, 0.85)), drop = step(0.62, hr) * smoothstep(rad, rad * 0.7, dd) * uWet;
      float hi = step(0.62, hr) * smoothstep(rad * 0.45, rad * 0.15, length(gf - off + vec2(rad * 0.3, -rad * 0.35))) * uWet;
      col = mix(col, col * 0.72 + uHor * 0.22, drop) + vec3(0.18) * hi;
      col = mix(col, col * 0.82 + uHaze * 0.18, uWet * 0.5);
    }
    gl_FragColor = vec4(col * uExpo, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
  await ceder();
  const winMats = [], winGlows = [];
  const AZC = { [WINS[0]]: 112, [WINS[1]]: 180, [WINS[2]]: 246 };
  function viewWindow(x, w = 1.9, hh = 1.55) {
    const g = new THREE.Group(); g.position.set(x, 0, 0); scene.add(g);
    const mat = new THREE.ShaderMaterial({ uniforms: { ...SKY, uCam: { value: V() }, uAzC: { value: AZC[x] * DEG } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: WV_FS });
    const pane = plane(w, hh, mat, 0, 1.9, 0.01, g);
    pane.onBeforeRender = (r, sc, camera) => { const u = mat.uniforms.uCam.value; u.setFromMatrixPosition(camera.matrixWorld); pane.worldToLocal(u); };
    winMats.push(mat);
    plane(w, hh, basic(0xffffff, { map: glowTex, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending }), 0.25, 2.1, 0.02, g);   // reflejo en el cristal
    const wf = std(0xd8d2c6, { roughness: 0.4, metalness: 0.2 }), hw = w / 2 + 0.03;
    box(w + 0.12, 0.07, 0.1, wf, 0, 1.9 + hh / 2 + 0.03, 0.04, g); box(w + 0.12, 0.07, 0.1, wf, 0, 1.9 - hh / 2 - 0.03, 0.04, g); box(0.07, hh + 0.07, 0.1, wf, -hw, 1.9, 0.04, g); box(0.07, hh + 0.07, 0.1, wf, hw, 1.9, 0.04, g); box(0.04, hh, 0.06, wf, 0, 1.9, 0.04, g);
    box(w + 0.2, 0.05, 0.22, wf, 0, 1.9 - hh / 2 - 0.06, 0.1, g);
    winGlows.push(glowSprite(0xff9a5a, w * 1.6, 0, 1.9, 0.25, g, 0.12));
    return g;
  }
  const win = viewWindow(WIN_X); viewWindow(WINS[0]); const win3 = viewWindow(WINS[2]);

  /* lluvia, nieve, hojas o pétalos: un solo «Points» dentro del marco de las ventanas, con tope */
  const NPART = MOBILE ? 420 : 1100, pp = new Float32Array(NPART * 3), pseed = new Float32Array(NPART * 4);
  for (let i = 0; i < NPART; i++) { pp[i * 3] = WINS[i % 3]; pp[i * 3 + 1] = 1.9; pp[i * 3 + 2] = 0.014 + Math.random() * 0.02; pseed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4); }
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pgeo.setAttribute('seed', new THREE.BufferAttribute(pseed, 4));
  const partMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMode: { value: 0 }, uAmt: { value: 0 }, uWindX: { value: 0.2 }, uSize: { value: 26 * dpr }, uC: { value: col(0xdde6f0) }, uC2: { value: col(0xffffff) }, uLight: { value: 1 } },
    vertexShader: `attribute vec4 seed; uniform float uTime; uniform float uMode; uniform float uAmt; uniform float uWindX; uniform float uSize; varying float vA; varying float vD; varying float vR; varying float vS;
      void main(){
        vec3 p = position; float dpt = 0.35 + seed.z * 0.65;
        float sp = uMode < 0.5 ? 2.6 : uMode < 1.5 ? 0.16 : 0.09;
        float fy = fract(seed.y - uTime * sp * dpt * 0.42);
        float sway = uMode < 0.5 ? 0.0 : sin(uTime * (0.8 + seed.w) + seed.x * 30.0) * (uMode < 1.5 ? 0.03 : 0.08);
        float fx = fract(seed.x + uWindX * (1.0 - fy) * (uMode < 0.5 ? 0.25 : 0.6) * dpt + sway);
        p.x += (fx - 0.5) * 1.84; p.y += (fy - 0.5) * 1.48;
        vA = step(seed.w, uAmt) * smoothstep(0.0, 0.08, fy) * smoothstep(1.0, 0.9, fy); vD = dpt; vR = seed.w; vS = seed.x;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (uMode < 0.5 ? 1.3 : uMode < 1.5 ? 0.24 : 0.3) * dpt / -mv.z * 6.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uMode; uniform float uWindX; uniform vec3 uC; uniform vec3 uC2; uniform float uLight; varying float vA; varying float vD; varying float vR; varying float vS;
      void main(){
        vec2 q = gl_PointCoord - 0.5; float a;
        if (uMode < 0.5) { float x = q.x + q.y * uWindX * 0.35; a = (1.0 - smoothstep(0.0, 0.05 + 0.03 * vD, abs(x))) * (1.0 - smoothstep(0.25, 0.5, abs(q.y))) * 0.42 * vD; }
        else if (uMode < 1.5) a = smoothstep(0.5, 0.1, length(q)) * (0.35 + 0.5 * vD);
        else { float an = vS * 6.28 + vR * 3.0; mat2 R = mat2(cos(an), -sin(an), sin(an), cos(an)); vec2 r = R * q; a = smoothstep(0.5, 0.42, length(r * vec2(1.0, 2.4))); }
        vec3 c = uMode > 1.5 ? mix(uC, uC2, vR) * uLight : uC * uLight;
        gl_FragColor = vec4(c, a * vA);
      }`,
    transparent: true, depthWrite: false
  });
  const parts = new THREE.Points(pgeo, partMat); parts.frustumCulled = false; parts.renderOrder = 2; parts.visible = false; scene.add(parts);
  let flashT = 0, nextFlash = 6;
  /* aplica el cielo del momento a las ventanas, a las partículas y a la luz del pasillo */
  const tmpC = new THREE.Color();
  const setC = (u, c) => u.value.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  function aplicarCielo(e, repintar) {
    const P = e.paleta, W = e.tiempo, Tm = e.temporada, U = SKY;
    setC(U.uZen, P.zen); setC(U.uHor, P.hor); setC(U.uSunC, P.sol); U.uSunC.value.multiplyScalar(0.6 + 1.1 * P.luz);
    setC(U.uAmb, P.amb); U.uAmb.value.multiplyScalar(P.ambI * 0.95); setC(U.uHaze, P.niebla.map((v, i) => v * 0.6 + P.hor[i] * 0.4));
    const cl = P.hor.map((v, i) => (v * 0.55 + 0.45 * (P.ambI * 0.9 + P.luz * 0.4)) * (0.35 + 0.65 * Math.max(P.ambI, 0.12)));
    setC(U.uCloudLit, cl.map((v, i) => v * (1 - W.nubes * 0.25) + P.sol[i] * 0.15 * P.luz));
    setC(U.uCloudDark, P.zen.map((v, i) => (v * 0.5 + P.amb[i] * P.ambI * 0.5) * (0.65 - W.nubes * 0.15)));
    const sunUp = e.sol.alt > -1, direct = h01(P.luz * (1 - W.nubes * 0.92) * (1 - W.niebla));
    U.uSun.value.set(e.sol.az * DEG, e.sol.alt * DEG, direct, sunUp ? h01(1 - W.nubes * 1.05) : 0);
    U.uMoon.value.set(e.luna.az * DEG, e.luna.alt * DEG, e.luna.ilum, e.luna.alt > -2 ? h01(1 - W.nubes * 1.1) * h01(1.2 - P.luz * 2) : 0);
    U.uNight.value = P.noche; U.uCover.value = W.nubes; U.uFog.value = W.niebla;
    U.uWet.value = W.tipo === 'lluvia' || W.tipo === 'llovizna' ? 0.4 + 0.6 * W.intensidad : 0;
    const hl = CI.relojLocal(e.fecha).h, tarde = hl >= 1 && hl < 6 ? 0.22 : hl >= 6 && hl < 12 ? 0.4 : 0.55;
    U.uCityL.value = h01((-e.sol.alt + 1.5) / 9) * tarde + (W.nubes > 0.85 && P.luz < 0.5 ? 0.06 : 0);
    U.uExpo.value = 0.82 + 0.24 * h01(P.ambI * 1.1) + (P.expo - 1) * 0.5;
    U.uSunW.value = h01(0.5 + Math.sin((e.sol.az - 180) * DEG) * 0.6);
    U.uSnow.value = Tm.nieve; U.uLeaf.value = Tm.hojas; U.uBloom.value = Tm.flor;
    setC(U.uField, W.tipo === 'nieve' ? Tm.campo.map(v => v + (0.9 - v) * (0.35 + 0.4 * W.intensidad)) : Tm.campo); setC(U.uLeafC, Tm.colorHoja);
    const wv = W.viento || 8; U.uWind.value.set(-0.25 - wv / 30, 0.08);
    /* partículas */
    const modo = W.tipo === 'lluvia' || W.tipo === 'llovizna' ? 0 : W.tipo === 'nieve' ? 1 : Tm.caen ? 2 : Tm.petalos && W.nubes < 0.8 ? 3 : -1;
    parts.visible = modo >= 0; const pu = partMat.uniforms;
    pu.uMode.value = modo === 3 ? 2 : modo; pu.uAmt.value = modo === 0 ? (W.tipo === 'llovizna' ? 0.35 : 0.3 + 0.7 * W.intensidad) : modo === 1 ? 0.3 + 0.7 * W.intensidad : modo === 2 ? 0.012 + 0.02 * (1 - Tm.hojas) : 0.02;
    if (tier === 0) pu.uAmt.value *= 0.5;
    pu.uWindX.value = Math.min(1.2, wv / 25) * (modo === 0 ? 1 : 0.6);
    if (modo === 2) { setC(pu.uC, Tm.colorHoja); setC(pu.uC2, [0.78, 0.45, 0.16]); } else if (modo === 3) { setC(pu.uC, [1, 0.9, 0.93]); setC(pu.uC2, [1, 0.97, 0.98]); } else setC(pu.uC, modo === 1 ? [0.97, 0.98, 1] : [0.8, 0.86, 0.94]);
    pu.uLight.value = 0.5 + 0.8 * Math.max(P.ambI, P.luz * 0.8);
    flashT = 0; SKY.uFlash.value = 0;
    /* la luz dentro */
    const nl = luzDe(e), cambia = repintar && luzCambia(LZ, nl); LZ = nl;
    winRefl.forEach((m, i) => { m.material.color.setRGB(LZ.win[0], LZ.win[1], LZ.win[2], THREE.SRGBColorSpace); m.material.opacity = (i === 1 ? 0.3 : 0.2) * (0.25 + 0.75 * LZ.winK); });
    winGlows.forEach(s => { s.material.color.setRGB(LZ.win[0], LZ.win[1], LZ.win[2], THREE.SRGBColorSpace); s.material.opacity = 0.03 + 0.06 * LZ.winK; });
    if (cambia) { const job = () => { wallLM.userData.redraw(drawWallLM); floorLM.userData.redraw(drawFloorLM); if (space === MC._hall && !frozen) kick(0.1); }; (window.requestIdleCallback || setTimeout)(job, { timeout: 2000 }); }
  }
  { const wood2 = std(0x9a6a40, { roughness: 0.5 }); box(1.7, 0.06, 0.42, wood2, 0, 0.46, 0.4, win3); [-0.75, 0.75].forEach(dx => box(0.06, 0.44, 0.38, std(0x2a2d33, { metalness: 0.6, roughness: 0.4 }), dx, 0.22, 0.4, win3)); blob(2.0, 0.8, 0.4, 0, 0.004, 0.45, win3); }

  await ceder();
  /* cuadros enmarcados, cada uno con su lamparita */
  const ARTS = [
    (g, w, h) => {   // neurona de Cajal: tinta sobre papel
      g.fillStyle = '#f3ead6'; g.fillRect(0, 0, w, h); noise(g, w, h, 900, 0.1, ['#b9a985', '#ffffff']);
      g.strokeStyle = '#1d1610'; g.fillStyle = '#1d1610'; g.lineCap = 'round';
      const br = (x, y, a, len, wd, dep) => { if (dep <= 0 || len < 4) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + Math.sin(a) * len * 0.15, (y + y2) / 2, x2, y2); g.stroke(); br(x2, y2, a - 0.35 - rnd() * 0.3, len * 0.72, wd * 0.7, dep - 1); br(x2, y2, a + 0.3 + rnd() * 0.3, len * 0.68, wd * 0.7, dep - 1); };
      const cx = w / 2, cy = h * 0.5; g.beginPath(); g.moveTo(cx - 18, cy + 14); g.lineTo(cx, cy - 34); g.lineTo(cx + 18, cy + 14); g.closePath(); g.fill();
      br(cx, cy - 30, -Math.PI / 2, 70, 6, 6); br(cx - 14, cy + 10, Math.PI * 0.82, 50, 4, 5); br(cx + 14, cy + 10, Math.PI * 0.18, 50, 4, 5);
      g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx, cy + 14); g.bezierCurveTo(cx + 6, cy + 80, cx - 10, cy + 140, cx + 4, h - 70); g.stroke();
      g.font = 'italic 600 22px Fraunces'; g.textAlign = 'center'; g.fillText('Célula piramidal', cx, h - 40); g.font = '500 16px Fraunces'; g.fillText('S. Ramón y Cajal, 1899', cx, h - 16);
    },
    (g, w, h) => {   // micrografía teñida con hematoxilina-eosina
      const bg = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.8); bg.addColorStop(0, '#f6b6cf'); bg.addColorStop(1, '#e48bb0'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { const x = rnd() * w, y = rnd() * h, r = 16 + rnd() * 22; g.strokeStyle = 'rgba(190,60,120,.45)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, r, r * (0.7 + rnd() * 0.3), rnd() * 3, 0, 7); g.stroke(); g.fillStyle = 'rgba(92,40,140,.82)'; g.beginPath(); g.ellipse(x + rnd() * 4, y, 5 + rnd() * 4, 4 + rnd() * 3, rnd() * 3, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, h - 44, w, 44); g.fillStyle = '#5a2e6a'; g.font = '700 20px "Atkinson Hyperlegible"'; g.fillText('Epitelio · H-E · 40×', 16, h - 16);
    },
    (g, w, h) => {   // lámina botánica: dedalera (Digitalis purpurea)
      g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, w, h); noise(g, w, h, 1200, 0.1, ['#c8b892', '#ffffff']);
      g.strokeStyle = '#3d5a34'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, h - 90); g.bezierCurveTo(w / 2 - 10, h * 0.6, w / 2 + 12, h * 0.35, w / 2 - 4, 60); g.stroke();
      for (let k = 0; k < 4; k++) { const y = h - 110 - k * 42, s2 = k % 2 ? 1 : -1; g.fillStyle = '#6d9a4c'; g.beginPath(); g.ellipse(w / 2 + s2 * 60, y, 64 - k * 8, 18, s2 * -0.5, 0, 7); g.fill(); g.strokeStyle = '#3d5a34'; g.lineWidth = 1.5; g.stroke(); }
      for (let k = 0; k < 9; k++) { const y = 80 + k * 30, s2 = k % 2 ? 1 : -1, x = w / 2 + s2 * 18; g.fillStyle = '#b4559a'; g.beginPath(); g.ellipse(x + s2 * 14, y, 20, 13, s2 * 0.4, 0, 7); g.fill(); g.strokeStyle = '#6e2a5a'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = '#f7d7ea'; g.beginPath(); g.arc(x + s2 * 22, y + 2, 4, 0, 7); g.fill(); }
      g.fillStyle = '#221d2e'; g.textAlign = 'center'; g.font = 'italic 600 30px Fraunces'; g.fillText('Digitalis purpurea', w / 2, h - 46); g.font = '500 18px "Atkinson Hyperlegible"'; g.fillText('dedalera · de ella sale la digoxina', w / 2, h - 20);
    },
    (g, w, h) => {   // cartel ilustrado de Navarra
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a2a5e'); gr.addColorStop(0.45, '#c0587a'); gr.addColorStop(0.7, '#ff9a5a'); gr.addColorStop(1, '#ffd29a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff1c8'; g.beginPath(); g.arc(w * 0.66, h * 0.5, 46, 0, 7); g.fill();
      g.fillStyle = '#7a5a8a'; g.beginPath(); g.moveTo(0, h * 0.62); [[0.12, 0.46], [0.24, 0.56], [0.38, 0.4], [0.52, 0.55], [0.68, 0.44], [0.82, 0.57], [1, 0.48]].forEach(([a, b]) => g.lineTo(a * w, b * h)); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.fillStyle = '#3d2f4e'; g.beginPath(); g.moveTo(0, h * 0.76); for (let x = 0; x <= w; x += 10) g.lineTo(x, h * 0.74 + Math.sin(x * 0.02) * 8); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.strokeStyle = '#3d2f4e'; g.lineWidth = 10; g.beginPath(); for (let k = 0; k < 4; k++) { const x0 = w * 0.18 + k * w * 0.16; g.moveTo(x0, h * 0.86); g.arc(x0 + w * 0.08, h * 0.86, w * 0.08, Math.PI, 0); } g.stroke(); g.fillStyle = '#3d2f4e'; g.fillRect(w * 0.14, h * 0.79, w * 0.72, 14);   // puente románico
      g.fillStyle = '#fff6e6'; g.textAlign = 'center'; g.font = 'italic 600 68px Fraunces'; g.fillText('Navarra', w / 2, 92); g.font = '700 20px "Atkinson Hyperlegible"'; g.fillText('PIRINEO · RIBERA · CAMINO', w / 2, 126);
    }
  ];
  const artFrameM = std(0x2a211a, { roughness: 0.4 }), goldM = std(0xc8a46a, { roughness: 0.3, metalness: 0.8 });
  ART.forEach(([x, y, w, h], i) => {
    const g = new THREE.Group(); g.position.set(x, y, 0.02); scene.add(g);
    const t = 0.035, fm = i === 3 ? goldM : artFrameM;
    box(w + 2 * t, t, 0.04, fm, 0, h / 2 + t / 2, 0, g); box(w + 2 * t, t, 0.04, fm, 0, -h / 2 - t / 2, 0, g); box(t, h, 0.04, fm, -w / 2 - t / 2, 0, 0, g); box(t, h, 0.04, fm, w / 2 + t / 2, 0, 0, g);
    plane(w, h, basic(0xf6f1e6), 0, 0, 0.004, g);
    const pw = w * 0.84, ph = h * 0.86, tex = canvasTex(512, Math.round(512 * ph / pw), ARTS[i]);
    plane(pw, ph, std(0xffffff, { map: tex, roughness: 0.75 }), 0, 0, 0.008, g);
    const lampY = h / 2 + 0.12; box(Math.min(0.3, w * 0.6), 0.025, 0.05, goldM, 0, lampY, 0.06, g); box(0.012, 0.012, 0.06, goldM, 0, lampY, 0.025, g);
    glowSprite(0xffe2b0, w * 1.5, 0, h * 0.25, 0.08, g, 0.12);
  });
  await ceder();
  /* haz de luz: dos planos cruzados con un degradado que respira; el polvo solo se ve dentro */
  const BEAM_D = LZ.beam.clone();
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOp: { value: 0.0 }, uC: { value: col(0xff9e52) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uTime; uniform float uOp; uniform vec3 uC; varying vec2 vUv; void main(){ float along = 1.0 - vUv.y; float across = sin(vUv.x * 3.14159); float n = 0.82 + 0.18 * sin(vUv.y * 9.0 - uTime * 0.6) * sin(vUv.x * 7.0 + uTime * 0.35); float a = pow(across, 1.6) * pow(1.0 - along, 1.3) * smoothstep(0.0, 0.08, along) * n * uOp; gl_FragColor = vec4(uC * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  const beam = new THREE.Group(); beam.position.set(0, 1.9, 0.05); win.add(beam);
  beam.quaternion.setFromUnitVectors(V(0, -1, 0), BEAM_D);
  const bg = new THREE.PlaneGeometry(1.8, 4.6); bg.translate(0, -2.3, 0);
  [0, Math.PI / 2].forEach(r => { const m = new THREE.Mesh(bg, beamMat); m.rotation.y = r; m.renderOrder = 3; beam.add(m); });
  const NDUST = MOBILE ? 96 : 300, dp = new Float32Array(NDUST * 3), ds = new Float32Array(NDUST);
  for (let i = 0; i < NDUST; i++) { const t = Math.random() * 4.2, a = Math.random() * PI * 2, r = Math.sqrt(Math.random()) * 0.75; const p = V(0, 1.9, 0.05).addScaledVector(BEAM_D, t); dp[i * 3] = WIN_X + p.x + Math.cos(a) * r; dp[i * 3 + 1] = p.y + Math.sin(a) * r * 0.8; dp[i * 3 + 2] = p.z + Math.sin(a) * r * 0.6; ds[i] = Math.random(); }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dgeo.setAttribute('seed', new THREE.BufferAttribute(ds, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSize: { value: 42 * dpr }, uOp: { value: 0 }, uA: { value: V(WIN_X, 1.9, 0.05) }, uD: { value: BEAM_D }, uC: { value: col(0xffd89e) } },
    vertexShader: 'attribute float seed; uniform float uTime; uniform float uSize; uniform vec3 uA; uniform vec3 uD; varying float vA; void main(){ vec3 p = position; p.x += sin(uTime*0.21 + seed*31.0)*0.14; p.y += sin(uTime*0.13 + seed*17.0)*0.12; p.z += cos(uTime*0.17 + seed*23.0)*0.12; vec3 v = p - uA; float t = dot(v, uD); float r = length(v - uD*t); vA = smoothstep(0.85, 0.15, r) * smoothstep(-0.1, 0.5, t) * smoothstep(4.6, 2.2, t) * (0.55 + 0.45*sin(uTime*1.1 + seed*40.0)); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = uSize * (0.35 + seed*0.65) / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uOp; uniform vec3 uC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * uOp; gl_FragColor = vec4(uC * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const dust = new THREE.Points(dgeo, dustMat); dust.frustumCulled = false; dust.renderOrder = 4; scene.add(dust);
  /* el haz y el polvo siguen al sol: dirección, color y fuerza */
  function orientarHaz() {
    if (BEAM_D.angleTo(LZ.beam) > 0.02) {
      BEAM_D.copy(LZ.beam); beam.quaternion.setFromUnitVectors(V(0, -1, 0), BEAM_D);
      for (let i = 0; i < NDUST; i++) { const t = Math.random() * 4.2, a = Math.random() * PI * 2, r = Math.sqrt(Math.random()) * 0.75; const p = V(0, 1.9, 0.05).addScaledVector(BEAM_D, t); dp[i * 3] = WIN_X + p.x + Math.cos(a) * r; dp[i * 3 + 1] = p.y + Math.sin(a) * r * 0.8; dp[i * 3 + 2] = p.z + Math.sin(a) * r * 0.6; }
      dgeo.attributes.position.needsUpdate = true;
    }
    beamMat.uniforms.uC.value.setRGB(LZ.sun[0], LZ.sun[1], LZ.sun[2], THREE.SRGBColorSpace).multiplyScalar(0.5 + 0.4 * (1 - LZ.tanAlt / (LZ.tanAlt + 1)));
    dustMat.uniforms.uC.value.setRGB(LZ.sun[0], LZ.sun[1], LZ.sun[2], THREE.SRGBColorSpace).lerp(col(0xffffff), 0.3);
    if (introDone) beamMat.uniforms.uOp.value = LZ.beamOp;
  }
  let introDone = false;
  // banco bajo la ventana
  const wood = std(0x9a6a40, { roughness: 0.5 });
  box(1.7, 0.06, 0.42, wood, 0, 0.46, 0.4, win); [-0.75, 0.75].forEach(dx => box(0.06, 0.44, 0.38, std(0x2a2d33, { metalness: 0.6, roughness: 0.4 }), dx, 0.22, 0.4, win));
  blob(2.0, 0.8, 0.4, 0, 0.004, 0.45, win);
  // extintor y planta al fondo
  const ext = new THREE.Group(); ext.position.set(17.4, 0, 0.14); scene.add(ext);
  cyl(0.09, 0.09, 0.5, std(0xd8231f, { roughness: 0.35 }), 0, 0.85, 0, ext); cyl(0.03, 0.05, 0.08, std(0x222222), 0, 1.14, 0, ext); box(0.16, 0.18, 0.02, std(0x333333), 0, 0.85, -0.1, ext);
  buildPlant(scene, 19.0, 0, 0.45, 1.25);

  await ceder();
  /* ---------- puertas ---------- */
  const doors = {};
  const frameM = std(0xcac3b5, { roughness: 0.35, metalness: 0.35 });
  async function door(id, x) {
    const R = ROOMS[id], S = SUBJ[R.subs[0]];
    const g = new THREE.Group(); g.position.set(x, 0, 0); scene.add(g);
    box(0.09, 2.34, 0.14, frameM, -0.6, 1.17, 0.05, g); box(0.09, 2.34, 0.14, frameM, 0.6, 1.17, 0.05, g); box(1.29, 0.09, 0.14, frameM, 0, 2.34, 0.05, g);
    /* la sala, con profundidad: un plano con interior mapping (delante de la pared del pasillo, detrás de la hoja) */
    const atlas = imAtlas(id), innerC = atlas.light;
    const inner = plane(1.11, 2.26, imMaterial(atlas), 0, 1.13, 0.004, g); inner.visible = false;
    inner.onBeforeRender = (r, sc, camera) => { const u = inner.material.uniforms.uCam.value; u.setFromMatrixPosition(camera.matrixWorld); inner.worldToLocal(u); };
    const pivot = new THREE.Group(); pivot.position.set(0.555, 0, 0.035); g.add(pivot);   // bisagra a la derecha: la cámara mira desde la izquierda
    const vin = await svgImage(MC.vinylSVG(S.st, '#' + mix(S.c, 0x0e0f12, 0.75).getHexString()));
    const leafTex = canvasTex(256, 512, (c, w, h) => {
      c.fillStyle = '#' + mix(S.c, 0x0e0f12, 0.42).getHexString(); c.fillRect(0, 0, w, h);
      const sh = c.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(255,255,255,.07)'); sh.addColorStop(.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.18)'); c.fillStyle = sh; c.fillRect(0, 0, w, h);
      noise(c, w, h, 1200, 0.12, ['#ffffff', '#000000']);
      try { c.globalAlpha = 0.9; c.drawImage(vin, 18, 236, 168, 168); c.globalAlpha = 1; } catch (e) { }
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 6; c.strokeRect(14, 14, w - 28, h - 28);
      const kp = c.createLinearGradient(0, h * 0.88, 0, h); kp.addColorStop(0, '#c8ccd2'); kp.addColorStop(1, '#8b9097'); c.fillStyle = kp; c.fillRect(0, h * 0.885, w, h * 0.115);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, h * 0.885, w, 3);
    });
    box(1.11, 2.26, 0.05, std(0xffffff, { map: leafTex, roughness: 0.5, envMapIntensity: 0.6 }), -0.555, 1.13, 0, pivot);
    /* ventanita esmerilada: la misma sala, desenfocada, y a veces alguien que pasa */
    const winBase = D.createElement('canvas'); winBase.width = 64; winBase.height = 192;
    { const wb = winBase.getContext('2d'), src = atlas.tex.image, A = src.width; wb.filter = 'blur(4px)';
      wb.drawImage(src, A * 0.16, A * 0.02, A * 0.18, A * 0.44, -8, -8, 80, 208);
      wb.drawImage(src, A * 0.66, A * 0.05, A * 0.18, A * 0.42, -8, 40, 80, 170); wb.filter = 'none';
      const wg = wb.createLinearGradient(0, 0, 0, 192); wg.addColorStop(0, rgba('#' + atlas.light.getHexString(), .35)); wg.addColorStop(.6, 'rgba(0,0,0,0)'); wg.addColorStop(1, 'rgba(0,0,0,.45)'); wb.fillStyle = wg; wb.fillRect(0, 0, 64, 192); }
    const winTex = canvasTex(64, 192, () => {});
    const drawWin = (p) => winTex.userData.redraw((c, w, h) => {
      c.drawImage(winBase, 0, 0);
      if (p > -1 && p < 2) { c.save(); c.filter = 'blur(5px)'; c.fillStyle = 'rgba(20,16,24,.55)'; const x = -20 + p * (w + 40); c.beginPath(); c.ellipse(x, h * 0.42, 11, 13, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(x, h * 0.85, 20, 52, 0, 0, 7); c.fill(); c.restore(); }
      noise(c, w, h, 260, 0.18, ['#ffffff']);
    });
    drawWin(-2);
    const winM = basic(0xffffff, { map: winTex });
    plane(0.2, 0.62, winM, -0.25, 1.62, 0.027, pivot);
    box(0.24, 0.66, 0.012, frameM, -0.25, 1.62, 0.022, pivot);
    const img = await svgImage(MC.stickerSVG(S.st, R.subs[0]));
    const plTex = canvasTex(512, 256, (c, w, h) => {
      c.save(); rr(c, 0, 0, w, h, 22); c.clip();
      c.fillStyle = '#f7f2e7'; c.fillRect(0, 0, w, h);
      c.fillStyle = S.c; c.fillRect(0, 0, w, 44);
      c.restore();
      try { c.drawImage(img, 16, 62, 170, 170); } catch (e) { }
      c.fillStyle = '#221d2e'; fitFont(c, PLACA[id][0], '600', 'Fraunces', 58, 300); c.fillText(PLACA[id][0], 196, 136);
      c.fillStyle = '#4f485c'; fitFont(c, PLACA[id][1], '700', '"Atkinson Hyperlegible"', 26, 300); c.fillText(PLACA[id][1], 198, 176);
      const pr = MC.profsOf(id); c.fillStyle = '#221d2e'; fitFont(c, pr, '700', 'Caveat', 40, 300); c.fillText(pr, 198, 222);
    });
    plane(0.6, 0.3, std(0xffffff, { map: plTex, roughness: 0.35 }), -0.69, 1.36, 0.028, pivot);
    const handle = new THREE.Group(); handle.position.set(-1.0, 1.02, 0.05); pivot.add(handle);
    const chrome = std(0xdadde2, { metalness: 1, roughness: 0.25 });
    cyl(0.035, 0.035, 0.03, chrome, 0, 0, 0, handle).rotation.x = Math.PI / 2;
    box(0.16, 0.025, 0.03, chrome, 0.07, 0, 0.03, handle);
    const pool = plane(1.8, 2.4, basic(innerC, { map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.006, 0.9, g); pool.rotation.x = -Math.PI / 2;
    const spot = glowSprite(innerC, 0.9, 0.305, 1.62, 0.12, g, 0.18);
    /* la luz de la sala se escapa por debajo de la puerta */
    const lc = mix(S.c, 0xffffff, 0.25);
    box(1.1, 0.014, 0.012, basic(mix(S.c, 0xffffff, 0.6)), 0, 0.009, 0.064, g);
    const under = plane(1.5, 0.7, basic(lc, { map: glowTex, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.005, 0.2, g); under.rotation.x = -Math.PI / 2; under.scale.y = 0.6;
    /* supergráfico: el nombre de la materia pintado en grande sobre la puerta */
    const sgTex = canvasTex(1024, 256, (c, w, h) => {
      const txt = PLACA[id][0]; c.textBaseline = 'alphabetic';
      fitFont(c, txt, 'italic 500', 'Fraunces', 190, 980);
      const tw = c.measureText(txt).width, x0 = (w - tw) / 2;
      const ink = id === 'gest' ? S.d : '#' + mix(S.c, 0x000000, 0.12).getHexString();
      c.fillStyle = ink; c.fillText(txt, x0, 196);
      c.fillStyle = ink; c.fillRect(x0, 216, Math.min(tw, 120), 10);
    });
    const sgw = id === 'ipe' || id === 'gest' ? 1.45 : 1.55;
    plane(sgw, sgw / 4, basic(0xd8d0c4, { map: sgTex, transparent: true, depthWrite: false }), 0, 2.86, 0.012, g).renderOrder = 2;
    g.traverse(o => { if (o.isMesh) o.userData.spot = id; });
    doors[id] = { g, x, pivot, handle, pool, winM, base: winM.color.clone(), spot, inner, under, drawWin, pass: -2 };
    return g;
  }

  await ceder();
  /* ---------- corcho con el horario real ---------- */
  const AG = MC.AG;
  const cork = new THREE.Group(); cork.position.set(1.75, 0, 0); scene.add(cork);
  const corkTex = canvasTex(512, 320, (g, w, h) => { g.fillStyle = '#b8824c'; g.fillRect(0, 0, w, h); noise(g, w, h, 9000, 0.7, ['#8a5a2e', '#d9a46a', '#6e4421', '#e8bb85']); });
  box(1.84, 1.18, 0.05, std(0xffffff, { map: corkTex, roughness: 0.95 }), 0, 1.66, 0.03, cork);
  const fr = std(0x7a5332, { roughness: 0.5 });
  box(1.92, 0.05, 0.07, fr, 0, 2.27, 0.04, cork); box(1.92, 0.05, 0.07, fr, 0, 1.05, 0.04, cork); box(0.05, 1.27, 0.07, fr, -0.94, 1.66, 0.04, cork); box(0.05, 1.27, 0.07, fr, 0.94, 1.66, 0.04, cork);
  const schedTex = canvasTex(1024, 700, (g, w, h) => {
    g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(52,96,150,.16)'; g.lineWidth = 1; for (let y = 0; y < h; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } for (let x = 0; x < w; x += 26) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = '#221d2e'; g.font = '700 64px Caveat'; g.fillText('Horario · 1.º TSAPC', 40, 70);
    g.font = '700 26px "Atkinson Hyperlegible"'; g.fillStyle = '#4f485c'; g.fillText('tarde · 14:45–20:45', 640, 62);
    const x0 = 120, y0 = 110, cw = (w - x0 - 30) / 5, rows = AG.franjas, rh = (h - y0 - 24) / 6.5;
    const ry = []; let yy = y0 + 40; rows.forEach((f, i) => { ry.push(yy); yy += f[2] ? rh * 0.5 : rh; }); ry.push(yy);
    ['L', 'M', 'X', 'J', 'V'].forEach((d, i) => { const isT = MC.now().getDay() === i + 1; g.fillStyle = isT ? '#ad3326' : '#221d2e'; g.font = '700 34px Fraunces'; g.textAlign = 'center'; g.fillText(d, x0 + cw * i + cw / 2, y0 + 26); if (isT) { g.strokeStyle = '#ad3326'; g.lineWidth = 4; g.beginPath(); g.ellipse(x0 + cw * i + cw / 2, y0 + 14, 30, 24, -0.2, 0, Math.PI * 2); g.stroke(); } });
    g.textAlign = 'right'; g.font = '700 22px "Atkinson Hyperlegible"'; g.fillStyle = '#4f485c';
    rows.forEach((f, i) => { if (f[2]) return; const p = f[0].split(':').map(Number), h12 = (p[0] % 12 || 12) + ':' + String(p[1]).padStart(2, '0') + (p[0] >= 12 ? ' pm' : ' am'); g.font = '700 22px "Atkinson Hyperlegible"'; g.fillStyle = '#221d2e'; g.fillText(f[0], x0 - 12, ry[i] + 26); g.font = '600 16px "Atkinson Hyperlegible"'; g.fillStyle = '#6a6375'; g.fillText(h12, x0 - 12, ry[i] + 46); });
    const fi = (t, e) => rows.findIndex(f => (e ? f[1] : f[0]) === t);
    AG.horario.forEach(hh => {
      const S = SUBJ[hh[1]], a = fi(hh[2]), b = fi(hh[3], true);
      const x = x0 + cw * (hh[0] - 1) + 4, y = ry[a] + 3, hgt = ry[b + 1] - ry[a] - 6;
      g.fillStyle = S.t; rr(g, x, y, cw - 8, hgt, 10); g.fill();
      if (hh[4]) { g.save(); rr(g, x, y, cw - 8, hgt, 10); g.clip(); g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 8; for (let k = -hgt; k < cw; k += 22) { g.beginPath(); g.moveTo(x + k, y + hgt); g.lineTo(x + k + hgt, y); g.stroke(); } g.restore(); }
      g.strokeStyle = '#221d2e'; g.lineWidth = 2.5; rr(g, x, y, cw - 8, hgt, 10); g.stroke();
      g.fillStyle = '#221d2e'; g.textAlign = 'left'; g.font = '700 30px "Atkinson Hyperlegible"'; g.fillText(S.ab, x + 12, y + 36);
      g.font = '700 24px Caveat'; g.fillStyle = '#4f485c'; g.fillText(S.prof.split(' ')[0], x + 12, y + 60);
      if (hh[4]) { g.fillStyle = '#221d2e'; g.font = '700 18px "Atkinson Hyperlegible"'; g.fillText('LAB', x + cw - 58, y + 28); }
    });
    rows.forEach((f, i) => { if (f[2]) { g.fillStyle = 'rgba(255,214,64,.5)'; g.fillRect(x0, ry[i] + 4, cw * 5, ry[i + 1] - ry[i] - 8); g.fillStyle = '#4f485c'; g.textAlign = 'center'; g.font = '700 30px Caveat'; g.fillText('recreo 17:30–18:00', x0 + cw * 2.5, ry[i] + (ry[i + 1] - ry[i]) / 2 + 9); } });
  });
  const sheet = plane(1.24, 0.85, std(0xffffff, { map: schedTex, roughness: 0.8 }), -0.17, 1.66, 0.062, cork); sheet.rotation.z = -0.012;
  const exNext = MC.AG.ev.filter(e => (e.tipo === 'examen' || e.tipo === 'oral') && e.due > MC.now()).sort((x, y) => x.due - y.due);
  const exNote = (e, bg) => canvasTex(256, 256, (g) => { g.fillStyle = bg; g.fillRect(0, 0, 256, 256); g.fillStyle = '#221d2e'; g.font = '700 44px Caveat';
    if (!e) { g.fillText('Sin', 22, 90); g.fillText('exámenes', 22, 144); g.fillText('a la vista', 22, 198); return; }
    g.fillText(MC.relDay(e.date) + ':', 22, 70); g.fillText(e.tipo === 'oral' ? 'oral' : 'examen', 22, 124); fitFont(g, (e.corto || e.titulo).replace(/^Examen de /, ''), '700', 'Caveat', 44, 220); g.fillText((e.corto || e.titulo).replace(/^Examen de /, ''), 22, 178); g.font = '700 30px Caveat'; g.fillText('en clase', 22, 226); });
  const smallNote = exNote(exNext[0], exNext[0] ? SUBJ[exNext[0].s].t : '#c3adff');
  const sn = plane(0.3, 0.3, std(0xffffff, { map: smallNote, roughness: 0.8 }), 0.69, 1.86, 0.064, cork); sn.rotation.z = 0.08;
  const lineup = exNote(exNext[1], exNext[1] ? SUBJ[exNext[1].s].t : '#86e4c3');
  const sn2 = plane(0.28, 0.28, std(0xffffff, { map: lineup, roughness: 0.8 }), 0.7, 1.42, 0.064, cork); sn2.rotation.z = -0.06;
  const pinCols = [0xff6b5b, 0x8b5cf6, 0x2fc796, 0xf5ad1b, 0x3b82f6, 0xff8a3d];
  const pinPos = [[-0.76, 2.06], [0.42, 2.06], [-0.76, 1.27], [0.42, 1.27], [0.69, 1.99], [0.7, 1.54]];
  const pins = new THREE.InstancedMesh(new THREE.SphereGeometry(0.024, 14, 10), std(0xffffff, { roughness: 0.3 }), pinPos.length);
  const mm = new THREE.Matrix4();
  pinPos.forEach((p, i) => { mm.makeTranslation(p[0], p[1], 0.085); pins.setMatrixAt(i, mm); pins.setColorAt(i, col(pinCols[i])); });
  cork.add(pins);
  cork.traverse(o => { if (o.isMesh) o.userData.spot = 'horario'; });

  await ceder();
  /* ---------- nota adhesiva «Hoy» con su cuenta atrás ---------- */
  const noteG = new THREE.Group(); noteG.position.set(3.05, 1.56, 0.012); noteG.rotation.z = 0.05; scene.add(noteG);
  function drawNote(g, w, h) {
    g.fillStyle = '#fff2a8'; g.fillRect(0, 0, w, h);
    const sh = g.createLinearGradient(0, h - 60, 0, h); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(120,90,0,.12)'); g.fillStyle = sh; g.fillRect(0, h - 60, w, 60);
    g.fillStyle = '#ad3326'; g.font = '700 92px Caveat'; g.fillText('¡Hoy!', 34, 100);
    g.strokeStyle = '#ad3326'; g.lineWidth = 5; g.beginPath(); g.moveTo(36, 116); g.quadraticCurveTo(140, 104, 230, 118); g.stroke();
    g.fillStyle = '#221d2e'; g.font = '700 46px Caveat';
    const p = MC.pending(), n = MC.now();
    const today = p.filter(e => e.date.getDate() === n.getDate()).slice(0, 2);
    let y = 176;
    today.forEach(e => { g.fillStyle = SUBJ[e.s].d; g.fillText('• ' + SUBJ[e.s].ab + ' ' + e.hora, 34, y); y += 54; });
    if (!today.length) { g.fillText('Hoy, nada más.', 34, y); y += 54; }
    const nx = MC.nextExam(); if (nx) { g.fillStyle = SUBJ[nx.s].d; g.fillText('• ' + MC.relDay(nx.date) + ': ' + (nx.corto || nx.titulo).replace(/^Examen de /, ''), 34, y); } y += 60;
    if (p[0]) { g.fillStyle = '#221d2e'; g.font = '700 30px "Atkinson Hyperlegible"'; g.fillText('quedan ' + MC.countdown(p[0].due - n, true), 34, Math.min(y + 4, h - 26)); }
  }
  const noteTex = canvasTex(512, 512, drawNote);
  plane(0.44, 0.44, std(0xffffff, { map: noteTex, roughness: 0.85 }), 0, 0, 0, noteG);
  plane(0.2, 0.06, basic(0xffffff, { transparent: true, opacity: 0.55 }), 0, 0.22, 0.002, noteG).rotation.z = -0.1;
  noteG.traverse(o => { if (o.isMesh) o.userData.spot = 'hoy'; });
  setInterval(() => { noteTex.userData.redraw(drawNote); if (space === hall && !frozen) kick(0.1); }, 30000);

  await ceder();
  /* ---------- calendario colgado ---------- */
  const calG = new THREE.Group(); calG.position.set(5.85, 0, 0); scene.add(calG);
  const calTex = canvasTex(512, 700, (g, w, h) => {
    g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, w, h);
    const top = g.createLinearGradient(0, 0, w, 220); top.addColorStop(0, '#ff8a3d'); top.addColorStop(1, '#ad3326'); g.fillStyle = top; g.fillRect(0, 0, w, 220);
    g.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * 220, 14, 26, Math.random() * 3, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.font = '600 74px Fraunces'; g.fillText('Noviembre', 34, 130); g.font = '700 34px "Atkinson Hyperlegible"'; g.fillText('2026', 38, 182);
    const x0 = 24, y0 = 250, cw = (w - 48) / 7, rh = 72;
    g.font = '700 22px "Atkinson Hyperlegible"'; g.fillStyle = '#4f485c'; g.textAlign = 'center';
    ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach((d, i) => g.fillText(d, x0 + cw * i + cw / 2, y0));
    const off = 6; // 1 de noviembre de 2026 es domingo
    for (let d = 1; d <= 30; d++) {
      const idx = off + d - 1, c = idx % 7, r = Math.floor(idx / 7), cx = x0 + cw * c + cw / 2, cy = y0 + 46 + r * rh;
      if (d === 2) { g.fillStyle = 'rgba(255,107,91,.28)'; g.fillRect(cx - cw / 2 + 3, cy - 34, cw - 6, rh - 8); }
      g.fillStyle = c > 4 ? '#8a8494' : '#221d2e'; g.font = '700 30px Fraunces'; g.fillText(String(d), cx, cy);
      if (MC.now().getFullYear() === 2026 && MC.now().getMonth() === 10 && d === MC.now().getDate()) { g.strokeStyle = '#ad3326'; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy - 10, 26, 24, -0.2, 0, 7); g.stroke(); }
      const dots = { 3: ['#3b82f6', '#ff6b5b'], 4: ['#8b5cf6'], 5: ['#2fc796', '#5fb83a', '#ff8a3d'], 6: ['#ff8a3d'] }[d];
      if (dots) dots.forEach((dc, k) => { g.fillStyle = dc; g.beginPath(); g.arc(cx - (dots.length - 1) * 7 + k * 14, cy + 16, 5.5, 0, 7); g.fill(); });
      if (d === 6) { g.fillStyle = '#221d2e'; g.font = '700 24px Caveat'; g.fillText('fin trim.', cx, cy + 40); }
    }
    g.textAlign = 'left';
  });
  const calPaper = new THREE.Group(); calPaper.position.set(0, 2.18, 0.03); calG.add(calPaper);
  plane(0.72, 0.98, std(0xffffff, { map: calTex, roughness: 0.75, side: THREE.DoubleSide }), 0, -0.52, 0, calPaper);
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(0.018, 0.004, 6, 14), std(0x9aa0a8, { metalness: 0.9, roughness: 0.3 }), 9);
  for (let i = 0; i < 9; i++) { mm.makeTranslation(-0.32 + i * 0.08, -0.02, 0.004); rings.setMatrixAt(i, mm); } calPaper.add(rings);
  sph(0.016, std(0x555555, { metalness: 0.8, roughness: 0.3 }), 0, 0.12, 0.012, calPaper);
  const str = new THREE.BufferGeometry().setFromPoints([V(-0.3, -0.02, 0.006), V(0, 0.12, 0.012), V(0.3, -0.02, 0.006)]);
  calPaper.add(new THREE.Line(str, new THREE.LineBasicMaterial({ color: 0x333333 })));
  calG.traverse(o => { if (o.isMesh) o.userData.spot = 'calendario'; });

  for (const [id, x] of Object.entries(DOOR_X)) await door(id, x);

  /* ---------- puntos de interés ---------- */
  function nextFor(subs) { const e = MC.pending().find(x => subs.indexOf(x.s) >= 0); return e ? (e.corto || e.titulo) + ' · ' + MC.whenTxt(e).toLowerCase() : 'Nada pendiente esta semana.'; }
  const doorSpot = id => {
    const R = ROOMS[id], S = SUBJ[R.subs[0]], d = doors[id];
    return {
      id, x: d.x, anchor: V(d.x, 2.05, 0.12), color: S.c, tint: S.c, btn: id === 'digi' ? S.t : S.c,
      label: PLACA[id][0], aria: 'Entrar en ' + R.place, kicker: 'Puerta · ' + R.subs.map(s => SUBJ[s].name).join(' y '),
      title: R.place, go: 'Entrar',
      aria: 'Entrar en ' + R.place + ', con ' + MC.profsOf(id),
      sub: () => MC.profsOf(id) + '. ' + (R.units.length ? R.units.length + (R.units.length === 1 ? ' unidad. ' : ' unidades. ') : 'Todavía sin unidades. ') + nextFor(R.subs),
      act: () => enterRoom(id)
    };
  };
  const spots = [
    doorSpot('bio'), doorSpot('lab'),
    { id: 'horario', x: 1.75, anchor: V(1.75, 2.36, 0.1), color: '#ffcf8a', label: 'Horario', kicker: 'Corcho', title: 'Horario de la semana', go: 'Abrir el horario', btn: '#9cc0ff', tint: '#9cc0ff',
      sub: () => { const n = MC.now(), dw = n.getDay(), hs = AG.horario.filter(h => h[0] === dw), names = [...new Set(hs.map(h => SUBJ[h[1]].ab))], lab = hs.find(h => h[4]);
        return hs.length ? 'Hoy, ' + MC.DOW[dw] + ': ' + names.join(', ') + (lab ? ' (práctica de ' + lab[2] + ' a ' + lab[3] + ')' : '') + '.' : 'Hoy no hay clase.'; }, act: () => zoomTo('horario') },
    { id: 'hoy', x: 3.05, anchor: V(3.05, 1.86, 0.1), color: '#fff2a8', label: 'Hoy', kicker: 'Nota adhesiva', title: 'Lo de hoy', go: 'Abrir Hoy', btn: '#fff2a8', tint: '#fff2a8',
      sub: () => { const p = MC.pending()[0]; return p ? 'Lo primero: ' + (p.corto || p.titulo) + ' (' + SUBJ[p.s].ab + '), quedan ' + MC.countdown(p.due - MC.now(), true) + '.' : 'Nada urgente.'; }, act: () => zoomTo('hoy') },
    doorSpot('fisio'),
    { id: 'calendario', x: 5.85, anchor: V(5.85, 2.36, 0.1), color: '#86e4c3', label: 'Calendario', kicker: 'Colgado en la pared', title: 'Calendario', go: 'Abrir el calendario', btn: '#86e4c3', tint: '#86e4c3',
      sub: () => { const n = MC.now(), d0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()), d7 = new Date(d0.getTime() + 7 * 864e5), ex = AG.ev.filter(e => e.tipo !== 'entrega' && e.due > n && e.date < d7).length;
        return ex ? 'En los próximos 7 días: ' + (ex === 1 ? 'una prueba' : ex + ' pruebas (exámenes u orales)') + '. El 6 de noviembre acaba el primer trimestre.' : 'Mes y curso, con todas las fechas clave.'; }, act: () => zoomTo('calendario') },
    doorSpot('gest'), doorSpot('ipe'),
    { id: 'ventana', x: WIN_X, dx: 0.2, anchor: V(WIN_X + 0.6, 2.72, 0.1), color: '#9cc0ff', tint: '#9cc0ff', btn: '#9cc0ff', label: 'Ventana', kicker: 'Ventana · Pamplona, ahora', title: 'El cielo de fuera',
      get go() { return asomado ? 'Volver al pasillo' : 'Asomarse'; }, aria: 'Asomarse a la ventana: el cielo y el tiempo de Pamplona ahora',
      sub: () => { const e = estado || cieloAhora(), h = e.horas, t = +e.fecha, up = x => x.charAt(0).toUpperCase() + x.slice(1);
        /* hasta que llega el tiempo (o se sabe que no llega) no se afirma «despejado» */
        const tt = window.__cieloListo ? CI.lineaTiempo(window.__cieloTiempo || null, e.tiempo).replace(/^Pamplona · /, '') : 'mirando el cielo…';
        const so = h.salida && t < +h.salida ? 'Sale el sol a las ' + CI.hhmm(h.salida) : h.puesta && t < +h.puesta ? 'Se pone el sol a las ' + CI.hhmm(h.puesta) : 'El sol se puso a las ' + CI.hhmm(h.puesta);
        const est = { invierno: 'invierno', primavera: 'primavera', verano: 'verano', otono: 'otoño' }[e.temporada.nombre];
        return up(tt) + '. ' + so + '. ' + up(e.luna.nombre) + (e.luna.alt > 3 && e.luna.ilum > 0.15 && e.sol.alt < 15 && e.tiempo.nubes < 0.8 ? ', a la vista' : '') + '. Es ' + est + '.'; },
      act: () => asomarse() },
    doorSpot('ing'), doorSpot('digi'), doorSpot('sost')
  ];
  /* asomarse a la ventana: la cámara se acerca y mira afuera; el resto del pasillo queda detrás */
  let asomado = false;
  function asomarse(on = !asomado) {
    if (isBusy() || space !== MC._hall) return;
    asomado = on; const k = cfgFor(MC._hall.cfg), m = MOBILE || W < 760;
    gsap.killTweensOf(rig);
    gsap.to(beamMat.uniforms.uOp, { value: on ? LZ.beamOp * 0.12 : LZ.beamOp, duration: 0.6 });
    if (on) anim(rig, { y: 1.78, ly: 1.9, z: m ? 2.7 : 3.0, fov: m ? 60 : 48, off: 0, duration: 0.9, ease: 'power3.inOut' });
    else anim(rig, { y: k.y, ly: k.ly, z: k.z, fov: k.fov, off: k.off || 0, duration: 0.7, ease: 'power3.inOut' });
    updateCard(); poke();
  }
  const zoomTargets = { horario: [1.6, 1.66, 2.0], hoy: [3.05, 1.56, 1.25], calendario: [5.85, 1.66, 1.7] };
  const zoomTargetsM = { horario: [1.68, 1.5, 2.2], hoy: [3.05, 1.42, 1.3], calendario: [5.85, 1.5, 2.1] };

  let nextPass = 4, hoverDoor = null, focusDoor = null;
  /* la puerta elegida queda apenas entornada; con el ratón encima se abre a medias y baja el picaporte */
  const doorRest = id => (id === hoverDoor ? 1.05 : id === focusDoor ? 0.32 : 0);
  let lastHover = null;
  function settleDoors() {
    if (isBusy()) return;
    if (hoverDoor && hoverDoor !== lastHover && doors[hoverDoor]) anim(doors[hoverDoor].handle.rotation, { z: -0.5, duration: 0.14, ease: 'power2.in', yoyo: true, repeat: 1 });
    lastHover = hoverDoor;
    for (const k in doors) {
      const d = doors[k], y = doorRest(k), abre = y > d.pivot.rotation.y;
      /* cada orden nueva manda: se cancela lo que hubiera en marcha y se va al ángulo nuevo */
      gsap.killTweensOf(d.pivot.rotation); gsap.killTweensOf(d.under.material);
      if (Math.abs(d.pivot.rotation.y - y) > 0.001) anim(d.pivot.rotation, { y, duration: abre ? 0.6 : 0.45, ease: abre ? 'power3.out' : 'power2.inOut' });
      d.winM.color.copy(k === hoverDoor ? d.base.clone().multiplyScalar(1.25) : d.base);
      const luz = k === hoverDoor ? 0.75 : 0.4;   /* sale más luz por debajo */
      if (Math.abs(d.under.material.opacity - luz) > 0.01) anim(d.under.material, { opacity: luz, duration: 0.4 });
    }
  }
  /* la sala responde a la luz de fuera: color y dirección de la luz de la ventana, ambiente, niebla y exposición */
  let hallExpo = 1.0, estado = null;
  const fog0 = col(0x0d0f14);
  function luzSala() {
    const w = tmpC.setRGB(LZ.win[0], LZ.win[1], LZ.win[2], THREE.SRGBColorSpace).clone(), sc = col(0).setRGB(LZ.sun[0], LZ.sun[1], LZ.sun[2], THREE.SRGBColorSpace);
    dusk.color.copy(w).lerp(sc, LZ.direct); dusk.intensity = 0.2 + 0.75 * LZ.winK + 1.1 * LZ.direct;
    dusk.position.set(4 + Math.max(-0.95, Math.min(0.95, LZ.sinAz)) * 22, 2.4 + 5 * Math.min(1, LZ.tanAlt * 0.6), 5);
    sun.color.copy(w).lerp(sc, LZ.direct); sun.intensity = 1.2 + 2.2 * LZ.winK + 2.6 * LZ.direct;
    hemi.color.set(0xb9c4ff).lerp(w, 0.45);
    scene.fog.color.copy(fog0).lerp(w.clone().multiplyScalar(0.22), 0.5 * LZ.winK); scene.background.copy(scene.fog.color);
    hallExpo = 0.95 + 0.07 * LZ.winK;
  }
  function aplicarTodo(repintar) { estado = cieloAhora(); aplicarCielo(estado, repintar); orientarHaz(); luzSala(); }
  aplicarTodo(false);
  win.traverse(o => { if (o.isMesh) o.userData.spot = 'ventana'; });
  const alCambiar = () => { aplicarTodo(true); if (space === MC._hall) { if (spots[si] && spots[si].id === 'ventana') updateCard(); if (!frozen) kick(0.2); } };
  addEventListener('cielo:tiempo', alCambiar); addEventListener('cielo:reloj', alCambiar);
  const hall = {
    name: 'hall', get exposure() { return hallExpo; }, scene, spots, doors, pick: [cork, noteG, calG, win, ...Object.values(doors).map(d => d.g)], asomarse, range: [-3.0, 22.0],
    cfg: { y: 1.3, z: 6.7, ly: 1.6, fov: 42, off: -1.6, m: { y: 1.42, z: 5.9, ly: 1.5, fov: 52, off: -0.5 } },
    lights: { hemi, fluo, tubes, dusk, sun, baked, beamMat, dustMat, beamOp: () => LZ.beamOp, endIntro: () => { introDone = true; orientarHaz(); } },
    hover(id, on) { if (doors[id]) { hoverDoor = on ? id : null; settleDoors(); } if (id === 'calendario' && on) anim(calPaper.rotation, { z: 0.06, duration: 0.25, yoyo: true, repeat: 1 }); },
    onFocus(s) { focusDoor = doors[s.id] ? s.id : null; settleDoors(); if (asomado && s.id !== 'ventana') asomarse(false); },
    onResize() { asomado = false; },
    get cielo() { return estado; },
    doorRest,
    idle(t, dt, vr) {
      fluo.position.x = rig.x + 1; fluo.target.position.x = rig.x; fluo.target.updateMatrixWorld();
      for (const k in doors) { const d = doors[k]; d.inner.visible = d.pivot.rotation.y > 0.003; }
      if (!ambientOn()) return false;
      beamMat.uniforms.uTime.value = t; dustMat.uniforms.uTime.value = t; SKY.uTime.value = t; partMat.uniforms.uTime.value = t;
      if (estado && estado.tiempo.tormenta) { if (t > nextFlash) { flashT = 0.4; nextFlash = t + 5 + Math.random() * 11; } if (flashT > 0) { flashT = Math.max(0, flashT - dt); SKY.uFlash.value = flashT / 0.4 * (0.55 + 0.45 * Math.sin(flashT * 70)); } }
      dustMat.uniforms.uOp.value = tier > 0 ? Math.min(1, LZ.direct * 1.5) : 0;
      Object.values(doors).forEach((d, k) => {
        if (d.x < vr[0] - 1 || d.x > vr[1] + 1) return;
        d.under.material.opacity = 0.32 + Math.sin(t * 1.3 + k * 1.7) * 0.1;
        if (d.pass > -1.5) { d.pass += dt / 1.3; d.drawWin(d.pass); if (d.pass > 2) { d.pass = -2; d.drawWin(-2); } }
      });
      if (t > nextPass) { nextPass = t + 8 + Math.random() * 6; const vis = Object.values(doors).filter(d => d.x > vr[0] && d.x < vr[1]); const d = vis[Math.floor(Math.random() * vis.length)]; if (d && d.pass <= -1.5) d.pass = -1; }
      return true;
    },
    zoomTargets, zoomTargetsM
  };
  MC._hall = hall;
  return hall;
}

/* ---------- espacio activo ---------- */
function setSpace(s, startIndex = 0) {
  space = s; applyCfg(s.cfg); buildHotspots(); applyView();
  if (s.spots && s.spots.length) setIndex(startIndex, true);
}

/* ---------- acercarse al corcho, a la nota o al calendario ----------
   La capa 'nb' se apila al empezar: si se pulsa «volver» durante el acercamiento,
   el cuaderno no llega a abrirse y la cámara vuelve sola. */
let camBack = null;
function zoomTo(id) {
  return NAV.forward('zooming', async () => {
    NAV.push('nb');
    const T = (MOBILE || W < 760 ? hall.zoomTargetsM : hall.zoomTargets)[id];
    camBack = { space, x: rig.x, y: rig.y, z: rig.z, ly: rig.ly, fov: rig.fov, off: rig.off };
    rig.lock = true;
    const tl = gsap.timeline();
    tl.to(rig, { x: T[0], tx: T[0], y: T[1] + 0.05, ly: T[1], z: T[2], fov: 40, px: 0, py: 0, off: 0, duration: 0.85, ease: 'power3.inOut' });
    animTL(tl); await tl;
    if (NAV.cancelled()) return;
    MC.showNb(id, null, 'pasillo');
  });
}
/* al cerrarse el cuaderno: se descongela y la cámara vuelve a donde estaba */
async function nbClosed(instant) {
  freeze(false);
  const b = camBack; camBack = null;
  if (!b || b.space !== space) { rig.lock = false; return; }
  const to = { x: b.x, y: b.y, z: b.z, ly: b.ly, fov: b.fov, off: b.off };
  if (instant || MC.nav.cancelled()) { Object.assign(rig, to); rig.tx = rig.x; rig.lock = false; render(); return; }
  rig.lock = true;
  const tl = gsap.timeline({ delay: 0.05 }); tl.to(rig, { ...to, duration: 0.75, ease: 'power3.inOut' });
  animTL(tl); await tl;
  rig.tx = rig.x; rig.lock = false;
}

/* =========================================================
   Salas: se construyen al entrar y se liberan al salir
   ========================================================= */
const wait = ms => new Promise(r => setTimeout(r, ms));
const glassMat = (c = 0xdff3f0, op = 0.22) => std(c, { roughness: 0.05, metalness: 0, transparent: true, opacity: op, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide });
const white = () => std(0xf1f0ec, { roughness: 0.35, envMapIntensity: 0.7 });
const darkM = () => std(0x2a2d33, { roughness: 0.35, metalness: 0.8 });
const metalM = () => std(0x9aa0a8, { roughness: 0.28, metalness: 1 });

/* carcasa de sala: pared, suelo y techo con la luz pintada (un charco protagonista
   del color de la sala y penumbra alrededor). Cada sala, su exposición. */
function roomShell(o) {
  const scene = new THREE.Scene();
  scene.background = col(o.bg || 0x101216); scene.fog = new THREE.Fog(o.bg || 0x101216, 8, 17); scene.environment = envTex;
  const hemi = new THREE.HemisphereLight(o.sky || 0xeef2ff, 0x2a2018, 0.05); scene.add(hemi);
  const key = new THREE.DirectionalLight(o.key || 0xfff3e2, 0); key.position.set(3, 6, 6); key.target.position.set(3, 0.8, 0); scene.add(key, key.target);
  const fill = new THREE.PointLight(o.fillC || 0xffb36b, 0, 9, 1.6); fill.position.set(o.fillX ?? 2, 2.4, 2.4); scene.add(fill);
  const x0 = o.x0, x1 = o.x1, LEN = x1 - x0, CX = (x0 + x1) / 2, PX = o.poolX ?? 1.1, PI = Math.PI;
  const pool = o.pool || 'rgba(255,236,210,.9)', amb = o.amb || 'rgb(64,60,58)';
  const wallLM = canvasTex(512, 128, (g, w, h) => {
    const xx = X => (X - x0) / LEN * w, m = w / LEN, yy = Y => (1 - Y / 3.4) * h;
    g.fillStyle = amb; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    g.save(); g.translate(xx(PX), yy(1.5)); g.scale(1, 0.75); const r = g.createRadialGradient(0, 0, 0, 0, 0, 3.6 * m); r.addColorStop(0, pool); r.addColorStop(.55, pool.replace(/[\d.]+\)$/, '.28)')); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(-6 * m, -6 * m, 12 * m, 12 * m); g.restore();
    (o.spots2 || []).forEach(([X, Y, R, c]) => { const r2 = g.createRadialGradient(xx(X), yy(Y), 0, xx(X), yy(Y), R * m); r2.addColorStop(0, c); r2.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r2; g.fillRect(0, 0, w, h); });
    g.globalCompositeOperation = 'source-over';
    const t = g.createLinearGradient(0, 0, 0, h * 0.22); t.addColorStop(0, 'rgba(0,0,0,.7)'); t.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = t; g.fillRect(0, 0, w, h * 0.22);
    const b = g.createLinearGradient(0, h, 0, h * 0.86); b.addColorStop(0, 'rgba(0,0,0,.55)'); b.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = b; g.fillRect(0, h * 0.86, w, h * 0.14);
    const e = g.createLinearGradient(0, 0, w, 0); e.addColorStop(0, 'rgba(0,0,0,.6)'); e.addColorStop(.18, 'rgba(0,0,0,0)'); e.addColorStop(.82, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = e; g.fillRect(0, 0, w, h);
  });
  const fT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = o.floor || '#5b6461'; g.fillRect(0, 0, w, h); noise(g, w, h, 2200, 0.35, ['#ffffff', '#000000']); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); });
  fT.wrapS = fT.wrapT = THREE.RepeatWrapping; fT.repeat.set(LEN / 1, 8 / 1);
  const floorLM = canvasTex(512, 256, (g, w, h) => {
    const xx = X => (X - x0) / LEN * w, m = w / LEN, mz = h / 8;
    g.fillStyle = amb; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    g.save(); g.translate(xx(PX), 1.0 * mz); g.scale(1, mz / m * 1.2); const r = g.createRadialGradient(0, 0, 0, 0, 0, 3.2 * m); r.addColorStop(0, pool); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(-6 * m, -6 * m, 12 * m, 12 * m); g.restore();
    g.globalCompositeOperation = 'source-over';
    const a = g.createLinearGradient(0, 0, 0, 0.5 * mz); a.addColorStop(0, 'rgba(0,0,0,.7)'); a.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = a; g.fillRect(0, 0, w, 0.5 * mz);
    const f = g.createLinearGradient(0, 2.5 * mz, 0, h); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,.65)'); g.fillStyle = f; g.fillRect(0, 2.5 * mz, w, h);
  });
  const floor = plane(LEN, 8, basic(0xffffff, { map: fT, lightMap: floorLM, lightMapIntensity: PI * 1.25 }), CX, 0, 4, scene); floor.rotation.x = -Math.PI / 2;
  const wallMat = o.wallTex ? basic(0xffffff, { map: o.wallTex, lightMap: wallLM, lightMapIntensity: PI * 1.3 }) : basic(o.wall || 0xe4ddd0, { lightMap: wallLM, lightMapIntensity: PI * 1.3 });
  plane(LEN, 3.4, wallMat, CX, 1.7, 0, scene);
  if (o.band) plane(LEN, o.bandH || 0.9, std(o.band, { roughness: 0.6 }), CX, (o.bandH || 0.9) / 2, 0.003, scene);
  const sideMat = basic(mix(o.wall || 0x8a8a8a, 0x000000, 0.72));
  [[x0, Math.PI / 2], [x1, -Math.PI / 2]].forEach(([x, r]) => { const m = plane(8, 3.4, sideMat, x, 1.7, 4, scene); m.rotation.y = r; });
  const ceil = plane(LEN, 8, basic(0x1a1c21), CX, 3.4, 4, scene); ceil.rotation.x = Math.PI / 2;
  const tubes = [];
  for (let x = x0 + 1.4; x < x1 - 0.6; x += 2.4) { box(1.4, 0.05, 0.26, std(0xbfc3c8), x, 3.39, 1.9, scene); tubes.push(box(1.3, 0.035, 0.16, basic(0x050505), x, 3.355, 1.9, scene).material); }
  const baked = [wallMat, floor.material]; baked.forEach(m => { m.userData.lmi = m.lightMapIntensity; });
  return { scene, hemi, key, fill, tubes, CX, LEN, x0, x1, baked, exposure: o.exposure || 1, on: o.on || { hemi: 0.6, key: 1.5, fill: 3 } };
}
function lightsOn(sh, fast) {
  const tl = gsap.timeline();
  if (fast) { sh.hemi.intensity = sh.on.hemi; sh.key.intensity = sh.on.key; sh.fill.intensity = sh.on.fill; sh.tubes.forEach(m => m.color.setRGB(1, 0.97, 0.9)); sh.baked.forEach(m => { m.lightMapIntensity = m.userData.lmi; }); return tl; }
  sh.baked.forEach(m => { m.lightMapIntensity = m.userData.lmi * 0.12; });
  sh.tubes.forEach((m, i) => {
    const d = 0.05 + i * 0.07;
    tl.add(() => m.color.setRGB(0.9, 0.87, 0.8), d).add(() => m.color.setRGB(0.05, 0.05, 0.05), d + 0.06).add(() => m.color.setRGB(1, 0.97, 0.9), d + 0.2);
  });
  tl.to(sh.hemi, { intensity: sh.on.hemi, duration: 0.7 }, 0.2).to(sh.key, { intensity: sh.on.key, duration: 0.8 }, 0.25).to(sh.fill, { intensity: sh.on.fill, duration: 0.8 }, 0.25)
    .to(sh.baked, { lightMapIntensity: (i, m) => m.userData.lmi, duration: 0.9, ease: 'power2.out', stagger: 0.1 }, 0.25);
  return animTL(tl);
}
/* polvo dorado o motas en el aire de una sala (todo en la GPU) */
function motes(parent, n, box3, color, size = 30) {
  const pos = new Float32Array(n * 3), sd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = box3[0] + Math.random() * (box3[1] - box3[0]); pos[i * 3 + 1] = box3[2] + Math.random() * (box3[3] - box3[2]); pos[i * 3 + 2] = box3[4] + Math.random() * (box3[5] - box3[4]); sd[i] = Math.random(); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(sd, 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uSize: { value: size * dpr }, uC: { value: col(color) } },
    vertexShader: 'attribute float seed; uniform float uTime; uniform float uSize; varying float vA; void main(){ vec3 p = position; p.x += sin(uTime*0.2 + seed*29.0)*0.15; p.y += sin(uTime*0.15 + seed*13.0)*0.12; p.z += cos(uTime*0.18 + seed*7.0)*0.1; vA = 0.4 + 0.6*sin(uTime*0.9 + seed*50.0); vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = uSize*(0.3+seed*0.7)/-mv.z; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 uC; varying float vA; void main(){ float a = smoothstep(0.5,0.0,length(gl_PointCoord-0.5))*vA*0.8; gl_FragColor = vec4(uC*a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; parent.add(pts); return mat;
}
function bench(parent, xa, xb, o = {}) {
  const L = xb - xa, cx = (xa + xb) / 2, top = o.top ?? 0.92, d = o.d ?? 0.8, z = o.z ?? 0.45;
  box(L, 0.06, d, std(o.topC ?? 0x17191d, { roughness: o.rough ?? 0.28, envMapIntensity: 0.9 }), cx, top - 0.03, z, parent);
  if (o.legs) { [[xa + 0.06, z - d / 2 + 0.06], [xb - 0.06, z - d / 2 + 0.06], [xa + 0.06, z + d / 2 - 0.06], [xb - 0.06, z + d / 2 - 0.06]].forEach(([x, zz]) => box(0.05, top - 0.06, 0.05, darkM(), x, (top - 0.06) / 2, zz, parent)); }
  else {
    const cab = canvasTex(512, 128, (g, w, h) => { g.fillStyle = o.cabC || '#d9dcdf'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; for (let x = 0; x < w; x += 64) g.strokeRect(x + 3, 6, 58, h - 12); g.fillStyle = '#7d828a'; for (let x = 0; x < w; x += 64) g.fillRect(x + 22, 18, 20, 5); });
    cab.wrapS = THREE.RepeatWrapping; cab.repeat.set(L / 1.2, 1);
    box(L - 0.04, top - 0.12, d - 0.06, std(0xffffff, { map: cab, roughness: 0.6 }), cx, (top - 0.12) / 2 + 0.06, z - 0.02, parent);
    box(L - 0.04, 0.06, d - 0.12, std(0x15171a), cx, 0.03, z - 0.06, parent);
  }
  blob(L + 0.4, d + 0.6, 0.35, cx, 0.003, z + 0.1, parent);
  return top;
}
function poster(parent, x, y, w, h, draw, z = 0.012, rot = 0) {
  const t = canvasTex(512, Math.round(512 * h / w), draw);
  const m = plane(w, h, std(0xffffff, { map: t, roughness: 0.8 }), x, y, z, parent); m.rotation.z = rot; return m;
}
function tagSpot(group, id) { group.traverse(o => { if (o.isMesh || o.isInstancedMesh) o.userData.spot = id; }); group.userData.spot = id; }

/* reloj de pared con la hora de verdad (más un desfase en horas, para otras ciudades) */
function wallClock(parent, x, y, z, r, label, offH = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  cyl(r, r, 0.035, std(0x2a2d33, { roughness: 0.4 }), 0, 0, 0, g, 32).rotation.x = Math.PI / 2;
  const face = canvasTex(256, 256, (c) => { c.fillStyle = '#fbf7ee'; c.beginPath(); c.arc(128, 128, 124, 0, 7); c.fill(); c.fillStyle = '#221d2e'; for (let i = 0; i < 12; i++) { c.save(); c.translate(128, 128); c.rotate(i * Math.PI / 6); c.fillRect(-3, -116, 6, i % 3 ? 14 : 26); c.restore(); } c.textAlign = 'center'; fitFont(c, label, '700', '"Atkinson Hyperlegible"', 30, 150); c.fillText(label, 128, 186); });
  plane(r * 1.8, r * 1.8, basic(0xffffff, { map: face, transparent: true }), 0, 0, 0.019, g);
  const hand = (len, w, c, k) => { const p = new THREE.Group(); p.position.z = 0.022 + k * 0.003; g.add(p); box(w, len, 0.003, basic(c), 0, len / 2 - r * 0.12, 0, p); return p; };
  const hH = hand(r * 0.5, r * 0.07, 0x221d2e, 0), hM = hand(r * 0.75, r * 0.05, 0x221d2e, 1), hS = hand(r * 0.8, r * 0.02, 0xd8231f, 2);
  const set = () => { const n = MC.now(), s2 = n.getSeconds(), m = n.getMinutes() + s2 / 60, h = ((n.getHours() + offH + 24) % 12) + m / 60; hS.rotation.z = -s2 / 60 * Math.PI * 2; hM.rotation.z = -m / 60 * Math.PI * 2; hH.rotation.z = -h / 12 * Math.PI * 2; };
  set(); return { g, set };
}
/* unidad → punto de interés */
function unitSpot(uid, x, react, o = {}) {
  const U = UNITS[uid], S = SUBJ[U.s];
  const ev = MC.AG.ev.find(e => e.unidad === uid);
  return {
    id: uid, x, anchor: o.anchor || V(x, 1.9, 0.5), color: S.c, btn: S.c, label: o.label || U.t,
    kicker: U.code + ' · ' + S.name, title: U.t, go: o.go || 'Abrir la unidad',
    sub: () => U.blocks.length + (U.bl === 'Entrega' ? ' entregas' : ' bloques') + (ev ? ' · ' + (ev.tipo === 'examen' ? 'examen ' : '') + MC.whenTxt(ev).toLowerCase() : ' en el repaso'),
    act: o.act || (() => reactAndOpen(x, react, () => MC.showNb('unit', uid, 'sala'))), alt: o.alt
  };
}
/* el objeto reacciona, la cámara se acerca un poco y se abre su página */
function reactAndOpen(x, react, open) {
  return NAV.forward('reacting', async () => {
    NAV.push('nb');
    camBack = { space, x: rig.x, y: rig.y, z: rig.z, ly: rig.ly, fov: rig.fov, off: rig.off };
    rig.lock = true;
    react && react();
    const tl = gsap.timeline(); tl.to(rig, { x, tx: x, z: rig.z - 0.7, y: rig.y - 0.08, duration: 0.85, ease: 'power3.inOut' });
    animTL(tl); kick(1.2); await tl; await wait(80);
    if (NAV.cancelled()) return;
    open();
  });
}

/* ---------- objetos reutilizables ---------- */
function microscope(parent, x, y, z, accent) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const wm = white(), dm = darkM(), ac = std(accent, { roughness: 0.4 });
  rbox(0.26, 0.05, 0.32, 0.015, wm, 0, 0.025, 0, g);
  const arm = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0.04, -0.11), V(0, 0.2, -0.13), V(0, 0.36, -0.08), V(0, 0.42, 0.0)]), 20, 0.035, 10), wm, 0, 0, 0, g);
  box(0.2, 0.015, 0.18, dm, 0, 0.2, 0.03, g);
  const lamp = cyl(0.035, 0.035, 0.012, basic(0x333333), 0, 0.19, 0.03, g);
  const rev = new THREE.Group(); rev.position.set(0, 0.34, 0.03); g.add(rev);
  cyl(0.05, 0.05, 0.03, dm, 0, 0, 0, rev);
  [0, 2.1, 4.2].forEach(a => { const ob = cyl(0.012, 0.016, 0.07, metalM(), Math.cos(a) * 0.03, -0.045, Math.sin(a) * 0.03, rev); ob.rotation.z = Math.cos(a) * 0.25; });
  const tube = cyl(0.028, 0.028, 0.16, wm, 0, 0.43, 0.06, g); tube.rotation.x = -0.55;
  const eye = cyl(0.018, 0.018, 0.08, dm, 0, 0.51, 0.115, g); eye.rotation.x = -0.55;
  cyl(0.032, 0.032, 0.012, ac, 0, 0.37, 0.04, g);
  [-1, 1].forEach(s => { const k = cyl(0.04, 0.04, 0.02, dm, s * 0.05, 0.12, -0.11, g); k.rotation.z = Math.PI / 2; });
  blob(0.5, 0.5, 0.5, 0, 0.003, 0, g);
  const glow = glowSprite(0xfff1d6, 0.2, 0, 0.21, 0.03, g, 0);
  return { g, rev, lamp, glow };
}
function erlenmeyer(parent, x, y, z, liquidC, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale); parent.add(g);
  const prof = [[0.0, 0.0], [0.36, 0.0], [0.4, 0.03], [0.4, 0.06], [0.13, 0.62], [0.11, 0.66], [0.11, 0.9], [0.135, 0.92], [0.135, 0.95]].map(([a, b]) => new THREE.Vector2(a, b));
  mesh(new THREE.LatheGeometry(prof, 32), glassMat(), 0, 0, 0, g);
  const rAt = yy => yy < 0.06 ? 0.37 : THREE.MathUtils.lerp(0.37, 0.1, Math.min(1, (yy - 0.06) / 0.56));
  const top = 0.32;
  const liq = [[0, 0.012], [0.36, 0.012], [0.375, 0.04], [rAt(top) - 0.01, top], [0, top]].map(([a, b]) => new THREE.Vector2(a, b));
  const lm = std(liquidC, { emissive: liquidC, emissiveIntensity: 0.35, roughness: 0.15, transparent: true, opacity: 0.85 });
  mesh(new THREE.LatheGeometry(liq, 32), lm, 0, 0, 0, g);
  const NB = 26, bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), std(0xeafff7, { emissive: 0x9fffe0, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 }), NB);
  const B = Array.from({ length: NB }, (_, i) => ({ y: Math.random() * top, a: Math.random() * 6.28, r: Math.random(), s: 0.01 + Math.random() * 0.018, v: 0.08 + Math.random() * 0.16 }));
  g.add(bub);
  const M = new THREE.Matrix4(); let boost = 0;
  function idle(t, dt) {
    boost = Math.max(0, boost - dt * 0.35);
    B.forEach((b, i) => { b.y += b.v * dt * (1 + boost * 3); const lim = boost > 0.3 ? 0.9 : top; if (b.y > lim) { b.y = 0.02; b.a = Math.random() * 6.28; b.r = Math.random(); }
      const rr2 = (rAt(Math.min(b.y, 0.9)) - 0.04) * b.r * 0.9; M.makeScale(b.s, b.s, b.s).setPosition(Math.cos(b.a + t * 0.6) * rr2, b.y, Math.sin(b.a + t * 0.6) * rr2); bub.setMatrixAt(i, M); });
    bub.instanceMatrix.needsUpdate = true; lm.emissiveIntensity = 0.35 + boost * 0.7;
  }
  idle(0, 0.016);
  blob(1, 1, 0.5, 0, 0.003, 0, g);
  return { g, idle, tap: () => { boost = 1; } };
}
function heartModel(parent, x, y, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const heart = new THREE.Group(); g.add(heart); heart.scale.setScalar(s);
  const red = std(0xe0503f, { roughness: 0.4, emissive: 0xff3a22, emissiveIntensity: 0, envMapIntensity: 0.9 });
  const blue = std(0x4a68c8, { roughness: 0.4 });
  const bodyGeo = new THREE.SphereGeometry(0.34, MOBILE ? 32 : 48, MOBILE ? 24 : 32);
  const p = bodyGeo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const t = THREE.MathUtils.clamp((v.y + 0.34) / 0.68, 0, 1); const tp = 0.35 + 0.65 * Math.pow(t, 0.55); v.x *= tp * 1.08; v.z *= tp * 0.9; v.y *= 1.12; v.x += (1 - t) * 0.1; p.setXYZ(i, v.x, v.y, v.z); }
  bodyGeo.computeVertexNormals();
  const body = mesh(bodyGeo, red, 0, 0, 0, heart); body.rotation.z = 0.42;
  sph(0.16, red, -0.17, 0.18, 0.02, heart).scale.set(1, 0.9, 1.1); sph(0.13, red, 0.16, 0.24, -0.06, heart);
  const tubeOf = (pts, r, m) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(a => V(...a))), 24, r, 10, false), m, 0, 0, 0, heart);
  tubeOf([[0.02, 0.2, 0], [0.02, 0.42, 0], [-0.06, 0.56, -0.02], [-0.2, 0.56, -0.04], [-0.26, 0.42, -0.08], [-0.25, 0.2, -0.14]], 0.075, red);
  tubeOf([[0.12, 0.12, 0.14], [0.08, 0.36, 0.12], [-0.06, 0.44, 0.1], [-0.14, 0.4, 0.12]], 0.06, blue);
  tubeOf([[0.25, 0.1, -0.05], [0.27, 0.35, -0.06], [0.26, 0.6, -0.06]], 0.055, blue);
  tubeOf([[0.05, 0.12, 0.22], [0.0, -0.05, 0.26], [-0.08, -0.22, 0.2], [-0.14, -0.33, 0.12]], 0.012, std(0xffd36e));
  return { g, heart, body, red };
}
function stand(parent, x, y, z, h, r = 0.12) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); cyl(r, r * 1.15, 0.03, darkM(), 0, 0.015, 0, g, 32); cyl(0.014, 0.014, h, metalM(), 0, h / 2 + 0.03, 0, g, 12); blob(r * 4, r * 4, 0.45, 0, 0.002, 0, g); return g; }

/* pictogramas GHS (rombo rojo) en canvas, compartidos por los dos laboratorios */
function ghsTex(kind) {
  return canvasTex(256, 256, (g) => {
    g.save(); g.translate(128, 128); g.rotate(Math.PI / 4); g.fillStyle = '#fff'; g.fillRect(-82, -82, 164, 164); g.strokeStyle = '#d8231f'; g.lineWidth = 16; g.strokeRect(-82, -82, 164, 164); g.restore();
    g.fillStyle = '#111'; g.strokeStyle = '#111'; g.lineWidth = 9; g.lineCap = 'round';
    if (kind === 'flame') { g.beginPath(); g.moveTo(128, 70); g.bezierCurveTo(170, 120, 170, 170, 128, 178); g.bezierCurveTo(86, 170, 92, 130, 112, 110); g.bezierCurveTo(112, 135, 124, 140, 128, 120); g.bezierCurveTo(132, 100, 120, 90, 128, 70); g.fill(); g.fillRect(84, 182, 88, 10); }
    if (kind === 'excl') { g.fillRect(118, 70, 20, 78); g.beginPath(); g.arc(128, 172, 12, 0, 7); g.fill(); }
    if (kind === 'bio') { for (let a = 0; a < 3; a++) { const an = a * 2.094 - Math.PI / 2; g.beginPath(); g.arc(128 + Math.cos(an) * 26, 132 + Math.sin(an) * 26, 26, 0, 7); g.stroke(); } g.beginPath(); g.arc(128, 132, 12, 0, 7); g.fill(); }
    if (kind === 'corr') { g.fillRect(70, 150, 116, 26); g.beginPath(); g.moveTo(90, 80); g.lineTo(110, 80); g.lineTo(104, 120); g.fill(); g.beginPath(); g.moveTo(146, 80); g.lineTo(166, 80); g.lineTo(160, 120); g.fill(); g.beginPath(); g.arc(102, 134, 6, 0, 7); g.arc(158, 134, 6, 0, 7); g.fill(); }
    if (kind === 'tox') { g.beginPath(); g.arc(128, 112, 30, 0, 7); g.fill(); g.fillRect(112, 130, 32, 20); g.fillStyle = '#fff'; g.beginPath(); g.arc(116, 110, 8, 0, 7); g.arc(140, 110, 8, 0, 7); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 10; g.beginPath(); g.moveTo(84, 160); g.lineTo(172, 190); g.moveTo(172, 160); g.lineTo(84, 190); g.stroke(); }
  });
}
/* pizarra con la fecha real del examen */
function examBoard(parent, x, y, w, h, evId, title, ink, doodle) {
  return poster(parent, x, y, w, h, (g, W2, H2) => {
    g.fillStyle = '#f7f9f9'; g.fillRect(0, 0, W2, H2); g.strokeStyle = '#9aa3aa'; g.lineWidth = 10; g.strokeRect(0, 0, W2, H2);
    const e = MC.AG.ev.find(v => v.id === evId), n = MC.now();
    g.fillStyle = ink; g.font = '700 32px Caveat';
    if (e) { const past = e.due <= n, rd = MC.relDay(e.date); g.fillText(past ? 'Fue el ' + rd.toLowerCase() + ':' : rd + (e.claseHora ? ', en clase' : '') + ':', 24, 50); g.font = '700 44px Caveat'; g.fillText(title, 24, 98); if (past) { g.strokeStyle = ink; g.lineWidth = 4; g.beginPath(); g.moveTo(22, 86); g.lineTo(24 + g.measureText(title).width, 84); g.stroke(); } }
    doodle && doodle(g, W2, H2);
  });
}
/* pantalla que desplaza un texto sin volver a pintar: la textura se repite y se mueve su offset */
function scrollScreen(parent, x, y, z, w, h, draw, rows = 2) {
  const t = canvasTex(256, 256 * rows, draw); t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1 / rows);
  const m = plane(w, h, basic(0xffffff, { map: t }), x, y, z, parent); return { m, t };
}

/* =========================================================
   LABORATORIO DE BIOLOGÍA MOLECULAR (bio): moderno y frío, de investigación
   ========================================================= */
async function buildBioRoom() {
  const panels = canvasTex(512, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d9dde6'); gr.addColorStop(1, '#c4c9d4'); g.fillStyle = gr; g.fillRect(0, 0, w, h); noise(g, w, h, 600, 0.08, ['#ffffff', '#5a6074']); g.fillStyle = 'rgba(40,46,70,.28)'; for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 3, h); g.fillRect(0, h * 0.62, w, 3); g.fillStyle = 'rgba(255,255,255,.4)'; for (let x = 3; x < w; x += 128) g.fillRect(x, 0, 2, h); });
  panels.wrapS = THREE.RepeatWrapping; panels.repeat.set(6, 1);
  const sh = roomShell({ x0: -3.8, x1: 7.6, wallTex: panels, floor: '#4f5462', bg: 0x05060c, sky: 0xd6dcff, key: 0xeef2ff, fillC: 0xa6b0ff, fillX: 2.2, poolX: 2.2, pool: 'rgba(190,198,255,.8)', amb: 'rgb(34,36,52)',
    spots2: [[-2.6, 1.5, 1.5, 'rgba(160,205,255,.75)'], [0, 2.2, 0.9, 'rgba(120,140,255,.5)'], [4.4, 2.2, 1.0, 'rgba(180,130,255,.55)'], [6.4, 1.2, 1.0, 'rgba(120,170,255,.35)']], exposure: 0.95, on: { hemi: 0.3, key: 0.8, fill: 2.2 } });
  const S = sh.scene, top = bench(S, -1.0, 5.4, { cabC: '#d7dbe2', topC: 0x2a2e38, rough: 0.3 });
  const state = { spin: 0.4 };
  const mm = new THREE.Matrix4();
  examBoard(S, 2.2, 2.3, 1.7, 0.72, 'bio-examen-citogenetica', 'examen de Citogenética', '#5a2ec0', (g, w, h) => {
    g.strokeStyle = '#5a2ec0'; g.lineWidth = 6; g.lineCap = 'round'; [[600, 28], [640, 28]].forEach(([x, y], k) => { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (k ? -20 : 20), y + 45, x, y + 92); g.stroke(); });
    g.fillStyle = '#5a2ec0'; g.font = '700 34px Caveat'; g.fillText('46,XX', 670, 92); g.fillStyle = '#ad3326'; g.font = '700 24px Caveat'; g.fillText('¡repasa el bandeo!', 24, 140); });
  box(1.5, 0.04, 0.08, metalM(), 2.2, 1.9, 0.05, S);

  /* cabina de flujo laminar: luz encendida y un filtro que vibra con el ventilador */
  const hood = new THREE.Group(); hood.position.set(-2.6, 0, 0.45); S.add(hood);
  bench(hood, -0.75, 0.75, { z: 0, cabC: '#d7dbe2', topC: 0x2a2e38 });
  rbox(1.5, 1.35, 0.8, 0.03, std(0xeef0f4, { roughness: 0.4 }), 0, 1.62, -0.05, hood);
  plane(1.3, 0.95, basic(0xcfe4ff), 0, 1.45, 0.3, hood);
  plane(1.32, 0.98, glassMat(0xe6f2ff, 0.16), 0, 1.45, 0.36, hood);
  box(1.34, 0.05, 0.04, metalM(), 0, 1.96, 0.37, hood); box(1.34, 0.04, 0.04, metalM(), 0, 0.97, 0.37, hood);
  const hoodTube = box(1.2, 0.025, 0.04, basic(0xf4fbff), 0, 1.9, 0.28, hood);
  glowSprite(0x9fd0ff, 1.9, 0, 1.5, 0.42, hood, 0.28);
  const grilleT = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#9aa1ad'; g.fillRect(0, 0, w, h); g.fillStyle = '#4a505c'; for (let x = 6; x < w; x += 10) g.fillRect(x, 6, 5, h - 12); });
  const grille = plane(1.2, 0.22, basic(0xffffff, { map: grilleT }), 0, 2.15, 0.36, hood);
  const hoodLed = sph(0.014, basic(0x4dff9a), 0.58, 2.15, 0.37, hood);
  erlenmeyer(hood, -0.3, 0.93, 0.05, 0xff9ec7, 0.3); erlenmeyer(hood, 0.25, 0.93, 0.05, 0x9fe8ff, 0.28);

  /* pantallas en la pared: secuencias de ADN que se desplazan y un gel de electroforesis */
  const dnaScr = scrollScreen(S, 0, 2.25, 0.02, 0.8, 0.46, (g, w, h) => { g.fillStyle = '#0b0f26'; g.fillRect(0, 0, w, h); g.font = '700 21px "Atkinson Hyperlegible Mono", monospace'; const B = 'ATGC', C = { A: '#7dffc6', T: '#ff7ad9', G: '#ffd166', C: '#8fb0ff' }; let s = 7; for (let r = 0; r < h / 24; r++) for (let k = 0; k < 15; k++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const b = B[(s >> 16) & 3]; g.fillStyle = C[b]; g.fillText(b, 10 + k * 16, 22 + r * 24); } }, 2);
  box(0.86, 0.52, 0.03, std(0x15171d, { roughness: 0.3 }), 0, 2.25, 0.004, S);
  const gelScr = canvasTex(256, 160, (g, w, h) => { g.fillStyle = '#0d0a22'; g.fillRect(0, 0, w, h); g.fillStyle = '#c3adff'; g.font = '700 16px "Atkinson Hyperlegible"'; g.fillText('Gel de agarosa · 1 %', 12, 22); for (let l = 0; l < 8; l++) { g.fillStyle = 'rgba(80,60,140,.8)'; g.fillRect(16 + l * 29, 32, 18, 6); for (let b = 0; b < 4; b++) { const y = 46 + (l === 0 ? b * 26 : ((l * 7 + b * 13) % 10) * 10); g.fillStyle = 'rgba(255,122,217,' + (0.5 + ((l + b) % 3) * 0.2) + ')'; g.fillRect(16 + l * 29, y, 18, 4); } } });
  box(0.86, 0.56, 0.03, std(0x15171d, { roughness: 0.3 }), 4.4, 2.25, 0.004, S);
  plane(0.8, 0.5, basic(0xffffff, { map: gelScr }), 4.4, 2.25, 0.021, S);
  const scan = plane(0.8, 0.02, basic(0xc3adff, { transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), 4.4, 2.25, 0.024, S);

  /* congelador de −80 °C con su indicador que respira */
  const frz = new THREE.Group(); frz.position.set(6.4, 0, 0.45); S.add(frz);
  rbox(0.8, 1.95, 0.75, 0.03, std(0xe6e9ee, { roughness: 0.35 }), 0, 0.975, 0, frz);
  box(0.76, 0.012, 0.01, std(0xa7aeb9), 0, 1.4, 0.38, frz); box(0.04, 0.5, 0.05, metalM(), 0.32, 1.1, 0.39, frz);
  const frzT = canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#081024'; g.fillRect(0, 0, w, h); g.fillStyle = '#9fb4ff'; g.font = '700 58px "Atkinson Hyperlegible Mono", monospace'; g.fillText('−80 °C', 14, 70); });
  plane(0.3, 0.11, basic(0xffffff, { map: frzT }), -0.12, 1.7, 0.381, frz);
  const frzLed = sph(0.018, basic(0x7f9bff), 0.16, 1.7, 0.385, frz), frzGlow = glowSprite(0x7f9bff, 0.25, 0.16, 1.7, 0.4, frz, 0.4);
  poster(frz, 0, 1.2, 0.3, 0.3, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a53b3'; g.font = '700 70px "Atkinson Hyperlegible"'; g.textAlign = 'center'; g.fillText('−80', w / 2, 210); g.font = '700 50px "Atkinson Hyperlegible"'; g.fillText('No abrir', w / 2, 320); }, 0.381);
  blob(1.1, 1.0, 0.45, 0, 0.003, 0, frz);

  /* carrusel de pipetas */
  const pip = new THREE.Group(); pip.position.set(1.15, top, 0.3); S.add(pip);
  cyl(0.11, 0.12, 0.02, darkM(), 0, 0.01, 0, pip); cyl(0.012, 0.012, 0.42, metalM(), 0, 0.22, 0, pip); cyl(0.12, 0.12, 0.02, darkM(), 0, 0.4, 0, pip);
  [0xe5484d, 0xffd166, 0x3b82f6, 0x2fc796].forEach((c, k) => { const a = k * Math.PI / 2 + 0.4, p = new THREE.Group(); p.position.set(Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1); pip.add(p); cyl(0.016, 0.02, 0.24, white(), 0, 0.16, 0, p); cyl(0.022, 0.022, 0.04, std(c), 0, 0.3, 0, p); cyl(0.004, 0.009, 0.1, std(0xf4f4f4, { transparent: true, opacity: 0.7 }), 0, 0.0, 0, p); });

  /* --- Bio 1 · incubadora de CO₂ con el frasco y la placa de Petri --- */
  const inc = new THREE.Group(); inc.position.set(0, top, 0.42); S.add(inc);
  rbox(0.8, 0.66, 0.6, 0.03, std(0xd9dde2, { roughness: 0.35 }), 0, 0.33, 0, inc);
  plane(0.66, 0.5, basic(0x5b4636), 0, 0.33, 0.27, inc);
  const incGlow = plane(0.6, 0.04, basic(0xffe1b0), 0, 0.56, 0.275, inc);
  const incHalo = glowSprite(0xffb05a, 0.9, 0, 0.33, 0.4, inc, 0.14);
  box(0.66, 0.012, 0.44, white(), 0, 0.2, 0.06, inc);
  const dish = new THREE.Group(); dish.position.set(-0.12, 0.214, 0.1); inc.add(dish);
  cyl(0.15, 0.15, 0.025, glassMat(0xffffff, 0.35), 0, 0.012, 0, dish, 32);
  cyl(0.142, 0.142, 0.01, std(0xf0a39a, { roughness: 0.4, emissive: 0x5a1a14, emissiveIntensity: 0.15 }), 0, 0.008, 0, dish, 32);
  const NC = 140, cells = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), std(0x8b5cf6, { emissive: 0x5a2ec0, emissiveIntensity: 0.35, roughness: 0.4 }), NC);
  const seeds = [[-0.05, 0.03], [0.06, -0.04], [0.02, 0.07]];
  const cellD = Array.from({ length: NC }, () => { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 0.128; const x = Math.cos(a) * r, z = Math.sin(a) * r; const d = Math.min(...seeds.map(s => Math.hypot(s[0] - x, s[1] - z))); return { x, z, d, s: 0.009 + Math.random() * 0.007 }; });
  dish.add(cells);
  const growth = { p: 0.18 };
  function drawCells() { const M = new THREE.Matrix4(); cellD.forEach((c, i) => { const vis = THREE.MathUtils.clamp((growth.p * 0.26 - c.d) / 0.03, 0, 1); const s = c.s * vis; M.makeScale(s, s * 0.6, s).setPosition(c.x, 0.016, c.z); cells.setMatrixAt(i, M); }); cells.instanceMatrix.needsUpdate = true; }
  drawCells();
  const flask = new THREE.Group(); flask.position.set(0.17, 0.214, 0.02); flask.rotation.y = -0.4; inc.add(flask);
  box(0.16, 0.1, 0.06, glassMat(0xffffff, 0.3), 0, 0.05, 0, flask); box(0.15, 0.04, 0.052, std(0xf48c8c, { transparent: true, opacity: 0.85, roughness: 0.2 }), 0, 0.022, 0, flask);
  const nk = cyl(0.016, 0.02, 0.05, glassMat(0xffffff, 0.3), 0.1, 0.07, 0, flask); nk.rotation.z = -0.9; cyl(0.024, 0.024, 0.03, std(0x3b82f6), 0.125, 0.09, 0, flask).rotation.z = -0.9;
  const incDoor = new THREE.Group(); incDoor.position.set(-0.36, 0.33, 0.31); inc.add(incDoor);
  plane(0.56, 0.4, glassMat(0xcfe8ff, 0.3), 0.36, 0.02, 0.014, incDoor);
  [[0.36, 0.25, 0.72, 0.06], [0.36, -0.25, 0.72, 0.06], [0.03, 0, 0.06, 0.56], [0.69, 0, 0.06, 0.56]].forEach(([x, y, w, h]) => box(w, h, 0.03, std(0xe3e6e9, { roughness: 0.4 }), x, y, 0, incDoor));
  box(0.03, 0.18, 0.04, darkM(), 0.66, 0, 0.03, incDoor);
  const disp = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#10261f'; g.fillRect(0, 0, w, h); g.fillStyle = '#7dffc6'; g.font = '700 34px "Atkinson Hyperlegible Mono", monospace'; g.fillText('37 °C · 5 % CO₂', 10, 44); });
  plane(0.3, 0.06, basic(0xffffff, { map: disp }), 0.18, 0.62, 0.301, inc);
  blob(1.1, 0.9, 0.45, 0, 0.003, 0, inc);
  tagSpot(inc, 'bio1');
  let incOpen = false;
  function reactBio1() {
    const tl = gsap.timeline();
    if (!incOpen) { tl.to(incDoor.rotation, { y: -1.9, duration: 0.7, ease: 'power2.inOut' }, 0).to(dish.position, { z: 0.36, y: 0.24, duration: 0.6, ease: 'power3.out' }, 0.35); incOpen = true; }
    growth.p = 0.15;
    tl.to(growth, { p: 1.05, duration: 1.6, ease: 'power1.inOut', onUpdate: drawCells }, 0.5).fromTo(incGlow.material.color, { r: 1, g: 1, b: 1 }, { r: 1, g: 0.88, b: 0.69, duration: 1 }, 0);
    animTL(tl);
  }

  /* --- Bio 2 · hélice de ADN --- */
  const dnaG = stand(S, 2.2, top, 0.45, 0.12);
  const helix = new THREE.Group(); helix.position.y = 0.72; dnaG.add(helix); helix.scale.setScalar(0.78);
  {
    const R = 0.26, Hh = 1.45, turns = 2.4;
    class Hx extends THREE.Curve { constructor(ph) { super(); this.ph = ph; } getPoint(t, out = new THREE.Vector3()) { const a = t * turns * Math.PI * 2 + this.ph; return out.set(Math.cos(a) * R, (t - 0.5) * Hh, Math.sin(a) * R); } }
    const sA = std(0x9a7bff, { roughness: 0.25, metalness: 0.1, emissive: 0x3a1f99, emissiveIntensity: 0.35, envMapIntensity: 1.2 });
    const sB = std(0x6f4fe0, { roughness: 0.25, metalness: 0.1, emissive: 0x2a1477, emissiveIntensity: 0.35, envMapIntensity: 1.2 });
    mesh(new THREE.TubeGeometry(new Hx(0), MOBILE ? 120 : 200, 0.035, 10), sA, 0, 0, 0, helix);
    mesh(new THREE.TubeGeometry(new Hx(Math.PI), MOBILE ? 120 : 200, 0.035, 10), sB, 0, 0, 0, helix);
    const N = 34, rung = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 8), std(0xffffff, { roughness: 0.3 }), N);
    const pals = [0xe4d9ff, 0xff9ec7, 0x9fe8ff, 0xffe39a], q = new THREE.Quaternion(), up = V(0, 1, 0), M = new THREE.Matrix4();
    for (let i = 0; i < N; i++) { const t = (i + 0.5) / N, a = new Hx(0).getPoint(t), b = new Hx(Math.PI).getPoint(t); const mid = a.clone().add(b).multiplyScalar(0.5), dir = b.clone().sub(a); q.setFromUnitVectors(up, dir.clone().normalize()); M.compose(mid, q, V(1, dir.length(), 1)); rung.setMatrixAt(i, M); rung.setColorAt(i, col(pals[i % 4])); }
    helix.add(rung);
  }
  const dnaGlow = glowSprite(0xa58bff, 1.6, 0, 0.72, 0, dnaG, 0.35);
  tagSpot(dnaG, 'bio2');

  /* --- Bio 3 · cubeta de electroforesis y termociclador --- */
  const ele = new THREE.Group(); ele.position.set(4.2, top, 0.5); S.add(ele);
  box(0.66, 0.15, 0.34, glassMat(0xbfe6ff, 0.28), 0, 0.075, 0, ele);
  box(0.62, 0.08, 0.3, std(0x7fc8ff, { transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false }), 0, 0.045, 0, ele);
  box(0.46, 0.02, 0.26, std(0x9fd2ff, { emissive: 0x16305a, emissiveIntensity: 0.6, transparent: true, opacity: 0.75, roughness: 0.15 }), 0, 0.06, 0, ele);
  const LANES = 6, BANDS = 4, wellX = -0.19;
  const wells = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.012, 0.026), std(0x0a1a33), LANES);
  const bands = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 0.006, 0.028), std(0xff7ad9, { emissive: 0xff3fbf, emissiveIntensity: 1.2, roughness: 0.3 }), LANES * BANDS);
  const bandD = [];
  for (let l = 0; l < LANES; l++) { const z = -0.1 + l * 0.04; mm.makeTranslation(wellX, 0.068, z); wells.setMatrixAt(l, mm); for (let b = 0; b < BANDS; b++) { const dist = l === 0 ? 0.06 + b * 0.09 : 0.05 + ((l * 7 + b * 13) % 10) / 10 * 0.32; bandD.push({ z, dist, cur: dist }); } }
  function drawBands() { bandD.forEach((b, i) => { mm.makeTranslation(wellX + b.cur, 0.073, b.z); bands.setMatrixAt(i, mm); }); bands.instanceMatrix.needsUpdate = true; }
  drawBands(); ele.add(wells, bands);
  const red = std(0xd8231f, { roughness: 0.4 }), blk = std(0x18191c, { roughness: 0.4 });
  cyl(0.02, 0.02, 0.05, blk, -0.31, 0.17, 0.12, ele); cyl(0.02, 0.02, 0.05, red, 0.31, 0.17, 0.12, ele);
  const pcr = new THREE.Group(); pcr.position.set(0.62, 0, -0.02); ele.add(pcr);
  rbox(0.42, 0.2, 0.34, 0.025, std(0xe9ecf1, { roughness: 0.35 }), 0, 0.1, 0, pcr);
  const lid = rbox(0.38, 0.05, 0.3, 0.02, std(0x8b5cf6, { roughness: 0.4 }), 0, 0.215, -0.01, pcr);
  const pcrTex = canvasTex(256, 96, () => {});
  let cyc = 0;
  function drawPcr(c, temp) { pcrTex.userData.redraw((g, w, h) => { g.fillStyle = '#0b0820'; g.fillRect(0, 0, w, h); g.fillStyle = '#c3adff'; g.font = '700 30px "Atkinson Hyperlegible Mono", monospace'; g.fillText('Ciclo ' + String(c).padStart(2, '0') + '/35', 12, 38); g.fillStyle = '#7dffc6'; g.font = '700 26px "Atkinson Hyperlegible Mono", monospace'; g.fillText(temp, 12, 78); }); }
  drawPcr(0, '4 °C · listo');
  plane(0.24, 0.09, basic(0xffffff, { map: pcrTex }), -0.04, 0.12, 0.171, pcr);
  [-0.05, 0.12].forEach((x, k) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(k ? 0.31 : -0.31, 0.19, 0.12), V(0.0, 0.3, 0.2), V(0.3, 0.2, 0.18), V(0.42 + x * 0.3, 0.12, 0.16)]), 24, 0.008, 6), k ? red : blk, 0, 0, 0, ele));
  blob(1.5, 0.7, 0.4, 0.3, 0.003, 0, ele);
  tagSpot(ele, 'bio3');
  function reactBio3() {
    const tl = gsap.timeline(), o = { c: 0 };
    bandD.forEach(b => { b.cur = 0; });
    tl.to(lid.position, { y: 0.235, duration: 0.15, yoyo: true, repeat: 1 }, 0)
      .to(o, { c: 35, duration: 2.0, ease: 'none', onUpdate() { const c = Math.round(o.c); if (c !== cyc) { cyc = c; drawPcr(c, ['95 °C · separa', '55 °C · une', '72 °C · copia'][c % 3]); } } }, 0)
      .add(() => drawPcr(35, '4 °C · listo'), 2.05)
      .to({}, { duration: 2.0, onUpdate() { const p = this.progress(); bandD.forEach(b => { b.cur = b.dist * p; }); drawBands(); } }, 0.2)
      .fromTo(bands.material, { emissiveIntensity: 2.4 }, { emissiveIntensity: 1.2, duration: 2 }, 0.2);
    animTL(tl);
  }


  /* --- Bio 3 · lectura: libro abierto con la historia de Rosalind Franklin y su retrato en la pared --- */
  const p51 = await svgImage(MC.photo51SVG()), rfImg = await svgImage(MC.franklinSVG());
  const lect = new THREE.Group(); lect.position.set(3.3, top, 0.62); lect.rotation.y = -0.18; S.add(lect);
  { const wd = std(0x6b4a2e, { roughness: 0.5 }); const back = box(0.5, 0.36, 0.02, wd, 0, 0.15, -0.06, lect); back.rotation.x = -0.62; box(0.52, 0.03, 0.06, wd, 0, 0.012, 0.09, lect); box(0.04, 0.2, 0.04, wd, 0, 0.1, -0.12, lect).rotation.x = 0.5; }   // atril
  const bookG = new THREE.Group(); bookG.position.set(0, 0.16, -0.035); bookG.rotation.x = Math.PI / 2 - 0.62; bookG.scale.setScalar(1.12); lect.add(bookG);
  const coverM = std(0x3d2a6e, { roughness: 0.55 });
  rbox(0.5, 0.018, 0.34, 0.006, coverM, 0, 0.009, 0, bookG);                                  // tapas
  const pagesT = canvasTex(1024, 704, (g, w, h) => {
    g.fillStyle = '#f7f1e3'; g.fillRect(0, 0, w, h);
    const sp = g.createLinearGradient(w / 2 - 40, 0, w / 2 + 40, 0); sp.addColorStop(0, 'rgba(0,0,0,0)'); sp.addColorStop(.5, 'rgba(80,60,30,.35)'); sp.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sp; g.fillRect(w / 2 - 40, 0, 80, h);
    g.fillStyle = '#5a2ec0'; g.font = '600 22px "Atkinson Hyperlegible"'; g.fillText('BIO 3 · ÁCIDOS NUCLEICOS', 60, 84);
    g.fillStyle = '#221d2e'; g.font = 'italic 600 52px Fraunces'; g.fillText('La historia de', 60, 160); g.font = '600 60px Fraunces'; g.fillText('Rosalind Franklin', 60, 228);
    g.fillStyle = '#5a2ec0'; g.fillRect(60, 252, 120, 6);
    g.fillStyle = 'rgba(34,29,46,.55)'; for (let l = 0; l < 12; l++) { const wl = 330 + ((l * 53) % 90); g.fillRect(60, 300 + l * 30, l === 11 ? wl * 0.5 : wl, 8); }
    try { g.save(); g.translate(w * 0.75, h * 0.42); g.rotate(-0.03); g.fillStyle = '#fff'; g.fillRect(-170, -170, 340, 380); g.drawImage(p51, -150, -150, 300, 300); g.restore(); } catch (e) { }
    g.fillStyle = '#221d2e'; g.font = '700 34px Caveat'; g.textAlign = 'center'; g.fillText('Fotografía 51', w * 0.75, h * 0.42 + 196); g.textAlign = 'left';
    g.fillStyle = 'rgba(34,29,46,.45)'; for (let l = 0; l < 3; l++) g.fillRect(w * 0.54, h * 0.84 + l * 28, 380 - l * 70, 8);
  });
  const pages = plane(0.48, 0.33, basic(0xffffff, { map: pagesT }), 0, 0.034, 0, bookG); pages.material.color.setScalar(0.93); pages.rotation.x = -Math.PI / 2;
  box(0.48, 0.012, 0.33, std(0xefe6d2, { roughness: 0.9 }), 0, 0.024, 0, bookG);               // canto de las hojas
  const ribbon = box(0.012, 0.002, 0.16, std(0xd8231f, { roughness: 0.5 }), 0.02, 0.036, 0.23, bookG); ribbon.rotation.x = 0.25;
  blob(0.8, 0.6, 0.4, 0, 0.003, 0, lect);
  const bookGlow = glowSprite(0xffe9c4, 0.7, 0, 0.12, 0, bookG, 0.12);
  tagSpot(lect, 'franklin');
  const portrait = new THREE.Group(); portrait.position.set(3.45, 2.28, 0.03); S.add(portrait);
  const pf = std(0x2a211a, { roughness: 0.4 }), PW = 0.36, PH = 0.46, ft = 0.03;
  box(PW + 2 * ft, ft, 0.035, pf, 0, PH / 2 + ft / 2, 0, portrait); box(PW + 2 * ft, ft, 0.035, pf, 0, -PH / 2 - ft / 2, 0, portrait); box(ft, PH, 0.035, pf, -PW / 2 - ft / 2, 0, 0, portrait); box(ft, PH, 0.035, pf, PW / 2 + ft / 2, 0, 0, portrait);
  const rfT = canvasTex(300, 380, (g, w, h) => { try { g.drawImage(rfImg, 0, 0, w, h); } catch (e) { g.fillStyle = '#d9c4a0'; g.fillRect(0, 0, w, h); } });
  plane(PW, PH, std(0xffffff, { map: rfT, roughness: 0.7 }), 0, 0, 0.006, portrait);
  poster(portrait, 0, -PH / 2 - 0.08, 0.32, 0.07, (g, w, h) => { g.fillStyle = '#c8a46a'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a211a'; g.textAlign = 'center'; fitFont(g, 'Rosalind Franklin · 1920–1958', '700', 'Fraunces', 50, w - 30); g.fillText('Rosalind Franklin · 1920–1958', w / 2, h * 0.72); }, 0.004);
  box(0.22, 0.02, 0.05, std(0xc8a46a, { roughness: 0.3, metalness: 0.8 }), 0, PH / 2 + 0.09, 0.05, portrait);
  glowSprite(0xffe2b0, 0.7, 0, 0.1, 0.06, portrait, 0.13);
  tagSpot(portrait, 'franklin');
  function reactBook() { const tl = gsap.timeline(); tl.fromTo(lect.position, { y: top }, { y: top + 0.05, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' }).fromTo(bookGlow.material, { opacity: 0.4 }, { opacity: 0.12, duration: 1.2 }, 0); animTL(tl); }
  const spots = [
    unitSpot('bio1', 0, reactBio1, { anchor: V(0, top + 0.7, 0.45), label: 'Cultivos celulares' }),
    unitSpot('bio2', 2.2, null, { anchor: V(2.2, top + 1.0, 0.45), label: 'Citogenética', go: 'Viajar al cariotipo', act: () => goCyto(), alt: ['Abrir la unidad', () => reactAndOpen(2.2, () => { state.spin = 3; anim(state, { spin: 0.4, duration: 1.4 }); }, () => MC.showNb('unit', 'bio2', 'sala'))] }),
    { id: 'franklin', x: 3.3, anchor: V(3.3, top + 0.42, 0.6), color: SUBJ.bio.c, btn: SUBJ.bio.c, label: 'Lectura: Rosalind Franklin', aria: 'Leer la historia de Rosalind Franklin',
      kicker: 'Bio 3 · Lectura', title: 'La historia de Rosalind Franklin', go: 'Leer la historia', sub: 'Ácidos nucleicos: la Fotografía 51 y la doble hélice.',
      act: () => reactAndOpen(3.3, reactBook, () => MC.showNb('lectura', 'franklin', 'sala')) },
    unitSpot('bio3', 4.4, reactBio3, { anchor: V(4.3, top + 0.5, 0.5), label: 'Ácidos nucleicos' })
  ];
  const v0 = grille.position.y;
  return {
    name: 'bio', shell: sh, exposure: sh.exposure, scene: S, spots, pick: [inc, dnaG, ele, lect, portrait], range: [-0.6, 5.0], state, helix,
    cfg: { y: 1.78, z: 4.6, ly: 1.25, fov: 44, m: { y: 1.72, z: 4.25, ly: 1.3, fov: 50 } },
    idle(t, dt, vr) {
      const busy = state.spin > 0.5;
      if (!ambientOn() && !busy) return false;
      if (vr[0] < 2.6 && vr[1] > 1.8) { helix.rotation.y += dt * state.spin; dnaGlow.material.opacity = 0.28 + Math.sin(t * 2) * 0.08; }
      if (vr[0] < 0.6) { incHalo.material.opacity = 0.12 + Math.sin(t * 1.7) * 0.04; dnaScr.t.offset.y = (t * 0.035) % 1; }
      if (vr[0] < -1.6) { grille.position.y = v0 + Math.sin(t * 90) * 0.0008; hoodLed.material.color.setRGB(0.3, 1, 0.6 + Math.sin(t * 2) * 0.2); hoodTube.material.color.setScalar(0.92 + Math.sin(t * 1.3) * 0.04); }
      if (vr[1] > 3.8) { scan.position.y = 2.02 + ((t * 0.12) % 1) * 0.42; }
      if (vr[1] > 5.6) { const k = 0.55 + 0.45 * Math.sin(t * 1.1); frzLed.material.color.setRGB(0.5 * k, 0.6 * k, 1 * k); frzGlow.material.opacity = 0.15 + 0.3 * k; }
      return busy ? true : 'amb';
    },
    hover(id, on) { const o = { bio1: inc, bio2: dnaG, bio3: ele }[id]; if (o) anim(o.position, { y: top + (on ? 0.03 : 0), duration: 0.3 }); }
  };
}

/* =========================================================
   LABORATORIO DE TÉCNICAS GENERALES (lab): clásico, cálido y práctico
   ========================================================= */
async function buildLabRoom() {
  const tiles = canvasTex(512, 512, (g) => { g.fillStyle = '#b8ada0'; g.fillRect(0, 0, 512, 512); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = `hsl(38 ${18 + Math.random() * 8}% ${86 + Math.random() * 5}%)`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x * 64 + 6, y * 64 + 6, 22, 4); } });
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(14, 5);
  const sh = roomShell({ x0: -3.6, x1: 5.6, wallTex: tiles, floor: '#6a5440', bg: 0x0d0906, sky: 0xffe9d0, key: 0xfff0dc, fillC: 0xffb36b, fillX: 1.0, poolX: 0.6, pool: 'rgba(255,222,180,.9)', amb: 'rgb(60,50,42)',
    spots2: [[4.4, 2.6, 2.0, 'rgba(255,150,70,.8)'], [-2.8, 1.6, 1.1, 'rgba(255,214,160,.4)']], exposure: 1.0, on: { hemi: 0.45, key: 1.0, fill: 2.4 } });
  const S = sh.scene, top = bench(S, -1.3, 1.4, { cabC: '#b08a60', topC: 0x3a2a1c, rough: 0.45 });
  const mm = new THREE.Matrix4(), q0 = new THREE.Quaternion();
  examBoard(S, 0.2, 2.32, 1.6, 0.66, 'lab-examen-u2', 'examen de Lab 2 · Seguridad', '#0d6b4c', (g) => { g.fillStyle = '#ad3326'; g.font = '700 26px Caveat'; g.fillText('gafas · guantes · lavaojos', 24, 140); });

  /* ventana alta con la luz de la tarde y su haz */
  const CH = cieloHex();   // la ventana alta enseña el cielo de ahora
  const sky = canvasTex(256, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, CH.zen); gr.addColorStop(.6, CH.mid); gr.addColorStop(1, CH.low); g.fillStyle = gr; g.fillRect(0, 0, w, h); if (CH.dia > 0.08) glowAt(g, 180, 90, 60, 'rgba(255,240,200,' + (0.9 * Math.min(1, CH.dia)).toFixed(2) + ')'); if (CH.noche > 0.3) { g.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * w, Math.random() * h * 0.6, 1.2, 1.2); } g.fillStyle = '#3a2430'; for (let x = 0; x < w;) { const bw = 14 + Math.random() * 30, bh = 10 + Math.random() * 26; g.fillRect(x, h - bh, bw, bh); x += bw + 2; } });
  const win = new THREE.Group(); win.position.set(4.3, 2.7, 0.01); S.add(win);
  plane(1.5, 0.62, basic(0xffffff, { map: sky }), 0, 0, 0, win);
  const wf = std(0x6b5640, { roughness: 0.5 }); [-0.75, -0.25, 0.25, 0.75].forEach(x => box(0.05, 0.68, 0.06, wf, x, 0, 0.02, win)); box(1.56, 0.05, 0.06, wf, 0, 0.33, 0.02, win); box(1.56, 0.05, 0.12, wf, 0, -0.33, 0.04, win);
  const beamT = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,190,120,.9)'); gr.addColorStop(1, 'rgba(255,150,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); const sx = g.createLinearGradient(0, 0, w, 0); sx.addColorStop(0, 'rgba(0,0,0,1)'); sx.addColorStop(.5, 'rgba(0,0,0,0)'); sx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = sx; g.fillRect(0, 0, w, h); });
  const beamM = basic(0xffc890, { map: beamT, transparent: true, opacity: 0.22 * (0.15 + 0.85 * CH.direct), depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = plane(1.4, 3.2, beamM, 3.6, 1.4, 1.3, S); beam.rotation.set(-0.5, 0, -0.42);
  const dust = motes(S, MOBILE ? 50 : 110, [2.4, 4.8, 0.6, 2.6, 0.4, 2.2], 0xffd8a0, 30);

  /* estanterías con material de vidrio (instancing): matraces, probetas y vasos */
  const shelfM = std(0x7a5a3a, { roughness: 0.55 });
  const lowCab = new THREE.Group(); lowCab.position.set(-2.75, 0, 0.32); S.add(lowCab);
  rbox(1.2, 0.9, 0.6, 0.02, std(0xb08a60, { roughness: 0.55 }), 0, 0.45, 0, lowCab); box(1.24, 0.04, 0.64, std(0x3a2a1c, { roughness: 0.4 }), 0, 0.92, 0, lowCab);
  blob(1.6, 1.0, 0.4, 0, 0.003, 0.1, lowCab);
  const glassPos = { er: [], pr: [], va: [] };
  [1.62, 2.12, 2.6].forEach((y, r) => { box(1.5, 0.03, 0.28, shelfM, -2.75, y, 0.15, S); for (let x = -3.4, i = r; x < -2.1; x += 0.17, i++) glassPos[['er', 'pr', 'va'][(i * 2 + r) % 3]].push([x, y + 0.015, 0.15, i]); });
  const erGeo = new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.065, 0.01], [0.02, 0.12], [0.018, 0.17], [0, 0.17]].map(([a, b]) => new THREE.Vector2(a, b)), 12);
  const glassI = (geo, list, sc) => { const im = new THREE.InstancedMesh(geo, glassMat(0xe6fff8, 0.32), list.length); list.forEach((p, i) => { mm.compose(V(p[0], p[1], p[2]), q0, V(1, sc ? sc(p[3]) : 1, 1)); im.setMatrixAt(i, mm); }); S.add(im); return im; };
  glassI(erGeo, glassPos.er); glassI(new THREE.CylinderGeometry(0.018, 0.022, 0.26, 10, 1, true).translate(0, 0.13, 0), glassPos.pr, i => 0.7 + (i % 3) * 0.2); glassI(new THREE.CylinderGeometry(0.045, 0.045, 0.11, 14, 1, true).translate(0, 0.055, 0), glassPos.va);
  const liqC = [0x3fd9a4, 0xffb547, 0x4c8dff, 0xff7ad9, 0xf1efe9];
  const allG = [...glassPos.er, ...glassPos.va], liq = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.04, 0.04, 10).translate(0, 0.02, 0), std(0xffffff, { roughness: 0.2, transparent: true, opacity: 0.8 }), allG.length);
  allG.forEach((p, i) => { mm.makeTranslation(p[0], p[1] + 0.004, p[2]); liq.setMatrixAt(i, mm); liq.setColorAt(i, col(liqC[i % 5])); }); S.add(liq);

  /* centrífuga que gira, sobre el armario bajo */
  const cen = new THREE.Group(); cen.position.set(-2.95, 0.94, 0.38); S.add(cen);
  cyl(0.2, 0.22, 0.2, std(0xe9ecf0, { roughness: 0.35 }), 0, 0.1, 0, cen, 28);
  const rotor = new THREE.Group(); rotor.position.y = 0.205; cen.add(rotor);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; cyl(0.018, 0.018, 0.05, std(k % 2 ? 0xffb547 : 0x4c8dff), Math.cos(a) * 0.11, 0, Math.sin(a) * 0.11, rotor); }
  cyl(0.03, 0.03, 0.03, darkM(), 0, 0, 0, rotor);
  cyl(0.19, 0.19, 0.01, glassMat(0xdfefff, 0.28), 0, 0.235, 0, cen, 28);
  const cenT = canvasTex(128, 48, (g, w, h) => { g.fillStyle = '#10261f'; g.fillRect(0, 0, w, h); g.fillStyle = '#7dffc6'; g.font = '700 26px "Atkinson Hyperlegible Mono", monospace'; g.fillText('3000 rpm', 6, 33); });
  plane(0.14, 0.05, basic(0xffffff, { map: cenT }), 0, 0.1, 0.205, cen).rotation.x = -0.1;
  blob(0.6, 0.6, 0.4, 0, -0.03, 0, cen);

  /* armario de reactivos con pictogramas GHS */
  const rc = new THREE.Group(); rc.position.set(-1.75, 2.22, 0.18); S.add(rc);
  rbox(0.8, 0.72, 0.34, 0.02, std(0xd8cfc0, { roughness: 0.5 }), 0, 0, 0, rc);
  plane(0.34, 0.62, glassMat(0xe6f0f4, 0.3), -0.19, 0, 0.175, rc); plane(0.34, 0.62, glassMat(0xe6f0f4, 0.3), 0.19, 0, 0.175, rc);
  ['flame', 'corr', 'tox', 'excl'].forEach((k, i) => plane(0.14, 0.14, std(0xffffff, { map: ghsTex(k), transparent: true, alphaTest: 0.05, roughness: 0.6 }), -0.27 + i * 0.18, 0.22, 0.18, rc));
  [[-0.25, 0xb5651d], [-0.12, 0xf1efe9], [0.08, 0x3a6fd1], [0.22, 0xb5651d]].forEach(([x, c]) => cyl(0.04, 0.045, 0.16, std(c, { roughness: 0.25, transparent: true, opacity: 0.9 }), x, -0.2, 0.02, rc));
  poster(rc, 0, -0.06, 0.5, 0.1, (g, w, h) => { g.fillStyle = '#d8231f'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '700 58px "Atkinson Hyperlegible"'; g.textAlign = 'center'; g.fillText('REACTIVOS', w / 2, h * 0.75); }, 0.181);

  /* bureta en su soporte */
  const bur = stand(S, -0.95, top, 0.3, 0.75, 0.1);
  box(0.16, 0.025, 0.025, metalM(), 0.07, 0.6, 0, bur);
  cyl(0.011, 0.011, 0.58, glassMat(0xeafff8, 0.4), 0.14, 0.52, 0, bur); cyl(0.009, 0.009, 0.3, std(0x4c8dff, { transparent: true, opacity: 0.75 }), 0.14, 0.62, 0, bur);
  cyl(0.004, 0.004, 0.06, glassMat(0xeafff8, 0.5), 0.14, 0.2, 0, bur);
  const drop = sph(0.008, std(0x4c8dff, { transparent: true, opacity: 0.85 }), 0.14, 0.16, 0, bur);
  erlenmeyer(bur, 0.14, 0, 0, 0xff9ec7, 0.22);

  /* reloj de pared: avanza con la hora de verdad */
  const clk = new THREE.Group(); clk.position.set(1.5, 2.42, 0.03); S.add(clk);
  cyl(0.2, 0.2, 0.04, std(0x2a2d33, { roughness: 0.4 }), 0, 0, 0, clk, 32).rotation.x = Math.PI / 2;
  const face = canvasTex(256, 256, (g) => { g.fillStyle = '#fbf7ee'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.fillStyle = '#221d2e'; for (let i = 0; i < 12; i++) { g.save(); g.translate(128, 128); g.rotate(i * Math.PI / 6); g.fillRect(-3, -116, 6, i % 3 ? 14 : 26); g.restore(); } g.font = '700 22px "Atkinson Hyperlegible"'; g.textAlign = 'center'; g.fillText('LAB', 128, 180); });
  plane(0.36, 0.36, basic(0xffffff, { map: face, transparent: true }), 0, 0, 0.022, clk);
  const hand = (len, w, c) => { const p = new THREE.Group(); p.position.z = 0.026 + w * 0.2; clk.add(p); box(w, len, 0.004, basic(c), 0, len / 2 - 0.02, 0, p); return p; };
  const hH = hand(0.1, 0.014, 0x221d2e), hM = hand(0.15, 0.01, 0x221d2e), hS = hand(0.16, 0.004, 0xd8231f);
  function setClock() { const n = MC.now(), s = n.getSeconds(), m = n.getMinutes() + s / 60, h = (n.getHours() % 12) + m / 60; hS.rotation.z = -s / 60 * Math.PI * 2; hM.rotation.z = -m / 60 * Math.PI * 2; hH.rotation.z = -h / 12 * Math.PI * 2; }
  setClock();

  /* --- Lab 1 · microscopio, material de vidrio y balanza analítica --- */
  const l1 = new THREE.Group(); l1.position.set(0, top, 0.45); S.add(l1);
  const mic = microscope(l1, -0.3, 0, 0, 0x2fc796);
  const fl = erlenmeyer(l1, 0.12, 0, 0.05, 0x3fd9a4, 0.42);
  const beaker = new THREE.Group(); beaker.position.set(0.32, 0, -0.14); l1.add(beaker);
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 24, 1, true), glassMat(), 0, 0.08, 0, beaker);
  cyl(0.066, 0.066, 0.08, std(0x4c8dff, { transparent: true, opacity: 0.8, emissive: 0x1a53b3, emissiveIntensity: 0.3 }), 0, 0.04, 0, beaker);
  mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 16, 1, true), glassMat(), -0.05, 0.15, -0.2, l1);
  cyl(0.022, 0.022, 0.18, std(0xffb547, { transparent: true, opacity: 0.8 }), -0.05, 0.09, -0.2, l1); cyl(0.05, 0.05, 0.012, darkM(), -0.05, 0.006, -0.2, l1);
  const bal = new THREE.Group(); bal.position.set(0.66, 0, 0.02); l1.add(bal);
  rbox(0.3, 0.07, 0.34, 0.015, std(0xeef0f2, { roughness: 0.35 }), 0, 0.035, 0, bal);
  box(0.26, 0.22, 0.26, glassMat(0xe6f4ff, 0.2), 0, 0.18, -0.02, bal); box(0.27, 0.02, 0.27, std(0xd6dade), 0, 0.3, -0.02, bal);
  cyl(0.06, 0.06, 0.008, metalM(), 0, 0.08, -0.02, bal, 24);
  const balT = canvasTex(256, 64, () => {});
  let balV = 12.4071, balShown = '';
  function drawBal(v, on) { const s = on ? v.toFixed(4).replace('.', ',') + ' g' : '0,0000 g'; if (s === balShown) return; balShown = s; balT.userData.redraw((g, w, h) => { g.fillStyle = '#0a1a14'; g.fillRect(0, 0, w, h); g.fillStyle = on ? '#9dffc8' : '#3d6a55'; g.font = '700 38px "Atkinson Hyperlegible Mono", monospace'; g.fillText(s, 16, 46); }); }
  drawBal(0, false);
  const balScr = plane(0.18, 0.045, basic(0xffffff, { map: balT }), 0, 0.045, 0.171, bal); balScr.rotation.x = -0.35;
  const ph = new THREE.Group(); ph.position.set(1.05, 0, 0.0); l1.add(ph);
  rbox(0.16, 0.06, 0.2, 0.012, std(0x2a2d33, { roughness: 0.4 }), 0, 0.03, 0, ph);
  const phT = canvasTex(128, 64, () => {}); let phV = 7.02;
  const drawPh = () => phT.userData.redraw((g, w, h) => { g.fillStyle = '#0f1a14'; g.fillRect(0, 0, w, h); g.fillStyle = '#9dffc8'; g.font = '700 34px "Atkinson Hyperlegible Mono", monospace'; g.fillText('pH ' + phV.toFixed(2).replace('.', ','), 6, 44); });
  drawPh(); plane(0.12, 0.05, basic(0xffffff, { map: phT }), 0, 0.062, 0.05, ph).rotation.x = -Math.PI / 2 + 0.5;
  cyl(0.006, 0.006, 0.32, metalM(), 0.09, 0.16, -0.06, ph); box(0.12, 0.012, 0.012, metalM(), 0.05, 0.3, -0.06, ph);
  cyl(0.008, 0.008, 0.2, glassMat(0xeafff8, 0.5), 0.0, 0.2, -0.06, ph);
  const phB = new THREE.Group(); phB.position.set(0, 0, -0.06); ph.add(phB); mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 18, 1, true), glassMat(), 0, 0.06, 0, phB); cyl(0.047, 0.047, 0.06, std(0xffd166, { transparent: true, opacity: 0.75 }), 0, 0.03, 0, phB);
  tagSpot(l1, 'lab1');
  let balOn = 0, balCycle = 3;
  function reactLab1() {
    fl.tap(); balOn = 1; balCycle = 0;
    const tl = gsap.timeline();
    tl.to(mic.rev.rotation, { y: '+=' + (Math.PI * 2 / 3), duration: 0.6, ease: 'back.out(2)' }, 0)
      .to(mic.glow.material, { opacity: 0.9, duration: 0.3 }, 0.2).to(mic.lamp.material.color, { r: 1, g: 0.95, b: 0.8, duration: 0.3 }, 0.2)
      .fromTo(balScr.material.color, { r: 0.4, g: 0.4, b: 0.4 }, { r: 1, g: 1, b: 1, duration: 0.3 }, 0.1);
    animTL(tl); kick(3);
  }

  /* --- Lab 2 · estación de seguridad --- */
  const l2 = new THREE.Group(); l2.position.set(2.6, 0, 0); S.add(l2);
  poster(l2, -0.1, 1.72, 1.4, 1.0, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#0f8a4c'; g.fillRect(0, 0, w, 64);
    g.fillStyle = '#fff'; g.font = '700 32px "Atkinson Hyperlegible"'; g.fillText('Estación de seguridad', 22, 44);
    g.fillStyle = '#221d2e'; g.font = '700 26px Caveat'; g.fillText('gafas', 40, 340); g.fillText('guantes', 300, 340);
    g.strokeStyle = '#c9ced4'; g.lineWidth = 4; [80, 340].forEach(x => { g.beginPath(); g.arc(x, 110, 10, 0, 7); g.stroke(); });
  }, 0.012);
  const gog = new THREE.Group(); gog.position.set(-0.55, 1.5, 0.08); l2.add(gog);
  [-0.06, 0.06].forEach(x => { const lens = cyl(0.055, 0.055, 0.03, glassMat(0x9cc0ff, 0.45), x, 0, 0, gog); lens.rotation.x = Math.PI / 2; mesh(new THREE.TorusGeometry(0.056, 0.008, 8, 24), std(0x2fc796), x, 0, 0, gog); });
  mesh(new THREE.TorusGeometry(0.14, 0.006, 6, 32, Math.PI), std(0x18191c), 0, 0.02, -0.02, gog);
  const gloveM = std(0x3b82f6, { roughness: 0.55 });
  const gloves = new THREE.Group(); gloves.position.set(-0.05, 1.42, 0.05); l2.add(gloves);
  [-0.07, 0.09].forEach((x, k) => { const gl = new THREE.Group(); gl.position.x = x; gl.rotation.z = k ? -0.12 : 0.12; gloves.add(gl);
    rbox(0.1, 0.12, 0.03, 0.012, gloveM, 0, 0, 0, gl); for (let f = 0; f < 4; f++) mesh(new THREE.CapsuleGeometry(0.012, 0.06, 4, 8), gloveM, -0.037 + f * 0.025, 0.1, 0, gl); const th = mesh(new THREE.CapsuleGeometry(0.013, 0.04, 4, 8), gloveM, 0.065 * (k ? -1 : 1), 0.02, 0, gl); th.rotation.z = (k ? 0.9 : -0.9); cyl(0.05, 0.055, 0.08, gloveM, 0, -0.1, 0, gl); });
  const picts = ['flame', 'excl', 'bio'].map((kind, i) => plane(0.34, 0.34, std(0xffffff, { map: ghsTex(kind), roughness: 0.6, transparent: true, alphaTest: 0.01, side: THREE.DoubleSide }), -0.5 + i * 0.4, 2.55, 0.02, l2));
  const ew = new THREE.Group(); ew.position.set(0.75, 0, 0.25); l2.add(ew);
  const green = std(0x1a9c5a, { roughness: 0.4, metalness: 0.3 });
  cyl(0.03, 0.03, 1.0, green, 0, 0.5, 0, ew); cyl(0.12, 0.14, 0.03, darkM(), 0, 0.015, 0, ew);
  const bowlProf = [[0.02, 0], [0.12, 0.02], [0.17, 0.08], [0.17, 0.09], [0.16, 0.09], [0.11, 0.03], [0.02, 0.01]].map(([a, b]) => new THREE.Vector2(a, b));
  mesh(new THREE.LatheGeometry(bowlProf, 28), std(0x2fc796, { roughness: 0.35, side: THREE.DoubleSide }), 0, 1.0, 0, ew);
  [-0.05, 0.05].forEach(x => cyl(0.015, 0.02, 0.05, std(0x2fc796), x, 1.05, 0, ew));
  poster(ew, 0, 1.55, 0.36, 0.36, (g, w, h) => { g.fillStyle = '#0f8a4c'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(256, 230, 150, 80, 0, 0, 7); g.fill(); g.fillStyle = '#0f8a4c'; g.beginPath(); g.arc(256, 230, 50, 0, 7); g.fill(); g.fillStyle = '#fff'; [[200, 360], [256, 390], [312, 360]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x, y - 40); g.quadraticCurveTo(x + 22, y, x, y + 14); g.quadraticCurveTo(x - 22, y, x, y - 40); g.fill(); }); g.font = '700 54px "Atkinson Hyperlegible"'; g.textAlign = 'center'; g.fillText('Lavaojos', 256, 110); }, -0.24);
  const NS = 30, spray = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 6, 4), std(0x9fe8ff, { emissive: 0x4fc3ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }), NS);
  ew.add(spray); const sprayD = Array.from({ length: NS }, (_, i) => ({ side: i % 2 ? 1 : -1, ph: i / NS })); let sprayOn = 0;
  function drawSpray(t) { sprayD.forEach((p, i) => { const k = ((t * 1.4 + p.ph) % 1); const s = sprayOn > 0 ? 1 : 0; mm.compose(V(p.side * (0.05 + k * 0.04), 1.08 + k * 0.28 - k * k * 0.32, k * 0.02), q0, V(s, s, s)); spray.setMatrixAt(i, mm); }); spray.instanceMatrix.needsUpdate = true; }
  drawSpray(0);
  blob(0.5, 0.5, 0.4, 0, 0.003, 0, ew);
  tagSpot(l2, 'lab2');
  function reactLab2() {
    sprayOn = 2.4; const tl = gsap.timeline();
    picts.forEach((p, i) => tl.fromTo(p.rotation, { y: 0 }, { y: Math.PI * 2, duration: 0.9, ease: 'power3.inOut' }, i * 0.1));
    tl.fromTo(gog.position, { y: 1.5 }, { y: 1.56, duration: 0.18, yoyo: true, repeat: 3 }, 0).fromTo(gloves.rotation, { z: 0 }, { z: 0.12, duration: 0.2, yoyo: true, repeat: 3 }, 0.1).fromTo(pull.rotation, { z: 0 }, { z: 0.35, duration: 0.25, yoyo: true, repeat: 1 }, 0.2);
    animTL(tl); kick(2.6);
  }
  /* ducha de seguridad en el techo, sobre el lavaojos */
  const shw = new THREE.Group(); shw.position.set(3.35, 0, 0.55); S.add(shw);
  cyl(0.025, 0.025, 1.05, green, 0, 2.87, 0, shw); const headM = std(0x1a9c5a, { roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide });
  mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.08, 24, 1, true), headM, 0, 2.32, 0, shw);
  const pull = new THREE.Group(); pull.position.set(0.12, 2.5, 0); shw.add(pull); cyl(0.004, 0.004, 0.5, metalM(), 0, -0.25, 0, pull); mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 3), std(0x1a9c5a), 0, -0.53, 0, pull);
  poster(S, 3.62, 2.15, 0.36, 0.24, (g, w, h) => { g.fillStyle = '#0f8a4c'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '700 80px "Atkinson Hyperlegible"'; g.textAlign = 'center'; g.fillText('Ducha de', w / 2, h * 0.45); g.fillText('seguridad', w / 2, h * 0.85); }, 0.012);

  /* autoclave: suelta vapor de vez en cuando */
  const ac = new THREE.Group(); ac.position.set(4.5, 0, 0.42); S.add(ac);
  rbox(0.72, 1.0, 0.66, 0.03, std(0xdfe2e6, { roughness: 0.3, metalness: 0.35 }), 0, 0.5, 0, ac);
  const acDoor = cyl(0.24, 0.24, 0.05, metalM(), 0, 0.55, 0.34, ac, 32); acDoor.rotation.x = Math.PI / 2;
  cyl(0.18, 0.18, 0.02, std(0x9aa0a8, { metalness: 0.9, roughness: 0.3 }), 0, 0.55, 0.37, ac, 32).rotation.x = Math.PI / 2;
  box(0.24, 0.04, 0.05, darkM(), 0, 0.55, 0.39, ac);
  const gauge = canvasTex(128, 128, (g) => { g.fillStyle = '#fbf7ee'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.strokeStyle = '#d8231f'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 48, -0.4, 0.6); g.stroke(); g.fillStyle = '#221d2e'; g.font = '700 18px "Atkinson Hyperlegible"'; g.textAlign = 'center'; g.fillText('121 °C', 64, 100); });
  plane(0.13, 0.13, basic(0xffffff, { map: gauge, transparent: true }), -0.22, 0.9, 0.335, ac);
  const needle = new THREE.Group(); needle.position.set(-0.22, 0.9, 0.34); ac.add(needle); box(0.004, 0.05, 0.003, basic(0x221d2e), 0, 0.022, 0, needle);
  cyl(0.02, 0.02, 0.08, metalM(), 0.22, 1.04, 0.0, ac);
  const steamM = new THREE.SpriteMaterial({ map: glowTex, color: 0xfff6ec, transparent: true, opacity: 0, depthWrite: false });
  const puffs = Array.from({ length: 6 }, (_, i) => { const s = new THREE.Sprite(steamM.clone()); s.position.set(0.22, 1.1, 0); s.userData.ph = i / 6; ac.add(s); return s; });
  blob(1.0, 0.9, 0.45, 0, 0.003, 0, ac);

  const spots = [
    unitSpot('lab1', 0, reactLab1, { anchor: V(0, top + 0.6, 0.45), label: 'Lab 1 · Unidad 1' }),
    unitSpot('lab2', 2.6, reactLab2, { anchor: V(2.6, 2.95, 0.2), label: 'Seguridad' })
  ];
  let lastSec = -1, steamT = 4, phT0 = 0;
  return {
    name: 'lab', shell: sh, exposure: sh.exposure, scene: S, spots, pick: [l1, l2], range: [-0.6, 3.2],
    cfg: { y: 1.7, z: 4.4, ly: 1.25, fov: 44, m: { y: 1.66, z: 4.1, ly: 1.3, fov: 50 } },
    idle(t, dt, vr) {
      let busy = false;
      if (sprayOn > 0) { sprayOn -= dt; drawSpray(t); busy = true; }
      if (balOn > 0) { balOn = Math.max(0, balOn - dt * 0.05); busy = busy || balCycle < 2.4; }
      if (!ambientOn() && !busy) return false;
      dust.uniforms.uTime.value = t; beamM.opacity = 0.18 + Math.sin(t * 0.4) * 0.04;
      if (vr[0] < -2.0) rotor.rotation.y += dt * 9;
      if (vr[0] < 1.0) { fl.idle(t, dt); drop.position.y = 0.16 - ((t * 0.5) % 1) * 0.12; drop.visible = ((t * 0.5) % 1) < 0.85; }
      balCycle += dt; if (balCycle > 9) { balCycle = 0; balV = 12.38 + Math.random() * 0.05; }
      if (vr[0] < 1.4 && vr[1] > 0.2) { const k = Math.max(0, 1 - balCycle / 2.2); drawBal(balV + Math.sin(t * 17) * 0.004 * k + (k > 0 ? 0.0003 * Math.sin(t * 41) : 0), balOn > 0 || balCycle < 6); }
      if (t - phT0 > 1.6) { phT0 = t; phV = 7.0 + Math.sin(t * 0.3) * 0.03; drawPh(); }
      const sec = MC.now().getSeconds(); if (sec !== lastSec) { lastSec = sec; setClock(); }
      steamT -= dt; const puffOn = steamT < 0; if (steamT < -2.6) steamT = 7 + Math.random() * 5;
      if (vr[1] > 3.4) puffs.forEach(s => { const k = ((t * 0.45 + s.userData.ph) % 1); s.position.set(0.22 + Math.sin(k * 5 + s.userData.ph * 9) * 0.05, 1.1 + k * 0.7, k * 0.12); s.scale.setScalar(0.12 + k * 0.45); s.material.opacity = puffOn ? 0.32 * Math.sin(k * Math.PI) : Math.max(0, s.material.opacity - dt * 0.4); });
      needle.rotation.z = -0.4 + Math.sin(t * 0.7) * 0.05;
      pull.rotation.z = pull.rotation.z * 0.95 + Math.sin(t * 0.9) * 0.01;
      return busy ? true : 'amb';
    },
    hover(id, on) { const o = { lab1: l1, lab2: l2 }[id]; if (o) anim(o.position, { y: (o === l2 ? 0 : top) + (on ? 0.03 : 0), duration: 0.3 }); }
  };
}

/* =========================================================
   FISIOPATOLOGÍA (pósters anatómicos)
   ========================================================= */
async function buildFisioRoom() {
  const sh = roomShell({ x0: -3.2, x1: 8.6, wall: 0xf3e6d2, band: 0x6e2a26, bandH: 0.95, floor: '#5a4436', bg: 0x0f0908, fillC: 0xff9a7a, fillX: 2.2, poolX: 2.2, pool: 'rgba(255,222,180,.95)', amb: 'rgb(58,42,38)', spots2: [[6.6, 2.0, 1.2, 'rgba(160,200,255,.45)']], exposure: 1.0, on: { hemi: 0.35, key: 0.9, fill: 1.4 } });
  const S = sh.scene; const top = bench(S, -1.0, 5.4, { legs: true, topC: 0xc79a62, rough: 0.5, top: 0.8, d: 0.9, z: 0.55 });
  const head = (g, w, title, c) => { g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, w, 2000); g.fillStyle = c; g.fillRect(0, 0, w, 70); g.fillStyle = '#fff'; g.font = '600 38px Fraunces'; g.fillText(title, 24, 50); };
  // póster 1: niveles de organización
  poster(S, 0, 2.1, 0.95, 1.25, (g, w, h) => {
    head(g, w, 'Niveles de organización', '#ad3326');
    const lv = ['célula', 'tejido', 'órgano', 'sistema', 'organismo']; g.font = '700 34px Caveat';
    lv.forEach((t, i) => { const y = 130 + i * 112; g.fillStyle = ['#ffa197', '#ffd166', '#ff6b5b', '#9cc0ff', '#a6dd88'][i]; g.beginPath(); g.arc(90, y, 38, 0, 7); g.fill(); g.strokeStyle = '#221d2e'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#221d2e'; g.fillText(t, 150, y + 12); if (i < 4) { g.beginPath(); g.moveTo(90, y + 44); g.lineTo(90, y + 70); g.stroke(); g.beginPath(); g.moveTo(80, y + 60); g.lineTo(90, y + 72); g.lineTo(100, y + 60); g.stroke(); } });
  }, 0.012, 0.01);
  // póster 2: los tejidos
  poster(S, 2.2, 2.1, 0.95, 1.25, (g, w, h) => {
    head(g, w, 'Los tejidos', '#5a2ec0');
    const T = [['epitelial', '#ffa197'], ['conectivo', '#ffd166'], ['muscular', '#ff6b5b'], ['nervioso', '#c3adff']];
    T.forEach(([t, c], i) => { const cx = 140 + (i % 2) * 240, cy = 210 + Math.floor(i / 2) * 280; g.fillStyle = c; g.beginPath(); g.arc(cx, cy, 90, 0, 7); g.fill(); g.save(); g.beginPath(); g.arc(cx, cy, 90, 0, 7); g.clip(); g.strokeStyle = 'rgba(34,29,46,.7)'; g.lineWidth = 3;
      if (i === 0) for (let y = cy - 90; y < cy + 90; y += 30) for (let x = cx - 90; x < cx + 90; x += 30) { g.strokeRect(x + (y / 30 % 2) * 15, y, 30, 30); g.beginPath(); g.arc(x + 15 + (y / 30 % 2) * 15, y + 15, 5, 0, 7); g.stroke(); }
      if (i === 1) for (let k = 0; k < 14; k++) { g.beginPath(); g.moveTo(cx - 90, cy - 80 + k * 13); g.bezierCurveTo(cx - 30, cy - 120 + k * 15, cx + 30, cy - 40 + k * 11, cx + 90, cy - 80 + k * 13); g.stroke(); }
      if (i === 2) for (let y = cy - 90; y < cy + 90; y += 12) { g.beginPath(); g.moveTo(cx - 90, y); g.lineTo(cx + 90, y + 8); g.stroke(); }
      if (i === 3) { for (let a = 0; a < 7; a++) { g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(a) * 50, cy + Math.sin(a) * 30, cx + Math.cos(a) * 85, cy + Math.sin(a) * 80); g.stroke(); } g.fillStyle = '#5a2ec0'; g.beginPath(); g.arc(cx, cy, 16, 0, 7); g.fill(); }
      g.restore(); g.fillStyle = '#221d2e'; g.font = '700 32px Caveat'; g.textAlign = 'center'; g.fillText(t, cx, cy + 124); g.textAlign = 'left'; });
  }, 0.012, -0.012);
  // póster 3: el corazón
  poster(S, 4.4, 2.1, 0.95, 1.25, (g, w, h) => {
    head(g, w, 'El corazón', '#ad3326');
    g.fillStyle = '#ff8a7a'; g.strokeStyle = '#221d2e'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(256, 600); g.bezierCurveTo(120, 500, 100, 330, 170, 260); g.bezierCurveTo(220, 210, 300, 220, 330, 260); g.bezierCurveTo(400, 240, 430, 330, 400, 420); g.bezierCurveTo(370, 500, 310, 560, 256, 600); g.fill(); g.stroke();
    g.strokeStyle = '#d8231f'; g.lineWidth = 26; g.lineCap = 'round'; g.beginPath(); g.moveTo(270, 250); g.bezierCurveTo(270, 160, 360, 140, 380, 210); g.stroke();
    g.strokeStyle = '#3b6fd1'; g.beginPath(); g.moveTo(200, 270); g.lineTo(200, 150); g.stroke();
    g.strokeStyle = '#221d2e'; g.lineWidth = 3; g.beginPath(); g.moveTo(256, 300); g.lineTo(256, 560); g.stroke();
    g.fillStyle = '#221d2e'; g.font = '700 28px Caveat';
    [['aurícula dcha.', 28, 330], ['ventrículo dcho.', 28, 470], ['aurícula izq.', 368, 330], ['ventrículo izq.', 350, 520], ['aorta', 390, 170]].forEach(([t, x, y]) => g.fillText(t, x, y));
    g.font = '700 22px "Atkinson Hyperlegible"'; g.fillStyle = '#4f485c'; g.fillText('visto de frente: su derecha, tu izquierda', 24, h - 30);
  }, 0.012, 0.008);
  poster(S, 6.6, 2.0, 1.6, 0.9, (g, w, h) => { g.fillStyle = '#f7f9f9'; g.fillRect(0, 0, w, h); g.strokeStyle = '#9aa3aa'; g.lineWidth = 10; g.strokeRect(0, 0, w, h); g.fillStyle = '#ad3326'; g.font = '700 46px Caveat'; g.fillText('Infografía de enfermedad', 26, 80); g.fillStyle = '#221d2e'; g.font = '700 38px Caveat'; const _inf = MC.AG.ev.find(e => e.id === 'fisio-infografia'); g.fillText(_inf.due > MC.now() ? MC.relDay(_inf.date).toLowerCase() + ', hasta las 23:59' : 'entregada el ' + _inf.date.getDate() + ' de noviembre', 26, 140); g.strokeStyle = '#ad3326'; g.lineWidth = 5; g.beginPath(); g.moveTo(26, 156); g.quadraticCurveTo(200, 146, 420, 160); g.stroke(); });

  /* --- Fisio 1 · torso desmontable --- */
  const tor = stand(S, 0, top, 0.55, 0.1, 0.14);
  const body = new THREE.Group(); body.position.y = 0.13; tor.add(body);
  const skin = std(0xe9b79a, { roughness: 0.55 }), cav = std(0xa8584c, { roughness: 0.7, side: THREE.DoubleSide });
  const prof = [[0.001, 0], [0.13, 0], [0.16, 0.05], [0.17, 0.2], [0.16, 0.32], [0.19, 0.42], [0.2, 0.48], [0.15, 0.53], [0.06, 0.56], [0.05, 0.6], [0.001, 0.6]].map(([a, b]) => new THREE.Vector2(a, b));
  const back = mesh(new THREE.LatheGeometry(prof, 24, Math.PI / 2, Math.PI), cav, 0, 0, 0, body); back.scale.z = 0.7;
  const backOut = mesh(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p.x * 1.02, p.y)), 24, Math.PI / 2, Math.PI), skin, 0, 0, 0, body); backOut.scale.z = 0.7;
  const front = new THREE.Group(); body.add(front);
  const fm = mesh(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p.x * 1.02, p.y)), 24, -Math.PI / 2, Math.PI), std(0xe9b79a, { roughness: 0.55, side: THREE.DoubleSide }), 0, 0, 0, front); fm.scale.z = 0.7;
  sph(0.095, skin, 0, 0.71, 0, body); cyl(0.045, 0.05, 0.08, skin, 0, 0.6, 0, body);
  const organs = new THREE.Group(); body.add(organs);
  const lungM = std(0xf09aa6, { roughness: 0.5 });
  [-0.075, 0.075].forEach(x => sph(0.065, lungM, x, 0.38, 0.0, organs).scale.set(1, 1.5, 0.8));
  sph(0.045, std(0xd8231f, { roughness: 0.4 }), 0.02, 0.34, 0.05, organs);
  sph(0.07, std(0x8a2b22, { roughness: 0.5 }), -0.05, 0.23, 0.02, organs).scale.set(1.3, 0.6, 0.8);
  sph(0.05, std(0xf2a58a, { roughness: 0.5 }), 0.06, 0.22, 0.03, organs).scale.set(1.2, 0.8, 0.8);
  mesh(new THREE.TorusKnotGeometry(0.05, 0.016, 64, 8, 2, 3), std(0xe89a7a, { roughness: 0.5 }), 0, 0.1, 0.02, organs);
  tagSpot(tor, 'fisio1');
  let torOpen = false;
  function reactFisio1() {
    const tl = gsap.timeline();
    if (!torOpen) { tl.to(front.position, { z: 0.28, x: 0.12, duration: 0.7, ease: 'power3.out' }, 0).to(front.rotation, { y: 0.7, duration: 0.7, ease: 'power3.out' }, 0); torOpen = true; }
    organs.children.forEach((o, i) => tl.fromTo(o.position, { z: o.position.z }, { z: o.position.z + 0.04, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 0.4 + i * 0.07));
    animTL(tl);
  }

  /* --- Fisio 2 · microscopio con preparaciones de tejidos --- */
  const f2 = new THREE.Group(); f2.position.set(2.2, top, 0.55); S.add(f2);
  const mic = microscope(f2, -0.12, 0, 0, 0xff6b5b);
  const slides = [];
  const tissue = ['#c25a8c', '#e07aa8', '#a14a86', '#f09ab8'];
  tissue.forEach((c, i) => {
    const t = canvasTex(128, 48, (g, w, h) => { g.fillStyle = '#eef6f8'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, 0, 36, h); g.fillStyle = c; g.beginPath(); g.ellipse(80, 24, 30, 16, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(70,20,90,.7)'; for (let k = 0; k < 40; k++) { g.beginPath(); g.arc(56 + Math.random() * 48, 12 + Math.random() * 24, 1.6, 0, 7); g.fill(); } });
    const s = box(0.15, 0.004, 0.05, std(0xffffff, { map: t, roughness: 0.2 }), 0.22, 0.004 + i * 0.005, 0.02, f2); s.userData.home = s.position.clone(); slides.push(s);
  });
  tagSpot(f2, 'fisio2');
  function reactFisio2() {
    const tl = gsap.timeline();
    slides.forEach((s, i) => tl.to(s.rotation, { y: -0.5 + i * 0.32, duration: 0.5, ease: 'back.out(2)' }, i * 0.05).to(s.position, { x: 0.24 + i * 0.02, z: 0.02 + i * 0.03, duration: 0.5 }, i * 0.05));
    tl.to(slides[0].position, { x: -0.12, y: 0.21, z: 0.03, duration: 0.6, ease: 'power3.inOut' }, 0.55).to(slides[0].rotation, { y: 0, duration: 0.6 }, 0.55)
      .to(mic.glow.material, { opacity: 0.9, duration: 0.3 }, 0.9).to(mic.lamp.material.color, { r: 1, g: 0.75, b: 0.85, duration: 0.3 }, 0.9);
    animTL(tl);
  }

  /* --- Fisio 3 · corazón que late --- */
  /* lámpara de quirófano: disco brillante en el techo y cono de luz que late con el corazón */
  const lampG = new THREE.Group(); lampG.position.set(2.2, 3.05, 0.9); S.add(lampG);
  cyl(0.42, 0.46, 0.08, std(0xdfe3e6, { roughness: 0.3, metalness: 0.4 }), 0, 0, 0, lampG, 40);
  const lampDisc = cyl(0.36, 0.36, 0.01, basic(0xfff3dc), 0, -0.045, 0, lampG, 40);
  cyl(0.02, 0.02, 0.4, metalM(), 0, 0.24, 0, lampG);
  const coneM = basic(0xffe6c4, { map: glowTex, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const cone = mesh(new THREE.CylinderGeometry(0.36, 1.5, 2.2, 32, 1, true), coneM, 0, -1.15, 0, lampG);
  const lampGlow = glowSprite(0xfff0d8, 1.4, 0, -0.08, 0.05, lampG, 0.5);
  const f3 = stand(S, 4.4, top, 0.55, 0.22);
  const hm = heartModel(f3, 0, 0.6, 0, 0.9);
  tagSpot(f3, 'fisio3');
  let beatBoost = 0;
  function reactFisio3() { beatBoost = 1; const tl = gsap.timeline(); tl.fromTo(hm.red, { emissiveIntensity: 0.7 }, { emissiveIntensity: 0, duration: 2.2 }); animTL(tl); kick(2.4); }

  /* --- decoración: esqueleto colgado, negatoscopio, camilla y monitor con ECG --- */
  const mm = new THREE.Matrix4();
  const bone = std(0xeee4cf, { roughness: 0.6 });
  const skelS = new THREE.Group(); skelS.position.set(-2.2, 0, 0.7); S.add(skelS);
  cyl(0.2, 0.22, 0.03, darkM(), 0, 0.015, 0, skelS); cyl(0.015, 0.015, 2.02, metalM(), 0, 1.01, -0.14, skelS); box(0.02, 0.02, 0.16, metalM(), 0, 2.0, -0.07, skelS);
  blob(0.7, 0.6, 0.4, 0, 0.003, 0, skelS);
  const skel = new THREE.Group(); skel.position.set(0, 1.98, 0.0); skelS.add(skel);
  sph(0.085, bone, 0, -0.16, 0, skel).scale.set(0.9, 1.05, 1); box(0.09, 0.045, 0.07, bone, 0, -0.26, 0.02, skel);
  [-0.03, 0.03].forEach(x => sph(0.018, std(0x2a2018), x, -0.15, 0.072, skel));
  cyl(0.016, 0.016, 0.66, bone, 0, -0.62, -0.03, skel);
  const ribs = new THREE.InstancedMesh(new THREE.TorusGeometry(0.1, 0.009, 5, 14, Math.PI * 1.4), bone, 6);
  for (let i = 0; i < 6; i++) { const k = 1 - Math.abs(i - 2) * 0.08; mm.compose(V(0, -0.4 - i * 0.045, 0.02), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, -Math.PI * 0.2)), V(k, k * 0.8, 1)); ribs.setMatrixAt(i, mm); } skel.add(ribs);
  box(0.26, 0.018, 0.02, bone, 0, -0.34, 0.03, skel);
  sph(0.09, bone, 0, -0.97, 0, skel).scale.set(1.35, 0.6, 0.8);
  [-1, 1].forEach(sg => { const a = cyl(0.014, 0.012, 0.56, bone, sg * 0.15, -0.62, 0, skel); a.rotation.z = sg * 0.08; const l = cyl(0.018, 0.014, 0.74, bone, sg * 0.07, -1.38, 0, skel); l.rotation.z = -sg * 0.03; box(0.05, 0.02, 0.1, bone, sg * 0.08, -1.76, 0.03, skel); });
  const neg = new THREE.Group(); neg.position.set(3.3, 2.12, 0.03); S.add(neg);
  rbox(0.74, 0.58, 0.06, 0.012, std(0xe3e6e9, { roughness: 0.4 }), 0, 0, 0, neg);
  const xray = canvasTex(256, 200, (g, w, h) => {
    g.fillStyle = '#e6f0fa'; g.fillRect(0, 0, w, h); g.fillStyle = '#121a26'; g.fillRect(18, 14, w - 36, h - 28);
    g.fillStyle = '#05080e'; [[96, 100], [160, 100]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 34, 62, 0, 0, 7); g.fill(); });
    g.fillStyle = 'rgba(190,205,225,.85)'; g.fillRect(124, 22, 8, 158);
    g.strokeStyle = 'rgba(200,215,235,.6)'; g.lineWidth = 3; for (let i = 0; i < 7; i++) { const y = 52 + i * 17; g.beginPath(); g.ellipse(128, y, 66 - Math.abs(i - 3) * 3, 14, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); g.beginPath(); g.ellipse(128, y + 4, 66 - Math.abs(i - 3) * 3, 14, 0, Math.PI * 0.08, Math.PI * 0.92, true); g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(64, 40); g.lineTo(122, 50); g.moveTo(192, 40); g.lineTo(134, 50); g.stroke();
    g.fillStyle = 'rgba(150,165,190,.45)'; g.beginPath(); g.ellipse(146, 132, 30, 24, 0.4, 0, 7); g.fill();
    g.fillStyle = 'rgba(230,240,250,.8)'; g.font = '700 14px "Atkinson Hyperlegible"'; g.fillText('TÓRAX · PA', 26, 186);
  });
  const negM = basic(0xffffff, { map: xray }); plane(0.66, 0.5, negM, 0, 0, 0.032, neg);
  const negGlow = glowSprite(0xcfe4ff, 1.2, 0, 0, 0.12, neg, 0.16);
  const bed = new THREE.Group(); bed.position.set(6.7, 0, 1.0); S.add(bed);
  const vinyl = std(0x6e2a26, { roughness: 0.45 });
  rbox(1.7, 0.1, 0.62, 0.04, vinyl, 0.1, 0.68, 0, bed); const rest = rbox(0.62, 0.1, 0.62, 0.04, vinyl, -0.95, 0.82, 0, bed); rest.rotation.z = -0.45;
  box(1.6, 0.012, 0.42, std(0xf6f3ec, { roughness: 0.8 }), 0.15, 0.736, 0, bed);
  cyl(0.06, 0.06, 0.5, std(0xf6f3ec, { roughness: 0.8 }), 1.0, 0.68, 0, bed).rotation.x = Math.PI / 2;
  [[-0.65, -0.24], [0.85, -0.24], [-0.65, 0.24], [0.85, 0.24]].forEach(([x, z]) => cyl(0.02, 0.02, 0.62, metalM(), x, 0.31, z, bed));
  box(1.6, 0.04, 0.5, metalM(), 0.1, 0.6, 0, bed);
  blob(2.2, 1.0, 0.4, 0, 0.003, 0, bed);
  const mon = new THREE.Group(); mon.position.set(5.12, top, 0.32); mon.rotation.y = -0.35; S.add(mon);
  rbox(0.48, 0.34, 0.12, 0.02, std(0x2a2d33, { roughness: 0.4 }), 0, 0.22, 0, mon); box(0.12, 0.05, 0.12, darkM(), 0, 0.025, 0, mon);
  const ecgT = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#03130b'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(80,255,150,.1)'; g.lineWidth = 1; for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = '#5dff9a'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath(); const b = 74;
    [[0, b], [60, b], [72, b - 8], [84, b], [112, b], [120, b + 10], [128, 16], [136, b + 22], [144, b], [170, b], [190, b - 14], [210, b], [256, b]].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  });
  ecgT.wrapS = THREE.RepeatWrapping; ecgT.repeat.set(2, 1);
  plane(0.3, 0.22, basic(0xffffff, { map: ecgT }), -0.06, 0.23, 0.061, mon);
  const hrT = canvasTex(128, 192, () => {}); let hrShown = 0;
  const drawHr = bpm => { if (bpm === hrShown) return; hrShown = bpm; hrT.userData.redraw((g, w, h) => { g.fillStyle = '#03130b'; g.fillRect(0, 0, w, h); g.fillStyle = '#5dff9a'; g.font = '700 22px "Atkinson Hyperlegible"'; g.fillText('FC', 12, 30); g.font = '700 58px "Atkinson Hyperlegible Mono", monospace'; g.fillText(String(bpm), 8, 92); g.fillStyle = '#7fd6ff'; g.font = '700 22px "Atkinson Hyperlegible"'; g.fillText('SpO₂', 12, 132); g.font = '700 40px "Atkinson Hyperlegible Mono", monospace'; g.fillText('98', 12, 176); }); };
  drawHr(63); plane(0.1, 0.22, basic(0xffffff, { map: hrT }), 0.16, 0.23, 0.061, mon);
  const hrLed = sph(0.012, basic(0xff5b5b), 0.19, 0.36, 0.062, mon);
  let ecgPh = 0;
  tagSpot(mon, 'fisio4');
  function reactFisio4() { beatBoost = 1; const tl = gsap.timeline(); tl.fromTo(hrLed.scale, { x: 2.4, y: 2.4, z: 2.4 }, { x: 1, y: 1, z: 1, duration: 1.6 }); animTL(tl); kick(2.0); }

  const spots = [
    unitSpot('fisio1', 0, reactFisio1, { anchor: V(0, top + 1.0, 0.55), label: 'Organización del cuerpo' }),
    unitSpot('fisio2', 2.2, reactFisio2, { anchor: V(2.2, top + 0.75, 0.55), label: 'Tejidos' }),
    unitSpot('fisio3', 4.4, reactFisio3, { anchor: V(4.4, top + 1.1, 0.55), label: 'La patología' }),
    unitSpot('fisio4', 5.12, reactFisio4, { anchor: V(5.3, top + 0.4, 0.32), label: 'Vascular y hemodinámica' })
  ];
  return {
    name: 'fisio', shell: sh, exposure: sh.exposure, scene: S, spots, pick: [tor, f2, f3, mon], range: [-0.6, 5.5],
    cfg: { y: 1.62, z: 4.4, ly: 1.15, fov: 44, m: { y: 1.58, z: 4.0, ly: 1.2, fov: 50 } },
    idle(t, dt, vr) {
      const busy = beatBoost > 0;
      if (!ambientOn() && !busy) return false;
      beatBoost = Math.max(0, beatBoost - dt * 0.5);
      /* el corazón, la lámpara y el ECG laten con la misma fase */
      const rate = 6.6 + beatBoost * 5; ecgPh += dt * rate / (Math.PI * 2); ecgT.offset.x = ecgPh % 1;
      const beat = Math.pow(Math.max(0, Math.sin(ecgPh * Math.PI * 2)), 12);
      hm.heart.scale.setScalar(0.9 * (1 + beat * (0.04 + beatBoost * 0.1)));
      coneM.opacity = 0.1 + beat * (0.05 + beatBoost * 0.12); lampGlow.material.opacity = 0.42 + beat * 0.25;
      hrLed.material.color.setRGB(0.35 + beat * 0.65, 0.12, 0.12); drawHr(Math.round(rate / (Math.PI * 2) * 60));
      skel.rotation.z = Math.sin(t * 0.55) * 0.025; skel.rotation.y = Math.sin(t * 0.33) * 0.12;
      negM.color.setScalar(0.95 + Math.sin(t * 0.7) * 0.03); negGlow.material.opacity = 0.14 + Math.sin(t * 0.7) * 0.02;
      return busy ? true : 'amb';
    }
  };
}

/* =========================================================
   Salas sencillas, con identidad
   ========================================================= */
async function buildGestRoom() {
  const sh = roomShell({ x0: -3, x1: 5.4, wall: 0xe9eef2, band: 0xf5ad1b, bandH: 0.12, floor: '#5d6874', bg: 0x0b0d11, key: 0xf2f7ff, fillC: 0xffe6a8, poolX: 1.1, pool: 'rgba(240,248,255,.95)', amb: 'rgb(56,60,66)', spots2: [[2.9, 1.0, 0.8, 'rgba(255,60,60,.35)']], exposure: 1.0, on: { hemi: 0.4, key: 0.95, fill: 1.8 } });
  const S = sh.scene, top = bench(S, -1.2, 3.4, { topC: 0xe6e8ea, cabC: '#a9b2bb', rough: 0.4 });
  poster(S, 1.1, 2.4, 2.4, 0.42, (g, w, h) => { g.fillStyle = '#f5ad1b'; g.fillRect(0, 0, w, h); g.fillStyle = '#221d2e'; g.font = '700 54px "Atkinson Hyperlegible"'; g.fillText('Recepción de muestras', 26, 62); });
  // estante con cajas de muestras
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), std(0xffffff, { roughness: 0.6 }), 10);
  const mm = new THREE.Matrix4(), bc = [0xf5ad1b, 0x3b82f6, 0xff6b5b, 0x2fc796, 0xffffff];
  box(2.4, 0.03, 0.3, std(0xe9e6df), 1.1, 1.85, 0.16, S);
  for (let i = 0; i < 10; i++) { mm.makeTranslation(0.0 + i * 0.24, 1.94, 0.16); boxes.setMatrixAt(i, mm); boxes.setColorAt(i, col(bc[i % 5])); } S.add(boxes);
  /* Gest 1 · maqueta del hospital */
  const hosp = new THREE.Group(); hosp.position.set(0, top, 0.45); S.add(hosp);
  box(0.8, 0.02, 0.5, std(0x6fae4f, { roughness: 0.9 }), 0, 0.01, 0, hosp);
  const wm = std(0xf4f2ee, { roughness: 0.5 });
  box(0.42, 0.22, 0.2, wm, -0.08, 0.13, 0, hosp); box(0.2, 0.14, 0.18, wm, 0.25, 0.09, 0.03, hosp); box(0.14, 0.36, 0.14, wm, -0.16, 0.2, -0.02, hosp);
  const red = std(0xd8231f, { roughness: 0.4 }); box(0.07, 0.012, 0.02, red, -0.16, 0.386, -0.02, hosp); box(0.02, 0.012, 0.07, red, -0.16, 0.386, -0.02, hosp);
  const winPos = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) winPos.push([-0.27 + c * 0.07, 0.07 + r * 0.06, 0.101]); for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) winPos.push([-0.19 + c * 0.06, 0.09 + r * 0.06, 0.051]); for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) winPos.push([0.18 + c * 0.065, 0.06 + r * 0.05, 0.121]);
  const wins = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.035, 0.03), basic(0xffffff), winPos.length);
  winPos.forEach((p, i) => { mm.makeTranslation(...p); wins.setMatrixAt(i, mm); wins.setColorAt(i, col(0x3a4a5a)); }); hosp.add(wins);
  [[0.3, -0.18], [0.34, 0.18], [-0.34, 0.2]].forEach(([x, z]) => { mesh(new THREE.ConeGeometry(0.035, 0.1, 8), std(0x2f7a2a), x, 0.07, z, hosp); });
  tagSpot(hosp, 'gest1');
  function reactGest1() { const o = { p: 0 }; const tl = gsap.timeline(); tl.to(o, { p: 1, duration: 1.2, onUpdate: () => { winPos.forEach((p, i) => wins.setColorAt(i, (i / winPos.length) < o.p ? col(0xffd27a) : col(0x3a4a5a))); wins.instanceColor.needsUpdate = true; } }); animTL(tl); }
  /* el ventilador de la recepción gira despacio */
  const fan = new THREE.Group(); fan.position.set(1.1, 3.1, 1.6); S.add(fan);
  cyl(0.02, 0.02, 0.28, metalM(), 0, 0.15, 0, fan); cyl(0.09, 0.07, 0.08, std(0xe8ebee, { roughness: 0.4 }), 0, 0, 0, fan, 20);
  const blades = new THREE.Group(); fan.add(blades);
  for (let k = 0; k < 4; k++) { const bl = box(0.62, 0.012, 0.11, std(0xd6dadf, { roughness: 0.5 }), 0.36, -0.01, 0, blades); const pv = new THREE.Group(); pv.rotation.y = k * Math.PI / 2; blades.add(pv); pv.add(bl); bl.rotation.x = 0.12; }
  /* Gest 2 · gradilla con tapones de colores y código de barras */
  const rack = new THREE.Group(); rack.position.set(2.2, top, 0.45); S.add(rack);
  const amber = std(0xffa82e, { roughness: 0.35 });
  rbox(1.0, 0.04, 0.3, 0.015, amber, 0, 0.02, 0, rack); rbox(1.0, 0.035, 0.3, 0.015, amber, 0, 0.3, 0, rack); [-0.48, 0.48].forEach(x => box(0.035, 0.3, 0.26, amber, x, 0.16, 0, rack));
  const caps = [0xffb547, 0xa47cf0, 0xe5484d, 0x3d8bff, 0x7ad35c], fills = [0xf5d36b, 0x7a0f14, 0x6b0d12, 0xe8dcc0, 0xffe7a0];
  const bar = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; for (let x = 8; x < w - 8;) { const bw = 1 + Math.floor(Math.random() * 4); g.fillRect(x, 6, bw, h - 20); x += bw + 1 + Math.floor(Math.random() * 3); } g.font = '700 11px monospace'; g.fillText('TSAPC-0311', 18, h - 3); });
  const tubes = [], labels = [];
  caps.forEach((c, i) => {
    const t = new THREE.Group(); t.position.set(-0.36 + i * 0.18, 0.05, 0); rack.add(t);
    mesh(new THREE.CapsuleGeometry(0.045, 0.5, 4, 16), glassMat(0xffffff, 0.3), 0, 0.28, 0, t);
    mesh(new THREE.CapsuleGeometry(0.038, 0.22 + (i % 3) * 0.07, 4, 12), std(fills[i], { roughness: 0.25 }), 0, 0.17 + (i % 3) * 0.035, 0, t);
    cyl(0.055, 0.055, 0.1, std(c, { roughness: 0.5 }), 0, 0.6, 0, t);
    const lb = plane(0.07, 0.12, std(0xffffff, { map: bar, roughness: 0.6 }), 0, 0.36, 0.047, t); labels.push(lb);
    tubes.push(t);
  });
  const gun = new THREE.Group(); gun.position.set(0.68, 0, 0.12); gun.rotation.y = -0.5; rack.add(gun);
  rbox(0.08, 0.06, 0.18, 0.015, std(0x2a2d33), 0, 0.12, 0, gun); const grip = rbox(0.05, 0.14, 0.06, 0.012, std(0x2a2d33), 0, 0.05, -0.05, gun); grip.rotation.x = 0.3;
  const laser = plane(0.6, 0.006, basic(0xff2a2a, { transparent: true, opacity: 0 }), -0.3, 0.33, 0.06, rack);
  const led = sph(0.012, basic(0xff3030), 0.04, 0.155, 0.09, gun);
  tagSpot(rack, 'gest2');
  function reactGest2() { const tl = gsap.timeline(); tubes.forEach((t, i) => tl.fromTo(t.rotation, { z: 0.18 }, { z: 0, duration: 1.1, ease: 'elastic.out(1,0.3)' }, i * 0.06)); tl.fromTo(laser.material, { opacity: 0.9 }, { opacity: 0, duration: 1.2 }, 0.2).fromTo(laser.position, { y: 0.55 }, { y: 0.2, duration: 1.2, ease: 'sine.inOut' }, 0.2); labels.forEach((l, i) => tl.fromTo(l.material.color, { r: 0.5, g: 1, b: 0.6 }, { r: 1, g: 1, b: 1, duration: 0.5 }, 0.3 + i * 0.15)); animTL(tl); }
  /* --- decoración: nevera de muestras, cinta transportadora, impresora de etiquetas y «su turno» --- */
  const fr = new THREE.Group(); fr.position.set(-2.2, 0, 0.42); S.add(fr);
  const frW = std(0xeef1f4, { roughness: 0.35 });
  rbox(0.72, 1.8, 0.4, 0.03, frW, 0, 0.9, -0.11, fr);
  [-0.325, 0.325].forEach(x => box(0.07, 1.8, 0.24, frW, x, 0.9, 0.2, fr)); box(0.72, 0.36, 0.24, frW, 0, 1.62, 0.2, fr); box(0.72, 0.16, 0.24, frW, 0, 0.08, 0.2, fr);
  plane(0.58, 1.28, basic(0xc9e4ff), 0, 0.8, 0.095, fr);
  [0.44, 0.84, 1.24].forEach(y => box(0.58, 0.012, 0.22, std(0xdfe6ee, { roughness: 0.3 }), 0, y, 0.2, fr));
  const NTB = 27, ftub = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8), std(0xffffff, { roughness: 0.4 }), NTB);
  for (let i = 0; i < NTB; i++) { const r = Math.floor(i / 9), c = i % 9; mm.makeTranslation(-0.24 + c * 0.06, 0.51 + r * 0.4, 0.2); ftub.setMatrixAt(i, mm); ftub.setColorAt(i, col(caps[(i + r) % 5])); } fr.add(ftub);
  plane(0.58, 1.3, glassMat(0xe6f4ff, 0.2), 0, 0.8, 0.322, fr);
  const frT = canvasTex(256, 96, () => {}); let frV = 4.0;
  const drawFr = () => frT.userData.redraw((g, w, h) => { g.fillStyle = '#081024'; g.fillRect(0, 0, w, h); g.fillStyle = '#9fd0ff'; g.font = '700 56px "Atkinson Hyperlegible Mono", monospace'; g.fillText(frV.toFixed(1).replace('.', ',') + ' °C', 16, 68); });
  drawFr(); plane(0.24, 0.09, basic(0xffffff, { map: frT }), 0, 1.62, 0.322, fr);
  glowSprite(0xbfe0ff, 1.3, 0, 0.85, 0.4, fr, 0.16);
  blob(1.0, 0.9, 0.45, 0, 0.003, 0.1, fr);
  const belt = new THREE.Group(); belt.position.set(1.1, top, 0.12); S.add(belt);
  box(4.3, 0.05, 0.17, std(0x2a2d33, { roughness: 0.6 }), 0, 0.025, 0, belt);
  const beltT = canvasTex(64, 32, (g, w, h) => { g.fillStyle = '#1a1c20'; g.fillRect(0, 0, w, h); g.fillStyle = '#34373e'; g.fillRect(0, 0, 6, h); });
  beltT.wrapS = THREE.RepeatWrapping; beltT.repeat.set(36, 1);
  plane(4.3, 0.14, basic(0xffffff, { map: beltT }), 0, 0.052, 0, belt).rotation.x = -Math.PI / 2;
  [-0.09, 0.09].forEach(z => box(4.3, 0.04, 0.012, metalM(), 0, 0.07, z, belt));
  const NBT = 9, btub = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 10), std(0xf1efe9, { roughness: 0.3 }), NBT), bcap = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.027, 0.027, 0.035, 10), std(0xffffff, { roughness: 0.5 }), NBT);
  for (let i = 0; i < NBT; i++) bcap.setColorAt(i, col(caps[i % 5])); belt.add(btub, bcap);
  function drawBelt(t) { for (let i = 0; i < NBT; i++) { const x = ((t * 0.1 + i / NBT) % 1) * 4.1 - 2.05; mm.makeTranslation(x, 0.125, 0); btub.setMatrixAt(i, mm); mm.makeTranslation(x, 0.21, 0); bcap.setMatrixAt(i, mm); } btub.instanceMatrix.needsUpdate = bcap.instanceMatrix.needsUpdate = true; beltT.offset.x = -(t * 0.1 * 36 / 4.3 * 4.1) % 1; }
  drawBelt(0);
  const prn = new THREE.Group(); prn.position.set(3.05, top, 0.55); prn.rotation.y = -0.3; S.add(prn);
  rbox(0.24, 0.14, 0.26, 0.02, std(0x3a3f47, { roughness: 0.5 }), 0, 0.07, 0, prn); box(0.16, 0.008, 0.01, basic(0x0a0a0a), 0, 0.09, 0.131, prn);
  const lbl = plane(0.12, 0.07, std(0xffffff, { map: bar, roughness: 0.6, side: THREE.DoubleSide }), 0, 0.09, 0.14, prn); lbl.rotation.x = -1.2;
  const prnLed = sph(0.008, basic(0x4dff9a), 0.08, 0.142, 0.08, prn);
  const turn = new THREE.Group(); turn.position.set(3.95, 2.15, 0.03); S.add(turn);
  poster(turn, 0, 0.24, 0.6, 0.14, (g, w, h) => { g.fillStyle = '#f5ad1b'; g.fillRect(0, 0, w, h); g.fillStyle = '#221d2e'; g.font = '700 70px "Atkinson Hyperlegible"'; g.textAlign = 'center'; g.fillText('Su turno', w / 2, h * 0.76); }, 0);
  rbox(0.6, 0.26, 0.06, 0.015, std(0x15171a, { roughness: 0.4 }), 0, 0.0, 0, turn);
  const turnT = canvasTex(256, 96, () => {}); let turnN = 27;
  const drawTurn = () => turnT.userData.redraw((g, w, h) => { g.fillStyle = '#0a0606'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff4433'; g.font = '700 74px "Atkinson Hyperlegible Mono", monospace'; g.textAlign = 'center'; g.fillText('A' + String(turnN).padStart(3, '0'), w / 2, 74); });
  drawTurn(); const turnM = basic(0xffffff, { map: turnT }); plane(0.52, 0.19, turnM, 0, 0, 0.031, turn);
  const disp = new THREE.Group(); disp.position.set(3.95, 1.25, 0.08); S.add(disp);
  rbox(0.2, 0.26, 0.14, 0.03, std(0xd8231f, { roughness: 0.4 }), 0, 0, 0, disp); box(0.08, 0.05, 0.004, std(0xfbf7ee), 0, -0.08, 0.072, disp);
  let turnT0 = 0, lblT0 = 0, frT0 = 0;

  return {
    name: 'gest', shell: sh, exposure: sh.exposure, scene: S, pick: [hosp, rack], range: [-0.6, 2.8],
    idle(t, dt) {
      if (!ambientOn()) return false;
      blades.rotation.y += dt * 1.6; led.material.color.setRGB(0.55 + Math.sin(t * 2.4) * 0.45, 0.1, 0.1);
      drawBelt(t);
      const lp = ((t - lblT0) % 6) / 6; lbl.position.z = 0.135 + Math.min(1, lp * 4) * 0.05; lbl.material.opacity = 1; prnLed.material.color.setRGB(0.2, lp < 0.25 ? 1 : 0.4, 0.5);
      if (t - turnT0 > 9) { turnT0 = t; turnN = turnN % 999 + 1; drawTurn(); anim(turnM.color, { r: 1, g: 1, b: 1, duration: 0.6, startAt: { r: 2.2, g: 2.2, b: 2.2 } }); }
      if (t - frT0 > 3) { frT0 = t; frV = 3.9 + Math.round(Math.sin(t * 0.37) * 2 + 2) / 20; drawFr(); }
      return 'amb';
    },
    spots: [unitSpot('gest1', 0, reactGest1, { anchor: V(-0.08, top + 0.42, 0.45), label: 'Sector sanitario' }), unitSpot('gest2', 2.2, reactGest2, { anchor: V(2.2, top + 0.7, 0.45), label: 'El laboratorio' })],
    cfg: { y: 1.62, z: 4.0, ly: 1.15, fov: 44, m: { y: 1.58, z: 3.8, ly: 1.2, fov: 50 } }
  };
}

async function buildIpeRoom() {
  const stripe = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#f5c518'; g.fillRect(0, 0, w, h); g.fillStyle = '#18191c'; for (let x = -64; x < w; x += 48) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 24, h); g.lineTo(x + 24 + h, 0); g.lineTo(x + h, 0); g.fill(); } });
  stripe.wrapS = THREE.RepeatWrapping; stripe.repeat.set(10, 1);
  const sh = roomShell({ x0: -3, x1: 5.4, wall: 0xb9bcbe, floor: '#4c4f52', bg: 0x0a0b0d, sky: 0xe6efff, fillC: 0xffd27a, poolX: 1.1, pool: 'rgba(255,236,190,.95)', amb: 'rgb(46,48,52)', spots2: [[4.1, 2.5, 1.2, 'rgba(255,170,40,.5)'], [-2.2, 1.0, 1.0, 'rgba(60,255,140,.3)']], exposure: 1.0, on: { hemi: 0.55, key: 1.6, fill: 2.6 } });
  const S = sh.scene; plane(8.4, 0.18, std(0xffffff, { map: stripe, roughness: 0.6 }), 1.2, 1.05, 0.004, S);
  const top = bench(S, -1.0, 3.4, { legs: true, topC: 0xdfe3e8, rough: 0.5, top: 0.8, z: 0.55 });
  const sign = (x, y, kind, size = 0.42) => poster(S, x, y, size, size * 0.9, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#f5c518'; g.strokeStyle = '#18191c'; g.lineWidth = 22; g.lineJoin = 'round'; g.beginPath(); g.moveTo(w / 2, 30); g.lineTo(w - 30, h - 30); g.lineTo(30, h - 30); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#18191c';
    if (kind === 'ruido') { g.beginPath(); g.ellipse(w / 2 - 10, h * 0.62, 34, 50, 0, 0, 7); g.fill(); g.strokeStyle = '#18191c'; g.lineWidth = 9; [70, 100].forEach(r => { g.beginPath(); g.arc(w / 2 - 10, h * 0.62, r, -0.6, 0.6); g.stroke(); }); }
    else { g.fillRect(w / 2 - 12, h * 0.38, 24, 110); g.beginPath(); g.arc(w / 2, h * 0.78, 15, 0, 7); g.fill(); } });
  const s1 = sign(-0.4, 2.25, 'ruido'); s1.material.transparent = true; const s2 = sign(0.4, 2.25, 'excl'); s2.material.transparent = true;
  poster(S, 2.2, 2.2, 0.8, 0.8, (g, w, h) => { g.fillStyle = '#0f8a4c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 36; g.beginPath(); g.moveTo(w / 2, 90); g.lineTo(w / 2, h - 90); g.moveTo(90, h / 2); g.lineTo(w - 90, h / 2); g.stroke(); g.fillStyle = '#fff'; g.font = '700 46px "Atkinson Hyperlegible"'; g.textAlign = 'center'; g.fillText('Primeros auxilios', w / 2, h - 26); });
  /* baliza ámbar en la pared: su haz barre la sala */
  const bea = new THREE.Group(); bea.position.set(4.1, 2.55, 0.12); S.add(bea);
  cyl(0.07, 0.08, 0.05, darkM(), 0, -0.07, 0, bea); cyl(0.06, 0.06, 0.12, std(0xffa31a, { emissive: 0xff8c00, emissiveIntensity: 1.2, transparent: true, opacity: 0.9 }), 0, 0.02, 0, bea);
  const sweep = new THREE.Group(); bea.add(sweep);
  const swM = basic(0xffb340, { map: glowTex, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const swp = plane(2.6, 0.5, swM, 1.3, 0.02, 0, sweep); swp.rotation.x = Math.PI / 2;
  const beaGlow = glowSprite(0xffa020, 0.6, 0, 0.02, 0.05, bea, 0.6);
  const exitS = poster(S, -2.2, 2.6, 0.5, 0.2, (g, w, h) => { g.fillStyle = '#0f8a4c'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '700 120px "Atkinson Hyperlegible"'; g.textAlign = 'center'; g.fillText('SALIDA', w / 2 + 20, h * 0.78); });
  glowSprite(0x3dff9a, 0.9, -2.2, 2.6, 0.08, S, 0.25);
  /* IPE 2 · sonómetro y señal */
  const son = new THREE.Group(); son.position.set(0, top, 0.55); S.add(son);
  const body = new THREE.Group(); body.position.set(-0.08, 0, 0); son.add(body); body.rotation.x = -0.15;
  rbox(0.11, 0.3, 0.05, 0.02, std(0x2a2d33, { roughness: 0.4 }), 0, 0.17, 0, body);
  cyl(0.012, 0.016, 0.14, metalM(), 0, 0.39, 0, body); const foam = sph(0.04, std(0x5a5e66, { roughness: 1 }), 0, 0.47, 0, body);
  let level = 0.3;
  const dbTex = canvasTex(128, 160, (g, w, h) => {});
  function drawDb() { dbTex.userData.redraw((g, w, h) => { g.fillStyle = '#0f1a14'; g.fillRect(0, 0, w, h); g.fillStyle = '#9dffc8'; g.font = '700 46px "Atkinson Hyperlegible Mono", monospace'; g.fillText(Math.round(45 + level * 50), 14, 52); g.font = '700 22px "Atkinson Hyperlegible"'; g.fillText('dB', 86, 52); for (let i = 0; i < 8; i++) { g.fillStyle = i / 8 < level ? (i > 5 ? '#ff6b5b' : i > 3 ? '#ffd166' : '#9dffc8') : '#24352c'; g.fillRect(14 + i * 13, 140 - i * 9, 10, i * 9 + 6); } }); }
  drawDb(); plane(0.085, 0.105, basic(0xffffff, { map: dbTex }), 0, 0.22, 0.026, body);
  const tri = new THREE.Group(); tri.position.set(0.2, 0, 0); son.add(tri);
  const triT = canvasTex(256, 230, (g, w, h) => { g.fillStyle = '#f5c518'; g.strokeStyle = '#18191c'; g.lineWidth = 18; g.lineJoin = 'round'; g.beginPath(); g.moveTo(w / 2, 20); g.lineTo(w - 20, h - 20); g.lineTo(20, h - 20); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#18191c'; g.beginPath(); g.ellipse(w / 2 - 8, h * 0.64, 22, 34, 0, 0, 7); g.fill(); g.lineWidth = 7; [48, 68].forEach(r => { g.beginPath(); g.arc(w / 2 - 8, h * 0.64, r, -0.6, 0.6); g.stroke(); }); });
  const tp = plane(0.28, 0.25, std(0xffffff, { map: triT, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }), 0, 0.16, 0, tri); tp.rotation.x = -0.15;
  const rings = [0, 1, 2].map(i => { const r = mesh(new THREE.TorusGeometry(0.06, 0.004, 6, 32), basic(0x9cc0ff, { transparent: true, opacity: 0 }), 0, 0.47, 0, body); return r; });
  blob(0.7, 0.5, 0.4, 0, 0.003, 0, son);
  tagSpot(son, 'ipe2');
  function reactIpe2() { const o = { t: 0 }; const tl = gsap.timeline(); tl.to(o, { t: 1, duration: 1.8, onUpdate() { level = 0.3 + Math.abs(Math.sin(o.t * 14)) * 0.65 * (1 - o.t * 0.6); drawDb(); } }, 0); rings.forEach((r, i) => tl.fromTo(r.scale, { x: 1, y: 1, z: 1 }, { x: 5, y: 5, z: 5, duration: 1, ease: 'power2.out' }, i * 0.3).fromTo(r.material, { opacity: 0.8 }, { opacity: 0, duration: 1 }, i * 0.3)); animTL(tl); }
  /* IPE 5 · botiquín y maniquí de RCP */
  const aid = new THREE.Group(); aid.position.set(2.2, top, 0.55); S.add(aid);
  const kit = new THREE.Group(); kit.position.set(-0.3, 0, 0); kit.rotation.y = 0.3; aid.add(kit);
  rbox(0.5, 0.33, 0.2, 0.04, std(0x3a74e8, { roughness: 0.4 }), 0, 0.165, 0, kit);
  const crossM = std(0xffffff, { roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0 });
  rbox(0.055, 0.17, 0.02, 0.008, crossM, 0, 0.16, 0.1, kit); rbox(0.17, 0.055, 0.02, 0.008, crossM, 0, 0.16, 0.1, kit);
  mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 20, Math.PI), darkM(), 0, 0.33, 0, kit);
  const man = new THREE.Group(); man.position.set(0.22, 0, 0.02); aid.add(man);
  const mskin = std(0xf0d2bd, { roughness: 0.6 });
  const chest = mesh(new THREE.CapsuleGeometry(0.11, 0.24, 6, 16), mskin, 0, 0.1, 0, man); chest.rotation.z = Math.PI / 2; chest.scale.set(1, 1, 0.65);
  sph(0.08, mskin, -0.27, 0.1, 0, man); cyl(0.04, 0.045, 0.06, mskin, -0.19, 0.1, 0, man).rotation.z = Math.PI / 2;
  blob(1, 0.5, 0.4, 0, 0.003, 0, aid);
  tagSpot(aid, 'ipe5');
  function reactIpe5() { const tl = gsap.timeline(); tl.to(kit.position, { y: 0.12, duration: 0.2, ease: 'power2.out' }).to(kit.position, { y: 0, duration: 0.5, ease: 'bounce.out' }).fromTo(crossM, { emissiveIntensity: 1.4 }, { emissiveIntensity: 0, duration: 1.4 }, 0); tl.to(chest.scale, { y: 0.82, duration: 0.14, yoyo: true, repeat: 9, ease: 'power1.inOut' }, 0.1); animTL(tl); }
  /* --- decoración: extintor, desfibrilador (DEA), plano de evacuación y cinta de balizamiento --- */
  const ext = new THREE.Group(); ext.position.set(-1.55, 0, 0.16); S.add(ext);
  const redM = std(0xd8231f, { roughness: 0.35 });
  cyl(0.1, 0.1, 0.55, redM, 0, 0.78, 0, ext); sph(0.1, redM, 0, 1.055, 0, ext).scale.y = 0.5; cyl(0.03, 0.04, 0.08, darkM(), 0, 1.12, 0, ext);
  box(0.14, 0.02, 0.03, darkM(), 0.04, 1.17, 0, ext); box(0.06, 0.1, 0.06, darkM(), 0, 0.92, -0.11, ext);
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.03, 1.12, 0.02), V(0.14, 1.05, 0.06), V(0.13, 0.7, 0.1), V(0.09, 0.55, 0.11)]), 20, 0.012, 6), darkM(), 0, 0, 0, ext);
  poster(ext, 0, 1.45, 0.24, 0.3, (g, w, h) => { g.fillStyle = '#d8231f'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(200, 140, 110, 280); g.beginPath(); g.arc(255, 140, 55, Math.PI, 0); g.fill(); g.fillRect(230, 60, 50, 40); g.fillRect(280, 70, 90, 18); g.font = '700 74px "Atkinson Hyperlegible"'; g.textAlign = 'center'; g.fillText('Extintor', w / 2, h - 50); }, -0.15);
  blob(0.4, 0.4, 0.4, 0, 0.003, 0.05, ext);
  tagSpot(ext, 'ipe4');
  function reactIpe4() { const tl = gsap.timeline(); tl.to(ext.rotation, { z: 0.12, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }).to(ext.rotation, { z: 0, duration: 0.2 }); animTL(tl); kick(1.2); }
  const dea = new THREE.Group(); dea.position.set(3.55, 1.4, 0.06); S.add(dea);
  rbox(0.42, 0.52, 0.12, 0.02, std(0x0f8a4c, { roughness: 0.4 }), 0, 0, 0, dea);
  poster(dea, 0, -0.02, 0.36, 0.44, (g, w, h) => { g.fillStyle = '#0f8a4c'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(256, 420); g.bezierCurveTo(90, 300, 100, 160, 190, 150); g.bezierCurveTo(230, 146, 250, 170, 256, 190); g.bezierCurveTo(262, 170, 282, 146, 322, 150); g.bezierCurveTo(412, 160, 422, 300, 256, 420); g.fill(); g.fillStyle = '#0f8a4c'; g.beginPath(); g.moveTo(270, 190); g.lineTo(210, 300); g.lineTo(256, 300); g.lineTo(236, 380); g.lineTo(306, 260); g.lineTo(262, 260); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.font = '700 96px "Atkinson Hyperlegible"'; g.textAlign = 'center'; g.fillText('DEA', 256, 560); }, 0.061);
  const deaLed = sph(0.016, basic(0x4dff9a), 0.15, 0.21, 0.066, dea), deaGlow = glowSprite(0x4dff9a, 0.18, 0.15, 0.21, 0.08, dea, 0.3);
  poster(S, -2.2, 1.62, 0.76, 0.54, (g, w, h) => {
    g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#0f8a4c'; g.fillRect(0, 0, w, 56); g.fillStyle = '#fff'; g.font = '700 32px "Atkinson Hyperlegible"'; g.fillText('Plano de evacuación', 18, 40);
    g.strokeStyle = '#221d2e'; g.lineWidth = 6; g.strokeRect(40, 90, 430, 240); [[180, 90, 180, 230], [320, 190, 320, 330], [40, 230, 120, 230], [240, 190, 470, 190]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
    g.strokeStyle = '#0f8a4c'; g.lineWidth = 8; g.setLineDash([16, 10]); g.beginPath(); g.moveTo(250, 280); g.lineTo(400, 280); g.lineTo(400, 340); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#0f8a4c'; g.beginPath(); g.moveTo(386, 336); g.lineTo(414, 336); g.lineTo(400, 356); g.fill();
    g.fillStyle = '#d8231f'; g.font = '700 26px "Atkinson Hyperlegible"'; g.fillText('Usted está aquí', 150, 268);
  }, 0.012);
  const here = sph(0.016, basic(0xff3b30), -2.2 + (250 / 512 - 0.5) * 0.76, 1.62 + (0.5 - 280 / 365) * 0.54, 0.02, S), hereGlow = glowSprite(0xff3b30, 0.12, here.position.x, here.position.y, 0.03, S, 0.5);
  const tapeT = canvasTex(256, 32, (g, w, h) => { g.fillStyle = '#f5c518'; g.fillRect(0, 0, w, h); g.fillStyle = '#18191c'; for (let x = -32; x < w; x += 40) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 20, h); g.lineTo(x + 20 + h, 0); g.lineTo(x + h, 0); g.fill(); } });
  tapeT.wrapS = THREE.RepeatWrapping; tapeT.repeat.set(4, 1);
  const postM = std(0xf5c518, { roughness: 0.5 });
  [3.85, 5.05].forEach(x => { cyl(0.13, 0.15, 0.04, darkM(), x, 0.02, 1.35, S); cyl(0.025, 0.025, 0.9, postM, x, 0.47, 1.35, S); box(0.054, 0.12, 0.054, std(0x18191c), x, 0.6, 1.35, S); });
  const tape = new THREE.Group(); tape.position.set(4.45, 0.86, 1.35); S.add(tape);
  const tapeM = plane(1.2, 0.07, std(0xffffff, { map: tapeT, roughness: 0.6, side: THREE.DoubleSide }), 0, 0, 0, tape);
  blob(1.6, 0.5, 0.3, 4.45, 0.003, 1.35, S);

  return {
    name: 'ipe', shell: sh, exposure: sh.exposure, scene: S, pick: [ext, son, aid], range: [-1.9, 2.8],
    idle(t) {
      if (!ambientOn()) return false;
      sweep.rotation.y = t * 1.6; beaGlow.material.opacity = 0.45 + Math.abs(Math.sin(t * 1.6)) * 0.3;
      const k = 0.5 + 0.5 * Math.sin(t * 1.4); deaLed.material.color.setRGB(0.1 + 0.2 * k, 0.4 + 0.6 * k, 0.3 + 0.3 * k); deaGlow.material.opacity = 0.12 + 0.3 * k;
      const h2 = 1 + 0.35 * Math.max(0, Math.sin(t * 2.2)); here.scale.setScalar(h2); hereGlow.material.opacity = 0.25 + 0.35 * (h2 - 1) / 0.35;
      tape.rotation.x = Math.sin(t * 1.3) * 0.18; tape.position.y = 0.86 + Math.sin(t * 0.9) * 0.008;
      return 'amb';
    },
    spots: [unitSpot('ipe4', -1.55, reactIpe4, { anchor: V(-1.55, 1.3, 0.2), label: 'Seguridad y ergonomía' }), unitSpot('ipe2', 0, reactIpe2, { anchor: V(-0.08, top + 0.52, 0.55), label: 'Riesgos ambientales' }), unitSpot('ipe5', 2.2, reactIpe5, { anchor: V(2.0, top + 0.38, 0.55), label: 'Primeros auxilios' })],
    cfg: { y: 1.55, z: 3.9, ly: 1.05, fov: 44, m: { y: 1.5, z: 3.7, ly: 1.1, fov: 50 } }
  };
}

async function buildIngRoom() {
  const sh = roomShell({ x0: -3, x1: 4, wall: 0x3a4f8f, band: 0xe8b23a, bandH: 0.08, floor: '#6b5a4a', bg: 0x080b16, sky: 0xfff0e0, fillC: 0xffa060, fillX: 0, poolX: 0, pool: 'rgba(255,190,120,.95)', amb: 'rgb(40,44,62)', exposure: 0.98, on: { hemi: 0.6, key: 1.2, fill: 3.4 } });
  const S = sh.scene, top = bench(S, -1.2, 1.4, { legs: true, topC: 0xc79a62, rough: 0.5, top: 0.78, z: 0.55 });
  // banderines
  const n = 16, flags = new THREE.InstancedMesh(new THREE.ConeGeometry(0.08, 0.16, 3), std(0xffffff, { roughness: 0.7 }), n), mm = new THREE.Matrix4(), fc = [0xff8a3d, 0xffd166, 0x3b82f6, 0xff6b5b, 0x2fc796];
  for (let i = 0; i < n; i++) { const x = -2.6 + i * 0.4, y = 2.95 - Math.sin(i / (n - 1) * Math.PI) * 0.25; mm.compose(V(x, y, 0.05), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI)), V(1, 1, 0.2)); flags.setMatrixAt(i, mm); flags.setColorAt(i, col(fc[i % 5])); }
  S.add(flags);
  /* guirnalda de bombillas que titilan una a una */
  const NBULB = 22, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 10, 8), basic(0xffffff), NBULB), bc0 = col(0xffc06a);
  for (let i = 0; i < NBULB; i++) { const x = -2.7 + i * (6.2 / (NBULB - 1)), y = 2.62 - Math.sin(i / (NBULB - 1) * Math.PI) * 0.32; mm.makeTranslation(x, y, 0.25); bulbs.setMatrixAt(i, mm); bulbs.setColorAt(i, bc0); }
  S.add(bulbs);
  const wire = new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => V(-2.75 + i * (6.3 / 11), 2.66 - Math.sin(i / 11 * Math.PI) * 0.32, 0.25)));
  mesh(new THREE.TubeGeometry(wire, 40, 0.004, 4), basic(0x1a1a1a), 0, 0, 0, S);
  for (let i = 0; i < 4; i++) glowSprite(0xffb050, 0.9, -2.2 + i * 1.6, 2.45 - Math.sin((i + 0.5) / 4 * Math.PI) * 0.2, 0.3, S, 0.22);
  poster(S, -1.6, 1.95, 1.0, 0.7, (g, w, h) => { g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, w, h); const words = [['Hello', '#ff8a3d', 70, 110], ['Hola', '#3b82f6', 300, 120], ['Bonjour', '#ff6b5b', 60, 250], ['Ciao', '#2fc796', 330, 270]]; g.font = '700 64px Caveat'; words.forEach(([t, c, x, y]) => { g.fillStyle = c; g.fillText(t, x, y); }); });
  poster(S, 1.5, 1.95, 1.6, 0.85, (g, w, h) => { g.fillStyle = '#f7f9f9'; g.fillRect(0, 0, w, h); g.strokeStyle = '#9aa3aa'; g.lineWidth = 10; g.strokeRect(0, 0, w, h); g.fillStyle = '#a3460a'; g.font = '700 40px Caveat'; g.fillText('Present Simple → I work', 24, 70); g.fillText('Present Continuous → I am working', 24, 130); g.fillStyle = '#1a53b3'; g.fillText('Present Perfect → I have worked', 24, 190); g.fillStyle = '#221d2e'; g.font = '700 30px Caveat'; g.fillText('Project 1: jueves 23:59 · Speaking: viernes', 24, 250); });
  const g1 = new THREE.Group(); g1.position.set(0, top, 0.55); S.add(g1);
  const hp = new THREE.Group(); hp.position.set(-0.28, 0.12, 0); g1.add(hp); hp.rotation.x = -0.3;
  mesh(new THREE.TorusGeometry(0.12, 0.014, 8, 32, Math.PI), std(0x2a2d33, { roughness: 0.4 }), 0, 0.02, 0, hp);
  [-0.12, 0.12].forEach(x => { const c = cyl(0.06, 0.06, 0.045, std(0xff8a3d, { roughness: 0.4 }), x, 0, 0, hp); c.rotation.z = Math.PI / 2; });
  const s = new THREE.Shape(); const w = 0.62, h = 0.38, r = 0.12;
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(-0.06, -h / 2); s.lineTo(-0.18, -h / 2 - 0.14); s.lineTo(-0.14, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.022, bevelSegments: 4, curveSegments: 16 }); geo.center();
  const bubble = new THREE.Group(); bubble.position.set(0.22, 0.62, 0); g1.add(bubble);
  mesh(geo, std(0xff8a3d, { roughness: 0.3, envMapIntensity: 0.8 }), 0, 0, 0, bubble);
  const ht = canvasTex(256, 128, (g, w2, h2) => { g.fillStyle = '#fffaf2'; g.font = '700 92px Caveat'; g.textAlign = 'center'; g.fillText('Hello', w2 / 2, 92); });
  plane(0.46, 0.23, basic(0xffffff, { map: ht, transparent: true }), 0, 0.01, 0.062, bubble);
  blob(0.9, 0.5, 0.4, 0, 0.003, 0, g1);
  tagSpot(g1, 'ing1');
  let pop = 0;
  function reactIng() { pop = 1.5; const tl = gsap.timeline(); tl.fromTo(bubble.scale, { x: 1.25, y: 1.25, z: 1.25 }, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'elastic.out(1,0.4)' }).fromTo(hp.position, { y: 0.12 }, { y: 0.2, duration: 0.2, yoyo: true, repeat: 1 }, 0); animTL(tl); }
  /* --- decoración: estantería con libros, mapamundi, tocadiscos con ondas y relojes de cuatro ciudades --- */
  const shelf = new THREE.Group(); shelf.position.set(-2.35, 0, 0.2); S.add(shelf);
  const woodM = std(0x7a4a2a, { roughness: 0.55 });
  [-0.46, 0.46].forEach(x => box(0.04, 1.9, 0.32, woodM, x, 0.95, 0, shelf)); [0.04, 0.5, 0.96, 1.42, 1.88].forEach(y => box(0.96, 0.03, 0.32, woodM, 0, y, 0, shelf));
  const bkC = [0xff8a3d, 0xe8b23a, 0x3b82f6, 0xff6b5b, 0x2fc796, 0xfbf7ee, 0x5a2ec0, 0x8a4b14], bks = [];
  [0.055, 0.515, 0.975, 1.435].forEach((y, r) => { let x = -0.42; while (x < 0.38) { const w = 0.035 + ((bks.length * 7) % 5) * 0.008, h = 0.26 + ((bks.length * 3) % 4) * 0.035; bks.push([x + w / 2, y + h / 2, w, h, r]); x += w + 0.004; if (r === 2 && x > 0.1 && x < 0.2) x += 0.12; } });
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.22), std(0xffffff, { roughness: 0.7 }), bks.length);
  bks.forEach((b, i) => { mm.compose(V(b[0], b[1], 0.02), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, b[4] === 2 && i % 9 === 0 ? 0.25 : 0)), V(b[2], b[3], 1)); books.setMatrixAt(i, mm); books.setColorAt(i, col(bkC[i % bkC.length])); }); shelf.add(books);
  blob(1.3, 0.7, 0.4, 0, 0.003, 0.1, shelf);
  poster(S, 2.8, 1.8, 1.3, 0.72, (g, w, h) => {
    g.fillStyle = '#26466e'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#e8d7ae'; [[[70, 60], [170, 50], [190, 120], [140, 160], [120, 140], [80, 110]], [[150, 170], [190, 180], [180, 250], [160, 280], [140, 220]], [[250, 60], [300, 50], [310, 90], [270, 100]], [[260, 110], [320, 110], [330, 170], [300, 230], [270, 200], [255, 150]], [[320, 50], [450, 50], [470, 110], [400, 140], [340, 110]], [[420, 200], [470, 200], [470, 240], [430, 240]]].forEach(pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); });
    g.strokeStyle = '#ff8a3d'; g.lineWidth = 3; g.setLineDash([8, 6]); [[[272, 84], [130, 96]], [[272, 84], [450, 225]]].forEach(([a, b]) => { g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 40, b[0], b[1]); g.stroke(); }); g.setLineDash([]);
    [[272, 84], [130, 96], [450, 225], [262, 70]].forEach(([x, y]) => { g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); });
    g.fillStyle = '#fff'; g.font = '700 26px Caveat'; g.fillText('Where are you from?', 20, h - 18);
  }, 0.012, -0.01);
  const rp = new THREE.Group(); rp.position.set(0.9, top, 0.42); rp.rotation.y = -0.25; S.add(rp);
  rbox(0.38, 0.08, 0.32, 0.015, std(0x7a4a2a, { roughness: 0.5 }), 0, 0.04, 0, rp);
  const disc = new THREE.Group(); disc.position.set(-0.04, 0.086, 0); rp.add(disc);
  cyl(0.125, 0.125, 0.008, std(0x121212, { roughness: 0.25, metalness: 0.2 }), 0, 0, 0, disc, 36); cyl(0.042, 0.042, 0.009, std(0xff8a3d, { roughness: 0.5 }), 0, 0.001, 0, disc, 24); box(0.05, 0.0095, 0.008, std(0xe8b23a), 0.07, 0.001, 0, disc);
  const tarm = cyl(0.005, 0.005, 0.2, metalM(), 0.12, 0.11, -0.03, rp); tarm.rotation.set(Math.PI / 2, 0, 0.5); cyl(0.018, 0.018, 0.03, darkM(), 0.15, 0.095, -0.1, rp);
  const waves = [0, 1, 2].map(i => { const r = mesh(new THREE.TorusGeometry(0.08, 0.004, 6, 32), basic(0xffb685, { transparent: true, opacity: 0, depthWrite: false }), -0.04, 0.24, 0.02, rp); return r; });
  const cities = [['Madrid', 0], ['Londres', -1], ['Nueva York', -6], ['Sídney', 10]].map(([n, o], i) => wallClock(S, -0.6 + i * 0.4, 2.02, 0.02, 0.12, n, o));
  let lastSec = -1;

  return {
    name: 'ing', shell: sh, exposure: sh.exposure, scene: S, pick: [g1], range: [-0.3, 0.3],
    spots: [unitSpot('ing1', 0, reactIng, { anchor: V(0.22, top + 0.84, 0.55), label: 'Units 1-2' })],
    cfg: { y: 1.55, z: 3.6, ly: 1.15, fov: 46, m: { y: 1.5, z: 3.4, ly: 1.2, fov: 52 } },
    idle(t, dt) {
      if (!ambientOn() && pop <= 0) return false;
      bubble.position.y = 0.62 + Math.sin(t * 1.4) * 0.03; bubble.rotation.z = Math.sin(t * 0.9) * 0.05; pop = Math.max(0, pop - dt);
      for (let i = 0; i < NBULB; i++) { const k = 0.55 + 0.45 * Math.max(0, Math.sin(t * 1.2 + i * 1.7)) + pop * 0.3; bulbs.setColorAt(i, bc0.clone().multiplyScalar(k)); } bulbs.instanceColor.needsUpdate = true;
      disc.rotation.y -= dt * 3.5;
      waves.forEach((w, i) => { const k = ((t * 0.5 + i / 3) % 1); w.scale.setScalar(1 + k * 2.2); w.material.opacity = 0.5 * Math.sin(k * Math.PI) * (1 - k * 0.4); });
      const sec = MC.now().getSeconds(); if (sec !== lastSec) { lastSec = sec; cities.forEach(c => c.set()); }
      return pop > 0 ? true : 'amb';
    }
  };
}

function prontoSpot(s, x, react, anchor) {
  const S = SUBJ[s];
  return { id: 'pronto-' + s, x, anchor, color: S.c, btn: s === 'digi' ? S.t : S.c, label: 'Pronto', kicker: S.name, title: 'Pronto', go: 'Ver la asignatura',
    sub: () => { const e = MC.pending().find(p => p.s === s); return 'Aún no hay unidades. ' + (e ? (e.titulo + ' · ' + MC.whenTxt(e).toLowerCase()) : 'Nada pendiente esta semana.'); },
    act: () => reactAndOpen(x, react, () => MC.showNb('pronto', s, 'sala')) };
}
async function buildDigiRoom() {
  const sh = roomShell({ x0: -3, x1: 3, wall: 0x2a3550, floor: '#252b36', bg: 0x04060a, sky: 0xbfd4ff, key: 0xcfe0ff, fillC: 0x7fb0ff, fillX: 0, poolX: 0, pool: 'rgba(110,165,255,.85)', amb: 'rgb(22,26,36)', exposure: 0.95, on: { hemi: 0.3, key: 0.6, fill: 3.8 } });
  const S = sh.scene, top = bench(S, -1.4, 1.4, { legs: true, topC: 0x2a2d33, top: 0.76, z: 0.55 });
  const scr = canvasTex(512, 320, (g, w, h) => {});
  function drawScr(p) { scr.userData.redraw((g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0d1a2e'); gr.addColorStop(1, '#1d3557'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(173,195,218,.18)'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.fillStyle = '#adc3da'; g.font = '600 92px Fraunces'; const t = 'Pronto'.slice(0, Math.ceil(6 * p)); g.fillText(t, 60, 190); if (p >= 1) g.fillRect(60 + g.measureText(t).width + 8, 120, 10, 80); }); }
  drawScr(1);
  const desk = new THREE.Group(); desk.position.set(0, top, 0.45); S.add(desk);
  const steel = std(0x5b7fa3, { roughness: 0.3, metalness: 0.8 });
  const screens = [];
  [[-0.72, 0.35], [0, 0], [0.72, -0.35]].forEach(([x, ry]) => { const m = new THREE.Group(); m.position.set(x, 0, 0); m.rotation.y = ry; desk.add(m); rbox(0.66, 0.42, 0.04, 0.015, steel, 0, 0.42, 0, m); const sm = basic(0xffffff, { map: scr }); plane(0.6, 0.36, sm, 0, 0.42, 0.021, m); screens.push(sm); box(0.05, 0.2, 0.04, steel, 0, 0.12, -0.03, m); box(0.22, 0.015, 0.14, steel, 0, 0.008, -0.02, m); });
  box(0.5, 0.015, 0.16, std(0x1c1f24), 0, 0.01, 0.28, desk);
  glowSprite(0x7fb0ff, 2.4, 0, 0.5, 0.2, desk, 0.25);
  /* torre con luces que parpadean */
  const tower = new THREE.Group(); tower.position.set(1.15, 0, -0.05); desk.add(tower);
  rbox(0.2, 0.42, 0.4, 0.01, std(0x15181d, { roughness: 0.4 }), 0, 0.21, 0, tower);
  const leds = [0, 1, 2].map(k => sph(0.008, basic(0x4dff9a), -0.06 + k * 0.03, 0.36, 0.205, tower));
  tagSpot(desk, 'pronto-digi');
  function react() { const o = { p: 0 }; const tl = gsap.timeline(); screens.forEach((m, i) => tl.fromTo(m.color, { r: 0.1, g: 0.1, b: 0.1 }, { r: 1, g: 1, b: 1, duration: 0.15, repeat: 2, yoyo: true }, i * 0.08)); tl.to(o, { p: 1, duration: 0.8, onUpdate: () => drawScr(o.p) }, 0.3); animTL(tl); }
  /* --- decoración: rack de servidores con LED, cable de datos con pulsos de luz y un brazo robótico --- */
  const mm = new THREE.Matrix4();
  const srv = new THREE.Group(); srv.position.set(-2.15, 0, 0.35); S.add(srv);
  rbox(0.62, 2.0, 0.6, 0.02, std(0x14171c, { roughness: 0.45, metalness: 0.4 }), 0, 1.0, 0, srv);
  for (let k = 0; k < 9; k++) box(0.54, 0.16, 0.012, std(0x1f242c, { roughness: 0.5, metalness: 0.5 }), 0, 0.3 + k * 0.19, 0.301, srv);
  const NL = 36, sl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.012, 0.006), basic(0xffffff), NL), slD = [];
  for (let i = 0; i < NL; i++) { const r = Math.floor(i / 4), c = i % 4; mm.makeTranslation(0.12 + c * 0.035, 0.3 + r * 0.19, 0.31); sl.setMatrixAt(i, mm); slD.push({ f: 0.4 + ((i * 37) % 11) / 8, p: (i * 1.7) % 6.28, c: i % 5 === 0 ? col(0x6ea6ff) : col(0x4dff9a) }); sl.setColorAt(i, slD[i].c); }
  srv.add(sl); glowSprite(0x4dff9a, 1.0, 0.15, 1.1, 0.4, srv, 0.08); blob(0.9, 0.9, 0.5, 0, 0.003, 0, srv);
  const cpath = new THREE.CatmullRomCurve3([V(-2.0, 2.0, 0.4), V(-1.9, 2.8, 0.25), V(-0.6, 3.05, 0.12), V(1.0, 2.9, 0.1), V(1.4, 2.0, 0.1), V(1.3, 1.25, 0.25)]);
  mesh(new THREE.TubeGeometry(cpath, 90, 0.012, 6), std(0x0d0f13, { roughness: 0.5 }), 0, 0, 0, S);
  const pulseT = canvasTex(128, 8, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(110,166,255,0)'); gr.addColorStop(0.8, 'rgba(160,200,255,.9)'); gr.addColorStop(0.86, 'rgba(255,255,255,1)'); gr.addColorStop(0.9, 'rgba(110,166,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  pulseT.wrapS = THREE.RepeatWrapping; pulseT.repeat.set(5, 1);
  mesh(new THREE.TubeGeometry(cpath, 90, 0.017, 6), basic(0xffffff, { map: pulseT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0, 0, S);
  const arm = new THREE.Group(); arm.position.set(-1.12, top, 0.78); S.add(arm);
  const orange = std(0xff8a3d, { roughness: 0.4 });
  cyl(0.08, 0.09, 0.05, darkM(), 0, 0.025, 0, arm, 24);
  const j1 = new THREE.Group(); j1.position.y = 0.05; arm.add(j1); cyl(0.05, 0.05, 0.05, orange, 0, 0.025, 0, j1);
  const j2 = new THREE.Group(); j2.position.y = 0.06; j1.add(j2); sph(0.035, orange, 0, 0, 0, j2); rbox(0.04, 0.2, 0.04, 0.01, steel, 0, 0.1, 0, j2);
  const j3 = new THREE.Group(); j3.position.y = 0.2; j2.add(j3); sph(0.03, orange, 0, 0, 0, j3); rbox(0.035, 0.16, 0.035, 0.01, steel, 0, 0.08, 0, j3);
  const grip = new THREE.Group(); grip.position.y = 0.17; j3.add(grip); [-1, 1].forEach(sg => box(0.008, 0.05, 0.02, darkM(), sg * 0.015, 0.02, 0, grip));
  blob(0.4, 0.4, 0.45, 0, 0.003, 0, arm);

  return { name: 'digi', shell: sh, exposure: sh.exposure, idle(t) {
      if (!ambientOn()) return false;
      screens.forEach((m, i) => { const f = 0.92 + Math.sin(t * 1.3 + i * 2) * 0.04; m.color.setRGB(f, f, f); });
      leds.forEach((l, k) => l.material.color.setRGB(0.2, 0.6 + 0.4 * Math.sin(t * (1.2 + k * 0.7)), 0.5));
      slD.forEach((d, i) => sl.setColorAt(i, d.c.clone().multiplyScalar(0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * d.f + d.p))))); sl.instanceColor.needsUpdate = true;
      pulseT.offset.x = -(t * 0.35) % 1;
      j1.rotation.y = Math.sin(t * 0.4) * 0.9; j2.rotation.z = 0.35 + Math.sin(t * 0.55) * 0.25; j3.rotation.z = 0.9 + Math.sin(t * 0.55 + 1) * 0.35; grip.rotation.y = t * 0.6;
      return 'amb';
    }, scene: S, pick: [desk], range: [-0.2, 0.2], spots: [prontoSpot('digi', 0, react, V(0, top + 0.66, 0.45))], cfg: { y: 1.45, z: 3.6, ly: 1.1, fov: 46, m: { y: 1.45, z: 3.5, ly: 1.12, fov: 54 } } };
}
async function buildSostRoom() {
  const CH = cieloHex();   // el invernadero, con el cielo de ahora
  const glassWall = canvasTex(512, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, CH.zen); gr.addColorStop(0.7, CH.mid); gr.addColorStop(1, CH.low); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(40,70,40,.8)'; for (let x = 0; x < w; x += 12) { const hh = 30 + Math.sin(x * 0.05) * 14 + Math.random() * 20; g.fillRect(x, h - hh, 12, hh); } g.strokeStyle = 'rgba(240,248,240,.85)'; g.lineWidth = 6; for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } });
  glassWall.wrapS = THREE.RepeatWrapping; glassWall.repeat.set(2, 1);
  const sh = roomShell({ x0: -3, x1: 3, wallTex: glassWall, floor: '#7a6a52', bg: 0x0d140e, sky: 0xeaffd6, key: 0xffd9a0, fillC: 0xffc070, fillX: 0, poolX: 0.6, pool: 'rgba(255,200,120,.95)', amb: 'rgb(60,66,50)', exposure: 1.04, on: { hemi: 0.8, key: 1.5, fill: 2.4 } });
  const S = sh.scene, top = bench(S, -1.5, 1.5, { legs: true, topC: 0x9a6a40, rough: 0.6, top: 0.7, z: 0.55 });
  const plants = [[-1.1, 0.8], [-0.45, 1.0], [0.3, 0.9], [1.0, 1.1]].map(([x, s]) => buildPlant(S, x, top, 0.55, s * 0.55));
  const can = new THREE.Group(); can.position.set(0.68, top, 0.85); S.add(can);
  cyl(0.07, 0.08, 0.16, std(0x5fb83a, { roughness: 0.4, metalness: 0.3 }), 0, 0.08, 0, can); const sp = cyl(0.01, 0.018, 0.2, std(0x5fb83a, { metalness: 0.3 }), 0.12, 0.14, 0, can); sp.rotation.z = -0.9;
  mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 16, Math.PI), std(0x5fb83a), -0.03, 0.17, 0, can).rotation.z = 0.5;
  const sg = new THREE.Group(); plants.forEach(p => sg.add(p)); S.add(sg); tagSpot(sg, 'pronto-sost'); tagSpot(can, 'pronto-sost');
  let rustle = 0;
  const goldDust = motes(S, MOBILE ? 80 : 160, [-2.2, 2.2, 0.6, 2.8, 0.2, 2.2], 0xffd08a, 34);
  /* --- decoración: aspersores con gotas, mariposa, panel solar y compostador --- */
  const mm = new THREE.Matrix4(), q0 = new THREE.Quaternion();
  const pipe = cyl(0.018, 0.018, 3.4, metalM(), 0, 2.62, 0.7, S); pipe.rotation.z = Math.PI / 2;
  const NOZ = [-1.05, 0, 1.05]; NOZ.forEach(x => { cyl(0.012, 0.025, 0.06, std(0x2a2d33), x, 2.58, 0.7, S); cyl(0.004, 0.004, 0.66, metalM(), x, 2.95, 0.7, S); });
  const ND = MOBILE ? 36 : 60, drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.008, 6, 4), basic(0xcfeaff, { transparent: true, opacity: 0.75 }), ND);
  const dD = Array.from({ length: ND }, (_, i) => ({ n: i % 3, a: Math.random() * 6.28, r: 0.15 + Math.random() * 0.45, p: Math.random() }));
  S.add(drops); drops.frustumCulled = false;
  let sprayK = 0;
  function drawDrops(t) { dD.forEach((d, i) => { const k = (t * 0.7 + d.p) % 1, y = 2.55 - k * k * (2.55 - top - 0.05) * 1.0; const s = sprayK; mm.compose(V(NOZ[d.n] + Math.cos(d.a) * d.r * k, y, 0.7 + Math.sin(d.a) * d.r * k * 0.6), q0, V(s, s * 2.6, s)); drops.setMatrixAt(i, mm); }); drops.instanceMatrix.needsUpdate = true; }
  drawDrops(0);
  const wingT = canvasTex(128, 128, (g) => { g.fillStyle = '#ff8a3d'; g.beginPath(); g.moveTo(4, 64); g.bezierCurveTo(30, 0, 120, 4, 124, 44); g.bezierCurveTo(126, 70, 90, 72, 70, 66); g.bezierCurveTo(110, 80, 110, 124, 70, 122); g.bezierCurveTo(40, 120, 20, 90, 4, 64); g.fill(); g.strokeStyle = '#1a120c'; g.lineWidth = 5; g.stroke(); g.lineWidth = 2.5; [[30, 50, 110, 30], [30, 60, 112, 56], [30, 70, 90, 110]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }); g.fillStyle = '#fff'; [[112, 40], [116, 52], [96, 112]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }); });
  const bfly = new THREE.Group(); S.add(bfly);
  const wingM = basic(0xffffff, { map: wingT, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide });
  const wl = new THREE.Group(), wr = new THREE.Group(); bfly.add(wl, wr);
  plane(0.09, 0.09, wingM, 0.045, 0, 0, wl).rotation.x = -Math.PI / 2; const rwm = plane(0.09, 0.09, wingM, -0.045, 0, 0, wr); rwm.rotation.x = -Math.PI / 2; rwm.scale.x = -1;
  cyl(0.004, 0.004, 0.06, std(0x1a120c), 0, 0, 0, bfly).rotation.x = Math.PI / 2;
  const sol = new THREE.Group(); sol.position.set(2.2, 0, 0.6); S.add(sol);
  cyl(0.025, 0.025, 1.0, metalM(), 0, 0.5, 0, sol); cyl(0.14, 0.16, 0.03, darkM(), 0, 0.015, 0, sol);
  const solT = canvasTex(256, 192, (g, w, h) => { g.fillStyle = '#c9ced4'; g.fillRect(0, 0, w, h); for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) { const gr = g.createLinearGradient(0, y * 32, 0, y * 32 + 30); gr.addColorStop(0, '#2a4d8a'); gr.addColorStop(1, '#17305e'); g.fillStyle = gr; g.fillRect(x * 32 + 2, y * 32 + 2, 28, 28); } g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.5, 0); g.lineTo(w * 0.7, 0); g.lineTo(w * 0.2, h); g.fill(); });
  const panel = box(0.9, 0.03, 0.64, std(0xffffff, { map: solT, roughness: 0.25, metalness: 0.3 }), 0, 1.05, 0, sol); panel.rotation.x = 0.75;
  blob(0.8, 0.8, 0.4, 0, 0.003, 0, sol);
  const comp = new THREE.Group(); comp.position.set(-2.2, 0, 0.6); S.add(comp);
  cyl(0.32, 0.3, 0.8, std(0x3d5a34, { roughness: 0.7 }), 0, 0.4, 0, comp, 24); cyl(0.34, 0.34, 0.06, std(0x2a3d24, { roughness: 0.6 }), 0, 0.83, 0, comp, 24);
  for (let k = 0; k < 3; k++) box(0.5, 0.012, 0.01, std(0x23331e), 0, 0.25 + k * 0.18, 0.31, comp);
  poster(comp, 0, 0.6, 0.3, 0.12, (g, w, h) => { g.fillStyle = '#e8d7ae'; g.fillRect(0, 0, w, h); g.fillStyle = '#336f1a'; g.font = '700 120px Caveat'; g.textAlign = 'center'; g.fillText('Compost', w / 2, h * 0.8); }, 0.322);
  blob(0.9, 0.9, 0.45, 0, 0.003, 0, comp);

  return {
    name: 'sost', shell: sh, scene: S, pick: [sg, can], range: [-0.2, 0.2], spots: [prontoSpot('sost', 0, () => { rustle = 1; kick(2); }, V(0.3, top + 0.62, 0.55))],
    cfg: { y: 1.4, z: 3.6, ly: 1.0, fov: 46, m: { y: 1.4, z: 3.4, ly: 1.05, fov: 54 } },
    exposure: sh.exposure,
    idle(t, dt) {
      if (!ambientOn() && rustle <= 0) return false;
      goldDust.uniforms.uTime.value = t; rustle = Math.max(0, rustle - dt * 0.6); plants.forEach((p, k) => p.userData.leaves.forEach((l, i) => { l.rotation.z = Math.sin(t * (1.2 + rustle * 9) + i + k) * (0.03 + rustle * 0.18); }));
      /* el riego va por tandas: unos segundos sí y otros no */
      const on = (t % 14) < 6 || rustle > 0; sprayK += ((on ? 1 : 0) - sprayK) * Math.min(1, dt * 2); drawDrops(t);
      bfly.position.set(Math.sin(t * 0.31) * 1.4, 1.35 + Math.sin(t * 0.53) * 0.3, 1.0 + Math.cos(t * 0.27) * 0.45); bfly.rotation.y = Math.atan2(Math.cos(t * 0.31) * 0.43, -Math.sin(t * 0.27) * 0.12) ;
      const f = 0.25 + 1.0 * Math.abs(Math.sin(t * 7)); wl.rotation.z = f; wr.rotation.z = -f;
      return rustle > 0 ? true : 'amb';
    }
  };
}
const ROOM_BUILD = { bio: buildBioRoom, lab: buildLabRoom, fisio: buildFisioRoom, gest: buildGestRoom, ipe: buildIpeRoom, ing: buildIngRoom, digi: buildDigiRoom, sost: buildSostRoom };
const DOW_ES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'], MON_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

/* =========================================================
   Viaje al cariotipo (Bio 2): 46 cromosomas se ordenan
   ========================================================= */
let K = null; // se construye al llegar y se libera al salir del laboratorio
function buildKaryo() {
  const kScene = new THREE.Scene();
  kScene.background = col(0x120a24); kScene.fog = new THREE.Fog(0x120a24, 8, 20); kScene.environment = envTex;
  kScene.add(new THREE.HemisphereLight(0xdcd0ff, 0x1a0f33, 1.0));
  const k1 = new THREE.DirectionalLight(0xfff1e0, 2.2); k1.position.set(2, 3, 5); kScene.add(k1);
  const k2 = new THREE.DirectionalLight(0xa07bff, 2.6); k2.position.set(-3, 1, -4); kScene.add(k2);
  const kCam = new THREE.PerspectiveCamera(30, W / H, 0.1, 60);
  const MB = [249, 242, 198, 190, 181, 171, 159, 145, 138, 134, 135, 133, 114, 107, 102, 90, 83, 80, 59, 64, 47, 51, 156];
  const PARM = [.49, .39, .47, .29, .27, .39, .39, .34, .35, .32, .41, .30, .17, .17, .19, .44, .34, .31, .47, .45, .27, .29, .39];
  function bandTex(seed) {
    return canvasTex(16, 256, (x) => { x.fillStyle = '#efe9ff'; x.fillRect(0, 0, 16, 256); let s = seed * 9301 + 49297; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280; let y = 4; while (y < 252) { const h = 2 + rnd() * 7; if (rnd() > 0.4) { x.fillStyle = `hsl(258 ${40 + rnd() * 20}% ${22 + rnd() * 18}%)`; x.fillRect(0, y, 16, h); } y += h + 2 + rnd() * 6; } });
  }
  const chromos = [], labels = [], kGroup = new THREE.Group(); kScene.add(kGroup);
  MB.forEach((mb, i) => {
    const L = 0.22 + mb / 249 * 0.95, r = 0.062;
    const geo = new THREE.CapsuleGeometry(r, L - 2 * r, 6, MOBILE ? 10 : 16); geo.translate(0, -(L / 2 - PARM[i] * L), 0);
    const mat = std(0xffffff, { map: bandTex(i + 1), roughness: 0.45, envMapIntensity: 0.7 });
    for (let h = 0; h < 2; h++) { const c = new THREE.Group(); [-1, 1].forEach(sg => { const m = new THREE.Mesh(geo, mat); m.rotation.z = sg * 0.07; m.position.x = sg * 0.028; c.add(m); }); c.userData = { i, h }; kGroup.add(c); chromos.push(c); }
    const lt = canvasTex(64, 32, (x) => { x.fillStyle = '#d9ccff'; x.font = '700 22px "Atkinson Hyperlegible"'; x.textAlign = 'center'; x.fillText(i === 22 ? 'X' : String(i + 1), 32, 24); });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, opacity: 0, depthWrite: false })); sp.scale.set(MOBILE ? 0.42 : 0.24, MOBILE ? 0.21 : 0.12, 1); kGroup.add(sp); labels.push(sp);
  });
  const nucleus = sph(1.25, std(0x8a6cff, { roughness: 0.15, transparent: true, opacity: 0.18, side: THREE.BackSide, emissive: 0x4a2fa8, emissiveIntensity: 0.3, depthWrite: false }), 0, 0, 0, kScene, 40, 28);
  const n = MOBILE ? 140 : 260, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 14; pos[i * 3 + 1] = (Math.random() - .5) * 10; pos[i * 3 + 2] = -4 + Math.random() * 5; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xc8b6ff, size: 0.025, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); kScene.add(dust);
  let layout = null;
  function region() { return W >= 760 ? { x: Math.min(600, W * 0.44), y: 0, w: W - Math.min(600, W * 0.44), h: H } : { x: 0, y: 64, w: W, h: H * 0.5 }; }
  function fit() {
    const wide = W >= 760;
    const rows = wide ? [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9, 10, 11], [12, 13, 14, 15, 16, 17], [18, 19, 20, 21, 22]] : [[0, 1, 2, 3], [4, 5, 6, 7, 22], [8, 9, 10, 11, 12], [13, 14, 15, 16, 17], [18, 19, 20, 21]];
    const SW = 0.56, P = {}; let y = 0, maxW = 0;
    rows.forEach(r => { const Ls = r.map(i => 0.22 + MB[i] / 249 * 0.95); const up = Math.max(...r.map((i, k) => PARM[i] * Ls[k])), dn = Math.max(...r.map((i, k) => (1 - PARM[i]) * Ls[k])); const cy = y - up, w = r.length * SW; maxW = Math.max(maxW, w); r.forEach((i, k) => { P[i] = { x: -w / 2 + SW / 2 + k * SW, y: cy, lab: cy - (1 - PARM[i]) * Ls[k] - 0.13 }; }); y = cy - dn - 0.3; });
    const hT = -y; Object.values(P).forEach(p => { p.y += hT / 2; p.lab += hT / 2; }); layout = { pos: P, w: maxW, h: hT };
    const r = region(), tan = Math.tan(THREE.MathUtils.degToRad(kCam.fov / 2));
    const d = Math.max((layout.h * 1.12 * H) / (r.h * 2 * tan), (layout.w * 1.12 * W) / (r.w * 2 * tan * (W / H)));
    kCam.position.set(0, 0, d); kCam.lookAt(0, 0, 0); kScene.fog.near = d + 2; kScene.fog.far = d + 14;
    kCam.aspect = W / H; kCam.setViewOffset(W, H, -((r.x + r.w / 2) - W / 2), -((r.y + r.h / 2) - H / 2), W, H); kCam.updateProjectionMatrix();
  }
  function scatter() { chromos.forEach(c => { const u = Math.random() * 6.28, v = Math.acos(2 * Math.random() - 1), r = Math.cbrt(Math.random()) * 0.85; c.position.set(Math.sin(v) * Math.cos(u) * r, Math.cos(v) * r, Math.sin(v) * Math.sin(u) * r); c.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); c.scale.setScalar(0.55); }); labels.forEach(l => l.material.opacity = 0); nucleus.scale.setScalar(1); nucleus.material.opacity = 0.18; }
  function place() {
    const tl = gsap.timeline(); const order = [...chromos].sort((a, b) => a.userData.i - b.userData.i);
    order.forEach((c, n2) => { const p = layout.pos[c.userData.i], x = p.x + (c.userData.h ? 0.13 : -0.13), d = 0.6 + n2 * 0.026; tl.to(c.position, { x, y: p.y, z: 0, duration: 1.4, ease: 'expo.inOut' }, d).to(c.rotation, { x: 0, y: 0, z: 0, duration: 1.4, ease: 'expo.inOut' }, d).to(c.scale, { x: 1, y: 1, z: 1, duration: 1.4, ease: 'expo.inOut' }, d); });
    labels.forEach((l, i) => { const p = layout.pos[i]; l.position.set(p.x, p.lab, 0); tl.to(l.material, { opacity: 1, duration: 0.6 }, 2.4 + i * 0.02); });
    tl.to(nucleus.scale, { x: 4, y: 4, z: 4, duration: 1.6, ease: 'power2.out' }, 0.4).to(nucleus.material, { opacity: 0, duration: 1.2 }, 0.6);
    return animTL(tl);
  }
  let settle = 0;
  const sp = {
    name: 'karyo', exposure: 0.92, scene: kScene, camera: kCam, spots: [], pick: [],
    idle(t, dt) { kGroup.rotation.y = Math.sin(t * 0.25) * 0.08 + (MOBILE ? 0 : rig.px * 0.6); kGroup.rotation.x = MOBILE ? 0 : rig.py * 0.5; dust.rotation.y += dt * 0.02; settle -= dt; return settle > 0; },
    onResize: fit
  };
  return { sp, fit, scatter, place, kScene, arrive() { settle = 5; } };
}
const wipe = $('#wipe'), wr = { r: 0 };
function wipeR(to, dur, ease) { return gsap.fromTo(wr, { r: 0 }, { r: to, duration: dur, ease, onUpdate: () => wipe.style.setProperty('--r', wr.r + '%') }); }
function resetWipe() { wr.r = 0; wipe.style.setProperty('--r', '0%'); gsap.set(wipe, { opacity: 1 }); }
let labSpace = null;
function goCyto() {
  if (!space || space.name !== 'bio') return false;
  return NAV.forward('cyto', async () => {
    NAV.push('cyto');
    labSpace = space; const hp = new THREE.Vector3(); space.helix.getWorldPosition(hp);
    rig.lock = true;
    const tl = gsap.timeline();
    tl.to(space.state, { spin: 9, duration: 1.6, ease: 'power2.in' }, 0)
      .to(rig, { x: hp.x, tx: hp.x, y: hp.y + 0.15, ly: hp.y, lz: hp.z, z: hp.z + 1.2, px: 0, py: 0, duration: 1.25, ease: 'power3.inOut' }, 0)
      .to(rig, { z: hp.z + 0.12, fov: 75, off: 0, duration: 0.8, ease: 'power4.in' }, 1.15)
      .add(() => { const p = hp.clone().project(cam); wipe.style.setProperty('--x', ((p.x + 1) / 2 * 100) + '%'); wipe.style.setProperty('--y', ((1 - p.y) / 2 * 100) + '%'); }, 1.3)
      .add(wipeR(150, 0.7, 'power3.in'), 1.3);
    animTL(tl); await tl;
    if (!K) K = buildKaryo();
    space = K.sp; K.fit(); K.scatter(); K.arrive(); hot.innerHTML = ''; hsEls = [];
    const cy = $('#cyto'); cy.hidden = false;
    if (!NAV.cancelled()) gsap.fromTo('#cyto .panel > *', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.07, delay: 1.5, ease: 'power3.out' });
    K.place(); render();
    gsap.to(wipe, { opacity: 0, duration: 0.9, ease: 'power2.out', onComplete: resetWipe });
    $('#cytoT').focus({ preventScroll: true });
  });
}
async function cytoBack(instant) {
  if (!labSpace) return;
  const done = () => {
    $('#cyto').hidden = true; space = labSpace; labSpace = null;
    space.state.spin = 0.4; applyCfg(space.cfg); rig.lz = 0; buildHotspots(); applyView();
    setIndex(1, true); rig.lock = false; kick(0.3);
  };
  if (instant) { gsap.killTweensOf('#cyto .panel > *'); done(); return; }
  wipe.style.setProperty('--x', '50%'); wipe.style.setProperty('--y', '50%');
  const tl = gsap.timeline(); tl.to('#cyto .panel', { opacity: 0, duration: 0.25 }, 0).add(wipeR(150, 0.6, 'power3.in'), 0.1);
  await tl; gsap.set('#cyto .panel', { opacity: 1 });
  done();
  gsap.to(wipe, { opacity: 0, duration: 0.7, onComplete: resetWipe });
}
$('#cytoPage').addEventListener('click', () => MC.openNb('unit', 'bio2', 'cyto'));
$('#cytoBack').addEventListener('click', () => MC.back());

/* =========================================================
   Entrar y salir de las salas
   ========================================================= */
const veil = $('#veil'), iris = { h: -20 };
function tintVeil(id) { const S = SUBJ[ROOMS[id].subs[0]]; veil.style.background = '#' + mix(S.c, 0x07080b, 0.8).getHexString(); }
function irisOpen(dur) { iris.h = -20; veil.style.setProperty('--h', '-20%'); return gsap.to(iris, { h: 130, duration: dur, ease: 'power2.in', onUpdate: () => veil.style.setProperty('--h', iris.h + '%'), onComplete: () => { gsap.set(veil, { opacity: 0 }); veil.style.setProperty('--h', '-20%'); } }); }
function enterRoom(id) {
  return NAV.forward('entering', async () => {
    NAV.room = id; NAV.push('room');           // la sala es «la actual» desde el primer instante
    const d = hall.doors[id];
    rig.lock = true; tintVeil(id);
    /* el picaporte baja, la puerta se abre, la luz de la sala se derrama y la cámara la atraviesa */
    const tl = gsap.timeline();
    tl.to(rig, { x: d.x, tx: d.x, px: 0, py: 0, off: 0, duration: 0.6, ease: 'power2.inOut' }, 0)
      .to(d.handle.rotation, { z: -0.55, duration: 0.16, ease: 'power2.in', yoyo: true, repeat: 1 }, 0.12)
      .to(d.pivot.rotation, { y: 1.75, duration: 0.85, ease: 'power2.inOut' }, 0.3)
      .to(d.pool.material, { opacity: 0.85, duration: 0.6 }, 0.4)
      .fromTo(d.pool.scale, { x: 0.6, y: 0.3 }, { x: 1.3, y: 2.6, duration: 1.0, ease: 'power2.out' }, 0.4)
      .to(d.under.material, { opacity: 1, duration: 0.3 }, 0.3)
      .to(rig, { z: 1.0, y: 1.45, ly: 1.4, fov: 66, duration: 0.9, ease: 'power2.in' }, 0.6)
      .to(rig, { fov: 80, duration: 0.3, ease: 'power3.in' }, 1.25)
      .to(veil, { opacity: 1, duration: 0.3, ease: 'power1.in' }, 1.25);
    animTL(tl);
    const built = ROOM_BUILD[id]();          // se construye mientras se abre la puerta
    await tl; const room = await built;
    space = room; applyCfg(room.cfg); buildHotspots(); applyView();
    const c = cfgFor(room.cfg), s0 = room.spots[0];
    setIndex(0, true);
    if (NAV.cancelled()) { rig.x = rig.tx = s0.x; render(); lightsOn(room.shell, true); gsap.set(veil, { opacity: 0 }); return; }
    rig.x = rig.tx = s0.x - 0.9; rig.y = c.y + 0.25; rig.z = c.z + 2.4; rig.ly = c.ly; rig.fov = c.fov + 10; render();
    const tl2 = gsap.timeline();
    tl2.add(irisOpen(0.75), 0.05).to(rig, { x: s0.x, y: c.y, z: c.z, fov: c.fov, duration: 1.3, ease: 'power3.out' }, 0);
    lightsOn(room.shell);
    animTL(tl2); await tl2;
    rig.tx = rig.x; rig.lock = false;
  });
}
async function leaveRoom(instant, id) {
  if (labSpace) await cytoBack(true);
  if (!id || space === hall) return;
  tintVeil(id);
  if (!instant) await gsap.to(veil, { opacity: 1, duration: 0.3 });
  else gsap.set(veil, { opacity: 1 });
  const old = space; space = hall;
  disposeTree(old.scene); if (K) { disposeTree(K.kScene); K = null; }
  renderer.renderLists.dispose();
  camBack = null;
  applyCfg(hall.cfg); buildHotspots(); applyView();
  const d = hall.doors[id], i = hall.spots.findIndex(s => s.id === id);
  setIndex(i, true);
  const c = cfgFor(hall.cfg);
  rig.lock = true; rig.x = rig.tx = d.x; rig.z = 1.4; rig.y = 1.45; rig.ly = 1.35; rig.fov = 60; rig.off = 0; render();
  const tl = gsap.timeline();
  tl.to(veil, { opacity: 0, duration: 0.4 }, 0).to(rig, { z: c.z, y: c.y, ly: c.ly, fov: c.fov, off: c.off || 0, duration: 1.0, ease: 'power3.out' }, 0)
    .to(d.pivot.rotation, { y: hall.doorRest(id), duration: 0.7, ease: 'power2.inOut' }, 0.45).to(d.pool.material, { opacity: 0, duration: 0.5 }, 0.5)
    .to(d.pool.scale, { x: 1, y: 1, duration: 0.6 }, 0.5).to(d.under.material, { opacity: 0.4, duration: 0.6 }, 0.6);
  animTL(tl);
  if (instant) tl.progress(1); else await tl;
  rig.lock = false;
}

/* =========================================================
   Arranque: se encienden las luces del pasillo
   ========================================================= */
const hall = await buildHall();
if (MC.flat) { renderer.dispose(); return; }
/* los shaders se compilan sin bloquear (si el navegador lo permite) antes de la primera imagen */
try { await ceder(); await renderer.compileAsync(hall.scene, cam); } catch (e) { }
if (MC.flat) { renderer.dispose(); return; }
/* se entra delante de la sala del examen más cercano (lo que toca preparar); si no hay, mirando a la ventana */
const salaInicio = (() => { const ex = MC.nextExam(); if (!ex) return null; for (const id in ROOMS) if (ROOMS[id].subs.indexOf(ex.s) >= 0 && hall.doors[id]) return id; return null; })();
const iInicio = salaInicio ? hall.spots.findIndex(s => s.id === salaInicio) : -1;
setSpace(hall, iInicio >= 0 ? iInicio : Math.max(0, hall.spots.findIndex(s => s.id === 'ventana')));
gsap.set(['#dock', '#hot'], { autoAlpha: 0 }); uiOn = false;
const L = hall.lights;
const ON = { hemi: 0.3, fluo: 0.7 };
L.baked.forEach(m => { m.userData.lmi = m.lightMapIntensity; m.lightMapIntensity = m.userData.lmi * 0.07; });
function tubes(v) { L.tubes.forEach(m => m.color.setRGB(v, v * 0.97, v * 0.9)); }
tubes(0.03);
const start0 = cfgFor(hall.cfg);
rig.z = start0.z + 1.6; rig.y = start0.y + 0.3; rig.x = rig.tx - 1.0;
render();
window.__3dReady = true; html.classList.add('ready');

MC.three = {
  freeze, ui, enterRoom, leaveRoom, cytoBack, nbClosed, goCyto, kick,
  skipIntro: () => skipIntro(),
  get space() { return space && space.name; }, get busy() { return isBusy(); },
  goSpot(id) { const i = space.spots.findIndex(s => s.id === id); if (i >= 0) setIndex(i, true); },
  get frames() { return frames; }, get dpr() { return dpr; },
  /* para pruebas: asomarse a una ventana (x: -4.4 la del este, 10.8 la del sur, 21.4 la del oeste) */
  asomarse(on, x) { const i = hall.spots.findIndex(s => s.id === 'ventana'); if (space === hall && i >= 0) { setIndex(i, true); if (x != null) rig.x = rig.tx = x; hall.asomarse(on); } },
  /* para pruebas: cuánto está abierta cada puerta del pasillo (radianes) */
  get puertas() { const o = {}; for (const k in hall.doors) o[k] = +hall.doors[k].pivot.rotation.y.toFixed(2); return o; }
};

const intro = $('#intro'), skip = $('#skip');
const hh = MC.now();
$('#introT').innerHTML = (d => DOW_ES[d.getDay()] + ' ' + d.getDate() + ' de ' + MON_ES[d.getMonth()])(MC.now()) + ' · ' + String(hh.getHours()).padStart(2, '0') + ':' + String(hh.getMinutes()).padStart(2, '0') + '<br><b>Se encienden las luces del pasillo.</b>';
intro.hidden = false; skip.hidden = false; NAV.intro(true);
const itl = gsap.timeline({ onComplete: endIntro });
L.tubes.forEach((m, i) => {
  const d = 0.55 + i * 0.09 + Math.random() * 0.05;
  itl.add(() => m.color.setRGB(0.8, 0.78, 0.72), d).add(() => m.color.setRGB(0.04, 0.04, 0.04), d + 0.06).add(() => m.color.setRGB(1, 0.97, 0.9), d + 0.22);
});
itl.to('#introT', { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.05)
  .to(L.hemi, { intensity: ON.hemi, duration: 0.9 }, 0.9).to(L.fluo, { intensity: ON.fluo, duration: 0.9 }, 0.95)
  .to(rig, { z: start0.z, y: start0.y, x: rig.tx, duration: 2.0, ease: 'power3.out' }, 0.2)
  .to(L.baked.map(m => m), { lightMapIntensity: (i, m) => m.userData.lmi, duration: 1.1, ease: 'power2.out', stagger: 0.08 }, 0.7)
  .to(L.beamMat.uniforms.uOp, { value: L.beamOp(), duration: 1.4, ease: 'power2.inOut' }, 1.3)
  .to('#introT', { opacity: 0, y: -10, duration: 0.45 }, 1.75);
rig.lock = true; animTL(itl);
function endIntro() {
  if (intro.hidden) return;
  intro.hidden = true; skip.hidden = true; rig.lock = false; rig.x = rig.tx; L.endIntro();
  poke(); NAV.intro(false);
}
function skipIntro() { itl.progress(1); }
intro.addEventListener('click', skipIntro); skip.addEventListener('click', skipIntro);
(function () {
  let v = null; try { v = JSON.parse(sessionStorage.getItem('centro:volver')); } catch (e) {}
  if (!v) return;
  try { sessionStorage.removeItem('centro:volver'); } catch (e) {}
  if (Date.now() - (v.t || 0) > 6 * 3600 * 1000) return;        // de otra sesión de estudio: intro normal
  skipIntro();
  if (v.sala && ROOMS[v.sala] && hall.doors[v.sala]) setTimeout(() => enterRoom(v.sala), 60);
})();
addEventListener('keydown', e => { if (!intro.hidden && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) skipIntro(); });
}
