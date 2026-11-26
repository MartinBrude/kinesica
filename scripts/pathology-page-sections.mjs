/**
 * Section builders and localized UI strings for pathology detail pages.
 */
import {
  TECHNIQUE_LABELS,
  UI,
} from "./pathology-content.mjs";
import { sitePath } from "./i18n-urls.mjs";
import { escAttr, escHtml } from "./html-utils.mjs";
import { PATHOLOGY_FAQS, PATHOLOGY_FAQ_UI } from "./pathology-faq-content.mjs";
import {
  PATHOLOGY_PAGE_UI,
  conditionPhrase,
  firstSentence,
} from "./pathology-page-ui.mjs";
import { waMeUrl } from "./site-contact.mjs";

function buildUnifiedApproachAndCta(pathology, lang, techItems) {
  const ui = UI[lang];
  const data = pathology[lang];
  const bookingHref = sitePath(lang, "agendar");
  const waHref = waMeUrl();
  const leadText = data.techniquesNote || ui.techniquesLead;

  return `    <section class="pathology-book-cta pathology-techniques space-medium" aria-labelledby="pathology-book-cta-title">
      <div class="container">
        <div class="row">
          <div class="col-lg-10 col-md-10 col-sm-12 col-xs-12">
            <div class="pathology-cta-card">
              <div class="pathology-cta-content">
                <span class="pathology-cta-badge">${escHtml(ui.bookCtaBadge)}</span>
                <h2 id="pathology-book-cta-title" class="pathology-cta-title">${escHtml(ui.bookCtaTitle)}</h2>
                <p class="pathology-cta-lead">${escHtml(leadText)}</p>
                <div class="pathology-cta-techniques-block">
                  <span class="pathology-cta-techniques-label">${escHtml(ui.techniquesLabel)}</span>
                  <ul class="pathology-technique-links">
                    ${techItems}
                  </ul>
                </div>
              </div>
              <div class="pathology-cta-actions">
                <a href="${escAttr(bookingHref)}" class="btn btn-primary js-booking-cta" title="${escAttr(ui.bookCtaBooking)}">
                  <span>${escHtml(ui.bookCtaBooking)}</span>
                </a>
                <a href="${escAttr(waHref)}" target="_blank" rel="noopener noreferrer" class="btn btn-cta-whatsapp dynamic-whatsapp-url js-norberto-whatsapp" title="${escAttr(ui.bookCtaWhatsApp)}">
                  <svg class="pathology-cta-wa-icon" viewBox="0 0 24 24" fill="currentColor" width="17" height="17" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.78 14.16c-.24.68-1.2 1.25-1.66 1.33-.44.07-.98.1-1.63-.11-.42-.14-.96-.31-1.66-.62-2.93-1.28-4.83-4.29-4.98-4.49-.15-.2-1.19-1.58-1.19-3.01 0-1.43.75-2.14 1.02-2.43.27-.29.59-.36.79-.36.2 0 .4 0 .57.01.19.01.44-.07.69.53.25.6.86 2.09.93 2.24.08.15.13.33.03.53-.1.2-.15.33-.3.51-.15.17-.32.39-.46.52-.15.15-.31.31-.13.62.18.31.8 1.32 1.72 2.14 1.18 1.05 2.17 1.38 2.48 1.53.31.15.49.13.67-.08.18-.21.79-.92 1-1.23.21-.31.42-.26.71-.15.29.11 1.84.87 2.16 1.03.32.16.53.24.61.37.08.14.08.79-.16 1.47z"/></svg>
                  <span>${escHtml(ui.bookCtaWhatsApp)}</span>
                </a>
                <span class="pathology-cta-meta">${escHtml(ui.bookCtaMeta)}</span>
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
${buildUnifiedApproachAndCta(pathology, lang, techItems)}
${buildFaqSection(pathology, lang)}`;
}
