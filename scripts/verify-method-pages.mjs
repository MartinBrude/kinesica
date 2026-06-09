#!/usr/bin/env node
/**
 * Verify generated method pages have expected structure and copy fields.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { METHOD_STEMS, METHODS } from "./methods-content.mjs";
import { absoluteUrl, repoPath } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

for (const stem of METHOD_STEMS) {
  for (const lang of LANG_CODES) {
    const file = repoPath(lang, stem);
    const full = path.join(ROOT, file);
    const data = METHODS[stem]?.[lang];
    if (!data) {
      errors.push(`missing copy: ${stem}/${lang}`);
      continue;
    }
    if (!fs.existsSync(full)) {
      errors.push(`missing file: ${file}`);
      continue;
    }
    const html = fs.readFileSync(full, "utf8");
    if (!html.includes('class="content"')) {
      errors.push(`${file}: missing content section`);
    }
    if (!/<h1\b/.test(html)) {
      errors.push(`${file}: missing <h1>`);
    }
    if (!html.includes("kinesica-method-therapy")) {
      errors.push(`${file}: missing MedicalTherapy schema`);
    }
    if (!html.includes("site-cta-strip-root")) {
      errors.push(`${file}: missing CTA placeholder`);
    }
    const expected = absoluteUrl(lang, stem);
    if (!html.includes(`href="${expected}"`)) {
      errors.push(`${file}: missing canonical/hreflang ${expected}`);
    }
    if (!html.includes("page-header-word")) {
      errors.push(`${file}: missing decorative page header`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK: ${METHOD_STEMS.length * LANG_CODES.length} method pages verified.`);
