#!/usr/bin/env node
/** Ensure nav partials load in header (after header-include). */
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
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  if (!html.includes("site-header-root") || !html.includes("header-include.min.js")) {
    continue;
  }
  const lang = file.startsWith("en/")
    ? "en"
    : file.startsWith("fr/")
      ? "fr"
      : "es";
  const prefix = lang === "es" ? "" : "../";
  const mainIdx = html.indexOf("<main");
  const headerPart = mainIdx > 0 ? html.slice(0, mainIdx) : html;
  if (headerPart.includes(`partials/nav-${lang}.min.js`)) {
    continue;
  }
  const block = `  <script src="${prefix}partials/nav-${lang}.min.js"></script>
  <script src="${prefix}js/nav-include.min.js"></script>`;
  const next = html.replace(
    /(<script src="(?:\.\.\/)?js\/header-include\.min\.js(?:\?v=\d+)?"><\/script>)/,
    `$1\n${block}`,
  );
  if (next !== html) {
    fs.writeFileSync(full, next);
    changed++;
    console.log("fixed:", file);
  }
}
console.log(`Done. ${changed} file(s).`);
