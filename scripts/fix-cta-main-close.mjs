#!/usr/bin/env node
/**
 * Ensure </main> closes before site-cta-strip-root when CTA was migrated inside main.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function listHtmlFiles() {
  const files = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith(".html") && !f.startsWith("cv-"));
  for (const lang of ["en", "fr"]) {
    const dir = path.join(ROOT, lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".html")) files.push(`${lang}/${f}`);
    }
  }
  return files;
}

let changed = 0;
for (const file of listHtmlFiles()) {
  if (/404/.test(file) || /index\.html$/.test(file)) continue;
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  if (!html.includes('id="main"') || !html.includes("site-cta-strip-root")) {
    continue;
  }
  const mainOpen = (html.match(/<main\b/g) || []).length;
  const mainClose = (html.match(/<\/main>/g) || []).length;
  if (mainOpen === mainClose) continue;

  const next = html.replace(
    /(<\/section>)\s*(<div id="site-cta-strip-root")/,
    "$1\n  </main>\n  $2",
  );
  if (next !== html) {
    fs.writeFileSync(full, next);
    changed++;
    console.log("fixed </main>:", file);
  }
}
console.log(`Done. ${changed} file(s).`);
