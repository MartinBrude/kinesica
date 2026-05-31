/**
 * Single source of truth for site languages.
 * Add a language here, then content + partials + npm run build:lang-routes.
 */
import fs from "fs";
import path from "path";

export const LANGUAGES = [
  {
    code: "es",
    bcp47: "es-AR",
    hreflang: "es-AR",
    urlPrefix: "",
    nativeName: "Español",
    isDefault: true,
    published: true,
  },
  {
    code: "en",
    bcp47: "en",
    hreflang: "en",
    urlPrefix: "en",
    nativeName: "English",
    isDefault: false,
    published: true,
  },
  {
    code: "fr",
    bcp47: "fr",
    hreflang: "fr",
    urlPrefix: "fr",
    nativeName: "Français",
    isDefault: false,
    published: true,
  },
  {
    code: "pt",
    bcp47: "pt",
    hreflang: "pt",
    urlPrefix: "pt",
    nativeName: "Português",
    isDefault: false,
    published: true,
  },
];

export const OG_LOCALE = {
  es: "es_AR",
  en: "en_US",
  fr: "fr_FR",
  pt: "pt_BR",
};

export const PICKER_TRIGGER_LABEL = {
  es: "Idioma",
  en: "Language",
  fr: "Langue",
  pt: "Idioma",
};

export const DEFAULT_LANG =
  LANGUAGES.find((l) => l.isDefault)?.code ?? LANGUAGES[0].code;

export const ALL_LANG_CODES = LANGUAGES.map((l) => l.code);

/** Languages with published content and public URLs. */
export const LANG_CODES = LANGUAGES.filter((l) => l.published).map((l) => l.code);

export const SUBDIR_LANGS = LANGUAGES.filter((l) => l.urlPrefix).map((l) => l.code);

export const SUBDIR_PREFIXES = LANGUAGES.filter((l) => l.urlPrefix).map(
  (l) => l.urlPrefix,
);

export function langByCode(code) {
  return LANGUAGES.find((l) => l.code === code);
}

export function isDefaultLang(code) {
  return code === DEFAULT_LANG;
}

export function ogLocaleFor(code) {
  return OG_LOCALE[code] ?? code;
}

/** Partial file suffix (header-es, nav-pt, …). */
export function partialLang(code) {
  return langByCode(code) ? code : DEFAULT_LANG;
}

export function snippetVar(prefix, code) {
  return `__KINESICA_${prefix}_SNIPPET_${partialLang(code).toUpperCase()}`;
}

export function expectedLangFromFile(file) {
  for (const lang of LANGUAGES) {
    if (lang.urlPrefix && file.startsWith(`${lang.urlPrefix}/`)) {
      return lang.code;
    }
  }
  return DEFAULT_LANG;
}

export function listHtmlFiles(root, { skipCv = true } = {}) {
  const files = fs
    .readdirSync(root)
    .filter((f) => f.endsWith(".html") && !(skipCv && f.startsWith("cv-")));
  for (const prefix of SUBDIR_PREFIXES) {
    const dir = path.join(root, prefix);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".html")) files.push(`${prefix}/${f}`);
    }
  }
  return files;
}
