#!/usr/bin/env node
/**
 * Bootstrap pt/ pages from fr/ + apply FR→PT copy replacements.
 * Then run: apply-lang-meta → build-articulos-pages → inject-local-schema → inject-static-shell
 * Run: node scripts/bootstrap-pt-pages.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PT_FROM_FR_REPLACEMENTS } from "./pt-from-fr-translations.mjs";
import { PATHOLOGY_STEMS } from "./pathology-content.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FR_DIR = path.join(ROOT, "fr");
const PT_DIR = path.join(ROOT, "pt");

/** Static pages only — pathology and cv are generated elsewhere. */
const BOOTSTRAP_SKIP = new Set([
  "cv.html",
  ...PATHOLOGY_STEMS.map((s) => `${s}.html`),
]);

function syncOgDescriptionFromMeta(html) {
  const meta = html.match(
    /<meta name="description"\s*\n?\s*content="([^"]*)"\s*\/?>/,
  );
  if (!meta) return html;
  const desc = meta[1];
  return html.replace(
    /<meta property="og:description"\s*\n?\s*content="[^"]*"\s*\/?>/,
    `<meta property="og:description"\n    content="${desc}" />`,
  );
}

const SCHEMA_BLOCK_RE =
  /\s*<script type="application\/ld\+json" id="kinesica-local-schema">[\s\S]*?<\/script>/;

function cloneFrToPt(name) {
  const src = path.join(FR_DIR, name);
  const dest = path.join(PT_DIR, name);
  if (!fs.existsSync(src)) {
    console.warn("skip missing:", `fr/${name}`);
    return false;
  }
  let html = fs.readFileSync(src, "utf8");
  const rules = [
    [/https:\/\/www\.kinesica\.com\.ar\/fr\//g, "https://www.kinesica.com.ar/pt/"],
    [/https:\/\/www\.kinesica\.com\.ar\/fr\/([a-z0-9-]+\.html)/g, "https://www.kinesica.com.ar/pt/$1"],
    [/href="\/fr\/([a-z0-9-]+\.html)"/g, 'href="/pt/$1"'],
    [/header-fr(\.min)?\.js/g, "header-pt$1.js"],
    [/nav-fr(\.min)?\.js/g, "nav-pt$1.js"],
    [/footer-fr(\.min)?\.js/g, "footer-pt$1.js"],
    [/cta-strip-fr(\.min)?\.js/g, "cta-strip-pt$1.js"],
    [/whatsapp-float-fr(\.min)?\.js/g, "whatsapp-float-pt$1.js"],
    [/data-header-lang="fr"/g, 'data-header-lang="pt"'],
    [/data-footer-lang="fr"/g, 'data-footer-lang="pt"'],
    [/data-cta-lang="fr"/g, 'data-cta-lang="pt"'],
    [/data-whatsapp-lang="fr"/g, 'data-whatsapp-lang="pt"'],
    [/<html lang="fr">/g, '<html lang="pt">'],
    [/http-equiv="content-language" content="fr"/g, 'http-equiv="content-language" content="pt"'],
    [/property="og:locale" content="fr_FR"/g, 'property="og:locale" content="pt_BR"'],
    [/"inLanguage": "fr"/g, '"inLanguage": "pt"'],
    [/"name": "Accueil"/g, '"name": "Início"'],
  ];
  for (const [re, rep] of rules) {
    html = html.replace(re, rep);
  }
  for (const [from, to] of PT_FROM_FR_REPLACEMENTS) {
    html = html.split(from).join(to);
  }
  html = html.replace(SCHEMA_BLOCK_RE, "");
  html = syncOgDescriptionFromMeta(html);
  html = html.replace(
    /\s*<script src="\.\.\/partials\/footer-en\.min\.js"><\/script>\n/g,
    "",
  );
  fs.mkdirSync(PT_DIR, { recursive: true });
  fs.writeFileSync(dest, html);
  return true;
}

let n = 0;
for (const name of fs.readdirSync(FR_DIR)) {
  if (!name.endsWith(".html")) continue;
  if (BOOTSTRAP_SKIP.has(name)) continue;
  if (cloneFrToPt(name)) {
    n++;
    console.log("created:", `pt/${name}`);
  }
}
console.log(`Done. ${n} pt/ HTML file(s) bootstrapped from fr/.`);
