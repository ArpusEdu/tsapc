# Corte · Fase 0: dirección

Fecha: 2026-11-02. Encargo completo en `~/.claude/design/encargo-rediseno-tsapc.md`.
Capturas del «antes», marca completa y scripts de medida en `~/.claude/design/corte/` (fuera del repo).
Maqueta para aprobar: https://claude.ai/artifact/HVaafbwWbAnRSdL4qRFk2A (Hoy, Unidad y Simulacro a 390 px, claro y oscuro).

## Lo que dice el «antes»

Auditoría (auditor-diseno), a 375 px:

- La portada pesa 934 KB. Three.js (651 KB) y GSAP (115 KB) se cargan de un CDN sin `defer`, así que sin internet no hay 3D.
- Google Fonts bloquea el renderizado en todas las páginas. Hay 6 familias según la página.
- Los repasos llevan el CSS y el JS dentro del HTML: fisio2/repaso pesa 328 KB.
- Hay controles de menos de 44 px: 56 en vocabulario y 57 en test-50. En los repasos, los chips y las etiquetas miden 40 px.
- Cada unidad tiene su propia tipografía y usa emoji como iconos. Parece una colección de apuntes.
- No hay navegación fija en el móvil. Solo la portada tiene `main`, y fisio2/repaso tiene dos `h1`.
- Sin desbordes a 375 px. El tema oscuro cumple el contraste. Solo falla un par: blanco sobre #B07A00 en bio1/repaso, con 3,73:1.

Recorrido de una estudiante la semana del examen de Fisio 2, con 20 minutos (design-persona-walkthrough):

1. La portada le manda a otra unidad, porque la fecha de fisio2 ya pasó.
2. La nota del simulacro cuenta como fallo lo que no ha contestado: 3 de 3 bien se convierte en un 0,8. Además, no avisa antes de corregir.
3. «Repetir esta parte» borra todas las respuestas, no solo las falladas.
4. El progreso no sale de la página. La portada sigue al 0 % después de estudiar.
5. Todo es demasiado largo para una sesión corta: 193 tarjetas y un simulacro de 9 partes sin versión rápida.

## Qué se conserva

Todo el contenido académico, en el orden de las diapositivas, incluidos los pies «diap. N» y los textos alternativos. También se conservan:

- Repaso, simulacro, tarjetas con «solo las que fallé», niveles de importancia, Leer / Ponte a prueba, vocabulario con voz y tests.
- Los PDF, la copia de seguridad, el modo sin conexión, la instalación como app y el tema claro/oscuro automático.

## Dirección

- Nombre: Corte, con la firma «corte · 4 µm».
- Superficie: app de estudio, en modo Operate de impeccable. El mundo del laboratorio aporta tipografía, paleta, densidad y un gesto propio. La navegación y los controles son los estándar de una app móvil.
- Gesto propio: **la tinción**. Cada bloque es un corte que pasa de parafina sin teñir (contorno discontinuo) a hematoxilina (repasado, con trama de núcleos) y a eosina (dominado, con marca). Aparece en la cinta del portaobjetos de Hoy, en el resumen de la Unidad y en la barra de progreso del Simulacro, que es la cinta del micrótomo.
- Fuentes: Fraunces, Atkinson Hyperlegible Next e IBM Plex Mono, como fija el encargo. Impeccable avisa de que Fraunces y Plex son elecciones muy repetidas; se mantienen porque las fija el encargo y porque el eje de peso de Fraunces sirve para animar la tinción.

### Paleta final (verificada con WCAG 2.x)

| Token | Claro | Oscuro |
|---|---|---|
| fondo / superficie | #F4EFE6 / #FFFCF6 | #0F0B1A / #1A1428 |
| texto / secundario | #1E1446 / #5A5168 | #F2EDF7 / #B3AAC2 |
| eosina (acción, dominado) | **#C43165** (antes #C93268, que daba 4,43 sobre el fondo) | #FF7AA5 |
| texto sobre eosina | #FFFFFF (5,28) | #0F0B1A (7,92) |
| hematoxilina (estructura, repasado) | **#5B3FA8** (nuevo, 6,74) | #B9A8FF (9,33) |
| acierto / aviso (solo texto) | #1F6E52 / #8A5A00 | #5FBF95 / #E0A84A |
| parafina sin teñir | relleno #D8CFBF + borde #8F8676 (3,14) | borde #6E6680 (3,58) |

Prohibido: texto #1E1446 sobre eosina (3,33) y blanco sobre #FF7AA5 (2,45). La hematoxilina y la eosina tienen casi la misma luminancia, así que cada estado se distingue también por su forma y por su texto.

### Casetes

Los códigos son estables y nunca se renumeran. Una unidad nueva, como las de 2.º, toma el siguiente número libre. El progreso se guarda por el id de la carpeta, no por el código.

| Casete | Carpeta | Unidad |
|---|---|---|
| B-01 | bio1 | Biología Molecular · Tema 2 · Cultivos celulares |
| B-02 | bio2 | Biología Molecular · Tema 3 · Citogenética |
| B-03 | bio3 | Biología Molecular · Tema 4 · Ácidos nucleicos |
| B-04 | fisio1 | Fisiopatología · Unidad 1 · Organización del cuerpo |
| B-05 | fisio2 | Fisiopatología · Unidad 2 · Tejidos y anatomía |
| B-06 | fisio3 | Fisiopatología · Unidad 3 · La patología |
| B-07 | lab1 | Técnicas Generales de Laboratorio · Unidad 1 |
| B-08 | gest1 | Gestión de Muestras · Tema 1 · Sector sanitario |
| B-09 | gest2 | Gestión de Muestras · Tema 2 · El laboratorio |
| B-10 | ipe2 | IPE 1 · Tema 3 · Riesgos ambientales |
| B-11 | ipe-tema5 | IPE 1 · Tema 5 · Primeros auxilios |
| B-12 | ingles1 | Inglés · Units 1-2 |

