#!/usr/bin/env node
/**
 * Add all pathology pages to the Artículos / Articles dropdown in nav partials
 * and inline <nav> blocks (legacy pages).
 *
 * Run: node scripts/sync-nav-articles-menu.mjs && npm run assets:build
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PATHOLOGIES } from "./pathology-content.mjs";
import {
  articlesSubmenuItems,
  patchArticlesSubmenu,
} from "./nav-articles-submenu.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NAV_PARTIALS = {
  es: path.join(ROOT, "partials", "nav-es.js"),
  en: path.join(ROOT, "partials", "nav-en.js"),
  fr: path.join(ROOT, "partials", "nav-fr.js"),
};

function patchNavPartial(filePath, lang) {
  let js = fs.readFileSync(filePath, "utf8");
  const submenu = articlesSubmenuItems(lang);
  const patched = patchArticlesSubmenu(js, submenu);
  if (!patched) {
    throw new Error(`Could not patch articles submenu in ${filePath}`);
  }
  fs.writeFileSync(filePath, patched);
}

function collectInlineNavHtmlFiles() {
  const out = [];
  for (const rel of ["", "en/", "fr/"]) {
    const dir = path.join(ROOT, rel);
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".html")) continue;
      const full = path.join(dir, name);
      const html = fs.readFileSync(full, "utf8");
      if (!html.includes('href="articulos.html"') || !html.includes('href="cervicalgia.html"')) {
        continue;
      }
      out.push(full);
    }
  }
  return out;
}

for (const [lang, filePath] of Object.entries(NAV_PARTIALS)) {
  patchNavPartial(filePath, lang);
  console.log(`Updated ${path.relative(ROOT, filePath)} (${PATHOLOGIES.length} articles)`);
}

let htmlUpdated = 0;
for (const filePath of collectInlineNavHtmlFiles()) {
  const lang = filePath.includes(`${path.sep}en${path.sep}`)
    ? "en"
    : filePath.includes(`${path.sep}fr${path.sep}`)
      ? "fr"
      : "es";
  const html = fs.readFileSync(filePath, "utf8");
  const patched = patchArticlesSubmenu(html, articlesSubmenuItems(lang));
  if (patched && patched !== html) {
    fs.writeFileSync(filePath, patched);
    htmlUpdated += 1;
  }
}
console.log(`Updated inline nav in ${htmlUpdated} HTML file(s)`);
