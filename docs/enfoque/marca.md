# Enfoque · marca

Identidad de la app que antes se llamaba «Corte». **Aprobada por el usuario el 2026-11-13** (lema «Enfoca lo que toca.», reglas del cuaderno incluidas) y aplicada a la app. Muestra visual: `docs/enfoque/muestra.html`.

## El concepto

> El microscopio enfoca la muestra; la app te enfoca en lo que toca estudiar.

El símbolo es lo que se ve por el ocular cuando todo está en su sitio: el **anillo del objetivo** con su muesca de referencia, el **campo iluminado**, un **tejido teñido con hematoxilina y eosina** y, en medio, **una sola célula nítida**. Las vecinas siguen ahí, más claras: lo que no toca hoy no desaparece, solo queda en segundo plano.

La animación de entrada cuenta lo mismo en un segundo: la luz se enciende, el anillo gira y se pasa un poco, la imagen pasa de borrosa a nítida, se vuelve a desenfocar un pelo y queda fija. Así enfoca un microscopio de verdad: se cruza el plano y se vuelve.

### Por qué funciona

- **El nombre y la imagen dicen lo mismo.** «Enfoque» es a la vez el gesto del microscopio y lo que la app hace contigo. No hace falta explicar el logo.
- **Es del oficio, no de una app de estudio cualquiera.** Un estudiante de TSAPC reconoce la H-E antes de leer nada: núcleo violeta, citoplasma rosa. Nadie más usa esa pareja de colores.
- **No es un ojo ni una diana.** Una célula sola en un círculo se lee como un ojo. Por eso hay tejido alrededor, membranas y núcleos vecinos, y la célula es poligonal, como en un epitelio.
- **Aguanta a 16 px.** Lo que queda en la pestaña es el anillo con su muesca y una mancha rosa con un punto violeta. Es reconocible y no se parece a otros iconos.
- **Tiene un sistema detrás.** La paleta sale de las tinciones, la luz y el vidrio; las asignaturas se codifican como los anillos de color de los objetivos; las unidades se etiquetan como portaobjetos. Todo viene del mismo laboratorio.

## Lema

**«Enfoca lo que toca.»** (propuesto en lugar de «Estudia con foco»)

- Usa el verbo de la marca y no repite la palabra: «Enfoque… con foco» suena redundante.
- Dice el primer principio del producto: lo siguiente útil, primero.
- Suena bien en voz alta: «enfoca» y «toca» riman por dentro sin forzarlo.
- Alternativa, si el usuario prefiere la suya: «Estudia con foco».

Usos: debajo del logo en la pantalla de llegada, en el manifiesto de la PWA (`description`) y en la portada. No se repite en cada pantalla.

## Archivos

Todos en `assets/enfoque/`, SVG a mano, sin dependencias. El texto alternativo es siempre «Enfoque».

| Archivo | Qué es | Cuándo |
|---|---|---|
| `logo.svg` | símbolo + palabra, colores fijos para fondo claro | cabeceras, portada, documentos |
| `logo-noche.svg` | lo mismo con anillo y palabra en crema | sobre fondos oscuros |
| `simbolo.svg` / `simbolo-noche.svg` | solo el símbolo | avatar, sitios cuadrados, cabecera compacta |
| `simbolo-mono.svg` | una tinta, `currentColor`, versión grabada | sellos, marcas de agua, impresión, el anillo de asignatura |
| `favicon.svg` | símbolo con el anillo más grueso; sigue el tema del sistema | pestaña del navegador |
| `logo-animado.svg` | la entrada animada, en un SVG autónomo | vista previa, cualquier sitio fuera de la app |
| `icon-192.png`, `icon-512.png` | icono de app, fondo de ocular | manifiesto, `purpose: any` |
| `icon-maskable-512.png` | el mismo con el símbolo al 56 %, dentro de la zona segura | manifiesto, `purpose: maskable` |
| `apple-touch-icon-180.png` | icono para iPhone | `<link rel="apple-touch-icon">` |

