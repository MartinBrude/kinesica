#!/usr/bin/env node
/**
 * Replace inline CTA sections with shared partial placeholder.
 * Run: node scripts/migrate-cta-strip.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CTA_SECTION_RE =
  /<(?:section|div) class="space-small bg-primary(?: site-cta-strip)?">[\s\S]*?<\/(?:section|div)>/;

const PLACEHOLDER = {
  es: `  <div id="site-cta-strip-root" data-cta-lang="es"></div>
  <script src="partials/cta-strip-es.min.js"></script>
  <script src="js/cta-strip-include.min.js"></script>`,
  en: `  <div id="site-cta-strip-root" data-cta-lang="en"></div>
  <script src="../partials/cta-strip-en.min.js"></script>
  <script src="../js/cta-strip-include.min.js"></script>`,
  fr: `  <div id="site-cta-strip-root" data-cta-lang="fr"></div>
  <script src="../partials/cta-strip-fr.min.js"></script>
  <script src="../js/cta-strip-include.min.js"></script>`,
};

function listHtmlFiles() {
  const files = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith(".html") && !f.startsWith("cv-"));
  for (const lang of ["en", "fr"]) {
    const dir = path.join(ROOT, lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".html")) files.push(`${lang}/${f}`);
    }
  }
  return files;
}

function expectedLang(file) {
  if (file.startsWith("en/")) return "en";
  if (file.startsWith("fr/")) return "fr";
  return "es";
}

let changed = 0;
for (const file of listHtmlFiles()) {
  if (/404/.test(file) || /index\.html$/.test(file)) continue;
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  if (html.includes("site-cta-strip-root")) {
    continue;
  }
  if (!CTA_SECTION_RE.test(html)) {
    console.warn("no CTA block:", file);
    continue;
  }
  const lang = expectedLang(file);
  html = html.replace(CTA_SECTION_RE, PLACEHOLDER[lang]);
  fs.writeFileSync(full, html);
  changed++;
  console.log("cta migrated:", file);
}
console.log(`Done. ${changed} file(s).`);
