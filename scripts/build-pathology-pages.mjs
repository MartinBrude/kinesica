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
import { absoluteUrl, repoPath, sitePath } from "./i18n-urls.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_V = JSON.parse(
  fs.readFileSync(path.join(ROOT, "css/.asset-version.json"), "utf8"),
).style;

const LANGS = ["es", "en", "fr"];
const LOCALE = { es: "es-AR", en: "en", fr: "fr" };
const OG_LOCALE = { es: "es_AR", en: "en_US", fr: "fr_FR" };
const SCHEDULE = {
  es: "Lunes a viernes: <strong>10 a 20 h</strong>",
  en: "Monday to Friday: <strong>10 a.m. to 8 p.m.</strong>",
  fr: "Lundi au vendredi : <strong>10 h à 20 h</strong>",
};

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function prefix(lang) {
  if (lang === "es") return "";
  return "../";
}

function pageHref(lang, stem) {
  return sitePath(lang, stem).replace(/^\//, "") || "index.html";
}

function techniqueHref(lang, techStem) {
  return sitePath(lang, techStem);
}

function ctaPlaceholder(lang) {
  const p = prefix(lang);
  const l = lang === "es" ? "es" : lang;
  return `  <div id="site-cta-strip-root" data-cta-lang="${l}"></div>
  <script src="${p}partials/cta-strip-${l}.min.js"></script>
  <script src="${p}js/cta-strip-include.min.js"></script>`;
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
      `  <link rel="alternate" hreflang="${l === "es" ? "es" : l}" href="${absoluteUrl(l, stem)}" />`,
  ).join("\n");
  const altLocales = LANGS.filter((l) => l !== lang)
    .map((l) => `  <meta property="og:locale:alternate" content="${OG_LOCALE[l]}" />`)
    .join("\n");

  const langFlags = LANGS.map((l) => {
    const flag = l === "es" ? "es.svg" : l === "en" ? "gb.svg" : "fr.svg";
    const alt =
      l === "es"
        ? "bandera española"
        : l === "en"
          ? "bandera inglesa"
          : "bandera francesa";
    return `              <li>
                <a href="${sitePath(l, stem)}"><img src="${p}images/${flag}" alt="${alt}" width="24" height="16" /></a>
              </li>`;
  }).join("\n");

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
    inLanguage: lang === "es" ? "es" : lang,
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
<html lang="${lang === "es" ? "es" : lang}">

<head>
  <link rel="icon" type="image/svg" href="${p}images/favicon.svg" />
  <link rel="apple-touch-icon" href="${p}images/apple-touch-icon.png" />
  <meta charset="utf-8" />
  <meta http-equiv="content-language" content="${LOCALE[lang]}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#005f99" />
  <script src="${p}js/lang-routes.min.js"></script>
  <script src="${p}js/lang-preference.min.js"></script>
  <script src="${p}js/redirect.min.js"></script>
  <meta name="description" content="${esc(data.metaDescription)}" />
  <title>${esc(data.title)}</title>
  <link href="${p}css/bootstrap.min.css" rel="stylesheet" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preconnect" href="https://www.googletagmanager.com" />
  <link href="https://fonts.googleapis.com/css?family=Roboto:300,300i,400,400i,500,500i,700,700i&display=swap" rel="stylesheet"
    media="print" onload="this.media='all'" />
  <noscript>
    <link href="https://fonts.googleapis.com/css?family=Roboto:300,300i,400,400i,500,500i,700,700i&display=swap" rel="stylesheet" />
  </noscript>
  <link href="${p}css/font-awesome.min.css" rel="stylesheet" media="print" onload="this.media='all'" />
  <noscript><link href="${p}css/font-awesome.min.css" rel="stylesheet" /></noscript>
  <link href="${p}css/style.min.css?v=${ASSET_V}" rel="stylesheet" />
  <link href="${p}css/whatsapp.min.css?v=${ASSET_V}" rel="stylesheet" media="print" onload="this.media='all'" />
  <noscript><link href="${p}css/whatsapp.min.css?v=${ASSET_V}" rel="stylesheet" /></noscript>
  <link rel="canonical" href="${canonical}" />
${hreflang}
  <link rel="alternate" hreflang="x-default" href="${absoluteUrl("es", stem)}" />
  <meta property="og:title" content="${esc(data.title)}" />
  <meta property="og:description" content="${esc(data.metaDescription)}" />
  <meta property="og:image" content="${imgUrl}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Kinésica" />
  <meta property="og:locale" content="${OG_LOCALE[lang]}" />
${altLocales}
  <script src="${p}partials/gtm-head.min.js" defer></script>
  <script type="application/ld+json">
${JSON.stringify(breadcrumbSchema, null, 6).replace(/^/gm, "      ")}
    </script>
  <script type="application/ld+json">
${JSON.stringify(articleSchema, null, 6).replace(/^/gm, "      ")}
    </script>
</head>

<body>
  <div id="site-skip-link-root"></div>
  <script src="${p}partials/skip-link.min.js" defer></script>
  <script src="${p}js/skip-link-include.min.js" defer></script>
  <div id="site-gtm-body-root"></div>
  <script src="${p}partials/gtm-body.min.js" defer></script>
  <script src="${p}js/gtm-body-include.min.js" defer></script>
  <div class="header-top">
    <div class="container">
      <div class="row">
        <div class="col-lg-4 col-md-4 col-sm-4 col-xs-12">
          <span class="text-block time-block">
            <span class="time-text">${SCHEDULE[lang]}</span>
          </span>
        </div>
        <div class="col-lg-8 col-md-8 col-sm-8 col-xs-12">
          <div class="top-text">
            <ul class="lang-switcher">
${langFlags}
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
  <header class="header">
    <div class="container">
      <div class="row">
        <div class="col-lg-4 col-md-4 col-sm-12 col-xs-12">
          <a href="${sitePath(lang, "index")}"><img src="${p}images/logo.svg" alt="logo kinesica" width="224" height="64"
              loading="eager" /></a>
        </div>
        <div class="col-lg-8 col-md-4 col-sm-12 col-xs-12">
          <nav class="navigation">
            <div id="navigation" class="nav navbar-nav navbar-right" data-nav-inject="true"></div>
          </nav>
        </div>
      </div>
    </div>
  </header>
  <main id="main" tabindex="-1">
    <section class="page-header">
      <div class="container">
        <div class="row">
          <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
            <div class="page-caption"></div>
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
${ctaPlaceholder(lang)}
  <div id="site-footer-root" data-footer-lang="${lang}"></div>
  <script src="${p}js/site-config.min.js" defer></script>
  <script src="${p}partials/nav-${lang === "es" ? "es" : lang}.min.js"></script>
  <script src="${p}js/nav-include.min.js"></script>
  <script src="${p}partials/footer-${lang === "es" ? "es" : lang}.min.js"></script>
  <script src="${p}js/footer-include.min.js"></script>
  <div id="site-whatsapp-root" data-whatsapp-lang="${lang}"></div>
  <script src="${p}partials/whatsapp-float-${lang === "es" ? "es" : lang}.min.js"></script>
  <script src="${p}js/whatsapp-float-include.min.js"></script>
  <script src="${p}js/whatsapp-logic.min.js"></script>
  <script src="${p}js/page-header-word.min.js" defer></script>
  <script src="${p}js/mobile-nav.min.js" defer></script>
  <script src="${p}js/ui-reveal.min.js" defer></script>
  <script src="${p}js/sticky-header.min.js" defer></script>
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