**Por qué hay versión clara y oscura y no una que cambie sola.** Un SVG cargado con `<img>` sigue el tema del sistema, no el de la página. Con la app en «papel» y el móvil en modo oscuro, un logo automático saldría crema sobre crema. Solo el favicon cambia solo, porque la pestaña sí sigue al sistema.

**La palabra** es Fraunces cursiva 500 con tamaño óptico 144, la fuente local que ya está en `assets/corte/fuentes/`, convertida a trazos para que el SVG no dependa de cargar la fuente. Minúscula, con un tracking de −0,018 em. La licencia OFL permite convertir las letras en un logo.

### Construcción

- Rejilla de 48. Anillo de radio 19,5 y trazo 4; campo de radio 18. Muesca de 36°, centrada a la una y media.
- En el logo, la palabra tiene la altura de x centrada en el centro del símbolo; el hueco entre los dos es de 12 unidades (un cuarto del símbolo).
- **Aire alrededor:** como mínimo un cuarto de la altura del símbolo por cada lado.
- **Tamaños mínimos:** símbolo 16 px (mejor `favicon.svg`); logo completo 96 px de ancho; por debajo, solo el símbolo.

### Qué no hacer con el logo

- No girar la muesca a otra posición, salvo durante la animación.
- No cambiar la H-E por otros colores ni por el color de una asignatura. El color de la asignatura va en un anillo fino **alrededor** (ver «Canales»).
- No poner la palabra en otra fuente ni en mayúsculas.
- No añadir sombras, brillos, contornos ni degradados. El único degradado es el fondo de ocular del icono de app.
- No usar el logo sobre fotos o fondos con textura sin una superficie lisa debajo.
- No usar la célula sola, sin el anillo, como símbolo.

## La animación de entrada

Solo `transform`, `opacity` y un `filter: blur()` de 2,6 unidades como mucho, sobre un grupo pequeño y durante poco más de un segundo. Una vez por sesión, en la pantalla de llegada o al abrir la app; nunca en cada cambio de pantalla.

| Pieza | Qué hace | Tiempo |
|---|---|---|
| `.e-campo` | la luz se enciende (opacidad) | 0–450 ms |
| `.e-anillo` | gira de −140° a +6° y vuelve a 0° | 0–1300 ms |
| `.e-muestra` | de borrosa y algo grande a nítida, se pasa un poco y vuelve | 0–1300 ms |
| `.e-palabra` | entra desde 5 px a la izquierda | 850–1450 ms |

**En la app, mejor en línea** (el SVG dentro del HTML): así hereda el tema y respeta «reducir movimiento» con seguridad. Pasos:

1. Copiar el contenido de `assets/enfoque/logo-animado.svg` dentro de la pantalla, cambiando los dos `#1b1840` (anillo y palabra) por `currentColor` y dando un id único al `clipPath` si hay más de un logo en la página.
2. Poner al `<svg>` `class="e-logo"`, `role="img"`, `aria-label="Enfoque"` y `color: var(--c-anillo-logo)`.
3. Llevar a la hoja de la pantalla el bloque `<style>` del archivo (clases `.e-anillo`, `.e-muestra`, `.e-campo`, `.e-palabra` y sus `@keyframes`).
4. Para repetirla, sustituir el SVG por un clon: `svg.replaceWith(svg.cloneNode(true))`.

```css
.e-anillo{transform-box:view-box;transform-origin:24px 24px;animation:e-gira 1.3s cubic-bezier(.22,1,.36,1) both}
.e-muestra{transform-box:view-box;transform-origin:24px 24px;animation:e-enfoca 1.3s cubic-bezier(.33,1,.68,1) both}
.e-campo{animation:e-luz .45s ease-out both}
.e-palabra{animation:e-entra .6s .85s cubic-bezier(.22,1,.36,1) both}
@keyframes e-gira{0%{transform:rotate(-140deg)}68%{transform:rotate(6deg)}100%{transform:rotate(0)}}
@keyframes e-enfoca{0%{opacity:0;filter:blur(2.6px);transform:scale(1.12)}20%{opacity:.8}62%{filter:blur(0);transform:scale(.985)}76%{filter:blur(.55px)}100%{opacity:1;filter:blur(0);transform:scale(1)}}
@keyframes e-luz{from{opacity:0}}
@keyframes e-entra{from{opacity:0;transform:translateX(-5px)}}
@media (prefers-reduced-motion:reduce){.e-anillo,.e-muestra,.e-campo,.e-palabra{animation:none}}
```

