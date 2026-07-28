#!/usr/bin/env node
/**
 * Minify review sources + rebuild js/reviews.min.js only (no full CSS purge).
 *
 *   node scripts/rebuild-reviews-assets.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import esbuild from "esbuild";
import { ROOT, toMinPath } from "../assets.config.cjs";
import { SHARED_BUNDLES } from "./js-bundles.mjs";

const SOURCES = SHARED_BUNDLES["js/reviews.min.js"];
const OUT_BUNDLE = "js/reviews.min.js";

async function minifyOne(rel) {
  const inPath = path.join(ROOT, rel);
  const outPath = path.join(ROOT, toMinPath(rel));
  if (!fs.existsSync(inPath)) {
    throw new Error(`Missing source: ${rel}`);
  }
  await esbuild.build({
    entryPoints: [inPath],
    outfile: outPath,
    minify: true,
    bundle: false,
    logLevel: "silent",
    target: ["es2018"],
    legalComments: "none",
  });
  return toMinPath(rel);
}

function buildReviewsBundle() {
  const parts = [];
  for (const rel of SOURCES) {
    const minRel = toMinPath(rel);
    const minPath = path.join(ROOT, minRel);
    if (!fs.existsSync(minPath)) {
      throw new Error(`Missing ${minRel}`);
    }
    parts.push(fs.readFileSync(minPath, "utf8").trimEnd());
  }
  const combined = parts.join("\n") + "\n";
  const outPath = path.join(ROOT, OUT_BUNDLE);
  fs.writeFileSync(outPath, combined);
  return outPath;
}

async function main() {
  for (const rel of SOURCES) {
    const minRel = await minifyOne(rel);
    console.log(`  minified ${rel} → ${minRel}`);
  }
  buildReviewsBundle();
  console.log(`  bundle → ${OUT_BUNDLE}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
