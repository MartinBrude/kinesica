/**
 * Canonical URL helpers for /, /en/, /fr/ structure.
 */
import { PATHOLOGY_STEMS } from "./pathology-content.mjs";
import {
  DEFAULT_LANG,
  LANG_CODES,
  LANGUAGES,
  langByCode,
} from "./languages.mjs";

export { LANG_CODES, DEFAULT_LANG } from "./languages.mjs";

export const SITE = "https://www.kinesica.com.ar";

/** BCP 47 — alineado entre <html lang>, content-language, hreflang e inLanguage. */
export const HTML_LANG = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l.bcp47]),
);
export const HREFLANG = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l.hreflang]),
);
export const SCHEMA_LANGUAGE = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l.bcp47]),
);

export const STEMS = [
  "index",
  "articulos",
  "atm",
  "acupuntura",
  "cadenas",
  "cv",
  "404",
  "manipulaciones",
  "neurodinamia",
  "osteopatia",
  "posturologia-clinica",
  "rpg",
  ...PATHOLOGY_STEMS,
];

/** Public absolute URL for a page. */
export function absoluteUrl(lang, stem) {
  const entry = langByCode(lang);
  if (!entry || entry.isDefault) {
    return stem === "index" ? `${SITE}/` : `${SITE}/${stem}.html`;
  }
  return stem === "index"
    ? `${SITE}/${entry.urlPrefix}/`
    : `${SITE}/${entry.urlPrefix}/${stem}.html`;
}

/** Site-root path (leading slash) for href. */
export function sitePath(lang, stem) {
  const entry = langByCode(lang);
  if (!entry || entry.isDefault) {
    return stem === "index" ? "/" : `/${stem}.html`;
  }
  return stem === "index"
    ? `/${entry.urlPrefix}/`
    : `/${entry.urlPrefix}/${stem}.html`;
}

/** Repo-relative file path. */
export function repoPath(lang, stem) {
  const entry = langByCode(lang);
  if (!entry || entry.isDefault) {
    return stem === "index" ? "index.html" : `${stem}.html`;
  }
  return stem === "index"
    ? `${entry.urlPrefix}/index.html`
    : `${entry.urlPrefix}/${stem}.html`;
}

/** Legacy absolute URLs (pre-migration) for redirects. */
export function legacyAbsoluteUrl(lang, stem) {
  if (lang === DEFAULT_LANG) {
    return absoluteUrl(DEFAULT_LANG, stem);
  }
  if (stem === "index") {
    return `${SITE}/index_${lang}.html`;
  }
  return `${SITE}/${stem}_${lang}.html`;
}

export function legacyRepoPath(lang, stem) {
  if (lang === DEFAULT_LANG) {
    return repoPath(DEFAULT_LANG, stem);
  }
  if (stem === "index") {
    return `index_${lang}.html`;
  }
  return `${stem}_${lang}.html`;
}
