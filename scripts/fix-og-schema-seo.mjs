#!/usr/bin/env node
/**
 * Limpieza OG en páginas secundarias (og:locale:alternate, og:image extras).
 * Schema local: npm run seo:schema (scripts/inject-local-schema.mjs).
 * Run: node scripts/fix-og-schema-seo.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function removeOgLocaleAlternate(html) {
  return html.replace(
    /\s*<meta property="og:locale:alternate" content="[^"]+" \/>\n/g,
    "",
  );
}

function removeOgImageExtras(html) {
  return html
    .replace(/\s*<meta property="og:image:width"[^/]*\/>\n/g, "")
    .replace(/\s*<meta property="og:image:height"[^/]*\/>\n/g, "")
    .replace(/\s*<meta property="og:image:alt"[^/]*\/>\n/g, "");
}

function fixFrOg(html) {
  return html
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      '<meta property="og:title" content="Kinésica | Kinésithérapie, ostéopathie et RPG à Palermo" />',
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      '<meta property="og:description" content="Centre de kinésithérapie, ostéopathie et RPG à Palermo. Thérapies manuelles et rendez-vous par WhatsApp." />',
    );
}

const indexFiles = [
  { file: "index.html", lang: "es" },
  { file: "en/index.html", lang: "en" },
  { file: "fr/index.html", lang: "fr" },
  { file: "pt/index.html", lang: "pt" },
];

let changed = 0;
for (const { file, lang } of indexFiles) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  let html = fs.readFileSync(full, "utf8");
  const original = html;
  html = removeOgLocaleAlternate(html);
  html = removeOgImageExtras(html);
  if (lang === "fr") html = fixFrOg(html);
  if (html !== original) {
    fs.writeFileSync(full, html);
    changed++;
    console.log("og cleanup:", file);
  }
}

function walkHtml(dir, base = "") {
  for (const name of fs.readdirSync(dir)) {
    const rel = base ? `${base}/${name}` : name;
    const full = path.join(dir, name);
    if (name.endsWith(".html") && !name.startsWith("cv-")) {
      if (!rel.includes("index.html") && !/404/.test(rel)) {
        let html = fs.readFileSync(full, "utf8");
        const next = removeOgLocaleAlternate(html);
        if (next !== html) {
          fs.writeFileSync(full, next);
          changed++;
          console.log("og cleanup:", rel);
        }
      }
    } else if (fs.statSync(full).isDirectory() && !name.startsWith(".")) {
      walkHtml(full, rel);
    }
  }
}
walkHtml(ROOT);

console.log(`Done. ${changed} file(s) modified.`);
