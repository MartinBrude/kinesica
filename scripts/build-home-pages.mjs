#!/usr/bin/env node
/**
 * Generate home pages (ES / EN / FR / PT) from home-content.mjs.
 * Schema JSON-LD is injected by inject-local-schema.mjs (buildHomeGraph).
 * Run: npm run build:home
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { HTML_LANG, repoPath } from "./i18n-urls.mjs";
import { LANG_CODES, partialLang } from "./languages.mjs";
import { HOME, HOME_HERO_IMAGE, googleReviewsBlock } from "./home-content.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import {
  LOCALE,
  assetPrefixForLang,
  bodyFooterAndUiScripts,
  bodyShellTop,
  headCriticalCss,
  headFavicon,
  headJsClassScript,
  headLangDeferScripts,
  headLocalBusinessSchema,
  headSeoBlock,
  headStandardStylesheets,
  headHeroImagePreload,
  headTwitterBlock,
} from "./page-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function ctaInsideMain(lang, prefix) {
  const l = partialLang(lang);
  return `    <div id="site-cta-strip-root" data-cta-lang="${l}"></div>
  <script src="${prefix}partials/cta-strip-${l}.min.js" defer></script>
  <script src="${prefix}js/cta-strip-include.min.js" defer></script>`;
}

function buildMainHtml(lang, prefix) {
  const copy = HOME[lang];
  const reviewsMarkup = googleReviewsBlock(lang)
    .join("\n")
    .replace(/__PREFIX__/g, prefix);
  let body = copy.mainHtml
    .replace("__GOOGLE_REVIEWS_PLACEHOLDER__", reviewsMarkup)
    .replace(/__PREFIX__/g, prefix)
    .replace("__CTA_PLACEHOLDER__", ctaInsideMain(lang, prefix));
  return body;
}

function buildHtml(lang) {
  const copy = HOME[lang];
  const p = assetPrefixForLang(lang);
  const stem = "index";

  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">

<head>
${headFavicon(p)}  <meta charset="utf-8" />
${headJsClassScript()}${headCriticalCss(p)}  <meta http-equiv="content-language" content="${LOCALE[lang]}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
${headHeroImagePreload(p)}  <meta name="theme-color" content="#005f99" />
${headLangDeferScripts(p)}${headSeoBlock({
    lang,
    stem,
    title: copy.title,
    description: copy.description,
    ogDescription: copy.ogDescription,
    type: "website",
    image: HOME_HERO_IMAGE,
  })}
${headTwitterBlock({
    title: copy.title,
    description: copy.twitterDescription,
    image: HOME_HERO_IMAGE,
    imageAlt: copy.twitterImageAlt,
  })}
${headStandardStylesheets(p)}  <script src="${p}partials/gtm-head.min.js" defer></script>
${headLocalBusinessSchema(lang, { home: true })}
</head>

<body class="page-home">
${bodyShellTop(p)}${headerShellMarkup(lang, p)}  <main id="main" tabindex="-1">
${buildMainHtml(lang, p)}
  </main>
${bodyFooterAndUiScripts(lang, p, { pageHeaderWord: false, faqAccordion: true, mapEmbedFacade: true })}
</body>

</html>
`;
}

let written = 0;
for (const lang of LANG_CODES) {
  const rel = repoPath(lang, "index");
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buildHtml(lang));
  written++;
  console.log("wrote:", rel);
}

console.log(`Done. ${written} home page(s).`);
