#!/usr/bin/env node
/**
 * Generate articulos.html index pages (ES / EN / FR / PT) from page-shell.
 * Run: node scripts/build-articulos-pages.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PATHOLOGIES } from "./pathology-content.mjs";
import { ARTICLES_INDEX_UI } from "./articles-index-content.mjs";
import {
  ARTICLE_CATEGORIES,
  articleCountLabel,
} from "./articles-categories.mjs";
import { cardHue } from "./article-thumbnail-icons.mjs";
import {
  absoluteUrl,
  HTML_LANG,
  repoPath,
  SCHEMA_LANGUAGE,
  sitePath,
  SITE,
} from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import { headerShellMarkup } from "./header-shell.mjs";
import { breadcrumbListSchema, escHtml } from "./html-utils.mjs";
import {
  LOCALE,
  assetPrefixForLang,
  bodyFooterAndUiScripts,
  bodyShellTop,
  ctaStripPlaceholder,
  headCriticalCss,
  headFavicon,
  headJsClassScript,
  headLangDeferScripts,
  headSeoBlock,
  headStandardStylesheets,
  pageBreadcrumbSection,
  pageCaptionMarkup,
  pageHeaderSection,
  socialImageUrl,
} from "./page-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTICLES_OG_IMAGE = "post-img.jpg";

const pathologyByStem = new Map(
  PATHOLOGIES.map((p, i) => [p.stem, { pathology: p, index: i }]),
);

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

function renderCard(p, localIndex, cardLast, globalIndex, lang, ui) {
  const data = p[lang];
  const href = `${p.stem}.html`;
  const thumb = articleThumbSrc(p.stem, lang);
  const media = thumb
    ? `<span class="articles-index-card-media"><img src="${thumb}" alt="" width="320" height="180" loading="lazy" decoding="async" /></span>`
    : `<span class="articles-index-card-media articles-index-card-media--placeholder" aria-hidden="true"></span>`;

  return `                <a href="${href}" class="articles-index-card" style="--card-i: ${localIndex}; --card-last: ${cardLast}; --card-hue: ${cardHue(globalIndex)}">
                  ${media}
                  <span class="articles-index-card-body">
                    <span class="articles-index-card-label">${escHtml(data.breadcrumb)}</span>
                    <span class="articles-index-card-lead">${escHtml(data.lead)}</span>
                    <span class="articles-index-card-cta">${ui.readMore}<span class="articles-index-card-arrow" aria-hidden="true">→</span></span>
                  </span>
                </a>`;
}

function renderCategory(category, catIndex, lang, ui) {
  const copy = category[lang];
  const stems = category.stems.filter((stem) => pathologyByStem.has(stem));
  const cardLast = stems.length - 1;
  const cards = stems
    .map((stem, localIndex) => {
      const entry = pathologyByStem.get(stem);
      return renderCard(entry.pathology, localIndex, cardLast, entry.index, lang, ui);
    })
    .join("\n");

  const panelId = `articles-cat-${category.id}`;

  return `          <div class="articles-category ui-reveal" style="--cat-i: ${catIndex}" data-category="${category.id}">
            <button type="button" class="articles-category-trigger" aria-expanded="false" aria-controls="${panelId}">
              <span class="articles-category-trigger-inner">
                <span class="articles-category-body">
                  <span class="articles-category-heading">
                    <span class="articles-category-title">${escHtml(copy.title)}</span>
                    <span class="articles-category-count">${escHtml(articleCountLabel(lang, stems.length))}</span>
                  </span>
                  <span class="articles-category-desc">${escHtml(copy.description)}</span>
                </span>
                <span class="articles-category-chevron" aria-hidden="true"></span>
              </span>
            </button>
            <div id="${panelId}" class="articles-category-panel" aria-hidden="true">
              <div class="articles-category-panel-inner">
                <div class="articles-index-grid articles-index-grid--nested">
${cards}
                </div>
              </div>
            </div>
          </div>`;
}

function buildMain(lang) {
  const ui = ARTICLES_INDEX_UI[lang];

  const categories = ARTICLE_CATEGORIES.map((category, i) =>
    renderCategory(category, i, lang, ui),
  ).join("\n");

  return `    <section class="content articles-index">
      <div class="container">
        <div class="articles-index-intro section-intro section-intro--compact">
          <div class="section-title mb60 text-center">
            <h2 class="heading-line-center">${escHtml(ui.introTitle)}</h2>
            <p class="section-lead">${renderIntro(ui)}</p>
          </div>
        </div>
        <div class="articles-categories" id="articles-categories">
${categories}
        </div>
        <blockquote class="articles-index-quote ui-reveal">
          <p>“${escHtml(ui.quote)}”</p>
          <footer>— ${escHtml(ui.quoteAuthor)}</footer>
        </blockquote>
      </div>
    </section>`;
}

function buildHtml(lang) {
  const ui = ARTICLES_INDEX_UI[lang];
  const p = assetPrefixForLang(lang);
  const stem = "articulos";
  const canonical = absoluteUrl(lang, stem);
  const imgUrl = socialImageUrl(ARTICLES_OG_IMAGE);
  const imageAlt = ui.twitterImageAlt ?? ui.metaTitle;

  const breadcrumbSchema = breadcrumbListSchema([
    { name: ui.homeLabel, item: absoluteUrl(lang, "index") },
    { name: ui.breadcrumb, item: canonical },
  ]);

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: ui.pageTitle,
    headline: ui.pageTitle,
    description: ui.metaDescription,
    image: imgUrl,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    inLanguage: SCHEMA_LANGUAGE[lang],
    isPartOf: { "@type": "WebSite", name: "Kinésica", url: SITE },
  };

  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">

<head>
${headFavicon(p)}  <meta charset="utf-8" />
${headJsClassScript()}${headCriticalCss(p)}  <meta http-equiv="content-language" content="${LOCALE[lang]}" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#005f99" />
${headLangDeferScripts(p)}${headSeoBlock({
    lang,
    stem,
    title: ui.metaTitle,
    description: ui.metaDescription,
    type: "website",
    image: imgUrl,
    imageAlt,
    canonical,
  })}
${headStandardStylesheets(p)}  <script src="${p}partials/gtm-head.min.js" defer></script>
  <script type="application/ld+json">
${JSON.stringify(breadcrumbSchema, null, 6).replace(/^/gm, "      ")}
    </script>
  <script type="application/ld+json">
${JSON.stringify(collectionSchema, null, 6).replace(/^/gm, "      ")}
    </script>
</head>

<body>
${bodyShellTop(p)}${headerShellMarkup(lang, p)}
  <main id="main" tabindex="-1">
${pageHeaderSection(pageCaptionMarkup(ui.pageTitle, { variant: "title" }))}
${pageBreadcrumbSection({
    homeHref: sitePath(lang, "index"),
    homeLabel: ui.homeLabel,
    activeLabel: ui.breadcrumb,
  })}
${buildMain(lang)}
  </main>
${ctaStripPlaceholder(lang, p)}
${bodyFooterAndUiScripts(lang, p)}
</body>

</html>
`;
}

let written = 0;
for (const lang of LANG_CODES) {
  const rel = repoPath(lang, "articulos");
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buildHtml(lang));
  written++;
  console.log("wrote:", rel);
}

console.log(`Done. ${written} articulos index page(s).`);
