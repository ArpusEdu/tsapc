# tsapc · «Corte»

App de estudio del ciclo TSAPC (Anatomía Patológica y Citodiagnóstico), 1.º curso. Web estática publicada en GitHub Pages: https://arpusedu.github.io/tsapc/ (repo ArpusEdu/tsapc). El usuario es el estudiante que la usa: estudia en el móvil, en ratos cortos, a menudo sin conexión.

Contexto de producto: `PRODUCT.md`. Plan del rediseño (fases 0–8): `docs/corte/encargo-v2.md`. Sistema de diseño: `docs/corte/DESIGN.md` (muestra viva en `docs/corte/sistema/index.html`).

## Reglas que no se negocian

1. **El contenido de la profe va literal.** Todo lo marcado como «profe» (prof-t, `profe.dice`, definiciones de diapositiva) se copia tal cual del PDF. No se resume, no se corrige, no se reescribe. Las erratas del PDF solo se arreglan declarándolas en `correcciones` de `contenido.json`. `tests/fuentes.test.mjs` y `tests/sesion.test.mjs` lo comprueban.
2. **Lo de «Corte»** (ganchos, «¿por qué?», casos, trucos) usa solo hechos que estén en el material de la profe. Nada inventado.
3. **Nada de pago**: ni servicios, ni fuentes, ni componentes Premium (Skiper UI solo gratis), ni APIs.
4. **No se pierde ni un dato de progreso.** El progreso vive en `localStorage` del dispositivo (`assets/store.js`, copia en `assets/copia.js`). Las claves viejas se migran; nunca se borran sin preguntar.
5. **Sin push ni publicación sin el visto bueno del usuario.** Commits locales sí.
6. **Preguntar antes de lo irreversible** (borrar, reescribir historial, cambiar el formato de datos guardados).
7. Voz: técnico de laboratorio veterano. Precisa, breve, cálida. Sin infantilismos, sin culpa, **sin gamificación** (nada de monedas, rankings ni confeti). Español de España.
8. Fechas de examen, horarios y calendario: solo los que dé el usuario; si faltan, «Fecha por confirmar».

## Arquitectura

- HTML, CSS y JS sin framework y **sin build**. PWA con `sw.js` (funciona sin conexión, imágenes incluidas).
- `index.html`: portada y datos de unidades (`EX`, `PROG`). `centro/`: el centro 3D (Three.js), una sala por asignatura.
- `app/`: la app SPA con rutas hash (`app.js`, `logica.js`, `quiz.js`, `sm2.js`, `sesion.js`, `datos.js`). Sesiones de estudio en `app/sesiones/<id>.json`, índice en `app/sesiones/indice.json`.
- Una carpeta por unidad (`bio1`…`ipe-tema5`) con `repaso/`, y a veces `simulacro/`, vocabulario y test. Fuentes de texto de los PDF en `docs/fuentes/<u>.txt`.
- `assets/corte/`: tokens, base, texturas, componentes, iconos del sistema de diseño.

## Cómo se trabaja

- Unidad nueva desde un PDF: texto con pdfjs → `docs/fuentes/<u>.txt` (+ `<u>-imagenes.txt`) → `<u>/repaso/contenido.json` → `node scripts/repaso.mjs <u>` → `node scripts/unidad-datos.mjs <u>` → `node scripts/extraer-preguntas.mjs`. Además: objeto en `app/datos.js`, entrada `EX` (con `"sim": {}`) y `PROG` en `index.html`, `UNIDADES` en `assets/store.js` y en `extraer-preguntas.mjs`, `sw.js` SHELL, sala en `centro/index.html`, número de unidades en `tests/app.test.mjs`.
- Sesión de estudio: escribir `app/sesiones/<id>.json` con `profe.dice` vacío → `node scripts/copiar-profe.mjs <u> <id>` → `node scripts/registrar-sesiones.mjs <ids…>`.
- Tras tocar archivos del SHELL: `node scripts/sw-version.mjs`.
- Siempre antes de dar algo por hecho: `node --test tests/` (todo en verde).
- `core.autocrlf=false`: los finales de línea CRLF rompen los tests y el hash del service worker.
- En Windows, **no editar con `Get-Content`/`Set-Content` de PowerShell**: estropean los acentos. Usar node o las herramientas de edición.
- Probar en navegador real a 360, 390 y 1280 px, en tema claro y oscuro, sin desbordes horizontales.

## Criterios de calidad

Lighthouse móvil: Rendimiento ≥ 90, Accesibilidad ≥ 95, Buenas prácticas ≥ 95. Contraste AA en los dos temas. Señal no cromática además del color. `prefers-reduced-motion` respetado. Animaciones solo de `transform`/`opacity`.

## Commits

Mensaje en español, breve, qué cambió y por qué. Terminar con:
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
