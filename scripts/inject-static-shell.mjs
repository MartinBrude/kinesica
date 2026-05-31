#!/usr/bin/env node
/**
 * Inject static header (lang picker) and ensure lang-picker.js is loaded.
 * Run: node scripts/inject-static-shell.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { injectStaticHeader } from "./header-shell.mjs";
import { listHtmlFiles, expectedLangFromFile } from "./languages.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadSnippet(jsPath) {
  const raw = fs.readFileSync(path.join(ROOT, jsPath), "utf8");
  const m = raw.match(/=\s*`([\s\S]*?)`\s*\.trim\(\)/);
  if (!m) throw new Error(`Could not parse snippet: ${jsPath}`);
  return m[1].trim();
}

function injectNav(html, file) {
  const lang = expectedLangFromFile(file);
  const navHtml = loadSnippet(`partials/nav-${lang}.js`);
  html = html.replace(
    /<div id="navigation" class="nav navbar-nav navbar-right"/g,
    '<div id="navigation"',
  );
  const navBlock =
    /<div id="navigation"([^>]*)>[\s\S]*?<\/div>(?=\s*<\/nav>)/;
  if (navBlock.test(html)) {
    return html.replace(
      navBlock,
      `<div id="navigation"$1>\n${navHtml}\n            </div>`,
    );
  }
  return html.replace(
    /<div id="navigation"([^>]*)><\/div>/,
    `<div id="navigation"$1>\n${navHtml}\n            </div>`,
  );
}

function injectCta(html, file) {
  const lang = expectedLangFromFile(file);
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
  const lang = expectedLangFromFile(file);
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

function ensureLangPickerScript(html, file) {
  if (!html.includes('id="site-header-root"')) {
    return html;
  }
  const prefix = file.includes("/") ? "../" : "";
  const tag = `<script src="${prefix}js/lang-picker.min.js"></script>`;
  const tagUnmin = `<script src="${prefix}js/lang-picker.js"></script>`;
  if (html.includes(tag) || html.includes(tagUnmin)) {
    return html;
  }
  const afterHeaderInclude = new RegExp(
    `(<script src="${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}js/header-include(?:\\.min)?\\.js"><\\/script>)`,
  );
  if (afterHeaderInclude.test(html)) {
    return html.replace(afterHeaderInclude, `$1\n  ${tag}`);
  }
  return html;
}

let changed = 0;
for (const file of listHtmlFiles(ROOT)) {
  if (/404-router/.test(file)) continue;
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  const original = html;
  html = injectStaticHeader(html, file, ROOT);
  html = injectNav(html, file);
  html = injectCta(html, file);
  html = injectFooter(html, file);
  html = ensureLangPickerScript(html, file);
  if (html !== original) {
    fs.writeFileSync(full, html);
    changed++;
    console.log("updated:", file);
  }
}
console.log(`Done. ${changed} file(s) with static header/nav/footer.`);
