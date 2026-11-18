# tsapc · «Enfoque»

App de estudio del ciclo TSAPC (Anatomía Patológica y Citodiagnóstico), 1.º curso. Web estática publicada en GitHub Pages: https://arpusedu.github.io/tsapc/ (repo ArpusEdu/tsapc). El usuario es el estudiante que la usa: estudia en el móvil, en ratos cortos, a menudo sin conexión.

Contexto de producto: `PRODUCT.md`. Marca: `docs/enfoque/marca.md` (aprobada; manda sobre DESIGN.md donde choquen). Sistema de diseño: `docs/corte/DESIGN.md` (cuaderno + espacios 3D; muestra viva en `docs/corte/sistema/index.html`). `docs/corte/encargo-v2.md` es el plan histórico de fases 0–8: su dirección «fluorescencia» quedó sustituida por DESIGN.md; vale solo para fases, reglas y criterios.

## Reglas que no se negocian

1. **El contenido de la profe va literal.** Todo lo marcado como «profe» (prof-t, `profe.dice`, definiciones de diapositiva) se copia tal cual del PDF. No se resume, no se corrige, no se reescribe. Las erratas del PDF solo se arreglan declarándolas en `correcciones` de `contenido.json`. `tests/fuentes.test.mjs` y `tests/sesion.test.mjs` lo comprueban.
2. **Lo de «Enfoque»** (marcado «de Enfoque»; antes «de Corte»: ganchos, «¿por qué?», casos, trucos) usa solo hechos que estén en el material de la profe. Nada inventado.
   **Excepción decidida por el usuario el 2026-11-18: «Para saber más».** En los repasos, cada concepto puede llevar una ampliación breve con información que complemente lo de la profe (mecanismo, ejemplo clínico, relación con el laboratorio de anatomía patológica). Va siempre aparte, marcada como «Para saber más · de Enfoque, no viene en tus diapositivas», con datos de manual bien establecidos y sin contradecir nunca a la profe; si hay duda, no se pone. Lo de la profe sigue siendo lo que se estudia para el examen.
3. **Nada de pago**: ni servicios, ni fuentes, ni componentes Premium (Skiper UI solo gratis), ni APIs.
4. **No se pierde ni un dato de progreso.** El progreso vive en `localStorage` del dispositivo (`assets/store.js`, copia en `assets/copia.js`). Las claves viejas se migran; nunca se borran sin preguntar.
5. **Sin push ni publicación sin el visto bueno del usuario.** Commits locales sí.
6. **Preguntar antes de lo irreversible** (borrar, reescribir historial, cambiar el formato de datos guardados).
7. Voz: técnico de laboratorio veterano. Precisa, breve, cálida. Sin infantilismos, sin culpa, **sin gamificación** (nada de monedas, rankings ni confeti). Español de España.
8. Fechas de examen, horarios y calendario: solo los que dé el usuario; si faltan, «Fecha por confirmar».

## Arquitectura

- HTML, CSS y JS sin framework y **sin build**. PWA con `sw.js`: las páginas funcionan sin conexión; las imágenes de los repasos se guardan la primera vez que se ven con conexión.
- **La entrada es la app** (`app/`, Hoy, con la guía de bienvenida `app/bienvenida.js` la primera vez). `index.html` redirige a la app; la portada antigua (con los datos `EX`, `PROG` que usan los scripts) sigue en `?portada`. El «volver» de repasos y simulacros lleva a la unidad en la app. `centro/`: el centro 3D (Three.js, librerías locales en `assets/vendor/`), una sala por asignatura, con botón «Ver sin 3D».
- `app/`: la app SPA con rutas hash (`app.js`, `logica.js`, `quiz.js`, `sm2.js`, `estudio.js` práctica y tarjetas, `sesion.js` sesiones de estudio, `mov.js` movimiento, `datos.js`). Sesiones de estudio en `app/sesiones/<id>.json`, índice en `app/sesiones/indice.json`.
- Una carpeta por unidad (`bio1`…`ipe-tema5`) con `repaso/`, y a veces `simulacro/`, vocabulario y test. Fuentes de texto de los PDF en `docs/fuentes/<u>.txt`.
- `assets/corte/`: tokens, base, texturas, componentes, iconos del sistema de diseño.

