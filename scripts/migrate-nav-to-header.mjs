#!/usr/bin/env node
/**
 * Load nav partials in <head> area (after header-include), remove duplicate footer nav scripts.
 * Run: node scripts/migrate-nav-to-header.mjs && npm run assets:build
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NAV_FOOTER_RE =
  /\n\s*<script src="(?:\.\.\/)?partials\/nav-(?:es|en|fr)\.min\.js(?:\?v=\d+)?"><\/script>\s*\n\s*<script src="(?:\.\.\/)?js\/nav-include\.min\.js(?:\?v=\d+)?"><\/script>/g;

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

function navBlock(prefix, lang) {
  return `<script src="${prefix}partials/nav-${lang}.min.js"></script>
  <script src="${prefix}js/nav-include.min.js"></script>`;
}

let changed = 0;
for (const file of listHtmlFiles()) {
  if (/404-router/.test(file)) continue;
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  if (!html.includes('id="site-header-root"')) continue;

  const lang = expectedLang(file);
  const prefix = lang === "es" ? "" : "../";
  const block = navBlock(prefix, lang);

  let next = html;
  if (!next.includes("js/header-include.min.js")) continue;

  const mainIdx = next.indexOf("<main");
  const headerPart = mainIdx > 0 ? next.slice(0, mainIdx) : next;
  if (!headerPart.includes(`partials/nav-${lang}.min.js`)) {
    next = next.replace(
      /(<script src="(?:\.\.\/)?js\/header-include\.min\.js(?:\?v=\d+)?"><\/script>)/,
      `$1\n  ${block}`,
    );
  }

  next = next.replace(NAV_FOOTER_RE, "");
  if (next !== html) {
    fs.writeFileSync(full, next);
    changed++;
    console.log("updated:", file);
  }
}

console.log(`Done. ${changed} file(s) moved nav scripts to header.`);
