#!/usr/bin/env node
/**
 * Inject nav + footer HTML into pages so crawlers see internal links without JS.
 * Run: node scripts/inject-static-shell.mjs
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

function loadSnippet(jsPath) {
  const raw = fs.readFileSync(path.join(ROOT, jsPath), "utf8");
  const m = raw.match(/=\s*`([\s\S]*?)`\s*\.trim\(\)/);
  if (!m) throw new Error(`Could not parse snippet: ${jsPath}`);
  return m[1].trim();
}

function injectNav(html, file) {
  const lang = expectedLang(file);
  const navHtml = loadSnippet(`partials/nav-${lang}.js`);
  const emptyNav = /<div id="navigation"([^>]*)><\/div>/;
  const filledNav = new RegExp(
    `<div id="navigation"([^>]*)>[\\s\\S]*?<\\/div>\\s*<\\/nav>`,
  );
  if (filledNav.test(html) && html.includes("<ul>")) {
    return html;
  }
  return html.replace(
    emptyNav,
    `<div id="navigation"$1>\n${navHtml}\n</div>`,
  );
}

function injectCta(html, file) {
  const lang = expectedLang(file);
  if (!html.includes('id="site-cta-strip-root"')) {
    return html;
  }
  const ctaHtml = loadSnippet(`partials/cta-strip-${lang}.js`);
  const langAttr = lang === "en" || lang === "fr" ? lang : "es";
  const openTag = `<div id="site-cta-strip-root" data-cta-lang="${langAttr}">`;
  html = html.replace(/<div id="site-cta-strip-root[^>]*>/, openTag);
  if (/<div id="site-cta-strip-root"[^>]*>\s*<section class="space-small bg-primary site-cta-strip">/.test(html)) {
    return html;
  }
  const replaced = html.replace(
    /<div id="site-cta-strip-root"[^>]*>\s*<\/div>/,
    `${openTag}\n${ctaHtml}\n</div>`,
  );
  if (replaced !== html) {
    return replaced;
  }
  return html.replace(
    /<div id="site-cta-strip-root"([^>]*)><\/div>/,
    `${openTag}\n${ctaHtml}\n</div>`,
  );
}

function injectFooter(html, file) {
  const lang = expectedLang(file);
  if (!html.includes('id="site-footer-root"')) {
    return html;
  }
  const footerHtml = loadSnippet(`partials/footer-${lang}.js`);
  const langAttr = lang === "en" || lang === "fr" ? lang : "es";
  const openTag = `<div id="site-footer-root" data-footer-lang="${langAttr}">`;
  html = html.replace(
    /<div id="site-footer-root[^>]*>/,
    openTag,
  );
  const replaced = html.replace(
    /<div id="site-footer-root"[^>]*>[\s\S]*?<\/div>\s*(?=\n\s*<script)/,
    `${openTag}\n${footerHtml}\n</div>\n`,
  );
  if (replaced !== html) {
    return replaced;
  }
  return html.replace(
    /<div id="site-footer-root"([^>]*)><\/div>/,
    `${openTag}\n${footerHtml}\n</div>`,
  );
}

let changed = 0;
for (const file of listHtmlFiles()) {
  if (/404/.test(file)) continue;
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  const original = html;
  html = injectNav(html, file);
  html = injectCta(html, file);
  html = injectFooter(html, file);
  if (html !== original) {
    fs.writeFileSync(full, html);
    changed++;
    console.log("updated:", file);
  }
}
console.log(`Done. ${changed} file(s) with static nav/footer.`);
