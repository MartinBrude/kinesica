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

function deferLangScripts(html) {
  let out = html;
  for (const name of ["lang-routes.js", "lang-preference.js", "redirect.js"]) {
    out = out.replace(
      new RegExp(`<script src="(\\.\\./)?js/${name}"><\\/script>`, "g"),
      '<script src="$1js/' + name + '" defer></script>',
    );
  }
  return out;
}

function fontDisplaySwap(html) {
  return html.replace(
    /https:\/\/fonts\.googleapis\.com\/css\?family=Roboto:[^"']+/g,
    FONT_DISPLAY_SWAP,
  );
}

function asyncFontAwesome(html) {
  if (html.includes("font-awesome.min.css") && html.includes('media="print"')) {
    return html;
  }
  return html.replace(
    /<link href="(\.\.\/)?css\/font-awesome\.min\.css" rel="stylesheet" \/>/g,
    '<link href="$1css/font-awesome.min.css" rel="stylesheet" media="print" onload="this.media=\'all\'" />\n  <noscript><link href="$1css/font-awesome.min.css" rel="stylesheet" /></noscript>',
  );
}

function fixMapIframe(html) {
  return html.replace(
    /<iframe\s+src="(https:\/\/www\.google\.com\/maps\/embed[^"]*)"\s+style="width: 100%; height: 370px; border: 0; display: block"\s+allowfullscreen=""\s+loading="lazy"/g,
    '<iframe class="map-embed" src="$1" allowfullscreen="" loading="lazy"',
  );
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
  html = deferLangScripts(html);
  html = fontDisplaySwap(html);
  html = asyncFontAwesome(html);
  html = fixMapIframe(html);
  html = fix404FooterStyle(html, file);
  if (html !== original) {
    fs.writeFileSync(full, html);
    changed++;
    console.log("updated:", file);
  }
}
console.log(`Done. ${changed} file(s) modified.`);
