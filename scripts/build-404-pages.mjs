#!/usr/bin/env node
/**
 * Generate localized 404 pages (ES / EN / FR / PT).
 * Run: npm run build:404
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { HTML_LANG, repoPath } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import { ERROR_404, ERROR_404_LANG_LINKS } from "./404-content.mjs";
import {
  LOCALE,
  assetPrefixForLang,
  bodyShellTop,
  headCriticalCss,
  headFavicon,
  headJsClassScript,
  headLangDeferScripts,
  headStandardStylesheets,
} from "./page-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ERROR_STYLES = `  <style>
    .error-section {
      text-align: center;
      padding: 100px 20px;
    }

    .error-title {
      font-size: 96px;
      font-weight: 700;
      color: #555;
    }

    .error-message {
      font-size: 24px;
      margin: 20px 0;
      color: #777;
    }

    .btn-home {
      margin-top: 30px;
      font-size: 18px;
    }

    .error-lang-links {
      margin-top: 24px;
      font-size: 16px;
    }

    .error-lang-links a {
      margin: 0 12px;
    }
  </style>`;

function langLinksHtml() {
  return ERROR_404_LANG_LINKS.map(
    (link) => `<a href="${link.href}">${link.label}</a>`,
  ).join("\n      ");
}

function buildHtml(lang) {
  const copy = ERROR_404[lang];
  const p = assetPrefixForLang(lang);
  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">

<head>
  <meta charset="utf-8" />
${headJsClassScript()}${headCriticalCss(p)}  <meta http-equiv="content-language" content="${LOCALE[lang]}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#005f99" />
${headLangDeferScripts(p)}  <title>${copy.title}</title>
${headStandardStylesheets(p, { gtm: false })}  <meta name="description" content="${copy.description}" />
  <meta name="robots" content="noindex, nofollow" />
${headFavicon(p)}${ERROR_STYLES}
</head>

<body>
${bodyShellTop(p)}${headerShellMarkup(lang, p)}<div id="main" class="error-section" tabindex="-1">
    <h1 class="error-title">404</h1>
    <p class="error-message">${copy.message}</p>
    <a href="${copy.homeHref}" class="btn btn-primary btn-home" rel="noopener">${copy.homeLabel}</a>
    <p class="error-lang-links">
      ${langLinksHtml()}
    </p>
  </div>

  <footer>
    <div class="container text-center footer-minimal">
      ${copy.copyright}
    </div>
  </footer>
</body>

</html>
`;
}

let written = 0;
for (const lang of LANG_CODES) {
  const rel = repoPath(lang, "404");
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buildHtml(lang));
  written++;
  console.log("wrote:", rel);
}

console.log(`Done. ${written} localized 404 page(s).`);
