#!/usr/bin/env node
/**
 * Rebuild articulos.html index body: card grid for all pathologies.
 * Run: node scripts/build-articulos-pages.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PATHOLOGIES } from "./pathology-content.mjs";
import { ARTICLES_INDEX_UI } from "./articles-index-content.mjs";
import { cardHue } from "./article-thumbnail-icons.mjs";
import { repoPath } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import { escHtml, patchPageMeta } from "./html-utils.mjs";
import {
  assetPrefixForLang,
  headLangDeferScripts,
  pageCaptionMarkup,
} from "./page-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function articleThumbSrc(stem, lang) {
  const rel = `images/articles/${stem}.svg`;
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return null;
  return `${assetPrefixForLang(lang)}${rel}`;
}

function renderIntro(ui) {
  const link = ui.introLink;
  if (link) {
    return `${escHtml(link.before)}<a href="kinesiologia.html">${escHtml(link.label)}</a>${escHtml(link.after)}`;
  }
  return escHtml(ui.intro ?? "");
}

function buildMain(lang) {
  const ui = ARTICLES_INDEX_UI[lang];

  const cards = PATHOLOGIES.map((p, i) => {
    const data = p[lang];
    const href = `${p.stem}.html`;
    const thumb = articleThumbSrc(p.stem, lang);
    const media = thumb
      ? `<span class="articles-index-card-media"><img src="${thumb}" alt="" width="320" height="180" loading="lazy" decoding="async" /></span>`
      : `<span class="articles-index-card-media articles-index-card-media--placeholder" aria-hidden="true"></span>`;

    return `          <a href="${href}" class="articles-index-card ui-reveal" style="--card-i: ${i}; --card-hue: ${cardHue(i)}">
            ${media}
            <span class="articles-index-card-body">
              <span class="articles-index-card-label">${escHtml(data.breadcrumb)}</span>
              <span class="articles-index-card-lead">${escHtml(data.lead)}</span>
              <span class="articles-index-card-cta">${ui.readMore}<span class="articles-index-card-arrow" aria-hidden="true">→</span></span>
            </span>
          </a>`;
  }).join("\n");

  return `    <section class="content articles-index">
      <div class="container">
        <div class="articles-index-intro section-intro section-intro--compact">
          <div class="section-title mb60 text-center">
            <h2 class="heading-line-center">${escHtml(ui.introTitle)}</h2>
            <p class="section-lead">${renderIntro(ui)}</p>
          </div>
        </div>
        <div class="articles-index-grid">
${cards}
        </div>
        <blockquote class="articles-index-quote ui-reveal">
          <p>“${ui.quote}”</p>
          <footer>— ${ui.quoteAuthor}</footer>
        </blockquote>
      </div>
    </section>`;
}

function ensureHeadLangBundle(html, lang) {
  if (html.includes("head-lang")) {
    return html;
  }
  const tag = headLangDeferScripts(assetPrefixForLang(lang));
  return html.replace(
    /(<meta name="theme-color"[^>]*\/>\s*\n)/,
    `$1${tag}`,
  );
}

/** EN/FR articulos historically omitted </main> before the CTA strip. */
function ensureMainClosedBeforeCta(html) {
  if (!/<main id="main"/.test(html) || /<\/main>/.test(html)) {
    return html;
  }
  return html.replace(
    /(<section class="content articles-index">[\s\S]*?<\/section>)\s*(?=<div id="site-cta-strip-root")/,
    "$1\n</main>\n",
  );
}

function replaceContentBlock(html, main) {
  const articlesIndexRe =
    /[ \t]*<section class="content articles-index">[\s\S]*?<\/section>\s*(?=<div id="site-cta-strip-root")/;
  if (articlesIndexRe.test(html)) {
    return html.replace(articlesIndexRe, `${main}\n`);
  }
  const patterns = [
    /<section class="content[^"]*">[\s\S]*?<\/section>\s*(?=<div id="site-cta-strip-root")/,
    /<div class="content">[\s\S]*?<\/div>\s*(?=<div id="site-cta-strip-root")/,
    /<section class="content[^"]*">[\s\S]*?<\/section>\s*(?=<\/main>)/,
    /<div class="content">[\s\S]*?<\/div>\s*(?=<\/main>)/,
  ];
  for (const re of patterns) {
    if (re.test(html)) {
      return html.replace(re, `${main}\n`);
    }
  }
  return null;
}

function patchArticulosFile(rel, lang) {
  const full = path.join(ROOT, rel);
  let html = fs.readFileSync(full, "utf8");
  const ui = ARTICLES_INDEX_UI[lang];

  const main = buildMain(lang);
  const patched = replaceContentBlock(html, main);
  if (!patched) {
    console.warn("skip (no content section):", rel);
    return false;
  }
  html = patched;

  html = html.replace(
    /<div class="page-caption">\s*(?:<span class="page-header-word"[^>]*>[^<]*<\/span>|<h1 class="page-title[^"]*">[^<]*<\/h1>)\s*<\/div>/,
    pageCaptionMarkup(ui.pageTitle, { variant: "title" }).trim(),
  );

  const homeHref = lang === "es" ? "index.html" : "index.html";
  html = html.replace(
    /<li><a href="[^"]*">[^<]*<\/a><\/li>\s*<li class="active">[^<]*<\/li>/,
    `<li><a href="${homeHref}">${ui.homeLabel}</a></li>\n            <li class="active">${ui.breadcrumb}</li>`,
  );

  html = patchPageMeta(html, {
    title: ui.metaTitle,
    description: ui.metaDescription,
    pageTitle: ui.pageTitle,
  });

  html = ensureMainClosedBeforeCta(html);
  html = ensureHeadLangBundle(html, lang);

  fs.writeFileSync(full, html);
  return true;
}

let n = 0;
for (const lang of LANG_CODES) {
  if (patchArticulosFile(repoPath(lang, "articulos"), lang)) n++;
}
console.log(`Rebuilt ${n} articulos index page(s).`);
