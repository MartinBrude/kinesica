#!/usr/bin/env node
/**
 * Generate pathology detail pages (ES / EN / FR / PT) from pathology-content.mjs.
 * Run: node scripts/build-pathology-pages.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  PATHOLOGIES,
  PATHOLOGY_DEFAULT_PUBLISHED_AT,
  PATHOLOGY_DEFAULT_UPDATED_AT,
  PATHOLOGY_RELATED,
  PATHOLOGY_STEMS,
  TECHNIQUE_LABELS,
  UI,
  pathologyForStem,
  pathologySeoTitle,
} from "./pathology-content.mjs";
import {
  absoluteUrl,
  HTML_LANG,
  repoPath,
  SCHEMA_LANGUAGE,
  sitePath,
  SITE,
} from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import { breadcrumbListSchema, escHtml } from "./html-utils.mjs";
import { ARTICLES_INDEX_UI } from "./articles-index-content.mjs";
import { PATHOLOGY_MEDICAL_METADATA } from "./pathology-medical-metadata.mjs";
import {
  PATHOLOGY_FAQS,
  PATHOLOGY_FAQ_UI,
} from "./pathology-faq-content.mjs";
import {
  LOCALE,
  assetPrefixForLang,
  bodyFooterAndUiScripts,
  bodyShellTop,
  ctaStripPlaceholder,
  headFavicon,
  headCriticalCss,
  headJsClassScript,
  headLangDeferScripts,
  headLangScripts,
  headSeoBlock,
  headStandardStylesheets,
  pageBreadcrumbSection,
  pageCaptionMarkup,
  pageHeaderSection,
  socialImageUrl,
} from "./page-shell.mjs";
import { FOUNDER } from "./site-contact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function techniqueHref(lang, techStem) {
  return sitePath(lang, techStem);
}

function buildRelatedSection(pathology, lang) {
  const ui = UI[lang];
  const relatedStems = PATHOLOGY_RELATED[pathology.stem];
  if (!relatedStems?.length) return "";

  const items = relatedStems
    .map((relatedStem) => {
      const related = pathologyForStem(relatedStem);
      if (!related?.[lang]) return "";
      const label = related[lang].breadcrumb;
      const href = sitePath(lang, relatedStem);
      return `<li><a href="${href}">${escHtml(label)}</a></li>`;
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

const PATHOLOGY_PAGE_UI = {
  es: {
    summaryTitle: "Respuesta breve",
    summaryLabel: "En esta página encontrarás qué es esta condición, qué señales suelen aparecer y cómo abordamos la evaluación y el tratamiento en Kinésica.",
    whatIsTitle: "¿Qué es?",
    symptomsTitle: "Síntomas y factores asociados",
    treatmentTitle: "Enfoque terapéutico",
    evaluationTitle: "Evaluación y seguimiento",
    urgentTitle: "Cuándo consultar de forma prioritaria",
    urgentLead:
      "Esta información es orientativa y no reemplaza una evaluación médica.",
    urgentList: [
      "Dolor intenso que no mejora con reposo relativo o empeora rápidamente.",
      "Pérdida de fuerza progresiva, alteraciones de sensibilidad o dificultad para caminar.",
      "Traumatismo reciente, fiebre, malestar general o síntomas nuevos no habituales.",
    ],
    urgentClose: "Si aparecen estos signos, consultá de forma prioritaria.",
    urgentLinkLabel: "Condiciones de uso y alcance informativo",
    authorTitle: "Autor y revisión profesional",
    authorText:
      "Contenido elaborado y revisado por Norberto Silvio Brude, kinesiólogo.",
    profileLabel: "Ver perfil profesional",
  },
  en: {
    summaryTitle: "Quick answer",
    summaryLabel:
      "This page explains what this condition is, which signs are common, and how assessment and treatment are approached at Kinésica.",
    whatIsTitle: "What is it?",
    symptomsTitle: "Symptoms and associated factors",
    treatmentTitle: "Treatment approach",
    evaluationTitle: "Assessment and follow-up",
    urgentTitle: "When to seek prompt medical care",
    urgentLead:
      "This information is educational and does not replace medical assessment.",
    urgentList: [
      "Severe pain that does not improve with relative rest or worsens quickly.",
      "Progressive weakness, sensory changes, or difficulty walking.",
      "Recent trauma, fever, general malaise, or new unusual symptoms.",
    ],
    urgentClose: "If these signs appear, seek prompt medical evaluation.",
    urgentLinkLabel: "Conditions of use and informational scope",
    authorTitle: "Author and professional review",
    authorText:
      "Content written and reviewed by Norberto Silvio Brude, physiotherapist.",
    profileLabel: "View professional profile",
  },
  fr: {
    summaryTitle: "Réponse rapide",
    summaryLabel:
      "Cette page explique ce qu'est cette pathologie, les signes fréquents et notre approche d'évaluation et de traitement chez Kinésica.",
    whatIsTitle: "Qu'est-ce que c'est ?",
    symptomsTitle: "Symptômes et facteurs associés",
    treatmentTitle: "Approche thérapeutique",
    evaluationTitle: "Évaluation et suivi",
    urgentTitle: "Quand consulter rapidement",
    urgentLead:
      "Ces informations sont indicatives et ne remplacent pas un avis médical.",
    urgentList: [
      "Douleur intense qui ne s'améliore pas avec le repos relatif ou qui s'aggrave rapidement.",
      "Perte de force progressive, troubles de la sensibilité ou difficulté à marcher.",
      "Traumatisme récent, fièvre, malaise général ou symptômes nouveaux inhabituels.",
    ],
    urgentClose: "En présence de ces signes, consultez rapidement.",
    urgentLinkLabel: "Conditions d'utilisation et portée informative",
    authorTitle: "Auteur et relecture professionnelle",
    authorText:
      "Contenu rédigé et relu par Norberto Silvio Brude, kinésithérapeute.",
    profileLabel: "Voir le profil professionnel",
  },
  pt: {
    summaryTitle: "Resposta rápida",
    summaryLabel:
      "Esta página explica o que é essa condição, quais sinais são comuns e como fazemos avaliação e tratamento na Kinésica.",
    whatIsTitle: "O que é?",
    symptomsTitle: "Sintomas e fatores associados",
    treatmentTitle: "Abordagem terapêutica",
    evaluationTitle: "Avaliação e acompanhamento",
    urgentTitle: "Quando procurar atendimento prioritário",
    urgentLead:
      "Este conteúdo é informativo e não substitui avaliação médica.",
    urgentList: [
      "Dor intensa que não melhora com repouso relativo ou piora rapidamente.",
      "Perda progressiva de força, alterações de sensibilidade ou dificuldade para caminhar.",
      "Trauma recente, febre, mal-estar geral ou sintomas novos incomuns.",
    ],
    urgentClose: "Se esses sinais aparecerem, procure avaliação médica prioritária.",
    urgentLinkLabel: "Condições de uso e escopo informativo",
    authorTitle: "Autoria e revisão profissional",
    authorText:
      "Conteúdo elaborado e revisado por Norberto Silvio Brude, fisioterapeuta.",
    profileLabel: "Ver perfil profissional",
  },
};

function buildUrgentCareSection(lang) {
  const ui = PATHOLOGY_PAGE_UI[lang];
  const conditionsHref = sitePath(lang, "condiciones");
  const items = ui.urgentList
    .map((item) => `              <li>${escHtml(item)}</li>`)
    .join("\n");
  return `    <section class="pathology-urgent-care space-medium">
      <div class="container">
        <div class="row">
          <div class="col-lg-10 col-md-10 col-sm-12 col-xs-12">
            <h2>${escHtml(ui.urgentTitle)}</h2>
            <p>${escHtml(ui.urgentLead)}</p>
            <ul>
${items}
            </ul>
            <p>${escHtml(ui.urgentClose)} <a href="${conditionsHref}">${escHtml(ui.urgentLinkLabel)}</a>.</p>
          </div>
        </div>
      </div>
    </section>`;
}

function buildAuthorReviewSection(lang) {
  const ui = PATHOLOGY_PAGE_UI[lang];
  const cvHref = sitePath(lang, "cv");
  return `    <section class="pathology-author-review">
      <div class="container">
        <div class="row">
          <div class="col-lg-10 col-md-10 col-sm-12 col-xs-12">
            <h2>${escHtml(ui.authorTitle)}</h2>
            <p>${escHtml(ui.authorText)} <a href="${cvHref}">${escHtml(ui.profileLabel)}</a>.</p>
          </div>
        </div>
      </div>
    </section>`;
}

function buildMain(pathology, lang) {
  const ui = UI[lang];
  const pageUi = PATHOLOGY_PAGE_UI[lang];
  const data = pathology[lang];
  const techItems = (pathology.techniques || [])
    .map((t) => {
      const label = TECHNIQUE_LABELS[t][lang];
      const href = techniqueHref(lang, t);
      return `<li><a href="${href}">${escHtml(label)}</a></li>`;
    })
    .join("\n              ");

  const p0 = data.paragraphs[0] || "";
  const p1 = data.paragraphs[1] || "";
  const p2 = data.paragraphs[2] || "";
  const p3 = data.paragraphs[3] || "";
  const p4 = data.paragraphs[4] || "";
  const complications = data.complications
    .map((c) => `                <li>${c}</li>`)
    .join("\n");

  return `    <section class="content pathology-page">
      <div class="container">
        <div class="row">
          <div class="col-lg-8 col-md-8 col-sm-12 col-xs-12">
            <p class="pathology-eyebrow">${ui.eyebrow}</p>
            <h1>${data.h1}</h1>
            <section class="pathology-answer-first" aria-labelledby="pathology-summary-${pathology.stem}">
              <h2 id="pathology-summary-${pathology.stem}">${escHtml(pageUi.summaryTitle)}</h2>
              <p class="lead">${data.lead}</p>
              <p>${escHtml(pageUi.summaryLabel)}</p>
            </section>
            <section aria-labelledby="pathology-what-is-${pathology.stem}">
              <h2 id="pathology-what-is-${pathology.stem}">${escHtml(pageUi.whatIsTitle)}</h2>
              <p>${p0}</p>
            </section>
            <section aria-labelledby="pathology-symptoms-${pathology.stem}">
              <h2 id="pathology-symptoms-${pathology.stem}">${escHtml(pageUi.symptomsTitle)}</h2>
              <p>${p1}</p>
              <p>${p2}</p>
            </section>
            <section aria-labelledby="pathology-treatment-${pathology.stem}">
              <h2 id="pathology-treatment-${pathology.stem}">${escHtml(pageUi.treatmentTitle)}</h2>
              <p>${p3}</p>
            </section>
            <section aria-labelledby="pathology-evaluation-${pathology.stem}">
              <h2 id="pathology-evaluation-${pathology.stem}">${escHtml(pageUi.evaluationTitle)}</h2>
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
${buildUrgentCareSection(lang)}
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
${buildAuthorReviewSection(lang)}
${buildFaqSection(pathology, lang)}
${buildRelatedSection(pathology, lang)}`;
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

function buildHtml(pathology, lang) {
  const ui = UI[lang];
  const data = pathology[lang];
  const stem = pathology.stem;
  const p = assetPrefixForLang(lang);
  const canonical = absoluteUrl(lang, stem);
  const imgUrl = socialImageUrl(pathology.image);
  const articlesUi = ARTICLES_INDEX_UI[lang];
  const breadcrumbSchema = breadcrumbListSchema([
    { name: ui.homeLabel, item: absoluteUrl(lang, "index") },
    { name: articlesUi.breadcrumb, item: absoluteUrl(lang, "articulos") },
    { name: data.breadcrumb, item: canonical },
  ]);

  const medMeta = PATHOLOGY_MEDICAL_METADATA[stem];
  const possibleTreatments = (pathology.techniques || []).map((t) => ({
    "@type": "MedicalTherapy",
    name: TECHNIQUE_LABELS[t]?.[lang] || t,
    url: absoluteUrl(lang, t),
  }));

  const conditionSchema = {
    "@type": "MedicalCondition",
    name: data.h1,
  };
  if (medMeta?.icd10) {
    conditionSchema.code = {
      "@type": "MedicalCode",
      code: medMeta.icd10,
      codingSystem: "ICD-10",
    };
  }
  if (medMeta?.wikidata) {
    conditionSchema.sameAs = medMeta.wikidata;
  }
  if (possibleTreatments.length) {
    conditionSchema.possibleTreatment = possibleTreatments;
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    headline: data.h1,
    name: data.h1,
    description: data.metaDescription,
    image: imgUrl,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    about: conditionSchema,
    inLanguage: SCHEMA_LANGUAGE[lang],
    author: {
      "@type": "Person",
      name: FOUNDER.name,
      url: absoluteUrl(lang, "cv"),
    },
    reviewedBy: {
      "@type": "Person",
      name: FOUNDER.name,
      url: absoluteUrl(lang, "cv"),
    },
    publisher: {
      "@type": "Organization",
      name: "Kinésica",
      logo: {
        "@type": "ImageObject",
        url: `${SITE}/images/logo.png`,
      },
    },
    datePublished: pathology.publishedAt ?? PATHOLOGY_DEFAULT_PUBLISHED_AT,
    dateModified:
      pathology.updatedAt ??
      pathology.publishedAt ??
      PATHOLOGY_DEFAULT_UPDATED_AT,
  };

  const faqs = PATHOLOGY_FAQS[stem]?.[lang] || [];
  let faqSchemaScript = "";
  if (faqs.length) {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${canonical}#faq`,
      inLanguage: SCHEMA_LANGUAGE[lang],
      mainEntityOfPage: canonical,
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.a,
        },
      })),
    };
    faqSchemaScript = `  <script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 6).replace(/^/gm, "      ")}\n    </script>\n`;
  }

  const seoTitle = pathologySeoTitle(pathology, lang);

  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">

<head>
  <meta charset="utf-8" />
${headFavicon(p)}${headJsClassScript()}${headCriticalCss(p)}  <meta http-equiv="content-language" content="${LOCALE[lang]}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#005f99" />
${headLangDeferScripts(p)}${headSeoBlock({
    lang,
    stem,
    title: seoTitle,
    description: data.metaDescription,
    type: "article",
    image: imgUrl,
    imageAlt: seoTitle,
    canonical,
  })}
${headStandardStylesheets(p)}  <script src="${p}partials/gtm-head.min.js" defer></script>
  <script type="application/ld+json">
${JSON.stringify(breadcrumbSchema, null, 6).replace(/^/gm, "      ")}
    </script>
  <script type="application/ld+json">
${JSON.stringify(articleSchema, null, 6).replace(/^/gm, "      ")}
    </script>
${faqSchemaScript}</head>

<body>
${bodyShellTop(p)}${headerShellMarkup(lang, p)}
  <main id="main" tabindex="-1">
${pageHeaderSection(pageCaptionMarkup(data.breadcrumb))}
${pageBreadcrumbSection({
      homeHref: sitePath(lang, "index"),
      homeLabel: ui.homeLabel,
      parentHref: sitePath(lang, "articulos"),
      parentLabel: articlesUi.breadcrumb,
      activeLabel: data.breadcrumb,
    })}
${buildMain(pathology, lang)}
  </main>
${ctaStripPlaceholder(lang, p)}
${bodyFooterAndUiScripts(lang, p)}
</body>

</html>
`;
}

let written = 0;
for (const pathology of PATHOLOGIES) {
  for (const lang of LANG_CODES) {
    const rel = repoPath(lang, pathology.stem);
    const full = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buildHtml(pathology, lang));
    written++;
    console.log("wrote:", rel);
  }
}

console.log(`Done. ${written} pathology page(s). Stems: ${PATHOLOGY_STEMS.join(", ")}`);
