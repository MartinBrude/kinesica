#!/usr/bin/env node
/**
 * Restore Sobre mí, mapa y FAQs en index (ES/EN/FR) tras migración CTA errónea.
 * Mantiene CTA centralizado dentro de <main>, como en el index original.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CONFIG = [
  { file: "index.html", git: "HEAD:index.html", start: 672, end: 926, lang: "es" },
  { file: "en/index.html", git: "HEAD:en/index.html", start: 658, end: 905, lang: "en" },
  { file: "fr/index.html", git: "HEAD:fr/index.html", start: 651, end: 881, lang: "fr" },
];

const CTA_INLINE_RE =
  /<section class="space-small bg-primary">[\s\S]*?<!-- \/\.call to action -->\s*/;

const PLACEHOLDER = {
  es: `    <div id="site-cta-strip-root" data-cta-lang="es"></div>
  <script src="partials/cta-strip-es.min.js"></script>
  <script src="js/cta-strip-include.min.js"></script>
`,
  en: `    <div id="site-cta-strip-root" data-cta-lang="en"></div>
  <script src="../partials/cta-strip-en.min.js"></script>
  <script src="../js/cta-strip-include.min.js"></script>
`,
  fr: `    <div id="site-cta-strip-root" data-cta-lang="fr"></div>
  <script src="../partials/cta-strip-fr.min.js"></script>
  <script src="../js/cta-strip-include.min.js"></script>
`,
};

/** From end of Métodos/Therapies section through FAQs (inside main). */
const METHODS_END_RE =
  /(\s*<\/section>\s*)(?:<\/main>\s*<div id="site-cta-strip-root"[\s\S]*?<script src="[^"]*cta-strip-include[^"]*"><\/script>\s*)?(?=<div id="site-footer-root")/;

for (const { file, git, start, end, lang } of CONFIG) {
  const full = path.join(ROOT, file);
  let original = execSync(`git show ${git}`, { cwd: ROOT, encoding: "utf8" });
  const lines = original.split("\n");
  let block = lines.slice(start - 1, end).join("\n");
  block = block.replace(CTA_INLINE_RE, PLACEHOLDER[lang]);

  let html = fs.readFileSync(full, "utf8");
  if (!METHODS_END_RE.test(html)) {
    console.error("pattern not found:", file);
    process.exit(1);
  }
  html = html.replace(METHODS_END_RE, `$1${block}\n  </main>\n`);
  fs.writeFileSync(full, html);
  console.log("restored:", file);
}

console.log("Done. Run: node scripts/update-faq-pathology-links.mjs && node scripts/inject-static-shell.mjs");
