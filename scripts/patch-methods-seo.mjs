#!/usr/bin/env node
/**
 * @deprecated Use npm run build:methods — patches are applied by build-method-pages.mjs.
 * Run: node scripts/patch-methods-seo.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { absoluteUrl, HTML_LANG, repoPath } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import { patchPageMeta } from "./html-utils.mjs";
import { METHOD_STEMS, METHOD_UI, METHODS } from "./methods-content.mjs";
import { pageCaptionMarkup } from "./page-shell.mjs";
import {
  BUSINESS_ID,
  getMethodServiceCopy,
} from "./schema-local-business.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const THERAPY_SCHEMA_RE =
  /\s*<script type="application\/ld\+json" id="kinesica-method-therapy">[\s\S]*?<\/script>/;

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

function therapySchemaScript(schema) {
  const json = JSON.stringify(schema, null, 4).replace(/^/gm, "      ");
  return `  <script type="application/ld+json" id="kinesica-method-therapy">\n${json}\n    </script>`;
}

function patchPageHeaderCaption(html, breadcrumb) {
  const caption = pageCaptionMarkup(breadcrumb);
  const emptyComment =
    /<div class="page-caption">\s*<!--[\s\S]*?-->\s*<\/div>/;
  const emptyDiv = /<div class="page-caption"><\/div>/;
  if (emptyComment.test(html)) {
    return html.replace(emptyComment, caption);
  }
  if (emptyDiv.test(html)) {
    return html.replace(emptyDiv, caption);
  }
  return html;
}

function patchBreadcrumbHtml(html, ui) {
  return html.replace(
    /(<section class="page-breadcrumb">[\s\S]*?<ol class="breadcrumb">\s*)<li><a href="[^"]*">[^<]*<\/a><\/li>/,
    `$1<li><a href="${ui.homeHref}">${ui.homeLabel}</a></li>`,
  );
}

function patchBreadcrumbSchema(html, ui, breadcrumb, lang, stem) {
  return html
    .replace(
      /"position": 1,\s*"name": "[^"]*"/,
      `"position": 1,\n            "name": "${ui.homeLabel}"`,
    )
    .replace(
      /"position": 2,\s*"name": "[^"]*",\s*"item": "[^"]*"/,
      `"position": 2,\n            "name": "${breadcrumb}",\n            "item": "${absoluteUrl(lang, stem)}"`,
    );
}

function injectTherapySchema(html, schema) {
  let out = html.replace(THERAPY_SCHEMA_RE, "");
  const block = therapySchemaScript(schema);
  if (out.includes('id="kinesica-local-schema"')) {
    return out.replace(
      /\s*<script type="application\/ld\+json" id="kinesica-local-schema">/,
      `\n${block}\n  <script type="application/ld+json" id="kinesica-local-schema">`,
    );
  }
  return out.replace("</head>", `\n${block}\n</head>`);
}

function patchFile(rel, lang, stem) {
  const data = METHODS[stem]?.[lang];
  const ui = METHOD_UI[lang];
  const service = getMethodServiceCopy(lang, stem);
  if (!data || !ui || !service) {
    console.warn("skip (missing data):", rel);
    return false;
  }

  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.warn("skip (missing file):", rel);
    return false;
  }

  let html = fs.readFileSync(full, "utf8");

  html = patchPageMeta(html, {
    title: data.metaTitle,
    description: data.metaDescription,
  });

  html = patchPageHeaderCaption(html, data.breadcrumb);
  html = patchBreadcrumbHtml(html, ui);
  html = patchBreadcrumbSchema(html, ui, data.breadcrumb, lang, stem);
  html = injectTherapySchema(html, methodTherapySchema(lang, stem, service));

  fs.writeFileSync(full, html);
  return true;
}

let n = 0;
for (const stem of METHOD_STEMS) {
  for (const lang of LANG_CODES) {
    const rel = repoPath(lang, stem);
    if (patchFile(rel, lang, stem)) {
      n++;
      console.log("patched:", rel);
    }
  }
}

console.log(`Done. ${n} method page(s) updated.`);
