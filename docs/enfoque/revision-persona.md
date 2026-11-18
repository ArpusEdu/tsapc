# Recorrido como estudiante nueva (design-persona-walkthrough, 2026-11-17)

Simulación cualitativa a 390×844, con el almacenamiento vacío y `?hoy=2026-11-13/14`. Capturas en el scratchpad (`persona/`). Veredicto: **«Sí volvería, pero por los pelos»**. Funciona: la llegada, «Lo siguiente» en Hoy, la sesión de estudio (lo mejor), el cierre del rato A, el apartado del examen y las preguntas para clase dentro del repaso.

## Pendiente de arreglar
| Prioridad | Dónde | Qué pasa | Arreglo |
|---|---|---|---|
| **Bloqueante** | Repaso de hoy (`#/sesion/repaso`) | No hay salida ni barra | El mismo «Salir (se guarda)» que tiene la sesión |
| **Bloqueante** | Sesión, «Úsalo» | Después de contestar no aparece ningún botón; la condición está arriba y en letra pequeña | Mostrar «Siguiente concepto» desactivado con el motivo, o poner el «¿Por qué?» después de «Úsalo» |
| Importante | Nota del examen | Se ve «confirmado por el usuario el 2026-11-13..» | Limpiar la `nota` de `agenda-2026-27.json:432` |
| Importante | Hoy, plan y examen | Tres cifras de tiempo distintas (36, 52 y 76 min) | Una sola cifra, la misma en las tres pantallas |
| Importante | «Tengo 10 min» | Propone un rato de 13 min | Solo lo que cabe |
| Importante | Unidad, «Lo que entra» | Enumera los 6 bloques; al examen entran el 5 y el 6 | Cambiar a «Lo que trae la unidad» y marcar lo que entra al examen |
| Importante | Guía | Diez pasos por varias pantallas | Tres pasos en Hoy; el resto, como pistas la primera vez |
| Importante | Fin de sesión y unidad | Sale 0/3 y «Repaso dominado 0/26» justo después de estudiar | «Vuelve mañana», sin el 0; contar las sesiones |
| Importante | Nombres | Se mezclan IPE I, IPE 1, IPE 4 y Tema 4 | Un solo nombre: «IPE · Tema 4» |
| Importante | Barra en Pomodoro y examen | Se queda marcado «Hoy» | Marcar la sección correcta o poner «‹ Hoy» |
| Pulido | Misterio | Pregunta por la apuesta sin haber apostado | Ocultar esa pregunta |
| Pulido | Rato B | Puntúas y además marcas: dos evaluaciones | Dejar solo las casillas |
| Pulido | Sesión | «Fallar al principio…» sale dos veces; «agotada» da por hecho el género | Quitar la repetición y usar un texto sin género |
| Pulido | Unidad | «B5» dos veces; «valery» en minúscula | Numerar bien y poner «Valery» |
| Pulido | Repaso de unidad | 55 min frente a 20+25; los filtros antes del contenido | Usar los minutos de las sesiones y plegar los filtros |
| Pulido | Pomodoro | 25 min por defecto aunque vengas de una sesión | 10 min si viene de una sesión |
| Pulido | Copia | «3 claves»; el archivo se llama `tsapc-copia` | «Copia guardada en Descargas (enfoque-copia-…)» |
| Pulido | Tarjeta del plan | Fondo azul con borde marrón discontinuo, parece un error | Estilo de tarjeta normal |
| Pulido | Centro 3D | Empieza en la Ventana; el chip sale cortado; no se ve cómo salir | Empezar en la sala del próximo examen y poner «‹ Hoy» |

# Control final de la Fase 8 (ui-finish-gate-reviewer, 2026-11-17) · veredicto: no listo
Cumple: Lighthouse de la app 91-97/100/100, repasos 96, sin desbordes, contraste AA (axe), sin conexión, accesibilidad 100.
| # | Gravedad | Fallo | Arreglo |
|---|---|---|---|
| 1 | **Crítico** | `app/sesion.js` › `cargar()`: tras un error vuelve a pedir el archivo sin parar, unas 140 peticiones por segundo, y se queda en «Preparando la sesión» | No volver a pedir tras `"error"`; botón «Reintentar»; prueba que cuente peticiones; lo mismo en `bancoDe` |
| 2 | Alto | Centro 3D: Lighthouse 41 (TBT 4,75 s); en 2D, 81 | Three/GSAP tras la primera pintura o al tocar; 2D por defecto con `pointer:coarse`; `h1` del modo 2D en el HTML; Open-Meteo después de `load` |
| 3 | Alto | `bio2/simulacro` con el diseño antiguo (Syne, Google Fonts, emojis, lavanda) | Migrarlo como los demás, sin tocar las preguntas |
| 4 | Medio | `resumenHoy` dice «Martes 15, examen» (es diciembre) el día del examen | Usar el mismo examen que la tarjeta; «Hoy toca examen.»; el mes si quedan más de 7 días |
| 5 | Medio | Centro a 360 px: «Ver sin 3D» en tres líneas y la cuenta atrás cortada | `nowrap` y relleno; la cuenta atrás en otra fila por debajo de 400 px |
| 6 | Bajo | La tarjeta del cielo dice «Despejado» antes de que llegue el tiempo | «Mirando el cielo…» hasta que llegue |
| 7 | Bajo | Avisos `region` y `landmark` en la agenda (`#pestanas`), el simulacro y el centro | Meter esos elementos en `main`, `nav` o `header` |
| 8 | Bajo | Los 14 `<script>` de `app/index.html` sin `defer` | `defer` manteniendo el orden; `preload` de `app.js` |
