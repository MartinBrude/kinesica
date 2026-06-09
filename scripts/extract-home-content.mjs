#!/usr/bin/env node
/**
 * Extract home page copy and main markup from existing index.html files.
 * Run once: node scripts/extract-home-content.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { repoPath } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function extractMeta(html, name) {
  const re = new RegExp(
    `<meta\\s+(?:property|name)="${name}"\\s+content="([^"]*)"`,
    "i",
  );
  return html.match(re)?.[1] ?? null;
}

function extractTitle(html) {
  const m = html.match(/<title>\s*([\s\S]*?)\s*<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

function extractMain(html) {
  const m = html.match(/<main id="main"[^>]*>([\s\S]*?)<\/main>/i);
  if (!m) return null;
  let main = m[1];

  main = main.replace(
    /<div id="site-cta-strip-root"[^>]*>[\s\S]*?<script src="[^"]*cta-strip-include[^"]*"><\/script>/i,
    "__CTA_PLACEHOLDER__",
  );
  main = main.replace(
    /<div id="site-cta-strip-root"[^>]*><\/div>\s*(?:<script[^>]*cta-strip[^>]*><\/script>\s*)*/i,
    "__CTA_PLACEHOLDER__",
  );

  main = main.replace(/src="\.\.\/images\//g, 'src="__PREFIX__images/');
  main = main.replace(/src="images\//g, 'src="__PREFIX__images/');

  return main.trim();
}

const HOME = {};
for (const lang of LANG_CODES) {
  const rel = repoPath(lang, "index");
  const full = path.join(ROOT, rel);
  const html = fs.readFileSync(full, "utf8");
  const main = extractMain(html);
  if (!main) {
    throw new Error(`No <main> in ${rel}`);
  }
  HOME[lang] = {
    title: extractTitle(html),
    description: extractMeta(html, "description"),
    ogDescription: extractMeta(html, "og:description"),
    twitterDescription:
      extractMeta(html, "twitter:description") ??
      extractMeta(html, "og:description"),
    twitterImageAlt: extractMeta(html, "twitter:image:alt"),
    mainHtml: main,
  };
}

function formatMain(html) {
  const lines = html.split("\n");
  return lines.map((line) => `      ${JSON.stringify(line)}`).join(",\n");
}

const langBlocks = LANG_CODES.map((lang) => {
  const d = HOME[lang];
  return `  ${lang}: {
    title: ${JSON.stringify(d.title)},
    description: ${JSON.stringify(d.description)},
    ogDescription: ${JSON.stringify(d.ogDescription)},
    twitterDescription: ${JSON.stringify(d.twitterDescription)},
    twitterImageAlt: ${JSON.stringify(d.twitterImageAlt)},
    mainHtml: [
${formatMain(d.mainHtml)}
    ].join("\\n"),
  }`;
}).join(",\n");

const out = `/**
 * Home page copy and main markup (ES / EN / FR / PT).
 * Edit here, then: npm run build:home
 * Refresh from HTML: node scripts/extract-home-content.mjs
 */
import { LANG_CODES } from "./languages.mjs";

export const HOME_HERO_IMAGE = "https://www.kinesica.com.ar/images/hero-img.jpg";

/** @type {Record<import("./languages.mjs").LangCode, HomeLang>} */
export const HOME = {
${langBlocks}
};

/** @typedef {{ title: string, description: string, ogDescription: string, twitterDescription: string, twitterImageAlt: string, mainHtml: string }} HomeLang */

export function homeForLang(lang) {
  return HOME[lang] ?? null;
}

export { LANG_CODES };
`;

fs.writeFileSync(path.join(ROOT, "scripts/home-content.mjs"), out);
console.log("Wrote scripts/home-content.mjs");
