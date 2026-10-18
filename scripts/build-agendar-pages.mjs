#!/usr/bin/env node
/**
 * Generate online booking pages (/agendar.html, /en/agendar.html, /fr/agendar.html, /pt/agendar.html).
 * Run: node scripts/build-agendar-pages.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AGENDAR } from "./agendar-content.mjs";
import { SITE, absoluteUrl, HTML_LANG, repoPath, sitePath } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import { breadcrumbListSchema, escAttr, escHtml } from "./html-utils.mjs";
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HOME_LABELS = {
  es: "Inicio",
  en: "Home",
  fr: "Accueil",
  pt: "Início",
};

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

  const breadcrumbSchema = JSON.stringify(
    breadcrumbListSchema([
      { name: homeLabel, item: absoluteUrl(lang, "index") },
      { name: copy.breadcrumb, item: canonical },
    ]),
    null,
    2,
  );

  const webPageSchema = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: copy.title,
      description: copy.description,
      inLanguage: HTML_LANG[lang],
      isPartOf: {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: absoluteUrl(lang, "index"),
        name: "Kinésica",
      },
    },
    null,
    2,
  );

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
  <script type="application/ld+json">
${breadcrumbSchema}
  </script>
  <script type="application/ld+json">
${webPageSchema}
  </script>
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

for (const lang of LANG_CODES) {
  const out = path.join(ROOT, repoPath(lang, "agendar"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildHtml(lang));
  console.log("Wrote", out);
}
