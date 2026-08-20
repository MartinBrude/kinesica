/**
 * Schema.org — SEO local Kinésica (fisioterapia / kinesiología).
 * Fuente única para inyección en HTML y generación de partials.
 */
import { SITE, absoluteUrl, STEMS, HTML_LANG } from "./i18n-urls.mjs";
import { LANG_CODES, expectedLangFromFile } from "./languages.mjs";
import { GOOGLE_MAPS_URL } from "./google-place.mjs";
import {
  CONTACT,
  FOUNDER,
  OPENING_HOURS,
  SOCIALS,
  geoCoordinatesSchema,
  openingHoursSpecification,
  postalAddressSchema,
  waMeUrl,
} from "./site-contact.mjs";
import { faqsForSchema } from "./faq-content.mjs";
import { googleReviewsAggregateRating } from "./fetch-google-reviews.mjs";

export const BUSINESS_ID = `${SITE}/#kinesica`;

/** Service name + description for a method/pathology stem (schema + method pages). */
export function getMethodServiceCopy(lang, stem) {
  return COPY[lang]?.services?.[stem] ?? null;
}

const MAPS_URL = GOOGLE_MAPS_URL;
const WHATSAPP_URL = waMeUrl(CONTACT.whatsappDigits);
const EMAIL = CONTACT.email;

