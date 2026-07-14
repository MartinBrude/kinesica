/**
 * Article index categories (articulos.html). Stems may appear in multiple categories.
 */
export const ARTICLE_CATEGORIES = [
  {
    id: "spine",
    hue: 198,
    stems: [
      "dorsalgia",
      "lumbalgia",
      "cervicalgia",
      "hipercifosis",
      "hiperlordosis",
      "dorso-plano",
      "escoliosis",
      "hernia-disco",
      "protrusion-discal",
      "dolor-sacroiliaco",
      "ciatalgia",
      "radiculopatia",
    ],
    es: {
      title: "Columna y espalda",
      description:
        "Dolor lumbar, cervical, hernias discales y alteraciones posturales de la columna.",
    },
    en: {
      title: "Spine & back",
      description:
        "Low back and neck pain, disc herniation, and postural changes along the spine.",
    },
    fr: {
      title: "Colonne et dos",
      description:
        "Lombalgie, cervicalgie, hernie discale et troubles posturaux de la colonne.",
    },
    pt: {
      title: "Coluna e costas",
      description:
        "Dor lombar, cervical, hérnia de disco e alterações posturais da coluna.",
    },
  },
  {
    id: "head-neck",
    hue: 168,
    stems: [
      "cefalea",
      "cervicalgia",
      "cervicobraquialgia",
      "bruxismo",
      "desplazamiento-disco-atm",
      "artrosis-atm",
    ],
    es: {
      title: "Cabeza, cuello y mandíbula",
      description:
        "Cefaleas, rigidez cervical y trastornos de la articulación temporomandibular.",
    },
    en: {
      title: "Head, neck & jaw",
      description:
        "Headaches, neck stiffness, and temporomandibular joint disorders.",
    },
    fr: {
      title: "Tête, cou et mâchoire",
      description:
        "Céphalées, raideur cervicale et troubles de l'articulation temporo-mandibulaire.",
    },
    pt: {
      title: "Cabeça, pescoço e mandíbula",
      description:
        "Cefaleias, rigidez cervical e distúrbios da articulação temporomandibular.",
    },
  },
  {
    id: "lower-limb",
    hue: 205,
    stems: [
      "gonalgia",
      "meniscopatia",
      "genu-valgo",
      "genu-varo",
      "pubalgia",
      "talalgia",
      "fascitis-plantar",
      "pies-planos",
      "ciatalgia",
      "dolor-sacroiliaco",
    ],
    es: {
      title: "Miembro inferior",
      description:
        "Rodilla, cadera, pie y alteraciones que afectan la marcha y la carga.",
    },
    en: {
      title: "Lower limb",
      description:
        "Knee, hip, foot, and conditions that affect gait and loading.",
    },
    fr: {
      title: "Membre inférieur",
      description:
        "Genou, hanche, pied et troubles qui affectent la marche et la charge.",
    },
    pt: {
      title: "Membro inferior",
      description:
        "Joelho, quadril, pé e alterações que afetam a marcha e a carga.",
    },
  },
  {
    id: "upper-limb",
    hue: 178,
    stems: [
      "cervicobraquialgia",
      "epicondilitis-lateral",
      "epicondilitis-medial",
      "impingement-subacromial",
      "manguito-rotador",
      "radiculopatia",
    ],
    es: {
      title: "Miembro superior",
      description:
        "Hombro, codo y síntomas que se irradian al brazo.",
    },
    en: {
      title: "Upper limb",
      description:
        "Shoulder, elbow, and symptoms that radiate into the arm.",
    },
    fr: {
      title: "Membre supérieur",
      description:
        "Épaule, coude et symptômes qui irradient vers le bras.",
    },
    pt: {
      title: "Membro superior",
      description:
        "Ombro, cotovelo e sintomas que irradiam para o braço.",
    },
  },
];

/** @param {string} lang @param {number} count */
export function articleCountLabel(lang, count) {
  const n = String(count);
  if (lang === "en") return `${n} article${count === 1 ? "" : "s"}`;
  if (lang === "fr") return `${n} article${count === 1 ? "" : "s"}`;
  if (lang === "pt") return `${n} artigo${count === 1 ? "" : "s"}`;
  return `${n} artículo${count === 1 ? "" : "s"}`;
}
