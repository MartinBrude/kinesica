/**
 * Kinésica Admin — Galería de Creativos Instagram
 * Permite a Norberto visualizar, filtrar y descargar las piezas de campaña
 * en formato Feed (4:5, 1080x1350) y Story (9:16, 1080x1920), además de copiar
 * el texto (caption) sugerido para publicar directamente en Instagram / WhatsApp.
 */

import { escapeHtml } from "./dom.js?v=79";

const ASSET_V = Date.now();

let activeFormat = "feed"; // 'feed' | 'story'
let activeFilter = "todos"; // 'todos' | 'columna' | 'articulaciones' | 'filosofia'
let searchQuery = "";
let selectedItem = null;

export const CREATIVOS_DATA = [
  // Fila 1: Filosofía y Marca
  {
    id: "01_acostumbraste_dolor",
    title: "¿Te acostumbraste a vivir con dolor?",
    cat: "EVALUACIÓN KINÉSICA",
    group: "filosofia",
    body: "El dolor crónico no es normal. Descubrí cómo tratar la causa mecánica real mediante terapia manual, no solo silenciar el síntoma.",
    feedUrl: "campanas/feed/catalogo_feed_01_acostumbraste_dolor.png",
    storyUrl: "campanas/story/catalogo_story_01_acostumbraste_dolor.png",
    copy: `¿Te acostumbraste a convivir con ese dolor de espalda o cuello? 🛑

Normalizar el dolor es el error más común. Tomar analgésicos solo apaga la alarma de tu cuerpo sin solucionar el problema mecánico.

En Kinésica evaluamos tu biomecánica global para encontrar el bloqueo real que genera la sobrecarga. Sesiones individuales 1 a 1 de 60 minutos con el Lic. Norberto Silvio Brude.

📍 Charcas 3889, Palermo, CABA.
📲 Turnos y consultas directas por WhatsApp: +54 9 11 6156-4311 o desde el link en bio @kinesicabrude

#KinesiologiaPalermo #DolorCronico #TerapiaManual #RPG #Kinésica`
  },
  {
    id: "02_sintoma_senal",
    title: "El síntoma es solo una señal",
    cat: "FILOSOFÍA KINÉSICA",
    group: "filosofia",
    body: "Tomar analgésicos solo silencia la alarma sin solucionar el origen de tu molestia. Buscamos la causa raíz con evaluación biomecánica global.",
    feedUrl: "campanas/feed/catalogo_feed_02_sintoma_senal.png",
    storyUrl: "campanas/story/catalogo_story_02_sintoma_senal.png",
    copy: `El síntoma es solo el mensajero: silenciarlo no cura la causa. 🚨

Cuando tomás un antiinflamatorio para calmar el dolor lumbar o cervical, el bloqueo mecánico sigue ahí. Con el tiempo, el cuerpo compensa y la molestia vuelve más intensa.

En Kinésica no tratamos partes aisladas: evaluamos tus cadenas musculares de pies a cabeza para resolver la causa de raíz.

📍 Palermo, Charcas 3889
📲 WhatsApp: +54 9 11 6156-4311
#Kinesiologia #Osteopatia #SaludPostural #CadenasFisiologicas #Kinésica`
  },
  {
    id: "03_causa_raiz",
    title: "Buscamos la causa raíz",
    cat: "RPG & OSTEOPATÍA",
    group: "filosofia",
    body: "Mediante RPG y osteopatía evaluamos tu postura de pies a cabeza para devolverte la movilidad y el bienestar sin dolor.",
    feedUrl: "campanas/feed/catalogo_feed_03_causa_raiz.png",
    storyUrl: "campanas/story/catalogo_story_03_causa_raiz.png",
    copy: `¿Por qué tu dolor de espalda puede empezar en una pisada o en la mandíbula? 🔍

El cuerpo humano es una unidad interconectada por cadenas miofasciales. Mediante Reeducación Postural Global (RPG) y Osteopatía evaluamos los desequilibrios globales para devolverte la movilidad sin dolor.

👉 Sesiones 1 a 1 de 50-60 minutos sin máquinas automáticas.
📍 Charcas 3889, Palermo
📲 Turnos por WhatsApp: +54 9 11 6156-4311
#RPG #OsteopatiaPalermo #Postura #Kinesiologia #Biomecanica`
  },
  {
    id: "04_bienestar_diario",
    title: "Recuperá tu bienestar diario",
    cat: "ATENCIÓN 1 A 1",
    group: "filosofia",
    body: "Encontrá en Kinésica un camino personalizado mano a mano para moverte libremente, trabajar sin tensión y recuperar tu calidad de vida.",
    feedUrl: "campanas/feed/catalogo_feed_04_bienestar_diario.png",
    storyUrl: "campanas/story/catalogo_story_04_bienestar_diario.png",
    copy: `Volvé a moverte sin miedo y a trabajar sin molestias. 🌿

Pasar horas frente a la computadora no debería terminar en dolor de cuello ni pesadez lumbar. En Kinésica diseñamos un tratamiento manual a medida para que recuperes tu bienestar diario.

📍 Charcas 3889, Palermo
📲 Agendá tu evaluación por WhatsApp: +54 9 11 6156-4311
#Bienestar #Ergonomia #KinesiologiaPalermo #Kinésica #SinDolor`
  },

  // Fila 2: Columna, ATM y Conexión Miofascial
  {
    id: "05_correccion_columna",
    title: "Corrección de columna",
    cat: "CORRECCIÓN DE COLUMNA",
    group: "columna",
    body: "Eliminamos la tensión en columna y mandíbula tratando el origen biomecánico mediante terapia manual y RPG.",
    feedUrl: "campanas/feed/catalogo_feed_05_correccion_columna.png",
    storyUrl: "campanas/story/catalogo_story_05_correccion_columna.png",
    copy: `Alinear tu columna es mucho más que "ponerse derecho". 🧘‍♂️

La columna responde a tensiones profundas: diafragma, pelvis, cervicales e incluso la mordida. Con RPG y terapia manual liberamos las fijaciones vertebrales para restaurar las curvas fisiológicas naturales de tu espalda.

📍 Consultorio en Charcas 3889, Palermo
📲 Coordiná tu consulta por WhatsApp: +54 9 11 6156-4311
#ColumnaVertebral #RPG #RectificacionCervical #Escoliosis #Kinésica`
  },
  {
    id: "06_tension_maxilar",
    title: "¿Tensión maxilar al despertar?",
    cat: "ATM & BRUXISMO",
    group: "columna",
    body: "Tratamos dolores de cabeza y mandíbula liberando la articulación témporo-mandibular desde su causa postural profunda.",
    feedUrl: "campanas/feed/catalogo_feed_06_tension_maxilar.png",
    storyUrl: "campanas/story/catalogo_story_06_tension_maxilar.png",
    copy: `¿Despertás apretando los dientes o con dolor en las sienes? 🦷⚡️

El bruxismo no solo desgasta el esmalte: sobrecarga los músculos masticatorios e inflama la articulación témporo-mandibular (ATM), irradiando tensión hacia el cuello y la cabeza.

En Kinésica aplicamos terapia manual intra y extraoral suave para descomprimir la mandíbula y aliviar las cefaleas tensionales.

📍 Charcas 3889, Palermo
📲 Turnos por WhatsApp: +54 9 11 6156-4311
#ATM #Bruxismo #CefaleaTensional #DolorMandibular #Kinesiologia`
  },
  {
    id: "07_dolor_conectado",
    title: "El dolor está conectado",
    cat: "CADENAS FISIOLÓGICAS",
    group: "columna",
    body: "Evaluamos tus cadenas musculares de pies a cabeza para erradicar el dolor desde su verdadero origen biomecánico.",
    feedUrl: "campanas/feed/catalogo_feed_07_dolor_conectado.png",
    storyUrl: "campanas/story/catalogo_story_07_dolor_conectado.png",
    copy: `Donde sentís el dolor rara vez está la causa. 🔗

Una contractura cervical puede ser la compensación de una rigidez dorsal o de una pisada desalineada. En Kinésica evaluamos el mapa completo de tus cadenas miofasciales para resolver la molestia de forma duradera.

📍 Consultorio en Palermo (Charcas 3889)
📲 WhatsApp: +54 9 11 6156-4311
#CadenasMiofasciales #Biomecanica #Osteopatia #KinesiologiaPalermo #Kinésica`
  },
  {
    id: "08_tension_nerviosa",
    title: "Liberá la tensión nerviosa",
    cat: "NEURODINAMIA CLÍNICA",
    group: "columna",
    body: "La neurodinamia moviliza suavemente tus troncos nerviosos para erradicar adormecimiento, ardor y dolor ciático.",
    feedUrl: "campanas/feed/catalogo_feed_08_tension_nerviosa.png",
    storyUrl: "campanas/story/catalogo_story_08_tension_nerviosa.png",
    copy: `¿Hormigueo, ardor o pinchazos que bajan por la pierna o el brazo? ⚡️

Los nervios periféricos necesitan deslizarse libremente entre músculos y ligamentos. Cuando quedan atrapados o comprimidos, aparece el dolor ciático o el adormecimiento en manos y pies.

Mediante Neurodinamia Clínica movilizamos los troncos nerviosos con suavidad para recuperar su viscoelasticidad.

📍 Charcas 3889, Palermo
📲 Turnos por WhatsApp: +54 9 11 6156-4311
#Neurodinamia #Ciatalgia #NervioCiatico #TunelCarpiano #Kinésica`
  },

  // Fila 3: Espalda, Hernias y Bruxismo
  {
    id: "09_tension_visceral",
    title: "Tensión visceral y espalda",
    cat: "TERAPIA MANUAL",
    group: "columna",
    body: "Tratamos restricciones y adherencias viscerales para liberar la zona lumbar mediante terapia manual suave y específica.",
    feedUrl: "campanas/feed/catalogo_feed_09_tension_visceral.png",
    storyUrl: "campanas/story/catalogo_story_09_tension_visceral.png",
    copy: `¿Sabías que una tensión digestiva puede ser la causante de tu dolor lumbar? 🫀

Los órganos internos están suspendidos por fascias y ligamentos que se anclan en las vértebras lumbares y pelvis. Una restricción o cicatriz abdominal puede traccionar la columna provocando lumbalgias rebeldes.

Con manipulaciones viscerales osteopáticas suaves liberamos esa tracción profunda.

📍 Charcas 3889, Palermo
📲 Turnos por WhatsApp: +54 9 11 6156-4311
#OsteopatiaVisceral #Lumbalgia #TerapiaManual #KinesiologiaPalermo #Kinésica`
  },
  {
    id: "10_lumbalgia_recurrente",
    title: "¿Lumbalgia recurrente?",
    cat: "OSTEOPATÍA · COLUMNA",
    group: "columna",
    body: "Tratamos el origen mecánico de tu dolor lumbar evaluando pelvis, pisada y columna con osteopatía personalizada.",
    feedUrl: "campanas/feed/catalogo_feed_10_lumbalgia_recurrente.png",
    storyUrl: "campanas/story/catalogo_story_10_lumbalgia_recurrente.png",
    copy: `El dolor de cintura no se cura solo haciendo reposo. 🛑

La lumbalgia suele originarse en un bloqueo de la pelvis (articulación sacroilíaca), falta de movilidad en caderas o acortamiento de la cadena posterior.

En Kinésica abordamos la causa mecánica 1 a 1 para que vuelvas a moverte sin miedo a quedarte duro.

📍 Charcas 3889, Palermo
📲 Escribinos por WhatsApp: +54 9 11 6156-4311
#Lumbalgia #DolorLumbar #Osteopatia #ColumnaSana #Kinésica`
  },
  {
    id: "11_hernia_disco",
    title: "¿Hernia de disco sin cirugía?",
    cat: "RPG POSTURAL",
    group: "columna",
    body: "Descomprimimos la raíz nerviosa y reequilibramos las cadenas musculares con RPG personalizada antes de considerar operar.",
    feedUrl: "campanas/feed/catalogo_feed_11_hernia_disco.png",
    storyUrl: "campanas/story/catalogo_story_11_hernia_disco.png",
    copy: `Tener una hernia de disco no es una condena a vivir con dolor ni a operarte. 🛡️

En más del 80% de los casos, el tratamiento conservador con RPG y terapia manual logra descomprimir el disco y reducir la inflamación de la raíz nerviosa de forma contundente.

👉 Evaluá tu caso con el Lic. Norberto Silvio Brude.
📍 Charcas 3889, Palermo
📲 Turnos WhatsApp: +54 9 11 6156-4311
#HerniaDeDisco #RPG #Columna #Ciática #KinesiologiaPalermo`
  },
  {
    id: "12_alivia_bruxismo",
    title: "Aliviá el bruxismo de raíz",
    cat: "ATM & CERVICALES",
    group: "columna",
    body: "Tratamos la causa cervical y postural de tu bruxismo mediante terapia manual intra y extraoral indolora.",
    feedUrl: "campanas/feed/catalogo_feed_12_alivia_bruxismo.png",
    storyUrl: "campanas/story/catalogo_story_12_alivia_bruxismo.png",
    copy: `La placa de descanso protege los dientes, pero la terapia manual desactiva la contractura. 🦷

Si te despertás con mandíbula cansada, ruidos al masticar o dolor de cabeza, el tratamiento de la ATM libera los puntos gatillo de los maseteros y alinea el cuello para aliviar la tensión de raíz.

📍 Charcas 3889, Palermo
📲 WhatsApp directo: +54 9 11 6156-4311
#Bruxismo #ATM #TerapiaManual #Cefalea #Kinésica`
  },

  // Fila 4: Articulaciones (Cuello, Rodilla, Hombro, Artrosis)
  {
    id: "13_torticolis",
    title: "¿Sufrís tortícolis recurrente?",
    cat: "COLUMNA CERVICAL",
    group: "articulaciones",
    body: "Liberamos el bloqueo articular y miofascial del cuello tratando la causa raíz para devolverte el giro natural.",
    feedUrl: "campanas/feed/catalogo_feed_13_torticolis.png",
    storyUrl: "campanas/story/catalogo_story_13_torticolis.png",
    copy: `¿Te despertaste y no podés girar la cabeza? 😣

La tortícolis es un espasmo defensivo provocado por un bloqueo en las carillas articulares cervicales o un estrés mecánico postural. Con movilizaciones suaves y terapia manual descomprimimos la zona para que recuperes el movimiento sin dolor forzado.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 6156-4311
#Torticolis #Cervicalgia #DolorDeCuello #Osteopatia #Kinésica`
  },
  {
    id: "14_dolor_rodilla",
    title: "¿Dolor de rodilla recurrente?",
    cat: "RODILLA & MENISCOS",
    group: "articulaciones",
    body: "Tratamos la sobrecarga biomecánica de la meniscopatía y alineación de la rótula para aliviar la articulación sin cirugías.",
    feedUrl: "campanas/feed/catalogo_feed_14_dolor_rodilla.png",
    storyUrl: "campanas/story/catalogo_story_14_dolor_rodilla.png",
    copy: `El dolor de rodilla suele ser víctima de lo que pasa en el tobillo o en la cadera. 🦵

Si sentís pinchazos al bajar escaleras, molestias meniscales o rigidez al levantarte, evaluamos el eje biomecánico de tu pierna para descomprimir la articulación y devolverte la estabilidad.

📍 Charcas 3889, Palermo
📲 Turnos por WhatsApp: +54 9 11 6156-4311
#Gonalgia #Meniscos #DolorDeRodilla #KinesiologiaDeportiva #Kinésica`
  },
  {
    id: "15_levantar_brazo",
    title: "¿Dolor al levantar el brazo?",
    cat: "HOMBRO & MANGUITO",
    group: "articulaciones",
    body: "Tratamos la causa biomecánica del manguito rotador y escápula para que recuperes el rango completo sin dolor.",
    feedUrl: "campanas/feed/catalogo_feed_15_levantar_brazo.png",
    storyUrl: "campanas/story/catalogo_story_15_levantar_brazo.png",
    copy: `¿Pinchazo al ponerte el abrigo o al levantar el brazo de costado? 💥

El síndrome de fricción subacromial y la tendinopatía del manguito rotador se producen cuando la escápula y la columna dorsal pierden sincronía. Con terapia manual reabrimos el espacio articular para que el tendón deje de pinzarse.

📍 Charcas 3889, Palermo
📲 Turnos por WhatsApp: +54 9 11 6156-4311
#ManguitoRotador #HombroDoloroso #TerapiaManual #Kinesiologia #Kinésica`
  },
  {
    id: "16_artrosis",
    title: "¿Artrosis? El dolor no es inevitable",
    cat: "SALUD ARTICULAR",
    group: "articulaciones",
    body: "Liberamos la presión articular y devolvemos la movilidad a los tejidos circundantes mediante terapia manual especializada.",
    feedUrl: "campanas/feed/catalogo_feed_16_artrosis.png",
    storyUrl: "campanas/story/catalogo_story_16_artrosis.png",
    copy: `Tener artrosis no significa resignarse a vivir con dolor. 🛡️

El desgaste articular duele cuando los músculos y fascias de alrededor se contracturan y aumentan la presión sobre el cartílago. La terapia manual flexibiliza la cápsula y mejora la nutrición articular para que te muevas con libertad.

📍 Charcas 3889, Palermo
📲 Turnos WhatsApp: +54 9 11 6156-4311
#Artrosis #SaludArticular #TerapiaManual #KinesiologiaPalermo #Kinésica`
  },

  // Fila 5: Posturología y Consulta Inicial
  {
    id: "18_primera_sesion",
    title: "¿Qué llevar a tu primera sesión?",
    cat: "CONSULTA PERSONALIZADA",
    group: "filosofia",
    body: "Traé tus estudios previos y ropa cómoda. Norberto Silvio Brude realiza una evaluación exhaustiva y tratamiento 1 a 1 de 60 minutos.",
    feedUrl: "campanas/feed/catalogo_feed_18_primera_sesion.png",
    storyUrl: "campanas/story/catalogo_story_18_primera_sesion.png",
    copy: `¿Primera vez en Kinésica? Te contamos cómo es tu sesión: 🩺

1️⃣ Traé tus estudios previos (resonancias, radiografías si tenés).
2️⃣ Vení con ropa cómoda (remera, short o calza).
3️⃣ Evaluamos tu postura global, movilidad y aplicamos terapia manual desde el primer día.

Sesiones personalizadas de 50 a 60 minutos, puntuales y sin esperas.

📍 Charcas 3889, Palermo, CABA
📲 Agendá tu turno por WhatsApp al +54 9 11 6156-4311
#KinesiologiaPalermo #TurnosKinesiologia #NorbertoBrude #Kinésica`
  },

  // Fila 6: Vida cotidiana que interpela (oficina, celular, sueño, hábitos)
  {
    id: "19_oficina_espalda",
    title: "¿Tu oficina te está rompiendo la espalda?",
    cat: "ERGONOMÍA & POSTURA",
    group: "filosofia",
    body: "Pasar 8 horas sentado no es el problema: es cómo tu cuerpo lo compensa. Evaluamos tu biomecánica para que trabajes sin dolor.",
    feedUrl: "campanas/feed/catalogo_feed_19_oficina_espalda.png",
    storyUrl: "campanas/story/catalogo_story_19_oficina_espalda.png",
    copy: `¿Tu oficina te está rompiendo la espalda? 💻🛑

No es “estar sentado”: es la compensación. Hombros adelante, cuello en pantalla y lumbar sin apoyo terminan en contracturas que el analgésico solo apaga por unas horas.

En Kinésica evaluamos tu biomecánica global y tratamos la causa mecánica con terapia manual 1 a 1.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 6156-4311
#HomeOffice #DolorLumbar #Ergonomia #KinesiologiaPalermo #Kinésica`
  },
  {
    id: "20_celular_cuello",
    title: "¿Cuántas horas mirás el celular así?",
    cat: "CUELLO & CERVICALES",
    group: "articulaciones",
    body: "El cuello no está diseñado para mirar hacia abajo todo el día. Liberamos la tensión cervical y realineamos la postura antes de que se vuelva crónica.",
    feedUrl: "campanas/feed/catalogo_feed_20_celular_cuello.png",
    storyUrl: "campanas/story/catalogo_story_20_celular_cuello.png",
    copy: `¿Cuántas horas mirás el celular con la cabeza hacia abajo? 📱😣

Esa postura suma kilos de carga sobre las cervicales. Resultado: tirantez, cefalea tensional y ese “cuello de piedra” al final del día.

En Kinésica liberamos la tensión cervical y reequilibramos la postura para que el hábito no se vuelva lesión crónica.

📍 Charcas 3889, Palermo
📲 Turnos por WhatsApp: +54 9 11 6156-4311
#TechNeck #Cervicalgia #DolorDeCuello #Osteopatia #Kinésica`
  },
  {
    id: "21_despertas_peor",
    title: "¿Te despertás peor de lo que te acostaste?",
    cat: "CALIDAD DE SUEÑO",
    group: "filosofia",
    body: "Si amanecés rígido, con mandíbula apretada o dolor de espalda, tu cuerpo está pidiendo una evaluación mecánica, no más almohadas milagrosas.",
    feedUrl: "campanas/feed/catalogo_feed_21_despertas_peor.png",
    storyUrl: "campanas/story/catalogo_story_21_despertas_peor.png",
    copy: `¿Te despertás peor de lo que te acostaste? 😴⚡

Si amanecés rígido, con mandíbula trabada o la espalda “trabada”, no es solo la almohada: hay una mecánica que durante la noche se agrava (bruxismo, cadena posterior, pelvis).

En Kinésica evaluamos de pies a cabeza y tratamos la causa con terapia manual personalizada.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 6156-4311
#Bruxismo #DolorDeEspalda #ATM #KinesiologiaPalermo #Kinésica`
  },
  {
    id: "22_alivio_2_dias",
    title: "Si el alivio dura 2 días, no alcanza",
    cat: "FILOSOFÍA KINÉSICA",
    group: "filosofia",
    body: "El masaje relaja el síntoma. En Kinésica buscamos por qué tu cuerpo se vuelve a contracturar y tratamos la causa mecánica de raíz.",
    feedUrl: "campanas/feed/catalogo_feed_22_alivio_2_dias.png",
    storyUrl: "campanas/story/catalogo_story_22_alivio_2_dias.png",
    copy: `Si el alivio dura 2 días… no alcanza. 🔁

El masaje relaja. Está buenísimo. Pero si la contractura vuelve igual, el cuerpo te está avisando que hay una causa mecánica sin resolver.

En Kinésica no perseguimos el síntoma: evaluamos cadenas musculares, postura y movilidad para que el alivio se sostenga.

📍 Charcas 3889, Palermo
📲 Turnos WhatsApp: +54 9 11 6156-4311
#TerapiaManual #CausaRaiz #RPG #Osteopatia #Kinésica`
  },
  {
    id: "23_miedo_moverte",
    title: "¿Le tenés miedo a moverte?",
    cat: "REEDUCACIÓN FUNCIONAL",
    group: "filosofia",
    body: "Evitar el movimiento por miedo al dolor refuerza el problema. Recuperamos confianza con terapia manual y reeducación postural 1 a 1.",
    feedUrl: "campanas/feed/catalogo_feed_23_miedo_moverte.png",
    storyUrl: "campanas/story/catalogo_story_23_miedo_moverte.png",
    copy: `¿Le tenés miedo a agacharte, girar o levantar algo? 🛑

Evitar el movimiento por miedo al dolor parece protección… pero refuerza la rigidez y la inseguridad. El cuerpo se vuelve más frágil cuanto menos se mueve.

En Kinésica descomprimimos lo que duele y reconstruimos confianza con terapia manual + reeducación postural 1 a 1.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 6156-4311
#MiedoAlMovimiento #ReeducacionPostural #RPG #Kinesiologia #Kinésica`
  },
  {
    id: "24_corres_dolor",
    title: "¿Corrés con dolor y lo naturalizás?",
    cat: "RUNNING & DEPORTE",
    group: "articulaciones",
    body: "Dolor al correr no es parte del entrenamiento. Evaluamos pisada, cadera y columna para que vuelvas a entrenar sin compensar.",
    feedUrl: "campanas/feed/catalogo_feed_24_corres_dolor.png",
    storyUrl: "campanas/story/catalogo_story_24_corres_dolor.png",
    copy: `¿Corrés con dolor y lo naturalizás? 🏃‍♂️⚡

“Es el km”, “es la zapatilla”, “ya se me pasa”. Spoiler: el cuerpo no se acostumbra, compensa. Y esa compensación termina en rodilla, cadera o lumbar.

En Kinésica evaluamos pisada, pelvis y columna para que vuelvas a entrenar sin forzar el síntoma.

📍 Charcas 3889, Palermo
📲 Turnos por WhatsApp: +54 9 11 6156-4311
#Running #DolorDeRodilla #KinesiologiaDeportiva #Biomecanica #Kinésica`
  }
];

