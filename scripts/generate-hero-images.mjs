#!/usr/bin/env node
/**
 * Generate mobile hero variants and Open Graph image from images/hero-img.jpg.
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
const OG_IMAGE = path.join(ROOT, "images", "og-image.jpg");
const MOBILE_WIDTH = 828;
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

if (!fs.existsSync(SRC)) {
  console.error("Missing source:", SRC);
  process.exit(1);
}

const { width, height } = JSON.parse(
  execSync(`sips -g pixelWidth -g pixelHeight "${SRC}"`, { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .reduce((acc, line) => {
      const m = line.match(/pixel(Width|Height):\s*(\d+)/);
      if (m) acc[m[1] === "Width" ? "width" : "height"] = Number(m[2]);
      return acc;
    }, {}),
);

const cropHeight = Math.round(width / (OG_WIDTH / OG_HEIGHT));
const cropWidth = width;
const ogTemp = path.join(ROOT, "images", ".og-image-crop.tmp.jpg");

execSync(
  `sips --resampleWidth ${MOBILE_WIDTH} -s format jpeg -s formatOptions 78 "${SRC}" --out "${MOBILE_JPG}"`,
  { stdio: "inherit" },
);
execSync(
  `cwebp -q 82 -resize ${MOBILE_WIDTH} 0 "${SRC}" -o "${MOBILE_WEBP}"`,
  { stdio: "inherit" },
);
execSync(
  `sips -c ${cropHeight} ${cropWidth} "${SRC}" --out "${ogTemp}"`,
  { stdio: "inherit" },
);
execSync(
  `sips -z ${OG_HEIGHT} ${OG_WIDTH} "${ogTemp}" --out "${OG_IMAGE}"`,
  { stdio: "inherit" },
);
fs.unlinkSync(ogTemp);

for (const file of [MOBILE_JPG, MOBILE_WEBP, OG_IMAGE, SRC]) {
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  const dims = execSync(`sips -g pixelWidth -g pixelHeight "${file}"`, {
    encoding: "utf8",
  });
  const w = dims.match(/pixelWidth:\s*(\d+)/)?.[1];
  const h = dims.match(/pixelHeight:\s*(\d+)/)?.[1];
  console.log(`${path.basename(file)}: ${w}x${h}, ${kb} KB`);
}
