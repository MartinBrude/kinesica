#!/usr/bin/env node
/**
 * Generate online booking pages (/agendar.html, /en/agendar.html, /fr/agendar.html, /pt/agendar.html).
 * Run: node scripts/build-agendar-pages.mjs
 */
import { AGENDAR } from "./agendar-content.mjs";
import { SITE, absoluteUrl, HTML_LANG, sitePath } from "./i18n-urls.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import { escAttr, escHtml } from "./html-utils.mjs";
import {
  HOME_LABELS,
  homePageBreadcrumbSchema,
  jsonLdScript,
  repoRoot,
  webPageSchema,
  writeLangPages,
} from "./build-helpers.mjs";
import {
  LOCALE,
  assetPrefixForLang,
  bodyFooterAndUiScripts,
  bodyShellTop,
  headCriticalCss,
  headFavicon,
  headJsClassScript,
  headLangDeferScripts,
  headSeoBlock,
  headStandardStylesheets,
  pageBreadcrumbSection,
  pageCaptionMarkup,
  pageHeaderSection,
} from "./page-shell.mjs";

const ROOT = repoRoot(import.meta.url);

function renderHighlights(highlights) {
  return (highlights || [])
    .map(
      (item) => `            <div class="booking-highlight-card">
              <div class="booking-highlight-icon" aria-hidden="true">
                <i class="fa ${escAttr(item.icon)}"></i>
              </div>
              <div class="booking-highlight-body">
                <h2 class="booking-highlight-title">${escHtml(item.title)}</h2>
                <p class="booking-highlight-text">${escHtml(item.text)}</p>
              </div>
            </div>`,
    )
    .join("\n");
}

function buildHtml(lang) {
  const copy = AGENDAR[lang];
  const prefix = assetPrefixForLang(lang);
  const canonical = absoluteUrl(lang, "agendar");
  const homeHref = sitePath(lang, "index");
  const homeLabel = HOME_LABELS[lang];
  const highlightsHtml = renderHighlights(copy.highlights);

  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">

<head>
  <meta charset="utf-8" />
${headFavicon(prefix)}${headJsClassScript()}${headCriticalCss(prefix)}  <meta http-equiv="content-language" content="${LOCALE[lang]}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#005f99" />
${headLangDeferScripts(prefix)}${headSeoBlock({
    lang,
    stem: "agendar",
    title: copy.title,
    description: copy.description,
    type: "website",
    image: `${SITE}/images/og-image.jpg`,
    imageAlt: copy.title,
    canonical,
  })}
${headStandardStylesheets(prefix)}  <script src="${prefix}partials/gtm-head.min.js" defer></script>
${jsonLdScript(homePageBreadcrumbSchema(lang, homeLabel, copy.breadcrumb, canonical))}
${jsonLdScript(
    webPageSchema({
      lang,
      canonical,
      name: copy.title,
      description: copy.description,
    }),
  )}
</head>

<body>
${bodyShellTop(prefix)}${headerShellMarkup(lang, prefix)}
  <main id="main" tabindex="-1">
${pageHeaderSection(pageCaptionMarkup(copy.breadcrumb, { variant: "word" }))}
${pageBreadcrumbSection({
  homeHref,
  homeLabel,
  activeLabel: copy.breadcrumb,
})}
    <section class="content booking-page">
      <div class="container">
        <div class="booking-page-layout">
          <div class="booking-page-intro">
            <p class="booking-page-eyebrow">${escHtml(copy.eyebrow)}</p>
            <h1>${escHtml(copy.h1)}</h1>
            <p class="booking-page-lead">${escHtml(copy.lead)}</p>
          </div>

          <div id="kinesica-booking-widget" class="booking-page-widget-mount"></div>

          <div class="booking-highlights-grid">
${highlightsHtml}
          </div>
        </div>
      </div>
    </section>
  </main>
${bodyFooterAndUiScripts(lang, prefix)}
</body>

</html>
`;
}

writeLangPages(ROOT, "agendar", buildHtml);
