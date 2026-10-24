/**
 * Shared helpers for page builders (write loops, WebPage schema, JSON-LD tags).
 * Keep page-type markup in each build-*.mjs — this is plumbing only.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { absoluteUrl, HTML_LANG, repoPath, SITE } from "./i18n-urls.mjs";
import { HOME_LABELS, LANG_CODES } from "./languages.mjs";
import { breadcrumbListSchema } from "./html-utils.mjs";

export { HOME_LABELS };

/** Repo root from a builder's `import.meta.url`. */
export function repoRoot(importMetaUrl) {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "..");
}

/**
 * Write one localized HTML page under repoPath(lang, stem).
 * @returns {string} relative path written
 */
export function writeRepoHtml(root, lang, stem, html) {
  const rel = repoPath(lang, stem);
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html);
  console.log("wrote:", rel);
  return rel;
}

/** Generate one stem for every published language. */
export function writeLangPages(root, stem, buildHtml) {
  let written = 0;
  for (const lang of LANG_CODES) {
    writeRepoHtml(root, lang, stem, buildHtml(lang));
    written++;
  }
  return written;
}

/** Generate every stem × every language. `buildHtml(stem, lang)`. */
export function writeStemLangPages(root, stems, buildHtml) {
  let written = 0;
  for (const stem of stems) {
    for (const lang of LANG_CODES) {
      writeRepoHtml(root, lang, stem, buildHtml(stem, lang));
      written++;
    }
  }
  return written;
}

/**
 * Generate every item × every language.
 * @param {(item: T) => string} getStem
 * @param {(item: T, lang: string) => string} buildHtml
 */
export function writeItemLangPages(root, items, getStem, buildHtml) {
  let written = 0;
  for (const item of items) {
    const stem = getStem(item);
    for (const lang of LANG_CODES) {
      writeRepoHtml(root, lang, stem, buildHtml(item, lang));
      written++;
    }
  }
  return written;
}

/** Schema.org WebPage + isPartOf WebSite (legal / booking / similar). */
export function webPageSchema({ lang, canonical, name, description }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name,
    description,
    inLanguage: HTML_LANG[lang],
    isPartOf: {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: absoluteUrl(lang, "index"),
      name: "Kinésica",
    },
  };
}

/** Home → page BreadcrumbList. */
export function homePageBreadcrumbSchema(lang, homeLabel, pageName, pageUrl) {
  return breadcrumbListSchema([
    { name: homeLabel, item: absoluteUrl(lang, "index") },
    { name: pageName, item: pageUrl },
  ]);
}

/**
 * `<script type="application/ld+json">` block.
 * @param {object} data
 * @param {{ id?: string, spaces?: number }} [opts]
 */
export function jsonLdScript(data, { id, spaces = 2 } = {}) {
  const idAttr = id ? ` id="${id}"` : "";
  return `  <script type="application/ld+json"${idAttr}>\n${JSON.stringify(data, null, spaces)}\n  </script>`;
}
