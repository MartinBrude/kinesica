#!/usr/bin/env node
/**
 * Bump ?v= on home reviews.min.js script tags so browsers refetch after sync.
 *
 *   node scripts/bump-reviews-cache.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HOME_HTML = [
  "index.html",
  "en/index.html",
  "fr/index.html",
  "pt/index.html",
];

const RE_SOURCE =
  "((?:src)=[\"'](?:\\.\\./)?js\\/reviews\\.min\\.js)\\?v=\\d+([\"'])";

export function bumpReviewsCache(version = String(Math.floor(Date.now() / 1000))) {
  const updated = [];
  for (const rel of HOME_HTML) {
    const filePath = path.join(ROOT, rel);
    if (!fs.existsSync(filePath)) continue;
    const before = fs.readFileSync(filePath, "utf8");
    const after = before.replace(new RegExp(RE_SOURCE, "g"), `$1?v=${version}$2`);
    if (after === before) continue;
    fs.writeFileSync(filePath, after);
    updated.push(rel);
  }
  return { version, updated };
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const { version, updated } = bumpReviewsCache();
  if (!updated.length) {
    console.log("bump-reviews-cache — no home reviews refs updated.");
  } else {
    console.log(
      `bump-reviews-cache — ?v=${version} → ${updated.join(", ")}`,
    );
  }
}