const COPY = {
  es: {
    homeUrl: `${SITE}/`,
    description:
      "Centro de fisioterapia y kinesiología en Palermo, Buenos Aires: kinesiología, osteopatía, RPG, ATM y terapias manuales personalizadas.",
    bookAction: "Reservar turno por WhatsApp",
    catalogName: "Tratamientos Kinésica",
    specialties: [
      "Fisioterapia",
      "Kinesiología",
      "Osteopatía",
      "RPG",
      "ATM",
      "Terapia manual",
    ],
    services: {
      osteopatia: {
        name: "Osteopatía",
        description: "Tratamiento osteopático para restaurar el equilibrio del cuerpo.",
      },
      kinesiologia: {
        name: "Kinesiología",
        description: "Evaluación funcional, rehabilitación y terapia manual personalizada.",
      },
      rpg: {
        name: "RPG — Reeducación Postural Global",
        description: "Método de RPG para flexibilizar musculatura estática y reeducar la postura.",
      },
      neurodinamia: {
        name: "Neurodinámia",
        description: "Tratamiento de tensiones nerviosas y movilización neural.",
      },
      manipulaciones: {
        name: "Manipulaciones viscerales",
        description: "Terapia manual visceral para mejorar la función de órganos.",
      },
      acupuntura: {
        name: "Acupuntura",
        description: "Acupuntura como complemento en el abordaje del dolor y el estrés.",
      },
      "posturologia-clinica": {
        name: "Posturología clínica",
        description: "Evaluación y tratamiento postural personalizado.",
      },
      cervicalgia: {
        name: "Tratamiento de cervicalgia",
        description: "Abordaje de dolor y rigidez cervical en Palermo.",
      },
      lumbalgia: {
        name: "Tratamiento de lumbalgia",
        description: "Tratamiento de dolor lumbar y ciática.",
      },
      atm: {
        name: "Tratamiento de ATM",
        description: "Terapia para articulación temporomandibular y bruxismo.",
      },
      cadenas: {
        name: "Cadenas musculares",
        description: "Tratamiento según cadenas musculares y fasciales.",
      },
    },
  },
  en: {
    homeUrl: `${SITE}/en/`,
    description:
      "Physiotherapy and kinesiology clinic in Palermo, Buenos Aires: kinesiology, osteopathy, RPG, TMJ, and personalized manual therapy.",
    bookAction: "Book via WhatsApp",
    catalogName: "Kinésica treatments",
    specialties: [
      "Physiotherapy",
      "Kinesiology",
      "Osteopathy",
      "RPG",
      "TMJ",
      "Manual therapy",
    ],
    services: {
      osteopatia: {
        name: "Osteopathy",
        description: "Osteopathic treatment to restore body balance.",
      },
      kinesiologia: {
        name: "Kinesiology",
        description: "Functional assessment, rehabilitation, and personalized manual therapy.",
      },
      rpg: {
        name: "RPG — Global Postural Reeducation",
        description: "RPG method to release static muscle chains and re-educate posture.",
      },
      neurodinamia: {
        name: "Neurodynamics",
        description: "Treatment for nerve tension and neural mobilization.",
      },
      manipulaciones: {
        name: "Visceral manipulation",
        description: "Visceral manual therapy to improve organ function.",
      },
      acupuntura: {
        name: "Acupuncture",
        description: "Acupuncture as a complement for pain and stress management.",
      },
      "posturologia-clinica": {
        name: "Clinical posturology",
        description: "Personalized postural assessment and treatment.",
      },
      cervicalgia: {
        name: "Cervical pain treatment",
        description: "Care for neck pain and stiffness in Palermo.",
      },
      lumbalgia: {
        name: "Low back pain treatment",
        description: "Treatment for lumbar pain and sciatica.",
      },
      atm: {
        name: "TMJ treatment",
        description: "Therapy for temporomandibular joint disorders and bruxism.",
      },
      cadenas: {
        name: "Muscle chains therapy",
        description: "Treatment based on muscular and fascial chains.",
      },
    },
  },
  fr: {
    homeUrl: `${SITE}/fr/`,
    description:
      "Centre de kinésithérapie et physiothérapie à Palermo, Buenos Aires : kinésithérapie, ostéopathie, RPG, ATM et thérapies manuelles personnalisées.",
    bookAction: "Prendre rendez-vous via WhatsApp",
    catalogName: "Traitements Kinésica",
    specialties: [
      "Kinésithérapie",
      "Physiothérapie",
      "Ostéopathie",
      "RPG",
      "ATM",
      "Thérapie manuelle",
    ],
    services: {
      osteopatia: {
        name: "Ostéopathie",
        description: "Traitement ostéopathique pour rétablir l'équilibre du corps.",
      },
      kinesiologia: {
        name: "Kinésithérapie",
        description: "Évaluation fonctionnelle, rééducation et thérapie manuelle personnalisée.",
      },
      rpg: {
        name: "RPG — Rééducation Posturale Globale",
        description: "Méthode RPG pour assouplir les chaînes musculaires statiques.",
      },
      neurodinamia: {
        name: "Neurodynamique",
        description: "Traitement des tensions nerveuses et mobilisation neurale.",
      },
      manipulaciones: {
        name: "Manipulations viscérales",
        description: "Thérapie manuelle viscérale pour améliorer la fonction des organes.",
      },
      acupuntura: {
        name: "Acupuncture",
        description: "Acupuncture en complément pour la douleur et le stress.",
      },
      "posturologia-clinica": {
        name: "Posturologie clinique",
        description: "Évaluation et traitement postural personnalisé.",
      },
      cervicalgia: {
        name: "Traitement de la cervicalgie",
        description: "Prise en charge des douleurs cervicales à Palermo.",
      },
      lumbalgia: {
        name: "Traitement de la lombalgie",
        description: "Traitement des douleurs lombaires et sciatique.",
      },
      atm: {
        name: "Traitement de l'ATM",
        description: "Thérapie pour l'articulation temporomandibulaire et le bruxisme.",
      },
      cadenas: {
        name: "Chaînes musculaires",
        description: "Traitement selon les chaînes musculaires et fasciales.",
      },
    },
  },
  pt: {
    homeUrl: `${SITE}/pt/`,
    description:
      "Clínica de fisioterapia em Palermo, Buenos Aires: fisioterapia, osteopatia, RPG, ATM e terapia manual personalizada.",
    bookAction: "Agendar pelo WhatsApp",
    catalogName: "Tratamentos Kinésica",
    specialties: [
      "Fisioterapia",
      "Osteopatia",
      "RPG",
      "ATM",
      "Terapia manual",
    ],
    services: {
      osteopatia: {
        name: "Osteopatia",
        description: "Tratamento osteopático para restaurar o equilíbrio corporal.",
      },
      kinesiologia: {
        name: "Fisioterapia",
        description: "Avaliação funcional, reabilitação e terapia manual personalizada.",
      },
      rpg: {
        name: "RPG — Reeducação Postural Global",
        description: "Método RPG para liberar cadeias musculares estáticas e reeducar a postura.",
      },
      neurodinamia: {
        name: "Neurodinâmica",
        description: "Tratamento de tensão neural e mobilização do sistema nervoso.",
      },
      manipulaciones: {
        name: "Manipulação visceral",
        description: "Terapia manual visceral para melhorar a função dos órgãos.",
      },
      acupuntura: {
        name: "Acupuntura",
        description: "Acupuntura como complemento para dor e gestão do estresse.",
      },
      "posturologia-clinica": {
        name: "Posturologia clínica",
        description: "Avaliação e tratamento postural personalizado.",
      },
      cervicalgia: {
        name: "Tratamento de cervicalgia",
        description: "Cuidado para dor e rigidez cervical em Palermo.",
      },
      lumbalgia: {
        name: "Tratamento de lombalgia",
        description: "Tratamento para dor lombar e ciática.",
      },
      atm: {
        name: "Tratamento de ATM",
        description: "Terapia para disfunções da articulação temporomandibular e bruxismo.",
      },
      cadenas: {
        name: "Cadeias musculares",
        description: "Tratamento baseado em cadeias musculares e fasciais.",
      },
    },
  },
};

const SERVICE_STEMS = STEMS.filter(
  (s) => !["index", "articulos", "cv"].includes(s),
);


