#!/usr/bin/env node
/**
 * Generate pathology detail pages (ES / EN / FR / PT) from pathology-content.mjs.
 * Run: node scripts/build-pathology-pages.mjs
 */
import {
  PATHOLOGIES,
  PATHOLOGY_DEFAULT_PUBLISHED_AT,
  PATHOLOGY_DEFAULT_UPDATED_AT,
  PATHOLOGY_STEMS,
  TECHNIQUE_LABELS,
  UI,
  pathologySeoTitle,
} from "./pathology-content.mjs";
import {
  absoluteUrl,
  HTML_LANG,
  SCHEMA_LANGUAGE,
  sitePath,
  SITE,
} from "./i18n-urls.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import { breadcrumbListSchema } from "./html-utils.mjs";
import { jsonLdScript, repoRoot, writeItemLangPages } from "./build-helpers.mjs";
import { ARTICLES_INDEX_UI } from "./articles-index-content.mjs";
import { PATHOLOGY_MEDICAL_METADATA } from "./pathology-medical-metadata.mjs";
import { PATHOLOGY_FAQS } from "./pathology-faq-content.mjs";
import {
  LOCALE,
  assetPrefixForLang,
  bodyFooterAndUiScripts,
  bodyShellTop,
  headFavicon,
  headCriticalCss,
  headJsClassScript,
  headLangDeferScripts,
  headSeoBlock,
  headStandardStylesheets,
  pageBreadcrumbSection,
  pageCaptionMarkup,
  pageHeaderSection,
  socialImageUrl,
} from "./page-shell.mjs";
import { FOUNDER } from "./site-contact.mjs";
import { BUSINESS_ID } from "./schema-local-business.mjs";
import { buildPathologyMain } from "./pathology-page-sections.mjs";

const ROOT = repoRoot(import.meta.url);

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

  const conditionSchema = { "@type": "MedicalCondition", name: data.h1 };
  if (medMeta?.icd10) {
    conditionSchema.code = { "@type": "MedicalCode", code: medMeta.icd10, codingSystem: "ICD-10" };
  }
  if (medMeta?.wikidata) conditionSchema.sameAs = medMeta.wikidata;
  if (possibleTreatments.length) conditionSchema.possibleTreatment = possibleTreatments;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": ["MedicalWebPage", "HealthTopicContent"],
    headline: data.h1,
    name: data.h1,
    description: data.metaDescription,
    image: imgUrl,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    about: conditionSchema,
    inLanguage: SCHEMA_LANGUAGE[lang],
    author: { "@type": "Person", name: FOUNDER.name, url: absoluteUrl(lang, "cv") },
    publisher: {
      "@type": "Organization",
      "@id": BUSINESS_ID,
      name: "Kinésica",
      logo: { "@type": "ImageObject", url: `${SITE}/images/logo.png` },
    },
    datePublished: pathology.publishedAt ?? PATHOLOGY_DEFAULT_PUBLISHED_AT,
    dateModified: pathology.updatedAt ?? pathology.publishedAt ?? PATHOLOGY_DEFAULT_UPDATED_AT,
  };

  const faqs = PATHOLOGY_FAQS[stem]?.[lang] || [];
  const faqSchemaScripts =
    faqs.length === 0
      ? ""
      : `${jsonLdScript({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "@id": `${canonical}#faq`,
          inLanguage: SCHEMA_LANGUAGE[lang],
          mainEntityOfPage: canonical,
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        })}\n`;

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
${jsonLdScript(breadcrumbSchema)}
${jsonLdScript(articleSchema)}
${faqSchemaScripts}</head>

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
${buildPathologyMain(pathology, lang)}
  </main>
${bodyFooterAndUiScripts(lang, p)}
</body>

</html>
`;
}

const written = writeItemLangPages(ROOT, PATHOLOGIES, (p) => p.stem, buildHtml);
console.log(`Done. ${written} pathology page(s). Stems: ${PATHOLOGY_STEMS.join(", ")}`);
