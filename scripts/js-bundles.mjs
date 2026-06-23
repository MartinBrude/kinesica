/**
 * JS bundle manifest — concat order for build-js-bundles.mjs.
 * Edit members here; HTML refs live in page-shell.mjs / header-shell.mjs.
 */
import { partialLang } from "./languages.mjs";

const PARTIAL_LANGS = ["es", "en", "fr", "pt"];

/** @param {string} lang */
function pl(lang) {
  return partialLang(lang);
}

/** Shared bundles (all pages). */
export const SHARED_BUNDLES = {
  "js/head-lang.min.js": ["js/lang-preference.js", "js/redirect.js"],
  "js/shell-top.min.js": [
    "partials/skip-link.js",
    "js/skip-link-include.js",
    "partials/gtm-body.js",
    "js/gtm-body-include.js",
  ],
  "js/ui-core.min.js": [
    "js/mobile-nav.js",
    "js/ui-reveal.js",
    "js/sticky-header.js",
  ],
  "js/ui-home.min.js": ["js/faq-accordion.js", "js/map-embed-facade.js"],
  "js/reviews.min.js": [
    "partials/google-reviews-data.js",
    "js/google-reviews.js",
  ],
};

/** @param {string} lang */
export function shellHeaderMembers(lang) {
  const l = pl(lang);
  return [
    "js/lang-routes.js",
    "js/snippet-lang.js",
    `partials/header-${l}.js`,
    "js/header-include.js",
    "js/lang-picker.js",
    `partials/nav-${l}.js`,
    "js/nav-include.js",
  ];
}

/** @param {string} lang */
export function shellCtaMembers(lang) {
  const l = pl(lang);
  return [`partials/cta-strip-${l}.js`, "js/cta-strip-include.js"];
}

/** @param {string} lang */
export function shellFooterMembers(lang) {
  const l = pl(lang);
  return [
    "js/site-config.js",
    `partials/footer-${l}.js`,
    "js/footer-include.js",
  ];
}

/** @param {string} lang */
export function shellWhatsappMembers(lang) {
  const l = pl(lang);
  return [
    `partials/whatsapp-float-${l}.js`,
    "js/whatsapp-float-include.js",
    "js/whatsapp-logic.js",
  ];
}

/** @param {"header"|"cta"|"footer"|"whatsapp"} name @param {string} lang */
export function langBundlePath(name, lang) {
  return `js/shell-${name}-${pl(lang)}.min.js`;
}

/** All bundles: output path → ordered source paths (non-min). */
export function allJsBundles() {
  /** @type {Record<string, string[]>} */
  const bundles = { ...SHARED_BUNDLES };
  for (const lang of PARTIAL_LANGS) {
    bundles[langBundlePath("header", lang)] = shellHeaderMembers(lang);
    bundles[langBundlePath("cta", lang)] = shellCtaMembers(lang);
    bundles[langBundlePath("footer", lang)] = shellFooterMembers(lang);
    bundles[langBundlePath("whatsapp", lang)] = shellWhatsappMembers(lang);
  }
  return bundles;
}

export function allBundlePaths() {
  return Object.keys(allJsBundles());
}
