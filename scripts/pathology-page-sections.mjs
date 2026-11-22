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
import { escHtml } from "./html-utils.mjs";
import { PATHOLOGY_FAQS, PATHOLOGY_FAQ_UI } from "./pathology-faq-content.mjs";
import { PATHOLOGY_RED_FLAGS } from "./pathology-red-flags.mjs";
import {
  PATHOLOGY_PAGE_UI,
  conditionPhrase,
  firstSentence,
} from "./pathology-page-ui.mjs";

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
  const items = urgentList.map((item) => `              <li>${escHtml(item)}</li>`).join("\n");
  return `    <section class="pathology-urgent-care space-medium">
      <div class="container">
        <div class="row">
          <div class="col-lg-10 col-md-10 col-sm-12 col-xs-12">
            <h2>${escHtml(ui.urgentTitle(name))}</h2>
            <p>${escHtml(ui.urgentLead)}</p>
            <ul>
${items}
            </ul>
            <p>${escHtml(ui.urgentClose)} <a href="${sitePath(lang, "condiciones")}">${escHtml(ui.urgentLinkLabel)}</a>.</p>
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
${buildFaqSection(pathology, lang)}
${buildRelatedSection(pathology, lang)}`;
}
