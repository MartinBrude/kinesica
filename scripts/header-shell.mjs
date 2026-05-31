/**
 * Shared site header shell (partials + static inject + page builders).
 */
import fs from "fs";
import path from "path";
import { sitePath } from "./i18n-urls.mjs";
import {
  LANG_CODES,
  PICKER_TRIGGER_LABEL,
  langByCode,
} from "./languages.mjs";

export const HEADER_SCHEDULE = {
  es: "Lunes a viernes: <strong>10 a 20 h</strong>",
  en: "Monday to Friday: <strong>10 a.m. to 8 p.m.</strong>",
  fr: "Lundi au vendredi : <strong>10 h à 20 h</strong>",
};

const GLOBE_SVG = `<svg class="lang-picker__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

const CHEVRON_SVG = `<svg class="lang-picker__chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;

export function buildLangPickerHtml(pageLang, stem) {
  const current = langByCode(pageLang);
  const triggerLabel = PICKER_TRIGGER_LABEL[pageLang] || "Language";
  const menuItems = LANG_CODES.map((toLang) => {
    const entry = langByCode(toLang);
    const href = sitePath(toLang, stem);
    const currentAttr =
      toLang === pageLang ? ' aria-current="true"' : "";
    return `              <li class="lang-picker__item" role="none">
                <a class="lang-picker__option" href="${href}" role="option"${currentAttr} hreflang="${entry.hreflang}">${entry.nativeName}</a>
              </li>`;
  }).join("\n");

  return `            <div class="lang-picker" data-lang-picker>
              <button type="button" class="lang-picker__trigger" aria-expanded="false" aria-haspopup="listbox" aria-label="${triggerLabel}">
                ${GLOBE_SVG}
                <span class="lang-picker__current">${current.nativeName}</span>
                ${CHEVRON_SVG}
              </button>
              <ul class="lang-picker__menu" role="listbox" aria-label="${triggerLabel}">
${menuItems}
              </ul>
            </div>`;
}

export function stemFromRepoFile(file) {
  const base = path.basename(file, ".html");
  return base === "index" ? "index" : base;
}

export function assetPrefixForLang(lang) {
  return lang === "es" ? "" : "../";
}

export function loadSnippet(root, jsPath) {
  const raw = fs.readFileSync(path.join(root, jsPath), "utf8");
  const m = raw.match(/=\s*`([\s\S]*?)`\s*\.trim\(\)/);
  if (!m) throw new Error(`Could not parse snippet: ${jsPath}`);
  return m[1].trim();
}

export function fillHeaderSnippet(headerHtml, pageLang, stem, navHtml) {
  let html = headerHtml.replace(
    /<ul class="lang-switcher">[\s\S]*?<\/ul>/,
    buildLangPickerHtml(pageLang, stem),
  );
  html = html.replace(
    /<div class="lang-picker" data-lang-picker>\s*<\/div>/,
    buildLangPickerHtml(pageLang, stem),
  );
  if (navHtml) {
    html = html.replace(
      /<div id="navigation"([^>]*)><\/div>/,
      `<div id="navigation"$1>\n${navHtml}\n            </div>`,
    );
  }
  return html;
}

/** Markup before <main>: header root + header/nav scripts (nav early avoids stale footer cache). */
export function headerShellMarkup(lang, prefix = "") {
  const l = lang === "en" || lang === "fr" ? lang : "es";
  return `  <div id="site-header-root" data-header-lang="${l}"></div>
  <script src="${prefix}partials/header-${l}.min.js"></script>
  <script src="${prefix}js/header-include.min.js"></script>
  <script src="${prefix}js/lang-picker.min.js"></script>
  <script src="${prefix}partials/nav-${l}.min.js"></script>
  <script src="${prefix}js/nav-include.min.js"></script>
`;
}

export function injectStaticHeader(html, file, rootDir) {
  const lang =
    file.startsWith("en/") ? "en" : file.startsWith("fr/") ? "fr" : "es";
  const stem = stemFromRepoFile(file);
  const headerHtml = fillHeaderSnippet(
    loadSnippet(rootDir, `partials/header-${lang}.js`),
    lang,
    stem,
    loadSnippet(rootDir, `partials/nav-${lang}.js`),
  );
  const openTag = `<div id="site-header-root" data-header-lang="${lang}">`;

  if (html.includes('id="site-header-root"')) {
    const filled = new RegExp(
      `<div id="site-header-root"[^>]*>[\\s\\S]*?<\\/div>\\s*(?=<script[^>]*partials/header-)`,
    );
    if (filled.test(html)) {
      return html.replace(
        filled,
        `${openTag}\n${headerHtml}\n</div>\n  `,
      );
    }
    return html.replace(
      /<div id="site-header-root"([^>]*)><\/div>/,
      `${openTag}\n${headerHtml}\n</div>`,
    );
  }

  return html;
}
