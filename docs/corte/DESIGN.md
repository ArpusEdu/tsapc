# Corte · sistema de diseño

Fase 2 del rediseño. Sale de la maqueta aprobada «Mi carrera» (v4): **los espacios son 3D y lo que se lee es cuaderno**. Este documento explica las piezas y cómo usarlas. La muestra viva está en `docs/corte/sistema/index.html`.

## Cómo se carga

Cuatro hojas de estilo normales, en este orden, sin build ni dependencias:

```html
<link rel="stylesheet" href="/assets/corte/tokens.css">      <!-- capas, fuentes, colores, medidas -->
<link rel="stylesheet" href="/assets/corte/base.css">        <!-- reset, foco, selección, scroll -->
<link rel="stylesheet" href="/assets/corte/texturas.css">    <!-- papel, cuadrícula, margen, cinta -->
<link rel="stylesheet" href="/assets/corte/componentes.css"> <!-- las piezas -->
```

Las capas van declaradas en `tokens.css`: `@layer tokens, base, texturas, componentes;`. El CSS propio de una página, sin capa, siempre gana a las piezas sin necesidad de `!important`.

Iconos y pegatinas salen de un único sprite: `assets/corte/iconos.svg`.

## Temas: papel y noche

- **Papel**: el cuaderno de día. Hoja crema `#fbf7ee`, tinta `#221d2e`, bolígrafo azul `#2846a8`.
- **Noche**: el pasillo a última hora. Hoja `#141821`, tinta crema `#f3ede2`, foco de lámpara `#ffcf8a`.
- Por defecto se sigue al sistema (`color-scheme: light dark`). Para forzarlo: `data-theme="papel"` o `data-theme="noche"` en `<html>` o en cualquier bloque.
- Los objetos de papel **no cambian de tema**: notas adhesivas, pegatinas y el temporizador LCD son cosas físicas y se ven igual de día y de noche.
- Navegadores con `light-dark()` (Chrome 123+, Safari 17.5+) lo usan directamente. Safari 15 a 17.4 recibe el mismo resultado con selectores. Limitación del respaldo: un bloque `data-theme="papel"` dentro de una página en noche no recolorea sus asignaturas en Safari antiguo.

### Tokens de color (usa siempre los `--c-*`, nunca los valores sueltos)

| Token | Para qué |
|---|---|
| `--c-fondo` | la mesa, fuera de la hoja |
| `--c-hoja`, `--c-hoja-2` | superficie y segunda capa |
| `--c-tarjeta` | tarjetas y tareas sobre la hoja |
| `--c-tinta` | texto |
| `--c-tinta-2` | texto secundario (sobre hoja o fondo, nunca sobre color) |
| `--c-tinta-3` | pies y notas pequeñas |
| `--c-boli` | letra a mano y enlaces |
| `--c-rotulador` | el círculo rojo de «hoy» y «ahora» |
| `--c-foco` | anillo de foco |
| `--c-linea`, `--c-linea-suave` | bordes dibujados y separadores |
| `--c-relleno` + `--c-sobre-tinta` | superficie invertida (aviso, segmentado activo) y su texto |
| `--c-ok`, `--c-aviso`, `--c-error` (+ `-suave`) | estados |
| `--c-fluor` | subrayado fluorescente y selección de texto |

## Una asignatura, un color

Pon `data-subject` en la página o en el bloque: `bio`, `lab`, `fisio`, `gest`, `ipe`, `ing`, `digi`, `sost`. Todo lo de dentro toma su color.

| Asignatura | base | tinte | oscuro | noche |
|---|---|---|---|---|
| Biología Molecular · `bio` | `#8b5cf6` | `#c3adff` | `#5a2ec0` | `#332a58` |
| Laboratorio · `lab` | `#2fc796` | `#86e4c3` | `#0d6b4c` | `#1b463f` |
| Fisiopatología · `fisio` | `#ff6b5b` | `#ffa197` | `#ad3326` | `#512e30` |
| Gestión de Muestras · `gest` | `#f5ad1b` | `#ffd166` | `#7a4f00` | `#4f3f1f` |
| IPE I · `ipe` | `#3b82f6` | `#9cc0ff` | `#1a53b3` | `#1e3458` |
| Inglés · `ing` | `#ff8a3d` | `#ffb685` | `#a3460a` | `#513628` |
| Digitalización · `digi` | `#5b7fa3` | `#adc3da` | `#34557a` | `#263343` |
| Sostenibilidad · `sost` | `#5fb83a` | `#a6dd88` | `#336f1a` | `#284228` |

