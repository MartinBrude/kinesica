#!/usr/bin/env node
/**
 * Verify pathology pages: techniques section + lang hrefs + CTA partial.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PATHOLOGY_STEMS } from "./pathology-content.mjs";
import { repoPath, sitePath } from "./i18n-urls.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

for (const stem of PATHOLOGY_STEMS) {
  for (const lang of ["es", "en", "fr"]) {
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
    if (!html.includes("site-cta-strip-root")) {
      errors.push(`${file}: missing site-cta-strip-root`);
    }
    for (const targetLang of ["es", "en", "fr"]) {
      const expected = sitePath(targetLang, stem);
      if (!html.includes(`href="${expected}"`)) {
        errors.push(`${file}: missing lang link ${expected}`);
      }
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK: ${PATHOLOGY_STEMS.length * 3} pathology pages verified.`);
