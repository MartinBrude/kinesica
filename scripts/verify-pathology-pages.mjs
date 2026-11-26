#!/usr/bin/env node
/**
 * Verify pathology pages: techniques section + lang hrefs + mid-page book CTA.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PATHOLOGY_STEMS } from "./pathology-content.mjs";
import { repoPath, absoluteUrl } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

for (const stem of PATHOLOGY_STEMS) {
  for (const lang of LANG_CODES) {
    const file = repoPath(lang, stem);
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) {
      errors.push(`missing: ${file}`);
      continue;
    }
    const html = fs.readFileSync(full, "utf8");
    if (!html.includes("pathology-techniques")) {
      errors.push(`${file}: missing pathology-techniques section`);
    }
    if (!html.includes("pathology-technique-links")) {
      errors.push(`${file}: missing technique links`);
    }
    if (!html.includes("pathology-related")) {
      errors.push(`${file}: missing pathology-related section`);
    }
    if (!html.includes("pathology-faq")) {
      errors.push(`${file}: missing pathology-faq section`);
    }
    if (!html.includes('"@type": "FAQPage"')) {
      errors.push(`${file}: missing FAQPage schema`);
    }
    if (!html.includes('"possibleTreatment"')) {
      errors.push(`${file}: missing possibleTreatment in MedicalCondition`);
    }
    if (!html.includes('"codingSystem": "ICD-10"')) {
      errors.push(`${file}: missing ICD-10 code in MedicalCondition`);
    }
    if (!html.includes("pathology-book-cta")) {
      errors.push(`${file}: missing pathology-book-cta section`);
    }
    if (html.includes("site-cta-strip-root")) {
      errors.push(`${file}: unexpected site-cta-strip-root (mid-page CTA only)`);
    }
    for (const targetLang of LANG_CODES) {
      const expected = absoluteUrl(targetLang, stem);
    if (!html.includes(`href="${expected}"`)) {
      errors.push(`${file}: missing hreflang ${expected}`);
    }
    const authorUrl = absoluteUrl(targetLang, "cv");
    if (targetLang === lang && !html.includes(`"url": "${authorUrl}"`)) {
      errors.push(`${file}: MedicalWebPage author missing url ${authorUrl}`);
    }
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `OK: ${PATHOLOGY_STEMS.length * LANG_CODES.length} pathology pages verified.`,
);
