#!/usr/bin/env node
/**
 * Reset CTA block to a single empty root + scripts (before static shell inject).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PLACEHOLDER = {
  es: `<div id="site-cta-strip-root" data-cta-lang="es"></div>
  <script src="partials/cta-strip-es.min.js"></script>
  <script src="js/cta-strip-include.min.js"></script>
`,
  en: `<div id="site-cta-strip-root" data-cta-lang="en"></div>
  <script src="../partials/cta-strip-en.min.js"></script>
  <script src="../js/cta-strip-include.min.js"></script>
`,
  fr: `<div id="site-cta-strip-root" data-cta-lang="fr"></div>
  <script src="../partials/cta-strip-fr.min.js"></script>
  <script src="../js/cta-strip-include.min.js"></script>
`,
};

const BLOCK_RE =
  /<div id="site-cta-strip-root"[\s\S]*?(?=\s*<div id="site-footer-root")/;

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
  if (!html.includes("site-cta-strip-root")) continue;
  const lang = expectedLang(file);
  const next = html.replace(BLOCK_RE, PLACEHOLDER[lang]);
  if (next !== html) {
    fs.writeFileSync(full, next);
    changed++;
    console.log("normalized:", file);
  }
}
console.log(`Done. ${changed} file(s).`);
