/* Corte · datos de la app: asignaturas, unidades y la lectura de Bio 3. Única fuente para app/.
   Generado a partir de EX y PROG de index.html y de UNITS y FRANKLIN de la maqueta v4 (texto tal cual).
   Los profesores, el horario y el calendario vienen de docs/corte/agenda-2026-27.json (se cargan con fetch).
   En el navegador: window.CorteDatos. En Node: module.exports. */
(function (root, f) { var api = f(); if (typeof module === "object" && module.exports) module.exports = api; else root.CorteDatos = api; })(typeof self !== "undefined" ? self : this, function () {
var ORDEN_ASIG = ["bio","lab","fisio","gest","ipe","ing","digi","sost"];
var ASIGNATURAS = {
 "bio": {
  "nombre": "Biología Molecular",
  "completo": "Biología molecular y citogenética",
  "ab": "Bio",
  "pegatina": "adn"
 },
 "lab": {
  "nombre": "Laboratorio",
  "completo": "Técnicas generales de laboratorio",
  "ab": "Lab",
  "pegatina": "matraz"
 },
 "fisio": {
  "nombre": "Fisiopatología",
  "completo": "Fisiopatología general",
  "ab": "Fisio",
  "pegatina": "corazon"
 },
 "gest": {
  "nombre": "Gestión de Muestras",
  "completo": "Gestión de muestras biológicas",
  "ab": "Gest",
  "pegatina": "tubos"
 },
 "ipe": {
  "nombre": "IPE I",
  "completo": "Itinerario personal para la empleabilidad I",
  "ab": "IPE",
  "pegatina": "botiquin"
 },
 "ing": {
  "nombre": "Inglés",
  "completo": "Inglés profesional",
  "ab": "Ing",
  "pegatina": "hello"
 },
 "digi": {
  "nombre": "Digitalización",
  "completo": "Digitalización aplicada a los sectores productivos",
  "ab": "Digi",
  "pegatina": "pantalla"
 },
 "sost": {
  "nombre": "Sostenibilidad",
  "completo": "Sostenibilidad aplicada al sistema productivo",
  "ab": "Sost",
  "pegatina": "hoja"
 }
};
var UNIDADES = [
 {
  "id": "bio1",
  "s": "bio",
  "codigo": "Bio 1",
  "titulo": "Cultivos celulares",
  "examen": "1er examen",
  "tema": "Tema 2 · Cultivos celulares",
  "fecha": "2026-10-19",
  "pegatina": "petri",
  "repaso": {
   "web": "bio1/repaso/",
   "pdf": "files/BIO1_1-Repaso_Cultivos_19.oct.pdf"
  },
  "simulacro": {
   "web": "bio1/simulacro/",
   "pdf": "files/BIO1_2-Simulacro_Cultivos_19.oct.pdf"
  },
  "extra": [
   [
    "Neubauer y microscopio",
    "files/BIO1_4-Neubauer-Microscopio_Cultivos_19.oct.pdf"
   ],
   [
    "Lo imprescindible",
    "files/BIO1_3-Imprescindible_Cultivos_19.oct.pdf"
   ]
  ],
  "progreso": {
   "clave": "bio1-repaso-v1",
   "total": 32
  },
  "bloques": [
   "Qué es un cultivo celular y con qué se hace",
   "Tipos de cultivo",
   "Cultivo primario vs secundario",
   "Crecimiento y pase",
   "Líneas celulares",
   "Procedimientos del cultivo celular",
   "Contaminación y cuidados",
   "Aplicaciones"
  ]
 },
 {
  "id": "bio2",
  "s": "bio",
  "codigo": "Bio 2",
  "titulo": "Citogenética",
  "examen": "2º examen",
  "tema": "Tema 3 · Citogenética y análisis cromosómico",
  "fecha": null,
  "pegatina": "adn",
  "repaso": {
   "web": "bio2/repaso/",
   "pdf": "files/BIO2_1-Repaso_Citogenetica.pdf"
  },
  "simulacro": {
   "web": "bio2/simulacro/",
   "pdf": "files/BIO2_2-Simulacro_Citogenetica.pdf"
  },
  "extra": [
   [
    "Lo imprescindible",
    "files/BIO2_3-Imprescindible_Citogenetica.pdf"
   ],
   [
    "Verificación",
    "files/BIO2_5-Verificacion_Citogenetica.pdf"
   ]
  ],
  "progreso": {
   "clave": "bio2-repaso-v1",
   "total": 37
  },
  "bloques": [
   "El cromosoma",
   "Estructura del cromosoma",
   "Clasificación según el centrómero",
   "Número de cromosomas: diploide y haploide",
   "Obtención de extensiones cromosómicas (los 7 pasos)",
   "Casos prácticos de la profe",
   "Tinción y bandeo cromosómico",
   "Nomenclatura y locus",
   "Cómo resolver un cariotipo (ejercicio de la profe)"
  ]
 },
 {
  "id": "bio3",
  "s": "bio",
  "codigo": "Bio 3",
  "titulo": "Ácidos nucleicos",
  "examen": "3er examen",
  "tema": "Tema 4 · Ácidos nucleicos y enzimas asociadas",
  "fecha": null,
  "pegatina": "gel",
  "repaso": {
   "web": "bio3/repaso/"
  },
  "simulacro": {
   "web": "bio3/simulacro/"
  },
  "extra": [],
  "progreso": {
   "clave": "bio3-repaso-v1",
   "total": 40
  },
  "bloques": [
   "Qué son los ácidos nucleicos y los nucleótidos",
   "ADN: características y estructura primaria",
   "ADN: doble hélice y empaquetamiento",
   "ADN fuera del núcleo y en procariotas",
   "ARN: características y estructuras",
   "ARNm, ARNt y ARNr en detalle",
   "Flujo de la información y replicación",
   "Replicación: fase de iniciación",
   "Replicación: elongación y telómeros",
   "Transcripción",
   "Maduración del ARN"
  ]
 },
 {
  "id": "lab1",
  "s": "lab",
  "codigo": "Lab 1",
  "titulo": "Unidad 1",
  "examen": "1er examen",
  "tema": "Unidad 1",
  "fecha": "2026-10-22",
  "pegatina": "microscopio",
  "repaso": {
   "web": "lab1/repaso/",
   "pdf": "files/LAB1_1-Repaso_Unidad1_22.oct.pdf"
  },
  "simulacro": {
   "web": "lab1/banco/",
   "webt": "Banco completo (153 preguntas)",
   "pdf": "files/LAB1_2-Simulacro-Test_Unidad1_22.oct.pdf"
  },
  "extra": [
   [
    "Test de 50",
    "lab1/test-50/"
   ],
   [
    "Segundo test de 50",
    "lab1/test-50-b/"
   ],
   [
    "50 con respuestas",
    "files/LAB1_2-Simulacro-50-con-Respuestas_Unidad1_22.oct.pdf"
   ],
   [
    "Lo imprescindible",
    "files/LAB1_3-Imprescindible_Unidad1_22.oct.pdf"
   ]
  ],
  "progreso": {
   "clave": "lab1-repaso-v1",
   "total": 47
  },
  "bloques": [
   "Tipos de materiales y utilización",
   "Limpieza, desinfección y esterilización",
   "El agua del laboratorio",
   "Reactivos químicos",
   "Equipos básicos del laboratorio",
   "Uso eficiente de los recursos",
   "Procedimientos normalizados de trabajo (PNT)"
  ]
 },
 {
  "id": "lab2",
  "s": "lab",
  "codigo": "Lab 2",
  "titulo": "Seguridad",
  "examen": "2º examen",
  "tema": "Unidad 2 · Seguridad y prevención de riesgos en el laboratorio",
  "fecha": "2026-11-05",
  "pegatina": "gafas",
  "repaso": {
   "web": "lab2/repaso/"
  },
  "simulacro": {
   "web": "lab2/simulacro/"
  },
  "extra": [],
  "progreso": {
   "clave": "lab2-repaso-v1",
   "total": 51
  },
  "bloques": [
   "2.1 Medidas de prevención y protección personal",
   "2.2 Reactivos químicos, radiactivos y biológicos",
   "2.3 Prevención del riesgo con productos químicos, radiactivos y biológicos",
   "2.4 Prevención de riesgos de los equipos de laboratorio",
   "2.5 Gestión de residuos. Normativa vigente",
   "2.6 Protocolos ante emergencias, accidentes e incidentes"
  ]
 },
 {
  "id": "fisio1",
  "s": "fisio",
  "codigo": "Fisio 1",
  "titulo": "Organización del cuerpo",
  "examen": "1er examen",
  "tema": "Unidad 1 · La organización del cuerpo humano",
  "fecha": "2026-10-13",
  "pegatina": "torso",
  "repaso": {
   "web": "fisio1/repaso/",
   "pdf": "files/FISIO1_1-Repaso_Organizacion_13.oct.pdf"
  },
  "simulacro": {
   "web": "fisio1/simulacro/"
  },
  "extra": [
   [
    "Lo imprescindible",
    "files/FISIO1_3-Imprescindible_Organizacion_13.oct.pdf"
   ],
   [
    "Cómo estudiar",
    "files/FISIO1_4-Como-Estudiar_Organizacion_13.oct.pdf"
   ]
  ],
  "progreso": {
   "clave": "fisio1-repaso-v1",
   "total": 52
  },
  "porEntregas": true,
  "bloques": [
   "Niveles de organización y tipos de célula",
   "Matriz extracelular y membrana plasmática",
   "Citoplasma y orgánulos",
   "El núcleo",
   "Fisiología celular",
   "Reproducción celular"
  ]
 },
 {
  "id": "fisio2",
  "s": "fisio",
  "codigo": "Fisio 2",
  "titulo": "Tejidos",
  "examen": "2º examen",
  "tema": "Unidad 2 · Tejidos y anatomía",
  "fecha": "2026-10-28",
  "pegatina": "microscopio",
  "repaso": {
   "web": "fisio2/repaso/",
   "pdf": "files/FISIO2_1-Repaso_Tejidos_28.oct.pdf"
  },
  "simulacro": {
   "web": "fisio2/simulacro/",
   "pdf": "files/FISIO2_2-Simulacro_Tejidos_28.oct.pdf"
  },
  "extra": [
   [
    "Lo imprescindible",
    "files/FISIO2_3-Imprescindible_Tejidos_28.oct.pdf"
   ],
   [
    "Esquemas para rellenar",
    "files/FISIO2_4-Esquemas-Rellenar_Tejidos_28.oct.pdf"
   ],
   [
    "Verificación",
    "files/FISIO2_5-Verificacion_Tejidos_28.oct.pdf"
   ]
  ],
  "progreso": {
   "clave": "fisio2-repaso-v3",
   "total": 70
  },
  "bloques": [
   "Histología: conceptos base",
   "Tejido epitelial",
   "Epitelio glandular",
   "Tejido muscular",
   "Tejido nervioso",
   "Tejido conectivo: general y conjuntivo",
   "Tejido adiposo",
   "Tejido cartilaginoso",
   "Tejido óseo y el hueso",
   "Tejido sanguíneo",
   "Tejido hematopoyético",
   "Tejido linfático",
   "Anatomía"
  ]
 },
 {
  "id": "fisio3",
  "s": "fisio",
  "codigo": "Fisio 3",
  "titulo": "La patología",
  "examen": "3er examen",
  "tema": "Unidad 3 · La patología: estudio de la enfermedad",
  "fecha": null,
  "pegatina": "corazon",
  "repaso": {
   "web": "fisio3/repaso/",
   "pdf": "files/FISIO3_1-Repaso_Patologia.pdf"
  },
  "simulacro": {
   "web": "fisio3/simulacro/",
   "pdf": "files/FISIO3_2-Simulacro_Patologia.pdf"
  },
  "extra": [
   [
    "Lo imprescindible",
    "files/FISIO3_3-Imprescindible_Patologia.pdf"
   ],
   [
    "Verificación",
    "files/FISIO3_5-Verificacion_Patologia.pdf"
   ]
  ],
  "progreso": {
   "clave": "fisio3-repaso-v1",
   "total": 90
  },
  "bloques": [
   "Los procesos patológicos y los agentes patógenos",
   "Los factores patógenos",
   "La célula: salud y lesión",
   "Las respuestas celulares adaptativas",
   "Nivel anatómico: la necrosis tisular",
   "Las respuestas tisulares adaptativas",
   "Procesos patológicos fundamentales y reparación",
   "El estudio de los procesos patológicos",
   "La enfermedad y su clasificación",
   "El desarrollo de la enfermedad",
   "El diagnóstico de la enfermedad",
   "Diagnóstico por imagen y electrodiagnóstico",
   "El tratamiento de la enfermedad"
  ]
 },
 {
  "id": "gest1",
  "s": "gest",
  "codigo": "Gest 1",
  "titulo": "Sector sanitario",
  "examen": "1er examen",
  "tema": "Tema 1 · Estructura organizativa del sector sanitario",
  "fecha": "2026-10-15",
  "pegatina": "hospital",
  "repaso": {
   "web": "gest1/repaso/",
   "pdf": "files/GESTION1_1-Repaso_Sector-Sanitario_15.oct.pdf"
  },
  "simulacro": {
   "web": "gest1/simulacro/",
   "pdf": "files/GESTION1_2-Simulacro-Test_Sector-Sanitario_15.oct.pdf"
  },
  "extra": [
   [
    "Lo imprescindible",
    "files/GESTION1_3-Imprescindible_Sector-Sanitario_15.oct.pdf"
   ]
  ],
  "progreso": {
   "clave": "gest1-repaso-v1",
   "total": 75
  },
  "bloques": [
   "Sistema sanitario y salud",
   "Determinantes de la salud",
   "Qué hace un sistema sanitario y cómo se organiza",
   "Modelos sanitarios",
   "El Sistema Nacional de Salud (SNS) en España",
   "Organización asistencial y cartera de servicios",
   "Deontología y bioética",
   "Ley de Ordenación de las Profesiones Sanitarias (LOPS)",
   "Economía de la salud y sostenibilidad",
   "Calidad asistencial y evaluación"
  ]
 },
 {
  "id": "gest2",
  "s": "gest",
  "codigo": "Gest 2",
  "titulo": "El laboratorio",
  "examen": "2º examen",
  "tema": "Tema 2 · Funciones, áreas y organización del laboratorio",
  "fecha": null,
  "pegatina": "tubos",
  "repaso": {
   "web": "gest2/repaso/",
   "pdf": "files/GESTION2_1-Repaso_Laboratorio.pdf"
  },
  "simulacro": {
   "web": "gest2/simulacro/",
   "pdf": "files/GESTION2_2-Simulacro-Test_Laboratorio.pdf"
  },
  "extra": [
   [
    "Lo imprescindible",
    "files/GESTION2_3-Imprescindible_Laboratorio.pdf"
   ],
   [
    "Verificación",
    "files/GESTION2_5-Verificacion_Laboratorio.pdf"
   ]
  ],
  "progreso": {
   "clave": "gest2-repaso-v1",
   "total": 31
  },
  "bloques": [
   "TSLCB: qué hace y para qué",
   "TSLCB: funciones profesionales, personales y sociales",
   "TSLCB: áreas, puestos y ambiente profesional",
   "TSLCB: objetivos",
   "TSAPC (tu título): funciones",
   "TSAPC: áreas, puestos, ambiente y calidad",
   "TSAPC: objetivos (4 grupos)"
  ]
 },
 {
  "id": "ipe2",
  "s": "ipe",
  "codigo": "IPE 2",
  "titulo": "Riesgos ambientales",
  "examen": "2º examen",
  "tema": "Tema 3 · Riesgos ambientales en el trabajo",
  "fecha": "2026-10-13",
  "pegatina": "sonometro",
  "repaso": {
   "web": "ipe2/repaso/",
   "pdf": "files/IPE2_1-Repaso_Riesgos-Ambientales.pdf"
  },
  "simulacro": {
   "web": "ipe2/simulacro/",
   "pdf": "files/IPE2_2-Simulacro-Tipo-Examen_Riesgos-Ambientales.pdf"
  },
  "extra": [
   [
    "Simulacro test",
    "files/IPE2_2-Simulacro-Test_Riesgos-Ambientales.pdf"
   ],
   [
    "Simulacro rápido",
    "files/IPE2_2-Simulacro-Rapido_Riesgos-Ambientales.pdf"
   ],
   [
    "Lo imprescindible",
    "files/IPE2_3-Imprescindible_Riesgos-Ambientales.pdf"
   ]
  ],
  "progreso": {
   "clave": "ipe2-repaso-v1",
   "total": 29
  },
  "bloques": [
   "Riesgos físicos: introducción",
   "El ruido",
   "Las vibraciones mecánicas",
   "El ambiente térmico",
   "Las radiaciones electromagnéticas",
   "Los riesgos químicos",
   "Los riesgos biológicos"
  ]
 },
 {
  "id": "ipe-tema5",
  "s": "ipe",
  "codigo": "IPE 5",
  "titulo": "Primeros auxilios",
  "examen": "Tema 5",
  "tema": "Los primeros auxilios en la empresa",
  "fecha": null,
  "pegatina": "botiquin",
  "repaso": {
   "web": "ipe-tema5/repaso/",
   "pdf": "files/IPE3_1-Repaso_Primeros-Auxilios.pdf"
  },
  "simulacro": {
   "web": "ipe-tema5/simulacro/"
  },
  "extra": [
   [
    "Lo imprescindible",
    "files/IPE3_3-Imprescindible_Primeros-Auxilios.pdf"
   ],
   [
    "Verificación",
    "files/IPE3_5-Verificacion_Primeros-Auxilios.pdf"
   ]
  ],
  "progreso": {
   "clave": "ipe5-repaso-v1",
   "total": 35
  },
  "bloques": [
   "Los primeros auxilios",
   "El triaje",
   "El botiquín de primeros auxilios",
   "El soporte vital básico",
   "La actuación ante atragantamientos",
   "Las hemorragias",
   "Las quemaduras",
   "Los traumatismos",
   "Las heridas",
   "La pérdida de consciencia"
  ]
 },
 {
  "id": "ingles1",
  "s": "ing",
  "codigo": "Inglés 1",
  "titulo": "Units 1-2 · Verbs and Present",
  "examen": "1er examen",
  "tema": "Unit 1 verbos · Unit 2 presentes · vocabulario de laboratorio",
  "fecha": "2026-10-23",
  "pegatina": "hello",
  "repaso": {
   "web": "ingles1/repaso/",
   "pdf": "files/INGLES1_1-Repaso_Tiempos.pdf"
  },
  "simulacro": {
   "web": "ingles1/simulacro/",
   "pdf": "files/INGLES1_2-Simulacro_Tiempos.pdf"
  },
  "extra": [
   [
    "Aprende las 50 palabras",
    "ingles1/vocabulario/"
   ],
   [
    "Examen Units 1–2",
    "ingles1/examen/"
   ],
   [
    "Examen de vocabulario",
    "ingles1/examen-vocabulario/"
   ],
   [
    "Simulacro de vocabulario",
    "ingles1/simulacro-vocabulario/"
   ],
   [
    "Repaso breve + 50 palabras",
    "files/INGLES1_1-Repaso-Breve_Vocabulario.pdf"
   ],
   [
    "Lo imprescindible",
    "files/INGLES1_3-Imprescindible_Tiempos.pdf"
   ]
  ],
  "progreso": {
   "clave": "ing1-repaso-v1",
   "total": 26
  },
  "bloques": [
   "Unit 1: Regular and Irregular Verbs",
   "Unit 2: Present Simple",
   "Unit 2: Present Continuous",
   "Unit 2: Present Perfect Simple",
   "Unit 2: Present Perfect Continuous"
  ]
 }
];
var FRANKLIN = [
 "Para entender quién fue Rosalind Franklin, tenemos que situarnos en los años 50. En aquella época, los científicos sabían que el ADN era la molécula que contenía la información genética, pero todavía no conocían exactamente qué forma tenía ni cómo estaba organizada.",
 "Había una gran pregunta: ¿cómo era la estructura del ADN?",
 "Varios equipos científicos estaban intentando resolver este misterio. Entre ellos estaban James Watson y Francis Crick, que trabajaban en Cambridge, y Maurice Wilkins y Rosalind Franklin, que trabajaban en el King's College de Londres.",
 "Rosalind Franklin era química y especialista en una técnica llamada difracción de rayos X. Esta técnica permite estudiar la estructura de moléculas que no podemos ver directamente.",
 "¿Y cómo lo hacía?",
 "Imaginad que tenemos una muestra de ADN y hacemos pasar rayos X a través de ella. Los rayos X interaccionan con la molécula y producen un patrón de manchas en una placa fotográfica. Analizando ese patrón, los científicos pueden obtener información sobre la forma y la organización de la molécula.",
 "Franklin consiguió obtener una fotografía especialmente importante, conocida como la Fotografía 51.",
 "@foto",
 "Puede parecer simplemente una especie de cruz o una serie de manchas, pero para alguien que sabe interpretar la difracción de rayos X contiene muchísima información. El patrón indicaba que el ADN tenía una estructura helicoidal, es decir, con forma de hélice.",
 "Mientras tanto, Watson y Crick estaban intentando construir un modelo que explicase cómo podía estar organizada la molécula de ADN.",
 "En 1953 publicaron el modelo de la doble hélice: dos cadenas enrolladas una alrededor de la otra, unidas mediante las bases nitrogenadas.",
 "Pero aquí viene la parte más polémica de la historia.",
 "La información obtenida por Rosalind Franklin fue fundamental para que Watson y Crick pudieran desarrollar su modelo. Sin embargo, la Fotografía 51 y otros datos experimentales de Franklin llegaron a manos de Watson y Crick sin que ella hubiera dado su autorización para utilizarlos de esa manera.",
 "En 1953, Watson y Crick publicaron su modelo de la doble hélice. Franklin también publicó trabajos sobre la estructura del ADN, pero su contribución no recibió el mismo reconocimiento.",
 "En 1962, Watson, Crick y Wilkins recibieron el Premio Nobel de Medicina por sus descubrimientos sobre la estructura de los ácidos nucleicos.",
 "¿Y Rosalind Franklin? No recibió el Nobel porque había fallecido cuatro años antes, en 1958, con solo 37 años. Además, el Premio Nobel no se concede a título póstumo.",
 "Durante mucho tiempo, su papel en el descubrimiento de la estructura del ADN quedó en segundo plano. Hoy se reconoce que sus experimentos fueron esenciales para comprender cómo era realmente esta molécula."
];
var FRANKLIN_PREGUNTA = "Si Rosalind Franklin no hubiera conseguido aquella fotografía, ¿creéis que Watson y Crick habrían llegado al mismo modelo de ADN en el mismo momento?";
var AGENDA_URL = "../docs/corte/agenda-2026-27.json";
var porId = {}; UNIDADES.forEach(function (u) { porId[u.id] = u; });
return { ORDEN_ASIG: ORDEN_ASIG, ASIGNATURAS: ASIGNATURAS, UNIDADES: UNIDADES, unidad: function (id) { return Object.prototype.hasOwnProperty.call(porId, id) ? porId[id] : null; },
  FRANKLIN: FRANKLIN, FRANKLIN_PREGUNTA: FRANKLIN_PREGUNTA, AGENDA_URL: AGENDA_URL };
});
