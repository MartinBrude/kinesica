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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cardHue(index) {
  const hues = [198, 168, 205, 178, 192, 210, 165, 188];
  return hues[index % hues.length];
}

function buildMain(lang) {
  const ui = ARTICLES_INDEX_UI[lang];
  const prefix = lang === "es" ? "" : "../";

  const cards = PATHOLOGIES.map((p, i) => {
    const data = p[lang];
    const href = lang === "es" ? `${p.stem}.html` : `${p.stem}.html`;
    const img =
      p.image && p.image !== "hero-img.jpg"
        ? `images/${p.image}`
        : null;
    const media = img
      ? `<span class="articles-index-card-media"><img src="${prefix}${img}" alt="" width="320" height="180" loading="lazy" /></span>`
      : `<span class="articles-index-card-media articles-index-card-media--placeholder" aria-hidden="true"></span>`;

    return `          <a href="${href}" class="articles-index-card ui-reveal" style="--card-i: ${i}; --card-hue: ${cardHue(i)}">
            ${media}
            <span class="articles-index-card-body">
              <span class="articles-index-card-label">${esc(data.breadcrumb)}</span>
              <span class="articles-index-card-lead">${esc(data.lead)}</span>
              <span class="articles-index-card-cta">${ui.readMore}<span class="articles-index-card-arrow" aria-hidden="true">→</span></span>
            </span>
          </a>`;
  }).join("\n");

  return `    <section class="content articles-index">
      <div class="container">
        <p class="articles-index-intro ui-reveal">${ui.intro}</p>
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

function patchArticulosFile(rel, lang) {
  const full = path.join(ROOT, rel);
  let html = fs.readFileSync(full, "utf8");
  const ui = ARTICLES_INDEX_UI[lang];

  const main = buildMain(lang);
  const contentRe = /<section class="content[^"]*">[\s\S]*?<\/section>\s*(?=<\/main>)/;
  if (!contentRe.test(html)) {
    console.warn("skip (no content section):", rel);
    return false;
  }
  html = html.replace(contentRe, `${main}\n`);

  html = html.replace(
    /<div class="page-caption">\s*<h1 class="page-title">[^<]*<\/h1>\s*<\/div>/,
    `<div class="page-caption">
              <span class="page-header-word" aria-hidden="true">${esc(ui.pageTitle)}</span>
            </div>`,
  );

  const homeHref = lang === "es" ? "index.html" : "index.html";
  html = html.replace(
    /<li><a href="[^"]*">[^<]*<\/a><\/li>\s*<li class="active">[^<]*<\/li>/,
    `<li><a href="${homeHref}">${ui.homeLabel}</a></li>\n            <li class="active">${ui.breadcrumb}</li>`,
  );

  fs.writeFileSync(full, html);
  return true;
}

let n = 0;
if (patchArticulosFile("articulos.html", "es")) n++;
if (patchArticulosFile("en/articulos.html", "en")) n++;
if (patchArticulosFile("fr/articulos.html", "fr")) n++;
console.log(`Rebuilt ${n} articulos index page(s).`);
