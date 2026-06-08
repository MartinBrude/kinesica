/**
 * SEO copy for method/technique pages (ES / EN / FR / PT).
 * Run: node scripts/patch-methods-seo.mjs
 */
export const METHOD_STEMS = [
  "rpg",
  "osteopatia",
  "cadenas",
  "manipulaciones",
  "neurodinamia",
  "atm",
  "acupuntura",
  "posturologia-clinica",
];

export const METHOD_UI = {
  es: { homeLabel: "Inicio", homeHref: "index.html" },
  en: { homeLabel: "Home", homeHref: "/en/" },
  fr: { homeLabel: "Accueil", homeHref: "/fr/" },
  pt: { homeLabel: "Início", homeHref: "/pt/" },
};

/** @type {Record<string, Record<string, { metaTitle: string, metaDescription: string, breadcrumb: string }>>} */
export const METHODS = {
  rpg: {
    es: {
      metaTitle: "RPG - Reeducación Postural Global | Kinésica",
      metaDescription:
        "RPG en Kinésica (Buenos Aires). Reeducación postural y cadenas musculares en Palermo. Sesiones individuales para flexibilizar musculatura estática.",
      breadcrumb: "RPG",
    },
    en: {
      metaTitle: "RPG - Global Postural Reeducation | Kinésica",
      metaDescription:
        "RPG at Kinésica (Buenos Aires). Global postural reeducation and muscle chains in Palermo. Individual sessions to release static muscle tension.",
      breadcrumb: "RPG",
    },
    fr: {
      metaTitle: "RPG — Rééducation posturale globale | Kinésica",
      metaDescription:
        "RPG chez Kinésica (Buenos Aires). Rééducation posturale globale et chaînes musculaires à Palermo. Séances individuelles pour assouplir la musculature statique.",
      breadcrumb: "RPG",
    },
    pt: {
      metaTitle: "RPG — Reeducação Postural Global | Kinésica",
      metaDescription:
        "RPG na Kinésica (Buenos Aires). Reeducação postural global e cadeias musculares em Palermo. Sessões individuais para liberar a musculatura estática.",
      breadcrumb: "RPG",
    },
  },
  osteopatia: {
    es: {
      metaTitle: "Osteopatía Estructural y Visceral | Kinésica",
      metaDescription:
        "Osteopatía en Kinésica (Buenos Aires). Evaluación y tratamiento de disfunciones somáticas con técnicas manuales en Palermo.",
      breadcrumb: "Osteopatía",
    },
    en: {
      metaTitle: "Structural and Visceral Osteopathy | Kinésica",
      metaDescription:
        "Osteopathy at Kinésica (Buenos Aires). Assessment and treatment of somatic dysfunctions with manual techniques in Palermo.",
      breadcrumb: "Osteopathy",
    },
    fr: {
      metaTitle: "Ostéopathie structurelle et viscérale | Kinésica",
      metaDescription:
        "Ostéopathie chez Kinésica (Buenos Aires). Évaluation et traitement des dysfonctions somatiques par thérapie manuelle à Palermo.",
      breadcrumb: "Ostéopathie",
    },
    pt: {
      metaTitle: "Osteopatia estrutural e visceral | Kinésica",
      metaDescription:
        "Osteopatia na Kinésica (Buenos Aires). Avaliação e tratamento de disfunções somáticas com técnicas manuais em Palermo.",
      breadcrumb: "Osteopatia",
    },
  },
  cadenas: {
    es: {
      metaTitle: "Cadenas Fisiológicas | Kinésica",
      metaDescription:
        "Cadenas musculares en Kinésica (Buenos Aires). Método Busquet que relaciona estructura corporal y contenido visceral. Terapia manual en Palermo.",
      breadcrumb: "Cadenas Fisiológicas",
    },
    en: {
      metaTitle: "Physiological Chains | Kinésica",
      metaDescription:
        "Muscle chains therapy at Kinésica (Buenos Aires). Busquet method linking body structure and visceral function. Manual therapy in Palermo.",
      breadcrumb: "Physiological Chains",
    },
    fr: {
      metaTitle: "Chaînes physiologiques | Kinésica",
      metaDescription:
        "Chaînes musculaires chez Kinésica (Buenos Aires). Méthode Busquet reliant structure corporelle et fonctions viscérales. Thérapie manuelle à Palermo.",
      breadcrumb: "Chaînes physiologiques",
    },
    pt: {
      metaTitle: "Cadeias fisiológicas | Kinésica",
      metaDescription:
        "Cadeias musculares na Kinésica (Buenos Aires). Método Busquet que relaciona estrutura corporal e funções viscerais. Terapia manual em Palermo.",
      breadcrumb: "Cadeias fisiológicas",
    },
  },
  manipulaciones: {
    es: {
      metaTitle: "Manipulaciones Viscerales | Kinésica",
      metaDescription:
        "Manipulaciones viscerales en Kinésica (Buenos Aires). Tratamiento de tensiones viscerales que afectan el aparato locomotor. Terapia manual en Palermo.",
      breadcrumb: "Manipulaciones viscerales",
    },
    en: {
      metaTitle: "Visceral Manipulations | Kinésica",
      metaDescription:
        "Visceral manipulation at Kinésica (Buenos Aires). Treatment of visceral tensions affecting the locomotor system. Manual therapy in Palermo.",
      breadcrumb: "Visceral Manipulations",
    },
    fr: {
      metaTitle: "Manipulations viscérales | Kinésica",
      metaDescription:
        "Manipulations viscérales chez Kinésica (Buenos Aires). Traitement des tensions viscérales affectant l'appareil locomoteur. Thérapie manuelle à Palermo.",
      breadcrumb: "Manipulations viscérales",
    },
    pt: {
      metaTitle: "Manipulações viscerais | Kinésica",
      metaDescription:
        "Manipulações viscerais na Kinésica (Buenos Aires). Tratamento de tensões viscerais que afetam o sistema locomotor. Terapia manual em Palermo.",
      breadcrumb: "Manipulações viscerais",
    },
  },
  neurodinamia: {
    es: {
      metaTitle: "Neurodinamia | Kinésica",
      metaDescription:
        "Neurodinamia en Kinésica (Buenos Aires). Movilización neural y tratamiento de trastornos del sistema nervioso en Palermo.",
      breadcrumb: "Neurodinamia",
    },
    en: {
      metaTitle: "Neurodynamics | Kinésica",
      metaDescription:
        "Neurodynamics at Kinésica (Buenos Aires). Neural mobilization and treatment of nerve-related conditions in Palermo.",
      breadcrumb: "Neurodynamics",
    },
    fr: {
      metaTitle: "Neurodynamique | Kinésica",
      metaDescription:
        "Neurodynamique chez Kinésica (Buenos Aires). Mobilisation neurale et traitement des troubles nerveux à Palermo.",
      breadcrumb: "Neurodynamique",
    },
    pt: {
      metaTitle: "Neurodinâmica | Kinésica",
      metaDescription:
        "Neurodinâmica na Kinésica (Buenos Aires). Mobilização neural e tratamento de distúrbios do sistema nervoso em Palermo.",
      breadcrumb: "Neurodinâmica",
    },
  },
  atm: {
    es: {
      metaTitle: "ATM – Articulación Temporomandibular | Kinésica",
      metaDescription:
        "Tratamiento de ATM en Kinésica (Buenos Aires). Mandíbula, dolor, chasquidos y bruxismo con terapia manual en Palermo.",
      breadcrumb: "ATM",
    },
    en: {
      metaTitle: "TMJ – Temporomandibular Joint | Kinésica",
      metaDescription:
        "TMJ treatment at Kinésica (Buenos Aires). Jaw pain, clicking and bruxism with manual therapy in Palermo.",
      breadcrumb: "TMJ",
    },
    fr: {
      metaTitle: "ATM — Articulation temporo-mandibulaire | Kinésica",
      metaDescription:
        "Traitement de l'ATM chez Kinésica (Buenos Aires). Mâchoire, douleur, claquements et bruxisme par thérapie manuelle à Palermo.",
      breadcrumb: "ATM",
    },
    pt: {
      metaTitle: "ATM — Articulação temporomandibular | Kinésica",
      metaDescription:
        "Tratamento de ATM na Kinésica (Buenos Aires). Mandíbula, dor, estalos e bruxismo com terapia manual em Palermo.",
      breadcrumb: "ATM",
    },
  },
  acupuntura: {
    es: {
      metaTitle: "Acupuntura | Kinésica",
      metaDescription:
        "Acupuntura en Kinésica (Buenos Aires). Medicina tradicional china integrada al abordaje del dolor y el estrés en Palermo.",
      breadcrumb: "Acupuntura",
    },
    en: {
      metaTitle: "Acupuncture | Kinésica",
      metaDescription:
        "Acupuncture at Kinésica (Buenos Aires). Traditional Chinese medicine as part of an integrated approach to pain and stress in Palermo.",
      breadcrumb: "Acupuncture",
    },
    fr: {
      metaTitle: "Acupuncture | Kinésica",
      metaDescription:
        "Acupuncture chez Kinésica (Buenos Aires). Médecine traditionnelle chinoise intégrée à la prise en charge de la douleur et du stress à Palermo.",
      breadcrumb: "Acupuncture",
    },
    pt: {
      metaTitle: "Acupuntura | Kinésica",
      metaDescription:
        "Acupuntura na Kinésica (Buenos Aires). Medicina tradicional chinesa integrada ao tratamento da dor e do estresse em Palermo.",
      breadcrumb: "Acupuntura",
    },
  },
  "posturologia-clinica": {
    es: {
      metaTitle: "Posturología Clínica | Kinésica",
      metaDescription:
        "Posturología clínica en Kinésica (Buenos Aires). Evaluación de postura, equilibrio y apoyo plantar en Palermo.",
      breadcrumb: "Posturología Clínica",
    },
    en: {
      metaTitle: "Clinical Posturology | Kinésica",
      metaDescription:
        "Clinical posturology at Kinésica (Buenos Aires). Assessment of posture, balance and plantar support in Palermo.",
      breadcrumb: "Clinical Posturology",
    },
    fr: {
      metaTitle: "Posturologie clinique | Kinésica",
      metaDescription:
        "Posturologie clinique chez Kinésica (Buenos Aires). Évaluation de la posture, de l'équilibre et de l'appui plantaire à Palermo.",
      breadcrumb: "Posturologie clinique",
    },
    pt: {
      metaTitle: "Posturologia clínica | Kinésica",
      metaDescription:
        "Posturologia clínica na Kinésica (Buenos Aires). Avaliação de postura, equilíbrio e apoio plantar em Palermo.",
      breadcrumb: "Posturologia clínica",
    },
  },
};
