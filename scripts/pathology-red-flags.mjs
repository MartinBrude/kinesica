/**
 * Señales de alarma específicas para las páginas de patologías.
 *
 * Solo se sobrescribe el texto genérico cuando existe una pauta clínica
 * específica para la condición. El contenido es orientativo y no sustituye
 * un protocolo de triage ni una evaluación médica.
 */
export const PATHOLOGY_RED_FLAGS = {
  lumbalgia: {
    es: [
      "Pérdida de control de la vejiga o el intestino, adormecimiento en la zona genital o debilidad marcada en ambas piernas.",
      "Dolor lumbar después de un traumatismo importante, o acompañado de fiebre, pérdida de peso inexplicada o antecedentes de cáncer.",
      "Dolor que empeora rápidamente, despierta de forma persistente por la noche o se acompaña de debilidad progresiva.",
    ],
  },
  ciatalgia: {
    es: [
      "Debilidad progresiva del pie o la pierna, dificultad para caminar o sensación de que la pierna falla.",
      "Pérdida de control de la vejiga o el intestino, o adormecimiento en la zona genital.",
      "Dolor irradiado tras un traumatismo importante, con fiebre o con un empeoramiento rápido.",
    ],
  },
  "hernia-disco": {
    es: [
      "Debilidad progresiva en una o ambas piernas, dificultad para caminar o pérdida de coordinación.",
      "Cambios en el control de la vejiga o el intestino, o adormecimiento en la zona genital.",
      "Dolor intenso tras un traumatismo, fiebre o síntomas que empeoran rápidamente.",
    ],
  },
  "protrusion-discal": {
    es: [
      "Pérdida progresiva de fuerza, dificultad para caminar o cambios importantes de sensibilidad.",
      "Alteraciones del control de la vejiga o el intestino, o adormecimiento en la zona genital.",
      "Dolor que empeora rápidamente, aparece tras un traumatismo o se acompaña de fiebre.",
    ],
  },
  radiculopatia: {
    es: [
      "Debilidad progresiva, pérdida de fuerza para levantar el pie o dificultad para usar la mano o el brazo.",
      "Alteraciones del equilibrio, de la marcha o del control de esfínteres.",
      "Dolor o síntomas neurológicos que aparecen después de un traumatismo importante o empeoran con rapidez.",
    ],
  },
  cervicalgia: {
    es: [
      "Dolor cervical después de un accidente o traumatismo importante.",
      "Debilidad, torpeza en las manos, alteraciones de la marcha o pérdida progresiva de sensibilidad.",
      "Fiebre, rigidez intensa de cuello, dolor de cabeza súbito e inusual o empeoramiento rápido.",
    ],
  },
  cervicobraquialgia: {
    es: [
      "Pérdida progresiva de fuerza en el brazo o la mano, o dificultad para sujetar objetos.",
      "Torpeza de las manos, alteraciones del equilibrio o dificultad para caminar.",
      "Dolor después de un traumatismo, fiebre o síntomas neurológicos que empeoran rápidamente.",
    ],
  },
  cefalea: {
    es: [
      "Dolor de cabeza súbito y muy intenso, distinto a otros episodios previos.",
      "Dolor de cabeza con debilidad, dificultad para hablar, confusión, desmayo, convulsiones o alteraciones visuales nuevas.",
      "Fiebre con rigidez de cuello, después de un traumatismo o con vómitos persistentes.",
    ],
  },
  atm: {
    es: [
      "Imposibilidad persistente para abrir o cerrar la boca, o bloqueo que impide comer o beber.",
      "Hinchazón importante, fiebre, dolor dental intenso o dificultad para tragar o respirar.",
      "Dolor mandibular después de un traumatismo o con pérdida de sensibilidad facial.",
    ],
  },
  bruxismo: {
    es: [
      "Dolor mandibular intenso con bloqueo persistente o imposibilidad para abrir la boca.",
      "Hinchazón, fiebre, dolor dental intenso o dificultad para tragar o respirar.",
      "Dolor facial nuevo con pérdida de sensibilidad, debilidad o alteraciones neurológicas.",
    ],
  },
  "manguito-rotador": {
    es: [
      "Dolor intenso tras una caída o traumatismo, especialmente si no podés elevar el brazo.",
      "Deformidad visible, hinchazón importante, pérdida súbita de fuerza o alteración de la sensibilidad.",
      "Fiebre, enrojecimiento marcado o dolor que empeora rápidamente sin causa clara.",
    ],
  },
  "impingement-subacromial": {
    es: [
      "Dolor intenso tras un traumatismo con incapacidad para levantar el brazo.",
      "Deformidad, hinchazón importante, pérdida súbita de fuerza o adormecimiento persistente.",
      "Fiebre, enrojecimiento marcado o empeoramiento rápido del dolor.",
    ],
  },
  gonalgia: {
    es: [
      "Imposibilidad para apoyar o mover la rodilla después de un traumatismo.",
      "Rodilla muy hinchada, deformada, caliente y roja, especialmente con fiebre.",
      "Dolor en la pantorrilla con hinchazón, calor o falta de aire: requiere atención urgente.",
    ],
  },
  meniscopatia: {
    es: [
      "Bloqueo de la rodilla, incapacidad para apoyar o deformidad después de un traumatismo.",
      "Hinchazón rápida e importante, calor, enrojecimiento o fiebre.",
      "Dolor o hinchazón de la pantorrilla, especialmente si aparece falta de aire.",
    ],
  },
  talalgia: {
    es: [
      "Imposibilidad para apoyar el pie después de una caída, golpe o aumento brusco de carga.",
      "Hinchazón importante, deformidad, enrojecimiento marcado o fiebre.",
      "Pérdida de sensibilidad, debilidad o cambios de coloración del pie.",
    ],
  },
};
