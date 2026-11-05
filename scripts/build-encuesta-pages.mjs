#!/usr/bin/env node
/**
 * Generate anonymous satisfaction survey pages (/encuesta.html, /en/encuesta.html, /fr/encuesta.html, /pt/encuesta.html).
 * Run: node scripts/build-encuesta-pages.mjs
 */
import { ENCUESTA } from "./encuesta-content.mjs";
import { SITE, absoluteUrl, HTML_LANG, sitePath } from "./i18n-urls.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import { escAttr, escHtml } from "./html-utils.mjs";
import { googleReviewWriteUrl } from "./google-place.mjs";
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

function renderStarsSelector(form) {
  const stars = [1, 2, 3, 4, 5];
  return stars
    .map((num) => {
      const lbl = form.ratingLabels[num] || String(num);
      return `                  <label class="encuesta-star-option" data-rating-val="${num}">
                    <input type="radio" name="experiencia" value="${num}" class="sr-only" required />
                    <span class="encuesta-star-box">
                      <span class="encuesta-star-icons" aria-hidden="true">${"★".repeat(num)}</span>
                      <span class="encuesta-star-num">${num}/5</span>
                      <span class="encuesta-star-text">${escHtml(lbl)}</span>
                    </span>
                  </label>`;
    })
    .join("\n");
}

function renderTreatmentOptions(options) {
  return options
    .map(
      (opt) => `                  <label class="encuesta-choice-item">
                    <input type="radio" name="tratamiento_resultado" value="${escAttr(opt.value)}" data-label="${escAttr(opt.label)}" required />
                    <span class="encuesta-choice-label">${escHtml(opt.label)}</span>
                  </label>`,
    )
    .join("\n");
}

function renderRecommendOptions(options) {
  return options
    .map(
      (opt) => `                  <label class="encuesta-rec-pill">
                    <input type="radio" name="recomendaria" value="${escAttr(opt.value)}" data-label="${escAttr(opt.label)}" required />
                    <span class="encuesta-rec-box">
                      <i class="fa ${escAttr(opt.icon)}" aria-hidden="true"></i>
                      <span>${escHtml(opt.label)}</span>
                    </span>
                  </label>`,
    )
    .join("\n");
}

function buildHtml(lang) {
  const copy = ENCUESTA[lang];
  const form = copy.form;
  const prefix = assetPrefixForLang(lang);
  const canonical = absoluteUrl(lang, "encuesta");
  const homeHref = sitePath(lang, "index");
  const homeLabel = HOME_LABELS[lang];
  const reviewUrl = googleReviewWriteUrl();

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
    stem: "encuesta",
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
    <section class="content privacy-page encuesta-page">
      <div class="container">
        <div class="privacy-page-layout encuesta-page-layout">
          <div class="privacy-intro-box encuesta-intro-box">
            <p class="privacy-updated encuesta-eyebrow">
              <i class="fa fa-lock" aria-hidden="true"></i> ${escHtml(copy.anonBadge)}
            </p>
            <h1>${escHtml(copy.h1)}</h1>
            <p class="lead">${escHtml(copy.lead)}</p>
          </div>

          <div class="privacy-deletion-card encuesta-card" id="encuesta-card">
            <form class="encuesta-form" action="/api/send-contact.php" method="POST" data-lang="${escAttr(lang)}" novalidate>
              <input type="hidden" name="type" value="encuesta" />
              <input type="checkbox" name="botcheck" class="hidden" style="display: none;" tabindex="-1" autocomplete="off" />

              <!-- 1. Experiencia general -->
              <fieldset class="encuesta-field-block">
                <legend class="encuesta-question-title">${escHtml(form.q1Label)} *</legend>
                <p class="encuesta-question-hint">${escHtml(form.q1Hint)}</p>
                <div class="encuesta-stars-grid" role="radiogroup" aria-label="${escAttr(form.q1Label)}">
${renderStarsSelector(form)}
                </div>
              </fieldset>

              <!-- 2. Resultado del tratamiento -->
              <fieldset class="encuesta-field-block">
                <legend class="encuesta-question-title">${escHtml(form.q2Label)} *</legend>
                <div class="encuesta-choices-list" role="radiogroup" aria-label="${escAttr(form.q2Label)}">
${renderTreatmentOptions(form.q2Options)}
                </div>
              </fieldset>

              <!-- 3. Recomendación -->
              <fieldset class="encuesta-field-block">
                <legend class="encuesta-question-title">${escHtml(form.q3Label)} *</legend>
                <div class="encuesta-rec-grid" role="radiogroup" aria-label="${escAttr(form.q3Label)}">
${renderRecommendOptions(form.q3Options)}
                </div>
              </fieldset>

              <!-- 4. Comentarios para mejorar -->
              <div class="privacy-form-group encuesta-field-block">
                <label for="encuesta-comentarios" class="encuesta-question-title">${escHtml(form.q4Label)}</label>
                <textarea id="encuesta-comentarios" name="comentarios" class="form-control" rows="4" maxlength="2000" placeholder="${escAttr(form.q4Placeholder)}"></textarea>
              </div>

              <div class="privacy-actions encuesta-actions">
                <button type="submit" class="privacy-btn privacy-btn-primary encuesta-submit-btn" data-action="submit-encuesta">
                  <i class="fa fa-paper-plane" aria-hidden="true"></i> <span class="encuesta-btn-text">${escHtml(form.btnSubmit)}</span>
                </button>
              </div>

              <div class="encuesta-form-alert privacy-form-alert alert" role="status" aria-live="polite"></div>
            </form>

            <!-- Estado de agradecimiento tras enviar -->
            <div class="encuesta-thankyou" id="encuesta-thankyou" hidden>
              <div class="encuesta-thankyou-icon" aria-hidden="true">
                <i class="fa fa-check-circle"></i>
              </div>
              <h2 class="encuesta-thankyou-title">${escHtml(form.thankYouTitle)}</h2>
              <p class="encuesta-thankyou-text">${escHtml(form.thankYouText)}</p>

              <div class="encuesta-review-invite" id="encuesta-review-invite" hidden>
                <h3 class="encuesta-review-title">
                  <i class="fa fa-star" aria-hidden="true"></i> ${escHtml(form.reviewTitle)}
                </h3>
                <p class="encuesta-review-text">${escHtml(form.reviewText)}</p>
                <a href="${escAttr(reviewUrl)}" target="_blank" rel="noopener noreferrer" class="privacy-btn privacy-btn-primary encuesta-review-btn">
                  <i class="fa fa-google" aria-hidden="true"></i> ${escHtml(form.reviewBtn)}
                </a>
              </div>

              <div class="encuesta-thankyou-footer">
                <button type="button" class="btn btn-default btn-sm encuesta-reset-btn" id="encuesta-reset-btn">
                  ${escHtml(form.newResponseBtn)}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
  <script src="${prefix}js/encuesta-form.min.js" defer></script>
${bodyFooterAndUiScripts(lang, prefix)}
</body>

</html>
`;
}

writeLangPages(ROOT, "encuesta", buildHtml);
