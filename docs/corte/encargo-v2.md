# Encargo v2: «Corte · fluorescencia» — rediseño total de «Mi carrera TSAPC» a app de estudio de nivel Awwwards

Versión 2 (2026-11-02). Sustituye la visión, el sistema visual, las reglas de marca y la arquitectura del encargo v1 (`encargo-rediseno-tsapc.md`).
Del v1 se mantienen: el punto de partida, los problemas confirmados, la sección «Estudiar mejor», las reglas de seguridad de datos y la forma de cerrar cada fase.
Los entregables de cada agente están en `~/.claude/design/corte/v2/`.

## Tu papel
Eres director de producto y de diseño. Coordinas a los agentes y skills de cada fase, decides cuando discrepan y respondes del resultado.

**Ambición:** nadie debe confundir Corte con la web anterior ni con otra app de estudio. Si una pantalla queda correcta pero austera, no está terminada.

No das nada por hecho. Cada cambio se comprueba en el navegador:
- a 360, 390 y 1280 px;
- en tema oscuro y claro;
- con y sin conexión;
- con `prefers-reduced-motion`.

## Qué cambió respecto al v1 y por qué
- El usuario rechazó la paleta de dos tintes (eosina, hematoxilina y parafina) por sosa.
- Pide colores modernos, tecnológicos y creativos, un color por asignatura y un diseño distinto en cada unidad, nunca igual.
- Añade una **Agenda** con el calendario de la carrera y el horario, muy creativa, animada e interactiva.

## Visión: el laboratorio de fluorescencia
Corte deja la histología clásica y se convierte en un **microscopio de fluorescencia y confocal**. Fondo casi negro, canales de luz pura, escáner láser, enfoque y superposición de canales. Es el laboratorio más tecnológico que hay, y es real en TSAPC: inmunofluorescencia, FISH y citometría.

- **Nombre:** Corte. **Firma:** «corte · 4 µm».
- **Metáforas:**
  - **Asignatura = canal de fluorescencia.** Cada una tiene su color de emisión.
  - **Unidad = espécimen.** Cada unidad tiene una imagen generativa propia, sacada de su temario.
  - **Navegar = enfocar.** Cada pantalla pasa de desenfocada a nítida.
  - **Progreso = encender.** Las zonas del espécimen se iluminan al dominar los bloques. Lo que lleva tiempo sin repasarse sufre **fotoblanqueo** (se apaga poco a poco y nunca se borra).
  - **Semana = gel de electroforesis.** Cada clase, examen o entrega es una banda.
  - **Mes = placa de 96 pocillos.**
  - **«Ahora» = línea del láser confocal.**
- **Tono:** técnica veterana de laboratorio. Precisa, breve y cálida, con vocabulario real. Nunca infantil ni culpabilizadora.

## Sistema visual (cerrado por design-brand-guardian; detalle en `corte/v2/marca-v2.md`, tokens en `corte/v2/tokens.css`)
- **Canales por asignatura.** Contraste AA verificado por script en los dos temas:

  | Asignatura | Emisión | Texto en oscuro | Texto en claro |
  |---|---|---|---|
  | Fisiopatología | #FF6CB2 | #FF6CB2 | #BC2277 |
  | IPE | #EE4C3E | #F75546 | #BA0C09 |
  | Biología Molecular | #9D63FD | #A472FF | #7D48D0 |
  | Gestión de Muestras | #FC9D08 | #FC9D08 | #945A03 |
  | Inglés | #62AEF6 | #62AEF6 | #045D9F |
  | Laboratorio | #3AFFB8 | #3AFFB8 | #066F4D |
  | Sostenibilidad | #D9FA29 | #D9FA29 | #4A5702 |

  Cada canal tiene además un tono «tenue» y un tono «sobre». Todos en OKLCH, con hex de respaldo.
- **Acción de la interfaz:** luz blanca, #F4F4FD en oscuro y #19182A en claro.
- **Estados:** acierto en cian #54E2E9; aviso y error en salmón apagado #EDB5A2. Nunca rojo.
- **Temas:** «campo oscuro» es el estrella; «campo claro» va con los mismos canales oscurecidos. El tema por defecto sigue al del sistema.
- **Daltonismo:** en claro, 9 parejas de canales se confunden. Por eso cada asignatura lleva siempre su sigla, una forma y, en las bandas anchas, un patrón. Hay que probarlo con una persona daltónica antes de la Fase 8.
- **Merge:** se usa `screen` en oscuro y `multiply` en claro, solo en las capas de imagen; el texto va siempre en capa sólida. El glow va desplazado y difuminado (≤0,35 en elementos, ≤0,25 detrás de texto), con una sola fuente por pantalla y sin latidos en bucle.
- **Tipografía:** 82,5 KB en woff2 para el subconjunto latino, autoalojada.
  - Mona Sans: titulares.
  - Atkinson Hyperlegible Next: texto.
  - Martian Mono: cifras, horas, códigos, la firma y la «µ», porque Mona Sans y Atkinson no tienen ese carácter (hay que comprobarlo en Safari de iPhone).
