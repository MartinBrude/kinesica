#!/usr/bin/env node
/**
 * Generate cohesive SVG thumbnails for articulos index cards.
 * Run: node scripts/generate-article-thumbnails.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PATHOLOGY_STEMS } from "./pathology-content.mjs";
import { buildThumbnailSvg, cardHue } from "./article-thumbnail-icons.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "images", "articles");

fs.mkdirSync(OUT_DIR, { recursive: true });

let written = 0;
for (let i = 0; i < PATHOLOGY_STEMS.length; i++) {
  const stem = PATHOLOGY_STEMS[i];
  const hue = cardHue(i);
  const svg = buildThumbnailSvg(stem, hue);
  const out = path.join(OUT_DIR, `${stem}.svg`);
  fs.writeFileSync(out, svg);
  written++;
}

console.log(`Wrote ${written} thumbnails to images/articles/`);