- **Reducir movimiento:** sin animación; el logo aparece ya enfocado. Comprobado en Edge: con `reduce`, cero animaciones en la página de muestra.
- **Modo examen** (`data-examen="1"`): tampoco se anima. Si se lanza con JavaScript, pasa por `window.CorteMov` como el resto.
- **Como `<img>`:** el SVG lleva su propio `prefers-reduced-motion`, pero no todos los navegadores se lo pasan a una imagen. Si se usa así, mejor con `<picture><source media="(prefers-reduced-motion: reduce)" srcset="logo.svg"><img src="logo-animado.svg" alt="Enfoque"></picture>`.
- Safari antiguo puede no aplicar `filter` a elementos SVG: entonces se ve el giro y el fundido sin desenfoque, que también funciona.

## Paleta

Propuesta completa, con contraste calculado, en `docs/enfoque/tokens-propuestos.css` (102 parejas, ninguna por debajo de AA). La página de muestra vuelve a medir las principales en el navegador.

| Color | Valor | De dónde sale | Para qué |
|---|---|---|---|
| Hematoxilina profunda | `#1b1840` | los núcleos muy teñidos | la tinta y el anillo del logo |
| Hematoxilina | `#3b2f9e` | el núcleo | enlaces, foco y marcas de la app en papel |
| Hematoxilina clara | `#b9b2f5` | | enlaces en noche |
| Eosina | `#e85d8c` | el citoplasma | la célula; marcas. Nunca fondo de texto |
| Eosina clara | `#f6bccd` | tejido poco teñido | tejido del logo, subrayado «teñido» |
| Eosina oscura | `#8f1d47` | | eosina como texto en papel (8,13:1) |
| PAS | `#8a1466` | magenta del glucógeno y las mucinas | el rotulador de «hoy» y «ahora» |
| Luz del campo | `#fff3dc` | la luz del condensador | lo iluminado |
| Lámpara halógena | `#ffcf8a` | la bombilla del microscopio | foco y acción principal en noche |
| Vidrio · canto | `#e4eeea` · `#8fbcaa` | el portaobjetos | etiqueta esmerilada, filetes finos |
| Ocular | `#121027` | lo oscuro alrededor del campo | fondo del icono |

**Los dos temas**

- **Papel** (de día): la hoja crema de siempre, algo más limpia (`#fbf8f1`). La tinta pasa del negro violáceo a la hematoxilina profunda (15,82:1). La acción principal es hematoxilina (`#2f2a7c`, 12,05:1 con texto blanco), no negro: la app deja de parecer en blanco y negro.
- **Noche** (mirar por el ocular): fondo de ocular (`#14132a`), tinta crema (15,62:1). La acción principal es la lámpara encendida, `#ffcf8a` con texto hematoxilina (12,88:1). El foco ya era ese color; ahora tiene sentido.

**Cómo se aplica sin romper nada.** El archivo propuesto mantiene los nombres `--c-*` que usan las piezas y solo cambia sus valores; añade `--c-marca`, `--c-eosina` y `--c-anillo-logo`. Al aprobarse, se pasan los valores a `assets/corte/tokens.css` y las pantallas cambian sin tocar componentes.

**Cambia una regla de DESIGN.md.** Allí pone «nada de rosa eosina». Esa regla era para que las asignaturas no se apagaran, y sigue valiendo para ellas. La eosina entra solo como color de **marca**: logo, subrayado «teñido» y algún texto de énfasis. Nunca como color de asignatura.

### Canales: cada asignatura, su anillo

