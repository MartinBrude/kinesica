#!/usr/bin/env node
/**
 * Sync pathology labels in js/page-header-word.js from pathology-content breadcrumbs.
 * Run: node scripts/sync-pathology-header-labels.mjs && npm run assets:build
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PATHOLOGIES } from "./pathology-content.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "js/page-header-word.js");

const block = PATHOLOGIES.map(
  (p) =>
    `    ${JSON.stringify(p.stem)}: { es: ${JSON.stringify(p.es.breadcrumb)}, en: ${JSON.stringify(p.en.breadcrumb)}, fr: ${JSON.stringify(p.fr.breadcrumb)} },`,
).join("\n");

let js = fs.readFileSync(TARGET, "utf8");
const re = /    cefalea: \{[\s\S]*?\n    \},\n/;
if (!re.test(js)) {
  console.error("Could not find pathology labels block in page-header-word.js");
  process.exit(1);
}
js = js.replace(re, `${block}\n`);
fs.writeFileSync(TARGET, js);
console.log(`Updated ${PATHOLOGIES.length} pathology labels in page-header-word.js`);
