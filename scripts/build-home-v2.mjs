#!/usr/bin/env node
/**
 * Prototype: production home + background-only integration → index_2.html (ES, noindex).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { HTML_LANG } from "./i18n-urls.mjs";
import { HOME, googleReviewsBlock } from "./home-content.mjs";
import { renderFaqSection } from "./faq-content.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import {
  LOCALE,
  assetPrefixForLang,
  bodyFooterAndUiScripts,
  bodyShellTop,
  ctaStripPlaceholder,
  headCriticalCss,
  headFavicon,
  headJsClassScript,
  headLangDeferScripts,
  headStandardStylesheets,
  headHeroImagePreload,
} from "./page-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANG = "es";

function v2q() {
  try {
    const mtime = fs.statSync(path.join(ROOT, "css/home-v2.min.css")).mtimeMs;
    return `?v=${Math.floor(mtime / 1000)}`;
  } catch {
    return "";
  }
}

function buildMainHtml(lang, prefix) {
  const copy = HOME[lang];
  const reviewsMarkup = googleReviewsBlock(lang)
    .join("\n")
    .replace(/__PREFIX__/g, prefix);
  return copy.mainHtml
    .replace("__GOOGLE_REVIEWS_PLACEHOLDER__", reviewsMarkup)
    .replace("__FAQ_ACCORDION__", renderFaqSection(lang))
    .replace(/__PREFIX__/g, prefix)
    .replace(
      "__CTA_PLACEHOLDER__",
      ctaStripPlaceholder(lang, prefix, { insideMain: true }),
    );
}

function buildHtml() {
  const copy = HOME[LANG];
  const p = assetPrefixForLang(LANG);
  const extraCss = `  <link href="${p}css/home-v2.min.css${v2q()}" rel="stylesheet" />\n`;

  return `<!doctype html>
<html lang="${HTML_LANG[LANG]}">

<head>
${headFavicon(p)}  <meta charset="utf-8" />
${headJsClassScript()}${headCriticalCss(p)}  <meta http-equiv="content-language" content="${LOCALE[LANG]}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex, nofollow" />
${headHeroImagePreload(p)}  <meta name="theme-color" content="#005f99" />
${headLangDeferScripts(p)}  <meta name="description" content="${String(copy.description).replace(/"/g, "&quot;")}" />
  <title>${copy.title} — prototipo fondo</title>
${headStandardStylesheets(p)}${extraCss}  <script src="${p}partials/gtm-head.min.js" defer></script>
</head>

<body class="page-home page-home-v2">
${bodyShellTop(p)}${headerShellMarkup(LANG, p)}  <main id="main" tabindex="-1">
${buildMainHtml(LANG, p)}
  </main>
${bodyFooterAndUiScripts(LANG, p, { faqAccordion: true, mapEmbedFacade: true })}
</body>

</html>
`;
}

const out = path.join(ROOT, "index_2.html");
fs.writeFileSync(out, buildHtml());
console.log("wrote: index_2.html (production home + shared background, noindex)");
