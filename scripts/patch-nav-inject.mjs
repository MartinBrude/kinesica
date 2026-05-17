#!/usr/bin/env node
/**
 * Standardize #navigation to data-nav-inject and add nav script tags.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NAV_INJECT =
  '<div id="navigation" class="nav navbar-nav navbar-right hidden-xs" data-nav-inject="true"></div>';

function listHtml() {
  const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  for (const lang of ["en", "fr"]) {
    const dir = path.join(ROOT, lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".html")) files.push(`${lang}/${f}`);
    }
  }
  return files;
}

const NAV_RE = /<div id="navigation"[^>]*>[\s\S]*?<\/div>/i;

const SCRIPTS_ROOT = `  <script src="partials/nav-es.js"></script>
  <script src="partials/nav-en.js"></script>
  <script src="partials/nav-fr.js"></script>
  <script src="js/nav-include.js"></script>`;

const SCRIPTS_SUB = `  <script src="../partials/nav-es.js"></script>
  <script src="../partials/nav-en.js"></script>
  <script src="../partials/nav-fr.js"></script>
  <script src="../js/nav-include.js"></script>`;

let count = 0;
for (const file of listHtml()) {
  if (file.includes("404")) continue;

  const p = path.join(ROOT, file);
  let html = fs.readFileSync(p, "utf8");
  if (!html.includes('id="navigation"')) continue;

  const orig = html;
  html = html.replace(NAV_RE, NAV_INJECT);

  const scripts = file.includes("/") ? SCRIPTS_SUB : SCRIPTS_ROOT;
  if (!html.includes("nav-include.js")) {
    if (html.includes("site-config.js")) {
      html = html.replace(
        /(<script src="[^"]*site-config\.js"><\/script>)/,
        `$1\n${scripts}`
      );
    } else if (html.includes("footer-en.js")) {
      html = html.replace(
        /(<script src="[^"]*footer-en\.js"><\/script>)/,
        `${scripts}\n  $1`
      );
    }
  }

  if (html !== orig) {
    fs.writeFileSync(p, html);
    count++;
    console.log("nav", file);
  }
}

console.log(`Done. ${count} file(s) updated.`);
