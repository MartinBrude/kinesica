/**
 * HTML asset reference and cache-busting rewrite helpers for minify-assets.mjs.
 */
import fs from "fs";
import path from "path";
import { ROOT, toMinPath } from "../assets.config.cjs";

/** Favicon / apple-touch already versioned separately. */
const IMAGE_CACHE_SKIP = new Set([
  "images/favicon.svg",
  "images/apple-touch-icon.png",
]);

/** Apunta href/src de fuentes → .min en HTML (idempotente). */
export function syncHtmlAssetRefs(html, sources) {
  let out = html;
  for (const rel of sources) {
    const min = toMinPath(rel);
    if (rel === min) continue;
    const esc = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(href|src)=(["'])(?:\\.\\./)?${esc}\\2`, "g");
    out = out.replace(re, (match, attr, quote) => {
      const prefix = match.includes("../") ? "../" : "";
      return `${attr}=${quote}${prefix}${min}${quote}`;
    });
  }
  return out;
}

/** Quita ?v=… de CSS/JS en HTML (idempotente), preservando versiones manuales de admin. */
export function stripCacheQueryFromHtml(html) {
  return html.replace(
    /((?:href|src)=["'](?!.*\/admin\/(?:styles\.css|app\.js))[^"']+\.(?:min\.)?(?:css|js))\?v=\d+(["'])/g,
    "$1$2",
  );
}

/** Quita ?v= de <img src> locales (idempotente). */
export function stripImageCacheQuery(html) {
  return html.replace(
    /((?:src)=["'](?:\.\.\/)?images\/[^"'?]+\.(?:webp|jpe?g|png))\?v=\d+(["'])/gi,
    "$1$2",
  );
}

function imageFileVersion(relFromRoot) {
  const p = path.join(ROOT, relFromRoot);
  if (!fs.existsSync(p)) return null;
  return String(Math.floor(fs.statSync(p).mtimeMs / 1000));
}

/**
 * Hostinger CDN caches images as immutable for 1 year (.htaccess).
 * Same filename would keep serving the old bytes — bust with per-file mtime.
 */
export function applyImageCacheQuery(html) {
  return html.replace(
    /((?:src)=["'])((?:\.\.\/)?images\/[^"']+\.(?:webp|jpe?g|png))(["'])/gi,
    (full, pre, imgRef, quote) => {
      const rel = imgRef.replace(/^\.\.\//, "");
      if (IMAGE_CACHE_SKIP.has(rel)) return full;
      const v = imageFileVersion(rel);
      if (!v) return full;
      return `${pre}${imgRef}?v=${v}${quote}`;
    },
  );
}

/** Añade ?v= a CSS/JS locales minificados del manifest + bundles (idempotente tras strip). */
export function applyCacheQueryToHtml(html, version, sources, bundles = []) {
  let out = html;
  const allRefs = [...sources.map(toMinPath), ...bundles];
  for (const rel of allRefs) {
    const min = rel.endsWith(".min.js") || rel.endsWith(".min.css") ? rel : toMinPath(rel);
    const esc = min.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`((?:href|src)=["'])((?:\\.\\./|/)?${esc})(["'])`, "g");
    out = out.replace(re, `$1$2?v=${version}$3`);
  }
  return out;
}
