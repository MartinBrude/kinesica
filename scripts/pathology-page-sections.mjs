/**
 * Section builders and localized UI strings for pathology detail pages.
 */
import {
  PATHOLOGY_RELATED,
  TECHNIQUE_LABELS,
  UI,
  pathologyForStem,
} from "./pathology-content.mjs";
import { sitePath } from "./i18n-urls.mjs";
import { escAttr, escHtml } from "./html-utils.mjs";
import { PATHOLOGY_FAQS, PATHOLOGY_FAQ_UI } from "./pathology-faq-content.mjs";
import { PATHOLOGY_RED_FLAGS } from "./pathology-red-flags.mjs";
import {
  PATHOLOGY_PAGE_UI,
  conditionPhrase,
  firstSentence,
} from "./pathology-page-ui.mjs";
import { waMeUrl } from "./site-contact.mjs";

function buildRelatedSection(pathology, lang) {
  const ui = UI[lang];
  const relatedStems = PATHOLOGY_RELATED[pathology.stem];
  if (!relatedStems?.length) return "";

  const items = relatedStems
    .map((relatedStem) => {
      const related = pathologyForStem(relatedStem);
      if (!related?.[lang]) return "";
      return `<li><a href="${sitePath(lang, relatedStem)}">${escHtml(related[lang].breadcrumb)}</a></li>`;
    })
    .filter(Boolean)
    .join("\n              ");
  if (!items) return "";

  return `    <section class="pathology-related space-medium">
      <div class="container">
        <div class="row">
          <div class="col-lg-10 col-md-10 col-sm-12 col-xs-12">
            <h2>${ui.relatedTitle}</h2>
            <p class="pathology-related-lead">${ui.relatedLead}</p>
            <ul class="pathology-technique-links pathology-related-links">
              ${items}
            </ul>
          </div>
        </div>
      </div>
    </section>`;
}

function buildUrgentCareSection(lang, name, stem) {
  const ui = PATHOLOGY_PAGE_UI[lang];
  const urgentList = PATHOLOGY_RED_FLAGS[stem]?.[lang] || ui.urgentList;
  const items = urgentList.map((item) => `                <li>${escHtml(item)}</li>`).join("\n");
  return `    <section class="pathology-urgent-care space-medium">
      <div class="container">
        <div class="row">
          <div class="col-lg-10 col-md-10 col-sm-12 col-xs-12">
            <div class="pathology-urgent-card">
              <div class="pathology-urgent-header">
                <svg class="pathology-urgent-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <h2>${escHtml(ui.urgentTitle(name))}</h2>
              </div>
              <p class="pathology-urgent-lead">${escHtml(ui.urgentLead)}</p>
              <ul>
${items}
              </ul>
              <p class="pathology-urgent-close">${escHtml(ui.urgentClose)} <a href="${sitePath(lang, "condiciones")}">${escHtml(ui.urgentLinkLabel)}</a>.</p>
            </div>
          </div>
        </div>
      </div>
    </section>`;
}

function buildBookCtaSection(lang) {
  const ui = UI[lang];
  const bookingHref = sitePath(lang, "agendar");
  const waHref = waMeUrl();
  const features = [ui.bookCtaFeature1, ui.bookCtaFeature2, ui.bookCtaFeature3]
    .filter(Boolean)
    .map(
      (feat) =>
        `                  <li><svg class="pathology-cta-check" viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> <span>${escHtml(feat)}</span></li>`,
    )
    .join("\n");

  return `    <section class="pathology-book-cta space-medium" aria-labelledby="pathology-book-cta-title">
      <div class="container">
        <div class="row">
          <div class="col-lg-10 col-md-10 col-sm-12 col-xs-12">
            <div class="pathology-cta-card">
              <div class="pathology-cta-content">
                <span class="pathology-cta-badge">${escHtml(ui.bookCtaBadge)}</span>
                <h2 id="pathology-book-cta-title" class="pathology-cta-title">${escHtml(ui.bookCtaTitle)}</h2>
                <p class="pathology-cta-lead">${escHtml(ui.bookCtaLead)}</p>
                <ul class="pathology-cta-features">
${features}
                </ul>
              </div>
              <div class="pathology-cta-actions">
                <a href="${escAttr(bookingHref)}" class="btn btn-primary js-booking-cta" title="${escAttr(ui.bookCtaBooking)}">
                  <span>${escHtml(ui.bookCtaBooking)}</span>
                </a>
                <a href="${escAttr(waHref)}" target="_blank" rel="noopener noreferrer" class="btn btn-cta-whatsapp dynamic-whatsapp-url js-norberto-whatsapp" title="${escAttr(ui.bookCtaWhatsApp)}">
                  <svg class="pathology-cta-wa-icon" viewBox="0 0 24 24" fill="currentColor" width="17" height="17" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.78 14.16c-.24.68-1.2 1.25-1.66 1.33-.44.07-.98.1-1.63-.11-.42-.14-.96-.31-1.66-.62-2.93-1.28-4.83-4.29-4.98-4.49-.15-.2-1.19-1.58-1.19-3.01 0-1.43.75-2.14 1.02-2.43.27-.29.59-.36.79-.36.2 0 .4 0 .57.01.19.01.44-.07.69.53.25.6.86 2.09.93 2.24.08.15.13.33.03.53-.1.2-.15.33-.3.51-.15.17-.32.39-.46.52-.15.15-.31.31-.13.62.18.31.8 1.32 1.72 2.14 1.18 1.05 2.17 1.38 2.48 1.53.31.15.49.13.67-.08.18-.21.79-.92 1-1.23.21-.31.42-.26.71-.15.29.11 1.84.87 2.16 1.03.32.16.53.24.61.37.08.14.08.79-.16 1.47z"/></svg>
                  <span>${escHtml(ui.bookCtaWhatsApp)}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>`;
}