- **Iconos:** trazo de 1,5 px dibujado a partir de instrumentos. **Texturas:** ruido de sensor, viñeta de óculo y retícula de escala, en CSS o SVG.
- **Racha:** la «pila Z» confocal. Cada día de estudio añade un plano y cuenta el total, no los días seguidos. Una pausa detiene la pila, pero no borra nada.
- **Reglas de marca:**
  1. Un canal es una asignatura y nada más.
  2. Una acción principal por pantalla: en luz blanca en las pantallas generales y en el canal de la asignatura dentro de una unidad.
  3. El color nunca va solo: cada canal lleva sigla y forma, y cada estado, icono y texto. AA y 44 px.
  4. La luz se gana y no deslumbra.
  5. Tres tipografías con un papel fijo cada una.
  6. Todo movimiento es un gesto de microscopio (escanear, enfocar, migrar, excitar o blanquear). Solo transform, opacity, filter y clip-path. Hasta 400 ms en las microinteracciones, 450 ms en el cambio de página y 900 ms en la entrada de una unidad (una vez por sesión). La nota del simulacro sube en 800 ms y se salta con un toque.
  7. Doce especímenes, un solo sistema. El espécimen es una ilustración y lo dice. Las imágenes reales indican tinción, aumento y fuente.
  8. Voz de técnica veterana en un laboratorio de fluorescencia.

## Un diseño por unidad (cerrado por design-visual-storyteller; detalle en `corte/v2/especimenes.md`)
- Cada unidad tiene su **espécimen generativo** (SVG, canvas 2D o WebGL ligero), con semilla estable, menos de 15 KB de JS, 60 fps y pausa fuera de pantalla.
- Cada unidad cambia: espécimen, canal, composición de cabecera (a sangre, en óculo, en tira o en rejilla), animación de entrada, reposo, gesto con el dedo y un rasgo propio en la lista de bloques.
- Todas comparten: navegación, componentes, tipografía, espaciado y accesibilidad.
- Ejemplos:
  - fisio2: mosaico epitelial con núcleos.
  - bio3: doble hélice que se replica.
  - bio2: cariotipo con sondas FISH.
  - bio1: cámara de Neubauer.
  - lab1: gradilla.
  - ingles1: onda de voz.
  - ipe-tema5: trazo de ECG.
- Plantilla para las unidades de 2.º y de Sostenibilidad.

### Especímenes de las 12 unidades
| Unidad | Espécimen | Cabecera | Gesto |
|---|---|---|---|
| fisio1 | Célula en confocal, con zoom por niveles | Óculo circular | Pellizcar para cambiar de objetivo |
| fisio2 | Mosaico Voronoi de los 13 tejidos (tipo TMA) | A sangre | Lupa ×40 |
| fisio3 | Time-lapse de lesión → necrosis → reparación | Tira de fotogramas | Arrastrar en el tiempo |
| bio1 | Cámara de Neubauer con el cultivo hasta confluencia | Rejilla 3×3 | Tocar para contar |
| bio2 | De la metafase al cariotipo con FISH | Díptico | Emparejar cromosomas |
| bio3 | Doble hélice que se replica | Raíl vertical ligado al scroll | Abrir la horquilla |
| lab1 | Gradilla de 7 tubos | Zócalo | Inclinar el móvil para mover el menisco |
| gest1 | Red vascular = organización del SNS | Diagonal | Pulso de derivación |
| gest2 | Citometría TSLCB frente a TSAPC | Gráfico de ejes | Dibujar un gate |
| ipe2 | Espectro de exposición | Banda espectral | Cursor dosímetro |
| ipe-tema5 | ECG en monitor | Monitor de barrido | Entrenador de compresiones a 100–120/min |
| ingles1 | Los tiempos verbales como ondas | Tipográfica | Mantener pulsado para escuchar |

- **Motor común (unos 4 KB):** semilla por carpeta, pausa fuera de pantalla, fotoblanqueo con τ = 7 días, chip de casete, barra de escala y entrada «enfoque».
- **Pendiente para la Fase 7:** el repaso de fisio1 está organizado en 6 entregas y no en bloques. Hay que ordenar esa estructura antes de migrarlo.

