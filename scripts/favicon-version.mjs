/**
 * Cache-bust query for favicon / apple-touch-icon (browsers cache them aggressively).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const FAVICON_FILES = [
  "images/favicon.svg",
  "images/apple-touch-icon.png",
];

export function faviconCacheVersion(root = ROOT) {
  let max = 0;
  for (const rel of FAVICON_FILES) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) continue;
    max = Math.max(max, fs.statSync(full).mtimeMs);
  }
  return String(Math.floor(max / 1000) || Math.floor(Date.now() / 1000));
}

export function faviconCacheQuery(root = ROOT) {
  const v = faviconCacheVersion(root);
  return v ? `?v=${v}` : "";
}

/** Strip ?v= from favicon / apple-touch-icon hrefs (idempotent). */
export function stripFaviconCacheQuery(html) {
  return html.replace(
    /((?:href)=["'](?:\.\.\/)?images\/(?:favicon\.svg|apple-touch-icon\.png))\?v=\d+(["'])/g,
    "$1$2",
  );
}

/** Append ?v= to favicon / apple-touch-icon hrefs (idempotent after strip). */
export function applyFaviconCacheQuery(html, version) {
  return html.replace(
    /((?:href)=["'])((?:\.\.\/)?images\/(?:favicon\.svg|apple-touch-icon\.png))(["'])/g,
    `$1$2?v=${version}$3`,
  );
}
