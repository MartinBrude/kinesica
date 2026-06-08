/**
 * Shared HTML escaping, hreflang blocks and JSON-LD helpers for page builders.
 */
import { absoluteUrl, HREFLANG } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";

export function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Alternate + x-default link tags for a page stem (no trailing newline). */
export function hreflangLinks(stem) {
  const block = LANG_CODES.map(
    (code) =>
      `  <link rel="alternate" hreflang="${HREFLANG[code]}" href="${absoluteUrl(code, stem)}" />`,
  ).join("\n");
  return (
    block +
    `\n  <link rel="alternate" hreflang="x-default" href="${absoluteUrl("es", stem)}" />`
  );
}

/**
 * Patch title, meta description, Open Graph and Twitter tags in static HTML.
 * Omitted fields are left unchanged.
 */
export function patchPageMeta(html, { title, description, pageTitle } = {}) {
  let out = html;
  const ogTitle = title || pageTitle;

  if (title) {
    out = out.replace(
      /<title>[^<]*<\/title>/,
      `<title>${escHtml(title)}</title>`,
    );
  }
  if (description) {
    out = out.replace(
      /<meta name="description"\s*\n?\s*content="[^"]*"\s*\/?>/,
      `<meta name="description"\n    content="${escHtml(description)}" />`,
    );
    if (ogTitle) {
      out = out.replace(
        /<meta property="og:title" content="[^"]*"\s*\/?>/,
        `<meta property="og:title" content="${escHtml(ogTitle)}" />`,
      );
      out = out.replace(
        /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
        `<meta name="twitter:title" content="${escHtml(ogTitle)}" />`,
      );
    }
    out = out.replace(
      /<meta property="og:description"\s*\n?\s*content="[^"]*"\s*\/?>/,
      `<meta property="og:description"\n    content="${escHtml(description)}" />`,
    );
    out = out.replace(
      /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
      `<meta name="twitter:description" content="${escHtml(description)}" />`,
    );
  }
  return out;
}

/** Schema.org BreadcrumbList from ordered { name, item } entries. */
export function breadcrumbListSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.item,
    })),
  };
}
