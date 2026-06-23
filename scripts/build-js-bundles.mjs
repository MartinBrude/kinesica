#!/usr/bin/env node
/**
 * Concat minified JS into shell bundles (fixed order, no tree-shaking).
 * Run after minify-assets minifies sources, or via assets:build.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ROOT, toMinPath } from "../assets.config.cjs";
import { allJsBundles } from "./js-bundles.mjs";

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * @param {string} outRel
 * @param {string[]} memberSources non-min source paths
 */
function buildBundle(outRel, memberSources) {
  const parts = [];
  for (const rel of memberSources) {
    const minRel = toMinPath(rel);
    const minPath = path.join(ROOT, minRel);
    if (!fs.existsSync(minPath)) {
      throw new Error(`Bundle ${outRel}: missing ${minRel}`);
    }
    parts.push(fs.readFileSync(minPath, "utf8").trimEnd());
  }
  const combined = parts.join("\n") + "\n";
  const outPath = path.join(ROOT, outRel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, combined);
  return { outRel, bytes: combined.length, members: memberSources.length };
}

export function buildAllJsBundles() {
  const bundles = allJsBundles();
  const rows = [];
  for (const [outRel, members] of Object.entries(bundles)) {
    rows.push(buildBundle(outRel, members));
  }
  return rows;
}

function main() {
  const rows = buildAllJsBundles();
  console.log("JS bundles:\n");
  for (const r of rows) {
    console.log(
      `  ${r.outRel}  ${formatKb(r.bytes)}  (${r.members} files)`,
    );
  }
  console.log(`\n${rows.length} bundle(s) written.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
