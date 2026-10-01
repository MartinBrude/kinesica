#!/usr/bin/env node
/**
 * Generate terms of service pages (ES / EN / FR / PT).
 * Run: node scripts/build-terms-pages.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TERMS } from "./terms-content.mjs";
import { SITE, absoluteUrl, HTML_LANG, repoPath, sitePath } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import { breadcrumbListSchema, escAttr, escHtml } from "./html-utils.mjs";
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
  pageBreadcrumbSection,
  pageCaptionMarkup,
  pageHeaderSection,
} from "./page-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HOME_LABELS = {
  es: "Inicio",
  en: "Home",
  fr: "Accueil",
  pt: "Início",
};

function formatText(str) {
  if (!str) return "";
  let out = str.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

function renderSection(sec) {
  let html = `          <div class="terms-section-block" id="${sec.id}">\n`;
  html += `            <h2>${escHtml(sec.title)}</h2>\n`;
  for (const p of sec.paragraphs || []) {
    html += `            <p>${formatText(p)}</p>\n`;
  }
  if (sec.contactList) {
    html += `            <ul class="terms-contact-links">\n`;
    for (const c of sec.contactList) {
      html += `              <li><a href="${escAttr(c.href)}" ${
        c.href.startsWith("http")
          ? 'target="_blank" rel="noopener noreferrer"'
          : ""
      }>${escHtml(c.label)}: <strong>${escHtml(c.value)}</strong></a></li>\n`;
    }
    html += `            </ul>\n`;
  }
  if (sec.bullets) {
    html += `            <ul>\n`;
    for (const b of sec.bullets) {
      html += `              <li>${formatText(b)}</li>\n`;
    }
    html += `            </ul>\n`;
  }
  html += `          </div>`;
  return html;
}

function buildHtml(lang) {
  const copy = TERMS[lang];
  const prefix = assetPrefixForLang(lang);
  const canonical = absoluteUrl(lang, "condiciones");
  const homeHref = sitePath(lang, "index");
  const homeLabel = HOME_LABELS[lang];

  const breadcrumbSchema = JSON.stringify(
    breadcrumbListSchema([
      { name: homeLabel, item: absoluteUrl(lang, "index") },
      { name: copy.breadcrumb, item: canonical },
    ]),
    null,
    2,
  );

  const webPageSchema = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: copy.title,
      description: copy.description,
      inLanguage: HTML_LANG[lang],
      isPartOf: {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: absoluteUrl(lang, "index"),
        name: "Kinésica",
      },
    },
    null,
    2,
  );

  const sectionsHtml = copy.sections.map((sec) => renderSection(sec)).join("\n\n");

  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">

<head>
  <meta charset="utf-8" />
${headFavicon(prefix)}${headJsClassScript()}${headCriticalCss(prefix)}  <meta http-equiv="content-language" content="${LOCALE[lang]}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#005f99" />
${headLangDeferScripts(prefix)}${headSeoBlock({
    lang,
    stem: "condiciones",
    title: copy.title,
    description: copy.description,
    type: "website",
    canonical,
  })}
${headStandardStylesheets(prefix)}  <script src="${prefix}partials/gtm-head.min.js" defer></script>
  <script type="application/ld+json">
${breadcrumbSchema}
  </script>
  <script type="application/ld+json">
${webPageSchema}
  </script>
</head>

<body>
${bodyShellTop(prefix)}${headerShellMarkup(lang, prefix)}
  <main id="main" tabindex="-1">
${pageHeaderSection(pageCaptionMarkup(copy.breadcrumb, { variant: "word" }))}
${pageBreadcrumbSection({
  homeHref,
  homeLabel,
  activeLabel: copy.breadcrumb,
})}
    <section class="content terms-page">
      <div class="container">
        <div class="terms-page-layout">
          <div class="terms-intro-box">
            <p class="terms-updated">${escHtml(copy.lastUpdated)}</p>
            <h1>${escHtml(copy.h1)}</h1>
            <p class="lead">${escHtml(copy.lead)}</p>
          </div>

          <div class="terms-disclaimer-box">
            <p><strong><i class="fa fa-info-circle" aria-hidden="true"></i> ${escHtml(
              copy.disclaimer.title,
            )}:</strong> ${formatText(copy.disclaimer.text)}</p>
          </div>

${sectionsHtml}
        </div>
      </div>
    </section>
  </main>
${bodyFooterAndUiScripts(lang, prefix)}
</body>

</html>
`;
}

for (const lang of LANG_CODES) {
  const out = path.join(ROOT, repoPath(lang, "condiciones"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildHtml(lang));
  console.log("Wrote", out);
}
