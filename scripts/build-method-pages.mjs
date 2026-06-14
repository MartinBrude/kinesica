#!/usr/bin/env node
/**
 * Generate method/technique pages (ES / EN / FR / PT) from methods-content.mjs.
 * Run: npm run build:methods
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { METHOD_STEMS, METHOD_UI, METHODS } from "./methods-content.mjs";
import { absoluteUrl, HTML_LANG, repoPath, sitePath } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import { breadcrumbListSchema, escHtml } from "./html-utils.mjs";
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
  headLangScripts,
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function methodTherapySchema(lang, stem, service) {
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

function buildMain(data) {
  const blocks = (data.blocks ?? [])
    .map((block) => {
      if (block.type === "h2") {
        return `            <h2>${escHtml(block.text)}</h2>`;
      }
      return `            <p>${escHtml(block.text)}</p>`;
    })
    .join("\n");

  return `    <section class="content">
      <div class="container">
        <div class="row">
          <div class="col-lg-8 col-md-8 col-sm-8 col-xs-12">
            <h1>${escHtml(data.h1)}</h1>
            <p class="lead">${escHtml(data.lead)}</p>
${blocks}
          </div>
        </div>
      </div>
    </section>`;
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
  const breadcrumbSchema = breadcrumbListSchema([
    { name: ui.homeLabel, item: absoluteUrl(lang, "index") },
    { name: data.breadcrumb, item: canonical },
  ]);
  const therapySchema = methodTherapySchema(lang, stem, service);

  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">

<head>
${headFavicon(p)}  <meta charset="utf-8" />
${headJsClassScript()}${headCriticalCss(p)}  <meta http-equiv="content-language" content="${LOCALE[lang]}" />
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
    canonical,
  })}
${headStandardStylesheets(p)}  <script src="${p}partials/gtm-head.min.js" defer></script>
  <script type="application/ld+json">
${JSON.stringify(breadcrumbSchema, null, 6).replace(/^/gm, "      ")}
    </script>
  <script type="application/ld+json" id="kinesica-method-therapy">
${JSON.stringify(therapySchema, null, 6).replace(/^/gm, "      ")}
    </script>
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
${buildMain(data)}
  </main>
${ctaStripPlaceholder(lang, p)}
${bodyFooterAndUiScripts(lang, p)}
</body>

</html>
`;
}

let written = 0;
for (const stem of METHOD_STEMS) {
  for (const lang of LANG_CODES) {
    const rel = repoPath(lang, stem);
    const full = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buildHtml(stem, lang));
    written++;
    console.log("wrote:", rel);
  }
}

console.log(`Done. ${written} method page(s). Stems: ${METHOD_STEMS.join(", ")}`);