function buildFaqSection(pathology, lang) {
  const faqs = PATHOLOGY_FAQS[pathology.stem]?.[lang];
  if (!faqs?.length) return "";
  const uiTitle = PATHOLOGY_FAQ_UI[lang]?.title || "Preguntas frecuentes";
  const items = faqs
    .map(
      (faq) => `            <details class="pathology-faq-item">
              <summary class="pathology-faq-question">
                <span class="pathology-faq-q-text">${escHtml(faq.q)}</span>
              </summary>
              <div class="pathology-faq-answer">
                <p>${escHtml(faq.a)}</p>
              </div>
            </details>`,
    )
    .join("\n");

  return `    <section class="pathology-faq space-medium">
      <div class="container">
        <div class="row">
          <div class="col-lg-10 col-md-10 col-sm-12 col-xs-12">
            <h2>${escHtml(uiTitle)}</h2>
            <div class="pathology-faq-list">
${items}
            </div>
          </div>
        </div>
      </div>
    </section>`;
}

export function buildPathologyMain(pathology, lang) {
  const ui = UI[lang];
  const pageUi = PATHOLOGY_PAGE_UI[lang];
  const data = pathology[lang];
  const techItems = (pathology.techniques || [])
    .map((t) => `<li><a href="${sitePath(lang, t)}">${escHtml(TECHNIQUE_LABELS[t][lang])}</a></li>`)
    .join("\n              ");

  const [p0 = "", p1 = "", p2 = "", p3 = "", p4 = ""] = data.paragraphs;
  const name = conditionPhrase(data, lang);
  const answerPoints = [
    [pageUi.whatLabel, firstSentence(p0)],
    [pageUi.symptomsLabel, firstSentence(p1)],
    [pageUi.treatmentLabel, firstSentence(p3)],
  ]
    .filter(([, text]) => text)
    .map(([label, text]) => `                <li><strong>${escHtml(label)}.</strong> ${escHtml(text)}</li>`)
    .join("\n");
  const complications = data.complications.map((c) => `                <li>${c}</li>`).join("\n");

  return `    <section class="content pathology-page">
      <div class="container">
        <div class="row">
          <div class="col-lg-8 col-md-8 col-sm-12 col-xs-12">
            <p class="pathology-eyebrow">${ui.eyebrow}</p>
            <h1>${data.h1}</h1>
            <section class="pathology-answer-first">
              <p class="lead">${data.lead}</p>
              <ul>
${answerPoints}
              </ul>
            </section>
            <section aria-labelledby="pathology-what-is-${pathology.stem}">
              <h2 id="pathology-what-is-${pathology.stem}">${escHtml(pageUi.whatIsTitle(name))}</h2>
              <p>${p0}</p>
            </section>
            <section aria-labelledby="pathology-symptoms-${pathology.stem}">
              <h2 id="pathology-symptoms-${pathology.stem}">${escHtml(pageUi.symptomsTitle(name))}</h2>
              <p>${p1}</p>
              <p>${p2}</p>
            </section>
            <section aria-labelledby="pathology-treatment-${pathology.stem}">
              <h2 id="pathology-treatment-${pathology.stem}">${escHtml(pageUi.treatmentTitle(name))}</h2>
              <p>${p3}</p>
            </section>
            <section aria-labelledby="pathology-evaluation-${pathology.stem}">
              <h2 id="pathology-evaluation-${pathology.stem}">${escHtml(pageUi.evaluationTitle(name))}</h2>
              <p>${p4}</p>
            </section>
          </div>
          <div class="col-lg-4 col-md-4 col-sm-12 col-xs-12">
            <aside class="pathology-aside" aria-labelledby="pathology-complications-${pathology.stem}">
              <h2 id="pathology-complications-${pathology.stem}">${ui.complicationsTitle}</h2>
              <ul>
${complications}
              </ul>
            </aside>
          </div>
        </div>
      </div>
    </section>
${buildUrgentCareSection(lang, name, pathology.stem)}
    <section class="pathology-techniques space-medium bg-light">
      <div class="container">
        <div class="row">
          <div class="col-lg-10 col-md-10 col-sm-12 col-xs-12">
            <h2>${ui.techniquesTitle}</h2>
            <p class="pathology-techniques-lead">${data.techniquesNote || ui.techniquesLead}</p>
            <ul class="pathology-technique-links">
              ${techItems}
            </ul>
          </div>
        </div>
      </div>
    </section>
${buildBookCtaSection(lang)}
${buildFaqSection(pathology, lang)}
${buildRelatedSection(pathology, lang)}`;
}
