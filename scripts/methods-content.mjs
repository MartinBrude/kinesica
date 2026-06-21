/**
 * Method/technique pages (ES / EN / FR / PT).
 * Edit copy here, then: npm run build:methods
 */
export const METHOD_STEMS = [
  "kinesiologia",
  "rpg",
  "osteopatia",
  "cadenas",
  "manipulaciones",
  "neurodinamia",
  "atm",
  "acupuntura",
  "posturologia-clinica"
];

export const METHOD_UI = {
  "es": {
    "homeLabel": "Inicio",
    "homeHref": "index.html"
  },
  "en": {
    "homeLabel": "Home",
    "homeHref": "/en/"
  },
  "fr": {
    "homeLabel": "Accueil",
    "homeHref": "/fr/"
  },
  "pt": {
    "homeLabel": "Início",
    "homeHref": "/pt/"
  }
};

/** @type {Record<string, { image: string, es: MethodLang, en: MethodLang, fr: MethodLang, pt: MethodLang }>} */
export const METHODS = {
    "kinesiologia": {
      image: "hero-img.jpg",
      es: {
        metaTitle: "Kinesiología y Fisioterapia | Kinésica",
        metaDescription: "Kinesiología en Kinésica (Buenos Aires). Evaluación funcional, rehabilitación y terapia manual personalizada en Palermo.",
        breadcrumb: "Kinesiología",
        h1: "Kinesiología y fisioterapia",
        lead: "La kinesiología es la disciplina de la salud que evalúa, trata y previene alteraciones del movimiento y de la función corporal mediante técnicas específicas, ejercicios terapéuticos y terapia manual.",
        blocks: [
          { type: "p", text: "En el consultorio se parte de una valoración integral que incluye la historia clínica, la observación postural, los movimientos activos y pasivos, las pruebas funcionales y, cuando corresponde, la lectura de estudios complementarios. El objetivo es identificar las causas del dolor o la limitación funcional, y no solo aliviar el síntoma." },
          { type: "p", text: "El tratamiento kinesiológico busca recuperar la movilidad, mejorar la fuerza y la coordinación, reducir el dolor y prevenir recaídas. Se adapta a cada persona según su edad, actividad y objetivos — ya sea volver al deporte, al trabajo o a las actividades cotidianas." },
          { type: "h2", text: "Evaluación funcional" },
          { type: "p", text: "La evaluación permite conocer cómo se organiza el cuerpo en el movimiento: cómo se distribuyen las cargas, qué articulaciones o segmentos tienen restricción, y qué tejidos (músculos, fascias, nervios) participan en el cuadro. Con esa información se define un plan de tratamiento claro y realista." },
          { type: "p", text: "En la primera consulta se explican los hallazgos, las expectativas del tratamiento y las recomendaciones para el día a día. Cuando el caso lo requiere, se coordina con otros profesionales de la salud." },
          { type: "h2", text: "Tratamiento y rehabilitación" },
          { type: "p", text: "El abordaje puede incluir ejercicios terapéuticos, estiramientos, movilizaciones articulares, técnicas de terapia manual, neurodinamia, reeducación postural y otras modalidades según lo que la evaluación indique. En Kinésica integramos distintas herramientas para un tratamiento más completo." },
          { type: "p", text: "Se atienden dolores musculoesqueléticos (cervicalgia, lumbalgia, hombro, rodilla), lesiones deportivas, secuelas de traumatismos, alteraciones posturales, tensiones nerviosas y procesos de recuperación después de cirugías o inmovilizaciones." },
          { type: "p", text: "La frecuencia de las sesiones suele ser semanal al inicio del tratamiento, y puede espaciarse según la evolución. La duración habitual de cada sesión es de aproximadamente una hora." },
        ],
      },
      en: {
        metaTitle: "Kinesiology and Physiotherapy | Kinésica",
        metaDescription: "Kinesiology at Kinésica (Buenos Aires). Functional assessment, rehabilitation, and personalized manual therapy in Palermo.",
        breadcrumb: "Kinesiology",
        h1: "Kinesiology and physiotherapy",
        lead: "Kinesiology is the health discipline that assesses, treats, and prevents movement and functional disorders through specific techniques, therapeutic exercise, and manual therapy.",
        blocks: [
          { type: "p", text: "At the clinic, we begin with a comprehensive assessment that includes clinical history, postural observation, active and passive movement testing, functional tests, and—when appropriate—review of complementary studies. The goal is to identify the causes of pain or functional limitation, not only to relieve the symptom." },
          { type: "p", text: "Kinesiology treatment aims to restore mobility, improve strength and coordination, reduce pain, and prevent recurrence. It is tailored to each person according to age, activity level, and goals—whether returning to sport, work, or everyday activities." },
          { type: "h2", text: "Functional assessment" },
          { type: "p", text: "Assessment reveals how the body organizes itself in movement: how loads are distributed, which joints or segments are restricted, and which tissues (muscles, fascia, nerves) are involved. This information defines a clear, realistic treatment plan." },
          { type: "p", text: "At the first visit, findings, treatment expectations, and daily-life recommendations are explained. When needed, care is coordinated with other healthcare professionals." },
          { type: "h2", text: "Treatment and rehabilitation" },
          { type: "p", text: "The approach may include therapeutic exercise, stretching, joint mobilization, manual therapy techniques, neurodynamics, postural re-education, and other modalities as indicated by the assessment. At Kinésica we integrate different tools for more complete care." },
          { type: "p", text: "We treat musculoskeletal pain (neck, low back, shoulder, knee), sports injuries, trauma sequelae, postural disorders, nerve tension, and recovery after surgery or immobilization." },
          { type: "p", text: "Sessions are usually weekly at the start of treatment and may be spaced out as progress is made. Each session typically lasts about one hour." },
        ],
      },
      fr: {
        metaTitle: "Kinésithérapie et physiothérapie | Kinésica",
        metaDescription: "Kinésithérapie chez Kinésica (Buenos Aires). Évaluation fonctionnelle, rééducation et thérapie manuelle personnalisée à Palermo.",
        breadcrumb: "Kinésithérapie",
        h1: "Kinésithérapie et physiothérapie",
        lead: "La kinésithérapie est la discipline de santé qui évalue, traite et prévient les troubles du mouvement et de la fonction corporelle par des techniques spécifiques, des exercices thérapeutiques et la thérapie manuelle.",
        blocks: [
          { type: "p", text: "Au cabinet, nous commençons par une évaluation globale : antécédents, observation posturale, mouvements actifs et passifs, tests fonctionnels et, le cas échéant, lecture d'examens complémentaires. L'objectif est d'identifier les causes de la douleur ou de la limitation fonctionnelle, pas seulement de soulager le symptôme." },
          { type: "p", text: "Le traitement vise à restaurer la mobilité, améliorer force et coordination, réduire la douleur et prévenir les récidives. Il s'adapte à chaque personne selon l'âge, l'activité et les objectifs — retour au sport, au travail ou aux activités quotidiennes." },
          { type: "h2", text: "Évaluation fonctionnelle" },
          { type: "p", text: "L'évaluation montre comment le corps s'organise dans le mouvement : répartition des charges, segments restreints, tissus impliqués (muscles, fascias, nerfs). Elle permet de définir un plan de traitement clair et réaliste." },
          { type: "p", text: "Lors de la première consultation, les résultats, les attentes et les recommandations quotidiennes sont expliqués. Si nécessaire, une coordination avec d'autres professionnels de santé est mise en place." },
          { type: "h2", text: "Traitement et rééducation" },
          { type: "p", text: "La prise en charge peut inclure exercices thérapeutiques, étirements, mobilisations articulaires, thérapie manuelle, neurodynamique, rééducation posturale et autres modalités selon l'évaluation. Chez Kinésica, nous intégrons plusieurs outils pour une prise en charge plus complète." },
          { type: "p", text: "Nous traitons les douleurs musculo-squelettiques (cervicalgie, lombalgie, épaule, genou), les blessures sportives, les séquelles traumatiques, les troubles posturaux, les tensions nerveuses et la récupération après chirurgie ou immobilisation." },
          { type: "p", text: "Les séances sont en général hebdomadaires au début du traitement, puis peuvent s'espacer selon l'évolution. Chaque séance dure environ une heure." },
        ],
      },
      pt: {
        metaTitle: "Fisioterapia e kinesiologia | Kinésica",
        metaDescription: "Fisioterapia na Kinésica (Buenos Aires). Avaliação funcional, reabilitação e terapia manual personalizada em Palermo.",
        breadcrumb: "Fisioterapia",
        h1: "Fisioterapia e kinesiologia",
        lead: "A fisioterapia é a disciplina da saúde que avalia, trata e previne alterações do movimento e da função corporal por meio de técnicas específicas, exercícios terapêuticos e terapia manual.",
        blocks: [
          { type: "p", text: "No consultório, partimos de uma avaliação integral que inclui história clínica, observação postural, movimentos ativos e passivos, testes funcionais e, quando indicado, leitura de exames complementares. O objetivo é identificar as causas da dor ou da limitação funcional, e não apenas aliviar o sintoma." },
          { type: "p", text: "O tratamento busca recuperar a mobilidade, melhorar força e coordenação, reduzir a dor e prevenir recidivas. Adapta-se a cada pessoa conforme idade, atividade e objetivos — seja retornar ao esporte, ao trabalho ou às atividades do dia a dia." },
          { type: "h2", text: "Avaliação funcional" },
          { type: "p", text: "A avaliação mostra como o corpo se organiza no movimento: distribuição de cargas, segmentos com restrição e tecidos envolvidos (músculos, fáscias, nervos). Com isso, define-se um plano de tratamento claro e realista." },
          { type: "p", text: "Na primeira consulta, explicamos os achados, as expectativas do tratamento e recomendações para o cotidiano. Quando necessário, coordenamos com outros profissionais de saúde." },
          { type: "h2", text: "Tratamento e reabilitação" },
          { type: "p", text: "A abordagem pode incluir exercícios terapêuticos, alongamentos, mobilizações articulares, terapia manual, neurodinâmica, reeducação postural e outras modalidades conforme a avaliação. Na Kinésica integramos diferentes ferramentas para um cuidado mais completo." },
          { type: "p", text: "Atendemos dores musculoesqueléticas (cervicalgia, lombalgia, ombro, joelho), lesões esportivas, sequelas de traumas, alterações posturais, tensões nervosas e recuperação após cirurgias ou imobilizações." },
          { type: "p", text: "A frequência das sessões costuma ser semanal no início do tratamento, podendo espaçar conforme a evolução. Cada sessão dura em geral cerca de uma hora." },
        ],
      }
    },
    "rpg": {
      image: "rpg.jpg",
      es: {
        metaTitle: "RPG - Reeducación Postural Global | Kinésica",
        metaDescription: "RPG en Kinésica (Buenos Aires). Reeducación postural y cadenas musculares en Palermo. Sesiones individuales para flexibilizar musculatura estática.",
        breadcrumb: "RPG",
        h1: "RPG – Reeducación postural global",
        lead: "La Reeducación Postural Global es un Método de Tratamiento creado en 1980 por el fisioterapeuta PH Souchard. Investigando en la organización postural concluyó que la Postura depende de la tensión de los músculos estáticos (los que se oponen a la acción de la Fuerza de Gravedad). Definió la forma en que se organizan estos músculos con el nombre de Cadenas Musculares.",
        blocks: [
          { type: "p", text: "Definió la forma en que se organizan estos músculos con el nombre de Cadenas Musculares. Se realiza una evaluación donde se define cuáles son las cadenas que más se acortaron y se relacionan con el motivo de consulta. Utiliza posturas de tratamiento para estirarlas en forma suave, progresiva y sostenida. Son posturas activas donde el terapeuta guía el estiramiento y corrige las compensaciones. Busca remontar del síntoma a la causa primaria en el desalineamiento postural. Se trabaja en sesiones individuales. La frecuencia de las sesiones es generalmente semanal." },
        ],
      },
      en: {
        metaTitle: "RPG - Global Postural Reeducation | Kinésica",
        metaDescription: "RPG at Kinésica (Buenos Aires). Global postural reeducation and muscle chains in Palermo. Individual sessions to release static muscle tension.",
        breadcrumb: "RPG",
        h1: "RPG – Global Postural Reeducation",
        lead: "RPG is a treatment method created in 1980 by physiotherapist PH Souchard. Through his research on postural organization, he concluded that posture depends on the tension of static muscles (those that oppose the action of gravity).",
        blocks: [
          { type: "p", text: "He defined the way these muscles are organized as muscle chains. An evaluation identifies which chains have shortened most and how they relate to your presenting complaint. Treatment postures gently, progressively, and sustainably stretch them. These are active postures where the therapist guides the stretch and corrects compensations. The goal is to address the underlying postural cause behind the symptom. Sessions are one-to-one and usually scheduled weekly." },
        ],
      },
      fr: {
        metaTitle: "RPG — Rééducation posturale globale | Kinésica",
        metaDescription: "RPG chez Kinésica (Buenos Aires). Rééducation posturale globale et chaînes musculaires à Palermo. Séances individuelles pour assouplir la musculature statique.",
        breadcrumb: "RPG",
        h1: "RPG — Rééducation posturale globale",
        lead: "La RPG est une méthode créée en 1980 par le kinésithérapeute PH Souchard. Ses recherches sur l'organisation posturale ont montré que la posture dépend de la tension des muscles statiques (ceux qui s'opposent à la gravité).",
        blocks: [
          { type: "p", text: "Il a défini leur organisation sous le nom de chaînes musculaires. Une évaluation détermine quelles chaînes sont les plus raccourcies et leur lien avec le motif de consultation. Des postures de traitement étirent ces chaînes en douceur, progressivement et durablement. Ce sont des postures actives : le thérapeute guide l'étirement et corrige les compensations. L'objectif est de remonter du symptôme à la cause posturale. Les séances sont individuelles, en général une fois par semaine." },
        ],
      },
      pt: {
        metaTitle: "RPG — Reeducação Postural Global | Kinésica",
        metaDescription: "RPG na Kinésica (Buenos Aires). Reeducação postural global e cadeias musculares em Palermo. Sessões individuais para liberar a musculatura estática.",
        breadcrumb: "RPG",
        h1: "RPG — Reeducação Postural Global",
        lead: "A RPG é um método criado em 1980 pelo fisioterapeuta PH Souchard. Suas pesquisas sobre organização postural mostraram que a postura depende da tensão dos músculos estáticos (aqueles que se opõem à gravidade).",
        blocks: [
          { type: "p", text: "Ele definiu essa organização como cadeias musculares. Uma avaliação identifica quais cadeias estão mais encurtadas e como se relacionam com o motivo da consulta. Posturas terapêuticas alongam essas cadeias de forma suave, progressiva e sustentável. São posturas ativas: o terapeuta orienta o alongamento e corrige compensações. O objetivo é ir do sintoma à causa postural. As sessões são individuais, em geral semanais." },
        ],
      }
    },
    "osteopatia": {
      image: "osteopatia.jpg",
      es: {
        metaTitle: "Osteopatía Estructural y Visceral | Kinésica",
        metaDescription: "Osteopatía en Kinésica (Buenos Aires). Evaluación y tratamiento de disfunciones somáticas con técnicas manuales en Palermo.",
        breadcrumb: "Osteopatía",
        h1: "Osteopatía estructural y visceral",
        lead: "Es un método de evaluación y tratamiento de las disfunciones somáticas y de los síntomas que produce.",
        blocks: [
          { type: "p", text: "Relaciona los síntomas con la falta de movilidad de los tejidos del cuerpo (músculo, vísceras y tejido conectivo). Hay diversas técnicas de tratamiento según la característica de los tejidos a tratar." },
          { type: "p", text: "El principio es que la curación depende de la capacidad del cuerpo para curarse. Cuando hay una disfunción y/o algunas patologías esa capacidad se ve limitada por la pérdida de movimiento de los tejidos involucrados. Devolver la posibilidad de movimiento es permitir que el cuerpo active los mecanismos para curarse." },
          { type: "h2", text: "Osteopatía Estructural" },
          { type: "p", text: "Aborda las alteraciones en el sistema musculoesquelético. Dada la íntima dependencia de los tejidos, la alteración de un sector de la columna puede originar una disfunción visceral. Y al revés una disfunción visceral puede bloquear el movimiento de un sector de la columna. Es un motivo por el que algunas lesiones o síntomas se reiteran. Es necesario romper ese círculo vicioso. Se utilizan técnicas de thrust, de alta velocidad o las llamadas técnicas blandas." },
          { type: "h2", text: "Osteopatía Visceral" },
          { type: "p", text: "Las vísceras tienen un movimiento que le es propio, y se relaciona con el movimiento de las demás vísceras a través de tejido conectivo (epiplones, ligamentos y mesos). El movimiento del Diafragma, (músculo que separa tórax del abdomen) aumenta o disminuye la presión en estas cavidades y con esto participa del movimiento visceral. Estas presiones influyen tanto en las vísceras del tórax (respiratorias), del abdomen (digestivas) como sobre el contenido dentro de la pelvis (urogenital). Es necesario entonces restablecer la movilidad de las vísceras y verificar que el sistema en su conjunto trabaje en armonía para que las funciones se cumplan adecuadamente." },
          { type: "p", text: "En el abdomen encontramos el Peritoneo, bolsa virtual que envuelve a un conjunto de vísceras. El peritoneo termina en la pared de los músculos abdominales. La tensión de una víscera o del tejido conectivo que las conecta se transmite al músculo entonces. (en las inflamaciones agudas del peritoneo los abdominales se ponen rígidos, «vientre de madera» se lo llama). Una vez más la relación entre lo muscular y lo visceral." },
          { type: "p", text: "La frecuencia de las sesiones es generalmente cada 2 o 3 semanas, según el caso." },
        ],
      },
      en: {
        metaTitle: "Structural and Visceral Osteopathy | Kinésica",
        metaDescription: "Osteopathy at Kinésica (Buenos Aires). Assessment and treatment of somatic dysfunctions with manual techniques in Palermo.",
        breadcrumb: "Osteopathy",
        h1: "Structural and visceral osteopathy",
        lead: "Osteopathy is a method of evaluating and treating somatic dysfunctions and their associated symptoms.",
        blocks: [
          { type: "p", text: "It links symptoms to restricted mobility in the body's tissues (muscles, viscera, and connective tissue). Various treatment techniques are used depending on the characteristics of the tissues involved." },
          { type: "p", text: "The fundamental principle is that healing depends on the body's ability to heal itself. When dysfunction or certain pathologies are present, this ability is limited by the loss of movement in the affected tissues. Restoring mobility allows the body to activate its self-healing mechanisms." },
          { type: "h2", text: "Structural Osteopathy" },
          { type: "p", text: "Structural osteopathy addresses alterations in the musculoskeletal system. Given the close interconnection of tissues, an alteration in one part of the spine can trigger visceral dysfunction. Conversely, a visceral dysfunction can restrict movement in a part of the spine. This explains why some injuries or symptoms tend to recur. Breaking this cycle is essential." },
          { type: "p", text: "Techniques used include thrust manipulations, high-velocity techniques, and gentle soft-tissue approaches." },
          { type: "h2", text: "Visceral Osteopathy" },
          { type: "p", text: "Viscera have their own intrinsic movement and are interconnected through connective tissue (omentum, ligaments, and mesenteries). The movement of the diaphragm, the muscle that separates the thorax from the abdomen, creates pressure changes in these cavities, contributing to visceral mobility. These pressure variations affect thoracic organs (respiratory system), abdominal organs (digestive system), and pelvic organs (urogenital system)." },
          { type: "p", text: "Therefore, restoring visceral mobility and ensuring the system functions harmoniously is essential for its proper function." },
          { type: "p", text: "In the abdomen, we find the peritoneum, a membrane that encloses a group of viscera. It extends to the abdominal muscle wall, meaning that tension in a viscus or its connective tissue is transmitted to the muscles. (In cases of acute peritoneal inflammation, the abdominal muscles become rigid, a condition known as \"wooden belly.\") Once again, this highlights the relationship between the muscular and visceral systems." },
          { type: "p", text: "Osteopathy sessions are generally conducted every 2 to 3 weeks, depending on the case." },
        ],
      },
      fr: {
        metaTitle: "Ostéopathie structurelle et viscérale | Kinésica",
        metaDescription: "Ostéopathie chez Kinésica (Buenos Aires). Évaluation et traitement des dysfonctions somatiques par thérapie manuelle à Palermo.",
        breadcrumb: "Ostéopathie",
        h1: "Ostéopathie structurelle et viscérale",
        lead: "L'ostéopathie est une méthode d'évaluation et de traitement des dysfonctions somatiques et de leurs symptômes.",
        blocks: [
          { type: "p", text: "Elle relie les symptômes à une mobilité réduite des tissus (muscles, viscères, tissu conjonctif). Les techniques varient selon les tissus concernés." },
          { type: "p", text: "Le principe fondamental est que la guérison dépend de la capacité d'autoguérison du corps. En cas de dysfonction, cette capacité est limitée par la perte de mobilité ; la restaurer réactive les mécanismes de guérison." },
          { type: "h2", text: "Ostéopathie structurelle" },
          { type: "p", text: "L'ostéopathie structurelle traite les altérations de l'appareil locomoteur. Les tissus étant interconnectés, une atteinte vertébrale peut entraîner une dysfonction viscérale, et inversement — d'où la récurrence de certains symptômes. Il est essentiel de rompre ce cycle." },
          { type: "p", text: "Les techniques incluent les manipulations articulaires par impulsion, les techniques rapides et les techniques douces." },
          { type: "h2", text: "Ostéopathie viscérale" },
          { type: "p", text: "Les viscères ont un mouvement propre et sont reliés par le tissu conjonctif (omentum, ligaments, mésentères). Le diaphragme modifie les pressions dans les cavités thoracique, abdominale et pelvienne, favorisant la mobilité viscérale." },
          { type: "p", text: "Restaurer la mobilité viscérale et l'harmonie du système est donc essentiel." },
          { type: "p", text: "Le péritoine enveloppe un groupe de viscères et s'étend jusqu'à la paroi abdominale : la tension viscérale se transmet aux muscles (comme dans le « ventre de bois » en inflammation aiguë). Cela illustre encore le lien muscle–viscère." },
          { type: "p", text: "Les séances d'ostéopathie ont lieu en général toutes les 2 à 3 semaines, selon le cas." },
        ],
      },
      pt: {
        metaTitle: "Osteopatia estrutural e visceral | Kinésica",
        metaDescription: "Osteopatia na Kinésica (Buenos Aires). Avaliação e tratamento de disfunções somáticas com técnicas manuais em Palermo.",
        breadcrumb: "Osteopatia",
        h1: "Osteopatia estrutural e visceral",
        lead: "A osteopatia é um método de avaliação e tratamento de disfunções somáticas e seus sintomas.",
        blocks: [
          { type: "p", text: "Relaciona os sintomas à falta de mobilidade dos tecidos (músculos, vísceras, tecido conjuntivo). As técnicas variam conforme os tecidos envolvidos." },
          { type: "p", text: "O princípio fundamental é que a cura depende da capacidade de autocura do corpo. Quando há disfunção, essa capacidade fica limitada pela perda de mobilidade; restaurá-la reativa os mecanismos de cura." },
          { type: "h2", text: "Osteopatia estrutural" },
          { type: "p", text: "A osteopatia estrutural trata alterações do sistema musculoesquelético. Como os tecidos estão interconectados, uma alteração vertebral pode gerar disfunção visceral e vice-versa — daí a recorrência de alguns sintomas. Romper esse ciclo é essencial." },
          { type: "p", text: "As técnicas incluem manipulações articulares com impulso, técnicas de alta velocidade e técnicas suaves." },
          { type: "h2", text: "Osteopatia visceral" },
          { type: "p", text: "Os órgãos têm movimento próprio e estão conectados pelo tecido conjuntivo (omentum, ligamentos, mesentérios). O diafragma altera as pressões nas cavidades torácica, abdominal e pélvica, favorecendo a mobilidade visceral." },
          { type: "p", text: "Restaurar a mobilidade visceral e a harmonia do sistema é, portanto, essencial." },
          { type: "p", text: "O peritônio envolve um grupo de vísceras e se estende até a parede abdominal: a tensão visceral se transmite aos músculos (como no abdome em tábua na inflamação aguda). Isso ilustra a relação músculo–víscera." },
          { type: "p", text: "As sessões de osteopatia ocorrem em geral a cada 2 ou 3 semanas, conforme o caso." },
        ],
      }
    },
    "cadenas": {
      image: "cadenas_fisiologicas.jpg",
      es: {
        metaTitle: "Cadenas Fisiológicas | Kinésica",
        metaDescription: "Cadenas musculares en Kinésica (Buenos Aires). Método Busquet que relaciona estructura corporal y contenido visceral. Terapia manual en Palermo.",
        breadcrumb: "Cadenas Fisiológicas",
        h1: "Cadenas fisiológicas – método Busquet",
        lead: "Léopold Busquet es un fisioterapeuta y osteópata francés que trabajó inicialmente en Cadenas Musculares. Avanzó en su capacitación como osteópata y creó un método relacionando las dos formaciones. Este método agrega un concepto propio en el tratamiento de kinesiología: la relación Continente–Contenido.",
        blocks: [
          { type: "p", text: "Define la organización del cuerpo como la adaptación a las tensiones internas y externas (mecánicas, viscerales, cicatrices, emocionales, traumáticas...). Entiende al Continente (la forma del cuerpo) como el resultado del trabajo muscular buscando generar confort y/o aliviar dolores u otros síntomas. Tiene un método de evaluación propio que permite seguir las pistas que guían hacia las zonas de tensión. Evalúa cómo está organizado el cuerpo según la tensión de las cadenas fisiológicas (músculos, tejido nervioso, visceral, fascial…). El tratamiento se realiza mediante posturas de relajación de esas cadenas de mayor tensión. Son posturas muy suaves que buscan la efectividad por ser específicas para el tejido a tratar." },
          { type: "p", text: "Se trabaja en sesiones individuales." },
          { type: "p", text: "La frecuencia de las sesiones es una sesión cada una o dos semanas según los casos." },
        ],
      },
      en: {
        metaTitle: "Physiological Chains | Kinésica",
        metaDescription: "Muscle chains therapy at Kinésica (Buenos Aires). Busquet method linking body structure and visceral function. Manual therapy in Palermo.",
        breadcrumb: "Physiological Chains",
        h1: "Physiological chains – Busquet method",
        lead: "Léopold Busquet, a French physiotherapist and osteopath, initially worked with muscle chains before advancing his training in osteopathy. He later developed a method that integrates both disciplines, introducing a unique concept in physiotherapy: the container–content relationship.",
        blocks: [
          { type: "p", text: "According to Busquet, the body’s organization adapts to internal and external tensions—whether mechanical, visceral, scarring, emotional, or traumatic. He describes the Container (the body’s shape) as the result of muscular activity aimed at creating comfort and/or alleviating pain and other symptoms." },
          { type: "p", text: "This method features its own evaluation system, which tracks pathways leading to areas of tension. It assesses how the body organizes itself based on the tension in physiological chains (muscles, nervous tissue, visceral structures, fascia, etc.). Treatment involves relaxation postures that specifically target the chains with the highest tension. These gentle yet precise postures are designed to address the affected tissues effectively." },
          { type: "p", text: "Sessions are conducted individually, with a recommended frequency of once a week or every two weeks, depending on the case." },
        ],
      },
      fr: {
        metaTitle: "Chaînes physiologiques | Kinésica",
        metaDescription: "Chaînes musculaires chez Kinésica (Buenos Aires). Méthode Busquet reliant structure corporelle et fonctions viscérales. Thérapie manuelle à Palermo.",
        breadcrumb: "Chaînes physiologiques",
        h1: "Chaînes physiologiques — méthode Busquet",
        lead: "Léopold Busquet, kinésithérapeute et ostéopathe français, a d'abord travaillé sur les chaînes musculaires avant de développer une méthode intégrant les deux disciplines, avec le concept unique de relation contenant–contenu.",
        blocks: [
          { type: "p", text: "Selon Busquet, l'organisation du corps s'adapte aux tensions internes et externes — mécaniques, viscérales, cicatricielles, émotionnelles ou traumatiques. Le contenant (la forme du corps) résulte de l'activité musculaire visant le confort et/ou l'atténuation des symptômes." },
          { type: "p", text: "Cette méthode possède son propre système d'évaluation des trajets de tension. Le traitement utilise des postures de relâchement ciblant les chaînes les plus tendues — douces et précises." },
          { type: "p", text: "Séances individuelles, une fois par semaine ou toutes les deux semaines selon le cas." },
        ],
      },
      pt: {
        metaTitle: "Cadeias fisiológicas | Kinésica",
        metaDescription: "Cadeias musculares na Kinésica (Buenos Aires). Método Busquet que relaciona estrutura corporal e funções viscerais. Terapia manual em Palermo.",
        breadcrumb: "Cadeias fisiológicas",
        h1: "Cadeias fisiológicas — método Busquet",
        lead: "Léopold Busquet, fisioterapeuta e osteopata francês, trabalhou primeiro com cadeias musculares antes de desenvolver um método que integra as duas disciplinas, com o conceito único de relação recipiente–conteúdo.",
        blocks: [
          { type: "p", text: "Segundo Busquet, a organização do corpo se adapta a tensões internas e externas — mecânicas, viscerais, cicatriciais, emocionais ou traumáticas. Ele descreve o Recipiente (a forma do corpo) como resultado da atividade muscular voltada a criar conforto e/ou aliviar dor e outros sintomas." },
          { type: "p", text: "Este método possui seu próprio sistema de avaliação dos trajetos de tensão. O tratamento usa posturas de relaxamento direcionadas às cadeias mais tensionadas — suaves e precisas." },
          { type: "p", text: "Sessões individuais, semanais ou quinzenais conforme o caso." },
        ],
      }
    },
    "manipulaciones": {
      image: "manipulaciones_viscerales.jpg",
      es: {
        metaTitle: "Manipulaciones Viscerales | Kinésica",
        metaDescription: "Manipulaciones viscerales en Kinésica (Buenos Aires). Tratamiento de tensiones viscerales que afectan el aparato locomotor. Terapia manual en Palermo.",
        breadcrumb: "Manipulaciones viscerales",
        h1: "Manipulación visceral – método Barral",
        lead: "Es un tratamiento osteopático muy específico para el tejido visceral. La Terapia de Manipulaciones Viscerales busca devolver la movilidad al tejido fascial que conecta a las vísceras entre sí y con el aparato musculoesquelético. Fue creada por el fisioterapeuta francés Jean-Pierre Barral.",
        blocks: [
          { type: "p", text: "¿Por qué hacemos esto? Porque la tensión de estos tejidos limita la posibilidad de movimiento en el cuerpo, en el tejido cercano o a distancia. Sin ese movimiento disminuye la salud y se organizan los síntomas" },
          { type: "p", text: "¿Para qué lo hacemos? La limitación de movimiento, también en los tejidos internos, genera disfunciones que dan origen a cuadros dolorosos u otros síntomas. Devolver la capacidad de movimiento es ir en el sentido de la curación." },
          { type: "p", text: "¿Cómo lo hacemos? Evaluamos la tensión en el cuerpo mediante el contacto manual, es una forma de escuchar al tejido, y diversos test que nos permiten ir acercándonos a la mayor tensión del tejido conectivo en ese momento. Tejido que vincula unas vísceras con otras. Luego, para relajarlas, utilizamos técnicas que son muy suaves y efectivas" },
        ],
      },
      en: {
        metaTitle: "Visceral Manipulations | Kinésica",
        metaDescription: "Visceral manipulation at Kinésica (Buenos Aires). Treatment of visceral tensions affecting the locomotor system. Manual therapy in Palermo.",
        breadcrumb: "Visceral Manipulations",
        h1: "Visceral manipulation – Barral method",
        lead: "Visceral Manipulation is a specialized osteopathic treatment focused on visceral tissues. Developed by French physiotherapist Jean-Pierre Barral, this therapy aims to restore mobility to the fascial tissue that connects the viscera to each other and to the musculoskeletal system.",
        blocks: [
          { type: "h2", text: "Why is it needed?" },
          { type: "p", text: "Tension in these tissues restricts the body’s range of motion, both locally and at a distance. Without proper movement, overall health declines, and symptoms arise." },
          { type: "h2", text: "What is the goal?" },
          { type: "p", text: "A lack of mobility, even in internal tissues, can lead to dysfunction, causing pain and other symptoms. Restoring movement capacity supports the body’s natural healing process." },
          { type: "h2", text: "How is it performed?" },
          { type: "p", text: "Through manual contact, practitioners \"listen\" to the tissue and perform various tests to identify areas of highest connective tissue tension. Since these tissues link the viscera, releasing restrictions helps restore function." },
          { type: "p", text: "To relax and release these tensions, gentle yet highly effective techniques are applied." },
          { type: "p", text: "Session frequency: Typically every 2 to 3 weeks, depending on the individual case." },
        ],
      },
      fr: {
        metaTitle: "Manipulations viscérales | Kinésica",
        metaDescription: "Manipulations viscérales chez Kinésica (Buenos Aires). Traitement des tensions viscérales affectant l'appareil locomoteur. Thérapie manuelle à Palermo.",
        breadcrumb: "Manipulations viscérales",
        h1: "Manipulations viscérales — méthode Barral",
        lead: "La manipulation viscérale, développée par Jean-Pierre Barral, vise à restaurer la mobilité du tissu fascial reliant les viscères entre eux et à l'appareil locomoteur.",
        blocks: [
          { type: "h2", text: "Pourquoi est-ce nécessaire ?" },
          { type: "p", text: "La tension dans ces tissus limite l'amplitude de mouvement du corps, localement et à distance. Sans mouvement adéquat, la santé globale se dégrade et des symptômes apparaissent." },
          { type: "h2", text: "Quel est l'objectif ?" },
          { type: "p", text: "Une mobilité réduite, même dans les tissus internes, peut entraîner une dysfonction, avec douleur et autres symptômes. Restaurer la mobilité favorise le processus naturel de guérison du corps." },
          { type: "h2", text: "Comment se déroule-t-il ?" },
          { type: "p", text: "Par contact manuel, le praticien « écoute » les tissus et identifie les zones de tension conjonctive maximale ; libérer ces restrictions restaure la fonction." },
          { type: "p", text: "Des techniques douces et très efficaces permettent de relâcher ces tensions." },
          { type: "p", text: "Fréquence : en général toutes les 2 à 3 semaines, selon le cas." },
        ],
      },
      pt: {
        metaTitle: "Manipulações viscerais | Kinésica",
        metaDescription: "Manipulações viscerais na Kinésica (Buenos Aires). Tratamento de tensões viscerais que afetam o sistema locomotor. Terapia manual em Palermo.",
        breadcrumb: "Manipulações viscerais",
        h1: "Manipulação visceral — método Barral",
        lead: "A manipulação visceral, desenvolvida por Jean-Pierre Barral, busca restaurar a mobilidade do tecido fascial que conecta os órgãos entre si e ao sistema locomotor.",
        blocks: [
          { type: "h2", text: "Por que é necessário?" },
          { type: "p", text: "A tensão nesses tecidos limita a amplitude de movimento do corpo, localmente e à distância. Sem movimento adequado, a saúde global se deteriora e surgem sintomas." },
          { type: "h2", text: "Qual é o objetivo?" },
          { type: "p", text: "A falta de mobilidade, mesmo em tecidos internos, pode levar à disfunção, com dor e outros sintomas. Restaurar a mobilidade favorece o processo natural de cura do corpo." },
          { type: "h2", text: "Como funciona?" },
          { type: "p", text: "Por contato manual, o profissional « escuta » os tecidos e identifica zonas de máxima tensão conjuntiva; liberar essas restrições restaura a função." },
          { type: "p", text: "Técnicas suaves e muito eficazes permitem liberar essas tensões." },
          { type: "p", text: "Frequência: em geral a cada 2 ou 3 semanas, conforme o caso." },
        ],
      }
    },
    "neurodinamia": {
      image: "neurodinamia.jpg",
      es: {
        metaTitle: "Neurodinamia | Kinésica",
        metaDescription: "Neurodinamia en Kinésica (Buenos Aires). Movilización neural y tratamiento de trastornos del sistema nervioso en Palermo.",
        breadcrumb: "Neurodinamia",
        h1: "Neurodinamia",
        lead: "Si el sistema nervioso no transmite correctamente el impulso, la persona puede sentir dolor, modificaciones de la sensibilidad — parestesias, pinchazos, adormecimiento, falta de sensibilidad — o alteraciones en la nutrición de los tejidos que inerva. Dependiendo del grado de agresión que haya sufrido el nervio podemos tratarlo.",
        blocks: [
          { type: "p", text: "Simplificando la situación, podemos considerar que todos los tejidos reciben información de tono, sensibilidad o nutrición a través del sistema nervioso. La Neurodinamia es la aplicación de maniobras diagnósticas y terapéuticas, con el fin de evaluar y restaurar el funcionamiento y la mecánica del sistema nervioso." },
          { type: "p", text: "Para realizar esta tarea los nervios deben poder deslizarse adecuadamente en las superficies de contacto con otras estructuras ( músculos, ligamentos, articulaciones). Algunas veces las zonas donde deslizan los nervios se estrechan y pueden irritarse y alterar la conducción. Utilizamos las maniobras de neurodinamia para diferenciar el tejido nervioso de los demás tejidos y para restablecer las condiciones para una correcta transmisión del impulso." },
        ],
      },
      en: {
        metaTitle: "Neurodynamics | Kinésica",
        metaDescription: "Neurodynamics at Kinésica (Buenos Aires). Neural mobilization and treatment of nerve-related conditions in Palermo.",
        breadcrumb: "Neurodynamics",
        h1: "Neurodynamics",
        lead: "When the nervous system fails to properly transmit impulses, it can result in pain, altered sensations (such as paresthesia, tingling, numbness, or loss of sensitivity), and even impaired trophic supply to the tissues it innervates. Treatment depends on the degree of nerve involvement.",
        blocks: [
          { type: "p", text: "In simple terms, all tissues receive tone, sensitivity, and sensory and motor input through the nervous system. Neurodynamics refers to the application of diagnostic and therapeutic maneuvers designed to assess and restore both the function and mechanics of the nervous system." },
          { type: "p", text: "For optimal function, nerves must glide smoothly over the surfaces they interact with, such as muscles, ligaments, and joints. However, when these sliding pathways become restricted or compressed, nerve irritation and impaired conduction can occur." },
          { type: "p", text: "Neurodynamic maneuvers help differentiate nervous tissue from other structures and restore the conditions necessary for proper impulse transmission." },
        ],
      },
      fr: {
        metaTitle: "Neurodynamique | Kinésica",
        metaDescription: "Neurodynamique chez Kinésica (Buenos Aires). Mobilisation neurale et traitement des troubles nerveux à Palermo.",
        breadcrumb: "Neurodynamique",
        h1: "Neurodynamique",
        lead: "Lorsque le système nerveux transmet mal les impulsions, il peut en résulter douleur, sensations altérées (paresthésies, fourmillements, engourdissement) ou troubles trophiques des tissus innervés. Le traitement dépend du degré d'atteinte nerveuse.",
        blocks: [
          { type: "p", text: "En bref, tous les tissus reçoivent tonus, sensibilité et apports sensorimoteurs via le système nerveux. La neurodynamique applique des manœuvres diagnostiques et thérapeutiques pour évaluer et restaurer la fonction et la mécanique nerveuses." },
          { type: "p", text: "Pour une fonction optimale, les nerfs doivent glisser librement sur muscles, ligaments et articulations ; si ces trajets sont restreints, irritation et conduction altérée peuvent survenir." },
          { type: "p", text: "Les manœuvres neurodynamiques distinguent le tissu nerveux des autres structures et restaurent les conditions d'une bonne transmission des impulsions." },
        ],
      },
      pt: {
        metaTitle: "Neurodinâmica | Kinésica",
        metaDescription: "Neurodinâmica na Kinésica (Buenos Aires). Mobilização neural e tratamento de distúrbios do sistema nervoso em Palermo.",
        breadcrumb: "Neurodinâmica",
        h1: "Neurodinâmica",
        lead: "Quando o sistema nervoso transmite mal os impulsos, podem surgir dor, sensações alteradas (parestesias, formigamento, dormência) ou alterações tróficas nos tecidos inervados. O tratamento depende do grau de comprometimento neural.",
        blocks: [
          { type: "p", text: "Em resumo, todos os tecidos recebem tônus, sensibilidade e estímulos sensorimotores pelo sistema nervoso. A neurodinâmica aplica manobras diagnósticas e terapêuticas para avaliar e restaurar a função e a mecânica nervosas." },
          { type: "p", text: "Para funcionamento ideal, os nervos devem deslizar livremente sobre músculos, ligamentos e articulações; se esses trajetos ficam restritos, podem ocorrer irritação e condução alterada." },
          { type: "p", text: "As manobras neurodinâmicas distinguem o tecido nervoso das demais estruturas e restauram as condições de boa transmissão dos impulsos." },
        ],
      }
    },
    "atm": {
      image: "atm.jpg",
      es: {
        metaTitle: "ATM – Articulación Temporomandibular | Kinésica",
        metaDescription: "Tratamiento de ATM en Kinésica (Buenos Aires). Mandíbula, dolor, chasquidos y bruxismo con terapia manual en Palermo.",
        breadcrumb: "ATM",
        h1: "ATM – Articulación temporomandibular",
        lead: "Cuando la articulación temporomandibular (ATM) no funciona con normalidad, la persona puede sentir dolor en la mandíbula, ruidos al abrir la boca (como chasquidos), dificultad para masticar o incluso bloqueos al intentar cerrar o abrir del todo. Dependiendo de si el problema está en el hueso, en el disco o en los músculos, el tratamiento se enfocará en devolver el movimiento natural.",
        blocks: [
          { type: "p", text: "Simplificando la situación, la ATM es la pieza que une la mandíbula con el cráneo y es fundamental para hablar, comer y bostezar. El tratamiento especializado busca evaluar y corregir cómo se mueve esta articulación para que no genere tensión en la cara o el cuello." },
          { type: "p", text: "Para que todo funcione bien, existe un pequeño disco entre los huesos que debe desplazarse suavemente cada vez que movemos la boca. A veces, por tensión excesiva o por apretar mucho los dientes, este disco se desplaza o los músculos se sobrecargan. Utilizamos técnicas de movilidad y ejercicios suaves para que la mandíbula vuelva a su sitio, los músculos se relajen y la persona pueda volver a sus actividades diarias sin molestias." },
        ],
      },
      en: {
        metaTitle: "TMJ – Temporomandibular Joint | Kinésica",
        metaDescription: "TMJ treatment at Kinésica (Buenos Aires). Jaw pain, clicking and bruxism with manual therapy in Palermo.",
        breadcrumb: "TMJ",
        h1: "TMJ – Temporomandibular joint",
        lead: "When the temporomandibular joint (TMJ) does not function normally, a person may experience jaw pain, noises when opening the mouth (such as clicking), difficulty chewing, or even locking when trying to fully close or open. Depending on whether the problem lies in the bone, the disc, or the muscles, treatment will focus on restoring natural movement.",
        blocks: [
          { type: "p", text: "In simple terms, the TMJ is the joint that connects the jaw to the skull and is essential for speaking, eating, and yawning. Specialized treatment aims to assess and correct how this joint moves so it does not create tension in the face or neck." },
          { type: "p", text: "For everything to work properly, a small disc between the bones must glide smoothly every time we move the mouth. Sometimes, due to excessive tension or teeth clenching, this disc shifts or the muscles become overloaded. We use mobility techniques and gentle exercises so the jaw returns to its proper position, the muscles relax, and the person can return to daily activities without discomfort." },
        ],
      },
      fr: {
        metaTitle: "ATM — Articulation temporomandibulaire | Kinésica",
        metaDescription: "Traitement de l'ATM chez Kinésica (Buenos Aires). Mâchoire, douleur, claquements et bruxisme par thérapie manuelle à Palermo.",
        breadcrumb: "ATM",
        h1: "ATM — Articulation temporomandibulaire",
        lead: "Lorsque l'articulation temporomandibulaire (ATM) ne fonctionne pas normalement, on peut ressentir de la douleur à la mâchoire, des bruits à l'ouverture (claquements), des difficultés à mâcher ou un blocage. Le traitement vise à restaurer le mouvement naturel selon que l'atteinte est osseuse, discale ou musculaire.",
        blocks: [
          { type: "p", text: "L'ATM relie la mâchoire au crâne et est essentielle pour parler, manger et bâiller. Le traitement évalue et corrige son mouvement pour éviter les tensions du visage et du cou." },
          { type: "p", text: "Un petit disque doit glisser à chaque mouvement de la bouche. Sous tension ou bruxisme, il peut se déplacer ou les muscles se surcharger. Techniques de mobilité et exercices doux remettent la mâchoire en place et relâchent les muscles." },
        ],
      },
      pt: {
        metaTitle: "ATM — Articulação temporomandibular | Kinésica",
        metaDescription: "Tratamento de ATM na Kinésica (Buenos Aires). Mandíbula, dor, estalos e bruxismo com terapia manual em Palermo.",
        breadcrumb: "ATM",
        h1: "ATM — Articulação temporomandibular",
        lead: "Quando a articulação temporomandibular (ATM) não funciona normalmente, podem surgir dor na mandíbula, ruídos ao abrir a boca (estalos), dificuldade para mastigar ou sensação de travamento. O tratamento busca restaurar o movimento natural, conforme a origem seja óssea, discal ou muscular.",
        blocks: [
          { type: "p", text: "A ATM liga a mandíbula ao crânio e é essencial para falar, comer e bocejar. O tratamento avalia e corrige seu movimento para evitar tensões no rosto e no pescoço." },
          { type: "p", text: "Um pequeno disco deve deslizar a cada movimento da boca. Com tensão ou bruxismo, ele pode se deslocar ou os músculos se sobrecarregar. Técnicas de mobilidade e exercícios suaves reposicionam a mandíbula e relaxam os músculos." },
        ],
      }
    },
    "acupuntura": {
      image: "osteopatia.jpg",
      es: {
        metaTitle: "Acupuntura | Kinésica",
        metaDescription: "Acupuntura en Kinésica (Buenos Aires). Medicina tradicional china integrada al abordaje del dolor y el estrés en Palermo.",
        breadcrumb: "Acupuntura",
        h1: "Acupuntura",
        lead: "La acupuntura es una técnica de la medicina tradicional china que utiliza la estimulación de puntos específicos del cuerpo —con agujas finas u otros métodos— para modular el dolor, reducir la tensión y favorecer la autorregulación del organismo.",
        blocks: [
          { type: "p", text: "En el consultorio se valora el estado general de la persona y se integra la acupuntura con otras herramientas de terapia manual cuando el caso lo requiere. No sustituye la evaluación médica cuando hay patologías que deben ser estudiadas por el especialista correspondiente." },
          { type: "p", text: "Las sesiones buscan aliviar molestias musculares o articulares, mejorar el descanso, disminuir el estrés y acompañar procesos de rehabilitación. La frecuencia y la duración del tratamiento se adaptan a cada persona y a sus objetivos." },
        ],
      },
      en: {
        metaTitle: "Acupuncture | Kinésica",
        metaDescription: "Acupuncture at Kinésica (Buenos Aires). Traditional Chinese medicine as part of an integrated approach to pain and stress in Palermo.",
        breadcrumb: "Acupuncture",
        h1: "Acupuncture",
        lead: "Acupuncture is a traditional Chinese medicine technique that stimulates specific points on the body—with fine needles or other methods—to modulate pain, reduce tension and support the body's self-regulation.",
        blocks: [
          { type: "p", text: "In the clinic we assess the person's overall condition and integrate acupuncture with other manual therapy tools when appropriate. It does not replace medical evaluation when conditions require assessment by the relevant specialist." },
          { type: "p", text: "Sessions aim to relieve muscle or joint discomfort, improve rest, reduce stress and support rehabilitation. Frequency and length of treatment are tailored to each person and their goals." },
        ],
      },
      fr: {
        metaTitle: "Acupuncture | Kinésica",
        metaDescription: "Acupuncture chez Kinésica (Buenos Aires). Médecine traditionnelle chinoise intégrée à la prise en charge de la douleur et du stress à Palermo.",
        breadcrumb: "Acupuncture",
        h1: "Acupuncture",
        lead: "L'acupuncture est une technique de médecine traditionnelle chinoise qui stimule des points précis du corps — par de fines aiguilles ou d'autres moyens — pour moduler la douleur, réduire la tension et favoriser l'autorégulation de l'organisme.",
        blocks: [
          { type: "p", text: "Au cabinet, on évalue l'état général de la personne et on intègre l'acupuncture aux autres outils de thérapie manuelle si nécessaire. Elle ne remplace pas l'avis médical lorsque des pathologies doivent être étudiées par le spécialiste concerné." },
          { type: "p", text: "Les séances visent à soulager les gênes musculaires ou articulaires, améliorer le repos, diminuer le stress et accompagner la rééducation. La fréquence et la durée du traitement s'adaptent à chaque personne et à ses objectifs." },
        ],
      },
      pt: {
        metaTitle: "Acupuntura | Kinésica",
        metaDescription: "Acupuntura na Kinésica (Buenos Aires). Medicina tradicional chinesa integrada ao tratamento da dor e do estresse em Palermo.",
        breadcrumb: "Acupuntura",
        h1: "Acupuntura",
        lead: "A acupuntura é uma técnica da medicina tradicional chinesa que estimula pontos específicos do corpo — com agulhas finas ou outros recursos — para modular a dor, reduzir a tensão e favorecer a autorregulação do organismo.",
        blocks: [
          { type: "p", text: "No consultório, avaliamos o estado geral da pessoa e integramos a acupuntura aos outros recursos de terapia manual quando necessário. Ela não substitui o parecer médico quando patologias precisam ser investigadas pelo especialista." },
          { type: "p", text: "As sessões visam aliviar desconfortos musculares ou articulares, melhorar o descanso, reduzir o estresse e acompanhar a reabilitação. A frequência e a duração do tratamento se adaptam a cada pessoa e aos seus objetivos." },
        ],
      }
    },
    "posturologia-clinica": {
      image: "osteopatia.jpg",
      es: {
        metaTitle: "Posturología Clínica | Kinésica",
        metaDescription: "Posturología clínica en Kinésica (Buenos Aires). Evaluación de postura, equilibrio y apoyo plantar en Palermo.",
        breadcrumb: "Posturología Clínica",
        h1: "Posturología Clínica",
        lead: "La posturología clínica estudia cómo el cuerpo se organiza en la gravedad: la posición de la cabeza, la columna, la pelvis y el apoyo de los pies influyen en el equilibrio, la marcha y la distribución de cargas. Cuando hay desajustes, pueden aparecer dolores recurrentes, fatiga o sensación de inestabilidad.",
        blocks: [
          { type: "p", text: "Mediante una evaluación global —que incluye la observación de la postura estática y dinámica, las pruebas de equilibrio y, cuando corresponde, el análisis del apoyo plantar— se identifican los factores que mantienen la tensión o el dolor. El objetivo es comprender la causa y no solo el síntoma." },
          { type: "p", text: "El tratamiento combina técnicas manuales, ejercicios de reeducación postural y, si hace falta, recursos como plantillas o indicaciones para el día a día. Así se busca que la persona recupere un apoyo más estable, una mejor alineación y mayor comodidad en sus actividades habituales." },
        ],
      },
      en: {
        metaTitle: "Clinical Posturology | Kinésica",
        metaDescription: "Clinical posturology at Kinésica (Buenos Aires). Assessment of posture, balance and plantar support in Palermo.",
        breadcrumb: "Clinical Posturology",
        h1: "Clinical Posturology",
        lead: "Clinical posturology studies how the body organizes itself in gravity: the position of the head, spine, pelvis and plantar support influence balance, gait and load distribution. When imbalances exist, recurring pain, fatigue or a sense of instability may appear.",
        blocks: [
          { type: "p", text: "Through a global assessment—including static and dynamic posture, balance tests and, when appropriate, plantar support analysis—we identify factors that maintain tension or pain. The goal is to understand the cause, not only the symptom." },
          { type: "p", text: "Treatment combines manual techniques, postural re-education exercises and, when needed, resources such as insoles or daily-life recommendations. The aim is a more stable support, better alignment and greater comfort in everyday activities." },
        ],
      },
      fr: {
        metaTitle: "Posturologie clinique | Kinésica",
        metaDescription: "Posturologie clinique chez Kinésica (Buenos Aires). Évaluation de la posture, de l'équilibre et de l'appui plantaire à Palermo.",
        breadcrumb: "Posturologie clinique",
        h1: "Posturologie clinique",
        lead: "La posturologie clinique étudie comment le corps s'organise dans la gravité : la position de la tête, de la colonne, du bassin et l'appui des pieds influencent l'équilibre, la marche et la répartition des charges. En cas de déséquilibre, peuvent apparaître douleurs récurrentes, fatigue ou sensation d'instabilité.",
        blocks: [
          { type: "p", text: "Une évaluation globale — observation posturale statique et dynamique, tests d'équilibre et, le cas échéant, analyse de l'appui plantaire — permet d'identifier les facteurs qui entretiennent tension ou douleur. L'objectif est de comprendre la cause, pas seulement le symptôme." },
          { type: "p", text: "Le traitement associe techniques manuelles, exercices de rééducation posturale et, si nécessaire, semelles ou conseils pour le quotidien. On vise un appui plus stable, un meilleur alignement et plus de confort dans les activités habituelles." },
        ],
      },
      pt: {
        metaTitle: "Posturologia clínica | Kinésica",
        metaDescription: "Posturologia clínica na Kinésica (Buenos Aires). Avaliação de postura, equilíbrio e apoio plantar em Palermo.",
        breadcrumb: "Posturologia clínica",
        h1: "Posturologia clínica",
        lead: "A posturologia clínica estuda como o corpo se organiza na gravidade: a posição da cabeça, coluna, pelve e apoio plantar influenciam equilíbrio, marcha e distribuição de cargas. Quando há desequilíbrios, podem surgir dor recorrente, fadiga ou sensação de instabilidade.",
        blocks: [
          { type: "p", text: "Por meio de uma avaliação global — postura estática e dinâmica, testes de equilíbrio e, quando indicado, análise do apoio plantar — identificamos fatores que mantêm tensão ou dor. O objetivo é compreender a causa, não apenas o sintoma." },
          { type: "p", text: "O tratamento combina técnicas manuais, exercícios de reeducação postural e, quando necessário, palmilhas ou recomendações para o dia a dia. Buscamos apoio mais estável, melhor alinhamento e maior conforto nas atividades cotidianas." },
        ],
      }
    }
};

/** @typedef {{ metaTitle: string, metaDescription: string, breadcrumb: string, h1: string, lead: string, blocks: Array<{ type: 'p'|'h2', text: string }> }} MethodLang */

export function methodForStem(stem) {
  return METHODS[stem] ?? null;
}