### Decisiones de arquitectura tomadas por el director
- Varias páginas con View Transitions. Se conservan las URL actuales y se añaden `/agenda/`, `/errores/`, `/mesa/`, `/{unidad}/` y `/{unidad}/tarjetas/`.
- Riel compacto desde 768 px y ampliado desde 1200 px.
- El gel es una cuadrícula ARIA con alternativa en lista. La semana cambia con scroll-snap nativo y las bandas se animan con GSAP. Con movimiento reducido el gel se queda quieto y la lista está a un toque.
- La placa de 96 pocillos son 12 semanas × (7 días + 1 pocillo de control).
- Hoy:
  - Manda el examen más cercano dentro de los 14 días siguientes.
  - Una entrega que vence en menos de 2 h pasa por delante.
  - Si no hay ninguno de los dos, manda el último punto donde se quedó la estudiante.
- Tarjetas y Simulacro van en modo foco.
- Cada estudiante puede corregir el horario en su móvil sin cambiar el compartido.
- La Fase 3 se divide en 3a (pantallas) y 3b (Agenda).
- Validador propio del JSON, el mismo en el navegador y en Node. Un evento mal escrito se descarta solo; si el archivo entero falla, se usa la última copia válida.

## Arquitectura (cerrada por design-ux-architect; detalle en `corte/v2/arquitectura-v2.md`)
- **Navegación:**
  - En el móvil, barra inferior: **Hoy · Agenda · Asignaturas · Errores · Mi mesa**.
  - En escritorio, un riel lateral.
  - El Simulacro va en modo foco, sin barra.
- **Hoy:**
  - La acción principal la decide el examen más cercano; si no hay ninguno, el último punto donde se quedó la estudiante.
  - Debajo: falladas, simulacro rápido, la semana en pequeño con lo siguiente y la racha.
- **Agenda:**
  - Cuenta atrás en un display de instrumento.
  - Semana como gel de 7 carriles, con bandas por asignatura colocadas por hora: los exámenes, gruesos; las entregas, finos.
  - Día como línea de tiempo con el láser de «ahora».
  - Mes como placa de 96 pocillos.
  - Entregas que se marcan como hechas y se pueden deshacer.
  - Exámenes con «Preparar» enlazado a su unidad.
  - Exportación .ics.
  - Estados: sin horario, semana libre y fecha pasada.
  - Alternativa en lista y uso completo con teclado.
- **Mi mesa:** el apartado personal en cada móvil, sin cuentas. Incluye nombre para el saludo, progreso por unidad, colección de especímenes dominados, entregas, fechas propias, copia de seguridad y ajustes (tema, sonido, movimiento).
- **Datos:**
  - `datos/agenda.json`, compartido por la clase y editado por el dueño: curso, horario, eventos y asignaturas con su canal.
  - Lo personal va en `tsapc:v2` y gana sobre lo compartido sin modificarlo.
  - Todo lo demás del v1 se mantiene: ids estables, migración sin borrar, `persist()` y copia completa.
- **CSS sin build:**
  - Capas `@layer`.
  - `[data-subject]` con `oklch(from var(--canal) …)` y `[data-unit]` para la cabecera.
  - `light-dark()` y `@container`.
  - Módulo de espécimen cargado con `import()` diferido.

## Movimiento e interacción (cerrado por whimsy-injector; fichas en `corte/v2/interacciones.md`)
GSAP 3 (ScrollTrigger, SplitText, Flip, Draggable, MorphSVG) y View Transitions. Como mínimo:
1. **Cambio de página:** el espécimen crece hasta ser la cabecera, y el canal de color se transforma en el de la asignatura destino.
2. **Entrar en foco:** de desenfocado a nítido en cada pantalla.
3. **Acierto:** destello de excitación desde el punto tocado.
4. **Fallo:** desenfoque y la correcta entra en foco, con «Vuelve en 2 tarjetas». Sin rojo chillón.
5. **Tarjetas:** se arrastran, se giran y la respuesta se enfoca, siempre con botón alternativo.
6. **Agenda:**
   - El gel se arrastra con inercia entre semanas.
   - Las bandas migran al cambiar de semana.
   - El día entra en foco.
   - El láser de «ahora» avanza en vivo.
   - Una entrega hecha se monta bajo un cubreobjetos.
   - Un pocillo de la placa se abre con Flip.
7. **Progreso:** zonas del espécimen que se encienden y fotoblanqueo.
8. **Corrección del simulacro:** la nota sube contando.
9. **Pulsación larga en un término:** lupa con su etimología.
10. **Merge:** las asignaturas de la semana se superponen como canales en Hoy.

Además:
- Sonido opcional, apagado por defecto, sintetizado con Web Audio.
- Háptica con alternativa en iPhone.
- Estados con personalidad: vacío, sin conexión, error, nueva versión, primer uso y racha sin culpa.
- **Límites:**
  - Solo transform, opacity, filter y clip-path.
  - Menos de 400 ms en las microinteracciones y hasta 600 ms en el cambio de página y la entrada de la unidad.
  - Con reduced-motion, fundidos de 150 ms.
  - En modo examen, nada de animación.
  - Nada de confeti, monedas ni rankings.

