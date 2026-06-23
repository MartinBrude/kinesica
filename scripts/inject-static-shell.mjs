#!/usr/bin/env node
/**
 * Ensure JS-injected site shell: empty placeholders + bundled scripts.
 * Run: node scripts/inject-static-shell.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { headerShellMarkup } from "./header-shell.mjs";
import { langBundlePath } from "./js-bundles.mjs";
import { bodyFooterAndUiScripts } from "./page-shell.mjs";
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
    /<div id="site-footer-root"([^>]*)>\s*<footer class="footer">[\s\S]*?<\/div>\s*\n\s*(?=<script src="[^"]*shell-footer)/;
  if (!filled.test(html)) {
    const legacy =
      /<div id="site-footer-root"([^>]*)>\s*<footer class="footer">[\s\S]*?<\/div>\s*\n\s*(?=<script src="[^"]*site-config)/;
    if (!legacy.test(html)) {
      return html;
    }
    return html.replace(
      legacy,
      `<div id="site-footer-root"$1></div>\n\n  `,
    );
  }
  return html.replace(
    filled,
    `<div id="site-footer-root"$1></div>\n\n  `,
  );
}

function stripLegacyAfterBundle(html, bundleNeedle, legacyPatterns) {
  if (!html.includes(bundleNeedle)) {
    return html;
  }
  let out = html;
  for (const re of legacyPatterns) {
    out = out.replace(re, "");
  }
  return out;
}

function stripLegacyShellScripts(html) {
  let out = html;
  out = stripLegacyAfterBundle(out, "shell-header-", [
    /\s*<script src="[^"]*\/lang-routes\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/snippet-lang\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*partials\/header-(?:es|en|fr|pt)\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/header-include\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/lang-picker\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*partials\/nav-(?:es|en|fr|pt)\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/nav-include\.min\.js[^"]*" defer><\/script>/g,
  ]);
  out = stripLegacyAfterBundle(out, "shell-cta-", [
    /\s*<script src="[^"]*partials\/cta-strip-(?:es|en|fr|pt)\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/cta-strip-include\.min\.js[^"]*" defer><\/script>/g,
  ]);
  out = stripLegacyAfterBundle(out, "shell-footer-", [
    /\s*<script src="[^"]*\/site-config\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*partials\/footer-(?:es|en|fr|pt)\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/footer-include\.min\.js[^"]*" defer><\/script>/g,
  ]);
  out = stripLegacyAfterBundle(out, "shell-whatsapp-", [
    /\s*<script src="[^"]*partials\/whatsapp-float-(?:es|en|fr|pt)\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/whatsapp-float-include\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/whatsapp-logic\.min\.js[^"]*" defer><\/script>/g,
  ]);
  out = stripLegacyAfterBundle(out, "ui-core.min.js", [
    /\s*<script src="[^"]*\/mobile-nav\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/ui-reveal\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/sticky-header\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/page-header-word\.min\.js[^"]*" defer><\/script>/g,
  ]);
  out = stripLegacyAfterBundle(out, "head-lang.min.js", [
    /\s*<script src="[^"]*\/lang-preference\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/redirect\.min\.js[^"]*" defer><\/script>/g,
  ]);
  out = stripLegacyAfterBundle(out, "shell-top.min.js", [
    /\s*<script src="[^"]*partials\/skip-link\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/skip-link-include\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*partials\/gtm-body\.min\.js[^"]*" defer><\/script>/g,
    /\s*<script src="[^"]*\/gtm-body-include\.min\.js[^"]*" defer><\/script>/g,
  ]);
  return out;
}

function ensureHeadLangBundle(html, file) {
  const prefix = file.includes("/") ? "../" : "";
  const tag = `  <script src="${prefix}js/head-lang.min.js" defer></script>\n`;
  if (html.includes("head-lang.min.js")) {
    return html;
  }
  const legacy =
    /\s*<script src="[^"]*lang-preference\.min\.js[^"]*" defer><\/script>\s*\n?\s*<script src="[^"]*redirect\.min\.js[^"]*" defer><\/script>/;
  if (legacy.test(html)) {
    return html.replace(legacy, `\n${tag}`);
  }
  return html;
}

function ensureBodyShellTop(html, file) {
  if (!html.includes('id="site-skip-link-root"') || html.includes("shell-top.min.js")) {
    return html;
  }
  const prefix = file.includes("/") ? "../" : "";
  const top =
    `  <div id="site-skip-link-root"></div>\n` +
    `  <div id="site-gtm-body-root"></div>\n` +
    `  <script src="${prefix}js/shell-top.min.js" defer></script>\n`;
  const legacy =
    /(<div id="site-skip-link-root"><\/div>\s*)<script src="[^"]*skip-link[^"]*" defer><\/script>\s*<script src="[^"]*skip-link-include[^"]*" defer><\/script>\s*(?:<div id="site-gtm-body-root"><\/div>\s*<script src="[^"]*gtm-body[^"]*" defer><\/script>\s*<script src="[^"]*gtm-body-include[^"]*" defer><\/script>\s*)?/;
  if (legacy.test(html)) {
    return html.replace(legacy, top);
  }
  return html;
}

function ensureBodyFooterBundles(html, file) {
  if (!html.includes('id="site-footer-root"')) {
    return html;
  }
  const lang = expectedLangFromFile(file);
  const prefix = file.includes("/") ? "../" : "";
  const l = partialLang(lang);
  if (html.includes(`shell-footer-${l}.min.js`) && html.includes("ui-core.min.js")) {
    return html;
  }
  const block = bodyFooterAndUiScripts(lang, prefix);
  const re = new RegExp(
    `<div id="site-footer-root"[^>]*><\\/div>[\\s\\S]*?(?=<\\/body>)`,
  );
  if (re.test(html)) {
    return html.replace(re, `${block}\n`);
  }
  return html;
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
  const l = partialLang(lang);
  const bundle = langBundlePath("header", lang).replace(/^js\//, "");
  const emptyRoot = `<div id="site-header-root" data-header-lang="${l}"></div>`;
  const block = new RegExp(
    `<div id="site-header-root"[^>]*><\\/div>\\s*(?:${shellScriptTagPattern("shell-header-")}|${shellScriptTagPattern("lang-routes")}${shellScriptTagPattern("snippet-lang")}${shellScriptTagPattern("partials\\/header-")}${shellScriptTagPattern("header-include")}${shellScriptTagPattern("lang-picker")}${shellScriptTagPattern("partials\\/nav-")}${shellScriptTagPattern("nav-include")})`,
  );
  if (block.test(html)) {
    return html.replace(block, shell.trimEnd());
  }
  if (html.includes(emptyRoot) && !html.includes(bundle)) {
    return html.replace(emptyRoot, shell.trimEnd());
  }
  return html;
}

function ensureCtaScripts(html, file) {
  if (!html.includes('id="site-cta-strip-root"')) {
    return html;
  }
  const lang = expectedLangFromFile(file);
  const prefix = file.includes("/") ? "../" : "";
  const l = partialLang(lang);
  const ctaBundle = `<script src="${prefix}${langBundlePath("cta", lang)}" defer></script>`;
  const block = new RegExp(
    `(<div id="site-cta-strip-root"[^>]*><\\/div>)\\s*(?:${shellScriptTagPattern("shell-cta-")}|${shellScriptTagPattern("cta-strip-")}${shellScriptTagPattern("cta-strip-include")})`,
  );
  if (block.test(html)) {
    return html.replace(block, `$1\n  ${ctaBundle}`);
  }
  if (html.includes(ctaBundle)) {
    return html;
  }
  return html.replace(
    /(<div id="site-cta-strip-root"[^>]*><\/div>)/,
    `$1\n  ${ctaBundle}`,
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
  html = ensureHeadLangBundle(html, file);
  html = ensureBodyShellTop(html, file);
  html = ensureBodyFooterBundles(html, file);
  html = stripLegacyShellScripts(html);
  if (html !== original) {
    fs.writeFileSync(full, html);
    changed++;
    console.log("updated:", file);
  }
}
console.log(`Done. ${changed} file(s) with JS shell placeholders.`);
