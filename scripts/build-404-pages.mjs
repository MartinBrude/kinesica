#!/usr/bin/env node
/**
 * Generate localized 404 pages (ES / EN / FR / PT).
 * Run: npm run build:404
 */
import { HTML_LANG } from "./i18n-urls.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import { ERROR_404, ERROR_404_LANG_LINKS } from "./404-content.mjs";
import { repoRoot, writeLangPages } from "./build-helpers.mjs";
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

const ROOT = repoRoot(import.meta.url);

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

const written = writeLangPages(ROOT, "404", buildHtml);
console.log(`Done. ${written} localized 404 page(s).`);