export function initCreativosUI() {
  const container = document.getElementById("admin-creativos-card");
  if (!container) return;

  // Format toggles
  const btnFeed = document.getElementById("btn-creativos-format-feed");
  const btnStory = document.getElementById("btn-creativos-format-story");

  if (btnFeed && btnStory) {
    btnFeed.addEventListener("click", () => {
      activeFormat = "feed";
      btnFeed.classList.add("is-active");
      btnStory.classList.remove("is-active");
      renderCreativosGrid();
    });
    btnStory.addEventListener("click", () => {
      activeFormat = "story";
      btnStory.classList.add("is-active");
      btnFeed.classList.remove("is-active");
      renderCreativosGrid();
    });
  }

  // Filter pills
  const filterBtns = container.querySelectorAll(".creativos-filter-pill");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      activeFilter = btn.dataset.filter || "todos";
      renderCreativosGrid();
    });
  });

  // Search input
  const searchInput = document.getElementById("admin-creativos-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = String(e.target.value || "").toLowerCase().trim();
      renderCreativosGrid();
    });
  }

  // Delegated clicks for actions (copy, lightbox, download)
  const gridEl = document.getElementById("admin-creativos-grid");
  if (gridEl) {
    gridEl.addEventListener("click", (e) => {
      const copyBtn = e.target.closest(".btn-creativo-copy");
      if (copyBtn) {
        const id = copyBtn.dataset.id;
        const item = CREATIVOS_DATA.find((it) => it.id === id);
        if (item && item.copy) {
          navigator.clipboard.writeText(item.copy).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = "✓ ¡Copiado!";
            copyBtn.classList.add("btn-copied");
            setTimeout(() => {
              copyBtn.textContent = originalText;
              copyBtn.classList.remove("btn-copied");
            }, 2200);
          });
        }
        return;
      }

      const zoomTrigger = e.target.closest(".creativo-thumb-box");
      if (zoomTrigger) {
        const id = zoomTrigger.dataset.id;
        const item = CREATIVOS_DATA.find((it) => it.id === id);
        if (item) openLightboxModal(item);
      }
    });
  }

  // Lightbox close
  const modalClose = document.getElementById("creativo-modal-close");
  const modalBackdrop = document.getElementById("creativo-modal-backdrop");
  if (modalClose) modalClose.addEventListener("click", closeLightboxModal);
  if (modalBackdrop) modalBackdrop.addEventListener("click", closeLightboxModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightboxModal();
  });
}