Base, tinte y oscuro son los de la maqueta. «Noche» es nuevo: 26 % de la base sobre la hoja oscura.

Las piezas no leen esos valores directamente, sino estos tokens, que ya cambian con el tema:

| Token | Papel | Noche | Para qué |
|---|---|---|---|
| `--asig` | base | base | marcas: puntos, rayas, pegatinas, canto del botón |
| `--asig-suave` | tinte | noche | fondo de celdas, pestañas, insignias |
| `--asig-texto` | oscuro | tinte | texto de color |
| `--asig-relleno` | tinta | tinte | fondo del botón principal |
| `--asig-borde` | oscuro | tinte | bordes discontinuos |
| `--asig-pulsado` | base más oscura (`oklch(from …)`; si no, oscuro) | igual | estados pulsados |

**Reglas de color**

- La base nunca es fondo de texto. Bio y Digi no llegan a 4,5:1 ni con tinta encima.
- Sobre un fondo de color, el texto es `--c-tinta`, nunca `--c-tinta-2` ni el oscuro de la asignatura (el oscuro sobre su tinte se queda entre 3,3 y 4,3:1).
- Cuando la base marca algo con sentido (un punto en el calendario), lleva contorno de tinta.
- El estado nunca va solo en el color: rayas para el laboratorio y los festivos, borde para las fechas clave, círculo para hoy, texto oculto para el lector de pantalla.

## Contraste comprobado

La página de muestra mide cada pareja en el navegador, en los dos temas y en las 8 asignaturas. Todas llegan a AA. Las más justas:

- Texto de color sobre la hoja: Inglés en papel, 5,71:1.
- Texto secundario sobre segunda capa: 6,05:1 (papel).
- Bordes de controles: 5,35:1 (noche).

Lo que se cambió de la maqueta para llegar:

- Botón principal en noche: fondo de tinte con tinta oscura, en vez de la base.
- Detalle pequeño de las celdas (hora, «Tutoría»): tinta en vez de tinta-2 (4,4:1 sobre el tinte de Bio).
- Texto de 10,5 px del LCD y de 9,5 px de «LAB»: subidos a 12 px.

## Letra

Locales en `assets/corte/fuentes/`, subconjunto latino, `font-display: swap` y respaldos con métricas ajustadas para que el texto no salte. **226 KB** en total. Licencia OFL en `fuentes/OFL.txt`.

| Familia | Archivo | Uso |
|---|---|---|
| Fraunces (variable, SOFT 100) | `fraunces-var.woff2` 62 KB · `fraunces-italic-500.woff2` 41 KB | títulos. La cursiva solo existe en 500 |
| Atkinson Hyperlegible | 400, 700 y 400 cursiva · 17–18 KB cada una | texto |
| Atkinson Hyperlegible Mono (variable) | 18 KB | horas, cifras, cuenta atrás |
| Caveat | `caveat-600.woff2` 51 KB | lo escrito a mano |

Escala fluida (`clamp`, de 360 a 1280 px): `--t-min` 12 · `--t-xs` 13 · `--t-sm` 14–15 · `--t-base` 16–17 · `--t-lectura` 17–18 · `--t-lg` 19–22 · `--t-xl` 24–32 · `--t-2xl` 28–44 · `--t-3xl` 38–72 · `--t-mano` 21–23.

Interlineado: `--lh-ajustado` 1,02 (títulos grandes), `--lh-titulo` 1,1, `--lh-texto` 1,5, `--lh-lectura` 1,62. Tracking: `--tr-display` −0,03em, `--tr-titulo` −0,015em, `--tr-versal` 0,12em.

- Nada por debajo de 12 px. 12 px solo en etiquetas en mayúsculas o pies de dato.
- Lectura larga con `.lectura`: 62 caracteres de ancho como mucho.
- La mono es para horas, cifras y medidas, no para dar aire «técnico».

