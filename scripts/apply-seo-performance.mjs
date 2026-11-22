#!/usr/bin/env node
/**
 * SEO + mobile performance helpers across HTML.
 * Run: node scripts/apply-seo-performance.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SITE } from "./i18n-urls.mjs";
import {
  dedupePreconnects,
  headCriticalCss,
  headJsClassScript,
} from "./page-shell.mjs";
import {
  normalizeHeadStylesheets,
  removeEmptyNoscript,
  removeGoogleFonts,
} from "./seo-perf-head.mjs";

const LLMS_ALTERNATE = `  <link rel="alternate" type="text/plain" title="llms.txt" href="${SITE}/llms.txt" />\n`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ROBOTS_INDEX =
  '  <meta name="robots" content="index, follow, max-image-preview:large" />\n';
const ROBOTS_NOINDEX =
  '  <meta name="robots" content="noindex, nofollow" />\n';

const LANG_SCRIPTS =
  /<script src="((?:\.\.\/)?js\/(?:head-lang|lang-preference|redirect)(?:\.min)?\.js(?:\?v=\d+)?)"><\/script>/g;

const DEFER_SCRIPTS = [
  "partials/gtm-head.js",
  "js/head-lang.js",
  "js/shell-top.js",
  "js/ui-core.js",
  "js/ui-home.js",
  "js/reviews.js",
];

const DEFER_SHELL_BUNDLE =
  /<script src="((?:\.\.\/)?js\/(?:shell-(?:header|cta|footer|whatsapp)-(?:es|en|fr|pt)|head-lang|shell-top|ui-core|ui-home|reviews)(?:\.min)?\.js(?:\?v=\d+)?)"(?![^>]*\bdefer\b)([^>]*)><\/script>/g;

import { listHtmlFiles } from "./languages.mjs";

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

/** Discovery hint for LLM crawlers (https://llmstxt.org/). */
function ensureLlmsAlternate(html, file) {
  if (isNoindexPage(file)) return html;
  if (html.includes('title="llms.txt"') || html.includes("/llms.txt")) {
    return html;
  }
  if (/<link rel="canonical" href="[^"]+"\s*\/>/.test(html)) {
    return html.replace(
      /(<link rel="canonical" href="[^"]+"\s*\/>\s*\n)/,
      `$1${LLMS_ALTERNATE}`,
    );
  }
  return html.replace(/<\/title>\s*\n/, `</title>\n${LLMS_ALTERNATE}`);
}

function ensureHeadJsClass(html) {
  if (
    html.includes('classList.add("js")') ||
    html.includes("classList.add('js')")
  ) {
    return html;
  }
  const tag = headJsClassScript().trim();
  if (/<meta charset="utf-8" \/>/.test(html)) {
    return html.replace(
      /<meta charset="utf-8" \/>\s*\n/,
      `<meta charset="utf-8" />\n${tag}\n`,
    );
  }
  return html.replace("<head>", `<head>\n${tag}\n`);
}

function ensureCriticalCss(html, file) {
  if (/\/cv\.html$/.test(file)) {
    return html;
  }
  const p = file.includes("/") ? "../" : "";
  const link = headCriticalCss(p).trim();
  let out = html.replace(/<style id="kinesica-critical">[\s\S]*?<\/style>\s*\n?/g, "");
  if (out.includes("critical.min.css")) {
    return out;
  }
  if (/<meta charset="utf-8" \/>/.test(out)) {
    return out.replace(/<meta charset="utf-8" \/>\s*\n/, `<meta charset="utf-8" />\n${link}\n`);
  }
  return out.replace("<head>", `<head>\n${link}\n`);
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
      `<script src="(\\.\\./)?${escaped}(?:\\.min)?\\.js(?:\\?v=\\d+)?"(?![^>]*\\bdefer\\b)([^>]*)><\\/script>`,
      "g",
    );
    out = out.replace(re, (match, prefix = "", rest = "") => {
      if (match.includes(" defer")) {
        return match;
      }
      const base = `${prefix || ""}${src.replace(".js", "")}`;
      const min = match.includes(".min.js") ? ".min.js" : ".js";
      const q = match.match(/\?v=\d+/);
      return `<script src="${base}${min}${q ? q[0] : ""}" defer${rest}></script>`;
    });
  }
  out = out.replace(DEFER_SHELL_BUNDLE, (match, src, rest = "") => {
    if (match.includes(" defer")) {
      return match;
    }
    return `<script src="${src}" defer${rest}></script>`;
  });
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

/** Obsolete comments from legacy Bootstrap / preconnect blocks. */
function removeStaleHeadComments(html) {
  return html
    .replace(
      /\s*<!-- The above 3 meta tags \*must\* come first in the head; any other head content must come \*after\* these tags -->\s*\n?/g,
      "\n",
    )
    .replace(
      /\s*<!-- Preconnect para mejorar carga de recursos externos -->\s*\n?/g,
      "\n",
    );
}

let changed = 0;
for (const file of listHtmlFiles(ROOT)) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  const original = html;
  html = addRobotsMeta(html, file);
  html = ensureLlmsAlternate(html, file);
  html = removeGoogleFonts(html);
  html = ensureHeadJsClass(html);
  html = ensureCriticalCss(html, file);
  html = normalizeHeadStylesheets(html, file);
  html = removeEmptyNoscript(html);
  html = dedupePreconnects(html);
  html = deferLangHeadScripts(html);
  html = deferHeadScripts(html);
  html = fix404FooterStyle(html, file);
  html = removeStaleHeadComments(html);
  if (html !== original) {
    fs.writeFileSync(full, html);
    changed++;
    console.log("updated:", file);
  }
}
console.log(`Done. ${changed} file(s) modified.`);
