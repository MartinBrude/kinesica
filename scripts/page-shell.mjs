/**
 * Shared HTML shell fragments for page builders and apply-seo-performance.mjs.
 */
import path from "path";
import { fileURLToPath } from "url";
import { HTML_LANG } from "./i18n-urls.mjs";
import { faviconCacheQuery } from "./favicon-version.mjs";
import { OG_LOCALE, partialLang } from "./languages.mjs";
import { escHtml } from "./html-utils.mjs";

export {
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  SITE_OG_IMAGE,
  socialImageUrl,
  socialImageDimensions,
  headSeoBlock,
  headLocalBusinessSchema,
  headTwitterBlock,
  dedupePreconnects,
} from "./page-shell-seo.mjs";

export const ROBOTO_STYLESHEET = "css/roboto.min.css";
export const LOCALE = HTML_LANG;
export { OG_LOCALE, partialLang };

export function assetPrefixForLang(lang) {
  return lang === "es" ? "" : "../";
}

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

export function headRobotoPreload(prefix) {
  return `  <link rel="preload" href="${prefix}fonts/roboto/roboto-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin />\n`;
}

export function headRobotoStylesheet(prefix) {
  return syncCssLink(`${prefix}${ROBOTO_STYLESHEET}`);
}

export function headPreconnectGtm() {
  return '  <link rel="preconnect" href="https://www.googletagmanager.com" />\n';
}

export function headPreconnectBooking() {
  return (
    '  <link rel="preconnect" href="https://script.google.com" />\n' +
    '  <link rel="preconnect" href="https://script.googleusercontent.com" crossorigin />\n'
  );
}

/** LCP hero: smaller asset on narrow viewports (see images/hero-img-mobile.*). */
export function headHeroImagePreload(prefix) {
  return (
    `  <link rel="preload" as="image" href="${prefix}images/hero-img-mobile.webp" type="image/webp" media="(max-width: 991px)" fetchpriority="high" />\n` +
    `  <link rel="preload" as="image" href="${prefix}images/hero-img.webp" type="image/webp" media="(min-width: 992px)" fetchpriority="high" />\n`
  );
}

/** Standard site CSS: blocking layout + async icons/WhatsApp. */
export function headStandardStylesheets(prefix, { gtm = true, bookingWidget = true } = {}) {
  return (
    headRobotoPreload(prefix) +
    (gtm ? headPreconnectGtm() : "") +
    (bookingWidget ? headPreconnectBooking() : "") +
    syncCssLink(`${prefix}css/bootstrap.min.css`) +
    headRobotoStylesheet(prefix) +
    asyncCssLink(`${prefix}css/font-awesome.min.css`) +
    syncCssLink(`${prefix}css/style.min.css`) +
    asyncCssLink(`${prefix}css/whatsapp.min.css`) +
    (bookingWidget ? asyncCssLink(`${prefix}booking/booking-widget.min.css`) : "")
  );
}

export function headFavicon(prefix) {
  const q = faviconCacheQuery(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  return (
    `  <link rel="icon" type="image/svg+xml" href="${prefix}images/favicon.svg${q}" />\n` +
    `  <link rel="apple-touch-icon" href="${prefix}images/apple-touch-icon.png${q}" />\n`
  );
}

export function headJsClassScript() {
  return '  <script>document.documentElement.classList.add("js");</script>\n';
}

export function headLangDeferScripts(prefix) {
  return `  <script src="${prefix}js/head-lang.min.js" defer></script>\n`;
}

export function headCriticalCss(prefix) {
  return syncCssLink(`${prefix}css/critical.min.css`);
}

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

export function pageBreadcrumbSection({ homeHref, homeLabel, parentHref, parentLabel, activeLabel }) {
  const parentItem =
    parentHref && parentLabel ? `\n            <li><a href="${parentHref}">${parentLabel}</a></li>` : "";

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
  { faqAccordion = false, mapEmbedFacade = false, bookingBundle = true } = {},
) {
  const l = partialLang(lang);
  const lines = [
    `  <div id="site-footer-root" data-footer-lang="${lang}"></div>`,
    `  <script src="${prefix}js/shell-footer-${l}.min.js" defer></script>`,
    `  <div id="site-whatsapp-root" data-whatsapp-lang="${lang}"></div>`,
    `  <script src="${prefix}js/shell-whatsapp-${l}.min.js" defer></script>`,
    `  <script src="${prefix}js/ui-core.min.js" defer></script>`,
  ];
  if (bookingBundle) lines.push(`  <script src="${prefix}booking/booking-bundle.min.js" defer></script>`);
  if (faqAccordion || mapEmbedFacade) lines.push(`  <script src="${prefix}js/ui-home.min.js" defer></script>`);
  return lines.join("\n");
}