## Medidas

- Espacio (base 4): `--e-1` 4 · `--e-2` 8 · `--e-3` 12 · `--e-4` 16 · `--e-5` 24 · `--e-6` 32 · `--e-7` 48 · `--e-8` 64.
- Cuadro del papel `--cuadro`: 22 px (24 en escritorio). Margen rojo `--margen-hoja`: 28 px (53 en escritorio).
- Toque mínimo `--toque`: 44 px. Los botones miden 48.
- Radios: `--r-1` 4 · `--r-2` 8 · `--r-3` 12 · `--r-4` 20 · `--r-pildora` · `--r-mano` (borde dibujado a mano) · `--r-nota` (esquina de nota).
- Sombras neutras, siempre con desplazamiento y desenfoque: `--sombra-1`, `--sombra-nota`, `--sombra-hoja`, `--sombra-flota`, `--sombra-tecla`.
- Capas: `--z-hoja` 10 · `--z-barra` 70 · `--z-pildora` 80 · `--z-aviso` 90 · `--z-dialogo` 100.

## Movimiento

| Token | Valor | Uso |
|---|---|---|
| `--d-rapida` | 140 ms | hover y pulsación |
| `--d-media` | 240 ms | segmentado, pestañas |
| `--d-lenta` | 450 ms | aviso, hoja que entra |
| `--d-tacha` | 550 ms | tachar una tarea |
| `--d-trazo` | 1300 ms | pegatina que se dibuja |
| `--ease-salida` | `cubic-bezier(.23,1,.32,1)` | la de siempre |
| `--ease-muelle` | `cubic-bezier(.3,1.5,.5,1)` | pestañas y notas, rebote corto |
| `--ease-trazo` | `cubic-bezier(.6,.05,.25,1)` | bolígrafo |

Con «reducir movimiento», las duraciones pasan a 0, las pegatinas aparecen dibujadas y nada late. El hover solo se aplica en dispositivos con puntero (`@media (hover:hover)`), para que en el móvil no se quede pegado.

## Texturas (`texturas.css`)

- `.tx-hoja`: papel completo (grano + margen rojo + cuadrícula). Úsala junto a `.hoja`.
- `.tx-grano`, `.tx-cuadricula`, `.tx-margen`: cada capa suelta.
- `.tx-rayas`: rayas diagonales con `--raya`.
- `.tx-washi`: cinta adhesiva.
El grano es un SVG de ruido de 180 px en línea, claro en noche y sepia en papel. Sin imágenes.

## Componentes (`componentes.css`)

