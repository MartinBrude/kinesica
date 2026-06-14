#!/usr/bin/env node
/**
 * Generate mobile hero variants from images/hero-img.jpg.
 * Run: npm run images:hero
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "images", "hero-img.jpg");
const MOBILE_JPG = path.join(ROOT, "images", "hero-img-mobile.jpg");
const MOBILE_WEBP = path.join(ROOT, "images", "hero-img-mobile.webp");
const MOBILE_WIDTH = 828;

if (!fs.existsSync(SRC)) {
  console.error("Missing source:", SRC);
  process.exit(1);
}

execSync(
  `sips --resampleWidth ${MOBILE_WIDTH} -s format jpeg -s formatOptions 78 "${SRC}" --out "${MOBILE_JPG}"`,
  { stdio: "inherit" },
);
execSync(
  `cwebp -q 82 -resize ${MOBILE_WIDTH} 0 "${SRC}" -o "${MOBILE_WEBP}"`,
  { stdio: "inherit" },
);

for (const file of [MOBILE_JPG, MOBILE_WEBP, SRC]) {
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`${path.basename(file)}: ${kb} KB`);
}
