#!/usr/bin/env node
/**
 * Replace duplicated header markup with #site-header-root + header partials.
 * Run: node scripts/migrate-header-shell.mjs && node scripts/inject-static-shell.mjs && npm run assets:build
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { headerShellMarkup } from "./header-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HEADER_BLOCK =
  /<div class="header-top">[\s\S]*?(?:<header class="header">[\s\S]*?<\/header>|<div class="header">[\s\S]*?<\/div>)\s*(?=<(?:main\b|div id="main"))/;

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

function expectedLang(file) {
  if (file.startsWith("en/")) return "en";
  if (file.startsWith("fr/")) return "fr";
  return "es";
}

let changed = 0;
for (const file of listHtmlFiles()) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  if (!HEADER_BLOCK.test(html)) {
    if (html.includes('id="site-header-root"')) {
      continue;
    }
    console.warn("skip (no header block):", file);
    continue;
  }

  const lang = expectedLang(file);
  const prefix = lang === "es" ? "" : "../";
  const shell = headerShellMarkup(lang, prefix);

  const next = html.replace(HEADER_BLOCK, shell);
  if (next !== html) {
    fs.writeFileSync(full, next);
    changed++;
    console.log("migrated:", file);
  }
}

console.log(`Done. ${changed} file(s) migrated to site-header-root.`);
