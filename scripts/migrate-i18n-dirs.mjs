#!/usr/bin/env node
/**
 * Migrate *_en.html / *_fr.html → /en/*.html and /fr/*.html.
 * Patches Spanish root HTML, generates .htaccess redirects and sitemap.xml.
 *
 * Run from kinesica/: node scripts/migrate-i18n-dirs.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  SITE,
  STEMS,
  absoluteUrl,
  sitePath,
  repoPath,
  legacyAbsoluteUrl,
  legacyRepoPath,
} from "./i18n-urls.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function rewriteAssets(html, inSubdir) {
  if (!inSubdir) {
    return html;
  }
  let out = html.replace(
    /(href|src)="(css|js|images|partials|fonts)\//g,
    '$1="../$2/'
  );
  out = out.replace(/(href|src)="(cv-[^"]+\.pdf)"/g, '$1="../$2"');
  return out;
}

function replaceAllAbsoluteLegacy(html) {
  let out = html;
  const pairs = [];
  for (const lang of ["en", "fr"]) {
    pairs.push([legacyAbsoluteUrl(lang, "index"), absoluteUrl(lang, "index")]);
    for (const stem of STEMS) {
      if (stem === "index") continue;
      pairs.push([legacyAbsoluteUrl(lang, stem), absoluteUrl(lang, stem)]);
    }
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of pairs) {
    out = out.split(from).join(to);
  }
  return out;
}

function migrateHtml(html, sourceLang) {
  const inSubdir = sourceLang !== "es";
  let out = rewriteAssets(html, inSubdir);
  out = replaceAllAbsoluteLegacy(out);

  if (sourceLang === "es") {
    out = out.replace(/href="index_en\.html"/gi, `href="${sitePath("en", "index")}"`);
    out = out.replace(/href="index_fr\.html"/gi, `href="${sitePath("fr", "index")}"`);
    for (const stem of STEMS) {
      if (stem === "index") continue;
      out = out.replace(
        new RegExp(`href="${stem}_en\\.html"`, "gi"),
        `href="${sitePath("en", stem)}"`
      );
      out = out.replace(
        new RegExp(`href="${stem}_fr\\.html"`, "gi"),
        `href="${sitePath("fr", stem)}"`
      );
    }
    out = out.replace(/index_en\.html#/gi, `${sitePath("en", "index")}#`);
    out = out.replace(/index_fr\.html#/gi, `${sitePath("fr", "index")}#`);
    out = out.replace(/href="404_en\.html"/gi, 'href="/en/404.html"');
    out = out.replace(/href="404_fr\.html"/gi, 'href="/fr/404.html"');
    return out;
  }

  const suffix = sourceLang === "en" ? "_en" : "_fr";
  const other = sourceLang === "en" ? "fr" : "en";

  out = out.replace(
    new RegExp(`href="index_${other}\\.html"`, "gi"),
    `href="${sitePath(other, "index")}"`
  );
  out = out.replace(
    new RegExp(`href="index${suffix}\\.html"`, "gi"),
    `href="${sitePath(sourceLang, "index")}"`
  );
  for (const stem of STEMS) {
    if (stem === "index") continue;
    out = out.replace(
      new RegExp(`href="${stem}_${other}\\.html"`, "gi"),
      `href="${sitePath(other, stem)}"`
    );
    out = out.replace(
      new RegExp(`href="${stem}${suffix}\\.html"`, "gi"),
      `href="${sitePath(sourceLang, stem)}"`
    );
  }

  for (const stem of STEMS) {
    if (stem === "index") {
      out = out.replace(/href="index\.html"/gi, `href="${sitePath("es", "index")}"`);
    } else {
      out = out.replace(
        new RegExp(`href="${stem}\\.html"`, "gi"),
        `href="${sitePath("es", stem)}"`
      );
    }
  }

  out = out.replace(/href="404_en\.html"/gi, 'href="/en/404.html"');
  out = out.replace(/href="404_fr\.html"/gi, 'href="/fr/404.html"');
  out = out.replace(/href="404\.html"/gi, 'href="/404.html"');

  out = out.replace(new RegExp(`${suffix}\\.html`, "g"), ".html");
  out = out.replace(/index\.html#/g, `${sitePath(sourceLang, "index")}#`);

  return out;
}

function writePage(lang, stem, html) {
  const rel = repoPath(lang, stem);
  const dest = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, migrateHtml(html, lang), "utf8");
  return rel;
}

function generateHtaccess() {
  const lines = [
    "RewriteEngine On",
    "",
    "# Canonical home for /en/ and /fr/",
    "RewriteRule ^en/index\\.html$ /en/ [R=301,L]",
    "RewriteRule ^fr/index\\.html$ /fr/ [R=301,L]",
    "",
    "# Legacy English filenames → /en/",
    "RewriteRule ^index_en\\.html$ /en/ [R=301,L]",
    "RewriteRule ^404_en\\.html$ /en/404.html [R=301,L]",
    "RewriteRule ^(.+)_en\\.html$ /en/$1.html [R=301,L]",
    "",
    "# Legacy French filenames → /fr/",
    "RewriteRule ^index_fr\\.html$ /fr/ [R=301,L]",
    "RewriteRule ^404_fr\\.html$ /fr/404.html [R=301,L]",
    "RewriteRule ^(.+)_fr\\.html$ /fr/$1.html [R=301,L]",
    "",
    "ErrorDocument 404 /404-router.html",
    "",
  ];
  fs.writeFileSync(path.join(ROOT, ".htaccess"), lines.join("\n"), "utf8");
}

function generateSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [];
  const add = (loc, priority) => {
    urls.push({ loc, priority, lastmod: today });
  };

  for (const stem of STEMS) {
    add(absoluteUrl("es", stem), stem === "index" ? "1.00" : "0.80");
  }
  for (const lang of ["en", "fr"]) {
    add(absoluteUrl(lang, "index"), "0.80");
    for (const stem of STEMS) {
      if (stem === "index") continue;
      add(absoluteUrl(lang, stem), "0.64");
    }
  }
  add(`${SITE}/cv-norberto-brude.pdf`, "0.80");
  add(`${SITE}/cv-norberto-brude_en.pdf`, "0.64");

  const body = urls
    .map(
      (u) => `<url>
  <loc>${u.loc}</loc>
  <lastmod>${u.lastmod}</lastmod>
  <priority>${u.priority}</priority>
</url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
}

function removeLegacyFiles() {
  const removed = [];
  for (const f of fs.readdirSync(ROOT)) {
    if (/_(en|fr)\.html$/.test(f) || f === "404_en.html" || f === "404_fr.html") {
      fs.unlinkSync(path.join(ROOT, f));
      removed.push(f);
    }
  }
  return removed;
}

// --- migrate EN / FR from legacy files ---
for (const lang of ["en", "fr"]) {
  for (const stem of STEMS) {
    const src = path.join(ROOT, legacyRepoPath(lang, stem));
    if (!fs.existsSync(src)) {
      console.error("Missing source:", legacyRepoPath(lang, stem));
      process.exit(1);
    }
    const rel = writePage(lang, stem, fs.readFileSync(src, "utf8"));
    console.log("Wrote", rel);
  }
}

// 404 pages
for (const lang of ["en", "fr"]) {
  const src = path.join(ROOT, `404_${lang}.html`);
  const dest = path.join(ROOT, lang, "404.html");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, migrateHtml(fs.readFileSync(src, "utf8"), lang), "utf8");
  console.log("Wrote", `${lang}/404.html`);
}

// Spanish pages (in place)
for (const stem of STEMS) {
  const rel = stem === "index" ? "index.html" : `${stem}.html`;
  const p = path.join(ROOT, rel);
  fs.writeFileSync(p, migrateHtml(fs.readFileSync(p, "utf8"), "es"), "utf8");
  console.log("Patched", rel);
}

const es404 = path.join(ROOT, "404.html");
if (fs.existsSync(es404)) {
  fs.writeFileSync(es404, migrateHtml(fs.readFileSync(es404, "utf8"), "es"), "utf8");
  console.log("Patched 404.html");
}

generateHtaccess();
console.log("Wrote .htaccess");

generateSitemap();
console.log("Wrote sitemap.xml");

const removed = removeLegacyFiles();
console.log("Removed legacy files:", removed.join(", "));