Los objetivos llevan un anillo de color que dice su aumento sin leer nada. Las 8 asignaturas **conservan sus colores** (base, tinte y oscuro, sin cambios) y se presentan así: el símbolo monocromo dentro de un anillo fino del color de la asignatura. Reglas:

- **Lo que es de la app** (logo, navegación, Hoy, Mi mesa) es hematoxilina.
- **Lo que es de una asignatura** (su sala, sus unidades, sus botones) es su color, como hasta ahora.
- Biología es violeta y está cerca de la hematoxilina. Por eso la marca no se usa como fondo dentro de una página de Biología: allí manda `--asig`.
- En noche solo cambia el fondo de celda: el 26 % de la base sobre la hoja nueva (`--bio-noche-e` y demás, en el CSS propuesto). Todas las parejas dan AA.

## Voz y tono

Habla como una técnica de laboratorio veterana que te enseña en prácticas: **precisa, breve y cálida, con oficio**. Dice qué hacer y por qué, con el vocabulario real del laboratorio, sin adornos y sin regañar.

| Así | No |
|---|---|
| Hoy toca Fisiopatología 2. Diez minutos de tarjetas. | ¡Vamos, campeón! ¡Tú puedes con todo! |
| Has fallado 4. Vuelven en el próximo repaso. | Has perdido tu racha de 6 días. |
| Fecha por confirmar. | ¡Quedan 3 días! ¡Corre! |
| Nítido: 18 de 20. | ¡+50 puntos! Subes al nivel Plata. |
| Esto aún está borroso. Repásalo mañana. | ¡Ups! Has suspendido. |

- **Las palabras de la marca**, con medida: *enfocar*, *nítido*, *borroso*, *campo*, *teñido*, *muestra*, *portaobjetos*. Una por pantalla como mucho; si suena a juego de palabras, se quita.
- **Verbos de acción** en los botones: «Empezar por Hoy», «Repasar», «Ver fallos». Nunca «OK» ni «Continuar» a secas.
- **Los fallos no castigan:** se dicen con su número y lo que va a pasar con ellos.
- **Nada de gamificación:** ni monedas, ni rachas, ni niveles, ni rankings, ni confeti, ni signos de exclamación en serie.
- **Nada inventado:** ni cifras, ni testimonios, ni fechas. «Fecha por confirmar» si no se sabe.
- **El contenido de la profe va literal.** La voz de Enfoque está alrededor, nunca dentro.
- Tú, no usted. Español de España. Sin emojis.

## Cómo convive con lo que ya existe

**Los espacios son 3D, lo que se lee es cuaderno, y la marca es el microscopio entre los dos.**

- **El centro 3D** es el laboratorio: las salas por asignatura. La marca no entra en la escena; solo en la etiqueta y en la transición. Entrar en una sala o en una unidad es «subir de aumento»: la escena se desenfoca 3 px y la página entra nítida (`--e-d-nitido`, 260 ms). Con movimiento reducido, un fundido.
- **El cuaderno** sigue siendo el lenguaje de lectura: hoja crema, Fraunces en títulos, Atkinson en texto. Lo que cambia es que deja de ser papelería y pasa a ser **el cuaderno de prácticas de un laboratorio**.
- **Los nombres y claves no cambian:** las claves `tsapc:*` del almacenamiento no se tocan nunca, ni ahora ni al aprobar la marca. `window.CorteMov` y las rutas pueden seguir llamándose igual por dentro.

### Darle carácter al cuaderno desde la marca

Hoy se ve desordenado porque todo adorna a la vez: cuadrícula, margen rojo, anillas, agujeros, pegatinas, letra a mano y fluorescente en la misma pantalla. Ninguno manda. Propuesta, de más a menos impacto:

