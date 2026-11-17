/**
 * Method-page FAQs (ES / EN / FR / PT): visible accordion + FAQPage JSON-LD.
 * Keep answers concise (~20–45 words) for snippets / answer engines.
 */
export const METHOD_FAQ_UI = {
  es: { title: "Preguntas frecuentes" },
  en: { title: "Frequently asked questions" },
  fr: { title: "Questions fréquentes" },
  pt: { title: "Perguntas frequentes" },
};

/** @type {Record<string, Record<"es"|"en"|"fr"|"pt", { q: string, a: string }[]>>} */
export const METHOD_FAQS = {
  kinesiologia: {
    es: [
      {
        q: "¿Osteopatía o kinesiología: cuál conviene?",
        a: "Depende del objetivo y de la evaluación. La kinesiología suele centrarse en recuperar movimiento, fuerza y función con ejercicio terapéutico y terapia manual; la osteopatía utiliza técnicas manuales para valorar y tratar disfunciones somáticas. En algunos casos pueden complementarse.",
      },
      {
        q: "¿Cuánto dura una sesión de kinesiología?",
        a: "Cada sesión es individual y dura aproximadamente una hora. Al inicio suele ser semanal; luego se espacia según la evolución y los objetivos del tratamiento.",
      },
    ],
    en: [
      {
        q: "Osteopathy or kinesiology: which is better?",
        a: "It depends on your goal and assessment. Kinesiology usually focuses on restoring movement, strength, and function through therapeutic exercise and manual therapy; osteopathy uses hands-on techniques to assess and treat somatic dysfunctions. They may complement each other in some cases.",
      },
      {
        q: "How long is a kinesiology session?",
        a: "Each session is one-to-one and lasts about one hour. Care often starts weekly, then spacing adjusts as progress and goals evolve.",
      },
    ],
    fr: [
      {
        q: "Ostéopathie ou kinésithérapie : laquelle choisir ?",
        a: "Cela dépend de votre objectif et du bilan. La kinésithérapie vise généralement à retrouver mouvement, force et fonction avec des exercices thérapeutiques et une thérapie manuelle ; l'ostéopathie utilise des techniques manuelles pour évaluer et traiter les dysfonctions somatiques. Les deux approches peuvent parfois se compléter.",
      },
      {
        q: "Combien dure une séance de kinésithérapie ?",
        a: "Chaque séance est individuelle et dure environ une heure. Au début, elle est souvent hebdomadaire, puis l'espacement s'adapte à l'évolution.",
      },
    ],
    pt: [
      {
        q: "Osteopatia ou fisioterapia: qual escolher?",
        a: "Depende do objetivo e da avaliação. A fisioterapia costuma focar a recuperação de movimento, força e função com exercícios terapêuticos e terapia manual; a osteopatia usa técnicas manuais para avaliar e tratar disfunções somáticas. Em alguns casos, podem se complementar.",
      },
      {
        q: "Quanto dura uma sessão de fisioterapia?",
        a: "Cada sessão é individual e dura cerca de uma hora. No início costuma ser semanal; depois o intervalo se ajusta conforme a evolução.",
      },
    ],
  },
  rpg: {
    es: [
      {
        q: "¿Cómo es una sesión de RPG?",
        a: "Se evalúan las cadenas musculares más acortadas y se trabajan con posturas activas, suaves y sostenidas. El terapeuta guía el estiramiento, corrige compensaciones y busca la causa postural del síntoma. Las sesiones son individuales y en general semanales.",
      },
      {
        q: "¿Para quién está indicada la RPG?",
        a: "Es útil ante dolor o rigidez relacionados con desalineamiento postural, cadenas musculares acortadas y compensaciones que se reiteran. No es un estiramiento genérico: el plan se define tras la evaluación individual.",
      },
    ],
    en: [
      {
        q: "How does an RPG session work?",
        a: "An assessment identifies the most shortened muscle chains. Active, gentle, sustained postures stretch them while the therapist guides the stretch and corrects compensations, aiming at the postural cause behind the symptom. Sessions are one-to-one and usually weekly.",
      },
      {
        q: "Who is RPG for?",
        a: "It helps when pain or stiffness relates to postural misalignment, shortened muscle chains, and recurring compensations. It is not generic stretching: the plan follows an individual assessment.",
      },
    ],
    fr: [
      {
        q: "Comment se déroule une séance de RPG ?",
        a: "Le bilan identifie les chaînes les plus raccourcies. Des postures actives, douces et soutenues les étirent ; le thérapeute guide et corrige les compensations pour remonter à la cause posturale. Séances individuelles, en général hebdomadaires.",
      },
      {
        q: "À qui s'adresse la RPG ?",
        a: "Elle est utile en cas de douleur ou de raideur liées à un désalignement postural, à des chaînes raccourcies et à des compensations répétées. Ce n'est pas un étirement générique : le plan suit le bilan individuel.",
      },
    ],
    pt: [
      {
        q: "Como funciona uma sessão de RPG?",
        a: "A avaliação identifica as cadeias mais encurtadas. Posturas ativas, suaves e sustentadas as alongam; o terapeuta orienta e corrige compensações, buscando a causa postural do sintoma. Sessões individuais, em geral semanais.",
      },
      {
        q: "Para quem a RPG é indicada?",
        a: "Ajuda quando dor ou rigidez se relacionam a desalinhamento postural, cadeias encurtadas e compensações recorrentes. Não é alongamento genérico: o plano segue a avaliação individual.",
      },
    ],
  },
  osteopatia: {
    es: [
      {
        q: "¿Qué diferencia hay entre osteopatía estructural y visceral?",
        a: "La estructural aborda el sistema musculoesquelético con técnicas de thrust o blandas. La visceral restaura la movilidad de órganos y tejidos de conexión. Ambas se relacionan: una disfunción visceral puede bloquear la columna y viceversa.",
      },
      {
        q: "¿Con qué frecuencia se hacen las sesiones de osteopatía?",
        a: "En general cada 2 o 3 semanas, según el caso, la evolución y la respuesta de los tejidos. Cada sesión es individual y de dedicación exclusiva.",
      },
    ],
    en: [
      {
        q: "What is the difference between structural and visceral osteopathy?",
        a: "Structural osteopathy addresses the musculoskeletal system with thrust or soft-tissue techniques. Visceral work restores mobility of organs and connecting tissues. They interact: a visceral dysfunction can restrict the spine and vice versa.",
      },
      {
        q: "How often are osteopathy sessions?",
        a: "Typically every 2 to 3 weeks, depending on the case, progress, and tissue response. Each session is one-to-one with dedicated care time.",
      },
    ],
    fr: [
      {
        q: "Quelle différence entre ostéopathie structurelle et viscérale ?",
        a: "La structurelle traite l'appareil locomoteur (thrust ou techniques douces). La viscérale restaure la mobilité des organes et tissus de liaison. Elles interagissent : une dysfonction viscérale peut bloquer la colonne et inversement.",
      },
      {
        q: "À quelle fréquence les séances d'ostéopathie ?",
        a: "En général toutes les 2 ou 3 semaines, selon le cas et la réponse des tissus. Chaque séance est individuelle et dédiée.",
      },
    ],
    pt: [
      {
        q: "Qual a diferença entre osteopatia estrutural e visceral?",
        a: "A estrutural trata o sistema musculoesquelético com thrust ou técnicas suaves. A visceral restaura a mobilidade de órgãos e tecidos de ligação. Elas se relacionam: uma disfunção visceral pode bloquear a coluna e vice-versa.",
      },
      {
        q: "Com que frequência são as sessões de osteopatia?",
        a: "Em geral a cada 2 ou 3 semanas, conforme o caso e a resposta dos tecidos. Cada sessão é individual e de dedicação exclusiva.",
      },
    ],
  },
  cadenas: {
    es: [
      {
        q: "¿Qué son las cadenas fisiológicas de Busquet?",
        a: "Es un método que relaciona la forma del cuerpo (continente) con tensiones internas y externas — musculares, viscerales, fasciales o emocionales. Evalúa cadenas de tensión y las trata con posturas suaves y específicas.",
      },
      {
        q: "¿Cada cuánto se trabaja con cadenas fisiológicas?",
        a: "Las sesiones son individuales, en general una vez por semana o cada dos semanas según el caso y la evolución de las tensiones.",
      },
    ],
    en: [
      {
        q: "What are Busquet physiological chains?",
        a: "A method linking body shape (the container) with internal and external tensions—muscular, visceral, fascial, or emotional. It assesses tension chains and treats them with gentle, tissue-specific postures.",
      },
      {
        q: "How often are physiological-chain sessions?",
        a: "Sessions are one-to-one, usually weekly or every two weeks depending on the case and how tensions evolve.",
      },
    ],
    fr: [
      {
        q: "Que sont les chaînes physiologiques de Busquet ?",
        a: "Une méthode reliant la forme du corps (contenant) aux tensions internes et externes — musculaires, viscérales, fasciales ou émotionnelles. Elle évalue les chaînes de tension et les traite par des postures douces et spécifiques.",
      },
      {
        q: "À quelle fréquence les séances de chaînes ?",
        a: "Séances individuelles, en général une fois par semaine ou toutes les deux semaines selon le cas.",
      },
    ],
    pt: [
      {
        q: "O que são as cadeias fisiológicas de Busquet?",
        a: "Um método que relaciona a forma do corpo (recipiente) a tensões internas e externas — musculares, viscerais, fasciais ou emocionais. Avalia cadeias de tensão e as trata com posturas suaves e específicas.",
      },
      {
        q: "Com que frequência são as sessões de cadeias?",
        a: "Sessões individuais, em geral semanais ou quinzenais conforme o caso e a evolução das tensões.",
      },
    ],
  },
  manipulaciones: {
    es: [
      {
        q: "¿Para qué sirven las manipulaciones viscerales?",
        a: "Buscan devolver movilidad al tejido fascial que conecta las vísceras entre sí y con el aparato locomotor. Cuando ese tejido se tensa, puede limitar el movimiento y generar dolor u otros síntomas a distancia.",
      },
      {
        q: "¿Las técnicas viscerales son agresivas?",
        a: "No. Tras evaluar la tensión con contacto manual y tests, se aplican maniobras suaves y específicas. La frecuencia suele ser cada 2 o 3 semanas según el caso.",
      },
    ],
    en: [
      {
        q: "What is visceral manipulation for?",
        a: "It aims to restore mobility to the fascial tissue linking organs to each other and to the musculoskeletal system. When that tissue tightens, movement can be limited and pain or other symptoms may appear locally or at a distance.",
      },
      {
        q: "Are visceral techniques aggressive?",
        a: "No. After assessing tension with manual listening and tests, gentle, specific maneuvers are used. Sessions are often every 2 to 3 weeks depending on the case.",
      },
    ],
    fr: [
      {
        q: "À quoi servent les manipulations viscérales ?",
        a: "Elles visent à restaurer la mobilité du tissu fascial reliant les viscères entre eux et à l'appareil locomoteur. Quand ce tissu se tend, le mouvement peut se limiter et des symptômes apparaître localement ou à distance.",
      },
      {
        q: "Les techniques viscérales sont-elles agressives ?",
        a: "Non. Après évaluation manuelle de la tension, des manœuvres douces et ciblées sont appliquées. La fréquence est souvent toutes les 2 ou 3 semaines selon le cas.",
      },
    ],
    pt: [
      {
        q: "Para que servem as manipulações viscerais?",
        a: "Buscam restaurar a mobilidade do tecido fascial que liga os órgãos entre si e ao sistema locomotor. Quando esse tecido tensiona, o movimento pode se limitar e surgir dor ou outros sintomas localmente ou à distância.",
      },
      {
        q: "As técnicas viscerais são agressivas?",
        a: "Não. Após avaliar a tensão com contato manual e testes, aplicam-se manobras suaves e específicas. A frequência costuma ser a cada 2 ou 3 semanas conforme o caso.",
      },
    ],
  },
  neurodinamia: {
    es: [
      {
        q: "¿Qué es la neurodinamia?",
        a: "Son maniobras diagnósticas y terapéuticas para evaluar y restaurar la mecánica del sistema nervioso. Los nervios deben deslizar bien respecto a músculos y articulaciones; si el trayecto se estrecha, puede haber dolor, hormigueo o alteración de la sensibilidad.",
      },
      {
        q: "¿Cuándo se indica la neurodinamia?",
        a: "Cuando hay sospecha de irritación o restricción neural — dolor irradiado, parestesias o síntomas que cambian con ciertos movimientos. Sirve para diferenciar tejido nervioso de otros tejidos y guiar el tratamiento.",
      },
    ],
    en: [
      {
        q: "What is neurodynamics?",
        a: "Diagnostic and therapeutic maneuvers to assess and restore nervous-system mechanics. Nerves need to glide relative to muscles and joints; if the pathway narrows, pain, tingling, or altered sensation can appear.",
      },
      {
        q: "When is neurodynamics indicated?",
        a: "When neural irritation or restriction is suspected—radiating pain, paresthesia, or symptoms that change with certain movements. It helps differentiate nerve tissue from other tissues and guide care.",
      },
    ],
    fr: [
      {
        q: "Qu'est-ce que la neurodynamique ?",
        a: "Des manœuvres diagnostiques et thérapeutiques pour évaluer et restaurer la mécanique nerveuse. Les nerfs doivent glisser par rapport aux muscles et articulations ; si le trajet se rétrécit, douleur, fourmillements ou sensibilité altérée peuvent apparaître.",
      },
      {
        q: "Quand la neurodynamique est-elle indiquée ?",
        a: "En cas de suspicion d'irritation ou de restriction neurale — douleur irradiée, paresthésies ou symptômes qui changent avec certains mouvements. Elle aide à distinguer le tissu nerveux et à orienter le traitement.",
      },
    ],
    pt: [
      {
        q: "O que é a neurodinâmica?",
        a: "Manobras diagnósticas e terapêuticas para avaliar e restaurar a mecânica do sistema nervoso. Os nervos precisam deslizar em relação a músculos e articulações; se o trajeto se estreita, podem surgir dor, formigamento ou alteração da sensibilidade.",
      },
      {
        q: "Quando a neurodinâmica é indicada?",
        a: "Quando há suspeita de irritação ou restrição neural — dor irradiada, parestesias ou sintomas que mudam com certos movimentos. Ajuda a diferenciar o tecido nervoso e a orientar o tratamento.",
      },
    ],
  },
  atm: {
    es: [
      {
        q: "¿Qué hacer ante dolor mandibular?",
        a: "Evitá forzar la apertura, masticar alimentos muy duros o mantener los dientes apretados. Si el dolor persiste, hay chasquidos dolorosos, bloqueo o dificultad para masticar, conviene una evaluación de ATM; ante hinchazón, fiebre o dificultad para tragar o respirar, buscá atención médica prioritaria.",
      },
      {
        q: "¿Qué se trata en una consulta de ATM?",
        a: "Se evalúa el movimiento de la mandíbula, el disco articular y la musculatura masticatoria, y su relación con cuello y postura. El abordaje usa terapia manual y ejercicios suaves para recuperar movilidad y bajar tensión.",
      },
    ],
    en: [
      {
        q: "What should you do about jaw pain?",
        a: "Avoid forcing your mouth open, chewing very hard foods, or keeping your teeth clenched. If pain persists or there is painful clicking, locking, or difficulty chewing, arrange a TMJ assessment; swelling, fever, or difficulty swallowing or breathing requires prompt medical care.",
      },
      {
        q: "What does a TMJ consultation include?",
        a: "We assess jaw movement, the articular disc, and masticatory muscles, plus links to the neck and posture. Care uses manual therapy and gentle exercises to restore mobility and reduce tension.",
      },
    ],
    fr: [
      {
        q: "Que faire en cas de douleur à la mâchoire ?",
        a: "Évitez de forcer l'ouverture, de mâcher des aliments très durs ou de serrer les dents. Si la douleur persiste, avec claquements douloureux, blocage ou difficulté à mâcher, un bilan de l'ATM est indiqué ; un gonflement, de la fièvre ou une difficulté à avaler ou respirer nécessitent un avis médical rapide.",
      },
      {
        q: "Que comporte une consultation d'ATM ?",
        a: "On évalue le mouvement de la mâchoire, le disque articulaire et les muscles masticateurs, ainsi que le lien avec le cou et la posture. Le soin combine thérapie manuelle et exercices doux pour retrouver mobilité et réduire la tension.",
      },
    ],
    pt: [
      {
        q: "O que fazer diante de dor na mandíbula?",
        a: "Evite forçar a abertura da boca, mastigar alimentos muito duros ou manter os dentes apertados. Se a dor persistir, houver estalos dolorosos, travamento ou dificuldade para mastigar, faça uma avaliação da ATM; inchaço, febre ou dificuldade para engolir ou respirar exigem atendimento médico prioritário.",
      },
      {
        q: "O que inclui uma consulta de ATM?",
        a: "Avaliamos o movimento da mandíbula, o disco articular e a musculatura mastigatória, além da relação com pescoço e postura. O cuidado usa terapia manual e exercícios suaves para recuperar mobilidade e reduzir tensão.",
      },
    ],
  },
  acupuntura: {
    es: [
      {
        q: "¿La acupuntura reemplaza la evaluación médica?",
        a: "No. Se integra al abordaje del dolor y el estrés en el consultorio, y puede combinarse con terapia manual. No sustituye el estudio médico cuando hay patologías que requieren especialista.",
      },
      {
        q: "¿Para qué se usa la acupuntura en Kinésica?",
        a: "Para modular dolor, bajar tensión, mejorar el descanso y acompañar la rehabilitación. La frecuencia y duración se adaptan a cada persona y a sus objetivos.",
      },
    ],
    en: [
      {
        q: "Does acupuncture replace a medical evaluation?",
        a: "No. It supports pain and stress care at the clinic and may combine with manual therapy. It does not replace medical work-up when a specialist assessment is needed.",
      },
      {
        q: "How is acupuncture used at Kinésica?",
        a: "To modulate pain, reduce tension, support rest, and accompany rehabilitation. Frequency and duration are tailored to each person and their goals.",
      },
    ],
    fr: [
      {
        q: "L'acupuncture remplace-t-elle un bilan médical ?",
        a: "Non. Elle s'intègre à la prise en charge de la douleur et du stress et peut se combiner à la thérapie manuelle. Elle ne remplace pas l'avis médical quand une pathologie doit être explorée.",
      },
      {
        q: "À quoi sert l'acupuncture chez Kinésica ?",
        a: "À moduler la douleur, réduire la tension, favoriser le repos et accompagner la rééducation. Fréquence et durée s'adaptent à chaque personne et à ses objectifs.",
      },
    ],
    pt: [
      {
        q: "A acupuntura substitui a avaliação médica?",
        a: "Não. Integra-se ao cuidado da dor e do estresse no consultório e pode combinar-se com terapia manual. Não substitui o estudo médico quando há patologias que exigem especialista.",
      },
      {
        q: "Para que serve a acupuntura na Kinésica?",
        a: "Para modular dor, reduzir tensão, melhorar o descanso e acompanhar a reabilitação. Frequência e duração se adaptam a cada pessoa e aos seus objetivos.",
      },
    ],
  },
  "posturologia-clinica": {
    es: [
      {
        q: "¿Qué evalúa la posturología clínica?",
        a: "Cómo se organiza el cuerpo en la gravedad: cabeza, columna, pelvis, apoyo plantar y equilibrio. Busca desequilibrios que sostienen dolor o compensaciones, no solo la postura “estática” en fotos.",
      },
      {
        q: "¿La posturología reemplaza a la RPG u otras técnicas?",
        a: "No. Orienta la evaluación y puede integrarse con RPG, terapia manual u otras herramientas según el hallazgo. El plan se define tras el examen individual.",
      },
    ],
    en: [
      {
        q: "What does clinical posturology assess?",
        a: "How the body organizes itself in gravity: head, spine, pelvis, plantar support, and balance. It looks for imbalances that sustain pain or compensations—not only a static “photo posture.”",
      },
      {
        q: "Does posturology replace RPG or other techniques?",
        a: "No. It guides assessment and can integrate with RPG, manual therapy, or other tools as findings indicate. The plan follows the individual exam.",
      },
    ],
    fr: [
      {
        q: "Que évalue la posturologie clinique ?",
        a: "Comment le corps s'organise dans la gravité : tête, colonne, bassin, appui plantaire et équilibre. Elle cherche les déséquilibres qui entretiennent douleur ou compensations, pas seulement une posture « photo ».",
      },
      {
        q: "La posturologie remplace-t-elle la RPG ou d'autres techniques ?",
        a: "Non. Elle oriente le bilan et peut s'intégrer à la RPG, à la thérapie manuelle ou à d'autres outils selon les findings. Le plan suit l'examen individuel.",
      },
    ],
    pt: [
      {
        q: "O que a posturologia clínica avalia?",
        a: "Como o corpo se organiza na gravidade: cabeça, coluna, pelve, apoio plantar e equilíbrio. Busca desequilíbrios que sustentam dor ou compensações — não só uma postura « de foto ».",
      },
      {
        q: "A posturologia substitui a RPG ou outras técnicas?",
        a: "Não. Orienta a avaliação e pode integrar-se à RPG, terapia manual ou outras ferramentas conforme o achado. O plano segue o exame individual.",
      },
    ],
  },
};
