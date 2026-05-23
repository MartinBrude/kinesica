#!/usr/bin/env node
/**
 * Generate cv.html, en/cv.html, fr/cv.html from scripts/cv-content.mjs
 * Run: node scripts/build-cv-html.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { CV } from "./cv-content.mjs";
import {
  SITE,
  absoluteUrl,
  HREFLANG,
  HTML_LANG,
  repoPath,
} from "./i18n-urls.mjs";
import { headerShellMarkup } from "./header-shell.mjs";

const require = createRequire(import.meta.url);
const { toMinPath } = require("../assets.config.cjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CV_EMAIL = "norberto1712@gmail.com";

/** Ruta de producción (.min) con prefijo en/ o fr/. */
function asset(prefix, rel) {
  return `${prefix}${toMinPath(rel)}`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderJobs(data) {
  return data.jobs
    .map((job) => {
      const bullets = (job.bullets || [])
        .map((b) => `<li>${b}</li>`)
        .join("\n              ");
      return `<article class="cv-job">
              <h3>${job.title}</h3>
              ${job.dates ? `<p class="cv-dates">${esc(job.dates)}</p>` : ""}
              ${job.intro ? `<p class="cv-intro">${esc(job.intro)}</p>` : ""}
              ${
                job.keyPoints
                  ? `<p class="cv-key-label">${esc(data.keyLabel)}</p>`
                  : ""
              }
              ${bullets ? `<ul>${bullets}</ul>` : ""}
            </article>`;
    })
    .join("\n            ");
}

function renderBody(data) {
  const methods = data.methods.map((m) => `<li>${esc(m)}</li>`).join("\n              ");
  const courses = data.courses
    .map(([y, t]) => `<li><span class="year">${esc(y)}</span> – ${t}</li>`)
    .join("\n              ");

  return `<section class="cv-body">
        <div class="container">
          <div class="cv-grid">
            <aside class="cv-sidebar">
              <div class="cv-panel">
                <h2>${esc(data.methodsTitle)}</h2>
                <ul>${methods}</ul>
              </div>
              <div class="cv-panel">
                <h2>${esc(data.coursesTitle)}</h2>
                <ul class="cv-courses">${courses}</ul>
              </div>
            </aside>
            <div class="cv-main">
              <div class="cv-panel">
                <h2>${esc(data.summaryTitle)}</h2>
                <p class="cv-summary">${esc(data.summary)}</p>
              </div>
              <div class="cv-jobs">
                <h2>${esc(data.experienceTitle)}</h2>
                ${renderJobs(data)}
              </div>
            </div>
          </div>
        </div>
      </section>`;
}

function buildPage(lang, data) {
  const isEs = lang === "es";
  const prefix = isEs ? "" : "../";
  const home = isEs ? "/" : `/${lang}/`;
  const cvPath = isEs ? "/cv.html" : `/${lang}/cv.html`;
  const canonical = absoluteUrl(lang, "cv");
  const ogLocale =
    lang === "es" ? "es_AR" : lang === "en" ? "en_US" : "fr_FR";

  const hreflangs = ["es", "en", "fr"]
    .map(
      (l) =>
        `  <link rel="alternate" hreflang="${HREFLANG[l]}" href="${absoluteUrl(l, "cv")}" />`,
    )
    .join("\n");

  const personSchema = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Norberto Silvio Brude",
      jobTitle: data.role,
      email: CV_EMAIL,
      telephone: "+54-11-6156-4311",
      url: canonical,
      image: `${SITE}/images/noberto-brude-kinesiologo-osteopata.jpg`,
      worksFor: {
        "@type": "MedicalClinic",
        name: "Kinésica",
        url: absoluteUrl(lang, "index"),
      },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Buenos Aires",
        addressCountry: "AR",
      },
    },
    null,
    2
  );

  const breadcrumbSchema = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: data.homeName,
          item: absoluteUrl(lang, "index"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: data.breadcrumb,
          item: canonical,
        },
      ],
    },
    null,
    2
  );

  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">

<head>
  <meta charset="utf-8" />
  <meta http-equiv="content-language" content="${HTML_LANG[lang]}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#005f99" />
  <meta name="description" content="${esc(data.description)}" />
  <title>${esc(data.title)}</title>
  <link rel="icon" type="image/svg" href="${prefix}images/favicon.svg" />
  <link rel="canonical" href="${canonical}" />