1. **Hoja lisa con margen.** La cuadrícula, solo donde se mide algo: horario y calendario. Como la retícula de un ocular micrométrico, que aparece cuando hace falta medir.
2. **El portaobjetos como pieza propia.** Cada unidad abre con su etiqueta de portaobjetos: a la izquierda, la zona esmerilada teñida del color de la asignatura, con el código y el tema en letra mono («BIO 2 · Tema 3»), como los portaobjetos de colores que se usan para clasificar; a la derecha, el título en Fraunces. Es la pieza que nadie más tiene y que un técnico reconoce enseguida.
3. **Un color de acción con nombre.** El botón principal deja de ser negro: hematoxilina de día, lámpara de noche.
4. **Lo importante, «teñido».** El subrayado pasa de fluorescente amarillo a eosina clara. Uno o dos por pantalla, como hasta ahora.
5. **La letra a mano, en su sitio.** Caveat como mucho una vez por pantalla y en el margen, como una nota a lápiz, nunca para instrucciones.
6. **Menos objetos en el móvil.** Fuera las anillas y los agujeros por debajo de 760 px (en escritorio pueden quedarse). Las pegatinas, solo en la colección de Mi mesa.
7. **Un solo momento de movimiento de marca:** la entrada del logo, una vez por sesión, y el «subir de aumento» al entrar en una unidad. Nada más se mueve por adorno.

### La primera pantalla

Responde a dos preguntas, en este orden: **qué es esto** y **qué hago aquí**. Logo animado, el lema como título, una frase y tres pasos.

- **Título:** «Enfoca lo que *toca*.» (la cursiva en eosina oscura).
- **Qué es:** «Repasos, simulacros y tarjetas de las 15 unidades de 1.º de TSAPC, con el material de clase tal cual. Abres, ves qué toca y estudias diez minutos.»
- **Qué hago:** 1. *Abre Hoy.* Te dice qué toca y cuánto falta para cada examen. 2. *Estudia un rato.* Repaso, tarjetas o simulacro: lo que te dé tiempo. 3. *Lo que falles vuelve.* Se guarda y sale otra vez, sin castigo.
- **Acción:** «Empezar por Hoy». Secundaria: «Cómo funciona, en un minuto» (la guía de bienvenida actual).
- **Pie:** «Sin cuenta y sin conexión. Tu progreso se queda en este móvil.»

Todo lo que dice es cierto hoy: 15 unidades, sin cuentas, funciona sin conexión y los fallos vuelven.

## Protección y coherencia

- **El nombre.** «Enfoque» es una palabra común. Para un proyecto de clase, sin ánimo de lucro y sin publicar en tiendas de apps, no hace falta registrarlo. Si algún día se publicara fuera del grupo, habría que buscar antes en la OEPM y en la EUIPO (clases 9 y 41), que es gratis.
- **Una sola fuente de verdad.** Los SVG salen de una geometría única (anillo, campo, tejido, célula). Si se retoca, se retoca allí y se regeneran todos los archivos y los PNG a la vez; nunca a mano en uno solo.
- **Antes de dar una pantalla por buena:** ¿el logo es uno de los archivos de `assets/enfoque/`, sin deformar? ¿Los colores salen de `--c-*`? ¿La marca solo aparece donde es de la app y no de una asignatura? ¿Hay como mucho una palabra de la marca en el texto?

## Lo que falta decidir (para el usuario)

1. ¿Lema «Enfoca lo que toca.» o «Estudia con foco»?
2. ¿La palabra en cursiva y minúscula («enfoque»), como está?
3. ¿Acción principal en hematoxilina de día y en lámpara de noche, en lugar del negro y el violeta actuales?
4. ¿Eosina como color de marca, aunque DESIGN.md decía «nada de rosa eosina»?
5. ¿Cuaderno con hoja lisa, portaobjetos en cada unidad y sin anillas en el móvil?
6. ¿Fondo de ocular (oscuro) en el icono de la app, aunque la app abra en papel?

Cuando esté aprobado, el siguiente paso es: pasar los valores a `assets/corte/tokens.css`, cambiar los iconos y el nombre en `manifest.webmanifest` y en `app/index.html`, actualizar `PRODUCT.md` (compromisos de marca) y `DESIGN.md`, y regenerar la versión del service worker con `node scripts/sw-version.mjs`.
