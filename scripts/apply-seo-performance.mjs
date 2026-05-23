#!/usr/bin/env node
/**
 * SEO + mobile performance helpers across HTML.
 * Run: node scripts/apply-seo-performance.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CRITICAL_MIN = path.join(ROOT, "css/critical.min.css");

const ROBOTS_INDEX =
  '  <meta name="robots" content="index, follow, max-image-preview:large" />\n';
const ROBOTS_NOINDEX =
  '  <meta name="robots" content="noindex, nofollow" />\n';

const FONT_DISPLAY_SWAP =
  "https://fonts.googleapis.com/css?family=Roboto:300,300i,400,400i,500,500i,700,700i&display=swap";

const LANG_SCRIPTS =
  /<script src="((?:\.\.\/)?js\/(lang-routes|lang-preference|redirect)(?:\.min)?\.js)"><\/script>/g;

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
  return html.replace(/<meta name="viewport"[^>]*\/>\s*\n/, (m) => m + tag);
}

function fontDisplaySwap(html) {
  return html.replace(
    /https:\/\/fonts\.googleapis\.com\/css\?family=Roboto:[^"']+/g,
    FONT_DISPLAY_SWAP,
  );
}

function ensurePreconnectBeforeFonts(html) {
  const block =
    '  <link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n';
  if (
    html.includes("fonts.googleapis.com") &&
    !html.includes('rel="preconnect" href="https://fonts.googleapis.com"')
  ) {
    return html.replace(
      /<link rel="preload" href="https:\/\/fonts\.googleapis\.com/,
      `${block}$&`,
    );
  }
  return html;
}

function removeEmptyNoscript(html) {
  let prev;
  let out = html;
  do {
    prev = out;
    out = out.replace(/<noscript>\s*<\/noscript>\s*\n?/gi, "");
    out = out.replace(
      /<noscript>\s*(?:<noscript>\s*<\/noscript>\s*)+<\/noscript>\s*\n?/gi,
      "",
    );
  } while (out !== prev);
  return out;
}

function asyncCssLink(href) {
  return (
    `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'" />\n` +
    `  <noscript><link href="${href}" rel="stylesheet" /></noscript>\n`
  );
}

function normalizeHeadStylesheets(html, file) {
  if (/\/cv\.html$/.test(file)) {
    return html;
  }
  const p = file.includes("/") ? "../" : "";
  const headEnd = html.indexOf("</head>");
  if (headEnd === -1) {
    return html;
  }

  let head = html.slice(0, headEnd);
  const body = html.slice(headEnd);

  head = head
    .replace(/<!-- Bootstrap -->|<!-- Google Fonts -->|<!-- Font Awesome -->|<!-- Style -->\s*/g, "")
    .replace(/<link[^>]*bootstrap\.min\.css[^>]*>\s*/gi, "")
    .replace(/<link[^>]*style\.min\.css[^>]*>\s*/gi, "")
    .replace(/<link[^>]*font-awesome\.min\.css[^>]*>\s*/gi, "")
    .replace(/<link[^>]*whatsapp\.min\.css[^>]*>\s*/gi, "")
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/gi, "")
    .replace(
      /<noscript>(?:\s*<(?:link|noscript)[^>]*>(?:\s*<\/noscript>)?\s*)+<\/noscript>\s*/gi,
      (block) =>
        /bootstrap|style\.min|font-awesome|whatsapp|fonts\.googleapis/.test(block)
          ? ""
          : block,
    );

  const cssBlock =
    asyncCssLink(`${p}css/bootstrap.min.css`) +
    asyncCssLink(FONT_DISPLAY_SWAP) +
    asyncCssLink(`${p}css/font-awesome.min.css`) +
    asyncCssLink(`${p}css/style.min.css`) +
    asyncCssLink(`${p}css/whatsapp.min.css`);

  if (
    head.includes(`rel="preload" href="${p}css/bootstrap.min.css" as="style"`) &&
    head.includes(`rel="preload" href="${p}css/style.min.css`)
  ) {
    return html;
  }

  if (/<\/title>/.test(head)) {
    head = head.replace(/<\/title>\s*\n/, `</title>\n${cssBlock}`);
  } else {
    head = head.replace("<head>", `<head>\n${cssBlock}`);
  }

  return head + body;
}

function injectCriticalCss(html) {
  if (!fs.existsSync(CRITICAL_MIN)) {
    return html;
  }
  const css = fs.readFileSync(CRITICAL_MIN, "utf8").trim();
  const tag = `  <style id="kinesica-critical">\n${css}\n  </style>\n`;
  if (html.includes('id="kinesica-critical"')) {
    return html.replace(/<style id="kinesica-critical">[\s\S]*?<\/style>\s*\n/, tag);
  }
  if (/<meta charset="utf-8" \/>/.test(html)) {
    return html.replace(/<meta charset="utf-8" \/>\s*\n/, `<meta charset="utf-8" />\n${tag}`);
  }
  return html.replace("<head>", `<head>\n${tag}`);
}

function deferLangHeadScripts(html) {
  return html.replace(LANG_SCRIPTS, (match, src) => {
    if (match.includes(" defer")) {
      return match;
    }
    return `<script src="${src}" defer></script>`;
  });
}

function deferHeadScripts(html) {
  let out = html;
  for (const src of DEFER_SCRIPTS) {
    const escaped = src.replace(/\//g, "\\/");
    const re = new RegExp(
      `<script src="(\\.\\./)?${escaped}(?:\\.min)?\\.js"(?![^>]*\\bdefer\\b)([^>]*)><\\/script>`,
      "g",
    );
    out = out.replace(re, (match, prefix = "", rest = "") => {
      if (match.includes(" defer")) {
        return match;
      }
      const base = `${prefix || ""}${src.replace(".js", "")}`;
      const min = match.includes(".min.js") ? ".min.js" : ".js";
      return `<script src="${base}${min}" defer${rest}></script>`;
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
  html = injectCriticalCss(html);
  html = normalizeHeadStylesheets(html, file);
  html = removeEmptyNoscript(html);
  html = ensurePreconnectBeforeFonts(html);
  html = deferLangHeadScripts(html);
  html = deferHeadScripts(html);
  html = fix404FooterStyle(html, file);
  if (html !== original) {
    fs.writeFileSync(full, html);
    changed++;
    console.log("updated:", file);
  }
}
console.log(`Done. ${changed} file(s) modified.`);
