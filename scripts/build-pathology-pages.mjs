#!/usr/bin/env node
/**
 * Generate pathology detail pages (ES / EN / FR) from pathology-content.mjs.
 * Run: node scripts/build-pathology-pages.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  PATHOLOGIES,
  PATHOLOGY_STEMS,
  TECHNIQUE_LABELS,
  UI,
} from "./pathology-content.mjs";
import {
  absoluteUrl,
  HREFLANG,
  HTML_LANG,
  repoPath,
  SCHEMA_LANGUAGE,
  sitePath,
} from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import {
  OG_LOCALE,
  LOCALE,
  assetPrefixForLang,
  bodyFooterAndUiScripts,
  bodyShellTop,
  ctaStripPlaceholder,
  headFavicon,
  headLangScripts,
  headStandardStylesheets,
} from "./page-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = LANG_CODES;

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Título decorativo en .page-header (igual que métodos / RPG). */
function pageCaptionMarkup(label) {
  const longClass = label.length > 11 ? " page-header-word--long" : "";
  return `            <div class="page-caption">
              <span class="page-header-word${longClass}" aria-hidden="true">${esc(label)}</span>
            </div>`;
}

function prefix(lang) {
  return assetPrefixForLang(lang);
}

function pageHref(lang, stem) {
  return sitePath(lang, stem).replace(/^\//, "") || "index.html";
}

function techniqueHref(lang, techStem) {
  return sitePath(lang, techStem);
}

function buildMain(pathology, lang) {
  const ui = UI[lang];
  const data = pathology[lang];
  const techItems = (pathology.techniques || [])
    .map((t) => {
      const label = TECHNIQUE_LABELS[t][lang];
      const href = techniqueHref(lang, t);
      return `<li><a href="${href}">${esc(label)}</a></li>`;
    })
    .join("\n              ");

  const paragraphs = data.paragraphs
    .map((para) => `            <p>${para}</p>`)
    .join("\n");
  const complications = data.complications
    .map((c) => `                <li>${c}</li>`)
    .join("\n");

  return `    <section class="content pathology-page">
      <div class="container">
        <div class="row">
          <div class="col-lg-8 col-md-8 col-sm-12 col-xs-12">
            <p class="pathology-eyebrow">${ui.eyebrow}</p>
            <h1>${data.h1}</h1>
            <p class="lead">${data.lead}</p>
${paragraphs}
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
    </section>`;
}

function buildHtml(pathology, lang) {
  const ui = UI[lang];
  const data = pathology[lang];
  const stem = pathology.stem;
  const p = prefix(lang);
  const selfPath = pageHref(lang, stem);
  const homePath = sitePath(lang, "index");
  const canonical = absoluteUrl(lang, stem);
  const imgUrl = `https://www.kinesica.com.ar/images/${pathology.image}`;
  const hreflang = LANGS.map(
    (l) =>
      `  <link rel="alternate" hreflang="${HREFLANG[l]}" href="${absoluteUrl(l, stem)}" />`,
  ).join("\n");
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: ui.homeLabel,
        item: absoluteUrl(lang, "index"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: data.breadcrumb,
        item: canonical,
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.h1,
    description: data.metaDescription,
    image: imgUrl,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    inLanguage: SCHEMA_LANGUAGE[lang],
    author: { "@type": "Person", name: "Norberto Silvio Brude" },
    publisher: {
      "@type": "Organization",
      name: "Kinésica",
      logo: {
        "@type": "ImageObject",
        url: "https://www.kinesica.com.ar/images/logo.svg",
      },
    },
    datePublished: "2024-06-01",
    dateModified: new Date().toISOString().slice(0, 10),
  };

  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">

<head>
${headFavicon(p)}  <meta charset="utf-8" />
  <meta http-equiv="content-language" content="${LOCALE[lang]}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#005f99" />
${headLangScripts(p)}  <meta name="description" content="${esc(data.metaDescription)}" />
  <title>${esc(data.title)}</title>
${headStandardStylesheets(p)}  <link rel="canonical" href="${canonical}" />
${hreflang}
  <link rel="alternate" hreflang="x-default" href="${absoluteUrl("es", stem)}" />
  <meta property="og:title" content="${esc(data.title)}" />
  <meta property="og:description" content="${esc(data.metaDescription)}" />
  <meta property="og:image" content="${imgUrl}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Kinésica" />
  <meta property="og:locale" content="${OG_LOCALE[lang]}" />
  <script src="${p}partials/gtm-head.min.js" defer></script>
  <script type="application/ld+json">
${JSON.stringify(breadcrumbSchema, null, 6).replace(/^/gm, "      ")}
    </script>
  <script type="application/ld+json">
${JSON.stringify(articleSchema, null, 6).replace(/^/gm, "      ")}
    </script>
</head>

<body>
${bodyShellTop(p)}${headerShellMarkup(lang, p)}
  <main id="main" tabindex="-1">
    <section class="page-header">
      <div class="container">
        <div class="row">
          <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
${pageCaptionMarkup(data.breadcrumb)}
          </div>
        </div>
      </div>
    </section>
    <section class="page-breadcrumb">
      <div class="container">
        <div class="col-lg-12">
          <ol class="breadcrumb">
            <li><a href="${sitePath(lang, "index")}">${ui.homeLabel}</a></li>
            <li class="active">${data.breadcrumb}</li>
          </ol>
        </div>
      </div>
    </section>
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
  for (const lang of LANGS) {
    const rel = repoPath(lang, pathology.stem);
    const full = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buildHtml(pathology, lang));
    written++;
    console.log("wrote:", rel);
  }
}

console.log(`Done. ${written} pathology page(s). Stems: ${PATHOLOGY_STEMS.join(", ")}`);
