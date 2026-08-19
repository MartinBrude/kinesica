/**
 * UI strings for generated partials (header, nav, footer, CTA, WhatsApp).
 * Edit here, then: npm run build:partials && npm run assets:build
 *
 * Schedule hours come from site-contact.mjs (OPENING_HOURS) — do not hardcode times here.
 */
import { scheduleHeaderHtml } from "./site-contact.mjs";
import { METHOD_STEMS } from "./methods-content.mjs";

/** Bootstrap column for footer social block (same width in all locales). */
export const FOOTER_SOCIAL_COL_CLASS =
  "col-lg-3 col-md-4 col-sm-4 col-xs-12";

/** Nav + footer method links — same order as published method pages. */
export const TECHNIQUE_NAV_STEMS = METHOD_STEMS;

export const PARTIAL_STRINGS = {
  es: {
    headerComment:
      "Spanish site header — lang picker filled at runtime by js/lang-picker.js",
    schedule: scheduleHeaderHtml("es"),
    homeHref: "/",
    logoSrc: "images/logo.svg",
    logoAlt: "Kinésica — inicio",
    navComment: "Spanish header nav — relative links from site root.",
    articles: { label: "Artículos", title: "Artículos" },
    methodsMenu: { label: "Métodos y Técnicas", title: "Métodos y Técnicas" },
    footerComment:
      "Spanish footer — root-absolute links (/rpg.html). file:// adjusted in footer-include.js.",
    methodsTitle: "Métodos y Técnicas",
    socialTitle: "Redes sociales",
    clinicTitle: "Consultorio",
    mapsTitle: "Ver Kinésica en Google Maps",
    copyright: "© Kinésica — Todos los derechos reservados",
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
    schedule: scheduleHeaderHtml("en"),
    homeHref: "/en/",
    logoSrc: "../images/logo.svg",
    logoAlt: "Kinésica — home",
    navComment: "English header nav — relative links from en/ directory.",
    articles: { label: "Articles", title: "Articles" },
    methodsMenu: { label: "Methods & Techniques", title: "Methods & Techniques" },
    footerComment:
      "English footer — /en/… links. file:// adjusted in footer-include.js.",
    methodsTitle: "Methods & Techniques",
    socialTitle: "Social media",
    clinicTitle: "Clinic",
    mapsTitle: "View Kinésica on Google Maps",
    copyright: "© Kinésica — All rights reserved",
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
    schedule: scheduleHeaderHtml("fr"),
    homeHref: "/fr/",
    logoSrc: "../images/logo.svg",
    logoAlt: "Kinésica — accueil",
    navComment: "French header nav — relative links from fr/ directory.",
    articles: { label: "Articles", title: "Articles" },
    methodsMenu: { label: "Méthodes et techniques", title: "Méthodes et techniques" },
    footerComment:
      "French footer — /fr/… links. file:// adjusted in footer-include.js.",
    methodsTitle: "Méthodes et techniques",
    socialTitle: "Réseaux sociaux",
    clinicTitle: "Cabinet",
    mapsTitle: "Voir Kinésica sur Google Maps",
    copyright: "© Kinésica — Tous droits réservés",
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
    schedule: scheduleHeaderHtml("pt"),
    homeHref: "/pt/",
    logoSrc: "../images/logo.svg",
    logoAlt: "Kinésica — início",
    navComment: "Portuguese header nav — relative links from pt/ directory.",
    articles: { label: "Artigos", title: "Artigos" },
    methodsMenu: { label: "Métodos e técnicas", title: "Métodos e técnicas" },
    footerComment: "Portuguese footer — /pt/… links.",
    methodsTitle: "Métodos e técnicas",
    socialTitle: "Redes sociais",
    clinicTitle: "Consultório",
    mapsTitle: "Ver Kinésica no Google Maps",
    copyright: "© Kinésica — Todos os direitos reservados",
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