${hreflangs}
  <link rel="alternate" hreflang="x-default" href="${absoluteUrl("es", "cv")}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css?family=Roboto:300,300i,400,400i,500,500i,700,700i" rel="stylesheet" />
  <link href="${prefix}css/bootstrap.min.css" rel="stylesheet" />
  <link href="${prefix}css/font-awesome.min.css" rel="stylesheet" />
  <link href="${asset(prefix, "css/style.css")}" rel="stylesheet" />
  <link href="${asset(prefix, "css/cv.css")}" rel="stylesheet" />
  <link rel="stylesheet" href="${asset(prefix, "css/whatsapp.css")}" />
  <meta property="og:title" content="${esc(data.title)}" />
  <meta property="og:description" content="${esc(data.description)}" />
  <meta property="og:image" content="${SITE}/images/noberto-brude-kinesiologo-osteopata.jpg" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Kinésica" />
  <meta property="og:locale" content="${ogLocale}" />
  <script src="${asset(prefix, "partials/gtm-head.js")}"></script>
  <script src="${asset(prefix, "js/site-config.js")}"></script>
  <script type="application/ld+json">${personSchema}</script>
  <script type="application/ld+json">${breadcrumbSchema}</script>
</head>

<body>
  <div id="site-gtm-body-root"></div>
  <script src="${asset(prefix, "partials/gtm-body.js")}"></script>
  <script src="${asset(prefix, "js/gtm-body-include.js")}"></script>
  <div id="site-skip-link-root"></div>
  <script src="${asset(prefix, "partials/skip-link.js")}"></script>
  <script src="${asset(prefix, "js/skip-link-include.js")}"></script>
${headerShellMarkup(lang, prefix)}
  <main id="main" class="cv-page" tabindex="-1">
    <section class="cv-hero">
      <div class="container">
        <div class="cv-hero-inner">
          <img src="${prefix}images/noberto-brude-kinesiologo-osteopata.jpg" alt="Norberto S. Brude" class="cv-photo" width="140" height="140" loading="eager" />
          <div class="cv-hero-text">
            <h1>Norberto S. Brude</h1>
            <p class="cv-role">${esc(data.role)}</p>
            <ul class="cv-contact">
              <li><a href="mailto:${CV_EMAIL}">${CV_EMAIL}</a></li>
              <li><a href="https://wa.me/5491161564311" class="dynamic-whatsapp-url" target="_blank" rel="noopener noreferrer">(+54) 1161564311</a></li>
              <li>${esc(data.location)}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
    ${renderBody(data)}
  <div id="site-cta-strip-root" data-cta-lang="${lang}"></div>
  <script src="${asset(prefix, `partials/cta-strip-${lang}.js`)}"></script>
  <script src="${asset(prefix, "js/cta-strip-include.js")}"></script>
  </main>
  <div id="site-footer-root" data-footer-lang="${lang}"></div>
  <script src="${asset(prefix, "js/site-config.js")}"></script>
  <script src="${asset(prefix, `partials/footer-${lang}.js`)}"></script>
  <script src="${asset(prefix, "js/footer-include.js")}"></script>
  <div id="site-whatsapp-root" data-whatsapp-lang="${lang}"></div>
  <script src="${asset(prefix, `partials/whatsapp-float-${lang}.js`)}"></script>
  <script src="${asset(prefix, "js/whatsapp-float-include.js")}"></script>
  <script src="${asset(prefix, "js/mobile-nav.js")}" defer></script>
  <script src="${asset(prefix, "js/ui-reveal.js")}" defer></script>
  <script src="${asset(prefix, "js/sticky-header.js")}" defer></script>
  <script src="${asset(prefix, "js/whatsapp-logic.js")}"></script>
  <script src="${asset(prefix, "js/lang-routes.js")}"></script>
  <script src="${asset(prefix, "js/lang-preference.js")}"></script>
</body>

</html>
`;
}

for (const lang of ["es", "en", "fr"]) {
  const out = path.join(ROOT, repoPath(lang, "cv"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildPage(lang, CV[lang]));
  console.log("Wrote", out);
}
