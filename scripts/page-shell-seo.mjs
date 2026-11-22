/**
 * SEO, Open Graph, Twitter Card and JSON-LD helpers for page-shell.mjs.
 */
import { SITE, absoluteUrl } from "./i18n-urls.mjs";
import { OG_LOCALE, ogLocaleFor } from "./languages.mjs";
import { escHtml, hreflangLinks } from "./html-utils.mjs";
import { buildClinicOnly, buildHomeGraph, ldJsonScript } from "./schema-local-business.mjs";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const SITE_OG_IMAGE = `${SITE}/images/og-image.jpg`;

export function socialImageUrl(filename) {
  const file = !filename || filename === "hero-img.jpg" ? "og-image.jpg" : filename;
  return `${SITE}/images/${file}`;
}

export function socialImageDimensions(imageUrl) {
  if (imageUrl === SITE_OG_IMAGE || imageUrl.endsWith("/images/og-image.jpg")) {
    return { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
  }
  return null;
}

export function headTwitterBlock({ title, description, image, imageAlt }) {
  const lines = [
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:title" content="${escHtml(title)}" />`,
    `  <meta name="twitter:description" content="${escHtml(description)}" />`,
  ];
  if (image) lines.push(`  <meta name="twitter:image" content="${image}" />`);
  if (imageAlt) lines.push(`  <meta name="twitter:image:alt" content="${escHtml(imageAlt)}" />`);
  return lines.join("\n");
}

export function headSeoBlock({
  lang,
  stem,
  title,
  description,
  ogDescription,
  twitterDescription,
  type = "website",
  image,
  imageAlt,
  imageWidth,
  imageHeight,
  canonical,
}) {
  const url = canonical ?? absoluteUrl(lang, stem);
  const locale = OG_LOCALE[lang] ?? ogLocaleFor(lang);
  const ogDesc = ogDescription ?? description;
  const twDesc = twitterDescription ?? ogDesc;
  const twAlt = imageAlt ?? title;
  const lines = [
    `  <meta name="description" content="${escHtml(description)}" />`,
    `  <title>${escHtml(title)}</title>`,
    `  <link rel="canonical" href="${url}" />`,
    hreflangLinks(stem),
    `  <link rel="alternate" type="text/plain" title="llms.txt" href="${SITE}/llms.txt" />`,
    `  <meta property="og:title" content="${escHtml(title)}" />`,
    `  <meta property="og:description" content="${escHtml(ogDesc)}" />`,
  ];
  if (image) {
    lines.push(`  <meta property="og:image" content="${image}" />`);
    if (twAlt) lines.push(`  <meta property="og:image:alt" content="${escHtml(twAlt)}" />`);
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
    headTwitterBlock({ title, description: twDesc, image, imageAlt: twAlt }),
  );
  return lines.join("\n");
}

export function headLocalBusinessSchema(lang, { home = false } = {}) {
  const schema = home ? buildHomeGraph(lang) : buildClinicOnly(lang);
  return ldJsonScript(schema);
}

/** Collapse repeated preconnect hints (e.g. fonts.gstatic.com × 5). */
export function dedupePreconnects(html) {
  const seen = new Set();
  return html.replace(
    /^[ \t]*<link rel="preconnect" href="([^"]+)"([^>]*)\/>\s*\n/gm,
    (match, href, rest) => {
      const key = `${href}|${/crossorigin/i.test(rest)}`;
      if (seen.has(key)) return "";
      seen.add(key);
      return match;
    },
  );
}
