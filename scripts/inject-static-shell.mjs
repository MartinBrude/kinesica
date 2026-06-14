#!/usr/bin/env node
/**
 * Ensure JS-injected site shell: empty placeholders + required scripts.
 * Header, nav, footer and CTA load at runtime via partials/*.js + *-include.js.
 * Run: node scripts/inject-static-shell.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { headerShellMarkup } from "./header-shell.mjs";
import { listHtmlFiles, expectedLangFromFile, partialLang } from "./languages.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Remove baked-in header markup; keep empty #site-header-root. */
function stripInlinedHeader(html) {
  const filled = /<div id="site-header-root"([^>]*)>[\s\S]*?<\/header>\s*<\/div>\s*(?=<script)/;
  if (!filled.test(html)) {
    return html;
  }
  return html.replace(
    filled,
    `<div id="site-header-root"$1></div>\n  `,
  );
}

/** Remove baked-in CTA; keep empty #site-cta-strip-root. */
function stripInlinedCta(html) {
  const filled =
    /<div id="site-cta-strip-root"([^>]*)>\s*<section class="space-small bg-primary site-cta-strip">[\s\S]*?<\/section>\s*<\/div>/;
  if (!filled.test(html)) {
    return html;
  }
  return html.replace(filled, `<div id="site-cta-strip-root"$1></div>`);
}

/** Remove baked-in footer; keep empty #site-footer-root. */
function stripInlinedFooter(html) {
  const filled =
    /<div id="site-footer-root"([^>]*)>\s*<footer class="footer">[\s\S]*?<\/div>\s*\n\s*(?=<script src="[^"]*site-config)/;
  if (!filled.test(html)) {
    return html;
  }
  return html.replace(
    filled,
    `<div id="site-footer-root"$1></div>\n\n  `,
  );
}

function dedupeLangRoutes(html, prefix) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `\\s*<script src="${escaped}js/lang-routes(?:\\.min)?\\.js"(?: defer)?><\\/script>`,
    "g",
  );
  let n = 0;
  return html.replace(re, (match) => (n++ === 0 ? match : "\n"));
}

function shellScriptTagPattern(name) {
  return `(?:<script src="[^"]*${name}[^"]*"(?: defer)?><\\/script>\\s*)*`;
}

function ensureHeaderShell(html, file) {
  if (!html.includes('id="site-header-root"')) {
    return html;
  }
  const lang = expectedLangFromFile(file);
  const prefix = file.includes("/") ? "../" : "";
  const shell = headerShellMarkup(lang, prefix);
  const emptyRoot = `<div id="site-header-root" data-header-lang="${partialLang(lang)}"></div>`;
  const block = new RegExp(
    `<div id="site-header-root"[^>]*><\\/div>\\s*${shellScriptTagPattern("lang-routes")}${shellScriptTagPattern("snippet-lang")}${shellScriptTagPattern("partials\\/header-")}${shellScriptTagPattern("header-include")}${shellScriptTagPattern("lang-picker")}${shellScriptTagPattern("partials\\/nav-")}${shellScriptTagPattern("nav-include")}`,
  );
  if (block.test(html)) {
    return html.replace(block, shell);
  }
  if (html.includes(emptyRoot)) {
    return html.replace(emptyRoot, shell.trimEnd());
  }
  return html;
}

function ensureCtaScripts(html, file) {
  if (!html.includes('id="site-cta-strip-root"')) {
    return html;
  }
  const lang = partialLang(expectedLangFromFile(file));
  const prefix = file.includes("/") ? "../" : "";
  const ctaPartial = `<script src="${prefix}partials/cta-strip-${lang}.min.js" defer></script>`;
  const ctaInclude = `<script src="${prefix}js/cta-strip-include.min.js" defer></script>`;
  const block = new RegExp(
    `(<div id="site-cta-strip-root"[^>]*><\\/div>)\\s*${shellScriptTagPattern("cta-strip-")}${shellScriptTagPattern("cta-strip-include")}`,
  );
  if (block.test(html)) {
    return html.replace(block, `$1\n  ${ctaPartial}\n  ${ctaInclude}`);
  }
  if (html.includes(ctaPartial) && html.includes(ctaInclude)) {
    return html;
  }
  return html.replace(
    /(<div id="site-cta-strip-root"[^>]*><\/div>)/,
    `$1\n  ${ctaPartial}\n  ${ctaInclude}`,
  );
}

let changed = 0;
for (const file of listHtmlFiles(ROOT)) {
  if (/404-router/.test(file)) continue;
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  const original = html;
  html = stripInlinedHeader(html);
  html = stripInlinedCta(html);
  html = stripInlinedFooter(html);
  html = ensureHeaderShell(html, file);
  html = ensureCtaScripts(html, file);
  html = dedupeLangRoutes(html, file.includes("/") ? "../" : "");
  if (html !== original) {
    fs.writeFileSync(full, html);
    changed++;
    console.log("updated:", file);
  }
}
console.log(`Done. ${changed} file(s) with JS shell placeholders.`);
