/**
 * Shared HTML shell fragments for page builders and apply-seo-performance.mjs.
 */
import path from "path";
import { fileURLToPath } from "url";
import { absoluteUrl, HTML_LANG } from "./i18n-urls.mjs";
import { faviconCacheQuery } from "./favicon-version.mjs";
import { OG_LOCALE, ogLocaleFor, partialLang } from "./languages.mjs";
import { escHtml, hreflangLinks } from "./html-utils.mjs";
import {
  buildClinicOnly,
  buildHomeGraph,
  ldJsonScript,
} from "./schema-local-business.mjs";

export const ROBOTO_STYLESHEET = "css/roboto.min.css";

/** Open Graph / Twitter share image (1200×630). Generated from hero-img.jpg. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const SITE_OG_IMAGE =
  "https://www.kinesica.com.ar/images/og-image.jpg";

/** Map legacy hero art to the correct social preview asset. */
export function socialImageUrl(filename) {
  const file =
    !filename || filename === "hero-img.jpg" ? "og-image.jpg" : filename;
  return `https://www.kinesica.com.ar/images/${file}`;
}

export function socialImageDimensions(imageUrl) {
  if (
    imageUrl === SITE_OG_IMAGE ||
    imageUrl.endsWith("/images/og-image.jpg")
  ) {
    return { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
  }
  return null;
}

export const LOCALE = HTML_LANG;
export { OG_LOCALE };

export function assetPrefixForLang(lang) {
  return lang === "es" ? "" : "../";
}

export { partialLang };

/** Non-blocking: icons and WhatsApp widget only. */
export function asyncCssLink(href) {
  return (
    `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'" />\n` +
    `  <noscript><link href="${href}" rel="stylesheet" /></noscript>\n`
  );
}

/** Blocking: layout + typography; avoids FOUC while async CSS loads. */
export function syncCssLink(href) {
  return `  <link href="${href}" rel="stylesheet" />\n`;
}

/** Preload regular Roboto (hero/body default weight). */
export function headRobotoPreload(prefix) {
  return (
    `  <link rel="preload" href="${prefix}fonts/roboto/roboto-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin />\n`
  );
}

export function headRobotoStylesheet(prefix) {
  return syncCssLink(`${prefix}${ROBOTO_STYLESHEET}`);
}

export function headPreconnectGtm() {
  return '  <link rel="preconnect" href="https://www.googletagmanager.com" />\n';
}

/** LCP hero: smaller asset on narrow viewports (see images/hero-img-mobile.*). */
export function headHeroImagePreload(prefix) {
  return (
    `  <link rel="preload" as="image" href="${prefix}images/hero-img-mobile.webp" type="image/webp" media="(max-width: 991px)" fetchpriority="high" />\n` +
    `  <link rel="preload" as="image" href="${prefix}images/hero-img.jpg" media="(min-width: 992px)" fetchpriority="high" />\n`
  );
}

/** Standard site CSS: blocking layout + async icons/WhatsApp. */
export function headStandardStylesheets(prefix, { gtm = true } = {}) {
  return (
    headRobotoPreload(prefix) +
    (gtm ? headPreconnectGtm() : "") +
    syncCssLink(`${prefix}css/bootstrap.min.css`) +
    headRobotoStylesheet(prefix) +
    asyncCssLink(`${prefix}css/font-awesome.min.css`) +
    syncCssLink(`${prefix}css/style.min.css`) +
    asyncCssLink(`${prefix}css/whatsapp.min.css`)
  );
}

export function headFavicon(prefix) {
  const q = faviconCacheQuery(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  );
  return (
    `  <link rel="icon" type="image/svg" href="${prefix}images/favicon.svg${q}" />\n` +
    `  <link rel="apple-touch-icon" href="${prefix}images/apple-touch-icon.png${q}" />\n`
  );
}

/** Marks JS before body paint so lang-picker CSS does not flash inline links. */
export function headJsClassScript() {
  return '  <script>document.documentElement.classList.add("js");</script>\n';
}

export function headLangScripts(prefix) {
  return (
    headJsClassScript() +
    headLangDeferScripts(prefix)
  );
}

export function headLangDeferScripts(prefix) {
  return `  <script src="${prefix}js/head-lang.min.js" defer></script>\n`;
}

/** Blocking critical CSS (shared file; no inline duplicate per page). */
export function headCriticalCss(prefix) {
  return syncCssLink(`${prefix}css/critical.min.css`);
}

/** Decorative page-header-word caption (métodos, RPG, patologías, artículos index). */
export function pageCaptionMarkup(label, { variant = "word" } = {}) {
  const longClass = label.length > 11 ? " page-header-word--long" : "";
  if (variant === "title") {
    return `            <div class="page-caption">
              <h1 class="page-title page-header-word${longClass}">${escHtml(label)}</h1>
            </div>`;
  }
  return `            <div class="page-caption">
              <span class="page-header-word${longClass}" aria-hidden="true">${escHtml(label)}</span>
            </div>`;
}

export function pageHeaderSection(captionMarkup) {
  return `    <section class="page-header">
      <div class="container">
        <div class="row">
          <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
${captionMarkup}
          </div>
        </div>
      </div>
    </section>`;
}

export function pageBreadcrumbSection({
  homeHref,
  homeLabel,
  parentHref,
  parentLabel,
  activeLabel,
}) {
  const parentItem =
    parentHref && parentLabel
      ? `\n            <li><a href="${parentHref}">${parentLabel}</a></li>`
      : "";

  return `    <section class="page-breadcrumb">
      <div class="container">
        <div class="col-lg-12">
          <ol class="breadcrumb">
            <li><a href="${homeHref}">${homeLabel}</a></li>${parentItem}
            <li class="active">${activeLabel}</li>
          </ol>
        </div>
      </div>
    </section>`;
}

/** Title, description, canonical, hreflang and Open Graph tags for page builders. */
export function headSeoBlock({
  lang,
  stem,
  title,
  description,
  ogDescription,
  type = "website",
  image,
  imageWidth,
  imageHeight,
  canonical,
}) {
  const url = canonical ?? absoluteUrl(lang, stem);
  const locale = OG_LOCALE[lang] ?? ogLocaleFor(lang);
  const ogDesc = ogDescription ?? description;
  const lines = [
    `  <meta name="description" content="${escHtml(description)}" />`,
    `  <title>${escHtml(title)}</title>`,
    `  <link rel="canonical" href="${url}" />`,
    hreflangLinks(stem),
    `  <meta property="og:title" content="${escHtml(title)}" />`,
    `  <meta property="og:description" content="${escHtml(ogDesc)}" />`,
  ];
  if (image) {
    lines.push(`  <meta property="og:image" content="${image}" />`);
    const dims =
      imageWidth && imageHeight
        ? { width: imageWidth, height: imageHeight }
        : socialImageDimensions(image);
    if (dims) {
      lines.push(
        `  <meta property="og:image:width" content="${dims.width}" />`,
        `  <meta property="og:image:height" content="${dims.height}" />`,
      );
    }
  }
  lines.push(
    `  <meta property="og:url" content="${url}" />`,
    `  <meta property="og:type" content="${type}" />`,
    `  <meta property="og:site_name" content="Kinésica" />`,
    `  <meta property="og:locale" content="${locale}" />`,
  );
  return lines.join("\n");
}

/** JSON-LD LocalBusiness (Charcas 3889, teléfono, horarios) — SEO local / Local Pack. */
export function headLocalBusinessSchema(lang, { home = false } = {}) {
  const schema = home ? buildHomeGraph(lang) : buildClinicOnly(lang);
  return ldJsonScript(schema);
}

/** Twitter Card tags (home and shareable pages). */
export function headTwitterBlock({ title, description, image, imageAlt }) {
  const lines = [
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:title" content="${escHtml(title)}" />`,
    `  <meta name="twitter:description" content="${escHtml(description)}" />`,
  ];
  if (image) {
    lines.push(`  <meta name="twitter:image" content="${image}" />`);
  }
  if (imageAlt) {
    lines.push(
      `  <meta name="twitter:image:alt" content="${escHtml(imageAlt)}" />`,
    );
  }
  return lines.join("\n");
}

export function bodyShellTop(prefix) {
  return (
    `  <div id="site-skip-link-root"></div>\n` +
    `  <div id="site-gtm-body-root"></div>\n` +
    `  <script src="${prefix}js/shell-top.min.js" defer></script>\n`
  );
}

export function ctaStripPlaceholder(lang, prefix, { insideMain = false } = {}) {
  const l = partialLang(lang);
  const divIndent = insideMain ? "    " : "  ";
  return (
    `${divIndent}<div id="site-cta-strip-root" data-cta-lang="${l}"></div>\n` +
    `  <script src="${prefix}js/shell-cta-${l}.min.js" defer></script>`
  );
}

export function bodyFooterAndUiScripts(
  lang,
  prefix,
  { faqAccordion = false, mapEmbedFacade = false } = {},
) {
  const l = partialLang(lang);
  const lines = [
    `  <div id="site-footer-root" data-footer-lang="${lang}"></div>`,
    `  <script src="${prefix}js/shell-footer-${l}.min.js" defer></script>`,
    `  <div id="site-whatsapp-root" data-whatsapp-lang="${lang}"></div>`,
    `  <script src="${prefix}js/shell-whatsapp-${l}.min.js" defer></script>`,
    `  <script src="${prefix}js/ui-core.min.js" defer></script>`,
  ];
  if (faqAccordion || mapEmbedFacade) {
    lines.push(`  <script src="${prefix}js/ui-home.min.js" defer></script>`);
  }
  return lines.join("\n");
}

/** Collapse repeated preconnect hints (e.g. fonts.gstatic.com × 5). */
export function dedupePreconnects(html) {
  const seen = new Set();
  return html.replace(
    /^[ \t]*<link rel="preconnect" href="([^"]+)"([^>]*)\/>\s*\n/gm,
    (match, href, rest) => {
      const cross = /crossorigin/i.test(rest);
      const key = `${href}|${cross}`;
      if (seen.has(key)) {
        return "";
      }
      seen.add(key);
      return match;
    },
  );
}
