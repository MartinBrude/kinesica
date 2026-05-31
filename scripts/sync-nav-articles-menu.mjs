#!/usr/bin/env node
/**
 * Artículos nav: single link to articulos.html (no dropdown).
 * Run: node scripts/sync-nav-articles-menu.mjs && node scripts/inject-static-shell.mjs && npm run assets:build
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { expectedLangFromFile } from "./languages.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NAV_LABELS = {
  es: { href: "articulos.html", title: "Artículos", label: "Artículos" },
  en: { href: "articulos.html", title: "Articles", label: "Articles" },
  fr: { href: "articulos.html", title: "Articles", label: "Articles" },
  pt: { href: "articulos.html", title: "Artigos", label: "Artigos" },
};

const NAV_PARTIALS = {
  es: path.join(ROOT, "partials", "nav-es.js"),
  en: path.join(ROOT, "partials", "nav-en.js"),
  fr: path.join(ROOT, "partials", "nav-fr.js"),
  pt: path.join(ROOT, "partials", "nav-pt.js"),
};

function articlesNavItem(lang) {
  const { href, title, label } = NAV_LABELS[lang];
  return `  <li>
    <a href="${href}" title="${title}">${label}</a>
  </li>`;
}

function patchArticlesNav(html, item) {
  const dropdown = new RegExp(
    String.raw`<li class="has-sub">\s*<a href="articulos\.html"[^>]*>[^<]*<\/a>\s*<ul>[\s\S]*?<\/ul>\s*<\/li>\s*(?=<li class="has-sub">\s*<a href="rpg\.html")`,
  );
  if (dropdown.test(html)) {
    return html.replace(dropdown, `${item}\n`);
  }
  const simple = /<li>\s*<a href="articulos\.html"[^>]*>[^<]*<\/a>\s*<\/li>/;
  if (simple.test(html)) {
    return html.replace(simple, item);
  }
  return null;
}

for (const [lang, filePath] of Object.entries(NAV_PARTIALS)) {
  const item = articlesNavItem(lang);
  let js = fs.readFileSync(filePath, "utf8");
  const patched = patchArticlesNav(js, item);
  if (!patched) {
    throw new Error(`Could not patch Artículos nav in ${filePath}`);
  }
  fs.writeFileSync(filePath, patched);
  console.log(`Updated ${path.relative(ROOT, filePath)}`);
}

let htmlUpdated = 0;
for (const rel of ["", "en/", "fr/", "pt/"]) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".html") || name === "articulos.html") continue;
    const full = path.join(dir, name);
    const html = fs.readFileSync(full, "utf8");
    if (!html.includes('href="articulos.html"')) continue;
    const lang = expectedLangFromFile(rel ? `${rel}${name}` : name);
    const patched = patchArticlesNav(html, articlesNavItem(lang));
    if (patched && patched !== html) {
      fs.writeFileSync(full, patched);
      htmlUpdated += 1;
    }
  }
}

const articulosFiles = [
  "articulos.html",
  "en/articulos.html",
  "fr/articulos.html",
  "pt/articulos.html",
];
for (const rel of articulosFiles) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const lang = expectedLangFromFile(rel);
  const html = fs.readFileSync(full, "utf8");
  const patched = patchArticlesNav(html, articlesNavItem(lang));
  if (patched && patched !== html) {
    fs.writeFileSync(full, patched);
    htmlUpdated += 1;
  }
}

console.log(`Updated inline nav in ${htmlUpdated} HTML file(s)`);
