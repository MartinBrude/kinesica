/**
 * Canonical URL helpers for /, /en/, /fr/ structure.
 */
export const SITE = "https://www.kinesica.com.ar";

export const STEMS = [
  "index",
  "articulos",
  "atm",
  "cadenas",
  "cervicalgia",
  "lumbalgia",
  "manipulaciones",
  "neurodinamia",
  "osteopatia",
  "rpg",
];

/** Public absolute URL for a page. */
export function absoluteUrl(lang, stem) {
  if (lang === "es") {
    return stem === "index" ? `${SITE}/` : `${SITE}/${stem}.html`;
  }
  return stem === "index" ? `${SITE}/${lang}/` : `${SITE}/${lang}/${stem}.html`;
}

/** Site-root path (leading slash) for href. */
export function sitePath(lang, stem) {
  if (lang === "es") {
    return stem === "index" ? "/" : `/${stem}.html`;
  }
  return stem === "index" ? `/${lang}/` : `/${lang}/${stem}.html`;
}

/** Repo-relative file path. */
export function repoPath(lang, stem) {
  if (lang === "es") {
    return stem === "index" ? "index.html" : `${stem}.html`;
  }
  return stem === "index" ? `${lang}/index.html` : `${lang}/${stem}.html`;
}

/** Legacy absolute URLs (pre-migration) for redirects. */
export function legacyAbsoluteUrl(lang, stem) {
  if (lang === "es") {
    return absoluteUrl("es", stem);
  }
  if (stem === "index") {
    return `${SITE}/index_${lang}.html`;
  }
  return `${SITE}/${stem}_${lang}.html`;
}

export function legacyRepoPath(lang, stem) {
  if (lang === "es") {
    return repoPath("es", stem);
  }
  if (stem === "index") {
    return `index_${lang}.html`;
  }
  return `${stem}_${lang}.html`;
}
