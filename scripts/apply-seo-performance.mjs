#!/usr/bin/env node
/**
 * SEO + mobile performance helpers across HTML.
 * Run: node scripts/apply-seo-performance.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  ROBOTO_STYLESHEET,
  dedupePreconnects,
  headCriticalCss,
  headJsClassScript,
  headStandardStylesheets,
} from "./page-shell.mjs";

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

const DEFER_LEGACY_SHELL =
  /<script src="((?:\.\.\/)?js\/(?:lang-routes|snippet-lang|header-include|lang-picker|nav-include|cta-strip-include|footer-include|whatsapp-float-include|whatsapp-logic|site-config|skip-link-include|gtm-body-include|mobile-nav|ui-reveal|sticky-header|faq-accordion|map-embed-facade|page-header-word|google-reviews)(?:\.min)?\.js(?:\?v=\d+)?)"(?![^>]*\bdefer\b)([^>]*)><\/script>/g;

const DEFER_LEGACY_PARTIAL =
  /<script src="((?:\.\.\/)?partials\/(?:cta-strip|footer|header|nav|whatsapp-float|skip-link|gtm-body|google-reviews-data)-(?:es|en|fr|pt)?(?:\.min)?\.js(?:\?v=\d+)?)"(?![^>]*\bdefer\b)([^>]*)><\/script>/g;

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

function removeGoogleFonts(html) {
  return html
    .replace(/^\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"[^>]*\/>\s*\n/gm, "")
    .replace(/^\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*\/>\s*\n/gm, "")
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/gi, "");
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
    .replace(/^\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"[^>]*\/>\s*\n/gm, "")
    .replace(/^\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*\/>\s*\n/gm, "")
    .replace(/^\s*<link rel="preload" href="(?:\.\.\/)?fonts\/roboto\/roboto-latin-400-normal\.woff2"[^>]*\/>\s*\n/gm, "")
    .replace(/^\s*<link rel="preconnect" href="https:\/\/www\.googletagmanager\.com"[^>]*\/>\s*\n/gm, "")
    .replace(/<link[^>]*bootstrap\.min\.css[^>]*>\s*/gi, "")
    .replace(/<link[^>]*style\.min\.css[^>]*>\s*/gi, "")
    .replace(/<link[^>]*roboto\.min\.css[^>]*>\s*/gi, "")
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

  const cssBlock = headStandardStylesheets(p, { gtm: true });

  const hasBlockingLayout =
    head.includes(`href="${p}css/bootstrap.min.css" rel="stylesheet"`) &&
    head.includes(`href="${p}css/style.min.css" rel="stylesheet"`) &&
    head.includes(`href="${p}${ROBOTO_STYLESHEET}" rel="stylesheet"`) &&
    head.includes(`href="${p}fonts/roboto/roboto-latin-400-normal.woff2"`) &&
    !head.includes(`rel="preload" href="${p}css/bootstrap.min.css" as="style"`);

  if (hasBlockingLayout) {
    return html;
  }

  if (/<\/title>/.test(head)) {
    head = head.replace(/<\/title>\s*\n/, `</title>\n${cssBlock}`);
  } else {
    head = head.replace("<head>", `<head>\n${cssBlock}`);
  }

  return head + body;
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
  out = out.replace(DEFER_LEGACY_PARTIAL, (match, src, rest = "") => {
    if (match.includes(" defer")) {
      return match;
    }
    return `<script src="${src}" defer${rest}></script>`;
  });
  return out.replace(DEFER_LEGACY_SHELL, (match, src, rest = "") => {
    if (match.includes(" defer")) {
      return match;
    }
    return `<script src="${src}" defer${rest}></script>`;
  });
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
