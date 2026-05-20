#!/usr/bin/env node
/**
 * Regenerate sitemap.xml from STEMS + i18n-urls.
 * Run: node scripts/generate-sitemap.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { STEMS, absoluteUrl, repoPath } from "./i18n-urls.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function priority(lang, stem) {
  if (stem === "index") return lang === "es" ? "1.00" : "0.80";
  if (stem === "cv") return lang === "es" ? "0.80" : "0.64";
  return lang === "es" ? "0.80" : "0.64";
}

function lastmod(lang, stem) {
  const rel = repoPath(lang, stem);
  const full = path.join(ROOT, rel);
  const mtime = fs.statSync(full).mtime;
  return mtime.toISOString().slice(0, 10);
}

const entries = [];
for (const stem of STEMS) {
  for (const lang of ["es", "en", "fr"]) {
    const rel = repoPath(lang, stem);
    if (!fs.existsSync(path.join(ROOT, rel))) {
      console.warn("skip missing:", rel);
      continue;
    }
    entries.push({
      loc: absoluteUrl(lang, stem),
      lastmod: lastmod(lang, stem),
      priority: priority(lang, stem),
    });
  }
}

entries.sort((a, b) => a.loc.localeCompare(b.loc));

const body = entries
  .map(
    (e) => `<url>
  <loc>${e.loc}</loc>
  <lastmod>${e.lastmod}</lastmod>
  <priority>${e.priority}</priority>
</url>`,
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

const out = path.join(ROOT, "sitemap.xml");
fs.writeFileSync(out, xml);
console.log(`Wrote ${entries.length} URLs to sitemap.xml`);
