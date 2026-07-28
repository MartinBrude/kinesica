#!/usr/bin/env node
/**
 * Daily / CI sync: check review count → fetch → update home bundle only if needed.
 *
 *   npm run reviews:sync
 */
import { syncGoogleReviews } from "./fetch-google-reviews.mjs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function rebuildReviewsAssets() {
  const script = path.join(ROOT, "scripts/rebuild-reviews-assets.mjs");
  const result = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function main() {
  const { changed } = await syncGoogleReviews({ ifChanged: true });
  if (!changed) {
    console.log("reviews:sync — nada que publicar en el index.");
    return;
  }
  console.log("Rebuilding js/reviews.min.js…");
  rebuildReviewsAssets();
  console.log("reviews:sync — listo.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
