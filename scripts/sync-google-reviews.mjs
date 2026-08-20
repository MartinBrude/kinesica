#!/usr/bin/env node
/**
 * Daily / CI sync: check review count → fetch → update home bundle only if needed.
 *
 *   npm run reviews:sync
 */
import {
  readExistingPayload,
  syncGoogleReviews,
} from "./fetch-google-reviews.mjs";
import { bumpReviewsCache } from "./bump-reviews-cache.mjs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runNode(rel) {
  const result = spawnSync(process.execPath, [path.join(ROOT, rel)], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function main() {
  const existing = readExistingPayload();
  const { changed, payload } = await syncGoogleReviews({ ifChanged: true });
  if (!changed) {
    console.log("reviews:sync — nada que publicar en el index.");
    return;
  }
  console.log("Rebuilding js/reviews.min.js…");
  runNode("scripts/rebuild-reviews-assets.mjs");
  const { version, updated } = bumpReviewsCache();
  if (updated.length) {
    console.log(`Cache-bust reviews.min.js ?v=${version} → ${updated.join(", ")}`);
  }
  const ratingChanged =
    existing.rating !== payload?.rating ||
    existing.userRatingCount !== payload?.userRatingCount;
  if (ratingChanged) {
    console.log("Rating/count changed — refreshing local business schema…");
    runNode("scripts/inject-local-schema.mjs");
    runNode("scripts/build-schema-partials.mjs");
  }
  console.log("reviews:sync — listo.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