| Pieza | Clase | Cuándo |
|---|---|---|
| Botón principal | `.boton` | la acción que toca ahora. Uno por pantalla |
| Secundario | `.boton.secundario` | alternativas: ver horario, ver asignaturas |
| Fantasma | `.boton.fantasma` | «Más tarde», cancelar |
| Solo icono | `.boton.icono` + `aria-label` | flechas de mes, buscar |
| Cargando | `aria-busy="true"` en el botón | mientras guarda; no se puede volver a pulsar |
| Nota-botón | `.nota-boton` (`.amarilla`) | ir a Repaso, Simulacro, Lectura |
| Nota | `.nota` | un aviso escrito a mano, sin acción |
| Píldora Hoy | `.pildora-hoy` (`.punto .etq .que .cuenta`) | lo más urgente con su cuenta atrás. `.vacia` si no hay nada |
| Cuaderno | `.cuaderno` > `.pestanas` + `.anillas` + `.hoja.tx-hoja` | toda página de lectura |
| Pestaña | `.pestana` + `aria-current="page"` | secciones del cuaderno |
| Tarjeta | `.tarjeta` (+ `.washi`) | un bloque con título. No anidar |
| Lista de bloques | `.bloques` | los apartados de una unidad, numerados a mano |
| Tarea | `.tarea` + `.casilla[role=checkbox]` | algo que se tacha. JS pone `aria-checked` y `.hecha` |
| Fluorescente | `.fluor` · `.fluor.asig` · `.por-pintar` → `.pintado` | lo más importante de un texto. Uno o dos por pantalla |
| Washi | `.washi` (`.derecha`) | sujetar una tarjeta o una foto |
| Sello | `.sello` (`.pequeno`, `.estampar`) | «Pronto» en asignaturas sin unidades |
| Aviso | `.avisos` (región `role=status`) > `.aviso` (`.es-ok`, `.es-error`, `.aviso-accion`) | confirmar o explicar un fallo. 3 s y se va |
| Segmentado | `.segmentado` + `aria-pressed` | Mes/Curso, Ambas/24 h/12 h |
| Insignia | `.insignia` · `.insignia.por-confirmar` | fecha de examen o entrega. «Fecha por confirmar» si no se sabe |
| Recuadro | `.recuadro` | el próximo examen |
| LCD | `.lcd` > `.lcd-pantalla` + `.lcd-pie`, `role="timer"` | cuenta atrás. `.cerrada` cuando termina |
| Horario | `.horario` > `.h-dia` `.h-hora` `.celda` (`.es-lab`, `.es-ahora`) `.recreo` | la semana |
| Calendario | `.mes` > `.dia` (`.es-hoy`, `.es-festivo`, `.es-sinclase`, `.es-practicas`, `.es-recuperacion`, `.es-clave`, `.es-finde`) | el mes |
| Leyenda | `.leyenda` | debajo de horario y calendario, siempre |
| Etiqueta editorial | `.etiqueta-ed` > `.num` + `.nombre` (`.apagada`) | sobre la escena 3D: número, línea fina y nombre |
| Barra inferior | `.barra-inferior` (`.fija`) | Hoy · Agenda · Asignaturas · Errores · Mi mesa. `aria-current` en la actual; `.aviso-punto` si hay fallos pendientes |
| Estado | `.estado` · `.estado.es-error` · `.estado.cargando` | vacío, error y carga |
| Ruta | `ol.ruta` | dónde estás: asignatura / unidad. Sustituye al antetítulo de la maqueta |
| Letra a mano | `.mano` | comentarios cortos, nunca instrucciones importantes |

### Iconos y pegatinas

```html
<svg class="ico" aria-hidden="true"><use href="/assets/corte/iconos.svg#i-calendario"/></svg>

<svg class="pegatina dibujar" data-subject="bio" viewBox="0 0 80 80" aria-hidden="true">
  <use href="/assets/corte/iconos.svg#st-adn"/>
</svg>
```

- Iconos (24 px, trazo 2, puntas redondas, color del texto): volver, siguiente, cerrar, calendario, reloj, check, alerta, info, descargar, subir, abrir-fuera, buscar, menu, sin-conexion, actualizar, mas, editar, tema, hoy, agenda, asignaturas, errores, mi-mesa.
- Pegatinas (15, de la maqueta): corazon, adn, matraz, tubos, botiquin, hello, pantalla, hoja, petri, gel, microscopio, gafas, torso, hospital, sonometro.
- Para que se dibujen solas: el JS añade `.dibujar` y, al entrar en pantalla, `.dibujada`. Sin JS se ven ya dibujadas. `.quieta` para que no latan ni giren.
- Si la pegatina dice algo, quita `aria-hidden` y pon `role="img"` con `aria-label`.

## Qué no hacer

- Nada de halos ni brillos de color (`box-shadow` de color sin desplazamiento). Las sombras son neutras.
- Nada de texto de menos de 12 px.
- Nada de gris sobre color: sobre un tinte, tinta.
- Nada de la base de una asignatura como fondo de texto.
- Nada de rosa eosina ni colores apagados: cada asignatura conserva su color vivo.
- Nada de `!important` (solo en `.sr` y en el movimiento reducido).
- Nada de emojis ni caracteres sueltos como iconos: todo sale del sprite.
- Nada de tarjetas dentro de tarjetas.
- Nada de antetítulos en mayúsculas sobre los títulos: si hace falta contexto, `.ruta`.
- Nada de gamificación: ni monedas, ni rankings, ni confeti. «¡Hecho!» y la planta bastan.
- Nada de cifras, testimonios o fechas inventadas: si no se sabe, «Fecha por confirmar».
