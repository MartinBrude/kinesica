#!/usr/bin/env node
/**
 * Verify generated home pages (SEO shell, structure).
 * Run: node scripts/verify-home-pages.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { absoluteUrl, repoPath, HREFLANG } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import { HOME, HOME_HERO_IMAGE } from "./home-content.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function fail(file, msg) {
  errors.push({ file, msg });
}

for (const lang of LANG_CODES) {
  const rel = repoPath(lang, "index");
  const full = path.join(ROOT, rel);
  const html = fs.readFileSync(full, "utf8");
  const copy = HOME[lang];
  const canonical = absoluteUrl(lang, "index");

  if ((html.match(/<h1\b/gi) ?? []).length !== 1) {
    fail(rel, "expected exactly one <h1>");
  }
  if (!html.includes('<main id="main"')) {
    fail(rel, "missing <main id=\"main\">");
  }
  if (!html.includes('rel="canonical" href="' + canonical + '"')) {
    fail(rel, "canonical mismatch");
  }
  if (!html.includes('property="og:url" content="' + canonical + '"')) {
    fail(rel, "og:url mismatch");
  }
  for (const code of Object.values(HREFLANG)) {
    if (!html.includes(`hreflang="${code}"`)) {
      fail(rel, `missing hreflang ${code}`);
    }
  }
  if (!html.includes(`content="${copy.title}"`)) {
    fail(rel, "title not found in head");
  }
  if (!html.includes(`content="${copy.description}"`)) {
    fail(rel, "meta description mismatch");
  }
  if (!html.includes(`content="${copy.ogDescription}"`)) {
    fail(rel, "og:description mismatch");
  }
  if (!html.includes(`content="${HOME_HERO_IMAGE}"`)) {
    fail(rel, "hero og/twitter image missing");
  }
  if (!html.includes('fetchpriority="high"')) {
    fail(rel, "hero preload missing");
  }
  if (!html.includes('id="kinesica-local-schema"')) {
    fail(rel, "local schema block missing (run inject-local-schema)");
  }
  if (html.includes("<footer class=\"footer\">")) {
    fail(rel, "inlined footer should be JS shell placeholder");
  }
}

if (errors.length) {
  console.error("verify-home-pages FAILED:");
  for (const e of errors) {
    console.error(`  ${e.file}: ${e.msg}`);
  }
  process.exit(1);
}

console.log(`OK: ${LANG_CODES.length} home page(s) verified.`);
