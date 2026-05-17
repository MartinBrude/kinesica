#!/usr/bin/env node
/**
 * Ensure every en/ and fr/ HTML page loads lang-routes.js before lang-preference.js.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROUTES_TAG = '<script src="../js/lang-routes.js"></script>';

function listLocalizedHtml() {
  const files = [];
  for (const lang of ["en", "fr"]) {
    const dir = path.join(ROOT, lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".html")) files.push(`${lang}/${f}`);
    }
  }
  return files;
}

let patched = 0;
for (const file of listLocalizedHtml()) {
  const p = path.join(ROOT, file);
  let html = fs.readFileSync(p, "utf8");
  if (html.includes("lang-routes.js")) continue;

  if (html.includes("lang-preference.js")) {
    html = html.replace(
      '<script src="../js/lang-preference.js"></script>',
      `${ROUTES_TAG}\n  <script src="../js/lang-preference.js"></script>`
    );
  } else {
    html = html.replace("</body>", `  ${ROUTES_TAG}\n</body>`);
  }
  fs.writeFileSync(p, html);
  patched++;
  console.log("patched", file);
}

console.log(`Done. ${patched} file(s) updated.`);
