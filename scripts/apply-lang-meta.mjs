#!/usr/bin/env node
/**
 * Meta e hreflang para prioridad español (Argentina) en páginas ES.
 * Run: node scripts/apply-lang-meta.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { absoluteUrl, HREFLANG, HTML_LANG } from "./i18n-urls.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LANG_META = {
  es: {
    htmlLang: HTML_LANG.es,
    contentLanguage: HTML_LANG.es,
    hreflang: HREFLANG.es,
    ogLocale: "es_AR",
  },
  en: {
    htmlLang: HTML_LANG.en,
    contentLanguage: HTML_LANG.en,
    hreflang: HREFLANG.en,
    ogLocale: "en_US",
  },
  fr: {
    htmlLang: HTML_LANG.fr,
    contentLanguage: HTML_LANG.fr,
    hreflang: HREFLANG.fr,
    ogLocale: "fr_FR",
  },
};

function listHtmlFiles() {
  const files = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith(".html") && !f.startsWith("cv-"));
  for (const lang of ["en", "fr"]) {
    const dir = path.join(ROOT, lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".html")) files.push(`${lang}/${f}`);
    }
  }
  return files;
}

function pageLang(file) {
  if (file.startsWith("en/")) return "en";
  if (file.startsWith("fr/")) return "fr";
  return "es";
}

function stemFromFile(file) {
  const base = file.includes("/") ? file.split("/").pop() : file;
  if (base === "index.html") return "index";
  if (base.startsWith("404")) return "404";
  return base.replace(/\.html$/, "");
}

function canonicalUrl(file) {
  const lang = pageLang(file);
  const stem = stemFromFile(file);
  if (/404/.test(file)) {
    return absoluteUrl(lang, "index").replace(/\/$/, "") + `/${lang === "es" ? "" : lang + "/"}404.html`.replace("//", "/");
  }
  return absoluteUrl(lang, stem);
}

function removeContentLanguage(html) {
  return html.replace(
    /\s*<meta http-equiv="content-language" content="[^"]*" \/>\n/g,
    "",
  );
}

function removeAllHreflang(html) {
  return html
    .replace(/<link rel="alternate" hreflang="[^"]+" href="[^"]+" \/>\s*/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function syncOgLocale(html, cfg) {
  return html
    .replace(
      /<meta property="og:locale" content="[^"]*" \/>/,
      `<meta property="og:locale" content="${cfg.ogLocale}" />`,
    )
    .replace(
      /\s*<meta property="og:locale:alternate" content="[^"]*" \/>\n/g,
      "",
    );
}

function ensureHreflangBlock(html, file) {
  const lang = pageLang(file);
  const stem = stemFromFile(file);
  if (/404/.test(file)) return html;

  const es = absoluteUrl("es", stem);
  const en = absoluteUrl("en", stem);
  const fr = absoluteUrl("fr", stem);

  let out = html.replace(
    /<link rel="alternate" hreflang="[^"]+" href="[^"]+" \/>\s*/g,
    "",
  );

  /* Una etiqueta por idioma + x-default → español (sin duplicar href ni es+es-AR). */
  const block =
    `  <link rel="alternate" hreflang="${HREFLANG.es}" href="${es}" />\n` +
    `  <link rel="alternate" hreflang="${HREFLANG.en}" href="${en}" />\n` +
    `  <link rel="alternate" hreflang="${HREFLANG.fr}" href="${fr}" />\n` +
    `  <link rel="alternate" hreflang="x-default" href="${es}" />\n`;

  if (out.includes('rel="canonical"')) {
    out = out.replace(
      /(<link rel="canonical" href="[^"]+" \/>)/,
      `$1\n${block.trimEnd()}`,
    );
  } else {
    out = out.replace("</head>", `${block}</head>`);
  }
  return out;
}

function apply(file) {
  const lang = pageLang(file);
  const cfg = LANG_META[lang];
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");

  html = removeContentLanguage(html);
  html = removeAllHreflang(html);

  if (!/404/.test(file)) {
    html = ensureHreflangBlock(html, file);
    if (html.includes('property="og:locale"')) {
      html = syncOgLocale(html, cfg);
    }
  }

  const contentLangTag = `  <meta http-equiv="content-language" content="${cfg.contentLanguage}" />\n`;
  if (!html.includes('http-equiv="content-language"')) {
    if (/<meta charset="utf-8" \/>/.test(html)) {
      html = html.replace(
        /<meta charset="utf-8" \/>/,
        `<meta charset="utf-8" />\n${contentLangTag}`,
      );
    } else {
      html = html.replace("<head>", `<head>\n${contentLangTag}`);
    }
  }

  if (!html.match(/<html lang="/)) {
    html = html.replace("<html>", `<html lang="${cfg.htmlLang}">`);
  } else {
    html = html.replace(/<html lang="[^"]*">/, `<html lang="${cfg.htmlLang}">`);
  }

  if (lang === "es") {
    html = html.replace(/"inLanguage": "es"/g, '"inLanguage": "es-AR"');
  }

  return html;
}

let changed = 0;
for (const file of listHtmlFiles()) {
  const full = path.join(ROOT, file);
  const original = fs.readFileSync(full, "utf8");
  const next = apply(file);
  if (next !== original) {
    fs.writeFileSync(full, next);
    changed++;
    console.log("lang meta:", file);
  }
}
console.log(`Done. ${changed} file(s) updated.`);
