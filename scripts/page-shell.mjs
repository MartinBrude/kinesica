/**
 * Shared HTML shell fragments for page builders and apply-seo-performance.mjs.
 */
import { absoluteUrl, HTML_LANG } from "./i18n-urls.mjs";
import { OG_LOCALE, ogLocaleFor, partialLang } from "./languages.mjs";
import { escHtml, hreflangLinks } from "./html-utils.mjs";

export const FONT_DISPLAY_SWAP =
  "https://fonts.googleapis.com/css?family=Roboto:300,300i,400,400i,500,500i,700,700i&display=swap";

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

export function headPreconnectFonts() {
  return (
    '  <link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
  );
}

export function headPreconnectGtm() {
  return '  <link rel="preconnect" href="https://www.googletagmanager.com" />\n';
}

/** Standard site CSS: blocking layout + async icons/WhatsApp. */
export function headStandardStylesheets(prefix, { gtm = true } = {}) {
  return (
    headPreconnectFonts() +
    (gtm ? headPreconnectGtm() : "") +
    syncCssLink(`${prefix}css/bootstrap.min.css`) +
    syncCssLink(FONT_DISPLAY_SWAP) +
    asyncCssLink(`${prefix}css/font-awesome.min.css`) +
    syncCssLink(`${prefix}css/style.min.css`) +
    asyncCssLink(`${prefix}css/whatsapp.min.css`)
  );
}

export function headFavicon(prefix) {
  return (
    `  <link rel="icon" type="image/svg" href="${prefix}images/favicon.svg" />\n` +
    `  <link rel="apple-touch-icon" href="${prefix}images/apple-touch-icon.png" />\n`
  );
}

/** Marks JS before body paint so lang-picker CSS does not flash inline links. */
export function headJsClassScript() {
  return '  <script>document.documentElement.classList.add("js");</script>\n';
}

export function headLangScripts(prefix) {
  return (
    headJsClassScript() +
    `  <script src="${prefix}js/lang-preference.min.js" defer></script>\n` +
    `  <script src="${prefix}js/redirect.min.js" defer></script>\n`
  );
}

/** Decorative page-header-word caption (métodos, RPG, patologías). */
export function pageCaptionMarkup(label, { variant = "word" } = {}) {
  if (variant === "title") {
    return `            <div class="page-caption">
              <h1 class="page-title">${escHtml(label)}</h1>
            </div>`;
  }
  const longClass = label.length > 11 ? " page-header-word--long" : "";
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

export function pageBreadcrumbSection({ homeHref, homeLabel, activeLabel }) {
  return `    <section class="page-breadcrumb">
      <div class="container">
        <div class="col-lg-12">
          <ol class="breadcrumb">
            <li><a href="${homeHref}">${homeLabel}</a></li>
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
  type = "website",
  image,
  canonical,
}) {
  const url = canonical ?? absoluteUrl(lang, stem);
  const locale = OG_LOCALE[lang] ?? ogLocaleFor(lang);
  const lines = [
    `  <meta name="description" content="${escHtml(description)}" />`,
    `  <title>${escHtml(title)}</title>`,
    `  <link rel="canonical" href="${url}" />`,
    hreflangLinks(stem),
    `  <meta property="og:title" content="${escHtml(title)}" />`,
    `  <meta property="og:description" content="${escHtml(description)}" />`,
  ];
  if (image) {
    lines.push(`  <meta property="og:image" content="${image}" />`);
  }
  lines.push(
    `  <meta property="og:url" content="${url}" />`,
    `  <meta property="og:type" content="${type}" />`,
    `  <meta property="og:site_name" content="Kinésica" />`,
    `  <meta property="og:locale" content="${locale}" />`,
  );
  return lines.join("\n");
}

export function bodyShellTop(prefix) {
  return (
    `  <div id="site-skip-link-root"></div>\n` +
    `  <script src="${prefix}partials/skip-link.min.js" defer></script>\n` +
    `  <script src="${prefix}js/skip-link-include.min.js" defer></script>\n` +
    `  <div id="site-gtm-body-root"></div>\n` +
    `  <script src="${prefix}partials/gtm-body.min.js" defer></script>\n` +
    `  <script src="${prefix}js/gtm-body-include.min.js" defer></script>\n`
  );
}

export function ctaStripPlaceholder(lang, prefix) {
  const l = partialLang(lang);
  return (
    `  <div id="site-cta-strip-root" data-cta-lang="${l}"></div>\n` +
    `  <script src="${prefix}partials/cta-strip-${l}.min.js"></script>\n` +
    `  <script src="${prefix}js/cta-strip-include.min.js"></script>`
  );
}

export function bodyFooterAndUiScripts(lang, prefix, { pageHeaderWord = true } = {}) {
  const l = partialLang(lang);
  const lines = [
    `  <div id="site-footer-root" data-footer-lang="${lang}"></div>`,
    `  <script src="${prefix}js/site-config.min.js" defer></script>`,
    `  <script src="${prefix}partials/footer-${l}.min.js"></script>`,
    `  <script src="${prefix}js/footer-include.min.js"></script>`,
    `  <div id="site-whatsapp-root" data-whatsapp-lang="${lang}"></div>`,
    `  <script src="${prefix}partials/whatsapp-float-${l}.min.js"></script>`,
    `  <script src="${prefix}js/whatsapp-float-include.min.js"></script>`,
    `  <script src="${prefix}js/whatsapp-logic.min.js"></script>`,
  ];
  if (pageHeaderWord) {
    lines.push(
      `  <script src="${prefix}js/page-header-word.min.js" defer></script>`,
    );
  }
  lines.push(
    `  <script src="${prefix}js/mobile-nav.min.js" defer></script>`,
    `  <script src="${prefix}js/ui-reveal.min.js" defer></script>`,
    `  <script src="${prefix}js/sticky-header.min.js" defer></script>`,
  );
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