## Cómo se trabaja

- Unidad nueva desde un PDF: texto con pdfjs → `docs/fuentes/<u>.txt` (+ `<u>-imagenes.txt`) → `<u>/repaso/contenido.json` → `node scripts/repaso.mjs <u>` → `node scripts/unidad-datos.mjs <u>` → `node scripts/extraer-preguntas.mjs`. Además: objeto en `app/datos.js`, entrada `EX` (con `"sim": {}`) y `PROG` en `index.html`, `UNIDADES` en `assets/store.js` y en `extraer-preguntas.mjs`, `sw.js` SHELL, sala en `centro/index.html`, número de unidades en `tests/app.test.mjs`. Si el prefijo de la clave no coincide con la carpeta (ipe4 → ipe-tema4), `ALIAS` en `assets/store.js`. Dibujo en `assets/especimen.js` y nombre corto en `SHORT` de `assets/repaso.js`. La clave de guardado debe cumplir `PERMITIDAS` de `assets/copia.js` (lo vigila `tests/copia.test.mjs`).
- Sesión de estudio: escribir `app/sesiones/<id>.json` con `profe.dice` vacío → `node scripts/copiar-profe.mjs <u> <id>` → `node scripts/registrar-sesiones.mjs <ids…>`.
- Tras tocar archivos del SHELL: `node scripts/sw-version.mjs`.
- Siempre antes de dar algo por hecho: `node --test tests/` (todo en verde). GitHub las repite en cada push (`.github/workflows/pruebas.yml`).
- Commits con el correo anónimo de GitHub (`git config user.email` ya lo tiene en este repo); nunca un correo personal.
- `core.autocrlf=false`: los finales de línea CRLF rompen los tests y el hash del service worker.
- En Windows, **no editar con `Get-Content`/`Set-Content` de PowerShell**: estropean los acentos. Usar node o las herramientas de edición.
- Probar en navegador real a 360, 390 y 1280 px, en tema claro y oscuro, sin desbordes horizontales.

## Graphify: consulta el grafo antes de leer archivos grandes

Grafo del código (funciones, llamadas, imports) en `graphify-out/` (local, en `.gitignore`; exclusiones en `.graphifyignore`). Antes de abrir `app/app.js`, `assets/store.js` u otro archivo grande para buscar algo, pregunta al grafo y lee solo las líneas que te indique:

- `python -m graphify query "plan examen planExamen" --budget 1500`: subgrafo con archivo y línea. Usa nombres de funciones o palabras del código, no frases.
- `python -m graphify explain "store.js"` (qué contiene y con qué conecta) · `python -m graphify affected "app/app.js::guardar()"` (qué depende de algo; si un nombre es ambiguo, el CLI lista las rutas para usar `ruta::símbolo`).
- Regenerar tras cambios de código: `python -m graphify update .` (sin LLM, solo lo cambiado). Desde cero: `python -m graphify extract . --code-only` y luego `python -m graphify cluster-only . --no-label`.
- Solo indexa `.js` y `.mjs` (el JS en línea de los `.html`, los `.json`, los `.css`, los `.md` y `docs/fuentes/*.txt` no entran): para eso, Grep.

## Criterios de calidad

Lighthouse móvil: Rendimiento ≥ 90, Accesibilidad ≥ 95, Buenas prácticas ≥ 95. Contraste AA en los dos temas. Señal no cromática además del color. `prefers-reduced-motion` respetado. Animaciones solo de `transform`/`opacity`.

## Commits

Mensaje en español, breve, qué cambió y por qué. Terminar con:
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
