#!/usr/bin/env node
/**
 * Generate WebP variants for in-page raster images (keep JPG for OG / social).
 * Quality matches hero-img-mobile.webp (cwebp -q 82).
 * Run: npm run images:webp
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMAGES = path.join(ROOT, "images");
const QUALITY = 82;

/** Content images referenced by <img> / CSS (not OG-only assets). */
const CONTENT_JPGS = [
  "hero-img.jpg",
  "rpg.jpg",
  "osteopatia.jpg",
  "cadenas_fisiologicas.jpg",
  "manipulaciones_viscerales.jpg",
  "neurodinamia.jpg",
  "atm.jpg",
  "acupuntura.jpg",
  "posturologia.jpg",
  "maria.jpg",
  "noberto-brude-kinesiologo-osteopata.jpg",
];

function webpPath(jpgName) {
  return path.join(IMAGES, jpgName.replace(/\.jpe?g$/i, ".webp"));
}

for (const name of CONTENT_JPGS) {
  const src = path.join(IMAGES, name);
  if (!fs.existsSync(src)) {
    console.error("Missing source:", src);
    process.exit(1);
  }
  const dest = webpPath(name);
  execSync(`cwebp -q ${QUALITY} "${src}" -o "${dest}"`, { stdio: "inherit" });
  const origKb = (fs.statSync(src).size / 1024).toFixed(1);
  const newKb = (fs.statSync(dest).size / 1024).toFixed(1);
  const saved = (
    100 *
    (1 - fs.statSync(dest).size / fs.statSync(src).size)
  ).toFixed(0);
  console.log(
    `${name} → ${path.basename(dest)}: ${origKb} KB → ${newKb} KB (−${saved}%)`,
  );
}
