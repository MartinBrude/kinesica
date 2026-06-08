#!/usr/bin/env node
/**
 * Meta e hreflang para todas as línguas publicadas.
 * Run: node scripts/apply-lang-meta.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { HREFLANG, HTML_LANG, stemFromFile } from "./i18n-urls.mjs";
import {
  LANG_CODES,
  expectedLangFromFile,
  listHtmlFiles,
  ogLocaleFor,
} from "./languages.mjs";
import { hreflangLinks } from "./html-utils.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LANG_META = Object.fromEntries(
  LANG_CODES.map((code) => [
    code,
    {
      htmlLang: HTML_LANG[code],
      contentLanguage: HTML_LANG[code],
      hreflang: HREFLANG[code],
      ogLocale: ogLocaleFor(code),
    },
  ]),
);

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
  const stem = stemFromFile(file);
  if (/404/.test(file)) return html;

  let out = html.replace(
    /<link rel="alternate" hreflang="[^"]+" href="[^"]+" \/>\s*/g,
    "",
  );

  const fullBlock = `${hreflangLinks(stem)}\n`;

  if (out.includes('rel="canonical"')) {
    out = out.replace(
      /(<link rel="canonical" href="[^"]+" \/>)/,
      `$1\n${fullBlock.trimEnd()}`,
    );
  } else {
    out = out.replace("</head>", `${fullBlock}</head>`);
  }
  return out;
}

function apply(file) {
  const lang = expectedLangFromFile(file);
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
for (const file of listHtmlFiles(ROOT)) {
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
