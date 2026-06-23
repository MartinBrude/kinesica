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
import { SITE, absoluteUrl, HTML_LANG, repoPath } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import { breadcrumbListSchema, escHtml } from "./html-utils.mjs";
import {
  LOCALE,
  assetPrefixForLang,
  bodyFooterAndUiScripts,
  bodyShellTop,
  headCriticalCss,
  headFavicon,
  headJsClassScript,
  headLangDeferScripts,
  headSeoBlock,
  headStandardStylesheets,
  syncCssLink,
} from "./page-shell.mjs";
import { langBundlePath } from "./js-bundles.mjs";
import { partialLang } from "./languages.mjs";

const require = createRequire(import.meta.url);
const { toMinPath } = require("../assets.config.cjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CV_EMAIL = "norberto1712@gmail.com";

/** Ruta de producción (.min) con prefijo en/ o fr/. */
function asset(prefix, rel) {
  return `${prefix}${toMinPath(rel)}`;
}

function renderJobs(data) {
  return data.jobs
    .map((job) => {
      const bullets = (job.bullets || [])
        .map((b) => `<li>${b}</li>`)
        .join("\n              ");
      return `<article class="cv-job">
              <h3>${job.title}</h3>
              ${job.dates ? `<p class="cv-dates">${escHtml(job.dates)}</p>` : ""}
              ${job.intro ? `<p class="cv-intro">${escHtml(job.intro)}</p>` : ""}
              ${
                job.keyPoints
                  ? `<p class="cv-key-label">${escHtml(data.keyLabel)}</p>`
                  : ""
              }
              ${bullets ? `<ul>${bullets}</ul>` : ""}
            </article>`;
    })
    .join("\n            ");
}

function renderMethods(methods) {
  return methods
    .map((entry) => {
      const item = typeof entry === "string" ? { label: entry } : entry;
      const label = escHtml(item.label);
      if (item.stem) {
        return `<li><a href="${escHtml(item.stem)}.html">${label}</a></li>`;
      }
      return `<li>${label}</li>`;
    })
    .join("\n              ");
}

function renderBody(data) {
  const methods = renderMethods(data.methods);
  const courses = data.courses
    .map(([y, t]) => `<li><span class="year">${escHtml(y)}</span> – ${t}</li>`)
    .join("\n              ");

  return `<section class="cv-body">
        <div class="container">
          <div class="cv-grid">
            <aside class="cv-sidebar">
              <div class="cv-panel">
                <h2>${escHtml(data.methodsTitle)}</h2>
                <ul>${methods}</ul>
              </div>
              <div class="cv-panel">
                <h2>${escHtml(data.coursesTitle)}</h2>
                <ul class="cv-courses">${courses}</ul>
              </div>
            </aside>
            <div class="cv-main">
              <div class="cv-panel">
                <h2>${escHtml(data.summaryTitle)}</h2>
                <p class="cv-summary">${escHtml(data.summary)}</p>
              </div>
              <div class="cv-jobs">
                <h2>${escHtml(data.experienceTitle)}</h2>
                ${renderJobs(data)}
              </div>
            </div>
          </div>
        </div>
      </section>`;
}

function buildPage(lang, data) {
  const prefix = assetPrefixForLang(lang);
  const canonical = absoluteUrl(lang, "cv");
  const profileImage = `${SITE}/images/noberto-brude-kinesiologo-osteopata.jpg`;

  const personSchema = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Norberto Silvio Brude",
      jobTitle: data.role,
      email: CV_EMAIL,
      telephone: "+54-11-6156-4311",
      url: canonical,
      image: profileImage,
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
    breadcrumbListSchema([
      { name: data.homeName, item: absoluteUrl(lang, "index") },
      { name: data.breadcrumb, item: canonical },
    ]),
    null,
    2,
  );

  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">

<head>
${headFavicon(prefix)}  <meta charset="utf-8" />
${headJsClassScript()}${headCriticalCss(prefix)}  <meta http-equiv="content-language" content="${LOCALE[lang]}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#005f99" />
${headLangDeferScripts(prefix)}${headSeoBlock({
    lang,
    stem: "cv",
    title: data.title,
    description: data.description,
    type: "profile",
    image: profileImage,
    canonical,
  })}
${headStandardStylesheets(prefix)}${syncCssLink(asset(prefix, "css/cv.css"))}  <script src="${asset(prefix, "partials/gtm-head.js")}" defer></script>
  <script type="application/ld+json">${personSchema}</script>
  <script type="application/ld+json">${breadcrumbSchema}</script>
</head>

<body>
${bodyShellTop(prefix)}${headerShellMarkup(lang, prefix)}
  <main id="main" class="cv-page" tabindex="-1">
    <section class="cv-hero">
      <div class="container">
        <div class="cv-hero-inner">
          <img src="${prefix}images/noberto-brude-kinesiologo-osteopata.jpg" alt="Norberto Brude" class="cv-photo" width="140" height="140" loading="eager" />
          <div class="cv-hero-text">
            <h1>Norberto Brude</h1>
            <p class="cv-role">${escHtml(data.role)}</p>
            <ul class="cv-contact">
              <li><a href="mailto:${CV_EMAIL}">${CV_EMAIL}</a></li>
              <li><a href="https://wa.me/5491161564311" class="dynamic-whatsapp-url" target="_blank" rel="noopener noreferrer">(+54) 1161564311</a></li>
              <li>${escHtml(data.location)}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
    ${renderBody(data)}
  <div id="site-cta-strip-root" data-cta-lang="${partialLang(lang)}"></div>
  <script src="${prefix}${langBundlePath("cta", lang)}" defer></script>
  </main>
${bodyFooterAndUiScripts(lang, prefix)}
</body>

</html>
`;
}

for (const lang of LANG_CODES) {
  const out = path.join(ROOT, repoPath(lang, "cv"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildPage(lang, CV[lang]));
  console.log("Wrote", out);
}
