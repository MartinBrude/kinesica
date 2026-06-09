#!/usr/bin/env node
/**
 * Extract method page body copy from existing HTML into methods-content.mjs.
 * Run once after editing HTML by hand, or to refresh from legacy files.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { repoPath } from "./i18n-urls.mjs";
import { LANG_CODES } from "./languages.mjs";
import { METHOD_STEMS, METHOD_UI, METHODS } from "./methods-content.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBlocks(inner) {
  const blocks = [];
  const re = /<(h2|p)(?:\s+class="lead")?>([\s\S]*?)<\/\1>/gi;
  let m;
  let skippedLead = false;
  while ((m = re.exec(inner))) {
    const tag = m[1].toLowerCase();
    const isLead = /class="lead"/i.test(m[0]);
    const text = decodeHtml(m[2].replace(/<[^>]+>/g, " "));
    if (!text) continue;
    if (tag === "p" && isLead) {
      skippedLead = true;
      continue;
    }
    if (tag === "h2") {
      blocks.push({ type: "h2", text });
    } else {
      blocks.push({ type: "p", text });
    }
  }
  return blocks;
}

function extractFromHtml(html) {
  const section = html.match(/<section class="content">[\s\S]*?<\/section>/i)?.[0];
  if (!section) return null;
  const h1 = decodeHtml(section.match(/<h1>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const leadMatch = section.match(/<p class="lead">\s*([\s\S]*?)\s*<\/p>/i);
  const lead = leadMatch ? decodeHtml(leadMatch[1].replace(/<[^>]+>/g, " ")) : "";
  const inner = section.match(
    /<div class="col-lg-8[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/section>/i,
  )?.[1];
  if (!inner) return null;
  const blocks = extractBlocks(inner);
  const image =
    html.match(/property="og:image" content="[^"]+\/images\/([^"]+)"/)?.[1] ??
    null;
  return { h1, lead, blocks, image };
}

const images = {};
const merged = {};

for (const stem of METHOD_STEMS) {
  merged[stem] = {};
  for (const lang of LANG_CODES) {
    const rel = repoPath(lang, stem);
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      console.warn("missing:", rel);
      continue;
    }
    const html = fs.readFileSync(full, "utf8");
    const body = extractFromHtml(html);
    const meta = METHODS[stem]?.[lang];
    if (!body || !meta) {
      console.warn("skip:", rel);
      continue;
    }
    if (body.image && !images[stem]) {
      images[stem] = body.image;
    }
    merged[stem][lang] = {
      ...meta,
      h1: body.h1,
      lead: body.lead,
      blocks: body.blocks,
    };
  }
}

function formatBlocks(blocks, indent = "        ") {
  const lines = [`${indent}blocks: [`];
  for (const block of blocks) {
    lines.push(
      `${indent}  { type: ${JSON.stringify(block.type)}, text: ${JSON.stringify(block.text)} },`,
    );
  }
  lines.push(`${indent}],`);
  return lines.join("\n");
}

function formatLang(lang, data) {
  return `      ${lang}: {
        metaTitle: ${JSON.stringify(data.metaTitle)},
        metaDescription: ${JSON.stringify(data.metaDescription)},
        breadcrumb: ${JSON.stringify(data.breadcrumb)},
        h1: ${JSON.stringify(data.h1)},
        lead: ${JSON.stringify(data.lead)},
${formatBlocks(data.blocks, "        ")}
      }`;
}

const methodEntries = METHOD_STEMS.map((stem) => {
  const langs = LANG_CODES.map((lang) => formatLang(lang, merged[stem][lang])).join(
    ",\n",
  );
  return `    ${JSON.stringify(stem)}: {
      image: ${JSON.stringify(images[stem] ?? "hero-img.jpg")},
${langs}
    }`;
}).join(",\n");

const out = `/**
 * Method/technique pages (ES / EN / FR / PT).
 * Edit copy here, then: npm run build:methods
 */
export const METHOD_STEMS = ${JSON.stringify(METHOD_STEMS, null, 2)};

export const METHOD_UI = ${JSON.stringify(METHOD_UI, null, 2)};

/** @type {Record<string, { image: string, es: MethodLang, en: MethodLang, fr: MethodLang, pt: MethodLang }>} */
export const METHODS = {
${methodEntries}
};

/** @typedef {{ metaTitle: string, metaDescription: string, breadcrumb: string, h1: string, lead: string, blocks: Array<{ type: 'p'|'h2', text: string }> }} MethodLang */

export function methodForStem(stem) {
  return METHODS[stem] ?? null;
}
`;

const target = path.join(ROOT, "scripts/methods-content.mjs");
fs.writeFileSync(target, out);
console.log("Wrote", path.basename(target));
