#!/usr/bin/env node
/**
 * SEO + mobile performance helpers across HTML.
 * Run: node scripts/apply-seo-performance.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ROBOTS_INDEX =
  '  <meta name="robots" content="index, follow, max-image-preview:large" />\n';
const ROBOTS_NOINDEX =
  '  <meta name="robots" content="noindex, nofollow" />\n';

const FONT_DISPLAY_SWAP =
  "https://fonts.googleapis.com/css?family=Roboto:300,300i,400,400i,500,500i,700,700i&display=swap";

const ASYNC_CSS =
  /<link (?=[^>]*href="(\.\.\/)?css\/(font-awesome\.min|whatsapp(?:\.min)?)\.css")[^>]*rel="stylesheet"[^>]*\/>/g;

const DEFER_SCRIPTS = [
  "partials/gtm-head.js",
  "js/site-config.js",
  "partials/gtm-body.js",
  "js/gtm-body-include.js",
  "partials/skip-link.js",
  "js/skip-link-include.js",
];

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

function isNoindexPage(file) {
  return /(^|\/)(404|404-router)\.html$/.test(file);
}

function addRobotsMeta(html, file) {
  if (html.includes('name="robots"')) {
    return html;
  }
  const tag = isNoindexPage(file) ? ROBOTS_NOINDEX : ROBOTS_INDEX;
  return html.replace(
    /<meta name="viewport"[^>]*\/>\s*\n/,
    (m) => m + tag,
  );
}

function fontDisplaySwap(html) {
  return html.replace(
    /https:\/\/fonts\.googleapis\.com\/css\?family=Roboto:[^"']+/g,
    FONT_DISPLAY_SWAP,
  );
}

/** Roboto bloqueante: evita reflow del menú y del título al cargar (regresión bed1d6f). */
function preloadRoboto(html) {
  if (html.includes('rel="preload"') && html.includes("fonts.googleapis.com")) {
    return html;
  }
  return html.replace(
    /(<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin \/>)/,
    '$1\n  <link rel="preload" href="https://fonts.googleapis.com/css?family=Roboto:300,300i,400,400i,500,500i,700,700i&display=swap" as="style" />',
  );
}

function syncRobotoStylesheet(html) {
  const asyncRoboto =
    /<link href="(https:\/\/fonts\.googleapis\.com\/css\?family=Roboto:[^"]+)" rel="stylesheet"\s+media="print" onload="this\.media='all'" \/>\s*<noscript>\s*<link href="\1" rel="stylesheet" \/>\s*<\/noscript>\s*/g;
  let out = html.replace(
    asyncRoboto,
    '<link href="$1" rel="stylesheet" />\n',
  );
  const asyncRobotoOnly =
    /<link href="(https:\/\/fonts\.googleapis\.com\/css\?family=Roboto:[^"]+)" rel="stylesheet"\s+media="print" onload="this\.media='all'" \/>\s*/g;
  out = out.replace(
    asyncRobotoOnly,
    '<link href="$1" rel="stylesheet" />\n',
  );
  return out;
}

function fixBrokenFontAwesomeNoscript(html) {
  return html.replace(
    /<noscript><link (href="(?:\.\.\/)?css\/font-awesome\.min\.css") rel="stylesheet" media="print" onload="this\.media='all'" \/>\s*<noscript><link \1 rel="stylesheet" \/><\/noscript><\/noscript>/g,
    '<noscript><link $1 rel="stylesheet" /></noscript>',
  );
}

function asyncNonCriticalCss(html) {
  return html.replace(ASYNC_CSS, (tag) => {
    if (tag.includes('media="print"')) {
      return tag;
    }
    const href = tag.match(/href="([^"]+)"/)[1];
    return (
      `<link href="${href}" rel="stylesheet" media="print" onload="this.media='all'" />\n` +
      `  <noscript><link href="${href}" rel="stylesheet" /></noscript>`
    );
  });
}

function deferHeadScripts(html) {
  let out = html;
  for (const src of DEFER_SCRIPTS) {
    const escaped = src.replace(/\//g, "\\/");
    const re = new RegExp(
      `<script src="(\\.\\./)?${escaped}"(?![^>]*\\bdefer\\b)([^>]*)><\\/script>`,
      "g",
    );
    out = out.replace(re, (match, prefix = "", rest = "") => {
      if (match.includes(" defer")) {
        return match;
      }
      return `<script src="${prefix || ""}${src}" defer${rest}></script>`;
    });
  }
  return out;
}

function fix404FooterStyle(html, file) {
  if (!/\/404\.html$/.test(file)) {
    return html;
  }
  return html.replace(
    /<div class="container text-center" style="padding: 20px 0; color: #aaa">/g,
    '<div class="container text-center footer-minimal">',
  );
}

let changed = 0;
for (const file of listHtmlFiles()) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  const original = html;
  html = addRobotsMeta(html, file);
  html = fontDisplaySwap(html);
  html = preloadRoboto(html);
  html = syncRobotoStylesheet(html);
  html = fixBrokenFontAwesomeNoscript(html);
  html = asyncNonCriticalCss(html);
  html = deferHeadScripts(html);
  html = fix404FooterStyle(html, file);
  if (html !== original) {
    fs.writeFileSync(full, html);
    changed++;
    console.log("updated:", file);
  }
}
console.log(`Done. ${changed} file(s) modified.`);
