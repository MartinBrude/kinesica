#!/usr/bin/env node
/**
 * Remove jQuery/Bootstrap JS; use vanilla mobile-nav, sticky-header, faq-accordion.
 * Run: node scripts/migrate-no-jquery.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FAQ_PAGES = new Set([
  "index.html",
  "en/index.html",
  "fr/index.html",
]);

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

function jsPrefix(file) {
  return file.includes("/") ? "../js/" : "js/";
}

function migrateScripts(html, file) {
  const prefix = jsPrefix(file);
  const faqTag = FAQ_PAGES.has(file)
    ? `  <script src="${prefix}faq-accordion.js" defer></script>\n`
    : "";

  const replacement =
    `${faqTag}` +
    `  <script src="${prefix}mobile-nav.js" defer></script>\n`;

  const legacyWithComments =
    /<!-- jQuery \(necessary for Bootstrap's JavaScript plugins\) -->\s*\n\s*<script src="[^"]*jquery\.min\.js"><\/script>\s*\n\s*<!-- Include all compiled plugins \(below\), or include individual files as needed -->\s*\n\s*<script src="[^"]*bootstrap\.min\.js"><\/script>\s*\n\s*<script src="[^"]*menumaker\.js" defer><\/script>\s*\n\s*<script src="[^"]*jquery\.sticky\.js" defer><\/script>\s*\n/;

  const legacyPlain =
    /\s*<script src="[^"]*jquery\.min\.js"><\/script>\s*\n\s*<script src="[^"]*bootstrap\.min\.js"><\/script>\s*\n\s*<script src="[^"]*menumaker\.js" defer><\/script>\s*\n\s*<script src="[^"]*jquery\.sticky\.js" defer><\/script>\s*\n/;

  if (legacyWithComments.test(html)) {
    html = html.replace(legacyWithComments, replacement);
  } else if (legacyPlain.test(html)) {
    html = html.replace(legacyPlain, replacement);
  }

  return html;
}

function removeHiddenXs(html) {
  return html.replace(
    /class="nav navbar-nav navbar-right hidden-xs"/g,
    'class="nav navbar-nav navbar-right"',
  );
}

let changed = 0;
for (const file of listHtmlFiles()) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  const original = html;
  html = migrateScripts(html, file);
  html = removeHiddenXs(html);
  if (html !== original) {
    fs.writeFileSync(full, html);
    changed++;
    console.log("updated:", file);
  }
}

const cvBuilder = path.join(ROOT, "scripts/build-cv-html.mjs");
let cvHtml = fs.readFileSync(cvBuilder, "utf8");
const cvOriginal = cvHtml;
cvHtml = cvHtml.replace(
  /  <script src="\$\{prefix\}js\/menumaker\.js" defer><\/script>\s*\n  <script src="\$\{prefix\}js\/jquery\.sticky\.js" defer><\/script>\s*\n/,
  '  <script src="${prefix}js/mobile-nav.js" defer></script>\n',
);
cvHtml = cvHtml.replace(
  /<!-- jQuery \(necessary for Bootstrap's JavaScript plugins\) -->\s*\n  <script src="\$\{prefix\}js\/jquery\.min\.js"><\/script>\s*\n  <!-- Include all compiled plugins \(below\), or include individual files as needed -->\s*\n  <script src="\$\{prefix\}js\/bootstrap\.min\.js"><\/script>\s*\n/,
  "",
);
cvHtml = cvHtml.replace(
  /class="nav navbar-nav navbar-right hidden-xs"/g,
  'class="nav navbar-nav navbar-right"',
);
if (cvHtml !== cvOriginal) {
  fs.writeFileSync(cvBuilder, cvHtml);
  console.log("updated: scripts/build-cv-html.mjs");
}

console.log(`Done. ${changed} HTML file(s) modified.`);