## Portada y extras
Como en el v1, adaptado al nuevo mundo:
- **Portada:** un microscopio virtual con los 12 especímenes en una platina que se arrastra, aumento al pellizcar (4x/10x/40x) y canales que se encienden según lo dominado. Three.js diferido; alternativa en SVG.
- **Vídeo HyperFrames de bienvenida** «Viaje de una muestra», con audio local gratuito.
- **Mapa Graphify** del temario, con los nodos en el color de su asignatura.

## Fases, equipo y entregables (una fase por sesión; commit local al final de cada una)
| Fase | Qué | Agentes y skills |
|---|---|---|
| 0. Dirección v2 | Marca fluorescente, especímenes, arquitectura con Agenda, interacciones y **maqueta interactiva** de Hoy, Agenda, Unidad (3 unidades distintas: fisio2, bio2 e ipe-tema5) y Simulacro para aprobar | design-brand-guardian, design-visual-storyteller, design-ux-architect, whimsy-injector, **constructor-web** (maqueta), **auditor-diseno** y ui-finish-gate-reviewer (revisión) |
| 1. Cimientos de datos | store.js, migración, ids estables, `agenda.json` + esquema, sw.js nuevo, copia completa, `persist()` | design-ux-architect, everything-claude-code:architect, frontend-developer, everything-claude-code:tdd-guide, everything-claude-code:security-reviewer |
| 2. Sistema de diseño | Tokens por canal, capas, fuentes locales, componentes, iconos, texturas, motor de especímenes | ui-designer, skill hue, constructor-web, impeccable |
| 3. Pantallas y navegación | Hoy, Agenda, Asignaturas, Unidad, Errores, Mi mesa, barra y riel, View Transitions | constructor-web, design-ux-architect |
| 4. Estudiar mejor | quiz.js, SM-2, mazo de errores, modo examen | frontend-developer, design-ux-researcher |
| 5. Movimiento | Todas las interacciones y los estados | design-visual-storyteller, whimsy-injector, skills emil-design-eng, find-animation-opportunities, animate, animation-performance, review-animations, break-ui |
| 6. Portada y extras | Microscopio 3D con alternativa SVG, vídeo HyperFrames, mapa Graphify | constructor-web, skills hyperframes y graphify |
| 7. Migrar unidades | Una por una, cada una con su espécimen propio, sin tocar el contenido, con prueba visual antes y después y el progreso intacto | constructor-web + frontend-developer (con pro-workflow:parallel-worktrees si conviene) |
| 8. Cierre | Revisión contra la dirección aprobada, Lighthouse, extremo a extremo, DESIGN.md | ui-finish-gate-reviewer, impeccable-finish-reviewer, auditor-diseno, design-persona-walkthrough, code-reviewer, pro-workflow:reviewer, e2e-runner, impeccable-documenter |

En cada fase se dice qué agente se usó y para qué. Si dos se solapan, se elige uno y se explica por qué.

## Reglas
- Nada de pago. Si algo lo pide, se para y se avisa del coste. Nada de componentes Premium de Skiper UI.
- Sin push ni publicación sin confirmación.
- No tocar el contenido académico.
- No perder ni un dato de progreso. Antes de migrar, exportar los datos reales y comprobar que se importan.
- Preguntar antes de lo irreversible.
- Aprobaciones: maqueta v2 de la Fase 0, sistema de diseño de la Fase 2 y portada de la Fase 6.
- Fechas, horario y calendario: solo los que dé el usuario. Lo que falte se marca como «ejemplo» o como estado vacío.

## Criterios de aceptación
- Lighthouse en móvil: Rendimiento ≥ 90, Accesibilidad ≥ 95, Buenas prácticas ≥ 95.
- Hoy en menos de 1,5 s en 4G. JS inicial de la portada < 150 KB sin el 3D. Cada espécimen < 15 KB y 60 fps en un móvil medio.
- Sin desbordes a 360 px. AA en los dos temas. Los 7 canales se distinguen con daltonismo gracias a una señal no cromática.
- Funciona sin conexión tras la primera visita, imágenes incluidas.
- 0 datos perdidos en la migración, probado con una copia real.
- Las 12 unidades se ven distintas entre sí y, a la vez, como una sola app. Nadie la confundiría con la web anterior.

## Datos del usuario
- Semana del 3 al 6 nov 2026: en `docs/corte/fase-0-direccion.md`.
- Exámenes de esta semana (confirmado por el usuario el 2026-11-02):
  - Bio (4 nov): Tema 3 · Citogenética y análisis cromosómico (bio2, B-02).
  - Lab (5 nov): el último tema de Lab. Su PowerPoint o PDF aún no está en la web.
  - Speaking de Inglés (6 nov): sin unidad asociada.
- Falta: el horario semanal, el calendario del curso y el material del último tema de Lab.