### Pantallas de la maqueta

- **Hoy:** una sola acción, «Continuar · bloque 4», sobre el portaobjetos de la unidad en curso, con el bloque actual enfocado. Debajo están «Repasar 12 falladas», que es el mazo común de tarjetas y simulacros, y «Simulacro rápido · 15 preguntas». Después vienen la racha como procesado (día 3 de 7, aclarado) y el examen con «Fecha por confirmar · Poner fecha».
- **Unidad:** el casete con el título, la tinción de los 13 bloques con su recuento en texto y «Seguir: bloque 4 · 10 tarjetas». El simulacro, las tarjetas y las falladas quedan a la vista, no dentro del índice. La lista de bloques sigue el orden de las diapositivas e indica dónde lo dejaste.
- **Simulacro:** el momento después de un fallo. La opción elegida se desenfoca con borde discontinuo y la correcta se tiñe de eosina. Debajo aparecen «Era la B. Vuelve en 2 tarjetas.», la explicación sacada del repaso y un enlace al bloque. La barra es la cinta del micrótomo y se ve el contador «Sin contestar». El simulacro no tiene barra inferior: es modo foco.
- **Mi mesa** (pestaña 5, antes «Progreso»): el apartado personal de cada estudiante en su propio móvil, sin cuentas. Incluye nombre o apodo para el saludo, progreso por unidad, caja de portas, fechas de examen, copia de seguridad y ajustes (sonido, tema).

## Ampliación: Agenda (calendario de la carrera y horario)

El prompt completo está en el encargo, en la sección «Ampliación del 2026-11-02: Agenda».

- **Barra inferior:** Hoy · Agenda · Asignaturas · Errores · Mi mesa. «Estudiar» deja de ser pestaña porque sus acciones ya están en Hoy y en Unidad.
- **Una sola fuente de fechas:** `datos/agenda.json`, compartida por toda la clase, con el curso, el horario, los exámenes y las entregas. Lo personal (entregadas, recordatorios) se guarda en el móvil de cada estudiante.
- **Pantalla Agenda:**
  - Cuenta atrás en vivo hasta lo siguiente.
  - La semana como cinta de 7 cortes, teñidos según la carga del día: eosina para examen y hematoxilina para entrega.
  - Detalle del día con las horas límite y una línea de «ahora».
  - Entregas que se marcan como entregadas y exámenes que enlazan a su unidad.
  - Vista del curso como gradilla de semanas.
  - Exportación .ics.
- **Hoy:** la acción principal elige la unidad con el examen más cercano. Debajo va la cinta de la semana con lo siguiente.
- **Maqueta:** pantallas «Agenda» y «Hoy · semana de exámenes», en claro y en oscuro.

### Semana del 3 al 6 de noviembre de 2026 (datos del usuario)

| Fecha | Hora límite | Asignatura | Actividad | Tipo |
|---|---|---|---|---|
| Martes 3 nov | 21:00 | Itinerario Personal para la Empleabilidad I | Ejercicios finales (con permiso de la profesora) | Entrega |
| Martes 3 nov | 23:59 (cierre: miércoles 4, 00:00) | Fisiopatología General | Infografía de enfermedad | Entrega |
| Miércoles 4 nov | Horario de clase | Biología Molecular | Examen | Examen |
| Jueves 5 nov | Horario de clase | Laboratorio | Examen | Examen |
| Jueves 5 nov | 21:00 | Sostenibilidad | Tarea (último día de clase con el profesor sustituto) | Entrega |
| Jueves 5 nov | 23:59 (cierre: viernes 6, 00:00) | Inglés | Project 1 | Entrega |
| Viernes 6 nov | Horario de clase | Inglés | Speaking | Examen oral |

Qué entra en cada examen (confirmado por el usuario):
- Bio: Tema 3, Citogenética y análisis cromosómico (bio2, B-02).
- Lab: el último tema, cuyo material aún no está en la web.
- Speaking: queda como está.

Faltan el horario semanal y el calendario del curso (inicio, fin, evaluaciones y festivos).

## Decisiones del usuario (2026-11-02)

- La usará el usuario y quizá toda la clase (unas 23 personas). Cada persona tendrá su apartado personal; el contenido de ese apartado lo decide el director.
- Móviles: iPhone y Android.
- Ahora solo hay 1.º; la app crecerá a 2.º más adelante.

## Pendiente de aprobar

1. La maqueta.
2. La duración de las animaciones. La regla de marca dice menos de 400 ms, pero el encargo pide 450 ms para el cambio de página y 500 ms para «entrar en foco». Propuesta: una excepción de hasta 500 ms solo para esas dos.
3. Cambiar «Progreso» por «Mi mesa» en la barra inferior.

## Antes de la Fase 1

La copia de seguridad actual no exporta todas las claves (index.html:208). Por eso, el primer paso de la Fase 1 es un exportador completo que no toque nada más. Con él, el usuario exporta sus datos reales desde el móvil y se comprueba la importación antes de migrar.
