#!/usr/bin/env node
/**
 * Generate home pages (ES / EN / FR / PT) from home-content.mjs.
 * Schema JSON-LD is injected by inject-local-schema.mjs (buildHomeGraph).
 * Run: npm run build:home
 */
import { HTML_LANG } from "./i18n-urls.mjs";
import { HOME, HOME_HERO_IMAGE, googleReviewsBlock } from "./home-content.mjs";
import { renderFaqSection } from "./faq-content.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import { repoRoot, writeLangPages } from "./build-helpers.mjs";
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
  headLocalBusinessSchema,
  headSeoBlock,
  headStandardStylesheets,
  headHeroImagePreload,
} from "./page-shell.mjs";

const ROOT = repoRoot(import.meta.url);

function buildMainHtml(lang, prefix) {
  const copy = HOME[lang];
  const reviewsMarkup = googleReviewsBlock(lang)
    .join("\n")
    .replace(/__PREFIX__/g, prefix);
  let body = copy.mainHtml
    .replace("__GOOGLE_REVIEWS_PLACEHOLDER__", reviewsMarkup)
    .replace("__FAQ_ACCORDION__", renderFaqSection(lang))
    .replace(/__PREFIX__/g, prefix)
    .replace(
      "__CTA_PLACEHOLDER__",
      ctaStripPlaceholder(lang, prefix, { insideMain: true }),
    );
  return body;
}

function buildHtml(lang) {
  const copy = HOME[lang];
  const p = assetPrefixForLang(lang);
  const stem = "index";

  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">

<head>
  <meta charset="utf-8" />
${headFavicon(p)}${headJsClassScript()}${headCriticalCss(p)}  <meta http-equiv="content-language" content="${LOCALE[lang]}" />
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
    twitterDescription: copy.twitterDescription,
    type: "website",
    image: HOME_HERO_IMAGE,
    imageAlt: copy.twitterImageAlt,
  })}
${headStandardStylesheets(p)}  <link href="${p}css/home-v2.min.css" rel="stylesheet" />
  <script src="${p}partials/gtm-head.min.js" defer></script>
${headLocalBusinessSchema(lang, { home: true })}
</head>

<body class="page-home page-home-v2">
${bodyShellTop(p)}${headerShellMarkup(lang, p)}  <main id="main" tabindex="-1">
${buildMainHtml(lang, p)}
  </main>
${bodyFooterAndUiScripts(lang, p, { faqAccordion: true, mapEmbedFacade: true })}
</body>

</html>
`;
}

const written = writeLangPages(ROOT, "index", buildHtml);
console.log(`Done. ${written} home page(s).`);
