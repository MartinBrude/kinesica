/**
 * Section and schema helpers for method/technique pages.
 */
import { absoluteUrl, HTML_LANG } from "./i18n-urls.mjs";
import { escHtml } from "./html-utils.mjs";
import { BUSINESS_ID } from "./schema-local-business.mjs";
import { METHOD_FAQ_UI, METHOD_FAQS } from "./method-faq-content.mjs";

const METHOD_PAGE_UI = {
  es: { whatIsTitle: (name) => `¿Qué es ${name}?` },
  en: { whatIsTitle: (name) => `What is ${name}?` },
  fr: { whatIsTitle: (name) => `Qu'est-ce que ${name} ?` },
  pt: { whatIsTitle: (name) => `O que é ${name}?` },
};

export function methodTherapySchema(lang, stem, service) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalTherapy",
    "@id": `${absoluteUrl(lang, stem)}#therapy`,
    name: service.name,
    description: service.description,
    url: absoluteUrl(lang, stem),
    inLanguage: HTML_LANG[lang],
    provider: {
      "@type": "MedicalClinic",
      "@id": BUSINESS_ID,
      name: "Kinésica",
    },
    areaServed: {
      "@type": "Place",
      name: "Palermo, Ciudad Autónoma de Buenos Aires",
    },
  };
}

function methodPhrase(data) {
  const raw = String(data.breadcrumb || data.h1 || "").trim();
  if (!raw) return "";
  if (raw.length <= 5 && raw === raw.toUpperCase()) return raw;
  const cut = raw.split(/[–—:-]/)[0].trim();
  if (cut.length <= 5 && cut === cut.toUpperCase()) return cut;
  return cut.charAt(0).toLowerCase() + cut.slice(1);
}

function buildFaqSection(stem, lang) {
  const faqs = METHOD_FAQS[stem]?.[lang];
  if (!faqs?.length) return "";
  const uiTitle = METHOD_FAQ_UI[lang]?.title || "Preguntas frecuentes";
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

  return `    <section class="pathology-faq space-medium" id="faq">
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

export function buildMethodMain(data, ui, imageSrc, lang, stem) {
  const pageUi = METHOD_PAGE_UI[lang];
  const name = methodPhrase(data);
  const blocks = data.blocks ?? [];
  const bodyBlocks =
    blocks[0]?.type === "h2"
      ? blocks
      : [{ type: "h2", text: pageUi.whatIsTitle(name) }, ...blocks];
  const rendered = bodyBlocks
    .map((block) =>
      block.type === "h2"
        ? `            <h2>${escHtml(block.text)}</h2>`
        : `            <p>${escHtml(block.text)}</p>`,
    )
    .join("\n");

  return `    <section class="content method-page">
      <div class="container">
        <div class="method-page-layout">
          <div class="method-page-intro">
            <p class="method-eyebrow">${escHtml(ui.eyebrow)}</p>
            <h1>${escHtml(data.h1)}</h1>
            <section class="method-answer-first">
              <p class="lead">${escHtml(data.lead)}</p>
            </section>
          </div>
          <figure class="method-figure">
            <img src="${escHtml(imageSrc)}" alt="${escHtml(data.h1)}" title="${escHtml(data.h1)}" width="1536" height="1024" decoding="async" fetchpriority="high" />
          </figure>
          <div class="method-page-body">
${rendered}
          </div>
        </div>
      </div>
    </section>
${buildFaqSection(stem, lang)}`;
}
