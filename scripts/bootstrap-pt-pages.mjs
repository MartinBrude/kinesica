#!/usr/bin/env node
/**
 * Bootstrap pt/ pages from en/ + apply static PT copy replacements.
 * Run: node scripts/bootstrap-pt-pages.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PT_STATIC_REPLACEMENTS } from "./pt-static-translations.mjs";
import { PATHOLOGY_STEMS } from "./pathology-content.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EN_DIR = path.join(ROOT, "en");
const PT_DIR = path.join(ROOT, "pt");

/** Static technique/home pages only — pathology, cv and articulos are generated elsewhere. */
const BOOTSTRAP_SKIP = new Set([
  "articulos.html",
  "cv.html",
  ...PATHOLOGY_STEMS.map((s) => `${s}.html`),
]);

function cloneEnToPt(name) {
  const src = path.join(EN_DIR, name);
  const dest = path.join(PT_DIR, name);
  if (!fs.existsSync(src)) {
    console.warn("skip missing:", `en/${name}`);
    return false;
  }
  let html = fs.readFileSync(src, "utf8");
  const rules = [
    [/https:\/\/www\.kinesica\.com\.ar\/en\//g, "https://www.kinesica.com.ar/pt/"],
    [/https:\/\/www\.kinesica\.com\.ar\/en\/([a-z0-9-]+\.html)/g, "https://www.kinesica.com.ar/pt/$1"],
    [/href="\/en\/([a-z0-9-]+\.html)"/g, 'href="/pt/$1"'],
    [/canonical" href="https:\/\/www\.kinesica\.com\.ar\/en\//g, 'canonical" href="https://www.kinesica.com.ar/pt/'],
    [/header-en(\.min)?\.js/g, "header-pt$1.js"],
    [/nav-en(\.min)?\.js/g, "nav-pt$1.js"],
    [/footer-en(\.min)?\.js/g, "footer-pt$1.js"],
    [/cta-strip-en(\.min)?\.js/g, "cta-strip-pt$1.js"],
    [/whatsapp-float-en(\.min)?\.js/g, "whatsapp-float-pt$1.js"],
    [/data-header-lang="en"/g, 'data-header-lang="pt"'],
    [/data-footer-lang="en"/g, 'data-footer-lang="pt"'],
    [/data-cta-lang="en"/g, 'data-cta-lang="pt"'],
    [/data-whatsapp-lang="en"/g, 'data-whatsapp-lang="pt"'],
    [/<html lang="en">/g, '<html lang="pt">'],
    [/http-equiv="content-language" content="en"/g, 'http-equiv="content-language" content="pt"'],
    [/property="og:locale" content="en_US"/g, 'property="og:locale" content="pt_BR"'],
    [/"inLanguage": "en"/g, '"inLanguage": "pt"'],
  ];
  for (const [re, rep] of rules) {
    html = html.replace(re, rep);
  }
  for (const [from, to] of PT_STATIC_REPLACEMENTS) {
    html = html.split(from).join(to);
  }
  fs.mkdirSync(PT_DIR, { recursive: true });
  fs.writeFileSync(dest, html);
  return true;
}

let n = 0;
for (const name of fs.readdirSync(EN_DIR)) {
  if (!name.endsWith(".html")) continue;
  if (BOOTSTRAP_SKIP.has(name)) continue;
  if (cloneEnToPt(name)) {
    n++;
    console.log("created:", `pt/${name}`);
  }
}
console.log(`Done. ${n} pt/ HTML file(s) bootstrapped from en/.`);
