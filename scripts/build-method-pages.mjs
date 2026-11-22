#!/usr/bin/env node
/**
 * Generate method/technique pages (ES / EN / FR / PT) from methods-content.mjs.
 * Run: npm run build:methods
 */
import fs from "fs";
import path from "path";
import { METHOD_STEMS, METHOD_UI, METHODS } from "./methods-content.mjs";
import {
  absoluteUrl,
  HTML_LANG,
  SCHEMA_LANGUAGE,
  sitePath,
  SITE,
} from "./i18n-urls.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import {
  homePageBreadcrumbSchema,
  jsonLdScript,
  repoRoot,
  writeStemLangPages,
} from "./build-helpers.mjs";
import {
  LOCALE,
  assetPrefixForLang,
  bodyFooterAndUiScripts,
  bodyShellTop,
  ctaStripPlaceholder,
  headCriticalCss,
  headFavicon,
  headJsClassScript,
  headLangDeferScripts,
  headSeoBlock,
  headStandardStylesheets,
  pageBreadcrumbSection,
  pageCaptionMarkup,
  pageHeaderSection,
  socialImageUrl,
} from "./page-shell.mjs";
import {
  BUSINESS_ID,
  getMethodServiceCopy,
} from "./schema-local-business.mjs";
import { FOUNDER } from "./site-contact.mjs";
import { METHOD_FAQS } from "./method-faq-content.mjs";
import {
  buildMethodMain,
  methodTherapySchema,
} from "./method-page-sections.mjs";

const ROOT = repoRoot(import.meta.url);

function methodImageSrc(image, prefix) {
  const webpName = image.replace(/\.jpe?g$/i, ".webp");
  const fileName = fs.existsSync(path.join(ROOT, "images", webpName))
    ? webpName
    : image;
  return `${prefix}images/${fileName}`;
}

function buildHtml(stem, lang) {
  const method = METHODS[stem];
  const data = method?.[lang];
  const ui = METHOD_UI[lang];
  if (!data || !ui) {
    throw new Error(`Missing method copy: ${stem} / ${lang}`);
  }

  const service = getMethodServiceCopy(lang, stem);
  if (!service) {
    throw new Error(`Missing schema service copy: ${stem} / ${lang}`);
  }

  const p = assetPrefixForLang(lang);
  const canonical = absoluteUrl(lang, stem);
  const imgUrl = socialImageUrl(method.image);
  const pageImageSrc = methodImageSrc(method.image, p);
  const therapySchema = methodTherapySchema(lang, stem, service);
  const pageSchema = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    headline: data.h1,
    name: data.h1,
    description: data.metaDescription,
    image: imgUrl,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    inLanguage: SCHEMA_LANGUAGE[lang],
    about: {
      "@type": "MedicalTherapy",
      "@id": `${canonical}#therapy`,
      name: service.name,
      description: service.description,
      url: canonical,
    },
    author: {
      "@type": "Person",
      name: FOUNDER.name,
      url: absoluteUrl(lang, "cv"),
    },
    publisher: {
      "@type": "Organization",
      "@id": BUSINESS_ID,
      name: "Kinésica",
      logo: {
        "@type": "ImageObject",
        url: `${SITE}/images/logo.png`,
      },
    },
  };
  const methodFaqs = METHOD_FAQS[stem]?.[lang] || [];
  const faqSchema = methodFaqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        inLanguage: SCHEMA_LANGUAGE[lang],
        mainEntityOfPage: canonical,
        mainEntity: methodFaqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      }
    : null;

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
    title: data.metaTitle,
    description: data.metaDescription,
    type: "website",
    image: imgUrl,
    imageAlt: data.metaTitle,
    canonical,
  })}
${headStandardStylesheets(p)}  <script src="${p}partials/gtm-head.min.js" defer></script>
${jsonLdScript(homePageBreadcrumbSchema(lang, ui.homeLabel, data.breadcrumb, canonical))}
${jsonLdScript(therapySchema, { id: "kinesica-method-therapy" })}
${jsonLdScript(pageSchema)}
${faqSchema ? jsonLdScript(faqSchema) : ""}
</head>

<body>
${bodyShellTop(p)}${headerShellMarkup(lang, p)}
  <main id="main" tabindex="-1">
${pageHeaderSection(pageCaptionMarkup(data.breadcrumb))}
${pageBreadcrumbSection({
      homeHref: sitePath(lang, "index"),
      homeLabel: ui.homeLabel,
      activeLabel: data.breadcrumb,
    })}
${buildMethodMain(data, ui, pageImageSrc, lang, stem)}
  </main>
${ctaStripPlaceholder(lang, p)}
${bodyFooterAndUiScripts(lang, p)}
</body>

</html>
`;
}

const written = writeStemLangPages(ROOT, METHOD_STEMS, buildHtml);
console.log(`Done. ${written} method page(s). Stems: ${METHOD_STEMS.join(", ")}`);
