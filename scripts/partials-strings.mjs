/**
 * UI strings for generated partials (header, nav, footer, CTA, WhatsApp).
 * Edit here, then: npm run build:partials && npm run assets:build
 */
export const TECHNIQUE_NAV_STEMS = [
  "rpg",
  "osteopatia",
  "cadenas",
  "manipulaciones",
  "neurodinamia",
  "atm",
];

export const PARTIAL_STRINGS = {
  es: {
    headerComment:
      "Spanish site header — lang picker filled by inject-static-shell / js/lang-picker.js",
    schedule: "Lunes a viernes: <strong>10 a 20 h</strong>",
    homeHref: "/",
    logoSrc: "images/logo.svg",
    logoAlt: "logo kinesica",
    navComment: "Spanish header nav — relative links from site root.",
    articles: { label: "Artículos", title: "Artículos" },
    methodsMenu: { label: "Métodos y Técnicas", title: "Métodos y Técnicas" },
    techniques: {
      rpg: { label: "RPG", title: "RPG" },
      osteopatia: { label: "Osteopatía", title: "Osteopatía" },
      cadenas: { label: "Cadenas Fisiológicas", title: "Cadenas Fisiológicas" },
      manipulaciones: {
        label: "Manipulaciones viscerales",
        title: "Manipulaciones viscerales",
      },
      neurodinamia: { label: "Neurodinamia", title: "Neurodinamia" },
      atm: { label: "ATM", title: "ATM" },
    },
    footerComment:
      "Spanish footer — root-absolute links (/rpg.html). file:// adjusted in footer-include.js.",
    methodsTitle: "Métodos y Técnicas",
    socialTitle: "Redes sociales",
    clinicTitle: "Consultorio",
    mapsTitle: "Ver Kinésica en Google Maps",
    copyright: "© Kinésica — Todos los derechos reservados",
    footerSocialColClass: "col-lg-2 col-md-4 col-sm-4 col-xs-12",
    ctaTitle: "Contáctanos y reserva un turno",
    ctaText: "Antes de la primera sesión hacemos una llamada para aclarar dudas.",
    ctaButton: "Contacto",
    whatsappComment:
      "Spanish WhatsApp float button. Loaded with <script src>; works from file://",
    whatsappAria: "Contactar por WhatsApp",
  },
  en: {
    headerComment:
      "English site header — lang picker filled by js/header-include.js",
    schedule: "Monday to Friday: <strong>10 a.m. to 8 p.m.</strong>",
    homeHref: "/en/",
    logoSrc: "../images/logo.svg",
    logoAlt: "kinesica logo",
    navComment: "English header nav — relative links from en/ directory.",
    articles: { label: "Articles", title: "Articles" },
    methodsMenu: { label: "Methods & Techniques", title: "Methods & Techniques" },
    techniques: {
      rpg: { label: "RPG", title: "RPG" },
      osteopatia: { label: "Osteopathy", title: "Osteopathy" },
      cadenas: {
        label: "Physiological Chains",
        title: "Physiological Chains",
      },
      manipulaciones: {
        label: "Visceral Manipulations",
        title: "Visceral Manipulations",
      },
      neurodinamia: { label: "Neurodynamics", title: "Neurodynamics" },
      atm: { label: "ATM (TMJ)", title: "ATM (TMJ)" },
    },
    footerComment:
      "English footer — /en/… links. file:// adjusted in footer-include.js.",
    methodsTitle: "Methods & Techniques",
    socialTitle: "Social media",
    clinicTitle: "Clinic",
    mapsTitle: "View Kinésica on Google Maps",
    copyright: "© Kinésica — All rights reserved",
    footerSocialColClass: "col-lg-2 col-md-4 col-sm-4 col-xs-12",
    ctaTitle: "Contact us and book an appointment",
    ctaText: "Before the first session we can chat to clarify any questions.",
    ctaButton: "Contact",
    whatsappComment:
      "English WhatsApp float button. Loaded with <script src>; works from file://",
    whatsappAria: "Contact via WhatsApp",
  },
  fr: {
    headerComment:
      "French site header — lang picker filled by js/header-include.js",
    schedule: "Lundi au vendredi : <strong>10 h à 20 h</strong>",
    homeHref: "/fr/",
    logoSrc: "../images/logo.svg",
    logoAlt: "logo Kinésica",
    navComment: "French header nav — relative links from fr/ directory.",
    articles: { label: "Articles", title: "Articles" },
    methodsMenu: { label: "Méthodes et techniques", title: "Méthodes et techniques" },
    techniques: {
      rpg: { label: "RPG", title: "RPG" },
      osteopatia: { label: "Ostéopathie", title: "Ostéopathie" },
      cadenas: {
        label: "Chaînes physiologiques",
        title: "Chaînes physiologiques",
      },
      manipulaciones: {
        label: "Manipulations viscérales",
        title: "Manipulations viscérales",
      },
      neurodinamia: { label: "Neurodynamique", title: "Neurodynamique" },
      atm: { label: "ATM", title: "ATM" },
    },
    footerComment:
      "French footer — /fr/… links. file:// adjusted in footer-include.js.",
    methodsTitle: "Méthodes et techniques",
    socialTitle: "Réseaux sociaux",
    clinicTitle: "Cabinet",
    mapsTitle: "Voir Kinésica sur Google Maps",
    copyright: "© Kinésica — Tous droits réservés",
    footerSocialColClass: "col-lg-3 col-md-4 col-sm-4 col-xs-12",
    ctaTitle: "Contactez-nous et prenez rendez-vous",
    ctaText:
      "Avant la première séance, nous pouvons échanger pour répondre à vos questions.",
    ctaButton: "Contact",
    whatsappComment:
      "French WhatsApp float button. Loaded with <script src>; works from file://",
    whatsappAria: "Contacter via WhatsApp",
  },
  pt: {
    headerComment: "Portuguese site header",
    schedule: "Segunda a sexta: <strong>10 h às 20 h</strong>",
    homeHref: "/pt/",
    logoSrc: "../images/logo.svg",
    logoAlt: "logo kinesica",
    navComment: "Portuguese header nav — relative links from pt/ directory.",
    articles: { label: "Artigos", title: "Artigos" },
    methodsMenu: { label: "Métodos e técnicas", title: "Métodos e técnicas" },
    techniques: {
      rpg: { label: "RPG", title: "RPG" },
      osteopatia: { label: "Osteopatia", title: "Osteopatia" },
      cadenas: {
        label: "Cadeias fisiológicas",
        title: "Cadeias fisiológicas",
      },
      manipulaciones: {
        label: "Manipulações viscerais",
        title: "Manipulações viscerais",
      },
      neurodinamia: { label: "Neurodinâmica", title: "Neurodinâmica" },
      atm: { label: "ATM", title: "ATM" },
    },
    footerComment: "Portuguese footer — /pt/… links.",
    methodsTitle: "Métodos e técnicas",
    socialTitle: "Redes sociais",
    clinicTitle: "Consultório",
    mapsTitle: "Ver Kinésica no Google Maps",
    copyright: "© Kinésica — Todos os direitos reservados",
    footerSocialColClass: "col-lg-2 col-md-4 col-sm-4 col-xs-12",
    ctaTitle: "Fale conosco e agende",
    ctaText: "Antes da primeira sessão podemos ligar para tirar dúvidas.",
    ctaButton: "Contato",
    whatsappComment: "Portuguese WhatsApp float button.",
    whatsappAria: "Contato pelo WhatsApp",
  },
};

/** Schedule lines for header partials (also used by header-shell.mjs). */
export const HEADER_SCHEDULE = Object.fromEntries(
  Object.entries(PARTIAL_STRINGS).map(([code, s]) => [code, s.schedule]),
);