export function loadCreativosData() {
  renderCreativosGrid();
}

function renderCreativosGrid() {
  const grid = document.getElementById("admin-creativos-grid");
  const countLabel = document.getElementById("admin-creativos-count-label");
  if (!grid) return;

  const filtered = CREATIVOS_DATA.filter((item) => {
    if (activeFilter !== "todos" && item.group !== activeFilter) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery;
      const haystack = `${item.title} ${item.cat} ${item.body}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (countLabel) {
    countLabel.textContent = `${filtered.length} de ${CREATIVOS_DATA.length} piezas`;
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="creativos-empty">
        <p>No se encontraron piezas que coincidan con la búsqueda.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((item) => {
      const rawImg = activeFormat === "story" ? item.storyUrl : item.feedUrl;
      const imgUrl = `${rawImg}?v=${ASSET_V}`;
      const aspectClass = activeFormat === "story" ? "aspect-story" : "aspect-feed";

      return `
        <article class="creativo-card" data-id="${item.id}">
          <div class="creativo-thumb-box ${aspectClass}" data-id="${item.id}" title="Click para ver en grande">
            <img src="${imgUrl}" alt="${escapeHtml(item.title)}" loading="lazy">
            <div class="creativo-thumb-overlay">
              <span class="btn light btn-sm">🔍 Ver en grande</span>
            </div>
            <span class="creativo-format-badge">${activeFormat === "story" ? "Story 9:16" : "Feed 4:5"}</span>
          </div>

          <div class="creativo-info">
            <span class="creativo-pill">${escapeHtml(item.cat)}</span>
            <h3 class="creativo-title">${escapeHtml(item.title)}</h3>
            <p class="creativo-desc">${escapeHtml(item.body)}</p>

            <div class="creativo-actions">
              <a href="${item.feedUrl}?v=${ASSET_V}" download="kinesica_feed_${item.id}.png" class="btn light btn-sm" title="Descargar imagen en formato Feed 4:5">
                📥 Feed (4:5)
              </a>
              <a href="${item.storyUrl}?v=${ASSET_V}" download="kinesica_story_${item.id}.png" class="btn light btn-sm" title="Descargar imagen en formato Story 9:16">
                📥 Story (9:16)
              </a>
              <button type="button" class="btn light btn-sm btn-creativo-copy" data-id="${item.id}" title="Copiar texto para publicar">
                📋 Copiar texto
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function openLightboxModal(item) {
  selectedItem = item;
  const modal = document.getElementById("creativo-lightbox-modal");
  if (!modal) return;

  const modalImg = document.getElementById("creativo-modal-img");
  const modalTitle = document.getElementById("creativo-modal-title");
  const modalCat = document.getElementById("creativo-modal-cat");
  const modalCopy = document.getElementById("creativo-modal-copy");
  const modalBtnFeed = document.getElementById("creativo-modal-dl-feed");
  const modalBtnStory = document.getElementById("creativo-modal-dl-story");
  const modalBtnCopy = document.getElementById("creativo-modal-btn-copy");

  const currentImg = activeFormat === "story" ? item.storyUrl : item.feedUrl;

  if (modalImg) modalImg.src = `${currentImg}?v=${ASSET_V}`;
  if (modalTitle) modalTitle.textContent = item.title;
  if (modalCat) modalCat.textContent = item.cat;
  if (modalCopy) modalCopy.textContent = item.copy || item.body;

  if (modalBtnFeed) {
    modalBtnFeed.href = `${item.feedUrl}?v=${ASSET_V}`;
    modalBtnFeed.download = `kinesica_feed_${item.id}.png`;
  }
  if (modalBtnStory) {
    modalBtnStory.href = `${item.storyUrl}?v=${ASSET_V}`;
    modalBtnStory.download = `kinesica_story_${item.id}.png`;
  }

  if (modalBtnCopy) {
    modalBtnCopy.onclick = () => {
      navigator.clipboard.writeText(item.copy || item.body).then(() => {
        const orig = modalBtnCopy.textContent;
        modalBtnCopy.textContent = "✓ ¡Texto copiado!";
        setTimeout(() => {
          modalBtnCopy.textContent = orig;
        }, 2200);
      });
    };
  }

  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightboxModal() {
  const modal = document.getElementById("creativo-lightbox-modal");
  if (modal) modal.hidden = true;
  document.body.style.overflow = "";
}
