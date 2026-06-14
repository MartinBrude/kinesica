/**
 * Schema.org — SEO local Kinésica (fisioterapia / kinesiología).
 * Fuente única para inyección en HTML y generación de partials.
 */
import { SITE, absoluteUrl, STEMS, HTML_LANG } from "./i18n-urls.mjs";
import { LANG_CODES, expectedLangFromFile } from "./languages.mjs";
import { GOOGLE_MAPS_URL } from "./google-place.mjs";

export const BUSINESS_ID = `${SITE}/#kinesica`;

/** Service name + description for a method/pathology stem (schema + method pages). */
export function getMethodServiceCopy(lang, stem) {
  return COPY[lang]?.services?.[stem] ?? null;
}

const MAPS_URL = GOOGLE_MAPS_URL;
const WHATSAPP_URL = "https://wa.me/5491161564311";
const EMAIL = "norberto1712@gmail.com";

const COPY = {
  es: {
    homeUrl: `${SITE}/`,
    description:
      "Centro de fisioterapia y kinesiología en Palermo, Buenos Aires: osteopatía, RPG, neurodinámia y terapias manuales personalizadas.",
    bookAction: "Reservar turno por WhatsApp",
    catalogName: "Tratamientos Kinésica",
    specialties: [
      "Fisioterapia",
      "Kinesiología",
      "Osteopatía",
      "Terapia manual",
      "RPG",
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
    faqs: [
      {
        q: "¿Cuál es la duración del tratamiento?",
        a: "Dependerá del objetivo, la situación del paciente y la evolución del tratamiento.",
      },
      {
        q: "¿Cuánto dura la sesión?",
        a: "El tiempo de duración de una sesión es variable según el caso y la metodología que se necesite. Tomamos como un tiempo estándar 1 hora por sesión.",
      },
      {
        q: "¿Frecuencia de las sesiones?",
        a: "Varía según los casos y los métodos a emplear. En algunas modalidades las sesiones son semanales y en otras pueden espaciarse cada 2 o 3 semanas.",
      },
      {
        q: "¿Qué necesito llevar a la primera sesión?",
        a: "Tus inquietudes y estudios complementarios si los tuvieses; ropa cómoda. Si sos menor, vení acompañado/a por un mayor.",
      },
      {
        q: "¿Atienden a través de Prepagas u Obras Sociales?",
        a: "Podés solicitar reintegros a tu obra social o prepaga.",
      },
      {
        q: "¿A quiénes sirven estos tratamientos?",
        a: "A personas con dolores, alteraciones de la sensibilidad, mareos, cambios posturales, lesiones traumáticas o deportivas, entre otros.",
      },
    ],
  },
  en: {
    homeUrl: `${SITE}/en/`,
    description:
      "Physiotherapy and kinesiology clinic in Palermo, Buenos Aires: osteopathy, RPG, neurodynamics, and personalized manual therapy.",
    bookAction: "Book via WhatsApp",
    catalogName: "Kinésica treatments",
    specialties: [
      "Physiotherapy",
      "Kinesiology",
      "Osteopathy",
      "Manual therapy",
      "RPG",
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
    faqs: [
      {
        q: "What is the duration of the treatment?",
        a: "It depends on the objective, the patient's condition, and the evolution of the treatment.",
      },
      {
        q: "How long does a session last?",
        a: "The duration of a session varies depending on the case and the methodology required. As a standard time, we consider 1 hour per session.",
      },
      {
        q: "How often are sessions scheduled?",
        a: "It varies by case and methods. Some modalities are weekly; others may be spaced every 2 or 3 weeks.",
      },
      {
        q: "What should I bring to the first session?",
        a: "Your questions and any complementary studies; comfortable clothing. Minors should come with an adult.",
      },
      {
        q: "Do you accept prepaid health plans or insurance?",
        a: "You can request reimbursements from your health insurance provider.",
      },
      {
        q: "Who can benefit from these treatments?",
        a: "People with pain, sensitivity disorders, dizziness, posture issues, traumatic or sports injuries, among others.",
      },
    ],
  },
  fr: {
    homeUrl: `${SITE}/fr/`,
    description:
      "Centre de kinésithérapie et physiothérapie à Palermo, Buenos Aires : ostéopathie, RPG, neurodynamique et thérapies manuelles personnalisées.",
    bookAction: "Prendre rendez-vous via WhatsApp",
    catalogName: "Traitements Kinésica",
    specialties: [
      "Kinésithérapie",
      "Physiothérapie",
      "Ostéopathie",
      "Thérapie manuelle",
      "RPG",
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
        description: "Thérapie pour l'articulation temporo-mandibulaire et le bruxisme.",
      },
      cadenas: {
        name: "Chaînes musculaires",
        description: "Traitement selon les chaînes musculaires et fasciales.",
      },
    },
    faqs: [
      {
        q: "Quelle est la durée du traitement ?",
        a: "Cela dépend de l'objectif, de l'état du patient et de l'évolution du traitement.",
      },
      {
        q: "Combien de temps dure une séance ?",
        a: "La durée varie selon le cas et la méthode utilisée. En règle générale, nous prévoyons environ une heure par séance.",
      },
      {
        q: "À quelle fréquence ont lieu les séances ?",
        a: "Cela varie selon le cas et les méthodes. Certaines modalités sont hebdomadaires ; d'autres, espacées de 2 ou 3 semaines.",
      },
      {
        q: "Que dois-je apporter à la première séance ?",
        a: "Vos questions et examens complémentaires si vous en avez ; tenue confortable. Les mineurs doivent être accompagnés d'un adulte.",
      },
      {
        q: "Acceptez-vous les mutuelles ou assurances ?",
        a: "Vous pouvez demander un remboursement auprès de votre assurance ou mutuelle.",
      },
      {
        q: "Qui peut bénéficier de ces traitements ?",
        a: "Les personnes souffrant de douleur, troubles de sensibilité, vertiges, troubles posturaux, blessures traumatiques ou sportives, entre autres.",
      },
    ],
  },
  pt: {
    homeUrl: `${SITE}/pt/`,
    description:
      "Clínica de fisioterapia em Palermo, Buenos Aires: osteopatia, RPG, neurodinâmica e terapia manual personalizada.",
    bookAction: "Agendar pelo WhatsApp",
    catalogName: "Tratamentos Kinésica",
    specialties: [
      "Fisioterapia",
      "Osteopatia",
      "Terapia manual",
      "RPG",
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
    faqs: [
      {
        q: "Qual é a duração do tratamento?",
        a: "Depende do objetivo, da condição do paciente e da evolução do tratamento.",
      },
      {
        q: "Quanto tempo dura cada sessão?",
        a: "A duração varia conforme o caso e a metodologia. Como referência, reservamos cerca de 1 hora por sessão.",
      },
      {
        q: "Com que frequência são as sessões?",
        a: "Varia conforme o caso e os métodos. Algumas modalidades são semanais; outras, a cada 2 ou 3 semanas.",
      },
      {
        q: "O que devo levar na primeira sessão?",
        a: "Suas dúvidas e exames complementares, se tiver; roupa confortável. Menores devem vir acompanhados de um adulto.",
      },
      {
        q: "Vocês aceitam planos de saúde ou reembolso?",
        a: "Você pode solicitar reembolso junto ao seu plano ou seguro de saúde.",
      },
      {
        q: "Quem pode se beneficiar desses tratamentos?",
        a: "Pessoas com dor, alterações de sensibilidade, tontura, distúrbios posturais, lesões traumáticas ou esportivas, entre outras.",
      },
    ],
  },
};

const SERVICE_STEMS = STEMS.filter(
  (s) => !["index", "articulos", "cv"].includes(s),
);

function openingHours() {
  return [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
      ],
      opens: "10:00",
      closes: "20:00",
    },
  ];
}

