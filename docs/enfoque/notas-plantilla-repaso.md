# Rediseño de la plantilla de repasos: lo que no se puede romper

Notas del análisis del 2026-11-13, antes del rediseño con la identidad Enfoque. Valen para `scripts/plantilla-repaso.html`, `scripts/repaso.mjs` y cualquier repaso.

## El HTML también es una fuente de datos
`scripts/extraer-preguntas.mjs` lee el HTML de los repasos con expresiones regulares y `tests/preguntas.test.mjs` exige que su salida coincida con `app/preguntas/<u>.json`.
- **«BLOQUE N» se queda como texto.** Se guarda como `bloqueNum` y `app/sesion.js` filtra por esa cadena. Para verlo en minúsculas, CSS (`text-transform` + `::first-letter`), no cambiar el texto.
- **📍 en `.srcl` y 📌 al principio de `.fd.ok` se quedan en el texto.** El 📍 acaba en el campo `fuente` de las tarjetas; el 📌 es la marca con la que el extractor y el JS quitan la etiqueta (`replace(/^📌[^«]*/,"")`). Se pueden esconder (`hidden`) junto a un icono, o cambiar el extractor y regenerar `app/preguntas`.
- **Patrones intocables:** `<section class="blk" id="bN">…<span class="bn">…</span><span class="bt">`, `<article class="cpt…" id="cN" data-lv="N">`, `<h3>` sin atributos, `<p class="qt">`, `<div class="prof-t">`, `<div class="defs">`, `<div class="fd ok">`.

## Progreso guardado que depende de textos
- El planificador guarda lo hecho como `ps.done[fecha+"|"+x.t]`, con el título de la tarea **con su emoji** («🔁 Tarjetas: solo las que fallé»). Cambiar esos títulos pierde las marcas: el emoji se quita solo al pintar.
- `KEY`, `id="cN"` y `data-n` no cambian nunca.

## Saltos al cargar (CLS)
Lo causan dos inserciones con JS al principio de la página: el `.spec` (`prepend` en `assets/repaso.js`) y el enlace «← Volver a la unidad» (al inicio de `<body>` en DOMContentLoaded). Los dos pueden ir ya en el HTML generado: `repaso.js` no crea `.spec` si existe, y el script de volver puede reutilizar un enlace que ya esté.

## Botones de bloque
`button.blk-btn` lo crea el JS. Si se pone en el HTML, el JS necesita una guarda para no meter un botón dentro de otro.

## Tema
La app escribe `data-theme="papel"|"noche"` según `tsapc:v2` › `personal.prefs.tema` con una línea en `app/index.html`; los repasos pueden copiarla.

## Hojas compartidas
`assets/repaso.css` y `assets/unidades.css` también las usan los simulacros: el aspecto nuevo de los repasos va en una hoja propia.

## Se puede hacer ya, sea cual sea el diseño
`<main>`, fuentes locales (la plantilla aún carga Space Grotesk, Atkinson y Caveat de Google), controles de al menos 44 px (chips, Leer/Ponte a prueba, buscador, `.dt`, `.drw-x` a 38 px), y `prefers-reduced-motion` completo.
