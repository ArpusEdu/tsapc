# Ampliación «formas de estudiar»: qué existe, qué se amplía y qué es nuevo

Petición del usuario (2026-11-15): un entorno de estudio integral con varias metodologías sobre el mismo contenido, **manteniendo como predeterminado el formato actual** (asignaturas → unidades → temas). Regla del usuario: continuidad, no duplicación. Este documento cruza cada punto con lo que ya hay.

## 1. Organización de tareas y recordatorios
| Pedido | Estado | Qué falta |
|---|---|---|
| Entregas, exámenes, recordatorios que insisten | **Existe** (`app/plan.js` › `avisos`, sección Avisos de Hoy) | — |
| Plan hasta el examen, ritmo, sesiones de hoy | **Existe** (`planExamen`, tarjeta del examen) | — |
| Tiempo estimado por actividad, ordenado de menos a más, y total para ponerse al día | **Ampliar** `plan.js` | Estimación por actividad (minutos de sesiones, repaso de hoy, tarjetas vencidas; entregas sin tiempo → que el estudiante lo ponga) y orden por duración |
| La estimación se ajusta al ritmo real | **Ampliar** | Medir minutos reales por sesión |
| Organizar una sesión según el tiempo disponible | **Nuevo** (pequeño) | «Tengo 10 / 25 / 45 min»: arma una tanda con lo más urgente que quepa |
| Temas pendientes de estudiar | **Ampliar** | Lista por unidad de conceptos no vistos o flojos (SM-2 ya lo sabe) |

## 2. Formas de estudiar cada tema
Base que ya existe y sigue siendo la predeterminada: repaso de la profe (literal), sesión de estudio (misterio → descubre → sin mirar → resuelve → otros días), tarjetas, práctica, simulacro, errores.

| Modalidad | Estado | Plan |
|---|---|---|
| F. Activo y memorístico (flashcards, active recall, repetición espaciada, autoevaluación, simulacros) | **Existe en gran parte** (tarjetas SM-2, sin mirar, práctica, simulacros) | Tipos nuevos de pregunta: completar huecos, relacionar, verdadero/falso, sacados del texto de la profe |
| G. Explicaciones (Feynman, autoexplicación) | **Parcial** (sin mirar; bio3 «Explícalo») | Modo Feynman explícito, comparando con los puntos clave |
| E. Práctico (casos, aplicación) | **Parcial** (misterio, «Úsalo», casos de la profe) | Reunir casos por tema; identificación con imágenes del PDF |
| A. Visual (mapas, esquemas, tablas comparativas, procesos) | **Nuevo** | Mapa del tema generado de `contenido.json` (bloques → conceptos → definiciones) en SVG propio, con las conexiones de `conecta`; tablas comparativas desde «trampas» |
| B. Dibujo (sketchnoting, etiquetado) | **Nuevo** | Lienzo para dibujar en blanco o sobre las imágenes del PDF; etiquetar estructuras; se guarda en el dispositivo |
| C. Auditivo | **Nuevo** | Lectura en voz alta con la voz del móvil (`speechSynthesis`, gratis y sin conexión), con velocidad y resaltado |
| D. Lectura y escritura (Cornell, resúmenes, glosario) | **Parcial** (repaso = resumen; glosarios) | Plantilla Cornell para apuntes por tema; resumen simplificado solo con hechos del PDF |
| Vídeo | **Nuevo**, decisión pendiente | Ver punto 5 |

Presentación: en cada unidad o tema, una entrada «Otras formas de estudiar esto», no invasiva, que abre las modalidades con el contenido de ese tema. El formato actual se abre por defecto; la preferencia se guarda por tema y se puede deshacer.

## 3–4. Herramientas complementarias
| Pedido | Estado | Plan |
|---|---|---|
| Flashcards desde los PDF por unidad | **Existe** (`app/preguntas/<u>.json`) | Tarjetas propias del estudiante e imágenes |
| Repetición espaciada adaptativa | **Existe** (SM-2) | — |
| Pomodoro, historial, objetivos | **Nuevo** | Temporizador ligado a la sesión o libre; historial y tiempo efectivo en el dispositivo |
| Interleaving | **Existe** («Lo de otros días») | — |
| Dual coding, interrogación elaborativa | **Parcial** (gancho y «¿por qué?») | Encaja en el modo visual y en el Feynman |

## 5. Audiovisual (decide el usuario)
(a) vídeos propios con HyperFrames a partir del contenido: calidad alta, mucho trabajo, sin terceros. (b) enlaces a vídeos públicos por tema: rápido, pero de terceros y no siempre fieles al temario. (c) «clase narrada»: animación paso a paso en la página + voz del dispositivo: ligera, sin terceros, fiel al PDF. Recomendado: (c) para todo y (a) para los procesos clave.

## 6. Cuaderno digital
**Nuevo**: apuntes por tema (texto, dibujo, imágenes), anotación sobre los PDF (pdf.js local), guardado automático en el dispositivo y dentro de la copia de seguridad.

## 7. Recomendaciones
**Nuevo**, con datos que ya existen: fallos en tarjetas de definición → flashcards; conceptos en «otra» repetidos → mapa del tema; procesos → clase narrada; «Úsalo» flojo → casos.

## 8. Fuente: los PDF
Se mantiene la regla: lo de la profe es literal; lo generado usa solo hechos del PDF y enlaza a su diapositiva.

## Orden (después de identidad, llegada, tutorial y 3D, que están en curso)
1. Organizador ampliado (tiempos de menos a más, sesión según el tiempo disponible, temas pendientes) + Pomodoro.
2. «Otras formas de estudiar»: mapa del tema, lectura en voz alta, modo Feynman y los tipos de pregunta nuevos.
3. Cuaderno digital (Cornell, dibujo y etiquetado).
4. Clase narrada y vídeo.
5. Recomendaciones.