function postalAddress() {
  return {
    "@type": "PostalAddress",
    streetAddress: "Charcas 3889",
    addressLocality: "Ciudad Autónoma de Buenos Aires",
    addressRegion: "CABA",
    postalCode: "C1425",
    addressCountry: "AR",
  };
}

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

  return {
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
    telephone: "+54-11-6156-4311",
    email: EMAIL,
    address: postalAddress(),
    geo: {
      "@type": "GeoCoordinates",
      latitude: -34.587025,
      longitude: -58.421046,
    },
    hasMap: MAPS_URL,
    areaServed: [
      { "@type": "City", name: "Ciudad Autónoma de Buenos Aires" },
      { "@type": "AdministrativeArea", name: "CABA" },
      { "@type": "Place", name: "Palermo, Buenos Aires" },
    ],
    openingHours: ["Mo-Fr 10:00-20:00"],
    openingHoursSpecification: openingHours(),
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
      name: "Norberto Silvio Brude",
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
      telephone: "+54-11-6156-4311",
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
      "https://www.facebook.com/kinesicabrude",
      "https://www.instagram.com/kinesicabrude/",
      MAPS_URL,
    ],
  };
}

export function buildFaqPage(lang) {
  const t = COPY[lang];
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${COPY[lang].homeUrl}#faq`,
    inLanguage: lang === "fr" ? "fr" : lang === "en" ? "en" : "es-AR",
    mainEntityOfPage: COPY[lang].homeUrl,
    mainEntity: t.faqs.map((item) => ({
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
