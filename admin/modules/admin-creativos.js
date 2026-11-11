/**
 * Kinésica Admin — Galería de Creativos Instagram
 * Permite a Norberto visualizar, filtrar y descargar las piezas de campaña
 * en formato Feed (4:5, 1080x1350) y Story (9:16, 1080x1920), además de copiar
 * el texto (caption) sugerido para publicar directamente en Instagram / WhatsApp.
 */

import { escapeHtml } from "./dom.js?v=79";
import {
  getPublicationDetails,
  loadCola,
  toggleCola,
  resolveCaption,
  resolveImageText,
  CAPTION_MAX,
  saveCaption,
  assetVersion,
  subscribeCola,
} from "./admin-creativos-cola.js?v=11";
import {
  colaButtonHtml,
  colaBadgeHtml,
  colaHeartHtml,
  refreshColaButtons,
  ensureColaUiPaint,
} from "./admin-creativos-cola-ui.js?v=3";
import { initListaUI } from "./admin-creativos-lista.js?v=12";
import { canEditCaptions } from "./admin-creativos-caption.js?v=9";
import {
  imageTextEditButtonHtml,
  bindImageTextUi,
  canEditImageText,
} from "./admin-creativos-image-text.js?v=2";

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
📲 Turnos y consultas directas por WhatsApp: +54 9 11 3178-1733 o desde el link en bio @kinesicabrude

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
📲 WhatsApp: +54 9 11 3178-1733
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
📲 Turnos por WhatsApp: +54 9 11 3178-1733
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
📲 Agendá tu evaluación por WhatsApp: +54 9 11 3178-1733
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
📲 Coordiná tu consulta por WhatsApp: +54 9 11 3178-1733
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
📲 Turnos por WhatsApp: +54 9 11 3178-1733
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
📲 WhatsApp: +54 9 11 3178-1733
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
📲 Turnos por WhatsApp: +54 9 11 3178-1733
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
📲 Turnos por WhatsApp: +54 9 11 3178-1733
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
📲 Escribinos por WhatsApp: +54 9 11 3178-1733
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
📲 Turnos WhatsApp: +54 9 11 3178-1733
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
📲 WhatsApp directo: +54 9 11 3178-1733
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
📲 WhatsApp: +54 9 11 3178-1733
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
📲 Turnos por WhatsApp: +54 9 11 3178-1733
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
📲 Turnos por WhatsApp: +54 9 11 3178-1733
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
📲 Turnos WhatsApp: +54 9 11 3178-1733
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
📲 Agendá tu turno por WhatsApp al +54 9 11 3178-1733
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
📲 WhatsApp: +54 9 11 3178-1733
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
📲 Turnos por WhatsApp: +54 9 11 3178-1733
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
📲 WhatsApp: +54 9 11 3178-1733
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
📲 Turnos WhatsApp: +54 9 11 3178-1733
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
📲 WhatsApp: +54 9 11 3178-1733
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
📲 Turnos por WhatsApp: +54 9 11 3178-1733
#Running #DolorDeRodilla #KinesiologiaDeportiva #Biomecanica #Kinésica`
  },

  // Fila 7: ATM — síntomas cotidianos que interpela
  {
    id: "25_click_mandibula",
    title: "¿Te hace click la mandíbula al masticar?",
    cat: "ATM & MASTICACIÓN",
    group: "columna",
    body: "El ruido o el trabado no son normales. Descomprimimos la ATM y liberamos maseteros y pterigoideos con terapia manual suave.",
    feedUrl: "campanas/feed/catalogo_feed_25_click_mandibula.png",
    storyUrl: "campanas/story/catalogo_story_25_click_mandibula.png",
    copy: `¿Te hace click la mandíbula al masticar o bostezar? 🦷⚡

Ese ruido, el trabado o el “salto” articular no son un detalle: marcan sobrecarga en la ATM y en los músculos masticatorios.

En Kinésica descomprimimos la articulación y liberamos maseteros y pterigoideos con terapia manual suave (intra y extraoral).

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#ATM #ClickMandibular #TerapiaManual #KinesiologiaPalermo #Kinésica`
  },
  {
    id: "26_cefalea_atm",
    title: "Ese dolor de cabeza puede venir de la mandíbula",
    cat: "ATM & CEFALEA",
    group: "columna",
    body: "Muchas cefaleas tensionales arrancan en la ATM y los músculos masticatorios. Tratamos la causa mecánica, no solo el síntoma.",
    feedUrl: "campanas/feed/catalogo_feed_26_cefalea_atm.png",
    storyUrl: "campanas/story/catalogo_story_26_cefalea_atm.png",
    copy: `Ese dolor de cabeza… puede venir de la mandíbula. 🤕

Si la cefalea aparece en sienes, frente o detrás de los ojos y además apretás los dientes, la ATM suele ser el origen mecánico.

En Kinésica tratamos la causa: liberamos masticatorios, alineamos cuello y descomprimimos la articulación.

📍 Charcas 3889, Palermo
📲 Turnos WhatsApp: +54 9 11 3178-1733
#CefaleaTensional #ATM #Bruxismo #Osteopatia #Kinésica`
  },
  {
    id: "27_apriete_inconsciente",
    title: "¿Apretás la mandíbula sin darte cuenta?",
    cat: "ESTRÉS & ATM",
    group: "columna",
    body: "El bruxismo diurno aparece en mails, tráfico y pantallas. Reeducamos la ATM y liberamos la cadena cervical para cortar el circuito de tensión.",
    feedUrl: "campanas/feed/catalogo_feed_27_apriete_inconsciente.png",
    storyUrl: "campanas/story/catalogo_story_27_apriete_inconsciente.png",
    copy: `¿Apretás la mandíbula sin darte cuenta? 😬💻

Mails, tráfico, pantallas: el bruxismo diurno es silencioso. La mandíbula se cierra, el cuello se carga y al final del día aparecen sienes y ATM inflamadas.

En Kinésica liberamos la cadena cervical-mandibular y reeducamos el tono para cortar el circuito de tensión.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#BruxismoDiurno #ATM #Estres #Cervicalgia #Kinésica`
  },
  {
    id: "28_placa_no_basta",
    title: "La placa protege los dientes, no libera la ATM",
    cat: "ATM & PLACA",
    group: "columna",
    body: "La placa evita el desgaste. La terapia manual desactiva la contractura de maseteros, cuello y postura que mantiene el bruxismo.",
    feedUrl: "campanas/feed/catalogo_feed_28_placa_no_basta.png",
    storyUrl: "campanas/story/catalogo_story_28_placa_no_basta.png",
    copy: `La placa protege los dientes… pero no libera la ATM. 🦷

Es un gran aliado para el esmalte. El problema es que la contractura de maseteros, cuello y postura sigue activa si no se trata.

En Kinésica complementamos el enfoque odontológico con terapia manual para desactivar la causa mecánica del bruxismo.

📍 Charcas 3889, Palermo
📲 Turnos por WhatsApp: +54 9 11 3178-1733
#PlacaDeDescanso #ATM #Bruxismo #TerapiaManual #Kinésica`
  },
  {
    id: "29_oido_atm",
    title: "¿Zumbido o presión en el oído sin infección?",
    cat: "ATM & OÍDO",
    group: "columna",
    body: "La ATM está a milímetros del oído. Una mandíbula bloqueada puede dar plenitud, click o tinnitus. Evaluamos la articulación y el cuello juntos.",
    feedUrl: "campanas/feed/catalogo_feed_29_oido_atm.png",
    storyUrl: "campanas/story/catalogo_story_29_oido_atm.png",
    copy: `¿Zumbido o presión en el oído… y el otorrino dice que no hay infección? 👂

La ATM está a milímetros del oído. Una mandíbula bloqueada o un bruxismo intenso pueden dar plenitud, click o tinnitus.

En Kinésica evaluamos ATM + cuello juntos para descomprimir esa zona tan sensible.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#ATM #Tinnitus #Oido #TerapiaManual #Kinésica`
  },
  {
    id: "30_boca_trabada",
    title: "¿No podés abrir bien la boca?",
    cat: "ATM BLOQUEADA",
    group: "columna",
    body: "El traba o la apertura limitada pide evaluación urgente de la ATM. Con terapia manual suave restauramos el deslizamiento articular sin forzar.",
    feedUrl: "campanas/feed/catalogo_feed_30_boca_trabada.png",
    storyUrl: "campanas/story/catalogo_story_30_boca_trabada.png",
    copy: `¿No podés abrir bien la boca o se te “traba”? 🛑

La apertura limitada o el bloqueo de la ATM no se resuelve forzando. Hay que restaurar el deslizamiento articular con técnica suave y precisa.

En Kinésica evaluamos la articulación, los masticatorios y el cuello para devolver movilidad sin dolor.

📍 Charcas 3889, Palermo
📲 Turnos WhatsApp: +54 9 11 3178-1733
#ATMBloqueada #Trismo #Mandibula #KinesiologiaPalermo #Kinésica`
  },

  // Fila 8: Patologías del sitio (cobertura de artículos, sin ATM)
  {
    id: "31_cefalea",
    title: "¿Dolor de cabeza que no afloja?",
    cat: "CEFALEA",
    group: "columna",
    body: "El dolor de cabeza puede venir del cuello, la mandíbula o la postura. Evaluamos la causa mecánica y tratamos con terapia manual.",
    feedUrl: "campanas/feed/catalogo_feed_31_cefalea.png",
    storyUrl: "campanas/story/catalogo_story_31_cefalea.png",
    copy: `¿Dolor de cabeza que no afloja? 🤕

Puede nacer en cervicales, mandíbula o tensión postural. En Kinésica evaluamos la causa mecánica y tratamos con terapia manual 1 a 1.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Cefalea #Cervicalgia #ATM #KinesiologiaPalermo #Kinésica`
  },
  {
    id: "32_dorsalgia",
    title: "¿Dolor entre los omóplatos?",
    cat: "DORSALGIA",
    group: "columna",
    body: "La dorsalgia suele venir de rigidez torácica y posturas sostenidas. Recuperamos movilidad dorsal con terapia manual.",
    feedUrl: "campanas/feed/catalogo_feed_32_dorsalgia.png",
    storyUrl: "campanas/story/catalogo_story_32_dorsalgia.png",
    copy: `¿Dolor entre los omóplatos? 😣

La dorsalgia suele venir de rigidez torácica y horas frente a la pantalla. Recuperamos movilidad dorsal con terapia manual.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Dorsalgia #EspaldaAlta #TerapiaManual #Kinésica`
  },
  {
    id: "33_ciatalgia",
    title: "¿Dolor que baja por la pierna?",
    cat: "CIATALGIA",
    group: "columna",
    body: "Quemazón u hormigueo desde la lumbar al glúteo y pierna. Evaluamos columna y nervio ciático sin forzar.",
    feedUrl: "campanas/feed/catalogo_feed_33_ciatalgia.png",
    storyUrl: "campanas/story/catalogo_story_33_ciatalgia.png",
    copy: `¿Dolor, quemazón u hormigueo que baja por la pierna? ⚡

Eso es ciatalgia: evaluamos lumbar, pelvis y nervio ciático con neurodinamia y terapia manual, sin forzar.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Ciatalgia #NervioCiatico #Neurodinamia #Kinésica`
  },
  {
    id: "34_cervicobraquialgia",
    title: "¿Dolor de cuello que baja al brazo?",
    cat: "CERVICOBRAQUIALGIA",
    group: "columna",
    body: "Cuando el dolor nace en el cuello e irradia al brazo hay tejidos neurales y postura involucrados. Tratamos la causa.",
    feedUrl: "campanas/feed/catalogo_feed_34_cervicobraquialgia.png",
    storyUrl: "campanas/story/catalogo_story_34_cervicobraquialgia.png",
    copy: `¿Dolor de cuello que baja al brazo? 🦾

La cervicobraquialgia mezcla articulación, nervio y postura. En Kinésica tratamos la causa mecánica de raíz.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Cervicobraquialgia #Cervicalgia #Neurodinamia #Kinésica`
  },
  {
    id: "35_pubalgia",
    title: "¿Dolor en la ingle al entrenar?",
    cat: "PUBALGIA",
    group: "articulaciones",
    body: "La pubalgia aparece por sobrecarga de cadera y pelvis. Evaluamos la cadena y tratamos sin forzar el pubis.",
    feedUrl: "campanas/feed/catalogo_feed_35_pubalgia.png",
    storyUrl: "campanas/story/catalogo_story_35_pubalgia.png",
    copy: `¿Dolor en la ingle al entrenar o correr? 🏃‍♂️

La pubalgia pide evaluar cadera, pelvis y cadena abdominal-aductora. Tratamos sin forzar el pubis.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Pubalgia #Deporte #Cadera #Kinésica`
  },
  {
    id: "36_talalgia",
    title: "¿Dolor de talón al dar el primer paso?",
    cat: "TALALGIA",
    group: "articulaciones",
    body: "El dolor de talón afecta cada paso. Evaluamos apoyo del pie y cadena posterior para aliviar la carga.",
    feedUrl: "campanas/feed/catalogo_feed_36_talalgia.png",
    storyUrl: "campanas/story/catalogo_story_36_talalgia.png",
    copy: `¿Dolor de talón al dar el primer paso? 🦶

Evaluamos apoyo del pie y cadena posterior para bajar la carga y recuperar la marcha.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Talalgia #Pie #FascitisPlantar #Kinésica`
  },
  {
    id: "37_dolor_sacroiliaco",
    title: "¿Dolor en la pelvis o cerca del sacro?",
    cat: "DOLOR SACROILÍACO",
    group: "columna",
    body: "El dolor sacroilíaco suele venir de cómo se cargan pelvis, cadera y lumbar. Liberamos la articulación con terapia manual.",
    feedUrl: "campanas/feed/catalogo_feed_37_dolor_sacroiliaco.png",
    storyUrl: "campanas/story/catalogo_story_37_dolor_sacroiliaco.png",
    copy: `¿Dolor cerca del sacro o en la pelvis? 🦴

La articulación sacroilíaca responde a desequilibrios de cadera y lumbar. La liberamos con terapia manual 1 a 1.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Sacroiliaca #Pelvis #Lumbalgia #Kinésica`
  },
  {
    id: "38_protrusion_discal",
    title: "¿Protrusión discal? No es una condena",
    cat: "PROTRUSIÓN DISCAL",
    group: "columna",
    body: "Con evaluación y progresión mejoramos función y confianza al moverte, sin resignarte al dolor.",
    feedUrl: "campanas/feed/catalogo_feed_38_protrusion_discal.png",
    storyUrl: "campanas/story/catalogo_story_38_protrusion_discal.png",
    copy: `¿Protrusión discal? No es una condena. 🛡️

Con evaluación y progresión mejoramos función y confianza al moverte, sin resignarte al dolor.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#ProtrusionDiscal #Columna #RPG #Kinésica`
  },
  {
    id: "39_hipercifosis",
    title: "¿Te ves cada vez más encorvado?",
    cat: "HIPERCIFOSIS",
    group: "columna",
    body: "La hipercifosis rigidiza el dorso y carga cuello y hombros. Recuperamos movilidad torácica con RPG y terapia manual.",
    feedUrl: "campanas/feed/catalogo_feed_39_hipercifosis.png",
    storyUrl: "campanas/story/catalogo_story_39_hipercifosis.png",
    copy: `¿Te ves cada vez más encorvado? 🧍

La hipercifosis rigidiza el dorso y sobrecarga cuello y hombros. Recuperamos movilidad torácica con RPG.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Hipercifosis #Postura #RPG #Kinésica`
  },
  {
    id: "40_hiperlordosis",
    title: "¿Curva lumbar aumentada y dolor?",
    cat: "HIPERLORDOSIS",
    group: "columna",
    body: "La hiperlordosis no es mala por sí misma, pero sin control sobrecarga la zona baja. Reequilibramos pelvis y cadena.",
    feedUrl: "campanas/feed/catalogo_feed_40_hiperlordosis.png",
    storyUrl: "campanas/story/catalogo_story_40_hiperlordosis.png",
    copy: `¿Curva lumbar aumentada y dolor? 🔁

No es “malo” por sí solo: falta control y movilidad. Reequilibramos pelvis y cadena posterior.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Hiperlordosis #Lumbar #Postura #Kinésica`
  },
  {
    id: "41_dorso_plano",
    title: "¿Espalda rígida y sin curva?",
    cat: "DORSO PLANO",
    group: "columna",
    body: "El dorso plano limita la movilidad torácica. Mejoramos flexibilidad y control para reducir sobrecargas.",
    feedUrl: "campanas/feed/catalogo_feed_41_dorso_plano.png",
    storyUrl: "campanas/story/catalogo_story_41_dorso_plano.png",
    copy: `¿Espalda rígida y sin curva? 🧊

El dorso plano limita la movilidad torácica. Mejoramos flexibilidad y control para bajar sobrecargas.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#DorsoPlano #Columna #RPG #Kinésica`
  },
  {
    id: "42_genu_valgo",
    title: "¿Rodillas que se van hacia adentro?",
    cat: "GENU VALGO",
    group: "articulaciones",
    body: "Más que corregir una forma, trabajamos control de cadera y pie para que la rodilla tolere la carga.",
    feedUrl: "campanas/feed/catalogo_feed_42_genu_valgo.png",
    storyUrl: "campanas/story/catalogo_story_42_genu_valgo.png",
    copy: `¿Rodillas que se van hacia adentro? 🦵

Trabajamos control de cadera y pie para que la rodilla tolere mejor la carga al caminar o entrenar.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#GenuValgo #Rodilla #Biomecanica #Kinésica`
  },
  {
    id: "43_genu_varo",
    title: "¿Rodillas que se abren hacia afuera?",
    cat: "GENU VARO",
    group: "articulaciones",
    body: "Trabajamos movilidad, fuerza y mecánica para que la rodilla tolere mejor caminar y entrenar.",
    feedUrl: "campanas/feed/catalogo_feed_43_genu_varo.png",
    storyUrl: "campanas/story/catalogo_story_43_genu_varo.png",
    copy: `¿Rodillas que se abren hacia afuera? 🦵

Mejoramos movilidad, fuerza y mecánica para tolerar mejor la marcha y el entrenamiento.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#GenuVaro #Rodilla #Kinesiologia #Kinésica`
  },
  {
    id: "44_pies_planos",
    title: "¿Pies planos y sobrecarga al caminar?",
    cat: "PIES PLANOS",
    group: "articulaciones",
    body: "El arco bajo no siempre es un problema: evaluamos cómo tolera la carga y si genera síntomas en rodilla o espalda.",
    feedUrl: "campanas/feed/catalogo_feed_44_pies_planos.png",
    storyUrl: "campanas/story/catalogo_story_44_pies_planos.png",
    copy: `¿Pies planos y sobrecarga al caminar? 👣

El arco bajo no siempre es el problema: miramos la carga y si repercute en rodilla o espalda.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#PiesPlanos #Biomecanica #Posturologia #Kinésica`
  },
  {
    id: "45_escoliosis",
    title: "¿Escoliosis con dolor o rigidez?",
    cat: "ESCOLIOSIS",
    group: "columna",
    body: "Buscamos movilidad, fuerza y manejo del dolor con reeducación postural personalizada, no milagros estéticos.",
    feedUrl: "campanas/feed/catalogo_feed_45_escoliosis.png",
    storyUrl: "campanas/story/catalogo_story_45_escoliosis.png",
    copy: `¿Escoliosis con dolor o rigidez? 🌀

Trabajamos movilidad, fuerza y manejo del dolor con RPG personalizada. Sin promesas estéticas milagrosas.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Escoliosis #RPG #Columna #Kinésica`
  },
  {
    id: "46_epicondilitis_lateral",
    title: "¿Codo de tenista sin jugar al tenis?",
    cat: "EPICONDILITIS LATERAL",
    group: "articulaciones",
    body: "También aparece por teclado y sobreuso del antebrazo. Liberamos tendón y cadena del brazo con terapia manual.",
    feedUrl: "campanas/feed/catalogo_feed_46_epicondilitis_lateral.png",
    storyUrl: "campanas/story/catalogo_story_46_epicondilitis_lateral.png",
    copy: `¿Codo de tenista… sin jugar al tenis? 💻

Teclado, mouse y sobreuso del antebrazo también lo disparan. Liberamos tendón y cadena del brazo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Epicondilitis #CodoDeTenista #TerapiaManual #Kinésica`
  },
  {
    id: "47_epicondilitis_medial",
    title: "¿Dolor en la cara interna del codo?",
    cat: "EPICONDILITIS MEDIAL",
    group: "articulaciones",
    body: "La epicondilitis medial aparece por agarre y sobreuso. Tratamos el tendón y la mecánica del antebrazo.",
    feedUrl: "campanas/feed/catalogo_feed_47_epicondilitis_medial.png",
    storyUrl: "campanas/story/catalogo_story_47_epicondilitis_medial.png",
    copy: `¿Dolor en la cara interna del codo? 🏌️

Es la epicondilitis medial (codo de golfista): tratamos tendón y mecánica del antebrazo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#EpicondilitisMedial #Codo #Kinésica`
  },
  {
    id: "48_impingement",
    title: "¿Pinchazo al elevar el brazo?",
    cat: "IMPINGEMENT",
    group: "articulaciones",
    body: "Mejoramos la mecánica de hombro y escápula para que el tendón deje de pinzarse.",
    feedUrl: "campanas/feed/catalogo_feed_48_impingement.png",
    storyUrl: "campanas/story/catalogo_story_48_impingement.png",
    copy: `¿Pinchazo al elevar el brazo? 💥

El impingement subacromial mejora cuando sincronizamos hombro y escápula. Abrimos espacio sin forzar.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Impingement #Hombro #ManguitoRotador #Kinésica`
  },
  {
    id: "49_radiculopatia",
    title: "¿Hormigueo o dolor que se irradia?",
    cat: "RADICULOPATÍA",
    group: "columna",
    body: "La radiculopatía pide evaluación precisa. Dosificamos neurodinamia y terapia manual sin agravar.",
    feedUrl: "campanas/feed/catalogo_feed_49_radiculopatia.png",
    storyUrl: "campanas/story/catalogo_story_49_radiculopatia.png",
    copy: `¿Hormigueo o dolor que se irradia? ⚡️

La radiculopatía pide precisión: neurodinamia y terapia manual dosificadas, sin agravar.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Radiculopatia #Neurodinamia #Columna #Kinésica`
  },
  {
    id: "50_meniscopatia",
    title: "¿Rodilla que duele o se traba?",
    cat: "MENISCOPATÍA",
    group: "articulaciones",
    body: "Recuperamos movilidad y tolerancia a la carga de la rodilla sin apurar cirugías.",
    feedUrl: "campanas/feed/catalogo_feed_50_meniscopatia.png",
    storyUrl: "campanas/story/catalogo_story_50_meniscopatia.png",
    copy: `¿Rodilla que duele o se traba? 🦵

En meniscopatía recuperamos movilidad y tolerancia a la carga, sin apurar cirugías.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Meniscopatia #Rodilla #Gonalgia #Kinésica`
  },
  {
    id: "51_fascitis_plantar",
    title: "¿Dolor en la planta al levantarte?",
    cat: "FASCITIS PLANTAR",
    group: "articulaciones",
    body: "Con carga progresiva y terapia manual el pie recupera tolerancia y función.",
    feedUrl: "campanas/feed/catalogo_feed_51_fascitis_plantar.png",
    storyUrl: "campanas/story/catalogo_story_51_fascitis_plantar.png",
    copy: `¿Dolor en la planta al levantarte? 🌅

La fascitis plantar mejora con carga progresiva y terapia manual sobre pie y cadena posterior.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#FascitisPlantar #Talon #Pie #Kinésica`
  },
  {
    id: "52_cervicalgia",
    title: "¿Cuello cargado todo el día?",
    cat: "CERVICALGIA",
    group: "columna",
    body: "El dolor cervical mejora con movilidad, postura y terapia manual sobre la causa mecánica.",
    feedUrl: "campanas/feed/catalogo_feed_52_cervicalgia.png",
    storyUrl: "campanas/story/catalogo_story_52_cervicalgia.png",
    copy: `¿Cuello cargado todo el día? 😣

La cervicalgia mejora con movilidad, postura y terapia manual sobre la causa mecánica.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Cervicalgia #Cuello #Osteopatia #Kinésica`
  },
  {
    id: "53_hombro_congelado",
    title: "¿Hombro rígido que no gira?",
    cat: "HOMBRO CONGELADO",
    group: "articulaciones",
    body: "La capsulitis adhesiva pide un plan gradual: restauramos movimiento sin forzar la cápsula.",
    feedUrl: "campanas/feed/catalogo_feed_53_hombro_congelado.png",
    storyUrl: "campanas/story/catalogo_story_53_hombro_congelado.png",
    copy: `¿Hombro rígido que no gira? 🧊

La capsulitis adhesiva pide paciencia y técnica: restauramos movimiento sin forzar la cápsula.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#HombroCongelado #Capsulitis #Hombro #Kinésica`
  },
  {
    id: "54_contracturas",
    title: "¿Contractura o secuela de desgarro?",
    cat: "CONTRACTURAS Y DESGARROS",
    group: "articulaciones",
    body: "Recuperamos tejido y carga progresiva para volver a moverte sin miedo a recaer.",
    feedUrl: "campanas/feed/catalogo_feed_54_contracturas.png",
    storyUrl: "campanas/story/catalogo_story_54_contracturas.png",
    copy: `¿Contractura o secuela de desgarro? 💪

Trabajamos tejido y carga progresiva para volver a moverte sin miedo a recaer.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Contractura #Desgarro #Rehabilitacion #Kinésica`
  },
  {
    id: "55_tunel_carpiano",
    title: "¿Hormigueo en la mano al dormir?",
    cat: "TÚNEL CARPIANO",
    group: "articulaciones",
    body: "Abordamos muñeca, nervio y cadena del brazo con terapia manual y neurodinamia.",
    feedUrl: "campanas/feed/catalogo_feed_55_tunel_carpiano.png",
    storyUrl: "campanas/story/catalogo_story_55_tunel_carpiano.png",
    copy: `¿Hormigueo en la mano al dormir? 🖐️

El túnel carpiano mejora abordando muñeca, nervio y cadena del brazo con neurodinamia.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#TunelCarpiano #Muneca #Neurodinamia #Kinésica`
  },
  {
    id: "56_coxalgia",
    title: "¿Dolor de cadera al caminar?",
    cat: "COXALGIA",
    group: "articulaciones",
    body: "Puede nacer en la articulación o por compensación de pelvis y lumbar. Evaluamos el conjunto.",
    feedUrl: "campanas/feed/catalogo_feed_56_coxalgia.png",
    storyUrl: "campanas/story/catalogo_story_56_coxalgia.png",
    copy: `¿Dolor de cadera al caminar? 🚶

Puede nacer en la articulación o por compensación de pelvis y lumbar. Evaluamos el conjunto.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Coxalgia #Cadera #Osteopatia #Kinésica`
  },
  {
    id: "57_rectificacion",
    title: "¿Perdiste la curva de la columna?",
    cat: "RECTIFICACIÓN",
    group: "columna",
    body: "La rectificación cervical o lumbar rigidiza y duele. Recuperamos movilidad con reeducación postural.",
    feedUrl: "campanas/feed/catalogo_feed_57_rectificacion.png",
    storyUrl: "campanas/story/catalogo_story_57_rectificacion.png",
    copy: `¿Perdiste la curva de la columna? 📏

La rectificación cervical o lumbar rigidiza y duele. Recuperamos movilidad con RPG.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Rectificacion #Cervical #Lumbar #RPG #Kinésica`
  },

  // Fila 9: Catálogo — una pieza por cada patología del sitio
  {
    id: "58_cat_cefalea",
    title: "Cefalea: cuando la cabeza no afloja",
    cat: "CEFALEA",
    group: "columna",
    body: "Evaluamos cuello, mandíbula y postura para tratar la causa mecánica del dolor de cabeza.",
    feedUrl: "campanas/feed/catalogo_feed_58_cat_cefalea.png",
    storyUrl: "campanas/story/catalogo_story_58_cat_cefalea.png",
    copy: `Cefalea: cuando la cabeza no afloja 🩺

En Kinésica tratamos cefalea: cuello, mandíbula y postura.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Cefalea #Cervicalgia #ATM #Kinésica`
  },
  {
    id: "59_cat_dorsalgia",
    title: "Dorsalgia: dolor en la espalda alta",
    cat: "DORSALGIA",
    group: "columna",
    body: "Liberamos la rigidez torácica y las posturas sostenidas que cargan la espalda media.",
    feedUrl: "campanas/feed/catalogo_feed_59_cat_dorsalgia.png",
    storyUrl: "campanas/story/catalogo_story_59_cat_dorsalgia.png",
    copy: `Dorsalgia: dolor en la espalda alta 🩺

En Kinésica tratamos dorsalgia: rigidez torácica y posturas sostenidas.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Dorsalgia #EspaldaAlta #Kinésica`
  },
  {
    id: "60_cat_lumbalgia",
    title: "Lumbalgia: dolor lumbar recurrente",
    cat: "LUMBALGIA",
    group: "columna",
    body: "Buscamos el origen mecánico en pelvis, cadera y columna con osteopatía y terapia manual 1 a 1.",
    feedUrl: "campanas/feed/catalogo_feed_60_cat_lumbalgia.png",
    storyUrl: "campanas/story/catalogo_story_60_cat_lumbalgia.png",
    copy: `Lumbalgia: dolor lumbar recurrente 🩺

En Kinésica tratamos lumbalgia: pelvis, cadera y columna.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Lumbalgia #DolorLumbar #Osteopatia #Kinésica`
  },
  {
    id: "61_cat_ciatalgia",
    title: "Ciatalgia: dolor que baja por la pierna",
    cat: "CIATALGIA",
    group: "columna",
    body: "Evaluamos lumbar y nervio ciático con neurodinamia suave, sin forzar el síntoma.",
    feedUrl: "campanas/feed/catalogo_feed_61_cat_ciatalgia.png",
    storyUrl: "campanas/story/catalogo_story_61_cat_ciatalgia.png",
    copy: `Ciatalgia: dolor que baja por la pierna 🩺

En Kinésica tratamos ciatalgia: lumbar y nervio ciático.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Ciatalgia #Neurodinamia #Kinésica`
  },
  {
    id: "62_cat_cervicobraquialgia",
    title: "Cervicobraquialgia: del cuello al brazo",
    cat: "CERVICOBRAQUIALGIA",
    group: "columna",
    body: "Cuando el dolor nace en el cuello e irradia al brazo, tratamos nervio, articulación y postura.",
    feedUrl: "campanas/feed/catalogo_feed_62_cat_cervicobraquialgia.png",
    storyUrl: "campanas/story/catalogo_story_62_cat_cervicobraquialgia.png",
    copy: `Cervicobraquialgia: del cuello al brazo 🩺

En Kinésica tratamos cervicobraquialgia: nervio, articulación y postura.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Cervicobraquialgia #Cuello #Kinésica`
  },
  {
    id: "63_cat_pubalgia",
    title: "Pubalgia: dolor en ingle y pubis",
    cat: "PUBALGIA",
    group: "articulaciones",
    body: "Evaluamos cadera, pelvis y cadena aductora para aliviar la pubalgia sin forzar.",
    feedUrl: "campanas/feed/catalogo_feed_63_cat_pubalgia.png",
    storyUrl: "campanas/story/catalogo_story_63_cat_pubalgia.png",
    copy: `Pubalgia: dolor en ingle y pubis 🩺

En Kinésica tratamos pubalgia: cadera, pelvis y cadena aductora.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Pubalgia #Deporte #Kinésica`
  },
  {
    id: "64_cat_gonalgia",
    title: "Gonalgia: dolor de rodilla",
    cat: "GONALGIA",
    group: "articulaciones",
    body: "La rodilla suele ser víctima de cadera o pie. Reequilibramos el eje para aliviar la gonalgia.",
    feedUrl: "campanas/feed/catalogo_feed_64_cat_gonalgia.png",
    storyUrl: "campanas/story/catalogo_story_64_cat_gonalgia.png",
    copy: `Gonalgia: dolor de rodilla 🩺

En Kinésica tratamos gonalgia: el eje de cadera, rodilla y pie.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Gonalgia #Rodilla #Kinésica`
  },
  {
    id: "65_cat_talalgia",
    title: "Talalgia: dolor de talón",
    cat: "TALALGIA",
    group: "articulaciones",
    body: "Evaluamos apoyo del pie y cadena posterior para que cada paso deje de doler.",
    feedUrl: "campanas/feed/catalogo_feed_65_cat_talalgia.png",
    storyUrl: "campanas/story/catalogo_story_65_cat_talalgia.png",
    copy: `Talalgia: dolor de talón 🩺

En Kinésica tratamos talalgia: apoyo del pie y cadena posterior.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Talalgia #Pie #Kinésica`
  },
  {
    id: "66_cat_dolor_sacroiliaco",
    title: "Dolor sacroilíaco: pelvis y zona baja",
    cat: "DOLOR SACROILÍACO",
    group: "columna",
    body: "Liberamos la articulación sacroilíaca y reequilibramos pelvis, cadera y lumbar.",
    feedUrl: "campanas/feed/catalogo_feed_66_cat_dolor_sacroiliaco.png",
    storyUrl: "campanas/story/catalogo_story_66_cat_dolor_sacroiliaco.png",
    copy: `Dolor sacroilíaco: pelvis y zona baja 🩺

En Kinésica tratamos dolor sacroilíaco: pelvis, cadera y lumbar.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Sacroiliaca #Pelvis #Kinésica`
  },
  {
    id: "67_cat_hernia_disco",
    title: "Hernia de disco: dolor y recuperación",
    cat: "HERNIA DE DISCO",
    group: "columna",
    body: "En muchos casos el tratamiento conservador con RPG y terapia manual descomprime sin cirugía.",
    feedUrl: "campanas/feed/catalogo_feed_67_cat_hernia_disco.png",
    storyUrl: "campanas/story/catalogo_story_67_cat_hernia_disco.png",
    copy: `Hernia de disco: dolor y recuperación 🩺

En Kinésica tratamos hernia de disco: RPG y terapia manual.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#HerniaDeDisco #RPG #Kinésica`
  },
  {
    id: "68_cat_protrusion_discal",
    title: "Protrusión discal: movilidad sin miedo",
    cat: "PROTRUSIÓN DISCAL",
    group: "columna",
    body: "Con evaluación y progresión mejoramos función y confianza al moverte.",
    feedUrl: "campanas/feed/catalogo_feed_68_cat_protrusion_discal.png",
    storyUrl: "campanas/story/catalogo_story_68_cat_protrusion_discal.png",
    copy: `Protrusión discal: movilidad sin miedo 🩺

En Kinésica tratamos protrusión discal: evaluación y progresión funcional.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#ProtrusionDiscal #Columna #Kinésica`
  },
  {
    id: "69_cat_hipercifosis",
    title: "Hipercifosis: curvatura dorsal aumentada",
    cat: "HIPERCIFOSIS",
    group: "columna",
    body: "Recuperamos movilidad torácica con RPG para aliviar cuello, hombros y postura.",
    feedUrl: "campanas/feed/catalogo_feed_69_cat_hipercifosis.png",
    storyUrl: "campanas/story/catalogo_story_69_cat_hipercifosis.png",
    copy: `Hipercifosis: curvatura dorsal aumentada 🩺

En Kinésica tratamos hipercifosis: movilidad torácica con RPG.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Hipercifosis #Postura #Kinésica`
  },
  {
    id: "70_cat_hiperlordosis",
    title: "Hiperlordosis: curva lumbar aumentada",
    cat: "HIPERLORDOSIS",
    group: "columna",
    body: "Reequilibramos pelvis y cadena para que la lordosis deje de sobrecargar la zona baja.",
    feedUrl: "campanas/feed/catalogo_feed_70_cat_hiperlordosis.png",
    storyUrl: "campanas/story/catalogo_story_70_cat_hiperlordosis.png",
    copy: `Hiperlordosis: curva lumbar aumentada 🩺

En Kinésica tratamos hiperlordosis: pelvis y cadena posterior.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Hiperlordosis #Lumbar #Kinésica`
  },
  {
    id: "71_cat_dorso_plano",
    title: "Dorso plano: rigidez y postura",
    cat: "DORSO PLANO",
    group: "columna",
    body: "Mejoramos movilidad torácica y control para reducir sobrecargas de un dorso rígido.",
    feedUrl: "campanas/feed/catalogo_feed_71_cat_dorso_plano.png",
    storyUrl: "campanas/story/catalogo_story_71_cat_dorso_plano.png",
    copy: `Dorso plano: rigidez y postura 🩺

En Kinésica tratamos dorso plano: movilidad torácica y control.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#DorsoPlano #Columna #Kinésica`
  },
  {
    id: "72_cat_genu_valgo",
    title: "Genu valgo: rodillas hacia adentro",
    cat: "GENU VALGO",
    group: "articulaciones",
    body: "Trabajamos control de cadera y pie para que la rodilla tolere mejor la carga.",
    feedUrl: "campanas/feed/catalogo_feed_72_cat_genu_valgo.png",
    storyUrl: "campanas/story/catalogo_story_72_cat_genu_valgo.png",
    copy: `Genu valgo: rodillas hacia adentro 🩺

En Kinésica tratamos genu valgo: control de cadera y pie.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#GenuValgo #Rodilla #Kinésica`
  },
  {
    id: "73_cat_genu_varo",
    title: "Genu varo: rodillas hacia afuera",
    cat: "GENU VARO",
    group: "articulaciones",
    body: "Mejoramos movilidad, fuerza y mecánica para tolerar marcha y entrenamiento.",
    feedUrl: "campanas/feed/catalogo_feed_73_cat_genu_varo.png",
    storyUrl: "campanas/story/catalogo_story_73_cat_genu_varo.png",
    copy: `Genu varo: rodillas hacia afuera 🩺

En Kinésica tratamos genu varo: movilidad, fuerza y mecánica.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#GenuVaro #Rodilla #Kinésica`
  },
  {
    id: "74_cat_pies_planos",
    title: "Pies planos: apoyo y sobrecarga",
    cat: "PIES PLANOS",
    group: "articulaciones",
    body: "Evaluamos cómo tolera la carga el arco y si repercute en rodilla o espalda.",
    feedUrl: "campanas/feed/catalogo_feed_74_cat_pies_planos.png",
    storyUrl: "campanas/story/catalogo_story_74_cat_pies_planos.png",
    copy: `Pies planos: apoyo y sobrecarga 🩺

En Kinésica tratamos pies planos: carga del arco y compensaciones.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#PiesPlanos #Biomecanica #Kinésica`
  },
  {
    id: "75_cat_escoliosis",
    title: "Escoliosis: postura, dolor y movimiento",
    cat: "ESCOLIOSIS",
    group: "columna",
    body: "Mejoramos movilidad y fuerza con RPG personalizada, sin milagros estéticos.",
    feedUrl: "campanas/feed/catalogo_feed_75_cat_escoliosis.png",
    storyUrl: "campanas/story/catalogo_story_75_cat_escoliosis.png",
    copy: `Escoliosis: postura, dolor y movimiento 🩺

En Kinésica tratamos escoliosis: RPG personalizada.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Escoliosis #RPG #Kinésica`
  },
  {
    id: "76_cat_epicondilitis_lateral",
    title: "Epicondilitis lateral: codo de tenista",
    cat: "EPICONDILITIS LATERAL",
    group: "articulaciones",
    body: "También aparece por teclado y sobreuso. Liberamos tendón y cadena del antebrazo.",
    feedUrl: "campanas/feed/catalogo_feed_76_cat_epicondilitis_lateral.png",
    storyUrl: "campanas/story/catalogo_story_76_cat_epicondilitis_lateral.png",
    copy: `Epicondilitis lateral: codo de tenista 🩺

En Kinésica tratamos epicondilitis lateral: tendón y cadena del antebrazo.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Epicondilitis #CodoDeTenista #Kinésica`
  },
  {
    id: "77_cat_epicondilitis_medial",
    title: "Epicondilitis medial: codo de golfista",
    cat: "EPICONDILITIS MEDIAL",
    group: "articulaciones",
    body: "Tratamos el tendón y la mecánica del antebrazo por agarre y sobreuso.",
    feedUrl: "campanas/feed/catalogo_feed_77_cat_epicondilitis_medial.png",
    storyUrl: "campanas/story/catalogo_story_77_cat_epicondilitis_medial.png",
    copy: `Epicondilitis medial: codo de golfista 🩺

En Kinésica tratamos epicondilitis medial: tendón y mecánica del antebrazo.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#EpicondilitisMedial #Codo #Kinésica`
  },
  {
    id: "78_cat_impingement",
    title: "Impingement subacromial: pinchazo al elevar",
    cat: "IMPINGEMENT SUBACROMIAL",
    group: "articulaciones",
    body: "Sincronizamos hombro y escápula para que el tendón deje de pinzarse.",
    feedUrl: "campanas/feed/catalogo_feed_78_cat_impingement.png",
    storyUrl: "campanas/story/catalogo_story_78_cat_impingement.png",
    copy: `Impingement subacromial: pinchazo al elevar 🩺

En Kinésica tratamos impingement subacromial: mecánica de hombro y escápula.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Impingement #Hombro #Kinésica`
  },
  {
    id: "79_cat_manguito_rotador",
    title: "Manguito rotador: dolor y fuerza de hombro",
    cat: "MANGUITO ROTADOR",
    group: "articulaciones",
    body: "Reabrimos el espacio articular y recuperamos fuerza sin forzar el tendón.",
    feedUrl: "campanas/feed/catalogo_feed_79_cat_manguito_rotador.png",
    storyUrl: "campanas/story/catalogo_story_79_cat_manguito_rotador.png",
    copy: `Manguito rotador: dolor y fuerza de hombro 🩺

En Kinésica tratamos manguito rotador: espacio articular y fuerza.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#ManguitoRotador #Hombro #Kinésica`
  },
  {
    id: "80_cat_radiculopatia",
    title: "Radiculopatía: dolor irradiado y hormigueo",
    cat: "RADICULOPATÍA",
    group: "columna",
    body: "Dosificamos neurodinamia y terapia manual con precisión, sin agravar.",
    feedUrl: "campanas/feed/catalogo_feed_80_cat_radiculopatia.png",
    storyUrl: "campanas/story/catalogo_story_80_cat_radiculopatia.png",
    copy: `Radiculopatía: dolor irradiado y hormigueo 🩺

En Kinésica tratamos radiculopatía: neurodinamia dosificada.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Radiculopatia #Neurodinamia #Kinésica`
  },
  {
    id: "81_cat_meniscopatia",
    title: "Meniscopatía: dolor y bloqueo de rodilla",
    cat: "MENISCOPATÍA",
    group: "articulaciones",
    body: "Recuperamos movilidad y tolerancia a la carga sin apurar cirugías.",
    feedUrl: "campanas/feed/catalogo_feed_81_cat_meniscopatia.png",
    storyUrl: "campanas/story/catalogo_story_81_cat_meniscopatia.png",
    copy: `Meniscopatía: dolor y bloqueo de rodilla 🩺

En Kinésica tratamos meniscopatía: movilidad y tolerancia a la carga.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Meniscopatia #Rodilla #Kinésica`
  },
  {
    id: "82_cat_fascitis_plantar",
    title: "Fascitis plantar: dolor en el arco del pie",
    cat: "FASCITIS PLANTAR",
    group: "articulaciones",
    body: "Con carga progresiva y terapia manual el pie recupera tolerancia y función.",
    feedUrl: "campanas/feed/catalogo_feed_82_cat_fascitis_plantar.png",
    storyUrl: "campanas/story/catalogo_story_82_cat_fascitis_plantar.png",
    copy: `Fascitis plantar: dolor en el arco del pie 🩺

En Kinésica tratamos fascitis plantar: carga progresiva y terapia manual.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#FascitisPlantar #Pie #Kinésica`
  },
  {
    id: "83_cat_cervicalgia",
    title: "Cervicalgia: dolor de cuello",
    cat: "CERVICALGIA",
    group: "columna",
    body: "Mejoramos movilidad y postura con terapia manual sobre la causa mecánica.",
    feedUrl: "campanas/feed/catalogo_feed_83_cat_cervicalgia.png",
    storyUrl: "campanas/story/catalogo_story_83_cat_cervicalgia.png",
    copy: `Cervicalgia: dolor de cuello 🩺

En Kinésica tratamos cervicalgia: movilidad y postura.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Cervicalgia #Cuello #Kinésica`
  },
  {
    id: "84_cat_bruxismo",
    title: "Bruxismo: tensión de la ATM",
    cat: "BRUXISMO",
    group: "columna",
    body: "Liberamos maseteros, cuello y postura para desactivar el apriete de raíz.",
    feedUrl: "campanas/feed/catalogo_feed_84_cat_bruxismo.png",
    storyUrl: "campanas/story/catalogo_story_84_cat_bruxismo.png",
    copy: `Bruxismo: tensión de la ATM 🩺

En Kinésica tratamos bruxismo: maseteros, cuello y postura.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Bruxismo #ATM #Kinésica`
  },
  {
    id: "85_cat_desplazamiento_disco_atm",
    title: "Desplazamiento del disco de la ATM",
    cat: "DISCO ATM",
    group: "columna",
    body: "Restauramos el deslizamiento articular con terapia manual suave, sin forzar.",
    feedUrl: "campanas/feed/catalogo_feed_85_cat_desplazamiento_disco_atm.png",
    storyUrl: "campanas/story/catalogo_story_85_cat_desplazamiento_disco_atm.png",
    copy: `Desplazamiento del disco de la ATM 🩺

En Kinésica tratamos desplazamiento del disco de la atm: deslizamiento articular suave.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#ATM #DiscoArticular #Kinésica`
  },
  {
    id: "86_cat_artrosis_atm",
    title: "Artrosis e inflamación de la ATM",
    cat: "ARTROSIS ATM",
    group: "columna",
    body: "Suavizamos la articulación y liberamos masticatorios para mover la mandíbula con menos dolor.",
    feedUrl: "campanas/feed/catalogo_feed_86_cat_artrosis_atm.png",
    storyUrl: "campanas/story/catalogo_story_86_cat_artrosis_atm.png",
    copy: `Artrosis e inflamación de la ATM 🩺

En Kinésica tratamos artrosis de la atm: articulación y masticatorios.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#ArtrosisATM #Mandibula #Kinésica`
  },
  {
    id: "87_cat_torticolis",
    title: "Tortícolis: cuello rígido y doloroso",
    cat: "TORTÍCOLIS",
    group: "columna",
    body: "Descomprimimos carillas cervicales y músculos con movilizaciones suaves.",
    feedUrl: "campanas/feed/catalogo_feed_87_cat_torticolis.png",
    storyUrl: "campanas/story/catalogo_story_87_cat_torticolis.png",
    copy: `Tortícolis: cuello rígido y doloroso 🩺

En Kinésica tratamos tortícolis: carillas cervicales y músculos.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Torticolis #Cervicalgia #Kinésica`
  },
  {
    id: "88_cat_artrosis_artritis",
    title: "Artrosis y artritis: dolor articular",
    cat: "ARTROSIS Y ARTRITIS",
    group: "articulaciones",
    body: "Flexibilizamos cápsula y tejidos para bajar la presión sobre el cartílago.",
    feedUrl: "campanas/feed/catalogo_feed_88_cat_artrosis_artritis.png",
    storyUrl: "campanas/story/catalogo_story_88_cat_artrosis_artritis.png",
    copy: `Artrosis y artritis: dolor articular 🩺

En Kinésica tratamos artrosis y artritis: cápsula y tejidos periarticulares.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Artrosis #Artritis #Kinésica`
  },
  {
    id: "89_cat_hombro_congelado",
    title: "Hombro congelado: rigidez y dolor",
    cat: "HOMBRO CONGELADO",
    group: "articulaciones",
    body: "Plan gradual para restaurar movimiento sin forzar la cápsula adhesiva.",
    feedUrl: "campanas/feed/catalogo_feed_89_cat_hombro_congelado.png",
    storyUrl: "campanas/story/catalogo_story_89_cat_hombro_congelado.png",
    copy: `Hombro congelado: rigidez y dolor 🩺

En Kinésica tratamos hombro congelado: movimiento gradual de la cápsula.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#HombroCongelado #Capsulitis #Kinésica`
  },
  {
    id: "90_cat_contracturas",
    title: "Contracturas y secuelas de desgarros",
    cat: "CONTRACTURAS Y DESGARROS",
    group: "articulaciones",
    body: "Recuperamos tejido y carga progresiva para volver a moverte sin miedo a recaer.",
    feedUrl: "campanas/feed/catalogo_feed_90_cat_contracturas.png",
    storyUrl: "campanas/story/catalogo_story_90_cat_contracturas.png",
    copy: `Contracturas y secuelas de desgarros 🩺

En Kinésica tratamos contracturas y desgarros: tejido y carga progresiva.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Contractura #Desgarro #Kinésica`
  },
  {
    id: "91_cat_tunel_carpiano",
    title: "Túnel carpiano: dolor de muñeca-mano",
    cat: "TÚNEL CARPIANO",
    group: "articulaciones",
    body: "Abordamos muñeca, nervio y cadena del brazo con neurodinamia y terapia manual.",
    feedUrl: "campanas/feed/catalogo_feed_91_cat_tunel_carpiano.png",
    storyUrl: "campanas/story/catalogo_story_91_cat_tunel_carpiano.png",
    copy: `Túnel carpiano: dolor de muñeca-mano 🩺

En Kinésica tratamos túnel carpiano: muñeca, nervio y cadena del brazo.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#TunelCarpiano #Neurodinamia #Kinésica`
  },
  {
    id: "92_cat_coxalgia",
    title: "Coxalgia: dolor de cadera",
    cat: "COXALGIA",
    group: "articulaciones",
    body: "Puede nacer en la articulación o por compensación de pelvis y lumbar. Evaluamos el conjunto.",
    feedUrl: "campanas/feed/catalogo_feed_92_cat_coxalgia.png",
    storyUrl: "campanas/story/catalogo_story_92_cat_coxalgia.png",
    copy: `Coxalgia: dolor de cadera 🩺

En Kinésica tratamos coxalgia: cadera, pelvis y lumbar.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Coxalgia #Cadera #Kinésica`
  },
  {
    id: "93_cat_oclusion_dental",
    title: "Oclusión dental y trastornos de la ATM",
    cat: "OCLUSIÓN DENTAL",
    group: "columna",
    body: "La mordida se relaciona con cuello y postura. Tratamos la ATM en conjunto con la cadena cervical.",
    feedUrl: "campanas/feed/catalogo_feed_93_cat_oclusion_dental.png",
    storyUrl: "campanas/story/catalogo_story_93_cat_oclusion_dental.png",
    copy: `Oclusión dental y trastornos de la ATM 🩺

En Kinésica tratamos oclusión dental: ATM y cadena cervical.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#OclusionDental #ATM #Kinésica`
  },
  {
    id: "94_cat_rectificacion",
    title: "Rectificación cervical y lumbar",
    cat: "RECTIFICACIÓN",
    group: "columna",
    body: "Recuperamos las curvas fisiológicas y la movilidad con reeducación postural.",
    feedUrl: "campanas/feed/catalogo_feed_94_cat_rectificacion.png",
    storyUrl: "campanas/story/catalogo_story_94_cat_rectificacion.png",
    copy: `Rectificación cervical y lumbar 🩺

En Kinésica tratamos rectificación cervical y lumbar: curvas fisiológicas y RPG.

Sesiones 1 a 1 de terapia manual en Palermo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Rectificacion #Columna #Kinésica`
  },
  // Tanda sensibilización adultos/jóvenes (95–122)
  {
    id: "95_escoliosis_espejo",
    title: "¿Notás un hombro más alto en el espejo?",
    cat: "ESCOLIOSIS",
    group: "columna",
    body: "La asimetría no es un detalle estético. Evaluamos la curva y cómo tu cuerpo la compensa antes de que duela.",
    feedUrl: "campanas/feed/catalogo_feed_95_escoliosis_espejo.png",
    storyUrl: "campanas/story/catalogo_story_95_escoliosis_espejo.png",
    copy: `¿Notás un hombro más alto en el espejo? 🪞

No es un detalle estético: puede ser cómo tu columna se organiza. En Kinésica evaluamos la curva y las compensaciones con RPG personalizada.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Escoliosis #Postura #RPG #KinesiologiaPalermo #Kinésica`
  },
  {
    id: "96_escoliosis_foto",
    title: "En las fotos siempre salís ladeado",
    cat: "ESCOLIOSIS",
    group: "columna",
    body: "No es el ángulo de la cámara. Puede ser cómo tu columna se organiza. Conviene mirarlo a tiempo.",
    feedUrl: "campanas/feed/catalogo_feed_96_escoliosis_foto.png",
    storyUrl: "campanas/story/catalogo_story_96_escoliosis_foto.png",
    copy: `En las fotos siempre salís ladeado 📸

No siempre es el ángulo. A veces es la columna. Una evaluación a tiempo evita que la compensación se fije.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Escoliosis #Jovenes #Postura #Kinésica`
  },
  {
    id: "97_mochila_hombro",
    title: "La mochila de un solo hombro no es inocente",
    cat: "POSTURA & CARGA",
    group: "filosofia",
    body: "Cargar siempre del mismo lado enseña a tu columna a compensar. Lo corregimos antes de que se fije.",
    feedUrl: "campanas/feed/catalogo_feed_97_mochila_hombro.png",
    storyUrl: "campanas/story/catalogo_story_97_mochila_hombro.png",
    copy: `La mochila de un solo hombro no es inocente 🎒

Cargar siempre del mismo lado enseña a tu columna a compensar. En Kinésica corregimos hábitos y reeducamos la postura antes de que duela.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Postura #Estudiantes #EscoliosisFuncional #Kinésica`
  },
  {
    id: "98_escoliosis_crecimiento",
    title: "Te dijeron que era del crecimiento",
    cat: "ESCOLIOSIS",
    group: "columna",
    body: "Y nunca se controló. La escoliosis en adultos jóvenes se puede acompañar con RPG: movilidad, fuerza y menos compensación.",
    feedUrl: "campanas/feed/catalogo_feed_98_escoliosis_crecimiento.png",
    storyUrl: "campanas/story/catalogo_story_98_escoliosis_crecimiento.png",
    copy: `Te dijeron que era “del crecimiento”… y nunca se controló 🩺

La escoliosis en adultos jóvenes se puede acompañar con RPG: más movilidad, más fuerza y menos compensación. Sin milagros estéticos.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Escoliosis #RPG #AdultosJovenes #Kinésica`
  },
  {
    id: "99_ciatica_sentado",
    title: "¿Te duele la pierna al sentarte mucho?",
    cat: "CIÁTICA",
    group: "columna",
    body: "Ese tirón que baja no es “estar cansado”. Evaluamos lumbar y nervio ciático sin forzar el síntoma.",
    feedUrl: "campanas/feed/catalogo_feed_99_ciatica_sentado.png",
    storyUrl: "campanas/story/catalogo_story_99_ciatica_sentado.png",
    copy: `¿Te duele la pierna al sentarte mucho? 🪑⚡

Ese tirón que baja no es “cansancio”. Evaluamos lumbar y nervio ciático con abordaje suave, sin forzar el síntoma.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Ciatica #Ciatalgia #DolorLumbar #Kinésica`
  },
  {
    id: "100_ciatica_baja",
    title: "Si el dolor baja hasta el pie, escuchalo",
    cat: "CIATALGIA",
    group: "columna",
    body: "No es un tirón muscular cualquiera. Tratamos la causa mecánica: columna, pelvis y movilidad neural.",
    feedUrl: "campanas/feed/catalogo_feed_100_ciatica_baja.png",
    storyUrl: "campanas/story/catalogo_story_100_ciatica_baja.png",
    copy: `Si el dolor baja hasta el pie, escuchalo 🦵

No es un tirón cualquiera. En Kinésica tratamos la causa mecánica: columna, pelvis y movilidad neural.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Ciatica #NervioCiatico #TerapiaManual #Kinésica`
  },
  {
    id: "101_ciatica_manejar",
    title: "Después de manejar, la pierna no responde",
    cat: "CIÁTICA",
    group: "columna",
    body: "Estar sentado en auto comprime lumbar y ciático. Recuperamos movilidad antes de que se cronifique.",
    feedUrl: "campanas/feed/catalogo_feed_101_ciatica_manejar.png",
    storyUrl: "campanas/story/catalogo_story_101_ciatica_manejar.png",
    copy: `Después de manejar, la pierna no responde 🚗

Horas de auto comprimen lumbar y ciático. Recuperamos movilidad antes de que se cronifique.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Ciatica #Conductores #DolorLumbar #Kinésica`
  },
  {
    id: "102_ciatica_tos",
    title: "¿Te duele la pierna al toser?",
    cat: "SEÑAL DE ALERTA",
    group: "columna",
    body: "Ese disparo no es casual. Puede hablar de irritación neural o lumbar. Mejor evaluarlo que ignorarlo.",
    feedUrl: "campanas/feed/catalogo_feed_102_ciatica_tos.png",
    storyUrl: "campanas/story/catalogo_story_102_ciatica_tos.png",
    copy: `¿Te duele la pierna al toser o estornudar? 🚨

Ese disparo no es casual. Puede hablar de irritación neural o lumbar. Mejor evaluarlo que ignorarlo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Ciatica #SenalDeAlerta #Columna #Kinésica`
  },
  {
    id: "103_contractura_masaje",
    title: "Si el masaje dura dos días, no alcanza",
    cat: "CONTRACTURAS",
    group: "articulaciones",
    body: "La contractura fuerte vuelve porque la causa mecánica sigue ahí. Buscamos por qué se carga, no solo aflojar el músculo.",
    feedUrl: "campanas/feed/catalogo_feed_103_contractura_masaje.png",
    storyUrl: "campanas/story/catalogo_story_103_contractura_masaje.png",
    copy: `Si el masaje dura dos días, no alcanza 💆

La contractura fuerte vuelve porque la causa mecánica sigue ahí. En Kinésica buscamos por qué se carga, no solo aflojar el músculo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Contracturas #TerapiaManual #DolorMuscular #Kinésica`
  },
  {
    id: "104_trapecio_piedra",
    title: "Trapecio de piedra no es solo estrés",
    cat: "CONTRACTURA",
    group: "articulaciones",
    body: "El cuerpo se defiende con tensión. Liberamos cervicales y postura para que deje de endurecerse cada tarde.",
    feedUrl: "campanas/feed/catalogo_feed_104_trapecio_piedra.png",
    storyUrl: "campanas/story/catalogo_story_104_trapecio_piedra.png",
    copy: `Trapecio de piedra no es “solo estrés” 🪨

El cuerpo se defiende con tensión. Liberamos cervicales y postura para que deje de endurecerse cada tarde.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Contractura #Cuello #HomeOffice #Kinésica`
  },
  {
    id: "105_crack_cuello",
    title: "Hacés crack todo el día y vuelve peor",
    cat: "ALERTA",
    group: "filosofia",
    body: "El ruido no es liberación real. Trabajamos la hipomovilidad que te empuja a forzar la cervical.",
    feedUrl: "campanas/feed/catalogo_feed_105_crack_cuello.png",
    storyUrl: "campanas/story/catalogo_story_105_crack_cuello.png",
    copy: `¿Hacés crack todo el día y vuelve peor? ⚠️

El ruido no es liberación real. Trabajamos la hipomovilidad que te empuja a forzar la cervical.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Cervicalgia #Contractura #Osteopatia #Kinésica`
  },
  {
    id: "106_gym_contractura",
    title: "Entrenas con el cuello trabado. Pará.",
    cat: "ENTRENO & DOLOR",
    group: "articulaciones",
    body: "Empujar fuerza sobre una contractura fija el problema. Primero movilidad, después rendimiento.",
    feedUrl: "campanas/feed/catalogo_feed_106_gym_contractura.png",
    storyUrl: "campanas/story/catalogo_story_106_gym_contractura.png",
    copy: `Entrenas con el cuello trabado. Pará. 🏋️

Empujar fuerza sobre una contractura fija el problema. Primero movilidad, después rendimiento.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Gym #Contractura #Rendimiento #Kinésica`
  },
  {
    id: "107_postura_gamer",
    title: "Seis horas de pantalla, cero de columna",
    cat: "POSTURA GAMER",
    group: "filosofia",
    body: "Tu cuello no es un soporte de monitor. Realineamos cervicales antes de que el dolor se vuelva fijo.",
    feedUrl: "campanas/feed/catalogo_feed_107_postura_gamer.png",
    storyUrl: "campanas/story/catalogo_story_107_postura_gamer.png",
    copy: `Seis horas de pantalla, cero de columna 🎮

Tu cuello no es un soporte de monitor. Realineamos cervicales antes de que el dolor se vuelva fijo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Gamers #TechNeck #Postura #Kinésica`
  },
  {
    id: "108_notebook_cifosis",
    title: "El notebook te está encorvando",
    cat: "MALA POSTURA",
    group: "filosofia",
    body: "Pantalla baja, cabeza adelante, dorsales trabados. Corregimos la cadena postural, no solo te decimos “sentate derecho”.",
    feedUrl: "campanas/feed/catalogo_feed_108_notebook_cifosis.png",
    storyUrl: "campanas/story/catalogo_story_108_notebook_cifosis.png",
    copy: `El notebook te está encorvando 💻

Pantalla baja, cabeza adelante, dorsales trabados. Corregimos la cadena postural: no alcanza con “sentate derecho”.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Hipercifosis #Postura #Notebook #Kinésica`
  },
  {
    id: "109_postura_selfie",
    title: "Sacarte bien en fotos no arregla tu espalda",
    cat: "POSTURA",
    group: "filosofia",
    body: "Forzar la pose no educa la columna. Trabajamos hipercifosis y compensaciones con RPG real, sin milagros.",
    feedUrl: "campanas/feed/catalogo_feed_109_postura_selfie.png",
    storyUrl: "campanas/story/catalogo_story_109_postura_selfie.png",
    copy: `Sacarte bien en fotos no arregla tu espalda 🤳

Forzar la pose no educa la columna. Trabajamos hipercifosis y compensaciones con RPG real.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Postura #RPG #Jovenes #Kinésica`
  },
  {
    id: "110_faja_postural",
    title: "La faja no educa: sostiene",
    cat: "FAJA POSTURAL",
    group: "filosofia",
    body: "Cuando la sacás, el cuerpo vuelve a caer. Enseñamos control y movilidad para que no dependas del arnés.",
    feedUrl: "campanas/feed/catalogo_feed_110_faja_postural.png",
    storyUrl: "campanas/story/catalogo_story_110_faja_postural.png",
    copy: `La faja postural no educa: sostiene 🩹

Cuando la sacás, el cuerpo vuelve a caer. Enseñamos control y movilidad para que no dependas del arnés.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#FajaPostural #Reeducacion #Postura #Kinésica`
  },
  {
    id: "111_estudiar_cama",
    title: "Estudiar en la cama te cobra el cuello",
    cat: "ESTUDIO",
    group: "filosofia",
    body: "La cama no es un escritorio. Liberamos cervicales y dorsales antes del parcial eterno.",
    feedUrl: "campanas/feed/catalogo_feed_111_estudiar_cama.png",
    storyUrl: "campanas/story/catalogo_story_111_estudiar_cama.png",
    copy: `Estudiar en la cama te cobra el cuello 📚😴

La cama no es un escritorio. Liberamos cervicales y dorsales antes de que el parcial te deje trabado.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Estudiantes #Cervicalgia #Postura #Kinésica`
  },
  {
    id: "112_sillon_rigido",
    title: "El sillón cómodo que te deja rígido",
    cat: "POSTURA",
    group: "filosofia",
    body: "Relajarte no debería costarte movilidad. Recuperamos extensión y control postural sin culparte.",
    feedUrl: "campanas/feed/catalogo_feed_112_sillon_rigido.png",
    storyUrl: "campanas/story/catalogo_story_112_sillon_rigido.png",
    copy: `El sillón “cómodo” que te deja rígido 🛋️

Relajarte no debería costarte movilidad. Recuperamos extensión y control postural.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Postura #Dorsalgia #Bienestar #Kinésica`
  },
  {
    id: "113_joven_mito",
    title: "Sos joven para tener esto. Mentira.",
    cat: "MITO",
    group: "filosofia",
    body: "La edad no protege la biomecánica. Evaluamos escoliosis, ciática y contracturas también a los 20 y 30.",
    feedUrl: "campanas/feed/catalogo_feed_113_joven_mito.png",
    storyUrl: "campanas/story/catalogo_story_113_joven_mito.png",
    copy: `“Sos joven para tener esto”. Mentira. 🛑

La edad no protege la biomecánica. Evaluamos escoliosis, ciática y contracturas también a los 20 y 30.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Jovenes #Dolor #MitosSalud #Kinésica`
  },
  {
    id: "114_normalizar_dolor",
    title: "Normalizar el dolor a los 25 no es madurez",
    cat: "SENSIBILIZAR",
    group: "filosofia",
    body: "Aguantar no es fuerte. Tratar la causa mecánica sí. Hablarlo a tiempo cambia el pronóstico.",
    feedUrl: "campanas/feed/catalogo_feed_114_normalizar_dolor.png",
    storyUrl: "campanas/story/catalogo_story_114_normalizar_dolor.png",
    copy: `Normalizar el dolor a los 25 no es madurez 💬

Aguantar no es fuerte. Tratar la causa mecánica sí. Hablarlo a tiempo cambia el pronóstico.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Sensibilizar #DolorCronico #SaludJoven #Kinésica`
  },
  {
    id: "115_standup_malo",
    title: "Escritorio alto no es postura sana",
    cat: "ERGONOMÍA",
    group: "filosofia",
    body: "Pararte mal también carga. Evaluamos cómo te organizás de pie y sentado.",
    feedUrl: "campanas/feed/catalogo_feed_115_standup_malo.png",
    storyUrl: "campanas/story/catalogo_story_115_standup_malo.png",
    copy: `Escritorio alto ≠ postura sana 🖥️

Pararte mal también carga cuello y lumbar. Evaluamos cómo te organizás de pie y sentado.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Ergonomia #StandingDesk #Postura #Kinésica`
  },
  {
    id: "116_viaje_ciatica",
    title: "Después del viaje, la ciática despertó",
    cat: "CIÁTICA",
    group: "columna",
    body: "Horas sentado en avión o micro no son gratis. Recuperamos lumbar y nervio sin alarmismo.",
    feedUrl: "campanas/feed/catalogo_feed_116_viaje_ciatica.png",
    storyUrl: "campanas/story/catalogo_story_116_viaje_ciatica.png",
    copy: `Después del viaje, la ciática despertó ✈️

Horas sentado en avión o micro no son gratis. Recuperamos lumbar y nervio sin alarmismo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Ciatica #Viajes #DolorLumbar #Kinésica`
  },
  {
    id: "117_estirar_vuelve",
    title: "Estirás, afloja, y a la noche vuelve",
    cat: "CONTRACTURAS",
    group: "filosofia",
    body: "El estiramiento no alcanza si hay bloqueo mecánico. Tratamos la causa para romper el ciclo.",
    feedUrl: "campanas/feed/catalogo_feed_117_estirar_vuelve.png",
    storyUrl: "campanas/story/catalogo_story_117_estirar_vuelve.png",
    copy: `Estirás, afloja… y a la noche vuelve 🔁

El estiramiento no alcanza si hay bloqueo mecánico. Tratamos la causa para romper el ciclo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Contractura #Estiramiento #CausaRaiz #Kinésica`
  },
  {
    id: "118_escoliosis_yoga",
    title: "La escoliosis no se arregla sola con yoga",
    cat: "ESCOLIOSIS",
    group: "columna",
    body: "El yoga ayuda; el RPG personalizado organiza la curva y las compensaciones. Sin milagros estéticos.",
    feedUrl: "campanas/feed/catalogo_feed_118_escoliosis_yoga.png",
    storyUrl: "campanas/story/catalogo_story_118_escoliosis_yoga.png",
    copy: `La escoliosis no se “arregla” sola con yoga 🧘

El yoga ayuda; el RPG personalizado organiza la curva y las compensaciones. Sin milagros estéticos.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Escoliosis #RPG #Yoga #Kinésica`
  },
  {
    id: "119_dormir_torcido",
    title: "Dormís de costado y amanecés torcido",
    cat: "DESCANSO",
    group: "filosofia",
    body: "La noche no debería dejarte bloqueado. Revisamos pelvis, lumbar y hábitos de descanso.",
    feedUrl: "campanas/feed/catalogo_feed_119_dormir_torcido.png",
    storyUrl: "campanas/story/catalogo_story_119_dormir_torcido.png",
    copy: `Dormís de costado y amanecés torcido 😴

La noche no debería dejarte bloqueado. Revisamos pelvis, lumbar y hábitos de descanso.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Descanso #Lumbalgia #Postura #Kinésica`
  },
  {
    id: "120_bolso_lado",
    title: "El bolso siempre del mismo lado te desvía",
    cat: "CARGA ASIMÉTRICA",
    group: "filosofia",
    body: "Una carga fija enseña escoliosis funcional. Alternamos hábitos y reeducamos la postura.",
    feedUrl: "campanas/feed/catalogo_feed_120_bolso_lado.png",
    storyUrl: "campanas/story/catalogo_story_120_bolso_lado.png",
    copy: `El bolso siempre del mismo lado te desvía 👜

Una carga fija enseña escoliosis funcional. Alternamos hábitos y reeducamos la postura.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Postura #CargaAsimetrica #Escoliosis #Kinésica`
  },
  {
    id: "121_agacharse_zapatos",
    title: "Te bloqueás al agacharte a atarte los zapatos",
    cat: "MOVIMIENTO",
    group: "columna",
    body: "Si un gesto simple dispara ciática o lumbar, hay algo mecánico que atender.",
    feedUrl: "campanas/feed/catalogo_feed_121_agacharse_zapatos.png",
    storyUrl: "campanas/story/catalogo_story_121_agacharse_zapatos.png",
    copy: `¿Te bloqueás al agacharte a atarte los zapatos? 👟

Si un gesto simple dispara ciática o lumbar, hay algo mecánico que atender.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Ciatica #Lumbalgia #Movimiento #Kinésica`
  },
  {
    id: "122_aviso_temprano",
    title: "El cuerpo avisa antes de que duela fuerte",
    cat: "PREVENCIÓN",
    group: "filosofia",
    body: "Rigidez, hormigueo o un hombro más alto ya son señales. Escucharlo a tiempo evita cronificar.",
    feedUrl: "campanas/feed/catalogo_feed_122_aviso_temprano.png",
    storyUrl: "campanas/story/catalogo_story_122_aviso_temprano.png",
    copy: `El cuerpo avisa antes de que duela fuerte 🔔

Rigidez, hormigueo o un hombro más alto ya son señales. Escucharlo a tiempo evita cronificar.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733
#Prevencion #Sensibilizar #SaludPostural #Kinésica`
  },
  // Temporada: Felices Fiestas + avisos informativos
  {
    id: "123_felices_fiestas",
    title: "Que este cierre de año te encuentre mejor",
    cat: "FELICES FIESTAS",
    group: "filosofia",
    body: "Gracias por confiar en Kinésica. Te deseamos descanso real y un cuerpo que acompañe.",
    feedUrl: "campanas/feed/catalogo_feed_123_felices_fiestas.png",
    storyUrl: "campanas/story/catalogo_story_123_felices_fiestas.png",
    copy: `✨ Felices Fiestas

Que este cierre de año te encuentre mejor: con menos dolor, más movilidad y tiempo real para vos.

Gracias por confiar en Kinésica durante el año.
Te deseamos descanso genuino y un cuerpo que acompañe lo que querés hacer.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733

#FelicesFiestas #KinesiologiaPalermo #Kinésica`
  },
  {
    id: "124_fin_de_ano",
    title: "Empezá el año sin arrastrar el dolor",
    cat: "CIERRE DE AÑO",
    group: "filosofia",
    body: "Enero es buen momento para evaluar postura y cadenas, no solo para promesas.",
    feedUrl: "campanas/feed/catalogo_feed_124_fin_de_ano.png",
    storyUrl: "campanas/story/catalogo_story_124_fin_de_ano.png",
    copy: `Empezá el año sin arrastrar el dolor 🌿

Las promesas de enero duran más cuando el cuerpo acompaña.

Si venís postergando esa molestia de espalda, cuello o mandíbula, este es un buen momento para evaluarla con calma: postura, cadenas y causa mecánica.

📍 Charcas 3889, Palermo
📲 Turnos: +54 9 11 3178-1733

#AnioNuevo #Postura #TerapiaManual #Kinésica`
  },
  {
    id: "125_descanso_activo",
    title: "Descansar no es dejar de moverte",
    cat: "BIENESTAR",
    group: "filosofia",
    body: "En las fiestas, un poco de movilidad suave evita que el cuerpo se “oxide”.",
    feedUrl: "campanas/feed/catalogo_feed_125_descanso_activo.png",
    storyUrl: "campanas/story/catalogo_story_125_descanso_activo.png",
    copy: `Descansar ≠ quedarte quieto del todo 🧘‍♀️

En las fiestas el ritmo cambia: más comida, más auto, más sillón.
Un poco de movilidad suave (caminar, estirar sin forzar) ayuda a que la espalda y el cuello no se “oxiden”.

Si algo ya duele, mejor evaluarlo que esperar a enero.

📲 WhatsApp: +54 9 11 3178-1733
📍 Palermo

#Bienestar #Movilidad #Fiestas #Kinésica`
  },
  {
    id: "126_horario_fiestas",
    title: "Horario de atención en fiestas",
    cat: "AVISO",
    group: "filosofia",
    body: "Escribinos por WhatsApp para confirmar turnos y disponibilidad de la semana.",
    feedUrl: "campanas/feed/catalogo_feed_126_horario_fiestas.png",
    storyUrl: "campanas/story/catalogo_story_126_horario_fiestas.png",
    copy: `📅 Horario en fiestas — Kinésica

Durante las fiestas la agenda puede variar.

Para confirmar:
1️⃣ Escribinos por WhatsApp
2️⃣ Contanos el día que preferís
3️⃣ Te confirmamos disponibilidad

📲 +54 9 11 3178-1733
📍 Charcas 3889, Palermo

Gracias por anticiparte 🙏
#Aviso #Turnos #Kinésica`
  },
  {
    id: "127_como_sacar_turno",
    title: "Sacá turno en 1 mensaje",
    cat: "TURNOS",
    group: "filosofia",
    body: "WhatsApp → contanos qué te duele → te proponemos día y horario.",
    feedUrl: "campanas/feed/catalogo_feed_127_como_sacar_turno.png",
    storyUrl: "campanas/story/catalogo_story_127_como_sacar_turno.png",
    copy: `Sacá turno en 1 mensaje 💬

Así de simple:

1. Escribinos por WhatsApp
2. Contanos qué te duele (y desde cuándo)
3. Te proponemos día y horario

Sesiones 1 a 1 de 60 minutos.
📍 Charcas 3889, Palermo
📲 +54 9 11 3178-1733

#Turnos #Kinesiologia #Palermo #Kinésica`
  },
  {
    id: "128_que_traer",
    title: "¿Qué traer a la primera sesión?",
    cat: "PRIMERA VISITA",
    group: "filosofia",
    body: "Ropa cómoda, estudios si tenés, y 60 minutos para evaluar de pies a cabeza.",
    feedUrl: "campanas/feed/catalogo_feed_128_que_traer.png",
    storyUrl: "campanas/story/catalogo_story_128_que_traer.png",
    copy: `Primera visita — ¿qué traer? ✅

• Ropa cómoda (para moverte con facilidad)
• Estudios / imágenes si ya tenés
• Lista breve de molestias y desde cuándo
• 60 minutos: evaluamos de pies a cabeza

No hace falta llegar “preparado/a” de más.
Nosotros armamos el plan en la sesión.

📲 +54 9 11 3178-1733
📍 Charcas 3889, Palermo

#PrimeraVisita #Kinesiologia #Kinésica`
  },
  // Educación clínica: miembro fantasma, compensación, tipos de dolor
  {
    id: "129_miembro_fantasma",
    title: "El miembro ya no está. El dolor sí.",
    cat: "MIEMBRO FANTASMA",
    group: "articulaciones",
    body: "El cerebro sigue mapeando lo que faltó. No es imaginación: es dolor neuropático real.",
    feedUrl: "campanas/feed/catalogo_feed_129_miembro_fantasma.png",
    storyUrl: "campanas/story/catalogo_story_129_miembro_fantasma.png",
    copy: `El miembro ya no está. El dolor sí. 🧠

El dolor de miembro fantasma no es “psicológico” ni inventado: el sistema nervioso sigue representando una parte del cuerpo que ya no está.

Puede sentirse como quemazón, calambre, presión o dolor eléctrico. Y merece abordaje serio: evaluación, desensibilización, trabajo motor y acompañamiento.

En Kinésica escuchamos el síntoma sin minimizarlo.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733

#MiembroFantasma #DolorNeuropatico #Kinesiologia #Kinésica`
  },
  {
    id: "130_fantasma_es_real",
    title: "Si duele, es real. Aunque no se vea.",
    cat: "MIEMBRO FANTASMA",
    group: "articulaciones",
    body: "Hay caminos: terapia especular, reeducación sensitiva y un plan 1 a 1 sin recetas mágicas.",
    feedUrl: "campanas/feed/catalogo_feed_130_fantasma_es_real.png",
    storyUrl: "campanas/story/catalogo_story_130_fantasma_es_real.png",
    copy: `Si duele, es real. Aunque no se vea. 💙

El miembro fantasma puede mejorar con abordajes que “actualizan” el mapa cerebral: terapia especular, reeducación sensitiva, exposición gradual y trabajo funcional.

No hay fórmula única. Hay evaluación individual y constancia.

Si vos o alguien cercano convive con esto, escribinos. Sesiones 1 a 1 de 60 minutos.

📍 Charcas 3889, Palermo
📲 +54 9 11 3178-1733

#MiembroFantasma #Rehabilitacion #Neuroplasticidad #Kinésica`
  },
  {
    id: "131_compensacion",
    title: "Cuando una zona falla, otra paga el precio",
    cat: "COMPENSACIÓN",
    group: "filosofia",
    body: "El cuerpo no se rinde: se reorganiza. Esa “solución” termina en sobrecarga y dolor lejos del origen.",
    feedUrl: "campanas/feed/catalogo_feed_131_compensacion.png",
    storyUrl: "campanas/story/catalogo_story_131_compensacion.png",
    copy: `Cuando una zona falla, otra paga el precio ⚖️

El cuerpo no se rinde: se reorganiza. Si la cadera no moviliza, la lumbar compensa. Si el pie no apoya bien, la rodilla y el cuello terminan pagando.

Esa compensación puede “funcionar” meses… hasta que aparece el dolor lejos del origen.

En Kinésica evaluamos cadenas de pies a cabeza para no tratar solo el síntoma.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733

#Compensacion #CadenasMiofasciales #Postura #Kinésica`
  },
  {
    id: "132_tipos_de_dolor",
    title: "No todo dolor se trata igual",
    cat: "TIPOS DE DOLOR",
    group: "filosofia",
    body: "Mecánico, inflamatorio, neuropático o referido: el tipo orienta el abordaje. Por eso preguntamos cómo duele.",
    feedUrl: "campanas/feed/catalogo_feed_132_tipos_de_dolor.png",
    storyUrl: "campanas/story/catalogo_story_132_tipos_de_dolor.png",
    copy: `No todo dolor se trata igual 🧭

• Mecánico: cambia con postura y movimiento
• Inflamatorio: más constante, a veces con calor/hinchazón
• Neuropático: electricidad, quemazón, hormigueo
• Referido: duele en un lugar, nace en otro

Entender el tipo orienta el tratamiento. Por eso en la evaluación preguntamos cómo duele, cuándo y qué lo modifica.

📍 Charcas 3889, Palermo
📲 +54 9 11 3178-1733

#TiposDeDolor #EvaluacionKinésica #DolorCronico #Kinésica`
  },
  {
    id: "133_tendinitis",
    title: "No es solo “inflamación del tendón”",
    cat: "TENDINITIS",
    group: "articulaciones",
    body: "Suele ser sobrecarga + mala mecánica. Calmamos el dolor y corregimos por qué el tendón se irrita.",
    feedUrl: "campanas/feed/catalogo_feed_133_tendinitis.png",
    storyUrl: "campanas/story/catalogo_story_133_tendinitis.png",
    copy: `Tendinitis: no es solo “inflamación del tendón” 🦾

Doler al agarrar, al levantar el brazo o al apoyar el pie no siempre se resuelve con hielo y reposo eterno.

Muchas veces hay sobrecarga + mala mecánica: el tendón trabaja de más porque otra zona no aporta.

En Kinésica calmamos el síntoma y miramos la cadena (hombro, codo, muñeca, rodilla o Aquiles) para que no vuelva igual.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733

#Tendinitis #Tendinopatia #TerapiaManual #Kinésica`
  },
  {
    id: "134_deseamos_fiestas",
    title: "¡Les deseamos Felices Fiestas!",
    cat: "FELICES FIESTAS",
    group: "filosofia",
    body: "Gracias por confiar en nosotros. Que el cierre de año los encuentre con más calma y menos dolor.",
    feedUrl: "campanas/feed/catalogo_feed_134_deseamos_fiestas.png",
    storyUrl: "campanas/story/catalogo_story_134_deseamos_fiestas.png",
    copy: `¡Les deseamos Felices Fiestas! ✨

Desde Kinésica queremos agradecerles la confianza de este año.

Que estas fiestas los encuentren con más calma, más movimiento y menos dolor.
Estamos para acompañarlos cuando lo necesiten.

📍 Charcas 3889, Palermo
📲 WhatsApp: +54 9 11 3178-1733

#FelicesFiestas #KinesiologiaPalermo #Kinésica`
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

  const resolver = (id) => {
    const base = CREATIVOS_DATA.find((it) => it.id === id);
    if (!base) return null;
    const copy = resolveCaption(id, base);
    const img = resolveImageText(id, base);
    return { ...base, copy, cat: img.cat, title: img.title, body: img.body };
  };

  // Delegated clicks for actions (copy, lightbox, download, edit caption)
  const gridEl = document.getElementById("admin-creativos-grid");
  if (gridEl) {
    gridEl.addEventListener("click", (e) => {
      // Cola / corazones: lo maneja initListaUI o el listener del card.
      if (e.target.closest(".btn-creativo-heart, .btn-creativo-cola, .creativo-badge-cola")) {
        return;
      }

      const copyBtn = e.target.closest(".btn-creativo-copy");
      if (copyBtn) {
        const id = copyBtn.dataset.id;
        const item = CREATIVOS_DATA.find((it) => it.id === id);
        const text = item ? resolveCaption(id, item) : "";
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
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

  ensureColaUiPaint();
  initListaUI(resolver);
  bindImageTextUi(container, {
    resolveItem: resolver,
    onDone: () => {
      renderCreativosGrid();
      if (selectedItem) openLightboxModal(resolver(selectedItem.id) || selectedItem);
    },
  });
  subscribeCola(() => renderCreativosGrid());
  loadCola();

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-creativo-cola, .btn-creativo-heart");
    if (btn && btn.dataset.colaId) {
      e.stopPropagation();
      e.preventDefault();
      toggleCola(btn.dataset.colaId, resolver);
    }
  });

  // Lightbox close + edición de caption en vista detalle
  initModalCaptionControls();
  const modalClose = document.getElementById("creativo-modal-close");
  const modalBackdrop = document.getElementById("creativo-modal-backdrop");
  if (modalClose) modalClose.addEventListener("click", closeLightboxModal);
  if (modalBackdrop) modalBackdrop.addEventListener("click", closeLightboxModal);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const modal = document.getElementById("creativo-lightbox-modal");
    if (!modal || modal.hidden) return;
    const editor = document.getElementById("creativo-modal-caption-editor");
    if (editor && !editor.hidden) {
      const els = getModalCaptionEls();
      if (els.textarea && els.copy) els.textarea.value = els.copy.textContent || "";
      setModalCaptionEditMode(false);
      return;
    }
    closeLightboxModal();
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
      const texts = resolveImageText(item.id, item);
      const rawImg = activeFormat === "story" ? item.storyUrl : item.feedUrl;
      const imgUrl = `${rawImg}?v=${assetVersion}`;
      const aspectClass = activeFormat === "story" ? "aspect-story" : "aspect-feed";

      return `
        <article class="creativo-card" data-id="${item.id}">
          <div class="creativo-thumb-box ${aspectClass}" data-id="${item.id}" title="Click para ver en grande">
            <img src="${imgUrl}" alt="${escapeHtml(texts.title)}" loading="lazy">
            <div class="creativo-thumb-overlay">
              <span class="btn light btn-sm">🔍 Ver en grande</span>
            </div>
            <span class="creativo-format-badge">${activeFormat === "story" ? "Story 9:16" : "Feed 4:5"}</span>
            ${colaBadgeHtml(item)}
            ${colaHeartHtml(item)}
          </div>

          <div class="creativo-info">
            <span class="creativo-pill">${escapeHtml(texts.cat)}</span>
            <h3 class="creativo-title">${escapeHtml(texts.title)}</h3>
            <p class="creativo-desc">${escapeHtml(texts.body)}</p>

            <div class="creativo-actions">
              <a href="${item.feedUrl}?v=${assetVersion}" download="kinesica_feed_${item.id}.png" class="btn light btn-sm" title="Descargar imagen en formato Feed 4:5">
                📥 Feed (4:5)
              </a>
              <a href="${item.storyUrl}?v=${assetVersion}" download="kinesica_story_${item.id}.png" class="btn light btn-sm" title="Descargar imagen en formato Story 9:16">
                📥 Story (9:16)
              </a>
              <button type="button" class="btn light btn-sm btn-creativo-copy" data-id="${item.id}" title="Copiar caption">
                📋 Copiar caption
              </button>
              ${imageTextEditButtonHtml(item.id)}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
  refreshColaButtons();
}

function getModalCaptionEls() {
  return {
    copy: document.getElementById("creativo-modal-copy"),
    editor: document.getElementById("creativo-modal-caption-editor"),
    textarea: document.getElementById("creativo-modal-caption-textarea"),
    btnEdit: document.getElementById("creativo-modal-btn-edit"),
    btnCopy: document.getElementById("creativo-modal-btn-copy"),
    btnSave: document.getElementById("creativo-modal-btn-save-caption"),
    btnCancel: document.getElementById("creativo-modal-btn-cancel-caption"),
  };
}

function setModalCaptionEditMode(editing) {
  const els = getModalCaptionEls();
  if (els.copy) els.copy.hidden = editing;
  if (els.editor) els.editor.hidden = !editing;
  if (els.btnEdit) els.btnEdit.hidden = editing || !canEditCaptions();
  if (els.btnCopy) els.btnCopy.hidden = editing;
}

function getModalCaptionText() {
  const els = getModalCaptionEls();
  if (els.editor && !els.editor.hidden && els.textarea) {
    return String(els.textarea.value || "");
  }
  return String(els.copy?.textContent || "");
}

function openLightboxModal(item) {
  selectedItem = item;
  const modal = document.getElementById("creativo-lightbox-modal");
  if (!modal) return;

  const modalImg = document.getElementById("creativo-modal-img");
  const modalTitle = document.getElementById("creativo-modal-title");
  const modalCat = document.getElementById("creativo-modal-cat");
  const modalBtnFeed = document.getElementById("creativo-modal-dl-feed");
  const modalBtnStory = document.getElementById("creativo-modal-dl-story");
  const els = getModalCaptionEls();

  const currentImg = activeFormat === "story" ? item.storyUrl : item.feedUrl;
  const caption = resolveCaption(item.id, item) || item.copy || item.body || "";
  const texts = resolveImageText(item.id, item);

  if (modalImg) modalImg.src = `${currentImg}?v=${assetVersion}`;
  if (modalTitle) modalTitle.textContent = texts.title;
  if (modalCat) modalCat.textContent = texts.cat;
  if (els.copy) els.copy.textContent = caption;
  if (els.textarea) {
    els.textarea.value = caption;
    els.textarea.maxLength = CAPTION_MAX;
  }
  setModalCaptionEditMode(false);

  const imgSlot = document.getElementById("creativo-modal-imgtext-slot");
  if (imgSlot) {
    imgSlot.innerHTML = canEditImageText() ? imageTextEditButtonHtml(item.id) : "";
  }

  if (modalBtnFeed) {
    modalBtnFeed.href = `${item.feedUrl}?v=${assetVersion}`;
    modalBtnFeed.download = `kinesica_feed_${item.id}.png`;
  }
  if (modalBtnStory) {
    modalBtnStory.href = `${item.storyUrl}?v=${assetVersion}`;
    modalBtnStory.download = `kinesica_story_${item.id}.png`;
  }

  const slot = document.getElementById("creativo-modal-cola-slot");
  if (slot) {
    const pub = getPublicationDetails(item.id);
    if (pub) {
      slot.innerHTML = `
        <div class="creativo-modal-pub-banner is-published">
          <div class="pub-banner-title">✅ Publicada en Instagram</div>
          <div class="pub-banner-sub">Fecha: <strong>${pub.date}</strong> · Canales: <strong>${pub.channelText}</strong></div>
          ${pub.error ? `<div class="pub-banner-err">⚠️ ${escapeHtml(pub.error)}</div>` : ""}
          <div class="pub-banner-actions">
            ${colaButtonHtml(item)}
          </div>
        </div>`;
    } else {
      slot.innerHTML = colaButtonHtml(item);
    }
  }
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightboxModal() {
  const modal = document.getElementById("creativo-lightbox-modal");
  if (modal) modal.hidden = true;
  setModalCaptionEditMode(false);
  selectedItem = null;
  document.body.style.overflow = "";
}

function initModalCaptionControls() {
  const modal = document.getElementById("creativo-lightbox-modal");
  if (!modal || modal.dataset.captionControlsBound === "1") return;
  modal.dataset.captionControlsBound = "1";

  modal.addEventListener("click", async (e) => {
    const els = getModalCaptionEls();
    if (e.target.closest("#creativo-modal-btn-edit")) {
      if (!canEditCaptions() || !selectedItem) return;
      if (els.textarea) els.textarea.value = getModalCaptionText();
      setModalCaptionEditMode(true);
      els.textarea?.focus();
      return;
    }
    if (e.target.closest("#creativo-modal-btn-cancel-caption")) {
      if (els.textarea && els.copy) els.textarea.value = els.copy.textContent || "";
      setModalCaptionEditMode(false);
      return;
    }
    if (e.target.closest("#creativo-modal-btn-save-caption")) {
      if (!canEditCaptions() || !selectedItem || !els.textarea) return;
      const caption = String(els.textarea.value || "").trim();
      if (!caption || caption.length > CAPTION_MAX) {
        window.alert(`El texto debe tener entre 1 y ${CAPTION_MAX} caracteres (límite de Instagram).`);
        return;
      }
      const btn = els.btnSave;
      if (btn) btn.disabled = true;
      try {
        await saveCaption(selectedItem.id, caption);
        if (els.copy) els.copy.textContent = caption;
        setModalCaptionEditMode(false);
        window.alert("Texto guardado. Vale para la cola y para la próxima vez que encoles esta pieza.");
      } catch (err) {
        if (!err.auth) window.alert(err.message || "No se pudo guardar el texto");
      } finally {
        if (btn) btn.disabled = false;
      }
      return;
    }
    if (e.target.closest("#creativo-modal-btn-copy")) {
      const text = getModalCaptionText();
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        const copyBtn = els.btnCopy;
        if (!copyBtn) return;
        const orig = copyBtn.textContent;
        copyBtn.textContent = "✓ ¡Texto copiado!";
        setTimeout(() => {
          copyBtn.textContent = orig;
        }, 2200);
      });
    }
  });
}
