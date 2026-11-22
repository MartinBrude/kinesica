/**
 * Head stylesheet normalization and cleanup helpers for apply-seo-performance.mjs.
 */
import { ROBOTO_STYLESHEET, headStandardStylesheets } from "./page-shell.mjs";

export function removeGoogleFonts(html) {
  return html
    .replace(/^\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"[^>]*\/>\s*\n/gm, "")
    .replace(/^\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*\/>\s*\n/gm, "")
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/gi, "");
}

export function removeEmptyNoscript(html) {
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

export function normalizeHeadStylesheets(html, file) {
  if (/\/cv\.html$/.test(file)) return html;
  const p = file.includes("/") ? "../" : "";
  const headEnd = html.indexOf("</head>");
  if (headEnd === -1) return html;

  let head = html.slice(0, headEnd);
  const body = html.slice(headEnd);
  const wantsBooking =
    /(^|\/)agendar\.html$/.test(file) || /page-agendar/.test(html);

  head = head
    .replace(/<!-- Bootstrap -->|<!-- Google Fonts -->|<!-- Font Awesome -->|<!-- Style -->\s*/g, "")
    .replace(/^\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"[^>]*\/>\s*\n/gm, "")
    .replace(/^\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*\/>\s*\n/gm, "")
    .replace(/^\s*<link rel="preload" href="(?:\.\.\/)?fonts\/roboto\/roboto-latin-400-normal\.woff2"[^>]*\/>\s*\n/gm, "")
    .replace(/^\s*<link rel="preconnect" href="https:\/\/www\.googletagmanager\.com"[^>]*\/>\s*\n/gm, "")
    .replace(/^\s*<link rel="preconnect" href="https:\/\/script\.google\.com"[^>]*\/>\s*\n/gm, "")
    .replace(/^\s*<link rel="preconnect" href="https:\/\/script\.googleusercontent\.com"[^>]*\/>\s*\n/gm, "")
    .replace(/<link[^>]*bootstrap\.min\.css[^>]*>\s*/gi, "")
    .replace(/<link[^>]*style\.min\.css[^>]*>\s*/gi, "")
    .replace(/<link[^>]*roboto\.min\.css[^>]*>\s*/gi, "")
    .replace(/<link[^>]*font-awesome\.min\.css[^>]*>\s*/gi, "")
    .replace(/<link[^>]*whatsapp\.min\.css[^>]*>\s*/gi, "")
    .replace(/<link[^>]*booking-widget\.min\.css[^>]*>\s*/gi, "")
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/gi, "")
    .replace(
      /<noscript>(?:\s*<(?:link|noscript)[^>]*>(?:\s*<\/noscript>)?\s*)+<\/noscript>\s*/gi,
      (block) =>
        /bootstrap|style\.min|font-awesome|whatsapp|booking-widget|fonts\.googleapis/.test(block)
          ? ""
          : block,
    );

  const cssBlock = headStandardStylesheets(p, {
    gtm: true,
    bookingWidget: wantsBooking,
  });

  const hasBlockingLayout =
    head.includes(`href="${p}css/bootstrap.min.css" rel="stylesheet"`) &&
    head.includes(`href="${p}css/style.min.css" rel="stylesheet"`) &&
    head.includes(`href="${p}${ROBOTO_STYLESHEET}" rel="stylesheet"`) &&
    head.includes(`href="${p}fonts/roboto/roboto-latin-400-normal.woff2"`) &&
    !head.includes(`rel="preload" href="${p}css/bootstrap.min.css" as="style"`);

  if (hasBlockingLayout) return html;

  if (/<\/title>/.test(head)) {
    head = head.replace(/<\/title>\s*\n/, `</title>\n${cssBlock}`);
  } else {
    head = head.replace("<head>", `<head>\n${cssBlock}`);
  }

  return head + body;
}
