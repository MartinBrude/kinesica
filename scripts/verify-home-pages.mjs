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
import { GTM_CONTAINER_ID } from "./site-analytics.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function fail(file, msg) {
  errors.push({ file, msg });
}

function resolveLocal(href, fromFile) {
  if (/^(https?:|mailto:|tel:|javascript:|data:)/i.test(href)) return null;
  const pathOnly = href.split("?")[0].split("#")[0];
  if (!pathOnly || pathOnly === "/") return null;
  if (pathOnly.startsWith("/")) return pathOnly.slice(1);
  const dir = path.dirname(fromFile);
  return path
    .normalize(path.join(dir === "." ? "" : dir, pathOnly))
    .replace(/\\/g, "/");
}

function extractLocalRefs(html) {
  const refs = [];
  const re = /(?:href|src)=["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(html))) refs.push(m[1]);
  const srcset = /srcset=["']([^"']+)["']/gi;
  while ((m = srcset.exec(html))) {
    for (const part of m[1].split(",")) {
      const url = part.trim().split(/\s+/)[0];
      if (url) refs.push(url);
    }
  }
  return refs;
}

const gtmHead = fs.readFileSync(path.join(ROOT, "partials/gtm-head.min.js"), "utf8");
const gtmBody = fs.readFileSync(path.join(ROOT, "partials/gtm-body.js"), "utf8");
if (!gtmHead.includes(GTM_CONTAINER_ID)) {
  fail("partials/gtm-head.min.js", `missing GTM container ${GTM_CONTAINER_ID}`);
}
if (!gtmBody.includes(GTM_CONTAINER_ID)) {
  fail("partials/gtm-body.js", `missing GTM container ${GTM_CONTAINER_ID}`);
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
    fail(rel, 'missing <main id="main">');
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
  if (!html.includes('class="page-home page-home-v2"')) {
    fail(rel, "missing page-home-v2 body class");
  }
  if (!html.includes("css/home-v2.min.css")) {
    fail(rel, "missing home-v2 stylesheet");
  }
  if (!/content="index,\s*follow/.test(html)) {
    fail(rel, "robots must allow index, follow");
  }
  if (/content="[^"]*noindex/i.test(html)) {
    fail(rel, "production home must not be noindex");
  }
  if (html.includes("prototipo")) {
    fail(rel, "prototype copy leaked into production home");
  }
  if (!html.includes("partials/gtm-head")) {
    fail(rel, "GTM head snippet missing");
  }
  if (!html.includes('id="site-gtm-body-root"')) {
    fail(rel, "GTM body placeholder missing");
  }
  if (!html.includes("www.googletagmanager.com")) {
    fail(rel, "GTM preconnect missing");
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
  if (!html.includes('id="faqAccordion"')) {
    fail(rel, "FAQ accordion missing");
  }
  if (!html.includes('id="kinesica-local-schema"')) {
    fail(rel, "local schema block missing (run inject-local-schema)");
  }
  if (!html.includes('"GeoCoordinates"')) {
    fail(rel, "local schema missing GeoCoordinates");
  }
  if (html.includes('<footer class="footer">')) {
    fail(rel, "inlined footer should be JS shell placeholder");
  }

  for (const href of extractLocalRefs(html)) {
    const local = resolveLocal(href, rel);
    if (!local) continue;
    const base = local.split("/").pop();
    if (base.includes("..")) {
      fail(rel, `suspicious href: ${href}`);
      continue;
    }
    const fullPath = path.join(ROOT, local);
    if (!fs.existsSync(fullPath) && base !== "") {
      fail(rel, `broken local link: ${href} (resolved: ${local})`);
    }
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