function buildOfferCatalog(lang) {
  const t = COPY[lang];
  const offers = [];
  for (const stem of SERVICE_STEMS) {
    const svc = t.services[stem];
    if (!svc) continue;
    offers.push({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        "@id": `${absoluteUrl(lang, stem)}#service`,
        name: svc.name,
        description: svc.description,
        url: absoluteUrl(lang, stem),
        provider: { "@id": BUSINESS_ID },
        areaServed: { "@type": "Place", name: "Palermo, Buenos Aires" },
      },
    });
  }
  return {
    "@type": "OfferCatalog",
    name: t.catalogName,
    itemListElement: offers,
  };
}

/** Clínica de fisioterapia — entidad local principal. */
export function buildPhysiotherapyClinic(lang) {
  const t = COPY[lang];
  const langCode = HTML_LANG[lang] ?? lang;
  const contactLanguages =
    lang === "pt"
      ? ["Portuguese", "Spanish", "English", "French"]
      : lang === "fr"
        ? ["French", "Spanish", "English", "Portuguese"]
        : lang === "en"
          ? ["English", "Spanish", "French", "Portuguese"]
          : ["Spanish", "English", "French", "Portuguese"];

  const clinic = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "Physiotherapy", "MedicalClinic"],
    "@id": BUSINESS_ID,
    name: "Kinésica",
    alternateName:
      lang === "pt"
        ? "Kinésica — Centro de fisioterapia e kinesiologia"
        : lang === "fr"
          ? "Kinésica — Cabinet de kinésithérapie et ostéopathie"
          : lang === "en"
            ? "Kinésica — Physiotherapy and osteopathy clinic"
            : "Kinésica — Centro de kinesiología y fisioterapia",
    url: t.homeUrl,
    mainEntityOfPage: t.homeUrl,
    inLanguage: langCode,
    description: t.description,
    image: [`${SITE}/images/logo.svg`, `${SITE}/images/og-image.jpg`],
    logo: `${SITE}/images/logo.svg`,
    telephone: CONTACT.phoneSchema,
    email: EMAIL,
    address: postalAddressSchema(),
    geo: geoCoordinatesSchema(),
    hasMap: MAPS_URL,
    areaServed: [
      { "@type": "City", name: "Ciudad Autónoma de Buenos Aires" },
      { "@type": "AdministrativeArea", name: "CABA" },
      { "@type": "Place", name: "Palermo, Buenos Aires" },
    ],
    openingHours: [OPENING_HOURS.schemaShort],
    openingHoursSpecification: openingHoursSpecification(),
    medicalSpecialty: t.specialties.map((name) => ({
      "@type": "MedicalSpecialty",
      name,
    })),
    additionalType: "https://schema.org/Physiotherapy",
    availableLanguage: LANG_CODES,
    currenciesAccepted: "ARS",
    paymentAccepted: ["Cash", "Credit Card", "Debit Card"],
    priceRange: "$$",
    founder: {
      "@type": "Person",
      name: FOUNDER.name,
      jobTitle:
        lang === "pt"
          ? "Fisioterapeuta e osteopata"
          : lang === "fr"
            ? "Kinésithérapeute et ostéopathe"
            : lang === "en"
              ? "Physiotherapist and osteopath"
              : "Kinesiólogo y osteópata",
      url: absoluteUrl(lang, "cv"),
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: CONTACT.phoneSchema,
      email: EMAIL,
      contactType: "customer service",
      areaServed: "AR",
      availableLanguage: contactLanguages,
    },
    potentialAction: {
      "@type": "ReserveAction",
      name: t.bookAction,
      target: {
        "@type": "EntryPoint",
        urlTemplate: WHATSAPP_URL,
        inLanguage: langCode,
        actionPlatform: [
          "https://schema.org/WhatsApp",
          "https://schema.org/MobileWebPlatform",
        ],
      },
    },
    hasOfferCatalog: buildOfferCatalog(lang),
    sameAs: [
      SOCIALS.facebookBusiness,
      SOCIALS.instagramBusiness,
      SOCIALS.instagramMaria,
      MAPS_URL,
    ],
  };
  const aggregateRating = googleReviewsAggregateRating();
  if (aggregateRating) {
    clinic.aggregateRating = aggregateRating;
  }
  return clinic;
}

export function buildFaqPage(lang) {
  const homeUrl = COPY[lang].homeUrl;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${homeUrl}#faq`,
    inLanguage: HTML_LANG[lang] ?? lang,
    mainEntityOfPage: homeUrl,
    mainEntity: faqsForSchema(lang).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function buildHomeGraph(lang) {
  return {
    "@context": "https://schema.org",
    "@graph": [buildPhysiotherapyClinic(lang), buildFaqPage(lang)],
  };
}

export function buildClinicOnly(lang) {
  return buildPhysiotherapyClinic(lang);
}

export function langFromHtmlFile(file) {
  return expectedLangFromFile(file);
}

export function ldJsonScript(obj) {
  return `  <script type="application/ld+json" id="kinesica-local-schema">\n${JSON.stringify(obj, null, 2)}\n  </script>`;
}
