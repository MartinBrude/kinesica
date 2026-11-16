#!/usr/bin/env node
/**
 * Generate /mi-turno.html (+ en/fr/pt). Run: node scripts/build-mi-turno-pages.mjs
 */
import { MI_TURNO } from "./mi-turno-content.mjs";
import { SITE, absoluteUrl, HTML_LANG } from "./i18n-urls.mjs";
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
} from "./page-shell.mjs";

const ROOT = repoRoot(import.meta.url);

function buildHtml(lang) {
  const copy = MI_TURNO[lang];
  const prefix = assetPrefixForLang(lang);
  const canonical = absoluteUrl(lang, "mi-turno");
  const homeLabel = HOME_LABELS[lang];

  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">

<head>
  <meta charset="utf-8" />
${headFavicon(prefix)}${headJsClassScript()}${headCriticalCss(prefix)}  <meta http-equiv="content-language" content="${LOCALE[lang]}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex, follow" />
  <meta name="theme-color" content="#005f99" />
${headLangDeferScripts(prefix)}${headSeoBlock({
    lang,
    stem: "mi-turno",
    title: copy.title,
    description: copy.description,
    type: "website",
    image: `${SITE}/images/og-image.jpg`,
    imageAlt: copy.title,
    canonical,
  })}
${headStandardStylesheets(prefix, { bookingWidget: false })}  <script src="${prefix}partials/gtm-head.min.js" defer></script>
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

<body class="page-mi-turno">
${bodyShellTop(prefix)}${headerShellMarkup(lang, prefix)}
  <main id="main" tabindex="-1">
    <section class="content mi-turno-page">
      <div class="container">
        <div class="mi-turno-layout">
          <p class="mi-turno-eyebrow">${escHtml(copy.eyebrow)}</p>
          <h1>${escHtml(copy.h1)}</h1>
          <p class="mi-turno-lead">${escHtml(copy.lead)}</p>

          <form id="mi-turno-form" class="mi-turno-form" novalidate>
            <div class="mi-turno-field">
              <label for="mt-apellido">${escHtml(copy.apellido)}</label>
              <input id="mt-apellido" name="apellido" type="text" autocomplete="family-name" maxlength="80" required placeholder="${escAttr(copy.apellidoPh)}" />
            </div>
            <div class="mi-turno-field">
              <label for="mt-email">${escHtml(copy.email)}</label>
              <input id="mt-email" name="email" type="email" autocomplete="email" maxlength="120" required placeholder="${escAttr(copy.emailPh)}" />
            </div>
            <div class="mi-turno-field">
              <label for="mt-codigo">${escHtml(copy.codigo)}</label>
              <input id="mt-codigo" name="codigo" type="text" autocomplete="one-time-code" maxlength="12" required placeholder="${escAttr(copy.codigoPh)}" spellcheck="false" autocapitalize="characters" />
            </div>
            <button type="submit" class="mi-turno-btn" id="mt-submit">${escHtml(copy.submit)}</button>
          </form>

          <p class="mi-turno-hint">${escHtml(copy.hint)}</p>
          <div id="mt-status" class="mi-turno-status" role="status" aria-live="polite" hidden></div>
          <div id="mt-result" class="mi-turno-result" hidden></div>
        </div>
      </div>
    </section>
  </main>
${bodyFooterAndUiScripts(lang, prefix, { bookingBundle: false })}
  <script type="application/json" id="mi-turno-i18n">${JSON.stringify(copy)}</script>
  <script src="${prefix}js/mi-turno.min.js" defer></script>
</body>

</html>
`;
}

writeLangPages(ROOT, "mi-turno", buildHtml);
