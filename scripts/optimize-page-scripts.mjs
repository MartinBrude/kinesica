#!/usr/bin/env node
/**
 * One-off / repeatable HTML optimizations:
 * - Single nav partial per page (by html lang)
 * - Remove duplicate site-config.js when loaded in <head> and before footer
 * - Remove duplicate lang-routes.js + lang-preference.js at end of body
 *
 * Run: node scripts/optimize-page-scripts.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function navPrefix(file) {
  return file.includes("/") ? "../" : "";
}

function optimizeNav(html, file) {
  const lang = expectedLang(file);
  const prefix = navPrefix(file);
  const triple = new RegExp(
    `\\s*<script src="${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}partials/nav-es\\.js"></script>\\s*` +
      `<script src="${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}partials/nav-en\\.js"></script>\\s*` +
      `<script src="${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}partials/nav-fr\\.js"></script>\\s*`,
    "g",
  );
  if (!triple.test(html)) {
    return html;
  }
  triple.lastIndex = 0;
  return html.replace(
    triple,
    `\n  <script src="${prefix}partials/nav-${lang}.js"></script>\n`,
  );
}

function removeDuplicateSiteConfig(html) {
  const headMatch = /<head[\s\S]*?<\/head>/i.exec(html);
  if (!headMatch || !headMatch[0].includes("site-config.js")) {
    return html;
  }
  const splitAt = headMatch.index + headMatch[0].length;
  const body = html.slice(splitAt).replace(
    /\n\s*<script src="(\.\.\/)?js\/site-config\.js"><\/script>/,
    "",
  );
  return html.slice(0, splitAt) + body;
}

function removeTrailingLangScripts(html) {
  const headHasLang =
    /<head[\s\S]*?lang-routes\.js[\s\S]*?<\/head>/i.test(html);
  if (!headHasLang) return html;
  return html
    .replace(
      /\n\s*<script src="(\.\.\/)?js\/lang-routes\.js"><\/script>\s*\n\s*<script src="(\.\.\/)?js\/lang-preference\.js"><\/script>(?=\s*\n<\/body>)/,
      "",
    )
    .replace(
      /\n\s*<script src="(\.\.\/)?js\/sticky-header\.js" defer><\/script>\s*<script src="(\.\.\/)?js\/lang-routes\.js"><\/script>/,
      '\n  <script src="$1js/sticky-header.js" defer></script>',
    );
}

function jsPrefix(file) {
  return file.includes("/") ? "../js/" : "js/";
}

function injectUiReveal(html, file) {
  const prefix = jsPrefix(file);
  const tag = `<script src="${prefix}ui-reveal.js" defer></script>`;
  if (html.includes("ui-reveal.js")) {
    return html;
  }
  const anchor = `<script src="${prefix}sticky-header.js" defer></script>`;
  if (!html.includes(anchor)) {
    return html;
  }
  return html.replace(anchor, `${tag}\n  ${anchor}`);
}

function injectHeroPreload(html, file) {
  if (!file.endsWith("index.html")) {
    return html;
  }
  const imgPrefix = file.includes("/") ? "../" : "";
  const link = `  <link rel="preload" as="image" href="${imgPrefix}images/hero-img.jpg" fetchpriority="high" />\n`;
  if (html.includes("hero-img.jpg") && html.includes('rel="preload"')) {
    return html;
  }
  return html.replace(/<meta name="theme-color"/, `${link}<meta name="theme-color"`);
}

let changed = 0;
for (const file of listHtmlFiles()) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  const original = html;
  html = optimizeNav(html, file);
  html = removeDuplicateSiteConfig(html);
  html = removeTrailingLangScripts(html);
  html = injectUiReveal(html, file);
  html = injectHeroPreload(html, file);
  if (html !== original) {
    fs.writeFileSync(full, html);
    changed++;
    console.log("updated:", file);
  }
}
console.log(`Done. ${changed} file(s) modified.`);
