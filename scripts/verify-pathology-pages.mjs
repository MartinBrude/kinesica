#!/usr/bin/env node
/**
 * Verify pathology pages: techniques section + lang hrefs + CTA partial.
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
    if (!html.includes("site-cta-strip-root")) {
      errors.push(`${file}: missing site-cta-strip-root`);
    }
    for (const targetLang of LANG_CODES) {
      const expected = absoluteUrl(targetLang, stem);
      if (!html.includes(`href="${expected}"`)) {
        errors.push(`${file}: missing hreflang ${expected}`);
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
