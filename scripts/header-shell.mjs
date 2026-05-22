/**
 * Shared site header shell (partials + static inject + page builders).
 */
import fs from "fs";
import path from "path";
import { sitePath } from "./i18n-urls.mjs";

export const HEADER_SCHEDULE = {
  es: "Lunes a viernes: <strong>10 a 20 h</strong>",
  en: "Monday to Friday: <strong>10 a.m. to 8 p.m.</strong>",
  fr: "Lundi au vendredi : <strong>10 h à 20 h</strong>",
};

export const FLAG_LABELS = {
  es: {
    es: ["bandera española", "bandera española"],
    en: ["bandera inglesa", "bandera inglesa"],
    fr: ["bandera francesa", "bandera francesa"],
  },
  en: {
    es: ["Spanish Flag", "spanish flag"],
    en: ["British Flag", "british flag"],
    fr: ["French flag", "french flag"],
  },
  fr: {
    es: ["Drapeau espagnol", "drapeau espagnol"],
    en: ["Drapeau britannique", "drapeau britannique"],
    fr: ["Drapeau français", "drapeau français"],
  },
};

export function stemFromRepoFile(file) {
  const base = path.basename(file, ".html");
  return base === "index" ? "index" : base;
}

export function assetPrefixForLang(lang) {
  return lang === "es" ? "" : "../";
}

export function buildLangSwitcherHtml(pageLang, stem) {
  const imgPrefix = pageLang === "es" ? "images/" : "../images/";
  const labels = FLAG_LABELS[pageLang];
  const flagFile = { es: "es.svg", en: "gb.svg", fr: "fr.svg" };

  return ["es", "en", "fr"]
    .map((toLang) => {
      const [title, alt] = labels[toLang];
      const href = sitePath(toLang, stem);
      const img = flagFile[toLang];
      const titleAttr = title ? ` title="${title}"` : "";
      const currentAttr =
        toLang === pageLang ? ' aria-current="true"' : "";
      return `              <li>
                <a href="${href}"${currentAttr}><img src="${imgPrefix}${img}"${titleAttr} alt="${alt}" width="24" height="16" /></a>
              </li>`;
    })
    .join("\n");
}

export function loadSnippet(root, jsPath) {
  const raw = fs.readFileSync(path.join(root, jsPath), "utf8");
  const m = raw.match(/=\s*`([\s\S]*?)`\s*\.trim\(\)/);
  if (!m) throw new Error(`Could not parse snippet: ${jsPath}`);
  return m[1].trim();
}

export function fillHeaderSnippet(headerHtml, pageLang, stem, navHtml) {
  let html = headerHtml.replace(
    /<ul class="lang-switcher">\s*<\/ul>/,
    `<ul class="lang-switcher">\n${buildLangSwitcherHtml(pageLang, stem)}\n            </ul>`,
  );
  if (navHtml) {
    html = html.replace(
      /<div id="navigation"([^>]*)><\/div>/,
      `<div id="navigation"$1>\n${navHtml}\n            </div>`,
    );
  }
  return html;
}

/** Markup before <main>: empty root + sync header scripts. */
export function headerShellMarkup(lang, prefix = "") {
  const l = lang === "en" || lang === "fr" ? lang : "es";
  return `  <div id="site-header-root" data-header-lang="${l}"></div>
  <script src="${prefix}partials/header-${l}.min.js"></script>
  <script src="${prefix}js/header-include.min.js"></script>
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
