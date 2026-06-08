/**
 * Kinésica — Conteúdo de patologias (pt-BR).
 * Mantém 5 parágrafos e 4–6 complicações por condição.
 */

export const PT_UI = {
  eyebrow: "Condições",
  complicationsTitle: "Complicações relacionadas",
  techniquesTitle: "Abordagem na Kinésica",
  techniquesLead:
    "De acordo com sua avaliação, combinamos técnicas de terapia manual para tratar a causa — não apenas o sintoma.",
  ctaTitle: "Fale conosco e agende",
  ctaText: "Antes da primeira sessão podemos ligar para tirar dúvidas.",
  ctaButton: "Contato",
  homeLabel: "Início",
  pathologiesBreadcrumb: "Condições",
  relatedTitle: "Condições relacionadas",
  relatedLead:
    "Outras condições frequentemente avaliadas junto com esta ou que compartilham abordagem semelhante.",
};

export const PT_TECHNIQUE_LABELS = {
  rpg: "Reeducação Postural Global (RPG)",
  osteopatia: "Osteopatia",
  neurodinamia: "Neurodinâmica",
  manipulaciones: "Manipulações manuais",
  cadenas: "Cadeias musculares",
  atm: "ATM (articulação temporomandibular)",
};

export const PT_PATHOLOGY_DATA = {
  cefalea: {
    title: "Cefaleia: dor de cabeça e tensão",
    breadcrumb: "Cefaleia",
    metaDescription:
      "Tratamento de cefaleia na Kinésica (Buenos Aires). Avaliamos pescoço, postura e ATM para reduzir dor, evitar recorrências e retomar sua rotina.",
    h1: "Cefaleia",
    lead:
      "A dor de cabeça pode ter origem cervical, muscular ou na mandíbula. Um cuidado integrado ajuda a diminuir intensidade e frequência.",
    paragraphs: [
      "A cefaleia é uma dor na cabeça que pode ser eventual ou recorrente. Costuma estar ligada a tensão muscular, sensibilidade dos tecidos ou sobrecarga na região cervical e alta das costas.",
      "Fatores comuns incluem estresse, bruxismo, postura mantida no computador, pouca mobilidade do pescoço e carga excessiva em trapézios e suboccipitais.",
      "Sem tratamento, a dor pode ficar mais frequente, atrapalhar sono e concentração e criar um ciclo de tensão que alimenta o desconforto. Pode vir acompanhada de rigidez cervical e incômodo mandibular.",
      "Combinamos terapia manual e reeducação postural. Integramos osteopatia, abordagem de ATM, manipulações suaves e RPG para liberar tensões e melhorar o controle do pescoço e da cintura escapular.",
      "A avaliação inclui hábitos, sono, estresse e padrão da dor, além de testes de mobilidade cervical e da mandíbula. Em cada sessão definimos objetivos claros, autocuidado e exercícios simples para sustentar o resultado.",
    ],
    complications: [
      "Rigidez cervical",
      "Dor e tensão na mandíbula",
      "Dor associada em ombros",
      "Sono fragmentado",
      "Aumento da frequência dos episódios",
    ],
    techniquesNote:
      "Selecionamos as técnicas conforme o tipo de cefaleia e sua avaliação.",
  },
  dorsalgia: {
    title: "Dorsalgia: dor na parte alta das costas",
    breadcrumb: "Dorsalgia",
    metaDescription:
      "Tratamento de dorsalgia na Kinésica (Buenos Aires). Terapia manual e postura para aliviar dor dorsal, recuperar mobilidade torácica e respirar melhor.",
    h1: "Dorsalgia",
    lead:
      "Dorsalgia é a dor na região média/alta das costas, geralmente ligada a postura mantida, rigidez torácica e sobrecarga muscular.",
    paragraphs: [
      "A dorsalgia surge entre as escápulas e a coluna torácica, podendo ser pontada, tensão ou desconforto constante ao sentar ou respirar fundo.",
      "As causas frequentes são postura prolongada no trabalho, pouca mobilidade torácica, encurtamento de peitorais e compensações vindas do pescoço ou lombar.",
      "Quando persiste, limita movimentos, pode irradiar para pescoço ou ombros e aumenta a fadiga ao fim do dia. A rigidez torácica também altera a mecânica respiratória.",
      "Combinamos terapia manual e trabalho postural para liberar a região torácica. Usamos osteopatia e manipulações específicas quando indicadas, além de RPG e cadeias musculares para reorganizar a postura.",
      "A avaliação observa postura, mobilidade torácica e controle escapular. As sessões unem mobilidade, fortalecimento progressivo e orientações ergonômicas para manter o alívio fora do consultório.",
    ],
    complications: [
      "Rigidez torácica",
      "Dor associada no pescoço",
      "Desconforto em ombros e escápulas",
      "Fadiga postural ao final do dia",
      "Respiração superficial por tensão",
    ],
    techniquesNote:
      "Escolhemos as técnicas conforme mobilidade e origem da sobrecarga.",
  },
  lumbalgia: {
    title: "Lombalgia: dor na lombar",
    breadcrumb: "Lombalgia",
    metaDescription:
      "Tratamento de lombalgia na Kinésica (Buenos Aires). Abordagem manual e exercícios para reduzir dor lombar, recuperar mobilidade e prevenir novos episódios.",
    h1: "Lombalgia",
    lead:
      "A lombalgia é a dor na parte baixa das costas. Pode vir de sobrecarga, rigidez, disco ou postura prolongada.",
    paragraphs: [
      "A lombalgia aparece como dor localizada ou irradiada para quadril e glúteos. Pode ser aguda após um esforço ou crônica por postura e falta de mobilidade.",
      "Fatores comuns incluem fraqueza de core, rigidez de quadris, sedentarismo, trabalhos com peso ou longas horas sentado.",
      "Sem cuidado, episódios se repetem, limitam o movimento e reduzem confiança para atividades diárias e treino. A dor pode gerar bloqueios e medo de se mover.",
      "Avaliamos postura, mobilidade lombo-pélvica e controle de core. Integramos terapia manual, osteopatia e manipulações suaves quando indicadas, além de exercícios graduais para estabilidade e mobilidade.",
      "O plano inclui educação sobre posições seguras, progressão de carga e exercícios para manter a lombar protegida. Buscamos retorno seguro às tarefas e treino sem dor.",
    ],
    complications: [
      "Recorrência de crises",
      "Rigidez de quadril e cadeia posterior",
      "Dor referida para glúteo ou coxa",
      "Medo de movimento e perda de função",
    ],
    techniquesNote:
      "Definimos técnicas e exercícios conforme sua avaliação e tolerância.",
  },
  ciatalgia: {
    title: "Ciatalgia: dor irradiada no trajeto do ciático",
    breadcrumb: "Ciatalgia",
    metaDescription:
      "Tratamento de ciatalgia na Kinésica (Buenos Aires). Avaliamos lombar, quadril e nervo ciático para reduzir dor irradiada e recuperar mobilidade.",
    h1: "Ciatalgia",
    lead:
      "A ciatalgia é a dor que desce pela perna no trajeto do nervo ciático, associada a irritação neural ou compressão.",
    paragraphs: [
      "A dor pode ser em queimação, choque ou peso que percorre glúteo, posterior de coxa e às vezes até o pé. Pode piorar ao sentar ou com certos movimentos.",
      "Causas comuns incluem hérnia ou protrusão discal, rigidez lombar, tensão do piriforme e longos períodos sentado. Também pode seguir episódios de lombalgia.",
      "Sem tratamento, a dor irradiada pode limitar caminhar, dirigir e dormir, além de gerar perda de força ou formigamento persistente.",
      "Avaliamos mobilidade lombar, quadril e sensibilidade neural. Utilizamos neurodinâmica, técnicas manuais e osteopatia para reduzir compressão e melhorar o deslizamento do nervo.",
      "Complementamos com exercícios graduais, educação postural e estratégias para sentar e levantar sem agravar o quadro, retomando atividades com segurança.",
    ],
    complications: [
      "Formigamento ou adormecimento persistente",
      "Perda de força em membros inferiores",
      "Limitação para sentar ou dirigir",
      "Crises recorrentes de dor irradiada",
    ],
    techniquesNote:
      "A combinação de neurodinâmica e terapia manual é ajustada à sua tolerância.",
  },
  cervicobraquialgia: {
    title: "Cervicobraquialgia: dor que vai do pescoço ao braço",
    breadcrumb: "Cervicobraquialgia",
    metaDescription:
      "Cervicobraquialgia na Kinésica (Buenos Aires). Tratamos dor cervical com irradiação para ombro e braço, liberando nervos e melhorando postura.",
    h1: "Cervicobraquialgia",
    lead:
      "É a dor cervical que irradia para ombro ou braço, ligada a compressão neural, postura ou tensão cervical.",
    paragraphs: [
      "A cervicobraquialgia combina dor no pescoço com irradiação para ombro, braço ou mão, podendo vir com formigamento ou perda de força.",
      "Geralmente se relaciona a posturas prolongadas, sobrecarga muscular, discopatia cervical ou fechamento das saídas nervosas.",
      "Sem cuidado, limita rotação do pescoço, uso do braço e pode interromper o sono. A tensão se agrava com estresse e trabalho no computador.",
      "No consultório, avaliamos postura, mobilidade cervical e deslizamento neural. Utilizamos terapia manual, manipulações suaves quando indicadas, neurodinâmica e RPG para abrir espaço e reduzir compressão.",
      "Guiamos ajustes ergonômicos, pausas ativas e exercícios leves para manter mobilidade e estabilidade cervical, retomando atividades sem dor irradiada.",
    ],
    complications: [
      "Formigamento em braço ou mão",
      "Perda de força em membros superiores",
      "Limitação de rotação cervical",
      "Sono interrompido por dor",
    ],
    techniquesNote:
      "Escolhemos técnicas que aliviam compressão neural e facilitam a postura.",
  },
  pubalgia: {
    title: "Pubalgia: dor na região inguinal e púbis",
    breadcrumb: "Pubalgia",
    metaDescription:
      "Tratamento de pubalgia na Kinésica (Buenos Aires). Abordagem manual e controle de carga para atletas e ativos, reduzindo dor no púbis e virilha.",
    h1: "Pubalgia",
    lead:
      "A pubalgia causa dor no púbis e virilha, comum em esportes com chutes, mudanças bruscas e sobrecarga de adutores e abdômen.",
    paragraphs: [
      "A dor aparece na região púbica, pode irradiar para adutores ou abdômen inferior e piora em giros, sprints ou chutar.",
      "Costuma envolver desequilíbrio entre adutores e core, sobrecarga em treinos, falta de mobilidade de quadril e retornos apressados após lesão.",
      "Sem manejo adequado, treinos e jogos ficam dolorosos, a explosão diminui e podem surgir compensações lombares ou no joelho.",
      "Avaliamos mobilidade de quadril, controle lombo-pélvico e carga de treino. Usamos terapia manual para liberar tecidos, osteopatia e manipulações suaves quando indicadas.",
      "Construímos um plano progressivo de força para adutores e core, ajustes de volume de treino e retorno gradual ao esporte sem dor.",
    ],
    complications: [
      "Recidiva ao retomar esporte",
      "Compensações lombares",
      "Dor em adutores persistente",
      "Redução de performance e potência",
    ],
    techniquesNote:
      "Integramos terapia manual e progressão de carga conforme sua modalidade.",
  },
  gonalgia: {
    title: "Gonalgia: dor no joelho",
    breadcrumb: "Gonalgia",
    metaDescription:
      "Tratamento de dor no joelho (gonalgia) na Kinésica, Buenos Aires. Avaliamos alinhamento, mobilidade e carga para aliviar dor e voltar a treinar.",
    h1: "Gonalgia",
    lead:
      "Gonalgia é dor no joelho de origem mecânica, postural ou por sobrecarga esportiva. Requer avaliar alinhamento, força e controle.",
    paragraphs: [
      "A dor pode estar na patela, medial ou lateral, surgindo em agachamentos, escadas ou corrida. Muitas vezes há rigidez de quadril ou tornozelo associada.",
      "Causas comuns: sobrecarga de treino, desequilíbrio muscular, alinhamento dinâmico alterado, menisco irritado ou tendões sensibilizados.",
      "Sem tratamento, limita corrida, treino de força e atividades diárias, podendo gerar compensações em quadril ou tornozelo.",
      "Combinamos avaliação de marcha, mobilidade de quadril/tornozelo e controle de joelho. Usamos terapia manual, cadeias musculares e manipulações específicas quando indicadas.",
      "O plano inclui fortalecimento progressivo, ajuste de volume de corrida/treino e educação sobre dor para voltar a se mover com confiança.",
    ],
    complications: [
      "Dor ao subir e descer escadas",
      "Sensibilidade patelar persistente",
      "Perda de confiança para agachar ou correr",
      "Compensações em quadril ou tornozelo",
    ],
    techniquesNote:
      "Dosamos carga e técnicas conforme seu esporte e nível de dor.",
  },
  talalgia: {
    title: "Talalgia: dor no calcanhar",
    breadcrumb: "Talalgia",
    metaDescription:
      "Tratamento de talalgia na Kinésica (Buenos Aires). Avaliamos fáscia plantar, tendão de Aquiles e mecânica do pé para reduzir dor no calcanhar.",
    h1: "Talalgia",
    lead:
      "Talalgia é a dor no calcanhar, ligada a fáscia plantar, tendão de Aquiles ou impacto repetitivo.",
    paragraphs: [
      "A dor se localiza no calcanhar, pode ser mais intensa ao acordar ou após longos períodos em pé. Pode relacionar-se à fáscia plantar ou à inserção do Aquiles.",
      "Fatores comuns: aumento brusco de carga, calçados inadequados, encurtamento de cadeia posterior e fraqueza intrínseca do pé.",
      "Sem cuidado, a dor limita caminhadas, corrida e permanência em pé, podendo gerar compensações no tornozelo ou joelho.",
      "Avaliamos mobilidade de tornozelo, apoio plantar e carga recente. Utilizamos terapia manual, liberação de tecidos e exercícios específicos para fáscia e tendão.",
      "Incluímos orientações de calçado, progressão de carga e fortalecimento do pé e panturrilha, reduzindo recidivas.",
    ],
    complications: [
      "Dor matinal ao pisar",
      "Irritação do tendão de Aquiles",
      "Alterações de marcha",
      "Limitação para correr ou ficar em pé",
    ],
    techniquesNote:
      "Adaptamos técnicas e exercícios conforme tolerância e fase da dor.",
  },
  "dolor-sacriiliaco": {
    title: "Dor sacroilíaca: desconforto na base da coluna",
    breadcrumb: "Dor sacroilíaca",
    metaDescription:
      "Tratamento de dor sacroilíaca na Kinésica (Buenos Aires). Estabilizamos pelve e lombar com terapia manual e exercícios específicos.",
    h1: "Dor sacroilíaca",
    lead:
      "A dor sacroilíaca surge na base da coluna, próxima ao quadril, por instabilidade ou sobrecarga da articulação sacroilíaca.",
    paragraphs: [
      "O desconforto pode ser em pontada ou peso ao levantar, ficar em pé muito tempo ou ao virar na cama.",
      "Geralmente envolve desequilíbrio entre estabilidade lombo-pélvica, mobilidade de quadril e tensão muscular ao redor da pelve.",
      "Sem cuidado, pode limitar caminhada, corrida leve e posições de trabalho, gerando medo de certos movimentos.",
      "Avaliamos alinhamento, mobilidade e controle do core e glúteos. Aplicamos terapia manual para equilibrar a articulação e exercícios para estabilidade.",
      "Orientamos estratégias para se movimentar e levantar cargas sem agravar a região, garantindo retorno seguro às atividades.",
    ],
    complications: [
      "Sensação de instabilidade pélvica",
      "Dor ao ficar em pé por longos períodos",
      "Dificuldade para virar na cama",
      "Recorrência ao levantar peso",
    ],
    techniquesNote:
      "Estabilização e terapia manual são dosadas conforme sua resposta clínica.",
  },
  "hernia-disco": {
    title: "Hérnia de disco lombar ou cervical",
    breadcrumb: "Hérnia de disco",
    metaDescription:
      "Hérnia de disco na Kinésica (Buenos Aires). Avaliamos coluna e nervos para aliviar dor, reduzir irradiação e retomar movimento com segurança.",
    h1: "Hérnia de disco",
    lead:
      "A hérnia de disco ocorre quando o núcleo discal protrui e pode irritar nervos, gerando dor local ou irradiada.",
    paragraphs: [
      "A dor pode ser lombar ou cervical, com possíveis irradiações para pernas ou braços, acompanhada de formigamento ou perda de força.",
      "Fatores incluem movimentos repetitivos, sobrecarga, postura prolongada, histórico de crises lombares/cervicais e predisposição individual.",
      "Sem manejo, a dor limita atividades básicas, sono e trabalho, e pode aumentar episódios de irradiação.",
      "Avaliamos mobilidade, sinais neurais e tolerância a carga. Usamos terapia manual, neurodinâmica e orientações específicas para posições de alívio.",
      "Implementamos progressão de exercícios para estabilizar a coluna, melhorar controle de core e fortalecer membros, permitindo retorno seguro a atividades.",
    ],
    complications: [
      "Dor irradiada persistente",
      "Formigamento ou perda de força",
      "Limitação funcional e medo de se mover",
      "Recorrência de crises dolorosas",
    ],
    techniquesNote:
      "A combinação de técnicas e exercícios respeita a irritabilidade neural e sua fase clínica.",
  },
  "protrusion-discal": {
    title: "Protrusão discal: prevenção de agravamento",
    breadcrumb: "Protrusão discal",
    metaDescription:
      "Protrusão discal na Kinésica (Buenos Aires). Cuidamos da coluna para aliviar dor, proteger o disco e manter sua rotina ativa.",
    h1: "Protrusão discal",
    lead:
      "A protrusão discal é um abaulamento do disco que pode sensibilizar a coluna e gerar dor local ou leve irradiação.",
    paragraphs: [
      "A dor costuma ser lombar ou cervical, às vezes com desconforto que desce para glúteos ou ombros, variando conforme a posição.",
      "Pode surgir após esforços, postura prolongada ou episódios anteriores de dor na coluna. A sensibilidade aumenta com cargas mal dosadas.",
      "Sem cuidado, pode progredir para crises mais intensas ou sintomas neurais, reduzindo mobilidade e confiança para treinar.",
      "Com abordagem conservadora, avaliamos postura, mobilidade e sinais de irritação. Aplicamos terapia manual suave, orientações de alívio e exercícios de estabilidade.",
      "Trabalhamos progressão de carga segura, fortalecimento de core e hábitos de proteção da coluna para evitar recidivas.",
    ],
    complications: [
      "Episódios recorrentes de dor",
      "Rigidez e limitação de mobilidade",
      "Possível evolução para dor irradiada",
      "Redução de tolerância a esforço",
    ],
    techniquesNote:
      "Focamos em estabilidade e alívio gradual sem provocar os sintomas.",
  },
  hipercifosis: {
    title: "Hipercifose torácica",
    breadcrumb: "Hipercifose",
    metaDescription:
      "Tratamento de hipercifose na Kinésica (Buenos Aires). Melhoramos mobilidade torácica e postura com terapia manual e reeducação postural.",
    h1: "Hipercifose",
    lead:
      "A hipercifose é o aumento da curvatura torácica, que pode trazer dor, rigidez e impacto postural.",
    paragraphs: [
      "A curvatura acentuada pode gerar dor na região dorsal, pescoço ou ombros, e sensação de peito fechado.",
      "Fatores incluem genética, postura sustentada, desequilíbrio muscular entre peitorais e extensores de coluna e falta de mobilidade torácica.",
      "Sem intervenção, pode limitar expansão respiratória, aumentar tensão cervical e afetar a estética e confiança postural.",
      "Combinamos terapia manual, trabalho de cadeias musculares e RPG para reorganizar a postura e melhorar a mobilidade torácica.",
      "Incluímos exercícios ativos, fortalecimento de extensores e orientações para manter a correção no dia a dia sem rigidez.",
    ],
    complications: [
      "Rigidez torácica persistente",
      "Tensão cervical e de ombros",
      "Diminuição da expansão respiratória",
      "Fadiga postural",
    ],
    techniquesNote:
      "Reeducação postural e mobilidade são ajustadas ao seu padrão de curvatura.",
  },
  hiperlordosis: {
    title: "Hiperlordose: aumento da curvatura lombar",
    breadcrumb: "Hiperlordose",
    metaDescription:
      "Cuidado para hiperlordose na Kinésica (Buenos Aires). Avaliamos pelve, core e postura para aliviar dor lombar e equilibrar curvaturas.",
    h1: "Hiperlordose",
    lead:
      "A hiperlordose é um aumento da curvatura lombar que pode gerar dor, sobrecarga facetária e fadiga.",
    paragraphs: [
      "O excesso de curvatura pode causar dor lombar, sensação de peso e dificuldade em manter postura neutra.",
      "Contribuem encurtamentos de flexores de quadril, fraqueza de core e glúteos e padrões posturais sustentados.",
      "Sem correção, a sobrecarga pode aumentar em atividades de impacto, levantar peso ou ficar em pé por longos períodos.",
      "Avaliamos alinhamento pélvico, mobilidade e controle de core. Usamos terapia manual para liberar tecidos e RPG para reorganizar a postura.",
      "Orientamos exercícios de alongamento seletivo, fortalecimento e consciência postural para manter a lombar protegida no dia a dia.",
    ],
    complications: [
      "Dor lombar recorrente",
      "Sobrecarga facetária",
      "Fadiga em pé ou ao treinar",
      "Dificuldade de manter postura neutra",
    ],
    techniquesNote:
      "Combinamos liberação, estabilização e educação postural conforme sua avaliação.",
  },
  "dorso-plano": {
    title: "Dorso plano: perda de curvatura torácica",
    breadcrumb: "Dorso plano",
    metaDescription:
      "Dorso plano na Kinésica (Buenos Aires). Melhoramos mobilidade torácica e equilíbrio postural para reduzir desconforto e rigidez.",
    h1: "Dorso plano",
    lead:
      "O dorso plano é a redução da curvatura torácica, que pode gerar rigidez, dor e dificuldade de absorver impactos.",
    paragraphs: [
      "A coluna fica mais reta na região torácica, o que pode causar desconforto entre escápulas e maior tensão cervical.",
      "Pode estar relacionado a rigidez torácica, padrões posturais ou adaptações após cirurgias e imobilizações.",
      "Sem intervenção, pode reduzir a capacidade de dissipar cargas, favorecer dor cervical e limitar rotação de tronco.",
      "Trabalhamos mobilidade torácica, cadeias musculares e RPG para restaurar a curva fisiológica e distribuir melhor as cargas.",
      "Incluímos exercícios ativos, respiração dirigida e fortalecimento para manter a nova mobilidade no cotidiano.",
    ],
    complications: [
      "Rigidez torácica",
      "Tensão cervical aumentada",
      "Menor tolerância a impacto",
      "Limitação de rotação de tronco",
    ],
    techniquesNote:
      "Reeducação postural e mobilidade são adaptadas ao seu padrão estrutural.",
  },
  "genu-valgo": {
    title: "Genu valgo: desalinhamento em X",
    breadcrumb: "Genu valgo",
    metaDescription:
      "Genu valgo na Kinésica (Buenos Aires). Avaliamos alinhamento, força e controle para proteger joelhos e tornozelos e reduzir dor.",
    h1: "Genu valgo",
    lead:
      "O genu valgo é o alinhamento em X dos joelhos, que pode sobrecarregar cartilagens, meniscos e patela.",
    paragraphs: [
      "O desalinhamento pode gerar dor na face medial do joelho ou na patela, especialmente em agachamentos, corrida e saltos.",
      "Causas incluem fraqueza de quadril, controle motor insuficiente, alterações estruturais e estratégias de movimento aprendidas.",
      "Sem correção, aumenta a sobrecarga em menisco medial, retináculo patelar e tornozelos, favorecendo dor e lesões.",
      "Avaliamos alinhamento dinâmico, mobilidade de quadril/tornozelo e padrão de marcha. Usamos cadeias musculares e exercícios de controle para corrigir o vetor de força.",
      "O plano inclui fortalecimento de glúteos, treinamento de aterrissagem e ajustes de técnica para esporte ou academia.",
    ],
    complications: [
      "Sobrecarga patelofemoral",
      "Irritação de menisco medial",
      "Dor em corrida ou salto",
      "Risco aumentado de entorses de tornozelo",
    ],
    techniquesNote:
      "O trabalho de alinhamento é ajustado ao seu esporte e anatomia.",
  },
  "genu-varo": {
    title: "Genu varo: desalinhamento em arco",
    breadcrumb: "Genu varo",
    metaDescription:
      "Genu varo na Kinésica (Buenos Aires). Reforçamos controle e mobilidade para reduzir sobrecarga lateral e proteger meniscos e ligamentos.",
    h1: "Genu varo",
    lead:
      "O genu varo é o desalinhamento em arco dos joelhos, que aumenta carga lateral e pode gerar dor e instabilidade.",
    paragraphs: [
      "O desvio pode causar dor na face lateral do joelho ou compressão de menisco, especialmente em impacto ou longas caminhadas.",
      "Pode ter componente estrutural, falta de controle de quadril ou compensações de tornozelo e pé.",
      "Sem cuidado, favorece desgaste lateral, instabilidade e dor em atividades de impacto ou carga.",
      "Avaliamos alinhamento, mobilidade e controle muscular. Usamos terapia manual quando necessário e exercícios para melhorar distribuição de carga.",
      "Incluímos fortalecimento de quadril, ajustes de técnica e progressão de impacto para manter o joelho protegido.",
    ],
    complications: [
      "Dor lateral do joelho",
      "Sobrecarga de menisco externo",
      "Instabilidade em impacto",
      "Compensações em tornozelo e quadril",
    ],
    techniquesNote:
      "O plano foca em controle dinâmico e melhor distribuição de força.",
  },
  "pies-planos": {
    title: "Pé plano: colapso do arco plantar",
    breadcrumb: "Pé plano",
    metaDescription:
      "Pé plano na Kinésica (Buenos Aires). Fortalecemos pé e cadeia inferior para melhorar suporte, reduzir dor e prevenir sobrecarga.",
    h1: "Pé plano",
    lead:
      "O pé plano é a queda do arco medial, que altera a biomecânica do pé, joelho e quadril.",
    paragraphs: [
      "O arco reduzido pode causar dor em pé, tornozelo ou joelho, além de fadiga ao ficar em pé ou caminhar longas distâncias.",
      "Causas incluem frouxidão ligamentar, fraqueza intrínseca do pé, calçados inadequados e padrões posturais.",
      "Sem intervenção, pode levar a tendinites, dor patelofemoral e sobrecarga em cadeia medial.",
      "Avaliamos apoio plantar, mobilidade de tornozelo e controle de joelho/quadril. Usamos exercícios específicos para fortalecer musculatura intrínseca e estabilizar o arco.",
      "Orientamos calçados, palmilhas quando indicadas e progressão de carga para caminhar e correr sem dor.",
    ],
    complications: [
      "Tendinopatia tibial posterior",
      "Dor patelofemoral",
      "Fadiga ao ficar em pé",
      "Sobrecarga em cadeia medial",
    ],
    techniquesNote:
      "Fortalecimento e ajustes de apoio são personalizados conforme sua pisada.",
  },
  escoliosis: {
    title: "Escoliose: cuidado funcional",
    breadcrumb: "Escoliose",
    metaDescription:
      "Tratamento funcional de escoliose na Kinésica (Buenos Aires). Melhoramos mobilidade, controle e dor para manter sua rotina ativa.",
    h1: "Escoliose",
    lead:
      "A escoliose é uma curvatura lateral da coluna que pode gerar desequilíbrios, dor e fadiga postural.",
    paragraphs: [
      "A curvatura pode causar dor em pontos específicos, sensação de assimetria e fadiga ao fim do dia.",
      "Pode ter origem idiopática, neuromuscular ou compensatória. Fatores como postura e fraqueza podem acentuar sintomas.",
      "Sem cuidado, pode aumentar desconforto, rigidez e limitar algumas atividades, embora muitos casos sejam manejados de forma funcional.",
      "Avaliamos mobilidade, controle muscular e padrão respiratório. Usamos terapia manual, cadeias musculares e RPG para equilibrar tensões.",
      "Incluímos exercícios de força e consciência corporal para estabilizar a coluna e manter atividades com menos dor.",
    ],
    complications: [
      "Dor e rigidez localizadas",
      "Fadiga postural",
      "Limitação de algumas amplitudes",
      "Possível progressão de desconforto sem manejo",
    ],
    techniquesNote:
      "O plano foca em equilíbrio postural e força funcional conforme sua curva.",
  },
  "epicondilitis-lateral": {
    title: "Epicondilite lateral (cotovelo do tenista)",
    breadcrumb: "Epicondilite lateral",
    metaDescription:
      "Epicondilite lateral na Kinésica (Buenos Aires). Tratamos dor no cotovelo com terapia manual e progressão de carga para voltar a usar a mão sem dor.",
    h1: "Epicondilite lateral",
    lead:
      "Inflamação ou sensibilização dos extensores do punho, causando dor na face lateral do cotovelo ao pegar peso ou digitar.",
    paragraphs: [
      "A dor surge no epicôndilo lateral e pode irradiar pelo antebraço, piorando em preensão, digitação ou levantar objetos.",
      "Causas incluem sobrecarga repetitiva, técnica inadequada em esporte ou trabalho e falta de recuperação de microlesões.",
      "Sem cuidado, tarefas simples como abrir portas, carregar sacolas ou trabalhar no computador ficam dolorosas.",
      "Combinamos terapia manual, técnicas de liberação, neurodinâmica quando indicada e progressão de carga específica para extensores.",
      "Incluímos educação sobre pausas, ergonomia e exercícios excêntricos para fortalecer sem piorar a dor.",
    ],
    complications: [
      "Dor ao pegar objetos",
      "Fraqueza de preensão",
      "Limitação para esportes de raquete",
      "Recidiva em tarefas repetitivas",
    ],
    techniquesNote:
      "A carga é aumentada gradualmente conforme sua tolerância e objetivos.",
  },
  "epicondilitis-medial": {
    title: "Epicondilite medial (cotovelo do golfista)",
    breadcrumb: "Epicondilite medial",
    metaDescription:
      "Epicondilite medial na Kinésica (Buenos Aires). Reduzimos dor na face medial do cotovelo com terapia manual e exercícios específicos.",
    h1: "Epicondilite medial",
    lead:
      "Sensibilização dos flexores e pronadores do antebraço, gerando dor no lado interno do cotovelo ao agarrar ou girar.",
    paragraphs: [
      "A dor fica no epicôndilo medial, piorando em movimentos de preensão, rotação de punho ou ao levantar peso.",
      "Fatores incluem sobrecarga em esportes com pegada, movimentos repetitivos no trabalho e falta de força ou recuperação adequada.",
      "Sem cuidado, limita tarefas diárias, esportes de arremesso e atividades profissionais que exigem pegada firme.",
      "Aplicamos terapia manual, mobilizações e exercícios graduais para flexores/pronadores, com neurodinâmica quando necessária.",
      "Também ajustamos ergonomia, pausas e progressão de carga para evitar recidivas e recuperar a função sem dor.",
    ],
    complications: [
      "Dor ao segurar objetos",
      "Fraqueza de preensão",
      "Limitação para arremessos ou ferramentas",
      "Recorrência em movimentos repetitivos",
    ],
    techniquesNote:
      "Dosamos exercícios e liberação de acordo com seu trabalho e esporte.",
  },
  "impingement-subacromial": {
    title: "Impingement subacromial",
    breadcrumb: "Impingement subacromial",
    metaDescription:
      "Impingement subacromial na Kinésica (Buenos Aires). Tratamos ombro doloroso ao elevar o braço com terapia manual e controle escapular.",
    h1: "Impingement subacromial",
    lead:
      "É a dor no ombro ao elevar o braço, causada por conflito de tendões e bursa sob o acrômio.",
    paragraphs: [
      "A dor aparece ao levantar o braço, vestir-se ou alcançar objetos altos, e pode vir com sensação de atrito.",
      "Contribuem sobrecarga, controle escapular inadequado, rigidez de cápsula e tendões sensibilizados.",
      "Sem manejo, limita esportes de arremesso, natação ou tarefas acima da cabeça, e pode evoluir para tendinopatia persistente.",
      "Avaliamos mobilidade de ombro e escápula. Utilizamos terapia manual, exercícios de controle escapular e fortalecimento progressivo do manguito.",
      "Orientamos ajustes de treino e gestos repetitivos para reduzir irritação e recuperar amplitude sem dor.",
    ],
    complications: [
      "Dor ao elevar o braço",
      "Fraqueza do manguito rotador",
      "Limitação para esportes com braço elevado",
      "Tendinopatia subacromial crônica",
    ],
    techniquesNote:
      "Trabalhamos mobilidade e controle escapular antes de progredir carga.",
  },
  "manguito-rotador": {
    title: "Lesão do manguito rotador",
    breadcrumb: "Manguito rotador",
    metaDescription:
      "Reabilitação do manguito rotador na Kinésica (Buenos Aires). Recuperamos força e mobilidade do ombro com progressão segura.",
    h1: "Manguito rotador",
    lead:
      "Lesões do manguito afetam a estabilidade do ombro, gerando dor e perda de força em elevação e rotação.",
    paragraphs: [
      "A dor pode surgir ao levantar o braço, alcançar objetos ou dormir sobre o ombro afetado.",
      "Causas incluem sobrecarga repetitiva, traumas, degeneração tendínea e desequilíbrios de controle escapular.",
      "Sem cuidado, a perda de força e amplitude limita tarefas diárias e esportes, podendo evoluir para maior degeneração.",
      "Avaliamos mobilidade, força e controle. Aplicamos terapia manual para dor e rigidez, e um plano de fortalecimento progressivo do manguito e escápula.",
      "Ajustamos gestos esportivos ou laborais, garantindo retorno gradual e seguro sem reagudizações.",
    ],
    complications: [
      "Dor ao elevar ou rodar o braço",
      "Perda de força para atividades diárias",
      "Compensações cervicais e escapulares",
      "Risco de progressão da tendinopatia",
    ],
    techniquesNote:
      "O fortalecimento é progressivo e guiado pelos sintomas.",
  },
  radiculopatia: {
    title: "Radiculopatia: compressão nervosa",
    breadcrumb: "Radiculopatia",
    metaDescription:
      "Radiculopatia na Kinésica (Buenos Aires). Liberamos raízes nervosas com neurodinâmica e estabilização para reduzir dor e formigamento.",
    h1: "Radiculopatia",
    lead:
      "Radiculopatia é a irritação de uma raiz nervosa que pode causar dor, formigamento ou perda de força em braço ou perna.",
    paragraphs: [
      "O quadro pode surgir na coluna cervical ou lombar, com irradiação para membro correspondente.",
      "Causas incluem hérnia, protrusão, estenose foraminal ou inflamação local. Postura e carga influenciam a intensidade.",
      "Sem tratamento, pode haver piora do déficit sensitivo ou motor e limitação significativa das atividades.",
      "Avaliamos sinais neurológicos, mobilidade e fatores de compressão. Usamos neurodinâmica, terapia manual e orientações de alívio.",
      "Incluímos exercícios de estabilização e progressão cuidadosa de carga para recuperar função sem agravar o nervo.",
    ],
    complications: [
      "Formigamento ou dormência persistente",
      "Perda de força segmentar",
      "Limitação para trabalho e autocuidado",
      "Crises recorrentes com irradiação",
    ],
    techniquesNote:
      "Respeitamos a irritabilidade neural ao escolher mobilizações e exercícios.",
  },
  meniscopatia: {
    title: "Meniscopatia: irritação ou lesão de menisco",
    breadcrumb: "Meniscopatia",
    metaDescription:
      "Reabilitação de menisco na Kinésica (Buenos Aires). Controlamos dor, restauramos mobilidade e força para voltar a caminhar e treinar.",
    h1: "Meniscopatia",
    lead:
      "Meniscopatia é a irritação ou lesão do menisco do joelho, causando dor, bloqueio ou estalidos.",
    paragraphs: [
      "A dor pode ser medial ou lateral, com sensação de travar ou estalar ao agachar ou torcer.",
      "Causas: torção súbita, degeneração progressiva, sobrecarga e desalinhamentos que comprimem o menisco.",
      "Sem cuidado, limita agachar, correr e até caminhar, gerando perda de força e confiança.",
      "Avaliamos mobilidade, alinhamento e estabilidade do joelho. Usamos terapia manual, controle de carga e exercícios para estabilizar e fortalecer.",
      "Guiamos retorno gradual a impacto e esporte, monitorando sintomas para evitar nova irritação.",
    ],
    complications: [
      "Bloqueio ou travamento do joelho",
      "Dor em rotação ou agachamento",
      "Perda de força e confiança",
      "Inchaço recorrente pós-atividade",
    ],
    techniquesNote:
      "A progressão é alinhada aos sintomas e ao tipo de lesão meniscal.",
  },
  "fascitis-plantar": {
    title: "Fascite plantar",
    breadcrumb: "Fascite plantar",
    metaDescription:
      "Fascite plantar na Kinésica (Buenos Aires). Reduzimos dor na sola do pé com terapia manual e fortalecimento específico.",
    h1: "Fascite plantar",
    lead:
      "A fascite plantar é a inflamação ou sensibilização da fáscia na sola do pé, comum em corrida e longos períodos em pé.",
    paragraphs: [
      "A dor aparece no calcanhar ou arco, piorando nas primeiras passadas do dia ou após ficar muito tempo em pé.",
      "Contribuem aumento brusco de treino, calçado inadequado, encurtamento da cadeia posterior e fraqueza intrínseca do pé.",
      "Sem tratamento, limita caminhada, corrida e pode gerar compensações em tornozelo e joelho.",
      "Combinamos terapia manual, liberação da fáscia, exercícios de fortalecimento do pé e panturrilha, e neurodinâmica quando indicada.",
      "Orientamos progressão de carga, alongamentos específicos e escolhas de calçado para manter o arco protegido.",
    ],
    complications: [
      "Dor intensa ao iniciar o dia",
      "Limitação para correr ou caminhar",
      "Compensações em tornozelo e joelho",
      "Recidiva com aumento de treino",
    ],
    techniquesNote:
      "Fortalecimento e liberação são adaptados à fase de dor e suas metas.",
  },
  cervicalgia: {
    title: "Cervicalgia: dor no pescoço",
    breadcrumb: "Cervicalgia",
    metaDescription:
      "Cervicalgia na Kinésica (Buenos Aires). Aliviamos dor cervical com terapia manual, mobilidade e orientação postural personalizada.",
    h1: "Cervicalgia",
    lead:
      "Cervicalgia é a dor no pescoço, associada a tensão, rigidez e posturas prolongadas.",
    paragraphs: [
      "A dor pode ser localizada ou irradiar para ombros, acompanhada de rigidez e dificuldade para virar a cabeça.",
      "Fatores incluem postura prolongada, estresse, falta de mobilidade torácica e sobrecarga de músculos cervicais.",
      "Sem tratamento, interfere no sono, trabalho e atividades simples como dirigir ou treinar.",
      "Combinamos terapia manual, mobilizações suaves e RPG para reduzir tensão e melhorar controle cervical.",
      "Orientamos pausas ativas, ajustes ergonômicos e exercícios leves para manter o resultado no dia a dia.",
    ],
    complications: [
      "Rigidez cervical persistente",
      "Cefaleias tensionais associadas",
      "Dificuldade para dormir",
      "Limitação para dirigir ou treinar",
    ],
    techniquesNote:
      "Selecionamos técnicas e exercícios conforme sua irritabilidade e rotina.",
  },
};
