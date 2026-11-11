/**
 * Copia idempotente admin/campanas/{feed,story} → admin/campanas/original/{feed,story}.
 * No borra ni sobrescribe originales ya existentes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const campanas = path.join(root, "admin", "campanas");

function copyKind(kind) {
  const srcDir = path.join(campanas, kind);
  const dstDir = path.join(campanas, "original", kind);
  if (!fs.existsSync(srcDir)) {
    throw new Error(`No existe ${srcDir}`);
  }
  fs.mkdirSync(dstDir, { recursive: true });
  const files = fs.readdirSync(srcDir).filter((f) => /\.(png|jpe?g)$/i.test(f));
  let copied = 0;
  let skipped = 0;
  for (const file of files) {
    const src = path.join(srcDir, file);
    const dst = path.join(dstDir, file);
    if (fs.existsSync(dst)) {
      skipped += 1;
      continue;
    }
    fs.copyFileSync(src, dst);
    copied += 1;
  }
  return { kind, total: files.length, copied, skipped, dstDir };
}

const results = ["feed", "story"].map(copyKind);
for (const r of results) {
  console.log(
    `[backup-creativos] ${r.kind}: ${r.total} fuentes → copied=${r.copied} skipped=${r.skipped} → ${path.relative(root, r.dstDir)}`
  );
}
const feedN = fs.readdirSync(path.join(campanas, "original", "feed")).length;
const storyN = fs.readdirSync(path.join(campanas, "original", "story")).length;
if (feedN !== storyN) {
  console.warn(`[backup-creativos] WARN: original/feed=${feedN} vs original/story=${storyN}`);
  process.exitCode = 1;
} else {
  console.log(`[backup-creativos] OK original feed+story = ${feedN}`);
}
